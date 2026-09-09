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
  /**
   * Ground height of the RENDERED surface: barycentric interpolation of the fixed lattice the
   * terrain mesh is built from (see `LATTICE`), so a point placed at `height(x, z)` sits on the
   * triangles exactly. Pure function of position (lattice samples are cached by integer index).
   */
  height(x: number, z: number): number;
  /** Normal of the same interpolated surface (central difference over one detail-lattice step). */
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

/**
 * The main run's north-west embankment (toward Saria's terrace): a flush grass lip `lip` m
 * beyond the tread ends, then a bank falling `slope` m per metre (0.8 ≈ 39°, grass-safe).
 */
const NW_BANK = { lip: 0.35, slope: 0.8 };

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

  // East plateau: the hero stairs climb its west face. Ramp direction follows the main stair.
  const ms = stairFrames[0];
  const { u: su, v: sv } = stairLocal(ms, x, z);
  // 1 alongside the run (fades in before the bottom step, out past the top landing)
  const alongRun = smoothstep(-2.5, -0.5, su) * (1 - smoothstep(ms.run - 0.5, ms.run + 2.5, su));

  // gentle base undulation — damped beside the main run: its embankments are built banks that
  // hug the ruler-straight ramp, so the ±0.5 m landform waviness must not surface as bumps and
  // catch-up cliffs at the bank edges (it returns ~3 m out from the treads)
  const corridor = alongRun * (1 - smoothstep(ms.halfWidth + 0.3, ms.halfWidth + 3.2, Math.abs(sv)));
  const base = (macro.fbm(x * 0.021, z * 0.021, 3) * 0.75 + medium.fbm(x * 0.07, z * 0.07, 3) * 0.22) * (1 - 0.85 * corridor);

  const eastRamp = smoothstep(-1.5, ms.run + 1.5, su);
  const eastZone = smoothstep(14, -32, z) * smoothstep(-36, -26, z) + smoothstep(-32, 14, z) * smoothstep(16, 8, z);
  let east = T.eastPlateau.height * eastRamp * clamp(eastZone, 0, 1) * smoothstep(3.5, 9, x);
  // North-west flank of the run (v < 0, the house side): the ramp does not carry on as a shelf
  // toward Saria's terrace (1.2 m) — from the flush lip at the tread ends (+0.07) it falls at
  // ~39° (0.8 m per metre; see NW_BANK) so the flank reads as one continuous grassy embankment
  // down to the door path instead of a hump cut by the house pad. Past the top step the plateau
  // is full width again (the fence runs sit on it).
  const nwBeyond = -sv - (ms.halfWidth + NW_BANK.lip);
  if (nwBeyond > 0 && east > 0) {
    east = Math.max(0, east - alongRun * (nwBeyond * NW_BANK.slope - 0.07));
  }

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

/**
 * Log-arch frame. Mirrors `structures/logArch.ts`: the axis runs east (slightly north) through
 * `layout.logArch.position`; its west third bends south by up to 1.8 m (quadratic for
 * s < −0.15·L) so the broken hollow end faces the path. `lu` is the along-axis coordinate,
 * `lvc` the across coordinate measured from the BENT axis (positive = south side).
 */
const LOG = (() => {
  const la = LAYOUT.logArch;
  const yaw = (la.yawDeg * Math.PI) / 180;
  return { cx: la.position[0], cz: la.position[2], ax: Math.cos(yaw), az: -Math.sin(yaw), L: la.length, R: la.radius };
})();

function logBend(lu: number) {
  const k = clamp((-LOG.L * 0.15 - lu) / (LOG.L * 0.35), 0, 1);
  return { bend: 1.8 * k * k, k };
}

function logLocal(x: number, z: number) {
  const dx = x - LOG.cx;
  const dz = z - LOG.cz;
  const lu = dx * LOG.ax + dz * LOG.az;
  const lv = -dx * LOG.az + dz * LOG.ax; // along S = (−az, ax), south-ish
  const { bend, k } = logBend(lu);
  return { lu, lvc: lv - bend, k };
}

