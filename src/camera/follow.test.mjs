/** Run: node --test src/camera/follow.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
          if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
        }
      }
      throw new Error(`Unexpected test dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

/** a tiny DOM: listeners by type on the host and the window, one gamepad slot */
function listeners() {
  const map = new Map();
  return {
    addEventListener: (t, f) => map.set(t, [...(map.get(t) ?? []), f]),
    removeEventListener: (t, f) => map.set(t, (map.get(t) ?? []).filter((g) => g !== f)),
    emit: (t, e) => (map.get(t) ?? []).forEach((f) => f(e)),
  };
}
const win = listeners();
const pad = { value: null };
globalThis.window = win;
globalThis.document = { pointerLockElement: null };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad.value] }, configurable: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const { createFollowCam, PITCH_REST, PITCH_UP, PITCH_DOWN, FOLLOW } = loadTs(path.join(here, 'follow.ts'));
const { CLEARANCE } = loadTs(path.join(here, 'collision.ts'));
const { VoxelGrid } = loadTs(path.join(here, '../world/util/voxelGrid.ts'));

function rig({ groundAt = () => 0, shared = {}, invertY = false, heading = Math.PI } = {}) {
  const host = listeners();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.08, 900);
  let input = { moveX: 0, moveZ: 0 };
  const face = { heading };
  const player = {
    position: new THREE.Vector3(0, 0, 0),
    heading: () => face.heading,
    airHeight: () => 0,
    groundHeight: (x, z) => groundAt(x, z),
    surfaceHeight: (x, z) => groundAt(x, z),
    setInput: (i) => (input = i),
    setPlayMode() {},
    playMode: () => true,
    place() {},
  };
  const terrain = { height: (x, z) => groundAt(x, z) };
  const cam = createFollowCam(host, terrain, camera, player, { shared, invertY });
  cam.enabled = true;
  cam.snap();
  const elevation = () => {
    const d = camera.getWorldDirection(new THREE.Vector3());
    return (Math.asin(d.y) * 180) / Math.PI;
  };
  const drag = (dy, steps = 20) => {
    host.emit('pointerdown', { clientX: 400, clientY: 300 });
    for (let k = 1; k <= steps; k++) {
      win.emit('pointermove', { clientX: 400, clientY: 300 + (dy * k) / steps });
      cam.update(1 / 30);
    }
    win.emit('pointerup', {});
    for (let i = 0; i < 30; i++) cam.update(1 / 30);
  };
  return { cam, camera, player, host, face, elevation, drag, input: () => input };
}

const deg = (r) => (r * 180) / Math.PI;
/** wrap an angle difference (rad) into (−π, π] */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** 1/6 s is a whole number of frames at 30, 60 and 144 Hz: segments and samples fall on the same instants at every rate */
const TICK = 1 / 6;
/**
 * Drive a fresh rig through `script` (a list of [ticks of TICK s, gamepad axes | null, heading or
 * undefined]) at `hz`, sampling the view every tick: [yaw, pitch] (rad).
 */
function runAt(hz, script) {
  const r = rig();
  const dt = 1 / hz;
  const perTick = Math.round(hz * TICK);
  const samples = [];
  for (const [ticks, axes, heading] of script) {
    pad.value = axes ? { connected: true, axes, buttons: [] } : null;
    if (heading !== undefined) r.face.heading = heading;
    for (let k = 0; k < ticks; k++) {
      for (let f = 0; f < perTick; f++) r.cam.update(dt);
      const s = r.cam.state();
      samples.push([s.yaw, s.pitch]);
    }
  }
  pad.value = null;
  return { r, samples };
}
const worstApart = (a, b) => {
  let worst = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) worst = Math.max(worst, Math.abs(wrap(a[i][0] - b[i][0])), Math.abs(a[i][1] - b[i][1]));
  return deg(worst);
};

test('the rest pose is the reference: 4.3 m behind, 1.75 m up, 3.3° down at the aim over Link', () => {
  const { camera, elevation } = rig();
  // heading π: Link faces −z, the camera stands at +z
  assert.ok(Math.abs(camera.position.x) < 1e-6);
  assert.ok(Math.abs(camera.position.z - FOLLOW.distance) < 1e-6, `z ${camera.position.z}`);
  assert.ok(Math.abs(camera.position.y - FOLLOW.eyeHeight) < 1e-6, `y ${camera.position.y}`);
  assert.ok(Math.abs(elevation() - (PITCH_REST * 180) / Math.PI) < 0.01, `elevation ${elevation()}`);
  assert.ok(Math.abs(elevation() + 3.33) < 0.05);
});

