/** Original carved wooden shield, local front +Z. Geometry only; caller owns materials. */
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

// Broad, uneven plank heads and a tapered lower tip; no circular frame or imported outline.
const OUTLINE: [number, number][] = [
  [0, -0.225], [-0.078, -0.187], [-0.139, -0.107], [-0.169, -0.015],
  [-0.178, 0.131], [-0.157, 0.180], [-0.131, 0.169], [-0.108, 0.193],
  [-0.073, 0.184], [-0.036, 0.208], [0.004, 0.195], [0.043, 0.204],
  [0.084, 0.183], [0.111, 0.192], [0.150, 0.173], [0.173, 0.184],
  [0.178, 0.126], [0.169, -0.025], [0.136, -0.114], [0.069, -0.196],
].reverse() as [number, number][];
const FACE_SCALE = 0.977;
const JOINS = [-0.112, -0.040, 0.037, 0.109];
const JOIN_HALF_WIDTH = 0.0006;
const cross = (a: Vector2, b: Vector2): number => a.x * b.y - a.y * b.x;

/** Clip one simple polygon against an axis-aligned half-plane. */
function clip(poly: Vector2[], axis: 'x' | 'y', value: number, keepAbove: boolean): Vector2[] {
  const out: Vector2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = (a[axis] - value) * (keepAbove ? 1 : -1);
    const db = (b[axis] - value) * (keepAbove ? 1 : -1);
    if (da >= -1e-12) out.push(a.clone());
    if ((da > 1e-12 && db < -1e-12) || (da < -1e-12 && db > 1e-12)) {
      const p = a.clone().lerp(b, da / (da - db));
      p[axis] = value;
      out.push(p);
    }
  }
  return out.filter((p, i) => p.distanceToSquared(out[(i + out.length - 1) % out.length]) > 1e-20);
}

/**
 * Two material groups forming one closed solid. The front has continuous XY UVs for the
 * authored wood/swirl texture; narrow recessed joints belong to the darker shell material.
 * Bounds: x ±0.178 m, y -0.225..0.208 m, z -0.010..0.040 m.
 */
