/**
 * GLSL for the post-processing chain (see composer.ts). All passes are pure functions of the
 * current frame (interleaved-gradient noise keyed on gl_FragCoord — no temporal jitter), which
 * keeps headless captures pixel-deterministic.
 */

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

const DEPTH_UTILS = /* glsl */ `
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
float viewZFromDepth( float d ) {
  // perspective: negative view-space z
  return ( uNear * uFar ) / ( ( uFar - uNear ) * d - uFar );
}
bool isSky( float d ) { return d >= 0.999999; }
float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
`;

/** Half-resolution screen-space ambient occlusion from the depth buffer (normals reconstructed). */
export const AO_FRAG = /* glsl */ `
${DEPTH_UTILS}
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uBias;
uniform float uPower;
varying vec2 vUv;
#define NS 10
vec3 viewPos( vec2 uv ) {
  float d = texture2D( tDepth, uv ).x;
  vec4 p = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  return p.xyz / p.w;
}
void main() {
  float d0 = texture2D( tDepth, vUv ).x;
  if ( isSky( d0 ) ) { gl_FragColor = vec4( 1.0 ); return; }
  vec3 P = viewPos( vUv );
  vec3 Pr = viewPos( vUv + vec2( uTexel.x, 0.0 ) );
  vec3 Pl = viewPos( vUv - vec2( uTexel.x, 0.0 ) );
  vec3 Pu = viewPos( vUv + vec2( 0.0, uTexel.y ) );
  vec3 Pd = viewPos( vUv - vec2( 0.0, uTexel.y ) );
  vec3 dx = abs( Pr.z - P.z ) < abs( P.z - Pl.z ) ? Pr - P : P - Pl;
  vec3 dy = abs( Pu.z - P.z ) < abs( P.z - Pd.z ) ? Pu - P : P - Pd;
  vec3 N = normalize( cross( dx, dy ) );
  if ( dot( N, -P ) < 0.0 ) N = -N;

  float ang = ign( gl_FragCoord.xy ) * 6.2831853;
  vec3 rnd = vec3( cos( ang ), sin( ang ), 0.37 );
  vec3 T = normalize( rnd - N * dot( rnd, N ) );
  vec3 B = cross( N, T );
  // radius shrinks a little with distance so far geometry does not turn into a dark halo
  float dist = -P.z;
  float radius = uRadius * clamp( 1.0 - dist / 120.0, 0.35, 1.0 );
  float occ = 0.0;
  for ( int i = 0; i < NS; i ++ ) {
    float fi = float( i );
    float r = sqrt( ( fi + 0.5 ) / float( NS ) );           // uniform disc → hemisphere
    float th = fi * 2.399963 + ang;
    float z = 0.25 + 0.75 * fract( fi * 0.618034 + 0.2 );  // bias upward
    vec3 k = normalize( vec3( cos( th ) * r, sin( th ) * r, z ) ) * ( 0.25 + 0.75 * fract( fi * 0.7548776 ) );
    vec3 s = P + ( T * k.x + B * k.y + N * k.z ) * radius;
    vec4 o = uProj * vec4( s, 1.0 );
    vec2 suv = o.xy / o.w * 0.5 + 0.5;
    if ( any( lessThan( suv, vec2( 0.0 ) ) ) || any( greaterThan( suv, vec2( 1.0 ) ) ) ) continue;
    float sd = texture2D( tDepth, suv ).x;
    float sz = viewZFromDepth( sd );
    float rangeCheck = smoothstep( 0.0, 1.0, radius / max( abs( P.z - sz ), 1e-4 ) );
    occ += ( sz >= s.z + uBias ? 1.0 : 0.0 ) * rangeCheck;
  }
  float ao = 1.0 - occ / float( NS );
  ao = pow( clamp( ao, 0.0, 1.0 ), uPower );
  gl_FragColor = vec4( vec3( ao ), 1.0 );
}
`;

