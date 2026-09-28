#version 300 es
precision highp float;
precision highp int;

#define BAND_COUNT 4
const int MODE_UV = 0, MODE_SCREEN = 1, MODE_AXIS = 2, MODE_TRIPLANAR = 3;

uniform float uBandPos[BAND_COUNT];
uniform float uTransWidth[BAND_COUNT];
uniform float uBandMul[BAND_COUNT + 1];

uniform vec2  uUVScale;
uniform vec2  uResolution;
uniform vec2  uTexel;
uniform bool  uUseRest;
uniform mat3  uAxisBasis;
uniform float uTriSharpness;
uniform vec3  uAxisScale;

uniform float uSoft;
uniform float uNormalQuantAmount;

uniform float uInkOffsetPx;
uniform vec3  uInkTint;

uniform float uFloorPx;
uniform float uDepthGain;
uniform vec2  uOffsetDir;

uniform float uTrailGain;
uniform float uTrailMaxPx;

uniform sampler2D uBeauty;
uniform sampler2D uPalette;

in vec2 vUv;
out vec4 fragColor;

// Thresher core. luma = lighting term (NOT beauty). screen = Hatcher pattern in [0,1].
// uBandPos[i] = luma of band edge i; uTransWidth[i] = width of its dithered transition;
// uBandMul[0..BAND_COUNT] = the multiplier for each of the BAND_COUNT+1 resulting bands.
// Returns a multiplier around 1.0, to be applied to beauty with a plain multiply.
float thresher(float luma, float screen)
{
    // Count how many band edges this pixel is above. Each crossing is dithered by the
    // screen, so the boundary between band k and k+1 breaks up into dots or hatch lines
    // instead of being a hard contour.
    float idx = 0.0;
    for (int i = 0; i < BAND_COUNT; ++i) {
        float tw = max(uTransWidth[i], 1e-4);
        // position within edge i's transition zone, in [0,1]
        float t  = clamp((luma - (uBandPos[i] - 0.5 * tw)) / tw, 0.0, 1.0);
        idx += step(screen, t);
    }
    return uBandMul[int(idx)];
}

// Square dot lattice rotated by uScreenAngle, pitch uPitch (in the chosen projection space).
// Returns a smooth 0..1 "screen value": 0 at dot centres, 1 midway between dots.
float dotScreen(vec2 q, float pitch, float angleRad)
{
    float c = cos(angleRad), s = sin(angleRad);
    vec2  r = mat2(c, -s, s, c) * q / pitch;
    vec2  f = fract(r) - 0.5;
    float d = length(f) * 2.0;        // 0 at centre, ~1 at the cell edge
    return clamp(d, 0.0, 1.0);
}

// Hatcher projection. Returns the 2D coordinate to screen in.
vec2 hatcherCoord(int mode, vec3 P, vec3 Pref, vec3 N, vec2 uv, vec2 screenUV,
                  mat3 objInv, vec3 objCentre)
{
    if (mode == MODE_UV)     return uv * uUVScale;
    if (mode == MODE_SCREEN) return screenUV * uResolution;   // pitch in device px
    vec3 Po = objInv * ((uUseRest ? Pref : P) - objCentre);    // object-locked
    if (mode == MODE_AXIS)   return (uAxisBasis * Po).xy;
    // tri-planar: blend the three planar projections by |N|, per-axis scales
    vec3 w = pow(abs(N), vec3(uTriSharpness));
    w /= (w.x + w.y + w.z);
    return w.x * Po.zy * uAxisScale.x
         + w.y * Po.xz * uAxisScale.y
         + w.z * Po.xy * uAxisScale.z;
}

// Keep the projected pitch inside [minPx, maxPx] of screen space by octave-doubling,
// which is the "bifurcation" behaviour: too coarse -> split into more, finer dots.
float bifurcatedPitch(vec2 q, float basePitch, float minPx, float maxPx)
{
    float pxPerUnit = 1.0 / max(length(fwidth(q)), 1e-6);   // screen px per q unit
    float pitchPx   = basePitch * pxPerUnit;
    float octaves   = 0.0;
    if (pitchPx > maxPx) octaves =  ceil(log2(pitchPx / maxPx));
    if (pitchPx < minPx) octaves = -ceil(log2(minPx / pitchPx));
    return basePitch * exp2(-octaves);
}

// Anisotropic pitch normalisation: scale each axis of q by its own screen-space
// derivative, so a lattice seen at a grazing angle keeps round dots.
vec2 isotropiseCoord(vec2 q)
{
    vec2 dqdx = dFdx(q), dqdy = dFdy(q);
    // per-axis screen-space rate of change of q
    float sx = max(length(vec2(dqdx.x, dqdy.x)), 1e-6);
    float sy = max(length(vec2(dqdx.y, dqdy.y)), 1e-6);
    float s  = sqrt(sx * sy);                 // geometric mean preserves overall density
    return vec2(q.x * s / sx, q.y * s / sy);
}

// Line screen. Same q as dotScreen, so it inherits the same projection and bifurcation.
float lineScreen(vec2 q, float pitch, float angleRad)
{
    float c = cos(angleRad), s = sin(angleRad);
    float u = (mat2(c, -s, s, c) * q).x / pitch;
    return abs(fract(u) - 0.5) * 2.0;   // 0 on the line, 1 between lines
}

