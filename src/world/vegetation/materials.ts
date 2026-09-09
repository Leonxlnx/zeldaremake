/**
 * Vegetation materials: MeshStandardMaterial + vertex colours + shared wind (WIND_GLSL).
 * Three distinct wind layers are used by this system:
 *   grass  → windGrass  (fast, bends from the root, per-instance phase/stiffness)
 *   plant  → windBranch (slow stem sway by height) + windLeaf (lamina flutter)
 *   bush   → windBranch (stiffer) + stronger windLeaf flutter
 * Litter and moss are static. All foliage is double sided and gets a cheap translucency
 * term (backlight through the lamina) so blades glow when the sun is behind them.
 */
import { Color, DoubleSide, FrontSide, MeshDepthMaterial, MeshDistanceMaterial, MeshStandardMaterial, RGBADepthPacking, type WebGLProgramParametersWithUniforms } from 'three';
import type { WorldContext } from '../system';
import { WIND_GLSL, type Wind } from '../wind/wind';

export type VegKind = 'grass' | 'plant' | 'bush' | 'litter' | 'moss';

const GRASS_VERTEX_PARS = /* glsl */ `
attribute vec4 aData; // phase, stiffness, tint (0..1), type + dryness
uniform vec3 uTints[4];
uniform vec3 uDryTip;
uniform float uSeedTip;
varying float vBladeT;
`;

const GRASS_COLOR_VERTEX = /* glsl */ `
float bladeT = uv.y;
vBladeT = bladeT;
float vegType = floor(aData.w + 0.001);
float vegDry = fract(aData.w);
int tintIndex = int(clamp(aData.z * 3.999, 0.0, 3.0));
vec3 tint = uTints[tintIndex];
// root → tip gradient: shaded root, lit tip
vec3 bladeColor = mix(tint * 0.42, tint * 1.08, pow(bladeT, 0.75));
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

const FOLIAGE_FRAGMENT_LIGHTS = /* glsl */ `
#include <lights_fragment_end>
{
  // translucency: sun through the lamina when it sits between the camera and the light
  reflectedLight.indirectDiffuse += diffuseColor.rgb * uAmbientBoost;
  #if NUM_DIR_LIGHTS > 0
    float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
    float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.45 + backlight * 0.55;
    reflectedLight.directDiffuse += diffuseColor.rgb * directLight.color * transmission * uTransmission;
  #endif
}
`;

export interface VegMaterialOptions {
  roughness?: number;
  /** max geometry height used to normalise the sway height factor (plants) */
  plantHeight?: number;
  sway?: number;
  flutter?: number;
  stiffness?: number;
  transmission?: number;
  ambientBoost?: number;
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

  const uniforms: Record<string, { value: unknown }> = {
    uAmbientBoost: { value: opts.ambientBoost ?? (kind === 'grass' ? 0.06 : kind === 'litter' || kind === 'moss' ? 0.02 : 0.05) },
    uTransmission: { value: opts.transmission ?? (kind === 'grass' ? 0.16 : kind === 'litter' ? 0.05 : kind === 'moss' ? 0 : 0.14) },
  };
  if (kind === 'grass') {
    uniforms.uTints = { value: [new Color(P.grassDeep), new Color(P.grassMid), new Color(P.grassLight), new Color(P.mossBright).lerp(new Color(P.grassLight), 0.45)] };
    uniforms.uDryTip = { value: new Color(0xc9b56c) };
    uniforms.uSeedTip = { value: 0 };
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
    fs = `uniform float uAmbientBoost;\nuniform float uTransmission;\n${fs}`.replace('#include <lights_fragment_end>', FOLIAGE_FRAGMENT_LIGHTS);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `veg-${kind}-v4`;
  if (kind === 'litter' || kind === 'moss') return mat;
  return ctx.wind.bind(mat);
}
