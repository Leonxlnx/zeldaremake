/**
 * Layered PBR ground material (W06). A MeshStandardMaterial whose map/normal/roughness chunks are
 * replaced by a six-layer splat: grass, soil, moss, leaf litter, path gravel, cliff rock.
 * Blend weights arrive as two vec4 vertex attributes (aW0 = grass/soil/moss/litter,
 * aW1 = gravel/rock/damp/macro). UVs are world XZ metres so tiling is independent of chunk LOD;
 * every layer is sampled at two scales to kill visible repetition, and the cliff rock is
 * triplanar so steep faces do not stretch. Lights, shadows and scene fog keep working because
 * the rest of the standard shader is untouched.
 *
 * Round 43 (terrain-4) — the bare ground at player height (1.45 m eye, 1–4 m; frame 03 of the
 * owner's recording: dark damp soil under leaf litter, roots crossing it, moss beds in cushions,
 * small stones, wet patches). The 1.9–2.8 m tiles put a texel at ≈ 1 mm, so what was missing at
 * 2 m was relief and layering, not texels. Everything below is camera-distance faded so the fixed
 * cameras' ground (4–6 m and beyond) keeps round 42's look; see `GROUND_NEAR` for the dials.
 *  - a ≈ 3 m near tile of the soil and litter maps blended in under `NEAR_FADE` with the normal
 *    at `NEAR_NORMAL_K` × its far scale (0.75 → 1.4): litter edges and soil clods shade;
 *  - a 0.7 m detail tile of brown_mud_leaves_01 (normal + albedo luminance) under `DETAIL_FADE`,
 *    plus procedural litter — pointed, domed leaves in four dead-leaf tones with a midrib, and
 *    twigs — placed one per jittered cell of a seeded hash, densest on the litter layer;
 *  - moss beds as 9 cm / 4.5 cm cushion domes (normal + albedo) on the moss layer;
 *  - a wet band (aW2.x, chunks.ts: dish floors, depressions, embankment feet, the giants' drip
 *    ring): darker, cooler, roughness 0.46;
 *  - bank faces (soil on slopes ≥ 0.25): root-like ridges running downslope and 1–2.5 cm pebbles,
 *    normal + albedo only;
 *  - the path verge (gravel layer): 0.6–3 cm stones in two jittered grids and a contrast lift of
 *    the gravel map under `DETAIL_FADE`;
 *  - vertex relief ≤ 1.5 cm (clods, root humps at the giants' feet) on the fine lattice within
 *    `RELIEF_FADE` m of the camera, off on the paving / stairs / pads (aW2.y). GPU-side: the
 *    sampler `height()` and the CPU mesh the audit raycasts are untouched.
 */
