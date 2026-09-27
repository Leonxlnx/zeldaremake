#!/usr/bin/env node
/**
 * missing.mjs — what the sound's list of solid things leaves out.
 *
 *   node art/audio/2026-09-26-houses/missing.mjs [--out /tmp/houses]
 *
 * `OCCLUDERS` in `src/audio/index.ts` is the world as the sound knows it: *"the solid things a
 * player can put between himself and a sound: the thirteen giant boles and the three huts."*
 *
 * `LAYOUT.houses` is not in it. That is the two Kokiri tree-houses in the middle of the village —
 * Saria's, whose trunk is **3.2 m in radius**, and the upper house at 2.7. Saria's is the widest
 * solid thing in the world after the west house and wider than every giant bole, and its nearest
 * listed neighbour is 11.5 m away, so it is not a hut standing on a trunk that is already counted.
 *
 * This prints what adding them changes, before anything is changed: how much wood becomes
 * available on a line, and how much of the level arriving from each positioned source in the bed
 * comes from behind something. The second is the measure `2026-09-26-shadow2` settled on — a
 * Fresnel number says a shadow would be deep, the shadowed share says whether there is anything
 * behind it to shadow.
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
const out = path.resolve(args.out || '/tmp/houses');
fs.mkdirSync(out, { recursive: true });

const A = loadTs('src/audio/index.ts');
const L = loadTs('src/world/layout.ts');

const listed = [
  ...L.LAYOUT.giantTrees.map((t) => ({ x: t.position[0], z: t.position[2], r: t.trunkRadius, id: t.id })),
  { x: L.EXPANSION.westHouse.host[0], z: L.EXPANSION.westHouse.host[1], r: L.EXPANSION.westHouse.radius, id: 'westHouse' },
  { x: L.EXPANSION_NORTH.stilt.host[0], z: L.EXPANSION_NORTH.stilt.host[1], r: L.EXPANSION_NORTH.stilt.radius, id: 'stilt' },
  { x: L.EXPANSION_NORTH.hut.host[0], z: L.EXPANSION_NORTH.hut.host[1], r: L.EXPANSION_NORTH.hut.radius, id: 'northHut' },
];
const houses = L.LAYOUT.houses.map((h) => ({ x: h.position[0], z: h.position[2], r: h.trunkRadius, id: h.id }));

const swallow = (all) => all.filter((a) => !all.some((b) => b !== a && b.r > a.r && Math.hypot(b.x - a.x, b.z - a.z) <= b.r));
const WITHOUT = swallow(listed);
const WITH = swallow([...listed, ...houses]);
const FULL_M = A.OCCLUSION_FULL_M;

console.log('\nthe world as the sound knows it\n');
console.log(`   listed today   ${WITHOUT.length} obstacles, widest ${Math.max(...WITHOUT.map((o) => o.r)).toFixed(1)} m radius`);
console.log(`   with houses    ${WITH.length} obstacles, widest ${Math.max(...WITH.map((o) => o.r)).toFixed(1)} m radius`);
console.log('\n   what is missing:');
for (const h of houses) {
  const near = WITHOUT.map((o) => ({ ...o, d: Math.hypot(o.x - h.x, o.z - h.z) })).sort((a, b) => a.d - b.d)[0];
  const wider = WITHOUT.filter((o) => o.r >= h.r).length;
  console.log(`      ${h.id.padEnd(8)} (${h.x}, ${h.z})  r = ${h.r} m — ${h.r * 2} m of wood across, ${wider} listed obstacle${wider === 1 ? '' : 's'} as wide`);
  console.log(`      ${''.padEnd(8)} nearest listed obstacle: ${near.id} at ${near.d.toFixed(1)} m, so it is not a hut on a trunk already counted`);
}

/** how much wood stands on the line, against a chosen obstacle list */
function wood(ax, az, bx, bz, obstacles) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return 0;
  const ux = dx / len;
  const uz = dz / len;
  let w = 0;
  for (const o of obstacles) {
    const t = Math.max(0, Math.min(len, (o.x - ax) * ux + (o.z - az) * uz));
    const perp = Math.hypot(ax + ux * t - o.x, az + uz * t - o.z);
    if (perp >= o.r) continue;
    w += 2 * Math.sqrt(o.r * o.r - perp * perp);
  }
  return w;
}

// the ground a player can stand on, the same grid `2026-09-26-shadow2` used
const stands = [];
for (let x = -46; x <= 30; x += 1) {
  for (let z = -108; z <= 56; z += 1) {
    const s = A.surfaceAt(x, z);
    if (s.enclosure > 0.5) continue;
    stands.push([x, z]);
  }
}

/**
 * A bird sits in a crown. Perches are seeded at runtime around the listener, so instead of
 * guessing them this asks the question the other way round: standing anywhere, in how many
 * DIRECTIONS is there a shadow, and how deep? Sixteen bearings at the far end of a perch's range.
 */
const PERCH_M = 24;
let bearingsWith = 0;
let bearingsWithout = 0;
let deepest = { w: 0 };
for (const [x, z] of stands) {
  for (let k = 0; k < 16; k++) {
    const th = (k / 16) * Math.PI * 2;
    const bx = x + Math.cos(th) * PERCH_M;
    const bz = z + Math.sin(th) * PERCH_M;
    const a = wood(x, z, bx, bz, WITHOUT);
    const b = wood(x, z, bx, bz, WITH);
    if (a > 0.5) bearingsWithout++;
    if (b > 0.5) bearingsWith++;
    if (b - a > deepest.w) deepest = { w: b - a, at: [x, z], toward: [Number(bx.toFixed(1)), Number(bz.toFixed(1))], before: a, after: b };
  }
}
const total = stands.length * 16;
console.log(`\na bird in a crown ${PERCH_M} m off, over ${stands.length} standing points and sixteen bearings from each\n`);
console.log(`   shadowed today      ${bearingsWithout} of ${total} bearings  (${((100 * bearingsWithout) / total).toFixed(1)} %)`);
console.log(`   with the houses     ${bearingsWith} of ${total} bearings  (${((100 * bearingsWith) / total).toFixed(1)} %)`);
console.log(`   the houses add      ${bearingsWith - bearingsWithout} bearings, ${(((bearingsWith - bearingsWithout) / Math.max(1, bearingsWithout)) * 100).toFixed(0)} % more of the world`);
console.log(`   deepest new shadow  ${deepest.w.toFixed(2)} m of wood standing at ${JSON.stringify(deepest.at)}, against ${deepest.before.toFixed(2)} m today`);
console.log(`                       that is ${(deepest.after / FULL_M).toFixed(2)} of OCCLUSION_FULL_M, where today it is ${(deepest.before / FULL_M).toFixed(2)}`);

fs.writeFileSync(path.join(out, 'missing.json'), JSON.stringify({ without: WITHOUT.length, with: WITH.length, houses, bearingsWithout, bearingsWith, total, deepest }, null, 1));
console.log(`\nwrote ${path.join(out, 'missing.json')}`);
