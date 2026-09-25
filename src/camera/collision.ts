/**
 * Where the play camera may stand on its line of sight to Link (follow.ts):
 *  - the ground Link walks (terrain, stair treads, decks — the character's walk height): the camera
 *    keeps CLEARANCE above it and is lifted where a ridge or a flight would cut the line;
 *  - SOLID shells (the structures' voxelised trunks, roofs, eaves, porches, the log arch, the huts —
 *    structures/cameraSolids.ts; the ruins' cliff, ivy rock, walls and arch — ruins/cameraSolid.ts)
 *    and the big boles (the giants' and columns' seats as built): the
 *    camera stays in front of the first one on the line, so Link is never behind a wall or a bole,
 *    and out of the cell grown round each; a line that only grazes that cell, or clips the corner
 *    of a surface's own cell, is not blocked; round walls given exactly (the grove's huts) are
 *    solid to their surface, with CAMERA_RADIUS as their grown shell;
 *    under a low ceiling (the log arch's passage, a hut's cap) it first tries standing lower;
 *  - SLIM parts (posts, pods, boughs, the white-barks' boles, the village props): the camera only
 *    refuses to stand inside one and moves in along the line until clear — a post may pass between.
 */
import { Vector3 } from 'three';
import type { SharedGeometry } from '../world/system';
import type { VoxelGrid } from '../world/util/voxelGrid';

/** the camera's own radius against solids (m) — the near plane is 0.08 m */
export const CAMERA_RADIUS = 0.3;
/** least height of the camera over the walked ground (m) */
export const CLEARANCE = 0.35;
/** the camera never comes closer than this to the aim point (m) */
export const MIN_DISTANCE = 0.6;
/** a low ceiling may drop the camera by up to LOWER_STEPS × LOWER_STEP m before it is pulled in */
const LOWER_STEPS = 4;
const LOWER_STEP = 0.15;
/** consecutive surface samples (a fifth of a cell each) a line must run through to be blocked */
const SURFACE_RUN = 4;
/** the sweep's cell (m) when there are only exact walls (structures/cameraSolids.ts CAMERA_SOLID_CELL) */
const SWEEP_CELL = 0.25;

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
  /** the same sweep along the line as given (no lower candidates) */
  sweep(pivot: Vector3, desired: Vector3): { t: number; hit: Resolved['hit'] };
  /** move `cam` toward `pivot` until it is outside every slim part; returns the distance moved (m) */
  slimPush(pivot: Vector3, cam: Vector3): number;
  /** the walked ground under (x, z) */
  ground(x: number, z: number): number;
  info(): Record<string, unknown>;
}

const _d = new Vector3();
const _c = new Vector3();

