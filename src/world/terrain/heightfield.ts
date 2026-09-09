/**
 * Authored heightfield for Kokiri Forest. This is NOT a random noise plane: the macro shape
 * is composed from the layout (plateaus, terraces, stair ramps, flattened paths) and noise is
 * only used for medium/small breakup. Every system that touches the ground (trees, grass,
 * rocks, structures, stairs) must sample height through this module so contact is exact.
 *
 * Owner: terrain agent. Interface (`Terrain`) is frozen; implementation may be refined.
 */
import { Vector3 } from 'three';
import { LAYOUT } from '../layout';
import { WORLD } from '../config';
import { Noise2D, smoothstep, clamp, lerp } from '../util/noise';

export interface TerrainMask {
  /** 1 on flagstone path surface */
  path: number;
  /** 1 inside a stair footprint */
  stairs: number;
  /** 1 on steep embankment / cliff faces */
  cliff: number;
  /** 1 where structures sit (house pads, log) — no vegetation */
  structure: number;
  /** 1 on the flat terrace/plateau tops */
  plateau: number;
}

export interface Terrain {
  height(x: number, z: number): number;
  normal(x: number, z: number, out?: Vector3): Vector3;
  /** 0 = flat, 1 = vertical */
  slope(x: number, z: number): number;
  mask(x: number, z: number): TerrainMask;
  /** true if vegetation may grow here (not path/stairs/structure/too steep) */
  vegetationAllowed(x: number, z: number): boolean;
}

const macro = new Noise2D(`${WORLD.seed}/macro`);
const medium = new Noise2D(`${WORLD.seed}/medium`);
const fine = new Noise2D(`${WORLD.seed}/fine`);
const hills = new Noise2D(`${WORLD.seed}/hills`);
const erosionNoise = new Noise2D(`${WORLD.seed}/erosion`);
const terraceNoise = new Noise2D(`${WORLD.seed}/terrace`);
const rootNoise = new Noise2D(`${WORLD.seed}/roots`);
const microNoise = new Noise2D(`${WORLD.seed}/micro`);

/**
 * Detail passes layered on the macro landform (W05). Exposed so the terrain material can
 * blend soil/moss/rock exactly where the geometry was eroded, terraced or lifted by roots.
 */
export interface TerrainDetail {
  /** 0..1 how much this point sits on an embankment/ramp face (medium slopes) */
  embank: number;
  /** 0..1 erosion gully depth factor (channels running down the embankments) */
  erosion: number;
  /** 0..1 terrace-step edge factor (little soil ledges on the slopes) */
  terrace: number;
  /** 0..1 proximity to giant-tree roots (raised radial ridges) */
  roots: number;
  /** 0..1 damp/shaded soil (north hollow, foot of the embankments) */
  damp: number;
  /** 0..1 shallow depressions in flat ground */
  hollow: number;
}

/** Number of authored detail passes applied on top of the macro landform (audited by W05). */
export const DETAIL_PASSES = ['erosion-channels', 'terracing', 'depressions', 'root-bumps', 'slope-breakup', 'micro-roughness'];

type P3 = readonly [number, number, number];

function closestOnPolyline(points: readonly P3[], x: number, z: number) {
  let bestD2 = Infinity;
  let bestY = 0;
  let bestT = 0; // 0..1 along the whole polyline
  let acc = 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dz = points[i + 1][2] - points[i][2];
    total += Math.hypot(dx, dz);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0];
    const az = points[i][2];
    const bx = points[i + 1][0];
    const bz = points[i + 1][2];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const seg = Math.sqrt(len2);
    let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = clamp(t, 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestY = lerp(points[i][1], points[i + 1][1], t);
      bestT = (acc + seg * t) / Math.max(total, 1e-6);
    }
    acc += seg;
  }
  return { dist: Math.sqrt(bestD2), y: bestY, t: bestT };
}

interface StairFrame {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  run: number;
  rise: number;
  halfWidth: number;
  baseY: number;
}

const stairFrames: StairFrame[] = LAYOUT.stairs.map((s) => {
  const l = Math.hypot(s.dir[0], s.dir[1]);
  return {
    ox: s.base[0],
    oz: s.base[2],
    dx: s.dir[0] / l,
    dz: s.dir[1] / l,
    run: s.steps * s.tread,
    rise: s.steps * s.rise,
    halfWidth: s.width / 2,
    baseY: s.base[1],
  };
});

