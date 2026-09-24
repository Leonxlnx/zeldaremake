/**
 * Where the play camera may stand on its line of sight to Link (follow.ts):
 *  - the ground Link walks (terrain, stair treads, decks — the character's walk height): the camera
 *    keeps CLEARANCE above it and is lifted where a ridge or a flight would cut the line;
 *  - SOLID shells (the structures' voxelised trunks, roofs, eaves, porches, the log arch, the huts —
 *    structures/cameraSolids.ts), the exact walls published beside them (shared.cameraCylinders)
 *    and the big boles (the giants' and columns' seats as built): the camera stays in front of the
 *    first one on the line, so Link is never behind a wall or a bole; under a low ceiling (the log
 *    arch's passage, a hut's cap) it first tries standing lower;
 *  - SLIM parts (posts, pods, boughs, the white-barks' boles, the village props): the camera only
 *    refuses to stand inside one and moves in along the line until clear — a post may pass between.
 */
import { Vector3 } from 'three';
import type { SharedGeometry } from '../world/system';

/** the camera's own radius against solids (m) — the near plane is 0.08 m */
export const CAMERA_RADIUS = 0.3;
/** least height of the camera over the walked ground (m) */
export const CLEARANCE = 0.35;
/** the camera never comes closer than this to the aim point (m) */
export const MIN_DISTANCE = 0.6;
/**
 * how near the line of sight may pass an exact wall (m); the camera itself stops CAMERA_RADIUS off
 * it. A camera trailing Link round the keeper's gallery looks into the curve: with the camera radius
 * on the whole line, that line clipped the wall and pulled the camera in.
 */
export const WALL_LINE_MARGIN = 0.1;
/**
 * while Link walks near an exact wall, the follow camera orbits off it once its line turns in past
 * the tangent at Link by more than this share of the turn that would reach the line margin
 * (wallSwing): walking round the keeper's hut (1.4–1.7 m from its axis) the trailing camera looked
 * up to 45° into the curve, which put its line through the wall and snapped it in 3.8 m
 */
export const WALL_SWING_SHARE = 0.3;
/** the swing is whole while Link is within this of the wall (m) and gone half a metre further out */
const WALL_SWING_NEAR = 0.8;
/** a low ceiling may drop the camera by up to LOWER_STEPS × LOWER_STEP m before it is pulled in */
const LOWER_STEPS = 4;
const LOWER_STEP = 0.15;

export interface Cylinder {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
}

export interface Resolved {
  /** fraction (0..1) of the line aim → camera the camera may keep */
  t: number;
  /** how far the candidate was lowered under a ceiling (m) */
  lowered: number;
  hit: 'solid' | 'trunk' | null;
}

export interface CameraCollider {
  /** raise `desired.y` so the line from `pivot` clears the walked ground; returns the lift (m) */
  lift(pivot: Vector3, desired: Vector3): number;
  /** the solid sweep: how much of the line pivot → desired is free (tries lower candidates under a ceiling) */
  resolve(pivot: Vector3, desired: Vector3): Resolved;
  /** move `cam` toward `pivot` until it is outside every slim part; returns the distance moved (m) */
  slimPush(pivot: Vector3, cam: Vector3): number;
  /**
   * how far to turn the yaw (rad), away from the wall, so the line from `pivot` to a camera behind
   * it along −(sin yaw, cos yaw) (follow.ts) turns in past the tangent to each exact wall near Link
   * by no more than WALL_SWING_SHARE of the turn that would reach the line margin; 0 when it does
   */
  wallSwing(pivot: Vector3, yaw: number): number;
  /** the walked ground under (x, z) */
  ground(x: number, z: number): number;
  info(): Record<string, unknown>;
}

