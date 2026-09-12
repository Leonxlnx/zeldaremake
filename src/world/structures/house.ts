/**
 * Kokiri tree-trunk house (reference B, 14 s; concept sheet 04 "Tree-house exterior"): a hollow
 * living stump under a LOW BROAD mushroom-cap roof — a flat-topped, irregular olive moss mound
 * whose moss rim overhangs the trunk all round (`CAP_RIM_SCALE`), with a dark soffit that shades
 * a deep, dark porch cut into the front of the trunk. Two thick ROOT LIPS — buttress roots
 * hugging the jambs, flaring forward and outward to their feet on the ground and curving up and
 * inward into the moss rim — frame the doorway: a WIDE, low, ragged-edged opening (width ≈ 1.15 ×
 * height, a broad arch rounding into the roots, no timber frame) over a sill beam and a stone
 * threshold slab, opening on a dark cool recess — a deep room whose back wall sits ≈ 3 m in, with
 * the amber local to two pod lamps hanging in front of it, a candle on a low table, embers
 * glowing pink-amber low on the right, and a pale-amber light under the arch that spills onto
 * the threshold. Nothing horizontal sits over the door (rounds 8–11's bark roll and eave bough
 * read as a beam in B): the cap's moss rim simply overhangs, and the pods hang on cords from the
 * soffit under it. The cap is built in the plain moss material
 * (vertex colours are its albedo — olive, grainy, lumpy, ±0.22 m mounds) with patches of lighter
 * straw in the roof material (`THATCH_THRESHOLD`), moss clumps and a drooping fringe of leaves and
 * vines over the rim, and it is held by the house's own living branch in the trunk's bark: a
 * gnarled bough rises from the roots on the left, climbs the left shoulder and arches over the
 * FRONT of the cap well clear of the moss (frame B looks up at it, so it runs as a thick dark
 * limb across the top band above the dome, like the reference's near limb) before sinking back
 * into the moss behind the right shoulder (sheet 04 "Natural wooden supports (branches)"). The
 * bark takes a structures-owned shade floor tinted to the reference's warm dark brown
 * (`HOUSE_BARK_FLOOR`), not the giants' grey-green one. Buttress roots seat the trunk on the
 * terrain, pale limbs drape over the cap, moss, leaf clumps, ferns, broad-leaf plants and
 * heart-leaf vines shroud the cap, and a small round window glows on the left flank.
 *
 * Every dimension is expressed in terms of `trunkRadius` / `roofHeight`, so the same builder
 * produces Saria's hero house and the small upper house.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { HouseDef } from '../layout';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import {
  TAU,
  angleDiff,
  basisMatrix,
  ensureColor,
  faceTowards,
  gridSurface,
  merge,
  offsetAlongSD,
  rrectOutline,
  rrectSD,
  setColorAttribute,
  setFloatAttribute,
  sweepTube,
  type SurfaceSample,
} from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternKind, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

type P3 = [number, number, number];

/** World-space eave profile on the door axis, for projected-thickness checks in frame B. */
export interface EaveProfile {
  /** top of the moss rim's curl (where the cap's top surface ends) and its underside */
  rimTop: P3;
  rimBottom: P3;
  /**
   * bark elements over the door centre: null since round 12 — the eave bough and the bark roll
   * are gone; the moss rim simply overhangs and the door is framed by the root lips
   */
  bough: { top: P3; bottom: P3 } | null;
  barkRoll: { top: P3; bottom: P3 } | null;
  /** the door arch's top edge */
  doorTop: P3;
  /** the same bark profile as round 11 built it (0.24 m bark roll, arched bough under it) */
  round11: { rollTop: P3; rollBottom: P3; boughTop: P3; boughBottom: P3 };
  /** ...and as round 10 built it (0.52 m roll, straight bough under it) */
  round10: { rollTop: P3; rollBottom: P3; boughTop: P3; boughBottom: P3 };
}

/** The doorway opening (world), for the aspect / projected-size checks in frame B. */
export interface DoorOpening {
  /** clear width and height of the opening (m) and width / height */
  width: number;
  height: number;
  aspect: number;
  /** sill centre, arch top, left and right jambs at half height (world) */
  sill: P3;
  top: P3;
  left: P3;
  right: P3;
  /** how far the root lips' feet flare outward from the jamb line at the ground (m) */
  lipFlare: number;
  /** round 11's opening for before/after */
  round11: { width: number; height: number; aspect: number; sill: P3; top: P3; left: P3; right: P3 };
}

/** Cap silhouette samples (world) so the audit can project rim width / crown height into B. */
export interface CapProfile {
  rimScale: number;
  crownScale: number;
  /** displaced rim edge (top of the curl) at 48 angles round the house, angle 0 = over the door */
  rim: P3[];
  /** highest displaced point of the bare moss shell */
  crownTop: P3;
  /** displaced shell samples (36 angles × v 0…0.6) for the projected silhouette / top plateau */
  shell: P3[];
  /** rim edge over the door centre and at the back */
  rimFront: P3;
  rimBack: P3;
  /** overhang of the rim past the trunk wall at the eave, front / side / back (m) */
  overhang: { front: number; side: number; back: number };
  /** share of the cap's top surface that shows straw (area-weighted) */
  thatchFraction: number;
  /** the share round 11 tinted as straw over its all-straw cap (same noise, its 0.35–0.75 mix past ½) */
  thatchFraction11: number;
  /** the same rim / crown at ×1.0 / ×1.0 for before/after */
  round11: { rim: P3[]; crownTop: P3; rimFront: P3 };
}

export interface HouseBuild {
  group: Group;
  /** terrain contact points (root tips) */
  bases: [number, number, number][];
  lanterns: LanternRig[];
  lights: PointLight[];
  /** materials created for this house (disposed by the system) */
  materials: Material[];
  roots: number;
  branches: number;
  leaves: number;
  eave: EaveProfile;
  door: DoorOpening;
  cap: CapProfile;
  /** hearth kerb underside above the local room floor (m; must be >= 0 or the kerb is buried) */
  hearthClearance: number;
}

/**
 * Materials that every house can share (identical parameters, no per-house uniforms), so their
 * parts fold into one draw call across houses. The first house creates them and owns disposal.
 */
export interface HouseSharedMaterials {
  stone?: MeshStandardMaterial;
}

/** Local frame: F = out of the door, Rt = viewer's right when facing the door. */
class Frame {
  constructor(
    public C: Vector3,
    public F: Vector3,
    public Rt: Vector3,
  ) {}
  dir(a: number, out = new Vector3()): Vector3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return out.set(this.F.x * c + this.Rt.x * s, 0, this.F.z * c + this.Rt.z * s);
  }
  at(a: number, r: number, y: number, out = new Vector3()): Vector3 {
    this.dir(a, out).multiplyScalar(r).add(this.C);
    out.y += y;
    return out;
  }
  /** door-space: lateral w (right +), height y, depth d along F from the centre */
  door(w: number, y: number, d: number, out = new Vector3()): Vector3 {
    out.copy(this.C).addScaledVector(this.F, d).addScaledVector(this.Rt, w);
    out.y += y;
    return out;
  }
}

interface LanternSpec {
  /** angle around the house (0 = door, + = viewer's right) */
  a: number;
  /** cord length (metres, scaled by k) */
  cord: number;
  /**
   * 'bough' hangs from the underside of the eave bough that runs across the front, 'eave' from
   * the soffit under the roof lip, 'peg' from a short stub branch at height y
   */
  hook: 'bough' | 'eave' | 'peg';
  y?: number;
  /** glow colour (default orange) */
  tint?: LanternKind;
}

// Reference B: three pods in a loose row under the eave just left of / over the door (frame
// x 0.736 / 0.763 / 0.794, y 0.29–0.32, i.e. hanging right below the soffit); lime / orange /
// lime from left to right, the orange one lowest. Sheet 04 hangs four from the eave bough, the
// fourth right of the door on a longer cord — here it is moved round to the right flank.
const LANTERNS: Record<string, LanternSpec[]> = {
  saria: [
    // three pods cluster left of the door on the eave bough (reference B: pod centres at frame
    // x ≈ 0.728 / 0.758 / 0.79, y 0.32–0.36, hanging close under the branch); the sheet's fourth pod hangs under the soffit on the
    // right flank, where in B the reference shows only the dark trunk
    { a: -0.18, cord: 0.03, hook: 'bough', tint: 'lime' },
    { a: -0.04, cord: 0.14, hook: 'bough', tint: 'orange' },
    { a: 0.08, cord: 0.06, hook: 'bough', tint: 'lime' },
    { a: 1.2, cord: 0.3, hook: 'eave', tint: 'orange' },
  ],
  // the upper house's pods hang on its plateau-side flanks: with Saria's cap lowered its front
  // shows above her roof in B, where the reference has only dark canopy (no lit pods there)
  upper: [
    { a: -1.9, cord: 0.3, hook: 'eave' },
    { a: 2.0, cord: 0.4, hook: 'eave' },
  ],
};

/**
 * Crown height multiplier on the cap's bare-shell crown (rim and door fixed). Reference A has
 * Saria's moss cap sitting low behind the stair bank (top at frame y ≈ 0.18, x 0.55–0.95) and F a
 * low broad cap; ours read taller in both. Round 10 A/B over ×1.0 / ×0.97 / ×0.90 / ×0.83 on one
 * tree (A + B + F, SSIM full and by half, 256×144 vs the reference frames) kept the current height:
 *   scale  combined full  combined upper   (A / B / F full)
 *   ×1.00  0.7749         1.0739           0.2757 / 0.2364 / 0.2629
 *   ×0.97  0.7717         1.0674           0.2748 / 0.2357 / 0.2612
 *   ×0.90  0.7727         1.0691           0.2740 / 0.2358 / 0.2629
 *   ×0.83  0.7713         1.0665           0.2755 / 0.2327 / 0.2630
 * Only the cap crown moved (door and threshold identical in all four B frames; the thatch top edge
 * in B drops from y 0.136 to 0.151 / 0.208 / 0.214). No variant beat ×1.0 on any view beyond
 * +0.0001; the largest loss was B's upper half at ×0.83 (0.3516 → 0.3442).
 * Round 12 re-tests the crown together with the rim (table under `CAP_RIM_SCALE`).
 */
const CROWN_SCALE = 0.85;
/**
 * Rim (cap radius) multiplier — round 12 A/B on width/shape. The reference cap (B, sheet 04) is a
 * low broad mushroom cap whose moss rim overhangs the trunk by ~1.5–2 m all round; at ×1.0 ours
 * overhung the wall by 0.9 m at the front and barely 0.1 m at the back. The door, eave height and
 * lip are fixed; the rim, soffit, the draped limbs and the cap's plants follow the radius.
 * Round 12 A/B, one tree, A + B + F vs the reference frames (256×144 SSIM; the cap box is B frame
 * 0.55–0.98 × 0.05–0.35; silhouette from the `houseCap` audit projected with B's pose, the
 * reference's from frame 14 s: height 115 px crown top → moss edge, rim ≈ 410 px, ratio 0.28,
 * flat top ≈ 205 px; reference cap box lum / sat / hue 0.374 / 0.34 / 49°):
 *   rim × crown  combined full  cap lum/sat/hue    rim px  height px  ratio  flat px  overhang f/s/b m
 *   ×1.00 ×1.00  0.8017         0.394 / 0.33 / 51°  453     147        0.325  —        1.06 / 0.65 / 0.21
 *   ×1.15 ×0.92  0.7962         0.395 / 0.34 / 50°  536      94        0.175  154      1.75 / 1.27 / 0.77
 *   ×1.15 ×0.85  0.7961         0.394 / 0.34 / 50°  536     116        0.216  179      1.75 / 1.27 / 0.77
 *   ×1.30 ×0.92  0.7959         0.389 / 0.35 / 50°  617      88        0.143  179      2.44 / 1.90 / 1.34
 *   ×1.30 ×0.85  0.7952         0.389 / 0.35 / 50°  617      80        0.130  166      2.44 / 1.90 / 1.34
 * The four wide variants tie on SSIM (spread 0.001) and colour; ×1.15 / ×0.85 is kept for the
 * silhouette (height 116 px vs the reference's 115, overhang inside the 1.5–2 m spec). With the
 * finished round-12 house the same A/B costs 0.005 combined SSIM (0.7978 at ×1.0 / ×1.0 vs 0.7928),
 * so flip both back to 1.0 for the SSIM-optimal cap.
 */
const CAP_RIM_SCALE = 1.15;
/**
 * Thatch patches on the moss cap: the patch noise (simplex, ∈ [−1, 1]) above this threshold
 * (+0.125, the midpoint of the smoothstep) shows straw (the roof material), below it moss. Round
 * 11 built the whole cap in the straw material and only tinted it toward moss where the same
 * noise fell under 0.55, so the stalks showed everywhere; the reference cap is olive moss with
 * only patches of lighter thatch. Round 12's probes: 0.55 left 6.5 % straw — too little to read
 * as patches — and 0.12 gave 35 %; 0.23 lands near the brief's quarter (audited as
 * `thatchFraction`, with round 11's straw-dominant share alongside for the before/after).
 */
const THATCH_THRESHOLD = 0.23;
/** straw patch albedo multiplier (round 12: −25 %, the patches read as bright straw) */
const THATCH_ALBEDO = 0.75;

/** Blend a moss tint into a swept branch's vertex colours on its upward-facing side. */
function mossOnTop(geo: BufferGeometry, tint: [number, number, number], amount: number, noise: Noise2D): BufferGeometry {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const col = geo.attributes.color;
  if (!col) return geo;
  for (let i = 0; i < pos.count; i++) {
    const up = nrm.getY(i);
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const patch = 0.45 + 0.55 * noise.fbm(x * 1.7 + 3, z * 1.7 + y * 0.6, 2);
    const w = clamp(smoothstep(0.25, 0.85, up) * patch * amount, 0, 1);
    col.setXYZ(i, lerp(col.getX(i), tint[0], w), lerp(col.getY(i), tint[1], w), lerp(col.getZ(i), tint[2], w));
  }
  return geo;
}