/** Project point into a stair's local frame: u along ascent, v across. */
function stairLocal(f: StairFrame, x: number, z: number) {
  const rx = x - f.ox;
  const rz = z - f.oz;
  const u = rx * f.dx + rz * f.dz;
  const v = -rx * f.dz + rz * f.dx;
  return { u, v };
}

/** Macro landform without paths/stairs. Returned as height and the "plateau-ness". */
function landform(x: number, z: number) {
  const T = LAYOUT.terraces;

  // gentle base undulation
  const base = macro.fbm(x * 0.021, z * 0.021, 3) * 0.75 + medium.fbm(x * 0.07, z * 0.07, 3) * 0.22;

  // East plateau: the hero stairs climb its west face. Ramp direction follows the main stair.
  const ms = stairFrames[0];
  const { u: su } = stairLocal(ms, x, z);
  const eastRamp = smoothstep(-1.5, ms.run + 1.5, su);
  const eastZone = smoothstep(14, -32, z) * smoothstep(-36, -26, z) + smoothstep(-32, 14, z) * smoothstep(16, 8, z);
  const east = T.eastPlateau.height * eastRamp * clamp(eastZone, 0, 1) * smoothstep(3.5, 9, x);

  // West ledge with a soft embankment toward the path.
  const west = T.westLedge.height * smoothstep(-5.5, -10, x) * smoothstep(13, 6, z) * smoothstep(-30, -20, z);
  const westNorth = T.westLedge.height * 0.8 * smoothstep(-5.5, -10, x) * smoothstep(-20, -34, z);

  // North terrace (beyond the small steps) rising gently toward the log arch.
  const north = T.northTerrace.height * smoothstep(-13.5, -17.5, z) + 0.9 * smoothstep(-20, -44, z);

  // House terrace (north-east of the plaza).
  const house = T.houseTerrace.height * smoothstep(-7.5, -11, z) * smoothstep(2.5, 6.5, x) * smoothstep(19, 12, x);

  let h = base + Math.max(east, west, westNorth, north, house);

  // Far hills: only beyond the detail radius; big soft forms with a few ridges.
  const r = Math.hypot(x, z);
  const hillMask = smoothstep(60, 150, r);
  const hillsH = 7 + 16 * (hills.fbm(x * 0.007 + 3.1, z * 0.007 - 1.7, 4) * 0.5 + 0.5) + 6 * hills.ridged(x * 0.012, z * 0.012, 3);
  h += hillMask * hillsH;

  const plateau = clamp(Math.max(east / T.eastPlateau.height, west / T.westLedge.height, house / T.houseTerrace.height), 0, 1);

  // Embankment factor: peaks half-way up each plateau ramp (where the ground is steep),
  // weighted by the plateau height so the 5.4 m east face erodes more than the 1.2 m terraces.
  const edgeOf = (w: number, hgt: number) => 4 * w * (1 - w) * clamp(hgt / T.eastPlateau.height, 0.35, 1);
  const embank = clamp(
    Math.max(
      edgeOf(east / T.eastPlateau.height, T.eastPlateau.height),
      edgeOf(Math.max(west, westNorth) / T.westLedge.height, T.westLedge.height),
      edgeOf(house / T.houseTerrace.height, T.houseTerrace.height),
      edgeOf(clamp(north / (T.northTerrace.height + 0.9), 0, 1), T.northTerrace.height + 0.9) * 0.8,
    ),
    0,
    1,
  );
  return { h, plateau, east, west: Math.max(west, westNorth), north, house, embank };
}

/** Paved plaza around the origin (reference frame 14): the flagstone disc where Link stands. */
export const PLAZA = { x: 0, z: 0, radius: 6.0 };

