/** Real simulation replays and rig contacts; Node 20+, no renderer required. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url), modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} }; modules.set(file, mod);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', js)(
    (id) => id === 'three' ? THREE : id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id), mod, mod.exports);
  return mod.exports;
}
const { createLocomotion, MOVE } = load(path.join(here, 'locomotion.ts'));
const { createPlayPose } = load(path.join(here, 'play-pose.ts'));
const { buildRig, LINK_PROPORTIONS } = load(path.join(here, 'rig.ts'));
const { buildLegs } = load(path.join(here, 'link.ts'));
const { applyPose } = load(path.join(here, 'animation.ts'));
const { sweep } = load(path.join(here, 'geometry.ts'));

// FrontSide character surfaces must face out: otherwise only interior walls of
// hair, cap tails and thumbs survive backface culling, despite valid positions.
for (const direction of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 2, -3).normalize()]) {
  const geometry = sweep([new THREE.Vector3(), direction.clone().multiplyScalar(2)], [0.2, 0.2], {
    segments: 8, radial: 12, closeStart: true, closeTip: true, flatten: 0.38, crease: 0.12,
  });
  const positions = geometry.getAttribute('position'), indices = geometry.getIndex();
  for (let i = 0; i < indices.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, indices.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(positions, indices.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(positions, indices.getX(i + 2));
    const centre = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const normal = b.sub(a).cross(c.sub(a));
    assert.ok(normal.lengthSq() > 1e-14, 'sweep has no degenerate triangles');
    const along = centre.dot(direction);
    const outward = along < 1e-6 ? direction.clone().negate() : along > 2 - 1e-6 ? direction : centre.clone().addScaledVector(direction, -along);
    assert.ok(normal.dot(outward) > 0, `sweep triangle ${i / 3} faces out, including closed ends`);
  }
  geometry.dispose();
}
const flat = { height: () => 0, blocked: () => false, onStairs: () => false };
const input = (moveX = 0, moveZ = 0, run = false, jump = false) => ({ moveX, moveZ, run, jump });
const near = (a, b, tolerance, name) => assert.ok(Math.abs(a - b) <= tolerance, `${name}: ${a} vs ${b}`);
function advance(c, seconds, i, hz = 120) { for (let n = 0; n < seconds * hz; n++) c.update(1 / hz, i); return c.state; }

// Timed commands aligned to all frame rates. Same simulation state, not just similar speed.
function replay(hz) {
  const c = createLocomotion(flat, 0, 0, 0);
  advance(c, 1, input(0, 1), hz);
  advance(c, 1, input(0, 1, true), hz);
  advance(c, 0.5, input(0, 1, true, true), hz);
  advance(c, 0.5, input(0, 1, true), hz);
  advance(c, 1, input(), hz);
  return { ...c.state };
}
const baseline = replay(120);
for (const hz of [30, 60, 144]) {
  const actual = replay(hz);
  for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'phase', 'runWeight']) near(actual[field], baseline[field], 1e-8, `${hz}Hz ${field}`);
  assert.equal(actual.grounded, true); assert.equal(actual.jumps, 1);
}
const cardinal = createLocomotion(flat, 0, 0), diagonal = createLocomotion(flat, 0, 0);
advance(cardinal, 2, input(0, 1, true)); advance(diagonal, 2, input(50, 50, true));
near(Math.hypot(diagonal.state.x, diagonal.state.z), cardinal.state.z, 1e-8, 'diagonal speed normalized');
assert.ok(diagonal.state.speed <= MOVE.runSpeed + 1e-9);

const hop = createLocomotion(flat, 0, 0);
let apex = 0, landedAt = 0;
for (let i = 0; i < 360; i++) {
  const s = hop.update(1 / 120, input(0, 0, false, true));
  apex = Math.max(apex, s.y);
  if (!landedAt && i > 1 && s.grounded) landedAt = (i + 1) / 120;
  assert.ok(s.y >= 0, 'never penetrates floor');
}
near(apex, MOVE.jumpSpeed ** 2 / (2 * MOVE.gravity), 0.001, 'ballistic jump apex');
near(landedAt, 2 * MOVE.jumpSpeed / MOVE.gravity, 1 / 120, 'flight time');
assert.equal(hop.state.jumps, 1, 'holding Space cannot auto-hop');
hop.update(1 / 120, input()); hop.update(1 / 120, input(0, 0, false, true));
assert.equal(hop.state.jumps, 2, 'release and press starts next jump');
hop.update(1 / 120, input()); hop.update(1 / 120, input(0, 0, false, true));
assert.equal(hop.state.jumps, 2, 'no airborne double jump');

const buffered = createLocomotion(flat, 0, 0);
advance(buffered, 0.5, input(0, 0, false, true));
advance(buffered, 0.05, input());
advance(buffered, 0.3, input(0, 0, false, true));
assert.equal(buffered.state.jumps, 2, 'late airborne press buffers through landing');

const wall = { ...flat, blocked: (x, z) => x >= 1 && x < 1.025 };
for (const thickness of [0.005, 0.01]) {
  const c = createLocomotion({ ...flat, blocked: x => x >= 1 && x < 1 + thickness }, 0, 0);
  advance(c, 3, input(1, 0, true));
  assert.ok(c.state.x <= 1 - MOVE.radius, `${thickness}m wall sweep`);
}
const slide = createLocomotion(wall, 0, 0);
advance(slide, 2, input(1, 1, true));
assert.ok(slide.state.x <= 1 - MOVE.radius, 'body radius cannot tunnel through thin wall');
assert.ok(slide.state.z > 3, 'slides along wall');
advance(slide, 1, input(1, 0, true));
assert.equal(slide.state.speed, 0, 'blocked movement resolves to zero speed');
assert.ok(slide.state.moveWeight < 0.001, 'blocked animation settles to idle');

const stair = { ...flat, height: (x, z) => Math.max(0, Math.min(4, Math.floor(z / 0.42))) * 0.24, onStairs: () => true };
const climb = createLocomotion(stair, 0, 0);
for (let i = 0; i < 300; i++) {
  const s = climb.update(1 / 120, input(0, 1));
  assert.ok(s.grounded); near(s.y, stair.height(s.x, s.z), 1e-10, 'stairs contact');
}
near(climb.state.y, 0.96, 1e-10, 'four steps climbed');
advance(climb, 3, input(0, -1)); near(climb.state.y, 0, 1e-10, 'steps descended');

const cliff = { ...flat, height: (x, z) => z < 1 ? 1 : 0 };
const fall = createLocomotion(cliff, 0, 0);
let airborne = false;
for (let i = 0; i < 300; i++) {
  const s = fall.update(1 / 120, input(0, 1));
  if (s.z >= 1 && !s.grounded) { airborne = true; assert.ok(s.y > 0); }
}
assert.ok(airborne, 'walk off ledge falls instead of snapping down'); near(fall.state.y, 0, 1e-10, 'cliff landing');

const steep = { ...flat, height: (x, z) => Math.max(0, z - 1) * 4 };
const slope = createLocomotion(steep, 0, 0);
advance(slope, 3, input(0, 1, true)); assert.ok(slope.state.z < 1.1, 'cannot climb steep wall using small frame steps');

// Controller phase never restarts when Shift changes, and halted tabs cannot teleport Link.
const transition = createLocomotion(flat, 0, 0);
advance(transition, 1, input(0, 1)); const before = transition.state.phase;
transition.update(1 / 120, input(0, 1, true));
assert.ok(transition.state.phase > before && transition.state.phase - before < 0.04);
const zBefore = transition.state.z; transition.update(30, input(0, 1, true));
assert.ok(transition.state.z - zBefore <= MOVE.runSpeed * MOVE.maxCatchUp);
transition.reset(0, 0, 0); near(transition.state.speed, 0, 0, 'reset velocity');
transition.update(NaN, input()); transition.update(1 / 60, input(NaN, Infinity));
assert.ok(Object.values(transition.state).every(v => typeof v !== 'number' || Number.isFinite(v)));

// Test actual Three.js joint positions and world-space soles, not just target metadata.
const rig = buildRig(LINK_PROPORTIONS, 'link-test'), poses = createPlayPose(rig, flat.height);
const walk = createLocomotion(flat, 0, 0, 0);
let worstContact = 0, lowestSole = Infinity;
for (let i = 0; i < 600; i++) {
  const s = walk.update(1 / 120, input(0, 1, i > 300));
  poses.update(s, i / 120);
  for (const [j, ankle] of [rig.ankleL, rig.ankleR].entries()) {
    const sole = rig.sole.clone(); ankle.localToWorld(sole);
    worstContact = Math.max(worstContact, sole.distanceTo(poses.contacts[j]));
    lowestSole = Math.min(lowestSole, sole.y);
  }
}
assert.ok(worstContact < 0.035, `world sole target error ${worstContact} m`);
assert.ok(lowestSole > -0.005, `sole under ground ${lowestSole}`);

// Contact state uses the same fixed steps as physics, including turns and stopping mid-swing.
function contactReplay(surface, hz, commands = [[2, input(0, 1)], [1, input(0, 1, true)], [1, input(0, -1)], [1, input()]]) {
  const r = buildRig(LINK_PROPORTIONS, 'contact-test'), p = createPlayPose(r, surface.height);
  const c = createLocomotion(surface, 0, 0, 0);
  // Read the actual authored boot meshes. A centre point alone missed toes passing
  // 23.5 cm through a stair riser despite perfect solver/target agreement.
  const material = new THREE.MeshStandardMaterial();
  buildLegs(r, { skin: material, boot: material, cuff: null, shaftTop: 0.135 });
  const soleMeshes = [r.ankleL, r.ankleR].map(a => a.getObjectByName('boot-sole'));
  const soleVertices = soleMeshes.map(mesh => {
    const positions = mesh.geometry.attributes.position;
    const vertices = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i));
    const bottom = Math.min(...vertices.map(v => v.y));
    return vertices.filter(v => Math.abs(v.y - bottom) < 1e-7);
  });
  let error = 0, penetration = 0, jump = 0, bootPenetration = 0, pelvisJump = 0, settledHover = 0;
  const hip = new THREE.Vector3(), oldHip = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const old = [new THREE.Vector3(), new THREE.Vector3()]; let first = true;
  for (const [seconds, command] of commands) {
    for (let n = 0; n < seconds * hz; n++) c.update(1 / hz, command, (s, dt) => {
      p.update(s, s.time, dt);
      [r.ankleL, r.ankleR].forEach((ankle, j) => {
        const sole = r.sole.clone(); ankle.localToWorld(sole);
        error = Math.max(error, sole.distanceTo(p.contacts[j]));
        penetration = Math.max(penetration, surface.height(sole.x, sole.z) - sole.y);
        if (!first) jump = Math.max(jump, sole.distanceTo(old[j]));
        old[j].copy(sole);
        let highestSupport = -Infinity;
        for (const v of soleVertices[j]) {
          soleMeshes[j].localToWorld(corner.copy(v));
          const h = surface.height(corner.x, corner.z);
          bootPenetration = Math.max(bootPenetration, h - corner.y);
          highestSupport = Math.max(highestSupport, h);
        }
        const phase = ((s.phase + j * 0.5) % 1 + 1) % 1;
        const duty = 0.52 - 0.16 * s.runWeight;
        if (s.grounded && s.moveWeight > 0.9 && phase > 0.05 && phase < duty) {
          settledHover = Math.max(settledHover, sole.y - highestSupport);
        }
      });
      r.hips.getWorldPosition(hip);
      if (!first) pelvisJump = Math.max(pelvisJump, hip.distanceTo(oldHip));
      oldHip.copy(hip);
      first = false;
    });
  }
  return { feet: old.flatMap(v => v.toArray()), error, penetration, jump, bootPenetration, pelvisJump, settledHover };
}
const contacts = contactReplay(flat, 120), stairContacts = contactReplay(stair, 120);
const jumpCommands = [[1, input(0, 1)], [1, input(0, 1, false, true)], [1, input()]];
const runJumpCommands = [[1, input(0, 1, true)], [1, input(0, 1, true, true)], [1, input()]];
const jumpContacts = contactReplay(flat, 120, jumpCommands);
const runJumpContacts = contactReplay(flat, 120, runJumpCommands);
const descendingContacts = contactReplay(stair, 120, [[3, input(0, 1)], [3, input(0, -1)], [1, input()]]);
for (const hz of [30, 60, 144]) {
  for (const [surface, commands, expected] of [[flat, undefined, contacts], [stair, undefined, stairContacts], [flat, jumpCommands, jumpContacts]]) {
    const c = contactReplay(surface, hz, commands);
    c.feet.forEach((v, i) => near(v, expected.feet[i], 1e-8, `${hz}Hz contact ${i}`));
    for (const metric of ['error', 'jump', 'bootPenetration', 'pelvisJump']) near(c[metric], expected[metric], 1e-8, `${hz}Hz ${metric}`);
  }
}
assert.ok(contacts.jump < 0.10, `flat foot discontinuity ${contacts.jump}`);
assert.ok(stairContacts.error < 0.01, `stair sole target error ${stairContacts.error}`);
assert.ok(stairContacts.penetration < 0.005, `stair sole penetration ${stairContacts.penetration}`);
assert.ok(contacts.settledHover < 0.005, `flat stance keeps its swing lift ${contacts.settledHover}`);
for (const stairs of [stairContacts, descendingContacts]) {
  assert.ok(stairs.jump < 0.085, `riser horizontal catch-up ${stairs.jump}`);
  assert.ok(stairs.pelvisJump < 0.04, `pelvis pops on a tread ${stairs.pelvisJump}`);
  assert.ok(stairs.bootPenetration < 0.002, `rendered boot penetrates riser ${stairs.bootPenetration}`);
}
for (const jumpPose of [jumpContacts, runJumpContacts]) {
  assert.ok(jumpPose.jump < 0.095, `takeoff/landing foot pop ${jumpPose.jump}`);
  assert.ok(jumpPose.pelvisJump < 0.07, `takeoff/landing pelvis pop ${jumpPose.pelvisJump}`);
  assert.ok(jumpPose.error < 0.005, `airborne IK target error ${jumpPose.error}`);
  assert.ok(jumpPose.bootPenetration < 0.002, `landing boot penetration ${jumpPose.bootPenetration}`);
}

// Fixed reference poses remain independent of playing/stopping/jumping beforehand.
const poseState = () => [rig.hips, rig.chest, rig.neck, rig.thighL, rig.thighR, rig.kneeL, rig.kneeR, rig.ankleL, rig.ankleR].map(j => [...j.position, ...j.quaternion]);
applyPose(rig, { gait: 'run', t: 12.6, phase: -1.11 }); const reference = poseState();
poses.update({ ...walk.state, grounded: false, vy: 4 }, 100);
applyPose(rig, { gait: 'run', t: 12.6, phase: -1.11 });
assert.deepEqual(poseState(), reference, 'fixed pose does not accumulate play state');
console.log(JSON.stringify({ passed: true, replaysHz: [30, 60, 120, 144], apex, landedAt, worstContact, lowestSole, contacts, stairContacts, jumpContacts, runJumpContacts, descendingContacts }));
