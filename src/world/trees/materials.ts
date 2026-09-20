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
  Vector3,
  Vector4,
  type IUniform,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { WIND_GLSL, type Wind } from '../wind/wind';
import { GIANT_BARK_FLOOR as SHARED_BARK_FLOOR, LEAF_FLOOR as SHARED_LEAF_FLOOR, bindShadeFloor, shadeFloorGlsl, shadeFloorPars, type ShadeFloor, type ShadeFloorGlslOptions } from '../materials/shadeFloor';
import type { WorldContext } from '../system';
import { createWhiteBarkTextures } from './bark-texture';
import { createLeafClusterDetail, createLeafClusterTexture } from './leaf-cluster-texture';
import { BARK_AO_LIFT } from './bole';
import { CUSHION_ROOT_W, CUSHION_ROOT_W_PER_M } from './writer';
import { DISTANT_NEAR_GAIN } from './distant';

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
   * round 45: the column trees' copy (column.ts, 12–45 m from the hero cameras) with the bark
   * floor at COLUMN_BARK_FLOOR — the shared floor keeps a tenth of the bark's own albedo in
   * shade, which at 15–30 m in haze made every column a pale even cylinder (trees-27's
   * leftover); this one keeps 0.45 of it, so the cord / furrow tone bands and the base grime the
   * column bole is coloured with survive the floor and give the haze contrast to work on. The
   * emergent keeps giantTreeNear.
   */
  columnTree: MeshStandardMaterial;
  /**
   * the near bases (giant.ts NEAR_BASE_CUT_Y): the giants' bark and leaf shading with the bark
   * floor at NEAR_BASE_FLOOR — the relief's furrows carry real occlusion, so the floor no longer
   * has to lift a shaded bole to the frames' hazed grey (it stands 2–12 m from the camera, not 10–20)
   */
  giantTreeNearBase: MeshStandardMaterial;
  /**
   * the near-canopy parts (giant.ts NEAR_CANOPY_IN_M): the giants' bark and leaf shading with
   * the sun read through the laminae from below (NEAR_CANOPY_SUN_THROUGH), the leaf detail
   * (margin, veins, cupped normal) out to NEAR_CANOPY_LEAF_NEAR_M, and the near leaf floor
   * (NEAR_CANOPY_LEAF_FLOOR); the bark floor is the trees' (TREE_BARK_FLOOR)
   */
  giantTreeNearCanopy: MeshStandardMaterial;
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
  /**
   * the near-canopy LOD slots every tree COLOUR program reads (see NEAR_CANOPY_SLOTS): xyz = a
   * tree's root in world space, w = 3 + the swap group of a lobe of it whose near version is
   * drawn (writer.ts leafSwapGroup; 0 = slot empty). The far laminae and cards tagged with that
   * group fold to the tree's root in the colour pass; the depth programs read an empty set, so
   * the shadows never change. Shared by every material here.
   */
  nearCanopy: IUniform<Vector4[]>;
}

/** how many trees may show their near base at once (the collapse test costs one loop per vertex) */
export const NEAR_BOLE_SLOTS = 6;
/** how many near-canopy lobes may be shown at once (the collapse test runs on the tagged leaf vertices only) */
export const NEAR_CANOPY_SLOTS = 40;

/**
 * Owner sheet 05: exposed wood stays warm grey/umber beside moss, including in shade. The
 * old leaf-filtered, 90%-grey bark floor turned both into the same olive surface. Keep more
 * of the existing bark/moss albedo at walking and middle distance, with only a small green
 * bounce. Floor levels and distance fades stay as calibrated; leaf floors stay independent.
 */
export const TREE_BARK_FLOOR: ShadeFloor = { ...SHARED_BARK_FLOOR, texture: 0.55, canopy: 0.18, chroma: 0.8 };
export const TREE_LEAF_FLOOR: ShadeFloor = { ...SHARED_LEAF_FLOOR };
export const TREE_BARK_FLOOR_NEAR: ShadeFloor = { ...TREE_BARK_FLOOR, lift: 5.5, texture: 0.7 };
/**
 * The column trees' bark floor (TreeMaterials.columnTree) within COLUMN_FLOOR_FADE_M[0]: a little
 * under the shared lift so a shaded column sits under the haze rather than in it, and 0.7 of its
 * own albedo kept — the columns are coloured for distance (column.ts: tone bands around and along
 * the bole, grime at the foot), and the shared tenth flattened all of it beyond 10 m. The survey
 * poses that found them pale (w19-spine-r, sn-arch-outside) stand 10–21 m from the north cluster.
 */
export const COLUMN_BARK_FLOOR: ShadeFloor = { ...TREE_BARK_FLOOR, lift: 6.2, texture: 0.7 };
/**
 * … and from COLUMN_FLOOR_FADE_M[1] out: keep 0.55 of the same albedo so the moss and bare
 * plates remain distinct through the haze. The older 0.2 preserved the soft video frames
 * but flattened the material separation requested in the owner's foliage/bark reference.
 * The bark block alone fades (LeafVariant.barkFade); the columns' leaf floor is the shared one.
 */
export const COLUMN_BARK_FLOOR_FAR: ShadeFloor = { ...TREE_BARK_FLOOR, lift: 6.6, texture: 0.55 };
/** view distance (m) over which the column bark floor goes from COLUMN_BARK_FLOOR to COLUMN_BARK_FLOOR_FAR */
export const COLUMN_FLOOR_FADE_M: [number, number] = [20, 32];
export const TREE_LEAF_FLOOR_NEAR: ShadeFloor = { ...SHARED_LEAF_FLOOR, lift: 4.5, texture: 0.6 };
/** view distance (m) over which a far program's floor goes from its NEAR preset to its far preset */
export const TREE_FLOOR_FADE_M: [number, number] = [5, 10];
/**
 * The near canopy's leaf floor (giant.ts NEAR_CANOPY_IN_M): the laminae the owner looks up at
 * from 3–20 m. Lower again than the trees' — the sun read through the leaves and the shadow of
 * the crown above are what should set a near leaf's level (dark where the canopy is thick, lit
 * where the sun is behind it), not a floor.
 */
export const NEAR_CANOPY_LEAF_FLOOR: ShadeFloor = { ...SHARED_LEAF_FLOOR, lift: 3.2, texture: 0.75 };
/** the near canopy's leaf detail range (m): see LEAF_NEAR_M; a 20 cm lamina is ≈ 15 px at 15 m */
export const NEAR_CANOPY_LEAF_NEAR_M: [number, number] = [7, 18];
/**
 * The sun through the near laminae (see the near-canopy block in treeFragment): the scale on
 * the underside + backlight transmission. The far programs' term is 0.22 with the underside
 * weighted 0.45; here the underside carries 0.9 (the leaf is seen from below, the sun behind it)
 * and the block is scaled by this uniform (`uSunThrough`, probe-able through __ATMO_UNIFORMS__).
 */
export const NEAR_CANOPY_SUN_THROUGH = 0.3;

/**
 * The near bases' bark floor. GIANT_BARK_FLOOR (lift 7, texture 0.1) is what makes a shaded bole
 * at 10–20 m the frames' flat hazed grey-green; at 2–12 m the same floor is what the owner sees
 * as "soft grey / soft green": every furrow lifted to its crest's level, the bark texture at a
 * tenth. The near base's furrows carry their own occlusion (bole.ts packOcclusion, applied after
 * the floor), so the floor drops to a third and keeps three quarters of the bark's own colour and
 * fissures: the cords read as bark, the furrows dark, the moss its own green.
 */
