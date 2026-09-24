/**
 * squad4 — what the vegetation submits at a pose, per set, on the CPU (no renderer, ~30 s).
 *
 *   node art/environment/squad4-2026-09-23/veg-budget.mjs [--pose A_stairs] [--json out.json]
 *
 * Builds the field, the blade tiles, the carpet, the plants and the litter the way the vegetation
 * system does, then runs each set's `update()` and `cull()` at a fixed viewpoint and reads the same
 * `stats()` the system reports. This is the aim for fable-5's 13:43 note ("A's 9.15 M triangles are
 * lane 4's vegetation — the turf's density or reach where A does not resolve it"): the browser
 * probe costs a world load and twenty minutes per pass, this costs half a minute, so the cut can be
 * tried and re-measured as often as it takes. Absolute numbers differ from the renderer's (three
 * culls per mesh as well), so read it as shares and deltas.
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
const { VegField } = read('vegetation/field');
const ctx = {
  config: WORLD,
  layout: LAYOUT,
  terrain: read('terrain/heightfield').getLegacyTerrain(),
  rng: read('util/prng').createRng(WORLD.seed),
  wind: read('wind/wind').createWind(),
  quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1.5 },
  shared: {},
  progress() {},
  audit() {},
};
const group = new THREE.Group();
const field = new VegField(ctx, WORLD.detailRadius + 6, 0.5);
const grass = await read('vegetation/grass').buildGrass(ctx, field, read('vegetation/materials').createVegMaterial(ctx, 'grass', { name: 'veg-grass' }), group, () => {});
const carpet = read('vegetation/carpet').buildCarpet(ctx, field, group);
const plants = read('vegetation/plants').buildPlants(ctx, field, group);
group.updateMatrixWorld(true);

const poseName = process.argv.includes('--pose') ? process.argv[process.argv.indexOf('--pose') + 1] : 'A_stairs';
const vp = LAYOUT.viewpoints.find((v) => v.id === poseName);
if (!vp) throw new Error(`no viewpoint ${poseName}`);
const cam = new THREE.PerspectiveCamera(vp.fov, 16 / 9, 0.1, 500);
cam.position.set(...vp.position);
cam.lookAt(...vp.target);
cam.updateMatrixWorld();
const sun = new THREE.Vector3(0.3, 0.9, 0.3).normalize();

grass.update(cam.position);
grass.cull(cam, true);
const sets = [...plants.all, carpet.clumps, carpet.mats, carpet.northClumps, carpet.northMats].filter(Boolean);
for (const s of sets) {
  s.update(cam.position, true, Infinity);
  s.cull(cam, sun, true);
}

// grass.visible is the pre-cull upper bound (grass.ts update()); the submitted count is what the
// tiles' meshes actually carry after cull(), at each tile's current LOD
const trisPerLod = [7, 3, 1];
let grassTris = 0;
let grassDraws = 0;
for (const t of grass.tiles) {
  if (!t.mesh.visible || t.mesh.count === 0) continue;
  grassDraws++;
  grassTris += t.mesh.count * trisPerLod[t.lod];
}
const rows = [{ set: 'grass-tiles', draws: grassDraws, triangles: grassTris, instances: grass.count - grass.culled.trimmed }];
for (const s of sets) {
  const st = s.stats();
  if (st.triangles > 0) rows.push({ set: s.opts.name, draws: st.drawCalls, triangles: st.triangles, instances: s.count });
}
rows.sort((a, b) => b.triangles - a.triangles);
const total = rows.reduce((n, r) => n + r.triangles, 0);
const totalDraws = rows.reduce((n, r) => n + r.draws, 0);
console.log(`pose ${poseName}: vegetation submits ${(total / 1e6).toFixed(3)} M triangles in ${totalDraws} draws`);
for (const r of rows) console.log(`  ${r.set.padEnd(22)} ${(r.triangles / 1e6).toFixed(3)} M  ${String(r.draws).padStart(4)} draws  (${r.instances} placed)`);
console.log(`  grass cull: ${grass.culled.trimmed} blades trimmed of ${grass.count}; verge tiles near/far ${grass.tiles.filter((t) => t.vergeBlades > 0 && t.wantVerge).length}/${grass.tiles.filter((t) => t.vergeBlades > 0 && !t.wantVerge).length}`);
// where the biggest sets' triangles sit, per LOD tier
for (const s of sets) {
  const st = s.stats();
  if (st.triangles < 100000) continue;
  const parts = s
    .submission()
    .filter((m) => m.submitted > 0)
    .map((m) => `lod${m.lod}/p${m.pack} ${m.submitted}x${m.triangles}${m.castShadow ? '+shadow' : ''} = ${((m.submitted * m.triangles) / 1e3).toFixed(0)} K`);
  console.log(`  ${s.opts.name} (lodDistances ${JSON.stringify(s.opts.lodDistances)}): ${parts.join(', ')}`);
}
const json = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
if (json) fs.writeFileSync(json, JSON.stringify({ pose: poseName, total, totalDraws, rows }, null, 2));
