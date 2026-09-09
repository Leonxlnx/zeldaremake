/**
 * Tree materials. One material serves bark AND leaves of a tree family (selected per vertex by
 * `aRoot.w`), so every variant/LOD is a single InstancedMesh and every giant sector one mesh —
 * halving the tree draw calls. Wind comes from the shared model (`WIND_GLSL`) in three layers —
 * whole-tree sway (trunk stiff, evaluated at the tree root), per-branch flex (stiffness from the
 * local wood radius, per-branch phase) and per-leaf flutter — driven by the `aWind` / `aRoot`
 * vertex attributes written by `writer.ts`. Shadow depth materials receive the same displacement
 * so shadows never detach from the moving geometry.
 *
 * Leaf shading (midrib, veins, translucency) is derived from Verdant Forest by Leonxlnx.
 */
import {
  Color,
  DoubleSide,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  Vector2,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { WIND_GLSL, type Wind } from '../wind/wind';
import type { WorldContext } from '../system';
import { createWhiteBarkTextures } from './bark-texture';
import { createLeafClusterTexture } from './leaf-cluster-texture';

export interface TreeMaterials {
  whiteTree: MeshStandardMaterial;
  whiteTreeDepth: MeshDepthMaterial;
  giantTree: MeshStandardMaterial;
  giantTreeDepth: MeshDepthMaterial;
  /** leaf-cluster alpha cards inside the giant lobes */
  giantCanopy: MeshStandardMaterial;
  giantCanopyDepth: MeshDepthMaterial;
  distant: MeshStandardMaterial;
  /** number of distinct wind responses implemented (trunk sway, branch flex, leaf flutter) */
  windLayers: number;
  barkTextureSets: string[];
}

interface WindOpts {
  /** stiffness of the whole-tree sway layer (1 = does not move) */
  treeStiffness: number;
  /** scale of the per-branch flex layer */
  flex: number;
}

const WIND_VERTEX_PARS = /* glsl */ `
attribute vec3 aWind;
attribute vec4 aRoot;
uniform float uTreeStiff;
uniform float uFlex;
varying vec3 vTreeWorld;
varying vec2 vTreeUv;
varying float vTreeLocalY;
varying float vIsLeaf;
`;

const WIND_VERTEX_BODY = /* glsl */ `
  #include <begin_vertex>
  {
    vec4 treeRoot = vec4(aRoot.xyz, 1.0);
    vec4 treeP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      treeRoot = instanceMatrix * treeRoot;
      treeP = instanceMatrix * treeP;
    #endif
    treeRoot = modelMatrix * treeRoot;
    treeP = modelMatrix * treeP;
    float hAbove = max(0.0, treeP.y - treeRoot.y);
    // layer 1: whole tree sways coherently from its root (evaluated at the root so the trunk bends as one)
    vec3 disp = windBranch(treeRoot.xyz, hAbove, uTreeStiff);
    // layer 2: branches flex by their own stiffness with a per-branch phase offset
    vec3 flexP = treeP.xyz + vec3(aWind.y * 41.0, aWind.y * 7.0, aWind.y * 23.0);
    disp += windBranch(flexP, hAbove * 0.5, aWind.x) * uFlex;
    // layer 3: leaf flutter (amount is zero on wood and at the petiole so laminae stay attached)
    disp += windLeaf(treeP.xyz, aWind.y, aWind.z);
    // world-space displacement back into object space (instances are yaw + uniform scale)
    #ifdef USE_INSTANCING
      mat3 im = mat3(instanceMatrix);
      float s2 = dot(im[0], im[0]);
      transformed += (transpose(im) * disp) / s2;
    #else
      transformed += disp;
    #endif
    vTreeWorld = treeP.xyz + disp;
    vTreeUv = uv;
    vTreeLocalY = position.y - aRoot.y;
    vIsLeaf = aRoot.w;
  }
`;

function injectWind(material: Material, wind: Wind, o: WindOpts, extra?: (shader: WebGLProgramParametersWithUniforms) => void, key = '') {
  const uTreeStiff = { value: o.treeStiffness };
  const uFlex = { value: o.flex };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTreeStiff = uTreeStiff;
    shader.uniforms.uFlex = uFlex;
    shader.vertexShader = WIND_GLSL + WIND_VERTEX_PARS + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', WIND_VERTEX_BODY);
    extra?.(shader);
  };
  material.customProgramCacheKey = () => `trees-${key}-v4`;
  wind.bind(material);
}

