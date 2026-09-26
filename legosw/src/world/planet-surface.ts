import { DOM_W, GLASS_FRAC, PICK_W } from './planet-data';
import { ATMO_GLSL, CITY_GLSL, COMMON_GLSL, PALETTE_GLSL, SHADE_GLSL, UNIFORMS_GLSL } from './planet-glsl';

/**
 * Coruscant's ground: a proxy cap (just outside the planet sphere) whose fragments trace the exact
 * view ray. Near the camera the ray is cast through a painted city of lots (real parallax, facades,
 * roofs, streets, canyon shadows); where a lot shrinks below a few pixels it blends into a filtered
 * statistical average of the same city. Mega-tower and cloud shadows come from baked maps, the cloud
 * deck floats above with parallax, and both layers get their own aerial perspective.
 */

export const SURFACE_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/**
 * The proxy cap, centred under the camera: position = (fraction across the zone, longitude, zone). capTh holds
 * the zones' outer edges (angles from the nadir: near disc, blend ring, far ring, silhouette band). Every zone
 * shares this mapping and edge vertices land exactly on the edge angles, so neighbouring zones are watertight.
 */
export const CAP_VERT = /* glsl */ `
uniform vec3 center;
uniform float R;
uniform vec4 capTh;
varying vec3 vWorld;
void main() {
  vec3 up = normalize(cameraPosition - center);
  vec3 e1 = normalize(cross(abs(up.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), up));
  vec3 e2 = cross(up, e1);
  float z = position.z;
  vec2 e = z < 0.5 ? vec2(0.0, capTh.x) : (z < 1.5 ? capTh.xy : (z < 2.5 ? capTh.yz : capTh.zw));
  float th = position.x <= 0.0 ? e.x : (position.x >= 1.0 ? e.y : mix(e.x, e.y, position.x));
  vec3 d = up * cos(th) + (e1 * cos(position.y) + e2 * sin(position.y)) * sin(th);
  // just outside the sphere: flat triangles sag under 2 studs at the tessellation used
  vWorld = center + d * (R + 8.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

/** Lots bigger than this many pixels get the ray-cast near field (it fades in from half of it). */
export const NEAR_PX = 8;

/** Lighting shared by the ground and the mega-towers (sun, sky, lights, facade glass, clouds). */
export const LIGHT_GLSL = /* glsl */ `
const float GLASS_FRAC = ${GLASS_FRAC.toFixed(4)};
const float DOM_W = ${DOM_W.toFixed(4)};
const vec3 PICK_C = vec3(${PICK_W.slice(0, 3)
  .map((_, i) => PICK_W.slice(0, i + 1).reduce((s, w) => s + w, 0).toFixed(4))
  .join(', ')});
const vec3 WIN_WARM = vec3(1.0, 0.68, 0.36);
const vec3 WIN_COOL = vec3(0.78, 0.88, 1.0);
const float WIN_I = 2.2;
const float STREET_I = 3.2;
const float LANE_I = 6.0;
// lights come on through dusk; a few are always on (traffic only shows once it is dark). After dark buildings
// light a sparse share of their windows, so the streets and air lanes read as the bright network.
float nightF(float muS) { return 1.0 - smoothstep(-0.04, 0.2, muS); }
float lightsOn(float muS) { return 0.08 + 0.3 * nightF(muS); }
// sky seen in a mirror direction r at a place with up n where the sun's zenith cosine is muS
vec3 skyRefl(vec3 r, vec3 n, float muS) {
  float e = dot(r, n);
  float day = smoothstep(-0.1, 0.35, muS);
  vec3 hor = mix(vec3(0.03, 0.04, 0.08), vec3(0.50, 0.60, 0.78), day);
  hor += vec3(0.55, 0.24, 0.07) * exp(-pow((muS - 0.04) * 7.0, 2.0));
  vec3 zen = mix(vec3(0.006, 0.01, 0.025), vec3(0.08, 0.17, 0.45), day);
  vec3 c = mix(hor, zen, smoothstep(0.0, 0.6, e));
  // the far side of the street is below the horizon of a facade
  return e < 0.0 ? mix(hor, vec3(0.05, 0.05, 0.06) * day + 0.01, smoothstep(0.0, -0.25, e)) : c;
}
// facade glass: the sky it reflects, and (glint) its sun glint per unit of sunlight reaching it
vec3 glassSky(vec3 rd, vec3 n, vec3 up, float muS, out float glint) {
  vec3 r = reflect(rd, n);
  float cr = clamp(-dot(rd, n), 0.0, 1.0);
  float fr = 0.06 + 0.94 * pow(1.0 - cr, 5.0);
  // broad sun glint (a whole facade, never a sparkle)
  glint = pow(max(dot(r, sunDir), 0.0), 24.0) * 0.8 * fr;
  return vec3(0.012, 0.02, 0.032) + skyRefl(r, up, muS) * (0.2 + 0.5 * fr);
}
vec3 glassCol(vec3 rd, vec3 n, vec3 up, float muS, vec3 sunC, float lit) {
  float gl;
  vec3 c = glassSky(rd, n, up, muS, gl);
  return c + sunC * lit * gl;
}
// cloud cover over grid point g (altitude a) toward the sun
float cloudShadow(vec2 g, float a, vec2 LgH, vec2 gdx, vec2 gdy, float fp) {
  return cloudCover(cloudAt(g + LgH * (H_CLOUD - a), gdx, gdy, fp, 1)) * 0.82;
}
// sun direction on the cloud deck at PC, in grid coordinates
vec2 cloudSunDir(vec3 PC) {
  vec3 NC = normalize(PC - center);
  float muC = dot(NC, sunDir);
  return normalize(sunGrid(NC, 1.0, muC) + 1e-5);
}
// the cloud deck (density cd) where the view ray rd crosses it at PC: hazed colour. The deck is a height
// field whose tops rise with density; rise = top height gained per stud toward the sun.
vec3 cloudShade(vec3 rd, vec3 PC, float cd, float rise) {
  vec3 NC = normalize(PC - center);
  float muC = dot(NC, sunDir);
  vec3 sunCC = SUN_E * sunTrans(H_CLOUD, muC);
  float sinS = sqrt(max(1.0 - muC * muC, 0.0));
  float ndl = clamp((muC - rise * sinS) / sqrt(1.0 + rise * rise), 0.0, 1.0);
  float thick = smoothstep(0.6, 0.85, cd);
  // thin edges light up when the sun is behind them
  float glow = phaseM(dot(rd, sunDir)) * (1.0 - thick);
  vec3 cc = vec3(0.96, 0.96, 0.94) * (sunCC * (ndl * 1.25 + glow * 0.8) * (0.6 + 0.4 * thick)
          + skyAmb(muC) * (0.75 + 0.35 * thick));
  // city glow on the undersides of thin night clouds
  cc += vec3(0.10, 0.055, 0.025) * lightsOn(muC) * (1.0 - thick);
  return haze(cc, PC, rd);
}
// the deck where the view ray rd crosses it at PC (grid gC, footprint derivatives cdx, cdy): hazed colour
// and cover, the slope from a second sample toward the sun
vec4 cloudDeck(vec3 rd, vec3 PC, vec2 gC, vec2 cdx, vec2 cdy) {
  float fpC = max(length(cdx), length(cdy));
  float cd = cloudAt(gC, cdx, cdy, fpC, 5);
  float cover = cloudCover(cd);
  vec4 c = vec4(0.0);
  if (cover > 0.002) {
    float stepC = max(90.0, fpC * 1.5);
    float d2 = cloudAt(gC + cloudSunDir(PC) * stepC, cdx, cdy, fpC, 5);
    c = vec4(cloudShade(rd, PC, cd, 520.0 * (d2 - cd) / stepC), cover);
  }
  return c;
}
`;

export const SURFACE_FRAG = /* glsl */ `
${UNIFORMS_GLSL}
${COMMON_GLSL}
${ATMO_GLSL}
${PALETTE_GLSL}
${CITY_GLSL}
${SHADE_GLSL}
${LIGHT_GLSL}
varying vec3 vWorld;