// Cross-hatch: two line screens at different angles, combined by min() so both darken.
float crossHatch(vec2 q, float pitch, float a0, float a1)
{
    return min(lineScreen(q, pitch, a0), lineScreen(q, pitch, a1));
}

float hatchMask(vec2 q, float t, float pitch, float a0, float a1, bool cross)
{
    float w = mix(0.15, 0.55, 1.0 - t);          // thicker as we go darker
    float s = cross ? crossHatch(q, pitch, a0, a1) : lineScreen(q, pitch, a0);
    return smoothstep(w - uSoft, w + uSoft, s);  // 0 on ink, 1 on paper
}

// Coloured silhouette ink: offset the cyan separation outward along the silhouette normal
// and deepen it. dirN = screen-space outward normal of the silhouette.
vec3 inkEdge(vec3 base, vec2 uv, vec2 dirN, float edgeMask)
{
    float k = uInkOffsetPx * edgeMask;
    float rShift = texture(uBeauty, uv - dirN * k * uTexel).r;   // cyan plate lags
    vec3  c = vec3(rShift, base.g, base.b);
    return mix(base, c * uInkTint, edgeMask);                    // uInkTint ~ vec3(0.85,1.0,1.0)
}

// Depth-driven misregistration, subtractive. Offsets are per-separation, in px.
vec3 misregister(sampler2D beauty, vec2 uv, float coc)
{
    // coc: signed circle-of-confusion in px from your depth/focus model
    float m = uFloorPx + abs(coc) * uDepthGain;          // non-zero floor at focus, Sec. 4.2
    vec2  dir = normalize(uOffsetDir);                   // ~horizontal
    // measured ratios: C:M:Y displacement approx 0 : 1.0 : 0.45  (R : G : B)
    vec2 oC = dir * m * 0.00;
    vec2 oM = dir * m * 1.00;
    vec2 oY = dir * m * 0.45;
    // sample each separation at its own offset, convert to subtractive, merge, convert back
    float C = 1.0 - texture(beauty, uv + oC * uTexel).r;
    float M = 1.0 - texture(beauty, uv + oM * uTexel).g;
    float Y = 1.0 - texture(beauty, uv + oY * uTexel).b;
    return vec3(1.0 - C, 1.0 - M, 1.0 - Y);
}

// Quantise the normal toward a small set of directions before lighting, so the
// terminator snaps to designed facets rather than sliding around a curve.
vec3 quantiseNormal(vec3 N, float steps)
{
    vec3 q = normalize(N);
    q = round(q * steps) / steps;
    return normalize(mix(N, q, uNormalQuantAmount));
}

// CPU side, per partition (character, garment, prop):
// step = 1,2,3,4,6 ; phase lets you offset partitions so they do not all pop together
float heldTime(float t, int step, int phase, float fps)
{
    float f = floor(t * fps);
    float held = floor((f - float(phase)) / float(step)) * float(step) + float(phase);
    return held / fps;
}

// Motion expressed as chromatic offset along the motion vector, not as a blur.
vec3 motionTrail(sampler2D beauty, vec2 uv, vec2 mv)
{
    float m = min(length(mv) * uTrailGain, uTrailMaxPx);
    vec2  d = (length(mv) > 1e-6) ? normalize(mv) : vec2(0.0);
    float C = 1.0 - texture(beauty, uv + d * m * 0.00 * uTexel).r;
    float M = 1.0 - texture(beauty, uv + d * m * 1.00 * uTexel).g;
    float Y = 1.0 - texture(beauty, uv + d * m * 0.45 * uTexel).b;
    return vec3(1.0 - C, 1.0 - M, 1.0 - Y);
}

// Palette-mapped banding: the band index selects a scripted colour, not a shade of albedo.
vec3 paletteShade(float luma, sampler2D palette, float paletteRow, float bandCount)
{
    float band = floor(clamp(luma, 0.0, 0.999) * bandCount);
    float u = (band + 0.5) / bandCount;
    return texture(palette, vec2(u, paletteRow)).rgb;
}


void main() {
  vec2 q = hatcherCoord(MODE_TRIPLANAR, vec3(vUv, 1.0), vec3(vUv, 0.5),
                        normalize(vec3(vUv, 1.0)), vUv, vUv,
                        mat3(1.0), vec3(0.0));
  q = isotropiseCoord(q);
  float pitch = bifurcatedPitch(q, 8.0, 6.0, 24.0);
  float dots  = dotScreen(q, pitch, radians(45.0));
  float lines = lineScreen(q, pitch, radians(30.0));
  float xh    = crossHatch(q, pitch, radians(30.0), radians(105.0));
  float hm    = hatchMask(q, 0.5, pitch, radians(30.0), radians(105.0), true);
  float lum   = texture(uBeauty, vUv).g;
  float mult  = thresher(lum, dots);
  vec3  pal   = paletteShade(lum, uPalette, 0.5, 4.0);
  vec3  nq    = quantiseNormal(normalize(vec3(vUv, 1.0)), 4.0);
  vec3  ink   = inkEdge(pal, vUv, vec2(1.0, 0.0), 0.5);
  vec3  mis   = misregister(uBeauty, vUv, 3.0);
  vec3  mt    = motionTrail(uBeauty, vUv, vec2(0.01, 0.0));
  float ht    = heldTime(1.5, 2, 0, 24.0);
  fragColor = vec4((ink + mis + mt + pal + nq) * mult
                 + vec3(dots + lines + xh + hm + ht), 1.0);
}
