/**
 * Distant trees for the 60–220 m band: hundreds of cheap trees that form layered silhouettes in
 * the haze beyond the detail radius. Two LOD levels, both real geometry:
 *   near/mid — low-poly bent trunk (geometric cords, basal flare, root buttresses) + limbs;
 *   far      — crossed tapering trunk strips (not camera-facing, no photographs).
 * Both carry the same crown: 2–3 crossed vertical cards of the far-crown atlas
 * (leaf-cluster-texture.ts createFarCrownAtlas) in their own material (createDistantCrownMaterial:
 * a spherical normal so the lit rim follows the sun, a darker core, soft alpha, per-instance
 * hue/value jitter, the far layer's slow wind). The geometry is one buffer with two groups —
 * wood (the distant material) and crown (the crown material). Fog does the atmospheric tinting.
 * Placement is seeded, clumped by noise, spaced by a hash grid, and seated on the terrain.
 */
import { BufferGeometry, Color, DoubleSide, MeshStandardMaterial, Vector3, type Texture } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import type { Terrain } from '../terrain/heightfield';
import { WIND_GLSL, type Wind } from '../wind/wind';
import { GeometryWriter, TAU, UP, growthPath, rootButtress, taper, tube } from './writer';
import { consumeTubeDraws } from './bole';
import type { Palette } from './whitebark';
import { createFarCrownAtlas, FAR_CROWN_CELLS, farCrownCellUv, SOLID_UV } from './leaf-cluster-texture';
import { injectTreeLeafWarmth } from './leaf-color';

export type DistantKind = 'broad' | 'slender' | 'mid';

export interface DistantVariant {
  kind: DistantKind;
  near: BufferGeometry;
  far: BufferGeometry;
  height: number;
  nearTriangles: number;
  farTriangles: number;
  /** authored depth bands only — never drawn from the radial 60–215 m pool */
  bandOnly: boolean;
}

export interface DistantPlacement {
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  tint: Color;
}

/**
 * Round 47 (survey-2 #10 / #27, poses w25-stairs-f / w26-stairs-f / w28-plateau-f: the trees
 * beyond the plateau fences and in the ring read as flat pale cardboard — one-tone silhouettes,
 * a disc crown on a pole, hard cut-out edges, no depth between rows, pale bole tops poking
 * through the crowns). The crown of every distant tree, both LODs, is now FAR_CROWN_CARDS crossed
 * vertical cards of one far-crown atlas cell (leaf-cluster-texture.ts: four silhouettes painted
 * as soft leaf clumps), the near LOD adding FAR_CROWN_LOBES smaller crossed pairs off the axis
 * so the outline is not one shape; the lobe cores and the card clusters of rounds 40–46 are gone
 * (the disc crown with them). The cards are drawn by createDistantCrownMaterial below.
 * [near LOD cards, far LOD cards]
 */
export const FAR_CROWN_CARDS: [number, number] = [3, 3];
/** near LOD only: crossed pairs of smaller cards off the axis (a second silhouette layer) */
export const FAR_CROWN_LOBES: [number, number] = [2, 1];
/**
 * a main card's half-width as a share of the crown radius: the silhouette fills FAR_CROWN_FILL
 * of the card (0.76 wide), so 1.4 gives a drawn crown ≈ 2.1 R across — what the round-46 lobes
 * plus their rim cards spanned, so the rows' skyline in D holds
 */
export const FAR_CROWN_CARD_HALF = 1.4;
/**
 * The crown material (createDistantCrownMaterial): the normal is a blend of the card's plane
 * and the direction from the crown's centre (the sphere the cards stand in) — at this share of
 * the sphere — so the side toward the sun lights and the far side falls into shade whatever the
 * card's yaw: the reference's far crowns are lit rims with darker cores.
 */
export const CROWN_SPHERE_MIX = 0.85;
/** albedo multiplier at the crown's core (1 at its shell): the leaf mass in its own shade */
export const CROWN_CORE_DARK = 0.6;
/** share of the sun's direct term added at the lit rim as transmission through the thin shell */
export const CROWN_RIM = 0.6;
/** per-instance jitter of the crown alone: [hue mix cool ↔ warm (0–1), value ±] */
export const CROWN_JITTER: [number, number] = [0.55, 0.14];
/** the cards' alpha test — below it the fringe is blended, so the outline is soft, not a cut-out */
export const CROWN_ALPHA_TEST = 0.3;
export const CROWN_MIP_BIAS = -0.5;
/** the whole-crown sway's stiffness (WIND_GLSL windBranch): the far layer barely moves */
export const CROWN_STIFFNESS = 0.78;
/**
 * Round 47 (item 3, depth between rows): a placement's tint cools toward this colour by
 * DISTANT_DEPTH_COOL[2] × smoothstep(DISTANT_DEPTH_COOL[0], [1], its distance from the clearing's
 * centre, m) — a small blue-grey lift on the rows further back, so they sit behind the nearer row
 * instead of on the same plane. The shared haze does most of it; this is the remainder.
 */
export const DISTANT_DEPTH_COOL: [number, number, number] = [55, 100, 0.25];
export const DISTANT_DEPTH_COOL_COLOR: [number, number, number] = [0.9, 0.96, 1.08];
/**
 * Round 47 (item 2): the bole darkens into the crown — from DISTANT_CROWN_TOP[0] crown radii
 * under the crown's centre to DISTANT_CROWN_TOP[1] above it the bark tone goes to this share of
 * the crown's dark, so no pale stub pokes through the cards (the slender kind's bark is
 * barkWhite × 0.7). Both LODs.
 */
export const DISTANT_CROWN_TOP: [number, number, number] = [0.55, 0.05, 0.85];
/** round 47: ± tone bands along the near LOD bole (a ring's vertex colour; 1.9 rad/m) — bark tiling at 60 m */
export const DISTANT_BOLE_BANDS = 0.09;

/**
 * round 45: the near LOD bole's basal flare — extra radius share at the path's foot …
 * Round 48 (opus-review #01 / #12, poses x-arch-approach / x-arch-tunnel-n / w19–w21: the
 * depth-row boles 10–30 m from a walker "smooth pale truncated cones with a hard base seam, no
 * root flare"): 0.4 → 0.7 at the ground line, falling over 2.0 m (1.42 R at 1 m, 1.26 R at 2 m,
 * 1.09 R at 4 m — a butt, not a cone), sampled on DISTANT_BASE_RINGS extra rings inserted into
 * the lowest sweep segment (no draw: `tube` takes its draws up front) so the flare curves instead
 * of running straight from the skirt ring to the 2.5 m ring. The far LOD's strips are untouched.
 */
export const DISTANT_FLARE = 0.7;
/** … falling off with this e-folding distance (m) along the bole */
export const DISTANT_FLARE_FALL = 2.0;
/**
 * round 48: extra rings written into the near LOD sweep's lowest segment (the butt's curve). Two:
 * a ring is 72 triangles on the 36-sided broad bole, and camera A holds ≈ 80 near-LOD distant
 * trees 30 K triangles under W38's 9.0 M ceiling — five rings (+360 a bole) put A at 8.95 M,
 * two (+144, the whole round +248 a broad bole with the toes) at ≈ 8.935 M.
 */
export const DISTANT_BASE_RINGS = 2;
/**
 * Round 48: the near LOD's root toes (writer.ts rootButtress off their own stream) — [count min,
 * max], length / collar width / collar height as shares of R. Round 47's 5–7 toes at 1.4–2.1 R
 * long and 0.45–0.7 R tall were lost in the grass at 15 m; these run 2.2–3.4 R out of the butt,
 * 0.55–0.85 R tall at the collar, and dive under (DISTANT_TOE_DIVE) so their tips are buried on
 * flat ground and their downhill halves still touch on a bank.
 */
export const DISTANT_TOES: [number, number] = [4, 6];
export const DISTANT_TOE_LENGTH: [number, number] = [2.2, 3.4];
export const DISTANT_TOE_WIDTH: [number, number] = [0.35, 0.55];
export const DISTANT_TOE_HEIGHT: [number, number] = [0.55, 0.85];
/**
 * round 48: the broad near LOD bole's radius at the crown as a share of R (0.25 through round
 * 47: a 1 m bole thinned to 25 cm under its crown — the "truncated cone"). 0.36 is a column;
 * the far LOD's strips already run 0.42–0.62 at the crown, so the 120 m swap matches better.
 */
export const DISTANT_TAPER_TOP = 0.36;
/**
 * Round 48 (#01: "no canopy over them" — the reference's far forest is a dark leaf roof in
 * blue-grey air; ours showed lit pale cards hazed toward the sky): the near LOD carries
 * FAR_CROWN_FLOOR near-horizontal cards under the crown's centre (at DISTANT_CROWN_FLOOR_Y crown
 * radii below it, DISTANT_CROWN_FLOOR_HALF × R across, tilted ≤ 18°) in a dark tint — a walker
 * under the depth rows sees a leaf roof, not a gap between vertical cards. The fixed cameras are
 * pitched down 3–4° and see the far crowns from 51 m+, where a horizontal card is edge-on and in
 * the 86 % veil. Far LOD: none.
 */
export const FAR_CROWN_FLOOR = 2;
/**
 * 2026-09-23 (owner review, looking up in the open north): the slender crowns and the far LOD had
 * no floor, so from under the depth rows their vertical cards were all there was — streaks of
 * planes on edge. One floor card each now; the crown material fades a card seen edge-on
 * (CROWN_EDGE_FADE), so from below a crown is its leaf roof.
 */
export const FAR_CROWN_FLOOR_SLENDER = 1;
export const FAR_CROWN_FLOOR_FAR = 1;
/**
 * The crown material's view fades. From below, a vertical card is not on edge but a tall trapezoid
 * whose side-view silhouette smears up toward the zenith (probe 2026-09-23, u-open-up: hiding the
 * distant group alone removed every streak): the vertical cards fade as the view climbs to them —
 * whole under [0], gone over [1] of the ray's world y (25°–46° of elevation) — and the crown seen
 * from below is its dark floor cards. The floors fade when seen on edge: gone under CROWN_EDGE_FADE[0]
 * of |cos| between ray and plane, whole over [1]. The six fixed frames look at the far forest from
 * within 20° of level, where the vertical cards are untouched and the floors are on edge.
 */
export const CROWN_EDGE_FADE: [number, number] = [0.06, 0.34];
export const CROWN_EDGE_STEEP: [number, number] = [0.42, 0.72];
export const DISTANT_CROWN_FLOOR_Y = 0.42;
export const DISTANT_CROWN_FLOOR_HALF = 1.15;
export const DISTANT_CROWN_FLOOR_TINT = 0.42;
/**
 * Round 48: inside this view distance (m; full at the first, none at the second) the crown
 * material darkens the crown's underside — the lower part of the crown sphere, CROWN_UNDER_DARK at
 * its bottom — and the whole crown by CROWN_NEAR_DARK: the leaf roof seen from below is its own
 * shade, and the lit tone the round-47 cards showed a walker was the top of the crown. Zero at
 * 48 m+: the nearest distant crown to a fixed camera is 51 m off, so the six frames are untouched.
 */
export const CROWN_UNDER_M: [number, number] = [36, 48];
export const CROWN_UNDER_DARK = 0.38;
export const CROWN_NEAR_DARK = 0.72;
/**
 * 2026-09-23 (owner review, looking up in the north hollow and at the west hut): a crown overhead
 * inside the near gate stands 25–35 m up the hollow's air, where a climbing ray's haze reaches its
 * cap in the lit far-wall airlight — the floor card read as a pale beige slab with the quad's
 * straight edge (probe on u-open-up / b-north-west-side: hiding the distant group removes it; the
 * crown albedo × 0.25 leaves it as it was, so it is the haze). Inside the gate, on rays climbing
 * past CROWN_UNDER_FOG_RAY (world y of the view ray, 20°–44°), CROWN_UNDER_FOG_CUT of the haze over
 * a crown is taken back so the leaf roof reads as its own shade against the sky, and a floor card
 * ends in a round leafy edge (alpha falls off over CROWN_FLOOR_ROUND crown radii from the crown's
 * axis). Zero at 48 m+: the six fixed frames see the ring from 51 m out.
 */
