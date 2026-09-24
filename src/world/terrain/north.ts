/**
 * 2026-09-24 (expansion-north; owner 06:07 "more structures along the path further down"): the
 * geometry of the grove above the ledge terrace that more than one system reads — the trail's
 * flattened profile and its stepping discs, the shelf's level cut, the yard's worn paths, the
 * stilt house's stump and stilts, the gangway's trestle, the tree hut's column. Pure functions of
 * position over layout.ts `EXPANSION_NORTH`: the heightfield cuts and paves with them (the LIVE
 * view only), the character ground and the vegetation keep off the built footprints, and the
 * trees clear the ground the grove needs (`northGroveClear`).
 */
import { EXPANSION_NORTH, NORTH_STAIRS, northGangway, northRopeWalkEnds, northSteppingStones } from '../layout';
import { clamp, smoothstep } from '../util/noise';

const N = EXPANSION_NORTH;
const DEG = Math.PI / 180;

interface Seg {
  ax: number;
  ay: number;
  az: number;
  dx: number;
  dy: number;
  dz: number;
  len: number;
  s0: number;
}

function segsOf(pts: readonly (readonly [number, number, number])[]): Seg[] {
  const out: Seg[] = [];
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay, az] = pts[i];
    const [bx, by, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    out.push({ ax, ay, az, dx: bx - ax, dy: by - ay, dz: bz - az, len, s0: s });
    s += len;
  }
  return out;
}

const TRAIL = segsOf(N.trail);
/** the trail's centreline length (m) */
export const NORTH_TRAIL_LENGTH = TRAIL.reduce((n, g) => n + g.len, 0);
/** the farthest from the trail's centreline any trail query answers (m) */
const TRAIL_REACH = N.trailHalfWidth + 1.6;
const TRAIL_BOX = TRAIL.reduce(
  (b, g) => ({
    x0: Math.min(b.x0, g.ax - TRAIL_REACH, g.ax + g.dx - TRAIL_REACH),
    x1: Math.max(b.x1, g.ax + TRAIL_REACH, g.ax + g.dx + TRAIL_REACH),
    z0: Math.min(b.z0, g.az - TRAIL_REACH, g.az + g.dz - TRAIL_REACH),
    z1: Math.max(b.z1, g.az + TRAIL_REACH, g.az + g.dz + TRAIL_REACH),
  }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity },
);

export interface TrailHit {
  /** horizontal distance to the centreline (m) */
  d: number;
  /** the design height at the closest point */
  y: number;
  /** arc length of the closest point from the flight's landing */
  s: number;
  /** the closest point */
  px: number;
  pz: number;
  /** the unit tangent there (uphill) */
  tx: number;
  tz: number;
}

/** the closest trail centreline point within `reach` m (null farther) */
export function trailHit(x: number, z: number, reach = TRAIL_REACH): TrailHit | null {
  if (x < TRAIL_BOX.x0 - (reach - TRAIL_REACH) || x > TRAIL_BOX.x1 + (reach - TRAIL_REACH) || z < TRAIL_BOX.z0 - (reach - TRAIL_REACH) || z > TRAIL_BOX.z1 + (reach - TRAIL_REACH)) return null;
  let best = Infinity;
  let bi = -1;
  let bt = 0;
  for (let i = 0; i < TRAIL.length; i++) {
    const g = TRAIL[i];
    const t = clamp(((x - g.ax) * g.dx + (z - g.az) * g.dz) / Math.max(g.len * g.len, 1e-9), 0, 1);
    const d2 = (x - g.ax - g.dx * t) ** 2 + (z - g.az - g.dz * t) ** 2;
    if (d2 < best) {
      best = d2;
      bi = i;
      bt = t;
    }
  }
  if (bi < 0 || best > reach * reach) return null;
  const g = TRAIL[bi];
  return { d: Math.sqrt(best), y: g.ay + g.dy * bt, s: g.s0 + g.len * bt, px: g.ax + g.dx * bt, pz: g.az + g.dz * bt, tx: g.dx / g.len, tz: g.dz / g.len };
}

/**
 * Signed distance (m, negative inside) from the shelf's edge: the superellipse's radial distance
 * (exponent 4 — a rounded rectangle) and the round pads, whichever is nearer. `grad` receives the
 * outward unit normal of the nearer edge.
 */
