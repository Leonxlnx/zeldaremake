/** Original sewn cap band, kept within the previous fitted rolled brim. */
import { BufferGeometry, Float32BufferAttribute } from 'three';

const SEGMENTS = 40;
// Radial offset from the old torus centre, then height along its local normal.
// The broad outer face is flat; small bevels soften the two sewn cloth edges.
const PROFILE: [number, number][] = [
  [-.0040, .0042], [-.0030, .0051], [.0002, .0051], [.0012, .0042],
  [.0012, -.0042], [.0002, -.0051], [-.0030, -.0051], [-.0040, -.0042],
];

export function createLinkCapBrim(rimRadius: number): { band: BufferGeometry; stitches: BufferGeometry } {
  if (!Number.isFinite(rimRadius) || rimRadius <= .02) throw new RangeError('Cap brim needs its positive fitted crown radius');
  const centreRadius = rimRadius + .002;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const lengths = PROFILE.map((p, i) => Math.hypot(PROFILE[(i + 1) % PROFILE.length][0] - p[0], PROFILE[(i + 1) % PROFILE.length][1] - p[1]));
  const perimeter = lengths.reduce((a, b) => a + b, 0);
  let distance = 0;
  for (let edge = 0; edge < PROFILE.length; edge++) {
    const a = PROFILE[edge], b = PROFILE[(edge + 1) % PROFILE.length], length = lengths[edge];
    const nr = -(b[1] - a[1]) / length, nz = (b[0] - a[0]) / length, start = positions.length / 3;
    for (let j = 0; j <= SEGMENTS; j++) {
      const angle = (j === SEGMENTS ? 0 : j) / SEGMENTS * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      for (const [point, v] of [[a, distance / perimeter], [b, (distance + length) / perimeter]] as const) {
        positions.push((centreRadius + point[0]) * c, (centreRadius + point[0]) * s, point[1]);
        normals.push(nr * c, nr * s, nz); uvs.push(j / SEGMENTS, v);
      }
      if (j < SEGMENTS) { const q = start + j * 2; indices.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    distance += length;
  }
  const band = new BufferGeometry();
  band.setAttribute('position', new Float32BufferAttribute(positions, 3));
  band.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  band.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); band.setIndex(indices);
  band.computeBoundingBox(); band.computeBoundingSphere(); band.name = 'link-flat-sewn-cap-band';

  const threadPositions: number[] = [], threadUVs: number[] = [], threadIndices: number[] = [];
  // Each short closed thread follows one existing flat circumference facet. Its rear
  // half is sewn into the outer band face, so there is no floating chord or separate roll.
  for (const row of [-1, 1]) for (let sector = 0; sector < SEGMENTS; sector++) for (const fraction of [.25, .75]) {
    const midAngle = (sector + .5) / SEGMENTS * Math.PI * 2, halfAngle = Math.PI / SEGMENTS;
    const radial = [Math.cos(midAngle), Math.sin(midAngle)], tangent = [-radial[1], radial[0]];
    const outer = (centreRadius + .0012) * Math.cos(halfAngle);
    const along = (2 * fraction - 1) * (centreRadius + .0012) * Math.sin(halfAngle);
    const h = row * .00325, halfLength = .00225, halfHeight = .00022;
    // Two radial layers, with the back 0.12 mm buried and the front 0.22 mm proud.
    const corners = [[-halfLength, -halfHeight], [halfLength, -halfHeight], [halfLength, halfHeight], [-halfLength, halfHeight]];
    const points: number[][] = [];
    for (const lift of [-.00012, .00022]) for (const [t, z] of corners) {
      points.push([radial[0] * (outer + lift) + tangent[0] * (along + t),
        radial[1] * (outer + lift) + tangent[1] * (along + t), h + z]);
    }
    // Local axes are tangent, normal-to-brim, radial; this winding faces outwards.
    const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    for (const face of faces) {
      const base = threadPositions.length / 3;
      for (const id of face) threadPositions.push(...points[id]);
      threadUVs.push(0, 0, 1, 0, 1, 1, 0, 1);
      threadIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const stitches = new BufferGeometry();
  stitches.setAttribute('position', new Float32BufferAttribute(threadPositions, 3));
  stitches.setAttribute('uv', new Float32BufferAttribute(threadUVs, 2)); stitches.setIndex(threadIndices);
  stitches.computeVertexNormals(); stitches.computeBoundingBox(); stitches.computeBoundingSphere();
  stitches.name = 'link-cap-band-two-edge-stitches';
  return { band, stitches };
}
