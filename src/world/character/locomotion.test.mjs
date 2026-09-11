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

// Live arms must oppose their own legs, not merely oppose the other arm. Measure actual
// transformed soles and elbow positions so a quarter-cycle timing error fails this replay.
const armLegReplays = [];
for (const running of [false, true]) {
  const r = buildRig(LINK_PROPORTIONS, 'arm-leg-test'), p = createPlayPose(r, flat.height);
  const c = createLocomotion(flat, 0, 0, 0), samples = [[], []];
  const sole = new THREE.Vector3(), elbow = new THREE.Vector3();
  for (let i = 0; i < 720; i++) c.update(1 / 120, input(0, 1, running), (s, dt) => {
    p.update(s, s.time, dt);
    if (s.time < 2) return; // Let speed, gait blend and contact anchors settle.
    for (const [j, ankle] of [r.ankleL, r.ankleR].entries()) {
      ankle.localToWorld(sole.copy(r.sole)); r.root.worldToLocal(sole);
      (j === 0 ? r.elbowL : r.elbowR).getWorldPosition(elbow); r.chest.worldToLocal(elbow);
      samples[j].push({ foot: sole.z - r.sole.z, arm: elbow.z,
        phase: (s.phase + j * .5) % 1, duty: .52 - .16 * s.runWeight });
    }
  });
  const correlations = [], endpoints = [];
  for (const [j, values] of samples.entries()) {
    const meanFoot = values.reduce((sum, v) => sum + v.foot, 0) / values.length;
    const meanArm = values.reduce((sum, v) => sum + v.arm, 0) / values.length;
    let covariance = 0, footVariance = 0, armVariance = 0;
    for (const v of values) {
      covariance += (v.foot - meanFoot) * (v.arm - meanArm);
      footVariance += (v.foot - meanFoot) ** 2; armVariance += (v.arm - meanArm) ** 2;
    }
    const correlation = covariance / Math.sqrt(footVariance * armVariance);
    const label = `${running ? 'run' : 'walk'} ${j === 0 ? 'left' : 'right'}`;
    assert.ok(correlation < -.94, `${label}: arm must move opposite its leg, correlation ${correlation}`);
    const touchdown = values.filter(v => Math.min(v.phase, 1 - v.phase) < .02);
    const liftOff = values.filter(v => Math.abs(v.phase - v.duty) < .02);
    assert.ok(touchdown.length >= 8 && liftOff.length >= 8, `${label}: replay covers both stride endpoints`);
    assert.ok(touchdown.every(v => v.foot > .17 && v.arm < -.02), `${label}: forward landing foot has a backward arm`);
    assert.ok(liftOff.every(v => v.foot < -.16 && v.arm > .02), `${label}: rear lift-off foot has a forward arm`);
    correlations.push(correlation); endpoints.push([touchdown.length, liftOff.length]);
  }
  armLegReplays.push({ gait: running ? 'run' : 'walk', correlations, endpoints });
}

