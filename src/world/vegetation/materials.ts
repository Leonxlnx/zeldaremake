/**
 * Vegetation materials: MeshStandardMaterial + vertex colours + shared wind (WIND_GLSL).
 * Three distinct wind layers are used by this system:
 *   grass  → windGrass  (fast, bends from the root, per-instance phase/stiffness)
 *   plant  → windBranch (slow stem sway by height) + windLeaf (lamina flutter)
 *   bush   → windBranch (stiffer) + stronger windLeaf flutter
 * Litter and moss are static. All foliage is double sided and gets a cheap translucency
 * term (backlight through the lamina) so blades glow when the sun is behind them.
 */
import { Color, DoubleSide, FrontSide, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, RGBADepthPacking, Vector2, Vector4, type Texture, type WebGLProgramParametersWithUniforms } from 'three';
import type { WorldContext } from '../system';
import { WIND_GLSL, type Wind } from '../wind/wind';
import { C_FOOT } from './field';
import { PACK_INSTANCE_ATTRIBUTE, PACK_VERTEX_ATTRIBUTE } from './lodset';

/**
 * `card` (round 39): the turf carpet's alpha-tested clump cards and turf mats (carpet.ts) — the
 * blade tiles' colour pipeline (palette tints, root→tip gradient, shade lift, bank darkening,
 * straw tips) over a card geometry that samples the clump atlas (clump-atlas.ts) for coverage,
 * blade lightness and translucency; wind from `windGrass` like the blades.
 */
export type VegKind = 'grass' | 'plant' | 'bush' | 'litter' | 'moss' | 'card';

/**
 * Variant packing (lodset.ts): a LodInstancedSet mesh carries several variant geometries in one
 * buffer, each vertex tagged with its variant slot, each instance with the slot it shows. The
 * other slots' vertices collapse onto the instance root, so their triangles have zero area and
 * rasterise nothing; a kept vertex goes through exactly the arithmetic it did unpacked. Plant,
 * bush, moss and litter materials all take these attributes (grass has its own tile shader); a
 * geometry without them reads the attributes as 0 and 0, i.e. keeps every vertex.
 */
const PACK_VERTEX_PARS = /* glsl */ `
attribute float ${PACK_VERTEX_ATTRIBUTE};
attribute float ${PACK_INSTANCE_ATTRIBUTE};
`;
const PACK_BEGIN_VERTEX = /* glsl */ `
#include <begin_vertex>
bool vegKeep = abs(${PACK_VERTEX_ATTRIBUTE} - ${PACK_INSTANCE_ATTRIBUTE}) < 0.5;
if (!vegKeep) transformed = vec3(0.0);
`;

const GRASS_VERTEX_PARS = /* glsl */ `
attribute vec4 aData; // phase, stiffness, (tint index + 0.25 + 0.5 × shade lift) / 4, type + dryness
uniform vec3 uTints[4];
uniform vec3 uDryTip;
uniform float uSeedTip;
varying float vBladeT;
varying float vShadeLift;
varying vec3 vBladeFace;
varying vec3 vBladeUp;
`;