const TREE_FRAGMENT_PARS = /* glsl */ `
varying vec3 vTreeWorld;
varying vec2 vTreeUv;
varying float vTreeLocalY;
varying float vIsLeaf;
uniform vec3 uLeafSun;
uniform float uLeafRough;
float treeHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 24.11))) * 43758.5453); }
float treeNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(treeHash(i), treeHash(i + vec3(1,0,0)), f.x), mix(treeHash(i + vec3(0,1,0)), treeHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(treeHash(i + vec3(0,0,1)), treeHash(i + vec3(1,0,1)), f.x), mix(treeHash(i + vec3(0,1,1)), treeHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

/** midrib + veins + translucency; the geometry is already a curved lamina so this is only surface detail */
const LEAF_COLOR = /* glsl */ `
  float midrib = exp(-pow((vTreeUv.x - 0.5) * 70.0, 2.0));
  float vein = pow(0.5 + 0.5 * cos((vTreeUv.y * 11.0 - abs(vTreeUv.x - 0.5) * 4.0) * 6.28318), 14.0);
  float speck = sin(vTreeUv.x * 143.0 + sin(vTreeUv.y * 91.0) * 2.0) * sin(vTreeUv.y * 177.0);
  diffuseColor.rgb *= (0.92 + speck * 0.03 + midrib * 0.16 + vein * 0.05);
`;

/** white bark: procedural tile × vertex colour, with a soft moss/soil ring at the very base */
const WHITE_BARK_COLOR = /* glsl */ `
  float n = treeNoise(vTreeWorld * 3.1);
  float upY = inverseTransformDirection(normalize(vNormal), viewMatrix).y;
  float moss = (1.0 - smoothstep(0.05, 1.1, vTreeLocalY)) * smoothstep(0.35, 0.75, n * 0.7 + 0.3 * (1.0 - upY));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.22, 0.07), moss * 0.7);
  // subtle large-scale tone variation so identical variants do not read as clones
  float tone = treeNoise(vec3(vTreeWorld.x * 0.05, vTreeWorld.y * 0.3, vTreeWorld.z * 0.05));
  diffuseColor.rgb *= 0.9 + tone * 0.2;
`;

/** giant bark: fissured texture × vertex colour, patchy moss on upward faces and around the base */
const GIANT_BARK_COLOR = /* glsl */ `
  float coarse = treeNoise(vTreeWorld * 0.55) * 0.55 + treeNoise(vTreeWorld * 2.1) * 0.45;
  float up = clamp(inverseTransformDirection(normalize(vNormal), viewMatrix).y, 0.0, 1.0);
  float lowBand = 1.0 - smoothstep(0.3, 4.5, vTreeLocalY);
  float moss = smoothstep(0.5, 0.82, up * 0.5 + coarse * 0.55 + lowBand * 0.22);
  vec3 mossColor = mix(vec3(0.12, 0.19, 0.05), vec3(0.28, 0.4, 0.11), coarse);
  diffuseColor.rgb = mix(diffuseColor.rgb, mossColor, moss * 0.8);
  float tone = treeNoise(vec3(vTreeWorld.x * 0.08, vTreeWorld.y * 0.15, vTreeWorld.z * 0.08));
  diffuseColor.rgb *= 0.86 + tone * 0.28;
