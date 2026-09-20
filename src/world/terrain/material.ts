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
 *
 * Round 44 (ground-1, survey-1 #11) — the steep faces (aW2.w, chunks.ts: soil / rock / moss over
 * 0.2 of slope): exposed root ridges 0.45 m apart on the soil faces and stepped rock plates on the
 * cliff faces — normal + albedo, and their height displaced along the normal on the fine lattice
 * within the same `RELIEF_MAX_M` cap, faded over `FACE_FADE`; the moss share of a face in 14 cm
 * cushions with soil creases. The damp dark band at a face's foot is aW2.x (chunks.ts `foot`).
 */
import { ClampToEdgeWrapping, Color, DataTexture, LinearFilter, MeshStandardMaterial, RGFormat, Texture, UnsignedByteType, Vector2, Vector3, Vector4, type WebGLProgramParametersWithUniforms } from 'three';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';
import { LAYOUT } from '../layout';
import { ARCH_TUNNEL_FLOOR } from './heightfield';
import { hash2 } from '../util/prng';
import { clamp, smoothstep } from '../util/noise';

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
/**
 * Round 44 (survey-1 #11) — steep-face relief (chunks.ts aW2.w: soil / rock / moss on slopes over
 * 0.2, off the paving and the turf): exposed root ridges 0.45 m apart wandering down the soil
 * faces and stepped rock plates on the cliff faces, as normal + albedo in the fragment and ≤
 * `RELIEF_MAX_M` of vertical GPU displacement on the fine lattice. Faded over `FACE_FADE` m from
 * the camera: the survey frames read the faces at 3–8 m; the fixed cameras' nearest steep soil /
 * rock face (B / E's house-lawn bank) is 12 m off. The sampler `height()` and the CPU mesh are
 * untouched (the probe is byte-identical).
 */
const FACE_FADE: [number, number] = [5.0, 11.0];
const FACE_NORMAL_K = 4.0;
const FACE_ROOT_H = 0.014;
const FACE_PLATE_H = 0.014;
/** wet band: albedo multiplier (dark, a touch cool) and roughness */
const WET_TINT = new Color(0.45, 0.48, 0.56);
/**
 * Round 49 (structures-32): the ground under the log arch's passage — packed earth and bark
 * litter in a tunnel's shade, a warm dark multiplier on whatever layer is there (the gravel
 * verge, the joint soil, the moss at the wall feet). Linear.
 */
const TUNNEL_FLOOR_TINT = new Color(0.36, 0.3, 0.235);
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
  faceFadeM: FACE_FADE,
  faceReliefM: Math.max(FACE_ROOT_H, FACE_PLATE_H),
  wetRoughness: WET_ROUGHNESS,
  proceduralLitter: true,
  mossCushions: true,
  vergeStones: true,
};

const f = (v: number) => v.toFixed(4);

/**
 * Round 46 (survey-2 #06, checks 09 / 10: the hollow floor, the plain beyond the log arch and the
 * ground under the white-barks east of the north path read as a "flat pale-olive plane" — mown
 * lawn — under sparse tufts) — the north forest floor's ALBEDO PATCH. A small world-space mask
 * (`FOREST_FLOOR_BOX`, `FOREST_FLOOR_RES` texels, R = leaf-litter drifts, G = dark humus), built
 * once on the CPU from `LAYOUT.pathSpine` and a seeded value noise, re-weights the six-layer
 * splat in the fragment: on the forest floor the grass weight hands over to the litter layer in
 * drifts of a few metres and to the soil layer, darkened, in damp humus patches between them, so
 * the ground under the white-barks reads as forest floor, not lawn. The paving, its gravel verge
 * (w1.x) and the rock (w1.y) take none of it, nor does the ground closer than FF_PATH_CLEAR to the
 * spine; the vertex weights and the heightfield are untouched (the probe is byte-identical).
 *
 * The zone follows vegetation/field.ts `northFloor` (the systems do not import each other's
 * internals), drawn wider: everything north of the arch's south face (FF_NORTH_Z) and, north of the
 * hollow's mouth (FF_OFF_Z), the ground FF_OFF_PATH m or more off the path — the survey's hollow
 * floor box (x −12…−2, z −20…−45) and the white-barks' floor east of the path (x 8…18, z −30…−45)
 * lie inside it (the first pass's 7–13 m / −26…−34 m ramps left them a third covered and the ground
 * read unchanged in the w19 / w21 / w18 poses). The white-barks themselves are seeded by the trees
 * system and not published, so the patch covers the floor they stand in rather than their exact feet.
 */