// Contact state uses the same fixed steps as physics, including turns and stopping mid-swing.
function contactReplay(surface, hz, commands = [[2, input(0, 1)], [1, input(0, 1, true)], [1, input(0, -1)], [1, input()]]) {
  const r = buildRig(LINK_PROPORTIONS, 'contact-test'), p = createPlayPose(r, surface.height);
  const c = createLocomotion(surface, 0, 0, 0);
  // Read the actual authored boot meshes. A centre point alone missed toes passing
  // 23.5 cm through a stair riser despite perfect solver/target agreement.
  const material = new THREE.MeshStandardMaterial();
  buildLegs(r, { skin: material, boot: material, cuff: null, shaftTop: 0.135, shapedBoots: true });
  const soleMeshes = [r.ankleL, r.ankleR].map(a => a.getObjectByName('boot-sole'));
  const soleVertices = soleMeshes.map(mesh => {
    const positions = mesh.geometry.attributes.position;
    // Pitch can put a bevel/side vertex ahead of the underside. Check the whole rounded sole.
    return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i));
  });
  let error = 0, penetration = 0, jump = 0, bootPenetration = 0, pelvisJump = 0, settledHover = 0;
  let bootVertexJump = 0, stancePitch = 0, pitchStep = 0, transitionPitchStep = 0;
  const recovery = { walk: [0, 0], run: [0, 0] };
  const oldCorners = soleVertices.map(vertices => vertices.map(() => new THREE.Vector3()));
  const oldPitch = [0, 0]; let oldGrounded = true;
  const footRotation = new THREE.Quaternion(), footForward = new THREE.Vector3();
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
        ankle.getWorldQuaternion(footRotation);
        footForward.set(0, 0, 1).applyQuaternion(footRotation);
        const pitch = Math.atan2(-footForward.y, Math.hypot(footForward.x, footForward.z));
        if (!first) {
          const step = Math.abs(pitch - oldPitch[j]); pitchStep = Math.max(pitchStep, step);
          if (s.grounded !== oldGrounded) transitionPitchStep = Math.max(transitionPitchStep, step);
        }
        oldPitch[j] = pitch;
        let highestSupport = -Infinity;
        for (const [vertex, v] of soleVertices[j].entries()) {
          soleMeshes[j].localToWorld(corner.copy(v));
          const h = surface.height(corner.x, corner.z);
          bootPenetration = Math.max(bootPenetration, h - corner.y);
          highestSupport = Math.max(highestSupport, h);
          if (!first) bootVertexJump = Math.max(bootVertexJump, corner.distanceTo(oldCorners[j][vertex]));
          oldCorners[j][vertex].copy(corner);
        }
        const phase = ((s.phase + j * 0.5) % 1 + 1) % 1;
        const duty = 0.52 - 0.16 * s.runWeight;
        if (s.grounded && s.moveWeight > 0.9 && phase > 0.05 && phase < duty) {
          settledHover = Math.max(settledHover, sole.y - highestSupport);
        }
        if (s.grounded && phase < duty) stancePitch = Math.max(stancePitch, Math.abs(pitch));
        if (s.grounded && phase >= duty && s.time > 1.5 && !s.stairWeight && s.moveWeight > .99) {
          const gait = s.runWeight < .01 && s.speed > 1.4 ? 'walk' : s.runWeight > .95 && s.speed > 3.7 ? 'run' : null;
          if (gait) {
            recovery[gait][0] = Math.min(recovery[gait][0], pitch);
            recovery[gait][1] = Math.max(recovery[gait][1], pitch);
          }
        }
      });
      r.hips.getWorldPosition(hip);
      if (!first) pelvisJump = Math.max(pelvisJump, hip.distanceTo(oldHip));
      oldHip.copy(hip);
      first = false; oldGrounded = s.grounded;
    });
  }
  return { feet: old.flatMap(v => v.toArray()), error, penetration, jump, bootPenetration, pelvisJump, settledHover,
    bootVertexJump, stancePitch, pitchStep, transitionPitchStep, recovery };
}
const contacts = contactReplay(flat, 120), stairContacts = contactReplay(stair, 120);
const jumpCommands = [[1, input(0, 1)], [1, input(0, 1, false, true)], [1, input()]];
const runJumpCommands = [[1, input(0, 1, true)], [1, input(0, 1, true, true)], [1, input()]];
const jumpContacts = contactReplay(flat, 120, jumpCommands);
const runJumpContacts = contactReplay(flat, 120, runJumpCommands);
const descendingCommands = [[3, input(0, 1)], [3, input(0, -1)], [1, input()]];
const descendingContacts = contactReplay(stair, 120, descendingCommands);
const stairJumpCommands = [[1, input(0, 1)], [1, input(0, 1, false, true)], [1, input(0, 1)], [1, input()]];
const stairJumpContacts = contactReplay(stair, 120, stairJumpCommands);
const restartCommands = [[1, input(0, 1)], [1 / 6, input()], [1, input(0, 1, true)], [1 / 6, input()], [1, input(0, 1)]];
const restartContacts = contactReplay(flat, 120, restartCommands);
const analogueCommands = [.3, .4].map(amount => [[1, input(0, 1)], [2, input(0, amount)]]);
const analogueContacts = analogueCommands.map(commands => contactReplay(flat, 120, commands));
const contactCases = [[flat, undefined, contacts], [stair, undefined, stairContacts],
  [flat, jumpCommands, jumpContacts], [flat, runJumpCommands, runJumpContacts],
  [stair, descendingCommands, descendingContacts], [stair, stairJumpCommands, stairJumpContacts],
  [flat, restartCommands, restartContacts],
  ...analogueCommands.map((commands, j) => [flat, commands, analogueContacts[j]])];
