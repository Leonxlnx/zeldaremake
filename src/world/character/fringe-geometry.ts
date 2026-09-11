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
  // Offset part, overlapping sweeps, and a longer central lock between the brows.
  { path: [[.014, .087], [-.014, .076], [-.044, .064], [-.070, .047]], width: .013, depth: .017 },
  { path: [[.004, .078], [-.022, .068], [-.048, .054], [-.081, .039]], width: .012, depth: .016 },
  { path: [[.011, .083], [.001, .066], [-.010, .040], [-.014, .016]], width: .010, depth: .013 },
  { path: [[.024, .082], [.043, .071], [.064, .058], [.083, .044]], width: .012, depth: .017 },
  { path: [[.022, .073], [.039, .061], [.059, .052], [.077, .038]], width: .010, depth: .014 },
  { path: [[.026, .076], [.021, .059], [.011, .046], [.004, .032]], width: .008, depth: .013 },
  { path: [[-.058, .075], [-.081, .052], [-.099, .020], [-.108, -.018]], width: .013, depth: .016 },
  { path: [[.057, .073], [.082, .050], [.101, .020], [.113, -.021]], width: .012, depth: .015 },
];

/**
 * Eight narrower overlapping swept bundles, front +Z, in local head coordinates.
 * Keep the connected frontal foundation, scalp, sideburns and nape alongside this mesh.
 * Roots fit the seated crown/brim. Only rig.capTail sways; the crown stays on the head.
 */
export function createLinkFringeLocks(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link fringe radius must be positive and finite');
  const k = radius / .125;
  const steps = 28, radial = 12, scalpRadius = .115;
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
        // A rounded terminal taper avoids turning the longer bundles into needles.
        const width = lock.width * (.40 + .62 * Math.sin(Math.PI * t)) * Math.sqrt(1 - t ** 2.2);
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
