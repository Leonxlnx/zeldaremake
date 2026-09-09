/**
 * Structures — owner: structures agent.
 * Kokiri tree-trunk houses with mossy dome roofs, glowing pod lanterns, the wooden signpost,
 * post-and-rail fences, lanterns + vines on the lantern branch, and the giant hollow log arch.
 * All positions come from `layout`; all ground contact is sampled through `ctx.terrain`;
 * randomness only through `ctx.rng.fork` / Noise2D; textures through `ctx.textures`.
 */
import { Group, type Mesh, type PointLight } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { buildFence } from './fence';
import { buildHouse } from './house';
import { swingLanterns, type LanternRig } from './lantern';
import { buildLanternBranch } from './lanternBranch';
import { buildLogArch } from './logArch';
import { loadMaterials } from './materials';
import { buildSignpost } from './signpost';

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'structures';
  const rng = ctx.rng.fork('structures');
  const mats = await loadMaterials(ctx, rng.fork('canvas'));
  ctx.progress('structures', 0.15);

  const lanterns: LanternRig[] = [];
  const lights: PointLight[] = [];
  const bases: [number, number, number][] = [];
  let houseLanterns = 0;
  let houseRoots = 0;
  let houseBranches = 0;
  let leaves = 0;

  // ---- houses ----
  const houses = ctx.layout.houses.map((h) => buildHouse(h, ctx, mats, rng.fork(`house/${h.id}`)));
  for (const hb of houses) {
    group.add(hb.group);
    lanterns.push(...hb.lanterns);
    lights.push(...hb.lights);
    bases.push(...hb.bases);
    houseLanterns += hb.lanterns.length;
    houseRoots += hb.roots;
    houseBranches += hb.branches;
    leaves += hb.leaves;
  }
  ctx.progress('structures', 0.55);

  // ---- lantern branch (cords + pods + vines; the limb is the trees system's) ----
  const branch = buildLanternBranch(ctx, mats, rng.fork('lantern-branch'));
  group.add(branch.group);
  lanterns.push(...branch.lanterns);
  lights.push(...branch.lights);
  leaves += branch.leaves;

  // ---- signposts ----
  const signposts = ctx.layout.signposts.map((s) => buildSignpost(s, ctx, mats, rng.fork(`sign/${s.id}`)));
  for (const sb of signposts) {
    group.add(sb.group);
    bases.push(sb.base);
  }

  // ---- fences ----
  const fences = ctx.layout.fences.map((f) => buildFence(f, ctx, mats, rng.fork(`fence/${f.id}`)));
  let fencePosts = 0;
  for (const fb of fences) {
    group.add(fb.mesh);
    bases.push(...fb.bases);
    fencePosts += fb.posts;
  }
  ctx.progress('structures', 0.75);

  // ---- log arch ----
  const log = buildLogArch(ctx, mats, rng.fork('log-arch'));
  group.add(log.group);
  lanterns.push(...log.lanterns);
  lights.push(...log.lights);
  bases.push(...log.bases);
  leaves += log.leaves;
  ctx.progress('structures', 1);

  // count real scene facts for the audit (cross-checked against the scene graph)
  const countMeshes = (name: string) => {
    let n = 0;
    group.traverse((o) => {
      if ((o as Mesh).isMesh && o.name === name) n++;
    });
    return n;
  };
  const maxBaseGap = () => {
    let gap = 0;
    for (const b of bases) gap = Math.max(gap, Math.abs(b[1] - ctx.terrain.height(b[0], b[2])));
    return gap;
  };
  /** meshes (= draw calls when all are in view) and triangles owned by this system */
  const budget = () => {
    let meshes = 0;
    let triangles = 0;
    group.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      meshes++;
      const g = m.geometry;
      triangles += Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
    });
    return { meshes, triangles };
  };

  ctx.audit('structures', () => ({
    ...budget(),
    houses: houses.length,
    geometry: 'procedural-v1',
    mossRoof: true,
    doorLight: houses.every((h) => h.lights.some((l) => l.name === 'door-light')),
    lanterns: countMeshes('pod-lantern'),
    houseLanterns,
    branchLanterns: branch.lanterns.length,
    lanternBranch: branch.lanterns.length >= 3,
    logLanterns: log.lanterns.length,
    signposts: signposts.length,
    fences: fences.length,
    fencePosts,
    logArch: true,
    houseRoots,
    houseBranches,
    leaves,
    pointLights: lights.length,
    textureSets: mats.texturedSets,
    maxBaseGap: maxBaseGap(),
    samplePositions: { bases },
  }));

  const windDir = ctx.wind.direction;
  return {
    name: 'structures',
    group,
    update(_dt, t) {
      swingLanterns(lanterns, t, windDir.x, windDir.y);
    },
    dispose() {
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) m.geometry?.dispose();
      });
      for (const mat of Object.values(mats)) {
        if (mat && typeof (mat as { dispose?: () => void }).dispose === 'function') (mat as { dispose: () => void }).dispose();
      }
    },
  };
}
