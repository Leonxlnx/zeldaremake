/** Original closed leaf ear with a recessed bowl and softly folded cartilage. */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

const SECTIONS = [
  [0.86, 0.005, 0.016, 0.018, 0.010],
  [1.00, 0.007, 0.016, 0.024, 0.010],
  [1.13, 0.012, 0.007, 0.024, 0.010],
  [1.25, 0.023, -0.010, 0.014, 0.006],
  [1.33, 0.031, -0.023, 0.006, 0.003],
] as const;

const smooth = (v: number): number => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const gaussian = (v: number, width: number): number => Math.exp(-((v / width) ** 2));

/**
 * Preserve the established silhouette, rear shell, tip and attachment span exactly.
 * Subdivision adds room for continuous front-surface folds without an extra mesh/material.
 */
export function createLinkEarGeometry(radius: number, side: 1 | -1): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0 || (side !== 1 && side !== -1)) {
    throw new RangeError('Link ear requires positive finite radius and side ±1');
  }
  const k = radius / 0.125, radial = 16;
  const original: Vector3[] = [], fronts: number[] = [], faces: number[][] = [];
  // Round the original vertices exactly as the established Float32 ear did.
  const vertex = (x: number, y: number, z: number, front: number): void => {
    original.push(new Vector3(Math.fround(x), Math.fround(y), Math.fround(z)));
    fronts.push(front);
  };
  const triangle = (a: number, b: number, c: number): void => {
    faces.push(side > 0 ? [a, b, c] : [a, c, b]);
  };
  SECTIONS.forEach(([x, y, z, halfHeight, halfDepth], section) => {
    for (let j = 0; j < radial; j++) {
      const angle = j / radial * Math.PI * 2, front = Math.sin(angle);
      const cup = 1.25 * halfDepth * Math.sin(Math.PI * (x - 0.86) / (1.39 - 0.86)) ** 2
        * Math.max(0, front) ** 2;
      vertex(side * x * radius, (y + halfHeight * Math.cos(angle)) * k,
        (z + halfDepth * front - cup) * k, front);
      if (section < SECTIONS.length - 1) {
        const a = section * radial + j, b = a + radial;
        const c = section * radial + (j + 1) % radial, d = c + radial;
        triangle(a, c, b); triangle(b, c, d);
      }
    }
  });
  const tip = original.length;
  vertex(side * 1.39 * radius, 0.036 * k, -0.032 * k, 0);
  const root = original.length;
  vertex(side * SECTIONS[0][0] * radius, SECTIONS[0][1] * k, SECTIONS[0][2] * k, 0);
  const last = (SECTIONS.length - 1) * radial;
  for (let j = 0; j < radial; j++) {
    const next = (j + 1) % radial;
    triangle(last + j, last + next, tip); triangle(j, root, next);
  }

  const positions: number[] = [], indices: number[] = [], lookup = new Map<string, number>();
  const subdivisions = 3;
  const refine = (ids: number[], weights: number[]): number => {
    // Integer barycentric edge keys share every seam vertex between adjacent faces.
    const key = ids.map((id, i) => [id, weights[i]]).filter(([, w]) => w > 0)
      .sort((a, b) => a[0] - b[0]).map(([id, w]) => `${id}:${w}`).join('/');
    const existing = lookup.get(key);
    if (existing !== undefined) return existing;
    const point = new Vector3(); let front = 0;
    for (let i = 0; i < 3; i++) {
      point.addScaledVector(original[ids[i]], weights[i] / subdivisions);
      front += fronts[ids[i]] * weights[i] / subdivisions;
    }
    const x = Math.abs(point.x) / radius;
    if (front > 1e-8 && x > 1.0 && x < 1.33) {
      let section = 1;
      while (section < SECTIONS.length - 2 && x > SECTIONS[section + 1][0]) section++;
      const a = SECTIONS[section], b = SECTIONS[section + 1];
      const blend = (x - a[0]) / (b[0] - a[0]);
      const centreY = a[1] + (b[1] - a[1]) * blend;
      const halfY = a[3] + (b[3] - a[3]) * blend;
      const v = Math.max(-1, Math.min(1, (point.y / k - centreY) / halfY));
      const u = (x - 0.86) / (1.39 - 0.86);
      const reach = smooth((x - 1.0) / 0.08) * smooth((1.33 - x) / 0.08);
      const edge = Math.max(0, 1 - v * v);
      // A rolled outer helix, soft bowl below the fold, and one raised inner fold.
      // Each fades to the unchanged contour, root and tip without a separate ridge mesh.
      const helix = 0.006 * gaussian(Math.abs(v) - 0.76, 0.16) * edge;
      const bowl = -0.0025 * gaussian(u - 0.55, 0.25) * gaussian(v + 0.20, 0.43) * edge;
      const fold = 0.0032 * gaussian(u - 0.58, 0.23)
        * gaussian(v - (0.15 + 0.35 * (u - 0.50)), 0.16) * edge;
      point.z += (helix + bowl + fold) * reach * k;
    }
    const index = positions.length / 3;
    positions.push(point.x, point.y, point.z); lookup.set(key, index); return index;
  };
  for (const ids of faces) {
    const at = (i: number, j: number): number => refine(ids, [subdivisions - i - j, i, j]);
    for (let i = 0; i < subdivisions; i++) for (let j = 0; j < subdivisions - i; j++) {
      indices.push(at(i, j), at(i + 1, j), at(i, j + 1));
      if (i + j < subdivisions - 1) indices.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.name = 'original-link-folded-leaf-ear';
  return geometry;
}
