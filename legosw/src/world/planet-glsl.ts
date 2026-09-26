/**
 * GLSL shared by Coruscant's surface, mega-towers and atmosphere shell. Units are studs; the
 * planet centre / radius / sun arrive as uniforms. Everything that has a spatial frequency is
 * box-filtered by its pixel footprint (ray differentials), so nothing crawls under camera motion.
 */

/** Grid rotation (radians) of the city relative to world xz: keeps streets off the flight axis. */
export const GRID_ANGLE = 0.5;
/** Lot pitch and lots per superblock (a superblock is one district / mega-tower cell). */
export const LOT = 96;
export const SUPER = 16;
export const SUPERW = LOT * SUPER;
/** Tallest painted building (the ray-cast slab top). */
export const H_TOP = 190;
/** Superblock grid covered by the baked data: TOWER_N² superblocks, index -SB_OFF at texel 0. */
export const TOWER_N = 96;
export const SB_OFF = 38;
export const GRID_MIN = -SB_OFF * SUPERW;
export const GRID_SPAN = TOWER_N * SUPERW;
/** Blocks (4×4 lots) carry the per-neighbourhood data: BLOCK_N² texels over the same span. */
export const BLOCK = LOT * 4;
export const BLOCK_N = TOWER_N * 4;
/** Baked mega-tower shadow map and cloud field resolutions (both span GRID_SPAN). */
export const SHADE_N = 4096;
export const CLOUD_N = 1024;
/** Cloud deck altitude, air-traffic lane altitudes. */
export const H_CLOUD = 1250;
export const LANE_HI = 96;
export const LANE_LO = 58;
/** Atmosphere scale height; the limb shell sits at R + ATMO_TOP. */
export const HS = 520;
export const ATMO_TOP = 8500;
/** Tallest mega-tower tier top the shadow map encodes. */
export const Z_SHADE = 1000;
/** Tier-0 tops stay above the painted city, so its lots inside a tower footprint never poke out. */
export const TIER0_MIN = 205;

/**
 * Mega-tower silhouettes: three stacked tiers (half-size factor, top as a fraction of height)
 * plus a spire (top as a fraction of height, half-size factor).
 */
export const TOWER_STYLES: readonly (readonly number[])[] = [
  [1.0, 0.5, 0.72, 0.78, 0.46, 1.0, 1.28, 0.12],
  [1.0, 0.84, 0.64, 0.95, 0.4, 1.0, 1.12, 0.1],
  [1.0, 0.3, 0.56, 0.88, 0.34, 1.0, 1.42, 0.09],
  [1.0, 0.38, 0.8, 0.64, 0.58, 1.0, 1.18, 0.14],
];

const f = (x: number) => x.toFixed(6);

export const UNIFORMS_GLSL = /* glsl */ `
uniform vec3 center;
uniform float R;
uniform vec3 sunDir;
uniform sampler2D districtTex;
uniform sampler2D farWall;
uniform sampler2D farRoof;
uniform sampler2D shadeTex;
uniform sampler2D cloudTex;
uniform sampler2D paletteTex;
`;