// a lot's colour pick: most lots of a block share its dominant colour, the others favour the
// scheme's two neutrals (weights PICK_W)
int lotColour(Lot L, vec4 dp) {
  float lr1 = fract(L.r.y * 13.7 + L.r.z * 5.3);
  float x = fract(lr1 * 7.31);
  return lr1 < DOM_W ? (int(dp.y * 16.0) & 3) : (x < PICK_C.x ? 0 : (x < PICK_C.y ? 1 : (x < PICK_C.z ? 2 : 3)));
}
bool lotPark(Lot L) { return fract(L.r.w * 11.3 + L.r.x * 7.1) > 0.45; }
const vec3 C_PARK = vec3(0.030, 0.085, 0.030);
const vec3 C_PLAZA = vec3(0.30, 0.30, 0.29);
const vec3 C_GLASS = vec3(0.03, 0.045, 0.07);
// periodic patterns (x, fw in periods; fw = one pixel) are filtered over PW pixels and fade to their mean
// while a period spans under 2-4 px: a box filter alone still lets near-Nyquist stripes beat with the pixels
const float PW = 1.5;
float pulseA(float x, float w, float fw) { fw = max(fw, 1e-4); return mix(w, pulseF(x, w, PW * fw), smoothstep(2.0, 4.0, 1.0 / fw)); }
// traffic on block street k of one grid axis (seed): the avenues, every fourth, are busier. The streets' cars and
// lights and the air lanes over them share it, so the night grid is irregular the same way everywhere.
const float STREET_MEAN = 0.475;
float streetLevel(float k, float seed) {
  float h = hf(vec2(k, seed));
  return fract(k * 0.25) == 0.0 ? 0.4 + 0.6 * h : 0.1 + 0.9 * h * h;
}

// ---- far field: the same city averaged over the pixel footprint (g is taken at a typical roof level so
// the pattern sits where the ray-cast roofs do). While lots are a few pixels wide their real colours and
// heights are box-filtered; below that the per-block averages take over.
const float H_MID = 45.0;
// colour = cS * (mega-tower and cloud light) + cA; kDet: the near field's share (the lot pass is skipped under it)
void farCity(vec2 g, vec2 gdx, vec2 gdy, vec3 N, vec3 rd, float muS, vec3 sunC, vec3 sky, float on, float kDet, out vec3 cS, out vec3 cA, out vec3 emis) {
  vec2 fwg = abs(gdx) + abs(gdy);
  float kL = lodK(LOT, max(fwg.x, fwg.y));
  vec3 wallA = vec3(0.0), roofA = vec3(0.0);
  float hm = 0.0, open = 0.0, hs = 0.0;
  // the four lots around g, weighted by how much of the footprint each covers (a loop with a per-pixel trip
  // count: under SwiftShader a quad that needs none of it runs one masked pass instead of four)
  vec2 p = g / LOT - 0.5;
  vec2 pi = floor(p);
  vec2 wf = clamp((p - pi - 0.5) / max(fwg / LOT, 1e-3) + 0.5, 0.0, 1.0);
  vec3 wl = vec3(0.0);
  float hb = 0.0, wb = 0.0;
  int nL = kL > 0.0 && kDet < 0.999 ? 4 : 0;
  for (int k = 0; k < nL; k++) {
    ivec2 o = ivec2(k & 1, k >> 1);
    vec2 ww = mix(1.0 - wf, wf, vec2(o));
    float w = ww.x * ww.y;
    ivec2 c = ivec2(pi) + o + 32768;
    vec4 dp = blockAt(c >> 2);
    Lot L = getLot(c, dp);
    int scheme = int(dp.y * 16.0) >> 2;
    int kc = lotColour(L, dp);
    hs += w * (dp.z > 0.99 ? 0.45 : dp.x);
    float bw = L.h > 0.0 ? w : 0.0;
    wl += bw * wallCol(scheme, kc);
    roofA += L.h > 0.0 ? w * roofCol(scheme, kc) : w * (lotPark(L) ? C_PARK : C_PLAZA);
    hb += bw * L.h;
    wb += bw;
    open += w - bw;
  }
  wallA = mix(wl / max(wb, 1e-3), C_GLASS, GLASS_FRAC);
  hm = wb > 0.0 ? hb / wb : 20.0;
  if (kL < 1.0) {
    // one texel per block, drawn crisp (edges box-filtered by the footprint) rather than as bilinear
    // blobs; once a block is under a pixel this is plain trilinear filtering
    vec2 pb = (g - GRID_MIN) / BLOCK - 0.5;
    vec2 pib = floor(pb);
    vec2 pf = clamp((pb - pib - 0.5) / max(fwg / BLOCK, 1e-3) + 0.5, 0.0, 1.0);
    vec2 uv = (pib + 0.5 + pf) / float(BLOCK_N);
    vec2 ux = gdx / GRID_SPAN, uy = gdy / GRID_SPAN;
    vec4 fw = textureGrad(farWall, uv, ux, uy);
    vec4 fr = textureGrad(farRoof, uv, ux, uy);
    wallA = mix(fw.rgb, wallA, kL);
    roofA = mix(fr.rgb, roofA, kL);
    hm = mix(mix(14.0, 150.0, fw.a) * 0.62 + 3.0, hm, kL);
    open = mix(fr.a, open, kL);
    hs = mix(fw.a, hs, kL);
  }
  // inside a block roofs cover most of the ground; its streets and the avenues are drawn below
  float cov = 0.74 * (1.0 - open);
  float sinV = clamp(dot(N, -rd), 0.02, 1.0);
  float cotV = sqrt(1.0 - sinV * sinV) / sinV;
  vec3 eU = axisU(N), eV = axisV(N);
  float vu = dot(-rd, eU), vv = dot(-rd, eV);
  float vh = max(abs(vu) + abs(vv), 1e-3);
  float q = hm * cotV * vh / LOT;
  float pR = cov / (1.0 + 1.1 * q);
  float pG = (1.0 - cov) * exp(-2.6 * q);
  float pW = max(1.0 - pR - pG, 0.0);
  // the facades facing the camera, and the sun on them
  vec3 nU = eU * sign(vu), nV = eV * sign(vv);
  float sunW = (abs(vu) * max(dot(nU, sunDir), 0.0) + abs(vv) * max(dot(nV, sunDir), 0.0)) / vh;
  float tanA = max(muS, 0.0) / sqrt(max(1.0 - muS * muS, 1e-4));
  float litW = clamp(0.24 + 0.76 * (22.0 * tanA) / (hm * 0.55), 0.0, 1.0);
  float litR = 1.0 - 0.28 * exp(-3.0 * tanA);
  float litG = clamp(tanA * 22.0 / (hm * 0.8), 0.0, 1.0) * 0.8;
  float sunUp = max(muS, 0.0);
  float glint;
  vec3 gsky = glassSky(rd, normalize(abs(vu) * nU + abs(vv) * nV), N, muS, glint);
  vec3 wallS = sunC * litW * (wallA * sunW + GLASS_FRAC * glint);
  vec3 wallC = wallA * (sky * 0.42 + sunC * sunUp * 0.05) + GLASS_FRAC * (gsky - vec3(0.012, 0.02, 0.032));
  vec3 roofS = roofA * sunC * sunUp * litR;
  vec3 grdS = C_ASPHALT * sunC * sunUp * litG;
  // block streets and avenues (box-filtered, a little wider than the pixel for a softer line): you see
  // their floors only when looking along them, otherwise the facades across them
  vec2 fs = fwg * 1.5;
  vec2 sB = vec2(pulseF((g.x + 13.0) / BLOCK, 26.0 / BLOCK, fs.x / BLOCK), pulseF((g.y + 13.0) / BLOCK, 26.0 / BLOCK, fs.y / BLOCK));
  vec2 sA = vec2(pulseF((g.x + 30.0) / SUPERW, 60.0 / SUPERW, fs.x / SUPERW), pulseF((g.y + 30.0) / SUPERW, 60.0 / SUPERW, fs.y / SUPERW));
  vec2 st = max(sB, sA);
  vec2 wSt = mix(vec2(26.0), vec2(60.0), step(sB, sA));
  vec2 vis = exp(-hm * cotV * vec2(abs(vu), abs(vv)) / wSt);
  float sU = st.x * (1.0 - st.y), sV = st.y * (1.0 - st.x), sX = st.x * st.y;
  float fb = 1.0 - sU - sV - sX;
  float cW = pW * fb + sU * (1.0 - vis.x) + sV * (1.0 - vis.y);
  float cR = pR * fb;
  float cG = pG * fb + sU * vis.x + sV * vis.y + sX;
  // matched to the ray-cast city's mean (its sunlit rims, pads and facade glints are sub-pixel here)
  const vec3 TINT = vec3(1.10, 1.07, 1.03);
  cS = (cW * wallS + cR * roofS + cG * grdS) * TINT;
  cA = (cW * wallC + cR * roofA * sky + cG * C_ASPHALT * sky * 0.25) * TINT;
  float busy = 0.55 + 0.9 * hs;
  emis = on * busy * (pW * GLASS_FRAC * 0.4 * WIN_I * mix(WIN_WARM, WIN_COOL, 0.35) + pG * 0.35 * STREET_I * WIN_WARM + pR * 0.03 * WIN_WARM);
  // street lights and traffic along the visible street floors (each street's level fades to the mean once the
  // footprint spans most of a block, well before it could reach the switch halfway between two streets)
  vec2 kS = floor(g / BLOCK + 0.5);
  vec2 lvS = mix(vec2(streetLevel(kS.x, 0.0), streetLevel(kS.y, 57.0)), vec2(STREET_MEAN), smoothstep(0.25, 0.75, fs / BLOCK));
  lvS = 0.25 + 0.75 * lvS;
  emis += nightF(muS) * STREET_I * WIN_WARM * (0.3 * (sU * vis.x * lvS.x + sV * vis.y * lvS.y) + 0.5 * sX);
}

