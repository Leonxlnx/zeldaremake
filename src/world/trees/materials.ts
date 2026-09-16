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
  Vector4,
  type IUniform,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { WIND_GLSL, type Wind } from '../wind/wind';
import { GIANT_BARK_FLOOR, LEAF_FLOOR, bindShadeFloor, shadeFloorGlsl, shadeFloorPars, type ShadeFloor, type ShadeFloorGlslOptions } from '../materials/shadeFloor';
import type { WorldContext } from '../system';
import { createWhiteBarkTextures } from './bark-texture';
import { createLeafClusterDetail, createLeafClusterTexture } from './leaf-cluster-texture';
import { BARK_AO_LIFT } from './bole';

export interface TreeMaterials {
  whiteTree: MeshStandardMaterial;
  whiteTreeDepth: MeshDepthMaterial;
  giantTree: MeshStandardMaterial;
  giantTreeDepth: MeshDepthMaterial;
  /**
   * the giants' bark with the near-bole floor (NEAR_BOLE_FLOOR) for the one column that stands
   * inside a hero frame's near field (the emergent at D's left edge, 5 m from camera D); same
   * program text but for the floor's uniform names, so a `__ATMO_UNIFORMS__` sweep of
   * `uNearBoleFloorLift` moves that bole alone
   */
  giantTreeNear: MeshStandardMaterial;
  /**
   * the near bases (giant.ts NEAR_BASE_CUT_Y): the giants' bark and leaf shading with the bark
   * floor at NEAR_BASE_FLOOR — the relief's furrows carry real occlusion, so the floor no longer
   * has to lift a shaded bole to the frames' hazed grey (it stands 2–12 m from the camera, not 10–20)
   */
  giantTreeNearBase: MeshStandardMaterial;
  /** leaf-cluster alpha cards inside the giant lobes */
  giantCanopy: MeshStandardMaterial;
  giantCanopyDepth: MeshDepthMaterial;
  distant: MeshStandardMaterial;
  /** number of distinct wind responses implemented (trunk sway, branch flex, leaf flutter) */
  windLayers: number;
  barkTextureSets: string[];
  /**
   * the near-bole LOD slots every tree program reads (see NEAR_BOLE_SLOTS): xyz = a tree's root in
   * world space, w = the local height its collapsible wood folds to (0 = slot empty). Shared by
   * every material here, so the trees system sets it once per frame.
   */
  nearBole: IUniform<Vector4[]>;
}

/** how many trees may show their near base at once (the collapse test costs one loop per vertex) */
export const NEAR_BOLE_SLOTS = 6;

/**
 * The near bases' bark floor. GIANT_BARK_FLOOR (lift 7, texture 0.1) is what makes a shaded bole
 * at 10–20 m the frames' flat hazed grey-green; at 2–12 m the same floor is what the owner sees
 * as "soft grey / soft green": every furrow lifted to its crest's level, the bark texture at a
 * tenth. The near base's furrows carry their own occlusion (bole.ts packOcclusion, applied after
 * the floor), so the floor drops to a third and keeps two thirds of the bark's own colour and
 * fissures: the cords read as bark, the furrows dark, the moss its own green.
 */
export const NEAR_BASE_FLOOR: ShadeFloor = { lift: 2.5, texture: 0.65, canopy: 1, albedo: 0.08, chroma: 0.6 };

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
function biasedMap(shader: WebGLProgramParametersWithUniforms, flatAware = false) {
  // flat cards (vLeafFlat, declared by the giant canopy material only) take the map as alpha
  const rgb = flatAware ? `mix(sampledDiffuseColor.rgb, vec3(${LEAF_FLAT_MAP_LUM.toFixed(2)}), vLeafFlat)` : 'sampledDiffuseColor.rgb';
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    /* glsl */ `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D(map, vMapUv, ${CARD_MIP_BIAS.toFixed(2)});
      #ifdef DECODE_VIDEO_TEXTURE
        sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
      #endif
      diffuseColor *= vec4(${rgb}, sampledDiffuseColor.a);
    #endif
    `,
  );
}

const WIND_VERTEX_PARS = /* glsl */ `
#define BARK_AO_LIFT ${BARK_AO_LIFT.toFixed(2)}
#define NEAR_BOLE_SLOTS ${NEAR_BOLE_SLOTS}
attribute vec3 aWind;
attribute vec4 aRoot;
uniform float uTreeStiff;
uniform float uFlex;
uniform vec4 uNearBole[NEAR_BOLE_SLOTS];
varying vec3 vTreeWorld;
varying vec2 vTreeUv;
varying float vTreeLocalY;
varying float vIsLeaf;
varying float vLeafShade;
varying float vLeafFlat;
varying float vBarkAO;
varying float vBarkMoss;
`;

