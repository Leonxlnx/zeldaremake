/**
 * World system contract. Every subsystem (terrain, trees, vegetation, structures,
 * atmosphere, lighting, rocks, hardscape…) exports `create(ctx): Promise<WorldSystem> | WorldSystem`.
 * `src/world/index.ts` wires them together. Keep systems independent: communicate only via
 * `WorldContext` (terrain sampling, wind uniforms, sun, quality) — never import another
 * system's internals. This is what lets two agents work in parallel without merge conflicts.
 */
import type { Vector3, Camera, Object3D, Scene, WebGLRenderer, DirectionalLight } from 'three';
import type { Terrain } from './terrain/heightfield';
import type { Wind } from './wind/wind';
import type { Rng } from './util/prng';
import type { Layout } from './layout';
import type { WorldConfig } from './config';
import type { TextureLibrary } from './materials/textures';
import type { VoxelGrid } from './util/voxelGrid';

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface Quality {
  tier: QualityTier;
  /** 0..1 multiplier for vegetation instance counts */
  density: number;
  /** multiplier for LOD/cull distances */
  distance: number;
  shadows: boolean;
  pixelRatio: number;
}

export interface WorldContext {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: Camera;
  terrain: Terrain;
  wind: Wind;
  /** set by the lighting system; other systems may read direction/colour after lighting is created */
  sun: DirectionalLight | null;
  quality: Quality;
  layout: Layout;
  config: WorldConfig;
  rng: Rng;
  textures: TextureLibrary;
  /** true when running under the headless capture harness (deterministic time, no input) */
  headless: boolean;
  /**
   * Shared geometry published by one system for another to build against (the trees system
   * publishes the lantern bough's built limb path so structures can wrap it exactly; systems never
   * import each other's internals). Absent until the publishing system has been created.
   */
  shared: SharedGeometry;
  /** register data for the automated rubric checks (see gauntlet/scripts/score.mjs) */
  audit(name: string, fn: () => Record<string, unknown>): void;
  /** report loading progress (0..1) for the boot overlay */
  progress(name: string, value: number): void;
}

/** A sampled tube centreline: world-space centres and radii at parameter s in [0, 1]. */
export interface TubePath {
  /** world position of the tube axis at s */
  centre(s: number, out?: Vector3): Vector3;
  /** tube radius (m) at s, before bark relief */
  radius(s: number): number;
  /** the s range along which the tube exists (e.g. the visible lantern-bearing part) */
  range: readonly [number, number];
}

/** A tree trunk another system may build against (the column family's authored/swapped seats). */
export interface TrunkSeat {
  id: string;
  /** world position of the bole's base (terrain contact) */
  x: number;
  y: number;
  z: number;
  /** yaw (rad) and uniform scale the variant was placed with */
  yaw: number;
  scale: number;
  /** nominal bole radius (m) at height h above the base, as built (lean/wobble included) */
  radiusAt(h: number): number;
  /** world-space bole axis centre at height h above the base (lean included) */
  axisAt(h: number, out?: Vector3): Vector3;
  /** height (m) of the bare bole (crown begins above this) */
  bareHeight: number;
}

export interface SharedGeometry {
  /** the giant's limb that carries LAYOUT.lanternBranch, as actually built (with its wiggle) */
  lanternLimb?: TubePath;
  /** the column trees' seats as actually placed and built, for structures that hang on them */
  trunkSeats?: TrunkSeat[];
  /** village props' ground footprints (centre + radius, m), published by props before vegetation scatters */
  propFootprints?: { x: number; z: number; r: number }[];
  /**
   * Round 52 (fable-3): the solid props a walker should not pass through — pots, crates, barrels,
   * buckets, markers, ladders and the lookout's rope railing (as discs along its courses) — with
   * their solid radius at the ground and their top (world y), published by props for the
   * character's ground (`blocked()`); light strings and the vegetation margins are not in it
   */
  propBlockers?: { x: number; z: number; r: number; top: number }[];
  /**
   * Round 49 (expansion-2): walkable built surfaces above the ground — the west house's platform
   * disc and walkway deck, with its wall ring (the door is the gap) — published by structures for
   * the character ground (character/ground.ts reads them; nothing else does).
   */
  walkSurfaces?: WalkSurface[];
  /**
   * Round 56 (expansion-south): walkable polylines over the ground — the rope bridge's deck (its
   * plank tops as built) and the log tunnel's floor deck — published by structures for the
   * character ground (character/ground.ts reads them; nothing else does).
   */
  walkSpans?: WalkSpan[];
  /**
   * 2026-09-24 (expansion-north): railings and unguarded deck edges — the grove's gangway, veranda,
   * rope walk and hut platforms — published by structures for the character ground
   * (character/ground.ts `blocked()`; nothing else reads them).
   */
  walkEdges?: WalkEdge[];
  /**
   * 2026-09-24 (expansion-north): ground footprints of built things the vegetation keeps off that
   * `propFootprints` (the props system's own, assigned after structures) does not carry — the
   * grove's pots, baskets, woodpiles, ladder feet, posts and sign — published by structures.
   */
  builtFootprints?: { x: number; z: number; r: number }[];
  /**
   * The play camera's collision grids over the structures (structures/cameraSolids.ts; never built
   * under a headless capture): `solid` shells it keeps Link in front of, `slim` parts it only
   * refuses to stand inside.
   */
  cameraSolids?: { solid: VoxelGrid | null; slim: VoxelGrid | null };
  /** the slim trees' trunks (the white-barks, as placed): base centre, radius, the bare bole's height span (world y) */
  slimTrunks?: { x: number; z: number; r: number; y0: number; y1: number }[];
}

/** a walkable polyline: (x, top y, z) along its centre line, walkable within `hw` m of it */
export interface WalkSpan {
  id: string;
  pts: [number, number, number][];
  hw: number;
}

/** a railing or deck edge: (x, top y, z) along it; the character is blocked within `hw` m of the line at any height */
export interface WalkEdge {
  id: string;
  pts: [number, number, number][];
  hw: number;
}

export interface WalkSurface {
  id: string;
  /** a flat disc: centre, radius, top height */
  disc: { x: number; z: number; r: number; y: number };
  /** a deck: from `a` to `b` (world, heights = its top), half width */
  deck: { a: [number, number, number]; b: [number, number, number]; hw: number };
  /** the wall ring about the disc's centre: radius, half thickness; the door's angular gap [from, to] (rad, from +x toward +z) */
  wall: { r: number; half: number; gap: [number, number] };
}

export interface WorldSystem {
  name: string;
  /** root object; added to the scene by the assembler if provided */
  group?: Object3D;
  /** per-frame update. dt seconds, t seconds since start (deterministic under capture) */
  update?(dt: number, t: number, ctx: WorldContext): void;
  /** called when the camera moves far enough to re-stream chunks (optional) */
  onCameraMove?(camera: Camera, ctx: WorldContext): void;
  /** runtime performance state (streaming pools, budgets) for the capture API's `perf()` (optional) */
  perf?(): Record<string, unknown>;
  dispose?(): void;
}

export type SystemFactory = (ctx: WorldContext) => Promise<WorldSystem> | WorldSystem;
