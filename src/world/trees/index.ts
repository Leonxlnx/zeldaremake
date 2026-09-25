/**
 * Trees — owner: trees agent.
 * Port + upgrade of the Verdant Forest white-bark trees (github.com/Leonxlnx/verdant-forest,
 * app/forest/trees.js — "Derived from Verdant Forest by Leonxlnx") plus the giant old Kokiri trees
 * whose canopies roof the clearing and a distant tree layer for the haze.
 *
 * Structure
 *   whitebark.ts  — seeded white-bark variants (3 LODs each: high / medium / low leaf subsets)
 *   column.ts     — dark-boled column trees: the mid-distance forest wall (authored seats)
 *   giant.ts      — unique giants at LAYOUT.giantTrees, roots conformed to the terrain
 *   distant.ts    — 2-LOD distant trees for the 60–220 m band
 *   placement.ts  — seeded, layout-aware white-bark placement
 *   materials.ts  — one bark+leaf material per tree family with 3 wind layers + shadow-depth twins
 *   writer.ts     — geometry writer + botanical primitives
 *
 * Rendering: bark and leaves of a tree share one geometry (leaf vertices flagged in aRoot.w), so a
 * white-bark variant costs ONE InstancedMesh per LOD; `update()` re-buckets instances by camera
 * distance whenever the camera moves > 1.5 m (an explicit re-pose via `onCameraMove` always
 * re-buckets). Giants are merged into three angular sector meshes (aRoot.xyz = each tree's origin
 * keeps per-tree wind/height context). What each bucket hands the GPU is trimmed per frame to the
 * instances that can reach the image (see "submission culling" below). Everything is seated via
 * ctx.terrain.height; randomness only via ctx.rng.
 */
import { BatchedMesh, Box3, BufferAttribute, BufferGeometry, Color, Frustum, MeshBasicMaterial, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Quaternion, Sphere, Vector3, type Camera, type Material } from 'three';
import type { TrunkSeat, WorldContext, WorldSystem } from '../system';
import { BARK_DETAIL_M, BARK_DETAIL_TILES, BARK_TOUCH_M, BARK_TOUCH_TILES, CARD_EDGE_FADE, CARD_FLAT_EDGE_FADE, COLUMN_BARK_FLOOR, COLUMN_BARK_FLOOR_FAR, COLUMN_FLOOR_FADE_M, createTreeMaterials, CUSHION_FADE_M, DISTANT_BARK_M, DISTANT_NEAR_FLOOR, DISTANT_NEAR_TONE, NEAR_BASE_FLOOR, NEAR_BOLE_FLOOR, NEAR_BOLE_FLOOR_FADE, NEAR_BOLE_FLOOR_TOP, NEAR_BOLE_SLOTS, NEAR_CANOPY_LEAF_FLOOR, NEAR_CANOPY_LEAF_NEAR_M, NEAR_CANOPY_SLOTS, NEAR_CANOPY_SUN_THROUGH, TREE_BARK_FLOOR, TREE_BARK_FLOOR_NEAR, TREE_FLOOR_FADE_M, TREE_LEAF_FLOOR, TREE_LEAF_FLOOR_NEAR, TREE_NEAR_BOLE_FLOOR } from './materials';
import type { ShadeFloor } from '../materials/shadeFloor';
import { authoredWhiteBarks, createWhiteBarkRoots, createWhiteBarkTree, whiteBarkParams, whiteBarkTilt, type RootPlacement, type TreeAsset, type WhiteBarkParams, CLEARING_WHITE_BARKS } from './whitebark';
import { createUnderstoryTree, understoryParams, type UnderstoryParams } from './understory';
import { placeWhiteBark, treeGroundBlocked, viewProjector, type WhiteBarkPlacement } from './placement';
import { columnParams, createColumnTree, emergentParams, hutHostParams, type ColumnAsset, type ColumnParams } from './column';
import { expansionCull, getTerrain, southFooting, southRouteSurface, westExpansionCull, type Terrain, type TerrainView } from '../terrain/heightfield';
import { smoothstep } from '../util/noise';
import { casterSpheres, expansionVisible, type Caster } from '../util/expansionLocality';
import { EXPANSION, EXPANSION_SOUTH, inExpansionSouth, southPathLine } from '../layout';
import { inExpansionNorth } from '../layout';
import { groveDeckDistance, groveGroundDistance, groveWalkDistance, northGroveClear, northGroveHuts } from '../terrain/north';
import { groveNearXZ } from '../util/groveLocality';
import { createGiantTree, LOBE_SECONDARY_REACH, LOBE_TWIG_REACH, LOBE_TWIG_TINT, NEAR_BASE_CUT_Y, NEAR_BASE_RADIUS_OVERRIDE, NEAR_BASE_RADIUS_OVERRIDE_LARGE, type CanopyBough, type GiantAsset, type GiantProfile } from './giant';
import { NEAR_CANOPY_IN_M, NEAR_CANOPY_MAX_Y, NEAR_CANOPY_OUT_M, type NearCanopyPart } from './nearCanopy';
import { LodPool, type PoolBuilt, type PoolItem } from './lodPool';
import type { GiantTreeDef } from '../layout';
import type { RootKitFit } from './rootkit';
import { createDistantCrownMaterial, createDistantVariants, createMidVariants, CROWN_ALPHA_TEST, CROWN_CORE_DARK, CROWN_JITTER, CROWN_RIM, CROWN_SPHERE_MIX, DISTANT_BOLE_BANDS, DISTANT_CORDS, DISTANT_CROWN_TOP, DISTANT_DEPTH_COOL, DISTANT_FLARE, DISTANT_FLARE_FALL, DISTANT_FOOT_GRIME, DISTANT_FURROW_SHADE, DISTANT_NEAR_GAIN, DISTANT_ROOT_ARC, DISTANT_SIDES, distantClearanceTally, FAR_CROWN_CARD_HALF, FAR_CROWN_CARDS, FAR_CROWN_LOBES, LIMB_REACH, LIMB_TINT_FROM, LIMB_TINT_TO, LIMB_TIP_TINT, MID_CROWN_LOOK, MID_FAR_LOD_M, MID_HEIGHTS, MID_SPECS, MID_TRUNK_R, placeDistantTrees, placeMidTrees, type DepthBand, type DistantClearance, type DistantPlacement, type DistantVariant } from './distant';
import { TAU, isCushionRoot, mergeParts, type Detail } from './writer';
import type { ViewGap } from './placement';

/**
 * Astra's root-base kit test (rootkit.ts): built only from a bundle made with `VITE_ROOT_KIT=1`,
 * on one 1.1 m bole and one 2.2 m bole. The default bundle never loads the 11.8 MB GLB.
 */
const ROOT_KIT = import.meta.env.VITE_ROOT_KIT === '1';
const ROOT_KIT_BOLES = ['stair-bank-giant', 'plaza-south'];
import { CANOPY_OPENINGS, CANOPY_OPENING_COLLAR, CANOPY_OPENING_DENSIFY, SHAFT_COLUMNS } from './corridors';
import { trunkSeatFromRings, tubePathFromRings } from './tubePath';

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
  // Round 34 (measured, kept as it was): its 0.6 m wood runs 19 m ACROSS the sun at 9.8 m, and the
  // sun-eye attribution (100 m sun-axis depth image, first hit per 1.25 cm ground cell) put its
  // 1.5 m shadow band ((−3.6, 3.2) → (15.1, −7.2)) over 9.6 % of shot A's paving pixels — across
  // the plaza at x −0.5…1, z 0.5–1.5 and the path mouth x 0…2, z −1…0.5, which frame 1 s lights
  // (luminance 0.48–0.57 against its shade's 0.30–0.39) — and across B's east verge (5.5–7,
  // −3…−2) and its top edge (the wood's underside at B (0.38–0.47, 0–0.03), where frame 14 s has
  // dark canopy). Ghosting the whole bough opened the first A/B shaft column ((1.3, 6.6, −9.4)
  // r 2.6, corridors.ts) — its lobes stand in that column's down-sun air, and the beam ran on to
  // the ground at ≈ (7.7, 0, −4.4) across shot B's house, (0.45, 0) → (1.0, 0.75) (B −0.0035).
  // Ghosting the wood alone (giant.ts ghostWood) lit A's plaza band as the frame has it — A's
  // (0.08–0.40, 0.64–0.75) box 41 → 67 % lit against the frame's 65 % — and measured A −0.0010,
  // B −0.0016 against the same build with the wood: at 256 × 144 the lit slabs' texture reads as
  // contrast the frame's soft paving does not have, and the B strip and verge lost their match.
  // The wood stays; the band is the price of the plaza mouth (see corridors.ts a-path-mouth).
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
  // Round 33 (trees): the NNE (335°) and NNW (259°) wild limbs are ghosted (draws made, no
  // geometry, so the crown is the same tree's); the WSW (168°) limb stays. Measured by ray-casting the sun lines through shot D's air (x 0.35–0.75,
  // y 0.10–0.27: the in-scatter the god rays add there): 74 % of that air's in-scatter weight
  // was in shadow, 26 % of it this giant's wood — not the bole (no hit within 1.2 m of its
  // sheared axis) but the four authored boughs' runs at 12–15 m (≈ 50 %), the crown leaders'
  // bases (≈ 30 %) and the ENE wild limb (13 %), whose tip and lobes also stood IN the box at
  // D (0.40, 0.09), 16–20 m out, where frame 56 s has lit air. For D's upper-left air (x 0.05–0.35)
  // the limbs' collars 1.3–2.5 m off the axis at 6–8 m were 60 % of the giant's blocking. On the
  // ground the ENE limb's wood laid a band across the first D path pool ((0.5, −10) r 2.2, from
  // (−0.75, −10.4) to (7, −10.9)) and the NNW limb's along the verge pool (−4.6, −15.8) — the two
  // places frame 56 s lights. Same-tree A/B, D 640×360: the whole giant's wood hidden lifted the
  // air box p50 0.473 → 0.552 and the top band's 0.423 → 0.447. The WSW limb is off D (x < 0)
  // and on no D sun line; its wood's shadow is the band across the grass at B / E's bottom-left
  // ((0.06–0.25, 0.75–0.875): frame 14 s's dark foreground grass, p50 0.30 — with the limb ghosted
  // the grass read 0.39 and B lost 0.0039 / E 0.0028 of SSIM in the two bottom-left cells), so it
  // is kept: sector 285° ± 50° takes the nominal 240° and 330° limbs (base 60° + 180° / 270°).
  'north-west-near': {
    flare: 0.12,
    girth: 0.7,
    rootReach: 0.5,
    rootGirth: 0.7,
    lean: { azimuthDeg: 245, degrees: 45, fromY: 3.5, blend: 2 },
    wildLimbAzimuthDeg: 60,
    wildLimbT: [0.5, 0.62],
    wildLimbGhost: { azimuthDeg: 285, halfWidthDeg: 50 },
  },
  // Round 33: shot D's air box (x 0.35–0.75, y 0.10–0.27) held this giant's wild-limb lobes and
  // limb wood 28–32 m out (21 % of the box's pixels, y 9–11 m, lum 0.46: textured dark foliage at
  // D (0.55–0.72, 0.1–0.3) where frame 56 s has 0.55–0.60 lit air between far trunks). Ghosted:
  // the far row (55–60 m, 0.51) and the lit air show through; the crown (14 m+) is above y 0.16
  // and its low lobes read as the dark mass at D's top-right, where the frame's limb comes in.
  // B sees the same lobes hazed at (0.45–0.6, 0.2–0.3), 42 m; A behind the upper house at 48 m.
  // Their shadows fell at (25, −29), the far plateau. The tree drew two wild limbs, at 145°
  // (west-south-west: the one in the box, its lobes 8–10 m west of the bole at D x 0.5–0.65) and
  // 269° (north, behind the bole); W09 wants two big limbs, so the 145° limb is ghosted by
  // sector and a spread limb (own stream: nothing else re-rolls) takes its place heading
  // north-north-east — behind the bole at D (0.71, 0.29), 43 m, hazed to the far layer's tone and
  // covered by the bole's strip (0.68–0.72); off A / B / F, behind C. Its shadow lands on the far
  // plateau at (27, −33).
  'north-east': {
    wildLimbGhost: { azimuthDeg: 135, halfWidthDeg: 75 },
    spread: [{ azimuthDeg: 300, height: 9.5, length: 8, rise: 0.2, radius: 0.45, foliage: 0.8, density: 1.0 }],
  },
  // Round 33: shot D's upper-left (x 0.05–0.35, y 0.08–0.6) is frame 56 s's brightest air — its
  // (0.2–0.35, 0.08–0.45) half 0.58–0.62 with the rays, hazed trunks 0.06 under it — and ours
  // read 0.43 there. This giant stands at D x 0.13, 28–32 m out; its random wild limbs left the
  // bole at 6–11 m heading east, so a hazed limb crossed the whole box at y 0.15–0.25 (its wood +
  // leaves 11.9 % of the box's pixels at 0.423, the limb lobes' cards another 1.8 %), and on the
  // sun lines through that air its wood was 11.3 % and its crown's cards 9.2 % of the in-scatter
  // weight in shadow (the box's air 55 % shaded; ray-cast, round-33 probe). Ghosted: the crown is
  // the same tree's. The limb lobes' shadows fell 10–14 m down-sun at (−5…0, −25…−20), across
  // the D path's third and fourth sun pools' corridors.
  // Off A (x < −0.03) and B (x < 0.1, the nwnear bole's strip). The tree drew two wild limbs, at
  // 5° (east: the one across the box, D x 0.13 → 0.32 at y 0.2–0.3, its tip lobes at (0.3,
  // 0.15–0.25)) and 242° (north-north-west, off D's left edge); W09 wants two big limbs, so the
  // 5° limb is ghosted by sector and a spread limb (own stream) takes its place heading
  // west-north-west, off D's left edge (x < −0.04 at 30 m), further off B and A. Its shadow lands
  // on the boulder bank at (−7, −25), north of the D verge pools.
  'north-west': {
    wildLimbGhost: { azimuthDeg: 20, halfWidthDeg: 70 },
    spread: [{ azimuthDeg: 200, height: 9, length: 8, rise: 0.2, radius: 0.45, foliage: 0.8, density: 1.0 }],
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
  // relief 0: the near-bole bark (bole.ts) is off for the hero views - see giant.ts NEAR_BOLE_M
  // wildLimbAzimuthDeg 23.6: the wild limbs spread from the authored limb's heading by default,
  // and round 37 turned that heading from 23.6° (the old (−4, −5) → (1.5, −2.6) run) to 0° (the
  // z = 1.5 run, LANTERN_LIMB), which would have swung both limbs 24° (136° / 262° → 112° / 234°,
  // measured); pinned to the old base so they, their lobes and their shadows stay where rounds
  // 33–36 measured them (the jitter draws are the same either way).
  'lantern-tree': { lean: { azimuthDeg: 128, degrees: 20 }, relief: 0, wildLimbAzimuthDeg: 23.6 },
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
  // Round 45 (vegetation-23's plateau-walk finding, survey crop 15): the two limbs left the bole at
  // 3.3 / 2.6 m (8.7 / 8.0 m world) and drooped to 7.3 / 6.4 m over the fenced plateau top (ground
  // 5.4–5.6), their lobes 0.4 m above the wood — a built-geometry probe over x 15–26, z −6…5 found
  // leaves 0.1–1.6 m and wood 0.6–2.3 m above the ground everywhere between the stair top and the
  // east giant's foot: the survey's eye at 6.6 m stood in the leaves. Both limbs now leave at
  // 5.0 / 4.0 m (10.7 / 9.7 m world), droop half as fast and carry their lobes 1.7 / 1.5 m above
  // the wood, and their foliage is FLOORED at 9.3 m world (`floor`, giant.ts lobeFloorY: a lobe's
  // twigs droop ~2 m under its ellipsoid — the probe found the limb lobes' twig tips 3.0–3.7 m
  // over the walk with the wood at 9.3–10.7): nothing of the limbs' leaves is under 9.3 m —
  // ≥ 3.7 m over the highest plateau ground (5.6), 2.3+ m over a walker's eye (1.45). In F the
  // limbs' lobes leave the frame top (they were the dark roof at F (0.5–0.7, 0.09–0.12),
  // 0.12–0.18 UNDER frame 8 s's hazed canopy there: the top row read 0.30 against 0.45); the
  // frame's top band is now the haze and the moved canopy-bough lobes (below).
  'east-giant': {
    spread: [
      { azimuthDeg: -140, height: 5.0, length: 9.5, rise: -0.04, radius: 0.55, foliage: 1.1, density: 1.0, lift: 0.9, floor: 9.3 - 5.74 },
      { azimuthDeg: -172.6, height: 4.0, length: 11.6, rise: -0.03, radius: 0.5, foliage: 1.1, density: 1.0, lift: 0.8, floor: 9.3 - 5.74 },
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
    // near-bole bark (bole.ts) off: the reference shows this bole as a near-smooth hazed column at
    // 13.6 m (F) and 18.7 m (C); even the zero-amplitude bole path cost C -0.003 / F -0.003 SSIM
    // (see giant.ts NEAR_BOLE_M)
    relief: 0,
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
 *
 * House shade (round 8): the reference keeps Saria's tree-house in canopy shade — shot A's house
 * box (0.45–0.65, 0.3–0.5) is a grey-olive bank (hue 59°, sat 0.19) and shot B (14 s) lights the
 * house mainly by its lanterns and skylight — while ours showed a sunlit green roof (sat 0.27): sun
 * probes from the roof crown read 93 % open and from the sun-facing north-west flank 93 %. Two
 * more boughs of the same giant carry dense casters on the roofs' sun lines (a caster at height Y
 * shades the roof point (x, y, z) from (x − 1.008 (Y − y), Y, z − 0.787 (Y − y))). Saria's dome
 * (axis (12.5, −11.5), pad 1.05 m; eaves 4.05 m at r 4.2–4.6, crown 6.45 m + 0.6 m of moss) is
 * shaded from 16.4 m by casters filling the strip from (−1.8, −22.7) (its up-sun eave) to (5.5,
 * −17.3) (its down-sun shoulder), 3.2 m wide, so the second bough leaves at 12.4 m and carries four
 * hR 3.2 lobes along that strip. A lobe's leaf and card count does not grow with its size, so at
 * hR 3 the stock density is a 60–70 % filter (the crown probe still read 29 % open with three
 * hR 3.4 lobes at density 1.2, 24 % at density 2.5); density 4 (≈ 100 cards + 2000 laminae per
 * lobe) closes the crown's cone to 26 % (15 % before the left F column's carve nicked the
 * eastmost lobe), the north-west flank's to 33 % and the up-sun lip's to 59 % (the strip's west
 * edge; the upper house's cap probes 45 %). The upper house (axis (13.5,
 * −17.5), r 2.7, dome 8.2–11.1 m) is further north, where 16 m would sit on A's top edge, so its
 * casters ride a third bough at 19 m: (1.6, −26.8) and (3.6, −25.2) cover the eaves and the dome
 * to ≈ 10 m, (5.0, −24.1) the cap; the re-seated left F shaft column (corridors.ts) carves through
 * the east edges of that lobe and of the eastmost Saria lobe, 2.6 m and 3.9 m from the caps' own
 * sun lines, so the cap's east rim stays open to it. Every path point and lobe
 * projects above A's top edge by ≥ 0.05 of the frame (B/D by ≥ 0.13) and off F's left edge. Their
 * ground shadows fall inside the houses' own shadows on the plateau (x 10–19, z −16…−6): the
 * stair treads' casters sit ≥ 3.8 m from these centres (the 7c dapple lobes are untouched), and
 * no plaza or path point is reached.
 *
 * Measured effect: small. With the hemisphere and IBL switched off, the dome under the sun reads
 * as lit straw between the house's own leaf clusters (structures/foliage.ts, which cover most of
 * the cap from the sun's side), but in the hero frames the roof is 15–22 m into the haze and the
 * sun's whole contribution to its pixels is only +0.01–0.04 (sun on/off: A roof-top patch 0.399
 * vs 0.367, B cap 0.378 vs 0.360), so shading it moves the A house box by ≤ 0.005. The roof's
 * "lit green" look (sat 0.25–0.29) is the baked moss vertex colour and the lit leaf clusters,
 * i.e. structures' materials. What did light the house in A/B was the left F shaft column's beam
 * crossing the crown (corridors.ts: A crown box 0.53 → 0.44, B house box 0.40 → 0.36 = ref).
 *
 * Path canopy (round 9) — tried and dropped. The reference B (14 s) roofs its forest box (x 0–0.4,
 * y 0.1–0.5) with a soft, nearly closed canopy — a smooth mass at 0.42–0.50 — where ours shows the
 * far haze of the north hollow (box p50 0.50 / p90 0.63 against 0.43 / 0.51). Nothing in the box
 * is closer than 18 m: the north-west-near giant's crown starts 12 m up and camera B looks under
 * it, so the box is the same air camera D's frame centre looks into 5 m further along the path.
 * Foliage that closes B's box without entering D's frame must sit near B and low — B's ray at the
 * box top (y 0.1) rises 0.31 m per metre, D's frame top 0.445 from 5 m closer, so the window
 * between them at z −6…−9 is 3–4.9 m up — and that same air is A's left quadrant under the W01
 * limb (A (0–0.3, 0.17–0.5)), where the reference is smooth bright haze. Five same-tree A/B builds
 * (a lantern-tree bough from 5.6 m drooping east to (2.8, 4.9, −8) with six dense eye-0 lobes,
 * hR 1.2–1.9 at 3.7–5.2 m; density 1.6–2.5, tone 0.8–1.2) closed the box to p50 0.36–0.45 / p90
 * 0.52–0.58 and lost SSIM every time: B −0.009…−0.011, A −0.005, D −0.001. The per-window map
 * (gauntlet compare's 8×8 windows on 256×144) shows why: where the reference is a smooth mass,
 * its window variance is ≈ 0.0005 and the structure term (2 cov + C2) / (va + vb + C2) pays
 * ≈ 0.5 for our smooth haze but ≈ 0.1 for textured leaf clusters at 8–10 m (va ≈ 0.01), while the
 * luminance term forgives the haze's 0.58 against the reference's 0.42 at 0.95. The lobes gained
 * only over B's top-left cells (x 0–0.2, y 0–0.17: +0.13, +0.06 per cell), where they replaced
 * the lantern tree's hard limb-against-haze edges, and lost −0.17…−0.23 per cell over x 0.2–0.5
 * (smooth haze in both frames before) and −0.06…−0.12 per cell over A's left quadrant. The box
 * can only be closed by something as smooth as the haze itself (the reference's mass is
 * in-scattered mist, ≈ 0.42 with no texture), which foliage at 8–10 m is not; leaving it open is
 * the better score until the atmosphere renders the near air closer to the reference.
 *
 * Plateau lip (round 9): reference F (8 s) has a dark leaf mass from the stair top to the right
 * edge (x 0.5–1.0, y 0.05–0.35); the east giant's two low limbs already give x 0.7–1.0 but the
 * haze showed between them and the house (F (0.5–0.7, 0.1–0.2) 0.44 against 0.30; (0.55–0.7,
 * 0.2–0.35) 0.35 against 0.26). A third, west bough (from 9.6 m to (17.6, 8.2, −2.4)) hangs two
 * lobes over the lip at (19.2, 7.8, −1.2) and (17.9, 7.3, −2.5): F (0.55–0.7, 0.03–0.18), their
 * shadows on the plateau behind the fence (F (0.63–0.7, 0.24–0.26), reference 0.26). Off B/C/D;
 * A frames the west lobe's edge at (0.84–0.92, 0.1), inside its dark top-right corner (reference
 * (0.85–1, 0–0.1) 0.37, p10 0.10) and short of the bright cell (0.7–0.85, 0–0.15) that must stay.
 * Same-tree A/B: F (0.5–0.7, 0–0.2) 0.42 → 0.37 (reference 0.37), per-window SSIM +0.12 over the
 * cell F (0.6–0.7, 0–0.17) and +0.12 over A's top-right corner cell, ≈ +0.002 on each frame's
 * total. F x 0.4–0.5 (haze over the stairs, 0.58 against 0.44) is left: any caster there sits in
 * A's bright cell.
 *
 * Plaza roof (round 14, for the lighting owner): the reference plaza is dapple — frame 1 s has
 * sun pools 1–2 m across over ≈ 40 % of the paving, 14 s / 46 s keep the path north of it in
 * dappled shade with Link's shadow on lit stone — while ours read an even sheet of sun: a
 * top-down sun-on/off map had 99.5 % of shot A's plaza box (0.2–0.75, 0.75–0.99 = world
 * (0.3–5.3, 1.5–5.8)) lit, one 4.6 m patch. Nothing stands on those sun rays 10–25 m up: the
 * lantern tree's bole is sheared out of them (GIANT_PROFILES) and its crown lobes (17–26 m,
 * shifted toward the plaza) cast onto the east bank, the north-west-near giant leans away to the
 * north-west, and the white-barks keep off the plaza lines. The caster that shades a plaza point
 * (x, z) from height Y stands at (x − 1.008 Y, z − 0.787 Y): for the box at Y 13.5 that is the
 * patch (−13 … −8, −10 … −4.5), 2–7 m east of the sheared bole (≈ (−14, −4) at that height).
 * One bough of the lantern tree leaves the bole at 11 m and runs 7.5 m ACROSS the sun (toward
 * (+x, −z)), so its wood's shadow is one band (−2.6, 4.2) → (0.75, −2.5) west of the box (a
 * bough's grown bole has its own 1–3° random lean, so its axis is only known to ≈ 0.6 m; the
 * first cut's three boughs crossed three of their own openings' sun lines). Three small lobes
 * (hR 0.8–1.2, density 3, ≈ 55 cards each, a 3-layer cluster the soft filter resolves from
 * 12 m) stand 1.5–2 m above it on short stems. Where they shade is read off the reference
 * frames cell by cell (16 × 6 luminance grid of A and F against the same-tree control, cells
 * unprojected to the paving): the plaza box itself is LIT in both frames — A rows 0.75–1.0 are
 * 0.54–0.65 from x 0.19 to 0.81 (control 0.50–0.62) and F's brightest paving is its centre
 * (0.31–0.5, 0.67–0.92: 0.53–0.73) — while the strip WEST of the box (A x < 0.13 = world
 * (−1.2 … −0.1, 1.4–4.3): 0.30–0.40 against the control's 0.51–0.56) and the path mouth NORTH of
 * it (F (0.125–0.25, 0.83) = world (2.3–2.5, 0–1.0): 0.21–0.35 against 0.37) are in leaf shade.
 * So two hR 0.8 lobes land ≈ 1.6 × 2.6 m ellipses at (−1.0, 3.8) and (−1.0, 2.0) — a strip
 * x −2.1 … 0.1, z 1–4.8 whose only spill east of x −0.2 is the ellipses' tips — and an hR 1.2
 * lobe a ≈ 2.4 × 3.9 m patch at (2.4, −0.8), reaching z 0.7 at most; the box's lit middle is
 * listed as the big pool of CANOPY_OPENINGS (corridors.ts) so the collars pack the lobes' rims
 * and the shaft mask knows the gap. Two earlier cuts were measured and rejected: a roof of five
 * hR 2–2.2 lobes over the whole box (A +0.002 but F −0.0044 / C −0.0016 SSIM, F's bright
 * centre darkened) and one shading the box's west third plus its north edge (A +0.0008,
 * F −0.0030 / C −0.0021: the reference's shade stops at x ≈ −0.1, the cells x 0.13–0.31 it
 * darkened are the reference's brightest). The dark spot east of the box ((6–7, 1.5–3), both
 * frames) has no caster reachable without a stem or bough shadow across the lit middle and is
 * left. The flight roof is a
 * fourth bough of the north-west-near giant (appended, so the three older boughs draw the same
 * stream) with two small dense lobes on the sun lines of treads 4 and 8: the shade bands between
 * the flight's three pools (its own casters, the round-7c dapple lobes, lit the lower run as one
 * 7.4 m sheet and blacked out the top). Every bough and lobe is outside all six hero frames
 * (A/B/D: ≥ 61° off the view axis against a 41–44° half-diagonal, or above the frame top; C/F:
 * behind the camera), so they act only through the shadow map and the shaft mask; the lantern
 * limb, built earlier from the main stream, is untouched (audit lanternLimb* identical). The
 * Link A/D sun rays (LINK_SHADOW_RAYS) carve Link's own pools through the lobes as before.
 *
 * Shot D's top-right limb (round 31): frame 56 s has a big dark limb with leaf masses coming in
 * from the right across D's top-right (x 0.75–1.0, y 0–0.12, p10 0.14) over a dark hazed mass
 * (x 0.85–1.0, y 0.12–0.3: 0.26) — and no house. Ours showed the UPPER HOUSE (layout (13.5, 5.4,
 * −17.5), 16–21 m from camera D) there as a lit tree-house: its west-wall window at D (0.83,
 * 0.15), its cap at (0.86–0.96, 0–0.07), its wall at (0.78–0.95, 0.07–0.35), and behind it the
 * north-east hut's lamps at (0.72, 0.14). Anything hung between camera D and that house at
 * 8–14 m sits in B's centre-right (0.5–0.66, 0.15–0.35) and A's upper centre (0.4–0.5, 0.17–0.3):
 * reference B has exactly that — the giant's limb curling down from the top-right onto Saria's
 * roof (B (0.55–0.75, 0.05–0.27), 0.32–0.38) — and reference A is darker than ours there (0.41
 * against 0.45). The only giant behind the house on D's right is the plateau-oak (D x 1.02 at
 * 20 m): its bough leaves at 17 m (just under the fork), passes 2.7 m over the house's mossed cap
 * (14.4 m at x 13.5; the pow-1.7 droop stays high until the last third) and plunges to (5.5, 5,
 * −11) — in D the wood comes toward the camera down its right edge and only the plunge shows, so
 * the dark mass is the lobes: three dense eye-detail leaf curtains 10–13 m from camera D on the
 * house's window / cap, its wall (and, at the frame's right edge behind it, Saria's house's west
 * window and pod), and the north-east hut's line. Their leaves are darkened two ways: tone 0.42
 * on the leaf colours, and `shade` 0.3 — the share of the leaf shaders' shade fill (sky
 * transmission, ambient fill, the flat LEAF_FLOOR) they keep. The first cut with tone 0.55 alone
 * measured 0.38–0.42 in D where the reference mass is 0.26–0.31: a shaded lamina sits on the
 * flat floor (≈ 0.36 whatever its colour) plus 20 % veil at 10 m, so no tone reaches the
 * reference's dark; the fill share does (tone 0.5 / shade 0.35: the mass 0.31, the top-right
 * box (0.8–1, 0–0.3) 0.364 → 0.316 against the frame's 0.303), and the direct sun on the lobes'
 * west faces is left as it is. Their shadows land on the plateau in front of Saria's house and on the upper house's own
 * shadow (x 8–12, z −9…−7), off the plaza, the D path and every sun point. Off C (behind) and F
 * (x < −0.1); in B they hang at (0.5–0.66, 0.15–0.4) in front of Saria's roof's west end, where
 * reference B has the giant's limb and its leaf masses curling onto the roof; in A at (0.4–0.46,
 * 0.22–0.37), 20 m out, under the upper house's roof line (A's ray to the house passes 4 m east
 * of them).
 *
 * The hollow-column and west-column huts (D (0.64, 0.08) and (0.28, 0.17)) cannot be hidden by
 * anything near them: cameras A, B and D stand within 12 m of each other on the path's axis and
 * see each hut under bearings 3–6° apart (hollow-column: D −18.7°, B −16°, A −12.5°; west-column:
 * 11.7°, 9.7°, 8.7°). But the three rays to a hut's lamps fan out toward the cameras — 8–10 m
 * from camera D, B's ray passes 1.3 m and A's 2 m from D's — so one clump of hR ≤ 0.55 on D's ray
 * there covers the lamps for D alone. Two such clumps (plateau-oak t 1.0, lantern-tree round 31,
 * below) do that, with each hut's walkway turned onto D's bearing so its pods stack under the
 * window (structures distantHouse.ts). They stand in the frame's bright haze (0.55–0.61 at those
 * points), so they are as small as covers the lamps and ordinary leaves, not shade curtains.
 */