const GRASS_COLOR_VERTEX = /* glsl */ `
float bladeT = uv.y;
vBladeT = bladeT;
float vegType = floor(aData.w + 0.001);
float vegDry = fract(aData.w);
float tintSlot = aData.z * 4.0;
int tintIndex = int(clamp(floor(tintSlot), 0.0, 3.0));
// the slot's fraction (0.25..0.75) carries the shade lift: banks lit by fill alone (frame 8's
// right embankment) have no sunlit tuft self-shadowing, so their root→tip gradient is flatter
float shadeLift = clamp((fract(tintSlot) - 0.25) * 2.0, 0.0, 1.0);
vShadeLift = shadeLift;
// a fraction below 0.25 is the round-35 bank darkening (field.ts bankDark: frames 8 / 46's dark
// flank masses), 0..1 — blades outside those zones keep the 0.25..0.75 encoding untouched
float bankDark = clamp((0.25 - fract(tintSlot)) * 4.0, 0.0, 1.0);
vec3 tint = uTints[tintIndex];
// root → tip gradient: deep, slightly cool root buried in the tuft, warm lit tip (the reference's
// shaded grass is a dark green-brown ≈ 0.24 luminance, its lit blades an olive ≈ 0.35)
vec3 rootTone = mix(vec3(0.36, 0.38, 0.40), vec3(0.66, 0.72, 0.64), shadeLift);
vec3 bladeColor = mix(tint * rootTone, tint * vec3(1.0, 1.0, 0.92), pow(bladeT, 0.8));
// sedge blades are a touch cooler/deeper, meadow blades a touch warmer
bladeColor *= vegType > 1.5 ? vec3(0.9, 1.0, 1.02) : vegType > 0.5 ? vec3(1.06, 1.02, 0.9) : vec3(1.0);
// straw-coloured dry tips
bladeColor = mix(bladeColor, uDryTip, vegDry * smoothstep(0.45, 1.0, bladeT));
// the dark masses: deeper and a little less saturated (the frames' masses measure sat 0.22–0.32
// against our lit turf's 0.32–0.39), the tip gradient flattened toward the core
bladeColor = mix(bladeColor, vec3(dot(bladeColor, vec3(0.30, 0.59, 0.11))), 0.3 * bankDark) * (1.0 - 0.5 * bankDark);
vColor = vec4(bladeColor, 1.0);
`;

const GRASS_SHAPE_VERTEX = /* glsl */ `
vec3 transformed = vec3(position);
{
  float t = uv.y;
  float side = uv.x * 2.0 - 1.0;
  float vegType = floor(aData.w + 0.001);
  float v = fract(aData.x * 7.31);
  // width profile per type: turf tapers fast, meadow stays slender, sedge is broad with a blunt tip
  float wTurf = 1.0 - t * 0.88;
  float wMeadow = 1.0 - t * 0.72;
  float wSedge = (1.0 - smoothstep(0.55, 1.0, t)) * (0.8 + 0.2 * sin(t * 3.1416));
  float w = vegType < 0.5 ? wTurf : vegType < 1.5 ? wMeadow : wSedge;
  // forward bend (in the blade's own facing direction), stronger for turf; meadow tips droop
  float bend = (vegType < 0.5 ? 0.5 : vegType < 1.5 ? 0.18 : 0.32) * (0.7 + 0.6 * v);
  transformed.x = position.x * w;
  transformed.z = bend * t * t;
  transformed.y = position.y - (vegType > 0.5 && vegType < 1.5 ? 0.16 * t * t * t : 0.05 * t * t) * bend;
}
`;

// normal: blade facing mixed with terrain up, with a fake fold so the two edges shade differently.
// The two parts go to the fragment separately (GRASS_NORMAL_FRAGMENT_BEGIN, round 39): a blade
// seen from behind flips its facing but keeps its up. Three's double-sided flip negated the whole
// normal — 55 % terrain up included — so half the blades (random yaw) pointed into the ground,
// took neither sun nor sky and stood as black spikes over the turf; under the carpet's lit mats
// and clump cards those spikes were the only thing that still read as single blades.
const GRASS_NORMAL_VERTEX = /* glsl */ `
vec3 transformedNormal;
{
  float side = uv.x * 2.0 - 1.0;
  mat3 im = mat3(instanceMatrix);
  vec3 bladeUp = normalize(im[1]);
  vec3 bladeFace = normalize(im[2]);
  vec3 bladeSide = normalize(im[0]);
  vec3 n = normalize(bladeFace * 0.8 + bladeSide * side * 0.6);
  vBladeFace = normalMatrix * n;
  vBladeUp = normalMatrix * bladeUp;
  transformedNormal = normalMatrix * normalize(mix(n, bladeUp, 0.55));
}
`;

const GRASS_NORMAL_FRAGMENT_PARS = /* glsl */ `
varying vec3 vBladeFace;
varying vec3 vBladeUp;
`;

const GRASS_NORMAL_FRAGMENT_BEGIN = /* glsl */ `
float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
vec3 normal = normalize(mix(normalize(vBladeFace) * faceDirection, normalize(vBladeUp), 0.55));
vec3 nonPerturbedNormal = normal;
`;