/** 3×3 depth-aware blur of the AO term (half resolution). */
export const AO_BLUR_FRAG = /* glsl */ `
${DEPTH_UTILS}
uniform sampler2D tAO;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float d0 = texture2D( tDepth, vUv ).x;
  if ( isSky( d0 ) ) { gl_FragColor = vec4( 1.0 ); return; }
  float z0 = viewZFromDepth( d0 );
  float sum = 0.0;
  float wsum = 0.0;
  for ( int y = -1; y <= 1; y ++ ) {
    for ( int x = -1; x <= 1; x ++ ) {
      vec2 uv = vUv + vec2( float( x ), float( y ) ) * uTexel;
      float z = viewZFromDepth( texture2D( tDepth, uv ).x );
      float w = exp( -abs( z - z0 ) * 4.0 / max( -z0 * 0.05, 0.05 ) );
      sum += texture2D( tAO, uv ).x * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4( vec3( sum / max( wsum, 1e-4 ) ), 1.0 );
}
`;

/**
 * Volumetric god rays: march each view ray (quarter res, 24 jittered steps, up to uMaxDist or the
 * scene surface) and accumulate sun light that reaches the haze, testing the sun's shadow map at
 * every step. Canopy, trunks and the lantern branch therefore carve real beams; the haze density
 * follows the same height-fog model as heightfog.ts (denser low and in the north hollow) plus a
 * base so shafts also read in the upper air. That base follows heightfog's aerosol profile —
 * uniform under the canopy, clearing exponentially above it — so a column that climbs into the
 * open air above the crowns accumulates far less than an eye-level column of the same length.
 *
 * Two things make the beams read as distinct shafts rather than a depth-proportional wash:
 *  - single-scattering transmittance: each step's in-scatter is attenuated by the haze between it
 *    and the camera (uExtinction), so the nearest 10–20 m of lit air dominate a column and the
 *    beams they hold project large and separate on screen instead of averaging out over 50 m;
 *  - a canopy-gap mask (`beamMask`): the crowns overhead are built from thousands of small leaf
 *    cards, so the shadow map alone gives every column the same ≈ 50 % lit fraction. The mask is a
 *    fixed world-space field of broad gaps evaluated in the plane perpendicular to the sun (so a
 *    gap is a column of lit air along the sun direction — 1.5–3 m wide, a few metres apart, as in
 *    the reference's 3–5 shafts), multiplied into the shadow test: the real geometry still carves
 *    and blocks the beams, the mask decides where the canopy is dense and where it opens. Air
 *    outside a gap keeps a small floor (light leaking through leaves). The columns the trees
 *    system carved real corridors for (atmosphere/shafts.ts) are forced open in the mask.
 * A Henyey–Greenstein phase term makes the shafts strongest when looking toward the sun (shots A,
 * B, D); past `uBackScatter.y` the haze's back-scatter lobe dims the in-scatter so shot C, looking
 * away from the sun, is not washed by the lit air in front of it.
 *
 * Output: x = in-scatter (0..1), y = marched length / uMaxDist (the smear pass weights its taps by
 * this so beams in front of a near trunk are not overwritten by the long sky columns beside it).
 */