export const CROWN_UNDER_FOG_CUT = 0.6;
export const CROWN_UNDER_FOG_RAY: [number, number] = [0.35, 0.7];
export const CROWN_FLOOR_ROUND: [number, number] = [0.9, 1.1];
/**
 * 2026-09-24, fable-cursor's review of the depth veil (§Review notes: "what would pass: the crowns'
 * silhouettes soften or break up … as they recede"). NOT DONE, and here is the measurement that says
 * why, so the next attempt does not start where this one did. At the pinned `u-open-up` pose the
 * outline is indeed the defect and the tone is not — the mean step across a leaf-to-sky boundary is
 * 15.5 % of the range in our frame against 3.4 % in the reference's r_025 and r_026, while our foliage
 * is already at their lightness (0.287 against 0.277 and 0.293).
 *
 * Four alpha-side treatments were built and rendered against it, and each is a measured non-result:
 * remapping the alpha to widen its fringe (15.5 % → 15.6 %), sampling the atlas 1.8 mip levels
 * blurrier with distance (0.05 % of the frame changed at that pose, 0.00 % at the plaza look-up), and
 * fading the lobe cores with distance (byte-identical frames — proof that none of the shapes IS a
 * lobe core). The reason they cannot work: a probe with each crown material marked puts the flat
 * straight-edged shapes on the crown layer at 21-33 m, and inside that layer they are geometry that
 * samples the atlas's OPAQUE patch (`solidUv`, every vertex tagged w ≤ 0 — the lobe cores at 0 and the
 * near LOD's bark at −0.45). Solid alpha has no fringe to soften, no coverage to erode and no mip
 * detail to blur; the outline is the polygon itself. Softening it means the silhouette has to come
 * from leafy cards instead of solid volumes at that range — a change in `createDistantVariants` and
 * `solidUv`, not in this shader.
 */
/**
 * 2026-09-24 (owner review 23:00, `owner-2300-foliage-lookup.png`: "the foliage in the beginning
 * looks great, but when you go outward … something's wrong"): the shade gate above is a distance,
 * and the two treatments it carries are different claims. That a crown is a leaf roof in its own
 * shade is only true when it is genuinely overhead — a crown 30 m off is a mass across the middle
 * distance, and taking it to CROWN_NEAR_DARK × CROWN_UNDER_DARK = 0.27 of its albedo (and giving it
 * 0.6 of its haze back) is what made the band he circled dark hard-edged blobs over a pale wash.
 * The colour treatments move to this tighter window; CROWN_UNDER_M keeps gating the geometry ones
 * (the floor cards' own normal and round edge), which fix a different artefact and still hold out
 * to 48 m.
 */
export const CROWN_SHADE_M: [number, number] = [12, 26];
/**
 * The mist is a ground layer (atmosphere/heightfog.ts, kfAltitudeMean), so a ray that climbs into
 * the canopy meets almost none of it: a leaf mass 25 m up keeps its full local shade and reads as a
 * dark card with a hard edge against the pale sky, while the same leaves seen level at 25 m are half
 * dissolved. That asymmetry is what the owner's look-up shows, and what fable-5 measured (our
 * 14–58 m crowns at saturation 0.15 / lightness 0.29 against the reference's 0.05 / 0.42). Leaves —
 * thin, lit from both sides, the surface that scatters the air's light most — take `share` of the
 * mist's colour over `m` metres on top of whatever the height fog laid, so a crown pales with depth
 * wherever it stands in the sky, the layers separate by value, and the gaps of sky between them stay
 * bright. Laid after `<fog_fragment>` so the deep-forest shade in it (kfShade, which darkens with
 * distance) cannot take it back. The colour mixed toward is `kfColor`, the air colour that chunk
 * computed for this fragment's own ray and distance — the exact hue the pixels around the leaf are
 * painted with, which is what "the leaf takes the air's colour" means. The plain `fogColor` uniform
 * was tried first and moved nothing: `<fog_fragment>` sits after `<colorspace_fragment>`, so
 * gl_FragColor is encoded there while that uniform is linear (≈ 0.22 against the mist's 0.53 on
 * screen), and a leaf at 0.226 mixed toward 0.22 stays where it was — the measured non-result.
 *
 * `ray` is why this is a repair and not a second fog: it is the world y of the view ray, and the
 * veil comes in over it. On a level ray the height fog already dissolves the middle distance (the
 * mid layer at 30 m is half mist in a probe of the plaza looking north), so nothing is added there
 * and a walker's forward view — and the six fixed frames, which look level — keep their air. It is
 * only as the eye climbs out of the mist's layer that the veil replaces what the mist stops giving.
 *
 * `m` is short on purpose. The first ramp tried was the mid layer's own extent (18-62 m) and it
 * moved his look-up by nothing measurable (leaf lightness 0.226 → 0.229, outline hardness 11.5 %
 * → 11.3 %): a canopy overhead is 15-35 m away, so a ramp that reaches half strength at 40 m has
 * barely started where the leaves are. Depth for a look-up is the tree's height, not the forest's.
 *
 * `lift` is the answer to fable-cursor's review of 05:30 (the merge reverted: "at the pinned
 * `u-open-up` pose the depth veil turns the crowns into pale beige flat shapes whose polygon edges
 * read harder than before … a paler card is still a card"). Measured at that pose against the
 * reference frame the review names, the veil's premise does not hold there: our foliage is already at
 * the reference's own level (leaf lightness 0.287 against r_025's 0.277 and r_026's 0.293) — what is
 * wrong is our SKY, 0.672 against their 0.518, so every leaf edge is a maximum-contrast cut-out. A
 * wash cannot tell those apart, so the veil is now a floor: it fades out over `lift` — the fragment's
 * own luminance as a share of the air's, so the test lives in the material's space and not the
 * screen's (an absolute threshold read nothing: the god-ray in-scatter is a post pass, so a leaf at
 * 0.31 on screen is a third of that in the shader) — and lifts only foliage still below the band.
 *
 * And it is laid on the giants' leaf cards ONLY, not on the crown cards. That is the other half of
 * the review: a probe at `u-open-up` marks the pale shapes as the crown layer's near LOD at 21-33 m,
 * while the plaza's gain is the giants' canopy at the same distances. Dense overlapping foliage with
 * depth behind it can take the air's colour; an isolated card cannot, because paling it prints its
 * geometry. The crown cards keep the shade-gate repair and take the dissolve instead.
 */
export const CANOPY_DEPTH_VEIL: { share: number; m: [number, number]; ray: [number, number]; tint: [number, number, number]; lift: [number, number] } = {
  share: 0.42,
  // full at or below the first share of the air's own level, nothing at or above the second
  lift: [0.5, 0.95],
  m: [8, 30],
  ray: [0.05, 0.45],
  // the mist's colour alone veiled the far layers to a dead grey-green (first render at m 10-32; the
  // layers separated but read as dirty haze). His recording's far crowns are pale and WARM — the
  // light in the air over a canopy is sun through leaves, so the veil's colour is the mist warmed.
  tint: [1.08, 1.0, 0.88],
};
/** the veil as a fragment-shader line, for the crown cards and the giants' leaf cards alike */
export function canopyVeilGlsl(veil: { share: number; m: [number, number]; ray?: [number, number]; tint?: [number, number, number]; lift?: [number, number] } = CANOPY_DEPTH_VEIL): string {
  const ray = veil.ray ?? CANOPY_DEPTH_VEIL.ray;
  const tint = veil.tint ?? CANOPY_DEPTH_VEIL.tint;
  const lift = veil.lift ?? CANOPY_DEPTH_VEIL.lift;
  const t = tint.map((c) => c.toFixed(3)).join(', ');
  return /* glsl */ `
    #ifdef USE_FOG
    {
      float veilClimb = smoothstep(${ray[0].toFixed(3)}, ${ray[1].toFixed(3)}, normalize(-vViewPosition * mat3(viewMatrix)).y);
      float veilDepth = smoothstep(${veil.m[0].toFixed(1)}, ${veil.m[1].toFixed(1)}, length(vViewPosition));
      // the floor (CANOPY_DEPTH_VEIL.lift): only foliage still darker than the air takes the veil,
      // measured as a share of the air's own level so the test holds in the material's space
      const vec3 veilW = vec3(0.2126, 0.7152, 0.0722);
      float veilLift = 1.0 - smoothstep(${lift[0].toFixed(3)}, ${lift[1].toFixed(3)}, dot(gl_FragColor.rgb, veilW) / max(1e-4, dot(kfColor, veilW)));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, kfColor * vec3(${t}), ${veil.share.toFixed(3)} * veilClimb * veilDepth * veilLift);
    }
    #endif
  `;
}
/**
 * Round 48: the near LOD's toes DIVE — their local ground falls this much per metre out from the
 * axis, so a toe's tip is buried 0.3–0.45 m on flat ground and the toe reads as a root going
 * under, and on a bank of slope ≤ 0.1 the downhill toe still touches instead of floating (the
 * instance stands on the axis ground: the rubric's base-gap check, systems.trees.maxBaseGap
 * ≤ 0.03, reads the placement's y against the terrain there). The uphill toes bury, as before.
 */
export const DISTANT_TOE_DIVE = 0.1;
/**
 * Round 46 (survey-2 check 04, poses w19-spine-r / sn-arch-outside: the depth rows' boles
 * 8–14 m from a walker were still smooth grey cones — round 45's tone bands and cords are albedo
 * alone on a bole whose base tone is 0.04 linear, so under the veil a ±40 % band is 7 sRGB levels,
 * and a 10-sided prism has no flank to catch the sun). The near LOD bole now carries GEOMETRIC
 * longitudinal cords: [furrows around a broad bole, around a slender, furrow depth as a share
 * of the radius] — straight furrows (no lean, so the per-side grain the sweep already writes
 * carries the same field as a crevice shade, aligned with the geometry exactly), narrow troughs
 * between flat plates, a second set at N + 3 for irregularity. Near LOD only: the far LOD's
 * crossed quads are untouched and every fixed camera is ≥ 38 m from a depth row.
 */
export const DISTANT_CORDS: [number, number, number] = [9, 5, 0.09];
/**
 * Round 46, measured (trees-29 probe at w19-spine-r, dist-1: the cords above in the geometry,
 * ring radii 1.10–1.46 m on a 1.26 m bole, the furrow shade in the vertex colours — and the frame
 * unchanged, |Δ| 1.2 / 255): the near LOD's wood vertex colours are 0.01–0.03 LINEAR (the far
 * tint: a depth row is a dark column against the haze at 40 m+). A 2 % albedo reflects nothing a
 * walker can see at 10 m — the visible cone is the veil plus the sky's specular on a black
 * surface, uniform whatever the geometry or the vertex shade does. So the broad kind's near LOD
 * bark (the bole, its limbs and roots — not the lobe cores, which stay the canopy's dark; the
 * slender kind is barkWhite × 0.7 ≈ 0.48 linear already and takes no gain) is written at
 * this gain over the far tint, and the distant material divides it back out where its near
 * blend (materials.ts DISTANT_BARK_M) is zero: at 38 m+ every vertex is the colour it was, the
 * hero frames exactly (the nearest near-LOD tree to a fixed camera is 51 m off); inside 22 m the
 * bole is real bark at 4 × 0.02–0.06 = 0.08–0.24 linear, the giants' shaded bark range, and the
 * geometric cords, the furrow shade, the foot grime and the tone bands finally have light to show
 * in. Tagged in aRoot.w (writer.ts woodMoss = 1 → −0.45; the distant material reads nothing else
 * from the moss code).
 */
