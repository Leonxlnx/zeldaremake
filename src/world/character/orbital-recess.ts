/** Original construction-only orbital relief on Link's already-built skull. */
import { BufferGeometry, Float32BufferAttribute, Matrix3, Matrix4, Mesh, Vector2, Vector3 } from 'three';
import { LINK_EYE_OPENING, LINK_EYE_LID_STATIONS, LINK_EYE_SURFACE_SEGMENTS } from './eye-aperture';
import type { Rig } from './rig';

type Weights = [number, number, number];
interface Vertex { point: Vector3; normal: Vector3; uv: number[]; color: number[] }
interface Face { ids: Weights; points: Map<number, Weights> }
interface Polygon { ids: number[]; region: number }
interface FaceWork { face: Face; polygons: Polygon[]; eye: number }
interface FaceTriangle { ids: Weights; region: number; eye: number }
interface Plane { x: number; y: number; distance: number }
interface Domain { toEye: Matrix4; toHead: Matrix4; normalToEye: Matrix3; normalToHead: Matrix3; inner: Plane[]; outer: Plane[] }

const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
const planes = (polygon: Vector2[]): Plane[] => polygon.map((a, i) => {
  const b = polygon[(i + 1) % polygon.length], length = a.distanceTo(b);
  const x = (b.y - a.y) / length, y = (a.x - b.x) / length;
  return { x, y, distance: x * a.x + y * a.y };
});
const gauge = (polygon: Plane[], x: number, y: number) => {
  let value = -Infinity, dx = 0, dy = 0;
  for (const plane of polygon) {
    const q = (plane.x * x + plane.y * y) / plane.distance;
    if (q > value) { value = q; dx = plane.x / plane.distance; dy = plane.y / plane.distance; }
  }
  return { value, dx, dy };
};

/** Full aperture plateau; the radial quintic meets both boundaries with C2 continuity.
 * Polygon-sector gradients remain piecewise: this is not a globally C1 field. */
function relief(domain: Domain, point: Vector3, depth: number) {
  const p = point.clone().applyMatrix4(domain.toEye);
  const inner = gauge(domain.inner, p.x, p.y), outer = gauge(domain.outer, p.x, p.y);
  if (outer.value >= 1) return { depth: 0, dx: 0, dy: 0 };
  if (inner.value <= 1) return { depth, dx: 0, dy: 0 };
  const numerator = outer.value * (inner.value - 1), denominator = inner.value - outer.value;
  const t = numerator / denominator;
  const derivative = -depth * 30 * t * t * (1 - t) * (1 - t);
  const grad = (di: number, dO: number) => derivative *
    (((dO * (inner.value - 1) + outer.value * di) * denominator - numerator * (di - dO)) / (denominator * denominator));
  return { depth: depth * (1 - t * t * t * (10 + t * (-15 + 6 * t))),
    dx: grad(inner.dx, outer.dx), dy: grad(inner.dy, outer.dy) };
}

