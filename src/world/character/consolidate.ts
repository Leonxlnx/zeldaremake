/**
 * Draw-call consolidation for the procedural rigs (W38). Every `part()` is its own Mesh under a
 * joint, so a character cost ~90 meshes — 269–311 draw calls with the shadow pass for Link, Navi
 * and the three kids, a third of the 700 budget, for 0.05 M triangles. Parts under the SAME joint
 * move rigidly together (animation.ts rotates joints, never meshes, and `part()` leaves every mesh
 * at the identity local transform), so the direct Mesh children of each joint that share a
 * material, shadow flags, render order, layers and attribute layout are merged into one Mesh on
 * that joint. World transforms, materials and vertex data are unchanged, so the render is the
 * same; only the submission grouping changes. Sprites, Points and transformed meshes are skipped.
 */
import { Matrix4, Mesh, type BufferAttribute, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const identity = new Matrix4();

export interface ConsolidateResult {
  /** meshes under the root before / after */
  before: number;
  after: number;
  /** merged meshes created */
  merged: number;
}

export function consolidateRigParts(root: Object3D): ConsolidateResult {
  root.updateMatrixWorld(true);
  const parents: Object3D[] = [];
  root.traverse((o) => parents.push(o));
  let before = 0;
  let after = 0;
  let merged = 0;
  for (const parent of parents) {
    const buckets = new Map<string, Mesh[]>();
    for (const child of parent.children) {
      const m = child as Mesh;
      if (!m.isMesh) continue;
      before++;
      after++;
      // only plain meshes (no instancing / skinning), at rest on their joint, with one opaque material
      if ((m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || (m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) continue;
      if (m.children.length) continue;
      m.updateMatrix();
      if (!m.matrix.equals(identity)) continue;
      const mat = m.material;
      if (Array.isArray(mat) || mat.transparent) continue;
      const g = m.geometry;
      if (Object.keys(g.morphAttributes).length > 0) continue;
      const layout = Object.keys(g.attributes)
        .sort()
        .map((n) => {
          const a = g.attributes[n] as BufferAttribute;
          return `${n}:${a.itemSize}:${a.array.constructor.name}:${a.normalized ? 1 : 0}`;
        })
        .join(',');
      const key = [mat.uuid, m.customDepthMaterial?.uuid, m.customDistanceMaterial?.uuid, m.castShadow, m.receiveShadow, m.renderOrder, m.layers.mask, m.visible, m.frustumCulled, g.index ? 'i' : 'n', layout].join('|');
      const list = buckets.get(key);
      if (list) list.push(m);
      else buckets.set(key, [m]);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geo = mergeGeometries(
        list.map((m) => m.geometry),
        false,
      );
      if (!geo) continue;
      const first = list[0];
      const mesh = new Mesh(geo, first.material);
      mesh.name = `merged:${first.name}`;
      mesh.customDepthMaterial = first.customDepthMaterial;
      mesh.customDistanceMaterial = first.customDistanceMaterial;
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      mesh.layers.mask = first.layers.mask;
      mesh.visible = first.visible;
      mesh.frustumCulled = first.frustumCulled;
      for (const m of list) {
        m.removeFromParent();
        m.geometry.dispose();
      }
      parent.add(mesh);
      after -= list.length - 1;
      merged++;
    }
  }
  return { before, after, merged };
}
