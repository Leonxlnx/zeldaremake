/**
 * The turf carpet (round 39). The owner's brief: the lawn must read as a closed carpet — "I
 * shouldn't be able to see each individual blade" — at walking eye height (1.45 m) and from the
 * six fixed cameras, for fewer triangles than the blade tiles alone submit. Frames 21 / 25 / 29 s
 * of the reference: a closed mid-green turf of clumped tufts, no bare ground between the blades,
 * individual blades only at the very edge of the paving.
 *
 * Two alpha-tested instanced sets (lodset.ts), both textured from the seeded clump atlas
 * (clump-atlas.ts) and shaded by the blade tiles' colour pipeline (materials.ts, kind `card`):
 *
 *  - **clump cards**: a fan of three crossed planes (each tilted a little off vertical, two rows
 *    for the wind bend; 12 triangles, 6 at the far LOD) carrying one of six clump tiles — some
 *    200 fine blades over a dense root mass — seated on a jittered CLUMP_CELL grid wherever the
 *    blade tiles grow turf. Wind from `windGrass` with the blades' phase / stiffness encoding.
 *  - **turf mats**: flat cards hugging the ground (tilted to the terrain normal, MAT_LIFT above
 *    it) carrying one of four mat tiles — a ragged blob of short blade dabs — so the ground under
 *    and between the clumps is turf, not the terrain's soil. Static, front faces only.
 *
 * Both follow the blade tiles' zone rules (grass.ts): the paved rims keep a bare band of real
 * blades (the frames' edges), the trodden strip and the stones' walk corridor stay low, camera
 * C's grass box and D's shoulders / hollow are cut like the blades, the giant trunks' litter
 * floors and the NPC clearings thin out, the dark bank masses take the bank darkening. Neither
 * casts shadows (the blade tiles never did); both receive them. Every stream is its own fork
 * (`carpet/…`), so the blade tiles' streams stay bit for bit where they were.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Sphere, Uint16BufferAttribute, Vector3, type Material } from 'three';
import type { WorldContext } from '../system';
import { clamp, smoothstep } from '../util/noise';
import { hash2, type Rng } from '../util/prng';
import { CLUMP_GRID, MAT_GRID, createClumpAtlas, type ClumpAtlas } from './clump-atlas';
import { COVERAGE_CELL, MAT_FOOT } from './coverage';
import { rimBandCarpet, terraceCarpet, type RimCarpetResult } from './edges';
import { filterExpansionSamples, pruneExpansion } from './expansion';
import { A_FACE_HEIGHT, BANK_FLOOR_SHARE, VegField, composeMatrix, newSample } from './field';
import { LodInstancedSet } from './lodset';
import { createVegMaterial } from './materials';

/** jittered grid pitch (m) of the clump cards and of the mats */
export const CLUMP_CELL = 0.42;
/** the mats overlap (≈ 5 / m² of 0.35 m² each): one continuous turf layer, not blobs on soil */
export const MAT_CELL = 0.42;
/** clump card footprint (m): width range, height range; the atlas tile is 2 : 1 so a card keeps ≈ that aspect */
const CLUMP_WIDTH: readonly [number, number] = [0.42, 0.62];
const CLUMP_HEIGHT: readonly [number, number] = [0.19, 0.32];
/** the tallest a clump card may stand (camera C's stair-foot rule caps standing plants at 0.35 m) */
const CLUMP_MAX_H = 0.32;
/** the card root sinks this far under the turf so the atlas' root mass, not a cut edge, meets the ground */
const CLUMP_SINK = 0.03;
/** the lawn band along the paving (m) that keeps real blades only (frames: single blades at the slab edge) */
const CLUMP_RIM_CLEAR = 0.14;
const MAT_RIM_CLEAR = 0.1;
/** mat footprint (m): the disc's alpha rim sits at ≈ 0.86 of the tile, so a 1 m mat covers ≈ 0.55 m² — ≈ 5 / m² leave ≈ 5 % of the lawn uncovered */
const MAT_WIDTH: readonly [number, number] = [0.9, 1.2];
/** mats float this far above the terrain (the alpha rim hides the seam; the blades stand through it) */
const MAT_LIFT = 0.018;
/** LOD ranges (m): near clump cards (two rows, three planes) out to this, the far card beyond */
const CLUMP_LOD_NEAR = 12;
/**
 * The standing turf ends here (v11) — the blade tiles' last LOD ends at 16 m too (grass.ts) — and
 * the mats alone carry the ground beyond: a 0.5 × 0.3 m fan is ≈ 14 × 9 px at 16 m in a 1280 × 720
 * frame, and past that the fans were contrast on ground the frames render as a blur (the far
 * cells of B, C and F lost 0.0007–0.0021 each with them). ≈ 90 % of a fixed camera's in-frustum
 * fans stand past 20 m: a −20 K-triangle, −1-draw saving a frame as well.
 */
const CLUMP_MAX_DISTANCE = 16;
/**
 * cards steeper than this (slope = 1 − ny: 0.45 ≈ 57°) lose density — a fan of upright planes on
 * a 60° face reads as cards; the mats, which lie on the face like decals, hold until the cliffs
 * (0.5–0.75 ≈ 60–75°), so the stair flanks' blade turf (grass.ts FLANK_EXTRA) sits on turf too
 * (v12 faded them with the fans and lost D's flank cells: the mats there are 15–30 m off and a
 * few pixels wide; what read as decals was the bank's and the foot's mats — see MAT_BANK_CUT)
 */
