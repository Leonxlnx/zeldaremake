/**
 * Tiled, GPU-instanced grass. One InstancedMesh per 8 m tile; each tile owns three LOD
 * geometries (4-segment curved blade / 2-segment blade / single triangle) that share the
 * per-instance attribute buffers, so `update()` swaps geometry by camera distance without
 * touching instance counts (the audit cross-checks counts against the scene graph).
 *
 * Three blade types live in the same instance stream and are shaped in the vertex shader
 * from a per-instance type id: short turf (bent, tapering), tall meadow grass (slender,
 * drooping tip) and broad sedge blades (blunt). Height, width, yaw, tilt, tint, dryness,
 * wind phase and stiffness are all per instance.
 */
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Frustum, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Sphere, Uint16BufferAttribute, Vector3, type Camera, type Material } from 'three';
import type { WorldContext } from '../system';
import { smoothstep, clamp } from '../util/noise';
import type { Rng } from '../util/prng';
import { A_FACE_HEIGHT, BANK_FLOOR_SHARE, VERGE_LEFT, VegField, composeMatrix, newSample } from './field';
import { BLADE_MIN, COVERAGE_CELL } from './coverage';
import { terraceDropsBlade, tileMeetsTerrace } from './edges';
import { compactExpansionBlades, filterExpansionSamples, tileMeetsExpansion } from './expansion';
import { perfFlags, perfRuntime } from '../../perfFlags';

export const GRASS_TYPE_NAMES = ['turf', 'meadow', 'sedge', 'seed'] as const;
/** the blade type id of the round-47 seed stalk (materials.ts GRASS_SHAPE_VERTEX: a slender stalk under a straw seed head) */
export const SEED_TYPE = 3;

export interface GrassTile {
  mesh: InstancedMesh;
  cx: number;
  cz: number;
  count: number;
  lods: BufferGeometry[];
  lod: number;
  /** submission culling (round 49): the tile's blades grouped in CULL_CELL_M ground cells, see `cullTiles` */
  cells: { sphere: Sphere; blades: number }[];
  /** cell index of every blade, in stream order */
  cellOf: Uint8Array;
  /** cell bitmask submitted by the last cull (all cells until a cull trims the tile) */
  keptMask: number;
  /** the pristine instance streams, copied the first time the tile is trimmed */
  src: { matrices: Float32Array; data: Float32Array } | null;
}

/**
 * Submission culling of the blade tiles (round 49, perf-3; lodset.ts's pattern at cell grain). A
 * tile is one InstancedMesh three culls whole by its sphere, so the tile the camera stands in, the
 * tiles beside it and the ones at the frustum's edges submitted every blade — 174 K of camera A's
 * 9.11 M triangles were blades behind or beside the camera. Each tile's blades are grouped at build
 * into CULL_CELL_M ground cells, each with the sphere holding every member blade (root box, its
 * height range, the tallest blade's reach in every direction for the rim lean, GRASS_CULL_PAD_M for
 * the wind); per cull the visible tiles that are not wholly inside the frustum test their cells
 * (conservative plane separation) and, when the kept set changed, rewrite the instance streams
 * with the kept cells' blades in their original order and draw that many. Blades of a cell outside
 * every plane can reach no pixel, so the frame is identical to the untrimmed one; what changes is
 * the triangle count. Off while the drawn share of a tile is below 1 (`?veg=…,<density>` / the
 * governor), whose prefix thinning wants the whole shuffled stream.
 */
const CULL_CELL_M = 2;
/** blades bend ≤ 0.35 × the wind strength (wind.ts windGrass); the vegetation's CULL_PAD_M, the rest slack */
const GRASS_CULL_PAD_M = 1.5;

export interface GrassResult {
  tiles: GrassTile[];
  count: number;
  typeCounts: number[];
  heightMean: number;
  heightCV: number;
  samples: number[][];
  /** round 50: legacy-placed blades dropped inside the expansion's live ground (expansion.ts) */
  expansionCulled: number;
  /** round 50 (edges.ts W05): the blades the C bank's riser bands thinned out */
  terraceCulled: number;
  tileSize: number;
  lodDistances: number[];
  /** upper-bound estimate (no frustum culling) of what the last update() left drawable */
  visible: { drawCalls: number; triangles: number; lodCounts: number[] };
  update(camPos: Vector3): void;
  /** trim the visible tiles' streams to the cells that can reach the frame (see CULL_CELL_M); skipped while the view-projection is unchanged unless `force` */
  cull(camera: Camera, force?: boolean): void;
  /**
   * After the last cull: blades submitted by the visible tiles, visible tiles trimmed, stream
   * rewrites so far, and `trimmed` — blades missing from the scene graph's tile counts over ALL
   * tiles (a hidden tile keeps its last trim): the audit's graph-backed `grassInstances` is the
   * built count less this.
   */
  culled: { blades: number; trimmedTiles: number; rewrites: number; trimmed: number };
}

/**
 * Unit blade: width 1 (x ∈ ±0.5·widthMul), height 1, `segments` rows + tip. `near` (round 40) is
 * a per-vertex flag the shader reads as "this is a near-tile geometry": the broad sedge blades
 * are halved on the near LODs (materials.ts GRASS_SHAPE_VERTEX) and keep their width on the far one.
 */
function bladeGeometry(segments: number, widthMul: number, near: 0 | 1): { position: Float32BufferAttribute; uv: Float32BufferAttribute; normal: Float32BufferAttribute; near: Float32BufferAttribute; index: Uint16BufferAttribute } {
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < segments; j++) {
    const t = j / segments;
    pos.push(-0.5 * widthMul, t, 0, 0.5 * widthMul, t, 0);
    uv.push(0, t, 1, t);
    nrm.push(0, 0, 1, 0, 0, 1);
  }
  pos.push(0, 1, 0);
  uv.push(0.5, 1);
  nrm.push(0, 0, 1);
  const tip = segments * 2;
  for (let j = 0; j < segments - 1; j++) {
    const a = j * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  idx.push((segments - 1) * 2, (segments - 1) * 2 + 1, tip);
  const nearFlags = new Float32Array(tip + 1).fill(near);
  return { position: new Float32BufferAttribute(pos, 3), uv: new Float32BufferAttribute(uv, 2), normal: new Float32BufferAttribute(nrm, 3), near: new Float32BufferAttribute(nearFlags, 1), index: new Uint16BufferAttribute(idx, 1) };
}

/**
 * Round 40 — the owner's video review ("Grass needs thinner blades, rooted clusters, varied
 * heights"): a candidate is no longer one blade at a uniform point but a root point with
 * CLUSTER_MIN..CLUSTER_MAX blades inside CLUSTER_RADIUS of it — a tuft. The tuft shares a height
 * multiplier (CLUSTER_HEIGHT, damped to 1 in the frame-matched cut zones: the trodden strip, the
 * lawn band, D's hollow and C's foreground keep their measured heights), a palette shift and a tip
 * tone (CLUSTER_TIP_*: sun-bleached, fresh or russet upper blades, materials.ts). Every blade
 * still runs the mask, density and zone tests at its own position, so the paved rims, the trodden
 * strip and the clearings cut a tuft blade by blade exactly as they cut the old scatter; the blade
 * count per pass is the same in expectation (roots = candidates / the mean tuft size).
 */
const CLUSTER_MIN = 5;
const CLUSTER_MAX = 9;
const CLUSTER_RADIUS = 0.075;
const CLUSTER_HEIGHT: readonly [number, number] = [0.6, 1.4];
const CLUSTER_MEAN = (CLUSTER_MIN + CLUSTER_MAX) / 2;
/** the tuft-level share of the blade-to-blade palette noise (sd; round 39 drew 0.22 per blade) */
const CLUSTER_TINT_SD = 0.2;
const BLADE_TINT_SD = 0.09;
/** the tip tone is packed into the type slot's fraction below the dryness step (1/16), kept off its ends */
const CLUSTER_TIP_LO = 0.02;
const CLUSTER_TIP_SPAN = 0.96;
const DRY_STEPS = 16;
/**
 * Round 40 — frame 1's circled right foreground (field.ts `aFace`: the south bank's face 3–7 m
 * before camera A): the low zone took 35 % of its blades and 40 % of their height and the sedge
 * noise peaks on its top, so it read as a few broad blades over bare cards (≈ 110 / m² against
 * the flank banks' 500). The base pass accepts A_FACE_DENSITY more of its candidates there, a
 * fifth pass at A_FACE_EXTRA of the tile density (own streams, accepted at the face weight)
 * closes the turf the way the flank passes close theirs, A_FACE_SEDGE_CUT fewer blades are the
 * broad type, and the face gets A_FACE_HEIGHT (field.ts) of its height back; the zone's real job
 * — no fronds on the face — is untouched. Frame A's vegetation budget: ≈ +2 000 blades.
 */
