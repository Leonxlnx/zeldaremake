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
    // round 47: the seed stalk is type 3 (grass.ts SEED_TYPE), so the sedge test bounds the type from both sides
    assert.match(shader.vertexShader, /if \(vegType > 1\.5 && vegType < 2\.5\) w \*= 1\.0 - 0\.5 \* aNear;/, 'sedge halved on the near tiles only');
    assert.match(shader.vertexShader, /float wSeed = /, 'round 47: the seed stalk\'s width profile');
    assert.match(shader.vertexShader, /if \(vegType > 2\.5\) bladeColor = mix\(bladeColor, uDryTip/, 'round 47: the straw seed head');
    assert.match(shader.vertexShader, /float vegTip = clamp\(\(fract\(vegSlot\) - 0\.02\) \/ 0\.96, 0\.0, 1\.0\);/, 'tip tone decoded from the type slot');
    assert.match(shader.vertexShader, /bladeColor \*= mix\(vec3\(1\.0\), tipTone, smoothstep\(0\.3, 1\.0, bladeT\)\);/, 'tip tone applied toward the tip');
    assert.doesNotMatch(shader.vertexShader, /vLeafUv/, 'the lamina detail is the plants\', not the blades\'');
    // round 40 (Astra's "tall dark spikes"): the meadow and sedge types' root tone is lifted toward the tip tone so
    // they start no darker than the clump cards' root mass; the turf blades keep the deep root
    assert.match(shader.vertexShader, /if \(vegType > 0\.5\) rootTone = mix\(rootTone, vec3\(1\.0, 1\.0, 0\.92\), 0\.22\);\s*vec3 bladeColor = mix\(tint \* rootTone/, 'tall types\' root lift ahead of the gradient');
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
  // round 43 — the lit edge on the leaf block, the petal band (leafDetail 'petal': fan veins and a stronger
  // translucency on u ≥ PETAL_U only, no leaf block) and the litter block (kind litter, leafDetail true: dark
  // veins, brown → ochre); each mode its own program
  const { LEAF_EDGE_LIGHT, PETAL_TRANSLUCENCY, LITTER_ROOT_TINT, LITTER_TIP_TINT } = loadTs(path.join(here, 'materials.ts'));
  const { PETAL_U } = loadTs(path.join(here, 'geometry.ts'));
  assert.ok(LEAF_EDGE_LIGHT > 0 && LEAF_EDGE_LIGHT <= 0.25 && PETAL_TRANSLUCENCY[0] >= 0.35 && PETAL_TRANSLUCENCY[0] + PETAL_TRANSLUCENCY[1] <= 2 && PETAL_U >= 3);
  assert.ok(LITTER_ROOT_TINT.every((c, i) => c < LITTER_TIP_TINT[i]), 'the litter gradient lightens toward the tip');
  {
    const leaf = createVegMaterial(ctx, 'plant');
    const petal = createVegMaterial(ctx, 'plant', { leafDetail: 'petal' });
    owned.push(leaf, petal);
    const ls = prepare(leaf, 'standard');
    const ps = prepare(petal, 'standard');
    assert.match(ls.fragmentShader, /float edge = smoothstep\(0\.455, 0\.5, au\);/, 'the leaf block has the lit edge');
    assert.ok(ls.fragmentShader.includes(`+ ${LEAF_EDGE_LIGHT.toFixed(2)} * edge)`), 'the edge gain is the declared constant');
    assert.equal(ps.uniforms.uLeafDetail.value, 1, 'the petal band carries the detail uniform');
    assert.match(ps.vertexShader, /gl_Position = projectionMatrix \* mvPosition;[\s\S]*vLeafUv = uv;/, 'the petal uv is passed after the shared projection');
    assert.ok(ps.fragmentShader.includes(`if (leafFade > 0.0 && vLeafUv.x >= ${PETAL_U.toFixed(1)} && vLeafUv.x < ${(PETAL_U + 1).toFixed(1)}) {`), 'only the petal band (geometry.ts PETAL_U) takes it');
    assert.doesNotMatch(ps.fragmentShader, /vLeafUv\.x < 1\.5|float rib = /, 'no leaf block on a petal material');
    for (const term of ['float ray = su / max(v, 0.08);', 'float fan = ', 'float vein = ', 'diffuseColor.rgb *= mix(vec3(1.0), detail, leafFade);', `vegLeafTrans = leafFade * (${PETAL_TRANSLUCENCY[0].toFixed(2)} + ${PETAL_TRANSLUCENCY[1].toFixed(2)} * v);`]) assert.ok(ps.fragmentShader.includes(term), `petal term: ${term}`);
    assert.match(ps.fragmentShader, /uTransmission \* \(1\.0 \+ vegLeafTrans\)/, 'the translucency term takes the petal extra');
    assert.notEqual(petal.customProgramCacheKey(), leaf.customProgramCacheKey(), 'petal and leaf compile separate programs');
    const { depth, distance } = createVegShadowMaterials(petal);
    owned.push(depth, distance);
    for (const shadow of [prepare(depth, 'depth'), prepare(distance, 'distance')]) {
      assert.equal(projection(shadow), projection(ps), 'the petal band leaves the shared projection block alone');
      assert.doesNotMatch(shadow.vertexShader, /vLeafUv/);
    }
  }
  {
    const plain = createVegMaterial(ctx, 'litter');
    const dry = createVegMaterial(ctx, 'litter', { leafDetail: true });
    owned.push(plain, dry);
    const ds = prepare(dry, 'standard');
    assert.equal(ds.uniforms.uLeafDetail.value, 1, 'the litter block carries the detail uniform');
    assert.match(ds.vertexShader, /#include <project_vertex>[\s\S]*vLeafUv = uv;/, 'the litter uv is passed after three\'s own projection');
    assert.match(ds.fragmentShader, /if \(leafFade > 0\.0 && vLeafUv\.x < 1\.5\) \{/, 'laminae only (the twigs, roots and acorns sit at u ≥ 2)');
    assert.ok(ds.fragmentShader.includes(`vec3 grad = mix(vec3(${LITTER_ROOT_TINT.map((c) => c.toFixed(2)).join(', ')}), vec3(${LITTER_TIP_TINT.map((c) => c.toFixed(2)).join(', ')}), pow(v, 0.8));`), 'brown root → ochre tip');
    assert.match(ds.fragmentShader, /vec3 detail = grad \* \(1\.0 - 0\.16 \* rib - 0\.10 \* vein \+ 0\.05 \* margin\);/, 'the dry veins stand darker than the lamina');
    assert.match(ds.fragmentShader, /uTransmission \* \(1\.0 \+ vegLeafTrans\)/);
    assert.notEqual(dry.customProgramCacheKey(), plain.customProgramCacheKey(), 'the litter block is its own program');
    assert.doesNotMatch(prepare(plain, 'standard').fragmentShader, /vegLeafTrans/);
    // the petal option means nothing to litter
    const stray = createVegMaterial(ctx, 'litter', { leafDetail: 'petal' });
    owned.push(stray);
    assert.equal(prepare(stray, 'standard').uniforms.uLeafDetail, undefined);
  }
  // round 43 — the moss grain (kind moss, grain [near, far]): two octaves of world-space value noise on the albedo
  // after three's own projection, faded by the eye distance so the far cushions keep their flat tone; moss only
  {
    const { MOSS_GRAIN } = loadTs(path.join(here, 'materials.ts'));
    assert.ok(MOSS_GRAIN >= 0.12 && MOSS_GRAIN <= 0.35, 'a visible but modest swing');
    const flat = createVegMaterial(ctx, 'moss');
    const grainy = createVegMaterial(ctx, 'moss', { grain: [2.1, 3] });
    const litterGrain = createVegMaterial(ctx, 'litter', { grain: [2.1, 3] });
    owned.push(flat, grainy, litterGrain);
    const gs = prepare(grainy, 'standard');
    assert.deepEqual([gs.uniforms.uMossGrainFade.value.x, gs.uniforms.uMossGrainFade.value.y], [2.1, 3], 'the fade ring is the caller\'s');
    assert.match(gs.vertexShader, /#include <project_vertex>[\s\S]*vMossNear = 1\.0 - smoothstep\(uMossGrainFade\.x, uMossGrainFade\.y, distance\(cameraPosition, mossWorld\.xyz\)\);/, 'the fade is the eye distance, after the shared projection');
    assert.match(gs.fragmentShader, /#include <color_fragment>\s*if \(vMossNear > 0\.0\) \{\s*float mossG1 = mossNoise\(vMossWorld \* 180\.0\) - 0\.5;\s*float mossG2 = mossNoise\(vMossWorld \* 60\.0 \+ 7\.0\) - 0\.5;/, 'two octaves on the colour pass');
    assert.ok(gs.fragmentShader.includes(`diffuseColor.rgb *= 1.0 + ${MOSS_GRAIN.toFixed(2)} * mossGrain;`), 'the swing is the declared constant');
    assert.notEqual(grainy.customProgramCacheKey(), flat.customProgramCacheKey(), 'the grain is its own program');
    for (const other of [prepare(flat, 'standard'), prepare(litterGrain, 'standard')]) assert.doesNotMatch(other.fragmentShader, /mossNoise/, 'flat moss and litter take no grain');
    assert.equal(prepare(litterGrain, 'standard').uniforms.uMossGrainFade, undefined);
  }
}
{
  // round 40 (Astra's "repeated fans"): a clump card decodes its dryness in 1/16 steps and a mirror flag from the
  // sub-step, flipping the tile's u; a mat keeps its continuous dryness and never mirrors; the per-card hue /
  // lightness jitter rides in instanceColor (three's USE_INSTANCING_COLOR path multiplies the vertex colour)
  const clump = createVegMaterial(ctx, 'card', { card: { atlas: null, atlasSize: 2048, grid: [0.5, 0.25, 2, 1], mode: 0, upMix: 0.55, lum: [0.6, 0.5], alphaBoost: 0.22 } });
  owned.push(clump);
  const cs = prepare(clump, 'standard');
  assert.match(cs.vertexShader, /float cardSlot = fract\(aData\.w\) \* 16\.0;\s*float vegDry = uCardMode > 0\.5 \? fract\(aData\.w\) : floor\(cardSlot\) \/ 16\.0;\s*float cardMirror = uCardMode < 0\.5 && fract\(cardSlot\) > 0\.5 \? 1\.0 : 0\.0;/, 'clump dryness steps and mirror flag, mats continuous');
  assert.match(cs.vertexShader, /float atlasU = mix\(uv\.x, 1\.0 - uv\.x, cardMirror\);\s*vAtlasUv = vec2\(\(mod\(atlasTile, uTileGrid\.z\) \+ atlasU\) \* uTileGrid\.x/, 'the mirror flips the tile\'s u');
  assert.match(cs.vertexShader, /#ifdef USE_INSTANCING_COLOR\s*vColor\.rgb \*= instanceColor\.rgb;\s*#endif/, 'the instance colour multiplies the card colour');
}
const unrelated = new THREE.MeshStandardMaterial();
owned.push(unrelated);
assert.throws(() => createVegShadowMaterials(unrelated), /plant or bush/);
for (const material of owned) material.dispose();
console.log('Vegetation shader contracts passed: identical color/depth/distance wind, live uniform references, instancing guards, and Three.js encoding chunks. No GPU compile or visual verdict claimed.');
