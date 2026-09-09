/**
 * Terrain system — owner: terrain agent.
 * Chunked heightfield mesh (three LOD rings, stitched seams, analytic normals) with a six-layer
 * PBR ground material blended by slope, authored masks and noise. Geometry detail comes from
 * heightfield.ts (macro landform + erosion/terracing/depressions/roots/micro passes).
 */
import { Group, Mesh } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { DETAIL_PASSES } from './heightfield';
import { buildChunkGeometry, createWeightContext, layoutChunks } from './chunks';
import { createTerrainMaterial } from './material';

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'terrain';
  const T = ctx.terrain;

  // inner-ring resolution: 0.2 m at high/ultra, 0.25 m at medium, 0.33 m at low
  const k = ctx.quality.distance >= 1 ? 5 : ctx.quality.distance >= 0.8 ? 4 : 3;
  const specs = layoutChunks(ctx.config.terrainHalfSize, 24 * k);
  const wc = createWeightContext(T, ctx.layout, ctx.config.seed);

  const matInfo = await createTerrainMaterial(ctx.textures, ctx.config, ctx.renderer.capabilities.getMaxAnisotropy());
  const material = matInfo.material;

  let vertices = 0;
  let triangles = 0;
  let built = 0;
  const t0 = performance.now();
  for (const spec of specs) {
    const { geometry, vertices: n } = buildChunkGeometry(spec, wc);
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    // the detail ring self-shadows (embankments shade the stairs and the path); far rings don't
    mesh.castShadow = spec.ring === 0;
    mesh.name = `terrain-chunk-r${spec.ring}-${spec.x0}-${spec.z0}`;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    vertices += n;
    triangles += geometry.index ? geometry.index.count / 3 : 0;
    built++;
    if ((built & 7) === 0) ctx.progress('terrain', built / specs.length);
  }
  const buildMs = performance.now() - t0;

  ctx.audit('terrain', () => ({
    chunks: group.children.length,
    vertices,
    triangles,
    rings: 3,
    innerSpacing: 1 / k,
    textured: matInfo.textured,
    textureSets: matInfo.sets,
    layers: matInfo.layers,
    detailNormal: matInfo.detailNormal,
    triplanarCliffs: true,
    detailPasses: DETAIL_PASSES.length,
    detailPassNames: DETAIL_PASSES,
    halfSize: ctx.config.terrainHalfSize,
    heightAtOrigin: T.height(0, 0),
    heightAtStairTop: T.height(14.5, -4),
    buildMs: Math.round(buildMs),
  }));

  return { name: 'terrain', group };
}
