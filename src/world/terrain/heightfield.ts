/**
 * Authored heightfield for Kokiri Forest. This is NOT a random noise plane: the macro shape
 * is composed from the layout (plateaus, terraces, stair ramps, flattened paths) and noise is
 * only used for medium/small breakup. Every system that touches the ground (trees, grass,
 * rocks, structures, stairs) must sample height through this module so contact is exact.
 *
 * Owner: terrain agent. Interface (`Terrain`) is frozen; implementation may be refined.
 */
import { Vector3 } from 'three';
import { EAST_BOX, eastDeckPlan, eastHouseBlocks, eastShopSpots, eastSteppingStones, EXPANSION, EXPANSION_BOX, EXPANSION_EAST, EXPANSION_SOUTH, EXPANSION_SOUTH_BOXES, EXPANSION_STAIRS, expansionSteppingStones, houseSteppingStones, inExpansionRuins, inExpansionSouth, LAYOUT, southBankFrameVectors, southBridgeFrame, southPathHalfWidth, southPathLine, type StairDef } from '../layout';
import { WORLD } from '../config';
import { Noise2D, smoothstep, clamp, lerp } from '../util/noise';
import { BERM_BELOW_AXIS, bankHeight, bridgeDeckY, bridgeLocal, ravineProfile, tunnelBerm, tunnelCarve, tunnelFootprint, tunnelLocal } from './south';
import { buildTrailProfile, inStairCut, poolSigned, ruinsLandform, ruinsStructure, trailHalfWidth, trailInfluence, trailNearest } from './ruins';

/**
 * Round 49 (expansion-2): the heightfield has two VIEWS of the same world.
 *  - `live`   — everything, including the round-49 expansion (layout.ts `EXPANSION`: the south
 *               bank's landform, the two new flights' trenches and banks, the stepping discs' paved
 *               surface, the west house's and far hut's structure pads). The terrain MESH renders
 *               this view; hardscape, structures and the character ground build on it.
 *  - `legacy` — the world as take-0121 left it: no expansion feature in the height, the masks or
 *               the detail. The trees, rocks, vegetation and props systems build against THIS view
 *               (src/world/index.ts hands them `getLegacyTerrain()`): their rejection-sampled
 *               streams read height / slope / mask over the whole 45 m disc, and one changed
 *               sample re-rolls every placement after it in all six fixed frames. Outside the
 *               expansion footprints the two views are the same numbers (the lattice caches are
 *               shared there, `LIVE_HEIGHT_BOX`), so a legacy-placed plant still sits on the
 *               rendered ground everywhere except inside the bank and the two flights, where it is
 *               buried — the vegetation lane switches to the live view when it re-tunes.
 */
export type TerrainView = 'live' | 'legacy';

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
  /**
   * 0..1 on the authored south bank of the main stair (S_BANK): a turfed bank whose ~50° face
   * stays grass instead of turning to the soil/rock the splat gives natural slopes that steep.
   */
  bank: number;
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
  id: string;
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  run: number;
  rise: number;
  halfWidth: number;
  baseY: number;
  /** how far the approach banks up against the first riser (m; FOOT_BANK.rise on the main run, 0 = none) */
  footBank: number;
  /** a paved apron in front of the first riser (the path's flagstones lap the foot) */
  apron: boolean;
  /**
   * length of the landing slabs past the top step (m; hardscape/stairs.ts lays two rows, 1.62 m,
   * on the main and north runs and one row, 0.78 m, on the house-west flight — its head is
   * Saria's turf yard, and a long paved landing there showed as a grey band beside Link in B)
   */
  landing: number;
}

function stairFrameOf(s: StairDef): StairFrame {
  const l = Math.hypot(s.dir[0], s.dir[1]);
  return {
    id: s.id,
    ox: s.base[0],
    oz: s.base[2],
    dx: s.dir[0] / l,
    dz: s.dir[1] / l,
    run: s.steps * s.tread,
    rise: s.steps * s.rise,
    halfWidth: s.width / 2,
    baseY: s.base[1],
    // (round 42: no foot bank on the house-west flight — its apron carries slabs now
    // (hardscape/stairs.ts), and the 6 cm bank lifted the shelf to 0.30–0.34 under them)
    footBank: s.id === 'main' ? 0.13 : 0,
    apron: s.id === 'house-west',
    // (round 49: the west-house flight lays one landing row — the walkway deck's end rests on it)
    landing: s.id === 'house-west' || s.id === 'west-house' ? 0.85 : 1.7,
  };
}

const stairFrames: StairFrame[] = LAYOUT.stairs.map(stairFrameOf);
/** round 49: the expansion flights (layout `EXPANSION_STAIRS`) — in the live view's ramps and masks only */
const expansionStairFrames: StairFrame[] = EXPANSION_STAIRS.map(stairFrameOf);
const LIVE_FRAMES: StairFrame[] = [...stairFrames, ...expansionStairFrames];
const framesFor = (live: boolean) => (live ? LIVE_FRAMES : stairFrames);

/**
 * Round 49: camera C's right (west) frustum edge on the ground (layout `EXPANSION.cClip`): 0 within
 * `margin` m east of / on the ray, 1 from `margin + fade` m west of it. Every live-only feature of
 * the expansion (the south terrace, its flight, the discs' surface) is multiplied by this, so no
 * terrain vertex camera C renders moves — the six fixed frames stay byte-identical.
 */
function cClip(x: number, z: number): number {
  const c = EXPANSION.cClip;
  const rayW = c.x0 + c.dxdz * (z - c.z0) - x;
  return smoothstep(c.margin, c.margin + c.fade, rayW);
}

/**
 * Round 49: the fence-topped bank south-west of the plaza (layout `EXPANSION.southBank`) — a flat
 * terrace at `height` (absolute) whose face falls toward the plaza over `face` m from the lip,
 * with `skirt` m soft ends and a `back` m skirt behind the flat top. Authored in the lip frame
 * (u along the lip, v positive down the face toward the plaza). Live view only.
 */
const SOUTH_TERRACE = (() => {
  const b = EXPANSION.southBank;
  const { lip, face } = southBankFrameVectors();
  return { ...b, lipX: lip[0], lipZ: lip[1], faceX: face[0], faceZ: face[1] };
})();

/** the terrace's lip-frame coordinates of a point */
export function southTerraceLocal(x: number, z: number): { u: number; v: number } {
  const dx = x - SOUTH_TERRACE.x;
  const dz = z - SOUTH_TERRACE.z;
  return { u: dx * SOUTH_TERRACE.lipX + dz * SOUTH_TERRACE.lipZ, v: dx * SOUTH_TERRACE.faceX + dz * SOUTH_TERRACE.faceZ };
}

/** terrace pad weight 0..1 (1 = the flat top; the face and skirts ease to 0), already clipped to camera C's edge */
function southTerraceWeight(x: number, z: number): number {
  const T = SOUTH_TERRACE;
  const { u, v } = southTerraceLocal(x, z);
  if (Math.abs(u) >= T.halfLength + T.skirt || v >= T.face || -v >= T.depth + T.back) return 0;
  const along = 1 - smoothstep(T.halfLength, T.halfLength + T.skirt, Math.abs(u));
  const front = 1 - smoothstep(0, T.face, v);
  const back = 1 - smoothstep(T.depth, T.depth + T.back, -v);
  return along * front * back * cClip(x, z);
}

/** the terrace flight of frame D's right edge (layout `stairs.house-west`), if authored */
const HOUSE_WEST = stairFrames.find((f) => f.id === 'house-west') ?? null;

/**
 * The house-west flight's banks (round 32 — the flight now runs ESE (bearing 110°) from the
 * north path's east verge, 5.0–5.3 m from camera D, off a paved apron above the path — 0.27 m
 * until round 42, 0.18 m since (hardscape-29's measurement: the frames show a LOW first tread,
 * and the shelf a full riser up put its kerb face where frame 56 s has flat pale paving) — to a
 * 1.53 m landing beside the signpost; see layout.ts).
 * NORTH flank (v < 0): a SHORT verge — the bank, the landing flatten, the detail halo and the
 * damp splat all stop `northVerge` m beyond the tread ends, because the signpost (7, −9.3)
 * stands 1.1 m beyond them beside the top step and frame B fixes its board (round 31's first
 * cut let a flank bank reach the sign's foot and lifted it 0.29 m — 18 px in B). Neither hero
 * camera sees this face (it points 20°, away from both), so it is simply the steep earth face
 * (1.56 m landing → 0.67 m sign pad over 1.1 m, ≈ 50°) the landing needs, flagged damp out to
 * `dampReach` m.
 * SOUTH flank (v > 0): the face cameras B / E look at from 10–12 m (2° off its normal) and the
 * face camera D sees obliquely under the nosings. Frame 14 s shows a grassy rise there with pale
 * stones climbing it to a pale flat top — the tread ends, cheek stones and landing of this
 * flight in turf — so the lip is flush with the ramp (+0.07, the tread noses 0.2 m proud like
 * the main run's north-west flank) and the turf falls from it at `southSlope` m per m (≈ 29°)
 * out to `southReach` m, never below the natural ground. Along the first riser and the lower
 * treads (u < `sideApron`) the paving laps the flight instead: frame 56 s' pale slab runs on
 * under the flight's near corner (D x 0.83–1.0, y 0.70–0.79), so the strip south of the lower
 * tread ends is part of the paved apron and the bank only begins where the apron ends.
 * The apron in front of the first riser is paved and flattened to the path level `apron` m
 * back so the north path's slabs lap the foot.
 */
const HOUSE_WEST_BANK = { northVerge: 0.3, dampReach: 1.6, apron: 0.8, sideApron: 0.55, southSlope: 0.55, southReach: 3.2 };

/**
 * The house-west flight's paved apron weights at local (u, v): `front` 1 over the strip in front
 * of the first riser, `side` 1 over the strip south of the lower tread ends (both flattened to
 * the path level and paved), `sideBank` the fade the south flank bank uses to yield to `side`.
 */