const GRASS_PROJECT_VERTEX = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
mvPosition = instanceMatrix * mvPosition;
vec4 vegWorld = modelMatrix * mvPosition;
vegWorld.xyz += windGrass(vegWorld.xyz, uv.y, aData.x, aData.y);
mvPosition = viewMatrix * vegWorld;
gl_Position = projectionMatrix * mvPosition;
`;

/**
 * Card kind (carpet.ts). `aData` keeps the blade tiles' encoding — phase, stiffness, tint slot —
 * with the atlas tile index in the integer part of the last float (the blades keep their type
 * there; a card is always turf) and the dryness in its fraction. `uTileGrid` = (tile w, tile h,
 * columns, top v) of the atlas block the material draws from; `uCardMode` 0 is a standing clump
 * (wind, root→tip gradient along the card's v), 1 a flat turf mat (static, one mid-blade tone).
 */
const CARD_VERTEX_PARS = /* glsl */ `
// clump: phase, stiffness, (tint index + 0.25 + 0.5 × shade lift) / 4, atlas tile + dryness
// mat:   palette position 0..3 (continuous), 1, (0.25 + 0.5 × shade lift) / 4 — the index is
//        unused —, atlas tile + dryness
attribute vec4 aData;
uniform vec3 uTints[4];
uniform vec3 uDryTip;
uniform vec4 uTileGrid;
uniform float uCardMode;
uniform float uUpMix;
varying float vBladeT;
varying float vShadeLift;
varying vec2 vAtlasUv;
varying vec3 vCardFace;
varying vec3 vCardUp;
`;

const CARD_COLOR_VERTEX = /* glsl */ `
// a mat is one mid-blade tone (the turf seen from above is blade sides, not roots or tips); a
// clump runs the blades' root → tip gradient over its height, but from a third of the way up:
// the atlas root mass is a broad area where a blade's root is a sliver, and the frames' tufts
// are dark-hearted, not black-footed (v3 started at 0.3: still darker than the soil in the shade)
float bladeT = uCardMode > 0.5 ? 0.5 : 0.4 + 0.6 * uv.y;
vBladeT = bladeT;
float vegDry = fract(aData.w);
float atlasTile = floor(aData.w + 0.001);
vAtlasUv = vec2((mod(atlasTile, uTileGrid.z) + uv.x) * uTileGrid.x, uTileGrid.w - uTileGrid.y * (floor(atlasTile / uTileGrid.z) + 1.0 - uv.y));
float tintSlot = aData.z * 4.0;
int tintIndex = int(clamp(floor(tintSlot), 0.0, 3.0));
float shadeLift = clamp((fract(tintSlot) - 0.25) * 2.0, 0.0, 1.0);
vShadeLift = shadeLift;
float bankDark = clamp((0.25 - fract(tintSlot)) * 4.0, 0.0, 1.0);
vec3 tint = uTints[tintIndex];
// a mat is a metre wide: the blades' four-entry palette (≈ 1.5 × luminance steps) would tile the
// lawn in blotches wherever the zone drift crosses an entry, so a mat blends between the entries
// at a continuous position (aData.x, carpet.ts matPalettePosition)
if (uCardMode > 0.5) {
  float pos = clamp(aData.x, 0.0, 3.0);
  int lo = int(min(floor(pos), 2.0));
  tint = mix(uTints[lo], uTints[lo + 1], pos - float(lo));
}
vec3 rootTone = mix(vec3(0.36, 0.38, 0.40), vec3(0.66, 0.72, 0.64), shadeLift);
vec3 bladeColor = mix(tint * rootTone, tint * vec3(1.0, 1.0, 0.92), pow(bladeT, 0.8));
bladeColor = mix(bladeColor, uDryTip, vegDry * smoothstep(0.45, 1.0, bladeT));
bladeColor = mix(bladeColor, vec3(dot(bladeColor, vec3(0.30, 0.59, 0.11))), 0.3 * bankDark) * (1.0 - 0.5 * bankDark);
vColor = vec4(bladeColor, 1.0);
#ifdef USE_INSTANCING_COLOR
  vColor.rgb *= instanceColor.rgb;
