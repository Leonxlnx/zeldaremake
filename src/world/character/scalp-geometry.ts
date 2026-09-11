/** Original closed scalp base and rounded nape locks; no imported assets. */
import { BufferGeometry, CubicBezierCurve3, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Triangle, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';
import { merge } from './geometry';

const joinPoints = new Map<number, readonly [Vector3, Vector3]>();

/** Interior of an actual outer-lock section, so the lower temple layer ends inside hair. */
function fitLowerJoin(geometry: BufferGeometry, hint: Vector3, k: number): Vector3 {
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(), triangle = new Triangle(), centre = new Vector3(), normal = new Vector3(), radial = new Vector3();
  const position = geometry.attributes.position, index = geometry.index!;
  let result: Vector3 | undefined, nearest = Infinity;
  try {
    for (let i = 0; i < index.count; i += 3) {
      triangle.a.fromBufferAttribute(position, index.getX(i));
      triangle.b.fromBufferAttribute(position, index.getX(i + 1));
      triangle.c.fromBufferAttribute(position, index.getX(i + 2));
      triangle.getMidpoint(centre); triangle.getNormal(normal);
      radial.set(centre.x, 0, centre.z).normalize();
      const angle = Math.atan2(Math.abs(centre.x), centre.z);
      if (angle < 1.95 || angle > 2.35 || centre.y / k < -.080 || centre.y / k > -.040 || normal.dot(radial) < .45) continue;
      ray.set(radial.clone().multiplyScalar(.35 * k).setY(centre.y), radial.clone().negate());
      const hits = ray.intersectObject(mesh, false).filter(hit => hit.point.dot(radial) > 0);
      const section: Vector3[] = [];
      for (const hit of hits) if (!section.length || hit.point.distanceTo(section[section.length - 1]) > 1e-8 * k) section.push(hit.point);
      if (section.length !== 2 || section[0].distanceTo(section[1]) < .003 * k) continue;
      const midpoint = section[0].clone().add(section[1]).multiplyScalar(.5), distance = midpoint.distanceTo(hint);
      if (distance < nearest) { result = midpoint; nearest = distance; }
    }
    if (!result) throw new Error('Link lower temple layer requires a finite nape attachment');
    return result;
  } finally { material.dispose(); }
}

/** Two cached points only; returned clones keep the authored attachment independent of callers. */
export function linkLowerHairJoins(radius: number): readonly [Vector3, Vector3] {
  if (!joinPoints.has(radius)) createLinkScalpAndNape(radius).dispose();
  const points = joinPoints.get(radius)!;
  return [points[0].clone(), points[1].clone()];
}

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
  // Extend the rear carrier below the occiput, while leaving the ear arches,
  // frontal sectors and upper cap-facing rows at their existing skull samples.
  const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const posterior = (angle: number): number => smooth((angle - 1.94) / .40) * smooth((Math.PI * 2 - 1.94 - angle) / .40);
  const parts: BufferGeometry[] = [], points: Vector3[] = [], normals: Vector3[] = [], positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  try {
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++) {
        const angle = start + (end - start) * col / columns, low = lowerY(angle);
        // The centre stays at its existing height under the cap tail. Broad
        // side lobes taper into that clearance channel, independent of pose.
        const side = smooth((Math.abs(angle - Math.PI) - .52) / .23);
        let y = low + (.110 - low) * row / rows - .052 * posterior(angle) * side * (1 - smooth(row / 6));
        // Continue the lower side layer behind the ear, retaining the complete
        // ear-facing sample guard, upper rows and central cap-tail channel.
        const sideAngle = Math.min(angle, Math.PI * 2 - angle);
        const bridge = smooth((sideAngle - 1.90) / .15) * (1 - smooth((sideAngle - 2.16) / .20));
        if (row < 6 && bridge > 0) {
          const hem = low - .052 * posterior(angle) * side;
          y -= Math.max(0, hem + .066) * bridge * (1 - smooth(row / 6));
        }
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
    // The same four closed charts form broad overlapping masses, with uneven
    // lengths and shallow curls. The carrier remains visible between their roots.
    const locks = [
      { path: [[2.16, -.006], [1.96, -.041], [2.14, -.074], [2.31, -.086]], width: .028, depth: .0115 },
      { path: [[2.53, -.014], [2.50, -.049], [2.34, -.088], [2.49, -.100]], width: .020, depth: .0105 },
      { path: [[4.12, -.008], [4.30, -.043], [4.16, -.072], [3.99, -.084]], width: .028, depth: .011 },
      { path: [[3.76, -.015], [3.79, -.050], [3.94, -.086], [3.80, -.098]], width: .020, depth: .0105 },
    ];
    const steps = 22, radial = 12;
    const joins: Vector3[] = [];
    for (const [which, lock] of locks.entries()) {
      const controls = lock.path.map(([a, y]) => new Vector3(a * .115, y, 0));
      const curve = new CubicBezierCurve3(controls[0], controls[1], controls[2], controls[3]);
      const v: number[] = [], uv: number[] = [], ind: number[] = [];
      let first = new Vector3();
      for (let i = 0; i < steps; i++) {
        const t = i / steps, c = curve.getPoint(t), tangent = curve.getTangent(t).normalize(), across = new Vector3(-tangent.y, tangent.x, 0);
        const width = lock.width * (.45 + .72 * Math.sin(Math.PI * t)) * (1 - t) ** .65, depth = .0012 * (1 - t) + lock.depth * Math.sin(Math.PI * t) ** 1.15;
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
      if ((which === 0 || which === 2) && !joinPoints.has(radius)) {
        const hint = skinAt(which === 0 ? 2.02 : Math.PI * 2 - 2.02, -.068);
        joins.push(fitLowerJoin(g, hint.point.addScaledVector(hint.normal, .00035 * k), k));
      }
      parts.push(g);
    }
    if (joins.length === 2) joinPoints.set(radius, [joins[0], joins[1]]);
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
