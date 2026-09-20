/**
 * Grass blade-tile submission culling (round 49, perf-3): `buildGrass().cull` trims the visible
 * tiles the frustum cuts to the 2 m cells that can reach it, keeps the kept blades' streams exactly
 * (matrices and aData, original order), restores a tile when every cell is back, leaves a tile the
 * frustum swallows whole untouched, and keeps `culled.trimmed` equal to what the tile counts are
 * missing. Real placement over the real field, no renderer.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const modules = new Map(),
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const { WORLD } = read('config'),
  { LAYOUT } = read('layout'),
  { VegField } = read('vegetation/field');
const ctx = { config: WORLD, layout: LAYOUT, terrain: read('terrain/heightfield').createTerrain(), rng: read('util/prng').createRng(WORLD.seed), wind: read('wind/wind').createWind(), quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1 }, shared: {}, progress() {} };
const field = new VegField(ctx, WORLD.detailRadius + 6, 0.5);
const group = new THREE.Group();
const grass = await read('vegetation/grass').buildGrass(ctx, field, new THREE.MeshStandardMaterial(), group, () => {});
group.updateMatrixWorld(true);
assert.ok(grass.tiles.length > 10, 'tiles built');
const pristine = new Map(grass.tiles.map((t) => [t, { mat: Float32Array.from(t.mesh.instanceMatrix.array), data: Float32Array.from(t.lods[0].getAttribute('aData').array) }]));
const sumCounts = () => grass.tiles.reduce((n, t) => n + t.mesh.count, 0);
assert.equal(sumCounts(), grass.count, 'every blade is in the graph before the first cull');

// camera A's pose: on the lawn at the stair foot, looking north
const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 500);
cam.position.set(0.4, 1.8, 8.6);
cam.lookAt(0.4 + 0.4, 1.8 - 0.058, 8.6 - 0.915);
cam.updateMatrixWorld();
grass.update(cam.position);
grass.cull(cam, true);
const visible = grass.tiles.filter((t) => t.mesh.visible);
assert.ok(visible.length >= 8, `tiles in range at A (${visible.length})`);
assert.ok(grass.culled.trimmedTiles >= 3, `tiles the frustum cuts are trimmed (${grass.culled.trimmedTiles})`);
assert.ok(grass.culled.trimmed > 10000, `a real share of the near blades is behind / beside the camera (${grass.culled.trimmed})`);
assert.equal(grass.culled.trimmed, grass.count - sumCounts(), 'trimmed tracks what the tile counts are missing');
const atA = { ...grass.culled };
// the frustum, three's way
const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
for (const t of grass.tiles) {
  const p = pristine.get(t);
  const mat = t.mesh.instanceMatrix.array;
  const dat = t.lods[0].getAttribute('aData').array;
  if (t.mesh.count === t.count) {
    assert.deepEqual(Array.from(mat), Array.from(p.mat), `${t.mesh.name}: an untrimmed tile keeps its pristine stream`);
    continue;
  }
  assert.ok(t.mesh.visible, 'only visible tiles are trimmed on the first cull');
  // every kept blade is a pristine blade, in order, with its aData
  let last = -1;
  for (let j = 0; j < t.mesh.count; j++) {
    let i = last + 1;
    while (i < t.count && !(p.mat[i * 16 + 12] === mat[j * 16 + 12] && p.mat[i * 16 + 13] === mat[j * 16 + 13] && p.mat[i * 16 + 14] === mat[j * 16 + 14])) i++;
    assert.ok(i < t.count, `${t.mesh.name}: kept blade ${j} is a pristine blade after blade ${last}`);
    for (let q = 0; q < 16; q++) assert.equal(mat[j * 16 + q], p.mat[i * 16 + q]);
    for (let q = 0; q < 4; q++) assert.equal(dat[j * 4 + q], p.data[i * 4 + q]);
    last = i;
  }
  // every dropped blade's own root sphere (blade reach + pad) misses the frustum
  const kept = new Set();
  for (let j = 0; j < t.mesh.count; j++) kept.add(`${mat[j * 16 + 12]},${mat[j * 16 + 14]}`);
  const sphere = new THREE.Sphere();
  let dropped = 0;
  for (let i = 0; i < t.count; i++) {
    if (kept.has(`${p.mat[i * 16 + 12]},${p.mat[i * 16 + 14]}`)) continue;
    dropped++;
    sphere.center.set(p.mat[i * 16 + 12], p.mat[i * 16 + 13] + 0.5, p.mat[i * 16 + 14]);
    sphere.radius = 1.0;
    assert.ok(!frustum.intersectsSphere(sphere), `${t.mesh.name}: dropped blade ${i} at ${sphere.center.toArray().map((v) => v.toFixed(2))} is outside the frustum`);
  }
  assert.ok(dropped > 0);
}
// the same pose: nothing rewritten
const rewrites = grass.culled.rewrites;
grass.cull(cam, false);
assert.equal(grass.culled.rewrites, rewrites, 'an unchanged view-projection rewrites nothing');
// looking straight down from above with a wide lens: every near tile is swallowed whole and restored
const top = new THREE.PerspectiveCamera(150, 1, 0.1, 500);
top.position.set(0.4, 30, 8.6);
top.lookAt(0.4, 0, 8.6);
top.updateMatrixWorld();
grass.update(top.position);
grass.cull(top, true);
for (const t of grass.tiles) {
  if (!t.mesh.visible || t.mesh.count === t.count) continue;
  // a tile still trimmed under the top view must be one the 150° cone actually cuts
  assert.ok(new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(top.projectionMatrix, top.matrixWorldInverse)).intersectsSphere(t.mesh.boundingSphere), `${t.mesh.name} is cut by the frustum`);
}
const restored = grass.tiles.filter((t) => t.mesh.visible && t.mesh.count === t.count && pristine.get(t).mat.every((v, i) => v === t.mesh.instanceMatrix.array[i]));
assert.ok(restored.length >= visible.length - 2, `the tiles under the camera are back to their pristine streams (${restored.length} of ${visible.length})`);
console.log(`grass.test: ${grass.tiles.length} tiles / ${grass.count} blades; at A ${visible.length} in range, trimmed ${atA.trimmedTiles} tiles / ${atA.trimmed} blades; restored under the top view — ok`);