#endif
`;

// the lighting normal: the card's facing pulled toward the terrain up (uUpMix), the blades'
// blend (0.55). The two parts go to the fragment separately (CARD_NORMAL_FRAGMENT_BEGIN): a plane
// seen from behind flips its facing but keeps its up, so the back planes of a fan sit in
// half-light under the lit front ones — the frames' dark-hearted tufts — where three's whole-normal
// flip would turn them toward the ground and black
const CARD_NORMAL_VERTEX = /* glsl */ `
vec3 transformedNormal;
{
  mat3 im = mat3(instanceMatrix);
  vec3 cardUp = normalize(im[1]);
  vec3 cardFace = normalize(im * normal);
  vCardFace = normalMatrix * cardFace;
  vCardUp = normalMatrix * cardUp;
  transformedNormal = normalMatrix * normalize(mix(cardFace, cardUp, uUpMix));
}
`;

const CARD_NORMAL_FRAGMENT_BEGIN = /* glsl */ `
float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
vec3 normal = normalize(mix(normalize(vCardFace) * faceDirection, normalize(vCardUp), uUpMix));
vec3 nonPerturbedNormal = normal;
`;

const CARD_PROJECT_VERTEX = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
mvPosition = instanceMatrix * mvPosition;
vec4 vegWorld = modelMatrix * mvPosition;
if (uCardMode < 0.5) vegWorld.xyz += windGrass(vegWorld.xyz, uv.y, aData.x, aData.y);
mvPosition = viewMatrix * vegWorld;
gl_Position = projectionMatrix * mvPosition;
`;

const CARD_FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform vec2 uAtlasLum;
uniform float uAlphaBoost;
uniform float uUpMix;
varying vec2 vAtlasUv;
varying vec3 vCardFace;
varying vec3 vCardUp;
`;

/**
 * Replaces <map_fragment>: coverage from the atlas alpha, the blade lightness (uAtlasLum.x +
 * uAtlasLum.y × R) over the vertex colour, the translucency for the lighting block. Coarse mips
 * average the blades' alpha toward the gaps' zero, so a plain alpha test thins a clump with
 * distance; the coverage is lifted per mip level (uAlphaBoost) to hold the near coverage.
 */
const CARD_MAP_FRAGMENT = /* glsl */ `
float vegAtlasT = 1.0;
{
  vec4 atlas = texture2D(uAtlas, vAtlasUv);
  vec2 atlasPx = vAtlasUv * uAtlasSize;
  vec2 ddx = dFdx(atlasPx);
  vec2 ddy = dFdy(atlasPx);
  float atlasLod = 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy)) + 1e-8);
  diffuseColor.a *= atlas.a * (1.0 + uAlphaBoost * clamp(atlasLod, 0.0, 6.0));
  diffuseColor.rgb *= uAtlasLum.x + uAtlasLum.y * atlas.r;
  vegAtlasT = atlas.g;
}
`;

export interface CardMaterialOptions {
  /** the clump atlas (null in node: the shader then reads an unbound sampler, which no capture does) */
  atlas: Texture | null;
  atlasSize: number;
  /** (tile w, tile h, columns, top v) of the block this material draws from */
  grid: readonly [number, number, number, number];
  /** 0 = standing clump card, 1 = flat turf mat */
  mode: 0 | 1;
  /** share of the terrain up in the lighting normal (0 = the card's facing, 1 = ground) */
  upMix: number;
  /** blade lightness = lum[0] + lum[1] × atlas R */
  lum: readonly [number, number];
  /** alpha lift per mip level */
  alphaBoost: number;
  alphaTest?: number;
}

const PLANT_VERTEX_PARS = /* glsl */ `
uniform float uPlantHeight;
uniform float uSwayAmount;
uniform float uFlutterAmount;
uniform float uStiffness;
`;

const PLANT_PROJECT_VERTEX = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 vegWorld = modelMatrix * mvPosition;
{
  float hf = clamp(position.y / uPlantHeight, 0.0, 1.0);
  #ifdef USE_INSTANCING
    vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 rootWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float phase = fract(sin(dot(rootWorld.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 sway = windBranch(rootWorld, hf * uSwayAmount, uStiffness);
  vec3 flutter = windLeaf(vegWorld.xyz, phase + uv.y * 0.31, uFlutterAmount * (0.3 + 0.7 * hf) * uv.y);
  // collapsed pack vertices stay exactly on the root so their triangles keep zero area
  if (vegKeep) vegWorld.xyz += sway * hf + flutter;
}
mvPosition = viewMatrix * vegWorld;
gl_Position = projectionMatrix * mvPosition;
`;