test('dragging up looks up — to 60°, the camera staying over the ground and nearer — and dragging down looks down to 35°', () => {
  const r = rig();
  r.drag(-900);
  assert.ok(r.elevation() > 58, `up ${r.elevation()}`);
  assert.ok(r.camera.position.y >= CLEARANCE - 1e-6, `camera y ${r.camera.position.y}`);
  const back = Math.hypot(r.camera.position.x, r.camera.position.z);
  assert.ok(back > 2.4 && back < 3.4, `camera ${back} m back at full look-up`);
  r.drag(1800);
  assert.ok(r.elevation() < -34 && r.elevation() > -36.5, `down ${r.elevation()}`);
  assert.ok(r.camera.position.y < 4.2, `camera y ${r.camera.position.y} looking down`);
  assert.equal(PITCH_UP, 1.05);
  assert.equal(PITCH_DOWN, -0.62);
});

test('?invertY=1 keeps the old direction (drag up looks down)', () => {
  const r = rig({ invertY: true });
  r.drag(-300);
  assert.ok(r.elevation() < -10, `inverted drag up → ${r.elevation()}`);
});

test('the right stick looks: up looks up, and the view settles back to rest while Link walks without look input', () => {
  const r = rig();
  pad.value = { connected: true, axes: [0, 0, 0, -1], buttons: [] };
  for (let i = 0; i < 45; i++) r.cam.update(1 / 30);
  pad.value = { connected: true, axes: [0, -1, 0, 0], buttons: [] };
  const looked = r.elevation();
  assert.ok(looked > 40, `stick up → ${looked}`);
  // walking (left stick forward) for 5 s with no look input: recentres after 1.5 s
  for (let i = 0; i < 150; i++) r.cam.update(1 / 30);
  pad.value = null;
  assert.ok(Math.abs(r.elevation() + 3.33) < 1.5, `recentred to ${r.elevation()}`);
});

test('the same stick input gives the same view at 30, 60 and 144 frames a second', () => {
  // right stick up-right for 1 s, released for 1 s
  const script = [
    [6, [0, 0, 0.7, -0.8]],
    [6, null],
  ];
  const [a, b, c] = [30, 60, 144].map((hz) => runAt(hz, script).samples);
  // after the release every rate rests at the same view (the stick integrates rate × dt exactly)
  for (const [x, name] of [[b, '60'], [c, '144']]) {
    const end = x[x.length - 1];
    const ref = a[a.length - 1];
    assert.ok(deg(Math.abs(wrap(end[0] - ref[0]))) < 0.05 && deg(Math.abs(end[1] - ref[1])) < 0.05, `${name} Hz ends ${deg(end[0]).toFixed(3)}° / ${deg(end[1]).toFixed(3)}° vs 30 Hz ${deg(ref[0]).toFixed(3)}° / ${deg(ref[1]).toFixed(3)}°`);
  }
  // on the way the look smoothing's lag differs by at most a frame's worth of the turn
  assert.ok(worstApart(a, c) < 1.5, `30 vs 144 Hz trajectories ${worstApart(a, c).toFixed(2)}° apart`);
  assert.ok(worstApart(b, c) < 0.75, `60 vs 144 Hz trajectories ${worstApart(b, c).toFixed(2)}° apart`);
});

test('walking without look input: the camera swings behind Link and the pitch recentres at the same pace at 30, 60 and 144 Hz', () => {
  // look up with the stick for 0.5 s, then walk (left stick forward) while Link turns 90° to his left
  const script = [
    [3, [0, 0, 0, -1]],
    [3, [0, -1, 0, 0]],
    [6, [0, -1, 0, 0], Math.PI * 0.75],
    [18, [0, -1, 0, 0], Math.PI * 0.5],
  ];
  const [a, b, c] = [30, 60, 144].map((hz) => runAt(hz, script).samples);
  // the recentre starts at the same instant at every rate (sub-frame onset); what differs is the
  // look smoothing's lag behind a 50°/s swing, about a degree at 30 Hz
  assert.ok(worstApart(a, c) < 1.5, `30 vs 144 Hz ${worstApart(a, c).toFixed(3)}° apart`);
  assert.ok(worstApart(b, c) < 0.75, `60 vs 144 Hz ${worstApart(b, c).toFixed(3)}° apart`);
  const endA = a[a.length - 1];
  const endC = c[c.length - 1];
  assert.ok(deg(Math.abs(wrap(endA[0] - endC[0]))) < 0.05 && deg(Math.abs(endA[1] - endC[1])) < 0.05, `ends ${deg(endA[0]).toFixed(3)}° / ${deg(endA[1]).toFixed(3)}° vs ${deg(endC[0]).toFixed(3)}° / ${deg(endC[1]).toFixed(3)}°`);
  // and it did recentre: behind the new heading, back near the rest pitch
  assert.ok(deg(Math.abs(wrap(endC[0] - Math.PI * 0.5))) < 3, `yaw ${deg(endC[0]).toFixed(1)}° behind a 90° heading`);
  assert.ok(Math.abs(deg(endC[1]) - deg(PITCH_REST)) < 3, `pitch ${deg(endC[1]).toFixed(1)}° after 3 s of walking`);
});

