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
import { getLegacyTerrain, getTerrain } from './terrain/heightfield';
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
import * as canopy from './canopy';
import * as vegetation from './vegetation';
import * as props from './props';
import * as ruins from './ruins';
import * as character from './character';

/**
 * `terrain: 'legacy'` (round 49, expansion-2): the system builds against the heightfield's LEGACY
 * view — the ground without the round-49 expansion (terrain/heightfield.ts `TerrainView`) — so its
 * rejection-sampled streams read exactly the numbers they read in take-0121 and no placement in
 * the six fixed frames re-rolls. The rendered ground (terrain), the paving, the structures and the
 * character ground take the live view; the two agree everywhere outside the expansion footprints.
 */
const SYSTEMS: { name: string; create: SystemFactory; terrain?: 'legacy' }[] = [
  { name: 'lighting', create: lighting.create },
  { name: 'atmosphere', create: atmosphere.create, terrain: 'legacy' },
  { name: 'terrain', create: terrain.create },
  { name: 'hardscape', create: hardscape.create },
  { name: 'rocks', create: rocks.create, terrain: 'legacy' },
  // trees before structures: the lantern bough wraps the giant's BUILT limb (ctx.shared.lanternLimb)
  { name: 'trees', create: trees.create, terrain: 'legacy' },
  { name: 'canopy', create: canopy.create, terrain: 'legacy' }, // owner-fable: the canopy roof (reads the giants from layout; no trees internals)
  { name: 'structures', create: structures.create },
  // props before vegetation: props publish their footprints (ctx.shared.propFootprints) so the
  // scatter can keep ferns out of the pots; forks are label-keyed, so the order moves no stream
  { name: 'props', create: props.create, terrain: 'legacy' },
  { name: 'ruins', create: ruins.create }, // round 57: the waterfall ruins (live terrain; publishes its walk spans and blockers before the vegetation and the character)
  { name: 'vegetation', create: vegetation.create, terrain: 'legacy' },
  { name: 'character', create: character.create },
];

export interface SystemFailure {
  name: string;
  error: string;
}

export interface World {
  ctx: WorldContext;
  systems: WorldSystem[];
  /** systems whose create() threw. Interactive mode tolerates this; capture mode fails closed. */
  failures: SystemFailure[];
  /** CPU ms of the last update(), per system (plus `wind`) — read by the capture API's perf() */
  timings: Record<string, number>;
  /** build ms per system (create() wall time), for the load-time report */
  buildMs: Record<string, number>;
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
    textures: createTextureLibrary(opts.renderer.capabilities.getMaxAnisotropy(), opts.quality.tier),
    headless: opts.headless,
    shared: {},
    audit: (name, fn) => opts.audits.set(name, fn),
    progress: (name, value) => opts.onProgress?.(name, value),
  };
  ctx.audit('textures', () => ({ ...ctx.textures.report() }));

  const systems: WorldSystem[] = [];
  const failures: SystemFailure[] = [];
  const buildMs: Record<string, number> = {};
  /** the context each system was created with (the legacy-terrain systems get a view of `ctx` with that terrain; `shared` is the same object) */
  const ctxFor = new Map<WorldSystem, WorldContext>();
  for (const s of SYSTEMS) {
    const t0 = performance.now();
    try {
      const sysCtx: WorldContext = s.terrain === 'legacy' ? { ...ctx, terrain: getLegacyTerrain() } : ctx;
      const sys = await s.create(sysCtx);
      ctxFor.set(sys, sysCtx);
      if (sys.group) {
        sys.group.name = sys.group.name || s.name;
        opts.scene.add(sys.group);
      }
      systems.push(sys);
      ctx.progress(s.name, 1);
      buildMs[s.name] = performance.now() - t0;
      console.info(`[world] ${s.name} ready in ${buildMs[s.name].toFixed(0)} ms`);
    } catch (e) {
      const error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
      failures.push({ name: s.name, error });
      console.error(`[world] system "${s.name}" failed to build`, e);
      ctx.progress(s.name, 1);
      buildMs[s.name] = performance.now() - t0;
    }
  }

  const timings: Record<string, number> = {};
  return {
    ctx,
    systems,
    failures,
    timings,
    buildMs,
    update(dt, t) {
      let a = performance.now();
      ctx.wind.update(dt, t);
      let b = performance.now();
      timings.wind = b - a;
      for (const s of systems) {
        a = b;
        s.update?.(dt, t, ctxFor.get(s) ?? ctx);
        b = performance.now();
        timings[s.name] = b - a;
      }
    },
    dispose() {
      for (const s of systems) s.dispose?.();
    },
  };
}