export const RAY_MARCH_FRAG = /* glsl */ `
${DEPTH_UTILS}
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform mat4 uShadowMatrix;
uniform sampler2D tShadow;   // the sun's raw depth map (BasicShadowMap; compared here by hand)
uniform vec3 uSunDirView;
uniform vec3 uSunRight;    // world basis of the plane perpendicular to the sun
uniform vec3 uSunUp;
uniform float uMaxDist;
uniform vec4 uFogParams;   // baseHeight, falloff, northStartZ, northFullZ
uniform vec2 uDensity;     // height-fog density weight, base air density
uniform vec2 uAltitude;    // aerosol profile: uniform height (m), scale height (m) above it
uniform float uAnisotropy;
uniform vec2 uBackScatter; // back-scatter lobe: min multiplier, -cos of the angle where it saturates
uniform float uExtinction; // haze extinction (1/m) attenuating in-scatter on its way to the camera
uniform vec4 uBeam;        // gap-mask frequency (1/m), threshold lo, threshold hi, floor outside gaps
uniform float uBeamNoiseMax; // openness of the noise gaps (the fixed columns are always fully open)
uniform vec3 uFarAir;      // (start m, end m, mean openness): past the end the gap pattern is replaced by its mean
uniform vec2 uGapHollow;   // world z where the canopy closes over the north hollow: gaps start fading / are gone
uniform vec4 uGaps[ GAPS ]; // fixed open columns: (sun-plane x, sun-plane y, radius m, in-scatter gain); radius 0 = unused
varying vec2 vUv;
#define STEPS 24
float hash21( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float vnoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash21( i ), hash21( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash21( i + vec2( 0.0, 1.0 ) ), hash21( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
// canopy gaps as seen along the sun: x = the noise field of broad blobs (the leaf masses between
// them are 2–4× wider) with a ragged second octave so the shaft edges are not perfectly smooth,
// open to uBeamNoiseMax at most; y = the fixed columns (uGaps) the trees system carved corridors
// for — fully open (1) times the column's gain, so the bold shafts sit exactly where the canopy
// actually has a hole and the narrow, side-lit columns of shot F still read
vec2 beamMask( vec3 pw ) {
  vec2 q = vec2( dot( pw, uSunRight ), dot( pw, uSunUp ) );
  vec2 qn = q * uBeam.x;
  float n = vnoise( qn ) * 0.62 + vnoise( qn * 2.13 + vec2( 7.7, 3.1 ) ) * 0.26 + vnoise( qn * 4.7 + vec2( 1.3, 9.2 ) ) * 0.12;
  float m = smoothstep( uBeam.y, uBeam.z, n ) * uBeamNoiseMax;
  float col = 0.0;
  for ( int i = 0; i < GAPS; i ++ ) {
    float r = uGaps[ i ].z;
    if ( r <= 0.0 ) continue;
    col = max( col, uGaps[ i ].w * ( 1.0 - smoothstep( r * 0.7, r, length( q - uGaps[ i ].xy ) ) ) );
  }
  return vec2( m, col );
}
void main() {
  float d = texture2D( tDepth, vUv ).x;
  vec4 p = uProjInv * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  vec3 P = p.xyz / p.w;
  float surf = isSky( d ) ? uMaxDist : length( P );
  float maxDist = min( surf, uMaxDist );
  vec3 dir = normalize( P );
  float cosSun = dot( dir, uSunDirView );
  float g = uAnisotropy;
  float phase = ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * cosSun, 1.5 );
  float jitter = ign( gl_FragCoord.xy );
  float stepLen = maxDist / float( STEPS );
  float acc = 0.0;
  for ( int i = 0; i < STEPS; i ++ ) {
    float t = ( float( i ) + jitter ) * stepLen;
    vec4 pw = uViewInv * vec4( dir * t, 1.0 );
    vec4 sc = uShadowMatrix * pw;
    sc.xyz /= sc.w;
    float lit = 1.0;
    if ( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0 ) {
      lit = step( sc.z - 0.0006, texture2D( tShadow, sc.xy ).r );
    }
    // the noise gap pattern only carries beams in the near air and under the open plaza canopy:
    // past uFarAir.x along the ray, and north of uGapHollow.x in the world (the crowns close over
    // the hollow), it fades to its mean openness, so the sunlit air in front of shot D's arch is a
    // smooth veil — measured on the arch body, the 5–25 m gaps printed ±0.017 luminance stripes on
    // a +0.08 ray term where the reference's arch is flat and its hollow a diffuse glow. The fixed
    // columns are real holes and keep their full length (shot F's far column sits 29–31 m out)
    vec2 bm = beamMask( pw.xyz );
    float column = bm.y;
    float toMean = max( smoothstep( uFarAir.x, uFarAir.y, t ), 1.0 - smoothstep( uGapHollow.y, uGapHollow.x, pw.z ) );
    float mask = max( mix( bm.x, uFarAir.z, toMean ), column );
    lit *= mix( uBeam.w, 1.0, mask );
    float north = 1.0 - smoothstep( uFogParams.w, uFogParams.z, pw.z ); // hollow is at lower z
    float height = exp( -max( pw.y - uFogParams.x, 0.0 ) * uFogParams.y );
    float clear = exp( -max( pw.y - uAltitude.x, 0.0 ) / uAltitude.y );
    // the shafts are an upper-air effect: the reference's beams read against the canopy and the
    // hazed trunks while the sunlit plaza and path below them stay crisp, so the base-air in-scatter
    // fades out in the lowest ≈ 4 m (eye-level rays to the ground cross only that air) — the ground
    // mist keeps its own profile. Inside a gained canopy-hole column (gain > 1, shafts.ts) the air
    // stays lit down to the ground — the reference's F shafts land on the stairs. The plain plaza
    // columns keep the fade: shot D's rays to the arch cross their 2.5–4 m air, and lighting it
    // striped the arch body
    float upperAir = max( smoothstep( 1.5, 4.5, pw.y ), clamp( column - 1.0, 0.0, 1.0 ) );
    float dens = uDensity.x * height * mix( 0.35, 1.0, north ) + uDensity.y * clear * upperAir;
    acc += lit * dens * stepLen * exp( -uExtinction * t );
  }
  // the phase term is normalised to 1 at 90° from the sun so uRayIntensity means "strength of a
  // fully lit column"; in-scatter saturates (1 - e^-x) so sun-facing sky columns cannot blow out.
  // Past 90° the same back-scatter lobe as the distance haze takes over (the HG term alone is
  // nearly flat at this anisotropy), so the shafts and the veil dim together behind the camera
  float phaseN = phase * pow( 1.0 + g * g, 1.5 ) / ( 1.0 - g * g );
  float back = mix( 1.0, uBackScatter.x, smoothstep( 0.0, uBackScatter.y, -cosSun ) );
  float rays = 1.0 - exp( -acc * ( 0.35 + 0.65 * phaseN ) * back );
  gl_FragColor = vec4( clamp( rays, 0.0, 1.0 ), maxDist / uMaxDist, 0.0, 1.0 );
}
`;

