/**
 * Run: node --test src/camera/walls.test.mjs (Node 20+, no browser needed).
 *
 * The play camera beside solid walls (collision.ts, follow.ts): a line that only grazes a wall's
 * grown cells is not blocked, one through the wall is; round walls given exactly (the north grove's
 * huts, structures/cameraSolids.ts `walls`) block to their surface; walking round a round wall on
 * the deck that rings it (the stilt house's veranda) and turning hard, the camera never pops.
 */
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

function listeners() {
  const map = new Map();
  return {
    addEventListener: (t, f) => map.set(t, [...(map.get(t) ?? []), f]),
    removeEventListener: (t, f) => map.set(t, (map.get(t) ?? []).filter((g) => g !== f)),
    emit: (t, e) => (map.get(t) ?? []).forEach((f) => f(e)),
  };
}
const pad = { value: null };
globalThis.window = listeners();
globalThis.document = { pointerLockElement: null };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad.value] }, configurable: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const { createFollowCam } = loadTs(path.join(here, 'follow.ts'));
const { createCameraCollider, CAMERA_RADIUS } = loadTs(path.join(here, 'collision.ts'));
const { VoxelGrid } = loadTs(path.join(here, '../world/util/voxelGrid.ts'));

const flat = () => 0;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** a 10 × 5 m wall in the plane x = 1.1, voxelised at 0.25 m and grown a cell (its core kept), as structures/cameraSolids.ts does */
function planeWall() {
  const grid = new VoxelGrid(new THREE.Box3(v3(-3, -1, -6), v3(4, 6, 6)), 0.25);
  for (let z = -5; z < 5; z += 0.5) {
    for (let y = 0; y < 5; y += 0.5) {
      grid.addTriangle(v3(1.1, y, z), v3(1.1, y, z + 0.5), v3(1.1, y + 0.5, z));
      grid.addTriangle(v3(1.1, y, z + 0.5), v3(1.1, y + 0.5, z + 0.5), v3(1.1, y + 0.5, z));
    }
  }
  grid.dilate(1, true);
  return grid;
}

/** a hut's barrel wall as structures/distantHouse.ts gives it: wobbled, tapering toward the eave */
function barrel({ x = 0, z = 0, R = 1.55, y0 = 0, y1 = 2.35 } = {}) {
  const wallR = (a) => R * (1 + 0.045 * Math.sin(3 * a + 0.7) + 0.02 * Math.sin(7 * a - 0.7));
  return { id: 'barrel', x, z, y0, y1, rMax: R * 1.065 + 0.02, radiusAt: (a, y) => wallR(a) * (1 - 0.06 * Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))) + 0.02 };
}
const insideBarrel = (w, p, pad = 0) => {
  if (p.y < w.y0 - pad || p.y > w.y1 + pad) return false;
  const a = Math.atan2(p.z - w.z, p.x - w.x);
  return Math.hypot(p.x - w.x, p.z - w.z) < w.radiusAt(a, Math.min(Math.max(p.y, w.y0), w.y1)) + pad;
};

test('a line that runs along a wall inside its grown cells keeps its length; one through the wall stops in front of them', () => {
  const grid = planeWall();
  const c = createCameraCollider(flat, { cameraSolids: { solid: grid, slim: null } });
  // Link against the wall (0.25 m off it, in its grown cells), the camera behind him along it
  const along = c.sweep(v3(0.85, 1.5, 0), v3(0.85, 1.75, 4.3));
  assert.equal(along.t, 1, `a line along the wall is cut to ${along.t}`);
  assert.equal(along.hit, null);
  // from open ground across the wall: the camera stays in front of the grown cells (x < 0.75)
  const across = c.sweep(v3(0, 1.5, 0), v3(3, 1.75, 0));
  assert.equal(across.hit, 'solid');
  const at = 3 * across.t;
  assert.ok(at > 0.4 && at <= 0.75, `stopped at x ${at.toFixed(3)} (the grown cells start at 0.75)`);
});