export const COMMON_GLSL = /* glsl */ `
#define PI 3.14159265
const float LOT = ${f(LOT)};
const float BLOCK = ${f(BLOCK)};
const float SUPERW = ${f(SUPERW)};
const float H_TOP = ${f(H_TOP)};
const float H_CLOUD = ${f(H_CLOUD)};
const float LANE_HI = ${f(LANE_HI)};
const float LANE_LO = ${f(LANE_LO)};
const float HS = ${f(HS)};
const float Z_SHADE = ${f(Z_SHADE)};
const vec2 GRID_MIN = vec2(${f(GRID_MIN)});
const float GRID_SPAN = ${f(GRID_SPAN)};
const int SB_OFF = ${SB_OFF};
const int BLOCK_N = ${BLOCK_N};
const vec2 GU = vec2(${f(Math.cos(GRID_ANGLE))}, ${f(Math.sin(GRID_ANGLE))});
const vec2 GV = vec2(${f(-Math.sin(GRID_ANGLE))}, ${f(Math.cos(GRID_ANGLE))});

uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
vec2 rnd2(ivec2 c, uint salt) { uvec2 h = pcg2d(uvec2(c) ^ uvec2(salt, salt * 747796405u)); return vec2(h >> 8u) * (1.0 / 16777216.0); }
// four 16-bit uniforms from one hash
vec4 rnd4(ivec2 c, uint salt) {
  uvec2 a = pcg2d(uvec2(c) ^ uvec2(salt, salt * 747796405u));
  return vec4(uvec4(a.x >> 16u, a.x & 0xffffu, a.y >> 16u, a.y & 0xffffu)) * (1.0 / 65536.0);
}
float hf(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hf(i), hf(i + vec2(1.0, 0.0)), u.x), mix(hf(i + vec2(0.0, 1.0)), hf(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 OCT = mat2(1.62, 1.18, -1.18, 1.62);

// --- box filters (fw = filter width in the same units as x)
// periodic pulses of duty w (0..1) starting at the integers, averaged over [x - fw/2, x + fw/2]
float pulseInt(float x, float w) { return floor(x) * w + min(fract(x), w); }
float pulseF(float x, float w, float fw) { fw = max(fw, 1e-4); return (pulseInt(x + 0.5 * fw, w) - pulseInt(x - 0.5 * fw, w)) / fw; }
// a single pulse of half-width hw at signed distance d
float boxF(float d, float hw, float fw) { fw = max(fw, 1e-4); return max(0.0, min(d + 0.5 * fw, hw) - max(d - 0.5 * fw, -hw)) / fw; }
// detail fade: 1 while a feature of size s spans > ~3 px, 0 below ~1.5 px
float lodK(float s, float fp) { return smoothstep(1.5, 3.2, s / max(fp, 1e-3)); }

// --- planet frame
// ground-projected grid coordinates of a world point (radial projection, then rotated xz)
vec2 toGrid(vec3 P) { vec2 xz = normalize(P - center).xz * R; return vec2(dot(xz, GU), dot(xz, GV)); }
vec2 gridUV(vec2 g) { return (g - GRID_MIN) / GRID_SPAN; }
float altOf(vec3 P) { return length(P - center) - R; }
// world tangent directions of the grid axes at up-vector n
vec3 axisU(vec3 n) { vec3 e = vec3(GU.x, 0.0, GU.y); return normalize(e - n * dot(e, n)); }
vec3 axisV(vec3 n) { vec3 e = vec3(GV.x, 0.0, GV.y); return normalize(e - n * dot(e, n)); }
// both intersections of a ray with a sphere of radius r about the centre (-1 if none)
vec2 sphereHit(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float lo = length(oc);
  float c = (lo - r) * (lo + r);
  float d = b * b - c;
  if (d < 0.0) return vec2(-1.0);
  float s = sqrt(d);
  return vec2(-b - s, -b + s);
}
// grid displacement per unit of altitude gained along the sun ray, at up-vector n (sun zenith cosine muS)
vec2 sunGrid(vec3 n, float rOverDist, float muS) {
  vec3 lt = sunDir - n * muS;
  return rOverDist * vec2(dot(lt.xz, GU), dot(lt.xz, GV)) / max(muS, 0.02);
}
`;