// Clamps the fog sample position to the doorway plane along the view ray, so the haze that fills
// the world does not also fill the room: seen from outside, an interior behind the door picks up
// only the airlight between the camera and the door, exactly like the wall around it. Inside the
// house (camera behind the plane) nothing changes.
const INDOOR_FOG_GLSL = /* glsl */ `
#ifdef USE_FOG
{
	vec3 kfD = vFogWorldPos - cameraPosition;
	float kfL = max( length( kfD ), 1e-4 );
	vec3 kfDir = kfD / kfL;
	float kfDen = dot( kfDir, uDoorNormal );
	float kfNum = dot( uDoorPoint - cameraPosition, uDoorNormal );
	if ( kfDen < -1e-4 && kfNum < 0.0 ) {
		vFogWorldPos = cameraPosition + kfDir * min( kfL, kfNum / kfDen );
	}
}
#endif
`;

function indoorFog<M extends MeshStandardMaterial | MeshBasicMaterial>(base: M, doorPoint: Vector3, outward: Vector3): M {
  const m = base.clone() as M;
  const uDoorPoint = { value: doorPoint.clone() };
  const uDoorNormal = { value: outward.clone().normalize() };
  // chains onto the material's own hook (the room's emissive-gradient attribute) — a clone does
  // not carry hooks, so the base's hook is taken from `base` itself
  const prev = base.onBeforeCompile;
  const prevKey = base.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uDoorPoint = uDoorPoint;
    shader.uniforms.uDoorNormal = uDoorNormal;
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nuniform vec3 uDoorPoint;\nuniform vec3 uDoorNormal;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${INDOOR_FOG_GLSL}`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}|structures:indoor-fog`;
  return m;
}

/**
 * The room seen through the doorway. Reference B (14 s) shows a hazed cavity — box (0.75–0.83,
 * 0.40–0.54) lum 0.30, sat 0.12, hue 40° — with a lamp glint and warm detail low down; sheet 04
 * draws the same doorway as a warm amber interior with lamps and shelves. Round 11: warm dark
 * wood lit from inside — an amber fill light, two pod lamps under the ceiling and an emissive
 * gradient on the walls (brightest under the arch, fading to the threshold) carried by a
 * per-vertex `aGlow` attribute that scales the material's emissive, so the glow follows the
 * room's geometry without a texture. Round 12: a dark cool recess with the amber concentrated in
 * pools round the lamps and under the arch. The airlight between the camera and the door is clamped to
 * the doorway plane (`indoorFog`) so the haze does not also fill the room. Double-sided so the
 * flat room planes need no winding.
 */
function roomMaterial(mats: StructureMaterials): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    normalMap: mats.interior.normalMap,
    normalScale: new Vector2(0.3, 0.3),
    roughness: 1,
    // Round 12: a dark COOL recess with warm pools. The reference doorway is near-neutral grey
    // (box rgb(80,77,72), sat 0.12, hue 40°) with the amber local to the lamps; at B's 18 m the
    // haze between the camera and the door contributes most of the opening's light, and that
    // airlight is yellow-olive, so the walls' own tint goes cool grey (round 11's warm 0x6e6457 /
    // 0xffd08a @ 0.17 filled the whole opening with amber, sat 0.34) and only the emissive is
    // amber. The vertex colours carry the shading, the `aGlow` attribute the pools
    color: new Color(0x3c3b3e),
    // a deeper amber than round 11's 0xffe0b8: at pool strength the pale tint read as beige
    emissive: new Color(0xffc478),
    emissiveIntensity: 0.2,
    vertexColors: true,
    side: DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;');
  };
  m.customProgramCacheKey = () => 'structures:room-glow';
  return m;
}

