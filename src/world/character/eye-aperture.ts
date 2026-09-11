/** Original neutral Link eye opening, shared by every visible eye layer. */
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

export const LINK_EYE_HALF_WIDTH = 0.025;
export const LINK_EYE_HALF_HEIGHT = 0.0165;
export const LINK_EYE_SEGMENTS = 28;

export function linkEyeOpeningPoint(angle: number): [number, number] {
  const sy = Math.sin(angle);
  return [LINK_EYE_HALF_WIDTH * Math.cos(angle), LINK_EYE_HALF_HEIGHT * sy * (0.82 + 0.18 * Math.abs(sy))];
}

export const LINK_EYE_OPENING = Array.from({ length: LINK_EYE_SEGMENTS }, (_, i) =>
  linkEyeOpeningPoint(i / LINK_EYE_SEGMENTS * Math.PI * 2));

export function createLinkEyeWhite(k: number): BufferGeometry {
  const vertices: number[] = [0, 0, 0.003 * k], indices: number[] = [];
  const rings = 4, segments = LINK_EYE_SEGMENTS;
  for (let ring = 1; ring <= rings; ring++) for (let j = 0; j < segments; j++) {
    const u = ring / rings, [x, y] = LINK_EYE_OPENING[j];
    vertices.push(x * k * u, y * k * u, 0.003 * k * (1 - u * u));
    const q = 1 + (ring - 1) * segments + j, next = 1 + (ring - 1) * segments + (j + 1) % segments;
    if (ring === 1) indices.push(0, q, next);
    else {
      const previous = q - segments, previousNext = next - segments;
      indices.push(previous, q, previousNext, q, next, previousNext);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.name = 'original-link-neutral-eye-white';
  return geometry;
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
  return geometry;
}

export function createLinkUpperLashPath(k: number): Vector3[] {
  return [-1, -0.7, -0.35, 0, 0.35, 0.7, 1].map(x => {
    const [px, py] = linkEyeOpeningPoint(Math.acos(x));
    return new Vector3(px * k, py * k, 0.0025 * k);
  });
}
