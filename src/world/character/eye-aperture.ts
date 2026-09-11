/** Original neutral Link eye opening, shared by every visible eye layer. */
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

export const LINK_EYE_HALF_WIDTH = 0.025;
export const LINK_EYE_HALF_HEIGHT = 0.0165;
export const LINK_EYE_SEGMENTS = 28;
/** Midpoints preserve the original polygonal opening and the rim's outer boundary. */
export const LINK_EYE_SURFACE_SEGMENTS = LINK_EYE_SEGMENTS * 2;
const WHITE_ROWS = 8;
export const LINK_EYE_WHITE_VERTICES = (LINK_EYE_SURFACE_SEGMENTS / 2 - 1) * (WHITE_ROWS - 1)
  + LINK_EYE_SURFACE_SEGMENTS;

export function linkEyeOpeningPoint(angle: number): [number, number] {
  const sy = Math.sin(angle);
  return [LINK_EYE_HALF_WIDTH * Math.cos(angle), LINK_EYE_HALF_HEIGHT * sy * (0.82 + 0.18 * Math.abs(sy))];
}

export const LINK_EYE_OPENING = Array.from({ length: LINK_EYE_SEGMENTS }, (_, i) =>
  linkEyeOpeningPoint(i / LINK_EYE_SEGMENTS * Math.PI * 2));

export function createLinkEyeWhite(k: number): BufferGeometry {
  // The last boundary ring is shared with the skin rim. Quantize the original
  // vertices before midpoint subdivision so the old opening vertices stay exact.
  const original = LINK_EYE_OPENING.map(([x, y]) => [Math.fround(x * k), Math.fround(y * k)]);
  const boundary: number[][] = [];
  for (let j = 0; j < LINK_EYE_SEGMENTS; j++) {
    const a = original[j], b = original[(j + 1) % LINK_EYE_SEGMENTS];
    boundary.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  const vertices: number[] = [], indices: number[] = [], columns: number[][] = [];
  const half = LINK_EYE_SURFACE_SEGMENTS / 2;
  const boundaryOffset = (half - 1) * (WHITE_ROWS - 1);
  // Every triangle has a vertical column edge. Horizontal curvature therefore
  // cannot turn into an artificial steep Y gradient as the aperture narrows.
  for (let j = half; j >= 0; j--) {
    if (j === half || j === 0) { columns.push([boundaryOffset + j]); continue; }
    const lower = (LINK_EYE_SURFACE_SEGMENTS - j) % LINK_EYE_SURFACE_SEGMENTS;
    const bottom = boundary[lower], top = boundary[j], column = [boundaryOffset + lower];
    for (let row = 1; row < WHITE_ROWS; row++) {
      const u = row / WHITE_ROWS;
      column.push(vertices.length / 3);
      vertices.push(bottom[0] * (1 - u) + top[0] * u, bottom[1] * (1 - u) + top[1] * u, 0);
    }
    column.push(boundaryOffset + j); columns.push(column);
  }
  for (const [x, y] of boundary) vertices.push(x, y, 0);
  for (let i = 0; i < columns.length - 1; i++) {
    const a = columns[i], b = columns[i + 1];
    for (let row = 0; row < WHITE_ROWS; row++) {
      if (a.length === 1) indices.push(a[0], b[row], b[row + 1]);
      else if (b.length === 1) indices.push(a[row], b[0], a[row + 1]);
      else indices.push(a[row], b[row], a[row + 1], b[row], b[row + 1], a[row + 1]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.name = 'original-link-neutral-eye-white';
  return geometry;
}

/** Angular subdivision keeps every original vertex and the same outer 3D polyline. */
function refineEyelid(geometry: BufferGeometry): BufferGeometry {
  const p = geometry.attributes.position, vertices: number[] = [], indices: number[] = [];
  for (let ring = 0; ring <= 4; ring++) for (let j = 0; j < LINK_EYE_SEGMENTS; j++) {
    const a = ring * LINK_EYE_SEGMENTS + j, b = ring * LINK_EYE_SEGMENTS + (j + 1) % LINK_EYE_SEGMENTS;
    vertices.push(p.getX(a), p.getY(a), p.getZ(a), (p.getX(a) + p.getX(b)) / 2,
      (p.getY(a) + p.getY(b)) / 2, (p.getZ(a) + p.getZ(b)) / 2);
  }
  for (let ring = 0; ring < 4; ring++) for (let j = 0; j < LINK_EYE_SURFACE_SEGMENTS; j++) {
    const a = ring * LINK_EYE_SURFACE_SEGMENTS + j, b = a + LINK_EYE_SURFACE_SEGMENTS;
    const next = ring * LINK_EYE_SURFACE_SEGMENTS + (j + 1) % LINK_EYE_SURFACE_SEGMENTS;
    indices.push(a, b, next, b, next + LINK_EYE_SURFACE_SEGMENTS, next);
  }
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(vertices, 3)); result.setIndex(indices);
  result.computeVertexNormals(); result.name = geometry.name; geometry.dispose();
  return result;
}

/** Fit the outer skin rim to the actual unchanged skull along the eye's own normal. */
export function createLinkEyelid(k: number, skull: BufferGeometry, eyeToHead: Matrix4): BufferGeometry {
  const vertices: number[] = [], indices: number[] = [], rings = 4, segments = LINK_EYE_SEGMENTS;
  const headToEye = eyeToHead.clone().invert();
  const material = new MeshBasicMaterial(), surface = new Mesh(skull, material);
  const direction = new Vector3(0, 0, -1).transformDirection(eyeToHead), ray = new Raycaster();
  const outerDepth = LINK_EYE_OPENING.map((_, j) => {
    const angle = j / segments * Math.PI * 2, sy = Math.sin(angle);
    const x = (LINK_EYE_HALF_WIDTH + 0.008) * k * Math.cos(angle);
    const y = (LINK_EYE_HALF_HEIGHT + (sy > 0 ? 0.008 : 0.005)) * k * sy * (0.82 + 0.18 * Math.abs(sy));
    ray.set(new Vector3(x, y, 0.2 * k).applyMatrix4(eyeToHead), direction);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('Link outer eyelid must meet the unchanged skull');
    return hit.point.applyMatrix4(headToEye).z - 0.0004 * k;
  });
  material.dispose();
  for (let ring = 0; ring <= rings; ring++) for (let j = 0; j < segments; j++) {
    const u = ring / rings, angle = j / segments * Math.PI * 2, sy = Math.sin(angle);
    vertices.push((LINK_EYE_HALF_WIDTH + 0.008 * u) * k * Math.cos(angle),
      (LINK_EYE_HALF_HEIGHT + (sy > 0 ? 0.008 : 0.005) * u) * k * sy * (0.82 + 0.18 * Math.abs(sy)),
      0.001 * k * (1 - u) + outerDepth[j] * u + 0.001 * k * Math.sin(Math.PI * u));
    if (ring < rings) {
      const p = ring * segments + j, q = p + segments, next = ring * segments + (j + 1) % segments;
      indices.push(p, q, next, q, next + segments, next);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.name = 'original-link-neutral-fitted-eyelid';
  return refineEyelid(geometry);
}

export function createLinkUpperLashPath(k: number): Vector3[] {
  return [-1, -0.7, -0.35, 0, 0.35, 0.7, 1].map(x => {
    const [px, py] = linkEyeOpeningPoint(Math.acos(x));
    return new Vector3(px * k, py * k, 0.0025 * k);
  });
}
