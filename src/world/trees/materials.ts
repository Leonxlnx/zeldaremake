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
import { GIANT_BARK_FLOOR, LEAF_FLOOR, bindShadeFloor, shadeFloorGlsl, shadeFloorPars, type ShadeFloor, type ShadeFloorGlslOptions } from '../materials/shadeFloor';
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

/**
 * Leaf-cluster cards: the alpha test is below 0.5 and the map is sampled with a negative mip bias
 * so the fine leaves of the cluster texture keep their coverage at canopy distances instead of
 * mipping down to a sprinkle of dots (the cards then read as tufts, not as one lamina).
 */
const CARD_ALPHA_TEST = 0.42;
const CARD_MIP_BIAS = -0.75;
function biasedMap(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    /* glsl */ `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D(map, vMapUv, ${CARD_MIP_BIAS.toFixed(2)});
      #ifdef DECODE_VIDEO_TEXTURE
        sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
      #endif
      diffuseColor *= sampledDiffuseColor;
    #endif
    `,
  );
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
uniform float uLeafTransmit;
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

/**
 * giant bark: fissured texture × vertex colour, patchy moss on upward faces and around the base.
 * Sheet 01 'Mossy tree trunk' / 'Roots' (below ≈ 3 m, where the hero cameras see the boles up
 * close): the root tops wear continuous moss sheets rather than the bole's patchy upward-face
 * moss, the bare bark between carries pale grey-green lichen crusts in clustered flecks (same
 * family as the boulders' lichen in rocks/material.ts), and a few small moss cushions / leafy
 * tufts sit in the fissures on the sides of the bole, each with a shaded rim so it sits in the
 * bark. Lichen and tufts fade out between 4 and 10 m of view distance: the hero cameras see the
 * boles from 10–15 m, where the reference shows them as smooth dark columns and the same flecks
 * measured as SSIM noise (F's right-edge trunk −0.004 with them on at that range). Shader-only:
 * no geometry, no draw calls.
 */
const GIANT_BARK_COLOR = /* glsl */ `
  float coarse = treeNoise(vTreeWorld * 0.55) * 0.55 + treeNoise(vTreeWorld * 2.1) * 0.45;
  float up = clamp(inverseTransformDirection(normalize(vNormal), viewMatrix).y, 0.0, 1.0);
  float lowBand = 1.0 - smoothstep(0.3, 4.5, vTreeLocalY);
  float moss = smoothstep(0.5, 0.82, up * 0.5 + coarse * 0.55 + lowBand * 0.22);
  vec3 mossColor = mix(vec3(0.12, 0.19, 0.05), vec3(0.28, 0.4, 0.11), coarse);
  // root sheets: the upward faces of the roots and the foot of the bole, under a soft-edged
  // cover that follows the coarse noise so the sheets still have ragged margins
  float sheet = smoothstep(0.45, 0.85, up) * (1.0 - smoothstep(0.6, 2.2, vTreeLocalY)) * smoothstep(0.18, 0.5, coarse);
  moss = max(moss, sheet);
  mossColor = mix(mossColor, vec3(0.33, 0.47, 0.13), sheet * 0.65);
  diffuseColor.rgb = mix(diffuseColor.rgb, mossColor, moss * 0.8);
  // close-range detail only: past 4–10 m the flecks are 1–3 px of speckle on boles the reference
  // frames show as smooth hazed columns (F's stair-bank giant at 10 m, D's north-west-near at 11 m)
  float foot = (1.0 - smoothstep(1.6, 3.2, vTreeLocalY)) * (1.0 - smoothstep(4.0, 10.0, length(vViewPosition)));
  // lichen: clustered crusts 3–6 cm across on the bare bark, thinning out under the moss. Kept
  // small, sparse and only a little paler than the bark: a first cut at 10–20 cm and 0.75 blend
  // read as a plane tree's blotches from 8 m
  float lichenCluster = smoothstep(0.55, 0.75, treeNoise(vTreeWorld * 1.7 + 5.0));
  float lichenFleck = smoothstep(0.6, 0.7, treeNoise(vTreeWorld * 22.0) * 0.7 + treeNoise(vTreeWorld * 55.0 + 3.0) * 0.3);
  float lichen = lichenCluster * lichenFleck * foot * (1.0 - moss);
  vec3 lichenColor = mix(vec3(0.46, 0.5, 0.38), vec3(0.55, 0.56, 0.48), treeNoise(vTreeWorld * 4.0 + 9.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, lichenColor, lichen * 0.6);
  // moss cushions and small plant tufts: 10–20 cm, rare, on the sides of the bole (not on the
  // moss sheets), a shaded rim under each so they sit in the bark instead of on it. A first cut at
  // 40 cm in a yellow-green with a hard dark outline read as leaves stuck to the trunk
  float tuftN = treeNoise(vTreeWorld * 7.5 + 17.0) * 0.7 + treeNoise(vTreeWorld * 21.0 + 2.0) * 0.3;
  float tuftSide = foot * (1.0 - smoothstep(0.55, 0.9, up)) * (1.0 - sheet);
  float tuftCore = smoothstep(0.74, 0.8, tuftN) * tuftSide;
  float tuftRim = (smoothstep(0.7, 0.74, tuftN) - smoothstep(0.74, 0.8, tuftN)) * tuftSide;
  vec3 tuftColor = mix(vec3(0.27, 0.4, 0.12), vec3(0.36, 0.5, 0.15), treeNoise(vTreeWorld * 13.0 + 31.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, tuftRim * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, tuftColor, tuftCore * 0.85);
  float tone = treeNoise(vec3(vTreeWorld.x * 0.08, vTreeWorld.y * 0.15, vTreeWorld.z * 0.08));
  diffuseColor.rgb *= 0.86 + tone * 0.28;
`;