/**
 * Round 48 (vegetation-26): the mask runs FF_FAR_ROWS texels further north than round 46's box
 * (z −90 … 10; ClampToEdge repeated its last row under the far forest). The box's z0 and depth
 * grow by whole texels of the round-46 lattice, so every texel south of −90 samples the exact
 * point it did and the six fixed frames' ground is byte-identical; the texture is 192 × 212.
 */
const FF_R46_BOX: readonly [number, number, number, number] = [-48, -90, 96, 100];
const FOREST_FLOOR_RES = 192;
const FF_FAR_ROWS = 20;
const FF_TEXEL_Z = FF_R46_BOX[3] / FOREST_FLOOR_RES;
const FOREST_FLOOR_RES_Z = FOREST_FLOOR_RES + FF_FAR_ROWS;
const FOREST_FLOOR_BOX: readonly [number, number, number, number] = [FF_R46_BOX[0], FF_R46_BOX[1] - FF_FAR_ROWS * FF_TEXEL_Z, FF_R46_BOX[2], FF_R46_BOX[3] + FF_FAR_ROWS * FF_TEXEL_Z];
const FF_NORTH_Z: readonly [number, number] = [-40, -50];
const FF_OFF_Z: readonly [number, number] = [-20, -27];
const FF_OFF_PATH: readonly [number, number] = [4.5, 8.5];
/** the spine keeps this much (m, beyond pathHalfWidth) of untouched verge, feathered over the second value */
const FF_PATH_CLEAR: readonly [number, number] = [1.0, 3.5];
/** litter drifts: noise period (m), threshold band, and the floor's base litter share under the drifts */
const FF_LITTER_PERIOD = 5.5;
const FF_LITTER_BAND: readonly [number, number] = [0.36, 0.6];
const FF_LITTER_BASE = 0.34;
/** humus patches: noise period (m) and threshold band; the share of the grass they take and their darkening */
const FF_HUMUS_PERIOD = 3.8;
const FF_HUMUS_BAND: readonly [number, number] = [0.42, 0.68];
export const FF_HUMUS_DARKEN = 0.52;
/**
 * Round 48 (vegetation-26; the round-47 reviews read the plain beyond the tunnel as "a flat
 * pale-tan plane") — the far floor, north of the arch's north lip (FF_FAR_Z, 0 → 1; vegetation's
 * field.ts NORTH_ZONE_Z): the litter drifts lie thicker (FF_FAR_LITTER_BASE under them) and the
 * humus patches wider and closer (FF_FAR_HUMUS_BAND), so the ground under the far trees reads as
 * dark forest floor through the haze. The verge the patch keeps clear follows the path that is
 * there — `LAYOUT.northPath` and the `northClearing` disc's rim (FF_FAR_PATH_CLEAR m past the
 * paving) — instead of the spine's phantom heading, and the second clearing's lawn takes less of
 * it: none on the `ledgeTerrace` pad, FF_BANK_KEEP of it on the banks (FF_CLEARING_BOX around the
 * clearing, feathered) — the same shares vegetation's turf grows back there (field.ts
 * `clearingLawn`, BANK_FLOOR_SHARE). Nothing south of FF_FAR_Z[0] changes.
 */
const FF_FAR_Z: readonly [number, number] = [-59, -62];
const FF_FAR_LITTER_BASE = 0.58;
const FF_FAR_HUMUS_BAND: readonly [number, number] = [0.3, 0.58];
const FF_FAR_PATH_CLEAR: readonly [number, number] = [0.5, 2.0];
const FF_CLEARING_BOX: readonly [number, number, number, number] = [-9, -82, 9, -62];
const FF_CLEARING_FEATHER = 2.0;
const FF_BANK_KEEP = 0.35;
const FF_PAD_FEATHER: readonly [number, number] = [0.15, 0.6];

/** the terrain audit's record of the patch */
export const FOREST_FLOOR = { box: FOREST_FLOOR_BOX, res: [FOREST_FLOOR_RES, FOREST_FLOOR_RES_Z], northZ: FF_NORTH_Z, offZ: FF_OFF_Z, offPath: FF_OFF_PATH, litterBase: FF_LITTER_BASE, humusDarken: FF_HUMUS_DARKEN, far: { z: FF_FAR_Z, litterBase: FF_FAR_LITTER_BASE, humusBand: FF_FAR_HUMUS_BAND, pathClear: FF_FAR_PATH_CLEAR, bankKeep: FF_BANK_KEEP } };

/** seeded value noise on a metre lattice (smoothstep-interpolated hash2), 0..1 */
function ffNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let tx = x - ix;
  let tz = z - iz;
  tx = tx * tx * (3 - 2 * tx);
  tz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