export function shelfDistance(x: number, z: number, grad?: { x: number; z: number }): number {
  const S = N.shelf;
  const dx = x - S.cx;
  const dz = z - S.cz;
  const rho = Math.hypot(dx, dz);
  let sd: number;
  let gx = 1;
  let gz = 0;
  if (rho < 1e-6) sd = -Math.min(S.hx, S.hz);
  else {
    const c = Math.abs(dx) / rho;
    const s = Math.abs(dz) / rho;
    sd = rho - 1 / Math.pow((c / S.hx) ** 4 + (s / S.hz) ** 4, 0.25);
    // the implicit function's gradient ∝ (dx³ / hx⁴, dz³ / hz⁴)
    gx = dx ** 3 / S.hx ** 4;
    gz = dz ** 3 / S.hz ** 4;
    const l = Math.hypot(gx, gz);
    if (l > 1e-12) {
      gx /= l;
      gz /= l;
    } else {
      gx = dx / rho;
      gz = dz / rho;
    }
  }
  for (const p of S.pads) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d - p.r < sd) {
      sd = d - p.r;
      gx = d > 1e-6 ? (x - p.x) / d : 1;
      gz = d > 1e-6 ? (z - p.z) / d : 0;
    }
  }
  if (grad) {
    grad.x = gx;
    grad.z = gz;
  }
  return sd;
}

/** the trail's stepping discs (layout `northSteppingStones`) and their box */
export const NORTH_STONES = northSteppingStones();
const STONES_BOX = NORTH_STONES.reduce(
  (b, s) => ({ x0: Math.min(b.x0, s.x - s.r * 1.3), x1: Math.max(b.x1, s.x + s.r * 1.3), z0: Math.min(b.z0, s.z - s.r * 1.3), z1: Math.max(b.z1, s.z + s.r * 1.3) }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity },
);

/**
 * 1 on a stepping disc of the trail (paved surface for the splat, the paving pass and the
 * character ground; the ground under them follows the trail's profile — they are set stones lying
 * with the grade, hardscape/flagstones.ts `setDiscs`), soft 10 % rim.
 */
export function northDiscMask(x: number, z: number): number {
  const b = STONES_BOX;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return 0;
  let m = 0;
  for (const s of NORTH_STONES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r * 1.2) m = Math.max(m, 1 - smoothstep(s.r * 0.92, s.r * 1.12, d));
  }
  return m;
}

/** the grove house's door threshold on the shelf (world x, z): the trunk's radius + 0.9 m out along its facing */
export const GROVE_DOOR: [number, number] = (() => {
  const H = N.house;
  const l = Math.hypot(H.facing[0], H.facing[1]);
  const r = H.trunkRadius + 0.9;
  return [H.position[0] + (H.facing[0] / l) * r, H.position[2] + (H.facing[1] / l) * r];
})();

const GANGWAY = northGangway();
/**
 * The yard's worn paths across the shelf (x, z polylines): from the trail's head to the house's
 * door and to the gangway's foot — trodden earth under the grass (splat only; nothing flattened).
 */
const YARD_PATHS: [number, number][][] = (() => {
  const head = N.trail[N.trail.length - 1];
  const fork: [number, number] = [head[0] - 0.4, head[2] - 1.6];
  return [
    [[head[0], head[2]], fork, [(fork[0] + GROVE_DOOR[0]) / 2, (fork[1] + GROVE_DOOR[1]) / 2 + 0.5], GROVE_DOOR],
    [fork, [(fork[0] + GANGWAY.foot[0]) / 2, (fork[1] + GANGWAY.foot[2]) / 2 - 0.35], [GANGWAY.foot[0], GANGWAY.foot[2]]],
  ];
})();

function yardPathSurface(x: number, z: number): number {
  let best = Infinity;
  for (const line of YARD_PATHS) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(dx * dx + dz * dz, 1e-9), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
  }
  return 0.3 * (1 - smoothstep(0.3, 0.72, best));
}

/**
 * The grove's worn-path surface (0 … 1, the splat's `path`; live view): the trail's trodden middle
 * (≈ 0.38 — earth, not paving), the yard's paths across the shelf (0.3) and the stepping discs (1).
 */
export function groveSurface(x: number, z: number): number {
  let surface = 0;
  const th = trailHit(x, z);
  if (th) surface = 0.38 * (1 - smoothstep(N.trailHalfWidth * 0.55, N.trailHalfWidth * 1.05, th.d));
  if (shelfDistance(x, z) < 0.5) surface = Math.max(surface, yardPathSurface(x, z));
  return Math.max(surface, northDiscMask(x, z));
}