/** Chapman-function atmosphere: haze, sun transmittance, limb glow. */
export const ATMO_GLSL = /* glsl */ `
// zenith optical depth at the ground seen by the camera: Rayleigh-like (blue-heavy) + a little aerosol.
// The sun's own path uses a denser mix so the low sun stays golden while the view stays clear.
const vec3 TAU_R = vec3(0.011, 0.026, 0.063);
const vec3 TAU_M = vec3(0.008);
const vec3 TAU_SUN = vec3(0.085, 0.150, 0.300);
const vec3 SUN_E = vec3(1.0, 0.95, 0.88) * 2.7;
float chapman(float X, float mu) {
  float c = sqrt(1.5707963 * X);
  return c / ((c - 1.0) * max(mu, 0.0) + 1.0);
}
// optical depth from altitude a to infinity along zenith cosine mu, in units of the ground zenith depth
float colDepth(float a, float mu) { a = max(a, 0.0); return exp(-a / HS) * chapman((R + a) / HS, mu); }
// sunlight reaching altitude a where the sun's zenith cosine is mu (reddens at low sun, dies past the terminator)
vec3 sunTrans(float a, float mu) {
  a = max(a, 0.0);
  float dip = sqrt(2.0 * a / R);
  float vis = smoothstep(-dip - 0.03, -dip + 0.01, mu);
  return exp(-TAU_SUN * colDepth(a, mu + dip)) * vis;
}
// ambient sky light on an upward face where the sun's zenith cosine is mu
vec3 skyAmb(float mu) {
  float day = smoothstep(-0.1, 0.4, mu);
  vec3 c = mix(vec3(0.004, 0.006, 0.014), vec3(0.13, 0.21, 0.40), day);
  c += vec3(0.16, 0.07, 0.025) * exp(-pow((mu - 0.03) * 8.0, 2.0));
  return c;
}
float phaseR(float c) { return 0.75 * (1.0 + c * c); }
float phaseM(float c) { float g = 0.7; float d = 1.0 + g * g - 2.0 * g * c; return 0.1 * (1.0 - g * g) / (d * sqrt(d)); }
// radiance scattered toward the viewer by air at altitude a, where the sun's zenith cosine is mu
vec3 scatterSrc(float a, float mu, float cosV, vec3 tauR, vec3 tauM) {
  vec3 sr = tauR / max(tauR + tauM, vec3(1e-5));
  vec3 src = SUN_E * sunTrans(a, mu) * (sr * phaseR(cosV) * 0.42 + (1.0 - sr) * phaseM(cosV));
  return src + skyAmb(mu) * 0.55;
}
// air between the camera and a point P: transmittance and in-scattered light
void airPath(vec3 P, vec3 rd, out vec3 T, out vec3 S) {
  vec3 n = normalize(P - center);
  float aP = length(P - center) - R;
  vec3 oc = cameraPosition - center;
  float aC = length(oc) - R;
  float d = max(colDepth(aP, dot(n, -rd)) - colDepth(aC, dot(oc, -rd) / length(oc)), 0.0);
  vec3 tR = TAU_R * d, tM = TAU_M * d;
  T = exp(-(tR + tM));
  S = scatterSrc(max(aP, 0.0) + 900.0, dot(n, sunDir), dot(rd, sunDir), tR, tM) * (1.0 - T);
}
vec3 haze(vec3 col, vec3 P, vec3 rd) { vec3 T, S; airPath(P, rd, T, S); return col * T + S; }
// in-scattering along a ray that misses the ground: premultiplied colour + opacity
vec4 limb(vec3 ro, vec3 rd) {
  vec3 oc = ro - center;
  float lo = length(oc);
  float aC = lo - R;
  float b = -dot(oc, rd);
  float d, muS, aT;
  if (b > 0.0) {
    vec3 pT = ro + rd * b;
    vec3 nT = normalize(pT - center);
    aT = length(pT - center) - R;
    d = max(2.0 * colDepth(aT, 0.0) - colDepth(aC, b / lo), 0.0);
    muS = dot(nT, sunDir);
  } else {
    d = colDepth(aC, -b / lo);
    muS = dot(oc, sunDir) / lo;
    aT = aC;
  }
  vec3 tR = TAU_R * d, tM = TAU_M * d;
  vec3 T = exp(-(tR + tM));
  vec3 c = scatterSrc(max(aT, 0.0) + 900.0, muS, dot(rd, sunDir), tR, tM) * (1.0 - T);
  return vec4(c, 1.0 - dot(T, vec3(0.3333)));
}
`;

