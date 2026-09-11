/** Cached conservative convex envelopes of the constructed Link lower body.
 * Geometry is read only at construction. Queries do not pose or mutate the rig.
 * Separation bounds describe the convex envelopes, not exact concave mesh distance.
 */
import { Box3, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import type { Rig } from './rig';

export interface RigidFrame { position: Vector3; rotation: Quaternion }
export interface LegFrames { hip: RigidFrame; knee: RigidFrame; ankle: RigidFrame }
export interface PairFrames { left: LegFrames; right: LegFrames }
export type ClearanceStatus = 'clear' | 'blocked' | 'uncertain';
export interface LowerBodyResult {
  status: ClearanceStatus;
  /** Separation of the union of all opposing convex envelopes. */
  distanceLower: number; distanceUpper: number;
  /** The constraining envelope pair, left then right. */
  pair: [string, string] | null;
  queries: number; iterations: number; reason?: string;
}
interface ClearanceOptions { margin?: number; maxIterations?: number }
interface ClearanceResult {
  status: ClearanceStatus; distanceLower: number; distanceUpper: number;
  witnessFoot: Vector3; witnessCuff: Vector3; normal: Vector3;
  iterations: number; reason?: string;
}

// The following hull/support/simplex/GJK kernel is copied from the independently
// tested frozen boot-placement candidate. No authored models or routing code are reused.
type Pose = { ankle: Vector3; rotation: Quaternion };
type Hull = { points: Vector3[]; centre: Vector3; radius: number; bounds: Box3 };
type Vertex = { point: Vector3; a: Vector3; b: Vector3 };
type Closest = { vertices: Vertex[]; weights: number[]; point: Vector3 };
const ROUND_OFF = 1e-9;
const UP = new Vector3(0, 1, 0);

function finite(v: Vector3): boolean { return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z); }
function pose(input: Pose): Pose | null {
  const q = input.rotation;
  if (!finite(input.ankle) || ![q.x, q.y, q.z, q.w].every(Number.isFinite) || q.lengthSq() < 1e-12) return null;
  return { ankle: input.ankle.clone(), rotation: q.clone().normalize() };
}
function hull(vertices: readonly Vector3[]): Hull {
  if (!vertices.length || vertices.some(v => !finite(v))) throw new RangeError('Clearance hull needs finite vertices');
  const unique = [...new Map(vertices.map(v => [`${v.x},${v.y},${v.z}`, v.clone()])).values()];
  let points = unique;
  const origin = unique[0];
  const line = unique.reduce((best, p) => p.distanceToSquared(origin) > best.distanceToSquared(origin) ? p : best, origin).clone().sub(origin);
  const plane = unique.reduce((best, p) => {
    const n = line.clone().cross(p.clone().sub(origin)); return n.lengthSq() > best.lengthSq() ? n : best;
  }, new Vector3());
  const volume = Math.max(...unique.map(p => Math.abs(plane.dot(p.clone().sub(origin)))));
  // Keep the exact hull vertices; sampling support directions would create an unsafe inscribed hull.
  if (unique.length >= 4 && volume > Math.pow(line.length(), 3) * 1e-12) {
    const convex = new ConvexHull().setFromPoints(unique);
    if (convex.faces.length) {
      const used = new Set<Vector3>();
      for (const face of convex.faces) { let edge = face.edge; do { used.add(edge.head().point); edge = edge.next; } while (edge !== face.edge); }
      if (used.size) points = [...used];
    }
  }
  const bounds = new Box3().setFromPoints(points);
  return { points, bounds, centre: bounds.getCenter(new Vector3()), radius: Math.max(...points.map(p => p.length())) };
}
function support(shape: Hull, at: Pose, direction: Vector3): Vector3 {
  const local = direction.clone().applyQuaternion(at.rotation.clone().invert());
  let best = shape.points[0], value = best.dot(local);
  for (let i = 1; i < shape.points.length; i++) { const d = shape.points[i].dot(local); if (d > value) { value = d; best = shape.points[i]; } }
  return best.clone().applyQuaternion(at.rotation).add(at.ankle);
}
function minkowski(a: Hull, pa: Pose, b: Hull, pb: Pose, direction: Vector3): Vertex {
  const av = support(a, pa, direction), bv = support(b, pb, direction.clone().negate());
  return { point: av.clone().sub(bv), a: av, b: bv };
}

