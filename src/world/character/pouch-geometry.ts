/** Original Link belt satchel, contained in the old pouch's occupied envelope. */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { merge, sweep } from './geometry';

/** This entire cuboid is inside the previous overlapping body/flap boxes. */
export const LINK_POUCH_BOUNDS = { min: [-.035, -.060, -.020], max: [.035, .019, .020] } as const;
export interface LinkPouchGeometry {
  leather: BufferGeometry;
  closure: BufferGeometry;
  stitches: BufferGeometry;
  stud: BufferGeometry;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bodyRadius = (t: number) => {
  const bottom = Math.sin(Math.PI * .5 * Math.min(1, t / .20)) ** .65;
  return { x: .0338 * bottom * (1 - .09 * smooth(.70, 1, t)),
    z: .0158 * bottom * (1 - .12 * smooth(.70, 1, t)) };
};

function body(): BufferGeometry {
  const rows = 32, columns = 40, stride = columns + 1;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 1; row <= rows; row++) {
    const t = row / rows, r = bodyRadius(t), y = -.058 + .057 * t;
    for (let j = 0; j <= columns; j++) {
      const angle = (j % columns) / columns * Math.PI * 2 - Math.PI / 2;
      const c = Math.abs(Math.cos(angle)) < 1e-12 ? 0 : Math.cos(angle);
      const s = Math.abs(Math.sin(angle)) < 1e-12 ? 0 : Math.sin(angle);
      // A rounded rectangular section, with a soft lower gusset and narrower mouth.
      positions.push(r.x * Math.sign(c) * Math.abs(c) ** .62, y,
        -.001 + r.z * Math.sign(s) * Math.abs(s) ** .62);
      // Eight complete 24 mm grain tiles close at the hidden back seam.
      uvs.push(j / columns * .192, y + .058);
    }
  }
  for (let row = 0; row < rows - 1; row++) for (let j = 0; j < columns; j++) {
    const a = row * stride + j, b = a + 1, c = a + stride, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const bottom = positions.length / 3; positions.push(0, -.058, -.001); uvs.push(.096, 0);
  const topRing = positions.length / 3;
  for (let j = 0; j <= columns; j++) {
    const i = ((rows - 1) * stride + j) * 3;
    positions.push(positions[i], positions[i + 1], positions[i + 2]);
    uvs.push(positions[i], positions[i + 2]);
  }
  const top = positions.length / 3; positions.push(0, -.001, -.001); uvs.push(0, -.001);
  for (let j = 0; j < columns; j++) {
    indices.push(bottom, j, j + 1);
    const a = topRing + j; indices.push(top, a + 1, a);
  }
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); result.setIndex(indices);
  result.computeVertexNormals();
  // Duplicate wrap positions are deliberate UV seams, with identical smooth normals.
  const normals = result.attributes.normal, normal = new Vector3(), other = new Vector3();
  for (let row = 0; row < rows; row++) {
    const a = row * stride, b = a + columns;
    normal.fromBufferAttribute(normals, a).add(other.fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, normal.x, normal.y, normal.z); normals.setXYZ(b, normal.x, normal.y, normal.z);
  }
  result.name = 'link-rounded-pouch-body'; return result;
}

type RibbonPoint = { centre: Vector3; normal: Vector3; uv: [number, number] };

/** Closed leather thickness around a fitted ribbon surface, without new open rims. */
function ribbon(sample: (t: number, s: number) => RibbonPoint, rows: number, columns: number, thickness: number): BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const stride = columns + 1, layer = (rows + 1) * stride;
  for (const sign of [1, -1]) for (let row = 0; row <= rows; row++) for (let j = 0; j <= columns; j++) {
    const point = sample(row / rows, j / columns * 2 - 1);
    positions.push(...point.centre.addScaledVector(point.normal, sign * thickness / 2).toArray());
    uvs.push(...point.uv);
  }
  for (let row = 0; row < rows; row++) for (let j = 0; j < columns; j++) {
    const a = row * stride + j, b = a + 1, c = a + stride, d = c + 1;
    indices.push(a, c, b, b, c, d, a + layer, b + layer, c + layer, b + layer, d + layer, c + layer);
  }
  const perimeter: number[] = [];
  for (let row = 0; row < rows; row++) perimeter.push(row * stride);
  for (let j = 0; j < columns; j++) perimeter.push(rows * stride + j);
  for (let row = rows; row > 0; row--) perimeter.push(row * stride + columns);
  for (let j = columns; j > 0; j--) perimeter.push(j);
  let edgeDistance = 0;
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
    const pa = new Vector3().fromArray(positions, a * 3), pb = new Vector3().fromArray(positions, b * 3);
    const length = pa.distanceTo(pb), first = positions.length / 3;
    // Independent cut-edge charts preserve metre scale through the leather thickness.
    // Duplicate seam vertices change UVs/normals only, not a single triangle position.
    for (const vertex of [a, b, a + layer, b + layer])
      positions.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
    uvs.push(edgeDistance, 0, edgeDistance + length, 0,
      edgeDistance, thickness, edgeDistance + length, thickness);
    indices.push(first + 1, first, first + 2, first + 1, first + 2, first + 3);
    edgeDistance += length;
  }
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); result.setIndex(indices);
  result.computeVertexNormals(); return result;
}