export const DISTANT_NEAR_GAIN = 4;
/**
 * round 46: the near LOD bole's sides [broad, slender] (10 / 7 through round 45) — 4 / 3 per
 * furrow. Survey-2 crop 03 (pose w09-spine-l, "buttress flares as faceted low-poly cones with a
 * hard straight base"): the probe put a depth row's near-LOD bole foot under that wedge (depth
 * 55–71 m, distant-tree candidates only) — a 10-gon's flared foot, 36° a facet, pale in the haze.
 */
export const DISTANT_SIDES: [number, number] = [36, 15];
/**
 * round 46: the near LOD bole's foot grime in the vertex colour — × this at the ground line,
 * the bark's own tone by the second ring (≈ 4 m) — a soil-dark root fillet at every range the
 * near LOD is drawn (round 45's shader grime is zero past 38 m, and w09-spine-l's wedge stands
 * at 55–71 m). The far LOD's quads are untouched.
 */
export const DISTANT_FOOT_GRIME = 0.6;
/** round 46: vertex-colour multiplier at a furrow's floor (1 at the plates' crests) */
export const DISTANT_FURROW_SHADE = 0.42;
/** round 46: the near LOD root buttresses' arc sides (6 through round 45: 30° facets read as a low-poly cone from a walker) */
export const DISTANT_ROOT_ARC = 10;

/**
 * the cord field of a near LOD bole: the radius multiplier at `angle` — 1 on the plates, 1 − depth
 * at a furrow's floor. Angle-only (see DISTANT_CORDS).
 */
export function distantCord(angle: number, count: number, depth: number, phase: number): number {
  const primary = Math.pow(0.5 - 0.5 * Math.cos(angle * count + phase), 1.7);
  const secondary = Math.pow(0.5 - 0.5 * Math.cos(angle * (count + 3) + phase * 2.3 + 1.1), 2.4);
  return 1 - depth * Math.min(1, primary + 0.45 * secondary);
}
/** round 45 (item 4): a near-LOD limb's length as a share of the crown radius (0.6–1.0 through round 44: past the lobe shells) */
export const LIMB_REACH: [number, number] = [0.45, 0.75];
/**
 * how far a limb is tinted from the bark toward the crown's dark (0 = bark throughout), over
 * LIMB_TINT_FROM..LIMB_TINT_TO of its length (bark at the bole, the crown's own dark from
 * halfway: from under the crown the limbs show against the sky over their whole length,
 * w19-spine-u — the first take at 0.35–1.0 left the inner half a pale plank)
 */
export const LIMB_TIP_TINT = 0.8;
export const LIMB_TINT_FROM = 0.08;
export const LIMB_TINT_TO = 0.5;

/**
 * One vertical crown card: a quad in the plane of `dir` × UP centred at `c`, mapped onto atlas
 * cell `cell` (mirrored in u when `mirror`). aRoot carries the crown's centre (local) and radius
 * for the crown material's spherical shading — its w is the radius (> 0.5 on every crown, so the
 * distant material's solid-uv pass and every wood decode leave these vertices alone).
 */
function crownCard(writer: GeometryWriter, c: Vector3, dir: Vector3, half: number, cell: number, mirror: boolean, bottom: Color, top: Color, sphereC: Vector3, sphereR: number, stiffness: number, phase: number, vAxis: Vector3 = UP) {
  const uv = farCrownCellUv(cell);
  const n = new Vector3().crossVectors(dir, vAxis).normalize();
  const V = (du: number, dv: number) => {
    const p = c.clone().addScaledVector(dir, du * half).addScaledVector(vAxis, dv * half);
    const u = (mirror ? -du : du) > 0 ? uv.u1 : uv.u0;
    const v = dv > 0 ? uv.v1 : uv.v0;
    const i = writer.vertexN(p, n, dv > 0 ? top : bottom, u, v, stiffness, phase, 0, 1);
    writer.roots[i * 4] = sphereC.x;
    writer.roots[i * 4 + 1] = sphereC.y;
    writer.roots[i * 4 + 2] = sphereC.z;
    writer.roots[i * 4 + 3] = sphereR;
    return i;
  };
  const a = V(-1, -1);
  const b = V(1, -1);
  const cc = V(1, 1);
  const d = V(-1, 1);
  writer.triangle(a, b, cc);
  writer.triangle(a, cc, d);
}

/**
 * The crown of a distant tree (round 47): `count` main cards crossed at equal yaw steps (each a
 * different cell of `cells`, so one crown shows two or three silhouettes as it is walked round)
 * and `lobes` crossed pairs of smaller cards off the axis. Every card shades in the one sphere
 * (centre, R) so the crown lights as a single volume. Own stream: nothing before or after it
 * re-rolls.
 */
function crownCards(writer: GeometryWriter, r: Rng, centre: Vector3, R: number, cells: number[], count: number, lobes: number, tint: Color, topTint: Color, floor = 0) {
  const half = R * FAR_CROWN_CARD_HALF;
  const yaw0 = r.range(0, TAU);
  for (let k = 0; k < count; k++) {
    const a = yaw0 + (k / count) * Math.PI + r.range(-0.12, 0.12);
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const s = r.range(0.92, 1.08);
    const c = centre.clone().add(new Vector3(r.range(-0.06, 0.06) * R, r.range(-0.05, 0.05) * R, r.range(-0.06, 0.06) * R));
    const shade = r.range(0.9, 1.06);
    crownCard(writer, c, dir, half * s, cells[k % cells.length], r.chance(0.5), tint.clone().multiplyScalar(shade * 0.82), topTint.clone().multiplyScalar(shade), centre, R * 1.05, 0.9, r());
  }
  for (let l = 0; l < lobes; l++) {
    const a = yaw0 + (l / Math.max(1, lobes)) * TAU + r.range(0.4, 1.2);
    const off = R * r.range(0.4, 0.55);
    const c = centre.clone().add(new Vector3(Math.cos(a) * off, R * r.range(-0.2, 0.15), Math.sin(a) * off));
    const lr = R * r.range(0.5, 0.62);
    const cell = cells[r.int(0, cells.length)];
    const shade = r.range(0.88, 1.04);
    const yaw = r.range(0, TAU);
    for (let k = 0; k < 2; k++) {
      const b = yaw + k * Math.PI * 0.5;
      const dir = new Vector3(Math.cos(b), 0, Math.sin(b));
      crownCard(writer, c, dir, lr * FAR_CROWN_CARD_HALF, cell, r.chance(0.5), tint.clone().multiplyScalar(shade * 0.82), topTint.clone().multiplyScalar(shade), centre, R * 1.05, 0.85, r());
    }
  }
  // round 48 (FAR_CROWN_FLOOR): the leaf roof's underside — near-horizontal cards under the
  // crown's centre in a dark tint, from their own fork so the cards above draw what they did
  if (floor > 0) {
    const rf = r.fork('crown-floor');
    for (let f = 0; f < floor; f++) {
      const a = rf.range(0, TAU);
      const tilt = rf.range(0.12, 0.32);
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new Vector3(-dir.z, 0, dir.x);
      // the card's second axis leans off the horizontal about `dir`, so the two floors are not one plane
      const vAxis = side.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt) * (rf.chance(0.5) ? 1 : -1)).normalize();
      const c = centre.clone().add(new Vector3(rf.range(-0.15, 0.15) * R, -R * DISTANT_CROWN_FLOOR_Y * rf.range(0.85, 1.15), rf.range(-0.15, 0.15) * R));
      const dark = tint.clone().multiplyScalar(DISTANT_CROWN_FLOOR_TINT * rf.range(0.9, 1.1));
      crownCard(writer, c, dir, R * DISTANT_CROWN_FLOOR_HALF * rf.range(0.9, 1.1), cells[f % cells.length], rf.chance(0.5), dark, dark.clone().multiplyScalar(1.15), centre, R * 1.05, 0.9, rf(), vAxis);
    }
  }
}

/**
 * Per-material overrides of the crown look (2026-09-23): the 60–220 m layer keeps the constants
 * above, the mid-canopy layer (14–58 m, `MID_CROWN_LOOK`) needs the near-distance treatments off —
 * they were authored for a FAR crown that a walker only ever meets overhead in the north hollow,
 * and applied to a crown 12 m away they darken it by CROWN_NEAR_DARK and fade its vertical cards
 * out as soon as the view ray climbs 30° to it (CROWN_EDGE_STEEP), which is exactly how a walker
 * looks at a 12 m tree. `atlas` shares the far layer's texture (a second 1024² atlas is 4 MB of
 * GPU for four silhouettes we already have).
 */
export interface CrownLook {
  /** suffix of the material name and of the program cache key */
  id: string;
  atlas?: Texture;
  /** the near gate [full, none] (m) inside which a crown reads as a leaf roof from below */
  underM?: [number, number];
  /** whole-crown / underside albedo inside the gate */
  nearDark?: number;
  underDark?: number;
  /** vertical cards fade as the view ray's world y climbs over this range */
  edgeSteep?: [number, number];
  /**
   * …and that fade only applies to crowns within this view distance [full, none] (m). Unset = every
   * distance, which is what the 60–220 m layer wants. The mid layer needs the fade — a vertical card
   * seen from below is a tall trapezoid that smears toward the zenith — but ONLY when the crown is
   * genuinely overhead: at 15 m a 12 m tree's crown already sits 30° up, inside the far layer's fade
   * window, and that is simply a walker looking at a tree.
   */
  edgeSteepNearM?: [number, number];
  /** share of the haze over a crown given back on a climbing ray inside the gate */
  fogCut?: number;
  /** the colour treatments' window (m); unset = `underM`, so a look tuned before CROWN_SHADE_M is unchanged */
  shadeM?: [number, number];
  /** the depth veil for this layer (see CANOPY_DEPTH_VEIL) */
  veil?: { share: number; m: [number, number]; ray?: [number, number] };
  /** albedo at the crown's core (1 at its shell) */
  coreDark?: number;
  /** floor cards always end in the crown's round edge (the far layer only rounds them inside its near gate) */
  roundFloors?: boolean;
  /** share of the sun's direct term added at the lit rim as transmission */
  rim?: number;
}

/**
 * The crown cards' material (round 47). A standard material over the far-crown atlas with:
 *   • a spherical normal — the card's plane blended toward the direction from the crown's centre
 *     (aRoot.xyz, radius aRoot.w) at CROWN_SPHERE_MIX, so the sun lights the side that faces it
 *     and the far side shades, whatever the instance's yaw or the card's plane;
 *   • a darker core (CROWN_CORE_DARK at the centre, the map's tone at the shell) and the sun
 *     through the thin shell at the lit rim (CROWN_RIM of the direct term);
 *   • soft alpha: the test at CROWN_ALPHA_TEST, the fringe under it blended (depth still written
 *     by the core), so the outline is never a cut-out at any mip;
 *   • per-instance hue / value jitter from the instance's position (CROWN_JITTER);
 *   • the far layer's wind: one slow whole-crown sway from the crown's centre (WIND_GLSL
 *     windBranch at CROWN_STIFFNESS) plus a lighter per-card flex — the six fixed captures are at
 *     one simulation time, so identical run to run.
 * The instance colour (the placement's tint) multiplies as it does for the wood.
 * `look` overrides the near-distance treatments for the mid-canopy layer (see CrownLook); with it
 * omitted the shader source and the cache key are exactly what round 48 compiled.
 */