const WIND_VERTEX_BODY = /* glsl */ `
  #include <begin_vertex>
  {
    vec4 treeRoot = vec4(aRoot.xyz, 1.0);
    #ifdef USE_INSTANCING
      treeRoot = instanceMatrix * treeRoot;
    #endif
    treeRoot = modelMatrix * treeRoot;
    // near-bole LOD (giant.ts NEAR_BASE_CUT_Y): the plain sweep's lower rings (aRoot.w = −1) and
    // roots (−2) fold onto one point of the axis at the cut height while their tree holds a slot
    // (its root within 5 cm of the slot's), so the near base drawn in their place never overlaps
    // them. A slot with w < 0 (the root-kit test, rootkit.ts) folds the roots only; the trunk
    // rings stay. Every other vertex is untouched.
    if (aRoot.w < -0.5) {
      for (int i = 0; i < NEAR_BOLE_SLOTS; i++) {
        float slotCut = uNearBole[i].w;
        if (abs(slotCut) > 0.5 && (slotCut > 0.0 || aRoot.w < -1.5) && distance(uNearBole[i].xyz, treeRoot.xyz) < 0.05) transformed = aRoot.xyz + vec3(0.0, abs(slotCut), 0.0);
      }
    }
    vec4 treeP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      treeP = instanceMatrix * treeP;
    #endif
    treeP = modelMatrix * treeP;
    float hAbove = max(0.0, treeP.y - treeRoot.y);
    // layer 1: whole tree sways coherently from its root (evaluated at the root so the trunk bends as one)
    vec3 disp = windBranch(treeRoot.xyz, hAbove, uTreeStiff);
    // layer 2: branches flex by their own stiffness with a per-branch phase offset
    vec3 flexP = treeP.xyz + vec3(aWind.y * 41.0, aWind.y * 7.0, aWind.y * 23.0);
    disp += windBranch(flexP, hAbove * 0.5, aWind.x) * uFlex;
    // layer 3: leaf flutter (amount is zero on wood and at the petiole so laminae stay attached);
    // a NEGATIVE amount is the near-bole bark's furrow occlusion (bole.ts packOcclusion:
    // −(0.25 + 0.75 (1 − ao))), not a flutter — decoded here, per vertex, to the bark AO factor:
    // 1.0 on every plain-sweep vertex, BARK_AO_LIFT on the relief's crests, ≈ 0.65 in its furrows
    disp += windLeaf(treeP.xyz, aWind.y, max(aWind.z, 0.0));
    float occ = -min(aWind.z, 0.0);
    vBarkAO = occ > 0.0 ? (1.0 - (occ - 0.25) / 0.75) * BARK_AO_LIFT : 1.0;
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
    // aRoot.w: 0 wood, 0.5 + 0.5 × shade-fill share for a leaf, 1.5 + 0.5 × share for a flat
    // (sunless) leaf (writer.ts) — 1.0 for every ordinary leaf, so every decode is exact there
    vIsLeaf = step(0.5, aRoot.w);
    vLeafFlat = step(1.25, aRoot.w);
    vLeafShade = clamp((aRoot.w - mix(0.5, 1.5, vLeafFlat)) * 2.0, 0.0, 1.0);
    // −0.45 × moss cover on the near bases' wood (writer.ts woodMoss); 0 on every plain vertex
    vBarkMoss = (aRoot.w < 0.0 && aRoot.w > -0.5) ? -aRoot.w / 0.45 : 0.0;
  }
`;

function injectWind(material: Material, wind: Wind, o: WindOpts, nearBole: IUniform<Vector4[]>, extra?: (shader: WebGLProgramParametersWithUniforms) => void, key = '') {
  const uTreeStiff = { value: o.treeStiffness };
  const uFlex = { value: o.flex };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTreeStiff = uTreeStiff;
    shader.uniforms.uFlex = uFlex;
    shader.uniforms.uNearBole = nearBole;
    shader.vertexShader = WIND_GLSL + WIND_VERTEX_PARS + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', WIND_VERTEX_BODY);
    extra?.(shader);
  };
  material.customProgramCacheKey = () => `trees-${key}-v6`;
  wind.bind(material);
}

