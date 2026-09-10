/**
 * AUTHORED WORLD LAYOUT — the single source of truth for WHERE things are.
 *
 * Coordinates: metres, +Y up, +X east, -Z north (into the scene from the default camera).
 * The plaza where Link stands in reference shot B (frame ~14 s) is the origin.
 *
 * Reference shots (see reference/ANALYSIS.md and reference/frames/):
 *   A "stairs"   ~0–8 s   : long stone stairway climbing right/east to an upper ledge with fences;
 *                           lantern branch hanging over the path on the left; mist + shafts behind.
 *   B "house"    ~13–25 s : Kokiri tree-trunk house with mossy dome roof + glowing pod lanterns on
 *                           the right, wooden signpost, path leading north to a mossy boulder terrace.
 *   C "lookback" ~45–50 s : stairs now on the LEFT; Kokiri NPC on grass; giant tree in the distance.
 *   D "log"      ~55–60 s : short stair on the right, huge hollow log arch ahead in the mist, purple
 *                           flowers + mossy boulder in the left foreground.
 *   E "hold"     ~24 s    : the B camera held ten seconds later (same pose).
 *   F "up"       ~8 s     : eye level on the plaza looking dead up the stair axis; canopy fills the
 *                           top half, fence posts along the plateau lip, the upper house top-left.
 *
 * Any agent may READ this file. Only change values here when a reference comparison demands it and
 * record the change in your .agents/<agent>.md log — several systems depend on these numbers.
 */
import { Vector3 } from 'three';

export interface StairDef {
  id: string;
  /** world position of the centre of the bottom riser at ground level */
  base: [number, number, number];
  /** horizontal direction of ascent (normalised in code) */
  dir: [number, number];
  steps: number;
  rise: number;
  tread: number;
  width: number;
}

export interface HouseDef {
  id: string;
  /** centre of the trunk at terrace ground level */
  position: [number, number, number];
  trunkRadius: number;
  /** horizontal facing direction of the door */
  facing: [number, number];
  roofHeight: number;
  lanterns: number;
}

export interface GiantTreeDef {
  id: string;
  position: [number, number, number];
  trunkRadius: number;
  height: number;
  /** optional big near-horizontal limb: direction + length (used for the lantern branch) */
  limb?: { dir: [number, number]; length: number; height: number };
}

export interface Viewpoint {
  id: string;
  /** which reference frame (seconds into the video) this shot matches */
  refSeconds: number;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /**
   * Diagnostic cameras (ground close-up, canopy look-up) do not share framing with their reference
   * frame; the frame is a material/lighting reference only. Image-similarity metrics must not be
   * computed or displayed for them — only A–D are matched compositions.
   */
  diagnostic?: boolean;
}