/**
 * Sky light through the lamina. A leaf is thin: the face turned away from the viewer is lit by
 * the hemisphere (and the environment) it faces, and a share of that comes through, tinted toward
 * the sunlit leaf colour (chlorophyll passes yellow-green). This is what lifts the undersides of
 * the near crowns (6–21 m in shot A) from opaque dark cut-outs toward the reference's glowing
 * backlit roof (A top band p10 0.39 against our 0.29 without it). Wood never gets it (gated on
 * vIsLeaf by the callers; the cluster cards are all leaf). The sun's own transmission stays the
 * separate directional term below, so this adds nothing sun-dependent in the shadowed crown.
 */
const LEAF_SKY_TRANSMISSION = /* glsl */ `
  {
    vec3 backNormal = -geometryNormal;
    vec3 skyThrough = vec3(0.0);
    #if NUM_HEMI_LIGHTS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
      skyThrough += getHemisphereLightIrradiance(hemisphereLights[i], backNormal);
    }
    #pragma unroll_loop_end
    #endif
    #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
    skyThrough += getIBLIrradiance(backNormal);
    #endif
    // the tint leans to the sunlit leaf colour but is part-desaturated: at full chroma the glow
    // read as yellow-green neon (B forest box sat 0.21 against the reference's 0.14)
    vec3 through = mix(diffuseColor.rgb, uLeafSun, 0.25);
    through = mix(through, vec3(dot(through, vec3(0.2126, 0.7152, 0.0722))), 0.4);
    reflectedLight.indirectDiffuse += skyThrough * BRDF_Lambert(through) * uLeafTransmit;
  }
`;
/**
 * share of the back-face sky irradiance that comes through a leaf (see LEAF_SKY_TRANSMISSION).
 * Calibration (round 9, shot A top band): 0.7 was invisible, 4.0 a neon glow (+0.03 mean, sat
 * 0.19 vs 0.15); 1.2 lifts the near laminae without changing the band's mean. The band's darkest
 * decile (p10 0.31 vs the reference's 0.39) does not move with any value — it is bough and limb
 * bark, not leaf: transmission cannot reach it.
 */
const LEAF_TRANSMIT = 1.2;

/**
 * Shade floors (shared model, presets and calibration notes in materials/shadeFloor.ts): the
 * giants' bark runs GIANT_BARK_FLOOR, every leaf and the canopy cards LEAF_FLOOR. The tree shader
 * places the blocks itself — one per branch of its leaf/bark split — under the uniform prefixes
 * `uBarkFloor` and `uLeafFloor`, and points them at its own `uLeafSun` (shared with the leaf
 * transmission) rather than a per-floor copy: that keeps the compiled GLSL text identical, and
 * the tree programs' float results with it — a different text is compiled to a different
 * instruction order, and the half-float HDR differences that follow, invisible on the trees,
 * came back as ±1 flips on the roof and limb next to them through the bloom and softness blurs.
 */
const TREE_FLOOR_GLSL: ShadeFloorGlslOptions = { leafSun: 'uLeafSun' };
/** white-barks are pale already; their shaded sides are not among the measured gaps */
const WHITE_BARK_FLOOR: ShadeFloor = { lift: 0, texture: 1, canopy: 0, albedo: 0.08, chroma: 1 };