function houseWestApron(f: StairFrame, u: number, v: number) {
  const au = -u; // metres in front of the first riser
  let front = 0;
  let frontSurface = 0;
  if (au > -0.1 && au < HOUSE_WEST_BANK.apron + 0.6 && Math.abs(v) < f.halfWidth + 0.9) {
    // full from 0.15 m behind the first riser's face (the under-tread trench takes over there)
    const along = smoothstep(-0.35, -0.15, au) * (1 - smoothstep(HOUSE_WEST_BANK.apron - 0.25, HOUSE_WEST_BANK.apron, au));
    const acrossS = 1 - smoothstep(f.halfWidth + 0.15, f.halfWidth + 0.4, Math.abs(v));
    const acrossW = 1 - smoothstep(f.halfWidth + 0.3, f.halfWidth + 0.9, Math.abs(v));
    front = along * acrossW;
    frontSurface = along * acrossS;
  }
  let side = 0;
  let sideSurface = 0;
  if (v > f.halfWidth - 0.3 && v < f.halfWidth + 1.3 && u > -0.2 && u < HOUSE_WEST_BANK.sideApron + 0.6) {
    const along = 1 - smoothstep(HOUSE_WEST_BANK.sideApron, HOUSE_WEST_BANK.sideApron + 0.45, u);
    const out = 1 - smoothstep(f.halfWidth + 0.7, f.halfWidth + 1.3, v);
    side = along * out;
    sideSurface = along * smoothstep(f.halfWidth - 0.05, f.halfWidth + 0.1, v) * (1 - smoothstep(f.halfWidth + 0.75, f.halfWidth + 1.0, v));
  }
  return { flatten: Math.max(front, side), surface: Math.max(frontSurface, sideSurface), side };
}

/**
 * The main run's north-west embankment (toward Saria's terrace): a flush grass lip `lip` m
 * beyond the tread ends, then a bank falling `slope` m per metre (0.8 ≈ 39°, grass-safe).
 */
// 1.5 m per metre (~56 deg): with the flight re-laid 2.5 m nearer the plaza (aff169d) the old 39 deg
// embankment reached the shot-B hedge strip (x 7.2-10.6, z -7..-5.1) at 0.4-1.7 m and the hedge
// (ground <= 0.6 m) vanished; the steeper flank returns that strip to <= 0.6 m over 77 % of its cells.
const NW_BANK = { lip: 0.35, slope: 1.5 };

/**
 * The main run's south-east flank (v > 0, the side cameras A and F look along). Round 23: frame
 * 1 s shows the grass bank lapping over the step ends — no tread end stands clear of the turf —
 * where our bank at ramp + 0.07 left the ends as a sawtooth wall (bank − tread top −0.13 m on
 * average 0.2 m off the ends, −0.32 at the noses). The bank there sits `lift` higher (ramp + 0.27:
 * 0 at the noses, +0.2 over the tread backs, so the turf rises over the ends), tapering back to
 * the flush lip over the last `taper` m below the top step so the landing stays level. The
 * trench → bank blend starts `blendIn` m under the slab ends (both sides start 0.02 m outside
 * them otherwise), so the ground reaches the ramp height at the ends themselves — over the back
 * corner of each tread, under the nose — rather than 0.2 m out; the 0.2 m terrain lattice then
 * cuts the turf across the ends' back corners by up to ~0.1 m, which is the lap the frame shows.
 */
const SE_BANK_LIFT = { lift: 0.2, taper: 1.6, blendIn: 0.1 };

/**
 * The main run's foot (round 23): in frames 1 s / 8 s the first riser is half buried — soil and
 * turf bank up against it — where ours stood its full height on the flat approach. The approach
 * rises `rise` over the last `reach` m to the first riser (u = 0) and stays flat across the run's
 * width; a smooth ramp, not a step, so the player controller sees a lower first riser (0.14 m of
 * the 0.27 shows), nothing more.
 */
const FOOT_BANK = { rise: 0.13, reach: 0.7 };

/** Project point into a stair's local frame: u along ascent, v across. */
function stairLocal(f: StairFrame, x: number, z: number) {
  const rx = x - f.ox;
  const rz = z - f.oz;
  const u = rx * f.dx + rz * f.dz;
  const v = -rx * f.dz + rz * f.dx;
  return { u, v };
}

const D_BOULDER = LAYOUT.heroBoulders.find((b) => b.id === 'shot-d-boulder')?.position;

/** ground pads under the signposts: foot height `y`, full within `r0` m, gone at `r1` (see macroHeight) */
const SIGN_PADS = LAYOUT.signposts.filter((s) => s.id === 'saria-sign').map((s) => ({ x: s.position[0], z: s.position[2], y: 0.67, r0: 0.45, r1: 1.2 }));

/**
 * South bank of the main stair (reference frame 1 s, right third; frame 8 s, right half): the
 * grassy bank between the plaza's east lobe and the stair's south flank. Its TOE is the line from
 * camera A's bottom-edge paving end — A (0.78, 1.0) unprojected to (3.3, 5.9) — to 0.25 m south
 * of the first riser's south corner, which projects as the near-vertical grass/paving edge at
 * x ≈ 0.78 of frame 1 s. South-east of the toe nothing is paved or flattened (`pathInfluence`):
 * the ground climbs `rise` over the first 0.8 m (the Kokiri kid stands on it 4.9 m from camera
 * A, feet at (0.885, 0.70), ≈ 0.7 m above the plaza) and on to `crest` two to three metres out.
 * Alongside the first treads the bank dips back to the flank's flush tread-end lip (the first
 * riser meets flat ground; the stair-foot post keeps its pod near the reference's height) and
 * the crest carries on 1.6 m out, where the stair-foot rock sits ≈ 0.5 m up. Fades out at the
 * plaza end of the toe and toward the stair-bank giant; further up the run the plateau ramp's
 * flank takes over (`landform` max).
 */
const S_BANK = (() => {
  const ms = stairFrames[0];
  const ax = 3.3;
  const az = 5.9;
  const bx = ms.ox - ms.dz * (ms.halfWidth + 0.25);
  const bz = ms.oz + ms.dx * (ms.halfWidth + 0.25);
  const l = Math.hypot(bx - ax, bz - az);
  // unit normal of the toe line pointing south-east, onto the bank
  return { ax, az, nx: -(bz - az) / l, nz: (bx - ax) / l, rise: 0.85, crest: 1.15 };
})();

/**
 * South-bank frame: `d` = signed distance from the toe line (positive on the bank), `u`/`v` the
 * main stair's local coordinates, `along` = 1 over the toe's run (from its plaza end to a few
 * metres up the flight, where the plateau ramp is the taller landform anyway).
 */
function southBankFrame(x: number, z: number) {
  const d = (x - S_BANK.ax) * S_BANK.nx + (z - S_BANK.az) * S_BANK.nz;
  const { u, v } = stairLocal(stairFrames[0], x, z);
  const along = smoothstep(-9.0, -7.2, u) * (1 - smoothstep(3.5, 6.5, u));
  // 1 over the toe strip (paving edge → first metre of the face): the detail passes and the
  // breakup noise fade out there so the paving meets the foot of the bank at plaza level
  const toe = along * smoothstep(-0.8, -0.3, d) * (1 - smoothstep(0.1, 0.9, d));
  return { d, u, v, along, toe };
}

/** South-bank landform: height `h` (0 off the bank) and the zone weight `w` that damps the base undulation under it. */
function southBank(x: number, z: number) {
  const { d, u, v, along } = southBankFrame(x, z);
  if (d <= -0.9 || along <= 0) return { h: 0, w: 0 };
  // a steep grassy face over the first 0.8 m, then a gentler climb to the crest
  const profile = S_BANK.rise * smoothstep(-0.1, 0.78, d) + (S_BANK.crest - S_BANK.rise) * smoothstep(1.6, 3.4, d);
  // alongside the treads (u > 0) the ground next to them is the flank bank's flush lip
  // (macroHeight), so the bank only rises again 0.9–2.3 m out from the tread ends
  const valley = 1 - (1 - smoothstep(2.4, 3.8, v)) * smoothstep(-1.2, 0.3, u);
  // across the run: the plaza end of the bank is narrower (4.5–7.5 m from the stair axis) than
  // the stair-foot end (6–9 m), so frame 8's right edge keeps its paving-then-low-bank profile
  const k = smoothstep(-5, -1, u);
  const across = 1 - smoothstep(4.5 + 1.5 * k, 7.5 + 1.5 * k, v);
  const w = along * across;
  // the base undulation is damped from 0.9 m before the toe, i.e. before the path flattening
  // lets go of the paving (pathInfluence), so no bump or dip surfaces between the two
  return { h: profile * valley * w, w: w * smoothstep(-0.9, -0.3, d) };
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
  // catch-up cliffs at the bank edges (it returns ~3 m out from the treads); damped as well
  // under the authored south bank, whose toe must meet the plaza at 0
  const corridor = alongRun * (1 - smoothstep(ms.halfWidth + 0.3, ms.halfWidth + 3.2, Math.abs(sv)));
  const sBank = southBank(x, z);
  const base = (macro.fbm(x * 0.021, z * 0.021, 3) * 0.75 + medium.fbm(x * 0.07, z * 0.07, 3) * 0.22) * (1 - 0.85 * corridor) * (1 - 0.85 * sBank.w);

  // full plateau height 0.6 m past the top tread (was +1.5: with the 20-step run the W04 probe at
  // (18, -4) sat on the ramp's tail at 4.94 m)
  const eastRamp = smoothstep(-1.5, ms.run + 0.6, su);
  const eastZone = smoothstep(14, -32, z) * smoothstep(-36, -26, z) + smoothstep(-32, 14, z) * smoothstep(16, 8, z);
  let east = T.eastPlateau.height * eastRamp * clamp(eastZone, 0, 1) * smoothstep(3.5, 9, x);
  // North-west flank of the run (v < 0, the house side): the ramp does not carry on as a shelf
  // toward Saria's terrace (1.2 m) — from the flush lip at the tread ends (+0.07) it falls at
  // ~56° (1.5 m per metre; see NW_BANK) so the flank reads as one continuous grassy embankment
  // down to the door path instead of a hump cut by the house pad. Past the top step the plateau
  // is full width again (the fence runs sit on it).
  const nwBeyond = -sv - (ms.halfWidth + NW_BANK.lip);
  if (nwBeyond > 0 && east > 0) {
    east = Math.max(0, east - alongRun * (nwBeyond * NW_BANK.slope - 0.07));
  }

  // West ledge with a soft embankment toward the path.
  const west = T.westLedge.height * smoothstep(-5.5, -10, x) * smoothstep(13, 6, z) * smoothstep(-30, -20, z);
  const westNorth = T.westLedge.height * 0.8 * smoothstep(-5.5, -10, x) * smoothstep(-20, -34, z);

  // North: the path dips through a shallow misty hollow (reference D's mist pool before the arch)
  // and then rises gently toward the log arch; the ground beyond climbs a little further.
  // Round 32: 3.4 m by z −37 and 4.3 m by z −50 (was 5.6). Frame 56 s holds the far ground line
  // at y ≈ 0.46–0.47 from 33 m to the arch's feet at ≈ 50 m — a ground that climbs as fast as it
  // recedes (camera D eye 1.45 m, pitch +1.9°: 3.4 m at 33 m, 3.8 at 39, 4.3 at 47) — and the
  // arch, seated on this ground (logArch.ts), stood 1.3 m too high (crown top y 0.22–0.24 in D
  // against the frame's 0.27–0.30). Mirrors `layout.pathSpine` (3.35 / 3.75 / 4.3 / 4.5).
  const hollow = -0.2 * smoothstep(-14, -19, z) * smoothstep(-28, -23, z);
  const northRise = 3.4 * smoothstep(-23, -37, z) + 0.9 * smoothstep(-36, -50, z);
  // Boulder bank WEST of the north path: a grassy 45° face (the `north` steps that climbed it
  // went in round 32 — frame 56 s has open misty ground there) carrying on up to the terrace
  // boulder; it merges into the west-north ledge.
  const northBank = T.northTerrace.height * smoothstep(-1.0, -3.6, x) * smoothstep(-14, -17.5, z) * smoothstep(-33, -25, z);
  const north = Math.max(northRise, northBank);

  // House terrace (north-east of the plaza).
  const house = T.houseTerrace.height * smoothstep(-7.5, -11, z) * smoothstep(2.5, 6.5, x) * smoothstep(19, 12, x);

  // Low mossy bank under the shot-D boulder / fern cluster (reference D: the cluster sits ~0.5 m
  // above the path at 7–9 m, x 0.05–0.25 × 0.55–0.85).
  const dBank = D_BOULDER ? 0.5 * (1 - smoothstep(1.2, 3.0, Math.hypot(x - D_BOULDER[0], z - D_BOULDER[2]))) : 0;

  const raised = Math.max(east, west, westNorth, north, house, dBank, sBank.h);
  // the hollow only dips ground that no terrace or bank has lifted
  let h = base + raised + hollow * (1 - smoothstep(0, 0.6, raised));

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
      edgeOf(clamp(northBank / T.northTerrace.height, 0, 1), T.northTerrace.height),
      // the south bank's face: a little erosion/terracing so the grassy rise is not a ruler
      0.6 * edgeOf(clamp(sBank.h / S_BANK.crest, 0, 1), S_BANK.crest),
    ),
    0,
    1,
  );
  return { h, plateau, east, west: Math.max(west, westNorth), north, house, embank, bank: sBank.w };
}