// ---- air-traffic lanes: streams of lights over the avenues (LANE_HI) and block streets (LANE_LO)
float lanes(float x, float along, float P, float c0, float c1, float w, float fwx, float fwa) {
  float a = pulseF((x - c0 + 0.5 * w) / P, w / P, fwx / P) + pulseF((x + c0 + 0.5 * w) / P, w / P, fwx / P);
  float b = pulseF((x - c1 + 0.5 * w) / P, w / P, fwx / P) + pulseF((x + c1 + 0.5 * w) / P, w / P, fwx / P);
  // vehicles: dashed along the lane
  float dash = pulseA(along / 23.0, 0.42, fwa / 23.0);
  return (a + 0.7 * b) * dash;
}
// traffic on a lane bundle: the level of the street under it (lvl, mean lvlM: seen end-on a bundle keeps it)
// times one per segment between two crossings. x across, u along, fx, fu the footprint, all in periods; the
// switch at a crossing is box-filtered, and each factor fades to its mean once the footprint spans a period in
// its direction.
float traffic(float lvl, float lvlM, float x, float u, float fx, float fu, float seed) {
  float ix = floor(x + 0.5), i = floor(u + 0.5);
  float b = clamp((u - i) / max(fu, 1e-4) + 0.5, 0.0, 1.0);
  float hs = mix(hf(vec2(ix + seed, i - 1.0)), hf(vec2(ix + seed, i)), b);
  return mix(lvl, lvlM, smoothstep(0.25, 1.0, fx)) * mix(0.3 + 0.7 * hs, 0.65, smoothstep(0.25, 1.0, fu));
}
vec3 airLanes(vec3 ro, vec3 rd, float tG, vec2 gdx, vec2 gdy, float tMax, float on) {
  vec3 e = vec3(0.0);
  vec2 hH = sphereHit(ro, rd, R + LANE_HI);
  if (hH.x > 0.0 && hH.x < tMax) {
    vec2 gq = toGrid(ro + rd * hH.x);
    vec2 fw = (abs(gdx) + abs(gdy)) * (hH.x / tG);
    // over the avenues (every fourth block street)
    vec2 uq = gq / SUPERW, fq = fw / SUPERW;
    vec2 kq = 4.0 * floor(uq + 0.5);
    float k = lanes(gq.x, gq.y, SUPERW, 6.0, 13.0, 3.2, fw.x, fw.y) * traffic(streetLevel(kq.x, 0.0), 0.7, uq.x, uq.y, fq.x, fq.y, 0.0)
            + lanes(gq.y, gq.x, SUPERW, 6.0, 13.0, 3.2, fw.y, fw.x) * traffic(streetLevel(kq.y, 57.0), 0.7, uq.y, uq.x, fq.y, fq.x, 5000.0);
    float side = step(0.0, fract(gq.x / SUPERW + 0.5) - 0.5);
    e += k * mix(vec3(1.0, 0.82, 0.55), vec3(1.0, 0.32, 0.1), 0.35 + 0.3 * side) * LANE_I;
  }
  vec2 hL = sphereHit(ro, rd, R + LANE_LO);
  if (hL.x > 0.0 && hL.x < tMax) {
    vec2 gq = toGrid(ro + rd * hL.x);
    vec2 fw = (abs(gdx) + abs(gdy)) * (hL.x / tG);
    vec2 uq = gq / BLOCK, fq = fw / BLOCK;
    vec2 kq = floor(uq + 0.5);
    float k = lanes(gq.x, gq.y, BLOCK, 3.5, 7.0, 2.2, fw.x, fw.y) * traffic(streetLevel(kq.x, 0.0), STREET_MEAN, uq.x, uq.y, fq.x, fq.y, 10000.0)
            + lanes(gq.y, gq.x, BLOCK, 3.5, 7.0, 2.2, fw.y, fw.x) * traffic(streetLevel(kq.y, 57.0), STREET_MEAN, uq.y, uq.x, fq.y, fq.x, 15000.0);
    e += k * vec3(1.0, 0.7, 0.4) * LANE_I * 0.55;
  }
  return e * on;
}

