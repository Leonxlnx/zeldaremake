/** Original relaxed hand: continuous buried wrist, palm and softly curled finger pad. */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { merge, sweep } from './geometry';

// Distance down from the nominal wrist, transverse radii and forward centre (metres).
// The true forearm end is s=-.020. The proximal cap is buried 10 mm above it.
const PROFILE = [
  [-.030, .0305, .0305, 0],
  [-.024, .03324, .03324, 0],
  [-.020, .03310, .03310, 0],
  [-.015, .0305, .0295, .0010],
  [-.006, .0280, .0230, .0040],
  [ .006, .0294, .0212, .0065],
  [ .020, .0294, .0218, .0090],
  [ .032, .0284, .0218, .0120],
  [ .043, .02781, .02160, .0150],
] as const;
const FINGER_LENGTH = .01836;
// Match the forearm's polygon count/phase so the 0.1 mm overlap covers its complete end cap.
const RADIAL = 32;

/** Monotone Hermite slopes avoid little rings or bumps between the authored sections. */
function slopes(column: 1 | 2 | 3): number[] {
  const delta = PROFILE.slice(1).map((point, i) => (point[column] - PROFILE[i][column]) / (point[0] - PROFILE[i][0]));
  return PROFILE.map((_, i) => {
    if (i === 0) return delta[0];
    if (i === PROFILE.length - 1) return 0; // tangent to the finger-pad ellipsoid equator
    const a = delta[i - 1], b = delta[i];
    if (a * b <= 0) return 0;
    const left = PROFILE[i][0] - PROFILE[i - 1][0];
    const right = PROFILE[i + 1][0] - PROFILE[i][0];
    const w1 = 2 * right + left, w2 = right + 2 * left;
    return (w1 + w2) / (w1 / a + w2 / b);
  });
}
const DERIVATIVES = [slopes(1), slopes(2), slopes(3)];

function sample(s: number, column: 1 | 2 | 3): [number, number] {
  let i = 0;
  while (i < PROFILE.length - 2 && s > PROFILE[i + 1][0]) i++;
  const p = PROFILE[i], q = PROFILE[i + 1];
  const h = q[0] - p[0], t = (s - p[0]) / h;
  const a = p[column], b = q[column], da = DERIVATIVES[column - 1][i], db = DERIVATIVES[column - 1][i + 1];
  return [
    (2 * t ** 3 - 3 * t * t + 1) * a + (t ** 3 - 2 * t * t + t) * h * da
      + (-2 * t ** 3 + 3 * t * t) * b + (t ** 3 - t * t) * h * db,
    ((6 * t * t - 6 * t) * a + (3 * t * t - 4 * t + 1) * h * da
      + (-6 * t * t + 6 * t) * b + (3 * t * t - 2 * t) * h * db) / h,
  ];
}

/** One closed surface. Its distal half is the previous finger ellipsoid, with no sphere seam. */
export function createRelaxedPalm(forearm: number): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const normal = new Vector3();
  const addRing = (s: number, rx: number, rz: number, z: number, dx: number, dz: number, dc: number) => {
    for (let j = 0; j <= RADIAL; j++) {
      const angle = j / RADIAL * Math.PI * 2, ca = Math.cos(angle), sa = Math.sin(angle);
      positions.push(rx * ca, -forearm - s, z + rz * sa);
      normal.set(rz * ca, rz * dx * ca * ca + rx * sa * (dc + dz * sa), rx * sa).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(j / RADIAL, (s + .030) / (.073 + FINGER_LENGTH));
    }
  };
  for (const [s] of PROFILE) {
    const [rx, dx] = sample(s, 1), [rz, dz] = sample(s, 2), [z, dc] = sample(s, 3);
    addRing(s, rx, rz, z, dx, dz, dc);
  }
  const equator = PROFILE[PROFILE.length - 1];
  for (let k = 1; k <= 3; k++) {
    const angle = k / 4 * Math.PI / 2, ca = Math.cos(angle), sa = Math.sin(angle);
    addRing(equator[0] + FINGER_LENGTH * sa, equator[1] * ca, equator[2] * ca, equator[3],
      -equator[1] / FINGER_LENGTH * sa / ca, -equator[2] / FINGER_LENGTH * sa / ca, 0);
  }
  const ringSize = RADIAL + 1, rings = positions.length / 3 / ringSize;
  for (let ring = 0; ring < rings - 1; ring++) for (let j = 0; j < RADIAL; j++) {
    const a = ring * ringSize + j, b = a + ringSize;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const tip = positions.length / 3;
  positions.push(0, -forearm - equator[0] - FINGER_LENGTH, equator[3]);
  normals.push(0, -1, 0); uvs.push(.5, 1);
  for (let j = 0; j < RADIAL; j++) indices.push((rings - 1) * ringSize + j, (rings - 1) * ringSize + j + 1, tip);

  // Separate normals on this hidden proximal cap; its complete rim lies inside the forearm.
  const root = positions.length / 3;
  positions.push(0, -forearm - PROFILE[0][0], 0); normals.push(0, 1, 0); uvs.push(.5, 0);
  const capRing = positions.length / 3;
  for (let j = 0; j <= RADIAL; j++) {
    positions.push(...positions.slice(j * 3, j * 3 + 3));
    normals.push(0, 1, 0); uvs.push(j / RADIAL, 0);
  }
  for (let j = 0; j < RADIAL; j++) indices.push(capRing + j + 1, capRing + j, root);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Existing thumb geometry, with only the hidden proximal rings seated into the palm. */
export function createRelaxedThumb(forearm: number, side: 1 | -1): BufferGeometry {
  // Build one template and reflect its winding/normals for the other hand. Independent
  // transported sweeps share vertex positions but choose different non-planar quad diagonals.
  const geometry = sweep([
    new Vector3(.023, -forearm - .012, .012),
    new Vector3(.026, -forearm - .022, .031),
    new Vector3(.017, -forearm - .037, .033),
  ], [.012, .012, .009], { segments: 8, radial: 8, closeTip: true, closeStart: true });
  const p = geometry.attributes.position;
  for (let ring = 0; ring < 3; ring++) for (let j = 0; j <= 8; j++) {
    const i = ring * 9 + j, weight = [1, .55, .15][ring];
    p.setXYZ(i, p.getX(i) - .013 * weight, p.getY(i) + .004 * weight, p.getZ(i) - .003 * weight);
  }
  // sweep appends the distal centre, then the proximal centre.
  const cap = p.count - 1;
  p.setXYZ(cap, p.getX(cap) - .013, p.getY(cap) + .004, p.getZ(cap) - .003);
  geometry.computeVertexNormals();
  if (side === -1) {
    const normals = geometry.attributes.normal, index = geometry.index!;
    for (let i = 0; i < p.count; i++) {
      p.setX(i, -p.getX(i));
      normals.setX(i, -normals.getX(i));
    }
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  }
  return geometry;
}

export function createLinkRelaxedHand(forearm: number, side: 1 | -1): BufferGeometry {
  const geometry = merge([createRelaxedPalm(forearm), createRelaxedThumb(forearm, side)]);
  geometry.name = 'link-relaxed-hand';
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