export const NEAR_BASE_FLOOR: ShadeFloor = { lift: 2.5, texture: 0.75, canopy: 0.18, albedo: 0.08, chroma: 0.8 };

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
/**
 * Round 45 (item 5, survey crop 27 / pose w26-stairs-f: a giant's cluster card seen edge-on
 * over a distant trunk read as a "T" — the kind probe put the sliver in the ordinary canopy
 * cards, not the flat-shaded authored lobes): a card's coverage by |cos| of the angle between
 * its plane normal and the view ray — 0 at and under the first value, full from the second.
 * A card's normal leans out of and up from its lobe (giant.ts clusterCards), so a lobe's top
 * cards are systematically edge-on to a walker looking up at it; under cos 0.1 (5.7° from
 * edge-on) a card is a line a tenth of its own width and goes, full from 0.22 (12.7°) — about a
 * tenth of the cards, carrying under 1 % of the card area. The flat-shaded cards (writer.ts
 * leafFlat: one even dark, no cards behind them to hide an edge) fade over a wider band.
 * Exported for the audit.
 */
export const CARD_EDGE_FADE: [number, number] = [0.1, 0.22];
export const CARD_FLAT_EDGE_FADE: [number, number] = [0.15, 0.4];
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

/**
 * Round 46 (survey-2 check 03, pose sn-bole-lantern-tree: a flat 9-gon moss cushion 190 px
 * across cut the frame at touching distance — the lens 45 cm from a 12 cm dome): the tree
 * shader shrinks a 3-D cushion (writer.ts woodCushion: aRoot.w in CUSHION_ROOT_W, its anchor on the bark
 * in aRoot.xyz) onto its anchor as the lens comes within these distances of the ANCHOR (m) —
 * full size at the second, gone at the first — so a cushion is never a polygon across the frame
 * and never pops (a fragment cull left a ring). The fixed cameras stand ≥ 5 m from every near
 * base; the shader's own moss field carries the cushion look inside a metre.
 *
 * Round 47 (the round-46 review, sn-bole-lantern-tree: "the disc still reads at touching
 * distance"): gone at 0.35 m and full only from 1.3 m — the round-46 band (0.5–0.9) left a
 * cushion at 0.7 m at half its size, which on a 12 cm dome 0.7 m from the lens is still a
 * 150 px polygon; over the wider band a cushion at 0.7 m is a 2 cm bump and the bole's own moss
 * bulge and the shader's moss field carry the look. The band is a smoothstep, so it never pops.
 */
export const CUSHION_FADE_M: [number, number] = [0.35, 1.3];

const WIND_VERTEX_PARS = /* glsl */ `
#define BARK_AO_LIFT ${BARK_AO_LIFT.toFixed(2)}
#define CUSHION_FADE_NEAR ${CUSHION_FADE_M[0].toFixed(3)}
#define CUSHION_FADE_FAR ${CUSHION_FADE_M[1].toFixed(3)}
#define CUSHION_ROOT_LO ${CUSHION_ROOT_W[0].toFixed(3)}
#define CUSHION_ROOT_HI ${CUSHION_ROOT_W[1].toFixed(3)}
#define CUSHION_ROOT_PER_M ${CUSHION_ROOT_W_PER_M.toFixed(4)}
#define NEAR_BOLE_SLOTS ${NEAR_BOLE_SLOTS}
#define NEAR_CANOPY_SLOTS ${NEAR_CANOPY_SLOTS}
attribute vec3 aWind;
attribute vec4 aRoot;
uniform float uTreeStiff;
uniform float uFlex;
uniform vec4 uNearBole[NEAR_BOLE_SLOTS];
uniform vec4 uNearCanopy[NEAR_CANOPY_SLOTS];
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
    // a 3-D moss cushion (writer.ts woodCushion: w in the cushion window, aRoot.xyz = its anchor
    // on the bark, so treeRoot here is the anchor in world space) shrinks onto its anchor as the
    // lens comes within CUSHION_FADE_M of it — a 12 cm dome 45 cm from the lens was a polygon
    // across the frame (round 46, survey-2 check 03). Only the near bases carry cushions. Its w
    // encodes the anchor's height above the tree's origin (writer.ts cushionRootW), read below so
    // the whole-tree sway is the bark's at that height, not a root's.
    float cushionH = 0.0;
    if (aRoot.w < CUSHION_ROOT_HI && aRoot.w > CUSHION_ROOT_LO) {
      transformed = mix(aRoot.xyz, transformed, smoothstep(CUSHION_FADE_NEAR, CUSHION_FADE_FAR, distance(cameraPosition, treeRoot.xyz)));
      cushionH = (aRoot.w - CUSHION_ROOT_LO) / CUSHION_ROOT_PER_M;
    }
    // near-canopy LOD (giant.ts NEAR_CANOPY_IN_M): the far laminae and cards of a lobe (aRoot.w =
    // 3 + the lobe's group) fold to the tree's root while a slot names that root and group (the
    // depth programs are given an empty set, so the shadows are the far foliage's at every distance).
    // A flat lobe's tagged foliage (writer.ts: w = 1000 + group + 0.5 × share) folds by the same
    // group and decodes below as the flat leaf it is; every other vertex reads w as before.
    float leafW = aRoot.w;
    float swapW = aRoot.w;
    if (aRoot.w >= 999.0) {
      leafW = 1.5 + fract(aRoot.w);
      swapW = 3.0 + floor(aRoot.w - 1000.0 + 0.01);
    }
    if (swapW > 2.75) {
      for (int i = 0; i < NEAR_CANOPY_SLOTS; i++) {
        if (uNearCanopy[i].w > 0.5 && abs(uNearCanopy[i].w - swapW) < 0.25 && distance(uNearCanopy[i].xyz, treeRoot.xyz) < 0.05) transformed = aRoot.xyz;
      }
    }
    vec4 treeP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      treeP = instanceMatrix * treeP;
    #endif
    treeP = modelMatrix * treeP;
    float hAbove = max(0.0, treeP.y - treeRoot.y + cushionH);
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
    // (sunless) leaf, 3 + group for the far foliage of a near-canopy lobe — an ordinary leaf
    // (writer.ts) — 1.0 for every ordinary leaf, so every decode is exact there (leafW = aRoot.w
    // for every vertex but a flat lobe's tagged foliage, where it is the flat leaf's own code)
    vIsLeaf = step(0.5, leafW);
    vLeafFlat = step(1.25, leafW) * (1.0 - step(2.75, leafW));
    vLeafShade = clamp((leafW - mix(0.5, 1.5, vLeafFlat)) * 2.0, 0.0, 1.0);
    // −0.45 × moss cover on the near bases' wood (writer.ts woodMoss); 0 on every plain vertex;
    // a collapsible trunk ring's cover rides in −1 − 0.45 × cover (a relief column's lower bole)
    vBarkMoss = (aRoot.w < 0.0 && aRoot.w > -0.5) ? min(1.0, -aRoot.w / 0.45) : ((aRoot.w <= -1.0 && aRoot.w > -1.5) ? (-aRoot.w - 1.0) / 0.45 : 0.0);
  }
`;

/** the LOD slot sets a tree program reads (see TreeMaterials.nearBole / nearCanopy) */
interface LodSlots {
  nearBole: IUniform<Vector4[]>;
  /** the live near-canopy set for the colour programs, an empty constant set for the depth programs */
  nearCanopy: IUniform<Vector4[]>;
}