const TREE_FRAGMENT_PARS = /* glsl */ `
varying vec3 vTreeWorld;
varying vec2 vTreeUv;
varying float vTreeLocalY;
varying float vIsLeaf;
varying float vLeafShade;
varying float vLeafFlat;
varying float vBarkAO;
varying float vBarkMoss;
float barkMossCover = 0.0;
uniform vec3 uLeafSun;
uniform float uLeafRough;
uniform float uLeafTransmit;
uniform float uFlatLift;
float treeHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 24.11))) * 43758.5453); }
float treeNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(treeHash(i), treeHash(i + vec3(1,0,0)), f.x), mix(treeHash(i + vec3(0,1,0)), treeHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(treeHash(i + vec3(0,0,1)), treeHash(i + vec3(1,0,1)), f.x), mix(treeHash(i + vec3(0,1,1)), treeHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

/**
 * Near-camera leaf detail (round 39, the owner's "huge single-colour flat polygons"): a lamina
 * or a cluster card within LEAF_NEAR_M[0] of the live camera shows a leaf's surface — margin,
 * veins, a cupped normal, thinner blade than veins — and by LEAF_NEAR_M[1] none of it, so the
 * six fixed cameras (nearest foliage: the lantern bough at 5.8 m from A, everything else 10 m+)
 * render the far path unchanged. The near path is a branch on `leafNear > 0.0`, not a mix:
 * outside it every far term is the same expression it was.
 */
export const LEAF_NEAR_M: [number, number] = [2.5, 6];

/**
 * A tangent frame from screen-space derivatives (three's getTangentFrame, which the leaf and
 * canopy programs do not compile — no normalMap): T runs with +u (across a lamina, across a
 * card), B with +v. The derivatives are taken unconditionally so they are defined; only the
 * frame's use is gated.
 */
const LEAF_FRAME_GLSL = /* glsl */ `
mat3 leafTangentFrame(vec3 eyePos, vec3 surfNorm, vec2 uv) {
  vec3 q0 = dFdx(eyePos);
  vec3 q1 = dFdy(eyePos);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  vec3 q1perp = cross(q1, surfNorm);
  vec3 q0perp = cross(surfNorm, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = (det == 0.0) ? 0.0 : inversesqrt(det);
  return mat3(T * scale, B * scale, surfNorm);
}
`;

/**
 * midrib + veins + translucency; the geometry is already a curved lamina so this is only surface
 * detail. Near the camera (LEAF_NEAR_M) the lamina reads as a leaf: the polygon's edge (writer.ts
 * addLeaf — widest at v 0.43, |u − 0.5| = 0.5 there, 0 at the base and tip) gets a darker margin
 * with a thin lit rim, the blade a centre-to-margin tone gradient and a fine cell mottle, the
 * secondary veins a stronger, paler line; `leafNear`, `leafEdge`, `leafMidrib`, `leafVein` feed
 * the normal cupping and the thickness (translucency) below.
 */
const LEAF_COLOR = /* glsl */ `
  float midrib = exp(-pow((vTreeUv.x - 0.5) * 70.0, 2.0));
  float vein = pow(0.5 + 0.5 * cos((vTreeUv.y * 11.0 - abs(vTreeUv.x - 0.5) * 4.0) * 6.28318), 14.0);
  float speck = sin(vTreeUv.x * 143.0 + sin(vTreeUv.y * 91.0) * 2.0) * sin(vTreeUv.y * 177.0);
  diffuseColor.rgb *= (0.92 + speck * 0.03 + midrib * 0.16 + vein * 0.05);
  leafNear = 1.0 - smoothstep(uLeafNear.x, uLeafNear.y, length(vViewPosition));
  if (leafNear > 0.0) {
    float ux = vTreeUv.x - 0.5;
    float halfW = vTreeUv.y < 0.43 ? vTreeUv.y / 0.86 : (1.0 - vTreeUv.y) / 1.14;
    leafEdge = clamp(abs(ux) / max(halfW, 1e-3), 0.0, 1.0);
    leafMidrib = exp(-pow(ux * 44.0, 2.0)) * (1.0 - smoothstep(0.85, 1.0, vTreeUv.y));
    leafVein = pow(0.5 + 0.5 * cos((vTreeUv.y * 9.0 - abs(ux) * 3.2) * 6.28318), 9.0) * (1.0 - leafMidrib) * (1.0 - smoothstep(0.8, 1.0, leafEdge));
    float margin = smoothstep(0.7, 1.0, leafEdge);
    float rim = smoothstep(0.9, 0.985, leafEdge) - smoothstep(0.985, 1.0, leafEdge);
    float cells = treeNoise(vTreeWorld * 90.0) * 0.6 + treeNoise(vTreeWorld * 260.0) * 0.4;
    // the detail as a factor on the leaf's light, applied after the shade floor (LEAF_NEAR_MUL):
    // in the canopy's shade the floor sets a leaf's level and keeps only 0.4 of its albedo's
    // variation (LEAF_FLOOR texture), which left the margin and the veins at 1–2 sRGB levels
    vec3 detail = vec3(1.0 + 0.12 * (1.0 - leafEdge) - 0.3 * margin + (cells - 0.5) * 0.16);
    detail = mix(detail, detail * vec3(1.3, 1.26, 0.9), leafVein * 0.6 + leafMidrib * 0.55);
    detail = mix(detail, detail * 1.5 + vec3(0.04), rim * 0.75);
    leafNearMul = mix(vec3(1.0), detail, leafNear);
  }
`;
/** declared by both tree programs before their leaf blocks; zero / 1.0 on the far path */
const LEAF_NEAR_PARS = /* glsl */ `
uniform vec2 uLeafNear;
float leafNear = 0.0;
float leafEdge = 0.0;
float leafMidrib = 0.0;
float leafVein = 0.0;
float leafThin = 1.0;
vec3 leafNearMul = vec3(1.0);
`;
/**
 * The near detail on the leaf's outgoing light, after every floor: a factor of 1.0 on the far
 * path (leafNearMul is only written on `leafNear > 0.0`), so the far arithmetic is unchanged.
 */
const LEAF_NEAR_MUL = /* glsl */ `
      reflectedLight.directDiffuse *= leafNearMul;
      reflectedLight.indirectDiffuse *= leafNearMul;
`;
/**
 * The lamina's normal near the camera: cupped across the blade (the tilt grows with |u − 0.5|),
 * a groove along the midrib, a ripple over the veins — in the frame from the screen derivatives,
 * blended by `leafNear` (an exact no-op at 0).
 */
const LEAF_NEAR_NORMAL = /* glsl */ `
    if (vIsLeaf > 0.5 && leafNear > 0.0) {
      mat3 leafTbn = leafTangentFrame(-vViewPosition, normal, vTreeUv);
      float ux = vTreeUv.x - 0.5;
      vec3 bent = normal + leafTbn[0] * (ux * 0.9 - sign(ux) * leafMidrib * 0.45) + leafTbn[1] * (leafVein * 0.18 - leafMidrib * 0.12);
      normal = normalize(mix(normal, normalize(bent), leafNear));
      // thickness: the blade thin, the midrib and veins and the margin thick
      leafThin = mix(1.0, 0.7 + 0.75 * (1.0 - leafMidrib * 0.7 - leafVein * 0.45 - smoothstep(0.8, 1.0, leafEdge) * 0.5), leafNear);
    }
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
  #ifdef NEAR_BASE_DETAIL
  // 1–3 m (the near bases' own program): smaller crusts with a soft edge, not the 4–10 m flecks
  // whose cluster contours read as scribbles at that range
  float lichenFleck = smoothstep(0.56, 0.7, treeNoise(vTreeWorld * 34.0) * 0.55 + treeNoise(vTreeWorld * 95.0 + 3.0) * 0.45);
  #else
  float lichenFleck = smoothstep(0.6, 0.7, treeNoise(vTreeWorld * 22.0) * 0.7 + treeNoise(vTreeWorld * 55.0 + 3.0) * 0.3);
  #endif
  float lichen = lichenCluster * lichenFleck * foot * (1.0 - moss);
  vec3 lichenColor = mix(vec3(0.46, 0.5, 0.38), vec3(0.55, 0.56, 0.48), treeNoise(vTreeWorld * 4.0 + 9.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, lichenColor, lichen * 0.6);
  // moss cushions and small plant tufts: 10–20 cm, rare, on the sides of the bole (not on the
  // moss sheets), a shaded rim under each so they sit in the bark instead of on it. A first cut at
  // 40 cm in a yellow-green with a hard dark outline read as leaves stuck to the trunk
  float tuftN = treeNoise(vTreeWorld * 7.5 + 17.0) * 0.7 + treeNoise(vTreeWorld * 21.0 + 2.0) * 0.3;
  float tuftSide = foot * (1.0 - smoothstep(0.55, 0.9, up)) * (1.0 - sheet);
  #ifdef NEAR_BASE_DETAIL
  // 1–3 m: the tufts are moss cushions — soft-edged, textured, the darker greens of the concept's
  // mossy trunk — where the 4–10 m version's hard bright discs read as leaves stuck to the bark
  float tuftFine = treeNoise(vTreeWorld * 48.0 + 7.0) * 0.6 + treeNoise(vTreeWorld * 140.0) * 0.4;
  float tuftCore = smoothstep(0.7, 0.82, tuftN + (tuftFine - 0.5) * 0.08) * tuftSide;
  float tuftRim = (smoothstep(0.66, 0.7, tuftN) - smoothstep(0.7, 0.82, tuftN)) * tuftSide;
  vec3 tuftColor = mix(vec3(0.13, 0.22, 0.06), vec3(0.26, 0.38, 0.11), tuftFine);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7, tuftRim * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, tuftColor, tuftCore * 0.9);
  #else
  float tuftCore = smoothstep(0.74, 0.8, tuftN) * tuftSide;
  float tuftRim = (smoothstep(0.7, 0.74, tuftN) - smoothstep(0.74, 0.8, tuftN)) * tuftSide;
  vec3 tuftColor = mix(vec3(0.27, 0.4, 0.12), vec3(0.36, 0.5, 0.15), treeNoise(vTreeWorld * 13.0 + 31.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, tuftRim * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, tuftColor, tuftCore * 0.85);
  #endif
  float tone = treeNoise(vec3(vTreeWorld.x * 0.08, vTreeWorld.y * 0.15, vTreeWorld.z * 0.08));
  diffuseColor.rgb *= 0.86 + tone * 0.28;
  // the near bases' moss (bole.ts, per vertex in vBarkMoss): sheets on the shaded foot, in the
  // furrows and over the root tops — laid over the bark as moss, with its own fine texture;
  // it also flattens the bark normal and roughens the surface (see the normal and roughness
  // blocks). Zero on every plain vertex.
  if (vBarkMoss > 0.0) {
    float mossFine = treeNoise(vTreeWorld * 38.0) * 0.6 + treeNoise(vTreeWorld * 110.0 + 11.0) * 0.4;
    // cushions with ragged edges: the cover needs both a strong per-vertex moss AND the fine
    // noise, so bark shows between the cushions (a 0.12–0.7 threshold greened whole boles)
    barkMossCover = smoothstep(0.34, 0.82, vBarkMoss * (0.5 + 0.95 * mossFine));
    vec3 mossCushion = mix(vec3(0.09, 0.16, 0.04), vec3(0.24, 0.36, 0.10), mossFine);
    diffuseColor.rgb = mix(diffuseColor.rgb, mossCushion, barkMossCover * 0.92);
  }
`;

/**
 * Sky light through the lamina. A leaf is thin: the face turned away from the viewer is lit by
 * the hemisphere (and the environment) it faces, and a share of that comes through, tinted toward
 * the sunlit leaf colour (chlorophyll passes yellow-green). This is what lifts the undersides of
 * the near crowns (6–21 m in shot A) from opaque dark cut-outs toward the reference's glowing
 * backlit roof (A top band p10 0.39 against our 0.29 without it). Wood never gets it (gated on
 * vIsLeaf by the callers; the cluster cards are all leaf). The sun's own transmission stays the
 * separate directional term below, so this adds nothing sun-dependent in the shadowed crown.
 *
 * Scaled by vLeafShade (1 on every leaf but the authored shade lobes' — see writer.ts aRoot.w):
 * the fill terms a leaf gets for being thin and under a roof (this transmission, the ambient
 * fill, the flat shade floor) are what keep a shaded lamina at ≈ 0.36 luminance, so a lobe meant
 * to read as the reference's dark near clump (D's top-right mass 0.26–0.30 at 10 m, hazed) can
 * only get there by taking a share of them — and of the sun's transmission through the lamina
 * (the directional term below); the Lambert sun on the leaf's face is untouched.
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
    reflectedLight.indirectDiffuse += skyThrough * BRDF_Lambert(through) * (uLeafTransmit * vLeafShade * leafThin);
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
 * Flat leaves (writer.ts leafFlat, aRoot.w ≥ 1.25 — the round-38 bank canopy's lobes, CanopyLobe
 * `flat`): the reference's near canopy underside (frame 44 s's top-right mass over the stair bank,
 * frame 38 s's top-left) is deep shade — opaque, 0.25–0.31, and EVEN: its 8 × 8 windows at the
 * gauntlet's 256 × 144 have sd 0.01–0.02. SSIM's structure term is (2 cov + C2) / (va + vb + C2)
 * with C2 = 9e-4 ≈ (0.03)², so against such a window any texture of ours with sd ≥ 0.03 halves the
 * term however right the mean is (round 38 v1: laminae sprays at tone 0.45 over the bank landed
 * the cells' means within 0.02 of the frame and cost C −0.011 / F −0.009 — window sd 0.03–0.05).
 * What varies across a lit leaf mass at 40 px is the sun: Lambert on the leaves' faces, its
 * transmission, the crown's dapple on both. A flat leaf gets none of it — only the hemisphere,
 * the ambient fill, the sky transmission and the shade floor (the last three by vLeafShade) —
 * and `uFlatLift` scales that remainder as one level for the whole mass (probe-swept through
 * `__ATMO_UNIFORMS__` so the level is measured, not guessed). The sun is dropped BEFORE the floor
 * block (whose test of what the fragment already has would otherwise count it and not lift), the
 * level applied after it, so the lift is a plain multiplier on everything a flat leaf shows.
 */
/**
 * Swept on shots F and C (probe round 38 v3, bank canopy at tone 0.6 / shade 0.4; the mass's
 * core cells against frame 8 s's 0.25–0.30): 0.6 → 0.19–0.20 (F −0.0074 / C −0.0001 against the
 * control), 1.0 → 0.22–0.23 (F −0.0028 / C +0.0022), 1.5 → 0.26–0.27 (F +0.0021 / C +0.0023),
 * 2.2 → 0.31–0.32 (F +0.0046 with the v3 lobes spilling into F's top row, C 0.0000). The core
 * level runs ≈ 0.14 + 0.08 × lift (1.8 measured 0.29–0.31 in the v4 capture). At these levels
 * the luminance term moves 0.03 per 0.03 of mean, so the level is set to the frame, not near it.
 * Re-swept on the cored lobes that shipped (giant.ts lobeCore, v7d): 1.2 → F +0.0159 / C +0.0026,
 * 1.5 → F +0.0158 / C +0.0033, 2.0 (v7a) → F −0.0017 / C −0.0006 against 1.5.
 */
const LEAF_FLAT_LIFT = 1.5;
/**
 * A flat leaf's own light is the hemisphere's MEAN (sky + ground over two) on its albedo, not
 * the hemisphere at its normal: the cards of a lobe carry normals pointing out of it (so a lit
 * lobe shades as one volume), which under sky-over-ground lighting made the upward cards a grey
 * two shades lighter than the downward ones — patches of 1–1.7 m, one to two SSIM windows each,
 * across the mass (probe round 38 v3: window sd 0.03–0.04 inside the body).
 */
const LEAF_FLAT_SUNLESS = /* glsl */ `
      reflectedLight.directDiffuse *= 1.0 - vLeafFlat;
      reflectedLight.directSpecular *= 1.0 - vLeafFlat;
      #if NUM_HEMI_LIGHTS > 0
      {
        vec3 flatAmbient = (hemisphereLights[0].skyColor + hemisphereLights[0].groundColor) * 0.5;
        reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, flatAmbient * BRDF_Lambert(diffuseColor.rgb), vLeafFlat);
      }
      #endif
`;
/**
 * The cluster texture's leaves span 0.55–1.1 of the card's colour (leaf-cluster-texture.ts: back
 * leaves dark, front leaves toward the sun colour, a lit half on each): on a flat card that range
 * is texture at 2–5 px per leaf at 12 m. The map is alpha only there; its opaque mean (≈ 0.8 of
 * the card colour) stands in so the level does not jump from the lit cards'.
 */
export const LEAF_FLAT_MAP_LUM = 0.8;
const LEAF_FLAT_LEVEL = /* glsl */ `
      reflectedLight.indirectDiffuse *= mix(1.0, uFlatLift, vLeafFlat);
`;

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
/**
 * The leaf shade floor scaled by vLeafShade (see LEAF_SKY_TRANSMISSION): the floor block adds to
 * indirectDiffuse, so its addition is taken back in proportion — mix(before, after, 1.0) is
 * exactly `after`, so ordinary leaves keep their arithmetic.
 */
const LEAF_FLOOR_SHADED = /* glsl */ `
      {
        vec3 beforeFloor = reflectedLight.indirectDiffuse;
        ${shadeFloorGlsl('uLeafFloor', TREE_FLOOR_GLSL)}
        reflectedLight.indirectDiffuse = mix(beforeFloor, reflectedLight.indirectDiffuse, vLeafShade);
      }
`;
/** white-barks are pale already; their shaded sides are not among the measured gaps */
const WHITE_BARK_FLOOR: ShadeFloor = { lift: 0, texture: 1, canopy: 0, albedo: 0.08, chroma: 1 };
/**
 * The near bole (the emergent column at D's left edge, 5 m from camera D; B sees it at 8 m on
 * its left edge): frame 56 s has hazy mid-distance foliage at D x 0–0.09 (p50 0.41), ours a
 * shaded bole pinned at the giants' floor (0.29 — its vertex colour does not reach the pixel,
 * see index.ts COLUMN_SEATS). The floor level is the only term of a shaded face at 5 m, so the
 * bole's own floor is the lever. Round-32 sweep of the lift (D x 0–0.09, y 0.1–0.7 p50 / D SSIM
 * / B SSIM): 7 → 0.292 / 0 / 0; 9 → 0.332 / +0.002 / −0.002; 11 → 0.369 / +0.003 / −0.003;
 * 13 → 0.403 / +0.003 / −0.003 — the frame's 0.407 at 13, B paying the same at 11 and 13 (its
 * left edge is a dark near trunk in frame 14 s, our bole a hazed column either way). Texture
 * 0.25 as measured — the giants' 0.1 was not swept on this bole.
 */
export const NEAR_BOLE_FLOOR: ShadeFloor = { lift: 13, texture: 0.25, canopy: 1, albedo: 0.08, chroma: 0.5 };
/**
 * Round 36: the near bole's floor is the ground's — the low mist and the bounce off the lit
 * verge and paving that a column standing on the path's edge gets at its foot, not up its length
 * — so it fades with height above the seat: the full lift below NEAR_BOLE_FLOOR_FADE[0] (local
 * metres), NEAR_BOLE_FLOOR_TOP (the giants' own lift, less one) from NEAR_BOLE_FLOOR_FADE[1] up,
 * smoothstep between. What the two cameras frame of this bole (the emergent column at (−3.1,
 * −7.9), 5.9 m from D, 10.4 m from B, its east face at depth 4.6 / 8.6 m): camera D's strip
 * (x 0–0.09, y 0.1–0.7) is the bole 0.8–3.2 m up, where frame 56 s has hazy mid-distance foliage
 * (y 0.35–0.7 = 0.8–2.2 m: 0.455) under a dark near trunk (y 0–0.35 = 2.2–3.65 m: 0.375); camera
 * B's (x 0–0.06, y 0.08–0.6) is 0.9–4.7 m up, frame 14 s's dark near trunk (y 0–0.3 = 3.1–5.3 m:
 * 0.291, y 0.3–0.6 = 0.9–3.1 m: 0.241 with the Kokiri kid in front). One flat lift 13 read
 * 0.41–0.44 in both — over D's top band by 0.07 and over B's whole strip by 0.12–0.17. The two
 * frames want the same heights differently below 2.2 m (D bright, B dark) and agree above it, so
 * the fade keeps the foot for D and darkens the part both frames want dark. The two cameras see
 * the same south-east face of the column (their bearings from it are 17° apart; from the column,
 * D sees azimuths 45–114°, B 17–101°), so no azimuthal shade share separates them — height does.
 * Calibration (fade 2.0–3.5 → lift 6, A/B/D capture): B's trunk top band 0.414 → 0.322 for a
 * mean lift ≈ 6.2, i.e. ≈ 0.0135 per unit of lift with the bare bark at ≈ 0.24; D's top band
 * 0.441 → 0.426, D's strip 0.432 → 0.428 (frame 0.413). Fade 1.8–3.2 → lift 5 puts B's top band
 * near 0.30 (frame 0.291) and D's top band near 0.33 (frame 0.375) with D's strip median still at
 * the foot's lift (its median height, 2.0 m, is under the fade's midpoint).
 */
export const NEAR_BOLE_FLOOR_TOP = 5;
export const NEAR_BOLE_FLOOR_FADE: [number, number] = [1.8, 3.2];

/**
 * `barkPrefix` names the bark floor's uniforms: the giants' `uBarkFloor` (GIANT_BARK_FLOOR), the
 * white-barks' `uWhiteBarkFloor` (lift 0) — distinct so a `__ATMO_UNIFORMS__` sweep of
 * `uBarkFloorLift` moves the giants alone and never gives the white-barks a floor they do not have.
 */
/**
 * The bark floor block with its lift scaled by a height profile (see NEAR_BOLE_FLOOR_FADE): the
 * shared block reads `${u}Lift` by name, so the profile is spliced onto that one read. Throws if
 * the shared block's text no longer carries it, rather than silently shipping a flat floor.
 */
function heightFadedFloorGlsl(u: string): string {
  const block = shadeFloorGlsl(u, TREE_FLOOR_GLSL);
  const read = `${u}Lift * ambientMean`;
  if (!block.includes(read)) throw new Error(`shadeFloorGlsl: expected '${read}' in the floor block`);
  return /* glsl */ `
      {
        float floorHeightShare = 1.0 - smoothstep(${u}FadeY.x, ${u}FadeY.y, vTreeLocalY);
        float floorLiftHere = mix(${u}TopLift, ${u}Lift, floorHeightShare);
        ${block.replace(read, `floorLiftHere * ambientMean`)}
      }
`;
}

function treeFragment(shader: WebGLProgramParametersWithUniforms, sun: Color, leafRoughness: number, barkColor: string, barkFloor: ShadeFloor, barkPrefix = 'uBarkFloor', heightFade?: { top: number; fade: [number, number] }, nearDetail = false) {
  shader.uniforms.uLeafSun = { value: sun };
  shader.uniforms.uLeafRough = { value: leafRoughness };
  shader.uniforms.uLeafTransmit = { value: LEAF_TRANSMIT };
  shader.uniforms.uFlatLift = { value: LEAF_FLAT_LIFT };
  shader.uniforms.uLeafNear = { value: new Vector2(LEAF_NEAR_M[0], LEAF_NEAR_M[1]) };
  bindShadeFloor(shader, barkPrefix, barkFloor);
  bindShadeFloor(shader, 'uLeafFloor', LEAF_FLOOR);
  let fadePars = '';
  if (heightFade) {
    shader.uniforms[`${barkPrefix}TopLift`] = { value: heightFade.top };
    shader.uniforms[`${barkPrefix}FadeY`] = { value: new Vector2(heightFade.fade[0], heightFade.fade[1]) };
    fadePars = `uniform float ${barkPrefix}TopLift;\nuniform vec2 ${barkPrefix}FadeY;\n`;
  }
  // near wood (the lobe stems and twigs the owner stands among, within LEAF_NEAR_M): the floor
  // keeps at least half of the bark's own texture instead of the far tenth, so a shaded stem at
  // 1–3 m shows its grain along its length rather than one flat tone; the level (the floor's
  // mean albedo) does not move. `woodNear` is 0 past LEAF_NEAR_M[1] — mix(a, b, 0.0) is exactly a.
  const textureRead = `${barkPrefix}Texture)`;
  const floorBlock = heightFade ? heightFadedFloorGlsl(barkPrefix) : shadeFloorGlsl(barkPrefix, TREE_FLOOR_GLSL);
  if (!floorBlock.includes(textureRead)) throw new Error(`shadeFloorGlsl: expected '${textureRead}' in the floor block`);
  const barkFloorGlsl = /* glsl */ `
      float woodNear = 1.0 - smoothstep(uLeafNear.x, uLeafNear.y, length(vViewPosition));
      ${floorBlock.replace(textureRead, `mix(${barkPrefix}Texture, max(${barkPrefix}Texture, 0.5), woodNear))`)}