/** Solve a 1–3 variable Gram system. Singular affine subsets are handled by their lower-dimensional faces. */
function linear(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length, m = matrix.map((row, i) => [...row, rhs[i]]);
  const scale = Math.max(...matrix.flat().map(Math.abs));
  if (!(scale > 0)) return null;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    if (Math.abs(m[pivot][col]) <= scale * 1e-13) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const divisor = m[col][col]; for (let j = col; j <= n; j++) m[col][j] /= divisor;
    for (let row = 0; row < n; row++) if (row !== col) { const f = m[row][col]; for (let j = col; j <= n; j++) m[row][j] -= f * m[col][j]; }
  }
  return m.map(row => row[n]);
}

/** Closest point in a simplex: enumerate its at most 15 affine faces, retaining only convex weights. */
function closest(vertices: Vertex[]): Closest {
  let best: Closest = { vertices: [vertices[0]], weights: [1], point: vertices[0].point.clone() };
  let distance = best.point.lengthSq();
  for (let mask = 1; mask < 1 << vertices.length; mask++) {
    const selected = vertices.filter((_, i) => mask & 1 << i);
    const origin = selected[0].point;
    const axes = selected.slice(1).map(v => v.point.clone().sub(origin));
    const solved = axes.length ? linear(axes.map(a => axes.map(b => a.dot(b))), axes.map(a => -a.dot(origin))) : [];
    if (!solved) continue;
    let weights = [1 - solved.reduce((s, v) => s + v, 0), ...solved];
    if (weights.some(w => w < -1e-10 || !Number.isFinite(w))) continue;
    weights = weights.map(w => Math.max(0, w));
    const total = weights.reduce((s, w) => s + w, 0); weights = weights.map(w => w / total);
    const point = selected.reduce((p, v, i) => p.addScaledVector(v.point, weights[i]), new Vector3());
    const d = point.lengthSq();
    if (d < distance) {
      const active = selected.map((v, i) => ({ v, w: weights[i] })).filter(x => x.w > 1e-12);
      const sum = active.reduce((s, x) => s + x.w, 0);
      best = { vertices: active.map(x => x.v), weights: active.map(x => x.w / sum), point: new Vector3() };
      best.vertices.forEach((v, i) => best.point.addScaledVector(v.point, best.weights[i]));
      distance = best.point.lengthSq();
    }
  }
  return best;
}
function unknown(reason: string): ClearanceResult {
  return { status: 'uncertain', distanceLower: 0, distanceUpper: Infinity, witnessFoot: new Vector3(), witnessCuff: new Vector3(), normal: new Vector3(), iterations: 0, reason };
}
function gjk(a: Hull, pa: Pose, b: Hull, pb: Pose, options: ClearanceOptions): ClearanceResult {
  const margin = options.margin ?? .004;
  if (!Number.isFinite(margin) || margin < 0) return unknown('invalid-margin');
  const budget = Math.max(1, Math.min(48, Math.floor(options.maxIterations ?? 24)));
  if (!Number.isFinite(budget)) return unknown('invalid-budget');
  const direction = a.centre.clone().applyQuaternion(pa.rotation).add(pa.ankle).sub(b.centre.clone().applyQuaternion(pb.rotation).add(pb.ankle));
  if (direction.lengthSq() < 1e-20) direction.set(1, 0, 0);
  let simplex = closest([minkowski(a, pa, b, pb, direction)]), lower = 0;
  let normal = direction.clone().normalize(), iterations = 0, reason: string | undefined;
  const finish = (): ClearanceResult => {
    const witnessFoot = new Vector3(), witnessCuff = new Vector3();
    simplex.vertices.forEach((v, i) => { witnessFoot.addScaledVector(v.a, simplex.weights[i]); witnessCuff.addScaledVector(v.b, simplex.weights[i]); });
    const upper = witnessFoot.distanceTo(witnessCuff) + ROUND_OFF;
    const lo = Math.max(0, Math.min(lower - ROUND_OFF, upper));
    const status = lo >= margin && (margin > 0 || lo > 0) ? 'clear' : upper < margin || upper <= ROUND_OFF * 2 ? 'blocked' : 'uncertain';
    return { status, distanceLower: lo, distanceUpper: upper, witnessFoot, witnessCuff, normal, iterations, ...(reason ? { reason } : {}) };
  };
  for (; iterations < budget;) {
    iterations++;
    const upper = simplex.point.length();
    if (upper <= ROUND_OFF || upper + ROUND_OFF < margin) return finish();
    const n = simplex.point.clone().divideScalar(upper);
    const next = minkowski(a, pa, b, pb, n.clone().negate());
    const bound = next.point.dot(n);
    if (bound > lower) { lower = bound; normal = n; }
    if (lower - ROUND_OFF >= margin && (margin > 0 || lower > ROUND_OFF)) return finish();
    if (upper - lower <= ROUND_OFF * 2) { reason = 'margin-boundary'; return finish(); }
    if (simplex.vertices.some(v => v.point.distanceToSquared(next.point) < 1e-24)) { reason = 'duplicate-support'; return finish(); }
    simplex = closest([...simplex.vertices, next]);
  }
  reason = 'iteration-budget';
  return finish();
}