/**
 * Smoothing of the ray-march result along the screen-space direction to the sun (beams converge on
 * the sun, so smearing along that axis removes the march's jitter without blurring across beams).
 * Taps are weighted by how close their marched length (y channel) is to this pixel's: a beam in
 * front of a trunk 13 m away is only the air in front of that trunk, so the long, fully lit sky
 * columns beside it must not smear across it (the reference's near bark stays dark against bright
 * gaps). When the sun is behind the camera `uSunUv` holds the anti-solar point and the smear runs
 * away from it (uDirSign = -1).
 */
export const RAY_BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSunUv;
uniform float uDirSign;
uniform float uLength;   // smear length in uv
uniform float uGamma;    // > 1 on the last pass: contrast curve so beams read as slabs, not glow
uniform float uDepthK;   // tap weight = exp( -|Δ marched length| * uDepthK ), lengths in units of uMaxDist
uniform vec2 uTexel;
varying vec2 vUv;
#define NS 12
void main() {
  vec2 c = texture2D( tSrc, vUv ).xy;
  vec2 toSun = ( uSunUv - vUv ) * uDirSign;
  float len = length( toSun );
  vec2 dir = len > 1e-4 ? toSun / len : vec2( 0.0, 1.0 );
  float step = uLength / float( NS );
  float sum = 0.0;
  float wsum = 0.0;
  for ( int i = 0; i < NS; i ++ ) {
    float f = ( float( i ) + 0.5 ) / float( NS );
    vec2 uv = vUv + dir * ( f * step * float( NS ) );
    vec2 outside = max( max( -uv, uv - 1.0 ), 0.0 );
    float fade = 1.0 - smoothstep( 0.0, 0.02, max( outside.x, outside.y ) );
    vec2 s = texture2D( tSrc, clamp( uv, 0.0, 1.0 ) ).xy;
    float w = ( 1.0 - f * 0.6 ) * exp( -abs( s.y - c.y ) * uDepthK );
    sum += s.x * w * fade;
    wsum += w;
  }
  // cross-axis taps: merge the canopy's fine lit/unlit streaks into broader slabs (the reference
  // shows 3–5 beams 5–12 % of the frame wide) and soften the march jitter — kept narrow (≈ 1.4
  // quarter-res texels on the long pass) so the gap mask's beam edges survive
  vec2 perp = vec2( -dir.y, dir.x ) * uTexel * uLength * 10.0;
  float side = 0.0;
  float sideW = 0.0;
  for ( int j = 0; j < 4; j ++ ) {
    vec2 o = perp * ( j < 2 ? 1.0 : 2.0 ) * ( ( j == 0 || j == 2 ) ? 1.0 : -1.0 );
    vec2 s = texture2D( tSrc, vUv + o ).xy;
    float w = ( j < 2 ? 1.0 : 0.5 ) * exp( -abs( s.y - c.y ) * uDepthK );
    side += s.x * w;
    sideW += w;
  }
  float v = ( sum / max( wsum, 1e-4 ) ) * 0.55 + ( side / max( sideW, 1e-4 ) ) * 0.45;
  gl_FragColor = vec4( pow( clamp( v, 0.0, 1.0 ), uGamma ), c.y, 0.0, 1.0 );
}
`;

/** Debug blit of an intermediate buffer (grey → sRGB) — only used when a debug view is requested. */
export const COPY_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform float uScale;
varying vec2 vUv;
void main() {
  vec3 c = clamp( texture2D( tSrc, vUv ).rgb * uScale, 0.0, 1.0 );
  gl_FragColor = vec4( pow( c, vec3( 1.0 / 2.2 ) ), 1.0 );
}
`;