/** LEGO palette (linear) and per-district colour schemes. */
export const PALETTE_GLSL = /* glsl */ `
const vec3 C_WHITE = vec3(0.905, 0.905, 0.880);
const vec3 C_LBG = vec3(0.366, 0.392, 0.407);
const vec3 C_DBG = vec3(0.122, 0.133, 0.144);
const vec3 C_TAN = vec3(0.745, 0.571, 0.305);
const vec3 C_DTAN = vec3(0.301, 0.254, 0.171);
const vec3 C_SBLUE = vec3(0.114, 0.175, 0.310);
const vec3 C_SGREEN = vec3(0.275, 0.434, 0.329);
const vec3 C_BLACK = vec3(0.016, 0.018, 0.021);
const vec3 C_DRED = vec3(0.168, 0.012, 0.012);
const vec3 C_DBLUE = vec3(0.010, 0.040, 0.120);
const vec3 C_DORANGE = vec3(0.352, 0.100, 0.012);
const vec3 C_RBROWN = vec3(0.155, 0.045, 0.020);
const vec3 C_MAZURE = vec3(0.037, 0.423, 0.521);
const vec3 C_ASPHALT = vec3(0.040, 0.043, 0.050);
// scheme s, pick k (planet-data's WALLS / ROOFS): one texel fetch instead of a 16-way select chain
vec3 wallCol(int s, int k) { return texelFetch(paletteTex, ivec2(k, s), 0).rgb; }
vec3 roofCol(int s, int k) { return texelFetch(paletteTex, ivec2(k, s + 4), 0).rgb; }
vec3 trimCol(int s) { return s == 0 ? C_DBG : (s == 1 ? C_WHITE : (s == 2 ? C_DORANGE : C_WHITE)); }
`;