// End of the frozen pure convex-pair kernel.

type Side = 'left' | 'right';
type Binding = 'hip' | 'knee' | 'ankle' | 'calf';
type Component = {
  name: string; side: Side; sourceMesh: string; sourcePart: string;
  sourceTriangleIds: number[]; sourceVertexIds: number[];
  binding: Binding; shape: Hull; centroid: Vector3;
  offsetPosition: Vector3; offsetRotation: Quaternion;
  maxRadius: number;
};
type Source = {
  side: Side; name: string; geometryName: string; vertexCount: number;
  indexCount: number; meshToJoint: number[]; unreferencedVertexIds: number[];
};
const UNIT_SCALE = new Vector3(1, 1, 1);
const IDENTITY = new Quaternion();
const CUT_EPSILON = 1e-7;
const CALF_PARTS = new Set(['boot-cuff', 'boot-tongue', 'boot-laces', 'boot-buckle']);

/** Exact index connectivity deliberately does not weld coincident anatomical cut rims. */
function patches(mesh: Mesh, triangleIds: readonly number[]): number[][] {
  const index = mesh.geometry.getIndex()!;
  const count = mesh.geometry.getAttribute('position').count;
  const parent = new Int32Array(count); parent.fill(-1);
  const find = (v: number): number => {
    if (parent[v] < 0) parent[v] = v;
    let root = v;
    while (parent[root] !== root) root = parent[root];
    while (v !== root) { const next = parent[v]; parent[v] = root; v = next; }
    return root;
  };
  for (const t of triangleIds) {
    const a = find(index.getX(t * 3));
    for (let j = 1; j < 3; j++) { const b = find(index.getX(t * 3 + j)); if (a !== b) parent[b] = a; }
  }
  const groups = new Map<number, number[]>();
  for (const t of triangleIds) {
    const root = find(index.getX(t * 3));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(t);
  }
  return [...groups.values()];
}

function referencedVertices(mesh: Mesh, triangleIds: readonly number[]): number[] {
  const index = mesh.geometry.getIndex()!, used = new Set<number>();
  for (const t of triangleIds) for (let j = 0; j < 3; j++) used.add(index.getX(t * 3 + j));
  return [...used].sort((a, b) => a - b);
}

/** Classify the final post-UV-repair mesh; duplicate cap/seam vertices stay covered. */
function splitBoot(mesh: Mesh, triangleIds: readonly number[], cutY: number) {
  if (mesh.geometry.name !== 'original-link-articulated-boot-upper') {
    throw new Error('Lower-body clearance requires the final articulated Link boot');
  }
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
  const groups = { shoe: [] as number[], shaft: [] as number[], joint: [] as number[] };
  for (const component of patches(mesh, triangleIds)) {
    const ids = referencedVertices(mesh, component);
    let lo = Infinity, hi = -Infinity;
    for (const i of ids) { lo = Math.min(lo, position.getY(i)); hi = Math.max(hi, position.getY(i)); }
    let kind: keyof typeof groups;
    if (lo < cutY - CUT_EPSILON && hi > cutY + CUT_EPSILON) {
      // The original ankle ball is the only indexed patch that crosses the cut.
      for (const i of ids) {
        const radius = (position.getX(i) / .066) ** 2 + (position.getY(i) / .064) ** 2 + (position.getZ(i) / .066) ** 2;
        if (Math.abs(radius - 1) > 2e-5) throw new Error('Ambiguous rigid region crossing the boot cut');
      }
      kind = 'joint';
    } else if (hi <= cutY + CUT_EPSILON && lo < cutY - CUT_EPSILON) kind = 'shoe';
    else if (lo >= cutY - CUT_EPSILON && hi > cutY + CUT_EPSILON) kind = 'shaft';
    else {
      // The separate closure caps have opposite hard normals at their coincident rings.
      if (!normal || !ids.every(i => Math.abs(normal.getY(i)) > .999)) throw new Error('Ambiguous planar boot cut');
      const up = normal.getY(ids[0]) > 0;
      if (!ids.every(i => (normal.getY(i) > 0) === up)) throw new Error('Mixed boot closure normals');
      kind = up ? 'shoe' : 'shaft';
    }
    groups[kind].push(...component);
  }
  if (Object.values(groups).some(ids => !ids.length)) throw new Error('Incomplete boot anatomical split');
  return groups;
}