/**
 * Debug: the sun's shadow depth map (nearer to the sun = brighter). `uRect` selects the uv window
 * shown, `uDepthCenter` / `uDepthScale` the depth mapped to mid-grey and the contrast around it.
 */
export const SHADOWMAP_DEBUG_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec4 uRect;
uniform float uDepthCenter;
uniform float uDepthScale;
uniform float uRaw;
varying vec2 vUv;
void main() {
  float d = texture2D( tSrc, mix( uRect.xy, uRect.zw, vUv ) ).r;
  if ( uRaw > 0.5 ) {
    gl_FragColor = vec4( d, 0.0, 0.0, 1.0 );
    return;
  }
  gl_FragColor = vec4( vec3( clamp( 0.5 + ( uDepthCenter - d ) * uDepthScale, 0.0, 1.0 ) ), 1.0 );
}
`;

/** Debug: view distance / 64 m as grey (sky = 1) — for offline tuning of the depth-keyed softening. */
export const DEPTH_DEBUG_FRAG = /* glsl */ `
${DEPTH_UTILS}
uniform mat4 uProjInv;
varying vec2 vUv;
void main() {
  float d = texture2D( tDepth, vUv ).x;
  float dist = 64.0;
  if ( ! isSky( d ) ) {
    vec4 p = uProjInv * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
    dist = length( p.xyz / p.w );
  }
  gl_FragColor = vec4( vec3( clamp( dist / 64.0, 0.0, 1.0 ) ), 1.0 );
}
`;

/** Bloom bright pass with a soft knee (quarter resolution). */
export const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb;
  float l = max( max( c.r, c.g ), c.b );
  float soft = clamp( l - uThreshold + uKnee, 0.0, 2.0 * uKnee );
  soft = soft * soft / ( 4.0 * uKnee + 1e-4 );
  float contrib = max( soft, l - uThreshold ) / max( l, 1e-4 );
  gl_FragColor = vec4( c * contrib, 1.0 );
}
`;