for (const hz of [30, 60, 144]) {
  for (const [surface, commands, expected] of contactCases) {
    const c = contactReplay(surface, hz, commands);
    c.feet.forEach((v, i) => near(v, expected.feet[i], 1e-8, `${hz}Hz contact ${i}`));
    for (const metric of ['error', 'jump', 'bootPenetration', 'pelvisJump', 'bootVertexJump', 'stancePitch', 'pitchStep', 'transitionPitchStep']) {
      near(c[metric], expected[metric], 1e-8, `${hz}Hz ${metric}`);
    }
  }
}
assert.ok(contacts.jump < 0.10, `flat foot discontinuity ${contacts.jump}`);
assert.ok(contacts.bootVertexJump < .10, `flat boot corner discontinuity ${contacts.bootVertexJump}`);
assert.ok(restartContacts.bootPenetration < .002, `restarting a final step penetrates the ground ${restartContacts.bootPenetration}`);
assert.ok(restartContacts.bootVertexJump < .10, `restarting a final step pops the boot ${restartContacts.bootVertexJump}`);
for (const result of analogueContacts) {
  assert.ok(result.settledHover < .005, `deliberate analogue slowdown must retain gait stance, not start an idle step: ${result.settledHover}`);
  assert.ok(result.bootPenetration < .002, `analogue slowdown boot penetration ${result.bootPenetration}`);
  assert.ok(result.bootVertexJump < .10, `analogue slowdown foot continuity ${result.bootVertexJump}`);
}
assert.ok(stairContacts.error < 0.01, `stair sole target error ${stairContacts.error}`);
assert.ok(stairContacts.penetration < 0.005, `stair sole penetration ${stairContacts.penetration}`);
assert.ok(contacts.settledHover < 0.005, `flat stance keeps its swing lift ${contacts.settledHover}`);
for (const stairs of [stairContacts, descendingContacts]) {
  assert.ok(stairs.jump < 0.085, `riser horizontal catch-up ${stairs.jump}`);
  assert.ok(stairs.pelvisJump < 0.04, `pelvis pops on a tread ${stairs.pelvisJump}`);
  assert.ok(stairs.bootPenetration < 0.002, `rendered boot penetrates riser ${stairs.bootPenetration}`);
  assert.ok(stairs.bootVertexJump < .085, `stair boot corner discontinuity ${stairs.bootVertexJump}`);
}
for (const jumpPose of [jumpContacts, runJumpContacts, stairJumpContacts]) {
  assert.ok(jumpPose.jump < 0.095, `takeoff/landing foot pop ${jumpPose.jump}`);
  assert.ok(jumpPose.pelvisJump < 0.07, `takeoff/landing pelvis pop ${jumpPose.pelvisJump}`);
  assert.ok(jumpPose.error < 0.005, `airborne IK target error ${jumpPose.error}`);
  assert.ok(jumpPose.bootPenetration < 0.002, `landing boot penetration ${jumpPose.bootPenetration}`);
  assert.ok(jumpPose.bootVertexJump < .095, `jump boot corner discontinuity ${jumpPose.bootVertexJump}`);
}
for (const [, , result] of contactCases) {
  assert.ok(result.stancePitch < 1e-7, `stance sole remains level ${result.stancePitch}`);
  assert.ok(result.pitchStep < .065, `boot rotation advances smoothly per fixed step ${result.pitchStep}`);
  assert.ok(result.transitionPitchStep < .025, `jump transition must not flatten the boot abruptly ${result.transitionPitchStep}`);
}
// The former yaw-only solve passes contact tests but fails these actual boot-direction checks.
assert.ok(contacts.recovery.walk[0] < -.055 && contacts.recovery.walk[1] > .055, `walk boot articulates both ways ${contacts.recovery.walk}`);
assert.ok(contacts.recovery.run[0] < -.11 && contacts.recovery.run[1] > .11, `run boot articulates both ways ${contacts.recovery.run}`);

