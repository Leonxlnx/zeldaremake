/**
 * Structures — owner: structures agent.
 * Kokiri tree-trunk houses with mossy dome roofs, glowing pod lanterns, the wooden signpost,
 * post-and-rail fences on the plateau lip, rope fences off the paving, pod-lantern posts,
 * lanterns + vines on the lantern branch, and the giant hollow log arch.
 * Positions come from `layout`, including rope fences and lantern posts placed against the
 * fixed cameras; all ground contact is sampled through `ctx.terrain`;
 * randomness only through `ctx.rng.fork` / Noise2D; textures through `ctx.textures`.
 */
import { Box3, Group, Vector3, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type Object3D, type PointLight } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { ROPE_FENCES, LANTERN_POSTS, type FenceDef } from '../layout';
import { buildCameraSolids, limbSpheres } from './cameraSolids';
import { buildFence, createRopeMaterial } from './fence';
import { buildDistantHouses, distantGlowPeak } from './distantHouse';
import { buildEast } from './east';
import { buildExpansion, EXPANSION_VISIBLE_M } from './expansion';
import { buildExpansionSouth } from './expansionSouth';
import { buildExpansionNorth, GROVE_VISIBLE_M } from './expansionNorth';
import { EAST_FAR, EAST_FAR_LOD_K, EAST_ZONE, eastFarCell, inEastFar, inEastZone } from '../util/eastLane';
import { SOUTH_VISIBLE_M } from '../util/expansionLocality';
import { consolidateStaticMeshes } from './geometry';
import { buildHouse, HOUSE_CLONES, type HouseSharedMaterials } from './house';
import { swingLanterns, type LanternRig } from './lantern';
import { buildLanternBranch } from './lanternBranch';
import { buildLanternPost } from './lanternPost';
import { buildLogArch } from './logArch';
import { loadMaterials } from './materials';
import { NORTH_LANTERN_POSTS, NORTH_ROPE_FENCES, NORTH_SIGNPOSTS, NORTH_VISIBLE_M } from './north';
import { attachFarLod, type FarLod } from './farLod';
import { attachShadowLod, rangedTriangles } from './shadowProxy';
import { buildSignpost } from './signpost';