export function createDistantCrownMaterial(wind: Wind, rng: Rng, palette: Palette, sunDir: Vector3, look?: CrownLook): MeshStandardMaterial {
  const atlas: Texture = look?.atlas ?? createFarCrownAtlas(rng, palette);
  const underM = look?.underM ?? CROWN_UNDER_M;
  // the colour treatments' own window (CROWN_SHADE_M); a look that sets only underM keeps both on it
  const shadeM = look?.shadeM ?? look?.underM ?? CROWN_SHADE_M;
  const nearDark = look?.nearDark ?? CROWN_NEAR_DARK;
  const underDark = look?.underDark ?? CROWN_UNDER_DARK;
  const edgeSteep = look?.edgeSteep ?? CROWN_EDGE_STEEP;
  const fogCut = look?.fogCut ?? CROWN_UNDER_FOG_CUT;
  const coreDark = look?.coreDark ?? CROWN_CORE_DARK;
  const rimShare = look?.rim ?? CROWN_RIM;
  const material = new MeshStandardMaterial({ map: atlas, alphaTest: CROWN_ALPHA_TEST, transparent: true, depthWrite: true, vertexColors: true, roughness: 1, metalness: 0, side: DoubleSide });
  material.name = look ? `distant-crown-${look.id}` : 'distant-crown';
  const f = (x: number) => x.toFixed(3);
  material.onBeforeCompile = (s) => {
    s.uniforms.uCrownSun = { value: sunDir.clone().normalize() };
    s.vertexShader =
      WIND_GLSL +
      'attribute vec3 aWind;\nattribute vec4 aRoot;\nvarying vec3 vCrownOff;\nvarying vec2 vCrownJit;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
    {
      vec4 crownC = vec4(aRoot.xyz, 1.0);
      vec4 crownP = vec4(transformed, 1.0);
      float crownS = 1.0;
      #ifdef USE_INSTANCING
        crownC = instanceMatrix * crownC;
        crownP = instanceMatrix * crownP;
        crownS = length(instanceMatrix[0].xyz);
      #endif
      crownC = modelMatrix * crownC;
      crownP = modelMatrix * crownP;
      vec3 disp = windBranch(crownC.xyz, aRoot.y * crownS, ${f(CROWN_STIFFNESS)});
      disp += windBranch(crownP.xyz + vec3(aWind.y * 41.0, aWind.y * 7.0, aWind.y * 23.0), aRoot.y * crownS * 0.35, aWind.x);
      #ifdef USE_INSTANCING
        mat3 im = mat3(instanceMatrix);
        transformed += (transpose(im) * disp) / dot(im[0], im[0]);
      #else
        transformed += disp;
      #endif
      vCrownOff = (crownP.xyz - crownC.xyz) / max(0.1, aRoot.w * crownS);
      vec2 seed = crownC.xz;
      vCrownJit = vec2(fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453), fract(sin(dot(seed, vec2(39.3468, 11.135))) * 24634.6345));
    }
    `,
      );
    s.fragmentShader =
      'uniform vec3 uCrownSun;\nvarying vec3 vCrownOff;\nvarying vec2 vCrownJit;\nfloat crownSunLit = 0.0;\n' +
      s.fragmentShader
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
    #ifdef USE_MAP
      diffuseColor *= texture2D(map, vMapUv, ${f(CROWN_MIP_BIAS)});
    #endif
    `,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
    {
      float rr = clamp(length(vCrownOff), 0.0, 1.5);
      vec3 hue = mix(vec3(1.08, 1.0, 0.86), vec3(0.9, 1.0, 1.14), vCrownJit.x);
      diffuseColor.rgb *= mix(vec3(1.0), hue, ${f(CROWN_JITTER[0])}) * (1.0 + (vCrownJit.y - 0.5) * ${f(2 * CROWN_JITTER[1])});
      diffuseColor.rgb *= mix(${f(coreDark)}, 1.0, smoothstep(0.1, 0.95, rr));
      // round 48 (CROWN_UNDER_M): within the near gate the crown is a leaf roof seen from below —
      // its lower half in its own shade, the whole mass a step darker; on CROWN_SHADE_M, so only a
      // crown genuinely overhead takes it (the geometry terms below keep the wider gate)
      float roofNear = 1.0 - smoothstep(${f(underM[0])}, ${f(underM[1])}, length(vViewPosition));
      float shadeNear = 1.0 - smoothstep(${f(shadeM[0])}, ${f(shadeM[1])}, length(vViewPosition));
      if (shadeNear > 0.0) {
        vec3 sw = normalize(vCrownOff * vec3(1.0, 0.8, 1.0) + vec3(0.0, 0.32, 0.0));
        float underside = smoothstep(0.3, -0.45, sw.y);
        diffuseColor.rgb *= mix(1.0, ${f(nearDark)} * mix(1.0, ${f(underDark)}, underside), shadeNear);
      }
      // CROWN_EDGE_STEEP / CROWN_EDGE_FADE: vertical cards fade as the view climbs to them, floors
      // fade on edge — from below a crown is its leaf roof, from the side its crossed silhouettes
      vec3 rayW = normalize(-vViewPosition * mat3(viewMatrix));
      vec3 cardW = normalize(vNormal * mat3(viewMatrix));
      float edgeOn = abs(dot(normalize(vViewPosition), normalize(vNormal)));
      float flatCard = smoothstep(0.7, 0.9, abs(cardW.y));
      float steepNear = ${look?.edgeSteepNearM ? `1.0 - smoothstep(${f(look.edgeSteepNearM[0])}, ${f(look.edgeSteepNearM[1])}, length(vViewPosition))` : '1.0'};
      float steepFade = 1.0 - steepNear * smoothstep(${f(edgeSteep[0])}, ${f(edgeSteep[1])}, rayW.y);
      diffuseColor.a *= mix(steepFade, smoothstep(${f(CROWN_EDGE_FADE[0])}, ${f(CROWN_EDGE_FADE[1])}, edgeOn), flatCard);
      // CROWN_FLOOR_ROUND: inside the gate a floor card ends in the crown's round edge, not its quad's
      diffuseColor.a *= 1.0 - max(roofNear, ${f(look?.roundFloors ? 1 : 0)}) * flatCard * smoothstep(${f(CROWN_FLOOR_ROUND[0])}, ${f(CROWN_FLOOR_ROUND[1])}, length(vCrownOff.xz));
    }
    `,
        )
        .replace(
          '#include <fog_fragment>',
          /* glsl */ `vec3 crownPreFog = gl_FragColor.rgb;
    #include <fog_fragment>
    {
      // CROWN_UNDER_FOG_CUT: a crown overhead inside the shade gate keeps part of its own shade
      float roofNearF = 1.0 - smoothstep(${f(shadeM[0])}, ${f(shadeM[1])}, length(vViewPosition));
      float climbF = smoothstep(${f(CROWN_UNDER_FOG_RAY[0])}, ${f(CROWN_UNDER_FOG_RAY[1])}, normalize(-vViewPosition * mat3(viewMatrix)).y);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, crownPreFog, roofNearF * climbF * ${f(fogCut)});
    }
    `,
        )
        .replace(
          '#include <normal_fragment_begin>',
          /* glsl */ `#include <normal_fragment_begin>
    {
      vec3 sphereW = normalize(vCrownOff * vec3(1.0, 0.8, 1.0) + vec3(0.0, 0.32, 0.0));
      vec3 sphereV = normalize(mat3(viewMatrix) * sphereW);
      // CROWN_FLOOR_OWN_NORMAL: inside the gate a floor card seen from below keeps its own normal —
      // bent to the sphere (horizontal under the crown's centre) it met the view at a grazing angle
      // and took the sky's Fresnel sheen, a pale slab whatever its albedo or the haze did
      float floorOwn = smoothstep(0.7, 0.9, abs(normalize(vNormal * mat3(viewMatrix)).y))
        * (1.0 - smoothstep(${f(underM[0])}, ${f(underM[1])}, length(vViewPosition)))
        * smoothstep(0.1, 0.3, normalize(-vViewPosition * mat3(viewMatrix)).y);
      normal = normalize(mix(normal, sphereV, ${f(CROWN_SPHERE_MIX)} * (1.0 - floorOwn)));
      crownSunLit = max(0.0, dot(sphereW, uCrownSun));
    }
    `,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
    #if NUM_DIR_LIGHTS > 0
    {
      float rr = clamp(length(vCrownOff), 0.0, 1.5);
      float rim = smoothstep(0.5, 1.05, rr) * crownSunLit;
      totalEmissiveRadiance += directionalLights[0].color * diffuseColor.rgb * rim * ${f(rimShare)};
    }
    #endif
    `,
        );
    injectTreeLeafWarmth(s);
  };
  material.customProgramCacheKey = () => `trees-distant-crown-v6-under-fog-floor-normal-leaf-warmth${look ? `-${look.id}` : ''}`;
  wind.bind(material);
  return material;
}

/** solid (non-card) vertices of a geometry sharing the cluster-card material sample the opaque patch */
function solidUv(writer: GeometryWriter) {
  for (let i = 0; i < writer.roots.length / 4; i++) {
    // every wood vertex (w ≤ 0): the lobe cores at 0 and the near LOD's tagged bark at −0.45
    if (writer.roots[i * 4 + 3] <= 0) {
      writer.uvs[i * 2] = SOLID_UV;
      writer.uvs[i * 2 + 1] = SOLID_UV;
    }
  }
}

