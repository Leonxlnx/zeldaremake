/**
 * Per-view placement math (pure functions, no three.js) — the character system uses it under
 * capture to stand Link, Navi and the kids where the reference frames have them:
 *
 *   1. `matchViewpoint` recognises the active layout viewpoint from the camera pose.
 *   2. `marchToGround` walks the pinhole ray through a reference screen point (Link's feet in the
 *      frame) until it hits the ground sampler — the world spot whose projection is that point.
 *   3. `projectPoint` verifies / audits the resulting screen boxes.
 *
 * Screen coordinates are normalised (0..1, y down). The pinhole matches three's PerspectiveCamera
 * (vertical fov, lookAt with world +Y up) and `gauntlet/tmp/proj.mjs`.
 */

export type V3 = [number, number, number];

export interface CamPose {
  position: V3;
  /** unit forward vector */
  forward: V3;
  /** vertical field of view (deg) */
  fov: number;
  aspect: number;
}

export interface ViewpointLike {
  id: string;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function cameraBasis(cam: CamPose): { right: V3; up: V3; forward: V3 } {
  const f = norm(cam.forward);
  const right = norm(cross(f, [0, 1, 0]));
  const up = cross(right, f);
  return { right, up, forward: f };
}

/** Project a world point; returns [sx, sy, depth] or null when behind the camera. */
export function projectPoint(cam: CamPose, p: V3): [number, number, number] | null {
  const { right, up, forward } = cameraBasis(cam);
  const d = sub(p, cam.position);
  const z = dot(d, forward);
  if (z <= 0.05) return null;
  const x = dot(d, right);
  const y = dot(d, up);
  const th = Math.tan((cam.fov * Math.PI) / 360);
  return [0.5 + (0.5 * (x / z)) / (th * cam.aspect), 0.5 - (0.5 * (y / z)) / th, z];
}

/** Unit world direction of the ray through normalised screen point (sx, sy). */
export function screenRay(cam: CamPose, sx: number, sy: number): V3 {
  const { right, up, forward } = cameraBasis(cam);
  const th = Math.tan((cam.fov * Math.PI) / 360);
  const x = (sx * 2 - 1) * th * cam.aspect;
  const y = (1 - sy * 2) * th;
  return norm([forward[0] + right[0] * x + up[0] * y, forward[1] + right[1] * x + up[1] * y, forward[2] + right[2] * x + up[2] * y]);
}

/** Point at camera-depth `depth` (along the view axis) on the ray through (sx, sy). */
export function pointAtDepth(cam: CamPose, sx: number, sy: number, depth: number): V3 {
  const ray = screenRay(cam, sx, sy);
  const f = norm(cam.forward);
  const k = depth / Math.max(1e-6, dot(ray, f));
  return [cam.position[0] + ray[0] * k, cam.position[1] + ray[1] * k, cam.position[2] + ray[2] * k];
}

export type GroundFn = (x: number, z: number) => number;

/**
 * March the ray through (sx, sy) until it crosses the ground, then bisect. Returns the ground
 * point (y = ground height) or null if nothing is hit within `maxDist`.
 */
export function marchToGround(cam: CamPose, sx: number, sy: number, ground: GroundFn, opts: { maxDist?: number; step?: number; minDist?: number } = {}): V3 | null {
  const ray = screenRay(cam, sx, sy);
  const maxDist = opts.maxDist ?? 40;
  const step = opts.step ?? 0.1;
  let s0 = opts.minDist ?? 0.5;
  const at = (s: number): V3 => [cam.position[0] + ray[0] * s, cam.position[1] + ray[1] * s, cam.position[2] + ray[2] * s];
  const above = (s: number) => {
    const p = at(s);
    return p[1] - ground(p[0], p[2]);
  };
  let a0 = above(s0);
  if (a0 <= 0) return null;
  for (let s = s0 + step; s <= maxDist; s += step) {
    const a = above(s);
    if (a <= 0) {
      let lo = s0;
      let hi = s;
      for (let i = 0; i < 24; i++) {
        const mid = 0.5 * (lo + hi);
        if (above(mid) > 0) lo = mid;
        else hi = mid;
      }
      const p = at(0.5 * (lo + hi));
      return [p[0], ground(p[0], p[2]), p[2]];
    }
    s0 = s;
    a0 = a;
  }
  return null;
}

/** Camera heading in the layout convention: yaw such that forward = (sin yaw, 0, cos yaw). */
export function headingOf(forward: V3): number {
  return Math.atan2(forward[0], forward[2]);
}

/**
 * Identify the layout viewpoint whose pose the camera holds (position within `tolPos` m and
 * direction within `tolDeg`). B_house and E_ground share a pose; the first match wins.
 */
export function matchViewpoint(position: V3, forward: V3, viewpoints: readonly ViewpointLike[], tolPos = 0.01, tolDeg = 0.75): string | null {
  const f = norm(forward);
  const cosTol = Math.cos((tolDeg * Math.PI) / 180);
  for (const v of viewpoints) {
    const dp = Math.hypot(position[0] - v.position[0], position[1] - v.position[1], position[2] - v.position[2]);
    if (dp > tolPos) continue;
    const vf = norm(sub([v.target[0], v.target[1], v.target[2]], [v.position[0], v.position[1], v.position[2]]));
    if (dot(f, vf) >= cosTol) return v.id;
  }
  return null;
}

export type Facing = 'away' | 'toward';

export interface KidPlacement {
  /** which kid slot (0 = kokiri-a by the stair foot, 1 = kokiri-b plaza west, 2 = kokiri-c at the house door) */
  slot: number;
  /** stand on the ray through this screen point (else at the layout spot) */
  screen?: [number, number];
  /** yaw (deg) offset from "facing Link"; undefined = face Link */
  yawDeg?: number;
}

export interface ViewPlacement {
  /** Link's sole contact point in the reference frame (x, y) */
  feet: [number, number];
  facing: Facing;
  /** extra yaw (deg) on top of the facing; + turns counter-clockwise seen from above (toward +X from +Z), − turns to his right */
  yawDeg: number;
  gait: 'idle' | 'walk' | 'run' | 'stairs';
  /** Navi's reference screen position (placed at Link's camera depth) */
  navi: [number, number];
  /** how much Link's head turns toward Navi (0..1) */
  look: number;
  kids: KidPlacement[];
}

/**
 * Reference screen boxes per hero frame (reference/ANALYSIS.md §2). Feet = bottom of Link's box,
 * x = box centre. Navi from the same tables (F estimated from the frame: just above the cap).
 */
export const VIEW_TABLE: Record<string, ViewPlacement> = {
  // 1 s: back view centre, slightly turned right, walking toward the stairs; kid at (0.86–0.91,
  // 0.42–0.70), feet (0.885, 0.70), ON the grassy bank right of the paving, 4.9 m from the camera
  // (head at y ≈ 0.425). The layout `kokiri-a` spot projects to x 0.98 here (cut by the frame
  // edge), so this view marches the reference feet instead: the ray meets the south bank's crest
  // (terrain S_BANK) at ≈ (5.0, 0.68, 5.3), 0.7 m above the plaza.
  A_stairs: { feet: [0.5, 0.88], facing: 'away', yawDeg: -12, gait: 'walk', navi: [0.455, 0.57], look: 0.4, kids: [{ slot: 0, screen: [0.885, 0.7] }] },
  // 14 s: facing camera, idle; Navi right of his head; kid cut by the left edge ~4–5 m away; kid by the door
  B_house: { feet: [0.5, 0.91], facing: 'toward', yawDeg: 0, gait: 'idle', navi: [0.565, 0.585], look: 0.25, kids: [{ slot: 1, screen: [0.035, 0.885], yawDeg: -40 }, { slot: 2 }] },
  E_ground: { feet: [0.5, 0.91], facing: 'toward', yawDeg: 0, gait: 'idle', navi: [0.565, 0.585], look: 0.25, kids: [{ slot: 1, screen: [0.035, 0.885], yawDeg: -40 }, { slot: 2 }] },
  // 46 s: walking toward the camera; kid between the stairs and Link, feet at (0.375, 0.62), ≈ 9 m
  // out. The layout `kokiri-a` spot now stands on the crest of the stair's south bank (terrain
  // S_BANK, 0.85 m up: feet (0.22, 0.49), head over the stair-foot rock), so this view marches
  // the reference feet instead: ≈ (5.2, 0, 0.9) on the plaza's east lobe, 2.3 m from the stair foot.
  C_lookback: { feet: [0.5, 0.91], facing: 'toward', yawDeg: 0, gait: 'walk', navi: [0.565, 0.565], look: 0.3, kids: [{ slot: 0, screen: [0.375, 0.62] }] },
  // 56 s: running away toward the log arch; Navi ahead-left
  D_log: { feet: [0.5, 0.9], facing: 'away', yawDeg: 0, gait: 'run', navi: [0.435, 0.55], look: 0.25, kids: [{ slot: 0 }] },
  // 8 s: back view, walking up the stair axis; kid + pods on the grass right of the stairs, the
  // kid at (0.585, 0.60) where the paving meets the bank. The layout `kokiri-a` spot now sits on
  // the crest of the south bank (0.85 m up: feet (0.63, 0.52), head in the bank hedge), so this
  // view marches the reference column down to the paving edge at the bank's toe instead:
  // (0.585, 0.68) → ≈ (6.2, 0, 3.2), 8.2 m out, the dark bank hedge behind and right of him.
  F_canopy: { feet: [0.5, 0.93], facing: 'away', yawDeg: 0, gait: 'walk', navi: [0.472, 0.545], look: 0.5, kids: [{ slot: 0, screen: [0.585, 0.68], yawDeg: 160 }] },
};