/** the village houses' moss tufts draw within this distance of either trunk (the east houses' detail reach, util/eastLane.ts EAST_DETAIL_M) */
const VILLAGE_TUFTS_M = 34;
/** a village room still draws while the camera is this far behind its doorway's plane */
const VILLAGE_ROOM_MARGIN_M = 0.5;
/** the smallest part (triangles) the far colour LOD clusters */
const EAST_FAR_MIN_TRIANGLES = 1000;
const _toDoor = new Vector3();

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
  // the posts' lights stay in the scene whatever the distance (like the dressed huts' below): the
  // group hides its meshes beyond NORTH_VISIBLE_M, and a light that leaves or joins the scene
  // changes the light count every lit program is keyed on — the first walk north recompiled
  // them all at the 45 m line. Out of range their 5 m reach adds exactly nothing to a pixel.
  for (const l of northLights) group.attach(l);
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

  // ---- round 56 (expansion-south): the village's way out — the rope bridge over the ravine and the
  // glowing hollow log in the far bank (expansionSouth.ts). Own fork after every stream above; its
  // group is consolidated apart and hidden beyond SOUTH_VISIBLE_M of the south boxes or when
  // neither it nor its shadow footprint meets the camera frustum (util/expansionLocality.ts). No
  // lights: the pods and the log's inside glow are emissive. The deck and the log's floor go to
  // ctx.shared.walkSpans for the character ground. ----
  const south = await buildExpansionSouth(ctx, mats, rng.fork('expansion-south'), rope);
  lanterns.push(...south.lanterns);
  bases.push(...south.bases);
  owned.push(...south.owned);
  ctx.shared.walkSpans = [...(ctx.shared.walkSpans ?? []), ...south.walkSpans];

  // ---- 2026-09-24 (expansion-north): the grove hamlet above the ledge terrace — the trunk house and
  // its yard, the stilt house and its gangway, the tree hut on its column, the rope walk and the
  // lookout nest (expansionNorth.ts). Own fork after every stream above; its group is consolidated
  // apart and hidden beyond GROVE_VISIBLE_M of the grove or when the frustum meets none of its
  // spheres (util/groveLocality.ts). No lights: every glow is emissive. Its decks, walkways and
  // railings go to ctx.shared for the character ground. ----
  const grove = buildExpansionNorth(ctx, mats, rng.fork('expansion-north'), rope, sharedHouseMats);
  lanterns.push(...grove.lanterns);
  bases.push(...grove.bases);
  owned.push(...grove.owned);
  ctx.shared.walkSurfaces = [...(ctx.shared.walkSurfaces ?? []), ...grove.walkSurfaces];
  ctx.shared.walkSpans = [...(ctx.shared.walkSpans ?? []), ...grove.walkSpans];
  ctx.shared.walkEdges = [...(ctx.shared.walkEdges ?? []), ...grove.walkEdges];
  ctx.shared.builtFootprints = [...(ctx.shared.builtFootprints ?? []), ...grove.footprints];

  // ---- round 56 (exp-east): the lane on the east plateau past the main stairway's head — the shop,
  // the tall house with its deck, the small house, two pod posts, the lookout (east.ts). Own forks
  // after every stream above; no point lights (the pods and room glow are emissive); its tiers are
  // consolidated apart and hidden by distance / frustum like the expansion's; its pods swing on the
  // GPU (east.consolidate bakes them), not in `lanterns`. Its deck and steps are appended to
  // ctx.shared.walkSurfaces after every existing surface (props index them by position). ----
  const east = buildEast(ctx, mats, rng.fork('east'), rope, sharedHouseMats);
  bases.push(...east.bases);
  owned.push(...east.owned);
  ctx.shared.walkSurfaces = [...(ctx.shared.walkSurfaces ?? []), ...east.walk];

  // the play camera's solids (cameraSolids.ts), voxelised from the parts by name before the merges
  // below rename them; never under a headless capture
  const cameraSolids = ctx.headless ? null : buildCameraSolids([group, north, expansion.group, south.group, grove.group, east.group], limbSpheres(ctx.shared.lanternLimb), grove.cameraWalls);
  if (cameraSolids) ctx.shared.cameraSolids = { solid: cameraSolids.solid, slim: cameraSolids.slim, walls: cameraSolids.walls };

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
  /**
   * The two houses' moss tufts — the caps' cushions and the trunks' furrow tufts (house.ts rounds
   * 40 / 41), one bucket each — draw within VILLAGE_TUFTS_M of either trunk. Past it most of them
   * span 1–1.5 px of a 540-px-tall 46° frame (the largest 3 px), and the colonies they gather in
   * stay in the sheets' own mottle. Every fixed camera is within 24 m of Saria's trunk; the east
   * lane's green and lookout (38–45 m off) are not.
   */
  const villageTufts: Mesh[] = [];
  group.traverse((o) => {
    if ((o as Mesh).isMesh && /^(merged:)?(roof-tufts|trunk-moss-tufts)$/.test(o.name)) villageTufts.push(o as Mesh);
  });
  const scopeVillageTufts = (x: number, z: number) => {
    const on = ctx.layout.houses.some((h) => Math.hypot(x - h.position[0], z - h.position[2]) < VILLAGE_TUFTS_M);
    for (const m of villageTufts) m.visible = on;
  };
  scopeVillageTufts(ctx.camera.position.x, ctx.camera.position.z);
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
  // round 56: the south group merged on its own too (its buckets span the bridge and the log, 30–55 m south)
  const southDraws = consolidateStaticMeshes(south.group, (m) => m.name === 'pod-lantern');
  group.add(south.group);
  south.group.visible = south.visible(ctx.camera);
  const groveDraws = consolidateStaticMeshes(grove.group, (m) => m.name === 'pod-lantern');
  group.add(grove.group);
  grove.group.visible = grove.visible(ctx.camera);
  for (const d of [expansionNearDraws, expansionFarDraws, southDraws, groveDraws]) {
    draws.before += d.before;
    draws.after += d.after;
    draws.merged += d.merged;
  }
  const eastDraws = east.consolidate();
  group.add(east.group);
  east.update(ctx.camera);
  draws.before += eastDraws.before;
  draws.after += eastDraws.after;
  draws.merged += eastDraws.merged;
  /**
   * The village's shadow LOD (exp-east): its caps, pale roof branches, sign / fence wood, ropes,
   * vines, lantern hangers and pods cast from a vertex-clustered proxy (shadowProxy.ts) while the
   * camera is farther from them than every fixed camera is (+2 m, ≥ 20 m) — the six scored frames
   * keep every shadow triangle; from the east lane's green and lookout (the caps 31–36 m off) the
   * village casts ≈ 0.25 M fewer. Cells as the east lane's: 12 cm on the caps and branches, 8 cm on
   * wood and rope, 5 cm on vines and hangers, 4 cm on pods — ≤ 2.5 cm outside the surface where
   * they switch, under the sun's 2.8 cm normal bias. The bark, the root arches, the eave bands and
   * the log's bark keep their full shadow: at a cell that saves a third, their furrows put 2–7 % of
   * the vertices over 2 cm outside.
   */
  const villageShadowCells = new Map<Material, number>([
    [mats.capMoss, 0.12],
    [mats.barkPale, 0.12],
    [mats.fenceWood, 0.08],
    [rope, 0.08],
    [mats.vine, 0.05],
    [mats.woodDark, 0.05],
  ]);
  const villageShadowLod = attachShadowLod(
    [group],
    (m) => (m.name === 'pod-lantern' ? 0.04 : villageShadowCells.get(m.material as Material) ?? null),
    ctx.layout.viewpoints.map((v) => new Vector3(...v.position)),
    { skip: [east.group, grove.group] },
  );
  /**
   * The village rooms (exp-east): what a house clones with its doorway's fog plane (house.ts
   * HOUSE_CLONES — the room, its props, rug, plants and lamps) shows through the doorway alone (the
   * round window is a closed glowing socket), so it draws only while the camera is in front of that
   * plane (VILLAGE_ROOM_MARGIN_M behind it still counts) or inside the trunk. Every fixed camera
   * stands in front of both doors; from the east lane both are turned away.
   */
  const villageRooms = new Map<string, { point: Vector3; normal: Vector3; x: number; z: number; radius: number; meshes: Mesh[] }>();
  const collectRooms = (o: Object3D) => {
    if (o === east.group || o === grove.group) return;
    const m = o as Mesh;
    const door = m.isMesh && !Array.isArray(m.material) ? HOUSE_CLONES.get(m.material)?.door : undefined;
    if (door) {
      const key = door.point.toArray().join();
      let room = villageRooms.get(key);
      if (!room) {
        const h = ctx.layout.houses.reduce((a, b) => (Math.hypot(b.position[0] - door.point.x, b.position[2] - door.point.z) < Math.hypot(a.position[0] - door.point.x, a.position[2] - door.point.z) ? b : a));
        room = { point: door.point, normal: door.normal, x: h.position[0], z: h.position[2], radius: h.trunkRadius, meshes: [] };
        villageRooms.set(key, room);
      }
      room.meshes.push(m);
    }
    for (const c of o.children) collectRooms(c);
  };
  collectRooms(group);
  const scopeVillageRooms = (p: Vector3) => {
    for (const r of villageRooms.values()) {
      const on = Math.hypot(p.x - r.x, p.z - r.z) < r.radius || _toDoor.subVectors(p, r.point).dot(r.normal) > -VILLAGE_ROOM_MARGIN_M;
      for (const m of r.meshes) m.visible = on;
    }
  };
  scopeVillageRooms(ctx.camera.position);
  /**
   * The east plateau's far shadows (exp-east): while the camera is on the plateau past the lane's
   * bend (util/eastLane.ts EAST_ZONE), every caster of this system but the lane's stops casting —
   * the village, its log and huts, the expansion, the south bridge, the north and the grove, all
   * 30–95 m off down the stair bank. The six fixed cameras stand outside the zone.
   */
  const eastZoneCasters: Mesh[] = [];
  const collectEastZoneCasters = (o: Object3D) => {
    if (o === east.group) return;
    if ((o as Mesh).isMesh && (o as Mesh).castShadow) eastZoneCasters.push(o as Mesh);
    for (const c of o.children) collectEastZoneCasters(c);
  };
  collectEastZoneCasters(group);
  let inEastZoneNow = false;
  const scopeEastZone = (p: Vector3) => {
    const off = inEastZone(p);
    if (off === inEastZoneNow) return;
    inEastZoneNow = off;
    for (const m of eastZoneCasters) m.castShadow = !off;
  };
  scopeEastZone(ctx.camera.position);
  /**
   * The far colour LOD (exp-east): while the camera is on the plateau's far part (util/eastLane.ts
   * EAST_FAR) the village, its log, signposts and huts, the expansion and the south bridge draw a
   * coarser triangle list (farLod.ts), clustered with cells of 1 / EAST_FAR_LOD_K of each vertex's
   * distance from there; pieces that would thin out under their cells (blades, ribbons, cards) keep
   * their triangles. Left alone: the north and the grove (hidden from there), the houses' tufts
   * (drawn within VILLAGE_TUFTS_M only) and parts under EAST_FAR_MIN_TRIANGLES.
   */
  const eastFarUsers = new Map<BufferGeometry, number>();
  group.traverse((o) => {
    if ((o as Mesh).isMesh) eastFarUsers.set((o as Mesh).geometry, (eastFarUsers.get((o as Mesh).geometry) ?? 0) + 1);
  });
  const eastFarLods: FarLod[] = [];
  let eastFarNearestM = Infinity;
  const eastFarBox = new Box3();
  const collectEastFar = (o: Object3D) => {
    if (o === east.group || o === grove.group || o === north) return;
    const m = o as Mesh;
    if (m.isMesh && !(m as InstancedMesh).isInstancedMesh && !Array.isArray(m.material) && !m.material.transparent && !villageTufts.includes(m) && !/tufts$/.test(m.name) && rangedTriangles(m.geometry) >= EAST_FAR_MIN_TRIANGLES) {
      const lod = attachFarLod(m, eastFarCell, { users: eastFarUsers });
      if (lod) {
        eastFarLods.push(lod);
        const b = eastFarBox.setFromObject(m);
        eastFarNearestM = Math.min(eastFarNearestM, Math.hypot(Math.max(EAST_FAR.x0 - b.max.x, 0, b.min.x - EAST_FAR.x1), Math.max(EAST_FAR.yMin - b.max.y, 0), Math.max(EAST_FAR.z0 - b.max.z, 0, b.min.z - EAST_FAR.z1)));
      }
    }
    for (const c of o.children) collectEastFar(c);
  };
  collectEastFar(group);
  let inEastFarNow = false;
  const scopeEastFar = (p: Vector3) => {
    const far = inEastFar(p);
    if (far === inEastFarNow) return;
    inEastFarNow = far;
    for (const l of eastFarLods) l.set(far);
  };
  scopeEastFar(ctx.camera.position);
  /**
   * The merged buckets' culling bounds (audit, round 20): what three.js frustum-tests each static
   * draw against — geometry bounding sphere at the identity transform — with its triangle count and
   * whether it belongs to the hero group or the detached village. A hero bucket whose sphere spans
   * the village again would show here as a radius ≥ 15 m.
   */
  const mergedBuckets = () => {
    const out: { name: string; group: 'hero' | 'distant' | 'north' | 'expansion' | 'south' | 'grove' | 'east'; centre: [number, number, number]; radius: number; triangles: number }[] = [];
    const visit = (root: Object3D, which: 'hero' | 'distant' | 'north' | 'expansion' | 'south' | 'grove' | 'east') => {
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (which === 'hero' && (!m.name.startsWith('merged:') || distant.group.getObjectById(m.id) || north.getObjectById(m.id) || expansion.group.getObjectById(m.id) || south.group.getObjectById(m.id) || grove.group.getObjectById(m.id) || east.group.getObjectById(m.id))) return;
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const s = g.boundingSphere!;
        out.push({
          name: m.name,
          group: which,
          centre: [+s.center.x.toFixed(2), +s.center.y.toFixed(2), +s.center.z.toFixed(2)],
          radius: +s.radius.toFixed(2),
          triangles: rangedTriangles(g),
        });
      });
    };
    visit(group, 'hero');
    visit(distant.group, 'distant');
    visit(north, 'north');
    visit(expansion.group, 'expansion');
    visit(south.group, 'south');
    visit(grove.group, 'grove');
    visit(east.group, 'east');
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
  /** meshes (= draw calls when all are in view) and the triangles their colour pass submits */
  const budget = () => {
    let meshes = 0;
    let triangles = 0;
    group.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      meshes++;
      triangles += rangedTriangles(m.geometry);
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
    /** round 56 (expansion-south): the rope bridge over the ravine and the hollow log in the far bank (expansionSouth.ts); drawn only within `visibleWithinM` of the south boxes, in the frustum */
    south: { ...south.audit, draws: southDraws.after, visibleWithinM: SOUTH_VISIBLE_M, visible: south.group.visible },
    /** 2026-09-24 (expansion-north): the grove hamlet — trunk house, stilt house, tree hut, gangway, rope walk, nest, yard (expansionNorth.ts); drawn only within `visibleWithinM` of the grove, in the frustum */
    grove: { ...grove.audit, draws: groveDraws.after, visibleWithinM: GROVE_VISIBLE_M, visible: grove.group.visible },
    /** round 56 (exp-east): the east plateau's lane — three houses, the deck, the shop's counter / sign / crates, pod posts, the lookout (east.ts) */
    east: east.audit(),
    /** exp-east: the village casters that switch to a shadow proxy beyond every fixed camera's distance (+2 m, ≥ 20 m) — triangles fine / coarse, cell, switch distance */
    villageShadowLod: {
      casters: villageShadowLod.length,
      saved: villageShadowLod.reduce((n, p) => n + p.fine - p.coarse, 0),
      list: villageShadowLod.map((p) => ({ name: p.name, fine: p.fine, coarse: p.coarse, cell: p.cell, farM: +p.farM.toFixed(1) })),
    },
    /** exp-east: the casters outside the east lane, which stop casting while the camera is on the east plateau (util/eastLane.ts EAST_ZONE) */
    eastZone: { zone: EAST_ZONE, casters: eastZoneCasters.length, inside: inEastZoneNow },
    /** exp-east: the parts that draw a coarser triangle list while the camera is on the plateau's far part (util/eastLane.ts EAST_FAR, farLod.ts) — triangles fine / coarse, the nearest part's distance from there (m) and the ten that save most */
    eastFarLod: {
      zone: EAST_FAR,
      k: EAST_FAR_LOD_K,
      meshes: eastFarLods.length,
      fine: eastFarLods.reduce((n, l) => n + l.fine, 0),
      coarse: eastFarLods.reduce((n, l) => n + l.coarse, 0),
      nearestM: +eastFarNearestM.toFixed(1),
      active: inEastFarNow,
      top: [...eastFarLods].sort((a, b) => b.fine - b.coarse - (a.fine - a.coarse)).slice(0, 10).map((l) => ({ name: l.name, fine: l.fine, coarse: l.coarse })),
    },
    /** exp-east: per village room (house.ts HOUSE_CLONES door plane), its meshes / triangles and whether they draw for the current camera */
    villageRooms: [...villageRooms.values()].map((r) => ({
      door: r.point.toArray().map((v) => +v.toFixed(2)),
      meshes: r.meshes.length,
      triangles: r.meshes.reduce((n, m) => n + rangedTriangles(m.geometry), 0),
      visible: r.meshes.some((m) => m.visible),
    })),
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
    /** exp-east: the houses' cap and trunk tuft buckets, drawn within `withinM` of either trunk */
    villageTufts: {
      withinM: VILLAGE_TUFTS_M,
      meshes: villageTufts.map((m) => m.name),
      triangles: villageTufts.reduce((n, m) => n + Math.floor((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3), 0),
      visible: villageTufts.some((m) => m.visible),
    },
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
      scopeVillageTufts(c.camera.position.x, c.camera.position.z);
      scopeVillageRooms(c.camera.position);
      scopeEastZone(c.camera.position);
      scopeEastFar(c.camera.position);
      north.visible = northVisible(c.camera.position.x, c.camera.position.z);
      expansion.near.visible = expansion.visible(c.camera);
      expansion.far.visible = expansion.farVisible(c.camera);
      south.group.visible = south.visible(c.camera);
      grove.group.visible = grove.visible(c.camera);
      east.update(c.camera);
    },
    onCameraMove(camera) {
      scopeVillageTufts(camera.position.x, camera.position.z);
      scopeVillageRooms(camera.position);
      scopeEastZone(camera.position);
      scopeEastFar(camera.position);
      north.visible = northVisible(camera.position.x, camera.position.z);
      expansion.near.visible = expansion.visible(camera);
      expansion.far.visible = expansion.farVisible(camera);
      south.group.visible = south.visible(camera);
      grove.group.visible = grove.visible(camera);
      east.update(camera);
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
