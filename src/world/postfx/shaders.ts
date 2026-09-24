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
uniform vec2 uAirFade;     // world heights (m) between which the base-air in-scatter fades in
uniform vec2 uAirNear;     // marched distances (m) over which the AMBIENT base air ramps in (x >= y disables)
uniform vec2 uMistNear;    // marched distances (m) between which the mist-layer in-scatter ramps in (x >= y disables)
uniform vec2 uColumnNear;  // marched distances (m) over which a gained column's extra gain fades in
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
    // a gained column's boost is for seeing it from outside: in its first metres along the ray (a
    // camera standing in the shaft) it lights the air like a plain open column. Only the boost
    // above 1 moves, and only before the ramp's end: a column first met past uColumnNear.y, and
    // every plain column, draws exactly as before
    if ( t < uColumnNear.y && column > 1.0 ) column = mix( 1.0, column, smoothstep( uColumnNear.x, uColumnNear.y, t ) );
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
    // 2026-09-24 (the owner, 23:00: the lantern bough "just looks like a dead branch", the trunks
    // "cut in half, the top blurry and the bottom alright", the canopy "strange" when he looks up).
    // Isolated at his pose: with the rays off the bough band drops 17-18 levels and reads as wood,
    // while the ground mist is worth 0.8 and the height fog almost nothing there — the AMBIENT base
    // air is what washes the near field. The 09-15 attempt cut uRayIntensity and was backed out
    // because it dimmed the shafts too. This ramps the ambient air in with marched distance the way
    // the mist layer already can, and leaves a gained column (a real shaft, shafts.ts) alone at
    // every distance, so the beams are untouched and only the air between them thins near the eye.
    float airNear = uAirNear.y > uAirNear.x ? smoothstep( uAirNear.x, uAirNear.y, t ) : 1.0;
    float upperAir = max( smoothstep( uAirFade.x, uAirFade.y, pw.y ) * airNear, clamp( column - 1.0, 0.0, 1.0 ) );
    // optional ramp of the mist-layer in-scatter along the ray (see ComposerSettings.rayMistNearStart;
    // off in production): with every surface black the rays + mist add 0.05 display to D's 9–17 m
    // floor (0.209 → 0.260) and 0.02 to B's, but ramping the mist in over 6–18 m cost −0.006 SSIM
    // on both views on top of the veil change it was paired with — the near glow is part of D's look
    float mistNear = uMistNear.y > uMistNear.x ? smoothstep( uMistNear.x, uMistNear.y, t ) : 1.0;
    float dens = uDensity.x * height * mix( 0.35, 1.0, north ) * mistNear + uDensity.y * clear * upperAir;
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
 *
 * The last pass also lays the screen-anchored shaft fan (atmosphere/shafts.ts SCREEN_FAN) over the
 * result: the footage's beams keep one screen geometry in every heading, so the smoothed in-scatter
 * (how much lit air the pixel looks through) keeps `floor` of itself under the fan and a fixed field
 * of soft leaning beams is ADDED on top (amplitude set per frame by the composer from the view's
 * phase toward the sun), blending back to the plain march low in the frame.
 */
export const RAY_BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSunUv;
uniform float uDirSign;
uniform float uLength;   // smear length in uv
uniform float uGamma;    // > 1 on the last pass: contrast curve so beams read as slabs, not glow
uniform float uDepthK;   // tap weight = exp( -|Δ marched length| * uDepthK ), lengths in units of uMaxDist
uniform vec2 uTexel;
uniform vec4 uFan;       // ( sin lean, cos lean, frame aspect W/H, mix: 0 = no fan on this pass )
uniform vec4 uFanFade;   // ( share of the marched in-scatter kept under the fan, frame y where the fan starts fading, where it is gone, in-scatter added on the hero beam's axis )
uniform vec4 uFanBeams[ FAN ]; // per beam: ( x intercept at the top edge (uv), extent from the axis in frame heights, gain, unused )
varying vec2 vUv;
#define NS 12
// x = the beams' sum (gain-weighted soft bumps), y = how far the fan has faded out toward the bottom of the frame
vec2 fanField( vec2 uv ) {
  // frame coordinates (y down from the top edge, x scaled by the aspect) so the beams' intercepts
  // are on the top edge and the lean is a true angle on screen
  vec2 p = vec2( uv.x * uFan.z, 1.0 - uv.y );
  vec2 n = vec2( uFan.y, -uFan.x ); // normal to the beam direction ( sin, cos )
  float f = 0.0;
  for ( int i = 0; i < FAN; i ++ ) {
    vec4 b = uFanBeams[ i ];
    if ( b.z <= 0.0 ) continue;
    float off = abs( dot( p - vec2( b.x * uFan.z, 0.0 ), n ) );
    // soft bump, half-max at half the extent: the reference's beams have no flat core or hard edge
    f += b.z * ( 1.0 - smoothstep( 0.0, b.y, off ) );
  }
  return vec2( f, smoothstep( uFanFade.y, uFanFade.z, p.y ) );
}
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
  float o = pow( clamp( v, 0.0, 1.0 ), uGamma );
  // the screen-anchored fan: the marched air keeps uFanFade.x of its glow under the fan and the beams
  // are added on top, cut only by NEAR surfaces (frame D's hero beam lies at full strength across
  // the trunks 10–15 m behind it — marched length 0.33 of the 40 m march — so the weight saturates
  // at a quarter of the march; Link's head, the hanging leaves and the ground 2–5 m away still cut
  // the beams, which is where the reference's dissolve)
  vec2 fan = fanField( vUv );
  float under = uFan.w * ( 1.0 - fan.y );
  o = o * mix( 1.0, uFanFade.x, under ) + uFanFade.w * fan.x * under * smoothstep( 0.0, 0.25, c.y );
  gl_FragColor = vec4( clamp( o, 0.0, 1.0 ), c.y, 0.0, 1.0 );
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

