/** Check the real Three.js shadow projection, not a second implementation of the snapper. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const module = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(
  readFileSync(new URL('./shadowframe.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(id => { assert.equal(id, 'three'); return THREE; }, module, module.exports);
const { createShadowTargetSnapper } = module.exports;
const { DirectionalLight, Vector3, Vector4 } = THREE;
const probes = [new Vector4(5, 0, 8, 1), new Vector4(10, 3, -15, 1), new Vector4(-10, 8, -5, 1)];
const terrain = (x, z) => 0.17 * x + Math.sin(z * 0.3) * 1.7;
const phaseError = value => Math.abs(value - Math.round(value));
let worstStable = 0, worstLegacy = 0, projections = 0;

for (const [azimuth, elevation] of [[-128, 38], [70, 58]]) {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
  const direction = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  for (const mapSize of [1024, 4096]) {
    const light = new DirectionalLight();
    const camera = light.shadow.camera;
    Object.assign(camera, { left: -46, right: 46, top: 46, bottom: -46, near: 40, far: 250 });
    camera.updateProjectionMatrix();
    light.shadow.mapSize.set(mapSize, mapSize);
    const texel = 92 / mapSize;
    const snap = createShadowTargetSnapper(direction, camera.up, texel);
    const project = target => {
      light.target.position.copy(target);
      light.position.copy(target).addScaledVector(direction, 140);
      light.target.updateMatrixWorld(); light.updateMatrixWorld();
      light.shadow.updateMatrices(light);
      return probes.map(p => {
        const q = p.clone().applyMatrix4(light.shadow.matrix);
        return [q.x / q.w * mapSize, q.y / q.w * mapSize];
      });
    };
    let anchorStable, anchorLegacy;
    for (let i = 0; i < 320; i++) {
      // Forward travel, changing terrain height and turning the ahead-of-camera centre.
      const x = -8 + i * 0.057 + Math.sin(i * 0.031) * 2;
      const z = 12 - i * 0.043 + Math.cos(i * 0.027);
      const desired = new Vector3(x, terrain(x, z), z);
      const snapped = snap(desired, new Vector3());
      assert(snapped.distanceTo(desired) <= texel / Math.sqrt(2) + 1e-10, 'Window stays within half a texel per light axis');
      assert(Math.abs(snapped.clone().sub(desired).dot(direction)) < 1e-10, 'Target retains depth coverage');
      const aliased = desired.clone(); snap(aliased, aliased);
      assert(aliased.distanceTo(snapped) < 1e-10, 'In-place target update works');
      const legacyX = Math.round(x), legacyZ = Math.round(z);
      const currentStable = project(snapped);
      const currentLegacy = project(new Vector3(legacyX, terrain(legacyX, legacyZ), legacyZ));
      anchorStable ??= currentStable; anchorLegacy ??= currentLegacy;
      for (let p = 0; p < probes.length; p++) for (let axis = 0; axis < 2; axis++) {
        worstStable = Math.max(worstStable, phaseError(currentStable[p][axis] - anchorStable[p][axis]));
        worstLegacy = Math.max(worstLegacy, phaseError(currentLegacy[p][axis] - anchorLegacy[p][axis]));
        projections++;
      }
    }
  }
}
assert(worstStable < 1e-8, `Static receivers retain shadow texel phase: ${worstStable}`);
assert(worstLegacy > 0.25, 'Negative control exposes fractional drift with the old world-metre snapping');
assert.throws(() => createShadowTargetSnapper(new Vector3(0, 1, 0), new Vector3(0, 1, 0), 0), /positive/);
console.log(JSON.stringify({ passed: true, projections, worstStableTexelPhase: worstStable, worstLegacyTexelPhase: worstLegacy,
  scope: 'Real Three.js shadow matrices under camera/terrain motion; GPU appearance and moving vegetation still need review.' }));