export function buildHouse(def: HouseDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng, shared: HouseSharedMaterials = {}): HouseBuild {
  const group = new Group();
  group.name = `house-${def.id}`;
  const noise = new Noise2D(`${ctx.config.seed}/structures/house/${def.id}`);
  const terrain = ctx.terrain;
  const R = def.trunkRadius;
  const k = R / 3.2; // detail scale relative to the hero house
  const sk = Math.sqrt(k);

  // ---- proportions (reference B at the fixed camera: lip underside at frame y ≈ 0.285 →
  // ≈ 3.1 m above the terrace, lip top ≈ 3.6 m, crown ≈ 6–6.5 m, cap ≈ 9 m wide) ----
  /** underside of the eave (soffit level at the trunk wall; reference B: frame y ≈ 0.30 → ≈ 3.0 m) */
  const eaveY = def.roofHeight * 0.46;
  /** base of the moss cap = top of the rim curl (fixed since round 8) */
  const lipTop = eaveY + 0.52 * k;
  /** how far the cap's base sits inside the rim's outer edge (the old 0.26 m roll) */
  const capInset = 0.26 * k;
  /**
   * Rim curl half-thickness (0.12 m). Round 8's 0.26 m bark roll (0.52 m tall, on top of the
   * 0.5 m eave bough hugging its underside) read in B as a broad lit beam sitting on the doorway;
   * round 11 thinned it to 0.24 m and arched the bough; round 12 drops the bark altogether — the
   * curl is moss (the reference has a ragged moss edge, then a dark shadow band with the pods in
   * it, down to the door arch). The cap base stays at `lipTop`; the curl hangs from it, and the
   * soffit meets its bottom edge (`rollBottom`).
   */
  const lipR = 0.12 * k;
  const rollBottom = lipTop - 2 * lipR;
  /** cap crown of the bare shell (moss lumps and leaf clumps add ~0.4 m on top); reference B's
   *  dome is a tall mound — at frame x 0.72–0.80 its sunlit moss runs from the eave (y 0.26) up to
   *  y 0.13, twice the height of a 0.83 crown; header estimate crown ≈ 6–6.5 m. The rim (eave,
   *  lip) and the door are fixed; `CROWN_SCALE` moves the crown alone (round 10 A/B, see below). */
  const crownY = lipTop + (def.roofHeight * 0.97 - lipTop) * CROWN_SCALE;
  /** outer radius of the rim at ×1.0: heavier overhang at the front (over the porch) than at the back */
  const capR0 = (a: number) => R * (1.3 + 0.13 * Math.cos(a));
  /** outer radius of the rim as built (round-12 rim A/B) */
  const capR = (a: number) => capR0(a) * CAP_RIM_SCALE;
  /** trunk wall top, hidden under the cap */
  const wallTop = eaveY + 0.3 * k;
  // porch: a wide recess cut into the front of the trunk under the eave, sitting a little right of
  // the axis like the reference's (its root lips at frame x ≈ 0.64–0.72 / 0.86–0.93 in B). The back
  // wall stays well forward because the plateau slope rises steeply inside the trunk on the right
  // (terrain +0.3 m at 1.2 m right of the axis, 2.2 m in; +0.8 m at 1.8 m in).
  const porchW0 = -0.56 * R;
  const porchW1 = 0.46 * R;
  const porchTop = eaveY - 0.2 * k;
  const porchRc = 0.22 * R;
  /** porch back wall depth from the centre */
  const dBack = 0.75 * R;
  /** pillar bulges of the wall at the porch edges: amplitude / gaussian width (round 12: the
   *  root lips flanking the door carry the frame's mass, so the wall's own bulge is halved) */
  const pillarA = 0.5 * k;
  const pillarS = 0.36 * k;
  // inner doorway in the porch back wall: it nearly fills the recess between the lips (in the
  // reference the cavity runs from the soffit to the ground with no wall band showing; the dark
  // region ≈ 2.2 m wide at frame x 0.72–0.86 is its interior). Round 12: WIDE and low —
  // reference B's opening is ≈ 2.2 m wide × 2.0 m tall at the threshold (width ≈ 1.15 × height;
  // round 11's 2.05 × 2.28 read as a narrow upright arch) — over a low threshold rather than a stair
  const doorW0 = -0.36 * R;
  const doorW1 = 0.38 * R;
  const sill = 0.12 * k;
  const doorH = 2.06 * sk;
  const doorTop = sill + doorH;
  /** big corner radius: the top is a broad arch that rounds straight into the root lips */
  const doorRc = 0.85 * sk;
  const wallT = 0.32 * k;
  /** round 11's opening (audit before/after) */
  const door11 = { w0: -0.3 * R, w1: 0.34 * R, h: 2.28 * sk, rc: 0.42 * sk };
  // room behind the doorway
  const roomW0 = doorW0 - 0.8 * k;
  const roomW1 = doorW1 + 0.3 * k;
  const roomFloorY = sill + 0.15 * k;
  const roomCeilY = doorTop + 0.5 * k;
  const roomFront = dBack - wallT;

  const F = new Vector3(def.facing[0], 0, def.facing[1]).normalize();
  const Rt = new Vector3(F.z, 0, -F.x);
  const cx = def.position[0];
  const cz = def.position[2];
  // floor level = ground in front of the door (the terrain pad is flat-ish here)
  const yFloor = terrain.height(cx + F.x * (R * 1.15), cz + F.z * (R * 1.15));
  const frame = new Frame(new Vector3(cx, yFloor, cz), F, Rt);

  // ground ring under the trunk: sink the base below the lowest point so nothing floats
  let ringMin = Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const p = frame.at(a, R * 1.35, 0);
    ringMin = Math.min(ringMin, terrain.height(p.x, p.z) - yFloor);
  }
  const yBase = ringMin - 0.45;

  /**
   * The room's back wall is the hollow's concave inside. Round 12: a deep recess — the reference
   * opening is dark at its centre (lum 0.12–0.18) with the glow local to the lamps, so the wall
   * the door looks at sits ≈ 3 m behind the doorway, swinging deepest in the middle. The plateau
   * slope rises inside the trunk toward the back-right, so each column pulls its wall forward
   * until the ground there stays well under the ceiling.
   */
  const _bd = new Vector3();
  const roomBackD = (w: number) => {
    const t = clamp((w - roomW0) / (roomW1 - roomW0), 0, 1);
    let d = -0.1 * R - 0.16 * R * Math.sin(Math.PI * t) + 0.06 * R * noise.noise(w * 0.9 + 2, 0.5);
    for (let i = 0; i < 16 && d < roomFront - 0.8 * k; i++) {
      frame.door(w, 0, d, _bd);
      if (terrain.height(_bd.x, _bd.z) - yFloor < roomCeilY - 0.8 * k) break;
      d += 0.15 * k;
    }
    return d;
  };
  const roomBackMin = Math.min(roomBackD(roomW0), roomBackD((roomW0 + roomW1) / 2), roomBackD(roomW1));
  /** 0 at the doorway's inner face → 1 at the deepest back wall */
  const depthOf = (p: Vector3) => clamp((roomFront - _bd.copy(p).sub(frame.C).dot(F)) / Math.max(0.5, roomFront - roomBackMin), 0, 1);

  // ---- openings (door-space lateral metres × local height) ----
  const porchSD = (w: number, y: number) => rrectSD(w, y, porchW0, porchW1, yBase - 2, porchTop, porchRc);
  // the opening's edge wanders ±7 cm (a hole gnawed in bark, not a cut frame — reference B's
  // arch is ragged where it meets the lips)
  const doorSD = (w: number, y: number) => rrectSD(w, y, doorW0, doorW1, sill - 1.5, doorTop, doorRc) - 0.07 * k * noise.noise(w * 1.6 + 9, y * 1.6 - 4);
  // small round window high on the lit left flank (sheet 04, upper left of the trunk): left of
  // the porch pillar, below the eave bough's left leg — in B at ≈ (0.67, 0.40), clear of the roof
  const winA = -0.72;
  const winY = 0.62 * eaveY;
  const winR = 0.24 * sk;

  // ---- trunk radius model ----
  const rSmooth = (a: number, y: number) => {
    const flare = 0.42 * Math.exp(-(y + 0.2) / 1.15);
    const bulge = 0.04 * smoothstep(0.5 * wallTop, wallTop, y);
    const oval = 1 + 0.045 * noise.fbm(Math.cos(a) * 1.3 + 10, Math.sin(a) * 1.3, 2) + 0.025 * noise.noise(a * 0.5, y * 0.15);
    return R * (1 + flare + bulge) * oval;
  };
  /** true door-space lateral coordinate of a wall point (chord, not arc) */
  const wOf = (a: number, r: number) => {
    const d = angleDiff(a, 0);
    return Math.abs(d) < Math.PI / 2 ? r * Math.sin(d) : Math.sign(d) * (r + 10);
  };
  /** the two pillars flanking the porch: bulges of the wall pushed out along F */
  const pillarBulge = (w: number, y: number) => {
    const g0 = Math.exp(-(((w - porchW0) / pillarS) ** 2));
    const g1 = Math.exp(-(((w - porchW1) / pillarS) ** 2));
    return pillarA * (g0 + g1) * (1 + 0.18 * Math.exp(-(y + 0.2) / 1.2));
  };
  // rope-like vertical bark cords: dense ridged noise that twists slowly with height, deep
  // furrows between cord bundles, broad lumps and fine grain
  const cords = (a: number, y: number) => {
    const arc = a * R;
    return noise.ridged(arc * 1.9 + noise.noise(y * 0.15, arc * 0.1) * 1.6 + y * 0.12, y * 0.14, 3) - 0.5;
  };
  const detail = (a: number, y: number) => {
    const arc = a * R;
    const furrow = Math.pow(Math.max(0, noise.noise(arc * 0.7 + 21, y * 0.12)), 2);
    const lumps = noise.fbm(arc * 0.35, y * 0.4, 3);
    const fine = noise.noise(arc * 3.5, y * 3.5);
    return cords(a, y) * 0.36 * k - furrow * 0.16 * k + lumps * 0.12 * k + fine * 0.015;
  };
  const winW = (a: number, r: number) => angleDiff(a, winA) * r;

  // ---- outer shell ----
  const cols = Math.round(240 * sk);
  const rows = Math.round(72 * sk);
  /**
   * The wall band under the cap's overhang (from just under the porch top up to the soffit) is
   * built as a second mesh over the same vertex grid, in the recess bark: reference B's shadow
   * band under the moss is rgb(87,73,54), lum 0.29, and under HOUSE_BARK_FLOOR ours sat at 0.39.
   */
  const bandY0 = porchTop - 0.08 * k;
  const shellVertex = (u: number, v: number, out: SurfaceSample) => {
      const a = u * TAU;
      const y = lerp(yBase, wallTop, v);
      const rs = rSmooth(a, y);
      const w = wOf(a, rs);
      const psd = porchSD(w, y);
      const wsd = Math.hypot(winW(a, rs), y - winY) - winR;
      const fade = smoothstep(0.02, 0.3, Math.min(psd, wsd));
      const r = rs + detail(a, y) * fade;
      frame.at(a, r, y, out.position);
      out.position.addScaledVector(F, pillarBulge(w, y));
      out.uv = [(a * R) / 2.2, y / 2.2];
      // bark tint: darker + mossy toward the base, subtle warm variation; cord crests carry a
      // warm highlight and furrows a dark occlusion tint so the cords still read in shade
      const base = smoothstep(1.4, -0.3, y);
      const mossy = smoothstep(0.3, 0.8, noise.fbm(a * R * 0.5, y * 0.5, 2)) * smoothstep(2.6, 0.2, y);
      const vari = 0.9 + 0.2 * noise.noise(a * R * 0.8 + 5, y * 0.8);
      const crest = clamp(cords(a, y) * 2.2, -1, 1) * fade;
      const ao = 1 + 0.55 * crest;
      // the wall band under the soffit sits in the eave's shadow; the pillars' flanks (where the
      // bulge falls off) carry an occlusion tint so they read as columns standing off the wall
      const eaveShade = 1 - 0.45 * smoothstep(porchTop - 0.8, wallTop, y);
      const slope = Math.abs(pillarBulge(w + 0.05, y) - pillarBulge(w - 0.05, y)) / (0.1 * pillarA);
      const flankAO = 1 - 0.32 * clamp(slope * 0.9, 0, 1);
      // reference B: the wall right of the porch is deep in the eave's shadow (lum 0.20–0.25 down
      // to the ground) while the trunk's left flank catches the low sun (0.40–0.47)
      const front = smoothstep(-0.3, 0.2, Math.cos(a));
      const litPillar = front * smoothstep(porchW0 + 0.1, porchW0 - 0.5, w) * smoothstep(porchW0 - 1.8, porchW0 - 1.0, w) * smoothstep(wallTop, porchTop - 1.0, y);
      // the right pillar and the wall right of the porch: the sun never reaches them and in the
      // reference they are the darkest bark in the frame (lum 0.21–0.31, hue 26–30°). Lit by the
      // leaf-filtered ambient alone ours read yellow (round 11 probes: hue 43–55°) and sat above
      // the shade floor, so the floor's warm tint never applied — the band is shaded down hard
      // (×0.5) to drop it under the floor, where the bark floor's brown takes over, and its own
      // tint is pulled warm for the texture share that still shows
      const rightSide = front * smoothstep(porchW1 - 0.7, porchW1 + 0.2, w) * smoothstep(wallTop + 0.2, wallTop - 0.8, y);
      const sideShade = lerp(1, 0.5, rightSide) * lerp(1, 1.4, litPillar);
      const shade = eaveShade * flankAO * sideShade;
      // slightly cooler than the material's warm tint: the reference bark is grey-brown, not orange
      const warm = lerp(1, 0.86, rightSide);
      const warmB = lerp(1, 0.72, rightSide);
      const rr = lerp(0.96 * vari, 0.6, base * 0.7) * ao * (1 + 0.08 * Math.max(0, crest)) * shade;
      const gg = lerp(0.97 * vari, 0.62, base * 0.6) * ao * shade * warm;
      const bb = lerp(1.0 * vari, 0.64, base * 0.6) * ao * (1 - 0.1 * Math.max(0, crest)) * shade * warmB;
      out.color = [lerp(rr, 0.55, mossy * 0.6), lerp(gg, 0.72, mossy * 0.6), lerp(bb, 0.4, mossy * 0.6)];
  };
  const shellHole = (u: number, v: number) => {
    const a = u * TAU;
    const y = lerp(yBase, wallTop, v);
    const rs = rSmooth(a, y);
    return porchSD(wOf(a, rs), y) < 0 || Math.hypot(winW(a, rs), y - winY) < winR;
  };
  const inBand = (v: number) => lerp(yBase, wallTop, v) > bandY0;
  const shellOpts = {
    cols,
    rows,
    closedU: true,
    // u runs clockwise (viewer's right) and v upward → dv × du points inward; flip to face out
    flip: true,
  };
  const outer = gridSurface(shellVertex, { ...shellOpts, hole: (u, v) => shellHole(u, v) || inBand(v) });
  const outerBand = gridSurface(shellVertex, { ...shellOpts, hole: (u, v) => shellHole(u, v) || !inBand(v) });
  const trunk = new Mesh(outer, mats.bark);
  trunk.name = 'trunk';
  trunk.castShadow = trunk.receiveShadow = true;
  group.add(trunk);
  const trunkBand = new Mesh(outerBand, mats.recessBark);
  trunkBand.name = 'trunk-eave-band';
  trunkBand.castShadow = trunkBand.receiveShadow = true;
  group.add(trunkBand);

  // ---- porch: tunnel (side walls + ceiling), back wall with the doorway, floor ----
  /** depth of the outer wall surface at lateral w */
  const dOut = (w: number, y: number) => {
    const rs = rSmooth(Math.atan2(w, rSmooth(0, y)), y);
    return Math.sqrt(Math.max(0.01, rs * rs - w * w)) + pillarBulge(w, y);
  };
  const porchParts = [];
  {
    const outline = rrectOutline(porchW0, porchW1, yBase - 0.2, porchTop, porchRc);
    // the mouth flares 8 cm outside the cut and sits 10 cm proud of the shell, so the jagged
    // cell edge of the hole is hidden behind it; at the back it meets the back wall exactly
    const tunnel = gridSurface(
      (s, q, out) => {
        const [w0, y0] = outline.at(s);
        const [w, y] = offsetAlongSD(porchSD, w0, y0, lerp(0.08, 0, q));
        const d = lerp(dOut(w, y) + 0.1, dBack - 0.02, q);
        frame.door(w, y, d, out.position);
        out.uv = [(s * outline.length) / 2.2, d / 2.2];
        // grey-brown in the recess: the warm bark map is pulled toward neutral (reference porch
        // flanks/frame ≈ (72, 78, 76)). Round 12: the recess is a dark cavity — the reference's
        // band between the moss edge and the arch sits at the haze floor (p50 0.26 in B, ours
        // rendered 0.38) — so the whole tunnel drops to ⅔ of round 11's tint
        const dark = lerp(0.4, 0.2, Math.pow(q, 0.7));
        out.color = [dark * 0.8, dark * 0.92, dark * 1.12];
      },
      { cols: 72, rows: 5 },
    );
    faceTowards(tunnel, (p, o) => frame.door((porchW0 + porchW1) / 2, Math.min(p.y - yFloor, porchTop - porchRc - 0.3), (dBack + R) / 2, o));
    porchParts.push(tunnel);
    // back wall (the doorway is cut out of it)
    const bw0 = porchW0 - 0.3;
    const bw1 = porchW1 + 0.3;
    const by0 = yBase - 0.2;
    const by1 = porchTop + 0.35;
    const back = gridSurface(
      (u, v, out) => {
        const w = lerp(bw0, bw1, u);
        const y = lerp(by0, by1, v);
        frame.door(w, y, dBack, out.position);
        out.uv = [w / 2.2, y / 2.2];
        // the recess is a dark cavity in the reference (lum 0.21–0.27 above the doorway)
        const shade = 0.2 + 0.06 * noise.noise(w * 1.3 + 4, y * 1.3) - 0.06 * smoothstep(doorTop - 0.3, porchTop, y);
        out.color = [shade * 0.8, shade * 0.92, shade * 1.12];
      },
      {
        cols: 44,
        rows: 40,
        hole: (u, v) => doorSD(lerp(bw0, bw1, u), lerp(by0, by1, v)) < 0,
      },
    );
    faceTowards(back, (p, o) => o.copy(p).addScaledVector(F, 1));
    porchParts.push(back);
    // floor: packed earth rising gently to the sill; never below the terrain inside the trunk
    const floor = gridSurface(
      (u, v, out) => {
        const w = lerp(porchW0 - 0.35, porchW1 + 0.35, u);
        const d = lerp(dBack - 0.15, dOut(w, 0) + 0.45, v);
        const ramp = lerp(sill - 0.02, 0.03, smoothstep(dBack + 0.1, dBack + 1.25 * k, d));
        frame.door(w, ramp, d, out.position);
        const th = terrain.height(out.position.x, out.position.z) + 0.05;
        if (th > out.position.y) out.position.y = th;
        out.uv = [w / 1.6, d / 1.6];
        // packed earth in the eave's shade: a grey-brown (reference threshold band lum ≈ 0.30,
        // saturation ≈ 0.1), so the warm bark map is pulled toward neutral
        const shade = 0.58 + 0.08 * noise.noise(w * 2.1, d * 2.1 + 3);
        out.color = [shade * 0.82, shade * 0.94, shade * 1.16];
      },
      { cols: 18, rows: 14 },
    );
    faceTowards(floor, (p, o) => o.set(p.x, p.y + 5, p.z));
    porchParts.push(floor);
    // doorway cut through the back wall: dark bark edges frame the lighter room behind. The
    // mouth flares outside the cut at the front and ends slightly inside it past the room's
    // front plane, hiding the jagged cell edges of both holes.
    const doorOutline = rrectOutline(doorW0, doorW1, sill - 0.4, doorTop, doorRc);
    /** the point of the (wobbly) doorSD = e iso-line nearest (w, y): a few Newton steps */
    const onDoorIso = (w: number, y: number, e: number): [number, number] => {
      const h = 0.005;
      for (let i = 0; i < 4; i++) {
        const v = doorSD(w, y) - e;
        const gx = (doorSD(w + h, y) - doorSD(w - h, y)) / (2 * h);
        const gy = (doorSD(w, y + h) - doorSD(w, y - h)) / (2 * h);
        const l2 = gx * gx + gy * gy;
        if (l2 < 1e-9 || Math.abs(v) < 1e-4) break;
        w -= (v * gx) / l2;
        y -= (v * gy) / l2;
      }
      return [w, y];
    };
    const doorTunnel = gridSurface(
      (s, q, out) => {
        const [w0, y0] = doorOutline.at(s);
        const [w, y] = onDoorIso(w0, y0, lerp(0.1, -0.06, q));
        const d = lerp(dBack + 0.04, roomFront - 0.06, q);
        frame.door(w, y, d, out.position);
        out.uv = [(s * doorOutline.length) / 2.2, d / 2.2];
        const dark = lerp(0.24, 0.14, q);
        out.color = [dark * 0.8, dark * 0.92, dark * 1.12];
      },
      { cols: 40, rows: 3 },
    );
    faceTowards(doorTunnel, (p, o) => frame.door((doorW0 + doorW1) / 2, Math.min(p.y - yFloor, doorTop - doorRc - 0.2), (dBack + roomFront) / 2, o));
    porchParts.push(doorTunnel);
  }
  // the recess bark: the same maps under a fifth of the shade floor (RECESS_BARK_FLOOR) — under
  // HOUSE_BARK_FLOOR the porch's vertex tints never showed, every shaded face sat at the floor
  const porchMesh = new Mesh(merge(porchParts), mats.recessBark);
  porchMesh.name = 'porch';
  porchMesh.castShadow = porchMesh.receiveShadow = true;
  group.add(porchMesh);

  // ---- doorway through the back wall + room behind it ----
  const doorPlanePoint = frame.door((doorW0 + doorW1) / 2, doorTop * 0.5, dBack);
  const roomMat = indoorFog(roomMaterial(mats), doorPlanePoint, F);
  const materials: Material[] = [roomMat];
  // the room's light sources: two pod lamps under the ceiling (reference B: a lamp glint at
  // frame (0.78, 0.44) ≈ 1.3 m up left of centre; sheet 04: pod lanterns inside), a bed of
  // embers glowing pink-amber low on the right, and an amber fill under the ceiling
  // Round 12: the lamps hang just in front of the deep back wall — the surface frame B looks at
  // through the door — so their pools of light show on it round the pods, over a dark recess
  const lampW = doorW0 + 0.55 * k;
  const lampY = doorTop - 0.3 * sk;
  const lampPos = frame.door(lampW, lampY, roomBackD(lampW) + 0.3 * k);
  const lamp2W = doorW1 - 0.5 * k;
  const lamp2Pos = frame.door(lamp2W, doorTop - 1.0 * sk, roomBackD(lamp2W) + 0.3 * k);
  // the hearth sits on the LOCAL floor: the generated floor lifts to terrain + 0.05 where the
  // plateau slope rises through it (see the floor grid below), and at round 12's deeper hearth
  // position that lift is ~0.15 m — a fixed sill height buried the kerb and embers (Astra, 08:00)
  const hearthPos = frame.door(doorW1 - 0.3 * k, roomFloorY + 0.2 * k, roomBackD(doorW1 - 0.3 * k) + 0.55 * k);
  hearthPos.y = Math.max(hearthPos.y, terrain.height(hearthPos.x, hearthPos.z) + 0.05 + 0.2 * k);
  /** the arch's inner top edge: the cut's underside and the jambs just inside the door catch a glow */
  const archPos = frame.door((doorW0 + doorW1) / 2, doorTop - 0.15 * k, roomFront - 0.25 * k);
  const roomParts = [];
  /**
   * Emissive gradient (scales the material's amber emissive). Round 12: LOCAL glow — tight pools
   * round the two lamps and under the arch (local peaks ≈ 0.5–0.6 in B) over a dark recess: the
   * base term is small and dies away with depth, so the back wall the door looks at stays dark
   * while the lamps read as bright points with a hand's breadth of lit wood around them. (The
   * first round-12 probe's 0.55 m pools at ×1.7 overlapped in the middle of the back wall and
   * filled the opening with pale light again — door centre p50 0.47.)
   */
  /**
   * A lamp's pool on the surfaces round it: full within `standoff` of the lamp (the wall it hangs
   * in front of gets the peak, not a third of it), then a gaussian fall-off over `radius`.
   */
  const pool = (p: Vector3, c: Vector3, standoff: number, radius: number, peak: number) => {
    const d = Math.max(0, p.distanceTo(c) - standoff) / radius;
    return peak * Math.exp(-d * d * 2.2);
  };
  const glowOf = (p: Vector3): number => {
    const h = clamp((p.y - (yFloor + roomFloorY)) / (roomCeilY - roomFloorY), 0, 1);
    const deep = depthOf(p);
    return (0.01 + 0.12 * Math.pow(h, 3)) * lerp(1, 0.35, deep) + pool(p, lampPos, 0.3 * k, 0.32 * k, 1.4) + pool(p, lamp2Pos, 0.28 * k, 0.3 * k, 1.15) + pool(p, hearthPos, 0.2 * k, 0.3 * k, 0.5) + pool(p, archPos, 0.15 * k, 0.4 * k, 0.5);
  };
  {
    // diffuse shading: dark wood, darkest deep in the recess and at the floor, a little lighter
    // toward the ceiling; the lamps' pools and the emissive gradient carry the rest
    const roomWc = (roomW0 + roomW1) / 2;
    const roomHw = (roomW1 - roomW0) / 2;
    const _p = new Vector3();
    const glowAt = (p: Vector3): [number, number, number] => {
      // the embers' pool stays pink-amber in the diffuse tint too
      const dh = p.distanceTo(hearthPos) / (0.6 * k);
      const gh = Math.exp(-dh * dh * 1.8) * 0.16;
      return [gh * 0.8, gh * 0.6, gh * 0.55];
    };
    const wallShade = (w: number, y: number, p: Vector3): [number, number, number] => {
      const lat = 1 - 0.25 * smoothstep(0.45, 1, Math.abs(w - roomWc) / roomHw);
      const s = lerp(0.1, 0.32, Math.pow(smoothstep(roomFloorY, roomCeilY, y), 1.4)) * lerp(1, 0.4, depthOf(p)) * lat;
      const g = glowAt(p);
      // cool grey (see `roomMaterial`); the embers' pool is the only warm diffuse tint
      return [s * 0.92 + g[0], s * 0.96 + g[1], s * 1.05 + g[2]];
    };
    // room's front plane (inside face of the back wall) around the doorway
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0 - 0.05, roomW1 + 0.05, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          frame.door(w, y, roomFront + 0.01, out.position);
          out.uv = [w / 2.2, y / 2.2];
          out.color = wallShade(w, y, out.position);
        },
        {
          cols: 30,
          rows: 24,
          hole: (u, v) => doorSD(lerp(roomW0 - 0.05, roomW1 + 0.05, u), lerp(roomFloorY - 0.06, roomCeilY + 0.06, v)) < 0,
        },
      ),
    );
    // back wall (the deep recess), side walls, floor, ceiling
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0, roomW1, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          frame.door(w, y, roomBackD(w), out.position);
          out.uv = [w / 2.2, y / 2.2];
          out.color = wallShade(w, y, out.position);
        },
        { cols: 24, rows: 12 },
      ),
    );
    for (const w of [roomW0, roomW1]) {
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, u);
            const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
            frame.door(w, y, d, out.position);
            out.uv = [d / 2.2, y / 2.2];
            out.color = wallShade(w, y, out.position);
          },
          { cols: 12, rows: 8 },
        ),
      );
    }
    for (const y of [roomFloorY, roomCeilY]) {
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const w = lerp(roomW0 - 0.02, roomW1 + 0.02, u);
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, v);
            frame.door(w, y, d, out.position);
            let s = (y === roomFloorY ? 0.2 : 0.3) * lerp(1, 0.4, depthOf(out.position));
            if (y === roomFloorY) {
              const th = terrain.height(out.position.x, out.position.z) + 0.05;
              if (th > out.position.y) {
                // where the plateau slope rises through the floor (rear) it stays in shadow
                s *= lerp(1, 0.35, clamp((th - out.position.y) / 0.25, 0, 1));
                out.position.y = th;
              }
            }
            out.uv = [w / 2.2, d / 2.2];
            const g = glowAt(_p.copy(out.position));
            out.color = [s * 0.92 + g[0] * 0.5, s * 0.96 + g[1] * 0.5, s * 1.05 + g[2] * 0.5];
          },
          { cols: 16, rows: 16 },
        ),
      );
    }
  }
  const roomGeo = merge(roomParts);
  {
    const pos = roomGeo.attributes.position;
    const _g = new Vector3();
    setFloatAttribute(roomGeo, 'aGlow', (i) => glowOf(_g.set(pos.getX(i), pos.getY(i), pos.getZ(i))));
  }
  const roomMesh = new Mesh(roomGeo, roomMat);
  roomMesh.name = 'interior';
  roomMesh.receiveShadow = true;
  group.add(roomMesh);

  // ---- door frame: a sill beam only. Round 12 drops round 11's posts and lintel — the thin
  // dark timber outline round the opening read in B as a neat frame; the reference opening has
  // none, its edge is bark rounding into the root lips ----
  const woodParts = [];
  {
    const sillBeam = new BoxGeometry(doorW1 - doorW0 + 0.5 * k, 0.12 * k, 0.6 * k);
    sillBeam.applyMatrix4(basisMatrix(frame.door((doorW0 + doorW1) / 2, sill - 0.03, dBack + 0.02), F));
    // grey-brown, weathered: the frame reads neutral in the reference (≈ (72, 78, 76)), so the
    // plank map's warmth is countered by a cool vertex tint
    setColorAttribute(sillBeam, [0.6, 0.62, 0.62]);
    woodParts.push(sillBeam);
  }
  const woodMesh = new Mesh(merge(woodParts), mats.wood);
  woodMesh.name = 'door-frame';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // ---- stone threshold slab at path level in front of the sill (sheet 04: the door opens on
  // the flagstones) — an irregular worn slab, grey-brown like the path stones ----
  {
    let stone = shared.stone;
    if (!stone) {
      stone = shared.stone = new MeshStandardMaterial({ color: new Color(0x9e9a8e), roughness: 1, vertexColors: true, normalMap: mats.moss.normalMap, normalScale: new Vector2(0.25, 0.25) });
      materials.push(stone);
    }
    const slabW = (doorW1 - doorW0) * 0.5 + 0.35 * k;
    const slabD = 0.42 * k;
    const slabC = frame.door((doorW0 + doorW1) / 2 + 0.05 * k, 0, dBack + 0.42 * k);
    const slabTop = Math.max(sill - 0.035, terrain.height(slabC.x, slabC.z) - yFloor + 0.07);
    const slab = new CylinderGeometry(1, 1.06, 0.12 * k, 9, 1, false);
    slab.scale(slabW, 1, slabD);
    // irregular outline: nudge the rim vertices in and out
    {
      const pos = slab.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const rr = Math.hypot(x / slabW, z / slabD);
        if (rr > 0.5) {
          const f = 1 + 0.12 * noise.noise(x * 3.1 + 7, z * 3.1 + pos.getY(i) * 4);
          pos.setXYZ(i, x * f, pos.getY(i), z * f);
        }
      }
      slab.computeVertexNormals();
    }
    slab.applyMatrix4(basisMatrix(frame.door((doorW0 + doorW1) / 2 + 0.05 * k, slabTop - 0.06 * k, dBack + 0.42 * k), F));
    // worn pale top, damp dark sides
    const col: [number, number, number][] = [];
    const pos = slab.attributes.position;
    const nrm = slab.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const up = Math.max(0, nrm.getY(i));
      const d = lerp(0.42, 0.7, up) * (0.92 + 0.16 * noise.noise(pos.getX(i) * 4, pos.getZ(i) * 4 + 2));
      col.push([d, d, d * 0.97]);
    }
    setColorAttribute(slab, (i) => col[i]);
    const slabMesh = new Mesh(slab, stone);
    slabMesh.name = 'threshold';
    slabMesh.castShadow = slabMesh.receiveShadow = true;
    group.add(slabMesh);
  }

  // ---- lamps + embers inside the room (reference glints at frame (0.78, 0.44) ≈ 1.3 m up and a
  // fainter one at (0.775, 0.49) ≈ 0.7 m up: a candle on a low table; the pink-amber glow low
  // right is a bed of embers in a stone ring). Round 11: two pod lanterns hang from the ceiling
  // on cords, one left under the arch and one lower on the right, both in the sightline through
  // the door from B; their material is the pod material with the doorway fog clamp so they read
  // as lamps in the room, not as pods in the haze. ----
  const lanterns: LanternRig[] = [];
  const roomLanternRng = rng.fork('room-lanterns');
  const roomLanternMat = indoorFog(mats.lantern, doorPlanePoint, F);
  materials.push(roomLanternMat);
  {
    const roomMats: StructureMaterials = { ...mats, lantern: roomLanternMat };
    for (const p of [lampPos, lamp2Pos]) {
      const hook = p.clone();
      hook.y = yFloor + roomCeilY - 0.02;
      const rig = buildLantern(hook, hook.y - p.y - 0.1 * sk, roomMats, roomLanternRng, 0.5 * sk, 'orange');
      group.add(rig.pivot);
      lanterns.push(rig);
    }
    const tableD = roomFront - 1.1 * k;
    const candlePos = frame.door(doorW0 + 0.7 * k, sill + 0.55 * k, tableD);
    const candle = new SphereGeometry(0.028 * sk, 10, 7);
    candle.translate(candlePos.x, candlePos.y, candlePos.z);
    const lampMesh = new Mesh(candle, mats.hearth);
    lampMesh.name = 'door-lamp';
    group.add(lampMesh);
    // low table under the candle: a slab on a block, dark silhouettes that give the room depth
    const slab = new BoxGeometry(0.7 * k, 0.05 * k, 0.45 * k);
    slab.applyMatrix4(basisMatrix(frame.door(doorW0 + 0.7 * k, sill + 0.5 * k, tableD), F));
    setColorAttribute(slab, [0.22, 0.21, 0.2]);
    const block = new BoxGeometry(0.22 * k, 0.5 * k, 0.22 * k);
    block.applyMatrix4(basisMatrix(frame.door(doorW0 + 0.7 * k, sill + 0.25 * k, tableD), F));
    setColorAttribute(block, [0.16, 0.15, 0.14]);
    // a shelf on the back wall left (sheet 04: shelves inside), a dark ledge the lamp glow catches
    const shelfW = doorW0 + 0.3 * k;
    const shelf = new BoxGeometry(0.9 * k, 0.04 * k, 0.22 * k);
    shelf.applyMatrix4(basisMatrix(frame.door(shelfW, doorTop - 0.3 * sk, roomBackD(shelfW) + 0.13 * k), F));
    setColorAttribute(shelf, [0.24, 0.22, 0.2]);
    // ember ring: a low stone kerb round the glow
    const kerb = new TorusGeometry(0.2 * k, 0.05 * k, 6, 12);
    kerb.rotateX(Math.PI / 2);
    kerb.translate(hearthPos.x, hearthPos.y - 0.14 * k, hearthPos.z);
    setColorAttribute(kerb, [0.18, 0.18, 0.18]);
    const furnitureMesh = new Mesh(merge([slab, block, shelf, kerb]), mats.woodDark);
    furnitureMesh.name = 'door-lamp-cord';
    group.add(furnitureMesh);
    // the embers themselves (dim orange) and a small soft pink-amber halo facing the door — kept
    // small so the doorway as a whole stays neutral (reference box saturation ≈ 0.1)
    const embers = new SphereGeometry(0.045 * k, 10, 6);
    embers.scale(1, 0.35, 1);
    embers.translate(hearthPos.x, hearthPos.y - 0.12 * k, hearthPos.z);
    const emberMesh = new Mesh(embers, mats.hearth);
    emberMesh.name = 'door-embers';
    group.add(emberMesh);
    const halo = new PlaneGeometry(0.22 * k, 0.16 * k);
    halo.applyMatrix4(basisMatrix(hearthPos.clone().addScaledVector(F, 0.05), F));
    const haloMesh = new Mesh(halo, mats.ember);
    haloMesh.name = 'door-ember-glow';
    group.add(haloMesh);
  }
  const lights: PointLight[] = [];
  // Round 11: the room is lit from inside — reference B's opening is a warm amber glow, a lit
  // back wall with visible depth, brightest under the arch and fading to the threshold (sheet 04
  // draws the same). Round 12: the light stays LOCAL — the lamp light shapes the pool round the
  // upper pod, the short-range fill under the ceiling lights the arch and the near walls; neither
  // reaches the deep back wall, which stays a dark recess (reference: p50 0.30, centre 0.12–0.18).
  const doorLight = new PointLight(0xffd8a0, 0.28 * k, 1.7 * k, 2);
  doorLight.position.copy(lampPos).addScaledVector(F, 0.1);
  doorLight.name = 'door-light';
  group.add(doorLight);
  lights.push(doorLight);
  // the "fill" sits just inside the arch, a little below it: it lights the jambs and the
  // threshold (the reference spills warm light there), not the recess. (At `archPos` itself, a
  // few centimetres under the arch's inner edge, the inverse-square falloff blew that edge out
  // to a pale band in the first round-12 probe.)
  const fillLight = new PointLight(0xffd8a8, 0.15 * k, 1.6 * k, 2);
  fillLight.position.copy(frame.door((doorW0 + doorW1) / 2, doorTop - 0.55 * k, roomFront - 0.5 * k));
  fillLight.name = 'room-fill';
  group.add(fillLight);
  lights.push(fillLight);
  // pink-amber ember glow low right (reference doorway crop): short range, low on the floor
  const emberLight = new PointLight(0xf5cfc0, 0.08 * k, 1.0 * k, 2);
  emberLight.position.copy(hearthPos);
  emberLight.name = 'ember-light';
  group.add(emberLight);
  lights.push(emberLight);

  // ---- round window: socket + glow + wooden ring ----
  {
    const O = frame.dir(winA);
    const surf = frame.at(winA, rSmooth(winA, winY) + 0.02, winY);
    // shallow socket: B and A look at this flank at 50–60° off its normal, so a deep socket
    // would hide the glow behind its near rim
    const socketD = 0.08 * k;
    const socket = new CylinderGeometry(winR, winR, socketD + 0.1, 24, 1, true);
    socket.rotateX(Math.PI / 2);
    socket.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -(socketD + 0.1) / 2 + 0.02), O));
    const socketMesh = new Mesh(socket, mats.interior);
    socketMesh.name = 'window-socket';
    group.add(socketMesh);
    const glass = new CircleGeometry(winR, 24);
    glass.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -socketD), O));
    const glassMesh = new Mesh(glass, mats.windowGlow);
    glassMesh.name = 'window-glow';
    group.add(glassMesh);
    const ring = new TorusGeometry(winR + 0.03, 0.065, 8, 28);
    ring.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, 0.02), O));
    const ringMesh = new Mesh(ring, mats.woodDark);
    ringMesh.name = 'window-frame';
    ringMesh.castShadow = ringMesh.receiveShadow = true;
    group.add(ringMesh);
  }

  // ---- buttress roots seated on the terrain ----
  const bases: [number, number, number][] = [];
  const rootParts = [];
  const rootCount = def.id === 'saria' ? 6 : 5;
  const rootRng = rng.fork('roots');
  for (let i = 0; i < rootCount; i++) {
    const a = 0.8 + (i / (rootCount - 1)) * (TAU - 1.6) + (rootRng() - 0.5) * 0.25;
    const y0 = 0.55 + rootRng() * 0.7;
    const r0 = (0.3 + rootRng() * 0.14) * k;
    const reach = R * (0.55 + rootRng() * 0.4);
    const rs0 = rSmooth(a, 0);
    const dir = frame.dir(a);
    const side = new Vector3(dir.z, 0, -dir.x).multiplyScalar((rootRng() - 0.5) * 0.7);
    const p0 = frame.at(a, rSmooth(a, y0) - 0.4, y0);
    const p1 = frame.at(a, rSmooth(a, y0 * 0.65) + 0.1, y0 * 0.66);
    const p2 = frame.at(a, rs0 + reach * 0.45, 0).addScaledVector(side, 0.5);
    p2.y = terrain.height(p2.x, p2.z) + 0.28 * k;
    const p3 = frame.at(a, rs0 + reach, 0).add(side);
    p3.y = terrain.height(p3.x, p3.z);
    const p4 = frame.at(a, rs0 + reach + 0.6, 0).addScaledVector(side, 1.3);
    p4.y = terrain.height(p4.x, p4.z) - 0.4;
    const curve = new CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'catmullrom', 0.5);
    const rootN = 4.5 + rootRng() * 3;
    const root = sweepTube(curve, {
      radius: (t) => r0 * (1 - 0.72 * t) * (0.9 + 0.2 * Math.abs(Math.sin(t * rootN))),
      tubularSegments: 22,
      radialSegments: 11,
      uvMetres: 1.4,
      displace: (t, ang) => (noise.ridged(ang * 1.2 + i * 3.1, t * 6, 2) - 0.5) * 0.05 * k * (1 - 0.5 * t),
      color: (t) => {
        const d = lerp(0.72, 0.58, t);
        return [d, d * 0.95, d * 0.85];
      },
      capEnd: true,
    });
    // moss on the root lips (reference B lower-left root: olive, hue 53°, against the 27–34° bark)
    rootParts.push(mossOnTop(root, [0.5, 0.64, 0.3], 0.55, noise));
    bases.push([p3.x, p3.y, p3.z]);
  }
  // ---- root lips (round 12): two thick buttress roots frame the doorway. Reference B's opening
  // is framed by root-like bark lips — thick, curving, flaring outward at the ground and curving
  // up and inward into the moss cap; nothing horizontal sits over the door. They hug the JAMBS:
  // at door height each lip's axis sits 0.34 m outside the jamb line, just in front of the
  // porch's back wall, so its inner face overlaps the cut (no wall band shows between root and
  // opening — the first round-12 probe, with the lips out at the porch edges, left the opening
  // reading as a smooth-rimmed rounded rectangle). From there each root leans forward and
  // outward to a foot `lipFlare` outside the jamb line on the terrain in front of the trunk, and
  // its top curves in over the arch's shoulder into the moss rim, so the arch rounds into the
  // roots and the door reads as an opening between two roots under an overhanging moss cap. ----
  const lipFlare = 0.55 * k;
  const lipRng = rng.fork('lips');
  for (const side of [-1, 1] as const) {
    const jamb = side < 0 ? doorW0 : doorW1;
    const wAxis = jamb + side * 0.34 * k;
    const jit8 = () => (lipRng() - 0.5) * 0.08 * k;
    const wFoot = wAxis + side * lipFlare;
    const dFoot = dOut(wFoot, 0);
    const foot = frame.door(wFoot, 0, dFoot + 0.4 * k);
    foot.y = terrain.height(foot.x, foot.z);
    const pts = [
      frame.door(wFoot + side * 0.35 * k, -0.5 * k, dFoot + 0.55 * k),
      foot,
      frame.door(wAxis + side * 0.3 * k + jit8(), 0.8 * k, dBack + 0.45 * k + jit8()),
      frame.door(wAxis + jit8(), 1.7 * k, dBack + 0.3 * k + jit8()),
      frame.door(wAxis - side * 0.18 * k + jit8(), doorTop + 0.4 * k, dBack + 0.24 * k),
      frame.door(wAxis - side * 0.6 * k, lipTop + 0.25 * k, dBack + 0.1 * k),
    ];
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const lipR = (t: number) => (0.5 - 0.2 * t) * k * (1 + 0.1 * Math.sin(t * 11 + side) + 0.05 * Math.sin(t * 27 + 2 * side));
    // the cord relief of the vertex being placed (sweepTube colours a vertex right after displacing it)
    let lipCrest = 0;
    const lip = sweepTube(curve, {
      radius: lipR,
      tubularSegments: 30,
      radialSegments: 13,
      uvMetres: 1.4,
      // deep longitudinal cords, softening toward the foot
      displace: (t, ang, pos) => {
        lipCrest = noise.ridged(ang * 1.4 + side * 2.3, t * 5 + pos.y * 0.3, 2) - 0.5;
        return lipCrest * 0.09 * k * (0.6 + 0.4 * t);
      },
      color: (t, ang) => {
        // bark in the porch's shade (reference lips: lum 0.36–0.38, hue 27–34°, sat ≈ 0.32–0.40,
        // p10 0.22–0.28 / p90 0.47): cord crests lit, furrows dark — the first probe's flat
        // 0.74 tint rendered p10 0.34 / p90 0.37, a smooth pale column — darker where the lip
        // sinks under the rim
        const crest = clamp(lipCrest * 2.4, -1, 1);
        const d = lerp(0.56, 0.38, smoothstep(0.5, 1, t)) * (0.76 + 0.3 * Math.max(0, Math.sin(ang))) * (1 + 0.5 * crest);
        return [d, d * 0.95, d * 0.88];
      },
      capEnd: true,
    });
    rootParts.push(mossOnTop(lip, [0.5, 0.64, 0.3], 0.35, noise));
    bases.push([foot.x, foot.y, foot.z]);
  }
  const rootsMesh = new Mesh(merge(rootParts), mats.bark);
  rootsMesh.name = 'roots';
  rootsMesh.castShadow = rootsMesh.receiveShadow = true;
  group.add(rootsMesh);

  // ---- roof: low broad mushroom cap of moss with a curled rim and a dark soffit ----
  // v ∈ [0, V_CAP] is the cap top (q = v / V_CAP is the normalised radius: flat crown, rounded
  // shoulder — (1 − q³)^1.5), (V_CAP, 1] curls round the rim from its top to its underside.
  // Round 12: the rim is MOSS all the way round to the soffit — the round-8/11 bark roll under it
  // read in B as a horizontal eave beam; the reference cap's moss edge simply overhangs.
  const V_CAP = 0.72;
  const capHeight = crownY - lipTop;
  /** the bare cap at an arbitrary rim / crown scale (the audit compares against ×1.0 / ×1.0) */
  const domeBaseS = (a: number, v: number, out: Vector3, rimScale: number, crownScale: number) => {
    const rc = capR0(a) * rimScale - capInset;
    let r: number;
    let y: number;
    if (v <= V_CAP) {
      const q = v / V_CAP;
      // Round 12: a mushroom-cap profile — flat top, rounded shoulder falling to the rim
      // ((1 − q⁴)^1.3; the round-8 (1 − q³)^1.5 rose to a point from B's low viewpoint)
      const prof = Math.pow(Math.max(0, 1 - q * q * q * q), 1.3);
      r = rc * q;
      y = lipTop + (capHeight / CROWN_SCALE) * crownScale * prof;
      frame.dir(a, out).multiplyScalar(r).add(frame.C);
      out.y += y;
      // the crown leans a little toward the back; the cap sags unevenly (back-left heavier)
      out.addScaledVector(F, -0.35 * k * prof);
      out.y -= (0.1 + 0.12 * Math.sin(a + 2.2)) * smoothstep(0.25, 1, q) * k;
    } else {
      const phi = ((v - V_CAP) / (1 - V_CAP)) * Math.PI;
      r = rc + lipR * Math.sin(phi);
      y = rollBottom + lipR * (1 + Math.cos(phi));
      frame.dir(a, out).multiplyScalar(r).add(frame.C);
      out.y += y;
      out.y -= (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
    }
    return out;
  };
  const domeBase = (a: number, v: number, out = new Vector3()) => domeBaseS(a, v, out, CAP_RIM_SCALE, CROWN_SCALE);
  const _da = new Vector3();
  const _db = new Vector3();
  const domeNormal = (a: number, v: number, out = new Vector3()) => {
    // outward normal of the undisplaced cap from finite differences
    const e = 0.008;
    domeBase(a + e, v, _da).sub(domeBase(a - e, v, _db));
    const v0 = Math.max(0.001, v - e);
    const v1 = Math.min(1, v + e);
    domeBase(a, v1, out).sub(domeBase(a, v0, _db));
    out.cross(_da);
    if (out.lengthSq() < 1e-10) return out.set(0, 1, 0); // crown pole
    out.normalize();
    // orient outward: compare with the coarse direction (up on the cap, out/down round the lip)
    const phi = v <= V_CAP ? (v / V_CAP) * 0.9 : Math.PI / 2 + ((v - V_CAP) / (1 - V_CAP)) * Math.PI * 0.5;
    if (out.dot(frame.dir(a, _db).multiplyScalar(Math.sin(phi)).setY(Math.cos(phi))) < 0) out.negate();
    return out;
  };
  const domeDisp = (p: Vector3, v: number) => {
    const onCap = smoothstep(1, 0.66, v);
    const lumps = noise.fbm(p.x * 0.5, p.z * 0.5 + p.y * 0.3, 3) * 0.22 * k * (0.35 + 0.65 * onCap);
    // Round 11: mid-frequency mounds (≈ ±0.15 m, 2–4 m across) so the crown's silhouette is
    // lumpy — reference B / sheet 04 show an irregular mossy mound, not a smooth tent
    const mounds = noise.noise(p.x * 0.8 + 17, p.z * 0.8 - 6) * 0.22 * k * onCap;
    const cushions = (noise.ridged(p.x * 1.2 + 3, p.z * 1.2, 2) - 0.5) * 0.2 * k * smoothstep(0.85, 0.2, v);
    // small clumps: the crown is a mass of leaf clusters, so the surface itself is knobbly
    const clumps = (noise.ridged(p.x * 2.2 + 8, p.z * 2.2 + p.y * 0.5, 2) - 0.5) * 0.12 * k * onCap;
    const fine = noise.noise(p.x * 2.4, p.z * 2.4 + p.y) * 0.04;
    return lumps + mounds + cushions + clumps + fine;
  };
  const _n = new Vector3();
  // vertex pitch ≈ 0.09 m at the rim (≈ 5 px in B): the moss grain lives in the vertex colours
  const roofRes = Math.round(300 * sk);
  const roofRows = Math.round(roofRes * 0.4);
  /**
   * Straw patches: the patch noise above `THATCH_THRESHOLD` shows the straw (roof) material,
   * everything else is moss. Decided per cell (both cap meshes share the vertex grid, so the
   * patches partition the surface without cracks); no straw on the rim curl.
   */
  const patchNoise = (p: Vector3) => noise.noise(p.x * 0.9 + 23, p.z * 0.9 + 5);
  const thatchAt = (p: Vector3, v: number) => smoothstep(THATCH_THRESHOLD, THATCH_THRESHOLD + 0.25, patchNoise(p)) * smoothstep(0.95, 0.7, v);
  const _tc = new Vector3();
  const isThatchCell = (u: number, v: number) => {
    domeBase(u * TAU, v, _tc);
    return thatchAt(_tc, v) > 0.5;
  };
  /** area-weighted straw share of the cap top (accumulated while the moss mesh's cells are decided) */
  let thatchArea = 0;
  let mossArea = 0;
  /** ...and the share round 11 tinted as straw (its mix passed ½ where the same noise exceeded 0.55) */
  let thatch11Area = 0;
  const _c0 = new Vector3();
  const _c1 = new Vector3();
  const _c2 = new Vector3();
  const cellArea = (u: number, v: number) => {
    const du = 0.5 / roofRes;
    const dv = 0.5 / (roofRows - 1);
    domeBase(u * TAU, v, _c0);
    domeBase((u + du) * TAU, v, _c1).sub(_c0);
    domeBase(u * TAU, Math.min(1, v + dv), _c2).sub(_c0);
    return _c1.cross(_c2).length() * 4;
  };
  const domeVertex = (a: number, v: number, out: SurfaceSample, straw: boolean) => {
    domeBase(a, v, out.position);
    domeNormal(a, v, _n);
    const disp = domeDisp(out.position, v);
    out.position.addScaledVector(_n, disp);
    // uneven droop of the rim
    const lip = smoothstep(V_CAP, 1, v);
    out.position.y -= lip * (0.06 + 0.1 * noise.noise(a * R * 1.1, 3.3) + 0.05 * noise.noise(a * R * 4, 7)) * k;
    out.uv = [(a * capR(a)) / 1.6, (v * (capHeight + 4 * lipR)) / 1.6];
    const p = out.position;
    if (straw) {
      // dry straw showing through the moss (vertex tint × the straw map); round 12: −25 % albedo
      const strawTone = (0.9 + 0.2 * noise.noise(p.x * 2.5, p.y * 2.5 + 4)) * THATCH_ALBEDO;
      out.color = [0.66 * strawTone, 0.55 * strawTone, 0.26 * strawTone];
      return;
    }
    const patches = noise.fbm(p.x * 0.8 + 11, p.z * 0.8, 2);
    const upness = smoothstep(0.05, 0.9, _n.y);
    // lit crowns of the clumps vs shaded hollows and flanks: a steep curve so the cap reads
    // as many small lit/dark tufts rather than a smooth skin
    const bright = clamp(Math.pow(upness, 1.4) * (0.35 + 0.65 * (0.5 + 0.5 * noise.noise(p.x * 1.3, p.z * 1.3 + 9))) + 0.6 * (disp / (0.25 * k)), 0, 1);
    // Round 12: the cap is built in the plain moss material, so the vertex colour IS the albedo
    // (no straw map with its stalks under it — that map is what made round 11's moss read as
    // thatch). The reference moss is a fine grainy mass: a per-vertex grain of lit specks and
    // dark pits at the vertex pitch (≈ 0.12 m) carries that at B's distance.
    const speck = smoothstep(0.45, 0.9, noise.noise(p.x * 3.2 + 31, p.z * 3.2 + p.y * 1.5));
    // pits at the vertex pitch: near-uncorrelated between neighbours, so they read as dark dots
    const pit = smoothstep(0.3, 0.8, noise.noise(p.x * 13 + 41, p.z * 13 + p.y * 4));
    const fleck = smoothstep(0.55, 0.9, noise.noise(p.x * 11 + 7, p.z * 11 - p.y * 3));
    const grain = (0.78 + 0.44 * (0.5 + 0.5 * noise.noise(p.x * 9.1, p.z * 9.1 + p.y * 3))) * (1 - 0.6 * pit) * (1 + 0.35 * fleck);
    const mottle = (0.66 + 0.4 * noise.fbm(p.x * 0.38 + 5, p.z * 0.38 - 2, 2) + 0.14 * noise.noise(p.x * 3.1, p.z * 3.1 + 1)) * (1 - 0.35 * speck) * grain;
    // olive albedos (linear): deep grey-olive in the hollows and down the flanks, saturated
    // yellow-olive on the lit tufts (reference B pure moss face rgb(131,124,77): lum 0.48, sat
    // 0.42, hue 51° — the round-11 cap rendered at sat 0.34–0.36, a paler, beige read)
    // (the first round-12 probe rendered the lit face at hue 56°, 5° greener than the reference,
    // so the sunlit tone leans a little warmer)
    const deep: [number, number, number] = [0.06, 0.062, 0.008];
    const sun: [number, number, number] = [0.88, 0.67, 0.05];
    // reference B: the cap's shoulder right above the rim is its brightest band (lum 0.45–0.7,
    // sun on the moss; box p90 ≈ 0.55), the crown under the canopy is darker (box p10 ≈ 0.20 —
    // ours 0.32 with the crown at 0.7, so it drops to 0.5); the front face over the porch — the
    // dome frame B looks at — is sunlit moss (roof-only box p50 ≈ 0.48), so it carries an extra lift
    const frontFace = smoothstep(1.5, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.15, 0.4, v);
    const shoulder = lerp(0.5, 1.6, smoothstep(0.2, 0.62, v)) * (1 + 0.85 * frontFace);
    const flank = lerp(0.4, 1, smoothstep(-0.2, 0.8, _n.y)) * shoulder;
    // the rim curl darkens toward its underside (the moss edge over a dark shadow band)
    const under = smoothstep(0.8, 0.97, v);
    const rimShade = lerp(1, 0.35, under) * (1 - 0.3 * smoothstep(0.4, 0.7, patches) * smoothstep(0.55, V_CAP, v));
    const m = flank * rimShade;
    out.color = [lerp(deep[0], sun[0], bright) * mottle * m, lerp(deep[1], sun[1], bright) * mottle * m, lerp(deep[2], sun[2], bright) * mottle * m];
  };
  const domeMoss = gridSurface((u, v, out) => domeVertex(u * TAU, v, out, false), {
    cols: roofRes,
    rows: roofRows,
    closedU: true,
    hole: (u, v) => {
      const straw = isThatchCell(u, v);
      if (v <= V_CAP) {
        const area = cellArea(u, v);
        if (straw) thatchArea += area;
        else mossArea += area;
        if (smoothstep(0.35, 0.75, patchNoise(_tc)) * smoothstep(1, 0.7, v) > 0.5) thatch11Area += area;
      }
      return straw;
    },
  });
  const domeStraw = gridSurface((u, v, out) => domeVertex(u * TAU, v, out, true), {
    cols: roofRes,
    rows: roofRows,
    closedU: true,
    hole: (u, v) => !isThatchCell(u, v),
  });
  const thatchFraction = thatchArea / Math.max(1e-6, thatchArea + mossArea);
  const thatchFraction11 = thatch11Area / Math.max(1e-6, thatchArea + mossArea);
  // cap silhouette for the audit (projected rim width / crown height in B), as built and at ×1.0
  const cap: CapProfile = (() => {
    const sample = (rimScale: number, crownScale: number) => {
      const p = new Vector3();
      const n = new Vector3();
      const at = (a: number, v: number): P3 => {
        domeBaseS(a, v, p, rimScale, crownScale);
        // the displacement is evaluated on the scaled shell (the same noise the mesh uses)
        const disp = domeDisp(p, v);
        domeNormal(a, v, n);
        return p.addScaledVector(n, disp).toArray() as P3;
      };
      const rim: P3[] = [];
      for (let i = 0; i < 48; i++) rim.push(at((i / 48) * TAU, V_CAP));
      let crownTop: P3 = at(0, 0);
      const shell: P3[] = [];
      for (let i = 0; i < 36; i++)
        for (let j = 0; j <= 8; j++) {
          const q = at((i / 36) * TAU, (j / 8) * 0.64);
          if (q[1] > crownTop[1]) crownTop = q;
          shell.push(q.map((x) => Math.round(x * 1000) / 1000) as P3);
        }
      return { rim, crownTop, shell, rimFront: at(0, V_CAP), rimBack: at(Math.PI, V_CAP) };
    };
    const now = sample(CAP_RIM_SCALE, CROWN_SCALE);
    const wall = (a: number) => rSmooth(a, eaveY) + pillarBulge(wOf(a, rSmooth(a, eaveY)), eaveY) * Math.max(0, Math.cos(a));
    const over = (a: number) => capR(a) - capInset + lipR - wall(a);
    return {
      rimScale: CAP_RIM_SCALE,
      crownScale: CROWN_SCALE,
      ...now,
      overhang: { front: over(0), side: (over(Math.PI / 2) + over(-Math.PI / 2)) / 2, back: over(Math.PI) },
      thatchFraction,
      thatchFraction11,
      round11: sample(1, 1),
    };
  })();
  // soffit: the dark underside from the rim curl's inner bottom edge back to the trunk wall (it
  // meets the wall just under `wallTop`, so the wall band above the porch is in its shadow)
  const soffitY = (a: number, r: number) => {
    const rc = capR(a) - capInset;
    const rw = rSmooth(a, eaveY) - 0.1;
    return rollBottom + (wallTop - 0.02 * k - rollBottom) * clamp((rc - r) / Math.max(0.1, rc - rw), 0, 1) - (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
  };
  /** the round-10 soffit (outer edge at `eaveY`, rising 0.12 m to the wall): pod hooks on it keep their pods put */
  const soffitYRound10 = (a: number, r: number) => {
    const rc = capR0(a) - capInset;
    const rw = rSmooth(a, eaveY) - 0.1;
    return eaveY + 0.12 * k * clamp((rc - r) / Math.max(0.1, rc - rw), 0, 1) - (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
  };
  const soffit = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rc = capR(a) - capInset;
      const rs = rSmooth(a, eaveY);
      const r = lerp(rc, rs - 0.1, v);
      frame.at(a, r, soffitY(a, r), out.position);
      out.position.addScaledVector(F, pillarBulge(wOf(a, rs), eaveY) * v);
      out.uv = [(a * rc) / 1.6, v * 2];
      out.color = [0.3, 0.27, 0.22];
    },
    { cols: 72, rows: 3, closedU: true },
  );
  faceTowards(soffit, (p, o) => o.set(p.x, p.y - 5, p.z));
  const roofMesh = new Mesh(domeMoss, mats.moss);
  roofMesh.name = 'roof';
  roofMesh.castShadow = roofMesh.receiveShadow = true;
  group.add(roofMesh);
  const strawMesh = new Mesh(domeStraw, mats.roof);
  strawMesh.name = 'roof-straw';
  strawMesh.castShadow = strawMesh.receiveShadow = true;
  group.add(strawMesh);
  const eaveMesh = new Mesh(soffit, mats.recessBark);
  eaveMesh.name = 'roof-eave';
  eaveMesh.castShadow = eaveMesh.receiveShadow = true;
  group.add(eaveMesh);

  // ---- living branches curling over the cap (pale bark) + limbs + chimney branch ----
  const branchRng = rng.fork('branches');
  const surfacePoint = (a: number, v: number, lift: number) => {
    const p = domeBase(a, v);
    const n = domeNormal(a, v);
    return p.addScaledVector(n, domeDisp(p, v) * 0.6 + lift);
  };
  type BranchDef = { path: [number, number][]; r0: number; r1: number; leavesAt: number[] };
  // (angle around the house, cap parameter v) waypoints for the pale draped limbs: one comes over
  // the right shoulder and stops on the crown; two shorter side branches curl up into leafy tips.
  // (The big arc over the crown is the living support bough below, in the trunk's bark.)
  const branchDefs: BranchDef[] = [
    { path: [[2.7, 0.75], [2.35, 0.55], [1.95, 0.42], [1.5, 0.33], [1.15, 0.29], [0.95, 0.23]], r0: 0.34, r1: 0.12, leavesAt: [1] },
    { path: [[-1.75, 0.44], [-1.4, 0.5], [-1.05, 0.6], [-0.85, 0.68], [-0.8, 0.7]], r0: 0.24, r1: 0.08, leavesAt: [1] },
    { path: [[3.1, 0.67], [2.85, 0.48], [2.55, 0.32], [2.2, 0.23], [2.0, 0.25]], r0: 0.3, r1: 0.1, leavesAt: [1] },
  ];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/house/${def.id}`);
  const branchParts = [];
  const leafTint: [number, number, number] = [0.62, 0.7, 0.36];
  // dark grey-brown limb bark (willow set, darkened): the reference limbs are as dark as the
  // shaded trunk but cooler/greyer than its warm bark — dark branches lying on a bright dome
  const limbColor = (t: number, ang: number): [number, number, number] => {
    const d = lerp(0.36, 0.44, t) * (0.8 + 0.35 * Math.max(0, Math.sin(ang)));
    return [d, d * 0.93, d * 0.86];
  };
  for (let bi = 0; bi < branchDefs.length; bi++) {
    const b = branchDefs[bi];
    const pts = b.path.map(([a, v], idx) => {
      const r = lerp(b.r0, b.r1, idx / (b.path.length - 1)) * k;
      // half-sunk into the moss, wandering sideways a little between waypoints
      const lift = r * 0.3 + (branchRng() - 0.5) * 0.08 + (idx % 2 ? 0.05 : 0) * k;
      return surfacePoint(a + (branchRng() - 0.5) * 0.16, clamp(v + (branchRng() - 0.5) * 0.03, 0.02, 0.98), lift);
    });
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const twist = branchRng() * 10;
    const geo = sweepTube(curve, {
      radius: (t) => lerp(b.r0, b.r1, t) * k * (1 + 0.14 * Math.sin(t * 9 + twist) + 0.08 * Math.sin(t * 23 + twist * 2)),
      tubularSegments: 48,
      radialSegments: 12,
      uvMetres: 1.2,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.4 + t * 4 + bi, pos.y * 1.5, 2) - 0.5) * 0.08 * k,
      color: limbColor,
      capEnd: true,
    });
    branchParts.push(geo);
    for (const at of b.leavesAt) {
      const p = curve.getPointAt(at);
      foliage.addLeafCluster(p, 0.55 * k, 44, { size: 0.13, amount: 0.06, droop: 0.55, tint: leafTint, tintSpread: 0.28 });
      // a couple of short vines trail from each leafy tip
      for (let s = 0; s < 2; s++) {
        const hook = p.clone().add(new Vector3((branchRng() - 0.5) * 0.4, -0.1, (branchRng() - 0.5) * 0.4));
        foliage.addHangingVine(hook, 0.45 + branchRng() * 0.55, { amount: 0.1 });
      }
    }
  }
  // ---- living support boughs in the trunk's own bark (sheet 04 "Natural wooden supports
  // (branches)"; reference B: a thick dark branch rises up the left of the frame and runs across
  // the TOP band above the moss dome, while the dome itself is a smooth sunlit cap) ----
  // Two gnarled boughs grow out of the roots: the ARC rises up the left flank to the eave, climbs
  // the left shoulder and arches over the front of the cap, well clear of the moss — in B a thick
  // dark limb from the lip's left edge (0.61, 0.3) up and across the top band above the dome's
  // silhouette — and sinks back into the cap behind the right shoulder; the EAVE BOUGH runs along
  // the front lip above the porch, its ends sinking into the lip roll, and the pod lanterns hang
  // from its underside. Both are half-buried in moss on top.
  const supportParts: BufferGeometry[] = [];
  const supportColor = (t: number, ang: number): [number, number, number] => {
    // the trunk's bark, a shade darker than the wall (the boughs are always in the eave's or
    // the canopy's shade), lit along the top
    const d = 0.74 * (0.82 + 0.3 * Math.max(0, Math.sin(ang)));
    return [d, d * 0.95, d * 0.88];
  };
  /** the limbs above the eave sit in the canopy's shade: reference B reads them at lum
   *  0.27–0.35 against the hazed canopy (0.45–0.5), so their bark is held well below the sunlit
   *  legs' — `shade` 0 = sunlit, 1 = fully shaded */
  const shadedColor = (t: number, ang: number, shade: number): [number, number, number] => supportColor(t, ang).map((c) => c * lerp(1, 0.42, shade)) as [number, number, number];
  const mossTint: [number, number, number] = [0.5, 1.12, 0.34];
  /** ground contact of a leg at angle a, just outside the flared trunk foot */
  const legFoot = (a: number, out = 0.35) => {
    const p = frame.at(a, rSmooth(a, 0) + out * k, 0);
    p.y = terrain.height(p.x, p.z);
    return p;
  };
  const jit = (s: number) => new Vector3((branchRng() - 0.5) * s, (branchRng() - 0.5) * s * 0.5, (branchRng() - 0.5) * s);
  /** where the arc's left leg passes the eave (the eave bough's left end meets it here) */
  const arcEavePoint = frame.at(-1.2, capR(-1.2) + 0.3 * k, eaveY - 0.1 * k);
  {
    const aL = -1.32;
    const footL = legFoot(aL);
    const arcPts = [
      footL.clone().setY(footL.y - 0.4),
      footL,
      frame.at(aL + 0.04, rSmooth(aL, 0.4 * eaveY) + 0.22 * k, 0.4 * eaveY).add(jit(0.12)),
      arcEavePoint.clone(),
      // climbing the left shoulder, then arching over the FRONT of the cap 1.5 m clear of the
      // moss: frame B looks up at it, so it runs as a thick dark limb across the top band —
      // (0.61, 0.25) → (0.66, 0.10) → (0.76, 0.05) → (0.86, 0.06) → (0.92, 0.11) — above the
      // dome's silhouette, like the reference's near limb, and from the stairs (A) it arches
      // over the crown the same way
      frame.at(-1.45, capR(-1.45) + 0.2 * k, lipTop + 1.1 * k).add(jit(0.1)),
      frame.at(-1.25, capR(-1.25) + 0.1 * k, crownY - 0.5 * k).add(jit(0.1)),
      frame.at(-0.7, 0.9 * capR(-0.7), crownY - 0.45 * k).add(jit(0.1)),
      frame.at(-0.1, 0.8 * capR(-0.1), crownY - 0.5 * k).add(jit(0.08)),
      frame.at(0.45, 0.82 * capR(0.45), crownY - 0.7 * k).add(jit(0.08)),
      // ...and sinks back into the moss behind the right shoulder (in B behind the HUD box; in A
      // a short drop onto the dome's right, where the reference has only bright haze above)
      frame.at(0.7, 0.92 * capR(0.7), crownY - 1.3 * k).add(jit(0.08)),
      frame.at(0.85, capR(0.85) - 0.35 * k, lipTop + 0.45 * k),
    ];
    const arcCurve = new CatmullRomCurve3(arcPts, false, 'catmullrom', 0.5);
    // thick at the roots (0.46 m), tapering only to 0.36 m where it re-enters the cap, knuckled;
    // it clears the moss by well over its own diameter, so it can stay a heavy limb
    const arcR = (t: number) => (0.46 - 0.1 * t) * k * (1 + 0.1 * Math.sin(t * 17 + 1) + 0.06 * Math.sin(t * 41));
    // sunlit up the leg, shaded by the canopy from the eave upward
    const arcShade = (t: number) => 0.8 * smoothstep(0.28, 0.42, t);
    const arc = sweepTube(arcCurve, {
      radius: arcR,
      tubularSegments: 96,
      radialSegments: 13,
      uvMetres: 1.4,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.5 + t * 6, pos.y * 1.3 + 2, 2) - 0.5) * 0.09 * k,
      color: (t, ang) => shadedColor(t, ang, arcShade(t)),
      capEnd: true,
    });
    supportParts.push(mossOnTop(arc, mossTint, 0.85, noise));
    // no leaf sprigs on the arch (their drooping leaves would hang as dark specks in front of the
    // sunlit moss in B); vines trail only from the leg beside the lip
    for (const t of [0.3, 0.38]) {
      const p = arcCurve.getPointAt(t);
      p.y -= arcR(t) * 0.8;
      foliage.addHangingVine(p.add(jit(0.15)), (0.5 + branchRng() * 0.6) * k, { amount: 0.1 });
    }
    bases.push([footL.x, footL.y, footL.z]);
  }
  /**
   * The eave bough (rounds 8–11: a bark limb along the front lip above the porch, the pod cords
   * tied to its underside) is gone in round 12 — from B it read as a broad horizontal beam sitting
   * on the doorway, where the reference has only the moss rim over a dark band. Its geometry's
   * share of the branch stream is skipped so the stub and the right limb keep their tuned B
   * positions; the pods keep the exact world positions round 10 tuned them to (they now hang from
   * the soffit under the moss rim), so the formulas that fixed those positions stay:
   */
  const boughA0 = -1.1;
  const boughA1 = 0.92;
  const boughR11 = (a: number) => {
    const u = (a - boughA0) / (boughA1 - boughA0);
    return (0.21 + 0.06 * Math.abs(u - 0.5) * 2) * k * (1 + 0.08 * Math.sin(a * 11 + 3));
  };
  const boughArch11 = (a: number) => 0.22 * k * Math.exp(-(((a - 0.02) / 0.55) ** 2));
  /** round 11's bough centre (0.24 m roll, +0.22 m arch over the door), at the ×1.0 rim */
  const boughAt11 = (a: number, out = new Vector3()) => {
    const u = (a - boughA0) / (boughA1 - boughA0);
    const ends = smoothstep(0.7, 1, Math.abs(u - 0.5) * 2);
    const rc = capR0(a) - capInset;
    const r = rc + 0.1 * k + 0.04 * k * Math.cos(a * 3 + 1) - 0.25 * k * ends;
    const y = rollBottom - 0.6 * boughR11(a) + boughArch11(a) + 0.2 * k * ends - (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
    return frame.at(a, r, y, out);
  };
  /** where the round-10 bough's underside hook sat (0.26 m roll, no arch) */
  const boughHookYRound10 = (a: number) => {
    const u = (a - boughA0) / (boughA1 - boughA0);
    const ends = smoothstep(0.7, 1, Math.abs(u - 0.5) * 2);
    const r10 = (0.24 + 0.07 * Math.abs(u - 0.5) * 2) * k * (1 + 0.08 * Math.sin(a * 11 + 3));
    return yFloor + eaveY + 0.26 * k - 0.09 * k - 0.07 * k * Math.sin(u * Math.PI) + 0.2 * k * ends - (0.1 + 0.12 * Math.sin(a + 2.2)) * k - r10 * 0.9;
  };
  for (let i = 1; i < 14; i++) jit(0.05);
  for (let i = 0; i < 4; i++) {
    jit(0.1);
    branchRng();
  }
  // the eave's profile over the door centre (audit: projected thickness in B), now and as rounds
  // 10 / 11 built it — the sag term is the deterministic droop; the rim's noise sag (≤ 0.2 m,
  // shared by all) is left out
  const eave: EaveProfile = (() => {
    const sag = (0.1 + 0.12 * Math.sin(2.2)) * k;
    const rc = capR(0) - capInset;
    const rc0 = capR0(0) - capInset;
    const pt = (r: number, y: number): P3 => frame.at(0, r, y).toArray() as P3;
    const c11 = boughAt11(0);
    const rB11 = boughR11(0);
    const u10 = (0 - boughA0) / (boughA1 - boughA0);
    const r10 = (0.24 + 0.07 * Math.abs(u10 - 0.5) * 2) * k * (1 + 0.08 * Math.sin(3));
    const c10 = boughHookYRound10(0) + r10 * 0.9;
    const cr10 = frame.at(0, rc0 + 0.02 * k, 0);
    return {
      rimTop: pt(rc, lipTop - sag),
      rimBottom: pt(rc + lipR, rollBottom - sag),
      bough: null,
      barkRoll: null,
      doorTop: frame.door((doorW0 + doorW1) / 2, doorTop, dBack).toArray() as P3,
      round11: {
        rollTop: pt(rc0, lipTop - sag),
        rollBottom: pt(rc0 + lipR, rollBottom - sag),
        boughTop: [c11.x, c11.y + rB11, c11.z],
        boughBottom: [c11.x, c11.y - rB11, c11.z],
      },
      round10: {
        rollTop: pt(rc0, lipTop - sag),
        rollBottom: pt(rc0 + 0.26 * k, eaveY - sag),
        boughTop: [cr10.x, c10 + r10, cr10.z],
        boughBottom: [cr10.x, c10 - r10, cr10.z],
      },
    };
  })();
  // the doorway opening (audit: aspect / projected size in B), now and as round 11 built it
  const door: DoorOpening = (() => {
    const mid = (w0: number, w1: number, h: number) => ({
      width: w1 - w0,
      height: h,
      aspect: (w1 - w0) / h,
      sill: frame.door((w0 + w1) / 2, sill, dBack).toArray() as P3,
      top: frame.door((w0 + w1) / 2, sill + h, dBack).toArray() as P3,
      left: frame.door(w0, sill + h / 2, dBack).toArray() as P3,
      right: frame.door(w1, sill + h / 2, dBack).toArray() as P3,
    });
    return { ...mid(doorW0, doorW1, doorH), lipFlare, round11: mid(door11.w0, door11.w1, door11.h) };
  })();
  // broken stub: a splintered limb of the old trunk poking out through the moss on the cap's
  // left shoulder and leaning left-down over the eave (reference B: the sunlit limb at
  // (0.60–0.68, 0.20–0.32) beside the dome's left edge, splintered end)
  {
    const stubPts = [
      frame.at(-1.4, 2.9 * k * CAP_RIM_SCALE, lipTop + 1.3 * k),
      frame.at(-1.5, 4.3 * k * CAP_RIM_SCALE, lipTop + 0.7 * k).add(jit(0.1)),
      frame.at(-1.55, 5.3 * k * CAP_RIM_SCALE, eaveY + 0.6 * k).add(jit(0.1)),
    ];
    const stubCurve = new CatmullRomCurve3(stubPts, false, 'catmullrom', 0.5);
    const stubR = (t: number) => (0.34 - 0.12 * t) * k * (1 + 0.08 * Math.sin(t * 9 + 2));
    const stub = sweepTube(stubCurve, {
      radius: stubR,
      tubularSegments: 14,
      radialSegments: 11,
      uvMetres: 1.2,
      // deep longitudinal ridges; the broken end flares a little and is jagged
      displace: (t, ang, pos) => (noise.ridged(ang * 1.6 + 7, pos.y * 1.5 + t * 2, 2) - 0.5) * 0.09 * k + smoothstep(0.85, 1, t) * (0.05 + 0.08 * Math.abs(Math.sin(ang * 5 + 1))) * k,
      color: (t, ang) => (t > 0.985 ? [0.2, 0.16, 0.12] : supportColor(t, ang)),
      capEnd: true,
    });
    supportParts.push(mossOnTop(stub, mossTint, 0.6, noise));
    for (let i = 0; i < 2; i++) {
      const t = 0.35 + i * 0.35;
      const p = stubCurve.getPointAt(t);
      p.y -= stubR(t) * 0.85;
      foliage.addHangingVine(p.add(jit(0.15)), (0.5 + branchRng() * 0.6) * k, { amount: 0.1 });
    }
  }
  // ---- right limb: the stump's surviving bough in pale bark, rising off the right shoulder and
  // leaning out to the right (frame B: it climbs behind the HUD box toward the top-right corner;
  // from the stairs (A) it stands against bright haze, so it stays lit and stops short of the
  // top of that frame) ----
  const rightPts = [
    frame.at(0.6, capR(0.6) - 1.0 * k, lipTop - 0.1 * k),
    frame.at(0.72, capR(0.72) + 0.1 * k, lipTop + 0.9 * k),
    frame.at(0.85, capR(0.85) + 0.75 * k, lipTop + 1.9 * k),
    frame.at(0.95, capR(0.95) + 1.3 * k, lipTop + 2.6 * k),
  ];
  for (let i = 1; i < rightPts.length; i++) rightPts[i].add(new Vector3((branchRng() - 0.5) * 0.16, (branchRng() - 0.5) * 0.1, (branchRng() - 0.5) * 0.16));
  const rightCurve = new CatmullRomCurve3(rightPts, false, 'catmullrom', 0.5);
  branchParts.push(
    sweepTube(rightCurve, {
      radius: (t) => (0.42 - 0.2 * t) * k * (1 + 0.08 * Math.sin(t * 8 + 1) + 0.05 * Math.sin(t * 21)),
      tubularSegments: 28,
      radialSegments: 12,
      uvMetres: 1.2,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.6 + 3, pos.y * 1.5 + t * 2, 2) - 0.5) * 0.1 * k,
      color: limbColor,
      capEnd: true,
    }),
  );
  {
    const tip = rightCurve.getPointAt(1);
    foliage.addLeafCluster(tip, 0.5 * k, 40, { size: 0.13, amount: 0.06, droop: 0.5, tint: leafTint, tintSpread: 0.28 });
    const mid = rightCurve.getPointAt(0.4);
    mid.y -= 0.3 * k;
    foliage.addHangingVine(mid, (0.6 + branchRng() * 0.6) * k, { amount: 0.1 });
  }
  const supportMesh = new Mesh(merge(supportParts), mats.bark);
  supportMesh.name = 'support-boughs';
  supportMesh.castShadow = supportMesh.receiveShadow = true;
  group.add(supportMesh);
  // chimney branch: stubby, hollow-looking, tilted
  {
    const a = 2.85;
    const v = 0.2;
    const base = surfacePoint(a, v, -0.25 * k);
    const up = domeNormal(a, v).add(new Vector3(0, 1.2, 0)).normalize();
    const tilt = frame.dir(a + 1.2).multiplyScalar(0.18);
    const pts = [base, base.clone().addScaledVector(up, 0.45 * k).add(tilt), base.clone().addScaledVector(up, 0.95 * k).addScaledVector(tilt, 2.2)];
    const chimney = sweepTube(new CatmullRomCurve3(pts), {
      radius: (t) => (0.26 - 0.06 * t) * k,
      tubularSegments: 10,
      radialSegments: 12,
      uvMetres: 1.0,
      displace: (t, ang) => (noise.ridged(ang * 1.6 + 2, t * 5, 2) - 0.5) * 0.05 * k,
      color: (t, ang) => (t > 0.985 ? [0.12, 0.1, 0.08] : limbColor(t, ang)),
      capEnd: true,
    });
    branchParts.push(chimney);
  }
  const branchMesh = new Mesh(merge(branchParts), mats.barkPale);
  branchMesh.name = 'roof-branches';
  branchMesh.castShadow = branchMesh.receiveShadow = true;
  group.add(branchMesh);

  // ---- heart-leaf vines hanging from the lip + draped over the cap, tufts and ferns on top ----
  const vineRng = rng.fork('vines');
  const hanging = def.id === 'saria' ? 20 : 14;
  for (let i = 0; i < hanging; i++) {
    // spread over the front 260°; strands right above the porch stay short so it is not veiled
    const a = -2.3 + (i / (hanging - 1)) * 4.6 + (vineRng() - 0.5) * 0.2;
    const hook = surfacePoint(a, 0.93, -0.04);
    hook.y -= 0.1 * k;
    const overDoor = smoothstep(0.7, 0.2, Math.abs(a));
    const len = (0.6 + vineRng() * 1.1) * (0.8 + 0.4 * Math.abs(Math.sin(a))) * (1 - 0.6 * overDoor);
    foliage.addHangingVine(hook, len * k, { amount: 0.1 });
  }
  const draped = def.id === 'saria' ? 6 : 4;
  for (let i = 0; i < draped; i++) {
    const a0 = (i / draped) * TAU + vineRng() * 0.6;
    const pts: Vector3[] = [];
    const nrms: Vector3[] = [];
    const n = 7;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const a = a0 + Math.sin(t * 2.2 + i) * 0.35;
      const v = lerp(0.15 + vineRng() * 0.1, 0.88, t);
      pts.push(surfacePoint(a, v, 0.03));
      nrms.push(domeNormal(a, v));
    }
    foliage.addSurfaceVine(pts, nrms, { amount: 0.02 });
  }
  const tuftCount = def.id === 'saria' ? 46 : 28;
  const roofShade: [number, number, number] = [0.6, 0.6, 0.38];
  for (let i = 0; i < tuftCount; i++) {
    const a = vineRng() * TAU;
    const v = 0.05 + vineRng() * 0.7;
    // the front face is thinned (see the clump shroud below), not cleared
    if (vineRng() < 0.5 * smoothstep(1.3, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.18, 0.32, v)) continue;
    const p = surfacePoint(a, v, -0.03);
    const n = domeNormal(a, v);
    const fern = vineRng() < 0.35;
    const low = lerp(0.6, 1, smoothstep(0.1, 0.4, v));
    foliage.addTuft(p, n, (fern ? 0.5 : 0.34) * (0.8 + vineRng() * 0.5) * sk * low, fern ? 1 : 0, 0.05, roofShade);
  }
  // ---- leaf-cluster shroud: the cap is a mass of overlapping leaf clumps (reference B: lit
  // yellow-olive tops, dark shaded undersides), so the moss shell only shows through between
  // them. Tints run from deep grey-olive in the hollows to yellow-olive on the lit clumps; the
  // front face over the porch is thinned (round 11: half, not nine-tenths — reference B's cap is
  // an irregular mossy mound, its front lumpy with moss clumps, not a smooth sunlit tent).
  const clumpRng = rng.fork('clumps');
  const clumpCount = Math.round(140 * k * k);
  // olive greens, deeper in the hollows (reference roof hue ≈ 49°, sat ≈ 0.34)
  const tints: [number, number, number][] = [
    [0.2, 0.25, 0.06],
    [0.4, 0.44, 0.1],
    [0.66, 0.62, 0.15],
    [0.92, 0.8, 0.2],
  ];
  for (let i = 0; i < clumpCount; i++) {
    const a = clumpRng() * TAU;
    const v = 0.04 + Math.pow(clumpRng(), 0.8) * 0.74;
    const frontFace = smoothstep(1.3, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.18, 0.32, v);
    if (clumpRng() < 0.35 * frontFace) continue;
    const p = surfacePoint(a, v, 0.08 * k);
    const n = domeNormal(a, v);
    // lit side (upper faces) gets the yellower clumps, flanks the deep ones; the crown sits
    // under the canopy and stays in the darker tints (×0.85: more of the clumps fall into the
    // darker olives, so the mound reads as moss clumps on thatch rather than more thatch)
    const lit = clamp(0.85 * (n.y * 0.75 + 0.3 * clumpRng() + 0.15 * noise.noise(p.x * 1.5, p.z * 1.5)) * lerp(0.55, 1, smoothstep(0.15, 0.5, v)), 0, 0.999);
    const tint = tints[Math.floor(lit * tints.length)];
    // flatter, smaller clumps on the crown so the cap's top silhouette stays low
    const radius = (0.3 + clumpRng() * 0.26) * k * lerp(0.7, 1, smoothstep(0.1, 0.4, v));
    foliage.addLeafCluster(p, radius, 34, { size: 0.2 * sk, amount: 0.05, droop: 0.5, tint, tintSpread: 0.25, flatten: lerp(0.3, 0.5, smoothstep(0.1, 0.4, v)) });
  }
  // ---- rim fringe (round 11): a drooping skirt of leaf clumps and short vines over the lip, so
  // the cap's edge is a ragged moss fringe hanging past the bark roll (reference B: the moss edge
  // over the door at frame y 0.28–0.30 is ragged, sheet 04 drips leaves and vines off the rim).
  // Over the door the skirt is thinned and shortened so the pods and the doorway stay clear. ----
  const fringeRng = rng.fork('fringe');
  const fringeCount = def.id === 'saria' ? 26 : 16;
  for (let i = 0; i < fringeCount; i++) {
    const a = -2.6 + (i / (fringeCount - 1)) * 5.2 + (fringeRng() - 0.5) * 0.18;
    const overDoor = smoothstep(0.75, 0.25, Math.abs(a));
    if (fringeRng() < 0.5 * overDoor) continue;
    const p = surfacePoint(a, 0.73, 0.03);
    p.addScaledVector(frame.dir(a), 0.14 * k);
    p.y -= (0.1 + 0.08 * fringeRng()) * k;
    const radius = (0.24 + fringeRng() * 0.12) * k * lerp(1, 0.7, overDoor);
    const tint = tints[1 + Math.floor(fringeRng() * 2)];
    foliage.addLeafCluster(p, radius, 20, { size: 0.16 * sk, amount: 0.05, droop: 0.9, tint, tintSpread: 0.25, flatten: 0.4 });
    if (fringeRng() < 0.5) {
      const hook = p.clone().add(new Vector3((fringeRng() - 0.5) * 0.1, 0, (fringeRng() - 0.5) * 0.1));
      foliage.addHangingVine(hook, (0.3 + fringeRng() * 0.5) * k * lerp(1, 0.5, overDoor), { amount: 0.08 });
    }
  }
  // a few big ferns / grass clumps on the shoulders that break the cap silhouette (kept off
  // the crown so the top of the cap stays low)
  const heroTufts: { a: number; v: number; size: number; kind: 0 | 1 }[] = [
    { a: -1.45, v: 0.5, size: 0.8, kind: 1 },
    { a: -1.85, v: 0.6, size: 0.7, kind: 0 },
    { a: -0.95, v: 0.45, size: 0.65, kind: 1 },
    { a: 0.7, v: 0.42, size: 0.6, kind: 1 },
    { a: 2.1, v: 0.5, size: 0.7, kind: 0 },
  ];
  for (const ht of heroTufts) {
    const p = surfacePoint(ht.a, ht.v, -0.05);
    const n = domeNormal(ht.a, ht.v);
    // lean the clump a little toward vertical so it stands proud of the moss
    n.y += 0.6;
    n.normalize();
    foliage.addTuft(p, n, ht.size * sk, ht.kind, 0.06);
  }
  // ---- small plants growing in the moss (sheet 04 "moss-covered roof with plants"): broad
  // upright leaves in little rosettes and young fern fronds scattered over the shoulders and
  // crown — kept off the front lip so the eave line and the doorway stay clear ----
  const plantRng = rng.fork('plants');
  const plantCount = def.id === 'saria' ? 16 : 9;
  for (let i = 0; i < plantCount; i++) {
    const a = plantRng() * TAU;
    const v = 0.08 + plantRng() * 0.62;
    if (Math.abs(angleDiff(a, 0)) < 0.5 && v > 0.45) continue;
    const p = surfacePoint(a, v, 0.02);
    const n = domeNormal(a, v);
    if (plantRng() < 0.55) {
      // rosette of 5–8 broad leaves standing up and fanning out
      const leaves = 5 + Math.floor(plantRng() * 4);
      const size = (0.3 + plantRng() * 0.16) * sk;
      const yaw0 = plantRng() * TAU;
      const tint: [number, number, number] = [0.42 + plantRng() * 0.1, 0.58 + plantRng() * 0.1, 0.24];
      for (let j = 0; j < leaves; j++) {
        const yaw = yaw0 + (j / leaves) * TAU + (plantRng() - 0.5) * 0.5;
        const dir = new Vector3(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(0.55).addScaledVector(n, 0.9).normalize();
        foliage.addLeaf(p.clone().addScaledVector(n, 0.02), dir, size * (0.85 + plantRng() * 0.3), plantRng() * Math.PI * 2, 0.06, tint);
      }
    } else {
      n.y += 0.7;
      n.normalize();
      foliage.addTuft(p, n, (0.45 + plantRng() * 0.25) * sk, 1, 0.06, [0.62, 0.7, 0.42]);
    }
  }

  // ---- pod lanterns on cords under the eave ----
  const lanternRng = rng.fork('lanterns');
  const specs = LANTERNS[def.id] ?? LANTERNS.upper;
  const podPositions: Vector3[] = [];
  let limeCount = 0;
  for (const spec of specs.slice(0, Math.max(def.lanterns, specs.length))) {
    let hook: Vector3;
    let cord = spec.cord * k;
    if (spec.hook === 'bough') {
      // Round 12: no eave bough — the cord runs up into the shadow under the moss rim and is tied
      // to the soffit there. The pod itself stays exactly where round 10 tuned it (B: pod centres
      // at frame x ≈ 0.728 / 0.758 / 0.79): the round-11 hook line fixes (x, z) and the knot
      // height it hung from, and the cord takes up whatever the soffit sits above that.
      const line = boughAt11(spec.a);
      line.y -= boughR11(spec.a) * 0.9;
      line.addScaledVector(frame.dir(spec.a), -0.04 * k);
      const knotY11 = boughHookYRound10(spec.a);
      const r = Math.hypot(line.x - frame.C.x, line.z - frame.C.z);
      hook = line.clone();
      hook.y = Math.max(line.y, yFloor + soffitY(spec.a, r) - 0.03);
      cord += hook.y - knotY11;
    } else if (spec.hook === 'eave') {
      // hooked to the soffit a little in from the ×1.0 lip; the cord is a vine. The soffit sits
      // higher than in round 10 (it meets the thin rim), so the cord grows by as much and the pod
      // stays put whatever the rim scale.
      const r = capR0(spec.a) - capInset - 0.45 * k;
      hook = frame.at(spec.a, r, soffitY(spec.a, r) - 0.03);
      cord += soffitY(spec.a, r) - soffitYRound10(spec.a, r);
      foliage.addHangingVine(hook.clone(), cord * 0.85, { amount: 0.08, thickness: 0.012 });
    } else {
      const y = spec.y ?? 2.6;
      const start = frame.at(spec.a, rSmooth(spec.a, y) - 0.2, y);
      const end = frame.at(spec.a, rSmooth(spec.a, y) + 0.5 * k, y + 0.12);
      const peg = sweepTube(new CatmullRomCurve3([start, start.clone().lerp(end, 0.5).add(new Vector3(0, 0.04, 0)), end]), {
        radius: (t) => (0.075 - 0.03 * t) * k,
        tubularSegments: 6,
        radialSegments: 8,
        capEnd: true,
        color: () => [0.9, 0.85, 0.75],
      });
      const pegMesh = new Mesh(ensureColor(peg), mats.bark);
      pegMesh.name = 'lantern-peg';
      pegMesh.castShadow = true;
      group.add(pegMesh);
      hook = end.clone().addScaledVector(frame.dir(spec.a), -0.06);
      hook.y -= 0.04;
      // a hanging vine trails off the peg too
      foliage.addHangingVine(end.clone().add(new Vector3(0, 0.02, 0)), 0.5, { amount: 0.08 });
    }
    const rig = buildLantern(hook, cord, mats, lanternRng, 1.0, spec.tint ?? 'orange');
    if (spec.tint === 'lime') limeCount++;
    group.add(rig.pivot);
    lanterns.push(rig);
    podPositions.push(rig.pod);
  }
  if (podPositions.length) {
    const c = new Vector3();
    for (const p of podPositions.slice(0, 2)) c.add(p);
    c.divideScalar(Math.min(2, podPositions.length));
    c.addScaledVector(F, 0.35);
    // sit the shared glow below the pods' bellies (they light downward: the reference spills
    // warm light on the threshold and sign, and the branch they hang from stays dark)
    c.y -= 0.28 * k;
    // the shared glow takes on the mix of pod colours
    const glow = new Color(ctx.config.palette.lanternGlow).lerp(new Color(0xd2ee48), limeCount / podPositions.length);
    const lanternLight = new PointLight(glow, 6.5, 6, 2);
    lanternLight.position.copy(c);
    lanternLight.name = 'lantern-light';
    group.add(lanternLight);
    lights.push(lanternLight);
  }

  for (const m of foliage.build(mats, `house-${def.id}`)) group.add(m);

  // draped limbs + arc bough + broken stub + right limb + chimney
  const hearthFloor = Math.max(yFloor + roomFloorY, terrain.height(hearthPos.x, hearthPos.z) + 0.05);
  const hearthClearance = hearthPos.y - 0.14 * k - 0.05 * k - hearthFloor;
  return { group, bases, lanterns, lights, materials, roots: rootCount + 2, branches: branchDefs.length + 4, leaves: foliage.leafCount, eave, door, cap, hearthClearance };
}