export function createLinkPouch(): LinkPouchGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(0, -.009, -.0145), new Vector3(0, .008, -.012),
    new Vector3(0, .0155, .001), new Vector3(0, .010, .0140),
    new Vector3(0, -.001, .0175), new Vector3(0, -.014, .0178),
    new Vector3(0, -.025, .0170),
  ], false, 'centripetal', .5);
  const length = curve.getLength(), halfThickness = .00065;
  const flapPoint = (t: number, s: number): RibbonPoint => {
    const centre = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const normal = new Vector3(0, tangent.z, -tangent.y).normalize();
    const width = .027 + .005 * Math.sin(Math.PI * t) - .001 * t;
    centre.x = s * width;
    // The rear seam follows the rounded bag instead of spanning its corners in air.
    centre.z += .003 * s * s * (1 - smooth(0, .30, t));
    centre.y -= .0035 * (1 - s * s) * t ** 8;
    centre.addScaledVector(normal, .00045 * (1 - s * s) * smooth(.45, .70, t));
    return { centre, normal, uv: [centre.x, t * length] };
  };
  const flap = ribbon(flapPoint, 36, 20, halfThickness * 2);
  flap.name = 'link-fitted-pouch-flap';
  const closure = ribbon((t, s) => {
    const y = -.021 - .025 * t - .0018 * (1 - s * s) * t ** 6;
    const front = -.001 + bodyRadius((y + .058) / .057).z;
    return { centre: new Vector3(s * .0042, y, front + .0003), normal: new Vector3(0, 0, 1), uv: [s * .0042, y] };
  }, 16, 8, .0009);
  closure.name = 'link-pouch-closure-tab';
  const thread: BufferGeometry[] = [];
  const stitch = (points: Vector3[]) => thread.push(sweep(points, [.00012, .00028, .00012], {
    segments: 4, radial: 6, closeStart: true, closeTip: true,
  }));
  const threadPoint = (t: number, s: number) => {
    const p = flapPoint(t, s); return p.centre.addScaledVector(p.normal, halfThickness + .00004);
  };
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const t = .48 + i * .066;
    stitch([threadPoint(t, side * .91), threadPoint(t + .017, side * .91), threadPoint(t + .034, side * .91)]);
  }
  for (let i = 0; i < 9; i++) {
    const s = -.86 + i * .202;
    stitch([threadPoint(.969, s), threadPoint(.969, s + .058), threadPoint(.969, s + .116)]);
  }
  const stitches = merge(thread); stitches.name = 'link-pouch-flap-stitches';
  const stud = new SphereGeometry(.0024, 16, 8);
  stud.scale(1, 1, .18); stud.translate(0, -.0225, .0187); stud.name = 'link-pouch-closure-stud';
  const leather = merge([body(), flap]); leather.name = 'link-crafted-pouch-leather';
  const result = { leather, closure, stitches, stud };
  for (const geometry of Object.values(result)) {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const bounds = geometry.boundingBox!;
    if (bounds.min.toArray().some((v, i) => v < LINK_POUCH_BOUNDS.min[i] - 1e-8)
      || bounds.max.toArray().some((v, i) => v > LINK_POUCH_BOUNDS.max[i] + 1e-8))
      throw new Error('Link pouch detail exceeds the existing occupied envelope');
  }
  return result;
}