/** two-octave fbm of ffNoise at `period` m */
function ffFbm(x: number, z: number, period: number, seed: number): number {
  return 0.68 * ffNoise(x / period, z / period, seed) + 0.32 * ffNoise((x / period) * 2.3 + 11.7, (z / period) * 2.3 - 4.2, seed + 1);
}

/** distance (m) from (x, z) to the north part of the path spine (the points north of the plaza) */
function spineDistance(x: number, z: number): number {
  const pts = LAYOUT.pathSpine.filter((p) => p[2] <= -12);
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, , az] = pts[i];
    const [bx, , bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  // the spine ends at the arch; north of its last point the corridor runs on along its heading
  const [lx, , lz] = pts[pts.length - 1];
  if (z < lz) d = Math.min(d, Math.abs(x - lx - (lz - z) * 0.05));
  return d;
}

/** 0..1 forest-floor zone at (x, z) (vegetation/field.ts `northFloor`) */
export function forestFloorZone(x: number, z: number): number {
  if (z > FF_OFF_Z[0]) return 0;
  const north = 1 - smoothstep(FF_NORTH_Z[1], FF_NORTH_Z[0], z);
  const off = (1 - smoothstep(FF_OFF_Z[1], FF_OFF_Z[0], z)) * smoothstep(FF_OFF_PATH[0], FF_OFF_PATH[1], spineDistance(x, z));
  return Math.max(north, off);
}

/** distance (m) from (x, z) to a layout polyline (segments, round caps) */
function polyDist(pts: readonly (readonly [number, number, number])[], x: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, , az] = pts[i];
    const [bx, , bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return d;
}

/** 0..1 the far floor north of the arch's north lip (round 48, FF_FAR_Z) */
export function forestFloorFar(z: number): number {
  return 1 - smoothstep(FF_FAR_Z[1], FF_FAR_Z[0], z);
}

/** the second clearing's lawn shares at (x, z) (round 48): [terrace pad 0..1, banks 0..1] */
function clearingLawnShares(x: number, z: number): [number, number] {
  const t = LAYOUT.ledgeTerrace;
  const yaw = (t.yawDeg * Math.PI) / 180;
  const dx = x - t.x;
  const dz = z - t.z;
  const u = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const out = Math.max(Math.abs(u) - t.halfLength, Math.abs(v) - t.halfDepth);
  const pad = 1 - smoothstep(FF_PAD_FEATHER[0], FF_PAD_FEATHER[1], out);
  const [bx0, bz0, bx1, bz1] = FF_CLEARING_BOX;
  const inset = Math.min(x - bx0, bx1 - x, z - bz0, bz1 - z);
  const bank = smoothstep(-FF_CLEARING_FEATHER, 0, inset) * (1 - pad);
  return [pad, bank];
}

/** the patch's two shares at (x, z): [litter drift 0..1, humus 0..1] */
export function forestFloorAt(x: number, z: number): [number, number] {
  const zone = forestFloorZone(x, z);
  if (zone <= 0) return [0, 0];
  let clear = smoothstep(LAYOUT.pathHalfWidth + FF_PATH_CLEAR[0], LAYOUT.pathHalfWidth + FF_PATH_CLEAR[1], spineDistance(x, z));
  const far = forestFloorFar(z);
  let lawn = 0;
  if (far > 0) {
    // round 48: the verge follows the north path and the clearing's disc, the lawn takes less
    const nc = LAYOUT.northClearing;
    const paving = Math.min(polyDist(LAYOUT.northPath, x, z) - LAYOUT.northPathHalfWidth, Math.hypot(x - nc.x, z - nc.z) - nc.radius);
    const clearFar = smoothstep(FF_FAR_PATH_CLEAR[0], FF_FAR_PATH_CLEAR[1], paving);
    clear = clear + (clearFar - clear) * far;
    const [pad, bank] = clearingLawnShares(x, z);
    lawn = Math.max(pad, bank * (1 - FF_BANK_KEEP)) * far;
  }
  const k = zone * clear * (1 - lawn);
  if (k <= 0) return [0, 0];
  const drift = smoothstep(FF_LITTER_BAND[0], FF_LITTER_BAND[1], ffFbm(x, z, FF_LITTER_PERIOD, 461));
  const hb0 = FF_HUMUS_BAND[0] + (FF_FAR_HUMUS_BAND[0] - FF_HUMUS_BAND[0]) * far;
  const hb1 = FF_HUMUS_BAND[1] + (FF_FAR_HUMUS_BAND[1] - FF_HUMUS_BAND[1]) * far;
  const humus = smoothstep(hb0, hb1, ffFbm(x + 31, z - 17, FF_HUMUS_PERIOD, 977));
  const base = FF_LITTER_BASE + (FF_FAR_LITTER_BASE - FF_LITTER_BASE) * far;
  const litter = k * (base + (1 - base) * drift);
  // humus lies between the drifts, not under them
  return [litter, k * humus * (1 - 0.7 * drift)];
}

