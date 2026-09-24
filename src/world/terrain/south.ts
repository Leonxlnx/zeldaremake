/**
 * Round 56 (expansion-south): the geometry of the village's south exit that more than one system
 * reads — the ravine's cross-section, the log tunnel's frame and the far bank's mound, the rope
 * bridge's deck line and the far bank's walk corridor. Pure functions of position over layout.ts
 * `EXPANSION_SOUTH`: the heightfield cuts, raises and paves with them (the LIVE view only), the
 * character ground blocks with them, and structures / vegetation / atmosphere dress along them.
 */
import { EXPANSION_SOUTH, southBridgeFrame, southRavineLine, southTunnelFrame } from '../layout';
import { Noise2D, clamp, smoothstep } from '../util/noise';

const RV = EXPANSION_SOUTH.ravine;
const LINE = southRavineLine();
/** the walls' largest outward wobble (m): the query reaches W + lip + this */
const WOBBLE_OUT = 0.9;

interface Seg {
  ax: number;
  az: number;
  dx: number;
  dz: number;
  len: number;
  /** arc length at the segment's start */
  s0: number;
  wa: number;
  wb: number;
  da: number;
  db: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const SEGS: Seg[] = (() => {
  const out: Seg[] = [];
  let s = 0;
  for (let i = 0; i + 1 < LINE.length; i++) {
    const [ax, az, wa, da] = LINE[i];
    const [bx, bz, wb, db] = LINE[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const m = Math.max(wa, wb) + RV.lip + WOBBLE_OUT + 0.2;
    out.push({ ax, az, dx: bx - ax, dz: bz - az, len, s0: s, wa, wb, da, db, x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m });
    s += len;
  }
  return out;
})();

/** the ravine's total centreline length (m) */
export const RAVINE_LENGTH = SEGS.reduce((n, g) => n + g.len, 0);

/** the XZ box every non-zero ravine query lies in */
export const RAVINE_BOX = SEGS.reduce((b, g) => ({ x0: Math.min(b.x0, g.x0), x1: Math.max(b.x1, g.x1), z0: Math.min(b.z0, g.z0), z1: Math.max(b.z1, g.z1) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });

export interface RavineHit {
  /** horizontal distance to the centreline (m) */
  d: number;
  /** top half width and depth at the closest point */
  W: number;
  D: number;
  /** arc length of the closest point along the centreline (west → east) */
  s: number;
  /** the closest point */
  px: number;
  pz: number;
  /** +1 south of the centreline (the far bank's side), −1 north */
  side: number;
}

/** the closest centreline point within reach of the walls (null outside every segment's reach) */
export function ravineHit(x: number, z: number, out: RavineHit = { d: 0, W: 0, D: 0, s: 0, px: 0, pz: 0, side: 1 }): RavineHit | null {
  if (x < RAVINE_BOX.x0 || x > RAVINE_BOX.x1 || z < RAVINE_BOX.z0 || z > RAVINE_BOX.z1) return null;
  let best = Infinity;
  let bi = -1;
  let bt = 0;
  for (let i = 0; i < SEGS.length; i++) {
    const g = SEGS[i];
    if (x < g.x0 || x > g.x1 || z < g.z0 || z > g.z1) continue;
    const t = clamp(((x - g.ax) * g.dx + (z - g.az) * g.dz) / Math.max(g.len * g.len, 1e-9), 0, 1);
    const d2 = (x - g.ax - g.dx * t) ** 2 + (z - g.az - g.dz * t) ** 2;
    if (d2 < best) {
      best = d2;
      bi = i;
      bt = t;
    }
  }
  if (bi < 0) return null;
  const g = SEGS[bi];
  out.d = Math.sqrt(best);
  out.W = g.wa + (g.wb - g.wa) * bt;
  out.D = g.da + (g.db - g.da) * bt;
  out.s = g.s0 + g.len * bt;
  out.px = g.ax + g.dx * bt;
  out.pz = g.az + g.dz * bt;
  // south of the line (it runs west → east): the tangent's right-hand side in this frame (+z)
  out.side = (x - out.px) * -g.dz + (z - out.pz) * g.dx >= 0 ? 1 : -1;
  return out;
}

const BRIDGE = southBridgeFrame();
const BN = EXPANSION_SOUTH.bridge.north;
/** (x, z) in the bridge's frame: `a` along the axis from the north sill, `c` across (west +) */
export function bridgeLocal(x: number, z: number): { a: number; c: number } {
  const rx = x - BN[0];
  const rz = z - BN[1];
  return { a: rx * BRIDGE.ax + rz * BRIDGE.az, c: rx * BRIDGE.cx + rz * BRIDGE.cz };
}

const wallNoise = new Noise2D('south-ravine/wall');
const ledgeNoise = new Noise2D('south-ravine/ledge');

export interface RavineProfile {
  /** metres cut below the natural ground (0 at and beyond the lip) */
  cut: number;
  /** 0 … 1 depth fraction: 1 on the floor, 0 at the lip */
  g: number;
  /** 0 … 1, peaking mid-wall: the wall's embankment weight (detail passes, splat, dressing) */
  wall: number;
  /** unit fall direction on the wall (toward the centreline) */
  fx: number;
  fz: number;
  /** the wobbled distance to the centreline and the cut's outer edge (both m) */
  dEff: number;
  edge: number;
  hit: RavineHit;
}

const _hit: RavineHit = { d: 0, W: 0, D: 0, s: 0, px: 0, pz: 0, side: 1 };

/**
 * The ravine's cross-section at (x, z): a floor `floorHalfWidth` wide with a shallow channel, a
 * steep rock wall (a doubled smoothstep: ~75° mid-wall), a rounded lip over the last `lip` m.
 * The walls wobble ± 0.6–0.9 m along the gorge (independently on each side); within ~2 m of the
 * bridge axis the wobble is held at 0.3 m OUTWARD, so the lip's shoulder starts ≈ 0.4 m past
 * each sill log and falls away under the deck as fast as the deck sags (a slower shoulder buried
 * the first planks). Null where the ravine does not reach.
 */
export function ravineProfile(x: number, z: number): RavineProfile | null {
  const h = ravineHit(x, z, _hit);
  if (!h || h.D <= 0.01) return null;
  const across = Math.abs(bridgeLocal(x, z).c);
  const guard = smoothstep(1.8, 4.2, across);
  const wob = guard * (0.62 * wallNoise.noise(h.s * 0.11 + (h.side > 0 ? 17.3 : 0), 0.5) + 0.26 * wallNoise.noise(x * 0.43 + 5.1, z * 0.43 - 2.7)) - (1 - guard) * 0.3;
  const dEff = h.d + wob;
  const edge = h.W + RV.lip;
  const inv = h.d > 1e-6 ? 1 / h.d : 0;
  const fx = (h.px - x) * inv;
  const fz = (h.pz - z) * inv;
  if (dEff >= edge) return { cut: 0, g: 0, wall: 0, fx, fz, dEff, edge, hit: h };
  const F = Math.min(RV.floorHalfWidth, 0.3 * h.W);
  const t = clamp((dEff - F) / (edge - F), 0, 1);
  const s1 = t * t * (3 - 2 * t);
  const g = 1 - s1 * s1 * (3 - 2 * s1);
  // rock ledges: the wall steps in and out a little along soft strata (sub-metre, mid-wall only)
  const strata = 0.34 * (4 * g * (1 - g)) * ledgeNoise.fbm(h.s * 0.08 + (h.side > 0 ? 40 : 0), g * 4.2, 2);
  const channel = 0.32 * (1 - smoothstep(0, F * 0.9, h.d)) * smoothstep(2, 5, h.D);
  return { cut: Math.max(0, h.D * g + channel + strata * h.D * 0.12), g, wall: 4 * g * (1 - g), fx, fz, dEff, edge, hit: h };
}

/** metres the ravine cuts below the natural ground at (x, z) — 0 where it does not reach */
export function ravineCut(x: number, z: number): number {
  return ravineProfile(x, z)?.cut ?? 0;
}

const mossNoise = new Noise2D('south-ravine/moss');
/**
 * The moss share of the ravine's walls (0 … 1; the terrain splat paints it over the rock): a
 * drape just under the lip, tongues hanging from it down the fall line — ≈ 1 m wide, each
 * reaching its own depth (a fifth to three quarters of the wall; further on the north-facing
 * far wall, which the sun barely reaches) — and cushions on the strata's gentler ledges
 * (`slope` as the splat reads it, 1 − n.y). Instanced pads on a 75° face read as discs stuck on
 * the rock from across the gorge; the splat's moss takes the face's cushion relief instead.
 */
export function ravineWallMoss(x: number, z: number, slope: number): number {
  const p = ravineProfile(x, z);
  if (!p || p.cut <= 0.01 || p.g >= 0.96) return 0;
  const h = p.hit;
  const u = h.s + (h.side > 0 ? 57.3 : 0);
  const reach = 0.2 + 0.55 * (mossNoise.noise(u * 0.23 + 9.1, 3.3) * 0.5 + 0.5) + (h.side > 0 ? 0.1 : 0);
  const streak = mossNoise.fbm(u * 0.85, p.g * 1.4, 2) * 0.5 + 0.5;
  const tongue = smoothstep(0.46, 0.6, streak) * (1 - smoothstep(reach * 0.55, reach, p.g));
  const drape = 1 - smoothstep(0.04, 0.14 + 0.08 * streak, p.g);
  const ledge = (1 - smoothstep(0.42, 0.62, slope)) * smoothstep(0.35, 0.6, mossNoise.noise(x * 0.9 + 3.7, z * 0.9 - 1.9) * 0.5 + 0.5) * smoothstep(0.1, 0.25, p.g);
  return clamp(Math.max(tongue * 0.92, drape * 0.85, ledge * 0.8), 0, 1);
}

/**
 * True on the far (south) side of the ravine: south of its centreline between its ends, and
 * beyond the ends south of a 45° line from each end node (so the far bank cannot be reached by
 * walking round an end). Every point here is off limits to the walker except the far path's
 * corridor and the log's floor (character/ground.ts).
 */
export function southOfRavine(x: number, z: number): boolean {
  const first = LINE[0];
  const last = LINE[LINE.length - 1];
  if (z < Math.min(first[1], last[1]) - 20) return false;
  if (x <= first[0]) return z > first[1] + (first[0] - x);
  if (x >= last[0]) return z > last[1] + (x - last[0]);
  // the smoothed line runs monotonically west → east: its z at x
  let lo = 0;
  let hi = LINE.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (LINE[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [ax, az] = LINE[lo];
  const [bx, bz] = LINE[hi];
  const zl = az + ((bz - az) * (x - ax)) / Math.max(bx - ax, 1e-9);
  return z > zl;
}

const TF = southTunnelFrame();
const TM = EXPANSION_SOUTH.tunnel.mouth;
/** (x, z) in the log tunnel's frame: `a` along the axis from the mouth into the bank, `c` across (west +) */
export function tunnelLocal(x: number, z: number): { a: number; c: number } {
  const rx = x - TM[0];
  const rz = z - TM[1];
  return { a: rx * TF.ax + rz * TF.az, c: rx * TF.cx + rz * TF.cz };
}
/** world xz of tunnel-frame (a, c) */
export function tunnelWorld(a: number, c: number): [number, number] {
  return [TM[0] + TF.ax * a + TF.cx * c, TM[1] + TF.az * a + TF.cz * c];
}

const bankNoise = new Noise2D('south-bank/lumps');

/**
 * The far bank's mound over the plain at tunnel-frame (a, c) (m; layout `tunnel.mound`): the
 * shoulders beside the log's trough and the face / plateau behind it. Past the trough the bank is
 * uneven — broad swells (± 20 % of the body) and knobs (± 0.35 m) — and none of it reaches back
 * within `shoulder[1] − 0.3` m of the axis, where the 1 m lattice has to keep off the shell.
 */
export function moundHeight(a: number, c: number): number {
  const M = EXPANSION_SOUTH.tunnel.mound;
  if (a <= M.rise || a >= M.back) return 0;
  const ac = Math.abs(c);
  const width = 1 - smoothstep(M.halfTop, M.halfBase, ac);
  if (width <= 0) return 0;
  const back = a > M.crest ? 1 - smoothstep(M.crest, M.back, a) : 1;
  const plateau = a < M.face[1] ? smoothstep(M.face[0], M.face[1], a) : back;
  const shoulder = smoothstep(M.rise, M.face[0], a) * smoothstep(M.shoulder[0], M.shoulder[1], ac) * back;
  const body = Math.max(plateau, shoulder) * width;
  const away = smoothstep(M.shoulder[1] - 0.3, M.shoulder[1] + 1.7, ac);
  let h = M.height * body;
  if (away > 0) {
    const swell = bankNoise.fbm(a * 0.16 + c * 0.05, c * 0.17 + 3.1, 2);
    const knobs = bankNoise.noise(a * 0.3 + 11.7, c * 0.3 - 4.3);
    h = Math.max(0, M.height * body * (1 + 0.2 * away * swell) + 0.35 * away * body * knobs);
  }
  const k = cleftWeight(a, c);
  return k > 0 ? h + (Math.min(h, EXPANSION_SOUTH.tunnel.cleft.lift) - h) * k : h;
}

const cleftNoise = new Noise2D('south-bank/cleft');
/**
 * The cleft behind the log's end (layout `tunnel.cleft`; 0 … 1): 1 on its bed, easing to 0 up its
 * walls. The bed widens from `floor[0]` at the log's end to `floor[1]` at the bank's back, the
 * walls wander (± 0.35 m) so the cut reads as worn, not ruled.
 */
export function cleftWeight(a: number, c: number): number {
  const T = EXPANSION_SOUTH.tunnel;
  const K = T.cleft;
  if (a <= K.from) return 0;
  const along = smoothstep(K.from, K.from + 0.6, a);
  const half = K.floor[0] + (K.floor[1] - K.floor[0]) * smoothstep(K.from + 0.5, T.mound.back, a) + 0.35 * cleftNoise.noise(a * 0.45, c > 0 ? 3.1 : 7.9);
  return along * (1 - smoothstep(half, half + K.wall, Math.abs(c)));
}

/**
 * Metres from (x, z) out past the widest the ravine's lip can reach (its wall wobble included);
 * Infinity farther than `reach` beyond that, or where the gorge has closed to nothing.
 */
function lipGap(x: number, z: number, reach: number): number {
  let best = Infinity;
  for (const g of SEGS) {
    if (x < g.x0 - reach || x > g.x1 + reach || z < g.z0 - reach || z > g.z1 + reach) continue;
    const t = clamp(((x - g.ax) * g.dx + (z - g.az) * g.dz) / Math.max(g.len * g.len, 1e-9), 0, 1);
    if (g.da + (g.db - g.da) * t <= 0.01) continue;
    const d = Math.hypot(x - g.ax - g.dx * t, z - g.az - g.dz * t);
    best = Math.min(best, d - (g.wa + (g.wb - g.wa) * t + RV.lip + WOBBLE_OUT));
  }
  return best;
}

/** metres over which the far bank's rise eases out before the ravine's outermost lip */
const BANK_LIP_FADE = 2.2;
/**
 * The far bank's rise at world (x, z): `moundHeight`, eased to nothing over the last
 * `BANK_LIP_FADE` m before the ravine's outermost lip — the gorge is cut into the plain (the cut
 * is measured from the ground it lands on, so a bank over the lip would lift the floor).
 */
export function bankHeight(x: number, z: number): number {
  const t = tunnelLocal(x, z);
  const m = moundHeight(t.a, t.c);
  if (m <= 0) return 0;
  return m * smoothstep(0, BANK_LIP_FADE, lipGap(x, z, BANK_LIP_FADE + 0.5));
}

/** the berm's crest under the log's axis (m): the flanks' earth meets the bark a hand under its widest girth */
export const BERM_BELOW_AXIS = 0.75;
/**
 * The earth banked against the log's flanks (weight 0 … 1, applied as a raise toward the crest
 * height): from just inside the hollow's radius (the carve wins there) out to ~1.7 m past the
 * bark, from the mouth rim to the bank's face. On the 1 m lattice the raised points sit at
 * |c| ≥ 1.75, where no interpolated slope reaches the hollow (probe: ≥ 0.2 m clear).
 */
export function tunnelBerm(a: number, c: number): number {
  const T = EXPANSION_SOUTH.tunnel;
  if (a < -0.4 || a > T.mound.face[1]) return 0;
  const ac = Math.abs(c);
  return smoothstep(-0.4, 0.3, a) * smoothstep(T.innerRadius - 0.2, T.innerRadius + 0.3, ac) * (1 - smoothstep(T.outerRadius + 0.65, T.outerRadius + 1.75, ac));
}

/**
 * The log's hollow in the terrain: along the carve (a 0.15 … carveEnd, full through the 1 m
 * lattice line at a ≈ 6.1) the ground inside the hollow's radius drops `CARVE_DEPTH` below the
 * floor (the built floor deck covers it), back to the surrounding ground within 0.1 m outside
 * the inner wall. Narrow on purpose: every lattice point outside the hollow keeps the natural
 * ground, so the bark meets it without a trench and no interpolated slope rises into the hollow.
 * Returns the weight (0 … 1) and the carved height for surrounding `h`.
 */
export const CARVE_DEPTH = 0.5;
export function tunnelCarve(a: number, c: number, h: number, floorY: number): { w: number; y: number } {
  const T = EXPANSION_SOUTH.tunnel;
  const wA = smoothstep(0.15, 0.5, a) * (1 - smoothstep(T.carveEnd, T.carveEnd + 0.4, a));
  // under the bank's face (from the lattice line at a ≈ 7.1 on) the natural ground is the face's
  // full height, and a lattice column only partly carved there would stand inside the hollow: the
  // carve takes the whole bore (the nearest columns sit at |c| ≈ 1.46 … 1.57)
  const wide = smoothstep(6.4, 6.95, a);
  const c0 = T.innerRadius - 0.2 + 0.24 * wide;
  const c1 = T.innerRadius + 0.1 + 0.2 * wide;
  const ac = Math.abs(c);
  if (wA <= 0 || ac >= c1) return { w: 0, y: h };
  const base = floorY - CARVE_DEPTH;
  const y = ac <= c0 ? base : base + ((ac - c0) / (c1 - c0)) * (h - base);
  return { w: wA, y: Math.min(h, y) };
}

/** the log's footprint (its shell's plan, a hair wide): 1 inside */
export function tunnelFootprint(a: number, c: number): number {
  const T = EXPANSION_SOUTH.tunnel;
  if (a < -0.45 || a > T.length + 0.1) return 0;
  return Math.abs(c) <= T.outerRadius + 0.15 ? 1 : 0;
}

/**
 * The deck's top line at `a` m along the bridge axis from the north sill: the straight line
 * between the two sill tops (`yN`, `yS` — each sill's ground + `bridge.sill`) sagging `sag` m at
 * mid-span on a parabola (a rope bridge's catenary at this sag-to-span ratio). Structures builds
 * the planks on it; the character ground walks the planks as built (`walkSpans`).
 */
export function bridgeDeckY(a: number, yN: number, yS: number): number {
  const B = EXPANSION_SOUTH.bridge;
  const u = clamp(a / BRIDGE.len, 0, 1);
  return yN + (yS - yN) * u - B.sag * 4 * u * (1 - u);
}

/** the far path's corridor on the far bank (the walker's only ground there besides the log's floor): distance to the south sill → mouth line ≤ half width + 0.25, or within the mouth's apron */
export function inFarCorridor(x: number, z: number): boolean {
  const pts = EXPANSION_SOUTH.farPath;
  const hw = EXPANSION_SOUTH.farPathHalfWidth + 0.25;
  const line: [number, number][] = [...pts.map((p) => [p[0], p[2]] as [number, number]), [TM[0], TM[1]]];
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(dx * dx + dz * dz, 1e-9), 0, 1);
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= hw) return true;
  }
  const { a, c } = tunnelLocal(x, z);
  return a < 0.2 && a > -2.2 && Math.abs(c) < 1.9;
}
