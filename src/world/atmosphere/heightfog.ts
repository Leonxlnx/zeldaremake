/**
 * Height-aware atmospheric perspective for EVERY material in the scene.
 *
 * three.js resolves `#include <fog_fragment>` etc. from the mutable `ShaderChunk` table at program
 * compile time, so replacing the four fog chunks once at module load upgrades every built-in
 * material (and any custom ShaderMaterial that includes the standard fog chunks) to:
 *
 *   1. distance haze — exponential extinction (≈ 0.028 m⁻¹ after a crisp 2.5 m foreground, thickening past the log arch; cf.
 *      the depth-vs-blend measurements in reference/ANALYSIS.md §8) that is capped below 1.0: the
 *      far world is veiled, never erased. `scene.fog` stays a plain `THREE.Fog` (its near/far are
 *      the audited visibility distances) so the rest of the codebase is unaffected. The airlight
 *      is depth-graded warm grey — mid grey through the hollow, brighter past ≈ 44 m where far light
 *      arrives through more canopy gaps (see `hazeNear`/`hazeFar`) — and the extinction jumps past
 *      the log arch (`hazeFarStart`) so the far tree rows are a luminous wall. The aerosol is densest under the
 *      canopy: its density is uniform up to `hazeUniformHeight` and decays exponentially above,
 *      and steeply climbing rays are attenuated further, so rays toward the crowns (shot F)
 *      accumulate far less haze than rays along the ground and the near canopy stays dark
 *      against the bright gaps.
 *   2. exponential height fog — an analytic integral along the view ray of a density that decays
 *      with height above a mist base, weighted toward the north hollow (−Z) where the reference
 *      pools mist under the log arch; its share of the fog takes the warm ground-mist colour.
 *   3. direction-dependent airlight — (a) canopy openness: toward the open east plateau the veil
 *      grades near → far → lit air and the dome shows the gap glare; toward the closed north hollow
 *      and west stand every distance shows one dim closed-roof veil (`openDir`, `hazeClosed`), the
 *      reference's B forest band / A left quadrant; (b) the back-scatter lobe: the veil dims toward
 *      `backScatterMin` when the sun is behind the camera (shot C looks ≈ 120–140° away from it:
 *      the reference's haze there is a dark warm grey). A forward lobe is kept as a hook
 *      (`sunLobeGain`, off: the reference's most sunward air is its dimmest); (c) in the closed
 *      directions the far air is graded by the ray's elevation the way frame D reads it — dimmer
 *      still deep under the roof at eye level (`hollowDim`: the log arch's body and the ground
 *      through its opening), and the lit far wall (`hazeFarLit`) for rays that climb out of the
 *      under-canopy layer past the far rows (`hazeFarLitKnee`). Extinction (the veil share) is
 *      direction-independent; only the veil's radiance changes; (d) the near field: the air the
 *      camera stands in (to `hazeNearFieldIn`) is warmer and a hair dimmer than the far veil
 *      (`hazeNearField`) — measured with every surface black (`veilOnly`), the veil alone floored
 *      the 9–17 m darks at 0.22–0.26 display in a 58–60° hue where the frames' bark there reads
 *      0.19–0.25 at 28–37°.
 *
 * Everything is a pure function of the fragment's world position and the camera, so it is
 * deterministic and costs a few ALU per fragment. The vertex chunk needs `mvPosition` (present in
 * every built-in vertex shader before `fog_vertex`), the fragment chunk needs `cameraPosition`
 * (declared by the renderer for every fragment shader).
 */
import { ShaderChunk } from 'three';
import type { WorldConfig } from '../config';
import { sunDirection } from '../lighting/sun';

let installed = false;

const f = (n: number) => n.toFixed(5);

