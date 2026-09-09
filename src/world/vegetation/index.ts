/**
 * Vegetation — owner: vegetation agent.
 *
 * GPU-instanced grass (turf / tall meadow / sedge blades + broad-leaf weeds), ferns, purple
 * flowers, seed-head weeds, bushes, clover, moss tufts, saplings and ground litter (leaves,
 * twigs, roots). Placement samples deterministic candidates (ctx.rng.fork) against the terrain
 * mask (never on flagstones / stairs / structure pads / cliffs), the layout (verges, embankments,
 * trunks, boulders, NPC clearings) and clustering noise; every instance is seated on the exact
 * terrain height and tilted to the local normal.
 *
 * Grass is chunked into 8 m tiles (one InstancedMesh each) with three geometry LODs swapped by
 * camera distance; other plants live in variant × LOD instanced sets that re-bucket by
 * distance. Three wind layers: windGrass (blades), windBranch + windLeaf (plants / bushes).
 */
import { Group, Vector3 } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { VegField } from './field';
import { buildGrass, GRASS_TYPE_NAMES, type GrassResult } from './grass';
import { buildLitter, type LitterResult } from './litter';
import { createVegMaterial } from './materials';
import { buildPlants, type PlantSets } from './plants';

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'vegetation';
  const t0 = performance.now();

  ctx.progress('vegetation', 0.02);
  const field = new VegField(ctx, ctx.config.detailRadius + 6, 0.5);
  ctx.progress('vegetation', 0.1);

  const grassMaterial = createVegMaterial(ctx, 'grass', { name: 'veg-grass' });
  const litterMaterial = createVegMaterial(ctx, 'litter', { name: 'veg-litter' });

  const grassGroup = new Group();
  grassGroup.name = 'grass';
  group.add(grassGroup);
  const grass: GrassResult = await buildGrass(ctx, field, grassMaterial, grassGroup, (f) => ctx.progress('vegetation', 0.1 + f * 0.6));
  ctx.progress('vegetation', 0.72);

  const plants: PlantSets = buildPlants(ctx, field, group);
  ctx.progress('vegetation', 0.9);

  const litterGroup = new Group();
  litterGroup.name = 'litter';
  group.add(litterGroup);
  const litter: LitterResult = buildLitter(ctx, field, litterMaterial, litterGroup);
  ctx.progress('vegetation', 1);

  const buildMs = performance.now() - t0;
  const camPos = new Vector3();
  const sets = [...plants.all, ...litter.all];

  const refresh = (force = false, camera = ctx.camera) => {
    camera.getWorldPosition(camPos);
    grass.update(camPos);
    for (const s of sets) s.update(camPos, force);
  };
  refresh(true);

  const drawable = () => {
    let drawCalls = grass.visible.drawCalls;
    let triangles = grass.visible.triangles;
    for (const s of sets) {
      const st = s.stats();
      drawCalls += st.drawCalls;
      triangles += st.triangles;
    }
    return { drawCalls, triangles, grassLodTiles: grass.visible.lodCounts };
  };

  const weeds = plants.weeds.count;
  ctx.audit('vegetation', () => ({
    grassInstances: grass.count + weeds,
    grassBlades: grass.count,
    grassTypes: GRASS_TYPE_NAMES.length + 1,
    grassTypeNames: [...GRASS_TYPE_NAMES, 'broadleaf-weed'],
    grassTypeCounts: [...grass.typeCounts, weeds],
    grassHeightMean: Math.round(grass.heightMean * 1000) / 1000,
    grassHeightCV: Math.round(grass.heightCV * 1000) / 1000,
    grassTints: 4,
    grassDryTipGradient: true,
    grassClustered: true,
    grassTiles: grass.tiles.length,
    grassTileSize: grass.tileSize,
    chunked: true,
    lodLevels: 3,
    lodDistances: grass.lodDistances.map((d) => Math.round(d * 10) / 10),
    ferns: plants.ferns.count,
    flowers: plants.flowers.count,
    weeds,
    seedheads: plants.seedheads.count,
    bushes: plants.bushes.count,
    clover: plants.clover.count,
    mossPatches: plants.moss.count,
    saplings: plants.saplings.count,
    litter: litter.count,
    litterKinds: { leaves: litter.leaves.count, twigs: litter.twigs.count, roots: litter.roots.count },
    windLayers: 3,
    windLayerNames: ['windGrass', 'windLeaf', 'windBranch'],
    buildMs: Math.round(buildMs),
    /** upper bound of what the current camera can draw (before frustum culling) */
    drawableEstimate: drawable(),
    samplePositions: {
      grass: grass.samples,
      litter: litter.samples,
      ferns: plants.ferns.samples(200),
      bushes: plants.bushes.samples(100),
      flowers: plants.flowers.samples(200),
    },
  }));

  return {
    name: 'vegetation',
    group,
    update() {
      refresh();
    },
    onCameraMove(camera) {
      refresh(true, camera);
    },
    dispose() {
      grassMaterial.dispose();
      litterMaterial.dispose();
      for (const m of plants.materials) m.dispose();
    },
  };
}
