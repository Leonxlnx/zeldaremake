#!/usr/bin/env node
/**
 * surround.mjs — is there a term that tells the plaza from the lawn? (rubric checks 9, 12, 15)
 *
 *   node art/audio/2026-09-26-surround/surround.mjs
 *
 * `2026-09-25-places` scored the thirteen surveyed spots against each other on two axes and found
 * the specific weakness that is still open:
 *
 *     "the pairs that genuinely sound alike are... THE OPEN OUTDOORS. Outdoors, a paved stone
 *      circle in a clearing, an open plateau dais and mid-span over an eight-metre ravine are
 *      within 1.7 dB of one another in shape."
 *
 * The bed has three space terms and none of them separates open places. `enclosure` is indoors,
 * `canopy` is a roof, `gorgeAt` is one cut in the south. The village plaza is ringed by huts and
 * giant boles five to fifteen metres off and the lawn has nothing within fifteen, and nothing in
 * the audio knows the difference.
 *
 * Before building anything: is a term available that WOULD know? This computes one — how much of
 * the horizon is solid, from the same `OCCLUDERS` list the shadows use — and prints it at the
 * thirteen places. If the plaza and the lawn come out the same, the term is not the answer and
 * nothing should be built on it.
 *
 * Pure geometry, no render. A candidate term that cannot separate the places is a null in seconds
 * rather than after an hour of takes.
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
const out = path.resolve(args.out || '/tmp/surround');
fs.mkdirSync(out, { recursive: true });

const A = loadTs('src/audio/index.ts');
const L = loadTs('src/world/layout.ts');

/**
 * The occluders, rebuilt here rather than exported: thirteen giant boles and three huts, with
 * anything swallowed by something larger dropped (a hut is built AROUND its host trunk, so the
 * naive list counts one obstacle twice — the same filter `OCCLUDERS` applies in index.ts).
 */
const all = [
  ...L.LAYOUT.giantTrees.map((t) => ({ x: t.position[0], z: t.position[2], r: t.trunkRadius, what: 'bole' })),
  { x: L.EXPANSION.westHouse.host[0], z: L.EXPANSION.westHouse.host[1], r: L.EXPANSION.westHouse.radius, what: 'hut' },
  { x: L.EXPANSION_NORTH.stilt.host[0], z: L.EXPANSION_NORTH.stilt.host[1], r: L.EXPANSION_NORTH.stilt.radius, what: 'hut' },
  { x: L.EXPANSION_NORTH.hut.host[0], z: L.EXPANSION_NORTH.hut.host[1], r: L.EXPANSION_NORTH.hut.radius, what: 'hut' },
];
const OCCLUDERS = all.filter((a) => !all.some((b) => b !== a && b.r > a.r && Math.hypot(b.x - a.x, b.z - a.z) <= b.r));

/**
 * How much of the horizon around (x, z) is solid, 0 … 1.
 *
 * Each occluder subtends `2 * asin(r / d)` of the circle, and its contribution falls off with
 * distance because a wall fifteen metres away returns far less than the same wall at five — the
 * weight is `1 / (1 + (d / REACH) ** 2)`, the same inverse-square shape the pods and the fairies
 * use. Summed over everything, clamped at 1.
 *
 * NOT a count of nearby things: a bole two metres wide at four metres fills a lot more of the sky
 * than the same bole at twelve, and it is what fills the sky that sends sound back.
 */
const REACH = 9;
function surroundAt(x, z) {
  let s = 0;
  for (const o of OCCLUDERS) {
    const d = Math.hypot(o.x - x, o.z - z);
    if (d <= o.r) return 1;
    const arc = 2 * Math.asin(Math.min(1, o.r / d)) / (2 * Math.PI);
    s += arc / (1 + (d / REACH) ** 2);
  }
  return Math.min(1, s);
}

const places = JSON.parse(fs.readFileSync('art/audio/2026-09-24-standing/places.json', 'utf8')).places;
const rows = places.map((p) => {
  const [x, z] = p.at;
  const near = OCCLUDERS.map((o) => ({ ...o, d: Math.hypot(o.x - x, o.z - z) })).sort((a, b) => a.d - b.d)[0];
  const s = A.surfaceAt(x, z);
  return { id: p.id, at: p.at, note: p.note, surround: surroundAt(x, z), nearest: near, enclosure: s.enclosure, canopy: s.canopy, gorge: s.gorge };
});
rows.sort((a, b) => b.surround - a.surround);

console.log('\nhow much of the horizon is solid, at the thirteen surveyed places\n');
console.log(`${'place'.padEnd(16)} ${'surround'.padStart(9)} ${'nearest solid'.padStart(14)} ${'enclosure'.padStart(10)} ${'canopy'.padStart(7)} ${'gorge'.padStart(6)}`);
for (const r of rows) {
  console.log(`${r.id.padEnd(16)} ${r.surround.toFixed(3).padStart(9)} ${`${r.nearest.what} ${r.nearest.d.toFixed(1)} m`.padStart(14)} ${r.enclosure.toFixed(2).padStart(10)} ${r.canopy.toFixed(2).padStart(7)} ${r.gorge.toFixed(2).padStart(6)}`);
}

const open = rows.filter((r) => r.enclosure < 0.5);
const spread = Math.max(...open.map((r) => r.surround)) - Math.min(...open.map((r) => r.surround));
console.log(`\nacross the ${open.length} places that are not indoors the term spans ${spread.toFixed(3)}`);
const byId = Object.fromEntries(rows.map((r) => [r.id, r.surround]));
for (const [a, b] of [
  ['plaza', 'lawn'],
  ['plaza', 'lookout'],
  ['lookout', 'north-clearing'],
  ['grove-trail', 'grove-deck'],
  ['north-clearing', 'bridge-midspan'],
]) {
  if (byId[a] === undefined || byId[b] === undefined) continue;
  console.log(`   ${a} against ${b}: ${byId[a].toFixed(3)} against ${byId[b].toFixed(3)}  (${Math.abs(byId[a] - byId[b]).toFixed(3)} apart)`);
}
fs.writeFileSync(path.join(out, 'surround.json'), JSON.stringify({ reach: REACH, occluders: OCCLUDERS.length, rows }, null, 1));
console.log(`\nwrote ${path.join(out, 'surround.json')}`);
