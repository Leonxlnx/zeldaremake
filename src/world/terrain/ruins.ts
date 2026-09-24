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

const outcropNoise = new Noise2D('ruins-outcrop');

/**
 * The outcrop's pale rock skin (0…1): whole over the platform, its ragged outline diving under the
 * turf 0.2–1.2 m past the platform's edge. The ruins system lays the skin by it, the vegetation
 * keeps its turf off it (a tuft or a moss cushion in its cracks, at most).
 */
export function outcropCover(x: number, z: number): number {
  const sd = platformSigned(x, z);
  if (sd > 1.6) return 0;
  const edge = 0.25 * outcropNoise.noise(x * 0.9, z * 0.9) + 0.15 * outcropNoise.noise(x * 2.3 + 17, z * 2.3 - 5);
  return 1 - smoothstep(0.2 + edge, 0.9 + edge, sd);
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
  if (z < T.notchZ - m && x > T.notchX + m) return false;
  return !inStairCut(x, z, -m);
}

/**
 * How far out from the terrace's open edges the walker is held (m) — the east front beside the
 * stair's mouth, the notch's faces, the north face (the wall and the cliff hold the others). From
 * the paving it is the drop he cannot step off (the walk spans stop at the faces); below, the
 * masonry he cannot press his body into.
 */
export const TERRACE_EDGE_M = 0.45;

