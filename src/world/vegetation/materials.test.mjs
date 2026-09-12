/** Run: node src/world/vegetation/materials.test.mjs. CPU shader contracts, not GPU compilation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

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
    if (name.startsWith('.')) return loadTs(path.resolve(path.dirname(file), `${name}.ts`));
    throw new Error(`Unexpected shader test dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { createVegMaterial, createVegShadowMaterials } = loadTs(path.join(here, 'materials.ts'));
const { createWind } = loadTs(path.join(here, '../wind/wind.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const wind = createWind();
const ctx = { config: WORLD, wind };
const owned = [];
function prepare(material, kind) {
  const base = THREE.ShaderLib[kind];
  assert.ok(base, `Installed Three.js includes ${kind} shader`);
  const shader = { uniforms: THREE.UniformsUtils.clone(base.uniforms), vertexShader: base.vertexShader, fragmentShader: base.fragmentShader };
  material.onBeforeCompile(shader, {});
  // Catch nonexistent includes after injection while retaining Three's own conditional chunks.
  for (const source of [shader.vertexShader, shader.fragmentShader]) {
    for (const [, chunk] of source.matchAll(/#include <([\w_]+)>/g)) assert.ok(THREE.ShaderChunk[chunk] !== undefined, `Known chunk ${chunk}`);
  }
  return shader;
}
function projection(shader) {
  const match = shader.vertexShader.match(/vec4 mvPosition = vec4\(transformed, 1\.0\);[\s\S]*?gl_Position = projectionMatrix \* mvPosition;/);
  assert.ok(match, 'Shader contains the full deformed projection block');
  return match[0];
}

for (const kind of ['plant', 'bush']) {
  const source = createVegMaterial(ctx, kind, { plantHeight: 2.7, sway: 1.9, flutter: 0.03, stiffness: 0.42, singleSided: kind === 'plant' });
  const { depth, distance } = createVegShadowMaterials(source);
  owned.push(source, depth, distance);
  assert.ok(depth.isMeshDepthMaterial && distance.isMeshDistanceMaterial);
  assert.equal(depth.depthPacking, THREE.RGBADepthPacking);
  assert.equal(depth.side, source.side);
  assert.equal(distance.side, source.side);
  const standardShader = prepare(source, 'standard');
  const depthShader = prepare(depth, 'depth');
  const distanceShader = prepare(distance, 'distance');
  const block = projection(standardShader);
  for (const shader of [depthShader, distanceShader]) {
    assert.equal(projection(shader), block, 'Shadow and color use identical vertex deformation');
    for (const key of ['uPlantHeight', 'uSwayAmount', 'uFlutterAmount', 'uStiffness', ...Object.keys(wind.uniforms)]) {
      assert.equal(shader.uniforms[key], standardShader.uniforms[key], `${key} is shared by reference`);
    }
    assert.match(shader.vertexShader, /#ifdef USE_INSTANCING\s+mvPosition = instanceMatrix \* mvPosition;/);
    assert.match(shader.vertexShader, /vec3 rootWorld = \(modelMatrix \* instanceMatrix/);
    assert.match(shader.vertexShader, /#else\s+vec3 rootWorld = \(modelMatrix \*/);
    assert.match(shader.vertexShader, /#include <begin_vertex>/);
    assert.match(shader.vertexShader, /#include <clipping_planes_vertex>/);
    // variant packs (lodset.ts): both slot attributes declared once, unselected slots collapse
    // onto the root before projection and skip the wind, in the shadow passes exactly as in colour
    assert.equal((shader.vertexShader.match(/attribute float aVariant;/g) || []).length, 1, 'per-vertex slot declared once');
    assert.equal((shader.vertexShader.match(/attribute float aPlantVariant;/g) || []).length, 1, 'per-instance slot declared once');
    assert.match(shader.vertexShader, /#include <begin_vertex>\s*bool vegKeep = abs\(aVariant - aPlantVariant\) < 0\.5;\s*if \(!vegKeep\) transformed = vec3\(0\.0\);/);
    assert.equal((shader.vertexShader.match(/uniform float uTime;/g) || []).length, 1);
    assert.doesNotMatch(shader.vertexShader, /#include <project_vertex>/);
  }
  assert.match(block, /if \(vegKeep\) vegWorld\.xyz \+= sway \* hf \+ flutter;/, 'kept vertices take the unchanged wind sum');
  // the west-verge zone lift lives in the colour pass only, after the shared projection block
  for (const key of ['uLiftBox', 'uLiftFeather', 'uLiftFill']) assert.ok(standardShader.uniforms[key], `${key} uniform`);
  assert.match(standardShader.vertexShader, /gl_Position = projectionMatrix \* mvPosition;\s*\{\s*#ifdef USE_INSTANCING\s+vec2 liftRoot/);
  assert.match(standardShader.fragmentShader, /uLiftFill \* vZoneLift/);
  assert.doesNotMatch(depthShader.vertexShader, /vZoneLift/);
  assert.doesNotMatch(distanceShader.vertexShader, /vZoneLift/);
  assert.match(depthShader.vertexShader, /vHighPrecisionZW = gl_Position.zw;/);
  assert.match(depthShader.vertexShader, /#include <logdepthbuf_vertex>/);
  assert.match(distanceShader.vertexShader, /vec4 worldPosition = vegWorld;[\s\S]*vWorldPosition = worldPosition.xyz;/);
  assert.equal(depthShader.fragmentShader, THREE.ShaderLib.depth.fragmentShader, 'Depth encoding remains Three.js owned');
  assert.equal(distanceShader.fragmentShader, THREE.ShaderLib.distance.fragmentShader, 'Distance encoding remains Three.js owned');
  wind.strength = 0.67;
  wind.update(0, 12.5);
  for (const shader of [standardShader, depthShader, distanceShader]) {
    assert.equal(shader.uniforms.uTime.value, 12.5);
    assert.equal(shader.uniforms.uWindStrength.value, 0.67);
  }
  standardShader.uniforms.uSwayAmount.value = 2.4;
  assert.equal(depthShader.uniforms.uSwayAmount.value, 2.4);
  assert.equal(distanceShader.uniforms.uSwayAmount.value, 2.4);
  assert.equal(new Set([source, depth, distance].map(m => m.customProgramCacheKey())).size, 3, 'Each shader pass has its own cache key');
}

for (const kind of ['grass', 'moss', 'litter']) {
  const source = createVegMaterial(ctx, kind);
  owned.push(source);
  const shader = prepare(source, 'standard');
  assert.equal((shader.vertexShader.match(/vZoneLift = 1\.0 - smoothstep/g) || []).length, 1, `${kind} evaluates the zone lift once`);
  assert.match(shader.fragmentShader, /uLiftFill \* vZoneLift/);
  assert.throws(() => createVegShadowMaterials(source), /plant or bush/);
  if (kind === 'grass') {
    assert.doesNotMatch(shader.vertexShader, /aPlantVariant/, 'grass tiles are not packed');
  } else {
    // static moss / litter packs collapse the same way and keep Three's own projection
    assert.equal((shader.vertexShader.match(/attribute float aPlantVariant;/g) || []).length, 1, `${kind} declares the per-instance slot once`);
    assert.match(shader.vertexShader, /#include <begin_vertex>\s*bool vegKeep = abs\(aVariant - aPlantVariant\) < 0\.5;\s*if \(!vegKeep\) transformed = vec3\(0\.0\);/);
    assert.match(shader.vertexShader, /#include <project_vertex>/);
  }
}
{
  const optOut = createVegMaterial(ctx, 'plant', { shadeLift: 0 });
  owned.push(optOut);
  assert.equal(prepare(optOut, 'standard').uniforms.uLiftFill.value, 0, 'shadeLift: 0 opts a set out of the zone lift');
}
{
  // waxy broad leaves: the upper (front) face takes its own roughness, the underside keeps the base
  const glossy = createVegMaterial(ctx, 'plant', { roughness: 0.9, topRoughness: 0.55 });
  const matte = createVegMaterial(ctx, 'plant', { roughness: 0.9 });
  owned.push(glossy, matte);
  const gs = prepare(glossy, 'standard');
  const ms = prepare(matte, 'standard');
  assert.equal(gs.uniforms.uTopRoughness.value, 0.55);
  assert.equal(glossy.roughness, 0.9, 'base roughness stays the matte underside');
  assert.match(gs.fragmentShader, /#include <roughnessmap_fragment>\s*roughnessFactor = gl_FrontFacing \? uTopRoughness : roughnessFactor;/);
  assert.equal((gs.fragmentShader.match(/uniform float uTopRoughness;/g) || []).length, 1);
  assert.doesNotMatch(ms.fragmentShader, /uTopRoughness/);
  assert.equal(ms.uniforms.uTopRoughness, undefined);
  assert.notEqual(glossy.customProgramCacheKey(), matte.customProgramCacheKey(), 'glossy and matte plants compile separate programs');
  const { depth, distance } = createVegShadowMaterials(glossy);
  owned.push(depth, distance);
  assert.equal(projection(prepare(depth, 'depth')), projection(gs), 'the glossy option leaves the shared projection block alone');
}
const unrelated = new THREE.MeshStandardMaterial();
{
  const plain = createVegMaterial(ctx, 'bush');
  const leaf = createVegMaterial(ctx, 'bush', { leafSkyTransmission: 0.65 });
  owned.push(plain, leaf);
  const ps = prepare(plain, 'standard'), ls = prepare(leaf, 'standard');
  assert.equal(ls.uniforms.uLeafSkyTransmission.value, 0.65);
  assert.notEqual(plain.customProgramCacheKey(), leaf.customProgramCacheKey(), 'Tagged and untagged vegetation cannot share a program');
  assert.equal(projection(ls), projection(ps), 'Thin-leaf response does not alter wind or position');
  assert.equal((ls.vertexShader.match(/attribute float aLeafSurface;/g) || []).length, 1);
  assert.match(ls.vertexShader, /vLeafSurface = aLeafSurface;/);
  assert.match(ls.fragmentShader, /if \(vLeafSurface > 0\.5\)/, 'Solid stems do not transmit sky');
  assert.doesNotMatch(ps.vertexShader + ps.fragmentShader, /aLeafSurface|vLeafSurface|uLeafSkyTransmission/);
  for (const amount of [0, -1, NaN, Infinity]) {
    const disabled = createVegMaterial(ctx, 'bush', { leafSkyTransmission: amount });
    owned.push(disabled);
    const ds = prepare(disabled, 'standard');
    assert.equal(ds.vertexShader, ps.vertexShader);
    assert.equal(ds.fragmentShader, ps.fragmentShader);
    assert.equal(disabled.customProgramCacheKey(), plain.customProgramCacheKey());
  }
  const plainShadow = createVegShadowMaterials(plain), leafShadow = createVegShadowMaterials(leaf);
  for (const [pass, shaderName] of [['depth', 'depth'], ['distance', 'distance']]) {
    owned.push(plainShadow[pass], leafShadow[pass]);
    const before = prepare(plainShadow[pass], shaderName), after = prepare(leafShadow[pass], shaderName);
    assert.equal(after.vertexShader, before.vertexShader, 'Lamina tag is absent from shadow geometry');
    assert.equal(after.fragmentShader, before.fragmentShader, 'Sun/point shadow encoding stays exact');
    assert.equal(leafShadow[pass].customProgramCacheKey(), plainShadow[pass].customProgramCacheKey());
    assert.equal(after.uniforms.uTime, ls.uniforms.uTime, 'Color/shadow wind remains live and shared');
  }
}
owned.push(unrelated);
assert.throws(() => createVegShadowMaterials(unrelated), /plant or bush/);
for (const material of owned) material.dispose();
console.log('Vegetation shader contracts passed: identical color/depth/distance wind, live uniform references, instancing guards, and Three.js encoding chunks. No GPU compile or visual verdict claimed.');
