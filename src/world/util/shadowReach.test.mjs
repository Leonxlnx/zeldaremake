/**
 * Run: node --test src/world/util/shadowReach.test.mjs (Node 20+, no browser needed).
 *
 * The geometric contract the tree culls rest on (util/shadowReach.ts). Everything this lane claims
 * about them — "79–193 K a pose off the depth pass and every frame byte-identical" — is true only if
 * `reaches` never says no while some part of the caster's shadow volume can still touch the frame. So
 * these are behaviour tests, not source greps: a camera, a ground, a sun, and spheres placed where the
 * answer is known by construction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// compile the one TS module under test in memory (the pool tests' loader, minus the graph)
const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, 'shadowReach.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', js)((name) => (name === 'three' ? THREE : require(name)), module, module.exports);
const { createShadowReach } = module.exports;

/** a camera at the origin looking down −z, 46° vertical, 16:9 — the shape every hero pose uses */
const cameraLookingNorth = () => {
  const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
  cam.position.set(0, 2, 0);
  cam.lookAt(0, 2, -30);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

/** the sun 45° up in the +z half, so shadows sweep toward −z (into the camera's view) */
const sunFromBehind = new THREE.Vector3(0, 1, 1).normalize();
/** the sun 45° up in the −z half, so shadows sweep toward +z (behind the camera) */
const sunFromAhead = new THREE.Vector3(0, 1, -1).normalize();

const flatGround = (y) => () => y;

test('a caster inside the frame always casts (its own sphere answers)', () => {
  const shade = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 0, steps: 6 });
  shade.prepare(cameraLookingNorth(), sunFromAhead);
  // 20 m ahead, in shot; the sun sends its shadow away from the camera, but the caster itself is visible
  assert.equal(shade.reaches(new THREE.Sphere(new THREE.Vector3(0, 3, -20), 2)), true);
});

test('a caster behind the camera casts when its shadow sweeps into the frame', () => {
  const shade = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 0, steps: 6 });
  shade.prepare(cameraLookingNorth(), sunFromBehind);
  // 8 m behind the camera and 12 m up: the sweep toward −z passes through the ground in front of it
  assert.equal(shade.reaches(new THREE.Sphere(new THREE.Vector3(0, 12, 8), 2)), true);
});

test('a caster behind the camera does not cast when its shadow sweeps away', () => {
  const shade = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 0, steps: 6 });
  shade.prepare(cameraLookingNorth(), sunFromAhead);
  // same caster, sun the other way: the sweep runs to +z, farther behind the camera
  assert.equal(shade.reaches(new THREE.Sphere(new THREE.Vector3(0, 12, 8), 2)), false);
});

test('the ground ends the sweep: raise it and a reaching caster stops reaching', () => {
  // a caster 10 m behind the camera and 12 m up: with the sun 45° behind, its shade lands ~12 m of
  // −z away, i.e. 2 m in front of the camera and in shot
  const caster = () => new THREE.Sphere(new THREE.Vector3(0, 12, 10), 1);
  const open = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 0, steps: 6 });
  const raised = createShadowReach({ groundAt: flatGround(11), floorY: -20, padM: 0, steps: 6 });
  for (const shade of [open, raised]) shade.prepare(cameraLookingNorth(), sunFromBehind);
  assert.equal(open.reaches(caster()), true, 'over open ground the sweep reaches the frame');
  // with the ground 11 m up the swept sphere is under it within the first step, so the shade stays
  // behind the camera where nothing can see it
  assert.equal(raised.reaches(caster()), false, 'a high ground ends the sweep before the frame');
});

test('the floor bounds the sweep when the ground never stops it', () => {
  // straight-down sun and a caster overhead but above the frame's top edge: how far the sweep is
  // allowed to fall is the only thing that decides whether its shade crosses the view
  const sunOverhead = new THREE.Vector3(0, 1, 0);
  const caster = () => new THREE.Sphere(new THREE.Vector3(0, 30, -20), 1);
  const shallow = createShadowReach({ groundAt: flatGround(20), floorY: 20, padM: 0, steps: 6 });
  const deep = createShadowReach({ groundAt: flatGround(-10), floorY: -10, padM: 0, steps: 6 });
  for (const shade of [shallow, deep]) shade.prepare(cameraLookingNorth(), sunOverhead);
  // at 20 m depth the frame spans roughly y 2 ± 8.5, so a sweep that stops at y 20 never enters it…
  assert.equal(shallow.reaches(caster()), false);
  // …and one allowed to fall to −10 passes straight through it
  assert.equal(deep.reaches(caster()), true);
});

