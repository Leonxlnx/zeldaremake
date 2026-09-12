/**
 * Structures — owner: structures agent.
 * Kokiri tree-trunk houses with mossy dome roofs, glowing pod lanterns, the wooden signpost,
 * post-and-rail fences on the plateau lip, rope fences off the paving, pod-lantern posts,
 * lanterns + vines on the lantern branch, and the giant hollow log arch.
 * Positions come from `layout`, including rope fences and lantern posts placed against the
 * fixed cameras; all ground contact is sampled through `ctx.terrain`;
 * randomness only through `ctx.rng.fork` / Noise2D; textures through `ctx.textures`.
 */
import { Group, type Mesh, type PointLight } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { ROPE_FENCES, LANTERN_POSTS, type FenceDef } from '../layout';
import { buildFence, createRopeMaterial } from './fence';
import { buildDistantHouses, distantGlowPeak } from './distantHouse';
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
  /**
   * GPU resources this system owns besides the meshes' geometries and the `mats` materials: the
   * rope material, the houses' own materials (room / window-glow clones), the distant huts' glow
   * material + geometry, and every canvas texture materials.ts generated (round 17 — the moss
   * albedo / normal maps and the other canvases were never released; `Material.dispose()` does
   * not dispose maps, and the TextureLibrary does not own these). Each is disposed exactly once
   * in `dispose()`; the library's borrowed bark / plank / thatch maps are never in here.
   */
  const owned: { dispose(): void }[] = [rope, ...mats.ownedTextures];
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
    owned.push(...hb.materials);
    houseLanterns += hb.lanterns.length;
    houseRoots += hb.roots;
    houseBranches += hb.branches;
    leaves += hb.leaves;
  }
  // ---- distant tree houses (round 16): three lit huts 30–47 m out on existing trunks; their
  // bark / plank / cap parts fold into the house draws below, their glow is one emissive mesh ----
  const distant = buildDistantHouses(ctx, mats, rng.fork('distant-houses'));
  group.add(distant.group);
  owned.push(mats.distantGlow, distant.glow.geometry);
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
  // Distant caps need their own bounds: merging them into the hero roofs' large mesh
  // makes the old roof bucket intersect look-back cameras even when every roof is offscreen.
  // Keep material/geometry data shared; only the static draw grouping changes.
  const distantCaps = new Group();
  distantCaps.name = 'distant-house-caps';
  const distantCapMeshes: Mesh[] = [];
  distant.group.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh && mesh.material === mats.capMoss) distantCapMeshes.push(mesh);
  });
  for (const mesh of distantCapMeshes) distantCaps.attach(mesh);
  const draws = consolidateStaticMeshes(group, (m) => m.name === 'pod-lantern');
  const capDraws = consolidateStaticMeshes(distantCaps);
  group.add(distantCaps);
  draws.before += capDraws.before;
  draws.after += capDraws.after;
  draws.merged += capDraws.merged;
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
    /** Saria's support bough: centre line (33 world points from the trunk to the tip) and radii (round 15) */
    houseBough: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.bough,
    /** flower heads on the caps / pots and bottles on the shelves, all houses */
    houseFlowers: houses.reduce((n, h) => n + h.flowers, 0),
    houseProps: houses.reduce((n, h) => n + h.props, 0),
    /** round 16: the far village — huts on existing trunks, audited apart from the two hero houses */
    distantHouses: distant.audit.length,
    distantHouseTriangles: distant.triangles,
    /** round 18: 'shared' = every hut sits on a seat from `ctx.shared.trunkSeats`, 'constants' = the authored copies, 'mixed' = some of each */
    distantHostSource: distant.hostSource,
    /** round 18: zero-area triangles left in the huts (the cap poles and pod apexes are filtered; expect 0) */
    distantDegenerateTriangles: distant.degenerateTriangles,
    /** the shared emissive's peak channel (linear); must exceed the height fog's 2.0 far-shade exemption */
    distantGlowPeak: +distantGlowPeak(mats).toFixed(2),
    /** peak linear channel of each glow tint as rendered (lamps / pods ≥ 2.0 are fog-exempt; the rims are not meant to be) */
    distantGlowTints: distant.glowTintPeaks,
    distantHouseDetail: distant.audit,
    leaves,
    pointLights: lights.length,
    textureSets: mats.texturedSets,
    /** round 17: the canvas textures this system generated and will dispose (not the library's maps) */
    ownedTextures: mats.ownedTextures.map((t) => t.name),
    /** resources in `owned`: rope, house materials, distant glow and generated textures;
     *  sign and post-pod helpers retain their own separately managed extras */
    ownedResources: owned.length,
    maxBaseGap: maxBaseGap(),
    samplePositions: { bases },
  }));

  const windDir = ctx.wind.direction;
  let disposed = false;
  return {
    name: 'structures',
    group,
    update(_dt, t) {
      swingLanterns(lanterns, t, windDir.x, windDir.y);
    },
    dispose() {
      // one-shot: every geometry, material and owned texture is released exactly once, however
      // many lists it sits in (the distant glow's material is in `mats` and in `owned`)
      if (disposed) return;
      disposed = true;
      const done = new Set<object>();
      const once = (r: { dispose(): void } | null | undefined) => {
        if (!r || done.has(r)) return;
        done.add(r);
        r.dispose();
      };
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) once(m.geometry);
      });
      for (const mat of Object.values(mats)) {
        if (mat && typeof (mat as { dispose?: () => void }).dispose === 'function') once(mat as { dispose: () => void });
      }
      for (const r of owned) once(r);
      owned.length = 0;
      // Existing sign/post helpers own their additional materials and generated maps.
      for (const sb of signposts) sb.disposeMaterials();
      postPod.dispose();
    },
  };
}
