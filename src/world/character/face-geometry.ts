/** Original Link face, centred on the existing head pivot. No imported assets. */
import { BufferGeometry, Float32BufferAttribute, SphereGeometry } from 'three';
import { merge } from './geometry';

const gaussian = (value: number, centre: number, width: number): number =>
  Math.exp(-Math.pow((value - centre) / width, 2));

/**
 * A closed, swept leaf with a broad root and a swept-back point. The root is buried in the
 * temple; the outer surfaces have enough thickness to remain visible from either side.
 */
function pointedEar(radius: number, side: 1 | -1): BufferGeometry {
  const k = radius / 0.125;
  // x/radius, y/k, z/k, vertical half-width/k, front/back half-thickness/k.
  const sections = [
    [0.86, 0.005, 0.016, 0.018, 0.010],
    [1.01, 0.012, 0.010, 0.030, 0.010],
    [1.17, 0.024, -0.004, 0.032, 0.010],
    [1.32, 0.042, -0.027, 0.021, 0.006],
    [1.40, 0.055, -0.047, 0.009, 0.0035],
  ];
  const radial = 16;
  const vertices: number[] = [], indices: number[] = [];
  const triangle = (a: number, b: number, c: number): void => {
    indices.push(...(side > 0 ? [a, b, c] : [a, c, b]));
  };
  sections.forEach(([x, y, z, halfHeight, halfDepth], section) => {
    for (let j = 0; j < radial; j++) {
      const angle = j / radial * Math.PI * 2;
      vertices.push(side * x * radius, (y + halfHeight * Math.cos(angle)) * k,
        (z + halfDepth * Math.sin(angle)) * k);
      if (section < sections.length - 1) {
        const a = section * radial + j, b = a + radial;
        const c = section * radial + (j + 1) % radial, d = c + radial;
        triangle(a, c, b); triangle(b, c, d);
      }
    }
  });
  const tip = vertices.length / 3;
  vertices.push(side * 1.47 * radius, 0.067 * k, -0.059 * k);
  const root = vertices.length / 3;
  vertices.push(side * sections[0][0] * radius, sections[0][1] * k, sections[0][2] * k);
  const last = (sections.length - 1) * radial;
  for (let j = 0; j < radial; j++) {
    const next = (j + 1) % radial;
    triangle(last + j, last + next, tip);
    triangle(j, root, next);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Skull, cheeks, jaw, continuous nose and pointed ears for Link's softFeatures path only.
 * The scalp retains the existing radius and ±1.04r height. Existing eyes, brows and mouth
 * remain separate meshes at their current anchors. Positive Z faces the viewer.
 */
export function createLinkFaceGeometry(radius: number): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link face radius must be positive and finite');
  const k = radius / 0.125;
  // Extra samples resolve the nose bridge directly in the skull, without a pasted-on sphere.
  const skull = new SphereGeometry(radius, 64, 48);
  const position = skull.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const originalX = position.getX(i), originalY = position.getY(i), originalZ = position.getZ(i);
    const ny = originalY / radius;
    const jaw = Math.max(0, -ny);
    // Keep the fitted orbital region exact; soften only the lower cheek/chin taper.
    const lower = Math.min(1, Math.max(0, (jaw - 0.22) / 0.36));
    const taper = 0.22 - 0.06 * lower * lower * (3 - 2 * lower);
    const x = originalX * (1 - taper * Math.pow(jaw, 1.4));
    const y = originalY * 1.04;
    let z = originalZ * 0.98;
    if (originalZ > 0) {
      const front = Math.pow(originalZ / radius, 4);
      // Shallow cheek planes and a small muzzle pad soften the tapered jaw. Their vertical
      // falloff keeps the eye sockets at the established surface depth.
      z += front * (0.015 * radius * gaussian(Math.abs(x) / radius, 0.43, 0.20)
        * gaussian(ny, -0.36, 0.20)
        + 0.003 * k * gaussian(x, 0, 0.036 * k) * gaussian(y, -0.054 * k, 0.022 * k));
      // A shallow orbital shelf brings the cheek into the existing eye planes without moving
      // those planes or covering their almond corners. The falloff also forms the upper cheek.
      z += front * 0.0035 * k * (gaussian(x, -0.050 * k, 0.045 * k)
        + gaussian(x, 0.050 * k, 0.045 * k)) * gaussian(y, -0.004 * k, 0.034 * k);
      // A narrow bridge, defined tip and two tiny alar wings are continuous with the face.
      const bridge = 0.006 * k * gaussian(x, 0, 0.008 * k) * gaussian(y, 0.004 * k, 0.031 * k);
      const tip = 0.0125 * k * gaussian(x, 0, 0.0105 * k) * gaussian(y, -0.027 * k, 0.015 * k);
      const wings = 0.0035 * k * (gaussian(x, -0.013 * k, 0.006 * k)
        + gaussian(x, 0.013 * k, 0.006 * k)) * gaussian(y, -0.034 * k, 0.009 * k);
      z += front * (bridge + tip + wings);
    }
    position.setXYZ(i, x, y, z);
  }
  skull.computeVertexNormals();
  // SphereGeometry keeps unused seam vertices at its poles. Give those the pole normal too,
  // so every normal in the returned buffer is valid, including vertices outside the index.
  const normal = skull.attributes.normal;
  for (let i = 0; i < normal.count; i++) {
    if (normal.getX(i) ** 2 + normal.getY(i) ** 2 + normal.getZ(i) ** 2 < 1e-12) {
      normal.setXYZ(i, 0, Math.sign(position.getY(i)), 0);
    }
  }
  const geometry = merge([skull, pointedEar(radius, 1), pointedEar(radius, -1)]);
  geometry.name = 'original-link-shaped-face';
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
