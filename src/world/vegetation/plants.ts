/**
 * Placement of the non-grass plants: ferns and their fiddleheads, bushes, purple and white
 * flowers, broad-leaf plants, seed-head stalks, clover, moss tufts (including the path-edge
 * band) and saplings. Every plant is seated on the exact terrain height
 * and tilted toward the local normal; positions respect the terrain mask (never on flagstones,
 * stairs, house pads or cliffs) and the layout (clearings at NPC spots, boulder rings, trunks).
 */
import { Color, Group, Vector3, type Material } from 'three';
import { ROPE_FENCES, houseSteppingStones } from '../layout';
import type { WorldContext } from '../system';
import { STONE_CIRCLE_STONES, expansionCull } from '../terrain/heightfield';
import { smoothstep, clamp } from '../util/noise';
import type { Rng } from '../util/prng';
import { rimBandPlants, terracePlants } from './edges';
import { pruneExpansion } from './expansion';
import { STANDING_STONE_CLEAR, VERGE_LEFT, VegField, composeMatrix, newSample, type FieldSample } from './field';
import { rgb } from './geometry';
import { LodInstancedSet, type PackLayout } from './lodset';
import { createVegMaterial, createVegShadowMaterials, type VegMaterialOptions } from './materials';
import { BIG_LEAF_VARIANTS, BROADLEAF_DETAILS, BROADLEAF_ULTRA_M, BUSH_DETAILS, BUSH_ULTRA_M, HEDGE_DETAILS, HEDGE_ULTRA_M, SHRUB_TOP_ROUGHNESS, FIDDLEHEAD_DETAILS, FIDDLEHEAD_ULTRA_M, FLOWER_DETAILS, FLOWER_ULTRA_M, HERO_FERN_DETAILS, HERO_FERN_ULTRA_M, MOSS_DETAILS, MOSS_MID_M, MOSS_ULTRA_M, WHITE_FLOWER_DETAILS, bushGeometry, withMirrors, cloverGeometry, fernGeometry, fiddleheadGeometry, flowerGeometry, flowerSpikeGeometry, hedgeGeometry, heroFernGeometry, makePalette, maxHeight, mossGeometry, saplingGeometry, seedheadGeometry, tuftGeometry, variants, weedGeometry, whiteFlowerGeometry } from './plantgeo';

export interface PlantSets {
  ferns: LodInstancedSet;
  /** grass tufts (round 31): fountains of bent blades in three height classes on the banks and leaning over the paved rims */
  tufts: LodInstancedSet;
  /** big lit tree-fern crowns (0.7–0.9 m): the shot-D clump left of the boulder and accents on the east bank */
  heroFerns: LodInstancedSet;
  /** spiral buds (0.25–0.45 m) at the hero crowns and a share of the near fern clumps (concept sheet 01 / 04) */
  fiddleheads: LodInstancedSet;
  bushes: LodInstancedSet;
  /** the low dark shot-A hedge on the bank between the plaza and Saria's terrace (≤ 1.2 m) */
  hedge: LodInstancedSet;
  flowers: LodInstancedSet;
  /** pale-yellow cluster blooms tucked into the shot-D hero clump */
  yellowFlowers: LodInstancedSet;
  /** small five-petal white forest flowers with yellow centres, in clumps along the path edges (concept sheets 01 / 02 / 04) */
  whiteFlowers: LodInstancedSet;
  /** broad-leaf ground plants: heart / ovate / round laminae with a glossy top face */
  weeds: LodInstancedSet;
  seedheads: LodInstancedSet;
  clover: LodInstancedSet;
  moss: LodInstancedSet;
  saplings: LodInstancedSet;
  /** round 44: the north corridor's small ferns and broad leaves (the disc sets' geometry, ending at NORTH_PLANT_MAX_M) */
  fernsNorth: LodInstancedSet;
  weedsNorth: LodInstancedSet;
  /** round 48: the clearing banks' shrubs and the terrace pad's tufts (the disc sets' geometry, cut at NORTH_BUSH_MAX_M / the tufts' range) */
  bushesNorth: LodInstancedSet;
  tuftsNorth: LodInstancedSet;
  /** round 48: what the north passes seated, per item (audit) */
  north: { clearingFerns: number; flankFerns: number; clearingBushes: number; padTufts: number; padClover: number; stoneMoss: number; farHerbs: number; farFootFerns: number; farFeet: number; propRejected: number };
  all: LodInstancedSet[];
  materials: Material[];
  /** round 50: legacy-seated plants pruned inside the expansion's live ground, per set (expansion.ts) */
  expansionCulled: Record<string, number>;
  /** round 50 (edges.ts): what the rim band and the terraces seated, per pass */
  edges: Record<string, number>;
  /** round 57: the flower clumps the butterflies anchor to — `flowers` as the rules before the ruins' prune leave it */
  butterflyClumps: readonly { x: number; z: number }[];
}

interface ScatterOpts {
  label: string;
  candidates: number;
  /** [x0, z0, x1, z1]; default = detail disc */
  box?: [number, number, number, number];
  minSpacing?: number;
  /**
   * ≤ 0.3 m herb layer (clover, moss) that may grow in the trodden strip between Saria's stepping
   * stones and right up to their rims; everything else keeps 0.5 m off the stones and out of the
   * strip (reference B/E: short sparse grass and litter there, nothing standing).
   */
  low?: boolean;
  /** stop after this many placements (authored clump counts) */
  max?: number;
  /**
   * Round 32 field rules (field.ts `allowed` / `troddenZone` with `r32`): turf slivers narrower
   * than the field grid grow, the house flight is no trodden strip. Only the round-32 streams
   * set it, so every earlier stream keeps its candidate sequence.
   */
  r32?: boolean;
  /** returns acceptance probability (0 = reject) */
  accept(x: number, z: number, s: FieldSample, rng: Rng): number;
}

const STONE_CLEARANCE = 0.5;
/** metres of lawn outside the flagstone rim that the path-edge moss / litter soften (sheet 02) */
const RIM_BAND = 0.25;
const RIM_MOSS_CANDIDATES_PER_M = 3.8;
/**
 * Round 44 — the north corridor's forest floor (field.ts `northFloor`): the extra weight, × the
 * disc scatter's, of the small ferns, the broad leaves / clover and the moss beds on that ground
 */
const NORTH_FLOOR_FERNS = 1.5;
const NORTH_FLOOR_WEEDS = 1.2;
const NORTH_FLOOR_MOSS = 0.16;
/** the north corridor's fern and broad-leaf sets end here (m): the walk sees 15–25 m of plain, the fixed cameras stand 40 m+ off */
const NORTH_PLANT_MAX_M = 30;
/**
 * Round 44 (survey-1 #7): the plateau walk's centre line (the survey's w26 → w27 → w28 walk points,
 * stair top → fenced lip → north fence) and the clearance (m) every bush crown keeps from it
 */
const PLATEAU_WALK: readonly (readonly [number, number])[] = [
  [16.45, -7.23],
  [19.4, -3.6],
  [18.3, -8.5],
];
const BUSH_LENS_CLEAR_M = 0.5;
/** round 47: bushes within this distance of a house trunk (m past its radius) are the big-leaf shrub of ref-01 */
const HOUSE_BIG_LEAF_M = 3.4;
/** round 47: the authored house shrubs — angles off the door's facing (°) and their offset past the trunk (m) */
const HOUSE_SHRUB_ANGLES: readonly number[] = [-58, -98, 62, 104, 150];
const HOUSE_SHRUB_OFF: readonly [number, number] = [0.55, 1.1];
/**
 * Round 47 — the north path's verge (owner review 2026-09-19, ref-04: "dense dark ferns and shrubs
 * with layered leaf silhouettes and lit rims at the path edges, fine litter everywhere, no bare
 * ground"). The vertical layer over the round-46 north carpet: a dense band of dark ferns
 * (`fernsNorth`, NORTH_VERGE_FERN_EDGE m off the paving) with leafy shrub crowns (`bushes`) on its
 * outer edge (NORTH_VERGE_BUSH_EDGE), from NORTH_VERGE_Z0 north to the corridor's end. Camera D
 * looks straight up this path: inside NORTH_VERGE_D_Z (its frame's banks, 12–40 m off) the band
 * grows at NORTH_VERGE_D_KEEP of its weight and the ferns end at NORTH_PLANT_MAX_M anyway; the
 * frames' D shoulders and hollow take none (their cuts are the frames'). The hollow is the whole
 * west bank from z −20 to −50 (frame 56 s' open ground), so the band is the east bank's: its
 * candidate density (NORTH_VERGE_FERN_PER_M2 over the corridor box, ≈ 3 % of which is the band)
 * is set for ≈ 4–5 fronds per metre of bank at the 0.5 m spacing.
 */
const NORTH_VERGE_Z0 = -15;
const NORTH_VERGE_D_Z = -34;
const NORTH_VERGE_D_KEEP = 0.6;
const NORTH_VERGE_FERN_PER_M2 = 6.5;
const NORTH_VERGE_BUSH_PER_M2 = 1.6;
const NORTH_VERGE_FERN_EDGE: readonly [number, number, number, number] = [0.5, 0.85, 2.1, 3.2];
const NORTH_VERGE_BUSH_EDGE: readonly [number, number, number, number] = [1.15, 1.7, 2.7, 3.6];
/**
 * 2026-09-23 — the share of the round-47 verge band that frame 56 s' hollow (the whole WEST bank
 * from z −20 to −50) keeps. It rejected the band outright, so the corridor's layered fern-and-shrub
 * verge grew on the east bank alone and the owner's left side was bald turf.
 */
const D_HOLLOW_VERGE_KEEP = 0.8;
/** 2026-09-23 — metres off the walked paving where the verge's shrub crowns stand: behind its fronds, in front of the middle ground */
const VERGE_SHRUB: readonly [number, number] = [1.7, 3.6];
/** 2026-09-24 — the low zone's broad leaves lie flat: this scale range tops out well under the frames' 0.5 m */
const LOW_GROUND_LEAF: readonly [number, number] = [0.5, 0.95];
/** the verge's tint: ref-04's ferns and shrubs are dark (× the sets' palette) */
const NORTH_VERGE_FERN_TINT = 0.82;
const NORTH_VERGE_BUSH_TINT = 0.6;
/** the verge's disc-falloff floor (the corridor's ground past the fade keeps this share; carpet.ts NORTH_CARPET.reachFloor) */
const NORTH_CARPET_REACH_FLOOR_PLANTS = 0.8;
/**
 * Round 48 (vegetation-26) — the ground north of the log arch that expansion-1 opened (field.ts
 * NORTH_ZONE_Z and the zones under it; the round-47 reviews: "a flat plane", "nothing growing at
 * the trees' feet", the clearing's banks "bare cut soil + litter"). Ref-04 is the target: dense
 * dark ferns and shrubs at the path edges, fine leaf litter everywhere, the corridor floor litter
 * not lawn. Four passes, each its own stream after every pass above (nothing south of the gate
 * moves; the six fixed cameras see none of this ground — layout.ts `northClearing`):
 *
 * - the clearing's banks (`clearingLawn.bank`): dark ferns (CLEARING_FERN_*) thickening up the
 *   slope and at the terrace flanks (TERRACE_FLANK_FERNS: an authored clump each side of the
 *   `ledge` flight's landing), broad-leaf rosettes, clover, a few leafy shrubs on the outer bank
 *   tops (`bushesNorth`, its own set: the disc `bushes` draw their far LOD at any range, and 30
 *   crowns 80–95 m north of camera A — in its frustum, behind the north rise — would have cost it
 *   the triangles it has no room for; cut at NORTH_BUSH_MAX_M like the north ferns);
 * - the terrace pad (`clearingLawn.pad`): tufts (`tuftsNorth`, its own set so the B3 claim
 *   `grassInstances` stays the disc's) and clover close the turf a Kokiri stands on;
 * - the standing stones: moss cushions at their feet, on the paving, in the ring STONE_MOSS_RING m
 *   off each axis (the stones' footprints are `structure`; grow around, not under) — placed
 *   directly, the paving mask would reject a scatter there;
 * - the forest floor beyond the tunnel (`farFloor`): a low herb carpet (broad leaves, clover, moss
 *   beds) and dark ferns at the far trees' feet (FAR_TREE_FEET, plus any `ctx.shared.trunkSeats`
 *   the trees system seats north of the gate) reaching FAR_FLOOR_REACH m from the north path.
 */
const NORTH_BUSH_MAX_M = 36;
/** the clearing banks' fern candidates per m² of the clearing box and the pass's base acceptance */
const CLEARING_FERN_PER_M2 = 5.5;
const CLEARING_FERN_P = 0.16;
/** ref-04's fronds are darker than the disc ferns' palette (× the set's) */
const CLEARING_FERN_TINT = 0.76;
const CLEARING_BUSH_TINT = 0.58;
/** the authored fern clumps flanking the terrace (expansion-1's brief), centre and radius (m) */
const TERRACE_FLANK_FERNS: readonly (readonly [number, number, number])[] = [
  [-3.5, -78.5, 1.1],
  [2.4, -79.0, 1.0],
];
const TERRACE_FLANK_COUNT = 9;
/** the moss ring at a standing stone's foot: [inner, outer] m off the axis, cushions per stone */
const STONE_MOSS_RING: readonly [number, number] = [0.32, 0.62];
const STONE_MOSS_COUNT = 11;
/** the terrace pad's tufts per m² (candidates) and the pad's clover candidates per m² */
const PAD_TUFT_PER_M2 = 14;
const PAD_CLOVER_PER_M2 = 10;
/**
 * The far forest's tree feet (x, z, foot radius m): the distant trees the trees system seeds north
 * of the tunnel within 27 m of the north path (trees/distant.ts placeDistantTrees — a label-forked
 * seeded placement it does not publish; byte-identical since round 47: layout.ts `northPath` keeps
 * its candidates), replayed in node at eb6d2bc (gauntlet/tmp probe: the round-47
 * distant-candidates replay, 729 placements = the take-0118 audit's `distantTrees`). The foot is
 * the kind's bole radius × the base flare (DISTANT_FLARE) × the instance scale. A seat the trees
 * system does publish (`ctx.shared.trunkSeats`) within FAR_FOOT_MERGE_M of one of these replaces
 * it — trees-31 is dressing these columns this round; when it seats them, the ferns follow the seat.
 */
const FAR_TREE_FEET: readonly (readonly [number, number, number])[] = [
  [25.76, -56.2, 1.91], // broad 23 m × 1.19, 20 m off the path
  [-10.93, -56.98, 1.58], // broad 19 × 1.19, 15.9 m
  [19.6, -57.03, 1.48], // broad 19 × 1.11, 13.8 m
  [-7.81, -58.33, 2.04], // broad 23 × 1.27, 13 m
  [-25.3, -58.69, 1.59], // broad 19 × 1.2, 26.3 m
  [-20.21, -58.7, 1.64], // broad 19 × 1.24, 21.8 m
  [30.22, -58.86, 1.48], // broad 19 × 1.11, 24.4 m
  [15.6, -59.25, 1.94], // broad 23 × 1.2, 9.9 m
  [-2.57, -60.06, 1.8], // broad 23 × 1.12, 7.8 m — the first tree through the tunnel's mouth
  [13.14, -69, 0.19], // slender 11 × 0.9, 10.2 m
  [18.69, -76.14, 1.55], // broad 19 × 1.17, 18.6 m
  [-14.61, -76.6, 1.39], // broad 19 × 1.04, 14.8 m
  [0.93, -85.98, 1.85], // broad 19 × 1.39, 16.4 m — the row behind the ledge
  [-5.22, -86.44, 1.89], // broad 23 × 1.18, 17.1 m
  [-11.77, -86.58, 2.21], // broad 23 × 1.37, 19.7 m
  [-18.21, -87, 2.2], // broad 23 × 1.37, 24 m
  [15.69, -87.16, 1.96], // broad 23 × 1.22, 24.1 m
  [10.94, -89.63, 2.1], // broad 23 × 1.31, 23.4 m
  [2.06, -93.8, 2.08], // broad 23 × 1.29, 24.3 m
  [-2.7, -95.8, 1.47], // broad 19 × 1.11, 26 m
];
const FAR_FOOT_MERGE_M = 3;
/** ferns around a far tree's foot: count per foot, and the ring [inner, outer] past the foot radius (m) */
const FAR_FOOT_FERNS = 7;
const FAR_FOOT_RING: readonly [number, number] = [0.25, 1.6];
const FAR_FOOT_FERN_TINT = 0.74;
/** round 44 (survey-1 #10): a violet clump's pigment spread (× 1 ± this) and hue lean (red up / blue down or the reverse, this fraction) */
export const FLOWER_CLUMP_SPREAD = 0.12;
export const FLOWER_CLUMP_LEAN = 0.08;
/** frame 56's sunlit bud stalks are khaki-yellow against the green bank */
const TALL_BUD_TINT = new Color(1.55, 1.38, 0.82);
/** 2026-09-24 — the shot-D bud coils' width as a multiple of their height scale (was 1.7, an anamorphic cheat) */
const TALL_BUD_WIDTH = 1.25;

class Spacing {
  private cells = new Map<number, number[]>();
  constructor(private readonly cell: number) {}
  ok(x: number, z: number, min: number): boolean {
    const gx = Math.floor(x / this.cell);
    const gz = Math.floor(z / this.cell);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const arr = this.cells.get((gx + dx) * 65536 + (gz + dz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i += 2) if ((arr[i] - x) ** 2 + (arr[i + 1] - z) ** 2 < min * min) return false;
      }
    }
    return true;
  }
  add(x: number, z: number) {
    const key = Math.floor(x / this.cell) * 65536 + Math.floor(z / this.cell);
    let arr = this.cells.get(key);
    if (!arr) this.cells.set(key, (arr = []));
    arr.push(x, z);
  }
}

function scatter(ctx: WorldContext, field: VegField, opts: ScatterOpts, place: (x: number, z: number, s: FieldSample, rng: Rng) => void) {
  const rng = ctx.rng.fork(`plants/${opts.label}`);
  const R = ctx.config.detailRadius;
  const box = opts.box ?? [-R, -R, R, R];
  const s = newSample();
  const spacing = opts.minSpacing ? new Spacing(Math.max(opts.minSpacing, 0.5)) : null;
  let placed = 0;
  for (let i = 0; i < opts.candidates && placed < (opts.max ?? Infinity); i++) {
    const x = box[0] + rng() * (box[2] - box[0]);
    const z = box[1] + rng() * (box[3] - box[1]);
    if (!opts.box && Math.hypot(x, z) > R) continue;
    field.sample(x, z, s);
    if (!field.allowed(x, z, s, opts.r32)) continue;
    if (field.insideGiantTrunk(x, z)) continue;
    const p = opts.accept(x, z, s, rng);
    if (p <= 0 || rng() > p) continue;
    // after the draw, so the candidate stream stays as it was for every other placement
    if (!opts.low && (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z, opts.r32) > 0.6)) continue;
    if (spacing) {
      if (!spacing.ok(x, z, opts.minSpacing!)) continue;
      spacing.add(x, z);
    }
    place(x, z, s, rng);
    placed++;
  }
}

const M = new Float32Array(16);

/**
 * Variant packs (lodset.ts): which variants of a set share one InstancedMesh at each LOD. Every
 * variant merged into a pack saves a draw (two where the LOD casts shadows), but each instance
 * then submits every packed variant's triangles — the unselected ones collapsed to zero area, so
 * they cost vertex work and the W38 triangle budget, never fill. LODs with thousands of instances
 * and big geometry therefore stay in separate draws. Measured on the layout cameras (A / B / D)
 * against one draw per variant: this table saves 51 / 49 / 48 draws for +1.1 M submitted
 * triangles, where packing every LOD would save 66 for +2.3 M (ferns alone +2.1 M). Sets without
 * an entry take the default: all variants in one pack at every LOD.
 *
 * Round 13 trades five of the ~45 spare draws back for triangles, where the hero views sit
 * 150–400 K under the 9 M line: the flowers' mid LOD (56–147 instances of 2 593 packed triangles
 * from B / D) pairs like the near one, and the near weeds (240–300 laminae × 642 packed) and near
 * fiddleheads (110–140 buds × 1 926 packed) go one draw per variant — ≈ 300 / 340 / 385 / 510 K
 * fewer submitted triangles from A / B / C / D, room for this round's foreground clusters.
 */
const SINGLE = (n: number): number[][] => Array.from({ length: n }, (_, v) => [v]);
const ALL = (n: number): number[][] => [Array.from({ length: n }, (_, v) => v)];
const PACKS: Record<string, PackLayout> = {
  // One draw per variant at every LOD: far pairs also submitted the unselected, collapsed fern.
  ferns: [SINGLE(4), SINGLE(4), SINGLE(4)],
  // the two heads and the two spikes pair up at every LOD (round 39: the far draw packed all four,
  // 834 triangles an instance for 117 far violets from camera A — 98 K; in pairs 49 K, one draw more)
  // round 43: the ultra LOD (bells / graded stems inside FLOWER_ULTRA_M, 4.2–5.1 K triangles a
  // variant) draws one variant a draw — packed, shot D's three near clumps submitted 45 K
  // (18 K each, all four variants collapsed); per variant 13 K for one draw more
  flowers: [SINGLE(4), [[0, 1], [2, 3]], [[0, 1], [2, 3]], [[0, 1], [2, 3]]],
  // 3 000+ laminae: one draw per variant at both LODs (packing the 2 900 far ones would cost 150 K);
  // round 43: the ultra rosettes (≤ 3 inside BROADLEAF_ULTRA_M at a fixed camera) pack into one draw
  weeds: [ALL(3), SINGLE(3), SINGLE(3)],
  // round 44: the bush ultra LOD (≈ 8.5 K triangles a variant) draws one variant a draw; the three
  // round-9 LODs keep the default single pack they always had
  // the six variants (three + their mirrors, interleaved): the originals in one pack and the mirrors in
  // another at the round-9 LODs — the same triangles an instance ever submitted, one draw more a LOD
  // (packing all six at the far LOD would save that draw for twice its triangles: +6.5 K on camera
  // C, which the moss savings only just bring back under its 2.07 M)
  bushes: [SINGLE(6), [[0, 2, 4], [1, 3, 5]], [[0, 2, 4], [1, 3, 5]], [[0, 2, 4], [1, 3, 5]]],
  // round 44: the mid cushion (≈ 290 triangles a variant, 3–8 m) and the far dome draw one variant a
  // draw — packed, every cushion submitted both variants (the far dome: 90 triangles a 3 px cushion,
  // 69 K from camera A); the ultra tier keeps its pack
  moss: [ALL(2), SINGLE(2), SINGLE(2)],
  // the north corridor's fern / broad-leaf sets: the fixed cameras frame a handful of their far LODs
  // 20–30 m off (camera D: 3 fronds, 11 rosettes) — packed there, one draw a LOD instead of 2–3; the
  // near fronds, which only the walk sees, stay one variant a draw like the disc ferns'.
  // Round 47: the north verge (vegetation-25) puts hundreds of mid-LOD fronds 20–35 m from camera A;
  // packed, each submitted all four variants (ferns-north-lod1 0 → 89 K on A, W38 9.02 M > 9.0 M) —
  // the mid LOD draws one variant a draw again (+3 draws, ≈ −66 K); the far LOD now does too,
  // avoiding three unselected, collapsed variants per instance.
  'ferns-north': [SINGLE(4), SINGLE(4), SINGLE(4)],
  'weeds-north': [ALL(3), ALL(3), ALL(3)],
  seedheads: [ALL(3), SINGLE(3)],
  // 428–856-triangle coils: per variant at both LODs (round 39: the one packed far draw submitted
  // 360 triangles a bud, 123 K for the 340 buds 14–24 m from camera A; per variant 41 K, two draws
  // more — paid for by the grass tiles' far draws, see grass.ts)
  // round 40 follow-up: the ultra LOD (8-sided graded stalks inside FIDDLEHEAD_ULTRA_M) per variant too
  fiddleheads: [SINGLE(3), SINGLE(3), SINGLE(3)],
  // round 40: the bipinnate near LOD (≈ 18 K triangles a crown) and the lance high LOD draw per
  // variant — packed, every crown 5–16 m from a camera submitted all three variants collapsed
  // (10 908 triangles, 21.8 K with its shadow; 3 636 / 7.3 K per variant: −73 K from camera A,
  // −131 K from F, +4 draws paid by the tufts' shadow pass below); the two far lance LODs keep
  // the single pack (no fixed camera has a crown inside the near range)
  'hero-ferns': [SINGLE(3), SINGLE(3), ALL(3), ALL(3)],
  // 12 hero hedges, all high-LOD from every camera: packing ALL(3) near submitted 3x the placed
  // geometry (300 K vs 97 K triangles); per variant near, +4 draws (Astra, docs/proposals/astra-hedge-packs)
  // round 47: the ultra LOD (≈ 5.6 K triangles a variant, inside HEDGE_ULTRA_M on the walk only) draws
  // one variant a draw like the high LOD it hands over to
  hedge: [SINGLE(3), SINGLE(3), ALL(3), ALL(3)],
  // round 31: 6 tuft variants (two per height class, `variant % 3` the class). Thousands of
  // instances: one draw per variant near (130 triangles each) and far (30 triangles), without
  // the paired variant's collapsed triangles (round 40: near tufts no longer cast, see `mk`).
  tufts: [SINGLE(6), SINGLE(6)],
};

/**
 * Frame 56 s' hero fern clump (reference 0.05–0.14 × 0.55–0.68 at camera D, left of and above the mossy rock).
 * 2026-09-21: the shot-D boulder moved to the frame's spot (−2.0, −7.6) and its terrain mound went with it, so
 * the clump no longer rides on the rock: three authored crown spots that project into the reference box on
 * today's ground (roots at sx 0.08–0.12, sy 0.65–0.67), and an anchor for their blooms and fiddleheads.
 */
export const HERO_CLUMP_ANCHOR: readonly [number, number] = [-4.4, -12.4];
export const HERO_CLUMP_SPOTS: readonly (readonly [number, number, number])[] = [
  [-4.6, -12.4, 1.02],
  [-4.2, -12.0, 0.92],
  [-4.4, -13.0, 0.94],
];

