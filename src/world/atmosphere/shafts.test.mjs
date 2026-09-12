/** CPU lifecycle/geometry contract. The renderer stub performs no GPU work or image capture. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';
import * as fxaa from 'three/examples/jsm/shaders/FXAAShader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} }; modules.set(file, m);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', js)(id => {
    if (id === 'three') return T;
    if (id === 'three/examples/jsm/shaders/FXAAShader.js') return fxaa;
    return load(path.resolve(path.dirname(file), id + '.ts'));
  }, m, m.exports);
  return m.exports;
}
const { WORLD } = load('config.ts');
const { CANOPY_OPENINGS } = load('trees/corridors.ts');
const terrain = load('terrain/heightfield.ts').createTerrain();
const sunDir = load('lighting/sun.ts').sunDirection(WORLD.sun.azimuthDeg, WORLD.sun.elevationDeg);
const right = new T.Vector3(0, 1, 0).cross(sunDir).normalize();
const up = new T.Vector3().crossVectors(sunDir, right).normalize();
const published = CANOPY_OPENINGS.map(c => ({ id: c.id,
  point: [c.point[0], terrain.height(...c.point), c.point[1]], axis: sunDir.toArray(), radius: c.radius, band: [...c.band],
}));
const top = published.find(o => o.id === 'flight-top');
assert.equal(published.length, 7);
assert.equal(top.point[1], 4.5908427238464355);
const { SHAFT_COLUMNS } = load('atmosphere/shafts.ts');
assert.deepEqual(SHAFT_COLUMNS, [
  { point: [1.3, 6.6, -9.4], radius: 1.8, gain: 1 },
  { point: [-3, 8, -14.5], radius: 1.8, gain: 1 },
  { point: [5, 7, -17], radius: 1.8, gain: 1 },
  { point: [13.3, 10, -14.6], radius: 1.3, gain: 7.5 },
  { point: [9.6, 6.9, -6.6], radius: 1.3, gain: 7.5 },
  { point: [20.4, 11.2, -12.8], radius: 1.3, gain: 7.5 },
]);
const passes = new Map();
const renderer = {
  info: { autoReset: true, reset() {} }, autoClear: true,
  getDrawingBufferSize: out => out.set(1280, 720),
  setRenderTarget() {}, getClearAlpha: () => 1,
  getClearColor: out => out.set(0), setClearColor() {}, clear() {},
  render(object) { if (object.isMesh) passes.set(object.material.name, object.material); },
};
const scene = new T.Scene(), camera = new T.PerspectiveCamera(42, 1280 / 720, .1, 500);
camera.position.set(-1.96, 1.8, 4); camera.lookAt(9.7, .98, 1.31); camera.updateMatrixWorld();
const sun = new T.DirectionalLight(0xffffff, 3.6);
const shadowMap = { depthTexture: new T.DepthTexture(16, 16) };
sun.shadow.map = shadowMap;
let shared;
const composer = load('postfx/composer.ts').createComposer({ renderer, scene, camera,
  sunDirection: sunDir, sun: () => sun, canopyOpenings: () => shared ?? [], exposure: 1, headless: true,
});
composer.render(0);
const material = passes.get('postfx-ray-march');
assert.ok(material);
const array = material.uniforms.uCanopyGaps.value, vectors = [...array];
const counter = material.uniforms.uCanopyGapCount, version = material.version;
const defines = { ...material.defines };
assert.equal(counter.value, 0, 'Atmosphere may render before trees publish');
assert.equal(array.length, 8);
assert.equal(composer.audit().godRayCanopyOpeningMask.publishedCount, 0);
shared = published;
composer.render(0);
assert.equal(counter.value, 1);
assert.equal(composer.audit().godRayCanopyOpeningMask.publishedCount, 7);
assert.equal(composer.audit().godRayCanopyOpeningMask.entries[0].id, 'flight-top');
assert.deepEqual(composer.audit().godRayCanopyOpeningMask.entries[0].point, top.point);
const point = new T.Vector3(...top.point), expected = [point.dot(right), point.dot(up), 1, 3];
assert.deepEqual(array[0].toArray(), expected);
for (const distance of [-20, -1, 0, 5, 40]) {
  const along = point.clone().addScaledVector(sunDir, distance);
  assert.ok(Math.abs(along.dot(right) - expected[0]) < 1e-12);
  assert.ok(Math.abs(along.dot(up) - expected[1]) < 1e-12, 'Mask stays on the actual sun axis');
}
const wrongGround = new T.Vector3(top.point[0], 0, top.point[2]);
const wrongAxisOffset = Math.hypot(wrongGround.dot(right) - expected[0], wrongGround.dot(up) - expected[1]);
assert.ok(wrongAxisOffset > 3.61 && wrongAxisOffset < 3.62);
const legacyBefore = material.uniforms.uGaps.value.map(v => v.toArray());
const densityBefore = material.uniforms.uDensity.value.toArray();
const fadeBefore = material.uniforms.uAirFade.value.toArray();
assert.equal(composer.audit().effectiveSettings.beamCanopyGain, 3);
assert.equal(composer.audit().godRayCanopyGain, 3);
assert.equal(composer.audit().godRayCanopyOpeningMask.entries[0].gain, 3);
for (const gain of [1, 3, 0, 1, 3]) {
  globalThis.__ATMO_SETTINGS__ = { beamCanopyGain: gain };
  composer.render(0);
  assert.equal(counter.value, gain > 0 ? 1 : 0);
  assert.equal(composer.audit().godRayCanopyGain, gain);
  if (gain > 0) {
    assert.deepEqual(array[0].toArray(), [...expected.slice(0, 3), gain]);
    assert.equal(composer.audit().godRayCanopyOpeningMask.entries[0].gain, gain);
  } else {
    assert.ok(array.every(v => v.toArray().every(n => n === 0)), 'Zero gain adds no mask');
    assert.deepEqual(composer.audit().godRayCanopyOpeningMask.entries, []);
  }
  assert.equal(material.uniforms.uCanopyGaps.value, array);
  for (let i = 0; i < 8; i++) assert.equal(array[i], vectors[i]);
  assert.equal(material.uniforms.uCanopyGapCount, counter);
  assert.equal(material.version, version, 'Runtime gain does not request a shader recompile');
  assert.deepEqual(material.defines, defines);
  assert.deepEqual(material.uniforms.uGaps.value.map(v => v.toArray()), legacyBefore);
  assert.deepEqual(material.uniforms.uDensity.value.toArray(), densityBefore);
  assert.deepEqual(material.uniforms.uAirFade.value.toArray(), fadeBefore);
}
globalThis.__ATMO_SETTINGS__ = { beamCanopyOpenings: false };
composer.render(0);
assert.equal(counter.value, 0);
assert.ok(array.every(v => v.toArray().every(n => n === 0)));
assert.equal(composer.audit().effectiveSettings.beamCanopyOpenings, false);
assert.equal(composer.audit().godRayCanopyOpeningMask.activeCount, 0);
delete globalThis.__ATMO_SETTINGS__;
composer.render(0);
assert.equal(counter.value, 1);
assert.equal(composer.audit().effectiveSettings.beamCanopyOpenings, true);
assert.deepEqual(array[0].toArray(), expected);
sun.shadow.map = null;
composer.render(0);
assert.equal(counter.value, 0, 'No map means no opening contribution');
sun.shadow.map = shadowMap; sun.intensity = 0;
composer.render(0);
assert.equal(counter.value, 0, 'No sun means no opening contribution');
sun.intensity = 3.6;
shared = published.filter(o => o.id !== 'flight-top');
composer.render(0);
assert.equal(counter.value, 0, 'Other published pools are not automatically opened');
shared = published;
composer.render(0);
assert.equal(counter.value, 1);
assert.equal(material.uniforms.uCanopyGaps.value, array);
for (let i = 0; i < 8; i++) assert.equal(array[i], vectors[i]);
assert.equal(material.uniforms.uCanopyGapCount, counter);
assert.equal(material.version, version, 'Toggles/publication do not request a shader recompile');
assert.deepEqual(material.defines, defines);
assert.deepEqual(material.uniforms.uGaps.value.map(v => v.toArray()), legacyBefore);
assert.deepEqual(material.uniforms.uDensity.value.toArray(), densityBefore);
assert.deepEqual(material.uniforms.uAirFade.value.toArray(), fadeBefore);

// Evaluate the production shader's actual scalar guard, not a separately restated condition.
const shader = material.fragmentShader;
const condition = shader.match(/if \( (uCanopyGapCount > 0 && lit > 0\.0.*?) \) \{/)[1];
const permits = new Function('uCanopyGapCount', 'lit', 'sc', `return ${condition};`);
assert.equal(permits(1, 1, { x: .5, y: .5, z: .5 }), true);
assert.equal(permits(1, 0, { x: .5, y: .5, z: .5 }), false, 'Blocked raw shadow remains blocked');
assert.equal(permits(0, 1, { x: .5, y: .5, z: .5 }), false);
for (const axis of ['x', 'y', 'z']) for (const outside of [-.001, 1.001]) {
  const sc = { x: .5, y: .5, z: .5, [axis]: outside };
  assert.equal(permits(1, 1, sc), false, 'Outside-map fallback cannot open new air');
}
assert.equal(permits(1, 1, { x: .5, y: .5, z: 0 }), true, 'Near-plane depth is valid');
assert.equal(permits(1, 1, { x: 0, y: .5, z: .5 }), false, 'Unsampled map edge stays excluded');
// Evaluate the production mask expression, retaining its actual gain and edge arithmetic.
const maskBody = shader.split('float canopyOpeningMask( vec3 pw ) {')[1].split('return open;')[0];
const maskExpression = maskBody.match(/open = (max\( open, .*?);/)[1]
  .replace('length( q - uCanopyGaps[ i ].xy )', 'distance');
const sampleMask = new Function('uCanopyGaps', 'i', 'r', 'distance', 'open', 'max', 'smoothstep',
  `return ${maskExpression};`);
const smoothstep = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
for (const gain of [0, 1, 3]) for (const [distance, edge] of [[0, 1], [.7, 1], [.85, .5], [1, 0], [1.1, 0]]) {
  const actual = sampleMask([{ w: gain }], 0, 1, distance, 0, Math.max, smoothstep);
  assert.ok(Math.abs(actual - gain * edge) < 1e-12, 'Local gain scales the same 1 m feathered mask');
  assert.equal(sampleMask([{ w: gain }], 0, 1, distance, 4, Math.max, smoothstep), 4,
    'The local opening cannot reduce an inherited stronger mask');
}
composer.dispose(); shadowMap.depthTexture.dispose();
console.log(JSON.stringify({ passed: true, scope: 'CPU lifecycle/uniform/axis/guard checks; no GPU render',
  published: 7, active: 1, groundAnchor: top.point, sunPlane: expected.slice(0, 2), radius: 1, defaultGain: 3, testedRuntimeGains: [1, 3, 0],
  wrongZeroHeightAxisOffsetM: wrongAxisOffset, legacyColumnsPreserved: 6, stableUniformSlots: 8,
  shaderRecompileRequests: 0,
}));
