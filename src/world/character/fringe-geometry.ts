/** Original rounded fringe bundles, fitted to Link's shaped forehead. */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';
import { merge } from './geometry';

interface Lock {
  /** Horizontal arc distance and height in unscaled head coordinates. */
  path: readonly (readonly [number, number])[];
  width: number;
  depth: number;
}

const LOCKS: readonly Lock[] = [
  { path: [[.006, .083], [-.018, .071], [-.046, .056], [-.073, .043]], width: .024, depth: .021 },
  { path: [[.014, .081], [.035, .070], [.057, .055], [.078, .041]], width: .023, depth: .020 },
  { path: [[-.055, .075], [-.080, .058], [-.102, .023], [-.109, -.021]], width: .020, depth: .017 },
  { path: [[.059, .073], [.085, .055], [.105, .020], [.113, -.024]], width: .0205, depth: .018 },
  { path: [[-.002, .064], [-.007, .052], [-.014, .040], [-.018, .029]], width: .007, depth: .010 },
  { path: [[.058, .056], [.073, .048], [.083, .038], [.091, .026]], width: .008, depth: .010 },
];

/**
 * Four parted bundles and two secondary tips, front +Z, in local head coordinates.
 * Keep the connected frontal foundation, scalp, sideburns and nape alongside this mesh.
 * Roots fit the seated crown/brim. Only rig.capTail sways; the crown stays on the head.
 */
export function createLinkFringeLocks(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link fringe radius must be positive and finite');
  const k = radius / .125;
  const steps = 28, radial = 16, scalpRadius = .115;
  const skull = createLinkFaceGeometry(radius), material = new MeshBasicMaterial();
  const surface = new Mesh(skull, material);
  surface.updateMatrixWorld(true);
  const ray = new Raycaster(), direction = new Vector3();
  const skinAt = (s: number, y: number): { point: Vector3; normal: Vector3 } => {
    const angle = s / scalpRadius;
    direction.set(Math.sin(angle), 0, Math.cos(angle));
    ray.set(direction.clone().multiplyScalar(.35 * k).setY(y * k), direction.clone().negate());
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit?.normal || hit.point.z <= 0 || hit.normal.dot(direction) <= 0) {
      throw new Error('Link fringe could not fit an outward skull surface');
    }
    return { point: hit.point, normal: hit.normal.clone().normalize() };
  };
  const capNormal = new Vector3(0, Math.cos(.36), -Math.sin(.36));
  const capFade = (point: Vector3): number => {
    // Seat the roots inside the existing thin foundation; expand below the brim.
    const below = (.044 * k - point.dot(capNormal)) / k;
    const t = Math.max(0, Math.min(1, (below - .004) / .022));
    return t * t * (3 - 2 * t);
  };
  const parts: BufferGeometry[] = [];
  try {
    for (const lock of LOCKS) {
      const curve = new CatmullRomCurve3(lock.path.map(([s, y]) => new Vector3(s, y, 0)), false, 'centripetal', .5);
      const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
      let startCentre = new Vector3();
      for (let i = 0; i < steps; i++) {
        const t = i / steps, centre = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
        const across = new Vector3(-tangent.y, tangent.x, 0);
        // Closed oval sections create curved volume instead of flattened sheet edges.
        const width = lock.width * (.46 + .74 * Math.sin(Math.PI * t)) * (1 - t ** 2.4);
        const seatedDepth = .0013 * (1 - t), bodyDepth = lock.depth * Math.sin(Math.PI * t) ** 1.15;
        const base = .00035;
        if (i === 0) {
          const sample = skinAt(centre.x, centre.y);
          startCentre = sample.point.clone().addScaledVector(sample.normal, (base + (seatedDepth + bodyDepth * capFade(sample.point)) * .5) * k);
        }
        for (let j = 0; j < radial; j++) {
          const theta = j / radial * Math.PI * 2;
          const sample = skinAt(centre.x + across.x * width * Math.cos(theta), centre.y + across.y * width * Math.cos(theta));
          const depth = seatedDepth + bodyDepth * capFade(sample.point);
          const offset = base + depth * (1 + Math.sin(theta)) * .5;
          const p = sample.point.addScaledVector(sample.normal, offset * k);
          vertices.push(p.x, p.y, p.z);
          // U follows the bundle; V crosses its width continuously around both sides.
          uvs.push(t, (1 + Math.cos(theta)) * .5);
        }
      }
      for (let i = 0; i < steps - 1; i++) for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
        indices.push(a, b, c, b, d, c);
      }
      const start = vertices.length / 3;
      vertices.push(...startCentre.toArray()); uvs.push(0, .5);
      for (let j = 0; j < radial; j++) indices.push(j, start, (j + 1) % radial);
      const end = curve.getPoint(1), endSkin = skinAt(end.x, end.y);
      const tip = vertices.length / 3;
      vertices.push(...endSkin.point.addScaledVector(endSkin.normal, .00035 * k).toArray()); uvs.push(1, .5);
      for (let j = 0; j < radial; j++) indices.push((steps - 1) * radial + j, (steps - 1) * radial + (j + 1) % radial, tip);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      parts.push(geometry);
    }
    const result = merge(parts);
    result.name = 'link-rounded-fringe-locks';
    result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
  } finally {
    skull.dispose(); material.dispose();
  }
}
