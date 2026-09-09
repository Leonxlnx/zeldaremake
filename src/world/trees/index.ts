/**
 * Trees — owner: trees agent.
 * Port + upgrade of the Verdant Forest white-bark trees (github.com/Leonxlnx/verdant-forest,
 * app/forest/trees.js — "Derived from Verdant Forest by Leonxlnx") plus the giant old Kokiri trees
 * whose canopies roof the clearing and a distant tree layer for the haze.
 *
 * Structure
 *   whitebark.ts  — seeded white-bark variants (3 LODs each: high / medium / low leaf subsets)
 *   giant.ts      — unique giants at LAYOUT.giantTrees, roots conformed to the terrain
 *   distant.ts    — 2-LOD distant trees for the 60–220 m band
 *   placement.ts  — seeded, layout-aware white-bark placement
 *   materials.ts  — one bark+leaf material per tree family with 3 wind layers + shadow-depth twins
 *   writer.ts     — geometry writer + botanical primitives
 *
 * Rendering: bark and leaves of a tree share one geometry (leaf vertices flagged in aRoot.w), so a
 * white-bark variant costs ONE InstancedMesh per LOD; `update()` re-buckets instances by camera
 * distance whenever the camera moves > 1.5 m. Giants are merged into three angular sector meshes
 * (aRoot.xyz = each tree's origin keeps per-tree wind/height context). Everything is seated via
 * ctx.terrain.height; randomness only via ctx.rng.
 */
import { BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferAttribute, type Camera } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { createTreeMaterials } from './materials';
import { createWhiteBarkTree, whiteBarkParams, type TreeAsset, type WhiteBarkParams } from './whitebark';
import { placeWhiteBark, type WhiteBarkPlacement } from './placement';
import { createGiantTree, type GiantAsset } from './giant';
import { createDistantVariants, placeDistantTrees, type DepthBand, type DistantPlacement, type DistantVariant } from './distant';
import { mergeParts, type Detail } from './writer';

const DETAILS: Detail[] = ['high', 'medium', 'low'];
const WHITE_VARIANTS = 10;
const GIANT_SECTORS = 3;
/**
 * Authored boughs (world end points; fromHeight is local to the tree base).
 * plateau-oak: two boughs reaching over Saria's dome (house at (12.5, 1.2, −11.5), roof top
 * ≈ 7.7 m) so the reference's "house framed by the giant's limbs" reads in shot B.
 * lantern-tree: a second low bough over the north plaza at ≈ 9 m — dark leaf clusters in the
 * upper-left of shots A/B (the reference's canopy there is near and dark) and canopy for the
 * shadow map to carve shafts from.
 */
const HOUSE_BOUGHS = [
  { giant: 'plateau-oak', to: [12.5, 9.0, -11.5] as [number, number, number], fromHeight: 6.6, radius: 0.62 },
  { giant: 'plateau-oak', to: [15.4, 10.4, -8.4] as [number, number, number], fromHeight: 8.1, radius: 0.48 },
  { giant: 'lantern-tree', to: [3.0, 8.6, -14.0] as [number, number, number], fromHeight: 6.8, radius: 0.6 },
];
/**
 * God-ray corridors: world air points over the north of the plaza (the upper-left of shots A/B)
 * that should sit inside bold shafts. The line through each along the sun direction is kept clear
 * of giant foliage, so the canopy shadow map carries 2–3 large holes among the fine dapple.
 */
const SHAFT_AIR_POINTS: [number, number, number][] = [
  [1.3, 6.6, -9.4],
  [-3.0, 8.0, -14.5],
  [5.0, 7.0, -17.0],
];
const SHAFT_RADIUS = 2.6;
/**
 * Giants whose LOW foliage the hero cameras see from a few metres: the lantern tree's limb lobes
 * hang 3–8 m from cameras A/B, the plateau oak's house boughs are ~20 m from B. Their low lobes
 * get leaf-sized laminae instead of cluster cards (see GiantOptions.eyeDetail).
 */
const EYE_DETAIL: Record<string, number> = { 'lantern-tree': 1, 'plateau-oak': 0.6 };
/**
 * Dense silhouette rows north of the log arch (shot D looks north from z ≈ −1): each fills a
 * narrow depth range so the depth histogram registers a distinct far layer behind the log
 * (crown faces ≈ 47–57 m and ≈ 80–95 m from the camera, with a clear gap after the log/giant
 * run that ends ≈ 37 m), read as dark masses under the haze.
 */