/** Paved plaza around the origin (reference frame 14): the flagstone disc where Link stands. */
export const PLAZA = { x: 0, z: 0, radius: 6.0 };
/**
 * Paved discs: the plaza plus an eastern lobe toward the stair foot — frame 8 s shows flagstones
 * in the right foreground (F (0.6–0.95, 0.7–0.9) → world x 4–8, z 2–6) — and a small disc at the
 * south bank's plaza end, so the flagstones run right up to the bank's toe at camera A's bottom
 * edge (the lobe alone fades out 0.3 m short of it). Both are cut off by the toe (`S_BANK`,
 * `pathInfluence`): in frame 1 s the paving ends at x ≈ 0.78 and the grassy bank with the Kokiri
 * kid and the stair-foot rock rises east of it.
 */
export const PLAZA_DISCS = [PLAZA, { x: 5.0, z: 2.4, radius: 4.0 }, { x: 3.25, z: 5.45, radius: 1.1 }];

/**
 * Round 47 (expansion-1): the paved discs beyond the log arch — the north clearing at the end of
 * `layout.northPath`. Paved to `radius`, flattened to `y` a little beyond it (like the plaza's
 * discs, but to the clearing's own floor height rather than 0).
 */
export const NORTH_DISCS = [{ x: LAYOUT.northClearing.x, z: LAYOUT.northClearing.z, y: LAYOUT.northClearing.y, radius: LAYOUT.northClearing.radius }];

/**
 * The stone circle's standing stones (`layout.stoneCircle`) on the clearing's ring: evenly spaced
 * with a little deterministic slip (a fixed-seed noise, no stream), the ring's gap facing the
 * path's arrival. Shared here so the hardscape that lays the blocks, the `structure` mask that
 * keeps grass out from under them and the character ground's `blocked()` all see the same stones.
 */
const STONE_SLIP_N = new Noise2D('stone-circle-slip');
export const STONE_CIRCLE_STONES: readonly { x: number; z: number; ang: number }[] = (() => {
  const NC = LAYOUT.northClearing;
  const SC = LAYOUT.stoneCircle;
  const arrive = LAYOUT.northPath[LAYOUT.northPath.length - 2];
  const gapAng = Math.atan2(arrive[2] - NC.z, arrive[0] - NC.x);
  const out: { x: number; z: number; ang: number }[] = [];
  for (let i = 0; i < SC.stones; i++) {
    // the ring leaves the arrival sector (± 1/(stones+1) of the circle around `gapAng`) open
    const t = (i + 1) / (SC.stones + 1);
    const ang = gapAng + Math.PI * 2 * t + 0.06 * STONE_SLIP_N.fbm(i * 3.1 + 0.5, 1.7, 1);
    const r = SC.ringRadius + 0.12 * STONE_SLIP_N.fbm(i * 3.1 + 0.5, 9.3, 1);
    out.push({ x: NC.x + Math.cos(ang) * r, z: NC.z + Math.sin(ang) * r, ang });
  }
  return out;
})();
/** the standing stones' footprints: 1 within 0.26 m of a stone's axis (the blocks are 0.30–0.42 m across), 0 beyond 0.34 m */
export function standingStoneMask(x: number, z: number): number {
  const NC = LAYOUT.northClearing;
  if (Math.abs(x - NC.x) > NC.radius || Math.abs(z - NC.z) > NC.radius) return 0;
  let m = 0;
  for (const s of STONE_CIRCLE_STONES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < 0.34) m = Math.max(m, 1 - smoothstep(0.26, 0.34, d));
  }
  return m;
}

/**
 * The ledge terrace north of the clearing (`layout.ledgeTerrace`): an oriented box, full over its
 * half extents, its north / east / west skirts easing out over `skirt` m and its SOUTH face — the
 * rock face over the clearing that ref-04 shows — falling over `face` m (1.62 m over 0.5 m ≈ 73°,
 * slope ≈ 0.7: the mask's `cliff` reaches 0.9 there, so the splat paints it rock and no grass grows on it).
 * Applied in macroHeight before the stair ramps, so the `ledge` flight's trench / banks / landing
 * rule wherever they overlap it.
 */
const TERRACE = (() => {
  const t = LAYOUT.ledgeTerrace;
  const yaw = (t.yawDeg * Math.PI) / 180;
  return { cx: t.x, cz: t.z, y: t.y, ax: Math.cos(yaw), az: -Math.sin(yaw), hl: t.halfLength, hd: t.halfDepth, skirt: 1.1, face: 0.5 };
})();

/** terrace pad weight 0..1 at a point (1 = the flat top) */
function terraceWeight(x: number, z: number): number {
  const dx = x - TERRACE.cx;
  const dz = z - TERRACE.cz;
  // u along the terrace's length (east), v across it (positive = south, toward the clearing)
  const u = dx * TERRACE.ax + dz * TERRACE.az;
  const v = -dx * TERRACE.az + dz * TERRACE.ax;
  const along = 1 - smoothstep(TERRACE.hl, TERRACE.hl + TERRACE.skirt, Math.abs(u));
  const south = 1 - smoothstep(TERRACE.hd, TERRACE.hd + TERRACE.face, v);
  const north = 1 - smoothstep(TERRACE.hd, TERRACE.hd + TERRACE.skirt, -v);
  return along * south * north;
}

/**
 * Round 47 (expansion-1, owner item 13: "I also need to be able to walk past it"): the walkable
 * tunnel under the log arch — 1 within `TUNNEL.halfWidth` of the north spine's last two segments
 * and the first segment of `layout.northPath` (the log's belly clears the paving by ≥ 1.68 m over
 * that width; layout.ts `logArch`), fading to 0 over 0.4 m. The arch's `structure` mask is left
 * as it is (it keeps the paving's gravel floor, the tongues and every vegetation rule under the
 * log); the character ground's `blocked()` subtracts this from it, so the log's grounded walls
 * and root masses on either side stay blocked and the passage between them opens.
 */
const TUNNEL = (() => {
  const s = LAYOUT.pathSpine;
  const n = LAYOUT.northPath;
  return { line: [s[s.length - 3], s[s.length - 2], s[s.length - 1], n[1]] as readonly P3[], halfWidth: 2.0 };
})();

export function archTunnel(x: number, z: number): number {
  const d = closestOnPolyline(TUNNEL.line, x, z).dist;
  return 1 - smoothstep(TUNNEL.halfWidth - 0.1, TUNNEL.halfWidth + 0.3, d);
}

/**
 * Round 47: the paving mask north of this line as it was BEFORE the extension — the spine's own
 * end (`pathHalfWidth`, the same smoothstep `pathInfluence` gives it) and nothing else, since
 * `layout.northPath` and `northClearing` did not exist. The hardscape's original pass (its
 * lattices, joint fill and sprout scatters) reads the mask through this, so every stone, fill
 * quad and sprout it lays — south of the arch and at the paving's old north end behind it — is
 * byte-identical to round 46: its shared streams never see the new ground. The extension is a
 * second pass that starts where this leaves off. South of `NORTH_EXTENSION_Z` nothing changed
 * and `current` (the live mask) is returned.
 */
export const NORTH_EXTENSION_Z = -54;
export function legacyPathMask(x: number, z: number, current: number): number {
  if (z >= NORTH_EXTENSION_Z) return current;
  const hw = LAYOUT.pathHalfWidth;
  return 1 - smoothstep(hw * 0.85, hw * 1.05, closestOnPolyline(LAYOUT.pathSpine, x, z).dist);
}

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

/**
 * Round 49 (structures-32): the frame of the passage tube's FLOOR, for the ground tint under
 * the log (material.ts — the only terrain-side part of the tunnel; the tube, its cheeks and the
 * slab decal are structures/logArch.ts, which derives the same frame from the same layout).
 * Origin: where the log's straight axis line crosses the tunnel line; `w` the walk's unit
 * direction on that segment (north-ish), the across axis its right-hand perpendicular (east-ish).
 * `aS`/`aN` are the along-walk extent of the tinted floor (the south cheek face −2.6 m and the
 * north mouth +7.4 m in logArch.ts, each widened by the feather), `eHalf` its half-width (the
 * tube's walls stand at ± 2.75 m). Past the spine's end the walk bends west (`layout.northPath`)
 * and the tube's centre follows it: the across distance is measured to the walk polyline `pts`
 * (logArch.ts runs the tube's centre along the same points, smoothed). Heights are not
 * involved: this is a plan-view box.
 */