const CANOPY_BOUGHS: { giant: string; fromY: number; to: [number, number, number]; radius: number; tipRadius?: number; ghostWood?: boolean; dress?: CanopyBough['dress']; lobes: { t: number; center: [number, number, number]; hR: number; vR: number; density?: number; tone?: number; eye?: number; shade?: number; corridors?: boolean; compact?: boolean; castShadow?: boolean; flat?: boolean; core?: number; floor?: number; layeredCore?: { leaves: number; twigs: number } }[] }[] = [
  // Round 33: the four north-west-near boughs leave at 18.4–19 m instead of 11.8–13.2 (above the
  // fork, from the sheared axis' top at (−10, −21.4)). The sun lines through shot D's air box
  // (x 0.35–0.75, y 0.10–0.27; air 2.5–11 m up over the path) climb WNW at 38°: at height Y they
  // pass x ≈ −1 − 1.008 (Y − 4) … 4 − 1.008 (Y − 4), z ≈ −8 − 0.787 (Y − 4) … −18 − 0.787 (Y − 4).
  // Leaving the axis at 12–13 m the boughs ran level EAST straight through that slab (x −9 … −4 at
  // y 12) for 5–6 m each — the ray-cast attribution (round-33 probe) put ≈ 50 % of this giant's
  // shading of the box's in-scatter on them. At 18.6 m the slab is at x ≤ −10.6, west of the
  // origin, and the boughs run east away from it; the lobes are the same world points (their
  // stems now hang 3–4 m instead of rising 3 m). The bough wood's ground bands start at (8.6, −6.8)
  // instead of (2.4–3.2, −11), i.e. off the D path's first sun pool onto the plateau slope, and
  // cross the hero flight where they did (treads 14–18; the Saria bough's band, which passed the
  // top, now crosses tread 18). Above every hero frame's top edge as before (D: 38° up at 21 m).
  {
    giant: 'north-west-near',
    fromY: 18.6,
    to: [3.6, 15.4, -14.6],
    radius: 0.45,
    lobes: [
      { t: 0.62, center: [-0.6, 16.2, -13.7], hR: 2.4, vR: 1.5, density: 0.6, eye: 0 },
      { t: 0.92, center: [2.6, 16.4, -14.4], hR: 2.4, vR: 1.5, density: 0.6, eye: 0 },
    ],
  },
  // Saria's roof: casters on the sun lines of the dome (crown → eaves = east → west along the line)
  {
    giant: 'north-west-near',
    fromY: 18.6,
    to: [5.5, 15.8, -17.6],
    radius: 0.45,
    lobes: [
      { t: 0.51, center: [-0.9, 16.4, -22.0], hR: 3.2, vR: 2.0, density: 4, eye: 0 },
      { t: 0.68, center: [1.3, 16.4, -20.3], hR: 3.2, vR: 2.0, density: 4, eye: 0 },
      { t: 0.85, center: [3.5, 16.4, -18.6], hR: 3.2, vR: 2.0, density: 4, eye: 0 },
      { t: 0.98, center: [5.2, 16.4, -17.3], hR: 3.2, vR: 2.0, density: 4, eye: 0 },
    ],
  },
  // the upper house's roof
  {
    giant: 'north-west-near',
    fromY: 19.0,
    to: [5.6, 18.6, -24.4],
    radius: 0.4,
    lobes: [
      { t: 0.77, center: [1.6, 19.0, -26.8], hR: 3.2, vR: 1.8, density: 4, eye: 0 },
      { t: 0.88, center: [3.6, 19.0, -25.2], hR: 3.2, vR: 1.8, density: 4, eye: 0 },
      { t: 0.96, center: [5.0, 19.0, -24.1], hR: 2.6, vR: 1.8, density: 4, eye: 0 },
    ],
  },
  // the plateau-lip canopy of shot F (round 9): a bough of the east giant, its two lobes the
  // hazed canopy the reference shows over the stair top (F x 0.35–0.6, y 0–0.2; frame 8 s reads
  // 0.42–0.49 there at window sd 0.005–0.03, a smooth veil).
  // Round 45 (vegetation-23's finding, survey crop 15 / pose w27-plateau-r): the lobes hung at
  // (19.2, 7.8, −1.2) hR 2.4 vR 1.3 and (17.9, 7.3, −2.5) hR 2.2 vR 1.2 — ellipsoid undersides
  // 6.5 / 6.1 m, 1.0 / 0.7 m over the highest ground under their footprints (5.46 / 5.40), their
  // twigs' leaves down to 5.5 m over the fenced plateau top (the walk's eye is 6.6 m) at the end
  // of a west bough whose wood ran 0.6–2.3 m over the same ground. Each lobe moved out along ITS
  // OWN camera-F ray (F stands at (−1.96, 1.8, 4.0)): centre → F + k (centre − F), radii × k, so
  // F frames the same disc at the same place (L1 (0.49, 0.09), L2 (0.44, 0.10)) — k 1.40 / 1.50
  // (31.6 / 32.4 m out instead of 22.6 / 21.6) put the ellipsoid undersides at 8.38 / 8.25 m,
  // 2.76 / 2.75 m over the highest ground under their footprints (5.62 at (28.1, −0.4) / 5.50 at
  // (30.0, −3.3): the plateau north of the east giant's foot), and the lobes are FLOORED at 8.1
  // (`floor`, giant.ts lobeFloorY: no lamina, card, core vertex or twig below it — the twigs droop
  // ~2 m under an unfloored lobe), 2.4+ m over every ground point under them. Built FLAT with an
  // opaque CORE like the bank canopy below (flat + core 0.97, corridor-exempt): the first
  // round-45 take moved them to 38–40 m as ordinary lobes (k 1.70 / 1.86, density 3) and F lost
  // 0.0049 — at that depth the cluster cards no longer close and the mass broke into leaf
  // clumps against the bright haze (window sd 0.07–0.13 where cap-0's even mass had 0.006–0.02
  // and the frame 0.005–0.03; SSIM's structure term, cells (0.375–0.625, 0–0.17): −0.0049 of
  // it). The core is one even body whatever the distance. Tone 0.85 × shade 0.5 (the bank
  // canopy's 0.6 × 0.4 is fitted to frame darks of 0.19–0.23 at 13 m): unveiled ≈ 0.25, under the
  // 38 % veil at 32 m ≈ 0.38 against the frame's 0.42–0.49. The bough leaves the bole at 12.2 m
  // and runs 12.5 m north over the plateau (wood 9.8–12.2 m over 5.3–5.6 m ground). A's
  // top-right corner, which L2's dark rim filled at 22 m (A (0.96, 0.05) ± 0.08 at 0.31 against
  // the frame's 0.30), is the bank canopy's corner lobe's now (stair-bank-giant, below): L2 here
  // is at A (1.04, 0.02), only its north-west rim in the frame.
  {
    giant: 'east-giant',
    fromY: 12.2,
    to: [28.0, 9.8, -7.5],
    radius: 0.5,
    lobes: [
      { t: 0.6, center: [27.66, 10.2, -3.28], hR: 3.36, vR: 1.82, density: 1, tone: 0.85, eye: 0, shade: 0.5, corridors: false, castShadow: false, flat: true, core: 0.97, floor: 8.1 },
      { t: 0.95, center: [27.83, 10.05, -5.75], hR: 3.3, vR: 1.8, density: 1, tone: 0.85, eye: 0, shade: 0.5, corridors: false, castShadow: false, flat: true, core: 0.97, floor: 8.1 },
    ],
  },
  // Round 51 (fable-4; opus #05 / fable-5 walk #4 / round-50 #7 — "look up and the sky is open
  // blue": `w27-plateau-u` at (19.4, 6.6, −3.6) had 20–22 % saturated blue over the plateau, the
  // crowns only at the frame's edges; the reference has no blue sky). A second east-giant bough,
  // leaving the bole at 16.5 m and running 8 m west over the plateau, with two ordinary lobes over
  // the look-up's zenith at 16–17 m. Non-casting (the lobes go to the authored writer): no ground
  // shade moves in any frame; the wood's shadow band (ground = point + (1.0, 0.79) × height at
  // this sun) lands at x 36–44, z 6–10, east of the giant, off every fixed camera. Above A's and
  // F's top edges (measured: six views within 0.0002).
  {
    giant: 'east-giant',
    fromY: 16.5,
    to: [13.4, 16.2, -1.6],
    radius: 0.5,
    tipRadius: 0.2,
    lobes: [
      { t: 0.4, center: [23.0, 16.6, -4.2], hR: 3.2, vR: 1.9, density: 1, castShadow: false },
      { t: 0.6, center: [19.3, 16.0, -3.2], hR: 3.5, vR: 2.0, density: 1, castShadow: false },
      // the blue west of the zenith (screen (0.69, 0.10) of the look-up → (16, 17, −4.5))
      { t: 0.78, center: [16.2, 17.0, -4.6], hR: 3.3, vR: 1.9, density: 1, castShadow: false },
      // … and the look-up's far corner (screen (0.85, 0.15) → (13.8, 17, −2.2); (0.85, 0.5) →
      // (15.4, 17, 0.4)): the bough runs on 4 m to the plateau's west edge. Projected into A / F
      // the lobes' undersides sit at screen y −0.49 … −0.68 — above the frames.
      { t: 0.93, center: [13.8, 17.2, -2.0], hR: 3.2, vR: 1.9, density: 1, castShadow: false },
      { t: 0.99, center: [15.2, 16.4, 0.6], hR: 3.0, vR: 1.8, density: 1, castShadow: false },
    ],
  },
  // … and a short second bough north for the blue east of it (screen (0.19, 0.4) → (25.5, 17, −6.5)),
  // 11 m north of the bole where neither this giant's crown nor the plateau oak's reaches
  {
    giant: 'east-giant',
    fromY: 15.4,
    to: [25.6, 15.6, -6.2],
    radius: 0.4,
    tipRadius: 0.2,
    lobes: [{ t: 0.95, center: [25.5, 16.8, -6.5], hR: 3.2, vR: 1.9, density: 1, castShadow: false }],
  },
  // the plaza roof (round 14): the casters that frame shot A's lit plaza box — one bough across
  // the sun, three small dense lobes above it whose shadows land on the strip west of the box
  // ((-1.0, 3.8) and (-1.0, 2.0), the frame's left edge) and on the path mouth north of it
  // ((2.4, -0.8)); the lit box between them is the CANOPY_OPENINGS pool of corridors.ts.
  // Round 34: frame 1 s read cell by cell (0.5 m, luminance ×100, world cells projected through
  // camera A) — the strip west of the box is shade at x −1…−0.5 for z 2–4 (27–41) and lit at
  // z ≤ 1.5 (46–55), so the second lobe moves 0.4 m north: shadows (−1.0, 3.8) and (−1.0, 2.4),
  // footprints ≈ 1.6 × 2.4 m over x −1.8…−0.2, z 1.3–5. (A cut 0.4 m west, shadows at x −1.4,
  // left x −0.5 lit — sun 16–19 against the control's 3–12 — and cost A's (0.13–0.25, 0.67–0.83)
  // cell 0.0025 SSIM.) The frame's plaza shade box (0.30–0.40, 0.64–0.72) is 4.7 % lit (ours
  // 14 %): its dark core x 3–4.5, z −1…2 is ours already (this bough's tip lobe with the limb
  // lobe and the north-west-near crown), its west half x 1.2–3, z −0.5…2.5 (30–39 against lit
  // 46–62) was not — the two "plaza shade" boughs (last in this list) cast it. The frame's patch, read at 0.5 m: x 1.5–3.5, z −3…1.5 (30–39) with the path mouth
  // west of it, x −1…1, z −3…0.5, lit (42–59) up to a straight edge at x ≈ 1.5. Two things of
  // this bough shaded that mouth (sun-eye attribution, 100 m sun-axis depth image): its own wood
  // — 0.5 m at 10.4–11 m, whose band ((−2.7, 4.4) → (0.7, −2.5)) crossed the mouth at x 0–0.7,
  // z −2.5…−1 and the plaza at (−0.7, 0.4), (−0.2, −0.6), where the frame is lit 51–55 — and
  // the tip lobe's footprint (2.4 × 3.6 m along the sun, centred (2.4, −0.8)), whose west edge
  // stood at x 0.8. The wood is ghosted (its lobes and their stems stay, the draws too; the
  // bough is above every hero frame: A (−0.37, −0.34), B (−0.52, −0.68), D (−0.49, −0.93) for
  // its tip) and the tip lobe moves 0.7 m east, footprint x 1.5–4.7: the patch's west edge.
  {
    giant: 'lantern-tree',
    fromY: 11.0,
    to: [-9.75, 10.4, -10.7],
    radius: 0.5,
    ghostWood: true,
    lobes: [
      { t: 0.25, center: [-13.6, 12.5, -6.0], hR: 0.8, vR: 0.7, density: 3, eye: 0 },
      { t: 0.54, center: [-13.6, 12.5, -7.4], hR: 0.8, vR: 0.7, density: 3, eye: 0 },
      { t: 0.97, center: [-9.5, 12.5, -10.6], hR: 1.2, vR: 1.0, density: 3, eye: 0 },
    ],
  },
  // the flight roof (round 14): two small dense lobes whose shadows are the bands between the
  // hero flight's three sun pools — treads 4 (a ≈ 2.6–5.4 m up the run) and 8 (a ≈ 7.2–9.2 m)
  {
    giant: 'north-west-near',
    fromY: 18.6,
    to: [0.0, 15.6, -16.0],
    radius: 0.45,
    lobes: [
      { t: 0.75, center: [-3.65, 16.0, -13.6], hR: 1.4, vR: 1.1, density: 3, eye: 0 },
      { t: 0.97, center: [1.8, 16.0, -14.5], hR: 1.1, vR: 1.0, density: 3, eye: 0 },
    ],
  },
  // shot D's top-right limb (round 31, see above): the plateau-oak's bough over the upper house,
  // its curtains between camera D and the house's window / cap (t 0.95), its wall (t 0.97) and
  // the north-east hut (t 0.9). The wood at s ≈ 0.9 runs along camera A's ray to the north-east
  // hut's window (A (0.45, 0.13), 45 m): its centre line 0.009 of the frame height off the window,
  // its hazed edge on it. Round 32 tried the tip at (6.5, 5, −10) and (7, 5, −10) (centre line
  // 0.008 the other side / 0.032 clear, wood 0.014 clear) and kept this one: the window is not
  // in the picture either way — at 45 m the haze leaves the hut's pixels at 0.45 with or without
  // the wood (identical to the byte), the frame's lit point is a soft +0.08 at (0.455, 0.097)
  // the hut does not make, the control's two warm pixels beside the wood were its own sunlit rim
  // — and the moved tip lengthens the tip clump's stem, which grows the merged authored-leaves
  // mesh's bounding sphere into camera F's left frustum plane: F +1 draw / +0.28 M triangles
  // (505 / 8.13 M → 506 / 8.41 M) for nothing visible.
  // Round 40 (the owner's markup on our frame A: "the smooth diagonal trunk above Saria's house"):
  // camera A sees this bough's last fifth — s 0.82–1.0, the droop from (8, 10.5, −13) to the tip,
  // A (0.455, −0.03) → (0.394, 0.24) at 20–22 m, 0.6–0.7 m thick — as one smooth pale pipe. Dressed
  // (giant.ts CanopyBough.dress): a relief sweep with cords following the taper, furrow occlusion
  // and lichen plates, a moss sheet along its upper side with a ragged edge, and two knees on the
  // visible run — s 0.87 (≈ (7.3, 8.9, −12.3)) with a 2.4 m broken fork leaving up and to the
  // north-west (A's screen-left, against the haze), s 0.95 (≈ (6.2, 6.4, −11.5)) a burl with a
  // short stub to the south-east. The lobes and their stems below are exactly what they were.
  {
    giant: 'plateau-oak',
    fromY: 17.0,
    to: [5.5, 5.0, -11.0],
    radius: 0.55,
    tipRadius: 0.3,
    dress: {
      relief: 1,
      moss: 0.85,
      lichen: 0.7,
      knees: [
        { s: 0.87, side: 1, up: 0.6, reach: 0.4, halfWidth: 0.8, stubLength: 2.4, stubRadius: 0.32, stubPitch: 0.35 },
        { s: 0.95, side: -1, up: 0.3, reach: 0.3, halfWidth: 0.6, stubLength: 1.3, stubRadius: 0.28, stubPitch: 0.5 },
      ],
    },
    lobes: [
      // D (0.86, 0.10) at 10.5 m: the house's west-wall window (0.83, 0.15) and its cap (0.86–0.96, 0–0.07)
      { t: 0.95, center: [6.0, 4.8, -11.0], hR: 1.7, vR: 1.3, density: 3.5, tone: 0.42, eye: 1, shade: 0.3, castShadow: false },
      // D (0.97, 0.28) at 10.5 m: the wall (0.85–1.0, 0.13–0.43), and at the frame's right edge Saria's
      // house's west window (0.985, 0.30) and its pod lantern (0.93, 0.36), 13–15 m behind it
      { t: 0.97, center: [7.4, 3.4, -10.6], hR: 1.8, vR: 1.4, density: 3.5, tone: 0.42, eye: 1, shade: 0.3, castShadow: false },
      // D (0.74, 0.12) at 12 m: the north-east hut's window / door / eave pod (0.72–0.75, 0.13–0.15)
      { t: 0.9, center: [5.6, 5.5, -13.3], hR: 1.3, vR: 1.0, density: 3, tone: 0.42, eye: 1, shade: 0.3, castShadow: false },
      // D (0.64, 0.08) at 8 m, a 3 m twig west off the tip: the hollow-column hut's window, door,
      // eave pod and (structures distantHouse.ts, its walkway turned onto camera D's bearing) its
      // end-post pod, D (0.62–0.66, 0.07–0.10) at 20–24 m. B sees the clump at (0.42, 0.23) — the
      // hut's lamps there are (0.47, 0.14–0.15), 1.3 m off the ray at 12 m — and A at (0.30,
      // 0.25) against (0.35–0.38, 0.11–0.12). As small as covers the lamps (0.8 m: ±0.03 of D's
      // width, the lamps ±0.02 of its centre) and ordinary leaves, not a shade curtain: it stands
      // in the frame's bright haze (0.56 there), where a 1.1 m tone-0.7 clump read 0.33 over 1 %
      // of the frame and cost D 0.008 and B 0.007 SSIM. It sits 0.4 m off the axis of the third
      // HOLLOW_GAP view line (the same ray, 25 m short of the gap), so it is corridor-exempt —
      // the first cut lost it to the line's 0.15 porosity and the hut's lamps stayed. Compact:
      // built as an ordinary lobe the 0.4 m spec came out 2.6 m across (the cards' 0.4 m half-size
      // floor, the twigs' 0.6 m drop, the 0.85 m sprigs, leaves along the whole 3 m twig) — a pale
      // blob over D (0.56–0.75, 0–0.28), 4 % of the frame, in the reference's brightest haze.
      { t: 1.0, center: [2.68, 4.52, -10.19], hR: 0.4, vR: 0.4, density: 3, eye: 1, corridors: false, compact: true, castShadow: false },
      // three compact plugs in the curtains' cores, each on camera D's ray to a lamp the curtains
      // must hide — the upper house's west window (0.83, 0.15), Saria's west window (0.985, 0.30),
      // the north-east hut's lamps (0.735, 0.14): a curtain's leaves and cards are drawn at random
      // over its ellipsoid, and a re-roll of the tree's stream (any edit upstream of these lobes)
      // opened one 3-pixel pinhole on each of the first two rays (peaks 0.67 / 0.65 — lamps to the
      // classifier). Same tone and shade as their curtains, so they read as more of the same mass.
      // Last in the list, so the clump above is built as before. Density 1 (was 3; the round-31
      // budget, see the castShadow note on the giants' meshes): a lobe's laminae count does not
      // scale with its size, so a 0.5 m plug at density 3 carried as many as a 1.8 m curtain
      // (6.5 k, 17× the leaf area of its own surface); at 1 it keeps ~2.2 k, ~6× its surface,
      // inside a curtain that already covers the ray. The hollow-column clump above keeps 3: its
      // hut's end-post pod hangs 0.018 of D's width from the clump's centre, near its edge, and at
      // 1.5 the ray's peak went 0.42 -> 0.62 (a lamp to the classifier); the lantern tree's clump
      // (below), whose lamps sit on its centre, keeps 1.5 (peaks 0.46 / 0.44).
      { t: 0.96, center: [5.83, 4.54, -11.31], hR: 0.5, vR: 0.5, density: 1, tone: 0.42, eye: 1, shade: 0.3, corridors: false, compact: true, castShadow: false },
      { t: 0.98, center: [7.05, 3.11, -10.1], hR: 0.5, vR: 0.5, density: 1, tone: 0.42, eye: 1, shade: 0.3, corridors: false, compact: true, castShadow: false },
      { t: 0.92, center: [5.35, 5.26, -13.15], hR: 0.5, vR: 0.5, density: 1, tone: 0.42, eye: 1, shade: 0.3, corridors: false, compact: true, castShadow: false },
    ],
  },
  // shot D's west-column hut (round 31): a thin limb of the lantern tree over the north verge, wood
  // above every frame's top (D y < −0.37, B < −0.16, A < −0.05), whose tip drops a 4.6 m twig to one
  // small clump on camera D's ray to the hut's lamps — D (0.28, 0.17) at 9 m, covering the window,
  // door and (walkway turned onto D's bearing) end-post pod at (0.274–0.291, 0.16–0.19), 24–29 m
  // out. B sees the clump at (0.16, 0.25), its lamps at (0.11–0.13, 0.15–0.17); A at (0.11, 0.26)
  // against (0.07, 0.155). Sized and toned like the hollow-column clump above. Corridor-exempt: every point of D's ray 8–14 m out lies
  // 1.5–2.1 m off the axis of the D_PATH_SUN_POINTS (0.5, −10) r 2.2 sun line (the ray and the
  // sun line run almost parallel there) and 8–10 m out inside the first HOLLOW_GAP view line
  // too, so the first cut lost the clump to their porosity. Its shadow lands at (2.5, −8.9) on
  // the path's east half — a 1 m dapple inside that sun pool's 4.4 × 7.2 m ellipse (the
  // reference's lit run is leaf-dappled) and 1.9 m across the sun from Link's D pool's axis
  // (corridors.ts (2.2, −6.7) r 1.5), outside it.
  // Round 34 (measured, kept): its 0.3–0.5 m wood at 9–9.5 m lays a band ((−3.8, 2.9) → (6.9,
  // −4.8), through (0, 0.2), (1, −0.55), (2, −1.3), (3, −2.0), (4, −2.7)) across two frames' lit
  // paving — 32 % of shot A's path mouth (x 0–1.5, z −1.5…−0.5; frame 1 s 0.46–0.59) and 23 % of
  // shot B's east path (x 4–5.5, z −3.5…−2; frame 14 s 0.45–0.69), by the sun-eye attribution.
  // Ghosting the wood (giant.ts ghostWood; the twig and clump stay) measured A −0.0012 and B
  // −0.0005 against the same build with it, for +1 point of A's lit share: the band's shade is
  // where the metric reads our lit slabs' texture as contrast the frame's soft paving lacks. Kept.
  {
    giant: 'lantern-tree',
    fromY: 9.5,
    to: [-2.2, 9.0, -11.9],
    radius: 0.3,
    tipRadius: 0.12,
    lobes: [{ t: 1.0, center: [-1.92, 4.4, -12.32], hR: 0.35, vR: 0.4, density: 1.5, eye: 1, corridors: false, compact: true, castShadow: false }],
  },
  // shot A's plaza shade (round 34): frame 1 s has one shade patch on the plaza, its box
  // (0.30–0.40, 0.64–0.72) 4.7 % lit — world x 1.2–4.5, z −1.5…2.5 read cell by cell (luminance
  // 15–39 against the lit paving's 46–62). Its dark core x 3–4.5, z −1…2 is ours (the plaza-roof
  // tip lobe, the limb lobe and the north-west-near crown), its west half x 1.2–3, z −0.5…2.5 was
  // lit (44–57) between the house bough's band and the lobes'. This lobe casts that half: a compact
  // hR 1.0 clump 12.5 m up whose shadow ellipse (2 m across, 3 m along the sun) is centred on
  // (2.9, 0.9) — footprint x 1.55–4.25, z −0.3…2.1, its west edge on the frame's patch edge
  // (x 1.5; a first cut centred (2.1, 0.9) reached x 0.75 and shaded the lit mouth's x 0.4–1.5,
  // 29 % of the mouth's shade). The bough that carries it ends 0.4 m short of the clump and its
  // wood is ghosted (giant.ts ghostWood: the stem, the clump and every draw stay): a first cut
  // ended 3.2 m west of the clump, and the stem's 3 m of twig at 12–12.5 m laid its own line
  // across the mouth, (−1.6, −0.3) → (2.1, 0.9). The shade lands on the box's lit-middle pool
  // (2.7, 3.0) r 2.2 (corridors.ts), which would cull it: corridor-exempt. Last in this list,
  // so every lobe above — the round-31 hut clump included — keeps its draws and its leaf
  // ordinals. No hero camera sees it (A (−0.45, −0.68), B/E (−0.68, −1.28), D (−0.78, −1.85);
  // behind C and F).
  {
    giant: 'lantern-tree',
    fromY: 12.0,
    to: [-10.1, 12.3, -9.15],
    radius: 0.35,
    tipRadius: 0.12,
    ghostWood: true,
    lobes: [{ t: 0.97, center: [-9.7, 12.5, -8.95], hR: 1.0, vR: 0.9, density: 3, eye: 0, compact: true, corridors: false }],
  },
  // Not listed — the same patch's north end (round 34): frame 1 s keeps x 1.5–3.5 in shade up to
  // z −3.5 (0.33–0.37 at z −3.5…−2, the mouth west of x 1 lit 0.52–0.59), and ours is lit there
  // once the plaza-roof bough's band went and its tip lobe moved east (sun 0.08–0.15 at x 1.5–2,
  // z −3.5…−2). A compact hR 0.8 clump 12.5 m up at (−10.25, 12.5, −12.34), footprint 2.1 × 2.4 m
  // centred (2.35, −2.5), shaded it — and its shadow column passed 0.94 m from camera D
  // (0.2, 1.45, −3.0): the sun line of the patch's north end runs through D's own air (the line
  // through (2.35, 0, −2.5) is at (0.9, 1.45, −3.64) at head height), so the god-ray march's first
  // steps, which the extinction weights most, went dark for every ray of D's upper left and D
  // read −0.0014 (0.3474 → 0.3460; its left third −1…−3 luminance, the top-left cell −6/255).
  // Moved to 1.54 m from the camera (footprint (2.7, −3.0), hR 0.7) it still read −0.0005 with
  // pHash 28 → 30; without it D is +0.0002. Any caster on that footprint's sun lines has the same
  // column (the lines pass 1–1.5 m from D at 1.4–3 m up), so the north end stays lit.
  //
  // Shot A's second shade patch (round 36): frame 1 s's paving right of Link, box (0.55–0.75,
  // 0.64–0.75) = the ground x 3.5–8, z −0.4…3.6, read cell by cell (two-mean split, 0.5 m cells
  // projected through camera A): lit in a diagonal run from (5–6, 0) through (4.5–6, 1.5) to
  // (3.5–5, 3.5), shade EAST of it — x 6–8.5 at z 0–1.5, x 5.5–7.5 at z 2–2.5, x 4.5–7 at z 3 —
  // with one lit island at (7.5–8.5, 2–3.5). The control's sun reached 99.8 % of the box (base −
  // sun-off mask), its casters (sun-eye attribution, 100 m sun-axis depth image) only the lantern
  // limb's own dapple 3–6 m up and the lantern crown's at 15–20 m. Two compact clumps 12.5 m up
  // in the lantern tree's crown, off every hero frame (A (−0.26, −0.65), B (−0.44, …), D (−0.7,
  // …), behind C and F), on ghosted-wood boughs that end 0.4 m short of them (a stem's twig at
  // 12–12.5 m lays its own line, round 34):
  // - footprint (7.1, 0.9), hR 0.7: an ellipse 1.4 m across × 2.3 m along the sun, x 5.9–8.3,
  //   z −0.3…2.1 — the frame's shade beside the stair foot. Its sun line passes camera D 6.1 m
  //   off at head height (the round-34 lesson: within 1.5 m it darkens the god-ray march's first
  //   steps), camera B 6.0 m off (the column enters B's frustum 4.6 m out, at B (0.88, 0.12) 3 m
  //   up, as the plaza-shade clump's does at (0.24, 0.12)), camera A 7.7 m off.
  // - footprint (5.8, 3.0), hR 0.7: x 4.6–7.0, z 1.8–4.2 — the frame's shade at (4.5–7, 2.5–3.5).
  //   Its line passes D 6.3 m off, B 4.2 m off (outside B's frame), A 8.0 m off.
  // Measured (A/B/D captures, same build otherwise): at (7.1, 0.9) + (5.5, 3.0) the patch's SSIM
  // cells (0.63–0.75, 0.5–0.83) +0.024 / +0.059 with (0.50–0.63, 0.67–0.83) −0.026 — the second
  // clump's west end on the lit slabs right of Link — A +0.0031 in all; 0.5 / 0.9 m further east
  // ((7.6, 0.9) + (6.2, 2.6), where the frame's two-mean cells put its shade) +0.025 / −0.014 /
  // +0.005 and (0.75–0.88, 0.67) +0.024, A +0.0026: at 256 × 144 the frame's patch is one broad
  // soft shade over the centre and the stacked pair matches it better than a cell-fitted pair,
  // whose dapple re-rolls with every move. The first pair stays, the second clump 0.3 m east of
  // it so less of its ellipse lands on Link's lit slabs.
  // Six-view cost: shot F (camera (−1.96, 1.8, 4.0) looking east up the stairs) frames the same
  // slabs — the first clump's footprint at F (0.32–0.53, 0.62–0.66), the second's at (0.44–0.67,
  // 0.66–0.72) — and frame 8 s has them lit (0.39 / 0.45 median against our control's 0.36 /
  // 0.33), so F reads −0.0014 (cells (0.25–0.50, 0.5–0.67) −0.011 / −0.022 / −0.015, (0.63–0.75,
  // 0.5–0.83) −0.006 / −0.011) for A's +0.0035: frame 1 s shades these slabs, frame 8 s does not.
  // Density 1 instead of 2 (half the leaves, same ellipse): A +0.0034, F −0.0013 — no trade.
  {
    giant: 'lantern-tree',
    fromY: 12.0,
    to: [-5.95, 12.3, -8.55],
    radius: 0.35,
    tipRadius: 0.12,
    ghostWood: true,
    lobes: [{ t: 0.97, center: [-5.5, 12.5, -8.94], hR: 0.7, vR: 0.7, density: 2, eye: 0, compact: true, corridors: false }],
  },
  {
    giant: 'lantern-tree',
    fromY: 12.0,
    to: [-7.15, 12.3, -6.75],
    radius: 0.35,
    tipRadius: 0.12,
    ghostWood: true,
    lobes: [{ t: 0.97, center: [-6.8, 12.5, -6.84], hR: 0.7, vR: 0.7, density: 2, eye: 0, compact: true, corridors: false }],
  },
  // Shot D's shaded east half (round 36, see D_PATH_SUN_POINTS): a bare bough of the north-west-
  // near giant running NORTH off its leaning axis at 12 m ((−9.6, 12, −20.5): lean 45° toward
  // 245° from 3.5 m), level, 1.1 m thick — its wood's shadow band ((x + 1.008 Y, z + 0.787 Y))
  // runs down the path's east half from (2.5, −11) to (4.1, −16.2). Wood, not leaves, so the band
  // has the frame's straight west edge along the path's axis and no corridor thins it. Above
  // camera D's top edge (the tip at D (0.185, −0.014) at 22 m, the origin (0.05, −0.19)),
  // above-left of B's top-left corner (−0.03), off A, behind C and F.
  // Measured (D captures, same build otherwise). Two boughs at 0.5 m radius: the east strip's
  // cells (0.50–0.88, 0.67–0.83) +0.070 / +0.113 / +0.018 SSIM and (0.63–0.75, 0.5) +0.024 — D
  // +0.0040 in all — with the path-E box's median 0.397 → 0.366 (frame 0.345) and its p90 0.536
  // → 0.441 (0.427); the cost is the god-ray march, whose rays through D's air box (0.35–0.75,
  // 0.10–0.27) cross the shadow slabs 4–6 m up over the path's west edge (any caster of the east
  // strip puts its slab there: the slab of a footprint (x, z) at height h is at (x − 1.008 h,
  // z − 0.787 h); the frame lights that air and shades that ground, which one shadow field cannot
  // do), air p50 0.5526 → 0.5492 against the ≥ 0.55 guard, p90 0.605 → 0.578; B's air at
  // (0.25–0.38, 0.17–0.33), where the same slabs cross its god rays 19 m out, −0.017 (B −0.0005
  // net with the bands' +0.013 on its mid path). Two boughs at 0.4 m: D +0.0024, air p50 0.5498
  // — still short of the guard, and the east cells kept only two thirds of the gain. One bough
  // (the lower, 0.55 m radius: a 1.1 m band from (2.5, −11) to (4.1, −16.2), the strip's west
  // part where the two-mean map still read (2–3.5, −12…−14) lit) is the trade the guard allows:
  // air p50 0.553 → 0.553, p90 0.605 → 0.601, the east cells (0.50–0.75, 0.67–0.83) +0.076 /
  // +0.076, path-E median 0.397 → 0.381, p90 0.536 → 0.453, D +0.0035 with the D pools at the
  // control's points (+0.0025 with them moved west, see D_PATH_SUN_POINTS).
  {
    giant: 'north-west-near',
    fromY: 12.0,
    to: [-8.4, 12.4, -26.0],
    radius: 0.55,
    tipRadius: 0.3,
    lobes: [],
  },
  // The bank canopy (round 38): frame 8 s roofs shot F's right half with a low, dark, SMOOTH leaf
  // mass (x 0.54–0.88, y 0.11–0.44, luminance 0.25–0.36, window sd 0.01–0.02 at 256 × 144; its
  // top row y < 0.11 is sky through the canopy at 0.41–0.47) and frame 46 s has the same mass
  // across shot C's upper left (x 0–0.38, y 0.11–0.44, 0.25–0.36; row 0 is the glow above it at
  // 0.39–0.54); ours showed hazed columns and open haze in both (F 0.33–0.46, C 0.33–0.40). The
  // one volume both cameras see there and A / B do not is the air over the stair-side bank,
  // x 9–15.5, z 2.5–7.5, 2–5 m up (F depth 11–15 m, C 12–14.5 m; A's right frame edge runs
  // x = 0.4 + 1.775 (8.6 − z), so at z ≥ 3.5 everything east of x 9.7 is off A, and the west
  // lobe's tip at A (0.93–1.0, 0–0.4) lands on frame 1 s's dark trunk, 0.19–0.23 against our
  // 0.32; behind B / D / E). Four lobes hang there from ghosted boughs of the stair-bank giant
  // (whose bole is F's right edge and C's hazed trunk at x 0.32), built FLAT with an opaque CORE
  // (CanopyLobe.flat + core; materials.ts LEAF_FLAT_*, giant.ts lobeCore).
  // Why a core: the measure that decides these bands is SSIM's structure term,
  // (2 cov + C2) / (va + vb + C2) with C2 = (0.03)², and the frame's mass has window sd 0.01–0.02
  // — so the body must be opaque AND even at 40 px. Everything made of leaves fell short of that:
  // laminae sprays (v1: means within 0.02 of the frame, C −0.011 / F −0.009, sd 0.03–0.05), then
  // flat cards without sun or jitter (v3–v5: nine layers of 0.5–1.7 m cluster cards, sd 0.02–0.03
  // through the map's holes and the edges between cards — the v5 capture gained F +0.0014 and
  // lost C −0.0044, its C cells at sd 0.02 against the frame's 0.01 losing 0.1–0.24 EACH while
  // their means landed within 0.03 of the frame). One closed ellipsoid of 0.97 × the lobe radii
  // in the same flat colour (sd 0 across the body; the cards, at density 1, are a leaf fringe
  // on its rim) measured F +0.0158 / C +0.0033 / A +0.0013 in the probe harness (v7d), against
  // F +0.0135 / C +0.0013 with a 0.92 core and density 1.5 (v7a) and F +0.0113 / C −0.0004 with
  // a 0.85 core and density 3 (v7b): the thinner the fringe, the better. The level is uFlatLift
  // (1.5; 1.2 measured the same on F, −0.0007 on C; 2.0 −0.0017 / −0.0006). The lobes' tops sit
  // at 4.7–5.0 m: F's top edge (y 0.11 at 13 m) is 5.1 m up and C's (12–14 m) 5.0–5.6 m, and
  // lowering all four 0.3 m traded F −0.0021 for C +0.0010 (v7c). Not extended east in C past
  // x 0.30 (frame dark to 0.38): the one volume that reaches C x 0.26–0.37 while off A is
  // (9, 3.2, 8), which F sees at (0.84–1.0, 0.2–0.33) over its lit bank haze — C +0.0012,
  // F −0.0071 (v7e). Corridor-exempt (nothing authored crosses the volume; the F view-gap rays
  // run over the stairs 5 m north of it) and nothing of them casts (laminae and cores in the
  // giant's authored-leaves mesh, cards in its authored-cards mesh): no shadow lands on the bank,
  // whose reference is lit dapple. The lobes' stems still cast, hidden inside the cores.
  // east bough: two lobes over the bank's east half (F x 0.60–0.84, C x −0.08–0.23)
  {
    giant: 'stair-bank-giant',
    fromY: 5.4,
    to: [13.6, 4.0, 5.4],
    radius: 0.45,
    tipRadius: 0.15,
    ghostWood: true,
    lobes: [
      { t: 0.95, center: [13.6, 3.5, 4.6], hR: 1.9, vR: 1.6, density: 1, tone: 0.6, eye: 0, shade: 0.4, corridors: false, castShadow: false, flat: true, core: 0.97 },
      { t: 0.6, center: [12.0, 3.5, 5.6], hR: 2.0, vR: 1.6, density: 1, tone: 0.6, eye: 0, shade: 0.4, corridors: false, castShadow: false, flat: true, core: 0.97 },
    ],
  },
  // north-west bough: two lobes over the bank's west half (F x 0.53–0.86, C x −0.02–0.28)
  {
    giant: 'stair-bank-giant',
    fromY: 5.4,
    to: [9.0, 3.3, 4.3],
    radius: 0.45,
    tipRadius: 0.15,
    ghostWood: true,
    lobes: [
      { t: 0.3, center: [11.2, 3.4, 3.7], hR: 1.9, vR: 1.5, density: 1, tone: 0.6, eye: 0, shade: 0.4, corridors: false, castShadow: false, flat: true, core: 0.97, layeredCore: { leaves: 2800, twigs: 40 } },
      { t: 0.8, center: [10.4, 3.4, 5.9], hR: 1.5, vR: 1.4, density: 1, tone: 0.6, eye: 0, shade: 0.4, corridors: false, castShadow: false, flat: true, core: 0.97, layeredCore: { leaves: 2100, twigs: 32 } },
    ],
  },
  // Round 45: the bank canopy's CORNER lobe — the dark mass in A's top-right corner and the near
  // half of F's top-centre canopy. Until round 45 both were the east giant's plateau-lip lobe L2
  // at (17.9, 7.3, −2.5), 21–22 m from A and F (A (0.96, 0.05) ± 0.08 at 0.31 against frame 1 s'
  // dark trunk at 0.30; F (0.44, 0.10)) — which hung 0.7 m over the fenced plateau walk and had
  // to go (above); moved out along F's ray it leaves A's corner (A (1.04, 0.02)), and A lost
  // 0.0028 in that one cell (0.875–1, 0–0.17: 0.43 haze against 0.30). This lobe stands on the
  // same A and F rays 13–15 m out — A (0.96, 0.02) ± 0.08 × 0.10, F (0.53, 0.09) ± 0.08 × 0.11 —
  // over the grassy bank NORTH-EAST of the main stairs (ground 0.9–2.3 under its footprint, slope
  // 15–27°; 4 m off the stair axis, 2.5 m outside the treads; not the plateau walk), FLOORED at
  // 4.75: 2.4+ m over the highest ground under it (2.31 at (13.3, 0.5)), the flat-bottomed core
  // (giant.ts lobeCore honours the floor) at A y 0.11. Flat + core like its neighbours, one
  // colour: tone 0.85 × shade 0.5 (≈ 0.30 at 14 m under the thin near veil — A's corner wants the
  // frame's 0.30, F's top-centre its 0.42–0.49; the neighbours' 0.6 × 0.4 is fitted to 0.19–0.23
  // frame darks). Out of C (its centre at C (−0.02, −0.04); the south-east rim grazes C's top-left
  // corner, which frame 44 s has dark to x 0.38); behind B / D / E.
  {
    giant: 'stair-bank-giant',
    fromY: 6.6,
    to: [11.6, 5.2, 1.9],
    radius: 0.45,
    tipRadius: 0.15,
    ghostWood: true,
    lobes: [{ t: 0.95, center: [11.6, 5.5, 1.6], hR: 1.8, vR: 1.1, density: 1, tone: 0.85, eye: 0, shade: 0.5, corridors: false, castShadow: false, flat: true, core: 0.97, floor: 4.75, layeredCore: { leaves: 2200, twigs: 32 } }],
  },
  // Not here (round 38, measured and dropped): a mid-distance leaf tree for shot D. Frame 56 s has
  // a dark spreading tree left of the path's axis at D (0.36–0.5, 0.25–0.5), branches and leaf
  // masses 0.40–0.50 against 0.55–0.60 lit air, where ours is open haze at 0.50–0.57. Two laminae
  // lobes (tone 0.58, eye 1, never cast) hung 3–4.5 m over the path's west half 12–16 m out on a
  // ghosted bough of the north-west-near giant put the means within 0.04 of the frame and gained
  // D +0.0004 — while B, which sees the same volume 17 m out at (0.13–0.31, 0.22–0.44), lost
  // 0.0060 and A 0.0017 (its cells (0.13–0.19, 0.22–0.33)). The frame's tree is texture — branches
  // and clumps at window sd 0.05–0.06 — and texture of ours is never correlated with it: SSIM's
  // structure term (2 cov + C2) / (va + vb + C2) is highest for a window we leave SMOOTH, whatever
  // the reference's own variance, so a leaf tree there can only pay for itself through its mean,
  // and D's means there are already within 0.04. D's mid-band gap is the open, lit, misty clearing
  // left of the path (frame 0.49–0.57 at (0.13–0.31, 0.44)) where ours is a shaded flowered bank
  // (0.36–0.38) facing away from the sun — terrain and vegetation, not canopy.
];
/**
 * Round 50 (trees-32): the "spreading giant" of the demo's orbit (reference/frames-dense/demo61
 * d_019–d_027 — a giant whose low bough reaches out level over the ground a few metres up, dark
 * foliage hanging from it). Ours is the `southwest-giant` at (−23, 9): one low bough leaving the
 * bole 7.5 m up (world 9.4) and reaching 5.5 m ESE over the south-west bank's back corner toward
 * (−20, 14) — its tip 3.2 m over the bank's top (1.95), two leaf curtains hanging under it —
 * built DETACHED (giant.ts GiantOptions.detachedBoughs): its own three meshes, shown only when
 * the expansion-locality gate says a camera could see them or their shadow (see the giant loop),
 * so the giant proper, the six fixed frames and every audit number of the tree are untouched.
 *
 * Where it may stand (gauntlet/tmp/r50-probe bough4.mjs marched the six cameras' frusta and the
 * sun): camera C looks south past the plaza and its west edge on the ground is layout `cClip`
 * (x = 2.33 − 0.5663 (z + 7.67)); everything here is west of that ray — the bole 18 m, the tip
 * 8.8 m, the bank's centre 4.8 m — but a caster's SHADOW runs 1.009 m E and 0.788 m S per m of
 * height (azimuth −128°, elevation 38°), so height is the constraint: foliage 8–10 m up at the
 * bole would lay its shade 0.3–2.7 m INSIDE C's frame at (−12 … −10, 19). Hence the bough leaves
 * low (7.5 m: its wood's own footprint stays 1.1–4.1 m outside, and the wood mesh does not cast
 * anyway) and the curtains hang at 4.4 / 5.8 m: their leaves' footprint lands 1.6–3.0 m outside
 * C's edge at (−14.7 … −13.5, 16.3–17.0) — on the bank's back and the plain west of it, the
 * "spreading" shade the reference shows under such a bough. The gate's own spheres (util/
 * expansionLocality casterSpheres: wood as frustum-only stacks, curtains swept along the sun to
 * the ground, +0.6 m) meet none of the six frusta, nearest by 0.97 m at C's edge; the curtains'
 * floors (3.9 / 4.2) keep their leaves 1.95 m over the bank top's back corner.
 * Pans from Link's spot (0, 1.5, 2), fov 55: W (→ (−24, 3, 1.75)) has the bough's root at
 * (0.33, 0.24) and tip (0.18, 0.39) of the frame; SW (→ the bank) root (0.74, 0.20), tip (0.60, 0.40).
 */
