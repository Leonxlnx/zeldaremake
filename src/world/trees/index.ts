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
import { createGiantTree, type CanopyBough, type GiantAsset, type GiantProfile } from './giant';
import type { GiantTreeDef } from '../layout';
import { createDistantVariants, placeDistantTrees, type DepthBand, type DistantPlacement, type DistantVariant } from './distant';
import { mergeParts, type Detail } from './writer';
import type { ViewGap } from './placement';
import { SHAFT_COLUMNS } from './corridors';

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
  { giant: 'plateau-oak', to: [12.5, 9.0, -11.5] as [number, number, number], fromHeight: 6.6, radius: 0.62, foliage: 1 },
  { giant: 'plateau-oak', to: [15.4, 10.4, -8.4] as [number, number, number], fromHeight: 8.1, radius: 0.48, foliage: 1 },
  // sparse: this bough crosses the upper-left of shot A, where the reference shows a bare limb
  // with a few leaf clusters and open haze between them. Its height is load-bearing for shot B:
  // the lobes' shadows are the shaded band across B's mid path (z −5…−8); raised to 10.6 m they
  // slid off the path and B's foreground measured 0.58 against the reference's 0.48.
  { giant: 'lantern-tree', to: [3.0, 8.6, -14.0] as [number, number, number], fromHeight: 6.8, radius: 0.6, foliage: 0.5 },
];
/**
 * Per-tree shape overrides (see GiantProfile in giant.ts).
 * north-west-near: 9 m from camera D at the left edge of shots B/D. With the generic flare and 4–7 m
 *   roots it filled D's x 0–0.22 with a flared base; the reference trunk there is ≈ 0.12 wide, so the
 *   bole is slimmer with a light flare and short roots. No extra random draws: its limbs and crown
 *   (whose shadows sit near the D/B paths) are the same as without the profile.
 * plaza-south: the centre tree of shot C (20 m past camera C, seen from the north). The reference
 *   trunk forks at ≈ 6 m into two big leaders rising left and right (east/west — perpendicular to
 *   the C axis) whose leaf lobes form the hazed dark band across the top of the frame; C's frame
 *   top is only ≈ 9 m up at that distance, so the generic 14–24 m crown is invisible there. No wild
 *   limbs: a random low limb from this trunk pointing north crosses the top-right of shot F and
 *   the right edge of shot A a few metres from those cameras.
 * east-giant: 24 m east of camera F at the right edge of shot F, standing on the 5.4 m plateau.
 *   Two low limbs reach west over the plateau lip toward the stair top, at 6.5–9 m, wrapped in
 *   dense lobes: the dark leaf mass across the top-right of reference F (x 0.6–1.0, y 0–0.2) just
 *   above the fence line. Off-frame for B/C/D; A sees only their tips at its top-right corner. Their
 *   shadows fall east of x ≈ 22, outside every frame.
 */