const SLOPE_THIN: readonly [number, number] = [0.45, 0.7];
const MAT_SLOPE_THIN: readonly [number, number] = [0.5, 0.75];
/** bank darkening and its flattening of the blade-to-blade contrasts — the blades' constants (grass.ts) */
const BANK_DARKEN = 0.6;
const BANK_FLAT = 0.7;
/** the house flight's south flank cap (grass.ts HOUSE_FLANK_MAX_H_SOUTH) */
const HOUSE_SOUTH_MAX_H = 0.12;
/**
 * density cuts (v9 / v13, see seatClump / seatMat): the frames' bank masses and trodden foot are
 * not tufted turf. The fans thin there; the mats are gone (v13): a mat is a lit metre-wide plane
 * — 180 px across at 9 m — and the few that seated in the C-foot core (10 % of the cells) and on
 * the mound's bank face stood as single bright decals over the dark soil frames 14 / 24 s render
 * as one lit slope (B's mound crop: E's whole loss, −0.0014, in that one 16 × 9 cell; v12's
 * darkening the bank's mats 1.6 × left the foot's as the blob and cost A's and C's bank cells)
 */
const CLUMP_BANK_CUT = 0.7;
const CLUMP_FOOT_CUT = 0.8;
const MAT_FOOT_CUT = 1;
const MAT_BANK_CUT = 1;
const CLUMP_SHADE_CUT = 0.5;
/** the share of the blades' shade-zone palette bias (grass.ts: +0.35) a mat does not take */
const MAT_SHADE_BIAS_CUT = 0.175;
/**
 * Per-card variation (round 40, Astra's review of the round-39 carpet: "conspicuous repeated
 * fan-shaped clumps"). On top of the tile draw and the full-circle yaw every card takes, from
 * position hashes (no stream draw — every card keeps its round-39 seat): a 50 % mirror (the
 * shader flips the tile's u), a non-uniform scale — width CLUMP_VAR_WIDTH, height CLUMP_VAR_HEIGHT
 * — and a hue / lightness jitter carried in the instance colour (materials.ts multiplies the
 * vertex colour by it): a slide between a cooler blue-green and a warmer yellow-green of
 * CLUMP_HUE_JITTER and a lightness of 1 ± CLUMP_LIGHT_JITTER. The tint slot, the dryness and the
 * zone rules are untouched, so the lawns' palette and heights hold (carpet.test).
 */
const CLUMP_VAR_WIDTH: readonly [number, number] = [0.8, 1.25];
const CLUMP_VAR_HEIGHT: readonly [number, number] = [0.7, 1.3];
const CLUMP_HUE_JITTER = 0.07;
const CLUMP_LIGHT_JITTER = 0.09;
/** the dryness steps the card's type-slot fraction is quantised to; the mirror flag sits in the sub-step */
const CLUMP_DRY_STEPS = 16;
/** 0..1 position hash (mm-quantised seats), one stream per `salt` */
const hashAt = (x: number, z: number, salt: number) => hash2(Math.round(x * 1000), Math.round(z * 1000), salt);
/**
 * Round 44 — the north corridor's forest floor (field.ts `northFloor`, survey-1 #4): the carpet
 * reaches the plain beyond the log arch and the ground under the white-barks (field.ts `reach`),
 * but as forest floor, not lawn — the fans thin to NORTH_FLOOR_CLUMP_KEEP and the mats to
 * NORTH_FLOOR_MAT_KEEP of the lawn's (the litter and the moss beds close the rest), both in the
 * deep palette (−NORTH_FLOOR_TINT) with more straw, the fans cut to NORTH_FLOOR_HEIGHT.
 */
// 2026-09-23 (the owner, walking the corridor): the floor's cover is most of what the eye sees at
// 10–25 m off the path, and at half the fans and 30 % more straw it read as pale stubble with the
// cards' silhouettes showing between — the one ground of the walk still answering "bald". His
// recording (review46 r_022 / r_024) has a closed, damp, dark floor there. The fans and mats close
// up and the straw comes off; the deep palette, the darkening and the height cut stay.
const NORTH_FLOOR_CLUMP_KEEP = 0.78;
const NORTH_FLOOR_MAT_KEEP = 0.92;
const NORTH_FLOOR_TINT = 0.5;
const NORTH_FLOOR_DRY = 0.12;
const NORTH_FLOOR_HEIGHT = 0.8;
/**
 * Round 46 (survey-2 #06 after the first pass: the corridor's carpet ran to 25 m but the floor still
 * read as a pale-olive lawn — the cards themselves are most of what the eye sees there): the forest
 * floor's fans and mats take the bank darkening slot (materials.ts bankDark: −50 % lightness and
 * −30 % saturation at 1) at NORTH_FLOOR_DARKEN × the zone — shaded, dead-grass turf under the
 * white-barks, not the plaza's lit lawn.
 */
const NORTH_FLOOR_DARKEN = 0.45;
/**
 * Round 46 (survey-2 #06, checks 09 / 10 — poses w19-spine-l / w21-spine-f / w18-spine-r: "the
 * round-44 carpet reaches ≈ 10 m; beyond it a flat pale-olive plane with sparse tufts") — the
 * north corridor's OWN clump set. The disc's fans stop at CLUMP_MAX_DISTANCE (16 m) for the fixed
 * cameras' far cells; a walker on the north path stands 20–40 m from the plaza's cameras and sees
 * the corridor's ground to 25 m and more, so every 8 m tile wholly north of NORTH_CARPET_Z seats
 * its fans in `northClumps` — the same cards, atlas and material, running to
 * NORTH_CLUMP_MAX_DISTANCE — with the forest floor's thinning eased to NORTH_CARPET_KEEP (was
 * NORTH_FLOOR_CLUMP_KEEP), the disc falloff floored at NORTH_CARPET_REACH_FLOOR (the hollow floor
 * and the plain lie at reach 27–38 m, where the disc rule had thinned them to 0.4–0.7) and the
 * cards cut to NORTH_CARPET_HEIGHT: a dense, short carpet, not tufts on a plane. The mats on
 * those tiles take the same keep and floor. Only camera D looks north: its 25 m ring ends at
 * z ≈ −28, so it gains a 4 m band of far cards on the corridor at 21–25 m and nothing nearer;
 * the tiles south of the line seat exactly as before (their streams are untouched).
 */