// Rendered 5b73660 shows straight, parallel legs at the apex and a delayed idle
// pull-in. Measure the solved joints and contacts, not the authored angle formula.
function jumpStopReplay(running, hz) {
  const r = buildRig(LINK_PROPORTIONS, 'jump-stop-test'), p = createPlayPose(r, flat.height);
  const c = createLocomotion(flat, 0, 0, 0);
  const thighs = [r.thighL, r.thighR], knees = [r.kneeL, r.kneeR], ankles = [r.ankleL, r.ankleR];
  const hip = new THREE.Vector3(), knee = new THREE.Vector3(), ankle = new THREE.Vector3();
  const old = [new THREE.Vector3(), new THREE.Vector3()];
  let apex = null, lastAir = null, lateFootStep = 0, movingStopFrames = 0, unsupportedStopFrames = 0;
  let settledAt = Infinity, first = true;
  for (const [seconds, command] of [[1, input(0, 1, running)], [1, input(0, 1, running, true)], [1, input()]]) {
    for (let n = 0; n < seconds * hz; n++) c.update(1 / hz, command, (s, dt) => {
      p.update(s, s.time, dt);
      const soles = ankles.map(a => a.localToWorld(r.sole.clone()));
      if (!s.grounded) {
        const flex = knees.map((k, j) => {
          thighs[j].getWorldPosition(hip); k.getWorldPosition(knee); ankles[j].getWorldPosition(ankle);
          return knee.clone().sub(hip).angleTo(ankle.sub(knee));
        });
        lastAir = flex;
        if (!apex || Math.abs(s.vy) < apex.velocity) apex = { velocity: Math.abs(s.vy), flex };
      }
      if (s.time > 2 && !first) {
        const elapsed = s.time - 2;
        const horizontal = soles.map((v, j) => Math.hypot(v.x - old[j].x, v.z - old[j].z));
        if (elapsed > .25) lateFootStep = Math.max(lateFootStep, ...soles.map((v, j) => v.distanceTo(old[j])));
        if (elapsed > .08 && Math.max(...horizontal) > .001) {
          movingStopFrames++;
          if (!soles.some((v, j) => horizontal[j] < .0001 && Math.abs(v.y) < .003)) unsupportedStopFrames++;
        }
        if (!Number.isFinite(settledAt) && s.speed < .1 && soles.every(v => Math.abs(v.z - s.z - .025) < .025 && Math.abs(v.y) < .004)) settledAt = elapsed;
      }
      soles.forEach((v, j) => old[j].copy(v)); first = false;
    });
  }
  assert.ok(apex.flex[0] > .8 && apex.flex[1] > .55 && apex.flex[0] - apex.flex[1] > .18,
    `jump retains a modest asymmetric apex tuck: ${apex.flex}`);
  assert.ok(lastAir.every((angle, j) => angle < .35 && angle < apex.flex[j] * .6),
    `descending legs prepare for the ground: ${lastAir}`);
  assert.ok(lateFootStep < .012, `late stop foot pull-in ${lateFootStep}`);
  assert.ok(movingStopFrames > 10 && unsupportedStopFrames === 0,
    `final steps retain a planted support foot: ${unsupportedStopFrames}/${movingStopFrames}`);
  assert.ok(settledAt < .55, `feet finish stopping without a prolonged split stance: ${settledAt}`);
  return { apex: apex.flex, lastAir, lateFootStep, movingStopFrames, unsupportedStopFrames, settledAt };
}
const jumpStopReplays = [false, true].map(running => jumpStopReplay(running, 120));
for (const hz of [30, 60, 144]) for (const [j, running] of [false, true].entries()) {
  const actual = jumpStopReplay(running, hz), expected = jumpStopReplays[j];
  for (const metric of ['lateFootStep', 'movingStopFrames', 'unsupportedStopFrames', 'settledAt']) near(actual[metric], expected[metric], 1e-8, `${hz}Hz jump/stop ${metric}`);
  for (const metric of ['apex', 'lastAir']) actual[metric].forEach((v, k) => near(v, expected[metric][k], 1e-8, `${hz}Hz ${metric} knee ${k}`));
}
// Slow intentional input must retain normal stance anchors instead of triggering idle settling.
const slowRig = buildRig(LINK_PROPORTIONS, 'slow-contact-test'), slowPose = createPlayPose(slowRig, flat.height);
const slowController = createLocomotion(flat, 0, 0, 0), slowOld = [new THREE.Vector3(), new THREE.Vector3()];
const slowWasPlanted = [false, false]; let slowPlantDrift = 0;
for (let i = 0; i < 480; i++) slowController.update(1 / 120, input(0, .2), (s, dt) => {
  slowPose.update(s, s.time, dt);
  [slowRig.ankleL, slowRig.ankleR].forEach((a, j) => {
    const sole = a.localToWorld(slowRig.sole.clone()), phase = (s.phase + j * .5) % 1;
    const planted = s.time > 1 && phase > .04 && phase < .48;
    if (planted && slowWasPlanted[j]) slowPlantDrift = Math.max(slowPlantDrift, Math.hypot(sole.x - slowOld[j].x, sole.z - slowOld[j].z));
    slowOld[j].copy(sole); slowWasPlanted[j] = planted;
  });
});
assert.ok(slowPlantDrift < .0001, `slow intended walking must not skate planted feet: ${slowPlantDrift}`);

