/** Original layered fringe, fitted to Link's shaped forehead. */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createLinkFaceGeometry } from './face-geometry';
import { merge } from './geometry';

interface Lock {
  /** Horizontal arc distance and height in unscaled head coordinates. */
  path: readonly (readonly [number, number])[];
  width: number;
  depth: number;
  peak?: number;
}

const ROOT_LOCKS: readonly Lock[] = [
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

const LOCKS: readonly Lock[] = [
  { path: [[.014,.087],[-.017,.081],[-.047,.063],[-.071,.050]], width:.014, depth:.0075, peak:.38 },
  { path: [[.004,.078],[-.018,.070],[-.043,.055],[-.063,.047]], width:.009, depth:.0055, peak:.47 },
  { path: [[.011,.083],[.006,.065],[-.006,.047],[-.010,.037]], width:.0085, depth:.0065, peak:.33 },
  { path: [[.024,.082],[.043,.075],[.064,.063],[.082,.050]], width:.0125, depth:.007, peak:.44 },
  { path: [[.022,.073],[.038,.066],[.053,.054],[.067,.043]], width:.008, depth:.005, peak:.36 },
  { path: [[.026,.076],[.031,.063],[.027,.053],[.020,.044]], width:.0065, depth:.0048, peak:.48 },
  { path: [[-.058,.075],[-.083,.056],[-.098,.022],[-.108,-.018]], width:.011, depth:.0075, peak:.40 },
  { path: [[.057,.073],[.081,.059],[.099,.024],[.113,-.021]], width:.0095, depth:.0068, peak:.45 },
  { path: [[.001,.069],[-.004,.055],[-.008,.042],[-.007,.034]], width:.0038, depth:.0032, peak:.42 },
  { path: [[.015,.067],[.010,.050],[.004,.035],[.001,.027]], width:.0032, depth:.0024, peak:.52 },
  { path: [[-.018,.069],[-.035,.059],[-.052,.046],[-.061,.040]], width:.0042, depth:.003, peak:.46 },
  { path: [[.031,.067],[.045,.057],[.061,.048],[.073,.041]], width:.0037, depth:.0028, peak:.39 },
];

const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (10 + t * (-15 + 6 * t));
};

/**
 * Eight broad sweeps and four finer interleaves, front +Z, in local head coordinates.
 * The root anchors and original temple end rings retain their fitted joins. Fine locks
 * are requested separately so protected scalp/temple/ear chart offsets never change.
 */