const A_FACE_DENSITY = 1.1;
const A_FACE_EXTRA = 1.2;
const A_FACE_SEDGE_CUT = 0.7;
/**
 * Round 40 — Astra's review of the carpet at the west ledge ("tall dark spikes amid the fans"): the
 * blade tiles' meadow stalks (0.28–0.6 m) and broad sedge (0.2–0.5 m), and the turf blades of a
 * 1.4 × tuft, stood 0.5–0.9 m over 0.19–0.32 m clump cards on the open lawns (the hide-one-set
 * probe at the eye pose: every spike was a blade-tile blade). On the lawn — the ground the cards
 * close, slope under the carpet's SLOPE_THIN (carpet.ts) — no blade of the base, band and face
 * passes stands over LAWN_SPIKE_CAP × its tuft's height factor (the cards' tallest, 0.32 m, × the
 * 0.6–1.4 × cluster draw: 0.19–0.45 m), so a tuft still rises over its neighbours but never as
 * a lone stalk. The flank and house-flank passes keep their own caps (steep ground, no cards).
 */
const LAWN_SPIKE_CAP = 0.32;
const LAWN_SLOPE: readonly [number, number] = [0.45, 0.7];

interface Cluster {
  height: number;
  tint: number;
  tip: number;
}

/**
 * `n` blade candidates over the box as `n / CLUSTER_MEAN` tufts: the root and the tuft's draws
 * come first, then each blade's polar offset (uniform over the disc), mm-quantised so the
 * audited sample position queries the terrain at exactly this point.
 */
function scatterClusters(rng: Rng, x0: number, z0: number, w: number, d: number, n: number, visit: (x: number, z: number, cluster: Cluster) => boolean) {
  const roots = Math.round(n / CLUSTER_MEAN);
  const cluster: Cluster = { height: 1, tint: 0, tip: 0.5 };
  for (let r = 0; r < roots; r++) {
    const rx = x0 + rng() * w;
    const rz = z0 + rng() * d;
    const size = rng.int(CLUSTER_MIN, CLUSTER_MAX + 1);
    cluster.height = CLUSTER_HEIGHT[0] + (CLUSTER_HEIGHT[1] - CLUSTER_HEIGHT[0]) * rng();
    cluster.tint = rng.gauss() * CLUSTER_TINT_SD;
    cluster.tip = rng();
    for (let i = 0; i < size; i++) {
      const a = rng() * Math.PI * 2;
      const rad = CLUSTER_RADIUS * Math.sqrt(rng());
      const x = Math.round((rx + Math.cos(a) * rad) * 1000) / 1000;
      const z = Math.round((rz + Math.sin(a) * rad) * 1000) / 1000;
      if (!visit(x, z, cluster)) return;
    }
  }
}

const TILE = 8;
/**
 * candidate blades per m² at full density before mask/cluster rejection — the reference figure
 * the extra passes (lawn band, flanks, house flanks) scale from, and the base pass's density up to
 * round 38
 */
const CANDIDATES_PER_M2 = 340;
/**
 * Round 39: the base pass runs at this density — ≈ 0.7 × CANDIDATES_PER_M2 — because the turf
 * carpet (carpet.ts: alpha-tested clump cards and turf mats) now closes the lawn; the blades keep
 * the paved rims (the cards clear them), the meadow stalks, the fine silhouettes and the close
 * parallax. The three extra passes keep their round-14 / 32 densities: they close the steep flank
 * faces, where the cards thin out (carpet.ts SLOPE_THIN). The floor is the rubric's W15: the
 * blade tiles are the only grass instances always in the scene graph (the cards and herbs are
 * culled per instance), so they, the weeds and the tufts must reach 400 000 on their own
 * (index.ts grassInstances, ≈ 413 K at 245 / m²).
 */
const BASE_PER_M2 = 245;
const DNORM = 1.5;
/** lawn band outside the flagstone rim whose blades lean over the slabs (concept sheet 02) */
const RIM_LEAN = 0.25;
/** root tilt toward the paving at the rim itself (≈ 24° with the 0.5 normal blend), fading to 0 across the band */
const RIM_LEAN_TILT = 0.9;
/**
 * Frame 14 s' lawn band west of the spine (field.ts `lawnBand`): a second candidate pass at this
 * share of the tile density thickens it into a closed short turf, from its own stream so the
 * tile's blades stay where they were; blades in the band are cut to ≈ 70 % height, meadow stalks
 * are kept out.
 */
// 2026-09-23: the band is the near half of the owner's LEFT verge walking north, and it read as a
// mown strip. Frame 14 s' contract is its HEIGHT (plants.test: p95 ≤ 0.27 m, p50 below the verge
// north of the boulder), not its count — so the thickening pass doubles instead, and the height
// cut stays where the frame put it.
const LAWN_BAND_EXTRA = 1.15;
const LAWN_BAND_CUT = 0.3;
/**
 * Round 14: the main flight's flank banks (field.ts `flankZone`) — the south-east lip lapping the
 * tread ends and the north-west face falling to Saria's terrace — showed the terrain's soil between
 * their blades in frames 1 s / 8 s (F flight box brown 16 % against the frame's 3.8 %). A third
 * candidate pass at this share of the tile density, from its own stream, closes the turf there;
 * the flank face is 50–60° steep, so the same blades per horizontal metre cover half the surface
 * a flat lawn's do. Its blades are broader tufts (× FLANK_WIDTH), the cluster noise's gaps are
 * lifted to FLANK_CLUSTER_FLOOR of full density (the frame's banks have no thin patches), and the
 * blades hugging the tread ends keep their height (the base pass cuts the last 0.3 m to 72 %).
 */
const FLANK_EXTRA = 1.6;
const FLANK_WIDTH = 1.6;
const FLANK_CLUSTER_FLOOR = 0.7;
/**
 * Round 14: camera D's path shoulders (field.ts `dShoulder`) — frame 56 s shows bare paving to a
 * ragged soil edge with a few tufts where our verge turf ran to the slabs. This share of the
 * shoulder's blades is dropped and the rest cut by D_SHOULDER_HEIGHT. The drop is decided by a
 * position hash AFTER the blade's last draw, so every other blade in the tile keeps its layout.
 */
// 2026-09-23 (the owner, walking north from the plaza: "make the grass thicker on the left side"):
// this shoulder is the turf the walker's feet pass through for the first twelve metres of that
// walk, and 92 % of its blades were dropped for camera D's ragged soil edge at 3–8 m. His
// recording (review46 r_022–r_028) closes the verge over the slabs instead. The cut is now a
// thinning, not a clearing, and the rest keeps three quarters of its height; the frame's dusty
// palette there (the trodden strip's dry tips) is untouched.
const D_SHOULDER_CUT = 0.3;
const D_SHOULDER_HEIGHT = 0.26;
/**
 * Round 32: the house-west flight's flanks (field.ts `houseFlankZone`; frame 56 s' right edge: a
 * mossy grass bank climbing beside the risers, tufts lapping the tread ends; frame 14 s: the same
 * bank right of the flight beside Link, which take 90 rendered as a bare olive mound). The base
 * pass cuts the turf there to ≈ 6 cm — the low verge, camera C's grass box and Saria's trodden
 * strip all overlap the flight — so a fourth candidate pass at this share of the tile density,
 * from its own streams, lays bank turf at full lawn height: broader tuft blades, the cluster
 * gaps lifted to HOUSE_FLANK_CLUSTER_FLOOR, and the north flank a shade darker (the frame's
 * bank measures 0.22 luminance against the lit lip's 0.33). Nothing on the treads, apron or
 * landing (the masks), nothing above HOUSE_FLANK_MAX_H (camera C stands 1.5 m from the foot).
 */
