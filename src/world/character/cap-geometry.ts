/** Original Link cloth crown: preserve the fitted base, add shallow cloth gathers. */
import { MathUtils, SphereGeometry, Vector3 } from 'three';

export function createLinkCapCrown(radius: number): SphereGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link cap radius must be finite and positive');
  const k = radius / .125, R = radius * 1.06 + .008, stretch = 1.12, d = .044 * k;
  const thetaMax = Math.acos(d / (stretch * R)), sinMax = Math.sin(thetaMax);
  const geometry = new SphereGeometry(R, 44, 28, 0, Math.PI * 2, 0, thetaMax);
  const position = geometry.attributes.position, normal = new Vector3();
  const smooth = (lo: number, hi: number, value: number): number => {
    const t = MathUtils.clamp((value - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < position.count; i++) {
    const rawY = position.getY(i), theta = Math.acos(MathUtils.clamp(rawY / R, -1, 1));
    const taper = 1 - .18 * Math.pow(Math.max(0, 1 - Math.sin(theta) / sinMax), 1.5);
    const x = position.getX(i) * taper, z = position.getZ(i) * taper;
    // Retain the original 10 mm rear depression and its exact fitted base formula.
    const depressionDistance = ((x - .025) / .055) ** 2 + ((z + .075) / .040) ** 2;
    const depression = .010 * Math.exp(-depressionDistance), y = rawY * stretch - depression;
    const phi = Math.atan2(z, x);
    // Zero over the lower 20 mm, through the fitted frontal hair zone, at the pole,
    // and at the original rear depression. The ridges grow only outward.
    const lower = smooth(.020 * k, .052 * k, y - d);
    const front = 1 - smooth(.015 * k, .060 * k, z) * (1 - smooth(.090 * k, .123 * k, y));
    const rear = smooth(.30, 1.45, depressionDistance);
    const pole = smooth(.08, .40, Math.sin(theta));
    const phase = 5 * phi + 1.15 * Math.sin(theta * 2.7) + .38 * Math.sin(3 * phi + .65) + 1.4 * theta;
    const ridge = Math.pow(.5 + .5 * Math.cos(phase), 3);
    const uneven = .74 + .26 * (.5 + .5 * Math.sin(2 * phi - .7));
    const amount = .0038 * lower * front * rear * pole * ridge * uneven;
    normal.set(x, y / (stretch * stretch), z).normalize();
    position.setXYZ(i, x + normal.x * amount, y + normal.y * amount, z + normal.z * amount);
  }
  geometry.computeVertexNormals();
  // Sphere UVs duplicate the seam and pole. Share their geometric normal so cloth
  // does not acquire a lighting crease at that artificial parameter boundary.
  const normals = geometry.attributes.normal, groups = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e7)).join(',');
    const group = groups.get(key);
    if (group) group.push(i); else groups.set(key, [i]);
  }
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    normal.set(0, 0, 0);
    for (const i of indices) normal.add(new Vector3().fromBufferAttribute(normals, i));
    normal.normalize();
    for (const i of indices) normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.name = 'link-cloth-cap-crown';
  return geometry;
}