const WORLDPOS_VERTEX = /* glsl */ `
vec4 worldPosition = vegWorld;
`;

/**
 * Grass only: shade-lifted blades (frame 8's right embankment, see grass.ts) sit under the canopy
 * shadow but face the open sky over the plaza, so they receive more skylight than the hemisphere
 * term alone delivers — the reference's shaded bank reads ≈ 0.30 luminance, ours ≈ 0.23 without it.
 */
const GRASS_FRAGMENT_PARS = /* glsl */ `
varying float vShadeLift;
uniform float uShadeFill;
`;
const GRASS_FRAGMENT_FILL = /* glsl */ `
reflectedLight.indirectDiffuse += diffuseColor.rgb * uShadeFill * vShadeLift;
`;

/**
 * Shot D's west verge (world x −5.5…−1.5, z −18…−6) sits under the north-west-near canopy while
 * the reference's verge is sunlit: its foliage measured 0.290 against the reference's 0.338
 * (take 31, foliage-only), and an albedo move lifts shaded foliage only ≈ +0.015 display per
 * ×1.19. The verge gets the skylight-fill path the flagged F-bank blades use (uShadeFill), as a
 * world zone weighted by the sun's shadow term, so dappled sun inside the zone and the lit lawns
 * outside it are unchanged. Measured on the same tree (high quality, D box foliage-only): 0.18 ×
 * albedo lifted it +0.02 display, i.e. ≈ 0.12 per unit of fill under the verge's haze, so 0.34
 * delivers the +0.04 asked for. Camera B sees the same verge in its lower-left (23 % of the
 * (0–0.4, 0.6–0.85) box's ground), which rises by about a quarter of the D gain.
 */
export const SHADE_LIFT_ZONE = { box: [-5.5, -18, -1.5, -6] as readonly [number, number, number, number], feather: 1.0, fill: 0.34 };
/**
 * Round 35: the second lift zone — camera C's bottom-left foreground (field.ts C_FOOT, the slope
 * between Saria's flight and the plaza's north-east lobe). The ground faces away from the sun
 * under the canopy and rendered 0.24–0.35 where frames 46 s (C) and 14 s (B) both have it lit
 * (0.43–0.6). The same skylight-fill path as the D verge, at `scale` × the D fill, weighted by
 * the sun's shadow term like it, so dappled sun on the slope is unchanged. 1.35 × moved C's
 * bottom-left p10 0.246 → 0.281 (frame 0.268) but not its p50 (0.323; frame 0.377) with the
 * cover opened onto the 0.32 ground; with the cover closed again the fill carries the p50.
 */
export const LIFT_ZONE_C_FOOT = { box: C_FOOT, scale: 2.0 };
/**
 * The extra lift zones after the west verge: (box, scale × the verge fill). Round 35 tried a
 * third zone over the bank hedge row right of the main flight (x 5.8–14.5 / z 3.7–7.3, 2.4 ×):
 * its self-shadowed cores render 0.13–0.22 where frames 1 s / 8 s have 0.19–0.30, and the fill
 * did bring them to 0.23–0.30 — but the frame's mass is a flat blur (local sd 0.01–0.05 in 8 px
 * windows at 256 × 144) and the lit core showed every leaf (our local sd 0.03 → 0.05), so F's
 * SSIM fell 0.2955 → 0.2860 (−0.11…−0.22 per cell over the crowns) while the luminance term
 * had only 0.01–0.08 to gain. The dark core scores better than a lit textured one; withdrawn.
 */
export const LIFT_ZONES_EXTRA = [LIFT_ZONE_C_FOOT] as const;

