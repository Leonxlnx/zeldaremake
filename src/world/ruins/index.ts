/**
 * Round 57 (expansion-ruins): the waterfall ruins — a hidden valley 40–80 m west of the village,
 * reached by the trail that leaves the round-49 stepping discs at the west house (layout
 * `EXPANSION_RUINS`; the reference is the trailer's ruins shot, reference/frames-dense/review46
 * r_036–r_043). The ground (the trail's grade, the outcrop, the pool's basin) is the heightfield's
 * live view (terrain/ruins.ts); this system builds everything standing on it: the masonry
 * (masonry.ts), and publishes the terrace's walk spans and the fallen pieces' blockers for the
 * character ground.
 *
 * Locality: the whole site is in the west sector no fixed frame looks at, but its casters are tall
 * (the arch to 9.6 m), so like the south exit it is drawn only while the camera is within
 * RUINS_VISIBLE_M of the site AND its frustum meets one of the casters' spheres or their shadow
 * footprints (util/expansionLocality.ts `ruinsVisible`).
 */
import { Group, Mesh, type Camera, type Material } from 'three';
import { EXPANSION_RUINS } from '../layout';
import type { WorldContext, WorldSystem } from '../system';
import { casterSpheres, ruinsVisible, type Caster } from '../util/expansionLocality';
import { buildMasonry } from './masonry';
import { createCarving, createStone, createTiles, sunDirOf } from './materials';

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

  // the character ground reads these at its creation (the character system comes after this one)
  (ctx.shared.walkSpans ??= []).push(...masonry.spans);
  (ctx.shared.propBlockers ??= []).push(...masonry.blockers);

  const spheres = ruinsCasters().flatMap((c) => casterSpheres(c, sun));
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
  const meshes = group.children.length;
  ctx.audit('ruins', () => ({
    visible: group.visible,
    meshes,
    triangles: tris,
    walkSpans: masonry.spans.length,
    blockers: masonry.blockers.length,
    counts: masonry.counts,
    pointLights: 0,
  }));

  return {
    name: 'ruins',
    group,
    update() {
      refresh(ctx.camera);
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
    },
  };
}
