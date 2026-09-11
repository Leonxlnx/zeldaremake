/** Input/focus and terrain-camera regressions; no browser or rendering substitution. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

class Element extends EventTarget { tagName = 'DIV'; isContentEditable = false; }
globalThis.HTMLElement = Element;
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(), { hidden: false, pointerLockElement: null });
const module = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(new URL('./follow.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', source)(id => {
  if (id !== 'three') throw new Error(`unexpected runtime import ${id}`);
  return THREE;
}, module, module.exports);
const { createFollowCam } = module.exports;
const host = new Element(), camera = new THREE.PerspectiveCamera();
const inputs = [];
const player = { position: new THREE.Vector3(), heading: () => 0, setInput: i => inputs.push({ ...i }) };
const terrain = { height: (x, z) => z < -2.1 && z > -2.8 ? 2 : 0 };
const follow = createFollowCam(host, terrain, camera, player);
follow.enabled = true; follow.snap();
function key(type, code, extra = {}) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, Object.fromEntries(Object.entries({ code, repeat: false, ...extra }).map(([k, value]) => [k, { value }])));
  window.dispatchEvent(event); return event;
}
key('keydown', 'KeyW'); follow.update(1 / 60);
assert.equal(inputs.at(-1).moveZ, 1);
key('keydown', 'KeyD'); key('keydown', 'ShiftLeft'); follow.update(1 / 60);
assert.ok(Math.abs(Math.hypot(inputs.at(-1).moveX, inputs.at(-1).moveZ) - 1) < 1e-12);
assert.equal(inputs.at(-1).run, true);
assert.equal(key('keydown', 'Space').defaultPrevented, true);
key('keyup', 'Space'); follow.update(1 / 60); assert.equal(inputs.at(-1).jump, true, 'quick tap retained');
follow.update(1 / 60); assert.equal(inputs.at(-1).jump, false, 'tap consumed once');
window.dispatchEvent(new Event('blur')); follow.update(1 / 60);
assert.deepEqual(inputs.at(-1), { moveX: 0, moveZ: 0, run: false, jump: false });
key('keydown', 'KeyW'); follow.setSuspended(true); follow.update(1 / 60);
assert.equal(inputs.at(-1).moveZ, 0, 'menu clears held movement');
follow.setSuspended(false); follow.update(1 / 60); assert.equal(inputs.at(-1).moveZ, 0);
const field = new Element(); field.tagName = 'INPUT';
key('keydown', 'KeyW', { target: field }); follow.update(1 / 60); assert.equal(inputs.at(-1).moveZ, 0);
key('keydown', 'KeyW'); document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
follow.update(1 / 60); assert.equal(inputs.at(-1).moveZ, 0);
document.hidden = false;
// A ridge obstructs the boom even though the full-distance endpoint is above flat ground.
follow.snap(); assert.ok(camera.position.z > -2.1, 'camera comes in front of ridge');
player.position.y = 1;
for (let i = 0; i < 120; i++) {
  player.position.z += 0.035;
  follow.lateUpdate(1 / 120);
  assert.ok(camera.position.y >= terrain.height(camera.position.x, camera.position.z) + 0.4 - 1e-10);
}
assert.ok(camera.position.y > 2, 'camera follows player height in flight');
follow.dispose(); const count = inputs.length;
key('keydown', 'KeyW'); window.dispatchEvent(new Event('blur'));
assert.equal(inputs.length, count, 'dispose removes listeners');
console.log('follow input, focus, suspension, airborne height and terrain boom checks passed');
