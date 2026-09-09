/**
 * World assembler. Creates the shared context and instantiates every system.
 *
 * Adding a system: create `src/world/<system>/index.ts` exporting `create(ctx)`, then add it
 * to SYSTEMS below in dependency order (lighting first so `ctx.sun` exists; terrain before
 * anything that samples it). Keep this file tiny — it is the one file every agent touches,
 * so one-line additions only.
 */
import { Scene, WebGLRenderer, Camera, DirectionalLight } from 'three';
import { WORLD } from './config';
import { LAYOUT } from './layout';
import { getTerrain } from './terrain/heightfield';
import { createWind } from './wind/wind';
import { createRng } from './util/prng';
import { createTextureLibrary } from './materials/textures';
import type { Quality, SystemFactory, WorldContext, WorldSystem } from './system';

import * as lighting from './lighting';
import * as atmosphere from './atmosphere';
import * as terrain from './terrain';
import * as hardscape from './hardscape';
import * as rocks from './rocks';
import * as structures from './structures';
import * as trees from './trees';
import * as vegetation from './vegetation';

const SYSTEMS: { name: string; create: SystemFactory }[] = [
  { name: 'lighting', create: lighting.create },
  { name: 'atmosphere', create: atmosphere.create },
  { name: 'terrain', create: terrain.create },
  { name: 'hardscape', create: hardscape.create },
  { name: 'rocks', create: rocks.create },
  { name: 'structures', create: structures.create },
  { name: 'trees', create: trees.create },
  { name: 'vegetation', create: vegetation.create },
];

export interface World {
  ctx: WorldContext;
  systems: WorldSystem[];
  update(dt: number, t: number): void;
  dispose(): void;
}

export function qualityFor(tier: Quality['tier']): Quality {
  switch (tier) {
    case 'low':
      return { tier, density: 0.35, distance: 0.6, shadows: true, pixelRatio: 1 };
    case 'medium':
      return { tier, density: 0.65, distance: 0.8, shadows: true, pixelRatio: 1.25 };
    case 'ultra':
      return { tier, density: 1.35, distance: 1.25, shadows: true, pixelRatio: 2 };
    default:
      return { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1.5 };
  }
}

export async function createWorld(opts: {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: Camera;
  quality: Quality;
  headless: boolean;
  onProgress?: (name: string, value: number) => void;
  audits: Map<string, () => Record<string, unknown>>;
}): Promise<World> {
  const ctx: WorldContext = {
    scene: opts.scene,
    renderer: opts.renderer,
    camera: opts.camera,
    terrain: getTerrain(),
    wind: createWind(),
    sun: null as DirectionalLight | null,
    quality: opts.quality,
    layout: LAYOUT,
    config: WORLD,
    rng: createRng(WORLD.seed),
    textures: createTextureLibrary(opts.renderer.capabilities.getMaxAnisotropy()),
    headless: opts.headless,
    audit: (name, fn) => opts.audits.set(name, fn),
    progress: (name, value) => opts.onProgress?.(name, value),
  };

  const systems: WorldSystem[] = [];
  for (const s of SYSTEMS) {
    const t0 = performance.now();
    try {
      const sys = await s.create(ctx);
      if (sys.group) {
        sys.group.name = sys.group.name || s.name;
        opts.scene.add(sys.group);
      }
      systems.push(sys);
      ctx.progress(s.name, 1);
      console.info(`[world] ${s.name} ready in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) {
      console.error(`[world] system "${s.name}" failed to build`, e);
      ctx.progress(s.name, 1);
    }
  }

  return {
    ctx,
    systems,
    update(dt, t) {
      ctx.wind.update(dt, t);
      for (const s of systems) s.update?.(dt, t, ctx);
    },
    dispose() {
      for (const s of systems) s.dispose?.();
    },
  };
}
