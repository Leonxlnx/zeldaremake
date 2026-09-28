// Small shared helpers for shot modules. Owner: director. Read-only for everyone else.
import { FPS, WIDTH, HEIGHT, held, isHeld, sec } from '../core/edit.js';
import { clamp, ease, mix, smoothstep, noise1, fbm1 } from '../core/prng.js';

export { FPS, held, isHeld, sec, clamp, ease, mix, smoothstep };

export const ASPECT = WIDTH / HEIGHT;

/** Full-frame-equivalent focal length (36 mm horizontal gate) -> vertical FOV in degrees. */
export function lensToFovY(mm, aspect = ASPECT) {
  const hfov = 2 * Math.atan(36 / (2 * mm));
  return (2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180) / Math.PI;
}

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  lerp: (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
};

/** Centripetal Catmull-Rom through points (arrays of [x,y,z]); t in 0..1 over the whole path. */
export function spline(points, t) {
  const n = points.length;
  if (n === 1) return points[0].slice();
  const seg = clamp(t, 0, 1) * (n - 1);
  const i = Math.min(Math.floor(seg), n - 2);
  const u = seg - i;
  const p0 = points[Math.max(i - 1, 0)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(i + 2, n - 1)];
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a = 2 * p1[k];
    const b = p2[k] - p0[k];
    const c = 2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k];
    const d = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k];
    out[k] = 0.5 * (a + b * u + c * u * u + d * u * u * u);
  }
  return out;
}

/**
 * Keyframe track: keys = [[frame, value, easeName?], ...] with numeric or array values.
 * The ease named on a key shapes the segment ENDING at that key.
 */
export function track(keys, f) {
  if (f <= keys[0][0]) return clone(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (f <= f1) {
      const u = f1 === f0 ? 1 : (f - f0) / (f1 - f0);
      const k = e && ease[e] ? ease[e](u) : u;
      return lerpAny(v0, v1, k);
    }
  }
  return clone(keys[keys.length - 1][1]);
}

function clone(v) {
  return Array.isArray(v) ? v.slice() : v;
}

function lerpAny(a, b, t) {
  if (Array.isArray(a)) return a.map((x, i) => mix(x, b[i], t));
  return mix(a, b, t);
}

/** Decaying camera shake in mm, deterministic. Returns [dx, dy, dz]. */
export function shake(f, startF, { amp = 1.5, decay = 10, freq = 0.9, seed = 7 } = {}) {
  if (f < startF) return [0, 0, 0];
  const k = Math.exp(-(f - startF) / decay);
  const x = (f - startF) * freq;
  return [noise1(x, seed) * amp * k, noise1(x, seed + 11) * amp * k, noise1(x, seed + 23) * amp * k * 0.5];
}

/** Gentle hand-held drift (camera on 1s). */
export function drift(f, { amp = 0.25, speed = 0.035, seed = 3 } = {}) {
  return [fbm1(f * speed, seed) * amp, fbm1(f * speed, seed + 5) * amp, fbm1(f * speed, seed + 9) * amp * 0.5];
}

export const DEFAULT_OUT = { width: WIDTH, height: HEIGHT };
