/**
 * 2026-09-24 (expansion-north) — the vegetation's side of the grove above the ledge terrace
 * (layout `EXPANSION_NORTH`, terrain/north.ts). Its ground lies 77–112 m north of the plaza, past
 * the field's reach (the north corridor's carpet ends near z −84, its forest floor thins out by
 * −96), and its landform is in the LIVE view only, so this pass dresses all of it against the
 * live view:
 *
 *  - the lawn round the flight, the trail and the shelf (terrain/north.ts `groveLawn`, the outline
 *    the terrain's forest floor gives way to its grass on): blades in rooted tufts on tiles of
 *    their own (the village turf's grass material and LODs, grass.ts), a turf mat in every cell
 *    at full weight and clump cards among them, all three on one tone field — trodden off the
 *    trail's middle, the yard's paths and the door's apron, thin in the decks' shade, shorter and
 *    drier on the shelf's yard, deeper toward the forest; it yields to the legacy carpet where
 *    that is drawn (the terrace, the flight's foot), so the two never double;
 *  - the trail's verges and the flight's cheeks: tufts leaning over the edge, leaves in the
 *    angles, ferns a little further out;
 *  - the shelf's rim: ferns, tufts and moss on the cut bank, tufts rolling over the lip;
 *  - the understory round the walks: ferns, bushes, big fern crowns, moss, and under the raised
 *    decks (out of reach) ferns and moss only;
 *  - the built feet: ferns, tufts and moss round the stilts, the stump, the trestle, the column,
 *    the trunk house's bole, the posts and the sign;
 *  - flower clumps in the lawn, leaves over the forest floor.
 *
 * Every seat keeps off the paving, the flight, the built footprints (the terrain mask) and what
 * stands on the ground (`ctx.shared.builtFootprints`, published by structures). Own sets built from
 * the disc sets' templates, own seeded streams (`expansion-north/…`), one group that
 * `vegetation/index.ts` shows only where the camera can see the grove (util/groveLocality.ts
 * `groveVisible`), so the six fixed frames pay nothing for it.
 */
import { BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, Sphere, Vector3, type Material } from 'three';
import { EXPANSION_NORTH, NORTH_STAIRS, northGangway } from '../layout';
import type { WorldContext } from '../system';
import { getTerrain, type Terrain } from '../terrain/heightfield';
import { GROVE_DOOR, STILT_STUMP, gangwayTrestleFeet, groveDeckDistance, groveGroundDistance, groveLawn, shelfDistance, stiltFeet } from '../terrain/north';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { matPalettePosition } from './carpet';
import type { ExpansionTemplates, ExpansionVegetation, SetTemplate } from './expansion';
import { composeMatrix } from './field';
import { bladeGeometry } from './grass';
import { LodInstancedSet } from './lodset';

export interface GroveTemplates extends ExpansionTemplates {
  /** the big lit fern crowns (plants.ts heroFerns): under the decks, round the column, beside the walks */
  heroFerns: SetTemplate;
}

/** the legacy carpet's sets (carpet.ts), read so the grove's lawn yields where they are drawn */
export interface LegacyLawn {
  mats: LodInstancedSet[];
  cards: LodInstancedSet[];
}

/** one BLADE_TILE tile of the lawn's blades: its mesh, the LOD geometries it swaps between (all sharing its aData), the one it holds */
export interface GroveBladeTile {
  mesh: InstancedMesh;
  lods: BufferGeometry[];
  lod: number;
  count: number;
  mx: number;
  mz: number;
}

/** the lawn's blade tiles: LOD by camera distance (`update`), what the last update drew */
export interface GroveBlades {
  tiles: GroveBladeTile[];
  count: number;
  typeCounts: number[];
  update(camPos: Vector3): void;
  visible: { drawCalls: number; triangles: number; lodCounts: number[] };
  dispose(): void;
}

export interface GroveVegetation extends ExpansionVegetation {
  blades: GroveBlades;
}

const N = EXPANSION_NORTH;
/** the dressed ground [x0, z0, x1, z1]: the walks and decks with DRESS_M round them, the terrace's legacy lawn to the south */
const DBOX: readonly [number, number, number, number] = [-24, -120, 24, -78];
/** carpet card / mat footprints and the card grid pitch (vegetation/expansion.ts, carpet.ts) */
const CARD_W: readonly [number, number] = [0.42, 0.62];
const CARD_H: readonly [number, number] = [0.19, 0.32];
const MAT_W: readonly [number, number] = [0.9, 1.2];
const MAT_LIFT = 0.018;
const CARD_SINK = 0.03;
const CELL = 0.42;
/**
 * The lawn's blades (grass.ts's tiles in miniature): candidate blades per m² at full lawn weight
 * (the village turf's base pass is 245 × its 1 / 1.5 acceptance), in rooted tufts of
 * BLADE_TUFT blades within BLADE_TUFT_R m, on BLADE_TILE m tiles — four-segment blades inside
 * BLADE_LOD_M[0] of a tile's near edge, two-segment to BLADE_LOD_M[1], none past it (the mats and
 * cards carry the turf there, as in the village).
 */
const BLADES_PER_M2 = 150;
const BLADE_TUFT: readonly [number, number] = [5, 9];
const BLADE_TUFT_R = 0.075;
const BLADE_TILE = 8;
const BLADE_LOD_M: readonly [number, number] = [6, 26];
/** the lawn's tone: its base tint drift (grass.ts `tn`: < −0.28 deep … > 0.48 light) on the slopes and the shelf's yard, the mottle's amplitude, the deepening toward the forest and under the decks */
const LAWN_TN = { slopes: 0.12, shelf: 0.22, mottle: 0.18, edge: 0.3, deck: 0.18 };
/** the understory and the litter end this far (m) off the walkable ground */
const DRESS_M = 15;
/** the dressing fades out south of the flight's foot (z): the terrace is the legacy streams' */
const TERRACE_Z: readonly [number, number] = [-79.4, -81.6];