const GIANT_PROFILES: Record<string, GiantProfile> = {
  // slim bole (reads ≈0.13 of the frame at D's left edge with layout radius 1.1). The sun ray from
  // Link's head at D (0.86, 1.3, −7.68) passes 0.43 m from this bole's axis 7.4 m up, so the bole
  // shaded Link himself and his shadow never showed (see LINK_SHADOW_RAYS). Wood cannot be carved,
  // so the bole bends out of the ray: it stands straight to ≈ 1.5 m, curves over 1.5–5.5 m and
  // runs on at 45° toward azimuth 245° (WSW, ≈ 7° off camera D's left frame edge, which runs at
  // 238°). D frames this trunk only up to ≈ 5.9 m, so what it sees is the same full-height column
  // the layout put at its left edge (x 0.00–0.13; the ray demands the bole be ≥ 2.3 m from its
  // upright position by 7 m up, which a lean from the ground could only do by sliding the framed
  // part right and leaving a bright strip along the frame edge — 24° from the base cost D 0.009
  // SSIM in the two left-edge cells). Where the two lines cross (≈ 8 m up) the axis clears the ray
  // by ≈ 2 m of bark. Seen from no other hero camera (B: just off the left edge, leaning away).
  // Its bole shadow moves from Link's slabs to the path 3 m north of him. The wild limbs leave
  // higher (t 0.5–0.62 ≈ 5.7–7.4 m) and away from the ray's side: the gap in the spread is
  // centred on azimuth 60° (SSE, where the ray climbs past the trunk toward Link), so they head
  // SW / WNW / NNE — the reference D shows this trunk's boughs high at the top-left, not a limb
  // crossing the upper-left quarter at y 0.1–0.3 as the random draw gave.
  'north-west-near': {
    flare: 0.12,
    girth: 0.7,
    rootReach: 0.5,
    rootGirth: 0.7,
    lean: { azimuthDeg: 245, degrees: 45, fromY: 3.5, blend: 2 },
    wildLimbAzimuthDeg: 60,
    wildLimbT: [0.5, 0.62],
  },
  // The lantern tree's bole is outside every hero frame (its limb and crown are the hero parts),
  // but its shadow is not: the bole 8–14 m up shaded a 2 m band diagonally across the plaza's
  // brightest reference patch (world (1, 2.6) → (3.6, 4.7), shot A (0.3–0.55, 0.75–0.95)), and
  // the sun ray from Link's head at A (see LINK_SHADOW_RAYS) met the axis 0.78 m off, 0.9 m under
  // the fork, whose leader bundle is ≈ 1.4 m thick. Sheared 20° toward azimuth 128° (SSW, the
  // ray's own side, so the axis crosses it and ends 4.4 m beyond: the sun probe from Link's head
  // sees the bark ≈ 2.3 m off the ray), the bole shadow band lands at (−3, 3.7) → (−1.6, 5.7):
  // past shot A's left edge and frame bottom, behind cameras B/F. The opposite shear (330°,
  // 11–14°) also cleared the bole but dropped the band onto the second plaza core at (4.0, 1.8) —
  // the reference's brightest flagstones around Link. What the ray still meets is crown wood: the
  // lowest leader boughs (15–17 m local) run up-sun through it 3–8 m from the axis whichever way
  // the bole leans. The lantern limb leaves the tree's axis 2 m up, where the sheared bole is
  // displaced 1.2 m — inside its 1.9 m radius — so the limb, its pods and its lobes are exactly
  // where they were.
  'lantern-tree': { lean: { azimuthDeg: 128, degrees: 20 } },
  // reference C's centre tree: a fat column at x 0.50–0.62 forking at y≈0.26 into two near-horizontal
  // limbs (east = screen-left, west = screen-right) whose clusters form the hazed band across the
  // top of the frame. Girth up / flare down: thicker bole without a ballooning foot at 30 m.
  'plaza-south': {
    wildLimbs: 0,
    girth: 1.3,
    flare: 0.7,
    spread: [
      { azimuthDeg: -8, height: 6.2, length: 8.5, rise: 0.42, radius: 0.95, foliage: 1.0, density: 0.85 },
      { azimuthDeg: 176, height: 5.6, length: 8.0, rise: 0.48, radius: 0.95, foliage: 1.0, density: 0.85 },
    ],
  },
  'east-giant': {
    spread: [
      { azimuthDeg: -140, height: 3.3, length: 9.5, rise: -0.08, radius: 0.55, foliage: 1.1, density: 1.0, lift: 0.2 },
      { azimuthDeg: -172.6, height: 2.6, length: 11.6, rise: -0.06, radius: 0.5, foliage: 1.1, density: 1.0, lift: 0.2 },
    ],
  },
  // reference F's right edge: a straight column, no ballooning foot (its base is 9 m from the
  // camera), roots short of the paved east lobe 6.9 m away. Only the trunk is meant to be seen: the
  // two spread limbs leave at 11–12.5 m towards the south-east / south-south-west, above C's frame
  // top at that distance (≈ 8–10.5 m) and behind F's right edge. Drafts with a limb at 4.2 m
  // measured what limb foliage costs in the hero frames — north-west it fringed the tops of A and F
  // (−0.006 SSIM in A), east it hung across C's top-left (0–0.25, 0–0.5) for −0.013 in C — because
  // the reference has smooth haze or a smooth dark mass there, never textured leaves 15–20 m out.
  // The visible trunk (0.5–6 m) stands in the lantern tree's crown shadow (its casters sit 13–23 m
  // up-sun), so the bark below 7 m is tinted up ×3.5 and cooled towards the hazy grey-brown column
  // the reference shows (lum 0.37, hue 55°): stock bark under ambient alone measured 0.14, ×2 gave
  // 0.16, ×3.5 gives 0.19 (the rest of the gap is haze the atmosphere would have to supply). The
  // tint fades out by 12 m so the sunlit crown wood stays stock.
  'stair-bank-giant': {
    flare: 0.6,
    girth: 1.05,
    rootReach: 0.3,
    rootGirth: 0.8,
    wildLimbs: 0,
    barkTint: [3.2, 3.6, 4.2],
    barkTintFade: [7, 12],
    spread: [{ azimuthDeg: 60, height: 11, length: 7, rise: 0.25, radius: 0.42, foliage: 0.9, density: 1.1 }, { azimuthDeg: 120, height: 12.5, length: 6.5, rise: 0.2, radius: 0.4, foliage: 1.0, density: 1.0 }],
  },
};
/**
 * Giants authored by the trees system on top of LAYOUT.giantTrees (same builder, same audit).
 * stair-bank-giant: reference F (frame 8 s) has a big dark trunk cutting its right edge (x 0.9–1.0,
 * from the frame top down to the bank at y ≈ 0.7), 8–9 m from the camera at the south foot of the
 * stair-side bank. Our F showed the far east-giant there through the haze. Its base sits 6.9 m from
 * the paved east lobe (5, 2.4) r 4 so the roots stay off the flagstones; it is behind cameras B/D/E,
 * beyond A's right edge (A screen x ≈ 1.3 at 5 m) and a hazed column at x ≈ 0.32 in C's background,
 * where the reference C also shows a trunk behind the Kokiri kid. Layout owners: please adopt it
 * into LAYOUT.giantTrees so vegetation / rocks / props avoid its footprint too.
 */