`;

function treeFragment(shader: WebGLProgramParametersWithUniforms, sun: Color, leafRoughness: number, barkColor: string) {
  shader.uniforms.uLeafSun = { value: sun };
  shader.uniforms.uLeafRough = { value: leafRoughness };
  shader.fragmentShader = TREE_FRAGMENT_PARS + shader.fragmentShader;
  // bark texture only on wood; leaves keep their vertex colour
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    /* glsl */ `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D(map, vMapUv);
      diffuseColor *= mix(sampledDiffuseColor, vec4(1.0), vIsLeaf);
    #endif
    `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <roughnessmap_fragment>',
    /* glsl */ `#include <roughnessmap_fragment>
    roughnessFactor = mix(roughnessFactor, uLeafRough, vIsLeaf);
    `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <normal_fragment_maps>',
    /* glsl */ `#include <normal_fragment_maps>
    normal = normalize(mix(normal, nonPerturbedNormal, vIsLeaf));
    `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    /* glsl */ `#include <color_fragment>
    if (vIsLeaf > 0.5) {
      ${LEAF_COLOR}
    } else {
      ${barkColor}
    }
    `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <lights_fragment_end>',
    /* glsl */ `#include <lights_fragment_end>
    if (vIsLeaf > 0.5) {
      // ambient fill so the underside of the canopy is never black
      reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.08;
      #if NUM_DIR_LIGHTS > 0
      {
        float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
        float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.45 + backlight * 0.65;
        vec3 sunTint = mix(diffuseColor.rgb, uLeafSun, 0.5);
        reflectedLight.directDiffuse += sunTint * directLight.color * transmission * 0.22;
      }
      #endif
    }
    `,
  );
}

export async function createTreeMaterials(ctx: WorldContext): Promise<TreeMaterials> {
  const wind = ctx.wind;
  const palette = ctx.config.palette;
  const leafSun = new Color(palette.leafSun);

  // --- white-bark trees (procedural canvas bark set + leaves) ---
  const wb = createWhiteBarkTextures(ctx.rng.fork('trees/bark-texture'));
  const whiteTree = new MeshStandardMaterial({
    map: wb.color,
    normalMap: wb.normal,
    normalScale: new Vector2(0.55, 0.55),
    roughnessMap: wb.roughness,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    side: DoubleSide,
  });
  const whiteWind = { treeStiffness: 0.8, flex: 0.35 };
  injectWind(whiteTree, wind, whiteWind, (s) => treeFragment(s, leafSun, 0.72, WHITE_BARK_COLOR), 'white');
  const whiteTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(whiteTreeDepth, wind, whiteWind, undefined, 'white-depth');

  // --- giants (Poly Haven tree_bark_03, CC0 + leaves) ---
  const barkSet = 'tree_bark_03';
  const [gColor, gNormal, gRough] = await Promise.all([
    ctx.textures.load(barkSet, 'color'),
    ctx.textures.load(barkSet, 'normal'),
    ctx.textures.load(barkSet, 'roughness'),
  ]);
  const giantTree = new MeshStandardMaterial({
    map: gColor as Texture,
    normalMap: gNormal as Texture,
    normalScale: new Vector2(1.6, 1.6),
    roughnessMap: gRough as Texture,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    color: new Color(0xcfc6b8),
    side: DoubleSide,
  });
  const giantWind = { treeStiffness: 0.97, flex: 0.3 };
  injectWind(giantTree, wind, giantWind, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR), 'giant');
  const giantTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(giantTreeDepth, wind, giantWind, undefined, 'giant-depth');

  // --- giant canopy cluster cards (procedural alpha texture; dappled shadows through the alpha) ---
  const cluster = createLeafClusterTexture(ctx.rng.fork('trees/leaf-cluster'), palette);
  const giantCanopy = new MeshStandardMaterial({
    map: cluster,
    alphaTest: 0.5,
    transparent: false,
    roughness: 0.8,
    metalness: 0,
    vertexColors: true,
    side: DoubleSide,
  });
  injectWind(
    giantCanopy,
    wind,
    giantWind,
    (s) => {
      s.uniforms.uLeafSun = { value: leafSun };
      s.fragmentShader = `varying vec3 vTreeWorld;\nvarying vec2 vTreeUv;\nvarying float vTreeLocalY;\nvarying float vIsLeaf;\nuniform vec3 uLeafSun;\n` + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.1;
        #if NUM_DIR_LIGHTS > 0
        {
          float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
          float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.4 + backlight * 0.6;
          reflectedLight.directDiffuse += mix(diffuseColor.rgb, uLeafSun, 0.5) * directLight.color * transmission * 0.2;
        }
        #endif
        `,
      );
    },
    'giant-canopy',
  );
  const giantCanopyDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide, map: cluster, alphaTest: 0.5 });
  injectWind(giantCanopyDepth, wind, giantWind, undefined, 'giant-canopy-depth');

  // --- distant trees: leaf-cluster cards + solid trunks/cores (uv on the opaque patch); fog tints ---
  const distant = new MeshStandardMaterial({ map: cluster, alphaTest: 0.5, vertexColors: true, roughness: 0.95, metalness: 0, side: DoubleSide });

  return {
    whiteTree,
    whiteTreeDepth,
    giantTree,
    giantTreeDepth,
    giantCanopy,
    giantCanopyDepth,
    distant,
    windLayers: 3,
    barkTextureSets: [barkSet, 'procedural:whitebark', 'procedural:leaf-cluster'],
  };
}
