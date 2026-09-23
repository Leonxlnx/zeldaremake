/**
 * squad4 probe — CPU-only measurement of the ground cover along the owner's north walk.
 *
 * Builds the vegetation field, the blade tiles and the plant sets the way plants.test.mjs does
 * (no renderer) and reports, per box: blades / m², blade height p50 / p95, and the plant roots of
 * every set. Boxes are the ground the owner walks past between the plaza and the hollow — the
 * left (west) verge first, its right counterpart for comparison.
 *
 *   node art/environment/squad4-2026-09-23/probe.mjs [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const modules = new Map();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/world');
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    (id) => {
      if (id === 'three') return THREE;
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
      throw Error(id);
    },
    m,
    m.exports,
  );
  return m.exports;
}
const read = (name) => load(path.join(root, name + '.ts'));

const { WORLD } = read('config');
const { LAYOUT } = read('layout');
const { VegField, newSample } = read('vegetation/field');
const ctx = {
  config: WORLD,
  layout: LAYOUT,
  terrain: read('terrain/heightfield').getLegacyTerrain(),
  rng: read('util/prng').createRng(WORLD.seed),
  wind: read('wind/wind').createWind(),
  quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1.5 },
  shared: {},
};
const group = new THREE.Group();
const field = new VegField(ctx, WORLD.detailRadius + 6, 0.5);
const plants = read('vegetation/plants').buildPlants(ctx, field, group);
const material = new THREE.MeshBasicMaterial();
const grass = await read('vegetation/grass').buildGrass(ctx, field, material, new THREE.Group(), () => {});

/** the ground the owner walks past on the north path: left (west) verge, then the right one */
const BOXES = {
  'L verge 0..-6': [-3.4, -6.0, -0.6, 0.0],
  'L verge -6..-12': [-3.4, -12.0, -0.2, -6.0],
  'L lawn band': [-3.1, -10.5, -1.6, -6.4],
  'L verge -12..-18': [-3.0, -18.0, 0.2, -12.0],
  'L hollow -18..-26': [-3.0, -26.0, 0.5, -18.0],
  'R verge 0..-6': [2.4, -6.0, 5.2, 0.0],
  'R verge -6..-12': [2.8, -12.0, 5.6, -6.0],
  'R verge -12..-18': [3.2, -18.0, 6.0, -12.0],
  'path shoulders -4..-12': [-2.6, -12.0, 4.6, -4.0],
  'north floor -30..-40': [-3.0, -40.0, 8.0, -30.0],
};

const q = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
const inBox = (x, z, b) => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3];

const report = {};
for (const [name, b] of Object.entries(BOXES)) {
  const hs = [];
  for (const t of grass.tiles) {
    const m = t.mesh.instanceMatrix.array;
    for (let i = 0; i < t.count; i++) {
      const x = m[i * 16 + 12];
      const z = m[i * 16 + 14];
      if (!inBox(x, z, b)) continue;
      hs.push(Math.hypot(m[i * 16 + 4], m[i * 16 + 5], m[i * 16 + 6]));
    }
  }
  // the ground the masks actually let grow (paving, trunks and boulders take the rest)
  const s = newSample();
  let allowed = 0;
  let cells = 0;
  for (let x = b[0] + 0.25; x < b[2]; x += 0.5)
    for (let z = b[1] + 0.25; z < b[3]; z += 0.5) {
      cells++;
      field.sample(x, z, s);
      if (field.allowed(x, z, s, true) && !field.insideGiantTrunk(x, z)) allowed++;
    }
  const area = Math.max(0.25, ((b[2] - b[0]) * (b[3] - b[1]) * allowed) / Math.max(1, cells));
  const sets = {};
  for (const set of plants.all) {
    const n = set.items.filter((it) => inBox(it.x, it.z, b)).length;
    if (n) sets[set.opts.name ?? 'set'] = n;
  }
  report[name] = { bladesPerM2: +(hs.length / area).toFixed(0), h50: +q(hs, 0.5).toFixed(3), h95: +q(hs, 0.95).toFixed(3), openM2: +area.toFixed(1), sets };
}
report.totals = { blades: grass.count, weeds: plants.weeds.count, tufts: plants.tufts.count, ferns: plants.ferns.count, flowers: plants.flowers.count, whiteFlowers: plants.whiteFlowers.count, clover: plants.clover.count };

const json = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
if (json) fs.writeFileSync(json, JSON.stringify(report, null, 2));
for (const [name, r] of Object.entries(report)) {
  if (name === 'totals') continue;
  const sets = Object.entries(r.sets)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  console.log(`${name.padEnd(24)} ${String(r.bladesPerM2).padStart(5)} blades/m²  p50 ${r.h50.toFixed(3)}  p95 ${r.h95.toFixed(3)}  open ${String(r.openM2).padStart(6)} m²  | ${sets}`);
}
console.log('totals', JSON.stringify(report.totals));
