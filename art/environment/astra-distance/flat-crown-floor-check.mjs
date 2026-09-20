/**
 * CPU shader contract: node art/environment/astra-distance/flat-crown-floor-check.mjs [baseline-ref]
 * Builds the actual material hooks against Three's standard/depth shader templates. Texture
 * painters/loaders return empty textures: no DOM, GPU, browser or asset download is needed.
 * Default baseline 360c896b includes the accepted bark mean and Fable white-leaf range.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const baseline = process.argv[2] ?? '360c896b';
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
    const probe = material ? '\nmodule.exports.blocks = { ordinary: LEAF_FLOOR_SHADED, flat: typeof NEAR_CANOPY_FLAT_FLOOR_SHADED === "undefined" ? null : NEAR_CANOPY_FLAT_FLOOR_SHADED };' : '';
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
assert.equal(materials.blocks.ordinary, oldMaterials.blocks.ordinary, 'ordinary floor source changed');
assert.ok(materials.blocks.flat.startsWith('if (vLeafFlat > 0.5) {'), 'correction is not gated to flat leaves');
assert.ok(materials.blocks.flat.endsWith(`else { ${materials.blocks.ordinary} }`), 'ordinary near-leaf branch changed');
let unchangedShaders = 0;
for (const [name, material] of Object.entries(after)) {
  if (!material?.isMaterial) continue;
  const a = shaderFor(before[name]), b = shaderFor(material);
  assert.equal(b.vertexShader, a.vertexShader, `${name}: vertex shader changed`);
  assert.deepEqual(snapshot(b.uniforms), snapshot(a.uniforms), `${name}: uniforms changed`);
  assert.deepEqual(b.defines, a.defines, `${name}: defines changed`);
  if (name === 'giantTreeNearCanopy') {
    assert.equal(b.fragmentShader.split(materials.blocks.flat).length, 2, 'flat branch missing or duplicated');
    assert.equal(b.fragmentShader.replace(materials.blocks.flat, materials.blocks.ordinary), a.fragmentShader, 'near shader changed outside leaf floor');
    assert.notEqual(material.customProgramCacheKey(), before[name].customProgramCacheKey(), 'near shader cache key was not changed');
  } else {
    assert.equal(b.fragmentShader, a.fragmentShader, `${name}: unrelated fragment shader changed`);
    assert.equal(material.customProgramCacheKey(), before[name].customProgramCacheKey(), `${name}: cache key changed`);
    unchangedShaders++;
  }
}
assert.equal(unchangedShaders, 10);
assert.deepEqual(materials.WHITE_BARK_LEAF_NEAR_M, [5, 16], 'Fable white-leaf range lost');

// Read the floor endpoints from the emitted flat branch, then evaluate the shared floor's
// actual math over zero/dark/bright albedos, all authored shade shares and the 5–10 m fade.
const block = materials.blocks.flat.split('} else {')[0];
const lift = block.match(/floorLight = mix\(([\d.]+), ([\d.]+), floorFar\)/).slice(1).map(Number);
const textureShare = block.match(/floorAlbedo = mix\(vec3\(([\d.]+)\), diffuseColor.rgb, mix\(([\d.]+), ([\d.]+), floorFar\)\)/).slice(1).map(Number);
assert.deepEqual(lift, [materials.TREE_LEAF_FLOOR_NEAR.lift, materials.TREE_LEAF_FLOOR.lift]);
assert.deepEqual(textureShare, [materials.TREE_LEAF_FLOOR.albedo, materials.TREE_LEAF_FLOOR_NEAR.texture, materials.TREE_LEAF_FLOOR.texture]);
assert.ok(block.includes(`, ${materials.TREE_LEAF_FLOOR.canopy.toFixed(6)});`));
assert.ok(block.includes(`, ${materials.TREE_LEAF_FLOOR.chroma.toFixed(6)});`));
assert.ok(!block.includes('uLeafFloor'), 'flat branch still reads ordinary near floor values');
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (distance) => { const t = Math.max(0, Math.min(1, (distance - 5) / 5)); return t * t * (3 - 2 * t); };
const lum = (a) => a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
const ambient = new THREE.Color(WORLD.sky.hemiSky).add(new THREE.Color(WORLD.sky.hemiGround)).multiplyScalar(WORLD.sky.hemiIntensity * 0.5).toArray();
const sun = new THREE.Color(WORLD.palette.leafSun).toArray();
const filter = sun.map((c) => mix(1, c / Math.max(lum(sun), 1e-3), materials.TREE_LEAF_FLOOR.canopy));
function response(diffuse, shade, floor) {
  const base = diffuse.map((c, i) => ambient[i] * c / Math.PI);
  const light = diffuse.map((c, i) => floor.lift * ambient[i] * filter[i] * mix(floor.albedo, c, floor.texture) / Math.PI);
  const amount = Math.max(0, 1 - lum(base) / (lum(light) + 1e-4));
  return base.map((c, i) => 1.5 * (c + amount * light[i] * shade));
}
let numericCases = 0, largestRestoredLuma = 0;
for (const distance of [0, 2.5, 5, 6, 7.5, 9.999, 10, 13, 26, 30]) for (const albedo of [0, 0.005, 0.025, 0.08, 0.15, 0.5, 1]) for (const shade of [0, 0.4, 0.5, 1]) {
  const t = smooth(distance), diffuse = [albedo * 0.8, albedo, albedo * 0.6];
  const intended = { ...materials.TREE_LEAF_FLOOR, lift: mix(materials.TREE_LEAF_FLOOR_NEAR.lift, materials.TREE_LEAF_FLOOR.lift, t), texture: mix(materials.TREE_LEAF_FLOOR_NEAR.texture, materials.TREE_LEAF_FLOOR.texture, t) };
  const emitted = { albedo: textureShare[0], lift: mix(lift[0], lift[1], t), texture: mix(textureShare[1], textureShare[2], t) };
  const a = response(diffuse, shade, intended), b = response(diffuse, shade, emitted);
  assert.ok(b.every(Number.isFinite));
  a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-12, 'flat floor differs from authored original response'));
  largestRestoredLuma = Math.max(largestRestoredLuma, lum(b) - lum(response(diffuse, shade, materials.NEAR_CANOPY_LEAF_FLOOR)));
  numericCases++;
}
assert.ok(largestRestoredLuma > 0.03, 'check did not exercise the lost neutral fill');
console.log(JSON.stringify({ baseline, unchangedShaders, nearShaderChange: 'flat-leaf floor block and cache key only; vertex shader, uniforms, defines and ordinary floor unchanged', numericCases, largestRestoredLinearLuma: largestRestoredLuma, note: 'CPU contract/numeric checks do not replace native shader compilation and C/F captures.' }, null, 2));