// ---- near field: ray cast through the painted city
// colour = colS * (mega-tower and cloud light at pL) + colA; pL = (grid point, altitude, footprint scale)
struct Near { vec3 colS; vec3 colA; vec3 emis; float t; int kind; vec4 pL; };
// share of a footprint fw (measured across an edge) that lies beyond the edge, for a point d inside it
float beyond(float d, float fw) { return clamp(0.5 - d / max(fw, 1e-4), 0.0, 1.0); }
// altitude span of a pixel (ray differentials dRx, dRy) per unit of ray length on a facade with normal n
float faceFoot(vec3 rd, vec3 dRx, vec3 dRy, vec3 n, vec3 up) {
  float rn = dot(rd, n);
  rn = rn < 0.0 ? min(rn, -0.05) : max(rn, 0.05);
  return abs(dot(dRx - rd * (dot(dRx, n) / rn), up)) + abs(dot(dRy - rd * (dot(dRy, n) / rn), up));
}

// The occluder edge a ray passes closest to on its way to what it hits, measured in pixel footprints:
// a roof's far top edge it clears or a vertical corner it passes beside (axis = the visible facade). k is
// the occluder's share of the pixel with its silhouette dilated by half a pixel, so the whole one-pixel
// ramp lies where the pixel centre misses and nothing jumps as edges move. Near a silhouette vertex the
// covered sliver is part roof rim, part corner: w is the corner's share, wx the x top edge's share of the rim.
struct Miss { float k; float w; float wx; int axis; float s; Lot L; vec4 dp; };
// where the ray line, carried on past the ground point (s = 1), enters lot L's building (1e9 if it doesn't)
float baseS(Lot L, vec2 g0, vec2 inv, out int ax) {
  vec2 ta = (L.lo - g0) * inv, tb = (L.hi - g0) * inv;
  vec2 tn = min(ta, tb), tf = max(ta, tb);
  float sa = max(tn.x, tn.y);
  ax = tn.x > tn.y ? 0 : 1;
  return L.h > 0.0 && sa < min(tf.x, tf.y) && sa >= 1.0 ? sa : 1e9;
}
// castCity with that cone test, keeping the two strongest misses (M1, M2). fa: altitude footprint per unit ray
// length on x / y facades, fh: horizontal footprint per unit ray length across the view, tA / tB: ray lengths
// at s = 0 / 1, fwG: ground footprint per grid axis at s = 1. When the ray reaches the ground, B is the nearest
// wall base beyond it (s = where the line enters that building, axis = its facade).
Hit castNear(vec2 g0, vec2 g1, vec3 A, vec2 fa, float fh, float tA, float tB, vec2 fwG, out Miss M1, out Miss M2, out Miss B) {
  vec2 dg = g1 - g0;
  dg = vec2(abs(dg.x) < 1e-3 ? 1e-3 : dg.x, abs(dg.y) < 1e-3 ? 1e-3 : dg.y);
  vec2 inv = 1.0 / dg;
  vec2 d2 = dg * dg;
  // grid distance from a missed corner to the ray line per unit of (entry - exit) parameter gap
  float gapK = abs(dg.x * dg.y) * inversesqrt(d2.x + d2.y);
  vec2 cf = floor(g0 / LOT);
  ivec2 cell = ivec2(cf) + 32768;
  vec2 stp = sign(dg);
  ivec2 istp = ivec2(stp);
  vec2 tMax = ((cf + max(stp, 0.0)) * LOT - g0) * inv;
  vec2 tDel = LOT * abs(inv);
  float s0 = 0.0;
  vec2 prevLo = vec2(1e9);
  // The loop carries scalars and cells only (the lots are rebuilt after it): SwiftShader predicates every
  // assignment in a loop body on every step, so a whole Lot copied at each exit and swap costs far more
  // than decoding three lots once. Hit: kind, s, axis, cell; misses: (k, w, wx, s) and (cell, axis).
  int hK = 3, hAx = 0;
  float hS = 0.0;
  ivec2 hC = cell;
  vec4 m1 = vec4(0.0), m2 = vec4(0.0);
  ivec3 n1 = ivec3(cell, 0), n2 = ivec3(cell, 0);
  for (int i = 0; i < 28; i++) {
    float s1 = min(min(tMax.x, tMax.y), 1.0);
    vec4 dp = blockAt(cell >> 2);
    Lot L = getLot(cell, dp);
    // first cell of this lot along the ray (a merged lot's cells are visited in a row)
    bool fresh = any(notEqual(L.lo, prevLo));
    prevLo = L.lo;
    if (L.h > 0.0) {
      vec2 ta = (L.lo - g0) * inv, tb = (L.hi - g0) * inv;
      vec2 tn = min(ta, tb), tf = max(ta, tb);
      float sa = max(tn.x, tn.y), se = min(tf.x, tf.y);
      float lo = max(sa, s0), hi = min(se, s1);
      if (lo < hi) {
        float aLo = A.x + lo * (A.y + lo * A.z);
        if (aLo <= L.h) { hS = lo; hK = sa >= s0 ? 1 : 0; hAx = tn.x > tn.y ? 0 : 1; hC = cell; break; }
        float aHi = A.x + hi * (A.y + hi * A.z);
        if (aHi <= L.h) { hS = lo + (hi - lo) * (aLo - L.h) / max(aLo - aHi, 1e-4); hK = 0; hC = cell; break; }
      }
      // missed: how far outside the building's silhouette the ray passes, in pixel footprints, as the largest
      // of its clearances over the two far top edges (the ray's altitude where it crosses those facades'
      // planes) and its gap beside the corner it passes (negative while its ground line crosses the footprint).
      // The max over edge lines is the convex silhouette's distance, continuous across its corners. A corner
      // passed beyond the ground point ends at its foot, with the ramp centred there as the wall base's is
      // (at the grazing line both give the same share); a building wholly beyond the ground point is left to
      // that wall-base blend. Taken once per lot; nearCity drops any that lie behind what the ray hits.
      if (fresh && (sa < se ? sa < 1.0 : true)) {
        vec2 tc = clamp(tf, 0.0, 1.0);
        vec2 dT = (A.x + tc * (A.y + tc * A.z) - L.h) / (mix(vec2(tA), vec2(tB), tc) * fa);
        float sc = sa < se ? se : (tn.x > tn.y ? d2.x * sa + d2.y * se : d2.y * sa + d2.x * se) / (d2.x + d2.y);
        float dS = (sa - se) * gapK / (mix(tA, tB, clamp(sc, 0.0, 1.0)) * fh);
        int ax = tn.x > tn.y ? 0 : 1;
        if (sa > se) dS = max(dS, (sc - 1.0) * (ax == 0 ? abs(dg.x) / fwG.x : abs(dg.y) / fwG.y) + 0.5);
        float dTm = max(dT.x, dT.y);
        float k = clamp(1.0 - max(dTm, dS), 0.0, 1.0);
        vec4 mc = vec4(k, clamp(0.5 + dS - dTm, 0.0, 1.0), clamp(0.5 + dT.x - dT.y, 0.0, 1.0), min(sc, 1.0));
        ivec3 nc = ivec3(cell, ax);
        bool top = k > m1.x;
        bool in2 = k > m2.x;
        m2 = top ? m1 : (in2 ? mc : m2);
        n2 = top ? n1 : (in2 ? nc : n2);
        m1 = top ? mc : m1;
        n1 = top ? nc : n1;
      }
    }
    if (s1 >= 1.0) { hS = 1.0; hK = 2; hC = cell; break; }
    if (tMax.x < tMax.y) { s0 = tMax.x; tMax.x += tDel.x; cell.x += istp.x; }
    else { s0 = tMax.y; tMax.y += tDel.y; cell.y += istp.y; }
  }
  Hit H;
  H.kind = hK; H.s = hK == 3 ? s0 : hS; H.axis = hAx;
  H.dp = blockAt(hC >> 2);
  H.L = getLot(hC, H.dp);
  M1.k = m1.x; M1.w = m1.y; M1.wx = m1.z; M1.s = m1.w; M1.axis = n1.z;
  M1.dp = blockAt(n1.xy >> 2);
  M1.L = getLot(n1.xy, M1.dp);
  M2.k = m2.x; M2.w = m2.y; M2.wx = m2.z; M2.s = m2.w; M2.axis = n2.z;
  M2.dp = blockAt(n2.xy >> 2);
  M2.L = getLot(n2.xy, M2.dp);
  // wall bases just beyond the ground point: this lot's, or a neighbour's across either cell side ahead
  B.k = 0.0; B.w = 0.0; B.wx = 0.0;
  B.s = baseS(H.L, g0, inv, B.axis); B.L = H.L; B.dp = H.dp;
  for (int j = 0; j < 2; j++) {
    ivec2 nc = hC + (j == 0 ? ivec2(istp.x, 0) : ivec2(0, istp.y));
    vec4 dpn = blockAt(nc >> 2);
    Lot Ln = getLot(nc, dpn);
    int axn;
    float sn = baseS(Ln, g0, inv, axn);
    if (sn < B.s) { B.s = sn; B.axis = axn; B.L = Ln; B.dp = dpn; }
  }
  if (hK != 2) B.s = 1e9;
  return H;
}