/** true in the band TERRACE_EDGE_M wide outside the terrace's open edges (the approach to the first riser stays open) */
export function terraceEdge(x: number, z: number): boolean {
  const T = R.terrace;
  const m = TERRACE_EDGE_M;
  if (x < T.x0 || x > T.x1 + m || z < T.z0 - m || z > T.z1) return false;
  if (z < T.notchZ - m && x > T.notchX + m) return false;
  if (inTerrace(x, z) || inStairCut(x, z)) return false;
  const { u, v } = stairLocal(x, z);
  return !(u <= 0 && Math.abs(v) < R.stairs.width / 2);
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

// ---------------------------------------------------------------------------------------------
// the west cliff's surface as built (the ruins system's rock mesh, the fall's water over its lip,
// the walker's reach and the vegetation at its foot): one column per z, v 0 → CLIFF_FACE_V up the
// face from its foot to the lip, CLIFF_FACE_V → 1 over the rounded brow and down the back slope
// ---------------------------------------------------------------------------------------------

type Ground = (x: number, z: number) => number;
const rockA = new Noise2D('ruins-rock-a');
const rockB = new Noise2D('ruins-rock-b');
const rockC = new Noise2D('ruins-rock-c');
/** a cheap 3D value from 2D simplex slices, in about [-1, 1] (the rock's own) */
export const rockNoise3 = (x: number, y: number, z: number) => (rockA.noise(x + 0.31 * y, z - 0.17 * y) + rockB.noise(y + 0.29 * z, x - 0.23 * z) + rockC.noise(z + 0.37 * x, y - 0.19 * x)) / 2.2;

export const CLIFF_FACE_ROWS = 30;
export const CLIFF_TOP_ROWS = 12;
export const CLIFF_ROWS = CLIFF_FACE_ROWS + CLIFF_TOP_ROWS;
/** the v of the face's top row (the lip) */
export const CLIFF_FACE_V = CLIFF_FACE_ROWS / CLIFF_ROWS;
/** the cliff mesh's z range (the run and the slumped ends past it) */
export const CLIFF_Z: readonly [number, number] = [R.cliff.z0 - 2.5, R.cliff.z1 + 2.5];

/** 1 in the fall's channel (its water-worn notch), 0 more than ≈ 2.3 m to either side */
export function fallChannel(z: number): number {
  return 1 - smoothstep(R.fall.width * 0.35, R.fall.width * 0.75, Math.abs(z - R.fall.z));
}

/** the brow's height along z: the cliff's top, dipping to the fall's lip (the face's top row sits 0.35 m under it) */
function cliffTopAt(z: number): number {
  const C = R.cliff;
  const F = R.fall;
  const lip = 1 - smoothstep(F.width * 0.45, F.width * 1.5, Math.abs(z - F.z));
  return lerp(C.top + 0.5 * rockA.noise(z * 0.21, 3.3) + 0.25 * rockB.noise(z * 0.7, 1.1), F.top + 0.35, lip);
}

/** 1 along the cliff's run, easing to 0 past its ends (the mass slumps to a slope there) */
function cliffRunAt(z: number): number {
  return smoothstep(CLIFF_Z[0], R.cliff.z0 + 1.0, z) * (1 - smoothstep(R.cliff.z1 - 1.0, CLIFF_Z[1], z));
}

export const cliffStrata = (z: number, y: number) => Math.sin(y * 2.3 + 1.7 * rockA.noise(z * 0.3, y * 0.2));

/** the cliff's surface point at (z, v): x, y, the foot's ground `g`, the lip's `top`, and how much of a ledge it is */
export function cliffSurface(z: number, v: number, ground: Ground): { x: number; y: number; g: number; top: number; ledge: number } {
  const C = R.cliff;
  const back = C.x - CLIFF_DEPTH_M;
  const r = cliffRunAt(z);
  const g = ground(cliffFaceX(z, 2) + 0.6, z);
  const top = lerp(g + 0.4, cliffTopAt(z), Math.pow(r, 0.7));
  // behind the fall the rock is water-worn: a quarter of the relief, no knobs on the brow
  const worn = 1 - 0.75 * fallChannel(z);
  let x: number;
  let y: number;
  let ledge = 1;
  if (v <= CLIFF_FACE_V) {
    // up the face: strata ledges and fissures on the wandering face line, a flared foot
    const s = v / CLIFF_FACE_V;
    y = lerp(g - 0.6, top - 0.35, s);
    const strata = 0.22 * cliffStrata(z, y) + 0.12 * Math.sin(y * 5.1 + z * 0.4);
    const fiss = 0.3 * Math.pow(Math.abs(rockB.noise(z * 0.55, y * 0.08)), 0.5) - 0.18;
    x = cliffFaceX(z, y) + (strata + fiss + 0.25 * rockNoise3(z * 0.9, y * 0.6, 1.3)) * r * worn - (1 - r) * 1.5 * s;
    if (s < 0.06) x += 0.35 * (1 - s / 0.06);
    ledge = smoothstep(0.08, 0.2, cliffStrata(z, y) * 0.2 + 0.1);
  } else {
    // over the brow and down the back
    const s = (v - CLIFF_FACE_V) / (1 - CLIFF_FACE_V);
    const fx = cliffFaceX(z, top);
    const brow = Math.sin(Math.min(1, s * 3) * Math.PI * 0.5);
    const gy = ground(back - 0.5, z);
    const knobs = 1 - fallChannel(z);
    y = s < 0.35 ? top - 0.35 + 0.35 * brow + 0.3 * knobs * rockNoise3(z * 0.6, s * 3, 7.1) : lerp(top + 0.25 * rockNoise3(z * 0.4, 2.2, s), gy - 0.4, smoothstep(0.35, 1, s));
    x = lerp(fx - 0.3, back, s) + 0.3 * knobs * rockNoise3(z * 0.5, y * 0.4, 4.4);
  }
  return { x, y, g, top, ledge };
}

/** the x of the cliff's face at height y — the point `cliffSurface` gives the face's row at that height */
export function cliffFaceAt(z: number, y: number, ground: Ground): number {
  const g = ground(cliffFaceX(z, 2) + 0.6, z);
  const top = lerp(g + 0.4, cliffTopAt(z), Math.pow(cliffRunAt(z), 0.7));
  const s = clamp((y - (g - 0.6)) / Math.max(top - 0.35 - (g - 0.6), 0.1), 0, 1);
  return cliffSurface(z, s * CLIFF_FACE_V, ground).x;
}

/** the cliff face's furthest x (toward the site) at z over the heights y0…y1, every 0.1 m */
export function cliffReach(z: number, y0: number, y1: number, ground: Ground): number {
  let x = -Infinity;
  for (let y = y0; y <= y1 + 1e-6; y += 0.1) x = Math.max(x, cliffFaceAt(z, y, ground));
  return x;
}

/** 1 within the cliff's run (z), fading over its last 1.5 m at each end */
export function cliffRun(z: number): number {
  const C = R.cliff;
  return smoothstep(C.z0, C.z0 + 1.5, z) * (1 - smoothstep(C.z1 - 1.5, C.z1, z));
}

/**
 * The ivy rock's courses: where each block's bed lies over the rock's lowest ground (m) — the foot
 * block, the block set back on the first ledge, the crown block on the second — and each block's
 * faces ([outward bearing (rad, x toward z), distance at the bed, distance a course up; × `pillar.r`]):
 * an irregular hexagon of leaning planes, turned and drawn in on each course, so the rock stands as
 * jointed stone in stacked blocks with rounded arrises and a ledge at each bed rather than as a
 * bole. The foot block's faces toward the flight and the outcrop keep 2.4 m (the flight's edge is
 * 3.6 m off; the outcrop's walk passes 3.3 m out).
 */
export const PILLAR_BEDS: readonly number[] = [0, 3.7, 7.6];
const PILLAR_FACES: readonly (readonly (readonly [number, number, number])[])[] = [
  [[-0.35, 1.28, 1.2], [0.7, 1.0, 0.98], [1.75, 1.0, 0.97], [2.8, 1.02, 0.98], [3.84, 1.12, 1.04], [4.89, 1.2, 1.12]],
  [[-0.12, 1.12, 1.02], [0.95, 0.96, 0.9], [1.9, 0.92, 0.9], [2.98, 0.96, 0.88], [4.0, 1.04, 0.96], [5.07, 1.08, 1.0]],
  [[-0.55, 0.96, 0.86], [0.5, 0.86, 0.8], [1.62, 0.84, 0.78], [2.6, 0.88, 0.8], [3.72, 0.93, 0.85], [4.7, 0.98, 0.9]],
];
/** the nominal course height the faces lean over, the bevel over which a course takes over from the one under it, the arrises' rounding (m) */
const PILLAR_COURSE_M = 3.8;
const PILLAR_BEVEL_M = 0.45;
const PILLAR_ARRIS_M = 0.09;

/** one course's radius at bearing `a`, `h` m over its bed: the nearest face plane, the arrises rounded by a soft minimum */
function courseRadius(k: number, a: number, h: number): number {
  const lean = clamp(h / PILLAR_COURSE_M, 0, 1);
  const r = R.pillar.r;
  let m = Infinity;
  for (const [th, d0, d1] of PILLAR_FACES[k]) {
    const c = Math.cos(a - th);
    if (c > 0.12) m = Math.min(m, (lerp(d0, d1, lean) * r) / c);
  }
  let s = 0;
  for (const [th, d0, d1] of PILLAR_FACES[k]) {
    const c = Math.cos(a - th);
    if (c > 0.12) s += Math.exp(-((lerp(d0, d1, lean) * r) / c - m) / PILLAR_ARRIS_M);
  }
  return m - PILLAR_ARRIS_M * Math.log(s);
}

/** the ivy rock's radius at height `y` over its lowest ground and bearing `a` (rad): stacked blocks of leaning planes */
export function pillarRadius(a: number, y: number): number {
  const B = PILLAR_BEDS;
  let k = 0;
  while (k + 1 < B.length && y >= B[k + 1]) k++;
  let r = courseRadius(k, a, y - B[k]);
  if (k > 0 && y < B[k] + PILLAR_BEVEL_M) r = lerp(courseRadius(k - 1, a, B[k] - B[k - 1]), r, smoothstep(B[k], B[k] + PILLAR_BEVEL_M, y));
  return r * (1 + 0.035 * cliffNoise.noise(Math.cos(a) * 1.6 + y * 0.11, Math.sin(a) * 1.6 - y * 0.07));
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
  if (inTerrace(x, z, 0.1)) {
    // the skirt runs along the cut's sides, not across the flight or the approach to its first riser
    const { u, v } = stairLocal(x, z);
    if (!(u < STAIR_RUN && Math.abs(v) < R.stairs.width / 2 - 0.1)) return 1;
  }
  const W = R.wall;
  if (x > W.x0 - 0.1 && x < W.x1 + 0.1 && Math.abs(z - W.z) < W.half + 0.25) return 1;
  const C = R.cliff;
  if (z > C.z0 - 1 && z < C.z1 + 1 && x < cliffFaceX(z) + 0.3 && x > C.x - CLIFF_DEPTH_M) return 1;
  const Pl = R.pillar;
  const pd = Math.hypot(x - Pl.x, z - Pl.z);
  if (pd < Pl.r * 1.6 && pd < pillarRadius(Math.atan2(z - Pl.z, x - Pl.x), 0.3) * 1.04 + 0.1) return 1;
  for (const g of R.gate) if (Math.hypot(x - g[0], z - g[1]) < g[2]) return 1;
  return 0;
}

/**
 * The walker's rule (character/ground.ts `blocked`): the pool deeper than a paddle (the shelf's
 * first ≈ 0.45 m is wading), the wall and its parapet, the terrace's open edges (`terraceEdge`),
 * the cliff (and everything behind it), the ivy rock, the gate boulders, the columns and piers.
 * The outcrop eases down to the forest floor, so off its edges the walker simply walks down.
 */
export function ruinsBlocked(x: number, z: number): boolean {
  if (!inBox(RUINS_SITE_BOX, x, z)) return false;
  if (builtBlocked(x, z)) return true;
  const C = R.cliff;
  if (z > C.z0 - 0.5 && z < C.z1 + 0.5 && x < cliffFaceX(z, 1.5) + 0.45 && x > C.x - CLIFF_DEPTH_M - 0.3) return true;
  const Pl = R.pillar;
  if (Math.hypot(x - Pl.x, z - Pl.z) < pillarRadius(Math.atan2(z - Pl.z, x - Pl.x), 0.6) + 0.15) return true;
  return false;
}

/** the pool past a paddle, the wall and its parapet, the terrace's open edges, the gate boulders, the columns and piers */
function builtBlocked(x: number, z: number): boolean {
  if (poolSigned(x, z) < -0.45) return true;
  const W = R.wall;
  if (x > W.x0 - 0.2 && x < W.x1 + 0.12 && Math.abs(z - W.z) < W.half + 0.12) return true;
  if (terraceEdge(x, z)) return true;
  for (const g of R.gate) if (Math.hypot(x - g[0], z - g[1]) < g[2] * 0.85) return true;
  for (const [cx, cz, r] of RUINS_COLUMN_FEET) if (Math.hypot(x - cx, z - cz) < r + 0.12) return true;
  return false;
}

/** how far the walker's centre keeps off the rock's surface (m): the body's radius */
const BODY_M = 0.3;
/**
 * …and off the rock at the follow camera's height (m over the feet): the camera never comes nearer
 * its aim, 1.5 m over the feet, than 0.6 m (camera/collision.ts MIN_DISTANCE) and its near plane is
 * 0.08 m, so with the body's radius alone a view swung toward the cliff or the ivy rock stood the
 * camera up to 0.3 m inside the stone. Checked ±0.5 m to either side for the views swung at an angle.
 */
const CAMERA_ROOM_M = 0.75;
const CAMERA_BAND: readonly [number, number] = [1.1, 1.9];

/**
 * `ruinsBlocked` over the live ground (character/ground.ts): the cliff and the ivy rock held off by
 * their surfaces as built rather than their design lines — the face's furthest reach from the
 * walker's feet to 2 m over them (on the terrace's paving along its west end, else the foot's
 * ground), over the whole mesh including its slumped ends, and the ivy rock's widest radius over
 * the same heights (the mesh stays within 10 % of `pillarRadius`), each plus the body's radius —
 * and at the follow camera's height plus `CAMERA_ROOM_M`, whichever holds him further off.
 * Tabled per 0.1 m of z and per 5° round the rock, filled at first use.
 */
export function createRuinsBlocked(ground: Ground): (x: number, z: number) => boolean {
  const C = R.cliff;
  const T = R.terrace;
  const W = R.wall;
  const Pl = R.pillar;
  const STEP = 0.1;
  const z0 = CLIFF_Z[0] - 0.5;
  const n = Math.ceil((CLIFF_Z[1] + 0.5 - z0) / STEP) + 1;
  const z1 = z0 + (n - 1) * STEP;
  const back = C.x - CLIFF_DEPTH_M - 0.3;
  const reach = new Float64Array(n).fill(NaN);
  const reachAt = (i: number) => {
    if (Number.isNaN(reach[i])) {
      const z = z0 + i * STEP;
      const feet = z > T.z0 && z < W.z - W.half ? T.y : ground(cliffFaceX(z, 2) + 0.9, z);
      let cam = -Infinity;
      for (let j = -5; j <= 5; j++) cam = Math.max(cam, cliffReach(z + j * STEP, feet + CAMERA_BAND[0], feet + CAMERA_BAND[1], ground));
      reach[i] = Math.max(cliffReach(z, feet - 0.2, feet + 2.0, ground) + BODY_M, cam + CAMERA_ROOM_M);
    }
    return reach[i];
  };
  const BINS = 72;
  const radius = new Float64Array(BINS).fill(NaN);
  let foot = NaN;
  let head = NaN;
  const radiusAt = (k: number) => {
    if (Number.isNaN(foot)) {
      foot = Infinity;
      head = -Infinity;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const g = ground(Pl.x + Math.cos(a) * Pl.r, Pl.z + Math.sin(a) * Pl.r);
        foot = Math.min(foot, g);
        head = Math.max(head, g);
      }
      head = Math.max(head, T.y) + 2.0;
    }
    if (Number.isNaN(radius[k])) {
      const a = (k / BINS) * Math.PI * 2;
      let r = 0;
      // the rock's mesh measures `pillarRadius` from its lowest ground (ruins/rock.ts)
      for (let y = foot; y <= head + 1e-6; y += 0.2) r = Math.max(r, pillarRadius(a, y - foot));
      // the camera's band over the ground walked on this side (the terrace's paving or the live
      // ground 1.4 radii out), ±10° of bearing
      const px = Pl.x + Math.cos(a) * Pl.r * 1.4;
      const pz = Pl.z + Math.sin(a) * Pl.r * 1.4;
      const feet = inTerrace(px, pz) ? T.y : ground(px, pz);
      let rc = 0;
      for (let j = -2; j <= 2; j++) {
        for (let y = feet + CAMERA_BAND[0]; y <= feet + CAMERA_BAND[1] + 1e-6; y += 0.1) rc = Math.max(rc, pillarRadius(a + (j * Math.PI * 2) / BINS, y - foot));
      }
      radius[k] = Math.max(r * 1.1 + BODY_M, rc + CAMERA_ROOM_M);
    }
    return radius[k];
  };
  return (x, z) => {
    if (z > z0 && z < z1 && x > back) {
      const f = (z - z0) / STEP;
      const i = Math.floor(f);
      if (x < lerp(reachAt(i), reachAt(i + 1), f - i)) return true;
    }
    if (!inBox(RUINS_SITE_BOX, x, z)) return false;
    if (builtBlocked(x, z)) return true;
    const dx = x - Pl.x;
    const dz = z - Pl.z;
    const d = Math.hypot(dx, dz);
    if (d < Pl.r * 1.8 + BODY_M) {
      const f = ((Math.atan2(dz, dx) / (Math.PI * 2) + 1) % 1) * BINS;
      const k = Math.floor(f) % BINS;
      if (d < lerp(radiusAt(k), radiusAt((k + 1) % BINS), f - Math.floor(f))) return true;
    }
    return false;
  };
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
