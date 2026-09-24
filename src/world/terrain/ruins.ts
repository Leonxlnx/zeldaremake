/**
 * Round 57 (expansion-ruins): the waterfall ruins' ground as pure functions of (x, z) — the
 * trail's line and grade, the pale outcrop, the pool's basin, the cliff's face, the terrace's and
 * the stair's footprints — and the rules the character ground (`ruinsBlocked`), the legacy
 * streams' cull (heightfield `ruinsCull`), the vegetation and the ruins system read.
 * layout.ts `EXPANSION_RUINS` holds the numbers; heightfield.ts applies the landform in its LIVE
 * view only (the legacy view — what trees, rocks, vegetation and props sample — is untouched).
 *
 * The site is on the 1 m mid lattice, so the landform is broad: the outcrop is a raised pad eased
 * back to the forest floor, the pool a basin with a shelving shore. Everything crisp — the
 * terrace, the stair, the walls, the cliff — is geometry standing on (or sunk into) that ground.
 */
import { EXPANSION_RUINS, EXPANSION_RUINS_BOXES, ruinsTrailLine } from '../layout';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';

const R = EXPANSION_RUINS;
export const [RUINS_TRAIL_BOX, RUINS_SITE_BOX] = EXPANSION_RUINS_BOXES;
const inBox = (b: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

const shoreNoise = new Noise2D('ruins-shore');
const edgeNoise = new Noise2D('ruins-edge');
const cliffNoise = new Noise2D('ruins-cliff');
const trailNoise = new Noise2D('ruins-trail');

// ---------------------------------------------------------------------------------------------
// the trail
// ---------------------------------------------------------------------------------------------

export interface TrailProfile {
  /** the smoothed line with its ground level (x, y, z) */
  pts: [number, number, number][];
  /** arc length at each point (m) */
  s: number[];
  total: number;
}

/**
 * The trail's grade: `landH` (the heightfield's macro landform, before any flattening) along the
 * line, averaged over ± 3 m, eased onto the outcrop's level over the last 6 m.
 */
export function buildTrailProfile(landH: (x: number, z: number) => number): TrailProfile {
  const line = ruinsTrailLine();
  const s: number[] = [0];
  for (let i = 1; i < line.length; i++) s.push(s[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][2] - line[i - 1][2]));
  const total = s[s.length - 1];
  const raw = line.map((p) => landH(p[0], p[2]));
  const pts = line.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = 0; j < line.length; j++) {
      if (Math.abs(s[j] - s[i]) <= 3) {
        sum += raw[j];
        n++;
      }
    }
    const y = lerp(sum / n, R.platform.y, smoothstep(total - 7, total - 1.5, s[i]));
    return [p[0], y, p[2]] as [number, number, number];
  });
  return { pts, s, total };
}

/** nearest point of the trail's line: distance, ground level there, arc length (null outside the trail box) */
export function trailNearest(tp: TrailProfile, x: number, z: number): { dist: number; y: number; s: number } | null {
  if (!inBox(RUINS_TRAIL_BOX, x, z)) return null;
  const P = tp.pts;
  let best = Infinity;
  let by = 0;
  let bs = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const ax = P[i][0];
    const az = P[i][2];
    const dx = P[i + 1][0] - ax;
    const dz = P[i + 1][2] - az;
    const l2 = dx * dx + dz * dz;
    if (l2 < 1e-12) continue;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const ex = ax + dx * t - x;
    const ez = az + dz * t - z;
    const d2 = ex * ex + ez * ez;
    if (d2 < best) {
      best = d2;
      by = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
      bs = tp.s[i] + (tp.s[i + 1] - tp.s[i]) * t;
    }
  }
  return { dist: Math.sqrt(best), y: by, s: bs };
}

/** the trail's packed-earth half width `s` m along it: narrow where it leaves the discs, wandering ± 15 % */
export function trailHalfWidth(s: number): number {
  return R.trailHalfWidth * (0.6 + 0.4 * smoothstep(0, 3, s)) * (1 + 0.15 * trailNoise.noise(s * 0.23, 3.7));
}

/**
 * The trail's influence at (x, z) for the heightfield's `pathInfluence`: `surface` (the splat's
 * path layer: packed earth, a ragged edge), `weight` (flattening toward `y`, faded in over the
 * first 3–5 m so the discs' natural grade and the west house's flight banks keep their ground),
 * `hw` the half width. Onto the outcrop the earth thins out under its rock (last 3 m).
 */