/** Parent offsets are read from local matrices, independent of a caller's root placement. */
function meshToJoint(mesh: Object3D, joint: Object3D): Matrix4 {
  const chain: Object3D[] = [];
  let node: Object3D | null = mesh;
  while (node && node !== joint) { chain.push(node); node = node.parent; }
  if (node !== joint) throw new Error('Lower-body mesh is not below its assigned joint');
  const matrix = new Matrix4();
  for (const child of chain.reverse()) {
    const local = child.matrixAutoUpdate
      ? new Matrix4().compose(child.position, child.quaternion, child.scale) : child.matrix;
    matrix.multiply(local);
  }
  return matrix;
}

/** Construction requires a fresh rest rig; posed dynamic vertices cannot recover their authored rest state. */
export function createLowerBodyClearance(rig: Rig) {
  if (rig.root.userData.character !== 'link') throw new Error('Lower-body clearance requires constructed Link');
  const components: Component[] = [], sources: Source[] = [];
  const sides = [
    ['left', rig.thighL, rig.kneeL, rig.ankleL],
    ['right', rig.thighR, rig.kneeR, rig.ankleR],
  ] as const;
  for (const [side, hip, knee, ankle] of sides) {
    for (const joint of [hip, knee, ankle]) {
      if (joint.quaternion.angleTo(IDENTITY) > 1e-7 || joint.scale.distanceTo(UNIT_SCALE) > 1e-10) {
        throw new Error('Cache lower-body geometry before posing the rest rig');
      }
    }
    const jointBindings = new Map<Object3D, Binding>([[hip, 'hip'], [knee, 'knee'], [ankle, 'ankle']]);
    const add = (mesh: Mesh, sourcePart: string, triangles: number[], binding: Binding, matrix: Matrix4) => {
      if (!triangles.length) throw new Error('Empty lower-body envelope');
      const sourceVertexIds = referencedVertices(mesh, triangles), attribute = mesh.geometry.getAttribute('position');
      const offsetPosition = new Vector3(), offsetRotation = new Quaternion();
      const points = sourceVertexIds.map(i => new Vector3().fromBufferAttribute(attribute, i));
      if (binding === 'calf') {
        // syncGeometry rotates raw geometry BEFORE applying the mesh's local offset.
        // A uniform mesh scale commutes with that rotation; nonuniform scale does not.
        const scale = new Vector3(); matrix.decompose(offsetPosition, offsetRotation, scale);
        const rebuilt = new Matrix4().compose(offsetPosition, offsetRotation, scale);
        if (scale.x <= 0 || Math.max(Math.abs(scale.x - scale.y), Math.abs(scale.x - scale.z)) > 1e-10
          || matrix.elements.some((value, i) => Math.abs(value - rebuilt.elements[i]) > 1e-10)) {
          throw new Error('Articulated lower-body mesh requires a rigid offset and uniform positive scale');
        }
        points.forEach(p => p.multiplyScalar(scale.x));
      } else points.forEach(p => p.applyMatrix4(matrix));
      const shape = hull(points);
      const centroid = shape.points.reduce((mean, p) => mean.add(p), new Vector3()).divideScalar(shape.points.length);
      components.push({
        name: `${side}/${sourcePart}`, side, sourceMesh: mesh.name, sourcePart,
        sourceTriangleIds: [...triangles].sort((a, b) => a - b), sourceVertexIds,
        binding, shape, centroid, offsetPosition, offsetRotation,
        maxRadius: shape.radius + offsetPosition.length(),
      });
    };
    const visit = (node: Object3D, joint: Object3D, binding: Binding) => {
      const bound = jointBindings.get(node);
      if (bound) { joint = node; binding = bound; }
      if (node instanceof Mesh) {
        const index = node.geometry.getIndex(), position = node.geometry.getAttribute('position');
        if (!index || !position || index.count % 3 || node.geometry.drawRange.start !== 0
          || node.geometry.drawRange.count !== Infinity || Object.keys(node.geometry.morphAttributes).length) {
          throw new Error(`Unsupported lower-body source ${node.name}`);
        }
        const triangles = Array.from({ length: index.count / 3 }, (_, i) => i);
        const referenced = new Set(referencedVertices(node, triangles)), matrix = meshToJoint(node, joint);
        sources.push({ side, name: node.name, geometryName: node.geometry.name,
          vertexCount: position.count, indexCount: index.count, meshToJoint: [...matrix.elements],
          unreferencedVertexIds: Array.from({ length: position.count }, (_, i) => i).filter(i => !referenced.has(i)),
        });
        if (node.name === 'boot') {
          if (joint !== ankle) throw new Error('Boot must remain attached to its ankle');
          const split = splitBoot(node, triangles, rig.sole.y + .075);
          add(node, 'boot-shoe', split.shoe, 'ankle', matrix);
          add(node, 'boot-shaft', split.shaft, 'calf', matrix);
          add(node, 'boot-ankle-joint', split.joint, 'ankle', matrix);
        } else if (node.name === 'boot-laces') {
          if (joint !== ankle) throw new Error('Laces must remain attached to their ankle');
          patches(node, triangles).forEach((ids, i) => add(node, `boot-laces-${i}`, ids, 'calf', matrix));
        } else if (CALF_PARTS.has(node.name)) {
          if (joint !== ankle) throw new Error('Boot details must remain attached to their ankle');
          add(node, node.name, triangles, 'calf', matrix);
        } else if (Array.isArray(node.userData.staticBatch)) {
          const covered = new Set<number>();
          for (const part of node.userData.staticBatch as { name: string; start: number; count: number }[]) {
            if (!Number.isInteger(part.start) || !Number.isInteger(part.count) || part.start < 0
              || part.start % 3 || part.count <= 0 || part.count % 3 || part.start + part.count > index.count) {
              throw new Error('Invalid lower-body static batch range');
            }
            const ids = Array.from({ length: part.count / 3 }, (_, i) => part.start / 3 + i);
            for (const t of ids) { if (covered.has(t)) throw new Error('Overlapping lower-body batch parts'); covered.add(t); }
            add(node, part.name, ids, binding, matrix);
          }
          if (covered.size !== triangles.length) throw new Error('Incomplete lower-body static batch coverage');
        } else add(node, node.name, triangles, binding, matrix);
      }
      for (const child of node.children) visit(child, joint, binding);
    };
    visit(hip, hip, 'hip');
  }
  if (new Set(components.map(p => p.name)).size !== components.length) throw new Error('Ambiguous lower-body component names');
  const left = components.filter(c => c.side === 'left'), right = components.filter(c => c.side === 'right');
  if (!left.length || !right.length) throw new Error('Both lower-body sides must be covered');
  const counters = { calls: 0, queries: 0, iterations: 0, aabbPruned: 0, clear: 0, blocked: 0, uncertain: 0 };

  const prepared = (input: PairFrames) => {
    const frames = {} as Record<Side, Record<'hip' | 'knee' | 'ankle', Pose> & { articulation: Quaternion }>;
    for (const side of ['left', 'right'] as const) {
      const leg = input[side];
      const hip = pose({ ankle: leg.hip.position, rotation: leg.hip.rotation });
      const knee = pose({ ankle: leg.knee.position, rotation: leg.knee.rotation });
      const ankle = pose({ ankle: leg.ankle.position, rotation: leg.ankle.rotation });
      if (!hip || !knee || !ankle) return null;
      const direction = knee.ankle.clone().sub(ankle.ankle).applyQuaternion(ankle.rotation.clone().invert());
      if (direction.lengthSq() < 1e-12) return null;
      frames[side] = { hip, knee, ankle, articulation: new Quaternion().setFromUnitVectors(UP, direction.normalize()) };
    }
    return components.map(component => {
      const f = frames[component.side], at = component.binding === 'calf'
        ? { ankle: component.offsetPosition.clone().applyQuaternion(f.ankle.rotation).add(f.ankle.ankle),
          rotation: f.ankle.rotation.clone().multiply(component.offsetRotation).multiply(f.articulation).normalize() }
        : f[component.binding];
      const matrix = new Matrix4().compose(at.ankle, at.rotation, UNIT_SCALE);
      return { component, at, box: component.shape.bounds.clone().applyMatrix4(matrix),
        interior: component.centroid.clone().applyQuaternion(at.rotation).add(at.ankle) };
    });
  };

  return {
    /** Maximum relative point displacement between two solved rigid component
     * states. This covers every cached vertex at the two states; it is not a
     * bound on nonlinear IK between them. The path checker also samples midpoints.
     */
    motionBound(from: PairFrames, to: PairFrames): number {
      const a = prepared(from), b = prepared(to);
      if (!a || !b) return Infinity;
      const largest = { left: 0, right: 0 };
      for (let i = 0; i < a.length; i++) {
        const p = a[i], q = b[i];
        const bound = p.at.ankle.distanceTo(q.at.ankle)
          + 2 * p.component.shape.radius * Math.sin(p.at.rotation.angleTo(q.at.rotation) / 2);
        largest[p.component.side] = Math.max(largest[p.component.side], bound);
      }
      return largest.left + largest.right;
    },
    query(input: PairFrames, margin = .004): LowerBodyResult {
      counters.calls++;
      const finish = (result: LowerBodyResult) => {
        counters.queries += result.queries; counters.iterations += result.iterations; counters[result.status]++;
        return result;
      };
      if (!Number.isFinite(margin) || margin < 0) return finish({ status: 'uncertain', distanceLower: 0,
        distanceUpper: Infinity, pair: null, queries: 0, iterations: 0, reason: 'invalid-margin' });
      const world = prepared(input);
      if (!world) return finish({ status: 'uncertain', distanceLower: 0, distanceUpper: Infinity,
        pair: null, queries: 0, iterations: 0, reason: 'invalid-rigid-frames' });
      const a = world.filter(p => p.component.side === 'left'), b = world.filter(p => p.component.side === 'right');
      let lower = Infinity, upper = Infinity, queries = 0, iterations = 0;
      let pair: [string, string] | null = null, uncertainty: string | undefined;
      for (const pa of a) for (const pb of b) {
        const dx = Math.max(0, pa.box.min.x - pb.box.max.x, pb.box.min.x - pa.box.max.x);
        const dy = Math.max(0, pa.box.min.y - pb.box.max.y, pb.box.min.y - pa.box.max.y);
        const dz = Math.max(0, pa.box.min.z - pb.box.max.z, pb.box.min.z - pa.box.max.z);
        const boxLower = Math.max(0, Math.hypot(dx, dy, dz) - ROUND_OFF);
        upper = Math.min(upper, pa.interior.distanceTo(pb.interior) + ROUND_OFF);
        if (boxLower >= margin && (margin > 0 || boxLower > 0)) {
          counters.aabbPruned++;
          if (boxLower < lower) { lower = boxLower; pair = [pa.component.name, pb.component.name]; }
          continue;
        }
        const result = gjk(pa.component.shape, pa.at, pb.component.shape, pb.at, { margin });
        queries++; iterations += result.iterations;
        upper = Math.min(upper, result.distanceUpper);
        if (result.distanceLower < lower) { lower = result.distanceLower; pair = [pa.component.name, pb.component.name]; }
        if (result.status === 'blocked') return finish({ status: 'blocked', distanceLower: 0,
          distanceUpper: upper, pair: [pa.component.name, pb.component.name], queries, iterations,
          reason: 'convex-envelope-margin' });
        if (result.status === 'uncertain') { uncertainty = result.reason ?? 'uncertain-convex-pair';
          pair = [pa.component.name, pb.component.name]; }
      }
      return finish({ status: uncertainty ? 'uncertain' : 'clear', distanceLower: Math.max(0, Math.min(lower, upper)),
        distanceUpper: upper, pair, queries, iterations, ...(uncertainty ? { reason: uncertainty } : {}) });
    },
    get stats() { return { ...counters }; },
    resetStats() { for (const key of Object.keys(counters) as (keyof typeof counters)[]) counters[key] = 0; },
    describe() {
      return {
        envelope: 'Union of cached convex components; blocked is conservative, clear certifies envelope separation.',
        sources: sources.map(s => ({ ...s, meshToJoint: [...s.meshToJoint], unreferencedVertexIds: [...s.unreferencedVertexIds] })),
        parts: components.map(p => ({ name: p.name, side: p.side, sourceMesh: p.sourceMesh, sourcePart: p.sourcePart,
          frame: p.binding, sourceTriangleIds: [...p.sourceTriangleIds], sourceVertexIds: [...p.sourceVertexIds],
          vertices: p.shape.points.map(v => v.clone()), bounds: p.shape.bounds.clone(), maxRadius: p.maxRadius,
          offsetPosition: p.offsetPosition.clone(), offsetRotation: p.offsetRotation.clone(),
        })),
      };
    },
  };
}
