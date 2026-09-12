/**
 * Sun shadow filter — owner: atmosphere/lighting agent.
 *
 * three's `BasicShadowMap` keeps the sun's depth map as a plain (raw, nearest-filtered) depth
 * texture, so the lookup can read the occluder's depth — which the compare-mode PCF sampler cannot.
 * This module replaces the BASIC `getShadow` in `ShaderChunk.shadowmap_pars_fragment` (the same
 * ShaderChunk-override technique heightfog.ts uses for the fog) with a percentage-closer soft
 * shadow whose penumbra grows with the occluder's distance along the sun:
 *
 *   1. blocker search — Vogel-disc taps over `searchRadiusM`; the mean depth of the taps in front of
 *      the receiver gives the occluder distance in metres (the shadow camera is orthographic, so
 *      depth is linear over its near..far range). Receiver-plane depth bias (screen derivatives of
 *      the shadow coordinate) keeps a sloped ground from counting itself as a blocker.
 *   2. penumbra — `penumbraMinM + penumbraPerM · occluderDistance`, clamped: Link's shadow at 4 m
 *      stays crisp (5–8 cm penumbra, ANALYSIS §7) while the canopy 15–25 m up throws the soft
 *      20–40 cm dapple the reference shows on the plaza.
 *   3. filter — Vogel-disc percentage-closer taps at that radius (IGN-rotated per pixel: pure
 *      function of gl_FragCoord, so captures stay deterministic).
 *   4. canopy transmission — occluders farther than `leakStartM` (the crowns; nothing near the ground
 *      is that far from what it shades) let `leak` of the sun through, ramping in by `leakFullM`. The
 *      leaf-card canopy is opaque where the real one is porous at sub-card scale and lets sky light
 *      round every leaf; the reference's shaded flagstone keeps ≈ 64 % of the lit stone's radiance
 *      while Link's own crisp shadow keeps only ≈ 37 % (its shadow blocks the near light entirely).
 *
 * Installed by the first lighting-system creation before any material compiles.
 */
import { ShaderChunk } from 'three';

export interface ShadowFilterParams {
  /** metres spanned by the shadow camera's depth range (far − near) */
  depthRangeM: number;
  /** metres per shadow-map texel */
  texelM: number;
  /** blocker-search radius (m) */
  searchRadiusM: number;
  /** penumbra width (m) per metre of occluder distance (the sun's 0.53° disc gives 0.0093; a touch wider reads as the reference's soft dapple) */
  penumbraPerM: number;
  /** penumbra floor / ceiling (m) */
  penumbraMinM: number;
  penumbraMaxM: number;
  /** share of the sun passing far occluders (canopy transmission) and the occluder-distance ramp (m) */
  leak: number;
  leakStartM: number;
  leakFullM: number;
}

export const SHADOW_FILTER_DEFAULTS: ShadowFilterParams = {
  depthRangeM: 210,
  texelM: 92 / 4096,
  // 0.3 m: wide enough to find the canopy (whose dapple penumbra reaches 0.4 m) and Link's body
  // from anywhere inside his shadow, small enough that a boulder 1 m away does not soften a
  // slab's own contact shadow
  searchRadiusM: 0.3,
  penumbraPerM: 0.016,
  penumbraMinM: 0.04,
  penumbraMaxM: 0.45,
  // Measured against the reference in linear light: its canopy-shaded path keeps ≈ 0.35 of a lit
  // slab and Link's own shadow ≈ 0.29 — the canopy lets only a little more through than a solid body
  // does. 0.35 (with a 40 % fill) left the shaded path at 0.73 of lit, so no dapple read at all.
  leak: 0.1,
  leakStartM: 5,
  leakFullM: 11,
};

let installed = false;
const f = (n: number) => n.toFixed(6);