export function trailInfluence(tp: TrailProfile, x: number, z: number): { dist: number; y: number; hw: number; surface: number; weight: number } | null {
  const n = trailNearest(tp, x, z);
  if (!n) return null;
  const hw = trailHalfWidth(n.s);
  if (n.dist > hw + R.trailVerge + 1.2) return null;
  const rag = 0.14 * edgeNoise.noise(x * 1.4, z * 1.4) + 0.06 * edgeNoise.noise(x * 4.1 + 5, z * 4.1 - 2);
  const ends = smoothstep(0.3, 1.2, n.s) * (1 - smoothstep(tp.total - 3.5, tp.total - 0.5, n.s));
  const surface = (1 - smoothstep(hw * 0.7 + rag, hw * 1.12 + rag, n.dist)) * ends;
  const weight = (1 - smoothstep(hw, hw + R.trailVerge, n.dist)) * smoothstep(2.5, 5.5, n.s);
  return { dist: n.dist, y: n.y, hw, surface, weight };
}

// ---------------------------------------------------------------------------------------------
// the site: outcrop, stair, terrace, wall, pool, cliff, rocks
// ---------------------------------------------------------------------------------------------

/** signed distance (m) to the outcrop's rounded rectangle, negative inside; its edge wanders ± 0.3 m */
export function platformSigned(x: number, z: number): number {
  const P = R.platform;
  const cx = (P.x0 + P.x1) / 2;
  const cz = (P.z0 + P.z1) / 2;
  const qx = Math.abs(x - cx) - ((P.x1 - P.x0) / 2 - P.corner);
  const qz = Math.abs(z - cz) - ((P.z1 - P.z0) / 2 - P.corner);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - P.corner;
  return d + 0.3 * edgeNoise.noise(x * 0.43 + 11, z * 0.43 - 4);
}

/** the stair's local frame: `u` up the flight from the first riser, `v` across (m) */
export function stairLocal(x: number, z: number): { u: number; v: number } {
  const S = R.stairs;
  const l = Math.hypot(S.dir[0], S.dir[1]);
  const dx = S.dir[0] / l;
  const dz = S.dir[1] / l;
  const rx = x - S.base[0];
  const rz = z - S.base[2];
  return { u: rx * dx + rz * dz, v: -rx * dz + rz * dx };
}
export const STAIR_RUN = R.stairs.steps * R.stairs.tread;

/** true inside the stair's cut in the terrace's front (the treads' footprint, `m` m wider) */
export function inStairCut(x: number, z: number, m = 0): boolean {
  const { u, v } = stairLocal(x, z);
  return u > -m && u < STAIR_RUN + m && Math.abs(v) < R.stairs.width / 2 + m;
}

/** true on the terrace block's footprint (`m` m larger all round), the stair's cut excepted */
export function inTerrace(x: number, z: number, m = 0): boolean {
  const T = R.terrace;
  if (x < T.x0 - m || x > T.x1 + m || z < T.z0 - m || z > T.z1 + m) return false;
  if (z < T.notchZ + m && x > T.notchX + m) return false;
  return !inStairCut(x, z, -m);
}

/** radial signed distance (m) to the pool's shore, negative inside; ragged except along the wall */
export function poolSigned(x: number, z: number): number {
  const P = R.pool;
  const dx = x - P.x;
  const dz = z - P.z;
  const rho = Math.hypot(dx, dz);
  if (rho < 1e-6) return -Math.min(P.hx, P.hz);
  const c = Math.abs(dx) / rho;
  const s = Math.abs(dz) / rho;
  const rb = 1 / Math.pow(Math.pow(c / P.hx, P.n) + Math.pow(s / P.hz, P.n), 1 / P.n);
  const wild = smoothstep(R.wall.z + 1.2, R.wall.z + 3.2, z);
  const rag = (0.5 * shoreNoise.noise(x * 0.33, z * 0.33) + 0.22 * shoreNoise.noise(x * 0.9 + 7, z * 0.9 - 3)) * wild;
  return rho - rb - rag;
}