export function createWoodenShield(): { face: BufferGeometry; shell: BufferGeometry } {
  const outline = OUTLINE.map(([x, y]) => new Vector2(x * FACE_SCALE, y * FACE_SCALE));
  const vertices: [number, number, number][] = [];
  const uv: [number, number][] = [];
  const faceTriangles: number[] = [], shellTriangles: number[] = [];
  const pointIds = new Map<string, number>();

  // Radial distance to the authored outline makes the convex face meet every chipped edge.
  const height = (p: Vector2): number => {
    if (p.lengthSq() < 1e-14) return 0.040;
    let boundary = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], edge = outline[(i + 1) % outline.length].clone().sub(a);
      const denom = cross(p, edge);
      if (Math.abs(denom) < 1e-12) continue;
      const rayT = cross(a, edge) / denom, edgeT = cross(a, p) / denom;
      if (rayT > 0 && edgeT >= -1e-9 && edgeT <= 1 + 1e-9) boundary = Math.min(boundary, rayT);
    }
    const radial = Math.min(1, 1 / boundary);
    const dome = 1 - radial * radial;
    let groove = 0;
    for (const join of JOINS) groove = Math.max(groove, 1 - Math.abs(p.x - join) / JOIN_HALF_WIDTH);
    return 0.006 + 0.034 * dome - 0.0018 * Math.max(0, groove) * Math.min(1, dome * 8);
  };
  const vertex = (x: number, y: number, z: number): number => {
    const key = `${x.toFixed(8)}|${y.toFixed(8)}|${z.toFixed(8)}`;
    const known = pointIds.get(key);
    if (known !== undefined) return known;
    const id = vertices.length;
    vertices.push([x, y, z]);
    uv.push([x / 0.356 + 0.5, (y + 0.225) / 0.433]);
    pointIds.set(key, id);
    return id;
  };
  const frontVertex = (p: Vector2): number => vertex(p.x, p.y, height(p));
  const unique = (values: number[]): number[] => [...new Set(values.map(v => +v.toFixed(8)))].sort((a, b) => a - b);
  // Include all outline and joint coordinates so neighbouring clipped cells share their edges.
  const xs = unique([
    ...outline.map(p => p.x), ...Array.from({ length: 13 }, (_, i) => -0.174 + i * 0.348 / 12),
    ...JOINS.flatMap(x => [x - JOIN_HALF_WIDTH, x, x + JOIN_HALF_WIDTH]),
  ]);
  const ys = unique([...outline.map(p => p.y), ...Array.from({ length: 20 }, (_, i) => -0.22 + i * 0.425 / 19)]);
  const boundaryEdges = new Map<string, { a: number; b: number; count: number }>();
  const record = (a: number, b: number): void => {
    const key = a < b ? `${a}/${b}` : `${b}/${a}`;
    const edge = boundaryEdges.get(key);
    if (edge) edge.count++;
    else boundaryEdges.set(key, { a, b, count: 1 });
  };
  for (let iy = 0; iy < ys.length - 1; iy++) for (let ix = 0; ix < xs.length - 1; ix++) {
    let poly = clip(outline, 'x', xs[ix], true);
    poly = clip(poly, 'x', xs[ix + 1], false);
    poly = clip(poly, 'y', ys[iy], true);
    poly = clip(poly, 'y', ys[iy + 1], false);
    if (poly.length < 3) continue;
    const ids = poly.map(frontVertex);
    const middleX = (xs[ix] + xs[ix + 1]) * 0.5;
    const triangles = JOINS.some(x => Math.abs(middleX - x) < JOIN_HALF_WIDTH) ? shellTriangles : faceTriangles;
    for (const tri of ShapeUtils.triangulateShape(poly, [])) {
      let [ia, ib, ic] = tri;
      const a = poly[ia], b = poly[ib], c = poly[ic];
      const signed = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(signed) < 1e-13) continue;
      if (signed < 0) [ib, ic] = [ic, ib];
      const va = ids[ia], vb = ids[ib], vc = ids[ic];
      triangles.push(va, vb, vc);
      record(va, vb); record(vb, vc); record(vc, va);
    }
  }

  const backCentre = vertex(0, 0, -0.010);
  const strip = (a: number, b: number, nextA: number, nextB: number): void => {
    shellTriangles.push(a, nextA, b, b, nextA, nextB);
  };
  for (const { a, b, count } of boundaryEdges.values()) {
    if (count !== 1) continue;
    const rings = [a, b].map(id => {
      const [x, y] = vertices[id];
      const ox = x / FACE_SCALE, oy = y / FACE_SCALE;
      return [vertex(ox, oy, 0.002), vertex(ox, oy, -0.007), vertex(ox * 0.985, oy * 0.985, -0.010)];
    });
    strip(a, b, rings[0][0], rings[1][0]);
    strip(rings[0][0], rings[1][0], rings[0][1], rings[1][1]);
    strip(rings[0][1], rings[1][1], rings[0][2], rings[1][2]);
    shellTriangles.push(backCentre, rings[1][2], rings[0][2]);
  }

  const geometry = (triangles: number[]): BufferGeometry => {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const used = new Map<number, number>();
    for (const id of triangles) {
      if (!used.has(id)) {
        used.set(id, positions.length / 3);
        positions.push(...vertices[id]); uvs.push(...uv[id]);
      }
      indices.push(used.get(id)!);
    }
    const out = new BufferGeometry();
    out.setAttribute('position', new Float32BufferAttribute(positions, 3));
    out.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    out.setIndex(indices);
    out.computeVertexNormals();
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  };
  return { face: geometry(faceTriangles), shell: geometry(shellTriangles) };
}