function pathInfluence(x: number, z: number) {
  const hw = LAYOUT.pathHalfWidth;
  const a = closestOnPolyline(LAYOUT.pathSpine, x, z);
  const b = closestOnPolyline(LAYOUT.pathToStairs, x, z);
  const c = closestOnPolyline(LAYOUT.pathToHouse, x, z);
  // pick the branch that dominates
  let best = a;
  let bhw = hw;
  if (b.dist - hw * 0.8 < best.dist - bhw) {
    best = b;
    bhw = hw * 0.8;
  }
  if (c.dist - hw * 0.7 < best.dist - bhw) {
    best = c;
    bhw = hw * 0.7;
  }
  let weight = 1 - smoothstep(bhw * 0.8, bhw * 1.9, best.dist);
  let surface = 1 - smoothstep(bhw * 0.85, bhw * 1.05, best.dist);
  let y = best.y;
  // plaza disc: paved surface out to PLAZA.radius, flattened a little beyond it
  const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  const plazaSurface = 1 - smoothstep(PLAZA.radius * 0.85, PLAZA.radius * 1.05, dp);
  const plazaWeight = 1 - smoothstep(PLAZA.radius * 0.9, PLAZA.radius * 1.45, dp);
  if (plazaWeight > weight) {
    y = lerp(y, 0, (plazaWeight - weight) / Math.max(plazaWeight, 1e-6));
    weight = plazaWeight;
  }
  surface = Math.max(surface, plazaSurface);
  return { weight, surface, y, dist: best.dist };
}

/** Macro landform + authored flattening (paths, stair ramps, house pads). No detail yet. */
function macroHeight(x: number, z: number) {
  const land = landform(x, z);
  let h = land.h;

  // Path flattening — blend toward the authored path height profile.
  const p = pathInfluence(x, z);
  if (p.weight > 0) {
    // authored y is the design height; add a little of the local undulation so it's not a ruler.
    const pathY = p.y + 0.06 * fine.noise(x * 0.5, z * 0.5);
    h = lerp(h, pathY, p.weight);
  }

  // Stair ramps: keep terrain just under the steps so nothing pokes through.
  let stairW = 0;
  for (const f of stairFrames) {
    const { u, v } = stairLocal(f, x, z);
    if (u > -1.2 && u < f.run + 2.4 && Math.abs(v) < f.halfWidth + 1.3) {
      const rampY = f.baseY + clamp(u / f.run, 0, 1) * f.rise - 0.18;
      const wu = smoothstep(-0.8, -0.1, u) * smoothstep(f.run + 0.8, f.run + 0.1, u);
      const wv = 1 - smoothstep(f.halfWidth + 0.15, f.halfWidth + 0.9, Math.abs(v));
      h = lerp(h, rampY, wu * wv);
      // landing: the ground just past the top step meets the last tread flush (as in the reference)
      const lw = smoothstep(f.run - 0.2, f.run + 0.1, u) * smoothstep(f.run + 2.3, f.run + 1.0, u) * wv;
      h = lerp(h, f.baseY + f.rise - 0.06, lw);
      // wider suppression halo so detail passes fade out before the cheeks
      const su = smoothstep(-1.2, -0.3, u) * smoothstep(f.run + 2.4, f.run + 1.2, u);
      const sv = 1 - smoothstep(f.halfWidth + 0.4, f.halfWidth + 1.3, Math.abs(v));
      stairW = Math.max(stairW, su * sv);
    }
  }

  // Structure pads: flatten under houses so they sit level.
  let padW = 0;
  for (const hs of LAYOUT.houses) {
    const d = Math.hypot(x - hs.position[0], z - hs.position[2]);
    const w = 1 - smoothstep(hs.trunkRadius + 0.6, hs.trunkRadius + 2.6, d);
    if (w > 0) {
      h = lerp(h, hs.position[1] - 0.05, w);
      padW = Math.max(padW, w);
    }
  }

  // how much authored flat surface is here (detail passes fade out on it)
  const suppress = clamp(Math.max(p.surface, stairW, padW), 0, 1);
  return { h, land, p, suppress, embank: land.embank * (1 - suppress) };
}

/** Direction of steepest descent of the macro landform (finite differences). */
function macroDownslope(x: number, z: number, e = 0.6) {
  const hx = landform(x + e, z).h - landform(x - e, z).h;
  const hz = landform(x, z + e).h - landform(x, z - e).h;
  const l = Math.hypot(hx, hz);
  if (l < 1e-5) return { dx: 1, dz: 0, grad: 0 };
  return { dx: -hx / l, dz: -hz / l, grad: l / (2 * e) };
}