/** the designed water depth at (x, z): shelving over `shelf` m from the shore, deeper under the fall */
export function poolDepth(x: number, z: number): number {
  const P = R.pool;
  const d = poolSigned(x, z);
  if (d >= 0) return 0;
  const plunge = 0.55 * (1 - smoothstep(0.5, 3.6, Math.hypot(x - R.fall.x - 1.1, z - R.fall.z)));
  return P.depth * smoothstep(0, P.shelf, -d) + plunge * smoothstep(0, 1.2, -d);
}

/** the pool's water surface height */
export const POOL_WATER_Y = R.pool.water;

/**
 * The cliff face's x at (z, y): a line wandering ± 0.6 m along z with bulges up the face, set back
 * `FALL_NOTCH_M` where the fall pours (its lip notch). The ruins system builds the rock on it and
 * `ruinsBlocked` stops the walker a little in front of it.
 */
export const FALL_NOTCH_M = 0.9;
export function cliffFaceX(z: number, y = 2): number {
  const C = R.cliff;
  const F = R.fall;
  const wobble = 0.5 * cliffNoise.noise(z * 0.19, y * 0.11) + 0.22 * cliffNoise.noise(z * 0.61 + 9, y * 0.43 - 2) + 0.1 * cliffNoise.noise(z * 1.7 - 3, y * 1.3);
  const notch = FALL_NOTCH_M * (1 - smoothstep(F.width * 0.35, F.width * 0.85, Math.abs(z - F.z)));
  return C.x + wobble - notch;
}

/** 1 within the cliff's run (z), fading over its last 1.5 m at each end */
export function cliffRun(z: number): number {
  const C = R.cliff;
  return smoothstep(C.z0, C.z0 + 1.5, z) * (1 - smoothstep(C.z1 - 1.5, C.z1, z));
}

/** the ivy rock's radius at height `y` over its base and bearing `a` (rad): a bulging, fissured column */
export function pillarRadius(a: number, y: number): number {
  const P = R.pillar;
  const h = P.top - 2.0;
  const t = clamp(y / h, 0, 1.2);
  const taper = 1 - 0.18 * t + 0.1 * Math.sin(t * 3.1);
  const lobes = 0.14 * Math.sin(a * 3 + 0.7 + t * 1.3) + 0.08 * Math.sin(a * 5 - 1.1 + t * 2.1) + 0.05 * cliffNoise.noise(Math.cos(a) * 2.2 + t * 1.7, Math.sin(a) * 2.2 - t);
  return P.r * taper * (1 + lobes);
}

/**
 * The live landform at (x, z) over the height `h` the heightfield has so far: the outcrop raised
 * to its level (eased out over `platform.edge`), the pool's basin cut (a shelving bed, the shore
 * easing into the forest floor over `pool.bank` — but never north of the wall, whose masonry
 * holds the outcrop and the terrace). `flat` suppresses the heightfield's breakup and detail
 * passes (the pool bed, the outcrop's top at half).
 */
export function ruinsLandform(x: number, z: number, h: number): { h: number; flat: number } {
  let flat = 0;
  const P = R.platform;
  const pd = platformSigned(x, z);
  if (pd < P.edge) {
    const w = pd <= 0 ? 1 : 1 - smoothstep(0, P.edge, pd);
    h = lerp(h, Math.max(h, P.y), w);
    flat = Math.max(flat, 0.55 * w);
  }
  const W = R.wall;
  const underWall = x > W.x0 - 0.5 && x < W.x1 + 0.5;
  const gate = underWall ? smoothstep(W.z - 0.1, W.z + W.half, z) : 1;
  const Q = R.pool;
  const sd = poolSigned(x, z);
  if (gate > 0 && sd < Q.bank + POOL_RIM_OUT_M) {
    if (sd < 0) {
      // the bed, exactly as designed
      h = lerp(h, Q.water - poolDepth(x, z), gate);
      flat = Math.max(flat, gate * smoothstep(0, 1.0, -sd));
    } else {
      // the shore: cut down to the waterline where the forest floor stands over it …
      const cut = lerp(Q.water - 0.1, Math.min(h, Q.water + 1.6), smoothstep(0, Q.bank, sd));
      h = lerp(h, Math.min(h, cut), gate * (1 - smoothstep(Q.bank * 0.6, Q.bank, sd)));
      // … and never under the rim where it falls away (south of the pool the floor is 0.5 m
      // under the water): the shore climbs 0.9 m within 0.9 m of the waterline — a 1 m lattice
      // cell past the waterline is always over it, so the water's edge (0.3 m out) stays buried
      const rim = Q.water - 0.1 + 0.9 * smoothstep(0, 0.9, sd);
      h = lerp(h, Math.max(h, rim), gate * (1 - smoothstep(Q.bank, Q.bank + POOL_RIM_OUT_M, sd)));
    }
  }
  return { h, flat };
}