const _d = new Vector3();
const _c = new Vector3();
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function createCameraCollider(ground: (x: number, z: number) => number, shared: SharedGeometry): CameraCollider {
  const solid = shared.cameraSolids?.solid ?? null;
  const slim = shared.cameraSolids?.slim ?? null;
  const trunks: Cylinder[] = (shared.trunkSeats ?? []).map((s) => ({
    x: s.x,
    z: s.z,
    r: Math.max(s.radiusAt(1.0), s.radiusAt(2.5)) + CAMERA_RADIUS,
    y0: s.y - 1,
    y1: s.y + Math.max(4, s.bareHeight),
  }));
  const walls: Cylinder[] = (shared.cameraCylinders ?? []).map((c) => ({ ...c }));
  const slimCylinders: Cylinder[] = [
    ...(shared.slimTrunks ?? []).map((t) => ({ ...t, r: t.r + CAMERA_RADIUS })),
    ...(shared.propBlockers ?? []).map((b) => ({ x: b.x, z: b.z, r: b.r + CAMERA_RADIUS, y0: -Infinity, y1: b.top + CAMERA_RADIUS })),
  ];

  const insideSlim = (x: number, y: number, z: number): boolean => {
    if (slim?.hasPoint(x, y, z)) return true;
    for (const c of slimCylinders) {
      if (y < c.y0 || y > c.y1) continue;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    }
    return false;
  };

  /** where the line a + u·_d (u ≥ 0) enters and leaves the vertical cylinder (c.x, c.z, r), entering inside its height span; null if it does not or starts inside */
  const span = (a: Vector3, ax: number, c: Cylinder, r: number): [number, number] | null => {
    const ox = a.x - c.x;
    const oz = a.z - c.z;
    const c0 = ox * ox + oz * oz - r * r;
    if (c0 < 0) return null;
    const bq = 2 * (ox * _d.x + oz * _d.z);
    const disc = bq * bq - 4 * ax * c0;
    if (disc < 0) return null;
    const u = (-bq - Math.sqrt(disc)) / (2 * ax);
    if (u < 0) return null;
    const y = a.y + _d.y * u;
    return y < c.y0 || y > c.y1 ? null : [u, (-bq + Math.sqrt(disc)) / (2 * ax)];
  };

  /** first blocked fraction of the line a → b against the solid grid, the exact walls and the boles (1 when clear) */
  const sweep = (a: Vector3, b: Vector3): { t: number; hit: Resolved['hit'] } => {
    _d.subVectors(b, a);
    const len = _d.length();
    if (len < 1e-6) return { t: 1, hit: null };
    let t = 1;
    let hit: Resolved['hit'] = null;
    if (solid) {
      const step = solid.cell * 0.4;
      // Link may stand inside the grown shell (against a wall): an occupied run at the start is
      // skipped if it ends within half a metre, otherwise the camera has nowhere behind him
      let s = 0;
      let run = 0;
      while (s <= len && solid.hasPoint(a.x + (_d.x * s) / len, a.y + (_d.y * s) / len, a.z + (_d.z * s) / len)) {
        run += step;
        s += step;
        if (run > 0.5) return { t: 0, hit: 'solid' };
      }
      for (; s <= len; s += step) {
        if (solid.hasPoint(a.x + (_d.x * s) / len, a.y + (_d.y * s) / len, a.z + (_d.z * s) / len)) {
          t = Math.max(0, s - step) / len;
          hit = 'solid';
          break;
        }
      }
    }
    const ax = _d.x * _d.x + _d.z * _d.z;
    if (ax > 1e-9) {
      for (const c of trunks) {
        const s = span(a, ax, c, c.r);
        if (!s || s[0] >= t) continue;
        t = s[0];
        hit = 'trunk';
      }
      // Link against a wall stands inside its margins: they then begin just behind him, so a line
      // into the wall is refused (the camera at its minimum distance), one along it or away is free
      for (const w of walls) {
        const d = Math.hypot(a.x - w.x, a.z - w.z);
        if (d <= w.r) continue;
        const s = span(a, ax, w, Math.min(w.r + WALL_LINE_MARGIN, d - 0.02));
        if (!s || s[0] >= t) continue;
        t = s[0];
        hit = 'solid';
      }
      // the line may graze a wall; the camera does not stop within CAMERA_RADIUS of one
      for (const w of walls) {
        const d = Math.hypot(a.x - w.x, a.z - w.z);
        if (d <= w.r) continue;
        const s = span(a, ax, w, Math.min(w.r + CAMERA_RADIUS, d - 0.02));
        if (!s || s[0] >= t || t >= s[1]) continue;
        t = s[0];
        hit = 'solid';
      }
    }
    return { t, hit };
  };

  return {
    ground,
    lift(pivot, desired) {
      const y0 = desired.y;
      const floor = Math.max(ground(desired.x, desired.z), ground(desired.x + 0.25, desired.z), ground(desired.x - 0.25, desired.z), ground(desired.x, desired.z + 0.25), ground(desired.x, desired.z - 0.25)) + CLEARANCE;
      let y = Math.max(desired.y, floor);
      // the line must clear the ground between (a ridge, the treads of a flight behind Link)
      for (let k = 1; k <= 8; k++) {
        const u = 0.25 + (0.75 * k) / 8;
        const x = pivot.x + (desired.x - pivot.x) * u;
        const z = pivot.z + (desired.z - pivot.z) * u;
        const need = ground(x, z) + 0.2;
        const lineY = pivot.y + (y - pivot.y) * u;
        if (lineY < need) y = pivot.y + (need - pivot.y) / u;
      }
      desired.y = y;
      return y - y0;
    },
    resolve(pivot, desired) {
      let best: Resolved = { ...sweep(pivot, desired), lowered: 0 };
      if (best.t >= 0.999) return best;
      const len = pivot.distanceTo(desired);
      const floor = ground(desired.x, desired.z) + CLEARANCE;
      for (let k = 1; k <= LOWER_STEPS; k++) {
        const y = desired.y - k * LOWER_STEP;
        if (y < floor) break;
        _c.set(desired.x, y, desired.z);
        const r = sweep(pivot, _c);
        // a lower stance must buy real distance (≥ 0.4 m) to be worth the changed framing
        if (r.t * pivot.distanceTo(_c) > best.t * len + 0.4) {
          best = { ...r, lowered: k * LOWER_STEP };
          if (r.t >= 0.999) break;
        }
      }
      return best;
    },
    slimPush(pivot, cam) {
      if (!insideSlim(cam.x, cam.y, cam.z)) return 0;
      _d.subVectors(cam, pivot);
      const len = _d.length();
      if (len <= MIN_DISTANCE) return 0;
      let s = len;
      while (s > MIN_DISTANCE) {
        s = Math.max(MIN_DISTANCE, s - 0.1);
        const x = pivot.x + (_d.x * s) / len;
        const y = pivot.y + (_d.y * s) / len;
        const z = pivot.z + (_d.z * s) / len;
        if (!insideSlim(x, y, z)) break;
      }
      cam.set(pivot.x + (_d.x * s) / len, pivot.y + (_d.y * s) / len, pivot.z + (_d.z * s) / len);
      return len - s;
    },
    wallSwing(pivot, yaw) {
      const ux = -Math.sin(yaw);
      const uz = -Math.cos(yaw);
      let swing = 0;
      for (const w of walls) {
        if (pivot.y < w.y0 || pivot.y > w.y1) continue;
        const ax = w.x - pivot.x;
        const az = w.z - pivot.z;
        const d = Math.hypot(ax, az);
        const along = ax * ux + az * uz;
        const near = 1 - smooth(w.r + WALL_SWING_NEAR, w.r + WALL_SWING_NEAR + 0.5, d);
        if (d <= w.r || along <= 0 || near <= 0) continue;
        const side = ax * uz - az * ux;
        // how far the line turns in past the tangent at Link (rad), and how far it may
        const tip = Math.PI / 2 - Math.atan2(Math.abs(side), along);
        const need = (tip - WALL_SWING_SHARE * Math.acos(Math.min(1, (w.r + WALL_LINE_MARGIN) / d))) * near;
        if (need <= 0) continue;
        // d(side)/d(yaw) = −along: turn the line further out on the side of the axis it lies on
        const s = side > 0 ? -need : need;
        if (Math.abs(s) > Math.abs(swing)) swing = s;
      }
      return swing;
    },
    info: () => ({ solidGrid: !!solid, slimGrid: !!slim, trunks: trunks.length, walls: walls.length, slimCylinders: slimCylinders.length }),
  };
}
