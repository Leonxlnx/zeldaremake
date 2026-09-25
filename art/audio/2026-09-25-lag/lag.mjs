#!/usr/bin/env node
/**
 * lag.mjs — how far past a doorway you are before the room closes.
 *
 *   node art/audio/2026-09-25-lag/lag.mjs [--out /tmp/lag] [--tau 0.08]
 *
 * Every term in the bed that depends on WHERE THE LISTENER IS arrives through a
 * `setTargetAtTime`. A smoothing time is a distance once the listener has a speed, and the shipped
 * constants were chosen for weather: 0.9 s on the leaf roll's level, 0.6 on the hall sends, 0.35 on
 * the bed's top, 0.3 on the lantern flame and its pan, 0.12 on the bore's duck. At a run (4.2 m/s)
 * 0.35 s is a metre and a half of ground.
 *
 * Nothing this lane has measured could see it. `at` renders stand still, so every space term is a
 * constant; the scripted walk crosses surfaces but never a bore mouth, a doorway, a canopy edge or
 * a lantern; and the live recordings were all made standing or walking short legs on the plaza.
 *
 * This needs no browser and no audio. `setTargetAtTime(v, t, tau)` is exactly a one-pole —
 * `v0 + (target - v0)(1 - e^{-dt/tau})` — so the heard curve can be computed to the centimetre from
 * the same `surfaceAt` the game reads and the same pod list the scene holds. The weather is held
 * still on purpose: with the gust fixed, everything that moves along the path moves because the
 * listener did.
 *
 * Reported per parameter, per path, per gait:
 *   lag m   — the ground covered between the world reaching the halfway point of the change and
 *             the listener hearing it (for the flame, the shift of the peak)
 *   miss    — the widest gap between what the world says and what is heard, anywhere on the path,
 *             in that parameter's own unit (dB for a gain, octaves for the bed's top, pan for pan)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (fs.existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(args.out || '/tmp/lag');
fs.mkdirSync(out, { recursive: true });

const root = path.resolve(here, '../../..');
const AUDIO = loadTs(path.join(root, 'src/audio/index.ts'));
const AMB = loadTs(path.join(root, 'src/audio/ambience.ts'));
const PODS = JSON.parse(fs.readFileSync(path.join(here, 'pods.json'), 'utf8'));

const TICK = AUDIO.TICK_MS / 1000;
/**
 * The gait the player actually has, read out of `footsteps.ts` rather than copied.
 *
 * It was copied, as `[1.5, 4.2]`, and went stale the moment PR #59 landed a new controller on
 * 2026-09-25: the game now walks at 1.2 m/s and runs at 2.2. Every number this file printed before
 * that describes a player who no longer exists.
 */
const { WALK_SPEED, RUN_GROUND_SPEED } = loadTs(path.join(root, 'src/audio/footsteps.ts'));
const GAITS = [
  ['walk', WALK_SPEED],
  ['run', RUN_GROUND_SPEED],
];
/** the gust is held still: what moves along a path then moves because the listener did */
const TAKES = JSON.parse(fs.readFileSync(path.join(here, 'takes.json'), 'utf8'));
const GUST = TAKES.gust;

/**
 * The bed's smoothed parameters, in the order `update()` sets them. `tau` is what each SHIPPED
 * WITH before 2026-09-25 — the "before" this study is measured against;
 * `place` marks the ones that change because the listener moved. A parameter is scored in the unit
 * an ear works in — decibels for a level, octaves for a cutoff.
 */
const HZ = (c) => AMB.ENCLOSURE_OPEN_HZ * Math.pow(AMB.ENCLOSURE_CLOSED_HZ / AMB.ENCLOSURE_OPEN_HZ, c);
const PARAMS = [
  { id: 'roll level', tau: 0.9, place: true, unit: 'dB' },
  { id: 'hush level', tau: 0.55, place: false, unit: 'dB' },
  { id: 'flame level', tau: 0.3, place: true, unit: 'dB' },
  { id: 'flame pan', tau: 0.3, place: true, unit: 'pan' },
  { id: 'bed top', tau: 0.35, place: true, unit: 'oct' },
  // the same closure smoothed in the 0..1 term instead of in hertz, then mapped. `update()` maps
  // first and lets the AudioParam smooth the hertz, which is not what the comment above the
  // constants says it does: "geometric in frequency so the change is even as he walks in".
  { id: 'bed top*', tau: 0.35, place: true, unit: 'oct', of: 'closed', map: HZ },
  { id: 'bore duck', tau: 0.12, place: true, unit: 'dB' },
  { id: 'hall send', tau: 0.6, place: true, unit: 'dB' },
];

