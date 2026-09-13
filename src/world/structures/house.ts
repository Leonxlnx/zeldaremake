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
 * soffit under it. The cap is built in its own cap-moss material (round 13: a procedural mossy
 * normal map — soft 3–6 cm clumps over broader cushions and fine grain, roughness 0.9 — instead of
 * the shared moss material's thatch-stalk relief; vertex colours are its albedo — olive, grainy,
 * lumpy, ±0.22 m mounds) with patches of lighter straw in the roof material (`THATCH_THRESHOLD`),
 * moss clumps, grass tufts, ferns, small white flowers and a drooping fringe of leaves and trailing
 * vines over the rim (board 03 "moss-covered roof with plants"), and it is held by the house's own living branch in the trunk's bark: a
 * gnarled bough rises from the roots on the left, climbs the left shoulder and arches over the
 * FRONT of the cap well clear of the moss (frame B looks up at it, so it runs as a thick dark
 * limb across the top band above the dome, like the reference's near limb) before sinking back
 * into the moss behind the right shoulder (sheet 04 "Natural wooden supports (branches)"). The
 * bark takes a structures-owned shade floor tinted to the reference's warm dark brown
 * (`HOUSE_BARK_FLOOR`), not the giants' grey-green one. Buttress roots seat the trunk on the
 * terrain, pale limbs drape over the cap, moss, leaf clumps, ferns, broad-leaf plants and
 * heart-leaf vines shroud the cap.
 *
 * Round 13 (owner boards 03 / 04 / 06 are the authority for construction, material and props):
 * a ROUND WINDOW ≈ 0.9 m across is carved into the trunk high on the left flank — a bark collar
 * rolling into an obliquely bored socket whose back glows with the room's amber, a rough wooden
 * cross frame, moss on the collar and vines trailing off it (board 04 "window detail"); two
 * curved living BRANCH PILLARS stand just outside the root lips and rise into the soffit and rim
 * (board 03 "natural wooden supports", board 04 "wooden branch pillars support the entrance");
 * SIX POD LANTERNS hang across the front — the three tuned B pods over the door, one on each
 * flank under the rim and one on the right flank (board 03: five across the front); and through
 * the door, SHELVES of pots, jars and bottles line the back wall under the lamp pools (boards
 * 03 / 06). `CAP_RIM_SCALE` carries the round-13 roof-width A/B.
 *
 * Round 14 (the reviewer's ray-traced read of B): the room's floor is a LEVEL PAD at
 * `roomFloorY` cut into the plateau slope — the back wall stands where the slope reaches the pad
 * (`roomBackD`), a plain vertical face on a level floor, a riser at the threshold — where rounds
 * 12–13 had let the floor climb the slope as a pale bank seen through the door (and the upper
 * house's buttress root ran down that slope into the room; roots now keep out of other trunks).
 * The cap's tone is a near-uniform mossy olive with soft variation: straw ≈ 10 % and olive
 * (`THATCH_THRESHOLD`, `THATCH_TINT`), broad rounded relief at half the amplitude with no creased
 * noise (`domeDisp`), the light carried by the slope rather than the relief's crests, darker
 * leaf clumps as the specks on the lit mound, a softer moss normal map. The support bough is
 * branched into the house: a burl where it leaves the trunk, two sub-limbs dropping into the cap
 * under leaf clusters, a leafy up-limb off the span, and a prop root off its far end down the
 * right flank to the ground.
 *
 * Round 15 (the reviewer's read of take-0065's B: "a flat yellow-khaki field with broad vertical
 * streaks and dark disconnected leaf blobs" against the reference's dense soft green moss):
 * every cap noise term — relief and vertex colour — is a 3D field sampled at the vertex
 * (`n3`), so the front face carries the same isotropic grain as the crown (the 2D (x, z) fields
 * were constant along y on the vertical face: streaks); the angular lifts are gone (no
 * front-face multiplier, a gentle crown→shoulder slope only) and the albedo is retargeted to
 * the reference's lit-mound tertiles (light rgb(168,162,101), mid (134,128,77), dark
 * (102,95,58): greener and less saturated than round 14's, its hollows warm olive, not
 * grey-green); the moss material carries a speckled albedo map for the reference's fine dark
 * dots (materials.ts `mossTextures`), laid on the cap as a developed cone (polar UVs from the
 * meridian length — the old `u = a·r(v)` sheared the map into fine diagonal streaks left of
 * the porch, see `meridian`); straw ≈ 2 %. The cap vegetation is small plants lit like
 * the moss — leaf clusters, grass tufts and rosettes tinted up to the moss's own linear albedo,
 * the three hero ferns — with vines only at the rim (no surface vines draped over the cap). The
 * support bough is a BRANCH, not a hoop: it grows out of the trunk at the left eave, passes
 * behind the crown and climbs away past the right shoulder, leaving the top of frame B to a
 * leafy tip beyond the right rim, the two cap sub-limbs and the up-limb kept; the ground leg
 * and the prop root are gone.
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
  Matrix4,
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
import { MOSS_ALBEDO_PEAK, Noise3D, type StructureMaterials } from './materials';

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
  /** the same rim / crown at ×1.0 / ×1.0 (no round-17 lobes) for before/after */
  round11: { rim: P3[]; crownTop: P3; rimFront: P3 };
  /** round 17: the rim ring's horizontal reach from the cap's axis — mean / std / std ÷ mean / min / max (m) */
  rimRadius: { mean: number; std: number; cv: number; min: number; max: number };
  /** round 17: the rim-reach lobes' and the eave-line wave's amplitudes (m) */
  rimLobeAmplitude: number;
  rimWaveAmplitude: number;
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
  /** the round window (round 13): centre on the wall surface (world), clear radius, height above the floor */
  window: { centre: P3; radius: number; height: number };
  /** the root-buttresses' feet (world, on the terrain), where each leaves the arch body, and the foot's radius (round 19; the branch pillars' feet / rim ends before) */
  pillars: { foot: P3; top: P3; footRadius: number }[];
  /** round 19: the trunk burls' seam check — max position (mm) / normal (deg) delta across each knot's duplicated seam column (expect 0 / 0) */
  burls: { count: number; seamMaxPosMm: number; seamMaxNormalDeg: number };
  /** round 19: the entrance arch's crown on the door axis — axis point (world), radius, underside / top heights above the floor, angular span (rad) */
  arch: { crownAxis: P3; crownRadius: number; underside: number; top: number; span: number };
  /** small white flower heads on the cap */
  flowers: number;
  /** pots, bottles and bowls on the interior shelves */
  props: number;
  /**
   * The room's level floor pad (round 14): floor height above the local floor level, the back
   * wall's depth from the trunk centre at the left / middle / right of the room (door-space, +
   * toward the door), and how far the plateau slope pokes up through the pad (≤ 0 = never).
   */
  room: { floorY: number; backD: [number, number, number]; floorPoke: number; pokeAt: [number, number] };
  /** the support bough's centre line (33 world points, t = 0 at the trunk) and radii (round 15) */
  bough: { pts: P3[]; radii: number[] };
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
    // round 13 (board 03: five pods across the front, the outer ones lower on the supports): two
    // more on the flanks under the rim — left, under the round window (B (0.64, 0.43); the
    // window sits at (0.658, 0.37)) on a long cord, so it hangs below the window's sill where
    // reference B has its own warm lantern on the left flank at (0.659, 0.437); right, past the
    // right branch pillar (B (0.91, 0.35)). Appended so the first four pods' draws from the
    // lantern stream, and their tuned B positions, are unchanged; one lime and one orange keep
    // the shared glow's colour mix at half lime.
    { a: -1.15, cord: 0.7, hook: 'eave', tint: 'orange' },
    { a: 0.75, cord: 0.3, hook: 'eave', tint: 'lime' },
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
 * The four wide variants tie on SSIM (spread 0.001) and colour; round 12 kept ×1.15 / ×0.85 for the
 * silhouette (height 116 px vs the reference's 115, overhang inside the 1.5–2 m spec). With the
 * finished round-12 house the same A/B costs 0.005 combined SSIM (0.7978 at ×1.0 / ×1.0 vs 0.7928),
 * so flip both back to 1.0 for the SSIM-optimal cap.
 *
 * Round 13 re-tests the width with the round-13 house (window, pillars, cap plants, six pods,
 * shelves) against the owner's boards 03 / 04 — the cap is roughly as wide as the trunk plus its
 * roots, not wider than the whole facade — and frame 14 s (rim ≈ 410 px, lit mound 282). One tree,
 * A + B + F, control = round-12 HEAD built at the same moment (combined SSIM 0.7979; B 0.2573):
 *   rim    combined  B full / upper  F full  A full  B rim px  crown→edge px  h/w    A rim px  overhang f/s/b m
 *   ×1.05  0.7973    0.2596 / 0.3631 0.2652  0.2724  479       92             0.192  316       1.29 / 0.86 / 0.40
 *   ×1.10  0.7970    0.2580 / 0.3598 0.2669  0.2720  504       88             0.175  332       1.52 / 1.06 / 0.59
 *   ×1.15  0.7940    0.2554 / 0.3544 0.2662  0.2724  536       116            0.216  351       1.75 / 1.27 / 0.77
 * (The crown→edge height is the highest DISPLACED shell sample, so it wanders ±0.3 m with the
 * cap noise as the rim moves; the undisplaced crown is the same in all three.) ×1.05 is kept:
 * nearest the reference's rim width, the best B (the round-13 house with the ×1.15 rim is the only
 * variant to lose B against the round-12 control) and tied with ×1.10 on the combined score
 * (0.0003 apart; ×1.15 costs 0.003). Its front overhang, 1.29 m over the wall at the eave, is
 * under the boards' 1.5–2 m read — ×1.10 (1.52 m) is the pick if that overhang is preferred.
 */
const CAP_RIM_SCALE = 1.05;
/**
 * Thatch patches on the moss cap: the patch noise (simplex, ∈ [−1, 1]) above this threshold
 * (+0.125, the midpoint of the smoothstep) shows straw (the roof material), below it moss. Round
 * 11 built the whole cap in the straw material and only tinted it toward moss where the same
 * noise fell under 0.55, so the stalks showed everywhere; the reference cap is olive moss with
 * only patches of lighter thatch. Round 12's probes: 0.55 left 6.5 % straw — too little to read
 * as patches — and 0.12 gave 35 %; 0.23 landed near round 12's quarter (audited as
 * `thatchFraction`, with round 11's straw-dominant share alongside for the before/after).
 * Round 14: the reviewer's read of B was "bright yellow straw blobs on dark moss" against a
 * near-uniform dark mossy olive — the share drops to ≈ 10 % (0.46) and the straw itself is
 * pulled toward the moss (darker, greener: `THATCH_TINT`), the moss a touch lighter.
 * Round 15: the reference's cap shows no straw at all (dense moss with a few plants), and the
 * straw map's stalks run down the front face as fine vertical striations — ≈ 3 % (0.72), the
 * last of it on the crown's far side.
 */
const THATCH_THRESHOLD = 0.72;
/** straw patch albedo multiplier (round 12: −25 %, the patches read as bright straw) */
const THATCH_ALBEDO = 0.75;
/** straw patch vertex tint (linear): round 12's dry yellow straw [0.66, 0.55, 0.26] → an olive
 *  straw, half-way to the moss's lit tone, so the patches read as thinner moss, not thatch */
const THATCH_TINT: [number, number, number] = [0.5, 0.47, 0.2];

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

/**
 * Ridged bark noise sampled round a ring: the angle enters as (cos, sin) on a circle of radius
 * `scale` in noise space (its circumference ≈ the run `angle * scale` used to cover), so the
 * value is periodic in the angle. Round 19: a SphereGeometry / sweepTube ring duplicates its
 * seam vertex (u = 0 and u = 1), and noise fed `atan2` directly gave the two copies different
 * displacements (3–6 cm apart, normals 50–100° apart on the burls).
 */
function ringRidged(noise: Noise2D, angle: number, along: number, scale: number, seed: number): number {
  return noise.ridged(Math.cos(angle) * scale + seed, Math.sin(angle) * scale + along + seed * 0.3, 2) - 0.5;
}

/**
 * Average the normals of coincident vertices (a sphere's duplicated seam column and its pole
 * fans, a swept tube's ring seam) after `computeVertexNormals`, which only sums the faces that
 * share an INDEX: a displaced surface otherwise shades with a crease along the seam.
 */
function weldNormals(geo: BufferGeometry, tol = 1e-4): void {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const groups = new Map<string, number[]>();
  const q = 1 / tol;
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  }
  const sum = new Vector3();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    sum.set(0, 0, 0);
    for (const i of g) sum.add(_wn.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)));
    if (sum.lengthSq() < 1e-12) continue;
    sum.normalize();
    for (const i of g) nrm.setXYZ(i, sum.x, sum.y, sum.z);
  }
}
const _wn = new Vector3();

/**
 * The same for a SphereGeometry(…, W, H) by index — its seam column (ix = 0 / ix = W on every
 * row) and its pole rows (W + 1 copies of each pole) — so the pairs are exact whatever the
 * position quantisation.
 */
function weldSphereSeam(geo: BufferGeometry, W: number, H: number): void {
  const nrm = geo.attributes.normal;
  const avg = (ids: number[]) => {
    _wn.set(0, 0, 0);
    for (const i of ids) _wn.x += nrm.getX(i), (_wn.y += nrm.getY(i)), (_wn.z += nrm.getZ(i));
    if (_wn.lengthSq() < 1e-12) return;
    _wn.normalize();
    for (const i of ids) nrm.setXYZ(i, _wn.x, _wn.y, _wn.z);
  };
  for (let iy = 0; iy <= H; iy++) avg([iy * (W + 1), iy * (W + 1) + W]);
  for (const iy of [0, H]) avg(Array.from({ length: W + 1 }, (_, ix) => iy * (W + 1) + ix));
}

/** The same for a `sweepTube(…, { tubularSegments: ts, radialSegments: rs })` ring seam (j = 0 / j = rs on every ring). */
function weldTubeSeam(geo: BufferGeometry, ts: number, rs: number): void {
  const nrm = geo.attributes.normal;
  for (let i = 0; i <= ts; i++) {
    const a = i * (rs + 1);
    const b = a + rs;
    _wn.set(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b));
    if (_wn.lengthSq() < 1e-12) continue;
    _wn.normalize();
    nrm.setXYZ(a, _wn.x, _wn.y, _wn.z);
    nrm.setXYZ(b, _wn.x, _wn.y, _wn.z);
  }
}