export const ARCH_TUNNEL_FLOOR = (() => {
  const line = [...TUNNEL.line, LAYOUT.northPath[2]] as readonly P3[];
  let ox = line[1][0];
  let oz = line[1][2];
  let wx = 0;
  let wz = -1;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, , az] = line[i];
    const [bx, , bz] = line[i + 1];
    const va = -(ax - LOG.cx) * LOG.az + (az - LOG.cz) * LOG.ax;
    const vb = -(bx - LOG.cx) * LOG.az + (bz - LOG.cz) * LOG.ax;
    if ((va > 0 && vb > 0) || (va < 0 && vb < 0) || va === vb) continue;
    const t = va / (va - vb);
    ox = ax + (bx - ax) * t;
    oz = az + (bz - az) * t;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    wx = (bx - ax) / len;
    wz = (bz - az) / len;
    break;
  }
  const N_MOUTH_A = 7.4;
  const spineEnd = LAYOUT.pathSpine[LAYOUT.pathSpine.length - 1];
  // the walk polyline the tube's centre follows (logArch.ts `eCentreAt` smooths the same points):
  // 4 m south of the crossing on the spine's last segment, its end, the north path's bend
  const pts: [number, number][] = [
    [ox - wx * 4, oz - wz * 4],
    [spineEnd[0], spineEnd[2]],
    [LAYOUT.northPath[1][0], LAYOUT.northPath[1][2]],
    [LAYOUT.northPath[2][0], LAYOUT.northPath[2][2]],
  ];
  return { ox, oz, wx, wz, aS: -2.9, aN: N_MOUTH_A + 0.5, eHalf: 2.95, feather: 0.9, pts };
})();

const STEPPING_STONES = houseSteppingStones();

/** 1 on a stepping stone of the house branch (paved), soft 10 % rim. */
export function steppingStoneMask(x: number, z: number): number {
  let m = 0;
  for (const s of STEPPING_STONES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r * 1.2) m = Math.max(m, 1 - smoothstep(s.r * 0.92, s.r * 1.12, d));
  }
  return m;
}

/** round 49: the expansion polylines' stepping discs (layout `EXPANSION.pathWest` / `pathSouth`) */
const EXPANSION_STONES = expansionSteppingStones();
const EXPANSION_STONES_BOX = (() => {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const s of EXPANSION_STONES) {
    b.x0 = Math.min(b.x0, s.x - s.r * 1.3);
    b.x1 = Math.max(b.x1, s.x + s.r * 1.3);
    b.z0 = Math.min(b.z0, s.z - s.r * 1.3);
    b.z1 = Math.max(b.z1, s.z + s.r * 1.3);
  }
  return b;
})();

/**
 * 1 on a stepping disc of the expansion paths (paved surface for the splat, the paving and the
 * character ground; the ground under them is NOT flattened — they are set stones lying with the
 * grade, hardscape/flagstones.ts `setDiscs`), soft 10 % rim, clipped to camera C's edge. Live only.
 */
export function expansionDiscMask(x: number, z: number): number {
  const b = EXPANSION_STONES_BOX;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return 0;
  let m = 0;
  for (const s of EXPANSION_STONES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r * 1.2) m = Math.max(m, 1 - smoothstep(s.r * 0.92, s.r * 1.12, d));
  }
  return m > 0 ? m * cClip(x, z) : 0;
}

/**
 * Round 56 (expansion-south, live view only): the south route's height profiles. The path from
 * the spine's end to the bridge follows the landform along its line smoothed over ± 3 m, eased
 * out of the spine's end level (0) over its first 5 m; the far route (south sill → the log's
 * mouth) is level at the landform's mean along it — the tunnel floor's height (`SOUTH_FLOOR_Y`).
 */
const SOUTH_ROUTE = (() => {
  const line = southPathLine();
  const s: number[] = [0];
  for (let i = 1; i < line.length; i++) s.push(s[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][2] - line[i - 1][2]));
  const raw = line.map((p) => landform(p[0], p[2]).h);
  const pts: P3[] = line.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = 0; j < line.length; j++) {
      if (Math.abs(s[j] - s[i]) <= 3) {
        sum += raw[j];
        n++;
      }
    }
    return [p[0], lerp(0, sum / n, smoothstep(0, 5, s[i])), p[2]] as P3;
  });
  const S = EXPANSION_SOUTH;
  const far: [number, number][] = [...S.farPath.map((p) => [p[0], p[2]] as [number, number]), [S.tunnel.mouth[0], S.tunnel.mouth[1]]];
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 1 < far.length; i++) {
    const len = Math.hypot(far[i + 1][0] - far[i][0], far[i + 1][1] - far[i][1]);
    const k = Math.max(1, Math.ceil(len / 0.3));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      sum += landform(far[i][0] + (far[i + 1][0] - far[i][0]) * t, far[i][1] + (far[i + 1][1] - far[i][1]) * t).h;
      n++;
    }
  }
  const floorY = sum / n;
  const farPts: P3[] = far.map(([x, z]) => [x, floorY, z] as P3);
  return { pts, total: s[s.length - 1], farPts, floorY };
})();
/** the south route's ground levels: the path's end at the north sill, the far route / tunnel floor (live view) */
export const SOUTH_FLOOR_Y = SOUTH_ROUTE.floorY;
export const SOUTH_NORTH_SILL_Y = SOUTH_ROUTE.pts[SOUTH_ROUTE.pts.length - 1][1];
const SOUTH_BRIDGE_LEN = southBridgeFrame().len;
const [SP_BOX, , SB_BOX] = EXPANSION_SOUTH_BOXES;
/** Round 57 (expansion-ruins, live view only): the ruins trail's grade over the macro landform (terrain/ruins.ts) */
const RUINS_TRAIL = buildTrailProfile((x, z) => landform(x, z).h);
const inBox = (b: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

/**
 * The south route's paved surface and flattening (live view only; `pathInfluence`): the strip from
 * the spine's end to the north sill (half width `southPathHalfWidth`), the far route to the mouth,
 * and the level apron in front of the log. The paving stops at each sill (the deck starts there).
 */
function southRoute(x: number, z: number) {
  let dist = Infinity;
  let hw = 1;
  let y = 0;
  let clip = 1;
  if (inBox(SP_BOX, x, z)) {
    const sp = closestOnPolyline(SOUTH_ROUTE.pts, x, z);
    dist = sp.dist;
    hw = southPathHalfWidth(sp.t * SOUTH_ROUTE.total);
    y = sp.y;
    clip = 1 - smoothstep(0.1, 0.5, bridgeLocal(x, z).a);
  }
  let apron = 0;
  if (inBox(SB_BOX, x, z)) {
    const fp = closestOnPolyline(SOUTH_ROUTE.farPts, x, z);
    const fhw = EXPANSION_SOUTH.farPathHalfWidth;
    if (fp.dist - fhw < dist - hw) {
      dist = fp.dist;
      hw = fhw;
      y = SOUTH_ROUTE.floorY;
      // stops at the south sill, and at the log's rim (the built floor carries on inside)
      const tl = tunnelLocal(x, z);
      clip = smoothstep(SOUTH_BRIDGE_LEN - 0.5, SOUTH_BRIDGE_LEN - 0.1, bridgeLocal(x, z).a) * (1 - smoothstep(-0.55, -0.25, tl.a));
    }
    // the level apron in front of the mouth (and a little under the rim)
    const tl = tunnelLocal(x, z);
    if (tl.a < 1.2 && tl.a > -4) apron = (1 - smoothstep(1.9, 3.1, Math.hypot(Math.min(tl.a + 0.6, 0) * 1.3, tl.c))) * (1 - smoothstep(0.6, 1.2, tl.a));
  }
  return { dist, hw, y, clip, apron };
}

/** the east lane's stepping discs (layout `EXPANSION_EAST`) */
const EAST_STONES = eastSteppingStones();
const EAST_STONES_BOX = (() => {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const s of EAST_STONES) {
    b.x0 = Math.min(b.x0, s.x - s.r * 1.3);
    b.x1 = Math.max(b.x1, s.x + s.r * 1.3);
    b.z0 = Math.min(b.z0, s.z - s.r * 1.3);
    b.z1 = Math.max(b.z1, s.z + s.r * 1.3);
  }
  return b;
})();

/** 1 on an east-lane disc (set stones lying with the grade like the expansion's, soft 10 % rim). Live only. */
export function eastDiscMask(x: number, z: number): number {
  const b = EAST_STONES_BOX;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return 0;
  let m = 0;
  for (const s of EAST_STONES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r * 1.2) m = Math.max(m, 1 - smoothstep(s.r * 0.92, s.r * 1.12, d));
  }
  return m;
}