test('the pad only widens the answer: what casts without it still casts with it', () => {
  const bare = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 0, steps: 6 });
  const padded = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 4, steps: 6 });
  for (const shade of [bare, padded]) shade.prepare(cameraLookingNorth(), sunFromBehind);
  // a sample of casters around the camera: padding can turn a no into a yes, never the reverse
  for (let z = -40; z <= 40; z += 5) {
    for (let y = 1; y <= 21; y += 5) {
      for (let x = -20; x <= 20; x += 10) {
        const at = () => new THREE.Sphere(new THREE.Vector3(x, y, z), 1.5);
        if (bare.reaches(at())) assert.equal(padded.reaches(at()), true, `pad lost a caster at ${x},${y},${z}`);
      }
    }
  }
});

test('no false negatives: when it says no, no part of the swept volume is in the frame', () => {
  // The guarantee the culls rest on. A dense reference walks the same sweep 400 times and asks three
  // whether each step's sphere meets the frustum; wherever the reference finds a hit, `reaches` must
  // agree. (The reverse is allowed: the test may say yes where nothing is really there.)
  const ridge = (x, z) => (z < -6 ? 6 : z > 24 ? 3 : 0);
  const floorY = -20;
  const steps = 6;
  const shade = createShadowReach({ groundAt: ridge, floorY, padM: 0, steps });
  const cam = cameraLookingNorth();
  shade.prepare(cam, sunFromBehind);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const sun = sunFromBehind.clone().normalize();
  const referenceHits = (s) => {
    const fall = Math.max(0.05, sun.y);
    const full = Math.max(0, (s.center.y + s.radius - floorY) / fall);
    // the same stop rule as the util, sampled finely: the sweep ends where the ground blocks it
    let span = full;
    const fine = 400;
    for (let k = 1; k <= fine; k++) {
      const t = (full / fine) * k;
      const p = s.center.clone().addScaledVector(sun, -t);
      if (p.y + s.radius <= ridge(p.x, p.z)) {
        span = t;
        break;
      }
    }
    const probe = new THREE.Sphere(new THREE.Vector3(), s.radius);
    for (let k = 0; k <= fine; k++) {
      probe.center.copy(s.center).addScaledVector(sun, -(span / fine) * k);
      if (frustum.intersectsSphere(probe)) return true;
    }
    return false;
  };
  let checked = 0;
  let hits = 0;
  for (let x = -24; x <= 24; x += 6) {
    for (let y = 1; y <= 25; y += 3) {
      for (let z = -36; z <= 36; z += 4) {
        const at = () => new THREE.Sphere(new THREE.Vector3(x, y, z), 1.5);
        checked++;
        if (referenceHits(at())) {
          hits++;
          assert.equal(shade.reaches(at()), true, `false negative at ${x}, ${y}, ${z}`);
        }
      }
    }
  }
  assert.ok(checked > 1000, `the grid should be broad (${checked})`);
  assert.ok(hits > 50, `and should contain plenty of real casters (${hits})`);
});

test('cull() arms from what the build set and narrows, never widens', () => {
  const shade = createShadowReach({ groundAt: flatGround(0), floorY: -20, padM: 0, steps: 6 });
  shade.prepare(cameraLookingNorth(), sunFromAhead);
  const root = new THREE.Group();
  const mesh = (name, x, y, z, casts) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = casts;
    root.add(m);
    return m;
  };
  const inFrame = mesh('in-frame', 0, 3, -20, true);
  const behind = mesh('behind', 0, 12, 8, true);
  const never = mesh('never', 0, 3, -20, false);
  root.updateMatrixWorld(true);
  const first = shade.cull(root);
  assert.equal(inFrame.castShadow, true, 'a caster in the frame keeps casting');
  assert.equal(behind.castShadow, false, 'a caster whose shade sweeps away stops casting');
  assert.equal(never.castShadow, false, 'a mesh the build never armed is not turned on');
  assert.equal(first.casters, 2, 'only the two armed meshes are counted');
  assert.equal(first.casting, 1);
  // second pass: the one it switched off is reconsidered from `staticCasts`, not from its current flag
  shade.prepare(cameraLookingNorth(), sunFromBehind);
  const second = shade.cull(root);
  assert.equal(behind.castShadow, true, 'the sun moved, so the same caster comes back');
  assert.equal(never.castShadow, false);
  assert.equal(second.casters, 2);
});
