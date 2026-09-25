#!/usr/bin/env node
/**
 * stale.mjs — what a bird call still carries from four seconds ago.
 *
 *   node art/audio/2026-09-25-stale/stale.mjs [--takes /tmp/stale]
 *
 * A perch is a place now and a voice follows his facing, so a call arrives from the right
 * direction. Three things about it are still decided when the call is BOOKED, which is up to
 * `AMBIENCE_AHEAD` — four seconds — before it is heard:
 *
 *   level    a call is scaled by `1 - 0.66 * distance`
 *   colour   and low-passed at `7000 - 5200 * distance`
 *   shadow   and, if there is wood between them, ducked by OCCLUSION_DUCK and its top multiplied
 *            by OCCLUSION_TOP
 *
 * At a walk four seconds is six metres and at a run seventeen, which is enough to walk out from
 * behind a bole. This says what that is worth, exactly: no browser and no audio, from `perchSpots`
 * (where the trees are), `birdSpots` (when each call sounded) and the `pass` geometry (where he
 * was), with `occlusionAt` the same function the bed calls.
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
const root = path.resolve(here, '../../..');
const A = loadTs(path.join(root, 'src/audio/index.ts'));
const AMB = loadTs(path.join(root, 'src/audio/ambience.ts'));
const takesDir = path.resolve(args.takes || '/tmp/stale');

/** where he is at context time `t`, from the pass geometry (the same triangle wave `index.ts` walks) */
function atTime(take, lead, t) {
  const [ax, az] = take.from;
  const [bx, bz] = take.to;
  const ln = Math.hypot(bx - ax, bz - az) || 1;
  const travel = Math.max(0, (t - lead) * take.speed) / ln;
  const leg = travel % 2;
  const u = take.loop ? (leg <= 1 ? leg : 2 - leg) : Math.min(1, travel);
  return [ax + (bx - ax) * u, az + (bz - az) * u];
}

const lvl = (d) => 1 - 0.66 * Math.min(1, d);
const hz = (d) => 7000 - 5200 * Math.min(1, d);

const out = { takes: [] };
for (const tag of ['before', 'after']) {
  const file = path.join(takesDir, `takes-${tag}.json`);
  if (!fs.existsSync(file)) continue;
  const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const take of meta.takes) {
    const perch = new Map(take.perches.map((p) => [p[0], [p[1], p[2]]]));
    const rows = [];
    for (const [kind, , , at] of take.spots) {
      const p = perch.get(kind);
      if (!p) continue;
      const book = atTime(take, meta.lead, at - A.AMBIENCE_AHEAD);
      const sound = atTime(take, meta.lead, at);
      const db = Math.hypot(p[0] - book[0], p[1] - book[1]) / AMB.PERCH_FAR_M;
      const ds = Math.hypot(p[0] - sound[0], p[1] - sound[1]) / AMB.PERCH_FAR_M;
      const sb = A.occlusionAt(book[0], book[1], p[0], p[1]);
      const ss = A.occlusionAt(sound[0], sound[1], p[0], p[1]);
      const reach = (d, s) => lvl(d) * (1 - AMB.OCCLUSION_DUCK * s);
      const top = (d, s) => hz(d) * Math.pow(AMB.OCCLUSION_TOP, s);
      // …and the same over the 0.9 s a call is measured across, because the voice keeps following
      // him through it: at a run he covers 3.8 m while the bird is singing, so the change the file
      // shows is not the one the onset alone asks for
      let sum = 0;
      let n = 0;
      for (let s = 0; s < 0.9; s += 0.01, n++) {
        const at2 = atTime(take, meta.lead, at + s);
        const d2 = Math.hypot(p[0] - at2[0], p[1] - at2[1]) / AMB.PERCH_FAR_M;
        sum += reach(d2, A.occlusionAt(at2[0], at2[1], p[0], p[1]));
      }
      rows.push({
        kind,
        at,
        // signed, booking → sounding: what a call's level and its cutoff SHOULD move by once it
        // stops being given the geometry of four seconds ago. `heard.py` checks the files against
        // these.
        wantDb: 20 * Math.log10(sum / n / reach(db, sb)),
        wantHz: top(ds, ss) - top(db, sb),
        // what the distance alone is worth, and what the shadow alone is worth, in the units an ear
        // reads them in: decibels of level and hertz of cutoff
        dB: Math.abs(20 * Math.log10(lvl(db) / lvl(ds))),
        hz: Math.abs(hz(db) - hz(ds)),
        shadow: Math.abs(sb - ss),
        shadowDb: Math.abs(20 * Math.log10((1 - AMB.OCCLUSION_DUCK * sb) / (1 - AMB.OCCLUSION_DUCK * ss))),
        shadowOct: Math.abs(Math.log2(Math.pow(AMB.OCCLUSION_TOP, sb) / Math.pow(AMB.OCCLUSION_TOP, ss))),
      });
    }
    if (rows.length) out.takes.push({ tag, id: take.id, note: take.note, rows });
  }
}

const med = (v) => (v.length ? v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);
const worst = (v) => (v.length ? Math.max(...v) : 0);
console.log('what a call is given at booking against what it should have at sounding, four seconds later\n');
console.log(`${'take'.padEnd(16)} ${'calls'.padStart(5)}  ${'level'.padStart(6)} ${'worst'.padStart(6)}  ${'cutoff'.padStart(7)} ${'worst'.padStart(6)}  ${'shadow'.padStart(6)} ${'worst'.padStart(6)}  ${'that is'.padStart(8)} ${'and'.padStart(8)}`);
for (const t of out.takes) {
  const d = t.rows.map((r) => r.dB);
  const h = t.rows.map((r) => r.hz);
  const s = t.rows.map((r) => r.shadow);
  const sd = t.rows.map((r) => r.shadowDb);
  const so = t.rows.map((r) => r.shadowOct);
  console.log(
    `${(t.tag + ' ' + t.id).padEnd(16)} ${String(t.rows.length).padStart(5)}  ${med(d).toFixed(2).padStart(5)}dB ${worst(d).toFixed(2).padStart(5)}  ${med(h).toFixed(0).padStart(6)}Hz ${worst(h).toFixed(0).padStart(6)}  ` +
      `${med(s).toFixed(3).padStart(6)} ${worst(s).toFixed(3).padStart(6)}  ${worst(sd).toFixed(2).padStart(6)}dB ${worst(so).toFixed(2).padStart(6)}oct`,
  );
}
fs.writeFileSync(path.join(takesDir, 'stale.json'), JSON.stringify(out, null, 1));
console.log(`\nwrote ${path.join(takesDir, 'stale.json')}`);
