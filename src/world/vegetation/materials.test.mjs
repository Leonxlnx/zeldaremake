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
    // the blade normal (round 39): the facing flips on a blade seen from behind, its 55 % terrain
    // up never does — three's whole-normal flip pointed half the blades into the ground
    assert.doesNotMatch(shader.fragmentShader, /#include <normal_fragment_begin>/);
    assert.match(shader.fragmentShader, /normalize\(vBladeFace\) \* faceDirection, normalize\(vBladeUp\), 0\.55/, 'facing-only flip');
    assert.match(shader.vertexShader, /vBladeFace = normalMatrix \* n;\s*vBladeUp = normalMatrix \* bladeUp;/);
    assert.doesNotMatch(shader.vertexShader, /FLIP_SIDED/, 'no whole-normal flip in the vertex stage either');
    // the near-eye share (round 39): a blade rooted inside 1.2 m of the viewing eye shrinks to a quarter,
    // whole again by 3.0 m — the fixed cameras' frames cut the ground off past 3.2 m (3D), so only the
    // walking eye sees it; the shrink scales the whole shaped blade about its root, after the bend
    assert.match(shader.vertexShader, /vec3 bladeRoot = \(modelMatrix \* instanceMatrix \* vec4\(0\.0, 0\.0, 0\.0, 1\.0\)\)\.xyz;\s*transformed \*= mix\(0\.25, 1\.0, smoothstep\(1\.2, 3\.0, distance\(cameraPosition, bladeRoot\)\)\);\s*}/, 'near-eye shrink closes the shape stage');
    for (const [, chunk] of shader.fragmentShader.matchAll(/#include <([\w_]+)>/g)) assert.ok(THREE.ShaderChunk[chunk] !== undefined, `known chunk ${chunk}`);
    // round 40 (the owner's video review): the broad sedge is halved on the near-tile geometries (grass.ts aNear)
    // and keeps its width on the far tile; the tuft's tip tone rides in the type slot below the dryness step
    assert.equal((shader.vertexShader.match(/attribute float aNear;/g) || []).length, 1, 'near flag declared once');
    assert.match(shader.vertexShader, /if \(vegType > 1\.5\) w \*= 1\.0 - 0\.5 \* aNear;/, 'sedge halved on the near tiles only');
    assert.match(shader.vertexShader, /float vegTip = clamp\(\(fract\(vegSlot\) - 0\.02\) \/ 0\.96, 0\.0, 1\.0\);/, 'tip tone decoded from the type slot');
    assert.match(shader.vertexShader, /bladeColor \*= mix\(vec3\(1\.0\), tipTone, smoothstep\(0\.3, 1\.0, bladeT\)\);/, 'tip tone applied toward the tip');
    assert.doesNotMatch(shader.vertexShader, /vLeafUv/, 'the lamina detail is the plants\', not the blades\'');
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
{
  // round 40 — near-camera lamina detail (materials.ts LEAF_DETAIL_*): plants and bushes take a midrib, lateral veins,
  // a cupped margin, a root → tip gradient and extra translucency inside LEAF_DETAIL_NEAR..FAR m of the eye, in the
  // colour pass only (the shadow passes keep the shared projection block); `leafDetail: false` opts a set out
  const { LEAF_DETAIL_NEAR, LEAF_DETAIL_FAR } = loadTs(path.join(here, 'materials.ts'));
  assert.ok(LEAF_DETAIL_NEAR >= 3 && LEAF_DETAIL_NEAR <= 4.5 && LEAF_DETAIL_FAR > LEAF_DETAIL_NEAR && LEAF_DETAIL_FAR <= 8, 'the detail lives within ~4 m and fades out by 8');
  for (const kind of ['plant', 'bush']) {
    const detailed = createVegMaterial(ctx, kind);
    const plain = createVegMaterial(ctx, kind, { leafDetail: false });
    owned.push(detailed, plain);
    const ds = prepare(detailed, 'standard');
    const ps = prepare(plain, 'standard');
    assert.equal(ds.uniforms.uLeafDetail.value, 1, `${kind} carries the detail uniform`);
    assert.equal(ps.uniforms.uLeafDetail, undefined, `${kind} opted out has none`);
    assert.equal((ds.vertexShader.match(/varying vec2 vLeafUv;/g) || []).length, 1);
    assert.match(ds.vertexShader, /gl_Position = projectionMatrix \* mvPosition;[\s\S]*vLeafUv = uv;/, 'the lamina uv is passed after the shared projection');
    assert.match(ds.fragmentShader, new RegExp(`#include <color_fragment>\\s*float vegLeafTrans = 0\\.0;\\s*\\{\\s*float leafFade = \\(1\\.0 - smoothstep\\(${LEAF_DETAIL_NEAR.toFixed(1)}, ${LEAF_DETAIL_FAR.toFixed(1)}, length\\(vViewPosition\\)\\)\\) \\* uLeafDetail;`), 'the detail fades with view distance after the base colour');
    assert.match(ds.fragmentShader, /if \(leafFade > 0\.0 && vLeafUv\.x < 1\.5\) \{/, 'only laminae (u < 1.5; geometry.ts NOT_LAMINA puts stems at u ≥ 2) take it');
    for (const term of ['float rib = ', 'float vein = ', 'float margin = ', 'vec3 grad = mix(', 'diffuseColor.rgb *= mix(vec3(1.0), detail, leafFade);', 'vegLeafTrans = leafFade * (0.35 + 0.65 * v);']) assert.ok(ds.fragmentShader.includes(term), `${kind} detail term: ${term}`);
    assert.match(ds.fragmentShader, /uTransmission \* \(1\.0 \+ vegLeafTrans\)/, 'the translucency term takes the detail\'s extra');
    assert.doesNotMatch(ps.fragmentShader, /vegLeafTrans|vLeafUv|uLeafDetail/);
    assert.doesNotMatch(ps.vertexShader, /vLeafUv/);
    assert.notEqual(detailed.customProgramCacheKey(), plain.customProgramCacheKey(), 'detailed and plain compile separate programs');
    const { depth, distance } = createVegShadowMaterials(detailed);
    owned.push(depth, distance);
    for (const shadow of [prepare(depth, 'depth'), prepare(distance, 'distance')]) {
      assert.equal(projection(shadow), projection(ds), 'the detail leaves the shared projection block alone');
      assert.doesNotMatch(shadow.vertexShader, /vLeafUv/);
    }
  }
  for (const kind of ['grass', 'moss', 'litter']) {
    const m = createVegMaterial(ctx, kind);
    owned.push(m);
    const s = prepare(m, 'standard');
    assert.equal(s.uniforms.uLeafDetail, undefined, `${kind} takes no lamina detail`);
    assert.doesNotMatch(s.fragmentShader, /vegLeafTrans/);
  }
}
const unrelated = new THREE.MeshStandardMaterial();
owned.push(unrelated);
assert.throws(() => createVegShadowMaterials(unrelated), /plant or bush/);
for (const material of owned) material.dispose();
console.log('Vegetation shader contracts passed: identical color/depth/distance wind, live uniform references, instancing guards, and Three.js encoding chunks. No GPU compile or visual verdict claimed.');