export function createLinkFringeLocks(radius: number, layer: 'sweeps' | 'interleaves' = 'sweeps'): BufferGeometry {
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
    for (let lockIndex = layer === 'sweeps' ? 0 : 8; lockIndex < (layer === 'sweeps' ? 8 : 12); lockIndex++) {
      const lock = LOCKS[lockIndex], old = ROOT_LOCKS[lockIndex];
      const curve = new CatmullRomCurve3(lock.path.map(([s, y]) => new Vector3(s, y, 0)), false, 'centripetal', .5);
      const oldCurve = old ? new CatmullRomCurve3(old.path.map(([s, y]) => new Vector3(s, y, 0)), false, 'centripetal', .5) : null;
      // Refitted root sections follow each new sweep directly. Retaining the old
      // root tangent while shortening these sweeps creates a folded transition.
      const blendAt = (t: number): number => old && lockIndex >= 6
        ? 1 - smooth((t - .64) / (23 / steps - .64)) : 1;
      const pointAt = (t: number): Vector3 => {
        const point = curve.getPoint(t), blend = blendAt(t);
        return oldCurve && blend < 1 ? oldCurve.getPoint(t).lerp(point, blend) : point;
      };
      const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
      let startCentre = new Vector3();
      for (let i = 0; i < steps; i++) {
        const t = i / steps, blend = blendAt(t), centre = pointAt(t);
        // Differentiate the final blended path; blending the source tangents would
        // miss the blend derivative and twist the connecting sections.
        const tangent = oldCurve && blend === 0 ? oldCurve.getTangent(t).normalize()
          : pointAt(Math.min(1, t + 1e-5)).sub(pointAt(Math.max(0, t - 1e-5))).normalize();
        const across = new Vector3(-tangent.y, tangent.x, 0);
        // Closed oval sections create curved volume instead of flattened sheet edges.
        // A rounded terminal taper avoids turning the longer bundles into needles.
        const peak = lock.peak!, a = 2 * peak, b = 2 * (1 - peak);
        const fullness = (t / peak) ** a * ((1 - t) / (1 - peak)) ** b;
        const taper = Math.sqrt(1 - t ** 2.2);
        const newWidth = lock.width * (.40 + .62 * fullness) * taper;
        const oldWidth = old ? old.width * (.40 + .62 * Math.sin(Math.PI * t)) * taper : newWidth;
        const width = oldWidth + (newWidth - oldWidth) * blend;
        const newDepth = lock.depth * fullness ** 1.15;
        const oldDepth = old ? old.depth * Math.sin(Math.PI * t) ** 1.15 : newDepth;
        const seatedDepth = .0013 * (1 - t), bodyDepth = oldDepth + (newDepth - oldDepth) * blend;
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
      const end = pointAt(1), endSkin = skinAt(end.x, end.y);
      const tip = vertices.length / 3;
      vertices.push(...endSkin.point.addScaledVector(endSkin.normal, .00035 * k).toArray()); uvs.push(1, .5);
      for (let j = 0; j < radial; j++) indices.push((steps - 1) * radial + j, (steps - 1) * radial + (j + 1) % radial, tip);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      finishFringeNormals(geometry, lockIndex === 6 || lockIndex === 7);
      parts.push(geometry);
    }
    const result = merge(parts);
    result.name = layer === 'sweeps' ? 'link-layered-fringe-sweeps' : 'link-fine-fringe-interleaves';
    result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
  } finally {
    skull.dispose(); material.dispose();
  }
}

/**
 * A very shallow closed lens has skinny return triangles beside larger outer faces.
 * Area-weighted smoothing can point through one of those returns. Replace only an
 * invalid vertex normal by the angular centre of its actual incident face normals.
 * The finite maximum-margin centre is supported by one, two, or three face normals.
 * A nonpositive margin is a geometric failure, never a reason to hide the surface.
 */
function finishFringeNormals(geometry: BufferGeometry, preserveTemple: boolean): void {
  const position = geometry.attributes.position, normal = geometry.attributes.normal, index = geometry.index!;
  const incident: Vector3[][] = Array.from({ length: position.count }, () => []);
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let f = 0; f < index.count; f += 3) {
    const ia = index.getX(f), ib = index.getX(f + 1), ic = index.getX(f + 2);
    a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic);
    const n = b.sub(a).cross(c.sub(a)).normalize().clone();
    incident[ia].push(n); incident[ib].push(n); incident[ic].push(n);
  }
  for (let i = 0; i < position.count; i++) {
    // These existing temple end rings and their fan keep their exact shared join.
    if (preserveTemple && ((i >= 288 && i <= 335) || i === 337)) continue;
    const faces = incident[i], current = new Vector3().fromBufferAttribute(normal, i);
    if (faces.every(n => current.dot(n) > 0)) continue;
    let margin = -Infinity;
    const best = new Vector3();
    const consider = (n: Vector3): void => {
      if (n.lengthSq() < 1e-20) return;
      n.normalize();
      const score = Math.min(...faces.map(face => n.dot(face)));
      if (score > margin) { margin = score; best.copy(n); }
    };
    for (const n of faces) consider(n.clone());
    for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
      consider(faces[a].clone().add(faces[b]));
      for (let c = b + 1; c < faces.length; c++) {
        const n = faces[a].clone().sub(faces[b]).cross(faces[a].clone().sub(faces[c]));
        consider(n.clone()); consider(n.negate());
      }
    }
    if (!(margin > 0)) throw new Error('Link fringe needs an outward normal at every changed corner');
    normal.setXYZ(i, best.x, best.y, best.z);
  }
  normal.needsUpdate = true;
}