const EXTRA_GIANTS: GiantTreeDef[] = []; // stair-bank-giant adopted into LAYOUT.giantTrees (round 7)
/**
 * Authored canopy boughs (world space; see CanopyBough in giant.ts). Built from their own stream
 * after the rest of the tree, so the host giant's trunk, limbs and crown — and their shadows in the
 * hero frames — are untouched whether or not a bough is listed here.
 *
 * Round 7 tried a lantern-tree "plaza bough" (from 8.1 m, drooping east to (5.5, 6, 1.5), radius
 * 0.55) carrying four sparse shade lobes at 7–9 m over the stair-side bank and four pendulous leaf
 * curtains (eye 0.6, tone 5) hanging to 2.7–3.9 m at (2.6, 3.5, 0.6) hR 1.5, (3.7, 3.9, −0.9) hR 1.4,
 * (3.4, 2.8, 0.1) hR 0.9 and (2.52, 2.7, −0.18) hR 0.9, so that F's top-left quadrant showed canopy
 * instead of Saria's house. A same-tree A/B (gauntlet/tmp/trees7/control vs final) measured the
 * cost: the curtains are textured dark foliage 6–10 m from the cameras where the reference has
 * smooth bright haze — F (0.125–0.375, 0–0.25) went 0.444 → 0.228 lum against the reference's 0.593,
 * A (0.25–0.625, 0–0.25) 0.495 → 0.377 against 0.471 — for −0.012 SSIM in F and −0.013 in A; the
 * shade lobes only darkened a bank that already sat in the lantern tree's crown shadow (0.274 vs
 * the reference's 0.287). Nothing hung between camera F and the house can do better: the F→house
 * ray passes within 1.5 m of camera B, so foliage below ~3.4 m lands in B's frame over the dome
 * and door, foliage 3–7 m out sits in A's centre, and the leaves' own light is tiny (sky-lit
 * undersides, ≈ 0.02 linear) next to the haze the reference shows there. No bough hangs there.
 *
 * Stair shade (round 7c): the upper run of the main stairs (world x 11–15, 3.4–5.4 m up) is open
 * to the sun — the sun probe from (12.5, −4.5) sees only hazed crowns 20–35 m out — so shot A's
 * upper treads read flat-lit (box (0.62–0.8, 0.3–0.4) p50 0.49 against the reference's 0.38, p90
 * 0.60 vs 0.48) while the lower half of the box already matches. Two shade lobes on a bough of the
 * north-west-near giant sit on those treads' sun rays 16 m up: a caster at height Y over a tread
 * at height y shades (X + 1.008 (Y − y), Z + 0.787 (Y − y)), so lobes at (−0.6, 16.2, −13.7) and
 * (2.6, 16.4, −14.4) (hR 2.4) cover (11 → 15, −3.6 → −6.1) with a pair of 4.8 × 6 m ellipses;
 * density 0.6 with roof cards, so from 16 m up the soft filter turns them into dapple rather
 * than a solid patch, and the porous middle F shaft column keeps a lit fleck at (12.5, 4.2, −4.3).
 * The bough and lobes are above every hero frame's top edge (D: tan 1.2–1.3 against 0.445; A/B/F:
 * 0.66–1.1 against 0.42) and behind C.
 */