test('one mouse drag lands on the same view whether it arrives in 5 or 50 events', () => {
  const views = [5, 50].map((steps) => {
    const r = rig();
    r.host.emit('pointerdown', { clientX: 400, clientY: 300 });
    for (let k = 1; k <= steps; k++) win.emit('pointermove', { clientX: 400 + (240 * k) / steps, clientY: 300 - (180 * k) / steps });
    win.emit('pointerup', {});
    for (let i = 0; i < 60; i++) r.cam.update(1 / 60);
    const s = r.cam.state();
    return [s.yaw, s.pitch];
  });
  assert.ok(Math.abs(views[0][0] - views[1][0]) < 1e-9 && Math.abs(views[0][1] - views[1][1]) < 1e-9, `5 events ${views[0]} vs 50 events ${views[1]}`);
});

test('a solid wall behind Link pulls the camera in front of it at once, and never lets it stand inside', () => {
  // a 6 × 6 m wall 2.5 m behind Link (Link faces −z: the camera is at +z)
  const box = new THREE.Box3(new THREE.Vector3(-4, -1, 1), new THREE.Vector3(4, 6, 4));
  const grid = new VoxelGrid(box, 0.25);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let x = -3; x < 3; x += 0.5) {
    for (let y = 0; y < 5; y += 0.5) {
      grid.addTriangle(a.set(x, y, 2.5), b.set(x + 0.5, y, 2.5), c.set(x, y + 0.5, 2.5));
      grid.addTriangle(a.set(x + 0.5, y, 2.5), b.set(x + 0.5, y + 0.5, 2.5), c.set(x, y + 0.5, 2.5));
    }
  }
  grid.dilate(1);
  const r = rig({ shared: { cameraSolids: { solid: grid, slim: null } } });
  const p = r.camera.position;
  assert.ok(p.z < 2.5 - 0.2, `camera z ${p.z} stays in front of the wall at 2.5`);
  assert.ok(!grid.hasPoint(p.x, p.y, p.z), 'camera outside the grown wall');
  assert.equal(r.cam.state().hit, 'solid');
  // orbit around: the camera never enters the wall's grown cells
  r.host.emit('pointerdown', { clientX: 0, clientY: 0 });
  for (let k = 1; k <= 60; k++) {
    win.emit('pointermove', { clientX: k * 20, clientY: 0 });
    r.cam.update(1 / 30);
    assert.ok(!grid.hasPoint(r.camera.position.x, r.camera.position.y, r.camera.position.z), `inside the wall at step ${k}`);
  }
  win.emit('pointerup', {});
});

test('a slim post at the camera moves it in along the line; a ridge behind Link lifts it over', () => {
  const r = rig({ shared: { slimTrunks: [{ x: 0, z: 4.3, r: 0.25, y0: -1, y1: 8 }] } });
  const d = Math.hypot(r.camera.position.x, r.camera.position.z);
  assert.ok(d < 4.3 - 0.5, `pushed in to ${d}`);
  assert.ok(r.cam.state().slimPush > 0.4);
  // the line aim (1.5 m) → camera (1.75 m, 4.3 m back) passes 1.65 m over z 2.5: a 1.6 m ridge cuts it
  const ridge = rig({ groundAt: (x, z) => (z > 1.5 && z < 3.5 ? 1.6 : 0) });
  const st = ridge.cam.state();
  assert.ok(st.lift > 0.2, `lift ${st.lift}`);
  assert.ok(ridge.camera.position.y > FOLLOW.eyeHeight + 0.2, `camera y ${ridge.camera.position.y}`);
});