const NORTH_CARPET_Z = -24;
const NORTH_CLUMP_MAX_DISTANCE = 25;
const NORTH_CARPET_KEEP = 0.9;
const NORTH_MAT_KEEP = 0.9;
const NORTH_CARPET_REACH_FLOOR = 0.8;
const NORTH_CARPET_HEIGHT = 0.85;
/** the north carpet's constants, for the audit and the tests */
export const NORTH_CARPET = { z: NORTH_CARPET_Z, maxDistance: NORTH_CLUMP_MAX_DISTANCE, keep: NORTH_CARPET_KEEP, matKeep: NORTH_MAT_KEEP, reachFloor: NORTH_CARPET_REACH_FLOOR, height: NORTH_CARPET_HEIGHT };
/**
 * Round 48 (vegetation-26): the mats of every tile wholly north of NORTH_MAT_Z seat in their own
 * set, `northMats`, ending at NORTH_MAT_MAX_DISTANCE. The disc's `mats` has no distance cut (a
 * 2-triangle quad is cheap and the lawn must never end on a line), so every mat in a fixed
 * camera's frustum is submitted however far — camera A looks north, and the round-48 turf on the
 * second clearing's banks and terrace pad (65–90 m off, behind the north rise) would have cost it
 * two triangles a mat. The gate sits at the arch's north lip: nothing south of it moves set, and
 * from the plaza cameras (z ≥ −3) every north mat is ≥ 53 m off — past the cut.
 */
export const NORTH_MAT_Z = -56;
export const NORTH_MAT_MAX_DISTANCE = 40;
/**
 * Round 47 — the mats' closing sweep (the owner's review of 2026-09-19, item 12: "patches in the
 * grass where it's not full"; coverage.ts is the audit). Once every tile has seated its grid, the
 * lawn is swept on the audit's COVERAGE_CELL grid and every cell the masks call turf that no mat's
 * footprint (MAT_FOOT × its width) reaches takes an INFILL mat — MAT_INFILL_WIDTH m, the zone's
 * palette, its own stream per tile (`carpet/infill/<tile>`) after every grid pass, so nothing
 * already seated moves. The frames' bare-by-design grounds keep their earth: camera C's foot, D's
 * shoulders, the trodden strip's dirt patches, the dark bank masses (their blades hold them), the
 * litter under the giants and the NPC clearings take no infill (the same cuts the grid's mats take
 * in full). The result: the ground under the blades is closed from the plaza to the corridor's
 * end, where before the disc's falloff (field.ts falloffReach) left the far lawns' grid at a third.
 */
export const MAT_INFILL_WIDTH: readonly [number, number] = [0.62, 0.86];
const MAT_INFILL_MAX_SLOPE = 0.62;

export interface CarpetResult {
  clumps: LodInstancedSet;
  /** round 46: the north corridor's fans (NORTH_CARPET), running to NORTH_CLUMP_MAX_DISTANCE */
  northClumps: LodInstancedSet;
  mats: LodInstancedSet;
  /** round 48: the mats of the tiles north of NORTH_MAT_Z, ending at NORTH_MAT_MAX_DISTANCE */
  northMats: LodInstancedSet;
  all: LodInstancedSet[];
  materials: Material[];
  atlas: ClumpAtlas;
  /** metres² of ground the clump cells were offered over (inside the detail disc), for the audit's density */
  lawnCellsM2: number;
  /** round 47: mats the closing sweep added where the grid left the lawn open (MAT_INFILL_WIDTH) */
  infillMats: number;
  /** round 50: legacy-seated cards / mats pruned inside the expansion's live ground, per set (expansion.ts) */
  expansionCulled: Record<string, number>;
  /** round 50 (edges.ts W06): mats / cards pruned back from the worked rims, soil mats laid */
  rim: RimCarpetResult & { terraceMats: number; terraceClumps: number };
  samples: { clumps: number[][]; mats: number[][] };
}

/**
 * Unit clump card: `planes` quads crossed about the y axis (1 wide, 1 tall, x ∈ ±0.5, y ∈ 0..1),
 * `rows` vertical segments, each plane tilted ±`tilt` rad off vertical about its base line
 * (alternating) so the fan has volume from above. uv.x across, uv.y root → tip.
 */
export function clumpCardGeometry(planes: number, rows: number, tilt: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let p = 0; p < planes; p++) {
    const yaw = (p * Math.PI) / planes;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // the plane spans its local x along (cy, 0, -sy); its facing is (sy, 0, cy); the tilt leans
    // the top along the facing
    const lean = Math.sin(tilt) * (p % 2 === 0 ? 1 : -1);
    const rise = Math.cos(tilt);
    const base = pos.length / 3;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (const side of [-0.5, 0.5]) {
        pos.push(side * cy + sy * lean * t, t * rise, -side * sy + cy * lean * t);
        uv.push(side + 0.5, t);
        nrm.push(sy * rise, -lean, cy * rise);
      }
    }
    for (let j = 0; j < rows; j++) {
      const a = base + j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setIndex(new Uint16BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), Math.hypot(0.5, 0.5) + 0.05);
  return g;
}