/** GLSL for the replaced BASIC getShadow (exported for the audit / tests). */
export function shadowFilterGlsl(p: ShadowFilterParams): string {
  const searchTexels = p.searchRadiusM / p.texelM;
  return /* glsl */ `
	// --- kokiri PCSS + canopy transmission (src/world/lighting/shadowfilter.ts) ---
	const float KF_SH_RANGE_M = ${f(p.depthRangeM)};
	const float KF_SH_TEXEL_M = ${f(p.texelM)};
	const float KF_SH_SEARCH_TEXELS = ${f(searchTexels)};
	const float KF_SH_PEN_PER_M = ${f(p.penumbraPerM)};
	const float KF_SH_PEN_MIN_M = ${f(p.penumbraMinM)};
	const float KF_SH_PEN_MAX_M = ${f(p.penumbraMaxM)};
	const float KF_SH_LEAK = ${f(p.leak)};
	const float KF_SH_LEAK_START_M = ${f(p.leakStartM)};
	const float KF_SH_LEAK_FULL_M = ${f(p.leakFullM)};
	#define KF_SH_SEARCH_TAPS 8
	#define KF_SH_FILTER_TAPS 12

	float kfShIgn( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
	vec2 kfShVogel( int i, int n, float phi ) {
		float r = sqrt( ( float( i ) + 0.5 ) / float( n ) );
		float th = float( i ) * 2.399963229728653 + phi;
		return vec2( cos( th ), sin( th ) ) * r;
	}
	float kfShDepth( float d ) {
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return 1.0 - d;
		#else
			return d;
		#endif
	}

	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		// screen-space derivatives first (uniform control flow), for the receiver-plane bias below
		vec3 dx = dFdx( shadowCoord.xyz );
		vec3 dy = dFdy( shadowCoord.xyz );
		// diagnostic modes (tuning aid; a probe drives them through the light's shadow radius, which
		// production never sets above a few texels): 1xx = occluder distance in front of the receiver
		// (raw texel), 3xx = blocker fraction, 4xx = filtered visibility without canopy transmission,
		// 8xx = blocker-search occluder distance / 20 m
		float kfDiag = floor( shadowRadius / 100.0 );
		if ( kfDiag == 1.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float zd = 1.0 - ( shadowCoord.z - shadowBias );
				float dd = 1.0 - texture2D( shadowMap, shadowCoord.xy ).r;
			#else
				float zd = shadowCoord.z + shadowBias;
				float dd = texture2D( shadowMap, shadowCoord.xy ).r;
			#endif
			return clamp( 0.2 + ( zd - dd ) * KF_SH_RANGE_M / 20.0, 0.0, 1.0 );
		}
		if ( kfDiag >= 2.0 ) shadowRadius = 1.5;
		// receiver depth in the forward convention (0 at the shadow camera's near plane)
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float zr = 1.0 - ( shadowCoord.z - shadowBias );
		#else
			float zr = shadowCoord.z + shadowBias;
		#endif
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		if ( ! inFrustum || zr > 1.0 ) return 1.0;

		// receiver-plane depth bias: dz/duv from the screen-space derivatives of the shadow coordinate,
		// so a tap offset o expects the receiver at zr + dot( dzduv, o ) — a sloped ground (the sun is
		// 38° up, so the ground's depth changes ≈ 1.3 m per metre across the map) never shadows itself
		float det = dx.x * dy.y - dx.y * dy.x;
		vec2 dzduv = vec2( 0.0 );
		if ( abs( det ) > 1e-12 ) {
			dzduv = vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				dzduv = - dzduv;
			#endif
			// clamp to ≈ 4× the ground's slope: grazing surfaces get a bounded bias, not garbage
			dzduv = clamp( dzduv, vec2( -2.5 ), vec2( 2.5 ) );
		}
		// a texel of slack on top of the plane bias (depth quantisation + the mean over a tap's texel)
		float slack = 1.5 * KF_SH_TEXEL_M / KF_SH_RANGE_M;

		vec2 texel = 1.0 / shadowMapSize;
		float phi = kfShIgn( gl_FragCoord.xy ) * 6.2831853;

		// 1) blocker search
		float bsum = 0.0;
		float bn = 0.0;
		for ( int i = 0; i < KF_SH_SEARCH_TAPS; i ++ ) {
			vec2 o = kfShVogel( i, KF_SH_SEARCH_TAPS, phi ) * KF_SH_SEARCH_TEXELS * texel;
			float d = kfShDepth( texture2D( shadowMap, shadowCoord.xy + o ).r );
			float zExpect = zr + dot( dzduv, o ) - slack;
			if ( d < zExpect ) {
				bsum += d;
				bn += 1.0;
			}
		}
		// diag 3: blocker fraction
		if ( kfDiag == 3.0 ) return bn / float( KF_SH_SEARCH_TAPS );
		if ( bn < 0.5 ) return 1.0;
		float occluderM = max( ( zr - bsum / bn ) * KF_SH_RANGE_M, 0.0 );

		// 2) penumbra from the occluder distance
		float penumbraM = clamp( KF_SH_PEN_MIN_M + KF_SH_PEN_PER_M * occluderM, KF_SH_PEN_MIN_M, KF_SH_PEN_MAX_M );
		float fr = max( shadowRadius, penumbraM / KF_SH_TEXEL_M );

		// 3) percentage-closer filter at that radius
		float lit = 0.0;
		for ( int i = 0; i < KF_SH_FILTER_TAPS; i ++ ) {
			vec2 o = kfShVogel( i, KF_SH_FILTER_TAPS, phi + 1.7 ) * fr * texel;
			float d = kfShDepth( texture2D( shadowMap, shadowCoord.xy + o ).r );
			lit += step( zr + dot( dzduv, o ) - slack, d );
		}
		lit /= float( KF_SH_FILTER_TAPS );
		// diag 4: the filtered visibility alone (no canopy transmission)
		if ( kfDiag == 4.0 ) return lit;

		// 4) canopy transmission for far occluders
		float leak = KF_SH_LEAK * smoothstep( KF_SH_LEAK_START_M, KF_SH_LEAK_FULL_M, occluderM );
		float shadow = mix( leak, 1.0, lit );
		if ( kfDiag == 8.0 ) return clamp( occluderM / 20.0, 0.0, 1.0 );
		return mix( 1.0, shadow, shadowIntensity );
	}
`;
}