function injectWind(material: Material, wind: Wind, o: WindOpts, slots: LodSlots, extra?: (shader: WebGLProgramParametersWithUniforms) => void, key = '') {
  const uTreeStiff = { value: o.treeStiffness };
  const uFlex = { value: o.flex };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTreeStiff = uTreeStiff;
    shader.uniforms.uFlex = uFlex;
    shader.uniforms.uNearBole = slots.nearBole;
    shader.uniforms.uNearCanopy = slots.nearCanopy;
    shader.vertexShader = WIND_GLSL + WIND_VERTEX_PARS + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', WIND_VERTEX_BODY);
    extra?.(shader);
  };
  material.customProgramCacheKey = () => `trees-${key}-v8`;
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
// 1 at BARK_DETAIL_M[0] from the camera, 0 at BARK_DETAIL_M[1]; set in the near-detail programs'
// colour block, read by their normal block — zero everywhere else
float barkNearDetail = 0.0;
// the third octave's weight within BARK_TOUCH_M (round 46), bare bark only; zero everywhere else
float barkTouch = 0.0;
// round 47: the near bases' touching-distance share (1 at BARK_TOUCH_M[0], 0 at [1]) on every
// surface, moss included — set in the near-base colour block, read by its normal and light blocks
float barkTouchNear = 0.0;
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
// the near bases' moss cushion field (3–8 cm cushions; see GIANT_BARK_COLOR vBarkMoss): one
// function so the colour block and the near-detail normal block read the same surface
float mossField(vec3 p) { return treeNoise(p * 13.0) * 0.55 + treeNoise(p * 41.0 + 11.0) * 0.45; }
`;
/**
 * Touching-distance bark (round 44, survey #1: "at touching distance the bark is a magnified
 * blur"): the near-detail programs (the near bases, the near canopy's limb sleeves) sample the
 * same 1 K bark set again at BARK_DETAIL_TILES × the frequency — a 1.6 m tile is 1.6 mm a texel,
 * 2–3× magnified at 1 m — blended in between these view distances (m): none at the far end, so
 * a bole 6 m off renders the plain arithmetic.
 */
export const BARK_DETAIL_M: [number, number] = [1.5, 6];
export const BARK_DETAIL_TILES = 3.7;
/**
 * Round 46 (survey-2 check 03): the near-detail programs' third bark octave, within these view
 * distances (m) — full at the first, none at the second — at BARK_TOUCH_TILES × the tile (≈ 1 mm
 * a texel on the 1.6 m tile). The fixed cameras stand ≥ 5 m from every near base: zero there.
 */
export const BARK_TOUCH_M: [number, number] = [0.6, 2.0];
export const BARK_TOUCH_TILES = 11.0;
/** Linear luminance of tree_bark_03/2k/color.jpg after its SRGBColorSpace decode; texture2D
 * returns linear samples. The 1K mean is 0.253794 (0.67% lower). Measured/checkable with
 * art/environment/astra-trees-quality/bark-linear-mean-check.mjs; shared by near/distant bark. */
const BARK_DETAIL_MEAN = 0.2554942;
/**
 * Distant trees' bark (round 44, survey #2 crops 04/05): the solid vertices of a distant tree
 * read the bark map within these view distances (m) — full at the near end, none at the far end.
 * The nearest depth row stands 43 m from camera D, the radial pool 51 m from A: zero in every
 * fixed frame.
 */
export const DISTANT_BARK_M: [number, number] = [22, 38];
/**
 * Round 45 (trees-27's leftover, measured at w19-spine-r / sn-arch-outside: the depth rows'
 * boles 15–30 m from a walker read as pale cylinders): within the same DISTANT_BARK_M blend the
 * bark is [overall multiplier, tone-band amplitude (±), grime multiplier at the ground line] —
 * 0.72 of its tint, ±40 % patch bands (1–2 patches around the bole, 3–4 m along it, the tree's
 * own phase) with cords at half that every 40 cm around, 0.55 at the foot fading up to 4 m.
 * Zero at 38 m+, so the fixed frames are untouched. The first round-45 take at
 * [0.82, 0.22, 0.7] moved the w19-spine-r bole's interior by 1–2 sRGB levels (the veil at
 * 15 m keeps ~0.18 of a 0.24 pixel): the haze takes most of any albedo change, so the change
 * has to be large to survive it.
 *
 * Round 46 (survey-2 check 04: the round-45 take at [0.72, 0.4, 0.55] measured an interior sd of
 * 7–10 sRGB levels on a mean of 65 at w19-spine-r — bands on a 0.04-linear base tone under the
 * veil): the plates come up to the tint (1.0) so the furrows the geometry now cuts
 * (distant.ts DISTANT_CORDS, floor × DISTANT_FURROW_SHADE in the vertex colour) have a lit
 * plate to contrast with; the patch bands ±45 %; the analytic 20-around cord stripe drops to a
 * quarter of the band (DISTANT_NEAR_CORD_STRIPE) — the geometry carries the cords now.
 */
export const DISTANT_NEAR_TONE: [number, number, number] = [1.0, 0.55, 0.45];
export const DISTANT_NEAR_CORD_STRIPE = 0.25;
/**
 * Round 46: the bark floor of a broad depth-row bole inside the distant material's near blend
 * (DISTANT_BARK_M; zero at 38 m+, so no fixed frame sees it). The columns' preset with more of
 * the bole's own albedo kept (0.8 against 0.45): at 8–20 m the shaded side of a bole is the veil
 * over black without it (trees-29 probe at w19-spine-r: the hemisphere light contributed
 * 0.5 / 255 to the cone), and it is the cords, the furrow shade and the map that must show there.
 */
export const DISTANT_NEAR_FLOOR: ShadeFloor = { ...SHARED_BARK_FLOOR, lift: 6.2, texture: 0.8 };
/**
 * Round 47 (survey-2 / round-46 review, w20-spine-r and sn-arch-outside: the depth-row boles
 * 8–16 m off still "pale smooth cylinders" after round 46's floor and gain — measured at
 * w20-spine-r: crop sd 20 on a mean of 96, the two boles' interiors flat to ± 3 sRGB levels).
 * Three terms, all inside the near blend (zero at 38 m+, the fixed frames):
 * - the floored light on the shaded side takes the sun's side (materials.ts distant
 *   lights_fragment_end): the face turned from the sun keeps DISTANT_SHADE_SIDE of the floor,
 *   the terminator side all of it — round shading a flat floor erased;
 * - inside DISTANT_NEAR_BAND_M (m; full at the first, the round-46 arithmetic from the second)
 *   the bark map's contrast about its mean is DISTANT_NEAR_MAP_GAIN (2.0 outside) and the
 *   analytic cord stripe is a bark cord: a narrow furrow DISTANT_NEAR_FURROW_DARK darker than
 *   the plates.
 */
/**
 * Round 48 (opus-review #12 / #01, w19–w21 / x-arch-approach: the depth-row boles 10–25 m off
 * still "smooth cones, a flat brown, no bark" — round 47's terms stopped at 20 m and the shade
 * side kept 0.55 of the floor): the face turned from the sun keeps 0.38 of the floor; the near
 * band's furrows and map gain run to 26 m (full at 14) — the poses' range; the tone bands ± 0.55
 * (DISTANT_NEAR_TONE) and the grime 0.45 at the ground line. Zero at 38 m+ still (DISTANT_BARK_M).
 */
export const DISTANT_SHADE_SIDE = 0.38;
export const DISTANT_NEAR_BAND_M: [number, number] = [14, 26];
export const DISTANT_NEAR_MAP_GAIN = 3.0;
export const DISTANT_NEAR_FURROW_DARK = 0.45;

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
  #ifdef NEAR_BASE_DETAIL
  // the near base's moss is the vertex cover (bole.ts) with its cushions below; these far
  // sheets, which green a whole flare's upper skirt from 10 m, are thinned to a tint here so
  // the cords and the bark between the cushions show (the owner's "soft green")
  moss = max(moss * 0.45, sheet * 0.35);
  #else
  moss = max(moss, sheet);
  #endif
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
    // cushions 3–8 cm across (38 / 110 cycles per m read as static from 1 m)
    float mossFine = mossField(vTreeWorld);
    // cushions with ragged edges: the cover needs both a strong per-vertex moss AND the fine
    // noise, so bark shows between the cushions (a 0.12–0.7 threshold greened whole boles)
    barkMossCover = smoothstep(0.34, 0.82, vBarkMoss * (0.5 + 0.95 * mossFine));
    // a darker rim where a cushion meets the bark, so it sits on the bark as a volume
    float mossRim = barkMossCover * (1.0 - barkMossCover) * 4.0;
    vec3 mossCushion = mix(vec3(0.09, 0.16, 0.04), vec3(0.24, 0.36, 0.10), mossFine) * (1.0 - 0.35 * mossRim);
    #ifdef BARK_NEAR_DETAIL
    // round 44: a 3-D cushion's crown is lit and its flanks fall off — the fine field itself
    // (its slopes bend the normal in the near-detail normal block), plus a sub-cm sprig speckle
    float sprig = treeNoise(vTreeWorld * 170.0) * 0.5 + treeNoise(vTreeWorld * 330.0 + 5.0) * 0.5;
    mossCushion *= 0.8 + 0.45 * mossFine + 0.25 * (sprig - 0.5) * barkNearDetail;
    #endif
    diffuseColor.rgb = mix(diffuseColor.rgb, mossCushion, barkMossCover * 0.92);
  }
  #ifdef BARK_NEAR_DETAIL
  // the touching-distance share (round 46 BARK_TOUCH_M; zero past 2 m) on bark and moss alike
  barkTouchNear = 1.0 - smoothstep(${BARK_TOUCH_M[0].toFixed(2)}, ${BARK_TOUCH_M[1].toFixed(2)}, length(vViewPosition));
  #ifdef NEAR_BASE_DETAIL
  // round 47 (survey-2 / round-46 review, sn-bole-lantern-tree: the moss at 0.4 m "one smooth
  // green"): at arm's length the moss field is a relief in the albedo too — the gaps between
  // cushions (mossField low) hold soil-dark shade, the crowns their own lit green — about the
  // field's mean so the moss level does not move; the normal block bends the normal harder there
  if (barkMossCover > 0.0 && barkTouchNear > 0.0) {
    float mossGap = mossField(vTreeWorld);
    diffuseColor.rgb *= mix(1.0, clamp(0.55 + 0.9 * mossGap, 0.5, 1.35), barkTouchNear * barkMossCover);
  }
  #endif
  // touching-distance bark (BARK_DETAIL_M): the bark set's colour again at BARK_DETAIL_TILES × the
  // frequency, as a factor about its own mean so the level does not move — plates and fissures
  // 3 mm a texel where the 1.6 m tile was a blur; under the moss the cushions carry their own
  if (barkNearDetail > 0.0 && barkMossCover < 1.0) {
    vec3 fine = texture2D(map, vMapUv * ${BARK_DETAIL_TILES.toFixed(2)} + vec2(0.37, 0.61)).rgb;
    float fineLum = dot(fine, vec3(0.2126, 0.7152, 0.0722));
    float fineFactor = clamp(fineLum / uBarkDetailMean, 0.55, 1.7);
    diffuseColor.rgb *= mix(1.0, mix(1.0, fineFactor, 0.7), barkNearDetail * (1.0 - barkMossCover));
    // round 46 (survey-2 check 03, the bole at 0.5 m "a blurred smear"): a third octave within
    // BARK_TOUCH_M — the same map at BARK_TOUCH_TILES × the tile, a factor about its mean at half
    // weight — so the plates break into grain at arm's length; zero past 2 m
    barkTouch = barkTouchNear * (1.0 - barkMossCover);
    if (barkTouch > 0.0) {
      vec3 touch = texture2D(map, vMapUv * ${BARK_TOUCH_TILES.toFixed(2)} + vec2(0.13, 0.29)).rgb;
      float touchLum = dot(touch, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb *= mix(1.0, clamp(touchLum / uBarkDetailMean, 0.6, 1.5), 0.5 * barkTouch);
    }
  }
  #endif
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
 * Shade floors (shared model and calibration notes in materials/shadeFloor.ts; the trees' own
 * presets above): the giants' bark runs TREE_BARK_FLOOR, every leaf and the canopy cards
 * TREE_LEAF_FLOOR (the near canopy NEAR_CANOPY_LEAF_FLOOR). The tree shader
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
/**
 * A floor block with its lift and texture-share reads faded by view distance (TREE_FLOOR_FADE_M):
 * `${u}NearLift` / `${u}NearTexture` within, the block's own `${u}Lift` / `${u}Texture` beyond.
 * The shared block reads the two by name, so the fade is spliced onto those reads; throws if the
 * shared text no longer carries them. `floorFar` must be in scope (see TREE_FLOOR_FADE_GLSL).
 */
function distanceFadedFloorGlsl(u: string, block: string): string {
  const lift = `${u}Lift * ambientMean`;
  const texture = `${u}Texture)`;
  if (!block.includes(lift) || !block.includes(texture)) throw new Error(`shadeFloorGlsl: expected '${lift}' and '${texture}' in the floor block`);
  return block.replace(lift, `mix(${u}NearLift, ${u}Lift, floorFar) * ambientMean`).replace(texture, `mix(${u}NearTexture, ${u}Texture, floorFar))`);
}
const TREE_FLOOR_FADE_PARS = 'uniform vec2 uFloorFade;\n';
const treeFloorNearPars = (u: string) => `uniform float ${u}NearLift;\nuniform float ${u}NearTexture;\n`;
const TREE_FLOOR_FADE_GLSL = /* glsl */ `float floorFar = smoothstep(uFloorFade.x, uFloorFade.y, length(vViewPosition));`;
function bindTreeFloorNear(shader: WebGLProgramParametersWithUniforms, u: string, near: ShadeFloor) {
  shader.uniforms[`${u}NearLift`] = { value: near.lift };
  shader.uniforms[`${u}NearTexture`] = { value: near.texture };
  shader.uniforms.uFloorFade = { value: new Vector2(TREE_FLOOR_FADE_M[0], TREE_FLOOR_FADE_M[1]) };
}
/** the leaf floor (LEAF_FLOOR_SHADED semantics) faded by distance: `near` is the preset within TREE_FLOOR_FADE_M[0] */
const leafFloorShaded = () => /* glsl */ `
      {
        ${TREE_FLOOR_FADE_GLSL}
        vec3 beforeFloor = reflectedLight.indirectDiffuse;
        ${distanceFadedFloorGlsl('uLeafFloor', shadeFloorGlsl('uLeafFloor', TREE_FLOOR_GLSL))}
        reflectedLight.indirectDiffuse = mix(beforeFloor, reflectedLight.indirectDiffuse, vLeafShade);
      }