export const LAYOUT = {
  /** Main flagstone spine: south approach → plaza → north terrace → log arch. */
  // North of the plaza the spine bears slightly EAST (reference B recedes at x ≈ 0.3–0.6, on the
  // D axis), runs level through a misty hollow (reference D: mist pool before the arch) and then
  // climbs ≈ 3.4 m to the arch, whose feet sit well above camera D (opening centre y ≈ 0.37).
  // The raised bank with the small steps is WEST of the hollow (see stairs.north).
  pathSpine: [
    [1, 0, 16],
    [0, 0, 8],
    [0, 0, 0],
    [0.6, 0, -6],
    [1.5, 0, -12],
    [2.0, -0.1, -18],
    [1.8, -0.13, -24],
    [2.5, 1.7, -30],
    [3.5, 3.35, -36],
    [4.5, 4.3, -42],
    [5.2, 5.6, -50],
    [5.8, 5.8, -58],
  ] as [number, number, number][],
  pathHalfWidth: 2.4,

  /** Branch from the plaza east to the foot of the main stairs. */
  pathToStairs: [
    [0, 0, 0],
    [3.5, 0, -0.6],
    [6.5, 0, -1.3],
    [8.6, 0, -1.8],
  ] as [number, number, number][],

  /**
   * Branch from the plaza north-east up to Saria's door. Reference B/E (frames 14 s / 24 s): this is
   * NOT continuous paving — isolated round stepping stones climb a grassy slope to a door that sits
   * only ~0.9 m above the plaza, no stair (the 4-step terrace stair of earlier rounds put a flight
   * of steps in the centre of B where the footage has lawn). The heightfield flattens the ground
   * to this polyline's y (a smooth ramp) and paves only the stones in `houseSteppingStones()`.
   */
  pathToHouse: [
    [0.5, 0, -2],
    [4.0, 0.08, -6.5],
    [6.6, 0.5, -8.6],
    [9.6, 0.9, -9.3],
  ] as [number, number, number][],
  /** stepping stones along `pathToHouse`: first stone `from` metres in (past the plaza rim) */
  steppingStones: { from: 3.2, spacing: 1.3, radius: [0.36, 0.5] as [number, number], wobble: 0.28 },

  stairs: [
    // The hero stairway of shot A — 18 wide, worn, moss-edged steps climbing to the east plateau.
    // In reference frame 1 the run reads almost radial from the camera (bottom centre x ≈ 0.71,
    // top ≈ 0.74, base ≈ 17 m away), so it runs at bearing ≈ 55° — only ~16° off camera A's
    // ray — rather than due east, and its base sits 13.7 m from the camera. The plateau ramp
    // follows this frame, so W04's probe at (18, -4) must stay on the 5.4 m top.
    { id: 'main', base: [9.0, 0, -2.0], dir: [1, -0.7], steps: 18, rise: 0.3, tread: 0.42, width: 3.2 },
    // Small steps climbing WEST off the north path onto the mossy boulder bank (reference B: steps
    // at (0.2–0.25, 0.33–0.40) left of the receding path; reference D: shrubby bank at x 0.15–0.35).
    // The base sits just off the paved edge so the first riser meets flattened ground.
    { id: 'north', base: [-0.9, 0, -16], dir: [-0.6, -0.8], steps: 6, rise: 0.3, tread: 0.5, width: 2.6 },
  ] as StairDef[],

  /** Terraces / plateaus that the heightfield honours (soft-edged). */
  terraces: {
    eastPlateau: { height: 5.4 },
    westLedge: { height: 2.6 },
    // 0.9: reference B/E show the door threshold ~0.9 m above the plaza at the top of a grassy
    // stepping-stone slope (W04's probe at (9, -12.5) allows 1.2 ± 0.35; proposal filed for 0.4)
    houseTerrace: { height: 0.9 },
    /** the boulder bank west of the north path (top of stairs.north; terrace-boulder sits on it) */
    northTerrace: { height: 2.6 },
  },

  houses: [
    { id: 'saria', position: [12.5, 0.9, -11.5], trunkRadius: 3.2, facing: [-0.7, 0.72], roofHeight: 6.5, lanterns: 3 },
    // On the plateau north of the fenced lip: reference F shows a second, smaller tree-house at the
    // top-left of the stairs (0.13–0.25, 0.13–0.20), ~24 m from camera F; projects to A (0.53, 0.18)
    // and the top-right corner of D, both hazed.
    { id: 'upper', position: [13.5, 5.4, -17.5], trunkRadius: 2.7, facing: [-0.7, 0.7], roofHeight: 5.0, lanterns: 2 },
  ] as HouseDef[],

  signposts: [
    // projects to x ≈ 0.58 in shot B, where the reference frame 14 has the sign left of the door
    { id: 'saria-sign', position: [7.0, 1.2, -9.3] as [number, number, number], facing: [-0.6, 0.8] as [number, number] },
  ],

  /** Wooden fence lines (post-and-rail) along the east plateau edge, as seen at the top of the stairs. */
  fences: [
    // Both runs follow the plateau lip (perpendicular to the stair run, ~0.5 m inside the top edge).
    { id: 'plateau-west', points: [[18.2, 5.4, -5.5], [21.6, 5.4, -0.6], [23.3, 5.4, 1.9]] as [number, number, number][] },
    { id: 'plateau-north', points: [[18.0, 5.4, -10.3], [18.8, 5.4, -12.8], [20.2, 5.4, -15.4]] as [number, number, number][] },
  ],

  /** Big branch hanging over the path with 3 glowing pod lanterns (left side of shot A). */
  lanternBranch: {
    // Projected into shot A this runs in from the left edge at y ≈ 0.15–0.3 and ends near
    // (0.26, 0.39) with pods hanging around (0.1, 0.45) — the reference bough — while staying in
    // the upper quarter of shot B (reference B has the giant's limb over the house there).
    // `from` marks where the visible, lantern-bearing part of the limb begins (the giant builder
    // grows the limb from the trunk to it); the midpoint must project inside shot A for W01.
    // The bough itself rides high (y ≈ 0.15–0.3 in A, mostly above shot B's frame); the pods
    // hang on long cords to the reference's y ≈ 0.45.
    from: [-4.0, 4.6, -5.0] as [number, number, number],
    to: [1.5, 3.6, -2.6] as [number, number, number],
    /** limb radius at `from` / at `to` (metres); the reference bough is ~0.4 m thick, not a log */
    radius: 0.42,
    tipRadius: 0.16,
    lanterns: 3,
  },

  logArch: {
    /**
     * Giant hollow fallen log lying roughly east-west across the north path, the far landmark of
     * shot D. In frame 56 s it spans x 0.40–0.75 and y 0.27–0.45 with its feet ≈ 2 m above the
     * camera: ≈ 47 m away on ground ≈ 5.6 m above the plaza (body ≈ 6 m thick, opening ≈ 4 m).
     * The east end runs away north (yaw) so the log climbs to the right in the frame.
     */
    position: [5.6, 5.6, -50] as [number, number, number],
    radius: 3.0,
    length: 22,
    yawDeg: 20,
    lanterns: 2,
  },

  /** Mossy boulders that are compositionally important (many smaller rocks are procedural). */
  heroBoulders: [
    // on the boulder bank, clear of the north steps' landing (top of the 6 steps ≈ (−2.7, 1.8, −18.4))
    { id: 'terrace-boulder', position: [-5.2, 2.6, -20.2] as [number, number, number], radius: 2.2 },
    // left-centre of shot D (reference 0.10–0.22, 0.66–0.75), just off the paved edge and clear of
    // the north-west-near giant's roots
    { id: 'shot-d-boulder', position: [-2.6, 0, -9.6] as [number, number, number], radius: 0.9 },
    // right edge of shot A (≈ 0.9, 0.7): the mossy rock the Kokiri kid stands beside
    { id: 'stair-foot', position: [9.1, 0.2, 2.5] as [number, number, number], radius: 1.0 },
  ],

  /** Giant old trees. Canopies of these form the overhead cover (14–24 m). */
  giantTrees: [
    { id: 'lantern-tree', position: [-11.5, 2.6, -7.2], trunkRadius: 1.7, height: 26, limb: { dir: [0.87, 0.49], length: 14.5, height: 5.3 } },
    { id: 'plateau-oak', position: [19, 5.4, -21], trunkRadius: 1.5, height: 24 },
    { id: 'southwest-giant', position: [-23, 2.6, 9], trunkRadius: 1.9, height: 28 },
    { id: 'east-giant', position: [27, 5.4, 5], trunkRadius: 1.4, height: 24 },
    { id: 'north-west', position: [-13, 1.9, -33], trunkRadius: 1.3, height: 22 },
    { id: 'north-east', position: [15, 2.0, -37], trunkRadius: 1.5, height: 24 },
    { id: 'far-plateau', position: [31, 5.4, -30], trunkRadius: 1.7, height: 26 },
    { id: 'south-giant', position: [12, 0, 22], trunkRadius: 1.4, height: 23 },
    { id: 'south-centre', position: [-4.5, 0, 27], trunkRadius: 1.8, height: 27 },
    // Reference C: a hazed giant trunk fills the centre-top (0.50–0.62, 0–0.35) ~30 m from the
    // camera with a Y-fork of spreading limbs (trees GIANT_PROFILES); projects to x ≈ 0.56 at
    // 30 m, behind every other camera, 4.5 m past the south end of the spine.
    { id: 'plaza-south', position: [4.4, 0, 20.5], trunkRadius: 2.2, height: 26 },
    // Reference B/D/A: a big dark trunk cuts the LEFT edge (B 0.0–0.10, D 0.0–0.12, A behind the
    // pods). Between the north path and the boulder bank, 6 m west of the spine.
    { id: 'north-west-near', position: [-5.0, 0, -12.8], trunkRadius: 1.1, height: 24 },
    // Reference F: a big dark trunk cuts the RIGHT edge (0.9–1.0, top down to the bank at y ≈ 0.7)
    // 8–9 m from the camera at the south foot of the stair-side bank; 6.9 m off the paved east
    // lobe, behind B/D/E, beyond A's right edge, a hazed column at x ≈ 0.32 in C's background
    // (the reference C shows a trunk behind the kid there). Profile: trees GIANT_PROFILES.
    { id: 'stair-bank-giant', position: [10.1, 0, 7.0], trunkRadius: 1.1, height: 21 },
  ] as GiantTreeDef[],

  /** Where the Kokiri kids / Link will stand later (Phase 2). Used now only to keep clear ground. */
  npcSpots: [
    { id: 'link-spawn', position: [0, 0, 0.5] as [number, number, number] },
    // grass verge in front of the stair-foot rock: right edge of A at 8 m (the layout spot behind the
    // rock was hidden by it); the character system marches F's own spot
    { id: 'kokiri-a', position: [9.0, 0, 3.6] as [number, number, number] },
    // west lawn, out of A/C/D/F; the character system marches B/E's left-edge spot itself
    { id: 'kokiri-b', position: [-6.5, 0, -2] as [number, number, number] },
  ],

  viewpoints: [
    // Level aim at bearing 23.5° (the reference camera is not pitched): stair run at x ≈ 0.68–0.76,
    // base y ≈ 0.66, top y ≈ 0.29; pods around x ≈ 0.15–0.3, y ≈ 0.45.
    // Eye height 1.45 m: Link (1.25 m) spans y 0.56–0.88 at 4.6 m in the reference, which only a
    // camera at ≈ 1.45 m gives with his feet at 0.88; the stair foot/top move to 0.63 / 0.26.
    { id: 'A_stairs', refSeconds: 1, label: 'The Stairs', position: [0.4, 1.45, 8.6], target: [6.7, 1.45, -5.8], fov: 46 },
    // Projected: house 0.68–0.88 with the door at (0.78, 0.48) ≈ reference (0.80, 0.50); sign 0.66; small steps 0.19.
    { id: 'B_house', refSeconds: 14, label: "Saria's House", position: [0, 1.5, 2.0], target: [5, 1.7, -12], fov: 46 },
    // Looking back SSE across the plaza with the stair foot cutting the left edge (0.12, 0.67;
    // reference 0.10–0.20, 0.60–0.66), the stair-foot rock at (0.28, 0.50) and the plaza-south
    // giant's trunk at x ≈ 0.58 in the haze (reference 0.50–0.62). Pitched ≈ 3.5° down.
    { id: 'C_lookback', refSeconds: 46, label: 'Look Back', position: [3.2, 1.45, -9.5], target: [4.9, 0.65, 3.4], fov: 46 },
    // Stands 2 m past the bough's tip so the pods stay behind the camera; the house stair then
    // sits at the right edge (x ≈ 0.9) as in the reference.
    // On the spine's axis so the flagstones fill the whole foreground as in the reference.
    { id: 'D_log', refSeconds: 56, label: 'The Log Arch', position: [0.2, 1.45, -3.0], target: [4.5, 2.75, -42], fov: 48 },
    // Frame 24 s is the same held camera as frame 14 s ten seconds later (Link has walked on):
    // identical pose so the two captures bracket the B composition.
    { id: 'E_ground', refSeconds: 24, label: "Saria's House (hold)", position: [0, 1.5, 2.0], target: [5, 1.7, -12], fov: 46 },
    // Frame 8 s: eye level on the plaza, dead along the stair axis 12.6 m before the bottom riser,
    // pitched 3.3° down — stair foot (0.42, 0.59) / top (0.42, 0.21) vs reference (0.42, 0.60) /
    // (0.42, 0.22); kid spot (0.66, 0.46); plateau-west fence posts along y ≈ 0.19; the upper house
    // roof at the top-left (0.14, 0.04–0.2). The canopy fills the top half.
    { id: 'F_canopy', refSeconds: 8, label: 'Up the Stairs', position: [-1.04, 1.5, 5.64], target: [10.22, 1.06, -0.86], fov: 46 },
  ] as Viewpoint[],
} as const;

