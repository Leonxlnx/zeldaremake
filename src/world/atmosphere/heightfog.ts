/**
 * Height-aware atmospheric perspective for EVERY material in the scene.
 *
 * three.js resolves `#include <fog_fragment>` etc. from the mutable `ShaderChunk` table at program
 * compile time, so replacing the four fog chunks once at module load upgrades every built-in
 * material (and any custom ShaderMaterial that includes the standard fog chunks) to:
 *
 *   1. distance haze — a soft exponential ramp parameterised by the scene's `fogNear`/`fogFar`
 *      (`scene.fog` stays a plain `THREE.Fog`, so the rest of the codebase is unaffected) that
 *      plateaus below 1.0: the far world is veiled, never erased. Distant tree layers stay
 *      readable as silhouettes; the horizon is not a fog wall.
 *   2. exponential height fog — an analytic integral along the view ray of a density that decays
 *      with height above a mist base, weighted toward the north hollow (−Z) where the reference
 *      pools mist under the log arch.
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
  /** brightness of the haze on geometry relative to `fogColor` (the sky horizon stays at 1.0) */
  hazeScale: number;
  /**
   * per-channel balance applied to `fogColor` for the haze on geometry. The reference haze measures
   * as a warm khaki grey (R ≥ G > B, hue ≈ 50°) because it is lit by the low golden sun; the config
   * colour is a cool cyan-grey, so the haze is pulled warm here while the sky keeps the cool zenith.
   */
  hazeTint: [number, number, number];
}

export const HEIGHT_FOG_DEFAULTS: HeightFogParams = {
  baseHeight: 1.0,
  falloff: 0.55,
  density: 0.030,
  northStartZ: -4,
  northFullZ: -24,
  baseWeight: 0.35,
  maxFog: 0.90,
  hazeScale: 0.44,
  hazeTint: [1.0, 0.885, 0.70],
};

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
	const float KF_HAZE_SCALE = ${f(params.hazeScale)};
	const vec3 KF_HAZE_TINT = vec3( ${f(params.hazeTint[0])}, ${f(params.hazeTint[1])}, ${f(params.hazeTint[2])} );

	// analytic integral of density(y) = D * exp( -(y - base) * falloff ) along a ray of length dist
	float kfHeightFogAmount( vec3 camPos, vec3 rayDir, float dist, float weight ) {
		float k = KF_FALLOFF;
		float startDensity = KF_DENSITY * weight * exp( -( camPos.y - KF_BASE_H ) * k );
		float ry = rayDir.y;
		float t = abs( ry ) < 1e-3 ? dist : ( 1.0 - exp( -dist * ry * k ) ) / ( ry * k );
		return startDensity * t;
	}

	// returns (fogFactor, warmth) for this fragment
	vec2 kfFog( vec3 worldPos, out vec3 rayDir ) {
		vec3 v = worldPos - cameraPosition;
		float dist = length( v );
		rayDir = v / max( dist, 1e-4 );
		#ifdef FOG_EXP2
			float fNear = 0.0;
			float fFar = 1.0 / max( fogDensity, 1e-4 );
		#else
			float fNear = fogNear;
			float fFar = fogFar;
		#endif
		// 1) distance haze: soft exponential ramp, plateauing so the far world stays a silhouette
		float d = max( dist - fNear * 0.3, 0.0 ) / max( fFar, 1.0 );
		float distFog = 0.86 * ( 1.0 - exp( -pow( d * 1.65, 1.5 ) ) );
		// 2) height fog, denser toward the north hollow (−Z) of the fragment
		float north = smoothstep( KF_NORTH_START, KF_NORTH_FULL, worldPos.z );
		float weight = mix( KF_BASE_W, 1.0, north );
		float hAmount = kfHeightFogAmount( cameraPosition, rayDir, dist, weight );
		float heightFog = 1.0 - exp( -hAmount );
		heightFog = min( heightFog, 0.7 );
		float fog = 1.0 - ( 1.0 - distFog ) * ( 1.0 - heightFog );
		fog = min( fog, KF_MAX_FOG );
		// 3) in-scatter: the haze warms and brightens toward the sun
		float sunAmt = pow( max( dot( rayDir, KF_SUN_DIR ), 0.0 ), 4.0 );
		return vec2( fog, sunAmt );
	}
#endif
`;

  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	vec3 kfRay;
	vec2 kfF = kfFog( vFogWorldPos, kfRay );
	// haze on geometry sits well below the sky brightness so far tree layers stay silhouetted
	vec3 kfColor = fogColor * KF_HAZE_TINT * KF_HAZE_SCALE * ( 1.0 + kfF.y * 0.35 ) * mix( vec3( 1.0 ), vec3( 1.06, 1.0, 0.9 ), kfF.y );
	// slightly darker, bluer haze when looking down into the ground layer
	kfColor *= mix( 1.0, 0.92, clamp( -kfRay.y * 2.0, 0.0, 1.0 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, kfColor, kfF.x );
#endif
`;
}
