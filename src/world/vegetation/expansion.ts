/**
 * Round 50 (vegetation-27) — the vegetation's side of the round-49 expansion (layout `EXPANSION`:
 * the fence-topped south bank and its flight, the stepping discs west / south-west of the plaza,
 * the west tree-house on the ledge, the far hut's knoll).
 *
 * Two halves:
 *
 *  1. **The legacy streams' buried instances.** Every disc stream (grass tiles, carpet, plants,
 *     litter) builds against the heightfield's LEGACY view (src/world/index.ts), so its
 *     rejection-sampled candidates read the numbers take-0121 read and no placement in the six
 *     fixed frames re-rolls. Inside the expansion's footprints the rendered ground is the LIVE
 *     view: the bank's body stands 1.6–1.9 m over the legacy plain, the knoll 1.4 m, the discs are
 *     paving, the flights' trenches cut the plain — so a legacy-placed blade there is buried or
 *     floats (expansion-2's audit: grass 8 / 400 samples, litter 10 / 400, ferns 2 / 176,
 *     flowers 4 / 137, clump cards 8 / 399, turf mats 8 / 654, worst 1.77 m under the bank).
 *     `expansionCull` (heightfield.ts) says where; the builders apply it AFTER their passes as a
 *     filter — `pruneExpansion` for the lodset.ts sets, `compactExpansionBlades` for a blade
 *     tile's instance streams — so nothing re-rolls and the six frames keep every instance they
 *     show. `tileMeetsExpansion` skips the tiles that cannot hold one (the filter is a bounds test
 *     per instance anyway, but the tiles' arrays are large).
 *
 *  2. **The expansion's own ground**, dressed in a LIVE-view pass (`buildExpansionVegetation`):
 *     turf and flowers on the bank's flat top, tufts and moss at its toe and on the flight's
 *     cheeks, grass and litter along the two stepping-stone paths, a fern / shrub verge under the
 *     west tree-house, turf on the knoll. Its own lodset.ts sets under one group that
 *     `vegetation/index.ts` shows only when the camera can see the locality
 *     (util/expansionLocality.ts: within 60 m of the box AND the frustum meets one of the
 *     content's spheres or their shadow footprints) — the six fixed cameras never do, so they
 *     pay neither a draw nor a triangle for it (the W38 budget at A). Seeded forks
 *     (`expansion/…`); the geometry, materials and wind of the disc sets they mirror.
 */
