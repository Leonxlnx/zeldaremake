/**
 * Rocks & geology — owner: terrain agent.
 * Hero mossy boulders (LAYOUT.heroBoulders) with fractured/faceted silhouettes and rubble skirts,
 * half-buried angular strata on the steep embankment faces, and thousands of instanced pebbles
 * along path edges, stair feet and boulder bases. Everything is seated on the heightfield.
 * Each hero boulder also carries a near LOD (NEAR_ROCK_IN_M below) for the live camera at
 * player height: the same rock rebuilt denser with a fractured skin, moss pads, lichen plates
 * and loose fragments, and a material variant whose 2.6 m texture tile, wet band and crack grime
 * fade in under 6 m (material.ts). The six fixed hero cameras always render the far meshes.
 */
import { Color, Frustum, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Quaternion, Sphere, Vector3, type BufferGeometry, type Camera } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { northBox, northVisible } from '../util/northLocality';
import { buildRock, type RockOptions } from './rockgen';
import { createRockMaterial, NEAR_FADE_M, NEAR_TILE_M } from './material';
import { dressRock, mergeRockParts } from './dressing';
import { buildRockLedge, type RockLedgeDef } from './ledge';
import { buildClearingRocks, type ClearingLayout } from './clearing';
import { buildBacksideRocks } from './backside';
import { expansionVisible, sunVector } from '../util/expansionLocality';
import { PEBBLE_DEFAULTS, PEBBLE_LOOKS, scatterPathPebbles, stairFootPebbles } from './pebbles';
import { NORTH_Z1 } from '../util/northLocality';
import { expansionCull } from '../terrain/heightfield';
import { CUSHION, FERN, TUFT_A, TUFT_B, buildSproutMeshes, createSproutMaterial, type SproutSpot } from '../materials/sprouts';
import type { Rng } from '../util/prng';

/**
 * Rock ledge faces (ledge.ts; owner review 2026-09-19 ref-04). WHERE they stand is the layout's:
 * `layout.rockLedges` (optional — fable-cursor's expansion-1 lane authors it with the raised
 * right bank). Until it exists the face can be previewed with `?rockLedgePreview=1`, which
 * builds `LEDGE_PREVIEW` — the ref-04 spot on the north path's east bank (the existing terrain
 * step from the ~1 m verge at x ≈ 6.4 up to the 5.4 m plateau at x ≈ 8.6, z −15…−27). The
 * preview is off in every capture and take.
 */
export const LEDGE_PREVIEW: RockLedgeDef[] = [
  { id: 'north-right-bank', foot: [[6.2, -14.5], [6.35, -18], [6.5, -22], [6.4, -25.5], [6.0, -28]], inset: 2.4, lean: 0.4 },
];
/** the ledge material's near fade (m): its damp/moss terms stay legible from the path */
export const LEDGE_FADE_M: [number, number] = [7, 14];
/** the ledge material's damp band: the hero boulders' sheen raised to this power (ref-04's near-black foot) */
export const LEDGE_DAMP = 1.6;
/** the ledge wall's near grain (material `relief`): fable-5 §7.2, micro σ 0.034 → 0.05 at 3 m — measured at `x-ledge-wall` (4 px residual on the cap): 0.031 → 0.035 at 1.0, 0.043 at 3.0 */
export const LEDGE_RELIEF = 3.0;

/**
 * Near-LOD swap radii (m, 3D to the boulder's centre) for the hero boulders (round 42): within
 * NEAR_ROCK_IN_M of the live camera a boulder's far mesh is replaced by its near version —
 * the same rock (same stream, same low-frequency shape, cuts and bedding) at 2.2× the vertex
 * density with a fractured skin, deeper crack furrows, a fine crack network, chipped cleave rims,
 * deeper strata ledges (the D boulder), moss cushions and lichen plates on its faces, loose
 * fragments at its foot and ferns / moss pads rooted in its crevices (rockgen.ts / dressing.ts) —
 * and out again past NEAR_ROCK_OUT_M (hysteresis). A boulder a
 * hero camera frames from d m swaps only at d − NEAR_ROCK_HERO_MARGIN (out at d − margin / 3),
 * so the six fixed captures always render today's far meshes; a rock whose in-radius would fall
 * under NEAR_ROCK_MIN_IN_M gets no near version.
 */
export const NEAR_ROCK_IN_M = 12;
export const NEAR_ROCK_OUT_M = 14;
export const NEAR_ROCK_HERO_MARGIN = 1.5;
export const NEAR_ROCK_MIN_IN_M = 2.5;
/** the boulder cap / crevice plants: tufts, ferns and moss pads, all variants in one draw */
const ROCK_PLANT_PACKS: number[][] = [[TUFT_A, TUFT_B, FERN, CUSHION]];

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _cam = new Vector3();

interface NearRock {
  id: string;
  centre: Vector3;
  far: Mesh;
  near: Mesh;
  inM: number;
  outM: number;
  /** distance (m) of the nearest hero camera that frames the rock, Infinity when none does */
  hero: number;
  active: boolean;
  dist: number;
  triangles: number;
  cushions: number;
  creviceCushions: number;
  lichen: number;
  /** share of the near skin's vertices under lichen crust (`aLichen` > 0.5) */
  lichenShare: number;
  fragments: number;
  /** near-only small shards half-buried around the rim (fable-2) */
  shards: number;
  /** crevice plants rooted in this rock's near skin (ferns, moss pads) */
  creviceFerns: number;
  crevicePads: number;
  /**
   * round 45 (details-1): the rock's skirt and spill stones — indices into the shared `rubble`
   * list; their far instances are collapsed (zero-scale matrices) while the near kit, which
   * carries each stone rebuilt at its own radius with the near relief, is in
   */
  skirt: number[];
  /** near skirt stones folded into the kit */
  skirtStones: number;
  /** fable-2: embankment strata slabs within reach — indices into `strata`; collapsed like the skirt while the kit is in */
  strataSkirt: number[];
  /** smaller companion shards the kit adds beside the adopted slabs */
  strataCompanions: number;
}

interface Instance {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  tiltTo?: Vector3;
  variant: number;
}

/** where an `Instance` landed: its InstancedMesh and slot, and the matrix it was given */
interface InstanceSlot {
  mesh: InstancedMesh;
  index: number;
  matrix: Matrix4;
}

/** the instance's world matrix (tilt to the ground normal, then yaw, uniform scale) */
function instanceMatrix(it: Instance, out: Matrix4): Matrix4 {
  _p.set(it.x, it.y, it.z);
  if (it.tiltTo) _q.setFromUnitVectors(_up, it.tiltTo);
  else _q.identity();
  _q.multiply(new Quaternion().setFromAxisAngle(_up, it.yaw));
  _s.setScalar(it.scale);
  return out.compose(_p, _q, _s);
}

