/** Original short cloth sleeve, in Link's unchanged shoulder-joint coordinates. */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/** A low shoulder cap and gently flared, folded opening around the existing upper arm. */
export function createLinkSleeve(): BufferGeometry {
  // Outer cap -> hem fold -> inner lining. Separate poles close the shoulder's fabric;
  // the hem remains an open arm aperture with a real 4 mm folded edge.
  const profile = [
    [0, .030], [.020, .029], [.038, .024], [.049, .014], [.055, .001],
    [.056, -.030], [.0585, -.077], [.061, -.101], [.0605, -.105],
    [.0565, -.105], [.056, -.101], [.054, -.077], [.0515, -.030],
    [.0505, .001], [.045, .014], [.034, .021], [.016, .025], [0, .026],
  ];
  const sides = 32, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rows: number[][] = [], distances = [0];
  for (let i = 1; i < profile.length; i++) distances.push(distances[i - 1]
    + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  const length = distances[distances.length - 1];
  for (let i = 0; i < profile.length; i++) {
    const [radius, y] = profile[i], row: number[] = [];
    for (let j = 0; j < (radius === 0 ? 1 : sides + 1); j++) {
      // The duplicate UV seam shares exactly the same position and, below, its normal.
      const angle = (j % sides) / sides * Math.PI * 2;
      const hem = Math.max(0, Math.min(1, -y / .105));
      const fold = 1 + .009 * hem * hem * Math.sin(3 * angle + .4);
      row.push(positions.length / 3);
      positions.push(radius * Math.sin(angle) * fold, y, radius * Math.cos(angle) * .94 * fold);
      uvs.push(radius === 0 ? .5 : j / sides, distances[i] / length);
    }
    rows.push(row);
  }
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < sides; j++) {
    const a = rows[i], b = rows[i + 1];
    if (a.length === 1) indices.push(a[0], b[j], b[j + 1]);
    else if (b.length === 1) indices.push(a[j], b[0], a[j + 1]);
    else indices.push(a[j], b[j], a[j + 1], a[j + 1], b[j], b[j + 1]);
  }
  const geometry = new BufferGeometry();
  geometry.name = 'original-link-flared-cloth-sleeve';
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal'), seam = new Vector3(), other = new Vector3();
  for (const row of rows) if (row.length > 1) {
    seam.fromBufferAttribute(normals, row[0]).add(other.fromBufferAttribute(normals, row[sides])).normalize();
    normals.setXYZ(row[0], seam.x, seam.y, seam.z);
    normals.setXYZ(row[sides], seam.x, seam.y, seam.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
