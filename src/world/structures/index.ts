/**
 * Structures — owner: structures agent.
 * Kokiri tree-trunk houses with mossy dome roofs, glowing pod lanterns, the wooden signpost,
 * post-and-rail fences on the plateau lip, rope fences off the paving, pod-lantern posts,
 * lanterns + vines on the lantern branch, and the giant hollow log arch.
 * Positions come from `layout`, including rope fences and lantern posts placed against the
 * fixed cameras; all ground contact is sampled through `ctx.terrain`;
 * randomness only through `ctx.rng.fork` / Noise2D; textures through `ctx.textures`.
 */
import { Group, type Mesh, type Object3D, type PointLight } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { ROPE_FENCES, LANTERN_POSTS, type FenceDef } from '../layout';
import { buildCameraSolids, limbSpheres } from './cameraSolids';
import { buildFence, createRopeMaterial } from './fence';
import { buildDistantHouses, distantGlowPeak } from './distantHouse';
import { buildExpansion, EXPANSION_VISIBLE_M } from './expansion';
import { consolidateStaticMeshes } from './geometry';
import { buildHouse, type HouseSharedMaterials } from './house';
import { swingLanterns, type LanternRig } from './lantern';
import { buildLanternBranch } from './lanternBranch';
import { buildLanternPost } from './lanternPost';
import { buildLogArch } from './logArch';
import { loadMaterials } from './materials';
import { NORTH_LANTERN_POSTS, NORTH_ROPE_FENCES, NORTH_SIGNPOSTS, NORTH_VISIBLE_M } from './north';
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
  const posts = LANTERN_POSTS.map((p) => buildLanternPost(p, ctx, mats, rng.fork(`lantern-post/${p.id}`), rope));
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

  // ---- round 48 (structures-31): beyond the arch — two pod posts, a signpost at the north mouth
  // and the terrace lip's rope rail (north.ts). Its own group: consolidated apart from the hero
  // buckets and hidden beyond NORTH_VISIBLE_M of the clearing (update / onCameraMove below), so
  // the six fixed frames (67 m+ away) never draw a triangle or a light of it. Own forks, appended
  // after the arch so every stream before it is unchanged. ----
  const north = new Group();
  north.name = 'structures-north';
  const northLanterns: LanternRig[] = [];
  const northLights: PointLight[] = [];
  let northLeaves = 0;
  const northSigns = NORTH_SIGNPOSTS.map((s) => buildSignpost(s, ctx, mats, rng.fork(`north/sign/${s.id}`)));
  for (const sb of northSigns) {
    north.add(sb.group);
    bases.push(sb.base);
  }
  const northFences = NORTH_ROPE_FENCES.map((f) => buildFence(f, ctx, mats, rng.fork(`north/fence/${f.id}`), rope));
  let northFencePosts = 0;
  for (const fb of northFences) {
    for (const m of fb.meshes) north.add(m);
    bases.push(...fb.bases);
    northFencePosts += fb.posts;
  }
  const northPosts = NORTH_LANTERN_POSTS.map((p) => buildLanternPost(p, ctx, mats, rng.fork(`north/lantern-post/${p.id}`), rope));
  for (const pb of northPosts) {
    north.add(pb.group);
    northLanterns.push(...pb.lanterns);
    northLights.push(...pb.lights);
    bases.push(pb.base);
    northLeaves += pb.leaves;
  }
  lanterns.push(...northLanterns);
  lights.push(...northLights);
  leaves += northLeaves;
  const northCentre = ctx.layout.northClearing;
  const northVisible = (cx: number, cz: number) => Math.hypot(cx - northCentre.x, cz - northCentre.z) < NORTH_VISIBLE_M;

  // ---- round 49 (expansion-2): the west and south-west dressing — the second tree-house round the
  // southwest giant, the far hut in the haze on its bark column, the south bank's rope fences
  // (expansion.ts). Own forks after every stream above; its near group is consolidated apart and
  // hidden beyond EXPANSION_VISIBLE_M of the expansion's box or when neither it nor its shadow
  // footprint meets the camera frustum (util/expansionLocality.ts); its far group (the hut + column,
  // the haze's far lamp) is consolidated apart and frustum-hidden the same way at any distance.
  // The west house's platform / deck / wall go to ctx.shared.walkSurfaces for the character ground. ----
  const expansion = buildExpansion(ctx, mats, rng.fork('expansion'), rope);
  bases.push(...expansion.bases);
  // round 55: the dressed huts' crafted lanterns swing with the rest; their lights stay in the main
  // group (the expansion's near group hides by distance — a light leaving the scene recompiles every lit program)
  lanterns.push(...distant.lanterns, ...expansion.houses.lanterns, ...expansion.farHouse.lanterns);
  for (const l of [...distant.lights, ...expansion.houses.lights, ...expansion.farHouse.lights]) {
    group.add(l);
    lights.push(l);
  }
  ctx.shared.walkSurfaces = [...(ctx.shared.walkSurfaces ?? []), ...expansion.houses.walk];

  // the play camera's solids (cameraSolids.ts), voxelised from the parts by name before the merges
  // below rename them; never under a headless capture
  const cameraSolids = ctx.headless ? null : buildCameraSolids([group, north, expansion.group], limbSpheres(ctx.shared.lanternLimb));
  if (cameraSolids) ctx.shared.cameraSolids = { solid: cameraSolids.solid, slim: cameraSolids.slim };

  // ---- draw-call budget: fold the static parts into one mesh per material (+ shadow flags) ----
  // The pods stay separate (their pivots swing), as do the transparent glow cards and the log's
  // unique-material parts; everything else — bark, roof, boughs, fence posts and ropes, lantern
  // posts, door frames, the sign's wood, leaves, vines, tufts — renders as one draw per material.
  // The distant village is consolidated APART from the hero structures (round 20; round 17 did
  // this for the caps alone): a hut part merged into a hero bucket stretches that bucket's
  // bounding sphere from Saria's house out to the 30–47 m huts, and a look-back camera that sees
  // no hut and no porch then accepts the whole bucket (C_lookback drew Saria's porch recess +
  // the huts' recesses, +21.8 k triangles / +1 call, through exactly that sphere). So the hero
  // group is merged with the village detached, the village is merged on its own (one draw per
  // material: bark, planks, cap moss + the glow singleton), and re-attached. Hero buckets carry
  // hero data only; material / geometry data stay shared; only the static draw grouping changes.
  distant.group.removeFromParent();
  // round 45 (details-1): the huts' soffit boards are the one hut part merged WITH the hero group —
  // they share the fences' material and flags and fold into the fences' bucket (as does the sign's
  // wood), so a lit soffit costs no draw of its own; kept in the village group it was a bucket of
  // one in every view that sees a hut (distantHouse.ts).
  if (distant.soffit) group.add(distant.soffit);
  const draws = consolidateStaticMeshes(group, (m) => m.name === 'pod-lantern');
  const distantDraws = consolidateStaticMeshes(distant.group);
  group.add(distant.group);
  draws.before += distantDraws.before;
  draws.after += distantDraws.after;
  draws.merged += distantDraws.merged;
  // the north group is merged on its own (one draw per material within 45 m of the clearing,
  // nothing beyond) and attached last; its pods stay separate like every other pod
  const northDraws = consolidateStaticMeshes(north, (m) => m.name === 'pod-lantern');
  group.add(north);
  north.visible = northVisible(ctx.camera.position.x, ctx.camera.position.z);
  draws.before += northDraws.before;
  draws.after += northDraws.after;
  draws.merged += northDraws.merged;
  // round 49: the expansion's two groups, each merged on its own (the far hut's bucket must not
  // share a culling sphere with the west house's — a sphere spanning both would reach into A / D)
  const expansionNearDraws = consolidateStaticMeshes(expansion.near);
  const expansionFarDraws = consolidateStaticMeshes(expansion.far);
  group.add(expansion.group);
  expansion.near.visible = expansion.visible(ctx.camera);
  expansion.far.visible = expansion.farVisible(ctx.camera);
  for (const d of [expansionNearDraws, expansionFarDraws]) {
    draws.before += d.before;
    draws.after += d.after;
    draws.merged += d.merged;
  }
  /**
   * The merged buckets' culling bounds (audit, round 20): what three.js frustum-tests each static
   * draw against — geometry bounding sphere at the identity transform — with its triangle count and
   * whether it belongs to the hero group or the detached village. A hero bucket whose sphere spans
   * the village again would show here as a radius ≥ 15 m.
   */
  const mergedBuckets = () => {
    const out: { name: string; group: 'hero' | 'distant' | 'north' | 'expansion'; centre: [number, number, number]; radius: number; triangles: number }[] = [];
    const visit = (root: Object3D, which: 'hero' | 'distant' | 'north' | 'expansion') => {
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (which === 'hero' && (!m.name.startsWith('merged:') || distant.group.getObjectById(m.id) || north.getObjectById(m.id) || expansion.group.getObjectById(m.id))) return;
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const s = g.boundingSphere!;
        out.push({
          name: m.name,
          group: which,
          centre: [+s.center.x.toFixed(2), +s.center.y.toFixed(2), +s.center.z.toFixed(2)],
          radius: +s.radius.toFixed(2),
          triangles: Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3),
        });
      });
    };
    visit(group, 'hero');
    visit(distant.group, 'distant');
    visit(north, 'north');
    visit(expansion.group, 'expansion');
    return out;
  };
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
    /** the play camera's collision grids (null under a headless capture) */
    cameraSolids: cameraSolids?.report ?? null,
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
    /** round 32: the arch pods' world centres (D projects the east pair to (0.60, 0.35) / (0.62, 0.36), the west three to (0.44–0.48, 0.42–0.43)) */
    logLanternPositions: log.podPositions,
    /** round 44 (structures-28): each arch pod's lowest point over the ground under it; the least clearance over the path (m, ≥ 2.3 wanted) */
    logPodClearance: log.podClearance,
    logMinPathClearance: log.minPathClearance,
    /** round 44: the player-height bark plates, humus foot skirts and bark chunks under the arch's near LOD */
    logNearDetail: log.detail44,
    /** round 47 (structures-30): the passage under the arch at walking height — roots, rim vines / beards, fungus tiers, daylight slivers, litter; the lowest any of it hangs over the strip */
    logPassageDetail: log.detail47,
    /** round 49 (structures-32): the passage tube under the arch — frame, cross-section, cheeks, north portal, floor decal; the tube's least height over the strip */
    logTunnel: log.detail49,
    logFlatTop: log.detail50,
    signposts: signposts.length,
    fences: fences.length,
    fencePosts,
    ropeFences: ROPE_FENCES.length,
    lanternPosts: posts.length,
    postLanterns: posts.reduce((n, p) => n + p.lanterns.length, 0),
    /** round 48 (structures-31): beyond the arch — pod posts, the north-mouth signpost, the terrace rail; drawn only within `visibleWithinM` of the clearing */
    north: {
      lanternPosts: northPosts.length,
      postLanterns: northLanterns.length,
      signposts: northSigns.length,
      ropeFences: northFences.length,
      fencePosts: northFencePosts,
      pointLights: northLights.length,
      draws: northDraws.after,
      visibleWithinM: NORTH_VISIBLE_M,
      visible: north.visible,
      bases: [...northPosts.map((p) => p.base), ...northSigns.map((s) => s.base), ...northFences.flatMap((f) => f.bases)],
    },
    /** round 49 (expansion-2): the west house, the far hut + column and the south bank's fences (expansion.ts); the near group draws only within `visibleWithinM` of the expansion's box */
    expansion: {
      houses: [...expansion.houses.audit, ...expansion.farHouse.audit].map((a) => ({ id: a.id, hostSource: a.hostSource, seatId: a.seatId, centre: a.centre, floorY: a.floorY, radius: a.radius, window: a.window, door: a.door, lamps: a.lamps, pods: a.pods, dressing: a.dressing })),
      houseTriangles: expansion.houses.triangles + expansion.farHouse.triangles,
      column: expansion.column,
      ropeFences: expansion.fences.length,
      fencePosts: expansion.fences.reduce((n, f) => n + f.posts, 0),
      walkSurfaces: expansion.houses.walk,
      draws: expansionNearDraws.after + expansionFarDraws.after,
      visibleWithinM: EXPANSION_VISIBLE_M,
      nearVisible: expansion.near.visible,
      farVisible: expansion.far.visible,
      bases: expansion.bases,
    },
    logArch: true,
    /** round 41 (structures-26): the arch's close-scale detail — grid, cushion tufts, rim splinters, skirt, plants */
    logDetail: log.detail41,
    /** round 41: the signposts' and fences' grain / checked ends / foot moss / laid rope */
    woodDetail: { signposts: signposts.map((s) => s.detail41), fences: fences.map((f, i) => ({ id: fenceDefs[i].id, ...f.detail41 })) },
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
    /** Saria's root-buttresses (round 19; branch pillars before): feet on the terrain, where they leave the arch (world), foot radius */
    housePillars: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.pillars,
    /** round 19: Saria's trunk burls' seam check — max paired-seam-vertex position (mm) / normal (deg) delta (expect 0 / 0) */
    houseBurls: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.burls,
    /** round 19: Saria's entrance arch — crown axis (world), radius, underside / top above her floor, angular span */
    houseArch: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.arch,
    /** Saria's room: the level floor pad's height, back-wall depths (left / mid / right) and the
     *  slope's poke through the pad (≤ 0 = the pad is clear; round 14) */
    houseRoom: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.room,
    /** Saria's support bough: centre line (33 world points from the trunk to the tip) and radii (round 15) */
    houseBough: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.bough,
    /** round 40: the caps' moss cushion tufts, torn edge and small plants, per house */
    houseMossDetail: Object.fromEntries(ctx.layout.houses.map((h, i) => [h.id, houses[i]?.mossDetail])),
    /** round 41: the trunks' furrow moss tufts, root / arch moss caps, lichen plates and root-foot trefoils, per house */
    houseTrunkDetail: Object.fromEntries(ctx.layout.houses.map((h, i) => [h.id, houses[i]?.trunkDetail])),
    /** round 47 (structures-30): Saria's furnished room (bed, rug, plants, table / hearth pieces) and the doorway's callus roll */
    houseFurnishing: houses[Math.max(0, ctx.layout.houses.findIndex((h) => h.id === 'saria'))]?.furnishing,
    /** round 47: the signposts' carved lettering — strokes on the board, front-face vertices sunk */
    signGlyphs: signposts.map((s) => s.glyphs),
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
    /** peak linear channel of each glow tint as rendered (lamps / pods ≥ 2.0 are fog-exempt; the reveals and backs are not meant to be) */
    distantGlowTints: distant.glowTintPeaks,
    /** round 20: the openings' reveals — no emissive rim; lamp-response tints (peak, mouth-row peak and lit share), splay, lamp offsets */
    distantReveal: distant.reveal,
    distantHouseDetail: distant.audit,
    /** round 20: every static bucket's culling sphere (centre, radius) + triangles, hero vs the detached village */
    mergedBuckets: mergedBuckets(),
    distantDraws: distantDraws.after,
    leaves,
    pointLights: lights.length,
    textureSets: mats.texturedSets,
    /** round 17: the canvas textures this system generated and will dispose (not the library's maps) */
    ownedTextures: mats.ownedTextures.map((t) => t.name),
    /** everything `dispose()` releases besides the geometries and `mats`: rope + house materials, distant glow, owned textures */
    ownedResources: owned.length,
    maxBaseGap: maxBaseGap(),
    samplePositions: { bases },
  }));

  const windDir = ctx.wind.direction;
  let disposed = false;
  return {
    name: 'structures',
    group,
    // the walk moves the camera every frame; pose jumps (captures) come through onCameraMove
    update(_dt, t, c) {
      swingLanterns(lanterns, t, windDir.x, windDir.y);
      north.visible = northVisible(c.camera.position.x, c.camera.position.z);
      expansion.near.visible = expansion.visible(c.camera);
      expansion.far.visible = expansion.farVisible(c.camera);
    },
    onCameraMove(camera) {
      north.visible = northVisible(camera.position.x, camera.position.z);
      expansion.near.visible = expansion.visible(camera);
      expansion.far.visible = expansion.farVisible(camera);
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
    },
  };
}