import { Color, MeshStandardMaterial, Texture, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';

export const TERRAIN_LAYERS = ['grass', 'soil', 'moss', 'leaf-litter', 'path-gravel', 'cliff-rock'] as const;

/** texture set per layer (public/textures/<set>/) and its tile size in metres */
export const LAYER_SETS: Record<(typeof TERRAIN_LAYERS)[number], { set: string; tile: number }> = {
  grass: { set: 'leafy_grass', tile: 2.4 },
  soil: { set: 'forest_ground_04', tile: 2.2 },
  moss: { set: 'aerial_grass_rock', tile: 2.8 },
  'leaf-litter': { set: 'brown_mud_leaves_01', tile: 1.9 },
  'path-gravel': { set: 'rocky_trail', tile: 1.6 },
  'cliff-rock': { set: 'rock_face_03', tile: 3.2 },
};

/** near tile of the soil / litter maps (m); the mesh tile takes over beyond NEAR_FADE[1] */
const NEAR_TILE_M = 3.0;
const NEAR_FADE: [number, number] = [3.0, 6.0];
/** the layer normals read this × normalScale at the feet (0.75 → 1.4) */
const NEAR_NORMAL_K = 1.9;
/** detail tile (m) of the litter map used as a second normal + albedo term, and its fade */
const DETAIL_TILE_M = 0.7;
const DETAIL_FADE: [number, number] = [2.5, 6.0];
const DETAIL_NORMAL_K = 0.5;
const DETAIL_ALBEDO_K = 0.45;
/** mean linear luminance of brown_mud_leaves_01/color (measured), the detail albedo pivot */
const LITTER_MEAN_LUM = 0.098;
/** mean linear luminance of rocky_trail/color (measured), the verge contrast pivot */
const GRAVEL_MEAN_LUM = 0.236;
/** vertex relief: hard cap (m), camera fade (m), and the normal's exaggeration over the true slope */
const RELIEF_MAX_M = 0.015;
const RELIEF_FADE: [number, number] = [5.0, 9.0];
const RELIEF_NORMAL_K = 2.5;
/** bank-face detail (root ridges, pebbles) fade */
const BANK_FADE: [number, number] = [4.0, 9.0];
/** wet band: albedo multiplier (dark, a touch cool) and roughness */
const WET_TINT = new Color(0.45, 0.48, 0.56);
const WET_ROUGHNESS = 0.46;

/** the near-camera ground treatment, for the terrain audit */
export const GROUND_NEAR = {
  nearTileM: NEAR_TILE_M,
  nearFadeM: NEAR_FADE,
  nearNormalK: NEAR_NORMAL_K,
  detailTileM: DETAIL_TILE_M,
  detailFadeM: DETAIL_FADE,
  detailNormalK: DETAIL_NORMAL_K,
  detailAlbedoK: DETAIL_ALBEDO_K,
  reliefMaxM: RELIEF_MAX_M,
  reliefFadeM: RELIEF_FADE,
  bankFadeM: BANK_FADE,
  wetRoughness: WET_ROUGHNESS,
  proceduralLitter: true,
  mossCushions: true,
  vergeStones: true,
};

const f = (v: number) => v.toFixed(4);

const HASH_GLSL = /* glsl */ `
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tVNoise(vec2 p) {
  vec2 i = floor(p); vec2 fr = fract(p); fr = fr * fr * (3.0 - 2.0 * fr);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), fr.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), fr.x), fr.y);
}
`;

const PARS = /* glsl */ `
uniform sampler2D tGrassC; uniform sampler2D tGrassN;
uniform sampler2D tSoilC;  uniform sampler2D tSoilN;
uniform sampler2D tMossC;  uniform sampler2D tMossN;
uniform sampler2D tLitterC; uniform sampler2D tLitterN;
uniform sampler2D tGravelC; uniform sampler2D tGravelN;
uniform sampler2D tRockC;  uniform sampler2D tRockN;
uniform vec3 uTiles0; // grass, soil, moss   (1/tile)
uniform vec3 uTiles1; // litter, gravel, rock (1/tile)
uniform vec3 uGrassDeep; uniform vec3 uGrassLight; uniform vec3 uMossDeep; uniform vec3 uMossBright;
uniform vec3 uSoilTint; uniform vec3 uSoilDark; uniform vec3 uStoneTint; uniform vec3 uWetTint;
varying vec4 vW0; varying vec4 vW1; varying vec4 vW2; varying vec3 vWPos; varying vec3 vWNrm;
${HASH_GLSL}

// rotate uv by a fixed angle so the second scale never lines up with the first
vec2 rot2(vec2 p) { const float c = 0.83867; const float s = 0.54464; return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// two-scale sample: detail tile + a 3.7x larger rotated tile, mixed by the per-vertex macro noise
vec3 col2(sampler2D t, vec2 uv, float inv, float k) {
  vec3 a = texture2D(t, uv * inv).rgb;
  vec3 b = texture2D(t, rot2(uv) * inv * 0.27 + vec2(0.31, 0.77)).rgb;
  return mix(a, b, k);
}
vec3 nrm2(sampler2D t, vec2 uv, float inv, float k) {
  vec3 a = texture2D(t, uv * inv).xyz * 2.0 - 1.0;
  vec3 b = texture2D(t, rot2(uv) * inv * 0.27 + vec2(0.31, 0.77)).xyz * 2.0 - 1.0;
  // rotate the second sample's tangent-space xy back so slopes agree with the first
  const float c = 0.83867; const float s = 0.54464;
  b.xy = vec2(c * b.x + s * b.y, -s * b.x + c * b.y);
  return normalize(mix(a, b, k));
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// round 43: camera-distance weights of the near-field treatment (1 at the feet, 0 beyond)
float groundNearW() { return 1.0 - smoothstep(${f(NEAR_FADE[0])}, ${f(NEAR_FADE[1])}, length(vViewPosition)); }
float groundDetailW() { return 1.0 - smoothstep(${f(DETAIL_FADE[0])}, ${f(DETAIL_FADE[1])}, length(vViewPosition)); }
float groundBankW() { return 1.0 - smoothstep(${f(BANK_FADE[0])}, ${f(BANK_FADE[1])}, length(vViewPosition)); }
// the near tile's uv (≈ NEAR_TILE_M m): the mesh tile's uv scaled by tile / NEAR_TILE_M, offset so
// the two never line up
vec2 nearUv(vec2 uv, float tile) { return uv * (tile / ${f(NEAR_TILE_M)}) + vec2(0.37, 0.61); }
vec2 detailUv(vec2 uv) { return vec2(uv.y, -uv.x) * ${f(1 / DETAIL_TILE_M)} + vec2(0.71, 0.23); }
// near / far blend of a layer's colour (nw = near weight)
vec3 colNear(sampler2D t, vec2 uv, float inv, float tile, float k, float nw) {
  vec3 far = col2(t, uv, inv, k);
  if (nw <= 0.001) return far;
  return mix(far, col2(t, nearUv(uv, tile), inv, k), nw);
}
vec3 nrmNear(sampler2D t, vec2 uv, float inv, float tile, float k, float nw) {
  vec3 far = nrm2(t, uv, inv, k);
  if (nw <= 0.001) return far;
  return normalize(mix(far, nrm2(t, nearUv(uv, tile), inv, k), nw));
}

// the surface-metric offset for a detail drawn in xz on a slope: xz metres along the fall line
// are n.y × the true surface distance, so a leaf drawn in xz would stretch 1.8× on a 57° bank;
// sl = (fall-line direction, 1 / n.y − 1) stretches the leaf-local offset instead (per detail,
// so the cells stay put and nothing shears where the slope changes)
vec2 slopeFix(vec2 d, vec3 sl) { return d + sl.xy * (dot(d, sl.xy) * sl.z); }
vec3 slopeFrame(vec3 nn) { float ny = max(nn.y, 0.35); return ny > 0.995 ? vec3(0.0) : vec3(normalize(nn.xz), 1.0 / ny - 1.0); }
// procedural litter: one pointed, domed leaf per jittered cell (m) where the cell's hash is
// under dens. Blends the leaf's tone into c by coverage and adds a dome tilt to nxy (world xz
// frame, the same frame the layer normal maps use). Returns the coverage.
float leafLayer(vec2 p, float cell, float seed, float dens, vec3 sl, inout vec3 c, inout vec2 nxy) {
  vec2 g = p / cell;
  vec2 i = floor(g);
  vec2 fr = g - i - 0.5;
  float h1 = tHash(i + seed);
  float h2 = tHash(i + seed + 17.3);
  float h3 = tHash(i + seed + 41.7);
  if (h2 > dens) return 0.0;
  vec2 ctr = (vec2(h1, h3) - 0.5) * 0.2;
  float ang = h2 * 47.0;
  float cs = cos(ang); float sn = sin(ang);
  vec2 d = slopeFix((fr - ctr) * cell, sl);
  vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
  // 5–10 cm blades (the reference floor's litter is beech / oak sized, not maple)
  vec2 ax = vec2(0.04, 0.024) * (0.6 + 0.7 * h1);
  // pointed tip: the half-width shrinks toward +x
  float pinch = 1.0 - 0.38 * smoothstep(0.0, 1.0, q.x / ax.x);
  vec2 qn = vec2(q.x / ax.x, q.y / (ax.y * pinch));
  float e = length(qn);
  float cov = 1.0 - smoothstep(0.9, 1.02, e);
  // contact shadow: the ground just outside the rim is darkened (a leaf lying on soil reads
  // by the shade it casts even where no sun reaches)
  float shade = (1.0 - smoothstep(1.0, 1.28, e)) * (1.0 - cov);
  c *= 1.0 - 0.3 * shade;
  if (cov <= 0.001) return 0.0;
  // a nearly flat blade with a curled rim: the normal tilts outward mostly near the edge
  vec2 tilt = qn * (0.18 + 0.45 * smoothstep(0.55, 1.0, e));
  vec2 tw = vec2(cs * tilt.x - sn * tilt.y, sn * tilt.x + cs * tilt.y);
  nxy += tw * cov;
  // dead-leaf tones (linear albedo): tan, ochre, umber, rust — the pale ones most often, so the
  // litter reads against the dark soil in the canopy shade
  vec3 tone = h3 < 0.35 ? vec3(0.34, 0.25, 0.12) : h3 < 0.65 ? vec3(0.27, 0.17, 0.07) : h3 < 0.85 ? vec3(0.16, 0.10, 0.06) : vec3(0.24, 0.10, 0.05);
  tone *= 0.8 + 0.4 * h1;
  // midrib and a darkening toward the rim (the blade curls out of the light)
  float rib = (1.0 - smoothstep(0.0012, 0.0028, abs(q.y))) * (1.0 - smoothstep(0.7, 0.95, abs(qn.x)));
  tone *= (1.0 - 0.3 * rib) * (1.0 - 0.22 * smoothstep(0.6, 1.0, e));
  c = mix(c, tone, cov);
  return cov;
}
// a twig per jittered cell: a 2.5–4.5 mm radius rod of 0.15–0.35 × cell length, cylinder normal
float twigLayer(vec2 p, float cell, float seed, float dens, vec3 sl, inout vec3 c, inout vec2 nxy) {
  vec2 g = p / cell;
  vec2 i = floor(g);
  vec2 fr = g - i - 0.5;
  float h1 = tHash(i + seed);
  float h2 = tHash(i + seed + 7.7);
  float h3 = tHash(i + seed + 23.1);
  if (h2 > dens) return 0.0;
  float ang = h1 * 6.2832;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 d = slopeFix((fr - (vec2(h3, h1) - 0.5) * 0.2) * cell, sl);
  float along = dot(d, dir);
  float across = dot(d, vec2(-dir.y, dir.x));
  float halfLen = cell * (0.15 + 0.2 * h3);
  float r = 0.0035 + 0.003 * h1;
  float cov = (1.0 - smoothstep(r * 0.8, r * 1.2, abs(across))) * (1.0 - smoothstep(halfLen - 0.012, halfLen, abs(along)));
  // contact shadow along the rod
  c *= 1.0 - 0.25 * (1.0 - smoothstep(r * 1.2, r * 2.4, abs(across))) * (1.0 - smoothstep(halfLen - 0.005, halfLen + 0.006, abs(along))) * (1.0 - cov);
  if (cov <= 0.001) return 0.0;
  nxy += vec2(-dir.y, dir.x) * clamp(across / r, -1.0, 1.0) * 0.7 * cov;
  // dark warm bark (the round-42 rods read steel-grey in the cool shade fill)
  vec3 tone = mix(vec3(0.10, 0.065, 0.04), vec3(0.17, 0.12, 0.075), h3);
  c = mix(c, tone, cov);
  return cov;
}
// moss cushions: the tallest dome of a 3 × 3 jittered-cell neighbourhood (cell in m). Returns the
// dome height 0..1 and adds its outward tilt to nxy.
float cushionLayer(vec2 p, float cell, float seed, float amp, inout vec2 nxy) {
  vec2 g = p / cell;
  vec2 i = floor(g);
  vec2 fr = g - i;
  float best = 0.0;
  vec2 bestTilt = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 ctr = o + vec2(tHash(i + o + seed), tHash(i + o + seed + 5.5)) * 0.8 + 0.1;
      vec2 d = fr - ctr;
      float r = 0.55 + 0.25 * tHash(i + o + seed + 9.1);
      float dome = max(0.0, 1.0 - dot(d, d) / (r * r));
      if (dome > best) { best = dome; bestTilt = d / (r * r); }
    }
  }
  nxy += bestTilt * amp * (0.3 + 0.7 * best);
  return best;
}
// pebbles: one disc per jittered cell (m) where the cell's hash is under dens, radius rMin..rMax
// (m), a domed normal and a contact-shade ring; w scales coverage. Returns the coverage.
float pebbleLayer(vec2 p, float cell, float seed, float dens, float rMin, float rMax, vec3 sl, float w, inout vec3 c, inout vec2 nxy) {
  vec2 g = p / cell;
  vec2 i = floor(g);
  vec2 fr = g - i - 0.5;
  float h1 = tHash(i + seed);
  float h2 = tHash(i + seed + 10.6);
  float h3 = tHash(i + seed + 23.8);
  if (h2 >= dens) return 0.0;
  vec2 d = slopeFix((fr - (vec2(h1, h3) - 0.5) * 0.4) * cell, sl);
  float r = mix(rMin, rMax, h1);
  float e = length(d) / r;
  float cov = (1.0 - smoothstep(0.85, 1.05, e)) * w;
  c *= 1.0 - 0.3 * (1.0 - smoothstep(1.0, 1.4, e)) * (1.0 - cov) * w;
  if (cov <= 0.001) return 0.0;
  nxy += (d / r) * 0.8 * cov;
  // grey, warm grey and a rusty one; the far side of the dome falls into shade
  vec3 tone = h3 < 0.55 ? vec3(0.36, 0.34, 0.31) : h3 < 0.85 ? vec3(0.38, 0.33, 0.27) : vec3(0.33, 0.24, 0.17);
  c = mix(c, tone * (0.7 + 0.6 * h1) * (1.0 - 0.3 * smoothstep(0.5, 1.0, e)), cov);
  return cov;
}
// bank faces: root-like ridges running downslope (dn = downslope direction in xz) and pebbles,
// as normal + albedo only. w = bank weight (soil × steepness × fade).
void bankDetail(vec2 p, vec3 nn, float w, inout vec3 c, inout vec2 nxy) {
  vec2 dn = normalize(nn.xz);
  vec3 sl = slopeFrame(nn);
  vec2 ac = vec2(-dn.y, dn.x);
  float a = dot(p, dn);
  float cc = dot(p, ac);
  // ridges 15 cm apart, wandering along the fall line, present in patches; the trough beside
  // each ridge is darker (the root's own shade), the crown paler and warmer (bark)
  float wob = (tVNoise(vec2(a * 2.5, cc * 1.2) + vec2(31.0, 7.0)) - 0.5) * 0.5;
  float presence = smoothstep(0.36, 0.62, tVNoise(p * 1.1 + vec2(-19.0, 3.0))) * w;
  float ph = (cc + wob) * 6.5 * 6.2832;
  float base = 0.5 + 0.5 * cos(ph);
  float ridge = base * base * base;
  float dr = -3.0 * base * base * 0.5 * sin(ph) * 6.5 * 6.2832;
  nxy += -ac * dr * 0.012 * presence;
  float trough = smoothstep(0.3, 0.0, base);
  c *= mix(1.0, mix(0.72, 1.35, ridge) * (1.0 - 0.2 * trough), presence);
  c = mix(c, c * vec3(1.12, 1.0, 0.82), ridge * presence * 0.7);
  // pebbles: 0.9–2.2 cm in a 12 cm jittered grid, 40 % of the cells
  pebbleLayer(p, 0.12, 3.3, 0.4, 0.009, 0.022, sl, w, c, nxy);
}
// the path verge (the gravel layer beside the flagstones): the stony soil's small stones, 0.6–1.8
// cm in a 7 cm grid plus a sparser 1.5–3 cm size in a 16 cm grid, on top of the gravel map's
// contrast lift. w = gravel weight × detail fade.
float vergeDetail(vec2 p, vec3 sl, float w, inout vec3 c, inout vec2 nxy) {
  float cov = pebbleLayer(p, 0.07, 6.1, 0.5, 0.006, 0.018, sl, w, c, nxy);
  cov = max(cov, pebbleLayer(p + vec2(0.021, 0.037), 0.16, 8.9, 0.3, 0.015, 0.03, sl, w, c, nxy));
  return cov;
}
// the near-field detail terms shared by the colour and normal passes: near / detail / bank
// weights and the litter density (leaves + twigs are densest on the litter layer, thinner on soil
// and moss, a few on the turf)
float litterDensity(vec4 w0) { return clamp(w0.w * 0.8 + w0.y * 0.4 + w0.z * 0.16 + w0.x * 0.08, 0.0, 0.8); }
// the procedural litter, colour and normal together (the two passes call it with the same
// arguments so the coverage agrees)
float litterDetail(vec2 uvw, float dens, vec3 sl, inout vec3 c, inout vec2 nxy) {
  float cov = leafLayer(uvw, 0.17, 1.0, dens, sl, c, nxy);
  cov = max(cov, leafLayer(uvw + vec2(0.05, 0.03), 0.22, 2.0, dens * 0.85, sl, c, nxy));
  cov = max(cov, leafLayer(uvw + vec2(-0.07, 0.11), 0.3, 4.0, dens * 0.7, sl, c, nxy));
  cov = max(cov, twigLayer(uvw, 0.4, 3.0, dens * 0.7, sl, c, nxy));
  cov = max(cov, twigLayer(uvw + vec2(0.13, -0.09), 0.26, 5.0, dens * 0.5, sl, c, nxy));
  return cov;
}
// near-tile contrast: the soil / litter maps are low-contrast scans; at the feet the darks go
// darker and the pale clods paler about the map's mean (unit mean, so the far tone is kept)
vec3 nearContrast(vec3 s, float meanLum, float nw) { return mix(s, s * clamp(lum(s) / meanLum, 0.6, 1.5), 0.35 * nw); }
`;

const VERT_PARS = /* glsl */ `
attribute vec4 aW0; attribute vec4 aW1; attribute vec4 aW2;
varying vec4 vW0; varying vec4 vW1; varying vec4 vW2; varying vec3 vWPos; varying vec3 vWNrm;
${HASH_GLSL}
// micro relief (m) of the near ground: 0.43 m and 0.2 m clods plus ridged root humps that grow
// with the giant-root proximity; |h| ≤ 0.0085 + 0.006 < RELIEF_MAX_M
float reliefH(vec2 p, float roots) {
  float c1 = tVNoise(p * 2.3 + vec2(3.1, 7.7)) - 0.5;
  float c2 = tVNoise(p * 5.1 + vec2(-9.3, 2.4)) - 0.5;
  float h = 0.012 * c1 + 0.005 * c2;
  float r = abs(tVNoise(p * 1.7 + vec2(11.0, -5.0)) - 0.5) * 2.0;
  return h + roots * 0.006 * (1.0 - r);
}
`;

// After <beginnormal_vertex>: the relief height and its slope (the normal takes the slope at
// RELIEF_NORMAL_K so clods shade like clods; the surface itself moves ≤ RELIEF_MAX_M).
const VERT_RELIEF = /* glsl */ `
float tReliefDh = 0.0;
{
  vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
  float dcam = distance(cameraPosition, wp0);
  // off at the detail ring's edge: the 1 m ring's seam vertices are not on the fine lattice
  float edge = 1.0 - smoothstep(45.0, 47.5, max(abs(wp0.x), abs(wp0.z)));
  float fade = (1.0 - smoothstep(${f(RELIEF_FADE[0])}, ${f(RELIEF_FADE[1])}, dcam)) * clamp(aW2.y, 0.0, 1.0) * edge;
  if (fade > 0.001) {
    float e = 0.06;
    float h0 = reliefH(wp0.xz, aW2.z);
    float hx = reliefH(wp0.xz + vec2(e, 0.0), aW2.z) - reliefH(wp0.xz - vec2(e, 0.0), aW2.z);
    float hz = reliefH(wp0.xz + vec2(0.0, e), aW2.z) - reliefH(wp0.xz - vec2(0.0, e), aW2.z);
    tReliefDh = clamp(h0, -${f(RELIEF_MAX_M)}, ${f(RELIEF_MAX_M)}) * fade;
    vec2 gr = vec2(hx, hz) / (2.0 * e) * fade * ${f(RELIEF_NORMAL_K)};
    objectNormal = normalize(objectNormal + vec3(-gr.x, 0.0, -gr.y));
  }
}
`;

const VERT_MAIN = /* glsl */ `
vW0 = aW0; vW1 = aW1; vW2 = aW2;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNrm = normalize(mat3(modelMatrix) * objectNormal);
`;

// Replaces <map_fragment>: builds diffuseColor.rgb from the six layers.
const MAP_FRAG = /* glsl */ `
{
  vec2 uvw = vWPos.xz;
  float k = vW1.w;                    // macro noise 0..1 (per vertex, low frequency)
  float mixK = smoothstep(0.25, 0.75, k);
  vec4 w0 = vW0; vec4 w1 = vW1;
  float nw = groundNearW();
  float dw = groundDetailW();
  vec3 c = vec3(0.0);
  vec2 nxyUnused = vec2(0.0);

  // grass: texture provides luminance detail, palette provides hue (stylised, not photo-brown)
  if (w0.x > 0.002) {
    vec3 g = col2(tGrassC, uvw, uTiles0.x, mixK);
    float gl = lum(g);
    vec3 tint = mix(uGrassDeep, uGrassLight, smoothstep(0.15, 0.85, k) * 0.7 + gl * 0.3);
    vec3 grass = tint * (0.55 + 1.05 * gl) ;
    grass = mix(grass, g * vec3(0.85, 1.05, 0.7), 0.22);
    c += grass * w0.x;
  }
  // soil: natural texture, pulled toward the palette soil, darker when damp
  if (w0.y > 0.002) {
    vec3 s = nearContrast(colNear(tSoilC, uvw, uTiles0.y, ${f(LAYER_SETS.soil.tile)}, mixK, nw), 0.11, nw);
    s = mix(s, uSoilTint * (0.6 + 0.9 * lum(s)), 0.35);
    c += s * w0.y;
  }
  // moss: bright yellow-green mossy carpet, palette hue; cushion domes up close
  if (w0.z > 0.002) {
    vec3 m = col2(tMossC, uvw, uTiles0.z, mixK);
    float ml = lum(m);
    vec3 moss = mix(uMossDeep, uMossBright, smoothstep(0.2, 0.7, ml)) * (0.7 + 0.6 * ml);
    moss = mix(moss, m, 0.3);
    if (dw > 0.001) {
      // cushion tops a brighter, fuller moss green (sheet 05 'Moss Texture': lit domes over dark
      // gaps), the creases between them the soil they grow on
      float c1 = cushionLayer(uvw, 0.09, 3.7, 0.0, nxyUnused);
      float c2 = cushionLayer(uvw, 0.045, 11.9, 0.0, nxyUnused);
      float crease = 1.0 - smoothstep(0.0, 0.25, c1);
      vec3 top = mix(uMossDeep, uMossBright, 0.55 + 0.45 * ml) * 1.2;
      vec3 cushioned = mix(moss * 0.62, top, smoothstep(0.15, 0.9, c1)) * mix(0.9, 1.08, c2);
      cushioned = mix(cushioned, uSoilDark * 0.9, crease * 0.6);
      moss = mix(moss, cushioned, dw * 0.85);
    }
    c += moss * w0.z;
  }
  // leaf litter / forest floor
  if (w0.w > 0.002) {
    vec3 l = nearContrast(colNear(tLitterC, uvw, uTiles1.x, ${f(LAYER_SETS['leaf-litter'].tile)}, mixK, nw), ${f(LITTER_MEAN_LUM)}, nw);
    c += l * vec3(1.0, 0.98, 0.9) * w0.w;
  }
  // path gravel / stony soil under and beside the flagstones
  if (w1.x > 0.002) {
    vec3 gv = nearContrast(col2(tGravelC, uvw, uTiles1.y, mixK), ${f(GRAVEL_MEAN_LUM)}, nw);
    gv = mix(gv, uStoneTint * (0.5 + 1.0 * lum(gv)), 0.3);
    c += gv * w1.x;
  }
  // cliff rock: triplanar in world space
  if (w1.y > 0.002) {
    vec3 an = abs(normalize(vWNrm));
    vec3 bw = pow(an, vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
    vec3 rx = texture2D(tRockC, vWPos.zy * uTiles1.z).rgb;
    vec3 ry = texture2D(tRockC, vWPos.xz * uTiles1.z).rgb;
    vec3 rz = texture2D(tRockC, vWPos.xy * uTiles1.z).rgb;
    vec3 r = rx * bw.x + ry * bw.y + rz * bw.z;
    r = mix(r, vec3(lum(r)) * vec3(0.92, 0.9, 0.86), 0.45) * (0.8 + 0.4 * k);
    c += r * w1.y;
  }
  // round 43: the near-field detail — the 0.7 m litter tile's luminance where the detail normal
  // dips (in the canopy shade the albedo term is what the eye gets), bank ridges / pebbles, then
  // the procedural leaves and twigs on top
  float soft = clamp(w0.y + w0.w + w0.z * 0.5 + w0.x * 0.35, 0.0, 1.0);
  if (dw > 0.001 && soft > 0.002) {
    float lp = lum(texture2D(tLitterC, detailUv(uvw)).rgb);
    c *= mix(1.0, clamp(lp / ${f(LITTER_MEAN_LUM)}, 0.55, 1.6), ${f(DETAIL_ALBEDO_K)} * dw * soft);
  }
  vec3 nn = normalize(vWNrm);
  {
    float steep = 1.0 - nn.y;
    float bankW = w0.y * smoothstep(0.25, 0.45, steep) * groundBankW();
    if (bankW > 0.002) bankDetail(uvw, nn, bankW, c, nxyUnused);
  }
  float litCov = 0.0;
  if (dw > 0.001) {
    float vergeW = w1.x * dw;
    if (vergeW > 0.002) litCov = vergeDetail(uvw, slopeFrame(nn), vergeW, c, nxyUnused);
    float dens = litterDensity(w0) * dw;
    if (dens > 0.002) litCov = max(litCov, litterDetail(uvw, dens, slopeFrame(nn), c, nxyUnused));
  }
  // macro variation + damp darkening (the dry litter on top takes less of the damp)
  c *= mix(0.86, 1.14, k);
  c = mix(c, c * uSoilDark * 2.2, vW1.z * 0.55 * (1.0 - 0.6 * litCov));
  // round 43: the wet band — dish floors, depression bottoms, the giants' drip ring (aW2.x),
  // broken into patches by a 30 cm noise; dark and a touch cool
  {
    float wetF = smoothstep(0.25, 0.7, vW2.x * (0.7 + 0.6 * tVNoise(uvw * 3.1 + vec2(5.0, -2.0))));
    c = mix(c, c * uWetTint, wetF * (1.0 - 0.5 * litCov));
  }
  diffuseColor.rgb *= c;
}
`;

// Replaces <normal_fragment_maps>: blends the layer normal maps (tangent space, world-xz frame).
const NORMAL_FRAG = /* glsl */ `
{
  vec2 uvw = vWPos.xz;
  float mixK = smoothstep(0.25, 0.75, vW1.w);
  float nw = groundNearW();
  float dw = groundDetailW();
  vec3 mapN = vec3(0.0, 0.0, 0.0);
  float tot = 0.0;
  if (vW0.x > 0.002) { mapN += nrm2(tGrassN, uvw, uTiles0.x, mixK) * vW0.x; tot += vW0.x; }
  if (vW0.y > 0.002) { mapN += nrmNear(tSoilN, uvw, uTiles0.y, ${f(LAYER_SETS.soil.tile)}, mixK, nw) * vW0.y; tot += vW0.y; }
  if (vW0.z > 0.002) { mapN += nrm2(tMossN, uvw, uTiles0.z, mixK) * vW0.z; tot += vW0.z; }
  if (vW0.w > 0.002) { mapN += nrmNear(tLitterN, uvw, uTiles1.x, ${f(LAYER_SETS['leaf-litter'].tile)}, mixK, nw) * vW0.w; tot += vW0.w; }
  if (vW1.x > 0.002) { mapN += nrm2(tGravelN, uvw, uTiles1.y, mixK) * vW1.x; tot += vW1.x; }
  if (tot > 0.0) mapN /= tot; else mapN = vec3(0.0, 0.0, 1.0);
  // round 43: the layer normals read NEAR_NORMAL_K × normalScale at the feet
  mapN.xy *= normalScale * mix(1.0, ${f(NEAR_NORMAL_K)}, nw);
  // the near-field detail normals, in the same world-xz tangent frame
  {
    vec2 nxy = vec2(0.0);
    vec3 cUnused = vec3(1.0);
    float soft = clamp(vW0.y + vW0.w + vW0.z * 0.5 + vW0.x * 0.35, 0.0, 1.0);
    if (dw > 0.001 && soft > 0.002) {
      vec3 detN = texture2D(tLitterN, detailUv(uvw)).xyz * 2.0 - 1.0;
      // the detail uv is rotated 90° (x' = y, y' = −x): rotate the tangent-space tilt back
      nxy += vec2(-detN.y, detN.x) * (${f(DETAIL_NORMAL_K)} * dw * soft);
    }
    if (vW0.z > 0.002 && dw > 0.001) {
      vec2 cxy = vec2(0.0);
      cushionLayer(uvw, 0.09, 3.7, 0.4, cxy);
      cushionLayer(uvw, 0.045, 11.9, 0.15, cxy);
      nxy += cxy * vW0.z * dw;
    }
    vec3 nn = normalize(vWNrm);
    {
      float steep = 1.0 - nn.y;
      float bankW = vW0.y * smoothstep(0.25, 0.45, steep) * groundBankW();
      if (bankW > 0.002) bankDetail(uvw, nn, bankW, cUnused, nxy);
    }
    if (dw > 0.001) {
      float vergeW = vW1.x * dw;
      if (vergeW > 0.002) vergeDetail(uvw, slopeFrame(nn), vergeW, cUnused, nxy);
      float dens = litterDensity(vW0) * dw;
      if (dens > 0.002) litterDetail(uvw, dens, slopeFrame(nn), cUnused, nxy);
    }
    mapN.xy += nxy;
  }
  vec3 nFlat = normalize(tbn * normalize(mapN));
  if (vW1.y > 0.002) {
    // triplanar rock normal: perturb along each projection with its own tangent frame
    vec3 an = abs(normalize(vWNrm));
    vec3 bw = pow(an, vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
    vec3 nx = texture2D(tRockN, vWPos.zy * uTiles1.z).xyz * 2.0 - 1.0;
    vec3 ny = texture2D(tRockN, vWPos.xz * uTiles1.z).xyz * 2.0 - 1.0;
    vec3 nz = texture2D(tRockN, vWPos.xy * uTiles1.z).xyz * 2.0 - 1.0;
    nx.xy *= normalScale * 1.3; ny.xy *= normalScale * 1.3; nz.xy *= normalScale * 1.3;
    mat3 tx = getTangentFrame(-vViewPosition, normal, vWPos.zy);
    mat3 ty = getTangentFrame(-vViewPosition, normal, vWPos.xz);
    mat3 tz = getTangentFrame(-vViewPosition, normal, vWPos.xy);
    vec3 nRock = normalize(tx * normalize(nx) * bw.x + ty * normalize(ny) * bw.y + tz * normalize(nz) * bw.z);
    normal = normalize(mix(nFlat, nRock, vW1.y));
  } else {
    normal = nFlat;
  }
}
`;

const ROUGH_FRAG = /* glsl */ `
float roughnessFactor = roughness;
{
  // per-layer roughness: moss/grass matte, damp soil slightly glossier, rock/gravel in between
  float r = vW0.x * 0.95 + vW0.y * 0.9 + vW0.z * 0.93 + vW0.w * 0.86 + vW1.x * 0.82 + vW1.y * 0.78;
  r = mix(r, 0.62, vW1.z * 0.6);
  // round 43: the wet band is the one glossy thing on the forest floor
  float wetF = smoothstep(0.3, 0.75, vW2.x * (0.7 + 0.6 * tVNoise(vWPos.xz * 3.1 + vec2(5.0, -2.0))));
  r = mix(r, ${f(WET_ROUGHNESS)}, wetF);
  roughnessFactor = clamp(r, 0.4, 1.0);
}
`;

export interface TerrainMaterialInfo {
  material: MeshStandardMaterial;
  layers: string[];
  textured: boolean;
  detailNormal: boolean;
  sets: string[];
}

export async function createTerrainMaterial(textures: TextureLibrary, config: WorldConfig, anisotropy = 8): Promise<TerrainMaterialInfo> {
  const load = (set: string, kind: 'color' | 'normal') => textures.load(set, kind, { anisotropy });
  const names = TERRAIN_LAYERS.map((l) => LAYER_SETS[l].set);
  const [gC, gN, sC, sN, mC, mN, lC, lN, pC, pN, rC, rN] = await Promise.all(
    names.flatMap((s) => [load(s, 'color'), load(s, 'normal')]),
  );
  const texs: Record<string, Texture> = { tGrassC: gC, tGrassN: gN, tSoilC: sC, tSoilN: sN, tMossC: mC, tMossN: mN, tLitterC: lC, tLitterN: lN, tGravelC: pC, tGravelN: pN, tRockC: rC, tRockN: rN };
  const missing = textures.missing();
  const textured = names.every((s) => !missing.includes(s));

  const material = new MeshStandardMaterial({
    map: gC,
    normalMap: gN,
    roughness: 0.92,
    metalness: 0,
    normalScale: new Vector2(0.75, 0.75),
  });
  material.name = 'terrain-layered';
  const P = config.palette;
  const tiles0 = new Vector3(1 / LAYER_SETS.grass.tile, 1 / LAYER_SETS.soil.tile, 1 / LAYER_SETS.moss.tile);
  const tiles1 = new Vector3(1 / LAYER_SETS['leaf-litter'].tile, 1 / LAYER_SETS['path-gravel'].tile, 1 / LAYER_SETS['cliff-rock'].tile);

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    for (const [k, v] of Object.entries(texs)) shader.uniforms[k] = { value: v };
    shader.uniforms.uTiles0 = { value: tiles0 };
    shader.uniforms.uTiles1 = { value: tiles1 };
    shader.uniforms.uGrassDeep = { value: new Color(P.grassDeep) };
    shader.uniforms.uGrassLight = { value: new Color(P.grassLight) };
    shader.uniforms.uMossDeep = { value: new Color(P.mossDeep) };
    shader.uniforms.uMossBright = { value: new Color(P.mossBright) };
    shader.uniforms.uSoilTint = { value: new Color(P.soil) };
    shader.uniforms.uSoilDark = { value: new Color(P.soilDark) };
    shader.uniforms.uStoneTint = { value: new Color(P.flagstoneDark) };
    shader.uniforms.uWetTint = { value: WET_TINT };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERT_RELIEF}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += tReliefDh;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', MAP_FRAG)
      .replace('#include <normal_fragment_maps>', NORMAL_FRAG)
      .replace('#include <roughnessmap_fragment>', ROUGH_FRAG);
  };
  material.customProgramCacheKey = () => 'terrain-layered-v2-near-ground';

  return { material, layers: [...TERRAIN_LAYERS], textured, detailNormal: true, sets: names };
}