/** Bent-axis point at along-coordinate `lu` (for the pad height reference). */
function logAxisPoint(lu: number) {
  const { bend } = logBend(lu);
  return { x: LOG.cx + LOG.ax * lu - LOG.az * bend, z: LOG.cz + LOG.az * lu + LOG.ax * bend };
}

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
    // authored y is the design height; add a little long-wavelength undulation so it's not a
    // ruler. Kept to ±2.5 cm over ~4 m: the slabs are seated on the mean height under them and
    // the joint fill hugs the terrain, so anything shorter than a slab (±6 cm at 2 m did it)
    // buries slab edges under the fill and reads as 10–30 cm joints from camera A.
    const pathY = p.y + 0.025 * fine.noise(x * 0.27, z * 0.27);
    h = lerp(h, pathY, p.weight);
  }

  // Structure pads: level the ground under houses. Applied BEFORE the stair ramps so a pad ring
  // can never pull the ground out from under a tread or its bank (Saria's pad reaches the
  // top-left of the main run). The pad raises low ground to the floor but only shaves ≤ 0.35 m
  // off ground that is already above it, so on the plateau side of a trunk the slope simply
  // buries the trunk instead of being cut into a 4 m ring cliff.
  let padW = 0;
  for (const hs of LAYOUT.houses) {
    const d = Math.hypot(x - hs.position[0], z - hs.position[2]);
    const w = 1 - smoothstep(hs.trunkRadius + 0.6, hs.trunkRadius + 2.6, d);
    if (w > 0) {
      const floor = hs.position[1] - 0.05;
      h = lerp(h, Math.max(floor, h - 0.35), w);
      padW = Math.max(padW, w);
    }
  }

  // Stair ramps: keep terrain just under the steps so nothing pokes through.
  let stairW = 0;
  for (const f of stairFrames) {
    const { u, v } = stairLocal(f, x, z);
    if (u > -1.2 && u < f.run + 2.4 && Math.abs(v) < f.halfWidth + 1.3) {
      const ramp = f.baseY + clamp(u / f.run, 0, 1) * f.rise;
      // the under-tread trench starts under the first riser (buried to −0.3), not in front of
      // it, so the flagstone spur meets the bottom step on level ground
      const wu = smoothstep(-0.4, -0.02, u) * smoothstep(f.run + 0.8, f.run + 0.1, u);
      const av = Math.abs(v);
      // under the treads: keep the ground well below the slabs so nothing pokes through
      const wUnder = 1 - smoothstep(f.halfWidth + 0.02, f.halfWidth + 0.34, av);
      h = lerp(h, ramp - 0.18, wu * wUnder);
      // beside the treads: a grass bank that meets the tread ends flush (reference: grass creeps
      // onto the step ends, no kerb), falling back to the natural slope further out. On the
      // main run's north-west side the bank target itself falls away like the landform's
      // embankment (NW_BANK), so the blend never has to catch up across a step.
      const wBank = smoothstep(f.halfWidth + 0.02, f.halfWidth + 0.34, av) * (1 - smoothstep(f.halfWidth + 0.4, f.halfWidth + 1.25, av));
      const nwFall = f === stairFrames[0] && v < 0 ? NW_BANK.slope * Math.max(0, av - f.halfWidth - NW_BANK.lip) : 0;
      h = lerp(h, ramp + 0.07 - nwFall, wu * wBank);
      const wv = 1 - smoothstep(f.halfWidth + 0.15, f.halfWidth + 0.9, av);
      // landing: the ground just past the top step meets the last tread flush (as in the reference)
      const lw = smoothstep(f.run - 0.2, f.run + 0.1, u) * smoothstep(f.run + 2.3, f.run + 1.0, u) * wv;
      h = lerp(h, f.baseY + f.rise - 0.06, lw);
      // wider suppression halo so detail passes fade out before the cheeks
      const su = smoothstep(-1.2, -0.3, u) * smoothstep(f.run + 2.4, f.run + 1.2, u);
      const sv = 1 - smoothstep(f.halfWidth + 0.4, f.halfWidth + 1.3, Math.abs(v));
      stairW = Math.max(stairW, su * sv);
    }
  }

  // Log-arch pad: under the bent west third (the hollow mouth seen from the plaza) the ground
  // follows a smooth reference along the bent axis, slightly dished, so the sunk lip is not
  // half-buried in a hump; ~2 m wider on the south side where the axis bends toward the path.
  let logW = 0;
  {
    const lg = logLocal(x, z);
    if (lg.lu < -LOG.L * 0.08 && lg.lu > -LOG.L / 2 - 2.5 && Math.abs(lg.lvc) < LOG.R + 2.2) {
      const wu = smoothstep(-LOG.L / 2 - 2.2, -LOG.L / 2 + 0.6, lg.lu) * smoothstep(-LOG.L * 0.1, -LOG.L * 0.22, lg.lu);
      const south = lg.lvc > 0 ? 0.6 * lg.k : 0;
      const wv = 1 - smoothstep(LOG.R * 0.9 + south, LOG.R + 1.6 + south, Math.abs(lg.lvc));
      logW = wu * wv;
      if (logW > 0) {
        const ap = logAxisPoint(clamp(lg.lu, -LOG.L / 2, 0));
        const ref = landform(ap.x, ap.z).h - 0.12;
        h = lerp(h, ref, logW * 0.85);
      }
    }
  }

  // how much authored flat surface is here (detail passes fade out on it)
  const suppress = clamp(Math.max(p.surface, stairW, padW, logW), 0, 1);
  return { h, land, p, suppress, logW, embank: land.embank * (1 - suppress) };
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
  // Medium + small breakup, suppressed on paths and under the log-arch mouth.
  const breakup = (1 - Math.max(m.p.surface, m.logW)) * (medium.fbm(x * 0.35, z * 0.35, 3) * 0.14 + fine.noise(x * 1.7, z * 1.7) * 0.035);
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
    // treads plus the two rows of landing slabs past the top step (see hardscape/stairs.ts)
    if (u > -0.3 && u < f.run + 1.7 && Math.abs(v) < f.halfWidth + 0.25) stairs = 1;
  }
  let structure = 0;
  for (const hs of LAYOUT.houses) {
    const d = Math.hypot(x - hs.position[0], z - hs.position[2]);
    structure = Math.max(structure, 1 - smoothstep(hs.trunkRadius + 0.2, hs.trunkRadius + 1.2, d));
  }
  // log arch: follows the bent axis; at the broken west end the mask also reaches ~0.6 m further
  // south (the oblique cut's lip) so no grass grows up the mouth
  const lg = logLocal(x, z);
  if (Math.abs(lg.lu) < LOG.L / 2 + 0.3 * lg.k && lg.lvc > -LOG.R * 0.9 && lg.lvc < LOG.R * 0.9 + 0.6 * lg.k) structure = 1;
  return { path: p.surface, stairs, structure };
}

