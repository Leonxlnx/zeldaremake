/**
 * World system contract. Every subsystem (terrain, trees, vegetation, structures,
 * atmosphere, lighting, rocks, hardscape…) exports `create(ctx): Promise<WorldSystem> | WorldSystem`.
 * `src/world/index.ts` wires them together. Keep systems independent: communicate only via
 * `WorldContext` (terrain sampling, wind uniforms, sun, quality) — never import another
 * system's internals. This is what lets two agents work in parallel without merge conflicts.
 */
import type { Camera, Object3D, Scene, WebGLRenderer, DirectionalLight } from 'three';
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
  /** register data for the automated rubric checks (see gauntlet/scripts/score.mjs) */
  audit(name: string, fn: () => Record<string, unknown>): void;
  /** report loading progress (0..1) for the boot overlay */
  progress(name: string, value: number): void;
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
