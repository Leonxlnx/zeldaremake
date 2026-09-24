/**
 * Round 57 (expansion-ruins): the waterfall ruins — a hidden valley 40–80 m west of the village,
 * reached by the trail that leaves the round-49 stepping discs at the west house (layout
 * `EXPANSION_RUINS`; the reference is the trailer's ruins shot, reference/frames-dense/review46
 * r_036–r_043). The ground (the trail's grade, the outcrop, the pool's basin) is the heightfield's
 * live view (terrain/ruins.ts); this system builds everything standing on it: the masonry
 * (masonry.ts), the natural rock — cliff, ivy rock, boulders, the slab bridge (rock.ts) — the ivy
 * hung over the great rock's stair-side face (ivy.ts), the trail's pod lanterns (lanterns.ts) and the
 * water — the pool, the fall, its spray and mist (water.ts), the green motes over it (wisps.ts) —
 * and publishes the terrace's walk spans and the fallen pieces' and boulders' blockers for the
 * character ground.
 *
 * Locality: the whole site is in the west sector no fixed frame looks at, but its casters are tall
 * (the arch to 9.6 m), so like the south exit it is drawn only while the camera is within
 * RUINS_VISIBLE_M of the site AND its frustum meets one of the casters' spheres or their shadow
 * footprints (util/expansionLocality.ts `ruinsVisible`).
 */
import { DoubleSide, Group, Mesh, MeshStandardMaterial, Object3D, type Camera, type Material } from 'three';
import { EXPANSION_RUINS } from '../layout';
import type { WorldContext, WorldSystem } from '../system';
import { inTerrace } from '../terrain/ruins';
import { casterSpheres, ruinsVisible, type Caster } from '../util/expansionLocality';
import { buildRuinsCameraSolid, ruinsColumnBlockers } from './cameraSolid';
import { buildIvy } from './ivy';
import { buildLanterns } from './lanterns';
import { buildMasonry } from './masonry';
import { createCarving, createStone, createTiles, sunDirOf } from './materials';
import { buildRock, outcropSkin, pillarSpan } from './rock';
import { buildWater } from './water';
import { buildWisps } from './wisps';

const R = EXPANSION_RUINS;
/** the masonry's target albedo (linear): the reference's pale grey-cream limestone */
const MASONRY_TINT: [number, number, number] = [0.37, 0.355, 0.32];