`;
const LEAF_FLOOR_SHADED = leafFloorShaded();
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
 * The emergent column keeps its calibrated height/level profile, with the same bark/moss
 * colour separation as the other giants. This deliberately retains surface variation where
 * the older 0.25 texture share matched the video's hazed strip but read as a green pole.
 */
export const TREE_NEAR_BOLE_FLOOR: ShadeFloor = { ...NEAR_BOLE_FLOOR, texture: 0.65, canopy: 0.18, chroma: 0.8 };

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

/**
 * The sun through a lamina, far programs: Verdant Forest's directional transmission (a leaf
 * turned from the sun glows on its dark face, and every leaf between the eye and the sun glows).
 */
const LEAF_SUN_THROUGH = /* glsl */ `
      #if NUM_DIR_LIGHTS > 0
      {
        float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
        float transmission = max(-dot(normal, directLight.direction), 0.0) * 0.45 + backlight * 0.65;
        vec3 sunTint = mix(diffuseColor.rgb, uLeafSun, 0.5);
        reflectedLight.directDiffuse += sunTint * directLight.color * transmission * (0.22 * vLeafShade * leafThin);
      }
      #endif
`;
/**
 * The same for the near canopy (giant.ts NEAR_CANOPY_IN_M), read from below: the face turned
 * from the sun is lit by what comes through the blade — full weight on the underside term (the
 * far block's 0.45), a wider backlight lobe, more of the sunlit leaf colour in the tint — and
 * `directLight.color` carries the shadow of the crown above (the far foliage still casts), so it
 * is dark where the canopy is thick and lit where the sun is behind the leaf. `leafThin` (the
 * blade thin, the midrib, veins and margin thick — LEAF_NEAR_NORMAL, out to uLeafNear.y here)
 * gives the glow its structure.
 */
const NEAR_CANOPY_SUN_THROUGH_GLSL = /* glsl */ `
      #if NUM_DIR_LIGHTS > 0
      {
        float backlight = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 2.0);
        float underside = max(-dot(normal, directLight.direction), 0.0);
        float transmission = underside * 0.9 + backlight * 0.8;
        vec3 sunTint = mix(diffuseColor.rgb, uLeafSun, 0.6);
        reflectedLight.directDiffuse += sunTint * directLight.color * transmission * (uSunThrough * vLeafShade * leafThin);
      }
      #endif