export function createDistantVariants(rng: Rng, palette: Palette): DistantVariant[] {
  const variants: DistantVariant[] = [];
  const specs: { kind: DistantKind; height: number; bandOnly?: boolean; radius?: number; taperTop?: number }[] = [
    { kind: 'broad', height: 19 },
    { kind: 'broad', height: 23 },
    { kind: 'broad', height: 27 },
    { kind: 'slender', height: 11 },
    { kind: 'slender', height: 14 },
    // round 31: a tall pale pole for the mid-distance "far trunk" row (trees index.ts
    // DEPTH_BANDS): a 1.9 m bole thinning to 0.65 m — the giants here are 2.2–4.4 m thick, and
    // frame 56 s's far trunks read 1.5–2 m at 25–40 m — with its small crown 18 m+ up, so at
    // 35–45 m only the trunk is in frame, the way the reference's far trunks run out of the top
    // of D and B. Five 1.4 m poles measured ≈ 1.4 % of frame D in their 2.5 m depth bucket
    // (a layer is 1.5 %); at 1.9 m the row measures 2.3 %. Band-only, so the radial layer's
    // variant picks (slenderIdx) are unchanged.
    { kind: 'slender', height: 26, bandOnly: true, radius: 0.95, taperTop: 0.35 },
  ];
  // darker than the near trees: the far layer is silhouette against haze, the fog lightens it
  const canopy = new Color(palette.leafCanopy).multiplyScalar(0.48);
  // card vertex colours are tints over the far-crown atlas's own greens
  const cardTint = new Color(0.62, 0.66, 0.6);
  const cardTopTint = new Color(0.9, 0.95, 0.72);
  // each broad variant leads with its own silhouette and crosses it with the other two; the
  // slender kinds take the columnar cell
  const broadCells = [
    [0, 2, 1],
    [1, 0, 2],
    [2, 1, 0],
  ];
  specs.forEach((spec, index) => {
    const r = rng.fork(`distant-${index}`);
    const H = spec.height;
    const slender = spec.kind === 'slender';
    // 2026-09-23 (owner, marked screenshot: "a smooth pale cylinder" left of the north path — the
    // pick named this far-trunk row at 37–48 m): the band-only pole was pale white-bark for the old
    // frame 56 s; his recording's far trunks are dark boles in bright mist, so it takes the broad
    // kind's dark bark, near gain and tag. The radial slender trees stay pale (distant white-barks).
    const pale = slender && !spec.bandOnly;
    const R = spec.radius ?? (slender ? H * 0.014 : H * 0.05);
    const bark = pale ? new Color(palette.barkWhite).multiplyScalar(0.7) : new Color(palette.barkDark).multiplyScalar(0.85);
    const crownY = slender ? H * 0.68 : H * 0.66;
    const crownR = slender ? H * 0.2 : H * 0.42;

    // ---- near LOD ----
    const near = new GeometryWriter('high');
    const lean = Math.tan((r.range(1.5, 6) * Math.PI) / 180) * crownY;
    const az = r.range(0, TAU);
    const trunk = growthPath(new Vector3(0, -0.6, 0), new Vector3(Math.cos(az) * lean, crownY + crownR * 0.3, Math.sin(az) * lean), UP, r, 6, 0.3);
    // round 44 (survey #2, crops 04/05: a depth row's bole 10–20 m from a walker was a 7-sided
    // prism): 10 / 7 sides. The sweep's draws are taken as the 7 / 5-sided one took them (phase,
    // wind phase, one grain per old side) and the grain resampled over the new sides, so the
    // limbs and lobes after it draw exactly what they did — the rows' silhouettes in D hold.
    const oldSides = slender ? 5 : 7;
    const sides = slender ? DISTANT_SIDES[1] : DISTANT_SIDES[0];
    const trunkDraws = consumeTubeDraws(r, oldSides);
    // round 46 (DISTANT_CORDS): the resampled per-side grain also carries the furrow shade —
    // the cord field is angle-only, so this is exactly the crevice under each vertex
    const cordCount = slender ? DISTANT_CORDS[1] : DISTANT_CORDS[0];
    const cordPhase = rng.fork(`distant-cords-${index}`)() * TAU;
    trunkDraws.grain = Array.from({ length: sides }, (_, j) => {
      const angle = (j / sides) * TAU;
      const furrow = (1 - distantCord(angle, cordCount, DISTANT_CORDS[2], cordPhase)) / DISTANT_CORDS[2];
      return trunkDraws.grain[Math.floor((j / sides) * oldSides)] * (1 - (1 - DISTANT_FURROW_SHADE) * furrow);
    });
    // round 45 (trees-27's leftover, w19-spine-r / sn-arch-outside: the depth rows' boles 15–30 m
    // from a walker were straight pale cylinders): a basal flare on the near LOD — the radius
    // × (1 + DISTANT_FLARE e^(−d / DISTANT_FLARE_FALL)) along the bole, 1.27 R at the ground line
    // (the path starts 0.6 m under it), 1.1 R at 2 m — through the tube's bump hook (no draws),
    // so every draw after it is what it was. Near LOD only (drawn to 120 m, index.ts
    // distantNear): the nearest near-LOD distant tree to a fixed camera is 51 m off (the radial
    // pool from A; the depth rows 52 m+ from D), where 0.4 R on a 1 m bole is under a pixel at
    // the gauntlet's 256 × 144 — measured cap-5 → cap-11: D −0.0001, A −0.0001.
    // round 46: × the cord field (DISTANT_CORDS) — the furrows are real relief now, 36 / 15 sides
    // (DISTANT_SIDES) so each has a floor and two flanks the sun can tell apart
    const flare = (angle: number, distance: number) => (1 + DISTANT_FLARE * Math.exp(-distance / DISTANT_FLARE_FALL)) * distantCord(angle, cordCount, DISTANT_CORDS[2], cordPhase);
    // the bark parts at DISTANT_NEAR_GAIN over the far tint, tagged for the material to divide out
    // at range (see the constant); the lobe cores below are written untagged at the far tint
    // the pale slender kind is pale already (barkWhite × 0.7 ≈ 0.48 linear): no gain, untagged
    const gain = pale ? 1 : DISTANT_NEAR_GAIN;
    const nearBark = bark.clone().multiplyScalar(gain);
    const footGrime = nearBark.clone().multiplyScalar(DISTANT_FOOT_GRIME);
    // the crown's dark the limbs run to and the bole darkens into (round 47 DISTANT_CROWN_TOP)
    const limbTip = canopy.clone().multiplyScalar(0.6 * gain);
    // round 47: the bole's rings darken into the crown (no pale stub through the cards) and carry
    // ± DISTANT_BOLE_BANDS tone bands below it (the tree's own phase, own stream: no draw moves)
    const bandPhase = rng.fork(`distant-bands-${index}`)() * TAU;
    const boleColor = (pt: Vector3, t: number, base: Color, top: Color, foot: Color) => {
      if (t === 0) return foot;
      const into = smoothstep(crownY - crownR * DISTANT_CROWN_TOP[0], crownY + crownR * DISTANT_CROWN_TOP[1], pt.y);
      const band = 1 + DISTANT_BOLE_BANDS * Math.sin(pt.y * 1.9 + bandPhase) * (1 - into);
      // round 48: the foot grime runs up the butt by height (the near LOD's inserted base rings
      // sample it); every ring at 2.5 m+ — the far LOD's second ring included — is `base` as before
      return foot.clone().lerp(base, smoothstep(-0.6, 2.5, pt.y)).multiplyScalar(band).lerp(top, into * DISTANT_CROWN_TOP[2]);
    };
    near.woodMoss = pale ? 0 : 1;
    // round 48: the sweep runs on `trunk` with DISTANT_BASE_RINGS rings interpolated into its
    // lowest segment (the butt's curve; no draw — the limbs below still attach to `trunk`'s own
    // points), its radii by arc-length share so the inserted rings sit on the same taper curve;
    // the broad kind thins to DISTANT_TAPER_TOP R under the crown (a column, not a cone)
    const topR = R * (spec.taperTop ?? (slender ? 0.25 : DISTANT_TAPER_TOP));
    const sweep: Vector3[] = [trunk[0].clone()];
    for (let k = 1; k <= DISTANT_BASE_RINGS; k++) sweep.push(trunk[0].clone().lerp(trunk[1], k / (DISTANT_BASE_RINGS + 1)));
    for (let k = 1; k < trunk.length; k++) sweep.push(trunk[k].clone());
    const arc: number[] = [0];
    for (let k = 1; k < sweep.length; k++) arc.push(arc[k - 1] + sweep[k].distanceTo(sweep[k - 1]));
    const sweepRadii = arc.map((s) => topR + (R - topR) * Math.pow(1 - s / arc[arc.length - 1], 0.9));
    // the ring colour by height (boleColor reads pt.y; the skirt ring alone takes the foot grime)
    tube(near, sweep, sweepRadii, sides, r, { color: (pt, t) => boleColor(pt, t, nearBark, limbTip, footGrime), roughness: 0.1, flatBase: true, structural: true, stiffness: () => 1, draws: trunkDraws, bump: flare });
    const limbs = slender ? 1 : r.int(2, 4);
    // round 45 (trees-28 item 4, survey pose w19-spine-u: the "pale twig tips spiking the crown
    // rim" straight overhead on the north spine are a depth-row tree's limbs — 4-sided bark-
    // coloured tubes 0.3–0.5 m thick running to 0.6–1.0 crown radii, past the lobe shells, pale
    // planks against the sky from under them): the limbs end inside the lobes (LIMB_REACH), are
    // 6-sided with their draws taken as the 4-sided ones took them (the grain resampled, like the
    // trunk above, so the lobes and the far LOD after them draw exactly what they did), and run
    // from the bark at the bole to the crown's own dark from halfway out (LIMB_TIP_TINT).
    for (let i = 0; i < limbs; i++) {
      const t = r.range(0.45, 0.75);
      const o = trunk[Math.round(t * (trunk.length - 1))].clone();
      const a = az + (i / limbs) * TAU + r.range(-0.4, 0.4);
      const len = crownR * r.range(LIMB_REACH[0], LIMB_REACH[1]);
      const target = o.clone().add(new Vector3(Math.cos(a) * len, len * r.range(0.25, 0.6), Math.sin(a) * len));
      const path = growthPath(o, target, UP, r, 4, 0.5);
      const limbDraws = consumeTubeDraws(r, 4);
      limbDraws.grain = Array.from({ length: 6 }, (_, j) => limbDraws.grain[Math.floor((j / 6) * 4)]);
      const limbLength = Math.max(0.5, o.distanceTo(target));
      tube(near, path, taper(path, R * 0.45, 0.05, 0.9), 6, r, { color: (pt) => nearBark.clone().lerp(limbTip, smoothstep(LIMB_TINT_FROM, LIMB_TINT_TO, pt.distanceTo(o) / limbLength) * LIMB_TIP_TINT), roughness: 0.05, structural: true, stiffness: () => 1, draws: limbDraws });
    }
    near.woodMoss = 0;
    // (round 47: the lobe cores and card clusters that stood here are replaced by the crown cards
    // written after the roots — see crownCards; the disc crown of survey crop 27 went with them)
    // round 44 (survey #2: "no base flare, a hard base seam"): a root flare — 4–6 short buttress
    // roots (writer.ts rootButtress) diving under the ground from the foot of the bole, from
    // their own stream so nothing above re-rolls; the depth rows' feet are at the ground line of
    // D at 47 m+ where a 0.5 m root is 5 px in the haze
    const rootRng = rng.fork(`distant-roots-${index}`);
    // round 48: the toes carry the foot grime (they meet the soil) — the bark × 0.86 through round 47
    const rootColor = nearBark.clone().multiplyScalar(0.72);
    // round 48 (DISTANT_TOES): 4–6 toes, 2.2–3.4 R long, 0.55–0.85 R tall at the collar; 8 segments
    // along so the fillet into the ground curves. The slender kind keeps its four short roots.
    const rootCount = slender ? 4 : rootRng.int(DISTANT_TOES[0], DISTANT_TOES[1] + 1);
    near.woodMoss = pale ? 0 : 1;
    for (let i = 0; i < rootCount; i++) {
      const a = (i / rootCount) * TAU + rootRng.range(-0.3, 0.3);
      // round 46: DISTANT_ROOT_ARC arc sides and a fillet into the ground (writer.ts RootButtressShape)
      if (slender) rootButtress(near, a, R * rootRng.range(1.4, 2.1), R * rootRng.range(0.3, 0.45), R * rootRng.range(0.45, 0.7), rootColor, rootRng, () => 0, new Vector3(0, 0, 0), 6, { arcSides: DISTANT_ROOT_ARC, fillet: 0.6 });
      else rootButtress(near, a, R * rootRng.range(DISTANT_TOE_LENGTH[0], DISTANT_TOE_LENGTH[1]), R * rootRng.range(DISTANT_TOE_WIDTH[0], DISTANT_TOE_WIDTH[1]), R * rootRng.range(DISTANT_TOE_HEIGHT[0], DISTANT_TOE_HEIGHT[1]), rootColor, rootRng, (x, z) => -DISTANT_TOE_DIVE * Math.hypot(x, z), new Vector3(0, 0, 0), 8, { arcSides: DISTANT_ROOT_ARC, fillet: 0.7 });
    }
    near.woodMoss = 0;
    solidUv(near);
    // ---- the crown (round 47): crossed atlas cards over the wood, in the geometry's second group
    const nearWood = near.indices.length;
    const crownCentre = new Vector3(0, crownY + crownR * 0.1, 0);
    const cells = slender ? [3] : broadCells[index % broadCells.length];
    // round 48: + FAR_CROWN_FLOOR dark near-horizontal cards under the broad crowns (their own fork inside crownCards)
    crownCards(near, rng.fork(`distant-crown-${index}`), crownCentre, crownR, cells, FAR_CROWN_CARDS[0], slender ? FAR_CROWN_LOBES[1] : FAR_CROWN_LOBES[0], cardTint, cardTopTint, slender ? FAR_CROWN_FLOOR_SLENDER : FAR_CROWN_FLOOR);

    // ---- far LOD: two crossed tapering trunk strips (foot grime, tone bands, darkening into the
    // crown — round 47; the round-40 silhouette fans and their rim cards are replaced by the same
    // crown cards the near LOD carries, so the two LODs never swap silhouettes) ----
    const far = new GeometryWriter('high');
    const farTop = canopy.clone().multiplyScalar(0.6);
    const farFoot = bark.clone().multiplyScalar(DISTANT_FOOT_GRIME);
    // Round 48 (opus-review #07, x-clearing-stones / w21-spine-l: "opaque sky-blue rectangles with
    // hard edges among the far crowns"): the rectangles are these strips. Past 120 m every surface
    // wears the veil at its cap (heightfog maxFog 0.86) in the far haze's blue-grey, and the strips
    // ran to crownY + 0.15 crownR at 0.42–0.62 R wide — a flat-topped plank 1.2–1.7 m across and
    // 3–5 m tall standing in the crown's ragged lower rim, where the near LOD's bole is 0.36 R
    // (DISTANT_TAPER_TOP: 2.5× narrower) at the LOD swap. The strips now end at the crown's
    // centre height, inside the dense part of the painted silhouette, at the near bole's own top
    // radius, and their upper ring sits ABOVE the 0.52 H ring (the broad kinds' crownY − 0.35 crownR
    // was under it, so the strip folded back on itself).
    const farTopW = spec.taperTop ?? (slender ? 0.25 : DISTANT_TAPER_TOP);
    const farRings: [number, number][] = [
      [-0.6, 1.1],
      [H * 0.28, 0.96],
      [H * 0.52, 0.8],
      [Math.max(H * 0.52 + 0.5, crownY - crownR * 0.35), 0.5 + 0.35 * farTopW],
      [crownY, farTopW],
    ];
    for (let plane = 0; plane < 2; plane++) {
      const a = (plane / 2) * Math.PI;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      let prev: [number, number] | null = null;
      farRings.forEach(([y, w], k) => {
        const c = boleColor(new Vector3(0, y, 0), k / (farRings.length - 1), bark, farTop, farFoot);
        const l = far.vertex(new Vector3().addScaledVector(dir, -R * w).setY(y), c, 0, k, 1, 0, 0);
        const rr = far.vertex(new Vector3().addScaledVector(dir, R * w).setY(y), c, 1, k, 1, 0, 0);
        if (prev) {
          far.triangle(prev[0], prev[1], rr);
          far.triangle(prev[0], rr, l);
        }
        prev = [l, rr];
      });
    }
    solidUv(far);
    const farWood = far.indices.length;
    // the same stream as the near LOD's main cards: the far LOD's crown is the near one's without its lobes, so the switch at 120 m never turns a crown
    crownCards(far, rng.fork(`distant-crown-${index}`), crownCentre, crownR, cells, FAR_CROWN_CARDS[1], 0, cardTint, cardTopTint, FAR_CROWN_FLOOR_FAR);

    const nearGeometry = near.finish(`distant-near-${index}`);
    nearGeometry.addGroup(0, nearWood, 0);
    nearGeometry.addGroup(nearWood, near.indices.length - nearWood, 1);
    const farGeometry = far.finish(`distant-far-${index}`);
    farGeometry.addGroup(0, farWood, 0);
    farGeometry.addGroup(farWood, far.indices.length - farWood, 1);
    variants.push({
      kind: spec.kind,
      near: nearGeometry,
      far: farGeometry,
      height: H,
      nearTriangles: near.triangles,
      farTriangles: far.triangles,
      bandOnly: spec.bandOnly ?? false,
    });
  });
  return variants;
}