const HOUSE_FLANK_EXTRA = 1.5;
const HOUSE_FLANK_WIDTH = 1.5;
const HOUSE_FLANK_CLUSTER_FLOOR = 0.65;
const HOUSE_FLANK_MAX_H = 0.38;
/**
 * the south flank is camera C's left foreground at 2–4.5 m (frame 46: the stair foot over short
 * turf — cap-final read tall lit blades there, C 0.3099 → 0.3017), so it keeps the C grass-box
 * rule (`sight`) and this lower cap (cap-3 with 0.22: still 0.15–0.18 m blades 2.3 m before C,
 * C −0.0023, where control had 0.02–0.10 m); the north flank stands behind camera C
 */
const HOUSE_FLANK_MAX_H_SOUTH = 0.12;
const HOUSE_FLANK_NORTH_TINT = -0.6;
/**
 * the ground before the first riser (stair-local u below HOUSE_FOOT_ALONG m): frame 56 s' dark
 * trodden earth with a few short dusty tufts — the flank pass there keeps HOUSE_FOOT_HEIGHT of
 * its height and takes HOUSE_FOOT_DRY more straw
 */
const HOUSE_FOOT_ALONG = 0.6;
const HOUSE_FOOT_HEIGHT = 0.6;
const HOUSE_FOOT_DRY = 0.45;
/**
 * Round 32: frame 56 s' hollow (field.ts `dHollow`, the open verge where the old north steps
 * stood): a low ground cover with little edge energy — the turf there loses this share of its
 * blades (a position hash after the last draw, so the tile's other blades keep their layout) and
 * the rest is cut by D_HOLLOW_HEIGHT; no meadow stalks. Cap-1 (cut 0.4 / height 0.3) opened the
 * dark earth between the blades and the box's edge energy rose (67.7 → 84.7 at 256 × 144): the
 * cover stays closed and lies lower instead.
 */
// 2026-09-23 (owner, walking the north path: "make the grass thicker on the left side"): the
// hollow is the ground left of the path from z −16 to −26 (field.ts `dHollow` 0.85–1 there). It
// now keeps every blade, stands at 88 % height, takes the coverage fill and D_HOLLOW_THICKEN more
// candidates, with half the meadow share of the free lawn — a full turf, not the frame's cut cover.
const D_HOLLOW_CUT = 0;
const D_HOLLOW_HEIGHT = 0.12;
const D_HOLLOW_THICKEN = 0.5;
/**
 * Round 35: camera C's bottom-left foreground (field.ts `cFoot`; frame 46 s: trodden earth with
 * a fine dusty fringe, lum p50 0.43–0.52 and 0–4 % green at x 0.1–0.35, where control carried a
 * closed lit turf, green 67–85 % at p50 0.29–0.35 with 0.14–0.5 m blades at 3–8 m). The turf
 * there loses C_FOOT_THIN of its density (a position hash after the last draw, like the shoulder
 * cut, so the tile's other blades stay put), the rest is cut by C_FOOT_HEIGHT, biased to the pale
 * palette (+C_FOOT_TINT) with straw tips (+C_FOOT_DRY) and lit by the second zone fill
 * (materials.ts LIFT_ZONE_C_FOOT); no meadow stalks. The ground under the turf renders 0.32,
 * darker than the frame's earth: the first cut's 0.3 thinning opened the cover onto it and C's
 * bottom-left p50 stayed at 0.323 (frame 0.377) while its green share and edge energy came down
 * (66.9 → 49.3 %, 218 → 94) — so the cover stays closed and short, paler and dustier still, and
 * the fill does the lighting; the standing plants keep thinning (plants.ts) for the frame's bare
 * look between the stones.
 */
const C_FOOT_THIN = 0.08;
const C_FOOT_HEIGHT = 0.55;
const C_FOOT_TINT = 0.7;
const C_FOOT_DRY = 0.55;
/**
 * Round 35: the frames' dark bank masses beside the main flight (field.ts `bankDark`): the blades
 * there carry a darkening (0..1, materials.ts: × (1 − 0.5 d), 30 % desaturated) in the tint
 * slot's unused fraction, so blades outside the zones keep their encoding bit for bit. The zone
 * weight × BANK_DARKEN: the north-west flank (frames 8 / 46 measure it 0.19–0.24 against our
 * 0.30–0.32) and the plateau shelf (frame 8's right mass 0.265 against the lit strip's 0.35).
 */
const BANK_DARKEN = 0.6;
/**
 * Round 35: the same mass, flatter. Frame 8 s' left bank is one blur — local sd 0.01–0.05 in
 * 8 px windows at 256 × 144 — and SSIM's structure term there is set by our own local variance
 * (the luminance term already sits at 0.92–0.99): the darkening alone took F 0.1–0.2 × 0.5 up
 * 0.06–0.09 per cell. In the zone the blade-to-blade tint noise and the straw tips (the two
 * per-blade contrasts) are cut by BANK_FLAT × zone, so neighbouring blades share a palette entry.
 */
const BANK_FLAT = 0.7;
/**
 * Round 44: the north corridor's forest floor (field.ts `northFloor` — the plain beyond the log
 * arch and the ground under the white-barks, survey-1 #4). The blade tiles now reach it (field.ts
 * `reach`), but it is not lawn: the turf there keeps NORTH_FLOOR_KEEP of its blades (the litter
 * and moss beds close the rest, litter.ts / plants.ts), no meadow stalks, cut to
 * NORTH_FLOOR_HEIGHT, in the deep palette (−NORTH_FLOOR_TINT) with more straw.
 */
const NORTH_FLOOR_KEEP = 0.72;
/**
 * 2026-09-23 — the walked verge (field.ts `pathVerge`): a sixth candidate pass at this share of
 * the tile density over the ground within VERGE_BAND m of the walked paving, from its own stream
 * (`grass/verge/<tile>`) after every pass above, so no blade of the five moves. The owner's LEFT
 * (west) side takes VERGE_LEFT × of it. The blades keep every height rule the lawn has — the
 * spike cap included — so what changes is how closed the fringe at the slabs reads, not how tall
 * it stands. Only tiles the walked paving passes through run it (`field.tileMeetsVerge`).
 */
const VERGE_EXTRA = 1.35;
/** the same verge under the five passes above: their candidates are accepted this much more readily there */
const VERGE_THICKEN = 0.5;
/**
 * Round 47 — the coverage fill (the owner's review of 2026-09-19, item 12: "patches in the grass
 * where it's not full"; coverage.ts is the audit). After a tile's candidate passes, its ground is
 * swept on the audit's COVERAGE_CELL grid and every cell inside INFILL_REACH of the origin (the
 * ground a walker stands on or sees within a few metres) that holds fewer than BLADE_MIN roots and
 * that the masks call turf takes a tuft of INFILL_BLADES short blades at the cell — its own stream
 * (`grass/infill/<tile>`), after every other pass, so no candidate anywhere moves. The frames'
 * bare-by-design grounds (the trodden strip's dirt, C's foot, D's shoulders and hollow, the north
 * forest floor) take none: their cuts are the frames'. Past INFILL_REACH the mats close the ground
 * (carpet.ts, its own infill sweep) and the fixed cameras' far lawns keep their blade counts.
 */