/** the mask texture: R litter, G humus, over FOREST_FLOOR_BOX (x0, z0, width, depth) */
export function buildForestFloorMask(): DataTexture {
  const n = FOREST_FLOOR_RES;
  const nz = FOREST_FLOOR_RES_Z;
  const data = new Uint8Array(n * nz * 2);
  const [x0, , w] = FOREST_FLOOR_BOX;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * w;
      // the round-46 lattice's own arithmetic, so its texels are bit-identical (the box's z0 / d are the same lattice)
      const z = FF_R46_BOX[1] + ((j - FF_FAR_ROWS + 0.5) / FOREST_FLOOR_RES) * FF_R46_BOX[3];
      const [litter, humus] = forestFloorAt(x, z);
      const o = (j * n + i) * 2;
      data[o] = Math.round(clamp(litter, 0, 1) * 255);
      data[o + 1] = Math.round(clamp(humus, 0, 1) * 255);
    }
  }
  const tex = new DataTexture(data, n, nz, RGFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.name = 'terrain-forest-floor-mask';
  tex.needsUpdate = true;
  return tex;
}

const HASH_GLSL = /* glsl */ `
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tVNoise(vec2 p) {
  vec2 i = floor(p); vec2 fr = fract(p); fr = fr * fr * (3.0 - 2.0 * fr);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), fr.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), fr.x), fr.y);
}
`;

