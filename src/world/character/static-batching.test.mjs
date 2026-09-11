/** Run: node src/world/character/static-batching.test.mjs (actual CPU models/poses). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

function loader(disableHook = false) {
  const cache = new Map();
  return function load(path) {
    const file = resolve(path);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    let source = readFileSync(file, 'utf8');
    if (disableHook && file.endsWith('/link.ts')) {
      assert.equal(source.split('  batchStaticLinkParts(rig);').length, 2, 'one construction hook');
      source = source.replace('  batchStaticLinkParts(rig);', '');
    }
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', js)(name => {
      if (name === 'three') return THREE;
      if (name.endsWith('/utils/BufferGeometryUtils.js')) return geometryUtils;
      if (name.startsWith('.')) return load(resolve(dirname(file), name + '.ts'));
      throw new Error(`Unexpected import: ${name}`);
    }, module, module.exports);
    return module.exports;
  };
}
const context = new Proxy({}, {
  get: (_, key) => String(key).endsWith('Gradient') ? () => ({ addColorStop() {} }) : () => {},
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const load = loader(true), production = loader();
const { createLink } = load('src/world/character/link.ts');
const { createKokiri } = load('src/world/character/kokiri.ts');
const { batchStaticLinkParts } = load('src/world/character/static-batching.ts');
const { createPlayPose } = load('src/world/character/play-pose.ts');
const { createLocomotion } = load('src/world/character/locomotion.ts');
const meshes = root => { const result = []; root.traverse(o => { if (o.isMesh) result.push(o); }); return result; };
const triangleCount = root => meshes(root).reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);
const model = createLink(), reference = createLink(), npc = createKokiri(0);
const npcBefore = meshes(npc.group).map(mesh => ({ mesh, geometry: mesh.geometry, material: mesh.material,
  attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, attribute]) => [name, attribute.array.slice()])),
  index: mesh.geometry.index.array.slice() }));
const sources = meshes(model.group).map(mesh => ({ mesh, parent: mesh.parent, geometry: mesh.geometry,
  material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, matrix: mesh.matrix.clone() }));
const disposed = new Set();
for (const source of sources) source.geometry.addEventListener('dispose', () => disposed.add(source.geometry));
const oldCount = sources.length, oldTriangles = triangleCount(model.group);
batchStaticLinkParts(model.rig);
const after = meshes(model.group), batches = after.filter(mesh => mesh.userData.staticBatch);
assert.equal(oldCount - after.length, 10, 'ten actual mesh submissions removed');
assert.equal(batches.length, 7); assert.equal(triangleCount(model.group), oldTriangles);
assert.equal(disposed.size, 17, 'only the seventeen replaced static geometries are disposed');
const records = [];
for (const mesh of batches) {
  assert.equal(mesh.geometry.groups.length, 0, 'one draw per merged material');
  assert.equal(mesh.geometry.drawRange.count, Infinity);
  const used = new Set();
  for (const part of mesh.userData.staticBatch) {
    const source = sources.find(candidate => !used.has(candidate) && candidate.parent === mesh.parent
      && candidate.mesh.name === part.name && candidate.material === mesh.material);
    assert.ok(source, `original source ${part.name} remains identifiable`); used.add(source);
    assert.equal(part.count, source.geometry.index.count);
    assert.equal(mesh.castShadow, source.cast); assert.equal(mesh.receiveShadow, source.receive);
    assert.ok(mesh.matrix.equals(source.matrix));
    for (const name of Object.keys(source.geometry.attributes)) {
      const old = source.geometry.attributes[name], current = mesh.geometry.attributes[name];
      assert.equal(old.itemSize, current.itemSize); assert.equal(old.normalized, current.normalized);
      for (let i = 0; i < part.count; i++) for (let c = 0; c < old.itemSize; c++) {
        assert.equal(current.array[mesh.geometry.index.getX(part.start + i) * old.itemSize + c],
          old.array[source.geometry.index.getX(i) * old.itemSize + c], `${part.name} expanded ${name}`);
      }
    }
    records.push({ mesh, source, start: part.start });
  }
}
for (const source of sources.filter(source => !disposed.has(source.geometry))) {
  assert.equal(source.mesh.geometry, source.geometry, 'unbatched geometry reference stays live');
  assert.equal(source.mesh.parent, source.parent); assert.equal(source.mesh.material, source.material);
}
batchStaticLinkParts(model.rig);
assert.equal(meshes(model.group).length, oldCount - 10, 'batch setup is idempotent');

const ground = { height: () => 0, blocked: () => false, onStairs: () => false };
const control = createLocomotion(ground, 0, 0, 0);
const poses = [model, reference].map(character => createPlayPose(character.rig, ground.height));
const a = new THREE.Vector3(), b = new THREE.Vector3(), oldMatrix = new THREE.Matrix4();
const oldNormal = new THREE.Matrix3(), newNormal = new THREE.Matrix3();
let samples = 0;
for (let frame = 0; frame < 480; frame++) {
  const t = frame / 120;
  const state = control.update(1 / 120, { moveX: t >= 2 && t < 3 ? .7 : 0,
    moveZ: t < 3 ? 1 : 0, run: t >= .8 && t < 2.5, jump: frame === 144 });
  for (let i = 0; i < 2; i++) {
    poses[i].update(state, 12.5 + state.time, 1 / 120);
    [model, reference][i].syncGeometry(); [model, reference][i].group.updateMatrixWorld(true);
  }
  if (frame % 10 !== 0) continue;
  for (const { mesh, source, start } of records) {
    oldMatrix.multiplyMatrices(source.parent.matrixWorld, source.matrix);
    oldNormal.getNormalMatrix(oldMatrix); newNormal.getNormalMatrix(mesh.matrixWorld);
    const old = source.geometry, current = mesh.geometry;
    for (let i = 0; i < old.index.count; i++) {
      a.fromBufferAttribute(old.attributes.position, old.index.getX(i)).applyMatrix4(oldMatrix);
      b.fromBufferAttribute(current.attributes.position, current.index.getX(start + i)).applyMatrix4(mesh.matrixWorld);
      assert.ok(a.equals(b), `${source.mesh.name} posed world position`);
      a.fromBufferAttribute(old.attributes.normal, old.index.getX(i)).applyNormalMatrix(oldNormal);
      b.fromBufferAttribute(current.attributes.normal, current.index.getX(start + i)).applyNormalMatrix(newNormal);
      assert.ok(a.equals(b), `${source.mesh.name} posed world normal`); samples++;
    }
  }
  for (const side of ['ankleL', 'ankleR']) for (const name of ['boot', 'boot-cuff', 'boot-sole', 'boot-tongue', 'boot-laces', 'boot-buckle']) {
    const current = model.rig[side].getObjectByName(name), original = reference.rig[side].getObjectByName(name);
    assert.equal(current.material, original.material); assert.equal(current.castShadow, original.castShadow);
    assert.equal(current.receiveShadow, original.receiveShadow);
    assert.deepEqual(current.matrixWorld.elements, original.matrixWorld.elements);
    for (const key of Object.keys(original.geometry.attributes)) {
      assert.deepEqual(current.geometry.attributes[key].array, original.geometry.attributes[key].array, `${name} posed ${key}`);
    }
    assert.deepEqual(current.geometry.index.array, original.geometry.index.array);
  }
}
for (const source of npcBefore) {
  assert.equal(source.mesh.geometry, source.geometry); assert.equal(source.mesh.material, source.material);
  assert.equal(source.mesh.userData.staticBatch, undefined);
  for (const [name, array] of Object.entries(source.attributes)) assert.deepEqual(source.geometry.attributes[name].array, array);
  assert.deepEqual(source.geometry.index.array, source.index);
}
const integrated = production('src/world/character/link.ts').createLink();
assert.equal(meshes(integrated.group).length, oldCount - 10, 'production hook batches Link');
assert.equal(integrated.triangles, oldTriangles, 'reported triangles describe full geometry');
const productionNpc = production('src/world/character/kokiri.ts').createKokiri(0);
const productionNpcMeshes = meshes(productionNpc.group);
assert.equal(productionNpcMeshes.length, npcBefore.length, 'production NPC mesh count unchanged');
for (const [i, mesh] of productionNpcMeshes.entries()) {
  const original = npcBefore[i];
  assert.equal(mesh.name, original.mesh.name); assert.equal(mesh.userData.staticBatch, undefined);
  assert.equal(mesh.castShadow, original.mesh.castShadow); assert.equal(mesh.receiveShadow, original.mesh.receiveShadow);
  assert.ok(mesh.material.color.equals(original.material.color));
  for (const [name, array] of Object.entries(original.attributes)) assert.deepEqual(mesh.geometry.attributes[name].array, array);
  assert.deepEqual(mesh.geometry.index.array, original.index);
}
console.log(`static-batching.test.mjs: ${oldCount}→${after.length} meshes, ${oldTriangles} triangles unchanged; ${samples} posed vertices/normals exact, UV/material/shadow/disposal and boot/NPC invariants passed`);
