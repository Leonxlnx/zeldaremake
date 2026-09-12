/** Stored world-space free-foot trajectory. Contact endpoints have zero world velocity. */
import { Vector3 } from 'three';

export interface FootSwing {
  start: number;
  duration: number;
  from: Vector3;
  velocity: Vector3;
  to: Vector3;
  apex: number;
  liftFraction: number;
}

export function createFootSwing(start: number, duration: number, from: Vector3, velocity: Vector3,
  to: Vector3, lift: number, prior: FootSwing | null = null): FootSwing {
  // An intent change keeps the existing clearance arc; it must not launch another
  // full lift when the foot is already descending toward contact.
  const descending = prior && start >= prior.start + prior.duration * prior.liftFraction;
  const desiredApex = prior ? Math.max(prior.apex, from.y, to.y) : Math.max(from.y, to.y) + lift;
  // Reserve the existing 3 m/s vertical envelope for the actual rise/descent.
  // A short release reduces optional extra lift rather than requesting an
  // over-fast arc that the existing pose guards would have to clamp.
  const apex = prior ? desiredApex : Math.min(desiredApex, (from.y + to.y) * 0.5 + duration * 0.999);
  const rise = apex - from.y, fall = apex - to.y;
  return { start, duration, from: from.clone(), velocity: velocity.clone(), to: to.clone(), apex,
    liftFraction: descending ? 0 : rise + fall > 1e-9 ? rise / (rise + fall) : 0.5 };
}

// Constant-speed middle with short acceleration/deceleration ramps. Unlike a
// rest cubic, the long sprint step remains under the existing 8 m/s sole limit.
// A tenth-step ramp releases the foot quickly enough for the accelerating hips
// after restart, while still reaching stationary contact with continuous velocity.
function planar(from: number, velocity: number, to: number, duration: number, elapsed: number) {
  const ramp = duration * 0.10;
  const cruise = (to - from - velocity * ramp * 0.5) / (duration - ramp);
  if (elapsed <= ramp) return [from + velocity * elapsed + (cruise - velocity) * elapsed * elapsed / (2 * ramp),
    velocity + (cruise - velocity) * elapsed / ramp];
  if (elapsed <= duration - ramp) return [from + (velocity + cruise) * ramp * 0.5 + cruise * (elapsed - ramp), cruise];
  const remaining = duration - elapsed;
  return [to - cruise * remaining * remaining / (2 * ramp), cruise * remaining / ramp];
}
function height(from: number, velocity: number, to: number, duration: number, elapsed: number) {
  const u = elapsed / duration, u2 = u * u, u3 = u2 * u;
  return [(2 * u3 - 3 * u2 + 1) * from + (u3 - 2 * u2 + u) * duration * velocity + (-2 * u3 + 3 * u2) * to,
    ((6 * u2 - 6 * u) * from + (3 * u2 - 4 * u + 1) * duration * velocity + (-6 * u2 + 6 * u) * to) / duration];
}

export function sampleFootSwing(curve: FootSwing, now: number, position: Vector3, velocity: Vector3): void {
  const elapsed = now - curve.start, duration = curve.duration;
  if (elapsed <= 0) { position.copy(curve.from); velocity.copy(curve.velocity); return; }
  if (elapsed >= duration) { position.copy(curve.to); velocity.set(0, 0, 0); return; }
  const x = planar(curve.from.x, curve.velocity.x, curve.to.x, duration, elapsed);
  const z = planar(curve.from.z, curve.velocity.z, curve.to.z, duration, elapsed);
  const up = duration * curve.liftFraction;
  const y = curve.liftFraction === 0 ? height(curve.from.y, curve.velocity.y, curve.to.y, duration, elapsed)
    : elapsed < up ? height(curve.from.y, curve.velocity.y, curve.apex, up, elapsed)
    : height(curve.apex, 0, curve.to.y, duration - up, elapsed - up);
  position.set(x[0], y[0], z[0]); velocity.set(x[1], y[1], z[1]);
}
