/** Fit the original crossing cap seam to the real cloth, preserving one thread mesh. */
import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { merge, sweep } from './geometry';

type ClothTriangle = { points: Vector3[]; areaXY: number; minX: number; maxX: number; minY: number; maxY: number };
const crossXY = (a: Vector3, b: Vector3, p: Vector3): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** Minimum rear gap over the full intersection of two projected triangle faces. */
function triangleRearGap(thread: Vector3[], cloth: ClothTriangle): number {
  let polygon = thread.map(p => p.clone());
  const sign = Math.sign(cloth.areaXY);
  for (let edge = 0; edge < 3 && polygon.length; edge++) {
    const a = cloth.points[edge], b = cloth.points[(edge + 1) % 3], next: Vector3[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const from = polygon[i], to = polygon[(i + 1) % polygon.length];
      const d0 = sign * crossXY(a, b, from), d1 = sign * crossXY(a, b, to);
      if (d0 >= -1e-14) next.push(from);
      if ((d0 >= 0) !== (d1 >= 0)) next.push(from.clone().lerp(to, d0 / (d0 - d1)));
    }
    polygon = next;
  }
  let minimum = Infinity;
  const [a, b, c] = cloth.points;
  for (const p of polygon) {
    const u = crossXY(b, c, p) / cloth.areaXY, v = crossXY(c, a, p) / cloth.areaXY;
    minimum = Math.min(minimum, u * a.z + v * b.z + (1 - u - v) * c.z - p.z);
  }
  return minimum;
}

export function createLinkCapTailStitches(tail: BufferGeometry): BufferGeometry {
  const positions = tail.getAttribute('position'), centres: Vector3[] = [], seams: BufferGeometry[] = [];
  const material = new MeshBasicMaterial({ side: DoubleSide }), surface = new Mesh(tail, material);
  surface.updateMatrixWorld();
  const ray = new Raycaster(), direction = new Vector3(0, 0, 1);
  const clothTriangles: ClothTriangle[] = [];
  const clothIndex = tail.index!;
  for (let i = 0; i < clothIndex.count; i += 3) {
    const points = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(positions, clothIndex.getX(i + j)));
    const areaXY = crossXY(points[0], points[1], points[2]);
    if (Math.abs(areaXY) < 1e-15) continue;
    clothTriangles.push({ points, areaXY, minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
      minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) });
  }
  const rearZ = (x: number, y: number): number => {
    ray.set(new Vector3(x, y, -1), direction);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('Cap stitch left the fitted cloth');
    return hit.point.z;
  };
  // Keep the 14 longitudinal stations, with a continuous centre line: the former global
  // backmost-vertex search hopped between side folds and left long floating chords.
  for (let ring = 8; ring <= 34; ring += 2) {
    const p = new Vector3().fromBufferAttribute(positions, ring * 13 + 3);
    p.z = rearZ(p.x, p.y) - .0012; centres.push(p);
  }
  for (let i = 1; i < centres.length; i++) for (const side of [-1, 1]) {
    const a = centres[i - 1].clone().add(new Vector3(side * .005, 0, 0));
    const b = centres[i].clone().add(new Vector3(-side * .005, 0, 0));
    const path: Vector3[] = [];
    // Eight sections keep the chord interiors seated across the upper drape's bend.
    const sections = 8;
    for (let step = 0; step <= sections; step++) {
      const p = a.clone().lerp(b, step / sections); p.z = rearZ(p.x, p.y) - .0012; path.push(p);
    }
    const thread = sweep(path, path.map(() => .0009), {
      segments: sections, radial: 5, smooth: false, closeStart: true, closeTip: true,
    });
    const p = thread.getAttribute('position');
    // Fit the full tube boundary as well as its centre. Keep a 1.2 mm rear lift and
    // a 0.9 mm rear half-thickness. A steep cloth slope otherwise amplifies the
    // tube's projected Z thickness enough to bury its front side.
    const offsets: number[] = [];
    let maximumOffset = 0;
    for (let vertex = 0; vertex < p.count; vertex++) {
      const point = new Vector3().fromBufferAttribute(p, vertex);
      let distance = Infinity, centreZ = 0;
      for (let step = 0; step < path.length - 1; step++) {
        const from = path[step], to = path[step + 1], dx = to.x - from.x, dy = to.y - from.y;
        const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)));
        const d = (point.x - from.x - dx * t) ** 2 + (point.y - from.y - dy * t) ** 2;
        if (d < distance) { distance = d; centreZ = from.z + (to.z - from.z) * t; }
      }
      const offset = point.z - centreZ;
      offsets.push(offset); maximumOffset = Math.max(maximumOffset, Math.abs(offset));
    }
    for (let vertex = 0; vertex < p.count; vertex++) {
      p.setZ(vertex, rearZ(p.getX(vertex), p.getY(vertex)) - .0012 + .0009 * offsets[vertex] / maximumOffset);
    }
    // Fitted vertices alone cannot guarantee that a chord clears a cloth crease.
    // Clip every thread triangle against the actual cloth triangles, find the exact
    // piecewise-linear rear gap, then translate whole tube rings only as much as
    // necessary. Every vertex of an affected face receives at least its deficit;
    // moving toward -Z cannot worsen any of these rear gaps.
    const lifts = Array.from({ length: sections + 1 }, () => 0), index = thread.index!;
    const ringOf = (vertex: number) => vertex < (sections + 1) * 6 ? Math.floor(vertex / 6)
      : vertex === (sections + 1) * 6 ? sections : 0;
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const ids = [0, 1, 2].map(j => index.getX(triangle + j));
      const vertices = ids.map(id => new Vector3().fromBufferAttribute(p, id));
      const minX = Math.min(...vertices.map(v => v.x)), maxX = Math.max(...vertices.map(v => v.x));
      const minY = Math.min(...vertices.map(v => v.y)), maxY = Math.max(...vertices.map(v => v.y));
      let gap = Infinity;
      for (const cloth of clothTriangles) {
        if (cloth.minX > maxX || cloth.maxX < minX || cloth.minY > maxY || cloth.maxY < minY) continue;
        gap = Math.min(gap, triangleRearGap(vertices, cloth));
      }
      const deficit = Math.max(0, .00035 - gap);
      for (const id of ids) lifts[ringOf(id)] = Math.max(lifts[ringOf(id)], deficit);
    }
    for (let vertex = 0; vertex < p.count; vertex++) p.setZ(vertex, p.getZ(vertex) - lifts[ringOf(vertex)]);
    thread.computeVertexNormals(); seams.push(thread);
  }
  material.dispose();
  const geometry = merge(seams); geometry.name = 'link-fitted-cap-tail-stitches';
  return geometry;
}