function treeFragment(shader: WebGLProgramParametersWithUniforms, sun: Color, leafRoughness: number, barkColor: string, barkFloor: ShadeFloor) {
  shader.uniforms.uLeafSun = { value: sun };
  shader.uniforms.uLeafRough = { value: leafRoughness };
  shader.uniforms.uLeafTransmit = { value: LEAF_TRANSMIT };
  bindShadeFloor(shader, 'uBarkFloor', barkFloor);
  bindShadeFloor(shader, 'uLeafFloor', LEAF_FLOOR);
  shader.fragmentShader = TREE_FRAGMENT_PARS + shadeFloorPars('uBarkFloor', TREE_FLOOR_GLSL) + shadeFloorPars('uLeafFloor', TREE_FLOOR_GLSL) + shader.fragmentShader;
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
      ${LEAF_SKY_TRANSMISSION}
      #if NUM_DIR_LIGHTS > 0
      {
        float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
        float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.45 + backlight * 0.65;
        vec3 sunTint = mix(diffuseColor.rgb, uLeafSun, 0.5);
        reflectedLight.directDiffuse += sunTint * directLight.color * transmission * 0.22;
      }
      #endif
      ${shadeFloorGlsl('uLeafFloor', TREE_FLOOR_GLSL)}
    } else {
      ${shadeFloorGlsl('uBarkFloor', TREE_FLOOR_GLSL)}
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
  injectWind(whiteTree, wind, whiteWind, (s) => treeFragment(s, leafSun, 0.72, WHITE_BARK_COLOR, WHITE_BARK_FLOOR), 'white');
  const whiteTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(whiteTreeDepth, wind, whiteWind, undefined, 'white-depth');

  // --- giants (Poly Haven tree_bark_03, CC0 + leaves) ---
  const barkSet = 'tree_bark_03';
  const [gColor, gNormal, gRough] = await Promise.all([
    ctx.textures.load(barkSet, 'color'),
    ctx.textures.load(barkSet, 'normal'),
    ctx.textures.load(barkSet, 'roughness'),
  ]);
  // Reference giant bark measures #6c604a lit / #473e33 in shade (warm dark brown-grey); the
  // shaded side is mostly haze at 15 m, so the tint mainly sets the sunlit rim — kept dark and
  // warm so it never reads as pale grey next to the (genuinely pale) white-bark species. The
  // shaded faces are carried by GIANT_BARK_FLOOR instead, which does not touch the lit rim.
  const giantTree = new MeshStandardMaterial({
    map: gColor as Texture,
    normalMap: gNormal as Texture,
    normalScale: new Vector2(1.6, 1.6),
    roughnessMap: gRough as Texture,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    color: new Color(0x9b7e62),
    side: DoubleSide,
  });
  const giantWind = { treeStiffness: 0.97, flex: 0.3 };
  injectWind(giantTree, wind, giantWind, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, GIANT_BARK_FLOOR), 'giant');
  const giantTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(giantTreeDepth, wind, giantWind, undefined, 'giant-depth');

  // --- giant canopy cluster cards (procedural alpha texture; dappled shadows through the alpha) ---
  const cluster = createLeafClusterTexture(ctx.rng.fork('trees/leaf-cluster'), palette);
  const giantCanopy = new MeshStandardMaterial({
    map: cluster,
    alphaTest: CARD_ALPHA_TEST,
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
      biasedMap(s);
      s.uniforms.uLeafSun = { value: leafSun };
      s.uniforms.uLeafTransmit = { value: LEAF_TRANSMIT };
      bindShadeFloor(s, 'uLeafFloor', LEAF_FLOOR);
      s.fragmentShader = `varying vec3 vTreeWorld;\nvarying vec2 vTreeUv;\nvarying float vTreeLocalY;\nvarying float vIsLeaf;\nuniform vec3 uLeafSun;\nuniform float uLeafTransmit;\n` + shadeFloorPars('uLeafFloor', TREE_FLOOR_GLSL) + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.1;
        ${LEAF_SKY_TRANSMISSION}
        #if NUM_DIR_LIGHTS > 0
        {
          float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
          float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.4 + backlight * 0.6;
          reflectedLight.directDiffuse += mix(diffuseColor.rgb, uLeafSun, 0.5) * directLight.color * transmission * 0.2;
        }
        #endif
        ${shadeFloorGlsl('uLeafFloor', TREE_FLOOR_GLSL)}
        `,
      );
    },
    'giant-canopy',
  );
  const giantCanopyDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide, map: cluster, alphaTest: CARD_ALPHA_TEST });
  injectWind(giantCanopyDepth, wind, giantWind, biasedMap, 'giant-canopy-depth');

  // --- distant trees: leaf-cluster cards + solid trunks/cores (uv on the opaque patch); fog tints ---
  const distant = new MeshStandardMaterial({ map: cluster, alphaTest: CARD_ALPHA_TEST, vertexColors: true, roughness: 0.95, metalness: 0, side: DoubleSide });
  distant.onBeforeCompile = (s) => biasedMap(s);
  distant.customProgramCacheKey = () => 'trees-distant-biased';

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
