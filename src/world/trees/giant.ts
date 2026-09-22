/**
 * Giant old Kokiri trees — the massive trunks that frame the house and roof the clearing.
 * Built as unique geometry per layout entry in LOCAL space (origin = trunk centre at ground
 * level) so buttress roots can be conformed vertex-by-vertex to the real terrain through
 * `groundAt`. Trunk: gnarled cross-section (noise displacement + fluting), heavy basal flare and a
 * buried skirt; ≥ 5 buttress roots that grip the ground 3–6 m outward; ≥ 2 large near-horizontal
 * limbs (the `lantern-tree` limb follows the layout's from→to vector exactly so the structures
 * system can hang lanterns from it); a crown of diverging leaders carrying big leaf lobes at
 * 14–24 m. Botanical primitives derived from Verdant Forest by Leonxlnx.
 */
import { Box3, BufferGeometry, Color, Vector3 } from 'three';
import type { GiantTreeDef } from '../layout';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import {
  GeometryWriter,
  TAU,
  UP,
  addLeaf,
  between,
  divergingLeaderPath,
  frame,
  growthPath,
  mergeParts,
  sample,
  stiffnessFor,
  tangent,
  taper,
  tube as sweep,
  type LeafOptions,
} from './writer';
import type { Palette } from './whitebark';
import { CARD_UV0 } from './leaf-cluster-texture';
import { LEAF_FLAT_MAP_LUM } from './materials';
import { buttressRoot, consumeTubeDraws, kneeBump, kneeStub, reliefBole, reliefBoleSteps, sweepAxisAt, type BoleKnee, type TubeDraws } from './bole';
import { basePlants, basePlantsSteps, type BasePlantResult } from './base-plants';
import { NEAR_CANOPY_FLAT_SWAP_M, createNearCanopyKit, runSteps, swapRadiiFor, type HeroDistanceFn, type NearCanopyPart, type NearLimbRecord, type NearLobeRecord } from './nearCanopy';

/**
 * Near-bole LOD (round 39, the owner's walk-down note: "the bottom of the trees need to be super
 * highly detailed"). Every giant and column builds, besides its plain sweep, a NEAR BASE: the
 * bole's lower NEAR_BASE_CUT_Y metres as a relief bole (bole.ts — cords and furrows, furrow
 * grime and occlusion, moss sheets on the shaded foot), buttress fins with toes along the plain
 * roots' own centrelines, and a ring of ferns, broad-leaf tufts and leaf litter at the foot
 * (base-plants.ts). The trees system draws it only while the live camera is within
 * NEAR_BASE_IN_M of the bole (out again past NEAR_BASE_OUT_M — hysteresis, so it never pops while
 * one stands still), and the tree shader collapses the plain sweep's lower rings and roots
 * (written with aRoot.w = −1, writer.ts woodCollapsible) for exactly that tree meanwhile, so the
 * six fixed hero cameras keep the far look the frames were matched against: at 10 m no fixed
 * camera stands within NEAR_BASE_IN_M of a bole it frames (A: stair-bank-giant 10.2 m off-frame;
 * D: north-west-near 11.6 m at its left edge; C: north-west-near 9.8 m behind it) — except the
 * emergent column at 5.4 / 5.9 m from C / D, whose shade floor is calibrated to D's and B's
 * frames (materials.ts NEAR_BOLE_FLOOR) and whose relief alone cost D −0.004 in round 17: it
 * has its own band (NEAR_BASE_RADIUS_OVERRIDE), in at 5 m, so D and C never see it swapped and
 * a walker on the path beside it still does.
 */
export const NEAR_BASE_CUT_Y = 5;
export const NEAR_BASE_IN_M = 10;
export const NEAR_BASE_OUT_M = 13;
/**
 * per-bole [in, out] bands (m) where the default would put a fixed camera inside, or — round 44,
 * survey #1 / #4: the north-east giant read as a smooth orange cylinder with a lime root skirt
 * from 11.8 m (w17-spine-r), the plateau-oak the same from the plateau walk — where every fixed
 * camera stands far enough that the band can be WIDER than the default (the nearest hero camera,
 * in the frame or not, stays ≥ 2 m outside the out-radius, so no fixed frame and no shadow it
 * measures ever sees the swap); key = NearBole id
 */
export const NEAR_BASE_RADIUS_OVERRIDE: Record<string, [number, number]> = {
  'seat-7': [5, 7],
  // giants (nearest fixed camera, m): north-east 31.9, far-plateau 36.3, north-west 29.6, east 26.8
  'north-east': [18, 22],
  'far-plateau': [18, 22],
  'north-west': [18, 22],
  'east-giant': [18, 22],
  // plateau-oak 21.3 (C, off-frame), southwest 21.6, south-centre 19.0, south 17.7 (A, off-frame)
  'plateau-oak': [16, 19],
  'southwest-giant': [16, 19],
  'south-centre': [15, 17],
  'south-giant': [14, 15.5],
  // the hollow's and the plateau's column seats (index.ts COLUMN_SEATS): nearest camera 18–28 m
  'seat-0': [14, 16],
  'seat-1': [18, 22],
  'seat-2': [18, 22],
  'seat-3': [16, 18],
  'seat-4': [16, 18.5],
  'seat-5': [18, 21],
  'seat-6': [12, 13.5],
};
/**
 * Round 51 (fable-4 for the paused lod-1 lane; fable-6's brief §7 step 4, docs/PERF_2026-09-19.md):
 * the LARGE tier's bands where the 25 / 28 m default is more than a fixed camera allows but the
 * round-44 band above is less than the rule gives — the same rule: the nearest fixed camera's
 * ground distance to the base stays ≥ 2 m outside the out-radius, 3 m of hysteresis, never narrower
 * than the small tier's band. Read by index.ts nearBand ahead of NEAR_BASE_RADIUS_OVERRIDE when
 * the large tier runs; the small tier keeps every band as shipped. Nearest camera (m):
 * north-west C 29.6 · north-east C 31.9 · far-plateau C 36.3 · east-giant A 26.8 · seat-1 C 25.5 ·
 * seat-2 C 28.0 · seat-5 A 23.9. The boles a camera stands within 20 m of keep their bands (the hero
 * table in index.ts and the round-44 entries); swap-8 (C 33.7) and seat-8 (A 49.5) take the default.
 */
export const NEAR_BASE_RADIUS_OVERRIDE_LARGE: Record<string, [number, number]> = {
  'north-west': [24.5, 27.5],
  'north-east': [25, 28],
  'far-plateau': [25, 28],
  'east-giant': [21.5, 24.5],
  'seat-1': [20.5, 23.5],
  'seat-2': [23, 26],
  'seat-5': [18.5, 21.5],
};
/** relief amplitude (m) of the near base at bole radius ρ: 5 cm at r 1.1, 10 cm at r 2.2 (concept 05) */
export const nearBaseAmplitude = (refRadius: number) => Math.max(0.035, Math.min(0.12, 0.05 * refRadius));
/** cord pitch (m around the bole) of the near bases' relief: concept 05's fissures every 25–35 cm */
export const NEAR_BASE_PITCH = 0.3;

/**
 * Giants whose base stands within this many metres of a hero camera get the near-bole bark
 * (bole.ts): fine tessellation, deep cord/furrow relief, furrow moss and grime, buttress fins with
 * toes. The far giants keep the plain sweep.
 *
 * SWITCHED OFF for the hero views (round 17 integration, NEAR_BOLE_M 25 -> 0 and no profile asks
 * for it): measured on same-tree pairs, the frames show every near bole as a hazed, near-smooth,
 * evenly shaded column at 9-19 m, and the near-bole bark cost SSIM structure in every view -
 * A -0.0015 / B -0.0034 / C -0.0048 / D -0.0041 / F -0.0054 at full relief, C -0.0028 / F -0.0030
 * still at a quarter of it, and the same C/F cost at ZERO amplitude (the furrow moss / grime tint
 * and the changed shading, not the geometry). The plain sweep is the frame-true bole at hero
 * distance. bole.ts stays as the close-range bark for a later camera-distance LOD (the walkable
 * build passes these boles at 2-5 m): re-enable per giant with GiantProfile.relief > 0.
 */
export const NEAR_BOLE_M = 0;
/** global scale on the near boles' relief amplitude and shading depth (1 = bole.ts nominal) */
export const NEAR_BOLE_RELIEF = 1;
/** buttress fins with toes (bole.ts) instead of the plain root tubes on the near boles */
export const NEAR_BOLE_ROOTS = true;

// Near-canopy LOD (round 41): see nearCanopy.ts (NEAR_CANOPY_IN_M and the shared builders).

/**
 * Round 45 (item 4): how far out a canopy lobe's fine wood runs, as a share of the lobe's hR —
 * the secondaries off the stem bough and the twigs off them (the third of every four twigs is
 * a short inner one, 0.16–0.36). These are the round-44 values: the leaf sprays hang on the
 * twigs, so shortening the wood to 0.55–0.85 / 0.5–0.85 (the twigs inside the ellipsoid) moved
 * every lobe's laminae with it — A −0.0069 SSIM for the pale-tip fix (trees-28 dist-7). The rim
 * fix that stands is the tint below; the reach is left where the frames were matched.
 */
export const LOBE_SECONDARY_REACH: [number, number] = [0.58, 0.95];
export const LOBE_TWIG_REACH: [number, number] = [0.57, 1.04];
/** how far the fine wood's outer part is tinted from the bark toward the deep leaf tone (0 = bark throughout) */
export const LOBE_TWIG_TINT = 0.7;

export interface GiantAsset {
  /** wood + leaves merged, local space (leaf vertices flagged in aRoot.w) */
  geometry: BufferGeometry;
  /**
   * the laminae of the authored canopy-bough lobes (CanopyBough.lobes) alone, local space, same
   * attributes and material as `geometry` (leaf vertices flagged in aRoot.w) — empty for a tree
   * without authored boughs. Kept apart so the caller can draw them without a shadow pass: an
   * eye-detail curtain is 5× the laminae of a roof lobe at 8 triangles each, and a giant's merged
   * mesh is submitted to the sun's depth pass from every camera (round 31: 51 k such laminae cost
   * 0.42 M triangles twice per view).
   */
  authoredLeaves: BufferGeometry;
  /** leaf-cluster alpha cards filling the lobe interiors (separate material) */
  cards: BufferGeometry;
  /**
   * the cards of the authored `flat` lobes (CanopyLobe.flat), local space, same material as
   * `cards` — empty for a tree without any. A flat lobe is the deep-shade underside of a canopy
   * whose shadow is the crown's above it, so the caller draws these without a shadow pass: a
   * full-size card sheet 3–4 m over the stair bank would otherwise lay its own band across the
   * stairs and bank that shots A / E / F measure.
   */
  authoredCards: BufferGeometry;
  /**
   * Round 50 (trees-32): the DETACHED boughs (GiantOptions.detachedBoughs) — wood, laminae and
   * cards each in a geometry of their own, local space, same attributes and materials as
   * `geometry` / `cards`; null for a tree without any. Built last from their own stream after the
   * near canopy, registered nowhere else (no near-canopy record, no limb / bare-height / lobe
   * audit), so `geometry`, `authoredLeaves`, `cards` and every audit number are byte-for-byte the
   * tree without them; the caller draws them in meshes it shows and hides on its own rule (the
   * spreading giant's low bough over the south-west bank: in no fixed frame, shown from the pans).
   */
  detached: {
    wood: BufferGeometry;
    leaves: BufferGeometry;
    cards: BufferGeometry;
    woodTriangles: number;
    leafCount: number;
    leafTriangles: number;
    cardCount: number;
    /** the lobes as authored (local centres) with the laminae each got */
    lobes: { center: Vector3; hR: number; vR: number; leaves: number }[];
    dress: GiantAsset['boughDress'];
  } | null;
  /** cards in `cards` */
  cardCount: number;
  /** cards in `authoredCards` */
  authoredCardCount: number;
  /** all laminae, the authored lobes' included */
  leafCount: number;
  /** of `leafCount`, the laminae in `authoredLeaves` */
  authoredLeafCount: number;
  /** laminae per authored canopy-bough lobe, in build order (every CanopyBough's lobes, casting or not) */
  lobeLeafCounts: number[];
  woodTriangles: number;
  leafTriangles: number;
  /** big limbs built (wild + authored), the ghosted wild limbs excluded */
  limbs: number;
  /** the un-authored big limbs in build order: azimuth (0° = +x, 90° = +z) and whether ghosted */
  wildLimbs: { azimuthDeg: number; ghost: boolean }[];
  roots: number;
  /** local-space ground contact points (trunk origin + root tips), y exactly on the terrain */
  contacts: Vector3[];
  /** the authored limb centreline in local space (lantern tree only): the sweep's ring centres */
  limbPath?: Vector3[];
  /**
   * per `limbPath` ring: its nominal (pre-wiggle) advance along the authored `from → to` axis in
   * units of |to − from| — 0 at `from`, 1 at `to`, negative over the reach back to the trunk
   * axis, > 1 over the short tail beyond `to` — and its radius before the bark relief
   */
  limbS?: number[];
  limbRadii?: number[];
  crownRadius: number;
  /** the bole's ring centres in local space, skirt → fork, as swept (any authored lean applied) */
  trunkPath: Vector3[];
  /** one nominal radius per `trunkPath` ring, before the bark relief (root flare included) */
  trunkRadii: number[];
  /** local height where the lowest limb leaves the bole (the crown begins here; ≤ the fork) */
  bareHeight: number;
  /** the near-bole bark as built (bole.ts), or null when the tree keeps the plain sweep */
  bark: {
    /** relief amplitude (m): crests +0.35 A, furrows −0.65 A */
    relief: number;
    rings: number;
    sides: number;
    /** share of the bole vertices in the moss band whose furrow moss is > 0.5 */
    mossShare: number;
    /** buttress toes over all roots */
    rootToes: number;
    /** wood triangles spent on the relief bole and the buttress roots */
    triangles: number;
  } | null;
  /**
   * the near base (see NEAR_BASE_CUT_Y): relief bole to the cut ring, buttress fins with toes,
   * the plant ring — local space, same attributes and material family as `geometry` (leaf
   * vertices flagged), drawn by the caller only within NEAR_BASE_IN_M of the camera. The first
   * build (the measurement); `nearBaseBuild` builds exactly the same geometry again, chunked
   * (yields between the bole, every fin and the plants), for the caller's LOD pool (lodPool.ts).
   */
  nearBase: BufferGeometry | null;
  nearBaseBuild: (() => Generator<void, BufferGeometry>) | null;
  nearBaseAudit: {
    /** relief amplitude (m) */
    relief: number;
    rings: number;
    sides: number;
    /** local height of the ring the near base ends on (the far bole continues from it) */
    cutY: number;
    mossShare: number;
    /** buttress fins (one per plain root) and the big flares among them */
    fins: number;
    bigFins: number;
    toes: number;
    /** round 44: 3-D moss cushions on the bole and the fins (bole.ts mossCushion) */
    cushions: number;
    woodTriangles: number;
    plants: BasePlantResult;
    triangles: number;
  } | null;
  /**
   * the plain sweep's bole surface below 8 m as built — one ring of local-space points per trunk
   * ring (gnarl and fluting included), for anything that has to meet the bole exactly (the
   * root-kit adapter, rootkit.ts, measures its collar against these)
   */
  boleRings: Vector3[][];
  /** the dressed canopy boughs (CanopyBough.dress) as built, in bough order */
  boughDress: { giant: string; relief: number; rings: number; sides: number; knees: number; triangles: number }[];
  /** round 40: leaf-cluster cards dressing the outline of the flat lobes' cores (giant.ts lobeCore) */
  coreRimCards: number;
  /** round 41: the near-canopy parts (see NEAR_CANOPY_IN_M), empty without GiantOptions.nearCanopy */
  nearCanopy: NearCanopyPart[];
  /** swap groups this tree's lobes took (0 … nearCanopyGroups − 1) */
  nearCanopyGroups: number;
  /** eligible parts a hero camera framed so close that they keep their far foliage at every distance (NEAR_CANOPY_MIN_IN_M) */
  nearCanopyHeroKept: number;
  /** parts built with swap radii cut under a framing hero camera's distance (NEAR_CANOPY_HERO_MARGIN) */
  nearCanopyHeroLimited: number;
}