const DETACHED_BOUGHS: (typeof CANOPY_BOUGHS)[number][] = [
  {
    giant: 'southwest-giant',
    fromY: 9.4,
    to: [-20.2, 5.2, 13.7],
    radius: 0.55,
    tipRadius: 0.2,
    dress: { relief: 1, moss: 0.8, lichen: 0.6 },
    lobes: [
      { t: 0.95, center: [-21.4, 4.4, 12.5], hR: 1.5, vR: 1.0, density: 1.2, floor: 3.9 },
      { t: 0.6, center: [-22.3, 5.8, 11.0], hR: 1.6, vR: 1.2, density: 1.2, floor: 4.2 },
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
 *
 * Round 14: once the bole was sheared out of the plaza's sun lines (GIANT_PROFILES) these rings and
 * their fully open cores left the plaza an even sheet of sun (88 % of shot A's plaza box lit, sun
 * probes 60–99 % open), so they no longer carve the giants: the plaza's casters are now the lantern
 * tree's plaza-roof lobes (CANOPY_BOUGHS) and its sun pools the CANOPY_OPENINGS (corridors.ts).
 * The rings and cores had no height floor, so they also thinned the lantern limb's own lobes
 * 3–8 m up where its sun lines cross them; with the openings starting at 10 m that hero foliage
 * is whole again and throws its leaf dapple onto the box's north-east ((4–5.6, 1–3), which the
 * reference keeps half-lit) and the disc's west — the 6° sun probe at (4.3, 0.6) sees 32 % of
 * its cone blocked 0–5 m up against 8 % before, while the limb's wood (audit lanternLimb*) and
 * its look in A/F's upper-left (cell luminance within 0.02) are unchanged. The points are kept as
 * the white-bark placement's avoidance lines (a white-bark crown on them would blanket the
 * pools), so no white-bark moves.
 */
const PLAZA_SUN_POINTS: { point: [number, number, number]; radius: number }[] = [
  { point: [0.0, 0, 6.0], radius: 3.0 },
  { point: [2.5, 0, 3.5], radius: 2.8 },
];
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
  // Round 36: the lit run is the path's WEST half. Frame 56 s read in the box (0.30–0.70,
  // 0.50–0.80) with Link's column cut out (two-mean split at 0.432): left of Link (x 0.30–0.44 =
  // world x −1.4…0.4) the flagstones are lit from 7.6 m out to the far haze (p50 0.475, p10 0.409
  // — no shade darker than the frame's own floor but one 0.8 m strip along the west edge, x
  // −1.4…−0.7 at z −11.7…−17.6, the bank's), right of him (x 0.57–0.70 = world x 2.4–4.5) in
  // shade the whole way (p50 0.345, p10 0.293). The control lit both halves alike (0.400 /
  // 0.397): these points at x 0.5–2.0 with r 2.2–2.6 land ellipses 3.1 m either side in x (a
  // cylinder r lands 1.42 r in x, 1.27 r in z), i.e. x −2.6…5.2, and the sun-eye attribution
  // read the east strip (x 2.2–4.5, z −14…−8.5) 65 % sunlit, the west run (x −1.5…0.5, z −17.5…
  // −10.5) 62 %. What shades the west run is not the foliage a pool carves: the near part (z −12…
  // −7, 60 % shaded) is the north-west-near giant's own leaning bole and its WSW limb's collar
  // 6.7–8.8 m up (36 %: the bole's band across the path at z −8…−10.5, the price of the Link-ray
  // lean, see GIANT_PROFILES) and the north-west giant's crown 16–18 m up (21 %); the far part
  // (z −18…−12, 42 %) the bank and its boulders 2.5–3.6 m up (25 %, not trees) and the same
  // crown (17 %). Measured and NOT taken (D captures, same build otherwise): a cut at r 1.1 with
  // porosity 0.1 / 0.05 on the west run moved the west box's median not at all (0.400 → 0.400 —
  // laminae and cards were not what shaded it) and cost D's air box p90 0.605 → 0.597; the pools
  // moved 1–2.3 m west at the control's radii, with the same lines cutting the fine wood (crown
  // boughs, twigs, lobe stems) 12 m up and higher, read D −0.0010 against the same build with the
  // control's points — the shifted corridors' slabs cross D's upper-left air, cells (0.13–0.25,
  // 0–0.5) −0.013 / −0.019 / −0.015 SSIM, and the west box's median still 0.400 → 0.403. The
  // east strip is shaded by a bough's wood instead (CANOPY_BOUGHS, north-west-near at 12 m); the
  // points stay where trees-16 put them.
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
 * Note for anything low over the north path: the lines climb from D's eye at 1.45 m and pass
 * 3.5 m up at z −8 with a 1.8 m radius, so they also carve foliage authored there (the round-9
 * path-canopy trial lost most of its lobes to them until a `yMin` floor was added; the trial and
 * the floor are gone, see CANOPY_BOUGHS).
 */
const HOLLOW_GAP_POINTS: { point: [number, number, number]; radius: number }[] = [
  { point: [-1.9, 12.1, -28.9], radius: 1.8 },
  { point: [3.8, 13.0, -28.6], radius: 1.8 },
  { point: [8.0, 11.4, -28.4], radius: 1.6 },
];
const HOLLOW_GAP_POROSITY = 0.15;
/*
 * No sun-line corridors through the air of shot D's upper band (round 33). Ray-casting the sun
 * lines from the god-ray march's air samples in the box (x 0.35–0.75, y 0.10–0.27; air 2.5–11 m
 * up, 5–35 m out) found 74 % of the in-scatter weight in shadow — the north-west-near giant's wood
 * 26 % (GIANT_PROFILES / CANOPY_BOUGHS), the north-west giant's crown cards 17 % (its south-east
 * flank 16–21 m up) and wood 6 %, the mid-distance columns' crowns 12 %, the north-east lobes 3 %.
 * Porous corridors (r 2.6, porosity 0.3 / cards 0.2) up the sun lines from 3 m above five screen
 * points × 2–4 depths (14–34 m) thinned that flank — and lit the plateau slope under the houses
 * where the lines land down-sun (8.6 … 15, −12 … −21): D (0.625–0.75, 0.25–0.5) is frame 56 s's
 * dark hazed foliage. Measured (D-only A/B on 658119b): with the lines the air box p50 0.534 and
 * D SSIM 0.3324; without them 0.525 and 0.3385 (control 0.3392) — the slope cell −2.1e-3 → 0,
 * (0.75–0.875, 0.5–0.75) −1.4 → −0.5, the air cell +1.6 → +1.9. The lines' +0.009 of air was
 * not worth 0.006 of SSIM, so the air is opened by the ghosted limbs and the raised boughs only.
 * The upper-left's air (x 0.05–0.35, y 0.08–0.6; frame 0.58–0.62 rays, ours 0.43) has no lines
 * of its own either: its sun lines land on the D path and its west verge at z −16…−24, i.e. they
 * ARE the D_PATH_SUN_POINTS / D_VERGE_SUN_POINTS corridors' lines; what shaded that air was wood
 * the corridors do not cut (the north-west-near giant's wild-limb collars 19 %, the north-west
 * giant's wild limbs and leaders 11 %) — hence the two giants' ghosted limbs.
 */
/**
 * Porous view corridors through screen points of a hero camera (the same rule as the hollow gaps,
 * authored on the screen instead of in the air): the line from the camera's eye through the point
 * is carved from `minDistance` outward, so the near hero foliage the same ray crosses (the lantern
 * limb 5–11 m from A/F) is untouched and only the crowns 18–60 m out open onto the haze.
 *
 * Shot A's top band (0–0.2): the reference is bright haze between dark crown silhouettes (p90
 * 0.65, mean 0.49); ours read 0.575 / 0.446 because the band's right half (x 0.5–0.85) is a closed
 * roof at 22–55 m: the plateau oak's house-bough lobes and low crown (x 0.6, 22–40 m), its east
 * limb lobes (x 0.7, 32–36 m), the far-plateau giant's crown (x 0.7–0.8, 47–54 m) and the
 * north-east giant's crown (x 0.5, 47–58 m) — where the reference shows 0.58–0.66 haze with no
 * texture at all. Their shadows fall on the east plateau (x > 17) and beyond, outside every frame,
 * so opening them does not light the plaza; they sit above B's and F's top edges (y < 0) and
 * off D, so the same holes are seen only as a thin fringe along B's top-right edge. The rays cull
 * foliage only: the oak's two house boughs (≈ 1 m thick where they leave the trunk, x 0.6–0.7 at
 * 32–36 m) and its crown wood stay, so the band keeps dark limbs where the reference has none,
 * and fully open haze at 30–50 m renders at 0.55–0.59 (A x 0.8–0.85, p90 0.59) against the
 * reference's 0.65–0.69 — the band's p90 is capped by the atmosphere's haze brightness, not by
 * the canopy. First pass (six rays): top-right (0.55–0.85, 0–0.2) 0.444 → 0.472, p90 0.56 → 0.57.
 *
 * Shot F's top-left (0–0.35, 0–0.4): pale haze with dark silhouettes in the reference (mean 0.46,
 * p90 0.68); ours is Saria's house (18–22 m; structures is lowering its roof) with the plateau
 * oak's bough lobes and low west crown behind it at 25–40 m along the y ≈ 0.05 rays, then the
 * far-plateau crown at 47–58 m. The rays that meet the upper house (x ≤ 0.12) are left alone.
 */
const VIEW_GAP_RAYS: { viewpoint: string; screen: [number, number]; radius: number; minDistance: number }[] = [
  { viewpoint: 'A_stairs', screen: [0.52, 0.05], radius: 2.2, minDistance: 24 },
  { viewpoint: 'A_stairs', screen: [0.62, 0.06], radius: 1.8, minDistance: 18 },
  { viewpoint: 'A_stairs', screen: [0.72, 0.05], radius: 2.2, minDistance: 20 },
  { viewpoint: 'A_stairs', screen: [0.82, 0.05], radius: 2.4, minDistance: 24 },
  { viewpoint: 'A_stairs', screen: [0.66, 0.14], radius: 1.8, minDistance: 24 },
  { viewpoint: 'A_stairs', screen: [0.76, 0.14], radius: 2.2, minDistance: 20 },
  // second pass: the crown mass at 36–40 m behind the upper house (x 0.42–0.5), the oak's house-bough
  // lobes between the first rays (x 0.58–0.65), the far-plateau crown (x 0.7, 47–54 m) and the
  // north-west giant's crown at A's left edge (43–50 m; the lantern tree's limb and second bough
  // 11–29 m along that ray are the W01 composition, hence minDistance 35)
  { viewpoint: 'A_stairs', screen: [0.45, 0.08], radius: 2.4, minDistance: 30 },
  { viewpoint: 'A_stairs', screen: [0.58, 0.1], radius: 2.0, minDistance: 20 },
  { viewpoint: 'A_stairs', screen: [0.65, 0.02], radius: 2.0, minDistance: 24 },
  { viewpoint: 'A_stairs', screen: [0.7, 0.1], radius: 2.2, minDistance: 24 },
  { viewpoint: 'A_stairs', screen: [0.05, 0.09], radius: 2.4, minDistance: 35 },
  { viewpoint: 'F_canopy', screen: [0.18, 0.05], radius: 1.8, minDistance: 14 },
  { viewpoint: 'F_canopy', screen: [0.25, 0.05], radius: 1.8, minDistance: 14 },
  { viewpoint: 'F_canopy', screen: [0.32, 0.05], radius: 1.8, minDistance: 14 },
  // the oak's first house bough ends over Saria's crown (12.5, 9, −11.5): its lobes are the dark
  // clusters at F (0.1–0.2, 0–0.15) above the roof; the limb foliage 7–11 m out is kept
  { viewpoint: 'F_canopy', screen: [0.12, 0.05], radius: 1.6, minDistance: 14 },
  { viewpoint: 'F_canopy', screen: [0.06, 0.12], radius: 1.6, minDistance: 14 },
];
const VIEW_GAP_RAY_POROSITY = 0.2;
const VIEW_GAP_RAY_CARD_POROSITY = 0.1;
/**
 * Giants whose LOW foliage the hero cameras see from a few metres: the lantern tree's limb lobes
 * hang 3–8 m from cameras A/B, the plateau oak's house boughs are ~20 m from B. Their low lobes
 * get leaf-sized laminae instead of cluster cards (see GiantOptions.eyeDetail).
 */
const EYE_DETAIL: Record<string, number> = { 'lantern-tree': 1, 'plateau-oak': 0.6 };
/** foliage scale of the authored lantern limb (reference: a bare bough with a few clusters) */
const LANTERN_LIMB_FOLIAGE = 0.45;
/**
 * The lantern limb's growth (round 37, layout: `lanternBranch` from (−1.15, 2.22, 1.5) → to
 * (1.06, 2.21, 1.5)). Frame 1 s: the bough enters shot A at the left edge at y 0.31–0.38 (a dark
 * mossy limb ≈ 0.06 of the frame thick), runs level to x ≈ 0.27 and thins out; its two pods
 * hang right under it at (0.208, 0.405) / (0.255, 0.39). A pod camera A sees there lies on a ray
 * that passes 0.5–1 m in front of camera B at 0.5–0.7 m above its eye: it is inside B's frame
 * (frame 14 s has none) unless it is within ≈ 0.8 m of B's eye along its axis or behind it, i.e.
 * ≤ 6.7 m from camera A. So the visible run sits on z = 1.5 (0.5 m north of camera B's eye,
 * 5.8–6.9 m from A), level at 2.2 m over the plaza's south-west, heading due east, with the pods
 * at 1.95–2.0 m (bottoms ≥ 1.85, over Link's head) — everything above B's top edge and behind F's
 * left edge except the last 1.3 m of the run.
 * From there the limb has to reach the bole (−11.5, −7.2) 13.5 m to the WNW: `attachHeight` is
 * where it leaves the axis (local 2.6 m — world ≈ 5.6 m, the tree's foot standing at ≈ 3 m;
 * `from` itself is below the tree's base), and the reach is a cubic that leaves the bole level,
 * descends over the west ledge (published rings: 5.4 m at x −9.8, 4.2 m at x −7.2, 3.1 m at
 * x −4.7, 2.4 m at x −2.7) and droops onto `from` heading east — off every hero frame (A x ≤
 * −0.1, B behind or off the top-left, off C's right edge until x ≈ −2.5, behind F); what camera
 * C does see is the run itself, 8.6–8.9 m out across its upper right at (0.68–0.93, 0.31–0.34),
 * where frame 46 s has the hazed limb band over the boulder terrace.
 * `sag` 0.05 (the frame's run is level), `tail` 0.3 m (the frame's band is gone by A x 0.27–0.30; a
 * 0.6 m tail reached x 0.34 with a blunt tip).
 * `ghost`: the limb's own wood, lobes and end cluster are drawn but not built — the structures'
 * sleeve (round 37: no shadow) is the limb. A 2.2 m limb over the plaza's south-west would lay
 * its shadow (sun az −128°, el 38°: ground = point + (1.0, 0.79) × height) in a band from
 * (1, 3.3) to (3.5, 3.3), across the lit slabs 1.3 m in front of Link, which frame 1 s lights.
 * The old limb's lobes at (−2.2…−0.7, 4.8–5.2, −4.3…−3.5) cast part of A's plaza shade patch
 * (box (0.30–0.40, 0.64–0.72)); with them gone the round-34 plaza-shade clump and the
 * north-west-near crown still hold it (measured: patch p50 0.352 → 0.361, frame 1 s 0.355; lit
 * share 4.5 → 9.4 %, frame 7.3 %) while the path mouth west of it, which the old limb's wood also
 * shaded, lights up (lit share 46 → 69 %, frame 92 %).
 * The limb's ghosted lobes and end cluster still draw from the giant's main stream, and their
 * lamina counts follow the limb's height (nearEye), so everything the lantern tree builds after
 * its limb — wild limbs, crown, canopy lobes — re-rolls its laminae (same counts for the
 * corridor-exempt clumps, same azimuths for the wild limbs: GIANT_PROFILES pins their base).
 */
const LANTERN_LIMB = { sag: 0.05, tail: 0.3, ghost: true };
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
  // Round 31 (trees): the far-trunk row. Frame 56 s (D) has pale far trunks in three or more depth
  // planes between the mid-distance columns and the arch (x 0.10–0.40, y 0.10–0.45), and its
  // depth image had nothing between the 29–33 m columns and the 50–59 m row (farLayerCount 2, the
  // 25–27.5 m bucket at 1.52 % being the only third). Five tall bare poles (distant.ts, the
  // band-only 26 m slender) on the west bank (ground y 5.1–5.4) at z −45.75, 41–42 m of view
  // depth from camera D (the 40–42.5 m bucket): trunks at D x ≈ 0.16–0.31 from the ground line
  // (y ≈ 0.44) out of the top, crowns 18 m+ up and above the frame. The window onto that depth is
  // x 0.15–0.30 — the north-west giant's bole (33 m) closes 0.09–0.15 and the west-column hut and
  // its column (26–32 m) 0.28–0.34 — so the row stops at x −6.5 (the 0.37 arch lip is 2.5 m
  // further east; the two eastern poles stand behind the hut's column). Measured in D's
  // histogram: four 0.7 m poles at 3 m spacing 0.94 % of the frame in the bucket, five 1.4 m
  // poles ≈ 1.4 %, with three COLUMN_EMERGENT seats on the same line 2.10 % (the seats alone
  // 0.72 % — an emergent's bole is 1.24 m thick and its top third is behind the hut column —
  // so they were dropped for the poles); 1.5 % makes a layer, these 1.9 m poles alone 2.32 %. B x
  // 0.0–0.16 at 38–41 m, A −0.1–0.1 at 42–45 m, behind the north-west giant's crown; off C,
  // E's copy of B, F. Own stream so the 60–215 m radial layer and the two rows above keep
  // their exact placements.
  // Round 33: shade 1.0 → 1.3. Measured in D's depth image the row's poles were the darkest thing
  // in the upper-left band — lum 0.42 at 46 m (7.6 % of the top band, 14.9 % of the upper-left
  // box), under the 22–33 m columns in front of them (0.43–0.48) and the 58 m row behind (0.51):
  // camera D sees their shaded SSE faces. Frame 56 s's far trunks sit ≈ 0.06 under the haze
  // around them (0.50–0.55 in 0.58 air); ours sat 0.08–0.1 under a 0.50–0.52 haze. ×1.3 on the
  // instance tint lifts the shaded bark's ambient term to ≈ 0.46 at that depth.
  { xMin: -17.5, xMax: -6.5, zMin: -46.5, zMax: -45, spacing: 2.2, scale: [1.2, 1.35], shade: 1.3, kind: 'slender', minVariantHeight: 20, stream: 'depth-band-far-trunks-d' },
  // Round 51 (fable-4; V2 / opus #01, the window out of the log arch): the frame's view through
  // the arch (ANALYSIS_VIDEO2 §6.6, d_121) is a DENSE stand of tall trunks with no ground plane;
  // ours showed the north plain between the two rows (5 / 7 m spacing). Three bands of the 26 m
  // poles, own streams (the radial layer and the two rows keep their placements): two flanks
  // either side of the north clearing (|x| ≥ 12, so from the path they stand 15 m+ off in the
  // haze — a first cut at x ±32 / z −66…−80 / 2.6 m was a palisade 5 m from the walk line) and a
  // back stand behind the ledge terrace (z ≤ −81; the terrace pad ends at −79.8) that closes the
  // window's centre from the tunnel. Off the four authored white-barks (whitebark.ts
  // CLEARING_WHITE_BARKS) and, by the shared clearance, off the path spine and the structures.
  { xMin: -34, xMax: -12, zMin: -82, zMax: -64, spacing: 3.4, scale: [0.85, 1.1], shade: 0.7, kind: 'slender', minVariantHeight: 20, stream: 'depth-band-north-stand-w', after: true, avoid: CLEARING_WHITE_BARKS.map((w) => ({ x: w.x, z: w.z, r: 3 })) },
  { xMin: 12, xMax: 34, zMin: -82, zMax: -64, spacing: 3.4, scale: [0.85, 1.1], shade: 0.7, kind: 'slender', minVariantHeight: 20, stream: 'depth-band-north-stand-e', after: true, avoid: CLEARING_WHITE_BARKS.map((w) => ({ x: w.x, z: w.z, r: 3 })) },
  { xMin: -12, xMax: 12, zMin: -90, zMax: -81, spacing: 3.0, scale: [0.85, 1.1], shade: 0.7, kind: 'slender', minVariantHeight: 20, stream: 'depth-band-north-stand-n', after: true },
];
/** round 45: no distant tree within this of the path spine (m) … */
const DISTANT_SPINE_CLEARANCE = 6;
/** … the spine extended this far north past its last point (the sight line out of the log arch) */
const DISTANT_SPINE_EXTEND_M = 12;
function spineDistance(spine: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < spine.length; i++) {
    const [ax, az] = spine[i];
    const [bx, bz] = spine[i + 1];
    const abx = bx - ax;
    const abz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz || 1)));
    best = Math.min(best, Math.hypot(x - ax - abx * t, z - az - abz * t));
  }
  return best;
}
/** round 56: a trunk's footing ring on the south exit (heightfield `southFooting`): a bole and its flare keep this far off the paving and the log (m) … */
const SOUTH_TRUNK_REACH_M = 1.5;
/** … and its own rim this far off the gorge's lip (m): rim trees stay, their crowns over the ravine */
const SOUTH_LIP_MARGIN_M = 0.3;
/** round 56: the mid grove's crown cards keep this far off the south route's line — fable-5's 3–7 m "flat card piles" band (m) */
const MID_SOUTH_WALK_MIN_M = 7.5;
/** the south route's walk line: the path to the north sill, the bridge's axis, the far path to the log's mouth */
const SOUTH_WALK_XZ: [number, number][] = [
  ...southPathLine().map((p) => [p[0], p[2]] as [number, number]),
  ...EXPANSION_SOUTH.farPath.map((p) => [p[0], p[2]] as [number, number]),
  [EXPANSION_SOUTH.tunnel.mouth[0], EXPANSION_SOUTH.tunnel.mouth[1]],
];
const southWalkDistance = (x: number, z: number) => spineDistance(SOUTH_WALK_XZ, x, z);
/** round 56: a south giant's far roots dive under the south paving from this far short of its edge (m; giant.ts `rootPressAt`) */
const SOUTH_ROOT_PRESS_M = 0.4;
const southRootPress = (x: number, z: number) => {
  let m = southRouteSurface(x, z);
  for (let i = 0; i < 8 && m < 1; i++) {
    const t = (i / 8) * Math.PI * 2;
    m = Math.max(m, southRouteSurface(x + Math.cos(t) * SOUTH_ROOT_PRESS_M, z + Math.sin(t) * SOUTH_ROOT_PRESS_M));
  }
  return m;
};
/**
 * Column trees (column.ts) — the dark boles of the mid-distance forest wall (round 13).
 *
 * The reference frames' far wall is a few bold dark trunks standing in bright haze — measured as
 * 8-px column profiles of the background band (A y 0.05–0.45, B/F 0–0.45, D 0.1–0.5): trunks are
 * columns 0.03–0.19 under their neighbours, ≈ 1–1.4 m thick at 20–35 m, bare to 10 m; between
 * them the haze (0.41–0.55). Ours read as a grey wash (column stdev B 0.026 / D 0.054 / F 0.039
 * against the reference's 0.050 / 0.096 / 0.087) because nothing dark stands in that band: the
 * white-barks there are pale (their boles match the haze's luminance) and the 12–45 m ground
 * north of the plaza holds only the north-west and north-west-near giants at the frames' edges.
 *
 * Seats are authored world positions (a screen column of one hero frame at a chosen depth,
 * inverted to the ground and checked in all four frames), each with its own PRNG stream so the
 * white-barks, giants and distant layer are untouched. The screen columns they give, base → crown:
 *   (−3.5, −24.7)  A 0.11 @ 29 m, B 0.16 @ 24 m, D 0.32 @ 21 m — the west bank above the mist pool
 *   (−5.7, −31.9)  A 0.08 @ 34 m, B 0.13 @ 30 m, D 0.30 @ 28 m — with the north-west giant behind
 *   (−1.0, −35.5)  A 0.20 @ 40 m, B 0.27 @ 35 m, D 0.42 @ 32 m — west verge of the far path
 *   (8.8, −26.9)   A 0.38 @ 36 m, B 0.47 @ 30 m, D 0.65 @ 25 m — the plateau under the upper house:
 *                  reference A's hazed trunk left of the stairs (x 0.36–0.42) and D's dark right
 *   (21.2, 6.8)    F 0.74 @ 22 m; (24.2, 11.0) F 0.85 @ 24 m — the east plateau between the east
 *                  giant's bole (F 0.68) and the stair-bank giant (F 0.9–1.0), where the reference
 *                  is a hazed dark 0.35–0.45 and ours read 0.47–0.50 of open haze
 *   (15.7, 5.2)    F 0.70 @ 17 m (w 0.063) — the east bank in front of the east giant's hazed bole:
 *                  reference F's dark trunk at x 0.65–0.71 (0.29), which with the two seats behind
 *                  it makes the frame's dark right mass 0.67–0.88; its crown starts above F's top
 *   (−2.7, −7.9)   B 0.04 @ 8.4 m (w 0.12), A 0.05 @ 14 m, D 0.01 @ 4.4 m — the emergent (28 m,
 *                  column.ts) on the verge west of the north path, where reference B's left 13 %
 *                  is one near dark bole (0.33) from the ground out of the top of the frame (ours
 *                  read 0.40 of lamp cords and far stairs; with it 0.33) and A's left edge is dark
 *                  behind the lamp. The verge strip between the path's edge and the north-west-near
 *                  giant's clearance is the only ground on B's left-edge ray, so its probe ring is
 *                  1.0 m (the bole stays 0.9 m off the pavement; its short roots reach the edge and
 *                  no further). The same ray is D's left edge: there the bole covers x 0–0.12 from
 *                  the bottom of the frame to the top (the reference's left edge is a dark tree
 *                  too, but a soft mid-distance one), in front of the giant's roots and the west
 *                  end of the lit verge — the emergent is kept slim (R 0.62, flare 0.3) for that.
 *                  Round 31 (left edge): measured in the depth image the bole filled D x 0–0.145
 *                  at 4.9–6 m (its axis projects to 0.025, the gnarl and lean carry the east limb
 *                  to 0.145), hiding the D boulder's west half and the clearing behind, where
 *                  frame 56 s has a hazed trunk at x 0–0.09 (0.41, a soft mid-distance one) and
 *                  bright haze / far trunks from 0.09 on (ref (0.08–0.145, 0.1–0.45) 0.45 against
 *                  ours 0.32). The seat moves 0.4 m west, to (−3.1, −7.9): 1 m of world moved
 *                  the east limb 0.14 of D's width in the probe (0.145 → 0.075 for 0.5 m), so it
 *                  lands at ≈ 0.09 and the boulder's rock shows from x 0.09 (was 0.144; frame
 *                  0.10–0.22). In B (8.4 m) the bole's span goes 0.0–0.10 → −0.03–0.07, so B's
 *                  left edge keeps a dark bole behind the Kokiri kid (the reference's is 0–0.10
 *                  to y 0.45) — the trade B pays for D's clearing. Still 0.9 m+ off the
 *                  pavement's edge (x ≈ −1.5 at z −7.9), 5.5 m from the north-west-near giant's
 *                  bole and 1.6 m from the D boulder (roots reach ≤ 1.2 m). The bole's own
 *                  luminance (0.32 at 5.4 m) is under the reference's 0.41 and does not move
 *                  with its vertex colour: the shaded bark sits on the flat GIANT_BARK_FLOOR
 *                  (a 0.7× bark multiplier measured 0.317 → 0.319 and was dropped).
 * Every seat is off the paths, stairs and structures, ≥ 4 m from a giant's bole and ≥ 2.5 m from
 * a white-bark; none stands in the plaza / house / stair sight lines or the F view gap. Their
 * crown shadows (a caster at height Y shades (x + 1.008 Y, z + 0.787 Y)) fall on the plateau slope
 * and east of it — off the plaza and the D path's lit run (only the bare boles of the two west-bank
 * seats lay a thin band across the path at z ≈ −20 and −29, dapple the reference path also has).
 * The emergent's crown (18–28 m up) shades (15–26, 6–14): the east bank past the F bank sun
 * points; its bare bole lays one 0.9 m stripe from the path fork across the plaza's east edge
 * (3.5 m outside the second plaza core's ring) onto the F bank — a bold shadow of the kind the
 * reference bank has (measured: F bank box unchanged, A plaza box unchanged, B foreground
 * 0.401 → 0.395 against the reference's 0.399). Behind camera F for the north seats, behind
 * A/B/D for the east ones.
 *
 * Swap rule: a MATURE white-bark whose bole stands in a hero frame's far wall (18–45 m out,
 * x 0.05–0.95, base below y 0.25) is built as a column instead — its pale bole is exactly the
 * wash the frames must not show (white #18 at (11.1, −25) was a pale stripe at B 0.53 / D 0.73
 * where the reference is a dark wall). Applied after the placement (like the view-gap reseat) so
 * no other tree moves.
 */
/** regular column variants (columnParams); the emergent (emergentParams) is variant index COLUMN_VARIANTS */
const COLUMN_VARIANTS = 4;
const COLUMN_EMERGENT = COLUMN_VARIANTS;
/** the far hut's host (column.ts hutHostParams): variant index COLUMN_VARIANTS + 1 */
const COLUMN_HUT_HOST = COLUMN_VARIANTS + 1;
/** radius of the pavement / stairs / structure probe ring around a seat (m) */
const COLUMN_SEAT_RING = 1.6;
/**
 * A seat's `view` (round 50, trees-32) is the heightfield view it reads its ground from — the
 * trees build against the LEGACY view (src/world/index.ts), which is the plain the six frames
 * see; a seat on ground the round-49 expansion raised (the far hut's knoll, +1.4 m) reads the
 * LIVE view so it stands on the rendered ground. `host`: the seat is a structure's host (the hut
 * hangs on it), so the structure mask under it — its own hut's — and the no-vegetation rule the
 * mask implies do not block it. Base gaps are audited against each seat's own view.
 */
const COLUMN_SEATS: { x: number; z: number; variant: number; ring?: number; view?: TerrainView; host?: boolean }[] = [
  { x: -3.5, z: -24.7, variant: 3 },
  { x: -5.7, z: -31.9, variant: 1 },
  { x: -1.0, z: -35.5, variant: 2 },
  { x: 8.8, z: -26.9, variant: 3 },
  { x: 21.2, z: 6.8, variant: 0 },
  { x: 24.2, z: 11.0, variant: 2 },
  { x: 15.7, z: 5.2, variant: 3 },
  // round 31: 0.4 m west of (−2.7, −7.9), see the "left edge" note above
  { x: -3.1, z: -7.9, variant: COLUMN_EMERGENT, ring: 1.0 },
  // round 50 (trees-32): the far hut's host on its knoll (layout EXPANSION.farHut.host, live
  // ground 1.61 m — structures/distantHouse.ts resolveHost takes the published seat within 1.5 m).
  // LAST in the list: the seat loop draws one yaw and one scale per seat, so an entry appended
  // here re-rolls none of the seats before it. Its family never casts (see the seated columns).
  { x: -41, z: 35.7, variant: COLUMN_HUT_HOST, view: 'live', host: true },
];
/**
 * Round 50 (trees-32): the two white-barks off the far hut's knoll (expansion-2's brief), authored
 * placements seated on the LIVE ground (fable-4's family; only the placement is ours). `crown`
 * picks the smallest / largest mature variant — the (−34, 45) tree stands nearest camera C's edge.
 */
const KNOLL_WHITE_BARKS: { x: number; z: number; crown: 'small' | 'large' }[] = [
  { x: -50, z: 39, crown: 'large' },
  { x: -34, z: 45, crown: 'small' },
];
/**
 * Knees on the emergent's bole (round 40 — the owner's markup on our frame A circles "the smooth
 * pale bole at the left edge"; the brief asks for taper, 1–2 forks/knees on the visible run, bark
 * cords, moss sheets and lichen). World azimuths (0° = +x east, 90° = +z south), turned into the
 * seat's local frame at build time. From camera A the bole is seen along (−0.21, −0.98), so 22°
 * is its screen-right edge and 204° its screen-left: both stubs stand in silhouette against the
 * haze — the low one (5.3 m, 1.6 m long) over the verge toward the path, the high one (9.2 m,
 * shorter, a burl with a snapped stub) on the west side. Camera B (8.4 m) and D (4.4 m) look up
 * the same faces. The stubs' shadows are two short bars on the verge / the path's west edge.
 */
const EMERGENT_KNEES = [
  { height: 5.3, azimuthDeg: 22, reach: 0.34, halfWidth: 0.7, stubLength: 1.6, stubRadius: 0.24, stubPitch: 0.3 },
  { height: 9.2, azimuthDeg: 204, reach: 0.28, halfWidth: 0.6, stubLength: 1.1, stubRadius: 0.2, stubPitch: 0.45 },
];
const COLUMN_VIEWS = ['A_stairs', 'B_house', 'D_log', 'F_canopy'];
const COLUMN_SWAP = { minDistance: 18, maxDistance: 45, xMin: 0.05, xMax: 0.95, minBaseY: 0.25 };
/** minimum clearance of a column seat from a white-bark / a giant's bark / a house's trunk (m) */
const COLUMN_CLEARANCE = { whiteBark: 2.5, giant: 4, house: 4 };
/**
 * Submission culling (round 16). The LOD buckets hold every tree of a variant within a distance
 * band all around the camera, so a bucket's InstancedMesh was never frustum-culled as a whole and
 * every instance in it — the ring behind the camera included — was rasterised in the colour pass
 * and, for the shadow-casting LODs, in the sun's depth map. Per frame the buckets are now trimmed
 * to the instances that can reach the image: an instance is submitted when its bounding sphere
 * (grown by CULL_PAD_M for wind displacement and the shadow filter's reach) meets the view
 * frustum, or — on a shadow-casting mesh — when the volume its shadow sweeps along the sun
 * direction down to SHADOW_FLOOR_Y (a capsule) meets it, since a caster behind the camera whose
 * shadow falls into the frame must stay in the depth map. Giant sector meshes keep casting only
 * while their capsule meets the frustum. Both tests are conservative (plane-separation), so the
 * frame is pixel-identical to the untrimmed one; what changes is the triangle count and the draw
 * calls of buckets that trim to nothing (hidden). Off the six fixed views this is what keeps the
 * walkable build inside the W38 envelope (≤ 700 calls, < 9 M triangles): the free-camera poses
 * measured 710–714 calls / 9.08–9.13 M before.
 */
const CULL_PAD_M = 4;
/** lowest world height a shadow receiver can have (the capsule is swept down to it) */
const SHADOW_FLOOR_Y = -20;
/**
 * The near LOD parts' geometry pools (lodPool.ts, round 42). A near-canopy part (nearCanopy.ts)
 * or a near base (giant.ts / column.ts) is built once at load for its measurements (counts, cull
 * sphere, bytes — the hero pass reads the built sphere), then kept only while the camera is near:
 * a part whose centre comes within its pre-fetch radius is rebuilt ahead of its swap distance in
 * chunks (NEAR_LOD_BUILD_BUDGET_MS of the frame), and past the pools' byte caps the parts are
 * dropped — the ones out of the pre-fetch radius least recently used first, then the farthest of
 * the wanted — so a pool holds the drawn parts plus the nearest of the approaching ones that fit.
 * A part that must be drawn before its build is ready (an explicit re-pose, or a walk faster than
 * the pre-fetch) is finished synchronously, so every frame is what it would have been with every
 * part resident. The pre-fetch radius runs 8–16 m ahead of the swap radius (7.5 s at walking
 * speed, 1.6 m/s), the radius the pre-fetch is ordered by; how far it reaches in this hollow is
 * set by the cap (see NEAR_LOD_TIERS).
 *
 * Round 48 (lod-1, docs/PERF_2026-09-19.md): the caps and the near radii follow the machine.
 * fable-6's native trace of the sealed world found the 64 MB canopy pool a third of its demand
 * (125 MB inside the 34 m pre-fetch radius on the plaza → north-path walk): 264 builds and 504
 * evictions in 40 s — the same deterministic parts rebuilt as the walker passed them — 7 s of
 * the walk in the builder and trees.update at 23 ms p95. With 192 / 32 MB the whole demand is
 * resident, the walk has no build and no eviction, and trees.update is 0.6 ms; the frames are
 * identical (the pool decides when a part's buffers exist, never whether it is drawn). The
 * larger caps are what round 41 held resident (173 MB) before round 42 capped it for a 4-core CI
 * VM — so the tier is chosen by `navigator.deviceMemory` (Chromium: 0.25–8 GB, capped at 8;
 * absent elsewhere → 4): ≥ 8 GB gets the large pools AND the wider near swap radii that only the
 * large pools make hitch-free (fable-6 §5.2: the 18 m base / 26 m canopy swaps alone, with the
 * shipped pools, cost 39 synchronous builds on the walk); under 8 GB everything stays as
 * shipped. `?pool=large|small` on the URL forces a tier (the perf traces compare both on one
 * machine); the six fixed frames are byte-identical in either (see nearBand / the hero pass).
 */
