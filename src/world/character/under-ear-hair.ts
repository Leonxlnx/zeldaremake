/** Original descending locks behind the ears; the short temple locks remain unchanged. */
import { BufferGeometry, CubicBezierCurve3, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
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

/** Two unequal shallow locks per side descend from the cap-side carrier toward the nape. */
export function createLinkUnderEarHair(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link hair radius must be positive and finite');
  const k = radius / .125, arcRadius = .115, steps = 28, radial = 12;
  const skin = skullSurface(radius), material = new MeshBasicMaterial(), surface = new Mesh(skin, material);
  surface.updateMatrixWorld(true);
  const ray = new Raycaster(), direction = new Vector3(), parts: BufferGeometry[] = [];
  const skinAt = (angle: number, y: number) => {
    direction.set(Math.sin(angle), 0, Math.cos(angle));
    ray.set(direction.clone().multiplyScalar(.35 * k).setY(y * k), direction.clone().negate());
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit?.normal || hit.normal.dot(direction) <= 0) throw new Error('Behind-ear hair requires the outward skull');
    return { point: hit.point, normal: hit.normal.clone().normalize() };
  };
  const locks = [
    { path: [[1.56,.048],[1.63,.018],[1.78,-.030],[1.90,-.067]], width: .011, depth: .006 },
    { path: [[1.73,.041],[1.80,.010],[1.92,-.032],[2.05,-.074]], width: .013, depth: .008 },
  ];
  try {
    for (const side of [1, -1]) for (const [which, lock] of locks.entries()) {
      const controls = lock.path.map(([angle, y]) => new Vector3(side * angle * arcRadius, y, 0));
      const curve = new CubicBezierCurve3(controls[0], controls[1], controls[2], controls[3]);
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      let rootCentre = new Vector3();
      for (let row = 0; row < steps; row++) {
        const t = row / steps, centre = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
        const across = new Vector3(-tangent.y, tangent.x, 0);
        const width = lock.width * (.38 + .70 * Math.sin(Math.PI * t)) * Math.sqrt(1 - t);
        const depth = .0016 * (1 - t) + lock.depth * Math.sin(Math.PI * t) ** 1.15;
        if (row === 0) {
          const sample = skinAt(centre.x / arcRadius, centre.y);
          rootCentre = sample.point.clone().addScaledVector(sample.normal, (.00055 + depth * .5) * k);
        }
        for (let j = 0; j < radial; j++) {
          const theta = j / radial * Math.PI * 2;
          const sample = skinAt((centre.x + across.x * width * Math.cos(theta)) / arcRadius,
            centre.y + across.y * width * Math.cos(theta));
          const point = sample.point.addScaledVector(sample.normal, (.00055 + depth * (1 + Math.sin(theta)) * .5) * k);
          positions.push(...point.toArray()); uvs.push(t, (1 + Math.cos(theta)) * .5);
        }
      }
      for (let row = 0; row < steps - 1; row++) for (let j = 0; j < radial; j++) {
        const a = row * radial + j, b = row * radial + (j + 1) % radial, c = a + radial, d = b + radial;
        indices.push(a, b, c, b, d, c);
      }
      const root = positions.length / 3; positions.push(...rootCentre.toArray()); uvs.push(0, .5);
      for (let j = 0; j < radial; j++) indices.push(j, root, (j + 1) % radial);
      const end = curve.getPoint(1), sample = skinAt(end.x / arcRadius, end.y), tip = positions.length / 3;
      positions.push(...sample.point.addScaledVector(sample.normal, .00055 * k).toArray()); uvs.push(1, .5);
      for (let j = 0; j < radial; j++) indices.push((steps - 1) * radial + j, (steps - 1) * radial + (j + 1) % radial, tip);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
      geometry.computeVertexNormals();
      // The curved tip fan has unequal face areas. Give each outward face one
      // vote so its common tip normal stays inside the whole fan's hemisphere.
      const tipNormal = new Vector3(), edgeA = new Vector3(), edgeB = new Vector3();
      const pointA = new Vector3(), pointB = new Vector3(), pointC = new Vector3();
      const position = geometry.attributes.position;
      for (let j = 0; j < radial; j++) {
        pointA.fromBufferAttribute(position, (steps - 1) * radial + j);
        pointB.fromBufferAttribute(position, (steps - 1) * radial + (j + 1) % radial);
        pointC.fromBufferAttribute(position, tip);
        tipNormal.add(edgeA.subVectors(pointB, pointA).cross(edgeB.subVectors(pointC, pointA)).normalize());
      }
      tipNormal.normalize(); geometry.attributes.normal.setXYZ(tip, tipNormal.x, tipNormal.y, tipNormal.z);
      geometry.name = `original-link-behind-ear-${side > 0 ? 'left' : 'right'}-${which}`;
      parts.push(geometry);
    }
    const result = merge(parts); result.name = 'original-link-descending-behind-ear-locks';
    result.computeBoundingBox(); result.computeBoundingSphere(); return result;
  } finally { skin.dispose(); material.dispose(); }
}
