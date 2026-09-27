#!/usr/bin/env node
/**
 * worth.mjs — what the sound would gain if it knew about the rest of the forest.
 *
 *   node art/audio/2026-09-26-trunks/worth.mjs --trunks /tmp/trunks/slim.json
 *
 * `OCCLUDERS` in `src/audio/index.ts` is the world as the sound knows it, and it is **eighteen
 * things**: the thirteen giant boles and five buildings. The world draws a great many more, and
 * it already publishes them — `ctx.shared.slimTrunks` is every white-bark and understory bole
 * with its radius and its height extent, built for the play camera's collision and read by the
 * props system too. The audio has never seen it.
 *
 * This asks what that costs, before any plumbing is written, on the same footing the houses
 * iteration used: stand a player everywhere he can stand, look in every direction, and count the
 * bearings that should be shadowed and are not.
 *
 * The list is dumped from a live world (it is computed at build from seeded placements) and read
 * back here, so the geometry is the game's own and not a model of it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  const src = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', src)(
    (n) => {
      if (!n.startsWith('.')) return nodeRequire(n);
      const t = path.resolve(path.dirname(file), n);
      for (const c of [t + '.ts', path.join(t, 'index.ts'), t]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${n} from ${file}`);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const A = loadTs('src/audio/index.ts');
const AM = loadTs('src/audio/ambience.ts');
const slim = JSON.parse(fs.readFileSync(path.resolve(args.trunks || '/tmp/trunks/slim.json'), 'utf8')).map(([x, z, r, y0, y1]) => ({ x, z, r, y0, y1 }));

/** `occlusionAt`, with whichever list of solid things it is given */
function woodOn(list, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  let wood = 0;
  for (const o of list) {
    const t = Math.max(0, Math.min(len, (o.x - ax) * ux + (o.z - az) * uz));
    const perp = Math.hypot(ax + ux * t - o.x, az + uz * t - o.z);
    if (perp >= o.r) continue;
    wood += 2 * Math.sqrt(o.r * o.r - perp * perp);
  }
  return wood;
}

const shipped = A.OCCLUDERS;
const withSlim = [...shipped, ...slim];
const FULL = A.OCCLUSION_FULL_M;
/** how far a bird sits at most (`PERCH_FAR_M`), which is the longest line the sound ever asks about */
const REACH = AM.PERCH_FAR_M;

// where a player can stand: a grid over the walkable box, thinned to points not inside something
const STEP = 1.0;
const BOX = { x0: -40, x1: 40, z0: -40, z1: 60 };
const stands = [];
for (let x = BOX.x0; x <= BOX.x1; x += STEP) {
  for (let z = BOX.z0; z <= BOX.z1; z += STEP) {
    if (withSlim.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)) continue;
    stands.push([x, z]);
  }
}
const BEARINGS = 16;
let bearings = 0;
let hadBefore = 0;
let hadAfter = 0;
let gained = 0;
const adds = [];
for (const [x, z] of stands) {
  for (let b = 0; b < BEARINGS; b++) {
    const th = (b / BEARINGS) * Math.PI * 2;
    const tx = x + Math.sin(th) * REACH;
    const tz = z + Math.cos(th) * REACH;
    const a = woodOn(shipped, x, z, tx, tz);
    const c = woodOn(withSlim, x, z, tx, tz);
    bearings++;
    if (a > 0) hadBefore++;
    if (c > 0) hadAfter++;
    if (c > a + 1e-9) {
      gained++;
      adds.push(c - a);
    }
  }
}
adds.sort((p, q) => p - q);
const q = (p) => (adds.length ? adds[Math.min(adds.length - 1, Math.floor(p * adds.length))] : 0);
const duck = (w) => 20 * Math.log10(1 - AM.OCCLUSION_DUCK * Math.min(1, w / FULL));
/** what the same wood does to a call's top, which is where occlusion is heard hardest */
const top = (w) => 7000 * Math.pow(AM.OCCLUSION_TOP, Math.min(1, w / FULL));