export interface GroveShape {
  /** the shaped height */
  h: number;
  /** 0 … 1 authored-flat weight (the detail passes fade out on it) */
  pad: number;
  /** 0 … 1 how far the breakup noise yields (the shelf keeps a little of its lumps; the pad none) */
  flat: number;
  /** 0 … 1 embankment weight of the cut / fill banks (peaks mid-bank) */
  bank: number;
  /** the banks' fall direction (unit, downhill) */
  fx: number;
  fz: number;
}

const _grad = { x: 0, z: 0 };

/**
 * The grove's landform at (x, z) over the natural height `h0` (`wob` ∈ [−1, 1], a long-wavelength
 * undulation the caller samples): the shelf levelled at `shelf.y` — its edge blending back to the
 * slope over `shelf.edge` m (a cut bank on the uphill side, a low fill on the lip and at the
 * gangway's pad) — and the trail's width flattened to its design profile, applied after the shelf
 * so it rules where they meet. The heightfield applies it in the live view before the stair ramps,
 * so the grove flight's trench, banks and landing win where they overlap the trail's foot.
 */
export function groveShape(x: number, z: number, h0: number, wob: number): GroveShape {
  let h = h0;
  let pad = 0;
  let flat = 0;
  let bank = 0;
  let fx = 0;
  let fz = 0;
  const S = N.shelf;
  const sd = shelfDistance(x, z, _grad);
  if (sd < S.edge) {
    const ws = 1 - smoothstep(-0.4, S.edge, sd);
    const target = S.y + 0.03 * wob;
    h = h0 + (target - h0) * ws;
    pad = 0.85 * smoothstep(0.2, 0.9, ws);
    // the gangway's pad is a built landing: no breakup at all on it, a little on the yard
    const onPad = S.pads.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 0.3);
    flat = (onPad ? 1 : 0.6) * smoothstep(0.3, 0.95, ws);
    const b = 4 * ws * (1 - ws) * clamp(Math.abs(h0 - target) / 1.6, 0.25, 1) * 0.55;
    if (b > bank) {
      bank = b;
      const sign = h0 > target ? -1 : 1;
      fx = sign * _grad.x;
      fz = sign * _grad.z;
    }
  }
  const th = trailHit(x, z);
  if (th) {
    const hw = N.trailHalfWidth;
    const wt = 1 - smoothstep(hw * 0.7, hw + 1.5, th.d);
    if (wt > 0) {
      const hb = h;
      const target = th.y + 0.02 * wob;
      h = hb + (target - hb) * wt;
      pad = Math.max(pad, smoothstep(0.15, 0.85, wt));
      flat = Math.max(flat, 0.5 * smoothstep(0.3, 0.9, wt));
      const b = 4 * wt * (1 - wt) * clamp(Math.abs(hb - target) / 1.2, 0.2, 1) * 0.5;
      if (b > bank && th.d > 1e-6) {
        bank = b;
        const sign = hb > target ? -1 : 1;
        fx = (sign * (x - th.px)) / th.d;
        fz = (sign * (z - th.pz)) / th.d;
      }
    }
  }
  return { h, pad, flat, bank, fx, fz };
}

/** the stilt house's cut stump under the platform: radius at its top and at its flared foot (m) */
export const STILT_STUMP = { top: N.stilt.radius * 0.55 + 0.02, foot: N.stilt.radius * 0.55 + 0.2 };
/** the veranda's outer radius round the stilt house's centre (m) */
export const VERANDA_R = N.stilt.radius + N.stilt.veranda;
/** the stilts' radial distance from the stilt house's centre under the veranda's ring beam and at the ground (m) */
export const STILT_R = { top: VERANDA_R - 0.22, foot: VERANDA_R + 0.05 };

/** the four stilts' feet (world x, z) */
export function stiltFeet(): [number, number][] {
  const [hx, hz] = N.stilt.host;
  return N.stilt.stiltAbsDeg.map((d) => [hx + Math.sin(d * DEG) * STILT_R.foot, hz + Math.cos(d * DEG) * STILT_R.foot] as [number, number]);
}

/** the gangway's trestle: its place along the gangway (0 foot … 1 head) and its legs' half spread */
export const GANGWAY_TRESTLE_T = 0.52;
const TRESTLE_SPREAD = N.gangway.halfWidth + 0.08;

