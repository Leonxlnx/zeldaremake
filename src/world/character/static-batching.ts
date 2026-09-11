/** Consolidate only Link's static surfaces that already share an animated parent. */
import { BufferAttribute, Matrix4, Mesh, Object3D, StaticDrawUsage } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Rig } from './rig';

export interface StaticBatchPart {
  name: string;
  start: number;
  count: number;
}

const completed = new WeakSet<Rig>();
const identity = new Matrix4();

/** Construction-only: no source mesh may still be a fitting or animation target. */
function combine(root: Object3D, parent: Object3D, meshes: Mesh[], expected: number): void {
  if (meshes.length !== expected) throw new Error(`Link static batch changed under ${parent.name}`);
  const first = meshes[0], attributes = Object.keys(first.geometry.attributes).sort();
  const sourceGeometries = new Set(meshes.map(mesh => mesh.geometry));
  for (const mesh of meshes) {
    mesh.updateMatrix();
    if (mesh.parent !== parent || !mesh.matrix.equals(identity) || mesh.children.length
      || mesh.material !== first.material || Array.isArray(mesh.material)
      || mesh.castShadow !== first.castShadow || mesh.receiveShadow !== first.receiveShadow
      || mesh.visible !== first.visible || mesh.renderOrder !== first.renderOrder
      || mesh.layers.mask !== first.layers.mask || mesh.frustumCulled !== first.frustumCulled
      || mesh.customDepthMaterial !== first.customDepthMaterial
      || mesh.customDistanceMaterial !== first.customDistanceMaterial
      || mesh.onBeforeRender !== first.onBeforeRender || mesh.onAfterRender !== first.onAfterRender
      || mesh.onBeforeShadow !== first.onBeforeShadow || mesh.onAfterShadow !== first.onAfterShadow
      || !mesh.geometry.index
      || mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count !== Infinity
      || Object.keys(mesh.geometry.morphAttributes).length
      || Object.keys(mesh.geometry.attributes).sort().join(',') !== attributes.join(',')) {
      throw new Error(`Link static batch cannot preserve ${mesh.name}`);
    }
    for (const name of attributes) {
      const attribute = mesh.geometry.getAttribute(name), reference = first.geometry.getAttribute(name);
      if (!(attribute instanceof BufferAttribute) || !(reference instanceof BufferAttribute)
        || attribute.usage !== StaticDrawUsage || attribute.itemSize !== reference.itemSize
        || attribute.normalized !== reference.normalized || attribute.gpuType !== reference.gpuType
        || attribute.array.constructor !== reference.array.constructor) {
        throw new Error(`Link static batch requires matching static ${name} attributes`);
      }
    }
  }
  // Disposing a source is safe only when no other live mesh still owns it.
  root.traverse(object => {
    if (object instanceof Mesh && sourceGeometries.has(object.geometry) && !meshes.includes(object)) {
      throw new Error('Link static batch cannot dispose shared source geometry');
    }
  });
  const parts: StaticBatchPart[] = [];
  let start = 0;
  for (const mesh of meshes) {
    const count = mesh.geometry.index!.count;
    parts.push({ name: mesh.name, start, count }); start += count;
  }
  // Concatenation preserves every attribute and triangle; no welding or normal rebuild.
  const geometry = mergeGeometries(meshes.map(mesh => mesh.geometry), false);
  if (!geometry) throw new Error('Link static batch geometry merge failed');
  geometry.name = `link-static-${parent.name}-${first.name}`;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  first.geometry = geometry;
  first.userData.staticBatch = parts;
  for (const mesh of meshes.slice(1)) parent.remove(mesh);
  for (const source of sourceGeometries) source.dispose();
}

/**
 * Call only from createLink, after all fitted outfit details and boot setup finish.
 * Rig groups, dynamic arms, boots, eye groups and NPC builders stay independent.
 * Five remaining batches replace eleven meshes, removing six static draws.
 */
export function batchStaticLinkParts(rig: Rig): void {
  if (completed.has(rig)) return;
  const select = (parent: Object3D, names: readonly string[]) => parent.children.filter(
    (object): object is Mesh => object instanceof Mesh && names.includes(object.name),
  );
  for (const elbow of [rig.elbowL, rig.elbowR]) {
    if (rig.root.userData.linkContinuousArms) continue;
    combine(rig.root, elbow, select(elbow, ['elbow', 'forearm', 'hand']), 3);
  }
  for (const knee of [rig.kneeL, rig.kneeR]) {
    combine(rig.root, knee, select(knee, ['shin', 'knee']), 2);
  }
  combine(rig.root, rig.chest, select(rig.chest, ['undershirt', 'neckline-insert']), 2);
  const collars = select(rig.chest, ['collar-flap']);
  const greenStrap = select(rig.chest, ['strap']).filter(mesh => mesh.material === collars[0]?.material);
  combine(rig.root, rig.chest, [...collars, ...greenStrap], 3);
  combine(rig.root, rig.hips, select(rig.hips, ['tunic-front-panel']), 2);
  completed.add(rig);
}