/**
 * An authored near-horizontal limb leaving the trunk at `height` (local metres) toward a world
 * azimuth, rising `rise` metres per metre of run before sagging at the tip. Carries three leaf
 * lobes along its outer half (scaled by `foliage`; 0 = a bare limb).
 */
export interface SpreadLimb {
  /** world azimuth in degrees (0 = +x east, 90 = +z south) */
  azimuthDeg: number;
  height: number;
  length: number;
  rise: number;
  radius?: number;
  /** lobe size scale (0 = a bare limb) */
  foliage?: number;
  /** leaf + card population scale of the lobes (> 1 = dense dark masses) */
  density?: number;
  /** how far the lobes ride above the limb (1 = the wild-limb 1.2–1.8 m; 0 = wrapped around it) */
  lift?: number;
  /** local y below which none of the limb's foliage is written (walk clearance; see CanopyLobe.floor) */
  floor?: number;
}

/**
 * Per-tree shape overrides for giants a hero camera sees from a few metres, where the generic
 * heavy flare / 4–7 m root spread / random limbs do not match the reference silhouette. Flare,
 * girth and root scaling draw no extra random numbers, so a profiled tree keeps the limbs and crown
 * (and therefore the canopy shadows) it had without the profile.
 */
export interface GiantProfile {
  /** basal flare multiplier (1 = the default heavy flare) */
  flare?: number;
  /** trunk girth multiplier below the fork (1 = the layout radius) */
  girth?: number;
  /** buttress root reach beyond the trunk (1 = 3–6 m) */
  rootReach?: number;
  /** buttress root thickness (1 = default) */
  rootGirth?: number;
  /** number of un-authored big limbs (default: 2–4 at random) */
  wildLimbs?: number;
  /** authored spreading limbs, built last from their own random stream */
  spread?: SpreadLimb[];
  /**
   * per-channel multiplier on the bark vertex colour (default 1,1,1). A trunk standing in
   * another giant's crown shadow only ever shows its ambient-lit bark (stock albedo ≈ 0.055
   * linear, a black cut-out); > 1 lifts it towards the hazy grey-brown column the reference shows.
   * `barkTintFade` [from, to] (local metres) blends the tint back to 1 with height, so wood that
   * does reach the sun keeps the stock bark.
   */
  barkTint?: [number, number, number];
  barkTintFade?: [number, number];
  /**
   * Authored trunk lean (default: 1–3° in a random or plaza-biased direction). The grown bole is
   * sheared toward `azimuthDeg` (0 = +x east, 90 = +z south) by tan(degrees) × height above its
   * base, on top of the random lean, whose draws are still made so the rest of the tree is
   * unchanged. Used to carry a bole out of the sun ray through a hero character (a bole cannot be
   * carved like foliage). With `fromY` (local metres) the bole stands straight below that height
   * and bends into the lean over ±`blend` metres (a C1 ramp, default a sharp start), so the part a
   * hero camera frames can stay where the layout put it.
   */
  lean?: { azimuthDeg: number; degrees: number; fromY?: number; blend?: number };
  /**
   * Authored base azimuth (degrees) of the un-authored big limbs, which are spread evenly from it
   * (default: random, or the authored limb's direction). The random draw is still made.
   */
  wildLimbAzimuthDeg?: number;
  /** trunk-parameter range the un-authored big limbs leave from (default [0.36, 0.62] ≈ 0.36–0.62 of the fork height) */
  wildLimbT?: [number, number];
  /**
   * Build the un-authored big limbs' draws but none of their geometry (wood, laminae, cards): the
   * limbs are gone while the crown, boughs and leaves built after them are exactly the same tree's
   * (`wildLimbs: 0` would re-roll them). For a giant whose low limbs stand in a hero frame's air
   * or on the sun lines through it (trees index.ts, round 33). `true` ghosts every wild limb; the
   * sector form ghosts the limbs whose azimuth (0° = +x, 90° = +z) is within `halfWidthDeg` of
   * `azimuthDeg`, nearest first. Either way the giant keeps at least two big limbs (W09), the
   * authored limb, `spread` limbs and canopy boughs counted — a giant with none of those keeps two
   * wild limbs whatever the spec says (see GiantAsset.wildLimbs in the audit).
   */
  wildLimbGhost?: boolean | { azimuthDeg: number; halfWidthDeg: number };
  /**
   * near-bole bark (bole.ts) regardless of the hero cameras: the relief amplitude scale (1 = the
   * default for the bole's radius), or 0 for the plain sweep. Unset = by `GiantOptions.heroDistance`.
   */
  relief?: number;
}

/**
 * An authored lobe hung on a canopy bough (local space): `t` is where its stem leaves the bough,
 * `center` the lobe centre, hR / vR its radii. `density` scales the leaf + card population,
 * `tone` multiplies the leaf colours (< 1 = a shaded mass), `eye` overrides the eye-detail
 * treatment (0 = roof: full-size cards spread through the lobe; 1 = leaf-sized laminae), `shade`
 * is the share of the leaf shaders' shade fill (sky transmission, ambient fill, the flat shade
 * floor, the sun's transmission through the lamina — writer.ts aRoot.w) its leaves keep: 1 =
 * ordinary leaves, lower = a dark clump against the haze (the Lambert sun on the leaf's face is
 * untouched). `corridors: false` keeps every leaf and card of the lobe
 * whatever corridor crosses it (a lobe authored onto a camera's ray, which the sun and view
 * corridors along that ray would otherwise thin to their porosity). `compact` builds a small
 * clump the size it is authored: the cluster cards are capped at 0.6 hR (the ordinary floor is a
 * 0.4 m half-size, a 1.6 m card on a 0.4 m lobe), the twigs' drop and the sprigs' reach shrink
 * with hR, and the stem carries no leaves of its own — an ordinary lobe spreads to hR + 1.4 m.
 */
export interface CanopyLobe {
  t: number;
  center: Vector3;
  hR: number;
  vR: number;
  density?: number;
  tone?: number;
  eye?: number;
  shade?: number;
  corridors?: boolean;
  compact?: boolean;
  /**
   * Local y below which none of the lobe's foliage is written — laminae and cards are culled
   * (draws kept), its twigs level off 0.35 m above it (round 45: a lobe over walkable ground
   * keeps its leaves 2.4 m over the walker's eye however far its twigs would droop). The near
   * version (nearCanopy.ts) honours it too.
   */
  floor?: number;
  /**
   * false: the lobe's laminae go to GiantAsset.authoredLeaves, which the caller draws without a
   * shadow pass (its cards and stem still cast). For lobes that exist to stand on a camera ray,
   * not to shade anything — a shade lobe over a sun pool keeps the default (true).
   */
  castShadow?: boolean;
  /**
   * A deep-shade canopy underside (round 38, the bank canopy over F / C): every leaf and card of
   * the lobe is written "flat" (writer.ts leafFlat — the shaders drop the sun from it and level
   * what is left by uFlatLift, materials.ts LEAF_FLAT_*), every leaf and card of it carries ONE
   * colour (no sun-side lerp, no per-card jitter, no interior gradient, no per-spray vigour: the
   * frame's mass has window sd 0.01 and a 25 % step between overlapping cards read as 0.02 — the
   * round-38 v4 capture lost 0.29 on one cell for that alone), and the cards go to
   * GiantAsset.authoredCards, drawn without a shadow pass.
   * Author with `eye: 0` so the cards are full-size and spread through the lobe (the mass has to
   * be opaque; eye-detail laminae are for edges the camera is within a few metres of) — and with
   * a `core`, without which no card population closes evenly enough (below).
   */
  flat?: boolean;
  /**
   * Opaque smooth core of a flat lobe: the fraction of hR / vR filled by one closed ellipsoid
   * (0.85 = the cards are a leaf fringe around it). Cards alone never close: the cluster map's
   * holes and edges between them read as window sd 0.02–0.05 through nine layers (round 38 v5
   * capture: C's mass cells at sd 0.02 against the frame's 0.01 lost 0.1–0.24 each while their
   * means landed within 0.03 of the frame — SSIM's structure term, (2 cov + C2) / (va + vb + C2),
   * C2 = 9e-4, halves between sd 0.01 and 0.03). The core is written to the same flat writer as
   * the lobe's laminae (one colour, no sun, levelled by uFlatLift), so the body is EVEN — sd 0 but
   * for the haze across its depth — and only the fringe carries leaf silhouettes.
   */
  core?: number;
  /** Selected bank foliage: recess its core and reuse a bounded, persistent near part. */
  layeredCore?: { leaves: number; twigs: number };
}

/**
 * A heavy authored bough built LAST from its own random stream (so adding one never re-rolls the
 * trunk, limbs or crown): leaves the trunk at `fromHeight`, droops to `to`, and carries `lobes`
 * whose centres are authored absolutely — shade lobes riding above the wood, pendulous leaf
 * curtains hanging beneath it (the reference's low, dark foliage a few metres from the cameras).
 */
export interface CanopyBough {
  to: Vector3;
  fromHeight: number;
  radius: number;
  tipRadius?: number;
  lobes: CanopyLobe[];
  /**
   * the bough's own wood is drawn but not built (scratch writer, like a ghosted part): its lobes,
   * their stems and every draw stay, so a bough whose 0.3–0.6 m wood laid a shadow band across a
   * frame's lit paving keeps its authored foliage where it was, with the band gone
   */
  ghostWood?: boolean;
  /**
   * Dressed wood (round 40, the owner's markup: "the smooth diagonal trunk above Saria's house"):
   * the bough is swept as a relief bole (bole.ts — cords following the taper, furrow occlusion,
   * lichen plates on the crests) instead of the plain tube, wears a moss sheet along its upper
   * side with a ragged edge, and carries `knees`: one-sided swellings with broken stub limbs at
   * `s` (0 = the trunk, 1 = the tip) leaving toward `side` (±1 = the run's left / right) and
   * upward by `up`. Same draws as the plain sweep (consumeTubeDraws), the stubs from their own
   * stream, so the lobes and everything after them are unchanged.
   */
  dress?: {
    /** relief amplitude scale (1 = the default for the bough's radius) */
    relief?: number;
    /** upper-side moss strength 0–1 */
    moss?: number;
    /** lichen strength 0–1 */
    lichen?: number;
    knees?: { s: number; side: number; up: number; reach: number; halfWidth: number; stubLength: number; stubRadius: number; stubPitch: number }[];
  };
}

export interface GiantOptions {
  /** local ground height under local (x, z); 0 at the origin */
  groundAt: (x: number, z: number) => number;
  /**
   * authored limb (local from → to) for the lantern tree. `attachHeight` (local m): where the
   * limb leaves the bole axis — when set, the trunk → `from` reach is a cubic that leaves the bole
   * level, arches and droops onto `from` arriving along from → to (round 37: `from` sits 0.7 m
   * BELOW the tree's base, over the plaza, so the old level reach from `from.y` had nowhere to
   * start); otherwise the reach is the straight wiggled run from `from.y` on the axis. `sag`
   * (m, default 0.16) is the from → to droop, `tail` (m, default 1.8) the thin run past `to`.
   * `ghost`: every part of the limb — wood, lobes, end cluster — is drawn but not built (scratch
   * writer / culled laminae), so nothing of it casts, while the path is still published and every
   * draw after it is where it was; the structures' sleeve is then the only limb.
   */
  limbSpec?: { from: Vector3; to: Vector3; radius?: number; tipRadius?: number; attachHeight?: number; sag?: number; tail?: number; ghost?: boolean };
  palette: Palette;
  /** leaf population multiplier (quality) */
  leafDensity?: number;
  /** cluster-card population multiplier (defaults to leafDensity) */
  cardDensity?: number;
  /** local horizontal unit vector toward the clearing: crowns grow into the light (phototropism) */
  towardPlaza?: Vector3;
  /**
   * Extra authored boughs (local space): each leaves the trunk at `fromHeight`, droops out to `to`
   * and carries leaf lobes along its length and at its tip (e.g. the boughs framing Saria's roof).
   * `foliage` scales the lobe size and leaf count (1 = the default roof-lobe treatment); `density`
   * scales the leaf and card population of every lobe on the bough (dense dark masses > 1).
   * `ghostWood`: the bough's wood (main tube and end bough) is drawn but not built; its lobes, their
   * stems and every draw stay, so the lobes' shade (and what they block of the god-ray columns) is
   * kept while the wood's shadow band goes. (Measured in round 34 on the lantern tree's house bough
   * and not shipped: its band lit shot A's plaza mouth, but A read −0.0010 and B −0.0016 for it.)
   */
  boughs?: { to: Vector3; fromHeight: number; radius: number; tipRadius?: number; foliage?: number; density?: number; ghostWood?: boolean }[];
  /** per-tree shape overrides (see GiantProfile) */
  profile?: GiantProfile;
  /**
   * Clear corridors (local space): infinite lines, along the sun direction (shafts, sunlit ground)
   * or along a hero camera's line of sight (canopy gaps). Foliage inside a corridor is not built
   * (laminae only with probability `porosity`, cluster cards only with probability `cardPorosity`,
   * default none), so the canopy shadow map carries a few bold holes instead of only fine-grained
   * gaps, or the view opens onto the haze. Wood is untouched — the branches inside keep casting
   * thin shadows; surviving laminae add a leaf fringe, surviving cards (0.5–1.2 m) are what casts
   * visible dapple from 25 m up, where laminae blur away in the soft shadow filter. `yMin` (local)
   * restricts a corridor to the part of the line at or above that height, so a sun line can thin a
   * crown 15–25 m up without touching the low hero boughs it also crosses; `yMax` caps it (a ray
   * segment from a character toward the sun that must not carve the crown roof beyond it).
   * `wood` also cuts the fine wood: rings of non-structural tubes (lobe stems, secondaries, twigs,
   * crown boughs — never the trunk, roots, big limbs or leaders) inside the corridor are not built,
   * for a ray that must be wholly clear (a character's sun ray, whose 0.1–0.3 m stems otherwise
   * stripe his shadow). The gap is only ever seen from inside the corridor.
   */
  corridors?: {
    point: Vector3;
    dir: Vector3;
    radius: number;
    porosity?: number;
    cardPorosity?: number;
    yMin?: number;
    yMax?: number;
    wood?: boolean;
    /** also carves the corridor-exempt lobes (CanopyLobe.corridors false) — see corridors.ts CanopyOpening.hard */
    hard?: boolean;
  }[];
  /**
   * Dense leaf collars (local space) around the canopy openings (see CANOPY_OPENINGS): an annulus
   * `inner`–`outer` (m) around a sun line, active within the local height band. Every crown lobe
   * a collar crosses grows extra cluster cards inside the annulus (about `factor` × its own card
   * density there), so the openings read as holes in a dense leaf mass — clustered gaps between
   * leaf clumps — rather than as thin spots in an even canopy, and the shadow between two sun
   * pools on the ground is solid. The extra cards come from a stream forked per lobe (keyed by the
   * lobe centre), so no other draw in the tree moves when a collar is added or edited.
   */
  densify?: { point: Vector3; dir: Vector3; inner: number; outer: number; factor: number; yMin?: number; yMax?: number }[];
  /**
   * Foliage scale of the authored lantern limb's lobes (1 = full). The reference limb in shot A
   * is a bare bough with a few leaf clusters and haze between them, not a hedge on a pole.
   */
  limbFoliage?: number;
  /**
   * 0–1: how closely the hero cameras see this tree's LOW foliage (4–9 m). At 1 the low lobes get
   * leaf-sized 8-triangle laminae and no cluster cards; at 0 they use the cheap roof treatment.
   */
  eyeDetail?: number;
  /** authored canopy boughs (see CanopyBough), built after everything else */
  canopyBoughs?: CanopyBough[];
  /**
   * Round 50 (trees-32): canopy boughs built into GiantAsset.detached instead of the tree — same
   * CanopyBough treatment (a plain or dressed sweep, lobes with stems, laminae and cards), their
   * own stream (`detached-bough/<index>`), after the near canopy, so nothing of the tree proper
   * and none of its audit numbers move. Their lobes get no near-canopy version and the wood is
   * never `ghostWood`. For content that must appear and vanish on the caller's rule (a low bough
   * over ground no fixed frame sees, gated like the expansion locality) — see the trees index.
   */
  detachedBoughs?: CanopyBough[];
  /**
   * distance (m) from the trunk base to the nearest hero camera that faces it; within NEAR_BOLE_M
   * the bole and roots are built with the near-bole bark (bole.ts) unless `GiantProfile.relief`
   * says otherwise. Undefined = far.
   */
  heroDistance?: number;
  /** build the near base (default true; see NEAR_BASE_CUT_Y) */
  nearBase?: boolean;
  /** unit vector toward the sun (local = world for a giant): the shaded foot wears the moss sheets */
  sunDir?: Vector3;
  /** 0–1 path / paving mask under local (x, z): near fins shrink and sink there, nothing grows on it */
  pathAt?: (x: number, z: number) => number;
  /** near-base plant colours (the palette's ferns / ground leaves / litter) */
  basePalette?: Parameters<typeof basePlants>[2]['palette'];
  /**
   * Near-canopy LOD (see NEAR_CANOPY_IN_M). Undefined disables near-canopy registration.
   * `defer` leaves ordinary lobes as records for the pool's chunked builder. The legacy
   * hero-distance callback is accepted for caller compatibility but does not restrict detail.
   */
  nearCanopy?: { heroDistance?: HeroDistanceFn; defer?: boolean };
}