const INFILL_REACH = 30;
/** an infill tuft is a rooted cluster like the passes' (CLUSTER_MIN..CLUSTER_MAX blades inside CLUSTER_RADIUS of the cell centre) */
const INFILL_BLADES = CLUSTER_MAX;
const INFILL_SPREAD = CLUSTER_RADIUS;
/**
 * Round 47 — blade-level detail inside the walk (owner review item 12: "even more high quality").
 * SEED_SHARE of the lawn's turf candidates grow as SEED_TYPE stalks — slender, SEED_HEIGHT m tall,
 * a straw seed head on the top quarter (materials.ts) — and BROAD_SHARE of the turf blades stand
 * BROAD_WIDTH × their width, both picked by a position hash after the type draw so no stream moves.
 * Neither grows on the frames' fixed grounds (the flats: the trodden strip, the lawn band, D's
 * hollow, C's foot; camera C's sightline; the north floor) nor in the flank passes.
 */
const SEED_SHARE = 0.03;
const SEED_HEIGHT: readonly [number, number] = [0.3, 0.44];
const SEED_WIDTH: readonly [number, number] = [0.011, 0.017];
const BROAD_SHARE = 0.08;
const BROAD_WIDTH = 1.7;
const NORTH_FLOOR_HEIGHT = 0.75;
const NORTH_FLOOR_TINT = 0.5;
const NORTH_FLOOR_DRY = 0.3;
/** the drawn share of a tile can fall below 1: an explicit density flag, or the governor's ladder */
const THIN_ENABLED = perfFlags().grassDensity < 1 || perfFlags().governor;

/** Fisher–Yates over the first `count` instances of the matrix (16 floats) and data (4 floats) streams */
function shuffleInstances(matrices: Float32Array, data: Float32Array, count: number, rng: Rng) {
  const m = new Float32Array(16);
  const d = new Float32Array(4);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    if (j === i) continue;
    m.set(matrices.subarray(i * 16, i * 16 + 16));
    matrices.copyWithin(i * 16, j * 16, j * 16 + 16);
    matrices.set(m, j * 16);
    d.set(data.subarray(i * 4, i * 4 + 4));
    data.copyWithin(i * 4, j * 4, j * 4 + 4);
    data.set(d, j * 4);
  }
}