/** 0..1 position hash (mm-quantised seats) */
const hash01 = (x: number, z: number, salt = 0) => {
  let h = (Math.imul(Math.round(x * 1000) + salt * 7919, 374761393) + Math.imul(Math.round(z * 1000), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mm = (v: number) => Math.round(v * 1000) / 1000;

/** distance (m) from (x, z) to the segment (ax, az) → (bx, bz) */
function segDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / Math.max(dx * dx + dz * dz, 1e-9), 0, 1);
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

const FLIGHT = NORTH_STAIRS[0];
const FL = (() => {
  const l = Math.hypot(FLIGHT.dir[0], FLIGHT.dir[1]);
  return { dx: FLIGHT.dir[0] / l, dz: FLIGHT.dir[1] / l, run: FLIGHT.steps * FLIGHT.tread, hw: FLIGHT.width / 2 };
})();
const GW = northGangway();

/** distance (m) from the grove's walkable ground (terrain/north.ts), answered over all of DBOX */
const groveGroundWalk = (x: number, z: number) => groveGroundDistance(x, z, 40);

/** the blades' tint-slot index from a tint drift (grass.ts: the same bins as the blade tiles) */
const tintIndexOf = (tn: number) => (tn < -0.28 ? 0 : tn < 0.12 ? 1 : tn < 0.48 ? 2 : 3);

/**
 * `t`'s pack layout (lodset.ts) with the LODs in `lods` drawn as one pack of every variant. The
 * village splits these buckets per variant because it holds thousands of each plant; the grove's
 * hold tens to a few hundred of 2–153-triangle geometry, so a draw per variant bought a few hundred
 * triangles each in views that sit at the 700-draw budget (the hamlet looking back toward the village).
 */
export function packedAt(t: SetTemplate, lods: readonly number[]): number[][][] {
  const all = t.variants.map((_, v) => v);
  const lodCount = t.variants[0].length;
  const p = t.packs;
  const base: number[][][] = !p ? Array.from({ length: lodCount }, () => [all]) : Array.isArray((p as number[][][])[0]?.[0]) ? (p as number[][][]) : Array.from({ length: lodCount }, () => p as number[][]);
  return base.map((layout, l) => (lods.includes(l) ? [all] : layout));
}

/** `bladeMaterial` is the village turf's grass material (grass.ts) the lawn's blade tiles draw with */
export function buildExpansionNorthVegetation(ctx: WorldContext, templates: GroveTemplates, legacy: LegacyLawn, bladeMaterial: Material, parent: Group): GroveVegetation {
  const T: Terrain = getTerrain();
  const q = ctx.quality;
  const group = new Group();
  group.name = 'expansion-north';
  parent.add(group);
  const counts: Record<string, number> = {};

  const mk = (name: string, t: SetTemplate, packs: SetTemplate['packs'] = t.packs) =>
    new LodInstancedSet({
      name,
      variants: t.variants,
      material: t.material,
      shadowMaterials: t.shadowMaterials,
      lodDistances: t.lodDistances,
      maxDistance: t.maxDistance,
      castShadowLods: t.castShadowLods,
      nearLods: t.nearLods,
      receiveShadow: true,
      packs,
      instanceData: t.instanceData,
      cullPad: t.cullPad,
    });
  const tufts = mk('tufts-grove', templates.tufts, packedAt(templates.tufts, [0, 1]));
  const ferns = mk('ferns-grove', templates.ferns);
  const heroFerns = mk('hero-ferns-grove', templates.heroFerns);
  const moss = mk('moss-grove', templates.moss, packedAt(templates.moss, [1, 2]));
  const flowers = mk('flowers-grove', templates.flowers, packedAt(templates.flowers, [3]));
  const whiteFlowers = mk('flowers-white-grove', templates.whiteFlowers);
  const bushes = mk('bushes-grove', templates.bushes, packedAt(templates.bushes, [3]));
  const weeds = mk('weeds-grove', templates.weeds, packedAt(templates.weeds, [1, 2]));
  const clumps = mk('grass-clumps-grove', templates.clumps);
  const mats = mk('turf-mats-grove', templates.mats);
  const leaves = mk('litter-leaves-grove', templates.leaves, packedAt(templates.leaves, [1, 2]));
  const sets = [mats, clumps, tufts, weeds, moss, ferns, heroFerns, flowers, whiteFlowers, bushes, leaves];

  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const n = new Vector3();
  const white: [number, number, number] = [1, 1, 1];
  const footprints = ctx.shared?.builtFootprints ?? [];
  const terrace = (z: number) => 1 - smoothstep(TERRACE_Z[1], TERRACE_Z[0], z);

  /**
   * How closed the legacy carpet is round (x, z), 0..1: its mats and cards that are drawn above the
   * live ground (the grove's cut buries some on the legacy seat) on a 1 m grid, a 3 × 3 cell mean.
   */
  const legacyCover = (() => {
    const [x0, z0, x1, z1] = DBOX;
    const nx = Math.ceil(x1 - x0);
    const nz = Math.ceil(z1 - z0) + 4;
    const grid = new Float32Array(nx * nz);
    const put = (set: LodInstancedSet, weight: number, above: number) => {
      for (const it of set.items) {
        const i = Math.floor(it.x - x0);
        const j = Math.floor(it.z - z0);
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        if (T.height(it.x, it.z) > it.y + above) continue;
        grid[j * nx + i] += weight;
      }
    };
    for (const s of legacy.mats) put(s, 1, -0.002);
    for (const s of legacy.cards) put(s, 0.6, 0.12);
    return (x: number, z: number) => {
      const i = Math.floor(x - x0);
      const j = Math.floor(z - z0);
      let sum = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) sum += grid[jj * nx + ii];
        }
      }
      return smoothstep(0.35, 1.4, sum / 9);
    };
  })();

  /**
   * Ground every seat obeys: off the paving, the discs, the flight and the built footprints (the
   * live mask), `pad` m clear of what stands on the ground (builtFootprints), off the gangway's
   * low run. Returns the seat's slope (1 − n.y, the normal left in `n`) or −1.
   */
  const groundOk = (x: number, z: number, pad = 0.15): number => {
    const m = T.mask(x, z);
    if (m.path > 0.6 || m.stairs > 0.2 || m.structure > 0.3) return -1;
    for (const f of footprints) if ((x - f.x) ** 2 + (z - f.z) ** 2 < (f.r + pad) ** 2) return -1;
    if (segDistance(x, z, GW.foot[0], GW.foot[2], GW.foot[0] + (GW.head[0] - GW.foot[0]) * 0.5, GW.foot[2] + (GW.head[2] - GW.foot[2]) * 0.5) < N.gangway.halfWidth + 0.3) return -1;
    T.normal(x, z, n);
    return 1 - clamp(n.y, 0, 1);
  };

  /** seat a standing plant of `set` at (x, z) (the normal in `n`): terrain contact, tilt toward the normal, yaw from the stream */
  const plant = (set: LodInstancedSet, x: number, z: number, rng: Rng, scale: number, tilt: number, sink: number, color: [number, number, number], sxz = scale) => {
    const y = T.height(x, z) - sink;
    composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, tilt, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(0, set.variantCount), color);
  };
  const greenVar = (rng: Rng, amount = 0.14): [number, number, number] => [1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2];
  /** a moss cushion of `radius` m (the unit dome 0.45 tall, flattened, a little longer one way) */
  const cushion = (x: number, z: number, rng: Rng, radius: number, color: [number, number, number]) => {
    const h = radius * (0.22 + rng() * 0.2);
    composeMatrix(M, 0, x, T.height(x, z) - 0.012, z, n.x, n.y, n.z, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
    moss.add(M, rng.int(0, moss.variantCount), color);
  };
  const mossTint = (rng: Rng): [number, number, number] => [0.95 + rng() * 0.1, 1, 0.9 + rng() * 0.1];
  /** a leaf lying on the ground (the litter's variants and tints) */
  const leaf = (x: number, z: number, rng: Rng, lift = 0.004) => {
    const scale = 0.7 + rng() * 0.7;
    const tintK = 0.8 + rng() * 0.4;
    const tint = templates.leaves.tints[rng.int(0, templates.leaves.tints.length)];
    const variant = rng.int(0, leaves.variantCount);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) + lift, z, n.x, n.y, n.z, 1, yaw, scale, scale, scale);
    leaves.add(M, variant, [tint[0] * tintK, tint[1] * tintK, tint[2] * tintK]);
  };
  /** a carpet card (carpet.ts seatClump's aData: phase, stiffness, tint slot, atlas tile + dryness step with the mirror flag) on the live ground */
  const card = (x: number, z: number, rng: Rng, hk: number, tintIndex: number, dry: number) => {
    const w = (CARD_W[0] + (CARD_W[1] - CARD_W[0]) * rng()) * (0.8 + 0.45 * hash01(x, z, 1));
    const h = Math.min((CARD_H[0] + (CARD_H[1] - CARD_H[0]) * Math.pow(rng(), 1.3)) * hk * (0.7 + 0.6 * hash01(x, z, 2)), CARD_H[1] * hk);
    const tile = rng.int(0, templates.clumps.tiles);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) - CARD_SINK * (h / CARD_H[1]), z, n.x, n.y, n.z, 0.5, yaw, w, h, w);
    data[0] = rng();
    data[1] = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);
    data[2] = (tintIndex + 0.25) / 4;
    const mirror = hash01(x, z, 3) < 0.5;
    data[3] = tile + (Math.floor(dry * 16) + (mirror ? 0.75 : 0.25)) / 16;
    const hue = hash01(x, z, 4) * 2 - 1;
    const light = 1 + (hash01(x, z, 5) * 2 - 1) * 0.09;
    clumps.add(M, 0, [light * (1 + 0.07 * hue), light * (1 + 0.07 * 0.25 * Math.abs(hue)), light * (1 - 0.07 * 1.2 * hue)], data);
  };
  /** a turf mat (its first float the continuous palette position 0..3 — carpet.ts matPalettePosition — of half the tint drift, as the village's mats take it) */
  const mat = (x: number, z: number, rng: Rng, palette: number, dry: number, width = 1) => {
    const w = (MAT_W[0] + (MAT_W[1] - MAT_W[0]) * rng()) * width;
    const tile = rng.int(0, templates.mats.tiles);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) + MAT_LIFT, z, n.x, n.y, n.z, 1, yaw, w, 1, w);
    data[0] = palette;
    data[1] = 1;
    data[2] = 0.25 / 4;
    data[3] = tile + clamp(dry, 0, 0.95) * 0.6;
    mats.add(M, 0, white, data);
  };
  /** keep `set`'s new plant `minGap` m from the ones it already holds (a local scan of the tail — the passes add in spatial runs) */
  const crowded = (set: LodInstancedSet, x: number, z: number, minGap: number, tail = 400) => {
    const it = set.items;
    for (let i = Math.max(0, it.length - tail); i < it.length; i++) if (Math.hypot(it[i].x - x, it[i].z - z) < minGap) return true;
    return false;
  };

  // ---- the lawn's reach: terrain/north.ts groveLawn, the outline the terrain's grass comes back on
  const clumpNoise = new Noise2D('expansion-north/understory-clumps');
  const mottle = new Noise2D('expansion-north/lawn-tone');
  const pad = N.shelf.pads[0];
  /** the lawn's weight at (x, z) before the ground check: reach, the legacy carpet, the tread, the door, the decks' shade */
  const lawnWeight = (x: number, z: number) => {
    let w = groveLawn(x, z);
    if (w <= 0) return 0;
    w *= 1 - legacyCover(x, z);
    if (w <= 0) return 0;
    w *= 1 - smoothstep(0.1, 0.34, T.mask(x, z).path);
    w *= smoothstep(1.1, 2.6, Math.hypot(x - GROVE_DOOR[0], z - GROVE_DOOR[1]));
    const dp = Math.hypot(x - pad.x, z - pad.z);
    if (dp < pad.r) w *= 0.3 + 0.7 * smoothstep(pad.r - 0.8, pad.r, dp);
    if (groveDeckDistance(x, z) < 0.3) w *= 0.35;
    return w;
  };
  /** 1 on the shelf's yard, 0 off it (half a metre either side of its edge) */
  const onShelf = (x: number, z: number) => 1 - smoothstep(-0.5, 0.5, shelfDistance(x, z));
  /**
   * The lawn's tint drift at (x, z) (grass.ts `tn`), the one tone the blades, the mats and the
   * cards read: the yard's lighter base blended to the slopes', a slow mottle, deeper where the
   * lawn gives way to the forest floor and in the decks' shade.
   */
  const lawnTone = (x: number, z: number) => {
    const sh = onShelf(x, z);
    let tn = LAWN_TN.slopes + (LAWN_TN.shelf - LAWN_TN.slopes) * sh + LAWN_TN.mottle * mottle.fbm(x * 0.12, z * 0.12, 2);
    tn -= LAWN_TN.edge * (1 - groveLawn(x, z));
    if (groveDeckDistance(x, z) < 0.3) tn -= LAWN_TN.deck;
    return tn;
  };

  /**
   * A lawn over DBOX on the jittered CELL grid wherever `weight` > 0: a turf mat in every cell at
   * full weight (the village carpet's closed turf; none on slopes past 0.65 or on the trodden
   * ground) and clump cards at the weight. Returns the cards placed.
   */
  const lawn = (label: string, weight: (x: number, z: number) => number, opts: { dry: number; height: number }) => {
    const rng = ctx.rng.fork(`expansion-north/lawn/${label}`);
    const [x0, z0, x1, z1] = DBOX;
    const nx = Math.ceil((x1 - x0) / CELL);
    const nz = Math.ceil((z1 - z0) / CELL);
    let placed = 0;
    let matsPlaced = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = mm(x0 + (i + rng()) * CELL);
        const z = mm(z0 + (j + rng()) * CELL);
        const cw = rng();
        const mw = rng();
        const hk = 0.9 + 0.2 * rng();
        const dr = rng();
        const tg = rng.gauss();
        const wgt = weight(x, z);
        if (wgt <= 0) continue;
        const slope = groundOk(x, z, 0.1);
        if (slope < 0) continue;
        const slopeK = 1 - smoothstep(0.45, 0.7, slope);
        const tn = lawnTone(x, z);
        if (mw < Math.min(1, wgt * 1.6) * (1 - smoothstep(0.45, 0.65, slope)) * q.density && T.mask(x, z).path < 0.25) {
          mat(x, z, rng, matPalettePosition(0.5 * tn), opts.dry);
          matsPlaced++;
        }
        if (cw < wgt * slopeK * q.density) {
          card(x, z, rng, opts.height * hk, tintIndexOf(tn + 0.18 * tg), opts.dry * (0.3 + 0.7 * dr));
          placed++;
        }
      }
    }
    counts[`lawn-${label}-cards`] = placed;
    counts[`lawn-${label}-mats`] = matsPlaced;
    return placed;
  };
  lawn('slopes', (x, z) => lawnWeight(x, z) * (1 - onShelf(x, z)), { dry: 0.2, height: 1.0 });
  lawn('shelf', (x, z) => lawnWeight(x, z) * onShelf(x, z), { dry: 0.3, height: 0.8 });

  // ---- the lawn's blades: rooted tufts on BLADE_TILE tiles, the village turf's grass material
  // and encoding (grass.ts: phase, stiffness, tint slot, type + dryness step + tip tone)
  const blades = ((): GroveBlades => {
    const bases = [bladeGeometry(4, 1, 1), bladeGeometry(2, 1.3, 1), bladeGeometry(1, 1.9, 0)];
    const trisPerLod = bases.map((b) => b.index.count / 3);
    const bladeGroup = new Group();
    bladeGroup.name = 'grove-blades';
    group.add(bladeGroup);
    const tiles: GroveBladeTile[] = [];
    const typeCounts = [0, 0, 0, 0];
    const [x0, z0, x1, z1] = DBOX;
    const tuftMean = (BLADE_TUFT[0] + BLADE_TUFT[1]) / 2;
    const maxPerTile = Math.ceil(BLADE_TILE * BLADE_TILE * BLADES_PER_M2 * Math.max(q.density, 0.1) * 1.05) + BLADE_TUFT[1];
    const matrices = new Float32Array(maxPerTile * 16);
    const data = new Float32Array(maxPerTile * 4);
    let total = 0;
    for (let tz = z0; tz < z1; tz += BLADE_TILE) {
      for (let tx = x0; tx < x1; tx += BLADE_TILE) {
        const rng = ctx.rng.fork(`expansion-north/blades/${tx}/${tz}`);
        const roots = Math.round((BLADE_TILE * BLADE_TILE * BLADES_PER_M2 * q.density) / tuftMean);
        let count = 0;
        let ySum = 0;
        let yMin = Infinity;
        let yMax = -Infinity;
        let maxH = 0;
        for (let r = 0; r < roots && count + BLADE_TUFT[1] <= maxPerTile; r++) {
          const rx = tx + rng() * BLADE_TILE;
          const rz = tz + rng() * BLADE_TILE;
          const size = rng.int(BLADE_TUFT[0], BLADE_TUFT[1] + 1);
          const tuftH = 0.6 + 0.8 * rng();
          const tuftTint = rng.gauss() * 0.2;
          const tuftTip = rng();
          const draw = rng();
          const tr = rng();
          if (rx >= x1 || rz >= z1) continue;
          const wgt = lawnWeight(rx, rz);
          if (wgt <= 0 || draw > wgt) continue;
          const slope = groundOk(rx, rz, 0.06);
          if (slope < 0 || slope > 0.8) continue;
          const [nx0, ny0, nz0] = [n.x, n.y, n.z];
          const sh = onShelf(rx, rz);
          // taller, unmown grass toward the forest and along the trail's and the flight's edges
          const wild = Math.max(1 - wgt, 1 - smoothstep(0.3, 2.2, groveGroundWalk(rx, rz))) * (1 - sh);
          const meadowP = 0.05 + 0.3 * wild;
          const sedgeP = 0.06;
          const type = tr < meadowP ? 1 : tr < meadowP + sedgeP ? 2 : tr > 0.97 && wild < 0.3 ? 3 : 0;
          const tnRoot = lawnTone(rx, rz);
          const dryRoot = (0.22 + 0.2 * sh) * (type === 2 ? 0.4 : 1);
          const hk = (1 - 0.22 * sh) * (groveDeckDistance(rx, rz) < 0.3 ? 0.85 : 1);
          const tuftK = 1 + (tuftH - 1) * (1 - 0.6 * sh);
          for (let b = 0; b < size; b++) {
            const a = rng() * Math.PI * 2;
            const rad = BLADE_TUFT_R * Math.sqrt(rng());
            const hr = rng();
            const wr = rng();
            const bladeTint = rng.gauss() * 0.09;
            const dr = rng();
            const phase = rng();
            const sr = rng();
            const yaw = rng() * Math.PI * 2;
            const jx = rng.gauss() * 0.07;
            const jz = rng.gauss() * 0.07;
            const x = mm(rx + Math.cos(a) * rad);
            const z = mm(rz + Math.sin(a) * rad);
            let h: number;
            let w: number;
            if (type === 1) {
              h = 0.28 + 0.32 * hr;
              w = 0.008 + 0.008 * wr;
            } else if (type === 2) {
              h = 0.2 + 0.3 * hr;
              w = 0.024 + 0.016 * wr;
            } else if (type === 3) {
              h = 0.3 + 0.14 * Math.pow(hr, 1.4);
              w = 0.011 + 0.006 * wr;
            } else {
              h = 0.11 + 0.2 * Math.pow(hr, 1.4);
              w = 0.012 + 0.012 * wr;
            }
            h *= tuftK * hk;
            // the village lawn's spike cap (grass.ts LAWN_SPIKE_CAP) on the mown ground
            if (type !== 1) h = Math.min(h, 0.32 * tuftK + (h - 0.32 * tuftK) * wild);
            const y = T.height(x, z) - 0.012;
            composeMatrix(matrices, count * 16, x, y, z, nx0 + jx, ny0, nz0 + jz, 0.5, yaw, w, h, h);
            const o = count * 4;
            data[o] = phase;
            data[o + 1] = clamp(1 - h * (0.75 + 0.35 * sr), 0.05, 0.95);
            data[o + 2] = (tintIndexOf(tnRoot + tuftTint + bladeTint) + 0.25) / 4;
            const dry = clamp(dryRoot * (0.3 + 0.7 * dr), 0, 0.95);
            data[o + 3] = type + (Math.floor(dry * 16) + 0.02 + 0.96 * tuftTip) / 16;
            count++;
            typeCounts[type]++;
            ySum += y;
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
            maxH = Math.max(maxH, h);
          }
        }
        if (count === 0) continue;
        total += count;
        const aData = new InstancedBufferAttribute(data.slice(0, count * 4), 4);
        const lods = bases.map((b) => {
          const g = new BufferGeometry();
          g.setAttribute('position', b.position);
          g.setAttribute('uv', b.uv);
          g.setAttribute('normal', b.normal);
          g.setAttribute('aNear', b.near);
          g.setAttribute('aData', aData);
          g.setIndex(b.index);
          g.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), 1.5);
          return g;
        });
        const mesh = new InstancedMesh(lods[1], bladeMaterial, count);
        mesh.instanceMatrix.array.set(matrices.subarray(0, count * 16));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.name = `grove-blades-${tx}-${tz}`;
        const mx = tx + BLADE_TILE / 2;
        const mz = tz + BLADE_TILE / 2;
        mesh.boundingSphere = new Sphere(new Vector3(mx, ySum / count + maxH * 0.5, mz), Math.hypot(BLADE_TILE * 0.71, (yMax - yMin) * 0.5 + maxH) + 0.35);
        mesh.visible = false;
        bladeGroup.add(mesh);
        tiles.push({ mesh, lods, lod: 1, mx, mz, count });
      }
    }
    const halfDiag = BLADE_TILE * 0.71;
    const visible = { drawCalls: 0, triangles: 0, lodCounts: [0, 0, 0] };
    return {
      tiles,
      count: total,
      typeCounts,
      visible,
      update(camPos: Vector3) {
        visible.drawCalls = 0;
        visible.triangles = 0;
        visible.lodCounts = [0, 0, 0];
        const d0 = BLADE_LOD_M[0] * q.distance;
        const d1 = BLADE_LOD_M[1] * q.distance;
        for (const t of tiles) {
          const d = Math.hypot(camPos.x - t.mx, camPos.z - t.mz) - halfDiag;
          const lod = d < d0 ? 0 : 1;
          if (lod !== t.lod) {
            t.lod = lod;
            t.mesh.geometry = t.lods[lod];
          }
          t.mesh.visible = d < d1;
          if (t.mesh.visible) {
            visible.drawCalls++;
            visible.triangles += t.count * trisPerLod[lod];
            visible.lodCounts[lod]++;
          }
        }
      },
      dispose() {
        for (const t of tiles) {
          t.mesh.dispose();
          for (const g of t.lods) g.dispose();
        }
      },
    };
  })();
  Object.assign(counts, { blades: blades.count, bladeTiles: blades.tiles.length });

  // ---- the trail's verges: tufts leaning in over the trodden edge, leaves in the angles, ferns
  // further out; the flight's cheeks the same with moss at the treads' ends
  {
    const rng = ctx.rng.fork('expansion-north/verges');
    let vergeTufts = 0;
    let vergeLeaves = 0;
    let vergeFerns = 0;
    const line = N.trail;
    for (let i = 0; i + 1 < line.length; i++) {
      const [x0, , z0] = line[i];
      const [x1, , z1] = line[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const tx = (x1 - x0) / len;
      const tz = (z1 - z0) / len;
      for (let s = rng() * 0.45; s < len; s += 0.45) {
        for (const side of [-1, 1]) {
          for (let k = 0; k < 2; k++) {
            const out = 0.7 + Math.pow(rng(), 1.4) * 0.65;
            const x = mm(x0 + tx * s - tz * side * out);
            const z = mm(z0 + tz * s + tx * side * out);
            const scale = 0.45 + rng() * 0.55;
            const c = greenVar(rng, 0.16);
            if (T.mask(x, z).path > 0.3 || groundOk(x, z, 0.05) < 0) continue;
            const lean = 1 - smoothstep(0.7, 1.1, out);
            n.x += tz * side * 0.9 * lean;
            n.z -= tx * side * 0.9 * lean;
            n.normalize();
            plant(tufts, x, z, rng, scale, 0.6, 0.01, c);
            vergeTufts++;
          }
          {
            const out = 0.35 + rng() * 0.9;
            const x = mm(x0 + tx * s - tz * side * out);
            const z = mm(z0 + tz * s + tx * side * out);
            if (groundOk(x, z, 0.05) >= 0) {
              leaf(x, z, rng);
              vergeLeaves++;
            }
          }
          if (rng() < 0.26) {
            const out = 1.9 + rng() * 1.7;
            const x = mm(x0 + tx * s - tz * side * out);
            const z = mm(z0 + tz * s + tx * side * out);
            const scale = 0.55 + rng() * 0.45;
            const c = greenVar(rng, 0.2);
            const slope = groundOk(x, z, 0.3);
            if (slope < 0 || slope > 0.7 || groveGroundWalk(x, z) < 0.6 || crowded(ferns, x, z, 0.8)) continue;
            plant(ferns, x, z, rng, scale, 0.6, 0.02, c);
            vergeFerns++;
          }
        }
      }
    }
    let cheekTufts = 0;
    let cheekMoss = 0;
    for (let u = -0.3; u < FL.run + 0.4; u += 0.28) {
      for (const side of [-1, 1]) {
        const v = side * (FL.hw + 0.08 + Math.pow(rng(), 1.5) * 0.5);
        const x = mm(FLIGHT.base[0] + FL.dx * u - FL.dz * v);
        const z = mm(FLIGHT.base[2] + FL.dz * u + FL.dx * v);
        const kind = rng();
        const scale = 0.45 + rng() * 0.5;
        const c = greenVar(rng, 0.16);
        const slope = groundOk(x, z, 0.05);
        if (slope < 0 || slope > 0.8) continue;
        if (kind < 0.3 && Math.abs(v) < FL.hw + 0.3) {
          cushion(x, z, rng, 0.07 + scale * 0.1, mossTint(rng));
          cheekMoss++;
        } else {
          n.x += FL.dz * side * 0.6;
          n.z -= FL.dx * side * 0.6;
          n.normalize();
          plant(tufts, x, z, rng, scale, 0.6, 0.01, c);
          cheekTufts++;
        }
      }
    }
    Object.assign(counts, { vergeTufts, vergeLeaves, vergeFerns, cheekTufts, cheekMoss });
  }

  // ---- the shelf's rim: its cut bank (ground above the yard) under ferns, tufts and moss, its lip
  // (the fill falling away) under tufts rolling over the edge
  {
    const rng = ctx.rng.fork('expansion-north/shelf-rim');
    const S = N.shelf;
    const box: [number, number, number, number] = [S.cx - S.hx - S.edge - 0.6, S.cz - S.hz - S.edge - 0.6, Math.max(S.cx + S.hx, pad.x + pad.r) + S.edge + 0.6, Math.max(S.cz + S.hz, pad.z + pad.r) + S.edge + 0.6];
    const grad = { x: 0, z: 0 };
    let bankFerns = 0;
    let bankTufts = 0;
    let bankMoss = 0;
    let lipTufts = 0;
    let lipFerns = 0;
    const candidates = Math.round((box[2] - box[0]) * (box[3] - box[1]) * 3.2);
    for (let i = 0; i < candidates; i++) {
      const x = mm(box[0] + rng() * (box[2] - box[0]));
      const z = mm(box[1] + rng() * (box[3] - box[1]));
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.2);
      const sd = shelfDistance(x, z, grad);
      if (sd < -0.35 || sd > S.edge + 0.2) continue;
      if (T.mask(x, z).path > 0.2) continue;
      const slope = groundOk(x, z, 0.12);
      if (slope < 0) continue;
      const rise = T.height(x, z) - S.y;
      if (rise > 0.18 && sd > 0.05) {
        if (kind < 0.3) {
          if (slope > 0.85 || crowded(ferns, x, z, 0.7)) continue;
          plant(ferns, x, z, rng, 0.5 + scale * 0.45, 0.45, 0.03, c);
          bankFerns++;
        } else if (kind < 0.58) {
          if (slope > 0.8) continue;
          n.x -= grad.x * 0.5;
          n.z -= grad.z * 0.5;
          n.normalize();
          plant(tufts, x, z, rng, 0.5 + scale * 0.5, 0.65, 0.01, c);
          bankTufts++;
        } else if (kind < 0.76) {
          if (slope > 0.7) continue;
          cushion(x, z, rng, 0.09 + scale * 0.18, mossTint(rng));
          bankMoss++;
        }
      } else if (rise < -0.08) {
        if (kind < 0.55) {
          n.x += grad.x * 0.8;
          n.z += grad.z * 0.8;
          n.normalize();
          plant(tufts, x, z, rng, 0.5 + scale * 0.55, 0.75, 0.01, c);
          lipTufts++;
        } else if (kind < 0.66 && slope < 0.6 && !crowded(ferns, x, z, 0.7)) {
          plant(ferns, x, z, rng, 0.5 + scale * 0.4, 0.55, 0.03, c);
          lipFerns++;
        }
      } else if (kind < 0.35) {
        plant(tufts, x, z, rng, 0.45 + scale * 0.45, 0.6, 0.01, c);
        lipTufts++;
      }
    }
    Object.assign(counts, { bankFerns, bankTufts, bankMoss, lipTufts, lipFerns });
  }

  // ---- the understory: ferns, bushes, fern crowns, weeds and moss in clumps round the walks, and
  // under the raised decks (out of reach, in their shade) ferns and moss only
  {
    const rng = ctx.rng.fork('expansion-north/understory');
    const [x0, z0, x1, z1] = DBOX;
    let usFerns = 0;
    let usHero = 0;
    let usBushes = 0;
    let usWeeds = 0;
    let usMoss = 0;
    let usTufts = 0;
    let deckFerns = 0;
    let deckHero = 0;
    let deckMoss = 0;
    const candidates = Math.round((x1 - x0) * (z1 - z0) * 1.3);
    for (let i = 0; i < candidates; i++) {
      const x = mm(x0 + rng() * (x1 - x0));
      const z = mm(z0 + rng() * (z1 - z0));
      const kind = rng();
      const draw = rng();
      const scale = rng();
      const c = greenVar(rng, 0.2);
      const gw = groveGroundWalk(x, z);
      if (gw < 1.3) continue;
      const under = groveDeckDistance(x, z) < 0.5;
      const clump = 0.5 + 0.5 * clumpNoise.fbm(x * 0.15, z * 0.15, 2);
      let wgt = smoothstep(1.3, 3.4, gw) * (1 - smoothstep(DRESS_M - 4, DRESS_M, gw)) * clamp(clump * 1.25, 0, 1);
      if (under) wgt = Math.max(wgt, 0.85);
      wgt *= terrace(z);
      if (draw > wgt * q.density) continue;
      const slope = groundOk(x, z, 0.3);
      if (slope < 0 || slope > 0.72) continue;
      if (under) {
        if (kind < 0.5) {
          if (crowded(ferns, x, z, 0.75)) continue;
          plant(ferns, x, z, rng, 0.6 + scale * 0.5, 0.5, 0.03, c);
          deckFerns++;
        } else if (kind < 0.68) {
          if (crowded(heroFerns, x, z, 1.6, 200)) continue;
          plant(heroFerns, x, z, rng, 0.7 + scale * 0.4, 0.35, 0.03, c);
          deckHero++;
        } else if (kind < 0.9) {
          cushion(x, z, rng, 0.12 + scale * 0.22, mossTint(rng));
          deckMoss++;
        }
        continue;
      }
      if (kind < 0.16) {
        if (gw < 2.6 || slope > 0.55 || crowded(bushes, x, z, 1.5)) continue;
        plant(bushes, x, z, rng, 0.62 + scale * 0.42, 0.3, 0.05, greenVar(rng, 0.12));
        usBushes++;
      } else if (kind < 0.5) {
        if (crowded(ferns, x, z, 0.7)) continue;
        plant(ferns, x, z, rng, 0.6 + scale * 0.5, 0.55, 0.03, c);
        usFerns++;
      } else if (kind < 0.55) {
        if (gw > 9 || crowded(heroFerns, x, z, 1.8, 200)) continue;
        plant(heroFerns, x, z, rng, 0.72 + scale * 0.4, 0.4, 0.03, c);
        usHero++;
      } else if (kind < 0.63) {
        plant(weeds, x, z, rng, 0.6 + scale * 0.5, 0.6, 0.01, greenVar(rng, 0.14));
        usWeeds++;
      } else if (kind < 0.74) {
        cushion(x, z, rng, 0.1 + scale * 0.24, mossTint(rng));
        usMoss++;
      } else if (kind < 0.86) {
        plant(tufts, x, z, rng, 0.5 + scale * 0.55, 0.6, 0.01, c);
        usTufts++;
      }
    }
    Object.assign(counts, { usFerns, usHero, usBushes, usWeeds, usMoss, usTufts, deckFerns, deckHero, deckMoss });
  }

  // ---- the built feet: a ring of ferns, tufts and moss round each (inside `r0` is the footprint)
  {
    const rng = ctx.rng.fork('expansion-north/feet');
    const H = N.house;
    const doorA = Math.atan2(H.facing[1], H.facing[0]);
    const feet: { id: string; x: number; z: number; r0: number; r1: number; n: number; skip?: (a: number) => boolean }[] = [
      ...stiltFeet().map(([x, z], i) => ({ id: `stilt-${i}`, x, z, r0: 0.45, r1: 1.3, n: 9 })),
      { id: 'stump', x: N.stilt.host[0], z: N.stilt.host[1], r0: STILT_STUMP.foot + 0.15, r1: STILT_STUMP.foot + 1.2, n: 14 },
      ...gangwayTrestleFeet().map(([x, z], i) => ({ id: `trestle-${i}`, x, z, r0: 0.3, r1: 0.9, n: 5 })),
      { id: 'column', x: N.hut.host[0], z: N.hut.host[1], r0: N.column.baseRadius + 0.95, r1: N.column.baseRadius + 2.5, n: 30 },
      ...N.lanternPosts.map((p) => ({ id: p.id, x: p.position[0], z: p.position[1], r0: 0.3, r1: 0.95, n: 8 })),
      { id: 'sign', x: N.signpost.position[0], z: N.signpost.position[2], r0: 0.28, r1: 0.85, n: 6 },
      // the trunk house's roots: all round but the door's front and the yard's side of it
      { id: 'house', x: H.position[0], z: H.position[2], r0: H.trunkRadius + 1.15, r1: H.trunkRadius + 2.2, n: 34, skip: (a: number) => Math.abs(Math.atan2(Math.sin(a - doorA), Math.cos(a - doorA))) < 1.05 },
    ];
    let feetFerns = 0;
    let feetTufts = 0;
    let feetMoss = 0;
    for (const f of feet) {
      for (let k = 0; k < f.n; k++) {
        const a = rng() * Math.PI * 2;
        const r = f.r0 + Math.pow(rng(), 1.3) * (f.r1 - f.r0);
        const kind = rng();
        const scale = rng();
        const c = greenVar(rng, 0.18);
        if (f.skip?.(a)) continue;
        const x = mm(f.x + Math.cos(a) * r);
        const z = mm(f.z + Math.sin(a) * r);
        if (T.mask(x, z).path > 0.2) continue;
        const slope = groundOk(x, z, 0.08);
        if (slope < 0 || slope > 0.75) continue;
        if (kind < 0.34 && r > f.r0 + 0.2) {
          if (crowded(ferns, x, z, 0.55)) continue;
          plant(ferns, x, z, rng, 0.5 + scale * 0.45, 0.55, 0.03, c);
          feetFerns++;
        } else if (kind < 0.7) {
          plant(tufts, x, z, rng, 0.5 + scale * 0.55, 0.62, 0.01, c);
          feetTufts++;
        } else {
          cushion(x, z, rng, 0.08 + scale * 0.16, mossTint(rng));
          feetMoss++;
        }
      }
    }
    Object.assign(counts, { feetFerns, feetTufts, feetMoss });
  }

  // ---- flower clumps where the lawn is full (off the trodden ground), purple or white
  {
    const rng = ctx.rng.fork('expansion-north/flowers');
    const [x0, z0, x1, z1] = DBOX;
    let clumpsPlaced = 0;
    let blooms = 0;
    for (let attempt = 0; attempt < 400 && clumpsPlaced < 18; attempt++) {
      const cx = x0 + rng() * (x1 - x0);
      const cz = z0 + rng() * (z1 - z0);
      const white = rng() < 0.35;
      const count = 4 + rng.int(0, 6);
      if (lawnWeight(cx, cz) < 0.6 || T.mask(cx, cz).path > 0.05) continue;
      clumpsPlaced++;
      for (let k = 0; k < count; k++) {
        const a = rng() * Math.PI * 2;
        const r = Math.pow(rng(), 0.8) * 0.85;
        const scale = 0.7 + rng() * 0.45;
        const x = mm(cx + Math.cos(a) * r);
        const z = mm(cz + Math.sin(a) * r);
        if (T.mask(x, z).path > 0.1) continue;
        const slope = groundOk(x, z, 0.1);
        if (slope < 0 || slope > 0.55) continue;
        plant(white ? whiteFlowers : flowers, x, z, rng, scale, 0.5, 0.01, greenVar(rng, 0.1));
        blooms++;
      }
    }
    Object.assign(counts, { flowerClumps: clumpsPlaced, flowers: blooms });
  }

  // ---- leaves over the forest floor (thin on the lawn), thick under the column's crown
  {
    const rng = ctx.rng.fork('expansion-north/litter');
    const [x0, z0, x1, z1] = DBOX;
    let litter = 0;
    const candidates = Math.round((x1 - x0) * (z1 - z0) * 1.1);
    for (let i = 0; i < candidates; i++) {
      const x = mm(x0 + rng() * (x1 - x0));
      const z = mm(z0 + rng() * (z1 - z0));
      const draw = rng();
      const gw = groveGroundWalk(x, z);
      const crown = 1 - smoothstep(2.5, 6.5, Math.hypot(x - N.hut.host[0], z - N.hut.host[1]));
      let wgt = smoothstep(0.8, 2.6, gw) * (1 - smoothstep(DRESS_M - 3, DRESS_M + 1, gw)) * (1 - 0.7 * lawnWeight(x, z));
      wgt = Math.max(wgt, crown * 0.8) * terrace(z);
      if (draw > wgt * q.density) continue;
      if (groundOk(x, z, 0.05) < 0) continue;
      leaf(x, z, rng);
      litter++;
    }
    counts['litter-leaves'] = litter;
  }

  for (const set of sets) group.add(set.build());

  // ---- the locality's spheres: the placed plants binned on a 4 m grid, each cell a sphere from its
  // lowest seat to its tallest plant's reach
  const bins = new Map<string, { x: number; z: number; y0: number; y1: number }>();
  for (const set of sets) {
    for (const it of set.items) {
      const key = `${Math.floor(it.x / 4)},${Math.floor(it.z / 4)}`;
      const b = bins.get(key);
      const top = it.y + (it.reach || 1);
      if (b) {
        b.y0 = Math.min(b.y0, it.y);
        b.y1 = Math.max(b.y1, top);
      } else bins.set(key, { x: (Math.floor(it.x / 4) + 0.5) * 4, z: (Math.floor(it.z / 4) + 0.5) * 4, y0: it.y, y1: top });
    }
  }
  const spheres: Sphere[] = [...bins.values()].map((b) => new Sphere(new Vector3(b.x, (b.y0 + b.y1) / 2, b.z), Math.hypot(2 * Math.SQRT2, (b.y1 - b.y0) / 2) + 0.8));
  counts.spheres = spheres.length;
  return { group, sets, spheres, counts, blades };
}