/** Position (mm) and normal (deg) deltas across a SphereGeometry(…, W, H)'s duplicated seam column. */
function sphereSeamDeltas(geo: BufferGeometry, W: number, H: number): { maxPosMm: number; maxNormalDeg: number } {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  let maxPos = 0;
  let maxDeg = 0;
  const n0 = new Vector3();
  const n1 = new Vector3();
  for (let iy = 0; iy <= H; iy++) {
    const i0 = iy * (W + 1);
    const i1 = i0 + W;
    maxPos = Math.max(maxPos, Math.hypot(pos.getX(i0) - pos.getX(i1), pos.getY(i0) - pos.getY(i1), pos.getZ(i0) - pos.getZ(i1)));
    n0.set(nrm.getX(i0), nrm.getY(i0), nrm.getZ(i0));
    n1.set(nrm.getX(i1), nrm.getY(i1), nrm.getZ(i1));
    // atan2 of the cross / dot: exact at 0 where acos(dot) is float-noisy
    maxDeg = Math.max(maxDeg, (Math.atan2(_wn.crossVectors(n0, n1).length(), n0.dot(n1)) * 180) / Math.PI);
  }
  return { maxPosMm: maxPos * 1000, maxNormalDeg: maxDeg };
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
function roomMaterial(mats: StructureMaterials, color = 0x3c3b3e): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    normalMap: mats.interior.normalMap,
    normalScale: new Vector2(0.3, 0.3),
    roughness: 1,
    // Round 12: a dark COOL recess with warm pools. The reference doorway is near-neutral grey
    // (box rgb(80,77,72), sat 0.12, hue 40°) with the amber local to the lamps; at B's 18 m the
    // haze between the camera and the door contributes most of the opening's light, and that
    // airlight is yellow-olive, so the walls' own tint goes cool grey (round 11's warm 0x6e6457 /
    // 0xffd08a @ 0.17 filled the whole opening with amber, sat 0.34) and only the emissive is
    // amber. The vertex colours carry the shading, the `aGlow` attribute the pools. (Round 13's
    // shelf props take the same material with a paler base so the lamps' light shows their colours.)
    color: new Color(color),
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
  /** isotropic 3D field for the cap's relief and colour grain (round 15; see `Noise3D`) */
  const n3 = new Noise3D(rng.fork('cap-noise3'));
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
  /** the cap's uneven sag (back-left heavier) at angle a — the rim, soffit and curl all carry it */
  const sagAt = (a: number) => (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
  /** cap crown of the bare shell (moss lumps and leaf clumps add ~0.4 m on top); reference B's
   *  dome is a tall mound — at frame x 0.72–0.80 its sunlit moss runs from the eave (y 0.26) up to
   *  y 0.13, twice the height of a 0.83 crown; header estimate crown ≈ 6–6.5 m. The rim (eave,
   *  lip) and the door are fixed; `CROWN_SCALE` moves the crown alone (round 10 A/B, see below). */
  const crownY = lipTop + (def.roofHeight * 0.97 - lipTop) * CROWN_SCALE;
  /** outer radius of the rim at ×1.0: heavier overhang at the front (over the porch) than at the back */
  const capR0 = (a: number) => R * (1.3 + 0.13 * Math.cos(a));
  /**
   * Round 17: the crown's low-frequency IRREGULARITY. Rounds 8–16 built the rim as a smooth
   * ellipse-ish ring and the crown as an even dome — take-68's remaining W25 ground was "even
   * roof / eave … vs the reference's irregular crown": at 14 s and on boards 03 / 04 the rim's
   * lobes reach differently (±0.4 m), the eave line is wavy, one side of the crown sits lower
   * and a couple of the shoulder's bulges sag. Three terms, all smooth in `a` so the developed-
   * cone moss map stays continuous:
   *  - `rimLobe`: two + three lobes on the rim's reach (±0.4 m): ≈ 0 over the door (the pods'
   *    overhang and the front-overhang audit hold), +0.26 m over the right lip, −0.4 m on the
   *    right flank (B's right silhouette recedes), the back reaches out inside the giant.
   *  - `rimWave`: a three- plus five-lobe ±0.17 m wave on the rim's height (the eave line),
   *    zero at the window's angle so the window keeps its 3 cm under the soffit.
   *  - `crownLobe` (in `domeBaseS`): the left shoulder sits up to 0.22 m lower, and two bulges
   *    (right of the door, back-left) sag a further 0.16 m; the front shoulder — the crown's
   *    height from B — is untouched.
   * `capR0`, `soffitYRound10` and `boughAt11` — the ×1.0 references the pods' hooks are placed
   * from — and the audit's round-11 sample do not carry them.
   */
  const RIM_LOBE = 0.4 * k;
  const rimLobe = (a: number) => RIM_LOBE * (0.55 * Math.sin(2 * a + 1.5) + 0.55 * Math.sin(3 * a + 5.4));
  const rimWave = (a: number) => 0.12 * k * Math.sin(3 * a + 3.24) + 0.05 * k * Math.sin(5 * a + 5.4);
  const RIM_WAVE = 0.17 * k;
  /** outer radius of the rim as built (round-12 rim A/B; round-17 lobes) */
  const capR = (a: number) => capR0(a) * CAP_RIM_SCALE + rimLobe(a);
  /** trunk wall top, hidden under the cap */
  const wallTop = eaveY + 0.3 * k;
  // porch: a wide recess cut into the front of the trunk under the eave, sitting a little right of
  // the axis like the reference's (its root lips at frame x ≈ 0.64–0.72 / 0.86–0.93 in B). The back
  // wall stays well forward because the plateau slope rises steeply inside the trunk on the right
  // (terrain +0.3 m at 1.2 m right of the axis, 2.2 m in; +0.8 m at 1.8 m in).
  // Round 17: the dark arch is WIDER. Take-68 read the reference opening as wider than ours:
  // in B the reference's dark cavity runs between its root lips' inner faces at x 0.715 and
  // 0.865 (0.150 of the frame, ≈ 3.0 m at the door plane; the reviewer's coarser read
  // 0.70–0.86) where ours ran 0.725–0.845 (0.120, 20 % narrower). The root lips move apart
  // (`lipOut`, +0.2 m on the left, +0.5 m on the right — the reference sits right of the axis)
  // and the porch cut widens behind them (−0.63 R … 0.55 R, was −0.56 … 0.46) so no lit wall
  // shows between a lip and the recess; the inner doorway and the room behind it are unchanged,
  // the porch's back wall around the doorway is recess bark at lum ≈ 0.2 in B, as dark as the
  // reference's cavity. Measured in B (pixel rays, lip rows y 0.42–0.44): lips' inner faces
  // 0.716 / 0.867 — 0.151 of the frame, within 1 % of the reference (HEAD: 0.725 / 0.839).
  const porchW0 = -0.63 * R;
  const porchW1 = 0.55 * R;
  /** round 19: the cut rises (was eaveY − 0.2 m) to just above the entrance arch's underside
   *  (2.8–3.0 m on the door axis), so the opening's crown is the arch body itself — the reference's
   *  cavity reaches the arch at B y ≈ 0.30 — and no wall edge shows between the two */
  const porchTop = eaveY + 0.06 * k;
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
  // (round 14: 0.2 m past the right jamb, was 0.3 — the plateau slope is already 0.3 m over the
  // floor pad a hand's breadth further right; the wall there is hidden behind the jamb from B)
  const roomW1 = doorW1 + 0.2 * k;
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
   * the door looks at sits ≈ 3 m behind the doorway, swinging deepest in the middle.
   *
   * Round 14: the floor is a LEVEL pad at `roomFloorY` cut into the plateau slope (the slope
   * rises through the trunk toward the back and the right: +0.5 m at 1 m right of the axis on
   * the centre line, +1.2 m at 0.8 m behind it). Rounds 12–13 let the floor lift to terrain +
   * 0.05 wherever the slope came through, and only pulled the wall forward where the ground
   * reached within 0.8 m of the ceiling — so through the door (B looks at the back-left, w ≈
   * −0.2 … 0) a pale bank of floor climbed 0.9 m up the back wall (the reviewer's rays at
   * (995,355) / (1002,371) first hit floor faces 1527 / 1559). Now the wall stands where the
   * slope reaches the pad: each column marches forward from the recess depth until the terrain
   * along the column (from the wall to the doorway) stays under the floor, so the wall is a plain
   * vertical face meeting a level floor, deeper on the left, a shallow alcove at the far right.
   * Sampled once on a fine lateral grid (neighbour-conservative) so the wall has no steps.
   */
  const _bd = new Vector3();
  /** the deepest the hollow could go at lateral w (round 12's concave recess) */
  const recessD = (w: number) => {
    const t = clamp((w - roomW0) / (roomW1 - roomW0), 0, 1);
    return -0.1 * R - 0.16 * R * Math.sin(Math.PI * t) + 0.06 * R * noise.noise(w * 0.9 + 2, 0.5);
  };
  /** the terrain (above yFloor) under the column at (w, d) must stay under this to be floor */
  const padTop = roomFloorY - 0.03 * k;
  /** shallowest the room gets (a niche): the far right of the pad, where the slope is steepest */
  const roomDepthMin = 0.5 * k;
  const padCols = 49;
  const padTable: number[] = [];
  for (let i = 0; i < padCols; i++) {
    const w = lerp(roomW0 - 0.05, roomW1 + 0.05, i / (padCols - 1));
    // march from the doorway back into the recess while the ground stays under the pad
    const target = recessD(w);
    let d = roomFront;
    const step = 0.04 * k;
    while (d - step >= target) {
      frame.door(w, 0, d - step, _bd);
      if (terrain.height(_bd.x, _bd.z) - yFloor >= padTop) break;
      d -= step;
    }
    padTable.push(Math.min(d, roomFront - roomDepthMin));
  }
  // neighbour-conservative: a column's wall is never deeper than its neighbours' bound (the
  // floor grid's samples fall between the table's)
  const padBound = padTable.map((d, i) => Math.max(d, padTable[Math.max(0, i - 1)], padTable[Math.min(padCols - 1, i + 1)]));
  const roomBackD = (w: number) => {
    const f = clamp(((w - (roomW0 - 0.05)) / (roomW1 - roomW0 + 0.1)) * (padCols - 1), 0, padCols - 1);
    const i = Math.min(padCols - 2, Math.floor(f));
    return lerp(padBound[i], padBound[i + 1], f - i);
  };
  const roomBackMin = Math.min(roomBackD(roomW0), roomBackD((roomW0 + roomW1) / 2), roomBackD(roomW1));
  /** 0 at the doorway's inner face → 1 at the deepest back wall */
  const depthOf = (p: Vector3) => clamp((roomFront - _bd.copy(p).sub(frame.C).dot(F)) / Math.max(0.5, roomFront - roomBackMin), 0, 1);

  // ---- openings (door-space lateral metres × local height) ----
  const porchSD = (w: number, y: number) => rrectSD(w, y, porchW0, porchW1, yBase - 2, porchTop, porchRc);
  // the opening's edge wanders ±7 cm (a hole gnawed in bark, not a cut frame — reference B's
  // arch is ragged where it meets the lips)
  const doorSD = (w: number, y: number) => rrectSD(w, y, doorW0, doorW1, sill - 1.5, doorTop, doorRc) - 0.07 * k * noise.noise(w * 1.6 + 9, y * 1.6 - 4);
  // Round window carved into the trunk (round 13; boards 03 / 04 "round window built into
  // trunk": ≈ 0.9 m across, a wooden cross frame, bark rolling into the hole, moss and vines
  // round it, a warm interior glow). Left of the arch on the lit left flank, between the left
  // branch pillar and the arc bough's leg, as high as the wall allows: the soffit meets this flank
  // at ≈ 3.05 m (rollBottom less the rim's sag there), so a 0.88 m window tops out just under it
  // with its centre at 2.6 m — in B at (0.658, 0.370), box x 0.64–0.675, y 0.34–0.40, left of
  // the pods and clear of the lip. The first round-13 probe had it at a = −0.88, where the left
  // branch pillar (feet 2.5 m nearer B than the door, so ≈ 15 % larger in frame than the
  // door-plane estimate) covered its right half; −1.08 puts it a pillar's width further left.
  // (Rounds 8–12 had a 0.48 m porthole low on this flank at 1.85 m.)
  const winA = -1.08;
  const winR = 0.44 * sk;
  const winY = rollBottom - sagAt(winA) - winR - 0.03 * k;
  /** the window's face is turned this far from the trunk's normal towards the door: B looks at
   *  this flank 72° off its normal, where a round hole is a sliver, and ≈ 40° off the turned face.
   *  The face sits in a bark boss — proud of the trunk on the far side, funnelled into it on the
   *  door side — and the shell is opened to the boss's foot (`winHoleR`). */
  const WIN_TILT = 0.58;
  /** the face's centre stands this far off the trunk along its normal, so the turned face's
   *  door-side edge sinks only 0.12 m: B's 72°-oblique sightline into anything deeper is cut off
   *  by the boss's own funnel wall (at 0 the right third of the glow was hidden behind it) */
  const WIN_STANDOFF = 0.15 * k;
  const winHoleR = winR + 0.34 * k;

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
      const wsd = Math.hypot(winW(a, rs), y - winY) - winHoleR;
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
    return porchSD(wOf(a, rs), y) < 0 || Math.hypot(winW(a, rs), y - winY) < winHoleR;
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
  // the hearth sits on the floor pad, 0.55 m in front of the back wall (round 14: the pad is
  // level, so the kerb's clearance over it is the fixed 0.01 m — rounds 12–13 lifted both with
  // the terrain where the slope came through the floor)
  const hearthPos = frame.door(doorW1 - 0.3 * k, roomFloorY + 0.2 * k, roomBackD(doorW1 - 0.3 * k) + 0.55 * k);
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
    // (round 14: the back wall stands ≈ 0.3 m nearer the door, so the lamps' pools cover more
    // of the opening — their peaks come down a tenth to hold the doorway's p90 under 0.45)
    // Round 17: the opening must read DARK with two local pools — reference doorway box
    // (0.75–0.83 × 0.40–0.54) p90 0.35 with 3.7 % of it over 0.40 (one glint); take-68's ours
    // p90 0.44 with 19.7 % over 0.40: the whole top-left cell of the box (the left lamp's pool
    // + the arch's glow on the cut) and the right lamp's / hearth's pools. The pools tighten
    // (radius −25 %, peaks −35 %), the arch glow drops to a trace and the ceiling ramp halves
    // (probe 1 at peaks 0.9 / 0.72: p90 0.38, 6.8 % over 0.40; as built, peaks 0.8 / 0.65:
    // p90 0.37, 5.7 % over 0.40 — the left lamp's pool and the right lamp's, nothing between).
    return (0.01 + 0.06 * Math.pow(h, 3)) * lerp(1, 0.35, deep) + pool(p, lampPos, 0.26 * k, 0.24 * k, 0.8) + pool(p, lamp2Pos, 0.24 * k, 0.22 * k, 0.65) + pool(p, hearthPos, 0.18 * k, 0.24 * k, 0.4) + pool(p, archPos, 0.12 * k, 0.3 * k, 0.18);
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
    // floor: the level pad (round 14 — no terrain lift; the back wall stops where the slope
    // reaches it, see `roomBackD`), ceiling
    for (const y of [roomFloorY, roomCeilY]) {
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const w = lerp(roomW0 - 0.02, roomW1 + 0.02, u);
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, v);
            frame.door(w, y, d, out.position);
            const s = (y === roomFloorY ? 0.2 : 0.3) * lerp(1, 0.4, depthOf(out.position));
            out.uv = [w / 2.2, d / 2.2];
            const g = glowAt(_p.copy(out.position));
            out.color = [s * 0.92 + g[0] * 0.5, s * 0.96 + g[1] * 0.5, s * 1.05 + g[2] * 0.5];
          },
          { cols: 16, rows: 16 },
        ),
      );
    }
    // the pad's front edge: a riser from the sill beam's top up to the floor across the doorway
    // (the pad is 0.15 m above the sill; without it the step's face was open under the floor)
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0 - 0.02, roomW1 + 0.02, u);
          const y = lerp(sill - 0.12 * k, roomFloorY, v);
          frame.door(w, y, roomFront + 0.06, out.position);
          out.uv = [w / 2.2, y / 2.2];
          const s = 0.16 - 0.05 * v;
          out.color = [s * 0.92, s * 0.96, s * 1.05];
        },
        // u runs to the viewer's right, v up → dv × du faces into the room; flip to face the door
        { cols: 12, rows: 2, flip: true },
      ),
    );
  }
  /** how far the plateau slope pokes up through the level floor pad (audit; ≤ 0 = never) */
  let floorPoke = -Infinity;
  let pokeAt: [number, number] = [0, 0];
  for (let i = 0; i <= 32; i++)
    for (let j = 0; j <= 32; j++) {
      const w = lerp(roomW0 - 0.02, roomW1 + 0.02, i / 32);
      const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, j / 32);
      frame.door(w, roomFloorY, d, _bd);
      const poke = terrain.height(_bd.x, _bd.z) - _bd.y;
      if (poke > floorPoke) {
        floorPoke = poke;
        pokeAt = [w, d];
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

  // ---- shelves of pots and bottles on the back wall (round 13; boards 03 / 06 show shelves of
  // jars, pots and a bottle in the lamplight behind the door). Low-poly turned shapes in the
  // room material with a paler base, so the lamp above them shows their glazes, lit by the same
  // `aGlow` pools as the walls: two shelves under the left lamp, one under the right, all in the
  // sightline through the door from B (back wall w −1.15…1.2). ----
  const propsMat = indoorFog(roomMaterial(mats, 0x9a8878), doorPlanePoint, F);
  materials.push(propsMat);
  let propCount = 0;
  {
    const propRng = rng.fork('props');
    const props: BufferGeometry[] = [];
    const shelfD = 0.26 * k;
    /** a plank on two brackets, its back edge against the (concave) wall; returns its top */
    const shelf = (w0: number, w1: number, y: number) => {
      const wc = (w0 + w1) / 2;
      const d = Math.max(roomBackD(w0), roomBackD(wc), roomBackD(w1)) + shelfD / 2 + 0.01 * k;
      const board = new BoxGeometry(w1 - w0, 0.035 * k, shelfD);
      board.applyMatrix4(basisMatrix(frame.door(wc, y, d), F));
      setColorAttribute(board, [0.4, 0.32, 0.24]);
      props.push(board);
      for (const w of [w0 + 0.12 * k, w1 - 0.12 * k]) {
        const bracket = new BoxGeometry(0.04 * k, 0.16 * k, shelfD * 0.75);
        bracket.applyMatrix4(basisMatrix(frame.door(w, y - 0.1 * k, d - 0.03 * k), F));
        setColorAttribute(bracket, [0.3, 0.24, 0.18]);
        props.push(bracket);
      }
      return { y: y + 0.018 * k, d };
    };
    const glazes: [number, number, number][] = [
      [0.95, 0.55, 0.38], // terracotta
      [0.92, 0.88, 0.74], // cream glaze
      [0.36, 0.52, 0.36], // green glass
      [0.42, 0.46, 0.72], // blue glaze
      [0.56, 0.42, 0.3], // brown earthenware
    ];
    // the shapes are built standing along +y, turned onto +z (rotateX +90°) and stood up on the
    // shelf by basisMatrix (local +z → world up)
    const place = (geo: BufferGeometry, w: number, top: { y: number; d: number }, tint: [number, number, number]) => {
      geo.applyMatrix4(basisMatrix(frame.door(w, top.y, top.d + (propRng() - 0.5) * 0.06 * k), new Vector3(0, 1, 0)));
      setColorAttribute(geo, tint);
      props.push(geo);
      propCount++;
    };
    /** a jar (tapered cylinder), a round pot (squashed sphere), a bottle (body + neck) or a bowl */
    const jar = (w: number, top: { y: number; d: number }, r: number, h: number, tint: [number, number, number]) => {
      const g = new CylinderGeometry(r * 0.8, r, h, 10, 1);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, h / 2);
      place(g, w, top, tint);
    };
    const roundPot = (w: number, top: { y: number; d: number }, r: number, tint: [number, number, number]) => {
      const g = new SphereGeometry(r, 10, 7);
      g.scale(1, 0.8, 1);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, r * 0.8);
      place(g, w, top, tint);
    };
    const bottle = (w: number, top: { y: number; d: number }, r: number, h: number, tint: [number, number, number]) => {
      const body = new CylinderGeometry(r, r * 0.95, h * 0.62, 8, 1);
      body.translate(0, h * 0.31, 0);
      const neck = new CylinderGeometry(r * 0.38, r * 0.7, h * 0.38, 8, 1);
      neck.translate(0, h * 0.81, 0);
      const g = merge([body, neck]);
      g.rotateX(Math.PI / 2);
      place(g, w, top, tint);
    };
    const bowl = (w: number, top: { y: number; d: number }, r: number, tint: [number, number, number]) => {
      const g = new CylinderGeometry(r, r * 0.55, r * 0.55, 10, 1);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, r * 0.275);
      place(g, w, top, tint);
    };
    // upper left shelf, right under the left lamp's pool; a lower one beneath it; one on the
    // right under the second lamp
    const s1 = shelf(lampW - 0.7 * k, lampW + 0.5 * k, lampY - 0.52 * k);
    jar(lampW - 0.5 * k, s1, 0.11 * k, 0.24 * k, glazes[0]);
    roundPot(lampW - 0.22 * k, s1, 0.1 * k, glazes[1]);
    bottle(lampW + 0.02 * k, s1, 0.045 * k, 0.32 * k, glazes[2]);
    jar(lampW + 0.2 * k, s1, 0.08 * k, 0.17 * k, glazes[4]);
    bowl(lampW + 0.38 * k, s1, 0.1 * k, glazes[1]);
    const s2 = shelf(lampW - 0.6 * k, lampW + 0.35 * k, lampY - 1.02 * k);
    roundPot(lampW - 0.42 * k, s2, 0.13 * k, glazes[4]);
    bottle(lampW - 0.16 * k, s2, 0.05 * k, 0.28 * k, glazes[3]);
    jar(lampW + 0.05 * k, s2, 0.09 * k, 0.2 * k, glazes[0]);
    bottle(lampW + 0.24 * k, s2, 0.04 * k, 0.24 * k, glazes[2]);
    const lamp2Y = lamp2Pos.y - yFloor;
    const s3 = shelf(lamp2W - 0.45 * k, lamp2W + 0.35 * k, lamp2Y - 0.42 * k);
    jar(lamp2W - 0.28 * k, s3, 0.1 * k, 0.22 * k, glazes[1]);
    roundPot(lamp2W - 0.02 * k, s3, 0.11 * k, glazes[0]);
    bottle(lamp2W + 0.22 * k, s3, 0.045 * k, 0.3 * k, glazes[3]);
    const propsGeo = merge(props);
    const pos = propsGeo.attributes.position;
    const _g = new Vector3();
    setFloatAttribute(propsGeo, 'aGlow', (i) => glowOf(_g.set(pos.getX(i), pos.getY(i), pos.getZ(i))));
    const propsMesh = new Mesh(propsGeo, propsMat);
    propsMesh.name = 'interior-props';
    propsMesh.receiveShadow = true;
    group.add(propsMesh);
  }

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
    // (round 12's single dark shelf up by the lamp is replaced by round 13's stocked shelves in
    // the room material, see `interior-props`)
    // ember ring: a low stone kerb round the glow
    const kerb = new TorusGeometry(0.2 * k, 0.05 * k, 6, 12);
    kerb.rotateX(Math.PI / 2);
    kerb.translate(hearthPos.x, hearthPos.y - 0.14 * k, hearthPos.z);
    setColorAttribute(kerb, [0.18, 0.18, 0.18]);
    const furnitureMesh = new Mesh(merge([slab, block, kerb]), mats.woodDark);
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

  // ---- round window (round 13, board 04 "window detail"): a bark collar rolling into the
  // hole, a socket bored into the trunk whose back glows amber — the unlit window-glow material
  // the round 8–12 porthole used, with a vertex-colour gradient (a lamp's pool at the back's
  // centre, the socket's walls dimming to its mouth) so it reads as a lit hole, not a flat disc;
  // the room material's lit-by-the-lamps glow is far too faint out here on the flank, 4 m from
  // the nearest lamp — a wooden cross frame set a hand into the socket, moss on the collar's top
  // and vines trailing off it ----
  const winCentre = frame.at(winA, rSmooth(winA, winY) + WIN_STANDOFF, winY);
  /** the turned face's normal and its horizontal tangent towards the door */
  const winO = frame.dir(winA + WIN_TILT);
  const winT = new Vector3().crossVectors(new Vector3(0, 1, 0), winO).normalize();
  /** buttress roots, root lips and the window's bark collar — one bark mesh */
  const rootParts: BufferGeometry[] = [];
  {
    const O = winO;
    const T = winT;
    const up = new Vector3(0, 1, 0);
    const surf = winCentre.clone();
    // B looks at the turned face ≈ 40° off its normal. The hole is bored obliquely — its axis
    // leans a further 0.62 rad towards the door, i.e. nearly along B's line of sight — and is
    // 0.15 m deep, so from B the whole glowing back shows through the mouth (at 0.35 rad the
    // door-side wall of the bore covered the right third of the glow, a D not a disc) while
    // from the flank the rim still reads as a hole in the trunk
    const socketD = 0.15 * k;
    const lean = Math.tan(0.62);
    /** local x of basisMatrix(·, O) is the tangent towards the door; shear each ring towards it
     *  by its depth into the trunk (local −z) */
    const shear = new Matrix4().set(1, 0, -lean, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const winParts: BufferGeometry[] = [];
    const socket = new CylinderGeometry(winR, winR * 0.94, socketD + 0.1, 28, 1, true);
    socket.rotateX(Math.PI / 2);
    // the cylinder is centred 0.03 proud of the surface; move it so the shear is about the mouth
    socket.translate(0, 0, -(socketD + 0.1) / 2 + 0.03);
    socket.applyMatrix4(shear);
    socket.applyMatrix4(basisMatrix(surf, O));
    winParts.push(socket);
    const back = new CircleGeometry(winR * 0.95, 28);
    back.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -socketD).addScaledVector(T, socketD * lean), O));
    winParts.push(back);
    const winGeo = merge(winParts);
    {
      // the glow: brightest at the back's centre (a lamp in the room behind it), the back's edge
      // at 0.6 and the socket's walls dimming from there to 0.3 at the mouth
      const pos = winGeo.attributes.position;
      const _w = new Vector3();
      const backC = winCentre.clone().addScaledVector(O, -socketD).addScaledVector(T, socketD * lean);
      setColorAttribute(winGeo, (i) => {
        _w.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const depth = clamp(-_w.clone().sub(winCentre).dot(O) / socketD, 0, 1);
        const radial = clamp(_w.sub(backC).length() / winR, 0, 1);
        const g = depth >= 0.98 ? lerp(1, 0.6, radial * radial) : lerp(0.3, 0.6, depth);
        return [g, g * (0.97 - 0.04 * g), g * (0.9 - 0.08 * g)];
      });
    }
    const winGlowMat = mats.windowGlow.clone();
    winGlowMat.vertexColors = true;
    materials.push(winGlowMat);
    const winMesh = new Mesh(winGeo, winGlowMat);
    winMesh.name = 'window-socket';
    group.add(winMesh);
    // cross frame: two rough branch bars, a little irregular, set 8 cm into the socket
    const barParts: BufferGeometry[] = [];
    const barC = surf.clone().addScaledVector(O, -0.08 * k).addScaledVector(T, 0.08 * k * lean);
    for (const axis of [new Vector3(0, 1, 0), T]) {
      const bar = new CylinderGeometry(0.05 * sk, 0.045 * sk, 2 * winR + 0.1, 8, 1);
      // CylinderGeometry stands along +y; basisMatrix maps local +z → axis, so turn y onto z first
      bar.rotateX(Math.PI / 2);
      bar.applyMatrix4(basisMatrix(barC, axis));
      setColorAttribute(bar, [0.55, 0.5, 0.42]);
      barParts.push(bar);
    }
    const barsMesh = new Mesh(merge(barParts), mats.woodDark);
    barsMesh.name = 'window-frame';
    barsMesh.castShadow = barsMesh.receiveShadow = true;
    group.add(barsMesh);
    // bark collar: a knobbly ring of the trunk's bark rolling over the hole's edge
    const collarPts: Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * TAU;
      collarPts.push(surf.clone().addScaledVector(up, Math.cos(t) * (winR + 0.05 * k)).addScaledVector(T, Math.sin(t) * (winR + 0.05 * k)).addScaledVector(O, -0.03 * k + 0.02 * k * Math.cos(t)));
    }
    const collarCurve = new CatmullRomCurve3(collarPts, true, 'catmullrom', 0.5);
    let collarCrest = 0;
    const collar = sweepTube(collarCurve, {
      radius: (t) => 0.11 * k * (1 + 0.15 * Math.sin(t * TAU * 5 + 1) + 0.08 * Math.sin(t * TAU * 13)),
      tubularSegments: 40,
      radialSegments: 9,
      uvMetres: 1.2,
      displace: (t, ang) => {
        collarCrest = noise.ridged(ang * 1.3 + t * 9, t * 4 + 3, 2) - 0.5;
        return collarCrest * 0.035 * k;
      },
      color: (t, ang) => {
        const d = 0.7 * (0.85 + 0.2 * Math.max(0, Math.sin(ang))) * (1 + 0.4 * clamp(collarCrest * 2.4, -1, 1));
        return [d, d * 0.95, d * 0.88];
      },
    });
    rootParts.push(mossOnTop(collar, [0.5, 0.64, 0.3], 0.5, noise));
    // the boss: a bark skirt from under the collar out to the trunk — on the far side a burl
    // standing ≈ 0.4 m off the wall, on the door side a shallow funnel — whose foot tucks under
    // the shell's opening (winHoleR, the shell is smooth there: `detail` fades out round the hole)
    const skirtR0 = winR + 0.02 * k;
    const skirtR1 = winR + 0.42 * k;
    const rsW = rSmooth(winA, winY);
    const O0 = frame.dir(winA);
    let skirtCrest = 0;
    const skirt = gridSurface(
      (u, v, out) => {
        const t = u * TAU;
        const ct = Math.cos(t);
        const st = Math.sin(t);
        const inner = surf.clone().addScaledVector(up, ct * skirtR0).addScaledVector(T, st * skirtR0).addScaledVector(O, -0.07 * k);
        const aO = winA + (st * skirtR1) / rsW;
        const yO = winY + ct * skirtR1;
        const outer = frame.at(aO, rSmooth(aO, yO) - 0.06 * k, yO);
        const s = smoothstep(0, 1, v);
        out.position.copy(inner).lerp(outer, s);
        skirtCrest = noise.ridged(t * 2.5 + 7, v * 3 + 1, 2) - 0.5;
        out.position.addScaledVector(O0, skirtCrest * 0.03 * k * Math.sin(v * Math.PI));
        out.uv = [(t * skirtR1) / 1.2, (v * 0.4) / 1.2];
        const d = 0.7 * (0.85 + 0.2 * Math.max(0, ct)) * (1 + 0.4 * clamp(skirtCrest * 2.4, -1, 1)) * lerp(0.9, 1, s);
        out.color = [d, d * 0.95, d * 0.88];
      },
      // u runs up → towards the door, v inner → outer: dv × du points into the trunk; flip
      { cols: 36, rows: 4, closedU: true, flip: true },
    );
    rootParts.push(mossOnTop(skirt, [0.5, 0.64, 0.3], 0.35, noise));
  }
  // ---- burls (round 17): take-68's "knotted trunk" — the reference trunk is gnarled where it
  // meets the roots and the arch, ours read as a smooth shell (B left-silhouette roughness,
  // linear-detrended edge std, 2.2 px — a straight line). Five knots, 0.3–0.36 m proud of the
  // smooth wall, sunk 0.15 m into it, ridged, mossy on top: two on the left flank's silhouette
  // (B x ≈ 0.60–0.62, y 0.41 / 0.45 — above the buttress roots, which hide the wall below
  // ≈ 1.2 m from B), one left of the left lip above the south-west root's junction, one right
  // of the right post above the east root's, one high on the right silhouette. Clear of the
  // window's boss (≥ 0.95 m from its skirt), the pillars and the bough's root. As built the B
  // left-silhouette edge std is 3.0 px (HEAD 2.2; the reference's 13.7 is its sign's moss slope,
  // not a trunk edge).
  // Round 19: the cords' noise took atan2's angle straight, so the sphere's duplicated seam
  // column (u = 0 / u = 1) was displaced twice differently — paired seam vertices 3–6 cm apart,
  // normals 50–100° apart, a crease down the front of every knot. The cords are now sampled
  // round a ring (`ringRidged`, periodic in the angle) and the seam's and the poles' normals
  // are welded; the residual deltas are audited (`burls`: expect 0 mm / 0°). ----
  const burlRng = rng.fork('burls');
  const burls: { a: number; y: number; bump: number }[] = [
    { a: -1.5, y: 1.8, bump: 0.36 },
    { a: -1.38, y: 1.3, bump: 0.3 },
    { a: -0.95, y: 1.4, bump: 0.3 },
    { a: 1.02, y: 1.5, bump: 0.32 },
    { a: 1.4, y: 2.0, bump: 0.3 },
  ];
  const burlSeam = { count: 0, seamMaxPosMm: 0, seamMaxNormalDeg: 0 };
  for (const b of burls) {
    const rb = (b.bump + 0.15) * k;
    const yb = b.y * k;
    const N = frame.dir(b.a);
    /** squash along the wall's normal: a flatter dome whose front stands `bump` proud of the smooth wall */
    const squash = 0.85;
    const centre = frame.at(b.a, rSmooth(b.a, yb) + b.bump * k - squash * rb, yb);
    // the knot: a squashed sphere (poles up, bark cords running round it top to bottom, a few
    // lumps), the shell's bark tint with lit crests and dark furrows
    const seed = burlRng() * 10;
    const knot = new SphereGeometry(rb, 20, 14);
    knot.scale(1, 1, squash);
    {
      const pos = knot.attributes.position;
      const _q = new Vector3();
      const crests: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        _q.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dir = _q.clone().normalize();
        const ang = Math.atan2(dir.z, dir.x);
        const crest = ringRidged(noise, ang, dir.y * 2.2, 1.6, seed);
        const lump = noise.noise(dir.x * 1.8 + seed, dir.y * 1.8 - seed) * 0.08;
        crests.push(crest);
        _q.addScaledVector(dir, (crest * 0.1 + lump) * k);
        pos.setXYZ(i, _q.x, _q.y, _q.z);
      }
      knot.computeVertexNormals();
      weldNormals(knot);
      weldSphereSeam(knot, 20, 14);
      const seam = sphereSeamDeltas(knot, 20, 14);
      burlSeam.count++;
      burlSeam.seamMaxPosMm = Math.max(burlSeam.seamMaxPosMm, seam.maxPosMm);
      burlSeam.seamMaxNormalDeg = Math.max(burlSeam.seamMaxNormalDeg, seam.maxNormalDeg);
      setColorAttribute(knot, (i) => {
        const c = clamp(crests[i] * 2.4, -1, 1);
        const d = 0.62 * (1 + 0.45 * c) * (0.85 + 0.15 * Math.max(0, knot.attributes.normal.getY(i)));
        return [d, d * 0.95, d * 0.86];
      });
      // bark map at the trunk's density (metres / 2.2)
      const uv = knot.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * TAU * rb) / 2.2 + b.a, (uv.getY(i) * Math.PI * rb) / 2.2 + yb);
    }
    // basisMatrix maps local +z → N and keeps local +y (the poles) up
    knot.applyMatrix4(basisMatrix(centre, N));
    rootParts.push(mossOnTop(knot, [0.5, 0.64, 0.3], 0.6, noise));
  }

  // ---- buttress roots seated on the terrain ----
  const bases: [number, number, number][] = [];
  const rootCount = def.id === 'saria' ? 6 : 5;
  const rootRng = rng.fork('roots');
  /**
   * The other houses' trunks (centre, keep-out radius: their flared foot plus a margin). The
   * roots follow the terrain, and the upper house stands on the plateau right behind Saria's —
   * its root toward her ran down the slope INTO her hollow (round 14: the reviewer's B rays
   * through the door first hit `roots` of house-upper, a pale limb 0.85 m over her floor, 0.15 m
   * in front of the back wall). A root whose waypoints would land inside another trunk above
   * that house's floor is shortened until they stay out; one that starts inside is dropped (its
   * rng draws are still taken). Roots under another house's floor (Saria's own root climbing
   * the slope to the upper house's foot) are left alone — nothing shows there.
   */
  const keepOut = ctx.layout.houses.filter((h) => h.id !== def.id).map((h) => ({ x: h.position[0], z: h.position[2], r: h.trunkRadius * 1.1, yMin: h.position[1] + 0.35 }));
  const insideOther = (p: Vector3) => keepOut.some((o) => p.y > o.yMin && Math.hypot(p.x - o.x, p.z - o.z) < o.r);
  let rootsBuilt = 0;
  for (let i = 0; i < rootCount; i++) {
    const a = 0.8 + (i / (rootCount - 1)) * (TAU - 1.6) + (rootRng() - 0.5) * 0.25;
    const y0 = 0.55 + rootRng() * 0.7;
    const r0 = (0.3 + rootRng() * 0.14) * k;
    let reach = R * (0.55 + rootRng() * 0.4);
    const rs0 = rSmooth(a, 0);
    const dir = frame.dir(a);
    const side = new Vector3(dir.z, 0, -dir.x).multiplyScalar((rootRng() - 0.5) * 0.7);
    const p0 = frame.at(a, rSmooth(a, y0) - 0.4, y0);
    const p1 = frame.at(a, rSmooth(a, y0 * 0.65) + 0.1, y0 * 0.66);
    /** the waypoints on the ground for a given reach: over the terrain, on it, sunk into it */
    const groundPts = (reachNow: number) => {
      const p2 = frame.at(a, rs0 + reachNow * 0.45, 0).addScaledVector(side, 0.5);
      p2.y = terrain.height(p2.x, p2.z) + 0.28 * k;
      const p3 = frame.at(a, rs0 + reachNow, 0).add(side);
      p3.y = terrain.height(p3.x, p3.z);
      const p4 = frame.at(a, rs0 + reachNow + 0.6, 0).addScaledVector(side, 1.3);
      p4.y = terrain.height(p4.x, p4.z) - 0.4;
      return [p2, p3, p4];
    };
    let ground = groundPts(reach);
    while (reach > 0.3 * R && ground.some(insideOther)) {
      reach -= 0.1 * R;
      ground = groundPts(reach);
    }
    if (insideOther(p1) || ground.some(insideOther)) continue;
    rootsBuilt++;
    const [p2, p3, p4] = ground;
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
  // ---- the entrance arch (round 19). Rounds 12–17 framed the door with two root lips (thick
  // buttress roots hugging the jambs, their tops sunk into the cap), two slender branch pillars
  // forked into the rim, and over all of it the cap's moss rim curl with the dark soffit under
  // it — W25 on take 70: "broad smooth wall fins / forked supports and a separate sloping moss
  // cap versus the reference's thick knotted arch flowing into the crown". Reference frame 14 s
  // and boards 03 / 04: the entrance is ONE thick knotted mass — root lips, jambs, lintel and
  // the cap's front rim are a continuous gnarled bark form with moss creeping over its top; the
  // cap does not sit on the wall like a hat with an eave line, and the 'pillars' are living
  // roots that grow out of the arch. So one swept tube runs from the left foot up the left jamb
  // — round 17's axis, waypoints and jitter there, so the opening's inner faces in B stay at
  // x 0.716 / 0.867 — leans forward over the left shoulder, arches over the door along the
  // rim curl's own line (its axis 0.25 m under the curl's centre and 5 cm outside it, 0.94 m
  // tall and 1.5 m deep: the curl's bottom and the soffit behind it are inside the body over
  // the front third, so the eave line ends where the arch begins), and comes down the right
  // jamb to the right foot. Its crown stands in the cap's front slope (top ≈ 3.2 m, the cap's
  // moss surface at its back) and the moss runs down over its front rim in tongues. Ring-periodic cords and world-space lumps
  // knot it (no seam), the normals are welded, the shading follows the real normal (lit on
  // top, darker up under the cap). The porch cut rises to meet its underside (`porchTop`), so
  // the opening's crown is the arch's underside, not a wall edge behind it. ----
  const lipFlare = 0.55 * k;
  const lipRng = rng.fork('lips');
  /** each jamb leg's axis outside its jamb line (round 12: 0.34 m both; round 17: the arch widens —
   *  see `porchW0` — 0.54 m left, 0.84 m right) */
  const lipOut = (side: -1 | 1) => (side < 0 ? 0.54 : 0.84) * k;
  /** door-space height of a world point */
  const heightOf = (p: Vector3) => p.y - frame.C.y;
  /** door-space lateral coordinate of a world point */
  const lateralOf = (p: Vector3) => (p.x - frame.C.x) * Rt.x + (p.z - frame.C.z) * Rt.z;
  /** one jamb leg's waypoints, foot → jamb top (round 17's lip axis; the jitter draws in the same order) */
  const archLeg = (side: -1 | 1) => {
    const jamb = side < 0 ? doorW0 : doorW1;
    const wAxis = jamb + side * lipOut(side);
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
    ];
    return { foot, pts };
  };
  /** the crown's axis: along the rim curl, 5 cm outside it and 0.25 m under its centre, lifted a
   *  little at the door's centre so it arches. (Probes 0.13 and 0.25 m higher left the curl's
   *  bottom, the soffit and the wall's eave band peeking out under the crown in B — a moss / dark
   *  line at y 0.27–0.30 — where the cords and knuckles thin the body and where B's sight-lines
   *  pass under it and rise 0.18 m per metre; the axis sits so its underside, 2.3–2.5 m, is the
   *  lowest thing over the door, and its back reaches under the eave — `archBody`.) */
  const ARCH_HALF = 0.42;
  const archAxis = (a: number) => {
    const rc = capR(a) - capInset + 0.05 * k;
    const lift = 0.05 * k * Math.cos((a / ARCH_HALF) * (Math.PI / 2));
    return frame.at(a, rc, rollBottom + lipR - sagAt(a) - rimWave(a) - 0.07 * k + lift);
  };
  /** the shoulder knots where the crown turns down and back to the jamb legs (the buttresses grow
   *  from here); 0.1 m under the crown's axis so the body arches over the door */
  const archShoulder = (side: -1 | 1) => frame.door(side < 0 ? -1.8 * k : 2.05 * k, 2.65 * k, 3.45 * k);
  const legL = archLeg(-1);
  const legR = archLeg(1);
  const archPts = [
    ...legL.pts,
    archShoulder(-1),
    ...[-ARCH_HALF, -0.25, -0.08, 0.08, 0.25, ARCH_HALF].map((a) => archAxis(a)),
    archShoulder(1),
    ...legR.pts.slice().reverse(),
  ];
  const archCurve = new CatmullRomCurve3(archPts, false, 'catmullrom', 0.5);
  const _ap = new Vector3();
  /** radius: 0.5 m at the feet tapering to 0.39 m up the jamb legs, 0.47 m over the crown, knuckled */
  const archRadius = (t: number) => {
    archCurve.getPointAt(t, _ap);
    const y = heightOf(_ap);
    const base = lerp(0.5, 0.39, smoothstep(0, 1.7 * k, y)) + 0.08 * smoothstep(2.3 * k, 2.7 * k, y);
    return base * k * (1 + 0.1 * Math.sin(t * 23 + 1) + 0.05 * Math.sin(t * 57 + 2));
  };
  /** the crown's top, door-space (the cap's moss creeps down from here) */
  const archTopY = heightOf(archAxis(0)) + 0.47 * k;
  /**
   * Knots: a dozen burls scattered over the body — gaussian bumps centred on the surface, in
   * world space (so the ring seam and the tube frames never show) — on top of the ring-periodic
   * cords and broad fbm lumps. Drawn from the lips' stream after the legs' jitter.
   */
  const archKnots: { c: Vector3; s: number; h: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const t = 0.08 + lipRng() * 0.84;
    const phi = lipRng() * TAU;
    const c = archCurve.getPointAt(t);
    const r = archRadius(t);
    const T = archCurve.getTangentAt(t);
    const side = new Vector3(T.z, 0, -T.x).normalize();
    const up = new Vector3().crossVectors(T, side).normalize();
    c.addScaledVector(side, Math.cos(phi) * r * 0.85).addScaledVector(up, Math.sin(phi) * r * 0.85);
    archKnots.push({ c, s: (0.24 + lipRng() * 0.22) * k, h: (0.12 + lipRng() * 0.13) * k });
  }
  const knotsAt = (p: Vector3) => {
    let d = 0;
    for (const kn of archKnots) {
      const q = p.distanceToSquared(kn.c) / (kn.s * kn.s);
      if (q < 6) d += kn.h * Math.exp(-q);
    }
    return d;
  };
  // the relief of the vertex being placed (sweepTube colours a vertex right after displacing it):
  // cord crest ∈ ±0.5 and the hollow / bump term in metres
  let archCrest = 0;
  let archRelief = 0;
  const archDisplace = (seed: number, cordAmp: number, lumpAmp: number, along: number) => (t: number, ang: number, pos: Vector3) => {
    archCrest = ringRidged(noise, ang, t * along + pos.y * 0.3, 1.4, seed);
    const lump = noise.fbm(pos.x * 1.3 + 5, pos.z * 1.3 + pos.y * 0.7, 2) - 0.5;
    archRelief = lump * lumpAmp * k + knotsAt(pos);
    return archCrest * cordAmp * k + archRelief;
  };
  /** the relief terms only; the shade comes from the welded normals in `shadeArch` */
  const reliefColor = (): [number, number, number] => [clamp(archCrest * 2.4, -1, 1), archRelief / k, 0];
  /**
   * The crown is deeper than it is tall: from the shoulders up, its back stretches 0.5 m toward
   * the wall (a torus pulled along −F, the legs stay round), so it fills the soffit under the
   * cap's eave and B's sight-lines under the crown end on the arch's own dark underside, not on
   * the eave's underside or the wall's eave band 1–1.5 m behind it (round 19's second probe
   * still showed 2–7 rows of those between the crown and the porch at x 0.73–0.85).
   */
  const archCrownDisplace = archDisplace(2.3, 0.14, 0.2, 16);
  const archBody = (t: number, ang: number, pos: Vector3) => {
    const d = archCrownDisplace(t, ang, pos);
    archCurve.getPointAt(t, _ap);
    const rx = pos.x - _ap.x;
    const rz = pos.z - _ap.z;
    const rl = Math.hypot(rx, pos.y - _ap.y, rz) || 1;
    const back = Math.max(0, -(rx * F.x + rz * F.z) / rl);
    return d + back * back * 0.5 * k * smoothstep(2.45 * k, 2.7 * k, heightOf(_ap));
  };
  const arch = sweepTube(archCurve, {
    radius: archRadius,
    tubularSegments: 120,
    radialSegments: 16,
    uvMetres: 1.4,
    displace: archBody,
    color: reliefColor,
  });
  weldNormals(arch);
  weldTubeSeam(arch, 120, 16);
  /**
   * Bark shade from the real normal and the relief: lit on top, a touch on the front; cord
   * crests and bumps light, furrows and hollows dark (the reference's arch face in B, x 0.72–0.86
   * × y 0.24–0.31, runs p10 0.24 → p90 0.54 — lit crests and moss over deep dark furrows; a flat
   * tint rendered p10 0.30 / p90 0.38). The tint darkens from the jambs (reference lips lum
   * 0.36–0.38) up to the crown in the cap's shade. The body is drawn in its own bark
   * (ARCH_BARK_FLOOR: the house floor's tint at an intermediate lift with most of the albedo
   * textured) — under the wall's 6.3 floor nothing on it could drop below the wall's shade level
   * (dark share 0 against the reference's 0.17) and under the recess's 1.2 it was uniformly dark.
   * Then moss: on every upward face (as on the roots) and, over the crown, creeping down the
   * front in tongues where the cap's moss runs onto it.
   */
  const shadeArch = (geo: BufferGeometry, yDark0: number, yDark1: number, mossAmount: number, creep: boolean) => {
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const col = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      _ap.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const y = heightOf(_ap);
      const up = nrm.getY(i);
      const front = nrm.getX(i) * F.x + nrm.getZ(i) * F.z;
      const crest = col.getX(i);
      const relief = clamp(col.getY(i) * 6, -1, 1);
      // ×1.8 over the roots' tints: ARCH_BARK_FLOOR takes 85 % of its albedo from the surface
      const base = 1.8 * lerp(0.72, 0.6, smoothstep(yDark0, yDark1, y));
      const d = base * (0.7 + 0.3 * Math.max(0, up) + 0.06 * Math.max(0, front)) * (1 + 0.6 * crest) * (1 + 0.45 * relief);
      const patch = 0.45 + 0.55 * noise.fbm(_ap.x * 1.7 + 3, _ap.z * 1.7 + y * 0.6, 2);
      let w = smoothstep(0.25, 0.85, up) * patch * mossAmount;
      if (creep) {
        // the crown's upper half under the cap: moss over the top and down over the front rim
        // where the patch noise is dense (tongues), never on the underside
        const high = smoothstep(archTopY - 0.6 * k, archTopY - 0.1 * k, y);
        w = Math.max(w, high * smoothstep(0.35, 0.7, patch + 0.5 * up + 0.3 * Math.max(0, front) - 0.3));
      }
      w = clamp(w, 0, 1);
      // olive bark, and a moss tint green enough to read as moss on this warm bark (the material's
      // 0xdcb086 × the map leave g/r ≈ 0.6 linear; the roots' ×2.4 tint rendered amber here). The
      // reference's arch face in B runs g/r 0.92–0.94 on its moss tongues, 0.83 on bare bark.
      col.setXYZ(i, lerp(d, 0.8, w), lerp(d * 1.15, 2.2, w), lerp(d * 0.84, 0.5, w));
    }
    return geo;
  };
  const archParts: BufferGeometry[] = [shadeArch(arch, 1.2 * k, 3.0 * k, 0.55, true)];
  bases.push([legL.foot.x, legL.foot.y, legL.foot.z], [legR.foot.x, legR.foot.y, legR.foot.z]);
  /** the arch body's underside (world y) over door-space lateral w, for the pods' hooks */
  const archUnderY = (w: number) => {
    let best = Infinity;
    let bestY = frame.C.y + rollBottom;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      archCurve.getPointAt(t, _ap);
      if (heightOf(_ap) < 2.4 * k) continue;
      const dw = Math.abs(lateralOf(_ap) - w);
      if (dw < best) {
        best = dw;
        bestY = _ap.y - archRadius(t) * 0.92;
      }
    }
    return bestY;
  };
  /** the arch body's crown profile on the door axis (audit) */
  const archCrownAxis = archAxis(0);
  const archProfile = {
    crownAxis: archCrownAxis.toArray() as P3,
    crownRadius: 0.47 * k,
    underside: heightOf(archCrownAxis) - 0.47 * k,
    top: heightOf(archCrownAxis) + 0.47 * k,
    span: ARCH_HALF * 2,
  };
  // ---- root-buttresses (round 19; rounds 13–17's two slender branch pillars with forks into
  // the rim — take 70's "forked supports"). Board 04's "branch pillars support the entrance"
  // are, in frame 14 s, living roots growing out of the arch: each buttress starts inside the
  // arch body at its shoulder knot, comes out forward and outward, thickens as it drops and
  // plunges into the ground with a flared foot (0.42–0.5 m radius on the terrain) where the
  // pillars' feet stood: B x ≈ 0.70 (in front of the left jamb leg, outside the opening's inner
  // face and clear of the round window at x 0.64–0.675) and ≈ 0.91, the reference's thick right
  // root. Knotted like the arch, welded, mossy on top; the cap's vines hang from where each
  // leaves the arch (`pillarTops`). ----
  const pillarRng = rng.fork('pillars');
  const pillarTops: { top: Vector3; foot: P3; side: -1 | 1; footRadius: number }[] = [];
  for (const side of [-1, 1] as const) {
    const jit6 = () => (pillarRng() - 0.5) * 0.06 * k;
    const wFoot = side < 0 ? -2.05 * k : 2.5 * k;
    const dFoot = side < 0 ? 4.05 * k : 3.7 * k;
    const foot = frame.door(wFoot, 0, dFoot);
    foot.y = terrain.height(foot.x, foot.z);
    const start = archShoulder(side);
    const pts = [
      start,
      frame.door(lateralOf(start) + side * 0.3 * k + jit6(), 2.25 * k, 3.75 * k + jit6()),
      frame.door(wFoot - side * 0.12 * k + jit6(), 1.2 * k, dFoot - 0.05 * k + jit6()),
      foot,
      foot.clone().setY(foot.y - 0.45 * k).add(new Vector3(jit6(), 0, jit6())),
    ];
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    /** 0.2 m where it is buried in the arch → 0.38 m at the ground, plus the foot's flare */
    const buttressR = (t: number) => (0.2 + 0.18 * t + 0.1 * smoothstep(0.6, 0.85, t)) * k * (1 + 0.08 * Math.sin(t * 13 + side * 2) + 0.05 * Math.sin(t * 31 + side));
    // the foot on the terrain sits at the 4th of 5 waypoints (t ≈ 0.8 of the arc length)
    let tFoot = 0.8;
    {
      let best = Infinity;
      for (let i = 0; i <= 100; i++) {
        const d = curve.getPointAt(i / 100, _ap).distanceTo(foot);
        if (d < best) {
          best = d;
          tFoot = i / 100;
        }
      }
    }
    const buttress = sweepTube(curve, {
      radius: buttressR,
      tubularSegments: 32,
      radialSegments: 14,
      uvMetres: 1.4,
      displace: archDisplace(4.1 + side, 0.08, 0.12, 8),
      color: reliefColor,
    });
    weldNormals(buttress);
    weldTubeSeam(buttress, 32, 14);
    archParts.push(shadeArch(buttress, 1.0 * k, 2.9 * k, 0.5, false));
    pillarTops.push({ top: curve.getPointAt(0.1), foot: [foot.x, foot.y, foot.z], side, footRadius: buttressR(tFoot) });
    bases.push([foot.x, foot.y, foot.z]);
  }
  const rootsMesh = new Mesh(merge(rootParts), mats.bark);
  rootsMesh.name = 'roots';
  rootsMesh.castShadow = rootsMesh.receiveShadow = true;
  group.add(rootsMesh);
  // the arch and its buttresses: their own bark floor (see `shadeArch` / ARCH_BARK_FLOOR) — one
  // more draw per house
  const archMesh = new Mesh(merge(archParts), mats.archBark);
  archMesh.name = 'roots-arch';
  archMesh.castShadow = archMesh.receiveShadow = true;
  group.add(archMesh);

  // ---- roof: low broad mushroom cap of moss with a curled rim and a dark soffit ----
  // v ∈ [0, V_CAP] is the cap top (q = v / V_CAP is the normalised radius: flat crown, rounded
  // shoulder — (1 − q³)^1.5), (V_CAP, 1] curls round the rim from its top to its underside.
  // Round 12: the rim is MOSS all the way round to the soffit — the round-8/11 bark roll under it
  // read in B as a horizontal eave beam; the reference cap's moss edge simply overhangs.
  const V_CAP = 0.72;
  const capHeight = crownY - lipTop;
  /** the bare cap at an arbitrary rim / crown scale (the audit compares against ×1.0 / ×1.0) */
  /** round 17: the shoulder's height lobes — one side lower, two sagging bulges (see `rimLobe`) */
  // (the low side is the LEFT shoulder, a ≈ −1.5, and the two sags sit right of the door and at
  // the back-left: the first probe put the low side on the front-left, where B's low viewpoint
  // reads the front shoulder as the crown's height — the mound lost 18 px against a reference
  // that is already the taller)
  const crownLobe = (a: number, q: number) => (-0.22 * k * Math.pow(Math.max(0, Math.sin(a + 3.07)), 2) * smoothstep(0.1, 0.7, q) - 0.16 * k * Math.pow(Math.max(0, Math.sin(2 * a + 0.1)), 2) * smoothstep(0.3, 0.8, q)) * smoothstep(1, 0.86, q);
  const domeBaseS = (a: number, v: number, out: Vector3, rimScale: number, crownScale: number, lobes = 1) => {
    const rc = capR0(a) * rimScale - capInset + lobes * rimLobe(a);
    const wave = lobes * rimWave(a);
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
      // round 17: the rim's height wave fades in over the shoulder; the shoulder's own lobes
      out.y -= wave * smoothstep(0.2, 1, q) - lobes * crownLobe(a, q);
    } else {
      const phi = ((v - V_CAP) / (1 - V_CAP)) * Math.PI;
      r = rc + lipR * Math.sin(phi);
      y = rollBottom + lipR * (1 + Math.cos(phi));
      frame.dir(a, out).multiplyScalar(r).add(frame.C);
      out.y += y;
      out.y -= (0.1 + 0.12 * Math.sin(a + 2.2)) * k + wave;
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
  /**
   * Cap relief. Round 14: broad rounded relief at about half round 11–13's amplitude and a lower
   * frequency — the reviewer read the old mix (±0.22 m fbm lumps at 0.5/m, ±0.22 m mounds at
   * 0.8/m, two `ridged` terms at 1.2 and 2.2/m) as "coarse pale angular clumps" once the
   * front-face lift brightened their crests; the reference dome is a smooth mound with soft
   * variation. No ridged (creased) noise: every term is smooth noise. Round 15: every term is
   * the 3D field `n3` at the vertex — the 2D (x, z) terms were constant along y on the front
   * face, which drew the relief (and its shading) as vertical streaks.
   */
  const domeDisp = (p: Vector3, v: number) => {
    const onCap = smoothstep(1, 0.66, v);
    const lumps = n3.fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35, 2) * 0.12 * k * (0.35 + 0.65 * onCap);
    // mid-frequency mounds (≈ ±0.1 m, 3–5 m across) keep the crown's silhouette gently lumpy
    const mounds = n3.noise(p.x * 0.55 + 17, p.y * 0.55, p.z * 0.55 - 6) * 0.11 * k * onCap;
    const cushions = n3.noise(p.x * 0.9 + 3, p.y * 0.9 + 5, p.z * 0.9) * 0.07 * k * smoothstep(0.85, 0.2, v);
    const clumps = n3.noise(p.x * 1.5 + 8, p.y * 1.5, p.z * 1.5) * 0.035 * k * onCap;
    const fine = n3.noise(p.x * 2.4, p.y * 2.4 + 1, p.z * 2.4) * 0.02;
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
  /**
   * Surface length along the meridian from the crown to (a, v), tabulated (round 15). The cap's
   * UVs used to run `v` over `capHeight + 4·lipR` metres of texture, but the mushroom profile
   * puts most of the meridian's length on the steep shoulder — ≈ 11 m of surface per unit v on
   * the front face against 3.2 m of texture — so the moss normal map's cushions were drawn
   * ≈ 3.6× taller than wide there: fine vertical striations over the whole front. Mapping v by
   * true surface length makes the map's relief isotropic in scale — but not u by the local
   * circumference, `u = a·r(v)`: for a fixed meridian u then drifts with v in proportion to a,
   * a shear of the tiles that reaches 2.5 m sideways per metre up the meridian just left of the
   * front seam (a ≈ 5.8 rad; probe t1, a 20 cm checker drawn through the cap's map: upright
   * squares right of the porch, sub-pixel diagonal streaks left of it). So the moss map is
   * laid out as a DEVELOPED CONE instead: the cap unrolls onto a disc sector, polar radius the
   * meridian length from the apex, polar angle κ·a with κ = r/s (1.05 on the flat plateau,
   * 0.86 on the shoulder; a constant 0.85 keeps the scale error within ±11 % everywhere and
   * has no shear at all). The sector's gap — the one seam — sits at a = π, the back of the cap,
   * inside the giant's trunk. The straw patches keep a cylindrical layout (stalks along the
   * meridians).
   */
  const MER_A = 48;
  const MER_V = 64;
  /** developed-cone angle factor (polar angle per radian of `a`) and polar radius at the apex ring */
  const CAP_UV_KAPPA = 0.85;
  const CAP_UV_S0 = (0.19 * R) / CAP_UV_KAPPA;
  const merTable = new Float32Array((MER_A + 1) * (MER_V + 1));
  {
    const p0 = new Vector3();
    const p1 = new Vector3();
    for (let i = 0; i <= MER_A; i++) {
      const a = (i / MER_A) * TAU;
      let s = 0;
      domeBase(a, 0, p0);
      for (let j = 1; j <= MER_V; j++) {
        domeBase(a, j / MER_V, p1);
        s += p1.distanceTo(p0);
        p0.copy(p1);
        merTable[i * (MER_V + 1) + j] = s;
      }
    }
  }
  const meridian = (a: number, v: number) => {
    const fa = ((((a / TAU) % 1) + 1) % 1) * MER_A;
    const ia = Math.floor(fa);
    const ta = fa - ia;
    const fv = clamp(v, 0, 1) * MER_V;
    const iv = Math.min(MER_V - 1, Math.floor(fv));
    const tv = fv - iv;
    const at = (i: number, j: number) => merTable[(i % (MER_A + 1)) * (MER_V + 1) + j];
    return lerp(lerp(at(ia, iv), at(ia, iv + 1), tv), lerp(at(ia + 1, iv), at(ia + 1, iv + 1), tv), ta);
  };
  const domeVertex = (a: number, v: number, out: SurfaceSample, straw: boolean) => {
    domeBase(a, v, out.position);
    domeNormal(a, v, _n);
    const disp = domeDisp(out.position, v);
    out.position.addScaledVector(_n, disp);
    // uneven droop of the rim
    const lip = smoothstep(V_CAP, 1, v);
    out.position.y -= lip * (0.06 + 0.1 * noise.noise(a * R * 1.1, 3.3) + 0.05 * noise.noise(a * R * 4, 7)) * k;
    // 1.6 m texture tiles that are 1.6 m on the surface both ways: the moss as a developed cone
    // (see `meridian`), the straw cylindrical with its stalks down the meridians
    const s = meridian(a, v);
    if (straw) {
      out.uv = [(a * capR(a)) / 1.6, s / 1.6];
    } else {
      // the crown's flat top is a 0.19 R (0.57 m) disc at v = 0 (audit shell): the polar radius
      // starts there so the tiles keep their size on the plateau; the angle wraps at the back
      const th = CAP_UV_KAPPA * (a > Math.PI ? a - TAU : a);
      const rho = (s + CAP_UV_S0) / 1.6;
      out.uv = [rho * Math.cos(th) + 8, rho * Math.sin(th) + 8];
    }
    const p = out.position;
    if (straw) {
      // thin straw showing through the moss (vertex tint × the straw map); round 12: −25 %
      // albedo; round 14: an olive straw tint (`THATCH_TINT`) so the patches sit close to the moss
      const strawTone = (0.9 + 0.2 * n3.noise(p.x * 2.5, p.y * 2.5 + 4, p.z * 2.5)) * THATCH_ALBEDO;
      out.color = [THATCH_TINT[0] * strawTone, THATCH_TINT[1] * strawTone, THATCH_TINT[2] * strawTone];
      return;
    }
    // Round 15: every field below is the 3D `n3` at the vertex position. The round-14 terms
    // were 2D in (x, z) with y at a third of the weight or absent (mottle, `bright`, `patches`,
    // mounds): on the near-vertical front face they were constant or 3× stretched along y, and
    // B read the cap as "broad vertical streaks" (detrended column/row profile sd ratio 2.8;
    // reference 0.96).
    const patches = n3.fbm(p.x * 0.8 + 11, p.y * 0.8, p.z * 0.8, 2);
    const upness = smoothstep(0.05, 0.9, _n.y);
    // lit tops vs shaded hollows and flanks. Round 14: a soft curve — the relief's crests get a
    // quarter of the lift they had (0.6 × disp / 0.25 m read as pale angular clumps on the
    // front face), the modulation is broad (0.7/m, was 1.3/m) and narrower (±0.25, was ±0.33)
    const bright = clamp(Math.pow(upness, 1.2) * (0.6 + 0.4 * (0.5 + 0.5 * n3.noise(p.x * 0.7, p.y * 0.7 + 9, p.z * 0.7))) + 0.25 * (disp / (0.2 * k)), 0, 1);
    // Round 12: the cap is built in the plain moss material, so the vertex colour IS the albedo
    // (no straw map with its stalks under it — that map is what made round 11's moss read as
    // thatch). The reference moss is a fine grainy mass: a per-vertex grain of lit specks and
    // dark pits at the vertex pitch (≈ 0.12 m) carries that at B's distance.
    const speck = smoothstep(0.45, 0.9, n3.noise(p.x * 3.2 + 31, p.y * 3.2, p.z * 3.2));
    // pits at the vertex pitch: near-uncorrelated between neighbours, so they read as dark dots
    const pit = smoothstep(0.3, 0.8, n3.noise(p.x * 13 + 41, p.y * 13, p.z * 13));
    const fleck = smoothstep(0.55, 0.9, n3.noise(p.x * 11 + 7, p.y * 11, p.z * 11));
    // (round 15: the grain's swing is up a fifth — the reference's lit mound has 8×8 tile
    // contrast 0.045 that round 14's leaf blobs, now gone, had been supplying)
    const grain = (0.74 + 0.52 * (0.5 + 0.5 * n3.noise(p.x * 9.1, p.y * 9.1, p.z * 9.1))) * (1 - 0.65 * pit) * (1 + 0.4 * fleck);
    // (round 14: the broad mottle is halved — ±0.4 at 0.38/m was the largest coarse term left
    // once the relief's crests stopped carrying the light: moss-face 32 px blotchiness 0.064
    // against the reference's 0.038)
    // (round 15: the broad term is back up to ±0.32 at 0.45/m — the reference mound's
    // luminance tertiles run 0.37 / 0.49 / 0.62, a wide soft shading that the first round-15
    // probe, at ±0.2, rendered as a flat 0.55–0.68 field)
    const mottle = (0.7 + 0.32 * n3.fbm(p.x * 0.45 + 5, p.y * 0.45, p.z * 0.45 - 2, 2) + 0.1 * n3.noise(p.x * 3.1, p.y * 3.1, p.z * 3.1 + 1)) * (1 - 0.3 * speck) * grain;
    // Albedos (linear), lit tufts vs hollows. Round 15 retargets them to the reference's lit
    // mound measured by luminance tertile (B, 0.66–0.86 × 0.12–0.25): light rgb(168,162,101) —
    // hue 55°, sat 0.40 —, mid (134,128,77), dark (102,95,58), a warm olive; take-0065 rendered
    // (158,148,85) / (120,115,74) / (94,92,66): a redder, more saturated yellow with grey-green
    // shadows. So the lit tone is greener (G/R 0.94, was 0.83) and carries three times the blue,
    // the hollows are warm (R > G). The lift the front face and the shoulder ramp used to apply
    // (×2 over the porch) is folded into the tones themselves — see `slope` below.
    // (probe 1 at [1.45, 1.36, 0.24] rendered the mound's light tertile on target, (175,166,99),
    // but the mid at (159,152,91) against (134,128,77); probe 2 at [1.22, 1.14, 0.2] still
    // (152,145,87) — the display gamma shows a 16 % albedo cut as 4–5 %. The vertex tones are
    // now the LIT moss (the albedo map in materials.ts, mean ≈ 0.86 with dark specks, takes the
    // surface below them), and the lit tone is greener and bluer again: the reference's light
    // tertile is G/R 0.92, B/R 0.33 in linear light against probe 2's 0.875 / 0.28.)
    // (probes 3–4 at [0.98, 0.97, 0.21] under the clipped map: mid tertile 0.48 on the
    // reference's 0.49, box mean 0.400 on 0.371 + 0.03; with the crests unclipped the tones
    // come down 6 % so the box mean holds)
    // (probe 6, crests unclipped at [0.92, 0.91, 0.2]: tertiles 0.40 / 0.52 / 0.59 on the
    // reference's 0.38 / 0.49 / 0.61, box mean 0.413 — the mid a step down again; probe 7 at
    // [0.84, 0.83, 0.18] with `canopy`: 0.39 / 0.48 / 0.53, box 0.402 — mid and dark on target,
    // the crests dim, so the map's crest gain goes up and the tones come down another 5 %)
    const deep: [number, number, number] = [0.266, 0.238, 0.052];
    const sun: [number, number, number] = [0.8, 0.79, 0.17];
    // Round 15: no angular gradient. Round 14's shoulder ramp (0.5 → 1.3 with v) times a
    // front-face lift (+75 % over the porch) put a smooth luminance ramp across the cap that
    // the vertex grain then modulated — B read it as a flat field with bands. What remains is a
    // crown→shoulder slope (the crown sits under the canopy: reference box p10 0.21) and the
    // flank fall-off by surface normal, which the light itself would give. The slope follows
    // the reference mound's row profile in B (six bands, top → bottom: 0.41 0.45 0.51 0.56
    // 0.54 0.50 — darkest at the crown, brightest two-thirds of the way down the shoulder,
    // dimmer again toward the rim); probe 2's ran 0.45 → 0.58 monotonically, brightest at the
    // rim, which is the flat-field read; probe 3's 0.43 0.44 0.44 0.46 0.50 0.50 lacked the
    // bulge.
    const slope = lerp(0.45, 1.2, smoothstep(0.15, 0.48, v)) * lerp(1, 0.88, smoothstep(0.58, V_CAP, v));
    const flank = lerp(0.4, 1, smoothstep(-0.2, 0.8, _n.y)) * slope;
    // the rim curl darkens toward its underside (the moss edge over a dark shadow band)
    const under = smoothstep(0.8, 0.97, v);
    const rimShade = lerp(1, 0.35, under) * (1 - 0.3 * smoothstep(0.4, 0.7, patches) * smoothstep(0.55, V_CAP, v));
    // × the albedo map's peak: the map (materials.ts `mossTextures`) is stored over it, so the
    // tones above render as the mid tone under the map's mid, and the crests go to ×2
    // the canopy's shade on the crown, baked: the reference cap's moss outside the lit front
    // mound — crown and shoulders under the giant's canopy — reads at 0.22–0.39 (box moss-mask
    // p10 / p50) where probe 6's sunlit top read 0.33 / 0.46; the flatter the moss faces up
    // into the canopy, the less light it gets
    const canopy = lerp(1, 0.65, smoothstep(0.35, 0.95, _n.y));
    const m = Math.min(2, flank * rimShade * mottle * canopy) * MOSS_ALBEDO_PEAK;
    out.color = [lerp(deep[0], sun[0], bright) * m, lerp(deep[1], sun[1], bright) * m, lerp(deep[2], sun[2], bright) * m];
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
    const sample = (rimScale: number, crownScale: number, lobes = 1) => {
      const p = new Vector3();
      const n = new Vector3();
      const at = (a: number, v: number): P3 => {
        domeBaseS(a, v, p, rimScale, crownScale, lobes);
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
    const rimStats = (rim: P3[]) => {
      const rr = rim.map((p) => Math.hypot(p[0] - frame.C.x, p[2] - frame.C.z));
      const mean = rr.reduce((s, r) => s + r, 0) / rr.length;
      const std = Math.sqrt(rr.reduce((s, r) => s + (r - mean) ** 2, 0) / rr.length);
      const r3 = (x: number) => Math.round(x * 1000) / 1000;
      return { mean: r3(mean), std: r3(std), cv: r3(std / mean), min: r3(Math.min(...rr)), max: r3(Math.max(...rr)) };
    };
    const wall = (a: number) => rSmooth(a, eaveY) + pillarBulge(wOf(a, rSmooth(a, eaveY)), eaveY) * Math.max(0, Math.cos(a));
    const over = (a: number) => capR(a) - capInset + lipR - wall(a);
    return {
      rimScale: CAP_RIM_SCALE,
      crownScale: CROWN_SCALE,
      ...now,
      overhang: { front: over(0), side: (over(Math.PI / 2) + over(-Math.PI / 2)) / 2, back: over(Math.PI) },
      thatchFraction,
      thatchFraction11,
      round11: sample(1, 1, 0),
      /** round 17: the rim ring's reach (48 points from the cap's axis) and the lobes' amplitude */
      rimRadius: rimStats(now.rim),
      rimLobeAmplitude: RIM_LOBE,
      rimWaveAmplitude: RIM_WAVE,
    };
  })();
  // soffit: the dark underside from the rim curl's inner bottom edge back to the trunk wall (it
  // meets the wall just under `wallTop`, so the wall band above the porch is in its shadow)
  const soffitY = (a: number, r: number) => {
    const rc = capR(a) - capInset;
    const rw = rSmooth(a, eaveY) - 0.1;
    return rollBottom + (wallTop - 0.02 * k - rollBottom) * clamp((rc - r) / Math.max(0.1, rc - rw), 0, 1) - (0.1 + 0.12 * Math.sin(a + 2.2)) * k - rimWave(a);
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
  // round 13: the cap's own moss material — procedural clump-and-grain normals, no straw stalks
  // (the shared `moss` binds the thatch normal map; the roots, limbs and threshold keep it)
  const roofMesh = new Mesh(domeMoss, mats.capMoss);
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
  // Plant albedos on the cap are set against the moss they grow in (round 15). The leaf map's
  // body is sRGB 0x86bb4a (linear 0.24, 0.50, 0.07) and the grass atlas ≈ (0.14, 0.28, 0.05):
  // at tint 1 both are a third of the lit moss (`sun` in domeVertex ≈ 0.92, 0.91, 0.2) in red
  // and darker still in blue, so however the tint was nudged (probes 1–2: ×0.55–2.0) they
  // stayed dark green shapes. These tints take each map to about the moss's own linear
  // albedo, a little greener: ≈ (0.85, 1.0, 0.18) for the leaves, so a plant on the cap is a
  // lighter yellow-green in the same light.
  const MOSS_LIT_LEAF: [number, number, number] = [3.6, 2.0, 2.6];
  const MOSS_LIT_GRASS: [number, number, number] = [5.2, 3.1, 3.9];
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
      // round 15: the tip clusters lie on the moss, so they take the moss-lit leaf tint (at
      // `leafTint` they were 0.55 m dark green blobs on the crown — the largest of the "dark
      // disconnected leaf blobs"), and are smaller; vines trail from a tip only at the rim
      const tipV = b.path[b.path.length - 1][1];
      foliage.addLeafCluster(p, 0.4 * k, 28, { size: 0.12, amount: 0.06, droop: 0.45, tint: MOSS_LIT_LEAF, tintSpread: 0.28, flatten: 0.45 });
      if (tipV >= 0.6) {
        for (let s = 0; s < 2; s++) {
          const hook = p.clone().add(new Vector3((branchRng() - 0.5) * 0.4, -0.1, (branchRng() - 0.5) * 0.4));
          foliage.addHangingVine(hook, 0.45 + branchRng() * 0.55, { amount: 0.1 });
        }
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
  /** foliage added after everything else (round 14's sub-limb clusters), so the earlier
   *  clusters, tufts and vines keep their exact draws from the foliage stream */
  const lateFoliage: (() => void)[] = [];
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
  const jit = (s: number) => new Vector3((branchRng() - 0.5) * s, (branchRng() - 0.5) * s * 0.5, (branchRng() - 0.5) * s);
  /**
   * Where the bough passes the eave on the left, just outside the rim (its burl sits here).
   * Round 17: on the left-BACK flank, a = −1.7 — 0.62 rad behind the round window (`winA`
   * −1.08). Round 15 rooted the limb at a = −1.08 … −1.2, 2.0–2.9 m up: the 0.5 m tube grew
   * out of the wall through the window's own collar and hid it from B (28 rays from B to the
   * window's back: 16 first hit the bough, 1 the window). From B the new root is behind the
   * trunk's left silhouette (tangent at a ≈ −1.39); the limb emerges past that edge just under
   * the lip, 0.45 m further left than before (< 2 % of the frame), and the upper silhouette —
   * `arcPts[3]` on — is unchanged (as built: 16 / 28 rays reach the window or its frame, 0 hit
   * the bough; the B centre line still rises off the top of the frame with no descent).
   */
  const arcEavePoint = frame.at(-1.7, capR(-1.7) + 0.3 * k, eaveY - 0.1 * k);
  /** the bough's centre line and radii sampled for the audit (`houseBough`) */
  let boughSamples: { pts: P3[]; radii: number[] } = { pts: [], radii: [] };
  {
    // Round 15: a BRANCH, not a hoop. Rounds 8–14 ran this limb from a foot on the ground up
    // the left flank, over the front of the cap and back down the right flank (a prop root at
    // its far end) — in B a closed arc sitting over the roof (start (0.60, 0.57) → apex (0.82,
    // 0.09) → end (0.96, 0.20), heading change 148°). Now it grows out of the trunk's flank
    // under the left eave, breaks out past the rim (the burl), climbs the left-back shoulder
    // and passes BEHIND the crown — the cap hides it from B between the left shoulder (0.69,
    // 0.23) and the crown's right (0.83, 0.14) — then rises past the right shoulder, clear of
    // the HUD box, and leaves the top of the frame at x ≈ 0.90 to a leafy tip 9.6 m up beyond
    // the right rim (visible from A / F). Like the reference, where the limb over the roof
    // comes out from behind the mound on the right and climbs away. No ground contact.
    const aE = -1.7;
    const arcPts = [
      // rooted in the trunk wall under the eave (the first segment is inside the bark), leaning
      // a little forward as it climbs to the burl (round 17: a = −1.85 → −1.77 → −1.7, all
      // ≥ 0.6 rad behind the window)
      frame.at(aE - 0.15, rSmooth(aE - 0.15, eaveY - 1.0 * k) - 0.45 * k, eaveY - 1.0 * k),
      frame.at(aE - 0.07, rSmooth(aE - 0.07, eaveY - 0.6 * k) + 0.05 * k, eaveY - 0.6 * k),
      arcEavePoint.clone(),
      frame.at(-1.6, capR(-1.6) + 0.1 * k, lipTop + 1.0 * k).add(jit(0.1)),
      frame.at(-2.2, 0.85 * capR(-2.2), crownY - 0.7 * k).add(jit(0.1)),
      frame.at(-2.9, 0.62 * capR(-2.9), crownY - 0.1 * k).add(jit(0.1)),
      frame.at(2.6, 0.62 * capR(2.6), crownY + 0.45 * k).add(jit(0.08)),
      frame.at(2.1, 0.88 * capR(2.1), crownY + 1.4 * k).add(jit(0.08)),
      frame.at(1.75, capR(1.75) + 0.3 * k, crownY + 2.4 * k),
      frame.at(1.55, capR(1.55) + 1.0 * k, crownY + 3.1 * k),
      frame.at(1.45, capR(1.45) + 1.8 * k, crownY + 3.6 * k),
    ];
    const arcCurve = new CatmullRomCurve3(arcPts, false, 'catmullrom', 0.5);
    /** the curve parameter where the bough passes the eave (leaves the trunk's flank) */
    const tEave = (() => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= 200; i++) {
        const d = arcCurve.getPointAt(i / 200).distanceTo(arcEavePoint);
        if (d < bestD) {
          bestD = d;
          best = i / 200;
        }
      }
      return best;
    })();
    // a heavy limb at the trunk (0.5 m radius, a burl where it breaks out past the rim) that
    // tapers along its length to 0.2 m at the leafy tip, knuckled; it clears the moss by about
    // its own diameter over the crown, the sub-limbs below drop from it into the cap
    const arcR = (t: number) => (0.5 - 0.3 * t) * k * (1 + 0.1 * Math.sin(t * 17 + 1) + 0.06 * Math.sin(t * 41)) + 0.14 * k * Math.exp(-(((t - tEave) / 0.06) ** 2));
    // in the eave's shadow at the trunk, then in the canopy's shade over the cap
    const arcShade = (t: number) => 0.8 * smoothstep(0.05, 0.2, t);
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
    // the leafy tip beyond the rim, in the canopy above frame B
    {
      const tip = arcCurve.getPointAt(1);
      const near = arcCurve.getPointAt(0.93);
      lateFoliage.push(() => {
        foliage.addLeafCluster(tip, 0.75 * k, 56, { size: 0.14, amount: 0.06, droop: 0.5, tint: leafTint, tintSpread: 0.28 });
        foliage.addLeafCluster(near, 0.45 * k, 24, { size: 0.13, amount: 0.06, droop: 0.5, tint: leafTint, tintSpread: 0.28 });
      });
    }
    boughSamples = (() => {
      const pts: P3[] = [];
      const radii: number[] = [];
      for (let i = 0; i <= 32; i++) {
        const t = i / 32;
        pts.push(arcCurve.getPointAt(t).toArray().map((x) => Math.round(x * 1000) / 1000) as P3);
        radii.push(Math.round(arcR(t) * 1000) / 1000);
      }
      return { pts, radii };
    })();

    // ---- round 14: the bough's SUB-LIMBS, so the loop over the house reads as the tree's branch
    // holding the roof (boards 03 / 04 "curved trunk forms a natural roof", "upper branches with
    // foliage") rather than a detached hoop: two limbs fork off the span and drop into the cap,
    // each with a leaf cluster where it enters the moss; one forks upward off the top of the
    // span into a leafy tip. (Round 14's prop root down the right flank is gone in round 15.)
    // All in the bough's bark, mossy on top, in the canopy's shade above the eave. Own rng
    // stream: the arc's draws are untouched.
    const subRng = rng.fork('bough-sublimbs');
    const sjit = (s: number) => new Vector3((subRng() - 0.5) * s, (subRng() - 0.5) * s * 0.5, (subRng() - 0.5) * s);
    const _rel = new Vector3();
    const _cu = new Vector3();
    /** (angle, cap v) of the dome column under a world point: v from the point's horizontal radius */
    const capUnder = (p: Vector3): [number, number] => {
      _rel.copy(p).sub(frame.C);
      const a = Math.atan2(_rel.dot(Rt), _rel.dot(F));
      const rp = Math.hypot(_rel.x, _rel.z);
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= 40; i++) {
        const v = (i / 40) * V_CAP;
        domeBase(a, v, _cu);
        const d = Math.abs(Math.hypot(_cu.x - frame.C.x, _cu.z - frame.C.z) - rp);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      return [a, best];
    };
    /** a limb off the span at t, into the moss `aOff` radians round from where it hangs */
    const capLimb = (t: number, aOff: number, r0: number) => {
      const from = arcCurve.getPointAt(t);
      const [a0, v0] = capUnder(from);
      const a1 = a0 + aOff;
      const v1 = clamp(v0 + 0.06, 0.05, V_CAP - 0.05);
      // ends a quarter metre under the moss; the leaf cluster sits on the surface above the end
      const into = surfacePoint(a1, v1, -0.25 * k);
      const onMoss = surfacePoint(a1, v1, 0.12 * k);
      const mid = from.clone().lerp(into, 0.5).add(sjit(0.25)).addScaledVector(frame.dir(a1), 0.15 * k);
      const limb = sweepTube(new CatmullRomCurve3([from, mid, into], false, 'catmullrom', 0.5), {
        radius: (s) => r0 * k * (1 - 0.45 * s) * (1 + 0.1 * Math.sin(s * 13 + t * 20)),
        tubularSegments: 16,
        radialSegments: 10,
        uvMetres: 1.4,
        displace: (s, ang, pos) => (noise.ridged(ang * 1.5 + s * 5 + t * 7, pos.y * 1.3 + 4, 2) - 0.5) * 0.05 * k,
        color: (s, ang) => shadedColor(s, ang, 0.8),
        capEnd: true,
      });
      supportParts.push(mossOnTop(limb, mossTint, 0.7, noise));
      // (the cluster sits on the moss: the moss-lit leaf tint, not the canopy's `leafTint`)
      lateFoliage.push(() => foliage.addLeafCluster(onMoss, 0.4 * k, 24, { size: 0.12, amount: 0.06, droop: 0.4, tint: MOSS_LIT_LEAF, tintSpread: 0.28, flatten: 0.4 }));
      return limb;
    };
    // (round 15: the span behind the crown runs t ≈ 0.45–0.65 of the new curve; the second
    // limb drops into the right shoulder, where B sees it)
    capLimb(0.5, -0.12, 0.2);
    capLimb(0.7, 0.1, 0.17);
    // the up-limb: off the top of the span, up and back into the canopy, leafy at the tip
    {
      const from = arcCurve.getPointAt(0.58);
      const tip = from.clone().add(new Vector3(0, 1.35 * k, 0)).addScaledVector(F, -0.7 * k).add(sjit(0.2));
      const mid = from.clone().lerp(tip, 0.5).addScaledVector(Rt, -0.25 * k).add(sjit(0.15));
      const upCurve = new CatmullRomCurve3([from, mid, tip], false, 'catmullrom', 0.5);
      const upLimb = sweepTube(upCurve, {
        radius: (s) => (0.17 - 0.1 * s) * k * (1 + 0.1 * Math.sin(s * 11 + 2)),
        tubularSegments: 14,
        radialSegments: 9,
        uvMetres: 1.4,
        displace: (s, ang, pos) => (noise.ridged(ang * 1.5 + s * 5, pos.y * 1.3 + 6, 2) - 0.5) * 0.04 * k,
        color: (s, ang) => shadedColor(s, ang, 0.8),
        capEnd: true,
      });
      supportParts.push(mossOnTop(upLimb, mossTint, 0.5, noise));
      lateFoliage.push(() => {
        foliage.addLeafCluster(tip, 0.55 * k, 40, { size: 0.13, amount: 0.06, droop: 0.5, tint: leafTint, tintSpread: 0.28 });
        foliage.addLeafCluster(upCurve.getPointAt(0.6), 0.35 * k, 18, { size: 0.12, amount: 0.05, droop: 0.5, tint: leafTint, tintSpread: 0.28 });
      });
    }
    // (round 15: the prop root that forked off the far end down the right flank to the ground is
    // gone — with it the bough closed into a hoop over the roof; the branch now ends in the air)
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
  // (round 15: the surface vines that used to be draped from the crown to the rim are gone —
  // the reference cap carries vines only at its rim, the hanging strands above)
  // ---- small plants over the moss (round 15). Reference B's lit mound is dense moss with a
  // few small plants in it: grass tufts and leaves lit like the moss (pixels below 0.85× the
  // mound's median luminance with a green hue: 2.2 % of the mound; take-0065's leaf clumps
  // covered 13 %, mid-dark green shapes on the yellow field — "dark disconnected blobs"). So:
  // more, smaller grass tufts in a moss-lit tint, ferns only as the three hero ferns below, and
  // the leaf clusters small and light. ----
  // (plant tints: `MOSS_LIT_LEAF` / `MOSS_LIT_GRASS`, defined with `leafTint` above)
  const tuftCount = def.id === 'saria' ? 36 : 24;
  const roofShade: [number, number, number] = MOSS_LIT_GRASS;
  for (let i = 0; i < tuftCount; i++) {
    const a = vineRng() * TAU;
    const v = 0.05 + vineRng() * 0.7;
    // the front face is thinned a little (a few plants), not cleared
    if (vineRng() < 0.3 * smoothstep(1.3, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.18, 0.32, v)) continue;
    const p = surfacePoint(a, v, -0.03);
    const n = domeNormal(a, v);
    // grass only — the cap's ferns are the two or three hero ferns below
    const low = lerp(0.6, 1, smoothstep(0.1, 0.4, v));
    foliage.addTuft(p, n, 0.22 * (0.8 + vineRng() * 0.5) * sk * low, 0, 0.05, roofShade);
  }
  // ---- leaf clusters: small plants in the moss (round 15), not a shroud. Tints (linear,
  // multiplying the leaf map) run from the moss-lit tone in the hollows to a lighter one on the
  // upper faces, so a cluster reads as a plant catching the same light as the moss around it
  // rather than a dark patch on it. Low, flat cushions (droop 0.3, flatten 0.25) so most leaf
  // faces lie along the moss and take the same light. ----
  const clumpRng = rng.fork('clumps');
  // (probe 3, at 30 k² clusters of 10 leaves plus 44 tufts and 10 rosettes, still put green
  // shapes below 0.85× the mound's median on 10 % of it — the same colour as the reference's
  // plants, rgb(89,94,65) against (95,98,60), but five times their area — so fewer and lighter)
  const clumpCount = Math.round(18 * k * k);
  const tints: [number, number, number][] = [
    MOSS_LIT_LEAF.map((c) => c * 0.95) as [number, number, number],
    MOSS_LIT_LEAF.map((c) => c * 1.15) as [number, number, number],
    MOSS_LIT_LEAF.map((c) => c * 1.35) as [number, number, number],
    MOSS_LIT_LEAF.map((c) => c * 1.6) as [number, number, number],
  ];
  for (let i = 0; i < clumpCount; i++) {
    const a = clumpRng() * TAU;
    const v = 0.04 + Math.pow(clumpRng(), 0.8) * 0.74;
    const frontFace = smoothstep(1.3, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.18, 0.32, v);
    if (clumpRng() < 0.4 * frontFace) continue;
    const p = surfacePoint(a, v, 0.04 * k);
    const n = domeNormal(a, v);
    // upper faces get the lit tints, flanks and the crown under the canopy the deeper ones
    const lit = clamp((n.y * 0.75 + 0.3 * clumpRng() + 0.15 * n3.noise(p.x * 1.5, p.y * 1.5, p.z * 1.5)) * lerp(0.6, 1, smoothstep(0.15, 0.5, v)), 0, 0.999);
    const tint = tints[Math.floor(lit * tints.length)];
    // small plants: 0.12–0.24 m across, 10 leaves, flatter on the crown
    const radius = (0.12 + clumpRng() * 0.12) * k * lerp(0.7, 1, smoothstep(0.1, 0.4, v));
    foliage.addLeafCluster(p, radius, 10, { size: 0.1 * sk, amount: 0.05, droop: 0.3, tint, tintSpread: 0.2, flatten: 0.25 });
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
    // the skirt hangs in the rim's shade: a third to a half of the moss-lit leaf tint
    const tint: [number, number, number] = fringeRng() < 0.5 ? [1.2, 0.75, 0.9] : [1.8, 1.1, 1.3];
    foliage.addLeafCluster(p, radius, 20, { size: 0.16 * sk, amount: 0.05, droop: 0.9, tint, tintSpread: 0.25, flatten: 0.4 });
    if (fringeRng() < 0.5) {
      const hook = p.clone().add(new Vector3((fringeRng() - 0.5) * 0.1, 0, (fringeRng() - 0.5) * 0.1));
      foliage.addHangingVine(hook, (0.3 + fringeRng() * 0.5) * k * lerp(1, 0.5, overDoor), { amount: 0.08 });
    }
  }
  // a few big ferns / grass clumps on the shoulders that break the cap silhouette (kept off
  // the crown so the top of the cap stays low)
  // (round 15: three ferns and one grass clump, in the moss-lit tints — the atlas at shade 1 was
  // a dark green on the lit cap)
  const heroTufts: { a: number; v: number; size: number; kind: 0 | 1 }[] = [
    { a: -1.45, v: 0.5, size: 0.7, kind: 1 },
    { a: -1.85, v: 0.6, size: 0.6, kind: 0 },
    { a: -0.95, v: 0.45, size: 0.6, kind: 1 },
    { a: 2.1, v: 0.5, size: 0.6, kind: 1 },
  ];
  for (const ht of heroTufts) {
    const p = surfacePoint(ht.a, ht.v, -0.05);
    const n = domeNormal(ht.a, ht.v);
    // lean the clump a little toward vertical so it stands proud of the moss
    n.y += 0.6;
    n.normalize();
    foliage.addTuft(p, n, ht.size * sk, ht.kind, 0.06, ht.kind === 0 ? MOSS_LIT_GRASS : [3.4, 2.3, 3.1]);
  }
  // ---- small plants growing in the moss (sheet 04 "moss-covered roof with plants"): little
  // rosettes of upright leaves scattered over the shoulders and crown — kept off the front lip
  // so the eave line and the doorway stay clear. Round 15: these were the "dark disconnected
  // leaf blobs" — 16 rosettes of 5–8 leaves 0.3–0.46 m across at a tint of 0.45–0.65 (a fifth
  // of the moss's albedo) standing up off the cap; now 10 rosettes of leaves 0.16–0.24 m in the
  // moss-lit tint, and no more ferns here (the hero ferns above are the cap's ferns). ----
  const plantRng = rng.fork('plants');
  const plantCount = def.id === 'saria' ? 8 : 5;
  for (let i = 0; i < plantCount; i++) {
    const a = plantRng() * TAU;
    const v = 0.08 + plantRng() * 0.62;
    if (Math.abs(angleDiff(a, 0)) < 0.5 && v > 0.45) continue;
    const p = surfacePoint(a, v, 0.02);
    const n = domeNormal(a, v);
    // rosette of 5–8 leaves fanning out, lying low (0.4 up the normal, was 0.9)
    const leaves = 5 + Math.floor(plantRng() * 4);
    const size = (0.16 + plantRng() * 0.08) * sk;
    const yaw0 = plantRng() * TAU;
    const tintK = 0.9 + plantRng() * 0.4;
    const tint: [number, number, number] = [MOSS_LIT_LEAF[0] * tintK, MOSS_LIT_LEAF[1] * tintK * 1.05, MOSS_LIT_LEAF[2] * tintK];
    for (let j = 0; j < leaves; j++) {
      const yaw = yaw0 + (j / leaves) * TAU + (plantRng() - 0.5) * 0.5;
      const dir = new Vector3(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(0.8).addScaledVector(n, 0.4).normalize();
      foliage.addLeaf(p.clone().addScaledVector(n, 0.02), dir, size * (0.85 + plantRng() * 0.3), plantRng() * Math.PI * 2, 0.06, tint);
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
      // height it hung from, and the cord takes up whatever the hook sits above that.
      // Round 19: the entrance arch's body now spans this line (its underside ≈ 3.0 m, the
      // soffit at 3.1 behind it), so the cord is tied to the arch's underside instead.
      const line = boughAt11(spec.a);
      line.y -= boughR11(spec.a) * 0.9;
      line.addScaledVector(frame.dir(spec.a), -0.04 * k);
      const knotY11 = boughHookYRound10(spec.a);
      const r = Math.hypot(line.x - frame.C.x, line.z - frame.C.z);
      hook = line.clone();
      hook.y = Math.max(line.y, Math.min(yFloor + soffitY(spec.a, r), archUnderY(lateralOf(line))) - 0.03);
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

  // ---- round 13: plants on the cap (board 03 "moss-covered roof with plants"): grass tufts
  // along the front rim, ferns on the shoulders where B sees them, loose clusters of small white
  // flowers over the moss, trailing vines over the rim on the flanks; moss and vines round the
  // window and off the pillar tops. Drawn from their own stream, after the pods' vines, so every
  // round-12 plant, clump, vine and pod keeps its place. ----
  const capRng = rng.fork('cap-plants');
  let flowerCount = 0;
  {
    // grass tufts standing on the rim's shoulder across the front
    const rimTufts = def.id === 'saria' ? 14 : 8;
    for (let i = 0; i < rimTufts; i++) {
      const a = -1.9 + (i / (rimTufts - 1)) * 3.8 + (capRng() - 0.5) * 0.2;
      const v = 0.6 + capRng() * 0.1;
      const p = surfacePoint(a, v, -0.02);
      const n = domeNormal(a, v);
      n.y += 0.8;
      n.normalize();
      foliage.addTuft(p, n, (0.3 + capRng() * 0.14) * sk, 0, 0.07, [0.78, 0.74, 0.42]);
    }
    // ferns on the front shoulders, the faces B looks at
    const capFerns: [number, number][] = def.id === 'saria' ? [[-0.55, 0.5], [-1.1, 0.56], [0.35, 0.47], [0.95, 0.55], [-0.15, 0.61]] : [[-0.6, 0.5], [0.6, 0.5], [0.1, 0.6]];
    for (const [a0, v0] of capFerns) {
      const a = a0 + (capRng() - 0.5) * 0.1;
      const v = v0 + (capRng() - 0.5) * 0.04;
      const p = surfacePoint(a, v, -0.04);
      const n = domeNormal(a, v);
      n.y += 0.7;
      n.normalize();
      foliage.addTuft(p, n, (0.62 + capRng() * 0.18) * sk, 1, 0.06, [0.7, 0.84, 0.5]);
    }
    // white flowers in loose clusters over the shoulders and crown (heads 8–11 cm: pale specks
    // at B's distance, as board 03 scatters them)
    const flowerClusters = def.id === 'saria' ? 18 : 7;
    for (let i = 0; i < flowerClusters; i++) {
      const a = capRng() * TAU;
      const v = 0.15 + capRng() * 0.55;
      const heads = 4 + Math.floor(capRng() * 5);
      const spread = (0.14 + capRng() * 0.14) * sk;
      for (let j = 0; j < heads; j++) {
        const aj = a + ((capRng() - 0.5) * 2 * spread) / Math.max(0.5, capR(a) * (v / V_CAP));
        const vj = clamp(v + (capRng() - 0.5) * 0.05, 0.05, 0.7);
        const p = surfacePoint(aj, vj, 0.02);
        const n = domeNormal(aj, vj);
        foliage.addFlower(p, n, (0.08 + capRng() * 0.03) * sk, (0.04 + capRng() * 0.05) * sk, 0.05, [1, 1, 0.94]);
        flowerCount++;
      }
    }
    // long vines trailing over the rim on the flanks (the strands over the door stay short)
    const trailing: number[] = def.id === 'saria' ? [-0.95, -1.45, -2.0, 0.95, 1.4, 2.05] : [-1.2, 1.2, 2.4];
    for (const a0 of trailing) {
      const a = a0 + (capRng() - 0.5) * 0.15;
      const hook = surfacePoint(a, 0.9, -0.03);
      hook.y -= 0.08 * k;
      foliage.addHangingVine(hook, (1.0 + capRng() * 0.6) * k, { amount: 0.1 });
    }
    // the window: moss on the collar's crown, vines off its upper sides (board 04 "surrounded by
    // moss and vines"), kept off the glow itself
    {
      const O = winO;
      const T = winT;
      const crown = winCentre.clone().addScaledVector(O, 0.1 * k);
      crown.y += winR + 0.12 * k;
      foliage.addLeafCluster(crown, 0.2 * k, 16, { size: 0.13 * sk, amount: 0.05, droop: 0.7, tint: [0.4, 0.5, 0.14], tintSpread: 0.25, flatten: 0.4 });
      for (const th of [-1.15, -0.75, 0.8, 1.2]) {
        const hook = winCentre.clone().addScaledVector(O, 0.1 * k).addScaledVector(T, Math.sin(th) * (winR + 0.08 * k));
        hook.y += Math.cos(th) * (winR + 0.08 * k);
        foliage.addHangingVine(hook, (0.45 + capRng() * 0.45) * k, { amount: 0.08 });
      }
    }
    // the pillar tops: a vine or two off each fork, a few leaves where it meets the rim
    for (const pt of pillarTops) {
      for (let i = 0; i < 2; i++) {
        const hook = pt.top.clone().add(new Vector3((capRng() - 0.5) * 0.2, -0.05 * k, (capRng() - 0.5) * 0.2));
        foliage.addHangingVine(hook, (0.4 + capRng() * 0.5) * k, { amount: 0.08 });
      }
    }
  }

  for (const late of lateFoliage) late();
  for (const m of foliage.build(mats, `house-${def.id}`)) group.add(m);

  // draped limbs + arc bough + broken stub + right limb + chimney
  // the pad is level (round 14) and the terrain stays under it (`floorPoke` ≤ 0), so this is the
  // kerb's clearance over the pad; the terrain term only bites if the slope ever came through
  const hearthFloor = Math.max(yFloor + roomFloorY, terrain.height(hearthPos.x, hearthPos.z) + 0.05);
  const hearthClearance = hearthPos.y - 0.14 * k - 0.05 * k - hearthFloor;
  return {
    group,
    bases,
    lanterns,
    lights,
    materials,
    roots: rootsBuilt + 2,
    branches: branchDefs.length + 4,
    leaves: foliage.leafCount,
    eave,
    door,
    cap,
    hearthClearance,
    window: { centre: winCentre.toArray() as P3, radius: winR, height: winY },
    pillars: pillarTops.map((p) => ({ foot: p.foot, top: p.top.toArray() as P3, footRadius: +p.footRadius.toFixed(3) })),
    burls: { count: burlSeam.count, seamMaxPosMm: +burlSeam.seamMaxPosMm.toFixed(4), seamMaxNormalDeg: +burlSeam.seamMaxNormalDeg.toFixed(4) },
    arch: archProfile,
    flowers: flowerCount,
    props: propCount,
    room: { floorY: roomFloorY, backD: [roomBackD(roomW0), roomBackD((roomW0 + roomW1) / 2), roomBackD(roomW1)], floorPoke, pokeAt },
    bough: boughSamples,
  };
}