/** every positional target `update()` computes, for a listener at (x, z) facing (fx, fz) */
function targets(x, z, fx, fz) {
  const s = AUDIO.surfaceAt(x, z);
  const sw = AMB.swell(GUST);
  const canopy = s.canopy;
  const gorge = s.gorge;
  const enc = s.enclosure;
  let sum = 0;
  let nearest = 0;
  let px = 0;
  let pz = 0;
  for (const [ax, ay, az] of PODS) {
    const d = Math.hypot(ax - x, ay - 1.2, az - z);
    const a = 1 / (1 + (d / AMB.LANTERN_REACH_M) ** 2);
    sum += a;
    if (a > nearest) nearest = a;
    px += (ax - x) * a;
    pz += (az - z) * a;
  }
  const rx = -fz;
  const rz = fx;
  const plen = Math.hypot(px, pz) || 1;
  const hall = (1 + canopy * AMB.CANOPY_HALL) * (1 + gorge * AMB.GORGE_HALL);
  const closed = Math.max(enc, canopy * AMB.CANOPY_CLOSE);
  return {
    'roll level': (AMB.CANOPY_FLOOR + sw * AMB.CANOPY_GUST) * (1 - AMB.CANOPY_SHARE + AMB.CANOPY_SHARE * canopy) * (1 + gorge * AMB.GORGE_WIND),
    'hush level': AMB.HUSH_FLOOR + Math.pow(sw, 1.8) * AMB.HUSH_GUST,
    'flame level': Math.min(1, nearest + (sum - nearest) * AMB.LANTERN_CROWD_SHARE) * AMB.LANTERN_LEVEL,
    'flame pan': sum > 1e-4 ? Math.max(-1, Math.min(1, ((px * rx + pz * rz) / plen) * 0.8)) : 0,
    'bed top': HZ(closed),
    'bed top*': closed,
    'bore duck': 1 - (1 - AMB.ENCLOSURE_DUCK) * enc,
    'hall send': 0.3 * hall,
  };
}

/** the distance between two values as an ear would count it */
function apart(unit, a, b) {
  if (unit === 'dB') return Math.abs(20 * Math.log10(Math.max(a, 1e-9) / Math.max(b, 1e-9)));
  if (unit === 'oct') return Math.abs(Math.log2(Math.max(a, 1) / Math.max(b, 1)));
  return Math.abs(a - b);
}

/**
 * Walk `path` at `speed`, ticking at the game's rate, and sample both the world's own value and
 * the heard one every centimetre. Between ticks the heard value follows the exact curve
 * `setTargetAtTime` runs, so this is not a model of the smoothing — it is the smoothing.
 */
function walk(p, speed, taus) {
  const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
  const fx = (p.to[0] - p.from[0]) / len;
  const fz = (p.to[1] - p.from[1]) / len;
  const at = (d) => targets(p.from[0] + fx * d, p.from[1] + fz * d, fx, fz);
  const names = PARAMS.map((q) => q.id);
  const held = Object.fromEntries(names.map((n) => [n, at(0)[n]]));
  const start = Object.fromEntries(names.map((n) => [n, at(0)[n]]));
  const rows = [];
  let tickAt = 0;
  for (let d = 0; d <= len + 1e-9; d += CM) {
    const t = d / speed;
    while (t >= tickAt + TICK) {
      // the tick that lands at tickAt+TICK reads the world there and re-aims every parameter
      tickAt += TICK;
      const now = at(Math.min(tickAt * speed, len));
      for (const n of names) {
        const k = 1 - Math.exp(-TICK / taus[n]);
        start[n] = start[n] + (held[n] - start[n]) * k;
        held[n] = now[n];
      }
    }
    const world = at(d);
    const heard = Object.fromEntries(names.map((n) => [n, held[n] + (start[n] - held[n]) * Math.exp(-(t - tickAt) / taus[n])]));
    rows.push({ d, world, heard });
  }
  return rows;
}

