/** CPU regression for actual structures consolidation. Optional argv[2] supplies candidate geometry.ts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const root = process.cwd();
const geometrySource = path.resolve(process.argv[2] ?? 'src/world/structures/geometry.ts');
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const sourceFile = file === path.join(root, 'src/world/structures/geometry.ts') ? geometrySource : file;
  const code = ts.transpileModule(readFileSync(sourceFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name === 'three') return THREE;
    if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return geometryUtils;
    if (name.startsWith('.')) return loadTs(path.resolve(path.dirname(file), `${name}.ts`));
    throw new Error(`Unexpected consolidation test dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const { consolidateStaticMeshes } = loadTs(path.join(root, 'src/world/structures/geometry.ts'));
assert.equal(typeof consolidateStaticMeshes, 'function', 'Test the actual consolidation export');
const { windLeafMaterial, createStructureShadowMaterials } = loadTs(path.join(root, 'src/world/structures/materials.ts'));
const { FoliageBuilder } = loadTs(path.join(root, 'src/world/structures/foliage.ts'));
const { createWind } = loadTs(path.join(root, 'src/world/wind/wind.ts'));
const { createRng } = loadTs(path.join(root, 'src/world/util/prng.ts'));
const wind = createWind();
const ctx = { wind };
const leaf = windLeafMaterial(new THREE.MeshStandardMaterial({ alphaTest: 0.45, side: THREE.DoubleSide }), ctx, 'structures-leaf');
const vine = windLeafMaterial(new THREE.MeshStandardMaterial(), ctx, 'structures-vine');
const shadowA = createStructureShadowMaterials(leaf, ctx, 'structures-leaf');
const shadowB = createStructureShadowMaterials(leaf, ctx, 'structures-leaf-other');
const shadowVine = createStructureShadowMaterials(vine, ctx, 'structures-vine');
const materialList = [leaf, vine, shadowA.depth, shadowA.distance, shadowB.depth, shadowB.distance, shadowVine.depth, shadowVine.distance];
const rootGroup = new THREE.Group();
const geometryDisposals = new Map();
const materialDisposals = new Map();
const watchGeometry = (geo) => {
  geometryDisposals.set(geo, 0);
  geo.addEventListener('dispose', () => geometryDisposals.set(geo, geometryDisposals.get(geo) + 1));
};
for (const mat of materialList) {
  materialDisposals.set(mat, 0);
  mat.addEventListener('dispose', () => materialDisposals.set(mat, materialDisposals.get(mat) + 1));
}
const pairs = [
  [shadowA.depth, shadowA.distance],
  [shadowB.depth, shadowA.distance], // Only depth identity differs.
  [shadowA.depth, shadowB.distance], // Only distance identity differs.
  [undefined, undefined],
];
const beforeMeshes = [];
for (const [pairIndex, [depth, distance]] of pairs.entries()) {
  for (let copy = 0; copy < 2; copy++) {
    const seed = `consolidation-${pairIndex}-${copy}`;
    const builder = new FoliageBuilder(createRng(seed), seed);
    builder.addHangingVine(new THREE.Vector3(pairIndex * 2 + copy * 0.3, 3, copy * 0.2), 0.6);
    const parent = new THREE.Group();
    for (const mesh of builder.build({ leaf, vine, leafDepth: depth, leafDistance: distance, vineDepth: shadowVine.depth, vineDistance: shadowVine.distance }, seed)) {
      assert(mesh.geometry.index, 'Fixture uses the actual indexed foliage geometry');
      watchGeometry(mesh.geometry);
      beforeMeshes.push(mesh);
      parent.add(mesh);
    }
    rootGroup.add(parent);
  }
}

// Retained singleton proves the consolidation does not dispose unconsumed geometry/materials.
const singletonMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
const singleton = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), singletonMaterial);
singleton.name = 'unmerged-singleton';
watchGeometry(singleton.geometry);
rootGroup.add(singleton);

const renderKey = (mesh) => JSON.stringify([
  mesh.material.uuid, mesh.customDepthMaterial?.uuid ?? null, mesh.customDistanceMaterial?.uuid ?? null,
  mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask, mesh.visible, mesh.frustumCulled,
  Object.keys(mesh.geometry.attributes).sort().map((name) => {
    const attr = mesh.geometry.attributes[name];
    return [name, attr.itemSize, attr.array.constructor.name, attr.normalized];
  }),
]);
function expandedSnapshot() {
  const result = new Map();
  rootGroup.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const key = renderKey(mesh);
    let bucket = result.get(key);
    if (!bucket) {
      bucket = Object.fromEntries(Object.keys(mesh.geometry.attributes).sort().map((name) => [name, []]));
      result.set(key, bucket);
    }
    const index = mesh.geometry.index;
    for (let i = 0; i < index.count; i++) {
      const vertex = index.getX(i);
      for (const name of Object.keys(bucket)) {
        const attr = mesh.geometry.attributes[name];
        for (let c = 0; c < attr.itemSize; c++) bucket[name].push(attr.array[vertex * attr.itemSize + c]);
      }
    }
  });
  return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
}
const beforeExpanded = expandedSnapshot();
const result = consolidateStaticMeshes(rootGroup);
assert.deepEqual(result, { before: 17, after: 6, merged: 5 }, 'Four distinct leaf shadow pairs plus shared vine bucket and retained singleton');
const merged = [];
rootGroup.traverse((mesh) => { if (mesh.isMesh) merged.push(mesh); });
assert.equal(merged.length, 6);
for (const [depth, distance] of pairs) {
  const matching = merged.filter((mesh) => mesh.material === leaf && mesh.customDepthMaterial === depth && mesh.customDistanceMaterial === distance);
  assert.equal(matching.length, 1, 'Same visible material merges only with identical depth AND distance bindings');
}
const mergedVine = merged.find((mesh) => mesh.material === vine);
assert.equal(mergedVine.customDepthMaterial, shadowVine.depth);
assert.equal(mergedVine.customDistanceMaterial, shadowVine.distance);
assert.deepEqual(expandedSnapshot(), beforeExpanded, 'Expanded indexed attributes and material/shadow/render semantics stay exact');
for (const mesh of beforeMeshes) {
  assert.equal(mesh.parent, null, 'Original merged mesh is removed');
  assert.equal(geometryDisposals.get(mesh.geometry), 1, 'Consumed source geometry is disposed exactly once');
}
assert.equal(singleton.parent, rootGroup);
assert.equal(geometryDisposals.get(singleton.geometry), 0, 'Unmerged singleton geometry survives');
for (const mat of materialList) assert.equal(materialDisposals.get(mat), 0, 'Shared material lifetime stays with its system');

// Exercise shader hooks through the retained merged bindings, including live wind reference updates.
for (const mesh of merged.filter((mesh) => mesh.customDepthMaterial)) {
  const shaders = [mesh.material, mesh.customDepthMaterial, mesh.customDistanceMaterial].map((mat, i) => {
    const base = THREE.ShaderLib[['standard', 'depth', 'distance'][i]];
    const shader = { uniforms: THREE.UniformsUtils.clone(base.uniforms), vertexShader: base.vertexShader, fragmentShader: base.fragmentShader };
    mat.onBeforeCompile(shader, {});
    return shader;
  });
  const deformation = (shader) => shader.vertexShader.match(/\{\s*vec3 wp = [\s\S]*?\}/)?.[0];
  assert.ok(deformation(shaders[0]));
  for (const shader of shaders.slice(1)) assert.equal(deformation(shader), deformation(shaders[0]), 'Merged shadow uses the visible wind deformation');
  for (const time of [0, 0.5, 11.2]) {
    wind.update(0, time);
    for (const shader of shaders) assert.equal(shader.uniforms.uTime.value, time);
  }
}

for (const mesh of merged) {
  if (mesh !== singleton) watchGeometry(mesh.geometry);
  mesh.geometry.dispose();
  assert.equal(geometryDisposals.get(mesh.geometry), 1, 'Remaining geometry has one owner at final system disposal');
}
for (const mat of materialList) {
  mat.dispose();
  assert.equal(materialDisposals.get(mat), 1);
}
singletonMaterial.dispose();
console.log('Structures consolidation passed: distinct shadow pairs, expanded geometry, retained live wind, bindings and disposal. CPU only.');