/**
 * A dense row of silhouettes filling a narrow depth range (a "depth layer" behind a landmark):
 * jittered grid over [xMin, xMax] × [zMin, zMax], broad variants only (unless `kind` says
 * otherwise), darker tint.
 */
export interface DepthBand {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  spacing: number;
  scale: [number, number];
  /** brightness multiplier (< 1 = darker silhouette under the haze) */
  shade: number;
  /** only broad variants up to this unscaled height are used (keeps a row's skyline low) */
  maxVariantHeight?: number;
  /** variant kind for the row (default 'broad'); 'slender' rows may use band-only variants */
  kind?: DistantKind;
  /** only variants at least this tall (unscaled) */
  minVariantHeight?: number;
  /** round 51: discs no tree of the row stands in (authored trees the row would otherwise pierce) */
  avoid?: { x: number; z: number; r: number }[];
  /**
   * round 51: place the row AFTER the radial pool. A row placed before it seeds the spacing grid,
   * and a radial candidate the grid rejects is skipped before its draws and before it counts
   * toward the target — so a new row inside the 60–215 m annulus re-rolled every radial tree
   * after its first collision (camera C's whole far background moved for a stand 130 m behind
   * it). An `after` row yields to the radial trees instead: the pool's stream is untouched and the
   * row's own candidates drop where a radial tree already stands.
   */
  after?: boolean;
  /**
   * own PRNG stream for the row's jitter / picks / tints; without it the row draws from the
   * shared 'distant-placement' stream and every later placement (the other bands, the radial
   * layer) moves when the row is added or edited
   */
  stream?: string;
}

/**
 * Ground a distant tree may not stand on (round 45, structures-28's ray pick: a depth-row trunk
 * 5 m off the path spine, inside the log arch's west root mass, dead on the arch's north sight
 * line). `spine` is a polyline (xz) every instance keeps `spineClearance` metres off; an instance
 * drawn closer is slid out along the perpendicular to `spineClearance + 0.5` (the depth rows fill
 * a hero frame's far layer, so a tree is moved, not dropped, when the ground there allows it).
 * `footprints` are oriented boxes (a hollow log's body) nothing may stand in. Applied AFTER every
 * random draw of the candidate, so every other placement — the other rows, the radial layer — is
 * exactly what it was without the rule.
 */
export interface DistantClearance {
  spine: [number, number][];
  spineClearance: number;
  footprints: { x: number; z: number; ax: number; az: number; halfLength: number; halfWidth: number }[];
}

function pointSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { d: number; nx: number; nz: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const l2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / l2));
  const qx = ax + abx * t;
  const qz = az + abz * t;
  const dx = px - qx;
  const dz = pz - qz;
  const d = Math.hypot(dx, dz);
  return d > 1e-6 ? { d, nx: dx / d, nz: dz / d } : { d, nx: -abz / Math.sqrt(l2), nz: abx / Math.sqrt(l2) };
}

/** nearest point of the clearance spine: distance and the unit vector away from it */
function spineOffset(spine: [number, number][], x: number, z: number): { d: number; nx: number; nz: number } {
  let best = { d: Infinity, nx: 1, nz: 0 };
  for (let i = 0; i + 1 < spine.length; i++) {
    const s = pointSegment(x, z, spine[i][0], spine[i][1], spine[i + 1][0], spine[i + 1][1]);
    if (s.d < best.d) best = s;
  }
  return best;
}

const DEPTH_COOL_COLOR = new Color(...DISTANT_DEPTH_COOL_COLOR);
/** round 47 (DISTANT_DEPTH_COOL): a placement's tint, cooled by its distance from the clearing's centre — no draw */
function depthCool(tint: Color, x: number, z: number): Color {
  const cool = smoothstep(DISTANT_DEPTH_COOL[0], DISTANT_DEPTH_COOL[1], Math.hypot(x, z)) * DISTANT_DEPTH_COOL[2];
  // toward a blue-grey of the tint's own value lifted a little: cooler and nearer the haze
  return cool > 0 ? tint.lerp(DEPTH_COOL_COLOR.clone().multiplyScalar(((tint.r + tint.g + tint.b) / 3) * 1.08), cool) : tint;
}

function inFootprint(f: DistantClearance['footprints'][number], x: number, z: number): boolean {
  const rx = x - f.x;
  const rz = z - f.z;
  const along = rx * f.ax + rz * f.az;
  const across = -rx * f.az + rz * f.ax;
  return Math.abs(along) <= f.halfLength && Math.abs(across) <= f.halfWidth;
}