interface NearLodTier {
  name: 'large' | 'small';
  canopyPoolBytes: number;
  basePoolBytes: number;
  canopyPrefetchM: number;
  basePrefetchM: number;
  /** the default near-base [in, out] band (m) of a bole no fixed camera constrains (see nearBand) */
  baseBand: [number, number];
  /** cap on every near-canopy part's [in, out] swap radii (m): the parts are built with nearCanopy.ts NEAR_CANOPY_IN_M / OUT_M, the small tier draws them in at the shipped 22 / 26 */
  canopySwapM: [number, number];
}
const NEAR_LOD_TIERS: Record<NearLodTier['name'], NearLodTier> = {
  /**
   * Round 51 (fable-4 for the paused lod-1 lane; fable-6 §7 step 4): the near bases swap at 25 / 28 m
   * on the large tier (the per-camera bands re-derived — giant.ts NEAR_BASE_RADIUS_OVERRIDE_LARGE — so
   * no fixed camera stands inside a band it frames), pre-fetched from 38 m; and the pools sized to what
   * the six poses' own audit showed the 26 / 30 m canopy already wanted: 375 parts / 203 MB inside the
   * 42 m pre-fetch at F against 192 MB — 81 evictions and 29 rebuilds across the six poses. 256 MB
   * holds that demand resident (fable-6's "25 m with 256 MB"); 48 MB holds every one of the 23 near
   * bases (≈ 1.4 MB each), so neither pool can churn on a walk. What is DRAWN in a fixed frame does not
   * depend on a pool cap; the canopy swap itself stays 26 / 30.
   */
  large: { name: 'large', canopyPoolBytes: 256 << 20, basePoolBytes: 48 << 20, canopyPrefetchM: 42, basePrefetchM: 54, baseBand: [25, 28], canopySwapM: [NEAR_CANOPY_IN_M, NEAR_CANOPY_OUT_M] },
  /**
   * 64 MB holds ≈ 140 of the 364 canopy parts (0.47 MB each on average): the drawn set is 41–51
   * parts / 17.5–21 MB on the plaza→stairs walk and the parts within 26 m of the camera come to
   * 61–75 MB, so 64 MB pre-fetches to about the 26 m out-radius (a 40 MB cap: 28 synchronous
   * builds, trees update to 27 ms). 12 MB ≈ 9 of the 22 bases (0.7–1.4 MB each; ≤ 6 are shown).
   */
  small: { name: 'small', canopyPoolBytes: 64 << 20, basePoolBytes: 12 << 20, canopyPrefetchM: 34, basePrefetchM: 22, baseBand: [10, 13], canopySwapM: [22, 26] },
};
/** the machine's memory in GB as the browser reports it (Chromium's `navigator.deviceMemory`; 4 when unavailable) */
const deviceMemoryGB = (): number => {
  const n = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 4;
};
/**
 * The large tier unless the browser reports under 4 GB: Safari and Firefox report nothing (→ 4), and
 * on the small tier the owner walked past boles still drawn as their smooth far bases ("why don't the
 * trees immediately spawn instead of needing me to get close", 2026-09-23 20:08).
 */
const nearLodTierFor = (deviceGB: number, poolParam: string | null): NearLodTier => {
  if (poolParam === 'large' || poolParam === 'small') return NEAR_LOD_TIERS[poolParam];
  return deviceGB >= 4 ? NEAR_LOD_TIERS.large : NEAR_LOD_TIERS.small;
};
/**
 * The white-barks' and columns' three-LOD ladder: high inside `TREE_LOD_NEAR_M`, medium inside
 * `TREE_LOD_MID_M`, low beyond (× `ctx.quality.distance`). The detail between the rungs is large —
 * `writer.ts addLeaf` keeps every 4th lamina at medium and every 8th at low, enlarged to hold the
 * crown's coverage, and `tube` drops the finest twigs — so where a rung falls inside what the player
 * looks at, the crown visibly gains leaves as he walks in.
 *
 * 2026-09-23 (owner 20:08, "why don't the trees immediately spawn instead of needing me to get
 * close"). Measured with `?treelod=` at his 06:50 north pose (`diffmap.mjs`, > 8 levels): drawing
 * every tree at its highest LOD changes 5.57 % of the frame, and ALL of it is this first rung — the
 * medium→low rung at 44 m accounts for 0.00 %. The rung was 20 m, i.e. inside the crowns he walks
 * toward. 28 m is what the budget pays for: a white-bark's high LOD is ≈ 150 K triangles, so each
 * extra tree promoted is expensive, and camera A sits 0.05 M under W38's 9 M gate. The 8 m is paid
 * for out of `DISTANT_NEAR_M` below, which was buying nothing.
 */
/**
 * The high→medium rung (m). 20 m through round 53, 28 after the treepop round, and 32 after the 18:20
 * health check attributed the whole of the residual pop to this rung: with every tree forced high
 * (`?treelod=10`) the owner's walking poses differ from the shipped rungs by 2.06 % and 2.24 % of the
 * frame, and opening THIS gate to 40.6 m takes that to 0.10 % while opening the medium→low rung or the
 * distant gate changes nothing. A tree between the rung and ≈ 41 m is on its medium LOD and fills out
 * as he closes, which is his "the trees … only get detailed when I come up close".
 *
 * 40.6 m is not affordable: `pose-counts.mjs` puts camera A at 9.17 M triangles, 171 k OVER the 9 M cap
 * (D left with 41 k). 32 m with the distant gate below pulled in to pay for it fits with room and takes
 * draws DOWN — A 8.91 M / 620 draws (89 k headroom, −19 draws), B and E −49 k, C −20 k, D 8.69 M (+52 k),
 * F +14 k — the same trade the treepop round made when it moved this rung from 20 to 28.
 */
const TREE_LOD_NEAR_M = 32;
/**
 * The distant / mid layers' near→far gate (m, × `ctx.quality.distance`). 120 m through round 51; the
 * same measurement shows the near LOD's bent trunk, cords and root toes at 72–120 m — behind 60–86 %
 * of the height fog — are worth 0.04 % of the frame, while they cost A 15 draws and the triangles the
 * rung above needs. The mid grove's own 40 m gate stays under this and unchanged; the north stand's
 * 50 m rule (round 51) sat above 45 and is retired (see `bucketDistant`).
 */
const DISTANT_NEAR_M = 45;
/**
 * The medium→low rung (m). 59 m was tried at 19:00 and backed out: it cost the owner's walking poses
 * +0.51 % and +0.75 % of their triangles (+45 k, +51 k) and the hero views up to +54 k, and the frame
 * did not change — with every tree forced high (`?treelod=10`) those poses differ from the shipped
 * rungs by 2.06 % and 2.24 % at 44 m and by 2.06 % and 2.24 % at 59 m, to the second decimal. The
 * medium and high LODs of a tree at 44-60 m read the same at that range; the close-only detail those
 * two per cent measure belongs to another gate, and finding which is the open question (the candidates
 * are `DISTANT_NEAR_M` and the giants' near-canopy swap band, both reachable with `?treelod=`).
 */
const TREE_LOD_MID_M = 44;
/**
 * Dev measurement knob, the same shape as `?pool=large|small`: `?treelod=<multiplier>` scales every
 * instanced tree LOD swap distance (the white-barks' and columns' ladder, the distant layer's and the
 * mid grove's near gates). `?treelod=10` draws every tree at its highest LOD from any range, so one
 * pose rendered with and without it measures exactly how much of the frame is detail that appears
 * only when the player gets close — the owner's "why don't the trees immediately spawn instead of
 * needing me to get close" (2026-09-23 20:08). 1 = shipped, and the take / CI path never sets it.
 */
const TREE_LOD_SCALE: [number, number, number, number] = (() => {
  if (typeof location === 'undefined') return [1, 1, 1, 1];
  const raw = new URLSearchParams(location.search).get('treelod');
  if (!raw) return [1, 1, 1, 1];
  // "1.8" scales every gate; "1.8,2.6,0.6,1.5" scales the high→medium rung, the medium→low rung, the
  // distant / mid layers' near gate and the giants' near-CANOPY swap band separately, so each can be
  // priced and read on its own
  const ok = (n: number) => (Number.isFinite(n) && n > 0 ? n : 1);
  const parts = raw.split(',').map(Number);
  if (parts.length === 1) return [ok(parts[0]), ok(parts[0]), ok(parts[0]), ok(parts[0])];
  return [ok(parts[0]), ok(parts[1]), ok(parts[2] ?? parts[1]), ok(parts[3] ?? 1)];
})();
const NEAR_LOD_DEVICE_GB = deviceMemoryGB();
const NEAR_LOD_TIER = nearLodTierFor(NEAR_LOD_DEVICE_GB, typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('pool'));
const NEAR_CANOPY_PREFETCH_M = NEAR_LOD_TIER.canopyPrefetchM;
const NEAR_BASE_PREFETCH_M = NEAR_LOD_TIER.basePrefetchM;
const NEAR_CANOPY_POOL_BYTES = NEAR_LOD_TIER.canopyPoolBytes;
const NEAR_BASE_POOL_BYTES = NEAR_LOD_TIER.basePoolBytes;
/**
 * The chunked builds' budget per frame (ms; lodPool.ts `work`). 3 as shipped; 6 from round 48 —
 * with the pools sized to their demand the builder runs rarely, and when it does a 6 ms slice
 * finishes a 12–27 ms part in 2–5 frames instead of 5–9, ahead of the walker. The pool no
 * longer starts a chunk that its own step history says would end past the budget (the shipped
 * builder checked the budget only between chunks, so a frame paid the budget plus one whole
 * chunk), so this is what a frame pays, give or take one mis-predicted chunk.
 */
const NEAR_LOD_BUILD_BUDGET_MS = 6;
/**
 * The first frame's build budget (ms): the parts pending inside the pre-fetch radii at the spawn
 * are built before the walk starts (fable-5 lane 10 §18 on 39e63437: 192 of the plaza's 374 crown
 * parts were still pending after the settle and built one per frame as the owner walked, each late
 * one a synchronous build). Capped so a slow machine pays a bounded first frame.
 */
const NEAR_LOD_PREBUILD_MS = 1500;
/**
 * The near-base bands the fixed cameras constrain (round 48; [in, out] m, key = NearBole id).
 * giant.ts NEAR_BASE_RADIUS_OVERRIDE holds the round-44 bands derived from the cameras'
 * distances (wider than the shipped 10 m where every camera stands far, narrower where one is
 * close); these are the boles that took the shipped default because a fixed camera stands
 * within 18 m of them, re-derived for the 18 m default of the large tier. The rule (giant.ts):
 * with `reset` a capture's state is `distance < in`, so a camera stays outside the in-radius of
 * every bole it frames or whose base its frame could meet; a camera that stands INSIDE the
 * in-radius must have the bole and its 6.4 m shadow (sun 38° up, cast to the ESE) fully behind
 * it — fable-6's `lod18` variant measured that: the stair-bank giant active at A (10.2 m,
 * off-frame) and plaza-south active at A (12.6 m, behind) left A byte-identical, while the same
 * giant active at F (13.6 m, its right edge) cost F −0.0086.
 *   stair-bank-giant  A 10.2 (off-frame) · B/E 12.8 (behind) · F 13.6 (right edge) · D 16.0 · C 18.7
 *   lantern-tree      D 12.4 · C 13.8 · B/E/F 14.7 · A 19.8 — its base is 60–117° off every axis (the limb is what A / D frame)
 *   north-west-near   C 9.8 (behind; active in C as shipped) · D 11.6 (its base sits on D's left edge) · B/E 16.0 · F 17.3
 *   plaza-south       A 12.6 (behind) · F 17.7 (behind) · B/E 19.0 · D 23.9
 *   swap-18           C 19.4 (behind) · D 24.6 — the mature white-bark at (11.1, −25) built as a column
 * The 3 m of hysteresis never reach a camera: a capture re-poses with `reset`.
 */
/**
 * The large tier's floor under every near-base band: every bole within 40 m of the camera draws its
 * bark relief, so none turns from the smooth far base into bark in front of the player. 48 MB holds
 * all 23 bases (≈ 1.4 MB each) resident, and the pre-fetch (NEAR_LOD_TIERS.large.basePrefetchM)
 * runs 10 m beyond the out-radius.
 */
const NEAR_BASE_WALK_BAND: [number, number] = [40, 44];
const NEAR_BASE_HERO_BAND: Record<string, [number, number]> = {
  'stair-bank-giant': [12, 13.5],
  'lantern-tree': [12, 13.5],
  'north-west-near': [10, 13],
  'plaza-south': [15, 17],
  'swap-18': [15, 17],
};
/** the built buffers a pool holds: one BufferGeometry */
interface GeometryBuilt extends PoolBuilt {
  geometry: BufferGeometry;
}
/** what the audit's residentBytes counted from the start: every attribute array plus the index */
const geometryBytes = (g: BufferGeometry) => Object.values(g.attributes).reduce((b, a) => b + a.array.byteLength, 0) + (g.index ? g.index.array.byteLength : 0);
/**
 * Round 51 (fable-cursor, 2026-09-22 07:15: the tab at 3.6 GB, two chrome OOM kills during the night's
 * takes — "anything that trims resident geometry"): a pooled part's typed arrays are needed until the
 * renderer uploads them, and then only if something reads them back — nothing does (the bounds and
 * the byte count are taken at build, the swap folds through uniforms, the audits read counts, the
 * character's surface grid reads the hardscape's stairs). So every attribute and the index drop their
 * CPU copy once uploaded (three's `onUpload` fires after the buffer is created): the near-canopy and
 * near-base pools' ≈ 257 MB of parts stop being held twice. A rebuilt part gets fresh arrays and drops
 * them the same way; `needsUpdate` is never set on a resident part.
 */
/**
 * Round 51 (the memory ask, step two — fable-2's rocks recipe, −53 % there): the writers emit every
 * attribute as Float32; the GPU copy (and the CPU copy until upload) shrinks by a third when the
 * attributes whose range allows it are stored normalized — normals Int8, colours Uint8 when the
 * geometry's colours stay within 0–1, `aWind` Uint16 (stiffness / phase / flutter, all 0–1; 16 bits
 * so the 0–0.035 flutter keeps its resolution). Positions, uv (tiling up to ×27) and `aRoot` (world
 * anchors and the swap / cushion encodings the shaders decode) stay Float32. A normalized attribute
 * reaches the shader as the same float; range-checked, so a geometry outside the range keeps its
 * floats. Run once per geometry after every build-time read of the arrays (bounds, rootsToWorld).
 */
/**
 * The bytes `compactAttributes` would leave a geometry with, without compacting it — the batched
 * near-canopy parts (round 54) keep every attribute Float32 so that a BatchedMesh accepts them all
 * (its parts must share one layout, and the compaction is conditional per part), but the pool's
 * accounting uses these bytes so its admission is the same as the per-mesh parts' was.
 */
const compactedBytes = (g: BufferGeometry, everyNarrowable = false) => {
  const fits = (name: string, lo: number, hi: number) => {
    const a = g.attributes[name] as BufferAttribute | undefined;
    if (!a || !(a.array instanceof Float32Array)) return false;
    if (everyNarrowable) return true;
    const src = a.array;
    for (let i = 0; i < src.length; i++) if (src[i] < lo || src[i] > hi) return false;
    return true;
  };
  const narrow: Record<string, number> = {};
  if (fits('normal', -1, 1)) narrow.normal = 1;
  if (fits('color', 0, 1)) narrow.color = 1;
  if (fits('aWind', 0, 1)) narrow.aWind = 2;
  let bytes = g.index ? g.index.array.byteLength : 0;
  for (const [name, a] of Object.entries(g.attributes)) bytes += (a as BufferAttribute).count * (a as BufferAttribute).itemSize * (narrow[name] ?? (a as BufferAttribute).array.BYTES_PER_ELEMENT);
  return bytes;
};
/**
 * The CPU arrays a group still holds (bytes), by the group's direct children — fable-2's
 * `cpuArrays` audit line (rocks / hardscape, #119) for the trees: every unique geometry's attributes
 * and index whose `array` is not null. After a mesh's first draw only what `onUpload` left; a mesh no
 * camera has drawn yet still holds all of it, and so does the near-canopy batch by design (round 54).
 */
const cpuArrayBytes = (root: Group) => {
  const seen = new Set<string>();
  const byChild: Record<string, number> = {};
  let bytes = 0;
  let geometries = 0;
  for (const child of root.children) {
    let sub = 0;
    child.traverse((o) => {
      const g = (o as Mesh).geometry;
      if (!g || seen.has(g.uuid)) return;
      seen.add(g.uuid);
      geometries++;
      for (const attr of Object.values(g.attributes)) {
        const arr = (attr as BufferAttribute).array as ArrayBufferView | null;
        if (arr) sub += arr.byteLength;
      }
      const idx = g.index?.array as ArrayBufferView | null | undefined;
      if (idx) sub += idx.byteLength;
    });
    if (sub > 0) byChild[child.name || child.type] = sub;
    bytes += sub;
  }
  return { bytes, geometries, byChild };
};
const compactAttributes = (g: BufferGeometry, only?: string) => {
  const to = (name: string, Ctor: typeof Int8Array | typeof Uint8Array | typeof Uint16Array, scale: number, lo: number, hi: number) => {
    if (only && name !== only) return;
    const a = g.attributes[name] as BufferAttribute | undefined;
    if (!a || !(a.array instanceof Float32Array)) return;
    const src = a.array;
    for (let i = 0; i < src.length; i++) if (src[i] < lo || src[i] > hi) return;
    const out = new Ctor(src.length);
    for (let i = 0; i < src.length; i++) out[i] = Math.round(src[i] * scale);
    g.setAttribute(name, new BufferAttribute(out, a.itemSize, true));
  };
  to('normal', Int8Array, 127, -1, 1);
  to('color', Uint8Array, 255, 0, 1);
  to('aWind', Uint16Array, 65535, 0, 1);
};
const dropArray = function (this: { array: ArrayLike<number> | null }) {
  this.array = null;
};
const releaseAfterUpload = (g: BufferGeometry) => {
  for (const a of Object.values(g.attributes)) (a as BufferAttribute).onUpload(dropArray as unknown as () => void);
  if (g.index) g.index.onUpload(dropArray as unknown as () => void);
};
/**
 * A translated-to-world part's roots: aRoot.xyz becomes the tree's world origin (the merged
 * shader's per-tree context) — except a 3-D moss cushion's vertices (writer.ts woodCushion,
 * isCushionRoot), whose xyz is the cushion's anchor on the bark and is translated with the
 * geometry instead, so the shader's touching-distance shrink (materials.ts CUSHION_FADE_M) keeps
 * its target. Round 46: overwriting every root was why the shrink never fired on a giant's base.
 */
const rootsToWorld = (root: BufferAttribute, ox: number, oy: number, oz: number) => {
  for (let i = 0; i < root.count; i++) {
    if (isCushionRoot(root.getW(i))) root.setXYZ(i, root.getX(i) + ox, root.getY(i) + oy, root.getZ(i) + oz);
    else root.setXYZ(i, ox, oy, oz);
  }
};
/** an empty geometry that keeps a built part's cull sphere while its buffers are out of the pool */
const placeholderFor = (g: BufferGeometry) => {
  const p = new BufferGeometry();
  p.name = `${g.name}#placeholder`;
  p.boundingBox = g.boundingBox ? g.boundingBox.clone() : null;
  p.boundingSphere = g.boundingSphere ? g.boundingSphere.clone() : null;
  return p;
};
const _v = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

/** an instanced tree family variant: 3 LOD assets, one InstancedMesh per LOD, its placements */
interface FamilyVariant<P, T extends { x: number; z: number; scale: number }, A extends TreeAsset = TreeAsset> {
  params: P;
  lods: A[];
  meshes: InstancedMesh[];
  placements: T[];
  matrices: Matrix4[];
  /** LOD bucket sizes (every placement is in exactly one bucket; the audit counts these) */
  counts: number[];
  /** placement indices per LOD bucket, as bucketed by camera distance */
  lists: number[][];
  /** placement indices actually submitted per LOD (the bucket minus the culled instances) */
  submitted: number[][];
  /**
   * Round 53 (W38, A over the ceiling with the squad's layers): the high bucket's shadow-only
   * instances — behind the camera, kept for the shade they throw into the frame — cast from this
   * twin on the MEDIUM geometry instead of the 100 K high mesh (a no-op colour pass: neither colour
   * nor depth is written). White-barks only; the in-view instances keep the high mesh in both passes.
   */
  shadowProxy?: InstancedMesh;
  submittedShadow?: number[];
}
type WhiteVariant = FamilyVariant<WhiteBarkParams, WhiteBarkPlacement>;
interface UnderstoryPlacement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  variant: number;
  /** a grove zone's stem: drawn only within GROVE_VISIBLE_M of the grove (util/groveLocality.ts) */
  grove?: boolean;
}
type UnderstoryVariant = FamilyVariant<UnderstoryParams, UnderstoryPlacement>;
const UNDERSTORY_VARIANTS = 5;
/**
 * Round 53 (fable-4; the owner's 2026-09-23 "the trees do not populate"): where the understory grows.
 * Strips along the walkable paths (both verges, `min`–`max` m from the centreline) and the clearing's
 * lawn between the plaza and the tall trees. Seeded from its own stream, so nothing else re-rolls.
 */
const UNDERSTORY_ZONES: { xMin: number; xMax: number; zMin: number; zMax: number; count: number; live?: boolean; spacing?: number; south?: boolean; grove?: boolean }[] = [
  // the north path's verges, from the plaza's north end to the log arch
  { xMin: -14, xMax: 14, zMin: -50, zMax: -12, count: 26 },
  // the north clearing beyond the arch, up to the stand
  { xMin: -16, xMax: 16, zMin: -66, zMax: -52, count: 12 },
  // the plaza's lawn edges, east and west
  { xMin: -30, xMax: -10, zMin: -12, zMax: 22, count: 10 },
  { xMin: 12, xMax: 32, zMin: -12, zMax: 22, count: 8 },
  // (a west-meadow zone around the far hut's knoll was built and measured: squad2's mid layer
  // already fills that meadow at 14–58 m, so it was dropped rather than double it — the `live`
  // zone kind stays for the expansion ground, masks and slope from the rendered surface)
  // round 56: the far bank either side of the log's mouth, seen from the rope bridge — `south`
  // zones keep the footing rule of the south exit (heightfield `southFooting`: off the paving, the
  // log and the gorge) and UNDERSTORY_WALK_CLEAR_M off the south route's line. LAST: the zones
  // share one stream, so a zone appended here re-rolls none before it.
  { xMin: -8, xMax: 17, zMin: 46, zMax: 57, count: 4, live: true, spacing: 4.5, south: true },
  // 2026-09-24 (expansion-north): the grove above the ledge terrace (terrain/north.ts) — leafy trees
  // beside its trail and round its shelf and decks, the band the card crowns leave
  // (GROVE_CARD_WALK_M); `grove` zones keep each crown GROVE_UNDERSTORY_GROUND_M off the walkable
  // ground and the trunk house, GROVE_UNDERSTORY_DECK_M off the raised decks and huts, and each stem
  // within GROVE_UNDERSTORY_MAX_M of the walks
  { xMin: -14, xMax: 23, zMin: -111, zMax: -80, count: 16, live: true, spacing: 3.4, grove: true },
];
/**
 * The grove understory's crowns hang from 1.5–3 m (4.5–9 m trees, 1.8–4 m crowns): 1 m off the
 * decks put their laminae across the play camera trailing Link on the veranda, so the raised decks
 * and huts keep the crowns GROVE_UNDERSTORY_DECK_M off (the camera's trail); the ground walks
 * GROVE_UNDERSTORY_GROUND_M, where a crown frames the trail without closing over it.
 */
const GROVE_UNDERSTORY_GROUND_M = 2.2;
const GROVE_UNDERSTORY_DECK_M = 4.5;
const GROVE_UNDERSTORY_MAX_M = 10;
/** the 60–215 m layer's card crowns keep at least this far (m) off the grove's walks and decks — the mid grove's MID_WALK_MIN_M, where the cards hold */
const GROVE_CARD_WALK_M = 11;
const UNDERSTORY_PATH_MIN_M = 3.4;
const UNDERSTORY_PATH_MIN_ARCH_M = 6.5;
const UNDERSTORY_ARCH_STRETCH_Z = -28;
const UNDERSTORY_PATH_MAX_M = 11;
const UNDERSTORY_SPACING_M = 3.2;
/** the walk line's clearance from every understory stem (post-filter; the sampler's own minimum stays 3.4 m so the seeded draws are unchanged) */
const UNDERSTORY_WALK_CLEAR_M = 6.5;
/**
 * Clearings the understory keeps out of: the west fork's inner corner — the owner's "the path splits off
 * into the forest" has to read from the plaza side (fable-3, 2026-09-23 11:20: the fork's waymarker at
 * (−11.2, 7.75) vanished behind a crown at the fork pose (−6.4, 1.9, 6.6) → (−9.6, 2.6, 9.4)).
 */
const UNDERSTORY_CLEARINGS: { x: number; z: number; r: number }[] = [
  { x: -10.5, z: 8.5, r: 8.5 },
  // the far hut's knoll (EXPANSION.farHut host at (−41, 35.7)) and its approach
  { x: -41, z: 35.7, r: 11 },
];
/**
 * Screen windows of the fixed views an understory crown must not cover (the same idea as VIEW_GAPS
 * for the white-barks): F's canopy gap. Fractions of the frame; `minDistance` = the nearest a tree
 * may stand to that camera and still be tested.
 */
const UNDERSTORY_VIEW_WINDOWS: { viewpoint: string; xMin: number; xMax: number; yMin: number; yMax: number; minDistance: number }[] = [
  // D's window onto the arch was tried here (x 0.30–0.58, y 0.10–0.45): a verge tree 6 m off the
  // path at 30 m still projects onto it, so protecting it empties the very corridor the owner asked
  // to fill (48 → 16 trees). The owner's walk wins over the old fixed frame (SQUAD brief, lane 4);
  // D's change is reported with the round.
  ...VIEW_GAPS,
];
interface ColumnPlacement {
  /** stable id published with the seat: 'seat-<COLUMN_SEATS index>' / 'swap-<white-bark placement index>' */
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** 'seat' = authored COLUMN_SEATS entry, 'swap' = a mature white-bark built as a column */
  source: 'seat' | 'swap';
  /** the heightfield view the seat reads (COLUMN_SEATS.view; 'legacy' = the trees' own terrain) */
  view: TerrainView;
  /** false: none of the seat's meshes casts (the far hut's host — its shadow footprint is what camera C could see) */
  casts: boolean;
}
type ColumnVariant = FamilyVariant<ColumnParams, ColumnPlacement, ColumnAsset>;