/** the trestle's two feet (world x, z) */
export function gangwayTrestleFeet(): [number, number][] {
  const [dx, dz] = GANGWAY.dir;
  const x = GANGWAY.foot[0] + (GANGWAY.head[0] - GANGWAY.foot[0]) * GANGWAY_TRESTLE_T;
  const z = GANGWAY.foot[2] + (GANGWAY.head[2] - GANGWAY.foot[2]) * GANGWAY_TRESTLE_T;
  // across the gangway: its direction turned 90°
  return [-1, 1].map((s) => [x - dz * s * TRESTLE_SPREAD, z + dx * s * TRESTLE_SPREAD] as [number, number]);
}

const FEET = stiltFeet();
const TRESTLE = gangwayTrestleFeet();

/**
 * 1 on the grove's built footprints (no grass; the character ground blocks where it is > 0.5):
 * the trunk house's bole and root flare, the stilt house's stump and stilts, the trestle's legs,
 * the tree hut's column.
 */
export function northStructure(x: number, z: number): number {
  const H = N.house;
  let m = 1 - smoothstep(H.trunkRadius + 0.2, H.trunkRadius + 1.1, Math.hypot(x - H.position[0], z - H.position[2]));
  const [sx, sz] = N.stilt.host;
  const ds = Math.hypot(x - sx, z - sz);
  if (ds < STILT_R.foot + 0.5) {
    m = Math.max(m, 1 - smoothstep(STILT_STUMP.top, STILT_STUMP.foot + 0.1, ds));
    for (const [fx, fz] of FEET) m = Math.max(m, 1 - smoothstep(0.2, 0.42, Math.hypot(x - fx, z - fz)));
  }
  for (const [fx, fz] of TRESTLE) m = Math.max(m, 1 - smoothstep(0.12, 0.28, Math.hypot(x - fx, z - fz)));
  const C = N.column;
  m = Math.max(m, 1 - smoothstep(C.baseRadius + 0.25, C.baseRadius + 0.9, Math.hypot(x - N.hut.host[0], z - N.hut.host[1])));
  return m;
}

/** distance (m) from (x, z) to the segment a → b */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(dx * dx + dz * dz, 1e-9), 0, 1);
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

const ROPE = northRopeWalkEnds();
const FLIGHT = NORTH_STAIRS[0];
const FLIGHT_FRAME = (() => {
  const l = Math.hypot(FLIGHT.dir[0], FLIGHT.dir[1]);
  return { dx: FLIGHT.dir[0] / l, dz: FLIGHT.dir[1] / l, run: FLIGHT.steps * FLIGHT.tread, hw: FLIGHT.width / 2 };
})();

/**
 * True where a tree of trunk radius `r` would stand in the grove's way: on or beside the flight,
 * the trail and the shelf, under the huts' caps and platforms, beside the gangway and the rope
 * walkway, at the lantern posts and the sign. The trees system filters its placements by it AFTER
 * every placement loop (a filter re-rolls nothing).
 */
export function northGroveClear(x: number, z: number, r = 0.8): boolean {
  const F = FLIGHT_FRAME;
  const rx = x - FLIGHT.base[0];
  const rz = z - FLIGHT.base[2];
  const u = rx * F.dx + rz * F.dz;
  const v = -rx * F.dz + rz * F.dx;
  if (u > -1.8 - r && u < F.run + 2.6 + r && Math.abs(v) < F.hw + 2.2 + r) return true;
  const th = trailHit(x, z, 2.6 + r + 0.1);
  if (th && th.d < 2.6 + r) return true;
  if (shelfDistance(x, z) < 1 + r) return true;
  if (Math.hypot(x - N.stilt.host[0], z - N.stilt.host[1]) < VERANDA_R + 1.4 + r) return true;
  if (Math.hypot(x - N.hut.host[0], z - N.hut.host[1]) < N.hut.radius + N.hut.capOverhang + 1.4 + r) return true;
  if (segDist(x, z, GANGWAY.foot[0], GANGWAY.foot[2], GANGWAY.head[0], GANGWAY.head[2]) < 1.6 + r) return true;
  if (segDist(x, z, ROPE.stilt[0], ROPE.stilt[2], ROPE.hut[0], ROPE.hut[2]) < 1.6 + r) return true;
  for (const p of N.lanternPosts) if (Math.hypot(x - p.position[0], z - p.position[1]) < 1.2 + r) return true;
  if (Math.hypot(x - N.signpost.position[0], z - N.signpost.position[2]) < 1.0 + r) return true;
  return false;
}