/**
 * Separable Gaussian with a runtime sigma (texels). The kernel reaches `uReach` taps either side
 * (≥ 6, so sigma ≤ 3 keeps the 13-tap kernel it was tuned with; wider sigmas extend to 2 σ instead
 * of truncating into a box). All four channels (the haze blur carries its weight in alpha).
 */
export const GAUSS_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;    // texel-sized step
uniform float uSigma; // in texels
uniform float uReach; // taps either side (6 … 12)
varying vec2 vUv;
void main() {
  float k = -0.5 / max( uSigma * uSigma, 1e-4 );
  vec4 c = texture2D( tSrc, vUv );
  float wsum = 1.0;
  for ( int i = 1; i <= 12; i ++ ) {
    if ( float( i ) > uReach ) break;
    float w = exp( k * float( i * i ) );
    vec2 o = uDir * float( i );
    c += ( texture2D( tSrc, vUv + o ) + texture2D( tSrc, vUv - o ) ) * w;
    wsum += 2.0 * w;
  }
  gl_FragColor = c / wsum;
}
`;

/**
 * 320-grid weights: r = |luma(down − blur)| averaged over the 2×2 640-texels under this texel (the
 * fine-detail amplitude the activity blur then widens), g = haze-blur weight from the scene depth
 * (view distance ramped over uFarRange, sky = 1). Both are Gaussian-smoothed afterwards.
 */
const SOFT_FAR_WEIGHT = /* glsl */ `
uniform mat4 uProjInv;
uniform vec2 uFarRange; // view distance (m) where the haze blur starts / is full
float farWeight( vec2 uv ) {
  float d = texture2D( tDepth, uv ).x;
  if ( isSky( d ) ) return 1.0;
  vec4 p = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  return smoothstep( uFarRange.x, uFarRange.y, length( p.xyz / p.w ) );
}
`;
export const SOFT_ACTIVITY_FRAG = /* glsl */ `
${DEPTH_UTILS}
${SOFT_FAR_WEIGHT}
uniform sampler2D tDown;
uniform sampler2D tBlur;
uniform vec2 uTexel;    // 640-grid texel
varying vec2 vUv;
const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );
float fine( vec2 uv ) { return abs( dot( texture2D( tDown, uv ).rgb - texture2D( tBlur, uv ).rgb, LUMA ) ); }
void main() {
  vec2 o = uTexel * 0.5;
  float a = 0.25 * ( fine( vUv + o ) + fine( vUv - o ) + fine( vUv + vec2( o.x, -o.y ) ) + fine( vUv - vec2( o.x, -o.y ) ) );
  gl_FragColor = vec4( a, farWeight( vUv ), 0.0, 1.0 );
}
`;

/**
 * Round 34: the haze blur's source — (b1 · w, w) on the 320 grid, optionally premultiplied by the
 * far weight (uPremul). Blurring that and dividing by the blurred weight (normalised convolution)
 * averages far pixels only, so a near silhouette against the veil would no longer smear into the
 * hazed air beside it and the final pass could key the blur on the pixel's own depth (uFarMode).
 * MEASURED AND LEFT OFF: the 16 px-smoothed weight does soften every near edge bordering the veil
 * (shot E's near band kept 0.88 of its Laplacian variance, 1.0 with the stage off), but making
 * those edges crisp also makes the canopy's leaf/sky edges crisp (E very-far band 1.0 → 1.48× the
 * frame) and cost −0.003…−0.0045 SSIM in every view (per-band decomposition: all of it in the far
 * and very-far windows). The near-ground sharpening in SOFT_FINAL_FRAG is what recovered the near
 * band instead. Plain blur (uPremul 0) + smoothed weight (uFarMode 0) is the shipped path.
 */
export const SOFT_FAR_PREMUL_FRAG = /* glsl */ `
${DEPTH_UTILS}
${SOFT_FAR_WEIGHT}
uniform sampler2D tBlur; // the 640-grid Gaussian (b1)
uniform float uPremul;   // 1 = premultiply by the far weight (far pixels only), 0 = plain blur (weight 1)
varying vec2 vUv;
void main() {
  float w = mix( 1.0, farWeight( vUv ), uPremul );
  gl_FragColor = vec4( texture2D( tBlur, vUv ).rgb * w, w );
}
`;

export const SOFT_FINAL_FRAG = /* glsl */ `
${DEPTH_UTILS}
${SOFT_FAR_WEIGHT}
uniform sampler2D tSrc;      // anti-aliased LDR frame (full resolution)
uniform sampler2D tBlur;     // its 640-grid Gaussian (bilinear upsample)
uniform sampler2D tFar;      // 320-grid Gaussian of (b1 · farWeight, farWeight): the haze blur of the far pixels only
uniform sampler2D tWeights;  // wide-blurred (detail amplitude, haze-blur weight)
uniform vec3 uGate;          // detail floor, activity knee, power
uniform float uUniform;      // share of the 640-grid blur every pixel takes (video band-limit)
uniform vec3 uNearSharp;     // (gain, view distance where the near sharpening starts fading, where it is gone)
uniform float uFarMode;      // see wFar below
uniform float uDebug;        // 1 = show the weights (r = detail gate, g = haze weight)
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb;
  vec3 b1 = texture2D( tBlur, vUv ).rgb;
  vec4 far = texture2D( tFar, vUv );
  // far pixels only (normalised convolution); an isolated far pixel with no far neighbours keeps b1
  vec3 b2 = mix( b1, far.rgb / max( far.a, 1e-3 ), smoothstep( 0.0, 0.15, far.a ) );
  vec2 w = texture2D( tWeights, vUv ).rg;
  float g = uGate.x + ( 1.0 - uGate.x ) / ( 1.0 + pow( w.x / uGate.y, uGate.z ) );
  // the pixel's own view distance keys the haze blur (crisp near silhouettes against the veil)
  float d = texture2D( tDepth, vUv ).x;
  vec4 p = uProjInv * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  float dist = isSky( d ) ? 1e4 : length( p.xyz / p.w );
  float wPix = isSky( d ) ? 1.0 : smoothstep( uFarRange.x, uFarRange.y, dist );
  // haze-blur weight: 0 = the 320-grid-smoothed weight (softens both sides of a near/far silhouette),
  // 1 = the pixel's own weight (crisp both sides), 2 = the smoothed weight gated by the pixel's own
  // (near pixels crisp, the hazed side of the silhouette soft)
  float wFar = uFarMode < 0.5 ? w.y : ( uFarMode < 1.5 ? wPix : w.y * smoothstep( 0.0, 0.1, wPix ) );
  // near sharpening: the frames' near ground keeps more edge energy than ours (stone joints, chips,
  // Link's silhouette: A 0.70×, D 0.83×, E 0.88×, F 0.83× the frame's Laplacian variance below 6 m);
  // an unsharp mask on the 640-grid detail (σ 1.2 texels ≈ 2.4 px at 1280), fading out with distance
  // so the mid band (where A/C/D/F already exceed the frames) is left alone. Round 37b: gain 1.1
  // full below 3 m, gone by 8 m — W35 on B/E after the lantern bough left their frame; the SSIM
  // cost per unit of sharpness is lowest in this band (see composer.ts softNearSharp)
  g *= 1.0 + uNearSharp.x * ( 1.0 - smoothstep( uNearSharp.y, uNearSharp.z, dist ) );
  vec3 fine = b1 + ( c - b1 ) * g;
  vec3 near = mix( fine, b1, uUniform );
  vec3 o = mix( near, b2, wFar );
  gl_FragColor = vec4( mix( o, vec3( g * 0.5, wFar, 0.0 ), uDebug ), 1.0 );
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
uniform vec3 uAoNear;  // near-field AO strength, and the view distances (m) it eases to uAoStrength over
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
  float aoStrength = mix( uAoNear.x, uAoStrength, smoothstep( uAoNear.y, uAoNear.z, aoDist ) );
  hdr *= mix( 1.0, ao, aoStrength * ( 1.0 - sky ) * aoFade );
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
  float smin = min( s.r, min( s.g, s.b ) );
  float ssat = ( smax - smin ) / max( smax, 1e-4 );
  // the violets (palette.flowerPurple, the only hues here with green as the weakest channel) are
  // as vivid in the reference as ours: the knee would fade their 256×144 footprint under W18's
  // 0.3 % (measured 0.0029 compressed, 0.0037 exempt), so they keep their chroma
  bool violet = s.g <= smin + 1e-4;
  if ( ssat > uSatKnee.x && ! violet ) {
    float target = uSatKnee.x + ( ssat - uSatKnee.x ) * uSatKnee.y;
    s = mix( vec3( smax ), s, target / ssat );
  }
  gl_FragColor = vec4( s, 1.0 );
}
`;