// streets (sidewalks, lamps, traffic), lot forecourts, plazas and parks at grid point g in lot L's cell (fw:
// footprint per grid axis). The lots' ground is where both axes are past their street's edge, so eB, its
// signed distance (depth into the street network), is continuous round street corners; every boundary is
// box-filtered from it or from the open lot's rectangle.
vec3 groundAlb(vec2 g, vec2 fw, Lot L, float muS, float on, out vec3 emis) {
  vec2 gc = floor(g / LOT + 0.5);
  vec2 o = g - gc * LOT;
  vec2 d = abs(o);
  ivec2 ec = ivec2(gc) + 32768;
  vec2 hw = vec2(streetHW(ec.x), streetHW(ec.y));
  vec2 e = hw - d;
  float eB = max(e.x, e.y);
  float fwB = mix(fw.y, fw.x, smoothstep(-1.0, 1.0, (e.x - e.y) / max(fw.x + fw.y, 1e-3)));
  // forecourts and the sidewalk along the kerb
  float pave = clamp(0.5 - (eB - 2.8) / fwB, 0.0, 1.0);
  float lamps = boxF(eB - 2.4, 0.6, fwB);
  // traffic in both directions along each wide street (headlights on one side, tail lights on the other)
  const vec3 HEAD = vec3(1.0, 0.85, 0.6), TAIL = vec3(1.0, 0.25, 0.08);
  vec2 kc = floor(gc * 0.25 + 0.5);
  vec2 cars = vec2(boxF(d.x - hw.x * 0.45, hw.x * 0.18, fw.x) * step(5.0, hw.x), boxF(d.y - hw.y * 0.45, hw.y * 0.18, fw.y) * step(5.0, hw.y));
  cars *= vec2(streetLevel(kc.x, 0.0), streetLevel(kc.y, 57.0));
  vec3 carC = cars.x * mix(HEAD, TAIL, step(0.0, o.x)) + cars.y * mix(HEAD, TAIL, step(0.0, -o.y));
  emis = nightF(muS) * ((lamps * WIN_WARM + carC * 1.2) * STREET_I + 0.08 * WIN_WARM);
  vec3 col = mix(C_ASPHALT, vec3(0.20, 0.20, 0.21), pave);
  vec2 cP = clamp(0.5 + min(g - L.lo, L.hi - g) / max(fw, vec2(1e-3)), 0.0, 1.0);
  float kP = L.h <= 0.0 ? cP.x * cP.y : 0.0;
  if (kP > 0.0) {
    bool park = lotPark(L);
    vec3 pc = park ? mix(C_PARK, vec3(0.012, 0.045, 0.014), pulseA(g.x / 9.0, 0.5, fw.x / 9.0) * pulseA(g.y / 9.0, 0.5, fw.y / 9.0) * 0.8)
                   : C_PLAZA * (1.0 - 0.3 * max(pulseA(g.x / 12.0, 0.1, fw.x / 12.0), pulseA(g.y / 12.0, 0.1, fw.y / 12.0)));
    col = mix(col, pc, kP);
    emis = mix(emis, on * (park ? 0.02 : 0.25) * WIN_WARM, kP);
  }
  return col;
}