export function createGiantTree(def: GiantTreeDef, rng: Rng, o: GiantOptions): GiantAsset {
  const r = rng.fork(`giant/${def.id}`);
  const bt = (a: number, b: number) => between(r, a, b);
  const gnarl = new Noise2D(`giant-bark/${def.id}`);
  // `wood` is rebound to the detached boughs' writer while those are built, last of all (every
  // wood helper takes the writer as an argument at call time); `treeWood` is the tree's own
  let wood = new GeometryWriter('high');
  const treeWood = wood;
  /** set while the detached boughs (GiantOptions.detachedBoughs) are built: nothing of them is recorded on the tree */
  let detachedMode = false;
  // `leaves` is rebound to `authoredLeaves` while the authored canopy-bough lobes are foliated
  // (the leaf helpers read it at call time), so those laminae land in their own geometry
  let leaves = new GeometryWriter('high');
  const treeLeaves = leaves;
  const authoredLeaves = new GeometryWriter('high');
  const originalCorePositions: Vector3[] = [];
  // likewise `cards` is rebound to `authoredCards` while a flat lobe is foliated
  let cards = new GeometryWriter('high');
  const treeCards = cards;
  const authoredCards = new GeometryWriter('high');
  /** set while a flat lobe (CanopyLobe.flat) is foliated: one colour per lobe, no sun-side lerp */
  let lobeFlat = false;
  const R = def.trunkRadius;
  const H = def.height;
  const density = o.leafDensity ?? 1;
  const toPlaza = o.towardPlaza ?? new Vector3(1, 0, 0);
  const plazaBias = o.towardPlaza ? 1 : 0;
  const contacts: Vector3[] = [new Vector3(0, 0, 0)];
  const canopy = new Color(o.palette.leafCanopy);
  const sunny = new Color(o.palette.leafSun);
  const cool = new Color(0x3f7a4a);
  const warm = new Color(0x8fa83c);
  const barkBase = new Color(0.7, 0.64, 0.56);
  const barkDeep = new Color(0.3, 0.25, 0.2);
  const barkTint = new Color(...(o.profile?.barkTint ?? [1, 1, 1]));
  const tintFade = o.profile?.barkTintFade;
  const white = new Color(1, 1, 1);
  const crownRadius = H * bt(0.44, 0.5);

  // fine wood inside a `wood` corridor is not built (see GiantOptions.corridors): every
  // non-structural sweep below goes through this wrapper, which only adds the ring cull
  const woodCorridors = (o.corridors ?? []).filter((c) => c.wood);
  const woodTmp = new Vector3();
  const woodCulled = (p: Vector3, radius: number) => {
    for (const c of woodCorridors) {
      if (c.yMin !== undefined && p.y < c.yMin) continue;
      if (c.yMax !== undefined && p.y > c.yMax) continue;
      woodTmp.subVectors(p, c.point);
      woodTmp.addScaledVector(c.dir, -woodTmp.dot(c.dir));
      const reach = c.radius + radius;
      if (woodTmp.lengthSq() < reach * reach) return true;
    }
    return false;
  };
  /**
   * set while a ghosted part is built (GiantProfile.wildLimbGhost): every draw is made, nothing is
   * written — the wood goes to a scratch writer and the laminae / cards are culled after their
   * draws (the same way a corridor culls them), so the tree built after it is unchanged
   */
  let ghost = false;
  const scratch = new GeometryWriter('high');
  const tube: typeof sweep = (writer, points, radii, sides, rngFn, opts) =>
    sweep(ghost ? scratch : writer, points, radii, sides, rngFn, opts.structural || !woodCorridors.length ? opts : { ...opts, cull: woodCulled });

  const barkColor = (pt: Vector3) => {
    // soil-stained near the ground, lighter with height; ridges shaded by the tube grain
    const soil = 1 - smoothstep(-0.5, 2.5, pt.y);
    const tint = tintFade ? barkTint.clone().lerp(white, smoothstep(tintFade[0], tintFade[1], pt.y)) : barkTint;
    return barkBase
      .clone()
      .lerp(barkDeep, 0.4 * soil)
      .multiplyScalar(0.9 + 0.12 * smoothstep(2, 12, pt.y))
      .multiply(tint);
  };
  // large gnarl (metre-scale bulges + fluting) plus a mid-frequency term so the silhouette is never a pipe
  const gnarlBump = (scale: number, amount: number) => (angle: number, distance: number) => {
    const cx = Math.cos(angle) * 1.6;
    const cz = Math.sin(angle) * 1.6;
    const low = gnarl.fbm(cx * scale + distance * 0.11, cz * scale + distance * 0.09, 3);
    const mid = gnarl.noise(cx * scale * 3.1 + distance * 0.45, cz * scale * 3.1 - distance * 0.37);
    const flute = Math.sin(angle * 7 + distance * 0.12) * 0.35 + Math.sin(angle * 3 - distance * 0.07) * 0.2;
    return 1 + amount * (low * 0.9 + flute * 0.35 + mid * 0.3);
  };
  const stiff = () => 1;

  // ---------- trunk ----------
  const profile = o.profile ?? {};
  const flare = 0.85 * (profile.flare ?? 1);
  const girth = profile.girth ?? 1;
  const rootReach = profile.rootReach ?? 1;
  const rootGirth = profile.rootGirth ?? 1;
  const lean = Math.tan((bt(1, 3) * Math.PI) / 180);
  const leanAz = plazaBias ? Math.atan2(toPlaza.z, toPlaza.x) + bt(-0.7, 0.7) : r() * TAU;
  const fork = H * bt(0.5, 0.56);
  const top = new Vector3(Math.cos(leanAz) * lean * fork, fork, Math.sin(leanAz) * lean * fork);
  const skirt = 1.3;
  const trunk = growthPath(new Vector3(0, -skirt, 0), top, UP, r, 30, 0.18);
  // an authored lean shears the grown bole (displacement linear in height above the bend, so the
  // axis is where the profile says at every height); everything below samples the sheared path,
  // and the crown leaders keep their absolute targets
  if (profile.lean) {
    const shear = Math.tan((profile.lean.degrees * Math.PI) / 180);
    const az = (profile.lean.azimuthDeg * Math.PI) / 180;
    const fromY = profile.lean.fromY ?? -skirt;
    const blend = profile.lean.blend ?? 0;
    // 0 below fromY - blend, slope 1 above fromY + blend, quadratic in between
    const ramp = (y: number) => {
      const u = y - fromY;
      if (u <= -blend) return 0;
      if (u >= blend) return u;
      return ((u + blend) * (u + blend)) / (4 * blend);
    };
    for (const p of trunk) {
      const d = ramp(p.y) * shear;
      p.x += Math.cos(az) * d;
      p.z += Math.sin(az) * d;
    }
  }
  const trunkRadii = trunk.map((pt, i) => {
    const t = i / (trunk.length - 1);
    const above = Math.max(0, pt.y) / H;
    // girth thins the lower bole only; the radius at the fork (which sizes the crown leaders) is kept
    const radius = R * (0.42 + 0.58 * girth * Math.pow(1 - t, 0.75));
    return radius * (1 + flare * Math.exp(-above * 7));
  });
  // near-bole bark (bole.ts) for the giants a hero camera sees from a few metres: the plain
  // sweep's draws are consumed so every later draw (limbs, crown) is where it was
  // NEAR_BOLE_RELIEF (round 17 integration): the frames show every near bole as a hazed, near-smooth
  // column at 9-19 m - the full relief cost 0.0015-0.0054 SSIM in every hero view (structure, not
  // tone: the bole boxes' means held within 0.006) - so the hero-view amplitude runs at half while
  // the close-range read (the walkable build passes these boles at 2-5 m) keeps the cords and furrows
  const reliefScale = (profile.relief ?? 1) * NEAR_BOLE_RELIEF;
  const nearBole = profile.relief !== undefined ? profile.relief > 0 : o.heroDistance !== undefined && o.heroDistance <= NEAR_BOLE_M;
  const reliefNoise = nearBole ? new Noise2D(`giant-relief/${def.id}`) : null;
  /** nominal bole radius ≈ 2 m up: sets the cord count, the tessellation and the amplitude */
  const refRadius = (() => {
    let best = trunkRadii[0];
    let bestD = Infinity;
    trunk.forEach((pt, i) => {
      const dd = Math.abs(pt.y - 2);
      if (dd < bestD) {
        bestD = dd;
        best = trunkRadii[i];
      }
    });
    return best;
  })();
  let barkAudit: GiantAsset['bark'] = null;
  // the near base (see NEAR_BASE_CUT_Y) ends on the first trunk ring at or above the cut: the
  // plain sweep's rings below it are written collapsible, and its up-front draws are taken here
  // so the relief bole can end on exactly that ring (writer.ts tubeRidge with the same phase)
  const buildNearBase = o.nearBase !== false;
  const cutIndex = Math.max(1, trunk.findIndex((pt) => pt.y >= NEAR_BASE_CUT_Y));
  const cutY = trunk[cutIndex].y;
  const trunkDraws: TubeDraws = consumeTubeDraws(r, 30);
  const belowCut = (pt: Vector3) => buildNearBase && pt.y < cutY - 1e-6;
  if (nearBole && reliefNoise) {
    const draws = trunkDraws;
    const built = reliefBole(wood, trunk, trunkRadii, {
      color: barkColor,
      bump: gnarlBump(1.0, 0.16),
      creviceShade: 2.2,
      barkTile: 1.6,
      // ≈ 7.5 cm around: 5–6 vertices across each 0.42 m cord
      sides: Math.max(40, Math.min(120, Math.round((TAU * refRadius) / 0.075))),
      spacing: 0.22,
      denseUntilY: 15,
      // 8–15 cm on the r 1.1–1.7 boles: 0.09 m at r 1.0, 0.11 at 1.5, capped at the lantern tree's 2.4
      amplitude: Math.max(0.07, Math.min(0.14, 0.09 * Math.sqrt(refRadius))) * reliefScale,
      fadeY: [14, 19],
      farShare: 0.35,
      refRadius,
      noise: reliefNoise,
      draws,
      stiffness: stiff,
      flatBase: true,
      mossBand: [2.5, 7],
    });
    barkAudit = { relief: built.amplitude, rings: built.rings, sides: built.sides, mossShare: built.mossShare, rootToes: 0, triangles: built.triangles };
  } else {
    tube(wood, trunk, trunkRadii, 30, r, {
      color: barkColor,
      roughness: 0.06,
      bump: gnarlBump(1.0, 0.16),
      creviceShade: 2.2,
      barkTile: 1.6,
      flatBase: true,
      isTrunk: true,
      structural: true,
      stiffness: stiff,
      draws: trunkDraws,
      collapsible: belowCut,
    });
  }

  // ---------- buttress roots ----------
  const rootCount = r.int(6, 9);
  /** the plain roots as built (centreline, radii, draws), for the near base's fins */
  const plainRoots: { path: Vector3[]; radii: number[]; draws: TubeDraws; length: number; index: number }[] = [];
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * TAU + bt(-0.22, 0.22);
    const dir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new Vector3(-dir.z, 0, dir.x);
    const length = R + bt(3, 6) * rootReach;
    const r0 = R * bt(0.36, 0.48) * rootGirth;
    const wigglePhase = r() * TAU;
    const wiggle = bt(0.15, 0.4);
    const segments = 11;
    const path: Vector3[] = [];
    const radii: number[] = [];
    // the root collar sits on the flare: lower when the flare is reduced
    const collar = R * (0.35 + 0.47 * flare);
    for (let k = 0; k <= segments; k++) {
      const t = k / segments;
      const radius = 0.14 + (r0 - 0.14) * Math.pow(1 - t, 0.9);
      const d = R * 0.55 * girth + (length - R * 0.55 * girth) * t;
      const p = dir.clone().multiplyScalar(d).addScaledVector(side, Math.sin(t * 4.2 + wigglePhase) * wiggle * t);
      const g = o.groundAt(p.x, p.z);
      // starts high on the flare, dives to the ground, then rides half-buried along the terrain
      const dive = smoothstep(0, 0.45, t);
      p.y = (1 - dive) * (collar * (1 - t * 0.8) + g) + dive * (g + radius * 0.4);
      if (k === segments) p.y = g - 0.25;
      path.push(p);
      radii.push(radius);
    }
    const rootDraws = consumeTubeDraws(r, 10);
    plainRoots.push({ path, radii, draws: rootDraws, length, index: i });
    if (nearBole && reliefNoise && barkAudit && NEAR_BOLE_ROOTS) {
      // the buttress fin with toes (bole.ts) along the same centreline, its toes from a fork
      const built = buttressRoot(wood, path, radii, {
        groundAt: o.groundAt,
        color: barkColor,
        draws: rootDraws,
        rng: r.fork(`root-toes/${i}`),
        flare: 1.7,
        maxReach: length + 0.15,
        stiffness: stiff,
        noise: reliefNoise,
      });
      barkAudit.rootToes += built.toes;
      barkAudit.triangles += built.triangles;
    } else {
      // the plain root is replaced by the near base's fin at close range: collapsible
      wood.woodCollapsible = buildNearBase;
      wood.woodIsRoot = true;
      tube(wood, path, radii, 10, r, { color: barkColor, roughness: 0.08, bump: gnarlBump(1.4, 0.16), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff, draws: rootDraws });
      wood.woodCollapsible = false;
      wood.woodIsRoot = false;
    }
    const tip = path[path.length - 1];
    contacts.push(new Vector3(tip.x, o.groundAt(tip.x, tip.z), tip.z));
    // small side roots
    const sub = r.int(1, 3);
    for (let s = 0; s < sub; s++) {
      const st = bt(0.3, 0.65);
      const origin = sample(path, st);
      const a2 = angle + (s % 2 === 0 ? 1 : -1) * bt(0.55, 1.0);
      const len = bt(1.4, 2.6) * rootReach;
      const sp: Vector3[] = [];
      const sr: number[] = [];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = origin.clone().add(new Vector3(Math.cos(a2) * len * t, 0, Math.sin(a2) * len * t));
        const rad = 0.05 + 0.11 * (1 - t);
        const g = o.groundAt(p.x, p.z);
        p.y = k === 0 ? origin.y : g + rad * 0.35 * (1 - t) - 0.05 * t;
        if (k === n) p.y = g - 0.15;
        sp.push(p);
        sr.push(rad);
      }
      tube(wood, sp, sr, 6, r, { color: barkColor, roughness: 0.1, structural: true, stiffness: stiff });
      const tip2 = sp[sp.length - 1];
      contacts.push(new Vector3(tip2.x, o.groundAt(tip2.x, tip2.z), tip2.z));
    }
  }

  // ---------- near base (see NEAR_BASE_CUT_Y) ----------
  // Built from its own forked streams and a separate writer, so nothing above or below re-rolls:
  // the plain tree is exactly what it was with the near base off.
  let nearBase: BufferGeometry | null = null;
  let nearBaseBuild: GiantAsset['nearBaseBuild'] = null;
  let nearBaseAudit: GiantAsset['nearBaseAudit'] = null;
  /**
   * One build of the near base, chunked (yields after the bole, after every fin, after the
   * plants): everything it reads — the trunk, the plain roots' centrelines and draws, the noise
   * seeds, the forked streams — is fixed by now, so every run returns the same geometry.
   */
  function* nearBaseSteps(): Generator<void, { geometry: BufferGeometry; audit: NonNullable<GiantAsset['nearBaseAudit']> }> {
    const nb = new GeometryWriter('high');
    const nrng = r.fork('near-base');
    const nNoise = new Noise2D(`giant-near-relief/${def.id}`);
    const shadeDir = o.sunDir ? new Vector3(-o.sunDir.x, 0, -o.sunDir.z).normalize() : undefined;
    const amplitude = nearBaseAmplitude(refRadius);
    const bole = yield* reliefBoleSteps(nb, trunk.slice(0, cutIndex + 1), trunkRadii.slice(0, cutIndex + 1), {
      color: barkColor,
      bump: gnarlBump(1.0, 0.16),
      creviceShade: 2.2,
      barkTile: 1.6,
      roughness: 0.06,
      // ≈ 5 cm around: 6 vertices across each 0.3 m cord
      sides: Math.max(56, Math.min(200, Math.round((TAU * refRadius) / 0.05))),
      spacing: 0.16,
      denseUntilY: cutY + 1,
      amplitude,
      pitch: NEAR_BASE_PITCH,
      fadeY: [cutY + 10, cutY + 20],
      farShare: 1,
      endFade: [cutY - 1.8, cutY],
      cap: false,
      refRadius,
      noise: nNoise,
      draws: trunkDraws,
      stiffness: stiff,
      flatBase: true,
      mossBand: [0.8, 4.2],
      mossStrength: 1,
      shadeDir,
      sheetBand: [1.0, 2.6],
      // round 44 (survey #1 "moss as a painted decal"): the cover bulges and carries 3-D cushions
      mossBulge: 0.7,
      cushions: { rng: nrng.fork('cushions'), density: 0.045, size: [0.05, 0.12], maxCount: 320 },
    });
    yield;
    let cushions = bole.cushions;
    // fins: one per plain root along its own centreline; 3–6 of them are the big flares
    const bigCount = nrng.int(3, Math.min(6, rootCount));
    const bigStart = nrng.int(0, rootCount);
    const bigSet = new Set<number>();
    for (let k = 0; k < bigCount; k++) bigSet.add((bigStart + Math.round((k * rootCount) / bigCount)) % rootCount);
    let toes = 0;
    /** fin footprints for the plant ring: [path, half-width] */
    const finFoot: { path: Vector3[]; halfWidth: number }[] = [];
    for (const root of plainRoots) {
      const big = bigSet.has(root.index);
      const built = buttressRoot(nb, root.path, root.radii, {
        groundAt: o.groundAt,
        pathAt: o.pathAt,
        color: barkColor,
        draws: root.draws,
        rng: r.fork(`root-toes/${root.index}`),
        flare: big ? 2.4 : 1.5,
        finHeight: big ? 2.1 : 1.35,
        maxReach: root.length + 0.15,
        stiffness: stiff,
        noise: nNoise,
        cushions: { rng: nrng.fork(`fin-cushions/${root.index}`), density: 0.08, size: [0.05, 0.11], maxCount: 40 },
      });
      toes += built.toes;
      cushions += built.cushions;
      finFoot.push({ path: root.path, halfWidth: root.radii[0] * (big ? 2.4 : 1.5) });
      yield;
    }
    const woodTriangles = nb.triangles;
    // the plant ring: outside the foot, off the paving, clear of the fins' collars
    const footRadius = trunkRadii[Math.max(0, trunk.findIndex((pt) => pt.y >= 0))] * 1.05;
    const clear = (x: number, z: number) => {
      for (const f of finFoot) {
        // only the collar half of a fin is wide enough to matter
        for (let i = 0; i < Math.ceil(f.path.length * 0.6); i++) {
          const a = f.path[i];
          const b = f.path[Math.min(f.path.length - 1, i + 1)];
          const abx = b.x - a.x;
          const abz = b.z - a.z;
          const len2 = abx * abx + abz * abz || 1;
          const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2));
          const dx = x - (a.x + abx * t);
          const dz = z - (a.z + abz * t);
          if (dx * dx + dz * dz < f.halfWidth * f.halfWidth * 0.8) return false;
        }
      }
      return true;
    };
    const plants = yield* basePlantsSteps(nb, nrng.fork('plants'), {
      groundAt: o.groundAt,
      pathAt: o.pathAt,
      clear,
      footRadius,
      reach: footRadius + 1.6 + 0.6 * refRadius,
      density: Math.min(1.3, 0.7 + 0.3 * refRadius),
      shadeDir,
      palette: o.basePalette ?? {
        fern: new Color(0x5b6838),
        fernDeep: new Color(0x3c4927),
        tuft: new Color(0x5e764a),
        tuftSun: new Color(0x8a9a4c),
        litter: new Color(0x69613c),
        litterDark: new Color(0x423b26),
      },
    });
    yield;
    const geometry = yield* nb.finishSteps(`giant-near-base-${def.id}`);
    return {
      geometry,
      audit: {
        relief: bole.amplitude,
        rings: bole.rings,
        sides: bole.sides,
        cutY,
        mossShare: bole.mossShare,
        fins: plainRoots.length,
        bigFins: bigSet.size,
        toes,
        cushions,
        woodTriangles,
        plants,
        triangles: nb.triangles,
      },
    };
  }
  if (buildNearBase) {
    const first = runSteps(nearBaseSteps());
    nearBase = first.geometry;
    nearBaseAudit = first.audit;
    nearBaseBuild = function* () {
      return (yield* nearBaseSteps()).geometry;
    };
  }

  // ---------- leaves ----------
  // Foliage near eye level (the lantern limb, low boughs at 4–9 m) is seen from 3–8 m: it needs
  // real leaf-sized laminae (~10 cm, beech/oak obovate outline, 8 triangles). The roof at 14–24 m
  // is 15+ m away and uses bigger stylised laminae plus cluster cards.
  const eyeDetail = o.eyeDetail ?? 0;
  // per-lobe overrides for the authored canopy boughs (null / 1 = the tree's own treatment)
  let eyeOverride: number | null = null;
  let lobeTone = 1;
  const nearEye = (y: number) => (eyeOverride ?? (1 - smoothstep(7, 12, y)) * eyeDetail);
  const leafOpts = (radius: number, y: number) => ({
    widthRatio: 0.6,
    wideFirst: 0.7,
    wideSecond: 0.82,
    stiffness: stiffnessFor(radius),
    flutter: 0.03,
    detailOverride: (nearEye(y) > 0.75 ? 'high' : 'medium') as 'high' | 'medium',
    tipColor: new Color('#8a9a4c'),
  });
  const corridors = o.corridors ?? [];
  const corrTmp = new Vector3();
  // corridor survival is a hash of the caster's position rather than a stream: adding or moving one
  // corridor then never re-rolls the survivors of another (a shared stream shifted every later
  // draw, re-dappling the plaza whenever a corridor elsewhere changed), and culled laminae/cards
  // still make their own draws from the main stream, so the rest of the tree (limbs, crown built
  // after the foliage a corridor touches) is the same whatever the corridors
  const survives = (p: Vector3, porosity: number) => {
    if (porosity <= 0) return false;
    const h = Math.sin(p.x * 12.9898 + p.y * 78.233 + p.z * 37.719) * 43758.5453;
    return h - Math.floor(h) < porosity;
  };
  /**
   * the tightest corridor within `extent` of p (smallest porosity wins), or null — `extent` is the
   * half-size of the caster, so a cluster card centred just outside a corridor cannot lean into it
   */
  const inCorridor = (p: Vector3, extent = 0, exemptLobe = false) => {
    let hit: (typeof corridors)[number] | null = null;
    for (const c of corridors) {
      // a corridor-exempt lobe (CanopyLobe.corridors false) is carved by the hard corridors only
      if (exemptLobe && !c.hard) continue;
      if (c.yMin !== undefined && p.y < c.yMin) continue;
      if (c.yMax !== undefined && p.y > c.yMax) continue;
      corrTmp.subVectors(p, c.point);
      const along = corrTmp.dot(c.dir);
      corrTmp.addScaledVector(c.dir, -along);
      const reach = c.radius + extent;
      if (corrTmp.lengthSq() < reach * reach && (!hit || (c.porosity ?? 0) < (hit.porosity ?? 0))) hit = c;
    }
    return hit;
  };
  /**
   * set while an authored canopy lobe with `corridors: false` is built (CanopyLobe): its foliage
   * is kept whatever corridor it stands in — the lobe exists to stand on a camera ray, and the
   * corridors that cross that ray (a hollow-gap view line, a path sun line) would otherwise thin
   * it to their porosity
   */
  let corridorExempt = false;
  /**
   * Round 45 (survey crop 15: the east giant's plateau-lip lobes hung their twigs at the walk's
   * eye height): set while a lobe with a `floor` (CanopyLobe.floor / SpreadLimb.floor, local y) is
   * foliated — no lamina, card or twig of it is written below that height. Culls keep every draw
   * (like the corridors), so the lobe's own stream and everything after it are unchanged.
   */
  let lobeFloorY: number | null = null;
  /** false when a lamina at p must be dropped for a corridor (or the lobe's walk-clearance floor) */
  const leafAllowed = (p: Vector3) => {
    if (ghost) return false;
    if (lobeFloorY !== null && p.y < lobeFloorY + 0.2) return false;
    if (!corridors.length) return true;
    const c = inCorridor(p, 0, corridorExempt);
    return !c || survives(p, c.porosity ?? 0);
  };
  /** false when a cluster card of half-size `s` at p must be dropped for a corridor (or the floor) */
  const cardAllowed = (p: Vector3, s: number) => {
    if (ghost) return false;
    if (lobeFloorY !== null && p.y - s < lobeFloorY) return false;
    if (!corridors.length) return true;
    const c = inCorridor(p, s * 0.7, corridorExempt);
    return !c || survives(p, c.cardPorosity ?? 0);
  };
  let lobe: { center: Vector3; hR: number } | null = null;
  function leafSpray(path: Vector3[], pathRadius: number, count: number, vigor = 1, startT = 0.15) {
    const midY = sample(path, 0.6).y;
    // low foliage seen up close is carried by many small laminae (cards only fill the core there)
    count = Math.max(1, Math.round(count * density * (1 + 4.0 * nearEye(midY))));
    const phase = r() * TAU;
    const opts = leafOpts(pathRadius, midY);
    for (let j = 0; j < count; j++) {
      const t = startT + ((1 - startT) * (j + bt(0.15, 0.85))) / count;
      const base = sample(path, t);
      // a culled lamina still makes every draw below (addLeaf included), so the main stream — and
      // with it every branch, lobe and leaf built after this one — is the same whatever the corridors
      const allowed = leafAllowed(base);
      const axis = tangent(path, t);
      const [u, v] = frame(axis);
      const angle = phase + j * 2.399963229728653 + bt(-0.3, 0.3);
      const outward = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
      const direction = axis.clone().multiplyScalar(bt(0.25, 0.6)).addScaledVector(outward, 1).addScaledVector(UP, bt(-0.35, 0.3)).normalize();
      const heightF = base.y / H;
      const outF = Math.hypot(base.x, base.z) / crownRadius;
      const sun = Math.min(1, Math.max(0, (heightF - 0.55) * 2.0 + outF * 0.3)) * bt(0.3, 1);
      // leaves deep inside a lobe are self-shadowed: darker and cooler
      const interior = lobe ? smoothstep(0.85, 0.3, base.distanceTo(lobe.center) / Math.max(0.5, lobe.hR)) : 0;
      // every draw is made either way, so a flat lobe's leaves leave the stream where lit ones would
      const coolWarm = bt(0, 1) < 0.5 ? cool : warm;
      const tint = bt(0, 0.3);
      const color = lobeFlat
        ? canopy.clone().multiplyScalar(0.92 * lobeTone)
        : canopy
            .clone()
            .multiplyScalar(0.92)
            .lerp(sunny, sun * (1 - interior * 0.7))
            .lerp(coolWarm, tint)
            .multiplyScalar(vigor * (1 - interior * 0.32) * lobeTone);
      // leaves near eye level (low limbs) stay believable; the high roof uses big stylised laminae
      const roofSize = 0.17 + 0.22 * smoothstep(4, 15, base.y);
      const eyeSize = 0.13 + 0.24 * smoothstep(6, 16, base.y);
      const size = bt(0.72, 1.0) * (roofSize + (eyeSize - roofSize) * (eyeOverride ?? eyeDetail));
      addLeaf(leaves, base, direction, size, color, r, opts, allowed);
    }
  }

  /**
   * Leaf-cluster cards filling a lobe: quads biased to the lobe shell, each carrying the cluster
   * alpha texture, with normals pointing out of the lobe (so the canopy shades as one volume
   * instead of a patchwork of flat quads). Cards ride the branch wind layer of their bough.
   */
  const cardN = new Vector3();
  const cardU = new Vector3();
  const cardW = new Vector3();
  function clusterCards(center: Vector3, hR: number, vR: number, boughRadius: number, count: number, sizeCap = 1.4) {
    // near eye level a card seen obliquely reads as one flat cut-out, so low lobes seen up close
    // keep only half-size cards deep in the lobe core (dark filler behind the laminae)
    const eye = nearEye(center.y);
    const sizeF = 1 - 0.5 * eye;
    count = Math.max(2, Math.round(count * 1.5 * Math.min(1.4, o.cardDensity ?? density)));
    const stiffness = stiffnessFor(boughRadius * 0.5);
    const phase = r();
    /**
     * one card drawn from stream `g`: every draw is made before the culls, so a culled card leaves
     * the stream exactly where a built one would (the corridors never shift the main stream);
     * `keep` is the densify pass's collar test
     */
    const placeCard = (g: Rng, drop: boolean, keep?: (p: Vector3) => boolean) => {
      const gb = (a: number, b: number) => between(g, a, b);
      const rr = Math.pow(g(), 0.4) * (1 - 0.45 * eye);
      const th = g() * TAU;
      const ph = Math.acos(2 * g() - 1);
      const local = new Vector3(Math.sin(ph) * Math.cos(th) * hR * rr, Math.cos(ph) * vR * rr, Math.sin(ph) * Math.sin(th) * hR * rr);
      const p = center.clone().add(local);
      cardN.set(local.x / hR, local.y / vR + 0.7, local.z / hR).normalize();
      cardN.x += gb(-0.35, 0.35);
      cardN.z += gb(-0.35, 0.35);
      cardN.normalize();
      const ref = Math.abs(cardN.y) < 0.9 ? UP : new Vector3(1, 0, 0);
      cardU.crossVectors(cardN, ref).normalize();
      cardW.crossVectors(cardN, cardU).normalize();
      // spin the card in its plane
      const spin = g() * TAU;
      const su = cardU.clone().multiplyScalar(Math.cos(spin)).addScaledVector(cardW, Math.sin(spin));
      const sw = cardW.clone().multiplyScalar(Math.cos(spin)).addScaledVector(cardU, -Math.sin(spin));
      // fewer, larger clumps (sheet 01: dense soft clumps, not stars): ×1.12 on the card and
      // every fourth card dropped — after its draws, so the main stream is what it was with the
      // smaller, more numerous cards and nothing else in the tree re-rolls
      const s = Math.min(sizeCap, Math.max(0.4, gb(0.25, 0.38) * hR)) * sizeF;
      const heightF = p.y / H;
      const outF = Math.hypot(p.x, p.z) / crownRadius;
      const sun = Math.min(1, Math.max(0, (heightF - 0.55) * 2.0 + outF * 0.3)) * gb(0.35, 1);
      const interior = 1 - rr;
      const coolWarm = gb(0, 1) < 0.5 ? cool : warm;
      const tint = gb(0, 0.25);
      const jitter = gb(0.85, 1.05);
      const color = lobeFlat
        ? canopy.clone().multiplyScalar(0.9 * lobeTone)
        : canopy
            .clone()
            .multiplyScalar(0.9)
            .lerp(sunny, sun * (1 - interior * 0.7))
            .lerp(coolWarm, tint)
            .multiplyScalar(jitter * (1 - interior * 0.4) * lobeTone);
      if (drop) return;
      if (keep && !keep(p)) return;
      if (!cardAllowed(p, s)) return;
      const V = (du: number, dw: number, u: number, v: number) =>
        cards.vertexN(
          p.clone().addScaledVector(su, du * s).addScaledVector(sw, dw * s),
          cardN,
          color,
          CARD_UV0 + (1 - CARD_UV0) * u,
          CARD_UV0 + (1 - CARD_UV0) * v,
          stiffness,
          phase,
          0.012 * (0.5 + v),
          1,
        );
      const a = V(-1, -1, 0, 0);
      const b = V(1, -1, 1, 0);
      const c = V(1, 1, 1, 1);
      const d = V(-1, 1, 0, 1);
      cards.triangle(a, b, c);
      cards.triangle(a, c, d);
    };
    for (let i = 0; i < count; i++) placeCard(r, i % 4 === 3);

    // densify pass (see GiantOptions.densify): the collars whose annulus can reach this lobe get
    // extra cards from a per-lobe stream — sampled over the same lobe ellipsoid and kept only inside
    // an annulus, so the local card density there rises by about the collar's factor while the
    // lobe's shape, and every other draw in the tree, stay what they were
    const collars = o.densify;
    if (!collars?.length) return;
    const reach = Math.max(hR, vR);
    const near = collars.filter((d) => {
      if (d.yMin !== undefined && center.y + vR < d.yMin) return false;
      if (d.yMax !== undefined && center.y - vR > d.yMax) return false;
      corrTmp.subVectors(center, d.point);
      corrTmp.addScaledVector(d.dir, -corrTmp.dot(d.dir));
      return corrTmp.length() < d.outer + reach;
    });
    if (!near.length) return;
    const factor = Math.max(...near.map((d) => d.factor));
    const rd = r.fork(`densify/${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}`);
    const inCollar = (p: Vector3) => {
      for (const d of near) {
        if (d.yMin !== undefined && p.y < d.yMin) continue;
        if (d.yMax !== undefined && p.y > d.yMax) continue;
        corrTmp.subVectors(p, d.point);
        corrTmp.addScaledVector(d.dir, -corrTmp.dot(d.dir));
        const off = corrTmp.length();
        if (off >= d.inner && off < d.outer && rd() * factor < d.factor) return true;
      }
      return false;
    };
    const attempts = Math.round(count * factor);
    for (let i = 0; i < attempts; i++) placeCard(rd, false, inCollar);
  }

  /**
   * The opaque core of a flat lobe (CanopyLobe.core): one closed ellipsoid of `k` × the lobe's
   * radii written to the flat leaves writer as leaf vertices (rigid, no flutter), in the colour the
   * lobe's cards render — their vertex colour × the flat map level (materials.ts LEAF_FLAT_MAP_LUM
   * stands in for the cluster map on a flat card), so the body and its fringe are one level.
   */
  function lobeCore(center: Vector3, hR: number, vR: number, k: number) {
    const color = canopy.clone().multiplyScalar(0.9 * LEAF_FLAT_MAP_LUM * lobeTone);
    const segs = 28;
    const rings = 16;
    const base = leaves.positions.length / 3;
    const p = new Vector3();
    const n = new Vector3();
    // clumped outline: the radius swells and dips by ±12 % in three sinusoidal lobes of 0.6–1.2 m
    // around the ellipsoid (own stream, so nothing else in the tree re-rolls) — a canopy mass's
    // silhouette against the haze, not a balloon's; the body stays one even colour either way
    const rl = r.fork(`lobe-core/${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}`);
    const waves = [3, 5, 2].map((f, i) => ({ f, g: [1, 2, 3][i], w: [0.55, 0.3, 0.4][i], p: rl() * TAU, q: rl() * TAU }));
    const swell = (th: number, ph: number) => 1 + 0.12 * waves.reduce((s, w) => s + w.w * Math.sin(w.f * th + w.p) * Math.cos(w.g * ph + w.q), 0);
    // The body stays one even colour: a clump-shading pass over it (round 38 probes p9/p10 — a
    // top-to-underside gradient, the swells lighter than the dips, a finer mottle; as vertex colour
    // and as a per-vertex shade share) either did not reach the pixel (colour: the leaf floor and
    // the haze at 12–15 m pass ~17 % of an albedo swing) or read as a lit sphere, not foliage, for
    // C −0.001 / F −0.001. The frames' mass at this distance is matte; the outline is the detail.
    for (let i = 0; i <= rings; i++) {
      const ph = (i / rings) * Math.PI;
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * TAU;
        const sx = Math.sin(ph) * Math.cos(th);
        const sy = Math.cos(ph);
        const sz = Math.sin(ph) * Math.sin(th);
        const s = k * (i === 0 || i === rings ? 1 : swell(th, ph));
        p.set(center.x + sx * hR * s, center.y + sy * vR * s, center.z + sz * hR * s);
        // a floored lobe's core (round 45, CanopyLobe.floor) is flat-bottomed at the floor: the
        // ring vertices under it are lifted onto it, so the body stays closed and nothing of it
        // hangs into the walk's clearance
        if (lobeFloorY !== null && p.y < lobeFloorY) p.y = lobeFloorY;
        n.set(sx / hR, sy / vR, sz / hR).normalize();
        leaves.vertexN(p, n, color, 0, 0, 1, 0, 0, 1);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = base + i * (segs + 1) + j;
        const b = a + segs + 1;
        leaves.triangle(a, b, a + 1);
        leaves.triangle(b, b + 1, a + 1);
      }
    }
    // Round 40 (owner: "Verdant quality especially when looking up"; from the stair landing and
    // the plaza these read as matte paddles): the core keeps the body even, but its OUTLINE is
    // dressed with two layers of leaf-cluster cards riding the ellipsoid's surface — clumps at
    // 0.92–1.02 of the core radius and a finer fringe at 1.02–1.14 — in the lobe's one flat
    // colour (no sun, no jitter: the body's window sd stays what SSIM's structure term wants),
    // so at 10–25 m the silhouette breaks into leaf clumps instead of a smooth swell. The cards
    // tilt 0–60° off the surface normal so the rim shows them obliquely from every camera
    // (surface-normal cards are edge-on exactly at the silhouette). Own stream (`rl`), the
    // flat cards writer, no shadow pass (that mesh never casts).
    const area = 4 * Math.PI * Math.pow(hR * hR * vR * k * k * k, 2 / 3);
    const cardColor = canopy.clone().multiplyScalar(0.9 * lobeTone);
    const rimN = new Vector3();
    const rimU = new Vector3();
    const rimW = new Vector3();
    const rimCard = (rr: number, size: number) => {
      const th = rl() * TAU;
      const ph = Math.acos(2 * rl() - 1);
      const sx = Math.sin(ph) * Math.cos(th);
      const sy = Math.cos(ph);
      const sz = Math.sin(ph) * Math.sin(th);
      const s = k * rr * swell(th, ph);
      const p = new Vector3(center.x + sx * hR * s, center.y + sy * vR * s, center.z + sz * hR * s);
      rimN.set(sx / hR, sy / vR + 0.5, sz / hR).normalize();
      rimN.x += (rl() - 0.5) * 1.2;
      rimN.y += (rl() - 0.5) * 0.8;
      rimN.z += (rl() - 0.5) * 1.2;
      rimN.normalize();
      const ref = Math.abs(rimN.y) < 0.9 ? UP : new Vector3(1, 0, 0);
      rimU.crossVectors(rimN, ref).normalize();
      rimW.crossVectors(rimN, rimU).normalize();
      const spin = rl() * TAU;
      const su = rimU.clone().multiplyScalar(Math.cos(spin)).addScaledVector(rimW, Math.sin(spin));
      const sw = rimW.clone().multiplyScalar(Math.cos(spin)).addScaledVector(rimU, -Math.sin(spin));
      if (!cardAllowed(p, size)) return;
      const V = (du: number, dw: number, u: number, v: number) =>
        cards.vertexN(p.clone().addScaledVector(su, du * size).addScaledVector(sw, dw * size), rimN, cardColor, CARD_UV0 + (1 - CARD_UV0) * u, CARD_UV0 + (1 - CARD_UV0) * v, 0.6, 0, 0.01 * (0.5 + v), 1);
      const a = V(-1, -1, 0, 0);
      const b = V(1, -1, 1, 0);
      const c = V(1, 1, 1, 1);
      const d = V(-1, 1, 0, 1);
      cards.triangle(a, b, c);
      cards.triangle(a, c, d);
      coreRimCards++;
    };
    const clumps = Math.round(area * 1.6);
    for (let i = 0; i < clumps; i++) rimCard(0.92 + rl() * 0.1, hR * (0.2 + rl() * 0.1));
    const fringe = Math.round(area * 1.2);
    for (let i = 0; i < fringe; i++) rimCard(1.02 + rl() * 0.12, hR * (0.13 + rl() * 0.07));
  }
  let coreRimCards = 0;

  // near-canopy LOD (nearCanopy.ts): the lobes and big limbs recorded for it while the far tree
  // is written — their far wood as built, so the near versions can fork on from it
  const near = o.nearCanopy;
  const nearLobes: NearLobeRecord[] = [];
  /** big limbs at any altitude, for the limb dressing parts (moss strip, vines) */
  const nearLimbs: NearLimbRecord[] = [];
  let nearGroups = 0;
  const nearTally = { kept: 0, limited: 0 };
  const swapRadii = (center: Vector3, radius: number) => swapRadiiFor(near?.heroDistance, center, radius, nearTally);
  const recordLimb = (path: Vector3[], radii: number[], sleeve?: NearLimbRecord['sleeve']) => {
    if (!near || ghost) return;
    if (path.length < 3) return;
    // the dressing's reach: half the limb plus the vines' drop (the same bound its part reports)
    const reach = 0.5 * path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0) + 3.8;
    const radii2 = swapRadii(sample(path, 0.6), reach);
    if (!radii2) return;
    nearLimbs.push({ path, radii, inM: radii2[0], outM: radii2[1], sleeve });
  };

  // Round 45 (trees-28, item 4 — survey pose w19-spine-u, straight up from the north spine: the
  // pale spikes on the crown rim at the frame's left are the NORTH-WEST giant's lobes seen from
  // below, not a column's): a lobe's secondaries ran to 0.58–0.95 hR and its twigs to 0.57–1.04,
  // so 5–10 cm of bark wood stood past the laminae against the sky — and shaded bark is what
  // the bark floor makes it (materials/shadeFloor.ts: a flat grey at texture 0.1, pale whatever
  // its albedo), while the leaves take the darker leaf floor. The wood's outer part is tinted
  // from the bark toward the deep leaf tone (LOBE_TWIG_TINT: what shows between laminae is the
  // mass's own dark where the sun reaches it). Its reach is the round-44 reach — see
  // LOBE_SECONDARY_REACH for why it is not pulled inside the ellipsoid. Same draws as before:
  // the stream is unchanged.
  const twigTip = canopy.clone().multiplyScalar(0.55);
  function foliateLobe(bough: Vector3[], center: Vector3, hR: number, vR: number, boughRadius: number, subCount = 3, twigCount = 4, sprigCount = 4, mult = 0.55, cardMult = 1, compact = false, stemRadii?: number[]) {
    lobe = { center, hR };
    // Register eligible lobes at every height. Far foliage gets a group tag; the live camera
    // and bounded pool decide when its detailed replacement can be shown.
    let rec: NearLobeRecord | null = null;
    // Round 44 (survey #12: "near-canopy lobes at 5–8 m = huge single-tone flat shapes"): a FLAT
    // lobe (the bank canopy's cored lobes, 3.4 m over the plaza's east edge) is eligible too. Its
    // far foliage stays available (writer.ts writes a flat tagged leaf as 1000 + group + share,
    // decoded as flat) until its detailed version is resident inside the live swap distance.
    const flatEligible = lobeFlat && !compact && !ghost;
    if (near && !ghost && !detachedMode && (flatEligible || (!lobeFlat && !compact && lobeTone === 1 && leaves.leafShade === 1 && eyeOverride !== 1))) {
      const fixedSwap = flatEligible && NEAR_CANOPY_FLAT_SWAP_M !== null;
      const radii2 = fixedSwap ? NEAR_CANOPY_FLAT_SWAP_M : swapRadii(center, hR + 1.4);
      if (radii2) {
        rec = { group: nearGroups++, center: center.clone(), hR, vR, stem: bough, stemRadii: stemRadii ?? taper(bough, boughRadius, 0.02), secondaries: [], twigs: [], farLeaves: 0, farCards: 0, inM: radii2[0], outM: radii2[1], fixedSwap, floorY: lobeFloorY ?? undefined };
        leaves.leafSwapGroup = rec.group;
        cards.leafSwapGroup = rec.group;
      }
    }
    const leavesBefore = leaves.leafCount;
    const cardsBefore = cards.triangles;
    // a compact lobe keeps its twigs' drop and its sprigs inside the authored ellipsoid (they are
    // sized for the ordinary 1.5 m+ lobe) and gathers the stem's leaf trail onto its last 15 %
    const reach = compact ? Math.min(1, hR / 1.5) : 1;
    clusterCards(center, hR, vR, boughRadius, (7 + subCount * 3) * cardMult, compact ? Math.max(0.15, hR * 0.6) : undefined);
    if (compact) {
      const [a, b] = [bough[bough.length - 2], bough[bough.length - 1]];
      const short = [b.clone().lerp(a, 0.15), b];
      leafSpray(short, boughRadius * 0.4, 6 * mult, 0.94, 0.8);
    } else leafSpray(bough, boughRadius * 0.4, 6 * mult, 0.94, 0.8);
    const phase = r() * TAU;
    for (let j = 0; j < subCount; j++) {
      const attachment = 0.4 + (j / subCount) * 0.48 + bt(-0.035, 0.035);
      const origin = sample(bough, attachment);
      const a = phase + j * 2.39996 + bt(-0.45, 0.45);
      const elevation = bt(-0.55, 0.8);
      const reach = hR * Math.sqrt(1 - elevation * elevation) * bt(LOBE_SECONDARY_REACH[0], LOBE_SECONDARY_REACH[1]);
      const target = center.clone().add(new Vector3(Math.cos(a) * reach, elevation * vR, Math.sin(a) * reach));
      const secondary = growthPath(origin, target, tangent(bough, attachment), r, 6, 0.85);
      const secondaryRadius = Math.max(0.03, boughRadius * Math.pow(1 - attachment, 0.9) * 0.5);
      const secondaryLength = Math.max(0.5, origin.distanceTo(target));
      tube(wood, secondary, taper(secondary, secondaryRadius, 0.008), 5, r, { color: (pt) => barkColor(pt).lerp(twigTip, smoothstep(0.55, 1, pt.distanceTo(origin) / secondaryLength) * LOBE_TWIG_TINT), roughness: 0.04 });
      rec?.secondaries.push({ path: secondary, radius: secondaryRadius });
      leafSpray(secondary, secondaryRadius * 0.5, 6 * mult, bt(0.88, 1.03), 0.7);
      for (let k = 0; k < twigCount; k++) {
        const twigT = 0.18 + (k / twigCount) * 0.72 + bt(-0.025, 0.025);
        const twigOrigin = sample(secondary, twigT);
        const twigAngle = a - 1.08 + (k / Math.max(1, twigCount - 1)) * 2.16 + bt(-0.23, 0.23);
        const twigElevation = bt(-0.75, 0.82);
        const twigReach = hR * (k === 2 ? bt(0.16, 0.36) : bt(LOBE_TWIG_REACH[0], LOBE_TWIG_REACH[1]));
        const twigTarget = center.clone().add(new Vector3(Math.cos(twigAngle) * twigReach, twigElevation * vR, Math.sin(twigAngle) * twigReach));
        twigTarget.y -= bt(0.1, 0.6) * reach;
        // a floored lobe's twigs level off above the floor instead of drooping through it
        if (lobeFloorY !== null) twigTarget.y = Math.max(twigTarget.y, lobeFloorY + 0.35);
        const twig = growthPath(twigOrigin, twigTarget, tangent(secondary, twigT), r, 4, 0.64);
        const twigRadius = Math.max(0.012, secondaryRadius * (1 - twigT) * 0.4);
        const twigLength = Math.max(0.3, twigOrigin.distanceTo(twigTarget));
        tube(wood, twig, taper(twig, twigRadius, 0.004), 3, r, { color: (pt) => barkColor(pt).lerp(twigTip, smoothstep(0.3, 1, pt.distanceTo(twigOrigin) / twigLength) * LOBE_TWIG_TINT), roughness: 0.02 });
        rec?.twigs.push({ path: twig, radius: twigRadius });
        leafSpray(twig, twigRadius * 0.6, 8 * mult, bt(0.9, 1.04), 0.45);
        const sprigPhase = r() * TAU;
        for (let s = 0; s < sprigCount; s++) {
          const sprigT = 0.3 + s * (0.68 / sprigCount);
          const start = sample(twig, sprigT);
          const axis = tangent(twig, sprigT);
          const [u, v] = frame(axis);
          const angle = sprigPhase + s * 2.39996 + bt(-0.25, 0.25);
          const direction = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle)).addScaledVector(axis, 0.36).addScaledVector(UP, -0.12).normalize();
          // short sprigs carry dense leaf clusters; the sub-centimetre sprig wood itself is sub-pixel
          // from the ground and is not built
          const end = start.clone().addScaledVector(direction, bt(0.45, 0.85) * reach);
          leafSpray([start, end], 0.006, 14 * mult, bt(0.9, 1.04), 0.05);
        }
      }
    }
    lobe = null;
    if (rec) {
      rec.farLeaves = leaves.leafCount - leavesBefore;
      rec.farCards = (cards.triangles - cardsBefore) / 2;
      leaves.leafSwapGroup = -1;
      cards.leafSwapGroup = -1;
      nearLobes.push(rec);
    }
    return rec;
  }

  // ---------- big near-horizontal limbs ----------
  let limbs = 0;
  const wildLimbs: { azimuthDeg: number; ghost: boolean }[] = [];
  // where the lowest limb of any kind leaves the bole (the crown leaders start at the fork)
  let bareHeight = fork;
  let limbPath: Vector3[] | undefined;
  let limbS: number[] | undefined;
  let limbRadii: number[] | undefined;
  const limbLobes = (path: Vector3[], baseRadius: number, positions: number[], hR: number, vR: number, upOffset: number, mult = 0.4, cardMult = 1) => {
    for (const s of positions) {
      const origin = sample(path, s);
      const ax = tangent(path, s);
      const [u] = frame(ax);
      const center = origin.clone().addScaledVector(UP, upOffset).addScaledVector(u, bt(-1.2, 1.2)).addScaledVector(ax, bt(0.5, 1.8));
      const bough = growthPath(origin, center, ax.clone().lerp(UP, 0.5), r, 7, 0.7);
      const radius = Math.max(0.06, baseRadius * (1 - s) * 0.42);
      const radii = taper(bough, radius, 0.02);
      tube(wood, bough, radii, 6, r, { color: barkColor, roughness: 0.04 });
      foliateLobe(bough, center, hR, vR, radius, 2, 3, 4, mult, cardMult, false, radii);
    }
  };

  if (o.limbSpec) {
    // authored lantern limb: leaves the trunk axis at `from` height, runs exactly along from→to
    const from = o.limbSpec.from;
    const to = o.limbSpec.to;
    const dir = to.clone().sub(from);
    const len = dir.length();
    dir.normalize();
    const side = new Vector3(-dir.z, 0, dir.x).normalize();
    const r0 = o.limbSpec.radius ?? 0.7;
    const r1 = o.limbSpec.tipRadius ?? 0.25;
    const curved = o.limbSpec.attachHeight !== undefined;
    const attachY = o.limbSpec.attachHeight ?? from.y;
    // the bole's axis where the limb leaves it (the sheared trunk path, like the authored boughs)
    const attach = curved ? sample(trunk, Math.min(0.98, Math.max(0.05, (attachY + skirt) / (fork + skirt)))) : new Vector3(0, attachY, 0);
    attach.y = attachY;
    const path: Vector3[] = [attach.clone()];
    const radii: number[] = [r0 * 1.3];
    bareHeight = Math.min(bareHeight, attachY);
    // nominal advance of each ring along from → to in units of `len` (see GiantAsset.limbS);
    // bookkeeping only — it draws nothing and moves nothing
    const sAlong: number[] = [];
    const n = 16;
    const wigglePhase = r() * TAU;
    // trunk → `from`: the authored waypoint may sit well out along the limb (it marks where the
    // visible, lantern-bearing part begins), so this first reach gets the same organic wiggle
    // and a gentle sag instead of being one straight rod
    const reach = from.clone().sub(attach);
    const reachH = Math.hypot(reach.x, reach.z);
    if (reachH > 1.2) {
      const rn = Math.max(2, Math.ceil(reachH / 0.8));
      const pts: Vector3[] = [];
      if (curved) {
        // cubic: leaves the bole level (a touch upward), arches, droops onto `from` along `dir`
        const t0 = new Vector3(reach.x, 0, reach.z).normalize();
        t0.y = 0.12;
        t0.normalize();
        const c1 = attach.clone().addScaledVector(t0, reachH * 0.33);
        const c2 = from.clone().addScaledVector(dir, -Math.min(4, reachH * 0.3));
        for (let k = 1; k < rn; k++) {
          const s = k / rn;
          const u = 1 - s;
          const p = attach
            .clone()
            .multiplyScalar(u * u * u)
            .addScaledVector(c1, 3 * u * u * s)
            .addScaledVector(c2, 3 * u * s * s)
            .addScaledVector(from, s * s * s);
          const tan = c1.clone().sub(attach).multiplyScalar(3 * u * u).addScaledVector(c2.clone().sub(c1), 6 * u * s).addScaledVector(from.clone().sub(c2), 3 * s * s);
          const rside = new Vector3(-tan.z, 0, tan.x).normalize();
          p.addScaledVector(rside, Math.sin(s * 7 + wigglePhase * 0.7) * 0.14 * Math.sin(s * Math.PI));
          p.y -= 0.1 * Math.sin(s * 11 + wigglePhase) * Math.sin(s * Math.PI);
          pts.push(p);
        }
      } else {
        const rside = new Vector3(-reach.z, 0, reach.x).normalize();
        for (let k = 1; k < rn; k++) {
          const s = k / rn;
          const p = attach.clone().addScaledVector(reach, s);
          p.y = from.y;
          p.addScaledVector(rside, Math.sin(s * 7 + wigglePhase * 0.7) * 0.14 * Math.sin(s * Math.PI));
          p.y += (0.25 * Math.sin(s * Math.PI) - 0.12 * Math.sin(s * 11 + wigglePhase) * Math.sin(s * Math.PI)) * Math.min(1, reachH / 6);
          pts.push(p);
        }
      }
      // s along the reach is its remaining arc length (in units of `len`), so the published path
      // stays metric and monotonic whatever the curve
      const arcs: number[] = [0];
      let prev = attach;
      for (const p of pts) {
        arcs.push(arcs[arcs.length - 1] + p.distanceTo(prev));
        prev = p;
      }
      const total = arcs[arcs.length - 1] + from.distanceTo(prev);
      sAlong.push(-total / len);
      pts.forEach((p, i) => {
        const s = (i + 1) / rn;
        path.push(p);
        radii.push(r0 * 1.3 + (r0 - r0 * 1.3) * Math.pow(s, 0.7));
        sAlong.push(-(total - arcs[i + 1]) / len);
      });
    } else sAlong.push(-reach.length() / len);
    const sag = o.limbSpec.sag ?? 0.16;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const p = from.clone().addScaledVector(dir, len * s);
      p.addScaledVector(side, Math.sin(s * 9 + wigglePhase) * 0.12 * Math.sin(s * Math.PI));
      p.y -= sag * Math.sin(s * Math.PI) + 0.05 * Math.sin(s * 13 + wigglePhase) * Math.sin(s * Math.PI);
      path.push(p);
      radii.push(r0 + (r1 - r0) * Math.pow(s, 0.85));
      sAlong.push(s);
    }
    // short continuation beyond `to`: thinner, barely lifting, so the tip and its cluster stay at
    // the bough's own height (the reference bough ends in a small leaf cluster just past the last
    // pod, not in a crown that climbs into the upper-left of shot A)
    const tail = 3;
    const tailLen = o.limbSpec.tail ?? 1.8;
    for (let k = 1; k <= tail; k++) {
      const s = k / tail;
      const p = to
        .clone()
        .addScaledVector(dir, tailLen * s)
        .addScaledVector(UP, 0.14 * tailLen * s * s)
        .addScaledVector(side, 0.22 * tailLen * s);
      path.push(p);
      radii.push(r1 * (1 - 0.72 * s));
      sAlong.push(1 + (tailLen * s) / len);
    }
    ghost = o.limbSpec.ghost ?? false;
    tube(wood, path, radii, 14, r, { color: barkColor, roughness: 0.05, bump: gnarlBump(1.8, 0.1), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    limbPath = path;
    limbS = sAlong;
    limbRadii = radii.slice();
    limbs++;
    // foliage rides on top of the limb (lanterns hang below it) as separate small clusters —
    // the bough itself stays readable between them, with haze showing through. The outer cluster
    // sits at 0.6 (world x ≈ −1.4): from camera A that is the top-left corner, where the
    // reference has near foliage, not the upper-left band, where it has only veiled far trees. It
    // is a wide, loose lobe: from F it is the near roof at the centre-right of the frame and keeps
    // the canopy there closed now that the old tip clusters are gone.
    const lf = o.limbFoliage ?? 1;
    limbLobes(path, r0, [0.32, 0.6], 1.4 + 0.9 * lf, 0.7 + 0.45 * lf, 1.0 + 0.4 * lf, 0.4 * lf, lf);
    // small end cluster riding just above the tip
    const endCenter = path[path.length - 1].clone().addScaledVector(UP, 0.2 + 0.3 * lf).addScaledVector(dir, 0.6);
    const endBough = growthPath(path[path.length - 2], endCenter, dir, r, 5, 0.5);
    tube(wood, endBough, taper(endBough, 0.09, 0.02), 5, r, { color: barkColor, roughness: 0.03 });
    foliateLobe(endBough, endCenter, 0.8 + 0.7 * lf, 0.45 + 0.35 * lf, 0.09, lf < 0.7 ? 2 : 3, 3, lf < 0.7 ? 3 : 4, 0.35 * lf, lf);
    ghost = false;
  }

  // ---------- authored boughs (e.g. the pair reaching over Saria's roof) ----------
  for (const spec of o.boughs ?? []) {
    const woodGhost = spec.ghostWood ?? false;
    const tTrunk = Math.min(0.98, Math.max(0.05, (spec.fromHeight + skirt) / (fork + skirt)));
    const origin = sample(trunk, tTrunk);
    origin.y = spec.fromHeight;
    if (!woodGhost) bareHeight = Math.min(bareHeight, origin.y);
    const to = spec.to;
    const dir = to.clone().sub(origin);
    const len = dir.length();
    const horiz = new Vector3(dir.x, 0, dir.z).normalize();
    const side = new Vector3(-horiz.z, 0, horiz.x);
    const r0 = spec.radius;
    const r1 = spec.tipRadius ?? r0 * 0.35;
    const path: Vector3[] = [origin.clone()];
    const radii: number[] = [r0 * 1.35];
    const n = 14;
    const wigglePhase = r() * TAU;
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      // leaves the trunk almost level, arches a little, then droops onto the target
      const p = origin.clone().addScaledVector(horiz, Math.hypot(dir.x, dir.z) * s);
      p.y = origin.y + (to.y - origin.y) * s * s + 0.35 * len * 0.06 * Math.sin(s * Math.PI);
      p.addScaledVector(side, Math.sin(s * 7 + wigglePhase) * 0.09 * len * 0.12 * Math.sin(s * Math.PI));
      path.push(p);
      radii.push(r0 + (r1 - r0) * Math.pow(s, 0.85));
    }
    const tail = 3;
    for (let k = 1; k <= tail; k++) {
      const s = k / tail;
      const p = to.clone().addScaledVector(horiz, 2.4 * s).addScaledVector(UP, 1.1 * s * s).addScaledVector(side, 0.4 * s);
      path.push(p);
      radii.push(r1 * (1 - 0.7 * s));
    }
    ghost = woodGhost;
    // the sweep's draws taken here (exactly what tube() draws) so the near dressing can replay
    // its ridge for the bark sleeve (nearCanopy.ts NearLimbRecord.sleeve)
    const limbDraws = consumeTubeDraws(r, 12);
    const limbBump = gnarlBump(1.7, 0.11);
    tube(wood, path, radii, 12, r, { color: barkColor, roughness: 0.06, bump: limbBump, creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff, draws: limbDraws });
    recordLimb(path, radii, { draws: limbDraws, bump: limbBump, roughness: 0.06, barkTile: 1.2 });
    ghost = false;
    if (!woodGhost) limbs++;
    // `foliage` thins only the outer third + tip (the part that reaches into the hero frames); the
    // lobes near the trunk keep their full roof density
    const bf = spec.foliage ?? 1;
    const bd = spec.density ?? 1;
    limbLobes(path, r0, [0.42, 0.64], 2.7, 1.3, 1.7, 0.62 * bd, bd);
    limbLobes(path, r0, [0.84], 2.7 * bf, 1.3 * bf, 1.1 + 0.6 * bf, 0.62 * bf * bd, bf * bd);
    const endCenter = path[path.length - 1].clone().addScaledVector(UP, 1.1 * bf).addScaledVector(horiz, 0.9);
    const endBough = growthPath(path[path.length - 2], endCenter, horiz, r, 5, 0.5);
    ghost = woodGhost;
    tube(wood, endBough, taper(endBough, r1 * 0.6, 0.02), 5, r, { color: barkColor, roughness: 0.03 });
    ghost = false;
    foliateLobe(endBough, endCenter, 2.9 * bf, 1.4 * bf, r1 * 0.6, bf < 0.7 ? 2 : 3, 3, bf < 0.7 ? 3 : 4, 0.62 * bf * bd, bf * bd);
  }

  const extraLimbs = profile.wildLimbs ?? (o.limbSpec ? 2 : r.int(2, 4));
  const drawnLimbAngle = o.limbSpec ? Math.atan2(o.limbSpec.to.z - o.limbSpec.from.z, o.limbSpec.to.x - o.limbSpec.from.x) : r() * TAU;
  const limbBaseAngle = profile.wildLimbAzimuthDeg === undefined ? drawnLimbAngle : (profile.wildLimbAzimuthDeg * Math.PI) / 180;
  // which wild limbs are ghosted: all of them, or (sector form) those whose nominal azimuth (before
  // the ±20° jitter drawn below) lies in the sector, nearest its centre first, never so many that
  // the giant ends with fewer than two big limbs (W09) counting the authored limb and boughs
  // already built and the spread limbs and canopy boughs built after this
  const ghostSet = new Set<number>();
  const ghostSpec = profile.wildLimbGhost;
  const otherLimbs = limbs + (profile.spread?.length ?? 0) + (o.canopyBoughs?.length ?? 0);
  const keepLimbs = Math.max(0, 2 - otherLimbs);
  if (ghostSpec === true) for (let i = 0; i < Math.max(0, extraLimbs - keepLimbs); i++) ghostSet.add(i);
  else if (ghostSpec) {
    const centre = (ghostSpec.azimuthDeg * Math.PI) / 180;
    const half = (ghostSpec.halfWidthDeg * Math.PI) / 180;
    const off = (i: number) => {
      const a = limbBaseAngle + ((i + 1) / (extraLimbs + 1)) * TAU;
      let d = (a - centre) % TAU;
      if (d < 0) d += TAU;
      return Math.min(d, TAU - d);
    };
    const candidates = Array.from({ length: extraLimbs }, (_, i) => i)
      .filter((i) => off(i) <= half)
      .sort((i, j) => off(i) - off(j));
    for (const i of candidates.slice(0, Math.max(0, extraLimbs - keepLimbs))) ghostSet.add(i);
  }
  for (let i = 0; i < extraLimbs; i++) {
    ghost = ghostSet.has(i);
    const a = limbBaseAngle + ((i + 1) / (extraLimbs + 1)) * TAU + bt(-0.35, 0.35);
    const t = bt(profile.wildLimbT?.[0] ?? 0.36, profile.wildLimbT?.[1] ?? 0.62);
    const origin = sample(trunk, t);
    wildLimbs.push({ azimuthDeg: Math.round((((a * 180) / Math.PI) % 360 + 360) % 360), ghost });
    if (!ghost) bareHeight = Math.min(bareHeight, origin.y);
    const trunkR = trunkRadii[Math.round(t * (trunkRadii.length - 1))];
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new Vector3(-dir.z, 0, dir.x);
    const elev = bt(0.12, 0.3);
    const length = bt(7, 11) * (R / 1.5);
    const sag = bt(0.6, 1.6);
    const path: Vector3[] = [];
    const n = 11;
    const wigglePhase = r() * TAU;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const p = origin
        .clone()
        .addScaledVector(dir, length * s)
        .addScaledVector(UP, length * elev * s - sag * s * s)
        .addScaledVector(side, Math.sin(s * 6 + wigglePhase) * 0.08 * length * s);
      path.push(p);
    }
    const r0 = Math.max(0.55, trunkR * bt(0.3, 0.42));
    const limbRadii = taper(path, r0, 0.1, 0.9);
    const limbDraws = consumeTubeDraws(r, 12);
    const limbBump = gnarlBump(1.6, 0.12);
    tube(wood, path, limbRadii, 12, r, { color: barkColor, roughness: 0.06, bump: limbBump, creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff, draws: limbDraws });
    recordLimb(path, limbRadii, { draws: limbDraws, bump: limbBump, roughness: 0.06, barkTile: 1.2 });
    if (!ghost) limbs++;
    limbLobes(path, r0, [0.5, 0.78, 1.0], crownRadius * bt(0.2, 0.26), H * 0.07, bt(1.5, 2.5));
  }
  ghost = false;

  // ---------- crown ----------
  const leaders = r.int(4, 6);
  const weights = Array.from({ length: leaders }, () => bt(0.65, 1.2));
  const total = weights.reduce((s, w) => s + w, 0);
  const topRadius = trunkRadii[trunkRadii.length - 1];
  for (let i = 0; i < leaders; i++) {
    const origin = sample(trunk, i === 0 ? 1 : bt(0.93, 0.995));
    // the crown leaders are limbs too: the bare bole ends at the lowest of them (stair-bank-giant
    // published 10.72 m with a leader at 10.04 - Astra's review of 7eba56e)
    bareHeight = Math.min(bareHeight, origin.y);
    const angle = leanAz + (i / leaders) * TAU + bt(-0.35, 0.35);
    const radial = crownRadius * bt(0.35, 0.58);
    const target = new Vector3(Math.cos(angle) * radial, H * bt(0.76, 0.92), Math.sin(angle) * radial);
    // phototropism: the whole crown shifts toward the clearing
    target.addScaledVector(toPlaza, plazaBias * crownRadius * bt(0.12, 0.28));
    const path = divergingLeaderPath(origin, target, r, 14);
    const radius = topRadius * Math.sqrt(weights[i] / total) * 1.15;
    tube(wood, path, taper(path, radius, 0.06, 0.88), 10, r, { color: barkColor, roughness: 0.05, bump: gnarlBump(2, 0.08), creviceShade: 1.5, barkTile: 1.2, structural: true });
    const boughs = r.int(3, 5);
    for (let j = 0; j < boughs; j++) {
      const t = 0.3 + (j / Math.max(1, boughs - 1)) * 0.62 + bt(-0.03, 0.03);
      const bOrigin = sample(path, t);
      const inward = j >= 2 && j % 2 === 0;
      const ba = angle + (j === 0 ? -0.9 : j === 1 ? 0.85 : j === 2 ? 1.6 : j === 3 ? -0.1 : -1.6) + bt(-0.3, 0.3);
      const bRadial = crownRadius * (inward ? bt(0.15, 0.35) : bt(0.6, 0.95));
      // lobes span 0.58–0.92 H (≈ 14–24 m) so the crown roofs the clearing rather than floating above it
      const lobeY = H * (j === 0 ? bt(0.58, 0.68) : j === 1 ? bt(0.66, 0.76) : inward ? bt(0.82, 0.92) : bt(0.72, 0.84));
      const center = new Vector3(Math.cos(ba) * bRadial, lobeY, Math.sin(ba) * bRadial);
      center.addScaledVector(toPlaza, plazaBias * crownRadius * bt(0.15, 0.35));
      const end = center.clone().add(new Vector3(bt(-0.5, 0.5), bt(-0.6, 0.1), bt(-0.5, 0.5)));
      const bough = growthPath(bOrigin, end, tangent(path, t), r, 10, 0.7);
      const bRadius = Math.max(0.09, radius * Math.pow(1 - t, 0.7) * bt(0.5, 0.7));
      tube(wood, bough, taper(bough, bRadius, 0.03, 1.0), 6, r, { color: barkColor, roughness: 0.04 });
      const hR = crownRadius * bt(0.27, 0.36);
      const vR = H * bt(0.08, 0.11);
      foliateLobe(bough, center, hR, vR, bRadius);
    }
  }

  // ---------- authored spreading limbs ----------
  // Built after everything else from their own stream, so adding or editing one never re-rolls the
  // trunk, roots, wild limbs or crown above (the crown's shadows are tuned per hero frame).
  const rs = r.fork('spread');
  for (const spec of profile.spread ?? []) {
    const az = (spec.azimuthDeg * Math.PI) / 180;
    const dir = new Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new Vector3(-dir.z, 0, dir.x);
    const tTrunk = Math.min(0.98, Math.max(0.05, (spec.height + skirt) / (fork + skirt)));
    const origin = sample(trunk, tTrunk);
    origin.y = spec.height;
    bareHeight = Math.min(bareHeight, origin.y);
    const trunkR = trunkRadii[Math.round(tTrunk * (trunkRadii.length - 1))];
    const r0 = spec.radius ?? Math.max(0.5, trunkR * 0.42);
    const length = spec.length;
    const sag = length * length * 0.007;
    const n = 12;
    const wigglePhase = rs() * TAU;
    const path: Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      // leaves the bole from inside its radius so the collar reads as a fork, not a peg
      const run = -trunkR * 0.5 + (length + trunkR * 0.5) * s;
      const p = origin
        .clone()
        .addScaledVector(dir, run)
        .addScaledVector(UP, length * spec.rise * s - sag * s * s)
        .addScaledVector(side, Math.sin(s * 5.5 + wigglePhase) * 0.07 * length * s);
      path.push(p);
    }
    const spreadRadii = taper(path, r0, 0.08, 0.85);
    const spreadDraws = consumeTubeDraws(rs, 12);
    const spreadBump = gnarlBump(1.6, 0.12);
    tube(wood, path, spreadRadii, 12, rs, { color: barkColor, roughness: 0.06, bump: spreadBump, creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff, draws: spreadDraws });
    recordLimb(path, spreadRadii, { draws: spreadDraws, bump: spreadBump, roughness: 0.06, barkTile: 1.2 });
    limbs++;
    const lf = spec.foliage ?? 1;
    const ld = spec.density ?? 1;
    const lift = spec.lift ?? 1;
    if (lf > 0) {
      const hR = (1.9 + 0.6 * lf) * Math.min(1.15, length / 8);
      lobeFloorY = spec.floor ?? null;
      limbLobes(path, r0, [0.48, 0.74, 0.98], hR, hR * 0.52, (1.2 + 0.6 * lf) * lift, 0.4 * lf * ld, lf * ld);
      lobeFloorY = null;
    }
  }

  // ---------- authored canopy boughs ----------
  // Built after everything else from their own stream (the lobe foliage draws from the main stream,
  // but nothing is generated after it), so the tree above is identical with or without them.
  const rcb = r.fork('canopy-bough');
  const lobeLeafCounts: number[] = [];
  const boughDressAudit: GiantAsset['boughDress'] = [];
  let boughIndex = 0;
  /**
   * One canopy bough from stream `rcb` into the current writers (`wood`, `leaves` / `cards` as
   * rebound per lobe). `into` = the detached target (round 50): every lamina and card goes to its
   * writers whatever the lobe's castShadow / flat, the dress noise is keyed by `noiseKey`, and
   * nothing is recorded on the tree (limbs, bare height, lobe leaf counts, dress audit — the
   * caller gets those back in the return value instead).
   */
  const buildCanopyBough = (
    spec: CanopyBough,
    rcb: Rng,
    noiseKey: string,
    into?: { leaves: GeometryWriter; cards: GeometryWriter },
  ): { lobes: { center: Vector3; hR: number; vR: number; leaves: number }[]; dress: GiantAsset['boughDress'] } => {
    const builtLobes: { center: Vector3; hR: number; vR: number; leaves: number }[] = [];
    const dressAudit: GiantAsset['boughDress'] = [];
    const tTrunk = Math.min(0.98, Math.max(0.05, (spec.fromHeight + skirt) / (fork + skirt)));
    const origin = sample(trunk, tTrunk);
    origin.y = spec.fromHeight;
    if (!into) bareHeight = Math.min(bareHeight, origin.y);
    const to = spec.to;
    const run = Math.hypot(to.x - origin.x, to.z - origin.z);
    const horiz = new Vector3(to.x - origin.x, 0, to.z - origin.z).normalize();
    const side = new Vector3(-horiz.z, 0, horiz.x);
    const r0 = spec.radius;
    const r1 = spec.tipRadius ?? r0 * 0.35;
    const path: Vector3[] = [origin.clone()];
    const radii: number[] = [r0 * 1.35];
    const n = 16;
    const wigglePhase = rcb() * TAU;
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      // a weight-bearing limb: level off the trunk, then an ever-steeper droop onto the target
      const p = origin.clone().addScaledVector(horiz, run * s);
      p.y = origin.y + (to.y - origin.y) * Math.pow(s, 1.7) + 0.02 * run * Math.sin(s * Math.PI);
      p.addScaledVector(side, Math.sin(s * 6 + wigglePhase) * 0.012 * run * Math.sin(s * Math.PI));
      path.push(p);
      radii.push(r0 + (r1 - r0) * Math.pow(s, 0.85));
    }
    ghost = !into && spec.ghostWood === true;
    // the plain sweep's draws are taken up front either way, so a dressed bough leaves the stream
    // exactly where the plain one did
    const boughDraws = consumeTubeDraws(rcb, 12);
    const boughBump = gnarlBump(1.7, 0.11);
    if (spec.dress && !ghost) {
      const dress = spec.dress;
      const axisAt = sweepAxisAt(path, radii);
      const total = axisAt(0).total;
      const knees: BoleKnee[] = (dress.knees ?? []).map((k) => {
        const distance = k.s * total;
        const { u, v } = axisAt(distance);
        const toward = UP.clone().multiplyScalar(k.up).addScaledVector(side, k.side).normalize();
        return { distance, azimuth: Math.atan2(toward.dot(v), toward.dot(u)), reach: k.reach, halfWidth: k.halfWidth, stubLength: k.stubLength, stubRadius: k.stubRadius, stubPitch: k.stubPitch };
      });
      const dressNoise = new Noise2D(`bough-relief/${def.id}/${noiseKey}`);
      const mossStrength = dress.moss ?? 0.8;
      const built = reliefBole(wood, path, radii, {
        color: barkColor,
        bump: knees.length ? (angle, distance) => boughBump(angle, distance) * kneeBump(knees, angle, distance) : boughBump,
        creviceShade: 1.8,
        barkTile: 1.2,
        roughness: 0.06,
        sides: 22,
        spacing: 0.4,
        denseUntilY: Infinity,
        amplitude: Math.max(0.04, Math.min(0.12, 0.11 * Math.sqrt(r0 / 1.2))) * (dress.relief ?? 1),
        pitch: 0.34,
        fadeY: [1e4, 2e4],
        farShare: 1,
        refRadius: r0,
        noise: dressNoise,
        draws: boughDraws,
        stiffness: stiff,
        mossBand: [-100, -99],
        // the moss sheet along the upper side: strongest where the surface faces up, its edge
        // ragged by a metre-scale field so it ends in tongues, thinning toward the tip
        mossExtra: (p, upness) => {
          const edge = dressNoise.fbm(p.x * 0.9 + 3.1, p.z * 0.9 + p.y * 0.6, 3);
          const along = 1 - smoothstep(0.7 * total, total, Math.hypot(p.x - origin.x, p.z - origin.z) / Math.max(1e-3, run) * total);
          return smoothstep(0.42, 0.78, upness * 0.75 + 0.5 * (0.5 + 0.5 * edge)) * mossStrength * along;
        },
        lichen: { band: [-100, 1e4], strength: dress.lichen ?? 0.7 },
      });
      dressAudit.push({ giant: def.id, relief: built.amplitude, rings: built.rings, sides: built.sides, knees: knees.length, triangles: built.triangles });
      const krng = rcb.fork('bough-knees');
      for (const knee of knees) kneeStub(wood, knee, axisAt(knee.distance).radius, axisAt, barkColor, krng, dressNoise, mossStrength * 0.8);
    } else {
      tube(wood, path, radii, 12, rcb, { color: barkColor, roughness: 0.06, bump: boughBump, creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff, draws: boughDraws });
    }
    if (!ghost && !into) limbs++;
    ghost = false;
    for (const lobeSpec of spec.lobes) {
      const at = sample(path, lobeSpec.t);
      const ax = tangent(path, lobeSpec.t);
      const toCenter = lobeSpec.center.clone().sub(at);
      const hanging = toCenter.y < -0.5;
      // shade lobes leave the bough upward like the wild-limb lobes; curtains leave it along the
      // wood and then swing down under their own weight
      const parentDir = hanging ? ax.clone().lerp(UP.clone().negate(), 0.35).normalize() : ax.clone().lerp(UP, 0.5);
      const stem = growthPath(at, lobeSpec.center, parentDir, rcb, 7, 0.6);
      const stemRadius = Math.max(0.07, r0 * (1 - lobeSpec.t * 0.6) * 0.34);
      tube(wood, stem, taper(stem, stemRadius, 0.02), 6, rcb, { color: barkColor, roughness: 0.04 });
      const d = lobeSpec.density ?? 1;
      // a non-casting lobe's laminae go to their own writer (the leaf helpers read `leaves` at
      // call time); the leaf ordinal is one sequence across both writers, so every lamina's
      // detail pick is what it was when all of them shared one writer
      leaves = into ? into.leaves : lobeSpec.castShadow === false ? authoredLeaves : treeLeaves;
      if (!into) leaves.leafOrdinal = Math.max(treeLeaves.leafOrdinal, authoredLeaves.leafOrdinal);
      // a flat lobe's cards go to their own (non-casting) writer, and every leaf and card of it
      // is written flat (writer.ts leafFlat)
      lobeFlat = lobeSpec.flat === true;
      cards = into ? into.cards : lobeFlat ? authoredCards : treeCards;
      leaves.leafFlat = cards.leafFlat = lobeFlat;
      eyeOverride = lobeSpec.eye ?? null;
      lobeTone = lobeSpec.tone ?? 1;
      leaves.leafShade = cards.leafShade = lobeSpec.shade ?? 1;
      corridorExempt = lobeSpec.corridors === false;
      lobeFloorY = lobeSpec.floor ?? null;
      // a curtain's arms leave the last ~30 % of its long drop (foliateLobe attaches them at
      // 0.4–0.88 of the path it is given: here 0.83–0.97 of the stem, within 0.7 m of the centre),
      // so the leaves gather around the authored centre instead of trailing up towards the bough;
      // a compact clump does the same whichever way its stem runs
      const lobePath = hanging || lobeSpec.compact ? stem.slice(stem.length - 3) : stem;
      const leavesBefore = leaves.leafCount;
      const lobeVertexStart = leaves.positions.length / 3;
      const lobeRec = foliateLobe(lobePath, lobeSpec.center, lobeSpec.hR, lobeSpec.vR, stemRadius, 3, 4, 4, 0.55 * d, d, lobeSpec.compact === true);
      if (into) builtLobes.push({ center: lobeSpec.center.clone(), hR: lobeSpec.hR, vR: lobeSpec.vR, leaves: leaves.leafCount - leavesBefore });
      else lobeLeafCounts.push(leaves.leafCount - leavesBefore);
      if (lobeFlat && lobeSpec.core) {
        // the core and its rim cards are the lobe's far foliage too: tagged with the same group
        // so they fold with the laminae while the near version is drawn (round 44)
        const cardsBefore = cards.triangles;
        if (lobeRec) leaves.leafSwapGroup = cards.leafSwapGroup = lobeRec.group;
        const coreVertexStart = leaves.positions.length / 3;
        lobeCore(lobeSpec.center, lobeSpec.hR, lobeSpec.vR, lobeSpec.core);
        if (lobeSpec.layeredCore && lobeRec) {
          const bounds = new Box3();
          for (let v = lobeVertexStart; v < leaves.positions.length / 3; v++) {
            const p = new Vector3().fromArray(leaves.positions, v * 3);
            bounds.expandByPoint(p);
            if (v < coreVertexStart) continue;
            // Save the old float32 positions for exact conservative mesh culling bounds.
            originalCorePositions.push(new Vector3(Math.fround(p.x), Math.fround(p.y), Math.fround(p.z)));
            p.sub(lobeSpec.center).multiplyScalar(0.6).add(lobeSpec.center);
            leaves.positions.splice(v * 3, 3, p.x, p.y, p.z);
          }
          lobeRec.layeredCore = { ...lobeSpec.layeredCore, bounds, tone: lobeSpec.tone ?? 1 };
        }
        if (lobeRec) {
          leaves.leafSwapGroup = cards.leafSwapGroup = -1;
          lobeRec.farCards += (cards.triangles - cardsBefore) / 2;
        }
      }
      eyeOverride = null;
      lobeTone = 1;
      leaves.leafShade = cards.leafShade = 1;
      leaves.leafFlat = cards.leafFlat = false;
      lobeFlat = false;
      corridorExempt = false;
      lobeFloorY = null;
      leaves = treeLeaves;
      cards = treeCards;
    }
    return { lobes: builtLobes, dress: dressAudit };
  };
  for (const spec of o.canopyBoughs ?? []) {
    const built = buildCanopyBough(spec, rcb, `${boughIndex}`);
    boughDressAudit.push(...built.dress);
    boughIndex++;
  }

  // ---------- near canopy (nearCanopy.ts) ----------
  // Every part is built after the whole far tree, from its own forked stream into its own writer,
  // so the far tree is exactly what it was with the LOD off (the near base's rule). The near
  // wood forks on from the far wood as recorded (the stems, secondaries and twigs stay drawn at
  // every distance — only the far laminae and cards of the lobe are swapped out), so the lobe
  // reads as one branch system: bough → secondary → twig → twiglet → spray.
  const nearCanopy: NearCanopyPart[] = [];
  if (near && (nearLobes.length || nearLimbs.length)) {
    /** the far leaf colour rule (leafSpray) for a lamina at `base` in a lobe about `center`, from stream g */
    const nearLeafColor = (g: Rng, base: Vector3, center: Vector3, hR: number, vigor: number) => {
      const gb = (a: number, b: number) => between(g, a, b);
      const heightF = base.y / H;
      const outF = Math.hypot(base.x, base.z) / crownRadius;
      const sun = Math.min(1, Math.max(0, (heightF - 0.55) * 2.0 + outF * 0.3)) * gb(0.3, 1);
      const interior = smoothstep(0.85, 0.3, base.distanceTo(center) / Math.max(0.5, hR));
      // the lobe's underside hangs in its own shade: a little cooler and darker than its crown
      const under = smoothstep(0.1, -0.6, (base.y - center.y) / Math.max(0.4, hR * 0.5));
      const coolWarm = gb(0, 1) < 0.5 ? cool : warm;
      return canopy
        .clone()
        .multiplyScalar(0.92)
        .lerp(sunny, sun * (1 - interior * 0.7))
        .lerp(coolWarm, gb(0, 0.3))
        .lerp(cool, under * 0.25)
        .multiplyScalar(vigor * (1 - interior * 0.32) * (1 - under * 0.12));
    };
    const kit = createNearCanopyKit({ id: `giant-${def.id}`, barkColor, leafColor: nearLeafColor, canopy });
    nearLobes.forEach((rec, idx) => nearCanopy.push(kit.lobePart(r, rec, idx, near.defer)));
    nearLimbs.forEach((limb, idx) => nearCanopy.push(kit.limbPart(r, limb, idx)));
  }

  // ---------- detached boughs (round 50, trees-32) ----------
  // Last of all, into writers of their own from their own stream: the tree above, its near
  // canopy and every audit number are what they were without them (see GiantAsset.detached).
  let detached: GiantAsset['detached'] = null;
  if (o.detachedBoughs?.length) {
    const dWood = new GeometryWriter('high');
    const dLeaves = new GeometryWriter('high');
    const dCards = new GeometryWriter('high');
    dLeaves.leafOrdinal = Math.max(treeLeaves.leafOrdinal, authoredLeaves.leafOrdinal);
    const rdb = r.fork('detached-bough');
    wood = dWood;
    detachedMode = true;
    const dLobes: NonNullable<GiantAsset['detached']>['lobes'] = [];
    const dDress: GiantAsset['boughDress'] = [];
    o.detachedBoughs.forEach((spec, i) => {
      const built = buildCanopyBough(spec, rdb.fork(i), `detached-${i}`, { leaves: dLeaves, cards: dCards });
      dLobes.push(...built.lobes);
      dDress.push(...built.dress);
    });
    wood = treeWood;
    detachedMode = false;
    detached = {
      wood: dWood.finish(`giant-detached-wood-${def.id}`),
      leaves: dLeaves.finish(`giant-detached-leaves-${def.id}`),
      cards: dCards.finish(`giant-detached-cards-${def.id}`),
      woodTriangles: dWood.triangles,
      leafCount: dLeaves.leafCount,
      leafTriangles: dLeaves.triangles,
      cardCount: dCards.triangles / 2,
      lobes: dLobes,
      dress: dDress,
    };
  }

  const authoredGeometry = authoredLeaves.finish(`giant-authored-leaves-${def.id}`);
  if (originalCorePositions.length) {
    // Recession must not shrink the authored mesh's old visibility volume.
    for (const p of originalCorePositions) authoredGeometry.boundingBox!.expandByPoint(p);
    const sphere = authoredGeometry.boundingSphere!;
    authoredGeometry.boundingBox!.getCenter(sphere.center);
    let radiusSq = 0;
    const p = new Vector3(), position = authoredGeometry.getAttribute('position');
    for (let v = 0; v < position.count; v++) radiusSq = Math.max(radiusSq, p.fromBufferAttribute(position, v).distanceToSquared(sphere.center));
    for (const old of originalCorePositions) radiusSq = Math.max(radiusSq, old.distanceToSquared(sphere.center));
    sphere.radius = Math.sqrt(radiusSq);
  }
  return {
    geometry: mergeParts(`giant-${def.id}`, [treeWood.finish('wood'), treeLeaves.finish('leaves')]),
    authoredLeaves: authoredGeometry,
    cards: treeCards.finish(`giant-cards-${def.id}`),
    authoredCards: authoredCards.finish(`giant-authored-cards-${def.id}`),
    cardCount: treeCards.triangles / 2,
    authoredCardCount: authoredCards.triangles / 2,
    leafCount: treeLeaves.leafCount + authoredLeaves.leafCount,
    authoredLeafCount: authoredLeaves.leafCount,
    lobeLeafCounts,
    woodTriangles: treeWood.triangles,
    leafTriangles: treeLeaves.triangles + authoredLeaves.triangles,
    limbs,
    wildLimbs,
    roots: rootCount,
    contacts,
    limbPath,
    limbS,
    limbRadii,
    crownRadius,
    trunkPath: trunk,
    trunkRadii,
    bareHeight,
    bark: barkAudit,
    nearBase,
    nearBaseBuild,
    nearBaseAudit,
    boleRings: treeWood.trunkRows
      .map((row) => row.map((i) => new Vector3(treeWood.positions[i * 3], treeWood.positions[i * 3 + 1], treeWood.positions[i * 3 + 2])))
      .filter((ring) => ring.length && ring[0].y < 8),
    boughDress: boughDressAudit,
    coreRimCards,
    nearCanopy,
    nearCanopyGroups: nearGroups,
    nearCanopyHeroKept: nearTally.kept,
    nearCanopyHeroLimited: nearTally.limited,
    detached,
  };
}