/** Separable 9-tap Gaussian. */
export const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir; // texel-sized step
varying vec2 vUv;
void main() {
  const float w[5] = float[5]( 0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162 );
  vec3 c = texture2D( tSrc, vUv ).rgb * w[0];
  for ( int i = 1; i < 5; i ++ ) {
    vec2 o = uDir * float( i );
    c += texture2D( tSrc, vUv + o ).rgb * w[i];
    c += texture2D( tSrc, vUv - o ).rgb * w[i];
  }
  gl_FragColor = vec4( c, 1.0 );
}
`;

/**
 * Video softness (final LDR stage). The reference frames are soft 1280×716 video of a hazy scene,
 * and measured against them (3×3 Laplacian variance at 256×144) our frames were 1.0–1.5× as sharp:
 * the excess is not the near flagstones but (a) hazed mid-distance foliage — leaf cards 10–40 m out
 * still have crisp silhouettes where the reference's veiled forest is a flat wash — and (b) busy
 * near texture (grass, ivy) the codec turns to mush. Three terms on a fixed 640/320-wide grid (so
 * every radius is a share of the frame, not of the device pixel):
 *   b1 = G(c) on the 640 grid, h = c − b1 (everything finer than ≈ 1/200 of the frame);
 *   activity gate: a = G_wide(|luma(h)|), g = detail + (1 − detail) / (1 + (a / k)^p),
 *     fine = b1 + h · g — a quiet region keeps its detail, a busy one only `detail` of it;
 *   uniform band-limit: near = mix(fine, b1, u) — the video's own optics/codec softness;
 *   haze blur: far = G_wide(smoothstep(d0, d1, viewDistance)), out = mix(near, b2, far) with b2 the
 *     320-grid Gaussian — the aerosol's small-angle forward scattering, which is what flattens the
 *     reference's distant detail while its near edges keep most of theirs. The weight is smoothed on
 *     the 320 grid so a near leaf against far haze softens gradually instead of ringing.
 */
export const BLIT_FRAG = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4( texture2D( tSrc, vUv ).rgb, 1.0 );
}
`;