/** Unit turf mat: one quad in the xz plane (x, z ∈ ±0.5), facing +y, uv over the quad. */
export function turfMatGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex(new Uint16BufferAttribute([0, 2, 1, 1, 2, 3], 1));
  g.computeBoundingBox();
  g.boundingSphere = new Sphere(new Vector3(0, 0, 0), Math.hypot(0.5, 0.5) + 0.02);
  return g;
}

/** the blades' tint-slot encoding (grass.ts): integer palette index, fraction = shade lift or bank darkening */
const tintSlot = (tintIndex: number, shade: number, darken: number) => (tintIndex + (darken > 0.01 ? 0.25 - 0.25 * darken : 0.25 + 0.5 * shade)) / 4;
/**
 * A mat's palette position, 0..3 continuous (materials.ts CARD_COLOR_VERTEX blends the two
 * neighbouring entries): the blades' tint drift `tn` through the same bins the blades' integer
 * index uses (−0.28 / 0.12 / 0.48 are the bin midpoints, so a mat and the blades over it agree on
 * the entry), piecewise linear between the bin centres, so neighbouring mats never step an entry.
 */
export const matPalettePosition = (tn: number) => {
  const centres = [-0.48, -0.08, 0.3, 0.66];
  if (tn <= centres[0]) return 0;
  for (let i = 0; i < 3; i++) if (tn <= centres[i + 1]) return i + (tn - centres[i]) / (centres[i + 1] - centres[i]);
  return 3;
};

