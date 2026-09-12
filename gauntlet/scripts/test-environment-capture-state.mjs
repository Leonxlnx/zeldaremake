/** Synthetic state contract, not image or renderer evidence. */
import assert from 'node:assert/strict';
import { assertStableCaptureState } from './environment-capture-data.mjs';
const before = { camera: { position: [0.4, 1.8, 8.6], fov: 46 }, controls: { light: null, post: null },
  stats: { simTime: 12.5, textures: 71, geometries: 419, programs: 69, drawCalls: 620, triangles: 8384712, width: 1280, height: 720 },
  audit: { scene: { triangles: 7155794 }, systemFailures: [] } };
const disposed = structuredClone(before);
disposed.stats.textures = 53; disposed.stats.geometries = 418; disposed.stats.programs = 68;
assert.deepEqual(assertStableCaptureState(before, disposed, 'memory disposal'), {
  before: { textures: 71, geometries: 419, programs: 69 }, after: { textures: 53, geometries: 418, programs: 68 } });
for (const mutate of [s => { s.stats.simTime += .01; }, s => { s.camera.position[0] += .01; },
  s => { s.stats.triangles--; }, s => { s.stats.drawCalls--; }, s => { s.audit.scene.triangles--; },
  s => { s.controls.light = { sunIntensity: 9 }; }]) {
  const changed = structuredClone(disposed); mutate(changed);
  assert.throws(() => assertStableCaptureState(before, changed, 'must retain stable state'));
}
console.log('Environment state: allocation changes recorded; time/camera/draw geometry/audits/controls changes rejected.');
