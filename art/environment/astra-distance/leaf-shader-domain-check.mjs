/**
 * CPU only: node art/environment/astra-distance/leaf-shader-domain-check.mjs [baseline-ref]
 * Expands actual hooks against Three's shader templates, proves derivatives execute at main's
 * top level before discard/branches, and checks both emitted midrib expressions over their UV
 * domain. Textures are empty CPU stubs; native compilation/rendering is a separate check.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const baseline = process.argv[2] ?? 'fedffe49';
const file = 'src/world/trees/materials.ts';
const original = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const texture = (name) => { const t = new THREE.Texture(); t.name = name; return t; };
function loader(materialSource) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const material = file.endsWith('/materials.ts') || file.endsWith('\\materials.ts');
    const source = ts.transpileModule(material ? materialSource : readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    // Expose existing private blocks only in this test's in-memory module.
    const probe = material ? '\nmodule.exports.blocks = { frame: LEAF_FRAME_GLSL, color: LEAF_COLOR, derivatives: typeof LEAF_FRAME_DERIVATIVES === "undefined" ? null : LEAF_FRAME_DERIVATIVES };' : '';
    new Function('require', 'module', 'exports', source + probe)((name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name === './bark-texture') return { createWhiteBarkTextures: () => ({ color: texture('white-color'), normal: texture('white-normal'), roughness: texture('white-roughness') }) };
      if (name === './leaf-cluster-texture') return { createLeafClusterTexture: () => texture('cluster'), createLeafClusterDetail: () => ({ color: texture('cluster-detail'), normal: texture('cluster-normal') }) };
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target + '.ts', path.join(target, 'index.ts')]) if (existsSync(candidate)) return load(candidate);
      }
      throw new Error(`Unexpected dependency ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const old = loader(original), current = loader(readFileSync(file, 'utf8'));
const materials = current(file), oldMaterials = old(file);
const { WORLD } = current('src/world/config.ts');
const { createRng } = current('src/world/util/prng.ts');
const { createWind } = current('src/world/wind/wind.ts');
const ctx = () => ({ config: WORLD, quality: { tier: 'high' }, rng: createRng(WORLD.seed), wind: createWind(), textures: { load: async (set, map) => texture(`${set}/${map}`) } });
const before = await oldMaterials.createTreeMaterials(ctx()), after = await materials.createTreeMaterials(ctx());
const snapshot = (value) => {
  if (value?.isTexture) return { texture: value.name };
  if (value?.toArray) return value.toArray();
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, snapshot(v)]));
  return value;
};
const shaderFor = (material) => {
  const template = THREE.ShaderLib[material.isMeshDepthMaterial ? 'depth' : 'standard'];
  const shader = { vertexShader: template.vertexShader, fragmentShader: template.fragmentShader, uniforms: THREE.UniformsUtils.clone(template.uniforms), defines: {} };
  material.onBeforeCompile(shader, {});
  return shader;
};

const derivativeBlock = materials.blocks.derivatives;
assert.ok(derivativeBlock, 'missing unconditional derivative block');
assert.ok(!/dFd[xy]\(/.test(materials.blocks.frame), 'derivatives remain inside callable frame helper');
assert.ok(!/pow\(/.test(materials.blocks.color.split('float vein')[0]), 'signed far midrib pow remains');
assert.ok(!/leafMidrib = [^;]*pow\(/.test(materials.blocks.color), 'signed near midrib pow remains');
const changed = [], unchanged = [];
for (const [name, material] of Object.entries(after)) {
  if (!material?.isMaterial) continue;
  const a = shaderFor(before[name]), b = shaderFor(material);
  assert.equal(b.vertexShader, a.vertexShader, name + ': vertex shader changed');
  assert.deepEqual(snapshot(b.uniforms), snapshot(a.uniforms), name + ': uniforms changed');
  assert.deepEqual(b.defines, a.defines, name + ': defines changed');
  let normalized = b.fragmentShader;
  if (normalized.includes(materials.blocks.frame)) {
    const uv = name === 'giantCanopy' ? 'vMapUv' : 'vTreeUv';
    const block = derivativeBlock.replaceAll('vTreeUv', uv);
    assert.equal(normalized.split(block).length, 2, name + ': missing/duplicate derivative block');
    assert.ok(normalized.includes('void main() {' + block), name + ': derivatives are not before main control flow/discard');
    const body = normalized.slice(normalized.indexOf('void main() {') + 'void main() {'.length);
    let depth = 1;
    for (const line of body.split('\n')) {
      if (/dFd[xy]\(/.test(line)) assert.equal(depth, 1, name + ': derivative in varying control flow');
      for (const char of line) { if (char === '{') depth++; else if (char === '}') depth--; }
    }
    normalized = normalized.replace(block, '').replace(materials.blocks.frame, oldMaterials.blocks.frame);
    normalized = normalized.replace('leafTangentFrame(leafQ0, leafQ1, normal, leafSt0, leafSt1)', 'leafTangentFrame(-vViewPosition, normal, ' + uv + ')');
    if (name !== 'giantCanopy') {
      assert.ok(normalized.includes(materials.blocks.color), name + ': midrib block absent');
      normalized = normalized.replace(materials.blocks.color, oldMaterials.blocks.color);
    }
    assert.notEqual(material.customProgramCacheKey(), before[name].customProgramCacheKey(), name + ': stale program key');
    changed.push(name);
  } else unchanged.push(name);
  assert.equal(normalized, a.fragmentShader, name + ': unrelated fragment behavior changed');
}
assert.deepEqual(changed, ['whiteTree', 'giantTree', 'giantTreeNear', 'columnTree', 'giantTreeNearBase', 'giantTreeNearCanopy', 'giantCanopy']);
assert.equal(unchanged.length, 4);
assert.deepEqual(materials.WHITE_BARK_LEAF_NEAR_M, [5, 16]);

// Evaluate the expressions extracted from the shader, including both negative and positive
// signed offsets. Finite multiplication gives the intended square without pow's x >= 0 domain.
function midrib(name, variable) {
  const declaration = materials.blocks.color.match(new RegExp('float ' + variable + ' = ([^;]+);'))[1];
  const expression = materials.blocks.color.match(new RegExp('(?:float )?' + name + ' = ([^;]+);'))[1];
  return new Function('vTreeUv', 'ux', 'exp', 'smoothstep', 'const ' + variable + ' = ' + declaration + '; return ' + expression + ';');
}
const far = midrib('midrib', 'midribX'), near = midrib('leafMidrib', 'nearMidribX');
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
let cases = 0;
for (let i = 0; i <= 4096; i++) for (const y of [0, .43, .85, .9, 1]) {
  const x = i/4096, uv = { x, y }, ux = x-.5;
  for (const [fn, scale, taper] of [[far, 70, 1], [near, 44, 1-smoothstep(.85, 1, y)]]) {
    const value = fn(uv, ux, Math.exp, smoothstep);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, 'invalid midrib result');
    assert.equal(value, Math.exp(-((ux*scale)**2))*taper, 'intended midrib changed');
    assert.equal(value, fn({x:1-x,y}, -ux, Math.exp, smoothstep), 'asymmetric midrib');
    cases++;
  }
}
console.log(JSON.stringify({baseline,changedShaders:changed,unchangedShaders:unchanged,numericCases:cases,contract:'Derivative samples are first in main; detail/frame work remains conditional. Vertex shaders, uniforms, defines, floors and unrelated fragment code unchanged.',nativeRenderRequired:true},null,2));
