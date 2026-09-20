/** CPU material integration check. Run from repo root; optional baseline Git ref as argv[2]. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const baseline = process.argv[2] ?? 'd9eee5d7';
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
    if (material.color && shader.uniforms.diffuse) shader.uniforms.diffuse.value.copy(material.color);
    for (const text of [shader.vertexShader, shader.fragmentShader]) for (const [, chunk] of text.matchAll(/#include <([\w_]+)>/g)) assert.ok(THREE.ShaderChunk[chunk] !== undefined, `${name}: known chunk ${chunk}`);
    shaders[name] = shader;
    material.dispose();
  }
  return shaders;
}
const [before, after] = await Promise.all([prepare(oldSource), prepare(readFileSync(materialPath, 'utf8'))]);
// Resolve only NEAR_BASE_DETAIL=false, retaining every other preprocessor directive verbatim.
// This checks that the shared giant source adds no effective code to other material families.
function withoutNearBase(source) {
  const stack = [], lines = [];
  const visible = () => stack.every(frame => !frame.hidden);
  for (const line of source.split('\n')) {
    const text = line.trim();
    if (/^#if(?:def|ndef)?\b/.test(text)) {
      const target = text === '#ifdef NEAR_BASE_DETAIL';
      stack.push({ target, hidden: target });
      if (!target && visible()) lines.push(line);
    } else if (text === '#else') {
      const frame = stack.at(-1);
      if (frame?.target) frame.hidden = !frame.hidden;
      else if (visible()) lines.push(line);
    } else if (text === '#endif') {
      const frame = stack.pop();
      if (!frame?.target && visible()) lines.push(line);
    } else if (visible()) lines.push(line);
  }
  assert.equal(stack.length, 0, 'balanced conditional shader blocks');
  return lines.filter(line => line.trim()).join('\n');
}
const changed = [];
for (const name of Object.keys(before)) {
  const a = before[name], b = after[name];
  assert.equal(b.vertexShader, a.vertexShader, `${name}: vertex deformation unchanged`);
  assert.deepEqual(Object.keys(b.uniforms).sort(), Object.keys(a.uniforms).sort(), `${name}: no new uniforms`);
  if (name !== 'giantTreeNearBase') {
    assert.equal(withoutNearBase(b.fragmentShader), withoutNearBase(a.fragmentShader), `${name}: no effective fragment change`);
    continue;
  }
  changed.push(name);
  for (const call of ['texture2D', 'treeNoise', 'mossField']) {
    const count = (s) => [...s.matchAll(new RegExp(`\\b${call}\\s*\\(`, 'g'))].length;
    assert.equal(count(b.fragmentShader), count(a.fragmentShader), `${name}: ${call} call count unchanged`);
  }
  // Material response uses the same coverage for colour, normal mixing and roughness.
  assert.match(b.fragmentShader, /barkMossCover = mix\(barkMossCover, min\(barkMossCover, patchCover\), gapNear\)/);
  assert.match(b.fragmentShader, /mossCushion, barkMossCover \* 0\.92/);
  assert.match(b.fragmentShader, /roughnessFactor = mix\(roughnessFactor, 1\.0, barkMossCover\)/);
  assert.match(b.fragmentShader, /mix\(normal, mossN, barkMossCover \* 0\.85\)/);
  assert.match(b.fragmentShader, /max\(vIsLeaf, barkMossCover \* 0\.8\)/);
}
assert.deepEqual(changed, ['giantTreeNearBase']);
// All leaf-only, white-bark, distant and depth fragment programs remain byte-identical.
for (const name of ['whiteTree', 'whiteTreeDepth', 'giantTreeDepth', 'giantCanopy', 'giantCanopyDepth', 'distant']) assert.equal(after[name].fragmentShader, before[name].fragmentShader, name);
const near = after.giantTreeNearBase.fragmentShader;
assert.match(near, /if \(barkNearDetail > 0\.0\) \{\s*float priorMossCover/);
assert.match(near, /float openedCover = priorMossCover - barkMossCover;\s*if \(openedCover > 0\.0\)/);
// Execute the scalar coverage expressions from the actual injected shader, not a second
// implementation. At 6 m the outer guard also skips all new albedo operations outright.
const coverageCode = near.match(/float priorMossCover = barkMossCover;([\s\S]*?)#ifdef USE_COLOR/)?.[0].split('#ifdef')[0];
assert.ok(coverageCode);
const evaluate = new Function('smoothstep', 'mix', 'min', 'barkMossCover', 'barkNearDetail', 'vBarkMoss', 'mossFine', coverageCode.replace(/\bfloat\b/g, 'let') + '\nreturn barkMossCover;');
const smoothstep = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const normalization = near.match(/dryBark \/= ([^;]+);/)?.[1];
assert.ok(normalization);
const normalizer = new Function('mix', 'dot', 'clamp', 'diffuse', 'lumW', 'vertexValue', `return ${normalization};`);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const materialColour = after.giantTreeNearBase.uniforms.diffuse.value.toArray();
const lumW = [0.2126, 0.7152, 0.0722];
let previousValue = -1;
for (let step = 0; step <= 400; step++) {
  const vertexValue = step / 200;
  const divisor = normalizer(mix, dot, clamp, materialColour, lumW, vertexValue);
  assert.ok(divisor > 0 && divisor <= 1, 'finite bounded albedo recovery');
  assert.ok(vertexValue / divisor > previousValue, 'vertex grain/crevice ordering is retained');
  if (vertexValue >= 1) assert.equal(divisor, 1, 'already lifted bark is not amplified');
  previousValue = vertexValue / divisor;
}
const [inM, outM] = after.giantTreeNearBase.uniforms.uBarkDetail.value.toArray();
let cases = 0;
for (const distance of [0, inM, 2, 3, 5, outM - 1e-4, outM, 8, 10, 13.5]) {
  for (const mask of [0, 0.1, 0.35, 0.5, 0.75, 0.9, 0.95, 0.96, 0.98, 0.99, 1]) {
    for (const field of [0, 0.1, 0.3, 0.5, 0.7, 1]) {
      const original = smoothstep(0.34, 0.82, mask * (0.5 + 0.95 * field));
      const result = evaluate(smoothstep, mix, Math.min, original, 1 - smoothstep(inM, outM, distance), mask, field);
      assert.ok(result >= 0 && result <= original, 'coverage only opens existing moss');
      if (distance >= outM || mask === 1) assert.equal(result, original, 'far bark / full-mask cushion unchanged');
      cases++;
    }
  }
}
console.log(JSON.stringify({ baseline, changed, unchangedVertexPrograms: Object.keys(after).length, unchangedOtherEffectiveFragmentPrograms: 10, coverageCases: cases, exactBaselineFromM: outM, extraUniforms: 0, extraTextureSamples: 0, extraNoiseCalls: 0, note: 'CPU hook/conditional/chunk checks only; native GLSL compilation and pixel review remain pending.' }, null, 2));