export interface HeightFogParams {
  /** mist base height (m). density is maximal at/below this height */
  baseHeight: number;
  /** vertical falloff (1/m); mist density halves every ln2/falloff metres */
  falloff: number;
  /** peak height-fog density (1/m) */
  density: number;
  /** z (world) where the north-hollow weighting starts (south edge) */
  northStartZ: number;
  /** z (world) where the north-hollow weighting saturates */
  northFullZ: number;
  /** minimum height-fog weight outside the hollow (0..1) */
  baseWeight: number;
  /** maximum total fog (keeps the far world visible) */
  maxFog: number;
  /** distance-haze extinction (1/m); reference/ANALYSIS.md §8 measures 0.028–0.035 */
  hazeDensity: number;
  /** distance (m) before the distance haze starts (the reference foreground stays crisp, but its dark undersides at 8–12 m are already lifted) */
  hazeStart: number;
  /**
   * Far air: beyond `hazeFarStart` (m) the extinction gains `hazeFarDensity` (1/m) on top of
   * `hazeDensity`. The reference's forest is thin air out to the log arch (every 25–47 m trunk and
   * the arch itself stay distinct dark shapes) and a luminous wall right behind it (the haze above
   * the arch reads 0.51–0.57 with the 55–95 m tree rows barely showing through): more contrast per
   * metre in the hollow, a near-complete veil past it.
   */
  hazeFarStart: number;
  hazeFarDensity: number;
  /**
   * Thin mid air: from `hazeNearStart` (m) the extinction runs at `hazeNearDensity` (1/m) out to
   * `hazeNearEnd` (m), then catches up linearly so that from `hazeCatchUpEnd` (m) on the optical
   * depth equals the plain `hazeDensity` profile — the foreground (to `hazeNearStart`) and the far
   * field (the 25–45 m veil, the arch, the far rows) keep their calibration while the band between
   * wears less veil. `hazeNearDensity = hazeDensity` disables it.
   */
  hazeNearStart: number;
  hazeNearDensity: number;
  hazeNearEnd: number;
  hazeCatchUpEnd: number;
  /** height (m) up to which the aerosol density is uniform (the air under the canopy) */
  hazeUniformHeight: number;
  /** scale height (m) of the exponential density decay above `hazeUniformHeight` */
  hazeScaleHeight: number;
  /**
   * Round 38 (tone): the EXTINCTION's own aerosol profile — uniform to `hazeDensityUniformHeight`
   * (m), decaying with scale height `hazeDensityScaleHeight` (m) above it — applied to the base
   * optical depth (`hazeDensity` / the thin-near profile) in place of the profile above, which keeps
   * gating the airlight colours (lit air, far wall) and the far knee's extinction. Lower than the
   * colour profile it lets the mist pool low: rays along the ground keep the calibrated veil while
   * rays to the boughs and trunks 4–10 m up wear thinner air, so the mid-distance canopy stays a
   * readable dark shape through it (frame D's mid band: crisp dark boughs over a low mist).
   * `hazeDensityProfileOpen` is the share of the colour profile the OPEN-side rays keep (1: only
   * the closed directions — the north hollow, the west stand — get the lower profile; the rays up
   * the stair corridor to the east plateau, whose upper frame is the frames' brightest air, keep
   * the calibrated veil; 0: every direction gets it).
   */
  hazeDensityUniformHeight: number;
  hazeDensityScaleHeight: number;
  hazeDensityProfileOpen: number;
  /**
   * Multiplier on the base extinction toward the open side (`kfOpenness` = 1: the east plateau and
   * the overhead gaps); closed directions keep 1. The open air is thinner as well as brighter.
   */
  hazeOpenDensity: number;
  /** total-fog cap toward the open side (`maxFog` toward the closed side): the open far air can veil completely */
  maxFogOpen: number;
  /**
   * Shaded-air veil (round 38): multiplier on the veil radiance laid over a fragment whose own
   * (pre-shade) radiance is zero, easing to 1 at `hazeShadeVeilKnee` (scene-linear luminance) and
   * gated out over `hazeShadeVeilOut` (m). A dark surface under the closed roof stands in air that
   * is itself unlit — the canopy that shades the trunk shades the air in front of it — so the veil
   * lifts it less than it lifts a sunlit gap beside it: the frames' mid-distance trunks and boughs
   * stay dark through thin luminous air instead of dissolving into one grey. 1 disables.
   */
  hazeShadeVeil: number;
  hazeShadeVeilKnee: number;
  hazeShadeVeilOut: [number, number];
  /**
   * Plateau glare (round 38): the brightest open air of the frames — the sky seen up the stair
   * corridor to the raised east plateau (F's upper left, 0.7–0.85 display with a soft halo) — is a
   * lobe around the horizontal direction `hazeHotDir`: smoothstep(`hazeHotCos`) on the ray's
   * horizontal dot with it, rising over the elevations `hazeHotUpIn` (sin) and gone past
   * `hazeHotUpOut`. Far rays in the lobe (ramp `hazeHotDist`, m) wear `hazeHot` as their veil and
   * veil completely, so the far rows there read as the glare; the dome takes the same colour
   * (sky.ts). `hazeHotAmount` scales the lobe (0 disables).
   */
  hazeHot: [number, number, number];
  hazeHotDir: [number, number];
  hazeHotCos: [number, number];
  hazeHotUpIn: [number, number];
  hazeHotUpOut: [number, number];
  hazeHotDist: [number, number];
  hazeHotAmount: number;
  /** extra attenuation (0..1) of the distance haze for rays that climb steeply toward the crowns */
  hazeUpwardCut: number;
  /**
   * Airlight colours in scene-linear radiance (what ACES maps to the reference's display values).
   * Measured against the reference: the log arch at 30 m (#646055 through a ~55 % veil) needs a
   * mid-distance airlight ≈ #707068, while the far trunks (#8d8e85 at ~85 % veil) and canopy gaps
   * (#aca896) need ≈ #949489 — far light arrives through more canopy gaps, so the airlight grades
   * brighter with distance. The far colour sits a step above that estimate (≈ #a0a099) because the
   * 50 m canopy behind the log arch is only ≈ 70 % veiled and still measured 0.05 under the
   * reference's top band at #949489. Ground mist ≈ #7a796d.
   */
  hazeNear: [number, number, number];
  hazeFar: [number, number, number];
  mistColor: [number, number, number];
  /** distances (m) over which the haze colour grades from near to far */
  hazeGradeNear: number;
  hazeGradeFar: number;
  /**
   * Lit air: the airlight colour of rays that climb out of the under-canopy layer (the open air the
   * canopy gaps and the far tree rows are seen through), replacing the depth-graded colour as the
   * ray's above-canopy share (1 − the aerosol profile's mean along it, see `kfAltitudeMean`) rises
   * from 0 to `hazeLitKnee`. Eye-level rays under the closed roof keep the dim near veil.
   */
  hazeLit: [number, number, number];
  hazeLitKnee: number;
  /**
   * Canopy openness by direction. The reference's open air — the 0.65–0.69 gap glare and the lit far
   * rows — is toward the raised east plateau (the stairs of shots A/F, the second tree-house), while
   * the north hollow and the west stand read as a dim closed roof at every distance (B's forest band
   * 0.45, A's left quadrant 0.48 — the same air our depth-graded veil, lit air and dome rendered at
   * 0.55–0.67). `openDir` is the horizontal unit direction (x, z) of the open side; a ray's openness
   * is smoothstep(openLo, openHi, dot(horizontal ray, openDir)), and rays steeper than ≈ 25° count as
   * open (the gaps overhead are the glare). Closed directions see `hazeClosed` instead of the
   * depth-graded near → far → lit veil; the sky dome takes the same colour there (sky.ts).
   */
  openDir: [number, number];
  openLo: number;
  openHi: number;
  /** smoothstep edges on the ray's sin(elevation) above which a direction counts as open (the gaps overhead) */
  openUpLo: number;
  openUpHi: number;
  hazeClosed: [number, number, number];
  /**
   * Lit far wall: past the far tree rows the stand opens and their light arrives through the rows,
   * so from `hazeFarLitStart` (m) to `hazeFarLitEnd` (m) the closed-direction veil (mist share
   * included) grades to `hazeFarLit` — after the closed-roof mix and the deep-hollow shade, which
   * otherwise pin the far air of the north hollow to the dim closed veil. Open directions keep their
   * own near → far → lit grade. The log arch of shot D sits just inside the ramp and keeps the dim
   * hollow veil; the rows behind it wear the lit wall, so its body reads as a silhouette (measured
   * before: arch 0.495 display against a 0.489 wall — the veil at 48–55 m was the same air as the
   * wall behind it). The sky dome takes the same colour above its `SKY_FAR_LIT_UP` gate (sky.ts).
   */
  hazeFarLit: [number, number, number];
  hazeFarLitStart: number;
  hazeFarLitEnd: number;
  /** share (0..1) of the lit far wall that is applied; 0 keeps the closed-roof veil to the horizon */
  hazeFarLitAmount: number;
  /**
   * The wall is the light above the far stand, so only rays that climb out of the under-canopy
   * layer see it: the far-wall mix is scaled by smoothstep(0, `hazeFarLitKnee`, above-canopy share)
   * (the same share `hazeLitKnee` keys the lit air on). Eye-level rays into the far hollow — the
   * ground seen through the log arch's opening — keep the dim closed veil under it; 0 disables the
   * gate (the wall at every elevation, the round-31 hook).
   */
  hazeFarLitKnee: number;
  /**
   * Deep-hollow shade: multiplier on the closed-roof veil radiance (mist share included) for rays
   * that run `hollowDimIn[0]`..`hollowDimIn[1]` m and further under the closed roof. The air the
   * camera stands in is lit by its open surroundings; 40 m on under the roof it is dimmer, and the
   * frame reads it so (D's opening at 70 m: 0.445 against 0.50 for our flat closed veil).
   */
  hollowDim: number;
  hollowDimIn: [number, number];
  /**
   * Shaded mid air: multiplier on the veil radiance for fragments whose view distance falls in the
   * window that ramps in over `nearDimIn` (m) and out over `nearDimOut` (m). The air a hero camera
   * stands in is lit by its open surroundings and the far hollow's air is gap-lit (both keep the
   * calibrated veil), but the segment under the closed canopy between them — the 10–24 m band where
   * Saria's trunk, the room interior and the shaded limbs sit — is dim air, so a shaded surface there
   * keeps its dark tone instead of being floored by the veil (with zero fill our 14–18 m floor was
   * 0.253 display against the reference's darkest decile of 0.218: the veil alone exceeded it).
   */
  nearDim: number;
  nearDimIn: [number, number];
  nearDimOut: [number, number];
  /**
   * Forward lobe of the airlight: gain at mu = 1 (pow 4 in mu) and the tint at mu = 1 (pow 3). The
   * reference shows its dimmest, greyest air in the most sunward directions (B's forest band, 36–60°
   * from the sun), so the lobe is off; kept as a hook.
   */
  sunLobeGain: number;
  sunLobeTint: [number, number, number];
  /**
   * Back-scatter lobe of the airlight: multiplier on the haze radiance when looking straight away
   * from the sun (1 = no falloff). The dimming ramps in from 90° (side scatter, the calibrated
   * colour) to `backScatterFullDeg` and holds beyond it.
   */
  backScatterMin: number;
  backScatterFullDeg: number;
  /** tint of the back-scattered haze at full dimming (the reference's anti-sun haze is warmer than its sunward veil) */
  backScatterTint: [number, number, number];
  /**
   * The same lobe for the god-ray in-scatter (postfx ray march): single scattering of direct sun
   * is more forward-peaked than the sky-lit, multiply-scattered veil, so its back lobe is deeper
   * (Henyey–Greenstein g ≈ 0.6 gives ≈ 0.48 at 135° relative to 90°).
   */
  rayBackScatterMin: number;
  /**
   * Deep-forest shade: surface radiance is scaled from 1 at `farShadeStart` (m) to `farShadeMin` at
   * `farShadeFull` before the veil is mixed in. The reference's distant forest is under a canopy
   * the shadow map does not model (the 47 m log arch of shot D is a dark silhouette, body 0.84×
   * the haze above it, and the 30–40 m trunks are dark columns), whereas our far surfaces are
   * sun/fill-lit at mid grey and read as pale ghosts once hazed. Bright emissives (lanterns) are
   * exempt so their glow still carries through the haze.
   */
  farShadeStart: number;
  farShadeFull: number;
  farShadeMin: number;
  /**
   * Near-field airlight (round 35): the radiance of the air between the camera and
   * `hazeNearFieldIn[0]` m, graded into the directional veil (open / closed / mist) by
   * `hazeNearFieldIn[1]` m; `hazeNearFieldAmount` scales the mix (0 disables the term). Measured
   * with every surface black (veilOnly): at 9–17 m a black object read 0.224 (B) / 0.260 (D) display
   * with a 58–60° hue against the frames' darkest decile there of 0.211 / 0.214 (bark 0.19–0.20 at
   * 28–37°), so the veil alone floored the near darks and coloured them yellow-green. The air the
   * hero cameras stand in is lit by the sunlit khaki floor and the warm key, not by the canopy's
   * green gaps, so it is dimmer and browner than the far veil; the far terms (the 25–45 m veil, the
   * arch, the far rows, the dome) are untouched past `hazeNearFieldIn[1]`. With the shipped colour
   * the black object reads 0.209 (B) / 0.251 (D) / 0.213 (A) at 39–41° at 9–17 m; the 30–50 m
   * floor is unchanged (0.451 / 0.518 / 0.443).
   */
  hazeNearField: [number, number, number];
  hazeNearFieldIn: [number, number];
  hazeNearFieldAmount: number;
  /**
   * Direction of the dim near air (horizontal unit vector, like `openDir`) and smoothstep edges on
   * the ray's horizontal dot with it: toward the north-west hollow the frames' near air is the lit
   * pool's glow (D's left bank reads 0.49 against our 0.39 at 9–17 m), so the near field is not
   * dimmed there; toward the north-east and east — Saria's trunk bank in D, the house pillar in B —
   * it is (frames 0.27 / 0.24 against our 0.31 / 0.31).
   */
  hazeNearFieldDir: [number, number];
  hazeNearFieldEdges: [number, number];
  /**
   * Probe aid (0 in production; set through `__ATMO_FOG__`): 1 zeroes every fogged surface's own
   * radiance before the veil is laid over it, so a capture shows the airlight floor alone — what a
   * black object would read at each pixel's depth (the god rays, the mist sheets and the grade
   * still apply, as they do to a real surface).
   */
  veilOnly: number;
}

