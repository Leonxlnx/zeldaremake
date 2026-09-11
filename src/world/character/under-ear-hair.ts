/** Original shallow hair layers beneath the ears; the temple locks remain short. */
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';
import { merge } from './geometry';

function skullSurface(radius: number): BufferGeometry {
  const geometry = createLinkFaceGeometry(radius), index = geometry.index!;
  const parents = Array.from({ length: geometry.attributes.position.count }, (_, i) => i);
  const root = (i: number): number => {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = root(index.getX(i)); parents[root(index.getX(i + 1))] = a; parents[root(index.getX(i + 2))] = a;
  }
  const counts = new Map<number, number>();
  for (let i = 0; i < parents.length; i++) counts.set(root(i), (counts.get(root(i)) ?? 0) + 1);
  const largest = [...counts].sort((a, b) => b[1] - a[1])[0][0], selected: number[] = [];
  for (let i = 0; i < index.count; i += 3) if (root(index.getX(i)) === largest)
    selected.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  geometry.setIndex(selected); return geometry;
}

export function createLinkUnderEarHair(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link hair radius must be positive and finite');
  const k = radius / .125, columns = 24, rows = 8, stride = columns + 1;
  const skin = skullSurface(radius), material = new MeshBasicMaterial(), surface = new Mesh(skin, material);
  surface.updateMatrixWorld(true);
  const ray = new Raycaster(), direction = new Vector3(), parts: BufferGeometry[] = [];
  try {
    for (const side of [1, -1]) {
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      const points: Vector3[] = [], normals: Vector3[] = [], thickness: number[] = [];
      for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
        const u = col / columns, v = row / rows;
        // The upper edge stays below the ear. A shallow uneven hem makes two
        // overlapping tufts, instead of following a long strand around a skin gap.
        const angle = side * (1.25 + .98 * u + .025 * v * Math.sin(Math.PI * u));
        const top = -.029 - .005 * Math.cos(Math.PI * u) ** 2;
        const bottom = -.055 - .009 * Math.sin(Math.PI * u) ** 2
          - .0025 * Math.sin(4 * Math.PI * u + (side > 0 ? .2 : -.2));
        const y = (top + (bottom - top) * v) * k;
        direction.set(Math.sin(angle), 0, Math.cos(angle));
        ray.set(direction.clone().multiplyScalar(.35 * k).setY(y), direction.clone().negate());
        const hit = ray.intersectObject(surface, false)[0];
        if (!hit?.normal || hit.normal.dot(direction) <= 0) throw new Error('Under-ear hair requires the outward skull');
        points.push(hit.point.clone()); normals.push(hit.normal.clone().normalize());
        thickness.push((.0014 + .0018 * Math.sin(Math.PI * u) ** 2 * Math.sin(Math.PI * v)) * k);
      }
      const count = points.length;
      for (const outer of [true, false]) for (let i = 0; i < count; i++) {
        const point = points[i].clone().addScaledVector(normals[i], .0008 * k + (outer ? thickness[i] : 0));
        positions.push(...point.toArray());
        uvs.push(Math.floor(i / stride) / rows, (i % stride) / columns);
      }
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const a = row * stride + col, b = a + 1, c = a + stride, d = c + 1;
        const front = side > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c];
        indices.push(...front);
        for (let i = 0; i < front.length; i += 3) indices.push(front[i] + count, front[i + 2] + count, front[i + 1] + count);
      }
      const border: number[] = [];
      for (let col = 0; col < columns; col++) border.push(col);
      for (let row = 0; row < rows; row++) border.push(row * stride + columns);
      for (let col = columns; col > 0; col--) border.push(rows * stride + col);
      for (let row = rows; row > 0; row--) border.push(row * stride);
      for (let i = 0; i < border.length; i++) {
        const a = border[i], b = border[(i + 1) % border.length];
        indices.push(...(side > 0 ? [a, b, a + count, b, b + count, a + count]
          : [a, a + count, b, b, a + count, b + count]));
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
      geometry.computeVertexNormals(); geometry.name = `original-link-under-ear-${side > 0 ? 'left' : 'right'}`;
      parts.push(geometry);
    }
    const result = merge(parts); result.name = 'original-link-under-ear-hair';
    result.computeBoundingBox(); result.computeBoundingSphere(); return result;
  } finally { skin.dispose(); material.dispose(); }
}
