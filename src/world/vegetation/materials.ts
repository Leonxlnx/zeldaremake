/**
 * Vegetation materials: MeshStandardMaterial + vertex colours + shared wind (WIND_GLSL).
 * Three distinct wind layers are used by this system:
 *   grass  → windGrass  (fast, bends from the root, per-instance phase/stiffness)
 *   plant  → windBranch (slow stem sway by height) + windLeaf (lamina flutter)
 *   bush   → windBranch (stiffer) + stronger windLeaf flutter
 * Litter and moss are static. All foliage is double sided and gets a cheap translucency
 * term (backlight through the lamina) so blades glow when the sun is behind them.
 */
import { Color, DoubleSide, FrontSide, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, RGBADepthPacking, Vector4, type WebGLProgramParametersWithUniforms } from 'three';
import type { WorldContext } from '../system';
import { WIND_GLSL, type Wind } from '../wind/wind';

export type VegKind = 'grass' | 'plant' | 'bush' | 'litter' | 'moss';

const GRASS_VERTEX_PARS = /* glsl */ `
attribute vec4 aData; // phase, stiffness, (tint index + 0.25 + 0.5 × shade lift) / 4, type + dryness
uniform vec3 uTints[4];
uniform vec3 uDryTip;
uniform float uSeedTip;
varying float vBladeT;
varying float vShadeLift;
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
vec3 tint = uTints[tintIndex];
// root → tip gradient: deep, slightly cool root buried in the tuft, warm lit tip (the reference's
// shaded grass is a dark green-brown ≈ 0.24 luminance, its lit blades an olive ≈ 0.35)
vec3 rootTone = mix(vec3(0.36, 0.38, 0.40), vec3(0.66, 0.72, 0.64), shadeLift);
vec3 bladeColor = mix(tint * rootTone, tint * vec3(1.0, 1.0, 0.92), pow(bladeT, 0.8));
// sedge blades are a touch cooler/deeper, meadow blades a touch warmer
bladeColor *= vegType > 1.5 ? vec3(0.9, 1.0, 1.02) : vegType > 0.5 ? vec3(1.06, 1.02, 0.9) : vec3(1.0);
// straw-coloured dry tips
bladeColor = mix(bladeColor, uDryTip, vegDry * smoothstep(0.45, 1.0, bladeT));
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

// normal: blade facing mixed with terrain up, with a fake fold so the two edges shade differently
const GRASS_NORMAL_VERTEX = /* glsl */ `
vec3 transformedNormal;
{
  float side = uv.x * 2.0 - 1.0;
  mat3 im = mat3(instanceMatrix);
  vec3 bladeUp = normalize(im[1]);
  vec3 bladeFace = normalize(im[2]);
  vec3 bladeSide = normalize(im[0]);
  vec3 n = normalize(bladeFace * 0.8 + bladeSide * side * 0.6);
  n = normalize(mix(n, bladeUp, 0.55));
  transformedNormal = normalMatrix * n;
}
#ifdef FLIP_SIDED
  transformedNormal = - transformedNormal;
#endif
`;

const GRASS_PROJECT_VERTEX = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
mvPosition = instanceMatrix * mvPosition;
vec4 vegWorld = modelMatrix * mvPosition;
vegWorld.xyz += windGrass(vegWorld.xyz, uv.y, aData.x, aData.y);
mvPosition = viewMatrix * vegWorld;
gl_Position = projectionMatrix * mvPosition;
`;

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
  vegWorld.xyz += sway * hf + flutter;
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