test('a round wall given exactly blocks to its surface: a tangent line passes, a line through it stops outside it, above it is free', () => {
  const w = barrel();
  const c = createCameraCollider(flat, { cameraSolids: { solid: null, slim: null, walls: [w] } });
  // 0.2 m outside the widest bulge, inside the camera's radius of it: not a wall between
  const r = w.rMax + 0.2;
  const tangent = c.sweep(v3(r, 1.5, -2), v3(r, 1.75, 2));
  assert.equal(tangent.t, 1, `a tangent line is cut to ${tangent.t}`);
  // through the barrel: stops outside its grown shell, on Link's side
  const through = c.sweep(v3(2.4, 1.5, 0.1), v3(-2.4, 1.75, 0.1));
  assert.equal(through.hit, 'solid');
  const stop = v3(2.4 - 4.8 * through.t, 1.5 + 0.25 * through.t, 0.1);
  assert.ok(stop.x > 0 && !insideBarrel(w, stop, CAMERA_RADIUS), `stopped at ${stop.x.toFixed(3)}, inside the barrel's grown shell`);
  assert.ok(stop.x > w.rMax, 'on Link\'s side of the wall');
  // over the eave (clear of the camera's radius): nothing to block
  const over = c.sweep(v3(2.4, w.y1 + 0.5, 0), v3(-2.4, w.y1 + 0.5, 0));
  assert.equal(over.t, 1);
});

/**
 * Walk Link at `speed` round a barrel wall on the ring `ringR` m from its centre (the stilt house's
 * veranda walk), steered with the left stick along the ring the way a player holds it, for `laps`
 * laps; returns the camera's worst pop (the change of its per-frame step, m), whether it ever stood
 * in the wall and whether Link was ever behind it.
 */
function ringWalk({ speed, dir = 1, ringR = 2.1, laps = 1.5, hz = 30 } = {}) {
  const w = barrel();
  const host = listeners();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.08, 900);
  const face = { heading: 0 };
  let ang = Math.PI / 2;
  const tangent = () => [-Math.sin(ang) * dir, Math.cos(ang) * dir];
  const player = {
    position: v3(Math.cos(ang) * ringR, 0, Math.sin(ang) * ringR),
    heading: () => face.heading,
    airHeight: () => 0,
    groundHeight: flat,
    surfaceHeight: flat,
    setInput() {},
    setPlayMode() {},
    playMode: () => true,
    place() {},
  };
  const cam = createFollowCam(host, { height: flat }, camera, player, { shared: { cameraSolids: { solid: null, slim: null, walls: [w] } } });
  cam.enabled = true;
  face.heading = Math.atan2(...tangent());
  cam.snap();
  // the stick for a world direction under the camera's yaw (follow.ts: forward (sin, cos) of the yaw, its axial dead zone undone)
  const stickFor = ([dx, dz]) => {
    const yaw = cam.state().yaw;
    const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const raw = (v) => (Math.abs(v) < 1e-6 ? 0 : Math.sign(v) * (Math.abs(v) * 0.82 + 0.18));
    return [raw(right), raw(-fwd)];
  };
  const dt = 1 / hz;
  const frames = Math.ceil((laps * 2 * Math.PI * ringR) / speed / dt);
  const cams = [];
  let inWall = 0;
  let hidden = 0;
  const aim = v3(0, 0, 0);
  const q = v3(0, 0, 0);
  for (let i = 0; i < frames; i++) {
    pad.value = { connected: true, axes: [...stickFor(tangent()), 0, 0], buttons: [] };
    cam.update(dt);
    ang += (dir * speed * dt) / ringR;
    player.position.set(Math.cos(ang) * ringR, 0, Math.sin(ang) * ringR);
    face.heading = Math.atan2(...tangent());
    const p = camera.position.clone();
    cams.push(p);
    if (insideBarrel(w, p)) inWall++;
    aim.set(player.position.x, 1.5, player.position.z);
    const len = aim.distanceTo(p);
    for (let s = 0.05; s < len; s += 0.05) if (insideBarrel(w, q.lerpVectors(aim, p, s / len))) (hidden++, (s = len));
  }
  pad.value = null;
  let pop = 0;
  // from the second lap's quarter on: the snap's own settling is not a pop
  for (let i = Math.round(0.5 / dt); i < cams.length; i++) pop = Math.max(pop, cams[i].clone().sub(cams[i - 1]).sub(cams[i - 1]).add(cams[i - 2]).length());
  return { pop, inWall, hidden, frames };
}