/** how far past `pool.bank` the pool's rim eases back to the forest floor (m) */
export const POOL_RIM_OUT_M = 2.8;

/**
 * How far behind its face line the cliff's rock mass reaches (m): the ruins system builds its back
 * slope down to the ground there, and the mask / the walker's rule stop at it.
 */
export const CLIFF_DEPTH_M = 7.6;

/**
 * 1 on the ruins' built footprints (the terrace block and a 0.1 m skirt, the wall, the cliff's
 * mass, the ivy rock, the gate boulders): no turf, and off a walk span the walker keeps off. The
 * stair's cut is not in it (the flight is walkable; `ruinsCull` clears it of turf on its own).
 */
export function ruinsStructure(x: number, z: number): number {
  if (!inBox(RUINS_SITE_BOX, x, z)) return 0;
  if (inTerrace(x, z, 0.1)) return 1;
  const W = R.wall;
  if (x > W.x0 - 0.1 && x < W.x1 + 0.1 && Math.abs(z - W.z) < W.half + 0.25) return 1;
  const C = R.cliff;
  if (z > C.z0 - 1 && z < C.z1 + 1 && x < cliffFaceX(z) + 0.3 && x > C.x - CLIFF_DEPTH_M) return 1;
  const Pl = R.pillar;
  if (Math.hypot(x - Pl.x, z - Pl.z) < Pl.r * 1.12) return 1;
  for (const g of R.gate) if (Math.hypot(x - g[0], z - g[1]) < g[2]) return 1;
  return 0;
}

/**
 * The walker's rule (character/ground.ts `blocked`): the pool deeper than a paddle (the shelf's
 * first ≈ 0.45 m is wading), the wall and its parapet, the cliff (and everything behind it), the
 * ivy rock, the gate boulders, the columns and piers. Off the terrace's edges and the outcrop's
 * the walker simply steps down (drops are allowed); the rise back is what stops them.
 */
export function ruinsBlocked(x: number, z: number): boolean {
  if (!inBox(RUINS_SITE_BOX, x, z)) return false;
  if (poolSigned(x, z) < -0.45) return true;
  const W = R.wall;
  if (x > W.x0 - 0.2 && x < W.x1 + 0.12 && Math.abs(z - W.z) < W.half + 0.12) return true;
  const C = R.cliff;
  if (z > C.z0 - 0.5 && z < C.z1 + 0.5 && x < cliffFaceX(z, 1.5) + 0.45 && x > C.x - CLIFF_DEPTH_M - 0.3) return true;
  const Pl = R.pillar;
  if (Math.hypot(x - Pl.x, z - Pl.z) < pillarRadius(Math.atan2(z - Pl.z, x - Pl.x), 0.6) + 0.15) return true;
  for (const g of R.gate) if (Math.hypot(x - g[0], z - g[1]) < g[2] * 0.85) return true;
  for (const [cx, cz, r] of RUINS_COLUMN_FEET) if (Math.hypot(x - cx, z - cz) < r + 0.12) return true;
  return false;
}

/** the columns' and piers' feet (x, z, radius): the arch's two, the colonnade's, the broken arch's piers */
export const RUINS_COLUMN_FEET: readonly (readonly [number, number, number])[] = (() => {
  const A = R.arch;
  const off = A.span / 2 + A.columnR;
  const out: [number, number, number][] = [
    [A.x, A.z - off, A.columnR + 0.18],
    [A.x, A.z + off, A.columnR + 0.18],
  ];
  for (const [x] of R.colonnade.columns) out.push([x, R.colonnade.z, 0.42]);
  for (const z of R.brokenArch.z) out.push([R.brokenArch.x, z, 0.55]);
  return out;
})();

/** the pool's box, its ragged water's edge included (0.3 m past the shore line, `poolSigned` < 0.3) */
export const POOL_BOX = {
  x0: R.pool.x - R.pool.hx - 1.2,
  x1: R.pool.x + R.pool.hx + 1.2,
  z0: R.pool.z - R.pool.hz - 1.2,
  z1: R.pool.z + R.pool.hz + 1.2,
};