/** the site's casters (circle on the ground, its height span) for the locality */
function ruinsCasters(): Caster[] {
  const T = R.terrace;
  const out: Caster[] = [];
  for (let x = T.x0 + 2; x < T.x1; x += 3) out.push({ x, z: (T.z0 + T.z1) / 2, r: 4.3, y0: 1.5, y1: T.y + 0.8, shadow: true });
  out.push({ x: R.arch.x, z: R.arch.z, r: 2.4, y0: T.y, y1: T.y + R.arch.columnH + 2.2, shadow: true });
  out.push({ x: (R.colonnade.columns[0][0] + R.colonnade.columns[1][0]) / 2, z: R.colonnade.z, r: 2.2, y0: T.y, y1: T.y + 3.7, shadow: true });
  out.push({ x: R.brokenArch.x, z: (R.brokenArch.z[0] + R.brokenArch.z[1]) / 2, r: 2.3, y0: T.y, y1: T.y + 3.3, shadow: true });
  out.push({ x: (R.parapet.x0 + R.parapet.x1) / 2, z: R.wall.z, r: 3.2, y0: -0.5, y1: R.platform.y + 1.4, shadow: true });
  out.push({ x: R.stairs.base[0] - 1.6, z: R.stairs.base[2], r: 2.2, y0: R.platform.y - 0.3, y1: T.y + 0.2, shadow: true });
  // the rock: the cliff along its run, the ivy rock, the gate, the slab bridge and its pile
  const C = R.cliff;
  for (let z = C.z0 - 1.5; z <= C.z1 + 1.5; z += 3) out.push({ x: C.x - 2.5, z, r: 4.2, y0: 0, y1: C.top + 0.6, shadow: true });
  out.push({ x: R.pillar.x, z: R.pillar.z, r: R.pillar.r * 1.45, y0: 1.5, y1: R.pillar.top + 0.2, shadow: true });
  for (const [x, z, r] of R.gate) out.push({ x, z, r: r * 1.3, y0: 1.5, y1: 4.8, shadow: true });
  for (const [x, z] of [
    [-68.9, 0.5],
    [-69.5, 4.5],
    [-70.1, 8.6],
  ]) out.push({ x, z, r: 2.3, y0: 0.4, y1: 4.9, shadow: true });
  // the pool and the fall (the water throws no shadow)
  for (let x = R.pool.x - R.pool.hx + 2; x <= R.pool.x + R.pool.hx; x += 4) out.push({ x, z: R.pool.z, r: 4.6, y0: R.pool.water - 1, y1: R.pool.water + 0.5, shadow: false });
  out.push({ x: R.fall.x + 0.8, z: R.fall.z, r: 2.2, y0: R.pool.water, y1: R.fall.top + 0.3, shadow: false });
  return out;
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'ruins';
  const rng = ctx.rng.fork('ruins');
  const terrain = ctx.terrain;
  const sun = sunDirOf(ctx.config);

  const masonry = buildMasonry(rng.fork('masonry'), (x, z) => terrain.height(x, z), sun);
  const masonryMat = await createStone(ctx.textures, ctx.config, {
    name: 'masonry',
    set: 'worn_rock_natural_01',
    meanL: 0.296,
    tile: 1.6,
    tint: MASONRY_TINT,
    keep: 0.35,
    contrast: 0.9,
    normalScale: 0.9,
    roughness: 0.9,
    rough: true,
    tone: 0.1,
  });
  const materials: Material[] = [masonryMat];
  const add = (name: string, mesh: Mesh, cast: boolean) => {
    mesh.name = name;
    mesh.castShadow = cast && ctx.quality.shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add('ruins-masonry', new Mesh(masonry.stone.build(), masonryMat), true);
  const tilesMat = createTiles(2);
  const carvingMat = createCarving(MASONRY_TINT);
  materials.push(tilesMat, carvingMat);
  add('ruins-tiles', new Mesh(masonry.tiles.build(), tilesMat), false);
  add('ruins-carving', new Mesh(masonry.carving.build(), carvingMat), false);

  const rock = buildRock(rng.fork('rock'), (x, z) => terrain.height(x, z), sun);
  // (before the boulders are built: the posts' foot stones go into their builder)
  const lanterns = await buildLanterns(rng.fork('lanterns'), (x, z) => terrain.height(x, z), ctx.textures, ctx.config.palette.lanternGlow, rock.boulder);
  const [cliffMat, boulderMat] = await Promise.all([
    createStone(ctx.textures, ctx.config, { name: 'cliff', set: 'rock_face_03', meanL: 0.163, tile: 3.2, tint: [0.34, 0.335, 0.315], keep: 0.3, contrast: 1.0, normalScale: 1.0, roughness: 0.92, tone: 0.14 }),
    createStone(ctx.textures, ctx.config, { name: 'boulder', set: 'rock_boulder_cracked', meanL: 0.35, tile: 2.2, tint: [0.44, 0.425, 0.39], keep: 0.3, contrast: 0.95, normalScale: 0.9, roughness: 0.9, rough: true, tone: 0.1 }),
  ]);
  materials.push(cliffMat, boulderMat);
  const cliff = add('ruins-cliff', new Mesh(rock.cliff.build(), cliffMat), true);
  add('ruins-boulders', new Mesh(rock.boulder.build(), boulderMat), true);
  // the ivy over the great rock's stair-side face, each strand stopping on the outcrop or the paving under it
  const ivy = buildIvy(rng.fork('ivy'), pillarSpan((x, z) => terrain.height(x, z)), (x, z) => {
    const g = terrain.height(x, z);
    return Math.max(g, outcropSkin(x, z, g), inTerrace(x, z, 0.4) ? R.terrace.y : -Infinity);
  });
  const ivyMat = new MeshStandardMaterial({ name: 'ruins:ivy', vertexColors: true, roughness: 0.55, metalness: 0, side: DoubleSide });
  materials.push(ivyMat);
  add('ruins-ivy', new Mesh(ivy.builder.build(), ivyMat), true);
  const [postMesh, podMesh, poolMesh] = lanterns.meshes;
  add(postMesh.name, postMesh, true);
  add(podMesh.name, podMesh, true);
  group.add(poolMesh);
  materials.push(...lanterns.materials);

  const water = buildWater(rng.fork('water'), (x, z) => terrain.height(x, z));
  for (const m of water.meshes) group.add(m);
  materials.push(...water.materials);
  const wisps = buildWisps(rng.fork('wisps'));
  group.add(wisps.mesh);
  materials.push(wisps.material);

  // the audio's sources, found by name (audio/index.ts): the fall's roar a metre over its plunge and
  // a flame in each trail pod (a `pod-lantern`'s origin is its hook, the pod ~0.5 m under it)
  const plunge = new Object3D();
  plunge.name = 'waterfall-plunge';
  plunge.position.set(water.plunge[0], R.pool.water + 1, water.plunge[1]);
  group.add(plunge);
  for (const p of lanterns.pods) {
    const pod = new Object3D();
    pod.name = 'pod-lantern';
    pod.position.set(p.x, p.y + 0.5, p.z);
    group.add(pod);
  }

  // the character ground reads these at its creation (the character system comes after this one)
  const columns = ruinsColumnBlockers();
  (ctx.shared.walkSpans ??= []).push(...masonry.spans);
  (ctx.shared.propBlockers ??= []).push(...masonry.blockers, ...rock.blockers, ...columns, ...lanterns.blockers);
  // the play camera's shells over the rock and the masonry nobody walks on (cameraSolid.ts)
  const cameraSolid = ctx.headless ? null : buildRuinsCameraSolid(cliff.geometry, (x, z) => terrain.height(x, z));
  if (cameraSolid) (ctx.shared.cameraSolidGrids ??= []).push(cameraSolid.grid);

  const spheres = [...ruinsCasters(), ...lanterns.casters].flatMap((c) => casterSpheres(c, sun));
  const refresh = (camera: Camera) => {
    group.visible = ruinsVisible(camera, spheres);
  };
  refresh(ctx.camera);

  const triangles = () => {
    let n = 0;
    group.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
    });
    return n;
  };
  const tris = triangles();
  const meshes = group.children.filter((o) => (o as Mesh).isMesh).length;
  ctx.audit('ruins', () => ({
    visible: group.visible,
    meshes,
    triangles: tris,
    walkSpans: masonry.spans.length,
    blockers: masonry.blockers.length + rock.blockers.length + columns.length + lanterns.blockers.length,
    cameraSolid: cameraSolid?.report ?? null,
    counts: { ...masonry.counts, ...rock.counts, lanterns: lanterns.pods.length, ivyStrands: ivy.strands, ivyLeaves: ivy.leaves, wisps: wisps.count },
    lanternTriangles: lanterns.triangles,
    pods: lanterns.pods.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]),
    plunge: water.plunge.map((v) => +v.toFixed(2)),
    soundSources: { falls: 1, pods: lanterns.pods.length },
    pointLights: 0,
  }));

  return {
    name: 'ruins',
    group,
    update(_dt, t) {
      refresh(ctx.camera);
      if (group.visible) {
        water.update(t);
        wisps.update(t);
      }
    },
    onCameraMove(camera) {
      refresh(camera);
    },
    dispose() {
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      for (const m of materials) m.dispose();
      for (const t of lanterns.textures) t.dispose();
    },
  };
}
