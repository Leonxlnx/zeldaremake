/** Original Link boot articulation; the existing ankle/sole solver remains authoritative. */
import {
  BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Mesh, Quaternion,
  SphereGeometry, Vector3,
} from 'three';
import type { Rig } from './rig';

type Surface = { position: number[]; normal: number[]; uv: number[]; index: number[] };
type MovingSurface = {
  geometry: BufferGeometry;
  position: Float32Array;
  normal: Float32Array;
  first: number;
  end: number;
};

function surface(): Surface { return { position: [], normal: [], uv: [], index: [] }; }

function append(target: Surface, source: Surface): void {
  const offset = target.position.length / 3;
  target.position.push(...source.position); target.normal.push(...source.normal);
  target.uv.push(...source.uv);
  for (const i of source.index) target.index.push(offset + i);
}

/** Split at an existing instep ring, closing both cut ends inside a leather ankle joint. */
function articulatedUpper(original: BufferGeometry, cutY: number): MovingSurface {
  const position = original.getAttribute('position'), normal = original.getAttribute('normal');
  const uv = original.getAttribute('uv'), index = original.getIndex();
  if (!index) throw new Error('Articulated Link boot requires its indexed hollow loft');
  const foot = surface(), shaft = surface(), epsilon = 1e-7;
  const maps = [new Map<number, number>(), new Map<number, number>()];
  const copy = (target: Surface, sourceIndex: number, capNormal?: number) => {
    const i = target.position.length / 3;
    target.position.push(position.getX(sourceIndex), position.getY(sourceIndex), position.getZ(sourceIndex));
    target.normal.push(...(capNormal === undefined
      ? [normal.getX(sourceIndex), normal.getY(sourceIndex), normal.getZ(sourceIndex)] : [0, capNormal, 0]));
    target.uv.push(uv.getX(sourceIndex), uv.getY(sourceIndex));
    return i;
  };
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const heights = ids.map(j => position.getY(j));
    const lower = Math.max(...heights) <= cutY + epsilon;
    if (!lower && Math.min(...heights) < cutY - epsilon) {
      throw new Error('Link boot articulation must cut on an existing instep ring');
    }
    const target = lower ? foot : shaft, map = maps[lower ? 0 : 1];
    for (const j of ids) {
      if (!map.has(j)) map.set(j, copy(target, j));
      target.index.push(map.get(j)!);
    }
  }
  // The original loft gives its outer and inner cut rings distinct V coordinates.
  const rings = new Map<number, number[]>();
  for (let i = 0; i < position.count; i++) if (Math.abs(position.getY(i) - cutY) < epsilon) {
    const v = uv.getY(i);
    if (!rings.has(v)) rings.set(v, []);
    rings.get(v)!.push(i);
  }
  const radius = (ring: number[]) => ring.reduce((sum, i) =>
    sum + Math.hypot(position.getX(i), position.getZ(i)), 0) / ring.length;
  const [outer, inner] = [...rings.values()].sort((a, b) => radius(b) - radius(a));
  if (rings.size !== 2 || outer.length !== inner.length || outer.length < 3) {
    throw new Error('Link boot instep needs matching outer and inner cut rings');
  }
  const angle = (i: number) => Math.atan2(position.getX(i), position.getZ(i));
  outer.sort((a, b) => angle(a) - angle(b)); inner.sort((a, b) => angle(a) - angle(b));
  for (const [target, capNormal] of [[foot, 1], [shaft, -1]] as const) {
    const outside = outer.map(i => copy(target, i, capNormal));
    const inside = inner.map(i => copy(target, i, capNormal));
    for (let i = 0; i < outer.length; i++) {
      const next = (i + 1) % outer.length;
      const triangles = [outside[i], outside[next], inside[i], outside[next], inside[next], inside[i]];
      if (capNormal < 0) for (let j = 0; j < triangles.length; j += 3) {
        [triangles[j + 1], triangles[j + 2]] = [triangles[j + 2], triangles[j + 1]];
      }
      target.index.push(...triangles);
    }
  }
  const combined = surface(); append(combined, foot);
  const first = combined.position.length / 3;
  append(combined, shaft);
  const end = combined.position.length / 3;
  // A closed rounded leather joint covers the overlapping cut rims as the shaft turns.
  // Its bottom stays 1 mm above Link's -65 mm sole. No height-weighted skinning: even
  // large ankle angles keep each component rigid, without folded/inverted triangles.
  const joint = new SphereGeometry(1, 32, 24).scale(.066, .064, .066);
  const ball = surface();
  for (let i = 0; i < joint.attributes.position.count; i++) {
    const p = joint.attributes.position, n = joint.attributes.normal, t = joint.attributes.uv;
    ball.position.push(p.getX(i), p.getY(i), p.getZ(i));
    ball.normal.push(n.getX(i), n.getY(i), n.getZ(i));
    ball.uv.push(t.getX(i), t.getY(i));
  }
  ball.index.push(...joint.index!.array); append(combined, ball); joint.dispose();
  const geometry = new BufferGeometry();
  geometry.name = 'original-link-articulated-boot-upper';
  geometry.setAttribute('position', new Float32BufferAttribute(combined.position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(combined.normal, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(combined.uv, 2));
  geometry.setIndex(combined.index);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return movingSurface(geometry, first, end);
}

function movingSurface(geometry: BufferGeometry, first = 0,
  end = geometry.getAttribute('position').count): MovingSurface {
  const position = geometry.getAttribute('position') as Float32BufferAttribute;
  const normal = geometry.getAttribute('normal') as Float32BufferAttribute;
  position.setUsage(DynamicDrawUsage); normal.setUsage(DynamicDrawUsage);
  return { geometry, position: new Float32Array(position.array), normal: new Float32Array(normal.array), first, end };
}

const callbacks = new WeakMap<Rig, () => void>();

/**
 * Call once after Link's outfit details exist, then invoke the returned function after
 * each pose update, before rendering (including shadow passes). Only the original Link
 * boot loft opts in; Kokiri boots and all sole geometry are untouched.
 */
export function createBootArticulation(rig: Rig): () => void {
  const existing = callbacks.get(rig);
  if (existing) return existing;
  const legs: { knee: Rig['kneeL']; ankle: Rig['ankleL']; surfaces: MovingSurface[] }[] = [];
  for (const [knee, ankle] of [[rig.kneeL, rig.ankleL], [rig.kneeR, rig.ankleR]]) {
    const boot = ankle.getObjectByName('boot');
    if (!(boot instanceof Mesh) || boot.geometry.name !== 'original-link-hollow-boot-upper') continue;
    const original = boot.geometry, upper = articulatedUpper(original, rig.sole.y + .075);
    boot.geometry = upper.geometry; original.dispose();
    const surfaces = [upper];
    for (const name of ['boot-cuff', 'boot-tongue', 'boot-laces', 'boot-buckle']) {
      const detail = ankle.getObjectByName(name);
      if (detail instanceof Mesh) surfaces.push(movingSurface(detail.geometry));
    }
    legs.push({ knee, ankle, surfaces });
  }
  const up = new Vector3(0, 1, 0), direction = new Vector3(), vertex = new Vector3();
  const rotation = new Quaternion();
  const sync = () => {
    // World matrices may otherwise still describe the prior animation frame.
    rig.root.updateMatrixWorld(true);
    for (const { knee, ankle, surfaces } of legs) {
      knee.getWorldPosition(direction); ankle.worldToLocal(direction);
      if (direction.lengthSq() < 1e-12) continue;
      rotation.setFromUnitVectors(up, direction.normalize());
      for (const source of surfaces) {
        const position = source.geometry.getAttribute('position');
        const normal = source.geometry.getAttribute('normal');
        for (let i = source.first; i < source.end; i++) {
          vertex.fromArray(source.position, i * 3).applyQuaternion(rotation);
          position.setXYZ(i, vertex.x, vertex.y, vertex.z);
          vertex.fromArray(source.normal, i * 3).applyQuaternion(rotation);
          normal.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        position.needsUpdate = true; normal.needsUpdate = true;
        source.geometry.computeBoundingBox(); source.geometry.computeBoundingSphere();
      }
    }
  };
  callbacks.set(rig, sync);
  return sync;
}