export function placeDistantTrees(rng: Rng, terrain: Terrain, variants: DistantVariant[], target: number, inner = 60, outer = 215, bands: DepthBand[] = [], clearance?: DistantClearance): DistantPlacement[] {
  const r = rng.fork('distant-placement');
  const clump = new Noise2D('distant-clumps');
  const out: DistantPlacement[] = [];
  const cell = 6;
  const grid = new Map<string, DistantPlacement[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const push = (p: DistantPlacement) => {
    out.push(p);
    const k = key(p.x, p.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(p);
  };
  /** a candidate that has drawn everything: keep as is, slide off the spine, or drop (null) */
  let moved = 0;
  let dropped = 0;
  const cleared = (p: DistantPlacement, minD: number): DistantPlacement | null => {
    if (!clearance) return p;
    const spine = spineOffset(clearance.spine, p.x, p.z);
    const inside = (x: number, z: number) => clearance.footprints.some((f) => inFootprint(f, x, z));
    if (spine.d < clearance.spineClearance || inside(p.x, p.z)) {
      // slide out along the perpendicular: to the clearance ring first, then a metre at a time
      // (≤ 8 m) until the point is out of every footprint too
      for (let push = Math.max(0, clearance.spineClearance + 0.5 - spine.d); push <= clearance.spineClearance + 8.5; push += 1) {
        const x = p.x + spine.nx * push;
        const z = p.z + spine.nz * push;
        if (inside(x, z)) continue;
        const m = terrain.mask(x, z);
        if (m.structure > 0.4 || m.path > 0.4 || terrain.slope(x, z) > 0.72 || tooCloseIn(grid, cell, x, z, minD)) break;
        moved++;
        return { ...p, x, z, y: terrain.height(x, z) };
      }
      dropped++;
      return null;
    }
    return p;
  };
  const broadOnly = variants.map((v, i) => (v.kind === 'broad' && !v.bandOnly ? i : -1)).filter((i) => i >= 0);
  /** the authored rows: those placed before the radial pool seed its spacing grid, `after` rows yield to it */
  const placeBands = (after: boolean) => {
    for (const band of bands) {
      if ((band.after ?? false) !== after) continue;
      const kind = band.kind ?? 'broad';
      const pool = variants
        .map((v, i) => (v.kind === kind && (band.maxVariantHeight === undefined || v.height <= band.maxVariantHeight) && (band.minVariantHeight === undefined || v.height >= band.minVariantHeight) ? i : -1))
        .filter((i) => i >= 0);
      const bandPool = pool.length ? pool : broadOnly;
      const rb = band.stream ? rng.fork(band.stream) : r;
      const nx = Math.max(1, Math.round((band.xMax - band.xMin) / band.spacing));
      const nz = Math.max(1, Math.round((band.zMax - band.zMin) / band.spacing));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const x = band.xMin + ((i + 0.5 + rb.range(-0.4, 0.4)) / nx) * (band.xMax - band.xMin);
          const z = band.zMin + ((j + 0.5 + rb.range(-0.4, 0.4)) / nz) * (band.zMax - band.zMin);
          const m = terrain.mask(x, z);
          if (m.structure > 0.4 || m.path > 0.4 || terrain.slope(x, z) > 0.72) continue;
          if (tooCloseIn(grid, cell, x, z, band.spacing * 0.6)) continue;
          if (band.avoid && band.avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
          const tintShift = rb.range(-0.05, 0.05);
          const tint = depthCool(new Color(1 + tintShift * 0.5, 1 + tintShift, 1 - tintShift * 0.6).multiplyScalar(band.shade * rb.range(0.9, 1.05)), x, z);
          const p = cleared({ variant: bandPool[rb.int(0, bandPool.length)], x, y: terrain.height(x, z), z, yaw: rb() * TAU, scale: rb.range(band.scale[0], band.scale[1]), tint }, band.spacing * 0.6);
          if (p) push(p);
        }
      }
    }
  };
  placeBands(false);
  const tooClose = (x: number, z: number, minD: number) => tooCloseIn(grid, cell, x, z, minD);
  const broadIdx = broadOnly;
  const slenderIdx = variants.map((v, i) => (v.kind === 'slender' && !v.bandOnly ? i : -1)).filter((i) => i >= 0);
  let attempts = 0;
  // a radial candidate the clearance drops still counts toward the target: the loop then ends on
  // the same draw it always did and no later tree appears to replace it
  let placed = 0;
  while (placed < target && attempts < target * 40) {
    attempts++;
    const a = r() * TAU;
    // area-uniform radius in the annulus, slightly biased inward so the near band is dense
    const u = r();
    const rad = Math.sqrt(inner * inner + (outer * outer - inner * inner) * Math.pow(u, 1.15));
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const density = 0.35 + 0.65 * (clump.fbm(x * 0.02, z * 0.02, 3) * 0.5 + 0.5);
    if (r() > density) continue;
    const m = terrain.mask(x, z);
    if (m.structure > 0.4 || m.path > 0.4 || terrain.slope(x, z) > 0.72) continue;
    const slender = r() < 0.22;
    const minD = slender ? 4.5 : 7.5;
    if (tooClose(x, z, minD)) continue;
    const variant = slender ? slenderIdx[r.int(0, slenderIdx.length)] : broadIdx[r.int(0, broadIdx.length)];
    const tintShift = r.range(-0.06, 0.06);
    const tint = depthCool(new Color(1 + tintShift * 0.5, 1 + tintShift, 1 - tintShift * 0.6).multiplyScalar(r.range(0.82, 1.08)), x, z);
    const p = cleared({ variant, x, y: terrain.height(x, z), z, yaw: r() * TAU, scale: r.range(0.8, 1.28), tint }, minD);
    placed++;
    if (p) push(p);
  }
  placeBands(true);
  lastClearanceTally = { moved, dropped };
  return out;
}

let lastClearanceTally = { moved: 0, dropped: 0 };
/** how many placements the last `placeDistantTrees` clearance slid off the spine / dropped (audit) */
export function distantClearanceTally(): { moved: number; dropped: number } {
  return { ...lastClearanceTally };
}

function tooCloseIn(grid: Map<string, DistantPlacement[]>, cell: number, x: number, z: number, minD: number): boolean {
  const cx = Math.floor(x / cell);
  const cz = Math.floor(z / cell);
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const list = grid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const p of list) if (Math.hypot(p.x - x, p.z - z) < minD) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ mid-canopy trees (14–58 m) */

/*
 * 2026-09-23 — the owner's "the trees do not populate". The 14–58 m band held only the giants'
 * boles, the pale white-barks and the authored column trunks: at his pose on the north path the
 * middle distance is a trench of bare trunks in grey haze, while his own recording
 * (reference/frames-dense/review46/r_020–r_028) stacks SMALL AND MEDIUM trees with round leafy
 * crowns at every depth between the big trunks, their crowns overlapping into layers.
 *
 * This is that layer: the same two-LOD machinery as the 60–220 m trees (the same wood material, the
 * same far-crown atlas, the same instanced pools) at understory size, with the crown centred at
 * about half the height so a walker meets LEAVES and not a bare pole at 10–30 m, and the crown built
 * as a core plus two tiers of lobes so its silhouette is a round mass with bumps rather than one
 * crossed shape. Their crowns are drawn with their own material (MID_CROWN_LOOK): the far layer's
 * near-distance treatments exist because a far crown is only ever met close overhead, and at 12 m
 * they would darken the mass and fade its vertical cards out.
 */

/**
 * The variants, short to tall: height (m), then crown radius and crown centre as shares of it. A
 * card is drawn 2 × FAR_CROWN_CARD_HALF × FAR_CROWN_FILL[0] ≈ 2.13 crown radii across, so these
 * radii give a crown 0.62–0.89 of the tree's height wide: a 7.7 m mass on an 11.6 m tree, what a
 * mid-story tree in review46 r_025 reads as, and proportionally wider on the short ones, which are
 * bushy young trees. (0.4 on every variant drew 16 m blobs that swallowed the frame at 15 m.) The
 * two SHORT variants fill a walker's eye-level band: a 5 m sapling clump 25 m out sits at screen
 * y ≈ 0.45 with a 2 m crown, in the strip between the ground cover and the taller crowns where
 * review46 has young trees and ours had open haze.
 */
export const MID_SPECS: { height: number; crownR: number; crownY: number }[] = [
  { height: 4.8, crownR: 0.42, crownY: 0.54 },
  { height: 6.6, crownR: 0.38, crownY: 0.55 },
  { height: 9.0, crownR: 0.34, crownY: 0.56 },
  { height: 11.6, crownR: 0.31, crownY: 0.57 },
  { height: 14.6, crownR: 0.29, crownY: 0.59 },
];
export const MID_HEIGHTS = MID_SPECS.map((s) => s.height);
/** the crown radius / centre a placement's crown sphere is measured with (the mid of the set) */
export const MID_CROWN_Y = 0.56;
export const MID_CROWN_R = 0.3;
export const MID_TRUNK_R = 0.031;
/** the bole's sides and its longitudinal cords [furrows around, depth share] — read at 10–40 m, not at 2 m */
export const MID_SIDES = 12;
export const MID_CORDS: [number, number] = [7, 0.1];
/** crossed cards through the crown's axis, crossed lobe pairs around it, dark floor cards under it */
export const MID_CROWN_CARDS = 3;
export const MID_CROWN_LOBES = 6;
export const MID_CROWN_FLOORS = 2;
/** lobe radius and offset as shares of the crown radius: [upper tier, lower tier] */
export const MID_LOBE_R: [number, number] = [0.46, 0.58];
export const MID_LOBE_OFF: [number, number] = [0.4, 0.6];
/** root toes at the foot of the bole (writer.ts rootButtress), both LODs */
export const MID_TOES = 3;
/** the far LOD (the same skeleton, 5-sided, and the same crown) takes over at this view distance (m) */
export const MID_FAR_LOD_M = 40;
/** the crown material's overrides for the mid layer (see CrownLook) */
export const MID_CROWN_LOOK: Omit<CrownLook, 'atlas'> = {
  id: 'mid',
  // the far layer's gate is 36–48 m and takes a crown inside it to CROWN_NEAR_DARK × CROWN_UNDER_DARK
  // = 0.27 of its albedo: right for a crown met overhead in the hollow, far too dark for the mass a
  // walker sees across the middle distance. A gentler gate over 10–30 m keeps the underside reading
  // as shade without crushing the tree.
  underM: [10, 30],
  // and the colour half of it tighter still (owner 23:00, the look-up): past 20 m a mid crown is a
  // mass across the middle distance, not a roof over the walker
  shadeM: [8, 34],
  nearDark: 0.92,
  underDark: 0.6,
  // the far layer fades a vertical card once the view ray climbs 25–46° to it, at any distance — at
  // 15 m a 12 m tree's crown is already 30° up, so that window would empty the middle distance the
  // moment the owner looked slightly up. The fade is kept (a vertical card seen from below smears
  // toward the zenith) but only 33–58° and only within 16 m, where the crown really is overhead and
  // its two floor cards are what should read.
  edgeSteep: [0.55, 0.85],
  edgeSteepNearM: [10, 16],
  // a mid crown stands in a tenth of the far layer's haze, so it needs far less of it back
  fogCut: 0.3,
  // the lit rim: 0.6 of the direct term burnt a card's whole edge to an acid green on a crown in
  // open sun at 15 m; 0.3 lost the lit top the reference's mid crowns read by (band mean 74.8 → 74.3,
  // across-column sd 18.9 → 15.4 at the owner's pose — see art/environment/squad2-2026-09-23)
  rim: 0.38,
  roundFloors: true,
  // the mid layer stands in 13.7–58 m (placeMidTrees), so its veil is that band: a crown at the far
  // edge of it is nearly mist, which is what puts light and depth between the layers he looked through
  veil: { share: 0.55, m: [12, 40], ray: [0.05, 0.4] },
};

/**
 * A mid crown: `MID_CROWN_CARDS` crossed cards through the axis (the main silhouette), then
 * `MID_CROWN_LOBES` crossed pairs alternating between an upper tier (inboard, lit) and a lower one
 * (wider, in the mass's own shade), then `MID_CROWN_FLOORS` dark near-horizontal cards under the
 * centre. Every card shades in the one sphere, so the whole reads as a lit volume. Own stream.
 */
function midCrownCards(writer: GeometryWriter, r: Rng, centre: Vector3, R: number, cells: number[], tint: Color, topTint: Color) {
  const card = (c: Vector3, dir: Vector3, half: number, cell: number, shade: number, stiffness: number, vAxis?: Vector3) =>
    crownCard(writer, c, dir, half, cell, r.chance(0.5), tint.clone().multiplyScalar(shade * 0.8), topTint.clone().multiplyScalar(shade), centre, R * 1.05, stiffness, r(), vAxis ?? UP);
  const yaw0 = r.range(0, TAU);
  for (let k = 0; k < MID_CROWN_CARDS; k++) {
    const a = yaw0 + (k / MID_CROWN_CARDS) * Math.PI + r.range(-0.14, 0.14);
    const c = centre.clone().add(new Vector3(r.range(-0.07, 0.07) * R, r.range(-0.06, 0.06) * R, r.range(-0.07, 0.07) * R));
    card(c, new Vector3(Math.cos(a), 0, Math.sin(a)), R * FAR_CROWN_CARD_HALF * r.range(0.94, 1.06), cells[k % cells.length], r.range(0.92, 1.05), 0.86);
  }
  for (let l = 0; l < MID_CROWN_LOBES; l++) {
    const upper = l % 2 === 0;
    const a = yaw0 + (l / MID_CROWN_LOBES) * TAU + r.range(-0.3, 0.3);
    const off = R * (upper ? MID_LOBE_OFF[0] : MID_LOBE_OFF[1]) * r.range(0.85, 1.12);
    const lr = R * (upper ? MID_LOBE_R[0] : MID_LOBE_R[1]) * r.range(0.86, 1.1);
    const c = centre.clone().add(new Vector3(Math.cos(a) * off, R * (upper ? r.range(0.16, 0.42) : r.range(-0.4, -0.06)), Math.sin(a) * off));
    const shade = upper ? r.range(1.0, 1.12) : r.range(0.74, 0.9);
    const yaw = r.range(0, TAU);
    for (let k = 0; k < 2; k++) {
      const b = yaw + k * Math.PI * 0.5;
      card(c, new Vector3(Math.cos(b), 0, Math.sin(b)), lr * FAR_CROWN_CARD_HALF, cells[(l + 1) % cells.length], shade, 0.8);
    }
  }
  const rf = r.fork('mid-crown-floor');
  for (let fl = 0; fl < MID_CROWN_FLOORS; fl++) {
    const a = rf.range(0, TAU);
    const tilt = rf.range(0.1, 0.3);
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new Vector3(-dir.z, 0, dir.x);
    const vAxis = side.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt) * (rf.chance(0.5) ? 1 : -1)).normalize();
    const c = centre.clone().add(new Vector3(rf.range(-0.15, 0.15) * R, -R * DISTANT_CROWN_FLOOR_Y * rf.range(0.85, 1.15), rf.range(-0.15, 0.15) * R));
    const dark = tint.clone().multiplyScalar(DISTANT_CROWN_FLOOR_TINT * rf.range(0.95, 1.15));
    crownCard(writer, c, dir, R * DISTANT_CROWN_FLOOR_HALF * rf.range(0.9, 1.1), cells[fl % cells.length], rf.chance(0.5), dark, dark.clone().multiplyScalar(1.18), centre, R * 1.05, 0.9, rf(), vAxis);
  }
}

/**
 * The mid-canopy variants, appended after `createDistantVariants`'s own (`MID_HEIGHTS.length` of
 * them). Every stream is forked by name off `rng` (`mid-*`), so no draw of the 60–220 m layer, the
 * white-barks, the giants or anything else in the trees system moves.
 */