Near nearCity(vec3 ro, vec3 rd, vec3 dRx, vec3 dRy, float tG, vec2 gG, float fpG, float muS, vec3 sunC, vec3 sky, vec2 LgH, float on, vec2 gdx, vec2 gdy) {
  Near o;
  o.colS = vec3(0.0); o.colA = vec3(0.0); o.emis = vec3(0.0); o.t = tG; o.kind = 3; o.pL = vec4(gG, 0.0, 1.0);
  vec2 hT = sphereHit(ro, rd, R + H_TOP);
  float t0 = max(hT.x, 0.0);
  vec3 P0 = ro + rd * t0;
  vec2 g0 = toGrid(P0);
  vec3 A = altQuad(altOf(P0), altOf(ro + rd * (0.5 * (t0 + tG))), 0.0);
  vec3 up0 = normalize(P0 - center);
  vec2 fa = vec2(faceFoot(rd, dRx, dRy, axisU(up0), up0), faceFoot(rd, dRx, dRy, axisV(up0), up0));
  vec3 nH = normalize(cross(up0, rd));
  float fh = abs(dot(dRx, nH)) + abs(dot(dRy, nH));
  vec2 fwG = abs(gdx) + abs(gdy);
  Miss M1, M2, B;
  Hit H = castNear(g0, gG, A, fa, fh, t0, tG, fwG, M1, M2, B);
  o.kind = H.kind;
  if (H.kind == 3) return o;
  float s = H.s;
  float t = mix(t0, tG, s);
  o.t = t;
  vec3 P = ro + rd * t;
  vec2 g = mix(g0, gG, s);
  float a = max(A.x + s * (A.y + s * A.z), 0.0);
  vec3 up = normalize(P - center);
  float kf = t / tG;
  float fpH = fpG * kf;
  // footprint on horizontal surfaces at this distance per grid axis, and in altitude on x / y facades
  vec2 fwR = fwG * kf;
  vec2 fyF = t * fa;
  vec2 dg = gG - g0;
  // the facades that can face the camera: grid and world normals, and the sun on them
  vec2 nGx = vec2(-sign(dg.x), 0.0), nGy = vec2(0.0, -sign(dg.y));
  vec3 nX = axisU(up) * nGx.x, nY = axisV(up) * nGy.y;
  vec2 ndlF = vec2(max(dot(nX, sunDir), 0.0), max(dot(nY, sunDir), 0.0));
  Lot L = H.L;
  vec4 dp = H.dp;
  int scheme = int(dp.y * 16.0) >> 2;
  float lr1 = fract(L.r.y * 13.7 + L.r.z * 5.3);
  float lr2 = fract(L.r.w * 11.3 + L.r.x * 7.1);
  float lr3 = fract(L.r.y * 3.1 + L.r.w * 17.9);
  int kc = lotColour(L, dp);
  vec3 wal = wallCol(scheme, kc), trim = trimCol(scheme), roofA = roofCol(scheme, kc);
  vec3 rimC = lr1 > 0.5 ? C_WHITE : C_LBG;
  float sunUp = max(muS, 0.0);
  bool ax0 = H.axis == 0;
  vec2 nG = ax0 ? nGx : nGy;
  // Every edge between two visible surfaces (roof / facade, facade / facade, facade / street) is box-filtered
  // from both sides: a pixel near it blends in the surface across, shaded the way that surface shades itself
  // there, so the two ramps meet at the same colour and the edge neither steps nor crawls. Each surface is
  // gathered as a sunlit part hS (times the sun, the buildings' shadow and the tower / cloud light) and an
  // unshadowed part hA. All kinds share one shadow march from one receiver (grid point rG, altitude rA,
  // footprints rFp, rFa; rA = 1e4: none needed): SwiftShader runs every branch for the whole pixel quad.
  vec3 hS = vec3(0.0), hA = vec3(0.0), hE = vec3(0.0);
  vec2 rG = g;
  float rA = a + 0.3, rFp = fpH, rFa = 0.0;
  // the street under the hit, or at the foot of the facade
  vec3 ge;
  vec3 ga = groundAlb(H.kind == 1 ? g + nG * 0.5 : g, fwR, L, muS, on, ge);
  if (H.kind == 1) {
    // ---------------- facade
    vec3 n = ax0 ? nX : nY;
    float ndl = ax0 ? ndlF.x : ndlF.y, ndl2 = ax0 ? ndlF.y : ndlF.x;
    float w = ax0 ? g.y : g.x;
    float wLo = ax0 ? L.lo.y : L.lo.x;
    float wHi = ax0 ? L.hi.y : L.hi.x;
    float rn = min(dot(rd, n), -0.03);
    vec3 W = cross(up, n);
    float fwW = t * (abs(dot(dRx - rd * (dot(dRx, n) / rn), W)) + abs(dot(dRy - rd * (dot(dRy, n) / rn), W)));
    float fwY = ax0 ? fyF.x : fyF.y;
    // glass = g0 + g1 * floors (period, offset, duty) * bays (period, duty), per style
    int style = int(lr2 * 3.999);
    vec4 sF = style == 0 ? vec4(8.0, 0.35, 0.5, 1.0) : (style == 1 ? vec4(8.0, 0.35, 0.42, 1.0) : (style == 2 ? vec4(8.0, 0.35, 1.0, 0.9) : vec4(24.0, 0.0, 0.14, -0.7)));
    vec3 sB = style == 1 ? vec3(6.0, 0.55, 0.0) : (style == 2 ? vec3(12.0, 0.3, 0.0) : vec3(6.0, 1.0, style == 3 ? 0.9 : 0.0));
    float floors = sF.z < 1.0 ? pulseA(a / sF.x - sF.y, sF.z, fwY / sF.x) : 1.0;
    float bays = sB.y < 1.0 ? pulseA(w / sB.x, sB.y, fwW / sB.x) : 1.0;
    float glass = sB.z + sF.w * floors * bays;
    // plain corners, parapet and plinth: bands centred on the edges, so at an edge they cover exactly the
    // facade's part of the footprint
    float corner = clamp(boxF(w - wLo, 3.0, fwW) + boxF(w - wHi, 3.0, fwW), 0.0, 1.0);
    float parapet = boxF(a - L.h, 3.0, fwY);
    float plinth = boxF(a, 5.0, fwY);
    glass *= (1.0 - corner) * (1.0 - parapet) * (1.0 - plinth);
    vec3 albW = mix(wal, trim, parapet);
    vec3 amb = sky * 0.45 * (0.35 + 0.65 * smoothstep(0.0, 70.0, a)) + sunC * sunUp * 0.05;
    float glint;
    vec3 gsky = glassSky(rd, n, up, muS, glint);
    hS = mix(albW * ndl, vec3(glint), glass);
    hA = mix(albW * amb, gsky, glass);
    // windows lit per floor and bay; the random on/off cells fade to their mean while they are still a
    // few pixels big (their hard cell edges would crawl)
    float litP = mix(0.2, 0.75, lr3) * on;
    float rw = hf(vec2(floor(a / 8.0) + L.r.x * 911.0, floor(w / 6.0) + L.r.z * 577.0));
    float kWin = smoothstep(3.0, 6.0, 8.0 / (PW * fwY)) * smoothstep(3.0, 6.0, 6.0 / (PW * fwW));
    hE = glass * mix(litP, step(rw, litP), kWin) * (lr3 > 0.45 ? WIN_WARM : WIN_COOL) * WIN_I;
    hE += plinth * (1.0 - corner) * on * WIN_WARM * 1.6;
    float wc = ax0 ? (dg.y > 0.0 ? L.lo.y : L.hi.y) : (dg.x > 0.0 ? L.lo.x : L.hi.x);
    float kCor = beyond(abs(w - wc), fwW);
    float kTop = beyond(L.h - a, fwY);
    float kBot = beyond(a, fwY);
    // the other camera-facing facade past the front corner (its plain corner band)
    hS = mix(hS, albW * ndl2, kCor);
    hA = mix(hA, albW * amb, kCor);
    hE *= 1.0 - kCor;
    // the roof's rim above the top edge
    float rimK = boxF(0.0, 2.2, ax0 ? fwR.x : fwR.y);
    vec3 rimA = mix(roofA, rimC, 0.6 * rimK);
    hS = mix(hS, rimA * sunUp, kTop);
    hA = mix(hA, rimA * sky, kTop);
    hE = mix(hE, on * rimK * 0.12 * WIN_WARM, kTop);
    // the street at the base (in the building's own shadow when this facade is turned from the sun)
    hS = mix(hS, ga * (ndl > 0.0 ? sunUp : 0.0), kBot);
    hA = mix(hA, ga * sky * 0.3, kBot);
    hE = mix(hE, ge, kBot);
    // shadow receiver: this facade when it faces the sun, else the corner and rim blends' (blended by weight)
    float wT = kTop, wC = ndl2 > 0.0 ? kCor : 0.0;
    float u = wT / max(wT + wC, 1e-6);
    bool lit = ndl > 0.0;
    rG = lit ? g + nG * 0.6 : mix(g + (ax0 ? nGy : nGx) * 0.6, g - nG * 0.5, u);
    rA = lit ? a : (wT + wC > 0.0 ? mix(a, L.h + 0.3, u) : 1e4);
    rFp = lit ? fwW : mix(fwW, fpH, u);
    rFa = lit ? fwY : fwY * (1.0 - u);
  }
  if (H.kind == 0) {
    // ---------------- roof: rim, rooftop block (plant room / penthouse) with its own little shadow, and on
    // block-wide complexes rows of skylights, on some big roofs a landing pad
    vec2 dLo = g - L.lo, dHi = L.hi - g;
    vec2 dE = min(dLo, dHi);
    float rim = max(boxF(dE.x, 2.2, fwR.x), boxF(dE.y, 2.2, fwR.y));
    vec2 ctr = 0.5 * (L.lo + L.hi);
    vec2 sz = L.hi - L.lo;
    bool mega = dp.z > 0.99;
    bool padRoof = min(sz.x, sz.y) > 110.0 && lr2 > 0.88;
    vec2 bh = sz * mix(0.16, 0.32, L.r.z);
    vec2 q = g - ctr - (L.r.wz - 0.5) * sz * 0.22;
    float blk = boxF(q.x, bh.x, fpH) * boxF(q.y, bh.y, fpH);
    vec2 so = -LgH * (5.0 + 9.0 * L.r.y);
    float bsh = boxF(q.x - 0.5 * so.x, bh.x + 0.5 * abs(so.x), fpH) * boxF(q.y - 0.5 * so.y, bh.y + 0.5 * abs(so.y), fpH);
    bool plain = !mega && !padRoof;
    bsh = plain && muS > 0.0 ? max(bsh - blk, 0.0) : 0.0;
    vec3 alb = mix(roofA, lr2 > 0.5 ? C_LBG : C_DBG, plain ? blk * 0.8 : 0.0);
    alb = mix(alb, rimC, rim * 0.6);
    bool axS = L.r.z > 0.5;
    float sky2 = mega ? pulseA((axS ? g.y : g.x) / 26.0, 0.3, (axS ? fwR.y : fwR.x) / 26.0) * (1.0 - rim) : 0.0;
    alb = mix(alb, vec3(0.02, 0.035, 0.05), sky2 * 0.85);
    float rr = length(g - ctr);
    float pr = min(sz.x, sz.y) * 0.34;
    float pad = padRoof ? boxF(rr - pr, 1.6, fpH) : 0.0;
    alb = mix(alb, C_DBG, padRoof ? boxF(rr, pr, fpH) * 0.7 : 0.0);
    alb = mix(alb, C_WHITE, pad);
    hS = alb * sunUp * (1.0 - 0.75 * bsh);
    hA = alb * sky;
    hE = on * (pad * vec3(1.0, 0.55, 0.2) * 3.0 + rim * 0.12 * WIN_WARM + sky2 * 0.9 * WIN_COOL);
    // the camera-facing edges: the facade tops below them (the parapet band over the facade's part of the
    // footprint)
    float kx = beyond(dg.x > 0.0 ? dLo.x : dHi.x, fwR.x);
    float ky = beyond(dg.y > 0.0 ? dLo.y : dHi.y, fwR.y);
    vec3 ambR = sky * 0.45 * (0.35 + 0.65 * smoothstep(0.0, 70.0, L.h)) + sunC * sunUp * 0.05;
    vec3 wx = mix(wal, trim, boxF(0.0, 3.0, fyF.x)), wy = mix(wal, trim, boxF(0.0, 3.0, fyF.y));
    hS = mix(mix(hS, wx * ndlF.x, kx), wy * ndlF.y, ky);
    hA = mix(mix(hA, wx * ambR, kx), wy * ambR, ky);
    hE *= (1.0 - kx) * (1.0 - ky);
  }
  if (H.kind == 2) {
    // ---------------- ground: streets, plazas and parks, and the wall base just beyond (its plinth, lit as
    // that facade would be there)
    hS = ga * sunUp;
    hA = ga * sky * 0.3;
    hE = ge;
    bool bx = B.axis == 0;
    float kB = B.s < 1e8 ? beyond((B.s - 1.0) * abs(bx ? dg.x : dg.y), bx ? fwR.x : fwR.y) : 0.0;
    vec3 wb = wallCol(int(B.dp.y * 16.0) >> 2, lotColour(B.L, B.dp));
    hS = mix(hS, wb * (bx ? ndlF.x : ndlF.y), kB);
    hA = mix(hA, wb * (sky * 0.1575 + sunC * sunUp * 0.05), kB);
    hE = mix(hE, boxF(0.0, 5.0, bx ? fyF.x : fyF.y) * on * WIN_WARM * 1.6, kB);
    rA = 0.3;
  }
  if (muS <= 0.0) rA = 1e4;
  vec3 colS = sunC * hS * (1.0 - cityShadow(rG, rA, LgH, rFp, rFa));
  vec3 colA = hA, emis = hE;
  // the silhouettes the ray grazed on the way (castNear), composited over the hit with the nearer on top.
  // They share one shadow march at the k-weighted blend of their points, rim or corner: both lie within a
  // pixel of the ray, and the blend stays continuous as they swap or fade.
  if (M1.s > s) M1.k = 0.0;
  if (M2.s > s) M2.k = 0.0;
  float kSum = M1.k + M2.k;
  vec4 pL = vec4(g, a, kf);
  if (kSum > 0.0) {
    vec4 pM = vec4(0.0);
    float fzM = 0.0;
    for (int j = 0; j < 2; j++) {
      Miss m = M1;
      if (j == 1) m = M2;
      float km = mix(t0, tG, m.s) / tG;
      float am = max(A.x + m.s * (A.y + m.s * A.z), 0.0);
      vec2 cn = m.axis == 0 ? vec2(dg.x > 0.0 ? m.L.lo.x : m.L.hi.x, dg.y > 0.0 ? m.L.hi.y : m.L.lo.y)
                            : vec2(dg.x > 0.0 ? m.L.hi.x : m.L.lo.x, dg.y > 0.0 ? m.L.lo.y : m.L.hi.y);
      vec3 pR = vec3(mix(g0, gG, m.s) - normalize(dg) * 0.6, m.L.h + 0.3);
      vec3 pC = vec3(cn + (nGx + nGy) * 0.6, am);
      float wk = m.k / kSum;
      pM += wk * vec4(mix(pR, pC, m.w), km);
      fzM += wk * m.w * km * tG * (m.axis == 0 ? fa.x : fa.y);
    }
    float msh = 1.0 - cityShadow(pM.xy, muS > 0.0 ? pM.z : 1e4, LgH, fpG * pM.w, fzM);
    for (int j = 0; j < 2; j++) {
      Miss m = M2;
      if ((j == 0) == (M1.s > M2.s)) m = M1;
      int ms = int(m.dp.y * 16.0) >> 2;
      int mk = lotColour(m.L, m.dp);
      float km = mix(t0, tG, m.s) / tG;
      // the roof's rim along the far edge the ray clears, and the plain corner band of the visible facade
      vec2 fwM = fwG * km;
      float rimK = mix(boxF(0.0, 2.2, fwM.y), boxF(0.0, 2.2, fwM.x), m.wx);
      vec3 rimA = mix(roofCol(ms, mk), fract(m.L.r.y * 13.7 + m.L.r.z * 5.3) > 0.5 ? C_WHITE : C_LBG, 0.6 * rimK);
      float am = max(A.x + m.s * (A.y + m.s * A.z), 0.0);
      vec3 albC = mix(wallCol(ms, mk), trimCol(ms), boxF(am - m.L.h, 3.0, km * tG * (m.axis == 0 ? fa.x : fa.y)));
      vec3 ambC = sky * 0.45 * (0.35 + 0.65 * smoothstep(0.0, 70.0, am)) + sunC * sunUp * 0.05;
      colS = mix(colS, sunC * msh * mix(rimA * sunUp, albC * (m.axis == 0 ? ndlF.x : ndlF.y), m.w), m.k);
      colA = mix(colA, mix(rimA * sky, albC * ambC, m.w), m.k);
      emis = mix(emis, on * rimK * 0.12 * WIN_WARM * (1.0 - m.w), m.k);
    }
    // the tower / cloud light is looked up where the pixel's colour comes from
    pL = mix(pL, pM, 1.0 - (1.0 - M1.k) * (1.0 - M2.k));
  }
  o.colS = colS;
  o.colA = colA;
  o.emis = emis;
  o.pL = pL;
  return o;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 dRx = dFdx(rd), dRy = dFdy(rd);
  vec2 hG = sphereHit(ro, rd, R);
  float tAp = max(-dot(ro - center, rd), 0.0);
  float tG = hG.x > 0.0 ? hG.x : tAp;
  vec2 gG = toGrid(ro + rd * tG);
  vec2 gdx = dFdx(gG), gdy = dFdy(gG);
  vec2 hC = sphereHit(ro, rd, R + H_CLOUD);
  float tC = hC.x > 0.0 ? hC.x : tAp;
  vec3 PC = ro + rd * tC;
  vec2 gC = toGrid(PC);
  vec2 cdx = dFdx(gC), cdy = dFdy(gC);
  vec4 cl = cloudDeck(rd, PC, gC, cdx, cdy);
  vec3 cloudC = cl.rgb;
  float cover = cl.a;
  vec3 outC = cloudC;
  // between the true horizon and the proxy's silhouette: air only (nearly opaque this close to the limb)
  if (hG.x <= 0.0) outC = limb(ro, rd).rgb;
  // nothing of the city shows through a solid deck
  if (hG.x > 0.0 && cover <= 0.998) {
    vec3 PG = ro + rd * tG;
    vec3 N = (PG - center) / R;
    float muS = dot(N, sunDir);
    vec2 LgH = sunGrid(N, 1.0, muS);
    vec3 sunC = SUN_E * sunTrans(40.0, muS);
    vec3 sky = skyAmb(muS);
    float on = lightsOn(muS);
    float fpG = max(length(gdx), length(gdy));
    float kDet = smoothstep(${NEAR_PX / 2}.0, ${NEAR_PX}.0, LOT / fpG);
#if defined(FAR_ONLY)
    kDet = 0.0;
#endif
    Near nc;
    nc.colS = vec3(0.0); nc.colA = vec3(0.0); nc.emis = vec3(0.0); nc.t = tG; nc.kind = 3; nc.pL = vec4(gG, 0.0, 1.0);
#if defined(NEAR_ONLY)
    // (the ray is steep here, so the cast always ends inside its step budget)
    nc = nearCity(ro, rd, dRx, dRy, tG, gG, fpG, muS, sunC, sky, LgH, on, gdx, gdy);
    vec4 pL = nc.pL;
    vec3 fS = nc.colS, fA = nc.colA, fE = nc.emis;
    float tCity = nc.t;
#else
#if !defined(FAR_ONLY)
    if (kDet > 0.0) nc = nearCity(ro, rd, dRx, dRy, tG, gG, fpG, muS, sunC, sky, LgH, on, gdx, gdy);
#endif
    if (nc.kind == 3) kDet = 0.0;
    vec2 hM = sphereHit(ro, rd, R + H_MID);
    float kM = hM.x > 0.0 ? hM.x / tG : 1.0;
    vec2 gM = hM.x > 0.0 ? toGrid(ro + rd * hM.x) : gG;
    vec3 fS = vec3(0.0), fA = vec3(0.0), fE = vec3(0.0);
    if (kDet < 0.999) farCity(gM, gdx * kM, gdy * kM, N, rd, muS, sunC, sky, on, kDet, fS, fA, fE);
    // one mega-tower / cloud light lookup for the pixel, at the blend of the far field's point (its roofs)
    // and the near field's (the hit, or the silhouettes over it): both fields are smooth at this scale
    vec4 pL = mix(vec4(gM, H_MID, kM), nc.pL, kDet);
    fS = mix(fS, nc.colS, kDet);
    fA = mix(fA, nc.colA, kDet);
    fE = mix(fE, nc.emis, kDet);
    float tCity = mix(tG, nc.t, kDet);
#endif
    vec2 ldx = gdx * pL.w, ldy = gdy * pL.w;
    float lTC = towerLit(pL.xy, pL.z, LgH, ldx, ldy, 0.0) * (1.0 - cloudShadow(pL.xy, pL.z, LgH, ldx, ldy, fpG * pL.w));
    vec3 col = fS * lTC + fA;
    vec3 emis = fE;
    float nf = nightF(muS);
    if (nf > 0.0) emis += airLanes(ro, rd, tG, gdx, gdy, tCity, nf * sqrt(nf));
    col = haze(col + emis, PG, rd);
    outC = mix(col, cloudC, cover);
  }
  gl_FragColor = vec4(outC, 1.0);
}
`;