/**
 * The ground covered before the ear catches up, and the widest miss on the way.
 *
 * The lag is the shift that best lines the heard curve up with the world's own — the distance you
 * would have to drag the sound back along the path for it to be where the world is. A shift rather
 * than a crossing because the curves are not all ramps: the lantern is a bump, the bed's top is a
 * ramp, and the flame crossing the bridge is a decay. All three have the same question asked of
 * them, and the answer is in metres of ground because that is the unit a player feels it in.
 */
const CM = 0.01;
function lagOf(rows, name, unit, map = (v) => v) {
  const w = rows.map((r) => map(r.world[name]));
  const h = rows.map((r) => map(r.heard[name]));
  const lo = Math.min(...w);
  const hi = Math.max(...w);
  if (apart(unit, hi, lo) < 1e-9) return { lagM: 0, miss: 0, span: 0 };
  let miss = 0;
  for (let i = 0; i < rows.length; i++) miss = Math.max(miss, apart(unit, h[i], w[i]));
  let best = 0;
  let bestErr = Infinity;
  for (let s = 0; s <= Math.round(4 / CM); s++) {
    let err = 0;
    let n = 0;
    for (let i = s; i < rows.length; i++, n++) err += apart(unit, h[i], w[i - s]);
    if (n && err / n < bestErr) {
      bestErr = err / n;
      best = s;
    }
  }
  return { lagM: best * CM, miss, span: apart(unit, hi, lo) };
}

/**
 * Where, in seconds from the start of a take, the WORLD passes the halfway point of the change —
 * the mark the rendered audio is checked against. A bump (the lantern) is marked at its peak.
 */
function marksFor(take) {
  const len = Math.hypot(take.to[0] - take.from[0], take.to[1] - take.from[1]);
  const fx = (take.to[0] - take.from[0]) / len;
  const fz = (take.to[1] - take.from[1]) / len;
  const out = {};
  for (const q of PARAMS) {
    const v = [];
    for (let d = 0; d <= len; d += CM) v.push((q.map ?? ((z) => z))(targets(take.from[0] + fx * d, take.from[1] + fz * d, fx, fz)[q.id]));
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    if (apart(q.unit, hi, lo) < 0.05) continue;
    const first = v[0];
    const last = v[v.length - 1];
    let d;
    if (Math.abs(last - first) < Math.abs(hi - lo) * 0.5) {
      // a bump: the take goes in and comes out again, so the mark is the extreme in the middle —
      // whichever way it went, which for the bore's duck and its top is downward
      const ends = (first + last) / 2;
      let far = 0;
      for (let i = 1; i < v.length; i++) if (Math.abs(v[i] - ends) > Math.abs(v[far] - ends)) far = i;
      d = far * CM;
    } else {
      const mid = (first + last) / 2;
      d = v.length * CM;
      for (let i = 1; i < v.length; i++)
        if ((v[i - 1] - mid) * (v[i] - mid) <= 0) {
          d = i * CM;
          break;
        }
    }
    out[q.id] = { atM: Number(d.toFixed(3)), atS: Number((d / take.speed).toFixed(3)), span: Number(apart(q.unit, hi, lo).toFixed(3)), unit: q.unit };
  }
  return out;
}

/** five real journeys, each one crossing something the bed is supposed to notice */
const PATHS = [
  { id: 'bore', note: 'the north path in through the log arch\u2019s mouth', from: [5.1, -48.0], to: [4.3, -56.0] },
  { id: 'canopy', note: 'the north path from the open village in under the crowns', from: [5.98, -40.0], to: [5.0, -50.0] },
  { id: 'hut', note: 'the west house\u2019s deck in through its door', from: [-18.5, 7.3], to: [-22.3, 8.7] },
  { id: 'lantern', note: 'past the village lantern at (\u22122.5, \u22125.1), a metre off it', from: [-8.45, -4.09], to: [3.55, -4.09] },
  { id: 'bridge', note: 'south over the ravine bridge', from: [3.72, 30.45], to: [4.08, 43.7] },
];

