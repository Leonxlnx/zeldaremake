/** Run: node --test src/world/hardscape/material.test.mjs. CPU shader checks; GPU capture is separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const compiled = ts.transpileModule(readFileSync(new URL('./material.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)((id) => {
  assert.equal(id, 'three');
  return THREE;
}, module, module.exports);
const { createStoneMaterial, STONE_NEAR } = module.exports;

test('stone relief keeps map channels and rotated slopes aligned without mutating shared textures', async () => {
  const maps = Object.fromEntries(['color', 'normal', 'roughness', 'ao'].map((key) => [key, new THREE.Texture()]));
  maps.ao.channel = 1;
  let sharedDisposed = 0;
  maps.ao.addEventListener('dispose', () => sharedDisposed++);
  const textures = { load: async (_set, kind) => maps[kind] };
  const config = { palette: { mossDeep: 0x585e40, mossBright: 0x898d62, soilDark: 0x423b26 } };
  const keys = new Set();
  for (const instanced of [false, true]) {
    const material = await createStoneMaterial(textures, config, 8, { instanced });
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader, {});
    const fragment = shader.fragmentShader;
    for (const source of [shader.vertexShader, fragment]) {
      for (const [, chunk] of source.matchAll(/#include <(\w+)>/g)) assert.ok(THREE.ShaderChunk[chunk] !== undefined, chunk);
    }
    for (const name of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
      assert.match(fragment, new RegExp(`texture2D\\(${name}, stoneNearUv\\(`), `${name} uses the same near UV transform`);
    }
    assert.match(fragment, /float ambientOcclusion = \( stoneAO - 1\.0 \)/);
    assert.match(fragment, /computeSpecularOcclusion\( dotNV, ambientOcclusion, material\.roughness \)/, 'Three retains specular AO');

    // Differentiate a sloped height field through the actual UV expression and compare the
    // injected normal rotation. Sampling a rotated tile alone used to point the slope sideways.
    const [, uvComponents, scale, offset] = fragment.match(/vec2 stoneDetailUv\(vec2 uv\) \{ return vec2\(([^)]+)\) \* ([\d.]+) \+ vec2\(([^)]+)\); }/);
    const sampleUV = new Function('uv', `return [${uvComponents}].map((v, i) => v * ${scale} + [${offset}][i]);`);
    const [, normalComponents] = fragment.match(/detN\.xy = vec2\(([^)]+)\);/);
    const rotateNormal = new Function('detN', `return [${normalComponents}];`);
    for (const [gx, gy] of [[0.7, -0.2], [-0.4, 0.9]]) {
      const h = (x, y) => { const [u, v] = sampleUV({ x, y }); return gx * u + gy * v; };
      const epsilon = 1e-5;
      const expected = [(h(epsilon, 0) - h(-epsilon, 0)), (h(0, epsilon) - h(0, -epsilon))].map((v) => -v / (2 * epsilon * Number(scale)));
      rotateNormal({ x: -gx, y: -gy }).forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9));
    }
    assert.ok(STONE_NEAR.cleaveDepthM > 0 && STONE_NEAR.cleaveDepthM <= 0.006, 'relief stays shallow');
    assert.notEqual(material.aoMap, maps.ao);
    assert.equal(material.aoMap.channel, 0);
    let cloneDisposed = 0;
    material.aoMap.addEventListener('dispose', () => cloneDisposed++);
    keys.add(material.customProgramCacheKey());
    material.dispose();
    material.dispose();
    assert.equal(cloneDisposed, 1);
  }
  assert.equal(keys.size, 2);
  assert.equal(maps.ao.channel, 1);
  assert.equal(sharedDisposed, 0);
  Object.values(maps).forEach((texture) => texture.dispose());
});