`;

/** a tree program's leaf-side variant (the near canopy's): its leaf floor, leaf-detail range and sun-through */
interface LeafVariant {
  leafFloor?: ShadeFloor;
  leafNear?: [number, number];
  /** set = the near-canopy sun-through block scaled by this (uSunThrough) in place of the far block */
  sunThrough?: number;
  /**
   * Round 45 (the column trees): the BARK floor's own near preset and fade range (m) in place of
   * the shared TREE_FLOOR_FADE_M — the bark block reads `${barkPrefix}Fade` instead of uFloorFade,
   * so the leaf floor's fade is untouched. Unset: the bark fades like everything else.
   */
  barkNear?: ShadeFloor;
  barkFade?: [number, number];
}

/**
 * `nearDetail`: false = a far program; 'base' = a near base (its own moss / lichen / tuft
 * variants AND the touching-distance bark); 'bark' = the touching-distance bark alone (the near
 * canopy's limb sleeves — their far-program moss sheets stay as they are).
 */
function treeFragment(shader: WebGLProgramParametersWithUniforms, sun: Color, leafRoughness: number, barkColor: string, barkFloor: ShadeFloor, barkPrefix = 'uBarkFloor', heightFade?: { top: number; fade: [number, number] }, nearDetail: false | 'base' | 'bark' = false, variant: LeafVariant = {}) {
  shader.uniforms.uLeafSun = { value: sun };
  shader.uniforms.uLeafRough = { value: leafRoughness };
  shader.uniforms.uLeafTransmit = { value: LEAF_TRANSMIT };
  shader.uniforms.uFlatLift = { value: LEAF_FLAT_LIFT };
  const leafNear = variant.leafNear ?? LEAF_NEAR_M;
  shader.uniforms.uLeafNear = { value: new Vector2(leafNear[0], leafNear[1]) };
  bindShadeFloor(shader, barkPrefix, barkFloor);
  bindShadeFloor(shader, 'uLeafFloor', variant.leafFloor ?? TREE_LEAF_FLOOR);
  // the distance fade (TREE_FLOOR_FADE_M): the giants' far programs go to the NEAR presets close
  // up; a material with its own calibrated floor (the near bole's height profile, the near
  // canopy's leaf floor) fades to itself
  const barkNear = variant.barkNear ?? (heightFade || barkFloor !== TREE_BARK_FLOOR ? barkFloor : TREE_BARK_FLOOR_NEAR);
  const leafNearFloor = variant.leafFloor ?? TREE_LEAF_FLOOR_NEAR;
  bindTreeFloorNear(shader, barkPrefix, barkNear);
  bindTreeFloorNear(shader, 'uLeafFloor', leafNearFloor);
  // a bark floor with its own fade range (LeafVariant.barkFade): the bark block's `floorFar`
  // reads `${barkPrefix}Fade`; the leaf block keeps uFloorFade
  let barkFadePars = '';
  let barkFadeGlsl = TREE_FLOOR_FADE_GLSL;
  if (variant.barkFade) {
    shader.uniforms[`${barkPrefix}Fade`] = { value: new Vector2(variant.barkFade[0], variant.barkFade[1]) };
    barkFadePars = `uniform vec2 ${barkPrefix}Fade;\n`;
    barkFadeGlsl = TREE_FLOOR_FADE_GLSL.replace('uFloorFade.x, uFloorFade.y', `${barkPrefix}Fade.x, ${barkPrefix}Fade.y`);
    if (barkFadeGlsl === TREE_FLOOR_FADE_GLSL) throw new Error('treeFragment: expected uFloorFade in TREE_FLOOR_FADE_GLSL');
  }
  let sunThroughPars = '';
  let sunThrough = LEAF_SUN_THROUGH;
  if (variant.sunThrough !== undefined) {
    shader.uniforms.uSunThrough = { value: variant.sunThrough };
    sunThroughPars = 'uniform float uSunThrough;\n';
    sunThrough = NEAR_CANOPY_SUN_THROUGH_GLSL;
  }
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
  // the height-profiled near-bole floor keeps its own lift; the plain block fades lift and
  // texture share by distance (TREE_FLOOR_FADE_M) before the woodNear splice
  const floorBlock = heightFade ? heightFadedFloorGlsl(barkPrefix) : distanceFadedFloorGlsl(barkPrefix, shadeFloorGlsl(barkPrefix, TREE_FLOOR_GLSL));
  const textureRead = heightFade ? `${barkPrefix}Texture)` : `mix(${barkPrefix}NearTexture, ${barkPrefix}Texture, floorFar))`;
  if (!floorBlock.includes(textureRead)) throw new Error(`shadeFloorGlsl: expected '${textureRead}' in the floor block`);
  const textureHere = heightFade ? `${barkPrefix}Texture` : `mix(${barkPrefix}NearTexture, ${barkPrefix}Texture, floorFar)`;
  const barkFloorGlsl = /* glsl */ `
      float woodNear = 1.0 - smoothstep(uLeafNear.x, uLeafNear.y, length(vViewPosition));
      ${barkFadeGlsl}
      ${floorBlock.replace(textureRead, `mix(${textureHere}, max(${textureHere}, 0.5), woodNear))`)}