export function buildPlants(ctx: WorldContext, field: VegField, parent: Group): PlantSets {
  const P = ctx.config.palette;
  const pal = makePalette(P);
  const T = ctx.terrain;
  const q = ctx.quality;
  const seed = ctx.config.seed;
  const materials: Material[] = [];

  // `ultraLods` (round 43): leading near LODs left out of the sway normalisation height, so a set
  // that gains an ultra LOD keeps the plantHeight — and the wind — its other LODs had
  const mk = (label: string, geos: ReturnType<typeof variants>, kind: 'plant' | 'bush' | 'moss', lodDistances: number[], castShadowLods: number, matOpts: VegMaterialOptions = {}, maxDistance?: number, ultraLods = 0) => {
    const material = createVegMaterial(ctx, kind, { plantHeight: maxHeight(ultraLods ? geos.map((row) => row.slice(ultraLods)) : geos), name: `veg-${label}`, ...matOpts });
    materials.push(material);
    const shadowMaterials = castShadowLods > 0 ? createVegShadowMaterials(material) : undefined;
    if (shadowMaterials) materials.push(shadowMaterials.depth, shadowMaterials.distance);
    return new LodInstancedSet({ name: label, variants: geos, material, shadowMaterials, lodDistances: lodDistances.map((d) => d * q.distance), maxDistance: maxDistance === undefined ? undefined : maxDistance * q.distance, castShadowLods, nearLods: ultraLods, packs: PACKS[label] });
  };

  // round 31: the near LOD's serrated pinnae read out to 12 m (was 11; 14 m put frame F at +1.51 M
  // triangles over the control — 57 flank clumps sit 12–14 m from camera F, ≈ 4.8 K each with the shadow pass)
  // round 39: the mid LOD (≈ 1 000 triangles) hands over to the far one (≈ 460) at 20 m instead of
  // 26 — a 0.6 m clump is 28–36 px tall there, the same silhouette either way; placement,
  // geometry and the near range are untouched (the mid LOD was 409 K triangles from camera A)
  const ferns = mk('ferns', variants(4, `${seed}/fern`, pal, fernGeometry), 'plant', [12, 20], 1, { sway: 2.6, flutter: 0.012, stiffness: 0.3 });
  // Hero crowns are read at frond scale from 6–8 m in shot D: high LOD out to 16 m. The reference
  // clump is sunlit (0.35 mean, 0.49 p90 in frame 56) while our west verge sits under the
  // north-west-near canopy, where fill alone rendered the fronds at 0.24: the crowns get the same
  // kind of skylight lift the shaded grass bank uses (materials.ts uShadeFill), plus more backlight.
  // Under the round-4 lighting the clump (D 0.03–0.14 × 0.58–0.70) still measures 0.27 against
  // the reference's 0.32 even with this boost and the +30 % fern palette, so the crowns take the
  // west-verge zone lift (materials.ts SHADE_LIFT_ZONE) like the rest of the verge.
  // round 40: a bipinnate near LOD inside HERO_FERN_ULTRA_M (plantgeo.ts; the tree-base audit stood
  // inside these crowns), casting shadows like the lance LOD it hands over to
  const heroFerns = mk('hero-ferns', variants(3, `${seed}/hero-fern`, pal, heroFernGeometry, HERO_FERN_DETAILS), 'plant', [HERO_FERN_ULTRA_M, 16, 32], 2, { sway: 2.0, flutter: 0.014, stiffness: 0.35, transmission: 0.25, ambientBoost: 0.4 });
  // round 44: the ultra LOD inside BUSH_ULTRA_M (plantgeo.ts — veined cupped laminae in the
  // broad-lamina band on bark-graded stems; survey-1 #7's shrub at the lens), casting like the high
  // LOD it hands over to; the high / mid LODs' leaves are ovate blades now, the same triangles
  // round 44: the three variants and their mirror images, interleaved (plantgeo.ts withMirrors) —
  // every bush keeps its round-9 variant, half of them flip (survey-1 #7: identical bushes repeated)
  // round 47 (owner review 2026-09-19 item 10): the crowns are shrub.ts' layered leaf clusters —
  // variant BIG_LEAF_VARIANT is ref-01's big-leaf house shrub (retargetBushVariants below puts it
  // at the houses and nowhere else); the laminae's upper faces take the glossy shrub roughness
  const bushes = mk('bushes', withMirrors(variants(3, `${seed}/bush`, pal, bushGeometry, [...BUSH_DETAILS])), 'bush', [BUSH_ULTRA_M, 14, 34], 2, { topRoughness: SHRUB_TOP_ROUGHNESS }, undefined, 1);
  // hero hedge: read from 6 m (the bank crowns) and 15 m (the door row) in shot A so it keeps
  // the high LOD much further out than the scattered bushes. Round 14: the clipped-crown geometry
  // (plantgeo.ts hedgeGeometry — an opaque core under two shells of small leaves) replaces the
  // open bush variants, so the rows read as the frame's solid dark mass; same three variant
  // seeds, same proportions, so every crown keeps its place, scale and top.
  // round 47: the same layered-cluster builder (shrub.ts HEDGE_STYLE: tight lobes, small ovate
  // leaves in four depth layers over dark cores) with an ultra LOD inside HEDGE_ULTRA_M for the walk
  // past the door row and the shelf tier; every fixed camera stands outside the ring (plants.test)
  const hedge = mk('hedge', variants(3, `${seed}/hedge`, pal, hedgeGeometry, [...HEDGE_DETAILS]), 'bush', [HEDGE_ULTRA_M, 26, 48], 1, { sway: 0.9, flutter: 0.014, stiffness: 0.7, topRoughness: SHRUB_TOP_ROUGHNESS }, undefined, 1);
  // matte petals: no specular sheen so the violet stays saturated under the bright sun/haze
  // round 43: an ultra LOD inside FLOWER_ULTRA_M (plantgeo.ts: heads as clusters of bells with dark
  // throats, spikes of hanging bells under a teardrop bud, 5-sided graded stems — the same layout
  // from the same stream) and the petal band (materials.ts leafDetail 'petal': fan veins and
  // translucency on the ultra petals only; the leaves and the far petals take no lamina block)
  const flowerOpts: VegMaterialOptions = { leafDetail: 'petal', sway: 2.2, flutter: 0.01, stiffness: 0.4, roughness: 1, ambientBoost: 0.02, transmission: 0.08 };
  const flowers = mk('flowers', [...variants(2, `${seed}/flower`, pal, flowerGeometry, [...FLOWER_DETAILS]), ...variants(2, `${seed}/flower-spike`, pal, flowerSpikeGeometry, [...FLOWER_DETAILS])], 'plant', [FLOWER_ULTRA_M, 9, 16], 0, flowerOpts, undefined, 1);
  // the pale-yellow blooms tucked into the shot-D fern clump: the same cluster-head plant in a
  // straw-yellow palette (reference frame 56: small pale flowers at the base of the fronds)
  const yellowPal = { ...pal, purple: rgb(0xd6c15c), purpleLight: rgb(0xefe094), purpleDeep: rgb(0xa8933a) };
  const yellowFlowers = mk('flowers-yellow', variants(2, `${seed}/flower-yellow`, yellowPal, flowerGeometry, [...FLOWER_DETAILS]), 'plant', [FLOWER_ULTRA_M, 9, 16], 0, flowerOpts, undefined, 1);
  // white forest flowers (concept sheet 01): matte petals like the violets; the far LOD keeps every
  // bloom as an enlarged four-petal fold so the white dots survive at 12–25 m, and the petals get
  // a little skylight fill so they still read white under the verge canopy (frame 14 s dots ≈ 0.6)
  // round 43: the ultra blooms (calyx, 5–6 separate cupped petals, stamen boss, closed buds) inside
  // FLOWER_ULTRA_M, with the petal band
  const whiteFlowers = mk('flowers-white', variants(3, `${seed}/flower-white`, pal, whiteFlowerGeometry, [...WHITE_FLOWER_DETAILS]), 'plant', [FLOWER_ULTRA_M, 12], 0, { leafDetail: 'petal', sway: 2.0, flutter: 0.01, stiffness: 0.45, roughness: 1, ambientBoost: 0.36, transmission: 0.06 }, undefined, 1);
  // the three sheet laminae (heart / ovate / round) with a waxy upper face and a matte underside
  // round 43: the ultra rosettes (9 × 7 wavy laminae on bent petioles, per-leaf hue) inside BROADLEAF_ULTRA_M
  const weeds = mk('weeds', variants(3, `${seed}/weed`, pal, weedGeometry, [...BROADLEAF_DETAILS]), 'plant', [BROADLEAF_ULTRA_M, 13], 0, { sway: 1.2, flutter: 0.012, stiffness: 0.55, roughness: 0.9, topRoughness: 0.55 }, undefined, 1);
  // stout buds barely move in the wind
  // round 39: the buds stop at 24 m — a 0.15 m coil is 5 px tall there, one more dark dab in the
  // far herb layer, and its 360-triangle far LOD was 130 K triangles from camera A
  // round 40 follow-up: an ultra LOD inside FIDDLEHEAD_ULTRA_M (plantgeo.ts: the tree-base audit's
  // flat wedge was one of shot D's thumb-thick bud stalks crossing the lens) — the same layout from
  // the same stream, so the switch does not pop; the fixed cameras stand outside the range
  const fiddleheads = mk('fiddleheads', variants(3, `${seed}/fiddlehead`, pal, fiddleheadGeometry, [...FIDDLEHEAD_DETAILS]), 'plant', [FIDDLEHEAD_ULTRA_M, 14], 0, { sway: 0.9, flutter: 0.003, stiffness: 0.75, transmission: 0.05 }, 24);
  const seedheads = mk('seedheads', variants(3, `${seed}/seedhead`, pal, seedheadGeometry, ['high', 'low']), 'plant', [14], 0, { sway: 4.5, flutter: 0.008, stiffness: 0.15 });
  // round 39: the herb layer stops at 16 m — a clover leaf is 2 px across there, under the turf
  // carpet's mats and clumps (carpet.ts); its far LOD was 4 000 instances / 210 K triangles from camera A
  // round 43: obcordate leaflets with the pale chevron on bent petioles inside BROADLEAF_ULTRA_M
  const clover = mk('clover', variants(3, `${seed}/clover`, pal, cloverGeometry, [...BROADLEAF_DETAILS]), 'plant', [BROADLEAF_ULTRA_M, 9], 0, { sway: 0.6, flutter: 0.006, stiffness: 0.7 }, 16, 1);
  // grass tufts (round 31): the near LOD's 12–17 bent blades read out to 16 m (the A / F banks
  // sit 10–15 m from their cameras); they take the grass blades' wind (fast sway from the root,
  // little lamina flutter) and the blades' translucency
  // the near LOD casts shadows: the frames' banks are lit blade ends over dark hearts, and a
  // tuft's own shadow on the turf under it is that contrast (the tile grass casts none)
  // round 39: the near LOD to 10 m — the turf carpet's clump cards (carpet.ts) now stand between
  // the tufts everywhere, so a tuft 10–16 m out is one clump among many and its 30-triangle far
  // LOD reads the same; the near tufts' 130 triangles and shadow pass were 240–340 K from A / B.
  // Past 22 m (a 0.3 m tuft is 7 px) the clump cards alone stand for them.
  // round 40: the tufts cast no shadow. They stand in the blade turf and the carpet's cards, neither of
  // which casts (grass.ts / carpet.ts), so a 0.15–0.35 m tuft's own shadow map was the one shadow in
  // the turf layer — six depth draws and 123 triangles a near tuft (33–66 K a frame) for shadow-map
  // acne at blade scale; the budget goes to the verge band and the face turf instead.
  const tufts = mk('tufts', variants(6, `${seed}/tuft`, pal, tuftGeometry, ['high', 'low']), 'plant', [10], 0, { sway: 3.4, flutter: 0.006, stiffness: 0.22, transmission: 0.14 }, 22);
  // round 39: the cushions stop at 24 m (≤ 0.12 m high — 3 px there; 97 K triangles in one draw from A)
  // round 43: the lumpy, lit-top / dark-rim cushion inside MOSS_ULTRA_M (plantgeo.ts mossGeometry 'ultra')
  // and the shoots' grain on the albedo inside the ring (materials.ts MOSS_GRAIN, gone by MOSS_ULTRA_M)
  // round 44: a cheaper lobe cluster from the same stream out to MOSS_MID_M (survey-1 crop 28: the
  // dome was a pale sphere 3–8 m out), the dome — dark-rimmed like the lobes — only past it
  const moss = mk('moss', variants(2, `${seed}/moss`, pal, mossGeometry, [...MOSS_DETAILS]), 'moss', [MOSS_ULTRA_M, MOSS_MID_M], 0, { roughness: 0.95, grain: [MOSS_ULTRA_M * 0.7, MOSS_ULTRA_M] }, 24, 1);
  const saplings = mk('saplings', variants(3, `${seed}/sapling`, pal, saplingGeometry), 'bush', [16, 40], 1, { sway: 1.6, flutter: 0.02, stiffness: 0.6 });

  const tint = new Color();
  const placeInstance = (set: LodInstancedSet, x: number, z: number, s: FieldSample, rng: Rng, scale: number, tiltAmount: number, sink: number, color: Color, sxz = scale, variantRange: readonly [number, number] = [0, set.variantCount]) => {
    const y = T.height(x, z) - sink;
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, tiltAmount, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(variantRange[0], variantRange[1]), color);
  };
  const greenVar = (rng: Rng, amount = 0.14) => tint.setRGB(1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2);

  // the mossy boulder in shot D's left foreground anchors an authored fern + broadleaf cluster
  const dBoulder = ctx.layout.heroBoulders.find((b) => b.id === 'shot-d-boulder');
  const dbx = dBoulder?.position[0] ?? -3.2;
  const dbz = dBoulder?.position[2] ?? -10.2;
  // the ring clusters are laid around the rock's clearance radius (layout `clearRadius`), not the
  // rendered radius, so the rock can be resized without moving the fronds and their streams
  const dbr = dBoulder?.clearRadius ?? dBoulder?.radius ?? 0.9;
  // 2026-09-21 (fable-2's W23 move, take-0128): the rock now stands at the frame's spot (−2.0, −7.6), 5 m from
  // camera D, and its mound went with it; frame 56 s' lit fern clump is 10–12 m from D, up-left of the rock —
  // following the rock put the crowns at D's bottom-left edge (root sx −0.04). The clump is authored
  // (HERO_CLUMP_SPOTS / HERO_CLUMP_ANCHOR, top of file), independent of the boulder.
  const [hcx, hcz] = HERO_CLUMP_ANCHOR;
  const cameraXZ = ctx.layout.viewpoints.map((v) => [v.position[0], v.position[2]] as const);
  const nearCamera = (x: number, z: number, r: number) => cameraXZ.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < r);

  // ---- ferns: embankments, tree bases, boulders, house shade, path verges
  scatter(
    ctx,
    field,
    {
      label: 'ferns',
      candidates: Math.round(26000 * q.density),
      minSpacing: 0.42,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.35) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0.2) return 0;
        // camera C's left third is grass only (reference frame 46); fronds reach ≈ 1.1 m
        if (field.sightlineC(x, z, 1.1) > 0) return 0;
        const gd = field.giantDistance(x, z);
        const bd = field.boulderDistance(x, z);
        const house = field.houseInfo(x, z);
        const low = field.lowZone(x, z);
        let p = 0.055 * field.falloff(x, z);
        p *= 1 + 3.2 * smoothstep(0.15, 0.45, s.slope) * (1 - s.cliff) * (1 - low);
        p *= 1 + 3 * (1 - smoothstep(0.35, 2.6, edge));
        p *= 1 + 3.5 * (1 - smoothstep(0.2, 3.2, gd));
        p *= 1 + 3 * (bd > 0.15 ? 1 - smoothstep(0.15, 1.6, bd) : 0);
        p *= 1 + 4 * (house.dist > 0.3 ? (1 - smoothstep(0.3, 3.5, house.dist)) * house.shade : 0);
        p *= 0.45 + 1.1 * field.cluster(x, z);
        // the low verge right of the north path keeps only a few small ferns (reference frame 56)
        p *= 1 - 0.7 * low;
        // around the shot-D boulder the authored cluster below stands alone (reference: 3–5 fronds)
        p *= smoothstep(1.2, 3.0, Math.hypot(x - dbx, z - dbz));
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, (0.6 + rng() * 0.55) * (1 - 0.4 * field.lowZone(x, z)), 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // Shot D left-centre: understory fronds on the boulder's path-facing (east) side, between the
  // rock and the flagstones. Kept at undergrowth scale — the reference's big lit clump is the
  // hero crown WEST of the rock below; east of it the footage shows violets over short grass.
  const fernsBeforeShotD = ferns.count;
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotD',
      candidates: 1200,
      box: [dbx - 0.2, dbz - 1.5, dbx + 1.9, dbz + 1.5],
      minSpacing: 0.75,
      accept(x, z) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0.2) return 0;
        const d = Math.hypot(x - dbx, z - dbz) - dbr;
        if (d < 0.05 || d > 1.1) return 0;
        return 0.7;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.8 + rng() * 0.25, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  /** the boulder ring's fronds: frame 56's cluster, kept when the lawn band is cleared of fern clumps below */
  const shotDRingFerns = new Set(ferns.items.slice(fernsBeforeShotD));
  // Shot-D hero clump (reference 0.05–0.14 × 0.55–0.68: a lit mass of big arching fronds LEFT of
  // the mossy rock, against the dark north-west-near trunk). Three tree-fern crowns on the bank
  // slope west of the boulder, 6–8 m from camera D so the fronds read at pinna scale; the rock's
  // near face hides their rootstocks as in the footage. Authored spots, jittered by a forked stream.
  {
    const rng = ctx.rng.fork('plants/hero-ferns-shotD');
    const s = newSample();
    const spots = HERO_CLUMP_SPOTS;
    for (const [cx, cz, sc] of spots) {
      const x = cx + (rng() - 0.5) * 0.16;
      const z = cz + (rng() - 0.5) * 0.16;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
      placeInstance(heroFerns, x, z, s, rng, sc * (0.96 + rng() * 0.08), 0.45, 0.02, greenVar(rng, 0.1));
    }
    // pale-yellow blooms at the crowns' feet, on the camera side so they show under the fronds
    let blooms = 0;
    for (let i = 0; i < 40 && blooms < 6; i++) {
      const x = hcx - 1.7 + rng() * 1.3;
      const z = hcz - 1.6 + rng() * 2.4;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
      if (Math.hypot(x - dbx, z - dbz) < dbr + 0.15) continue;
      placeInstance(yellowFlowers, x, z, s, rng, 0.7 + rng() * 0.25, 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1));
      blooms++;
    }
  }
  // Shot D right verge (reference 0.55–0.85 × 0.60–0.72): low grass with a few small ferns,
  // nothing above ≈ 0.5 m; kept north of camera C's sight line.
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotD-right',
      candidates: 400,
      box: [2.8, -15.5, 6.2, -10],
      minSpacing: 1.6,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 0.5 || s.cliff > 0.3 || field.sightlineC(x, z, 0.7) > 0) return 0;
        return 0.5;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.55 + rng() * 0.15, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // Shot B right edge (reference 0.90–1.0 × 0.55–0.75): fern clumps on the stair-flank embankment
  // east of the hedge. Camera C looks along the same bank from the north: the old clump at
  // x 8–9.5, z −4.9…−3.6 sat 5.5–6.4 m in front of C, right over the stair foot (frame 46 shows
  // steps at (0.10–0.20, 0.60–0.66), not fronds). The bank rises steeply past x ≈ 9, so clumps
  // seated there still project to B's x ≈ 0.88–0.97 while their fronds stay off C's left edge.
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotB',
      candidates: 1800,
      box: [8.6, -6.6, 10.4, -4.6],
      minSpacing: 0.55,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 0.3 || s.cliff > 0.3) return 0;
        if (field.sightlineC(x, z, 1.25) > 0) return 0;
        const b = field.screenX('B_house', x, z);
        if (b && b.sx > 0.975) return 0;
        return 0.8;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 1.05 + rng() * 0.3, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // ---- east bank: the stair's right flank rising from the plaza's south-east verge (frame 8's
  // 0.6–1.0 × 0.3–0.7 and frame 1's 0.8–1.0 × 0.3–0.6). The reference shows a shaded bank densely
  // covered with dark ferns, moss and broad-leaf ground cover around the kid, not a bare lawn:
  // ≈ 1 fern per 2 m² (0.4–0.65 m), a few lit hero crowns, paddle-leaf weeds and moss cushions.
  // Kept off camera C's stair-foot wedge, the kid's spot (kokiri-a) and the stair-foot rock.
  const eastBank = (x: number, z: number, s: FieldSample, reach: number) => {
    if (s.cliff > 0.35 || s.h > 4.6) return false;
    if (field.edgeDistance(x, z) < 0.45) return false;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || clr.npc > 0 || field.boulderDistance(x, z) < 0.25) return false;
    if (field.sightlineC(x, z, reach) > 0) return false;
    return true;
  };
  const EAST_BANK: [number, number, number, number] = [9, -3.2, 16.5, 7.5];
  scatter(
    ctx,
    field,
    { label: 'ferns-east-bank', candidates: 4000, box: EAST_BANK, minSpacing: 0.85, accept: (x, z, s) => (eastBank(x, z, s, 1.0) ? 0.55 + 0.45 * field.cluster(x, z) : 0) },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.8 + rng() * 0.3, 0.7, 0.02, greenVar(rng, 0.18).multiplyScalar(0.94)),
  );
  scatter(
    ctx,
    field,
    { label: 'hero-ferns-east-bank', candidates: 1600, box: EAST_BANK, minSpacing: 1.7, accept: (x, z, s) => (eastBank(x, z, s, 1.0) && s.h > 0.2 ? 0.45 : 0) },
    (x, z, s, rng) => placeInstance(heroFerns, x, z, s, rng, 0.56 + rng() * 0.16, 0.5, 0.02, greenVar(rng, 0.12)),
  );
  scatter(
    ctx,
    field,
    { label: 'weeds-east-bank', candidates: 1800, box: EAST_BANK, minSpacing: 0.9, accept: (x, z, s) => (eastBank(x, z, s, 0.6) ? 0.45 : 0) },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 1.8 + rng() * 0.8, 0.8, 0.012, greenVar(rng, 0.16).multiplyScalar(0.85)),
  );

  // ---- fiddleheads (concept sheet 01 “Forest buds”, sheet 04): 2–4 spiral buds rise from the
  // centre of every hero crown and from about 30 % of the ordinary fern clumps within 15 m of a
  // camera. Their own stream, seeded after every fern is placed, so the ferns never reshuffle.
  // Each bud keeps the fern's own clearances (stones, the trodden strip, camera C's stair foot).
  {
    const rng = ctx.rng.fork('plants/fiddleheads');
    const s = newSample();
    const budsAt = (cx: number, cz: number, spread: number, scale: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const d = spread * (0.3 + 0.7 * rng());
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        field.sample(x, z, s);
        if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
        if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6 || field.sightlineC(x, z, 0.3) > 0) continue;
        // no bud inside a fixed camera's ultra range (the six views' budgets stay untouched whatever the
        // upstream streams do — 2026-09-21: two buds at 3.3 m from camera A after the shot-D boulder moved)
        if (nearCamera(x, z, FIDDLEHEAD_ULTRA_M + 0.2)) continue;
        placeInstance(fiddleheads, x, z, s, rng, scale, 0.5, 0.012, greenVar(rng, 0.12));
      }
    };
    for (const it of heroFerns.items) budsAt(it.x, it.z, 0.16, 1.0 + rng() * 0.1, 2 + rng.int(0, 3));
    for (const it of ferns.items) {
      // the draw comes first so the 30 % pick does not depend on the camera set
      const pick = rng() < 0.3;
      if (!pick || !nearCamera(it.x, it.z, 15)) continue;
      const fernScale = Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
      budsAt(it.x, it.z, 0.1 * fernScale, 0.96 + rng() * 0.14, 2 + rng.int(0, 2));
    }
  }
  // Shot D's hero clump (reference frame 56, 0.05–0.14 × 0.55–0.68): the lit mass left of the
  // mossy rock is five or six TALL unopened bud stalks, 0.6–0.8 m, their yellow-green coils
  // standing above the rock with fronds at their feet. Our boulder projects about twice the
  // reference rock's size (sx 0.05–0.24), so the stalks sit on the bank where their coils clear
  // its left shoulder (root sx 0.01–0.09). The one place the sheet's 0.25–0.45 m bud is outgrown.
  {
    const rng = ctx.rng.fork('plants/fiddleheads-shotD');
    const s = newSample();
    // (2026-09-21: on the camera side of the authored crowns — west of them is the north-west-near
    // giant's trunk at (−6.0, −12.8); roots project at D to sx 0.05–0.09, sy 0.68–0.69)
    const spots: readonly [number, number][] = [
      [hcx + 0.2, hcz + 0.6],
      [hcx - 0.2, hcz + 0.8],
      [hcx - 0.2, hcz + 0.4],
    ];
    for (const [cx, cz] of spots) {
      const x = cx + (rng() - 0.5) * 0.12;
      const z = cz + (rng() - 0.5) * 0.12;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.boulderDistance(x, z) < 0.15) continue;
      // lit khaki-yellow like the footage's buds (sunlit above the green fronds, so they separate
      // from the bank behind), and widened so the stalks read as thumb-thick and the coils as
      // fist-sized bulbs.
      // 2026-09-24: the widening was × 1.7, an anamorphic cheat tuned from camera D alone. The
      // coil geometry is a flat spiral, and at twice scale and 1.7 × width it reads from every
      // other angle as a pale ring cut from cardboard — the owner walks within 4 m of these on his
      // main route (`bud-close`, and they are the pale blobs in his west verge). × 1.25 keeps the
      // coil wider than its stalk without magnifying its flatness. The HEIGHT is untouched, so
      // frame 56's tall stalks and every plants.test contract on them stand.
      const scale = 1.95 + rng() * 0.3;
      placeInstance(fiddleheads, x, z, s, rng, scale, 0.3, 0.015, greenVar(rng, 0.1).multiply(TALL_BUD_TINT), scale * TALL_BUD_WIDTH);
    }
  }

  // ---- bushes: embankments, ledge edges, house bases, the log arch
  scatter(
    ctx,
    field,
    {
      label: 'bushes',
      candidates: Math.round(9000 * q.density),
      minSpacing: 1.3,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 1.1) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0) return 0;
        if (field.giantDistance(x, z) < 0.6) return 0;
        if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.4) > 0) return 0;
        const house = field.houseInfo(x, z);
        const log = field.logDistance(x, z);
        let p = 0.02 * field.falloff(x, z);
        p *= 1 + 2.5 * smoothstep(0.12, 0.4, s.slope) * (1 - s.cliff);
        p *= 1 + 2.5 * smoothstep(0.2, 0.5, s.plateau) * (1 - smoothstep(0.75, 0.95, s.plateau));
        p *= 1 + 4 * (house.dist > 0.6 ? 1 - smoothstep(0.6, 4, house.dist) : 0);
        p *= 1 + 4 * (log > 0.6 ? 1 - smoothstep(0.6, 4.5, log) : 0);
        p *= 1 + 1.2 * (1 - smoothstep(1.1, 3.5, edge));
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.65 + rng() * 0.45, 0.4, 0.03, greenVar(rng, 0.18)),
  );

  // Broad, leafy crowns break up the house banks and ledge tops seen in A/B/D. Reuse the
  // same variant/LOD meshes, so these clusters add instances rather than new draw batches.
  // Probe the crown surroundings as well as its root to avoid crowding path/stair pads.
  const crownSample = newSample();
  scatter(ctx, field, {
    label: 'bushes-ledge-crowns', candidates: Math.round(5200 * q.density),
    box: [-14, -22, 25, 0], minSpacing: 2.3,
    accept(x, z, s) {
      if (field.edgeDistance(x, z) < 1.65) return 0;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0 || field.giantDistance(x, z) < 1.2) return 0;
      if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.8) > 0) return 0;
      if (bushes.items.some(p => Math.hypot(p.x - x, p.z - z) < 2.3)) return 0;
      const house = field.houseInfo(x, z);
      const byHouse = house.dist > 1.3 ? 1 - smoothstep(1.3, 5.5, house.dist) : 0;
      const onLedge = smoothstep(0.18, 0.42, s.plateau) * (1 - smoothstep(0.9, 1, s.plateau));
      if (Math.max(byHouse, onLedge) < 0.2) return 0;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, px = x + Math.cos(a) * 1.35, pz = z + Math.sin(a) * 1.35;
        field.sample(px, pz, crownSample);
        if (!field.allowed(px, pz, crownSample) || field.insideGiantTrunk(px, pz)) return 0;
      }
      return .65 * Math.max(byHouse, onLedge);
    },
  }, (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 1.05 + rng() * .3, .28, .035, greenVar(rng, .15)));

  // ---- shot-A hedge. In reference frame 1 the band left of the stairs beyond the plaza
  // (0.45–0.6 × 0.5–0.65) is a dark shrub/embankment. The row sits on the grass bank east of
  // camera B's door corridor (B's ray x ≈ (2 − z)·0.92): two rows 1.1–2.4 m east of it, so it
  // reads as one dark mass from A while staying right of the door from B. Crown tops are capped
  // at ≈ 1.1 m ABOVE PLAZA LEVEL (≈ 1.2 m tall at the plaza end, shorter as the bank rises) so
  // they project BELOW Saria's door threshold in B (y ≈ 0.55 — the reference B shows the terrace
  // ramp and grass there, not a hedge); ground above 0.6 m is skipped for the same reason.
  // Nothing south of z −5.1, and no crown whose reach enters camera C's left third, so frame 46
  // sees the stair foot, not a bush, at its left edge.
  const bRayX = (z: number) => (2 - z) * 0.92;
  const hedgeHeight = (v: number) => hedge.opts.variants[v][0].boundingBox?.max.y ?? 1.4;
  const HEDGE_TOP = 0.92;
  scatter(
    ctx,
    field,
    {
      label: 'hedge-shotA',
      candidates: 3200,
      box: [7.2, -7.0, 10.6, -5.1],
      minSpacing: 0.45,
      accept(x, z, s) {
        if (x < bRayX(z) + 1.1) return 0;
        if (x > bRayX(z) + 2.4) return 0;
        if (s.cliff > 0.3 || field.edgeDistance(x, z) < 0.5) return 0;
        if (s.h > 0.6) return 0;
        if (field.houseInfo(x, z).dist < 0.4) return 0;
        // crowns here scale to ≈ 0.5–1.1 m reach; the strip's west end sits at C's left edge
        if (field.sightlineC(x, z, 1.0) > 0) return 0;
        return 0.9;
      },
    },
    (x, z, s, rng) => {
      const top = Math.max(0.45, HEDGE_TOP - T.height(x, z)) * (0.9 + rng() * 0.1);
      const variant = rng.int(0, hedge.variantCount);
      const sc = top / hedgeHeight(variant);
      const y = T.height(x, z) - 0.05;
      composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.15 + rng() * 0.2), sc, sc * (1.15 + rng() * 0.2));
      // deep shaded olive (reference #4c5537 shrubs) rather than lit leaf tones; round 14 warms it
      // (red level with green) the way the bank crowns are, see below
      hedge.add(M, variant, tint.setRGB(0.54 + rng() * 0.08, 0.55 + rng() * 0.08, 0.47 + rng() * 0.08));
    },
  );

  // ---- shot-A bank hedge: the dark leafy bushes on the crest of the stair's south bank
  // (terrain S_BANK). Reference frame 1 s: the hedge behind and right of the Kokiri kid, x 0.80–1.0
  // with its top at y ≈ 0.30; frame 8 s: the dark mass on the bank right of the kid (0.6–0.95 ×
  // 0.3–0.5); frame 46 s: dark bushes over the bank behind the stair-foot rock. Crowns are sized
  // so their tops meet camera A's y ≈ 0.30 ray (1.8 m + 0.11 m per metre of depth above the
  // plaza), ≈ 1.7–1.9 m tall. They stay on the crest (off the face and toe), 1.2 m from the kid
  // spots of frames 1 and 8 (placement.ts marches them to ≈ (5.0, 5.3) and (6.2, 3.2)), 0.7 m
  // from the stair-bank rope fence, out of the kokiri-a clearing and the rock ring, and — seen
  // from F — either behind the frame-8 kid or wholly right of his column, so he is never covered.
  // Camera C keeps them beyond the stair-foot rock (depth ≥ 12.2 m): behind it, never over the
  // stair foot at C's left edge.
  const A_BANK_KID: readonly [number, number] = [4.96, 5.29];
  const F_BANK_KID: readonly [number, number] = [6.21, 3.2];
  const bankFence = ROPE_FENCES.find((f) => f.id === 'stair-bank')?.points ?? [];
  const bankFenceDistance = (x: number, z: number) => {
    let best = Infinity;
    for (let i = 0; i < bankFence.length - 1; i++) {
      const [ax, , az] = bankFence[i];
      const [bx, , bz] = bankFence[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  const BANK_CROWN_REACH = 1.1;
  scatter(
    ctx,
    field,
    {
      label: 'hedge-shotA-bank',
      candidates: 1600,
      box: [6.0, 3.9, 8.6, 5.6],
      minSpacing: 0.8,
      accept(x, z, s) {
        if (s.h < 0.55 || s.slope > 0.2 || s.path > 0.02 || s.cliff > 0.3) return 0;
        if (field.edgeDistance(x, z) < 0.6) return 0;
        if (Math.hypot(x - A_BANK_KID[0], z - A_BANK_KID[1]) < 1.2 || Math.hypot(x - F_BANK_KID[0], z - F_BANK_KID[1]) < 1.5) return 0;
        const clr = field.clearing(x, z);
        if (clr.npc > 0 || clr.boulder > 0) return 0;
        if (bankFenceDistance(x, z) < 0.7) return 0;
        const a = field.screenX('A_stairs', x, z);
        if (!a || a.depth < 5.8 || a.sx < 0.84 || a.sx > 1.1) return 0;
        const f = field.screenX('F_canopy', x, z);
        // F's right is +z: the crown's west edge is its left edge in frame 8
        const fEdge = field.screenX('F_canopy', x, z - BANK_CROWN_REACH);
        if (f && fEdge && f.depth < 9.2 && fEdge.sx < 0.62) return 0;
        const c = field.screenX('C_lookback', x, z);
        if (c && c.depth < 12.2) return 0;
        return 0.9;
      },
    },
    (x, z, s, rng) => {
      const depthA = field.screenX('A_stairs', x, z)?.depth ?? 6.5;
      const ground = T.height(x, z);
      const top = clamp(1.8 + 0.11 * depthA - ground, 1.4, 2.1) * (0.92 + rng() * 0.12);
      const variant = rng.int(0, hedge.variantCount);
      const sc = top / hedgeHeight(variant);
      composeMatrix(M, 0, x, ground - 0.05, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.1 + rng() * 0.2), sc, sc * (1.1 + rng() * 0.2));
      // a shade darker than the shot-A hedge: the reference reads these crowns at ≈ 0.22 median
      // luminance in frame 1 (0.9–1.0 × 0.28–0.45) against the lit bank, a soft near-black mass.
      // Round 14: the frame's mass is a warm, desaturated olive (mean RGB 0.27 / 0.26 / 0.18, two
      // thirds of its hues in 30–60°) where the old tint rendered a saturated green (0.25 / 0.26 /
      // 0.17, 90 % of hues in 60–90°): red is lifted over green (the leaf palette is green enough
      // that red level with green still rendered 0.252 / 0.260), blue a touch, the same draws
      hedge.add(M, variant, tint.setRGB(0.53 + rng() * 0.07, 0.48 + rng() * 0.07, 0.44 + rng() * 0.07));
    },
  );

  // ---- shrubby dark mass on the boulder bank west of the north path (reference D 0.15–0.35 ×
  // 0.45–0.60 above the flowers; also the mossy terrace top-left of reference B). Shrubs sit on
  // the bank's slope and top (ground ≥ 1.0 m), off the small north stair and its verge.
  scatter(
    ctx,
    field,
    {
      label: 'bushes-bank',
      candidates: 2400,
      box: [-7.0, -22.5, -2.2, -14.6],
      minSpacing: 1.35,
      accept(x, z, s) {
        if (s.h < 1.0 || s.cliff > 0.4) return 0;
        if (field.edgeDistance(x, z) < 0.9) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.boulder > 0.5) return 0;
        if (field.giantDistance(x, z) < 0.5) return 0;
        return 0.8;
      },
    },
    (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.85 + rng() * 0.4, 0.35, 0.04, tint.setRGB(0.6 + rng() * 0.1, 0.66 + rng() * 0.1, 0.54 + rng() * 0.1)),
  );

  // ---- purple flowers: shot D left foreground, west verge of the spine, shot A left, scattered
  /** flower variants 0–1 are the low cluster heads, 2–3 the taller bell spikes */
  const CLUSTER_HEADS: readonly [number, number] = [0, 2];
  const flowerPlace = (scaleMin: number, scaleMax: number, variantRange?: readonly [number, number]) => (x: number, z: number, s: FieldSample, rng: Rng) =>
    placeInstance(flowers, x, z, s, rng, scaleMin + rng() * (scaleMax - scaleMin), 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1), undefined, variantRange);
  const flowerVerge = (x: number, z: number) => {
    const edge = field.edgeDistance(x, z);
    if (edge < 0.25) return 0;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || clr.npc > 0) return 0;
    // 0.45–0.6 m stalks would rise over camera C's stair foot (frame 46): grass only there
    if (field.sightlineC(x, z, 0.4) > 0) return 0;
    return 1 - smoothstep(0.25, 4, edge) * 0.6;
  };
  // Authored clumps: the reference grows its violets in low, compact clumps 0.3–0.6 m across
  // (5–15 cm blooms), not in beds. Each centre gets a handful of clusters within `radius`.
  const clumps = (label: string, centres: [number, number][], perClump: number, radius: number, scaleMin: number, scaleMax: number, variantRange?: readonly [number, number]) => {
    const rng = ctx.rng.fork(`plants/${label}`);
    const s = newSample();
    const place = flowerPlace(scaleMin, scaleMax, variantRange);
    for (const [cx, cz] of centres) {
      let left = perClump;
      for (let i = 0; i < perClump * 4 && left > 0; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * radius;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        field.sample(x, z, s);
        if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || flowerVerge(x, z) <= 0) continue;
        place(x, z, s, rng);
        left--;
      }
    }
  };
  // Shot D (camera (0.2, 1.9, −3) looking north): reference frame 56 has two modest desaturated
  // violet patches, (0.17–0.27, 0.60–0.67) beside the ferns and (0.05–0.12, 0.55–0.60), plus a
  // few blooms — not a solid field. West of the path the north-west-near giant's trunk fills the
  // frame's left edge, so the clumps sit on the verge strip between its roots and the path (the
  // boulder's east side projects to ≈ 0.18–0.25 × 0.75–0.85) and on the bank slope beyond it at
  // z ≈ −14…−16 (≈ 0.20–0.28 × 0.58–0.67, the reference's first patch).
  // The footage's violets here are LOW cluster heads tucked among the fronds (reference box
  // 0–0.25 × 0.5–0.8 measures hue 55°, i.e. green-dominated with purple accents), so the D clumps
  // are small, use the cluster-head variants only and skip the tall bell spikes.
  // Clump size is the W18 lever: the take-0026 cut left D's purple fraction at 0.0006 (< the
  // rubric's 0.003 floor), so each patch carries 6–7 heads over 0.5 m at bloom scale 1.0–1.3.
  const dClumps: [number, number][] = [[dbx + 1.0, dbz - 0.6], [-3.4, -14.9], [-2.9, -13.6], [-4.0, -15.6], [-3.7, -16.6], [-4.7, -17.6]];
  for (const [i, c] of dClumps.entries()) clumps(`flowers-shotD-clump-${i}`, [c], 12 + (i % 2), 0.65, 1.1, 1.4, CLUSTER_HEADS);
  // a few single blooms along the west verge strip beyond the boulder (reference: "plus a few
  // blooms" beside the fern clump; the near verge in D's bottom-left corner stays grass + litter)
  scatter(ctx, field, { label: 'flowers-shotD-near', candidates: 700, box: [-3.4, -12.6, -1.3, -9.4], minSpacing: 0.8, accept: (x, z) => 0.4 * flowerVerge(x, z) }, flowerPlace(1.0, 1.25, CLUSTER_HEADS));
  // the strip continues south along the west verge (z ≤ −4.6 so camera B's lower-left stays
  // grass): reference A's left-verge purple (0.0–0.14, 0.58–0.66) sits 11–14 m from camera A at
  // its far-left edge. The same ground is camera D's bottom-left corner, where the footage shows
  // sunlit grass and litter with no violets, so the clumps keep to the part of the strip that is
  // off D's left edge (z > −6.3 or x < −3.1: both project to D sx < 0 at sy > 0.9).
  scatter(ctx, field, { label: 'flowers-shotD', candidates: 800, box: [-3.8, -7.5, -1.4, -4.6], minSpacing: 0.55, accept: (x, z) => (z > -6.3 || x < -3.1 ? 0.2 * flowerVerge(x, z) : 0) }, flowerPlace(0.85, 1.1));
  // Shot B right edge: the purple clump at (0.95, 0.60) sits on the stair-flank embankment
  // 1 m above the plaza, among the big ferns; from A it is on the left stair flank. Seated with
  // the ferns past x ≈ 9.3 so it stays off camera C's left edge (flowerVerge rejects the wedge).
  clumps('flowers-shotB', [[9.55, -5.2]], 8, 0.38, 1.05, 1.35);
  // Shot A right edge (reference ≈ 0.95 × 0.50, violets on the stair's right flank above the kid):
  // one low clump on the east bank at (14.2, 0.2) → A (0.95, 0.47), east of camera C's wedge.
  clumps('flowers-shotA-right', [[14.2, 0.2]], 6, 0.4, 0.95, 1.2, CLUSTER_HEADS);
  scatter(ctx, field, { label: 'flowers-shotA', candidates: 1800, box: [-7.5, 2, -2.8, 9.5], minSpacing: 0.5, accept: (x, z) => 0.45 * flowerVerge(x, z) }, flowerPlace(1.0, 1.5));
  scatter(
    ctx,
    field,
    {
      label: 'flowers-scatter',
      candidates: Math.round(14000 * q.density),
      minSpacing: 0.6,
      accept(x, z, s) {
        const v = flowerVerge(x, z);
        if (v <= 0) return 0;
        return 0.1 * field.falloff(x, z) * field.flowerPatch(x, z) * (0.4 + v) * (1 - 0.6 * s.plateau) * (1 - field.giantProximity(x, z)) * (1 - field.lowZone(x, z));
      },
    },
    flowerPlace(0.85, 1.4),
  );

  // ---- white forest flowers (concept sheets 01 “Flower clumps”, 02, 04): small five-petal white
  // clusters with yellow centres, 8–15 blooms per 0.3–0.5 m clump, growing in natural clusters
  // along the path edges, near roots and rocks. Placed AFTER the violets by their own streams, so
  // no purple clump moves; each clump keeps ≥ 0.45 m from every violet so the whites never cover
  // them (D's purple fraction is a scored metric). All clumps are ≤ 0.3 m tall, so they may sit
  // near the Kokiri (≥ 1 m) and the ramp lawn, but they are gated off the stones and the trodden strip.
  const whitePlace = (x: number, z: number, s: FieldSample, rng: Rng) =>
    placeInstance(whiteFlowers, x, z, s, rng, 0.8 + rng() * 0.35, 0.6, 0.01, tint.setRGB(0.96 + rng() * 0.08, 0.96 + rng() * 0.08, 0.94 + rng() * 0.08));
  const nearViolet = (x: number, z: number, r: number) => flowers.items.some((it) => Math.hypot(it.x - x, it.z - z) < r);
  const nearKokiri = (x: number, z: number, r: number) => ctx.layout.npcSpots.some((n) => Math.hypot(x - n.position[0], z - n.position[2]) < r);
  // D's bottom-left corner (the near west verge) stays grass and litter, as for the violets —
  // except the rim strip that frame 14 s shows dotted white (`allowRim`, the B-rim cluster below)
  const dNearCorner = (x: number, z: number) => x > -3.1 && x < -1.4 && z > -9.4 && z < -6.3;
  // (2026-09-21: the rim exception is the strip itself — x > −2.5, ≤ 0.9 m off the lawn edge — not the whole
  // corner: the shot-D boulder's old clearance at (−2.6, −9.6) had been doing that rejection until it moved)
  const dRimStrip = (x: number, z: number) => x > -2.5 && field.lawnEdgeDistance(x, z) <= 0.9;
  const whiteGround = (x: number, z: number, s: FieldSample, cReach = 0.2, allowRim = false) => {
    if (s.cliff > 0.3 || (dNearCorner(x, z) && !(allowRim && dRimStrip(x, z))) || field.bankFace(x, z) > 0.3) return false;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || field.boulderDistance(x, z) < 0.25 || field.giantDistance(x, z) < 0.3) return false;
    if (nearKokiri(x, z, 1.0) || field.sightlineC(x, z, cReach) > 0 || nearViolet(x, z, 0.45)) return false;
    return true;
  };
  // B / E left lawn edge (frame 14 s: a few white dots at 0–0.4 × 0.6–0.85): the west verge of the
  // spine, 0.3–1.8 m off the flagstones, from the boulder north to the bank
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-west-verge',
      candidates: 3000,
      box: [-4.0, -16.5, -0.8, -5.0],
      minSpacing: 0.8,
      max: 12,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3 || edge > 1.8 || !whiteGround(x, z, s)) return 0;
        return 0.7 * (1 - 0.5 * smoothstep(0.3, 1.8, edge));
      },
    },
    whitePlace,
  );
  // the stepping-stone ramp's outer lawn (frames 14 / 24), off the trodden strip and the spine's verge
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-ramp',
      candidates: 3000,
      box: [1.0, -10.5, 10.5, -1.5],
      minSpacing: 0.9,
      max: 9,
      accept(x, z, s) {
        if (field.troddenZone(x, z) > 0) return 0;
        const ramp = field.rampDistance(x, z);
        if (ramp < 1.3 || ramp > 3.2 || field.lawnEdgeDistance(x, z) < 0.4 || field.houseInfo(x, z).dist < 1.0) return 0;
        return whiteGround(x, z, s) ? 0.7 : 0;
      },
    },
    whitePlace,
  );
  // shot A's right bank near the kid (frame 1: 0.8–1 × 0.3–0.6, the stair's south flank above the
  // kid). With the flight re-laid toward the plaza (aff169d) that box is the flank 11–15 m out at
  // 1–3.3 m of ground, x 10.5–14.5; the old depth-only gate (≥ 11.5 m, x ≥ 10.8) now put the clumps
  // on the plateau ramp at 3–4 m, above the box (A y 0.26–0.34), so each clump is projected in full.
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-east-bank',
      candidates: 3000,
      box: [10.0, -3.0, 15.5, 2.5],
      minSpacing: 0.8,
      max: 8,
      accept(x, z, s) {
        if (s.h > 4.6 || field.edgeDistance(x, z) < 0.45 || !whiteGround(x, z, s)) return 0;
        const a = field.screenPoint('A_stairs', x, T.height(x, z), z);
        return a && a.sx >= 0.81 && a.sx <= 0.99 && a.sy >= 0.32 && a.sy <= 0.58 ? 0.7 : 0;
      },
    },
    whitePlace,
  );
  // sparingly among the shot-D verge ferns, on the bank behind the edge strip
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-d-verge',
      candidates: 2000,
      box: [-5.6, -17.5, -2.4, -9.6],
      minSpacing: 1.1,
      max: 5,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 1.6 || !whiteGround(x, z, s)) return 0;
        return 0.6;
      },
    },
    whitePlace,
  );
  // natural clusters elsewhere within 25 m of the cameras: path edges, boulder feet and tree roots
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-scatter',
      candidates: Math.round(12000 * q.density),
      minSpacing: 1.2,
      max: 14,
      accept(x, z, s) {
        if (!nearCamera(x, z, 25) || !whiteGround(x, z, s, 0.3)) return 0;
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3) return 0;
        const verge = 1 - smoothstep(0.3, 1.5, edge);
        const rock = 1 - smoothstep(0.25, 1.2, field.boulderDistance(x, z));
        const root = 1 - smoothstep(0.3, 2.5, field.giantDistance(x, z));
        return 0.35 * Math.max(verge, rock, root) * (0.4 + field.flowerPatch(x, z)) * (1 - field.lowZone(x, z));
      },
    },
    whitePlace,
  );

  // ---- broad-leaf plant (hosta-like paddle leaves) beside the shot-D boulder, with the ferns
  scatter(
    ctx,
    field,
    {
      label: 'weeds-shotD-boulder',
      candidates: 900,
      box: [dbx - 0.4, dbz - 1.5, dbx + 1.7, dbz + 1.5],
      minSpacing: 0.5,
      accept(x, z) {
        if (field.edgeDistance(x, z) < 0.3) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder) return 0;
        const d = Math.hypot(x - dbx, z - dbz) - dbr;
        return d > 0.0 && d < 1.0 ? 0.6 : 0;
      },
    },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 2.4 + rng() * 0.9, 0.8, 0.012, greenVar(rng, 0.16).multiplyScalar(0.82)),
  );

  // ---- broad-leaf weeds: verges and clearings, in yellow-green patches
  scatter(
    ctx,
    field,
    {
      label: 'weeds',
      candidates: Math.round(60000 * q.density),
      minSpacing: 0.22,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.15) return 0;
        const clr = field.clearing(x, z);
        // the turf face climbing off the paving beside the shot-A kid is grass only (frame 1)
        if (clr.insideBoulder || field.bankFace(x, z) > 0.3) return 0;
        let p = 0.42 * field.falloff(x, z) * (0.3 + field.flowerPatch(x, z)) * field.cluster(x, z);
        p *= 1 + 1.6 * (1 - smoothstep(0.15, 3, edge));
        p *= 1 - 0.6 * field.giantProximity(x, z);
        p *= 1 - 0.5 * clr.npc;
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 0.65 + rng() * 0.65, 0.8, 0.012, greenVar(rng, 0.22)),
  );
  // 2026-09-21: camera C's foreground broad-leaf clusters (frame 26 s' bottom-left mass: ≥ 16 hostas of scale
  // ≥ 1.05 in [3.6, −5.8, 6.8, −3.4] projecting into C's (−0.02…0.34, 0.76…1.02)) are a scored composition,
  // and the main stream's acceptance there shifts whenever an upstream set moves (the shot-D boulder, the
  // hero clump: 17 → 13 twice this round). The box is topped up to its round-45 count from its own stream.
  {
    const C_FG: [number, number, number, number] = [3.6, -5.8, 6.8, -3.4];
    const inCFrame = (x: number, z: number) => {
      const p = field.screenPoint('C_lookback', x, T.height(x, z), z);
      return !!p && p.sx >= 0.0 && p.sx <= 0.32 && p.sy >= 0.78 && p.sy <= 1.0;
    };
    const have = weeds.items.filter((it) => it.x > C_FG[0] && it.x < C_FG[2] && it.z > C_FG[1] && it.z < C_FG[3] && Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]) >= 1.05 && inCFrame(it.x, it.z)).length;
    scatter(
      ctx,
      field,
      {
        label: 'weeds-c-foreground',
        candidates: 4000,
        box: C_FG,
        minSpacing: 0.3,
        max: Math.max(0, 16 - have),
        accept(x, z, s) {
          const edge = field.edgeDistance(x, z);
          if (edge < 0.15 || field.clearing(x, z).insideBoulder || field.bankFace(x, z) > 0.3 || !inCFrame(x, z)) return 0;
          return 0.6 * field.falloff(x, z);
        },
      },
      (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 1.05 + rng() * 0.25, 0.8, 0.012, greenVar(rng, 0.22)),
    );
  }

  // The west-verge white clumps beyond 11 m sit below B's line of sight over the nearer ferns, so
  // the dots that actually read in frame 14 s (0.06–0.14 × 0.70–0.79, just left of the flagstones)
  // come from this cluster on the spine's west rim 7.5–10 m out, the one pocket of that verge with
  // nothing taller in front of it. Placed after the weeds so the blooms are kept out from under the
  // boulder cluster's big paddle leaves. It is also D's bottom-left grass strip: a few clumps only.
  {
    const weedReach = (it: (typeof weeds.items)[number]) =>
      (weeds.opts.variants[it.variant][0].boundingBox?.max.x ?? 0.16) * Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
    const underLeaves = (x: number, z: number) =>
      weeds.items.some((it) => {
        const r = weedReach(it);
        return r >= 0.25 && Math.hypot(it.x - x, it.z - z) < r;
      });
    scatter(
      ctx,
      field,
      {
        label: 'white-flowers-b-rim',
        candidates: 2500,
        box: [-2.5, -9.4, -1.6, -7.0],
        minSpacing: 0.35,
        max: 4,
        accept(x, z, s) {
          const edge = field.lawnEdgeDistance(x, z);
          if (edge < 0.15 || edge > 0.8 || field.troddenZone(x, z) > 0 || !whiteGround(x, z, s, 0.2, true) || underLeaves(x, z)) return 0;
          const b = field.screenX('B_house', x, z);
          return b && b.sx >= 0.075 && b.sx <= 0.145 && b.depth >= 7.5 && b.depth <= 10.2 ? 0.8 : 0;
        },
      },
      // the top of the clump size range: these are the dots the frame is scored on
      (x, z, s, rng) => placeInstance(whiteFlowers, x, z, s, rng, 1.0 + rng() * 0.15, 0.6, 0.01, tint.setRGB(0.98 + rng() * 0.06, 0.98 + rng() * 0.06, 0.96 + rng() * 0.06)),
    );
  }

  // ---- seed-head stalks: meadow patches
  scatter(
    ctx,
    field,
    {
      label: 'seedheads',
      candidates: Math.round(30000 * q.density),
      minSpacing: 0.2,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.4) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0) return 0;
        // 0.6–0.9 m stalks stay out of the low verges, camera C's left third and thin out in the
        // tidy foreground
        return 0.28 * field.falloff(x, z) * field.meadow(x, z) * (0.5 + field.cluster(x, z)) * (1 - field.giantProximity(x, z)) * (1 - field.lowZone(x, z)) * (1 - field.sightlineC(x, z, 0.5)) * (1 - 0.6 * field.trimZone(x, z));
      },
    },
    (x, z, s, rng) => placeInstance(seedheads, x, z, s, rng, 0.75 + rng() * 0.5, 0.5, 0.01, tint.setRGB(0.95 + rng() * 0.12, 0.95 + rng() * 0.08, 0.9 + rng() * 0.1)),
  );

  // ---- clover: low herb layer along verges and under trees
  scatter(
    ctx,
    field,
    {
      label: 'clover',
      candidates: Math.round(40000 * q.density),
      minSpacing: 0.18,
      low: true,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.1) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || field.bankFace(x, z) > 0.3) return 0;
        let p = 0.16 * field.falloff(x, z) * (0.4 + field.cluster(x, z));
        p *= 1 + 1.5 * (1 - smoothstep(0.1, 4, edge));
        p *= 1 + 0.8 * field.giantProximity(x, z, 5);
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.75 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2)),
  );
  // Clover hugging Saria's stepping stones (frames 14 / 24: a green fringe at each slab's rim where
  // feet never land): 6–9 tufts per stone within 0.25 m of the rim, seated by their own stream.
  {
    const rng = ctx.rng.fork('plants/clover-stones');
    const s = newSample();
    for (const st of houseSteppingStones()) {
      let left = 6 + rng.int(0, 4);
      for (let i = 0; i < 40 && left > 0; i++) {
        const a = rng() * Math.PI * 2;
        const d = st.r + 0.04 + rng() * 0.21;
        const x = st.x + Math.cos(a) * d;
        const z = st.z + Math.sin(a) * d;
        field.sample(x, z, s);
        if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z)) continue;
        if (field.stoneDistance(x, z) < 0.03) continue;
        placeInstance(clover, x, z, s, rng, 0.8 + rng() * 0.45, 0.9, 0.008, greenVar(rng, 0.16));
        left--;
      }
    }
  }

  // ---- moss tufts: boulder bases, tree roots, shaded embankments
  const mossRng = ctx.rng.fork('plants/moss');
  const mossSample = newSample();
  const placeMossWith = (rng: Rng, x: number, z: number, radius: number, r32 = false): boolean => {
    field.sample(x, z, mossSample);
    if (!field.allowed(x, z, mossSample, r32) || field.insideGiantTrunk(x, z)) return false;
    const y = T.height(x, z) - 0.012;
    const h = radius * (0.22 + rng() * 0.2);
    composeMatrix(M, 0, x, y, z, mossSample.nx, mossSample.ny, mossSample.nz, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
    const variant = rng.int(0, 2);
    tint.setRGB(0.9 + rng() * 0.2, 0.92 + rng() * 0.16, 0.9 + rng() * 0.2);
    // drawn first so the stream is the same with or without the cushion: the shot-A turf bank
    // (frame 1) stays grass, the stair-foot rock's moss skirt included
    if (field.bankFace(x, z) > 0.3) return false;
    moss.add(M, variant, tint);
    return true;
  };
  const placeMoss = (x: number, z: number, radius: number) => placeMossWith(mossRng, x, z, radius);
  for (const b of ctx.layout.heroBoulders) {
    const n = Math.round(30 * q.density);
    for (let i = 0; i < n; i++) {
      const a = mossRng() * Math.PI * 2;
      const d = (b.clearRadius ?? b.radius) * 0.75 + Math.pow(mossRng(), 1.4) * 1.1;
      placeMoss(b.position[0] + Math.cos(a) * d, b.position[2] + Math.sin(a) * d, 0.05 + mossRng() * 0.16);
    }
  }
  for (const g of ctx.layout.giantTrees) {
    if (Math.hypot(g.position[0], g.position[2]) > ctx.config.detailRadius) continue;
    const n = Math.round(34 * q.density);
    for (let i = 0; i < n; i++) {
      const a = mossRng() * Math.PI * 2;
      const d = g.trunkRadius + 0.25 + Math.pow(mossRng(), 1.5) * 3.2;
      placeMoss(g.position[0] + Math.cos(a) * d, g.position[2] + Math.sin(a) * d, 0.06 + mossRng() * 0.2);
    }
  }
  scatter(
    ctx,
    field,
    {
      label: 'moss-scatter',
      candidates: Math.round(12000 * q.density),
      minSpacing: 0.5,
      low: true,
      accept(x, z, s) {
        // the slope boost would otherwise pick the shot-A bank face, which stays grass (frame 1)
        if (field.edgeDistance(x, z) < 0.2 || field.bankFace(x, z) > 0.3) return 0;
        return 0.03 * field.falloff(x, z) * (0.3 + smoothstep(0.1, 0.4, s.slope)) * (0.5 + field.cluster(x, z)) * (1 - field.dry(x, z));
      },
    },
    (x, z, _s, rng) => placeMoss(x, z, 0.05 + rng() * 0.16),
  );
  // moss cushions between the east-bank ferns (frame 8: moss-green ground cover on the shaded bank)
  scatter(
    ctx,
    field,
    { label: 'moss-east-bank', candidates: 2200, box: EAST_BANK, minSpacing: 0.7, accept: (x, z, s) => (eastBank(x, z, s, 0.3) ? 0.4 * (0.5 + field.cluster(x, z)) : 0) },
    (x, z, _s, rng) => placeMoss(x, z, 0.1 + rng() * 0.16),
  );
  // Path-edge softening (concept sheet 02 “Moss edges” / “Path boundary”): grass and moss creep
  // over the flagstone rim. Dense short moss cushions in the 0.25 m band just outside the paved
  // edge of the spine, the stair branch and the plaza discs (the house branch is a grassy ramp,
  // no rim), walked along the layout polylines and the mask-derived rim by their own stream and
  // checked against the exact terrain mask so nothing lands on a slab. Adds ≈ 20 % to the moss
  // count. The blades leaning over the stones and the dirt-seam litter live in grass.ts /
  // litter.ts. Where the paving meets the foot of the shot-A turf bank (frame 1: grass tufts
  // overhang the slabs, no dark cushion line) the band stays grass.
  {
    const rng = ctx.rng.fork('plants/moss-path-edge');
    field.rimCandidates(rng, RIM_MOSS_CANDIDATES_PER_M * q.density, RIM_BAND, (x, z) => {
      const p = 0.55 * (0.4 + 0.6 * field.cluster(x, z)) * field.falloff(x, z);
      if (rng() > p || field.bankFace(x, z) > 0.3) return;
      placeMossWith(rng, x, z, 0.05 + rng() * 0.09);
    });
  }

  // ---- saplings: quiet spots away from paths and giant trunks
  scatter(
    ctx,
    field,
    {
      label: 'saplings',
      candidates: Math.round(6000 * q.density),
      minSpacing: 3.5,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 2.8) return 0;
        if (field.giantDistance(x, z) < 2.5) return 0;
        if (field.boulderDistance(x, z) < 1.2) return 0;
        if (field.houseInfo(x, z).dist < 2.5 || field.logDistance(x, z) < 2) return 0;
        if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.5) > 0) return 0;
        const clr = field.clearing(x, z);
        if (clr.npc > 0 || clr.boulder > 0) return 0;
        if (s.slope > 0.35) return 0;
        return 0.008 * (0.3 + field.cluster(x, z));
      },
    },
    (x, z, s, rng) => placeInstance(saplings, x, z, s, rng, 0.7 + rng() * 0.6, 0.3, 0.03, greenVar(rng, 0.16)),
  );

  // ======== Round 13: foreground framing and ground detail (owner boards 01 / 02 / 06 / 08,
  // frames 1 s / 14 s / 46 s / 56 s). Everything below runs after the scatters above from its own
  // streams, so no earlier plant moves; each cluster is seated where the reference's screen box
  // unprojects onto OUR ground, through `field.screenPoint`, and keeps every standing rule (the
  // paving, the shot-A bank face, the kids' spots, camera C's stair-foot wedge, the stones).
  {
    const kidSpots: readonly (readonly [number, number])[] = [...ctx.layout.npcSpots.map((n) => [n.position[0], n.position[2]] as const), A_BANK_KID, F_BANK_KID];
    const nearKid = (x: number, z: number, r: number) => kidSpots.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < r);
    const nearWhite = (x: number, z: number, r: number) => whiteFlowers.items.some((it) => Math.hypot(it.x - x, it.z - z) < r);
    /** the plant's root, seated on the ground, projects inside the viewpoint's box [x0, y0, x1, y1] */
    const inFrame = (viewpointId: string, x: number, z: number, box: readonly [number, number, number, number], minDepth = 0) => {
      const p = field.screenPoint(viewpointId, x, T.height(x, z), z);
      return !!p && p.depth >= minDepth && p.sx >= box[0] && p.sx <= box[2] && p.sy >= box[1] && p.sy <= box[3];
    };
    /** ground every plant of this round needs: off the stones and the trodden strip, off the bank face, clear of the kids and the rock rings */
    const clearGround = (x: number, z: number, s: FieldSample) => {
      if (s.cliff > 0.3 || field.bankFace(x, z) > 0.3 || field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6) return false;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0 || field.boulderDistance(x, z) < 0.3 || field.giantDistance(x, z) < 0.3) return false;
      return !nearKid(x, z, 1.2);
    };
    /** clear ground that also keeps a plant of this `reach` out of camera C's stair-foot wedge and the grass around the camera */
    const standingGround = (x: number, z: number, s: FieldSample, reach: number) => clearGround(x, z, s) && field.sightlineC(x, z, reach) === 0;
    /** `per` plants within `radius` of each centre from one stream; `ok` gates each spot, `place` seats it */
    const clusterAt = (label: string, centres: readonly (readonly [number, number])[], per: number, radius: number, ok: (x: number, z: number, s: FieldSample) => boolean, place: (x: number, z: number, s: FieldSample, rng: Rng) => void) => {
      const rng = ctx.rng.fork(`plants/${label}`);
      const s = newSample();
      for (const [cx, cz] of centres) {
        let left = per;
        for (let i = 0; i < per * 5 && left > 0; i++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * radius;
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder || !ok(x, z, s)) continue;
          place(x, z, s, rng);
          left--;
        }
      }
    };
    // board 06 "small plants, flowers, rocks and leaves": heart / ovate laminae 15–30 cm across
    // (variant spans × 1.3–2.2), ≤ 0.33 m tall so they pass under every "grass only" height rule
    const broadleafPlace = (scaleMin: number, scaleMax: number, dark = 0.9) => (x: number, z: number, s: FieldSample, rng: Rng) => placeInstance(weeds, x, z, s, rng, scaleMin + rng() * (scaleMax - scaleMin), 0.8, 0.012, greenVar(rng, 0.18).multiplyScalar(dark));
    const broadleafGround = (x: number, z: number, s: FieldSample) => clearGround(x, z, s) && field.lawnEdgeDistance(x, z) >= 0.2 && !nearWhite(x, z, 0.45);
    const newFerns: { x: number; z: number; scale: number }[] = [];

    // ---- (2) frame 14 s' lawn band (field.ts LAWN_BAND): the fern clumps the general scatter
    // grew on the near west verge come out — the band is short turf with white dots in the
    // footage, and the clumps stood between camera B and the far dots. Pruned after the fiddlehead
    // pass so the buds elsewhere keep their stream; the buds that stood in the removed clumps go
    // with them. The shot-D boulder ring keeps its fronds (frame 56's cluster beside the rock).
    {
      const removed: { x: number; z: number }[] = [];
      ferns.prune((it) => {
        if (shotDRingFerns.has(it) || field.lawnBand(it.x, it.z) <= 0.5) return false;
        removed.push({ x: it.x, z: it.z });
        return true;
      });
      const crownLeft = (x: number, z: number) => ferns.items.concat(heroFerns.items).some((f) => Math.hypot(f.x - x, f.z - z) <= 0.2);
      fiddleheads.prune((b) => removed.some((f) => Math.hypot(f.x - b.x, f.z - b.z) <= 0.25) && !crownLeft(b.x, b.z));
    }

    // ---- (1) / (3) the west verge bed: frame 1 s' left edge (A 0–0.12 × 0.45–0.58 is the verge
    // 14–20 m out; its 0.6–0.75 is the plaza's paving) and frame 56's bottom-left cluster (D 0–0.2
    // × 0.6–0.72 beyond the near grass strip) are the same ground: the verge and bank slope from the
    // shot-D boulder north to the mist hollow, x −4.8…−2.3, z −11.2…−16.5, where the six D clumps
    // already grow. It gets a fern cluster (0.6–0.9 m), three more purple clumps and broad-leaf
    // clusters. The near strip south of the boulder (D's bottom-left corner) stays grass — it is
    // frame 14 s' lawn band.
    const WEST_BED: [number, number, number, number] = [-4.8, -16.5, -2.3, -11.2];
    const D_BED_BOX: [number, number, number, number] = [-0.02, 0.56, 0.22, 0.74];
    scatter(
      ctx,
      field,
      {
        label: 'ferns-west-bed',
        candidates: 1500,
        box: WEST_BED,
        minSpacing: 0.7,
        max: 6,
        accept: (x, z, s) => (field.edgeDistance(x, z) >= 0.5 && standingGround(x, z, s, 1.0) && !nearWhite(x, z, 0.6) && inFrame('D_log', x, z, D_BED_BOX) ? 0.7 : 0),
      },
      (x, z, s, rng) => {
        const scale = 0.95 + rng() * 0.35;
        newFerns.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.2));
      },
    );
    clusterAt(
      'flowers-west-bed',
      [
        [-2.75, -11.75],
        [-3.55, -12.55],
        [-2.7, -14.35],
      ],
      9,
      0.45,
      (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && inFrame('D_log', x, z, D_BED_BOX),
      flowerPlace(1.05, 1.4),
    );
    clusterAt(
      'weeds-west-bed',
      [
        [-2.6, -12.4],
        [-3.3, -14.1],
        [-3.0, -15.6],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('D_log', x, z, [-0.02, 0.55, 0.24, 0.76]),
      broadleafPlace(1.7, 2.4, 0.85),
    );

    // ---- (1) frame 1 s' right bank behind the kid (A 0.8–1.0 × 0.45–0.75): ferns and a hedge, not
    // grass. The hedge crowns are there (hedge-shotA-bank); the crest between them and the kid takes
    // 0.5–0.75 m fern clumps and a skirt of broad leaves, on the flat crest only (the bank FACE stays
    // grass, frame 1's lit tufts), ≥ 1.2 m from both kid spots, 0.4 m off the stair-bank rope
    // fence, beyond the stair-foot rock from camera C (depth ≥ 12.1 m) and never over the frame-8
    // kid from F (the hedge's rule).
    const A_BANK_BOX: [number, number, number, number] = [0.8, 0.45, 1.02, 0.74];
    const bankCrest = (x: number, z: number, s: FieldSample, reach: number) => {
      if (s.slope > 0.18 || s.path > 0.02 || s.cliff > 0.3 || field.edgeDistance(x, z) < 0.5 || field.bankFace(x, z) > 0.3) return false;
      if (nearKid(x, z, 1.2) || field.clearing(x, z).npc > 0 || field.boulderDistance(x, z) < 0.3 || bankFenceDistance(x, z) < 0.4) return false;
      if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6) return false;
      const c = field.screenX('C_lookback', x, z);
      if (c && c.depth < 12.1) return false;
      if (field.sightlineC(x, z, reach) > 0) return false;
      const f = field.screenX('F_canopy', x, z);
      const fEdge = field.screenX('F_canopy', x, z - reach);
      if (f && fEdge && f.depth < 9.2 && fEdge.sx < 0.62) return false;
      return true;
    };
    scatter(
      ctx,
      field,
      {
        label: 'ferns-a-bank',
        candidates: 2000,
        box: [6.0, 3.5, 8.8, 5.6],
        minSpacing: 0.6,
        max: 8,
        accept: (x, z, s) => (bankCrest(x, z, s, 0.75) && !nearWhite(x, z, 0.5) && inFrame('A_stairs', x, z, A_BANK_BOX, 5.5) ? 0.7 : 0),
      },
      (x, z, s, rng) => {
        const scale = 0.8 + rng() * 0.3;
        newFerns.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.18).multiplyScalar(0.94));
      },
    );
    scatter(
      ctx,
      field,
      {
        label: 'weeds-a-bank',
        candidates: 2500,
        box: [6.0, 3.2, 9.0, 5.6],
        minSpacing: 0.3,
        max: 16,
        accept: (x, z, s) => (bankCrest(x, z, s, 0.4) && s.slope <= 0.12 && !nearWhite(x, z, 0.4) && inFrame('A_stairs', x, z, [0.78, 0.5, 1.02, 0.8], 5.0) ? 0.8 : 0),
      },
      broadleafPlace(1.6, 2.2, 0.85),
    );

    // ---- (2) frame 14 s' right foreground (B 0.85–1.0 × 0.55–0.9): a dark leafy mass of fronds,
    // coils and purple bells. Its lower half is camera C's left third at 4–6 m and Saria's ramp
    // (grass only, frame 46), so the mass thickens on the stair-flank bank 8–10 m out, x 8–9.6,
    // z −6.2…−3.4, around the door-side hedge: 0.55–0.8 m fern clumps with buds, purple clumps
    // and broad-leaf skirts, none of it inside C's wedge.
    const B_MASS_BOX: [number, number, number, number] = [0.85, 0.52, 1.0, 0.82];
    scatter(
      ctx,
      field,
      {
        label: 'ferns-shotB-near',
        candidates: 2000,
        box: [8.0, -6.2, 9.6, -3.4],
        minSpacing: 0.55,
        max: 8,
        accept: (x, z, s) => (field.edgeDistance(x, z) >= 0.3 && standingGround(x, z, s, 1.0) && field.houseInfo(x, z).dist >= 0.5 && !nearWhite(x, z, 0.5) && inFrame('B_house', x, z, B_MASS_BOX) ? 0.7 : 0),
      },
      (x, z, s, rng) => {
        const scale = 0.9 + rng() * 0.3;
        newFerns.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.2));
      },
    );
    clusterAt(
      'flowers-shotB-near',
      [
        [8.6, -4.4],
        [8.3, -5.6],
        [9.1, -3.9],
      ],
      8,
      0.4,
      (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && !nearKid(x, z, 1.2) && inFrame('B_house', x, z, B_MASS_BOX),
      flowerPlace(1.05, 1.35),
    );
    clusterAt(
      'weeds-shotB-near',
      [
        [8.3, -4.0],
        [8.9, -5.9],
        [8.2, -5.0],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('B_house', x, z, [0.84, 0.52, 1.0, 0.86]),
      broadleafPlace(1.7, 2.4, 0.85),
    );

    // fiddleheads for this round's fern clumps (sheet 01: 2–3 buds in a share of the near crowns),
    // their own stream after every clump above is seated
    {
      const rng = ctx.rng.fork('plants/fiddleheads-r13');
      const s = newSample();
      for (const f of newFerns) {
        if (rng() > 0.6) continue;
        const count = 2 + rng.int(0, 2);
        for (let i = 0; i < count; i++) {
          const a = rng() * Math.PI * 2;
          const d = 0.1 * f.scale * (0.3 + 0.7 * rng());
          const x = f.x + Math.cos(a) * d;
          const z = f.z + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
          if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6 || field.sightlineC(x, z, 0.3) > 0) continue;
          placeInstance(fiddleheads, x, z, s, rng, 0.96 + rng() * 0.14, 0.5, 0.012, greenVar(rng, 0.12));
        }
      }
    }

    // ---- (3) frame 56's right verge (D 0.75–1.0 × 0.55–0.85: the slope right of the north path,
    // x 4–8, z −8…−14) — purple and leaf clusters among the short grass. The strip is camera C's
    // grass box, so the violets are the low cluster heads (≤ 0.54 m, the D-right rule) where the
    // wedge allows them (north of z −12.3 or east of x 7.6) and the leaves stay ≤ 0.33 m.
    const D_RIGHT_BOX: [number, number, number, number] = [0.74, 0.52, 1.02, 0.86];
    clusterAt(
      'flowers-shotD-right',
      [
        [5.6, -12.9],
        [6.7, -13.6],
        [6.3, -14.4],
      ],
      8,
      0.4,
      (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && !nearKid(x, z, 1.2) && inFrame('D_log', x, z, D_RIGHT_BOX),
      flowerPlace(0.95, 1.2, CLUSTER_HEADS),
    );
    clusterAt(
      'weeds-shotD-right',
      [
        [3.6, -7.7],
        [4.6, -9.4],
        [5.4, -11.0],
        [7.2, -12.2],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('D_log', x, z, D_RIGHT_BOX),
      broadleafPlace(1.5, 2.1),
    );
    // ---- (4) frame 46's foreground (C 0–0.3 × 0.8–1.0: the grass 3–5 m in front of camera C) —
    // heart-leaf clusters in the turf, 0.33 m at most so the stair foot stays visible over them
    clusterAt(
      'weeds-shotC-foot',
      [
        [4.3, -4.4],
        [5.5, -4.0],
        [6.2, -4.8],
        [4.9, -5.2],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('C_lookback', x, z, [-0.02, 0.78, 0.32, 1.02]),
      // 4-6 m from camera C: at 1.5-2.1 the cluster filled C's bottom-left to green 0.74 vs the
      // frame's 0.45; 1.1-1.5 keeps it a foreground accent
      broadleafPlace(1.1, 1.5),
    );

    // ---- (5) broad-leaf clusters along every path edge within reach of the cameras (board 06):
    // 5–12 leaves per cluster 0.3–1.3 m outside the paving, ≤ 0.32 m tall, off the bank face, the
    // kids' spots, the boulder rings, the stones and the near west verge (frame 14 s' lawn band),
    // never over a white clump. One stream draws the cluster centres and their leaves.
    {
      const rng = ctx.rng.fork('plants/weeds-rim-clusters');
      const s = newSample();
      const spacing = new Spacing(2.4);
      const R = ctx.config.detailRadius;
      const place = broadleafPlace(1.3, 2.1);
      let clusters = 0;
      for (let i = 0; i < 6000 && clusters < 44; i++) {
        const cx = -R + rng() * 2 * R;
        const cz = -R + rng() * 2 * R;
        if (!nearCamera(cx, cz, 22)) continue;
        const edge = field.lawnEdgeDistance(cx, cz);
        if (edge < 0.3 || edge > 1.3) continue;
        field.sample(cx, cz, s);
        if (!field.allowed(cx, cz, s) || field.insideGiantTrunk(cx, cz) || !broadleafGround(cx, cz, s) || field.lawnBand(cx, cz) > 0) continue;
        if (!spacing.ok(cx, cz, 2.4)) continue;
        spacing.add(cx, cz);
        clusters++;
        let left = 5 + rng.int(0, 8);
        for (let k = 0; k < 40 && left > 0; k++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * 0.5;
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || !broadleafGround(x, z, s) || field.lawnBand(x, z) > 0) continue;
          place(x, z, s, rng);
          left--;
        }
      }
    }

    // ---- (2) the lawn band itself: dense short turf is grass.ts' second pass; here the white dots
    // frame 14 s has (0–0.3 × 0.62–0.9, ≈ 12–20 of them — the paving's lawn pocket is hardscape's,
    // so ours sit on the verge north of it, 7.5–13.5 m from camera B), clover between them and a
    // few moss cushions for the footage's mossy stones. The character system stands frame 14 s'
    // kid at B (0.035, 0.885), 4.6 m out, so he covers sx 0–0.07 up to y ≈ 0.58: the dots keep to
    // the strip beside the paving that shows past him (sx ≥ 0.075). Placed after every violet and
    // leaf above, so they cover none and sit under none.
    const underLeaves = (x: number, z: number) =>
      weeds.items.some((it) => {
        const r = (weeds.opts.variants[it.variant][0].boundingBox?.max.x ?? 0.16) * Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
        return r >= 0.25 && Math.hypot(it.x - x, it.z - z) < r;
      });
    scatter(
      ctx,
      field,
      {
        label: 'white-flowers-lawn-band',
        candidates: 5000,
        box: field.lawnBandBox(),
        minSpacing: 0.35,
        max: 12,
        accept(x, z, s) {
          const edge = field.lawnEdgeDistance(x, z);
          if (edge < 0.2 || edge > 1.5 || field.troddenZone(x, z) > 0 || !whiteGround(x, z, s, 0.2, true) || underLeaves(x, z)) return 0;
          const b = field.screenPoint('B_house', x, T.height(x, z), z);
          return b && b.depth <= 13.5 && b.sx >= 0.075 && b.sx <= 0.24 && b.sy >= 0.6 && b.sy <= 0.86 ? 0.8 : 0;
        },
      },
      (x, z, s, rng) => placeInstance(whiteFlowers, x, z, s, rng, 1.0 + rng() * 0.15, 0.6, 0.01, tint.setRGB(0.98 + rng() * 0.06, 0.98 + rng() * 0.06, 0.96 + rng() * 0.06)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'clover-lawn-band',
        candidates: 1500,
        box: field.lawnBandBox(),
        minSpacing: 0.2,
        low: true,
        max: 90,
        accept: (x, z) => (field.lawnEdgeDistance(x, z) >= 0.1 && field.bankFace(x, z) <= 0.3 ? 0.9 * field.lawnBand(x, z) : 0),
      },
      (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.8 + rng() * 0.5, 0.9, 0.008, greenVar(rng, 0.18)),
    );
    {
      const rng = ctx.rng.fork('plants/moss-lawn-band');
      const spots: readonly [number, number][] = [
        [-2.55, -7.35],
        [-3.05, -8.7],
        [-2.3, -9.85],
      ];
      for (const [cx, cz] of spots) {
        for (let i = 0; i < 24; i++) {
          const x = cx + (rng() - 0.5) * 0.7;
          const z = cz + (rng() - 0.5) * 0.7;
          if (field.lawnEdgeDistance(x, z) < 0.35 || field.stoneDistance(x, z) < 0.3 || nearWhite(x, z, 0.45) || nearKid(x, z, 1.0)) continue;
          if (placeMossWith(rng, x, z, 0.28 + rng() * 0.1)) break;
        }
      }
    }

    // ---- (4) frame 46's white clumps on the bank beside the stair foot (C 0.12–0.32 × 0.4–0.58,
    // beyond the stair-foot rock): a few on the south bank's crest, clear of the kids
    scatter(
      ctx,
      field,
      {
        label: 'white-flowers-stair-bank',
        candidates: 3000,
        box: [7.2, 3.2, 10.0, 5.2],
        minSpacing: 0.6,
        max: 3,
        accept: (x, z, s) => (s.slope <= 0.2 && s.path <= 0.02 && whiteGround(x, z, s, 0.2) && !nearKid(x, z, 1.0) && bankFenceDistance(x, z) >= 0.3 && inFrame('C_lookback', x, z, [0.12, 0.4, 0.32, 0.58], 12.2) ? 0.8 : 0),
      },
      whitePlace,
    );

    // ======== Round 14 (vegetation sub-agent, Astra offline): ground cover on the flight's two
    // flank banks, the shot-A bank crest, the hedge tiers and more ordinary ferns on the banks
    // (frames 1 s / 8 s: the banks beside the stairs are a mass of 10–20 cm heart / ovate leaves,
    // ferns and turf right to the tread ends — no soil; frame 8's flight box measured 16 % brown
    // soil against the frame's 3.8 %). Every pass below runs after the passes above from its own
    // stream, joins an existing set (no new draws) and keeps every standing rule: the paving and
    // the stones, the shot-A bank FACE (grass only, frame 1's lit tufts), the kids' spots, camera
    // C's stair-foot wedge, the rope fence, the house pad, the rock rings and the hedge caps.
    {
      const FLANK_BOX = field.flankBox();
      const newFerns14: { x: number; z: number; scale: number }[] = [];
      /** plants.test: nothing above 0.55 m on shot D's right verge / camera C's grass box */
      const dRight: readonly [number, number, number, number] = [1.5, -16, 7, -4];
      const inWorldBox = (x: number, z: number, b: readonly [number, number, number, number]) => x >= b[0] && z >= b[1] && x <= b[2] && z <= b[3];
      const nearFern = (x: number, z: number, r: number) => ferns.items.some((f) => Math.hypot(f.x - x, f.z - z) < r) || heroFerns.items.some((f) => Math.hypot(f.x - x, f.z - z) < r);
      const nearHedge = (x: number, z: number, r: number) => hedge.items.some((h) => Math.hypot(h.x - x, h.z - z) < r);
      /**
       * flank ground for a plant of horizontal `reach`, keeping `kid` metres from the kids' spots: on
       * the flank strips (field.ts `flankZone`), off the turf face and the cliffs, off the stones and
       * the trodden strip, clear of the rock rings, the trunks, the house pad and the rope fence, and
       * out of camera C's stair-foot wedge
       */
      const flankGround = (x: number, z: number, s: FieldSample, reach: number, kid: number, lowCarpet = false) => {
        if (field.flankZone(x, z) < 0.3 || s.cliff > 0.35 || field.bankFace(x, z) > 0.3) return false;
        if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6) return false;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0 || field.boulderDistance(x, z) < 0.3 || field.giantDistance(x, z) < 0.3) return false;
        if (field.houseInfo(x, z).dist < 0.4 || bankFenceDistance(x, z) < 0.4 || nearKid(x, z, kid)) return false;
        // frame 46's left third shows the stair foot over a carpet of low round leaves and short
        // turf: a plant under ≈ 0.12 m may stand in camera C's wedge, nothing taller
        return lowCarpet || field.sightlineC(x, z, reach) === 0;
      };
      const fernPlace14 = (scaleMin: number, scaleMax: number, dark = 1) => (x: number, z: number, s: FieldSample, rng: Rng) => {
        const scale = scaleMin + rng() * (scaleMax - scaleMin);
        newFerns14.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.2).multiplyScalar(dark));
      };

      // ---- (1) the flanks: heart / ovate clumps (15–33 cm, the frame's dominant cover) 0.22 m
      // apart right to the tread ends — the clumps in the first 0.3 m lean out over the kerb and
      // the tread ends so the mask's bare strip (5 cm SE, 25 cm NW) is under leaves from cameras A
      // and F — a fern clump every ≈ 0.5 m where nothing keeps them low, a low carpet (small
      // laminae + clover, ≤ 0.12 m) where camera C's wedge forbids anything taller (frame 46: the
      // stair foot over round leaves and turf), and moss cushions in the gaps. The north-west face
      // is 50–60° steep: the same rules as everywhere, the slope itself is no bar. Camera C's grass
      // box (the low verge) keeps its ≤ 0.55 m rule.
      const leanOut = (x: number, z: number, s: FieldSample, rng: Rng, scale: number, dark: number) => {
        const edge = field.lawnEdgeDistance(x, z);
        if (edge >= 0.3) return broadleafPlace(scale, scale, dark)(x, z, s, rng);
        // toward the nearest edge: down the lawnEdgeDistance gradient, the root tilted that way
        const gx = field.lawnEdgeDistance(x + 0.05, z) - field.lawnEdgeDistance(x - 0.05, z);
        const gz = field.lawnEdgeDistance(x, z + 0.05) - field.lawnEdgeDistance(x, z - 0.05);
        const gl = Math.hypot(gx, gz) || 1;
        const k = 0.45 * (1 - edge / 0.3);
        const y = T.height(x, z) - 0.012;
        composeMatrix(M, 0, x, y, z, s.nx - (gx / gl) * k, s.ny, s.nz - (gz / gl) * k, 0.8, rng() * Math.PI * 2, scale, scale, scale);
        weeds.add(M, rng.int(0, weeds.variantCount), greenVar(rng, 0.18).multiplyScalar(dark));
      };
      scatter(
        ctx,
        field,
        {
          label: 'weeds-flanks',
          candidates: 20000,
          box: FLANK_BOX,
          minSpacing: 0.2,
          max: 900,
          accept: (x, z, s) => (field.lawnEdgeDistance(x, z) >= 0.03 && flankGround(x, z, s, 0.4, 0.8) && !nearWhite(x, z, 0.45) ? 0.95 * field.flankZone(x, z) : 0),
        },
        // 0.29–0.42 m clumps: at cameras A / F's 10–13 m the frame's leaves span 3–5 px each
        (x, z, s, rng) => leanOut(x, z, s, rng, 1.8 + rng() * 0.8, 0.85),
      );
      scatter(
        ctx,
        field,
        {
          label: 'weeds-flanks-carpet',
          candidates: 12000,
          box: FLANK_BOX,
          minSpacing: 0.2,
          low: true,
          max: 420,
          accept: (x, z, s) => (field.lawnEdgeDistance(x, z) >= 0.03 && field.sightlineC(x, z, 0.35) > 0 && flankGround(x, z, s, 0.35, 0.8, true) && !nearWhite(x, z, 0.4) ? 0.9 * field.flankZone(x, z) : 0),
        },
        (x, z, s, rng) => leanOut(x, z, s, rng, 1.0 + rng() * 0.45, 0.9),
      );
      scatter(
        ctx,
        field,
        {
          label: 'clover-flanks',
          candidates: 10000,
          box: FLANK_BOX,
          minSpacing: 0.17,
          low: true,
          max: 420,
          accept: (x, z, s) => (field.lawnEdgeDistance(x, z) >= 0.03 && flankGround(x, z, s, 0.2, 0.6, true) ? 0.8 * field.flankZone(x, z) * (0.5 + field.cluster(x, z)) : 0),
        },
        (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.9 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2)),
      );
      scatter(
        ctx,
        field,
        {
          label: 'ferns-flanks',
          candidates: 8000,
          box: FLANK_BOX,
          minSpacing: 0.5,
          max: 120,
          accept: (x, z, s) => (field.edgeDistance(x, z) >= 0.35 && field.lowZone(x, z) < 0.5 && !inWorldBox(x, z, dRight) && flankGround(x, z, s, 0.9, 1.2) && !nearFern(x, z, 0.4) && !nearWhite(x, z, 0.5) ? 0.85 * field.flankZone(x, z) : 0),
        },
        fernPlace14(0.6, 1.0, 0.94),
      );
      scatter(
        ctx,
        field,
        {
          label: 'moss-flanks',
          candidates: 6000,
          box: FLANK_BOX,
          minSpacing: 0.4,
          low: true,
          max: 170,
          accept: (x, z, s) => (field.lawnEdgeDistance(x, z) >= 0.1 && field.flankZone(x, z) >= 0.3 && s.cliff <= 0.35 && field.bankFace(x, z) <= 0.3 && !nearKid(x, z, 0.6) ? 0.7 * field.flankZone(x, z) * (0.5 + field.cluster(x, z)) : 0),
        },
        // ≤ 0.2 m cushions: the rim-moss contract keeps every cushion within 0.25 m of the paving under 0.12 m
        (x, z, _s, rng) => placeMossWith(rng, x, z, 0.08 + rng() * 0.12),
      );

      // ---- (1) the shot-A bank crest behind the kid (A 0.8–1.0 × 0.45–0.75): the round-13 clumps
      // and skirt, thickened — more fern clumps between the hedge crowns and the kid, twice the broad
      // leaves. Same crest rule (flat ground off the face, clear of both kids, the fence and C).
      scatter(
        ctx,
        field,
        {
          label: 'ferns-a-bank-r14',
          candidates: 3000,
          box: [6.0, 3.5, 8.8, 5.6],
          minSpacing: 0.5,
          max: 12,
          accept: (x, z, s) => (bankCrest(x, z, s, 0.75) && !nearFern(x, z, 0.45) && !nearWhite(x, z, 0.5) && inFrame('A_stairs', x, z, A_BANK_BOX, 5.5) ? 0.75 : 0),
        },
        fernPlace14(0.8, 1.0, 0.94),
      );
      scatter(
        ctx,
        field,
        {
          label: 'weeds-a-bank-r14',
          candidates: 4000,
          box: [6.0, 3.2, 9.0, 5.6],
          minSpacing: 0.28,
          max: 40,
          accept: (x, z, s) => (bankCrest(x, z, s, 0.4) && !nearWhite(x, z, 0.4) && inFrame('A_stairs', x, z, [0.78, 0.5, 1.02, 0.8], 5.0) ? 0.85 : 0),
        },
        broadleafPlace(1.6, 2.2, 0.85),
      );

      // ---- (2) hedge tiers. The door-side row (frame 1's dark band left of the stairs) keeps its
      // 1.2 m cap — Saria's door in B — and gets a lower, denser tier of smaller crowns in its gaps
      // (smaller crowns = smaller leaves: the frame's hedge reads as small dense leaves, ours as a
      // few 30 cm ones). The bank hedge behind the shot-A kid gets the same second tier at 55–80 %
      // of the crown height, lit a shade lighter so the mass keeps a bright leaf rim toward the sun
      // (frame 1's box 0.78–1.0 × 0.3–0.6 measures lum p90 0.48 against ours 0.39).
      scatter(
        ctx,
        field,
        {
          label: 'hedge-shotA-r14',
          candidates: 4000,
          box: [7.2, -7.0, 10.6, -5.1],
          minSpacing: 0.3,
          max: 16,
          accept(x, z, s) {
            if (x < bRayX(z) + 1.1 || x > bRayX(z) + 2.4) return 0;
            if (s.cliff > 0.3 || field.edgeDistance(x, z) < 0.5 || s.h > 0.6) return 0;
            if (field.houseInfo(x, z).dist < 0.4 || field.sightlineC(x, z, 1.0) > 0) return 0;
            if (nearHedge(x, z, 0.28)) return 0;
            return 0.9;
          },
        },
        (x, z, s, rng) => {
          const top = Math.max(0.4, HEDGE_TOP - T.height(x, z)) * (0.7 + rng() * 0.2);
          const variant = rng.int(0, hedge.variantCount);
          const sc = top / hedgeHeight(variant);
          composeMatrix(M, 0, x, T.height(x, z) - 0.05, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.2 + rng() * 0.25), sc, sc * (1.2 + rng() * 0.25));
          hedge.add(M, variant, tint.setRGB(0.54 + rng() * 0.08, 0.55 + rng() * 0.08, 0.47 + rng() * 0.08));
        },
      );
      scatter(
        ctx,
        field,
        {
          label: 'hedge-shotA-bank-r14',
          candidates: 3000,
          box: [6.0, 3.9, 8.6, 5.6],
          minSpacing: 0.4,
          max: 14,
          accept(x, z, s) {
            if (s.h < 0.55 || s.slope > 0.2 || s.path > 0.02 || s.cliff > 0.3 || field.edgeDistance(x, z) < 0.6) return 0;
            if (Math.hypot(x - A_BANK_KID[0], z - A_BANK_KID[1]) < 1.2 || Math.hypot(x - F_BANK_KID[0], z - F_BANK_KID[1]) < 1.5) return 0;
            const clr = field.clearing(x, z);
            if (clr.npc > 0 || clr.boulder > 0 || bankFenceDistance(x, z) < 0.7) return 0;
            const a = field.screenX('A_stairs', x, z);
            if (!a || a.depth < 5.8 || a.sx < 0.84 || a.sx > 1.1) return 0;
            const f = field.screenX('F_canopy', x, z);
            const fEdge = field.screenX('F_canopy', x, z - BANK_CROWN_REACH);
            if (f && fEdge && f.depth < 9.2 && fEdge.sx < 0.62) return 0;
            const c = field.screenX('C_lookback', x, z);
            if (c && c.depth < 12.2) return 0;
            if (nearHedge(x, z, 0.3)) return 0;
            return 0.9;
          },
        },
        (x, z, s, rng) => {
          const depthA = field.screenX('A_stairs', x, z)?.depth ?? 6.5;
          const ground = T.height(x, z);
          const top = clamp(1.8 + 0.11 * depthA - ground, 1.4, 2.1) * (0.55 + rng() * 0.25);
          const variant = rng.int(0, hedge.variantCount);
          const sc = top / hedgeHeight(variant);
          // broad crowns (1.35–1.65 × their height) so the tier closes the gaps between the round-4 crowns
          composeMatrix(M, 0, x, ground - 0.05, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.35 + rng() * 0.3), sc, sc * (1.35 + rng() * 0.3));
          // the same warm olive as the round-4 crowns, a shade lighter (the lower tier faces the sun)
          hedge.add(M, variant, tint.setRGB(0.57 + rng() * 0.08, 0.53 + rng() * 0.08, 0.47 + rng() * 0.08));
        },
      );

      // ---- (4) ordinary ferns on the east bank (frames 1 / 8: a clump every ≈ 0.5 m on the shaded
      // bank right of the flight), between the round-4 clumps; the hero crowns stay as they are
      scatter(
        ctx,
        field,
        {
          label: 'ferns-east-bank-r14',
          candidates: 6000,
          box: EAST_BANK,
          minSpacing: 0.5,
          max: 110,
          accept: (x, z, s) => (eastBank(x, z, s, 1.0) && field.bankFace(x, z) <= 0.3 && field.stoneDistance(x, z) >= STONE_CLEARANCE && !nearFern(x, z, 0.45) && !nearWhite(x, z, 0.5) && !nearKid(x, z, 1.2) ? 0.4 + 0.5 * field.cluster(x, z) : 0),
        },
        fernPlace14(0.7, 1.0, 0.94),
      );

      // fiddleheads for this round's clumps (sheet 01: buds in ≈ 30 % of the near crowns; the
      // plants.test ratio is over every clump within 15 m of a camera), their own stream
      {
        const rng = ctx.rng.fork('plants/fiddleheads-r14');
        const s = newSample();
        for (const f of newFerns14) {
          if (rng() > 0.32) continue;
          const count = 2 + rng.int(0, 2);
          for (let i = 0; i < count; i++) {
            const a = rng() * Math.PI * 2;
            const d = 0.1 * f.scale * (0.3 + 0.7 * rng());
            const x = f.x + Math.cos(a) * d;
            const z = f.z + Math.sin(a) * d;
            field.sample(x, z, s);
            if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
            if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6 || field.sightlineC(x, z, 0.3) > 0) continue;
            placeInstance(fiddleheads, x, z, s, rng, 0.96 + rng() * 0.14, 0.5, 0.012, greenVar(rng, 0.12));
          }
        }
      }

      // ---- (3) camera D's path shoulders (field.ts `dShoulder`; frame 56 s: the paving runs to a
      // ragged soil edge with a few tufts, its box 0.15–0.85 × 0.66–1.0 is 0.9 % green against our
      // 11 %). The herb layer that stood in the first half-metre of verge beside the slabs comes
      // out — broad leaves (the boulder cluster's paddles included where they lapped the paving),
      // clover and seed heads; grass.ts thins the turf there the same way. Pruned after every pass
      // so no stream re-rolls; the violets (W18, D's purple fraction), the white rim dots (frame
      // 14 s' B-rim cluster, a plants.test contract) and the fern clumps (frame 56's banks) keep
      // their places.
      {
        const onShoulder = (it: { x: number; z: number }, min: number) => field.dShoulder(it.x, it.z) >= min;
        const weedReach = (it: (typeof weeds.items)[number]) => (weeds.opts.variants[it.variant][0].boundingBox?.max.x ?? 0.16) * Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
        // a leaf that would hang over the slabs goes even at the feather's edge
        weeds.prune((it) => onShoulder(it, 0.35) || (onShoulder(it, 0.05) && field.lawnEdgeDistance(it.x, it.z) < weedReach(it)));
        clover.prune((it) => onShoulder(it, 0.35));
        seedheads.prune((it) => onShoulder(it, 0.2));
        // the small rim cushions too: frame 56's slabs meet soil, not a moss line (the rim-moss
        // contract counts the whole paved rim, ≥ 100 cushions; the plaza discs and the stair branch
        // keep theirs). The lawn band's ≥ 0.25 m "mossy stones" (frame 14 s, a contract) stay.
        const mossReach = (it: (typeof moss.items)[number]) => (moss.opts.variants[it.variant][0].boundingBox?.max.x ?? 0.1) * Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
        moss.prune((it) => onShoulder(it, 0.5) && mossReach(it) < 0.25);
      }

      // ======== Round 31 (vegetation sub-agent; the owner: "the foliage needs to be really dense
      // and very detailed"): the banks as layered masses and ragged verges. Frames 1 / 8 / 14 / 56
      // show the bank boxes as solid overlapping plants — ground cover under ferns under the
      // hedge — with no bare turf between the clumps, and the paved edges broken by grass tufts
      // leaning over the slabs; take 86 measured A's right bank at 167 edge energy against the
      // frame's 307 and F's left bank 61 % green against 92 %. Every pass below runs from its own
      // stream after everything above (no earlier plant moves) and keeps the standing rules: the
      // paving (roots on the turf side; only the leaning geometry crosses), the stones and the
      // trodden strip, the kids' spots, camera C's stair-foot wedge (nothing over 0.35 m in it),
      // D's right verge (≤ 0.55 m) and its culled shoulders, frame 14 s' lawn band, the rock
      // rings, the trunks and the rope fence.
      {
        const F_LEFT: [number, number, number, number] = [6.8, -7.4, 10.8, -4.6];
        const A_CREST: [number, number, number, number] = [6.0, 3.2, 9.0, 5.6];
        const B_MASS: [number, number, number, number] = [8.0, -6.2, 9.6, -3.4];
        const D_RIGHT: [number, number, number, number] = [3, -15, 8, -7];
        const BANKS_BOX: [number, number, number, number] = [-6, -18, 17, 8];
        /** the lit yellow-olive of frame 56's bed clump and frame 14's right mass */
        const LIT_TINT = new Color(1.22, 1.16, 0.9);
        /** the frames' bank boxes as world ground: the flight's flanks, the east bank, the shot-A crest, the west bed, B's right mass, F's left bank */
        const onBank = (x: number, z: number) =>
          field.flankZone(x, z) >= 0.3 || inWorldBox(x, z, EAST_BANK) || inWorldBox(x, z, A_CREST) || inWorldBox(x, z, WEST_BED) || inWorldBox(x, z, B_MASS) || (inWorldBox(x, z, F_LEFT) && x >= bRayX(z) + 1.1);
        /** which bank a standing plant of horizontal `reach` may root in, '' for none — each bank keeps its own round-13 / 14 ground rule */
        const bankOf = (x: number, z: number, s: FieldSample, reach: number): string => {
          if (field.flankZone(x, z) >= 0.3 && flankGround(x, z, s, reach, 1.2)) return 'flank';
          if (inWorldBox(x, z, EAST_BANK) && eastBank(x, z, s, reach) && field.bankFace(x, z) <= 0.3 && field.stoneDistance(x, z) >= STONE_CLEARANCE && !nearKid(x, z, 1.2)) return 'east';
          if (inWorldBox(x, z, A_CREST) && bankCrest(x, z, s, reach)) return 'crest';
          if (inWorldBox(x, z, WEST_BED) && field.edgeDistance(x, z) >= 0.5 && standingGround(x, z, s, reach)) return 'west';
          if (inWorldBox(x, z, B_MASS) && field.edgeDistance(x, z) >= 0.3 && standingGround(x, z, s, reach) && field.houseInfo(x, z).dist >= 0.5) return 'bmass';
          if (inWorldBox(x, z, F_LEFT) && x >= bRayX(z) + 1.1 && s.cliff <= 0.3 && field.edgeDistance(x, z) >= 0.35 && field.houseInfo(x, z).dist >= 0.4 && standingGround(x, z, s, reach)) return 'fleft';
          return '';
        };

        // ---- (1) the fern layer: clumps in the gaps between the existing ones on every bank
        // (0.4–0.68 m; the crest keeps its A-box projection rule, D's right verge its 0.55 m cap
        // and the lawn band its "boulder ring only" rule)
        const newFerns31: { x: number; z: number; scale: number }[] = [];
        scatter(
          ctx,
          field,
          {
            label: 'ferns-r31-banks',
            candidates: 40000,
            box: BANKS_BOX,
            minSpacing: 0.34,
            max: 340,
            accept(x, z, s) {
              if (field.lawnBand(x, z) > 0.5 || inWorldBox(x, z, dRight) || field.lowZone(x, z) >= 0.5 || field.dShoulder(x, z) > 0) return 0;
              const bank = bankOf(x, z, s, 0.9);
              if (!bank || nearFern(x, z, 0.28) || nearWhite(x, z, 0.5)) return 0;
              if (bank === 'crest' && !inFrame('A_stairs', x, z, A_BANK_BOX, 5.5)) return 0;
              return 0.5 + 0.5 * field.cluster(x, z);
            },
          },
          (x, z, s, rng) => {
            const scale = 0.72 + rng() * 0.28;
            newFerns31.push({ x, z, scale });
            // frame 56's bed and frame 14's right mass are lit yellow-olive clumps (the hero crown's
            // `#69692e`) against dark ground, not the shade green of the east bank
            const lit = inWorldBox(x, z, WEST_BED) || inWorldBox(x, z, B_MASS);
            const c = greenVar(rng, 0.2);
            placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, lit ? c.multiply(LIT_TINT) : c.multiplyScalar(0.94));
          },
        );
        // ---- (2) the broad-leaf layer under the fronds (23–36 cm rosettes, ≤ 0.33 m tall)
        scatter(
          ctx,
          field,
          {
            label: 'weeds-r31-banks',
            candidates: 40000,
            box: BANKS_BOX,
            minSpacing: 0.2,
            max: 1300,
            accept(x, z, s) {
              if (field.lawnBand(x, z) > 0 || field.dShoulder(x, z) > 0 || field.lawnEdgeDistance(x, z) < 0.2 || field.bankFace(x, z) > 0.3) return 0;
              const bank = bankOf(x, z, s, 0.4);
              if (!bank || nearWhite(x, z, 0.45)) return 0;
              if (bank === 'crest' && !inFrame('A_stairs', x, z, [0.78, 0.5, 1.02, 0.8], 5.0)) return 0;
              return 0.6 + 0.4 * field.cluster(x, z);
            },
          },
          broadleafPlace(1.5, 2.2, 0.85),
        );
        // ---- (3) the ground cover: clover and moss cushions closing the turf between the rosettes
        const coverGround = (x: number, z: number, s: FieldSample, kid: number) => {
          if (field.dShoulder(x, z) > 0.4 || field.lawnEdgeDistance(x, z) < 0.1 || field.bankFace(x, z) > 0.3 || s.cliff > 0.35 || nearKid(x, z, kid)) return false;
          const clr = field.clearing(x, z);
          return !clr.insideBoulder && field.boulderDistance(x, z) >= 0.25 && field.giantDistance(x, z) >= 0.25 && onBank(x, z);
        };
        scatter(
          ctx,
          field,
          {
            label: 'clover-r31-banks',
            candidates: 40000,
            box: BANKS_BOX,
            minSpacing: 0.16,
            low: true,
            max: 1500,
            accept: (x, z, s) => (field.dShoulder(x, z) === 0 && coverGround(x, z, s, 0.6) ? 0.7 * (0.5 + field.cluster(x, z)) : 0),
          },
          (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.9 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2)),
        );
        scatter(
          ctx,
          field,
          {
            label: 'moss-r31-banks',
            candidates: 10000,
            box: BANKS_BOX,
            minSpacing: 0.45,
            low: true,
            max: 220,
            accept: (x, z, s) => (field.lawnEdgeDistance(x, z) >= 0.15 && coverGround(x, z, s, 0.6) ? 0.6 * (0.5 + field.cluster(x, z)) : 0),
          },
          // ≤ 0.2 m cushions (the rim-moss contract: cushions within 0.25 m of the paving stay under 0.12 m)
          (x, z, _s, rng) => placeMossWith(rng, x, z, 0.08 + rng() * 0.12),
        );

        // ---- (4) grass tufts (plantgeo.ts tuftGeometry): fountains of bent blades in three
        // height classes, the turf layer the frames show between and under everything else.
        const tuftTop = [0, 1, 2].map((c) => Math.max(...[c, c + 3].map((v) => tufts.opts.variants[v][0].boundingBox?.max.y ?? 0.5)));
        /**
         * Seat one tuft. The class is drawn with the `mix` weights (short / mid / tall) and then
         * held to what the ground allows: short only in the trodden strip and by the stones
         * (≤ 0.3 m), at the kids' feet, in the low verges, the frames' trimmed foregrounds and the
         * lawn band; no tall tuft within 1.2 m of a kid; and ≤ 0.34 m wherever camera C's wedge
         * reaches (frame 46's stair foot over short grass). The root tilts by (`leanX`, `leanZ`)
         * so a verge tuft leans over the slabs.
         */
        const tuftAt = (x: number, z: number, s: FieldSample, rng: Rng, mix: readonly [number, number, number], mul: Color | null = null, leanX = 0, leanZ = 0, r32 = false) => {
          const u = rng() * (mix[0] + mix[1] + mix[2]);
          let cls = u < mix[0] ? 0 : u < mix[0] + mix[1] ? 1 : 2;
          const shortOnly = field.troddenZone(x, z, r32) > 0 || field.stoneDistance(x, z) < STONE_CLEARANCE || nearKid(x, z, 0.8) || field.lawnBand(x, z) > 0.5;
          const wedge = field.sightlineC(x, z, 0.6) > 0;
          // the low verges and the frames' trimmed foregrounds (grass.ts keeps the turf short there)
          // take the short and mid classes: frame 1's kid stands in lit tufts to his shins
          const noTall = shortOnly || wedge || nearKid(x, z, 1.2) || field.lowZone(x, z) > 0.3 || field.trimZone(x, z) > 0.5;
          if (shortOnly) cls = 0;
          else if (noTall && cls === 2) cls = 1;
          let scale = 0.85 + rng() * 0.3;
          if (wedge) scale = Math.min(scale, 0.34 / tuftTop[cls]);
          const variant = cls + 3 * rng.int(0, 2);
          composeMatrix(M, 0, x, T.height(x, z) - 0.01, z, s.nx + leanX, s.ny, s.nz + leanZ, 0.85, rng() * Math.PI * 2, scale, scale, scale);
          const c = greenVar(rng, 0.22);
          tufts.add(M, variant, mul ? c.multiply(mul) : c);
        };
        /** the sunlit turf face of the shot-A bank (frame 1: lit yellow-green tufts): a warmer, brighter tint */
        const FACE_TINT = new Color(1.14, 1.1, 0.92);
        const tuftGround = (x: number, z: number, s: FieldSample, shoulder = false) => {
          if ((!shoulder && field.dShoulder(x, z) > 0) || field.lawnEdgeDistance(x, z) < 0.08 || s.cliff > 0.35 || nearWhite(x, z, 0.3)) return false;
          const clr = field.clearing(x, z);
          return !clr.insideBoulder && field.boulderDistance(x, z) >= 0.25 && field.giantDistance(x, z) >= 0.25;
        };
        // the banks: a tuft every ≈ 0.3 m under the fronds; the shot-A turf face (frame 1's lit
        // tufts behind the kid) takes them at full density — grass is the one thing it grows
        scatter(
          ctx,
          field,
          {
            label: 'tufts-banks',
            candidates: 60000,
            box: BANKS_BOX,
            minSpacing: 0.2,
            max: 3600,
            accept(x, z, s) {
              if (!tuftGround(x, z, s) || !(onBank(x, z) || inWorldBox(x, z, D_RIGHT))) return 0;
              return field.bankFace(x, z) > 0.3 ? 0.95 : 0.55 + 0.45 * field.cluster(x, z);
            },
          },
          (x, z, s, rng) => tuftAt(x, z, s, rng, [0.2, 0.4, 0.4], field.bankFace(x, z) > 0.3 ? FACE_TINT : inWorldBox(x, z, WEST_BED) || inWorldBox(x, z, B_MASS) ? LIT_TINT : null),
        );
        // the rest of the lawns within reach of the cameras, thinner, so the banks are not islands
        scatter(
          ctx,
          field,
          {
            label: 'tufts-scatter',
            candidates: Math.round(36000 * q.density),
            minSpacing: 0.4,
            max: 2400,
            accept: (x, z, s) => (nearCamera(x, z, 26) && tuftGround(x, z, s) ? 0.3 * field.falloff(x, z) * (0.4 + field.cluster(x, z)) * (1 - 0.5 * field.lawnBand(x, z)) : 0),
          },
          (x, z, s, rng) => tuftAt(x, z, s, rng, [0.35, 0.4, 0.25]),
        );
        // Saria's ramp and the lawn beside the stepping stones (frames 14 / 24: tufts of several
        // heights along the verge to the door): short tufts in the trodden strip and at the stone
        // rims (the ≤ 0.3 m herb rule), mid ones on the lawn beyond
        scatter(
          ctx,
          field,
          {
            label: 'tufts-ramp',
            candidates: 12000,
            box: [1.0, -10.5, 10.5, -1.5],
            minSpacing: 0.24,
            low: true,
            max: 520,
            accept(x, z, s) {
              if (field.rampDistance(x, z) > 3.6 || field.stoneDistance(x, z) < 0.08 || field.houseInfo(x, z).dist < 0.5 || !tuftGround(x, z, s)) return 0;
              return field.troddenZone(x, z) > 0 ? 0.35 : 0.8;
            },
          },
          (x, z, s, rng) => tuftAt(x, z, s, rng, [0.5, 0.4, 0.1]),
        );
        // ---- (5) ragged verges: tufts in the 0.45 m band outside every paved rim (the spine, the
        // stair branch, the plaza discs, the bank toe), their roots on the turf and the whole tuft
        // leaning over the slabs — the hardscape's sprouts stand IN the joints (materials/sprouts.ts);
        // these break the edge from the verge side. Mid and tall tufts where frame 1's lit tufts
        // overhang the bank toe, short and mid elsewhere. D's culled shoulders (frame 56: "a
        // ragged soil edge with a few tufts") keep 40 % of their candidates — the same ground is
        // frame 1's left verge (A 0–0.25 × 0.55–0.62), where tufts cross the slab edge.
        {
          const rng = ctx.rng.fork('plants/tufts-verges');
          const s = newSample();
          const spacing = new Spacing(0.5);
          field.rimCandidates(rng, 12 * q.density, 0.45, (x, z, edge) => {
            // the draws first so the stream is the same whatever the gates below decide
            const draw = rng();
            const shoulder = field.dShoulder(x, z) > 0.2;
            if (draw > (shoulder ? 0.4 : 0.85) * field.falloff(x, z)) return;
            field.sample(x, z, s);
            if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || !tuftGround(x, z, s, true)) return;
            if (!spacing.ok(x, z, 0.16)) return;
            spacing.add(x, z);
            // toward the nearest paved edge: down the lawnEdgeDistance gradient, the root tilted that way
            const gx = field.lawnEdgeDistance(x + 0.05, z) - field.lawnEdgeDistance(x - 0.05, z);
            const gz = field.lawnEdgeDistance(x, z + 0.05) - field.lawnEdgeDistance(x, z - 0.05);
            const gl = Math.hypot(gx, gz) || 1;
            const k = 0.5 * (1 - Math.min(1, edge / 0.45));
            const face = field.bankFace(x, z) > 0.3;
            tuftAt(x, z, s, rng, face ? [0.2, 0.4, 0.4] : [0.4, 0.45, 0.15], face ? FACE_TINT : null, -(gx / gl) * k, -(gz / gl) * k);
          });
        }

        // fiddleheads for this round's clumps (≈ 30 % of the near crowns, the plants.test ratio), their own stream
        {
          const rng = ctx.rng.fork('plants/fiddleheads-r31');
          const s = newSample();
          for (const f of newFerns31) {
            if (rng() > 0.32) continue;
            const count = 2 + rng.int(0, 2);
            for (let i = 0; i < count; i++) {
              const a = rng() * Math.PI * 2;
              const d = 0.1 * f.scale * (0.3 + 0.7 * rng());
              const x = f.x + Math.cos(a) * d;
              const z = f.z + Math.sin(a) * d;
              field.sample(x, z, s);
              if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
              if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6 || field.sightlineC(x, z, 0.3) > 0) continue;
              placeInstance(fiddleheads, x, z, s, rng, 0.96 + rng() * 0.14, 0.5, 0.012, greenVar(rng, 0.12));
            }
          }
        }

        // ======== Round 32 (vegetation-17): dressing hardscape-25's house-west flight (frame
        // 56 s: a mossy grass bank beside the risers, tufts over the tread ends, trodden earth
        // with a few tufts before the first riser; frame 14 s: the same bank beside Link), frame
        // 56 s' hollow (the open verge where the old north steps stood), the bed's violets (the
        // frame's two small patches, not a field) and the dark bank mass of frames 8 / 46 on the
        // plateau shelf right of the main flight. Every stream below runs after everything above
        // from its own stream with the round-32 field rules (`r32`), so no earlier plant moves;
        // the prunes and re-tints touch listed instances in place.
        {
          const HOUSE_BOX = field.houseFlankBox();
          const topOf = (set: LodInstancedSet, it: (typeof set.items)[number]) => (set.opts.variants[it.variant][0].boundingBox?.max.y ?? 0.5) * Math.hypot(it.matrix[4], it.matrix[5], it.matrix[6]);
          if (HOUSE_BOX) {
            /** the north flank (frame 56 s' shaded bank, 0.22 luminance) against the lit south lip */
            const north = (x: number, z: number) => (field.houseFlightLocal(x, z)?.v ?? 0) < 0;
            // cap-1 measured the north flank at p50 0.290 against the frame's 0.207 with a 0.82 tint
            const NORTH_TINT = new Color(0.64, 0.7, 0.58);
            // cap-2 (0.64 on the new tufts only): p50 0.295 — the box's tufts are two thirds the
            // round-31 bank / ramp / scatter streams (117 + 25 + 10 against 67 of ours), so every
            // standing plant on the north flank takes the tint (colours only; nothing moves)
            for (const set of [tufts, clover, weeds, moss, seedheads]) for (const it of set.items) if (north(it.x, it.z) && field.houseFlankZone(it.x, it.z) > 0.3) it.color = [it.color[0] * NORTH_TINT.r, it.color[1] * NORTH_TINT.g, it.color[2] * NORTH_TINT.b];
            /**
             * flank ground for the flight's herb layer: on the flank strips, roots on the turf side of
             * the tread ends (the leaning tufts cross), off the cliffs, the rock rings, the trunks, the
             * house pad, the stepping stones and the kids
             */
            const houseGround = (x: number, z: number, s: FieldSample) => {
              if (field.houseFlankZone(x, z) < 0.3 || s.cliff > 0.35 || field.lawnEdgeDistance(x, z, true) < 0) return false;
              const clr = field.clearing(x, z);
              if (clr.insideBoulder || field.boulderDistance(x, z) < 0.25 || field.giantDistance(x, z) < 0.3) return false;
              return field.houseInfo(x, z).dist >= 0.4 && field.stoneDistance(x, z) >= 0.15 && !nearKid(x, z, 0.8) && !nearWhite(x, z, 0.3);
            };
            // ---- (1) tufts on both flanks: short / mid fountains 0.18 m apart, the first 0.3 m
            // leaning out over the tread ends (down the edge gradient, as the verge tufts do)
            scatter(
              ctx,
              field,
              {
                label: 'tufts-r32-house-flanks',
                candidates: 24000,
                box: HOUSE_BOX,
                minSpacing: 0.18,
                low: true,
                max: 700,
                r32: true,
                accept: (x, z, s) => (houseGround(x, z, s) ? 0.9 * field.houseFlankZone(x, z) * (0.6 + 0.4 * field.cluster(x, z)) * (north(x, z) ? 1 : 0.6) : 0),
              },
              (x, z, s, rng) => {
                const edge = field.lawnEdgeDistance(x, z, true);
                let lx = 0;
                let lz = 0;
                if (edge < 0.3) {
                  const gx = field.lawnEdgeDistance(x + 0.05, z, true) - field.lawnEdgeDistance(x - 0.05, z, true);
                  const gz = field.lawnEdgeDistance(x, z + 0.05, true) - field.lawnEdgeDistance(x, z - 0.05, true);
                  const gl = Math.hypot(gx, gz) || 1;
                  const k = 0.75 * (1 - edge / 0.3);
                  lx = -(gx / gl) * k;
                  lz = -(gz / gl) * k;
                }
                const n = north(x, z);
                // the mid class at the rim (the tufts that lap the tread ends), short / mid up the
                // north bank; the south flank is camera C's left foreground (frame 46: short turf at
                // the stair foot, cap-final C 0.3099 → 0.3017 with mid tufts there) — short class only
                tuftAt(x, z, s, rng, !n ? [1, 0, 0] : edge < 0.3 ? [0.2, 0.7, 0.1] : [0.35, 0.5, 0.15], n ? NORTH_TINT : null, lx, lz, true);
              },
            );
            // ---- (2) moss cushions along the lip and up the bank (≤ 0.22 m; the rim-moss contract
            // keeps every cushion within 0.25 m of the paving under 0.12 m)
            scatter(
              ctx,
              field,
              {
                label: 'moss-r32-house-flanks',
                candidates: 12000,
                box: HOUSE_BOX,
                minSpacing: 0.26,
                low: true,
                max: 260,
                r32: true,
                accept: (x, z, s) => (houseGround(x, z, s) && field.lawnEdgeDistance(x, z, true) >= 0.06 ? 0.8 * field.houseFlankZone(x, z) * (0.5 + field.cluster(x, z)) * (north(x, z) ? 1 : 0.6) : 0),
              },
              // the frame's bank is cushions to ~0.28 m across between the tufts (≤ 0.12 m: the rim-moss
              // contract), more on the shaded north side; the south lip's cushions stay small (they
              // stand 2.3 m before camera C, where frame 46 s has a fine low fringe, cap-3 C −0.0023)
              (x, z, _s, rng) => placeMossWith(rng, x, z, north(x, z) ? 0.1 + rng() * 0.18 : 0.06 + rng() * 0.08, true),
            );
            // ---- (3) clover closing the turf between the tufts
            scatter(
              ctx,
              field,
              {
                label: 'clover-r32-house-flanks',
                candidates: 10000,
                box: HOUSE_BOX,
                minSpacing: 0.16,
                low: true,
                max: 500,
                r32: true,
                accept: (x, z, s) => (houseGround(x, z, s) ? 0.7 * field.houseFlankZone(x, z) * (0.5 + field.cluster(x, z)) : 0),
              },
              (x, z, s, rng) => {
                const c = greenVar(rng, 0.2);
                placeInstance(clover, x, z, s, rng, 0.9 + rng() * 0.6, 0.9, 0.008, north(x, z) ? c.multiply(NORTH_TINT) : c);
              },
            );
          }

          // ---- (4) the dark bank mass of frames 8 / 46 (C 0–0.30 × 0.40–0.70 beyond the stair-foot
          // rock, F 0.65–0.95 × 0.08–0.6 right of the flight): a low tier of clipped hedge crowns on
          // the plateau shelf right of the main flight (x 8.7–13.6, z 3.8–7.4: the ground both boxes
          // see, 12.4–16 m from camera C, 10–14 m from F), in the frame's warm near-black olive,
          // between the east-bank ferns. Off the treads, the shot-A bank face, the rope fence, the
          // rock rings, the kids' spots and camera C's wedge (behind the rock, never over the foot).
          scatter(
            ctx,
            field,
            {
              label: 'hedge-r32-shelf',
              candidates: 5000,
              box: [8.7, 3.8, 13.6, 7.4],
              minSpacing: 0.95,
              max: 16,
              r32: true,
              accept(x, z, s) {
                if (s.cliff > 0.3 || s.path > 0.02 || s.slope > 0.35 || field.edgeDistance(x, z) < 0.7 || field.bankFace(x, z) > 0.3) return 0;
                const clr = field.clearing(x, z);
                if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0 || field.giantDistance(x, z) < 0.9) return 0;
                if (bankFenceDistance(x, z) < 0.7 || nearKid(x, z, 1.6) || field.stoneDistance(x, z) < STONE_CLEARANCE) return 0;
                if (field.sightlineC(x, z, 0.9) > 0 || nearHedge(x, z, 0.8)) return 0;
                const c = field.screenPoint('C_lookback', x, s.h, z);
                const f = field.screenPoint('F_canopy', x, s.h, z);
                const inC = !!c && c.sx >= 0.02 && c.sx <= 0.34 && c.sy >= 0.4 && c.sy <= 0.7;
                const inF = !!f && f.sx >= 0.64 && f.sx <= 0.95 && f.sy >= 0.3 && f.sy <= 0.62;
                return inC || inF ? 0.9 : 0;
              },
            },
            (x, z, s, rng) => {
              const top = 0.55 + rng() * 0.3;
              const variant = rng.int(0, hedge.variantCount);
              const sc = top / hedgeHeight(variant);
              composeMatrix(M, 0, x, T.height(x, z) - 0.05, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.3 + rng() * 0.3), sc, sc * (1.3 + rng() * 0.3));
              hedge.add(M, variant, tint.setRGB(0.5 + rng() * 0.07, 0.46 + rng() * 0.07, 0.42 + rng() * 0.07));
            },
          );
          // cap-final: the crowns showed as two cells (−0.02) in F's box — from F's low angle the
          // shelf's ground is hidden behind the bank crest except the crest strip itself (z 4.4–6.4,
          // r32-where), and the box's lit ground is that strip (0.33–0.40 against the frame's 0.27).
          // Frame 8's mass there is shrub-sized: a few dark shrubs on the crest strip (1.0–1.3 m,
          // the `bushes` set), off the fence, the kids' spots and camera C's wedge; camera A looks
          // past them (they project right of its frame)
          scatter(
            ctx,
            field,
            {
              label: 'bushes-r32-crest',
              candidates: 8000,
              box: [9.0, 4.4, 14.0, 6.4],
              minSpacing: 1.0,
              max: 8,
              r32: true,
              accept(x, z, s) {
                if (s.cliff > 0.3 || s.path > 0.02 || s.slope > 0.35 || field.edgeDistance(x, z) < 0.7 || field.bankFace(x, z) > 0.3) return 0;
                const clr = field.clearing(x, z);
                if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0 || field.giantDistance(x, z) < 0.9) return 0;
                if (bankFenceDistance(x, z) < 0.8 || nearKid(x, z, 1.6) || field.stoneDistance(x, z) < STONE_CLEARANCE) return 0;
                if (field.sightlineC(x, z, 0.9) > 0 || nearHedge(x, z, 0.6)) return 0;
                const f = field.screenPoint('F_canopy', x, s.h + 0.6, z);
                return f && f.sx >= 0.64 && f.sx <= 0.95 && f.sy >= 0.26 && f.sy <= 0.6 ? 0.9 : 0;
              },
            },
            (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.7 + rng() * 0.2, 0.35, 0.04, tint.setRGB(0.5 + rng() * 0.08, 0.5 + rng() * 0.08, 0.42 + rng() * 0.08)),
          );
          // dark fern clumps in the crowns' gaps, the same ground past the shot-A crest's fern box
          // (x ≤ 8.8: those must project into frame 1) — the frame's mass is fronds under crowns
          scatter(
            ctx,
            field,
            {
              label: 'ferns-r32-shelf',
              candidates: 6000,
              box: [8.85, 3.8, 13.6, 7.4],
              minSpacing: 0.45,
              max: 40,
              r32: true,
              accept(x, z, s) {
                if (!eastBank(x, z, s, 0.9) || field.bankFace(x, z) > 0.3 || field.stoneDistance(x, z) < STONE_CLEARANCE || nearKid(x, z, 1.4)) return 0;
                if (nearFern(x, z, 0.3) || nearWhite(x, z, 0.5) || field.sightlineC(x, z, 0.9) > 0) return 0;
                const c = field.screenPoint('C_lookback', x, s.h, z);
                const f = field.screenPoint('F_canopy', x, s.h, z);
                const inC = !!c && c.sx >= 0.02 && c.sx <= 0.34 && c.sy >= 0.4 && c.sy <= 0.7;
                const inF = !!f && f.sx >= 0.64 && f.sx <= 0.95 && f.sy >= 0.3 && f.sy <= 0.62;
                return inC || inF ? 0.5 + 0.5 * field.cluster(x, z) : 0;
              },
            },
            (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.7 + rng() * 0.3, 0.7, 0.02, greenVar(rng, 0.2).multiplyScalar(0.8)),
          );
          // the shelf's standing plants a shade darker (the frame's mass is a near-black olive with
          // lit tips, ours a lit bed: C's box p50 0.305 against 0.286, F's 0.34 against 0.27); the
          // shot-A crest's rosettes too, for the lit-tuft / dark-leaf contrast frame 1 has (lum sd
          // 0.130 against our 0.111). Colours only — nothing moves.
          const SHELF: [number, number, number, number] = [8.6, 3.8, 13.6, 7.4];
          const darken = (set: LodInstancedSet, k: number, box: [number, number, number, number]) => {
            let n = 0;
            for (const it of set.items) {
              if (!inWorldBox(it.x, it.z, box)) continue;
              it.color = [it.color[0] * k, it.color[1] * k, it.color[2] * k];
              n++;
            }
            return n;
          };
          darken(ferns, 0.86, SHELF);
          darken(weeds, 0.86, SHELF);
          darken(weeds, 0.9, A_CREST);
          darken(ferns, 0.92, A_CREST);

          // ---- (5) frame 56 s' hollow (field.ts `dHollow`): the footage shows the open verge where
          // the old north steps stood as low dark-green cover under mist — nothing standing. The
          // seed heads, the mid / tall tufts, the taller fern clumps and the shrubs that stood there
          // come out (pruned after every pass, so no stream re-rolls); the low broad leaves, the
          // clover and the short tufts stay. The violets are the bed's business below (W18).
          const hollowAt = (it: { x: number; y: number; z: number }) => field.dHollow(it.x, it.y, it.z);
          seedheads.prune((it) => hollowAt(it) > 0.5);
          tufts.prune((it) => hollowAt(it) > 0.5 && topOf(tufts, it) > 0.3);
          ferns.prune((it) => hollowAt(it) > 0.5 && topOf(ferns, it) > 0.45);
          bushes.prune((it) => hollowAt(it) > 0.5);
          // the buds of the pruned clumps go with them (every fiddlehead sits in a fern crown)
          fiddleheads.prune((it) => hollowAt(it) > 0.5 && !ferns.items.concat(heroFerns.items).some((f) => Math.hypot(f.x - it.x, f.z - it.z) <= 0.2));
          // cap-1: with the shrubs gone the slope read as lit broad leaves over dark earth (edge at
          // 256 × 144 67.7 → 84.7 against the frame's 51.2): the large laminae come out, the small
          // ones and the clover go a shade darker into the turf
          const scaleOf = (it: { matrix: ArrayLike<number> }) => Math.hypot(it.matrix[4], it.matrix[5], it.matrix[6]);
          weeds.prune((it) => hollowAt(it) > 0.5 && scaleOf(it) >= 1.25);
          for (const set of [weeds, clover]) for (const it of set.items) if (hollowAt(it) > 0.5) it.color = [it.color[0] * 0.82, it.color[1] * 0.82, it.color[2] * 0.82];

          // ---- (6) the bed's violets. Frame 56 s grows two small patches — (0.17–0.27, 0.60–0.67)
          // beside the fern clump and (0.05–0.12, 0.55–0.60) — and its bed box (0.10–0.30 ×
          // 0.55–0.85) is 1 % violet where ours was 9.5 %. Every bloom whose head projects into the
          // bed outside the two patches goes; the first patch keeps BED_PATCH_KEEP of its heads (a
          // position hash, so the survivors are the same every build). W18 wants ≥ 0.3 % of the
          // frame purple at 256 × 144: the patches, the right verge's clump and the far slope carry it.
          const D_BED: readonly [number, number, number, number] = [0.1, 0.55, 0.3, 0.85];
          const D_PATCH_1: readonly [number, number, number, number] = [0.17, 0.6, 0.27, 0.67];
          const D_PATCH_2: readonly [number, number, number, number] = [0.05, 0.55, 0.12, 0.6];
          // cap-1 (keep 0.6): bed 2.5 % violet at 256 × 144 / 3.9 % at full res, W18 0.323 %;
          // cap-2 (keep 0.45, the right verge's two new clusters): 3.55 % at full res, W18 0.532 %
          const BED_PATCH_KEEP = 0.4;
          const inScreenBox = (p: { sx: number; sy: number } | null, b: readonly [number, number, number, number]) => !!p && p.sx >= b[0] && p.sx <= b[2] && p.sy >= b[1] && p.sy <= b[3];
          const hash01 = (x: number, z: number) => {
            let h = (Math.imul(Math.round(x * 1000), 374761393) + Math.imul(Math.round(z * 1000), 668265263)) | 0;
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
          };
          flowers.prune((it) => {
            const p = field.screenPoint('D_log', it.x, it.y + topOf(flowers, it) * 0.75, it.z);
            if (!p || p.depth > 20) return false;
            if (inScreenBox(p, D_PATCH_2)) return false;
            if (inScreenBox(p, D_PATCH_1)) return hash01(it.x, it.z) > BED_PATCH_KEEP;
            // the head in the bed, or the far slope's stalks rooted in it with their heads over its top
            // edge (cap-2: seven at 12 m, x 0.17–0.23, straddling y 0.55)
            return inScreenBox(p, D_BED) || inScreenBox(field.screenPoint('D_log', it.x, it.y, it.z), D_BED);
          });
          // the frame's bed is a LIT yellow-olive fern mass over dark ground (lum sd 0.120 against
          // our 0.078, p50 0.385 against 0.305): the bed's fronds and buds take a warmer, brighter
          // tint on top of the round-31 LIT_TINT, its rosettes and clover go darker — colours only
          const BED_LIT = new Color(1.16, 1.12, 0.9);
          const inBed = (it: { x: number; y: number; z: number }) => inScreenBox(field.screenPoint('D_log', it.x, it.y, it.z), D_BED) && (field.screenPoint('D_log', it.x, it.y, it.z)?.depth ?? 99) < 14;
          for (const set of [ferns, heroFerns, fiddleheads]) for (const it of set.items) if (inBed(it)) it.color = [it.color[0] * BED_LIT.r, it.color[1] * BED_LIT.g, it.color[2] * BED_LIT.b];
          for (const set of [weeds, clover]) for (const it of set.items) if (inBed(it)) it.color = [it.color[0] * 0.85, it.color[1] * 0.85, it.color[2] * 0.85];
          // W18 counts violet at 256 × 144, where a head averaged with the turf around it drops out
          // of the classifier's saturation floor (cap-1: 6727 px at full res, 119 at 256 × 144, floor
          // 111). Every remaining bloom camera D sees within 20 m takes a deeper violet (colours only)
          // and the right verge's clump — the frame's low heads by the pot — grows two more clusters
          // from a new stream, so the bed can thin without the metric falling through the floor.
          for (const it of flowers.items) {
            const p = field.screenPoint('D_log', it.x, it.y, it.z);
            if (p && p.depth < 20 && p.sx >= 0 && p.sx <= 1 && p.sy >= 0 && p.sy <= 1) it.color = [it.color[0] * 1.02, it.color[1] * 0.8, it.color[2] * 1.12];
          }
          const firstNewHead = flowers.items.length;
          clusterAt(
            'flowers-r32-shotD-right',
            [
              [6.1, -13.35],
              [5.3, -13.0],
            ],
            8,
            0.4,
            (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && !nearKid(x, z, 1.2) && inFrame('D_log', x, z, D_RIGHT_BOX),
            flowerPlace(0.95, 1.2, CLUSTER_HEADS),
          );
          for (let i = firstNewHead; i < flowers.items.length; i++) {
            const it = flowers.items[i];
            it.color = [it.color[0] * 1.02, it.color[1] * 0.8, it.color[2] * 1.12];
          }

          // ======== Round 35 (vegetation-18): the three gaps rounds 33–34 measured. Every new
          // scatter below runs from its own stream after everything above (no earlier plant
          // moves); the re-tints and prunes touch listed instances in place, colours only.
          {
            const mulColor = (it: { color: [number, number, number] }, r: number, g: number, b: number) => {
              it.color = [it.color[0] * r, it.color[1] * g, it.color[2] * b];
            };
            // ---- (1) camera C's bottom-left foreground (field.ts cFoot; frame 46 s: trodden earth
            // with a dusty fringe, dark leaves only in the corner, nothing standing). The grass
            // pass lays the short dusty turf; here the standing plants thin out — the mid / tall
            // tufts go, the clover, cushions and rosettes keep C_FOOT_KEEP of theirs by a position
            // hash (the frame's fringe is sparse), and what stays reads darker under the zone fill
            // (the lift lights the turf; the frame's corner leaves measure 0.26–0.28).
            const C_FOOT_KEEP = 0.45;
            const footAt = (it: { x: number; z: number }) => field.cFoot(it.x, it.z);
            tufts.prune((it) => footAt(it) > 0.5 && topOf(tufts, it) > 0.16);
            // (the rim moss, the stones' clover fringes and the seam stay: those are contracts)
            for (const set of [clover, moss, weeds]) set.prune((it) => footAt(it) > 0.5 && hash01(it.x + 0.25, it.z) > C_FOOT_KEEP && field.lawnEdgeDistance(it.x, it.z, true) > 0.3 && field.stoneDistance(it.x, it.z) > 0.4);
            for (const set of [weeds, clover, tufts]) for (const it of set.items) if (footAt(it) > 0.3) mulColor(it, 0.78, 0.8, 0.78);

            // ---- (2) the dark bank masses (field.ts bankDark): the standing plants on the flight's
            // north-west flank and the plateau shelf take the zone as a colour multiplier, like the
            // turf's darkening — frames 8 / 46 read those banks 0.19–0.27 against our 0.30–0.35
            const darkAt = (it: { x: number; z: number }) => field.bankDark(it.x, it.z);
            for (const set of [tufts, clover, weeds, moss, ferns, seedheads, fiddleheads]) for (const it of set.items) {
              const d = darkAt(it);
              if (d > 0.05) mulColor(it, 1 - 0.32 * d, 1 - 0.3 * d, 1 - 0.28 * d);
            }
            // (the door-side hedge row, hedge-shotA at z ≤ −5.1, is camera B's door hedge and stays:
            // B 0.7–0.95 × 0.45–0.7 already measures 0.26–0.31 against the frame's 0.27–0.39.)
            // The bank hedge and the crest shrubs behind it (frame 8's right mass, frame 1's
            // right-edge crowns) keep their colours. Their near-black cores (F 0.14–0.22, A
            // 0.13–0.17 against the frames' 0.23–0.28 / 0.19–0.30) were tried with a
            // shadow-weighted fill zone (materials.ts, 2.4 × the verge fill over x 5.8–14.5 /
            // z 3.7–7.3): the cores came up (C's crown cell 0.192 → 0.257, frame 0.291) but every
            // leaf showed (edge 27 → 103, frame 25) and F fell 0.2955 → 0.2860, A −0.0014 — the
            // dark flat core scores better than a lit textured one, so the fill is withdrawn and
            // the crowns take plantgeo.ts' narrower per-leaf spread instead (edge 27.0 → 25.3 in C,
            // 25.8 → 24.6 in A, luminance unchanged). The first cut's × 1.36 on the crest shrubs
            // and its 12 extra crest crowns are gone too: in C they stood behind the stair-foot
            // rock as leaf structure where frame 46 s has a hazed dark band (C 0–0.3 × 0.25–0.5
            // SSIM −0.018…−0.031 per cell), and F could not see them behind the hedge row (F
            // right p10 0.146 → 0.146).

            // ---- (3) frame 56 s' right verge (D 0.55–0.85 × 0.6–0.72: a closed green slope, 81 %
            // green at p50 0.314 with edge 33 at 256 × 144, against our 69 % / 0.366 / 84): the
            // standing plants there go greener and a shade darker (the round-31 lit yellow-olive
            // sits below the classifier's 48° hue floor), and a low cover of clover and cushions
            // closes the turf between them — the verge keeps its 0.55 m cap and its shoulders.
            // Measured: 459 clover + 155 cushions took the box 69.1 → 71.3 % green; a grass-side
            // pass (straw out, deep tints, × 0.875) took it back to 69.3 — the deep tints lose
            // saturation under the verge's haze and fall out of the green class — so the cover
            // does the work, at twice the first density.
            const D_VERGE_BOX: readonly [number, number, number, number] = [0.53, 0.56, 0.9, 0.75];
            const D_VERGE_WORLD: [number, number, number, number] = [3.0, -20.5, 6.8, -8.8];
            const inDVerge = (x: number, z: number) => inWorldBox(x, z, D_VERGE_WORLD) && inFrame('D_log', x, z, D_VERGE_BOX, 7);
            for (const set of [tufts, weeds, clover, ferns, seedheads, moss]) for (const it of set.items) if (inDVerge(it.x, it.z)) mulColor(it, 0.8, 0.94, 0.86);
            const dVergeGround = (x: number, z: number, s: FieldSample) => {
              if (!inDVerge(x, z) || s.cliff > 0.35 || field.dShoulder(x, z) > 0 || field.lawnEdgeDistance(x, z, true) < 0.15) return false;
              const clr = field.clearing(x, z);
              if (clr.insideBoulder || field.boulderDistance(x, z) < 0.25 || field.giantDistance(x, z) < 0.3 || field.houseInfo(x, z).dist < 0.4) return false;
              return field.stoneDistance(x, z) >= 0.15 && !nearKid(x, z, 0.8) && !nearWhite(x, z, 0.3);
            };
            scatter(
              ctx,
              field,
              {
                label: 'clover-r35-d-verge',
                candidates: 60000,
                box: D_VERGE_WORLD,
                minSpacing: 0.12,
                low: true,
                max: 1800,
                r32: true,
                accept: (x, z, s) => (dVergeGround(x, z, s) ? 0.8 * (0.5 + field.cluster(x, z)) : 0),
              },
              (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 1.0 + rng() * 0.7, 0.9, 0.008, greenVar(rng, 0.2).multiply(new Color(0.82, 0.96, 0.86))),
            );
            scatter(
              ctx,
              field,
              {
                label: 'moss-r35-d-verge',
                candidates: 30000,
                box: D_VERGE_WORLD,
                minSpacing: 0.24,
                low: true,
                max: 420,
                r32: true,
                accept: (x, z, s) => (dVergeGround(x, z, s) && field.lawnEdgeDistance(x, z, true) >= 0.3 ? 0.7 * (0.5 + field.cluster(x, z)) : 0),
              },
              (x, z, _s, rng) => placeMossWith(rng, x, z, 0.12 + rng() * 0.16, true),
            );

            // ======== Round 38 (vegetation-19): the house frames' understory. Frames 14 s / 24 s
            // (cameras B / E — one camera) show the ground around Saria's terrace as a lush layered
            // understory: fern crowns with lit tips, hosta-like clumps, moss on the roots, verge
            // flowers, tufts catching the sun, a crown group at the frame's right edge. Take 105
            // renders the same ground as turf. Every metre of it is also another frame's ground,
            // and take r38/cap-a (e15337b: a lit carpet over the whole lawn) measured what each
            // frame tolerates, per 8 px cell at 256 × 144:
            //  - the bank at camera C's feet (field.ts C_FOOT, x 3.5–5.7 / z −6.3…−2.1) is frame
            //    46 s' bottom-left — stair foot and paving, 2–5 m from the lens, where a 0.3 m hosta
            //    fills a whole cell (C −0.0072); the same bank is the mound in frame 1 s' centre,
            //    hazed at 15 m (A −0.003 over its four best cells). Nothing new roots there.
            //  - the lobe's west and middle (x 6–7.5, z −5.8…−3.5) is frame 8 s' dark left mass
            //    (F 0–0.17 × 0.44–0.67, the round-35 bankDark ramp, the frame's best cells) and
            //    frame 8 s reads a flat blur there: even a luminance-neutral carpet costs F.
            //  - the terrace (TERRACE_BOX) shows in B as the strip between the mound's top and the
            //    door (B 0.6–0.85 × 0.47–0.56) and in A hazed at 17–22 m (A 0.42–0.6 × 0.44–0.51,
            //    A's 0.5-SSIM cells: the frame is a flat 0.33 there). Lit tints (× 1.1–1.24) pushed
            //    through the haze (A +0.05, −0.25 per cell), so the terrace sets keep the turf's
            //    tone: the plants read as plants in B, not as a brighter ground in A.
            //  - the lobe's south-east corner (LOBE_SE_BOX) is frame 14 s' right-edge crown group
            //    (B 0.85–1.0 × 0.55–0.8: fronds and lit lawn, 0.44–0.53, ours 0.23–0.35) and the
            //    one ground where cap-a gained in B and E alike (+0.5 per cell at B (0.93, 0.78));
            //    from F it is the cells east of the mass (F 0.17–0.24 × 0.45–0.66, SSIM ≈ 0.1–0.3);
            //    camera C's left edge cuts it at x ≈ 7.3 (5–6 m: `offCNear`).
            // So: (T) the terrace, turf-toned; (SE) the lobe's corner, lit; (H) two low clipped
            // tiers at the trunk base; verge flowers along the stones' lawn. Every set draws its own
            // streams after everything above (no earlier plant moves).
            {
              const TERRACE_BOX: [number, number, number, number] = [6.2, -11.0, 10.6, -6.3];
              const LOBE_SE_BOX: [number, number, number, number] = [6.7, -4.9, 8.5, -2.4];
              /** frame 8 s' dark left mass ends at F.sx 0.17 (plants.test `fMass`) */
              const F_MASS_SX = 0.17;
              /** the corner keeps clear of F's good cells right of the mass (F 0.15–0.2 × 0.44–0.56, SSIM 0.4–0.5): roots east of 0.19 */
              const F_CORNER_SX = 0.19;
              const fTan = Math.tan(((ctx.layout.viewpoints.find((v) => v.id === 'F_canopy')?.fov ?? 46) * Math.PI) / 360) * (16 / 9);
              const cTan = Math.tan(((ctx.layout.viewpoints.find((v) => v.id === 'C_lookback')?.fov ?? 46) * Math.PI) / 360) * (16 / 9);
              /** frame 8 s' left edge: a plant of horizontal `reach` whose crown projects left of F.sx 0 is off camera F */
              const offF = (x: number, z: number, reach: number) => {
                const p = field.screenPoint('F_canopy', x, T.height(x, z), z);
                return !p || p.sx + (reach * 0.5) / (p.depth * fTan) < 0;
              };
              /** the lobe corner's F rule: the whole plant east of the dark mass */
              const eastOfFMass = (x: number, z: number, reach: number) => {
                const p = field.screenPoint('F_canopy', x, T.height(x, z), z);
                return !p || p.sx - (reach * 0.5) / (p.depth * fTan) >= F_CORNER_SX;
              };
              const offD = (x: number, z: number) => {
                const p = field.screenPoint('D_log', x, T.height(x, z), z);
                return !p || p.sx > 1.01;
              };
              /**
               * frame 46 s' stair-foot contract (plants.test): a plant over 0.35 m whose root is within
               * 12 m of camera C may not project into C 0–0.32 × 0.48–0.92, its horizontal `reach`
               * included.
               */
              const offCEdge = (x: number, z: number, reach: number) => {
                const p = field.screenPoint('C_lookback', x, T.height(x, z), z);
                if (!p || p.depth >= 12) return true;
                const halfW = (reach * 0.5) / (p.depth * cTan);
                return p.sx + halfW < -0.03 || p.sx - halfW > 0.33 || p.sy < 0.45;
              };
              /** camera C's foreground: nothing new roots where frame 46 s sees the ground within 8 m */
              const offCNear = (x: number, z: number, reach: number) => {
                const p = field.screenPoint('C_lookback', x, T.height(x, z), z);
                if (!p || p.depth >= 8) return true;
                const halfW = (reach * 0.5) / (p.depth * cTan);
                return p.sx + halfW < -0.02 || p.sx - halfW > 1.02 || p.sy < -0.02;
              };
              /** the lit yellow-green of frame 14 s' foliage tops, for the lobe corner's crowns and tufts */
              const R38_LIT = new Color(1.16, 1.12, 0.9);
              /** the corner's carpet: frame 14 s' lawn beside the crowns is lit, not bleached */
              const R38_CARPET = new Color(1.12, 1.1, 0.94);
              /** ground every round-38 set shares: off the paving, the rock rings, the trunks, the kids' spots, the shot-A bank face and camera C's bank */
              const openGround = (x: number, z: number, s: FieldSample, edge: number) => {
                if (s.cliff > 0.35 || field.bankFace(x, z) > 0.3 || field.lawnEdgeDistance(x, z, true) < edge || field.cFoot(x, z) > 0.02) return false;
                const clr = field.clearing(x, z);
                if (clr.insideBoulder || field.boulderDistance(x, z) < 0.25 || field.giantDistance(x, z) < 0.3) return false;
                return !nearKid(x, z, 0.8) && offD(x, z);
              };
              /**
               * terrace ground for a standing plant of horizontal `reach`: off the house pad, root and
               * crown off camera F, fronds off camera C's box
               */
              const terraceGround = (x: number, z: number, s: FieldSample, reach: number) => {
                if (!openGround(x, z, s, 0.15) || field.houseInfo(x, z).dist < 0.35 || nearKid(x, z, 1.0)) return false;
                return offF(x, z, reach) && offCEdge(x, z, reach);
              };
              /** the terrace's herb layer (clover, cushions, short tufts): the stones' 0.5 m and the strip allowed */
              const terraceCover = (x: number, z: number, s: FieldSample) => {
                if (!openGround(x, z, s, 0.1) || field.stoneDistance(x, z) < 0.12 || field.houseInfo(x, z).dist < 0.2) return false;
                return offF(x, z, 0.25);
              };
              /** the lobe corner for a plant of horizontal `reach`: east of F's mass, off camera C's foreground, off the flagstones' rim */
              const cornerGround = (x: number, z: number, s: FieldSample, edge: number, reach: number) => {
                if (!openGround(x, z, s, edge) || field.stoneDistance(x, z) < 0.12) return false;
                return eastOfFMass(x, z, reach) && offCNear(x, z, reach);
              };
              const fernTop = (v: number) => ferns.opts.variants[v][0].boundingBox?.max.y ?? 0.65;
              /** the widest crown's fronds per metre of height (variant 2: reach 0.85 m at 0.56 m) */
              const fernReachPerTop = Math.max(
                ...ferns.opts.variants.map((v) => {
                  const b = v[0].boundingBox;
                  return b ? Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) / b.max.y : 1.55;
                }),
              );
              /** a fern crown scaled to `top` metres (the frames' 30–50 cm understory crowns) */
              const crownAt = (x: number, z: number, s: FieldSample, rng: Rng, top: number, lit: Color | null) => {
                const variant = rng.int(0, ferns.variantCount);
                const sc = top / fernTop(variant);
                composeMatrix(M, 0, x, T.height(x, z) - 0.02, z, s.nx, s.ny, s.nz, 0.7, rng() * Math.PI * 2, sc, sc, sc);
                const c = greenVar(rng, 0.18);
                ferns.add(M, variant, lit ? c.multiply(lit) : c);
                return { x, z, scale: sc, low: top <= 0.35 };
              };
              const newFerns38: { x: number; z: number; scale: number; low: boolean }[] = [];
              /** hosta clumps: 1.6–2.3 × the sheet laminae (24–34 cm across, ≤ 0.34 m tall — camera C's contract is 0.35) */
              const hostaAt = (x: number, z: number, s: FieldSample, rng: Rng, lit: Color | null) => {
                const c = greenVar(rng, 0.16);
                placeInstance(weeds, x, z, s, rng, 1.6 + rng() * 0.7, 0.8, 0.012, lit ? c.multiply(lit) : c);
              };

              // ---- (T) the terrace lawn between the landing and the door, turf-toned: crowns
              // 0.36–0.48 m either side of the stones' strip (roots out of the strip's feather: the
              // widest fronds reach 0.75 m), hostas between them, cushions thickest at the trunk
              // base, tufts, buds
              scatter(
                ctx,
                field,
                {
                  label: 'ferns-r38-terrace',
                  candidates: 16000,
                  box: TERRACE_BOX,
                  minSpacing: 0.36,
                  max: 22,
                  r32: true,
                  accept: (x, z, s) => (terraceGround(x, z, s, 0.48 * fernReachPerTop) && field.troddenZone(x, z, true) <= 0.3 && !nearFern(x, z, 0.3) ? 0.7 + 0.3 * field.cluster(x, z) : 0),
                },
                (x, z, s, rng) => newFerns38.push(crownAt(x, z, s, rng, 0.36 + rng() * 0.12, null)),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'weeds-r38-terrace',
                  candidates: 20000,
                  box: TERRACE_BOX,
                  minSpacing: 0.22,
                  max: 64,
                  r32: true,
                  accept: (x, z, s) => (terraceGround(x, z, s, 0.4) && field.lawnEdgeDistance(x, z, true) >= 0.2 ? 0.85 * (0.5 + field.cluster(x, z)) : 0),
                },
                (x, z, s, rng) => hostaAt(x, z, s, rng, null),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'moss-r38-terrace',
                  candidates: 12000,
                  box: TERRACE_BOX,
                  minSpacing: 0.26,
                  low: true,
                  max: 80,
                  r32: true,
                  // thickest at the trunk base (the frames' moss on the roots)
                  accept: (x, z, s) => (terraceCover(x, z, s) ? 0.45 + 0.55 * (1 - smoothstep(0.2, 1.8, field.houseInfo(x, z).dist)) + 0.3 * field.cluster(x, z) : 0),
                },
                // ≤ 0.27 m across (the rim-moss contract: cushions by the paving stay under 0.12 m)
                (x, z, _s, rng) => placeMossWith(rng, x, z, 0.1 + rng() * 0.17, true),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'clover-r38-terrace',
                  candidates: 16000,
                  box: TERRACE_BOX,
                  minSpacing: 0.14,
                  low: true,
                  max: 300,
                  r32: true,
                  accept: (x, z, s) => (terraceCover(x, z, s) ? 0.8 * (0.5 + field.cluster(x, z)) : 0),
                },
                (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 1.0 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.18)),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'tufts-r38-terrace',
                  candidates: 20000,
                  box: TERRACE_BOX,
                  minSpacing: 0.22,
                  low: true,
                  max: 150,
                  r32: true,
                  accept: (x, z, s) => (terraceCover(x, z, s) ? 0.9 * (0.5 + field.cluster(x, z)) : 0),
                },
                // short at the stones and in the strip (tuftAt's rules), short / mid / tall on the open lawn
                (x, z, s, rng) => tuftAt(x, z, s, rng, [0.3, 0.5, 0.2], greenVar(rng, 0.12), 0, 0, true),
              );

              // ---- (SE) the lobe's south-east corner — frame 14 s' right-edge crown group: lit
              // crowns 0.3–0.45 m in a group, hostas and a lit carpet under them
              scatter(
                ctx,
                field,
                {
                  label: 'ferns-r38-corner',
                  candidates: 16000,
                  box: LOBE_SE_BOX,
                  minSpacing: 0.3,
                  max: 12,
                  r32: true,
                  // the gate takes the mid variants' reach (1.2 × the height): the widest crown's tips may cross F.sx 0.17–0.19, still off the mass
                  accept: (x, z, s) => (cornerGround(x, z, s, 0.25, 0.42 * 1.2) && field.troddenZone(x, z, true) <= 0.3 && !nearFern(x, z, 0.3) && !nearWhite(x, z, 0.4) ? 0.75 : 0),
                },
                (x, z, s, rng) => newFerns38.push(crownAt(x, z, s, rng, 0.3 + rng() * 0.12, R38_LIT)),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'weeds-r38-corner',
                  candidates: 16000,
                  box: LOBE_SE_BOX,
                  minSpacing: 0.18,
                  max: 70,
                  r32: true,
                  accept: (x, z, s) => (cornerGround(x, z, s, 0.2, 0.4) && !nearWhite(x, z, 0.35) ? 0.9 * (0.5 + field.cluster(x, z)) : 0),
                },
                (x, z, s, rng) => hostaAt(x, z, s, rng, R38_CARPET),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'clover-r38-corner',
                  candidates: 20000,
                  box: LOBE_SE_BOX,
                  minSpacing: 0.12,
                  low: true,
                  max: 260,
                  r32: true,
                  accept: (x, z, s) => (cornerGround(x, z, s, 0.1, 0.2) ? 0.85 * (0.5 + field.cluster(x, z)) : 0),
                },
                (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 1.0 + rng() * 0.7, 0.9, 0.008, greenVar(rng, 0.18).multiply(R38_CARPET)),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'moss-r38-corner',
                  candidates: 10000,
                  box: LOBE_SE_BOX,
                  minSpacing: 0.28,
                  low: true,
                  max: 50,
                  r32: true,
                  accept: (x, z, s) => (cornerGround(x, z, s, 0.15, 0.3) ? 0.7 * (0.5 + field.cluster(x, z)) : 0),
                },
                (x, z, _s, rng) => placeMossWith(rng, x, z, 0.1 + rng() * 0.17, true),
              );
              scatter(
                ctx,
                field,
                {
                  label: 'tufts-r38-corner',
                  candidates: 20000,
                  box: LOBE_SE_BOX,
                  minSpacing: 0.17,
                  low: true,
                  max: 160,
                  r32: true,
                  accept: (x, z, s) => (cornerGround(x, z, s, 0.1, 0.35) ? 0.9 * (0.5 + field.cluster(x, z)) : 0),
                },
                // short / mid classes only: the corner stays under camera C's 0.35 m (tuftAt caps the wedge at 0.34 m)
                (x, z, s, rng) => tuftAt(x, z, s, rng, [0.4, 0.6, 0], R38_LIT, 0, 0, true),
              );

              // fiddleheads (0.27–0.43 m) in about a third of the new crowns (2–3 each), their own stream
              {
                const rng = ctx.rng.fork('plants/fiddleheads-r38');
                const s = newSample();
                for (const f of newFerns38) {
                  if (rng() > 0.35) continue;
                  const count = 2 + rng.int(0, 2);
                  for (let i = 0; i < count; i++) {
                    const a = rng() * Math.PI * 2;
                    const d = 0.1 * f.scale * (0.3 + 0.7 * rng());
                    const x = f.x + Math.cos(a) * d;
                    const z = f.z + Math.sin(a) * d;
                    field.sample(x, z, s);
                    if (!field.allowed(x, z, s, true) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
                    if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z, true) > 0.6) continue;
                    // buds are 0.295–0.41 m at scale 1; the low crowns (≤ 0.35 m) take the short variant only
                    placeInstance(fiddleheads, x, z, s, rng, 0.92 + rng() * 0.12, 0.5, 0.012, greenVar(rng, 0.12), undefined, f.low ? [0, 1] : [0, fiddleheads.variantCount]);
                  }
                }
              }

              // ---- (H) the trunk-base tiers: two clipped crowns 0.6–0.85 m beside the door path —
              // north-west of the door and south of it — 0.35 m off the house pad, 0.5 m off the
              // stones, out of the strip; dark like the door row. Frame 14 s' doorway is the dark
              // opening B 0.65–0.81 × 0.35–0.57 with its lit floor and threshold at 0.71–0.80: the
              // crowns stand at the opening's dark posts (B 0.67 and 0.83), never over the lit
              // threshold (plants.test).
              {
                const rng = ctx.rng.fork('plants/hedge-r38-door');
                const s = newSample();
                const spots: readonly (readonly [number, number])[] = [
                  [8.75, -10.75],
                  [10.4, -7.4],
                ];
                for (const [cx, cz] of spots) {
                  for (let attempt = 0; attempt < 40; attempt++) {
                    const x = cx + (rng() - 0.5) * 0.5;
                    const z = cz + (rng() - 0.5) * 0.5;
                    field.sample(x, z, s);
                    if (!field.allowed(x, z, s, true) || field.insideGiantTrunk(x, z) || !openGround(x, z, s, 0.3)) continue;
                    if (field.houseInfo(x, z).dist < 0.35 || field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z, true) > 0.3 || nearKid(x, z, 1.2)) continue;
                    if (!offCEdge(x, z, 0.5) || nearHedge(x, z, 0.8)) continue;
                    const top = 0.6 + rng() * 0.25;
                    const variant = rng.int(0, hedge.variantCount);
                    const sc = top / hedgeHeight(variant);
                    composeMatrix(M, 0, x, T.height(x, z) - 0.05, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.2 + rng() * 0.3), sc, sc * (1.2 + rng() * 0.3));
                    hedge.add(M, variant, tint.setRGB(0.54 + rng() * 0.08, 0.55 + rng() * 0.08, 0.47 + rng() * 0.08));
                    break;
                  }
                }
              }

              // ---- verge flowers (frames 14 / 24: small pale dots in the lawn beside the stones and
              // in the corner, a few violets). ≤ 0.25 m, ≥ 0.5 m off every stone, off the strip
              // (`troddenZone` 0: the whites' contract), ≥ 0.45 m from every violet, never in a
              // kid's spot.
              const vergeGround = (x: number, z: number, s: FieldSample) => {
                if (!openGround(x, z, s, 0.2) || field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0 || field.houseInfo(x, z).dist < 0.3) return false;
                return !nearKid(x, z, 1.0) && !nearViolet(x, z, 0.5);
              };
              const vergeWhite = (x: number, z: number, s: FieldSample, rng: Rng) =>
                placeInstance(whiteFlowers, x, z, s, rng, 0.75 + rng() * 0.35, 0.6, 0.01, tint.setRGB(0.97 + rng() * 0.06, 0.97 + rng() * 0.06, 0.95 + rng() * 0.06));
              // straw-yellow cluster heads at 0.48–0.55 of their size: 0.21–0.25 m
              const vergeYellow = (x: number, z: number, s: FieldSample, rng: Rng) =>
                placeInstance(yellowFlowers, x, z, s, rng, 0.48 + rng() * 0.07, 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1));
              scatter(
                ctx,
                field,
                { label: 'flowers-white-r38-terrace', candidates: 12000, box: TERRACE_BOX, minSpacing: 0.6, max: 16, r32: true, accept: (x, z, s) => (vergeGround(x, z, s) && offF(x, z, 0.3) && !nearWhite(x, z, 0.6) ? 0.7 : 0) },
                vergeWhite,
              );
              scatter(
                ctx,
                field,
                { label: 'flowers-yellow-r38-terrace', candidates: 12000, box: TERRACE_BOX, minSpacing: 0.6, max: 14, r32: true, accept: (x, z, s) => (vergeGround(x, z, s) && offF(x, z, 0.3) && !nearWhite(x, z, 0.35) ? 0.7 : 0) },
                vergeYellow,
              );
              scatter(
                ctx,
                field,
                { label: 'flowers-white-r38-corner', candidates: 8000, box: LOBE_SE_BOX, minSpacing: 0.6, max: 8, r32: true, accept: (x, z, s) => (vergeGround(x, z, s) && cornerGround(x, z, s, 0.2, 0.25) && !nearWhite(x, z, 0.6) ? 0.7 : 0) },
                vergeWhite,
              );
              scatter(
                ctx,
                field,
                { label: 'flowers-yellow-r38-corner', candidates: 8000, box: LOBE_SE_BOX, minSpacing: 0.6, max: 6, r32: true, accept: (x, z, s) => (vergeGround(x, z, s) && cornerGround(x, z, s, 0.2, 0.3) && !nearWhite(x, z, 0.35) ? 0.7 : 0) },
                vergeYellow,
              );
            }
          }
        }
      }
    }
  }

  // ======== Round 40 — verge transitions (the owner's video review: "fern/leaf-litter transitions
  // at the verge. Keep the paths clear."). Where the lawn meets the paving (field.ts rimCandidates:
  // the spine, the stair branch, the plaza discs and the bank toe, VERGE_IN..VERGE_BAND m outside
  // the rim — the rim's own 0.25 m keeps its moss cushions and litter seam) and where it meets the
  // main flight's and the house flight's flank banks (the feathered foot of each `flankZone` /
  // `houseFlankZone`), a band of small ferns, broad leaves and short tufts with clover breaks the
  // hard line between turf and slab. The band runs from its own streams after every scatter above,
  // so no earlier plant moves. Every seat keeps the standing rules: nothing on the paving, within
  // STONE_CLEARANCE of a stepping stone or in the trodden strip (frames 14 / 24), off the shot-A
  // bank face (frame 1's tufts), off camera C's stair-foot wedge and its foreground (frame 46),
  // off D's bare shoulders and hollow (frame 56), out of frame 8 s' dark mass (F 0–0.17 ×
  // 0.44–0.665) and frame 14 s' lawn band, clear of the kids' spots, and out of the round-38
  // boxes whose crown heights are contracts of their own (the terrace, the lobe corner, the crest).
  // Budget (the round-39 isolation, both passes): a fern inside 12 m costs ≈ 6 800 triangles, a
  // broad leaf ≈ 570, a tuft ≈ 250, a clover ≈ 360 — so the band is tufts, leaves and clover with
  // a fern every metre or two (own spacing grid), ≈ 1 000 plants over the rims and the bank feet.
  {
    const VERGE_IN = 0.25;
    const VERGE_BAND = 1.3;
    const VERGE_PER_M = 22;
    const BANK_PER_M2 = 12;
    const rng = ctx.rng.fork('plants/verge-r40');
    const bankRng = ctx.rng.fork('plants/verge-bank-r40');
    const s = newSample();
    const kidSpots: readonly (readonly [number, number])[] = [...ctx.layout.npcSpots.map((n) => [n.position[0], n.position[2]] as const), A_BANK_KID, F_BANK_KID];
    const fov = (id: string) => Math.tan(((ctx.layout.viewpoints.find((v) => v.id === id)?.fov ?? 46) * Math.PI) / 360) * (16 / 9);
    const fTan = fov('F_canopy');
    const cTan = fov('C_lookback');
    const cFootBox = field.cFootBox();
    const inBox = (x: number, z: number, b: readonly [number, number, number, number]) => x >= b[0] && z >= b[1] && x <= b[2] && z <= b[3];
    const R38_BOXES: readonly (readonly [number, number, number, number])[] = [
      [6.3, -11, 8.8, -8.4],
      [6.7, -4.9, 8.5, -2.4],
      [6.0, 3.5, 8.8, 5.6],
    ];
    /** frame 8 s' dark left mass (plants.test: its population is capped) — a plant of horizontal `reach` within 14 m that projects into it */
    const inFMass = (x: number, z: number, reach: number) => {
      const p = field.screenPoint('F_canopy', x, T.height(x, z), z);
      if (!p || p.depth > 14) return false;
      const hw = (reach * 0.5) / (p.depth * fTan);
      return p.sx + hw >= 0 && p.sx - hw <= 0.17 && p.sy >= 0.44 && p.sy <= 0.665;
    };
    /** camera C's foreground within 8 m (frame 46 s: trodden earth, nothing new stands in it) */
    const inCNear = (x: number, z: number, reach: number) => {
      const p = field.screenPoint('C_lookback', x, T.height(x, z), z);
      if (!p || p.depth >= 8) return false;
      const hw = (reach * 0.5) / (p.depth * cTan);
      return !(p.sx + hw < -0.02 || p.sx - hw > 1.02 || p.sy < -0.02);
    };
    const nearWhite = (x: number, z: number, r: number) => whiteFlowers.items.some((it) => Math.hypot(it.x - x, it.z - z) < r);
    /** the ground every verge plant shares (samples `s`) */
    const vergeGround = (x: number, z: number) => {
      field.sample(x, z, s);
      if (!field.allowed(x, z, s, true) || field.insideGiantTrunk(x, z) || s.cliff > 0.35) return false;
      if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z, true) > 0.6 || field.bankFace(x, z) > 0.3) return false;
      if (field.dShoulder(x, z) > 0 || field.dHollow(x, s.h, z) > 0 || inBox(x, z, cFootBox) || field.lawnBand(x, z) > 0.5) return false;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0 || field.boulderDistance(x, z) < 0.25 || field.giantDistance(x, z) < 0.3) return false;
      return !kidSpots.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 1.0);
    };
    /** a plant over 0.12 m of horizontal `reach`: the frame contracts on standing plants */
    const standing = (x: number, z: number, reach: number) => !inFMass(x, z, reach) && !inCNear(x, z, reach) && field.sightlineC(x, z, reach) === 0;
    // one spacing grid per kind: a clover does not keep a fern away, only another fern does
    const fernSpacing = new Spacing(1.2);
    const leafSpacing = new Spacing(0.4);
    const tuftSpacing = new Spacing(0.25);
    const cloverSpacing = new Spacing(0.25);
    /** one seat of the band at weight `w` (0..1 across the band's profile), from stream `r` */
    const seat = (x: number, z: number, w: number, r: Rng) => {
      const roll = r();
      const draw = r();
      if (draw > w * field.falloff(x, z)) return;
      if (!vergeGround(x, z)) return;
      if (roll < 0.06) {
        // small understory fern, 0.21–0.5 m — one every metre or two of rim
        if (!standing(x, z, 0.6) || R38_BOXES.some((b) => inBox(x, z, b)) || !fernSpacing.ok(x, z, 1.1) || !leafSpacing.ok(x, z, 0.2)) return;
        placeInstance(ferns, x, z, s, r, 0.42 + r() * 0.2, 0.7, 0.02, greenVar(r, 0.2));
        fernSpacing.add(x, z);
      } else if (roll < 0.36) {
        // broad leaves (heart / ovate / round), ≤ 0.39 m, never over a white clump
        if (!standing(x, z, 0.35) || nearWhite(x, z, 0.45) || !leafSpacing.ok(x, z, 0.28) || !fernSpacing.ok(x, z, 0.2)) return;
        placeInstance(weeds, x, z, s, r, 0.9 + r() * 0.4, 0.8, 0.012, greenVar(r, 0.18).multiplyScalar(0.92));
        leafSpacing.add(x, z);
      } else if (roll < 0.76) {
        // a short or mid tuft (TUFT_HEIGHTS classes 0 / 1: ≤ 0.35 m)
        if (!standing(x, z, 0.3) || !tuftSpacing.ok(x, z, 0.15)) return;
        const cls = r() < 0.6 ? 0 : 1;
        const variant = cls + (r() < 0.5 ? 0 : 3);
        const sc = 0.8 + r() * 0.3;
        placeInstance(tufts, x, z, s, r, sc, 0.5, 0.01, greenVar(r, 0.16), sc, [variant, variant + 1]);
        tuftSpacing.add(x, z);
      } else {
        if (!cloverSpacing.ok(x, z, 0.14)) return;
        placeInstance(clover, x, z, s, r, 1.0 + r() * 0.5, 0.9, 0.008, greenVar(r, 0.18));
        cloverSpacing.add(x, z);
      }
    };
    // the paved rims
    field.rimCandidates(rng, VERGE_PER_M * q.density, VERGE_BAND, (px, pz, edge) => {
      const w = smoothstep(VERGE_IN, VERGE_IN + 0.2, edge) * (1 - smoothstep(0.85, VERGE_BAND, edge));
      seat(px, pz, w, rng);
    });
    // the flank banks' feet: candidates over each flank box, kept where the zone feathers in
    const bankFoot = (box: readonly [number, number, number, number] | null, zone: (x: number, z: number) => number) => {
      if (!box) return;
      const n = Math.round((box[2] - box[0]) * (box[3] - box[1]) * BANK_PER_M2 * q.density);
      for (let i = 0; i < n; i++) {
        const x = box[0] + bankRng() * (box[2] - box[0]);
        const z = box[1] + bankRng() * (box[3] - box[1]);
        const k = zone(x, z);
        const w = smoothstep(0.02, 0.2, k) * (1 - smoothstep(0.55, 0.85, k));
        if (w <= 0 || field.lawnEdgeDistance(x, z, true) < VERGE_IN) continue;
        seat(x, z, w, bankRng);
      }
    };
    bankFoot(field.flankBox(), (x, z) => field.flankZone(x, z));
    bankFoot(field.houseFlankBox(), (x, z) => field.houseFlankZone(x, z));
  }

  // ---- Round 44 — the north corridor's forest floor (field.ts `reach` / `northFloor`, survey-1
  // #4: the plain beyond the log arch and the ground under the white-barks east of the north path
  // were bare terrain). Over the ground the corridor adds beyond the detail disc the disc
  // scatters' own rules (ferns, broad leaves, clover, moss, seedheads at the disc's weights), and
  // wherever `northFloor` says forest floor — inside the disc too — NORTH_FLOOR_* × more: small
  // ferns, broad leaves and moss beds in patches (the frames north of the arch show a litter and
  // moss floor with sparse turf, no lawn). Own streams after every pass above, so nothing moves.
  // Nothing on the walk's verge (edge < 0.5 m), off the arch's footing and the columns.
  // The ferns and broad leaves go to their own sets — the disc sets' geometry, materials and LODs,
  // ending at NORTH_PLANT_MAX_M: the disc sets draw their far LODs at any range, and 800 fronds
  // 40–80 m north of camera D (in its frustum, behind the haze) would cost it 0.3 M triangles.
  const fernsNorth = new LodInstancedSet({ name: 'ferns-north', variants: ferns.opts.variants, material: ferns.opts.material, shadowMaterials: ferns.opts.shadowMaterials, lodDistances: ferns.opts.lodDistances, maxDistance: NORTH_PLANT_MAX_M * q.distance, castShadowLods: 1, packs: PACKS['ferns-north'] });
  const weedsNorth = new LodInstancedSet({ name: 'weeds-north', variants: weeds.opts.variants, material: weeds.opts.material, lodDistances: weeds.opts.lodDistances, maxDistance: NORTH_PLANT_MAX_M * q.distance, castShadowLods: 0, nearLods: 1, packs: PACKS['weeds-north'] });
  {
    const R = ctx.config.detailRadius;
    const box = field.corridorBox();
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    /** the pass' weight at (x, z): the disc's weight where the corridor grows new ground, plus the forest floor's extra */
    const floorWeight = (x: number, z: number, s: FieldSample, extra: number) => {
      if (field.reach(x, z) > R) return 0;
      const nf = field.northFloor(x, z);
      const beyond = field.inCorridor(x, z);
      if (!beyond && nf <= 0) return 0;
      if (s.cliff > 0.5 || field.edgeDistance(x, z) < 0.5) return 0;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0.2 || field.logDistance(x, z) < 0.6) return 0;
      return field.falloffReach(x, z) * ((beyond ? 1 : 0) + extra * nf);
    };
    // moss beds: the forest floor's moss gathers in patches (the cluster noise squared)
    const bed = (x: number, z: number) => {
      const c = field.cluster(x, z);
      return c * c;
    };
    scatter(
      ctx,
      field,
      {
        label: 'ferns-north-r44',
        candidates: Math.round(area * 3.2 * q.density),
        box,
        minSpacing: 0.6,
        r32: true,
        accept(x, z, s) {
          const w = floorWeight(x, z, s, NORTH_FLOOR_FERNS);
          if (w <= 0) return 0;
          const gd = field.giantDistance(x, z);
          return 0.055 * w * (0.45 + 1.1 * field.cluster(x, z)) * (1 + 3.5 * (1 - smoothstep(0.2, 3.2, gd))) * (1 + 2 * smoothstep(0.15, 0.45, s.slope));
        },
      },
      (x, z, s, rng) => placeInstance(fernsNorth, x, z, s, rng, 0.4 + rng() * 0.35, 0.7, 0.02, greenVar(rng, 0.2).multiplyScalar(0.94)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'weeds-north-r44',
        candidates: Math.round(area * 7.4 * q.density),
        box,
        minSpacing: 0.22,
        r32: true,
        accept(x, z, s) {
          const w = floorWeight(x, z, s, NORTH_FLOOR_WEEDS);
          return w <= 0 ? 0 : 0.42 * w * (0.3 + field.flowerPatch(x, z)) * field.cluster(x, z);
        },
      },
      (x, z, s, rng) => placeInstance(weedsNorth, x, z, s, rng, 0.65 + rng() * 0.65, 0.8, 0.012, greenVar(rng, 0.22).multiplyScalar(0.9)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'clover-north-r44',
        candidates: Math.round(area * 4.9 * q.density),
        box,
        minSpacing: 0.18,
        low: true,
        r32: true,
        accept(x, z, s) {
          const w = floorWeight(x, z, s, NORTH_FLOOR_WEEDS);
          return w <= 0 ? 0 : 0.16 * w * (0.4 + field.cluster(x, z)) * (1 + 0.8 * field.giantProximity(x, z, 5));
        },
      },
      (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.75 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'moss-north-r44',
        candidates: Math.round(area * 3 * q.density),
        box,
        minSpacing: 0.35,
        low: true,
        r32: true,
        accept(x, z, s) {
          if (field.reach(x, z) > R || s.cliff > 0.5 || field.edgeDistance(x, z) < 0.3 || field.clearing(x, z).insideBoulder) return 0;
          const nf = field.northFloor(x, z);
          const beyond = field.inCorridor(x, z);
          if (!beyond && nf <= 0) return 0;
          // the disc scatter's weight on the new ground; the beds' on the forest floor
          return field.falloffReach(x, z) * ((beyond ? 0.03 * (0.3 + smoothstep(0.1, 0.4, s.slope)) * (0.5 + field.cluster(x, z)) : 0) + NORTH_FLOOR_MOSS * nf * bed(x, z)) * (1 - 0.7 * field.dry(x, z));
        },
      },
      (x, z, _s, rng) => placeMossWith(rng, x, z, 0.08 + rng() * 0.22, true),
    );
    scatter(
      ctx,
      field,
      {
        label: 'seedheads-north-r44',
        candidates: Math.round(area * 1.2 * q.density),
        box,
        minSpacing: 0.25,
        r32: true,
        accept(x, z, s) {
          const w = floorWeight(x, z, s, 0);
          return w <= 0 ? 0 : 0.28 * w * field.meadow(x, z) * (0.5 + field.cluster(x, z)) * (1 - field.giantProximity(x, z));
        },
      },
      (x, z, s, rng) => placeInstance(seedheads, x, z, s, rng, 0.75 + rng() * 0.5, 0.5, 0.01, tint.setRGB(0.95 + rng() * 0.12, 0.95 + rng() * 0.08, 0.9 + rng() * 0.1)),
    );
    // frame 56 s' hollow keeps nothing standing (the round-32 rule above): the forest-floor ferns
    // and stalks that landed in it go too
    fernsNorth.prune((it) => field.dHollow(it.x, it.y, it.z) > 0.5);
    seedheads.prune((it) => field.dHollow(it.x, it.y, it.z) > 0.5);

    // ---- Round 47 — the north path's verge (NORTH_VERGE_*): the band's weight at (x, z), 0 off it
    const vergeBox: [number, number, number, number] = [Math.min(box[0], -8), Math.min(box[1], -80), Math.max(box[2], 14), NORTH_VERGE_Z0];
    const vergeArea = (vergeBox[2] - vergeBox[0]) * (vergeBox[3] - vergeBox[1]);
    const verge = (x: number, z: number, s: FieldSample, band: readonly [number, number, number, number]) => {
      if (z > NORTH_VERGE_Z0 || field.reach(x, z) > R) return 0;
      const edge = field.edgeDistance(x, z);
      const w = smoothstep(band[0], band[1], edge) * (1 - smoothstep(band[2], band[3], edge));
      if (w <= 0) return 0;
      if (s.cliff > 0.5 || field.dShoulder(x, z) > 0) return 0;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0.2 || clr.boulder > 0.3 || field.giantDistance(x, z) < 0.6 || field.logDistance(x, z) < 1.0) return 0;
      // 2026-09-23 (the owner, walking north: "make the grass thicker on the left side"): frame
      // 56 s' hollow IS the whole west bank from z −20 to −50, and while it rejected this band
      // outright the corridor grew its fern-and-shrub verge on the EAST bank alone — the walk's
      // left side was bald turf against a layered right one. The hollow now keeps
      // D_HOLLOW_VERGE_KEEP of the band (its ground cover stays the frame's low one: the blades'
      // D_HOLLOW_HEIGHT and the carpet's cut are untouched).
      const hollow = field.dHollow(x, s.h, z);
      // the path's own bank only: the plain beyond the corridor's fade is the forest floor's
      const dz = 1 - smoothstep(NORTH_VERGE_Z0 - 3, NORTH_VERGE_Z0, z);
      const dKeep = z > NORTH_VERGE_D_Z ? NORTH_VERGE_D_KEEP : 1;
      return w * dz * dKeep * (1 - (1 - D_HOLLOW_VERGE_KEEP) * hollow) * Math.max(field.falloffReach(x, z), NORTH_CARPET_REACH_FLOOR_PLANTS);
    };
    scatter(
      ctx,
      field,
      {
        label: 'ferns-north-verge-r47',
        candidates: Math.round(vergeArea * NORTH_VERGE_FERN_PER_M2 * q.density),
        box: vergeBox,
        minSpacing: 0.42,
        r32: true,
        accept(x, z, s) {
          const w = verge(x, z, s, NORTH_VERGE_FERN_EDGE);
          return w <= 0 ? 0 : 0.9 * w * (0.55 + 0.9 * field.cluster(x, z)) * (1 + 1.2 * smoothstep(0.12, 0.4, s.slope));
        },
      },
      (x, z, s, rng) => placeInstance(fernsNorth, x, z, s, rng, 0.6 + rng() * 0.4, 0.6, 0.02, greenVar(rng, 0.18).multiplyScalar(NORTH_VERGE_FERN_TINT)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'bushes-north-verge-r47',
        candidates: Math.round(vergeArea * NORTH_VERGE_BUSH_PER_M2 * q.density),
        box: vergeBox,
        minSpacing: 2.4,
        r32: true,
        accept(x, z, s) {
          const w = verge(x, z, s, NORTH_VERGE_BUSH_EDGE);
          if (w <= 0) return 0;
          if (bushes.items.some((p) => Math.hypot(p.x - x, p.z - z) < 2.0)) return 0;
          return 0.6 * w * (0.4 + field.cluster(x, z));
        },
      },
      (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.6 + rng() * 0.3, 0.3, 0.04, tint.setRGB(NORTH_VERGE_BUSH_TINT + rng() * 0.1, NORTH_VERGE_BUSH_TINT + 0.05 + rng() * 0.1, NORTH_VERGE_BUSH_TINT - 0.08 + rng() * 0.1)),
    );
  }

  // ---- Round 47 — ref-01's house shrubs: big glossy laminae in a low mound at the house's foot,
  // flanking the door (HOUSE_SHRUB_ANGLES off the facing, HOUSE_SHRUB_OFF m past the trunk). The
  // scatters left Saria's foot bare (its clearance rings), so these are authored per house; the
  // retarget below (HOUSE_BIG_LEAF_M) makes every one the big-leaf variant.
  {
    const rng = ctx.rng.fork('plants/house-shrubs-r47');
    const s = newSample();
    for (const h of ctx.layout.houses) {
      const facing = Math.atan2(h.facing[0], h.facing[1]);
      for (const a of HOUSE_SHRUB_ANGLES) {
        const ang = facing + (a * Math.PI) / 180 + (rng() - 0.5) * 0.12;
        const off = h.trunkRadius + HOUSE_SHRUB_OFF[0] + rng() * (HOUSE_SHRUB_OFF[1] - HOUSE_SHRUB_OFF[0]);
        const x = Math.round((h.position[0] + Math.sin(ang) * off) * 1000) / 1000;
        const z = Math.round((h.position[2] + Math.cos(ang) * off) * 1000) / 1000;
        const scale = 0.85 + rng() * 0.25;
        const c = greenVar(rng, 0.12).clone();
        field.sample(x, z, s);
        if (!field.allowed(x, z, s, true) || s.structure > 0.5 || s.stairs > 0.3 || field.pathEdgeDistance(x, z) < 0.35 || field.reach(x, z) > ctx.config.detailRadius) continue;
        if (bushes.items.some((p) => Math.hypot(p.x - x, p.z - z) < 1.1)) continue;
        placeInstance(bushes, x, z, s, rng, scale, 0.25, 0.05, c);
      }
    }
  }

  // ---- Round 44 (survey-1 #7): nothing sits on the lens. A bush whose crown reaches within
  // BUSH_LENS_CLEAR_M of the plateau walk's centre line (the survey's w26 → w27 → w28: from the
  // stair top along the fenced lip — the frame behind crop 15 stood inside a shrub there) shrinks
  // until it clears it, and goes if that would leave it under half its size. After every bush
  // pass, so no stream re-rolls; the layout paths keep their own rules (`edgeDistance`).
  {
    const radiusOf = (v: number) => {
      const g = bushes.opts.variants[v][1];
      if (!g.boundingSphere) g.computeBoundingSphere();
      return g.boundingSphere!.radius + g.boundingSphere!.center.length();
    };
    const walkDistance = (x: number, z: number) => {
      let d = Infinity;
      for (let i = 0; i < PLATEAU_WALK.length - 1; i++) {
        const [ax, az] = PLATEAU_WALK[i];
        const [bx, bz] = PLATEAU_WALK[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
        d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
      }
      return d;
    };
    bushes.prune((it) => {
      const d = walkDistance(it.x, it.z);
      const scale = Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
      const r0 = radiusOf(it.variant);
      if (d - r0 * scale >= BUSH_LENS_CLEAR_M) return false;
      const want = Math.max(0, d - BUSH_LENS_CLEAR_M) / r0;
      if (want < scale * 0.5) return true;
      const k = want / scale;
      for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) it.matrix[i] *= k;
      return false;
    });
  }

  // round 44 (survey-1 #10): no two violet clumps the one blue — every instance's pigment takes a
  // brightness and a hue lean (toward magenta or toward blue, FLOWER_CLUMP_LEAN of the red / blue
  // channels) from a stateless hash of its seat, on top of the per-head spread the geometry bakes.
  // After every flower pass, so no stream re-rolls and no head moves.
  {
    const hash01 = (x: number, z: number) => {
      let h = (Math.imul(Math.round(x * 1000), 374761393) + Math.imul(Math.round(z * 1000), 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    for (const it of flowers.items) {
      const gain = 1 + FLOWER_CLUMP_SPREAD * (hash01(it.x, it.z) * 2 - 1);
      const lean = FLOWER_CLUMP_LEAN * (hash01(it.z + 0.5, it.x) * 2 - 1);
      it.color = [it.color[0] * gain * (1 + lean), it.color[1] * gain, it.color[2] * gain * (1 - 0.5 * lean)];
    }
  }

  // round 47 (owner review item 10, ref-01): the big-leaf shrub variant (shrub.ts BIG_LEAF_STYLE — a
  // low mound of round glossy laminae) grows at the house feet only; everywhere else a bush that
  // drew it takes one of the two leafy crowns by a position hash, its mirror parity kept, so no
  // scatter's stream moves and the mirrored share holds
  for (const it of bushes.items) {
    const big = it.variant === BIG_LEAF_VARIANTS[0] || it.variant === BIG_LEAF_VARIANTS[1];
    const atHouse = field.houseInfo(it.x, it.z).dist < HOUSE_BIG_LEAF_M;
    if (atHouse) it.variant = BIG_LEAF_VARIANTS[0] + (it.variant & 1);
    else if (big) it.variant = (Math.abs(Math.floor(it.x * 7.31 + it.z * 3.17)) % 2) * 2 + (it.variant & 1);
  }
  // ---- Round 48 (vegetation-26) — the ground north of the log arch (see NORTH_BUSH_MAX_M and the
  // constants under it; field.ts NORTH_ZONE_Z). Own sets where the disc sets have no range cut,
  // own streams after every pass above; nothing south of the gate moves.
  const bushesNorth = new LodInstancedSet({ name: 'bushes-north', variants: bushes.opts.variants, material: bushes.opts.material, shadowMaterials: bushes.opts.shadowMaterials, lodDistances: bushes.opts.lodDistances, maxDistance: NORTH_BUSH_MAX_M * q.distance, castShadowLods: 2, nearLods: 1, packs: PACKS.bushes });
  const tuftsNorth = new LodInstancedSet({ name: 'tufts-north', variants: tufts.opts.variants, material: tufts.opts.material, lodDistances: tufts.opts.lodDistances, maxDistance: tufts.opts.maxDistance, castShadowLods: 0, packs: PACKS.tufts });
  const north = { clearingFerns: 0, flankFerns: 0, clearingBushes: 0, padTufts: 0, padClover: 0, stoneMoss: 0, farHerbs: 0, farFootFerns: 0, farFeet: 0, propRejected: 0 };
  {
    const L = ctx.layout;
    /** the clearing box grown by its feather and the terrace bay behind it */
    const clearingBox: [number, number, number, number] = [-11.5, -84.5, 11.5, -59];
    const clearingArea = (clearingBox[2] - clearingBox[0]) * (clearingBox[3] - clearingBox[1]);
    /** the ground every north pass keeps off: the rock face, the paving and a verge, the stones, the props' footprints */
    const groundOk = (x: number, z: number, s: FieldSample, verge: number, pad = 0.1): boolean => {
      if (s.cliff > 0.5 || s.structure > 0.3 || s.stairs > 0.05) return false;
      if (field.northPavingDistance(x, z) < verge) return false;
      if (field.standingStoneDistance(x, z) < STANDING_STONE_CLEAR + 0.15) return false;
      if (field.insidePropFootprint(x, z, pad)) {
        north.propRejected++;
        return false;
      }
      return true;
    };
    /** the pass's weight on the clearing's banks: the bank share, thicker up the slope and in the cluster noise */
    const bankWeight = (x: number, z: number, s: FieldSample, verge: number) => {
      const lawn = field.clearingLawn(x, z);
      if (lawn.bank <= 0.02 || !groundOk(x, z, s, verge)) return 0;
      return lawn.bank * (0.45 + 1.1 * field.cluster(x, z)) * (1 + 1.4 * smoothstep(0.1, 0.4, s.slope));
    };
    // (1a) dark ferns up the clearing's banks — ref-04's path edges: thickest in the first two
    // metres off the paving, thinning up the slope
    scatter(
      ctx,
      field,
      {
        label: 'ferns-clearing-r48',
        candidates: Math.round(clearingArea * CLEARING_FERN_PER_M2 * q.density),
        box: clearingBox,
        minSpacing: 0.42,
        r32: true,
        accept(x, z, s) {
          const w = bankWeight(x, z, s, 0.35);
          if (w <= 0) return 0;
          const edge = field.northPavingDistance(x, z);
          return CLEARING_FERN_P * w * (1 + 2.2 * (1 - smoothstep(0.35, 2.6, edge)));
        },
      },
      (x, z, s, rng) => {
        placeInstance(fernsNorth, x, z, s, rng, 0.55 + rng() * 0.45, 0.65, 0.02, greenVar(rng, 0.18).multiplyScalar(CLEARING_FERN_TINT));
        north.clearingFerns++;
      },
    );
    // (1b) the authored fern clumps flanking the terrace (the `ledge` flight's landing is between
    // them): bigger fronds, packed, on the banks either side of the pad
    {
      const rng = ctx.rng.fork('plants/ferns-terrace-flanks-r48');
      const s = newSample();
      for (const [cx, cz, r] of TERRACE_FLANK_FERNS) {
        for (let i = 0; i < TERRACE_FLANK_COUNT * 3 && north.flankFerns < TERRACE_FLANK_COUNT * TERRACE_FLANK_FERNS.length; i++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * r;
          const scale = 0.7 + rng() * 0.4;
          const c = greenVar(rng, 0.16).clone().multiplyScalar(CLEARING_FERN_TINT);
          const x = Math.round((cx + Math.cos(a) * d) * 1000) / 1000;
          const z = Math.round((cz + Math.sin(a) * d) * 1000) / 1000;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s, true) || !groundOk(x, z, s, 0.25) || field.clearing(x, z).npc > 0.4) continue;
          if (fernsNorth.items.some((p) => Math.abs(p.z - z) < 0.5 && Math.hypot(p.x - x, p.z - z) < 0.36)) continue;
          placeInstance(fernsNorth, x, z, s, rng, scale, 0.6, 0.02, c);
          north.flankFerns++;
        }
      }
    }
    // (1c) broad-leaf rosettes and clover between the fronds on the banks
    scatter(
      ctx,
      field,
      {
        label: 'weeds-clearing-r48',
        candidates: Math.round(clearingArea * 6 * q.density),
        box: clearingBox,
        minSpacing: 0.24,
        r32: true,
        accept(x, z, s) {
          const w = bankWeight(x, z, s, 0.2);
          return w <= 0 ? 0 : 0.2 * w * (0.4 + field.flowerPatch(x, z));
        },
      },
      (x, z, s, rng) => placeInstance(weedsNorth, x, z, s, rng, 0.65 + rng() * 0.6, 0.8, 0.012, greenVar(rng, 0.2).multiplyScalar(0.88)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'clover-clearing-r48',
        candidates: Math.round(clearingArea * 5 * q.density),
        box: clearingBox,
        minSpacing: 0.2,
        low: true,
        r32: true,
        accept(x, z, s) {
          const lawn = field.clearingLawn(x, z);
          const w = Math.max(lawn.bank, lawn.pad);
          if (w <= 0.02 || !groundOk(x, z, s, 0.12, 0.05)) return 0;
          return 0.14 * w * (0.5 + field.cluster(x, z));
        },
      },
      (x, z, s, rng) => {
        placeInstance(clover, x, z, s, rng, 0.75 + rng() * 0.55, 0.9, 0.008, greenVar(rng, 0.18));
        if (field.clearingLawn(x, z).pad > 0.5) north.padClover++;
      },
    );
    // (1d) leafy shrubs on the outer bank tops: dark crowns closing the clearing's horizon (ref-04's
    // shrub masses); off the pad, the flight, and the ferns' first metres
    scatter(
      ctx,
      field,
      {
        label: 'bushes-clearing-r48',
        candidates: Math.round(clearingArea * 1.4 * q.density),
        box: clearingBox,
        minSpacing: 2.2,
        r32: true,
        accept(x, z, s) {
          const lawn = field.clearingLawn(x, z);
          if (lawn.bank <= 0.3 || lawn.pad > 0.02 || !groundOk(x, z, s, 1.6, 0.6)) return 0;
          if (field.terracePad(x, z) > 0 || field.clearing(x, z).npc > 0.05) return 0;
          if (bushes.items.some((p) => Math.hypot(p.x - x, p.z - z) < 2.0)) return 0;
          // the outer banks: 2.5 m and more up from the disc's rim
          const rim = Math.hypot(x - L.northClearing.x, z - L.northClearing.z) - L.northClearing.radius;
          return 0.5 * lawn.bank * smoothstep(1.8, 3.2, rim) * (0.4 + field.cluster(x, z));
        },
      },
      (x, z, s, rng) => {
        placeInstance(bushesNorth, x, z, s, rng, 0.55 + rng() * 0.3, 0.3, 0.04, tint.setRGB(CLEARING_BUSH_TINT + rng() * 0.1, CLEARING_BUSH_TINT + 0.05 + rng() * 0.1, CLEARING_BUSH_TINT - 0.08 + rng() * 0.1));
        north.clearingBushes++;
      },
    );
    // the round-47 house-shrub rule for the north crowns too: the big-leaf variant grows at the
    // house feet only, so a north crown that drew it takes a leafy crown by a position hash
    for (const it of bushesNorth.items) {
      if (it.variant === BIG_LEAF_VARIANTS[0] || it.variant === BIG_LEAF_VARIANTS[1]) it.variant = (Math.abs(Math.floor(it.x * 7.31 + it.z * 3.17)) % 2) * 2 + (it.variant & 1);
    }
    // (2) the terrace pad's turf: tufts (short at the Kokiri's feet, mid elsewhere) over the pad's
    // clover above and the pad's carpet (carpet.ts / grass.ts read `clearingLawn.pad`)
    {
      const t = L.ledgeTerrace;
      const padBox: [number, number, number, number] = [t.x - t.halfLength - 0.6, t.z - t.halfDepth - 0.6, t.x + t.halfLength + 0.6, t.z + t.halfDepth + 0.6];
      const padArea = (padBox[2] - padBox[0]) * (padBox[3] - padBox[1]);
      scatter(
        ctx,
        field,
        {
          label: 'tufts-terrace-pad-r48',
          candidates: Math.round(padArea * PAD_TUFT_PER_M2 * q.density),
          box: padBox,
          minSpacing: 0.26,
          low: true,
          r32: true,
          accept(x, z, s) {
            const pad = field.clearingLawn(x, z).pad;
            if (pad <= 0.3 || !groundOk(x, z, s, 0.1, 0.05)) return 0;
            return 0.75 * pad * (1 - 0.5 * field.clearing(x, z).npc);
          },
        },
        (x, z, s, rng) => {
          // the height class: short where the Kokiri stands, short or mid elsewhere (no tall tufts on a 3 m pad)
          const npc = field.clearing(x, z).npc;
          const cls = npc > 0.3 ? 0 : rng() < 0.55 ? 0 : 1;
          const variant = cls + 3 * rng.int(0, 2);
          const scale = 0.8 + rng() * 0.3;
          composeMatrix(M, 0, x, T.height(x, z) - 0.01, z, s.nx, s.ny, s.nz, 0.85, rng() * Math.PI * 2, scale, scale, scale);
          tuftsNorth.add(M, variant, greenVar(rng, 0.2));
          north.padTufts++;
        },
      );
      scatter(
        ctx,
        field,
        {
          label: 'clover-terrace-pad-r48',
          candidates: Math.round(padArea * PAD_CLOVER_PER_M2 * q.density),
          box: padBox,
          minSpacing: 0.2,
          low: true,
          r32: true,
          accept(x, z, s) {
            const pad = field.clearingLawn(x, z).pad;
            return pad <= 0.3 || !groundOk(x, z, s, 0.1, 0.05) ? 0 : 0.4 * pad;
          },
        },
        (x, z, s, rng) => {
          placeInstance(clover, x, z, s, rng, 0.7 + rng() * 0.5, 0.9, 0.008, greenVar(rng, 0.18));
          north.padClover++;
        },
      );
    }
    // (3) moss cushions at the standing stones' feet: a ring STONE_MOSS_RING m off each axis, on
    // the paving (a scatter's `allowed` would reject the disc), sunk into the slabs' relief; the
    // stones' `structure` footprint (heightfield standingStoneMask, 1 inside 0.26 m) stays bare
    {
      const rng = ctx.rng.fork('plants/moss-standing-stones-r48');
      const nrm = new Vector3();
      for (const st of STONE_CIRCLE_STONES) {
        for (let i = 0; i < STONE_MOSS_COUNT; i++) {
          const a = rng() * Math.PI * 2;
          const d = STONE_MOSS_RING[0] + Math.pow(rng(), 1.6) * (STONE_MOSS_RING[1] - STONE_MOSS_RING[0]);
          const radius = 0.06 + rng() * 0.12;
          const x = Math.round((st.x + Math.cos(a) * d) * 1000) / 1000;
          const z = Math.round((st.z + Math.sin(a) * d) * 1000) / 1000;
          const m = T.mask(x, z);
          if (m.structure > 0.5 || m.stairs > 0.5 || field.insidePropFootprint(x, z)) continue;
          T.normal(x, z, nrm);
          const h = radius * (0.22 + rng() * 0.2);
          composeMatrix(M, 0, x, T.height(x, z) - 0.014, z, nrm.x, nrm.y, nrm.z, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
          moss.add(M, rng.int(0, 2), tint.setRGB(0.86 + rng() * 0.18, 0.92 + rng() * 0.16, 0.86 + rng() * 0.18));
          north.stoneMoss++;
        }
      }
    }
    // (4) the forest floor beyond the tunnel (`farFloor`): a low herb carpet — broad leaves,
    // clover, moss beds — over the litter (litter.ts), and dark ferns at the far trees' feet. The
    // ground runs past the field grid, so these sample the terrain exactly (field.ts sampleExact).
    {
      const farBox: [number, number, number, number] = [-26, -96, 32, -59];
      const farArea = (farBox[2] - farBox[0]) * (farBox[3] - farBox[1]);
      const s = newSample();
      const farGround = (x: number, z: number): number => {
        const ff = field.farFloor(x, z);
        if (ff <= 0.02) return 0;
        field.sampleExact(x, z, s);
        if (s.allow <= 0 || !groundOk(x, z, s, 0.3)) return 0;
        if (field.insideGiantTrunk(x, z) || field.logDistance(x, z) < 0.6) return 0;
        return ff;
      };
      const farPass = (label: string, perM2: number, minSpacing: number, accept: (x: number, z: number, ff: number) => number, place: (x: number, z: number, rng: Rng) => void) => {
        const rng = ctx.rng.fork(`plants/${label}`);
        const spacing = new Spacing(Math.max(minSpacing, 0.5));
        const n = Math.round(farArea * perM2 * q.density);
        for (let i = 0; i < n; i++) {
          const x = farBox[0] + rng() * (farBox[2] - farBox[0]);
          const z = farBox[1] + rng() * (farBox[3] - farBox[1]);
          const ff = farGround(x, z);
          const p = ff <= 0 ? 0 : accept(x, z, ff);
          if (p <= 0 || rng() > p) continue;
          if (!spacing.ok(x, z, minSpacing)) continue;
          spacing.add(x, z);
          place(x, z, rng);
          north.farHerbs++;
        }
      };
      farPass('weeds-far-floor-r48', 1.6, 0.3, (x, z, ff) => 0.35 * ff * (0.3 + field.cluster(x, z)) * (0.4 + field.flowerPatch(x, z)), (x, z, rng) => placeInstance(weedsNorth, x, z, s, rng, 0.6 + rng() * 0.6, 0.8, 0.012, greenVar(rng, 0.22).multiplyScalar(0.86)));
      farPass('clover-far-floor-r48', 1.4, 0.22, (x, z, ff) => 0.3 * ff * (0.4 + field.cluster(x, z)), (x, z, rng) => placeInstance(clover, x, z, s, rng, 0.75 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2).multiplyScalar(0.94)));
      farPass('moss-far-floor-r48', 1.0, 0.4, (x, z, ff) => {
        const c = field.cluster(x, z);
        return 0.5 * ff * c * c * (1 - 0.6 * field.dry(x, z));
      }, (x, z, rng) => {
        const radius = 0.1 + rng() * 0.24;
        const h = radius * (0.22 + rng() * 0.2);
        composeMatrix(M, 0, x, T.height(x, z) - 0.012, z, s.nx, s.ny, s.nz, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
        moss.add(M, rng.int(0, 2), tint.setRGB(0.88 + rng() * 0.2, 0.9 + rng() * 0.16, 0.88 + rng() * 0.2));
      });
      farPass('ferns-far-floor-r48', 0.9, 0.5, (x, z, ff) => 0.12 * ff * (0.3 + 1.2 * field.cluster(x, z)) * (1 + 2 * smoothstep(0.12, 0.4, s.slope)), (x, z, rng) => placeInstance(fernsNorth, x, z, s, rng, 0.45 + rng() * 0.4, 0.7, 0.02, greenVar(rng, 0.2).multiplyScalar(FAR_FOOT_FERN_TINT)));
      // the far trees' feet: the trees system's published seats north of the gate, and the authored
      // list (FAR_TREE_FEET) where it publishes none — a ring of dark ferns past the butt flare
      const feet: { x: number; z: number; r: number }[] = [];
      for (const seat of ctx.shared?.trunkSeats ?? []) {
        if (seat.z > -56 || Math.abs(seat.x) > 40) continue;
        feet.push({ x: seat.x, z: seat.z, r: seat.radiusAt(0.3) });
      }
      for (const [fx, fz, fr] of FAR_TREE_FEET) {
        if (feet.some((f) => Math.hypot(f.x - fx, f.z - fz) < FAR_FOOT_MERGE_M)) continue;
        feet.push({ x: fx, z: fz, r: fr });
      }
      north.farFeet = feet.length;
      const rng = ctx.rng.fork('plants/ferns-far-feet-r48');
      for (const f of feet) {
        let placed = 0;
        for (let i = 0; i < FAR_FOOT_FERNS * 3 && placed < FAR_FOOT_FERNS; i++) {
          const a = rng() * Math.PI * 2;
          const d = f.r + FAR_FOOT_RING[0] + Math.pow(rng(), 1.3) * (FAR_FOOT_RING[1] - FAR_FOOT_RING[0]);
          const scale = 0.5 + rng() * 0.45;
          const c = greenVar(rng, 0.18).clone().multiplyScalar(FAR_FOOT_FERN_TINT);
          const x = Math.round((f.x + Math.cos(a) * d) * 1000) / 1000;
          const z = Math.round((f.z + Math.sin(a) * d) * 1000) / 1000;
          field.sampleExact(x, z, s);
          if (s.allow <= 0 || !groundOk(x, z, s, 0.3) || field.clearingLawn(x, z).pad > 0.1) continue;
          if (fernsNorth.items.some((p) => Math.abs(p.z - z) < 0.45 && Math.hypot(p.x - x, p.z - z) < 0.4)) continue;
          placeInstance(fernsNorth, x, z, s, rng, scale, 0.65, 0.02, c);
          north.farFootFerns++;
          placed++;
        }
      }
    }
    // (5) the props' footprints (fable-3's fern-through-the-pot): every standing plant seated inside
    // one goes — the disc streams above never asked, and the props publish before we build
    if (field.propFootprintCount() > 0) {
      for (const set of [ferns, heroFerns, fiddleheads, tufts, flowers, yellowFlowers, whiteFlowers, weeds, seedheads, fernsNorth, weedsNorth, bushesNorth, tuftsNorth]) {
        const before = set.count;
        set.prune((it) => field.insidePropFootprint(it.x, it.z));
        north.propRejected += before - set.count;
      }
    }
  }

  // ---- 2026-09-23 (the owner, walking north from the plaza: "make the grass thicker on the left
  // side", and review46 `r_020`–`r_028` as the picture) — the WALKED verge. Every rule above is a
  // fixed camera's: the violets sit in authored clumps for shot D, the broad leaves thin out at
  // camera C's foreground, `LOW_ZONES` keeps the east verge bare for frames 46 / 56 and the round-47
  // fern-and-shrub band takes the east bank only. His recording crowds the slabs at every step
  // instead — violet cushions on the stones, round paddle leaves leaning over them, low fronds and
  // clover behind — thickest on the walker's LEFT. These four passes lay that band along the spine
  // and the north path (field.ts `pathVerge`), on their own streams after every pass above, so no
  // plant placed anywhere else moves.
  {
    const R = ctx.config.detailRadius;
    const vergeBox: [number, number, number, number] = [-8, -74, 10, 17];
    const vergeArea = (vergeBox[2] - vergeBox[0]) * (vergeBox[3] - vergeBox[1]);
    /**
     * The ultra tiers cost 4–5 K triangles an instance and every fixed camera's ring is budgeted
     * (plants.test: ≤ 40 of a set inside its ring). Five of the six viewpoints stand on the plaza,
     * which is the busiest stretch of the owner's walk, so the verge does not step around them —
     * it spends what is left of each ring's budget and stops. `ULTRA_CAP` keeps a margin under the
     * contract's 40.
     */
    const ULTRA_CAP = 37;
    const ultraBudget = (set: LodInstancedSet, ring: number) => {
      const vps = ctx.layout.viewpoints;
      const counts = vps.map((v) => set.items.filter((it) => Math.hypot(it.x - v.position[0], it.z - v.position[2]) < ring).length);
      const near = (x: number, z: number, i: number) => Math.hypot(x - vps[i].position[0], z - vps[i].position[2]) < ring;
      return {
        ok(x: number, z: number, add = 1) {
          for (let i = 0; i < vps.length; i++) if (near(x, z, i) && counts[i] + add > ULTRA_CAP) return false;
          return true;
        },
        take(x: number, z: number) {
          for (let i = 0; i < vps.length; i++) if (near(x, z, i)) counts[i]++;
        },
      };
    };
    const flowerBudget = ultraBudget(flowers, FLOWER_ULTRA_M);
    const weedBudget = ultraBudget(weeds, BROADLEAF_ULTRA_M);
    const cloverBudget = ultraBudget(clover, BROADLEAF_ULTRA_M);
    /**
     * the band's weight at (x, z) for a plant reaching `reach` m: the walked verge over `band`
     * metres off the paving, the west side VERGE_LEFT ×, and the ground rules every pass runs
     * (props, trunks, boulders, the Kokiri's spots, the stones' clearance).
     */
    const walkVerge = (x: number, z: number, s: FieldSample, band: readonly [number, number], reach: number): number => {
      const pv = field.pathVerge(x, z);
      if (pv.w <= 0 || pv.edge < band[0] || pv.edge > band[1] || field.reach(x, z) > R) return 0;
      if (s.cliff > 0.45 || s.structure > 0.3 || s.stairs > 0.05) return 0;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0.15 || clr.boulder > 0.3) return 0;
      if (field.giantDistance(x, z) < 0.5 || field.logDistance(x, z) < 1.0 || field.insidePropFootprint(x, z)) return 0;
      // frame 46 s' left third is the stair foot over short turf: nothing that reaches into it
      if (reach > 0.3 && field.sightlineC(x, z, reach) > 0) return 0;
      // frames 46 / 56's low right verge (LOW_ZONES, a plants.test contract: nothing over 0.55 m
      // in [1.5, −16, 7, −4]) keeps its scale rule — the verge grows there, it just stays low
      if (reach > 0.45 && field.lowZone(x, z) > 0.4) return 0;
      // frame 46 s' trodden bank before camera C (field.ts `cFoot`) is bare earth by design
      if (field.cFoot(x, z) > 0.25) return 0;
      // inside the band, thickest at the stones and fading out at its far edge
      const across = 1 - smoothstep(band[1] - 0.7, band[1], pv.edge);
      return pv.w * across * (pv.left ? VERGE_LEFT : 1) * Math.max(field.falloffReach(x, z), 0.75);
    };
    // (a) the violet cushions ON the stones' edge (r_024 / r_026 / r_028: compact clumps of
    // five-petal heads, 0.3–0.6 m across, the single loudest colour of his recording). Clump
    // centres along the band, then a handful of heads about each — the reference's habit, and the
    // shape the authored shot-D clumps already use.
    {
      const rng = ctx.rng.fork('plants/flowers-walk-verge');
      const s = newSample();
      const spacing = new Spacing(1.3);
      let clumpsPlaced = 0;
      for (let i = 0; i < 130000 && clumpsPlaced < 140; i++) {
        const cx = vergeBox[0] + rng() * (vergeBox[2] - vergeBox[0]);
        const cz = vergeBox[1] + rng() * (vergeBox[3] - vergeBox[1]);
        field.sample(cx, cz, s);
        if (!field.allowed(cx, cz, s, true) || field.insideGiantTrunk(cx, cz)) continue;
        const w = walkVerge(cx, cz, s, [0.12, 1.5], 0.32);
        // his violets gather — a mass at one verge, plain green for the next few steps, another
        // mass further on — so the clumps follow the flower patches steeply instead of lining
        // both edges evenly
        if (w <= 0 || rng() > 1.0 * w * Math.pow(field.flowerPatch(cx, cz), 1.5)) continue;
        if (field.stoneDistance(cx, cz) < STONE_CLEARANCE || field.troddenZone(cx, cz, true) > 0.6) continue;
        if (!spacing.ok(cx, cz, 1.3)) continue;
        spacing.add(cx, cz);
        clumpsPlaced++;
        const heads = 8 + rng.int(0, 7);
        for (let h = 0, tries = 0; h < heads && tries < heads * 4; tries++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * 0.42;
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s, true) || field.insideGiantTrunk(x, z) || walkVerge(x, z, s, [0.1, 1.7], 0.32) <= 0) continue;
          // the white clumps were seated first and keep 0.45 m off every violet (plants.test): a
          // new violet under one would break that contract from the other side
          if (whiteFlowers.items.some((w) => Math.hypot(w.x - x, w.z - z) < 0.46)) continue;
          if (!flowerBudget.ok(x, z)) continue;
          // frame 56 s' boulder bed measures 1 % violet — two small patches, not a field — and
          // camera D's box is held to them (plants.test, round 32). The walked verge keeps out of
          // that box; everywhere else on the walk it grows.
          const dp = field.screenPoint('D_log', x, T.height(x, z) + 0.12, z);
          if (dp && dp.depth <= 21 && dp.sx >= 0.08 && dp.sx <= 0.32 && dp.sy >= 0.53 && dp.sy <= 0.87) continue;
          placeInstance(flowers, x, z, s, rng, (1.05 + rng() * 0.35) * (1 - 0.35 * field.lowZone(x, z)), 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1), undefined, CLUSTER_HEADS);
          flowerBudget.take(x, z);
          h++;
        }
      }
    }
    // (b) the round paddle leaves leaning over the slabs (his verges are broad-leaf, not grass):
    // the weeds set at the top of its scale range, in the first metre and a half
    scatter(
      ctx,
      field,
      {
        label: 'weeds-walk-verge',
        candidates: Math.round(vergeArea * 16 * q.density),
        box: vergeBox,
        minSpacing: 0.26,
        r32: true,
        accept(x, z, s) {
          if (!weedBudget.ok(x, z)) return 0;
          const w = walkVerge(x, z, s, [0.1, 1.8], 0.28);
          return w <= 0 ? 0 : 0.75 * w * (0.35 + field.flowerPatch(x, z)) * (0.4 + field.cluster(x, z));
        },
      },
      (x, z, s, rng) => {
        placeInstance(weeds, x, z, s, rng, (1.0 + rng() * 0.8) * (1 - 0.4 * field.lowZone(x, z)), 0.85, 0.012, greenVar(rng, 0.2));
        weedBudget.take(x, z);
      },
    );
    // (c) low fronds behind them, on the band's outer half — the second layer of his verge
    scatter(
      ctx,
      field,
      {
        label: 'ferns-walk-verge',
        candidates: Math.round(vergeArea * 7 * q.density),
        box: vergeBox,
        minSpacing: 0.5,
        r32: true,
        accept(x, z, s) {
          // frame 14 s' lawn band stays the closed short turf it is (plants.test: no fern clumps in it)
          if (field.lawnBand(x, z) > 0.35) return 0;
          const w = walkVerge(x, z, s, [0.55, 2.4], 1.0);
          return w <= 0 ? 0 : 0.55 * w * (0.45 + 1.0 * field.cluster(x, z)) * (1 + 1.4 * smoothstep(0.12, 0.42, s.slope));
        },
      },
      (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, (0.5 + rng() * 0.38) * (1 - 0.4 * field.lowZone(x, z)), 0.7, 0.02, greenVar(rng, 0.18).multiplyScalar(0.95)),
    );
    // (d) the clover fringe right at the stones, under both (`low`: it may sit on the trodden strip)
    scatter(
      ctx,
      field,
      {
        label: 'clover-walk-verge',
        candidates: Math.round(vergeArea * 13 * q.density),
        box: vergeBox,
        minSpacing: 0.16,
        low: true,
        r32: true,
        accept(x, z, s) {
          if (!cloverBudget.ok(x, z)) return 0;
          const w = walkVerge(x, z, s, [0.06, 1.2], 0.2);
          return w <= 0 ? 0 : 0.5 * w * (0.4 + field.cluster(x, z));
        },
      },
      (x, z, s, rng) => {
        placeInstance(clover, x, z, s, rng, 0.8 + rng() * 0.55, 0.9, 0.008, greenVar(rng, 0.2));
        cloverBudget.take(x, z);
      },
    );
    // (e) leafy shrub crowns BEHIND the band (the lane's "shrubs at the path edges"): in his
    // recording the verge is three layers — violets and leaves on the stones, fronds behind them,
    // then dark leafy masses that break the middle distance up. Ours had the masses on the east
    // bank only (the round-47 band), so the walker's left middle ground read as one flat slope of
    // turf. These sit VERGE_SHRUB m off the paving, in the cluster noise's patches, never in the
    // frames' low right verge and never inside camera C's wedge.
    scatter(
      ctx,
      field,
      {
        label: 'bushes-walk-verge',
        candidates: Math.round(vergeArea * 14 * q.density),
        box: vergeBox,
        minSpacing: 2.8,
        r32: true,
        accept(x, z, s) {
          const pv = field.pathVerge(x, z);
          if (pv.edge < VERGE_SHRUB[0] || pv.edge > VERGE_SHRUB[1] || field.reach(x, z) > R) return 0;
          if (s.cliff > 0.45 || s.structure > 0.3 || s.stairs > 0.05) return 0;
          // they stand 0.6–1.0 m: out of the low right verge and out of camera C's left third
          if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.8) > 0) return 0;
          const clr = field.clearing(x, z);
          if (clr.insideBoulder || clr.npc > 0.1 || clr.boulder > 0.3) return 0;
          if (field.giantDistance(x, z) < 1.0 || field.logDistance(x, z) < 1.4 || field.insidePropFootprint(x, z, 0.4)) return 0;
          if (field.cFoot(x, z) > 0.1 || field.lawnBand(x, z) > 0.2 || field.troddenZone(x, z, true) > 0.2) return 0;
          if (bushes.items.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2)) return 0;
          const c = field.cluster(x, z);
          return 0.5 * (pv.left ? VERGE_LEFT : 0.65) * (0.2 + 1.1 * c) * Math.max(field.falloffReach(x, z), 0.75);
        },
      },
      (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.52 + rng() * 0.3, 0.3, 0.04, tint.setRGB(NORTH_VERGE_BUSH_TINT + 0.08 + rng() * 0.12, NORTH_VERGE_BUSH_TINT + 0.14 + rng() * 0.12, NORTH_VERGE_BUSH_TINT + rng() * 0.12)),
    );
  }

  // ---- 2026-09-24 — the low zone's ground cover (field.ts LOW_ZONES: the slope east of the north
  // path between camera C and the main stairs). That zone is a HEIGHT rule — frame 46 shows the
  // stair foot over it, frame 56 nothing above ≈ 0.5 m — but nothing ever laid a cover under it, so
  // the owner's most-walked verge read as a bare olive margin beside the paving while the west side
  // it faces is a closed turf. This is the flat layer: clover, low broad leaves and moss, none of it
  // over LOW_GROUND_MAX_TOP m, so every height contract on that ground still holds — the 0.55 m cap
  // over [1.5, −16, 7, −4], camera C's stair-foot box (which only tests plants over 0.35 m) and the
  // C-bank count. Frame 46's own trodden earth (`cFoot`) and the trodden strip take none.
  {
    const lowBox: [number, number, number, number] = [1.2, -16.5, 8.5, -3.5];
    const lowArea = (lowBox[2] - lowBox[0]) * (lowBox[3] - lowBox[1]);
    /** the zone's weight where a flat cover belongs: off the frames' bare grounds and off the paving */
    const lowGround = (x: number, z: number, s: FieldSample): number => {
      const low = field.lowZone(x, z);
      if (low <= 0.25 || s.cliff > 0.4 || s.structure > 0.3 || s.stairs > 0.05) return 0;
      if (field.cFoot(x, z) > 0.1 || field.troddenZone(x, z, true) > 0.3) return 0;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0.15 || field.insidePropFootprint(x, z)) return 0;
      if (field.giantDistance(x, z) < 0.5 || field.lawnEdgeDistance(x, z, true) < 0.12) return 0;
      return low * Math.max(field.falloffReach(x, z), 0.8);
    };
    scatter(
      ctx,
      field,
      {
        label: 'clover-low-zone',
        candidates: Math.round(lowArea * 26 * q.density),
        box: lowBox,
        minSpacing: 0.15,
        low: true,
        r32: true,
        accept: (x, z, s) => 0.55 * lowGround(x, z, s) * (0.45 + field.cluster(x, z)),
      },
      (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.7 + rng() * 0.45, 0.9, 0.008, greenVar(rng, 0.2)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'weeds-low-zone',
        candidates: Math.round(lowArea * 16 * q.density),
        box: lowBox,
        minSpacing: 0.24,
        r32: true,
        // the broad leaves lie flat here: LOW_GROUND_LEAF caps the scale well under the frames' 0.5 m
        accept: (x, z, s) => 0.5 * lowGround(x, z, s) * (0.3 + field.flowerPatch(x, z)) * (0.4 + field.cluster(x, z)),
      },
      (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, LOW_GROUND_LEAF[0] + rng() * (LOW_GROUND_LEAF[1] - LOW_GROUND_LEAF[0]), 0.9, 0.012, greenVar(rng, 0.2)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'moss-low-zone',
        candidates: Math.round(lowArea * 10 * q.density),
        box: lowBox,
        minSpacing: 0.3,
        low: true,
        r32: true,
        accept(x, z, s) {
          const w = lowGround(x, z, s);
          if (w <= 0) return 0;
          // camera C stands in this zone, and a moss cushion inside its ultra ring is ≈ 1 100
          // triangles (plants.test budgets that ring): the cover keeps out of every viewpoint's
          // ring, where the clover and the leaves above close the ground on their own
          if (ctx.layout.viewpoints.some((v) => Math.hypot(x - v.position[0], z - v.position[2]) < MOSS_ULTRA_M + 0.6)) return 0;
          const c = field.cluster(x, z);
          return 0.45 * w * c * c * (1 - 0.6 * field.dry(x, z));
        },
      },
      (x, z, _s, rng) => placeMossWith(rng, x, z, 0.07 + rng() * 0.16, true),
    );
  }

  const all = [ferns, tufts, heroFerns, fiddleheads, bushes, hedge, flowers, yellowFlowers, whiteFlowers, weeds, seedheads, clover, moss, saplings, fernsNorth, weedsNorth, bushesNorth, tuftsNorth];
  // Round 50 (expansion.ts): every pass above seats against the LEGACY ground; inside the
  // round-49 expansion (the south bank, the knoll, the discs, the flights) the live ground is
  // elsewhere, so the plants there go — after every seat and every rule, so nothing re-rolls
  // Round 50 (edges.ts): W06's rim band (moss cushions and short tufts at the paved rims E / D / B
  // frame) and W05's terraces (tuft rows, foot moss, toe ferns and broad leaves on the C
  // embankment) — after every pass above, on their own forks
  const edges = { ...rimBandPlants(ctx, field, { moss, tufts }), ...terracePlants(ctx, field, { tufts, moss, ferns, weeds }) };
  // round 57: butterflies.ts picks its clumps by index, so a clump fewer re-rolls every butterfly in
  // the six fixed frames — they keep the list as it stood before the ruins' rule (ruins.test.mjs:
  // none moves, and none flies over the ground that rule claims)
  const butterflyClumps = flowers.items.filter((it) => !expansionCull(it.x, it.z, 0.3, false));
  const expansionCulled = pruneExpansion(all);
  for (const set of all) parent.add(set.build());
  return { ferns, tufts, heroFerns, fiddleheads, bushes, hedge, flowers, yellowFlowers, whiteFlowers, weeds, seedheads, clover, moss, saplings, fernsNorth, weedsNorth, bushesNorth, tuftsNorth, north, all, materials, expansionCulled, edges, butterflyClumps };
}

export { clamp };
