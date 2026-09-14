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
  const refresh = (force = false, camera = ctx.camera) => {
    if (disposed) return;
    camera.getWorldPosition(camPos);
    grass.update(camPos);
    const sun = currentSun();
    for (const s of sets) {
      const rebucketed = s.update(camPos, force);
      s.cull(camera, sun, force || rebucketed);
    }
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
    ferns: plants.ferns.count + plants.heroFerns.count,
    heroFerns: plants.heroFerns.count,
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
    litterKinds: { leaves: litter.leaves.count, twigs: litter.twigs.count, roots: litter.roots.count },
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
      group.removeFromParent();
    },
  };
}