const shipped = Object.fromEntries(PARAMS.map((p) => [p.id, p.tau]));
const proposed = Number(args.tau ?? AMB.PLACE_TAU);
const after = Object.fromEntries(PARAMS.map((p) => [p.id, p.place ? proposed : p.tau]));

const report = { tickMs: AUDIO.TICK_MS, gust: GUST, proposedTau: proposed, paths: [] };
console.log(`tick ${AUDIO.TICK_MS.toFixed(1)} ms, gust held at ${GUST}. "was" is the constant each term shipped with before`);
console.log(`2026-09-25; "now" puts every positional term on ambience.ts PLACE_TAU = ${proposed} s\n`);
for (const p of PATHS) {
  const row = { id: p.id, note: p.note, gaits: {} };
  console.log(`--- ${p.id}: ${p.note} (${Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]).toFixed(1)} m) ---`);
  console.log(`${'parameter'.padEnd(12)} ${'was'.padStart(5)} ${'span'.padStart(9)}  ${'walk lag'.padStart(9)} ${'walk miss'.padStart(10)}  ${'run lag'.padStart(9)} ${'run miss'.padStart(10)}  ${'run now'.padStart(9)} ${'miss now'.padStart(10)}`);
  for (const q of PARAMS) {
    const cells = {};
    for (const [g, v] of GAITS) {
      cells[g] = lagOf(walk(p, v, shipped), q.id, q.unit, q.map);
      cells[g + '-after'] = lagOf(walk(p, v, after), q.id, q.unit, q.map);
    }
    row.gaits[q.id] = cells;
    if (cells.walk.span < 0.05) continue;
    const u = q.unit;
    console.log(
      `${q.id.padEnd(12)} ${q.tau.toFixed(2).padStart(5)} ${(cells.walk.span.toFixed(2) + ' ' + u).padStart(9)}  ` +
        `${(cells.walk.lagM.toFixed(2) + ' m').padStart(9)} ${(cells.walk.miss.toFixed(2) + ' ' + u).padStart(10)}  ` +
        `${(cells.run.lagM.toFixed(2) + ' m').padStart(9)} ${(cells.run.miss.toFixed(2) + ' ' + u).padStart(10)}  ` +
        `${(cells['run-after'].lagM.toFixed(2) + ' m').padStart(9)} ${(cells['run-after'].miss.toFixed(2) + ' ' + u).padStart(10)}`,
    );
  }
  console.log('');
  report.paths.push(row);
}
/**
 * The world's own value of the take's watched term, every `HOP` seconds along it — what the
 * rendered audio is lined up against. In the term's own ear unit, so the trace and the band the
 * analysis pulls out of the WAV are the same shape and a correlation between them means something.
 */
const HOP = 0.01;
function traceFor(take) {
  const len = Math.hypot(take.to[0] - take.from[0], take.to[1] - take.from[1]);
  const fx = (take.to[0] - take.from[0]) / len;
  const fz = (take.to[1] - take.from[1]) / len;
  const q = PARAMS.find((p) => p.id === take.watch);
  const world = [];
  for (let s = 0; s * take.speed <= len; s += HOP) {
    const d = s * take.speed;
    const v = (q.map ?? ((z) => z))(targets(take.from[0] + fx * d, take.from[1] + fz * d, fx, fz)[q.id]);
    world.push(Number((q.unit === 'dB' ? 20 * Math.log10(Math.max(v, 1e-9)) : q.unit === 'oct' ? Math.log2(Math.max(v, 1)) : v).toFixed(4)));
  }
  return { hopS: HOP, watch: take.watch, unit: q.unit, world };
}

// and the marks and traces the rendered takes are checked against, for the journeys `passby.mjs` walks
report.lead = TAKES.lead;
report.takes = TAKES.takes.map((t) => ({ ...t, marks: marksFor(t), trace: traceFor(t) }));
fs.writeFileSync(path.join(out, 'lag.json'), JSON.stringify(report, null, 1));
console.log(`wrote ${path.join(out, 'lag.json')}`);