/**
 * Detail passes (W05). Each returns a height delta; the sum is added to the macro height.
 * All passes fade out on authored flat surfaces (paths, stairs, house pads).
 */
function detailPasses(x: number, z: number, m: ReturnType<typeof macroHeight>) {
  const open = 1 - m.suppress;
  let dh = 0;
  let erosion = 0;
  let terrace = 0;

  // 1. Erosion channels + 2. terracing on embankments: work in the slope frame so gullies run downhill.
  if (m.embank > 0.03) {
    const ds = macroDownslope(x, z);
    const a = x * ds.dx + z * ds.dz; // along slope
    const c = -x * ds.dz + z * ds.dx; // across slope
    const gully = erosionNoise.ridged(c * 1.35 + 11.3, a * 0.28 - 4.1, 3); // 0..1, elongated downhill
    const gullyShape = smoothstep(0.35, 0.95, gully);
    erosion = gullyShape * m.embank;
    dh -= 0.26 * erosion;

    // terracing: soften the macro height toward quantised steps (soil ledges), noise-modulated
    const stepH = 0.55 + 0.25 * terraceNoise.noise(x * 0.05, z * 0.05);
    const q = Math.round(m.land.h / stepH) * stepH;
    const tAmt = m.embank * (0.28 + 0.3 * terraceNoise.fbm(x * 0.21 + 3.7, z * 0.21, 2));
    const tDelta = (q - m.land.h) * clamp(tAmt, 0, 0.7);
    // ledge edge factor: strongest where we are near the riser of a terrace step
    const frac = Math.abs(((m.land.h / stepH) % 1 + 1) % 1 - 0.5) * 2; // 0 at mid-step, 1 at riser
    terrace = m.embank * smoothstep(0.55, 1, frac);
    dh += tDelta;

    // 5. slope breakup: medium-frequency lumps so the ramps are not planar
    dh += m.embank * 0.11 * medium.fbm(x * 0.55 + 21, z * 0.55 - 9, 2);
  }

  // 3. shallow depressions on flat open ground
  const dep = smoothstep(0.28, 0.72, medium.fbm(x * 0.11 + 7.5, z * 0.11 - 3.2, 2) * 0.5 + 0.5);
  const hollow = dep * (1 - m.embank) * open * (1 - 0.65 * m.land.plateau);
  dh -= 0.12 * hollow;

  // 4. root bumps around the giant trees: radial ridges + a low mound
  let roots = 0;
  for (const g of LAYOUT.giantTrees) {
    const R = g.trunkRadius;
    const rx = x - g.position[0];
    const rz = z - g.position[2];
    const d = Math.hypot(rx, rz);
    if (d > 3.4 * R) continue;
    const th = Math.atan2(rz, rx);
    const k = 5 + (hashAngle(g.id) % 3); // 5..7 radial roots
    const wobble = 0.55 * rootNoise.noise(rx * 0.6 + 4, rz * 0.6);
    const ridge = Math.pow(Math.max(0, Math.cos(th * k + hashAngle(g.id) * 0.37 + wobble)), 2.6);
    const fall = smoothstep(3.3 * R, 0.8 * R, d);
    const mound = 0.1 * R * (1 - smoothstep(0, 2.6 * R, d));
    const amt = (0.22 * R * fall * (0.25 + 0.75 * ridge) + mound) * open;
    dh += amt;
    roots = Math.max(roots, fall * (0.4 + 0.6 * ridge) * open);
  }

  // 6. micro roughness (soil grain) — a few millimetres to a centimetre, everywhere but the flat pads
  dh += open * (0.012 * microNoise.noise(x * 4.3, z * 4.3) + 0.006 * microNoise.noise(x * 9.1 + 5.5, z * 9.1 - 2.5));

  // damp soil: north hollow + the foot of the embankments (low relative height, shaded)
  const northHollow = smoothstep(-13, -20, z) * smoothstep(-40, -30, z) * smoothstep(9, 4, Math.abs(x - 1.5));
  const foot = smoothstep(0.02, 0.22, m.embank) * (1 - smoothstep(0.5, 0.85, m.land.plateau));
  const damp = clamp(Math.max(northHollow * 0.9, foot * 0.35, hollow * 0.45) * (0.75 + 0.25 * (medium.fbm(x * 0.3, z * 0.3, 2) * 0.5 + 0.5)), 0, 1);

  return { dh, detail: { embank: m.embank, erosion, terrace, roots, damp, hollow } as TerrainDetail };
}

