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
 * distance whenever the camera moves > 1.5 m. Giants are merged into three angular sector meshes
 * (aRoot.xyz = each tree's origin keeps per-tree wind/height context). Everything is seated via
 * ctx.terrain.height; randomness only via ctx.rng.
 */
import { BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferAttribute, type Camera, type Material } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { createTreeMaterials } from './materials';
import { createWhiteBarkTree, whiteBarkParams, type TreeAsset, type WhiteBarkParams } from './whitebark';
import { placeWhiteBark, viewProjector, type WhiteBarkPlacement } from './placement';
import { columnParams, createColumnTree, emergentParams, type ColumnParams } from './column';
import { createGiantTree, type CanopyBough, type GiantAsset, type GiantProfile } from './giant';
import type { GiantTreeDef } from '../layout';
import { createDistantVariants, placeDistantTrees, type DepthBand, type DistantPlacement, type DistantVariant } from './distant';
import { TAU, mergeParts, type Detail } from './writer';
import type { ViewGap } from './placement';
import { CANOPY_OPENINGS, CANOPY_OPENING_COLLAR, CANOPY_OPENING_DENSIFY, SHAFT_COLUMNS } from './corridors';
import { tubePathFromRings } from './tubePath';

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
  // Saria's roof: casters on the sun lines of the dome (crown → eaves = east → west along the line)
  {
    giant: 'north-west-near',
    fromY: 12.4,
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
    fromY: 13.2,
    to: [5.6, 18.6, -24.4],
    radius: 0.4,
    lobes: [
      { t: 0.77, center: [1.6, 19.0, -26.8], hR: 3.2, vR: 1.8, density: 4, eye: 0 },
      { t: 0.88, center: [3.6, 19.0, -25.2], hR: 3.2, vR: 1.8, density: 4, eye: 0 },
      { t: 0.96, center: [5.0, 19.0, -24.1], hR: 2.6, vR: 1.8, density: 4, eye: 0 },
    ],
  },
  // the plateau-lip canopy of shot F (round 9): a west bough of the east giant, its two lobes the
  // dark leaf mass the reference shows over the stair top (F x 0.5–0.7, y 0.05–0.2)
  {
    giant: 'east-giant',
    fromY: 9.6,
    to: [17.6, 8.2, -2.4],
    radius: 0.5,
    lobes: [
      { t: 0.8, center: [19.2, 7.8, -1.2], hR: 2.4, vR: 1.3, density: 2, eye: 0 },
      { t: 0.97, center: [17.9, 7.3, -2.5], hR: 2.2, vR: 1.2, density: 2, eye: 0 },
    ],
  },
  // the plaza roof (round 14): the casters that frame shot A's lit plaza box — one bough across
  // the sun, three small dense lobes above it whose shadows land on the strip west of the box
  // ((-1.0, 3.8) and (-1.0, 2.0), the frame's left edge) and on the path mouth north of it
  // ((2.4, -0.8)); the lit box between them is the CANOPY_OPENINGS pool of corridors.ts
  {
    giant: 'lantern-tree',
    fromY: 11.0,
    to: [-9.75, 10.4, -10.7],
    radius: 0.5,
    lobes: [
      { t: 0.25, center: [-13.6, 12.5, -6.0], hR: 0.8, vR: 0.7, density: 3, eye: 0 },
      { t: 0.54, center: [-13.6, 12.5, -7.8], hR: 0.8, vR: 0.7, density: 3, eye: 0 },
      { t: 0.97, center: [-10.2, 12.5, -10.6], hR: 1.2, vR: 1.0, density: 3, eye: 0 },
    ],
  },
  // the flight roof (round 14): two small dense lobes whose shadows are the bands between the
  // hero flight's three sun pools — treads 4 (a ≈ 2.6–5.4 m up the run) and 8 (a ≈ 7.2–9.2 m)
  {
    giant: 'north-west-near',
    fromY: 12.6,
    to: [0.0, 15.6, -16.0],
    radius: 0.45,
    lobes: [
      { t: 0.75, center: [-3.65, 16.0, -13.6], hR: 1.4, vR: 1.1, density: 3, eye: 0 },
      { t: 0.97, center: [1.8, 16.0, -14.5], hR: 1.1, vR: 1.0, density: 3, eye: 0 },
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
/** radius of the pavement / stairs / structure probe ring around a seat (m) */
const COLUMN_SEAT_RING = 1.6;
const COLUMN_SEATS: { x: number; z: number; variant: number; ring?: number }[] = [
  { x: -3.5, z: -24.7, variant: 3 },
  { x: -5.7, z: -31.9, variant: 1 },
  { x: -1.0, z: -35.5, variant: 2 },
  { x: 8.8, z: -26.9, variant: 3 },
  { x: 21.2, z: 6.8, variant: 0 },
  { x: 24.2, z: 11.0, variant: 2 },
  { x: 15.7, z: 5.2, variant: 3 },
  { x: -2.7, z: -7.9, variant: COLUMN_EMERGENT, ring: 1.0 },
];
const COLUMN_VIEWS = ['A_stairs', 'B_house', 'D_log', 'F_canopy'];
const COLUMN_SWAP = { minDistance: 18, maxDistance: 45, xMin: 0.05, xMax: 0.95, minBaseY: 0.25 };
/** minimum clearance of a column seat from a white-bark / a giant's bark / a house's trunk (m) */
const COLUMN_CLEARANCE = { whiteBark: 2.5, giant: 4, house: 4 };
const _v = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

/** an instanced tree family variant: 3 LOD assets, one InstancedMesh per LOD, its placements */
interface FamilyVariant<P, T extends { x: number; z: number; scale: number }> {
  params: P;
  lods: TreeAsset[];
  meshes: InstancedMesh[];
  placements: T[];
  matrices: Matrix4[];
  counts: number[];
}
type WhiteVariant = FamilyVariant<WhiteBarkParams, WhiteBarkPlacement>;
interface ColumnPlacement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** 'seat' = authored COLUMN_SEATS entry, 'swap' = a mature white-bark built as a column */
  source: 'seat' | 'swap';
}
type ColumnVariant = FamilyVariant<ColumnParams, ColumnPlacement>;

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
  // the plaza lines the white-bark placement keeps its crowns off (see PLAZA_SUN_POINTS; not passed
  // to the giants since round 14)
  const plazaCorridors = PLAZA_SUN_POINTS.map(({ point, radius }) => groundLine(point, radius, 1, 1));
  // canopy openings (see CANOPY_OPENINGS): the sun cylinder over each ground pool, cleared within
  // its height band, and the dense card collar around it (GiantOptions.densify)
  const openingCorridors: WorldCorridor[] = CANOPY_OPENINGS.map((c) => ({
    ...groundLine([c.point[0], 0, c.point[1]], c.radius, c.porosity ?? 0, c.cardPorosity ?? 0, c.band[0]),
    yMax: c.band[1],
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
  // view corridors through screen points of a hero camera (see VIEW_GAP_RAYS): the ray through the
  // point, active from `minDistance` out — a rising ray is capped from below by the height it has
  // there (a falling one from above), which is the same cut since height is monotonic along it
  const rayCorridors: WorldCorridor[] = [];
  for (const gap of VIEW_GAP_RAYS) {
    const view = ctx.layout.viewpoints.find((v) => v.id === gap.viewpoint);
    if (!view) continue;
    const eye = new Vector3(view.position[0], view.position[1], view.position[2]);
    const forward = new Vector3(view.target[0], view.target[1], view.target[2]).sub(eye).normalize();
    const right = new Vector3(-forward.z, 0, forward.x).normalize();
    const up = new Vector3().crossVectors(right, forward);
    const th = Math.tan((view.fov * Math.PI) / 360);
    const dir = forward
      .clone()
      .addScaledVector(right, (gap.screen[0] - 0.5) * 2 * th * (16 / 9))
      .addScaledVector(up, (0.5 - gap.screen[1]) * 2 * th)
      .normalize();
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
  const swappedWhites = whitePlaced.placements.filter((p) => whites[p.variant].params.age === 'mature' && inFarWall(p.x, p.y, p.z));
  const whitePlacements = whitePlaced.placements.filter((p) => !swappedWhites.includes(p));
  const seatFamily = <P, T extends { x: number; y: number; z: number; yaw: number; scale: number }>(variants: FamilyVariant<P, T>[], p: T, variant: number) => {
    const w = variants[variant];
    w.placements.push(p);
    _q.setFromAxisAngle(_v.set(0, 1, 0), p.yaw);
    _s.setScalar(p.scale);
    _p.set(p.x, p.y, p.z);
    w.matrices.push(new Matrix4().compose(_p, _q, _s));
  };
  for (const p of whitePlacements) seatFamily(whites, p, p.variant);
  const familyMeshes = <P, T extends { x: number; z: number; scale: number }>(variants: FamilyVariant<P, T>[], label: string, material: Material, depth: Material, parent: Group) => {
    for (const w of variants) {
      const n = Math.max(1, w.placements.length);
      for (let l = 0; l < DETAILS.length; l++) {
        const mesh = new InstancedMesh(w.lods[l].geometry, material, n);
        mesh.name = `${label}-${(w.params as { seed: string }).seed}-${DETAILS[l]}`;
        mesh.customDepthMaterial = depth;
        // near and mid LODs cast shadows (dappled light on the paths); the far LOD only receives
        mesh.castShadow = l < 2 && ctx.quality.shadows;
        mesh.receiveShadow = true;
        mesh.count = 0;
        mesh.visible = false;
        mesh.userData.kind = label;
        mesh.userData.lodLevel = l;
        w.meshes.push(mesh);
        parent.add(mesh);
      }
    }
  };
  const whiteGroup = new Group();
  whiteGroup.name = 'white-bark';
  familyMeshes(whites, 'whitebark', mats.whiteTree, mats.whiteTreeDepth, whiteGroup);
  group.add(whiteGroup);
  ctx.progress('trees', 0.5);
  await yieldFrame();

  // ------------------------------------------------------------------ column trees
  const giantDefsAll: GiantTreeDef[] = [...ctx.layout.giantTrees, ...EXTRA_GIANTS];
  const columnRng = rng.fork('columns');
  const columns: ColumnVariant[] = [];
  const columnParamSets = [...Array.from({ length: COLUMN_VARIANTS }, (_, i) => columnParams(columnRng, i, COLUMN_VARIANTS)), emergentParams(columnRng)];
  // Finalize deterministic placements before creating terrain-dependent root geometry.
  for (const params of columnParamSets) {
    columns.push({ params, lods: [], meshes: [], placements: [], matrices: [], counts: [0, 0, 0] });
  }
  const seatRng = columnRng.fork('seats');
  const columnSeatsSkipped: { x: number; z: number; reason: string }[] = [];
  const seatBlocked = (x: number, z: number, ring: number): string | null => {
    const probes: [number, number][] = [[x, z]];
    for (let i = 0; i < 6; i++) probes.push([x + Math.cos((i / 6) * TAU) * ring, z + Math.sin((i / 6) * TAU) * ring]);
    for (const [px, pz] of probes) {
      const m = terrain.mask(px, pz);
      if (m.path > 0.3) return 'path';
      if (m.stairs > 0.3) return 'stairs';
      if (m.structure > 0.3) return 'structure';
    }
    if (!terrain.vegetationAllowed(x, z)) return 'no-vegetation';
    if (terrain.slope(x, z) > 0.6) return 'slope';
    for (const h of ctx.layout.houses) if (Math.hypot(x - h.position[0], z - h.position[2]) < h.trunkRadius + COLUMN_CLEARANCE.house) return `house:${h.id}`;
    for (const g of giantDefsAll) if (Math.hypot(x - g.position[0], z - g.position[2]) < g.trunkRadius + COLUMN_CLEARANCE.giant) return `giant:${g.id}`;
    for (const p of whitePlacements) if (Math.hypot(x - p.x, z - p.z) < COLUMN_CLEARANCE.whiteBark) return 'white-bark';
    return null;
  };
  // the swapped white-barks first (their seats are already clear), then the authored seats
  for (const p of swappedWhites) {
    const variant = seatRng.int(0, COLUMN_VARIANTS);
    seatFamily(columns, { x: p.x, y: p.y, z: p.z, yaw: seatRng() * TAU, scale: seatRng.range(0.95, 1.05), source: 'swap' }, variant);
  }
  for (const seat of COLUMN_SEATS) {
    // one yaw and one scale draw per seat whether or not it is built, so a skipped seat never
    // re-rolls the ones after it
    const yaw = seatRng() * TAU;
    const scale = seatRng.range(0.95, 1.05);
    const reason = seatBlocked(seat.x, seat.z, seat.ring ?? COLUMN_SEAT_RING);
    if (reason) {
      columnSeatsSkipped.push({ x: seat.x, z: seat.z, reason });
      continue;
    }
    seatFamily(columns, { x: seat.x, y: terrain.height(seat.x, seat.z), z: seat.z, yaw, scale, source: 'seat' }, seat.variant);
  }
  const columnPlacements = columns.flatMap((c) => c.placements);
  // A variant's flat roots cannot be shared between differently sloped seats. These ten
  // authored/swapped columns get one family per seat; the existing LOD/shadow rules stay intact.
  // Reusing the architecture seed preserves every bole/crown and all downstream random draws.
  const seatedColumns: ColumnVariant[] = [];
  for (const c of columns) for (let i = 0; i < c.placements.length; i++) {
    const p = c.placements[i];
    const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
    const groundAt = (lx: number, lz: number) => (
      terrain.height(p.x + p.scale * (cos * lx + sin * lz), p.z + p.scale * (-sin * lx + cos * lz)) - p.y
    ) / p.scale;
    const lods = DETAILS.map((d) => createColumnTree(c.params, palette, d, groundAt));
    seatedColumns.push({ params: c.params, lods, meshes: [], placements: [p], matrices: [c.matrices[i]], counts: [0, 0, 0] });
    await yieldFrame();
  }
  const columnGroup = new Group();
  columnGroup.name = 'columns';
  familyMeshes(seatedColumns, 'column', mats.giantTree, mats.giantTreeDepth, columnGroup);
  for (const c of seatedColumns) for (const m of c.meshes) {
    const p = c.placements[0];
    m.name += `@${p.x.toFixed(3)},${p.z.toFixed(3)}`;
  }
  group.add(columnGroup);
  ctx.progress('trees', 0.55);
  await yieldFrame();

  // ------------------------------------------------------------------ giants
  const giantGroup = new Group();
  giantGroup.name = 'giants';
  const giants: { def: GiantTreeDef; asset: GiantAsset; origin: Vector3; angle: number }[] = [];
  const contacts: [number, number, number][] = [];
  const giantDefs = giantDefsAll;
  /** what was published as ctx.shared.lanternLimb (audit) */
  let lanternLimbAudit: { samples: number; range: [number, number]; side: [number, number]; vertical: [number, number]; ends: [number[], number[]]; rings: number[][] } | undefined;
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
    });
    // to world space; aRoot.xyz carries the tree origin so the merged shader keeps per-tree context
    for (const g of [asset.geometry, asset.cards]) {
      g.translate(px, gy, pz);
      const root = g.getAttribute('aRoot') as BufferAttribute;
      for (let i = 0; i < root.count; i++) root.setXYZ(i, px, gy, pz);
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

  const bucketFamily = <P, T extends { x: number; z: number; scale: number }>(variants: FamilyVariant<P, T>[], cam: Vector3) => {
    for (const w of variants) {
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
  const bucketWhite = (cam: Vector3) => {
    bucketFamily(whites, cam);
    bucketFamily(seatedColumns, cam);
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
  const columnBases: [number, number, number][] = columnPlacements.map((p) => [p.x, p.y, p.z]);
  const distantBases: [number, number, number][] = distantPlacements.map((p) => [p.x, p.y, p.z]);
  const allBases = [...whiteBases, ...columnBases, ...contacts, ...distantBases];
  let maxBaseGap = 0;
  for (const [x, y, z] of allBases) maxBaseGap = Math.max(maxBaseGap, Math.abs(y - terrain.height(x, z)));
  const sampleBases = (() => {
    const pool = [...whiteBases, ...columnBases, ...contacts];
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
      /** mature white-barks built as dark columns because their bole stood in a hero far wall */
      whiteBarkSwappedToColumns: swappedWhites.length,
      /** column trees (column.ts): the dark boles of the mid-distance forest wall */
      columnTrees: columnPlacements.length,
      columnVariants: columns.length,
      columnHeights: columns.map((c) => Math.round(c.params.height * 10) / 10),
      columnTrunkRadii: columns.map((c) => Math.round(c.params.trunkRadius * 100) / 100),
      columnSeats: columnPlacements.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, p.source]),
      columnSeatsSkipped,
      columnLodInstances,
      columnLeafCount: columnLeaves,
      leafGeometry: 'laminae',
      leafCount: leafCount + columnLeaves + giantLeaves,
      whiteBarkLeafCount: leafCount,
      distantTrees: distantPlacements.length,
      distantLod: [distantNearCount, distantFarCount],
      lodLevels: 3,
      windLayers: mats.windLayers,
      barkTextures: mats.barkTextureSets,
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
      for (const c of seatedColumns) for (const l of c.lods) l.geometry.dispose();
      for (const g of sectorGeometries) g.dispose();
      for (const s of distantSets) (s.variant.near.dispose(), s.variant.far.dispose());
    },
  };
}