test('walking and running round a hut on its veranda, the camera never pops, never enters the wall and never loses Link behind it', () => {
  for (const speed of [1.6, 3, 4.6]) {
    for (const dir of [1, -1]) {
      const r = ringWalk({ speed, dir });
      const tag = `${speed} m/s ${dir > 0 ? 'anticlockwise' : 'clockwise'}`;
      // the rubric's bound (docs/RUBRIC_50_STRUCTURES.md check 44): no pop over 0.3 m; without the
      // ring goal and the swing's acceleration limit the camera popped 4.0 m here at 3 m/s
      assert.ok(r.pop < 0.3, `${tag}: pop ${r.pop.toFixed(3)} m`);
      assert.equal(r.inWall, 0, `${tag}: ${r.inWall} frames with the camera in the wall`);
      assert.equal(r.hidden, 0, `${tag}: ${r.hidden} frames with the wall between the camera and Link`);
    }
  }
});

test('a right-angle turn swings the camera round without a jump in its turn rate', () => {
  const host = listeners();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.08, 900);
  const face = { heading: Math.PI };
  const player = { position: v3(0, 0, 0), heading: () => face.heading, airHeight: () => 0, groundHeight: flat, surfaceHeight: flat, setInput() {}, setPlayMode() {}, playMode: () => true, place() {} };
  const cam = createFollowCam(host, { height: flat }, camera, player, {});
  cam.enabled = true;
  cam.snap();
  const dt = 1 / 30;
  const cams = [];
  for (let i = 0; i < 120; i++) {
    // walk −z for a second, then turn left at once (+x … the stick held left of the camera's forward) and walk on
    const turned = i >= 30;
    face.heading = turned ? Math.PI / 2 : Math.PI;
    const yaw = cam.state().yaw;
    const [dx, dz] = turned ? [1, 0] : [0, -1];
    const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const raw = (v) => (Math.abs(v) < 1e-6 ? 0 : Math.sign(v) * (Math.abs(v) * 0.82 + 0.18));
    pad.value = { connected: true, axes: [raw(right), raw(-fwd), 0, 0], buttons: [] };
    cam.update(dt);
    player.position.x += dx * 1.6 * dt;
    player.position.z += dz * 1.6 * dt;
    cams.push(camera.position.clone());
  }
  pad.value = null;
  let pop = 0;
  for (let i = 2; i < cams.length; i++) pop = Math.max(pop, cams[i].clone().sub(cams[i - 1]).sub(cams[i - 1]).add(cams[i - 2]).length());
  assert.ok(Math.abs(Math.atan2(Math.sin(cam.state().yaw - Math.PI / 2), Math.cos(cam.state().yaw - Math.PI / 2))) < 0.1, `swung behind the new heading (yaw ${cam.state().yaw.toFixed(3)})`);
  // Link's own change of step at the turn is 1.6 m/s × √2 / 30 = 0.075 m; the swing adds at most
  // SWING_ACCEL (75 m/s²) × dt² = 0.083 m to it (0.094 m measured; without the limit, 0.171 m)
  assert.ok(pop < 0.13, `worst change of the camera's per-frame step ${pop.toFixed(3)} m`);
});