export type Layout = typeof LAYOUT;

export function v3(a: readonly [number, number, number]): Vector3 {
  return new Vector3(a[0], a[1], a[2]);
}

export function getViewpoint(id: string): Viewpoint | undefined {
  return LAYOUT.viewpoints.find((v) => v.id === id);
}

export interface SteppingStone {
  x: number;
  /** ground height of the path at the stone (the stone top sits a few cm above) */
  y: number;
  z: number;
  /** radius (m) */
  r: number;
}

/**
 * Deterministic stepping stones along `pathToHouse` (terrain paves exactly these discs; hardscape
 * builds a slab per disc; vegetation keeps grass off them). Stones start `from` metres along the
 * polyline, every `spacing` m (±12 %), zig-zagging ±`wobble` m across the line like the footage's
 * loosely laid slabs, and stop 0.7 m short of the door.
 */
export function houseSteppingStones(): SteppingStone[] {
  const pts = LAYOUT.pathToHouse;
  const { from, spacing, radius, wobble } = LAYOUT.steppingStones;
  const segs: { ax: number; ay: number; az: number; dx: number; dy: number; dz: number; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i];
    const [bx, by, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    segs.push({ ax, ay, az, dx: (bx - ax) / len, dy: (by - ay) / len, dz: (bz - az) / len, len });
    total += len;
  }
  const hash = (n: number) => {
    // small integer hash → [0, 1); keeps the layout free of the world PRNG
    let h = (n * 374761393 + 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const out: SteppingStone[] = [];
  let d = from;
  for (let i = 0; d < total - 0.7 && i < 64; i++) {
    let rem = d;
    let k = 0;
    while (k < segs.length - 1 && rem > segs[k].len) rem -= segs[k++].len;
    const sg = segs[k];
    const side = (i % 2 === 0 ? 1 : -1) * wobble * (0.6 + 0.4 * hash(i * 3 + 1));
    out.push({
      x: sg.ax + sg.dx * rem - sg.dz * side,
      y: sg.ay + sg.dy * rem,
      z: sg.az + sg.dz * rem + sg.dx * side,
      r: radius[0] + (radius[1] - radius[0]) * hash(i * 3 + 2),
    });
    d += spacing * (0.88 + 0.24 * hash(i * 3));
  }
  return out;
}
