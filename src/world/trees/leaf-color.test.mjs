/** Run: node --test src/world/trees/leaf-color.test.mjs. CPU contracts, not GPU compilation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const textures = new Map();
function texture(name) {
  if (!textures.has(name)) {
    const t = new THREE.Texture();
    t.name = name;
    textures.set(name, t);
  }
  return textures.get(name);
}

// Existing in-memory TS loader pattern; only canvas painters are stubbed. Disabling the
// warmth hook gives the exact same material factories and all their existing shader hooks.
function loader(withoutWarmth = false) {
  const modules = new Map();
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)((name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected dependency: ${name}`);
    }, module, module.exports);
    if (file.endsWith('bark-texture.ts')) {
      module.exports.createWhiteBarkTextures = () => ({ color: texture('bark-color'), normal: texture('bark-normal'), roughness: texture('bark-roughness') });
    }
    if (file.endsWith('leaf-cluster-texture.ts')) {
      Object.assign(module.exports, {
        createLeafClusterTexture: () => texture('cluster'),
        createLeafClusterDetail: () => ({ color: texture('cluster-near'), normal: texture('cluster-normal') }),
        createFarCrownAtlas: () => texture('far-crown'),
      });
    }
    if (withoutWarmth && file.endsWith('leaf-color.ts')) module.exports.injectTreeLeafWarmth = () => {};
    return module.exports;
  }
  return (name) => load(path.join(here, name));
}

async function materials(withoutWarmth) {
  const load = loader(withoutWarmth);
  const { createRng } = load('../util/prng.ts');
  const { createWind } = load('../wind/wind.ts');
  const { WORLD } = load('../config.ts');
  const ctx = { config: WORLD, wind: createWind(), rng: createRng(WORLD.seed), quality: { tier: 'high' }, textures: { load: async (set, channel) => texture(`${set}/${channel}`) } };
  const mats = await load('materials.ts').createTreeMaterials(ctx);
  mats.distantCrown = load('distant.ts').createDistantCrownMaterial(ctx.wind, ctx.rng, WORLD.palette, new THREE.Vector3(0.6, 0.6, 0.5).normalize());
  return Object.fromEntries(Object.entries(mats).filter(([, m]) => m.isMaterial));
}

function prepare(material) {
  const base = THREE.ShaderLib[material.isMeshDepthMaterial ? 'depth' : 'standard'];
  const shader = { vertexShader: base.vertexShader, fragmentShader: base.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, {});
  return shader;
}
const declaration = 'uniform float uTreeLeafWarmth;\n';
const blockPattern = /\n    \/\/ Tree leaf warmth:[\s\S]*?\/\/ End tree leaf warmth\.\n    #include <opaque_fragment>/;
const affected = ['whiteTree', 'giantTree', 'giantTreeNear', 'columnTree', 'giantTreeNearCanopy', 'giantCanopy', 'distantCrown'];
const candidate = await materials(false);
const baseline = await materials(true);
const shaders = Object.fromEntries(Object.entries(candidate).map(([name, mat]) => [name, prepare(mat)]));

test('only crown colour programs change; vertex, depth, normals, alpha and existing uniforms are retained', () => {
  const separateValues = new Set();
  for (const [name, material] of Object.entries(candidate)) {
    const shader = shaders[name];
    const old = prepare(baseline[name]);
    assert.equal(shader.vertexShader, old.vertexShader, `${name}: vertex/wind/LOD code`);
    const { uTreeLeafWarmth, ...unchanged } = shader.uniforms;
    assert.deepEqual(unchanged, old.uniforms, `${name}: existing uniforms`);
    for (const key of ['alphaTest', 'transparent', 'depthWrite', 'depthTest', 'side', 'roughness', 'metalness', 'map', 'normalMap', 'roughnessMap', 'normalScale', 'color', 'fog', 'blending']) {
      assert.deepEqual(material[key], baseline[name][key], `${name}: ${key}`);
    }
    if (affected.includes(name)) {
      assert.equal(uTreeLeafWarmth.value, 0.35, `${name}: candidate default`);
      separateValues.add(uTreeLeafWarmth);
      const block = shader.fragmentShader.match(blockPattern)?.[0];
      assert.ok(block, `${name}: pre-opacity insertion`);
      assert.equal(shader.fragmentShader.replace(declaration, '').replace(block, '#include <opaque_fragment>'), old.fragmentShader, `${name}: every other fragment channel`);
      assert.equal(shader.fragmentShader.split(declaration).length, 2, `${name}: declared once`);
      assert.match(material.customProgramCacheKey(), /leaf-warmth/, `${name}: cache key`);
      assert.ok(shader.fragmentShader.indexOf(block) > shader.fragmentShader.indexOf('vec3 outgoingLight ='), `${name}: after completed lighting`);
      assert.ok(shader.fragmentShader.indexOf(block) < shader.fragmentShader.indexOf('#include <fog_fragment>'), `${name}: before fog`);
      assert.match(block, name === 'giantCanopy' || name === 'distantCrown' ? /if \(true &&/ : /if \(vIsLeaf > 0\.5 &&/, `${name}: leaf gate`);
    } else {
      assert.equal(uTreeLeafWarmth, undefined, `${name}: ground foliage / wood / depth excluded`);
      assert.equal(shader.fragmentShader, old.fragmentShader, `${name}: entire fragment unchanged`);
      assert.doesNotMatch(material.customProgramCacheKey(), /leaf-warmth/, `${name}: cache key unchanged`);
    }
  }
  assert.equal(separateValues.size, affected.length, 'capture overrides can restore each material independently');
});

// Execute the actual inserted scalar math on the CPU: remove GLSL types and express the
// two vector operations in JS. This is not a second, independently maintained colour formula.
function evaluator(shader) {
  const block = shader.fragmentShader.match(blockPattern)[0];
  const body = block.slice(0, block.indexOf('#include'))
    .replace('const vec3 ', 'const ')
    .replace(/\bfloat /g, 'let ')
    .replace('vec3 warmLeaf = outgoingLight;', 'const warmLeaf = { ...outgoingLight };')
    .replace(/outgoingLight = warmLeaf \* \((.*)\);/, 'outgoingLight = mul(warmLeaf, ($1));');
  const run = new Function('outgoingLight', 'uTreeLeafWarmth', 'vIsLeaf', 'vec3', 'dot', 'max', 'clamp', 'mul', `${body}\nreturn outgoingLight;`);
  return (rgb, amount, leaf = 1) => run({ ...rgb }, amount, leaf,
    (r, g, b) => ({ r, g, b }),
    (a, b) => a.r * b.r + a.g * b.g + a.b * b.b,
    Math.max, (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
    (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k }));
}
const evaluate = evaluator(shaders.whiteTree);
const luma = (c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
const hsvSaturation = (c) => 1 - Math.min(c.r, c.g, c.b) / Math.max(c.r, c.g, c.b);

test('black, tiny values, neutrals, non-green colours, bark and the zero control stay exact', () => {
  for (const rgb of [{ r: 0, g: 0, b: 0 }, { r: 1e-12, g: 3e-12, b: 0 }, { r: 0.4, g: 0.4, b: 0.4 }, { r: 0.7, g: 0.4, b: 0.2 }, { r: 0.1, g: 0.2, b: 0.6 }]) {
    for (const k of [0, 0.35, 0.65]) assert.deepEqual(evaluate(rgb, k), rgb);
  }
  const olive = { r: 0.13, g: 0.2, b: 0.05 };
  assert.deepEqual(evaluate(olive, 0), olive);
  assert.deepEqual(evaluate(olive, -1), olive);
  assert.deepEqual(evaluate(olive, 0.65, 0), olive, 'combined-material bark gate');
  assert.deepEqual(evaluate(olive, 2), evaluate(olive, 1), 'bounded strength cannot push red past green');
  for (const name of ['giantCanopy', 'distantCrown']) assert.deepEqual(evaluator(shaders[name])(olive, 0.65, 0), evaluate(olive, 0.65), `${name}: crown-only gate`);
});

test('olive colours keep linear luminance and HSV saturation while warming monotonically at all radiance scales', () => {
  for (const scale of [1e-12, 1e-6, 0.001, 0.2, 1, 8, 100]) {
    for (const blue of [0, 0.1, 0.4, 0.8]) {
      for (const red of [blue, (blue + 1) * 0.5, 0.95, 1].filter((r) => r >= blue)) {
        const rgb = { r: red * scale, g: scale, b: blue * scale };
        let previousRatio = rgb.r / rgb.g;
        for (const k of [0, 0.35, 0.65, 1]) {
          const result = evaluate(rgb, k);
          assert.ok(Object.values(result).every((v) => Number.isFinite(v) && v >= 0));
          assert.ok(Math.abs(luma(result) - luma(rgb)) <= 1e-12 * Math.max(1, scale), 'linear luminance');
          assert.ok(Math.abs(hsvSaturation(result) - hsvSaturation(rgb)) <= 1e-12, 'HSV saturation');
          assert.ok(result.r / result.g >= previousRatio - 1e-12, 'hue moves toward yellow');
          assert.ok(result.r <= result.g + 1e-12 && result.r >= result.b - 1e-12, 'olive channel ordering');
          previousRatio = result.r / result.g;
        }
      }
    }
  }
  const leaf = { r: 0.13, g: 0.2, b: 0.05 };
  assert.ok(evaluate(leaf, 0.35).r > leaf.r, 'candidate makes a real colour change');
});
