/** One fixed convex ocular surface in physical eye coordinates, independent of blinking. */
import { Matrix4, Vector3, type BufferGeometry } from 'three';
import { LINK_EYE_OPENING } from './eye-aperture';

type Point = [number, number];
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function clipToOpening(subject: Point[], opening: Point[]): Point[] {
  let polygon = subject;
  for (let edge = 0; edge < opening.length && polygon.length; edge++) {
    const a = opening[edge], b = opening[(edge + 1) % opening.length], next: Point[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const dp = cross(a, b, p), dq = cross(a, b, q), insideP = dp >= -1e-15, insideQ = dq >= -1e-15;
      if (insideP) next.push(p);
      if (insideP !== insideQ) {
        const t = dp / (dp - dq);
        next.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    polygon = next;
  }
  return polygon;
}

export interface LinkEyeCap {
  height(x: number, physicalY: number): number;
  /** Local normal before the parent applies blink Y scaling. No per-vertex allocation. */
  normal(x: number, physicalY: number, blinkScale: number, out: Vector3): Vector3;
}

export function createLinkEyeCap(skull: BufferGeometry, headToEye: Matrix4, k: number,
  skin: (x: number, y: number) => number): LinkEyeCap {
  const axial = .040 * k, width = Math.sqrt(.080 * .040) * k, height = Math.sqrt(.035 * .040) * k;
  const widthSquared = width * width, heightSquared = height * height;
  const epsilon = .00001 * k;
  const tiltX = (skin(epsilon, 0) - skin(-epsilon, 0)) / (2 * epsilon);
  const tiltY = (skin(0, epsilon) - skin(0, -epsilon)) / (2 * epsilon);
  const root = (x: number, y: number) => Math.sqrt(1 - x * x / widthSquared - y * y / heightSquared);
  const relative = (x: number, y: number) => tiltX * x + tiltY * y + axial * (root(x, y) - 1);
  const opening = LINK_EYE_OPENING.map(([x, y]): Point => [x * k, y * k]);
  const p = skull.attributes.position, index = skull.index;
  if (!index) throw new Error('Link eye cap requires its indexed skull');
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let offset = -Infinity;
  // Skin is planar on each triangle and this cap is concave. Skin - cap is convex,
  // so its maximum on each clipped polygon is attained at a polygon vertex.
  // This construction-only fit covers the full opening and all nested blink domains.
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i)).applyMatrix4(headToEye);
    b.fromBufferAttribute(p, index.getX(i + 1)).applyMatrix4(headToEye);
    c.fromBufferAttribute(p, index.getX(i + 2)).applyMatrix4(headToEye);
    const ap: Point = [a.x, a.y], bp: Point = [b.x, b.y], cp: Point = [c.x, c.y];
    const determinant = cross(ap, bp, cp);
    if (determinant <= 1e-14) continue;
    if (Math.max(a.x, b.x, c.x) < -.025 * k || Math.min(a.x, b.x, c.x) > .025 * k
      || Math.max(a.y, b.y, c.y) < -.0165 * k || Math.min(a.y, b.y, c.y) > .0165 * k) continue;
    for (const point of clipToOpening([ap, bp, cp], opening)) {
      const u = cross(point, bp, cp) / determinant, v = cross(point, cp, ap) / determinant;
      const skinHeight = u * a.z + v * b.z + (1 - u - v) * c.z;
      offset = Math.max(offset, skinHeight + .0006 * k - relative(point[0], point[1]));
    }
  }
  if (!Number.isFinite(offset)) throw new Error('Link eye cap has no finite skull support');
  return {
    height: (x, y) => offset + relative(x, y),
    normal: (x, y, blinkScale, out) => {
      const denominator = root(x, y);
      const dx = tiltX - axial * x / (widthSquared * denominator);
      const dy = tiltY - axial * y / (heightSquared * denominator);
      return out.set(-dx, -dy * blinkScale, 1).normalize();
    },
  };
}