/** Separable Gaussian with a runtime sigma (texels), 9 taps: sigma ≤ 2 stays inside the kernel. */
export const GAUSS_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;    // texel-sized step
uniform float uSigma; // in texels
varying vec2 vUv;
void main() {
  float k = -0.5 / max( uSigma * uSigma, 1e-4 );
  vec3 c = texture2D( tSrc, vUv ).rgb;
  float wsum = 1.0;
  for ( int i = 1; i <= 4; i ++ ) {
    float w = exp( k * float( i * i ) );
    vec2 o = uDir * float( i );
    c += ( texture2D( tSrc, vUv + o ).rgb + texture2D( tSrc, vUv - o ).rgb ) * w;
    wsum += 2.0 * w;
  }
  gl_FragColor = vec4( c / wsum, 1.0 );
}
`;

/**
 * 320-grid weights: r = |luma(down − blur)| averaged over the 2×2 640-texels under this texel (the
 * fine-detail amplitude the activity blur then widens), g = haze-blur weight from the scene depth
 * (view distance ramped over uFarRange, sky = 1). Both are Gaussian-smoothed afterwards.
 */
export const SOFT_ACTIVITY_FRAG = /* glsl */ `
${DEPTH_UTILS}
uniform sampler2D tDown;
uniform sampler2D tBlur;
uniform mat4 uProjInv;
uniform vec2 uTexel;    // 640-grid texel
uniform vec2 uFarRange; // view distance (m) where the haze blur starts / is full
varying vec2 vUv;
const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );
float fine( vec2 uv ) { return abs( dot( texture2D( tDown, uv ).rgb - texture2D( tBlur, uv ).rgb, LUMA ) ); }
void main() {
  vec2 o = uTexel * 0.5;
  float a = 0.25 * ( fine( vUv + o ) + fine( vUv - o ) + fine( vUv + vec2( o.x, -o.y ) ) + fine( vUv - vec2( o.x, -o.y ) ) );
  float d = texture2D( tDepth, vUv ).x;
  float far = 1.0;
  if ( ! isSky( d ) ) {
    vec4 p = uProjInv * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
    far = smoothstep( uFarRange.x, uFarRange.y, length( p.xyz / p.w ) );
  }
  gl_FragColor = vec4( a, far, 0.0, 1.0 );
}
`;

export const SOFT_FINAL_FRAG = /* glsl */ `
uniform sampler2D tSrc;      // anti-aliased LDR frame (full resolution)
uniform sampler2D tBlur;     // its 640-grid Gaussian (bilinear upsample)
uniform sampler2D tFar;      // its 320-grid Gaussian (the haze blur)
uniform sampler2D tWeights;  // wide-blurred (detail amplitude, haze-blur weight)
uniform vec3 uGate;          // detail floor, activity knee, power
uniform float uUniform;      // share of the 640-grid blur every pixel takes (video band-limit)
uniform float uDebug;        // 1 = show the weights (r = detail gate, g = haze weight)
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb;
  vec3 b1 = texture2D( tBlur, vUv ).rgb;
  vec3 b2 = texture2D( tFar, vUv ).rgb;
  vec2 w = texture2D( tWeights, vUv ).rg;
  float g = uGate.x + ( 1.0 - uGate.x ) / ( 1.0 + pow( w.x / uGate.y, uGate.z ) );
  vec3 fine = b1 + ( c - b1 ) * g;
  vec3 near = mix( fine, b1, uUniform );
  vec3 o = mix( near, b2, w.y );
  gl_FragColor = vec4( mix( o, vec3( g, w.y, 0.0 ), uDebug ), 1.0 );
}
`;

/** Composite: AO · HDR + mist + rays + bloom → ACES → subtle grade → sRGB. */
export const COMPOSITE_FRAG = /* glsl */ `
${DEPTH_UTILS}
uniform sampler2D tHDR;
uniform sampler2D tAO;
uniform sampler2D tMist;
uniform sampler2D tRays;
uniform sampler2D tBloom;
uniform float uAoStrength;
uniform vec2 uAoFade;  // view distance (m) where the AO term starts fading / is gone
uniform float uHasMist;
uniform vec3 uRayColor;
uniform float uRayIntensity;
uniform float uRaySkyShare;
uniform float uBloomIntensity;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform float uContrastPivot;
uniform float uLift;
uniform float uGreenWarm;
uniform float uGreenDesat;
uniform vec2 uSatKnee;  // (knee, slope): HSV saturation above the knee keeps slope × its excess
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
varying vec2 vUv;

vec3 aces( vec3 c ) {
  const mat3 inM = mat3( 0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777 );
  const mat3 outM = mat3( 1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602 );
  c = inM * c;
  vec3 a = c * ( c + 0.0245786 ) - 0.000090537;
  vec3 b = c * ( 0.983729 * c + 0.4329510 ) + 0.238081;
  c = outM * ( a / b );
  return clamp( c, 0.0, 1.0 );
}
vec3 linearToSRGB( vec3 c ) {
  vec3 lo = c * 12.92;
  vec3 hi = pow( c, vec3( 1.0 / 2.4 ) ) * 1.055 - 0.055;
  return mix( hi, lo, step( c, vec3( 0.0031308 ) ) );
}

