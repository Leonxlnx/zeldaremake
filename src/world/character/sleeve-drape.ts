/** Static, mirrored shoulder slope shared by the short sleeve and its sewn thread. */
import { type BufferGeometry, Vector3 } from 'three';

// Entire original sleeve/tunic join, measured over the six reviewed arm configurations.
const JOIN_OUTWARD = .011418040841817856;

const smooth = (t: number): number => t * t * t * (10 + t * (-15 + 6 * t));
const slope = (t: number): number => 30 * t * t * (1 - t) * (1 - t);
const integrated = (t: number): number => t * t * t * t * (2.5 - 3 * t + t * t);

export function shapeLinkSleeveDrape(geometry: BufferGeometry, side: 1 | -1): void {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), outward = side * x;
    // The complete original join remains seated exactly against the upper tunic.
    if (outward <= JOIN_OUTWARD) continue;
    const u = Math.min(1, (outward - JOIN_OUTWARD) / .025);
    // Integrate the slope ramp so the hem never steepens beyond its final slope.
    const q = u < 1 ? .025 * integrated(u) : outward - JOIN_OUTWARD - .0125;
    const qx = side * smooth(u);
    const t = Math.max(0, Math.min(1, (y + .09) / .105));
    const f = .25 - .57 * smooth(t);
    const fy = t > 0 && t < 1 ? -.57 * slope(t) / .105 : 0;
    const determinant = 1 + q * fy;
    if (!(determinant > 0)) throw new Error('Sleeve drape must preserve local orientation');
    positions.setY(i, y + q * f);
    const ny = normals.getY(i) / determinant;
    const nx = normals.getX(i) - qx * f * ny, nz = normals.getZ(i);
    const length = Math.hypot(nx, ny, nz);
    normals.setXYZ(i, nx / length, ny / length, nz / length);
  }
  positions.needsUpdate = true; normals.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

/** Finish only thread-rim normals that oppose an incident face after the shear. */
export function finishLinkSleeveThreadNormals(geometry: BufferGeometry, side: 1 | -1): void {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  const indices = geometry.getIndex();
  if (!indices) throw new Error('Sleeve thread requires indexed faces');
  const faces: Vector3[] = [];
  const incident: number[][] = Array.from({ length: positions.count }, () => []);
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let i = 0; i < indices.count; i += 3) {
    const ia = indices.getX(i), ib = indices.getX(i + 1), ic = indices.getX(i + 2);
    a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    const face = new Vector3().subVectors(b, a).cross(c.sub(a)).normalize();
    if (face.lengthSq() === 0) throw new Error('Sleeve thread has a degenerate face');
    faces.push(face);
    for (const vertex of [ia, ib, ic]) incident[vertex].push(faces.length - 1);
  }
  const replacements: { vertex: number; normal: Vector3 }[] = [];
  for (let i = 0; i < positions.count; i++) {
    const normal = new Vector3().fromBufferAttribute(normals, i);
    if (incident[i].every(face => faces[face].dot(normal) > 0)) continue;
    if (side * positions.getX(i) <= JOIN_OUTWARD) {
      throw new Error('Sleeve thread finishing must preserve the original join normals');
    }
    // A shared tube/cap rim needs a normal inside the hemisphere of every real face.
    // Area weighting can still oppose the small end cap, so verify the unit-face sum.
    normal.set(0, 0, 0);
    for (const face of incident[i]) normal.add(faces[face]);
    normal.normalize();
    if (!incident[i].every(face => faces[face].dot(normal) > 0)) {
      throw new Error('Sleeve thread rim has no verified shared normal hemisphere');
    }
    replacements.push({ vertex: i, normal });
  }
  for (const { vertex, normal } of replacements) normals.setXYZ(vertex, normal.x, normal.y, normal.z);
  normals.needsUpdate = true;
}
