/** Original connected frontal hair foundation, fitted to Link's actual shaped skull. */
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';

/**
 * Local head coordinates, front +Z. This thin closed shell fills the forehead gap beneath
 * the cap; separate authored locks can overlap it without exposing individual bald roots.
 * The sides overlap the existing scalp patch beyond its open frontal sector.
 */
export function createLinkFrontalHair(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link hair radius must be positive and finite');
  const k = radius / 0.125;
  const columns = 40, rows = 12, stride = columns + 1, layerSize = stride * (rows + 1);
  const limit = 1.1;
  const capNormal = new Vector3(0, Math.cos(0.36), -Math.sin(0.36));
  const upperPlane = (0.044 + 0.0018) * k;
  const outerClearance = 0.0026 * k, innerClearance = 0.0008 * k;
  const skull = createLinkFaceGeometry(radius), material = new MeshBasicMaterial();
  const surface = new Mesh(skull, material);
  surface.updateMatrixWorld(true);
  const ray = new Raycaster();
  const direction = new Vector3();
  const points: Vector3[] = [], normals: Vector3[] = [];
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
  const lowerY = (angle: number): number => {
    const t = Math.max(0, Math.min(1, (Math.abs(angle) - 0.68) / (limit - 0.68)));
    const temple = t * t * (3 - 2 * t);
    // Recede beneath the individual sweeps instead of drawing a straight gold
    // band across the forehead. The existing temple/scalp overlap stays seated.
    const part = .049 + .005 * Math.exp(-(((angle + .08) / .23) ** 2))
      - .006 * Math.exp(-(((angle - .55) / .22) ** 2))
      - .008 * Math.exp(-(((angle + .67) / .20) ** 2));
    const fringe = .0015 * Math.sin(angle * 7.1 + .6) + .0007 * Math.sin(angle * 13 - .4);
    return ((part + fringe) * (1 - temple) + .020 * temple) * k;
  };
  const skinAt = (angle: number, y: number): { point: Vector3; normal: Vector3 } => {
    direction.set(Math.sin(angle), 0, Math.cos(angle));
    ray.set(direction.clone().multiplyScalar(0.35 * k).setY(y), direction.clone().negate());
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit || !hit.normal || hit.point.z <= 0) {
      throw new Error(`Frontal hair could not fit Link's forehead at angle=${angle}, y=${y}`);
    }
    const normal = hit.normal.clone().normalize();
    if (normal.dot(direction) <= 0) throw new Error('Frontal hair requires an outward forehead normal');
    return { point: hit.point, normal };
  };

  try {
    const tops: number[] = [];
    for (let column = 0; column <= columns; column++) {
      const angle = -limit + column / columns * limit * 2;
      let low = lowerY(angle), high = 0.12 * k;
      const planeDistance = (y: number): number => {
        const sample = skinAt(angle, y);
        return sample.point.addScaledVector(sample.normal, outerClearance).dot(capNormal) - upperPlane;
      };
      if (!(planeDistance(low) < 0 && planeDistance(high) > 0)) throw new Error('Link hair/cap intersection is not bracketed');
      for (let iteration = 0; iteration < 22; iteration++) {
        const middle = (low + high) * 0.5;
        if (planeDistance(middle) < 0) low = middle;
        else high = middle;
      }
      tops.push((low + high) * 0.5);
    }
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const angle = -limit + column / columns * limit * 2;
      const bottom = lowerY(angle), y = bottom + (tops[column] - bottom) * row / rows;
      const sample = skinAt(angle, y);
      points.push(sample.point); normals.push(sample.normal);
    }
    for (const clearance of [outerClearance, innerClearance]) {
      for (let i = 0; i < layerSize; i++) {
        const p = points[i].clone().addScaledVector(normals[i], clearance);
        vertices.push(p.x, p.y, p.z);
        // U travels root to tip; V crosses the fibres, as on the separate swept locks.
        uvs.push(1 - Math.floor(i / stride) / rows, (i % stride) / columns * 4);
      }
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * stride + column, b = a + 1, c = a + stride, d = c + 1;
      indices.push(a, b, c, b, d, c);
      indices.push(a + layerSize, c + layerSize, b + layerSize, b + layerSize, c + layerSize, d + layerSize);
    }
    const perimeter: number[] = [];
    for (let column = 0; column < columns; column++) perimeter.push(column);
    for (let row = 0; row < rows; row++) perimeter.push(row * stride + columns);
    for (let column = columns; column > 0; column--) perimeter.push(rows * stride + column);
    for (let row = rows; row > 0; row--) perimeter.push(row * stride);
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
      indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
    }
    const geometry = new BufferGeometry();
    geometry.name = 'link-connected-frontal-hair';
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } finally {
    skull.dispose(); material.dispose();
  }
}