console.log(`\nthe sound's list of solid things, against the world's\n`);
console.log(`  as it ships            ${shipped.length} things`);
console.log(`  the trees already publish ${slim.length} more (white-bark and understory boles, r ${Math.min(...slim.map((s) => s.r)).toFixed(2)}\u2013${Math.max(...slim.map((s) => s.r)).toFixed(2)} m, every one over 2.5 m tall)`);
console.log(`\n  ${stands.length} standing points \u00d7 ${BEARINGS} bearings, each line ${REACH} m long\n`);
console.log(`  bearings with any wood on them   ${((100 * hadBefore) / bearings).toFixed(1)} %  \u2192  ${((100 * hadAfter) / bearings).toFixed(1)} %`);
console.log(`  bearings that gain wood          ${((100 * gained) / bearings).toFixed(1)} %  (${gained} of ${bearings})`);
if (adds.length) {
  console.log(`  wood added, median               ${q(0.5).toFixed(2)} m   p90 ${q(0.9).toFixed(2)} m   most ${adds[adds.length - 1].toFixed(2)} m`);
  console.log(`  what that is worth in level      median ${duck(q(0.5)).toFixed(2)} dB   p90 ${duck(q(0.9)).toFixed(2)} dB   most ${duck(adds[adds.length - 1]).toFixed(2)} dB`);
  console.log(`  and to a call's top               ${top(0).toFixed(0)} → ${top(q(0.5)).toFixed(0)} Hz at the median, ${top(adds[adds.length - 1]).toFixed(0)} at the most`);
  console.log(`  (OCCLUSION_FULL_M = ${FULL} m, OCCLUSION_DUCK = ${AM.OCCLUSION_DUCK}, OCCLUSION_TOP = ${AM.OCCLUSION_TOP})`);

  /**
   * And the calibration. `OCCLUSION_FULL_M` was set at the top of the range of wood a player can
   * get between himself and a source — measured, at the time, against the sixteen things the
   * sound knows about. Adding the rest of the forest moves that range, so the scale it was set
   * from is worth re-reading even if the trunks themselves are not worth adding.
   */
  const deepest = (list) => {
    const out = [];
    for (const [x, z] of stands) {
      let best = 0;
      for (let b = 0; b < BEARINGS; b++) {
        const th = (b / BEARINGS) * Math.PI * 2;
        best = Math.max(best, woodOn(list, x, z, x + Math.sin(th) * REACH, z + Math.cos(th) * REACH));
      }
      out.push(best);
    }
    out.sort((p2, q2) => p2 - q2);
    return out;
  };
  const before = deepest(shipped);
  const after = deepest(withSlim);
  const pick = (v, p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  // over EVERY standing point, including the ones with no wood on any bearing — counting only
  // the non-zero ones would change the population between the two lists and read as a decrease
  console.log(`\n  the deepest wood a player can put between himself and a source, from each standing point`);
  console.log(`    as the sound knows the world   median ${pick(before, 0.5).toFixed(2)} m   p90 ${pick(before, 0.9).toFixed(2)}   most ${before[before.length - 1].toFixed(2)}`);
  console.log(`    as the world actually is       median ${pick(after, 0.5).toFixed(2)} m   p90 ${pick(after, 0.9).toFixed(2)}   most ${after[after.length - 1].toFixed(2)}`);
  console.log(`    OCCLUSION_FULL_M is ${FULL} m, set at the top of that range`);
}
/**
 * And the reason this list cannot simply be plugged in.
 *
 * `slimTrunks` is built from the trees the world DRAWS, so it is shorter at a lower quality
 * setting — 104 against 121 here. Handing it to the audio would make the sound change with a
 * video setting, which is not a thing any player should be able to hear. `--against` takes the
 * same dump from another tier and says how far into the listener's world that reaches.
 */
if (args.against) {
  const other = JSON.parse(fs.readFileSync(path.resolve(args.against), 'utf8')).map(([x, z, r]) => ({ x, z, r }));
  const key = (o) => `${o.x.toFixed(2)},${o.z.toFixed(2)}`;
  const mine = new Set(slim.map(key));
  const theirs = new Set(other.map(key));
  const onlyMine = slim.filter((o) => !theirs.has(key(o)));
  const onlyTheirs = other.filter((o) => !mine.has(key(o)));
  console.log(`\n  the same list at another quality tier: ${slim.length} against ${other.length}`);
  console.log(`    in one and not the other: ${onlyMine.length} / ${onlyTheirs.length}`);
  let n2 = 0;
  let moved = 0;
  const gap = [];
  for (const [x, z] of stands) {
    for (let b = 0; b < BEARINGS; b++) {
      const th = (b / BEARINGS) * Math.PI * 2;
      const tx = x + Math.sin(th) * REACH;
      const tz = z + Math.cos(th) * REACH;
      const a = woodOn([...shipped, ...slim], x, z, tx, tz);
      const c = woodOn([...shipped, ...other], x, z, tx, tz);
      n2++;
      if (Math.abs(a - c) > 1e-9) {
        moved++;
        gap.push(Math.abs(a - c));
      }
    }
  }
  gap.sort((p2, q2) => p2 - q2);
  console.log(`    bearings whose wood would depend on the setting: ${((100 * moved) / n2).toFixed(2)} %`);
  if (gap.length) console.log(`    when it does: median ${duck(gap[Math.floor(gap.length / 2)]).toFixed(2)} dB, most ${duck(gap[gap.length - 1]).toFixed(2)} dB`);
}

fs.mkdirSync(path.resolve(args.out || '/tmp/trunks'), { recursive: true });
fs.writeFileSync(path.join(path.resolve(args.out || '/tmp/trunks'), 'worth.json'), JSON.stringify({ shipped: shipped.length, slim: slim.length, stands: stands.length, bearings, hadBefore, hadAfter, gained, median: q(0.5), p90: q(0.9), max: adds[adds.length - 1] ?? 0 }, null, 1));
