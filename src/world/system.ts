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

export interface SharedGeometry {
  /** the giant's limb that carries LAYOUT.lanternBranch, as actually built (with its wiggle) */
  lanternLimb?: TubePath;
}

export interface WorldSystem {
  name: string;
  /** root object; added to the scene by the assembler if provided */
  group?: Object3D;
  /** per-frame update. dt seconds, t seconds since start (deterministic under capture) */
  update?(dt: number, t: number, ctx: WorldContext): void;
  /** called when the camera moves far enough to re-stream chunks (optional) */
  onCameraMove?(camera: Camera, ctx: WorldContext): void;
  dispose?(): void;
}

export type SystemFactory = (ctx: WorldContext) => Promise<WorldSystem> | WorldSystem;
