/** Run: node src/world/character/eye-geometry.test.mjs (CPU only). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

// Follow the character tests' in-memory TypeScript loader; no emitted files or browser.
const source = ts.transpileModule(readFileSync(new URL('./eye-geometry.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(id => {
  assert.equal(id, 'three'); return THREE;
}, mod, mod.exports);
const { createLinkEyeDisc } = mod.exports;

// This is the existing eyelid's perimeter, independent of the disc's tessellation.
const opening = Array.from({ length: 28 }, (_, i) => {
  const a = i / 28 * Math.PI * 2, sy = Math.sin(a);
  return new THREE.Vector2(.025 * Math.cos(a), .0145 * sy * (.82 + .18 * Math.abs(sy)));
});
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
let testedTriangles = 0;
for (const scale of [1, .145 / .125]) for (const side of [-1, 1]) {
  const iris = createLinkEyeDisc(scale, side, .016, .0006);
  const pupil = createLinkEyeDisc(scale, side, .009, .001);
  for (const [geometry, radius, depth] of [[iris, .016, .0006], [pupil, .009, .001]]) {
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
    if (radius === .016) {
      assert(geometry.boundingBox.min.y > (-.0005 - radius) * scale + .001 * scale, 'larger iris is visibly clipped at the lower lid');
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
  mesh.material.dispose(); iris.dispose(); pupil.dispose();
}
console.log(`eye-geometry.test.mjs: clipping, curved layers and +Z winding passed (${testedTriangles} triangles)`);