export function buildCarpet(ctx: WorldContext, field: VegField, parent: Group): CarpetResult {
  const T = ctx.terrain;
  const R = ctx.config.detailRadius;
  const q = ctx.quality;
  const atlas = createClumpAtlas(ctx.rng);
  const materials: Material[] = [];

  // the clumps take the blades' normal blend (0.55 toward the terrain up); a fan's back planes
  // flip their facing only (materials.ts CARD_NORMAL_FRAGMENT_BEGIN), half-lit under the front
  // ones; the atlas lightness runs the root mass at ≈ 0.7 × the blade colour to lit tips ≈ 1.05 ×
  // (v3's 0.65 floor left the shaded fans darker than the soil they stand on)
  const clumpMaterial = createVegMaterial(ctx, 'card', {
    name: 'veg-grass-clumps',
    card: { atlas: atlas.texture, atlasSize: atlas.size, grid: CLUMP_GRID, mode: 0, upMix: 0.55, lum: [0.6, 0.5], alphaBoost: 0.22 },
  });
  // the mats are the turf's mid tone under the clumps — not a feature: the blade colour at mid
  // height, ≈ 0.62–0.92 × it over the dabs, so a mat and the blades over it are one surface (v4's
  // 0.5 floor left the lawns ≈ 4 % brighter than the blade field they replaced on shots B / F)
  const matMaterial = createVegMaterial(ctx, 'card', {
    name: 'veg-turf-mats',
    singleSided: true,
    transmission: 0,
    card: { atlas: atlas.texture, atlasSize: atlas.size, grid: MAT_GRID, mode: 1, upMix: 1, lum: [0.47, 0.45], alphaBoost: 0.12 },
  });
  materials.push(clumpMaterial, matMaterial);

  const clumps = new LodInstancedSet({
    name: 'grass-clumps',
    variants: [[clumpCardGeometry(3, 2, 0.2), clumpCardGeometry(3, 1, 0.2)]],
    material: clumpMaterial,
    lodDistances: [CLUMP_LOD_NEAR * q.distance],
    maxDistance: CLUMP_MAX_DISTANCE * q.distance,
    castShadowLods: 0,
    receiveShadow: true,
    instanceData: { attribute: 'aData', size: 4 },
    cullPad: 0.8,
  });
  // round 46: the north corridor's fans — the same cards, running to NORTH_CLUMP_MAX_DISTANCE
  const northClumps = new LodInstancedSet({
    name: 'grass-clumps-north',
    variants: clumps.opts.variants,
    material: clumpMaterial,
    lodDistances: [CLUMP_LOD_NEAR * q.distance],
    maxDistance: NORTH_CLUMP_MAX_DISTANCE * q.distance,
    castShadowLods: 0,
    receiveShadow: true,
    instanceData: { attribute: 'aData', size: 4 },
    cullPad: 0.8,
  });
  const mats = new LodInstancedSet({
    name: 'turf-mats',
    variants: [[turfMatGeometry()]],
    material: matMaterial,
    lodDistances: [],
    castShadowLods: 0,
    receiveShadow: true,
    instanceData: { attribute: 'aData', size: 4 },
    cullPad: 0.7,
  });
  // round 48: the mats north of the arch's lip — the same quad and material, ending at NORTH_MAT_MAX_DISTANCE
  const northMats = new LodInstancedSet({
    name: 'turf-mats-north',
    variants: mats.opts.variants,
    material: matMaterial,
    lodDistances: [],
    maxDistance: NORTH_MAT_MAX_DISTANCE * q.distance,
    castShadowLods: 0,
    receiveShadow: true,
    instanceData: { attribute: 'aData', size: 4 },
    cullPad: 0.7,
  });

  const s = newSample();
  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const white: [number, number, number] = [1, 1, 1];
  const clumpSamples: number[][] = [];
  const matSamples: number[][] = [];
  let lawnCellsM2 = 0;

  /**
   * The turf rules of one ground point, shared by both sets — the blade tiles' zone logic
   * (grass.ts `blade`) without its random draws: where turf grows at all, how tall it stands,
   * and its palette. Returns null where no card belongs.
   */
  const turfAt = (x: number, z: number, rim: number) => {
    if (field.reach(x, z) > R + 1) return null;
    field.sample(x, z, s);
    if (!field.allowed(x, z, s, true)) return null;
    if (field.insideGiantTrunk(x, z)) return null;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder) return null;
    const edge = field.lawnEdgeDistance(x, z, true);
    if (edge < rim) return null;
    const low = field.lowZone(x, z);
    const trim = field.trimZone(x, z);
    const shade = field.shadeZone(x, z);
    const band = field.lawnBand(x, z);
    const trod = field.troddenZone(x, z, true);
    const bare = trod * smoothstep(0.25, 0.7, field.dry(x, z));
    const house = field.houseFlankZone(x, z);
    const houseLocal = house > 0 ? field.houseFlightLocal(x, z) : null;
    const houseNorth = houseLocal !== null && houseLocal.v < 0 ? house : 0;
    const houseSouth = houseLocal !== null && houseLocal.v > 0 ? house : 0;
    const sight = houseNorth > 0.5 ? 0 : field.sightlineC(x, z, 0.5);
    const hollow = field.dHollow(x, s.h, z);
    const foot = field.cFoot(x, z);
    const shoulder = field.dShoulder(x, z);
    const giant = field.giantProximity(x, z);
    const cluster = field.cluster(x, z);
    const bank = field.bankDark(x, z);
    const stone = field.stoneDistance(x, z);
    // round 48: the second clearing's banks and the ledge terrace's pad are lawn again (field.ts
    // clearingLawn) — the pad in full, the banks keeping BANK_FLOOR_SHARE of the floor's cut
    const lawn = field.clearingLawn(x, z);
    const nfloor = field.northFloor(x, z) * (1 - Math.max(lawn.pad, lawn.bank * (1 - BANK_FLOOR_SHARE)));
    // height factor: every cut the blades take
    let hk = (1 - 0.4 * low) * (1 - 0.2 * sight) * (1 - 0.35 * trim) * (1 - 0.62 * trod) * (1 - 0.3 * band) * (1 - 0.45 * hollow) * (1 - 0.55 * foot) * (1 - 0.35 * clr.npc) * (1 - 0.3 * giant) * (1 - 0.5 * shoulder) * (1 - (1 - NORTH_FLOOR_HEIGHT) * nfloor);
    // round 40: the blades on frame 1's circled bank face stand taller (grass.ts A_FACE_*)
    hk *= 1 + A_FACE_HEIGHT * field.aFace(x, z);
    if (edge < 0.3) hk *= 0.72;
    // palette: the blades' tint drift and zone biases
    let tn = field.tint(x, z) - 0.45 * giant + (edge < 1.5 ? 0.12 : 0) + 0.35 * shade - 0.25 * trim + 0.2 * trod + 0.7 * foot - NORTH_FLOOR_TINT * nfloor;
    if (s.slope > 0.35) tn -= 0.15 * (1 - shade) * (1 - foot);
    if (houseNorth > 0) tn -= 0.6 * houseNorth;
    const dryP = (field.dry(x, z) * (0.35 + 0.65 * s.plateau) + 0.35 * trod + 0.55 * foot + NORTH_FLOOR_DRY * nfloor) * (1 - 0.5 * shade) * (1 - BANK_FLAT * bank);
    const darken = clamp(Math.max(BANK_DARKEN * bank, NORTH_FLOOR_DARKEN * nfloor), 0, 0.96);
    return { edge, low, trim, shade, band, trod, bare, houseNorth, houseSouth, sight, hollow, foot, shoulder, giant, cluster, bank, stone, nfloor, npc: clr.npc, hk, tn, dryP, darken };
  };

  const half = Math.ceil((R + 2) / 8);
  /** `north`: the tile lies wholly north of NORTH_CARPET_Z (round 46) — the north set's rules and set */
  const seatClump = (x: number, z: number, rng: Rng, north: boolean) => {
    const t = turfAt(x, z, CLUMP_RIM_CLEAR);
    if (!t) return;
    if (t.stone < 0.22) return;
    // density: the carpet closes over the lawns; it thins where the blades thin — the trodden
    // strip's bare patches, D's shoulders, the litter floor under the giants, the NPC clearings,
    // the steep faces (the blade tiles keep those), the far disc. Two of the frames' grounds are
    // not tufted turf (v9): the dark bank masses beside the main flight (field.ts bankDark —
    // frames 8 / 46 s: flat blurs, where lit fans put structure the frame has not: F's left-middle
    // cell −0.0010, B's bottom-right −0.0006 in v8) and camera C's trodden foreground (cFoot —
    // frame 46 s' bare earth with a dusty fringe: C's bottom-left cell −0.0029 in v8, the whole
    // of C's loss, with the fans and mats 3 m before the camera). The fans also thin by half on
    // the shade embankment (frame 8's right bank, F's right-middle at 15 m: a hazy blur of window
    // σ 0.027 against our 0.033 before the carpet and 0.036 with it — the lit fans over the
    // shaded mats are the contrast the frame has not; the mats and the +60 % blades keep the bank
    // closed). Not in the low verges (v10 tried the blades' × (1 − 0.35 low)): the fans at the
    // stair foot 5 m before camera A are the frame's tufts (A's bottom-right −0.0010 without
    // them) — where they hurt is far, and that is the LOD's business (CLUMP_MAX_DISTANCE)
    const slopeK = 1 - smoothstep(SLOPE_THIN[0], SLOPE_THIN[1], s.slope);
    // round 46: the north set eases the forest floor's thinning and floors the disc falloff (NORTH_CARPET)
    const reachK = north ? Math.max(field.falloffReach(x, z), NORTH_CARPET_REACH_FLOOR) : field.falloffReach(x, z);
    const keep = north ? NORTH_CARPET_KEEP : NORTH_FLOOR_CLUMP_KEEP;
    const density = reachK * (0.82 + 0.18 * t.cluster) * (1 - 0.75 * t.giant) * (1 - 0.5 * t.npc) * (1 - 0.35 * t.trod - 0.5 * t.bare) * (1 - 0.85 * t.shoulder) * (1 - 0.3 * t.hollow) * (1 - CLUMP_FOOT_CUT * t.foot) * (1 - CLUMP_BANK_CUT * t.bank) * (1 - CLUMP_SHADE_CUT * t.shade) * (1 - (1 - keep) * t.nfloor) * slopeK * (1 - s.cliff) * q.density;
    if (rng() > density) return;
    const clusterVar = 0.85 + 0.3 * t.cluster;
    let w = (CLUMP_WIDTH[0] + (CLUMP_WIDTH[1] - CLUMP_WIDTH[0]) * rng()) * clusterVar;
    let h = (CLUMP_HEIGHT[0] + (CLUMP_HEIGHT[1] - CLUMP_HEIGHT[0]) * Math.pow(rng(), 1.3)) * clusterVar * (t.edge < 2.5 ? 1.08 : 1);
    h = Math.min(h, CLUMP_MAX_H) * t.hk * (north ? NORTH_CARPET_HEIGHT : 1);
    // the caps below, tracked for the round-40 scale jitter (applied after the seating test, so
    // every card seats exactly where round 39 seated it, then re-capped)
    let hCap = CLUMP_MAX_H * t.hk;
    if (t.houseSouth > 0) {
      h = Math.min(h, h + (HOUSE_SOUTH_MAX_H - h) * t.houseSouth);
      hCap = Math.min(hCap, hCap + (HOUSE_SOUTH_MAX_H - hCap) * t.houseSouth);
    }
    // the stones' walk corridor and the NPC spots: nothing over the herb layer
    if (t.stone < 0.5) {
      h = Math.min(h, 0.2);
      hCap = Math.min(hCap, 0.2);
    }
    if (t.npc > 0) {
      h = Math.min(h, 0.26);
      hCap = Math.min(hCap, 0.26);
    }
    // a cut card keeps its blade proportions: the width follows the height cut (softly)
    w *= 0.55 + 0.45 * Math.sqrt(h / (CLUMP_HEIGHT[1] * clusterVar));
    // the card must not overhang the paving
    w = Math.min(w, (t.edge - 0.02) * 2);
    if (w < 0.2 || h < 0.06) return;
    // round 40: the non-uniform per-card scale, inside the same caps
    h = Math.min(h * (CLUMP_VAR_HEIGHT[0] + (CLUMP_VAR_HEIGHT[1] - CLUMP_VAR_HEIGHT[0]) * hashAt(x, z, 2)), hCap);
    w = Math.min(w * (CLUMP_VAR_WIDTH[0] + (CLUMP_VAR_WIDTH[1] - CLUMP_VAR_WIDTH[0]) * hashAt(x, z, 1)), (t.edge - 0.02) * 2);
    const tint = t.tn + rng.gauss() * 0.18 * (1 - BANK_FLAT * t.bank);
    const tintIndex = tint < -0.28 ? 0 : tint < 0.12 ? 1 : tint < 0.48 ? 2 : 3;
    const dry = clamp(t.dryP * (0.3 + 0.7 * rng()), 0, 0.95);
    const tile = rng.int(0, atlas.clumpTiles);
    const yaw = rng() * Math.PI * 2;
    const y = T.height(x, z) - CLUMP_SINK * (h / CLUMP_HEIGHT[1]);
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 0.5, yaw, w, h, w);
    data[0] = rng();
    data[1] = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);
    data[2] = tintSlot(tintIndex, t.shade, t.darken);
    // type slot (round 40): the tile in the integer part, the dryness in CLUMP_DRY_STEPS steps, the
    // mirror flag in the sub-step (0.25 = as drawn, 0.75 = flipped; materials.ts CARD_COLOR_VERTEX)
    const mirror = hashAt(x, z, 3) < 0.5;
    data[3] = tile + (Math.floor(dry * CLUMP_DRY_STEPS) + (mirror ? 0.75 : 0.25)) / CLUMP_DRY_STEPS;
    // hue / lightness jitter in the instance colour: cool ↔ warm, dark ↔ light
    // (a fresh array per card: the set keeps the reference)
    const hue = hashAt(x, z, 4) * 2 - 1;
    const light = 1 + (hashAt(x, z, 5) * 2 - 1) * CLUMP_LIGHT_JITTER;
    const set = north ? northClumps : clumps;
    set.add(M, 0, [light * (1 + CLUMP_HUE_JITTER * hue), light * (1 + CLUMP_HUE_JITTER * 0.25 * Math.abs(hue)), light * (1 - CLUMP_HUE_JITTER * 1.2 * hue)], data);
    if (set.count % 61 === 0) clumpSamples.push([Math.round(x * 1000) / 1000, Math.round(y * 10000) / 10000, Math.round(z * 1000) / 1000]);
  };

  /** `farNorth` (round 48): the tile lies wholly north of NORTH_MAT_Z — its mats seat in `northMats` */
  const seatMat = (x: number, z: number, rng: Rng, north: boolean, farNorth: boolean) => {
    const t = turfAt(x, z, MAT_RIM_CLEAR);
    if (!t) return;
    if (t.stone < 0.12) return;
    // the mats close the ground everywhere the turf grows, bar the frames' bare earth: the
    // trodden strip's dirt patches, D's soil shoulders, camera C's trodden foreground, the
    // litter under the giants, the dark bank masses (none in the last two — the fans thin there,
    // the blades hold them); steep faces take smaller mats and none past the thin band
    const slopeK = 1 - smoothstep(MAT_SLOPE_THIN[0], MAT_SLOPE_THIN[1], s.slope);
    // round 46: the north tiles' mats take the north carpet's keep and falloff floor (NORTH_CARPET)
    const reachK = north ? Math.max(field.falloffReach(x, z), NORTH_CARPET_REACH_FLOOR) : field.falloffReach(x, z);
    const keep = north ? NORTH_MAT_KEEP : NORTH_FLOOR_MAT_KEEP;
    const density = reachK * (1 - 0.85 * t.giant) * (1 - 0.6 * t.npc) * (1 - 0.7 * t.bare) * (1 - 0.9 * t.shoulder) * (1 - MAT_FOOT_CUT * t.foot) * (1 - MAT_BANK_CUT * t.bank) * (1 - (1 - keep) * t.nfloor) * slopeK * (1 - s.cliff) * q.density;
    if (rng() > density) return;
    let w = (MAT_WIDTH[0] + (MAT_WIDTH[1] - MAT_WIDTH[0]) * rng()) * (1 - 0.4 * smoothstep(MAT_SLOPE_THIN[0] * 0.6, MAT_SLOPE_THIN[1], s.slope));
    // across the house flight's north-flank feather (a 0.6-entry step in the palette the blades
    // take per blade) the mats shrink toward half, so the zone edge stays an edge, not a saw of
    // metre tiles
    if (t.houseNorth > 0 && t.houseNorth < 1) w *= 1 - 0.45 * (1 - Math.abs(2 * t.houseNorth - 1));
    // never over the paving or a stepping stone
    w = Math.min(w, (t.edge - 0.02) * 2, (t.stone + 0.04) * 2);
    if (w < 0.25) return;
    // a continuous palette position at half the blades' drift — mottle and zone offsets alike —,
    // the zone's dryness without the blades' per-instance draw, little mat-to-mat noise: a
    // metre-wide filled surface next to another must not step in tone (v4's four discrete
    // entries at the full drift — ± an entry and a half within a metre, a two-entry step along
    // the house flight's north-flank feather — tiled B's terrace in blotches, where the same steps
    // between thin blades over soil read as a gentle shift); the clumps and the blades over the
    // mats carry the zones and the per-plant variation at full strength
    // the shade zone (frame 8's right embankment, seen across F's right-middle): the blades
    // there take the light olives, the flatter root tone and the extra sky fill (materials.ts
    // uShadeFill) because their sideways normals under-collect the sky they face under the
    // canopy; a mat faces the sky already, and with all three it rendered the embankment
    // lighter and flatter than the frame's dark mass (F's right-middle cell +0.008 luminance,
    // −0.0026 SSIM in v8): a mat takes half the palette bias and no lift
    placeMat(x, z, t, w, rng, farNorth);
  };
  /** every seated mat's footprint (x, z, radius), the round-47 infill sweep's index over both sets */
  const matFootprints: { x: number; z: number; r: number }[] = [];
  /** the mat itself: palette, tile, yaw and the seat (the grid's mats and the round-47 infill share it) */
  const placeMat = (x: number, z: number, t: NonNullable<ReturnType<typeof turfAt>>, w: number, rng: Rng, farNorth: boolean) => {
    const tint = 0.5 * (t.tn - MAT_SHADE_BIAS_CUT * t.shade) + rng.gauss() * 0.04 * (1 - BANK_FLAT * t.bank);
    const dry = clamp(t.dryP * 0.65, 0, 0.95) * 0.6;
    const tile = rng.int(0, atlas.matTiles);
    const yaw = rng() * Math.PI * 2;
    const y = T.height(x, z) + MAT_LIFT;
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 1, yaw, w, 1, w);
    data[0] = matPalettePosition(tint);
    data[1] = 1;
    data[2] = tintSlot(0, 0, t.darken);
    data[3] = tile + dry;
    const set = farNorth ? northMats : mats;
    set.add(M, 0, white, data);
    matFootprints.push({ x, z, r: w * MAT_FOOT });
    if (set.count % 53 === 0) matSamples.push([Math.round(x * 1000) / 1000, Math.round(y * 10000) / 10000, Math.round(z * 1000) / 1000]);
  };
  /** round 47: an infill mat where the grid left the lawn open — the grid's cuts that mean bare earth stay cuts */
  const seatInfillMat = (x: number, z: number, rng: Rng, farNorth: boolean) => {
    const t = turfAt(x, z, MAT_RIM_CLEAR);
    if (!t) return false;
    if (t.stone < 0.12 || s.slope > MAT_INFILL_MAX_SLOPE || s.cliff > 0.5) return false;
    if (t.foot > 0.5 || t.shoulder > 0.5 || t.bare > 0.5 || t.bank > 0.5 || t.giant > 0.6 || t.npc > 0.5) return false;
    let w = MAT_INFILL_WIDTH[0] + (MAT_INFILL_WIDTH[1] - MAT_INFILL_WIDTH[0]) * rng();
    if (t.houseNorth > 0 && t.houseNorth < 1) w *= 1 - 0.45 * (1 - Math.abs(2 * t.houseNorth - 1));
    w = Math.min(w, (t.edge - 0.02) * 2, (t.stone + 0.04) * 2);
    if (w < 0.25) return false;
    placeMat(x, z, t, w, rng, farNorth);
    return true;
  };

  // jittered grids per 8 m tile, each tile its own stream (the blade tiles' pattern), so a rule
  // change in one zone re-seats nothing elsewhere; the disc's tiles and (round 44) the north
  // corridor's (field.ts `reach`)
  const northHalf = Math.ceil((field.northExtent + 2) / 8);
  for (let cz = -northHalf; cz < half; cz++) {
    for (let cx = -half; cx < half; cx++) {
      const x0 = cx * 8;
      const z0 = cz * 8;
      if (field.tileReach(x0, z0, 8) > R + 1) continue;
      // round 46: a tile wholly north of NORTH_CARPET_Z seats the north carpet (its own set and rules)
      const north = z0 + 8 <= NORTH_CARPET_Z;
      // round 48: a tile wholly north of the arch's lip seats its mats in the distance-cut north set
      const farNorth = z0 + 8 <= NORTH_MAT_Z;
      const cRng = ctx.rng.fork(`carpet/clumps/${cx}/${cz}`);
      const nc = Math.round(8 / CLUMP_CELL);
      for (let j = 0; j < nc; j++) {
        for (let i = 0; i < nc; i++) {
          const x = Math.round((x0 + (i + cRng()) * CLUMP_CELL) * 1000) / 1000;
          const z = Math.round((z0 + (j + cRng()) * CLUMP_CELL) * 1000) / 1000;
          if (Math.hypot(x, z) <= R) lawnCellsM2 += CLUMP_CELL * CLUMP_CELL;
          seatClump(x, z, cRng, north);
        }
      }
      const mRng = ctx.rng.fork(`carpet/mats/${cx}/${cz}`);
      const nm = Math.round(8 / MAT_CELL);
      for (let j = 0; j < nm; j++) {
        for (let i = 0; i < nm; i++) {
          const x = Math.round((x0 + (i + mRng()) * MAT_CELL) * 1000) / 1000;
          const z = Math.round((z0 + (j + mRng()) * MAT_CELL) * 1000) / 1000;
          seatMat(x, z, mRng, north, farNorth);
        }
      }
    }
  }

  // round 47: the mats' closing sweep (MAT_INFILL_WIDTH) over the same tiles, against every mat
  // seated so far — the grid's and the sweep's own, bucketed by footprint (round 48: the
  // footprints of both mat sets, `matFootprints`, so the north tiles' sweep sees their own mats)
  let infillMats = 0;
  {
    const bucket = 0.5;
    const footprints = new Map<number, number[]>();
    const bkey = (gx: number, gz: number) => gx * 65536 + gz;
    const index = (i: number) => {
      const it = matFootprints[i];
      const r = it.r;
      for (let gz = Math.floor((it.z - r) / bucket); gz <= Math.floor((it.z + r) / bucket); gz++) {
        for (let gx = Math.floor((it.x - r) / bucket); gx <= Math.floor((it.x + r) / bucket); gx++) {
          const k = bkey(gx, gz);
          let arr = footprints.get(k);
          if (!arr) footprints.set(k, (arr = []));
          arr.push(i);
        }
      }
    };
    for (let i = 0; i < matFootprints.length; i++) index(i);
    const closed = (x: number, z: number) => {
      const arr = footprints.get(bkey(Math.floor(x / bucket), Math.floor(z / bucket)));
      if (!arr) return false;
      for (const i of arr) {
        const it = matFootprints[i];
        if ((x - it.x) ** 2 + (z - it.z) ** 2 <= it.r * it.r) return true;
      }
      return false;
    };
    const cells = Math.round(8 / COVERAGE_CELL);
    for (let cz = -northHalf; cz < half; cz++) {
      for (let cx = -half; cx < half; cx++) {
        const x0 = cx * 8;
        const z0 = cz * 8;
        if (field.tileReach(x0, z0, 8) > R + 1) continue;
        const farNorth = z0 + 8 <= NORTH_MAT_Z;
        const iRng = ctx.rng.fork(`carpet/infill/${cx}/${cz}`);
        for (let j = 0; j < cells; j++) {
          for (let i = 0; i < cells; i++) {
            const x = Math.round((x0 + (i + 0.5) * COVERAGE_CELL) * 1000) / 1000;
            const z = Math.round((z0 + (j + 0.5) * COVERAGE_CELL) * 1000) / 1000;
            if (closed(x, z)) continue;
            if (seatInfillMat(x, z, iRng, farNorth)) {
              index(matFootprints.length - 1);
              infillMats++;
            }
          }
        }
      }
    }
  }

  // Round 50 (expansion.ts): the grids and the sweep seat against the LEGACY ground; inside the
  // round-49 expansion (the south bank, the knoll, the discs, the flights) the live ground is
  // elsewhere, so the cards and mats there are pruned — after every seat and the closing sweep,
  // so nothing re-rolls and no sweep mat fills a pruned seat
  // Round 50 (edges.ts, W06): the mats and cards pulled back from the paved rims E / D / B frame
  // to a noisy line, and the soil mats laid in the cleared band — after every seat and the sweep
  // and (W05) the cards on the C bank's riser bands pruned so the material's soil shows there
  const rim = { ...rimBandCarpet(ctx, field, mats, clumps, atlas.matTiles), ...terraceCarpet(ctx, mats, clumps) };
  const expansionCulled = pruneExpansion([mats, northMats, clumps, northClumps]);
  const clumpSamplesKept = filterExpansionSamples(clumpSamples);
  const matSamplesKept = filterExpansionSamples(matSamples);

  // mats under the clumps: three draws the mats before the cards inside the shared render list
  // by material / depth order; the cards' alpha test needs no ordering
  parent.add(mats.build());
  parent.add(northMats.build());
  parent.add(clumps.build());
  parent.add(northClumps.build());

  return {
    clumps,
    northClumps,
    mats,
    northMats,
    all: [mats, northMats, clumps, northClumps],
    materials,
    atlas,
    lawnCellsM2,
    infillMats,
    expansionCulled,
    rim,
    samples: { clumps: clumpSamplesKept, mats: matSamplesKept },
  };
}