function pathInfluence(x: number, z: number, live = false) {
  const hw = LAYOUT.pathHalfWidth;
  const a = closestOnPolyline(LAYOUT.pathSpine, x, z);
  const b = closestOnPolyline(LAYOUT.pathToStairs, x, z);
  const c = closestOnPolyline(LAYOUT.pathToHouse, x, z);
  // pick the branch that dominates
  let best = a;
  let bhw: number = hw;
  let paved = true;
  if (b.dist - hw * 0.8 < best.dist - bhw) {
    best = b;
    bhw = hw * 0.8;
  }
  if (c.dist - hw * 0.4 < best.dist - bhw) {
    // the walk across Saria's lawn is turf with stepping stones: flattened over a narrow strip
    // (full to 0.77 m, gone by 1.8 m — the signpost 1.7 m off the line keeps its own ground), not paved
    best = c;
    bhw = hw * 0.4;
    paved = false;
  }
  // round 47: the paving beyond the arch (`layout.northPath`, its own half width). Only ever the
  // nearest branch north of the spine's end — south of z −56 the spine wins by its wider margin
  if (z < -54) {
    const hwN = LAYOUT.northPathHalfWidth;
    const n = closestOnPolyline(LAYOUT.northPath, x, z);
    if (n.dist - hwN < best.dist - bhw) {
      best = n;
      bhw = hwN;
      paved = true;
    }
  }
  // round 56 (live view): the south route — the nearest branch wherever its margin beats the spine's
  let southClip = 1;
  let southApron = 0;
  if (live && z > 10 && inExpansionSouth(x, z)) {
    const sr = southRoute(x, z);
    southApron = sr.apron;
    if (sr.dist - sr.hw < best.dist - bhw) {
      best = { dist: sr.dist, y: sr.y, t: 0 };
      bhw = sr.hw;
      paved = true;
      southClip = sr.clip;
    }
  }
  // round 57 (live view): the ruins trail (terrain/ruins.ts) — packed earth with its own ragged
  // edge and a flattening faded in off the stepping discs — wherever its margin beats the others'
  const trail = live && x < -12 && inExpansionRuins(x, z) ? trailInfluence(RUINS_TRAIL, x, z) : null;
  const onTrail = trail !== null && trail.dist - trail.hw < best.dist - bhw;
  let weight = onTrail ? trail.weight : 1 - smoothstep(bhw * 0.8, bhw * 1.9, best.dist);
  let surface = onTrail ? trail.surface : paved ? (1 - smoothstep(bhw * 0.85, bhw * 1.05, best.dist)) * southClip : steppingStoneMask(x, z);
  let y = onTrail ? trail.y : best.y;
  if (southApron > weight) {
    y = lerp(y, SOUTH_ROUTE.floorY, (southApron - weight) / Math.max(southApron, 1e-6));
    weight = southApron;
  }
  // plaza discs: paved surface out to each radius, flattened (to y = 0) a little beyond it
  let plazaSurface = 0;
  let plazaWeight = 0;
  for (const d of PLAZA_DISCS) {
    const dp = Math.hypot(x - d.x, z - d.z);
    plazaSurface = Math.max(plazaSurface, 1 - smoothstep(d.radius * 0.85, d.radius * 1.05, dp));
    plazaWeight = Math.max(plazaWeight, 1 - smoothstep(d.radius * 0.9, d.radius * 1.45, dp));
  }
  if (plazaWeight > weight) {
    y = lerp(y, 0, (plazaWeight - weight) / Math.max(plazaWeight, 1e-6));
    weight = plazaWeight;
  }
  surface = Math.max(surface, plazaSurface);
  // round 47: the north clearing's disc — paved to its radius, flattened to its own floor beyond.
  // Round 48 (opus-review #14, the "void band" under the ledge): the skirt used to start rising
  // at 0.9 r — 0.5 m inside the paving's edge (1.05 r) — so the rim slabs sat at the foot of a
  // plain smoothstep ramp, and that ramp is the only bank in the world `detailPasses` left bare:
  // `embank` comes from the landform's plateau ramps alone and is ≈ 0 here, so the 1.7 m face got
  // no erosion, terracing, slope lumps or damp foot, its splat stayed 3/4 grass, and — facing
  // south under a north-west sun (N·L ≈ 0.09) — it rendered as one flat hemisphere-lit grey band
  // with a crease at each end. Now the floor stays flat to the paving's edge (1.0 r) and the
  // skirt's own embankment weight (`bank`, peaking mid-slope, scaled by the rise) feeds the
  // detail passes and the splat like the landform banks' does.
  let bank = 0;
  // the skirt's downslope direction (toward the disc's centre: its floor is below the plain)
  let bankDx = 0;
  let bankDz = 0;
  if (z < -60) {
    for (const d of NORTH_DISCS) {
      const dp = Math.hypot(x - d.x, z - d.z);
      const ds = 1 - smoothstep(d.radius * 0.85, d.radius * 1.05, dp);
      const dw = 1 - smoothstep(d.radius * 1.0, d.radius * 1.5, dp);
      if (dw > weight) {
        y = lerp(y, d.y, (dw - weight) / Math.max(dw, 1e-6));
        weight = dw;
      }
      surface = Math.max(surface, ds);
      const b = 4 * dw * (1 - dw);
      if (b > bank && dp > 1e-6) {
        bank = b;
        bankDx = (d.x - x) / dp;
        bankDz = (d.z - z) / dp;
      }
    }
  }
  // paved apron at the foot of the house-west flight: the strip in front of its first riser (the
  // flight's width plus a little) and the strip south of its lower tread ends are paved and
  // flattened to the path's level (0 here), so the north path's flagstones run up to the riser
  // and on under the flight's near corner (frame 56 s) instead of leaving a grass wedge between
  // the paved edge and the flight's oblique foot
  if (HOUSE_WEST) {
    const { u, v } = stairLocal(HOUSE_WEST, x, z);
    const ap = houseWestApron(HOUSE_WEST, u, v);
    // the apron is the authority here: the target height itself goes to the apron level
    if (ap.flatten > 0) {
      y = lerp(y, HOUSE_WEST.baseY, ap.flatten);
      weight = Math.max(weight, ap.flatten);
    }
    surface = Math.max(surface, ap.surface);
  }
  // the south bank's toe (S_BANK): nothing is paved or flattened south-east of it — the plaza's
  // east lobe ends at the reference's grass edge (frame 1 s: x ≈ 0.78) and the bank rises there
  const sb = southBankFrame(x, z);
  if (sb.along > 0 && sb.d > -0.4) {
    surface *= 1 - sb.along * smoothstep(-0.1, 0.06, sb.d);
    weight *= 1 - sb.along * smoothstep(-0.2, 0.25, sb.d);
  }
  // round 49 (live view): the expansion paths' stepping discs are paved surface (no flattening)
  if (live) surface = Math.max(surface, expansionDiscMask(x, z), eastDiscMask(x, z));
  return { weight, surface, y, dist: best.dist, toe: sb.toe, bank, bankDx, bankDz };
}

