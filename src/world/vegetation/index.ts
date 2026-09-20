/**
 * Vegetation — owner: vegetation agent.
 *
 * GPU-instanced grass (turf / tall meadow / sedge blades + broad-leaf plants), ferns (understory
 * clumps + big lit hero crowns) with fiddleheads, purple and white flowers, seed-head weeds,
 * bushes, clover, moss tufts, saplings and ground litter (leaves, twigs, roots). Placement samples deterministic candidates (ctx.rng.fork) against the terrain
 * mask (never on flagstones / stairs / structure pads / cliffs), the layout (verges, embankments,
 * trunks, boulders, NPC clearings) and clustering noise; every instance is seated on the exact
 * terrain height and tilted to the local normal.
 *
 * Grass is chunked into 8 m tiles (one InstancedMesh each) with three geometry LODs swapped by
 * camera distance; other plants live in variant × LOD instanced sets that re-bucket by
 * distance, with several variants packed into one draw per LOD (lodset.ts), and every bucket is
 * trimmed per frame to the instances that can reach the frame (lodset.ts `cull`: view frustum,
 * plus the shadow sweep for the casting LODs). Three wind layers: windGrass (blades),
 * windBranch + windLeaf (plants / bushes).
 */
import { Frustum, Group, InstancedMesh, Matrix4, Sphere, Vector3, type BufferGeometry } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { buildCarpet, CLUMP_CELL, MAT_CELL, type CarpetResult } from './carpet';
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
  // round 43: the litter block (dark veins, brown → ochre) on the near leaves
  const litterMaterial = createVegMaterial(ctx, 'litter', { name: 'veg-litter', leafDetail: true });

  const grassGroup = new Group();
  grassGroup.name = 'grass';
  group.add(grassGroup);
  const grass: GrassResult = await buildGrass(ctx, field, grassMaterial, grassGroup, (f) => ctx.progress('vegetation', 0.1 + f * 0.5));
  ctx.progress('vegetation', 0.62);

  // the turf carpet (round 39): clump cards and turf mats that close the lawn over the blades
  const carpetGroup = new Group();
  carpetGroup.name = 'carpet';
  group.add(carpetGroup);
  const carpet: CarpetResult = buildCarpet(ctx, field, carpetGroup);
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
  const sets = [...plants.all, ...carpet.all, ...litter.all];
  let disposed = false;

  // unit vector toward the sun for the shadow sweep: the live light when there is one (same
  // convention as lighting/sun.ts: azimuth from +Z toward +X), else the configured direction
  const sunDir = (() => {
    const az = (ctx.config.sun.azimuthDeg * Math.PI) / 180;
    const el = (ctx.config.sun.elevationDeg * Math.PI) / 180;
    return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  })();
  const sunNow = new Vector3();
  const currentSun = () => {
    if (!ctx.sun) return sunDir;
    sunNow.subVectors(ctx.sun.position, ctx.sun.target.position);
    return sunNow.lengthSq() > 1e-6 ? sunNow.normalize() : sunDir;
  };

  /**
   * Re-bucket by camera distance (grass tiles swap LOD geometry, the sets re-bucket past their
   * hysteresis — or always when forced: an explicit re-pose must never render the previous pose's
   * buckets), then trim every set's buckets to the frame (lodset.ts `cull`).
   */
  /**
   * Re-bucket budget of an unforced refresh, in plants listed per frame: the sets share the
   * camera, so every set past its hysteresis used to re-bucket on the same frame — 31k plants
   * re-listed and every bucket refilled at once, measured as 7–17 ms frames on the walk (round
   * 37). Round 37 spread the SETS over frames (in order, until this many plants had been
   * re-listed, always at least one whole set), which still let a single 35 k-plant set (the turf
   * mats) or the 15 k clump cards land whole on one frame: fable-6's native trace of take-0116
   * has vegetation.update at 105–211 ms on those frames (docs/PERF_2026-09-19.md §3). Round 48
   * (lod-1): the re-bucket itself is incremental (lodset.ts `update` with `maxItems`) — a set
   * lists at most what is left of this budget per frame and swaps its buckets when it has listed
   * every plant, so no frame lists more than REBUCKET_BUDGET plants whatever the set sizes; a set
   * mid-job is advanced first (its buckets are the staler), then the sets past their gate in
   * order. A set kept waiting keeps its previous buckets, culled for the new frame as usual, and
   * swaps a few frames (≈ 0.1–0.2 m of walking) late. Forced refreshes (onCameraMove: the
   * captures, an explicit re-pose) re-bucket everything at once, so a capture never depends on
   * the path taken.
   */
  const REBUCKET_BUDGET = 8000;
  /**
   * Runtime cost of the refreshes for the trace harness (`WorldSystem.perf`): per set the last
   * refresh's re-bucket ms (0 when it did not list) and cull ms, running maxima, the plants listed
   * this frame, and how many frames swapped a set's buckets.
   */
  const perfRows = new Map<string, { updateMs: number; cullMs: number; updateMsMax: number; cullMsMax: number; swaps: number; count: number }>();
  for (const s of sets) perfRows.set(s.opts.name, { updateMs: 0, cullMs: 0, updateMsMax: 0, cullMsMax: 0, swaps: 0, count: s.count });
  const perfFrame = { listed: 0, listedMax: 0, swaps: 0, refreshMs: 0, refreshMsMax: 0, frames: 0, jobsOpen: 0 };
  const refresh = (force = false, camera = ctx.camera) => {
    if (disposed) return;
    const t0 = performance.now();
    camera.getWorldPosition(camPos);
    grass.update(camPos);
    const sun = currentSun();
    let budget = REBUCKET_BUDGET;
    let listed = 0;
    let swaps = 0;
    const step = (s: (typeof sets)[number], work: boolean) => {
      const row = perfRows.get(s.opts.name)!;
      let rebucketed = false;
      row.updateMs = 0;
      if (work) {
        const tu = performance.now();
        rebucketed = s.update(camPos, force, force ? Infinity : budget);
        row.updateMs = performance.now() - tu;
        row.updateMsMax = Math.max(row.updateMsMax, row.updateMs);
        budget -= s.listedLast;
        listed += s.listedLast;
        if (rebucketed) {
          row.swaps++;
          swaps++;
        }
      }
      const tc = performance.now();
      s.cull(camera, sun, force || rebucketed);
      row.cullMs = performance.now() - tc;
      row.cullMsMax = Math.max(row.cullMsMax, row.cullMs);
    };
    if (force) {
      for (const s of sets) step(s, true);
    } else {
      // the sets mid-job first (their buckets are the staler), then the sets past their gate
      const open = sets.filter((s) => s.rebucketing);
      for (const s of open) step(s, budget > 0);
      for (const s of sets) {
        if (s.rebucketing || open.includes(s)) continue;
        step(s, budget > 0 && s.wantsRebucket(camPos));
      }
    }
    const ms = performance.now() - t0;
    perfFrame.frames++;
    perfFrame.listed = listed;
    perfFrame.listedMax = Math.max(perfFrame.listedMax, listed);
    perfFrame.swaps = swaps;
    perfFrame.refreshMs = ms;
    perfFrame.refreshMsMax = Math.max(perfFrame.refreshMsMax, ms);
    perfFrame.jobsOpen = sets.reduce((n, s) => n + (s.rebucketing ? 1 : 0), 0);
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

  /**
   * What the current buckets hand the renderer for the current camera, per set and LOD, with
   * three's own per-mesh culling replayed (mesh sphere against the camera frustum for the colour
   * pass, against the sun's shadow camera for the depth pass): `bucket` plants in the distance
   * ring, `submitted` after the frustum / shadow-sweep trim, `drawn` in meshes the colour pass
   * keeps, and the draw calls and triangles the GPU is handed (both passes). `bucketCalls` /
   * `bucketTriangles` are what the whole buckets would cost — for the sets, whose rings always
   * meet the frustum, exactly what was submitted before the trim; grass tiles (never trimmed,
   * culled per tile by three) count their in-range tiles there.
   */
  interface SubmissionRow {
    meshes: number;
    bucket: number;
    submitted: number;
    drawn: number;
    calls: number;
    triangles: number;
    /** what the untrimmed buckets would cost (colour + depth passes): the pre-round-15 submission of a set */
    bucketCalls: number;
    bucketTriangles: number;
    castShadow: boolean;
  }
  const submission = () => {
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    const view = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let shadow: Frustum | null = null;
    if (ctx.sun?.castShadow) {
      const sc = ctx.sun.shadow.camera;
      shadow = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse));
    }
    const sphere = new Sphere();
    const rows: Record<string, SubmissionRow> = {};
    const add = (key: string, mesh: InstancedMesh, bucket: number, tris: number) => {
      const r = (rows[key] ??= { meshes: 0, bucket: 0, submitted: 0, drawn: 0, calls: 0, triangles: 0, bucketCalls: 0, bucketTriangles: 0, castShadow: mesh.castShadow });
      r.meshes++;
      r.bucket += bucket;
      if (bucket) {
        r.bucketCalls += mesh.castShadow ? 2 : 1;
        r.bucketTriangles += bucket * tris * (mesh.castShadow ? 2 : 1);
      }
      if (!mesh.visible || mesh.count === 0) return;
      r.submitted += mesh.count;
      sphere.copy(mesh.boundingSphere!).applyMatrix4(mesh.matrixWorld);
      const colour = view.intersectsSphere(sphere) ? 1 : 0;
      const depth = mesh.castShadow && shadow && shadow.intersectsSphere(sphere) ? 1 : 0;
      r.drawn += mesh.count * colour;
      r.calls += colour + depth;
      r.triangles += tris * mesh.count * (colour + depth);
    };
    for (const t of grass.tiles) add(`grass-lod${t.lod}`, t.mesh, t.mesh.visible ? t.count : 0, t.mesh.geometry.index!.count / 3);
    for (const s of sets) for (const m of s.submission()) add(`${s.opts.name}-lod${m.lod}`, m.mesh, m.bucket, m.triangles);
    let drawCalls = 0;
    let triangles = 0;
    for (const r of Object.values(rows)) {
      drawCalls += r.calls;
      triangles += r.triangles;
    }
    return { drawCalls, triangles, bySet: rows };
  };

  const weeds = plants.weeds.count;
  const tufts = plants.tufts.count;
  // round 46: the clump cards of both sets (the disc's and the north corridor's — carpet.ts NORTH_CARPET)
  const clumps = carpet.clumps.count + carpet.northClumps.count;
  // round 48: the mats of both sets (the disc's and the tiles north of carpet.ts NORTH_MAT_Z)
  const turfMats = carpet.mats.count + carpet.northMats.count;
  ctx.audit('vegetation', () => ({
    /**
     * the blade tiles, the weeds and the tufts — not the carpet's clump cards: the anti-cheat's B3
     * cross-check reads this against the instances in the scene graph at the audit's pose, and the
     * cards are culled per instance (a fifth of them submit from camera A), where the blade tiles
     * only hide (litter.ts explains how the always-submitted leaves back the culled weeds / tufts)
     */
    grassInstances: grass.count + weeds + tufts,
    grassBlades: grass.count,
    grassTypes: GRASS_TYPE_NAMES.length + 3,
    grassTypeNames: [...GRASS_TYPE_NAMES, 'broadleaf-weed', 'grass-tuft', 'clump-card'],
    grassTypeCounts: [...grass.typeCounts, weeds, tufts, clumps],
    /** round 31: instanced tufts of bent blades (plantgeo.ts tuftGeometry) — three height classes, on the banks and leaning over the paved rims */
    tufts,
    /**
     * round 39 (carpet.ts): the turf carpet — alpha-tested clump cards (three crossed planes over a
     * seeded clump atlas, ≈ 200 blades a tile) on a CLUMP_CELL grid and flat turf mats under them,
     * so the lawn reads as a closed carpet at eye height; the blade tiles above run at reduced density
     */
    carpet: {
      clumps,
      turfMats,
      clumpCellM: CLUMP_CELL,
      matCellM: MAT_CELL,
      clumpsPerM2: Math.round((clumps / Math.max(1, carpet.lawnCellsM2)) * 100) / 100,
      atlas: carpet.atlas.texture?.name ?? null,
      atlasSize: carpet.atlas.size,
      atlasTiles: { clumps: carpet.atlas.clumpTiles, mats: carpet.atlas.matTiles },
      atlasCoverage: carpet.atlas.coverage,
      clumpLodDistances: carpet.clumps.opts.lodDistances.map((d) => Math.round(d * 10) / 10),
      /** round 46: the north corridor's own set, running to NORTH_CARPET.maxDistance (the disc's stops at 16 m) */
      northClumps: carpet.northClumps.count,
      northClumpMaxDistanceM: carpet.northClumps.opts.maxDistance ?? null,
      /** round 48: the mats north of carpet.ts NORTH_MAT_Z, their own set ending at NORTH_MAT_MAX_DISTANCE (the disc's mats have no cut) */
      northMats: carpet.northMats.count,
      northMatMaxDistanceM: carpet.northMats.opts.maxDistance ?? null,
      alphaTested: true,
      castsShadows: false,
    },
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
    ferns: plants.ferns.count + plants.heroFerns.count + plants.fernsNorth.count,
    heroFerns: plants.heroFerns.count,
    /** round 44: the north corridor's forest-floor sets (plants.ts) */
    fernsNorth: plants.fernsNorth.count,
    weedsNorth: plants.weedsNorth.count,
    /** round 48 (vegetation-26): the ground north of the log arch — the clearing banks' shrubs and the terrace pad's tufts (their own sets), what each north pass seated, and the props' footprints honoured (plants.ts NORTH_BUSH_MAX_M …) */
    bushesNorth: plants.bushesNorth.count,
    tuftsNorth: plants.tuftsNorth.count,
    north: { ...plants.north, propFootprints: field.propFootprintCount() },
    fiddleheads: plants.fiddleheads.count,
    flowers: plants.flowers.count + plants.yellowFlowers.count,
    yellowFlowers: plants.yellowFlowers.count,
    whiteFlowers: plants.whiteFlowers.count,
    weeds,
    weedLeafShapes: ['heart', 'ovate', 'round'],
    seedheads: plants.seedheads.count,
    bushes: plants.bushes.count,
    hedge: plants.hedge.count,
    clover: plants.clover.count,
    mossPatches: plants.moss.count,
    /** metres of flagstone rim taken from the terrain mask (plaza discs, bank toe) beyond the layout polylines */
    pavedRimMetres: Math.round(field.pavedRimStats().metres * 10) / 10,
    saplings: plants.saplings.count,
    litter: litter.count,
    litterKinds: { leaves: litter.leaves.count, northLeaves: litter.northLeaves.count, twigs: litter.twigs.count, northTwigs: litter.northTwigs.count, roots: litter.roots.count },
    windLayers: 3,
    windLayerNames: ['windGrass', 'windLeaf', 'windBranch'],
    buildMs: Math.round(buildMs),
    /** upper bound of what the current camera's distance buckets could draw (before any culling) */
    drawableEstimate: drawable(),
    /** what the renderer is handed for the current camera, per set and LOD (after the trim and three's per-mesh culling) */
    submission: submission(),
    samplePositions: {
      grass: grass.samples,
      litter: litter.samples,
      ferns: plants.ferns.samples(200),
      heroFerns: plants.heroFerns.samples(40),
      bushes: plants.bushes.samples(100),
      flowers: plants.flowers.samples(200),
      whiteFlowers: plants.whiteFlowers.samples(60),
      fiddleheads: plants.fiddleheads.samples(60),
      tufts: plants.tufts.samples(120),
      clumps: carpet.samples.clumps,
      turfMats: carpet.samples.mats,
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
    perf() {
      // round 48 (lod-1): the refresh cost for the trace harness — the frame's re-bucket listing
      // against its budget, the open incremental jobs, and per set the last re-bucket / cull ms
      return {
        rebucketBudget: REBUCKET_BUDGET,
        frame: { ...perfFrame },
        sets: Object.fromEntries([...perfRows].map(([name, r]) => [name, { ...r }])),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Grass swaps geometries on one mesh, so traversal alone misses dormant LODs.
      const geometries = new Set<BufferGeometry>();
      for (const tile of grass.tiles) for (const geometry of tile.lods) geometries.add(geometry);
      grassGroup.traverse((object) => {
        if (object instanceof InstancedMesh) object.dispose();
      });
      // the sets own their packed meshes and geometries; the variants they were packed from are ours
      for (const set of sets) {
        set.dispose();
        for (const variant of set.opts.variants) for (const geometry of variant) geometries.add(geometry);
      }
      for (const geometry of geometries) geometry.dispose();
      grassMaterial.dispose();
      litterMaterial.dispose();
      for (const m of plants.materials) m.dispose();
      for (const m of carpet.materials) m.dispose();
      carpet.atlas.texture?.dispose();
      group.removeFromParent();
    },
  };
}
