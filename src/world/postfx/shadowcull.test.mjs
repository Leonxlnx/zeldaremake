// node --test src/world/postfx/shadowcull.test.mjs — the shadow-caster cull (round 38, perf-2).
// A caster is switched off only when its bounding sphere, swept from it along the light, can never
// enter the camera frustum; the sweep direction matters (a caster beside the frustum on the sun's
// side casts INTO it), the margin inflates the sphere, spheres/frustumCulled-off objects are left
// alone, and the restore puts every flag back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const module = { exports: {} };
new Function(
  'require',
  'module',
  'exports',
  ts.transpileModule(readFileSync(new URL('./shadowcull.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
)(
  (id) => {
    if (id === 'three') return THREE;
    throw Error(id);
  },
  module,
  module.exports,
);
const { sweptSphereMissesFrustum, cullShadowCasters, hideSmallFar } = module.exports;

// a camera at the origin looking down −z, 60° fov, 1:1; the sun 45° up in +x (light travels toward −x, −y)
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, -1);
camera.updateMatrixWorld();
const sunDirection = new THREE.Vector3(1, 1, 0).normalize();
const light = sunDirection.clone().multiplyScalar(-1);
const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

{
  // inside the frustum: never culled
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, 0, -10), 1), light, frustum.planes), false);
  // far to the +x side (the sun's side): its shadow sweeps toward −x, across the frustum → kept
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(30, 20, -10), 1), light, frustum.planes), false);
  // far to the −x side (down-light): the shadow travels further away → culled
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(-30, 0, -10), 1), light, frustum.planes), true);
  // straight behind the camera: the light has no +z component, so it never comes round → culled
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, 0, 10), 1), light, frustum.planes), true);
  // below the frustum: light travels down (−y), so it moves away → culled; above it: comes down into view → kept
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, -30, -10), 1), light, frustum.planes), true);
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, 30, -10), 1), light, frustum.planes), false);
  // beyond the far plane: culled (light has no −z component); a huge sphere there reaches in → kept
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, 0, -150), 1), light, frustum.planes), true);
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, 0, -150), 60), light, frustum.planes), false);
  // just outside the −x plane: a radius that crosses it keeps the caster (the margin's job)
  const p = frustum.planes[1];
  const c = new THREE.Vector3(-8, 0, -10);
  const d = p.distanceToPoint(c);
  assert.ok(d < 0, 'the probe point is outside the left plane');
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(c, -d - 0.01), light, frustum.planes), true);
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(c, -d + 0.01), light, frustum.planes), false);
}

{
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mk = (x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    m.position.set(x, y, z);
    m.castShadow = true;
    Object.assign(m, opts);
    scene.add(m);
    return m;
  };
  const inView = mk(0, 0, -10);
  const downLight = mk(-30, 0, -10);
  const behind = mk(0, 0, 10);
  const behindNoCull = mk(0, 0, 12, { frustumCulled: false });
  const behindNoCast = mk(0, 0, 14, { castShadow: false });
  const hidden = mk(0, 0, 16, { visible: false });
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 2);
  inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-40, 0, -10));
  inst.setMatrixAt(1, new THREE.Matrix4().makeTranslation(-41, 0, -10));
  inst.castShadow = true;
  scene.add(inst);
  scene.updateMatrixWorld(true);

  const stats = { tested: 0, culled: 0 };
  const restore = cullShadowCasters(scene, camera, sunDirection, 1.0, stats);
  assert.equal(inView.castShadow, true, 'in view keeps casting');
  assert.equal(downLight.castShadow, false, 'down-light of the frustum is culled');
  assert.equal(behind.castShadow, false, 'behind the camera is culled');
  assert.equal(behindNoCull.castShadow, true, 'frustumCulled=false is left alone');
  assert.equal(behindNoCast.castShadow, false, 'a non-caster stays a non-caster');
  assert.equal(hidden.castShadow, true, 'invisible objects are not touched (three skips them anyway)');
  assert.equal(inst.castShadow, false, 'an instanced mesh uses its own bounding sphere');
  assert.ok(inst.boundingSphere, 'the instanced sphere was computed on demand');
  assert.equal(stats.tested, 4, 'inView, downLight, behind, inst');
  assert.equal(stats.culled, 3);
  restore();
  assert.equal(downLight.castShadow, true);
  assert.equal(behind.castShadow, true);
  assert.equal(inst.castShadow, true);
  assert.equal(behindNoCast.castShadow, false, 'restore only touches what it switched off');

  // with the light coming from behind the camera (travelling toward −z, slightly down), "behind" now
  // sweeps into view (a 45° light would pass under the frustum — z=−10 puts it at y=−20 — and stay culled)
  assert.equal(sweptSphereMissesFrustum(new THREE.Sphere(new THREE.Vector3(0, 0, 10), 1), new THREE.Vector3(0, -1, -1).normalize(), frustum.planes), true);
  const restore2 = cullShadowCasters(scene, camera, new THREE.Vector3(0, 0.1, 1).normalize(), 1.0, stats);
  assert.equal(behind.castShadow, true, 'a caster behind the camera under a light travelling into view is kept');
  assert.equal(downLight.castShadow, true, 'a sideways caster under a light travelling along the view axis is kept: the frustum widens with depth');
  restore2();
}