/**
 * Diagnostic variant (tuning aid, selected by `globalThis.__ATMO_SHADOWFILTER_MODE__ = 'depth'`
 * before the page loads): the light factor becomes the occluder distance in front of the receiver
 * (black = nothing nearer in the map, brighter = a nearer occluder, saturating at 20 m), so a
 * white-Lambert frame shows what the receivers actually read from the sun's depth map.
 */
export function shadowDepthProbeGlsl(p: ShadowFilterParams): string {
  return /* glsl */ `
	const float KF_SH_RANGE_M = ${f(p.depthRangeM)};
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float zr = 1.0 - ( shadowCoord.z - shadowBias );
			float d = 1.0 - texture2D( shadowMap, shadowCoord.xy ).r;
		#else
			float zr = shadowCoord.z + shadowBias;
			float d = texture2D( shadowMap, shadowCoord.xy ).r;
		#endif
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		if ( ! inFrustum ) return 0.5;
		float metres = ( zr - d ) * KF_SH_RANGE_M;
		return clamp( 0.2 + metres / 20.0, 0.0, 1.0 );
	}
`;
}

/**
 * Replace the BASIC `getShadow` of three's shadow chunk. Returns false (and leaves the chunk alone)
 * if the chunk's layout is not the one this was written against.
 */
export function installShadowFilter(params: ShadowFilterParams = SHADOW_FILTER_DEFAULTS): boolean {
  if (installed) return true;
  const src = ShaderChunk.shadowmap_pars_fragment;
  // The bundled module strips GLSL comments, so the `// SHADOWMAP_TYPE_BASIC` marker is not
  // available: the BASIC variant is the last `getShadow` of the PCF / VSM / BASIC selector and
  // is introduced by a bare `#else`.
  const fnStart = src.lastIndexOf('float getShadow( sampler2D shadowMap');
  if (fnStart < 0) return false;
  const selector = src.slice(src.lastIndexOf('\n\t#el', fnStart), fnStart);
  if (!selector.startsWith('\n\t#else')) return false;
  // the BASIC getShadow ends at the first line-leading `#endif` after the function
  const end = src.indexOf('\n\t#endif', fnStart);
  if (end < 0) return false;
  const mode = (globalThis as { __ATMO_SHADOWFILTER_MODE__?: string }).__ATMO_SHADOWFILTER_MODE__;
  const glsl = mode === 'depth' ? shadowDepthProbeGlsl(params) : shadowFilterGlsl(params);
  ShaderChunk.shadowmap_pars_fragment = src.slice(0, fnStart) + glsl + src.slice(end);
  installed = true;
  return true;
}