const CANOPY_BOUGHS: { giant: string; fromY: number; to: [number, number, number]; radius: number; lobes: { t: number; center: [number, number, number]; hR: number; vR: number; density?: number; tone?: number; eye?: number }[] }[] = [
  {
    giant: 'north-west-near',
    fromY: 11.8,
    to: [3.6, 15.4, -14.6],
    radius: 0.45,
    lobes: [
      { t: 0.62, center: [-0.6, 16.2, -13.7], hR: 2.4, vR: 1.5, density: 0.6, eye: 0 },
      { t: 0.92, center: [2.6, 16.4, -14.4], hR: 2.4, vR: 1.5, density: 0.6, eye: 0 },
    ],
  },
];
/**
 * Screen windows of a hero camera that must stay open to the far haze. Reference F has a bright
 * haze gap at the top-centre (x 0.35–0.55, y 0–0.10) where the stair shafts come from; white-bark
 * crowns 15–45 m out on the plateau were closing it. Crowns overlapping a window are re-seated
 * (drawn after the main placement, so no other tree moves).
 */
const VIEW_GAPS: { viewpoint: string; xMin: number; xMax: number; yMin: number; yMax: number; minDistance: number }[] = [
  { viewpoint: 'F_canopy', xMin: 0.33, xMax: 0.57, yMin: -0.2, yMax: 0.12, minDistance: 12 },
];
/**
 * Sunlit ground: the reference plaza (foreground of shot A, which continues as the near path of
 * shot B) is dappled sun, not crown shade — yet under the pinned sun azimuth the rays from it pass
 * through the lantern tree's crown and a row of white-bark crowns 15–35 m to the WNW. The line
 * from each of these ground points along the sun direction is a porous corridor: only a fraction
 * (`porosity`) of the giant laminae and `cardPorosity` of the cluster cards survive (so the patch
 * stays dappled by leaf shadows and branch shadows rather than uniformly lit), and the white-bark
 * placement keeps its crowns off the line. Inside each, a `core` is fully open (no foliage at all):
 * the reference plaza is bright sunlit patches (p90 0.61) between bold shadows, not an even lift,
 * so the core is the lit patch and the porous ring around it carries the dapple. The path north of
 * z ≈ −4 (shot B's far foreground) is already open to the sun and keeps its natural dapple; a
 * corridor there would also gut the lantern tree's north limb lobes that roof the centre of shot F.
 *
 * Wood is never carved, and the lantern tree's bole and pod limb throw a shadow band across the
 * plaza — bole axis (−8.9, −5.2) → (5.2, 5.9), limb axis (−3.5, −1) → (9.1, 6.1) — so the sun
 * probes around (2.5, 3.5) stay 37–45 % open whatever the corridor (blockers at 19–22 m = the bole
 * 10 m above its base). Shot A's ground starts at z ≈ 4.7 (frame bottom), so the first corridor's
 * disc is below its frame; the second core is therefore placed east of both shadow axes at
 * (4.0, 1.8) — A screen ≈ (0.55, 0.78), where the reference's brightest flagstones are (around
 * Link) — and behind camera B.
 */
const PLAZA_SUN_POINTS: { point: [number, number, number]; radius: number; core: { point: [number, number]; radius: number } }[] = [
  { point: [0.0, 0, 6.0], radius: 3.0, core: { point: [-0.3, 6.3], radius: 1.8 } },
  // 1.5 m south of the plaza centre so its lit disc stays out of shot B's foreground band
  // (z -1…-6), which the reference keeps in dappled shade (path p50 0.49)
  { point: [2.5, 0, 3.5], radius: 2.8, core: { point: [4.0, 1.8], radius: 1.6 } },
];
/** laminae survival in the porous ring around each plaza core */
const PLAZA_SUN_POROSITY = 0.3;
/**
 * cluster cards kept in the ring: cards (0.5–1.2 m) are the casters that still read as bold dapple
 * from 20–30 m up (laminae blur away in the soft shadow filter), so a few of them between the lit
 * cores give the reference's broad light/shadow contrast instead of a uniform half-light
 */
const PLAZA_RING_CARD_POROSITY = 0.3;
/**
 * Sunlit path in shot D: camera D (z ≈ −3, level, fov 48) sees the path from z ≈ −8 to −16 in its
 * foreground; the reference path there is sunlit with Link's shadow on it. Sun-probes from those
 * ground points show the sun cone 50–80 % open with the occluders 17–30 m along the ray: the
 * lantern tree's north limb lobes and the north-west giant's south lobes. Porous corridors through
 * those (same treatment as the plaza) leave leaf dapple; the porosity is higher than the plaza's
 * because the reference path here is half dappled (p50 ≈ 0.50 against 0.63 for its lit stone). The
 * points start at z −10 so the corridors stay off the shaded band of shot B's foreground (z −5…−8,
 * which the reference keeps in shade), and they stay on the path spine: a point over the east verge
 * lit D's right bank, which the reference keeps dark (0.24). White-bark crowns are not moved for
 * these lines: the nearest (white #27) sits 6.5 m off the axis, and re-seating it would reshuffle
 * every later placement.
 *
 * Frame 56 s has the flagstones sunlit all the way from Link to the mist pool, and D's lower half
 * measured 0.06 dark with the first two corridors alone (sun probes: 44–48 % open at z −16…−18,
 * 16–26 % at z −20…−24 — the north-west giant's crown 23–31 m up-sun and the low wild-limb lobes
 * of the north-west giants at 10–16 m). Two more points carry the lit run to the hollow, and the
 * corridors are wider and less porous than the first cut (0.45 laminae / 0.35 cards). Sun probes
 * after the change: 91 % open at z −10, 90 % at −12, 57–75 % at −14…−24 (the rest is wood: the
 * north-west giants' wild limbs 7–10 m up, which no corridor removes).
 */