/** The painted city: lot layout, the sphere-aware grid ray cast and the sun-shadow march. */
export const CITY_GLSL = /* glsl */ `
struct Lot { vec2 lo; vec2 hi; float h; vec4 r; };

// block data (cell >> 2): x height scale, y colour scheme, z 2×2 merge probability (1 = one block-wide
// complex), w open-lot fraction
vec4 blockAt(ivec2 bk) {
  ivec2 i = clamp(bk - ivec2(8192 - 4 * SB_OFF), ivec2(0), ivec2(BLOCK_N - 1));
  return texelFetch(districtTex, i, 0);
}
float streetHW(int e) { return (e & 15) == 0 ? 26.0 : ((e & 3) == 0 ? 10.0 : 3.2); }
Lot getLot(ivec2 c, vec4 dp) {
  Lot L;
  bool mega = dp.z > 0.99;
  bool merge = mega || rnd2(c >> 1, 3u).x < dp.z;
  ivec2 c0 = mega ? ((c >> 2) << 2) : (merge ? ((c >> 1) << 1) : c);
  ivec2 c1 = mega ? c0 + 3 : (merge ? c0 + 1 : c);
  vec4 r = rnd4(c0, mega ? 13u : (merge ? 9u : 5u));
  vec2 sbk = r.zw * 6.0;
  L.lo = (vec2(c0) - 32768.0) * LOT + vec2(streetHW(c0.x), streetHW(c0.y)) + sbk;
  L.hi = (vec2(c1) - 32767.0) * LOT - vec2(streetHW(c1.x + 1), streetHW(c1.y + 1)) - sbk.yx;
  float h = mix(14.0, 150.0, dp.x) * (0.3 + 0.7 * r.y) * (merge ? 1.15 : 1.0);
  if (r.x > 0.955) h = max(h, mix(80.0, 185.0, dp.x));
  if (!merge && r.x < dp.w) h = 0.0;
  if (mega) h = mix(24.0, 75.0, r.y);
  L.h = min(h, H_TOP - 3.0);
  L.r = r;
  return L;
}
// quadratic altitude along a ray segment through a(0) = a0, a(0.5) = am, a(1) = a1
vec3 altQuad(float a0, float am, float a1) { return vec3(a0, 4.0 * am - 3.0 * a0 - a1, 2.0 * a0 + 2.0 * a1 - 4.0 * am); }

// grid DDA along the ground-projected ray segment g0 -> g1 (s in 0..1), altitude a(s) = A.x + s(A.y + s A.z)
// kind: 0 roof, 1 wall, 2 reached the end, 3 ran out of steps
struct Hit { float s; int kind; int axis; Lot L; vec4 dp; };
Hit castCity(vec2 g0, vec2 g1, vec3 A, int maxSteps) {
  Hit H;
  H.kind = 3; H.s = 0.0; H.axis = 0;
  vec2 dg = g1 - g0;
  dg = vec2(abs(dg.x) < 1e-3 ? 1e-3 : dg.x, abs(dg.y) < 1e-3 ? 1e-3 : dg.y);
  vec2 inv = 1.0 / dg;
  vec2 cf = floor(g0 / LOT);
  ivec2 cell = ivec2(cf) + 32768;
  vec2 stp = sign(dg);
  ivec2 istp = ivec2(stp);
  vec2 tMax = ((cf + max(stp, 0.0)) * LOT - g0) * inv;
  vec2 tDel = LOT * abs(inv);
  float s0 = 0.0;
  ivec2 lastBk = ivec2(-1);
  vec4 dp = vec4(0.0);
  for (int i = 0; i < 28; i++) {
    if (i >= maxSteps) break;
    float s1 = min(min(tMax.x, tMax.y), 1.0);
    ivec2 bk = cell >> 2;
    if (bk != lastBk) { dp = blockAt(bk); lastBk = bk; }
    Lot L = getLot(cell, dp);
    if (L.h > 0.0) {
      vec2 ta = (L.lo - g0) * inv, tb = (L.hi - g0) * inv;
      vec2 tn = min(ta, tb), tf = max(ta, tb);
      float sa = max(tn.x, tn.y);
      float lo = max(sa, s0), hi = min(min(tf.x, tf.y), s1);
      if (lo < hi) {
        float aLo = A.x + lo * (A.y + lo * A.z);
        if (aLo <= L.h) {
          H.s = lo; H.kind = sa >= s0 ? 1 : 0; H.axis = tn.x > tn.y ? 0 : 1; H.L = L; H.dp = dp;
          return H;
        }
        float aHi = A.x + hi * (A.y + hi * A.z);
        if (aHi <= L.h) {
          H.s = lo + (hi - lo) * (aLo - L.h) / max(aLo - aHi, 1e-4); H.kind = 0; H.L = L; H.dp = dp;
          return H;
        }
      }
    }
    if (s1 >= 1.0) { H.s = 1.0; H.kind = 2; H.L = L; H.dp = dp; return H; }
    if (tMax.x < tMax.y) { s0 = tMax.x; tMax.x += tDel.x; cell.x += istp.x; }
    else { s0 = tMax.y; tMax.y += tDel.y; cell.y += istp.y; }
  }
  H.s = s0; H.dp = dp;
  return H;
}

// Sunlight blocked by painted buildings, for a receiver at grid point g and altitude a; LgH is the sun's grid
// direction per unit of altitude gained (k). A building shadows the ground inside the convex region its
// footprint sweeps along the sun ray, so its share of the receiver's footprint is box-filtered from the
// largest of the receiver's distances to that region's edge lines, each over its own filter width:
//   top edges   the ray's clearance over the roof where it enters the footprint (a + tn - h),
//   sides       the ray's gap beside a corner it passes (tn.x - tf.y, tn.y - tf.x),
//   behind      the sunward faces (tf) must lie ahead of the ray start; this ramp is shifted a whole filter
//               width into the footprint, so walls in the sun never shadow themselves or their street.
// Nothing jumps as the receiver moves: each building's weight fades out by a fixed reach that the march
// always covers (the cells the ray enters first), and no building outside the march can touch the filter.
// fp: horizontal footprint, fa: altitude footprint (vertical receivers; 0 on flat ones).
const int SH_N = 8;
// SH_N cells along any grid direction reach at least (SH_N - 2) / sqrt(2) lots
const float SH_RS = float(SH_N - 2) * 0.7 * LOT;
float cityShadow(vec2 g, float a, vec2 LgH, float fp, float fa) {
  vec2 d = vec2(abs(LgH.x) < 1e-4 ? 1e-4 : LgH.x, abs(LgH.y) < 1e-4 ? 1e-4 : LgH.y);
  vec2 inv = 1.0 / d, ad = abs(d);
  // the filter stays narrower than the narrowest street inset (3.2 on each side of a footprint), so a lot
  // in a cell the march passes beside is always clear of it
  float fs = clamp(1.5 * fp, 0.5, 4.5), fz = 1.5 * fa;
  float kS = ad.x * ad.y / (fs * (ad.x + ad.y));
  float kEnd = SH_RS / length(d);
  // a block whose tallest possible building is this far below the ray is clear of every edge filter
  float mSkip = 0.5 * (fs / min(ad.x, ad.y) + fz);
  vec2 cf = floor(g / LOT);
  ivec2 cell = ivec2(cf) + 32768;
  vec2 stp = sign(d);
  ivec2 istp = ivec2(stp);
  vec2 tMax = ((cf + max(stp, 0.0)) * LOT - g) * inv;
  vec2 tDel = LOT * abs(inv);
  float k0 = 0.0, occ = 0.0;
  ivec2 lastBk = ivec2(-1);
  vec4 dp = vec4(0.0);
  vec2 prevLo = vec2(1e9);
  for (int i = 0; i < SH_N; i++) {
    // (past H_TOP + mSkip the ray is clear of every building's edge filters)
    if (k0 > kEnd || occ > 0.99 || a + k0 > H_TOP + mSkip) break;
    ivec2 bk = cell >> 2;
    if (bk != lastBk) { dp = blockAt(bk); lastBk = bk; }
    if (a + k0 - mix(80.0, 185.0, dp.x) < mSkip) {
      Lot L = getLot(cell, dp);
      float uA = (a + 0.35 - L.h) / max(fz, 1e-3);
      if (L.h > 0.0 && uA < 0.5 && any(notEqual(L.lo, prevLo))) {
        vec2 ta = (L.lo - g) * inv, tb = (L.hi - g) * inv;
        vec2 tn = min(ta, tb), tf = max(ta, tb);
        vec2 uB = 0.5 - (tf - 0.35) * ad / fs;
        vec2 uT = (a + tn - L.h) * ad / (fs + fz * ad);
        vec2 uS = (tn - tf.yx) * kS;
        float u = max(max(max(uB.x, uB.y), max(uT.x, uT.y)), max(max(uS.x, uS.y), uA));
        occ = max(occ, clamp(0.5 - u, 0.0, 1.0) * (1.0 - smoothstep(0.5 * kEnd, kEnd, max(tn.x, tn.y))));
      }
      prevLo = L.lo;
    }
    if (tMax.x < tMax.y) { k0 = tMax.x; tMax.x += tDel.x; cell.x += istp.x; }
    else { k0 = tMax.y; tMax.y += tDel.y; cell.y += istp.y; }
  }
  // beyond the reach: likely blocked while the ray is still below a typical roofline (only near the
  // terminator, where the reach is a few units of altitude)
  float aEnd = a + 0.75 * kEnd;
  return max(occ, 0.75 * smoothstep(0.1, 1.0, (45.0 - aEnd) / 45.0));
}
`;

