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
const { sweptSphereMissesFrustum, cullShadowCasters } = module.exports;

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
  const restore = cullShadowCasters(scene, camera, sunDirection, 1.0, stats, rule);
  assert.equal(nearSmall.castShadow, true, 'a small caster 9 m off keeps casting');
  assert.equal(farSmall.castShadow, false, 'a small caster 39 m off is switched off');
  assert.equal(farBig.castShadow, true, 'a caster over the radius keeps casting at any distance');
  assert.equal(justBeyond.castShadow, false, 'the distance is measured to the sphere, not its centre');
  assert.equal(justShort.castShadow, true);
  assert.equal(stats.tested, 5);
  assert.equal(stats.culled, 2);
  assert.equal(stats.small, 2);
  restore();
  for (const m of [nearSmall, farSmall, farBig, justBeyond, justShort]) assert.equal(m.castShadow, true, 'restored');
  cullShadowCasters(scene, camera, sunDirection, 1.0, stats)();
  assert.equal(stats.culled, 0, 'no rule: every caster here is in view and keeps casting');
  assert.equal(stats.small, 0);
}

console.log('shadowcull: ok');
