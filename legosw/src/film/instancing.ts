import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bake a (posed) model hierarchy into one geometry per material, then instance it — so a swarm of
 * 40 droid fighters costs a handful of draw calls instead of hundreds.
 */
export function flatten(root: Object3D): { material: Material; geometry: BufferGeometry }[] {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map<Material, BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.visible) return;
    let vis = true;
    for (let p: Object3D | null = o; p && p !== root; p = p.parent) if (!p.visible) vis = false;
    if (!vis) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()) as BufferGeometry;
    g.applyMatrix4(new Matrix4().multiplyMatrices(inv, m.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.getAttribute('color')) {
      const n = g.getAttribute('position').count;
      const c = new Float32Array(n * 3).fill(1);
      g.setAttribute('color', new (g.getAttribute('position').constructor as typeof import('three').BufferAttribute)(c, 3));
    }
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('uv', new (g.getAttribute('position').constructor as typeof import('three').BufferAttribute)(new Float32Array(n * 2), 2));
    }
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(g);
  });
  const out: { material: Material; geometry: BufferGeometry }[] = [];
  for (const [material, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (merged) {
      merged.computeBoundingSphere();
      out.push({ material, geometry: merged });
    }
  }
  return out;
}

export class Swarm {
  group = new Group();
  meshes: InstancedMesh[] = [];
  count: number;
  constructor(root: Object3D, count: number, name: string) {
    this.count = count;
    this.group.name = name;
    for (const p of flatten(root)) {
      const im = new InstancedMesh(p.geometry, p.material, count);
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = true;
      this.meshes.push(im);
      this.group.add(im);
    }
  }
  set(i: number, m: Matrix4): void {
    for (const im of this.meshes) im.setMatrixAt(i, m);
  }
  commit(n = this.count): void {
    for (const im of this.meshes) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
