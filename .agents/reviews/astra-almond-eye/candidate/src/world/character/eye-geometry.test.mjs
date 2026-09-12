/** Run: node src/world/character/eye-geometry.test.mjs (CPU only). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// In-memory TypeScript loader follows the new shared aperture helper as well.
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(id => id === 'three' ? THREE
    : id.endsWith('/utils/BufferGeometryUtils.js') ? geometryUtils
    : load(path.resolve(path.dirname(file), id + '.ts')), module, module.exports);
  return module.exports;
}
const { createLinkEyeDisc } = load(fileURLToPath(new URL('./eye-geometry.ts', import.meta.url)));

// Independent authored aperture dimensions; do not derive them from the generated white mesh.
const opening = Array.from({ length: 28 }, (_, i) => {
  const a = i / 28 * Math.PI * 2, sy = Math.sin(a);
  return new THREE.Vector2(.025 * Math.cos(a), .0145 * sy * (.82 + .18 * Math.abs(sy)));
});
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
let testedTriangles = 0;
for (const scale of [1, .145 / .125]) for (const side of [-1, 1]) {
  const iris = createLinkEyeDisc(scale, side, .016, .0006);
  const pupil = createLinkEyeDisc(scale, side, .009, .001);
  const oversized = createLinkEyeDisc(scale, side, .024, .0006);
  for (const [geometry, radius, depth] of [[iris, .016, .0006], [pupil, .009, .001], [oversized, .024, .0006]]) {
    const p = geometry.attributes.position, n = geometry.attributes.normal;
    for (const attr of Object.values(geometry.attributes)) assert(Array.from(attr.array).every(Number.isFinite));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / scale, y = p.getY(i) / scale, z = p.getZ(i) / scale;
      assert(Math.hypot(x + side * .0025, y + .0005) <= radius + 2e-9, 'disc stays inside its circle');
      for (let j = 0; j < opening.length; j++) {
        const start = opening[j], end = opening[(j + 1) % opening.length];
        const cross = (end.x - start.x) * (y - start.y) - (end.y - start.y) * (x - start.x);
        assert(cross >= -2e-11, 'disc stays inside every actual eyelid edge');
      }
      assert(z >= depth - 2e-9 && z <= .003 + depth + 2e-9, 'disc follows the bounded eye bulge');
      a.fromBufferAttribute(n, i);
      assert(Math.abs(a.length() - 1) < 1e-6 && a.z > 0, 'finite unit normals point forward');
    }
    geometry.computeBoundingBox();
    assert(geometry.boundingBox.max.z - geometry.boundingBox.min.z > .0008 * scale, 'disc is curved, not a floating plane');
    if (radius === .024) {
      assert(geometry.boundingBox.min.y > (-.0005 - radius) * scale + .005 * scale, 'oversized disc exercises lower-boundary clipping');
    }
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
      const cross = b.sub(a).cross(c.sub(a));
      assert(cross.z > 1e-10 * scale * scale, 'every triangle has nonzero area and +Z winding');
      testedTriangles++;
    }
  }
  // Different radii have different triangulations. Check that the pupil still sits just
  // above the iris throughout its surface rather than intersecting or hovering far away.
  const mesh = new THREE.Mesh(iris, new THREE.MeshBasicMaterial());
  const ray = new THREE.Raycaster(), pp = pupil.attributes.position;
  for (let i = 0; i < pupil.index.count; i += 3) {
    a.fromBufferAttribute(pp, pupil.index.getX(i)); b.fromBufferAttribute(pp, pupil.index.getX(i + 1)); c.fromBufferAttribute(pp, pupil.index.getX(i + 2));
    const centre = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    ray.set(centre.clone().add(new THREE.Vector3(0, 0, .01)), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(mesh)[0]; assert(hit, 'iris covers the pupil');
    const clearance = centre.z - hit.point.z;
    assert(clearance >= .00025 * scale && clearance <= .0006 * scale, 'pupil keeps a small positive iris clearance');
  }
  mesh.material.dispose(); iris.dispose(); pupil.dispose(); oversized.dispose();
}
console.log(`eye-geometry.test.mjs: clipping, curved layers and +Z winding passed (${testedTriangles} triangles)`);

// Exercise the production surface through its actual triangles and parent scale.
// Fixed UVs and compensating the white geometry instead of UVs must both fail.
{
  const context = new Proxy({}, { get: (_, key) => String(key).endsWith('Gradient')
    ? () => ({ addColorStop() {} }) : () => {} });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  const base = path.dirname(fileURLToPath(import.meta.url));
  const actor = load(path.join(base, 'link.ts')).createLink();
  const chart = load(path.join(base, 'eye-surface.ts')).LINK_EYE_SURFACE;
  assert.equal(chart.irisRadius, .016); assert.equal(chart.pupilRadius, .009);
  const k = actor.rig.props.headRadius / .125;
  const surfaces = actor.rig.eyes.map(eye => eye.getObjectByName('eye-white'));
  const openUV = surfaces.map(mesh => mesh.geometry.attributes.uv.array.slice());
  const localY = surfaces.map(mesh => Array.from({ length: mesh.geometry.attributes.position.count },
    (_, i) => mesh.geometry.attributes.position.getY(i)));
  const ray = new THREE.Raycaster();
  let mappedHits = 0, coveredPoints = 0;
  for (const blink of [1, .5838095238095872, .08, 1]) {
    for (const eye of actor.rig.eyes) eye.scale.y = blink;
    actor.syncGeometry(); actor.group.updateMatrixWorld(true);
    for (const [sideIndex, eye] of actor.rig.eyes.entries()) {
      const mesh = surfaces[sideIndex], side = Math.sign(eye.position.x), cx = -side * .0025 * k, cy = -.0005 * k;
      const hitAt = (x, y) => {
        const origin = eye.localToWorld(new THREE.Vector3(x, y / blink, .3));
        ray.set(origin, new THREE.Vector3(0, 0, -1).transformDirection(eye.matrixWorld));
        return ray.intersectObject(mesh, false)[0];
      };
      for (const dx of [0, -.009 * k, .009 * k]) {
        const hit = hitAt(cx + dx, cy); assert(hit?.uv, 'fixed pupil position remains on the aperture');
        assert(Math.abs(hit.uv.x - (.5 + dx / k / chart.width)) < 8e-8);
        assert(Math.abs(hit.uv.y - .5) < 8e-8, 'blink must not move the pigment centre');
        const radius = Math.hypot((hit.uv.x - .5) * chart.width, (hit.uv.y - .5) * chart.height);
        assert(Math.abs(radius - Math.abs(dx / k)) < 5e-9, 'physical pupil radius does not squash');
        mappedHits++;
      }
      // The shorter authored opening covers the 9mm pupil-top point sooner.
      // Decide exposure from the independent physical polygon, then retain exact
      // UV expectations on every ray that should remain visible. The 6mm sample
      // still exercises vertical pigment mapping during the half blink.
      for (const dy of [.006, .009]) {
        const px = cx / k, py = (cy / k + dy) / blink;
        const exposed = opening.every((start, j) => {
          const end = opening[(j + 1) % opening.length];
          return (end.x - start.x) * (py - start.y) - (end.y - start.y) * (px - start.x) >= 0;
        });
        const hit = hitAt(cx, cy + dy * k);
        if (!exposed) { assert.equal(hit, undefined, 'closed margin covers the physical pigment point'); coveredPoints++; }
        else {
          assert(hit?.uv, 'physical pigment point remains exposed inside the aperture');
          assert(Math.abs(hit.uv.x - .5) < 8e-8);
          assert(Math.abs(hit.uv.y - (.5 + dy / chart.height)) < 8e-8); mappedHits++;
        }
      }
      const position = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
      let minV = Infinity, maxV = -Infinity;
      for (let i = 0; i < position.count; i++) {
        assert.equal(position.getY(i), localY[sideIndex][i], 'white retains its original local height');
        minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i));
      }
      assert(Math.abs((maxV - minV) - .029 * blink / chart.height) < 9e-8,
        'closing aperture samples a narrower original pigment strip');
    }
    const versions = surfaces.map(mesh => mesh.geometry.attributes.uv.version);
    actor.syncGeometry(); actor.syncGeometry();
    assert.deepEqual(surfaces.map(mesh => mesh.geometry.attributes.uv.version), versions,
      'steady blink must not upload UVs again');
  }
  surfaces.forEach((mesh, i) => assert.deepEqual(mesh.geometry.attributes.uv.array, openUV[i], 'open reset restores mapping'));
  console.log(`eye-geometry.test.mjs: continuous eye mapping passed (${mappedHits} physical rays, ${coveredPoints} lid-covered points, blink/reset/cache)`);
}