export function createCameraCollider(ground: (x: number, z: number) => number, shared: SharedGeometry): CameraCollider {
  // the structures' shells and any other system's (the ruins'), each grid in its own bounds
  const solids = [shared.cameraSolids?.solid ?? null, ...(shared.cameraSolidGrids ?? [])].filter((g): g is VoxelGrid => g !== null);
  const grownAt = (x: number, y: number, z: number): boolean => {
    for (const g of solids) if (g.hasPoint(x, y, z)) return true;
    return false;
  };
  const coreAt = (x: number, y: number, z: number): boolean => {
    for (const g of solids) if (g.hasCorePoint(x, y, z)) return true;
    return false;
  };
  const solidCell = solids.length ? Math.min(...solids.map((g) => g.cell)) : SWEEP_CELL;
  const slim = shared.cameraSolids?.slim ?? null;
  const trunks: Cylinder[] = (shared.trunkSeats ?? []).map((s) => ({
    x: s.x,
    z: s.z,
    r: Math.max(s.radiusAt(1.0), s.radiusAt(2.5)) + CAMERA_RADIUS,
    y0: s.y - 1,
    y1: s.y + Math.max(4, s.bareHeight),
  }));
  const slimCylinders: Cylinder[] = [
    ...(shared.slimTrunks ?? []).map((t) => ({ ...t, r: t.r + CAMERA_RADIUS })),
    ...(shared.propBlockers ?? []).map((b) => ({ x: b.x, z: b.z, r: b.r + CAMERA_RADIUS, y0: -Infinity, y1: b.top + CAMERA_RADIUS })),
  ];

  const walls = shared.cameraSolids?.walls ?? [];
  /** inside a round wall, or within `pad` m of it (over its height band, ± pad) */
  const insideWall = (x: number, y: number, z: number, pad: number): boolean => {
    for (const w of walls) {
      if (y < w.y0 - pad || y > w.y1 + pad) continue;
      const dx = x - w.x;
      const dz = z - w.z;
      const d2 = dx * dx + dz * dz;
      const rm = w.rMax + pad;
      if (d2 >= rm * rm) continue;
      if (Math.sqrt(d2) < w.radiusAt(Math.atan2(dz, dx), Math.min(Math.max(y, w.y0), w.y1)) + pad) return true;
    }
    return false;
  };

  const insideSlim = (x: number, y: number, z: number): boolean => {
    if (slim?.hasPoint(x, y, z)) return true;
    for (const c of slimCylinders) {
      if (y < c.y0 || y > c.y1) continue;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    }
    return false;
  };

  /** first blocked fraction of the line a → b against the solid grid and the boles (1 when clear) */
  const sweep = (a: Vector3, b: Vector3): { t: number; hit: Resolved['hit'] } => {
    _d.subVectors(b, a);
    const len = _d.length();
    if (len < 1e-6) return { t: 1, hit: null };
    let t = 1;
    let hit: Resolved['hit'] = null;
    if (solids.length || walls.length) {
      const step = solidCell * 0.2;
      const grown = (s: number) => {
        const x = a.x + (_d.x * s) / len;
        const y = a.y + (_d.y * s) / len;
        const z = a.z + (_d.z * s) / len;
        return grownAt(x, y, z) || insideWall(x, y, z, CAMERA_RADIUS);
      };
      const core = (s: number) => {
        const x = a.x + (_d.x * s) / len;
        const y = a.y + (_d.y * s) / len;
        const z = a.z + (_d.z * s) / len;
        return coreAt(x, y, z) || insideWall(x, y, z, 0);
      };
      // The line is blocked where it runs through a surface (the grid's core) for SURFACE_RUN
      // samples; the grown cell round it only keeps the camera itself off the surface. A line
      // through a wall crosses a whole cell of it (five samples or more); one that clips a cell's
      // corner for a sample or three passes beside the surface — a door's edge, a round wall it
      // runs along. Link may stand in the grown shell (his head under an eave, beside a root arch,
      // against a wall): an occupied run at the start is skipped, unless it goes through a surface
      // and runs on past half a metre — then the camera has nowhere behind him.
      let s = 0;
      let run = 0;
      let through = 0;
      let met = false;
      while (s <= len && grown(s)) {
        through = core(s) ? through + 1 : 0;
        met ||= through >= SURFACE_RUN;
        run += step;
        s += step;
        if (met && run > 0.5) return { t: 0, hit: 'solid' };
      }
      // (a line that never leaves the grown shell and never goes through a surface keeps its length)
      const clear = s;
      if (clear <= len) {
        let end = len;
        through = 0;
        for (; s <= len; s += step) {
          through = core(s) ? through + 1 : 0;
          if (through >= SURFACE_RUN) {
            end = s - through * step;
            break;
          }
        }
        if (end < len || grown(len)) {
          // the farthest point before the surface (or the line's end) that is clear of the grown shell
          while (end > clear && grown(end)) end -= step;
          t = end / len;
          hit = 'solid';
        }
      }
    }
    const ax = _d.x * _d.x + _d.z * _d.z;
    if (ax > 1e-9) {
      for (const c of trunks) {
        const ox = a.x - c.x;
        const oz = a.z - c.z;
        const c0 = ox * ox + oz * oz - c.r * c.r;
        if (c0 < 0) continue;
        const bq = 2 * (ox * _d.x + oz * _d.z);
        const disc = bq * bq - 4 * ax * c0;
        if (disc < 0) continue;
        const u = (-bq - Math.sqrt(disc)) / (2 * ax);
        if (u < 0 || u >= t) continue;
        const y = a.y + _d.y * u;
        if (y < c.y0 || y > c.y1) continue;
        t = u;
        hit = 'trunk';
      }
    }
    return { t, hit };
  };

  return {
    ground,
    sweep,
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
    info: () => ({ solidGrid: !!shared.cameraSolids?.solid, solidGrids: solids.length, slimGrid: !!slim, trunks: trunks.length, slimCylinders: slimCylinders.length }),
  };
}