const D_PATH_SUN_POINTS: { point: [number, number, number]; radius: number }[] = [
  // 2.2 m: this disc's south edge already touches B's shaded band
  { point: [0.5, 0, -10.0], radius: 2.2 },
  { point: [1.5, 0, -14.0], radius: 2.6 },
  { point: [2.0, 0, -18.0], radius: 2.6 },
  { point: [1.9, 0, -22.0], radius: 2.4 },
  // edge of the mist pool, where the reference's lit run ends
  { point: [2.0, 0, -25.5], radius: 2.2 },
];
const D_PATH_SUN_POROSITY = 0.25;
/**
 * share of cluster cards kept inside the D corridors: the occluders sit 17–30 m above the path,
 * where laminae shadows blur away in the soft shadow filter, so the cards (0.5–1.2 m) are the only
 * casters that still read as dapple on the slabs (the reference path is lit with leaf dapple, not
 * bare). The slabs outside the corridors keep their natural part-shade.
 */
const D_PATH_CARD_POROSITY = 0.15;
/**
 * Sunlit west verge of shot D: the fern crowns and violets west of the north path (x −5…−3,
 * z −9…−18, the lower left of shot D) sit on ground the reference lights (verge ground 0.46 at
 * 56 s) while ours keeps it in canopy shade (0.23). Sun probes from the verge show the cone 40–65 %
 * open where the ferns do not fill it, with the occluders 6–18 m along the ray (5–12 m up): the
 * north-west-near giant's low limb lobes and the south-east fringe of the lantern tree's crown.
 * Ground-line corridors from the verge open those the same way as the path's: cards off (the bold
 * casters), a quarter of the laminae kept so the fronds still carry leaf dapple. The lines leave
 * shot D's frame at its left edge as they rise (x < −6 at 3 m, x < −13 at 9 m), so the arch
 * silhouette and the giant's trunk (wood is never carved) stay. A corridor lights an ellipse on the
 * ground that reaches 1.6 × its radius along the sun's azimuth (the casters at the top of its
 * section shade the far end), so the discs sit far enough west that those ellipses end ≥ 0.9 m
 * west of the path's edge and south of nothing nearer than z −9: shot B's shaded foreground band
 * (the path at z −5…−8) is not touched. What still shades the verge is not foliage: the giant's own
 * bole and low limb (the sun probes from the boulder and the verge see wood in the cone), the
 * west-tree-platform prop (deck ≈ 3.9 m at (−8.7, −10)) and the ferns themselves.
 */
const D_VERGE_SUN_POINTS: { point: [number, number, number]; radius: number }[] = [
  { point: [-4.8, 0, -11.0], radius: 2.0 },
  { point: [-4.6, 0, -13.4], radius: 2.2 },
  { point: [-4.6, 0, -15.8], radius: 2.2 },
  { point: [-5.0, 0, -18.0], radius: 2.0 },
];
const D_VERGE_SUN_POROSITY = 0.25;
const D_VERGE_CARD_POROSITY = 0;
/**
 * Dappled bank right of the stairs in shot F: the bank (x 6–12, z 0–6, F's right third) lies under
 * the lantern tree's crown shadow — sun probes from it are 45–60 % open with the occluders 21–33 m
 * along the ray, i.e. the crown's south-east flank 14–20 m up, 4–7 m off the bole. The reference
 * bank is dappled with lit patches (box p90 0.42); ours read an even 0.25. Porous ground-line
 * corridors from the bank thin that flank's cards (the casters that read as bold dapple from 25 m)
 * and half its laminae. `yMin` keeps them off everything the same lines cross lower down — the
 * lantern limb's lobes 3–8 m over the plaza (the hero foliage of shots A and F) and the plaza's own
 * casters — so shot A's plaza and shot B's foreground keep their light. The flank itself is outside
 * every hero frame (off A's and B's left edge, above F's top). The lit ellipses reach x ≈ 5.3 at
 * their west tips — 2 m east of shot A's plaza box — and the stair-bank giant's bole stays ≥ 2.7 m
 * off every line, so its shaded face in shot C is unchanged.
 */