const _n = new Vector3();

/**
 * Rendered-surface lattice. `height()` is NOT the raw analytic field: it is the piecewise-linear
 * surface the terrain mesh renders, so a point that "sits on the terrain" per this sampler sits
 * on the rendered triangles exactly. Three nested zones mirror the three chunk rings:
 *   detail zone |x|,|z| ≤ 48 m: 0.2 m lattice;  mid zone ≤ 144 m: 1 m;  outer: 4 m.
 * Lattice samples are `rawHeight` at the lattice point, rounded to float32 (the mesh stores
 * float32) and cached by integer lattice coordinates, so no memo can alias between query points
 * and the result is a pure function of position. Each cell is split into two triangles along the
 * diagonal chosen by the parity of the global lattice indices — identical to the chunk builder.
 * Where a finer ring meets a coarser one, the fine edge samples are the linear interpolation of
 * the coarse edge (the same T-junction stitch the mesh uses).
 */
export const LATTICE = {
  /** detail-zone spacing (m) and half extent in lattice units (48 m) */
  detail: { spacing: 0.2, half: 240 },
  /** mid ring: 1 m spacing out to 144 m */
  mid: { spacing: 1, half: 144 },
  /** outer ring: 4 m spacing out to the world half size */
  outer: { spacing: 4, half: Math.round(WORLD.terrainHalfSize / 4) },
  /** ratio of neighbouring spacings (fine edge vertices per coarse edge segment) */
  ratioDetailMid: 5,
  ratioMidOuter: 4,
} as const;

type Zone = 0 | 1 | 2;
const ZONES = [LATTICE.detail, LATTICE.mid, LATTICE.outer];

export function latticeZone(x: number, z: number): Zone {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax <= LATTICE.detail.half * LATTICE.detail.spacing && az <= LATTICE.detail.half * LATTICE.detail.spacing) return 0;
  if (ax <= LATTICE.mid.half * LATTICE.mid.spacing && az <= LATTICE.mid.half * LATTICE.mid.spacing) return 1;
  return 2;
}

