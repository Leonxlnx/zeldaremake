/** Keep Link's cap attachment seated while its loose cloth follows the sway driver. */
import { BufferAttribute, DynamicDrawUsage, Mesh, Quaternion, Vector3 } from 'three';
import type { Rig } from './rig';

const SEAT_X = .01084846295894886;
const callbacks = new WeakMap<Rig, () => void>();

type Surface = {
  mesh: Mesh;
  position: BufferAttribute;
  normal: BufferAttribute;
  restPosition: Float32Array;
  restNormal: Float32Array;
  weight: Float64Array;
  gradientY: Float64Array;
};

/** One field for the original tail and its already fitted 26 crossing stitches. */
export function createLinkCapArticulation(rig: Rig): () => void {
  const existing = callbacks.get(rig);
  if (existing) return existing;
  const cap = rig.cap, driver = rig.capTail;
  const tail = driver?.getObjectByName('cap-tail');
  const stitches = driver?.getObjectByName('cap-tail-stitches');
  if (!cap || !driver || !(tail instanceof Mesh) || !(stitches instanceof Mesh)
    || driver.parent !== cap || driver.position.lengthSq() !== 0
    || !driver.scale.equals(new Vector3(1, 1, 1))
    || tail.geometry.getAttribute('position').count !== 927
    || tail.geometry.index?.count !== 5328
    || stitches.geometry.getAttribute('position').count !== 1456) {
    throw new Error('Link cap articulation needs the original fitted tail and seam');
  }
  const seat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), SEAT_X);
  const inverseSeat = seat.clone().invert(), delta = new Quaternion();
  const vertex = new Vector3(), pivot = new Vector3();
  const source = tail.geometry.getAttribute('position');
  const ringOf = (i: number): number => i < 481 ? Math.floor(i / 13)
    : i === 481 ? 36 : i === 482 ? 0 : Math.floor((i - 483) / 12);
  let top = Infinity, bottom = -Infinity;
  for (let i = 0; i < source.count; i++) {
    if (ringOf(i) <= 12) top = Math.min(top, source.getY(i));
    if (ringOf(i) === 36) bottom = Math.max(bottom, source.getY(i));
  }
  for (let i = 0; i < 12; i++) pivot.add(vertex.fromBufferAttribute(source, 12 * 13 + i));
  pivot.divideScalar(12).applyQuaternion(seat);
  const length = top - bottom, seatCos = Math.cos(SEAT_X), seatSin = Math.sin(SEAT_X);
  if (!(length > 0)) throw new Error('Link cap attachment must be above its tip');
  const surfaces: Surface[] = [];
  for (const mesh of [tail, stitches]) {
    if (mesh.parent !== driver || mesh.position.lengthSq() !== 0
      || mesh.quaternion.x !== 0 || mesh.quaternion.y !== 0 || mesh.quaternion.z !== 0
      || mesh.quaternion.w !== 1 || !mesh.scale.equals(new Vector3(1, 1, 1))) {
      throw new Error('Link cap surfaces must share their authored driver frame');
    }
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    if (!(position instanceof BufferAttribute) || !(normal instanceof BufferAttribute)
      || !(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array)) {
      throw new Error('Link cap articulation requires Float32 position and normal buffers');
    }
    const weight = new Float64Array(position.count), gradientY = new Float64Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const t = (top - position.getY(i)) / length;
      if (t >= 1) weight[i] = 1;
      else if (t > 0) {
        weight[i] = t * t * t * (10 + t * (-15 + 6 * t));
        gradientY[i] = -30 * t * t * (1 - t) * (1 - t) / length;
      }
      vertex.fromBufferAttribute(position, i).applyQuaternion(seat);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
      vertex.fromBufferAttribute(normal, i).applyQuaternion(seat);
      normal.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    surfaces.push({ mesh, position, normal, weight, gradientY,
      restPosition: new Float32Array(position.array), restNormal: new Float32Array(normal.array) });
    position.setUsage(DynamicDrawUsage); normal.setUsage(DynamicDrawUsage);
    // The group remains the animation input. Rendering uses the fixed seated cap frame.
    cap.add(mesh);
  }
  let lastX = NaN, lastY = NaN, lastZ = NaN, lastW = NaN;
  const sync = () => {
    const q = driver.quaternion;
    if (q.x === lastX && q.y === lastY && q.z === lastZ && q.w === lastW) return;
    delta.copy(q).normalize().multiply(inverseSeat).normalize();
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const sineHalf = Math.hypot(delta.x, delta.y, delta.z);
    const angle = 2 * Math.atan2(sineHalf, delta.w);
    const axisX = sineHalf > 1e-14 ? delta.x / sineHalf : 1;
    const axisY = sineHalf > 1e-14 ? delta.y / sineHalf : 0;
    const axisZ = sineHalf > 1e-14 ? delta.z / sineHalf : 0;
    const omegaX = angle * axisX, omegaY = angle * axisY, omegaZ = angle * axisZ;
    for (const s of surfaces) {
      for (let i = 0; i < s.position.count; i++) {
        // Fixed rows keep their exact newly seated Float32 values at every input.
        if (s.weight[i] === 0) continue;
        const offset = i * 3;
        if (angle < 1e-14) {
          s.position.setXYZ(i, s.restPosition[offset], s.restPosition[offset + 1], s.restPosition[offset + 2]);
          s.normal.setXYZ(i, s.restNormal[offset], s.restNormal[offset + 1], s.restNormal[offset + 2]);
          continue;
        }
        const x = s.restPosition[offset] - pivot.x;
        const y = s.restPosition[offset + 1] - pivot.y;
        const z = s.restPosition[offset + 2] - pivot.z;
        const c = Math.cos(angle * s.weight[i]), sine = Math.sin(angle * s.weight[i]), oneMinusC = 1 - c;
        const dot = axisX * x + axisY * y + axisZ * z;
        s.position.setXYZ(i,
          pivot.x + c * x + sine * (axisY * z - axisZ * y) + oneMinusC * dot * axisX,
          pivot.y + c * y + sine * (axisZ * x - axisX * z) + oneMinusC * dot * axisY,
          pivot.z + c * z + sine * (axisX * y - axisY * x) + oneMinusC * dot * axisZ);
        const uX = omegaY * z - omegaZ * y;
        const uY = omegaZ * x - omegaX * z;
        const uZ = omegaX * y - omegaY * x;
        const gY = seatCos * s.gradientY[i], gZ = seatSin * s.gradientY[i];
        const determinant = 1 + gY * uY + gZ * uZ;
        if (!(determinant > 0)) throw new Error('Link cap sway produced a nonpositive deformation Jacobian');
        const nx = s.restNormal[offset], ny = s.restNormal[offset + 1], nz = s.restNormal[offset + 2];
        const factor = (uX * nx + uY * ny + uZ * nz) / determinant;
        const correctedY = ny - gY * factor, correctedZ = nz - gZ * factor;
        const normalDot = axisX * nx + axisY * correctedY + axisZ * correctedZ;
        const rotatedX = c * nx + sine * (axisY * correctedZ - axisZ * correctedY) + oneMinusC * normalDot * axisX;
        const rotatedY = c * correctedY + sine * (axisZ * nx - axisX * correctedZ) + oneMinusC * normalDot * axisY;
        const rotatedZ = c * correctedZ + sine * (axisX * correctedY - axisY * nx) + oneMinusC * normalDot * axisZ;
        const inverseLength = 1 / Math.hypot(rotatedX, rotatedY, rotatedZ);
        s.normal.setXYZ(i, rotatedX * inverseLength, rotatedY * inverseLength, rotatedZ * inverseLength);
      }
      s.position.needsUpdate = true; s.normal.needsUpdate = true;
      s.mesh.geometry.computeBoundingBox(); s.mesh.geometry.computeBoundingSphere();
    }
    lastX = q.x; lastY = q.y; lastZ = q.z; lastW = q.w;
  };
  callbacks.set(rig, sync);
  sync();
  return sync;
}