const F_BANK_SUN_POINTS: { point: [number, number, number]; radius: number }[] = [
  { point: [8.1, 0, 1.6], radius: 2.2 },
  { point: [10.9, 0, 1.4], radius: 2.2 },
  { point: [8.3, 0, 4.4], radius: 2.2 },
  { point: [11.1, 0, 4.4], radius: 2.2 },
];
const F_BANK_SUN_POROSITY = 0.5;
const F_BANK_CARD_POROSITY = 0.35;
/** world height below which the bank corridors are inactive (the crown flank starts ≈ 13 m) */
const F_BANK_MIN_Y = 12;
/**
 * Link's shadow: the reference frames show his shadow on the slabs at his feet in shots A and D;
 * ours never did, because the sun depth map held tree geometry between him and the sun. Along the
 * ray from his head toward the sun at D, the north-west-near giant's bole crossed it 7.4 m up
 * (bent aside: see GIANT_PROFILES), a wild limb 6–9 m out (re-aimed there too), and its crown cards 14–21 m out
 * (≈ (−8…−12, 9.5…13.5, −15…−18)); at A the lantern tree's crown cards 18–33 m out. These
 * corridors (fully closed to foliage — laminae and cards — from 3 m out to 40 m, so the low
 * hero boughs and the crown roof beyond stay) follow the ray from his head at each pose with a
 * 1.5 m radius: enough for the bundle of rays through his whole silhouette plus the lit ring
 * around it, since the feet ray sits only 1 m off the head ray in the ray's normal plane. Both
 * rays pass ≥ 5 m from the lantern limb, so the lantern boughs of shots A and F are untouched.
 * They are also closed to fine wood (lobe stems, twigs, crown boughs — the wild-limb lobe stems of
 * the north-west-near giant crossed the D ray 17 m out, 0.2 m thick, and the lantern tree's
 * lowest crown boughs run up-sun through the A ray 21–33 m out); the trunk, roots, big limbs
 * and leaders are exempt. The A ray also grazed the lantern tree's bole/fork 21–24 m out
 * (0.78 m off its axis, bole radius ≈ 0.83) — that bole is sheared aside (GIANT_PROFILES). Both
 * ray segments lie outside every hero frame, so the cut wood is never seen.
 */
const LINK_SHADOW_RAYS: { id: string; head: [number, number, number] }[] = [
  { id: 'D_log', head: [0.86, 1.3, -7.68] },
  { id: 'A_stairs', head: [2.26, 1.3, 4.59] },
];
const LINK_RAY_RADIUS = 1.5;
/** metres along the ray where the corridor starts / ends */
const LINK_RAY_RANGE: [number, number] = [3, 40];
/**
 * Canopy gaps over the north hollow as seen from camera D: air points 26–29 m north of the plaza at
 * 11–13 m (the height of the north-west / north-east giants' low limb lobes, which fill the upper
 * band of shot D as dark 25–30 m masses). The line from D's eye through each point is a porous
 * corridor, so the hazed far layer (and the sky at the very top) shows through a few leaf-fringed
 * openings instead of a closed roof — the reference's top band is crown silhouettes against glare.
 */
const HOLLOW_GAP_POINTS: { point: [number, number, number]; radius: number }[] = [
  { point: [-1.9, 12.1, -28.9], radius: 1.8 },
  { point: [3.8, 13.0, -28.6], radius: 1.8 },
  { point: [8.0, 11.4, -28.4], radius: 1.6 },
];
const HOLLOW_GAP_POROSITY = 0.15;
/**
 * Giants whose LOW foliage the hero cameras see from a few metres: the lantern tree's limb lobes
 * hang 3–8 m from cameras A/B, the plateau oak's house boughs are ~20 m from B. Their low lobes
 * get leaf-sized laminae instead of cluster cards (see GiantOptions.eyeDetail).
 */
const EYE_DETAIL: Record<string, number> = { 'lantern-tree': 1, 'plateau-oak': 0.6 };
/** foliage scale of the authored lantern limb (reference: a bare bough with a few clusters) */
const LANTERN_LIMB_FOLIAGE = 0.45;
/**
 * Dense silhouette rows north of the log arch (shot D looks north from z ≈ −1): each fills a
 * narrow depth range so the depth histogram registers a distinct far layer behind the log
 * (crown faces ≈ 47–57 m and ≈ 80–95 m from the camera, with a clear gap after the log/giant
 * run that ends ≈ 37 m), read as dark masses under the haze. Both rows keep to the two shorter
 * broad variants at a modest scale (tops ≈ 23–32 m): from D the near row's crown tops then fall
 * between y ≈ 0.1 and the frame's top edge and the far row stays below them, so the haze/sky
 * glows between the silhouettes at the top of the shot instead of a 43 m wall closing it (the
 * reference's top band is crown silhouettes against glare).
 */
