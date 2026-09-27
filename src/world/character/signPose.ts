/**
 * The sign Link holds up in play mode (T): a picket sign — a pole gripped in both fists in front
 * of the chest, the board on top of it above his head — and the arm solve that puts his wrists on
 * the pole. Dependency-free (numbers and tuples only) so `signPose.test.mjs` can run it in node;
 * `sign.ts` builds the meshes, `glbLink.ts` poses the arms.
 *
 * Every position is in the chest bone's frame: +x his left, +y up the spine, +z forward (the GLB's
 * chest carries no rest rotation, so at rest this is the model frame shifted up to the chest).
 */
export type V3 = [number, number, number];

/** the sign's face, relative to the public/ base URL (public/textures/CREDITS.md `sign`) */
export const SIGN_TEXTURE_FILE = 'textures/sign/readers-note.jpg';

/** seconds to raise (and to lower) the sign; the arms and the sign move on one eased weight */
export const SIGN_RAISE_S = 0.35;

/** the chest bone's height over the feet in the rest pose (hips 0.52 m + chest 0.09 m) — the layout's reference */
export const CHEST_REST_Y = 0.61;

/** the pole: a round stave in front of the chest, bottom and top along the spine */
export const SIGN_POLE = { x: 0, z: 0.15, y0: -0.02, y1: 0.76, radius: 0.016 };

/**
 * The board: the screenshot's own aspect (1169 × 544), wide enough (1.4 m) that the note's body
 * text still reads from the follow camera 4.3 m behind him, its bottom edge 1.30 m over the feet
 * at rest — 0.10 m over the top of the cap (Link stands 1.20 m) — and set behind the pole, so the
 * camera sees the whole face and the pole only shows from in front.
 */
export const SIGN_BOARD = {
  width: 1.4,
  height: 1.4 * (544 / 1169),
  depth: 0.018,
  x: 0,
  bottom: 0.69,
  z: SIGN_POLE.z - SIGN_POLE.radius - 0.009 - 0.003,
};

/**
 * Where each wrist goes: on the pole's outer side (a fist closes round the stave 4.5 cm past the
 * wrist), the right hand above the left.
 */
export const SIGN_GRIP: { L: V3; R: V3 } = {
  L: [SIGN_POLE.x + 0.045, 0.1, SIGN_POLE.z],
  R: [SIGN_POLE.x - 0.045, 0.22, SIGN_POLE.z],
};

/** which way each elbow bends: out to its own side, down and a little back */
export const SIGN_ELBOW_POLE: { L: V3; R: V3 } = {
  L: [0.75, -0.55, -0.35],
  R: [-0.75, -0.55, -0.35],
};

/** at weight 0 the sign sits this far down the spine (it rises into place as the arms come up) */
export const SIGN_LOWERED_Y = -0.5;

/** the raise weight's ease: 0 → 1 as the linear raise clock goes 0 → 1 */
export function signWeight(raise: number): number {
  const x = Math.min(1, Math.max(0, raise));
  return x * x * (3 - 2 * x);
}

/** the raise clock after a step of `dt` s toward up (1) or down (0) */
export function stepRaise(raise: number, up: boolean, dt: number): number {
  const d = Math.max(0, dt) / SIGN_RAISE_S;
  return up ? Math.min(1, raise + d) : Math.max(0, raise - d);
}

/**
 * Two-bone reach: a shoulder at `s` with an upper arm `a` and a forearm `b` long reaching for a
 * wrist target `t`, the elbow bending toward `pole`. Returns the elbow and the wrist position the
 * chain can actually reach — `t` itself inside the arm's span, otherwise the nearest point on the
 * line from the shoulder (fully straight when too far, fully folded when too close).
 */
export function reachTwoBone(s: V3, t: V3, a: number, b: number, pole: V3): { elbow: V3; wrist: V3 } {
  const dx = t[0] - s[0];
  const dy = t[1] - s[1];
  const dz = t[2] - s[2];
  const d = Math.hypot(dx, dy, dz);
  const nx = d > 1e-9 ? dx / d : 0;
  const ny = d > 1e-9 ? dy / d : -1;
  const nz = d > 1e-9 ? dz / d : 0;
  const lo = Math.abs(a - b) + 1e-4;
  const hi = a + b - 1e-4;
  const r = Math.min(hi, Math.max(lo, d));
  // the elbow's distance along the shoulder → wrist line, and its offset off it
  const along = (a * a - b * b + r * r) / (2 * r);
  const off = Math.sqrt(Math.max(0, a * a - along * along));
  const pd = pole[0] * nx + pole[1] * ny + pole[2] * nz;
  let px = pole[0] - pd * nx;
  let py = pole[1] - pd * ny;
  let pz = pole[2] - pd * nz;
  let pl = Math.hypot(px, py, pz);
  if (pl < 1e-6) {
    // the pole lies along the reach: bend toward whichever axis is least parallel to it
    const ax = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const k = ax[0] * nx + ax[1] * ny + ax[2] * nz;
    px = ax[0] - k * nx;
    py = ax[1] - k * ny;
    pz = ax[2] - k * nz;
    pl = Math.hypot(px, py, pz);
  }
  px /= pl;
  py /= pl;
  pz /= pl;
  return {
    elbow: [s[0] + nx * along + px * off, s[1] + ny * along + py * off, s[2] + nz * along + pz * off],
    wrist: [s[0] + nx * r, s[1] + ny * r, s[2] + nz * r],
  };
}