function buildInstanced(list: Instance[], geos: BufferGeometry[], material: InstancedMesh['material'], name: string, castShadow: boolean, slots?: InstanceSlot[]): InstancedMesh[] {
  const per: { it: Instance; k: number }[][] = geos.map(() => []);
  list.forEach((it, k) => per[it.variant % geos.length].push({ it, k }));
  const out: InstancedMesh[] = [];
  per.forEach((items, v) => {
    if (!items.length) return;
    const im = new InstancedMesh(geos[v], material, items.length);
    items.forEach(({ it, k }, i) => {
      im.setMatrixAt(i, instanceMatrix(it, _m));
      if (slots) slots[k] = { mesh: im, index: i, matrix: _m.clone() };
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = true;
    im.name = `${name}-v${v}`;
    im.computeBoundingSphere();
    out.push(im);
  });
  return out;
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'rocks';
  const T = ctx.terrain;
  const rng = ctx.rng.fork('rocks');
  const seed = ctx.config.seed;
  const P = ctx.config.palette;
  const anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
  const material = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4);
  // the hero boulders' own material: the same look with the near-detail terms (material.ts
  // NEAR_TILE_M) that fade in under NEAR_FADE_M — the rubble, strata and pebbles keep the plain
  // one, so the stones in a hero camera's foreground never change
  const heroMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4, 1, { near: true });
  // the stair-foot boulder at the right edge of shot A (the mossy rock the Kokiri kid stands
  // beside): the reference reads it at lum ≈ 0.26 (box (0.82,0.60)-(0.98,0.70)) where the shared
  // rock material rendered 0.29 at exposure 1.0 — darker rock and moss for it alone, without
  // moving it
  const stairFootMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4, 0.9, { near: true });
  const pebbleMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 0.35);
  const density = clamp(ctx.quality.density, 0.4, 1.4);
  const detailR = ctx.config.detailRadius;
  const nearLod = ctx.quality.tier !== 'low';
  // the hero cameras' frusta (a little wider than the captures), for the near-LOD swap radii
  const heroFrusta = ctx.layout.viewpoints.map((v) => {
    const cam = new PerspectiveCamera(v.fov + 4, 1.85, 0.1, 400);
    cam.position.set(v.position[0], v.position[1], v.position[2]);
    cam.lookAt(v.target[0], v.target[1], v.target[2]);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    return { position: cam.position.clone(), frustum: new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)) };
  });
  const heroSphere = new Sphere();
  /** distance of the nearest hero camera that frames the sphere (centre, radius + 1 m), or Infinity */
  const heroDistance = (centre: Vector3, radius: number) => {
    heroSphere.center.copy(centre);
    heroSphere.radius = radius + 1;
    let nearest = Infinity;
    for (const h of heroFrusta) {
      const d = h.position.distanceTo(centre);
      if (d < nearest && h.frustum.intersectsSphere(heroSphere)) nearest = d;
    }
    return nearest;
  };
  const nearRocks: NearRock[] = [];
  const nearDropped: string[] = [];
  const mossPalette = { mossDeep: new Color(ctx.config.palette.mossDeep), mossBright: new Color(ctx.config.palette.mossBright) };

  const notPaved = (x: number, z: number) => {
    const m = T.mask(x, z);
    return m.path < 0.02 && m.stairs < 0.5 && m.structure < 0.5;
  };

  // --- embankment strata on steep faces ----------------------------------------------------
  // (fable-2: built before the hero boulders so a near kit can adopt the slabs standing against
  // its rock — own fork `strata`, so the scatter is what it was)
  const strata: Instance[] = [];
  {
    const sRng = rng.fork('strata');
    const sNoise = new Noise2D(`${seed}/strata-density`);
    const step = 0.9;
    for (let z = -detailR; z <= detailR; z += step) {
      for (let x = -detailR; x <= detailR; x += step) {
        if (x * x + z * z > detailR * detailR) continue;
        const px = x + sRng.range(-0.4, 0.4);
        const pz = z + sRng.range(-0.4, 0.4);
        const m = T.mask(px, pz);
        if (m.path > 0.02 || m.stairs > 0.5 || m.structure > 0.5) continue;
        const slope = T.slope(px, pz);
        const want = smoothstep(0.17, 0.42, slope) * (0.45 + 0.55 * (sNoise.fbm(px * 0.35, pz * 0.35, 2) * 0.5 + 0.5)) + m.cliff * 0.6;
        if (sRng() > want * 0.75 * density) continue;
        const sc = sRng.range(0.22, 0.62) * (0.7 + 0.6 * slope);
        T.normal(px, pz, _n);
        strata.push({ x: px, y: T.height(px, pz) - sc * 0.32, z: pz, scale: sc, yaw: sRng.range(0, Math.PI * 2), tiltTo: _n.clone().lerp(_up, 0.25).normalize(), variant: sRng.int(0, 4) });
      }
    }
  }

  // round-49 handoff (expansion-2 / fable-cursor 16:15 UTC): this system builds against the LEGACY
  // terrain view; the west / south bank and the far hut's knoll exist only in the live one, so a
  // sampled stone can sit inside (or float over) them. `expansionCull` AFTER placement — every
  // stream keeps its candidate count and its draws, only the instances change: the pebble lists are
  // filtered; rubble and strata are referenced by index from the near kits, so theirs collapse to a
  // zero scale in place (a zero-scale instance rasterises nothing and casts nothing). The strata go
  // first, before the hero loop adopts slabs; the rubble after it (no hero boulder stands within the
  // expansion's box, so no kit rebuilds a culled skirt stone — guarded in the loops all the same).
  const culled = { pebbles: 0, rubble: 0, strata: 0 };
  for (const it of strata) if (it.scale > 0 && expansionCull(it.x, it.z)) (it.scale = 0), culled.strata++;

  // --- hero boulders -----------------------------------------------------------------------
  const contact: [number, number, number][] = [];
  const boulderInfo: { id: string; radius: number; triangles: number; sink: number; contacts: number; baseGap: number; crackShare: number; mossShare: number; facetShare: number; topAboveGround: number }[] = [];
  const rubble: Instance[] = [];
  const pebbles: Instance[] = [];
  const boulderPlants: SproutSpot[] = [];
  const crevicePlants: SproutSpot[] = [];
  let basePlants = 0;
  let spillStones = 0;
  const bRng = rng.fork('boulders');
  // the shaded side of every rock: horizontal direction away from the sun (config.sun, azimuth
  // from +Z toward +X) — the moss blanket in the frames hangs on the faces the sun never reaches
  const sunAz = (ctx.config.sun.azimuthDeg * Math.PI) / 180;
  const shadeDir: [number, number] = [-Math.sin(sunAz), -Math.cos(sunAz)];
  const pathPtsAll = [...ctx.layout.pathSpine, ...ctx.layout.pathToStairs, ...ctx.layout.pathToHouse];
  /** unit xz direction from (x, z) to the nearest path spine point */
  const towardPath = (x: number, z: number): [number, number] => {
    let best = pathPtsAll[0];
    let bd = Infinity;
    for (const p of pathPtsAll) {
      const d = Math.hypot(p[0] - x, p[2] - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const l = Math.max(1e-6, bd);
    return [(best[0] - x) / l, (best[2] - z) / l];
  };
  /** unit xz direction from the D boulder to the hero frame D's camera (the face that frame reads) */
  const towardD = (() => {
    const d = ctx.layout.viewpoints.find((v) => v.id === 'D_log');
    const b = ctx.layout.heroBoulders.find((h) => h.id === 'shot-d-boulder');
    if (!d || !b) return null;
    const dx = d.position[0] - b.position[0];
    const dz = d.position[2] - b.position[2];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l] as [number, number];
  })();
  /** a world xz direction expressed in the local frame of a mesh yawed by `yaw` about +Y */
  const toLocal = (d: [number, number], yaw: number): [number, number] => [d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw)];
  for (const b of ctx.layout.heroBoulders) {
    const r = b.radius;
    const collar = new Color(0.13, 0.135, 0.09);
    // round 45 (details-1): this rock's spill and skirt stones are rubble[ownStart …] — the near
    // kit rebuilds them (below, after the skirt loop) and hides their far instances while it is in
    const ownStart = rubble.length;
    // the mesh yaw is drawn first (same bRng draw as before — the geometry stream is a fork) so
    // the sun-shade and path directions can be baked into the geometry in its local frame
    const yaw = bRng.range(0, Math.PI * 2);
    // frame 56 s reads the D boulder as a low loaf ≈ 1.3 m wide standing 0.6 m proud of the plants
    // (0.09 of the frame height at 7 m) where a 0.74 squash stood 1.13 m: squashed lower and sunk
    // deeper (0.94 m proud) — but still a dome, since the low camera only sees its lit top as a
    // curve; the A/terrace rocks keep the rounded 0.74 profile
    // (round 24: 0.64 / 0.18 still stood 0.88 m proud = 0.159 of frame D against the frame's 0.09;
    // the loaf went lower as a stopgap: squash 0.42, sink 0.22 -> ~0.55 m proud at r 0.9.
    // Layout round 6: the layout radius is 0.6 (the vegetation's exclusions read the boulder's
    // layout `clearRadius`, still 0.9, so its scatter streams do not move) and the loaf is a
    // rounded 0.64 dome again on the shared 0.15 seat: ≈ 1.2 m wide, ≈ 0.5 m proud)
    // fable-2 (W23 at frame D, round 49; fable-5's review 09:35 UTC "yes from the reviewer's side"):
    // the loaf stands 0.2 m prouder — squash 0.72 and no sink — so its moss top clears the fern bank
    // in front of it the way the frame's boulder top sits at y 0.55 with its fern hat ON the rock;
    // at 0.64 / 0.15 the 0.5 m loaf was > 99 % hidden behind the fronds (fable-5's D box read fern
    // green). A D composition change, made on its own branch for fable-cursor's call; the layout
    // radius (0.6) and the vegetation's clearRadius are untouched.
    const squash = b.id === 'shot-d-boulder' ? 0.72 : 0.74;
    const sinkFrac = b.id === 'shot-d-boulder' ? 0 : 0.15;
    const rockOpts: RockOptions = {
      radius: r,
      // 20·(detail+1)² triangles: ≈ 16.8k for the 2.2 m terrace boulder, ≈ 14.6k for the small
      // ones (detail 26: the crack furrows are 5 cm wide and need ~4 cm edges to read as lines)
      detail: r > 1.5 ? 28 : 26,
      // rounded, weathered boulders (reference A/C/D): low ridging, soft lumps, and only shallow
      // sideways cleaves so the crown stays a dome under its moss cap instead of a faceted wedge
      ridge: 0.12,
      lump: 0.3,
      // round 4 (frames 1 s / 8 s / 56 s): the crown is a lumpy, soft mass — big swells on the
      // upper hemisphere (+0.45·crown mean, ±0.9·crown in lumps) under a thick lumpy cushion
      crown: 0.2,
      // the big terrace rock: two shallow cleaves only (four deep ones read as a stack of cut
      // slabs with a flat front) — it is a rounded mossy mass in frame 14 s
      cuts: 2,
      cutUp: [-0.35, 0.3],
      // D keeps a deep fracture face; the A rock's cleaves are shallow chips (frame 1 s: rounded)
      cutDepth: r > 1.5 ? [0.9, 1.02] : b.id === 'shot-d-boulder' ? [0.68, 0.84] : [0.82, 0.94],
      // the D boulder's fresh fracture face stands toward the path (frame 56 s: a dark cleaved
      // face on the path side under a bright moss top)
      cutToward: b.id === 'shot-d-boulder' ? toLocal(towardPath(b.position[0], b.position[2]), yaw) : undefined,
      // fable-2 (W23 at frame D, fable-5's round-49 #7 "the 7 m value"): the cleave toward the path is
      // the face camera D sees, and at 0.4 it was the dark half of a rock the reference shows as
      // one pale olive-tan loaf — a quarter now (the near skin keeps its own 0.12)
      cutDark: b.id === 'shot-d-boulder' ? 0.25 : 0.3,
      facetBare: b.id === 'shot-d-boulder' ? 0.9 : 0.5,
      squashY: squash,
      creaseDeg: 24,
      // a few dark cracks, not a crazed surface: the reference boulders (C stair-foot loaf, A
      // terrace boulder) are smooth mid-grey with two or three dark partings — cut as furrows
      // 2.5 % of the radius deep so they read as dark lines under any light
      cracks: 0.55,
      crackDepth: 0.025,
      // frame 56 s: the D rock is half bare stone (moss 35 % of its box, bare 54 %); at 1.0 the
      // cushion took 51 % of ours
      moss: b.id === 'shot-d-boulder' ? 0.85 : 1.0,
      // faint bedding (dark partings, only a hint of a ledge) under a thick moss cap, sitting in
      // a dark collar of soil — the reference boulders are rounded first, layered second.
      // Sheet 01 'Mossy root' / sheet 04: the caps are thick pads over grey — not warm-brown —
      // rock faces; round 4 thickens the cushion (8.5 → 13 % of the radius, ±50 % lumpy) and
      // hangs a moss blanket down the shaded side (frames 1 s / 8 s: the A rock's face toward the
      // camera is moss from shoulder to collar)
      // bedding (ledges + dark partings) on D only (frame 56 s: layered); on the A rock the
      // partings drew dark rings round the whole boulder (frame 1 s: smooth) and the moss
      // blanket over the ledges read as stacked pancakes
      strata: b.id === 'shot-d-boulder' ? 0.06 : 0,
      // 12 cm cushion whatever the radius (13 % of a 1 m rock; the 2.2 m rock would otherwise
      // wear a 30 cm pad and crumple at its edge)
      mossThickness: Math.min(0.13, 0.12 / r),
      mossLumpy: 1.0,
      // D's frame face is bare lit stone under the moss top with the fracture in shade, so its
      // blanket is thinner; the A rock's face toward frame 1 s is moss from shoulder to collar
      mossSide: b.id === 'shot-d-boulder' ? 0.45 : 0.9,
      mossShade: toLocal(shadeDir, yaw),
      // fable-2 (W23 at frame D, fable-5's 13:25 review of the loaf: "value inverted — moss + shade on
      // the face D sees, l 0.21 / hue 63° / sat 0.15 against the reference's bare lit face l 0.27 /
      // 52° / 0.36"): the face toward the hero frame's camera stays bare stone (the cap keeps its
      // moss — the frame's greenery is on the crown) and is paled up to 30 % toward the lit read
      bareToward: b.id === 'shot-d-boulder' && towardD ? toLocal(towardD, yaw) : undefined,
      faceLift: b.id === 'shot-d-boulder' && towardD ? { dir: toLocal(towardD, yaw), amount: 0.3 } : undefined,
      // the lower band is a dark, damp green-brown (not bare soil), reaching ~0.35 m up the
      // visible face of the small boulders
      // (W23: the D rock's collar reaches 45 % of its height, not 60 — frame D reads pale stone
      // down to the grass, the dark only in the ground contact)
      dirt: b.id === 'shot-d-boulder' ? 0.7 : 0.8,
      collar,
      collarBand: b.id === 'shot-d-boulder' ? [0.1, 0.45] : [0.12, 0.6],
      // frame 56 s reads the D rock's sunlit face at lum 0.42 (flagstone-bright grey-tan) where a
      // 0.55 tint rendered 0.24: mid-grey stone, the collar and the fracture faces carry the dark.
      // The D rock's bare stone is warm and pale in the frame (hue 46, sat 0.34) where the A/terrace
      // rocks are cool grey under their moss, so it gets a tan tint of its own
      // (W23: frame D's boulder is olive-tan — rgb 91/83/45 at l 0.32, hue 47°, sat 0.34 — where
      // ours rendered grey-tan at 0.30 behind the ferns; the tint goes a step paler and yellower)
      tint: b.id === 'shot-d-boulder' ? new Color(0.9, 0.85, 0.64) : new Color(0.72, 0.72, 0.71),
      freq: 0.9,
    };
    const geo = buildRock(bRng.fork(b.id), `${seed}/boulder-${b.id}`, rockOpts);
    // seat: base sinks ~15 % of the rock height into the ground under the footprint
    let gSum = 0;
    let gn = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      gSum += T.height(b.position[0] + Math.cos(a) * r * 0.55, b.position[2] + Math.sin(a) * r * 0.55);
      gn++;
    }
    const ground = gSum / gn;
    const height = 2 * r * squash;
    const sink = sinkFrac * height;
    const cy = ground + r * squash * 0.62 - sink; // flat-ish bottom is at -0.62·r·squash
    const mesh = new Mesh(geo, b.id === 'stair-foot' ? stairFootMaterial : heroMaterial);
    mesh.position.set(b.position[0], cy, b.position[2]);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `boulder-${b.id}`;
    mesh.updateMatrixWorld(true);
    group.add(mesh);

    // contact points: where mesh edges cross the terrain surface
    const pos = geo.attributes.position;
    const va = new Vector3();
    const vb = new Vector3();
    const pts: [number, number, number][] = [];
    for (let i = 0; i < pos.count && pts.length < 400; i += 3) {
      for (let e = 0; e < 3; e++) {
        va.fromBufferAttribute(pos, i + e).applyMatrix4(mesh.matrixWorld);
        vb.fromBufferAttribute(pos, i + ((e + 1) % 3)).applyMatrix4(mesh.matrixWorld);
        const ga = va.y - T.height(va.x, va.z);
        const gb = vb.y - T.height(vb.x, vb.z);
        if (ga * gb < 0) {
          const t = ga / (ga - gb);
          const x = va.x + (vb.x - va.x) * t;
          const y = va.y + (vb.y - va.y) * t;
          const z = va.z + (vb.z - va.z) * t;
          if (Math.abs(y - T.height(x, z)) <= 0.03) pts.push([x, y, z]);
        }
      }
    }
    // keep a spread-out subset
    const keep: [number, number, number][] = [];
    for (const p of pts) {
      if (keep.every((k) => Math.hypot(k[0] - p[0], k[2] - p[2]) > r * 0.35)) keep.push(p);
      if (keep.length >= 12) break;
    }
    contact.push(...keep);
    // base gap: per azimuth bin, does the rock's outer body (outside the buried centre column)
    // enter the ground? The bin's gap is the smallest height of its vertices above the terrain
    // under them, clamped at 0 — positive only where no vertex reaches the ground, i.e. the
    // silhouette floats on the downhill side of a bank. 0 all round = the rock sits IN the ground.
    let baseGap = 0;
    let top = -Infinity;
    {
      const GB = 24;
      const wide = new Float32Array(GB);
      const wpos: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        va.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        top = Math.max(top, va.y);
        const dx = va.x - b.position[0];
        const dz = va.z - b.position[2];
        const hr = Math.hypot(dx, dz);
        const bin = ((Math.round((Math.atan2(dz, dx) / (Math.PI * 2)) * GB) % GB) + GB) % GB;
        wide[bin] = Math.max(wide[bin], hr);
        wpos.push(va.x, va.y, va.z, hr, bin);
      }
      const low = new Float32Array(GB).fill(Infinity);
      for (let i = 0; i < wpos.length; i += 5) {
        const bin = wpos[i + 4];
        if (wpos[i + 3] < 0.35 * wide[bin]) continue;
        low[bin] = Math.min(low[bin], wpos[i + 1] - T.height(wpos[i], wpos[i + 2]));
      }
      for (let k = 0; k < GB; k++) if (Number.isFinite(low[k])) baseGap = Math.max(baseGap, low[k]);
    }
    const st = (geo.userData.rockStats ?? { crackShare: 0, mossShare: 0, facetShare: 0 }) as { crackShare: number; mossShare: number; facetShare: number };
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    boulderInfo.push({ id: b.id, radius: r, triangles: pos.count / 3, sink: r3(sink), contacts: keep.length, baseGap: r3(baseGap), crackShare: r3(st.crackShare), mossShare: r3(st.mossShare), facetShare: r3(st.facetShare), topAboveGround: r3(top - ground) });

    // small plants in the cap (sheet 01 'Roots' / 'Mossy root', sheet 04): grass tufts and a
    // fern or two rooted where a dark parting crosses the mossy upper faces — one candidate per
    // upward, mossy triangle, cracks first, spaced ≥ 0.28 r apart
    {
      const nrmA = geo.attributes.normal;
      const colA = geo.attributes.color;
      const mossA = geo.attributes.aMoss;
      const cand: { i: number; crack: boolean }[] = [];
      for (let i = 0; i < pos.count; i += 3) {
        _n.fromBufferAttribute(nrmA, i);
        if (_n.y < 0.55) continue;
        if (mossA.getX(i) < 0.35) continue;
        // world height: only the crown and shoulders, never the buried collar
        va.fromBufferAttribute(pos, i);
        if (va.y < -0.1 * r) continue;
        cand.push({ i, crack: colA.getX(i) + colA.getY(i) + colA.getZ(i) < 1.1 });
      }
      cand.sort((p, q) => Number(q.crack) - Number(p.crack) || p.i - q.i);
      const want = r > 1.5 ? 14 : 8;
      const placed: Vector3[] = [];
      // own stream: the rubble skirt and pebbles drawn from bRng below must not move
      const pRng = bRng.fork(`plants-${b.id}`);
      for (const cd of cand) {
        if (placed.length >= want) break;
        if (!pRng.chance(cd.crack ? 0.45 : 0.12)) continue;
        va.fromBufferAttribute(pos, cd.i).applyMatrix4(mesh.matrixWorld);
        if (placed.some((p) => p.distanceTo(va) < 0.28 * r)) continue;
        placed.push(va.clone());
        const fern = pRng.chance(0.3);
        boulderPlants.push({ x: va.x, y: va.y - 0.006, z: va.z, size: fern ? 0.5 : pRng.range(0.45, 0.95), kind: fern ? 'fern' : 'tuft', scale: fern ? pRng.range(0.9, 1.3) : pRng.range(1.2, 1.7) });
      }
    }

    // crevice plants (round 42; sheet 05 'Roots', frame-05: moss and small ferns rooted IN the
    // rock's partings): candidates are the crack / parting vertices on the shoulders and sides —
    // not the mossy cap the cap plants use — a fern or two arching out of the deeper clefts and a
    // few moss pads filling the shallower ones. A crack vertex is one whose colour the crack pass
    // (rockgen.ts) pulled ≥ 30 % of the way from the rock's tint toward the crack dark (main lines
    // at ≥ ~0.7 strength, the fine hairlines near full, every bedding parting). Own stream; the
    // spots are appended after every boulder's cap and base plants (below), so those keep their
    // jitter draws. Run on the near mesh when there is one (its furrows are the crevices the
    // player sees; the far skin sits up to ~3 cm off it), else on the far mesh.
    const tintC = rockOpts.tint ?? new Color(0.72, 0.72, 0.7);
    const tintSum = tintC.r + tintC.g + tintC.b;
    const pickCrevicePlants = (src: BufferGeometry) => {
      const posA = src.attributes.position;
      const nrmA = src.attributes.normal;
      const colA = src.attributes.color;
      const mossA = src.attributes.aMoss;
      const cRng = bRng.fork(`crevice-${b.id}`);
      const cand: { i: number; ny: number; dark: number }[] = [];
      for (let i = 0; i < posA.count; i += 3) {
        _n.fromBufferAttribute(nrmA, i);
        if (_n.y < 0.12 || _n.y > 0.8) continue;
        if (mossA.getX(i) > 0.45) continue;
        va.fromBufferAttribute(posA, i);
        if (va.y < -0.05 * r) continue;
        const dark = 1 - (colA.getX(i) + colA.getY(i) + colA.getZ(i)) / tintSum;
        if (dark < 0.3) continue;
        cand.push({ i, ny: _n.y, dark });
      }
      // shuffle deterministically (the darkest clefts a little favoured), then take ferns from the
      // steeper clefts and pads from the flatter
      const order = cand.map((c) => ({ c, k: cRng() - 0.4 * c.dark })).sort((p, q) => p.k - q.k || p.c.i - q.c.i).map((o) => o.c);
      const wantFerns = r > 1.5 ? 3 : 2;
      const wantPads = r > 1.5 ? 5 : 3;
      const placed: Vector3[] = [];
      let ferns = 0;
      let pads = 0;
      for (const cd of order) {
        if (ferns >= wantFerns && pads >= wantPads) break;
        va.fromBufferAttribute(posA, cd.i).applyMatrix4(mesh.matrixWorld);
        if (placed.some((p) => p.distanceTo(va) < 0.2 * r)) continue;
        const fern = ferns < wantFerns && (cd.ny < 0.55 || pads >= wantPads);
        if (!fern && cd.ny < 0.4) continue;
        placed.push(va.clone());
        // seated a little below the surface along the local normal, so the root sits in the furrow
        _n.fromBufferAttribute(nrmA, cd.i).transformDirection(mesh.matrixWorld);
        if (fern) {
          va.addScaledVector(_n, -0.012);
          crevicePlants.push({ x: va.x, y: va.y, z: va.z, size: 0.5, kind: 'fern', scale: cRng.range(0.8, 1.15) });
          ferns++;
        } else {
          va.addScaledVector(_n, -0.004);
          crevicePlants.push({ x: va.x, y: va.y, z: va.z, size: cRng.range(0.3, 0.8), kind: 'cushion', scale: cRng.range(0.9, 1.3) });
          pads++;
        }
      }
      return { ferns, pads, candidates: cand.length };
    };
    if (!nearLod) pickCrevicePlants(geo);

    // the rock's rim at ground level, per azimuth bin (world frame): where the ground plants and
    // the spill stones start
    const BINS = 24;
    const rim = new Float32Array(BINS).fill(r * 0.6);
    for (let i = 0; i < pos.count; i++) {
      va.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (va.y > ground + 0.35 || va.y < ground - 0.3) continue;
      const dx = va.x - b.position[0];
      const dz = va.z - b.position[2];
      const bin = ((Math.round((Math.atan2(dz, dx) / (Math.PI * 2)) * BINS) % BINS) + BINS) % BINS;
      rim[bin] = Math.max(rim[bin], Math.hypot(dx, dz));
    }
    const rimAt = (a: number) => rim[((Math.round((a / (Math.PI * 2)) * BINS) % BINS) + BINS) % BINS];

    // ground plants at the foot (frames 1 s / 56 s: ferns and grass sprigs lap the rock's base
    // and spill onto the paving edge) — sown around the rim, denser on the shaded side and the
    // path side, so the rock sits in the ground rather than on it. Own stream: nothing below moves.
    {
      const gRng = bRng.fork(`base-plants-${b.id}`);
      const want = r > 1.5 ? 18 : 12;
      const toPath = towardPath(b.position[0], b.position[2]);
      let placed = 0;
      for (let k = 0; k < want * 4 && placed < want; k++) {
        const a = gRng.range(0, Math.PI * 2);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // acceptance: 0.35 anywhere, up to 1 where the rim faces the shade or the path
        const favour = Math.max(ca * shadeDir[0] + sa * shadeDir[1], ca * toPath[0] + sa * toPath[1]);
        if (!gRng.chance(0.35 + 0.65 * smoothstep(0.0, 0.8, favour))) continue;
        const d = rimAt(a) * gRng.range(0.98, 1.22) + 0.04;
        const x = b.position[0] + ca * d;
        const z = b.position[2] + sa * d;
        if (!notPaved(x, z)) continue;
        const fern = gRng.chance(0.45);
        boulderPlants.push({ x, y: T.height(x, z) - 0.004, z, size: fern ? 0.5 : gRng.range(0.5, 0.95), kind: fern ? 'fern' : 'tuft', scale: fern ? gRng.range(1.5, 2.3) : gRng.range(1.5, 2.1) });
        placed++;
        basePlants++;
      }
    }

    // spill stones: fist-sized mossy stones at the foot, spilling from the rim toward the paving
    // edge (frame 1 s: the A rock's foot sheds a few stones onto the flagstone verge)
    {
      const sRng = bRng.fork(`spill-${b.id}`);
      const toPath = towardPath(b.position[0], b.position[2]);
      const a0 = Math.atan2(toPath[1], toPath[0]);
      // march toward the path to find the paved edge (the spill stops there)
      let edge = rimAt(a0) + 1.2;
      for (let d = rimAt(a0); d < rimAt(a0) + 3; d += 0.1) {
        const m = T.mask(b.position[0] + toPath[0] * d, b.position[2] + toPath[1] * d);
        if (m.path > 0.3 || m.stairs > 0.5 || m.structure > 0.5) {
          edge = d;
          break;
        }
      }
      const n = r > 1.5 ? 6 : 8;
      let placed = 0;
      for (let k = 0; k < n * 3 && placed < n; k++) {
        const a = a0 + sRng.range(-0.65, 0.65);
        const t = sRng.range(0, 1) ** 0.7; // biased toward the rim
        const d = rimAt(a) * 1.02 + t * Math.max(0.2, edge - rimAt(a) * 1.02 - 0.05);
        const x = b.position[0] + Math.cos(a) * d;
        const z = b.position[2] + Math.sin(a) * d;
        if (!notPaved(x, z)) continue;
        const sc = sRng.range(0.07, 0.13);
        T.normal(x, z, _n);
        rubble.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: sRng.range(0, Math.PI * 2), tiltTo: _n.clone().lerp(_up, 0.5).normalize(), variant: sRng.int(0, 4) });
        spillStones++;
        placed++;
      }
    }

    // rubble skirt + pebbles at the base
    const nRub = Math.round(rng.range(9, 16) * (0.6 + 0.4 * r) * density);
    for (let k = 0; k < nRub; k++) {
      const a = bRng.range(0, Math.PI * 2);
      const d = r * bRng.range(0.85, 1.55);
      const x = b.position[0] + Math.cos(a) * d;
      const z = b.position[2] + Math.sin(a) * d;
      if (!notPaved(x, z)) continue;
      const sc = bRng.range(0.09, 0.3) * (0.7 + 0.3 * r);
      T.normal(x, z, _n);
      rubble.push({ x, y: T.height(x, z) - sc * 0.3, z, scale: sc, yaw: bRng.range(0, Math.PI * 2), tiltTo: _n.clone().lerp(_up, 0.5).normalize(), variant: bRng.int(0, 4) });
    }
    const nPeb = Math.round(bRng.range(35, 60) * density);
    for (let k = 0; k < nPeb; k++) {
      const a = bRng.range(0, Math.PI * 2);
      const d = r * bRng.range(0.9, 1.9);
      const x = b.position[0] + Math.cos(a) * d;
      const z = b.position[2] + Math.sin(a) * d;
      if (!notPaved(x, z)) continue;
      const sc = bRng.range(0.03, 0.1);
      pebbles.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: bRng.range(0, Math.PI * 2), variant: bRng.int(0, 4) });
    }

    // near LOD (see NEAR_ROCK_IN_M): the same rock from the same stream, rebuilt denser with the
    // near relief, dressed, with loose fragments at its foot — swapped in for the far mesh while
    // the live camera stands within the in-radius. Own streams only; nothing above or below moves
    // (round 45: the block sits after the skirt loop so the kit can carry the skirt stones; it
    // draws from forks only, so the skirt's and pebbles' draws are what they were).
    if (nearLod) {
      const centre = new Vector3(b.position[0], cy, b.position[2]);
      const hero = heroDistance(centre, r * 1.4 + 0.3);
      const inM = Math.min(NEAR_ROCK_IN_M, hero - NEAR_ROCK_HERO_MARGIN);
      const outM = Math.min(NEAR_ROCK_OUT_M, hero - NEAR_ROCK_HERO_MARGIN / 3);
      if (inM < NEAR_ROCK_MIN_IN_M) {
        nearDropped.push(b.id);
        pickCrevicePlants(geo);
      } else {
        // absolute-scale relief on every rock, whatever its radius: main furrows ≤ 3 cm deep, the
        // fine network ≈ 1.2 cm (hairlines in the colour, barely a groove — at the main depth the
        // dense network corrugated the stair-foot rock's flank into chevrons), skin ≈ 2.5 cm,
        // chips ≈ 3 cm
        // (round 44: the stair-foot boulder's near lattice at 52 — 2.0 cm edges against 2.6 — so
        // its rim's chips are finer than the survey camera's 5–10 cm teeth; 54 k triangles for
        // the one boulder, only while the live camera is within 10 m of it)
        const stairFoot = b.id === 'stair-foot';
        const nearGeo = buildRock(bRng.fork(b.id), `${seed}/boulder-${b.id}`, {
          ...rockOpts,
          detail: r > 1.5 ? 44 : stairFoot ? 52 : 40,
          // fable-2 (survey-2 #17 / #25): the stair-foot rock is the weathered, rounded boulder
          // of frame 1 s — its near skin is smooth-shaded (facets within 34° share normals, so
          // the micro relief and plate steps read as worn relief, not a fringe of shards) and
          // only the cleave arrises stay hard; the D and terrace rocks keep the fractured 18°
          creaseDeg: stairFoot ? 40 : 18,
          crackDepth: Math.min(0.045, 0.03 / r),
          fineCracks: 0.6,
          fineCrackDepth: Math.min(0.015, 0.012 / r),
          micro: Math.min(0.03, 0.025 / r) * (stairFoot ? 0.6 : 1),
          // (the stair-foot boulder's chips at a quarter depth: 0.75 cm scallops in a 9 cm roll)
          chip: Math.min(0.035, 0.03 / r) * (stairFoot ? 0.25 : 1),
          // round 44 (survey-1 crop 25): the cleave rims filleted over ≈ 5 cm (9 cm on the
          // stair-foot boulder) and their chips scalloped (rockgen.ts `rimRound`) — the stair-foot
          // boulder's east rim was a saw-blade of 2–3 cm teeth every 5–10 cm — and the bare skin
          // stepped into ≈ 35 cm plates ± 1.5 cm with dark joints (`plates`), so the flank reads
          // as fractured stone at 1–4 m, not one flat photo texture. Both are off on the far mesh
          // (the six fixed views).
          rimRound: Math.min(0.12, (stairFoot ? 0.09 : 0.05) / r),
          // (the stair-foot rock's plates step half as far: worn slabs, not stacked shards)
          plates: Math.min(0.025, 0.015 / r) * (stairFoot ? 0.5 : 1),
          // fable-2 (survey-2 #32): lichen as crust colonies that follow the plates (`aLichen`,
          // painted by the near material in place of the flecks); the D boulder's pale face
          // carries the most, the moss-hatted A / terrace rocks less
          lichen: b.id === 'shot-d-boulder' ? 0.6 : 0.35,
          // fable-2 (opus #10): the D boulder's cleave faces are most of what the player sees at
          // 2 m, and the far mesh's 40 % darkening (a silhouette term for camera D at 7 m) made
          // the whole face a dark mass; the reference's face in frame D is the pale, weathered
          // read (lum 0.32), so the near skin keeps only a hint of the fresh-fracture darkening
          cutDark: b.id === 'shot-d-boulder' ? 0.12 : rockOpts.cutDark,
          // bedding ledges: D's deeper (frame 56 s: layered). None on the A / terrace rocks, as
          // on their far mesh — a faint 0.035 layering made their moss blanket (mossAt halves
          // the coverage on every parting) step ~10 cm at each ~20 cm bed: the stair-foot rock's
          // flank read as a stack of pancakes
          strata: b.id === 'shot-d-boulder' ? 0.1 : 0,
          // fable-2 (survey-2 #32): no parting pit on the crown — the "black hole on top"
          strataCrown: 0.1,
          // fable-2 (survey-2 #17 / #25): the moss blanket swells as one lumpy sheet — its
          // crack-line and facet steps were the "shard skirt" along the stair-foot rock's flank
          mossSwellSmooth: true,
        });
        // the crevice plants root in the near skin's furrows (the far mesh's cracks are only lines)
        const crevice = pickCrevicePlants(nearGeo);
        const nRng = bRng.fork(`near-${b.id}`);
        // (fable-2: the lichen disc plates are gone — 2–5 cm discs read as polka dots at 1 m; the
        // crust is the `aLichen` field the near material paints. `lichen: 0` keeps the cushion
        // stream where it was.)
        const dressed = dressRock(nearGeo, nRng.fork('dressing'), { radius: r, minY: -0.35 * r * squash, cushions: r > 1.5 ? 40 : r > 0.8 ? 24 : 14, lichen: 0, shade: toLocal(shadeDir, yaw), tint: tintC }, mossPalette);
        const nearStats = (nearGeo.userData.rockStats ?? {}) as { lichenShare?: number };
        nearGeo.dispose();
        // loose fragments: fist-sized angular spalls (five cleaves, no moss cap) lying at the foot
        // on the un-paved ground, seated on the terrain, folded into the near mesh's local frame
        const fRng = nRng.fork('fragments');
        const inv = new Matrix4().copy(mesh.matrixWorld).invert();
        const parts: { geometry: BufferGeometry; matrix: Matrix4 }[] = [];
        const nFrag = r > 1.5 ? 8 : 6;
        for (let k = 0; k < nFrag * 4 && parts.length < nFrag; k++) {
          const a = fRng.range(0, Math.PI * 2);
          const d = rimAt(a) * fRng.range(1.0, 1.3) + 0.03;
          const x = b.position[0] + Math.cos(a) * d;
          const z = b.position[2] + Math.sin(a) * d;
          if (!notPaved(x, z)) continue;
          const fr = fRng.range(0.045, 0.12) * (0.85 + 0.15 * Math.min(2, r));
          const frag = buildRock(fRng.fork(`frag-${k}`), `${seed}/frag-${b.id}-${k}`, { radius: fr, detail: 2, ridge: 0.22, lump: 0.2, cuts: 5, cutUp: [-0.3, 1], squashY: 0.72, creaseDeg: 35, cracks: 0.3, moss: 0.2, dirt: 0.5, tint: new Color(0.8, 0.79, 0.76), freq: 1 });
          T.normal(x, z, _n);
          _q.setFromUnitVectors(_up, _n.clone().lerp(_up, 0.5).normalize()).multiply(new Quaternion().setFromAxisAngle(_up, fRng.range(0, Math.PI * 2)));
          _p.set(x, T.height(x, z) - fr * 0.15, z);
          parts.push({ geometry: frag, matrix: inv.clone().multiply(new Matrix4().compose(_p, _q, _s.setScalar(1))) });
        }
        const fragmentCount = parts.length;
        // round 45 (details-1): the SKIRT and spill stones at near range. The far skirt is four
        // radius-1 variants at detail 3 (80 triangles' worth of icosphere per stone) instanced at
        // 0.1–0.4 m under the shared material's 1.4 m triplanar tile — at 2 m (survey-1 crop 28,
        // sn-boulder-stairfoot) they read as pale smooth spheres in a uniform moss coat. Here every
        // stone is rebuilt AT ITS OWN RADIUS (so the relief is the stone's, not a scaled-down
        // metre rock's) with the rockgen fracture at small scale: four to five cleaves with
        // chipped, filleted rims, ridging and micro pits, crack furrows, a lumpy moss CAP that
        // stops at the shoulders (`facetBare` keeps the fracture faces bare), and a deep contact
        // collar + `aWet` band the near material darkens — dark undersides seated in the litter.
        // Same seat and pose as the far instance (its matrix), folded into the kit like the
        // fragments: +0 draws; the far instances collapse while the kit is in (nearUpdate).
        // fable-2 (survey-2 #17 / #25, `sn-boulder-stairfoot`): the round-45 stones were cut by
        // four or five cleaves at the DEFAULT depth (42–62 % of the radius — a facet the size of
        // the stone) with 30° crease normals: angular low-poly shards. Now each is a weathered
        // cobble: two or three shallow spalls (80–94 %), rounded arrises, 62° crease normals so
        // only the spall edges stay hard, lumpier low-frequency shape, a moss cap on the
        // shaded side, sunk a third of its radius into the litter. Same forks and poses.
        const skirt: number[] = [];
        const kRng = nRng.fork('skirt');
        const nearStone = new Matrix4();
        const cobble = (stoneRng: Rng, stoneSeed: string, sc: number, cuts: number, shade: [number, number]): BufferGeometry =>
          buildRock(stoneRng, stoneSeed, {
            radius: sc,
            detail: sc > 0.22 ? 9 : sc > 0.12 ? 8 : 6,
            ridge: 0.2,
            lump: 0.38,
            cuts,
            cutUp: [-0.2, 0.9],
            cutDepth: [0.8, 0.94],
            squashY: 0.7,
            creaseDeg: 62,
            cracks: 0.28,
            crackDepth: 0.02,
            fineCracks: 0.3,
            fineCrackDepth: 0.008,
            micro: 0.05,
            chip: 0.02,
            rimRound: 0.14,
            moss: 0.72,
            mossThickness: 0.11,
            mossLumpy: 0.8,
            mossSide: 0.5,
            mossShade: shade,
            facetBare: 0.45,
            dirt: 0.7,
            collarBand: [0.05, 0.5],
            tint: new Color(0.6, 0.59, 0.56),
            freq: 1,
          });
        for (let k = ownStart; k < rubble.length; k++) {
          const it = rubble[k];
          if (it.scale <= 0) continue; // culled by the expansion (see below)
          const sc = it.scale;
          const stone = cobble(kRng.fork(`stone-${k - ownStart}`), `${seed}/skirt-${b.id}-${k - ownStart}`, sc, 2 + ((k - ownStart) % 2), toLocal(shadeDir, it.yaw));
          // the far instance's pose at unit scale (the stone is already its size), 5 % deeper in
          // the litter than the far sphere so the fractured base sits in the ground, not on it
          instanceMatrix({ ...it, scale: 1, y: it.y - sc * 0.05 }, nearStone);
          parts.push({ geometry: stone, matrix: inv.clone().multiply(nearStone) });
          skirt.push(k);
        }
        // fable-2: MORE and SMALLER shards, near-only (the six views never see them): 3.5–11 cm
        // cobbles half-buried in the litter around the rim, denser on the shaded and path sides
        // like the base plants, each seated on the heightfield with the terrain normal. Own fork;
        // folded into the kit (+0 draws).
        const xRng = nRng.fork('shards');
        const nShard = Math.round((r > 1.5 ? 18 : 14) * (0.7 + 0.3 * Math.min(2, r)));
        const toPath = towardPath(b.position[0], b.position[2]);
        let shards = 0;
        for (let k = 0; k < nShard * 4 && shards < nShard; k++) {
          const a = xRng.range(0, Math.PI * 2);
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const favour = Math.max(ca * shadeDir[0] + sa * shadeDir[1], ca * toPath[0] + sa * toPath[1]);
          if (!xRng.chance(0.4 + 0.6 * smoothstep(0.0, 0.8, favour))) continue;
          const d = rimAt(a) * xRng.range(1.0, 1.55) + 0.03;
          const x = b.position[0] + ca * d;
          const z = b.position[2] + sa * d;
          if (!notPaved(x, z)) continue;
          const sc = xRng.range(0.035, 0.11);
          const yaw2 = xRng.range(0, Math.PI * 2);
          const shard = cobble(xRng.fork(`shard-${k}`), `${seed}/shard-${b.id}-${k}`, sc, 2, toLocal(shadeDir, yaw2));
          T.normal(x, z, _n);
          _q.setFromUnitVectors(_up, _n.clone().lerp(_up, 0.5).normalize()).multiply(new Quaternion().setFromAxisAngle(_up, yaw2));
          // half-buried: the flat-ish underside (−0.62 r·squash) well under the litter, the cap
          // 0.3–0.35 r proud
          _p.set(x, T.height(x, z) - sc * 0.38, z);
          parts.push({ geometry: shard, matrix: inv.clone().multiply(new Matrix4().compose(_p, _q, _s.setScalar(1))) });
          shards++;
        }
        // fable-2 (survey-2 #17 / #25 — the actual "shard skirt"): the embankment STRATA slabs
        // that the bank scatter drops against the rock — radius-1 variants at detail 3 with four
        // cleaves, instanced at 0.2–0.6 m — are the stacked angular low-poly shards along the
        // stair-foot boulder's flank at 2 m. While the kit is in, every slab within reach of the
        // rock collapses (like the skirt) and comes back here rebuilt at 0.7× its size as a
        // smooth-shaded, moss-capped slab seated half-buried on the heightfield, with two smaller
        // companions beside it — more, smaller, smooth-shaded shards. The six fixed views keep
        // the far slabs.
        const strataSkirt: number[] = [];
        let strataCompanions = 0;
        const stRng = nRng.fork('strata-kit');
        const reach = r * 2.1 + 0.5;
        for (let k = 0; k < strata.length; k++) {
          const it = strata[k];
          if (it.scale <= 0) continue; // culled by the expansion (see below)
          if (Math.hypot(it.x - b.position[0], it.z - b.position[2]) > reach) continue;
          strataSkirt.push(k);
          const sc = it.scale * 0.7;
          const slab = buildRock(stRng.fork(`slab-${k}`), `${seed}/slab-${b.id}-${k}`, {
            radius: sc,
            detail: sc > 0.3 ? 9 : 8,
            ridge: 0.18,
            lump: 0.3,
            cuts: 3,
            cutUp: [-0.2, 0.9],
            cutDepth: [0.78, 0.92],
            squashY: 0.55,
            creaseDeg: 60,
            cracks: 0.25,
            crackDepth: 0.02,
            micro: 0.04,
            chip: 0.015,
            rimRound: 0.16,
            strata: 0.06,
            moss: 0.7,
            mossThickness: 0.1,
            mossLumpy: 0.8,
            mossSide: 0.4,
            mossShade: toLocal(shadeDir, it.yaw),
            facetBare: 0.4,
            dirt: 0.6,
            tint: new Color(0.6, 0.59, 0.56),
            freq: 1,
          });
          // the far slab's pose (tilt + yaw) at unit scale, its centre 12 % of the radius under
          // the ground: half-buried, the moss cap 0.4 r proud
          instanceMatrix({ ...it, scale: 1, y: T.height(it.x, it.z) - sc * 0.12 }, nearStone);
          parts.push({ geometry: slab, matrix: inv.clone().multiply(nearStone) });
          for (let c = 0; c < 2; c++) {
            const a = stRng.range(0, Math.PI * 2);
            const dd = sc * stRng.range(0.9, 1.6);
            const x = it.x + Math.cos(a) * dd;
            const z = it.z + Math.sin(a) * dd;
            const s2 = sc * stRng.range(0.3, 0.55);
            const yaw2 = stRng.range(0, Math.PI * 2);
            if (!notPaved(x, z) || Math.hypot(x - b.position[0], z - b.position[2]) < rimAt(Math.atan2(z - b.position[2], x - b.position[0])) * 0.95) continue;
            const companion = cobble(stRng.fork(`companion-${k}-${c}`), `${seed}/companion-${b.id}-${k}-${c}`, s2, 2, toLocal(shadeDir, yaw2));
            T.normal(x, z, _n);
            _q.setFromUnitVectors(_up, _n.clone().lerp(_up, 0.5).normalize()).multiply(new Quaternion().setFromAxisAngle(_up, yaw2));
            _p.set(x, T.height(x, z) - s2 * 0.35, z);
            parts.push({ geometry: companion, matrix: inv.clone().multiply(new Matrix4().compose(_p, _q, _s.setScalar(1))) });
            strataCompanions++;
          }
        }
        const kit = mergeRockParts(dressed.geometry, parts);
        dressed.geometry.dispose();
        for (const p of parts) p.geometry.dispose();
        const nearMesh = new Mesh(kit, mesh.material);
        nearMesh.position.copy(mesh.position);
        nearMesh.rotation.y = yaw;
        nearMesh.castShadow = true;
        nearMesh.receiveShadow = true;
        nearMesh.visible = false;
        nearMesh.name = `boulder-${b.id}-near`;
        nearMesh.updateMatrixWorld(true);
        group.add(nearMesh);
        nearRocks.push({ id: b.id, centre, far: mesh, near: nearMesh, inM, outM, hero, active: false, dist: Infinity, triangles: kit.attributes.position.count / 3, cushions: dressed.stats.cushions, creviceCushions: dressed.stats.creviceCushions, lichen: dressed.stats.lichen, lichenShare: Math.round((nearStats.lichenShare ?? 0) * 1000) / 1000, fragments: fragmentCount, shards, creviceFerns: crevice.ferns, crevicePads: crevice.pads, skirt, skirtStones: skirt.length, strataSkirt, strataCompanions });
      }
    }
  }
  ctx.progress('rocks', 0.4);

  // --- shared small-rock geometry variants -------------------------------------------------
  // (round 24: the strata and pebble variants take cracks 0 - before rockgen normalised its ridged
  // noise their 0.2-0.5 never reached the crack threshold, so the 2 730 pebbles and 159 scree had
  // no crack lines; with it they grew crazed dark lines everywhere on the plaza verges and cost
  // B/C 0.002-0.003 SSIM against take-77 for nothing the frames show. The rubble keeps 0.4.)
  const vRng = rng.fork('variants');
  // the skirt and spill stones are mossy (frame 1 s: the stones at the A rock's foot are green
  // pads with a grey underside), with a thin cushion so the moss has a silhouette
  const rubbleGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`rubble-${i}`), `${seed}/rubble-${i}`, { radius: 1, detail: 3, ridge: 0.2, lump: 0.22, cuts: 3, squashY: 0.75, creaseDeg: 40, cracks: 0.4, moss: 0.65, mossThickness: 0.06, dirt: 0.4, tint: new Color(0.68, 0.67, 0.64), freq: 1 }),
  );
  const strataGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`strata-${i}`), `${seed}/strata-${i}`, { radius: 1, detail: 3, ridge: 0.14, lump: 0.15, cuts: 4, squashY: 0.55, creaseDeg: 30, cracks: 0, moss: 0.65, dirt: 0.5, tint: new Color(0.62, 0.6, 0.56), freq: 1, strata: 0.1 }),
  );
  // fable-2 (opus #16, the plaza at 1–2 m: "the joint pebbles are identical smooth olive
  // ellipsoids"): eight variants at the same 80 triangles each — half of them angular chunks (two
  // to four cleaves, 30° crease normals), half worn cobbles (one or two shallow spalls), flat to
  // tall, bare grey / warm tan / dark / pale, moss on some and not others — one InstancedMesh per
  // variant (+4 draws, +0 triangles). The scatter picks the variant per cell (pebbles.ts).
  const pebbleGeos = PEBBLE_LOOKS.map((look, i) =>
    buildRock(vRng.fork(`pebble-${i}`), `${seed}/pebble-${i}`, { radius: 1, detail: 1, ridge: 0.15, lump: look.lump, cuts: look.cuts, cutDepth: look.cutDepth, squashY: look.squash, creaseDeg: look.crease, cracks: 0, moss: look.moss, dirt: 0.3, tint: look.tint, freq: 1 }),
  );

  ctx.progress('rocks', 0.6);

  // --- pebbles: path edges, stair feet, scatter (pebbles.ts) ----------------------------------
  // fable-2 (GOAL_MODE #4): every candidate is a lattice cell with stateless per-cell draws, so a
  // paving edit moves only the pebbles whose cell it touched (the old sequential stream re-rolled
  // them world-wide — round 47's whole camera-D delta). The lattice reaches the north paving too;
  // its pebbles (z < NORTH_Z1) are a separate instanced set under the north-locality toggle
  // (the envelope: the old scatter's reach — ±4.2 m squares around the path polylines' points —
  // as a soft disc, full to 3.5 m and gone by 5.5 m; the north paving is its own set and ignores it)
  const pebbleSets = scatterPathPebbles(T, seed, { ...PEBBLE_DEFAULTS, radius: Math.max(detailR, 84), northZ: NORTH_Z1, density, envelope: { pts: pathPtsAll.map((q) => [q[0], q[2]] as [number, number]), full: 3.5, far: 5.5 } });
  pebbles.push(...pebbleSets.main);
  const northPebbles: Instance[] = [...pebbleSets.north];
  for (const s of ctx.layout.stairs) {
    const at = stairFootPebbles(T, seed, s, density);
    (s.base[2] < NORTH_Z1 ? northPebbles : pebbles).push(...at);
  }
  // (the expansion cull, see above: the pebble lists and the rubble)
  for (let i = pebbles.length - 1; i >= 0; i--) if (expansionCull(pebbles[i].x, pebbles[i].z)) (pebbles.splice(i, 1), culled.pebbles++);
  for (const it of rubble) if (it.scale > 0 && expansionCull(it.x, it.z)) (it.scale = 0), culled.rubble++;
  ctx.progress('rocks', 0.8);

  // --- rock ledge faces (ledge.ts) — positions from the layout hook, or the dev preview -------
  const ledgeDefs: RockLedgeDef[] = (() => {
    const fromLayout = (ctx.layout as unknown as { rockLedges?: RockLedgeDef[] }).rockLedges;
    if (fromLayout?.length) return fromLayout;
    const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rockLedgePreview') === '1';
    return preview ? LEDGE_PREVIEW : [];
  })();
  const ledgeInfo: { id: string; height: number; length: number; triangles: number; mossShare: number; wetShare: number; contacts: number; maxFootGap: number }[] = [];
  const ledgeContacts: [number, number, number][] = [];
  // the ledge faces (and the clearing's rock dressing, below) stand in the north locality
  // (z < −55): drawn only within its visibility radius
  const ledgeMeshes: Mesh[] = [];
  const nBox = northBox(ctx.layout);
  if (ledgeDefs.length) {
    const ledgeMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4, 0.85, { near: true, fade: LEDGE_FADE_M, damp: LEDGE_DAMP, relief: LEDGE_RELIEF });
    const lRng = rng.fork('ledges');
    for (const def of ledgeDefs) {
      const built = buildRockLedge(def, T, lRng.fork(def.id), `${seed}/ledge`);
      const mesh = new Mesh(built.geometry, ledgeMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `ledge-${def.id}`;
      group.add(mesh);
      ledgeMeshes.push(mesh);
      let maxFootGap = 0;
      for (const c of built.contacts) maxFootGap = Math.max(maxFootGap, Math.abs(c[1] - T.height(c[0], c[2])));
      ledgeContacts.push(...built.contacts);
      ledgeInfo.push({ id: def.id, ...built.stats, contacts: built.contacts.length, maxFootGap: Math.round(maxFootGap * 1000) / 1000 });
    }
  }

  // --- the north clearing's rock dressing (clearing.ts): the west-bank boulder pair, scree at the
  // ledge flight's flanks, half-buried strata along the terrace face east of the flight — one
  // merged mesh under the hero (near) material; positions from the layout's northClearing /
  // stairs.ledge / ledgeTerrace, own fork
  const clearing = buildClearingRocks(ctx.layout as unknown as ClearingLayout, T, rng.fork('north-clearing'), seed, shadeDir);
  if (clearing) {
    const clearingMesh = new Mesh(clearing.geometry, heroMaterial);
    clearingMesh.castShadow = true;
    clearingMesh.receiveShadow = true;
    clearingMesh.name = 'north-clearing-rocks';
    // north locality: drawn within NORTH_VISIBLE_M of the north box like the ledge faces — the six
    // fixed cameras stand 60–70 m off behind the north rise, and a mesh inside their frusta is a
    // mesh they pay for (+2 draws, +0.14 M tris at A / B / D / E for stones nobody sees)
    clearingMesh.visible = false;
    group.add(clearingMesh);
    ledgeMeshes.push(clearingMesh);
  }

  // --- the plaza's backside (backside.ts, round 49 / V20): the pale boulder pair, the low stone step
  // and the flight's scree at the fence-topped south bank — seated on the LIVE terrain (the bank is
  // not in this system's legacy view), one mesh under the hero material, toggled with expansion-2's
  // frustum + shadow-sweep spheres so camera C never draws it; own fork
  const backside = buildBacksideRocks(rng.fork('backside'), seed, shadeDir);
  let backsideMesh: Mesh | null = null;
  let backsideSpheres: Sphere[] = [];
  if (backside) {
    backsideMesh = new Mesh(backside.geometry, heroMaterial);
    backsideMesh.castShadow = true;
    backsideMesh.receiveShadow = true;
    backsideMesh.name = 'backside-rocks';
    backsideMesh.visible = false;
    group.add(backsideMesh);
    const sunDir = sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
    backsideSpheres = backside.spheres(sunDir);
  }

  const rubbleSlots: InstanceSlot[] = [];
  const rubbleMeshes = buildInstanced(rubble, rubbleGeos, material, 'rubble', true, rubbleSlots);
  const strataSlots: InstanceSlot[] = [];
  const strataMeshes = buildInstanced(strata, strataGeos, material, 'strata', true, strataSlots);
  const pebbleMeshes = buildInstanced(pebbles, pebbleGeos, pebbleMaterial, 'pebbles', false);
  const northPebbleMeshes = buildInstanced(northPebbles, pebbleGeos, pebbleMaterial, 'pebbles-north', false);
  for (const m of [...rubbleMeshes, ...strataMeshes, ...pebbleMeshes, ...northPebbleMeshes]) group.add(m);
  for (const m of northPebbleMeshes) {
    m.visible = false;
    ledgeMeshes.push(m);
  }
  // the boulder-cap plants share the hardscape joint-sprout geometry and wind material; the
  // tufts, ferns and moss pads are packed into one InstancedMesh (one draw for all the cap and
  // crevice plants). The crevice spots go last so the cap / base plants keep their jitter draws.
  boulderPlants.push(...crevicePlants);
  const plants = buildSproutMeshes(boulderPlants, rng.fork('boulder-plants'), createSproutMaterial(ctx.wind, ctx.config), ctx.config, ROCK_PLANT_PACKS);
  for (const m of plants.meshes) {
    m.name = `boulder-plants-${m.name}`;
    group.add(m);
  }

  /**
   * The near-LOD state for the camera at `camera`: with `reset` (an explicit re-pose — the
   * capture harness, the viewpoint keys) recomputed from the distances alone, so a capture's
   * frame never depends on where the camera was before; per frame the hysteresis holds a rock's
   * near version in until its out-radius.
   */
  const collapsed = new Matrix4().makeScale(0, 0, 0);
  const nearUpdate = (camera: Camera, reset: boolean) => {
    camera.getWorldPosition(_cam);
    for (const nr of nearRocks) {
      nr.dist = nr.centre.distanceTo(_cam);
      const was = nr.active;
      if (reset) nr.active = nr.dist < nr.inM;
      else if (nr.active) nr.active = nr.dist <= nr.outM;
      else nr.active = nr.dist < nr.inM;
      nr.far.visible = !nr.active;
      nr.near.visible = nr.active;
      // round 45: the far skirt stones collapse to nothing while the kit carries them (a
      // zero-scale instance rasterises no fragment and casts no shadow), and come back with the
      // matrices they were built with; only on a change of state, and only those instances
      if (nr.active !== was || reset) {
        for (const k of nr.skirt) {
          const slot = rubbleSlots[k];
          if (!slot) continue;
          slot.mesh.setMatrixAt(slot.index, nr.active ? collapsed : slot.matrix);
          slot.mesh.instanceMatrix.needsUpdate = true;
        }
        // (fable-2) the embankment slabs the kit adopted, the same way
        for (const k of nr.strataSkirt) {
          const slot = strataSlots[k];
          if (!slot) continue;
          slot.mesh.setMatrixAt(slot.index, nr.active ? collapsed : slot.matrix);
          slot.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  };

  const samplePebbles = pebbles.filter((_, i) => i % Math.max(1, Math.ceil(pebbles.length / 200)) === 0).slice(0, 200);
  const rnd = (v: number) => Math.round(v * 1000) / 1000;
  ctx.audit('rocks', () => ({
    heroBoulders: boulderInfo.length,
    boulders: boulderInfo,
    /** the highest any hero boulder's underside stands above the terrain (m); 0 = fully seated */
    maxBaseGap: Math.max(0, ...boulderInfo.map((b) => b.baseGap)),
    geometry: 'procedural-v4-near-lod',
    features: ['ridged-displacement', 'crown-lumps', 'bedding-strata', 'cleave-cuts', 'crack-furrows', 'moss-cushion', 'moss-shade-blanket', 'crease-normals', 'crack-vertex-colour', 'moss-upward-faces', 'contact-dirt', 'rubble-skirt', 'spill-stones', 'triplanar-texture', 'lichen-flecks', 'sun-side-moss', 'cap-plants', 'base-plants', 'crevice-plants', 'near-lod', 'near-tile', 'micro-relief', 'fine-cracks', 'chipped-rims', 'wet-band', 'crack-grime', 'moss-pads', 'lichen-plates', 'foot-fragments', 'near-skirt-stones'],
    mossCoverage: true,
    boulderPlants: plants.count,
    boulderFerns: plants.ferns,
    boulderMossPads: plants.cushions,
    crevicePlants: crevicePlants.length,
    basePlants,
    spillStones,
    /** the hero boulders' near LOD (NEAR_ROCK_IN_M): swap radii, kit sizes and what the current camera shows */
    nearLod: {
      enabled: nearLod,
      inM: NEAR_ROCK_IN_M,
      outM: NEAR_ROCK_OUT_M,
      heroMargin: NEAR_ROCK_HERO_MARGIN,
      tileM: NEAR_TILE_M,
      fadeM: NEAR_FADE_M,
      dropped: nearDropped,
      rocks: nearRocks.map((nr) => ({ id: nr.id, inM: rnd(nr.inM), outM: rnd(nr.outM), hero: Number.isFinite(nr.hero) ? rnd(nr.hero) : null, triangles: nr.triangles, cushions: nr.cushions, creviceCushions: nr.creviceCushions, lichen: nr.lichen, lichenShare: nr.lichenShare, fragments: nr.fragments, shards: nr.shards, skirtStones: nr.skirtStones, strataSlabs: nr.strataSkirt.length, strataCompanions: nr.strataCompanions, creviceFerns: nr.creviceFerns, crevicePads: nr.crevicePads, active: nr.active, dist: Number.isFinite(nr.dist) ? rnd(nr.dist) : null })),
      active: nearRocks.filter((nr) => nr.active).map((nr) => nr.id),
    },
    boulderPlantDrawCalls: plants.meshes.length,
    /** round 49 (perf-3): plant instances submitted per pack mesh after the cull, and their triangles, for the current camera */
    boulderPlantSubmission: { instances: [...plants.submitted], triangles: plants.submittedNow() },
    /** rock ledge faces (ledge.ts): from `layout.rockLedges`, or the `?rockLedgePreview=1` preview (never in a take) */
    ledges: ledgeInfo,
    /** the north clearing's dressing (clearing.ts): boulder pair / scree / slabs, one mesh */
    northClearing: clearing ? clearing.stats : null,
    /** the plaza's backside (backside.ts): the south bank's pair / toe step / flight scree, one mesh */
    backside: backside ? backside.stats : null,
    ledgeSource: ledgeInfo.length ? ((ctx.layout as unknown as { rockLedges?: unknown[] }).rockLedges?.length ? 'layout' : 'preview') : 'none',
    rubble: rubble.length,
    strata: strata.length,
    scree: rubble.length + strata.length,
    /**
     * every instanced small stone near path edges, stair feet and boulder bases (W24): the plaza-side
     * set plus the north paving's set (`pebbles-north`, drawn within the north locality like every
     * other north mesh). Breakdown below.
     */
    pebbles: pebbles.length + northPebbles.length,
    pebblesMain: pebbles.length,
    /** sampled stones dropped after placement because they sat inside the round-49 expansion's live-only ground (streams and draws unchanged) */
    expansionCulled: culled,
    /** the north paving's pebbles (pebbles-north, under the north-locality toggle) */
    northPebbles: northPebbles.length,
    instancedMeshes: rubbleMeshes.length + strataMeshes.length + pebbleMeshes.length,
    samplePositions: {
      boulders: contact.map((p) => p.map(rnd)),
      pebbles: samplePebbles.map((p) => [rnd(p.x), rnd(p.y), rnd(p.z)]),
      crevicePlants: crevicePlants.map((p) => [rnd(p.x), rnd(p.y), rnd(p.z), p.kind ?? 'tuft']),
      ledgeFeet: ledgeContacts.map((p) => p.map(rnd)),
      northClearingSeats: clearing ? clearing.contacts.map((p) => p.map(rnd)) : [],
      backsideSeats: backside ? backside.contacts.map((p) => p.map(rnd)) : [],
    },
    palette: { moss: [P.mossDeep, P.mossBright] },
  }));

  return {
    name: 'rocks',
    group,
    update(_dt, _t, c) {
      nearUpdate(c.camera, false);
      const show = northVisible(nBox, c.camera.position.x, c.camera.position.z);
      for (const m of ledgeMeshes) m.visible = show;
      if (backsideMesh) backsideMesh.visible = expansionVisible(c.camera, backsideSpheres);
      // round 49 (perf-3): the cap / crevice plants submit only the instances that can reach the frame (materials/sprouts.ts `cull`)
      plants.cull(c.camera);
    },
    onCameraMove(camera) {
      nearUpdate(camera, true);
      const show = northVisible(nBox, camera.position.x, camera.position.z);
      for (const m of ledgeMeshes) m.visible = show;
      if (backsideMesh) backsideMesh.visible = expansionVisible(camera, backsideSpheres);
      plants.cull(camera, true);
    },
    dispose() {
      for (const nr of nearRocks) nr.near.geometry.dispose();
    },
  };
}