export function recessLinkOrbitals(rig: Rig): { addedVertices: number; addedTriangles: number; refinementPasses: number; maxDepthError: number } {
  const skull = rig.head.getObjectByName('skull');
  if (!(skull instanceof Mesh)) throw new Error('Link orbital recess needs its actual skull');
  const original = skull.geometry as BufferGeometry;
  if (original.userData.linkOrbitalRecess) throw new Error('Link orbital recess is construction-only');
  const position = original.attributes.position, normal = original.attributes.normal;
  const uv = original.attributes.uv, color = original.attributes.color, index = original.index;
  if (!index || !normal || !color) throw new Error('Link orbital recess needs the original pigmented indexed skull');
  const k = rig.props.headRadius / .125, depth = .0025 * rig.props.headRadius / .145;
  const domains: Domain[] = rig.eyes.map(eye => {
    eye.updateMatrix();
    const toHead = eye.matrix.clone(), toEye = toHead.clone().invert();
    const lid = eye.getObjectByName('eyelid');
    if (!(lid instanceof Mesh)) throw new Error('Link orbital recess needs its already-fitted original lid');
    const ring = LINK_EYE_LID_STATIONS.indexOf(.75), points = lid.geometry.attributes.position;
    const outer = LINK_EYE_OPENING.map((_, j) => new Vector2(points.getX(ring * LINK_EYE_SURFACE_SEGMENTS + j * 2),
      points.getY(ring * LINK_EYE_SURFACE_SEGMENTS + j * 2)));
    return { toHead, toEye, normalToEye: new Matrix3().getNormalMatrix(toEye),
      normalToHead: new Matrix3().getNormalMatrix(toHead),
      inner: planes(LINK_EYE_OPENING.map(([x, y]) => new Vector2(x * k, y * k))), outer: planes(outer) };
  });
  const vertices: Vertex[] = Array.from({ length: position.count }, (_, i) => ({
    point: new Vector3().fromBufferAttribute(position, i), normal: new Vector3().fromBufferAttribute(normal, i),
    uv: uv ? [uv.getX(i), uv.getY(i)] : [], color: [color.getX(i), color.getY(i), color.getZ(i)],
  }));
  const parents = Array.from({ length: position.count }, (_, i) => i);
  const root = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  for (let i = 0; i < index.count; i += 3) {
    const a = root(index.getX(i)); parents[root(index.getX(i + 1))] = a; parents[root(index.getX(i + 2))] = a;
  }
  const sizes = new Map<number, number>();
  for (let i = 0; i < index.count; i += 3) sizes.set(root(index.getX(i)), (sizes.get(root(index.getX(i))) ?? 0) + 1);
  const skullComponent = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
  const registry = new Map<string, number>(), edgePoints = new Map<string, Set<number>>();
  const add = (face: Face, weights: Weights): number => {
    for (let j = 0; j < 3; j++) if (weights[j] >= 1 - 1e-12) return face.ids[j];
    const zero = weights.findIndex(w => Math.abs(w) < 1e-12);
    let key: string;
    if (zero >= 0) {
      const pair = [0, 1, 2].filter(j => j !== zero).sort((a, b) => face.ids[a] - face.ids[b]);
      key = `e:${edgeKey(face.ids[pair[0]], face.ids[pair[1]])}:${Math.round(weights[pair[1]] * 1e11)}`;
    } else key = `f:${face.ids.join(':')}:${weights.map(w => Math.round(w * 1e11)).join(':')}`;
    let id = registry.get(key);
    if (id === undefined) {
      const v: Vertex = { point: new Vector3(), normal: new Vector3(), uv: uv ? [0, 0] : [], color: [0, 0, 0] };
      for (let j = 0; j < 3; j++) {
        const source = vertices[face.ids[j]], w = weights[j];
        v.point.addScaledVector(source.point, w); v.normal.addScaledVector(source.normal, w);
        for (let a = 0; a < v.uv.length; a++) v.uv[a] += source.uv[a] * w;
        for (let a = 0; a < 3; a++) v.color[a] += source.color[a] * w;
      }
      id = vertices.length; vertices.push(v); registry.set(key, id);
      if (zero >= 0) {
        const pair = [0, 1, 2].filter(j => j !== zero), edge = edgeKey(face.ids[pair[0]], face.ids[pair[1]]);
        if (!edgePoints.has(edge)) edgePoints.set(edge, new Set()); edgePoints.get(edge)!.add(id);
      }
    }
    face.points.set(id, weights); return id;
  };
  const project = (id: number, domain: Domain) => vertices[id].point.clone().applyMatrix4(domain.toEye);
  const intersects = (ids: number[], domain: Domain): boolean => {
    let polygon = ids.map(id => project(id, domain));
    for (const plane of domain.outer) {
      const next: Vector3[] = [];
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length];
        const da = plane.distance - plane.x * a.x - plane.y * a.y, db = plane.distance - plane.x * b.x - plane.y * b.y;
        if (da >= 0) next.push(a);
        if ((da >= 0) !== (db >= 0)) next.push(a.clone().lerp(b, da / (da - db)));
      }
      polygon = next; if (polygon.length < 3) return false;
    }
    let area = 0;
    for (let j = 0; j < polygon.length; j++) { const a = polygon[j], b = polygon[(j + 1) % polygon.length]; area += a.x * b.y - b.x * a.y; }
    return area > 1e-16;
  };
  const partition = (face: Face, initial: number[], domain: Domain, boundary: Plane[], outsideRegion: number, insideRegion: number): Polygon[] => {
    let pending = initial; const result: Polygon[] = [];
    for (const plane of boundary) {
      const inside: number[] = [], outside: number[] = [];
      const append = (list: number[], id: number) => { if (list.at(-1) !== id) list.push(id); };
      for (let j = 0; j < pending.length; j++) {
        const a = pending[j], b = pending[(j + 1) % pending.length], pa = project(a, domain), pb = project(b, domain);
        const da = plane.distance - plane.x * pa.x - plane.y * pa.y, db = plane.distance - plane.x * pb.x - plane.y * pb.y;
        const ia = da >= -1e-12, ib = db >= -1e-12;
        append(ia ? inside : outside, a);
        if (ia !== ib) {
          const t = da / (da - db), wa = face.points.get(a)!, wb = face.points.get(b)!;
          const id = add(face, wa.map((w, q) => w + t * (wb[q] - w)) as Weights);
          append(inside, id); append(outside, id);
        }
      }
      for (const list of [inside, outside]) if (list[0] === list.at(-1)) list.pop();
      if (outside.length >= 3) result.push({ ids: outside, region: outsideRegion });
      pending = inside; if (pending.length < 3) break;
    }
    if (pending.length >= 3) result.push({ ids: pending, region: insideRegion });
    return result;
  };
  const work: FaceWork[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)] as Weights;
    const face: Face = { ids, points: new Map(ids.map((id, j) => [id, [Number(j === 0), Number(j === 1), Number(j === 2)] as Weights])) };
    let selected = -1;
    if (root(ids[0]) === skullComponent) for (let eye = 0; eye < domains.length; eye++) {
      const projected = ids.map(id => project(id, domains[eye]));
      const area = (projected[1].x - projected[0].x) * (projected[2].y - projected[0].y) -
        (projected[1].y - projected[0].y) * (projected[2].x - projected[0].x);
      if (area > 1e-14 && intersects(ids, domains[eye])) {
        if (selected >= 0) throw new Error('Link orbital domains must be disjoint on every source face'); selected = eye;
      }
    }
    if (selected < 0) { work.push({ face, polygons: [{ ids, region: 0 }], eye: -1 }); continue; }
    const domain = domains[selected], polygons: Polygon[] = [];
    for (const polygon of partition(face, ids, domain, domain.outer, 0, 1)) {
      if (polygon.region === 0) polygons.push(polygon);
      else polygons.push(...partition(face, polygon.ids, domain, domain.inner, 1, 2));
    }
    work.push({ face, polygons, eye: selected });
  }
  let triangles: FaceTriangle[] = [];
  for (const item of work) for (const polygon of item.polygons) {
    const candidates = new Set(item.face.points.keys());
    for (let j = 0; j < 3; j++) for (const id of edgePoints.get(edgeKey(item.face.ids[j], item.face.ids[(j + 1) % 3])) ?? []) candidates.add(id);
    const outline: number[] = [];
    for (let j = 0; j < polygon.ids.length; j++) {
      const a = polygon.ids[j], b = polygon.ids[(j + 1) % polygon.ids.length], start = vertices[a].point;
      const edge = vertices[b].point.clone().sub(start), lengthSquared = edge.lengthSq();
      const between: { id: number; t: number }[] = [];
      for (const id of candidates) if (id !== a && id !== b) {
        const delta = vertices[id].point.clone().sub(start), t = delta.dot(edge) / lengthSquared;
        if (t > 1e-10 && t < 1 - 1e-10 && delta.addScaledVector(edge, -t).lengthSq() < 1e-22) between.push({ id, t });
      }
      outline.push(a, ...between.sort((a, b) => a.t - b.t).map(x => x.id));
    }
    if (outline.length === 3) triangles.push({ ids: outline as Weights, region: polygon.region, eye: item.eye });
    else {
      // A centroid fan keeps every shared collinear edge segment without zero-area fan faces.
      const centre = new Vector3(); for (const id of outline) centre.add(vertices[id].point); centre.multiplyScalar(1 / outline.length);
      const a = vertices[item.face.ids[0]].point, e1 = vertices[item.face.ids[1]].point.clone().sub(a), e2 = vertices[item.face.ids[2]].point.clone().sub(a);
      const d = centre.clone().sub(a), d11 = e1.dot(e1), d12 = e1.dot(e2), d22 = e2.dot(e2), det = d11 * d22 - d12 * d12;
      const b = (d.dot(e1) * d22 - d.dot(e2) * d12) / det, c = (d.dot(e2) * d11 - d.dot(e1) * d12) / det;
      const id = add(item.face, [1 - b - c, b, c]);
      for (let j = 0; j < outline.length; j++) triangles.push({ ids: [outline[j], outline[(j + 1) % outline.length], id], region: polygon.region, eye: item.eye });
    }
  }
  let refinementPasses = 0, maxDepthError = 0;
  for (; refinementPasses < 14; refinementPasses++) {
    const split = new Map<string, number>(); maxDepthError = 0;
    for (const triangle of triangles) if (triangle.region === 1) {
      const ps = triangle.ids.map(id => vertices[id].point), values = ps.map(p => relief(domains[triangle.eye], p, depth).depth);
      let error = 0;
      for (const weights of [[.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3]]) {
        const point = new Vector3(); let interpolated = 0;
        for (let j = 0; j < 3; j++) { point.addScaledVector(ps[j], weights[j]); interpolated += values[j] * weights[j]; }
        error = Math.max(error, Math.abs(interpolated - relief(domains[triangle.eye], point, depth).depth));
      }
      maxDepthError = Math.max(maxDepthError, error);
      for (let j = 0; j < 3; j++) {
        const a = triangle.ids[j], b = triangle.ids[(j + 1) % 3], key = edgeKey(a, b);
        if (vertices[a].point.distanceTo(vertices[b].point) <= .00075 * rig.props.headRadius / .145 && error <= .00004 * rig.props.headRadius / .145) continue;
        if (split.has(key)) continue;
        const va = vertices[a], vb = vertices[b], id = vertices.length;
        vertices.push({ point: va.point.clone().add(vb.point).multiplyScalar(.5), normal: va.normal.clone().add(vb.normal).multiplyScalar(.5),
          uv: va.uv.map((v, q) => (v + vb.uv[q]) * .5), color: va.color.map((v, q) => (v + vb.color[q]) * .5) });
        split.set(key, id);
      }
    }
    if (!split.size) break;
    const next: FaceTriangle[] = [];
    for (const triangle of triangles) {
      const [a, b, c] = triangle.ids, ab = split.get(edgeKey(a, b)), bc = split.get(edgeKey(b, c)), ca = split.get(edgeKey(c, a));
      const count = Number(ab !== undefined) + Number(bc !== undefined) + Number(ca !== undefined);
      const push = (...ids: number[]) => { for (let i = 0; i < ids.length; i += 3) next.push({ ...triangle, ids: ids.slice(i, i + 3) as Weights }); };
      if (!count) next.push(triangle);
      else if (count === 3) push(a, ab!, ca!, ab!, b, bc!, ca!, bc!, c, ab!, bc!, ca!);
      else if (count === 1) {
        if (ab !== undefined) push(a, ab, c, ab, b, c); else if (bc !== undefined) push(b, bc, a, bc, c, a); else push(c, ca!, b, ca!, a, b);
      } else {
        let x: number, y: number, z: number, xy: number, yz: number;
        if (ca === undefined) { x = a; y = b; z = c; xy = ab!; yz = bc!; }
        else if (ab === undefined) { x = b; y = c; z = a; xy = bc!; yz = ca; }
        else { x = c; y = a; z = b; xy = ca; yz = ab; }
        push(xy, y, yz, x, xy, yz, x, yz, z);
      }
    }
    triangles = next;
  }
  if (refinementPasses === 14) throw new Error('Link orbital fade did not meet its local refinement bound');
  const owners = new Map<number, Set<number>>();
  for (const triangle of triangles) if (triangle.eye >= 0) for (const id of triangle.ids) {
    if (!owners.has(id)) owners.set(id, new Set()); owners.get(id)!.add(triangle.eye);
  }
  for (const [id, eyes] of owners) {
    const vertex = vertices[id]; let changed = false;
    for (const eye of eyes) {
      const domain = domains[eye], value = relief(domain, vertex.point, depth);
      if (value.depth === 0) continue;
      if (changed) throw new Error('Link orbital displacement domains overlap'); changed = true;
      vertex.point.applyMatrix4(domain.toEye); vertex.point.z -= value.depth; vertex.point.applyMatrix4(domain.toHead);
      vertex.normal.applyMatrix3(domain.normalToEye);
      vertex.normal.x += value.dx * vertex.normal.z; vertex.normal.y += value.dy * vertex.normal.z;
      vertex.normal.applyMatrix3(domain.normalToHead).normalize();
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices.flatMap(v => v.point.toArray()), 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(vertices.flatMap(v => v.normal.toArray()), 3));
  if (uv) geometry.setAttribute('uv', new Float32BufferAttribute(vertices.flatMap(v => v.uv), 2));
  geometry.setAttribute('color', new Float32BufferAttribute(vertices.flatMap(v => v.color), 3));
  geometry.setIndex(triangles.flatMap(t => t.ids)); geometry.name = original.name;
  geometry.userData = { ...original.userData, linkOrbitalRecess: true };
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  skull.geometry = geometry; original.dispose();
  return { addedVertices: vertices.length - position.count, addedTriangles: triangles.length - index.count / 3, refinementPasses, maxDepthError };
}
