/**
 * Bind a procedural rig's parts to its own joints (lane 7, 2026-09-23 — fable-5's lane-10 read:
 * "a kid in view is ≈ 50 draws; the next perf item is the kid as merged meshes").
 *
 * `part()` (link.ts) hangs every piece of a kid as a Mesh under the joint it rides, and
 * consolidate.ts merges per joint per material — still ≈ 26 meshes a girl, each drawn again in
 * the shadow pass. Here every Mesh under a joint becomes part of ONE SkinnedMesh per (material,
 * shadow flags) for the whole rig, with the joint as its only bone (weight 1): one submission per
 * material — ≈ 11 in the colour pass, 5 in the shadow pass. Nothing else changes: the poses keep
 * moving the joints (animation.ts, npc.ts), the skeleton reads their world matrices every frame;
 * the blink's Y-squash on the eye groups rides along because a group with meshes is a bone too;
 * `castShadow` per mesh still gates the shadow pass (index.ts scopes it per kid). Bound at the
 * rest pose with the root at the identity (`buildRig` leaves it there), attached bind mode, so the
 * root may move and turn as before.
 */
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Material, Matrix4, Mesh, Object3D, Skeleton, SkinnedMesh, Uint16BufferAttribute, type Bone } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** the rest-pose sphere grows by this so a swung arm or a folded leg at the frame's edge is never culled */
const REACH_MARGIN_M = 0.35;

const _identity = new Matrix4();

interface Bucket {
  material: Material;
  first: Mesh;
  parts: BufferGeometry[];
}

/** every geometry merged carries exactly these attributes, indexed, bound wholly to `bone` */
/**
 * A part may ask to be shared between its joint and the joint's parent: `userData.skinBlend =
 * { top, hem }` is the weight given to the PARENT bone at the part's highest vertex and at its lowest
 * (rest pose, root space), interpolated by height between. The skirt's front flaps use it (top 0.85,
 * hem 0.5): rigid on the thigh they pivot into a horizontal shelf when the girl sits, because their
 * rest flare in front of the thigh axis becomes height above the lap; shared with the hips they hang
 * from the waist and drape down over the thigh, and swing half the stride when she walks.
 */
export interface SkinBlend {
  top: number;
  hem: number;
}

function normalise(g: BufferGeometry, bone: number, parentBone = -1, blend?: SkinBlend): BufferGeometry {
  const n = g.attributes.position.count;
  if (!g.index) {
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2));
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const pos = g.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  if (blend && parentBone >= 0) {
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  for (let i = 0; i < n; i++) {
    if (blend && parentBone >= 0) {
      const t = maxY > minY ? (pos.getY(i) - minY) / (maxY - minY) : 1;
      const wp = Math.min(1, Math.max(0, blend.hem + (blend.top - blend.hem) * t));
      si[i * 4] = bone;
      si[i * 4 + 1] = parentBone;
      sw[i * 4] = 1 - wp;
      sw[i * 4 + 1] = wp;
    } else {
      si[i * 4] = bone;
      sw[i * 4] = 1;
    }
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
  return g;
}

export function skinRig(root: Object3D): { before: number; after: number; bones: number } {
  root.updateMatrixWorld(true);
  const bones: Object3D[] = [];
  const buckets = new Map<string, Bucket>();
  const doomed: Mesh[] = [];
  let before = 0;
  root.traverse((o) => {
    let boneIndex = -1;
    for (const child of o.children) {
      const m = child as Mesh;
      if (!m.isMesh || (m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh || Array.isArray(m.material)) continue;
      if (boneIndex < 0) {
        boneIndex = bones.length;
        bones.push(o);
      }
      before++;
      m.updateMatrix();
      const g = m.geometry;
      if (!m.matrix.equals(_identity)) g.applyMatrix4(m.matrix);
      // the part's vertices are in the joint's space; the skinned mesh wants them in the root's rest space
      // (its bind space) — the bone inverses take them back to the joint, the bones' world matrices move them
      g.applyMatrix4(o.matrixWorld);
      const blend = m.userData.skinBlend as SkinBlend | undefined;
      let parentBone = -1;
      if (blend && o.parent) {
        parentBone = bones.indexOf(o.parent);
        if (parentBone < 0) {
          parentBone = bones.length;
          bones.push(o.parent);
        }
      }
      normalise(g, boneIndex, parentBone, blend);
      const key = `${m.material.uuid}|${m.castShadow ? 1 : 0}|${m.receiveShadow ? 1 : 0}|${m.renderOrder}|${m.visible ? 1 : 0}|${m.layers.mask}`;
      const b = buckets.get(key);
      if (b) b.parts.push(g);
      else buckets.set(key, { material: m.material, first: m, parts: [g] });
      doomed.push(m);
    }
  });
  if (!bones.length) return { before, after: before, bones: 0 };
  const skeleton = new Skeleton(bones as unknown as Bone[]);
  const kept = new Set<BufferGeometry>();
  let after = 0;
  for (const b of buckets.values()) {
    const geo = b.parts.length === 1 ? b.parts[0] : mergeGeometries(b.parts, false);
    if (!geo) throw new Error('character: skinRig merge failed');
    kept.add(geo);
    const mesh = new SkinnedMesh(geo, b.material);
    mesh.name = `skinned:${b.first.name}`;
    mesh.castShadow = b.first.castShadow;
    mesh.receiveShadow = b.first.receiveShadow;
    mesh.renderOrder = b.first.renderOrder;
    mesh.visible = b.first.visible;
    mesh.layers.mask = b.first.layers.mask;
    mesh.userData = { ...b.first.userData };
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton);
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += REACH_MARGIN_M;
    after++;
  }
  for (const m of doomed) {
    m.removeFromParent();
    if (!kept.has(m.geometry)) m.geometry.dispose();
  }
  return { before, after, bones: bones.length };
}