export function createMidVariants(rng: Rng, palette: Palette): DistantVariant[] {
  // A mid crown stands in a tenth of the far layer's haze and takes the full direct sun, so it is
  // tinted only a little over the far cards (0.62, 0.66, 0.60 / 0.90, 0.95, 0.72): 1.3 × those read
  // as bright cardboard against the mist, and the far cards' own tone read as more haze (the band
  // measurements in art/environment/squad2-2026-09-23/README.md).
  const cardTint = new Color(0.72, 0.77, 0.68);
  const cardTopTint = new Color(0.99, 1.03, 0.79);
  // each variant leads with a different silhouette and crosses it with the next two
  const cellSets = [
    [0, 2, 1],
    [2, 0, 1],
    [1, 2, 0],
    [0, 1, 2],
    [2, 1, 0],
  ];
  return MID_SPECS.map((spec, index) => {
    const r = rng.fork(`mid-${index}`);
    const H = spec.height;
    const R = H * MID_TRUNK_R;
    const crownY = H * spec.crownY;
    const crownR = H * spec.crownR;
    const cells = cellSets[index % cellSets.length];
    const bark = new Color(palette.barkDark).multiplyScalar(0.85);
    const canopy = new Color(palette.leafCanopy).multiplyScalar(0.48);
    // the same near-bark contract as the broad kind: the wood is written DISTANT_NEAR_GAIN over
    // the far tint and tagged (woodMoss = 1), and the distant material divides it back out past
    // DISTANT_BARK_M — inside 22 m a mid bole is real bark in the giants' shaded range
    const nearBark = bark.clone().multiplyScalar(DISTANT_NEAR_GAIN);
    const footGrime = nearBark.clone().multiplyScalar(DISTANT_FOOT_GRIME);
    const limbTip = canopy.clone().multiplyScalar(0.6 * DISTANT_NEAR_GAIN);
    const cordPhase = r.range(0, TAU);
    const bandPhase = r.range(0, TAU);
    const boleColor = (pt: Vector3, t: number, base: Color, top: Color, foot: Color) => {
      if (t === 0) return foot;
      const into = smoothstep(crownY - crownR * 0.9, crownY + crownR * 0.1, pt.y);
      const band = 1 + DISTANT_BOLE_BANDS * Math.sin(pt.y * 2.3 + bandPhase) * (1 - into);
      return foot.clone().lerp(base, smoothstep(-0.5, 1.8, pt.y)).multiplyScalar(band).lerp(top, into * DISTANT_CROWN_TOP[2]);
    };
    const flare = (angle: number, distance: number) =>
      (1 + DISTANT_FLARE * Math.exp(-distance / (DISTANT_FLARE_FALL * 0.7))) * distantCord(angle, MID_CORDS[0], MID_CORDS[1], cordPhase);

    // The SKELETON is drawn once and shared by both LODs, so the far LOD is the near one at a
    // coarser tessellation and the swap at MID_FAR_LOD_M never turns a trunk or moves a limb.
    // (`growthPath` and `rootButtress` take a fixed number of draws whatever the segment count, so
    // only the tube's own fluting phase and per-side grain differ between the two — and the wood's
    // stiffness is pinned at 1, so neither LOD sways.)
    const sk = r.fork('skeleton');
    // understory trees lean for the light: 4–13° off vertical, and the sweep curves with it
    const lean = Math.tan((sk.range(4, 13) * Math.PI) / 180) * crownY;
    const az = sk.range(0, TAU);
    const apex = new Vector3(Math.cos(az) * lean, crownY + crownR * 0.2, Math.sin(az) * lean);
    const topR = R * 0.4;
    const limbCount = sk.int(2, 4);
    const limbSpecs = Array.from({ length: limbCount }, (_, i) => ({
      t: sk.range(0.5, 0.82),
      a: az + (i / limbCount) * TAU + sk.range(-0.5, 0.5),
      len: crownR * sk.range(0.5, 0.85),
      rise: sk.range(0.3, 0.7),
    }));
    const toeSpecs = Array.from({ length: MID_TOES }, (_, i) => ({
      a: (i / MID_TOES) * TAU + sk.range(-0.35, 0.35),
      length: R * sk.range(1.8, 2.8),
      width: R * sk.range(0.4, 0.6),
      height: R * sk.range(0.5, 0.8),
    }));

    /** the wood of one LOD: the shared skeleton swept at `sides` sides and `segments` rings */
    const wood = (writer: GeometryWriter, sides: number, segments: number) => {
      const wr = r.fork(`tube-${sides}`);
      writer.woodMoss = 1;
      const trunk = growthPath(new Vector3(0, -0.5, 0), apex, UP, sk.fork('trunk'), segments, 0.45);
      const arc: number[] = [0];
      for (let k = 1; k < trunk.length; k++) arc.push(arc[k - 1] + trunk[k].distanceTo(trunk[k - 1]));
      const radii = arc.map((s) => topR + (R - topR) * Math.pow(1 - s / arc[arc.length - 1], 0.85));
      tube(writer, trunk, radii, sides, wr, {
        color: (pt, t) => boleColor(pt, t, nearBark, limbTip, footGrime),
        roughness: 0.12,
        flatBase: true,
        structural: true,
        stiffness: () => 1,
        bump: flare,
      });
      limbSpecs.forEach((spec, i) => {
        const o = trunk[Math.round(spec.t * (trunk.length - 1))].clone();
        const target = o.clone().add(new Vector3(Math.cos(spec.a) * spec.len, spec.len * spec.rise, Math.sin(spec.a) * spec.len));
        const path = growthPath(o, target, UP, sk.fork(`limb-${i}`), Math.max(2, Math.round(segments * 0.7)), 0.55);
        const limbLength = Math.max(0.4, o.distanceTo(target));
        tube(writer, path, taper(path, R * 0.42, 0.04, 0.9), Math.max(4, Math.round(sides * 0.45)), wr, {
          color: (pt) => nearBark.clone().lerp(limbTip, smoothstep(LIMB_TINT_FROM, LIMB_TINT_TO, pt.distanceTo(o) / limbLength) * LIMB_TIP_TINT),
          roughness: 0.06,
          structural: true,
          stiffness: () => 1,
        });
      });
      const rootColor = nearBark.clone().multiplyScalar(0.72);
      toeSpecs.forEach((spec, i) =>
        rootButtress(writer, spec.a, spec.length, spec.width, spec.height, rootColor, sk.fork(`toe-${i}`), (x, z) => -DISTANT_TOE_DIVE * Math.hypot(x, z), new Vector3(0, 0, 0), Math.max(4, Math.round(segments)), {
          arcSides: Math.max(4, Math.round(sides * 0.6)),
          fillet: 0.7,
        }),
      );
      writer.woodMoss = 0;
      solidUv(writer);
    };

    const crownCentre = new Vector3(0, crownY, 0);
    const near = new GeometryWriter('high');
    wood(near, MID_SIDES, 6);
    const nearWood = near.indices.length;
    midCrownCards(near, r.fork('crown'), crownCentre, crownR, cells, cardTint, cardTopTint);

    // the far LOD: the same skeleton at a third of the sides and half the rings, and the same
    // crown from the same stream — the swap at MID_FAR_LOD_M never turns a silhouette
    const far = new GeometryWriter('high');
    wood(far, 5, 3);
    const farWood = far.indices.length;
    midCrownCards(far, r.fork('crown'), crownCentre, crownR, cells, cardTint, cardTopTint);

    const nearGeometry = near.finish(`mid-near-${index}`);
    nearGeometry.addGroup(0, nearWood, 0);
    nearGeometry.addGroup(nearWood, near.indices.length - nearWood, 1);
    const farGeometry = far.finish(`mid-far-${index}`);
    farGeometry.addGroup(0, farWood, 0);
    farGeometry.addGroup(farWood, far.indices.length - farWood, 1);
    return { kind: 'mid' as DistantKind, near: nearGeometry, far: farGeometry, height: H, nearTriangles: near.triangles, farTriangles: far.triangles, bandOnly: true };
  });
}

export interface MidGroveOptions {
  /** how many trees to aim for (the accepted count is lower: the rules below drop candidates) */
  target: number;
  /** the annulus the grove fills (m from the clearing's centre) */
  inner: number;
  outer: number;
  /** ground the grove may not stand on — index.ts supplies the paths / stairs / structures / landmarks rule */
  blocked: (x: number, z: number, treeRadius: number) => boolean;
  /** discs already taken by a tree or a landmark (an existing bole plus its clearance) */
  occupied: readonly { x: number; z: number; r: number }[];
  /** sun corridors whose air a crown may not fill (the god rays' columns) */
  corridors?: readonly { point: Vector3; dir: Vector3; radius: number }[];
  /** 0–1 share of candidates kept on this ground, before the clumping noise */
  weight?: (x: number, z: number) => number;
  /** spacing floor between two mid boles (m) — crowns are meant to overlap, boles are not */
  spacing?: number;
}

/**
 * Seeded placement of the mid-canopy grove. Own stream (`mid-grove`), own spacing grid: it reads
 * the other systems' positions through `occupied` and adds nothing to any stream they draw from,
 * so every white-bark, giant, column, distant tree, rock and plant is exactly where it was.
 *
 * Candidates are thrown at the annulus with a clumping noise (groves, not a lawn), and a candidate
 * survives only if the ground allows a tree, no crown fills a sun corridor, and no bole stands in
 * an occupied disc or within `spacing` of another mid bole. Crowns are allowed to overlap: the
 * reference's layers ARE overlapping crowns.
 */
export function placeMidTrees(rng: Rng, terrain: Terrain, variants: DistantVariant[], o: MidGroveOptions): DistantPlacement[] {
  const r = rng.fork('mid-grove');
  const clump = new Noise2D('mid-grove-clumps');
  const pool = variants.map((v, i) => (v.kind === 'mid' ? i : -1)).filter((i) => i >= 0);
  const out: DistantPlacement[] = [];
  if (!pool.length) return out;
  const spacing = o.spacing ?? 2.8;
  const cell = 6;
  const grid = new Map<string, DistantPlacement[]>();
  const corridors = o.corridors ?? [];
  /** a crown of `crownR` centred `cy` above the ground at (x, z) fills a sun corridor */
  const shadesCorridor = (x: number, z: number, cy: number, crownR: number) => {
    for (const c of corridors) {
      if (c.dir.y <= 0.05) continue;
      for (let k = 0; k <= 4; k++) {
        const hy = cy + crownR * (-0.6 + 1.2 * (k / 4));
        const t = (hy - c.point.y) / c.dir.y;
        if (t < 0) continue;
        if (Math.hypot(c.point.x + c.dir.x * t - x, c.point.z + c.dir.z * t - z) < crownR + c.radius) return true;
      }
    }
    return false;
  };
  let attempts = 0;
  while (out.length < o.target && attempts < o.target * 90) {
    attempts++;
    const a = r() * TAU;
    // area-uniform in the annulus, biased inward: the 15–32 m ring is where the height fog still
    // lets a crown read (at 45 m+ the veil is most of what the frame shows) and where a walker's
    // "middle distance" actually is
    const rad = Math.sqrt(o.inner * o.inner + (o.outer * o.outer - o.inner * o.inner) * Math.pow(r(), 1.7));
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const groves = 0.3 + 0.7 * (clump.fbm(x * 0.035, z * 0.035, 3) * 0.5 + 0.5);
    if (r() > groves * (o.weight ? o.weight(x, z) : 1)) continue;
    const variant = pool[r.int(0, pool.length)];
    const v = variants[variant];
    const spec = MID_SPECS.find((s) => s.height === v.height);
    const scale = r.range(0.82, 1.2);
    const H = v.height * scale;
    const crownR = H * (spec?.crownR ?? MID_CROWN_R);
    const trunkR = H * MID_TRUNK_R;
    if (o.blocked(x, z, trunkR)) continue;
    if (terrain.slope(x, z) > 0.66) continue;
    const y = terrain.height(x, z);
    if (shadesCorridor(x, z, y + H * (spec?.crownY ?? MID_CROWN_Y), crownR)) continue;
    if (o.occupied.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + trunkR)) continue;
    if (tooCloseIn(grid, cell, x, z, spacing)) continue;
    // value / hue jitter per tree, then the shared depth cool so the back of the band sits behind
    const shift = r.range(-0.07, 0.07);
    const tint = depthCool(new Color(1 + shift * 0.6, 1 + shift, 1 - shift * 0.7).multiplyScalar(r.range(0.84, 1.1)), x, z);
    const p: DistantPlacement = { variant, x, y, z, yaw: r() * TAU, scale, tint };
    out.push(p);
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(p);
  }
  return out;
}
