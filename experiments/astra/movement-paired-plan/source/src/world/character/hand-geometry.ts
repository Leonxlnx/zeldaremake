/** Original relaxed hand: fitted wrist, short palm, four relaxed fingers and a soft inward thumb. */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { merge } from './geometry';

// Distance down from the nominal wrist, transverse radii and forward centre (metres).
// The true forearm end is s=-.020. The proximal cap is buried 10 mm above it.
const PROFILE = [
  [-.030, .0305, .0305, 0],
  [-.024, .03324, .03324, 0],
  [-.020, .03310, .03310, 0],
  [-.015, .0305, .0295, .0010],
  [-.006, .0280, .0230, .0040],
  [ .006, .0294, .0212, .0065],
  [ .020, .0268, .0218, .0090],
  [ .029, .0248, .0180, .0130],
  [ .035, .0210, .0120, .0150],
] as const;
const FINGER_LENGTH = .005;
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

/** One closed palm surface; the original wrist rows remain fitted to the forearm. */
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

type DigitSection = readonly [s: number, x: number, z: number, rx: number, rz: number];

/** Smooth elliptical sections with a rounded distal cap; proximal caps are buried in palm. */
function relaxedDigit(forearm: number, profile: readonly DigitSection[], tipLength: number, radial: number): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const derivatives = [1, 2, 3, 4].map(column => {
    const delta = profile.slice(1).map((p, i) => (p[column] - profile[i][column]) / (p[0] - profile[i][0]));
    return profile.map((_, i) => {
      if (i === 0) return delta[0];
      if (i === profile.length - 1) return 0;
      const a = delta[i - 1], b = delta[i];
      if (a * b <= 0) return 0;
      const left = profile[i][0] - profile[i - 1][0], right = profile[i + 1][0] - profile[i][0];
      const w1 = 2 * right + left, w2 = right + 2 * left;
      return (w1 + w2) / (w1 / a + w2 / b);
    });
  });
  const equator = profile[profile.length - 1], normal = new Vector3();
  const addRing = (s: number, x: number, z: number, rx: number, rz: number, dx: number, dz: number, drx: number, drz: number) => {
    for (let j = 0; j <= radial; j++) {
      const angle = (j === radial ? 0 : j) / radial * Math.PI * 2, ca = Math.cos(angle), sa = Math.sin(angle);
      positions.push(x + rx * ca, -forearm - s, z + rz * sa);
      normal.set(rz * ca, rz * ca * (dx + drx * ca) + rx * sa * (dz + drz * sa), rx * sa).normalize();
      normals.push(normal.x, normal.y, normal.z); uvs.push(j / radial, (s - profile[0][0]) / (equator[0] + tipLength - profile[0][0]));
    }
  };
  for (let section = 0; section < profile.length - 1; section++) for (let step = 0; step < 2; step++) {
    const p = profile[section], q = profile[section + 1], h = q[0] - p[0], t = step / 2;
    const values: number[] = [], slopes: number[] = [];
    for (let column = 1; column <= 4; column++) {
      const a = p[column], b = q[column], da = derivatives[column - 1][section], db = derivatives[column - 1][section + 1];
      values.push((2 * t ** 3 - 3 * t * t + 1) * a + (t ** 3 - 2 * t * t + t) * h * da
        + (-2 * t ** 3 + 3 * t * t) * b + (t ** 3 - t * t) * h * db);
      slopes.push(((6 * t * t - 6 * t) * a + (3 * t * t - 4 * t + 1) * h * da
        + (-6 * t * t + 6 * t) * b + (3 * t * t - 2 * t) * h * db) / h);
    }
    addRing(p[0] + h * t, values[0], values[1], values[2], values[3], slopes[0], slopes[1], slopes[2], slopes[3]);
  }
  addRing(equator[0], equator[1], equator[2], equator[3], equator[4], 0, 0, 0, 0);
  for (let k = 1; k <= 3; k++) {
    const angle = k / 4 * Math.PI / 2, ca = Math.cos(angle), sa = Math.sin(angle);
    addRing(equator[0] + tipLength * sa, equator[1], equator[2], equator[3] * ca, equator[4] * ca,
      0, 0, -equator[3] / tipLength * sa / ca, -equator[4] / tipLength * sa / ca);
  }
  const ringSize = radial + 1, rings = positions.length / 3 / ringSize;
  for (let ring = 0; ring < rings - 1; ring++) for (let j = 0; j < radial; j++) {
    const a = ring * ringSize + j, b = a + ringSize;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const tip = positions.length / 3;
  positions.push(equator[1], -forearm - equator[0] - tipLength, equator[2]);
  normals.push(0, -1, 0); uvs.push(.5, 1);
  for (let j = 0; j < radial; j++) indices.push((rings - 1) * ringSize + j, (rings - 1) * ringSize + j + 1, tip);
  const root = positions.length / 3;
  positions.push(profile[0][1], -forearm - profile[0][0], profile[0][2]); normals.push(0, 1, 0); uvs.push(.5, 0);
  const capRing = positions.length / 3;
  for (let j = 0; j <= radial; j++) { positions.push(...positions.slice(j * 3, j * 3 + 3)); normals.push(0, 1, 0); uvs.push(j / radial, 0); }
  for (let j = 0; j < radial; j++) indices.push(capRing + j + 1, capRing + j, root);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

function mirror(geometry: BufferGeometry, side: 1 | -1): BufferGeometry {
  if (side === 1) return geometry;
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), ix = geometry.index!;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); n.setX(i, -n.getX(i)); }
  for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

/** Four individually rounded fingers, with small staggered lengths and a relaxed forward curl. */
export function createRelaxedFingers(forearm: number, side: 1 | -1): BufferGeometry[] {
  // Template is the left hand (+X side of the body): index and thumb face inward (-X).
  const fingers = [
    { x: -.0173, tipX: -.0173, rootX: -.0155, radius: .0060, end: .0560, curl: .0172 },
    { x: -.0068, tipX: 0, rootX: -.0060, radius: .0068, end: .06136, curl: .0150 },
    { x: .0070, tipX: .0070, rootX: .0062, radius: .0066, end: .0596, curl: .0205 },
    { x: .0203, tipX: .0203, rootX: .0170, radius: .0059, end: .0538, curl: .0210 },
  ];
  return fingers.map(f => mirror(relaxedDigit(forearm, [
    [.021, f.rootX, .0100, f.radius * .82, f.radius * .85],
    [.029, f.x * .94, .0128, f.radius, f.radius * .96],
    [.039, f.x, .0170, f.radius * 1.02, f.radius],
    [f.end - .0060, f.tipX, f.curl, f.radius * .92, f.radius * .94],
  ], .0060, 12), side));
}

/** Soft thumb pad with a buried web root; it turns inward/frontward, not away from the body. */
export function createRelaxedThumb(forearm: number, side: 1 | -1): BufferGeometry {
  return mirror(relaxedDigit(forearm, [
    [.002, -.0115, .0040, .0090, .0080],
    [.013, -.0190, .0090, .0090, .0082],
    [.026, -.0203, .0138, .0083, .0080],
    [.033, -.0200, .0170, .0072, .0072],
  ], .0068, 16), side);
}

export function createLinkRelaxedHand(forearm: number, side: 1 | -1): BufferGeometry {
  // Closed components overlap beneath the palm surface. This is not a welded solid union.
  const geometry = merge([createRelaxedPalm(forearm), ...createRelaxedFingers(forearm, side), createRelaxedThumb(forearm, side)]);
  geometry.name = 'link-relaxed-hand'; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