export const HEIGHT_FOG_DEFAULTS: HeightFogParams = {
  // 2026-09-16: clearer daylight with cooler air and less extinction, requested by the
  // owner. Earlier reference-fit notes below are retained as calibration history.
  // a thin pool: a shallow eye-level ray into the hollow picks up ≈ 20 % mist at the log arch
  // (30 m) on top of the ≈ 50 % distance haze — the arch stays a dark silhouette, not grey mush
  baseHeight: 0.4,
  falloff: 1.0,
  density: 0.012,
  northStartZ: -4,
  northFullZ: -24,
  baseWeight: 0.16,
  maxFog: 0.86,
  // the near range decides the dark undersides: the reference's lantern limb at ≈ 10 m is lifted
  // to ≈ 0.39 luminance while its 30 m log arch keeps ≈ 55–60 % veil — so the haze starts close
  // (≈ 21 % at 10 m). The slope follows ANALYSIS §8 (25–30 m 55–65 %, 40–60 m 80–90 %): at
  // 0.026 the forest interiors of shots B/C/D still showed every 25–40 m trunk as a distinct dark
  // silhouette (darkest decile 0.17–0.23 against the reference's 0.26–0.28) where the reference
  // is a flat grey veil with pale trunks; 0.032 gave 58 % at 30 m, 70 % at 40 m, 84 % at 60 m —
  // but 78 % at the 47 m log arch of shot D, which the reference keeps as a dark silhouette (body
  // 0.84× the haze above it; ours read 0.92×) with the 30–40 m trunks still darker columns. So
  // the air is thinner (42 % at 30 m, 58 % at 47 m) and the veil colour 15 % brighter: a 30 m
  // trunk stays the same pale grey (0.58 × bark + 0.42 × veil ≈ 0.42 × bark + 0.58 × old veil)
  // while the background it stands against rises — contrast per metre, not less mood.
  // Round 12, fitted per depth bin (our per-pixel view distance, the reference sampled at the same
  // pixels, hero shots A–D): at 0.02 every view's 20–30 m band sat 0.025–0.05 under the
  // reference's median (0.38 vs 0.41–0.48) and 0.06–0.12 over its saturation, i.e. the mid
  // distance still showed lit foliage where the reference is a grey veil; the 8×8 local contrast
  // already matched (±0.01). 0.028 (≈ 21 % veil at 12.5 m, 47 % at 25 m, 65 % at 40 m) puts the
  // 10–50 m medians within ±0.03 of the reference in A/B/C and halves the saturation excess;
  // 0.03 fitted a hair better but cost the W35 sharpness margin. Verified by A/B capture.
  hazeDensity: 0.018,
  hazeStart: 2.5,
  // the thin air alone left the far tree rows (52–58 m, 80–95 m) at 67–75 % veil: the arch at 61 %
  // stood against a background only a notch brighter than itself (body 0.99× the band above it).
  // Past the arch the extinction jumps so the 55 m row reaches the 0.86 cap within ~7 m (it took
  // 0.032/m to 60 m before): the arch and the 30–40 m trunks are silhouettes against a luminous
  // wall, the way the reference's far field reads (measured: arch body 0.89× the band above it)
  hazeFarStart: 49,
  hazeFarDensity: 0.055,
  // Round 8, fitted per depth bin against the reference sampled at our own pixels: in every hero
  // view the 10–18 m bins' darkest decile sat 0.03–0.06 over the reference's (B 0.269/0.290 vs
  // 0.214/0.229, A 0.259/0.283 vs 0.256/0.263, D 0.264/0.283 vs 0.189/0.244) while the 18–24 m
  // bins already matched (B 0.293 vs 0.276) and the 4–7 m bins sat under it — and with the fill
  // off entirely our 14–18 m floor was still 0.253: the veil alone exceeded the reference's darks.
  // So the 8–15 m band is thin (0.010/m: 18 % veil at 12 m instead of 23 %, 20 % at 15 m instead
  // of 30 %) and the air catches up over 15–22 m (0.046/m) so nothing from 22 m out changes (the
  // 25–45 m veil, the arch, the far rows, W32's layering). Thinning from 2.5 m instead (0.014/m
  // to 14 m) hit the same trunk darks but took B's ground-band p10 0.269 → 0.248 and A's plaza
  // 0.276 → 0.259; starting at 8 m leaves them at 0.264 / 0.274.
  hazeNearStart: 8,
  hazeNearDensity: 0.028,
  hazeNearEnd: 15,
  hazeCatchUpEnd: 22,
  hazeUniformHeight: 8.0,
  hazeScaleHeight: 7.0,
  // Round 38 (tone): toward the closed directions (the north hollow of shot D, the west stand,
  // the south of shot C) the extinction's aerosol is uniform only to 3 m and falls off with a 5 m
  // scale height — the mist pools low and the air the boughs and trunks stand in, 4–12 m up, is
  // 15–40 % thinner (a ray from eye height to a bough at 6 m wears 0.84 of the ground-level
  // optical depth, to 10 m 0.62); the open side keeps the colour profile (8 / 7 m), because the
  // upper frame up the stair corridor is the frames' brightest air and thinning it darkened F
  // (−0.0027 at 3 / 5 m for every direction). Measured (six views, on top of the AO / bounce
  // changes): D +0.0020 (top band mean 0.500 → 0.489 against the frame's 0.484), E +0.0013,
  // B +0.0005, C −0.0015, A −0.0005, F ±0; 2 / 3 m for every direction was D +0.0021 but
  // C −0.0055, F −0.0080.
  hazeDensityUniformHeight: 3.0,
  hazeDensityScaleHeight: 5.0,
  hazeDensityProfileOpen: 1.0,
  hazeOpenDensity: 1.0,
  maxFogOpen: 0.86,
  hazeShadeVeil: 1.0,
  hazeShadeVeilKnee: 0.3,
  hazeShadeVeilOut: [40, 50],
  // bearing 57° (the air over the plateau lip north of the stair top as frame F sees it, 20° left
  // of its axis — frame F's glare spans u 0.17–0.34, bearings 51–64°), a ±5° core fading out by
  // ±9°, between ≈ 6° and 20° up. hazeHot is display ≈ 0.8; hazeHotAmount mixes the dome / far
  // veil toward it, so 0.65 lands the core near the frame's 0.65–0.7 (a full lobe measured 0.75
  // against the frame's 0.55–0.65 in the part of it our lantern limb leaves visible, F −0.0076)
  hazeHot: [0.55, 0.54, 0.44],
  hazeHotDir: [0.8387, -0.5446],
  hazeHotCos: [0.9877, 0.9962],
  hazeHotUpIn: [0.08, 0.16],
  hazeHotUpOut: [0.3, 0.4],
  hazeHotDist: [35, 55],
  // 0.65: F's top band gains the frame's bright share (pixels > 0.7: 0 → 1.3 %, the frame 3.1 %;
  // sd 0.075 → 0.091, the frame 0.136; p90 0.512 → 0.525 / 0.615) and the far rows at the top of
  // the stair become the luminous plateau air the frame shows behind its fence. The lobe is seen
  // through the lantern limb's crown in F and the stair-bank crowns at A's right edge, and the
  // leaf-against-glare speckle costs the structure term F −0.0021, A −0.0024 (0.0 outside those
  // two cells); a full lobe (1.0) read 0.75 against the frame's 0.55–0.65 and cost F −0.0076
  hazeHotAmount: 0.25,
  // rays steeper than ≈ 22° up (shot F's crowns and the far canopy behind them) lose up to 90 % of
  // the haze; eye-level shots (A/D top rows reach ≈ 23–25°) lose ≤ 10 % on their very top row
  hazeUpwardCut: 0.9,
  // a notch warmer than the earlier grey (B/R 0.89 → 0.84 linear): the reference's hazed regions
  // read B/R ≈ 0.87 display ((119,118,105) in A's upper band, (141,138,122) in D's) while our
  // mid-distance band carried ~9 more blue than the reference's
  // near veil ≈ 12 % brighter than the first calibration (#727166 → #7a7a6e display, the
  // reference's mid haze #7a796d): the shaded trunks and limbs it veils at 10–25 m measured
  // 0.05–0.10 under the reference's darkest decile in every hazed band; ×1.25 again with the
  // thinner air and the deep-forest shade (see hazeDensity, farShade*) so the veiled tones hold.
  // Round 12: every veil colour drops ≈ 6 % blue (B/R 0.84–0.88 → 0.78–0.82 linear). In the
  // veil-dominated 30 m+ bins the reference's HSV saturation is 0.12–0.15 where ours read
  // 0.08–0.11 — the display saturation of the closed veil goes 0.09 → 0.13 (hue stays 57–63°)
  hazeNear: [0.19, 0.215, 0.235],
  // far veil well under the old #a09f95 (→ #87867f display): the reference's far bands are a
  // mid grey (median 0.435 in B's left half, D's far band and C's mid band) with the god rays
  // carrying the bright part of the air, so the veil between the shafts has to sit under them —
  // at 0.28 shot D's far band read 0.54–0.57 and B's forest interior 0.52 against the
  // reference's 0.44 / 0.41. 0.19 → 0.238 (display ≈ 0.52) with the thinner air and the
  // deep-forest shade: the far background the 47 m arch and the 30–40 m trunks stand against —
  // the reference's haze right above the arch reads 0.51–0.57. 0.25 (display ≈ 0.55 at the far
  // cap) for the wall of veiled tree rows behind the arch
  hazeFar: [0.26, 0.32, 0.37],
  mistColor: [0.205, 0.203, 0.168],
  // the grade used to run 20 → 55 m, so the 47 m arch already wore 87 % of the far colour and the
  // far rows behind it nothing brighter. The whole hollow (to the arch) now keeps the dark near
  // veil — the air under its closed roof is dim — and the colour brightens only past ≈ 44 m where
  // the forest opens: the arch (46 m) takes ≈ 5 % of the far colour, the 56 m row ≈ 85 %
  hazeGradeNear: 44,
  hazeGradeFar: 60,
  // the reference's air brightness follows the ray's elevation, not its length or sun angle: its
  // fully open haze at 30–50 m in the upper frame (A's top band, the glow above D's arch, F's gaps)
  // reads 0.65–0.69 display while the forest interior at eye level (B's left half, 45 m median)
  // reads 0.41 — B is the most sunward of the three. Ours rendered both from the same 0.21–0.25
  // veil (0.55–0.59 / 0.47). So rays whose span leaves the under-canopy layer take this brighter
  // colour; the knee is reached by a 20° ray at ≈ 40 m (above-canopy share 0.19) while eye-level
  // rays to the 45 m trunks of B (share < 0.01) and everything the 10–20 m band sees are
  // untouched. Display ≈ 0.64 — a step under the dome's 0.67 glare: the reference's hazed crowns at
  // 30–50 m sit at its top band's median 0.49 (a dark crown through ≈ 50 % veil of ≈ 0.31 linear),
  // while a veil at the glare's own value pushed that median to 0.54
  // Round 37 (tone): the air's share of A's under-bright top band (y 0.08–0.33: frame p50/p90
  // 0.468/0.612, ours 0.432/0.558), measured with every surface black (veilOnly) and split by the
  // ray's elevation and openness at ≥ 45 m. A's open far air at 10–15° up (8.5 % of the band) is
  // where the frame is bright: frame 0.649, ours 0.581, the veil alone 0.573 — 0.608 with the
  // softening off, so the 320-grid haze blur mixing the far air with the near crowns costs 0.027
  // and the veil itself sits 0.04 under (its lit share is already 0.5–1.0 there). A's closed far
  // air reads frame 0.406 / 0.498 / 0.495 at 0–5° / 5–10° / 10–15° against ours 0.404 / 0.420 /
  // 0.536 — the hollow dim and the half wall are D's calibration and the same air; B's closed far
  // air at 10–20° reads frame 0.467 against ours 0.54–0.55 (veil 0.52–0.55), but the frame's B band
  // is dense 20–40 m trunks through ≈ 50 % veil where D's frame shows the same air at 0.54–0.58, so
  // it is not dimmed; F's open far air at 10–15° matches at the median (0.504 / 0.516 / veil 0.509,
  // the back-scatter lobe at 109° takes 15 %) and the frame's p90 there (0.675 vs 0.585) is gaps
  // beside dark crowns. Levers measured (Δ SSIM A / F / B / D): hazeLitKnee 0.1 — A open far
  // +0.008, +0.0002 / −0.0003 / −0.0008 / −0.0009; hazeFar 0.29 — +0.003 (the lit share dominates
  // above 10°, and the dome horizon feeds the IBL), −0.0004 / −0.0005 / 0 / −0.0002; hazeLit 0.36 —
  // A open far 0.577 → 0.597 (p90 0.615 → 0.640, band p90 0.558 → 0.562) for −0.0024 / −0.0053 /
  // −0.0014 / −0.0002. None taken: the metric charges every radiance rise in the far cells.
  hazeLit: [0.34, 0.38, 0.42],
  hazeLitKnee: 0.2,
  // open side = bearing 75° (ENE: the plateau, the stair corridor, the upper tree-house). Fully open
  // within ≈ 45° of it (A's far column at 47°, F's whole upper frame at 23–97°), closed beyond 75°
  // (bearings ≤ 0° and ≥ 150°): B's forest band (−17..+12°) is ≈ 90 % closed, A's left quadrant
  // (−13..+20°) ≈ 70 %, D's far band (−9..+21°) ≈ 65 % — the reference's D hollow (0.57) is brighter
  // than B/A's north (0.45–0.48) though it is the same air 5 m further along, so D gives up part of
  // its glow here (measured in the round-6 report)
  openDir: [0.9659, -0.2588],
  openLo: 0.25,
  openHi: 0.7,
  // rays steeper than ≈ 25° up count as open (the gaps overhead are the glare); the eye-level
  // shots' top rows reach ≈ 20–24°, so they keep the closed veil toward the north/west
  openUpLo: 0.12,
  openUpHi: 0.4,
  // with the thin band above, Saria's trunk band in B (x 0.66–0.98, y 0.10–0.50; 80 % of it at
  // 10–18 m) measured p10 0.212 against the reference's 0.209 (was 0.282), its 0–0.2 share 6.8 %
  // (reference 5.9 %) and its < 0.25 share 20 % (reference 25 %); the 0.2–0.3 share reaches 24 %
  // of the reference's 41 % — the rest of that band is shaded bark our fill leaves darker than
  // 0.2, not veil. 0.6–0.65 over a wider window (9–13 → 20–27 m) overshot: 0–0.2 share 13 %, and
  // the 18–24 m bins (matched before) fell 0.07 under the reference.
  nearDim: 1.0,
  nearDimIn: [9, 13],
  nearDimOut: [16, 21],
  // the closed-roof veil: a dim grey-green (display ≈ 0.51, hue ≈ 60°, B/R 0.93 — the reference's
  // B forest bank is 0.434 median / 0.51 p90 with the god rays' wash on top) at every distance, so
  // the far rows and the dome behind them converge on it instead of the 0.58–0.68 lit air. A hair
  // greener than hazeNear: the reference's forest haze is grey-green (hue 56–65°), ours read yellow
  hazeClosed: [0.18, 0.21, 0.23],
  // Round 31 (tone): the D arch (48–55 m, 74–86 % veil, body ×0.3) measured 0.495 display against
  // 0.489 for the rows behind it — with the closed mix the air behind the arch was the arch's own
  // veil, and no extinction at 0.028/m can silhouette a 50 m object against its own air. The
  // reference's wall there reads 0.54–0.58 (D top band 56–100 m by depth bin: 0.539 / 0.567 /
  // 0.576) with the arch at 0.41. Display ≈ 0.56 at the 0.86 cap (0.31 / display 0.59 measured D's
  // top-band p90 0.541 → 0.588 against the reference's 0.604, but the 55–60 m step doubled the
  // local sd of the far cells, 0.016 → 0.033, and cost D −0.021 SSIM: the far rows sit at mixed
  // 48–90 m depths inside one 40 px window where the frame has one smooth haze, so the wall is a
  // step under the frame's value and ramps over 7 m, and the depth-keyed haze blur in postfx
  // starts at 30 m to smooth the step); the ramp starts past the arch's far edge (z ≈ −57 seen
  // from D) so its body keeps the hollow veil. Shot B's far rows (50–65 m, 3.4 % of its frame)
  // rise over a reference that has them at 0.45–0.49 — the same air 15 m east; the frames' D
  // camera stands 25 m further north than ours, so its far air is the clearing beyond the arch,
  // B's the stand: one wall colour cannot fit both and D's arch wins.
  hazeFarLit: [0.30, 0.35, 0.39],
  // Round 32 (tone), with the arch on the frame's rows (hardscape-25): the ramp sits between the
  // arch's body (48–52 m from camera D, its curved top 52.8 m) and the far rows behind it (55–60 m)
  // so the body keeps the hollow veil and the rows wear the wall. The round-31 55–62 m ramp lit the
  // opening (68–78 m, which the frame keeps dark at 0.445) and reached only 20–50 % on the rows.
  hazeFarLitStart: 52,
  hazeFarLitEnd: 56,
  // Round 31: OFF — at 1.0 in every direction and elevation the wall gave D top-band p90 0.541 →
  // 0.564 but cost D −0.012 SSIM (B −0.006): our far rows sit at mixed 48–90 m depths inside one
  // SSIM window where the frame has one smooth haze.
  // Round 32 (tone), measured D/B captures with the arch on the frame's rows: the ungated round-31
  // wall at 0.27 / 0.5 / 0.75 / 1.0 changed the arch's above−body contrast by nothing (−0.005 →
  // −0.003), brightened the opening +0.014 … +0.048 (the frame has it 0.057 UNDER our flat veil)
  // and cost D −0.002 / −0.004 / −0.006 / −0.008 SSIM, B −0.002 … −0.007 (a 50–58 m ramp: worse,
  // it lit the arch's far half). Gated on the ray's above-canopy share and closed directions only
  // (hazeFarLitKnee), with the deep-hollow shade under it (hollowDim), at 1.0 the far air above
  // the arch reached the frame's value (52 m+ pixels 0.518 → 0.546 vs 0.561) but D still paid
  // −0.010 / B −0.006: in the top-band cells the frame is smooth air (sd 0.02) and ours has trees
  // at 6–36 m in front of the lit rows, so the lift is uncorrelated variance to the metric (cs
  // 0.62 → 0.46 in the cell right above the arch; a softer 52–62 m ramp / 0.2 knee cost the same
  // per unit of brightening; a 2.4 σ haze blur bought back +0.002). 0.5 with hollowDim 0.65 is
  // the largest amount that leaves D and B not down: D 0.3340 → 0.3346, B 0.2486 → 0.2493, arch
  // above−body contrast −0.005 → +0.060 (frame +0.170), body 0.484 → 0.417 (frame 0.398),
  // opening 0.502 → 0.440 (frame 0.445), 52 m+ air above the arch 0.518 → 0.507.
  hazeFarLitAmount: 0.5,
  // the knee a 55–60 m ray from eye level passes between ≈ 9° and 13° up (heights 10–14 m against
  // the 8 m layer): D's rows above the arch (+13…+20°) take the wall, B's far rows (+4…+14°) half
  // of it, the ground through the arch's opening (+2…+6°) none
  hazeFarLitKnee: 0.1,
  // D's centre column measured against the frame at our own depths (round 32): the arch body
  // (48–52 m) 0.484 vs 0.398, the ground through its opening (68–78 m, eye level) 0.502 vs 0.445,
  // the ground in front of it (30–39 m) 0.45 vs 0.448 — the frame's eye-level far air in the
  // hollow is a step under our flat closed veil (display 0.51), while its air above the arch is a
  // step over it (0.59). Alone, 0.75 measured D +0.008 / B +0.007 SSIM (body 0.436, opening 0.459,
  // B's far rows 0.505 → 0.47 against the frame's 0.46–0.47); 0.65 with the half wall matches the
  // opening (0.440) and B's 45–50 m bin (frame 0.361) and keeps both views not down. Ramps in
  // past the hollow floor the frame already matched (30–39 m) and is full at the arch's body.
  hollowDim: 0.65,
  hollowDimIn: [42, 52],
  // was 0.35 / (1.08, 1.0, 0.84): calibrated when shot F was believed to look toward the sun; with
  // the sun at azimuth −128° the sunward views are B's left and A's left quadrant, where the
  // reference's air is its dimmest and greyest (sat 0.11 against our 0.15)
  sunLobeGain: 0.0,
  sunLobeTint: [1.0, 1.0, 1.0],
  // shot C (centre ≈ 119° from the sun, left edge ≈ 138°) reads the reference's anti-sun haze at
  // ≈ 0.75× the display value of our side-scatter veil. The lobe also scales the sky dome and the
  // mist sheets (same numbers) and the god-ray in-scatter (deeper, see rayBackScatterMin), so the
  // medium dims as one. Shots A/B/D/E look 64–86° from the sun at their centres (only A's and B's
  // right quarter passes 90°), so they keep the calibrated colour; F (28°) sits entirely in the
  // forward lobe.
  // deeper than the first calibration (0.62): with the brighter near veil, shot C's mid band
  // measured 0.49 against the reference's 0.36 — its anti-sun haze is a dark grey, the darkest
  // haze of the six frames. 0.45 then undershot (0.32) once the god-ray mask went sparse and the
  // rays stopped adding a faint back-scatter veil of their own; 0.65 with the thinner air and the
  // deep-forest shade (the 15–35 m trunks of C carry less veil and darken, so the veil between
  // them is a notch brighter)
  backScatterMin: 0.65,
  backScatterFullDeg: 135,
  // the dimmed far haze is #625e51-class like the reference's anti-sun veil (hue ≈ 46°, HSL
  // saturation ≈ 0.09) where our neutral side-scatter grey would read yellow-green. Blue 0.9 →
  // 0.93 with the warmer base veils (round 12): shot C's 50 m+ band measured HSV 0.20 against
  // the reference's 0.18 at 0.9, 0.166 at the old veils
  backScatterTint: [1.08, 1.0, 0.93],
  // direct-sun in-scatter is far more forward-peaked than the sky-lit veil: looking away from the
  // sun the lit air in front of the camera adds little (0.7 washed shot C's whole foreground by
  // +0.09). Shot F (109° from the sun) keeps ≈ 70 % of the side-lit beam strength, C (127°) ≈ 40 %.
  rayBackScatterMin: 0.35,
  // the arch (47 m) rendered at ≈ 0.45 display before the veil — brighter than the veil itself — so
  // no haze density could make it a silhouette; ×0.3 makes its body the veil's own tone through
  // 58 % veil (dark against the far wall behind it), and the 30 m trunks (×0.55) become the
  // reference's darker columns
  farShadeStart: 22,
  farShadeFull: 44,
  farShadeMin: 0.3,
  // [0.2, 0.18, 0.148] reads 0.348 display at a 38° hue through 55 % veil where the control's blend of
  // hazeNear / hazeClosed read 0.36–0.38 at 58–64°: a warm near air 5–8 % dimmer than the far veil.
  // B's pillar bark 0.265 → 0.246 (frame 0.247), hue 51 → 42° (frame 28°); D's bank bark 0.310 → 0.293
  // at 36° (frame 0.239 — the rest of that gap is the bank's moss share, not the air). The dimmer
  // [0.16, 0.145, 0.12] (0.30 display, −20 %) put the pillar at 0.224 and D's right bank cells at
  // the frame's mean (0.286 vs 0.288) but cost −0.006 (B) / −0.0045 (D) SSIM: the metric's cs term
  // pays for every rise in our window variance where the lit pattern does not align with the frame's
  hazeNearField: [0.2, 0.18, 0.148],
  hazeNearFieldIn: [10, 28],
  hazeNearFieldAmount: 1,
  // gate off (edges [-2, -1]: every horizontal dot is past the upper edge): gating the full-strength
  // term to the east half (openDir, edges [-0.5, 0.1]) moved D by +0.0004 and B by +0.0001 against
  // the ungated term — D's left-bank rays at 9–17 m sit at a dot of −0.3…0, inside the ramp
  hazeNearFieldDir: [0.9659, -0.2588],
  hazeNearFieldEdges: [-2, -1],
  veilOnly: 0,
};