interface DistantSet {
  variant: DistantVariant;
  near: InstancedMesh;
  far: InstancedMesh;
  placements: DistantPlacement[];
  matrices: Matrix4[];
  /** LOD bucket sizes [near, far] (the audit counts these) */
  counts: [number, number];
  /** placement indices per LOD bucket */
  lists: [number[], number[]];
  /** placement indices actually submitted per LOD */
  submitted: [number[], number[]];
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
  /**
   * Near-bole LOD (giant.ts NEAR_BASE_CUT_Y): every giant and seated column has a near-base mesh
   * (relief bole, buttress fins, plant ring) that is shown — and its plain lower bole collapsed
   * through `mats.nearBole` — only while the live camera stands within NEAR_BASE_IN_M of the
   * bole (out again past NEAR_BASE_OUT_M). `nearBoleUpdate` runs every frame.
   */
  interface NearBole {
    id: string;
    /** world root (what the tree shader compares aRoot against) */
    origin: Vector3;
    /** local height the plain sweep folds to (the near base's end ring) */
    cutY: number;
    mesh: Mesh;
    triangles: number;
    active: boolean;
    dist: number;
    /** this bole's [in, out] band (see nearBand) */
    band: [number, number];
    /** the root-kit test (rootkit.ts): always shown, and its slot folds the plain roots only */
    kit?: boolean;
    /** a relief column's base (column.ts rootsOnly): shown within the band, its slot folds the plain roots only */
    rootsOnly?: boolean;
    /** the base's buffers in the near-base pool (see NEAR_BASE_PREFETCH_M); none for the root kit */
    item?: PoolItem<GeometryBuilt>;
  }
  const nearBoles: NearBole[] = [];
  /**
   * A bole's [in, out] band: the camera-derived bands first (NEAR_BASE_HERO_BAND here, then on the
   * large tier giant.ts NEAR_BASE_RADIUS_OVERRIDE_LARGE — round 51's 25 m re-derivation — then
   * NEAR_BASE_RADIUS_OVERRIDE, which holds whatever tier runs), else the tier's default (25 / 28 m
   * on the large tier from round 51, 10 / 13 as shipped). Every band keeps the nearest fixed camera
   * ≥ 2 m outside its out-radius, so the six fixed frames are the same in either tier.
   */
  const nearBand = (id: string): [number, number] => {
    const band = NEAR_BASE_HERO_BAND[id] ?? (NEAR_LOD_TIER.name === 'large' ? NEAR_BASE_RADIUS_OVERRIDE_LARGE[id] : undefined) ?? NEAR_BASE_RADIUS_OVERRIDE[id] ?? NEAR_LOD_TIER.baseBand;
    return NEAR_LOD_TIER.name === 'large' ? [Math.max(band[0], NEAR_BASE_WALK_BAND[0]), Math.max(band[1], NEAR_BASE_WALK_BAND[1])] : band;
  };
  const nearBasePool = new LodPool<GeometryBuilt>(NEAR_BASE_POOL_BYTES);
  const nearCanopyPool = new LodPool<GeometryBuilt>(NEAR_CANOPY_POOL_BYTES);
  /**
   * A pooled near part: `mesh` draws the first build's geometry now; every later build runs
   * `steps` and `finalize` (the same world transform, cull sphere and pad the first build got),
   * and while the buffers are out of the pool the mesh holds an empty placeholder with the same
   * cull sphere. Returns the item and the first build to register with a pool.
   */
  const poolItem = (id: string, mesh: Mesh, steps: () => Generator<void, BufferGeometry>, finalize: (g: BufferGeometry) => void, firstBuilt = true, estimatedBytes = 0): [PoolItem<GeometryBuilt>, GeometryBuilt | null] => {
    const first = mesh.geometry;
    const placeholder = placeholderFor(first);
    // the bytes are read before the upload; after it the CPU copies go (releaseAfterUpload)
    const wrap = (geometry: BufferGeometry): GeometryBuilt => {
      compactAttributes(geometry);
      const bytes = geometryBytes(geometry);
      releaseAfterUpload(geometry);
      return { geometry, bytes, dispose: () => geometry.dispose() };
    };
    const item: PoolItem<GeometryBuilt> = {
      id,
      bytes: estimatedBytes,
      build: function* () {
        const g = yield* steps();
        finalize(g);
        return wrap(g);
      },
      install: (b) => {
        mesh.geometry = b.geometry;
      },
      uninstall: () => {
        mesh.geometry = placeholder;
      },
    };
    return [item, firstBuilt ? wrap(first) : null];
  };
  /**
   * Round 54 (fable-4): the giants' near-canopy lobes and limbs draw as ONE mesh. Each part is a
   * pooled geometry of its own (built lazily, evicted by the memory tier) and used to be a Mesh of
   * its own too, so every shown lobe was a draw: up to NEAR_CANOPY_SLOTS + NEAR_CANOPY_LIMBS_MAX
   * of them under the plaza's giants (camera A: 64 → 1), 45 at the east green's look back at the
   * plaza (round54-lookback-draws). They all share `mats.giantTreeNearCanopy` and their geometry is
   * already in world space (giantPartToWorld), so a BatchedMesh holds them: the pool's `install` /
   * `uninstall` become addGeometry / deleteGeometry, `mesh.visible` becomes setVisibleAt, each
   * part keeps its own cull sphere (three copies the geometry's padded boundingSphere into the
   * batch) and the fold slots are vertex data (`aRoot`) that travel with the copy. With
   * WEBGL_multi_draw the batch is one draw; without it three draws the visible parts one by one,
   * as before. The batch keeps a CPU copy of its buffers (three needs it to copy new parts in),
   * where the pooled parts dropped theirs after upload — the geometry is reserved in steps and
   * grown when the pool wants more, so the heap cost is the RESIDENT set's bytes, not the shown
   * set's: measured at camera A on the large tier, 258 giant parts / 1.91 M vertices in the batch,
   * 171 MB of typed arrays (the pool holds 379 parts within its 42 m prefetch there); on the small
   * tier the pool's 32 MB cap bounds it near 45 MB. The seated columns' parts (10–18 draws at the
   * plateau's look-backs) go into a batch of their own, in the columns' group: their geometry is
   * the seat's local space — a yaw and a scale the tree shader read through modelMatrix, which a
   * batch instance does not have — so `bakePartToWorld` takes each built copy through the seat's
   * matrix (positions, normals, `aRoot`) before it goes in. That also puts their wind right: the
   * shader adds its world-space sway in object space on a plain mesh (the instanced trees turn it
   * back through instanceMatrix), so a seated column's lobes swayed in a direction turned by the
   * seat's yaw from the trunk's; in the batch (identity) they sway with their tree.
   * `NEAR_CANOPY_BATCHED` false restores the per-part meshes of both.
   */
  const NEAR_CANOPY_BATCHED = true;
  class NearCanopyBatch {
    readonly mesh: BatchedMesh;
    private maxVertices: number;
    private maxIndices: number;
    private maxInstances: number;
    private vertices = 0;
    private indices = 0;
    private instances = 0;
    constructor(material: Material, name: string, kind: string, maxInstances = 96, maxVertices = 300_000, maxIndices = 900_000) {
      this.maxInstances = maxInstances;
      this.maxVertices = maxVertices;
      this.maxIndices = maxIndices;
      this.mesh = new BatchedMesh(maxInstances, maxVertices, maxIndices, material);
      this.mesh.name = name;
      this.mesh.castShadow = false;
      this.mesh.receiveShadow = true;
      this.mesh.frustumCulled = false;
      this.mesh.perObjectFrustumCulled = true;
      this.mesh.sortObjects = false;
      this.mesh.userData.kind = kind;
    }
    /** copies the part in (one geometry, one instance at the identity), hidden; the caller disposes its own copy */
    add(geometry: BufferGeometry): { geomId: number; instId: number } {
      const v = geometry.getAttribute('position').count;
      const i = geometry.index ? geometry.index.count : v;
      this.reserve(v, i);
      let geomId: number;
      try {
        geomId = this.mesh.addGeometry(geometry);
      } catch {
        // the free space is there but fragmented by evictions: compact, then grow if it still does not fit
        this.mesh.optimize();
        try {
          geomId = this.mesh.addGeometry(geometry);
        } catch {
          this.grow(this.maxVertices + v, this.maxIndices + i);
          geomId = this.mesh.addGeometry(geometry);
        }
      }
      const instId = this.mesh.addInstance(geomId);
      this.mesh.setMatrixAt(instId, IDENTITY_M4);
      this.mesh.setVisibleAt(instId, false);
      this.vertices += v;
      this.indices += i;
      this.instances++;
      return { geomId, instId };
    }
    remove(ids: { geomId: number; instId: number }, vertices: number, indices: number) {
      this.mesh.deleteInstance(ids.instId);
      this.mesh.deleteGeometry(ids.geomId);
      this.vertices -= vertices;
      this.indices -= indices;
      this.instances--;
      this.removedSince++;
    }
    private removedSince = 0;
    /** parts built whose colours or wind fell outside the compaction's ranges (Float32 on the per-mesh path too) */
    wideParts = 0;
    /**
     * A BatchedMesh never shrinks by itself: the reserve stays at the high-water mark and deleted
     * parts leave holes (an add that does not fit compacts, but the reserve keeps its size). Once a
     * frame the pool has evicted from, when the parts left use under half the reserve, compact and
     * give the reserve back to 1.25 × the live set — the heap follows the pool's resident bytes
     * instead of the walk's peak.
     */
    trim() {
      if (this.removedSince === 0) return;
      this.removedSince = 0;
      if (this.vertices * 2 > this.maxVertices && this.indices * 2 > this.maxIndices) return;
      this.mesh.optimize();
      this.grow(Math.max(65_536, this.vertices * 1.25), Math.max(196_608, this.indices * 1.25));
    }
    setVisible(instId: number, visible: boolean) {
      this.mesh.setVisibleAt(instId, visible);
    }
    private reserve(v: number, i: number) {
      if (this.instances + 1 > this.maxInstances) {
        this.maxInstances = Math.ceil(this.maxInstances * 1.5);
        this.mesh.setInstanceCount(this.maxInstances);
      }
      if (this.vertices + v > this.maxVertices || this.indices + i > this.maxIndices) this.grow(Math.max(this.maxVertices * 1.25, this.vertices + v), Math.max(this.maxIndices * 1.25, this.indices + i));
    }
    private grow(v: number, i: number) {
      this.maxVertices = Math.ceil(v);
      this.maxIndices = Math.ceil(i);
      this.mesh.setGeometrySize(this.maxVertices, this.maxIndices);
    }
    get stats() {
      return { instances: this.instances, vertices: this.vertices, indices: this.indices, maxVertices: this.maxVertices, maxIndices: this.maxIndices, wideParts: this.wideParts };
    }
    /** the bytes of the batch's CPU copy (every attribute's reserved array and the index) */
    get heapBytes() {
      const g = this.mesh.geometry;
      return Object.values(g.attributes).reduce((b, a) => b + (a as BufferAttribute).array.byteLength, 0) + (g.index ? g.index.array.byteLength : 0);
    }
  }
  const IDENTITY_M4 = new Matrix4();
  const nearCanopyBatch = NEAR_CANOPY_BATCHED ? new NearCanopyBatch(mats.giantTreeNearCanopy, 'giant-near-canopy-batch', 'giant-near-canopy') : null;
  /** the seated columns' near parts' batch (fewer parts than the giants': ten seats' lobes, no limbs) */
  const columnNearCanopyBatch = NEAR_CANOPY_BATCHED ? new NearCanopyBatch(mats.giantTreeNearCanopy, 'column-near-canopy-batch', 'column-near-canopy', 32, 100_000, 300_000) : null;
  /**
   * A seated column's near part into world space for its batch: positions and normals through the
   * seat's matrix (yaw, uniform scale, seat), `aRoot`'s point with them (the fold root the shader
   * compares slots against, or a cushion's anchor — what modelMatrix gave the per-mesh part), and
   * the cull sphere the per-mesh part was tested by: the local sphere through the matrix, the
   * wind pad in world metres (a mesh's pad was CULL_PAD_M / scale in its own units).
   */
  const bakePartToWorld = (g: BufferGeometry, m: Matrix4, scale: number) => {
    const local = g.boundingSphere ? g.boundingSphere.clone() : null;
    g.applyMatrix4(m);
    const root = g.getAttribute('aRoot') as BufferAttribute;
    const v = new Vector3();
    for (let i = 0; i < root.count; i++) {
      v.set(root.getX(i), root.getY(i), root.getZ(i)).applyMatrix4(m);
      root.setXYZ(i, v.x, v.y, v.z);
    }
    root.needsUpdate = true;
    if (local && g.boundingSphere) {
      g.boundingSphere.center.copy(local.center).applyMatrix4(m);
      g.boundingSphere.radius = local.radius * scale + CULL_PAD_M;
    }
  };
  /** a pooled part that lives in a `NearCanopyBatch`: the built copy goes in on install (through `bake`, if the part is not authored in world space) and its own arrays are dropped; on uninstall the part leaves the batch */
  const batchPoolItem = (id: string, batch: NearCanopyBatch, record: { shown: boolean; batchIds: { geomId: number; instId: number } | null; vertices: number }, first: BufferGeometry, steps: () => Generator<void, BufferGeometry>, finalize: (g: BufferGeometry) => void, firstBuilt = true, estimatedBytes = 0, bake: ((g: BufferGeometry) => void) | null = null): [PoolItem<GeometryBuilt>, GeometryBuilt | null] => {
    // one layout across every part (the batch's rule): normals compact to Int8 as every part's
    // always did (they are always in range, so the shading matches the per-mesh parts to the bit);
    // colours and wind stay Float32, whose compaction was per part. The pool counts the bytes the
    // full compaction would have left, so its admission matches the per-mesh parts'.
    const wrap = (geometry: BufferGeometry): GeometryBuilt => {
      if (bake) bake(geometry);
      const bytes = compactedBytes(geometry);
      if (bytes !== compactedBytes(geometry, true)) batch.wideParts++;
      compactAttributes(geometry, 'normal');
      return { geometry, bytes, dispose: () => geometry.dispose() };
    };
    let live: { ids: { geomId: number; instId: number }; vertices: number; indices: number } | null = null;
    const item: PoolItem<GeometryBuilt> = {
      id,
      bytes: estimatedBytes,
      build: function* () {
        const g = yield* steps();
        finalize(g);
        return wrap(g);
      },
      install: (b) => {
        const vertices = b.geometry.getAttribute('position').count;
        const indices = b.geometry.index ? b.geometry.index.count : vertices;
        const ids = batch.add(b.geometry);
        live = { ids, vertices, indices };
        record.batchIds = ids;
        record.vertices = vertices;
        batch.setVisible(ids.instId, record.shown);
        // the batch holds the only copy that draws; the part's own arrays go now, not at eviction
        for (const name of Object.keys(b.geometry.attributes)) b.geometry.deleteAttribute(name);
        b.geometry.setIndex(null);
        b.geometry.dispose();
      },
      uninstall: () => {
        if (live) batch.remove(live.ids, live.vertices, live.indices);
        live = null;
        record.batchIds = null;
        record.vertices = 0;
      },
    };
    // the pool's `add(item, built)` takes a first build as already installed (a mesh holds its own
    // first geometry): a batched part installs it here
    const built = firstBuilt ? wrap(first) : null;
    if (built) item.install(built);
    return [item, built];
  };
  /**
   * Near-canopy LOD (giant.ts NEAR_CANOPY_IN_M): every eligible lobe of a giant
   * (and every big limb below the cap) has a near part of its own — twiglets forking off the far
   * twigs, dense sprays of cupped laminae, moss along the boughs, vines — shown only while the
   * live camera is within NEAR_CANOPY_IN_M of the lobe's centre (out again past
   * NEAR_CANOPY_OUT_M), the lobe's far laminae and cards folded away through `mats.nearCanopy`
   * meanwhile (colour pass only: the shadows stay the far foliage's, and the near parts cast
   * nothing). `nearCanopyUpdate` runs every frame.
   */
  interface NearCanopy {
    /** `${giant}/${kind}-${index}` */
    id: string;
    tree: string;
    kind: NearCanopyPart['kind'];
    /** world root (what the tree shader compares aRoot against) and the lobe's swap group (−1 for a limb dressing) */
    root: Vector3;
    group: number;
    /** world centre the swap distance is measured to */
    center: Vector3;
    /** Authored crown reach in world metres; distance is measured to this envelope. */
    radius: number;
    /** the part's swap distances, capped by the selected memory tier */
    inM: number;
    outM: number;
    /** authored NEAR_CANOPY_FLAT_SWAP_M distances (nearCanopy.ts NearCanopyPart.fixedSwap) */
    fixedSwap: boolean;
    persistent?: boolean;
    /** the part's own mesh (every part when NEAR_CANOPY_BATCHED is off) */
    mesh?: Mesh;
    /** drawn this frame (the mesh's `visible`, or the batch instance's) */
    shown: boolean;
    /** the batch the part draws from (the giants' or the columns'; null for a mesh of its own) and its place there while resident */
    batch: NearCanopyBatch | null;
    batchIds: { geomId: number; instId: number } | null;
    /** the resident buffers' vertex count (a batched part's; a mesh's is read from its geometry) */
    vertices: number;
    triangles: number;
    leaves: number;
    farLeaves: number;
    farCards: number;
    active: boolean;
    dist: number;
    /** the part's buffers in the near-canopy pool (see NEAR_CANOPY_PREFETCH_M) */
    item: PoolItem<GeometryBuilt>;
  }
  const nearCanopies: NearCanopy[] = [];
  /** how many limb dressings may be shown at once (they take no slot: nothing is folded for them) */
  const NEAR_CANOPY_LIMBS_MAX = 12;
  const basePalette = {
    fern: new Color(palette.grassMid),
    fernDeep: new Color(palette.grassDeep),
    tuft: new Color(palette.leafCanopy),
    tuftSun: new Color(palette.leafSun).lerp(new Color(palette.leafCanopy), 0.4),
    litter: new Color(palette.soil),
    litterDark: new Color(palette.soilDark),
  };
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
    /** also carves the corridor-exempt lobes (corridors.ts CanopyOpening.hard) */
    hard?: boolean;
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
  // the plaza lines the white-bark placement keeps its crowns off (see PLAZA_SUN_POINTS; not passed
  // to the giants since round 14)
  const plazaCorridors = PLAZA_SUN_POINTS.map(({ point, radius }) => groundLine(point, radius, 1, 1));
  // canopy openings (see CANOPY_OPENINGS): the sun cylinder over each ground pool, cleared within
  // its height band, and the dense card collar around it (GiantOptions.densify)
  const openingCorridors: WorldCorridor[] = CANOPY_OPENINGS.map((c) => ({
    ...groundLine([c.point[0], 0, c.point[1]], c.radius, c.porosity ?? 0, c.cardPorosity ?? 0, c.band[0]),
    yMax: c.band[1],
    hard: c.hard,
  }));
  const openingCollars = CANOPY_OPENINGS.map((c) => ({
    point: new Vector3(c.point[0], terrain.height(c.point[0], c.point[1]), c.point[1]),
    dir: sunDir,
    inner: c.radius,
    outer: c.radius + (c.collar ?? CANOPY_OPENING_COLLAR),
    factor: c.densify ?? CANOPY_OPENING_DENSIFY,
    yMin: c.band[0],
    yMax: c.band[1],
  }));
  const sunCorridors: WorldCorridor[] = [
    ...SHAFT_COLUMNS.map((c) => ({ point: new Vector3(c.point[0], c.point[1], c.point[2]), dir: sunDir, radius: c.carve ?? c.radius, porosity: c.porosity ?? 0, cardPorosity: c.cardPorosity ?? 0 })),
    ...openingCorridors,
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
  // the view ray of a hero camera through a screen point (unit vector from its eye)
  const screenRay = (view: (typeof ctx.layout.viewpoints)[number], screen: [number, number]) => {
    const eye = new Vector3(view.position[0], view.position[1], view.position[2]);
    const forward = new Vector3(view.target[0], view.target[1], view.target[2]).sub(eye).normalize();
    const right = new Vector3(-forward.z, 0, forward.x).normalize();
    const up = new Vector3().crossVectors(right, forward);
    const th = Math.tan((view.fov * Math.PI) / 360);
    const dir = forward
      .clone()
      .addScaledVector(right, (screen[0] - 0.5) * 2 * th * (16 / 9))
      .addScaledVector(up, (0.5 - screen[1]) * 2 * th)
      .normalize();
    return { eye, dir };
  };
  // view corridors through screen points of a hero camera (see VIEW_GAP_RAYS): the ray through the
  // point, active from `minDistance` out — a rising ray is capped from below by the height it has
  // there (a falling one from above), which is the same cut since height is monotonic along it
  const rayCorridors: WorldCorridor[] = [];
  for (const gap of VIEW_GAP_RAYS) {
    const view = ctx.layout.viewpoints.find((v) => v.id === gap.viewpoint);
    if (!view) continue;
    const { eye, dir } = screenRay(view, gap.screen);
    const point = eye.clone().addScaledVector(dir, gap.minDistance);
    rayCorridors.push({
      point,
      dir,
      radius: gap.radius,
      porosity: VIEW_GAP_RAY_POROSITY,
      cardPorosity: VIEW_GAP_RAY_CARD_POROSITY,
      yMin: dir.y > 0 ? point.y : undefined,
      yMax: dir.y < 0 ? point.y : undefined,
    });
  }
  const giantCorridors: WorldCorridor[] = [...sunCorridors, ...gapCorridors, ...rayCorridors];

  // ------------------------------------------------------------------ white-bark variants
  const whiteRng = rng.fork('whitebark');
  const whites: WhiteVariant[] = [];
  for (let i = 0; i < WHITE_VARIANTS; i++) {
    const params = whiteBarkParams(whiteRng, i, WHITE_VARIANTS);
    const lods = DETAILS.map((d) => createWhiteBarkTree(params, palette, d));
    whites.push({ params, lods, meshes: [], placements: [], matrices: [], counts: [0, 0, 0], lists: [[], [], []], submitted: [[], [], []] });
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
  // mature white-barks standing in a hero frame's far wall are built as dark columns instead
  // (see COLUMN_SWAP); the rest of the placement is exactly the drawn one
  const heroProjectors = COLUMN_VIEWS.map((id) => ctx.layout.viewpoints.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => !!v)
    .map((v) => viewProjector(new Vector3(v.position[0], v.position[1], v.position[2]), new Vector3(v.target[0], v.target[1], v.target[2]), v.fov, 16 / 9));
  const inFarWall = (x: number, y: number, z: number): boolean => {
    for (const project of heroProjectors) {
      const s = project(_p.set(x, y, z));
      if (!s) continue;
      if (s[2] >= COLUMN_SWAP.minDistance && s[2] <= COLUMN_SWAP.maxDistance && s[0] >= COLUMN_SWAP.xMin && s[0] <= COLUMN_SWAP.xMax && s[1] >= COLUMN_SWAP.minBaseY) return true;
    }
    return false;
  };
  // Round 49/50 (fable-4 d6f5f35f, trees-32): the SAMPLED stream against the round-49 expansion's ground
  // (heightfield.ts expansionCull) — a filter after the placement, so nothing re-rolls: an instance
  // the legacy plain seated where the live ground is the bank, a stepping disc or the knoll is
  // dropped rather than left buried or floating. Take-0123's 80 sampled trees: none culled (the
  // audit's whiteBarkCulled), so the six frames keep every tree they show. The authored entries
  // below are not filtered (the knoll pair is seated on the live ground on purpose).
  // Round 56 (expansion-south): on the south exit's ground `southFooting` decides as well — a trunk
  // whose footing touches the paving, the log or the gorge is dropped (the stem that stood against
  // the log's mouth), and one the far bank's mound lifted stands on the live bank (it was culled as
  // buried, which left the bank bald). `drawnWhites` is the set as drawn before round 56: the
  // streams after this one (the understory, the columns and their swap draws, the mid grove, the
  // root toes) stand off IT, so a dropped south stem re-rolls none of them.
  const drawnWhites = whitePlaced.placements.filter((p) => !westExpansionCull(p.x, p.z));
  const southFootings = new Map(drawnWhites.map((p) => [p, southFooting(p.x, p.z, SOUTH_TRUNK_REACH_M, whites[p.variant].params.trunkRadius * p.scale + SOUTH_LIP_MARGIN_M)]));
  const sampledWhites = drawnWhites.filter((p) => southFootings.get(p) !== 'cull');
  const whiteBarkCulled = whitePlaced.placements.filter((p) => !sampledWhites.includes(p)).map((p) => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]);
  const drawnSwaps = drawnWhites.filter((p) => whites[p.variant].params.age === 'mature' && inFarWall(p.x, p.y, p.z));
  const swappedWhites = drawnSwaps.filter((p) => southFootings.get(p) !== 'cull');
  const liveTerrain = getTerrain();
  for (const p of sampledWhites) {
    if (southFootings.get(p) !== 'live') continue;
    p.y = liveTerrain.height(p.x, p.z);
    p.view = 'live';
  }
  const whitePlacements = sampledWhites.filter((p) => !swappedWhites.includes(p));
  const authoredWhites = authoredWhiteBarks(whites.map((w) => w.params), terrain);
  whitePlacements.push(...authoredWhites);
  // the two white-barks off the far hut's knoll (round 50, trees-32), seated on the LIVE ground
  // (both views agree there: −0.14 / 0.34 m — the knoll's rise ends 8 m from the hut), from their
  // own stream. Mature variants chosen for the crown radius: (−34, 45) stands 5.7 m west of camera
  // C's edge on the ground and 64 m from C, its crown rim 2.5 m outside C's right plane (the
  // smallest mature crown, 3.3 m); (−50, 39) is 23 m outside. Both are in every fixed camera's
  // FAR LOD (≥ 49.5 m, lodDist 44 at quality high), which does not cast — the (−34, 45) tree's
  // shadow would otherwise land 12 m inside C's frame.
  const knollWhites: WhiteBarkPlacement[] = [];
  {
    const knollRng = rng.fork('whitebark/knoll');
    const mature = whites.map((w, i) => (w.params.age === 'mature' ? i : -1)).filter((i) => i >= 0);
    // a smaller / larger crown among the mature variants (by the low LOD's radius)
    const byRadius = [...mature].sort((a, b) => whites[a].lods[2].radius - whites[b].lods[2].radius);
    for (const spot of KNOLL_WHITE_BARKS) {
      const variant = byRadius.length ? byRadius[spot.crown === 'small' ? 0 : byRadius.length - 1] : 0;
      knollWhites.push({ variant, x: spot.x, y: liveTerrain.height(spot.x, spot.z), z: spot.z, yaw: knollRng() * TAU, scale: knollRng.range(0.92, 1.08), view: 'live' });
    }
  }
  whitePlacements.push(...knollWhites);
  /** the white-barks the later streams stand off, in the order they were built before round 56 (see `drawnWhites`) */
  const whiteClearance = [...drawnWhites.filter((p) => !drawnSwaps.includes(p)), ...authoredWhites, ...knollWhites];
  const seatFamily = <P, T extends { x: number; y: number; z: number; yaw: number; scale: number }>(variants: FamilyVariant<P, T>[], p: T, variant: number, tilt: Quaternion | null = null) => {
    const w = variants[variant];
    w.placements.push(p);
    _q.setFromAxisAngle(_v.set(0, 1, 0), p.yaw);
    if (tilt) _q.premultiply(tilt);
    _s.setScalar(p.scale);
    _p.set(p.x, p.y, p.z);
    w.matrices.push(new Matrix4().compose(_p, _q, _s));
  };
  // fable-4 (round 50, W08 at C): the hero stem's instance tilt — whitebark.ts HERO_WHITE_BARK_TILTS
  for (const p of whitePlacements) seatFamily(whites, p, p.variant, whiteBarkTilt(p.x, p.z));
  // the play camera refuses to stand inside a white-bark's bole (camera/collision.ts)
  ctx.shared.slimTrunks = whitePlacements.map((p) => {
    const w = whites[p.variant];
    return { x: p.x, z: p.z, r: w.params.trunkRadius * p.scale * 1.25, y0: p.y - 0.5, y1: p.y + w.lods[0].height * p.scale * 0.6 };
  });
  /**
   * A tree's colour-pass bound: the crown (leaf vertices, aRoot.w > 0.5) and the wood split at its
   * mid-height as three spheres. The convex hull of the three is outside a frustum plane iff every
   * sphere is; for a tall thin tree that hull is far tighter than the geometry's one sphere, which
   * for a 20 m white-bark 9 m behind the camera still swallowed the camera. Computed while the
   * CPU arrays exist (they are released after the first upload).
   */
  const geometryHull = (geometry: BufferGeometry): Sphere[] => {
    const pos = geometry.attributes.position;
    const root = geometry.attributes.aRoot;
    if (!pos || !pos.array || !root || !root.array || root.itemSize < 4) return [geometry.boundingSphere!.clone()];
    const box: Box3[] = [new Box3(), new Box3(), new Box3()];
    const v = new Vector3();
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (root.getW(i) > 0.5) continue;
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const midY = (minY + maxY) / 2;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const leaf = root.getW(i) > 0.5;
      box[leaf ? 0 : v.y < midY ? 1 : 2].expandByPoint(v);
    }
    const out: Sphere[] = [];
    for (let b = 0; b < 3; b++) {
      if (box[b].isEmpty()) continue;
      const sp = new Sphere();
      box[b].getCenter(sp.center);
      sp.radius = 0;
      for (let i = 0; i < pos.count; i++) {
        const leaf = root.getW(i) > 0.5;
        if ((leaf ? 0 : pos.getY(i) < midY ? 1 : 2) !== b) continue;
        v.fromBufferAttribute(pos, i);
        const d = v.distanceTo(sp.center);
        if (d > sp.radius) sp.radius = d;
      }
      out.push(sp);
    }
    return out.length ? out : [geometry.boundingSphere!.clone()];
  };
  /** the shadow proxies' colour-pass material: writes neither colour nor depth — only the shadow pass sees them */
  const shadowOnlyMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const familyMeshes = <P, T extends { x: number; z: number; scale: number }>(variants: FamilyVariant<P, T>[], label: string, material: Material, depth: Material, parent: Group) => {
    for (const w of variants) {
      const n = Math.max(1, w.placements.length);
      for (let l = 0; l < DETAILS.length; l++) {
        const mesh = new InstancedMesh(w.lods[l].geometry, material, n);
        mesh.name = `${label}-${(w.params as { seed: string }).seed}-${DETAILS[l]}`;
        mesh.customDepthMaterial = depth;
        // near and mid LODs cast shadows (dappled light on the paths); the far LOD only receives.
        // Round 51 (W38; fable-2's triangle map: the shadow pass is a third of every frame and the
        // trees' casters 1.3 M of it whichever way the camera looks): the WHITE-BARKS' mid meshes no
        // longer cast — their dapple fell on ground 20–44 m out, under the haze. The columns' mid
        // meshes keep casting: measured without them E −0.0032 / A, D −0.0019 (their shade is on
        // the paths the fixed views frame).
        mesh.castShadow = l < (label === 'whitebark' ? 1 : 2) && ctx.quality.shadows;
        mesh.receiveShadow = true;
        mesh.count = 0;
        mesh.visible = false;
        mesh.userData.kind = label;
        mesh.userData.lodLevel = l;
        mesh.userData.hull = geometryHull(w.lods[l].geometry);
        w.meshes.push(mesh);
        parent.add(mesh);
        if (label === 'whitebark' && l === 0 && ctx.quality.shadows) {
          const proxy = new InstancedMesh(w.lods[1].geometry, shadowOnlyMaterial, n);
          proxy.name = `${label}-${(w.params as { seed: string }).seed}-high-shadow`;
          proxy.customDepthMaterial = depth;
          proxy.castShadow = true;
          proxy.receiveShadow = false;
          proxy.count = 0;
          proxy.visible = false;
          proxy.userData.kind = label;
          proxy.userData.lodLevel = 0;
          proxy.userData.shadowProxy = true;
          parent.add(proxy);
          w.shadowProxy = proxy;
          w.submittedShadow = [];
        }
      }
    }
  };
  const whiteGroup = new Group();
  whiteGroup.name = 'white-bark';
  familyMeshes(whites, 'whitebark', mats.whiteTree, mats.whiteTreeDepth, whiteGroup);
  // Root flares (fable-4) only on the white-barks a walker can get near: within WHITE_ROOT_REACH_M of
  // the walkable network (spine, house branch, north path). The flare reads within ~20 m; on the 80
  // trees it was one always-drawn mesh, +80 K triangles in camera A (W38 ceiling 9.0 M).
  const WHITE_ROOT_REACH_M = 24;
  const walkXZ: [number, number][][] = [
    ctx.layout.pathSpine.map((p) => [p[0], p[2]] as [number, number]),
    ctx.layout.pathToHouse.map((p) => [p[0], p[2]] as [number, number]),
    ctx.layout.northPath.map((p) => [p[0], p[2]] as [number, number]),
  ];
  // round 56: each tree's toes keep the stream they had in the drawn order (`whiteClearance`) when a
  // south stem before them is dropped, and on the south exit they bed on the rendered ground
  const rootPlacements: RootPlacement[] = [];
  whiteClearance
    .filter((p) => walkXZ.some((poly) => poly.length > 1 && spineDistance(poly, p.x, p.z) <= WHITE_ROOT_REACH_M))
    .forEach((p, toeStream) => whitePlacements.includes(p) && rootPlacements.push({ ...p, toeStream }));
  const rootGround = { height: (x: number, z: number) => (z > 10 && inExpansionSouth(x, z) ? liveTerrain : terrain).height(x, z) };
  whiteGroup.add(createWhiteBarkRoots(whites.map((w) => w.params), rootPlacements, rootGround, palette, mats.whiteTree, mats.whiteTreeDepth, ctx.quality.shadows));
  group.add(whiteGroup);
  ctx.progress('trees', 0.5);
  await yieldFrame();