const DEPTH_BANDS: DepthBand[] = [
  { xMin: -34, xMax: 48, zMin: -61, zMax: -55, spacing: 5.0, scale: [1.1, 1.3], shade: 0.72, maxVariantHeight: 23 },
  { xMin: -58, xMax: 68, zMin: -98, zMax: -84, spacing: 7, scale: [1.1, 1.4], shade: 0.78, maxVariantHeight: 23 },
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
  // world-space sun corridors (see SHAFT_COLUMNS / PLAZA_SUN_POINTS / D_PATH_SUN_POINTS / D_VERGE_SUN_POINTS / F_BANK_SUN_POINTS / LINK_SHADOW_RAYS)
  interface WorldCorridor {
    point: Vector3;
    dir: Vector3;
    radius: number;
    porosity: number;
    cardPorosity: number;
    /** world height below which the corridor is inactive */
    yMin?: number;
    /** world height above which the corridor is inactive */
    yMax?: number;
    /** also cut the fine wood inside (see GiantOptions.corridors) */
    wood?: boolean;
  }
  const groundLine = (q: [number, number, number], radius: number, porosity: number, cardPorosity = 0, yMin?: number): WorldCorridor => ({
    point: new Vector3(q[0], terrain.height(q[0], q[2]), q[2]),
    dir: sunDir,
    radius,
    porosity,
    cardPorosity,
    yMin,
  });
  // closed sun rays from Link's head (see LINK_SHADOW_RAYS): active only 3–40 m out along the
  // ray, and closed to fine wood as well as foliage
  const linkRays: WorldCorridor[] = LINK_SHADOW_RAYS.map(({ head }) => ({
    point: new Vector3(head[0], head[1], head[2]),
    dir: sunDir,
    radius: LINK_RAY_RADIUS,
    porosity: 0,
    cardPorosity: 0,
    yMin: head[1] + sunDir.y * LINK_RAY_RANGE[0],
    yMax: head[1] + sunDir.y * LINK_RAY_RANGE[1],
    wood: true,
  }));
  const plazaCorridors = PLAZA_SUN_POINTS.map(({ point, radius }) => groundLine(point, radius, PLAZA_SUN_POROSITY, PLAZA_RING_CARD_POROSITY));
  // fully open cores inside the porous plaza rings (a tighter corridor wins where they overlap)
  const plazaCores = PLAZA_SUN_POINTS.map(({ core }) => groundLine([core.point[0], 0, core.point[1]], core.radius, 0, 0));
  const sunCorridors: WorldCorridor[] = [
    ...SHAFT_COLUMNS.map((c) => ({ point: new Vector3(c.point[0], c.point[1], c.point[2]), dir: sunDir, radius: c.carve ?? c.radius, porosity: c.porosity ?? 0, cardPorosity: c.cardPorosity ?? 0 })),
    ...plazaCorridors,
    ...plazaCores,
    ...D_PATH_SUN_POINTS.map(({ point, radius }) => groundLine(point, radius, D_PATH_SUN_POROSITY, D_PATH_CARD_POROSITY)),
    ...D_VERGE_SUN_POINTS.map(({ point, radius }) => groundLine(point, radius, D_VERGE_SUN_POROSITY, D_VERGE_CARD_POROSITY)),
    ...F_BANK_SUN_POINTS.map(({ point, radius }) => groundLine(point, radius, F_BANK_SUN_POROSITY, F_BANK_CARD_POROSITY, F_BANK_MIN_Y)),
    ...linkRays,
  ];
  // view corridors from camera D's eye through the hollow gap points (see HOLLOW_GAP_POINTS)
  const dView = ctx.layout.viewpoints.find((v) => v.id === 'D_log');
  const gapCorridors: WorldCorridor[] = dView
    ? HOLLOW_GAP_POINTS.map(({ point: q, radius }) => {
        const point = new Vector3(q[0], q[1], q[2]);
        const dir = point.clone().sub(new Vector3(dView.position[0], dView.position[1], dView.position[2])).normalize();
        return { point, dir, radius, porosity: HOLLOW_GAP_POROSITY, cardPorosity: 0 };
      })
    : [];
  const giantCorridors: WorldCorridor[] = [...sunCorridors, ...gapCorridors];

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
  const viewGaps: ViewGap[] = [];
  for (const gap of VIEW_GAPS) {
    const view = ctx.layout.viewpoints.find((v) => v.id === gap.viewpoint);
    if (!view) continue;
    viewGaps.push({
      position: new Vector3(view.position[0], view.position[1], view.position[2]),
      target: new Vector3(view.target[0], view.target[1], view.target[2]),
      fov: view.fov,
      aspect: 16 / 9,
      xMin: gap.xMin,
      xMax: gap.xMax,
      yMin: gap.yMin,
      yMax: gap.yMax,
      minDistance: gap.minDistance,
    });
  }
  const whitePlaced = placeWhiteBark(
    ctx,
    rng,
    whites.map((w) => ({ height: w.lods[0].height, radius: w.lods[0].radius, age: w.params.age })),
    whiteTarget,
    12,
    60,
    // crowns stay out of the plaza sun corridors (trunks may cross them: thin shadows = dapple)
    plazaCorridors.map((c) => ({ point: c.point, dir: c.dir, radius: c.radius })),
    viewGaps,
    EXTRA_GIANTS,
  );
  const whitePlacements = whitePlaced.placements;
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
  const giants: { def: GiantTreeDef; asset: GiantAsset; origin: Vector3; angle: number }[] = [];
  const contacts: [number, number, number][] = [];
  const giantDefs: GiantTreeDef[] = [...ctx.layout.giantTrees, ...EXTRA_GIANTS];
  for (const def of giantDefs) {
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
    const boughs = HOUSE_BOUGHS.filter((b) => b.giant === def.id).map((b: (typeof HOUSE_BOUGHS)[number] & { density?: number }) => ({
      to: new Vector3(b.to[0], b.to[1], b.to[2]).sub(origin),
      fromHeight: b.fromHeight,
      radius: b.radius,
      foliage: b.foliage,
      density: b.density,
    }));
    // giants 35–45 m out are seen through the haze at 30+ m: fewer laminae, the cluster cards
    // carry their crowns
    const plazaDist = Math.hypot(px, pz);
    const farFade = 1 - 0.45 * Math.min(1, Math.max(0, (plazaDist - 26) / 16));
    const canopyBoughs: CanopyBough[] = CANOPY_BOUGHS.filter((b) => b.giant === def.id).map((b) => ({
      to: new Vector3(b.to[0], b.to[1], b.to[2]).sub(origin),
      fromHeight: b.fromY - gy,
      radius: b.radius,
      lobes: b.lobes.map((l) => ({ t: l.t, center: new Vector3(l.center[0], l.center[1], l.center[2]).sub(origin), hR: l.hR, vR: l.vR, density: l.density, tone: l.tone, eye: l.eye })),
    }));
    const asset = createGiantTree(def, rng, {
      groundAt: (lx, lz) => terrain.height(px + lx, pz + lz) - gy,
      limbSpec,
      palette,
      // ×1.1 restores the laminae the porous sun corridors remove (W11 counts ≥ 200 k leaves)
      leafDensity: Math.max(0.7, Math.min(1.15, ctx.quality.density)) * farFade * 1.1,
      cardDensity: Math.max(0.7, Math.min(1.15, ctx.quality.density)) * (1 + (1 - farFade)),
      towardPlaza: new Vector3(-px, 0, -pz).normalize(),
      boughs,
      corridors: giantCorridors.map((c) => ({
        point: c.point.clone().sub(origin),
        dir: c.dir,
        radius: c.radius,
        porosity: c.porosity,
        cardPorosity: c.cardPorosity,
        yMin: c.yMin === undefined ? undefined : c.yMin - gy,
        yMax: c.yMax === undefined ? undefined : c.yMax - gy,
        wood: c.wood,
      })),
      eyeDetail: EYE_DETAIL[def.id] ?? 0,
      limbFoliage: def.id === 'lantern-tree' ? LANTERN_LIMB_FOLIAGE : 1,
      profile: GIANT_PROFILES[def.id],
      canopyBoughs,
    });
    // to world space; aRoot.xyz carries the tree origin so the merged shader keeps per-tree context
    for (const g of [asset.geometry, asset.cards]) {
      g.translate(px, gy, pz);
      const root = g.getAttribute('aRoot') as BufferAttribute;
      for (let i = 0; i < root.count; i++) root.setXYZ(i, px, gy, pz);
    }
    giants.push({ def, asset, origin, angle: Math.atan2(pz, px) });
    for (const c of asset.contacts) contacts.push([px + c.x, gy + c.y, pz + c.z]);
    ctx.progress('trees', 0.55 + (0.3 * giants.length) / giantDefs.length);
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
      /** white-barks moved out of the hero-camera view gaps (VIEW_GAPS) */
      whiteBarkReseated: whitePlaced.reseated,
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