/** Macro landform + authored flattening (paths, stair ramps, house pads). No detail yet. `live`: with the round-49 expansion (see `TerrainView`). */
function macroHeight(x: number, z: number, live = false) {
  const land = landform(x, z);
  let h = land.h;

  // Path flattening — blend toward the authored path height profile.
  const p = pathInfluence(x, z, live);
  if (p.weight > 0) {
    // authored y is the design height; add a little long-wavelength undulation so it's not a
    // ruler. Kept to ±2.5 cm over ~4 m: the slabs are seated on the mean height under them and
    // the joint fill hugs the terrain, so anything shorter than a slab (±6 cm at 2 m did it)
    // buries slab edges under the fill and reads as 10–30 cm joints from camera A.
    const pathY = p.y + 0.025 * fine.noise(x * 0.27, z * 0.27);
    h = lerp(h, pathY, p.weight);
  }

  // The signpost's ground (round 32): until round 31 the stepping-stone ramp's flattening held the
  // sign's foot at 0.67 m; the ramp is gone (the house-west flight and `pathToHouse` re-planned)
  // and the natural ground there is 0.53. Frame B fixes the board's height (a 0.14 m drop moves
  // it 9 px), so a small pad keeps the foot where it was. Applied before the stair ramps: the
  // flight's landing and its short north verge (0.75 m away) take precedence where they overlap.
  for (const sp of SIGN_PADS) {
    const w = 1 - smoothstep(sp.r0, sp.r1, Math.hypot(x - sp.x, z - sp.z));
    if (w > 0) h = lerp(h, sp.y, w);
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

  // Round 47: the ledge terrace beyond the arch (`layout.ledgeTerrace`) — a flat pad at its height,
  // its south face the steep bank over the north clearing. Before the stair ramps, like the house
  // pads, so the `ledge` flight's trench, banks and landing rule where they cross it.
  let terraceW = 0;
  if (z < -60) {
    terraceW = terraceWeight(x, z);
    if (terraceW > 0) {
      h = lerp(h, TERRACE.y, terraceW);
      padW = Math.max(padW, terraceW);
    }
  }

  // Round 49 (live view only): the fence-topped south terrace (`SOUTH_TERRACE`) — a flat pad at
  // its height, its face the grassy bank toward the plaza. Before the stair ramps, like the ledge
  // terrace, so the `south-bank` flight's trench, banks and landing rule where they cross it. The
  // pad only ever RAISES the ground (the plain there is 0.0–0.4 m).
  let southTerraceW = 0;
  if (live && z > 10 && x < -8) {
    southTerraceW = southTerraceWeight(x, z);
    if (southTerraceW > 0) {
      h = lerp(h, Math.max(h, SOUTH_TERRACE.height), southTerraceW);
      padW = Math.max(padW, southTerraceW * smoothstep(0.7, 0.95, southTerraceW));
    }
  }

  // Round 49 (live view only): the knoll under the far hut (`EXPANSION.farHutRise`) — a rounded
  // rise added to the plain (the detail passes stay on it: it is a grassy hill, not a pad).
  if (live && x < -30 && z > 25) {
    const R = EXPANSION.farHutRise;
    const d = Math.hypot(x - EXPANSION.farHut.host[0], z - EXPANSION.farHut.host[1]);
    if (d < R.radius) h += R.height * (1 - smoothstep(R.top, R.radius, d)) * cClip(x, z);
  }

  // Stair ramps: keep terrain just under the steps so nothing pokes through.
  let stairW = 0;
  // the house-west flight's flank banks (0..1 on the earth face beside the treads, for the splat)
  let hwBank = 0;
  for (const f of framesFor(live)) {
    const { u, v } = stairLocal(f, x, z);
    // the house-west flight's south bank reaches HOUSE_WEST_BANK.southReach beyond the flush lip
    const vLimit = f === HOUSE_WEST && v > 0 ? f.halfWidth + 0.5 + HOUSE_WEST_BANK.southReach : f.halfWidth + 1.3;
    if (u > -1.2 && u < f.run + f.landing + 0.7 && Math.abs(v) < vLimit) {
      // round 49: an expansion flight's every blend is clipped to camera C's edge (cClip); the
      // layout flights are untouched (clip 1)
      const clip = expansionStairFrames.includes(f) ? cClip(x, z) : 1;
      if (clip <= 0) continue;
      const h0 = h;
      const ramp = f.baseY + clamp(u / f.run, 0, 1) * f.rise;
      // the house-west flight's north flank is a short verge (HOUSE_WEST_BANK.northVerge): the
      // signpost stands just beyond it; its south flank is the long grassy fall B / E look at
      const shortVerge = f === HOUSE_WEST && v < 0;
      const hwSouth = f === HOUSE_WEST && v > 0;
      // the under-tread trench starts under the FIRST TREAD (u ≥ 0.04), never in front of the
      // first riser: blending it in from u = −0.4 dug a 0.17 m trench at the stair foot that the
      // player controller read as a 0.47 m step (Astra, 2026-09-11). The approach now stays at
      // base level and the first riser shows its full 0.30 m.
      const wu = smoothstep(0.04, 0.36, u) * smoothstep(f.run + 0.8, f.run + 0.1, u);
      const av = Math.abs(v);
      const southEast = f === stairFrames[0] && v > 0;
      // trench → bank blend across the tread ends. On the main run's south-east flank it starts
      // under the slabs (SE_BANK_LIFT.blendIn) so the turf is at the ramp height right at the
      // tread ends and laps their back corners, instead of the ends standing 0.18 m clear over a
      // soil slope; elsewhere it starts just outside the ends
      const b0 = f.halfWidth + (southEast ? -SE_BANK_LIFT.blendIn : 0.02);
      const b1 = b0 + (southEast ? 0.28 : 0.32);
      const wEnd = smoothstep(b0, b1, av);
      // under the treads: keep the ground well below the slabs so nothing pokes through
      h = lerp(h, ramp - 0.18, wu * (1 - wEnd));
      // beside the treads: a grass bank that meets the tread ends flush (reference: grass creeps
      // onto the step ends, no kerb), falling back to the natural slope further out. On the
      // main run's north-west side the bank target itself falls away like the landform's
      // embankment (NW_BANK), so the blend never has to catch up across a step.
      // The house-west flight: north flank falls to the verge within HOUSE_WEST_BANK.northVerge m
      // of the flush lip (a steep earth face); south flank falls at HOUSE_WEST_BANK.southSlope
      // per metre out to southReach, never below the natural ground, and yields to the paved
      // apron beside the lower treads (houseWestApron)
      const fall = shortVerge ? HOUSE_WEST_BANK.northVerge : hwSouth ? HOUSE_WEST_BANK.southReach : 0.85;
      const apron = f === HOUSE_WEST ? houseWestApron(f, u, v) : null;
      const apronYield = apron ? 1 - apron.side : 1;
      const wBank = wEnd * (1 - smoothstep(f.halfWidth + 0.4, f.halfWidth + 0.4 + fall, av)) * apronYield;
      const nwFall = f === stairFrames[0] && v < 0 ? NW_BANK.slope * Math.max(0, av - f.halfWidth - NW_BANK.lip) : 0;
      const hwFall = hwSouth ? HOUSE_WEST_BANK.southSlope * Math.max(0, av - f.halfWidth - 0.4) : 0;
      // main run's south-east flank: the turf laps over the tread ends (SE_BANK_LIFT), level again at the top
      const taper = 1 - smoothstep(f.run - SE_BANK_LIFT.taper, f.run - 0.2, u);
      const seLift = southEast ? SE_BANK_LIFT.lift * taper : 0;
      const bankTarget = ramp + 0.07 - nwFall - hwFall + seLift;
      h = lerp(h, hwSouth ? Math.max(h, bankTarget) : bankTarget, wu * wBank);
      if (f === HOUSE_WEST) {
        // the earth face: 1 where the bank stands above the natural ground beside the run, fading
        // out `dampReach` m from the tread ends and along the approach / landing. North flank
        // only: the south fall stays turf (frame 14 s has a green grassy rise right of the path
        // there — flagged damp it rendered as a bare soil ridge with pebbles beside Link)
        if (shortVerge) {
          const above = smoothstep(0.08, 0.35, ramp + 0.07 - land.h);
          hwBank = Math.max(hwBank, above * smoothstep(-0.2, 0.3, u) * (1 - smoothstep(f.run + f.landing + 0.3, f.run + f.landing + 1.2, u)) * smoothstep(f.halfWidth - 0.1, f.halfWidth + 0.25, av) * (1 - smoothstep(f.halfWidth + 0.4 + fall * 0.7, f.halfWidth + HOUSE_WEST_BANK.dampReach, av)));
        }
      }
      // the foot: soil banks up against the first riser (FOOT_BANK), across the run's width and a
      // little beyond, full height up to the riser face (u ≈ 0.01) and gone under the first tread
      // as the trench comes in, so the trench keeps its depth
      if (f.footBank > 0) {
        const wFoot = smoothstep(-FOOT_BANK.reach, -0.05, u) * (1 - smoothstep(0.04, 0.28, u)) * (1 - smoothstep(f.halfWidth + 0.2, f.halfWidth + 0.7, av));
        h += f.footBank * wFoot;
      }
      const wv = shortVerge
        ? 1 - smoothstep(f.halfWidth + 0.15, f.halfWidth + 0.15 + HOUSE_WEST_BANK.northVerge, av)
        : hwSouth
          ? 1 - smoothstep(f.halfWidth + 0.4 + HOUSE_WEST_BANK.southReach - 0.8, f.halfWidth + 0.4 + HOUSE_WEST_BANK.southReach, av)
          : 1 - smoothstep(f.halfWidth + 0.15, f.halfWidth + 0.9, av);
      // landing: the ground just past the top step meets the last tread flush (as in the reference);
      // on the house-west flight's south side it falls away like the flank bank
      const lw = smoothstep(f.run - 0.2, f.run + 0.1, u) * smoothstep(f.run + f.landing + 0.6, f.run + f.landing - 0.7, u) * wv;
      const landingTarget = f.baseY + f.rise - 0.06 - (hwSouth ? HOUSE_WEST_BANK.southSlope * Math.max(0, av - f.halfWidth - 0.15) : 0);
      h = lerp(h, hwSouth ? Math.max(h, landingTarget) : landingTarget, lw);
      // wider suppression halo so detail passes fade out before the cheeks
      const su = smoothstep(-1.2, -0.3, u) * smoothstep(f.run + f.landing + 0.7, f.run + f.landing - 0.5, u);
      const sv = shortVerge ? 1 - smoothstep(f.halfWidth + 0.3, f.halfWidth + 0.35 + HOUSE_WEST_BANK.northVerge, av) : 1 - smoothstep(f.halfWidth + 0.4, f.halfWidth + 1.3, av);
      stairW = Math.max(stairW, su * sv * clip);
      if (clip < 1) h = lerp(h0, h, clip);
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

  // Round 56 (live view only): the south exit (layout `EXPANSION_SOUTH`, terrain/south.ts) — the
  // far bank's mound the log burrows into, the hollow carved under the log's floor deck, and the
  // ravine cut into everything (the paths stop short of its lip). The ravine's walls are an
  // embankment for the detail passes (gullies down the fall line toward the centreline, ledges).
  let ravineBank = 0;
  let ravineFx = 0;
  let ravineFz = 0;
  if (live && z > 10 && inExpansionSouth(x, z)) {
    if (inBox(SB_BOX, x, z)) {
      const tl = tunnelLocal(x, z);
      h += bankHeight(x, z);
      const berm = tunnelBerm(tl.a, tl.c);
      if (berm > 0) h = Math.max(h, lerp(h, SOUTH_ROUTE.floorY + EXPANSION_SOUTH.tunnel.axisY - BERM_BELOW_AXIS, berm));
      const carve = tunnelCarve(tl.a, tl.c, h, SOUTH_ROUTE.floorY);
      if (carve.w > 0) {
        h = lerp(h, carve.y, carve.w);
        logW = Math.max(logW, carve.w);
      }
      // the mouth's threshold, from the paving's end to past the rim: no breakup or detail pass —
      // the log's floor deck starts level with the apron here (the breakup left it ± 20 cm)
      logW = Math.max(logW, smoothstep(-1.4, -0.8, tl.a) * (1 - smoothstep(0.9, 1.4, tl.a)) * (1 - smoothstep(1.35, 1.95, Math.abs(tl.c))));
    }
    const rp = ravineProfile(x, z);
    if (rp && rp.cut > 0) {
      // the floor: boulder lumps and a stony bed, strongest where the walls meet it
      const floorLumps = rp.g * rp.g * (0.22 * medium.fbm(x * 0.5 + 13, z * 0.5 - 6, 2) + 0.12 * fine.noise(x * 1.3, z * 1.3));
      h -= rp.cut - floorLumps;
      ravineBank = rp.wall * 0.55 * clamp(rp.hit.D / 8, 0.4, 1);
      ravineFx = rp.fx;
      ravineFz = rp.fz;
    }
    // under the deck's first metres the lip's rounded shoulder falls slower than the deck sags:
    // the ground there is held 0.16 m under the deck line (planks 5.5 cm), fading out past the deck's edge
    const bl = bridgeLocal(x, z);
    if (bl.a > 0.1 && bl.a < SOUTH_BRIDGE_LEN - 0.1 && Math.abs(bl.c) < 1.25) {
      const w = (1 - smoothstep(0.75, 1.25, Math.abs(bl.c))) * smoothstep(0.1, 0.45, bl.a) * (1 - smoothstep(SOUTH_BRIDGE_LEN - 0.45, SOUTH_BRIDGE_LEN - 0.1, bl.a));
      const B = EXPANSION_SOUTH.bridge;
      const ny = bridgeDeckY(bl.a, SOUTH_NORTH_SILL_Y + B.sill, SOUTH_FLOOR_Y + B.sill) - 0.16;
      if (w > 0 && h > ny) h = lerp(h, ny, w);
    }
  }

  // Round 57 (live view only): the waterfall ruins (layout `EXPANSION_RUINS`, terrain/ruins.ts) —
  // the outcrop raised to its level and the pool's basin; the bed and the outcrop's top keep off
  // the breakup and detail passes (they read as `logW`)
  if (live && x < -40 && inExpansionRuins(x, z)) {
    const rl = ruinsLandform(x, z, h);
    h = rl.h;
    logW = Math.max(logW, rl.flat);
  }

  // how much authored flat surface is here (detail passes fade out on it); the south bank's toe
  // strip counts as one so the paving edge and the foot of the bank stay at plaza level
  const suppress = clamp(Math.max(p.surface, stairW, padW, logW, p.toe), 0, 1);
  // round 48 (#14): the north clearing's skirt bank counts as an embankment, scaled by its rise
  // over the floor the way `edgeOf` scales the landform ramps (a 1.7 m bank peaks at ≈ 0.4)
  const discBank = p.bank * smoothstep(0.3, 1.2, Math.abs(land.h - p.y)) * 0.4;
  // round 49: the south terrace's face and skirts are an embankment too (peaks mid-slope, scaled
  // like `edgeOf` scales a 1.8 m terrace) so the detail passes erode and terrace it a little
  if (southTerraceW > 0 && southTerraceW < 1) {
    const terraceBank = 4 * southTerraceW * (1 - southTerraceW) * clamp(SOUTH_TERRACE.height / LAYOUT.terraces.eastPlateau.height, 0.35, 1) * 0.4;
    if (terraceBank > discBank) {
      // its fall line: down the face toward the plaza (the skirts share it — a small error there)
      const pt = { ...p, bankDx: SOUTH_TERRACE.faceX, bankDz: SOUTH_TERRACE.faceZ };
      return { h, land, p: pt, suppress, logW, embank: Math.max(land.embank, terraceBank) * (1 - suppress), discBank: terraceBank, hwBank };
    }
  }
  if (ravineBank > discBank) {
    const pr = { ...p, bankDx: ravineFx, bankDz: ravineFz };
    return { h, land, p: pr, suppress, logW, embank: Math.max(land.embank, ravineBank) * (1 - suppress), discBank: ravineBank, hwBank };
  }
  return { h, land, p, suppress, logW, embank: Math.max(land.embank, discBank) * (1 - suppress), discBank, hwBank };
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
    // round 48 (#14): the north clearing's skirt is cut into the plain by the disc's flattening,
    // not by the landform, so its fall line is radial (pathInfluence `bankDx/Dz`), not the
    // landform's gradient
    const ds = m.discBank > m.land.embank ? { dx: m.p.bankDx, dz: m.p.bankDz } : macroDownslope(x, z);
    const a = x * ds.dx + z * ds.dz; // along slope
    const c = -x * ds.dz + z * ds.dx; // across slope
    const gully = erosionNoise.ridged(c * 1.35 + 11.3, a * 0.28 - 4.1, 3); // 0..1, elongated downhill
    const gullyShape = smoothstep(0.35, 0.95, gully);
    erosion = gullyShape * m.embank;
    dh -= 0.26 * erosion;

    // terracing: soften the macro height toward quantised steps (soil ledges), noise-modulated
    const stepH = 0.55 + 0.25 * terraceNoise.noise(x * 0.05, z * 0.05);
    // (the skirt bank's steps quantise the flattened height — the landform is the flat plain there)
    const hb = m.discBank > m.land.embank ? m.h : m.land.h;
    const q = Math.round(hb / stepH) * stepH;
    const tAmt = m.embank * (0.28 + 0.3 * terraceNoise.fbm(x * 0.21 + 3.7, z * 0.21, 2));
    const tDelta = (q - hb) * clamp(tAmt, 0, 0.7);
    // ledge edge factor: strongest where we are near the riser of a terrace step
    const frac = Math.abs(((hb / stepH) % 1 + 1) % 1 - 0.5) * 2; // 0 at mid-step, 1 at riser
    terrace = m.embank * smoothstep(0.55, 1, frac);
    dh += tDelta;

    // 5. slope breakup: medium-frequency lumps so the ramps are not planar
    dh += m.embank * 0.11 * medium.fbm(x * 0.55 + 21, z * 0.55 - 9, 2);
  }

  // 3. shallow depressions on flat open ground (not on the authored south bank: its face is a
  // built slope, and a 12 cm dish would put the Kokiri kid's feet below frame 1's ground line)
  const dep = smoothstep(0.28, 0.72, medium.fbm(x * 0.11 + 7.5, z * 0.11 - 3.2, 2) * 0.5 + 0.5);
  const hollow = dep * (1 - m.embank) * open * (1 - 0.65 * m.land.plateau) * (1 - m.land.bank);
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
  // the house-west flight's earth face reads as dark mossy soil (frame 56 s): damp at 0.85, broken a little by the noise
  const damp = clamp(Math.max(northHollow * 0.9, foot * 0.35, hollow * 0.45, m.hwBank * 0.85) * (0.75 + 0.25 * (medium.fbm(x * 0.3, z * 0.3, 2) * 0.5 + 0.5)), 0, 1);

  return { dh, detail: { embank: m.embank, erosion, terrace, roots, damp, hollow, bank: m.land.bank } as TerrainDetail };
}

function hashAngle(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

function rawHeight(x: number, z: number, live = false): number {
  const m = macroHeight(x, z, live);
  let h = m.h;
  // Medium + small breakup, suppressed on paths, under the log-arch mouth and along the south bank's toe.
  const breakup = (1 - Math.max(m.p.surface, m.logW, m.p.toe)) * (medium.fbm(x * 0.35, z * 0.35, 3) * 0.14 + fine.noise(x * 1.7, z * 1.7) * 0.035);
  h += breakup;
  h += detailPasses(x, z, m).dh;
  return h;
}

/** Detail-pass factors at a point (for material layering / placement; the live view). Not cached. */
export function terrainDetail(x: number, z: number): TerrainDetail {
  return detailPasses(x, z, macroHeight(x, z, true)).detail;
}

/**
 * Round 49: the west house (a `distantHouse` at near scale round the `southwest-giant`'s bole) and
 * the far hut's bark column — `structure` in the live mask (no grass, the character does not walk
 * into the trunk; the hut's deck and floor are walkable surfaces the character ground adds above).
 */
const EXPANSION_STRUCTURES = [
  { x: EXPANSION.westHouse.host[0], z: EXPANSION.westHouse.host[1], r0: EXPANSION.westHouse.radius, r1: EXPANSION.westHouse.radius + 0.5 },
  { x: EXPANSION.farHut.host[0], z: EXPANSION.farHut.host[1], r0: EXPANSION.farHutTrunk.baseRadius + 0.1, r1: EXPANSION.farHutTrunk.baseRadius + 0.8 },
];

/**
 * The east lane's trunks (live): no grass on the pad, and the character stops half a metre past
 * the root flare (house.ts rings the base at 1.35 R; the pad's 0.5 level sits at 1.2 R + 0.5).
 */
const EAST_STRUCTURES = EXPANSION_EAST.houses.map((h) => ({ x: h.x, z: h.z, r0: h.radius * 1.2, r1: h.radius * 1.2 + 1.0 }));
/** the lookout's log bench as an oriented box (seat axis across `yawDeg`, the direction a sitter faces) */
const EAST_BENCH = (() => {
  const b = EXPANSION_EAST.lookout.bench;
  const a = (b.yawDeg * Math.PI) / 180;
  return { x: b.x, z: b.z, fx: Math.sin(a), fz: Math.cos(a), half: b.length * 0.5 + 0.1, depth: 0.42 };
})();
/**
 * The tall house's deck railings as walls 0.2 m either side of their line: off the deck's walk
 * strip (character ground: a built surface is never blocked) the railing stops the step, so the
 * deck is left by its plank steps only.
 */
const EAST_RAILS = eastDeckPlan().rails.map(([a, b]) => ({ ax: a[0], az: a[1], bx: b[0], bz: b[1], r: 0.2 }));
/** posts and goods standing on the lane's verges (the shop's sign, the pod-lantern posts, the shop's crates and baskets), the houses' root-buttress feet, the small house's doorstep and the lookout rope's stumps */
const EAST_POSTS = [
  { x: EXPANSION_EAST.shopSign.x, z: EXPANSION_EAST.shopSign.z, r: 0.22 },
  ...EXPANSION_EAST.lanternPosts.map((p) => ({ x: p.x, z: p.z, r: 0.2 })),
  ...eastShopSpots().map((s) => ({ x: s.x, z: s.z, r: s.foot })),
  ...eastHouseBlocks().map((b) => ({ x: b.x, z: b.z, r: b.r })),
  ...EXPANSION_EAST.lookout.anchors.map((a) => ({ x: a.x, z: a.z, r: a.r })),
];

/**
 * Cheap subset of `Terrain.mask` (no slope evaluation): paved surface, stair footprint and
 * structure pads. Used by placement loops that call it tens of thousands of times.
 * `view` (round 49): `legacy` (the default — every caller that existed before round 49 keeps its
 * numbers) or `live` (with the expansion: its flights, discs and structure pads).
 */
export function surfaceMask(x: number, z: number, view: TerrainView = 'legacy'): { path: number; stairs: number; structure: number } {
  const live = view === 'live';
  const p = pathInfluence(x, z, live);
  let stairs = 0;
  for (const f of framesFor(live)) {
    const { u, v } = stairLocal(f, x, z);
    // treads plus the two rows of landing slabs past the top step (see hardscape/stairs.ts). On the
    // main run's south-east side (v > 0, the flank cameras A and F look along) the mask stops 5 cm
    // past the tread ends instead of 25: round 23 raised that bank to lap the step ends, and the
    // 25 cm band was painting a bare-soil strip there that no grass could grow on (frame 1 s has
    // turf and leaves over the ends). The north-west side keeps its 25 cm for the kerb stones.
    // The house-west flight (round 31) has the same turf lap on its south-east side, and its
    // paved apron runs up to the first riser: the mask starts 5 cm in front of the riser face
    // there (30 cm elsewhere, the soil strip the main run's foot bank fills).
    const lapped = (f === stairFrames[0] || f === HOUSE_WEST) && v > 0;
    const margin = lapped ? 0.05 : 0.25;
    const front = f.apron ? -0.05 : -0.3;
    if (u > front && u < f.run + f.landing && Math.abs(v) < f.halfWidth + margin) stairs = 1;
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
  // round 47: the stone circle's standing stones (the north paving lays its slabs under them —
  // hardscape/flagstones.ts `pavedLevel` ignores this in its north pass; the character cannot walk
  // through them and no grass grows under them)
  structure = Math.max(structure, standingStoneMask(x, z));
  // round 49 (live): the west house's bole footprint and the far hut's column
  if (live) {
    for (const s of EXPANSION_STRUCTURES) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < s.r1) structure = Math.max(structure, 1 - smoothstep(s.r0, s.r1, d));
    }
    // round 56: the log's shell, the bridge's sill beams and its four end posts
    if (z > 10 && inExpansionSouth(x, z)) structure = Math.max(structure, southStructure(x, z));
    if (x >= EAST_BOX.x0 && x <= EAST_BOX.x1 && z >= EAST_BOX.z0 && z <= EAST_BOX.z1) {
      for (const s of EAST_STRUCTURES) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < s.r1) structure = Math.max(structure, 1 - smoothstep(s.r0, s.r1, d));
      }
      const B = EAST_BENCH;
      const dx = x - B.x;
      const dz = z - B.z;
      const across = dx * B.fz - dz * B.fx;
      const along = dx * B.fx + dz * B.fz;
      if (Math.abs(across) < B.half && Math.abs(along) < B.depth) structure = 1;
      for (const r of EAST_RAILS) {
        const ex = r.bx - r.ax;
        const ez = r.bz - r.az;
        const t = clamp(((x - r.ax) * ex + (z - r.az) * ez) / (ex * ex + ez * ez), 0, 1);
        if (Math.hypot(x - (r.ax + ex * t), z - (r.az + ez * t)) < r.r) structure = 1;
      }
      for (const p of EAST_POSTS) if (Math.hypot(x - p.x, z - p.z) < p.r) structure = 1;
    }
    // round 57: the ruins' masonry, the cliff's foot, the ivy rock and the gate boulders
    if (x < -40 && inExpansionRuins(x, z)) structure = Math.max(structure, ruinsStructure(x, z));
  }
  return { path: p.surface, stairs, structure };
}