  // ------------------------------------------------------------------ understory (round 53)
  const understoryRng = rng.fork('understory');
  const understory: UnderstoryVariant[] = [];
  for (let i = 0; i < UNDERSTORY_VARIANTS; i++) {
    const params = understoryParams(understoryRng, i, UNDERSTORY_VARIANTS);
    const lods = DETAILS.map((d) => createUnderstoryTree(params, palette, d));
    understory.push({ params, lods, meshes: [], placements: [], matrices: [], counts: [0, 0, 0], lists: [[], [], []], submitted: [[], [], []] });
  }
  const understoryPlacements: UnderstoryPlacement[] = [];
  const understoryPathDistance = (x: number, z: number) => Math.min(...walkXZ.map((poly) => (poly.length > 1 ? spineDistance(poly, x, z) : Infinity)));
  {
    const placeRng = understoryRng.fork('place');
    const viewpoints = ctx.layout.viewpoints.map((v) => ({ x: v.position[0], z: v.position[2] }));
    const seats = [...COLUMN_SEATS.map((c) => ({ x: c.x, z: c.z, r: 4 })), ...[...ctx.layout.giantTrees, ...EXTRA_GIANTS].map((g) => ({ x: g.position[0], z: g.position[2], r: g.trunkRadius * 2.5 + 2.5 }))];
    const tooClose = (x: number, z: number, spacing: number) => {
      if (viewpoints.some((v) => Math.hypot(v.x - x, v.z - z) < 7)) return true;
      if (seats.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) return true;
      if (whiteClearance.some((w) => Math.hypot(w.x - x, w.z - z) < 2.6)) return true;
      if (understoryPlacements.some((u) => Math.hypot(u.x - x, u.z - z) < spacing)) return true;
      return false;
    };
    const pathDistance = (x: number, z: number) => Math.min(...walkXZ.map((poly) => (poly.length > 1 ? spineDistance(poly, x, z) : Infinity)));
    const windows = UNDERSTORY_VIEW_WINDOWS.map((w) => {
      const view = ctx.layout.viewpoints.find((v) => v.id === w.viewpoint);
      if (!view) return null;
      const position = new Vector3(view.position[0], view.position[1], view.position[2]);
      const project = viewProjector(position, new Vector3(view.target[0], view.target[1], view.target[2]), view.fov, 16 / 9);
      const th = Math.tan((view.fov * Math.PI) / 360);
      return { w, position, project, th };
    }).filter((w): w is NonNullable<typeof w> => w !== null);
    const coversWindow = (x: number, y: number, z: number, variant: number, scale: number) => {
      const u = understory[variant];
      const cr = u.params.crownRadius * scale;
      const centre = new Vector3(x, y + u.lods[0].height * scale - cr * 0.85, z);
      for (const { w, position, project, th } of windows) {
        if (position.distanceTo(centre) < w.minDistance) continue;
        const pr = project(centre);
        if (!pr) continue;
        const [sx, sy, depth] = pr;
        const rx = (0.5 * (cr / depth)) / (th * (16 / 9));
        const ry = (0.5 * (cr / depth)) / th;
        if (sx + rx > w.xMin && sx - rx < w.xMax && sy + ry > w.yMin && sy - ry < w.yMax) return true;
      }
      return false;
    };
    for (const zone of UNDERSTORY_ZONES) {
      let placed = 0;
      // masks and slope from the view the zone lives on; the seat height always from the rendered
      // surface (`liveTerrain` = the lattice the terrain mesh draws), so every stem meets the ground
      const t = zone.live ? liveTerrain : terrain;
      const spacing = zone.spacing ?? UNDERSTORY_SPACING_M;
      for (let attempt = 0; attempt < zone.count * 60 && placed < zone.count; attempt++) {
        const x = zone.xMin + placeRng() * (zone.xMax - zone.xMin);
        const z = zone.zMin + placeRng() * (zone.zMax - zone.zMin);
        const d = pathDistance(x, z);
        // nearer the arch the verge widens: D's window onto the arch's opening stays readable while
        // the corridor keeps its trees on both sides (the reference's D frames the arch with trees)
        const pathMin = z < UNDERSTORY_ARCH_STRETCH_Z ? UNDERSTORY_PATH_MIN_ARCH_M : UNDERSTORY_PATH_MIN_M;
        if (d < pathMin || (!zone.live && d > UNDERSTORY_PATH_MAX_M)) continue;
        if (!zone.live && expansionCull(x, z)) continue;
        if (zone.south && (southWalkDistance(x, z) < UNDERSTORY_WALK_CLEAR_M || southFooting(x, z, SOUTH_TRUNK_REACH_M, 0.5) === 'cull')) continue;
        const m = t.mask(x, z);
        if (m.path > 0.05 || m.stairs > 0 || m.structure > 0 || m.cliff > 0.3) continue;
        // the arch's footprint and the columns' roots have their own masks; keep off steep ground too
        if (t.slope(x, z) > 0.55) continue;
        if (UNDERSTORY_CLEARINGS.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
        if (tooClose(x, z, spacing)) continue;
        const variant = placeRng.int(0, UNDERSTORY_VARIANTS);
        const scale = placeRng.range(0.85, 1.15);
        if (zone.grove) {
          const cr = understory[variant].params.crownRadius * scale;
          if (groveWalkDistance(x, z) > GROVE_UNDERSTORY_MAX_M) continue;
          if (groveGroundDistance(x, z) < cr + GROVE_UNDERSTORY_GROUND_M || groveDeckDistance(x, z) < cr + GROVE_UNDERSTORY_DECK_M) continue;
          if (northGroveClear(x, z, understory[variant].params.trunkRadius * scale + 0.2)) continue;
          if (northGroveHuts().some((h) => Math.hypot(x - h.x, z - h.z) < h.r + cr + (h.id === 'house' ? GROVE_UNDERSTORY_GROUND_M : GROVE_UNDERSTORY_DECK_M))) continue;
        }
        const y = liveTerrain.height(x, z);
        if (coversWindow(x, y, z, variant, scale)) continue;
        understoryPlacements.push({ x, y, z, yaw: placeRng() * TAU, scale, variant, grove: zone.grove });
        placed++;
      }
    }
  }
  /**
   * fable-5 (lane 10, 17:56) + fable-cursor (18:40): at `h-west-front` and the owner's 06:50 pose a
   * walker at eye height stood inside the verge crowns seated 3.4 m from the centreline (the arch
   * stretch's 6.5 m read right). The walk line keeps UNDERSTORY_WALK_CLEAR_M everywhere — applied as a
   * post-filter over the sampled list, so no other stem moves (a rule inside the loop shifts every
   * later draw).
   */
  const understoryKept = understoryPlacements.filter((p) => understoryPathDistance(p.x, p.z) >= UNDERSTORY_WALK_CLEAR_M);
  understoryPlacements.length = 0;
  understoryPlacements.push(...understoryKept);
  for (const p of understoryPlacements) seatFamily(understory, p, p.variant);
  const understoryGroup = new Group();
  understoryGroup.name = 'understory';
  familyMeshes(understory, 'understory', mats.giantTree, mats.giantTreeDepth, understoryGroup);
  group.add(understoryGroup);
  ctx.shared.slimTrunks = [
    ...(ctx.shared.slimTrunks ?? []),
    ...understoryPlacements.map((p) => {
      const u = understory[p.variant];
      return { x: p.x, z: p.z, r: u.params.trunkRadius * p.scale * 1.4, y0: p.y - 0.5, y1: p.y + u.lods[0].height * p.scale * 0.5 };
    }),
  ];
  ctx.progress('trees', 0.52);
  await yieldFrame();

  // ------------------------------------------------------------------ column trees
  const giantDefsAll: GiantTreeDef[] = [...ctx.layout.giantTrees, ...EXTRA_GIANTS];
  const columnRng = rng.fork('columns');
  const columns: ColumnVariant[] = [];
  // (every params function forks its own stream off columnRng by name — none draws from it)
  const columnParamSets = [...Array.from({ length: COLUMN_VARIANTS }, (_, i) => columnParams(columnRng, i, COLUMN_VARIANTS)), emergentParams(columnRng), hutHostParams(columnRng)];
  // Finalize deterministic placements before creating terrain-dependent root geometry.
  for (const params of columnParamSets) {
    columns.push({ params, lods: [], meshes: [], placements: [], matrices: [], counts: [0, 0, 0], lists: [[], [], []], submitted: [[], [], []] });
  }
  const seatRng = columnRng.fork('seats');
  const columnSeatsSkipped: { x: number; z: number; reason: string }[] = [];
  const seatBlocked = (x: number, z: number, ring: number, t: Terrain = terrain, host = false): string | null => {
    const probes: [number, number][] = [[x, z]];
    for (let i = 0; i < 6; i++) probes.push([x + Math.cos((i / 6) * TAU) * ring, z + Math.sin((i / 6) * TAU) * ring]);
    for (const [px, pz] of probes) {
      const m = t.mask(px, pz);
      if (m.path > 0.3) return 'path';
      if (m.stairs > 0.3) return 'stairs';
      // a host seat stands in its own hut's structure mask (and the no-vegetation it implies)
      if (m.structure > 0.3 && !host) return 'structure';
    }
    if (!host && !t.vegetationAllowed(x, z)) return 'no-vegetation';
    if (t.slope(x, z) > 0.6) return 'slope';
    for (const h of ctx.layout.houses) if (Math.hypot(x - h.position[0], z - h.position[2]) < h.trunkRadius + COLUMN_CLEARANCE.house) return `house:${h.id}`;
    for (const g of giantDefsAll) if (Math.hypot(x - g.position[0], z - g.position[2]) < g.trunkRadius + COLUMN_CLEARANCE.giant) return `giant:${g.id}`;
    for (const p of whiteClearance) if (Math.hypot(x - p.x, z - p.z) < COLUMN_CLEARANCE.whiteBark) return 'white-bark';
    return null;
  };
  // the swapped white-barks first (their seats are already clear), then the authored seats; every
  // drawn swap takes its three draws, one the south exit dropped too (unbuilt), so none after it re-rolls
  for (const p of drawnSwaps) {
    const variant = seatRng.int(0, COLUMN_VARIANTS);
    const id = `swap-${whitePlaced.placements.indexOf(p)}`;
    const yaw = seatRng() * TAU;
    const scale = seatRng.range(0.95, 1.05);
    if (!swappedWhites.includes(p)) continue;
    seatFamily(columns, { id, x: p.x, y: p.y, z: p.z, yaw, scale, source: 'swap', view: p.view === 'live' ? 'live' : 'legacy', casts: true }, variant);
  }
  for (let i = 0; i < COLUMN_SEATS.length; i++) {
    const seat = COLUMN_SEATS[i];
    // one yaw and one scale draw per seat whether or not it is built, so a skipped seat never
    // re-rolls the ones after it
    const yaw = seatRng() * TAU;
    const scale = seatRng.range(0.95, 1.05);
    const view: TerrainView = seat.view ?? 'legacy';
    const seatTerrain = view === 'live' ? liveTerrain : terrain;
    const reason = seatBlocked(seat.x, seat.z, seat.ring ?? COLUMN_SEAT_RING, seatTerrain, seat.host === true);
    if (reason) {
      columnSeatsSkipped.push({ x: seat.x, z: seat.z, reason });
      continue;
    }
    seatFamily(columns, { id: `seat-${i}`, x: seat.x, y: seatTerrain.height(seat.x, seat.z), z: seat.z, yaw, scale, source: 'seat', view, casts: seat.host !== true }, seat.variant);
  }
  const columnPlacements = columns.flatMap((c) => c.placements);
  // A variant's flat roots cannot be shared between differently sloped seats. These ten
  // authored/swapped columns get one family per seat; the existing LOD/shadow rules stay intact.
  // Reusing the architecture seed preserves every bole/crown and all downstream random draws.
  const seatedColumns: ColumnVariant[] = [];
  for (const c of columns) for (let i = 0; i < c.placements.length; i++) {
    const p = c.placements[i];
    const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
    // the seat's own heightfield view (COLUMN_SEATS.view): its roots meet the ground it reads
    const seatTerrain = p.view === 'live' ? liveTerrain : terrain;
    const groundAt = (lx: number, lz: number) => (
      seatTerrain.height(p.x + p.scale * (cos * lx + sin * lz), p.z + p.scale * (-sin * lx + cos * lz)) - p.y
    ) / p.scale;
    const pathAt = (lx: number, lz: number) => seatTerrain.mask(p.x + p.scale * (cos * lx + sin * lz), p.z + p.scale * (-sin * lx + cos * lz)).path;
    // the sun in the seat's local frame (the yaw undone) for the near base's shaded-side moss
    const localSun = new Vector3(cos * sunDir.x - sin * sunDir.z, sunDir.y, sin * sunDir.x + cos * sunDir.z);
    // the emergent's knees (EMERGENT_KNEES): world azimuths into the seat's local frame like the sun
    const knees = c.params === columnParamSets[COLUMN_EMERGENT]
      ? EMERGENT_KNEES.map((k) => {
          const wx = Math.cos((k.azimuthDeg * Math.PI) / 180);
          const wz = Math.sin((k.azimuthDeg * Math.PI) / 180);
          return { ...k, toward: new Vector3(cos * wx - sin * wz, 0, sin * wx + cos * wz).normalize() };
        })
      : undefined;
    const lods = DETAILS.map((d) => createColumnTree(c.params, palette, d, { groundAt, nearBase: d === 'high', sunDir: localSun, pathAt, basePalette, knees, nearCanopy: {} }));
    seatedColumns.push({ params: c.params, lods, meshes: [], placements: [p], matrices: [c.matrices[i]], counts: [0, 0, 0], lists: [[], [], []], submitted: [[], [], []] });
    await yieldFrame();
  }
  const columnGroup = new Group();
  columnGroup.name = 'columns';
  // round 45: the columns' own bark floor (materials COLUMN_BARK_FLOOR) keeps their tone bands in shade
  familyMeshes(seatedColumns, 'column', mats.columnTree, mats.giantTreeDepth, columnGroup);
  for (const c of seatedColumns) for (const m of c.meshes) {
    const p = c.placements[0];
    m.name += `@${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    // the emergent's bole stands 5 m from camera D: its own bark floor (materials NEAR_BOLE_FLOOR)
    if (c.params === columnParamSets[COLUMN_EMERGENT]) m.material = mats.giantTreeNear;
    // the far hut's host never casts (ColumnPlacement.casts): the submission cull then tests its
    // frustum sphere alone, and its 1.28 m-per-m shadow footprint — which reaches camera C's
    // frame from a 13 m column (layout.ts farHutTrunk) — is never in a depth pass
    if (!p.casts) m.castShadow = false;
  }
  // the seated columns' near bases: one hidden mesh per seat, posed like its instance
  for (const c of seatedColumns) {
    const asset = c.lods[0];
    if (!asset.nearBase || !asset.nearBaseAudit) continue;
    const p = c.placements[0];
    const mesh = new Mesh(asset.nearBase, mats.giantTreeNearBase);
    mesh.name = `column-near-base-${p.id}`;
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.y = p.yaw;
    mesh.scale.setScalar(p.scale);
    mesh.customDepthMaterial = mats.giantTreeDepth;
    mesh.castShadow = ctx.quality.shadows && p.casts;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.userData.kind = 'column-near-base';
    columnGroup.add(mesh);
    const [item, first] = poolItem(`column-near-base/${p.id}`, mesh, asset.nearBaseBuild!, () => {});
    nearBasePool.add(item, first);
    nearBoles.push({ id: p.id, origin: new Vector3(p.x, p.y, p.z), cutY: asset.nearBaseAudit.cutY, mesh, triangles: asset.nearBaseAudit.triangles, active: false, dist: Infinity, band: nearBand(p.id), rootsOnly: asset.nearBaseAudit.rootsOnly, item });
  }
  // the seated columns' near-canopy parts (see NearCanopy): posed like their instance — in the
  // columns' batch, baked through the seat's matrix (NEAR_CANOPY_BATCHED), else one hidden
  // non-casting mesh per lobe; the far program folds the instance's tagged laminae by its world root
  if (columnNearCanopyBatch) columnGroup.add(columnNearCanopyBatch.mesh);
  for (const c of seatedColumns) {
    const p = c.placements[0];
    const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
    // the seat's matrix as the per-part mesh composed it (position, rotation.y, uniform scale)
    const seatMatrix = new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.yaw), new Vector3(p.scale, p.scale, p.scale));
    c.lods[0].nearCanopy.forEach((part, i) => {
      // the cull sphere three tests carries the wind pad (in the instance's scale); every rebuild gets the same
      const finalize = columnNearCanopyBatch
        ? (g: BufferGeometry) => {
            g.computeBoundingBox();
            g.computeBoundingSphere();
          }
        : (g: BufferGeometry) => {
            g.computeBoundingBox();
            g.computeBoundingSphere();
            g.boundingSphere!.radius += CULL_PAD_M / p.scale;
          };
      finalize(part.geometry);
      const nc: NearCanopy = {
        id: `${p.id}/${part.kind}-${i}`,
        tree: p.id,
        kind: part.kind,
        root: new Vector3(p.x, p.y, p.z),
        group: part.group,
        center: new Vector3(p.x + p.scale * (cos * part.center.x + sin * part.center.z), p.y + p.scale * part.center.y, p.z + p.scale * (-sin * part.center.x + cos * part.center.z)),
        radius: part.radius * p.scale,
        inM: part.inM,
        outM: part.outM,
        fixedSwap: part.fixedSwap === true,
        shown: false,
        batch: columnNearCanopyBatch,
        batchIds: null,
        vertices: 0,
        triangles: part.triangles,
        leaves: part.leaves,
        farLeaves: part.farLeaves,
        farCards: part.farCards,
        active: false,
        dist: Infinity,
        item: null as unknown as PoolItem<GeometryBuilt>,
      };
      let first: GeometryBuilt | null;
      if (columnNearCanopyBatch) {
        [nc.item, first] = batchPoolItem(`column-near-canopy/${p.id}/${part.kind}-${i}`, columnNearCanopyBatch, nc, part.geometry, part.build, finalize, true, 0, (g) => bakePartToWorld(g, seatMatrix, p.scale));
      } else {
        const mesh = new Mesh(part.geometry, mats.giantTreeNearCanopy);
        [nc.item, first] = poolItem(`column-near-canopy/${p.id}/${part.kind}-${i}`, mesh, part.build, finalize);
        mesh.name = `column-near-canopy-${p.id}-${part.kind}-${i}`;
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.y = p.yaw;
        mesh.scale.setScalar(p.scale);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.visible = false;
        mesh.userData.kind = 'column-near-canopy';
        columnGroup.add(mesh);
        nc.mesh = mesh;
      }
      nearCanopyPool.add(nc.item, first);
      nearCanopies.push(nc);
    });
  }
  group.add(columnGroup);
  // every seated column publishes its bole as built (ctx.shared.trunkSeats) so structures hang on
  // the trunk that is there instead of duplicating the seat constants: the sweep's own ring
  // centres and nominal radii taken through the instance matrix (yaw, scale, terrain contact), so
  // lean, wobble and root flare are all in; every LOD is grown from the same stream, so the high
  // one's rings are the family's. The giants append theirs below.
  const trunkSeats: TrunkSeat[] = [];
  for (const c of seatedColumns) {
    const p = c.placements[0];
    const asset = c.lods[0];
    const centres = asset.trunkPath.map((v) => v.clone().applyMatrix4(c.matrices[0]));
    const radii = asset.trunkRadii.map((r) => r * p.scale);
    trunkSeats.push(trunkSeatFromRings(p.id, new Vector3(p.x, p.y, p.z), p.yaw, p.scale, centres, radii, asset.bareHeight * p.scale));
  }
  ctx.shared.trunkSeats = trunkSeats;
  ctx.progress('trees', 0.55);
  await yieldFrame();

  // ------------------------------------------------------------------ giants
  const giantGroup = new Group();
  giantGroup.name = 'giants';
  if (nearCanopyBatch) giantGroup.add(nearCanopyBatch.mesh);
  const giants: { def: GiantTreeDef; asset: GiantAsset; origin: Vector3; angle: number; heroDistance: number }[] = [];
  const contacts: [number, number, number][] = [];
  /** the contacts of the giants seated on the live ground (`southSeat` below), for the base-gap audit */
  const liveContacts = new Set<[number, number, number]>();
  /**
   * The detached boughs (DETACHED_BOUGHS, giant.ts GiantOptions.detachedBoughs): their meshes,
   * gated as one by `detachedVisible` (util/expansionLocality.ts expansionVisible against
   * `detachedCasters`' spheres — the wood's frustum stacks and the curtains' shadow sweeps), so a
   * camera that can see neither the bough nor its shade — every one of the six fixed frames —
   * draws none of it, not even in the depth pass. Hidden until the first rebucket.
   */
  const detachedGroup = new Group();
  detachedGroup.name = 'giant-detached-boughs';
  detachedGroup.visible = false;
  const detachedMeshes: Mesh[] = [];
  const detachedCasters: Caster[] = [];
  const detachedGeometries: BufferGeometry[] = [];
  const detachedAudit: { giant: string; boughs: number; woodTriangles: number; leaves: number; leafTriangles: number; cards: number; lobes: { center: number[]; hR: number; vR: number; leaves: number }[]; dress: GiantAsset['boughDress'] }[] = [];
  const giantDefs = giantDefsAll;
  /** what was published as ctx.shared.lanternLimb (audit) */
  let lanternLimbAudit: { samples: number; range: [number, number]; side: [number, number]; vertical: [number, number]; ends: [number[], number[]]; rings: number[][] } | undefined;
  /** a giant's near part to world space (translated, aRoot.xyz = the origin), as the sectors are */
  const giantPartToWorld = (g: BufferGeometry, origin: Vector3) => {
    g.translate(origin.x, origin.y, origin.z);
    rootsToWorld(g.getAttribute('aRoot') as BufferAttribute, origin.x, origin.y, origin.z);
  };
  /**
   * A giant's near parts, right after its build (so the pools can prune the far ones before the
   * next giant's are built): its near base — one hidden mesh (world-space geometry, like the
   * sectors) — and its near-canopy parts (see NearCanopy) — one non-casting mesh each, hidden
   * until the camera comes within NEAR_CANOPY_IN_M of the lobe; the sphere three culls it by
   * carries the wind pad.
   */
  const attachGiantNearParts = (g: { def: GiantTreeDef; asset: GiantAsset; origin: Vector3 }) => {
    const nb = g.asset.nearBase;
    const audit = g.asset.nearBaseAudit;
    if (nb && audit) {
      const finalize = (geometry: BufferGeometry) => {
        giantPartToWorld(geometry, g.origin);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      };
      finalize(nb);
      const mesh = new Mesh(nb, mats.giantTreeNearBase);
      mesh.name = `giant-near-base-${g.def.id}`;
      mesh.customDepthMaterial = mats.giantTreeDepth;
      mesh.castShadow = ctx.quality.shadows;
      mesh.receiveShadow = true;
      mesh.visible = false;
      mesh.userData.kind = 'giant-near-base';
      mesh.userData.giants = [g.def.id];
      giantGroup.add(mesh);
      const [item, first] = poolItem(`giant-near-base/${g.def.id}`, mesh, g.asset.nearBaseBuild!, finalize);
      nearBasePool.add(item, first);
      nearBoles.push({ id: g.def.id, origin: g.origin.clone(), cutY: audit.cutY, mesh, triangles: audit.triangles, active: false, dist: Infinity, band: nearBand(g.def.id), item });
    }
    g.asset.nearCanopy.forEach((part, i) => {
      const finalize = (geometry: BufferGeometry) => {
        if (!geometry.getAttribute('position')?.count) {
          // A deferred part carries conservative local bounds, not vertex buffers to transform.
          geometry.boundingBox!.translate(g.origin);
          geometry.boundingSphere!.center.add(g.origin);
          geometry.boundingSphere!.radius += CULL_PAD_M;
          return;
        }
        giantPartToWorld(geometry, g.origin);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        if (part.envelope) {
          geometry.boundingBox!.copy(part.envelope).translate(g.origin);
          geometry.boundingBox!.getBoundingSphere(geometry.boundingSphere!);
        }
        geometry.boundingSphere!.radius += CULL_PAD_M;
      };
      finalize(part.geometry);
      // the record first: a batched part's pool item writes its batch ids and vertex count into it
      const nc: NearCanopy = {
        id: `${g.def.id}/${part.kind}-${i}`,
        tree: g.def.id,
        kind: part.kind,
        root: g.origin.clone(),
        group: part.group,
        center: part.center.clone().add(g.origin),
        radius: part.radius,
        inM: part.inM,
        outM: part.outM,
        fixedSwap: part.fixedSwap === true,
        ...(part.persistent ? { persistent: true } : {}),
        shown: false,
        batch: nearCanopyBatch,
        batchIds: null,
        vertices: 0,
        get triangles() { return part.triangles; },
        get leaves() { return part.leaves; },
        farLeaves: part.farLeaves,
        farCards: part.farCards,
        active: false,
        dist: Infinity,
        item: null as unknown as PoolItem<GeometryBuilt>,
      };
      let first: GeometryBuilt | null;
      if (nearCanopyBatch) {
        [nc.item, first] = batchPoolItem(`giant-near-canopy/${g.def.id}/${part.kind}-${i}`, nearCanopyBatch, nc, part.geometry, part.build, finalize, !part.deferred, part.estimatedBytes);
      } else {
        const mesh = new Mesh(part.geometry, mats.giantTreeNearCanopy);
        mesh.name = `giant-near-canopy-${g.def.id}-${part.kind}-${i}`;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.visible = false;
        mesh.userData.kind = 'giant-near-canopy';
        mesh.userData.giants = [g.def.id];
        giantGroup.add(mesh);
        nc.mesh = mesh;
        [nc.item, first] = poolItem(`giant-near-canopy/${g.def.id}/${part.kind}-${i}`, mesh, part.build, finalize, !part.deferred, part.estimatedBytes);
      }
      nearCanopyPool.add(nc.item, first);
      nearCanopies.push(nc);
    });
  };
  /**
   * Prune the pools to what is near the camera now (load time: after every giant, so the first
   * builds of the far parts never pile up — the peak stays at the caps plus one giant's parts).
   */
  const pruneNearPools = () => {
    ctx.camera.getWorldPosition(_v);
    nearCanopyPool.begin();
    for (const nc of nearCanopies) {
      const d = Math.max(0, nc.center.distanceTo(_v) - nc.radius);
      if (nc.persistent && nearCanopyPool.isResident(nc.item)) nearCanopyPool.pin(nc.item);
      else if (nc.persistent || d < NEAR_CANOPY_PREFETCH_M) nearCanopyPool.want(nc.item, nc.persistent ? -1 : d);
    }
    nearCanopyPool.work(0);
    nearBasePool.begin();
    for (const nb of nearBoles) {
      if (!nb.item) continue;
      const d = Math.hypot(nb.origin.x - _v.x, nb.origin.z - _v.z);
      if (d < NEAR_BASE_PREFETCH_M) nearBasePool.want(nb.item, d);
    }
    nearBasePool.work(0);
  };
  for (const def of giantDefs) {
    const [px, , pz] = def.position;
    // round 56: a giant standing in the south exit's boxes (`plaza-south`, `south-centre`) seats its
    // roots and fins on the LIVE ground and paving — the path runs through its roots at its own
    // smoothed grade, up to 0.3 m off the legacy plain; both views agree at the boles' feet
    const southSeat = pz > 10 && inExpansionSouth(px, pz);
    const giantTerrain = southSeat ? liveTerrain : terrain;
    const gy = giantTerrain.height(px, pz);
    const origin = new Vector3(px, gy, pz);
    let limbSpec: NonNullable<Parameters<typeof createGiantTree>[2]['limbSpec']> | undefined;
    if (def.limb && def.id === 'lantern-tree') {
      const lb = ctx.layout.lanternBranch as typeof ctx.layout.lanternBranch & { radius?: number; tipRadius?: number };
      limbSpec = {
        from: new Vector3(lb.from[0], lb.from[1], lb.from[2]).sub(origin),
        to: new Vector3(lb.to[0], lb.to[1], lb.to[2]).sub(origin),
        radius: lb.radius,
        tipRadius: lb.tipRadius,
        // round 37: the limb leaves the bole at layout `limb.height` (local) and droops onto
        // `from` (see LANTERN_LIMB below)
        attachHeight: def.limb.height,
        sag: LANTERN_LIMB.sag,
        tail: LANTERN_LIMB.tail,
        ghost: LANTERN_LIMB.ghost,
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
    const boughs = HOUSE_BOUGHS.filter((b) => b.giant === def.id).map((b: (typeof HOUSE_BOUGHS)[number] & { density?: number; ghostWood?: boolean }) => ({
      to: new Vector3(b.to[0], b.to[1], b.to[2]).sub(origin),
      fromHeight: b.fromHeight,
      radius: b.radius,
      foliage: b.foliage,
      density: b.density,
      ghostWood: b.ghostWood,
    }));
    // giants 35–45 m out are seen through the haze at 30+ m: fewer laminae, the cluster cards
    // carry their crowns
    const plazaDist = Math.hypot(px, pz);
    const farFade = 1 - 0.45 * Math.min(1, Math.max(0, (plazaDist - 26) / 16));
    const toLocalBough = (b: (typeof CANOPY_BOUGHS)[number]): CanopyBough => ({
      to: new Vector3(b.to[0], b.to[1], b.to[2]).sub(origin),
      fromHeight: b.fromY - gy,
      radius: b.radius,
      tipRadius: b.tipRadius,
      ghostWood: b.ghostWood,
      dress: b.dress,
      lobes: b.lobes.map((l) => ({ t: l.t, center: new Vector3(l.center[0], l.center[1], l.center[2]).sub(origin), hR: l.hR, vR: l.vR, density: l.density, tone: l.tone, eye: l.eye, shade: l.shade, corridors: l.corridors, compact: l.compact, castShadow: l.castShadow, flat: l.flat, core: l.core, floor: l.floor === undefined ? undefined : l.floor - gy, layeredCore: l.layeredCore })),
    });
    const canopyBoughs: CanopyBough[] = CANOPY_BOUGHS.filter((b) => b.giant === def.id).map(toLocalBough);
    const detachedSpecs = DETACHED_BOUGHS.filter((b) => b.giant === def.id);
    const detachedBoughs: CanopyBough[] = detachedSpecs.map(toLocalBough);
    // the nearest hero camera that holds this giant in its forward cone (the frames' horizontal half
    // angle is 37–38°, so 0.5 · |f| · d is 60°: in shot or just past its edge). It gates the near-bole
    // bark below, and the audit reports it beside each giant's wood so a rung proposal can see which
    // of the heavy trees a fixed frame actually looks at.
    const heroDistance = Math.min(
      ...ctx.layout.viewpoints.map((v) => {
        const fx = v.target[0] - v.position[0];
        const fz = v.target[2] - v.position[2];
        const dx = px - v.position[0];
        const dz = pz - v.position[2];
        const d = Math.hypot(dx, dz);
        return fx * dx + fz * dz >= 0.5 * Math.hypot(fx, fz) * d ? d : Infinity;
      }),
    );
    const asset = createGiantTree(def, rng, {
      groundAt: (lx, lz) => giantTerrain.height(px + lx, pz + lz) - gy,
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
        hard: c.hard,
      })),
      densify: openingCollars.map((c) => ({
        point: c.point.clone().sub(origin),
        dir: c.dir,
        inner: c.inner,
        outer: c.outer,
        factor: c.factor,
        yMin: c.yMin - gy,
        yMax: c.yMax - gy,
      })),
      eyeDetail: EYE_DETAIL[def.id] ?? 0,
      limbFoliage: def.id === 'lantern-tree' ? LANTERN_LIMB_FOLIAGE : 1,
      profile: GIANT_PROFILES[def.id],
      canopyBoughs,
      detachedBoughs: detachedBoughs.length ? detachedBoughs : undefined,
      sunDir,
      pathAt: (lx, lz) => giantTerrain.mask(px + lx, pz + lz).path,
      rootPressAt: southSeat ? (lx, lz) => southRootPress(px + lx, pz + lz) : undefined,
      basePalette,
      // the near-bole bark (bole.ts) goes on the giants within NEAR_BOLE_M of a hero camera and
      // within 60° of its axis (the frames' horizontal half-angle is 37–38°: in shot or just past
      // its edge). The south giants stand 13–23 m from cameras A and F but 65–120° off their axes,
      // and are only ever seen as hazed columns 28–35 m into shot C, where the relief measured
      // −0.013 SSIM. GIANT_PROFILES.relief overrides this (the lantern tree).
      heroDistance,
      nearCanopy: { defer: true },
    });
    // to world space; aRoot.xyz carries the tree origin so the merged shader keeps per-tree context
    // (the near base and the near-canopy parts get the same below, where their pooled rebuilds do)
    for (const g of [asset.geometry, asset.authoredLeaves, asset.cards, asset.authoredCards]) {
      g.translate(px, gy, pz);
      rootsToWorld(g.getAttribute('aRoot') as BufferAttribute, px, gy, pz);
    }
    // the detached boughs (DETACHED_BOUGHS): three meshes of their own in `detachedGroup`, shown
    // by the gate below — wood (never casts: its footprint is what comes nearest camera C),
    // laminae and cards (cast: the curtains' shade on the bank is the point of them)
    if (asset.detached) {
      const d = asset.detached;
      for (const g of [d.wood, d.leaves, d.cards]) {
        g.translate(px, gy, pz);
        rootsToWorld(g.getAttribute('aRoot') as BufferAttribute, px, gy, pz);
      }
      const make = (g: BufferGeometry, name: string, material: Material, depth: Material, casts: boolean, kind: string) => {
        const geometry = mergeParts(name, [g]);
        detachedGeometries.push(geometry);
        const mesh = new Mesh(geometry, material);
        mesh.name = name;
        mesh.customDepthMaterial = depth;
        mesh.castShadow = casts && ctx.quality.shadows;
        mesh.receiveShadow = true;
        mesh.userData.kind = kind;
        mesh.userData.giants = [def.id];
        detachedGroup.add(mesh);
        detachedMeshes.push(mesh);
        return mesh;
      };
      if (d.wood.getAttribute('position').count > 0) make(d.wood, `giant-detached-wood-${def.id}`, mats.giantTree, mats.giantTreeDepth, false, 'giant-detached-wood');
      if (d.leaves.getAttribute('position').count > 0) make(d.leaves, `giant-detached-leaves-${def.id}`, mats.giantTree, mats.giantTreeDepth, true, 'giant-detached-leaves');
      if (d.cards.getAttribute('position').count > 0) make(d.cards, `giant-detached-cards-${def.id}`, mats.giantCanopy, mats.giantCanopyDepth, true, 'giant-detached-cards');
      // the gate's casters from the authored spec (world): the wood as frustum-only stacks along
      // its droop (the same curve giant.ts sweeps), each curtain swept along the sun to the live
      // ground under it (the bank's body is live-only ground)
      for (const b of detachedSpecs) {
        const run = Math.hypot(b.to[0] - px, b.to[2] - pz);
        for (let k = 0; k <= 8; k++) {
          const s = k / 8;
          const x = px + (b.to[0] - px) * s;
          const z = pz + (b.to[2] - pz) * s;
          const y = b.fromY + (b.to[1] - b.fromY) * Math.pow(s, 1.7) + 0.02 * run * Math.sin(s * Math.PI);
          const r = b.radius + 0.5;
          detachedCasters.push({ x, z, r, y0: y - r - 0.5, y1: y + r + 0.5, shadow: false });
        }
        for (const l of b.lobes) detachedCasters.push({ x: l.center[0], z: l.center[2], r: l.hR + 0.6, y0: liveTerrain.height(l.center[0], l.center[2]), y1: l.center[1] + l.vR + 0.5, shadow: true });
      }
      detachedAudit.push({
        giant: def.id,
        boughs: detachedSpecs.length,
        woodTriangles: d.woodTriangles,
        leaves: d.leafCount,
        leafTriangles: d.leafTriangles,
        cards: d.cardCount,
        lobes: d.lobes.map((l) => ({ center: [Math.round((l.center.x + px) * 100) / 100, Math.round((l.center.y + gy) * 100) / 100, Math.round((l.center.z + pz) * 100) / 100], hR: l.hR, vR: l.vR, leaves: l.leaves })),
        dress: d.dress,
      });
    }
    // the lantern tree publishes its built limb — the sweep's own ring centres and nominal radii,
    // wiggle included, in world space (the tree is only translated) — so structures can wrap the
    // axis the bark actually follows instead of the whole wiggle box; s = 0 at LAYOUT from, 1 at to
    if (def.id === 'lantern-tree' && asset.limbPath && asset.limbS && asset.limbRadii) {
      const centres = asset.limbPath.map((p) => p.clone().add(origin));
      const ringS = asset.limbS;
      const ringRadii = asset.limbRadii;
      const tube = tubePathFromRings(centres, ringS, ringRadii);
      ctx.shared.lanternLimb = tube;
      // realised offsets of the from → to rings against the straight authored axis (m)
      const lb = ctx.layout.lanternBranch;
      const from = new Vector3(lb.from[0], lb.from[1], lb.from[2]);
      const axis = new Vector3(lb.to[0], lb.to[1], lb.to[2]).sub(from);
      const sideUnit = new Vector3(-axis.z, 0, axis.x).normalize();
      const side: [number, number] = [Infinity, -Infinity];
      const vertical: [number, number] = [Infinity, -Infinity];
      ringS.forEach((s, i) => {
        if (s < 0 || s > 1) return;
        const off = centres[i].clone().sub(from).addScaledVector(axis, -s);
        const sd = off.dot(sideUnit);
        side[0] = Math.min(side[0], sd);
        side[1] = Math.max(side[1], sd);
        vertical[0] = Math.min(vertical[0], off.y);
        vertical[1] = Math.max(vertical[1], off.y);
      });
      const mm = (v: Vector3) => v.toArray().map((c) => Math.round(c * 1e3) / 1e3);
      const rings = centres.map((c, i) => [Math.round(ringS[i] * 1e4) / 1e4, ...mm(c), Math.round(ringRadii[i] * 1e3) / 1e3]);
      lanternLimbAudit = { samples: centres.length, range: [tube.range[0], tube.range[1]], side, vertical, ends: [mm(tube.centre(0)), mm(tube.centre(1))], rings };
    }
    // the giant's bole joins the seats under its layout id (giants are only translated: yaw 0, scale 1)
    trunkSeats.push(trunkSeatFromRings(def.id, origin, 0, 1, asset.trunkPath.map((p) => p.clone().add(origin)), asset.trunkRadii, asset.bareHeight));
    giants.push({ def, asset, origin, angle: Math.atan2(pz, px), heroDistance });
    attachGiantNearParts(giants[giants.length - 1]);
    pruneNearPools();
    for (const c of asset.contacts) {
      const at: [number, number, number] = [px + c.x, gy + c.y, pz + c.z];
      contacts.push(at);
      if (southSeat) liveContacts.add(at);
    }
    ctx.progress('trees', 0.55 + (0.3 * giants.length) / giantDefs.length);
    await yieldFrame();
  }
  /**
   * Per-group colour-pass culling for a merged world-space mesh: `groupBoxes[i]` bounds group i
   * (materialIndex i). `cull()` marks each box against the camera frustum (GROUP_PAD_M for wind);
   * the colour pass draws a marked-out group with count 0 (onBeforeRender / onAfterRender run per
   * group), the shadow pass — rendered first, hook-free — draws them all.
   */
  const GROUP_PAD_M = 1.5;
  /** height bands a giant's leaves split into for the colour-pass cull (draws: 1 wood + bands per giant) */
  const GIANT_LEAF_BANDS = 2;
  const installGroupCulling = (mesh: Mesh, bounds: { boxes: Box3[]; spheres: Sphere[] }) => {
    mesh.userData.groupBoxes = bounds.boxes.map((b) => b.clone().expandByScalar(GROUP_PAD_M));
    mesh.userData.groupSpheres = bounds.spheres.map((sp) => {
      const out = sp.clone();
      out.radius += GROUP_PAD_M;
      return out;
    });
    mesh.userData.groupInView = bounds.boxes.map(() => true);
    // three types the hook's last argument as an Object3D Group; at runtime it is the geometry
    // group record ({ start, count, materialIndex }) of the draw being issued
    type GeometryGroup = { start: number; count: number; materialIndex: number };
    const saved: (number | undefined)[] = [];
    mesh.onBeforeRender = (_r, _s, _c, _g, _m, group) => {
      const g = group as unknown as GeometryGroup | null;
      if (!g) return;
      const inView = mesh.userData.groupInView as boolean[];
      if (inView[g.materialIndex] === false) {
        saved[g.materialIndex] = g.count;
        g.count = 0;
      }
    };
    mesh.onAfterRender = (_r, _s, _c, _g, _m, group) => {
      const g = group as unknown as GeometryGroup | null;
      if (!g) return;
      const count = saved[g.materialIndex];
      if (count === undefined) return;
      g.count = count;
      saved[g.materialIndex] = undefined;
    };
  };
  /**
   * Split every merged group (one per giant, `mergeParts(…, true)`) at its first leaf triangle
   * (`aRoot.w > 0.5`; a giant's geometry is wood then leaves), re-register the groups and return
   * one bounding box per final group — the colour-pass test above works on these. Arrays are still
   * on the CPU here (released after the first upload).
   */
  const splitGroupsAtLeaves = (geometry: BufferGeometry, leafChunks = 1): { boxes: Box3[]; spheres: Sphere[] } => {
    const index = geometry.index;
    const pos = geometry.attributes.position;
    const root = geometry.attributes.aRoot;
    const boxes: Box3[] = [];
    const spheres: Sphere[] = [];
    const ranges: [number, number][] = [];
    const v = new Vector3();
    const vertexIndex = (t: number) => (index ? index.getX(t) : t);
    const boundsOf = (a: number, b: number) => {
      const box = new Box3();
      for (let t = a; t < b; t++) box.expandByPoint(v.fromBufferAttribute(pos, vertexIndex(t)));
      const sphere = new Sphere();
      box.getCenter(sphere.center);
      for (let t = a; t < b; t++) sphere.radius = Math.max(sphere.radius, v.fromBufferAttribute(pos, vertexIndex(t)).distanceTo(sphere.center));
      ranges.push([a, b]);
      boxes.push(box);
      spheres.push(sphere);
    };
    for (const g of geometry.groups) {
      const end = g.start + g.count;
      let split = end;
      if (root && root.itemSize >= 4) {
        for (let t = g.start; t < end; t += 3) {
          if (root.getW(vertexIndex(t)) > 0.5) {
            split = t;
            break;
          }
        }
      }
      if (split > g.start) boundsOf(g.start, split);
      if (split >= end) continue;
      if (leafChunks <= 1 || !index) {
        boundsOf(split, end);
        continue;
      }
      // the leaves in height bands of equal triangle count: sort the range's triangles by centroid y
      // and rewrite that slice of the index in band order (a giant's crown mass sits high; the upper
      // bands of a giant behind the camera clear the frustum's top plane while its lower limbs do not)
      const triCount = (end - split) / 3;
      const order = new Array<number>(triCount);
      const heights = new Float32Array(triCount);
      for (let k = 0; k < triCount; k++) {
        const t = split + k * 3;
        heights[k] = (pos.getY(index.getX(t)) + pos.getY(index.getX(t + 1)) + pos.getY(index.getX(t + 2))) / 3;
        order[k] = k;
      }
      order.sort((a, b) => heights[a] - heights[b]);
      const sorted = new Uint32Array((end - split));
      for (let k = 0; k < triCount; k++) {
        const t = split + order[k] * 3;
        sorted[k * 3] = index.getX(t);
        sorted[k * 3 + 1] = index.getX(t + 1);
        sorted[k * 3 + 2] = index.getX(t + 2);
      }
      for (let k = 0; k < sorted.length; k++) index.setX(split + k, sorted[k]);
      index.needsUpdate = true;
      for (let c = 0; c < leafChunks; c++) {
        const a = split + Math.floor((triCount * c) / leafChunks) * 3;
        const b = split + Math.floor((triCount * (c + 1)) / leafChunks) * 3;
        if (b > a) boundsOf(a, b);
      }
    }
    geometry.clearGroups();
    ranges.forEach(([a, b], i) => geometry.addGroup(a, b - a, i));
    return { boxes, spheres };
  };
  const groupMeshes: Mesh[] = [];
  // three angular sectors around the plaza → three meshes, each frustum-culled as a unit
  const byAngle = [...giants].sort((a, b) => a.angle - b.angle);
  const sectorGeometries: BufferGeometry[] = [];
  const sectorMeshes: Mesh[] = [];
  const perSector = Math.ceil(byAngle.length / GIANT_SECTORS);
  for (let s = 0; s < GIANT_SECTORS; s++) {
    const members = byAngle.slice(s * perSector, (s + 1) * perSector);
    if (!members.length) continue;
    const label = members.map((m) => m.def.id).join('+');
    // Round 52 (W38): one geometry group per giant, so the colour pass can skip a member whose own
    // box is outside the frustum while the sector's other members draw (a sector spans ~50 × 30 ×
    // 55 m and always meets the frustum; at A the south sector's four giants all stand behind the
    // camera and drew 488 K triangles for no pixel). The shadow pass still draws every group —
    // three renders the shadow maps before the scene and never calls onBeforeRender from them.
    const geometry = mergeParts(
      `giants-sector-${s}`,
      members.map((m) => m.asset.geometry),
      true,
    );
    const cardGeometry = mergeParts(
      `giants-canopy-${s}`,
      members.map((m) => m.asset.cards),
    );
    sectorGeometries.push(geometry, cardGeometry);
    // a giant's box holds the camera whenever it stands within its limbs' reach (A: the south
    // sector's boles are 12–19 m behind the stairs and reach 13 m), so each giant splits into its
    // wood and its crown: the crown, 12–26 m up, is what a behind-the-camera giant mostly is, and
    // its box clears the frustum's top plane
    const woodBounds = splitGroupsAtLeaves(geometry, GIANT_LEAF_BANDS);
    const mesh = new Mesh(geometry, woodBounds.boxes.map(() => mats.giantTree));
    mesh.name = `giants-sector-${s}-${label}`;
    mesh.customDepthMaterial = mats.giantTreeDepth;
    mesh.castShadow = ctx.quality.shadows;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'giant';
    mesh.userData.giants = members.map((m) => m.def.id);
    installGroupCulling(mesh, woodBounds);
    groupMeshes.push(mesh);
    const canopy = new Mesh(cardGeometry, mats.giantCanopy);
    canopy.name = `giants-canopy-${s}-${label}`;
    canopy.customDepthMaterial = mats.giantCanopyDepth;
    canopy.castShadow = ctx.quality.shadows;
    canopy.receiveShadow = true;
    canopy.userData.kind = 'giant-canopy-cards';
    giantGroup.add(mesh, canopy);
    sectorMeshes.push(mesh, canopy);
  }
  // The laminae of the authored lobes marked `castShadow: false` (round 31: the plateau-oak's
  // shot-D curtains, clump and plugs, the lantern tree's clump — 51 k eye-detail laminae, 0.42 M
  // triangles) in one mesh of their own that never casts (submitGiants skips it). Merged into a
  // sector they were submitted to the sun's depth pass from every camera (a sector's sphere always
  // meets the shadow frustum), so each view paid for them twice; here they are drawn only where
  // their own sphere meets the view — A, B, D and E; behind C, off F's left. Their shadows fell on
  // the terrace in front of Saria's house ((x + 1.008 (Y − y), z + 0.787 (Y − y)) from 3–5.5 m up:
  // A (0.55–0.57, 0.48), B (0.75–0.80, 0.56), off D's right) and, the lantern clump's, on the D
  // path at (2.2, −9.1). The older shade lobes (north-west-near and the others) keep casting: they
  // exist for their shadows on the plaza and path sun pools.
  // Round 38: one such mesh PER GIANT (was one for all). The round-38 lobes hang on giants whose
  // curtains no other view sees — the stair-bank giant's bank canopy is F's and C's, the
  // north-west-near's path clumps are D's (with A / B) — and one merged mesh's sphere would have
  // met every hero frustum, so each view would have drawn every giant's curtains (F and C the
  // plateau-oak's 0.29 M triangles of shot-D curtains, A / B / D the bank's). Per giant, a view
  // draws the curtains whose own sphere meets it: +1 call per giant that has any.
  const authoredParts = giants.filter((g) => g.asset.authoredLeaves.getAttribute('position').count > 0);
  for (const g of giants) if (!authoredParts.includes(g)) g.asset.authoredLeaves.dispose();
  for (const g of authoredParts) {
    const geometry = mergeParts(`giants-authored-leaves-${g.def.id}`, [g.asset.authoredLeaves]);
    sectorGeometries.push(geometry);
    const mesh = new Mesh(geometry, mats.giantTree);
    mesh.name = `giants-authored-leaves-${g.def.id}`;
    mesh.customDepthMaterial = mats.giantTreeDepth;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'giant-authored-leaves';
    mesh.userData.giants = [g.def.id];
    giantGroup.add(mesh);
    sectorMeshes.push(mesh);
  }
  // The cards of the flat lobes (CanopyLobe.flat — round 38's bank canopy over F / C), likewise
  // one non-casting mesh per giant that has any: a flat lobe is a canopy underside in the shade
  // of the crown above it, and its full-size card sheet 3–4 m over the bank would otherwise lay
  // a band of its own across the bank and the stairs' east side.
  const flatParts = giants.filter((g) => g.asset.authoredCards.getAttribute('position').count > 0);
  for (const g of giants) if (!flatParts.includes(g)) g.asset.authoredCards.dispose();
  for (const g of flatParts) {
    const geometry = mergeParts(`giants-authored-cards-${g.def.id}`, [g.asset.authoredCards]);
    sectorGeometries.push(geometry);
    const mesh = new Mesh(geometry, mats.giantCanopy);
    mesh.name = `giants-authored-cards-${g.def.id}`;
    mesh.customDepthMaterial = mats.giantCanopyDepth;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'giant-authored-cards';
    mesh.userData.giants = [g.def.id];
    giantGroup.add(mesh);
    sectorMeshes.push(mesh);
  }
  // the root-kit test (rootkit.ts; `VITE_ROOT_KIT=1` builds only): Astra's kit on the two boles
  // in ROOT_KIT_BOLES in place of their near bases, the plain roots folded, the trunk kept
  const rootKitAudit: { source: { triangles: number; vertices: number; textures: { slot: string; size: string }[]; bytes: number } | null; fits: RootKitFit['audit'][] } = { source: null, fits: [] };
  if (ROOT_KIT) {
    const { loadRootKit, fitRootKit, ROOT_KIT_URL } = await import('./rootkit');
    const url = `${import.meta.env.BASE_URL}${ROOT_KIT_URL}`;
    const src = await loadRootKit(url);
    let bytes = 0;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      bytes = Number(head.headers.get('content-length') ?? 0);
    } catch {
      bytes = 0;
    }
    rootKitAudit.source = { triangles: src.triangles, vertices: src.vertices, textures: src.textures, bytes };
    for (const g of giants) {
      if (!ROOT_KIT_BOLES.includes(g.def.id)) continue;
      const nb = nearBoles.find((n) => n.id === g.def.id);
      if (!nb) continue;
      const path = g.asset.trunkPath;
      const radii = g.asset.trunkRadii;
      const at = (h: number) => {
        let k = 0;
        while (k < path.length - 2 && path[k + 1].y < h) k++;
        const span = path[k + 1].y - path[k].y;
        const t = span > 1e-6 ? Math.min(1, Math.max(0, (h - path[k].y) / span)) : 0;
        return { k, t };
      };
      const fit = fitRootKit(src, {
        id: g.def.id,
        R: g.def.trunkRadius,
        origin: g.origin.clone(),
        radiusAt: (h) => {
          const { k, t } = at(h);
          return radii[k] + (radii[k + 1] - radii[k]) * t;
        },
        axisAt: (h, out) => {
          const { k, t } = at(h);
          return out.copy(path[k]).lerp(path[k + 1], t);
        },
        groundAt: (x, z) => terrain.height(x, z),
        boleRings: g.asset.boleRings,
      });
      giantGroup.remove(nb.mesh);
      nb.mesh.visible = false;
      if (nb.item) {
        nearBasePool.remove(nb.item);
        nb.item = undefined;
      }
      nb.mesh = fit.mesh;
      nb.kit = true;
      nb.triangles = src.triangles;
      giantGroup.add(fit.mesh);
      rootKitAudit.fits.push(fit.audit);
    }
  }
  group.add(giantGroup);
  group.add(detachedGroup);

  // ------------------------------------------------------------------ distant trees
  const distantGroup = new Group();
  distantGroup.name = 'distant';
  // the 60–220 m layer, then the mid-canopy layer appended (distant.ts createMidVariants: the
  // 14–58 m band the owner's 06:50 screenshot circles as empty grey haze). Their streams are forked
  // by name off `rng`, so every distant / white-bark / giant / column draw is where it was.
  const distantVariants = [...createDistantVariants(rng, palette), ...createMidVariants(rng, palette)];
  const distantTarget = Math.round(680 * Math.max(0.7, Math.min(1.2, ctx.quality.density)));
  // Round 45 (structures-28's ray pick at w21-spine-f): the first depth row ran through the log
  // arch's north mouth — its instance at (0.73, −59.8) was a hex-prism trunk 5 m off the spine,
  // INSIDE the log's west root mass, dead on the path's north sight line — and the radial pool
  // put a 10 m slender pole 4.7 m off the sight line 14 m past the arch. No distant tree may
  // stand within DISTANT_SPINE_CLEARANCE of the path spine, extended DISTANT_SPINE_EXTEND_M north
  // past its last point (the sight line out of the arch), nor inside the log's body + root mass;
  // one that is drawn there slides out along the perpendicular (distant.ts DistantClearance:
  // after every draw, so every other tree is where it was).
  const spineXZ: [number, number][] = ctx.layout.pathSpine.map((p) => [p[0], p[2]]);
  {
    const a = spineXZ[spineXZ.length - 2];
    const b = spineXZ[spineXZ.length - 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    spineXZ.push([b[0] + ((b[0] - a[0]) / l) * DISTANT_SPINE_EXTEND_M, b[1] + ((b[1] - a[1]) / l) * DISTANT_SPINE_EXTEND_M]);
  }
  const arch = ctx.layout.logArch;
  const archYaw = (arch.yawDeg * Math.PI) / 180;
  const distantClearance: DistantClearance = {
    spine: spineXZ,
    spineClearance: DISTANT_SPINE_CLEARANCE,
    // the log's long axis as logArch.ts builds it (east, slightly north); body plus the root masses
    footprints: [{ x: arch.position[0], z: arch.position[2], ax: Math.cos(archYaw), az: -Math.sin(archYaw), halfLength: arch.length / 2 + 2, halfWidth: arch.radius + 1 }],
  };
  const distantPlacements = placeDistantTrees(rng, terrain, distantVariants, distantTarget, 60, 215, DEPTH_BANDS, distantClearance);
  const distantCleared = distantClearanceTally();

  // ------------------------------------------------------------------ mid-canopy grove (14–58 m)
  /**
   * The owner, 2026-09-23 06:50 (marked screenshot on the north path): "the trees do not populate" —
   * his red circle 2 is the empty grey middle distance over the path, where his own recording
   * (`reference/frames-dense/review46/r_020`–`r_028`) stacks small and medium trees with round leafy
   * crowns at every depth. Everything we had in that band was a BOLE: the giants, the pale
   * white-barks, the authored column trunks (bare to 10 m by design) and, at 42 m, the far-trunk
   * poles whose crowns start 18 m up. The distant layer's inner radius is 60 m — that is where
   * crowns began.
   *
   * The grove fills 14–58 m with understory and sub-canopy trees (distant.ts MID_HEIGHTS 7.6–15.4 m,
   * crowns centred at half their height, so a walker meets leaves and not a pole). It is a new
   * stream that READS the other systems' positions and adds nothing to theirs, so no existing
   * instance moves:
   *   • the ground rule is the white-barks' own (placement.ts treeGroundBlocked): the paved surfaces
   *     and their verge, the four path polylines, every authored landmark, slope ≤ 0.55;
   *   • `occupied` keeps a mid bole out of every giant, house trunk, white-bark, column seat and
   *     distant bole that already stands there;
   *   • the plaza's sun corridors stay open — crowns only, a thin bole shadow is welcome dapple;
   *   • the expansion's ground is culled like every other legacy-built stream (heightfield.ts
   *     expansionCull), so nothing floats over the west bank, the discs or the far hut's knoll.
   */
  const midTarget = Math.round(400 * Math.max(0.7, Math.min(1.2, ctx.quality.density)));
  const midOccupied: { x: number; z: number; r: number }[] = [
    ...giantDefsAll.map((g) => ({ x: g.position[0], z: g.position[2], r: g.trunkRadius + 4.5 })),
    ...ctx.layout.houses.map((h) => ({ x: h.position[0], z: h.position[2], r: h.trunkRadius + 4 })),
    // (the white-barks and columns as drawn before round 56: see `drawnWhites`)
    ...whiteClearance.map((p) => ({ x: p.x, z: p.z, r: whites[p.variant].params.trunkRadius * p.scale + 2.4 })),
    ...[...columnPlacements, ...drawnSwaps.filter((p) => !swappedWhites.includes(p))].map((p) => ({ x: p.x, z: p.z, r: 3.2 })),
    // only the distant boles that can reach the grove's annulus (the layer starts at 60 m; the
    // depth rows and the far-trunk poles stand inside it)
    ...distantPlacements.filter((p) => Math.hypot(p.x, p.z) < 74).map((p) => ({ x: p.x, z: p.z, r: 3.5 })),
  ];
  /**
   * Where the grove is thickest. The village core stays open (nothing new inside 13 m, full weight
   * from 19 m out); the north — the owner's pose looks down the north path from the plaza's north
   * end — carries about twice the weight of the rest of the ring, and the ring itself is thick
   * everywhere, because the brief is "every direction you can walk shows layered trees".
   */
  const midWeight = (x: number, z: number) => smoothstep(13, 19, Math.hypot(x, z)) * (0.58 + 0.42 * smoothstep(-6, -26, z));
  /**
   * fable-5 (lane 10, 2026-09-23 12:52): mid crowns 3–7 m from the walk line read as flat card piles
   * at `u-open-up` and `h-west-front`. The band 3.4–11 m off the walk polylines is the understory's
   * (real laminae, `UNDERSTORY_PATH_MIN_M`…`UNDERSTORY_PATH_MAX_M`); the card grove starts where the
   * cards hold — MID_WALK_MIN_M from the path centrelines (a post-filter, so no other tree moves).
   */
  const MID_WALK_MIN_M = 11;
  const midWalkXZ: [number, number][][] = [
    ctx.layout.pathSpine.map((p) => [p[0], p[2]] as [number, number]),
    ctx.layout.pathToHouse.map((p) => [p[0], p[2]] as [number, number]),
    ctx.layout.northPath.map((p) => [p[0], p[2]] as [number, number]),
  ];
  const nearWalk = (x: number, z: number) => midWalkXZ.some((poly) => poly.length > 1 && spineDistance(poly, x, z) < MID_WALK_MIN_M);
  const midSampled = placeMidTrees(rng, terrain, distantVariants, {
    target: midTarget,
    inner: 13,
    outer: 58,
    blocked: (x, z, treeRadius) => treeGroundBlocked(ctx, x, z, treeRadius, EXTRA_GIANTS),
    occupied: midOccupied,
    corridors: plazaCorridors.map((c) => ({ point: c.point, dir: c.dir, radius: c.radius })),
    weight: midWeight,
    spacing: 3.2,
  });
  // applied AFTER sampling, like expansionCull: a rule inside the sampler's `blocked` shifts every
  // later draw and re-rolls the whole grove (measured: 6 trees fewer, 60 % of u-open-up's pixels moved)
  // round 56: the south route keeps the cards MID_SOUTH_WALK_MIN_M off its line, and the south exit's
  // ground seats or drops a mid bole the way it does a white-bark (`southFooting`)
  const midSpec0 = distantVariants.length - MID_SPECS.length;
  /** the mid boles standing on the south exit's live ground, for the base-gap audit */
  const midLive = new Set<(typeof midSampled)[number]>();
  const midPlacements = midSampled.filter((p) => {
    if (nearWalk(p.x, p.z) || southWalkDistance(p.x, p.z) < MID_SOUTH_WALK_MIN_M) return false;
    const trunkR = MID_TRUNK_R * (MID_SPECS[p.variant - midSpec0]?.height ?? 12) * p.scale;
    const south = southFooting(p.x, p.z, SOUTH_TRUNK_REACH_M, trunkR + SOUTH_LIP_MARGIN_M);
    if (south === null) return !expansionCull(p.x, p.z);
    if (south === 'cull' || westExpansionCull(p.x, p.z)) return false;
    if (south === 'live') {
      p.y = liveTerrain.height(p.x, p.z);
      midLive.add(p);
    }
    return true;
  });
  distantPlacements.push(...midPlacements);
  // 2026-09-24 (expansion-north): the grove (terrain/north.ts) keeps every bole off its flight,
  // trail, shelf and walkways and out from under its huts (`northGroveClear` with the bole's own
  // foot radius), and every crown whose base hangs below a hut's top clear of it; a tree left in the
  // grove's box stands on the live ground the grove shaped. Only the 60–215 m layer reaches the box
  // (76.9 m+ from the plaza); a filter after every sampler, so nothing else re-rolls. The card
  // crowns read as flat piles from under them (the mid grove's finding, MID_WALK_MIN_M), so no card
  // crown comes within GROVE_CARD_WALK_M of the grove's walks and decks, in the box or beside it,
  // and a bole gives way to a grove understory stem it would crowd (the understory is seated first).
  const groveUnderstory = understoryPlacements
    .filter((p) => p.z < -76 && inExpansionNorth(p.x, p.z))
    .map((p) => ({ x: p.x, z: p.z, cr: understory[p.variant].params.crownRadius * p.scale }));
  const northGrove = { culled: [] as [number, number][], reseated: 0, understory: groveUnderstory.length, cardWalkM: GROVE_CARD_WALK_M, understoryGroundM: GROVE_UNDERSTORY_GROUND_M, understoryDeckM: GROVE_UNDERSTORY_DECK_M };
  {
    const reach = distantVariants.map((v) => {
      const pos = v.near.attributes.position;
      let bole = 0;
      let crown = 0;
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getZ(i));
        if (pos.getY(i) < 1.2) bole = Math.max(bole, r);
        crown = Math.max(crown, r);
      }
      let base = v.height;
      for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i), pos.getZ(i)) > bole * 1.6 + 0.4) base = Math.min(base, pos.getY(i));
      return { bole, crown, base };
    });
    const huts = northGroveHuts();
    for (let i = distantPlacements.length - 1; i >= 0; i--) {
      const p = distantPlacements[i];
      if (p.z > -76) continue;
      const inBox = inExpansionNorth(p.x, p.z);
      const gw = groveWalkDistance(p.x, p.z);
      if (!inBox && gw === Infinity) continue;
      const f = reach[p.variant];
      const cards = gw < Math.max(GROVE_CARD_WALK_M, f.crown * p.scale * 0.85 + 1);
      const crownHits = huts.some((h) => Math.hypot(p.x - h.x, p.z - h.z) < f.crown * p.scale * 0.85 + h.r && liveTerrain.height(p.x, p.z) + f.base * p.scale < h.top);
      const crowds = groveUnderstory.some((u) => Math.hypot(p.x - u.x, p.z - u.z) < f.bole * p.scale + u.cr * 0.9);
      if (cards || crownHits || crowds || (inBox && northGroveClear(p.x, p.z, f.bole * p.scale + 0.3))) {
        northGrove.culled.push([Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]);
        distantPlacements.splice(i, 1);
        continue;
      }
      if (!inBox) continue;
      p.y = liveTerrain.height(p.x, p.z);
      midLive.add(p);
      northGrove.reseated++;
    }
  }
  // round 47: the crown cards (the geometry's second group) draw with their own material (distant.ts createDistantCrownMaterial: far-crown atlas, spherical shading, soft alpha, wind)
  const distantCrown = createDistantCrownMaterial(ctx.wind, rng, palette, sunDir);
  // the mid-canopy crowns share that atlas and turn off the treatments the far layer applies inside
  // its 48 m gate (distant.ts MID_CROWN_LOOK) — at 12 m they would darken the mass to a quarter of
  // its albedo and fade its vertical cards out as the view climbs to it
  const midCrown = createDistantCrownMaterial(ctx.wind, rng, palette, sunDir, { ...MID_CROWN_LOOK, atlas: distantCrown.map ?? undefined });
  const distantSets: DistantSet[] = distantVariants.map((variant, i) => {
    const placements = distantPlacements.filter((p) => p.variant === i);
    const n = Math.max(1, placements.length);
    const mid = variant.kind === 'mid';
    const make = (geometry: DistantVariant['near'], label: string, lodLevel: number) => {
      const mesh = new InstancedMesh(geometry, [mats.distant, mid ? midCrown : distantCrown], n);
      mesh.name = `${mid ? 'mid' : 'distant'}-${i}-${label}`;
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.visible = false;
      mesh.userData.kind = mid ? 'mid-tree' : 'distant-tree';
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
    return { variant, near, far, placements, matrices, counts: [0, 0], lists: [[], []], submitted: [[], []] };
  });
  group.add(distantGroup);
  ctx.progress('trees', 0.95);

  // ------------------------------------------------------------------ LOD bucketing
  const lodDist = [TREE_LOD_NEAR_M * ctx.quality.distance * TREE_LOD_SCALE[0], TREE_LOD_MID_M * ctx.quality.distance * TREE_LOD_SCALE[1]];
  const distantNear = DISTANT_NEAR_M * ctx.quality.distance * TREE_LOD_SCALE[2];
  const camPos = new Vector3(Infinity, Infinity, Infinity);
  const white = new Color(1, 1, 1);

  // LOD buckets: every placement lands in exactly one bucket by camera distance
  const bucketFamily = <P, T extends { x: number; z: number; scale: number }>(variants: FamilyVariant<P, T>[], cam: Vector3, hidden?: (p: T) => boolean) => {
    for (const w of variants) {
      const buckets: number[][] = [[], [], []];
      for (let i = 0; i < w.placements.length; i++) {
        const p = w.placements[i];
        if (hidden?.(p)) continue;
        const d = Math.hypot(p.x - cam.x, p.z - cam.z) - w.lods[0].radius * p.scale * 0.5;
        const l = d < lodDist[0] ? 0 : d < lodDist[1] ? 1 : 2;
        buckets[l].push(i);
      }
      for (let l = 0; l < 3; l++) {
        w.lists[l] = buckets[l];
        w.counts[l] = buckets[l].length;
      }
    }
  };
  const bucketWhite = (cam: Vector3) => {
    bucketFamily(whites, cam);
    bucketFamily(seatedColumns, cam);
    bucketFamily(understory, cam, groveNearXZ(cam.x, cam.z) ? undefined : (p) => p.grove === true);
  };

  // Round 51's stand rule (the band-only poles at z < −62 took the far LOD from 50 m while the
  // distant layer's gate was 120 / 72 m) retired in round 54: squad2's lodcheck pulled `DISTANT_NEAR_M`
  // to 45 m, under the 50, so the min() it was inside always took the gate — every set switches at
  // `distantNear` now, the mid grove at its own MID_FAR_LOD_M.
  const bucketDistant = (cam: Vector3) => {
    for (const set of distantSets) {
      const nearList: number[] = [];
      const farList: number[] = [];
      // a mid tree is 8–15 m tall and never further than 58 m from the clearing's centre: its near
      // LOD (12-sided bole, limbs, toes, the layered crown) is worth drawing to MID_FAR_LOD_M and
      // no further — past it the crossed strips carry the same silhouette for a tenth of the wood
      const kindNear = set.variant.kind === 'mid' ? Math.min(distantNear, MID_FAR_LOD_M * ctx.quality.distance * TREE_LOD_SCALE[2]) : distantNear;
      for (let i = 0; i < set.placements.length; i++) {
        const p = set.placements[i];
        (Math.hypot(p.x - cam.x, p.z - cam.z) < kindNear ? nearList : farList).push(i);
      }
      set.lists = [nearList, farList];
      set.counts = [nearList.length, farList.length];
    }
  };

  // ------------------------------------------------------------------ submission culling
  // (see CULL_PAD_M): the view frustum of the frame about to be rendered, the sun direction the
  // shadows sweep along, and the instance/mesh tests that decide what each bucket hands the GPU
  const frustum = new Frustum();
  const viewProj = new Matrix4();
  const lastViewProj = new Matrix4().makeScale(0, 0, 0);
  const sunNow = sunDir.clone();
  const sphere = new Sphere();
  const shadowEnd = new Vector3();
  const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  /** the sphere (already padded) meets the frustum */
  const inView = (s: Sphere) => frustum.intersectsSphere(s);
  /**
   * The volume the sphere's shadow sweeps along the sun direction (from the sphere down to
   * SHADOW_FLOOR_Y) meets the frustum: a capsule is outside a plane iff both end spheres are.
   */
  const shadowReaches = (s: Sphere) => {
    const span = Math.max(0, (s.center.y + s.radius - SHADOW_FLOOR_Y) / Math.max(0.05, sunNow.y));
    shadowEnd.copy(s.center).addScaledVector(sunNow, -span);
    for (const plane of frustum.planes) {
      if (plane.distanceToPoint(s.center) < -s.radius && plane.distanceToPoint(shadowEnd) < -s.radius) return false;
    }
    return true;
  };
  /** world bounding sphere of placement `i` of `w` at LOD `l`, padded */
  const instanceSphere = <P, T extends { x: number; z: number; scale: number }>(w: FamilyVariant<P, T>, l: number, i: number, out: Sphere) => {
    const bs = w.lods[l].geometry.boundingSphere!;
    out.center.copy(bs.center).applyMatrix4(w.matrices[i]);
    out.radius = bs.radius * w.placements[i].scale + CULL_PAD_M;
    return out;
  };
  /** wind sway + a margin for the hull test (m, before the instance scale) */
  const HULL_PAD_M = 1.5;
  const hullSphere = new Sphere();
  const hullSpheres: Sphere[] = [new Sphere(), new Sphere(), new Sphere()];
  /** the instance's colour-pass hull meets the frustum (false only when every hull sphere is outside one plane) */
  const hullInView = <P, T extends { x: number; z: number; scale: number }>(w: FamilyVariant<P, T>, l: number, i: number) => {
    const hull = w.meshes[l].userData.hull as Sphere[] | undefined;
    if (!hull) return true;
    const scale = w.placements[i].scale;
    for (let k = 0; k < hull.length; k++) {
      hullSpheres[k].center.copy(hull[k].center).applyMatrix4(w.matrices[i]);
      hullSpheres[k].radius = hull[k].radius * scale + HULL_PAD_M;
    }
    for (const plane of frustum.planes) {
      let outside = true;
      for (let k = 0; k < hull.length && outside; k++) {
        hullSphere.copy(hullSpheres[k]);
        if (plane.distanceToPoint(hullSphere.center) >= -hullSphere.radius) outside = false;
      }
      if (outside) return false;
    }
    return true;
  };
  /**
   * Round 52 (W38): a casting instance behind the camera stays submitted for its shadow, but the
   * colour pass drew it too — at A the three high-LOD white-barks behind the stairs (99–138° off
   * axis, 9–17 m) cost 254 K triangles for no pixel. `fillFamily` packs the in-view instances first
   * and remembers how many there are; the colour pass draws only those (`onBeforeRender` shrinks
   * `count`, `onAfterRender` restores it). Three renders the shadow maps before the scene and never
   * calls `onBeforeRender` from the shadow pass, so every kept instance still casts.
   */
  const MAIN_COUNT = 'mainCount';
  const FULL_COUNT = 'fullCount';
  const installMainPassCount = (mesh: InstancedMesh) => {
    if (mesh.userData[FULL_COUNT] !== undefined) return;
    mesh.userData[FULL_COUNT] = mesh.count;
    mesh.userData[MAIN_COUNT] = mesh.count;
    mesh.onBeforeRender = () => {
      mesh.count = mesh.userData[MAIN_COUNT] as number;
    };
    mesh.onAfterRender = () => {
      mesh.count = mesh.userData[FULL_COUNT] as number;
    };
  };
  const fillFamily = <P, T extends { x: number; z: number; scale: number }>(w: FamilyVariant<P, T>, l: number, list: number[], mainCount = list.length) => {
    const mesh = w.meshes[l];
    for (let k = 0; k < list.length; k++) mesh.setMatrixAt(k, w.matrices[list[k]]);
    mesh.count = list.length;
    mesh.visible = list.length > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (list.length) {
      // the aggregate sphere three culls the whole mesh against must carry the same pad the
      // instances were admitted with, or a sparse bucket admitted at the frustum's edge for its
      // wind sway / shadow filter is dropped again by the renderer's unpadded test
      mesh.computeBoundingSphere();
      mesh.boundingSphere!.radius += CULL_PAD_M;
    }
    installMainPassCount(mesh);
    mesh.userData[FULL_COUNT] = list.length;
    mesh.userData[MAIN_COUNT] = mainCount;
    w.submitted[l] = list;
  };
  const submitFamily = <P, T extends { x: number; z: number; scale: number }>(variants: FamilyVariant<P, T>[]) => {
    for (const w of variants) {
      for (let l = 0; l < 3; l++) {
        const casts = w.meshes[l].castShadow;
        const kept: number[] = [];
        const shadowOnly: number[] = [];
        for (const i of w.lists[l]) {
          instanceSphere(w, l, i, sphere);
          if (inView(sphere) && hullInView(w, l, i)) kept.push(i);
          else if (casts && shadowReaches(sphere)) shadowOnly.push(i);
        }
        if (l === 0 && w.shadowProxy) {
          // the high bucket's shadow-only instances cast from the medium-geometry twin
          if (!sameList(kept, w.submitted[l]) || w.meshes[l].userData[MAIN_COUNT] !== kept.length) fillFamily(w, l, kept, kept.length);
          if (!sameList(shadowOnly, w.submittedShadow!)) {
            const proxy = w.shadowProxy;
            for (let k = 0; k < shadowOnly.length; k++) proxy.setMatrixAt(k, w.matrices[shadowOnly[k]]);
            proxy.count = shadowOnly.length;
            proxy.visible = shadowOnly.length > 0;
            proxy.instanceMatrix.needsUpdate = true;
            if (shadowOnly.length) {
              proxy.computeBoundingSphere();
              proxy.boundingSphere!.radius += CULL_PAD_M;
            }
            w.submittedShadow = shadowOnly;
          }
          continue;
        }
        const mainCount = kept.length;
        for (const i of shadowOnly) kept.push(i);
        if (!sameList(kept, w.submitted[l]) || w.meshes[l].userData[MAIN_COUNT] !== mainCount) fillFamily(w, l, kept, mainCount);
      }
    }
  };
  const fillDistant = (set: DistantSet, l: 0 | 1, list: number[]) => {
    const mesh = l === 0 ? set.near : set.far;
    for (let k = 0; k < list.length; k++) {
      mesh.setMatrixAt(k, set.matrices[list[k]]);
      mesh.setColorAt(k, set.placements[list[k]].tint ?? white);
    }
    mesh.count = list.length;
    mesh.visible = list.length > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (list.length) {
      // the aggregate sphere three culls the whole mesh against must carry the same pad the
      // instances were admitted with, or a sparse bucket admitted at the frustum's edge for its
      // wind sway / shadow filter is dropped again by the renderer's unpadded test
      mesh.computeBoundingSphere();
      mesh.boundingSphere!.radius += CULL_PAD_M;
    }
    set.submitted[l] = list;
  };
  const submitDistant = () => {
    for (const set of distantSets) {
      for (const l of [0, 1] as const) {
        const bs = (l === 0 ? set.variant.near : set.variant.far).boundingSphere!;
        const kept: number[] = [];
        for (const i of set.lists[l]) {
          sphere.center.copy(bs.center).applyMatrix4(set.matrices[i]);
          sphere.radius = bs.radius * set.placements[i].scale + CULL_PAD_M;
          if (inView(sphere)) kept.push(i);
        }
        if (!sameList(kept, set.submitted[l])) fillDistant(set, l, kept);
      }
    }
  };
  // giant sectors: world-space geometry; three culls the colour pass by the same sphere itself
  /**
   * Exact box-vs-frustum (separating axes): `Frustum.intersectsBox` only asks whether the box is
   * wholly behind one plane, and a 26 m crown that starts a metre from the camera straddles two
   * planes without meeting the frustum's volume. Axes tried: the box's three, the frustum's six
   * plane normals, and the 18 cross products of the box axes with the frustum's edge directions.
   */
  const frustumCorners = Array.from({ length: 8 }, () => new Vector3());
  const frustumEdges = Array.from({ length: 6 }, () => new Vector3());
  const invViewProj = new Matrix4();
  const satAxis = new Vector3();
  const boxCenter = new Vector3();
  const boxHalf = new Vector3();
  const frustumCornersFor = (camera: Camera) => {
    invViewProj.copy(viewProj).invert();
    let k = 0;
    for (const z of [-1, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) frustumCorners[k++].set(x, y, z).applyMatrix4(invViewProj);
    // edge directions: near-plane right (0→1) and up (0→2), and the four side edges near→far
    frustumEdges[0].subVectors(frustumCorners[1], frustumCorners[0]).normalize();
    frustumEdges[1].subVectors(frustumCorners[2], frustumCorners[0]).normalize();
    for (let i = 0; i < 4; i++) frustumEdges[2 + i].subVectors(frustumCorners[4 + i], frustumCorners[i]).normalize();
    void camera;
  };
  const separatedOn = (axis: Vector3, box: Box3) => {
    const len = axis.length();
    if (len < 1e-6) return false;
    const r = boxHalf.x * Math.abs(axis.x) + boxHalf.y * Math.abs(axis.y) + boxHalf.z * Math.abs(axis.z);
    const c = boxCenter.dot(axis);
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of frustumCorners) {
      const d = p.dot(axis);
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    return hi < c - r || lo > c + r;
  };
  const boxMeetsFrustum = (box: Box3) => {
    if (!frustum.intersectsBox(box)) return false;
    box.getCenter(boxCenter);
    box.getSize(boxHalf).multiplyScalar(0.5);
    for (const axis of [satAxis.set(1, 0, 0), satAxis.set(0, 1, 0), satAxis.set(0, 0, 1)]) if (separatedOn(axis, box)) return false;
    for (let b = 0; b < 3; b++) {
      for (const e of frustumEdges) {
        satAxis.set(b === 0 ? 1 : 0, b === 1 ? 1 : 0, b === 2 ? 1 : 0).cross(e);
        if (separatedOn(satAxis, box)) return false;
      }
    }
    return true;
  };
  const markGroups = () => {
    for (const mesh of groupMeshes) {
      const boxes = mesh.userData.groupBoxes as Box3[];
      const spheres = mesh.userData.groupSpheres as Sphere[];
      const inView = mesh.userData.groupInView as boolean[];
      // a round crown's sphere is tighter than its box against the frustum's top plane; both must meet
      for (let i = 0; i < boxes.length; i++) inView[i] = frustum.intersectsSphere(spheres[i]) && boxMeetsFrustum(boxes[i]);
    }
  };
  const submitGiants = () => {
    markGroups();
    if (!ctx.quality.shadows) return;
    for (const mesh of sectorMeshes) {
      if (mesh.userData.kind === 'giant-authored-leaves' || mesh.userData.kind === 'giant-authored-cards') continue; // never cast
      sphere.copy(mesh.geometry.boundingSphere!);
      sphere.radius += CULL_PAD_M;
      mesh.castShadow = shadowReaches(sphere);
    }
  };
  /** trim every bucket for `camera`; skipped while the view-projection is unchanged (unless forced) */
  const cull = (camera: Camera, force: boolean) => {
    camera.updateMatrixWorld();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!force && viewProj.equals(lastViewProj)) return;
    lastViewProj.copy(viewProj);
    frustum.setFromProjectionMatrix(viewProj);
    frustumCornersFor(camera);
    if (ctx.sun) {
      sunNow.subVectors(ctx.sun.position, ctx.sun.target.position);
      if (sunNow.lengthSq() > 1e-6) sunNow.normalize();
      else sunNow.copy(sunDir);
    }
    submitFamily(whites);
    submitFamily(understory);
    submitFamily(seatedColumns);
    submitDistant();
    submitGiants();
  };

  /**
   * Re-bucket by LOD when the camera has moved ≥ 1.5 m (or when forced: an explicit re-pose from
   * `onCameraMove` must never render the previous pose's buckets), then trim the buckets for the
   * frame's frustum.
   */
  /**
   * The near-bole LOD for the camera at `cam` (see NearBole). With `reset` (an explicit re-pose)
   * the state is recomputed from the distances alone — in within NEAR_BASE_IN_M — so a capture's
   * frame never depends on where the camera was before; per frame the hysteresis holds a base in
   * until NEAR_BASE_OUT_M. The nearest NEAR_BOLE_SLOTS active bases are shown and their plain
   * boles collapsed (`mats.nearBole`); a shown base that lost its slot is hidden and restored.
   */
  const nearBoleUpdate = (cam: Vector3, reset: boolean) => {
    for (const nb of nearBoles) {
      nb.dist = Math.hypot(nb.origin.x - cam.x, nb.origin.z - cam.z);
      if (reset) nb.active = nb.dist < nb.band[0];
      else if (nb.active) nb.active = nb.dist <= nb.band[1];
      else nb.active = nb.dist < nb.band[0];
    }
    const shown = nearBoles
      .filter((nb) => nb.active || nb.kit)
      .sort((a, b) => Number(!!b.kit) - Number(!!a.kit) || a.dist - b.dist)
      .slice(0, NEAR_BOLE_SLOTS);
    for (const nb of nearBoles) nb.mesh.visible = shown.includes(nb);
    // the pool: a shown base is pinned (built now if it is not resident), a base within the
    // pre-fetch radius is wanted (built ahead, nearest first); the rest may be evicted
    nearBasePool.begin();
    for (const nb of nearBoles) {
      if (!nb.item) continue;
      if (nb.mesh.visible) nearBasePool.pin(nb.item);
      else if (nb.dist < NEAR_BASE_PREFETCH_M) nearBasePool.want(nb.item, nb.dist);
    }
    const slots = mats.nearBole.value;
    for (let i = 0; i < NEAR_BOLE_SLOTS; i++) {
      const nb = shown[i];
      if (nb) slots[i].set(nb.origin.x, nb.origin.y, nb.origin.z, nb.kit || nb.rootsOnly ? -nb.cutY : nb.cutY);
      else slots[i].set(0, 0, 0, 0);
    }
  };
  /**
   * The near-canopy LOD for the camera at `cam` (see NearCanopy): the same hysteresis as the near
   * boles', measured to each part's crown envelope in 3D.
   * The nearest NEAR_CANOPY_SLOTS resident active lobes are shown and their far foliage folded through
   * `mats.nearCanopy` (a slot = the tree's root + 3 + the lobe's group); the nearest
   * NEAR_CANOPY_LIMBS_MAX limb dressings are shown (nothing to fold). With `reset` the state is
   * recomputed from the distances alone. Missing parts retain far foliage while queued.
   */
  // Only the memory tier caps admission. Fixed views and free/play cameras use the same
  // world-space rule; a part is never removed from the catalogue because of another camera.
  for (const nc of nearCanopies) {
    if (nc.fixedSwap || nc.persistent) continue;
    // `TREE_LOD_SCALE[3]` is the dev knob's fourth component (`?treelod=,,,<mult>`): it scales this
    // band so the crown swap's own share of "the trees spawn when I get close" can be read on its own,
    // the way the white-barks' rungs were. 1 = shipped.
    nc.inM = Math.min(nc.inM, NEAR_LOD_TIER.canopySwapM[0]) * TREE_LOD_SCALE[3];
    nc.outM = Math.min(nc.outM, NEAR_LOD_TIER.canopySwapM[1]) * TREE_LOD_SCALE[3];
  }
  /**
   * How much nearer a challenger must be to take a shown part's slot (see byRank): an incumbent ranks
   * at this share off its own distance. 0.25 is one step of the walk probe's 4 m at the ~16 m boundary
   * the cap puts in the village, so ordinary forward walking still hands slots over — it is the
   * near-ties that stop trading places.
   */
  const NEAR_CANOPY_KEEP = 0.25;
  /**
   * Why the ranking is DISTANCE and the cap is not raised (2026-09-24, lane 2, measured at the owner's
   * 06:50 pose — `nearCanopy.shownCoverage / activeCoverage` in the audit is the share of the crown mass
   * around the player that draws its near laminae):
   *   • the 64 slots are a TRIANGLE budget, not a uniform-array limit. Uncapped, the plaza's 214 active
   *     lobes would draw ≈ 1.81 M triangles of near foliage against the 0.56 M the 64 draw now, and
   *     camera A sits 0.07 M under W38's 9 M gate. Raising `NEAR_CANOPY_SLOTS` is not available.
   *   • ranking by apparent size (`dist / radius`) instead lifts coverage 57.6 % → 61.3 % but spends
   *     10 % more triangles to do it — 3 % WORSE per triangle — and pushes the shown set out to 19.1 m,
   *     away from where the near version earns its keep. It buys more, not better.
   *   • ranking by coverage per triangle collapses to 3 shown lobes: it prefers cheap far crowns, which
   *     the pool (prefetching by distance) has not built, so `resident` filters them out. Any ranking
   *     that disagrees with the prefetch starves itself.
   * Distance agrees with the prefetch and puts the detail nearest the eye, so it stays.
   */
  /** the parts shown by the previous non-reset update (byRank's incumbents) */
  const shownLastFrame = new Set<NearCanopy>();
  const nearCanopyUpdate = (cam: Vector3, reset: boolean) => {
    nearCanopyPool.begin();
    for (const nc of nearCanopies) {
      nc.dist = Math.max(0, nc.center.distanceTo(cam) - nc.radius);
      if (reset) nc.active = nc.dist < nc.inM;
      else if (nc.active) nc.active = nc.dist <= nc.outM;
      else nc.active = nc.dist < nc.inM;
    }
    /**
     * 2026-09-24 (lane 2, the owner's 20:08 "why don't the trees immediately spawn instead of needing
     * me to get close"): the in / out radii carry hysteresis, but the SLOT CAP had none, and the cap is
     * what actually decides. Walked from the plaza to the north clearing (12 poses, the probe
     * `art/environment/squad2-2026-09-23/canopy-walk.mjs`): 135–218 lobes are active against
     * `NEAR_CANOPY_SLOTS` = 64 at EVERY step — an overflow of 71 to 154 — so the shown set is the "64
     * nearest" and nothing damps it: 22.5 of the 79 shown parts were admitted or evicted per 4 m of
     * walking, each one a crown flipping between its near laminae and its folded far foliage within
     * 17 m of the camera. (It also means the effective swap boundary is not the nominal 26 m: the
     * farthest shown part ran 16.3 m in the village and 42.2 m in the clearing, wherever the 64th
     * nearest lobe happened to fall — which is why widening the 26 / 30 band changed 0.00 %.)
     *
     * An incumbent now ranks as if it were `NEAR_CANOPY_KEEP` nearer than it is, so a challenger must
     * be meaningfully nearer to take its slot. Both are inside their own in-radius either way, so the
     * frame is as correct as before and stops changing under the walker; it also spares the pool the
     * rebuilds that the evictions caused. NOT applied on `reset` — an explicit re-pose (every capture)
     * must draw the same parts whether the pool was cold or warm, so the six fixed frames are
     * untouched by construction.
     */
    const byDist = (a: NearCanopy, b: NearCanopy) => a.dist - b.dist || a.center.distanceToSquared(cam) - b.center.distanceToSquared(cam);
    const keep = reset ? 1 : 1 - NEAR_CANOPY_KEEP;
    const rankOf = (nc: NearCanopy) => nc.dist * (shownLastFrame.has(nc) ? keep : 1);
    const byRank = (a: NearCanopy, b: NearCanopy) => rankOf(a) - rankOf(b) || byDist(a, b);
    const resident = (nc: NearCanopy) => nearCanopyPool.isResident(nc.item);
    const persistent = nearCanopies.filter((nc) => nc.persistent);
    const lobeCandidates = nearCanopies.filter((nc) => !nc.persistent && nc.active && nc.kind === 'lobe').sort(byRank).slice(0, NEAR_CANOPY_SLOTS);
    const limbCandidates = nearCanopies.filter((nc) => nc.active && nc.kind === 'limb').sort(byRank).slice(0, NEAR_CANOPY_LIMBS_MAX);
    if (reset) {
      // Explicit re-poses retain the capture contract: the same pose draws the same parts,
      // whether the pool was cold or warm. Ordinary updates keep their chunked prefetch.
      // The authored maximum selected set is 41.03 MiB, below the 64 MiB minimum pool.
      for (const nc of [...persistent, ...lobeCandidates, ...limbCandidates]) nearCanopyPool.pin(nc.item);
      nearCanopyPool.begin();
    }
    for (const nc of nearCanopies) {
      if (nc.persistent || nc.dist < NEAR_CANOPY_PREFETCH_M) nearCanopyPool.want(nc.item, nc.persistent ? -1 : nc.dist);
    }
    let pinnedBytes = 0;
    const fits = (nc: NearCanopy) => {
      if (pinnedBytes + nc.item.bytes > nearCanopyPool.capBytes) return false;
      pinnedBytes += nc.item.bytes;
      return true;
    };
    const shownPersistent = persistent.filter(resident).filter(fits);
    const shownLobes = lobeCandidates.filter(resident).filter(fits);
    const shownLimbs = limbCandidates.filter(resident).filter(fits);
    // A walking camera keeps far foliage for parts still queued through work()'s frame budget.
    for (const nc of nearCanopies) {
      const shown = shownPersistent.includes(nc) || shownLobes.includes(nc) || shownLimbs.includes(nc);
      nc.shown = shown;
      if (nc.mesh) nc.mesh.visible = shown;
      else if (nc.batchIds && nc.batch) nc.batch.setVisible(nc.batchIds.instId, shown);
    }
    // the incumbents the next update ranks with NEAR_CANOPY_KEEP (see byRank)
    shownLastFrame.clear();
    for (const nc of shownLobes) shownLastFrame.add(nc);
    for (const nc of shownLimbs) shownLastFrame.add(nc);
    for (const nc of [...shownPersistent, ...shownLobes, ...shownLimbs]) nearCanopyPool.pin(nc.item);
    if (reset) nearCanopyPool.work(0);
    const slots = mats.nearCanopy.value;
    for (let i = 0; i < NEAR_CANOPY_SLOTS; i++) {
      const nc = shownLobes[i];
      if (nc) slots[i].set(nc.root.x, nc.root.y, nc.root.z, 3 + nc.group);
      else slots[i].set(0, 0, 0, 0);
    }
  };
  // the detached boughs' gate (see detachedGroup): the casters' spheres once, tested per pose
  const detachedSpheres = detachedCasters.flatMap((c) => casterSpheres(c, sunDir));
  const detachedVisible = (camera: Camera) => detachedMeshes.length > 0 && expansionVisible(camera, detachedSpheres);
  const rebucket = (camera: Camera, force = false) => {
    camera.getWorldPosition(_v);
    const moved = force || _v.distanceTo(camPos) >= 1.5;
    if (moved) {
      camPos.copy(_v);
      bucketWhite(camPos);
      bucketDistant(camPos);
    }
    nearBoleUpdate(_v, force);
    nearCanopyUpdate(_v, force);
    cull(camera, moved);
    detachedGroup.visible = detachedVisible(camera);
  };
  rebucket(ctx.camera, true);

  // ------------------------------------------------------------------ audit
  const whiteBases: [number, number, number][] = whitePlacements.map((p) => [p.x, p.y, p.z]);
  const columnBases: [number, number, number][] = columnPlacements.map((p) => [p.x, p.y, p.z]);
  const distantBases: [number, number, number][] = distantPlacements.map((p) => [p.x, p.y, p.z]);
  const allBases = [...whiteBases, ...columnBases, ...contacts, ...distantBases];
  // each base against the view it was seated on (round 50: the live-seated knoll trees and the far
  // hut's host would otherwise report the knoll's 1.4 m rise as a gap against the legacy plain)
  const liveSeated = new Set<[number, number, number]>();
  whitePlacements.forEach((p, i) => p.view === 'live' && liveSeated.add(whiteBases[i]));
  columnPlacements.forEach((p, i) => p.view === 'live' && liveSeated.add(columnBases[i]));
  liveContacts.forEach((c) => liveSeated.add(c));
  distantPlacements.forEach((p, i) => midLive.has(p) && liveSeated.add(distantBases[i]));
  let maxBaseGap = 0;
  for (const b of allBases) maxBaseGap = Math.max(maxBaseGap, Math.abs(b[1] - (liveSeated.has(b) ? liveTerrain : terrain).height(b[0], b[2])));
  const sampleBases = (() => {
    const pool = [...whiteBases, ...columnBases, ...contacts];
    const stride = Math.max(1, Math.ceil(pool.length / 300));
    return pool.filter((_, i) => i % stride === 0).slice(0, 300);
  })();
  /**
   * What the current buckets hand the renderer for the current camera, mesh by mesh, with three's
   * own culling replayed (mesh sphere against the camera frustum for the colour pass, against the
   * sun's shadow camera for the depth pass): draw calls and submitted triangles per family / LOD.
   */
  interface SubmissionTally {
    meshes: number;
    instances: number;
    calls: number;
    triangles: number;
  }
  const submission = () => {
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    const view = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let shadow: Frustum | null = null;
    if (ctx.sun?.castShadow) {
      const sc = ctx.sun.shadow.camera;
      shadow = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse));
    }
    const tally = (): SubmissionTally => ({ meshes: 0, instances: 0, calls: 0, triangles: 0 });
    const s = new Sphere();
    const add = (into: SubmissionTally, mesh: Mesh | InstancedMesh) => {
      const inst = (mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh).count : 1;
      if (!mesh.visible || inst === 0) return;
      const bs = (mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh).boundingSphere : mesh.geometry.boundingSphere;
      if (!bs) return;
      s.copy(bs).applyMatrix4(mesh.matrixWorld);
      const g = mesh.geometry;
      const tris = Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3) * inst;
      const colour = view.intersectsSphere(s) ? 1 : 0;
      const depth = mesh.castShadow && shadow && shadow.intersectsSphere(s) ? 1 : 0;
      into.meshes++;
      into.instances += inst;
      into.calls += colour + depth;
      into.triangles += tris * (colour + depth);
    };
    const byFamily: Record<string, SubmissionTally> = {};
    const family = (key: string) => (byFamily[key] ??= tally());
    for (const w of whites) w.meshes.forEach((m, l) => add(family(`whitebark-lod${l}`), m));
    for (const c of seatedColumns) c.meshes.forEach((m, l) => add(family(`column-lod${l}`), m));
    sectorMeshes.forEach((m) => add(family(m.userData.kind === 'giant' ? 'giant-wood' : m.userData.kind === 'giant-authored-leaves' || m.userData.kind === 'giant-authored-cards' ? m.userData.kind : 'giant-cards'), m));
    for (const d of distantSets) {
      const layer = d.variant.kind === 'mid' ? 'mid' : 'distant';
      add(family(`${layer}-near`), d.near);
      add(family(`${layer}-far`), d.far);
    }
    for (const nb of nearBoles) add(family(nb.mesh.userData.kind as string), nb.mesh);
    for (const nc of nearCanopies) if (nc.mesh) add(family(`${nc.mesh.userData.kind as string}-${nc.kind}`), nc.mesh);
    if (nearCanopyBatch) add(family('giant-near-canopy-batch'), nearCanopyBatch.mesh);
    if (columnNearCanopyBatch) add(family('column-near-canopy-batch'), columnNearCanopyBatch.mesh);
    if (detachedGroup.visible) for (const m of detachedMeshes) add(family(m.userData.kind as string), m);
    const total = tally();
    for (const t of Object.values(byFamily)) {
      total.meshes += t.meshes;
      total.instances += t.instances;
      total.calls += t.calls;
      total.triangles += t.triangles;
    }
    return {
      drawCalls: total.calls,
      triangles: total.triangles,
      meshes: total.meshes,
      instances: total.instances,
      byFamily,
      /** bucket sizes → submitted after culling, per LOD */
      whiteBarkLodSubmitted: [0, 1, 2].map((l) => whites.reduce((n, w) => n + w.submitted[l].length, 0)),
      columnLodSubmitted: [0, 1, 2].map((l) => seatedColumns.reduce((n, c) => n + c.submitted[l].length, 0)),
      distantSubmitted: [0, 1].map((l) => distantSets.reduce((n, d) => n + d.submitted[l].length, 0)),
      giantSectorsCasting: sectorMeshes.filter((m) => m.castShadow).length,
      /**
       * round 50 (trees-32): the detached boughs (DETACHED_BOUGHS) — per giant, their geometry and
       * lobes as built (world centres), whether the gate shows them for the current camera, and
       * the gate's sphere count (util/expansionLocality.ts casterSpheres)
       */
      detachedBoughs: detachedAudit,
      detachedBoughsVisible: detachedGroup.visible,
      detachedBoughSpheres: detachedSpheres.length,
      detachedBoughMeshes: detachedMeshes.map((m) => ({ name: m.name, castShadow: m.castShadow, triangles: Math.floor((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3) })),
      cullPadM: CULL_PAD_M,
    };
  };

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
    let columnLeaves = 0;
    const columnLodInstances = [0, 0, 0];
    for (const c of seatedColumns) {
      for (let l = 0; l < 3; l++) {
        columnLeaves += c.counts[l] * c.lods[l].leafCount;
        woodTriangles += c.counts[l] * c.lods[l].woodTriangles;
        leafTriangles += c.counts[l] * c.lods[l].leafTriangles;
        columnLodInstances[l] += c.counts[l];
      }
    }
    let giantLeaves = 0;
    let giantAuthoredLeaves = 0;
    let giantCards = 0;
    let giantFlatCards = 0;
    let giantLimbsMin = Infinity;
    let giantRootsMin = Infinity;
    for (const g of giants) {
      giantLeaves += g.asset.leafCount;
      giantAuthoredLeaves += g.asset.authoredLeafCount;
      giantCards += g.asset.cardCount + g.asset.authoredCardCount;
      giantFlatCards += g.asset.authoredCardCount;
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
    const canopyPool = nearCanopyPool.report();
    return {
      geometry: 'procedural-v1',
      giants: giants.length,
      giantRoots: giantRootsMin >= 5,
      giantRootsMin,
      giantLimbsMin,
      /** per giant, its un-authored big limbs' azimuths (0° = +x, 90° = +z); 'g' = ghosted (GiantProfile.wildLimbGhost) */
      giantWildLimbs: Object.fromEntries(giants.map((g) => [g.def.id, g.asset.wildLimbs.map((l) => `${l.azimuthDeg}${l.ghost ? 'g' : ''}`)])),
      giantLeaves,
      /**
       * Where a giant's WOOD triangles are, one row per giant, heaviest first — the question the
       * family total (`submission.byFamily['giant-wood']`, 1.51 M) cannot answer and the reason a rung
       * for it could not be designed (art/environment/squad2-2026-09-23/giantwood/CORRECTION.md).
       *
       *   [id, wood triangles, of them the relief bole, of them the authored boughs' dressing,
       *    the rest (plain sweep, wild limbs, buttress roots), the tree's LEAF triangles in the same
       *    mesh, the nearest hero camera holding it in its forward cone (m, null when none does —
       *    that is what gates the relief bole)]
       *
       * The leaf column matters: a giant's laminae share the geometry its wood is in (the sector mesh
       * is grouped 1 wood + GIANT_LEAF_BANDS leaf bands per giant), so the family the audit calls
       * `giant-wood` is wood AND leaves. Measured on the head, the wood is a sixth of it.
       *
       * The near base is NOT in these totals: it is pooled and drawn only inside NEAR_BASE_IN_M
       * (`nearBase.boles` has its own per-bole rows).
       */
      giantWoodByTree: [...giants]
        .map((g) => {
          const bark = g.asset.bark?.triangles ?? 0;
          const boughs = g.asset.boughDress.reduce((n, b) => n + b.triangles, 0);
          return [g.def.id, g.asset.woodTriangles, bark, boughs, g.asset.woodTriangles - bark - boughs, g.asset.leafTriangles, Number.isFinite(g.heroDistance) ? Math.round(g.heroDistance * 10) / 10 : null] as [string, number, number, number, number, number, number | null];
        })
        .sort((a, b) => b[1] - a[1]),
      /** of `giantLeaves`, the authored canopy-bough lobes' laminae, drawn from their own non-casting mesh */
      giantAuthoredLeaves,
      giantAuthoredLeavesCast: sectorMeshes.some((m) => m.userData.kind === 'giant-authored-leaves' && m.castShadow),
      /** laminae per authored canopy-bough lobe (CANOPY_BOUGHS order within each giant) */
      giantLobeLeaves: Object.fromEntries(giants.filter((g) => g.asset.lobeLeafCounts.length).map((g) => [g.def.id, g.asset.lobeLeafCounts])),
      /** leaf-cluster alpha cards inside the lobes (in addition to the laminae), the flat lobes' included */
      giantCanopyCards: giantCards,
      /** of `giantCanopyCards`, the flat lobes' (CanopyLobe.flat), drawn from their own non-casting mesh per giant */
      giantFlatCards,
      giantFlatCardsCast: sectorMeshes.some((m) => m.userData.kind === 'giant-authored-cards' && m.castShadow),
      /** flat lobes built with an opaque core (CanopyLobe.core), whose ellipsoids are in the authored-leaves meshes */
      giantFlatCores: CANOPY_BOUGHS.reduce((n, b) => n + b.lobes.filter((l) => l.flat && l.core).length, 0),
      /** round 40: leaf-cluster cards dressing the cores' outlines (giant.ts lobeCore), part of giantFlatCards */
      giantCoreRimCards: giants.reduce((n, g) => n + g.asset.coreRimCards, 0),
      /** round 45 (item 5): a cluster card's coverage by |cos(normal, view ray)| — [gone at, full from] for the ordinary and the flat-shaded cards (materials.ts CARD_EDGE_FADE) */
      cardEdgeFade: { cards: CARD_EDGE_FADE, flat: CARD_FLAT_EDGE_FADE },
      /** the giants' geometries: sectors, authored leaves / cards, plus their pooled near bases and near-canopy parts */
      giantMeshes: sectorGeometries.length + giants.reduce((n, g) => n + (g.asset.nearBase ? 1 : 0) + g.asset.nearCanopy.length, 0),
      giantCrownRadii: giants.map((g) => Math.round(g.asset.crownRadius * 10) / 10),
      /**
       * near-bole bark (bole.ts) per giant within NEAR_BOLE_M of a hero camera:
       * [id, relief amplitude (m), rings, sides, moss share of the bole's moss band, buttress toes, wood triangles]
       */
      giantNearBark: giants
        .filter((g) => g.asset.bark)
        .map((g) => {
          const b = g.asset.bark!;
          return [g.def.id, Math.round(b.relief * 1e3) / 1e3, b.rings, b.sides, Math.round(b.mossShare * 1e3) / 1e3, b.rootToes, b.triangles];
        }),
      /** the same for the column seats built with the near-bole bark (the emergent): [seat id, relief, rings, sides, moss share, wood triangles] */
      columnNearBark: seatedColumns
        .filter((c) => c.lods[0].bark)
        .map((c) => {
          const b = c.lods[0].bark!;
          return [c.placements[0].id, Math.round(b.relief * 1e3) / 1e3, b.rings, b.sides, Math.round(b.mossShare * 1e3) / 1e3, b.triangles];
        }),
      whiteBarkVariants: whites.length,
      whiteBarkInstances: whitePlacements.length,
      understoryInstances: understoryPlacements.length,
      understoryLodInstances: [0, 1, 2].map((l) => understory.reduce((n, u) => n + u.counts[l], 0)),
      /**
       * round 50 (trees-32): every SAMPLED white-bark placement as drawn ([x, z] cm, the swapped-to-column
       * ones included) — the stream every fixed frame was tuned against. A placement-rule change is
       * safe only while none of these flips (placement.ts fill: a newly blocked accepted candidate
       * skips its yaw draw and re-rolls every tree after it); diff this list across a build to prove it.
       */
      whiteBarkSampled: whitePlaced.placements.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]),
      /** round 50: sampled white-barks dropped by heightfield.expansionCull ([x, z] cm) — none in take-0123's stream */
      whiteBarkCulled,
      /** round 50: the authored white-barks seated on the LIVE view ([x, y, z] cm, variant) — the knoll pair */
      whiteBarkLiveSeated: whitePlacements.filter((p) => p.view === 'live').map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100, p.variant]),
      /** white-barks moved out of the hero-camera view gaps (VIEW_GAPS) */
      whiteBarkReseated: whitePlaced.reseated,
      whiteBarkAges: whites.map((w) => w.params.age),
      whiteBarkLodInstances: lodInstances,
      /**
       * Mean per-instance triangles of each rung [high, medium, low], so the cost of moving a rung is
       * arithmetic rather than a guess: the ladder's steps are what a walker sees change (`lodSwapM`).
       */
      whiteBarkLodTriangles: [0, 1, 2].map((l) => Math.round(whites.reduce((n, w) => n + w.lods[l].woodTriangles + w.lods[l].leafTriangles, 0) / Math.max(1, whites.length))),
      /** mature white-barks built as dark columns because their bole stood in a hero far wall */
      whiteBarkSwappedToColumns: swappedWhites.length,
      /** column trees (column.ts): the dark boles of the mid-distance forest wall */
      columnTrees: columnPlacements.length,
      columnVariants: columns.length,
      columnHeights: columns.map((c) => Math.round(c.params.height * 10) / 10),
      columnTrunkRadii: columns.map((c) => Math.round(c.params.trunkRadius * 100) / 100),
      columnSeats: columnPlacements.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, p.source]),
      columnSeatsSkipped,
      /**
       * round 50 (trees-32): the seats on the LIVE heightfield view (the far hut's host on its
       * knoll): id, [x, y, z] cm, the gap to the live ground (m), the gap to the legacy plain the
       * other trees stand on (the knoll's rise), whether its meshes cast
       */
      columnLiveSeats: columnPlacements
        .filter((p) => p.view === 'live')
        .map((p) => ({
          id: p.id,
          position: [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100],
          liveGap: Math.round(Math.abs(p.y - liveTerrain.height(p.x, p.z)) * 1e4) / 1e4,
          legacyRise: Math.round((p.y - terrain.height(p.x, p.z)) * 100) / 100,
          casts: p.casts,
          height: Math.round((seatedColumns.find((c) => c.placements[0] === p)?.params.height ?? 0) * 10) / 10,
        })),
      columnLodInstances,
      /** the same per-rung cost for the seated columns (one family per seat, so this is the mean seat) */
      columnLodTriangles: [0, 1, 2].map((l) => Math.round(seatedColumns.reduce((n, c) => n + c.lods[l].woodTriangles + c.lods[l].leafTriangles, 0) / Math.max(1, seatedColumns.length))),
      columnLeafCount: columnLeaves,
      leafGeometry: 'laminae',
      leafCount: leafCount + columnLeaves + giantLeaves,
      whiteBarkLeafCount: leafCount,
      distantTrees: distantPlacements.length,
      /** round 45: instances slid off the path's sight line / dropped from the arch's footprint, and the spine clearance (m) */
      distantClearance: { ...distantCleared, spine: DISTANT_SPINE_CLEARANCE, minSpineDistance: Math.round(Math.min(...distantPlacements.map((p) => spineDistance(spineXZ, p.x, p.z))) * 100) / 100 },
      distantLod: [distantNearCount, distantFarCount],
      /** the CPU arrays the trees still hold (bytes; by the system's groups) — see cpuArrayBytes */
      cpuArrays: cpuArrayBytes(group),
      /**
       * 2026-09-23 (lane 2, the owner's "the trees do not populate"): the mid-canopy grove in the
       * 14–58 m band — how many were placed (and how many the expansion's ground culled), the
       * variants' unscaled heights, the crown geometry as shares of the height, the LOD swap and the
       * nearest / farthest bole from the clearing's centre.
       */
      midCanopy: {
        trees: midPlacements.length,
        culled: midSampled.length - midPlacements.length,
        heights: MID_HEIGHTS,
        crown: MID_SPECS.map((s) => [s.height, s.crownR, s.crownY]),
        trunkRadius: MID_TRUNK_R,
        band: midPlacements.length ? [Math.round(Math.min(...midPlacements.map((p) => Math.hypot(p.x, p.z))) * 10) / 10, Math.round(Math.max(...midPlacements.map((p) => Math.hypot(p.x, p.z))) * 10) / 10] : [0, 0],
        /** every bole as [x, z, variant] (dm): a review can pose a camera at one, and a diff names what moved */
        seats: midPlacements.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, p.variant - (distantVariants.length - MID_SPECS.length)]),
        farLodM: MID_FAR_LOD_M,
        material: midCrown.name,
      },
      /**
       * 2026-09-24 (expansion-north): the 60–215 m layer's trees the grove dropped ([x, z] dm), how many
       * of its box it re-seated on the live ground, its understory stems and how many of them are in
       * the LOD buckets at the audit's pose (none unless the camera is near the grove)
       */
      northGrove: { ...northGrove, understoryBucketed: understory.reduce((n, u) => n + u.lists.reduce((m, list) => m + list.filter((i) => u.placements[i].grove).length, 0), 0) },
      /** round 45: the near LOD bole's basal flare [share at the foot, e-folding m] and the near-bark tone [overall, band amplitude, grime at the foot] (distant.ts, materials.ts DISTANT_NEAR_TONE) */
      distantNearBark: { flare: [DISTANT_FLARE, DISTANT_FLARE_FALL], tone: DISTANT_NEAR_TONE, withinM: DISTANT_BARK_M, limbReach: LIMB_REACH, limbTint: [LIMB_TIP_TINT, LIMB_TINT_FROM, LIMB_TINT_TO] },
      /** round 46: the near LOD bole's geometric cords [furrows around a broad / a slender, depth share], sides [broad, slender], the furrow floor's vertex shade, the root buttresses' arc sides (distant.ts) */
      distantNearRelief: { cords: DISTANT_CORDS, sides: DISTANT_SIDES, furrowShade: DISTANT_FURROW_SHADE, footGrime: DISTANT_FOOT_GRIME, rootArc: DISTANT_ROOT_ARC, nearGain: DISTANT_NEAR_GAIN, floor: [DISTANT_NEAR_FLOOR.lift, DISTANT_NEAR_FLOOR.texture] },
      /** round 47: the crown cards [near, far] and lobe pairs per tree, card half-size (crown radii), the crown material's sphere mix / core dark / rim / alpha test / jitter, the bole's crown-top darkening and tone bands, the depth cool (distant.ts) */
      distantCrown: { cards: FAR_CROWN_CARDS, lobes: FAR_CROWN_LOBES, cardHalf: FAR_CROWN_CARD_HALF, sphereMix: CROWN_SPHERE_MIX, coreDark: CROWN_CORE_DARK, rim: CROWN_RIM, alphaTest: CROWN_ALPHA_TEST, jitter: CROWN_JITTER, crownTop: DISTANT_CROWN_TOP, boleBands: DISTANT_BOLE_BANDS, depthCool: DISTANT_DEPTH_COOL, material: distantCrown.name || 'distant-crown' },
      /** round 45: a giant lobe's fine wood reach [secondaries, twigs] as shares of hR and its outer tint toward the leaf tone (giant.ts LOBE_*) */
      lobeWood: { secondaryReach: LOBE_SECONDARY_REACH, twigReach: LOBE_TWIG_REACH, tint: LOBE_TWIG_TINT },
      lodLevels: 3,
      /**
       * The instanced ladders' swap distances as this build resolved them (m, quality and the
       * `?treelod=` dev multiplier already applied): the white-barks' / columns' high→medium→low
       * rungs, the distant layer's near gate, the mid grove's and the north stand's own gates.
       */
      lodSwapM: { tree: lodDist, distant: distantNear, mid: Math.min(distantNear, MID_FAR_LOD_M * ctx.quality.distance * TREE_LOD_SCALE[2]), scale: TREE_LOD_SCALE },
      windLayers: mats.windLayers,
      barkTextures: mats.barkTextureSets,
      /**
       * shade floors as bound (trees/materials.ts presets): [lift, texture] — the giants' bark and
       * every leaf beyond TREE_FLOOR_FADE_M[1] (the shared presets), the same within
       * TREE_FLOOR_FADE_M[0] (the NEAR presets), the near bole (the emergent column), the near
       * bases, the near canopy's leaves
       */
      shadeFloors: Object.fromEntries(
        (
          [
            ['giantBark', TREE_BARK_FLOOR],
            ['giantBarkNear', TREE_BARK_FLOOR_NEAR],
            ['leaf', TREE_LEAF_FLOOR],
            ['leafNear', TREE_LEAF_FLOOR_NEAR],
            ['nearBole', TREE_NEAR_BOLE_FLOOR],
            ['column', COLUMN_BARK_FLOOR],
            ['columnFar', COLUMN_BARK_FLOOR_FAR],
            ['nearBase', NEAR_BASE_FLOOR],
            ['nearCanopyLeaf', NEAR_CANOPY_LEAF_FLOOR],
          ] as [string, ShadeFloor][]
        ).map(([k, f]) => [k, [f.lift, f.texture]]),
      ),
      /** the far programs' floors fade from the NEAR presets to the shared ones over this view distance (m) */
      shadeFloorFadeM: TREE_FLOOR_FADE_M,
      /** the column bark floor alone fades from `column` to `columnFar` over this view distance (m) (materials.ts COLUMN_FLOOR_FADE_M) */
      columnFloorFadeM: COLUMN_FLOOR_FADE_M,
      /** the near bole's floor fades with height (materials.ts NEAR_BOLE_FLOOR_FADE): [lift at the foot, lift above the fade, fade from (m), fade to (m)] */
      nearBoleFloorProfile: [NEAR_BOLE_FLOOR.lift, NEAR_BOLE_FLOOR_TOP, NEAR_BOLE_FLOOR_FADE[0], NEAR_BOLE_FLOOR_FADE[1]],
      /**
       * near-bole LOD (giant.ts NEAR_BASE_CUT_Y): radii (m), the cut height, the slot cap, the
       * near bases' floor [lift, texture], one row per base [id, triangles, camera distance (m),
       * shown for the current camera], and the ids shown now
       */
      nearBase: {
        inM: NEAR_LOD_TIER.baseBand[0],
        outM: NEAR_LOD_TIER.baseBand[1],
        /** giant.ts NEAR_BASE_RADIUS_OVERRIDE (the round-44 camera-derived bands) under the round-48 hero bands; then every bole's band as it runs */
        bands: { ...NEAR_BASE_RADIUS_OVERRIDE, ...NEAR_BASE_HERO_BAND },
        boleBands: Object.fromEntries(nearBoles.map((nb) => [nb.id, nb.band])),
        cutY: NEAR_BASE_CUT_Y,
        slots: NEAR_BOLE_SLOTS,
        floor: [NEAR_BASE_FLOOR.lift, NEAR_BASE_FLOOR.texture],
        boles: nearBoles.map((nb) => [nb.id, nb.triangles, Math.round(nb.dist * 10) / 10, nb.mesh.visible]),
        shown: nearBoles.filter((nb) => nb.mesh.visible).map((nb) => nb.id),
        rootKit: ROOT_KIT ? rootKitAudit : null,
        /** the bytes one build of every base takes (what was resident before the pool) and the pool's live bytes (lodPool.ts) */
        builtBytes: nearBoles.reduce((n, nb) => n + (nb.item ? nb.item.bytes : 0), 0),
        residentBytes: nearBasePool.poolBytes,
        prefetchM: NEAR_BASE_PREFETCH_M,
        /** round 48: the near-LOD tier (NEAR_LOD_TIERS) and the device memory (GB) that chose it */
        tier: NEAR_LOD_TIER.name,
        deviceMemoryGB: NEAR_LOD_DEVICE_GB,
        pool: nearBasePool.report(),
        /** per giant: [id, relief (m), rings, sides, moss share, fins, big fins, toes, wood triangles, fern clumps, tufts, litter leaves, plant triangles] */
        giants: giants
          .filter((g) => g.asset.nearBaseAudit)
          .map((g) => {
            const a = g.asset.nearBaseAudit!;
            return [g.def.id, Math.round(a.relief * 1e3) / 1e3, a.rings, a.sides, Math.round(a.mossShare * 1e3) / 1e3, a.fins, a.bigFins, a.toes, a.woodTriangles, a.plants.ferns, a.plants.tufts, a.plants.litter, a.plants.triangles];
          }),
        /** per seated column: [seat id, relief (m), rings, sides, moss share, fins, toes, wood triangles, plant triangles, 3-D cushions, roots-only] */
        columns: seatedColumns
          .filter((c) => c.lods[0].nearBaseAudit)
          .map((c) => {
            const a = c.lods[0].nearBaseAudit!;
            return [c.placements[0].id, Math.round(a.relief * 1e3) / 1e3, a.rings, a.sides, Math.round(a.mossShare * 1e3) / 1e3, a.fins, a.toes, a.woodTriangles, a.plants.triangles, a.cushions, a.rootsOnly];
          }),
        /** round 46: a 3-D moss cushion shrinks onto its anchor as the lens comes within [gone, full] m of it (materials.ts CUSHION_FADE_M); the near programs' bark octaves [m from, m to, tiles] for the fine (BARK_DETAIL_M) and touch (BARK_TOUCH_M) terms */
        cushionFadeM: CUSHION_FADE_M,
        barkOctaves: { fine: [BARK_DETAIL_M[0], BARK_DETAIL_M[1], BARK_DETAIL_TILES], touch: [BARK_TOUCH_M[0], BARK_TOUCH_M[1], BARK_TOUCH_TILES] },
      },
      /**
       * near-canopy LOD (giant.ts NEAR_CANOPY_IN_M, round 41): radii (m), the lobe-height cap,
       * the slot cap, the near leaf floor [lift, texture], the leaf-detail range, the sun-through
       * scale; per giant [id, lobes swapped, parts a hero camera kept far, parts with cut radii
       * under a hero camera, limb dressings, near triangles, near laminae, far laminae + cards the
       * lobes stand in for]; every part shown now as [id, distance (m), in-radius (m), triangles,
       * laminae]
       */
      nearCanopy: {
        /** the parts' built radii (nearCanopy.ts) and the tier's cap on them as drawn (NEAR_LOD_TIERS.canopySwapM) */
        inM: Math.min(NEAR_CANOPY_IN_M, NEAR_LOD_TIER.canopySwapM[0]) * TREE_LOD_SCALE[3],
        outM: Math.min(NEAR_CANOPY_OUT_M, NEAR_LOD_TIER.canopySwapM[1]) * TREE_LOD_SCALE[3],
        builtInM: NEAR_CANOPY_IN_M,
        builtOutM: NEAR_CANOPY_OUT_M,
        heroMargin: 0,
        minInM: 0,
        maxY: null,
        columnMaxY: NEAR_CANOPY_MAX_Y,
        distanceTo: 'crown-envelope',
        slots: NEAR_CANOPY_SLOTS,
        limbsMax: NEAR_CANOPY_LIMBS_MAX,
        leafFloor: [NEAR_CANOPY_LEAF_FLOOR.lift, NEAR_CANOPY_LEAF_FLOOR.texture],
        leafNearM: NEAR_CANOPY_LEAF_NEAR_M,
        sunThrough: NEAR_CANOPY_SUN_THROUGH,
        parts: nearCanopies.length,
        /** Retained audit keys: no camera permanently limits or drops registered parts. */
        heroPass: { limited: 0, dropped: 0 },
        deferredParts: giants.reduce((n, g) => n + g.asset.nearCanopy.filter(p => p.deferred).length, 0),
        /** Actual triangles of parts built at least once, and of buffers in the pool now. */
        builtTriangles: nearCanopies.reduce((n, nc) => n + nc.triangles, 0),
        residentTriangles: nearCanopies.reduce((n, nc) => n + (nearCanopyPool.isResident(nc.item) ? nc.triangles : 0), 0),
        /** vertices and buffer bytes (position, colour, uv, wind, root, normal + the index) of the parts in the pool now */
        residentVertices: nearCanopies.reduce((n, nc) => n + (nearCanopyPool.isResident(nc.item) ? (nc.mesh ? nc.mesh.geometry.getAttribute('position').count : nc.vertices) : 0), 0),
        residentBytes: nearCanopyPool.poolBytes,
        /** round 54: the giants' parts' batch and the seated columns' — their instances and the buffers they hold (reserved, in vertices / indices) with the heap those buffers take */
        batch: nearCanopyBatch ? { ...nearCanopyBatch.stats, heapBytes: nearCanopyBatch.heapBytes } : null,
        columnBatch: columnNearCanopyBatch ? { ...columnNearCanopyBatch.stats, heapBytes: columnNearCanopyBatch.heapBytes } : null,
        /** Measured bytes after a first build; deferred records retain conservative estimates. */
        builtBytes: nearCanopies.reduce((n, nc) => n + (nc.triangles ? nc.item.bytes : 0), 0),
        estimatedUnbuiltBytes: nearCanopies.reduce((n, nc) => n + (nc.triangles ? 0 : nc.item.bytes), 0),
        /** the pool (lodPool.ts): cap, live bytes, builds, evictions, synchronous builds, build-time percentiles */
        prefetchM: NEAR_CANOPY_PREFETCH_M,
        buildBudgetMs: NEAR_LOD_BUILD_BUDGET_MS,
        pool: canopyPool,
        built: canopyPool.built,
        evicted: canopyPool.evicted,
        poolBytes: canopyPool.poolBytes,
        buildMsP95: canopyPool.buildMsP95,
        giants: giants.map((g) => {
          const lobes = g.asset.nearCanopy.filter((p) => p.kind === 'lobe');
          const limbs = g.asset.nearCanopy.filter((p) => p.kind === 'limb');
          const sum = (f: (p: NearCanopyPart) => number) => g.asset.nearCanopy.reduce((n, p) => n + f(p), 0);
          return [g.def.id, lobes.length, g.asset.nearCanopyHeroKept, g.asset.nearCanopyHeroLimited, limbs.length, sum((p) => p.triangles), sum((p) => p.leaves), sum((p) => p.farLeaves + p.farCards)];
        }),
        /** per seated column [id, lobes swapped, parts a hero camera kept far, parts with cut radii, near triangles, near laminae, far laminae the lobes stand in for] */
        columns: seatedColumns
          .filter((c) => c.lods[0].nearCanopy.length || c.lods[0].nearCanopyHeroKept)
          .map((c) => {
            const a = c.lods[0];
            const sum = (f: (p: NearCanopyPart) => number) => a.nearCanopy.reduce((n, p) => n + f(p), 0);
            return [c.placements[0].id, a.nearCanopy.length, a.nearCanopyHeroKept, a.nearCanopyHeroLimited, sum((p) => p.triangles), sum((p) => p.leaves), sum((p) => p.farLeaves)];
          }),
        /** [id, distance, in-radius, triangles, laminae, crown radius, world centre] */
        shown: nearCanopies
          .filter((nc) => nc.shown)
          .map((nc) => [nc.id, Math.round(nc.dist * 10) / 10, Math.round(nc.inM * 10) / 10, nc.triangles, nc.leaves, Math.round(nc.radius * 10) / 10, nc.center.toArray().map((v) => Math.round(v * 10) / 10)]),
        /**
         * What the 64 slots actually buy: the shown lobes' summed apparent area (Σ r² / d², steradian-ish)
         * against the same sum over every ACTIVE lobe. `shownCoverage / activeCoverage` is the share of
         * the crown mass around the player that draws its near laminae, which is the thing a better
         * ranking should raise for the same `shownTriangles` (see NEAR_CANOPY_SIZE_BIAS).
         */
        shownCoverage:
          Math.round(
            nearCanopies.filter((nc) => nc.shown && nc.kind === 'lobe').reduce((n, nc) => n + (nc.radius * nc.radius) / Math.max(1, nc.dist * nc.dist), 0) * 1000,
          ) / 1000,
        activeCoverage:
          Math.round(nearCanopies.filter((nc) => nc.active && nc.kind === 'lobe').reduce((n, nc) => n + (nc.radius * nc.radius) / Math.max(1, nc.dist * nc.dist), 0) * 1000) / 1000,
        /**
         * How hard the SLOT CAP is pressing (2026-09-24, lane 2). `nearCanopyUpdate` takes the nearest
         * `NEAR_CANOPY_SLOTS` active non-persistent lobes; `activeLobes` is how many were eligible, so
         * `slotOverflow` above zero means the selection is decided by RANK, and a lobe can be admitted
         * or evicted by a metre of walking with no hysteresis behind it — unlike the in / out radii,
         * which have some. `farthestShownM` says where the effective boundary actually is, which is not
         * the 26 m in-radius when the cap binds.
         */
        activeLobes: nearCanopies.filter((nc) => nc.active && nc.kind === 'lobe' && !nc.persistent).length,
        slotOverflow: Math.max(0, nearCanopies.filter((nc) => nc.active && nc.kind === 'lobe' && !nc.persistent).length - NEAR_CANOPY_SLOTS),
        farthestShownM: nearCanopies.filter((nc) => nc.shown).reduce((m, nc) => Math.max(m, Math.round(nc.dist * 10) / 10), 0),
        /** triangles drawn for the shown parts against the far triangles they fold away (≈ 5 per far lamina, 2 per card) */
        shownTriangles: nearCanopies.filter((nc) => nc.shown).reduce((n, nc) => n + nc.triangles, 0),
        /** parts inside their swap-in radius whose near buffers are not resident yet — the crown a walker sees pop in when its build lands (owner 2026-09-23 20:08) */
        late: nearCanopies.filter((nc) => nc.dist < nc.inM && !nearCanopyPool.isResident(nc.item)).length,
        foldedTriangles: nearCanopies.filter((nc) => nc.shown && !nc.persistent).reduce((n, nc) => n + nc.farLeaves * 5 + nc.farCards * 2, 0),
      },
      maxBaseGap: Math.round(maxBaseGap * 1e4) / 1e4,
      basesChecked: allBases.length,
      /** ctx.shared.lanternLimb: the lantern tree's built limb path for structures to wrap */
      lanternLimbPublished: lanternLimbAudit !== undefined,
      lanternLimbSamples: lanternLimbAudit?.samples ?? 0,
      lanternLimbRange: lanternLimbAudit ? lanternLimbAudit.range.map((v) => Math.round(v * 1e4) / 1e4) : null,
      /** world centre(0) and centre(1): LAYOUT.lanternBranch from / to by contract (mm) */
      lanternLimbEnds: lanternLimbAudit?.ends ?? null,
      /** realised from→to ring offsets vs the straight authored axis, metres: [min, max] */
      lanternLimbOffsets: lanternLimbAudit
        ? { side: lanternLimbAudit.side.map((v) => Math.round(v * 1e4) / 1e4), vertical: lanternLimbAudit.vertical.map((v) => Math.round(v * 1e4) / 1e4) }
        : null,
      /** every published ring as [s, x, y, z, radius] (world, mm) — project them to check the wrap */
      lanternLimbRings: lanternLimbAudit?.rings ?? null,
      /** ctx.shared.trunkSeats: every seated column's and giant's bole as built, for structures */
      trunkSeatsPublished: trunkSeats.length,
      /** one row per seat: [id, x, z, baseY, r0 = radiusAt(0), rBare = radiusAt(bareHeight), bareHeight] (world, mm) */
      trunkSeats: trunkSeats.map((s) => {
        const mm = (v: number) => Math.round(v * 1e3) / 1e3;
        return [s.id, mm(s.x), mm(s.z), mm(s.y), mm(s.radiusAt(0)), mm(s.radiusAt(s.bareHeight)), mm(s.bareHeight)];
      }),
      triangles: { wood: woodTriangles, leaves: leafTriangles, canopyCards: giantCards * 2, distant: distantTriangles },
      /** per-frame submission after culling (see CULL_PAD_M): what the current camera actually draws */
      submission: submission(),
      samplePositions: { bases: sampleBases },
    };
  });
  // Round 51 (the tab at 3.6 GB — see releaseAfterUpload): the trees' static geometry keeps
  // ≈ 0.5 GB of typed arrays in the renderer process after the GPU has them, and every static mesh
  // is drawn from the first frame at any view. Every geometry under this system drops its CPU
  // copies on upload; a bounding sphere three would otherwise compute from the array later is
  // computed here, while the array is still there (the InstancedMesh culls read it each fill).
  const compacted = new Set<BufferGeometry>();
  group.traverse((o) => {
    const g = (o as Mesh).geometry as BufferGeometry | undefined;
    if (!(o as Mesh).isMesh || !g) return;
    // round 54: the near-canopy batch keeps its Float32 layout and its CPU copies (three copies new parts into them)
    if ((o as BatchedMesh).isBatchedMesh) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!compacted.has(g)) {
      compacted.add(g);
      compactAttributes(g);
    }
    releaseAfterUpload(g);
  });
  ctx.progress('trees', 1);

  let prebuilt = false;
  return {
    name: 'trees',
    group,
    update(_dt, _t, c) {
      rebucket(c.camera);
      if (!prebuilt) {
        prebuilt = true;
        const t0 = performance.now();
        nearBasePool.work(NEAR_LOD_PREBUILD_MS);
        nearCanopyPool.work(Math.max(0.5, NEAR_LOD_PREBUILD_MS - (performance.now() - t0)));
        return;
      }
      // the near parts' pending builds, within the frame budget (the canopy first: its parts are
      // the many; the bases take what is left, at least a chunk's worth so they never starve)
      const t0 = performance.now();
      nearCanopyPool.work(NEAR_LOD_BUILD_BUDGET_MS);
      nearCanopyBatch?.trim();
      columnNearCanopyBatch?.trim();
      nearBasePool.work(Math.max(0.5, NEAR_LOD_BUILD_BUDGET_MS - (performance.now() - t0)));
    },
    onCameraMove(camera) {
      // an explicit re-pose (capture harness, viewpoint keys) re-buckets whatever the distance moved
      rebucket(camera, true);
    },
    perf() {
      // the near parts' bytes by distance from the last update's camera (what a cap must hold at
      // each radius: the swap-in radius is the floor, the pre-fetch radius the full demand)
      const within = (radii: number[], parts: { dist: number; item?: PoolItem<GeometryBuilt> }[]) =>
        Object.fromEntries(radii.map((r) => [r, parts.reduce((n, p) => n + (p.item && p.dist < r ? p.item.bytes : 0), 0)]));
      const [canopyIn, canopyOut] = NEAR_LOD_TIER.canopySwapM;
      const [baseIn, baseOut] = NEAR_LOD_TIER.baseBand;
      return {
        /** round 48: the near-LOD tier in force and what chose it (NEAR_LOD_TIERS) */
        tier: NEAR_LOD_TIER.name,
        deviceMemoryGB: NEAR_LOD_DEVICE_GB,
        poolBytesCap: { nearCanopy: NEAR_CANOPY_POOL_BYTES, nearBase: NEAR_BASE_POOL_BYTES },
        swapM: { nearCanopy: [canopyIn, canopyOut], nearBase: [baseIn, baseOut] },
        nearCanopyPool: nearCanopyPool.report(),
        nearBasePool: nearBasePool.report(),
        prefetchM: { nearCanopy: NEAR_CANOPY_PREFETCH_M, nearBase: NEAR_BASE_PREFETCH_M },
        buildBudgetMs: NEAR_LOD_BUILD_BUDGET_MS,
        bytesWithinM: { nearCanopy: within([canopyIn, canopyOut, 34, NEAR_CANOPY_PREFETCH_M], nearCanopies), nearBase: within([baseIn, baseOut, NEAR_BASE_PREFETCH_M], nearBoles) },
      };
    },
    dispose() {
      for (const w of whites) for (const l of w.lods) l.geometry.dispose();
      for (const c of seatedColumns) for (const l of c.lods) l.geometry.dispose();
      nearCanopyPool.dispose();
      nearBasePool.dispose();
      for (const g of sectorGeometries) g.dispose();
      for (const g of detachedGeometries) g.dispose();
      for (const s of distantSets) (s.variant.near.dispose(), s.variant.far.dispose());
      // the mid crowns share the far layer's atlas: dispose the material, not the map (once, above)
      midCrown.dispose();
      (distantCrown.map?.dispose(), distantCrown.dispose());
    },
  };
}
