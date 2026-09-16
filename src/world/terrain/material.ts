/**
 * Layered PBR ground material (W06). A MeshStandardMaterial whose map/normal/roughness chunks are
 * replaced by a six-layer splat: grass, soil, moss, leaf litter, path gravel, cliff rock.
 * Blend weights arrive as two vec4 vertex attributes (aW0 = grass/soil/moss/litter,
 * aW1 = gravel/rock/damp/macro). UVs are world XZ metres so tiling is independent of chunk LOD;
 * every layer is sampled at two scales to kill visible repetition, and the cliff rock is
 * triplanar so steep faces do not stretch. Lights, shadows and scene fog keep working because
 * the rest of the standard shader is untouched.
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
uniform vec3 uSoilTint; uniform vec3 uSoilDark; uniform vec3 uStoneTint;
varying vec4 vW0; varying vec4 vW1; varying vec3 vWPos; varying vec3 vWNrm;

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
`;

const VERT_PARS = /* glsl */ `
attribute vec4 aW0; attribute vec4 aW1;
varying vec4 vW0; varying vec4 vW1; varying vec3 vWPos; varying vec3 vWNrm;
`;

const VERT_MAIN = /* glsl */ `
vW0 = aW0; vW1 = aW1;
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
  vec3 c = vec3(0.0);

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
    vec3 s = col2(tSoilC, uvw, uTiles0.y, mixK);
    s = mix(s, uSoilTint * (0.6 + 0.9 * lum(s)), 0.35);
    c += s * w0.y;
  }
  // moss: bright yellow-green mossy carpet, palette hue
  if (w0.z > 0.002) {
    vec3 m = col2(tMossC, uvw, uTiles0.z, mixK);
    float ml = lum(m);
    vec3 moss = mix(uMossDeep, uMossBright, smoothstep(0.2, 0.7, ml)) * (0.7 + 0.6 * ml);
    moss = mix(moss, m, 0.3);
    c += moss * w0.z;
  }
  // leaf litter / forest floor
  if (w0.w > 0.002) {
    vec3 l = col2(tLitterC, uvw, uTiles1.x, mixK);
    c += l * vec3(1.0, 0.98, 0.9) * w0.w;
  }
  // path gravel / stony soil under and beside the flagstones
  if (w1.x > 0.002) {
    vec3 gv = col2(tGravelC, uvw, uTiles1.y, mixK);
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
  // macro variation + damp darkening
  c *= mix(0.86, 1.14, k);
  c = mix(c, c * uSoilDark * 2.2, vW1.z * 0.55);
  diffuseColor.rgb *= c;
}
`;

// Replaces <normal_fragment_maps>: blends the layer normal maps (tangent space, world-xz frame).
const NORMAL_FRAG = /* glsl */ `
{
  vec2 uvw = vWPos.xz;
  float mixK = smoothstep(0.25, 0.75, vW1.w);
  vec3 mapN = vec3(0.0, 0.0, 0.0);
  float tot = 0.0;
  if (vW0.x > 0.002) { mapN += nrm2(tGrassN, uvw, uTiles0.x, mixK) * vW0.x; tot += vW0.x; }
  if (vW0.y > 0.002) { mapN += nrm2(tSoilN, uvw, uTiles0.y, mixK) * vW0.y; tot += vW0.y; }
  if (vW0.z > 0.002) { mapN += nrm2(tMossN, uvw, uTiles0.z, mixK) * vW0.z; tot += vW0.z; }
  if (vW0.w > 0.002) { mapN += nrm2(tLitterN, uvw, uTiles1.x, mixK) * vW0.w; tot += vW0.w; }
  if (vW1.x > 0.002) { mapN += nrm2(tGravelN, uvw, uTiles1.y, mixK) * vW1.x; tot += vW1.x; }
  if (tot > 0.0) mapN /= tot; else mapN = vec3(0.0, 0.0, 1.0);
  mapN.xy *= normalScale;
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
  roughnessFactor = clamp(r, 0.45, 1.0);
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

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', MAP_FRAG)
      .replace('#include <normal_fragment_maps>', NORMAL_FRAG)
      .replace('#include <roughnessmap_fragment>', ROUGH_FRAG);
  };
  material.customProgramCacheKey = () => 'terrain-layered-v1';

  return { material, layers: [...TERRAIN_LAYERS], textured, detailNormal: true, sets: names };
}
