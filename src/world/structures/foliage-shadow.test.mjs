/** Run: node src/world/structures/foliage-shadow.test.mjs. CPU contracts, not GPU compilation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name === 'three') return THREE;
    if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return geometryUtils;
    if (name.startsWith('.')) return loadTs(path.resolve(path.dirname(file), `${name}.ts`));
    throw new Error(`Unexpected foliage test dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { windLeafMaterial, createStructureShadowMaterials } = loadTs(path.join(here, 'materials.ts'));
const { FoliageBuilder } = loadTs(path.join(here, 'foliage.ts'));
const { createWind, WIND_GLSL } = loadTs(path.join(here, '../wind/wind.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const wind = createWind();
const ctx = { wind };
const mats = { tuft: new THREE.MeshStandardMaterial() };
const texture = new THREE.Texture();
const alphaMap = new THREE.Texture();
for (const kind of ['leaf', 'vine']) {
  const source = windLeafMaterial(new THREE.MeshStandardMaterial(kind === 'leaf'
    ? { map: texture, alphaMap, alphaTest: 0.45, side: THREE.DoubleSide } : {}), ctx, `structures-${kind}`);
  const { depth, distance } = createStructureShadowMaterials(source, ctx, `structures-${kind}`);
  Object.assign(mats, { [kind]: source, [`${kind}Depth`]: depth, [`${kind}Distance`]: distance });
  assert.equal(depth.depthPacking, THREE.RGBADepthPacking);
  const shaders = [source, depth, distance].map((mat, i) => {
    const base = THREE.ShaderLib[['standard', 'depth', 'distance'][i]];
    const shader = { uniforms: THREE.UniformsUtils.clone(base.uniforms), vertexShader: base.vertexShader, fragmentShader: base.fragmentShader };
    mat.onBeforeCompile(shader, {});
    assert.equal(shader.fragmentShader, base.fragmentShader, 'Three.js owns depth encoding and alpha testing');
    assert.ok(shader.vertexShader.includes(WIND_GLSL));
    assert.equal((shader.vertexShader.match(/uniform float uTime;/g) || []).length, 1);
    return shader;
  });
  const deformation = (shader) => shader.vertexShader.match(/\{\s*vec3 wp = [\s\S]*?\}/)?.[0];
  assert.ok(deformation(shaders[0]), 'Visible foliage has world-position-based wind');
  for (const [i, mat] of [depth, distance].entries()) {
    assert.equal(deformation(shaders[i + 1]), deformation(shaders[0]), 'Shadow vertices follow the visible geometry');
    for (const key of ['map', 'alphaMap', 'alphaTest', 'side']) assert.equal(mat[key], source[key], `${key} cutout is shared`);
    for (const key of Object.keys(wind.uniforms)) assert.equal(shaders[i + 1].uniforms[key], shaders[0].uniforms[key]);
  }
  assert.equal(new Set([source, depth, distance].map((m) => m.customProgramCacheKey())).size, 3);
  for (const t of [0, 0.5, 11.2]) {
    wind.update(0, t);
    for (const shader of shaders) assert.equal(shader.uniforms.uTime.value, t, 'All passes receive live simulation time');
  }
}
const builder = new FoliageBuilder(createRng('shadow-parity'), 'shadow-parity');
builder.addHangingVine(new THREE.Vector3(1, 3, 2), 0.5);
builder.addTuft(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.5, 0);
const meshes = builder.build(mats, 'test');
for (const [kind, suffix] of [['leaf', 'leaves'], ['vine', 'vines']]) {
  const mesh = meshes.find((m) => m.name === `test-${suffix}`);
  assert.ok(mesh?.castShadow && mesh.receiveShadow);
  assert.equal(mesh.customDepthMaterial, mats[`${kind}Depth`]);
  assert.equal(mesh.customDistanceMaterial, mats[`${kind}Distance`]);
  for (const key of ['aPhase', 'aAmount']) assert.equal(mesh.geometry.attributes[key].count, mesh.geometry.attributes.position.count);
}
assert.equal(meshes.find((m) => m.name === 'test-tufts').castShadow, false, 'Tufts keep their existing shadow budget');
for (const mesh of meshes) mesh.geometry.dispose();
for (const mat of Object.values(mats)) mat.dispose();
texture.dispose();
alphaMap.dispose();
console.log('Structure foliage shadow contracts passed: live wind parity, alpha cutouts, shader cache keys and mesh bindings. GPU capture still required.');