const LIFT_VERTEX_PARS = /* glsl */ `
uniform vec4 uLiftBox;
uniform vec4 uLiftBoxes2[${LIFT_ZONES_EXTRA.length}];
uniform float uLiftScales2[${LIFT_ZONES_EXTRA.length}];
uniform float uLiftFeather;
varying float vZoneLift;
`;
// evaluated at the instance root so a whole plant gets one lift value (no gradient across fronds);
// one smoothstep over the nearest of the boxes, each extra box scaled to its own fill
const LIFT_VERTEX = /* glsl */ `
{
  #ifdef USE_INSTANCING
    vec2 liftRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  #else
    vec2 liftRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  #endif
  vec2 liftOut = max(max(uLiftBox.xy - liftRoot, liftRoot - uLiftBox.zw), vec2(0.0));
  float liftD = length(liftOut);
  float liftScale = 1.0;
  for (int i = 0; i < ${LIFT_ZONES_EXTRA.length}; i++) {
    vec2 liftOutI = max(max(uLiftBoxes2[i].xy - liftRoot, liftRoot - uLiftBoxes2[i].zw), vec2(0.0));
    float liftDI = length(liftOutI);
    if (liftDI < liftD) { liftD = liftDI; liftScale = uLiftScales2[i]; }
  }
  vZoneLift = 1.0 - smoothstep(0.0, uLiftFeather, liftD);
  vZoneLift *= liftScale;
}
`;
const LIFT_FRAGMENT_PARS = /* glsl */ `
uniform float uLiftFill;
varying float vZoneLift;
`;

const FOLIAGE_FRAGMENT_LIGHTS = /* glsl */ `
#include <lights_fragment_end>
{
  // translucency: sun through the lamina when it sits between the camera and the light
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uAmbientBoost;
  //VEG_EXTRA_FILL//
  #if NUM_DIR_LIGHTS > 0
    // the sun's shadow term: directLight.color is the (only) directional light's colour after the
    // shadow lookup, directionalLights[0].color the same light unshadowed; canopy transmission
    // (shadowfilter.ts leak) still counts as shade, dappled sun ramps the lift off
    float sunLit = clamp(dot(directLight.color, vec3(1.0)) / max(dot(directionalLights[0].color, vec3(1.0)), 1e-4), 0.0, 1.0);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * uLiftFill * vZoneLift * (1.0 - smoothstep(0.05, 0.75, sunLit));
    float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
    float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.45 + backlight * 0.55;
    reflectedLight.directDiffuse += diffuseColor.rgb * directLight.color * transmission * uTransmission//VEG_TRANSMISSION//;
  #else
    reflectedLight.indirectDiffuse += diffuseColor.rgb * uLiftFill * vZoneLift;
  #endif
}
`;

/**
 * Waxy broad leaves (concept sheet 01): the upper face takes its own roughness so it carries a
 * soft sheen while the underside keeps the matte base `roughness`. Front faces are the upper
 * side of every lamina built by geometry.ts.
 */
