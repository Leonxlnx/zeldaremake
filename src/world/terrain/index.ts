/**
 * Terrain system — owner: terrain agent.
 * Chunked heightfield mesh (three lattice-aligned LOD rings, stitched seams, sampler normals) with a six-layer
 * PBR ground material blended by slope, authored masks and noise. Geometry detail comes from
 * heightfield.ts (macro landform + erosion/terracing/depressions/roots/micro passes).
 */
import { Group, Mesh, Raycaster, Vector3 } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { DETAIL_PASSES, LATTICE } from './heightfield';
import { buildChunkGeometry, createWeightContext, layoutChunks } from './chunks';
import { createTerrainMaterial } from './material';
import { createRng } from '../util/prng';

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'terrain';
  const T = ctx.terrain;

  // the detail ring is always the sampler's 0.2 m lattice (contract: rendered surface == height()),
  // so the mesh does not scale with quality; the far rings are 1 m / 4 m at every tier
  const specs = layoutChunks(ctx.config.terrainHalfSize);
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

  // Sampler-vs-mesh proof: raycast the rendered triangles at a few hundred points and compare
  // with `terrain.height()`. Evaluated lazily (once) when the audit is collected.
  let meshError: Record<string, number> | null = null;
  const samplerMeshError = () => {
    if (meshError) return meshError;
    group.updateMatrixWorld(true);
    const meshes = group.children.filter((m): m is Mesh => (m as Mesh).isMesh);
    const ray = new Raycaster();
    const origin = new Vector3();
    const down = new Vector3(0, -1, 0);
    const rng = createRng(`${ctx.config.seed}/terrain-sampler-proof`);
    const probes: [number, number][] = [];
    // 200 in the detail zone (stair/plaza-weighted), 100 in the 48–60 m band, 60 beyond
    for (let i = 0; i < 120; i++) probes.push([rng.range(-46, 46), rng.range(-46, 46)]);
    for (let i = 0; i < 80; i++) probes.push([rng.range(3, 21), rng.range(-13, 7)]);
    for (let i = 0; i < 100; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(48.5, 60);
      probes.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = 0; i < 60; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(60, 200);
      probes.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    let maxDetail = 0;
    let max60 = 0;
    let maxAll = 0;
    let hits = 0;
    for (const [x, z] of probes) {
      origin.set(x, 400, z);
      ray.set(origin, down);
      const candidates = meshes.filter((m) => {
        const b = m.geometry.boundingBox!;
        return x >= b.min.x - 1e-6 && x <= b.max.x + 1e-6 && z >= b.min.z - 1e-6 && z <= b.max.z + 1e-6;
      });
      const hit = ray.intersectObjects(candidates, false)[0];
      if (!hit) continue;
      hits++;
      const err = Math.abs(T.height(x, z) - hit.point.y);
      const d = Math.hypot(x, z);
      maxAll = Math.max(maxAll, err);
      if (Math.abs(x) <= 48 && Math.abs(z) <= 48) maxDetail = Math.max(maxDetail, err);
      if (d <= 60) max60 = Math.max(max60, err);
    }
    meshError = {
      samplerMeshProbes: hits,
      samplerMeshMaxErrorDetailM: maxDetail,
      samplerMeshMaxErrorM: max60,
      samplerMeshMaxErrorAllM: maxAll,
    };
    return meshError;
  };

  ctx.audit('terrain', () => ({
    chunks: group.children.length,
    vertices,
    triangles,
    rings: 3,
    innerSpacing: LATTICE.detail.spacing,
    lattice: { detail: LATTICE.detail, mid: LATTICE.mid, outer: LATTICE.outer },
    ...samplerMeshError(),
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