/** round 56 (live): 1 on the log tunnel's shell footprint, the bridge's sill beams and end posts */
function southStructure(x: number, z: number): number {
  if (inBox(SB_BOX, x, z)) {
    const tl = tunnelLocal(x, z);
    if (tunnelFootprint(tl.a, tl.c) > 0) return 1;
  }
  const B = EXPANSION_SOUTH.bridge;
  const bl = bridgeLocal(x, z);
  if (Math.abs(bl.c) > B.postOut + 0.4 || bl.a < -1 || bl.a > SOUTH_BRIDGE_LEN + 1) return 0;
  for (const [a0, ap] of [
    [0, -B.postBack],
    [SOUTH_BRIDGE_LEN, SOUTH_BRIDGE_LEN + B.postBack],
  ]) {
    if (Math.abs(bl.a - a0) < 0.32 && Math.abs(bl.c) < B.deckHalfWidth + 0.3) return 1;
    for (const cs of [-1, 1]) if (Math.hypot(bl.a - ap, bl.c - cs * B.postOut) < 0.24) return 1;
  }
  return 0;
}

/**
 * Round 56: the south route's paved level alone (live view) — the strip from the spine's end to
 * the north sill and the far route to the log's mouth, 0 elsewhere (hardscape's `south` paving
 * pass lays exactly this, joined to the legacy paving at the spine's end cap).
 */