const TOP_ROUGHNESS_PARS = /* glsl */ `
uniform float uTopRoughness;
`;
const TOP_ROUGHNESS_FRAGMENT = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = gl_FrontFacing ? uTopRoughness : roughnessFactor;
`;

export interface VegMaterialOptions {
  roughness?: number;
  /** roughness of the lamina's upper (front) face only; the underside keeps `roughness` */
  topRoughness?: number;
  /** max geometry height used to normalise the sway height factor (plants) */
  plantHeight?: number;
  sway?: number;
  flutter?: number;
  stiffness?: number;
  transmission?: number;
  ambientBoost?: number;
  /** full-shade fill inside SHADE_LIFT_ZONE, × albedo (default SHADE_LIFT_ZONE.fill; 0 opts out) */
  shadeLift?: number;
  singleSided?: boolean;
  name?: string;
  /** required for kind `card` */
  card?: CardMaterialOptions;
}

// Retain the same uniform objects across color and shadow passes; copying their values would
// freeze shadow wind at creation time. Weak keys do not extend the source material's lifetime.
const plantWind = new WeakMap<MeshStandardMaterial, {
  kind: 'plant' | 'bush';
  wind: Wind;
  uniforms: Record<string, { value: unknown }>;
}>();

function injectPlantVertex(vertexShader: string): string {
  if (!vertexShader.includes('#include <project_vertex>')) {
    throw new Error('Vegetation wind shader requires the Three.js project_vertex chunk');
  }
  return `${WIND_GLSL}\n${PLANT_VERTEX_PARS}\n${PACK_VERTEX_PARS}\n${vertexShader}`
    .replace('#include <begin_vertex>', PACK_BEGIN_VERTEX)
    .replace('#include <project_vertex>', PLANT_PROJECT_VERTEX)
    // The distance shader consumes worldPosition; the depth shader only needs gl_Position.
    .replace('#include <worldpos_vertex>', WORLDPOS_VERTEX);
}

/** Matching wind deformation for directional/spot and point-light shadows. Caller owns disposal. */
export function createVegShadowMaterials(source: MeshStandardMaterial): { depth: MeshDepthMaterial; distance: MeshDistanceMaterial } {
  const state = plantWind.get(source);
  if (!state) throw new Error('Vegetation shadows require a plant or bush material from createVegMaterial');
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: source.side });
  const distance = new MeshDistanceMaterial({ side: source.side });
  for (const [pass, mat] of [['depth', depth], ['distance', distance]] as const) {
    mat.name = `${source.name}-${pass}`;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, state.uniforms);
      shader.vertexShader = injectPlantVertex(shader.vertexShader);
    };
    mat.customProgramCacheKey = () => `veg-${state.kind}-${pass}-v2`;
    state.wind.bind(mat);
  }
  return { depth, distance };
}

export function createVegMaterial(ctx: WorldContext, kind: VegKind, opts: VegMaterialOptions = {}): MeshStandardMaterial {
  const P = ctx.config.palette;
  const card = kind === 'card' ? opts.card : undefined;
  if (kind === 'card' && !card) throw new Error('Vegetation card material needs its card options (atlas, grid, mode)');
  const mat = new MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? (kind === 'litter' ? 0.9 : 0.82),
    metalness: 0,
    side: opts.singleSided ? FrontSide : DoubleSide,
    alphaTest: card ? card.alphaTest ?? 0.5 : 0,
  });
  mat.name = opts.name ?? `veg-${kind}`;

  // The hemisphere fill already carries the reference's generous shade (see config.sky); the extra
  // ambient term is kept small so shaded grass reads ≈ 0.24 luminance, not 0.40.
  const grassLike = kind === 'grass' || kind === 'card';
  const uniforms: Record<string, { value: unknown }> = {
    uAmbientBoost: { value: opts.ambientBoost ?? (grassLike ? 0.02 : kind === 'litter' || kind === 'moss' ? 0.015 : 0.02) },
    uTransmission: { value: opts.transmission ?? (grassLike ? 0.14 : kind === 'litter' ? 0.05 : kind === 'moss' ? 0 : 0.12) },
    uLiftBox: { value: new Vector4(...SHADE_LIFT_ZONE.box) },
    uLiftBoxes2: { value: LIFT_ZONES_EXTRA.map((zone) => new Vector4(...zone.box)) },
    uLiftScales2: { value: LIFT_ZONES_EXTRA.map((zone) => zone.scale) },
    uLiftFeather: { value: SHADE_LIFT_ZONE.feather },
    uLiftFill: { value: opts.shadeLift ?? SHADE_LIFT_ZONE.fill },
  };
  const glossyTop = opts.topRoughness !== undefined;
  if (glossyTop) uniforms.uTopRoughness = { value: opts.topRoughness };
  if (grassLike) {
    uniforms.uTints = { value: [new Color(P.grassDeep), new Color(P.grassMid), new Color(P.grassLight), new Color(P.mossBright).lerp(new Color(P.grassLight), 0.45)] };
    // straw tips: warm yellow like the reference's lit blades, never brighter than its plaza stone
    uniforms.uDryTip = { value: new Color(0x9c8a52) };
    uniforms.uSeedTip = { value: 0 };
    uniforms.uShadeFill = { value: 0.45 };
  }
  if (card) {
    uniforms.uAtlas = { value: card.atlas };
    uniforms.uAtlasSize = { value: new Vector2(card.atlasSize, card.atlasSize) };
    uniforms.uTileGrid = { value: new Vector4(...card.grid) };
    uniforms.uCardMode = { value: card.mode };
    uniforms.uUpMix = { value: card.upMix };
    uniforms.uAtlasLum = { value: new Vector2(card.lum[0], card.lum[1]) };
    uniforms.uAlphaBoost = { value: card.alphaBoost };
  } else if (kind === 'plant' || kind === 'bush') {
    uniforms.uPlantHeight = { value: opts.plantHeight ?? 1 };
    uniforms.uSwayAmount = { value: opts.sway ?? (kind === 'bush' ? 2.2 : 3.2) };
    uniforms.uFlutterAmount = { value: opts.flutter ?? (kind === 'bush' ? 0.028 : 0.014) };
    uniforms.uStiffness = { value: opts.stiffness ?? (kind === 'bush' ? 0.55 : 0.3) };
    plantWind.set(mat, { kind, wind: ctx.wind, uniforms });
  }

  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    if (kind === 'grass') {
      vs = `${WIND_GLSL}\n${GRASS_VERTEX_PARS}\n${vs}`
        .replace('#include <color_vertex>', GRASS_COLOR_VERTEX)
        .replace('#include <defaultnormal_vertex>', GRASS_NORMAL_VERTEX)
        .replace('#include <begin_vertex>', GRASS_SHAPE_VERTEX)
        .replace('#include <project_vertex>', GRASS_PROJECT_VERTEX)
        .replace('#include <worldpos_vertex>', WORLDPOS_VERTEX);
    } else if (kind === 'card') {
      vs = `${WIND_GLSL}\n${CARD_VERTEX_PARS}\n${vs}`
        .replace('#include <color_vertex>', CARD_COLOR_VERTEX)
        .replace('#include <defaultnormal_vertex>', CARD_NORMAL_VERTEX)
        .replace('#include <project_vertex>', CARD_PROJECT_VERTEX)
        .replace('#include <worldpos_vertex>', WORLDPOS_VERTEX);
    } else if (kind === 'plant' || kind === 'bush') {
      vs = injectPlantVertex(vs);
    } else {
      // moss / litter: static geometry, three's own projection, packed variants collapse the same way
      vs = `${PACK_VERTEX_PARS}\n${vs}`.replace('#include <begin_vertex>', PACK_BEGIN_VERTEX);
    }
    // zone lift after the (shared) projection block, so the shadow passes keep an identical block
    vs = `${LIFT_VERTEX_PARS}\n${vs}`;
    vs = vs.includes('#include <project_vertex>')
      ? vs.replace('#include <project_vertex>', `#include <project_vertex>\n${LIFT_VERTEX}`)
      : vs.replace('gl_Position = projectionMatrix * mvPosition;', `gl_Position = projectionMatrix * mvPosition;\n${LIFT_VERTEX}`);
    const lights = (grassLike ? FOLIAGE_FRAGMENT_LIGHTS.replace('//VEG_EXTRA_FILL//', GRASS_FRAGMENT_FILL) : FOLIAGE_FRAGMENT_LIGHTS.replace('//VEG_EXTRA_FILL//', '')).replace('//VEG_TRANSMISSION//', card ? ' * vegAtlasT' : '');
    fs = `uniform float uAmbientBoost;\nuniform float uTransmission;\n${LIFT_FRAGMENT_PARS}${grassLike ? GRASS_FRAGMENT_PARS : ''}${kind === 'grass' ? GRASS_NORMAL_FRAGMENT_PARS : ''}${card ? CARD_FRAGMENT_PARS : ''}${glossyTop ? TOP_ROUGHNESS_PARS : ''}${fs}`.replace('#include <lights_fragment_end>', lights);
    if (kind === 'grass') fs = fs.replace('#include <normal_fragment_begin>', GRASS_NORMAL_FRAGMENT_BEGIN);
    if (card) fs = fs.replace('#include <map_fragment>', CARD_MAP_FRAGMENT).replace('#include <normal_fragment_begin>', CARD_NORMAL_FRAGMENT_BEGIN);
    if (glossyTop) fs = fs.replace('#include <roughnessmap_fragment>', TOP_ROUGHNESS_FRAGMENT);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `veg-${kind}-v13${glossyTop ? '-glossy' : ''}`;
  if (kind === 'litter' || kind === 'moss') return mat;
  return ctx.wind.bind(mat);
}
