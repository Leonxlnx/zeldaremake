/**
 * The owner, 2026-09-23 23:00: "whenever I walk up or down the stairs, it glitches the frames like
 * up and forth every each step."
 *
 * Drives the real follow camera (src/camera/follow.ts) over a synthetic staircase on the CPU — the
 * same rig follow.test.mjs uses, no browser — and reports how much of the camera's vertical motion
 * and pitch is a per-riser saw-tooth rather than a climb. A smooth glide climbs at a steady rate;
 * a stepped one alternates fast-slow once per tread, which is what he is seeing.
 *
 *   node art/environment/owner-2026-09-23/pass5/stair-cam.mjs [--down]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../src/camera');
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
      }
      throw new Error(`unexpected dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const listeners = () => {
  const map = new Map();
  return { addEventListener: (t, f) => map.set(t, [...(map.get(t) ?? []), f]), removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), style: {}, ownerDocument: { exitPointerLock() {} }, requestPointerLock() {}, emit: (t, e) => (map.get(t) ?? []).forEach((f) => f(e)) };
};
globalThis.window = listeners();
globalThis.document = { pointerLockElement: null };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [null] }, configurable: true });

const { createFollowCam } = loadTs(path.join(root, 'follow.ts'));

/** the main flight's shape: 0.30 m treads, 0.17 m risers, climbing along −z from z = 0 */
const TREAD = 0.3;
const RISER = 0.17;
const STEPS = 22;
const groundAt = (x, z) => {
  const u = -z;
  if (u <= 0) return 0;
  const n = Math.min(STEPS, Math.floor(u / TREAD));
  return n * RISER;
};

const down = process.argv.includes('--down');
const host = listeners();
const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.08, 900);
const player = {
  position: new THREE.Vector3(0, 0, 0),
  heading: () => (down ? 0 : Math.PI),
  airHeight: () => 0,
  groundHeight: groundAt,
  surfaceHeight: groundAt,
  setInput() {},
  setPlayMode() {},
  playMode: () => true,
  place() {},
};
const terrain = { height: groundAt };
const cam = createFollowCam(host, terrain, camera, player, { shared: {} });
cam.enabled = true;

// walk at 3.4 m/s (Link's run) along the flight, 60 fps, and sample the camera each frame
const DT = 1 / 60;
const SPEED = 3.4;
const start = down ? -(STEPS * TREAD) : 0;
player.position.set(0, groundAt(0, start), start);
cam.snap();
const ys = [];
const pitches = [];
for (let i = 0; i < 260; i++) {
  const z = start + (down ? 1 : -1) * SPEED * DT * i;
  player.position.set(0, groundAt(0, z), z);
  cam.update(DT);
  const u = -z;
  if (u < TREAD * 2 || u > (STEPS - 2) * TREAD) continue; // ignore the approach and the top landing
  ys.push(camera.position.y);
  const d = camera.getWorldDirection(new THREE.Vector3());
  pitches.push((Math.asin(d.y) * 180) / Math.PI);
}

/** per-frame change, and how much of it is alternation rather than a steady climb */
const diffs = (a) => a.slice(1).map((v, i) => v - a[i]);
const stats = (a, label, unit) => {
  const d = diffs(a);
  const mean = d.reduce((s, v) => s + v, 0) / d.length;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / d.length);
  // the second difference is the saw-tooth: a steady glide has ~0, a per-riser step alternates
  const dd = diffs(d);
  const jerk = Math.sqrt(dd.reduce((s, v) => s + v * v, 0) / dd.length);
  const peak = Math.max(...d) - Math.min(...d);
  console.log(`${label.padEnd(16)} per frame: mean ${mean.toFixed(4)} ${unit}, sd ${sd.toFixed(4)}, peak-to-peak ${peak.toFixed(4)}, ripple (rms 2nd diff) ${jerk.toFixed(5)} ${unit}`);
  return { mean, sd, peak, jerk };
};

console.log(`${down ? 'down' : 'up'} a ${STEPS}-step flight (${TREAD} m treads, ${RISER} m risers) at ${SPEED} m/s, ${ys.length} frames sampled`);
stats(ys, 'camera height', 'm');
stats(pitches, 'camera pitch', 'deg');
