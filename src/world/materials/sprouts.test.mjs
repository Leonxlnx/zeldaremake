/**
 * Sprout submission culling (round 49, perf-3): `buildSproutMeshes().cull` trims every pack mesh to
 * the instances inside SPROUT_LOD_FAR and the padded view frustum, keeps their stream order and
 * attributes exactly, restores the full streams when the camera comes back, and only rewrites when
 * the kept set changes. CPU only (no renderer).
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
const { WORLD } = read('config');
const { createRng } = read('util/prng');
const { createWind } = read('wind/wind');
const { buildSproutMeshes, createSproutMaterial, SPROUT_LOD_FAR, SPROUT_CULL_PAD_M } = read('materials/sprouts');

// a line of tufts / cushions / grit down the −z axis from 1 m to 60 m, plus a few off to the sides
const spots = [];
for (let i = 0; i < 60; i++) {
  const z = -(1 + i);
  spots.push({ x: 0, y: 0, z, size: (i % 10) / 10, source: 'line' });
  if (i % 3 === 0) spots.push({ x: 0.5, y: 0, z, size: 0.5, kind: 'cushion', source: 'line' });
  if (i % 4 === 0) spots.push({ x: -0.5, y: 0, z, size: 0.02, kind: 'grit', source: 'line' });
}
for (const x of [-40, 40]) spots.push({ x, y: 0, z: -10, size: 0.8, source: 'side' });
const rng = createRng(`${WORLD.seed}/sprout-cull-test`);
const build = buildSproutMeshes(spots, rng, createSproutMaterial(createWind(), WORLD), WORLD);
const group = new THREE.Group();
for (const m of build.meshes) group.add(m);
group.updateMatrixWorld(true);
const total = build.meshes.reduce((n, m) => n + m.count, 0);
assert.equal(total, spots.length, 'every spot is an instance before the cull');
assert.deepEqual(build.submitted, build.meshes.map((m) => m.count), 'submitted starts at the full counts');

// pristine copies to compare the compacted streams against
const pristine = build.meshes.map((m) => ({
  mat: Float32Array.from(m.instanceMatrix.array),
  col: Float32Array.from(m.instanceColor.array),
  slot: Float32Array.from(m.geometry.getAttribute('aSproutVariant').array),
  tint: Float32Array.from(m.geometry.getAttribute('aJointTint').array),
}));
const basesOf = (arr, n) => Array.from({ length: n }, (_, i) => [arr[i * 16 + 12], arr[i * 16 + 13], arr[i * 16 + 14]]);

// camera at the origin looking down −z, 46° fov
const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 500);
cam.position.set(0, 1.6, 0);
cam.lookAt(0, 1.6, -10);
cam.updateMatrixWorld();
build.cull(cam, true);
let kept = 0;
build.meshes.forEach((m, k) => {
  kept += m.count;
  assert.equal(build.submitted[k], m.count, 'submitted mirrors the mesh count');
  // every kept instance is a pristine instance (same matrix, colour, slot, tint), in the original order
  const bases = basesOf(m.instanceMatrix.array, m.count);
  const pb = basesOf(pristine[k].mat, pristine[k].mat.length / 16);
  let last = -1;
  for (let j = 0; j < m.count; j++) {
    const i = pb.findIndex((b, idx) => idx > last && b[0] === bases[j][0] && b[1] === bases[j][1] && b[2] === bases[j][2]);
    assert.ok(i > last, `kept instance ${j} of ${m.name} is a pristine instance in order`);
    last = i;
    for (let q = 0; q < 16; q++) assert.equal(m.instanceMatrix.array[j * 16 + q], pristine[k].mat[i * 16 + q]);
    for (let q = 0; q < 3; q++) assert.equal(m.instanceColor.array[j * 3 + q], pristine[k].col[i * 3 + q]);
    assert.equal(m.geometry.getAttribute('aSproutVariant').array[j], pristine[k].slot[i]);
    assert.equal(m.geometry.getAttribute('aJointTint').array[j], pristine[k].tint[i]);
    // and it is inside the collapse distance
    assert.ok(Math.hypot(bases[j][0] - cam.position.x, bases[j][1] - cam.position.y, bases[j][2] - cam.position.z) < SPROUT_LOD_FAR + 0.06, 'kept instances are within the shader collapse distance');
  }
  // nothing inside the LOD distance and the frustum was dropped
  for (let i = 0; i < pb.length; i++) {
    const d = Math.hypot(pb[i][0] - cam.position.x, pb[i][1] - cam.position.y, pb[i][2] - cam.position.z);
    const onAxis = Math.abs(pb[i][0]) <= 0.5;
    if (d < SPROUT_LOD_FAR - 1 && onAxis) assert.ok(bases.some((b) => b[0] === pb[i][0] && b[2] === pb[i][2]), `near on-axis instance at z ${pb[i][2]} is kept`);
  }
});
assert.ok(kept < total, `the cull trims (${kept} of ${total})`);
assert.ok(kept > 0, 'the near line stays');
// the side instances (40 m off axis at 10 m ahead) are outside the frustum: dropped
for (const m of build.meshes) for (const b of basesOf(m.instanceMatrix.array, m.count)) assert.ok(Math.abs(b[0]) < 40 - SPROUT_CULL_PAD_M, 'off-frustum instances are dropped');
assert.equal(build.submittedNow(), build.meshes.reduce((n, m) => n + m.count * (m.geometry.attributes.position.count / 3), 0), 'submittedNow counts the kept instances');

// the same pose again: no rewrite (streams untouched, counts equal)
const snapshot = build.meshes.map((m) => Float32Array.from(m.instanceMatrix.array));
build.cull(cam, false);
build.meshes.forEach((m, k) => assert.deepEqual(Array.from(m.instanceMatrix.array), Array.from(snapshot[k]), 'unchanged view-projection leaves the streams alone'));

// turn the camera round: the far end of the line is behind it now, everything drops
cam.lookAt(0, 1.6, 10);
cam.updateMatrixWorld();
build.cull(cam);
// (the instances a metre behind the eye stay: their padded spheres still touch the near plane)
for (const m of build.meshes) for (const b of basesOf(m.instanceMatrix.array, m.count)) assert.ok(b[2] > -SPROUT_CULL_PAD_M - 1, `nothing further behind the eye than the pad survives (z ${b[2]})`);
assert.ok(build.meshes.reduce((n, m) => n + m.count, 0) <= 4, 'the −z line is gone from a +z frame');

// a wide short view from above sees the whole near line and the sides: restored to the pristine streams
const top = new THREE.PerspectiveCamera(120, 1, 0.1, 500);
top.position.set(0, 8, -8);
top.lookAt(0, 0, -8);
top.updateMatrixWorld();
build.cull(top, true);
build.meshes.forEach((m, k) => {
  const bases = basesOf(m.instanceMatrix.array, m.count);
  const pb = basesOf(pristine[k].mat, pristine[k].mat.length / 16);
  // every pristine instance under the camera (well inside the 120° cone and the collapse distance) is back
  const under = (b) => Math.abs(b[0]) < 6 && Math.abs(b[2] + 8) < 6;
  const expected = pb.filter(under);
  const inside = bases.filter(under);
  assert.equal(inside.length, expected.length, `${m.name}: the instances under the camera are restored (${inside.length} / ${expected.length})`);
});
console.log(`sprouts.test: ${total} instances, ${kept} kept from the axis view, ${build.submitted.join('/')} after the top view — ok`);