/** Baked mega-tower shadows and the cloud deck. */
export const SHADE_GLSL = /* glsl */ `
// sunlit fraction after mega-tower shadows at grid point g, altitude a (bias skips a surface's own tower)
float towerLit(vec2 g, float a, vec2 LgH, vec2 gdx, vec2 gdy, float bias) {
  vec2 uv = gridUV(g - LgH * a);
  vec2 s = textureGrad(shadeTex, uv, gdx / GRID_SPAN, gdy / GRID_SPAN).rg;
  float zOut = Z_SHADE * s.g / max(s.r, 0.004);
  return 1.0 - s.r * smoothstep(a + bias - 10.0, a + bias + 10.0, zOut);
}
// cloud density at grid point g (texture for the large scales + procedural detail faded by footprint)
float cloudAt(vec2 g, vec2 gdx, vec2 gdy, float fp, int oct) {
  float d = textureGrad(cloudTex, gridUV(g), gdx / GRID_SPAN, gdy / GRID_SPAN).r;
  vec2 p = g * (1.0 / 1000.0);
  float amp = 0.15;
  float sc = 1000.0;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    float k = lodK(sc * 0.5, fp);
    if (k <= 0.0) break;
    // billows (rounded lobes, sharp creases), roughly zero-mean
    d += amp * (abs(vnoise(p) - 0.5) * 1.6 - 0.26) * k;
    p = OCT * p + 1.7;
    amp *= 0.58;
    sc *= 0.5;
  }
  return d;
}
float cloudCover(float d) { return smoothstep(0.62, 0.69, d); }
`;