const LIFT_VERTEX_PARS = /* glsl */ `
uniform vec4 uLiftBox;
uniform float uLiftFeather;
varying float vZoneLift;
`;
// evaluated at the instance root so a whole plant gets one lift value (no gradient across fronds)
const LIFT_VERTEX = /* glsl */ `
{
  #ifdef USE_INSTANCING
    vec2 liftRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  #else
    vec2 liftRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  #endif
  vec2 liftOut = max(max(uLiftBox.xy - liftRoot, liftRoot - uLiftBox.zw), vec2(0.0));
  vZoneLift = 1.0 - smoothstep(0.0, uLiftFeather, length(liftOut));
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
    reflectedLight.directDiffuse += diffuseColor.rgb * directLight.color * transmission * uTransmission;
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
  return `${WIND_GLSL}\n${PLANT_VERTEX_PARS}\n${vertexShader}`
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
    mat.customProgramCacheKey = () => `veg-${state.kind}-${pass}-v1`;
    state.wind.bind(mat);
  }
  return { depth, distance };
}

export function createVegMaterial(ctx: WorldContext, kind: VegKind, opts: VegMaterialOptions = {}): MeshStandardMaterial {
  const P = ctx.config.palette;
  const mat = new MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? (kind === 'litter' ? 0.9 : 0.82),
    metalness: 0,
    side: opts.singleSided ? FrontSide : DoubleSide,
  });
  mat.name = opts.name ?? `veg-${kind}`;

  // The hemisphere fill already carries the reference's generous shade (see config.sky); the extra
  // ambient term is kept small so shaded grass reads ≈ 0.24 luminance, not 0.40.
  const uniforms: Record<string, { value: unknown }> = {
    uAmbientBoost: { value: opts.ambientBoost ?? (kind === 'grass' ? 0.02 : kind === 'litter' || kind === 'moss' ? 0.015 : 0.02) },
    uTransmission: { value: opts.transmission ?? (kind === 'grass' ? 0.14 : kind === 'litter' ? 0.05 : kind === 'moss' ? 0 : 0.12) },
    uLiftBox: { value: new Vector4(...SHADE_LIFT_ZONE.box) },
    uLiftFeather: { value: SHADE_LIFT_ZONE.feather },
    uLiftFill: { value: opts.shadeLift ?? SHADE_LIFT_ZONE.fill },
  };
  const glossyTop = opts.topRoughness !== undefined;
  if (glossyTop) uniforms.uTopRoughness = { value: opts.topRoughness };
  if (kind === 'grass') {
    uniforms.uTints = { value: [new Color(P.grassDeep), new Color(P.grassMid), new Color(P.grassLight), new Color(P.mossBright).lerp(new Color(P.grassLight), 0.45)] };
    // straw tips: warm yellow like the reference's lit blades, never brighter than its plaza stone
    uniforms.uDryTip = { value: new Color(0x9c8a52) };
    uniforms.uSeedTip = { value: 0 };
    uniforms.uShadeFill = { value: 0.45 };
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
    } else if (kind === 'plant' || kind === 'bush') {
      vs = injectPlantVertex(vs);
    }
    // zone lift after the (shared) projection block, so the shadow passes keep an identical block
    vs = `${LIFT_VERTEX_PARS}\n${vs}`;
    vs = vs.includes('#include <project_vertex>')
      ? vs.replace('#include <project_vertex>', `#include <project_vertex>\n${LIFT_VERTEX}`)
      : vs.replace('gl_Position = projectionMatrix * mvPosition;', `gl_Position = projectionMatrix * mvPosition;\n${LIFT_VERTEX}`);
    const lights = kind === 'grass' ? FOLIAGE_FRAGMENT_LIGHTS.replace('//VEG_EXTRA_FILL//', GRASS_FRAGMENT_FILL) : FOLIAGE_FRAGMENT_LIGHTS.replace('//VEG_EXTRA_FILL//', '');
    fs = `uniform float uAmbientBoost;\nuniform float uTransmission;\n${LIFT_FRAGMENT_PARS}${kind === 'grass' ? GRASS_FRAGMENT_PARS : ''}${glossyTop ? TOP_ROUGHNESS_PARS : ''}${fs}`.replace('#include <lights_fragment_end>', lights);
    if (glossyTop) fs = fs.replace('#include <roughnessmap_fragment>', TOP_ROUGHNESS_FRAGMENT);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `veg-${kind}-v8${glossyTop ? '-glossy' : ''}`;
  if (kind === 'litter' || kind === 'moss') return mat;
  return ctx.wind.bind(mat);
}