function hashAngle(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

function rawHeight(x: number, z: number): number {
  const m = macroHeight(x, z);
  let h = m.h;
  // Medium + small breakup, suppressed on paths and stairs.
  const breakup = (1 - m.p.surface) * (medium.fbm(x * 0.35, z * 0.35, 3) * 0.14 + fine.noise(x * 1.7, z * 1.7) * 0.035);
  h += breakup;
  h += detailPasses(x, z, m).dh;
  return h;
}

/** Detail-pass factors at a point (for material layering / placement). Not cached. */
export function terrainDetail(x: number, z: number): TerrainDetail {
  return detailPasses(x, z, macroHeight(x, z)).detail;
}

/**
 * Cheap subset of `Terrain.mask` (no slope evaluation): paved surface, stair footprint and
 * structure pads. Used by placement loops that call it tens of thousands of times.
 */
export function surfaceMask(x: number, z: number): { path: number; stairs: number; structure: number } {
  const p = pathInfluence(x, z);
  let stairs = 0;
  for (const f of stairFrames) {
    const { u, v } = stairLocal(f, x, z);
    if (u > -0.3 && u < f.run + 0.3 && Math.abs(v) < f.halfWidth + 0.25) stairs = 1;
  }
  let structure = 0;
  for (const hs of LAYOUT.houses) {
    const d = Math.hypot(x - hs.position[0], z - hs.position[2]);
    structure = Math.max(structure, 1 - smoothstep(hs.trunkRadius + 0.2, hs.trunkRadius + 1.2, d));
  }
  const la = LAYOUT.logArch;
  const ldx = x - la.position[0];
  const ldz = z - la.position[2];
  const yaw = (la.yawDeg * Math.PI) / 180;
  const lu = ldx * Math.cos(yaw) - ldz * Math.sin(yaw);
  const lv = ldx * Math.sin(yaw) + ldz * Math.cos(yaw);
  if (Math.abs(lu) < la.length / 2 && Math.abs(lv) < la.radius * 0.9) structure = 1;
  return { path: p.surface, stairs, structure };
}

const _n = new Vector3();

export function createTerrain(): Terrain {
  const cache = new Map<number, number>();
  const CELL = 0.05;
  const height = (x: number, z: number) => {
    // memoise on a fine grid: placement systems sample the same spots repeatedly
    const kx = Math.round(x / CELL);
    const kz = Math.round(z / CELL);
    const key = kx * 1048576 + kz;
    const c = cache.get(key);
    if (c !== undefined) return c;
    const h = rawHeight(x, z);
    if (cache.size < 4_000_000) cache.set(key, h);
    return h;
  };

  const normal = (x: number, z: number, out = _n) => {
    const e = 0.25;
    const hl = height(x - e, z);
    const hr = height(x + e, z);
    const hd = height(x, z - e);
    const hu = height(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  };

  const slope = (x: number, z: number) => {
    const n = normal(x, z, new Vector3());
    return 1 - clamp(n.y, 0, 1);
  };

  const mask = (x: number, z: number): TerrainMask => {
    const sm = surfaceMask(x, z);
    const s = slope(x, z);
    const land = landform(x, z);
    return {
      path: sm.path,
      stairs: sm.stairs,
      cliff: smoothstep(0.5, 0.75, s),
      structure: sm.structure,
      plateau: land.plateau * (1 - smoothstep(0.15, 0.35, s)),
    };
  };

  const vegetationAllowed = (x: number, z: number) => {
    const m = mask(x, z);
    return m.path < 0.5 && m.stairs < 0.5 && m.structure < 0.5 && m.cliff < 0.8;
  };

  return { height, normal, slope, mask, vegetationAllowed };
}

/** Convenience singleton — most systems just need one shared terrain. */
let shared: Terrain | null = null;
export function getTerrain(): Terrain {
  if (!shared) shared = createTerrain();
  return shared;
}