export function createTerrain(): Terrain {
  const caches: Map<number, number>[] = [new Map(), new Map(), new Map()];
  const KEY = 1 << 20;
  const OFF = 1 << 19;

  /** float32 rawHeight at a lattice point of `zone` (cached by integer lattice coords) */
  const rawSample = (zone: Zone, gi: number, gj: number): number => {
    const key = (gi + OFF) * KEY + (gj + OFF);
    const cache = caches[zone];
    const c = cache.get(key);
    if (c !== undefined) return c;
    const s = ZONES[zone].spacing;
    const h = Math.fround(rawHeight(gi * s, gj * s));
    cache.set(key, h);
    return h;
  };

  /**
   * Lattice sample as the mesh stores it: on the outer boundary line of a zone the fine vertices
   * between two coarse-lattice points are snapped onto the coarse edge (linear interpolation),
   * so the surface is watertight and identical on both sides of the ring seam.
   */
  const sample = (zone: Zone, gi: number, gj: number): number => {
    if (zone === 2) return rawSample(2, gi, gj);
    const Z = ZONES[zone];
    const r = zone === 0 ? LATTICE.ratioDetailMid : LATTICE.ratioMidOuter;
    const onX = Math.abs(gi) === Z.half;
    const onZ = Math.abs(gj) === Z.half;
    if (onX && gj % r !== 0) {
      const j0 = Math.floor(gj / r) * r;
      const t = (gj - j0) / r;
      return Math.fround(rawSample(zone, gi, j0) * (1 - t) + rawSample(zone, gi, j0 + r) * t);
    }
    if (onZ && gi % r !== 0) {
      const i0 = Math.floor(gi / r) * r;
      const t = (gi - i0) / r;
      return Math.fround(rawSample(zone, i0, gj) * (1 - t) + rawSample(zone, i0 + r, gj) * t);
    }
    return rawSample(zone, gi, gj);
  };

  const height = (x: number, z: number) => {
    const zone = latticeZone(x, z);
    const Z = ZONES[zone];
    const s = Z.spacing;
    const fx0 = x / s;
    const fz0 = z / s;
    // cell indices clamped so boundary queries use the last cell inside the zone
    const gi = Math.min(Math.max(Math.floor(fx0), -Z.half), Z.half - 1);
    const gj = Math.min(Math.max(Math.floor(fz0), -Z.half), Z.half - 1);
    const u = fx0 - gi; // 0..1 across the cell (may be exactly 1 on the boundary)
    const v = fz0 - gj;
    const a = sample(zone, gi, gj); // (0,0)
    const b = sample(zone, gi + 1, gj); // (1,0)
    const c = sample(zone, gi, gj + 1); // (0,1)
    const d = sample(zone, gi + 1, gj + 1); // (1,1)
    if ((gi + gj) & 1) {
      // diagonal b–c: triangles (a,c,b) and (b,c,d)
      if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
      return d + (c - d) * (1 - u) + (b - d) * (1 - v);
    }
    // diagonal a–d: triangles (a,c,d) and (a,d,b)
    if (v >= u) return a + (d - c) * u + (c - a) * v;
    return a + (b - a) * u + (d - b) * v;
  };

  /** exact mesh vertex height at lattice point (gi, gj) of `zone` — used by the chunk builder */
  const latticeHeight = (zone: Zone, gi: number, gj: number) => sample(zone, gi, gj);

  const normal = (x: number, z: number, out = _n) => {
    // central difference of the rendered surface over one detail-lattice step
    const e = LATTICE.detail.spacing;
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

  const t: LatticeTerrain = { height, normal, slope, mask, vegetationAllowed, latticeHeight };
  return t;
}

/**
 * `Terrain` plus direct access to the lattice samples (exact mesh vertex heights). The chunk
 * builder uses this so the rendered vertices are bit-identical to what `height()` interpolates.
 */
export interface LatticeTerrain extends Terrain {
  latticeHeight(zone: 0 | 1 | 2, gi: number, gj: number): number;
}

export function isLatticeTerrain(t: Terrain): t is LatticeTerrain {
  return typeof (t as LatticeTerrain).latticeHeight === 'function';
}

/** Convenience singleton — most systems just need one shared terrain. */
let shared: Terrain | null = null;
export function getTerrain(): Terrain {
  if (!shared) shared = createTerrain();
  return shared;
}
