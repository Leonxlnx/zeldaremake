/** CPU material integration check. Run from repo root; optional baseline Git ref as argv[2]. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const baseline = process.argv[2] ?? 'a9eccd15';
const materialPath = path.resolve('src/world/trees/materials.ts');
const oldSource = execFileSync('git', ['show', `${baseline}:src/world/trees/materials.ts`], { encoding: 'utf8' });
function graph(source) {
  const modules = new Map();
  const texture = () => new THREE.Texture();
  function load(file) {
    file = path.resolve(file);
    if (file.endsWith('bark-texture.ts')) return { createWhiteBarkTextures: () => ({ color: texture(), normal: texture(), roughness: texture() }) };
    if (file.endsWith('leaf-cluster-texture.ts')) return { createLeafClusterTexture: texture, createLeafClusterDetail: () => ({ color: texture(), normal: texture() }), createFarCrownAtlas: texture };
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const code = ts.transpileModule(file === materialPath ? source : readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, `${target}.ts`, path.join(target, 'index.ts')]) if (candidate.endsWith('.ts') && existsSync(candidate)) return load(candidate);
      }
      throw new Error(`Unexpected dependency: ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
async function prepare(source) {
  const load = graph(source);
  const { createTreeMaterials } = load(materialPath);
  const { createWind } = load('src/world/wind/wind.ts');
  const { createRng } = load('src/world/util/prng.ts');
  const { WORLD } = load('src/world/config.ts');
  const materials = await createTreeMaterials({ wind: createWind(), config: WORLD, rng: createRng(WORLD.seed), quality: { tier: 'high' }, textures: { load: async () => new THREE.Texture() } });
  const shaders = {};
  for (const [name, material] of Object.entries(materials)) {
    if (!material.isMaterial) continue;
    const base = THREE.ShaderLib[material.isMeshDepthMaterial ? 'depth' : 'standard'];
    const shader = { uniforms: THREE.UniformsUtils.clone(base.uniforms), vertexShader: base.vertexShader, fragmentShader: base.fragmentShader };
    material.onBeforeCompile(shader, {});
    for (const text of [shader.vertexShader, shader.fragmentShader]) for (const [, chunk] of text.matchAll(/#include <([\w_]+)>/g)) assert.ok(THREE.ShaderChunk[chunk] !== undefined, `${name}: known chunk ${chunk}`);
    shaders[name] = shader;
    material.dispose();
  }
  return shaders;
}
const [before, after] = await Promise.all([prepare(oldSource), prepare(readFileSync(materialPath, 'utf8'))]);
const changed = [];
for (const name of Object.keys(before)) {
  const a = before[name], b = after[name];
  assert.equal(b.vertexShader, a.vertexShader, `${name}: vertex deformation unchanged`);
  assert.deepEqual(Object.keys(b.uniforms).sort(), Object.keys(a.uniforms).sort(), `${name}: no new uniforms`);
  if (a.fragmentShader === b.fragmentShader) continue;
  changed.push(name);
  for (const call of ['texture2D', 'treeNoise', 'mossField']) {
    const count = (s) => [...s.matchAll(new RegExp(`\\b${call}\\s*\\(`, 'g'))].length;
    assert.equal(count(b.fragmentShader), count(a.fragmentShader), `${name}: ${call} call count unchanged`);
  }
  // Material response uses the same coverage for colour, normal mixing and roughness.
  assert.match(b.fragmentShader, /barkMossCover = mix\(mossPatch,/);
  assert.match(b.fragmentShader, /mossCushion, barkMossCover \* 0\.92/);
  assert.match(b.fragmentShader, /roughnessFactor = mix\(roughnessFactor, 1\.0, barkMossCover\)/);
  assert.match(b.fragmentShader, /mix\(normal, mossN, barkMossCover \* 0\.85\)/);
  assert.match(b.fragmentShader, /max\(vIsLeaf, barkMossCover \* 0\.8\)/);
}
assert.deepEqual(changed.sort(), ['columnTree', 'giantTree', 'giantTreeNear', 'giantTreeNearBase', 'giantTreeNearCanopy'].sort());
// All leaf-only, white-bark, distant and depth fragment programs remain byte-identical.
for (const name of ['whiteTree', 'whiteTreeDepth', 'giantTreeDepth', 'giantCanopy', 'giantCanopyDepth', 'distant']) assert.equal(after[name].fragmentShader, before[name].fragmentShader, name);
console.log(JSON.stringify({ baseline, changed, unchangedVertexPrograms: Object.keys(after).length, unchangedOtherFragmentPrograms: 6, extraUniforms: 0, extraTextureSamples: 0, extraNoiseCalls: 0, note: 'CPU hook/chunk contracts only; native GLSL compilation and pixel review remain pending.' }, null, 2));