import { Group, Sphere, Vector3, type Material } from 'three';
import type { BufferGeometry } from 'three';
import { EXPANSION, EXPANSION_BOX, EXPANSION_NPC_SPOTS, EXPANSION_ROPE_FENCES, EXPANSION_RUINS_BOXES, EXPANSION_SOUTH_BOXES, EXPANSION_STAIRS, expansionSteppingStones, southBankFrameVectors, southBankPoint } from '../layout';
import type { WorldContext } from '../system';
import { expansionCull, getTerrain, type Terrain } from '../terrain/heightfield';
import { clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { casterSpheres, expansionCasters, sunVector, type Caster } from '../util/expansionLocality';
import { composeMatrix } from './field';
import { LodInstancedSet } from './lodset';

/** the far hut's knoll (layout `farHutRise`) as a box, with `expansionCull`'s half-metre margin */
const KNOLL_BOX = (() => {
  const [hx, hz] = EXPANSION.farHut.host;
  const r = EXPANSION.farHutRise.radius + 0.5;
  return { x0: hx - r, x1: hx + r, z0: hz - r, z1: hz + r };
})();

/** true when the world box [x0, z0] … [x1, z1] overlaps the expansion box, the knoll's, one of round 56's south boxes or round 57's ruins boxes — where `expansionCull` can be true */
export function tileMeetsExpansion(x0: number, z0: number, x1: number, z1: number): boolean {
  const meets = (b: { x0: number; x1: number; z0: number; z1: number }) => x1 >= b.x0 && x0 <= b.x1 && z1 >= b.z0 && z0 <= b.z1;
  return meets(EXPANSION_BOX) || meets(KNOLL_BOX) || EXPANSION_SOUTH_BOXES.some(meets) || EXPANSION_RUINS_BOXES.some(meets);
}

/** true where a legacy-placed instance at (x, z) stands in the expansion (heightfield.ts `expansionCull`) */
export const buriedInExpansion = (x: number, z: number): boolean => expansionCull(x, z);

/**
 * Drop every item of `sets` that `expansionCull` flags (before `build`). Returns how many went,
 * per set name — the audit reports them (`expansionCulled`). The ruins' share (round 57) goes
 * last, with the packs' sort centres pinned to the list as the rules before it leave it, so the
 * six fixed frames draw their plants in the same order as before the ruins.
 */
export function pruneExpansion(sets: LodInstancedSet[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const set of sets) {
    let removed = set.prune((it) => expansionCull(it.x, it.z, 0.3, false));
    set.pinSortCentres();
    removed += set.prune((it) => expansionCull(it.x, it.z));
    if (removed) out[set.opts.name] = removed;
  }
  return out;
}

/**
 * Compact a blade tile's instance streams (`matrices` 16 floats, `data` 4 floats per blade, the
 * first `count` blades) to the blades `expansionCull` keeps, in their original order. Returns the
 * kept count; the dropped blades are reported through `dropped` (blade type, height, seat y) so
 * the caller can undo their share of its statistics.
 */
export function compactExpansionBlades(
  matrices: Float32Array,
  data: Float32Array,
  count: number,
  dropped?: (type: number, height: number, y: number, why: 'expansion' | 'terrace') => void,
  /** round 50 (edges.ts): a second drop — the C bank's riser bands thin their blades so the soil shows */
  alsoDrop?: (x: number, z: number) => boolean,
  /** 2026-09-23 (grass.ts VERGE_NEAR_M): a per-blade flag stream compacted with the two above */
  flags?: Uint8Array,
): number {
  let kept = 0;
  for (let i = 0; i < count; i++) {
    const mo = i * 16;
    const why = expansionCull(matrices[mo + 12], matrices[mo + 14]) ? 'expansion' : alsoDrop?.(matrices[mo + 12], matrices[mo + 14]) ? 'terrace' : null;
    if (why) {
      // the blade's height is its y-axis scale (field.ts composeMatrix: column 1 = up × h); its
      // type the integer part of the type slot (grass.ts)
      dropped?.(Math.floor(data[i * 4 + 3] + 1e-6), Math.hypot(matrices[mo + 4], matrices[mo + 5], matrices[mo + 6]), matrices[mo + 13], why);
      continue;
    }
    if (kept !== i) {
      matrices.copyWithin(kept * 16, mo, mo + 16);
      data.copyWithin(kept * 4, i * 4, i * 4 + 4);
      if (flags) flags[kept] = flags[i];
    }
    kept++;
  }
  return kept;
}

/** an audit sample list ([x, y, z] triples) less the buried ones */
export function filterExpansionSamples(samples: number[][]): number[][] {
  return samples.filter((p) => !expansionCull(p[0], p[2]));
}

// ---------------------------------------------------------------------------------------------
// 2. the expansion's own ground

/** what the disc sets lend the expansion sets: a set's geometry variants, material, shadow materials and LOD rule */
export interface SetTemplate {
  variants: BufferGeometry[][];
  material: Material;
  shadowMaterials?: { depth: Material; distance: Material };
  lodDistances: number[];
  maxDistance?: number;
  castShadowLods: number;
  nearLods?: number;
  packs?: LodInstancedSet['opts']['packs'];
  instanceData?: { attribute: string; size: number };
  cullPad?: number;
}

/** a disc set's template: everything of its options but its name, its `cull` rule and its own instances */
export function templateOf(set: LodInstancedSet): SetTemplate {
  const o = set.opts;
  return { variants: o.variants, material: o.material, shadowMaterials: o.shadowMaterials, lodDistances: o.lodDistances, maxDistance: o.maxDistance, castShadowLods: o.castShadowLods ?? 0, nearLods: o.nearLods, packs: o.packs, instanceData: o.instanceData, cullPad: o.cullPad };
}

export interface ExpansionTemplates {
  tufts: SetTemplate;
  ferns: SetTemplate;
  moss: SetTemplate;
  flowers: SetTemplate;
  whiteFlowers: SetTemplate;
  bushes: SetTemplate;
  weeds: SetTemplate;
  /** the carpet's clump cards and turf mats (carpet.ts), with the atlas tile counts their type slot indexes */
  clumps: SetTemplate & { tiles: number };
  mats: SetTemplate & { tiles: number };
  /** the litter's leaves (litter.ts): the variants and the leaf tints */
  leaves: SetTemplate & { tints: [number, number, number][] };
}

export interface ExpansionVegetation {
  group: Group;
  sets: LodInstancedSet[];
  /** the locality's spheres for util/expansionLocality.ts `expansionVisible` */
  spheres: Sphere[];
  /** what every pass seated (the audit reports them beside the sets' counts) */
  counts: Record<string, number>;
}

/** the bank's flat top: lip frame coordinates (u along the lip from its centre, v down the face; v < 0 is onto the top) */
const BANK_TOP_V: readonly [number, number] = [-3.1, -0.35];
/** the face band (v from the lip toward the toe) and the toe band below it */
const BANK_FACE_V: readonly [number, number] = [0.1, 2.3];
const BANK_TOE_V: readonly [number, number] = [2.2, 3.4];
/** the flight's cheeks: metres beside the treads (stair-local) where the moss sits */
const CHEEK_OUT: readonly [number, number] = [0.05, 0.75];
/** grass / litter verge along the paths: metres from a disc's rim */
const PATH_VERGE: readonly [number, number] = [0.06, 0.9];
/** the west tree-house's verge: metres from the bole's published footprint */
const HOUSE_VERGE: readonly [number, number] = [0.3, 3.2];
/** the knoll's turf reach (layout `farHutRise.radius`) */
const KNOLL_R = EXPANSION.farHutRise.radius;
/** carpet card / mat footprints (carpet.ts CLUMP_WIDTH / CLUMP_HEIGHT / MAT_WIDTH) */
const CARD_W: readonly [number, number] = [0.42, 0.62];
const CARD_H: readonly [number, number] = [0.19, 0.32];
const MAT_W: readonly [number, number] = [0.9, 1.2];
const MAT_LIFT = 0.018;
const CARD_SINK = 0.03;
/** the card / mat grid pitch (carpet.ts CLUMP_CELL / MAT_CELL) */
const CELL = 0.42;

/** 0..1 position hash (mm-quantised seats) */
const hash01 = (x: number, z: number, salt = 0) => {
  let h = (Math.imul(Math.round(x * 1000) + salt * 7919, 374761393) + Math.imul(Math.round(z * 1000), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mm = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Build the expansion's vegetation. `templates` are the disc sets' geometry / material / LOD
 * rules (plants.ts, carpet.ts, litter.ts hand them over), so an expansion fern is a disc fern in
 * every respect but its seat and its set.
 */
export function buildExpansionVegetation(ctx: WorldContext, templates: ExpansionTemplates, parent: Group): ExpansionVegetation {
  const T: Terrain = getTerrain();
  const q = ctx.quality;
  const group = new Group();
  group.name = 'expansion';
  parent.add(group);
  const counts: Record<string, number> = {};

  const mk = (name: string, t: SetTemplate) =>
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
      packs: t.packs,
      instanceData: t.instanceData,
      cullPad: t.cullPad,
    });
  const tufts = mk('tufts-expansion', templates.tufts);
  const ferns = mk('ferns-expansion', templates.ferns);
  const moss = mk('moss-expansion', templates.moss);
  const flowers = mk('flowers-expansion', templates.flowers);
  const whiteFlowers = mk('flowers-white-expansion', templates.whiteFlowers);
  const bushes = mk('bushes-expansion', templates.bushes);
  const weeds = mk('weeds-expansion', templates.weeds);
  const clumps = mk('grass-clumps-expansion', templates.clumps);
  const mats = mk('turf-mats-expansion', templates.mats);
  const leaves = mk('litter-leaves-expansion', templates.leaves);
  const sets = [mats, clumps, tufts, weeds, moss, ferns, flowers, whiteFlowers, bushes, leaves];

  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const n = new Vector3();
  const white: [number, number, number] = [1, 1, 1];
  const { lip, face } = southBankFrameVectors();
  const B = EXPANSION.southBank;
  /** lip-frame coordinates of a world point */
  const bankLocal = (x: number, z: number) => {
    const dx = x - B.x;
    const dz = z - B.z;
    return { u: dx * lip[0] + dz * lip[1], v: dx * face[0] + dz * face[1] };
  };
  const discs = expansionSteppingStones();
  const discDistance = (x: number, z: number) => {
    let best = Infinity;
    for (const d of discs) best = Math.min(best, Math.hypot(x - d.x, z - d.z) - d.r);
    return best;
  };
  const fencePosts = EXPANSION_ROPE_FENCES.flatMap((f) => f.points.map((p) => [p[0], p[2]] as const));
  const stairLocal = (s: (typeof EXPANSION_STAIRS)[number], x: number, z: number) => {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    const dx = s.dir[0] / l;
    const dz = s.dir[1] / l;
    const rx = x - s.base[0];
    const rz = z - s.base[2];
    return { u: rx * dx + rz * dz, v: -rx * dz + rz * dx, run: s.steps * s.tread, half: s.width / 2 };
  };
  const propFootprints = ctx.shared?.propFootprints ?? [];
  const W = EXPANSION.westHouse;
  const deck = W.deckEnd;

  /**
   * Ground rules every expansion seat obeys: the live mask (no paving, stairs, structure pad,
   * cliff), clear of the fence posts, the Kokiri's spot, the west flight's landing under the deck,
   * the props' footprints. Returns the seat's slope or −1.
   */
  const groundOk = (x: number, z: number, pad = 0.25): number => {
    const m = T.mask(x, z);
    if (m.path > 0.3 || m.stairs > 0.2 || m.structure > 0.3 || m.cliff > 0.7) return -1;
    if (discDistance(x, z) < pad) return -1;
    for (const [fx, fz] of fencePosts) if (Math.hypot(x - fx, z - fz) < 0.22) return -1;
    for (const s of EXPANSION_NPC_SPOTS) if (Math.hypot(x - s.position[0], z - s.position[2]) < 0.55) return -1;
    if (Math.hypot(x - deck[0], z - deck[2]) < 0.7) return -1;
    for (const f of propFootprints) if ((x - f.x) ** 2 + (z - f.z) ** 2 < (f.r + 0.05) ** 2) return -1;
    T.normal(x, z, n);
    return 1 - clamp(n.y, 0, 1);
  };

  /** seat a standing plant of `set` at (x, z): terrain contact, tilt toward the normal, yaw from the stream */
  const plant = (set: LodInstancedSet, x: number, z: number, rng: Rng, scale: number, tilt: number, sink: number, color: [number, number, number], sxz = scale) => {
    const y = T.height(x, z) - sink;
    composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, tilt, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(0, set.variantCount), color);
  };
  const greenVar = (rng: Rng, amount = 0.14): [number, number, number] => [1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2];
  /** a moss cushion of `radius` m (plants.ts placeMossWith: the unit dome is 0.45 tall, flattened to 0.22–0.42 × the radius, a little longer one way) */
  const cushion = (x: number, z: number, rng: Rng, radius: number, color: [number, number, number]) => {
    const h = radius * (0.22 + rng() * 0.2);
    composeMatrix(M, 0, x, T.height(x, z) - 0.012, z, n.x, n.y, n.z, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
    moss.add(M, rng.int(0, moss.variantCount), color);
  };

  /**
   * A carpet card (the clump cards' aData encoding: phase, stiffness, tint slot, atlas tile +
   * dryness step with the mirror flag — carpet.ts seatClump) and a mat under it, both on the live
   * ground. `tintIndex` 0..3 is the blade palette entry (1–2 the lawn), `dry` 0..0.95.
   */
  const card = (x: number, z: number, rng: Rng, hk: number, tintIndex: number, dry: number) => {
    const w = (CARD_W[0] + (CARD_W[1] - CARD_W[0]) * rng()) * (0.8 + 0.45 * hash01(x, z, 1));
    const h = Math.min((CARD_H[0] + (CARD_H[1] - CARD_H[0]) * Math.pow(rng(), 1.3)) * hk * (0.7 + 0.6 * hash01(x, z, 2)), CARD_H[1] * hk);
    const tile = rng.int(0, templates.clumps.tiles);
    const yaw = rng() * Math.PI * 2;
    const y = T.height(x, z) - CARD_SINK * (h / CARD_H[1]);
    composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, 0.5, yaw, w, h, w);
    data[0] = rng();
    data[1] = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);
    data[2] = (tintIndex + 0.25) / 4;
    const mirror = hash01(x, z, 3) < 0.5;
    data[3] = tile + (Math.floor(dry * 16) + (mirror ? 0.75 : 0.25)) / 16;
    const hue = hash01(x, z, 4) * 2 - 1;
    const light = 1 + (hash01(x, z, 5) * 2 - 1) * 0.09;
    clumps.add(M, 0, [light * (1 + 0.07 * hue), light * (1 + 0.07 * 0.25 * Math.abs(hue)), light * (1 - 0.07 * 1.2 * hue)], data);
  };
  const mat = (x: number, z: number, rng: Rng, palette: number, dry: number, width = 1) => {
    const w = (MAT_W[0] + (MAT_W[1] - MAT_W[0]) * rng()) * width;
    const tile = rng.int(0, templates.mats.tiles);
    const yaw = rng() * Math.PI * 2;
    const y = T.height(x, z) + MAT_LIFT;
    composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, 1, yaw, w, 1, w);
    // a mat's first float is its continuous palette position 0..3 (carpet.ts matPalettePosition)
    data[0] = palette;
    data[1] = 1;
    data[2] = 0.25 / 4;
    data[3] = tile + clamp(dry, 0, 0.95) * 0.6;
    mats.add(M, 0, white, data);
  };

  /**
   * A lawn over a region: cards and mats on the jittered CELL grid of the region's box wherever
   * `weight(x, z)` > 0 (0..1: the card density; the mats close the ground at weight ≥ 0.35),
   * tufts at `tuftsPerM2`, then the herbs `extra` seats.
   */
  const lawn = (label: string, box: readonly [number, number, number, number], weight: (x: number, z: number) => number, opts: { tuftsPerM2: number; tint: number; dry: number; height: number; tuftHeight?: readonly [number, number]; matWidth?: number }) => {
    const rng = ctx.rng.fork(`expansion/lawn/${label}`);
    const nx = Math.ceil((box[2] - box[0]) / CELL);
    const nz = Math.ceil((box[3] - box[1]) / CELL);
    let placed = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = mm(box[0] + (i + rng()) * CELL);
        const z = mm(box[1] + (j + rng()) * CELL);
        const cw = rng();
        const mw = rng();
        const wgt = weight(x, z);
        if (wgt <= 0) continue;
        const slope = groundOk(x, z, 0.14);
        if (slope < 0) continue;
        const slopeK = 1 - smoothstep(0.45, 0.7, slope);
        if (mw < Math.min(1, wgt * 1.6) * (1 - smoothstep(0.5, 0.75, slope)) * q.density) mat(x, z, rng, opts.tint, opts.dry, opts.matWidth ?? 1);
        if (cw < wgt * slopeK * q.density) {
          card(x, z, rng, opts.height * (0.9 + 0.2 * rng()), opts.tint < 1.5 ? 1 : 2, opts.dry * (0.3 + 0.7 * rng()));
          placed++;
        }
      }
    }
    // tufts: bent blades over the cards, the bank / rim tufts' scale (plants.ts round 31: 0.6–1.2)
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    const nt = Math.round(area * opts.tuftsPerM2 * q.density);
    const th = opts.tuftHeight ?? [0.55, 1.05];
    for (let i = 0; i < nt; i++) {
      const x = mm(box[0] + rng() * (box[2] - box[0]));
      const z = mm(box[1] + rng() * (box[3] - box[1]));
      const wgt = weight(x, z);
      const draw = rng();
      const scale = th[0] + (th[1] - th[0]) * rng();
      const c = greenVar(rng, 0.16);
      if (wgt <= 0 || draw > wgt) continue;
      if (groundOk(x, z, 0.1) < 0) continue;
      plant(tufts, x, z, rng, scale, 0.6, 0.015, c);
    }
    counts[`lawn-${label}`] = placed;
  };

  // ---- the south bank's top: a fenced lawn with a flower drift (the SW pan: the Kokiri stands in
  // it; footage 9–13 s: lit turf, a few purple / white blooms along the lip)
  {
    const half = B.halfLength + B.skirt;
    const corners = [southBankPoint(-half, BANK_TOP_V[0]), southBankPoint(half, BANK_TOP_V[0]), southBankPoint(-half, BANK_TOP_V[1]), southBankPoint(half, BANK_TOP_V[1])];
    const box: [number, number, number, number] = [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))];
    const top = (x: number, z: number) => {
      const { u, v } = bankLocal(x, z);
      const along = 1 - smoothstep(B.halfLength + 0.2, B.halfLength + B.skirt, Math.abs(u));
      const across = smoothstep(BANK_TOP_V[0], BANK_TOP_V[0] + 0.6, v) * (1 - smoothstep(BANK_TOP_V[1] - 0.15, BANK_TOP_V[1], v));
      // only the raised ground: the skirt's ends fall back to the plain
      const raised = smoothstep(0.9, 1.5, T.height(x, z));
      return along * across * raised;
    };
    lawn('bank-top', box, top, { tuftsPerM2: 1.4, tint: 1.3, dry: 0.25, height: 1 });
    // flowers: a purple drift 0.4–1.4 m behind the lip, white dots across the top
    const rng = ctx.rng.fork('expansion/bank-flowers');
    let purple = 0;
    let whites = 0;
    for (let i = 0; i < 260 && purple < 34; i++) {
      const u = (rng() * 2 - 1) * (B.halfLength - 0.1);
      const v = -(0.4 + rng() * 1.0);
      const [x, z] = southBankPoint(u, v).map(mm);
      const scale = 0.7 + rng() * 0.5;
      const c = greenVar(rng, 0.1);
      if (top(x, z) < 0.5 || groundOk(x, z, 0.1) < 0) continue;
      if (flowers.items.some((f) => Math.hypot(f.x - x, f.z - z) < 0.22)) continue;
      plant(flowers, x, z, rng, scale, 0.5, 0.01, c);
      purple++;
    }
    for (let i = 0; i < 200 && whites < 22; i++) {
      const u = (rng() * 2 - 1) * B.halfLength;
      const v = BANK_TOP_V[0] + 0.3 + rng() * (BANK_TOP_V[1] - BANK_TOP_V[0] - 0.6);
      const [x, z] = southBankPoint(u, v).map(mm);
      const scale = 0.75 + rng() * 0.4;
      const c = greenVar(rng, 0.1);
      if (top(x, z) < 0.5 || groundOk(x, z, 0.1) < 0) continue;
      plant(whiteFlowers, x, z, rng, scale, 0.5, 0.01, c);
      whites++;
    }
  }

  // ---- the bank's face and toe: tufts leaning down the face in rows, ferns and moss where the
  // face meets the plain (footage: the bank's foot is dark and ferny under the lit turf)
  {
    const rng = ctx.rng.fork('expansion/bank-toe');
    let faceTufts = 0;
    let toeFerns = 0;
    let toeMoss = 0;
    for (let i = 0; i < 420; i++) {
      const u = (rng() * 2 - 1) * (B.halfLength + 0.8);
      const v = BANK_FACE_V[0] + rng() * (BANK_FACE_V[1] - BANK_FACE_V[0]);
      const [x, z] = southBankPoint(u, v).map(mm);
      const scale = 0.5 + rng() * 0.6;
      const c = greenVar(rng, 0.18);
      const slope = groundOk(x, z, 0.1);
      if (slope < 0 || T.height(x, z) < 0.55) continue;
      // the flight's cheeks (u ≈ 0.3 ± 0.8 across the face) keep their moss, not tufts
      if (Math.abs(u - 0.3) < 1.0) continue;
      plant(tufts, x, z, rng, scale, 0.75, 0.01, c);
      faceTufts++;
    }
    for (let i = 0; i < 300 && toeFerns < 42; i++) {
      const u = (rng() * 2 - 1) * (B.halfLength + 1.2);
      const v = BANK_TOE_V[0] + rng() * (BANK_TOE_V[1] - BANK_TOE_V[0]);
      const [x, z] = southBankPoint(u, v).map(mm);
      const scale = 0.55 + rng() * 0.5;
      const c = greenVar(rng, 0.2);
      if (groundOk(x, z, 0.3) < 0) continue;
      if (Math.abs(u - 0.3) < 1.15) continue;
      if (ferns.items.some((f) => Math.hypot(f.x - x, f.z - z) < 0.42)) continue;
      plant(ferns, x, z, rng, scale, 0.7, 0.02, c);
      toeFerns++;
    }
    for (let i = 0; i < 300 && toeMoss < 60; i++) {
      const u = (rng() * 2 - 1) * (B.halfLength + 1.0);
      const v = BANK_TOE_V[0] - 0.3 + rng() * (BANK_TOE_V[1] - BANK_TOE_V[0] + 0.3);
      const [x, z] = southBankPoint(u, v).map(mm);
      const radius = 0.08 + rng() * 0.18;
      const c: [number, number, number] = [0.95 + rng() * 0.1, 1, 0.9 + rng() * 0.1];
      if (groundOk(x, z, 0.08) < 0) continue;
      cushion(x, z, rng, radius, c);
      toeMoss++;
    }
    counts['bank-face-tufts'] = faceTufts;
    counts['bank-toe-ferns'] = toeFerns;
    counts['bank-toe-moss'] = toeMoss;
  }

  // ---- the flights' cheeks: moss cushions and a few weeds beside the treads
  {
    const rng = ctx.rng.fork('expansion/cheeks');
    let cheekMoss = 0;
    for (const s of EXPANSION_STAIRS) {
      const l = Math.hypot(s.dir[0], s.dir[1]);
      const dx = s.dir[0] / l;
      const dz = s.dir[1] / l;
      const run = s.steps * s.tread;
      const nAlong = Math.round(run * 6);
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < nAlong; k++) {
          const u = -0.2 + rng() * (run + 0.6);
          const out = CHEEK_OUT[0] + Math.pow(rng(), 1.4) * (CHEEK_OUT[1] - CHEEK_OUT[0]);
          const v = side * (s.width / 2 + out);
          const x = mm(s.base[0] + dx * u - dz * v);
          const z = mm(s.base[2] + dz * u + dx * v);
          const radius = 0.07 + rng() * 0.16;
          const c: [number, number, number] = [0.95 + rng() * 0.1, 1, 0.9 + rng() * 0.1];
          const kind = rng();
          if (groundOk(x, z, 0.08) < 0) continue;
          if (kind < 0.7) {
            cushion(x, z, rng, radius, c);
            cheekMoss++;
          } else {
            plant(weeds, x, z, rng, 0.6 + rng() * 0.5, 0.6, 0.01, greenVar(rng, 0.14));
          }
        }
      }
    }
    counts['cheek-moss'] = cheekMoss;
  }

  // ---- the paths: grass tufts and leaf litter along the discs' rims, on the natural ground
  // between the stones (footage: the slabs sit in turf with leaves in the angles)
  {
    const rng = ctx.rng.fork('expansion/paths');
    let pathTufts = 0;
    let pathLeaves = 0;
    for (const d of discs) {
      const nT = 5;
      const nL = 4;
      for (let i = 0; i < nT; i++) {
        const a = rng() * Math.PI * 2;
        const r = d.r + PATH_VERGE[0] + Math.pow(rng(), 1.6) * (PATH_VERGE[1] - PATH_VERGE[0]);
        const x = mm(d.x + Math.cos(a) * r);
        const z = mm(d.z + Math.sin(a) * r);
        const scale = 0.45 + rng() * 0.6;
        const c = greenVar(rng, 0.16);
        if (groundOk(x, z, 0.05) < 0) continue;
        // a blade at the rim leans over the stone: tilt toward the disc's centre
        const lean = 1 - smoothstep(PATH_VERGE[0], 0.3, r - d.r);
        T.normal(x, z, n);
        n.x += (d.x - x) * 0.9 * lean;
        n.z += (d.z - z) * 0.9 * lean;
        n.normalize();
        const y = T.height(x, z) - 0.01;
        composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, 0.6, rng() * Math.PI * 2, scale, scale, scale);
        tufts.add(M, rng.int(0, tufts.variantCount), c);
        pathTufts++;
      }
      for (let i = 0; i < nL; i++) {
        const a = rng() * Math.PI * 2;
        const r = d.r - 0.1 + rng() * 0.6;
        const x = mm(d.x + Math.cos(a) * r);
        const z = mm(d.z + Math.sin(a) * r);
        const onStone = r < d.r;
        const scale = 0.7 + rng() * 0.7;
        const tintK = 0.8 + rng() * 0.4;
        const tint = templates.leaves.tints[rng.int(0, templates.leaves.tints.length)];
        const variant = rng.int(0, leaves.variantCount);
        const yaw = rng() * Math.PI * 2;
        const m = T.mask(x, z);
        if (m.stairs > 0.2 || m.structure > 0.3) continue;
        if (!onStone && groundOk(x, z, 0) < 0) continue;
        T.normal(x, z, n);
        const y = T.height(x, z) + (onStone ? 0.055 : 0.004);
        composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, 1, yaw, scale, scale, scale);
        leaves.add(M, variant, [tint[0] * tintK, tint[1] * tintK, tint[2] * tintK]);
        pathLeaves++;
      }
    }
    counts['path-tufts'] = pathTufts;
    counts['path-leaves'] = pathLeaves;
  }

  // ---- the west tree-house's verge: ferns and a few shrubs round the bole, off the door's walk
  {
    const rng = ctx.rng.fork('expansion/west-house');
    let houseFerns = 0;
    let houseBushes = 0;
    const [hx, hz] = W.host;
    const doorA = ((W.facingDeg + W.doorDeg) * Math.PI) / 180;
    for (let i = 0; i < 400 && houseFerns < 70; i++) {
      const a = rng() * Math.PI * 2;
      const r = W.radius + HOUSE_VERGE[0] + Math.pow(rng(), 1.3) * (HOUSE_VERGE[1] - HOUSE_VERGE[0]);
      const x = mm(hx + Math.sin(a) * r);
      const z = mm(hz + Math.cos(a) * r);
      const scale = 0.55 + rng() * 0.55;
      const c = greenVar(rng, 0.2);
      // the door's walk (toward the plaza) stays open
      const da = Math.atan2(Math.sin(a - doorA), Math.cos(a - doorA));
      if (Math.abs(da) < 0.45 && r < W.radius + 2.6) continue;
      if (groundOk(x, z, 0.3) < 0) continue;
      if (ferns.items.some((f) => Math.hypot(f.x - x, f.z - z) < 0.45)) continue;
      plant(ferns, x, z, rng, scale, 0.7, 0.02, c);
      houseFerns++;
    }
    for (let i = 0; i < 120 && houseBushes < 7; i++) {
      const a = rng() * Math.PI * 2;
      const r = W.radius + 1.0 + rng() * 2.0;
      const x = mm(hx + Math.sin(a) * r);
      const z = mm(hz + Math.cos(a) * r);
      const scale = 0.55 + rng() * 0.4;
      const c = greenVar(rng, 0.12);
      const da = Math.atan2(Math.sin(a - doorA), Math.cos(a - doorA));
      if (Math.abs(da) < 0.6) continue;
      if (groundOk(x, z, 0.5) < 0) continue;
      if (bushes.items.some((b) => Math.hypot(b.x - x, b.z - z) < 1.4)) continue;
      plant(bushes, x, z, rng, scale, 0.3, 0.05, c);
      houseBushes++;
    }
    counts['house-ferns'] = houseFerns;
    counts['house-bushes'] = houseBushes;
  }

  // ---- the knoll under the far hut: turf over the rise (the hut's column stands in a lawn, not
  // on the bare splat), thinning to the plain
  {
    const [kx, kz] = EXPANSION.farHut.host;
    const box: [number, number, number, number] = [kx - KNOLL_R, kz - KNOLL_R, kx + KNOLL_R, kz + KNOLL_R];
    const knoll = (x: number, z: number) => {
      const d = Math.hypot(x - kx, z - kz);
      return (1 - smoothstep(KNOLL_R - 2.2, KNOLL_R - 0.2, d)) * smoothstep(EXPANSION.farHutTrunk.baseRadius + 0.2, EXPANSION.farHutTrunk.baseRadius + 0.9, d);
    };
    // the knoll has no blade tiles under its cards (grass.ts reads the legacy view), so the bent
    // tufts stand in for the blade layer — 3 / m², lower cards, or the cards read as single leaves
    // from the 3 m view
    lawn('knoll', box, knoll, { tuftsPerM2: 3.0, tint: 1.1, dry: 0.35, height: 0.72, tuftHeight: [0.45, 0.85], matWidth: 1.1 });
  }

  for (const set of sets) group.add(set.build());

  // ---- the locality's spheres: the structures' and hardscape's casters (the house, the fence
  // posts, the flights, every disc) plus the plants' own ground — the bank's top, face and toe,
  // the paths' verges (inside the discs' casters), the house verge, the knoll — as low casters
  // whose shadow footprints (a 0.6 m fern throws 0.8 m ESE) are swept like the rest
  const sun = sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const casters: Caster[] = expansionCasters();
  for (const u of [-2.4, -1.2, 0, 1.2, 2.4]) {
    for (const v of [-2.4, -1.0, 0.6, 1.8, 2.9]) {
      const [x, z] = southBankPoint(u, v);
      const y = T.height(x, z);
      casters.push({ x, z, r: 1.0, y0: y - 0.1, y1: y + 0.8, shadow: true });
    }
  }
  {
    const [hx, hz] = W.host;
    const y = T.height(hx, hz + W.radius + 1.5);
    casters.push({ x: hx, z: hz, r: W.radius + HOUSE_VERGE[1] + 0.3, y0: y - 1.2, y1: y + 1.6, shadow: true });
    const [kx, kz] = EXPANSION.farHut.host;
    const ky = T.height(kx, kz);
    casters.push({ x: kx, z: kz, r: KNOLL_R + 0.5, y0: ky - 1.6, y1: ky + 0.6, shadow: true });
  }
  const spheres = casters.flatMap((c) => casterSpheres(c, sun));

  return { group, sets, spheres, counts };
}
