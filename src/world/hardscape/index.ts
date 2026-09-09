/**
 * Hardscape system — owner: terrain agent.
 * The hero stairway (and the two short stairs), flagstone paths + plaza, joint fill and the
 * grass sprouting from the joints. Everything is cut-stone geometry seated on the heightfield.
 */
import { Group, Mesh } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { createStoneMaterial } from './material';
import { buildStairway, stairFrame, stairToWorld, type StairFrame } from './stairs';
import { createStoneVariants, isPaved, placeFlagstones, type PavingContext } from './flagstones';
import { buildJointMesh } from './joints';
import { buildSproutMeshes, createSproutMaterial, type SproutSpot } from './sprouts';

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'hardscape';
  const T = ctx.terrain;
  const rng = ctx.rng.fork('hardscape');
  const anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
  const stoneMat = await createStoneMaterial(ctx.textures, ctx.config, anisotropy);

  // --- stairways ---------------------------------------------------------------------------
  const frames: StairFrame[] = ctx.layout.stairs.map((s) => stairFrame(s));
  const stairInfo: { id: string; steps: number; width: number; treadSlabs: number; triangles: number }[] = [];
  const shapeHashes = new Set<string>();
  let totalSteps = 0;
  let treadSlabs = 0;
  let stairTriangles = 0;
  const treadNose: [number, number, number][] = [];
  for (const def of ctx.layout.stairs) {
    const b = buildStairway(def, T, rng.fork(`stairs-${def.id}`), ctx.config.seed);
    const mesh = new Mesh(b.geometry, stoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `stairs-${def.id}`;
    group.add(mesh);
    totalSteps += b.steps;
    treadSlabs += b.treadSlabs;
    stairTriangles += b.triangles;
    b.shapeHashes.forEach((h) => shapeHashes.add(h));
    treadNose.push(...b.treadNose);
    stairInfo.push({ id: def.id, steps: def.steps, width: def.width, treadSlabs: b.treadSlabs, triangles: b.triangles });
  }
  ctx.progress('hardscape', 0.3);

  // --- flagstones --------------------------------------------------------------------------
  const pts = [...ctx.layout.pathSpine, ...ctx.layout.pathToStairs, ...ctx.layout.pathToHouse];
  const bbox = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of pts) {
    bbox.x0 = Math.min(bbox.x0, p[0] - 3.2);
    bbox.x1 = Math.max(bbox.x1, p[0] + 3.2);
    bbox.z0 = Math.min(bbox.z0, p[2] - 3.2);
    bbox.z1 = Math.max(bbox.z1, p[2] + 3.2);
  }
  bbox.x0 = Math.min(bbox.x0, -7.5);
  bbox.x1 = Math.max(bbox.x1, 7.5);
  bbox.z0 = Math.min(bbox.z0, -7.5);
  bbox.z1 = Math.max(bbox.z1, 7.5);
  const pc: PavingContext = { terrain: T, frames, rng: rng.fork('paving'), seed: ctx.config.seed, bbox, density: ctx.quality.density };
  const variants = createStoneVariants(rng.fork('variants'), 32);
  const paving = placeFlagstones(pc, variants, stoneMat);
  for (const m of paving.meshes) group.add(m);
  ctx.progress('hardscape', 0.7);

  // --- joint fill --------------------------------------------------------------------------
  const paved = (x: number, z: number, threshold?: number) => isPaved(pc, x, z, threshold);
  const joints = await buildJointMesh(T, paved, bbox, ctx.textures, ctx.config, ctx.config.seed);
  group.add(joints.mesh);

  // --- sprouts in the joints ---------------------------------------------------------------
  const spots: SproutSpot[] = [];
  const srng = rng.fork('sprouts');
  const target = Math.round(1100 * Math.max(0.6, ctx.quality.density));
  let tries = 0;
  while (spots.length < target && tries < target * 40) {
    tries++;
    const x = srng.range(bbox.x0, bbox.x1);
    const z = srng.range(bbox.z0, bbox.z1);
    if (!paved(x, z, 0.42) || paving.onStone(x, z)) continue;
    // keep to real joints: must be within a slab's reach (not the bare fringe)
    let nearStone = false;
    paving.grid.near(x, z, 1.3, (id) => {
      const st = paving.stones[id];
      if (Math.hypot(st.x - x, st.z - z) < st.scale + 0.22) nearStone = true;
    });
    if (!nearStone) continue;
    spots.push({ x, y: T.height(x, z) + 0.012, z, size: srng() });
  }
  const flagstoneSprouts = spots.length;
  // stair joints: foot of each riser + along the cheeks
  for (const f of frames) {
    const hw = f.def.width / 2;
    for (let i = 0; i < f.def.steps; i++) {
      const n = srng.int(2, 5);
      for (let k = 0; k < n; k++) {
        const a = srng.range(-hw + 0.1, hw - 0.1);
        const [x, z] = stairToWorld(f, a, i * f.def.tread + 0.035);
        spots.push({ x, y: f.def.base[1] + i * f.def.rise + 0.005, z, size: srng() * 0.6 });
      }
      for (const side of [-1, 1]) {
        if (!srng.chance(0.7)) continue;
        const [x, z] = stairToWorld(f, side * (hw - 0.03), i * f.def.tread + srng.range(0.05, f.def.tread - 0.05));
        spots.push({ x, y: f.def.base[1] + (i + 1) * f.def.rise - 0.02, z, size: 0.4 + srng() * 0.6 });
      }
    }
  }
  const sproutMat = createSproutMaterial(ctx.wind, ctx.config);
  const sprouts = buildSproutMeshes(spots, srng, sproutMat);
  for (const m of sprouts.meshes) group.add(m);
  ctx.progress('hardscape', 1);

  // --- audit -------------------------------------------------------------------------------
  const usedVariants = new Set(paving.stones.map((s) => s.variant));
  const sampleStones = paving.stones.filter((_, i) => i % Math.max(1, Math.ceil(paving.stones.length / 200)) === 0).slice(0, 200);
  ctx.audit('hardscape', () => ({
    stairways: stairInfo.map((s) => ({ id: s.id, steps: s.steps, width: s.width, treadSlabs: s.treadSlabs })),
    totalSteps,
    treadSlabs,
    stairGeometry: 'procedural-v1',
    uniqueStepShapes: shapeHashes.size,
    mossJoints: true,
    stairTriangles,
    flagstones: paving.stones.length,
    flagstoneShapes: usedVariants.size,
    flagstoneVariantsBuilt: variants.length,
    flagstoneMeshes: paving.meshes.length,
    jointFillVertices: joints.vertices,
    jointSprouts: sprouts.count,
    jointSproutsOnFlagstones: flagstoneSprouts,
    jointSproutsOnStairs: sprouts.count - flagstoneSprouts,
    plazaRadius: 6,
    samplePositions: {
      flagstones: sampleStones.map((s) => [round(s.x), round(s.bottomY), round(s.z)]),
      treadNose: treadNose.slice(0, 40).map((p) => p.map(round)),
    },
    // stone tops relative to the ground under their centre (m)
    flagstoneTopOffset: {
      min: round(Math.min(...paving.stones.map((s) => s.topY - T.height(s.x, s.z)))),
      max: round(Math.max(...paving.stones.map((s) => s.topY - T.height(s.x, s.z)))),
    },
    maxBottomGap: round(Math.max(...paving.stones.map((s) => Math.abs(s.bottomY - T.height(s.x, s.z))))),
  }));

  return { name: 'hardscape', group };
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