void main() {
  vec3 hdr = texture2D( tHDR, vUv ).rgb;
  float d = texture2D( tDepth, vUv ).x;
  float sky = isSky( d ) ? 1.0 : 0.0;
  float ao = texture2D( tAO, vUv ).x;
  // AO is a surface term multiplied into an already-veiled colour: at 45 m it printed the log
  // arch's ridge/furrow crevices as ±0.025 stripes on top of a 59 % haze the reference shows flat.
  // Sub-metre crevice shading is not resolvable through 30+ m of haze, so the term fades out
  float aoDist = -viewZFromDepth( d );
  float aoFade = 1.0 - smoothstep( uAoFade.x, uAoFade.y, aoDist );
  hdr *= mix( 1.0, ao, uAoStrength * ( 1.0 - sky ) * aoFade );
  if ( uHasMist > 0.5 ) {
    vec4 mist = texture2D( tMist, vUv );
    hdr = hdr * ( 1.0 - mist.a ) + mist.rgb;
  }
  // volumetric in-scatter accumulated along the ray up to the surface (see RAY_MARCH_FRAG); the
  // sky already carries its own haze so open-sky columns get a small share of the beams (the
  // reference's canopy gaps peak at ≈ 0.66 luminance — never a blown-out white)
  float rays = texture2D( tRays, vUv ).x;
  hdr += rays * uRayColor * uRayIntensity * mix( 1.0, uRaySkyShare, sky );
  hdr += texture2D( tBloom, vUv ).rgb * uBloomIntensity;

  // gentle channel mix: bleeds a little green into red (lime → olive/gold like the reference's
  // sunlit foliage) without touching neutrals (rows sum to 1) — not an orange/teal split
  const mat3 warmMix = mat3( 0.92, 0.02, 0.00,
                             0.10, 0.98, 0.04,
                            -0.02, 0.00, 0.96 );
  hdr = warmMix * hdr;
  vec3 c = aces( hdr * uExposure / 0.6 );
  float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  // selective: the reference's foliage is olive/khaki, never lime — pull green-dominant pixels a
  // little toward gold and soften their saturation; neutrals, golds and purples are untouched
  float gd = clamp( ( c.g - max( c.r, c.b ) ) / max( c.g, 1e-3 ) * 2.0, 0.0, 1.0 );
  c.r += gd * uGreenWarm * ( c.g - c.r );
  c = mix( c, vec3( lum ), gd * uGreenDesat );
  c = mix( vec3( lum ), c, uSaturation );
  // filmic contrast: a power curve about linear mid grey applied to luminance only (chroma ratios
  // are kept, so hue and saturation do not drift). > 1 deepens the toe more than it lifts the
  // highlights; < 1 lifts the blacks and softens the top end.
  float lum2 = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  float curved = uContrastPivot * pow( max( lum2, 1e-5 ) / uContrastPivot, uContrast );
  c *= curved / max( lum2, 1e-5 );
  c *= mix( uShadowTint, uHighlightTint, smoothstep( 0.05, 0.85, curved ) );
  // lifted blacks: the reference's darkest 2 % sits at 0.12–0.19 display luminance (video toe);
  // a pedestal that fades out by mid grey keeps the highlights where the sun puts them
  c += uLift * ( 1.0 - smoothstep( 0.0, 0.3, curved ) );
  c = clamp( c, 0.0, 1.0 );
  vec3 s = linearToSRGB( c );
  // chroma knee in the encoded (display) domain, where the reference is measured: its stone sits at
  // HSV saturation ≈ 0.35 but its foliage never runs to ours (0.45+), so saturation above the knee
  // is compressed toward it (hue and the max channel are kept)
  float smax = max( s.r, max( s.g, s.b ) );
  float ssat = ( smax - min( s.r, min( s.g, s.b ) ) ) / max( smax, 1e-4 );
  if ( ssat > uSatKnee.x ) {
    float target = uSatKnee.x + ( ssat - uSatKnee.x ) * uSatKnee.y;
    s = mix( vec3( smax ), s, target / ssat );
  }
  gl_FragColor = vec4( s, 1.0 );
}
`;