{
  // the optional distance rule: a small caster beyond the distance is switched off even in view; a big
  // one, or a small one nearer, is not; the stats count the rule's share; without a rule nothing changes
  const scene = new THREE.Scene();
  const mk = (z, size) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
    m.position.set(0, 0, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  const r1 = Math.sqrt(3) / 2;
  const nearSmall = mk(-10, 1);
  const farSmall = mk(-40, 1);
  const farBig = mk(-40, 4);
  const justBeyond = mk(-(25 + r1 + 0.05), 1);
  const justShort = mk(-(25 + r1 - 0.05), 1);
  scene.updateMatrixWorld(true);
  const rule = { maxRadiusM: 1.5, minDistanceM: 25 };
  const stats = { tested: 0, culled: 0 };
  const restore = cullShadowCasters(scene, camera, sunDirection, 1.0, stats, [rule]);
  assert.equal(nearSmall.castShadow, true, 'a small caster 9 m off keeps casting');
  assert.equal(farSmall.castShadow, false, 'a small caster 39 m off is switched off');
  assert.equal(farBig.castShadow, true, 'a caster over the radius keeps casting at any distance');
  assert.equal(justBeyond.castShadow, false, 'the distance is measured to the sphere, not its centre');
  assert.equal(justShort.castShadow, true);
  assert.equal(stats.tested, 5);
  assert.equal(stats.culled, 2);
  assert.equal(stats.far, 2);
  restore();
  for (const m of [nearSmall, farSmall, farBig, justBeyond, justShort]) assert.equal(m.castShadow, true, 'restored');
  cullShadowCasters(scene, camera, sunDirection, 1.0, stats)();
  assert.equal(stats.culled, 0, 'no rule: every caster here is in view and keeps casting');
  assert.equal(stats.far, 0);
}

{
  // the box rule: any caster whose sphere lies wholly more than the distance outside the box in plan
  // is switched off, however big, and the same ones wherever the camera stands; one whose sphere
  // reaches within the distance, or stands over the box, keeps casting; rules combine with `some`
  const scene = new THREE.Scene();
  const mk = (x, z, size) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
    m.position.set(x, 0, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  const box = { x0: -5, x1: 5, z0: -10, z1: 0 };
  const r20 = (Math.sqrt(3) / 2) * 20;
  const bigFar = mk(0, -10 - 20 - r20 - 0.5, 20);
  const bigReaching = mk(0, -10 - 20 - r20 + 0.5, 20);
  const beside = mk(5 + 20 + 0.9, -5, 1);
  const overBox = mk(0, -5, 1);
  const smallFar = mk(-2, -60, 1);
  scene.updateMatrixWorld(true);
  const reach = { box, minDistanceM: 20 };
  const stats = { tested: 0, culled: 0 };
  const restore = cullShadowCasters(scene, camera, sunDirection, 1.0, stats, [reach]);
  assert.equal(bigFar.castShadow, false, 'a 35 m sphere wholly 20.5 m outside the box is switched off');
  assert.equal(bigReaching.castShadow, true, 'the same sphere reaching 19.5 m from the box keeps casting');
  assert.equal(beside.castShadow, false, 'the plan distance counts across x as well');
  assert.equal(overBox.castShadow, true, 'a caster over the box keeps casting');
  assert.equal(smallFar.castShadow, false);
  assert.equal(stats.far, 3);
  restore();
  const moved = camera.clone();
  moved.position.set(3, 1, -8);
  moved.updateMatrixWorld(true);
  const restoreMoved = cullShadowCasters(scene, moved, sunDirection, 1.0, stats, [reach]);
  assert.equal(bigFar.castShadow, false, 'from elsewhere in the box: the same caster is off');
  assert.equal(bigReaching.castShadow, true);
  restoreMoved();
  const both = cullShadowCasters(scene, camera, sunDirection, 1.0, stats, [{ maxRadiusM: 1.5, minDistanceM: 4 }, reach]);
  assert.equal(overBox.castShadow, false, 'the size rule still applies alongside: the caster over the box is small and 4.1 m off');
  assert.equal(bigReaching.castShadow, true);
  both();
  for (const m of [bigFar, bigReaching, beside, overBox, smallFar]) assert.equal(m.castShadow, true, 'restored');
}

{
  // an instanced batch is judged by its whole batch's sphere: small pieces spread over metres keep
  // casting at any distance (strata and prop batches are not the rule's to thin out)
  const scene = new THREE.Scene();
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial(), 5);
  for (let i = 0; i < 5; i++) m.setMatrixAt(i, new THREE.Matrix4().makeTranslation((i - 2) * 3, 0, -40 - i * 2));
  m.castShadow = true;
  scene.add(m);
  scene.updateMatrixWorld(true);
  const stats = { tested: 0, culled: 0 };
  const restore = cullShadowCasters(scene, camera, sunDirection, 1.0, stats, [{ maxRadiusM: 1.5, minDistanceM: 25 }]);
  assert.ok(m.boundingSphere.radius > 1.5, 'the batch sphere spans the pieces');
  assert.equal(m.castShadow, true, 'a spread batch of small far pieces keeps casting');
  assert.equal(stats.far, 0);
  restore();
}

{
  // the draw distance by size: small far leaves hide for the frame and come back; big, near, parent
  // and frustumCulled-off objects stay; the stats count what was examined and hidden
  const scene = new THREE.Scene();
  const mk = (z, size, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
    m.position.set(0, 0, z);
    parent.add(m);
    return m;
  };
  const farSmall = mk(-130, 0.5);
  const farBig = mk(-130, 3);
  const nearSmall = mk(-60, 0.5);
  const farParent = mk(-130, 0.5);
  const child = mk(0, 0.5, farParent);
  const farUnculled = mk(-130, 0.5);
  farUnculled.frustumCulled = false;
  const hiddenAlready = mk(-130, 0.5);
  hiddenAlready.visible = false;
  scene.updateMatrixWorld(true);
  const stats = { tested: 0, hidden: 0 };
  const restore = hideSmallFar(scene, camera, { maxRadiusM: 0.6, minDistanceM: 100 }, stats);
  assert.equal(farSmall.visible, false, 'a small thing 130 m off is not drawn');
  assert.equal(farBig.visible, true, 'a big one is, at any distance');
  assert.equal(nearSmall.visible, true, 'a small one 60 m off is');
  assert.equal(farParent.visible, true, 'an object with children is left alone');
  assert.equal(child.visible, false, 'its small far child is a leaf and hides');
  assert.equal(farUnculled.visible, true, 'frustumCulled off: never hidden');
  assert.equal(stats.tested, 4, 'the visible culled leaves: farSmall, farBig, nearSmall, child');
  assert.equal(stats.hidden, 2);
  restore();
  for (const m of [farSmall, farBig, nearSmall, farParent, child, farUnculled]) assert.equal(m.visible, true, 'shown again');
  assert.equal(hiddenAlready.visible, false, 'what was hidden before stays hidden');
}

console.log('shadowcull: ok');