// Round 44: the steep-face relief shared by the vertex displacement and the fragment passes.
// Everything is parametrised in the FACE'S OWN SURFACE FRAME, not world xz: on the survey's
// cliff (slope 0.8–0.87, ≈ 80°) a metre of face spans 15 cm of xz, so any xz-space pattern
// degenerates into vertical stripes (the first cut — 1.7/255 of change on the w11 frame). The
// frame `fr` = (dn.x, dn.z, n.y) comes from the smooth normal: `faceUV` gives (across, along) —
// across = the horizontal in-plane axis, along = arc length down the fall line (dot(xz, dn)·cosθ
// − y·sinθ) — and `faceAxes` the matching world tangents, so a height field over (across, along)
// tilts the normal in world space the same way on a 20° bank and an 80° cliff.
// Roots: ridges 0.45 m apart across the fall line, wandering along it, present in patches
// (crown weight 0..1, `pres` the patch weight). Plates: a two-octave 0.6 m noise quantized to
// three ledges, the step between softened over half a level (`stepW` = 1 on the step, `id` = the
// ledge). `faceH` is the relief height (m, |h| ≤ FACE_*_H) — the vertex shader displaces by it,
// the fragment differentiates it for the sharp normal.
const FACE_GLSL = /* glsl */ `
vec2 faceUV(vec3 wp, vec3 fr) {
  vec2 dn = fr.xy;
  vec2 ac = vec2(-dn.y, dn.x);
  float s = sqrt(max(0.0, 1.0 - fr.z * fr.z));
  return vec2(dot(wp.xz, ac), dot(wp.xz, dn) * fr.z - wp.y * s);
}
void faceAxes(vec3 fr, out vec3 across, out vec3 along) {
  float s = sqrt(max(0.0, 1.0 - fr.z * fr.z));
  across = vec3(-fr.y, 0.0, fr.x);
  along = vec3(fr.x * fr.z, -s, fr.y * fr.z);
}
float faceRoots(vec2 q, out float pres) {
  float wob = (tVNoise(vec2(q.y * 1.4, q.x * 0.7) + vec2(13.0, 29.0)) - 0.5) * 0.9;
  pres = smoothstep(0.38, 0.62, tVNoise(q * 0.7 + vec2(-5.0, 17.0)));
  float base = 0.5 + 0.5 * cos((q.x + wob) * 2.2 * 6.2832);
  return base * base * pres;
}
float facePlates(vec2 q, out float id, out float stepW) {
  float pn = tVNoise(q * 1.6 + vec2(7.0, -3.0)) * 0.7 + tVNoise(q * 4.3 + vec2(-11.0, 5.0)) * 0.3;
  float lv = pn * 3.0;
  id = floor(lv);
  float fr = fract(lv);
  stepW = 1.0 - smoothstep(0.0, 0.25, abs(fr - 0.5));
  return (id + smoothstep(0.3, 0.7, fr)) / 3.0 - 0.5;
}
float faceH(vec2 q, float rock) {
  float pres; float id; float sw;
  float r = faceRoots(q, pres);
  float pl = facePlates(q, id, sw);
  return mix(${f(FACE_ROOT_H)} * (r - 0.3), ${f(FACE_PLATE_H)} * pl, rock);
}
// world-space normal tilt of the relief at q (−∇h in the surface frame, K-scaled)
vec3 faceTilt(vec2 q, vec3 fr, float rock, float e, float k) {
  float hx = faceH(q + vec2(e, 0.0), rock) - faceH(q - vec2(e, 0.0), rock);
  float hy = faceH(q + vec2(0.0, e), rock) - faceH(q - vec2(0.0, e), rock);
  vec3 across; vec3 along;
  faceAxes(fr, across, along);
  return -(hx * across + hy * along) / (2.0 * e) * k;
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
uniform sampler2D tForestFloor; uniform vec4 uForestFloorBox;
// round 49 (structures-32): the log arch's passage floor — origin / walk direction (plan), box (aS, aN, eHalf, feather), tint
uniform vec2 uTunnelO; uniform vec2 uTunnelW; uniform vec4 uTunnelBox; uniform vec3 uTunnelTint; uniform vec4 uTunnelP01; uniform vec4 uTunnelP23;
float tunnelSegDist(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); return length(p - a - ab * t); }
varying vec4 vW0; varying vec4 vW1; varying vec4 vW2; varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vFaceFr;
${HASH_GLSL}
${FACE_GLSL}

// round 46: the north forest floor's albedo patch (FOREST_FLOOR_*, the CPU mask tForestFloor: R litter
// drifts, G humus). Re-weights the splat: the grass hands over to the litter layer under the drifts
// and, where the humus lies, to the soil layer (the moss keeps half its ground); nothing on the
// gravel verge or the rock. Returns the humus share for the albedo darkening.
float forestFloor(vec2 uvw, inout vec4 w0, vec4 w1) {
  vec2 fuv = (uvw - uForestFloorBox.xy) / uForestFloorBox.zw;
  if (fuv.x <= 0.0 || fuv.y <= 0.0 || fuv.x >= 1.0 || fuv.y >= 1.0) return 0.0;
  vec2 ff = texture2D(tForestFloor, fuv).rg;
  float open = clamp(1.0 - w1.x - w1.y, 0.0, 1.0);
  float lit = ff.r * open;
  float hum = ff.g * open;
  if (lit + hum <= 0.002) return 0.0;
  float g = w0.x;
  float toLitter = g * lit;
  float left = g - toLitter;
  float mossToSoil = w0.z * 0.5 * hum;
  w0.x = left * (1.0 - hum);
  w0.z -= mossToSoil;
  w0.w += toLitter;
  w0.y += left * hum + mossToSoil;
  return hum;
}

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
  // grey, warm grey, a pale one (the flagstones' chips) and a rusty one; the far side of the dome
  // falls into shade
  vec3 tone = h3 < 0.4 ? vec3(0.36, 0.34, 0.31) : h3 < 0.65 ? vec3(0.38, 0.33, 0.27) : h3 < 0.87 ? vec3(0.5, 0.48, 0.44) : vec3(0.33, 0.24, 0.17);
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
// round 44: the steep-face relief (aW2.w — soil / rock / moss over 0.2 of slope, off the paving
// and the turf), the fragment half of the vertex displacement above: the finite-difference normal
// of the same faceH at FACE_NORMAL_K (the 0.2 m lattice can only hint at 0.45 m ridges), and the
// albedo — root crowns paler and warmer (bark), the trough beside each darker (the root's shade),
// the rock plates' steps dark (the joint between plates) with each ledge its own shade. Then the
// moss share of the face, in cushions (14 cm domes, creases showing the soil) all the way out to
// FACE_FADE — the survey's flat moss pads on the lip of the earth face. w = face × fade.
// The hard relief's normal tilt comes back as a WORLD-space vector (tilt, applied after the
// layer / triplanar blend): the xz tangent frame the layer normals use is degenerate on a cliff.
float groundFaceW() { return 1.0 - smoothstep(${f(FACE_FADE[0])}, ${f(FACE_FADE[1])}, length(vViewPosition)); }
void faceDetail(vec3 wp, vec3 fr, float rock, float moss, float w, float steep, inout vec3 c, inout vec2 nxy, inout vec3 tilt) {
  // the moss share of the face is gated from 0.1 of slope (chunks.ts) — the roots / plates only
  // from 0.2, so the lip of a mossy bank takes cushions and no ridges
  float hard = w * (1.0 - moss) * smoothstep(0.15, 0.3, steep);
  vec2 q = faceUV(wp, fr);
  if (hard > 0.002) {
    tilt += faceTilt(q, fr, rock, 0.012, ${f(FACE_NORMAL_K)} * hard);
    float pres; float id; float sw;
    float r = faceRoots(q, pres);
    facePlates(q, id, sw);
    // (both faces sit in the giants' shade at luminance ≈ 0.17, where the first cut's ± 10 %
    // ledges and −22 % troughs moved the survey frames by 1.7/255 — invisible; the albedo is the
    // lever there, so the joints go to −60 %, the ledges swing ± 20 %, the crowns + 45 %)
    float crown = smoothstep(0.35, 0.9, r);
    float trough = (1.0 - smoothstep(0.0, 0.3, r)) * pres;
    vec3 cRoot = c * mix(1.0, 1.45, crown) * vec3(1.0 + 0.14 * crown, 1.0, 1.0 - 0.2 * crown) * (1.0 - 0.35 * trough);
    float ledge = 0.8 + 0.4 * tHash(vec2(id, 3.7));
    vec3 cPlate = c * ledge * (1.0 - 0.6 * sw);
    c = mix(c, mix(cRoot, cPlate, rock), hard);
  }
  float soft = w * moss;
  if (soft > 0.002) {
    // (the cushions sit on the lip — gentle ground — so the xz frame serves them)
    vec2 cxy = vec2(0.0);
    float dome = cushionLayer(wp.xz, 0.14, 21.3, 0.55, cxy);
    nxy += cxy * soft;
    float crease = 1.0 - smoothstep(0.0, 0.3, dome);
    c = mix(c, mix(c * 0.55, c * 1.15, smoothstep(0.2, 0.9, dome)), soft * (1.0 - crease));
    c = mix(c, c * vec3(0.55, 0.5, 0.42), soft * crease * 0.7);
  }
}
// the path verge (the gravel layer beside the flagstones): the stony soil's small stones, 0.6–1.8
// cm in a 7 cm grid plus 1.8–3.5 cm ones in a 16 cm grid, on top of the gravel map's contrast
// lift. w = gravel weight × detail fade.
float vergeDetail(vec2 p, vec3 sl, float w, inout vec3 c, inout vec2 nxy) {
  float cov = pebbleLayer(p, 0.07, 6.1, 0.55, 0.006, 0.018, sl, w, c, nxy);
  cov = max(cov, pebbleLayer(p + vec2(0.021, 0.037), 0.16, 8.9, 0.45, 0.018, 0.035, sl, w, c, nxy));
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
varying vec4 vW0; varying vec4 vW1; varying vec4 vW2; varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vFaceFr;
${HASH_GLSL}
${FACE_GLSL}
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
// Round 44: then the steep-face relief (aW2.w) — root ridges / rock plates displaced along the
// smooth normal, sharing RELIEF_MAX_M with the clods (|clods| + |face| ≤ the cap) and faded over
// FACE_FADE; its surface frame (downslope direction and n.y of the smooth normal, before either
// relief tilts it) goes to the fragment as vFaceFr so both passes differentiate the same ridges.
const VERT_RELIEF = /* glsl */ `
float tReliefDh = 0.0;
vec3 tFaceDisp = vec3(0.0);
{
  vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 on0 = objectNormal;
  vec3 wn0 = normalize(mat3(modelMatrix) * on0);
  vec2 dn0 = length(wn0.xz) > 1e-4 ? normalize(wn0.xz) : vec2(1.0, 0.0);
  vFaceFr = vec3(dn0, clamp(wn0.y, 0.0, 1.0));
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
  // the moss share of the face takes cushions in the fragment instead (14 cm — under the lattice)
  float faceFade = (1.0 - smoothstep(${f(FACE_FADE[0])}, ${f(FACE_FADE[1])}, dcam)) * clamp(aW2.w, 0.0, 1.0) * (1.0 - clamp(aW0.z, 0.0, 1.0)) * edge;
  if (faceFade > 0.001) {
    float e = 0.05;
    float rock = clamp(aW1.y, 0.0, 1.0);
    vec2 q = faceUV(wp0, vFaceFr);
    float h0 = faceH(q, rock);
    float room = ${f(RELIEF_MAX_M)} - abs(tReliefDh);
    tFaceDisp = on0 * clamp(h0 * faceFade, -room, room);
    // (object space is world space for the terrain chunks: identity model rotation)
    objectNormal = normalize(objectNormal + faceTilt(q, vFaceFr, rock, e, faceFade * ${f(FACE_NORMAL_K)}));
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
  // round 46: the north forest floor's patch re-weights the splat (litter drifts, humus soil)
  float ffHum = forestFloor(uvw, w0, w1);
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
    float faceW = vW2.w * groundFaceW();
    if (faceW > 0.002) { vec3 tiltUnused = vec3(0.0); faceDetail(vWPos, vFaceFr, clamp(w1.y, 0.0, 1.0), clamp(w0.z, 0.0, 1.0), faceW, steep, c, nxyUnused, tiltUnused); }
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
  // round 46: the humus patches lie dark and damp under the litter drifts (the leaves on top keep their tone)
  if (ffHum > 0.002) c = mix(c, c * uSoilDark * 1.9, ffHum * ${f(FF_HUMUS_DARKEN)} * (1.0 - 0.6 * litCov));
  // round 43: the wet band — dish floors, depression bottoms, the giants' drip ring (aW2.x),
  // broken into patches by a 30 cm noise; dark and a touch cool
  {
    float wetF = smoothstep(0.25, 0.7, vW2.x * (0.7 + 0.6 * tVNoise(uvw * 3.1 + vec2(5.0, -2.0))));
    c = mix(c, c * uWetTint, wetF * (1.0 - 0.5 * litCov));
  }
  // round 49 (structures-32): PACKED EARTH under the log arch's passage — the tunnel floor is
  // trodden, bark-littered ground that no sky reaches (the demo's floor there reads l 0.15
  // against the paving's 0.45): a warm dark multiplier over the plan box of the tube
  // (heightfield.ts ARCH_TUNNEL_FLOOR), feathered at the mouths and under the walls, broken by
  // a metre-scale noise so it is a stain and not a rectangle. The slabs themselves are the
  // hardscape's; logArch.ts lays a multiply decal over them to the same end.
  {
    vec2 td = vWPos.xz - uTunnelO;
    float ta = dot(td, uTunnelW);
    // across: the distance to the walk polyline the tube's centre follows (it bends west past the spine's end)
    float te = min(tunnelSegDist(vWPos.xz, uTunnelP01.xy, uTunnelP01.zw), min(tunnelSegDist(vWPos.xz, uTunnelP01.zw, uTunnelP23.xy), tunnelSegDist(vWPos.xz, uTunnelP23.xy, uTunnelP23.zw)));
    float tf = uTunnelBox.w;
    float inA = smoothstep(uTunnelBox.x - tf, uTunnelBox.x + 0.4 * tf, ta) * (1.0 - smoothstep(uTunnelBox.y - 0.4 * tf, uTunnelBox.y + tf, ta));
    float inE = 1.0 - smoothstep(uTunnelBox.z - tf, uTunnelBox.z + 0.4, abs(te));
    float tk = inA * inE;
    if (tk > 0.001) c = mix(c, c * uTunnelTint * (0.8 + 0.4 * tVNoise(uvw * 1.7 + vec2(3.0, 7.0))), tk);
  }
  diffuseColor.rgb *= c;
}
`;

// Replaces <normal_fragment_maps>: blends the layer normal maps (tangent space, world-xz frame).
const NORMAL_FRAG = /* glsl */ `
{
  vec2 uvw = vWPos.xz;
  float mixK = smoothstep(0.25, 0.75, vW1.w);
  // round 46: the forest floor's patch re-weights the layer normals like the albedo
  vec4 w0 = vW0;
  forestFloor(uvw, w0, vW1);
  float nw = groundNearW();
  float dw = groundDetailW();
  vec3 mapN = vec3(0.0, 0.0, 0.0);
  vec3 faceTiltW = vec3(0.0);
  float tot = 0.0;
  if (w0.x > 0.002) { mapN += nrm2(tGrassN, uvw, uTiles0.x, mixK) * w0.x; tot += w0.x; }
  if (w0.y > 0.002) { mapN += nrmNear(tSoilN, uvw, uTiles0.y, ${f(LAYER_SETS.soil.tile)}, mixK, nw) * w0.y; tot += w0.y; }
  if (w0.z > 0.002) { mapN += nrm2(tMossN, uvw, uTiles0.z, mixK) * w0.z; tot += w0.z; }
  if (w0.w > 0.002) { mapN += nrmNear(tLitterN, uvw, uTiles1.x, ${f(LAYER_SETS['leaf-litter'].tile)}, mixK, nw) * w0.w; tot += w0.w; }
  if (vW1.x > 0.002) { mapN += nrm2(tGravelN, uvw, uTiles1.y, mixK) * vW1.x; tot += vW1.x; }
  if (tot > 0.0) mapN /= tot; else mapN = vec3(0.0, 0.0, 1.0);
  // round 43: the layer normals read NEAR_NORMAL_K × normalScale at the feet
  mapN.xy *= normalScale * mix(1.0, ${f(NEAR_NORMAL_K)}, nw);
  // the near-field detail normals, in the same world-xz tangent frame
  {
    vec2 nxy = vec2(0.0);
    vec3 cUnused = vec3(1.0);
    float soft = clamp(w0.y + w0.w + w0.z * 0.5 + w0.x * 0.35, 0.0, 1.0);
    if (dw > 0.001 && soft > 0.002) {
      vec3 detN = texture2D(tLitterN, detailUv(uvw)).xyz * 2.0 - 1.0;
      // the detail uv is rotated 90° (x' = y, y' = −x): rotate the tangent-space tilt back
      nxy += vec2(-detN.y, detN.x) * (${f(DETAIL_NORMAL_K)} * dw * soft);
    }
    if (w0.z > 0.002 && dw > 0.001) {
      vec2 cxy = vec2(0.0);
      cushionLayer(uvw, 0.09, 3.7, 0.4, cxy);
      cushionLayer(uvw, 0.045, 11.9, 0.15, cxy);
      nxy += cxy * w0.z * dw;
    }
    vec3 nn = normalize(vWNrm);
    {
      float steep = 1.0 - nn.y;
      float bankW = w0.y * smoothstep(0.25, 0.45, steep) * groundBankW();
      if (bankW > 0.002) bankDetail(uvw, nn, bankW, cUnused, nxy);
      float faceW = vW2.w * groundFaceW();
      if (faceW > 0.002) faceDetail(vWPos, vFaceFr, clamp(vW1.y, 0.0, 1.0), clamp(w0.z, 0.0, 1.0), faceW, steep, cUnused, nxy, faceTiltW);
    }
    if (dw > 0.001) {
      float vergeW = vW1.x * dw;
      if (vergeW > 0.002) vergeDetail(uvw, slopeFrame(nn), vergeW, cUnused, nxy);
      float dens = litterDensity(w0) * dw;
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
  // round 44: the steep faces' root / plate relief tilts the blended normal in world space (the
  // layer frame and the triplanar frames both take it the same way; view space here)
  if (dot(faceTiltW, faceTiltW) > 1e-10) normal = normalize(normal + mat3(viewMatrix) * faceTiltW);
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
  // round 46: the north forest floor's albedo patch mask (see FOREST_FLOOR_*)
  const forestFloor = buildForestFloorMask();
  const forestFloorBox = new Vector4(...FOREST_FLOOR_BOX);

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    for (const [k, v] of Object.entries(texs)) shader.uniforms[k] = { value: v };
    shader.uniforms.uTiles0 = { value: tiles0 };
    shader.uniforms.uTiles1 = { value: tiles1 };
    shader.uniforms.tForestFloor = { value: forestFloor };
    shader.uniforms.uForestFloorBox = { value: forestFloorBox };
    shader.uniforms.uGrassDeep = { value: new Color(P.grassDeep) };
    shader.uniforms.uGrassLight = { value: new Color(P.grassLight) };
    shader.uniforms.uMossDeep = { value: new Color(P.mossDeep) };
    shader.uniforms.uMossBright = { value: new Color(P.mossBright) };
    shader.uniforms.uSoilTint = { value: new Color(P.soil) };
    shader.uniforms.uSoilDark = { value: new Color(P.soilDark) };
    shader.uniforms.uStoneTint = { value: new Color(P.flagstoneDark) };
    shader.uniforms.uWetTint = { value: WET_TINT };
    shader.uniforms.uTunnelO = { value: new Vector2(ARCH_TUNNEL_FLOOR.ox, ARCH_TUNNEL_FLOOR.oz) };
    shader.uniforms.uTunnelW = { value: new Vector2(ARCH_TUNNEL_FLOOR.wx, ARCH_TUNNEL_FLOOR.wz) };
    shader.uniforms.uTunnelBox = { value: new Vector4(ARCH_TUNNEL_FLOOR.aS, ARCH_TUNNEL_FLOOR.aN, ARCH_TUNNEL_FLOOR.eHalf, ARCH_TUNNEL_FLOOR.feather) };
    shader.uniforms.uTunnelTint = { value: TUNNEL_FLOOR_TINT };
    shader.uniforms.uTunnelP01 = { value: new Vector4(...ARCH_TUNNEL_FLOOR.pts[0], ...ARCH_TUNNEL_FLOOR.pts[1]) };
    shader.uniforms.uTunnelP23 = { value: new Vector4(...ARCH_TUNNEL_FLOOR.pts[2], ...ARCH_TUNNEL_FLOOR.pts[3]) };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERT_RELIEF}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += tReliefDh; transformed += tFaceDisp;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', MAP_FRAG)
      .replace('#include <normal_fragment_maps>', NORMAL_FRAG)
      .replace('#include <roughnessmap_fragment>', ROUGH_FRAG);
  };
  material.customProgramCacheKey = () => 'terrain-layered-v9-tunnel-floor';

  return { material, layers: [...TERRAIN_LAYERS], textured, detailNormal: true, sets: names };
}