`;
  shader.fragmentShader = (nearDetail ? '#define NEAR_BASE_DETAIL\n' : '') + TREE_FRAGMENT_PARS + LEAF_NEAR_PARS + LEAF_FRAME_GLSL + shadeFloorPars(barkPrefix, TREE_FLOOR_GLSL) + fadePars + shadeFloorPars('uLeafFloor', TREE_FLOOR_GLSL) + shader.fragmentShader;
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
    roughnessFactor = mix(roughnessFactor, 1.0, barkMossCover);
    `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <normal_fragment_maps>',
    /* glsl */ `#include <normal_fragment_maps>
    normal = normalize(mix(normal, nonPerturbedNormal, max(vIsLeaf, barkMossCover * 0.8)));
    ${LEAF_NEAR_NORMAL}
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
      reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.08 * vLeafShade);
      ${LEAF_SKY_TRANSMISSION}
      #if NUM_DIR_LIGHTS > 0
      {
        float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
        float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.45 + backlight * 0.65;
        vec3 sunTint = mix(diffuseColor.rgb, uLeafSun, 0.5);
        reflectedLight.directDiffuse += sunTint * directLight.color * transmission * (0.22 * vLeafShade * leafThin);
      }
      #endif
      ${LEAF_FLAT_SUNLESS}
      ${LEAF_FLOOR_SHADED}
      ${LEAF_FLAT_LEVEL}
      ${LEAF_NEAR_MUL}
    } else {
      ${barkFloorGlsl}
      // near-bole furrow occlusion (bole.ts, carried in aWind.z): the floor lifts a shaded
      // furrow to the same flat grey as its crest, so the occlusion is applied after it — the
      // ambient and the floor fully, the sun by half (a 10 cm furrow's floor is part-shadowed).
      // 1.0 on every vertex the plain sweeps write, so nothing else moves.
      reflectedLight.indirectDiffuse *= vBarkAO;
      reflectedLight.directDiffuse *= mix(1.0, vBarkAO, 0.5);
    }
    `,
  );
}

