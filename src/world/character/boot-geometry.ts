/** Original rounded Link boots, in the existing ankle joint's local metre coordinates. */
import { BufferGeometry, Float32BufferAttribute } from 'three';

const SIDES = 32;
type Section = { y: number; width: number; length: number; z: number; heel: number };
type Point = [number, number, number];

function outline(section: Section, angle: number): Point {
  const c = Math.cos(angle);
  return [section.width * Math.sin(angle) * (1 - section.heel * Math.max(0, -c)),
    section.y, section.z + section.length * c];
}

/** Shared vertices keep the shell closed; traversing the inner rings backward faces inward. */
function loft(rings: Point[][], closeProfile: boolean): BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i < rings.length; i++) for (let j = 0; j < SIDES; j++) {
    positions.push(...rings[i][j]); uvs.push(j / SIDES, i / (rings.length - 1));
  }
  const bands = closeProfile ? rings.length : rings.length - 1;
  for (let i = 0; i < bands; i++) for (let j = 0; j < SIDES; j++) {
    const nextRow = (i + 1) % rings.length, next = (j + 1) % SIDES;
    const a = i * SIDES + j, b = i * SIDES + next;
    const c = nextRow * SIDES + j, d = nextRow * SIDES + next;
    indices.push(a, b, c, b, d, c);
  }
  if (!closeProfile) for (const end of [0, rings.length - 1]) {
    const ring = rings[end], centre: Point = [0, 0, 0];
    for (const p of ring) for (let axis = 0; axis < 3; axis++) centre[axis] += p[axis] / SIDES;
    const index = positions.length / 3;
    positions.push(...centre); uvs.push(.5, end === 0 ? 0 : 1);
    for (let j = 0; j < SIDES; j++) {
      const a = end * SIDES + j, b = end * SIDES + (j + 1) % SIDES;
      indices.push(...(end === 0 ? [index, b, a] : [index, a, b]));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** A flat sole, continuous hollow shoe/shaft, and folded cuff with an open leg aperture. */
export function createLinkBoot(soleY: number, shaftTop: number): {
  upper: BufferGeometry; sole: BufferGeometry; cuff: BufferGeometry;
} {
  if (!Number.isFinite(soleY) || !Number.isFinite(shaftTop) || shaftTop - soleY < .12) {
    throw new RangeError('Link boot requires finite heights with at least .12 m above its sole');
  }
  const ring = (s: Section) => Array.from({ length: SIDES }, (_, j) => outline(s, j / SIDES * Math.PI * 2));

  // All outsole vertices stay inside the existing ±.054 x, -.056..+.116 z contact bounds.
  // Its entire underside is level; small upper/lower bevels soften the silhouette.
  const sole = loft([[0, .95], [.002, 1], [.014, 1], [.018, .95]].map(([height, size]) =>
    ring({ y: soleY + height, width: .053 * size, length: .086 * size, z: .03, heel: .10 })), false);
  sole.name = 'original-link-rounded-sole';

  // The toe recedes gradually into the instep rather than using a sphere outside the sole.
  // The shaft settles at radius .062, behind the existing .064-radius tongue and laces.
  const neckY = soleY + .075;
  const sections: Section[] = [
    { y: soleY + .016, width: .050, length: .080, z: .029, heel: .08 },
    { y: soleY + .028, width: .051, length: .081, z: .028, heel: .07 },
    { y: soleY + .046, width: .052, length: .076, z: .022, heel: .05 },
    { y: soleY + .063, width: .054, length: .069, z: .013, heel: .02 },
    { y: neckY, width: .057, length: .062, z: 0, heel: 0 },
    { y: neckY + (shaftTop - neckY) * .28, width: .060, length: .061, z: 0, heel: 0 },
    { y: neckY + (shaftTop - neckY) * .66, width: .0615, length: .0615, z: 0, heel: 0 },
    { y: shaftTop, width: .062, length: .062, z: 0, heel: 0 },
  ];
  const sampled: Section[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1];
    sampled.push(a, { y: (a.y + b.y) / 2, width: (a.width + b.width) / 2,
      length: (a.length + b.length) / 2, z: (a.z + b.z) / 2, heel: (a.heel + b.heel) / 2 });
  }
  sampled.push(sections[sections.length - 1]);
  const outside = sampled.map(ring);
  const inside = sampled.map((s, i) => ring({ ...s, y: i === 0 ? s.y + .005 : s.y,
    width: s.width - .0045, length: s.length - .0045 })).reverse();
  // The two fans close the shoe's bottom and inner footbed, never the shaft mouth.
  const upper = loft([...outside, ...inside], false);
  upper.name = 'original-link-hollow-boot-upper';

  // A rounded fold runs down outside the shaft and returns along its inner lining. Its
  // front is narrower around the tongue, while the sides/back retain a broad leather fold.
  const fold = [
    [.0635, -.052], [.069, -.054], [.074, -.050], [.075, -.041],
    [.0745, -.018], [.073, -.006], [.069, -.001], [.0635, 0],
    [.058, -.002], [.0555, -.007], [.0555, -.044], [.058, -.051],
  ];
  const cuff = loft(fold.map(([radius, height]) => Array.from({ length: SIDES }, (_, j): Point => {
    const angle = j / SIDES * Math.PI * 2, c = Math.cos(angle);
    const t = Math.max(0, Math.min(1, (c - .62) / .28)), front = t * t * (3 - 2 * t);
    // Compress the whole fold consistently, keeping its cross-section ordered at the front.
    const r = .0555 + (radius - .0555) * (1 - front * (1 - .008 / .0195));
    return [Math.sin(angle) * r, shaftTop + height - .004 * front, c * r];
  })), true);
  cuff.name = 'original-link-open-folded-cuff';
  return { upper, sole, cuff };
}