const DEPTH_BANDS: DepthBand[] = [
  { xMin: -34, xMax: 48, zMin: -61, zMax: -55, spacing: 5.0, scale: [1.25, 1.6], shade: 0.72 },
  { xMin: -58, xMax: 68, zMin: -98, zMax: -84, spacing: 7, scale: [1.2, 1.55], shade: 0.78 },
];
const _v = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

interface WhiteVariant {
  params: WhiteBarkParams;
  lods: TreeAsset[];
  meshes: InstancedMesh[];
  placements: WhiteBarkPlacement[];
  matrices: Matrix4[];
  counts: number[];
}

interface DistantSet {
  variant: DistantVariant;
  near: InstancedMesh;
  far: InstancedMesh;
  placements: DistantPlacement[];
  matrices: Matrix4[];
  counts: [number, number];
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'trees';
  const rng = ctx.rng.fork('trees');
  const palette = ctx.config.palette;
  const terrain = ctx.terrain;
  const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));
  // unit vector toward the sun (same convention as lighting/sun.ts: azimuth from +Z toward +X)
  const sunDir = (() => {
    const az = (ctx.config.sun.azimuthDeg * Math.PI) / 180;
    const el = (ctx.config.sun.elevationDeg * Math.PI) / 180;
    return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  })();
  const mats = await createTreeMaterials(ctx);
  ctx.progress('trees', 0.05);

  // ------------------------------------------------------------------ white-bark variants
  const whiteRng = rng.fork('whitebark');
  const whites: WhiteVariant[] = [];
  for (let i = 0; i < WHITE_VARIANTS; i++) {
    const params = whiteBarkParams(whiteRng, i, WHITE_VARIANTS);
    const lods = DETAILS.map((d) => createWhiteBarkTree(params, palette, d));
    whites.push({ params, lods, meshes: [], placements: [], matrices: [], counts: [0, 0, 0] });
    ctx.progress('trees', 0.05 + (0.45 * (i + 1)) / WHITE_VARIANTS);
    await yieldFrame();
  }

  const whiteTarget = Math.round(80 * Math.max(0.75, ctx.quality.density));
  const whitePlacements = placeWhiteBark(
    ctx,
    rng,
    whites.map((w) => ({ height: w.lods[0].height, radius: w.lods[0].radius, age: w.params.age })),
    whiteTarget,
  );
  for (const p of whitePlacements) {
    const w = whites[p.variant];
    w.placements.push(p);
    _q.setFromAxisAngle(_v.set(0, 1, 0), p.yaw);
    _s.setScalar(p.scale);
    _p.set(p.x, p.y, p.z);
    w.matrices.push(new Matrix4().compose(_p, _q, _s));
  }
  const whiteGroup = new Group();
  whiteGroup.name = 'white-bark';
  for (const w of whites) {
    const n = Math.max(1, w.placements.length);
    for (let l = 0; l < DETAILS.length; l++) {
      const mesh = new InstancedMesh(w.lods[l].geometry, mats.whiteTree, n);
      mesh.name = `whitebark-${w.params.seed}-${DETAILS[l]}`;
      mesh.customDepthMaterial = mats.whiteTreeDepth;
      // near and mid LODs cast shadows (dappled light on the paths); the far LOD only receives
      mesh.castShadow = l < 2 && ctx.quality.shadows;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.visible = false;
      mesh.userData.kind = 'whitebark';
      mesh.userData.lodLevel = l;
      w.meshes.push(mesh);
      whiteGroup.add(mesh);
    }
  }
  group.add(whiteGroup);
  ctx.progress('trees', 0.55);
  await yieldFrame();

  // ------------------------------------------------------------------ giants
  const giantGroup = new Group();
  giantGroup.name = 'giants';
  const giants: { def: (typeof ctx.layout.giantTrees)[number]; asset: GiantAsset; origin: Vector3; angle: number }[] = [];
  const contacts: [number, number, number][] = [];
  for (const def of ctx.layout.giantTrees) {
    const [px, , pz] = def.position;
    const gy = terrain.height(px, pz);
    const origin = new Vector3(px, gy, pz);
    let limbSpec: { from: Vector3; to: Vector3; radius?: number; tipRadius?: number } | undefined;
    if (def.limb && def.id === 'lantern-tree') {
      const lb = ctx.layout.lanternBranch as typeof ctx.layout.lanternBranch & { radius?: number; tipRadius?: number };
      limbSpec = {
        from: new Vector3(lb.from[0], lb.from[1], lb.from[2]).sub(origin),
        to: new Vector3(lb.to[0], lb.to[1], lb.to[2]).sub(origin),
        radius: lb.radius,
        tipRadius: lb.tipRadius,
      };
    } else if (def.limb) {
      const l = Math.hypot(def.limb.dir[0], def.limb.dir[1]);
      const dx = def.limb.dir[0] / l;
      const dz = def.limb.dir[1] / l;
      limbSpec = {
        from: new Vector3(dx * def.trunkRadius * 0.6, def.limb.height, dz * def.trunkRadius * 0.6),
        to: new Vector3(dx * def.limb.length, def.limb.height - def.limb.length * 0.12, dz * def.limb.length),
      };
    }
    // the giant nearest Saria's house sends two boughs over the dome (the reference frames the
    // house between the giant's limbs); targets are world points above the roof
    const boughs = HOUSE_BOUGHS.filter((b) => b.giant === def.id).map((b) => ({
      to: new Vector3(b.to[0], b.to[1], b.to[2]).sub(origin),
      fromHeight: b.fromHeight,
      radius: b.radius,
    }));
    // giants 35–45 m out are seen through the haze at 30+ m: fewer laminae, the cluster cards
    // carry their crowns
    const plazaDist = Math.hypot(px, pz);
    const farFade = 1 - 0.45 * Math.min(1, Math.max(0, (plazaDist - 26) / 16));
    const asset = createGiantTree(def, rng, {
      groundAt: (lx, lz) => terrain.height(px + lx, pz + lz) - gy,
      limbSpec,
      palette,
      leafDensity: Math.max(0.7, Math.min(1.15, ctx.quality.density)) * farFade,
      cardDensity: Math.max(0.7, Math.min(1.15, ctx.quality.density)) * (1 + (1 - farFade)),
      towardPlaza: new Vector3(-px, 0, -pz).normalize(),
      boughs,
      corridors: SHAFT_AIR_POINTS.map((q) => ({ point: new Vector3(q[0], q[1], q[2]).sub(origin), dir: sunDir, radius: SHAFT_RADIUS })),
      eyeDetail: EYE_DETAIL[def.id] ?? 0,
    });
    // to world space; aRoot.xyz carries the tree origin so the merged shader keeps per-tree context
    for (const g of [asset.geometry, asset.cards]) {
      g.translate(px, gy, pz);
      const root = g.getAttribute('aRoot') as BufferAttribute;
      for (let i = 0; i < root.count; i++) root.setXYZ(i, px, gy, pz);
    }
    giants.push({ def, asset, origin, angle: Math.atan2(pz, px) });
    for (const c of asset.contacts) contacts.push([px + c.x, gy + c.y, pz + c.z]);
    ctx.progress('trees', 0.55 + (0.3 * giants.length) / ctx.layout.giantTrees.length);
    await yieldFrame();
  }
  // three angular sectors around the plaza → three meshes, each frustum-culled as a unit
  const byAngle = [...giants].sort((a, b) => a.angle - b.angle);
  const sectorGeometries: BufferGeometry[] = [];
  const perSector = Math.ceil(byAngle.length / GIANT_SECTORS);
  for (let s = 0; s < GIANT_SECTORS; s++) {
    const members = byAngle.slice(s * perSector, (s + 1) * perSector);
    if (!members.length) continue;
    const label = members.map((m) => m.def.id).join('+');
    const geometry = mergeParts(
      `giants-sector-${s}`,
      members.map((m) => m.asset.geometry),
    );
    const cardGeometry = mergeParts(
      `giants-canopy-${s}`,
      members.map((m) => m.asset.cards),
    );
    sectorGeometries.push(geometry, cardGeometry);
    const mesh = new Mesh(geometry, mats.giantTree);
    mesh.name = `giants-sector-${s}-${label}`;
    mesh.customDepthMaterial = mats.giantTreeDepth;
    mesh.castShadow = ctx.quality.shadows;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'giant';
    mesh.userData.giants = members.map((m) => m.def.id);
    const canopy = new Mesh(cardGeometry, mats.giantCanopy);
    canopy.name = `giants-canopy-${s}-${label}`;
    canopy.customDepthMaterial = mats.giantCanopyDepth;
    canopy.castShadow = ctx.quality.shadows;
    canopy.receiveShadow = true;
    canopy.userData.kind = 'giant-canopy-cards';
    giantGroup.add(mesh, canopy);
  }
  group.add(giantGroup);

  // ------------------------------------------------------------------ distant trees
  const distantGroup = new Group();
  distantGroup.name = 'distant';
  const distantVariants = createDistantVariants(rng, palette);
  const distantTarget = Math.round(680 * Math.max(0.7, Math.min(1.2, ctx.quality.density)));
  const distantPlacements = placeDistantTrees(rng, terrain, distantVariants, distantTarget, 60, 215, DEPTH_BANDS);
  const distantSets: DistantSet[] = distantVariants.map((variant, i) => {
    const placements = distantPlacements.filter((p) => p.variant === i);
    const n = Math.max(1, placements.length);
    const make = (geometry: DistantVariant['near'], label: string, lodLevel: number) => {
      const mesh = new InstancedMesh(geometry, mats.distant, n);
      mesh.name = `distant-${i}-${label}`;
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.visible = false;
      mesh.userData.kind = 'distant-tree';
      mesh.userData.lodLevel = lodLevel;
      return mesh;
    };
    const near = make(variant.near, 'near', 0);
    const far = make(variant.far, 'far', 1);
    distantGroup.add(near, far);
    const matrices = placements.map((p) => {
      _q.setFromAxisAngle(_v.set(0, 1, 0), p.yaw);
      _s.setScalar(p.scale);
      _p.set(p.x, p.y, p.z);
      return new Matrix4().compose(_p, _q, _s);
    });
    return { variant, near, far, placements, matrices, counts: [0, 0] };
  });
  group.add(distantGroup);
  ctx.progress('trees', 0.95);

  // ------------------------------------------------------------------ LOD bucketing
  const lodDist = [20 * ctx.quality.distance, 44 * ctx.quality.distance];
  const distantNear = 120 * ctx.quality.distance;
  const camPos = new Vector3(Infinity, Infinity, Infinity);
  const white = new Color(1, 1, 1);

  const bucketWhite = (cam: Vector3) => {
    for (const w of whites) {
      const buckets: number[][] = [[], [], []];
      for (let i = 0; i < w.placements.length; i++) {
        const p = w.placements[i];
        const d = Math.hypot(p.x - cam.x, p.z - cam.z) - w.lods[0].radius * p.scale * 0.5;
        const l = d < lodDist[0] ? 0 : d < lodDist[1] ? 1 : 2;
        buckets[l].push(i);
      }
      for (let l = 0; l < 3; l++) {
        const mesh = w.meshes[l];
        const list = buckets[l];
        for (let k = 0; k < list.length; k++) mesh.setMatrixAt(k, w.matrices[list[k]]);
        mesh.count = list.length;
        mesh.visible = list.length > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (list.length) mesh.computeBoundingSphere();
        w.counts[l] = list.length;
      }
    }
  };

  const bucketDistant = (cam: Vector3) => {
    for (const set of distantSets) {
      const nearList: number[] = [];
      const farList: number[] = [];
      for (let i = 0; i < set.placements.length; i++) {
        const p = set.placements[i];
        (Math.hypot(p.x - cam.x, p.z - cam.z) < distantNear ? nearList : farList).push(i);
      }
      const fill = (mesh: InstancedMesh, list: number[]) => {
        for (let k = 0; k < list.length; k++) {
          mesh.setMatrixAt(k, set.matrices[list[k]]);
          mesh.setColorAt(k, set.placements[list[k]].tint ?? white);
        }
        mesh.count = list.length;
        mesh.visible = list.length > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (list.length) mesh.computeBoundingSphere();
      };
      fill(set.near, nearList);
      fill(set.far, farList);
      set.counts = [nearList.length, farList.length];
    }
  };

  const rebucket = (camera: Camera) => {
    camera.getWorldPosition(_v);
    if (_v.distanceTo(camPos) < 1.5) return;
    camPos.copy(_v);
    bucketWhite(camPos);
    bucketDistant(camPos);
  };
  rebucket(ctx.camera);

  // ------------------------------------------------------------------ audit
  const whiteBases: [number, number, number][] = whitePlacements.map((p) => [p.x, p.y, p.z]);
  const distantBases: [number, number, number][] = distantPlacements.map((p) => [p.x, p.y, p.z]);
  const allBases = [...whiteBases, ...contacts, ...distantBases];
  let maxBaseGap = 0;
  for (const [x, y, z] of allBases) maxBaseGap = Math.max(maxBaseGap, Math.abs(y - terrain.height(x, z)));
  const sampleBases = (() => {
    const pool = [...whiteBases, ...contacts];
    const stride = Math.max(1, Math.ceil(pool.length / 300));
    return pool.filter((_, i) => i % stride === 0).slice(0, 300);
  })();

  ctx.audit('trees', () => {
    let leafCount = 0;
    let woodTriangles = 0;
    let leafTriangles = 0;
    const lodInstances = [0, 0, 0];
    for (const w of whites) {
      for (let l = 0; l < 3; l++) {
        leafCount += w.counts[l] * w.lods[l].leafCount;
        woodTriangles += w.counts[l] * w.lods[l].woodTriangles;
        leafTriangles += w.counts[l] * w.lods[l].leafTriangles;
        lodInstances[l] += w.counts[l];
      }
    }
    let giantLeaves = 0;
    let giantCards = 0;
    let giantLimbsMin = Infinity;
    let giantRootsMin = Infinity;
    for (const g of giants) {
      giantLeaves += g.asset.leafCount;
      giantCards += g.asset.cardCount;
      woodTriangles += g.asset.woodTriangles;
      leafTriangles += g.asset.leafTriangles;
      giantLimbsMin = Math.min(giantLimbsMin, g.asset.limbs);
      giantRootsMin = Math.min(giantRootsMin, g.asset.roots);
    }
    let distantNearCount = 0;
    let distantFarCount = 0;
    let distantTriangles = 0;
    for (const s of distantSets) {
      distantNearCount += s.counts[0];
      distantFarCount += s.counts[1];
      distantTriangles += s.counts[0] * s.variant.nearTriangles + s.counts[1] * s.variant.farTriangles;
    }
    return {
      geometry: 'procedural-v1',
      giants: giants.length,
      giantRoots: giantRootsMin >= 5,
      giantRootsMin,
      giantLimbsMin,
      giantLeaves,
      /** leaf-cluster alpha cards inside the lobes (in addition to the laminae) */
      giantCanopyCards: giantCards,
      giantMeshes: sectorGeometries.length,
      giantCrownRadii: giants.map((g) => Math.round(g.asset.crownRadius * 10) / 10),
      whiteBarkVariants: whites.length,
      whiteBarkInstances: whitePlacements.length,
      whiteBarkAges: whites.map((w) => w.params.age),
      whiteBarkLodInstances: lodInstances,
      leafGeometry: 'laminae',
      leafCount: leafCount + giantLeaves,
      whiteBarkLeafCount: leafCount,
      distantTrees: distantPlacements.length,
      distantLod: [distantNearCount, distantFarCount],
      lodLevels: 3,
      windLayers: mats.windLayers,
      barkTextures: mats.barkTextureSets,
      maxBaseGap: Math.round(maxBaseGap * 1e4) / 1e4,
      basesChecked: allBases.length,
      triangles: { wood: woodTriangles, leaves: leafTriangles, canopyCards: giantCards * 2, distant: distantTriangles },
      samplePositions: { bases: sampleBases },
    };
  });
  ctx.progress('trees', 1);

  return {
    name: 'trees',
    group,
    update(_dt, _t, c) {
      rebucket(c.camera);
    },
    onCameraMove(camera) {
      rebucket(camera);
    },
    dispose() {
      for (const w of whites) for (const l of w.lods) l.geometry.dispose();
      for (const g of sectorGeometries) g.dispose();
      for (const s of distantSets) (s.variant.near.dispose(), s.variant.far.dispose());
    },
  };
}
