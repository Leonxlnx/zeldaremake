/** Original closed scalp base and rounded nape locks; no imported assets. */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';
import { merge } from './geometry';

/** Fit the largest connected face component, so hair never follows the separate ear tips. */
function skullSurface(radius: number): BufferGeometry {
  const geometry = createLinkFaceGeometry(radius), index = geometry.index!;
  const parent = Array.from({ length: geometry.attributes.position.count }, (_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = root(index.getX(i));
    parent[root(index.getX(i + 1))] = a;
    parent[root(index.getX(i + 2))] = a;
  }
  const counts = new Map<number, number>();
  for (let i = 0; i < index.count; i += 3) {
    const r = root(index.getX(i));
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const largest = [...counts].sort((a, b) => b[1] - a[1])[0][0], selected: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    if (root(index.getX(i)) === largest) {
      selected.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  }
  geometry.setIndex(selected);
  return geometry;
}

/**
 * Link-only replacement for the old spherical scalp patch and two nape sweeps.
 * Retain the connected frontal foundation, fringe and existing sideburns.
 */
export function createLinkScalpAndNape(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('Link scalp radius must be positive and finite');
  }
  const k = radius / .125, start = .88, end = Math.PI * 2 - .88, columns = 48, rows = 14, stride = columns + 1;
  const surfaceGeometry = skullSurface(radius), material = new MeshBasicMaterial(), surface = new Mesh(surfaceGeometry, material);
  surface.updateMatrixWorld(true);
  const ray = new Raycaster(), direction = new Vector3();
  const skinAt = (angle: number, y: number): { point: Vector3; normal: Vector3 } => {
    direction.set(Math.sin(angle), 0, Math.cos(angle));
    ray.set(direction.clone().multiplyScalar(.35 * k).setY(y * k), direction.clone().negate());
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit?.normal || hit.point.dot(direction) <= 0 || hit.normal.dot(direction) <= 0) {
      throw new Error('Link scalp requires an outward skull surface');
    }
    return { point: hit.point, normal: hit.normal.clone().normalize() };
  };
  // A higher uneven hem and ear arches replace the old constant-latitude bowl edge.
  const lowerY = (angle: number): number => {
    const front = Math.min(angle - start, end - angle), fade = Math.max(0, 1 - front / .46);
    const irregular = .0035 * Math.sin(3.2 * angle + .4) + .0020 * Math.sin(6.1 * angle - .3);
    const ear = .066 * (Math.exp(-Math.pow((angle - Math.PI / 2) / .30, 2)) + Math.exp(-Math.pow((angle - Math.PI * 1.5) / .30, 2)));
    return -.029 + .011 * fade * fade + irregular + ear;
  };
  const parts: BufferGeometry[] = [], points: Vector3[] = [], normals: Vector3[] = [], positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  try {
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++) {
        const angle = start + (end - start) * col / columns, low = lowerY(angle), y = low + (.110 - low) * row / rows;
        const sample = skinAt(angle, y);
        points.push(sample.point);
        normals.push(sample.normal);
      }
    const layerSize = points.length;
    // The front-sector overlap sits beneath the frontal foundation outer surface.
    for (const clearance of [.0022, .0011])
      for (let i = 0; i < layerSize; i++) {
        const p = points[i].clone().addScaledVector(normals[i], clearance * k);
        positions.push(p.x, p.y, p.z);
        uvs.push(1 - Math.floor(i / stride) / rows, (i % stride) / columns * 6);
      }
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const a = row * stride + col, b = a + 1, c = a + stride, d = c + 1;
        indices.push(a, b, c, b, d, c, a + layerSize, c + layerSize, b + layerSize, b + layerSize, c + layerSize, d + layerSize);
      }
    const edge: number[] = [];
    for (let col = 0; col < columns; col++)
      edge.push(col);
    for (let row = 0; row < rows; row++)
      edge.push(row * stride + columns);
    for (let col = columns; col > 0; col--)
      edge.push(rows * stride + col);
    for (let row = rows; row > 0; row--)
      edge.push(row * stride);
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i], b = edge[(i + 1) % edge.length];
      indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
    }
    const shell = new BufferGeometry();
    shell.setAttribute('position', new Float32BufferAttribute(positions, 3));
    shell.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    shell.setIndex(indices);
    shell.computeVertexNormals();
    parts.push(shell);
    const locks = [
      { path: [[1.94, .004], [2.00, -.030], [1.94, -.059]], width: .0105, depth: .011 },
      { path: [[2.32, -.013], [2.40, -.037], [2.34, -.070]], width: .0115, depth: .012 },
      { path: [[4.33, .004], [4.26, -.032], [4.35, -.062]], width: .0100, depth: .0105 },
      { path: [[3.93, -.015], [3.87, -.038], [3.92, -.067]], width: .0110, depth: .0115 },
    ];
    const steps = 22, radial = 12;
    for (const lock of locks) {
      const curve = new CatmullRomCurve3(lock.path.map(([a, y]) => new Vector3(a * .115, y, 0)), false, 'centripetal', .5);
      const v: number[] = [], uv: number[] = [], ind: number[] = [];
      let first = new Vector3();
      for (let i = 0; i < steps; i++) {
        const t = i / steps, c = curve.getPoint(t), tangent = curve.getTangent(t).normalize(), across = new Vector3(-tangent.y, tangent.x, 0);
        const width = lock.width * (.45 + .72 * Math.sin(Math.PI * t)) * (1 - t ** 2.2), depth = .0012 * (1 - t) + lock.depth * Math.sin(Math.PI * t) ** 1.15;
        const sample = skinAt(c.x / .115, c.y);
        if (i === 0)
          first = sample.point.clone().addScaledVector(sample.normal, (.0003 + depth * .5) * k);
        for (let j = 0; j < radial; j++) {
          const theta = j / radial * Math.PI * 2, s = skinAt((c.x + across.x * width * Math.cos(theta)) / .115, c.y + across.y * width * Math.cos(theta));
          const p = s.point.addScaledVector(s.normal, (.0003 + depth * (1 + Math.sin(theta)) * .5) * k);
          v.push(p.x, p.y, p.z);
          uv.push(t, (1 + Math.cos(theta)) * .5);
        }
      }
      for (let i = 0; i < steps - 1; i++)
        for (let j = 0; j < radial; j++) {
          const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
          ind.push(a, b, c, b, d, c);
        }
      const root = v.length / 3;
      v.push(...first.toArray());
      uv.push(0, .5);
      for (let j = 0; j < radial; j++)
        ind.push(j, root, (j + 1) % radial);
      const end = curve.getPoint(1), last = skinAt(end.x / .115, end.y), tip = v.length / 3;
      v.push(...last.point.addScaledVector(last.normal, .0003 * k).toArray());
      uv.push(1, .5);
      for (let j = 0; j < radial; j++)
        ind.push((steps - 1) * radial + j, (steps - 1) * radial + (j + 1) % radial, tip);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(v, 3));
      g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      g.setIndex(ind);
      g.computeVertexNormals();
      parts.push(g);
    }
    const result = merge(parts);
    result.name = 'link-fitted-scalp-and-nape';
    result.computeBoundingBox();
    result.computeBoundingSphere();
    return result;
  }
  finally {
    surfaceGeometry.dispose();
    material.dispose();
  }
}
