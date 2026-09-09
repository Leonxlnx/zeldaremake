// Synthetic-pixel API check: no browser, WebGL, source changes, or extra packages.
// Run from repository root; optional argument is the commit to review.
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const revision = process.argv[2] || '4ef0799';
const assertFixed = process.argv.includes('--assert-fixed');
let failReadback = false;
const source = execFileSync('git', ['show', `${revision}:src/capture/api.ts`], { encoding: 'utf8' });
const module = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)((name) => {
  if (name === 'three') return THREE;
  if (name === '../world/layout') return { LAYOUT: { viewpoints: [], stairs: [] } };
  throw Error(`Unexpected runtime dependency: ${name}`);
}, module, module.exports);
globalThis.window = {};
let distance = 100;
let clearColor = 0x123456;
let clearAlpha = 0.5;
const renderer = {
  getRenderTarget: () => null, setRenderTarget() {}, clear() {}, render() {},
  getClearColor(target) { return target.setHex(clearColor); },
  getClearAlpha() { return clearAlpha; },
  setClearColor(c, a) { clearColor = c?.isColor ? c.getHex() : c; clearAlpha = a; },
  readRenderTargetPixels(_rt, _x, _y, _w, _h, pixels) {
    if (failReadback) throw new Error('Synthetic readback failure');
    if (distance === Infinity) { pixels.fill(255); return; }
    // Exact coarse RGB channels plus quantized residual alpha for r186 RGBA packing.
    let remainder = 250 / 249.9 - 25 / (249.9 * distance);
    const packed = [];
    for (let i = 0; i < 3; i++) {
      remainder *= 256;
      const channel = Math.floor(remainder);
      packed.push(channel);
      remainder -= channel;
    }
    packed.push(Math.round(remainder * 255));
    for (let i = 0; i < pixels.length; i += 4) pixels.set(packed, i);
  },
};
const api = module.exports.installCaptureApi({
  scene: new THREE.Scene(), renderer,
  camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.2, 1000),
});
console.log({ revision, legacySkyThresholdMetres: 25 / (250 - 0.999 * 249.9) });
for (distance of [50, 75, 100, 200]) {
  const result = api.depthHistogram(250);
  if (assertFixed) {
    assert.equal(result.skyFraction, 0, `Geometry at ${distance}m must not become sky`);
    const bucket = result.buckets.findIndex(n => n > 0);
    assert.ok(Math.abs(bucket - distance / 2.5) <= 1);
  }
  console.log({ distance, skyFraction: result.skyFraction,
    occupiedBuckets: result.buckets.flatMap((n, i) => n ? [i] : []) });
}
console.log('clear state after audit', { clearColor, clearAlpha, expectedColor: 0x123456, expectedAlpha: 0.5 });

if (assertFixed) {
  assert.equal(clearColor, 0x123456);
  assert.equal(clearAlpha, .5);
  distance = Infinity;
  assert.equal(api.depthHistogram(250).skyFraction, 1, 'White clear sentinel is sky');
  failReadback = true;
  assert.throws(() => api.depthHistogram(250), /Synthetic readback failure/);
  assert.equal(clearColor, 0x123456, 'Restore clear color after readback throws');
  assert.equal(clearAlpha, .5, 'Restore alpha after readback throws');
  console.log('PASS: far geometry, sky sentinel and clear-state restoration');
}
