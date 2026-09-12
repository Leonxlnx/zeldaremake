/**
 * Structures — owner: structures agent.
 * Kokiri tree-trunk houses with mossy dome roofs, glowing pod lanterns, the wooden signpost,
 * post-and-rail fences on the plateau lip, rope fences off the paving, pod-lantern posts,
 * lanterns + vines on the lantern branch, and the giant hollow log arch.
 * Positions come from `layout`, including rope fences and lantern posts placed against the
 * fixed cameras; all ground contact is sampled through `ctx.terrain`;
 * randomness only through `ctx.rng.fork` / Noise2D; textures through `ctx.textures`.
 */
import { Group, type Material, type Mesh, type PointLight } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { ROPE_FENCES, LANTERN_POSTS, type FenceDef } from '../layout';
import { buildFence, createRopeMaterial } from './fence';
import { consolidateStaticMeshes } from './geometry';
import { buildHouse, type HouseSharedMaterials } from './house';
import { swingLanterns, type LanternRig } from './lantern';
import { buildLanternBranch } from './lanternBranch';
import { buildLanternPost } from './lanternPost';
import { buildLeafLantern } from './leafPod';
import { createPostPodMaterial } from './postPodMaterial';
import { buildLogArch } from './logArch';
import { loadMaterials } from './materials';
import { buildSignpost } from './signpost';

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'structures';
  const rng = ctx.rng.fork('structures');
  const mats = await loadMaterials(ctx, rng.fork('canvas'));
  // vine rope shared by the rope fences and the lantern posts (defined here, not in materials.ts)
  const rope = createRopeMaterial();
  ctx.progress('structures', 0.15);

  const lanterns: LanternRig[] = [];
  const lights: PointLight[] = [];
  const bases: [number, number, number][] = [];
  const extraMaterials: Material[] = [rope];
  let houseLanterns = 0;
  let houseRoots = 0;
  let houseBranches = 0;
  let leaves = 0;

  // ---- houses ----
  const sharedHouseMats: HouseSharedMaterials = {};
  const houses = ctx.layout.houses.map((h) => buildHouse(h, ctx, mats, rng.fork(`house/${h.id}`), sharedHouseMats));
  for (const hb of houses) {
    group.add(hb.group);
    lanterns.push(...hb.lanterns);
    lights.push(...hb.lights);
    bases.push(...hb.bases);
    extraMaterials.push(...hb.materials);
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

  // ---- fences: the plateau-lip rails from the layout + the rope fences off the paving ----
  const fenceDefs: FenceDef[] = [...ctx.layout.fences, ...ROPE_FENCES];
  const fences = fenceDefs.map((f) => buildFence(f, ctx, mats, rng.fork(`fence/${f.id}`), rope));
  let fencePosts = 0;
  for (const fb of fences) {
    for (const m of fb.meshes) group.add(m);
    bases.push(...fb.bases);
    fencePosts += fb.posts;
  }

  // ---- lantern posts (stair foot, path fork) ----
  const postPod = createPostPodMaterial(mats.lantern, ctx.config.palette.lanternGlow);
  const postMats = { ...mats, lantern: postPod.material };
  const posts = LANTERN_POSTS.map((p) => buildLanternPost(p, ctx, postMats, rng.fork(`lantern-post/${p.id}`), rope, buildLeafLantern));
  for (const pb of posts) {
    group.add(pb.group);
    lanterns.push(...pb.lanterns);
    lights.push(...pb.lights);
    bases.push(pb.base);
    leaves += pb.leaves;
  }
  ctx.progress('structures', 0.75);

  // ---- log arch ----
  const log = buildLogArch(ctx, mats, rng.fork('log-arch'));
  group.add(log.group);
  lanterns.push(...log.lanterns);
  lights.push(...log.lights);
  bases.push(...log.bases);
  leaves += log.leaves;

  // ---- draw-call budget: fold the static parts into one mesh per material (+ shadow flags) ----
  // The pods stay separate (their pivots swing), as do the transparent glow cards and the log's
  // unique-material parts; everything else — bark, roof, boughs, fence posts and ropes, lantern
  // posts, door frames, the sign's wood, leaves, vines, tufts — renders as one draw per material.
  const draws = consolidateStaticMeshes(group, (m) => m.name === 'pod-lantern');
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
    meshesBeforeMerge: draws.before,
    mergedMeshes: draws.merged,
    houses: houses.length,
    geometry: 'procedural-v1',
    mossRoof: true,
    doorLight: houses.every((h) => h.lights.some((l) => l.name === 'door-light')),
    lanterns: countMeshes('pod-lantern'),
    houseLanterns,
    branchLanterns: branch.lanterns.length,
    lanternBranch: branch.lanterns.length >= 3,
    /** the sleeve's centreline: the trees' published limb path ('shared') or the layout axis ('layout') */
    branchWrapSource: branch.wrapSource,
    /** giant limb surface vs sleeve: max protrusion (m, ≤ 0 = the limb is inside the sleeve) */
    branchContainment: branch.containment,
    /** world centres of the bough's pods (project to A: tuned y ≈ 0.40–0.41) */
    branchPodPositions: branch.podPositions,
    /** sleeve top / bottom surface points along the bough for projected-thickness checks */
    branchSilhouette: branch.silhouette,
    logLanterns: log.lanterns.length,
    signposts: signposts.length,
    fences: fences.length,
    fencePosts,
    ropeFences: ROPE_FENCES.length,
    lanternPosts: posts.length,
    postLanterns: posts.reduce((n, p) => n + p.lanterns.length, 0),
    postLightIntensities: posts.flatMap((p) => p.lights.map((l) => +l.intensity.toFixed(3))),
    logArch: true,
    houseRoots,
    houseBranches,
    /** Saria's eave profile on the door axis (world), now and as rounds 10 / 11 built it */
    houseEave: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.eave,
    /** Saria's doorway opening (width × height, world corners), now and as round 11 built it */
    houseDoor: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.door,
    /** Saria's cap silhouette (rim ring, crown top, overhang, straw share), now and at ×1.0 */
    houseCap: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.cap,
    hearthClearance: houses.map((h) => +h.hearthClearance.toFixed(3)),
    /** Saria's round window (round 13): wall-surface centre, clear radius, height above her floor */
    houseWindow: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.window,
    /** Saria's branch pillars: feet on the terrain and rim ends (world) */
    housePillars: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.pillars,
    /** Saria's room: the level floor pad's height, back-wall depths (left / mid / right) and the
     *  slope's poke through the pad (≤ 0 = the pad is clear; round 14) */
    houseRoom: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.room,
    /** flower heads on the caps / pots and bottles on the shelves, all houses */
    houseFlowers: houses.reduce((n, h) => n + h.flowers, 0),
    houseProps: houses.reduce((n, h) => n + h.props, 0),
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
      for (const m of extraMaterials) m.dispose();
      for (const sb of signposts) sb.disposeMaterials();
      postPod.dispose();
    },
  };
}