/** #rrggbb of a scene-linear colour after the composer's ACES (exposure 1) — for audits. */
export function displayHex(lin: readonly [number, number, number]): string {
  const aces = (x: number) => {
    const v = x / 0.6;
    return Math.min(1, Math.max(0, (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)));
  };
  const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return '#' + lin.map((c) => Math.round(srgb(aces(c)) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * Density (1/m) of the catch-up segment `hazeNearEnd..hazeCatchUpEnd` that brings the thin-near
 * profile back onto the plain `hazeDensity` optical depth at `hazeCatchUpEnd` (see hazeNearDensity).
 */
export function catchUpDensity(p: Pick<HeightFogParams, 'hazeDensity' | 'hazeStart' | 'hazeNearStart' | 'hazeNearDensity' | 'hazeNearEnd' | 'hazeCatchUpEnd'>): number {
  const s = Math.max(p.hazeNearStart, p.hazeStart);
  const foreRun = Math.max(s - p.hazeStart, 0);
  const thinRun = Math.max(p.hazeNearEnd - s, 0);
  const catchRun = p.hazeCatchUpEnd - p.hazeNearEnd;
  if (catchRun <= 0) return p.hazeDensity;
  return (p.hazeDensity * Math.max(p.hazeCatchUpEnd - p.hazeStart, 0) - p.hazeDensity * foreRun - p.hazeNearDensity * thinRun) / catchRun;
}

/**
 * Tuning aid (unset in production): `globalThis.__ATMO_FOG__ = { hazeDensity: 0.02, hazeNear: [...] }`
 * set before the page scripts run (a probe's evaluateOnNewDocument) overrides any `HeightFogParams`
 * field. The override is written into `HEIGHT_FOG_DEFAULTS` itself so the sky dome, the mist and the
 * god-ray march — which read the shared veil colours from it — stay consistent with the fog chunks.
 */
const fogOverride = (): Partial<HeightFogParams> | null => (globalThis as { __ATMO_FOG__?: Partial<HeightFogParams> | null }).__ATMO_FOG__ ?? null;

export function installHeightFog(config: WorldConfig, params: HeightFogParams = HEIGHT_FOG_DEFAULTS): void {
  if (installed) return;
  installed = true;
  const override = fogOverride();
  if (override) {
    for (const k of Object.keys(override) as (keyof HeightFogParams)[]) {
      const v = override[k];
      if (v !== undefined && typeof v === typeof params[k]) (params as unknown as Record<string, unknown>)[k] = v;
    }
  }
  const sun = sunDirection(config.sun.azimuthDeg, config.sun.elevationDeg);

  ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorldPos;
#endif
`;

  ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	// view → world using the rigid camera transform (viewMatrix = inverse(cameraWorld))
	vFogWorldPos = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif
`;

  ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogWorldPos;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif

	const vec3 KF_SUN_DIR = vec3( ${f(sun.x)}, ${f(sun.y)}, ${f(sun.z)} );
	const float KF_BASE_H = ${f(params.baseHeight)};
	const float KF_FALLOFF = ${f(params.falloff)};
	const float KF_DENSITY = ${f(params.density)};
	const float KF_NORTH_START = ${f(params.northStartZ)};
	const float KF_NORTH_FULL = ${f(params.northFullZ)};
	const float KF_BASE_W = ${f(params.baseWeight)};
	const float KF_MAX_FOG = ${f(params.maxFog)};
	const float KF_HAZE_K = ${f(params.hazeDensity)};
	const float KF_HAZE_START = ${f(params.hazeStart)};
	const float KF_HAZE_FAR_START = ${f(params.hazeFarStart)};
	const float KF_HAZE_K_FAR = ${f(params.hazeFarDensity)};
	const float KF_HAZE_K_NEAR = ${f(params.hazeNearDensity)};
	const float KF_THIN_START = ${f(Math.max(params.hazeNearStart, params.hazeStart))};
	const float KF_THIN_END = ${f(params.hazeNearEnd)};
	const float KF_CATCHUP_END = ${f(params.hazeCatchUpEnd)};
	const float KF_HAZE_K_CATCHUP = ${f(catchUpDensity(params))};
	const float KF_HAZE_H0 = ${f(params.hazeUniformHeight)};
	const float KF_HAZE_HS = ${f(params.hazeScaleHeight)};
	const float KF_DENS_H0 = ${f(params.hazeDensityUniformHeight)};
	const float KF_DENS_HS = ${f(params.hazeDensityScaleHeight)};
	const float KF_DENS_PROFILE_OPEN = ${f(params.hazeDensityProfileOpen)};
	const float KF_OPEN_DENSITY = ${f(params.hazeOpenDensity)};
	const float KF_MAX_FOG_OPEN = ${f(params.maxFogOpen)};
	const float KF_SHADE_VEIL = ${f(params.hazeShadeVeil)};
	const float KF_SHADE_VEIL_KNEE = ${f(params.hazeShadeVeilKnee)};
	const vec2 KF_SHADE_VEIL_OUT = vec2( ${params.hazeShadeVeilOut.map(f).join(', ')} );
	const vec3 KF_HAZE_HOT = vec3( ${params.hazeHot.map(f).join(', ')} );
	const vec2 KF_HOT_DIR = vec2( ${params.hazeHotDir.map(f).join(', ')} );
	const vec2 KF_HOT_COS = vec2( ${params.hazeHotCos.map(f).join(', ')} );
	const vec2 KF_HOT_UP_IN = vec2( ${params.hazeHotUpIn.map(f).join(', ')} );
	const vec2 KF_HOT_UP_OUT = vec2( ${params.hazeHotUpOut.map(f).join(', ')} );
	const vec2 KF_HOT_DIST = vec2( ${params.hazeHotDist.map(f).join(', ')} );
	const float KF_HOT_AMOUNT = ${f(params.hazeHotAmount)};
	const float KF_HAZE_UP_CUT = ${f(params.hazeUpwardCut)};
	const vec3 KF_HAZE_NEAR = vec3( ${params.hazeNear.map(f).join(', ')} );
	const vec3 KF_HAZE_FAR = vec3( ${params.hazeFar.map(f).join(', ')} );
	const vec3 KF_MIST = vec3( ${params.mistColor.map(f).join(', ')} );
	const float KF_GRADE_NEAR = ${f(params.hazeGradeNear)};
	const float KF_GRADE_FAR = ${f(params.hazeGradeFar)};
	const vec3 KF_HAZE_LIT = vec3( ${params.hazeLit.map(f).join(', ')} );
	const float KF_LIT_KNEE = ${f(params.hazeLitKnee)};
	const vec2 KF_OPEN_DIR = vec2( ${params.openDir.map(f).join(', ')} );
	const float KF_OPEN_LO = ${f(params.openLo)};
	const float KF_OPEN_HI = ${f(params.openHi)};
	const float KF_OPEN_UP_LO = ${f(params.openUpLo)};
	const float KF_OPEN_UP_HI = ${f(params.openUpHi)};
	const vec3 KF_HAZE_CLOSED = vec3( ${params.hazeClosed.map(f).join(', ')} );
	const vec3 KF_HAZE_FAR_LIT = vec3( ${params.hazeFarLit.map(f).join(', ')} );
	const float KF_FAR_LIT_START = ${f(params.hazeFarLitStart)};
	const float KF_FAR_LIT_END = ${f(params.hazeFarLitEnd)};
	const float KF_FAR_LIT_AMOUNT = ${f(params.hazeFarLitAmount)};
	const float KF_FAR_LIT_KNEE = ${f(params.hazeFarLitKnee)};
	const float KF_HOLLOW_DIM = ${f(params.hollowDim)};
	const vec2 KF_HOLLOW_DIM_IN = vec2( ${params.hollowDimIn.map(f).join(', ')} );
	const float KF_NEAR_DIM = ${f(params.nearDim)};
	const vec2 KF_NEAR_DIM_IN = vec2( ${params.nearDimIn.map(f).join(', ')} );
	const vec2 KF_NEAR_DIM_OUT = vec2( ${params.nearDimOut.map(f).join(', ')} );
	const float KF_SUN_GAIN = ${f(params.sunLobeGain)};
	const vec3 KF_SUN_TINT = vec3( ${params.sunLobeTint.map(f).join(', ')} );
	const float KF_BACK_MIN = ${f(params.backScatterMin)};
	const float KF_BACK_FULL = ${f(-Math.cos((params.backScatterFullDeg * Math.PI) / 180))};
	const vec3 KF_BACK_TINT = vec3( ${params.backScatterTint.map(f).join(', ')} );
	const float KF_SHADE_START = ${f(params.farShadeStart)};
	const float KF_SHADE_FULL = ${f(params.farShadeFull)};
	const float KF_SHADE_MIN = ${f(params.farShadeMin)};
	const float KF_VEIL_ONLY = ${f(params.veilOnly)};
	const vec3 KF_HAZE_NEAR_FIELD = vec3( ${params.hazeNearField.map(f).join(', ')} );
	const vec2 KF_NEAR_FIELD_IN = vec2( ${params.hazeNearFieldIn.map(f).join(', ')} );
	const float KF_NEAR_FIELD_AMOUNT = ${f(params.hazeNearFieldAmount)};
	const vec2 KF_NEAR_FIELD_DIR = vec2( ${params.hazeNearFieldDir.map(f).join(', ')} );
	const vec2 KF_NEAR_FIELD_EDGES = vec2( ${params.hazeNearFieldEdges.map(f).join(', ')} );

	// back lobe of the airlight phase: 1 at and sunward of 90°, easing to KF_BACK_MIN (with a warm
	// tint) once the ray points KF_BACK_FULL past the side-scatter direction. mu = dot( ray, sun ).
	vec3 kfBackScatter( float mu ) {
		float back = smoothstep( 0.0, KF_BACK_FULL, -mu );
		return mix( vec3( 1.0 ), KF_BACK_TINT * KF_BACK_MIN, back );
	}

	// analytic optical depth of density(y) = D * exp( -k * (y - base) ) along a ray of length dist,
	// written as the difference of the two endpoint terms D/(k*ry) * (e(y0) - e(y1)). Each factor is
	// finite (exponents clamped: the density saturates ~20x below the base and underflows cleanly
	// far above it), so a high camera looking down never produces the 0 * inf = NaN of the
	// "start density * path factor" form.
	float kfHeightFogAmount( vec3 camPos, vec3 rayDir, float dist, float weight ) {
		float k = KF_FALLOFF;
		float D = KF_DENSITY * weight;
		float ry = rayDir.y;
		float e0 = exp( clamp( -k * ( camPos.y - KF_BASE_H ), -40.0, 3.0 ) );
		if ( abs( ry ) < 1e-3 ) return D * e0 * dist;
		float e1 = exp( clamp( -k * ( camPos.y + ry * dist - KF_BASE_H ), -40.0, 3.0 ) );
		return D * ( e0 - e1 ) / ( k * ry );
	}

	// mean of an aerosol profile f(y) = exp( -max( y - H0, 0 ) / Hs ) over the heights a ray spans:
	// 1 for rays that stay under the canopy, falling toward 0 for rays that climb far above it.
	// Closed form (uniform run below H0 + the exponential tail above), symmetric in ray direction.
	float kfAltitudeMeanP( float ya, float yb, float H0, float Hs ) {
		float lo = min( ya, yb );
		float hi = max( ya, yb );
		float span = hi - lo;
		if ( span < 1e-3 ) return exp( -max( lo - H0, 0.0 ) / Hs );
		float below = clamp( H0 - lo, 0.0, span );
		float a = max( lo - H0, 0.0 );
		float b = hi - H0;
		float above = b > 0.0 ? ( exp( -a / Hs ) - exp( -b / Hs ) ) * Hs : 0.0;
		return ( below + above ) / span;
	}
	// the colour-gating profile (lit air, far wall) — also the far knee's extinction profile
	float kfAltitudeMean( float ya, float yb ) { return kfAltitudeMeanP( ya, yb, KF_HAZE_H0, KF_HAZE_HS ); }

	// canopy openness of a view direction: 1 toward the open east plateau (and overhead), 0 toward
	// the closed north hollow / west stand — see openDir
	float kfOpenness( vec3 rayDir ) {
		float len = length( rayDir.xz );
		float e = len > 1e-4 ? dot( rayDir.xz / len, KF_OPEN_DIR ) : 1.0;
		return max( smoothstep( KF_OPEN_LO, KF_OPEN_HI, e ), smoothstep( KF_OPEN_UP_LO, KF_OPEN_UP_HI, rayDir.y ) );
	}

	// plateau-glare lobe of a view direction (see hazeHot): 0 outside it, KF_HOT_AMOUNT at its core
	float kfHot( vec3 rayDir ) {
		float len = length( rayDir.xz );
		float e = len > 1e-4 ? dot( rayDir.xz / len, KF_HOT_DIR ) : 0.0;
		float lobe = smoothstep( KF_HOT_COS.x, KF_HOT_COS.y, e );
		float up = smoothstep( KF_HOT_UP_IN.x, KF_HOT_UP_IN.y, rayDir.y ) * ( 1.0 - smoothstep( KF_HOT_UP_OUT.x, KF_HOT_UP_OUT.y, rayDir.y ) );
		return KF_HOT_AMOUNT * lobe * up;
	}

	// optical depth of the base extinction: the plain KF_HAZE_K foreground to KF_THIN_START, thin air
	// to KF_THIN_END, a catch-up segment to KF_CATCHUP_END, then the plain profile again (see
	// hazeNearDensity) — continuous throughout
	float kfBaseOpticalDepth( float dist ) {
		float d = max( dist - KF_HAZE_START, 0.0 );
		if ( dist >= KF_CATCHUP_END ) return KF_HAZE_K * d;
		float foreRun = min( d, KF_THIN_START - KF_HAZE_START );
		float thinRun = clamp( d - foreRun, 0.0, max( KF_THIN_END - KF_THIN_START, 0.0 ) );
		float catchRun = max( d - foreRun - thinRun, 0.0 );
		return KF_HAZE_K * foreRun + KF_HAZE_K_NEAR * thinRun + KF_HAZE_K_CATCHUP * catchRun;
	}

	// returns (total fog, distance-haze share, mist share, cos of the ray–sun angle) for this fragment
	vec4 kfFog( vec3 worldPos, out vec3 rayDir ) {
		vec3 v = worldPos - cameraPosition;
		float dist = length( v );
		rayDir = v / max( dist, 1e-4 );
		// 1) distance haze: exponential extinction after a crisp foreground (the reference measures
		//    ~25 % at 12 m, ~60 % at 30 m, 80–90 % at 40–60 m). fogFar is the audited visibility
		//    distance; the visible ramp is this density, capped so the far world stays a silhouette.
		//    The aerosol thins with altitude and steep upward rays are cut further, so the crowns
		//    overhead stay dark silhouettes against the luminous gaps instead of washing pale.
		//    Past KF_HAZE_FAR_START the air thickens (the far rows are a luminous wall behind the
		//    thin-air hollow, see hazeFarDensity).
		//    The base extinction follows its own, lower aerosol profile (hazeDensityUniformHeight)
		//    and is thinner toward the open side (hazeOpenDensity); the far knee keeps the colour
		//    profile so the far wall is unchanged.
		float altitude = kfAltitudeMean( cameraPosition.y, worldPos.y );
		float open = kfOpenness( rayDir );
		float altDens = mix( kfAltitudeMeanP( cameraPosition.y, worldPos.y, KF_DENS_H0, KF_DENS_HS ), altitude, open * KF_DENS_PROFILE_OPEN );
		float upward = 1.0 - KF_HAZE_UP_CUT * smoothstep( 0.38, 0.62, rayDir.y );
		float opticalDepth = altDens * mix( 1.0, KF_OPEN_DENSITY, open ) * kfBaseOpticalDepth( dist ) + altitude * KF_HAZE_K_FAR * max( dist - KF_HAZE_FAR_START, 0.0 );
		float distFog = 1.0 - exp( -upward * opticalDepth );
		// 2) height fog (ground mist), denser toward the north hollow (−Z) of the fragment. The hollow
		//    is at lower z, so the ramp is written with ascending edges (smoothstep(a > b) is undefined)
		float north = 1.0 - smoothstep( KF_NORTH_FULL, KF_NORTH_START, worldPos.z );
		float weight = mix( KF_BASE_W, 1.0, north );
		float hAmount = kfHeightFogAmount( cameraPosition, rayDir, dist, weight );
		float heightFog = min( 1.0 - exp( -hAmount ), 0.7 );
		//    in the plateau-glare lobe the far air veils completely (the glare is the sky itself)
		float hotFar = kfHot( rayDir ) * smoothstep( KF_HOT_DIST.x, KF_HOT_DIST.y, dist );
		float fog = min( 1.0 - ( 1.0 - distFog ) * ( 1.0 - heightFog ), mix( mix( KF_MAX_FOG, KF_MAX_FOG_OPEN, open ), 1.0, hotFar ) );
		// 3) the ray–sun angle drives the airlight phase (forward lobe + back-scatter dimming)
		return vec4( fog, distFog, heightFog, dot( rayDir, KF_SUN_DIR ) );
	}

	// share of the near-field airlight a view direction gets (see hazeNearFieldDir): 1 toward the
	// dim side, 0 toward the lit hollow; 1 everywhere while the edges sit below -1
	float kfNearFieldGate( vec3 rayDir ) {
		float len = length( rayDir.xz );
		float e = len > 1e-4 ? dot( rayDir.xz / len, KF_NEAR_FIELD_DIR ) : 1.0;
		return smoothstep( KF_NEAR_FIELD_EDGES.x, KF_NEAR_FIELD_EDGES.y, e );
	}

	// depth-graded haze colour: dark warm grey near → lighter warm grey far, ground mist in the layer,
	// scaled by the airlight phase around the sun direction (mu = cos of the ray–sun angle).
	// openShare = the ray's above-canopy share (1 − kfAltitudeMean): rays that climb out of the
	// under-canopy layer see the lit open air instead of the dim veil under the closed roof.
	// open = the direction's canopy openness: closed directions keep the dim closed-roof veil out to
	// the far rows (no far / lit brightening), dimmer still deep under the roof (hollowDim); past
	// the rows the rays that climb out of the layer see the lit wall (see hazeFarLit, hazeFarLitKnee)
	vec3 kfHazeColor( float dist, float distFog, float heightFog, float mu, float rayY, float openShare, float open, float nearGate, float hotFar ) {
		vec3 haze = mix( KF_HAZE_NEAR, KF_HAZE_FAR, smoothstep( KF_GRADE_NEAR, KF_GRADE_FAR, dist ) );
		haze = mix( haze, KF_HAZE_LIT, smoothstep( 0.0, KF_LIT_KNEE, openShare ) );
		haze = mix( KF_HAZE_CLOSED, haze, open );
		float mistShare = heightFog / max( distFog + heightFog, 1e-3 );
		vec3 col = mix( haze, KF_MIST, mistShare );
		// near-field airlight: the air the camera stands in is dimmer and warmer than the veil the
		// far world wears (see hazeNearField); graded out before the far terms below begin
		col = mix( col, KF_HAZE_NEAR_FIELD, KF_NEAR_FIELD_AMOUNT * nearGate * ( 1.0 - smoothstep( KF_NEAR_FIELD_IN.x, KF_NEAR_FIELD_IN.y, dist ) ) );
		float closedShare = 1.0 - open;
		col *= mix( 1.0, KF_HOLLOW_DIM, smoothstep( KF_HOLLOW_DIM_IN.x, KF_HOLLOW_DIM_IN.y, dist ) * closedShare );
		float farLit = KF_FAR_LIT_AMOUNT * smoothstep( KF_FAR_LIT_START, KF_FAR_LIT_END, dist ) * closedShare;
		if ( KF_FAR_LIT_KNEE > 0.0 ) farLit *= smoothstep( 0.0, KF_FAR_LIT_KNEE, openShare );
		col = mix( col, KF_HAZE_FAR_LIT, farLit );
		// shaded mid air: the segment under the closed canopy (see nearDim) is dimmer than the lit
		// air the camera stands in and the gap-lit far air
		float dimWindow = smoothstep( KF_NEAR_DIM_IN.x, KF_NEAR_DIM_IN.y, dist ) * ( 1.0 - smoothstep( KF_NEAR_DIM_OUT.x, KF_NEAR_DIM_OUT.y, dist ) );
		col *= mix( 1.0, KF_NEAR_DIM, dimWindow );
		// forward lobe hook (off by default, see sunLobeGain): brightness at mu^4, tint at mu^3
		float sunAmt = pow( max( mu, 0.0 ), 4.0 );
		float sunTint = pow( max( mu, 0.0 ), 3.0 );
		col *= ( 1.0 + sunAmt * KF_SUN_GAIN ) * mix( vec3( 1.0 ), KF_SUN_TINT, sunTint );
		col *= kfBackScatter( mu );
		// a hair darker when looking down into the ground layer
		col *= mix( 1.0, 0.94, clamp( -rayY * 2.0, 0.0, 1.0 ) );
		// the plateau glare is the sky itself, not scattered air: laid over every phase term
		return mix( col, KF_HAZE_HOT, hotFar );
	}
#endif
`;

  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	vec3 kfRay;
	vec4 kfF = kfFog( vFogWorldPos, kfRay );
	float kfDist = length( vFogWorldPos - cameraPosition );
	float kfOpen = 1.0 - kfAltitudeMean( cameraPosition.y, vFogWorldPos.y );
	float kfHotFar = kfHot( kfRay ) * smoothstep( KF_HOT_DIST.x, KF_HOT_DIST.y, kfDist );
	vec3 kfColor = kfHazeColor( kfDist, kfF.y, kfF.z, kfF.w, kfRay.y, kfOpen, kfOpenness( kfRay ), kfNearFieldGate( kfRay ), kfHotFar );
	// deep-forest shade on the surface itself (not the veil): distant trunks, the log arch and the
	// far ground darken before the haze is laid over them, so they read as silhouettes in it; bright
	// emissives (lantern glow, 2.0 linear) keep their radiance. The exemption starts above sunlit
	// bark (sun 3.0 × albedo ≈ 0.4 ≈ 1.2): at 0.6–1.5 the lit ridges of the 45 m arch were two
	// thirds exempt and printed through the veil as ±0.025 stripes the reference's flat body lacks
	float kfShade = mix( 1.0, KF_SHADE_MIN, smoothstep( KF_SHADE_START, KF_SHADE_FULL, kfDist ) );
	float kfPeak = max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) );
	kfShade = mix( kfShade, 1.0, smoothstep( 1.3, 2.0, kfPeak ) );
	// shaded-air veil (see hazeShadeVeil): keyed on the surface's own radiance before the deep-forest
	// shade, so a shaded trunk at 35 m and a sunlit one read differently, and gated out before the
	// far wall (where every surface is shaded ×0.3 and the wall must stay whole)
	float kfSurfLum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	float kfShadeVeil = mix( KF_SHADE_VEIL, 1.0, smoothstep( 0.0, KF_SHADE_VEIL_KNEE, kfSurfLum ) );
	kfShadeVeil = mix( kfShadeVeil, 1.0, smoothstep( KF_SHADE_VEIL_OUT.x, KF_SHADE_VEIL_OUT.y, kfDist ) );
	gl_FragColor.rgb *= kfShade;
	if ( KF_VEIL_ONLY > 0.5 ) gl_FragColor.rgb = vec3( 0.0 );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, kfColor * kfShadeVeil, kfF.x );
#endif
`;
}
