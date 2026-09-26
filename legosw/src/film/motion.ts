import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { noise1 } from '../core/rng';

/** Time-keyed paths, banking flight orientation, camera helpers — all pure functions of time. */

export type Key = [number, number, number, number]; // t, x, y, z

export const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smoother = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => smoother(0, 1, t);

/** Catmull-Rom through time-stamped keys (non-uniform, centripetal-ish via time spacing). */
export function keyed(keys: Key[], t: number, out = new Vector3()): Vector3 {
  const n = keys.length;
  if (t <= keys[0][0]) {
    // extrapolate linearly with the first segment's velocity
    const a = keys[0], b = keys[1];
    const f = (t - a[0]) / (b[0] - a[0]);
    return out.set(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f);
  }
  if (t >= keys[n - 1][0]) {
    const a = keys[n - 2], b = keys[n - 1];
    const f = (t - a[0]) / (b[0] - a[0]);
    return out.set(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f);
  }
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const dt = k2[0] - k1[0];
  const u = (t - k1[0]) / dt;
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const r = [0, 0, 0];
  for (let c = 1; c <= 3; c++) {
    const m1 = k1 === k0 ? k2[c] - k1[c] : ((k2[c] - k0[c]) / (k2[0] - k0[0])) * dt;
    const m2 = k3 === k2 ? k2[c] - k1[c] : ((k3[c] - k1[c]) / (k3[0] - k1[0])) * dt;
    r[c - 1] = h00 * k1[c] + h10 * m1 + h01 * k2[c] + h11 * m2;
  }
  return out.set(r[0], r[1], r[2]);
}

export interface FlightState {
  pos: Vector3;
  quat: Quaternion;
  vel: Vector3;
  fwd: Vector3;
  up: Vector3;
}

/**
 * Orientation of a craft following `path(t)`: +Z along the velocity, banked into turns
 * (roll from lateral acceleration), plus optional extra roll.
 */
export function flight(path: (t: number) => Vector3, t: number, o: { bank?: number; extraRoll?: number; worldUp?: Vector3; dt?: number; accWindow?: number; headWindow?: number } = {}): FlightState {
  const dt = o.dt ?? 1 / 30;
  const p0 = path(t - dt), p1 = path(t), p2 = path(t + dt);
  const vel = p2.clone().sub(p0).divideScalar(2 * dt);
  // acceleration over a wide stencil: key splines are only C1, so a 1/30 s second difference steps at
  // every key and the bank snaps; ±0.22 s low-passes it into a smooth roll
  const h = o.accWindow ?? 0.22;
  const acc = path(t + h).add(path(t - h)).sub(p1.clone().multiplyScalar(2)).divideScalar(h * h);
  const fwd = vel.clone().normalize();
  if (o.headWindow) {
    // heading low-passed over ±headWindow: on a C1 key spline the raw heading's turn rate steps at every key
    const f = fwd.clone().multiplyScalar(3);
    for (const [k, wgt] of [[-1, 1], [-0.5, 2], [0.5, 2], [1, 1]] as const) {
      const tt = t + k * o.headWindow;
      f.addScaledVector(path(tt + dt).sub(path(tt - dt)).normalize(), wgt);
    }
    fwd.copy(f.normalize());
  }
  const worldUp = o.worldUp ?? new Vector3(0, 1, 0);
  const lat = acc.clone().sub(fwd.clone().multiplyScalar(acc.dot(fwd)));
  // right-hand side of the craft (−X is starboard)
  const left = worldUp.clone().cross(fwd).normalize();
  const turn = lat.dot(left); // + = turning to port
  const bank = clamp(Math.atan2(turn, 400) * (o.bank ?? 1), -1.35, 1.35) + (o.extraRoll ?? 0);
  const up0 = fwd.clone().cross(left).normalize();
  const up = up0.clone().applyAxisAngle(fwd, -bank);
  const quat = basisQuat(fwd, up);
  return { pos: p1, quat, vel, fwd, up };
}

export function basisQuat(fwd: Vector3, up: Vector3): Quaternion {
  const z = fwd.clone().normalize();
  const x = up.clone().cross(z).normalize();
  const y = z.clone().cross(x).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

export function place(o: Object3D, s: { pos: Vector3; quat: Quaternion }): void {
  o.position.copy(s.pos);
  o.quaternion.copy(s.quat);
}

/** Smooth hand-held / vibration offset. */
export function shake(t: number, amp: number, freq = 1, seed = 0): Vector3 {
  return new Vector3(noise1(t * freq * 3.1, seed + 1) + 0.5 * noise1(t * freq * 7.3, seed + 4), noise1(t * freq * 2.7, seed + 2) + 0.5 * noise1(t * freq * 6.1, seed + 5), noise1(t * freq * 2.3, seed + 3) * 0.5).multiplyScalar(amp);
}

/** Transform a local offset by a pose. */
export function local(s: { pos: Vector3; quat: Quaternion }, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyQuaternion(s.quat).add(s.pos);
}
