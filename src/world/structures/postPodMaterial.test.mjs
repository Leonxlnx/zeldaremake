/** Run: node src/world/structures/postPodMaterial.test.mjs. CPU contracts, not GPU compilation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';

const module = { exports: {} };
const code = ts.transpileModule(readFileSync(fileURLToPath(new URL('./postPodMaterial.ts', import.meta.url)), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)((name) => {
  assert.equal(name, 'three', 'The owned finish has no shared resource or world RNG dependencies');
  return T;
}, module, module.exports);
const { createPostPodMaterial } = module.exports;
const borrowed = new T.DataTexture(new Uint8Array([120, 70, 20, 255]), 1, 1);
const shared = new T.MeshStandardMaterial({
  color: 0xffffff, vertexColors: true, emissive: 0xffffff, emissiveIntensity: 2,
  roughness: 0.6, metalness: 0, map: borrowed, emissiveMap: borrowed,
});
const sourceKey = shared.customProgramCacheKey(), sourceHook = shared.onBeforeCompile;
const originalState = shared.toJSON(), originalBytes = [...borrowed.image.data];
const owned = createPostPodMaterial(shared, 0xffbb55), second = createPostPodMaterial(shared, 0xffbb55);
const material = owned.material, atlas = material.emissiveMap;
assert.notEqual(material, shared);
assert.notEqual(atlas, borrowed);
assert.equal(material.map, borrowed, 'Other maps remain borrowed');
for (const key of ['color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'vertexColors', 'side', 'transparent', 'depthWrite', 'alphaTest']) {
  assert.deepEqual(material[key], shared[key], `Preserve ${key}`);
}
assert.equal(atlas.image.width, 256);
assert.equal(atlas.image.height, 256);
assert.equal(atlas.image.data.byteLength, 262144);
assert.deepEqual(atlas.image.data, second.material.emissiveMap.image.data, 'Original atlas is deterministic');
assert.equal(atlas.colorSpace, T.SRGBColorSpace);
assert.equal(atlas.wrapS, T.RepeatWrapping);
assert.equal(atlas.wrapT, T.ClampToEdgeWrapping);
assert.equal(atlas.minFilter, T.LinearMipmapLinearFilter);
assert.equal(atlas.magFilter, T.LinearFilter);
assert.equal(atlas.flipY, false);
assert(atlas.generateMipmaps);
for (let y = 218; y < 256; y++) for (let x = 0; x < 256; x++) {
  assert.deepEqual([...atlas.image.data.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 3)], [0, 0, 0]);
}
function prepare(mat) {
  const shader = { vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: T.UniformsUtils.clone(T.ShaderLib.standard.uniforms) };
  mat.onBeforeCompile(shader, {});
  for (const [, chunk] of shader.fragmentShader.matchAll(/#include <([\w_]+)>/g)) assert(T.ShaderChunk[chunk] !== undefined);
  return shader;
}
const original = prepare(shared), changed = prepare(material);
assert.equal(changed.vertexShader, original.vertexShader, 'No projection/geometry changes');
assert.deepEqual(changed.uniforms, original.uniforms, 'No extra light, emission or time uniforms');
assert.match(changed.fragmentShader, /totalEmissiveRadiance \*= 1\.0 - smoothstep\(0\.80, 0\.85, vEmissiveMapUv\.y\);/);
const restored = changed.fragmentShader.replace(/#include <emissivemap_fragment>\s*#ifdef USE_EMISSIVEMAP[\s\S]*?#endif/, '#include <emissivemap_fragment>');
const normalize = s => s.replace(/\s+/g, ' ').trim();
assert.equal(normalize(restored), normalize(original.fragmentShader), 'Only emissive body-band selection changes');
assert.notEqual(material.customProgramCacheKey(), sourceKey, 'The guarded program cannot reuse the shared one');
assert.equal(material.customProgramCacheKey(), second.material.customProgramCacheKey(), 'Both posts share one color program');
assert.equal(shared.customProgramCacheKey(), sourceKey);
assert.equal(shared.onBeforeCompile, sourceHook);
const disposal = { material: 0, atlas: 0, shared: 0, borrowed: 0 };
material.addEventListener('dispose', () => disposal.material++);
atlas.addEventListener('dispose', () => disposal.atlas++);
shared.addEventListener('dispose', () => disposal.shared++);
borrowed.addEventListener('dispose', () => disposal.borrowed++);
owned.dispose(); owned.dispose(); second.dispose();
assert.deepEqual(disposal, { material: 1, atlas: 1, shared: 0, borrowed: 0 });
assert.deepEqual(shared.toJSON(), originalState);
assert.deepEqual([...borrowed.image.data], originalBytes);
console.log('Post pod material: shader scope, bounded atlas, deterministic bytes and exactly-once owned disposal pass.');
