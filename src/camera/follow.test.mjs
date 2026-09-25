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
globalThis.HTMLInputElement = class {};
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad.value] }, configurable: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const { createFollowCam, PITCH_REST, PITCH_UP, PITCH_DOWN, FOLLOW } = loadTs(path.join(here, 'follow.ts'));
const { CLEARANCE, CAMERA_RADIUS, MIN_DISTANCE } = loadTs(path.join(here, 'collision.ts'));
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

/** Link walks 4 m forward past a slim bole 2 m behind him: the camera, following, runs into it from its far side */
function walkPastBole() {
  const r = rig({ shared: { slimTrunks: [{ x: 0, z: 2.0, r: 0.35, y0: -1, y1: 8 }] }, heading: Math.PI });
  let prev = r.camera.position.clone();
  let worst = 0;
  let deepest = 0;
  for (let i = 0; i < 80; i++) {
    r.player.position.z -= 1.5 / 30;
    r.cam.update(1 / 30);
    worst = Math.max(worst, r.camera.position.distanceTo(prev) - 1.5 / 30);
    deepest = Math.max(deepest, r.cam.state().slimPush);
    prev = r.camera.position.clone();
  }
  return { worst, deepest };
}

test('walking past a slim bole, the camera eases in along its line and back out — no jump in a frame', () => {
  const { worst, deepest } = walkPastBole();
  // entering the 0.65 m cylinder from its far side asks for the whole 1.3 m chord at once
  assert.ok(deepest > 0.5, `the camera did move in past the bole (${deepest.toFixed(2)} m)`);
  assert.ok(worst < 0.35, `largest extra camera step in one frame ${worst.toFixed(3)} m (the chord is 1.3 m)`);
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

/**
 * exp-south2: the bridge keeper's hut publishes its wall and dome as one exact round wall
 * (structures/expansionSouthDwellings.ts → shared.cameraSolids.walls): a cylinder of 1.29 m whose
 * gallery Link walks 1.30–1.99 m from its axis. Link faces −z, the camera stands at +z.
 */
const HUT = { r: 1.29, y0: -0.1, y1: 3 };
const keeperWall = ({ r, y0, y1, x, z }) => ({ id: 'south-keeper', x, z, y0, y1, rMax: r, radiusAt: () => r });
const walls = (...list) => ({ cameraSolids: { solid: null, slim: null, walls: list.map(keeperWall) } });

test('the keeper\'s wall: walking its gallery (Link 1.7 m out, facing along it) the camera keeps its whole line', () => {
  const r = rig({ shared: walls({ ...HUT, x: -1.7, z: 0 }) });
  const p = r.camera.position;
  assert.ok(p.z > FOLLOW.distance - 0.05, `camera ${p.z.toFixed(3)} m back (the rest is ${FOLLOW.distance})`);
  assert.equal(r.cam.state().hit, null);
});

test('the keeper\'s wall across the line stops the camera outside its camera radius', () => {
  // the line (x 0, toward +z) runs 0.3 m deep through a 0.8 m wall (a tangent line would pass)
  const wall = { ...HUT, r: 0.8, x: -0.5, z: 2.2 };
  const r = rig({ shared: walls(wall) });
  const p = r.camera.position;
  const fromAxis = Math.hypot(p.x - wall.x, p.z - wall.z);
  assert.ok(fromAxis >= wall.r + CAMERA_RADIUS - 1e-3, `camera ${fromAxis.toFixed(3)} m from the axis (wall ${wall.r} + ${CAMERA_RADIUS})`);
  assert.ok(p.z < 2.2, `camera z ${p.z.toFixed(3)} stays on Link's side`);
  assert.equal(r.cam.state().hit, 'solid');
});

test('Link against the keeper\'s wall, facing away from it: the line into it is refused — the camera does not pass through', () => {
  // 1.35 m from the axis: inside the wall's grown shell (1.59 m)
  const r = rig({ shared: walls({ ...HUT, x: 0, z: 1.35 }) });
  const aim = new THREE.Vector3(0, FOLLOW.aimHeight, 0);
  const d = r.camera.position.distanceTo(aim);
  assert.ok(d < MIN_DISTANCE + 0.05, `camera ${d.toFixed(3)} m from the aim: at its minimum (${MIN_DISTANCE}), not through the hut`);
  assert.equal(r.cam.state().hit, 'solid');
});

test('a line grazing the keeper\'s wall inside the camera radius keeps its whole length', () => {
  // the line (x 0, toward +z) passes 0.2 m off a 0.8 m wall; the camera, 4.3 m back, is 1.2 m off it
  const wall = { ...HUT, r: 0.8, x: -1.0, z: 2.2 };
  assert.ok(1.0 - wall.r < CAMERA_RADIUS);
  const r = rig({ shared: walls(wall) });
  assert.ok(r.camera.position.z > FOLLOW.distance - 0.05, `camera ${r.camera.position.z.toFixed(3)} m back`);
  assert.equal(r.cam.state().hit, null);
});

/**
 * Walking round the keeper's hut as the play-test steers (gauntlet/scripts/playtest.mjs walkRoute:
 * the movement keys chosen against the camera every 3 frames, waypoints on the gallery 20–40° apart,
 * reached within 0.5 m) — Link turns at 9 rad/s and slides round the hut's walk block 1.4 m from its
 * axis. A camera straight behind him trailed his turns by up to 45°, its line cut the wall and it
 * snapped in 3.87 m in one frame (the m8 walk: 3.863 m); on a hut's ring it trails him along it.
 */
function walkRoundHut(speed, reverse = false) {
  const r = rig({ shared: walls({ ...HUT, x: 0, z: 0 }) });
  const at = (th, rr) => [Math.cos((th * Math.PI) / 180) * rr, Math.sin((th * Math.PI) / 180) * rr];
  const points = [at(222, 2.69), at(221, 2.0), at(200, 1.7), at(170, 1.7), at(135, 1.7), at(100, 1.7), at(60, 1.7), at(20, 1.7), at(-8, 1.7), at(-20.5, 1.86), at(-21.8, 2.42)];
  if (reverse) points.reverse();
  const p = r.player.position;
  p.set(points[0][0], 0, points[0][1]);
  r.face.heading = Math.atan2(points[1][0] - p.x, points[1][1] - p.z);
  r.cam.snap();
  const keys = new Set();
  const setKeys = (want) => {
    for (const k of [...keys]) if (!want.has(k)) (win.emit('keyup', { code: k, target: null }), keys.delete(k));
    for (const k of want) if (!keys.has(k)) (win.emit('keydown', { code: k, target: null }), keys.add(k));
  };
  const dt = 1 / 30;
  let v = 0;
  const aim = new THREE.Vector3();
  let nearest = Infinity;
  let nearestAxis = Infinity;
  let hidden = 0;
  const cams = [];
  const q = new THREE.Vector3();
  let wp = 1;
  let frames = 0;
  while (wp < points.length && frames < 900) {
    const [tx, tz] = points[wp];
    const dist = Math.hypot(tx - p.x, tz - p.z);
    if (dist < 0.5) {
      wp++;
      continue;
    }
    const dir = r.camera.getWorldDirection(new THREE.Vector3());
    const c = Math.atan2(dir.x, dir.z);
    const a = ((tx - p.x) * Math.sin(c) + (tz - p.z) * Math.cos(c)) / dist;
    const b = ((tx - p.x) * -Math.cos(c) + (tz - p.z) * Math.sin(c)) / dist;
    setKeys(new Set([a > 0.38 && 'KeyW', a < -0.38 && 'KeyS', b > 0.38 && 'KeyD', b < -0.38 && 'KeyA'].filter(Boolean)));
    for (let f = 0; f < 3; f++, frames++) {
      r.cam.update(dt);
      // the character controller (character/index.ts): turn toward the input at 9 rad/s, ramp the speed
      const { moveX, moveZ } = r.input();
      const mag = Math.hypot(moveX, moveZ);
      if (mag > 0.05) {
        const turn = wrap(Math.atan2(moveX, moveZ) - r.face.heading);
        r.face.heading += Math.max(-9 * dt, Math.min(9 * dt, turn));
        v += Math.max(-16 * dt, Math.min(9 * dt, speed * mag - v));
        p.x += (moveX / mag) * v * dt;
        p.z += (moveZ / mag) * v * dt;
        const hr = Math.hypot(p.x, p.z);
        if (hr < 1.4) p.set((p.x / hr) * 1.4, 0, (p.z / hr) * 1.4);
      }
      const d = r.camera.position.distanceTo(aim.set(p.x, FOLLOW.aimHeight, p.z));
      if (Math.hypot(p.x, p.z) < 2.1) nearest = Math.min(nearest, d);
      nearestAxis = Math.min(nearestAxis, Math.hypot(r.camera.position.x, r.camera.position.z));
      cams.push(r.camera.position.clone());
      for (let s = 0.05; s < d; s += 0.05) if (Math.hypot(q.lerpVectors(aim, r.camera.position, s / d).x, q.z) < HUT.r) (hidden++, (s = d));
    }
  }
  setKeys(new Set());
  // the change of the camera's per-frame step (walls.test.mjs's pop), after the snap has settled
  let pop = 0;
  for (let i = 15; i < cams.length; i++) pop = Math.max(pop, cams[i].clone().sub(cams[i - 1]).sub(cams[i - 1]).add(cams[i - 2]).length());
  return { reached: wp - 1, of: points.length - 1, pop, nearest, nearestAxis, hidden };
}

test('walking and running round the keeper\'s wall as the play-test steers, the camera trails him along it — it never snaps in', () => {
  for (const speed of [1.6, 3, 4.6]) {
    for (const reverse of [false, true]) {
      const w = walkRoundHut(speed, reverse);
      const at = `at ${speed} m/s${reverse ? ', the other way' : ''}`;
      assert.equal(w.reached, w.of, `${at}: waypoints ${w.reached}/${w.of}`);
      // the rubric's bound (docs/RUBRIC_50_STRUCTURES.md check 44)
      assert.ok(w.pop < 0.3, `${at}: pop ${w.pop.toFixed(3)} m`);
      assert.ok(w.nearestAxis > HUT.r, `${at}: the camera ${w.nearestAxis.toFixed(2)} m from the hut's axis`);
      assert.equal(w.hidden, 0, `${at}: ${w.hidden} frames with the wall between the camera and Link`);
      // walking and jogging it keeps its whole line (a camera straight behind him came within 0.64 m);
      // running the 1.7 m ring at 2.7 rad/s it eases in ahead of the wall instead
      if (speed <= 3) assert.ok(w.nearest > 4.0, `${at}: the camera came within ${w.nearest.toFixed(2)} m of Link on the gallery`);
    }
  }
});

/**
 * The owner, 2026-09-23 23:00: "whenever I walk up or down the stairs, it glitches the frames like
 * up and forth every each step." The walked surface is a staircase, so every input that reads it
 * raw steps once per tread; the camera's aim, its floor and the collider's lift are eased against
 * that (follow.ts AIM_TAU / FLOOR_TAU / LIFT_TAU). This walks a flight at run speed and measures
 * the per-frame ripple — the rms SECOND difference, which is ~0 for a steady glide and large for a
 * saw-tooth. Before the easing: climbing 1.22°/frame of pitch ripple and 2.26° peak-to-peak;
 * descending 1.40°, 4.62° peak-to-peak and 237 mm of height in a single frame.
 */
function climbFlight({ down = false, tread = 0.3, riser = 0.17, steps = 22, speed = 3.4 } = {}) {
  const groundAt = (x, z) => {
    const u = -z;
    return u <= 0 ? 0 : Math.min(steps, Math.floor(u / tread)) * riser;
  };
  const r = rig({ groundAt, heading: down ? 0 : Math.PI });
  const dt = 1 / 60;
  const start = down ? -(steps * tread) : 0;
  r.player.position.set(0, groundAt(0, start), start);
  r.cam.snap();
  const ys = [];
  const pitches = [];
  for (let i = 0; i < 260; i++) {
    const z = start + (down ? 1 : -1) * speed * dt * i;
    r.player.position.set(0, groundAt(0, z), z);
    r.cam.update(dt);
    const u = -z;
    if (u < tread * 2 || u > (steps - 2) * tread) continue;
    ys.push(r.camera.position.y);
    const d = r.camera.getWorldDirection(new THREE.Vector3());
    pitches.push((Math.asin(d.y) * 180) / Math.PI);
  }
  const diffs = (a) => a.slice(1).map((v, i) => v - a[i]);
  const ripple = (a) => {
    const dd = diffs(diffs(a));
    return Math.sqrt(dd.reduce((s, v) => s + v * v, 0) / dd.length);
  };
  const span = (a) => {
    const d = diffs(a);
    return Math.max(...d) - Math.min(...d);
  };
  return { frames: ys.length, climb: (ys.at(-1) - ys[0]) / ys.length, yRipple: ripple(ys), ySpan: span(ys), pitchRipple: ripple(pitches), pitchSpan: span(pitches) };
}

test('climbing a flight at run speed, the camera glides — no per-riser step in height or pitch', () => {
  const up = climbFlight();
  assert.ok(up.frames > 60, `frames sampled ${up.frames}`);
  assert.ok(up.climb > 0.02, `the camera still climbs with the flight (${up.climb.toFixed(4)} m/frame)`);
  // before the easing: 0.0034 m of height ripple and 1.217 deg of pitch ripple. The orbit height
  // follows the eased AIM rather than the raw surface, so two lags in series make the climb rate
  // itself smooth: 0.00051 m.
  assert.ok(up.yRipple < 0.0015, `height ripple ${up.yRipple.toFixed(5)} m/frame (was 0.0034)`);
  assert.ok(up.pitchRipple < 0.25, `pitch ripple ${up.pitchRipple.toFixed(5)} deg/frame (was 1.22)`);
  assert.ok(up.pitchSpan < 0.8, `pitch peak-to-peak ${up.pitchSpan.toFixed(4)} deg/frame (was 2.26)`);
});

test('descending a flight at run speed, the camera never drops a riser in one frame', () => {
  const dn = climbFlight({ down: true });
  assert.ok(dn.frames > 60, `frames sampled ${dn.frames}`);
  assert.ok(dn.climb < -0.01, `the camera still descends with the flight (${dn.climb.toFixed(4)} m/frame)`);
  // before the easing: 0.0564 m ripple, 0.2365 m peak-to-peak — a whole 0.17 m riser inside a frame
  assert.ok(dn.yRipple < 0.012, `height ripple ${dn.yRipple.toFixed(5)} m/frame (was 0.056)`);
  assert.ok(dn.ySpan < 0.09, `height peak-to-peak ${dn.ySpan.toFixed(4)} m/frame (was 0.237, the riser is 0.17)`);
  assert.ok(dn.pitchRipple < 0.3, `pitch ripple ${dn.pitchRipple.toFixed(5)} deg/frame (was 1.40)`);
  assert.ok(dn.pitchSpan < 1.4, `pitch peak-to-peak ${dn.pitchSpan.toFixed(4)} deg/frame (was 4.62)`);
});
