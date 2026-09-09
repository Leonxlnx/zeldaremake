/**
 * Height-aware atmospheric perspective for EVERY material in the scene.
 *
 * three.js resolves `#include <fog_fragment>` etc. from the mutable `ShaderChunk` table at program
 * compile time, so replacing the four fog chunks once at module load upgrades every built-in
 * material (and any custom ShaderMaterial that includes the standard fog chunks) to:
 *
 *   1. distance haze — exponential extinction (≈ 0.026 m⁻¹ after a crisp 2.5 m foreground, matching
 *      the depth-vs-blend measurements in reference/ANALYSIS.md §8) that is capped below 1.0: the
 *      far world is veiled, never erased. `scene.fog` stays a plain `THREE.Fog` (its near/far are
 *      the audited visibility distances) so the rest of the codebase is unaffected. The airlight
 *      is depth-graded warm grey — mid grey at 20 m, brighter at 55 m+ where far light arrives
 *      through more canopy gaps (see `hazeNear`/`hazeFar`). The aerosol is densest under the
 *      canopy: its density is uniform up to `hazeUniformHeight` and decays exponentially above,
 *      and steeply climbing rays are attenuated further, so rays toward the crowns (shot F)
 *      accumulate far less haze than rays along the ground and the near canopy stays dark
 *      against the bright gaps.
 *   2. exponential height fog — an analytic integral along the view ray of a density that decays
 *      with height above a mist base, weighted toward the north hollow (−Z) where the reference
 *      pools mist under the log arch; its share of the fog takes the warm ground-mist colour.
 *   3. sun in-scatter — the haze warms slightly when looking toward the sun.
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
  // to ≈ 0.39 luminance while its 30 m log arch keeps ≈ 55 % veil — so the haze starts close
  // (≈ 18 % at 10 m) with a slightly lower slope, leaving 30 m unchanged (≈ 51 %)
  hazeDensity: 0.026,
  hazeStart: 2.5,
  hazeUniformHeight: 8.0,
  hazeScaleHeight: 7.0,
  // rays steeper than ≈ 22° up (shot F's crowns and the far canopy behind them) lose up to 90 % of
  // the haze; eye-level shots (A/D top rows reach ≈ 23–25°) lose ≤ 10 % on their very top row
  hazeUpwardCut: 0.9,
  hazeNear: [0.15, 0.149, 0.134],
  hazeFar: [0.28, 0.281, 0.255],
  mistColor: [0.175, 0.173, 0.154],
  hazeGradeNear: 20,
  hazeGradeFar: 55,
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
	const float KF_HAZE_H0 = ${f(params.hazeUniformHeight)};
	const float KF_HAZE_HS = ${f(params.hazeScaleHeight)};
	const float KF_HAZE_UP_CUT = ${f(params.hazeUpwardCut)};
	const vec3 KF_HAZE_NEAR = vec3( ${params.hazeNear.map(f).join(', ')} );
	const vec3 KF_HAZE_FAR = vec3( ${params.hazeFar.map(f).join(', ')} );
	const vec3 KF_MIST = vec3( ${params.mistColor.map(f).join(', ')} );
	const float KF_GRADE_NEAR = ${f(params.hazeGradeNear)};
	const float KF_GRADE_FAR = ${f(params.hazeGradeFar)};

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

	// returns (total fog, distance-haze share, mist share, sun in-scatter) for this fragment
	vec4 kfFog( vec3 worldPos, out vec3 rayDir ) {
		vec3 v = worldPos - cameraPosition;
		float dist = length( v );
		rayDir = v / max( dist, 1e-4 );
		// 1) distance haze: exponential extinction after a crisp foreground (the reference measures
		//    ~25 % at 12 m, ~60 % at 30 m, 80–90 % at 40–60 m). fogFar is the audited visibility
		//    distance; the visible ramp is this density, capped so the far world stays a silhouette.
		//    The aerosol thins with altitude and steep upward rays are cut further, so the crowns
		//    overhead stay dark silhouettes against the luminous gaps instead of washing pale.
		float altitude = kfAltitudeMean( cameraPosition.y, worldPos.y );
		float upward = 1.0 - KF_HAZE_UP_CUT * smoothstep( 0.38, 0.62, rayDir.y );
		float distFog = 1.0 - exp( -KF_HAZE_K * altitude * upward * max( dist - KF_HAZE_START, 0.0 ) );
		// 2) height fog (ground mist), denser toward the north hollow (−Z) of the fragment. The hollow
		//    is at lower z, so the ramp is written with ascending edges (smoothstep(a > b) is undefined)
		float north = 1.0 - smoothstep( KF_NORTH_FULL, KF_NORTH_START, worldPos.z );
		float weight = mix( KF_BASE_W, 1.0, north );
		float hAmount = kfHeightFogAmount( cameraPosition, rayDir, dist, weight );
		float heightFog = min( 1.0 - exp( -hAmount ), 0.7 );
		float fog = min( 1.0 - ( 1.0 - distFog ) * ( 1.0 - heightFog ), KF_MAX_FOG );
		// 3) in-scatter: the haze warms and brightens toward the sun
		float sunAmt = pow( max( dot( rayDir, KF_SUN_DIR ), 0.0 ), 4.0 );
		return vec4( fog, distFog, heightFog, sunAmt );
	}

	// depth-graded haze colour: dark warm grey near → lighter warm grey far, ground mist in the layer
	vec3 kfHazeColor( float dist, float distFog, float heightFog, float sunAmt, float rayY ) {
		vec3 haze = mix( KF_HAZE_NEAR, KF_HAZE_FAR, smoothstep( KF_GRADE_NEAR, KF_GRADE_FAR, dist ) );
		float mistShare = heightFog / max( distFog + heightFog, 1e-3 );
		vec3 col = mix( haze, KF_MIST, mistShare );
		col *= ( 1.0 + sunAmt * 0.35 ) * mix( vec3( 1.0 ), vec3( 1.06, 1.0, 0.9 ), sunAmt );
		// a hair darker when looking down into the ground layer
		return col * mix( 1.0, 0.94, clamp( -rayY * 2.0, 0.0, 1.0 ) );
	}
#endif
`;

  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	vec3 kfRay;
	vec4 kfF = kfFog( vFogWorldPos, kfRay );
	vec3 kfColor = kfHazeColor( length( vFogWorldPos - cameraPosition ), kfF.y, kfF.z, kfF.w, kfRay.y );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, kfColor, kfF.x );
#endif
`;
}
