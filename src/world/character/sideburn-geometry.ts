/** Original Link-only swept temple locks, fitted to the unchanged skull. */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';
import { merge } from './geometry';

// Match the scalp fitter: the largest connected component is the skull. Separate
// pointed ears must not pull a hair lock out over the ear as it sweeps backward.
function skullSurface(radius: number): BufferGeometry {
  const geometry = createLinkFaceGeometry(radius), index = geometry.index!;
  const parent = Array.from({ length: geometry.attributes.position.count }, (_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = root(index.getX(i));
    parent[root(index.getX(i + 1))] = a; parent[root(index.getX(i + 2))] = a;
  }
  const counts = new Map<number, number>();
  for (let i = 0; i < index.count; i += 3) {
    const component = root(index.getX(i)); counts.set(component, (counts.get(component) ?? 0) + 1);
  }
  const largest = [...counts].sort((a, b) => b[1] - a[1])[0][0], selected: number[] = [];
  for (let i = 0; i < index.count; i += 3) if (root(index.getX(i)) === largest) {
    selected.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  }
  geometry.setIndex(selected); return geometry;
}

/** Two unequal curved bundles per temple; +Z is the front of the head. */
export function createLinkSideburnLocks(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link hair radius must be positive and finite');
  const k = radius / .125, arcRadius = .115, steps = 26, radial = 12;
  const surfaceGeometry = skullSurface(radius), material = new MeshBasicMaterial();
  const surface = new Mesh(surfaceGeometry, material); surface.updateMatrixWorld(true);
  const ray = new Raycaster(), direction = new Vector3();
  const skinAt = (angle: number, y: number) => {
    direction.set(Math.sin(angle), 0, Math.cos(angle));
    ray.set(direction.clone().multiplyScalar(.35 * k).setY(y * k), direction.clone().negate());
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit?.normal || hit.normal.dot(direction) <= 0) throw new Error('Link sideburn requires an outward skull surface');
    return { point: hit.point, normal: hit.normal.clone().normalize() };
  };
  const locks = [
    { path: [[1.065,.040],[1.020,.008],[1.030,-.040],[1.120,-.064]], width: .0110, depth: .0120 },
    { path: [[1.230,.042],[1.250,.010],[1.280,-.020],[1.340,-.042]], width: .0080, depth: .0090 },
  ];
  const parts: BufferGeometry[] = [];
  try {
    for (const side of [1, -1]) for (const [which, lock] of locks.entries()) {
      const curve = new CatmullRomCurve3(lock.path.map(([angle, y]) => new Vector3(side * angle * arcRadius, y, 0)), false, 'centripetal', .5);
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      let rootCentre = new Vector3();
      for (let row = 0; row < steps; row++) {
        const t = row / steps, centre = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
        const across = new Vector3(-tangent.y, tangent.x, 0);
        const width = lock.width * (.40 + .65 * Math.sin(Math.PI * t)) * Math.sqrt(1 - t ** 2.2);
        const depth = .0012 * (1 - t) + lock.depth * Math.sin(Math.PI * t) ** 1.15;
        if (row === 0) {
          const sample = skinAt(centre.x / arcRadius, centre.y);
          rootCentre = sample.point.clone().addScaledVector(sample.normal, (.00035 + depth * .5) * k);
        }
        for (let j = 0; j < radial; j++) {
          const theta = j / radial * Math.PI * 2;
          const sample = skinAt((centre.x + across.x * width * Math.cos(theta)) / arcRadius,
            centre.y + across.y * width * Math.cos(theta));
          const p = sample.point.addScaledVector(sample.normal, (.00035 + depth * (1 + Math.sin(theta)) * .5) * k);
          positions.push(p.x, p.y, p.z); uvs.push(t, (1 + Math.cos(theta)) * .5);
        }
      }
      for (let row = 0; row < steps - 1; row++) for (let j = 0; j < radial; j++) {
        const a = row * radial + j, b = row * radial + (j + 1) % radial, c = a + radial, d = b + radial;
        indices.push(a,b,c,b,d,c);
      }
      const root = positions.length / 3; positions.push(...rootCentre.toArray()); uvs.push(0,.5);
      for (let j = 0; j < radial; j++) indices.push(j,root,(j + 1) % radial);
      const end = curve.getPoint(1), sample = skinAt(end.x / arcRadius, end.y), tip = positions.length / 3;
      positions.push(...sample.point.addScaledVector(sample.normal, .00035 * k).toArray()); uvs.push(1,.5);
      for (let j = 0; j < radial; j++) indices.push((steps - 1) * radial + j,(steps - 1) * radial + (j + 1) % radial,tip);
      const geometry = new BufferGeometry();
      geometry.name = `link-sideburn-${side > 0 ? 'left' : 'right'}-${which === 0 ? 'long' : 'short'}`;
      geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2)); geometry.setIndex(indices);
      geometry.computeVertexNormals(); parts.push(geometry);
    }
    const result = merge(parts); result.name = 'link-paired-temple-locks';
    result.computeBoundingBox(); result.computeBoundingSphere(); return result;
  } finally { surfaceGeometry.dispose(); material.dispose(); }
}