`;
  let detailPars = '';
  if (nearDetail) {
    shader.uniforms.uBarkDetail = { value: new Vector2(BARK_DETAIL_M[0], BARK_DETAIL_M[1]) };
    shader.uniforms.uBarkDetailMean = { value: BARK_DETAIL_MEAN };
    detailPars = 'uniform vec2 uBarkDetail;\nuniform float uBarkDetailMean;\n';
  }
  shader.fragmentShader =
    (nearDetail === 'base' ? '#define NEAR_BASE_DETAIL\n' : '') +
    (nearDetail ? '#define BARK_NEAR_DETAIL\n' : '') +
    detailPars +
    TREE_FRAGMENT_PARS +
    LEAF_NEAR_PARS +
    LEAF_FRAME_GLSL +
    shadeFloorPars(barkPrefix, TREE_FLOOR_GLSL) +
    fadePars +
    shadeFloorPars('uLeafFloor', TREE_FLOOR_GLSL) +
    TREE_FLOOR_FADE_PARS +
    barkFadePars +
    treeFloorNearPars(barkPrefix) +
    treeFloorNearPars('uLeafFloor') +
    sunThroughPars +
    shader.fragmentShader;
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
    #if defined(BARK_NEAR_DETAIL) && defined(USE_NORMALMAP_TANGENTSPACE)
    if (vIsLeaf < 0.5) {
      // touching-distance bark (BARK_DETAIL_M): the bark set's normal again at BARK_DETAIL_TILES ×
      // the frequency, its slopes added to the 1.6 m tile's, so plates and fissures 3 mm a texel
      // catch the light where the tile alone was a magnified blur; nothing past the far distance
      if (barkNearDetail > 0.0) {
        vec3 fineN = texture2D(normalMap, vNormalMapUv * ${BARK_DETAIL_TILES.toFixed(2)} + vec2(0.37, 0.61)).xyz * 2.0 - 1.0;
        fineN.xy *= normalScale * 0.75;
        vec3 sumN = vec3(mapN.xy + fineN.xy * barkNearDetail, mapN.z);
        // the third octave's slopes at arm's length (round 46, BARK_TOUCH_M)
        if (barkTouch > 0.0) {
          vec3 touchN = texture2D(normalMap, vNormalMapUv * ${BARK_TOUCH_TILES.toFixed(2)} + vec2(0.13, 0.29)).xyz * 2.0 - 1.0;
          sumN.xy += touchN.xy * normalScale * 0.5 * barkTouch;
        }
        normal = normalize(tbn * normalize(sumN));
      }
      // the moss as a volume: the cushion field's slopes bend the normal (finite differences
      // along the tangent frame, in world space) so a cushion's crown faces the light and its
      // flanks fall away — a felt that shaded as the flat bark under it read as paint
      if (barkMossCover > 0.0) {
        vec3 tW = inverseTransformDirection(tbn[0], viewMatrix);
        vec3 bW = inverseTransformDirection(tbn[1], viewMatrix);
        const float e = 0.012;
        float h0 = mossField(vTreeWorld);
        float hx = mossField(vTreeWorld + tW * e);
        float hy = mossField(vTreeWorld + bW * e);
        // the field spans 0..1 over ~2.4 cm; 1.1 puts a cushion's flank at ~25° off the bark —
        // round 47: 2.6 (≈ 45°) at touching distance (barkTouchNear), where a 25° flank under the
        // flat floor read as one smooth green
        float mossSlope = 1.1 * (1.0 + 1.4 * barkTouchNear);
        vec3 mossN = normalize(tbn * normalize(vec3(-(hx - h0) * mossSlope, -(hy - h0) * mossSlope, 1.0)));
        normal = normalize(mix(normal, mossN, barkMossCover * 0.85));
      }
    } else {
      normal = nonPerturbedNormal;
    }
    #else
    normal = normalize(mix(normal, nonPerturbedNormal, max(vIsLeaf, barkMossCover * 0.8)));
    #endif
    ${LEAF_NEAR_NORMAL}
    `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    /* glsl */ `#include <color_fragment>
    if (vIsLeaf > 0.5) {
      ${LEAF_COLOR}
    } else {
      #ifdef BARK_NEAR_DETAIL
      barkNearDetail = 1.0 - smoothstep(uBarkDetail.x, uBarkDetail.y, length(vViewPosition));
      #endif
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
${sunThrough}
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
      #ifdef NEAR_BASE_DETAIL
      // round 47 (sn-bole-lantern-tree / sn-bole-stair-bank: the bark and moss at 0.4–0.6 m "one
      // smooth surface"): the floor is the only light on a shaded near base and it is flat by
      // construction — a face below it is lifted TO it whatever its normal — so the moss field's
      // slopes and the fine bark normals reached the pixel only through the hemisphere share.
      // Within BARK_TOUCH_M the floored light takes a facing term from the perturbed normal:
      // crowns and plates turned to the viewer keep it, flanks and fissures turning away lose up
      // to 0.4 of it (the cavity cue a flat-lit relief shows from any side), normalised so the
      // mean over a face-on surface is ≈ 1. Zero at 2 m+ (mix(…, 0.0) is exactly the floor).
      if (barkTouchNear > 0.0) {
        float touchFace = max(dot(normal, normalize(vViewPosition)), 0.0);
        float touchRelief = (0.6 + 0.4 * pow(touchFace, 1.6)) * 1.12;
        reflectedLight.indirectDiffuse *= mix(1.0, touchRelief, barkTouchNear);
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
  const nearBole: IUniform<Vector4[]> = { value: Array.from({ length: NEAR_BOLE_SLOTS }, () => new Vector4(0, 0, 0, 0)) };
  const nearCanopy: IUniform<Vector4[]> = { value: Array.from({ length: NEAR_CANOPY_SLOTS }, () => new Vector4(0, 0, 0, 0)) };
  // the colour programs fold the far foliage of the shown near-canopy lobes; the depth programs
  // never do (an empty set that is never written), so the shadows are the far foliage's always
  const noCanopy: IUniform<Vector4[]> = { value: Array.from({ length: NEAR_CANOPY_SLOTS }, () => new Vector4(0, 0, 0, 0)) };
  const colourSlots: LodSlots = { nearBole, nearCanopy };
  const depthSlots: LodSlots = { nearBole, nearCanopy: noCanopy };

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
  injectWind(whiteTree, wind, whiteWind, colourSlots, (s) => treeFragment(s, leafSun, 0.72, WHITE_BARK_COLOR, WHITE_BARK_FLOOR, 'uWhiteBarkFloor'), 'white');
  const whiteTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(whiteTreeDepth, wind, whiteWind, depthSlots, undefined, 'white-depth');

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
  injectWind(giantTree, wind, giantWind, colourSlots, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, TREE_BARK_FLOOR), 'giant');
  const giantTreeDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  injectWind(giantTreeDepth, wind, giantWind, depthSlots, undefined, 'giant-depth');
  // the near bole's copy: same maps and wind, its own floor uniforms (clone() carries no hooks)
  const giantTreeNear = giantTree.clone();
  injectWind(giantTreeNear, wind, giantWind, colourSlots, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, TREE_NEAR_BOLE_FLOOR, 'uNearBoleFloor', { top: NEAR_BOLE_FLOOR_TOP, fade: NEAR_BOLE_FLOOR_FADE }), 'giant-near');
  // the columns' copy (round 45): same maps and wind, the bark floor at COLUMN_BARK_FLOOR
  const columnTree = giantTree.clone();
  injectWind(columnTree, wind, giantWind, colourSlots, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, COLUMN_BARK_FLOOR_FAR, 'uColumnFloor', undefined, false, { barkNear: COLUMN_BARK_FLOOR, barkFade: COLUMN_FLOOR_FADE_M }), 'column');
  // the near bases' copy: same maps and wind, the bark floor at NEAR_BASE_FLOOR
  const giantTreeNearBase = giantTree.clone();
  giantTreeNearBase.normalScale.set(2.0, 2.0);
  injectWind(giantTreeNearBase, wind, giantWind, colourSlots, (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, NEAR_BASE_FLOOR, 'uNearBaseFloor', undefined, 'base'), 'giant-near-base');
  // the near canopy's copy (giant.ts NEAR_CANOPY_IN_M): the trees' bark floor, the near leaf
  // floor, the leaf detail out to NEAR_CANOPY_LEAF_NEAR_M and the sun read through the laminae
  const giantTreeNearCanopy = giantTree.clone();
  injectWind(
    giantTreeNearCanopy,
    wind,
    giantWind,
    colourSlots,
    (s) => treeFragment(s, leafSun, 0.78, GIANT_BARK_COLOR, TREE_BARK_FLOOR, 'uBarkFloor', undefined, 'bark', { leafFloor: NEAR_CANOPY_LEAF_FLOOR, leafNear: NEAR_CANOPY_LEAF_NEAR_M, sunThrough: NEAR_CANOPY_SUN_THROUGH }),
    'giant-near-canopy',
  );

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
    colourSlots,
    (s) => {
      s.uniforms.uLeafSun = { value: leafSun };
      s.uniforms.uLeafTransmit = { value: LEAF_TRANSMIT };
      s.uniforms.uFlatLift = { value: LEAF_FLAT_LIFT };
      s.uniforms.uLeafNear = { value: new Vector2(LEAF_NEAR_M[0], LEAF_NEAR_M[1]) };
      s.uniforms.uClusterNear = { value: clusterNear.color };
      s.uniforms.uClusterNearN = { value: clusterNear.normal };
      bindShadeFloor(s, 'uLeafFloor', TREE_LEAF_FLOOR);
      bindTreeFloorNear(s, 'uLeafFloor', TREE_LEAF_FLOOR_NEAR);
      s.fragmentShader =
        `varying vec3 vTreeWorld;\nvarying vec2 vTreeUv;\nvarying float vTreeLocalY;\nvarying float vIsLeaf;\nvarying float vLeafShade;\nvarying float vLeafFlat;\nuniform vec3 uLeafSun;\nuniform float uLeafTransmit;\nuniform float uFlatLift;\nuniform sampler2D uClusterNear;\nuniform sampler2D uClusterNearN;\nvec4 cardNearN = vec4(0.5, 0.5, 1.0, 0.0);\n` +
        LEAF_NEAR_PARS +
        LEAF_FRAME_GLSL +
        shadeFloorPars('uLeafFloor', TREE_FLOOR_GLSL) +
        TREE_FLOOR_FADE_PARS +
        treeFloorNearPars('uLeafFloor') +
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
          // round 45 (survey crop 27, pose w26-stairs-f: a cluster card seen edge-on over a
          // distant trunk read as a "T"): a card's coverage goes out as its plane turns to the
          // view ray (CARD_EDGE_FADE; the flat-shaded cards over CARD_FLAT_EDGE_FADE's wider
          // band) — a card under the first cos is a line, not a leaf clump, and goes.
          float cardFacing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          diffuseColor.a *= mix(smoothstep(${CARD_EDGE_FADE[0].toFixed(2)}, ${CARD_EDGE_FADE[1].toFixed(2)}, cardFacing), smoothstep(${CARD_FLAT_EDGE_FADE[0].toFixed(2)}, ${CARD_FLAT_EDGE_FADE[1].toFixed(2)}, cardFacing), vLeafFlat);
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
  injectWind(giantCanopyDepth, wind, giantWind, depthSlots, biasedMap, 'giant-canopy-depth');

  // --- distant trees: leaf-cluster cards + solid trunks/cores (uv on the opaque patch); fog tints ---
  const distant = new MeshStandardMaterial({ map: cluster, alphaTest: CARD_ALPHA_TEST, vertexColors: true, roughness: 0.95, metalness: 0, side: DoubleSide });
  distant.onBeforeCompile = (s) => {
    biasedMap(s);
    // round 44 (survey #2, crops 04/05: the depth rows' trunks 10–20 m from a walker are "grey
    // cylinders with no bark"): the solid vertices (aRoot.w = 0 — trunks, limbs, lobe cores) read
    // the giants' bark colour map on a cylindrical mapping of the local position, blended in
    // under DISTANT_BARK_M[1] and full at DISTANT_BARK_M[0]. Every depth row stands ≥ 38 m from
    // the six fixed cameras, so at their range the factor is exactly zero and the frames are
    // what they were; the cards (aRoot.w ≥ 0.5) never take it.
    s.uniforms.uDistantBark = { value: gColor };
    s.uniforms.uDistantBarkM = { value: new Vector2(DISTANT_BARK_M[0], DISTANT_BARK_M[1]) };
    s.uniforms.uDistantTone = { value: new Vector3(DISTANT_NEAR_TONE[0], DISTANT_NEAR_TONE[1], DISTANT_NEAR_TONE[2]) };
    bindShadeFloor(s, 'uDistantFloor', DISTANT_NEAR_FLOOR, leafSun);
    s.vertexShader =
      'attribute vec4 aRoot;\nvarying float vDistSolid;\nvarying float vDistBark;\nvarying vec3 vDistLocal;\nvarying float vDistPhase;\n' +
      s.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
    vDistSolid = aRoot.w < 0.5 ? 1.0 : 0.0;
    // the near LOD's bark parts (distant.ts DISTANT_NEAR_GAIN: bole, limbs, roots, tagged
    // aRoot.w = −0.45) against its lobe cores (w = 0) and the far LOD's quads
    vDistBark = aRoot.w < -0.2 ? 1.0 : 0.0;
    vDistLocal = position;
    // the tree's own phase for its tone bands (round 45): from where it stands
    vDistPhase = 0.0;
    #ifdef USE_INSTANCING
      vDistPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61;
    #endif
    `,
      );
    s.fragmentShader =
      'uniform sampler2D uDistantBark;\nuniform vec2 uDistantBarkM;\nuniform vec3 uDistantTone;\nvarying float vDistSolid;\nvarying float vDistBark;\nvarying vec3 vDistLocal;\nvarying float vDistPhase;\n' +
      shadeFloorPars('uDistantFloor') +
      s.fragmentShader
        .replace(
          '#include <lights_fragment_end>',
          /* glsl */ `#include <lights_fragment_end>
    // round 46 (DISTANT_NEAR_FLOOR): the shaded side of a near-LOD bole inside the near blend gets
    // a bark floor like the columns' — without one the side away from the sun is the veil over a
    // black surface at any albedo (w19-spine-r, sn-arch-outside). Scaled by the same blend, so it
    // is zero at 38 m+ (the hero frames) and only the tagged bark takes it (never a card or core).
    #if NUM_HEMI_LIGHTS > 0
    if (vDistBark > 0.5) {
      float floorNear = 1.0 - smoothstep(uDistantBarkM.x, uDistantBarkM.y, length(vViewPosition));
      if (floorNear > 0.0) {
        vec3 lumW = vec3(0.2126, 0.7152, 0.0722);
        vec3 ambientMean = (hemisphereLights[0].skyColor + hemisphereLights[0].groundColor) * 0.5;
        vec3 canopyFilter = mix(vec3(1.0), uDistantFloorLeafSun / max(dot(uDistantFloorLeafSun, lumW), 1e-3), uDistantFloorCanopy);
        vec3 floorAlbedo = mix(vec3(uDistantFloorAlbedo), diffuseColor.rgb, uDistantFloorTexture);
        vec3 floorLight = uDistantFloorLift * floorNear * ambientMean * canopyFilter * BRDF_Lambert(floorAlbedo);
        floorLight = mix(vec3(dot(floorLight, lumW)), floorLight, uDistantFloorChroma);
        float have = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, lumW);
        reflectedLight.indirectDiffuse += max(0.0, 1.0 - have / (dot(floorLight, lumW) + 1e-4)) * floorLight;
        // round 47 (survey-2 / round-46 review, w20-spine-r, sn-arch-outside: the depth-row boles
        // 8–16 m off "pale smooth cylinders"): the floor is one level all round the shaded side,
        // so a bole is a flat strip from its lit rim to its far edge. The floored light takes the
        // sun's side: faces turned from the sun (the far side of the bole, its furrows' far walls)
        // keep DISTANT_SHADE_SIDE of it, the terminator side all of it — the round-shading cue a
        // cylinder under a roof still shows — plus the cords' own occlusion (uDistantTone.z is
        // the ground-line grime; the cords are in the vertex colour and the analytic stripe).
        // Scaled by the same near blend: zero at 38 m+ (the fixed frames).
        #if NUM_DIR_LIGHTS > 0
        {
          float sunFace = dot(normal, directionalLights[0].direction);
          float shadeSide = 1.0 - smoothstep(-0.5, 0.3, sunFace);
          reflectedLight.indirectDiffuse *= mix(1.0, ${DISTANT_SHADE_SIDE.toFixed(2)}, shadeSide * floorNear);
        }
        #endif
      }
    }
    #endif
`,
        )
        .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
    {
      float near = (1.0 - smoothstep(uDistantBarkM.x, uDistantBarkM.y, length(vViewPosition))) * vDistSolid;
      // round 46 (distant.ts DISTANT_NEAR_GAIN): the near LOD's bark is written at the gain over
      // the far tint — divided back out here where the near blend is zero (38 m+: exactly the far
      // tint, the hero frames untouched), kept in full where it is one (a 2 % albedo showed no
      // cord, band or map at 10 m; the cone a walker saw was the veil and the sky's specular)
      if (vDistBark > 0.5) diffuseColor.rgb *= mix(1.0 / ${DISTANT_NEAR_GAIN.toFixed(1)}, 1.0, near);
      if (near > 0.0) {
        // whole 1.6 m tiles around the bole (the fragment's own radius about the axis: 1 around a
        // slender's 0.2 m stem, 4–5 around a broad's 1.3 m) and 1.6 m up it — a fixed 4 around
        // stretched the map 5× on the slender stems into vertical streaks
        float around = max(1.0, floor(6.2832 * length(vDistLocal.xz) / 1.6 + 0.5));
        vec2 barkUv = vec2(atan(vDistLocal.z, vDistLocal.x) / 6.2832 * around, vDistLocal.y / 1.6);
        vec3 bark = texture2D(uDistantBark, barkUv).rgb;
        // the fissures 2× their contrast about the mean (1.5 through round 44): the haze at
        // 12–20 m halves it again — round 47: 2.6× inside DISTANT_NEAR_BAND_M (DISTANT_NEAR_MAP_GAIN), where the
        // 2× map under the flat floor still read as one grey (w20-spine-r)
        float mapGain = mix(2.0, ${DISTANT_NEAR_MAP_GAIN.toFixed(2)}, 1.0 - smoothstep(${DISTANT_NEAR_BAND_M[0].toFixed(1)}, ${DISTANT_NEAR_BAND_M[1].toFixed(1)}, length(vViewPosition)));
        bark = clamp((bark - vec3(${BARK_DETAIL_MEAN.toFixed(4)})) * mapGain + vec3(${BARK_DETAIL_MEAN.toFixed(4)}), 0.0, 1.0);
        float barkLum = dot(bark, vec3(0.2126, 0.7152, 0.0722));
        // a factor about the map's mean, so the row's silhouette luminance (matched at 47 m) holds
        float factor = clamp(barkLum / ${BARK_DETAIL_MEAN.toFixed(4)}, 0.3, 2.0);
        // the map's own hue takes over from the flat tint as the walker gets close
        vec3 tinted = mix(diffuseColor.rgb * factor, bark * (diffuseColor.rgb / vec3(${BARK_DETAIL_MEAN.toFixed(4)})), 0.85);
        // round 45 (trees-27's leftover: the boles 15–30 m from a walker still read as pale
        // cylinders, the map's fissures flattened by the veil): within the same near blend the
        // bark is darker overall (uDistantTone.x), carries tone bands — 1–2 patches around the
        // bole, 3–4 m along it, each tree's own phase — of ± uDistantTone.y, and soil-dark grime
        // at the foot fading up to 4 m (× uDistantTone.z at the ground line). Zero at 38 m+.
        float theta = atan(vDistLocal.z, vDistLocal.x);
        float band = sin(theta * 2.0 + vDistLocal.y * 0.7 + vDistPhase) * sin(vDistLocal.y * 0.45 + 1.3 + vDistPhase * 1.7);
        // cords: one every 40 cm around the bole (4 per 1.6 m tile), leaning a little with
        // height, at half the patch amplitude — the fissures of the map alone are 1–2 px at 15 m
        // and the veil there takes most of their contrast (w19-spine-r: interior sd 0.025)
        float cord = sin(theta * around * 4.0 + vDistLocal.y * 0.35 + vDistPhase * 3.0);
        float grime = mix(uDistantTone.z, 1.0, smoothstep(0.0, 4.0, vDistLocal.y));
        tinted *= uDistantTone.x * (1.0 + uDistantTone.y * band) * (1.0 + ${DISTANT_NEAR_CORD_STRIPE.toFixed(2)} * uDistantTone.y * cord) * grime;
        // round 47 (w20-spine-r, sn-arch-outside): inside DISTANT_NEAR_BAND_M (full to 12 m, gone at 20) the cords are bark
        // cords, not a sine — a narrow furrow (the trough of the same stripe, raised to a power)
        // DISTANT_NEAR_FURROW_DARK darker than the plates either side, the plates a tenth lighter
        // so the mean holds; the 2–2.6× map above breaks the plates. Zero past 20 m (the
        // round-45/46 arithmetic from there), and the fixed frames stand 38 m+ off.
        float bandNear = 1.0 - smoothstep(${DISTANT_NEAR_BAND_M[0].toFixed(1)}, ${DISTANT_NEAR_BAND_M[1].toFixed(1)}, length(vViewPosition));
        float furrow = pow(0.5 - 0.5 * cord, 4.0);
        tinted *= mix(1.0, (1.0 - ${DISTANT_NEAR_FURROW_DARK.toFixed(2)} * furrow) * (1.0 + 0.1 * (1.0 - furrow)), bandNear);
        diffuseColor.rgb = mix(diffuseColor.rgb, tinted, near);
      }
    }
    `,
      );
  };
  distant.customProgramCacheKey = () => 'trees-distant-biased-v10';

  return {
    whiteTree,
    whiteTreeDepth,
    giantTree,
    giantTreeDepth,
    giantTreeNear,
    columnTree,
    giantTreeNearBase,
    giantTreeNearCanopy,
    giantCanopy,
    giantCanopyDepth,
    distant,
    windLayers: 3,
    barkTextureSets: [barkSet, 'procedural:whitebark', 'procedural:leaf-cluster', 'procedural:leaf-cluster-near'],
    nearBole,
    nearCanopy,
  };
}
