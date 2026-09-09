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
  pathSpine: [
    [1, 0, 16],
    [0, 0, 8],
    [0, 0, 0],
    [-0.8, 0, -6],
    [-1.2, 0, -12],
    [-2, 1.2, -18],
    [-1.5, 1.4, -26],
    [2, 1.7, -34],
    [4, 1.9, -42],
    [5, 2.0, -50],
  ] as [number, number, number][],
  pathHalfWidth: 2.4,

  /** Branch from the plaza east to the foot of the main stairs. */
  pathToStairs: [
    [0, 0, 0],
    [3.5, 0, -0.8],
    [7.0, 0, -1.4],
  ] as [number, number, number][],

  /** Branch from the plaza north-east up the short stair to the house terrace. */
  pathToHouse: [
    [0.5, 0, -2],
    [4.0, 0, -6.5],
    [6.5, 1.2, -9.5],
    [9.6, 1.2, -9.3],
  ] as [number, number, number][],

  stairs: [
    // The hero stairway of shot A — 18 wide, worn, moss-edged steps climbing to the east plateau.
    { id: 'main', base: [7.5, 0, -1.5], dir: [1, -0.35], steps: 18, rise: 0.3, tread: 0.42, width: 2.7 },
    // Short stair up to the Kokiri house terrace (right side of shot D).
    { id: 'house', base: [4.6, 0, -7.2], dir: [0.66, -0.75], steps: 4, rise: 0.3, tread: 0.5, width: 2.2 },
    // Small steps on the north path to the boulder terrace (centre-left of shot B).
    { id: 'north', base: [-1.4, 0, -13.5], dir: [-0.12, -1], steps: 4, rise: 0.3, tread: 0.5, width: 2.6 },
  ] as StairDef[],

  /** Terraces / plateaus that the heightfield honours (soft-edged). */
  terraces: {
    eastPlateau: { height: 5.4 },
    westLedge: { height: 2.6 },
    houseTerrace: { height: 1.2 },
    northTerrace: { height: 1.2 },
  },

  houses: [
    { id: 'saria', position: [12.5, 1.2, -11.5], trunkRadius: 3.2, facing: [-0.7, 0.72], roofHeight: 6.5, lanterns: 3 },
    { id: 'upper', position: [23, 5.4, -9], trunkRadius: 2.7, facing: [-1, 0.15], roofHeight: 5.0, lanterns: 2 },
  ] as HouseDef[],

  signposts: [
    { id: 'saria-sign', position: [7.6, 1.2, -9.6] as [number, number, number], facing: [-0.6, 0.8] as [number, number] },
  ],

  /** Wooden fence lines (post-and-rail) along the east plateau edge, as seen at the top of the stairs. */
  fences: [
    { id: 'plateau-west', points: [[16.5, 5.4, 4], [16.5, 5.4, -1.5]] as [number, number, number][] },
    { id: 'plateau-north', points: [[16.5, 5.4, -6.5], [16.5, 5.4, -13], [20, 5.4, -14.5]] as [number, number, number][] },
  ],

  /** Big branch hanging over the path with 3 glowing pod lanterns (left side of shot A). */
  lanternBranch: {
    from: [-10.5, 5.8, -6.8] as [number, number, number],
    to: [3.0, 3.9, 0.2] as [number, number, number],
    lanterns: 3,
  },

  logArch: {
    /** giant hollow fallen log lying roughly east-west, the far landmark of shot D */
    position: [6, 1.8, -34] as [number, number, number],
    radius: 3.6,
    length: 22,
    yawDeg: 15,
    lanterns: 2,
  },

  /** Mossy boulders that are compositionally important (many smaller rocks are procedural). */
  heroBoulders: [
    { id: 'terrace-boulder', position: [-4.5, 1.2, -19.5] as [number, number, number], radius: 2.2 },
    { id: 'shot-d-boulder', position: [-3.6, 0, -11] as [number, number, number], radius: 0.9 },
    { id: 'stair-foot', position: [9.5, 0.2, 1.6] as [number, number, number], radius: 0.8 },
  ],

  /** Giant old trees. Canopies of these form the overhead cover (14–24 m). */
  giantTrees: [
    { id: 'lantern-tree', position: [-11.5, 2.6, -7.2], trunkRadius: 1.7, height: 26, limb: { dir: [0.89, 0.455], length: 16.3, height: 5.8 } },
    { id: 'plateau-oak', position: [19, 5.4, -21], trunkRadius: 1.5, height: 24 },
    { id: 'southwest-giant', position: [-23, 2.6, 9], trunkRadius: 1.9, height: 28 },
    { id: 'east-giant', position: [27, 5.4, 5], trunkRadius: 1.4, height: 24 },
    { id: 'north-west', position: [-13, 1.9, -33], trunkRadius: 1.3, height: 22 },
    { id: 'north-east', position: [15, 2.0, -37], trunkRadius: 1.5, height: 24 },
    { id: 'far-plateau', position: [31, 5.4, -30], trunkRadius: 1.7, height: 26 },
    { id: 'south-giant', position: [12, 0, 22], trunkRadius: 1.4, height: 23 },
    { id: 'south-centre', position: [-4.5, 0, 27], trunkRadius: 1.8, height: 27 },
  ] as GiantTreeDef[],

  /** Where the Kokiri kids / Link will stand later (Phase 2). Used now only to keep clear ground. */
  npcSpots: [
    { id: 'link-spawn', position: [0, 0, 0.5] as [number, number, number] },
    { id: 'kokiri-a', position: [10.8, 0.9, 2.2] as [number, number, number] },
    { id: 'kokiri-b', position: [-6.5, 0.1, -2] as [number, number, number] },
  ],

  viewpoints: [
    { id: 'A_stairs', refSeconds: 1, label: 'The Stairs', position: [0.4, 1.8, 8.6], target: [8.6, 3.0, -4.8], fov: 46 },
    { id: 'B_house', refSeconds: 14, label: "Saria's House", position: [-1.6, 1.8, 6.4], target: [5.2, 2.3, -12.5], fov: 46 },
    { id: 'C_lookback', refSeconds: 46, label: 'Look Back', position: [3.2, 1.8, -9.5], target: [3.9, 2.5, 3.5], fov: 46 },
    { id: 'D_log', refSeconds: 56, label: 'The Log Arch', position: [1.2, 1.9, -1.0], target: [5.5, 3.2, -40], fov: 48 },
    { id: 'E_ground', refSeconds: 24, label: 'Ground Close-up', position: [-1.2, 0.55, 2.5], target: [2, 0.1, -3], fov: 50, diagnostic: true },
    { id: 'F_canopy', refSeconds: 8, label: 'Canopy & Shafts', position: [0, 1.7, 4], target: [-6, 14, -14], fov: 55, diagnostic: true },
  ] as Viewpoint[],
} as const;

export type Layout = typeof LAYOUT;

export function v3(a: readonly [number, number, number]): Vector3 {
  return new Vector3(a[0], a[1], a[2]);
}

export function getViewpoint(id: string): Viewpoint | undefined {
  return LAYOUT.viewpoints.find((v) => v.id === id);
}