// A held forward arm can satisfy all sole tests. Check actual hand follow-through
// and the landing recovery for stationary, walking and running jumps instead.
function jumpArmReplay(kind, hz) {
  const r = buildRig(LINK_PROPORTIONS, 'jump-arms-test'), p = createPlayPose(r, flat.height);
  const c = createLocomotion(flat, 0, 0, 0), joints = [r.shoulderL, r.shoulderR, r.elbowL, r.elbowR];
  const old = joints.map(j => j.quaternion.clone());
  let first = true, peakStep = 0, apex = null, lastAir = null;
  const command = jump => input(0, kind === 'standing' ? 0 : 1, kind === 'running', jump);
  for (const [seconds, action] of [[1, command(false)], [.5, command(true)], [.5, command(false)], [1, input()]]) {
    for (let frame = 0; frame < seconds * hz; frame++) c.update(1 / hz, action, (s, dt) => {
      p.update(s, s.time, dt);
      joints.forEach((joint, j) => {
        if (!first) peakStep = Math.max(peakStep, joint.quaternion.angleTo(old[j]));
        old[j].copy(joint.quaternion);
      });
      if (!s.grounded) {
        const hand = r.elbowL.localToWorld(new THREE.Vector3(0, -r.props.forearm - .021, .008));
        r.chest.worldToLocal(hand);
        const sample = { speedY: Math.abs(s.vy), hand: hand.toArray(), elbow: Math.abs(r.elbowL.rotation.x) };
        if (!apex || sample.speedY < apex.speedY) apex = sample;
        lastAir = sample;
      }
      first = false;
    });
  }
  assert.ok(apex && lastAir, `${kind} jump reaches and leaves its apex`);
  assert.ok(apex.elbow > .40 && apex.elbow < .80, `${kind} jump elbow has moderate flexion`);
  assert.ok(lastAir.elbow < apex.elbow - .04, `${kind} elbows relax before landing`);
  assert.ok(lastAir.hand[1] < apex.hand[1] - .025, `${kind} hands lower relative to the chest during descent`);
  assert.ok(lastAir.hand[2] < apex.hand[2] - .025, `${kind} hands recover from the held forward position`);
  assert.ok(peakStep < .16, `${kind} arm motion exceeds the previous fixed-step envelope: ${peakStep}`);
  return { apex, lastAir, peakStep };
}
const jumpArmReplays = ['standing', 'walking', 'running'].map(kind => jumpArmReplay(kind, 120));
for (const hz of [30, 60, 144]) for (const [j, kind] of ['standing', 'walking', 'running'].entries()) {
  assert.deepEqual(jumpArmReplay(kind, hz), jumpArmReplays[j], `${hz}Hz ${kind} arm recovery follows the same fixed-step path`);
}

// Fixed reference poses remain independent of playing/stopping/jumping beforehand.
const poseState = () => [rig.hips, rig.chest, rig.neck, rig.thighL, rig.thighR, rig.kneeL, rig.kneeR, rig.ankleL, rig.ankleR].map(j => [...j.position, ...j.quaternion]);
applyPose(rig, { gait: 'run', t: 12.6, phase: -1.11 }); const reference = poseState();
poses.update({ ...walk.state, grounded: false, vy: 4 }, 100);
applyPose(rig, { gait: 'run', t: 12.6, phase: -1.11 });
assert.deepEqual(poseState(), reference, 'fixed pose does not accumulate play state');
console.log(JSON.stringify({ passed: true, replaysHz: [30, 60, 120, 144], apex, landedAt, worstContact, lowestSole, armLegReplays, contacts, stairContacts, jumpContacts, runJumpContacts, descendingContacts, stairJumpContacts, restartContacts, analogueContacts, jumpStopReplays, jumpArmReplays, slowPlantDrift }));