export async function createTreeMaterials(ctx: WorldContext): Promise<TreeMaterials> {
  const wind = ctx.wind;
  const palette = ctx.config.palette;
  const leafSun = new Color(palette.leafSun);
  const nearBole: IUniform<Vector4[]> = { value: Array.from({ length: NEAR_BOLE_SLOTS }, () => new Vector4(0, 0, 0, 0)) };

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
  injectWind(whiteTree, wind, whiteWind, nearBole, (s) => treeFragment(s, leafSun, 0.72, WHITE_BARK_COLOR, WHITE_BARK_FLOOR, 'uWhiteBarkFloor'), 'white');
  const whiteTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(whiteTreeDepth, wind, whiteWind, nearBole, undefined, 'white-depth');

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
  injectWind(giantTree, wind, giantWind, nearBole, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, GIANT_BARK_FLOOR), 'giant');
  const giantTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(giantTreeDepth, wind, giantWind, nearBole, undefined, 'giant-depth');
  // the near bole's copy: same maps and wind, its own floor uniforms (clone() carries no hooks)
  const giantTreeNear = giantTree.clone();
  injectWind(giantTreeNear, wind, giantWind, nearBole, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, NEAR_BOLE_FLOOR, 'uNearBoleFloor', { top: NEAR_BOLE_FLOOR_TOP, fade: NEAR_BOLE_FLOOR_FADE }), 'giant-near');
  // the near bases' copy: same maps and wind, the bark floor at NEAR_BASE_FLOOR
  const giantTreeNearBase = giantTree.clone();
  giantTreeNearBase.normalScale.set(2.0, 2.0);
  injectWind(giantTreeNearBase, wind, giantWind, nearBole, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, NEAR_BASE_FLOOR, 'uNearBaseFloor', undefined, true), 'giant-near-base');

  // --- giant canopy cluster cards (procedural alpha texture; dappled shadows through the alpha) ---
  const cluster = createLeafClusterTexture(ctx.rng.fork('trees/leaf-cluster'), palette);
  // the near pair (same fork → same 110 leaves; see createLeafClusterDetail), 1024 on high, 512 below
  const clusterNear = createLeafClusterDetail(ctx.rng.fork('trees/leaf-cluster'), palette, ctx.quality.tier === 'high' || ctx.quality.tier === 'ultra' ? 1024 : 512);
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
    nearBole,
    (s) => {
      s.uniforms.uLeafSun = { value: leafSun };
      s.uniforms.uLeafTransmit = { value: LEAF_TRANSMIT };
      s.uniforms.uFlatLift = { value: LEAF_FLAT_LIFT };
      s.uniforms.uLeafNear = { value: new Vector2(LEAF_NEAR_M[0], LEAF_NEAR_M[1]) };
      s.uniforms.uClusterNear = { value: clusterNear.color };
      s.uniforms.uClusterNearN = { value: clusterNear.normal };
      bindShadeFloor(s, 'uLeafFloor', LEAF_FLOOR);
      s.fragmentShader =
        `varying vec3 vTreeWorld;\nvarying vec2 vTreeUv;\nvarying float vTreeLocalY;\nvarying float vIsLeaf;\nvarying float vLeafShade;\nvarying float vLeafFlat;\nuniform vec3 uLeafSun;\nuniform float uLeafTransmit;\nuniform float uFlatLift;\nuniform sampler2D uClusterNear;\nuniform sampler2D uClusterNearN;\nvec4 cardNearN = vec4(0.5, 0.5, 1.0, 0.0);\n` +
        LEAF_NEAR_PARS +
        LEAF_FRAME_GLSL +
        shadeFloorPars('uLeafFloor', TREE_FLOOR_GLSL) +
        s.fragmentShader;
      // the 512 map as before; within LEAF_NEAR_M the near pair takes over: its coverage blends
      // into the alpha (a card's leaves grow their margins as the camera comes in) and its
      // colour becomes a factor on the card's light after the shade floor (LEAF_NEAR_MUL) —
      // relative to the 512 map's mean, so a lit card keeps its level and a shaded card, whose
      // level the floor sets, still shows the leaves, veins and lit rims the floor would have
      // flattened to 0.4 of their contrast. Flat cards (vLeafFlat) keep the map as alpha only
      // at distance; near, they show the same leaves through the factor.
      s.fragmentShader = s.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D(map, vMapUv, ${CARD_MIP_BIAS.toFixed(2)});
          leafNear = 1.0 - smoothstep(uLeafNear.x, uLeafNear.y, length(vViewPosition));
          if (leafNear > 0.0) {
            vec4 nearColor = texture2D(uClusterNear, vMapUv, ${CARD_MIP_BIAS.toFixed(2)});
            cardNearN = texture2D(uClusterNearN, vMapUv, ${CARD_MIP_BIAS.toFixed(2)});
            vec3 nearDetail = clamp(nearColor.rgb / vec3(${LEAF_FLAT_MAP_LUM.toFixed(2)}), 0.45, 1.9);
            leafNearMul = mix(vec3(1.0), nearDetail, leafNear);
            // the albedo goes to the map's mean as the factor takes the detail over (a lit card
            // at leafNear 1 is colour × near map exactly, as the albedo path would be)
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(${LEAF_FLAT_MAP_LUM.toFixed(2)}), leafNear);
            sampledDiffuseColor.a = mix(sampledDiffuseColor.a, nearColor.a, leafNear);
          }
          diffuseColor *= vec4(mix(sampledDiffuseColor.rgb, vec3(${LEAF_FLAT_MAP_LUM.toFixed(2)}), vLeafFlat), sampledDiffuseColor.a);
        #endif
        `,
      );
      // per-leaf normals from the near map (RG: tangent-space xy, the blade cupped and tilted per
      // leaf) and its thickness (B) as the translucency term, both by leafNear
      s.fragmentShader = s.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        if (leafNear > 0.0) {
          mat3 cardTbn = leafTangentFrame(-vViewPosition, normal, vMapUv);
          vec3 mapN = vec3(cardNearN.xy * 2.0 - 1.0, 0.0);
          mapN.z = sqrt(max(0.0, 1.0 - dot(mapN.xy, mapN.xy)));
          normal = normalize(mix(normal, normalize(cardTbn * mapN), leafNear * (1.0 - vLeafFlat)));
          leafThin = mix(1.0, 0.55 + 0.9 * cardNearN.b, leafNear);
        }
        `,
      );
      s.fragmentShader = s.fragmentShader.replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.1 * vLeafShade);
        ${LEAF_SKY_TRANSMISSION}
        #if NUM_DIR_LIGHTS > 0
        {
          float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
          float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.4 + backlight * 0.6;
          reflectedLight.directDiffuse += mix(diffuseColor.rgb, uLeafSun, 0.5) * directLight.color * transmission * (0.2 * vLeafShade * leafThin);
        }
        #endif
        ${LEAF_FLAT_SUNLESS}
        ${LEAF_FLOOR_SHADED}
        ${LEAF_FLAT_LEVEL}
        ${LEAF_NEAR_MUL}
        `,
      );
    },
    'giant-canopy',
  );
  const giantCanopyDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide, map: cluster, alphaTest: CARD_ALPHA_TEST });
  injectWind(giantCanopyDepth, wind, giantWind, nearBole, biasedMap, 'giant-canopy-depth');

  // --- distant trees: leaf-cluster cards + solid trunks/cores (uv on the opaque patch); fog tints ---
  const distant = new MeshStandardMaterial({ map: cluster, alphaTest: CARD_ALPHA_TEST, vertexColors: true, roughness: 0.95, metalness: 0, side: DoubleSide });
  distant.onBeforeCompile = (s) => biasedMap(s);
  distant.customProgramCacheKey = () => 'trees-distant-biased';

  return {
    whiteTree,
    whiteTreeDepth,
    giantTree,
    giantTreeDepth,
    giantTreeNear,
    giantTreeNearBase,
    giantCanopy,
    giantCanopyDepth,
    distant,
    windLayers: 3,
    barkTextureSets: [barkSet, 'procedural:whitebark', 'procedural:leaf-cluster', 'procedural:leaf-cluster-near'],
    nearBole,
  };
}