/** 0..1 hash of a mm-quantised position (no rng draw) */
const hash01 = (x: number, z: number) => {
  let h = (Math.imul(Math.round(x * 1000), 374761393) + Math.imul(Math.round(z * 1000), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export async function buildGrass(ctx: WorldContext, field: VegField, material: Material, parent: Group, onProgress: (f: number) => void): Promise<GrassResult> {
  const T = ctx.terrain;
  const R = ctx.config.detailRadius;
  const q = ctx.quality;
  // the two near LODs carry the near flag (sedge halved), the far one keeps its width
  const bases = [bladeGeometry(4, 1, 1), bladeGeometry(2, 1.3, 1), bladeGeometry(1, 1.9, 0)];
  const s = newSample();
  const tiles: GrassTile[] = [];
  const typeCounts = [0, 0, 0, 0];
  let total = 0;
  let hSum = 0;
  let hSq = 0;
  const sampleEvery = 997;
  const samples: number[][] = [];
  let expansionCulled = 0;
  let terraceCulled = 0;

  // the disc's tiles, then (round 44) the north corridor's — field.ts `reach` — in the same
  // row-major order, so every disc tile keeps its index (and its `grass/<cx>/<cz>` stream)
  const half = Math.ceil((R + TILE) / TILE);
  const northHalf = Math.ceil((field.northExtent + TILE) / TILE);
  const tileCoords: [number, number][] = [];
  for (let cz = -northHalf; cz < half; cz++) {
    for (let cx = -half; cx < half; cx++) {
      // round 47: a tile is in while any of its ground is (field.ts tileReach; the centre alone
      // culled the corridor's last tiles, whose south edges hold turf inside the radius)
      if (field.tileReach(cx * TILE, cz * TILE, TILE) > R + 1.5) continue;
      tileCoords.push([cx, cz]);
    }
  }

  // capacity for the base pass plus the three extra passes (each ≤ its share of the tile's candidates)
  const maxPerTile = Math.ceil(TILE * TILE * (BASE_PER_M2 + CANDIDATES_PER_M2 * (LAWN_BAND_EXTRA + FLANK_EXTRA + HOUSE_FLANK_EXTRA + A_FACE_EXTRA + VERGE_EXTRA)) * Math.max(q.density, 0.1)) + (TILE / COVERAGE_CELL) ** 2 * INFILL_BLADES;
  const matrices = new Float32Array(maxPerTile * 16);
  const data = new Float32Array(maxPerTile * 4);

  for (let ti = 0; ti < tileCoords.length; ti++) {
    const [cx, cz] = tileCoords[ti];
    const x0 = cx * TILE;
    const z0 = cz * TILE;
    const mx = x0 + TILE / 2;
    const mz = z0 + TILE / 2;
    const rng = ctx.rng.fork(`grass/${cx}/${cz}`);
    // 2026-09-23: only the tiles the walked paving runs through pay for `pathVerge` per candidate
    const tileVerge = field.tileMeetsVerge(x0, z0, TILE);
    const candidates = Math.round(TILE * TILE * BASE_PER_M2 * field.falloffReach(mx, mz) * q.density);
    let count = 0;
    let ySum = 0;
    let yMin = Infinity;
    let yMax = -Infinity;
    let maxH = 0;
    // one candidate: mask / clearing tests, the density draw, then the blade's type, size, tint
    // and wind from `rng`. `bandPass` blades (the lawn band's second pass) are accepted at the
    // band weight and skipped elsewhere; `flankPass` blades (the stair flanks' third pass) at the
    // flank weight; `housePass` blades (the house flight's flanks, round 32) at the house-flank
    // weight and free of the cuts the low verge, camera C's grass box and the trodden strip put
    // on that ground. Every pass reads the round-32 field rules (turf slivers between two
    // pavings, the mask-side rim, the flight taken out of the trodden strip). `tuft` is the rooted
    // cluster the blade belongs to (round 40): its height multiplier, palette shift and tip tone;
    // `facePass` blades (frame 1's circled bank face, round 40) are accepted at the face weight.
    const blade = (x: number, z: number, rng: Rng, tuft: Cluster, bandPass: boolean, flankPass = false, housePass = false, facePass = false, infill = false, vergePass = false) => {
      if (field.reach(x, z) > R + 1.5) return;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s, true)) return;
      if (field.insideGiantTrunk(x, z)) return;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder) return;
      const flank = flankPass ? field.flankZone(x, z) : 0;
      if (flankPass && flank <= 0) return;
      const house = housePass ? field.houseFlankZone(x, z) : 0;
      if (housePass && house <= 0) return;
      const face = flankPass || housePass || bandPass ? 0 : field.aFace(x, z);
      if (facePass && face <= 0) return;
      // the walked verge (2026-09-23): its own pass, and a boost to the five above
      const pv = tileVerge ? field.pathVerge(x, z) : null;
      const pathVerge = pv ? pv.w * (pv.left ? VERGE_LEFT : 1) : 0;
      if (vergePass && pathVerge <= 0) return;

      const edge = field.lawnEdgeDistance(x, z, true);
      const verge = edge < 2.5 ? 1 + 0.9 * (1 - edge / 2.5) : 1;
      const low = housePass ? 0 : field.lowZone(x, z);
      const trim = field.trimZone(x, z);
      const shade = field.shadeZone(x, z);
      const band = field.lawnBand(x, z);
      // the trodden strip between Saria's stepping stones (frames 14 / 24): half the blades, a
      // few bare dirt patches (the dry noise picks them), nothing above ≈ 40 % of the lawn's height
      const trod = field.troddenZone(x, z, true);
      const bare = trod * smoothstep(0.25, 0.7, field.dry(x, z));
      // camera C's left third (frame 46): the stair foot shows over short turf, no tall blades —
      // the house flight's north flank excepted (it stands behind camera C)
      const houseZone = housePass ? house : field.houseFlankZone(x, z);
      const houseLocal = housePass || houseZone > 0 ? field.houseFlightLocal(x, z) : null;
      const houseNorth = housePass && houseLocal !== null && houseLocal.v < 0;
      // the south flank's blades of every pass stay under the south cap (cap-3: the lawn pass's
      // 0.16 m blades 2.3 m before camera C, where frame 46 s has a fine low fringe)
      const houseSouth = houseLocal !== null && houseLocal.v > 0 ? houseZone : 0;
      const sight = houseNorth ? 0 : field.sightlineC(x, z, 0.5);
      // frame 56 s' hollow (round 32): a low, thinned cover
      const hollow = field.dHollow(x, s.h, z);
      // frame 46 s' trodden foreground before camera C (round 35): short dusty turf
      const foot = field.cFoot(x, z);
      // the north corridor's forest floor (round 44): sparse, short, deep-tinted turf
      // round 48: the second clearing's banks and the ledge terrace's pad are lawn again (field.ts
      // clearingLawn) — the pad in full, the banks keeping BANK_FLOOR_SHARE of the floor's cut
      const lawn = field.clearingLawn(x, z);
      const nfloor = field.northFloor(x, z) * (1 - Math.max(lawn.pad, lawn.bank * (1 - BANK_FLOOR_SHARE)));
      // the reference's slopes are not thicker than its flats; the boost stays for banks outside
      // the low verges so the embankments still read dense
      const slopeBoost = 1 + 0.6 * smoothstep(0.15, 0.5, s.slope) * (1 - s.cliff) * (1 - low);
      const cliffCut = 1 - s.cliff * 0.4;
      const giant = field.giantProximity(x, z);
      const cluster = field.cluster(x, z);
      // the shaded bank of frame 8 is a closed turf mass in the reference: cluster gaps close there
      const clusterK = flankPass ? FLANK_CLUSTER_FLOOR + (1 - FLANK_CLUSTER_FLOOR) * cluster : housePass ? HOUSE_FLANK_CLUSTER_FLOOR + (1 - HOUSE_FLANK_CLUSTER_FLOOR) * cluster : cluster;
      // frame 1's circled right foreground (round 40): the south bank's face fills in
      const density = clusterK * verge * slopeBoost * cliffCut * (1 - 0.75 * giant) * (1 - 0.5 * clr.npc) * (1 - 0.35 * low) * (facePass ? face : 1 + A_FACE_DENSITY * face) * (1 + 0.6 * shade) * (1 - 0.35 * trod - 0.5 * bare) * (bandPass ? band : 1) * (flankPass ? flank : 1) * (housePass ? house : 1) * (1 + D_HOLLOW_THICKEN * hollow) * (vergePass ? pathVerge : 1 + VERGE_THICKEN * pathVerge);
      // round 47: an infill blade skips the density draw (it stands where the passes left a gap)
      // but never on the frames' bare-by-design grounds
      if (infill) {
        if (density <= 0 || trod > 0.5 || foot > 0.5 || nfloor > 0.5 || field.dShoulder(x, z) > 0.5 || clr.npc > 0.5) return;
      } else if (rng() * DNORM > density) return;

      // type: tall meadow blades are rare in the low verges, the tidy foreground and the lawn band
      const meadow = field.meadow(x, z);
      const sedge = field.sedge(x, z);
      const meadowP = 0.78 * meadow * (edge < 3 ? 1.15 : 1) * (1 - clr.npc) * (1 - clr.boulder) * (1 - 0.85 * low) * (1 - 0.9 * sight) * (1 - 0.7 * trim) * (1 - 0.9 * trod) * (1 - 0.85 * band) * (1 - 0.5 * hollow) * (1 - foot) * (1 - nfloor) * (housePass ? 0.3 : 1);
      const sedgeP = 0.42 * sedge * (0.6 + 0.6 * s.plateau) * (1 - clr.npc) * (1 - A_FACE_SEDGE_CUT * face);
      const tr = rng();
      let type = tr < meadowP ? 1 : tr < meadowP + sedgeP ? 2 : 0;
      // the tuft's height (round 40) is damped to 1 where a frame fixed the turf's height — the
      // trodden strip, the lawn band, D's hollow, C's foreground
      const flat = Math.max(trod, band, 0.5 * hollow, foot);
      // round 47: seed stalks (a position hash — no draw) on the free lawn only
      const freeLawn = !flankPass && !housePass && !infill && flat < 0.5 && nfloor < 0.5 && sight <= 0 && low < 0.5;
      if (type === 0 && freeLawn && hash01(x + 0.125, z + 0.375) < SEED_SHARE) type = SEED_TYPE;

      // size (reference: 0.15–0.35 m tufts, ≈ 0.5 m in the verges — see ANALYSIS §5)
      const clusterVar = 0.82 + 0.32 * cluster;
      let h: number;
      let w: number;
      if (type === 1) {
        h = (0.28 + 0.32 * rng()) * clusterVar;
        w = 0.008 + 0.008 * rng();
      } else if (type === 2) {
        h = (0.2 + 0.3 * rng()) * clusterVar;
        w = 0.024 + 0.016 * rng();
      } else if (type === SEED_TYPE) {
        // round 47: the seed stalk — the turf branch's two draws, so the stream never moves
        h = (SEED_HEIGHT[0] + (SEED_HEIGHT[1] - SEED_HEIGHT[0]) * Math.pow(rng(), 1.4)) * clusterVar;
        w = SEED_WIDTH[0] + (SEED_WIDTH[1] - SEED_WIDTH[0]) * rng();
      } else {
        h = (0.11 + 0.2 * Math.pow(rng(), 1.4)) * clusterVar * (edge < 2.5 ? 1.15 : 1);
        w = 0.012 + 0.012 * rng();
        // round 47: a few broad blades on the free lawn (a position hash — no draw)
        if (freeLawn && hash01(x + 0.375, z + 0.125) < BROAD_SHARE) w *= BROAD_WIDTH;
      }
      // the tuft's height (round 40): 0.6–1.4 × shared by its blades, damped to 1 on the flats
      const tuftK = 1 + (tuft.height - 1) * (1 - flat);
      h *= tuftK;
      // the lawn's spike cap (round 40): the excess over LAWN_SPIKE_CAP × the tuft's factor comes
      // off in full on the flat lawn, fading out across the carpet's slope band
      if (!flankPass && !housePass) {
        // (the round-47 seed stalks take the cap too — the owner's "no tall dark spikes" holds; a
        // head at the cap still stands over the turf, whose blades run 0.11–0.31 m before the tuft factor)
        const cap = LAWN_SPIKE_CAP * tuftK;
        if (h > cap) h -= (h - cap) * (1 - smoothstep(LAWN_SLOPE[0], LAWN_SLOPE[1], s.slope));
      }
      if (edge < 0.3 && !flankPass && !housePass) h *= 0.72;
      if (flankPass) w *= FLANK_WIDTH;
      const houseFoot = housePass && houseLocal !== null && houseLocal.u < HOUSE_FOOT_ALONG;
      if (housePass) {
        // bank turf at lawn height, the tread ends lapped (frame 56 s' tufts creep over them);
        // short dusty tufts on the trodden earth before the first riser
        w *= HOUSE_FLANK_WIDTH;
        h = Math.min(h * 1.25 + 0.04, houseNorth ? HOUSE_FLANK_MAX_H : HOUSE_FLANK_MAX_H_SOUTH);
        if (houseFoot) h *= HOUSE_FOOT_HEIGHT;
      }
      if (houseSouth > 0) h = Math.min(h, h + (HOUSE_FLANK_MAX_H_SOUTH - h) * houseSouth);
      h *= 1 - 0.35 * clr.npc;
      h *= 1 - 0.3 * giant;
      h *= (1 - 0.4 * low) * (1 - 0.2 * sight) * (1 - 0.35 * trim) * (1 - 0.62 * trod) * (1 - LAWN_BAND_CUT * band) * (1 - D_HOLLOW_HEIGHT * hollow) * (1 - C_FOOT_HEIGHT * foot) * (1 - (1 - NORTH_FLOOR_HEIGHT) * nfloor);
      h *= 1 + A_FACE_HEIGHT * face;
      maxH = Math.max(maxH, h);

      // colour. The shade zone (frame 8's right embankment) measures ≈ 0.30 luminance in the
      // reference with a 0.24–0.375 p10–p90 spread; under our fill light the deep tint rendered it
      // ≈ 0.21 and flat. The bank is biased toward the light olives instead (the canopy shadow
      // already supplies the "shaded"), its blades get the flatter fill-lit gradient (shade lift,
      // see materials.ts) and keep a few straw tips for the blade-to-blade texture.
      // trodden blades are dusty: lighter olive with more straw tips
      // the dark bank mass of frames 8 / 46 (round 35): darkened blades in a flat spread — the
      // blade-to-blade tint noise and the straw tips are what the frame's blur does not have
      // round 40: the palette noise is the tuft's (CLUSTER_TINT_SD) with a little blade-to-blade
      // spread on top, so a rooted cluster reads as one plant
      const bank = field.bankDark(x, z);
      let tn = field.tint(x, z) + (tuft.tint + rng.gauss() * BLADE_TINT_SD) * (1 - BANK_FLAT * bank) - 0.45 * giant + (edge < 1.5 ? 0.12 : 0) + 0.35 * shade - 0.25 * trim + 0.2 * trod + C_FOOT_TINT * foot - NORTH_FLOOR_TINT * nfloor;
      if (s.slope > 0.35) tn -= 0.15 * (1 - shade) * (1 - foot);
      // the house flight's north flank is the shaded bank of frame 56 s (0.22 luminance): deep tints
      if (houseNorth) tn += HOUSE_FLANK_NORTH_TINT;
      const tintIndex = tn < -0.28 ? 0 : tn < 0.12 ? 1 : tn < 0.48 ? 2 : 3;
      const dryP = (field.dry(x, z) * (0.35 + 0.65 * s.plateau) + 0.35 * trod + (houseFoot ? HOUSE_FOOT_DRY : 0) + C_FOOT_DRY * foot + NORTH_FLOOR_DRY * nfloor) * (type === 2 ? 0.4 : 1) * (1 - 0.5 * shade) * (1 - BANK_FLAT * bank);
      // the dark bank mass (round 35): a blade darkening in the tint slot's spare fraction
      const darken = clamp(BANK_DARKEN * bank, 0, 0.96);
      const dry = clamp(dryP * (0.3 + 0.7 * rng()), 0, 0.95);

      // wind
      const phase = rng();
      const stiffness = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);

      const y = T.height(x, z) - 0.012;
      let yaw = rng() * Math.PI * 2;
      let nx = s.nx + rng.gauss() * 0.07;
      let nz = s.nz + rng.gauss() * 0.07;
      if (edge >= 0 && edge < RIM_LEAN) {
        // Path-edge softening (concept sheet 02): the blades in the last 0.25 m before the paving
        // lean out over the slabs. The shader bends every blade along its local +z, so the rim
        // blades are yawed (± jitter, from the same draw) toward the nearest paved edge and their
        // roots tilted the same way. No extra draws: the rest of the tile keeps its layout.
        const gx = field.lawnEdgeDistance(x + 0.05, z, true) - field.lawnEdgeDistance(x - 0.05, z, true);
        const gz = field.lawnEdgeDistance(x, z + 0.05, true) - field.lawnEdgeDistance(x, z - 0.05, true);
        const gl = Math.hypot(gx, gz);
        if (gl > 1e-6) {
          const k = 1 - edge / RIM_LEAN;
          const tx = -gx / gl;
          const tz = -gz / gl;
          yaw = Math.atan2(tx, tz) + (yaw / (Math.PI * 2) - 0.5) * (1.6 - 0.9 * k);
          nx += tx * RIM_LEAN_TILT * k;
          nz += tz * RIM_LEAN_TILT * k;
        }
      }
      // D's path shoulders (round 14): every draw above is made, so this drop moves nothing else
      const shoulder = field.dShoulder(x, z);
      if (shoulder > 0) {
        if (hash01(x, z) < D_SHOULDER_CUT * shoulder) return;
        h *= 1 - D_SHOULDER_HEIGHT * shoulder;
      }
      // frame 56 s' hollow (round 32): the same kind of drop, after every draw
      if (hollow > 0 && hash01(x + 0.5, z) < D_HOLLOW_CUT * hollow) return;
      // camera C's trodden foreground (round 35): the same kind of drop, after every draw
      if (foot > 0 && hash01(x, z + 0.5) < C_FOOT_THIN * foot) return;
      // the north corridor's forest floor (round 44): the same kind of drop, after every draw
      if (nfloor > 0 && hash01(x + 0.25, z - 0.25) < (1 - NORTH_FLOOR_KEEP) * nfloor) return;
      composeMatrix(matrices, count * 16, x, y, z, nx, s.ny, nz, 0.5, yaw, w, h, h);
      const o = count * 4;
      data[o] = phase;
      data[o + 1] = stiffness;
      // tint slot: integer part = palette index, fraction 0.25..0.75 = shade lift, fraction
      // below 0.25 = bank darkening (materials.ts; the two never meet on one blade)
      data[o + 2] = (tintIndex + (darken > 0.01 ? 0.25 - 0.25 * darken : 0.25 + 0.5 * shade)) / 4;
      // type slot: integer part = blade type, fraction = dryness in DRY_STEPS steps with the tuft's
      // tip tone in the sub-step (round 40, materials.ts); the tone sits at its neutral 0.5 in the
      // flat bank masses (round 35's rule: no blade-to-blade contrasts there)
      const tip = 0.5 + (tuft.tip - 0.5) * (1 - BANK_FLAT * bank);
      data[o + 3] = type + (Math.floor(dry * DRY_STEPS) + CLUSTER_TIP_LO + CLUSTER_TIP_SPAN * tip) / DRY_STEPS;
      count++;
      typeCounts[type]++;
      hSum += h;
      hSq += h * h;
      ySum += y;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      if ((total + count) % sampleEvery === 0) samples.push([x, Math.round(y * 10000) / 10000, z]);
    };
    // the base pass: `candidates` blades as rooted tufts over the tile (round 40)
    scatterClusters(rng, x0, z0, TILE, TILE, candidates, (x, z, tuft) => {
      blade(x, z, rng, tuft, false);
      return count < maxPerTile;
    });
    // the lawn band's thickening pass over the part of the band (plus its feather) in this tile
    const band = field.lawnBandBox(0.5);
    const bx0 = Math.max(x0, band[0]);
    const bz0 = Math.max(z0, band[1]);
    const bx1 = Math.min(x0 + TILE, band[2]);
    const bz1 = Math.min(z0 + TILE, band[3]);
    if (bx1 > bx0 && bz1 > bz0) {
      const bandRng = ctx.rng.fork(`grass/lawn-band/${cx}/${cz}`);
      const n = Math.round((bx1 - bx0) * (bz1 - bz0) * CANDIDATES_PER_M2 * LAWN_BAND_EXTRA * q.density);
      scatterClusters(bandRng, bx0, bz0, bx1 - bx0, bz1 - bz0, n, (x, z, tuft) => {
        blade(x, z, bandRng, tuft, true);
        return count < maxPerTile;
      });
    }
    // the stair flanks' third pass (round 14) over the part of the flank box in this tile
    const flank = field.flankBox();
    const fx0 = Math.max(x0, flank[0]);
    const fz0 = Math.max(z0, flank[1]);
    const fx1 = Math.min(x0 + TILE, flank[2]);
    const fz1 = Math.min(z0 + TILE, flank[3]);
    if (fx1 > fx0 && fz1 > fz0) {
      const flankRng = ctx.rng.fork(`grass/flank/${cx}/${cz}`);
      const n = Math.round((fx1 - fx0) * (fz1 - fz0) * CANDIDATES_PER_M2 * FLANK_EXTRA * q.density);
      scatterClusters(flankRng, fx0, fz0, fx1 - fx0, fz1 - fz0, n, (x, z, tuft) => {
        blade(x, z, flankRng, tuft, false, true);
        return count < maxPerTile;
      });
    }
    // the house flight's flanks (round 32): a fourth pass over the part of its flank box in this tile
    const houseBox = field.houseFlankBox();
    if (houseBox) {
      const hx0 = Math.max(x0, houseBox[0]);
      const hz0 = Math.max(z0, houseBox[1]);
      const hx1 = Math.min(x0 + TILE, houseBox[2]);
      const hz1 = Math.min(z0 + TILE, houseBox[3]);
      if (hx1 > hx0 && hz1 > hz0) {
        const houseRng = ctx.rng.fork(`grass/house-flank/${cx}/${cz}`);
        const n = Math.round((hx1 - hx0) * (hz1 - hz0) * CANDIDATES_PER_M2 * HOUSE_FLANK_EXTRA * q.density);
        scatterClusters(houseRng, hx0, hz0, hx1 - hx0, hz1 - hz0, n, (x, z, tuft) => {
          blade(x, z, houseRng, tuft, false, false, true);
          return count < maxPerTile;
        });
      }
    }
    // frame 1's circled bank face (round 40): a fifth pass over the part of the face box in this tile
    const faceBox = field.aFaceBox();
    const ax0 = Math.max(x0, faceBox[0]);
    const az0 = Math.max(z0, faceBox[1]);
    const ax1 = Math.min(x0 + TILE, faceBox[2]);
    const az1 = Math.min(z0 + TILE, faceBox[3]);
    if (ax1 > ax0 && az1 > az0) {
      const faceRng = ctx.rng.fork(`grass/a-face/${cx}/${cz}`);
      const n = Math.round((ax1 - ax0) * (az1 - az0) * CANDIDATES_PER_M2 * A_FACE_EXTRA * q.density);
      scatterClusters(faceRng, ax0, az0, ax1 - ax0, az1 - az0, n, (x, z, tuft) => {
        blade(x, z, faceRng, tuft, false, false, false, true);
        return count < maxPerTile;
      });
    }
    // 2026-09-23: the walked verge's sixth pass, over the whole tile (the band is a thin strip
    // through it; `pathVerge` rejects the rest) from its own stream
    if (tileVerge) {
      const vergeRng = ctx.rng.fork(`grass/verge/${cx}/${cz}`);
      const n = Math.round(TILE * TILE * CANDIDATES_PER_M2 * VERGE_EXTRA * field.falloffReach(mx, mz) * q.density);
      scatterClusters(vergeRng, x0, z0, TILE, TILE, n, (x, z, tuft) => {
        blade(x, z, vergeRng, tuft, false, false, false, false, false, true);
        return count < maxPerTile;
      });
    }
    // round 47: the coverage fill (INFILL_*) — the tile swept on the audit grid after every pass
    if (field.reach(mx, mz) <= INFILL_REACH + TILE * 0.71) {
      const cells = Math.round(TILE / COVERAGE_CELL);
      const occupancy = new Uint16Array(cells * cells);
      for (let i = 0; i < count; i++) {
        const ix = Math.floor((matrices[i * 16 + 12] - x0) / COVERAGE_CELL);
        const iz = Math.floor((matrices[i * 16 + 14] - z0) / COVERAGE_CELL);
        if (ix >= 0 && ix < cells && iz >= 0 && iz < cells) occupancy[iz * cells + ix]++;
      }
      const infillRng = ctx.rng.fork(`grass/infill/${cx}/${cz}`);
      const tuft: Cluster = { height: 1, tint: 0, tip: 0.5 };
      for (let iz = 0; iz < cells && count < maxPerTile; iz++) {
        for (let ix = 0; ix < cells && count < maxPerTile; ix++) {
          if (occupancy[iz * cells + ix] >= BLADE_MIN) continue;
          const gx = x0 + (ix + 0.5) * COVERAGE_CELL;
          const gz = z0 + (iz + 0.5) * COVERAGE_CELL;
          if (field.reach(gx, gz) > INFILL_REACH) continue;
          const size = infillRng.int(CLUSTER_MIN, CLUSTER_MAX + 1);
          tuft.height = CLUSTER_HEIGHT[0] + (CLUSTER_HEIGHT[1] - CLUSTER_HEIGHT[0]) * infillRng();
          tuft.tint = infillRng.gauss() * CLUSTER_TINT_SD;
          tuft.tip = infillRng();
          for (let b = 0; b < size; b++) {
            const a = infillRng() * Math.PI * 2;
            const rad = INFILL_SPREAD * Math.sqrt(infillRng());
            blade(Math.round((gx + Math.cos(a) * rad) * 1000) / 1000, Math.round((gz + Math.sin(a) * rad) * 1000) / 1000, infillRng, tuft, false, false, false, false, true);
          }
        }
      }
    }
    // Round 50 (expansion.ts): the tile builds against the LEGACY ground; where the round-49
    // expansion raised or paved it (the south bank, the knoll, the stepping discs, the flights)
    // the legacy blades are buried or float, so they are compacted out of the streams here —
    // after every pass and every draw, so no other blade re-rolls, and before the cull cells
    // and the tile's sphere read the streams. Their share of the statistics is undone.
    // Likewise (edges.ts, W05) the C bank's riser bands thin their blades to TERRACE_RISER_BLADE_KEEP
    // so the terrain material's soil shows between the tuft rows on the treads.
    const meetsTerrace = tileMeetsTerrace(x0, z0, x0 + TILE, z0 + TILE);
    if (meetsTerrace || tileMeetsExpansion(x0, z0, x0 + TILE, z0 + TILE)) {
      count = compactExpansionBlades(
        matrices,
        data,
        count,
        (type, h, y, why) => {
          typeCounts[type]--;
          hSum -= h;
          hSq -= h * h;
          ySum -= y;
          if (why === 'expansion') expansionCulled++;
          else terraceCulled++;
        },
        meetsTerrace ? (bx, bz) => terraceDropsBlade(T, bx, bz) : undefined,
      );
    }
    if (count === 0) continue;

    // Performance flags (perfFlags.ts): when the drawn share of a tile may drop below 1 (`?veg=
    // <lod>,<density>` or the auto-quality governor), `update()` draws a prefix of the instance
    // stream, so the stream is shuffled here (its own rng fork; nothing above draws from it) to
    // make every prefix a uniform thinning — as built, the extra passes (lawn band, flanks) sit at
    // the end and a prefix would take them first. Never on the shipped path: the order there is
    // the one the captures were sealed with.
    if (THIN_ENABLED) shuffleInstances(matrices, data, count, ctx.rng.fork(`grass/thin/${cx}/${cz}`));

    const aData = new InstancedBufferAttribute(data.slice(0, count * 4), 4);
    const lods = bases.map((b) => {
      const g = new BufferGeometry();
      g.setAttribute('position', b.position);
      g.setAttribute('uv', b.uv);
      g.setAttribute('normal', b.normal);
      g.setAttribute('aNear', b.near);
      g.setAttribute('aData', aData);
      g.setIndex(b.index);
      // instance-independent bounds; the mesh carries the real bounding sphere
      g.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), 1.5);
      return g;
    });
    const mesh = new InstancedMesh(lods[2], material, count);
    mesh.instanceMatrix.array.set(matrices.subarray(0, count * 16));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.name = `grass-tile-${cx}-${cz}`;
    const yc = ySum / count;
    mesh.boundingSphere = new Sphere(new Vector3(mx, yc + maxH * 0.5, mz), Math.hypot(TILE * 0.71, (yMax - yMin) * 0.5 + maxH) + 0.35);
    parent.add(mesh);
    // the cull cells (CULL_CELL_M): every blade's cell from its root, each cell's sphere from its
    // members' root box and height range plus the tile's tallest blade in every direction
    const perSide = Math.ceil(TILE / CULL_CELL_M);
    const cellOf = new Uint8Array(count);
    const box = Array.from({ length: perSide * perSide }, () => ({ n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }));
    for (let i = 0; i < count; i++) {
      const bx = matrices[i * 16 + 12];
      const by = matrices[i * 16 + 13];
      const bz = matrices[i * 16 + 14];
      const ci = Math.min(perSide - 1, Math.max(0, Math.floor((bx - x0) / CULL_CELL_M)));
      const cj = Math.min(perSide - 1, Math.max(0, Math.floor((bz - z0) / CULL_CELL_M)));
      const c = ci + cj * perSide;
      cellOf[i] = c;
      const b = box[c];
      b.n++;
      b.x0 = Math.min(b.x0, bx);
      b.x1 = Math.max(b.x1, bx);
      b.y0 = Math.min(b.y0, by);
      b.y1 = Math.max(b.y1, by);
      b.z0 = Math.min(b.z0, bz);
      b.z1 = Math.max(b.z1, bz);
    }
    const cells = box.map((b) => ({
      blades: b.n,
      sphere: b.n === 0 ? new Sphere(new Vector3(mx, yc, mz), 0) : new Sphere(new Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 + maxH * 0.5, (b.z0 + b.z1) / 2), Math.hypot((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2 + maxH * 0.5, (b.z1 - b.z0) / 2) + maxH + GRASS_CULL_PAD_M),
    }));
    tiles.push({ mesh, cx, cz, count, lods, lod: 2, cells, cellOf, keptMask: (1 << cells.length) - 1, src: null });
    total += count;
    onProgress((ti + 1) / tileCoords.length);
    if (ti % 6 === 5) await new Promise<void>((r) => setTimeout(r, 0));
  }

  // keep ≤ 400 evenly spread samples (less the ones the expansion compaction dropped, round 50)
  const keptSamples = filterExpansionSamples(samples);
  samples.length = 0;
  samples.push(...keptSamples);
  while (samples.length > 400) samples.splice(Math.floor(samples.length / 2) % samples.length, 1);

  const mean = total ? hSum / total : 0;
  const variance = total ? hSq / total - mean * mean : 0;
  const cv = mean > 0 ? Math.sqrt(Math.max(0, variance)) / mean : 0;

  // Distances are measured from each tile's near edge, so the four-segment blades still
  // extend beyond 6 m. Round 39: 10 / 24 / 78 → 6 / 16 / 16 — under the carpet a blade 6 m out
  // is ≈ 2 px wide, where the four-segment bend no longer reads, and past 16 m (a blade under
  // half a pixel wide) the turf is the carpet's clump cards and mats alone (carpet.ts: one draw
  // per LOD for the whole disc): the one-triangle far tiles were 31 draws for 59 K sub-pixel
  // triangles from camera A. The one-triangle LOD is no longer reached (a tile past the second
  // range is hidden); it stays in `bases` so the tile structure, the flags and the audit rows
  // are unchanged.
  // 2026-09-22 (owner: "patches in the grass where it's not full"): at player height the lawn past
  // 16 m was the carpet's clump cards and mats alone — a walker standing on the plaza saw the far half
  // of every lawn as sparse clumps on bare turf. The mid blades now run to 26 m (the frames' lawns
  // stand 5–25 m from the fixed cameras, so this is a measured look change, not a free one).
  const lodDistances = [6 * q.distance, 26 * q.distance, 26 * q.distance];
  const trisPerLod = bases.map((b) => b.index.count / 3);
  const halfDiag = TILE * 0.71;
  const visible = { drawCalls: 0, triangles: 0, lodCounts: [0, 0, 0] };
  const update = (camPos: Vector3) => {
    visible.drawCalls = 0;
    visible.triangles = 0;
    visible.lodCounts = [0, 0, 0];
    // performance flags / auto quality (perfFlags.ts): the LOD ranges scale, and a tile draws the
    // first `density` share of its (shuffled, see build) instance stream. Both 1 as shipped.
    const perf = perfRuntime();
    const scale = perf.vegLodScale;
    const density = THIN_ENABLED ? perf.grassDensity : 1;
    const d0 = lodDistances[0] * scale;
    const d1 = lodDistances[1] * scale;
    const d2 = lodDistances[2] * scale;
    for (const t of tiles) {
      const d = Math.hypot(camPos.x - (t.cx * TILE + TILE / 2), camPos.z - (t.cz * TILE + TILE / 2)) - halfDiag;
      const lod = d < d0 ? 0 : d < d1 ? 1 : 2;
      if (lod !== t.lod) {
        t.lod = lod;
        t.mesh.geometry = t.lods[lod];
      }
      const drawn = density < 1 ? Math.round(t.count * density) : t.count;
      // the prefix thinning owns the drawn count; otherwise the submission cull below does
      if (THIN_ENABLED && t.mesh.count !== drawn) t.mesh.count = drawn;
      t.mesh.visible = d < d2 && drawn > 0;
      if (t.mesh.visible) {
        visible.drawCalls++;
        visible.triangles += drawn * trisPerLod[lod];
        visible.lodCounts[lod]++;
      }
    }
  };

  // ---- submission culling (see CULL_CELL_M) ----
  const frustum = new Frustum();
  const viewProj = new Matrix4();
  const lastViewProj = new Matrix4().makeScale(0, 0, 0);
  const culled = { blades: total, trimmedTiles: 0, rewrites: 0, trimmed: 0 };
  /** the tile sphere against the frustum: 1 wholly inside, -1 wholly outside, 0 cut */
  const classify = (s: Sphere): number => {
    let inside = true;
    for (const plane of frustum.planes) {
      const d = plane.distanceToPoint(s.center);
      if (d < -s.radius) return -1;
      if (d < s.radius) inside = false;
    }
    return inside ? 1 : 0;
  };
  /** rewrite the tile's streams with the blades of the cells in `mask` (stream order kept) and draw that many */
  const rewrite = (t: GrassTile, mask: number) => {
    const im = t.mesh;
    const aData = t.lods[0].getAttribute('aData') as InstancedBufferAttribute;
    if (!t.src) {
      // first trim: the streams are still the pristine ones
      t.src = { matrices: (im.instanceMatrix.array as Float32Array).slice(), data: (aData.array as Float32Array).slice() };
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      aData.setUsage(DynamicDrawUsage);
    }
    const mat = im.instanceMatrix.array as Float32Array;
    const dat = aData.array as Float32Array;
    const sm = t.src.matrices;
    const sd = t.src.data;
    let j = 0;
    for (let i = 0; i < t.count; i++) {
      if (!((mask >> t.cellOf[i]) & 1)) continue;
      const si = i * 16;
      const dj = j * 16;
      for (let k = 0; k < 16; k++) mat[dj + k] = sm[si + k];
      dat[j * 4] = sd[i * 4];
      dat[j * 4 + 1] = sd[i * 4 + 1];
      dat[j * 4 + 2] = sd[i * 4 + 2];
      dat[j * 4 + 3] = sd[i * 4 + 3];
      j++;
    }
    im.count = j;
    im.instanceMatrix.needsUpdate = true;
    aData.needsUpdate = true;
    t.keptMask = mask;
    culled.rewrites++;
  };
  const cull = (camera: Camera, force = false) => {
    if (THIN_ENABLED) return;
    camera.updateMatrixWorld();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!force && viewProj.equals(lastViewProj)) return;
    lastViewProj.copy(viewProj);
    frustum.setFromProjectionMatrix(viewProj);
    culled.blades = 0;
    culled.trimmedTiles = 0;
    culled.trimmed = 0;
    for (const t of tiles) {
      if (!t.mesh.visible) {
        culled.trimmed += t.count - t.mesh.count;
        continue;
      }
      const all = (1 << t.cells.length) - 1;
      // (the tile meshes carry no transform: matrixAutoUpdate off at the identity)
      const where = classify(t.mesh.boundingSphere!);
      let mask = all;
      if (where === 0) {
        mask = 0;
        for (let c = 0; c < t.cells.length; c++) if (t.cells[c].blades > 0 && frustum.intersectsSphere(t.cells[c].sphere)) mask |= 1 << c;
      } else if (where < 0) {
        // three drops the whole mesh; leave its streams as they are
        culled.blades += t.mesh.count;
        culled.trimmed += t.count - t.mesh.count;
        continue;
      }
      if (mask !== t.keptMask) rewrite(t, mask);
      if (mask !== all) culled.trimmedTiles++;
      culled.blades += t.mesh.count;
      culled.trimmed += t.count - t.mesh.count;
    }
  };

  return { tiles, count: total, typeCounts, heightMean: mean, heightCV: cv, samples, expansionCulled, terraceCulled, tileSize: TILE, lodDistances, visible, update, cull, culled };
}
