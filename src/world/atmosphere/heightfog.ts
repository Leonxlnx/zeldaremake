/**
 * Height-aware atmospheric perspective for EVERY material in the scene.
 *
 * three.js resolves `#include <fog_fragment>` etc. from the mutable `ShaderChunk` table at program
 * compile time, so replacing the four fog chunks once at module load upgrades every built-in
 * material (and any custom ShaderMaterial that includes the standard fog chunks) to:
 *
 *   1. distance haze — exponential extinction (≈ 0.02 m⁻¹ after a crisp 2.5 m foreground, thickening past the log arch; cf.
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
 *      (`sunLobeGain`, off: the reference's most sunward air is its dimmest). Extinction (the veil
 *      share) is direction-independent; only the veil's radiance changes.
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
  /** height (m) up to which the aerosol density is uniform (the air under the canopy) */
  hazeUniformHeight: number;
  /** scale height (m) of the exponential density decay above `hazeUniformHeight` */
  hazeScaleHeight: number;
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
  hazeClosed: [number, number, number];
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
}

export const HEIGHT_FOG_DEFAULTS: HeightFogParams = {
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
  // while the background it stands against rises — contrast per metre, not less mood
  hazeDensity: 0.02,
  hazeStart: 2.5,
  // the thin air alone left the far tree rows (52–58 m, 80–95 m) at 67–75 % veil: the arch at 61 %
  // stood against a background only a notch brighter than itself (body 0.99× the band above it).
  // Past the arch the extinction jumps so the 55 m row reaches the 0.86 cap within ~7 m (it took
  // 0.032/m to 60 m before): the arch and the 30–40 m trunks are silhouettes against a luminous
  // wall, the way the reference's far field reads (measured: arch body 0.89× the band above it)
  hazeFarStart: 49,
  hazeFarDensity: 0.11,
  hazeUniformHeight: 8.0,
  hazeScaleHeight: 7.0,
  // rays steeper than ≈ 22° up (shot F's crowns and the far canopy behind them) lose up to 90 % of
  // the haze; eye-level shots (A/D top rows reach ≈ 23–25°) lose ≤ 10 % on their very top row
  hazeUpwardCut: 0.9,
  // a notch warmer than the earlier grey (B/R 0.89 → 0.84 linear): the reference's hazed regions
  // read B/R ≈ 0.87 display ((119,118,105) in A's upper band, (141,138,122) in D's) while our
  // mid-distance band carried ~9 more blue than the reference's
  // near veil ≈ 12 % brighter than the first calibration (#727166 → #7a7a6e display, the
  // reference's mid haze #7a796d): the shaded trunks and limbs it veils at 10–25 m measured
  // 0.05–0.10 under the reference's darkest decile in every hazed band; ×1.25 again with the
  // thinner air and the deep-forest shade (see hazeDensity, farShade*) so the veiled tones hold
  hazeNear: [0.21, 0.208, 0.176],
  // far veil well under the old #a09f95 (→ #87867f display): the reference's far bands are a
  // mid grey (median 0.435 in B's left half, D's far band and C's mid band) with the god rays
  // carrying the bright part of the air, so the veil between the shafts has to sit under them —
  // at 0.28 shot D's far band read 0.54–0.57 and B's forest interior 0.52 against the
  // reference's 0.44 / 0.41. 0.19 → 0.238 (display ≈ 0.52) with the thinner air and the
  // deep-forest shade: the far background the 47 m arch and the 30–40 m trunks stand against —
  // the reference's haze right above the arch reads 0.51–0.57. 0.25 (display ≈ 0.55 at the far
  // cap) for the wall of veiled tree rows behind the arch
  hazeFar: [0.25, 0.248, 0.213],
  mistColor: [0.205, 0.203, 0.18],
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
  hazeLit: [0.32, 0.316, 0.245],
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
  // the closed-roof veil: a dim grey-green (display ≈ 0.51, hue ≈ 60°, B/R 0.93 — the reference's
  // B forest bank is 0.434 median / 0.51 p90 with the god rays' wash on top) at every distance, so
  // the far rows and the dome behind them converge on it instead of the 0.58–0.68 lit air. A hair
  // greener than hazeNear: the reference's forest haze is grey-green (hue 56–65°), ours read yellow
  hazeClosed: [0.19, 0.192, 0.163],
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
  // saturation ≈ 0.09) where our neutral side-scatter grey would read yellow-green
  backScatterTint: [1.08, 1.0, 0.9],
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

export function installHeightFog(config: WorldConfig, params: HeightFogParams = HEIGHT_FOG_DEFAULTS): void {
  if (installed) return;
  installed = true;
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
	const float KF_HAZE_H0 = ${f(params.hazeUniformHeight)};
	const float KF_HAZE_HS = ${f(params.hazeScaleHeight)};
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
	const vec3 KF_HAZE_CLOSED = vec3( ${params.hazeClosed.map(f).join(', ')} );
	const float KF_SUN_GAIN = ${f(params.sunLobeGain)};
	const vec3 KF_SUN_TINT = vec3( ${params.sunLobeTint.map(f).join(', ')} );
	const float KF_BACK_MIN = ${f(params.backScatterMin)};
	const float KF_BACK_FULL = ${f(-Math.cos((params.backScatterFullDeg * Math.PI) / 180))};
	const vec3 KF_BACK_TINT = vec3( ${params.backScatterTint.map(f).join(', ')} );
	const float KF_SHADE_START = ${f(params.farShadeStart)};
	const float KF_SHADE_FULL = ${f(params.farShadeFull)};
	const float KF_SHADE_MIN = ${f(params.farShadeMin)};

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

	// mean of the aerosol profile f(y) = exp( -max( y - H0, 0 ) / Hs ) over the heights a ray spans:
	// 1 for rays that stay under the canopy, falling toward 0 for rays that climb far above it.
	// Closed form (uniform run below H0 + the exponential tail above), symmetric in ray direction.
	float kfAltitudeMean( float ya, float yb ) {
		float lo = min( ya, yb );
		float hi = max( ya, yb );
		float span = hi - lo;
		if ( span < 1e-3 ) return exp( -max( lo - KF_HAZE_H0, 0.0 ) / KF_HAZE_HS );
		float below = clamp( KF_HAZE_H0 - lo, 0.0, span );
		float a = max( lo - KF_HAZE_H0, 0.0 );
		float b = hi - KF_HAZE_H0;
		float above = b > 0.0 ? ( exp( -a / KF_HAZE_HS ) - exp( -b / KF_HAZE_HS ) ) * KF_HAZE_HS : 0.0;
		return ( below + above ) / span;
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
		float altitude = kfAltitudeMean( cameraPosition.y, worldPos.y );
		float upward = 1.0 - KF_HAZE_UP_CUT * smoothstep( 0.38, 0.62, rayDir.y );
		float opticalDepth = KF_HAZE_K * max( dist - KF_HAZE_START, 0.0 ) + KF_HAZE_K_FAR * max( dist - KF_HAZE_FAR_START, 0.0 );
		float distFog = 1.0 - exp( -altitude * upward * opticalDepth );
		// 2) height fog (ground mist), denser toward the north hollow (−Z) of the fragment. The hollow
		//    is at lower z, so the ramp is written with ascending edges (smoothstep(a > b) is undefined)
		float north = 1.0 - smoothstep( KF_NORTH_FULL, KF_NORTH_START, worldPos.z );
		float weight = mix( KF_BASE_W, 1.0, north );
		float hAmount = kfHeightFogAmount( cameraPosition, rayDir, dist, weight );
		float heightFog = min( 1.0 - exp( -hAmount ), 0.7 );
		float fog = min( 1.0 - ( 1.0 - distFog ) * ( 1.0 - heightFog ), KF_MAX_FOG );
		// 3) the ray–sun angle drives the airlight phase (forward lobe + back-scatter dimming)
		return vec4( fog, distFog, heightFog, dot( rayDir, KF_SUN_DIR ) );
	}

	// canopy openness of a view direction: 1 toward the open east plateau (and overhead), 0 toward
	// the closed north hollow / west stand — see openDir
	float kfOpenness( vec3 rayDir ) {
		float len = length( rayDir.xz );
		float e = len > 1e-4 ? dot( rayDir.xz / len, KF_OPEN_DIR ) : 1.0;
		return max( smoothstep( KF_OPEN_LO, KF_OPEN_HI, e ), smoothstep( 0.42, 0.7, rayDir.y ) );
	}

	// depth-graded haze colour: dark warm grey near → lighter warm grey far, ground mist in the layer,
	// scaled by the airlight phase around the sun direction (mu = cos of the ray–sun angle).
	// openShare = the ray's above-canopy share (1 − kfAltitudeMean): rays that climb out of the
	// under-canopy layer see the lit open air instead of the dim veil under the closed roof.
	// open = the direction's canopy openness: closed directions keep the dim closed-roof veil at
	// every distance (no far / lit brightening)
	vec3 kfHazeColor( float dist, float distFog, float heightFog, float mu, float rayY, float openShare, float open ) {
		vec3 haze = mix( KF_HAZE_NEAR, KF_HAZE_FAR, smoothstep( KF_GRADE_NEAR, KF_GRADE_FAR, dist ) );
		haze = mix( haze, KF_HAZE_LIT, smoothstep( 0.0, KF_LIT_KNEE, openShare ) );
		haze = mix( KF_HAZE_CLOSED, haze, open );
		float mistShare = heightFog / max( distFog + heightFog, 1e-3 );
		vec3 col = mix( haze, KF_MIST, mistShare );
		// forward lobe hook (off by default, see sunLobeGain): brightness at mu^4, tint at mu^3
		float sunAmt = pow( max( mu, 0.0 ), 4.0 );
		float sunTint = pow( max( mu, 0.0 ), 3.0 );
		col *= ( 1.0 + sunAmt * KF_SUN_GAIN ) * mix( vec3( 1.0 ), KF_SUN_TINT, sunTint );
		col *= kfBackScatter( mu );
		// a hair darker when looking down into the ground layer
		return col * mix( 1.0, 0.94, clamp( -rayY * 2.0, 0.0, 1.0 ) );
	}
#endif
`;

  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	vec3 kfRay;
	vec4 kfF = kfFog( vFogWorldPos, kfRay );
	float kfDist = length( vFogWorldPos - cameraPosition );
	float kfOpen = 1.0 - kfAltitudeMean( cameraPosition.y, vFogWorldPos.y );
	vec3 kfColor = kfHazeColor( kfDist, kfF.y, kfF.z, kfF.w, kfRay.y, kfOpen, kfOpenness( kfRay ) );
	// deep-forest shade on the surface itself (not the veil): distant trunks, the log arch and the
	// far ground darken before the haze is laid over them, so they read as silhouettes in it; bright
	// emissives (lantern glow, 2.0 linear) keep their radiance. The exemption starts above sunlit
	// bark (sun 3.0 × albedo ≈ 0.4 ≈ 1.2): at 0.6–1.5 the lit ridges of the 45 m arch were two
	// thirds exempt and printed through the veil as ±0.025 stripes the reference's flat body lacks
	float kfShade = mix( 1.0, KF_SHADE_MIN, smoothstep( KF_SHADE_START, KF_SHADE_FULL, kfDist ) );
	float kfPeak = max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) );
	kfShade = mix( kfShade, 1.0, smoothstep( 1.3, 2.0, kfPeak ) );
	gl_FragColor.rgb *= kfShade;
	gl_FragColor.rgb = mix( gl_FragColor.rgb, kfColor, kfF.x );
#endif
`;
}