export function southRouteSurface(x: number, z: number): number {
  if (z <= 10 || !inExpansionSouth(x, z)) return 0;
  const sr = southRoute(x, z);
  if (!Number.isFinite(sr.dist)) return 0;
  return (1 - smoothstep(sr.hw * 0.85, sr.hw * 1.05, sr.dist)) * sr.clip;
}

/**
 * Round 49 — for the streams that build against the LEGACY view (trees, vegetation, rocks, props;
 * src/world/index.ts): true where a legacy-placed instance would now stand IN the expansion —
 * on a stepping disc (grass through the stones), inside a flight's footprint, on the west house's
 * bole or the far hut's column, or where the live ground differs from the legacy ground by more
 * than `lift` m (the bank's body and face, the knoll: an instance seated on the legacy plain
 * there is buried, or floats). Apply it AFTER a placement loop as a filter
 * (`instances.filter((i) => !expansionCull(i.x, i.z))`): a filter re-rolls nothing, so the six
 * fixed frames keep every instance they show, and only the expansion's own ground is cleared.
 * Everything outside `EXPANSION_BOX` and the far hut's knoll returns false at the cost of a
 * bounds test.
 *
 * `east` (default on): the east lane's discs, trunk pads and bench (layout `EXPANSION_EAST`,
 * inside `EAST_BOX`) cull too. Off for a test that runs INSIDE a rejection loop or whose culls
 * cascade (the white-barks feed the understory and mid samplers): there a new true re-rolls
 * every later draw.
 */
export function expansionCull(x: number, z: number, lift = 0.3, all = true): boolean {
  // round 56/57: `all` false — the rules as they stood before the east lane and the ruins — for a test
  // INSIDE a sampling loop (trees' understory), which filters the lane and the ruins afterwards
  // instead so no later draw moves (util/eastLane `eastUnderstoryCull`, `ruinsTrunkCull`)
  if (all && ruinsCull(x, z, lift)) return true;
  // round 56: the south exit (`EXPANSION_SOUTH_BOXES`) — its paving, the log / sills / posts, and
  // wherever its live ground left the legacy ground (the ravine, the mound, the carve)
  // (an instance left FLOATING over lowered ground reads worse than one sunk a little: 4 cm down
  // culls — a leaf or a pebble that far up casts a detached shadow, and W07's litter gap is 5 cm —
  // `lift` up)
  if (z > 10 && inExpansionSouth(x, z)) {
    if (southRouteSurface(x, z) > 0.5 || southStructure(x, z) > 0.5) return true;
    const rp = ravineProfile(x, z);
    if (rp && rp.cut > 0.04) return true;
    const dh = getTerrain().height(x, z) - getLegacyTerrain().height(x, z);
    if (dh < -0.04 || dh > lift) return true;
  }
  return westExpansionCull(x, z, lift, all);
}

/**
 * Round 57 (expansion-ruins): the ruins' rule for the legacy streams — true on the trail (its
 * earth and a little past it), on the ruins' built footprints (the terrace, the stair, the walls,
 * everything behind the cliff's face, the ivy rock, the gate boulders), in the pool and on its wet
 * shore, and where the live ground left the legacy one (the outcrop, the basin's banks, the
 * trail's flattening) by more than `lift` m up or 4 cm down. False outside `EXPANSION_RUINS_BOXES`.
 */
export function ruinsCull(x: number, z: number, lift = 0.3): boolean {
  if (x > -12 || !inExpansionRuins(x, z)) return false;
  const tr = trailNearest(RUINS_TRAIL, x, z);
  if (tr && tr.dist < trailHalfWidth(tr.s) * 1.2) return true;
  if (x < -40 && (ruinsStructure(x, z) > 0.5 || inStairCut(x, z, 0.3) || poolSigned(x, z) < 0.3)) return true;
  const dh = getTerrain().height(x, z) - getLegacyTerrain().height(x, z);
  return dh < -0.04 || dh > lift;
}

/**
 * Round 57: a legacy-sampled trunk against the ruins — `ruinsCull` at its centre or anywhere on a
 * ring `reach` m out (the bole, its flare and the root toes keep off the trail and the masonry).
 */
export function ruinsTrunkCull(x: number, z: number, reach: number): boolean {
  if (x > -12 + reach) return false;
  if (ruinsCull(x, z)) return true;
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    if (ruinsCull(x + Math.cos(t) * reach, z + Math.sin(t) * reach)) return true;
  }
  return false;
}

/**
 * `expansionCull` without the south exit's rules: the round-49 expansion alone (the west bank, the
 * stepping discs, the far hut's knoll), and the east lane with `east`. Its box overlaps the south
 * exit's first box (x −6.6…−2.7, z 10.8…25.7), so a stream that must keep the set it drew before
 * round 56 filters by this.
 */
export function westExpansionCull(x: number, z: number, lift = 0.3, east = true): boolean {
  const F = EXPANSION.farHut;
  const onKnoll = Math.hypot(x - F.host[0], z - F.host[1]) < EXPANSION.farHutRise.radius + 0.5;
  const inWest = onKnoll || (x >= EXPANSION_BOX.x0 && x <= EXPANSION_BOX.x1 && z >= EXPANSION_BOX.z0 && z <= EXPANSION_BOX.z1);
  const inEast = east && x >= EAST_BOX.x0 && x <= EAST_BOX.x1 && z >= EAST_BOX.z0 && z <= EAST_BOX.z1;
  if (!inWest && !inEast) return false;
  // the discs by their circles (the first ones' splat is faded by `cClip`; the stones are laid whole)
  if (inWest) for (const d of EXPANSION_STONES) if (Math.hypot(x - d.x, z - d.z) < d.r + 0.12) return true;
  if (inEast) for (const d of EAST_STONES) if (Math.hypot(x - d.x, z - d.z) < d.r + 0.12) return true;
  // the masks the expansion ADDED (live over legacy): the box's north-east corner holds the plaza
  // disc's south-west rim, whose own paving mask must not cull what already avoids it
  const m = surfaceMask(x, z, 'live');
  const l = surfaceMask(x, z, 'legacy');
  if ((m.path > 0.5 && l.path <= 0.5) || (m.stairs > 0.5 && l.stairs <= 0.5) || (m.structure > 0.5 && l.structure <= 0.5)) return true;
  return Math.abs(getTerrain().height(x, z) - getLegacyTerrain().height(x, z)) > lift;
}

/**
 * Round 56: a legacy-sampled trunk's footing on the south exit's LIVE ground — null outside
 * `EXPANSION_SOUTH_BOXES` (`expansionCull` decides there). 'cull' where its point or a ring `reach`
 * m out touches the paving or the log / sills / posts, where the gorge cuts more than
 * `SOUTH_LIP_SINK_M` under it or a ring `lipReach` m out (the bole's own rim: a tree may stand at
 * the gorge's edge, its base sunk that much at most), or where the live ground is steeper than
 * 0.55 (the white-barks' own rule, trees/placement.ts); 'keep' where both views agree; 'live'
 * where the live ground left the legacy one (the far bank's rise, the lip's first centimetres):
 * the trunk stands on it at its centre's height, like every sampled stem (W12 audits the base
 * there), and is dropped instead where the ground under its rim ring falls further than its
 * below-ground skirt reaches (`SOUTH_RIM_FALL_M`).
 */
export function southFooting(x: number, z: number, reach: number, lipReach = reach): 'keep' | 'live' | 'cull' | null {
  if (!(z > 10 && inExpansionSouth(x, z))) return null;
  const built = (px: number, pz: number) => southRouteSurface(px, pz) > 0.5 || southStructure(px, pz) > 0.5;
  const cut = (px: number, pz: number) => ravineProfile(px, pz)?.cut ?? 0;
  if (built(x, z)) return 'cull';
  const live = getTerrain();
  const y = live.height(x, z);
  let deepest = cut(x, z);
  let fall = 0;
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    const cx = Math.cos(t);
    const sz = Math.sin(t);
    if (built(x + cx * reach, z + sz * reach)) return 'cull';
    deepest = Math.max(deepest, cut(x + cx * lipReach, z + sz * lipReach));
    fall = Math.max(fall, y - live.height(x + cx * lipReach, z + sz * lipReach));
  }
  if (deepest > SOUTH_LIP_SINK_M || live.slope(x, z) > 0.55) return 'cull';
  if (deepest <= 0.04 && Math.abs(y - getLegacyTerrain().height(x, z)) <= 0.02) return 'keep';
  return fall > SOUTH_RIM_FALL_M ? 'cull' : 'live';
}
/** the deepest the gorge may cut under a trunk's rim at the lip before it is dropped (m) */
const SOUTH_LIP_SINK_M = 0.35;
/** the furthest the live ground may fall under a live-seated trunk's rim ring (`lipReach`) (m) — inside the boles' 0.5–0.6 m below-ground skirts */
const SOUTH_RIM_FALL_M = 0.45;

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

/**
 * Lattice sample caches shared by every terrain instance of a view (the legacy and the live views
 * are separate maps: the same numbers outside the expansion footprints, `inExpansionFootprint`).
 */
const SAMPLE_CACHES: Record<TerrainView, Map<number, number>[]> = { live: [new Map(), new Map(), new Map()], legacy: [new Map(), new Map(), new Map()] };

export function createTerrain(view: TerrainView = 'live'): Terrain {
  const live = view === 'live';
  const caches = SAMPLE_CACHES[view];
  const KEY = 1 << 20;
  const OFF = 1 << 19;

  /** float32 rawHeight at a lattice point of `zone` (cached by integer lattice coords) */
  const rawSample = (zone: Zone, gi: number, gj: number): number => {
    const key = (gi + OFF) * KEY + (gj + OFF);
    const cache = caches[zone];
    const c = cache.get(key);
    if (c !== undefined) return c;
    const s = ZONES[zone].spacing;
    const h = Math.fround(rawHeight(gi * s, gj * s, live));
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
    const sm = surfaceMask(x, z, view);
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

/** Convenience singleton — most systems just need one shared terrain (the LIVE view: the rendered ground). */
let shared: Terrain | null = null;
export function getTerrain(): Terrain {
  if (!shared) shared = createTerrain('live');
  return shared;
}

/**
 * Round 49: the LEGACY view — the ground as take-0121 left it, without the expansion (see
 * `TerrainView`). src/world/index.ts hands it to the trees, rocks, vegetation, props, canopy and
 * atmosphere systems so their rejection-sampled streams read exactly the numbers they read before.
 */
let sharedLegacy: Terrain | null = null;
export function getLegacyTerrain(): Terrain {
  if (!sharedLegacy) sharedLegacy = createTerrain('legacy');
  return sharedLegacy;
}
