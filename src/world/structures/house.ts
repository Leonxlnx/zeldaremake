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
 * Round 21 (owner: one-to-one with the reference, much more detail; B at 2×): the trunk bark
 * gains FISSURES (sharp near-black valleys between the cord bundles) and a finer second cord
 * octave, with dark damp grime in the furrows and fissures (`furrowMoss`); the entrance arch
 * and its buttresses are more densely corded (≈ 14 bundles round the body at 32 radial
 * segments), cut by fissures and knuckled with six large knots (`knots21`); big-leaf ENTRANCE
 * VINES lie along the arch crown's top-front edge and drop strands down its face, clumps hang
 * over both shoulders and strands with clumps run down the wall sides; the eave is SHAGGY —
 * moss / grass beards every 0.3 m off the rim's outer face and the arch's top edge, leaf clumps
 * drooping off and standing on the rim (`foliage21`, its own builder after the first, so every
 * earlier plant keeps its draws). The pods' leaf husks are lantern.ts's.
 *
 * Every dimension is expressed in terms of `trunkRadius` / `roofHeight`, so the same builder
 * produces Saria's hero house and the small upper house.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineCurve3,
  type Material,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  Vector2,
  Vector3,
} from 'three';
import { HOUSE_BUTTRESS_FEET, type HouseDef } from '../layout';
import type { WorldContext } from '../system';
import { hash2, type Rng } from '../util/prng';
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
import { buildLantern, lanternHanger, type LanternKind, type LanternRig } from './lantern';
import { LIME_POD_GLOW, MOSS_ALBEDO_PEAK, Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';
import { woodFibre, woodGrain } from './woodGrain';

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
  /** materials (and round 48: the rug's canvas texture) created for this house, disposed by the system */
  materials: { dispose(): void }[];
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
  /** round 47 (structures-30): the room's furniture (bed, rug, plants, table and hearth pieces) and the door's callus roll */
  furnishing: { bed: boolean; rug: boolean; hangingPlants: number; herbBunches: number; pieces: number; triangles: number; plantLeaves: number; doorRoll: boolean };
  /**
   * The room's level floor pad (round 14): floor height above the local floor level, the back
   * wall's depth from the trunk centre at the left / middle / right of the room (door-space, +
   * toward the door), and how far the plateau slope pokes up through the pad (≤ 0 = never).
   */
  room: { floorY: number; backD: [number, number, number]; floorPoke: number; pokeAt: [number, number] };
  /** the support bough's centre line (33 world points, t = 0 at the trunk) and radii (round 15) */
  bough: { pts: P3[]; radii: number[] };
  /**
   * Round 40: the cap moss's close-scale structure — cushion tufts (count, triangles, diameter
   * range), the torn moss edge's range on the rim curl (v; the curl's top is `rimTop`), the
   * share of the rim where the moss has retreated and bark shows on the crest, the sheet's
   * thickness over the bark, and the small plants (sorrel, ferns, grass) growing out of it.
   */
  mossDetail: {
    tufts: number;
    tuftTriangles: number;
    tuftDiameterM: { min: number; max: number; mean: number } | null;
    edgeV: { min: number; max: number; rimTop: number };
    barkOnCrestShare: number;
    mossThicknessM: number;
    plants: { sorrel: number; ferns: number; grass: number };
  };
  /**
   * Round 41 (structures-26): the trunk's player-height detail — furrow moss tufts on the shell,
   * moss caps on the root flares and the doorway arch, lichen plates, trefoils at the root feet.
   */
  trunkDetail: { trunkTufts: number; rootTufts: number; archTufts: number; boughTufts: number; lichen: number; trefoils: number; doormatTufts: number };
}

/**
 * Materials that every house can share (identical parameters, no per-house uniforms), so their
 * parts fold into one draw call across houses. The first house creates them and owns disposal.
 */
export interface HouseSharedMaterials {
  stone?: MeshStandardMaterial;
}

/** Per-house placement constraints beyond the layout's houses. */
export interface HouseSiteOptions {
  /** ground circles the buttress roots keep off (paving, a deck's posts, neighbouring trunks), at any height */
  rootKeepOut?: { x: number; z: number; r: number }[];
  /**
   * the entrance arch's right root-buttress foot (door space, × k — layout `HOUSE_BUTTRESS_FEET`),
   * landing steeply like the left one instead of round 20's long leg down Saria's ledge
   */
  rightFoot?: readonly [number, number];
  /**
   * also build the cap's and the trunk's moss tufts a second time from the same specs with
   * FAR_TUFTS' coarser lumps — `roof-tufts-far` / `trunk-moss-tufts-far` beside the fine meshes, for
   * a caller that draws one or the other by distance (east.ts). No rng is drawn for them.
   */
  farTufts?: boolean;
}

/**
 * The far tufts' lumps (HouseSiteOptions.farTufts): five / four segments round one ring — 15 / 12
 * triangles against the cap's 40 / 30 and the trunk's 63 / 30. The outline noise, the lit crown and
 * the dark rim are the fine lump's; 4–12 cm across, a lump spans 7 px or less from 10 m.
 */
export const FAR_TUFTS = { segments: [5, 4] as [number, number], rings: [1, 1] as [number, number] };

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
  /** pod scale (default 1; round 47's cluster pods are a little smaller) */
  scale?: number;
  /**
   * Round 48: metres the pod hangs BEHIND the bough line, back along the door axis (−F) into the
   * porch recess under the soffit — camera B is face-on to the door, so a pod set straight back
   * behind a front-rank pod sits on B's ray through it and is covered by it, while the walk poses
   * that come at the door from the west (w29–w31, 15–19° off B's bearing) see it beside it.
   */
  back?: number;
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
    // Round 47 (structures-30, owner review 2026-09-19 ref-01): the reference bough carries its
    // pods as a tight CLUSTER over and left of the door — close together at staggered heights,
    // warm — where ours were three in a row. Two more hang in a second, lower rank inside the
    // three's span (one orange, one lime, so the shared glow keeps its half-lime mix), a little
    // smaller than the hero three: five in the cluster, nine on the house. Appended, so the
    // first six pods' draws and B positions are unchanged. (A first cut hung four — seven in a
    // row — and cost B 0.0031 SSIM against frame 14 s, which shows three; two cost half that.)
    { a: -0.11, cord: 0.3, hook: 'bough', tint: 'orange', scale: 0.88 },
    { a: 0.02, cord: 0.34, hook: 'bough', tint: 'lime', scale: 0.86 },
    // Round 48 (structures-31, fable-5 #7: the demo's house bough carries 7–8 pods clustered):
    // a sixth and seventh, hung 0.5 m BEHIND the front rank's orange and left lime pods (`back`)
    // on B's rays through them — B looks up 4.5° at the cluster, so a pod half a metre further
    // along the ray sits ≈ 4 cm higher (cords 0.10 / 0.0 against the front's 0.14 / 0.03) and is
    // covered by the pod in front; from the west-side walk poses the second rank shows beside
    // the first. Smaller (0.84) so the front pods cover them; one orange, one lime. Appended.
    { a: -0.04, cord: 0.1, hook: 'bough', tint: 'orange', scale: 0.84, back: 0.5 },
    { a: -0.18, cord: 0.0, hook: 'bough', tint: 'lime', scale: 0.84, back: 0.5 },
  ],
  // the upper house's pods hang on its plateau-side flanks: with Saria's cap lowered its front
  // shows above her roof in B, where the reference has only dark canopy (no lit pods there)
  upper: [
    { a: -1.9, cord: 0.3, hook: 'eave' },
    { a: 2.0, cord: 0.4, hook: 'eave' },
  ],
  // the east lane (layout `EXPANSION_EAST`, structures/east.ts): a pod either side of each door;
  // the shop's third hangs past its counter window (right flank), the tall house's over its deck
  'east-shop': [
    { a: -0.5, cord: 0.28, hook: 'eave', tint: 'orange' },
    { a: 0.42, cord: 0.36, hook: 'eave', tint: 'lime' },
    { a: 1.62, cord: 0.46, hook: 'eave', tint: 'orange', scale: 0.9 },
  ],
  'east-tall': [
    { a: -0.45, cord: 0.32, hook: 'eave', tint: 'lime' },
    { a: 0.38, cord: 0.26, hook: 'eave', tint: 'orange' },
    { a: 1.3, cord: 0.62, hook: 'eave', tint: 'orange', scale: 0.92 },
  ],
  'east-small': [
    { a: 0.5, cord: 0.22, hook: 'eave', tint: 'orange', scale: 0.9 },
    { a: -0.55, cord: 0.3, hook: 'eave', tint: 'lime', scale: 0.86 },
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

/**
 * Round 34 (structures-23): the trunk shell's LIT bark albedo as a share of the round-11 tint
 * (≈ 0.96 × the orange bark map). Camera D sees Saria's north-west flank sunlit at 9–17 m and the
 * material-masked bark there rendered p50 0.326 (640×360) against frame 56 s' dark mossy bank
 * (0.239); frame B's lit lip bark is dark brown, rgb(109,94,74). The roots, burls and support
 * boughs take the same share through their own tints.
 *
 * Albedo probe (the control build, `bark`'s base colour scaled live, D's bank bark by material
 * mask, 640×360): ×1 p50 0.326 / p10 0.283, ×0.6 0.312 / 0.273, ×0.05 0.292 / 0.256 (hue 51°,
 * sat 0.18 — the veil's own colour), ×1.6 0.344 / 0.297. The veil floors the bank's bark at
 * 0.29 whatever its albedo, and the box is 58 % terrain and vegetation at 0.33 (the frame's
 * 0.24 is not reachable from the bark), so the share is set where the bark still reads as bark
 * over the veil (0.45 → ≈ 0.305) and the rest of the frame's bank is carried by hue: the moss
 * sheets (below) turn the veiled bark from the map's 36° toward the frame's 63°.
 */
const TRUNK_LIT_ALBEDO = 0.45;
/**
 * the furrow grime (round 21): a damp green-brown in the cords' furrows and fissures on the lit
 * trunk. Round 34: greener — under the material's orange (0xdcb086, g/r 0.6 linear) and the bark
 * map a tint needs g/r ≥ 3 before the pixel's hue passes the veil's 51°.
 */
const FURROW_MOSS_TINT: [number, number, number] = [0.15, 0.38, 0.11];
/** the round-22 moss skin on the shaded faces (the right wall beside the porch): deep green */
const SKIN_MOSS_TINT: [number, number, number] = [0.1, 0.27, 0.075];
/**
 * Round 34: the eave band under the cap's overhang and the wall over the door are NOT moss in
 * frame B — the over-door box (0.70–0.80 × 0.33–0.40) reads hue 35.5°, sat 0.34, green share 3 %
 * (ours 52° / 50 % under the round-22 skin), the right shoulder (0.86–0.94 × 0.28–0.34) hue 29°,
 * green 0 % — so the band's skin is a damp dark BROWN grime, and only the wall right of the porch
 * (behind the ferns) keeps the green skin.
 */
const BAND_GRIME_TINT: [number, number, number] = [0.22, 0.16, 0.08];
/** round 34: the moss sheets on the lit trunk, roots and boughs — the frames' bank moss (D 0.8–1.0 ×
 *  0.3–0.55: hue 63°, sat 0.25, green share 0.75) under the orange bark map (g/r 4 in the tint) */
const SHEET_MOSS_TINT: [number, number, number] = [0.1, 0.4, 0.09];
/** round 34: pale grey-green lichen on the cord crests (frame B's trunk shows grey patches between the furrows) */
const LICHEN_TINT: [number, number, number] = [0.5, 0.54, 0.5];
/** round 34: the roots' and burls' moss (was [0.5, 0.64, 0.3], a lit olive): the sheets' green, a shade lighter on the crowns */
const ROOT_MOSS_TINT: [number, number, number] = [0.14, 0.42, 0.1];

/**
 * Blend a moss tint into a swept branch's vertex colours on its upward-facing side. `spread`
 * (round 34) lets the moss creep down the flanks: the up-facing gate `smoothstep(0.25, 0.85, up)`
 * is shifted down by it, so at 0.45 the sheets reach faces at up ≥ −0.2 (the root shoulders'
 * moss sheets of frame B, not only their crowns).
 */
function mossOnTop(geo: BufferGeometry, tint: [number, number, number], amount: number, noise: Noise2D, spread = 0): BufferGeometry {
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
    const w = clamp(smoothstep(0.25 - spread, 0.85 - spread, up) * patch * amount, 0, 1);
    col.setXYZ(i, lerp(col.getX(i), tint[0], w), lerp(col.getY(i), tint[1], w), lerp(col.getZ(i), tint[2], w));
  }
  return geo;
}

/**
 * Round 36 (structures-24): the D-SIDE MOSS. Camera D looks at Saria's trunk from 11° left of
 * the door's axis and 8 m nearer than B, so its right bank (0.80–1.0 × 0.30–0.55) is the trunk's
 * north-west flank (house angles a ≈ −0.8 … −2.3, i.e. azimuth 180–265°), the roots seated
 * there, the arc bough's lower run and the burls — 32 % of the box by part mask (roots 21.8 %,
 * trunk 6.3 %, boughs 3.3 %) rendering p50 0.29 / hue 36° / green share 1–2 % where frame 56 s
 * has a dark mossy mass (0.239 / 63° / 75 %). B sees the same faces only past its left
 * silhouette (a < −1.2 is edge-on or hidden from B; the window at −1.08 and its boss stay out).
 * The live material-colour probe on take-0102 (D, part masks) fixes what a vertex tint can do
 * there: the veil floors the bank's bark at 0.26–0.28 (bark ×0.01 → roots 0.279 / trunk 0.261,
 * hue 41.5°), a saturated moss green as the whole material (0.15, 0.45, 0.12) reads 0.289 /
 * 48.5° (green 22 %) on the roots and 0.276 / 54.5° (54 %) on the trunk, a darker green
 * (0.06, 0.3, 0.06) 0.285 / 47.5° and 0.270 / 52°, and a still darker one loses the green to
 * the veil (0.02, 0.12, 0.02 → 44°, 3 %). So the cover is a full sheet (no up-facing gate, the
 * patch noise only thinning it) in a dark saturated green whose blue is a good half of its green
 * (a yellow-green sheet mixes with the 40° veil to less hue than a blue-green does).
 * Iteration 1 — (0.06, 0.36, 0.17) at 92 % × patch, the window's 1.5 m clear — moved D's roots
 * 36.4° → 44.0° (green share 0.010 → 0.094) and the trunk 38.4° → 44.6° (0.022 → 0.097) at
 * p50 −0.003; B's house box, left pillar, door and cap boxes ±0.000. Iteration 2 — (0.05, 0.36,
 * 0.20), full cover, the hole alone spared — roots 48.5° (0.339), trunk 50.3° (0.367), boughs
 * 49.0° (0.275); the box 41.1° → 45.8°, green 0.102 → 0.212, p50 0.301 → 0.299.
 */
const D_MOSS_TINT: [number, number, number] = [0.03, 0.36, 0.24];
/**
 * Blend a moss tint over a geometry by the house angle of each vertex (the frame's `a`,
 * 0 = the door, + = viewer's right) through `weight(a, y)`, all faces alike; `cover` × a patch
 * noise leaves the cord crests poking through here and there.
 */
function mossBySide(geo: BufferGeometry, frame: Frame, tint: [number, number, number], noise: Noise2D, weight: (a: number, y: number) => number, cover = 1): BufferGeometry {
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  if (!col) return geo;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rx = x - frame.C.x;
    const rz = z - frame.C.z;
    const a = Math.atan2(rx * frame.Rt.x + rz * frame.Rt.z, rx * frame.F.x + rz * frame.F.z);
    const wa = weight(a, y - frame.C.y);
    if (wa <= 0) continue;
    const patch = smoothstep(-0.75, -0.25, noise.fbm(x * 0.9 + 4, z * 0.9 + y * 0.5 + 2, 2));
    const w = clamp(wa * patch * cover, 0, 1);
    col.setXYZ(i, lerp(col.getX(i), tint[0], w), lerp(col.getY(i), tint[1], w), lerp(col.getZ(i), tint[2], w));
  }
  return geo;
}

/**
 * Round 41 (structures-26): a LICHEN PLATE — a thin lobed disc lying on the bark along `n`,
 * ≈ 2 r across, its outline lobed by the 3D noise, the centre 6 mm off the surface and the rim
 * lifted a little further (crustose lichen curls at its edge) so it catches a line of light; the
 * rim is a shade darker than the centre. Eight segments, two rings: 24 triangles.
 */
function lichenPlate(c: Vector3, n: Vector3, r: number, seed: number, n3: Noise3D, color: [number, number, number]): BufferGeometry {
  const segs = 8;
  const N = _lpN.copy(n).normalize();
  const ref = Math.abs(N.y) > 0.9 ? _lpRef.set(1, 0, 0) : _lpRef.set(0, 1, 0);
  const T = _lpT.crossVectors(ref, N).normalize();
  const B = _lpB.crossVectors(N, T);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const lift = 0.006;
  const push = (p: Vector3, nn: Vector3, gain: number, u: number, v: number) => {
    positions.push(p.x, p.y, p.z);
    normals.push(nn.x, nn.y, nn.z);
    uvs.push(u, v);
    colors.push(color[0] * gain, color[1] * gain, color[2] * gain);
  };
  push(_lpP.copy(c).addScaledVector(N, lift), N, 1.05, 0.5, 0.5);
  for (let j = 1; j <= 2; j++) {
    const rim = j === 2;
    for (let i = 0; i < segs; i++) {
      const th = (i / segs) * TAU;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const ruff = 1 + (rim ? 0.3 : 0.15) * n3.noise(ct * 1.7 + seed, st * 1.7 - seed * 0.31, seed * 0.7 + j);
      const rr = r * (rim ? 1 : 0.55) * ruff;
      _lpP.copy(c).addScaledVector(T, ct * rr).addScaledVector(B, st * rr).addScaledVector(N, lift + (rim ? 0.005 : 0.002));
      // the rim's normal tilts outward so the lifted edge shades as a curl
      _lpQ.copy(N).addScaledVector(T, rim ? ct * 0.45 : ct * 0.15).addScaledVector(B, rim ? st * 0.45 : st * 0.15).normalize();
      push(_lpP, _lpQ, rim ? 0.82 : 1.0, 0.5 + ct * 0.5 * (rim ? 1 : 0.55), 0.5 + st * 0.5 * (rim ? 1 : 0.55));
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % segs);
    index.push(0, a, b);
    const c2 = 1 + segs + i;
    const d2 = 1 + segs + ((i + 1) % segs);
    index.push(a, c2, d2, a, d2, b);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  return geo;
}
const _lpN = new Vector3();
const _lpRef = new Vector3();
const _lpT = new Vector3();
const _lpB = new Vector3();
const _lpP = new Vector3();
const _lpQ = new Vector3();

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

/**
 * Every material a house clones for itself alone, by kind — the `indoorFog` clones with their
 * doorway plane, and the window socket's vertex-coloured glow. Nothing here reads it; the east
 * lane (east.ts) does, to give its three houses one material per kind (`indoorFogByVertex`).
 */
export const HOUSE_CLONES = new WeakMap<Material, { kind: string; base: Material; door?: { point: Vector3; normal: Vector3 } }>();

function indoorFog<M extends MeshStandardMaterial | MeshBasicMaterial>(base: M, doorPoint: Vector3, outward: Vector3, kind: string): M {
  const m = base.clone() as M;
  const uDoorPoint = { value: doorPoint.clone() };
  const uDoorNormal = { value: outward.clone().normalize() };
  HOUSE_CLONES.set(m, { kind, base, door: { point: uDoorPoint.value.clone(), normal: uDoorNormal.value.clone() } });
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
 * `indoorFog` with the doorway plane read per vertex (`aDoorPoint`, `aDoorNormal`) instead of from
 * uniforms, so the rooms of several houses can share one material and merge into one draw. The
 * caller writes both attributes on every geometry drawn with it.
 */
export function indoorFogByVertex<M extends MeshStandardMaterial | MeshBasicMaterial>(base: M): M {
  const m = base.clone() as M;
  const prev = base.onBeforeCompile;
  const prevKey = base.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nattribute vec3 aDoorPoint;\nattribute vec3 aDoorNormal;\n#define uDoorPoint aDoorPoint\n#define uDoorNormal aDoorNormal')
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${INDOOR_FOG_GLSL}`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}|structures:indoor-fog-vertex`;
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
function roomMaterial(mats: StructureMaterials, color = 0x3c3b3e, planked = false, map: Texture | null = null): MeshStandardMaterial {
  // Round 46 (structures-29, survey-2 #16): the room's surfaces are PLANKED — the weathered
  // planks' colour and normal maps (the fences' / Saria's boards) under the same mean albedo as
  // the old flat tint (the map's linear mean is (0.081, 0.058, 0.044); the tint is divided by
  // it), so the lamp pools now show grain and board lines on the walls and the floor instead of
  // a smooth dark plane. The shelf props keep the flat material.
  // (round 48: `map` — a texture of the caller's own, the rug's braid — in place of the planks)
  const tint = new Color(color);
  if (planked && !map) tint.multiply(new Color(1 / 0.081, 1 / 0.058, 1 / 0.044));
  const m = new MeshStandardMaterial({
    map: map ?? (planked ? mats.wood.map : null),
    normalMap: planked ? mats.wood.normalMap : mats.interior.normalMap,
    normalScale: planked ? new Vector2(0.7, 0.7) : new Vector2(0.3, 0.3),
    roughness: 1,
    // Round 12: a dark COOL recess with warm pools. The reference doorway is near-neutral grey
    // (box rgb(80,77,72), sat 0.12, hue 40°) with the amber local to the lamps; at B's 18 m the
    // haze between the camera and the door contributes most of the opening's light, and that
    // airlight is yellow-olive, so the walls' own tint goes cool grey (round 11's warm 0x6e6457 /
    // 0xffd08a @ 0.17 filled the whole opening with amber, sat 0.34) and only the emissive is
    // amber. The vertex colours carry the shading, the `aGlow` attribute the pools. (Round 13's
    // shelf props take the same material with a paler base so the lamps' light shows their colours.)
    color: tint,
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

type RGB = [number, number, number];
const sgnPow48 = (x: number, p: number) => Math.sign(x) * Math.pow(Math.abs(x), p);

/**
 * Round 48 (structures-31, opus-review #11 "smooth flat-shaded forms"): a CHAMFERED BOX for the
 * room's boards and brackets — a superellipsoid of exponent `e` (0.1: flat faces, the edges
 * rolled over ≈ 8 % of the half-size) about the origin, half-sizes along x / y / z, so a shelf
 * catches the lamp on a soft edge instead of a hard box corner. `tint(x, y, z)` in local
 * −1…1 coordinates. 16 × 9 samples (the superellipse parametrisation crowds them at the edges).
 */
function softBox(sx: number, sy: number, sz: number, e: number, tint: (x: number, y: number, z: number) => RGB): BufferGeometry {
  const g = gridSurface(
    (u, v, out) => {
      const th = u * TAU;
      const ph = (v - 0.5) * Math.PI;
      const cp = Math.cos(ph);
      const x = sgnPow48(cp, e) * sgnPow48(Math.cos(th), e);
      const y = sgnPow48(Math.sin(ph), e);
      const z = sgnPow48(cp, e) * sgnPow48(Math.sin(th), e);
      out.position.set(x * sx, y * sy, z * sz);
      out.uv = [u * 2, v];
      out.color = tint(x, y, z);
    },
    { cols: 16, rows: 9, closedU: true },
  );
  faceTowards(g, (p, o) => o.copy(p).multiplyScalar(4));
  return g;
}

/**
 * Round 48 (structures-31, #11 "the rug a flat concentric decal"): a BRAIDED RUG's cloth as a
 * texture — three plaited bands (one per tone of the rug's palette) stacked in v, each a row of
 * slanted, alternately-leaning stitches with a highlight along the upper edge and a shadow
 * under it, the fibres' fleck over everything. Tiled round the rug (u) and across its bands (v),
 * the rug's vertex colour carrying only the wear. 256 × 192, sRGB, generated once per house
 * (disposed with the house's materials).
 */
function braidedRugTexture(seed: number): Texture {
  const W = 256;
  const H = 192;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const tones: [number, number, number][] = [
    [186, 92, 58], // rust
    [206, 184, 132], // straw
    [88, 116, 70], // moss green
  ];
  const noise = new Noise2D(`rug48/${seed}`);
  const bandH = H / 3;
  for (let b = 0; b < 3; b++) {
    const [r, gg, bb] = tones[b];
    g.fillStyle = `rgb(${r},${gg},${bb})`;
    g.fillRect(0, b * bandH, W, bandH);
    // the stitches: an oval leaning +32° then −32°, 16 across the tile, the seam between two
    // bands a darker groove
    const n = 16;
    const sw = W / n;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * sw;
      const cy = b * bandH + bandH * 0.5;
      const lean = (i % 2 === 0 ? 1 : -1) * 0.56;
      g.save();
      g.translate(cx, cy);
      g.rotate(lean);
      // shadow side then lit side of the stitch
      g.fillStyle = `rgba(0,0,0,0.22)`;
      g.beginPath();
      g.ellipse(1.5, 2.5, sw * 0.36, bandH * 0.42, 0, 0, TAU);
      g.fill();
      g.fillStyle = `rgb(${Math.min(255, r * 1.12 + 10)},${Math.min(255, gg * 1.12 + 10)},${Math.min(255, bb * 1.1 + 8)})`;
      g.beginPath();
      g.ellipse(0, 0, sw * 0.34, bandH * 0.4, 0, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(255,245,225,0.28)`;
      g.beginPath();
      g.ellipse(-1.5, -bandH * 0.14, sw * 0.2, bandH * 0.16, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    g.fillStyle = 'rgba(20,10,5,0.45)';
    g.fillRect(0, b * bandH - 1.5, W, 3);
  }
  // fibre fleck
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const f = 0.86 + 0.28 * (0.5 + 0.5 * noise.noise(x * 0.9 + seed, y * 0.9)) + 0.06 * noise.noise(x * 0.18, y * 3.1 + 7);
      d[i] = Math.min(255, d[i] * f);
      d[i + 1] = Math.min(255, d[i + 1] * f);
      d[i + 2] = Math.min(255, d[i + 2] * f);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.name = 'structures:rug-braid';
  tex.needsUpdate = true;
  return tex;
}

export function buildHouse(def: HouseDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng, shared: HouseSharedMaterials = {}, site: HouseSiteOptions = {}): HouseBuild {
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
  /**
   * Round 36: the D-side moss weight (see `D_MOSS_TINT`) — Saria's north-west flank, a −0.95 …
   * −2.2 (ramps from −0.6 and to −2.55), from the ground to the bough's lower run (fading 4.4–5.2 m),
   * clear of the round window's hole (the window sits at a −1.08 / 2.6 m — D's frame edge, x 1.00
   * × y 0.31 — so only the hole and its frame are spared, the boss round it takes the sheet). The
   * upper house takes none: D sees it 16–18 m out only above Saria's bank.
   */
  const dSide: ((a: number, y: number) => number) | null =
    def.id === 'saria'
      ? (a, y) => {
          const wa = smoothstep(-0.6, -0.95, a) * smoothstep(-2.55, -2.2, a) * smoothstep(-0.6, 0.1, y) * smoothstep(5.2, 4.4, y);
          if (wa <= 0) return 0;
          return wa * smoothstep(winHoleR, winHoleR + 0.25 * k, Math.hypot(angleDiff(a, winA) * R, y - winY));
        }
      : null;

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
  /**
   * Round 21: FISSURES — sharp valleys where a slow field crosses zero, running up the trunk
   * with the cords' twist (the reference trunk in B, x 0.60–0.72, is cut by deep near-black
   * fissures between the cord bundles; ours had cords but no cuts) — and a finer second cord
   * octave, so the bundles themselves are corded. Both enter the relief and the vertex shade.
   */
  const fissure = (a: number, y: number) => {
    const arc = a * R;
    const tw = noise.noise(y * 0.15, arc * 0.1) * 1.6;
    return Math.pow(1 - Math.abs(noise.noise(arc * 0.75 + 31 + tw * 0.5, y * 0.08)), 8);
  };
  const cords2 = (a: number, y: number) => noise.ridged(a * R * 4.2 + y * 0.2 + 3, y * 0.3, 2) - 0.5;
  /**
   * Round 41 (structures-26): the player-height grain — a third cord octave (≈ 20 cm bundles,
   * ±1.5 cm) and narrow CRACKS (≈ 4 cm wide, 3 cm deep, running up the cords) that the 3 m views
   * resolve on the wall beside the door; relief only (the vertex shade keeps rounds 21–34's
   * calibrated terms), sub-pixel at camera B's 14 m and averaged out at the SSIM's 256 × 144.
   * The shell grid is denser for them (`cols` / `rows` below).
   */
  const cords3 = (a: number, y: number) => noise.ridged(a * R * 5.0 + y * 0.35 + 8, y * 0.55, 2) - 0.5;
  const crack = (a: number, y: number) => {
    const arc = a * R;
    const tw = noise.noise(y * 0.15, arc * 0.1) * 1.6;
    return Math.pow(1 - Math.abs(noise.noise(arc * 2.6 + 57 + tw * 0.7, y * 0.45 + 2)), 11);
  };
  const detail = (a: number, y: number) => {
    const arc = a * R;
    const furrow = Math.pow(Math.max(0, noise.noise(arc * 0.7 + 21, y * 0.12)), 2);
    const lumps = noise.fbm(arc * 0.35, y * 0.4, 3);
    const fine = noise.noise(arc * 3.5, y * 3.5);
    return cords(a, y) * 0.36 * k - furrow * 0.16 * k + lumps * 0.12 * k + fine * 0.015 + cords2(a, y) * 0.08 * k - fissure(a, y) * 0.14 * k + cords3(a, y) * 0.03 * k - crack(a, y) * 0.03 * k;
  };
  const winW = (a: number, r: number) => angleDiff(a, winA) * r;

  // ---- outer shell ----
  // (round 41: 240 × 72 → 320 × 100 — 6.3 × 4.2 cm at Saria's, so the ≈ 20 cm fine cords and the
  // cracks resolve; the surface function is unchanged, only its sampling)
  // The upper house stands 24 m from every hero camera (F's top-left, A's far plateau): it keeps
  // the round-40 sampling, the fine cords still tint its vertices.
  const hero = def.id === 'saria';
  const cols = Math.round((hero ? 320 : 240) * sk);
  const rows = Math.round((hero ? 100 : 72) * sk);
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
      // round 21: the fissures are near-black cuts, the fine cords add a second-order grain
      const fis = fissure(a, y) * fade;
      const crest2 = clamp(cords2(a, y) * 2, -1, 1) * fade;
      const ao = Math.max(0.1, 1 + 0.75 * crest + 0.2 * crest2) * (1 - 0.65 * fis);
      // grime and moss in the furrows and fissures (round 21): patchy, on the mid band of the
      // trunk (0.3–3.4 m), where the reference's cords stand out of a damp dark green-brown
      const mossField = noise.fbm(a * R * 0.6 + 13, y * 0.6 + 7, 2);
      const furrowMoss = clamp(0.7 * smoothstep(-0.1, -0.7, crest) + 0.6 * fis, 0, 1) * smoothstep(0.2, 0.8, mossField) * smoothstep(0.3, 1.0, y) * smoothstep(3.4, 2.6, y);
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
      // tint is pulled warm for the texture share that still shows. Round 22: ×0.35 — under
      // TRUNK_BARK_FLOOR (fully textured) the floor is proportional to this tint, so the shaded
      // wall falls toward the veil instead of the old flat term's 0.33
      const rightSide = front * smoothstep(porchW1 - 0.7, porchW1 + 0.2, w) * smoothstep(wallTop + 0.2, wallTop - 0.8, y);
      const sideShade = lerp(1, 0.35, rightSide) * lerp(1, 1.4, litPillar);
      const shade = eaveShade * flankAO * sideShade;
      /**
       * Round 22: the shaded trunk wears a MOSS SKIN. Reference B's trunk out of the sun — the
       * wall right of the door (x 0.92–1.0 × y 0.30–0.50) and the eave band — is deep green moss
       * over most of the bark with only the cord crests showing as khaki-grey (the dark bands of
       * the trunk box are olive: hue 43–47°, sat 0.16–0.28 — not the orange bark map). Round 21's
       * furrow grime covered a fifth of the mid band; on the shaded faces (the right wall and the
       * band under the eave, both front-facing) the skin covers everything off the crests, the
       * crests are pulled toward grey-olive instead of round 11's warm bias, and the skin's tint
       * is the deep green rather than the grime's green-brown.
       */
      const rightWall = front * smoothstep(porchW1 - 0.7, porchW1 + 0.2, w);
      const eaveBand = 0.6 * front * smoothstep(porchW0 - 0.6, porchW0 + 0.2, w) * smoothstep(bandY0 - 0.4, bandY0 + 0.1, y);
      const shaded = clamp(Math.max(rightWall, eaveBand), 0, 1) * smoothstep(0.1, 0.5, y);
      // round 34: how much of the shaded face is the wall right of the porch (green skin) rather
      // than the eave band / over-door wall (brown grime, BAND_GRIME_TINT)
      const wallShare = shaded > 0 ? clamp(rightWall / Math.max(rightWall, eaveBand, 1e-4), 0, 1) : 0;
      const skin = shaded * smoothstep(0.45, -0.15, crest) * smoothstep(-0.35, 0.3, mossField) * (1 - 0.5 * fis) * lerp(0.75, 1, wallShare);
      /**
       * Round 34 (structures-23): MOSS SHEETS and WET BARK on the lit trunk. Camera D sees this
       * trunk's north-west flank sunlit at 9–17 m (D bank x 0.80–1.0 × y 0.30–0.55: bark 32 % of
       * the box by material mask, p50 0.326 / hue 36° / sat 0.31 / green share 0.02 at 640×360)
       * where frame 56 s has a dark mossy mass (p50 0.239 / hue 63° / sat 0.25 / green 0.75; the
       * veil floors our darkest bark there at 0.25). The lit bark's albedo was the round-11 tint
       * (≈ 0.96 × the orange map): here the whole shell drops to ≈ 0.6 of it (frame B's lit lip
       * bark is dark brown, rgb(109,94,74)), the lower 1.6 m is damp-dark (×0.55 at the ground),
       * and patchy moss SHEETS (`sheet`, ≈ 45 % of the mid band off the cord crests, all round the
       * trunk — the frames' moss sits on the sunlit side too) in a deep green cover the flats and
       * furrows while the crests poke through; a few pale grey LICHEN patches sit on the crests.
       * The shaded faces keep their round-22 skin.
       */
      // (round 34 iteration 2: the sheets cover ≈ 60 % of the band off the crests — iteration 1's
      // 45 % at g/r 1.9 moved D's bank bark only 36° → 38.5°, green share 0.02 → 0.025)
      const sheetField = noise.fbm(a * R * 0.42 + 17, y * 0.42 + 5, 3);
      const sheet = smoothstep(-0.12, 0.3, sheetField) * smoothstep(0.6, -0.05, crest) * smoothstep(3.4, 2.6, y) * smoothstep(-0.3, 0.3, y) * (1 - 0.35 * fis) * fade;
      const lichen = smoothstep(0.5, 0.72, noise.noise(a * R * 1.3 + 41, y * 1.3 - 3)) * smoothstep(0.1, 0.6, crest) * (1 - sheet) * smoothstep(0.6, 1.4, y) * fade;
      const wet = smoothstep(1.6, -0.2, y);
      const mossCover = clamp(Math.max(furrowMoss, skin, sheet), 0, 1);
      // slightly cooler than the material's warm tint: the reference bark is grey-brown, not orange
      // (round 22: the shaded crests go grey-olive — g up, r and b down against the orange map;
      // round 34: only on the wall right of the porch — the eave band's crests stay the frame's brown)
      const greyed = shaded * wallShare;
      const warm = lerp(1, 0.86, rightSide) * lerp(1, 1.12, greyed);
      const warmR = lerp(1, 0.88, greyed);
      const warmB = lerp(1, 0.72, rightSide) * lerp(1, 0.9, greyed);
      const dark = TRUNK_LIT_ALBEDO * lerp(1, 0.55, wet);
      const rr = lerp(0.96 * vari, 0.6, base * 0.7) * ao * (1 + 0.08 * Math.max(0, crest)) * shade * warmR * dark;
      const gg = lerp(0.97 * vari, 0.62, base * 0.6) * ao * shade * warm * dark * 1.03;
      const bb = lerp(1.0 * vari, 0.64, base * 0.6) * ao * (1 - 0.1 * Math.max(0, crest)) * shade * warmB * dark * 1.06;
      const cr = lerp(rr, 0.55 * dark, mossy * 0.6);
      const cg = lerp(gg, 0.72 * dark, mossy * 0.6);
      const cb = lerp(bb, 0.4 * dark, mossy * 0.6);
      // the furrow grime is a DARK damp green-brown (in the eave's shade with the wall), not the base
      // moss; the round-22 skin on the shaded faces is deeper and greener still; the round-34
      // sheets are the deep moss green of the frames' bank (SHEET_MOSS_TINT)
      const gw = clamp(Math.max(lerp(furrowMoss * 0.7, mossCover * 0.85, shaded), sheet * 0.92), 0, 1);
      const sheetShare = sheet > 0 ? clamp(sheet / Math.max(1e-4, mossCover), 0, 1) * (1 - shaded) : 0;
      const skinR = lerp(BAND_GRIME_TINT[0], SKIN_MOSS_TINT[0], wallShare);
      const skinG = lerp(BAND_GRIME_TINT[1], SKIN_MOSS_TINT[1], wallShare);
      const skinB = lerp(BAND_GRIME_TINT[2], SKIN_MOSS_TINT[2], wallShare);
      const mr = lerp(lerp(FURROW_MOSS_TINT[0], skinR, shaded), SHEET_MOSS_TINT[0], sheetShare) * shade;
      const mg = lerp(lerp(FURROW_MOSS_TINT[1], skinG, shaded), SHEET_MOSS_TINT[1], sheetShare) * shade;
      const mb = lerp(lerp(FURROW_MOSS_TINT[2], skinB, shaded), SHEET_MOSS_TINT[2], sheetShare) * shade;
      const lr = lerp(cr, LICHEN_TINT[0] * shade, lichen);
      const lg = lerp(cg, LICHEN_TINT[1] * shade, lichen);
      const lb = lerp(cb, LICHEN_TINT[2] * shade, lichen);
      out.color = [lerp(lr, mr, gw), lerp(lg, mg, gw), lerp(lb, mb, gw)];
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
  if (dSide) mossBySide(outer, frame, D_MOSS_TINT, noise, dSide);
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
  /**
   * The threshold slab's footprint (door space: lateral centre / half-widths, depth centre /
   * half-depth, top height) — shared by the porch floor (which dips under it), the slab itself
   * and the round-43 moss doormat that stands on it. Top: 3.5 cm under the sill, or 7 cm over the
   * terrain at the slab's centre when the ground there stands higher.
   */
  const slabFootprint = (() => {
    const w = (doorW1 - doorW0) * 0.5 + 0.35 * k;
    const d = 0.42 * k;
    const cw = (doorW0 + doorW1) / 2 + 0.05 * k;
    const cd = dBack + 0.42 * k;
    const c = frame.door(cw, 0, cd);
    return { w, d, cw, cd, top: Math.max(sill - 0.035, terrain.height(c.x, c.z) - yFloor + 0.07) };
  })();
  /**
   * Round 36 (structures-24): the recess's channel balance. Rounds 11–22 pulled the recess bark
   * toward neutral (×0.8 / 0.92 / 1.12 — the reference porch flanks read ≈ (72, 78, 76) in the
   * earlier analysis), and frame B's over-door box (0.70–0.80 × 0.33–0.40) reads hue 35.6° at
   * sat 0.335 where ours rendered 43.3° / 0.293 with the porch's own pixels (48 % of the box)
   * at 42.5° / 0.226: the veil supplies most of a pixel there, so the surface's small share
   * has to be warmer than the target to land it. Warm bark balance, luminance −1 %.
   */
  const RECESS_BAL: [number, number, number] = [1.05, 0.88, 0.62];
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
        // rendered 0.38) — so the whole tunnel drops to ⅔ of round 11's tint. Round 22: the
        // reveal's inner faces are near-black in the reference (the cavity's sides read 0.23–0.27
        // in B against the door's 0.29 veil floor) — half again
        const dark = lerp(0.22, 0.11, Math.pow(q, 0.7));
        out.color = [dark * RECESS_BAL[0], dark * RECESS_BAL[1], dark * RECESS_BAL[2]];
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
        // the recess is a dark cavity in the reference (lum 0.21–0.27 above the doorway; round
        // 22: 0.2 → 0.14 with the pods' light moved off it)
        const shade = 0.14 + 0.05 * noise.noise(w * 1.3 + 4, y * 1.3) - 0.05 * smoothstep(doorTop - 0.3, porchTop, y);
        out.color = [shade * RECESS_BAL[0], shade * RECESS_BAL[1], shade * RECESS_BAL[2]];
      },
      {
        cols: 44,
        rows: 40,
        hole: (u, v) => doorSD(lerp(bw0, bw1, u), lerp(by0, by1, v)) < 0,
      },
    );
    faceTowards(back, (p, o) => o.copy(p).addScaledVector(F, 1));
    porchParts.push(back);
    // floor: packed earth rising gently to the sill; never below the terrain inside the trunk.
    // Round 44 (structures-28): under the threshold slab's footprint the earth sits 5 cm below
    // the slab's top. The ramp ran from sill − 0.02 at the sill to ≈ sill − 0.07 at the slab's
    // far edge, i.e. THROUGH the slab's top (sill − 0.035 with the round-44 wear): in w31-house-d
    // the earth covered the stone but for a sliver along its far rim and the doormat read as a
    // green carpet on a black slab (the round-8 cylinder's flat top was a centimetre higher and
    // z-fought instead). The floor's own terrain clamp still applies (slabTop ≥ terrain + 0.07).
    const { w: slabW, d: slabD, cw: slabCW, cd: slabCD, top: slabTop } = slabFootprint;
    const floor = gridSurface(
      (u, v, out) => {
        const w = lerp(porchW0 - 0.35, porchW1 + 0.35, u);
        const d = lerp(dBack - 0.15, dOut(w, 0) + 0.45, v);
        let ramp = lerp(sill - 0.02, 0.03, smoothstep(dBack + 0.1, dBack + 1.25 * k, d));
        const rrSlab = Math.hypot((w - slabCW) / slabW, (d - slabCD) / slabD);
        // 1.14: the slab's outline wanders ± 12 % (`outline` below) — the whole stone sits in the dip
        if (rrSlab < 1.14) ramp = Math.min(ramp, slabTop - 0.05);
        // under the stone proper (its edge lies at ≥ 0.88) the earth is hidden and may sit below
        // the terrain too — the slab stands only 7 cm over the ground at its centre, and a floor
        // held at terrain + 0.05 there met the top's 1.2 cm dish along the walked line
        if (rrSlab < 0.85) ramp = slabTop - 0.08;
        frame.door(w, ramp, d, out.position);
        const th = terrain.height(out.position.x, out.position.z) + (rrSlab < 0.85 ? -0.05 : 0.05);
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
    // Round 43 (structures-27): the reveal at 2 m — the doorway's cut faces were three flat dark
    // rows. Now bark CORDS run through the reveal from the mouth to the room (ring-periodic round
    // the outline, so no seam), four KNOTS bulge out of the jambs, a fine crack octave sits between
    // the cords, and the mouth's edge is a rounded LIP rolling out over the porch's back wall. The
    // relief moves the faces into the opening by ≤ 3.5 cm (knots 8 cm), under 0.3 px at B's 14 m;
    // the crests catch the doorway's light (vertex shade), the cracks stay near-black.
    const revealRng = rng.fork('reveal43');
    const revealKnots: { s: number; q: number; w: number; h: number }[] = [];
    for (let i = 0; i < 4; i++) revealKnots.push({ s: revealRng(), q: 0.25 + revealRng() * 0.5, w: 0.035 + revealRng() * 0.03, h: (0.05 + revealRng() * 0.04) * k });
    const doorTunnel = gridSurface(
      (s, q, out) => {
        const [w0, y0] = doorOutline.at(s);
        const cord = ringRidged(noise, s * TAU, q * 0.35 + 2, 5.5, 4.2);
        const crack = Math.pow(1 - Math.abs(noise.noise(Math.cos(s * TAU) * 4.3 + 1, Math.sin(s * TAU) * 4.3 + q * 0.8)), 8);
        let knot = 0;
        for (const kn of revealKnots) {
          let ds = s - kn.s;
          ds -= Math.round(ds);
          const dq = (q - kn.q) * 0.5;
          knot += kn.h * Math.exp(-(ds * ds + dq * dq) / (kn.w * kn.w));
        }
        const lip = 0.05 * k * Math.pow(1 - smoothstep(0, 0.35, q), 2);
        const e = lerp(0.1, -0.06, q) + lip - (cord - 0.5) * 0.035 * k + crack * 0.02 * k - knot;
        const [w, y] = onDoorIso(w0, y0, e);
        const d = lerp(dBack + 0.04, roomFront - 0.06, q);
        frame.door(w, y, d, out.position);
        out.uv = [(s * doorOutline.length) / 2.2, d / 2.2];
        // (round 22: darker still — the doorway's cut faces are the near-black rim of the opening;
        // round 43: the same mean, the crests ×1.5 over it and the furrows ×0.6 under it, so the
        // cords and knots read at 2 m under the recess floor — the rim's level in B holds)
        const dark = lerp(0.19, 0.09, q) * (0.6 + 0.9 * cord + 0.5 * clamp(knot / (0.06 * k), 0, 1)) * (1 - 0.7 * crack);
        out.color = [dark * RECESS_BAL[0], dark * RECESS_BAL[1], dark * RECESS_BAL[2]];
      },
      { cols: hero ? 112 : 56, rows: hero ? 8 : 4 },
    );
    faceTowards(doorTunnel, (p, o) => frame.door((doorW0 + doorW1) / 2, Math.min(p.y - yFloor, doorTop - doorRc - 0.2), (dBack + roomFront) / 2, o));
    porchParts.push(doorTunnel);
    // Round 47 (structures-30, owner review 2026-09-19 #11 "the nook of the tree"): the mouth
    // is a ROLLED LIP — the callus roll a living trunk grows round a hollow: a thick rounded
    // ring of bark standing 0.13 m off the porch's back wall round the opening, curling
    // forward over the crest and back into the reveal, so the doorway's edge is a fold of
    // bark (ref-01: the house's opening has thick bark folds round it) rather than a cut. The
    // ring's thickness wanders round the outline (± 35 %), it fades out under the sill beam,
    // and the reveal's cords, cracks and knots run over it. It sits in front of the reveal's
    // mouth (its inner edge ends inside the reveal's first ring, hiding both seams).
    if (hero) {
      const rollNoise = noise;
      const doorRoll = gridSurface(
        (s, q, out) => {
          const [w0, y0] = doorOutline.at(s);
          const phi = q * Math.PI;
          // thickness: wanders round the ring, nothing under the sill (the beam is there)
          const thick = 0.13 * k * (0.75 + 0.35 * rollNoise.noise(Math.cos(s * TAU) * 2.1 + 3, Math.sin(s * TAU) * 2.1 + 7)) * smoothstep(sill + 0.05 * k, sill + 0.45 * k, y0);
          const cord = ringRidged(rollNoise, s * TAU, 2 - q * 0.3, 5.5, 4.2);
          const crack = Math.pow(1 - Math.abs(rollNoise.noise(Math.cos(s * TAU) * 4.3 + 1, Math.sin(s * TAU) * 4.3 - q * 0.6)), 8);
          let knot = 0;
          for (const kn of revealKnots) {
            let ds = s - kn.s;
            ds -= Math.round(ds);
            const dq = (q - 0.35) * 0.4;
            knot += kn.h * 0.7 * Math.exp(-(ds * ds + dq * dq) / (kn.w * kn.w));
          }
          // e: on the wall outside the ring at φ = 0, over the crest, into the reveal at φ = π
          const e = 0.1 + thick * 0.95 * (1 + Math.cos(phi)) * 0.5 + 0.04 * k * (1 - q) - 0.06 * k * q - (cord - 0.5) * 0.025 * k + crack * 0.015 * k - knot;
          const [w, y] = onDoorIso(w0, y0, e);
          const dOff = thick * Math.sin(phi) + 0.02 * k;
          frame.door(w, y, dBack + dOff, out.position);
          out.uv = [(s * doorOutline.length) / 2.2, (dBack + dOff) / 2.2 + 0.35];
          // the crest catches the porch's light, the inner face falls toward the reveal's shade
          const face = 0.7 + 0.5 * Math.sin(phi) * (1 - 0.5 * q);
          const dark = lerp(0.2, 0.15, q) * face * (0.6 + 0.9 * cord + 0.5 * clamp(knot / (0.06 * k), 0, 1)) * (1 - 0.6 * crack);
          out.color = [dark * RECESS_BAL[0], dark * RECESS_BAL[1], dark * RECESS_BAL[2]];
        },
        { cols: 112, rows: 9 },
      );
      faceTowards(doorRoll, (p, o) => frame.door((doorW0 + doorW1) / 2, Math.min(p.y - yFloor, doorTop - doorRc - 0.2), dBack + 1.0, o));
      porchParts.push(doorRoll);
    }
  }
  // the recess bark: the same maps under a fifth of the shade floor (RECESS_BARK_FLOOR) — under
  // HOUSE_BARK_FLOOR the porch's vertex tints never showed, every shaded face sat at the floor
  const porchMesh = new Mesh(merge(porchParts), mats.recessBark);
  porchMesh.name = 'porch';
  porchMesh.castShadow = porchMesh.receiveShadow = true;
  group.add(porchMesh);

  // ---- doorway through the back wall + room behind it ----
  const doorPlanePoint = frame.door((doorW0 + doorW1) / 2, doorTop * 0.5, dBack);
  // Round 48 (structures-31, opus-review walk #11 "Saria's hollow is furnished but unlit and
  // untextured", poses sn-house-door / sn-room-inside / sn-room-bed): the room's diffuse albedo
  // was ≈ 0.01 linear (0x3c3b3e ≈ 0.047 × the 0.12–0.38 vertex shade), so no light — the lamps'
  // pools are emissive — could show the boards, and the furniture read as flat forms in the
  // dark. The reference doorway (d_030–d_036, ref-01) is a LIT room: back wall and floor
  // visible, warm lamp, cool fill from the door, l ≈ 0.32. Now the walls / floor carry a real
  // wood albedo (0x847e78, ≈ 0.23 linear, under 0.32–0.78 vertex shades — weathered planks
  // in lamplight), the lamps are real point lights (below), and the emissive pools are what
  // they were (B's tuned levels). From the plaza (B / E at 18 m) the doorway box keeps its
  // dark, hazed read: ours measured p50 0.173 against the reference's 0.291 before this pass,
  // so the lift moves it toward the frame, not past it (measured after, see the round log).
  // (the hero house only; the upper house's doorway is a few hazed pixels in A / F and keeps round 46's levels)
  const roomMat = indoorFog(roomMaterial(mats, hero ? 0x847e78 : 0x3c3b3e, true), doorPlanePoint, F, 'room');
  const materials: { dispose(): void }[] = [roomMat];
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
  /** the candle on the stump table (round 47: it has a pool of its own in `glowOf`) */
  const candlePos47 = frame.door(doorW0 + 0.7 * k, sill + 0.55 * k, roomFront - 1.1 * k);
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
    // Round 22: the reference doorway (x 0.75–0.83 × y 0.40–0.54) is a featureless dark cavity
    // with two warm points — p90 0.354 against ours 0.374 with the shelves' pots showing in the
    // lamps' pools: the pools' peaks come down a third and the ceiling ramp by a third, so the
    // lamps read as points over dark wood (the pods themselves are emissive and unchanged).
    // Round 46 (structures-29, survey-2 #16): the lamps' light POOLS ON THE FLOOR — a wide soft
    // disc of the amber emissive on the floor pad under each lamp (and the table top under the
    // candle), so from the threshold the room has a lit floor with the furniture's silhouettes
    // standing in it. The floor is below the sill line from every hero camera (B / D / A look UP
    // at the door from the plaza), so the doorway they see — back wall, ceiling, the two lamp
    // points — keeps its round-22 pools.
    const floorLevel = yFloor + roomFloorY;
    const onFloor = smoothstep(0.14 * k, 0.02 * k, Math.abs(p.y - floorLevel));
    const floorPool = (c: Vector3, radius: number, peak: number) => {
      const dh = Math.hypot(p.x - c.x, p.z - c.z) / radius;
      return peak * Math.exp(-dh * dh * 1.6);
    };
    // round 47 (structures-30): the candle on the table has its own small pool — the table top,
    // the bowl and cup on it, the stool and the rug's near edge (the reference's fainter glint
    // ≈ 0.7 m up is this candle); on the floor a wider, fainter disc round the table's foot
    const candle = hero ? pool(p, candlePos47, 0.05 * k, 0.42 * k, 0.3) + onFloor * floorPool(candlePos47, 0.6 * k, 0.12) : 0;
    const floorGlow = onFloor * (floorPool(lampPos, 0.7 * k, 0.26) + floorPool(lamp2Pos, 0.6 * k, 0.2) + floorPool(hearthPos, 0.45 * k, 0.1));
    return (0.006 + 0.04 * Math.pow(h, 3)) * lerp(1, 0.35, deep) + pool(p, lampPos, 0.26 * k, 0.24 * k, 0.55) + pool(p, lamp2Pos, 0.24 * k, 0.22 * k, 0.45) + pool(p, hearthPos, 0.18 * k, 0.24 * k, 0.3) + pool(p, archPos, 0.12 * k, 0.3 * k, 0.12) + floorGlow + candle;
  };
  /**
   * Round 46: the BOARDS the room is lined with — vertical on the walls, running into the room
   * on the floor. `across` is the coordinate across the boards (m), `along` the one along their
   * grain. Returns the relief into the surface (m, ≥ 0 at the gaps between boards, a slight crown
   * on each board, the grain's ± 3 mm) and the shade (board-to-board tone, dark gap lines, grain
   * lines darker). Continuous in both coordinates (gridSurface's normals difference it).
   */
  const BOARD_W = 0.21 * k;
  const boards = (across: number, along: number, seed: number): { relief: number; shade: number } => {
    const bx = (across + seed * 0.37) / BOARD_W;
    const idx = Math.floor(bx);
    const f = bx - idx;
    // gap: 12 mm dark joint between boards; the board's face crowns 4 mm at its middle
    const edge = Math.min(f, 1 - f) * BOARD_W;
    const gap = 1 - smoothstep(0.004, 0.012, edge);
    const crown = 0.004 * k * Math.sin(f * Math.PI);
    // (second cut: a wider board-to-board tone spread and deeper grain / joints — at the first
    // cut's 0.84–1.16 / 0.72–1.14 the planking read only in the lamp pools from the threshold)
    const tone = 0.78 + 0.44 * hash2(idx, Math.round(seed * 100), 5);
    const g = noise.ridged(across * 26 + idx * 3.7 + seed, along * 0.8 + idx * 0.9 + seed * 0.5, 2);
    const fib = 0.5 + 0.5 * noise.noise(across * 60 + seed, along * 5 + idx);
    const grain = (g - 0.5) * 0.003 * k;
    return { relief: gap * 0.012 * k - crown + grain, shade: lerp(tone * lerp(0.66, 1.2, g) * lerp(0.92, 1.08, fib), 0.22, gap) };
  };
  /**
   * Round 47 (structures-30): where the furniture stands, known before the floor is built so the
   * boards can carry WEAR along the walked lines and CONTACT SHADE under the pieces (the lamps'
   * floor pools are cut under them too — the "soft shadows" of a lamp-lit room without a shadow
   * map). Door space (w lateral, d forward). The stump table and stool are round 46's; the bed
   * (against the back wall, left), rug and hearth jug are this round's (`furnish47` below).
   */
  const tableD47 = roomFront - 1.1 * k;
  const tableW47 = doorW0 + 0.7 * k;
  const bedRect47 = (() => {
    const w0 = roomW0 + 0.12 * k;
    const w1 = roomW0 + 1.62 * k;
    let back = -Infinity;
    for (let i = 0; i <= 8; i++) back = Math.max(back, roomBackD(lerp(w0, w1, i / 8)));
    return { w0, w1, d0: back + 0.05 * k, d1: back + 0.92 * k };
  })();
  const rugC47 = { w: 0.05 * k, d: roomFront - 0.72 * k, rw: 0.66 * k, rd: 0.46 * k };
  const hearthW47 = doorW1 - 0.3 * k;
  const hearthD47 = roomBackD(hearthW47) + 0.55 * k;
  const jug47 = { w: doorW1 - 0.85 * k, d: roomBackD(doorW1 - 0.85 * k) + 0.32 * k, r: 0.13 * k };
  /** 0..1 how trodden the floor is at (w, d): the threshold, the line to the table, to the hearth, to the bed */
  const floorWear47 = (w: number, d: number): number => {
    const seg = (aw: number, ad: number, bw: number, bd: number, half: number) => {
      const dx = bw - aw;
      const dz = bd - ad;
      const t = clamp(((w - aw) * dx + (d - ad) * dz) / Math.max(1e-6, dx * dx + dz * dz), 0, 1);
      const e = Math.hypot(w - (aw + dx * t), d - (ad + dz * t)) / half;
      return Math.exp(-e * e * 1.4);
    };
    const doorW = (doorW0 + doorW1) / 2;
    let wear = seg(doorW, roomFront + 0.1, doorW, roomFront - 0.5 * k, 0.55 * k);
    wear = Math.max(wear, 0.8 * seg(doorW, roomFront - 0.4 * k, tableW47 + 0.35 * k, tableD47 + 0.25 * k, 0.32 * k));
    wear = Math.max(wear, 0.7 * seg(doorW, roomFront - 0.4 * k, hearthW47 - 0.2 * k, hearthD47 + 0.35 * k, 0.3 * k));
    wear = Math.max(wear, 0.6 * seg(tableW47, tableD47 - 0.3 * k, (bedRect47.w0 + bedRect47.w1) / 2, bedRect47.d1 + 0.2 * k, 0.3 * k));
    return clamp(wear * (0.85 + 0.15 * noise.noise(w * 3.1 + 5, d * 3.1 + 9)), 0, 1);
  };
  /** 0..1 contact shade on the floor under the furniture */
  const floorAO47 = (w: number, d: number): number => {
    const disc = (cw: number, cd: number, r: number, soft: number) => 1 - smoothstep(r, r + soft, Math.hypot(w - cw, d - cd));
    let ao = 0.85 * disc(tableW47, tableD47, 0.14 * k, 0.22 * k);
    ao = Math.max(ao, 0.7 * disc(doorW0 + 0.08 * k, tableD47 + 0.25 * k, 0.15 * k, 0.16 * k));
    ao = Math.max(ao, 0.6 * disc(hearthW47, hearthD47, 0.24 * k, 0.16 * k));
    ao = Math.max(ao, 0.7 * disc(jug47.w, jug47.d, jug47.r, 0.12 * k));
    // the bed: a soft rectangle
    const bw = 1 - smoothstep(0, 0.18 * k, Math.max(bedRect47.w0 - w, w - bedRect47.w1, 0));
    const bd = 1 - smoothstep(0, 0.18 * k, Math.max(bedRect47.d0 - d, d - bedRect47.d1, 0));
    ao = Math.max(ao, 0.8 * bw * bd);
    return clamp(ao, 0, 1);
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
      // round 46: a fifth lighter than round 22's 0.1–0.32 and the recess's fall-off eased
      // (× 0.4 → × 0.5) — the boards' grain and joints need a level to show on; the doorway's
      // level from B is set by the pools and the veil, and its p50 is measured below.
      // Round 48: 0.12–0.38 → 0.32–0.78 with the material's albedo (see `roomMat`): these are
      // now a wall's shade under its own lamps (a little darker low down and deep in), not the
      // room's whole darkness; the recess fall-off eases to × 0.65 so the back wall reads
      const s = hero
        ? lerp(0.32, 0.78, Math.pow(smoothstep(roomFloorY, roomCeilY, y), 1.1)) * lerp(1, 0.65, depthOf(p)) * lat
        : lerp(0.12, 0.38, Math.pow(smoothstep(roomFloorY, roomCeilY, y), 1.4)) * lerp(1, 0.5, depthOf(p)) * lat;
      const g = glowAt(p);
      // cool grey (see `roomMaterial`); the embers' pool is the only warm diffuse tint
      return [s * 0.92 + g[0], s * 0.96 + g[1], s * 1.05 + g[2]];
    };
    // room's front plane (inside face of the back wall) around the doorway.
    // Round 43 (structures-27): the vestibule's inner wall is the hollow trunk's heartwood — long
    // VERTICAL GRAIN ridges (±2 cm into the room), three knots and the cracks between the ridges,
    // shaded in the tint so the lamp pools round the door show a grained wall, not a flat plane.
    const wallKnots: { w: number; y: number; s: number; h: number }[] = [];
    {
      const wk = rng.fork('wall-knots43');
      for (let i = 0; i < 3; i++) wallKnots.push({ w: lerp(roomW0, roomW1, wk()), y: lerp(roomFloorY + 0.3 * k, roomCeilY - 0.2 * k, wk()), s: (0.12 + wk() * 0.1) * k, h: (0.03 + wk() * 0.02) * k });
    }
    const wallRelief = (w: number, y: number): { d: number; shade: number } => {
      const ridge = noise.ridged(w * 3.6 + 2, y * 0.45 + 1, 2) - 0.5;
      const crack = Math.pow(1 - Math.abs(noise.noise(w * 5.1 + 7, y * 0.6)), 7);
      let knot = 0;
      for (const kn of wallKnots) {
        const q = ((w - kn.w) * (w - kn.w) + (y - kn.y) * (y - kn.y)) / (kn.s * kn.s);
        if (q < 6) knot += kn.h * Math.exp(-q);
      }
      return { d: ridge * 0.02 * k - crack * 0.015 * k + knot, shade: (1 + 0.45 * ridge) * (1 - 0.5 * crack) * (1 + 0.3 * clamp(knot / (0.04 * k), 0, 1)) };
    };
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0 - 0.05, roomW1 + 0.05, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          const rel = wallRelief(w, y);
          // (the relief fades to nothing at the door's cut, where the reveal meets the plane)
          const edge = smoothstep(0, 0.12 * k, doorSD(w, y));
          frame.door(w, y, roomFront + 0.01 - rel.d * edge, out.position);
          out.uv = [w / 2.2, y / 2.2];
          const c = wallShade(w, y, out.position);
          const sh = lerp(1, rel.shade, edge);
          out.color = [c[0] * sh, c[1] * sh, c[2] * sh];
        },
        {
          cols: hero ? 72 : 30,
          rows: hero ? 56 : 24,
          hole: (u, v) => doorSD(lerp(roomW0 - 0.05, roomW1 + 0.05, u), lerp(roomFloorY - 0.06, roomCeilY + 0.06, v)) < 0,
        },
      ),
    );
    // back wall (the deep recess), side walls, floor, ceiling.
    // Round 46 (structures-29): the back and side walls are lined with VERTICAL BOARDS (`boards`:
    // 21 cm wide, 12 mm dark joints, a 4 mm crown, ± 3 mm grain, board-to-board tone) standing
    // proud of the recess, the floor with boards running into the room; finer grids so the
    // joints resolve (the back wall 96 × 24, the sides 40 × 16, the floor 72 × 48).
    const BOARD_TILE = 1.1;
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0, roomW1, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          const b = boards(w, y, 1);
          frame.door(w, y, roomBackD(w) + 0.02 * k - b.relief, out.position);
          out.uv = [w / BOARD_TILE, y / BOARD_TILE];
          const c = wallShade(w, y, out.position);
          out.color = [c[0] * b.shade, c[1] * b.shade, c[2] * b.shade];
        },
        { cols: hero ? 96 : 48, rows: hero ? 24 : 12 },
      ),
    );
    for (const w of [roomW0, roomW1]) {
      const into = w === roomW0 ? 1 : -1;
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, u);
            const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
            const b = boards(d, y, w === roomW0 ? 2 : 3);
            frame.door(w + into * (0.015 * k - b.relief), y, d, out.position);
            out.uv = [d / BOARD_TILE, y / BOARD_TILE];
            const c = wallShade(w, y, out.position);
            out.color = [c[0] * b.shade, c[1] * b.shade, c[2] * b.shade];
          },
          { cols: hero ? 40 : 20, rows: hero ? 16 : 8 },
        ),
      );
    }
    // floor: the level pad (round 14 — no terrain lift; the back wall stops where the slope
    // reaches it, see `roomBackD`), ceiling. Round 46: the floor is boarded (the boards run into
    // the room), a warm brown under the lamps' pools — the floor's bounce — grading to the cool
    // recess grey at the back; the ceiling keeps its plain shade.
    for (const y of [roomFloorY, roomCeilY]) {
      const isFloor = y === roomFloorY;
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const w = lerp(roomW0 - 0.02, roomW1 + 0.02, u);
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, v);
            // round 48: the ceiling is boarded too (shade only — no relief on the underside), the
            // boards running across the room like the floor's run into it
            const b = isFloor ? boards(w, d, 4) : { relief: 0, shade: boards(d, w, 6).shade };
            // round 47: the walked lines are worn smooth and pale (the joints' relief and the
            // grain's contrast flattened, the tone lifted), the floor under the furniture shaded
            const wear = isFloor && hero ? floorWear47(w, d) : 0;
            const ao = isFloor && hero ? floorAO47(w, d) : 0;
            frame.door(w, y - (isFloor ? b.relief * (1 - 0.55 * wear) : 0), d, out.position);
            const deep = depthOf(out.position);
            // (round 48: 0.3 → 0.62 floor / 0.5 ceiling — a lamp-lit floor's own shade, see `roomMat`)
            const s = (isFloor ? 0.62 : 0.5) * lerp(1, isFloor ? 0.6 : 0.45, deep);
            out.uv = [w / BOARD_TILE, d / BOARD_TILE];
            const g = glowAt(_p.copy(out.position));
            if (isFloor) {
              // the bounce: warm where the lamps' pools fall, cool grey deep in the recess
              const warm = clamp(Math.exp(-Math.pow(Math.hypot(out.position.x - lampPos.x, out.position.z - lampPos.z) / (0.9 * k), 2)) + 0.7 * Math.exp(-Math.pow(Math.hypot(out.position.x - lamp2Pos.x, out.position.z - lamp2Pos.z) / (0.8 * k), 2)), 0, 1);
              const tintR = lerp(0.92, 1.25, warm);
              const tintG = lerp(0.96, 1.0, warm);
              const tintB = lerp(1.05, 0.7, warm);
              const worn = lerp(b.shade, 0.5 + 0.5 * b.shade, wear) * (1 + 0.28 * wear) * (1 - 0.6 * ao);
              out.color = [(s * tintR + g[0] * 0.5) * worn, (s * tintG + g[1] * 0.5) * worn, (s * tintB + g[2] * 0.5) * worn];
            } else {
              out.color = [(s * 0.92 + g[0] * 0.5) * b.shade, (s * 0.96 + g[1] * 0.5) * b.shade, (s * 1.05 + g[2] * 0.5) * b.shade];
            }
          },
          { cols: isFloor ? (hero ? 72 : 36) : hero ? 40 : 16, rows: isFloor ? (hero ? 48 : 24) : hero ? 24 : 16 },
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
    const _rel = new Vector3();
    /**
     * Round 46 (structures-29): the lamps' pools are the emissive, flat across a board's face and
     * its joint alike, so the boards' relief and shade (`boards`, in the diffuse) vanished inside
     * the very halos where the wall is bright enough to see (sn-house-door, first pass). The
     * pool is modulated by the board field at the vertex — the joints cut the halo to a third,
     * the boards' own tone rides on it — so the lamplight shows planks. The vertex is classed by
     * its door-space position (the floor pad by height, the side walls by their lateral, the
     * rest is the back wall / ceiling), the same seeds as the surfaces took.
     */
    const boardMod = (p: Vector3) => {
      _rel.copy(p).sub(frame.C);
      const w = _rel.dot(Rt);
      const d = _rel.dot(F);
      const y = p.y - frame.C.y;
      let sh: number;
      if (y < roomFloorY + 0.03 * k) {
        // round 47: the pools are cut under the furniture (contact shade) and flattened on the worn lines
        const wear = hero ? floorWear47(w, d) : 0;
        const ao = hero ? floorAO47(w, d) : 0;
        sh = lerp(boards(w, d, 4).shade, 0.5 + 0.5 * boards(w, d, 4).shade, wear);
        return lerp(0.35, 1.1, smoothstep(0.25, 1.0, sh)) * (1 - 0.75 * ao);
      } else if (y > roomCeilY - 0.03 * k) return 1;
      else if (Math.abs(w - roomW0) < 0.05 * k) sh = boards(d, y, 2).shade;
      else if (Math.abs(w - roomW1) < 0.05 * k) sh = boards(d, y, 3).shade;
      else sh = boards(w, y, 1).shade;
      return lerp(0.35, 1.1, smoothstep(0.25, 1.0, sh));
    };
    setFloatAttribute(roomGeo, 'aGlow', (i) => glowOf(_g.set(pos.getX(i), pos.getY(i), pos.getZ(i))) * boardMod(_g));
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
  // (round 22: the paler base halves — 0x9a8878 → 0x5e544a — so the pots are shapes in the
  // lamps' pools, not pale objects filling the reference's dark opening)
  // Round 48 (structures-31, opus-review #11): in the hero house the props' base goes back up to
  // a real albedo (0x8c7e6e ≈ 0.26 linear under the pieces' 0.3–0.95 tints — clay, glaze and
  // wood in lamplight) now that the lamps are lights; the pieces themselves are LATHED with
  // throwing rings and painted bands (`kokiriPot`), the boards chamfered (`softBox`) and grained.
  const propsMat = indoorFog(roomMaterial(mats, hero ? 0x8c7e6e : 0x5e544a), doorPlanePoint, F, 'props');
  materials.push(propsMat);
  /** grain noise for the room's woodwork (round 48) */
  const grainNoise = new Noise2D(`${ctx.config.seed}/structures/house/${def.id}/grain48`);
  /**
   * A turned (lathe) form standing on the origin along +y: the side from t 0 → 1, then the top
   * disc. Round 48: the tint also gets the angle round the form (`th`) and the top disc's radius
   * fraction, and `relief` (t, th) scales the profile — throwing rings on a pot, the waver of a
   * hand-turned leg.
   *
   * Round 52 (fable-3, the owner's "shelf props read hollow"): with `mouth` the top is no longer a
   * flat disc painted dark — which at arm's length read as a black paper lid — but a vessel's
   * mouth: the body colour rolls over a lip (`wall` of the rim radius wide, half that high), an
   * inner wall follows the outer profile inset by the wall down to `depth` of the height, and a
   * floor closes it. The lamps then shade a real cavity (the lit inner wall on one side, the far
   * wall and floor in the vessel's own shadow, `shade` deepening the tint toward the floor), so
   * the pieces read as thrown pots with something to look into rather than cut-outs.
   */
  const turned = (
    profile: (t: number) => number,
    h: number,
    segs: number,
    rings: number,
    tint: (t: number, up: number, th: number, rFrac: number) => [number, number, number],
    relief?: (t: number, th: number) => number,
    mouth?: { depth: number; wall: number; shade?: number },
  ) =>
    gridSurface(
      (u, v, out) => {
        // v 0 → 0.5 the side (bottom → top), 0.5 → 1 the top disc (rim → centre)
        const th = u * TAU;
        const side = v <= 0.5;
        if (mouth && !side) {
          const R = profile(1);
          const inset = 1 - mouth.wall;
          const s = (v - 0.5) * 2;
          const shade = mouth.shade ?? 0.45;
          if (s <= 0.18) {
            // the lip: the body colour rolls over the rim from the outside to the bore
            const q = s / 0.18;
            const rr = R * (1 - mouth.wall * q);
            const y = h + 0.5 * mouth.wall * R * Math.sin(Math.PI * q);
            out.position.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
            out.uv = [(th * rr) / 0.6, y / 0.6];
            out.color = tint(1, 0, th, 1);
          } else if (s <= 0.76) {
            // the inner wall: the outer profile inset by the wall, down to the floor
            const q = (s - 0.18) / 0.58;
            const t = 1 - mouth.depth * q;
            const rr = Math.max(0.15 * R, profile(t) * inset);
            const y = t * h;
            out.position.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
            out.uv = [(th * rr) / 0.6, 0.5 + y / 0.6];
            const c = tint(t, 1, th, 1);
            const d = 1 - shade * q;
            out.color = [c[0] * d, c[1] * d, c[2] * d];
          } else {
            // the floor
            const q = (s - 0.76) / 0.24;
            const t = 1 - mouth.depth;
            const rFrac = 1 - q;
            const rr = Math.max(0.15 * R, profile(t) * inset) * rFrac;
            const y = t * h;
            out.position.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
            out.uv = [(th * rr) / 0.6, 0.5 + rr / 0.6];
            const c = tint(t, 1, th, rFrac);
            const d = 1 - shade;
            out.color = [c[0] * d, c[1] * d, c[2] * d];
          }
          return;
        }
        const t = side ? v * 2 : 1;
        const rFrac = side ? 1 : 1 - (v - 0.5) * 2;
        const rr = (side ? profile(t) * (1 + (relief ? relief(t, th) : 0)) : profile(1) * rFrac);
        const y = side ? t * h : h + 0.006 * k * Math.sin((v - 0.5) * Math.PI);
        out.position.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
        out.uv = [(th * rr) / 0.6, side ? y / 0.6 : 0.5 + rr / 0.6];
        out.color = tint(t, side ? 0 : 1, th, rFrac);
      },
      { cols: segs, rows: rings, closedU: true },
    );
  /**
   * Wood tint with long grain (round 48): the grain lines darkened, the fibre between them
   * flecked; on an end disc, growth rings by the radius. `along` in metres along the piece.
   */
  const woodTint = (base: [number, number, number], along: number, th: number, up: number, rFrac: number, seed: number, lines = 9): [number, number, number] => {
    if (up) {
      const ring = 0.5 + 0.5 * Math.sin(rFrac * 46 + 2 * grainNoise.noise(rFrac * 4 + seed, th * 0.5));
      const s = 0.78 + 0.16 * ring;
      return [base[0] * s, base[1] * s, base[2] * s * 0.96];
    }
    const gr = woodGrain(grainNoise, along, th, lines, 0.6, seed);
    const fb = woodFibre(grainNoise, along, th, lines, seed);
    const s = (1 - 0.3 * gr) * (0.9 + 0.2 * fb);
    return [base[0] * s, base[1] * s * (1 - 0.04 * gr), base[2] * s * (1 - 0.08 * gr)];
  };
  let propCount = 0;
  {
    const propRng = rng.fork('props');
    const props: BufferGeometry[] = [];
    const shelfD = 0.26 * k;
    const BOARD: [number, number, number] = [0.46, 0.36, 0.26];
    /** a plank on two brackets, its back edge against the (concave) wall; returns its top */
    const shelf = (w0: number, w1: number, y: number) => {
      const wc = (w0 + w1) / 2;
      const d = Math.max(roomBackD(w0), roomBackD(wc), roomBackD(w1)) + shelfD / 2 + 0.01 * k;
      // round 48: chamfered boards with the grain running their length; the brackets' grain runs down
      const seed = w0 * 3.1;
      const board = softBox((w1 - w0) / 2, 0.0175 * k, shelfD / 2, 0.1, (x, y2, z) => woodTint(BOARD, x * (w1 - w0) * 0.5, Math.atan2(z, y2), 0, 1, seed, 7));
      board.applyMatrix4(basisMatrix(frame.door(wc, y, d), F));
      props.push(board);
      for (const w of [w0 + 0.12 * k, w1 - 0.12 * k]) {
        const bracket = softBox(0.02 * k, 0.08 * k, shelfD * 0.375, 0.12, (x, y2, z) => woodTint([0.34, 0.27, 0.2], y2 * 0.08 * k, Math.atan2(z, x), 0, 1, seed + w, 5));
        bracket.applyMatrix4(basisMatrix(frame.door(w, y - 0.1 * k, d - 0.03 * k), F));
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
    const place = (geo: BufferGeometry, w: number, top: { y: number; d: number }) => {
      geo.applyMatrix4(basisMatrix(frame.door(w, top.y, top.d + (propRng() - 0.5) * 0.06 * k), new Vector3(0, 1, 0)));
      props.push(geo);
      propCount++;
    };
    /**
     * Round 48: the KOKIRI POT — the village's clay: a round belly on a small foot, drawn in to
     * a short neck and flared to a rolled lip, throwing rings all the way up, the clay's tint
     * flecked and a painted band round the shoulder (dashes of a darker earth) with a pale
     * line under the lip. `squat` 0 a tall jar → 1 a round pot. Replaces round 13's plain
     * cylinders and squashed spheres.
     */
    const kokiriPot = (w: number, top: { y: number; d: number }, r: number, h: number, tint: [number, number, number], squat: number, seed: number) => {
      const bellyT = lerp(0.42, 0.5, squat);
      const waist = lerp(0.45, 0.5, squat);
      const profile = (t: number) => {
        const foot = 0.55 + 0.45 * smoothstep(0, 0.1, t);
        const belly = Math.exp(-Math.pow((t - bellyT) / lerp(0.34, 0.3, squat), 2));
        const body = waist + (1 - waist) * belly;
        const neck = 1 - lerp(0.3, 0.32, squat) * smoothstep(bellyT + 0.2, 0.86, t);
        const lip = 1 + 0.3 * smoothstep(0.88, 1, t);
        return r * Math.min(foot * 1.05, body) * neck * lip;
      };
      const g = turned(
        profile,
        h,
        16,
        22,
        (t, up, th) => {
          if (up) return [0.16, 0.12, 0.09]; // the dark mouth
          const fleck = 0.9 + 0.2 * (0.5 + 0.5 * grainNoise.noise(th * 2.5 + seed, t * 9));
          // the painted band: nine dashes round the shoulder; a pale line under the lip
          const bandT = bellyT + 0.16;
          const band = (1 - smoothstep(0.03, 0.045, Math.abs(t - bandT))) * (0.5 + 0.5 * Math.sign(Math.sin(th * 9 + t * 3)));
          const line = 1 - smoothstep(0.012, 0.02, Math.abs(t - 0.9));
          const s = fleck * (1 - 0.55 * band) * (1 + 0.18 * line);
          return [tint[0] * s, tint[1] * s * (1 - 0.1 * band), tint[2] * s * (1 - 0.15 * band)];
        },
        (t) => 0.012 * Math.sin(t * 70 + seed) * (1 - smoothstep(0.85, 1, t)),
        { depth: 0.5, wall: 0.22 },
      );
      g.rotateX(Math.PI / 2);
      place(g, w, top);
    };
    /** a jar: a taller Kokiri pot */
    const jar = (w: number, top: { y: number; d: number }, r: number, h: number, tint: [number, number, number]) => kokiriPot(w, top, r, h, tint, 0.2, w * 7);
    /** a round pot: a squat one */
    const roundPot = (w: number, top: { y: number; d: number }, r: number, tint: [number, number, number]) => kokiriPot(w, top, r, r * 1.5, tint, 1, w * 5 + 1);
    /** a bottle (glass): a rounded body drawn to a neck with a lip */
    const bottle = (w: number, top: { y: number; d: number }, r: number, h: number, tint: [number, number, number]) => {
      const g = turned(
        (t) => r * (0.7 + 0.3 * smoothstep(0, 0.1, t)) * (1 - 0.62 * smoothstep(0.55, 0.78, t)) * (1 + 0.14 * smoothstep(0.94, 1, t)),
        h,
        12,
        16,
        (t, up, th) => {
          const sheen = 0.85 + 0.3 * Math.pow(0.5 + 0.5 * Math.cos(th - 0.6), 4);
          return up ? [0.12, 0.14, 0.12] : [tint[0] * sheen, tint[1] * sheen, tint[2] * sheen * (1 + 0.1 * t)];
        },
        undefined,
        { depth: 0.28, wall: 0.35 },
      );
      g.rotateX(Math.PI / 2);
      place(g, w, top);
    };
    /** a wooden bowl, its grain across it */
    const bowl = (w: number, top: { y: number; d: number }, r: number, tint: [number, number, number]) => {
      const g = turned(
        (t) => r * (0.55 + 0.45 * Math.sqrt(t)) * (1 + 0.02 * Math.sin(t * 9)),
        r * 0.55,
        14,
        14,
        (t, up, th, rFrac) => woodTint([tint[0] * 0.75, tint[1] * 0.65, tint[2] * 0.55], t * r * 0.55, th, up, rFrac, w * 3, 7),
        undefined,
        { depth: 0.72, wall: 0.09, shade: 0.3 },
      );
      g.rotateX(Math.PI / 2);
      place(g, w, top);
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
    // Round 43 (structures-27): the sill is a HEWN BEAM, not a box — a squared log (a rounded-
    // rectangle section that relaxes to the tube's octagon at the ends, buried in the jambs) with
    // long grain running its length (woodGrain.ts: ±4 mm relief, the lines darkened in the tint),
    // a fine fibre octave, a foot-worn DIP across the doorway's middle where the top is polished
    // pale, and a second, smaller beam — the STEP — lying on it against the floor pad's riser, so
    // the pad is a wooden step up from the sill and not an open dark face.
    // grey-brown, weathered: the frame reads neutral in the reference (≈ (72, 78, 76)), so the
    // plank map's warmth is countered by a cool vertex tint
    const beamTint: [number, number, number] = [0.6, 0.62, 0.62];
    const hewnBeam = (w0: number, w1: number, y: number, d: number, halfD: number, halfH: number, seed: number, worn: number): BufferGeometry => {
      const from = frame.door(w0, y, d);
      const to = frame.door(w1, y, d);
      const length = w1 - w0;
      // the section is shaped in the beam's own (depth, height) frame from the point's direction
      // off the axis (the sweep's Frenet angle starts wherever three.js puts it)
      const up = new Vector3(0, 1, 0);
      const _pp = new Vector3();
      const geo = sweepTube(new LineCurve3(from, to), {
        radius: () => halfH,
        tubularSegments: hero ? 40 : 16,
        radialSegments: 8,
        uvMetres: 0.8,
        displace: (t, ang, pos) => {
          // the point's direction from the axis, in the (depth, height) frame
          _pp.copy(pos).sub(from).addScaledVector(Rt, -(pos.x - from.x) * Rt.x - (pos.z - from.z) * Rt.z);
          const hy = _pp.dot(up);
          const hd = _pp.dot(F);
          const rr = Math.hypot(hy, hd) || 1;
          const cy = hy / rr;
          const cd = hd / rr;
          // rounded rectangle (p-norm 5) with the given half-sizes; the ends relax to the octagon
          const p = 5;
          const shape = 1 / Math.pow(Math.pow(Math.abs(cd) / halfD, p) + Math.pow(Math.abs(cy) / halfH, p), 1 / p);
          // (the ends relax to a round of the beam's height, so the cap discs stay inside the jambs)
          const endRelax = smoothstep(0, 0.08, t) * smoothstep(1, 0.92, t);
          const target = lerp(halfH, shape, endRelax);
          const grain = woodGrain(noise, t * length, ang, 14, 0.5, seed) - 0.5;
          const fibre = woodFibre(noise, t * length, ang, 14, seed) - 0.5;
          // the foot-worn dip: the top face sinks toward the doorway's middle
          const dip = worn * Math.max(0, cy) * Math.exp(-(((t - 0.5) / 0.22) ** 2));
          return target - halfH + grain * 0.004 * k * endRelax + fibre * 0.0015 * k - dip;
        },
        color: (t, ang) => {
          const grain = woodGrain(noise, t * length, ang, 14, 0.5, seed);
          const fibre = woodFibre(noise, t * length, ang, 14, seed);
          // the trodden top polished pale, the grain lines dark, the underside damp and dark
          const s = Math.sin(ang);
          const polish = worn > 0 ? 0.45 * Math.exp(-(((t - 0.5) / 0.3) ** 2)) : 0;
          const g = (0.78 + 0.46 * grain) * (0.9 + 0.2 * fibre) * (1 + polish) * (1 - 0.25 * Math.max(0, -s));
          return [beamTint[0] * g, beamTint[1] * g, beamTint[2] * g * (1 - 0.06 * polish)];
        },
        capStart: true,
        capEnd: true,
      });
      return geo;
    };
    // the sill: top at sill + 0.03 as before, 0.6 k deep, its ends 0.25 k inside the jambs
    woodParts.push(hewnBeam(doorW0 - 0.25 * k, doorW1 + 0.25 * k, sill - 0.04, dBack + 0.02, 0.3 * k, 0.07 * k, 3, 0.012 * k));
    // the step: on the sill's back, against the riser, its top at the floor pad's level
    woodParts.push(hewnBeam(doorW0 - 0.08 * k, doorW1 + 0.08 * k, (sill + 0.03 + roomFloorY) / 2, roomFront + 0.06 + 0.13 * k, 0.13 * k, (roomFloorY - sill - 0.03) / 2, 7, 0.008 * k));
  }
  const woodMesh = new Mesh(merge(woodParts), mats.wood);
  woodMesh.name = 'door-frame';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // ---- stone threshold slab at path level in front of the sill (sheet 04: the door opens on
  // the flagstones) — an irregular worn slab, grey-brown like the path stones ----
  /** the slab's footprint (door space) and top, for the round-43 moss doormat */
  let thresholdSlab: { w: number; d: number; cw: number; cd: number; top: number } | null = null;
  {
    // Round 44 (structures-28): a WORN STONE SLAB, not a nine-sided grey cylinder. Survey-1
    // crop 26: the round-8 slab read as an over-bright white plank with a hard polygonal outline
    // floating over the bark step, its moss doormat as 2-D confetti on it. Now: the flagstones'
    // stone (materials.ts `stone`, worn_rock_natural_01) on a polar grid — the top dished a
    // centimetre along the walked line and undulating ± 8 mm, the rim rounded and CHIPPED (the
    // edge drops up to 2.5 cm in bites), the sides battered out a little and sunk 12 cm into the
    // step, the outline the round-8 ellipse with the same wander. Tints: a pale worn top brightest
    // on the walked line, the rim and sides damp and dark, a moss film creeping up the sides'
    // foot. Same `thresholdSlab` footprint and top, so the round-43 doormat stands where it did.
    const { w: slabW, d: slabD, cw: slabCW, cd: slabCD, top: slabTop } = slabFootprint;
    const slabC = frame.door(slabCW, 0, slabCD);
    thresholdSlab = { w: slabW, d: slabD, cw: slabCW, cd: slabCD, top: slabTop };
    const slabDepth = 0.12 * k;
    const outline = (th: number) => 1 + 0.12 * noise.noise(Math.cos(th) * slabW * 3.1 + 7, Math.sin(th) * slabD * 3.1);
    // v runs 0 → 0.5 over the top (centre → rim, f) and 0.5 → 1 down the sides (g). The mapping
    // is CONTINUOUS in v: gridSurface takes its normals from central differences in u and v,
    // and a per-row `Math.round(v * 6)` (the first cut of this slab) made the surface piecewise
    // constant in v — every normal fell back to +Y, `faceTowards` saw nothing to flip, and the
    // top's winding faced DOWN: the stone's top was back-face culled and the door showed the
    // hidden moss film and the porch earth through it (w31-house-d read as a dark green mat).
    const slab = gridSurface(
      (u, v, out) => {
        const th = u * TAU;
        const f = Math.min(1, v * 2);
        const g = Math.max(0, v * 2 - 1);
        const top = v <= 0.5;
        const wob = outline(th);
        // the sides batter out 6 mm at the base. The centre ring is r = 0 (the 31 vertices
        // coincide, the first ring's triangles are slivers): a floor of 0.04 left a hole 3 × 2 cm
        // open in the middle of the top
        const rr = f * wob * (1 + 0.012 * g);
        const w = slabCW + Math.cos(th) * slabW * rr;
        const d = slabCD + Math.sin(th) * slabD * rr;
        // the top: a worn undulation, dished along the walked line through the door's middle,
        // rounded then chipped at the rim
        const walk = smoothstep(0.55 * k, 0.12 * k, Math.abs(w - slabCW));
        const wear = 0.008 * noise.noise(w * 6.5 + 3, d * 6.5) - 0.012 * walk * (1 - f * f);
        const chip = 0.025 * smoothstep(0.45, 0.85, noise.noise(th * 2.1 + 11, 2.5)) * smoothstep(0.75, 1, f);
        const round = 0.006 * smoothstep(0.8, 1, f);
        const topY = slabTop + wear - chip - round;
        const y = topY - slabDepth * g;
        frame.door(w, y, d, out.position);
        out.uv = top ? [w / 1.2, d / 1.2] : [(th * (slabW + slabD)) / 1.2, y / 1.2];
        // tints: pale worn top (palest on the walked line), damp rim, dark sides with a moss foot
        const mottle = 0.9 + 0.2 * noise.noise(w * 9 + 1, d * 9 + 5);
        let t = top ? lerp(0.78, 1.0, walk) * lerp(1, 0.72, smoothstep(0.82, 1, f)) * mottle : lerp(0.55, 0.36, g) * mottle;
        t *= 1 - 0.5 * clamp(chip / 0.025, 0, 1);
        const mossFoot = top ? 0 : smoothstep(0.5, 1, g) * smoothstep(0.35, 0.65, noise.noise(th * 3 + 2, 7));
        out.color = [lerp(t, 0.12, mossFoot), lerp(t * 0.98, 0.2, mossFoot), lerp(t * 0.92, 0.05, mossFoot)];
      },
      { cols: 30, rows: 7, closedU: true },
    );
    faceTowards(slab, (p, o) => o.copy(p).sub(slabC).multiplyScalar(4).add(p).setY(p.y + 1.5));
    // the centre ring's 31 coincident vertices have no u-derivative: gridSurface gave them its
    // +Y fallback, and the flip faceTowards applies to the whole grid (the door frame's w × d
    // is left-handed about y, so the analytic normals came out inside-out) turned them −Y — a
    // dark dimple over the inner third of the top. They take ring 1's mean normal.
    {
      const nrm = slab.attributes.normal;
      const nu = 31;
      const mean = new Vector3();
      for (let i = 0; i < nu; i++) mean.add(_bd.fromBufferAttribute(nrm, nu + i));
      mean.normalize();
      for (let i = 0; i < nu; i++) nrm.setXYZ(i, mean.x, mean.y, mean.z);
    }
    const slabMesh = new Mesh(slab, mats.stone);
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
  const roomLanternMat = indoorFog(mats.lantern, doorPlanePoint, F, 'lantern');
  materials.push(roomLanternMat);
  // (`turned` — the lathe — is defined with the shelves above; round 48 moved it up and gave it grain)
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
    // low table under the candle. Round 46 (structures-29, survey-2 #16 "untextured primitive
    // props"): a STUMP TABLE — a thick round top with a rolled edge on a waisted trunk leg, and a
    // low round STOOL beside it — rounded turned forms in the room material (the lamps' pools and
    // the candle light them; the doorway fog clamp keeps them in the room), in place of the
    // round-12 slab-on-a-block boxes in the plain dark plank material.
    // (the table stands on the floor pad; its top at sill + 0.52 k, under the candle at sill + 0.55 k)
    const tableC = frame.door(doorW0 + 0.7 * k, roomFloorY, tableD);
    const tableTopR = 0.34 * k;
    const tableH = sill + 0.52 * k - roomFloorY;
    const legR = 0.13 * k;
    const table = turned(
      (t) => {
        // the leg waists then flares into the top's rolled edge
        const leg = legR * (1 + 0.35 * Math.pow(1 - t, 2) * smoothstep(0.3, 0, t)) * (1 - 0.12 * Math.sin(t * Math.PI));
        const top = tableTopR * Math.sqrt(Math.max(0, 1 - Math.pow((1 - t) / 0.16, 2)));
        return Math.max(leg, top) * (1 + 0.02 * noise.noise(t * 9, 3));
      },
      tableH,
      hero ? 28 : 20,
      hero ? 22 : 18,
      // round 48: the stump's bark-side grain runs up the leg, the top shows its growth rings
      (t, up, th, rFrac) => {
        const s = up ? 0.62 : lerp(0.3, 0.5, t);
        return woodTint([s * 1.05, s * 0.86, s * 0.66], t * tableH, th, up, rFrac, 11, 12);
      },
      hero ? (t, th) => 0.012 * (woodGrain(grainNoise, t * tableH, th, 12, 0.6, 11) - 0.5) * (1 - smoothstep(0.8, 0.92, t)) : undefined,
    );
    table.translate(tableC.x, tableC.y, tableC.z);
    faceTowards(table, (p, o) => o.copy(p).sub(tableC).multiplyScalar(3).add(p).setY(p.y + 0.4));
    const stoolC = frame.door(doorW0 + 0.08 * k, roomFloorY, tableD + 0.25 * k);
    const stool = turned(
      (t) => 0.16 * k * (1 - 0.18 * Math.sin(t * Math.PI)) * (1 + 0.08 * smoothstep(0.85, 1, t)),
      0.3 * k,
      hero ? 20 : 14,
      hero ? 14 : 10,
      (t, up, th, rFrac) => {
        const s = up ? 0.55 : lerp(0.28, 0.45, t);
        return woodTint([s * 1.0, s * 0.84, s * 0.64], t * 0.3 * k, th, up, rFrac, 17, 9);
      },
    );
    stool.translate(stoolC.x, stoolC.y, stoolC.z);
    faceTowards(stool, (p, o) => o.copy(p).sub(stoolC).multiplyScalar(3).add(p).setY(p.y + 0.3));
    // (round 12's single dark shelf up by the lamp is replaced by round 13's stocked shelves in
    // the room material, see `interior-props`)
    // ember ring: a low stone kerb round the glow (round 48: field stones — the ring lumped by a
    // noise round it, each stone a little different grey)
    // Round 52 (fable-3, owner #11 "the detail inside the nook"): in the hero house the kerb is no
    // longer one torus — a smooth doughnut at arm's length however it is lumped — but a ring of
    // SEPARATE field stones, each a lumpy flattened ellipsoid of its own size and grey, sunk a third
    // into the floor with gaps between, soot-darkened on the faces toward the fire; inside them an
    // ash bed and three charred sticks. (Round 52b: the other furnished house too — the plateau is a
    // destination (owner #14) and its doorway shows the hearth — at eight coarser stones, two
    // sticks, five embers; the torus is gone.)
    let kerb: BufferGeometry;
    const hearthFloorY = hearthPos.y - 0.2 * k;
    {
      const hRng = rng.fork('hearth52');
      const stones: BufferGeometry[] = [];
      const nStones = hero ? 10 : 8;
      const _rad = new Vector3();
      const _nrm = new Vector3();
      for (let i = 0; i < nStones; i++) {
        const a = (i / nStones) * TAU + hRng.range(-0.11, 0.11);
        const rx = k * hRng.range(0.05, 0.086);
        const ry = rx * hRng.range(0.5, 0.68);
        const rz = rx * hRng.range(0.72, 1.0);
        const stone = new SphereGeometry(1, hero ? 12 : 9, hero ? 8 : 6);
        const sp = stone.attributes.position;
        const sv = new Vector3();
        for (let j = 0; j < sp.count; j++) {
          sv.set(sp.getX(j), sp.getY(j), sp.getZ(j));
          const lump = 1 + 0.16 * grainNoise.noise(sv.x * 1.7 + i * 5.3, sv.y * 1.7 + sv.z * 1.3 + i * 2.1);
          sp.setXYZ(j, sv.x * rx * lump, sv.y * ry * lump, sv.z * rz * lump);
        }
        stone.rotateX(hRng.range(-0.14, 0.14));
        stone.rotateY(a + hRng.range(-0.5, 0.5));
        const ring = (0.2 + hRng.range(-0.012, 0.012)) * k;
        const cx = hearthPos.x + Math.cos(a) * ring;
        const cz = hearthPos.z + Math.sin(a) * ring;
        stone.translate(cx, hearthFloorY + ry * 0.64, cz);
        stone.computeVertexNormals();
        const grey = 0.27 + 0.17 * hRng();
        const warm = hRng.range(-0.02, 0.035);
        const pos = stone.attributes.position;
        const nrm = stone.attributes.normal;
        setColorAttribute(stone, (j) => {
          _rad.set(pos.getX(j) - hearthPos.x, 0, pos.getZ(j) - hearthPos.z).normalize();
          _nrm.set(nrm.getX(j), nrm.getY(j), nrm.getZ(j));
          const soot = 1 - 0.42 * Math.max(0, -_nrm.dot(_rad));
          const fleck = 0.92 + 0.16 * (0.5 + 0.5 * grainNoise.noise(pos.getX(j) * 40, pos.getZ(j) * 40 + pos.getY(j) * 30));
          const g = grey * soot * fleck;
          return [g * (1 + warm), g, g * (1 - warm * 0.5)];
        });
        stones.push(stone);
      }
      // the ash bed: paler at the middle where the embers lie, darkening to the stones
      const ashR = 0.165 * k;
      const ash = new CircleGeometry(ashR, 14);
      ash.rotateX(-Math.PI / 2);
      ash.translate(hearthPos.x, hearthFloorY + 0.012 * k, hearthPos.z);
      const ap = ash.attributes.position;
      setColorAttribute(ash, (j) => {
        const r = Math.hypot(ap.getX(j) - hearthPos.x, ap.getZ(j) - hearthPos.z) / ashR;
        const c = 0.1 + 0.09 * (1 - r) * (0.85 + 0.3 * grainNoise.noise(ap.getX(j) * 25 + 7, ap.getZ(j) * 25));
        return [c * 1.05, c, c * 0.94];
      });
      // charred sticks lying across the ash, black with a little red left at the ends
      const sticks: BufferGeometry[] = [];
      for (let i = 0; i < (hero ? 3 : 2); i++) {
        const len = k * hRng.range(0.16, 0.24);
        const r = k * hRng.range(0.011, 0.016);
        const stick = new CylinderGeometry(r * 0.8, r, len, 6, 1);
        stick.rotateZ(Math.PI / 2);
        stick.rotateX(hRng.range(-0.12, 0.12));
        stick.rotateY(hRng.range(0, Math.PI));
        const off = k * hRng.range(0, 0.05);
        const oa = hRng.range(0, TAU);
        stick.translate(hearthPos.x + Math.cos(oa) * off, hearthFloorY + 0.012 * k + r + i * 0.009 * k, hearthPos.z + Math.sin(oa) * off);
        const cp = stick.attributes.position;
        setColorAttribute(stick, (j) => {
          const d = Math.min(1, Math.hypot(cp.getX(j) - hearthPos.x, cp.getZ(j) - hearthPos.z) / (0.12 * k));
          // charcoal: near-black, a breath of red toward the ends, grey ash dust on the upper side
          const ch = 0.022 + 0.02 * d;
          const dust = 0.5 + 0.5 * Math.max(0, cp.getY(j) - (hearthFloorY + 0.012 * k + r)) / (r + 1e-6);
          return [ch * 1.4 + 0.03 * dust, ch * 0.9 + 0.03 * dust, ch * 0.8 + 0.03 * dust];
        });
        sticks.push(stick);
      }
      kerb = merge([...stones, ash, ...sticks]);
    }
    const furnitureGeo = merge([table, stool, kerb]);
    {
      const pos = furnitureGeo.attributes.position;
      const _g = new Vector3();
      setFloatAttribute(furnitureGeo, 'aGlow', (i) => glowOf(_g.set(pos.getX(i), pos.getY(i), pos.getZ(i))));
    }
    const furnitureMesh = new Mesh(furnitureGeo, propsMat);
    furnitureMesh.name = 'door-lamp-cord';
    furnitureMesh.receiveShadow = true;
    group.add(furnitureMesh);
    // the embers themselves (dim orange) and a small soft pink-amber halo facing the door — kept
    // small so the doorway as a whole stays neutral (reference box saturation ≈ 0.1)
    // (round 52: seven small lumps (five in the other house) scattered among the char — the same
    // emissive, about the same lit area as the one squashed sphere they replace, so the doorway
    // keeps its level)
    let embers: BufferGeometry;
    {
      const eRng = rng.fork('embers52');
      const lumps: BufferGeometry[] = [];
      for (let i = 0; i < (hero ? 7 : 5); i++) {
        const lump = new SphereGeometry(k * eRng.range(0.014, 0.026), 6, 4);
        lump.scale(1, 0.55, 1);
        const a = eRng.range(0, TAU);
        const d = k * eRng.range(0, 0.075);
        lump.translate(hearthPos.x + Math.cos(a) * d, hearthFloorY + 0.022 * k, hearthPos.z + Math.sin(a) * d);
        lumps.push(lump);
      }
      embers = merge(lumps);
    }
    const emberMesh = new Mesh(embers, mats.hearth);
    emberMesh.name = 'door-embers';
    group.add(emberMesh);
    const halo = new PlaneGeometry(0.22 * k, 0.16 * k);
    halo.applyMatrix4(basisMatrix(hearthPos.clone().addScaledVector(F, 0.05), F));
    const haloMesh = new Mesh(halo, mats.ember);
    haloMesh.name = 'door-ember-glow';
    group.add(haloMesh);
  }
  // ---- Round 47 (structures-30, owner review 2026-09-19 #11 "the detail inside the little nook
  // of the tree needs to be a lot higher"): the room FURNISHED, readable at 1–3 m from the
  // threshold (sn-house-door / the new sn-room-inside pose) while the doorway keeps its dark
  // level from the plaza (everything below the sill line from B / D / A, in the room material's
  // fog clamp, lit only by the lamps' pools):
  //  - a BED against the back wall on the left, under the shelves: rounded log posts with knobs,
  //    log rails, a stuffed mattress, a striped blanket folded over the foot, a pillow;
  //  - an oval BRAIDED RUG on the floor between the door and the table;
  //  - a HANGING PLANT in a clay pot on three cords from the ceiling right of the door, trailing
  //    heart-leaf strands; a potted plant on the floor by the right jamb; dried HERB BUNCHES
  //    hanging by the hearth;
  //  - on the table a wooden bowl of fruit and a cup; by the hearth a big-bellied jug and a
  //    stack of firewood.
  // The pieces are turned / swept / puffed forms with vertex tints in the props material (they
  // fold into the shelves' draw); the plants are a foliage builder of their own on fog-clamped
  // clones of the leaf and vine materials (+2 draws, no shadow casters). Own forks throughout.
  const furnish47 = { bed: false, rug: false, hangingPlants: 0, herbBunches: 0, pieces: 0, triangles: 0, plantLeaves: 0 };
  if (hero) {
    const fRng = rng.fork('room47');
    const fNoise = new Noise2D(`${ctx.config.seed}/structures/house/${def.id}/room47`);
    const parts: BufferGeometry[] = [];
    const UPV = new Vector3(0, 1, 0);
    const sgnPow = (x: number, p: number) => Math.sign(x) * Math.pow(Math.abs(x), p);
    /** a rounded box (superellipsoid, exponent `e` — 1 a sphere, 0.3 a cushion) centred on `c`, half-sizes along Rt / up / F */
    const puff = (c: Vector3, sx: number, sy: number, sz: number, e: number, tint: (u: number, v: number, p: Vector3) => [number, number, number], ripple = 0) => {
      const g = gridSurface(
        (u, v, out) => {
          const th = u * TAU;
          const ph = (v - 0.5) * Math.PI;
          const cp = Math.cos(ph);
          const cx = sgnPow(cp, e) * sgnPow(Math.cos(th), e);
          const cz = sgnPow(cp, e) * sgnPow(Math.sin(th), e);
          const cy = sgnPow(Math.sin(ph), e) * (1 + ripple * fNoise.noise(u * 5 + c.x, v * 3 + c.z));
          out.position.copy(c).addScaledVector(Rt, cx * sx).addScaledVector(UPV, cy * sy).addScaledVector(F, cz * sz);
          out.uv = [u * 2, v];
          out.color = tint(u, v, out.position);
        },
        { cols: 22, rows: 13, closedU: true },
      );
      faceTowards(g, (p, o) => o.copy(p).sub(c).multiplyScalar(3).add(p));
      return g;
    };
    /** a short log between two door-space points (round 48: long grain along it, darkened in the tint) */
    const log = (a: Vector3, b: Vector3, r0: number, r1: number, tint: [number, number, number], pale = false) => {
      const len = a.distanceTo(b);
      const seed = a.x * 1.7 + a.z * 0.9;
      return sweepTube(new LineCurve3(a, b), {
        radius: (t) => lerp(r0, r1, t) * (1 + 0.05 * Math.sin(t * 7 + a.x)),
        tubularSegments: 8,
        radialSegments: 11,
        uvMetres: 0.5,
        capEnd: true,
        capStart: true,
        color: (t, ang) => {
          const end = pale && (t < 0.02 || t > 0.98);
          const k2 = 0.85 + 0.15 * Math.max(0, Math.cos(ang));
          if (end) return [0.8, 0.7, 0.5];
          const g = woodTint(tint, t * len, ang, 0, 1, seed, 8);
          return [g[0] * k2, g[1] * k2, g[2] * k2];
        },
      });
    };
    const place = (g: BufferGeometry, at: Vector3, axis: Vector3 = UPV) => {
      g.applyMatrix4(basisMatrix(at, axis));
      return g;
    };
    /** stands a lathe (built along +y) upright at a door-space position: basisMatrix maps local +z → axis, so the lathe is turned onto +z first */
    const stand = (g: BufferGeometry, w: number, y: number, d: number) => {
      g.rotateX(Math.PI / 2);
      return place(g, frame.door(w, y, d));
    };
    const LOG_TINT: [number, number, number] = [0.55, 0.42, 0.28];

    // ---- the bed ----
    {
      const b = bedRect47;
      const railY = 0.3 * k;
      const postR = 0.06 * k;
      const corners: [number, number, boolean][] = [
        [b.w0 + postR, b.d0 + postR, true],
        [b.w1 - postR, b.d0 + postR, true],
        [b.w0 + postR, b.d1 - postR, false],
        [b.w1 - postR, b.d1 - postR, false],
      ];
      for (const [w, d, head] of corners) {
        const h = head ? 0.78 * k : 0.5 * k;
        parts.push(log(frame.door(w, roomFloorY, d), frame.door(w, roomFloorY + h, d), postR * 1.1, postR * 0.85, LOG_TINT));
        const knob = new SphereGeometry(postR * 1.25, 10, 8);
        knob.translate(0, 0, 0);
        setColorAttribute(knob, [LOG_TINT[0] * 1.1, LOG_TINT[1] * 1.1, LOG_TINT[2] * 1.1]);
        parts.push(place(knob, frame.door(w, roomFloorY + h + postR * 0.6, d)));
        furnish47.pieces++;
      }
      // rails: two long (along w), two short (along d), a little sag in the long ones
      for (const d of [b.d0 + postR, b.d1 - postR]) parts.push(log(frame.door(b.w0 + postR, roomFloorY + railY, d), frame.door(b.w1 - postR, roomFloorY + railY, d), 0.045 * k, 0.045 * k, LOG_TINT));
      for (const w of [b.w0 + postR, b.w1 - postR]) parts.push(log(frame.door(w, roomFloorY + railY, b.d0 + postR), frame.door(w, roomFloorY + railY, b.d1 - postR), 0.045 * k, 0.045 * k, LOG_TINT));
      // a headboard of three rounded slats between the head posts
      for (let i = 0; i < 3; i++) {
        const y = roomFloorY + railY + (0.12 + i * 0.13) * k;
        parts.push(log(frame.door(b.w0 + postR * 1.6, y, b.d0 + postR), frame.door(b.w1 - postR * 1.6, y, b.d0 + postR), 0.028 * k, 0.028 * k, [LOG_TINT[0] * 0.9, LOG_TINT[1] * 0.9, LOG_TINT[2] * 0.9]));
      }
      // mattress: a cushion on the rails, its ticking pale with a faint stripe
      const mw = (b.w1 - b.w0) / 2 - postR * 1.5;
      const md = (b.d1 - b.d0) / 2 - postR * 1.2;
      const mC = frame.door((b.w0 + b.w1) / 2, roomFloorY + railY + 0.1 * k, (b.d0 + b.d1) / 2);
      parts.push(
        puff(mC, mw, 0.11 * k, md, 0.32, (u, v, p) => {
          const along = (p.x - mC.x) * Rt.x + (p.z - mC.z) * Rt.z;
          const stripe = 0.92 + 0.08 * Math.sin(along * 34);
          const top = 0.85 + 0.15 * smoothstep(0.3, 0.6, v);
          return [0.88 * stripe * top, 0.8 * stripe * top, 0.62 * stripe * top];
        }, 0.03),
      );
      // blanket folded over the foot half: green with rust stripes, a soft ripple
      const bC = frame.door((b.w0 + b.w1) / 2 + mw * 0.42, roomFloorY + railY + 0.215 * k, (b.d0 + b.d1) / 2);
      parts.push(
        puff(bC, mw * 0.6, 0.035 * k, md * 1.06, 0.25, (u, v, p) => {
          const along = (p.x - bC.x) * Rt.x + (p.z - bC.z) * Rt.z;
          const s = smoothstep(0.3, 0.7, 0.5 + 0.5 * Math.sin(along * 21 + 1));
          return [lerp(0.36, 0.78, s), lerp(0.5, 0.4, s), lerp(0.27, 0.24, s)];
        }, 0.35),
      );
      // pillow at the head (the left end)
      const pC = frame.door(b.w0 + postR * 1.5 + 0.24 * k, roomFloorY + railY + 0.26 * k, (b.d0 + b.d1) / 2);
      parts.push(puff(pC, 0.22 * k, 0.065 * k, md * 0.85, 0.3, () => [0.95, 0.9, 0.74], 0.12));
      furnish47.bed = true;
      furnish47.pieces += 3;
    }

    // ---- the rug: an oval braided rug, concentric bands, a slightly wavy edge ----
    // Round 48 (structures-31, #11 "the rug a flat concentric decal"): the braid is a TEXTURE
    // now (`braidedRugTexture` — plaited stitches in the three tones, one band per third of the
    // tile), tiled 6.6 bands across the oval's radius and 40 stitch-pairs round it, on a material
    // of the rug's own (+1 draw, indoors only); the surface carries the bands' ridges (each band
    // a little proud at its middle) so the lamps rake across them. The vertex colour keeps the
    // wear toward the edges only.
    {
      const r = rugC47;
      const bandW = 0.085 * k;
      const bands = ((r.rw + r.rd) * 0.5) / bandW;
      const rug = gridSurface(
        (u, v, out) => {
          const th = u * TAU;
          const wob = 1 + 0.03 * fNoise.noise(Math.cos(th) * 3 + 11, Math.sin(th) * 3 + 4);
          const rw = r.rw * v * wob;
          const rd = r.rd * v * wob;
          const bandPhase = v * bands;
          const ridge = 0.5 + 0.5 * Math.cos((bandPhase - 0.5) * TAU);
          const lift = 0.012 * k * (1 - Math.pow(v, 8)) + 0.003 * k * ridge + 0.001 * k * Math.sin(th * 80);
          frame.door(r.w + Math.cos(th) * rw, roomFloorY + lift, r.d + Math.sin(th) * rd, out.position);
          out.uv = [u * 40, bandPhase / 3];
          const worn = 1 - 0.22 * smoothstep(0.5, 1, v) * (0.5 + 0.5 * fNoise.noise(th * 2, v * 5 + 3));
          out.color = [worn, worn, worn];
        },
        { cols: 96, rows: 34, closedU: true },
      );
      faceTowards(rug, (p, o) => o.set(p.x, p.y + 2, p.z));
      {
        const pos = rug.attributes.position;
        const _g = new Vector3();
        setFloatAttribute(rug, 'aGlow', (i) => glowOf(_g.set(pos.getX(i), pos.getY(i), pos.getZ(i))));
      }
      const rugTex = braidedRugTexture(Math.floor(hash2(def.position[0], def.position[2]) * 1000));
      const rugMat = indoorFog(roomMaterial(mats, 0xb8b0a4, false, rugTex), doorPlanePoint, F, 'rug');
      rugMat.normalScale.set(0.15, 0.15);
      materials.push(rugMat, rugTex);
      const rugMesh = new Mesh(rug, rugMat);
      rugMesh.name = 'interior-rug';
      rugMesh.receiveShadow = true;
      group.add(rugMesh);
      furnish47.triangles += Math.floor((rug.index ? rug.index.count : rug.attributes.position.count) / 3);
      furnish47.rug = true;
      furnish47.pieces++;
    }

    // ---- table top: a wooden bowl of fruit and a cup beside the candle ----
    {
      const topY = sill + 0.52 * k + 0.006 * k;
      const bowlW = tableW47 + 0.15 * k;
      const bowlD = tableD47 - 0.1 * k;
      // (round 48: the bowl and the cup turned with their grain; the fruit softened by a wobble)
      const bowl = turned(
        (t) => 0.11 * k * (0.5 + 0.5 * Math.sqrt(t)) * (1 + 0.02 * Math.sin(t * 9)),
        0.06 * k,
        18,
        14,
        (t, up, th, rFrac) => woodTint(up ? [0.6, 0.48, 0.32] : [0.5 + 0.1 * t, 0.4 + 0.08 * t, 0.26], t * 0.06 * k, th, up, rFrac, 23, 7),
        undefined,
        { depth: 0.7, wall: 0.09, shade: 0.3 },
      );
      parts.push(stand(bowl, bowlW, topY, bowlD));
      const fruit: [number, number, [number, number, number]][] = [
        [-0.035, 0.02, [0.9, 0.28, 0.18]],
        [0.03, 0.03, [0.95, 0.72, 0.22]],
        [0.0, -0.04, [0.55, 0.78, 0.28]],
      ];
      for (const [dw, dd, tint] of fruit) {
        const f = new SphereGeometry(0.034 * k, 12, 9);
        {
          const fp = f.attributes.position;
          const fv = new Vector3();
          for (let i = 0; i < fp.count; i++) {
            fv.set(fp.getX(i), fp.getY(i), fp.getZ(i));
            const wob = 1 + 0.06 * fNoise.noise(fv.x * 40 + dw * 90, fv.y * 40 + fv.z * 30) - 0.08 * Math.pow(Math.max(0, fv.y / (0.034 * k)), 6);
            fp.setXYZ(i, fv.x * wob, fv.y * wob, fv.z * wob);
          }
          f.computeVertexNormals();
        }
        setColorAttribute(f, tint);
        {
          const fc = f.attributes.color;
          const fp = f.attributes.position;
          for (let i = 0; i < fc.count; i++) {
            const blush = 0.85 + 0.25 * (0.5 + 0.5 * fNoise.noise(fp.getX(i) * 60 + dd * 50, fp.getZ(i) * 60));
            fc.setXYZ(i, tint[0] * blush, tint[1] * blush * (0.9 + 0.1 * blush), tint[2] * blush);
          }
        }
        parts.push(place(f, frame.door(bowlW + dw * k, topY + 0.05 * k, bowlD + dd * k)));
      }
      const cup = turned(
        (t) => 0.038 * k * (0.85 + 0.15 * t) * (1 + 0.05 * smoothstep(0.92, 1, t)),
        0.09 * k,
        14,
        12,
        (t, up, th, rFrac) => woodTint(up ? [0.45, 0.55, 0.4] : [0.42, 0.5, 0.36], t * 0.09 * k, th, up, rFrac, 29, 6),
        undefined,
        { depth: 0.8, wall: 0.14, shade: 0.3 },
      );
      parts.push(stand(cup, tableW47 - 0.17 * k, topY, tableD47 + 0.1 * k));
      furnish47.pieces += 3;
    }

    // ---- by the hearth: a big-bellied jug, firewood ----
    {
      // (round 48: Kokiri clay — throwing rings up the belly, the tint flecked, a dark painted
      // band of dashes round the shoulder, the glaze's sheen toward the lamp side)
      const jug = turned(
        (t) => jug47.r * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.05))) * (1 - 0.4 * smoothstep(0.72, 0.92, t)) + jug47.r * 0.32 * smoothstep(0.9, 1, t),
        0.42 * k,
        24,
        28,
        (t, up, th) => {
          if (up) return [0.25, 0.2, 0.15];
          const glaze = 0.6 + 0.35 * smoothstep(0.3, 0.6, t);
          const fleck = 0.9 + 0.2 * (0.5 + 0.5 * fNoise.noise(th * 2.5 + 3, t * 9));
          const band = (1 - smoothstep(0.03, 0.05, Math.abs(t - 0.62))) * (0.5 + 0.5 * Math.sign(Math.sin(th * 11 + t * 3)));
          const sheen = 1 + 0.12 * Math.pow(0.5 + 0.5 * Math.cos(th - 2.4), 3);
          const s = glaze * fleck * sheen * (1 - 0.5 * band);
          return [0.85 * s, 0.5 * s * (1 - 0.1 * band), 0.34 * s * (1 - 0.15 * band)];
        },
        (t) => 0.012 * Math.sin(t * 60) * (1 - smoothstep(0.85, 1, t)),
        { depth: 0.42, wall: 0.3 },
      );
      parts.push(stand(jug, jug47.w, roomFloorY, jug47.d));
      const woodW = doorW1 + 0.05 * k;
      const woodD = roomBackD(woodW) + 0.28 * k;
      const stack: [number, number][] = [
        [-0.055, 0],
        [0.055, 0],
        [0, 0.09],
      ];
      for (const [dd, dy] of stack) {
        const a = frame.door(woodW - 0.18 * k, roomFloorY + (0.05 + dy) * k, woodD + dd * k);
        const bpt = frame.door(woodW + 0.18 * k, roomFloorY + (0.05 + dy) * k, woodD + dd * k + (fRng() - 0.5) * 0.03 * k);
        parts.push(log(a, bpt, 0.05 * k, 0.045 * k, [0.42, 0.33, 0.24], true));
      }
      furnish47.pieces += 4;
      // Round 52 (fable-3, squad lane 9 "signs of use"): a KINDLING BASKET beside the firewood — a woven
      // straw basket (courses ridged, over/under weave in the tint, a darker binding at the rim, a real
      // mouth) with six split sticks standing in it at their own leans. Its own fork, so the plants'
      // rolls after it are untouched. It stands in front of the stack (the room ends 0.2 k past the
      // door's right edge, so nothing fits beside the wood) — visible from the threshold, right of the
      // hearth, clear of the kerb's stones by a hand.
      if (hero) {
        const bRng = fRng.fork('kindling52');
        const bW = woodW + 0.02 * k;
        const bD = woodD + 0.27 * k;
        const bR = 0.125 * k;
        const bH = 0.2 * k;
        const straw: [number, number, number] = [0.74, 0.6, 0.36];
        const basket = turned(
          (t) => bR * (0.8 + 0.2 * t),
          bH,
          20,
          14,
          (t, up, th) => {
            const course = Math.floor(t * 12);
            const weave = 0.5 + 0.5 * Math.sign(Math.sin(th * 11 + course * Math.PI));
            const fleck = 0.94 + 0.12 * fNoise.noise(th * 3 + 5, t * 6);
            const rim = 1 - 0.3 * smoothstep(0.9, 0.96, t);
            const s = (0.8 + 0.2 * weave) * fleck * rim * (up ? 0.75 : 1);
            return [straw[0] * s, straw[1] * s, straw[2] * s * 0.95];
          },
          (t) => 0.025 * Math.sin(t * 12 * Math.PI * 2) * (1 - smoothstep(0.9, 1, t)),
          { depth: 0.72, wall: 0.08, shade: 0.35 },
        );
        parts.push(stand(basket, bW, roomFloorY, bD));
        for (let i = 0; i < 6; i++) {
          const a = bRng.range(0, TAU);
          const rr = bR * bRng.range(0.15, 0.55);
          const lean = bRng.range(-0.18, 0.18);
          const lean2 = bRng.range(-0.18, 0.18);
          const len = k * bRng.range(0.26, 0.36);
          const foot = frame.door(bW + Math.cos(a) * rr, roomFloorY + 0.03 * k, bD + Math.sin(a) * rr);
          const tip = frame.door(bW + Math.cos(a) * rr + lean * len, roomFloorY + 0.03 * k + len, bD + Math.sin(a) * rr + lean2 * len);
          parts.push(log(foot, tip, 0.014 * k, 0.01 * k, [0.44, 0.34, 0.22], bRng() < 0.5));
        }
        furnish47.pieces += 2;
      }
    }

    // ---- plants: a hanging pot on three cords, a potted plant by the jamb, herb bunches ----
    const roomFoliage = new FoliageBuilder(fRng.fork('foliage'), `${ctx.config.seed}/structures/house/${def.id}/room47`);
    {
      const potW = doorW1 - 0.15 * k;
      const potD = roomFront - 0.7 * k;
      const potTop = roomCeilY - 0.72 * k;
      const potH = 0.16 * k;
      const potR = 0.12 * k;
      const clay = (seed: number) => (t: number, up: number, th: number): [number, number, number] => {
        if (up) return [0.25, 0.3, 0.15];
        const fleck = 0.9 + 0.2 * (0.5 + 0.5 * fNoise.noise(th * 2.5 + seed, t * 9));
        const line = 1 - smoothstep(0.02, 0.035, Math.abs(t - 0.7));
        return [0.82 * fleck * (1 - 0.3 * line), 0.5 * fleck * (1 - 0.35 * line), 0.36 * fleck * (1 - 0.35 * line)];
      };
      const rings = (t: number) => 0.012 * Math.sin(t * 50) * (1 - smoothstep(0.8, 1, t));
      const pot = turned((t) => potR * (0.62 + 0.38 * t) * (1 + 0.06 * smoothstep(0.85, 1, t)), potH, 18, 8, clay(5), rings);
      parts.push(stand(pot, potW, potTop - potH, potD));
      const hook = frame.door(potW, roomCeilY - 0.01 * k, potD);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.4;
        const rim = frame.door(potW + Math.cos(a) * potR * 0.95, potTop - 0.02 * k, potD + Math.sin(a) * potR * 0.95);
        parts.push(sweepTube(new LineCurve3(hook, rim), { radius: () => 0.005 * k, tubularSegments: 3, radialSegments: 5, color: () => [0.35, 0.26, 0.16] }));
        const strandHook = frame.door(potW + Math.cos(a + 0.9) * potR * 0.9, potTop, potD + Math.sin(a + 0.9) * potR * 0.9);
        roomFoliage.addHangingVine(strandHook, (0.45 + fRng() * 0.35) * k, { amount: 0.02, thickness: 0.007, leafSize: 0.055, leafEvery: 0.045, drift: new Vector3((fRng() - 0.5) * 0.25, 0, (fRng() - 0.5) * 0.25) });
      }
      // the crown of the plant over the rim
      roomFoliage.addLeafCluster(frame.door(potW, potTop + 0.06 * k, potD), 0.16 * k, 22, { size: 0.07, amount: 0.02, droop: 0.4, tint: [0.75, 0.9, 0.55], tintSpread: 0.2, flatten: 0.6 });
      furnish47.hangingPlants++;
      furnish47.pieces++;
      // the floor pot by the right jamb, a leafy plant standing in it
      const fpW = doorW1 + 0.1 * k;
      const fpD = roomFront - 0.35 * k;
      const fpot = turned((t) => 0.13 * k * (0.7 + 0.3 * t) * (1 + 0.07 * smoothstep(0.86, 1, t)), 0.2 * k, 18, 8, clay(9), rings);
      parts.push(stand(fpot, fpW, roomFloorY, fpD));
      roomFoliage.addLeafCluster(frame.door(fpW, roomFloorY + 0.3 * k, fpD), 0.24 * k, 34, { size: 0.09, amount: 0.02, droop: 0.25, tint: [0.7, 0.92, 0.5], tintSpread: 0.25, flatten: 0.75 });
      furnish47.pieces++;
      // dried herb bunches hanging from the ceiling by the hearth, stems up, brown-green
      for (let i = 0; i < 3; i++) {
        const hw = doorW1 - 0.05 * k + (i - 1) * 0.22 * k;
        const hd = roomBackD(hw) + 0.75 * k + (fRng() - 0.5) * 0.1 * k;
        const top = frame.door(hw, roomCeilY - 0.02 * k, hd);
        const bottom = frame.door(hw, roomCeilY - (0.28 + fRng() * 0.1) * k, hd);
        parts.push(sweepTube(new LineCurve3(top, bottom), { radius: () => 0.004 * k, tubularSegments: 2, radialSegments: 4, color: () => [0.35, 0.26, 0.16] }));
        roomFoliage.addLeafCluster(bottom.clone().addScaledVector(UPV, -0.06 * k), 0.09 * k, 14, { size: 0.05, amount: 0.015, droop: 1.3, tint: [0.5, 0.48, 0.25], tintSpread: 0.25, flatten: 1.2 });
        furnish47.herbBunches++;
      }
    }

    const furnishGeo = merge(parts);
    {
      const pos = furnishGeo.attributes.position;
      const _g = new Vector3();
      setFloatAttribute(furnishGeo, 'aGlow', (i) => glowOf(_g.set(pos.getX(i), pos.getY(i), pos.getZ(i))));
    }
    furnish47.triangles += Math.floor((furnishGeo.index ? furnishGeo.index.count : furnishGeo.attributes.position.count) / 3);
    const furnishMesh = new Mesh(furnishGeo, propsMat);
    furnishMesh.name = 'interior-furnishing';
    furnishMesh.receiveShadow = true;
    group.add(furnishMesh);
    // the plants: fog-clamped clones of the leaf / vine materials so the strands read as in the
    // room, not in the plaza's haze; no shadow casting (they are indoors)
    const roomLeaf = indoorFog(mats.leaf, doorPlanePoint, F, 'leaf');
    const roomVine = indoorFog(mats.vine, doorPlanePoint, F, 'vine');
    materials.push(roomLeaf, roomVine);
    for (const m of roomFoliage.build({ ...mats, leaf: roomLeaf, vine: roomVine }, 'room47')) {
      m.castShadow = false;
      // indoors: the leaf map's daylight albedo is pulled down to the room's level (× 0.4) so the
      // plants sit in the lamp-lit gloom with the shelves, not as sunlit cut-outs in the door
      const col = m.geometry.attributes.color;
      if (col) {
        for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * 0.4, col.getY(i) * 0.42, col.getZ(i) * 0.38);
        col.needsUpdate = true;
      }
      group.add(m);
    }
    furnish47.plantLeaves = roomFoliage.leafCount;
  }
  const lights: PointLight[] = [];
  // Round 11: the room is lit from inside — reference B's opening is a warm amber glow, a lit
  // back wall with visible depth, brightest under the arch and fading to the threshold (sheet 04
  // draws the same). Round 12: the light stays LOCAL — the lamp light shapes the pool round the
  // upper pod, the short-range fill under the ceiling lights the arch and the near walls; neither
  // reaches the deep back wall, which stays a dark recess (reference: p50 0.30, centre 0.12–0.18).
  // (round 22: 0.28 → 0.2 and the fill 0.15 → 0.1 with the pools — the opening's p90)
  /**
   * Round 48: the hero room's light levels (cd, m). Sized from the renderer's own arithmetic —
   * a point light's irradiance is I / d² × (1 − (d / range)⁴)², the sun's is 4.4 on the plaza,
   * and the walls' albedo is ≈ 0.1–0.2 — so a lamp 1.2 m from the back wall needs ≈ 6 cd to
   * bring it to the reference doorway's l ≈ 0.3; the ranges end at the threshold (the left lamp
   * hangs 2.3 m behind the outer wall face: at the sill its light is 0.3 W/m², a trace of warm
   * spill the reference also shows, and nothing reaches the plaza).
   */
  const RL = { lamp: 6, lampRange: 2.8, lamp2: 4, lamp2Range: 2.6, fill: 1.2, ember: 1.0, candle: 0.8 };
  // Round 48 (structures-31, opus-review #11): the lamps are REAL lights now. Until this round
  // the three room lights were 0.2 / 0.1 / 0.08 cd over 1–1.7 m — a hand's breadth of lit wood
  // each — and everything else the room showed was the emissive pools (`glowOf`). The left lamp
  // lights the back wall, the shelves and the bed (`RL.lamp`); the right lamp gets a light of
  // its own over the right shelf and the hearth corner (`RL.lamp2`); the fill just inside the
  // door is the COOL daylight the doorway lets in (0xc4d6ea, `RL.fill`, 2 m — it lights the
  // floor's front and the jambs' insides, grey-blue against the lamps' amber); the embers and
  // the candle carry small warm pools of their own. Ranges end at the room's threshold (see
  // `RL`), and nothing reaches the plaza. (Only the hero house — the upper house's room is 25 m off.)
  const doorLight = new PointLight(0xffd8a0, (hero ? RL.lamp : 0.2) * k, (hero ? RL.lampRange : 1.7) * k, 2);
  doorLight.position.copy(lampPos).addScaledVector(F, 0.1);
  doorLight.name = 'door-light';
  group.add(doorLight);
  lights.push(doorLight);
  if (hero) {
    const lamp2Light = new PointLight(0xffd0a0, RL.lamp2 * k, RL.lamp2Range * k, 2);
    lamp2Light.position.copy(lamp2Pos).addScaledVector(F, 0.1);
    lamp2Light.name = 'room-lamp-2';
    group.add(lamp2Light);
    lights.push(lamp2Light);
    const candleLight = new PointLight(0xffb870, RL.candle * k, 1.4 * k, 2);
    candleLight.position.copy(candlePos47).add(new Vector3(0, 0.06 * k, 0));
    candleLight.name = 'candle-light';
    group.add(candleLight);
    lights.push(candleLight);
  }
  // the "fill" sits just inside the arch, a little below it: it lights the jambs and the
  // threshold (the reference spills warm light there), not the recess. (At `archPos` itself, a
  // few centimetres under the arch's inner edge, the inverse-square falloff blew that edge out
  // to a pale band in the first round-12 probe.)
  // (round 48: cool — the door's daylight — and set 0.75 m inside the inner wall face)
  const fillLight = new PointLight(hero ? 0xc4d6ea : 0xffd8a8, (hero ? RL.fill : 0.1) * k, (hero ? 2.0 : 1.6) * k, 2);
  fillLight.position.copy(frame.door((doorW0 + doorW1) / 2, doorTop - 0.55 * k, roomFront - (hero ? 0.75 : 0.5) * k));
  fillLight.name = 'room-fill';
  group.add(fillLight);
  lights.push(fillLight);
  // pink-amber ember glow low right (reference doorway crop): short range, low on the floor
  const emberLight = new PointLight(0xf5cfc0, (hero ? RL.ember : 0.08) * k, (hero ? 1.5 : 1.0) * k, 2);
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
    HOUSE_CLONES.set(winGlowMat, { kind: 'window-glow', base: mats.windowGlow });
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
        // (round 34: the trunk's lit-albedo share)
        const d = 0.62 * TRUNK_LIT_ALBEDO * (1 + 0.45 * c) * (0.85 + 0.15 * Math.max(0, knot.attributes.normal.getY(i)));
        return [d, d * 0.97, d * 0.88];
      });
      // bark map at the trunk's density (metres / 2.2)
      const uv = knot.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * TAU * rb) / 2.2 + b.a, (uv.getY(i) * Math.PI * rb) / 2.2 + yb);
    }
    // basisMatrix maps local +z → N and keeps local +y (the poles) up
    knot.applyMatrix4(basisMatrix(centre, N));
    mossOnTop(knot, ROOT_MOSS_TINT, 0.75, noise, 0.3);
    if (dSide) mossBySide(knot, frame, D_MOSS_TINT, noise, dSide);
    rootParts.push(knot);
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
  const keepOut = [
    ...ctx.layout.houses.filter((h) => h.id !== def.id).map((h) => ({ x: h.position[0], z: h.position[2], r: h.trunkRadius * 1.1, yMin: h.position[1] + 0.35 })),
    ...(site.rootKeepOut ?? []).map((c) => ({ ...c, yMin: -Infinity })),
  ];
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
    /**
     * The waypoints on the ground for a given reach: over the terrain, on it, hugging it near
     * the tip, sunk into it. Survey-1 item 6: Saria's south-east roots ran 4.3 m UP the plateau
     * bank to the stair landing (base (17.0, 5.36, −7.4)) — a straight ramp from the trunk foot
     * to the plateau read as a bent plank lying on the landing. A buttress root runs level or
     * downhill, so a root whose seat would sit more than `MAX_CLIMB` above the house floor is
     * shortened until it seats on the bank's lower slope; the extra point at 72 % of the reach
     * keeps the tip on uneven ground instead of spanning it.
     */
    const groundPts = (reachNow: number) => {
      const p2 = frame.at(a, rs0 + reachNow * 0.45, 0).addScaledVector(side, 0.5);
      p2.y = terrain.height(p2.x, p2.z) + 0.28 * k;
      const p2b = frame.at(a, rs0 + reachNow * 0.72, 0).addScaledVector(side, 0.8);
      p2b.y = terrain.height(p2b.x, p2b.z) + 0.1 * k;
      const p3 = frame.at(a, rs0 + reachNow, 0).add(side);
      p3.y = terrain.height(p3.x, p3.z);
      const p4 = frame.at(a, rs0 + reachNow + 0.6, 0).addScaledVector(side, 1.3);
      p4.y = terrain.height(p4.x, p4.z) - 0.4;
      return [p2, p2b, p3, p4];
    };
    const MAX_CLIMB = 1.4;
    /** a root may run down an eroded bank (exposed on the face) but not span a cliff: seat ≤ 2.5 m under the floor */
    const MAX_DROP = 2.5;
    const climbs = (g: Vector3[]) => g[2].y - yFloor > MAX_CLIMB;
    const drops = (g: Vector3[]) => yFloor - g[2].y > MAX_DROP;
    let ground = groundPts(reach);
    while (reach > 0.3 * R && (ground.some(insideOther) || climbs(ground) || drops(ground))) {
      reach -= 0.1 * R;
      ground = groundPts(reach);
    }
    if (insideOther(p1) || ground.some(insideOther)) continue;
    // Saria's trunk is set into the plateau bank: on its south / east / north sides the ground
    // stands 3.5 m up the shaft, so a root leaving the bark at y0 there is UNDERGROUND and only
    // surfaced 4 m higher on the bank or the landing (survey-1 item 6). A root whose seat still
    // climbs more than MAX_CLIMB at the shortest reach is not built (its rng draws are still
    // taken so the other roots are unchanged); the north-west root that surfaces from the bank
    // and runs DOWN to the lawn (D's bank) stays.
    if (climbs(ground)) {
      rootRng();
      continue;
    }
    rootsBuilt++;
    const [p2, p2b, p3, p4] = ground;
    void p2;
    void p2b;
    const rootN = 4.5 + rootRng() * 3;
    /**
     * Round 46 (structures-29, survey-2 #08 / check-13): the root SEATED on the ground. Rounds
     * 19–45 swept the root through five waypoints — the bark exit at y0 · 0.66, then the ground
     * at 45 % / 72 % / 100 % of the reach — and the spline between the exit and the first ground
     * point ARCHED over the lawn with a shadow gap under it (w26-stairs-l, w09-spine-r: "a
     * smooth tube with a floating gap"), and between the ground points the 0.9–1.1 knuckle
     * modulation lifted the underside clear of any dip in the terrain. Now the root leaves the
     * bark, drops to the ground within a fifth of its reach and from there follows the
     * heightfield: the centre line is sampled every ≈ 12 cm along the reach at
     * terrain + 0.5 × the local radius (the lower third of the root buried, the knuckles' 0.9
     * minimum included), so the underside is in the ground everywhere and the crown rides the
     * terrain's bumps. The same ground points decide the keep-out / climb / drop tests above, so
     * which roots are built is unchanged, and the rng draws are the same in the same order.
     */
    const rootLenEst = 0.5 * k + reach + 0.6;
    const rAlong = (f: number) => {
      const t = clamp((0.5 * k + f * reach) / rootLenEst, 0, 1);
      return r0 * (1 - 0.72 * t) * 0.9;
    };
    const seatPts: Vector3[] = [p0, p1];
    {
      const nS = Math.max(6, Math.round((reach + 0.6) / 0.12));
      const yExit = p1.y;
      for (let sI = 1; sI <= nS; sI++) {
        const f = (sI / nS) * (1 + 0.6 / reach);
        const q = frame.at(a, rs0 + f * reach, 0).addScaledVector(side, clamp(f, 0, 1.3));
        const g = terrain.height(q.x, q.z);
        const seated = g + 0.5 * rAlong(Math.min(1, f));
        // the drop from the bark exit: over the first fifth of the reach the centre line falls
        // from the exit height to the seated height (never below it)
        const drop = smoothstep(0, 0.2, f);
        q.y = f <= 1 ? Math.max(seated, lerp(yExit, seated, drop)) : g - 0.4 * (f - 1) / 0.6 * k;
        seatPts.push(q);
      }
    }
    const curve = new CatmullRomCurve3(seatPts, false, 'catmullrom', 0.5);
    const rootLen = curve.getLength();
    const root = sweepTube(curve, {
      radius: (t) => r0 * (1 - 0.72 * t) * (0.9 + 0.2 * Math.abs(Math.sin(t * rootN))),
      tubularSegments: Math.max(26, Math.round(rootLen / 0.09)),
      radialSegments: 16,
      uvMetres: 1.4,
      // Round 46: BARK CORDS running the root's LENGTH (a ridged field periodic round the root,
      // drifting slowly along it — ± 4.5 % of k, ≈ 7 cords round a 0.35 m root), narrow dark
      // fissures between them, and the round-19 knuckle rings kept at a third of their old
      // depth under the cords. Round 34's `ridged(ang, t · 6)` ran its ridges ACROSS the root
      // (six rings along it), which read as a painted grain stripe at 3–6 m (survey-2 #08).
      displace: (t, ang) => {
        const along = t * rootLen;
        const cord = noise.ridged(Math.cos(ang) * 1.15 + i * 3.1, Math.sin(ang) * 1.15 + along * 0.32 + i * 0.7, 2) - 0.5;
        const fissure = Math.pow(1 - Math.abs(noise.noise(Math.cos(ang) * 1.6 + i * 5.3 + 20, Math.sin(ang) * 1.6 + along * 0.22)), 7);
        const knuckle = (noise.ridged(ang * 1.2 + i * 3.1, t * 6, 2) - 0.5) * 0.016 * k;
        const lumps = (noise.noise(ang * 3.4 + i * 7.3, t * 1.6 + 40) - 0.5) * 0.02 * k;
        return (cord * 0.045 * k - fissure * 0.03 * k) * (1 - 0.45 * t) + knuckle * (1 - 0.5 * t) + lumps * (1 - 0.4 * t);
      },
      color: (t, ang) => {
        // round 34: the trunk's lit-albedo share, damp toward the tip on the ground;
        // round 46: grime in the fissures, the cord crests a shade paler
        const along = t * rootLen;
        const cord = noise.ridged(Math.cos(ang) * 1.15 + i * 3.1, Math.sin(ang) * 1.15 + along * 0.32 + i * 0.7, 2);
        const fissure = Math.pow(1 - Math.abs(noise.noise(Math.cos(ang) * 1.6 + i * 5.3 + 20, Math.sin(ang) * 1.6 + along * 0.22)), 7);
        const shade = lerp(0.72, 1.12, cord) * (1 - 0.5 * fissure);
        const d = lerp(0.72, 0.5, t) * TRUNK_LIT_ALBEDO * shade;
        return [d, d * (0.97 - 0.04 * fissure), d * (0.88 - 0.08 * fissure)];
      },
      capEnd: true,
    });
    // moss on the root lips (reference B lower-left root: olive, hue 53°, against the 27–34° bark);
    // round 34: deeper green sheets that wrap down the shoulders (spread 0.45), not only the crown
    mossOnTop(root, ROOT_MOSS_TINT, 0.8, noise, 0.45);
    // round 36: the roots seated on the north-west flank are D's bank — a full dark sheet there
    if (dSide) mossBySide(root, frame, D_MOSS_TINT, noise, dSide);
    rootParts.push(root);
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
    /**
     * Round 36 (structures-24): the RIGHT leg is a fifth thicker below the shoulder. Frame B's
     * right pillar (x 0.84–0.92 × y 0.34–0.50) is one thick bark column ≈ 0.06 of the frame wide
     * (≈ 1.05 m at its 14 m) reading p50 0.250 / hue 28°; ours showed 8–17 px of arch per row
     * there (part mask, 1280 px) with the porch recess (p50 0.260 / 42°) filling a quarter of the
     * box between the leg and the door where the frame has the pillar's bark. The left leg,
     * B's lit lip (0.655–0.72 × 0.36–0.50: ours 0.291 / 35° against 0.323 / 32°), is unchanged.
     */
    const rightLeg = smoothstep(0.5 * k, 1.0 * k, lateralOf(_ap)) * smoothstep(2.6 * k, 2.0 * k, y);
    return base * k * (1 + 0.18 * rightLeg) * (1 + 0.1 * Math.sin(t * 23 + 1) + 0.05 * Math.sin(t * 57 + 2));
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
  /**
   * Round 21: six LARGE knots (0.4–0.6 m wide, 0.2–0.32 m tall) on the crown's front and the
   * upper legs — the reference arch is knuckled with fist-to-head-sized burls, ours had only the
   * dozen-and-a-half small ones. Kept off the underside (φ with an up-component ≥ −0.2) so the
   * opening's crown and the pods' cords are untouched. Own fork.
   */
  const knotRng = rng.fork('knots21');
  for (let i = 0; i < 6; i++) {
    const t = i < 4 ? 0.36 + knotRng() * 0.28 : knotRng() < 0.5 ? 0.16 + knotRng() * 0.14 : 0.7 + knotRng() * 0.14;
    const phi = knotRng() * TAU;
    const c = archCurve.getPointAt(t);
    const r = archRadius(t);
    const T = archCurve.getTangentAt(t);
    const side = new Vector3(T.z, 0, -T.x).normalize();
    const up = new Vector3().crossVectors(T, side).normalize();
    // fold a downward φ onto the upper half
    const sy = Math.sin(phi) < -0.2 ? -0.2 - (Math.sin(phi) + 0.2) : Math.sin(phi);
    c.addScaledVector(side, Math.cos(phi) * r * 0.9).addScaledVector(up, sy * r * 0.9);
    archKnots.push({ c, s: (0.4 + knotRng() * 0.2) * k, h: (0.2 + knotRng() * 0.12) * k });
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
  // cord crest ∈ ±0.5, the hollow / bump term in metres, and (round 21) the fissure ∈ [0, 1]
  let archCrest = 0;
  let archRelief = 0;
  let archFis = 0;
  /**
   * Round 21: the cords are denser round the body (ring scale 2.2, ≈ 14 bundles, was 1.4 / 9) and
   * deeper (`cordAmp`), and FISSURES — ring-periodic sharp valleys running along the body — cut
   * between them (`fisAmp`), so the arch reads as knotted rope-bark and not a smooth tube. The
   * reference arch face in B runs p10 0.24 → p90 0.54 (local 8 px contrast 0.038) where ours ran
   * 0.34 → 0.45 (0.020).
   *
   * Round 36 (structures-24): the cords are COARSER again — ring scale 1.35 (≈ 8–9 bundles round
   * the body, was 2.2 / 14) and a third deeper (`ARCH_CORD_SCALE`, the amplitudes at the call
   * sites). Measured on frame B's pillars by the detrended column-mean luminance across each
   * (1280 px; a dark furrow = a minimum under −0.6 sd): the right pillar (0.84–0.92 × 0.36–0.48,
   * 1.71 m at 14 m) has 4 furrows = 2.3 / m at contrast 1.99 (sd ×100), the left (0.655–0.72 ×
   * 0.38–0.48, 1.20 m at 12 m) 2 = 1.7 / m at 2.76, the crown front (0.70–0.86 × 0.24–0.30) 10 =
   * 3.2 / m at 2.19 with its autocorrelation peaking at 36 px; ours ran 9 = 5.3 / m at 0.65, 8 =
   * 6.7 / m at 1.23 and 13–15 = 4.2–4.9 / m at 1.0–1.6 — the frame's cords are two to three
   * times as wide and half again as deep as round 21's.
   */
  const ARCH_CORD_SCALE = 1.35;
  /**
   * Round 41 (structures-26): a FINE cord octave (ring scale 3.6 — ≈ 22 bundles round the body,
   * ±2 cm) and narrow cracks (±3 cm, along the body) on top of round 36's coarse cords, so the
   * arch's cords and knots read from 3 m at the door; relief only — `archCrest` / `archFis`
   * (the shade terms) stay round 36's, and the tubes are sampled denser for it (below).
   */
  const archFine = (seed: number, t: number, ang: number, along: number) => {
    const fineCord = ringRidged(noise, ang, t * along * 1.3 + seed * 0.7, ARCH_CORD_SCALE * 2.7, seed + 7);
    const fineCrack = Math.pow(1 - Math.abs(noise.noise(Math.cos(ang) * 3.3 + seed * 2.1, Math.sin(ang) * 3.3 + t * along * 0.8 + seed * 0.5)), 9);
    return fineCord * 0.04 * k - fineCrack * 0.03 * k;
  };
  const archDisplace = (seed: number, cordAmp: number, lumpAmp: number, along: number, fisAmp = 0.1) => (t: number, ang: number, pos: Vector3) => {
    archCrest = ringRidged(noise, ang, t * along * 0.6 + pos.y * 0.2, ARCH_CORD_SCALE, seed);
    const lump = noise.fbm(pos.x * 1.3 + 5, pos.z * 1.3 + pos.y * 0.7, 2) - 0.5;
    archFis = Math.pow(1 - Math.abs(noise.noise(Math.cos(ang) * 1.7 + seed * 1.3, Math.sin(ang) * 1.7 + t * along * 0.35 + seed)), 5);
    archRelief = lump * lumpAmp * k + knotsAt(pos);
    return archCrest * cordAmp * k + archRelief - archFis * fisAmp * k + archFine(seed, t, ang, along);
  };
  /** the relief terms only; the shade comes from the welded normals in `shadeArch` */
  const reliefColor = (): [number, number, number] => [clamp(archCrest * 2.4, -1, 1), archRelief / k, archFis];
  /**
   * The crown is deeper than it is tall: from the shoulders up, its back stretches 0.5 m toward
   * the wall (a torus pulled along −F, the legs stay round), so it fills the soffit under the
   * cap's eave and B's sight-lines under the crown end on the arch's own dark underside, not on
   * the eave's underside or the wall's eave band 1–1.5 m behind it (round 19's second probe
   * still showed 2–7 rows of those between the crown and the porch at x 0.73–0.85).
   */
  const archCrownDisplace = archDisplace(2.3, 0.21, 0.2, 16, 0.1);
  const archBody = (t: number, ang: number, pos: Vector3) => {
    const d = archCrownDisplace(t, ang, pos);
    archCurve.getPointAt(t, _ap);
    const rx = pos.x - _ap.x;
    const rz = pos.z - _ap.z;
    const rl = Math.hypot(rx, pos.y - _ap.y, rz) || 1;
    const back = Math.max(0, -(rx * F.x + rz * F.z) / rl);
    return d + back * back * 0.5 * k * smoothstep(2.45 * k, 2.7 * k, heightOf(_ap));
  };
  // (round 21: 32 radial segments, was 16 — the denser cords (≈ 14 bundles round the body) and
  // the fissures need two-plus vertices a bundle to show; +3.8 k triangles)
  // (round 41: 120 × 32 → 176 × 48 for the fine cords, ≈ 6 cm round the 0.9 m body)
  const ARCH_TS = hero ? 176 : 120;
  const ARCH_RS = hero ? 48 : 32;
  const arch = sweepTube(archCurve, {
    radius: archRadius,
    tubularSegments: ARCH_TS,
    radialSegments: ARCH_RS,
    uvMetres: 1.4,
    displace: archBody,
    color: reliefColor,
  });
  weldNormals(arch);
  weldTubeSeam(arch, ARCH_TS, ARCH_RS);
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
  /** round 36: 1 for the houses that are not Saria's — their arches are hazed shapes in every frame */
  const farHouse = def.id === 'saria' ? 0 : 1;
  const shadeArch = (geo: BufferGeometry, yDark0: number, yDark1: number, mossAmount: number, creep: boolean, flankSide: -1 | 0 | 1 = 0) => {
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const col = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      _ap.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const y = heightOf(_ap);
      const up = nrm.getY(i);
      const front = nrm.getX(i) * F.x + nrm.getZ(i) * F.z;
      const right = nrm.getX(i) * Rt.x + nrm.getZ(i) * Rt.z;
      const crest = col.getX(i);
      const relief = clamp(col.getY(i) * 6, -1, 1);
      // round 21: the fissures (col z ∈ [0, 1]) are near-black cuts between the cord bundles
      const fis = col.getZ(i);
      // ×1.8 over the roots' tints: ARCH_BARK_FLOOR takes 85 % of its albedo from the surface.
      // Round 21: the crest swing is ×0.9 (was 0.6) and the base ×1.15 — the face rendered p10
      // 0.344 / p90 0.453 against the reference's 0.242 / 0.537 (the haze floors p10 at ≈ 0.295;
      // the crests are where the range can come from), fissures ×0.3.
      const base = 2.07 * lerp(0.72, 0.6, smoothstep(yDark0, yDark1, y));
      /**
       * Round 22: the arch is lit from the LEFT (sun azimuth −128° stands 0.78 along −Rt of the
       * door) and from above; in reference B its right leg and shoulder (x 0.84–0.92 × y 0.28–0.50)
       * are the darkest bark in the frame — p50 0.249, deep green moss over near-black furrows —
       * its underside over the door (x 0.70–0.80 × y 0.35–0.40) reads p50 0.266 and the left
       * leg's door-facing side (x 0.66–0.72 × y 0.33–0.50) 0.310, while the crown's front face
       * keeps 0.377 and the left lip's outer face 0.42–0.47. Ours rendered every face at the
       * floor's 0.36–0.40 (85 % of ARCH_BARK_FLOOR's albedo is the surface's own, so this is the
       * tint's to carry): right-facing faces that do not face the door (the left leg's inner
       * side), downward faces (the crown's underside) and the whole right leg / shoulder below
       * the crown are shaded, the moss on a shaded face is the deep green of the reference's
       * right pillar instead of the crown's lit tongues, and the crown's front face is untouched.
       */
      const belowCrown = smoothstep(3.0 * k, 2.5 * k, y);
      const lateral = lateralOf(_ap);
      const shadowLeg = smoothstep(1.1 * k, 1.9 * k, lateral) * belowCrown;
      const frontFace = smoothstep(0.1, 0.6, front);
      /**
       * The crown's front face by height (fully textured floor, so the tint is the level): in
       * reference B the lit bark band under the cap's moss is y 0.24–0.29 (p50 0.36–0.41) and
       * everything under it to the door is the dark cavity (0.22–0.26 — the pods hang against
       * it), while our crown's front face is a deeper band (y 0.235–0.33) that rendered lit to
       * its bottom edge. Below the axis the face darkens to the cavity's level at the underside;
       * the shoulder end on the right (lateral > 0.7 m, where the reference's crown turns down
       * into its dark right pillar: x 0.86–0.94 × y 0.28–0.34 p50 0.20–0.27) shades with it; the
       * legs' fronts under the crown's overhang are two thirds of the crown's level (the
       * reference's left leg reads 0.31 against the crown's 0.377), their outer flanks — the left
       * lip's lit outer face, 0.42–0.47 — and the flared feet exempt.
       */
      const crownAxisY = archTopY - 0.47 * k;
      const lowerFront = frontFace * smoothstep(crownAxisY - 0.15 * k, crownAxisY - 0.45 * k, y) * smoothstep(2.0 * k, 2.3 * k, y);
      // (round 36: the shoulder's shade is ×0.6, was 0.45 — frame B's shoulder box (0.86–0.94 ×
      // 0.28–0.34) reads p50 0.235 / p10 0.186 / hue 29°, ours 0.271 / 0.235 / 49.7° with the
      // arch's own pixels at 0.260 / 37.7° — and it starts nearer the axis, 0.5 m)
      const shoulder = (1 - belowCrown) * smoothstep(0.5 * k, 1.4 * k, lateral);
      const legFront = belowCrown * (1 - smoothstep(0.15, 0.6, -right)) * smoothstep(0.5 * k, 1.2 * k, y);
      /**
       * The left flank (the faces toward the sun that the cap's rim shadows): it is what A and D
       * look at — A from the front-left, D from the left — and in both the reference's house is
       * one smooth hazed shape (D x 0.80–0.86 × y 0.20–0.36: p10 0.288 / p50 0.292 / p90 0.307;
       * A x 0.46–0.52 × y 0.28–0.48: 0.322 / 0.355 / 0.393). Under the fully textured floor at
       * lift 17 those faces rendered p50 0.395 with a p10–p90 range of 0.152 in D (control 0.094:
       * the range is lift × textured share, 10.2 → 17) and cost A and D −0.003 / −0.004 SSIM in
       * the arch's cells while B gained. The floor drops to lift 13 (range ×1.27 over the control),
       * the crown's lit band keeps its B level through its own tint (×1.35, below), and the flank
       * below the crown takes a fifth off — B's left lip (x 0.655–0.685 × y 0.36–0.48) sits at
       * p50 0.345 against the reference's 0.369, so the lip's outer face is spared most of it.
       */
      const leftFlank = smoothstep(0.2, 0.7, -right) * (1 - frontFace) * belowCrown;
      /**
       * Round 34 (structures-23): the CROWN's left flank — the shoulder and crown side above the
       * legs, which round 22 left at the lit level. Camera D looks straight at it (D 0.80–0.86 ×
       * 0.28–0.38: 56 % arch by material mask, p50 0.386, hue 32°, sat 0.40 — a lit orange blob)
       * where frame 56 s has one hazed grey-green shape (p10 0.287 / p50 0.292 / p90 0.303, hue
       * 75°, sat 0.10); the albedo probe puts the flank's floor at 0.304 (×0.05). A sees the same
       * face at 0.362 against the frame's 0.355 (hue 47° vs 57°), so it takes ×0.65 and an olive
       * lean (below), not the legs' full shade. B's left lip is the leg, untouched.
       */
      const crownFlank = smoothstep(0.2, 0.7, -right) * (1 - frontFace) * (1 - belowCrown);
      // (the crown's own front face — front > 0.5 — is exempt from the right / underside terms;
      // on the legs every right-facing face is shaded whichever way it leans)
      const dirShade =
        (1 - 0.6 * Math.max(0, right) * lerp(smoothstep(0.65, 0.15, front), 1, belowCrown)) *
        (1 - 0.75 * Math.max(0, -up) * smoothstep(0.55, 0.1, front)) *
        (1 - 0.88 * shadowLeg) *
        (1 - 0.65 * lowerFront) *
        (1 - 0.6 * shoulder) *
        (1 - 0.35 * legFront) *
        (1 - 0.2 * leftFlank) *
        (1 - 0.35 * crownFlank) *
        // the crown's lit band carries its own level: ×1.35 holds the reference's lit band (B
        // x 0.72–0.86 × y 0.24–0.31, p50 0.377) at the floor's lift 13 where lift 17 gave it ×1.1
        // (17 × 1.1 ≈ 13 × 1.35 on a floor-lit face; the pods' light on it is a third less since
        // round 22 — see `lanternLight`)
        // (round 34 measured ×1.55: B's crown box 0.349 → 0.360 toward the frame's 0.378, but F —
        // which looks up at the crown from the stair top (0–0.3 × 0.05–0.35) — lost 0.0010 SSIM
        // and A 0.0006 for a brighter orange face the frames' hazier crown does not have; ×1.35 stays)
        // (round 36: ×1.45 with the face's balance turned olive (g ×1.3 / b ×0.95, below) — frame
        // B's crown front reads p50 0.396 against ours 0.341–0.346, and the cap box (0.55–0.98 ×
        // 0.05–0.35) gave up 0.003 of its median to the shoulder's shade and the vines' removal)
        (1 + 0.45 * (1 - belowCrown) * frontFace);
      // (round 22: the relief swing is ×0.6 / ×0.3 and the fissures ×0.5 — under the fully textured
      // floor every unit of tint reaches the pixel, where 85 % of it did before; the old swings
      // rendered the crown as fine bright/dark speckle in A and D, where the reference's house is a
      // smooth hazed shape)
      // (round 34 measured deeper fissures — ×0.65 — against frame B's crown p10 0.241: ours held
      // at 0.300 → 0.299, the veil's floor at the house, for −0.004 of the crown's median; ×0.5 stays)
      const d = base * dirShade * (0.7 + 0.3 * Math.max(0, up) + 0.06 * Math.max(0, front)) * Math.max(0.08, 1 + 0.6 * crest) * (1 + 0.3 * relief) * (1 - 0.5 * fis);
      const patch = 0.45 + 0.55 * noise.fbm(_ap.x * 1.7 + 3, _ap.z * 1.7 + y * 0.6, 2);
      // (round 36: the right shoulder — where the crown turns down into the right pillar — carries
      // no moss: frame B's shoulder box has a green share of 0.000 against our arch pixels' 0.14)
      let w = smoothstep(0.25, 0.85, up) * patch * mossAmount * (1 - 0.9 * shoulder);
      if (creep) {
        // the crown's upper half under the cap: moss over the top and down over the front rim
        // where the patch noise is dense (tongues), never on the underside
        const high = smoothstep(archTopY - 0.6 * k, archTopY - 0.1 * k, y);
        w = Math.max(w, high * smoothstep(0.35, 0.7, patch + 0.5 * up + 0.3 * Math.max(0, front) - 0.3));
      }
      /**
       * Round 22 put a moss skin over the shaded right leg. Round 34 measured frame B's right
       * pillar (0.84–0.92 × 0.28–0.50): p50 0.247, hue 28°, sat 0.31, green share 0.6 % — and its
       * shoulder (0.86–0.94 × 0.28–0.34) hue 29°, green 0 %: dark WARM bark, no moss. Ours read
       * hue 47° with 18–21 % green on the arch's pixels. The skin drops to a trace in the furrows
       * (0.85 → 0.2) and the shaded faces' tint goes warm (below).
       */
      w = Math.max(w, shadowLeg * smoothstep(0.45, -0.1, crest) * smoothstep(0.3, 0.75, patch) * 0.2);
      /**
       * Round 34 (structures-23): the buttresses' OUTER flanks (the faces turned away from the door,
       * along `flankSide` × Rt) carry moss sheets off the cord crests — camera D, 11° left of the
       * door's axis, sees the left buttress's outer flank sunlit as 6 % of its right bank (material
       * mask, p50 0.375, hue 33°) where frame 56 s' bank is dark moss; B sees that flank edge-on.
       */
      // (iteration 2: the arch body's own crown flank takes the same sheets — the buttress flank
      // turned out to be 2.6 % of D's arch pixels; the crown's flank is what D and A see)
      const outer = flankSide !== 0 ? smoothstep(0.2, 0.7, flankSide * right) * smoothstep(2.5 * k, 2.0 * k, y) : crownFlank;
      const flankMoss = outer * smoothstep(0.45, -0.1, crest) * smoothstep(0.25, 0.7, patch) * 0.6;
      w = Math.max(w, flankMoss);
      w = clamp(w, 0, 1);
      // olive bark, and a moss tint green enough to read as moss on this warm bark (the material's
      // 0xdcb086 × the map leave g/r ≈ 0.6 linear; the roots' ×2.4 tint rendered amber here). The
      // reference's arch face in B runs g/r 0.92–0.94 on its moss tongues, 0.83 on bare bark.
      // Round 22: the moss darkens with the face it sits on (×0.12 at full shade — the
      // reference's right-pillar moss is as dark as the bark it grows on)
      // (round 34: the flank sheets are the bank's dark moss, half the crown tongues' level)
      const m = lerp(0.1, 1, Math.pow(dirShade, 1.5)) * lerp(1, 0.5, clamp(flankMoss / Math.max(w, 1e-4), 0, 1));
      /**
       * Round 34: the bare bark's channel balance follows the shade. The lit crown keeps round 21's
       * g ×1.15 / b ×0.84 (frame B's crown reads hue 44°); the shaded faces — the right leg and
       * shoulder, the underside, the lower front — go to g ×0.92 / b ×0.6, the frame's right
       * pillar (hue 28–29°, sat 0.31–0.35) against ours at 46–47° under the yellow of the map and
       * the floor's leaf-filtered light.
       */
      const shadeAmt = clamp(1 - dirShade, 0, 1);
      /**
       * (the crown flank leans the other way — grey-olive, the frames' hazed side: g up, r down)
       * Round 36: the UPPER house's arch, 19–26 m out, takes the same lean on every face. It is
       * the lit orange blob over Saria's bank in D (0.80–1.0 × 0.30–0.55: 6.2 % of the box, p50
       * 0.366 / hue 30° / sat 0.39 against frame 56 s' hazed shape 0.292 / 77° / 0.11), and in A
       * (0.46–0.54 × 0.10–0.20: ours 0.428 / 51° / sat 0.225, frame 0.468 / 57° / 0.084) and B
       * (0.60–0.68 × 0.10–0.18: 0.354 / 45° / 0.287, frame 0.381 / 54° / 0.312) it is the warmer,
       * more saturated shape too. The lean is luminance-neutral (×0.9 on the level pays for the
       * green's weight), so it moves hue and saturation only.
       */
      // (iteration 2: the far house's lean is half again the flank's — the first pass moved D's
      // upper arch only 29.8° → 36.7°, sat 0.394 → 0.371)
      /**
       * Round 36: the LIT CROWN's balance — the crown's front face above the legs — goes to g ×1.3 /
       * b ×0.95 (was 1.15 / 0.84): frame B's crown front (0.70–0.86 × 0.235–0.31) reads hue 44.8°
       * at p50 0.396, ours 32° / 0.337 on the arch's own pixels — the same saturation (0.45) but
       * orange where the frame's is olive; the green's weight lifts the face ≈ 10 %, half the gap.
       */
      const litCrown = (1 - belowCrown) * frontFace;
      // (iteration 3: farther still — at ×1.4 / 0.75 / 1.25 D's upper arch read 41.7° / sat 0.358
      // and A's box 52.3° / 0.220 against the frames' 77° / 0.11 and 57° / 0.08)
      const gBal = lerp(1.15, 0.92, shadeAmt) * lerp(1, 1.25, crownFlank) * lerp(1, 1.5, farHouse) * lerp(1, 1.13, litCrown);
      const bBal = lerp(0.84, 0.6, shadeAmt) * lerp(1, 1.1, crownFlank) * lerp(1, 1.45, farHouse) * lerp(1, 1.13, litCrown);
      const rBal = lerp(1, 0.85, crownFlank) * lerp(1, 0.65, farHouse);
      const dd = d * lerp(1, 0.9, farHouse);
      col.setXYZ(i, lerp(dd * rBal, 0.8 * m, w), lerp(dd * gBal, 2.2 * m, w), lerp(dd * bBal, 0.5 * m, w));
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
  // leaves the arch (`pillarTops`). Round 20: the right foot moves from door-space (2.5, 3.7),
  // where the terrain is 2.58 m above the sill and the leg read as a stub in B, out to
  // (2.35, 5.5), where it is ≈ 1.9 m — the same shoulder knot, a longer visible leg (≥ 1.2 m in
  // B), still clear of the main stair's edge. The left buttress, the door, arch and window are
  // untouched. ----
  const pillarRng = rng.fork('pillars');
  const pillarTops: { top: Vector3; foot: P3; side: -1 | 1; footRadius: number }[] = [];
  for (const side of [-1, 1] as const) {
    const jit6 = () => (pillarRng() - 0.5) * 0.06 * k;
    const siteFoot = side > 0 ? site.rightFoot : undefined;
    const footAt = siteFoot ?? (side < 0 ? HOUSE_BUTTRESS_FEET.left : HOUSE_BUTTRESS_FEET.right);
    const wFoot = footAt[0] * k;
    const dFoot = footAt[1] * k;
    const foot = frame.door(wFoot, 0, dFoot);
    foot.y = terrain.height(foot.x, foot.z);
    const start = archShoulder(side);
    // (the pillarRng draws stay in round 19's order: waypoint 1, waypoint 2, then the buried tip)
    const shoulderOut = frame.door(lateralOf(start) + side * 0.3 * k + jit6(), 2.25 * k, 3.75 * k + jit6());
    // the third waypoint: the left one as in round 19 (and a site's own right foot); the long right
    // leg hangs off its (lower, further) foot so the root arrives at the ground from above
    const knee = side < 0 || siteFoot
      ? frame.door(wFoot - side * 0.12 * k + jit6(), 1.2 * k, dFoot - 0.05 * k + jit6())
      : frame.door(wFoot - side * 0.12 * k + jit6(), heightOf(foot) + 0.55 * k, dFoot - 0.4 * k + jit6());
    const pts = [
      start,
      shoulderOut,
      knee,
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
    // (round 21: 24 radial segments, was 14, deeper cords 0.11, fissures 0.07)
    // (round 41: 32 × 24 → 48 × 36 for the fine cords)
    const buttress = sweepTube(curve, {
      radius: buttressR,
      tubularSegments: 48,
      radialSegments: 36,
      uvMetres: 1.4,
      displace: archDisplace(4.1 + side, 0.15, 0.12, 8, 0.07),
      color: reliefColor,
    });
    weldNormals(buttress);
    weldTubeSeam(buttress, 48, 36);
    archParts.push(shadeArch(buttress, 1.0 * k, 2.9 * k, 0.5, false, side));
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
  /** (grid u, v) → straw cell? Decided on the sheet's own parameter (round 40: `vMoss`) */
  const isThatchCell = (u: number, v: number) => {
    const a = u * TAU;
    const vm = vMoss(a, v);
    domeBase(a, vm, _tc);
    return thatchAt(_tc, vm) > 0.5;
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
    // (round 40: on the sheet's own parameter, `vMoss`)
    const a = u * TAU;
    domeBase(a, vMoss(a, v), _c0);
    domeBase((u + du) * TAU, vMoss((u + du) * TAU, v), _c1).sub(_c0);
    domeBase(a, vMoss(a, Math.min(1, v + dv)), _c2).sub(_c0);
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
  /**
   * Round 40 (structures-25; owner video review 16 Sept, "an irregular edge over the bark"):
   * the moss sheet no longer wraps the whole rim curl — it ENDS in a torn edge of lobes and
   * fingers part-way round the curl, and the curl itself is BARK (`eaveBark`, the eave's cords
   * in the recess bark, 3.5 cm under the moss shell) that shows below the edge and through the
   * gaps where the sheet has retreated onto the shoulder. Frame-03 of the review (the mossy
   * bough) and board 05 "Moss on Branch": moss cushions end ragged over the bark with the cords
   * poking through. The shell's SHAPE is unchanged — the curl's silhouette, the rim's reach,
   * the soffit and the pods' hooks all stand where they did; only what covers the surface
   * changes (the audit's `cap` samples the shell, not the sheet).
   *
   * `mossEdgeV(a)`: the cap parameter where the moss ends at angle a — about the rim's crest
   * (V_CAP), so the curl's outer face is bark with the moss hanging over it. Metric noise along
   * the rim's arc: 0.5–1 m lobes ±5 cm, narrow fingers hanging a further 12 cm down the curl
   * every 0.3–0.5 m, and gaps where the edge retreats up to ≈ 10 cm onto the shoulder so bark
   * shows on the crest itself. The curl runs 1.35 cm per 0.01 of v, the shoulder ≈ 11 cm — the
   * two scales are converted separately. Over the door (|a| < 0.55, where the entrance arch is
   * the eave and the pods hang) the edge is tamer.
   */
  const mossEdgeV = (a: number) => {
    const s = a * (capR(a) + lipR);
    const tame = lerp(0.55, 1, smoothstep(0.35, 0.8, Math.abs(angleDiff(a, 0))));
    const lobes = noise.noise(s * 1.3 + 40, 2.5);
    const fingers = Math.pow(Math.max(0, noise.noise(s * 4.5 + 11, 6.1)), 1.5);
    const gaps = smoothstep(0.42, 0.72, noise.noise(s * 2.2 + 77, 9.4));
    // metres along the meridian past the crest (+ down the curl, − up the shoulder)
    const m = (0.05 * lobes + 0.12 * fingers - 0.1 * gaps) * tame;
    return clamp(V_CAP + (m >= 0 ? m / (Math.PI * lipR / (1 - V_CAP)) : m / 11), V_CAP - 0.012, 0.94);
  };
  /** grid v → the sheet's cap parameter: the grid's rows run uniformly from the crown to the edge */
  const vMoss = (a: number, v: number) => v * mossEdgeV(a);
  /** the moss sheet's thickness over the bark eave (m): the edge rounds down through it */
  const MOSS_THICK = 0.035 * k;
  /** the edge's rounding width along the meridian (m) */
  const EDGE_ROUND = 0.045 * k;
  /** the bark eave's depth under the moss shell at v (fades to 0 where the curl meets the soffit) */
  const barkInset = (v: number) => MOSS_THICK * smoothstep(1, 0.92, v);
  /**
   * Round 40b: the cushion COLONIES — one field for the tuft placement and for the sheet between
   * them. 0.3–0.6 m colonies on the cap's own 3D noise (field mean 0.5, sd 0.16, mean slope
   * 1.37 /m over the cap); `colony(p)` is the membership, 0 in the gaps … 1 in a colony's heart.
   * The band 0.416–0.486 puts ≈ 30 % of the sheet in the gaps, ≈ 54 % in the hearts, with a
   * ≈ 5 cm transition (the sheet's grid is ≈ 4 × 9 cm, so the vertex colour carries it as about
   * one cell). The gaps are a SHADED FLOOR (`FLOOR`, × 0.43–0.46 — the shadow between cushions,
   * with the grain's pits and flecks faded there) and the hearts are lifted (`HEART`, the lit
   * tops), so at B's 10–14 m the crown reads as lit cushions on a dark bed rather than as grain —
   * the reference bough's moss has that dark-gap structure — while the cap's mean tone (frame-B
   * calibrated, rounds 14–36) holds to within a few per cent (0.3 × 0.45 + 0.54 × 1.12 + the
   * transition ≈ 0.86 of the sheet's mean, and the tufts stand on the hearts). Measured on the
   * way here: a × 0.66–0.72 floor over half the sheet moved B's cap mean −1 % and its 8–16 px
   * block contrast 0 % — the veil at 18 m and the existing ±30 % mottle swallow a cut that
   * shallow. The floor is a touch cooler than a plain luminance cut so the shade does not drift
   * yellow; floor and lift fade out where the tufts end (v 0.655–0.705), so the rim and curl
   * keep their tones.
   */
  const colonyField = (p: Vector3) => 0.5 + 0.5 * n3.noise(p.x * 2.6 + 3.1, p.y * 2.6, p.z * 2.6 - 7.7);
  const colony = (p: Vector3) => smoothstep(0.416, 0.486, colonyField(p));
  /** the floor's multipliers, and the colony hearts' lift (the lit tops; the cap's mean tone holds) */
  const FLOOR: [number, number, number] = [0.43, 0.46, 0.46];
  const HEART = 1.12;
  /** where the tufts stand (full on the crown and shoulder, none past v 0.705 — the edge rounds from 0.71) */
  const tuftZone = (v: number) => smoothstep(0.705, 0.655, v);
  const domeVertex = (a: number, v: number, out: SurfaceSample, straw: boolean) => {
    domeBase(a, v, out.position);
    domeNormal(a, v, _n);
    let disp = domeDisp(out.position, v);
    // round 40: the last ≈ 4.5 cm of the sheet round down onto the bark (a quarter-round profile),
    // so the torn edge has the thickness of a moss cushion, not a paper edge (the straw cells
    // share the sheet, so they round with it)
    if (v > 0.6) {
      const edge = mossEdgeV(a);
      const t = clamp((meridian(a, edge) - meridian(a, v)) / EDGE_ROUND, 0, 1);
      disp -= MOSS_THICK * (1 - Math.sqrt(1 - (1 - t) * (1 - t)));
      // and the very edge sits a hair under the bark's shell so the bark reads as carrying it
      disp -= 0.004 * k * (1 - t);
    }
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
    // round 40b: the colony membership here (1 = colony heart, or off the tuft zone; 0 = the
    // shaded floor between colonies); the grain's pits and flecks fade on the floor, so the gaps
    // read as smooth shadow rather than as darker grain
    const zone = tuftZone(v);
    const heart = lerp(1, colony(p), zone);
    const grainK = lerp(0.3, 1, heart);
    // (round 15: the grain's swing is up a fifth — the reference's lit mound has 8×8 tile
    // contrast 0.045 that round 14's leaf blobs, now gone, had been supplying)
    // (round 36: pits ×0.8 deep and flecks ×0.6 bright, were 0.65 / 0.4 — frame B's cap moss by
    // the roof's own mask (0.62–0.98 × 0.05–0.20) runs p10 0.216 / p90 0.597 round a median of
    // 0.436; ours 0.338 / 0.510 round 0.430: the same level, half the grain's range)
    const grain = (0.74 + 0.52 * (0.5 + 0.5 * n3.noise(p.x * 9.1, p.y * 9.1, p.z * 9.1))) * (1 - 0.8 * pit * grainK) * (1 + 0.6 * fleck * grainK);
    // (round 14: the broad mottle is halved — ±0.4 at 0.38/m was the largest coarse term left
    // once the relief's crests stopped carrying the light: moss-face 32 px blotchiness 0.064
    // against the reference's 0.038)
    // (round 15: the broad term is back up to ±0.32 at 0.45/m — the reference mound's
    // luminance tertiles run 0.37 / 0.49 / 0.62, a wide soft shading that the first round-15
    // probe, at ±0.2, rendered as a flat 0.55–0.68 field)
    // (round 40b: in the tuft zone the cushion colonies carry the coarse variation — the random
    // mottle's swing halves there so the clumps, not the mottle, are what B reads at 8–16 px;
    // the mean is untouched, and the rim and curl keep the full calibrated mottle)
    const mottleAmp = lerp(1, 0.5, zone);
    const mottle = (0.7 + 0.32 * mottleAmp * n3.fbm(p.x * 0.45 + 5, p.y * 0.45, p.z * 0.45 - 2, 2) + 0.1 * mottleAmp * n3.noise(p.x * 3.1, p.y * 3.1, p.z * 3.1 + 1)) * (1 - 0.3 * speck) * grain;
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
    // Round 36 (structures-24): both tones turn green at the same luminance (+1.5 %, paying for
    // the deeper pits above). Frame B's cap moss by the roof's own part mask reads hue 52.5° /
    // sat 0.424 with 59 % of its pixels past 55° (the green share); ours 48.5° / 0.371 / 8 % —
    // the ochre the yellow tones (52° / 59°) mix to under the warm sun and the 40° veil. The
    // deep tone goes to 63°, the lit one to 67°, and both lose a fifth of their blue.
    // (iteration 2: measured on the roof's own pixels in B's cap-moss box — hue 48.5° → 52.0°,
    // green share 0.082 → 0.681, p50 0.430 → 0.431 against the frame's 52.5° / 0.586 / 0.436;
    // saturation stayed at 0.370 against 0.424 and p90 at 0.510 against 0.597, so the lit tone
    // goes ×1.06 and both lose another third of their blue)
    const deep: [number, number, number] = [0.24, 0.25, 0.03];
    const sun: [number, number, number] = [0.78, 0.87, 0.1];
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
    // round 40b: the shaded floor between the cushion colonies, the hearts lifted
    const lift = lerp(1, HEART, zone);
    out.color = [lerp(deep[0], sun[0], bright) * m * lerp(FLOOR[0], lift, heart), lerp(deep[1], sun[1], bright) * m * lerp(FLOOR[1], lift, heart), lerp(deep[2], sun[2], bright) * m * lerp(FLOOR[2], lift, heart)];
  };
  const domeMoss = gridSurface((u, v, out) => domeVertex(u * TAU, vMoss(u * TAU, v), out, false), {
    cols: roofRes,
    rows: roofRows,
    closedU: true,
    hole: (u, v) => {
      const straw = isThatchCell(u, v);
      // (the area accounting runs on the sheet's own parameter — round 40's `vMoss`)
      const vm = vMoss(u * TAU, v);
      if (vm <= V_CAP) {
        const area = cellArea(u, v);
        if (straw) thatchArea += area;
        else mossArea += area;
        if (smoothstep(0.35, 0.75, patchNoise(_tc)) * smoothstep(1, 0.7, vm) > 0.5) thatch11Area += area;
      }
      return straw;
    },
  });
  const domeStraw = gridSurface((u, v, out) => domeVertex(u * TAU, vMoss(u * TAU, v), out, true), {
    cols: roofRes,
    rows: roofRows,
    closedU: true,
    hole: (u, v) => !isThatchCell(u, v),
  });
  /**
   * Round 40: the BARK EAVE under the torn moss edge — the rim curl from the shoulder (v 0.62,
   * under the moss) round to the soffit, `MOSS_THICK` inside the shell (fading to the shell at
   * the soffit so the two meet flush), in the recess bark with cords running down over the curl
   * like the trunk's bundles continuing up into the eave, cut by fissures; darkening toward the
   * soffit's tone at the bottom. Where the moss covers it, it is hidden 3.5 cm under the sheet;
   * below the edge and in the gaps it is what the owner asked to see: bark through the moss.
   * Same material and flags as the soffit, so it folds into the soffit's draw.
   */
  const eaveBark = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const vc = lerp(0.62, 1, v);
      domeBase(a, vc, out.position);
      domeNormal(a, vc, _n);
      out.position.addScaledVector(_n, domeDisp(out.position, vc) - barkInset(vc));
      const lip = smoothstep(V_CAP, 1, vc);
      out.position.y -= lip * (0.06 + 0.1 * noise.noise(a * R * 1.1, 3.3) + 0.05 * noise.noise(a * R * 4, 7)) * k;
      const s = meridian(a, vc);
      out.uv = [(a * capR(a)) / 2.2, s / 2.2];
      // cords down the curl (ridged along the arc), fissures between bundles, a lit crest tint
      const arc = a * (capR(a) + lipR);
      const cord = noise.ridged(arc * 3.2 + 3, s * 0.8, 2) - 0.5;
      const fis = smoothstep(0.56, 0.72, noise.noise(arc * 2.4 + 21, s * 1.5 + 4));
      const crest = clamp(cord * 2.2, -1, 1);
      const ao = Math.max(0.15, 1 + 0.6 * crest) * (1 - 0.6 * fis);
      // the eave band's tone (recess bark under the trunk's eave shade), darkening to the soffit
      const down = smoothstep(0.8, 1, vc);
      const d = lerp(0.42, 0.24, down) * ao;
      out.color = [d, d * 0.86, d * 0.68];
    },
    { cols: Math.round(roofRes * 0.6), rows: 18, closedU: true },
  );
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
      // (round 22: darker still — the reference's shadow band under the moss edge is the darkest
      // strip on the house's front, 0.29–0.33 with a quarter of it under 0.25)
      out.color = [0.2, 0.19, 0.15];
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
  const eaveBarkMesh = new Mesh(eaveBark, mats.recessBark);
  eaveBarkMesh.name = 'roof-eave-bark';
  eaveBarkMesh.castShadow = eaveBarkMesh.receiveShadow = true;
  group.add(eaveBarkMesh);

  // ---- round 40: MOSS CUSHION TUFTS — the close-scale structure the owner's review asked for
  // ("distinct close-scale tufts … not another broad smooth green layer"). Squat lumps 4–12 cm
  // across (most 4–7) standing on the sheet, area-uniform over the cap top, densest on the crown
  // and thinning over the shoulder to nothing at the moss edge (`tuftKeep`); each takes the
  // sheet's own vertex colour and uv where it stands (the mottle, canopy shade and albedo map run
  // over it), a lit top and a dark rim (mossTufts.ts), a lobed outline from the cap's own 3D
  // noise. Merged into ONE geometry on the cap-moss material with the sheet's attribute layout;
  // castShadow off (4 cm lumps are below the shadow map's texel, and a shadow pass over 150 k
  // triangles would double their cost) so they form their own bucket — both houses' tuft meshes
  // fold into one draw. Own rng fork after every earlier stream, so nothing else moves. ----
  const tuftRng = rng.fork('moss-tufts');
  const tuftSpecs: MossTuftSpec[] = [];
  {
    const attempts = def.id === 'saria' ? 9000 : 2800;
    const _ts = { position: new Vector3() } as SurfaceSample;
    /** acceptance by cap parameter: full on the crown, ≈ 0.6 over the shoulder, 0 past the edge */
    const tuftKeep = (v: number) => lerp(1, 0.6, smoothstep(0.32, 0.58, v)) * tuftZone(v);
    /**
     * cushion clumping: the tufts gather into the 0.3–0.6 m colonies (`colony`, shared with the
     * sheet's shaded floor) with a few stragglers on the floor between — the reference bough's
     * moss reads as clumped cushions with dark gaps at 8–15 m; a uniform scatter of 5 cm lumps
     * averages back to a smooth field at that distance
     */
    const clump = (p: Vector3) => lerp(0.12, 1, colony(p));
    for (let i = 0; i < attempts; i++) {
      const a = tuftRng() * TAU;
      // area-uniform on the cap top (r ∝ q on the plateau)
      const v = Math.sqrt(tuftRng()) * 0.72;
      if (tuftRng() > tuftKeep(v)) continue;
      // radius 2.2–6 cm, skewed small; footprint aspect 0.75–1.3; height 0.6–1.0 of the radius
      const r = (0.022 + 0.038 * Math.pow(tuftRng(), 1.3)) * sk;
      const aspect = 0.75 + tuftRng() * 0.55;
      domeVertex(a, v, _ts, false);
      if (tuftRng() > clump(_ts.position)) continue;
      // the sheet's normal at (a, v) is left in `_n` by domeVertex
      tuftSpecs.push({
        position: _ts.position.clone(),
        normal: _n.clone(),
        rx: r * aspect,
        rz: r / aspect,
        h: r * (0.6 + tuftRng() * 0.4),
        yaw: tuftRng() * TAU,
        color: _ts.color ?? [0.5, 0.5, 0.1],
        uv: _ts.uv ?? [0, 0],
        sink: r * 0.3,
        seed: 1 + Math.floor(tuftRng() * 1e6),
      });
    }
  }
  const tufts = buildMossTufts(tuftSpecs, n3);
  const tuftMesh = new Mesh(tufts.geometry, mats.capMoss);
  tuftMesh.name = 'roof-tufts';
  tuftMesh.castShadow = false;
  tuftMesh.receiveShadow = true;
  group.add(tuftMesh);
  if (site.farTufts) {
    const farMesh = new Mesh(buildMossTufts(tuftSpecs, n3, FAR_TUFTS).geometry, mats.capMoss);
    farMesh.name = 'roof-tufts-far';
    farMesh.castShadow = false;
    farMesh.receiveShadow = true;
    group.add(farMesh);
  }
  /** round 40 audit: the tufts and the torn edge, as built */
  const mossDetail = (() => {
    const radii = tuftSpecs.map((t) => (t.rx + t.rz) * 0.5);
    const r3 = (x: number) => Math.round(x * 1000) / 1000;
    let edgeMin = Infinity;
    let edgeMax = -Infinity;
    let barkAbove = 0;
    const N = 96;
    for (let i = 0; i < N; i++) {
      const e = mossEdgeV((i / N) * TAU);
      edgeMin = Math.min(edgeMin, e);
      edgeMax = Math.max(edgeMax, e);
      if (e < V_CAP) barkAbove++;
    }
    return {
      tufts: tufts.count,
      tuftTriangles: tufts.triangles,
      tuftDiameterM: radii.length ? { min: r3(2 * Math.min(...radii)), max: r3(2 * Math.max(...radii)), mean: r3((2 * radii.reduce((s, r) => s + r, 0)) / radii.length) } : null,
      /** the moss edge's range on the curl (v; the curl runs V_CAP..1) and the share of the rim where bark shows on the crest */
      edgeV: { min: r3(edgeMin), max: r3(edgeMax), rimTop: V_CAP },
      barkOnCrestShare: r3(barkAbove / N),
      mossThicknessM: r3(MOSS_THICK),
    };
  })();

  // ---- living branches curling over the cap (pale bark) + limbs + chimney branch ----
  const branchRng = rng.fork('branches');
  const surfacePoint = (a: number, v: number, lift: number) => {
    const p = domeBase(a, v);
    const n = domeNormal(a, v);
    return p.addScaledVector(n, domeDisp(p, v) * 0.6 + lift);
  };
  /**
   * Round 46 (structures-29, survey-2 #08 "root arcs = smooth tubes with painted grain"): BARK
   * CORDS on every bough and limb — a ridged field periodic ROUND the tube (the angle mapped onto
   * a circle in noise space, so there is no seam) that drifts slowly ALONG it, ± 9 % of the local
   * radius, with narrow dark fissures between the cords and small lumps. The number of cords
   * round the tube grows with its radius (≈ 7 on a 0.15 m limb, ≈ 19 on the 0.5 m arc), and the
   * radial resolution follows (`cordSegs`). Rounds 8–45's `ridged(ang · 1.5 + t · 6, pos.y)`
   * put the ridges across the bough, which read as a painted stripe pattern at 4 m
   * (w26-stairs-l). Colour: the crests a shade paler, grime in the fissures.
   */
  const boughCords = (seed: number, len: number, r0: number, deep = false) => {
    const ring = clamp(r0 / 0.16, 1.15, 3.2);
    const cord = (t: number, ang: number) => noise.ridged(Math.cos(ang) * ring + seed * 3.1, Math.sin(ang) * ring + t * len * 0.32 + seed * 0.7, 2);
    const fissure = (t: number, ang: number) => Math.pow(1 - Math.abs(noise.noise(Math.cos(ang) * ring * 1.4 + seed * 5.3 + 20, Math.sin(ang) * ring * 1.4 + t * len * 0.22)), 7);
    // `deep` (round 46, second cut): the pale limbs' material (`barkPale`, HOUSE_BARK_FLOOR
    // texture 0.6) lies in the canopy's shade, where the floor's light is flat — the cords'
    // relief casts no shading there and only the vertex tint carries them, compressed to 0.6
    // by the floor's flat share; w26-stairs-l at 4 m still read the draped limb as a smooth
    // tube (hide-test: `roof-branches`). The pale limbs take a wider crest/fissure swing.
    const lo = deep ? 0.55 : 0.74;
    const hi = deep ? 1.22 : 1.12;
    const fk = deep ? 0.68 : 0.5;
    return {
      segs: Math.max(12, Math.round(ring * 13)),
      displace: (t: number, ang: number, r: number) => ((cord(t, ang) - 0.5) * 0.09 - fissure(t, ang) * 0.06) * r + (noise.noise(ang * 3.4 + seed * 7.3, t * len * 0.5 + 40) - 0.5) * 0.04 * r,
      /** [crest/fissure shade multiplier, fissure weight] */
      shade: (t: number, ang: number): [number, number] => {
        const f = fissure(t, ang);
        return [lerp(lo, hi, cord(t, ang)) * (1 - fk * f), f];
      },
      tint: (base: [number, number, number], t: number, ang: number): [number, number, number] => {
        const f = fissure(t, ang);
        const s = lerp(lo, hi, cord(t, ang)) * (1 - fk * f);
        return [base[0] * s, base[1] * s * (1 - 0.04 * f), base[2] * s * (1 - 0.08 * f)];
      },
    };
  };
  /**
   * Moss along a corded bough's top, in the sweep's colour callback: the same gate and patch
   * field as `mossOnTop` but on the UNDISPLACED tube normal's y (`up`, sweepTube's third colour
   * argument) — the cords' recomputed normals swing ± 60° round each cord, and through
   * `mossOnTop`'s normal gate the moss came out as broken flecks on the cord flanks (w26-stairs-l,
   * the first corded cut: the arc's mossy top read bare). `spread` as in `mossOnTop`.
   */
  const mossAlong = (base: [number, number, number], up: number, t: number, ang: number, len: number, seed: number, amount: number, spread = 0): [number, number, number] => {
    const patch = 0.45 + 0.55 * noise.fbm(t * len * 1.7 + 3 + seed * 11, ang * 1.2 + seed, 2);
    const w = clamp(smoothstep(0.25 - spread, 0.85 - spread, up) * patch * amount, 0, 1);
    return [lerp(base[0], 0.36, w), lerp(base[1], 0.8, w), lerp(base[2], 0.25, w)];
  };
  /** the cap's moss surface under (angle a, horizontal radius r) — the arc bough rests on it */
  const _cs = new Vector3();
  const capSurfaceAt = (a: number, r: number, lift: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 60; i++) {
      const v = (i / 60) * V_CAP;
      domeBase(a, v, _cs);
      const d = Math.abs(Math.hypot(_cs.x - frame.C.x, _cs.z - frame.C.z) - r);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return surfacePoint(a, best, lift);
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
    const curve0 = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    // Round 46 (structures-29, survey-2 #08, w26-stairs-l — the hide-test named `roof-branches`
    // under the survey's "root arc"): the limb's centre line is RESAMPLED ONTO THE CAP. The
    // spline through five or six waypoints half-sunk in the moss bulged clear of the dome between
    // them (a Catmull-Rom through points on a convex surface overshoots outward), and from the
    // plateau, level with the limb at 4 m, that showed as a shadow gap under a floating tube. 24
    // samples along the first spline are each dropped to the moss surface under them (same house
    // angle and horizontal radius) at 0.2 × the local radius, the underside 0.8 r in the moss.
    // No new rng draws; the waypoints' jitter is kept in the samples.
    const seated: Vector3[] = [];
    for (let si = 0; si <= 24; si++) {
      const f = si / 24;
      const q = curve0.getPointAt(f);
      const dx = q.x - frame.C.x;
      const dz = q.z - frame.C.z;
      const aQ = Math.atan2(dx * frame.Rt.x + dz * frame.Rt.z, dx * frame.F.x + dz * frame.F.z);
      seated.push(capSurfaceAt(aQ, Math.hypot(dx, dz), 0.2 * lerp(b.r0, b.r1, f) * k));
    }
    const curve = new CatmullRomCurve3(seated, false, 'catmullrom', 0.5);
    const twist = branchRng() * 10;
    const drapedR = (t: number) => lerp(b.r0, b.r1, t) * k * (1 + 0.14 * Math.sin(t * 9 + twist) + 0.08 * Math.sin(t * 23 + twist * 2));
    const drapedCords = boughCords(10 + bi, curve.getLength(), b.r0 * k, true);
    const geo = sweepTube(curve, {
      radius: drapedR,
      tubularSegments: 48,
      radialSegments: drapedCords.segs,
      uvMetres: 1.2,
      displace: (t, ang) => drapedCords.displace(t, ang, drapedR(t)),
      // (round 46: the cap's moss on the limbs' tops, creeping a little down the flanks — they
      // lie sunk in it; second cut 0.4 → 0.75 / spread 0.2, a level camera sees the flanks)
      color: (t, ang, up) => mossAlong(drapedCords.tint(limbColor(t, ang), t, ang), up, t, ang, curve.getLength(), 10 + bi, 0.75, 0.2),
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
    // the canopy's shade), lit along the top (round 34: the trunk's lit-albedo share — camera D
    // sees the arc bough's lower run sunlit against its bank)
    const d = 0.74 * TRUNK_LIT_ALBEDO * (0.82 + 0.3 * Math.max(0, Math.sin(ang)));
    return [d, d * 0.97, d * 0.88];
  };
  /** the limbs above the eave sit in the canopy's shade: reference B reads them at lum
   *  0.27–0.35 against the hazed canopy (0.45–0.5), so their bark is held well below the sunlit
   *  legs' — `shade` 0 = sunlit, 1 = fully shaded */
  const shadedColor = (t: number, ang: number, shade: number): [number, number, number] => supportColor(t, ang).map((c) => c * lerp(1, 0.42, shade)) as [number, number, number];
  /** the boughs' moss (round 34: ×0.7 of the round-14 lit green [0.5, 1.12, 0.34] — the sheets on the
   *  sunlit lower run read as the bank's dark moss in D, the shaded upper run keeps its level) */
  const mossTint: [number, number, number] = [0.36, 0.8, 0.25];
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
      // Round 46 (structures-29, survey-2 #08 "floating gap"): the run BEHIND the crown RESTS ON
      // THE MOSS — rounds 15–45 held it clear of the cap by about its own diameter (crownY − 0.7 /
      // − 0.1 / + 0.45), and from the plateau (w26-stairs-l) that showed as a dark shadow gap
      // between the bough and the dome under it. The three waypoints over the cap now sit on the
      // cap's own moss surface at 0.4 × the local radius (the underside 0.6 r into the moss);
      // the two that B can see the rise from (2.1, 1.75 …) are unchanged. Same jit draws.
      capSurfaceAt(-2.2, 0.85 * capR(-2.2), 0.4 * 0.37 * k).add(jit(0.1)),
      capSurfaceAt(-2.9, 0.62 * capR(-2.9), 0.4 * 0.33 * k).add(jit(0.1)),
      capSurfaceAt(2.6, 0.62 * capR(2.6), 0.4 * 0.3 * k).add(jit(0.08)),
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
    const arcCords = boughCords(1, arcCurve.getLength(), 0.5 * k);
    const arc = sweepTube(arcCurve, {
      radius: arcR,
      tubularSegments: 120,
      radialSegments: arcCords.segs,
      uvMetres: 1.4,
      displace: (t, ang) => arcCords.displace(t, ang, arcR(t)),
      // (round 34: spread 0.3 — the sheets wrap down the flank D sees; round 46: laid in the
      // colour callback on the undisplaced normal, see `mossAlong`)
      color: (t, ang, up) => mossAlong(arcCords.tint(shadedColor(t, ang, arcShade(t)), t, ang), up, t, ang, arcCurve.getLength(), 1, 0.85, 0.3),
      capEnd: true,
    });
    // (round 36: the lower run, which D sees rising out of its bank, takes the D-side sheet in
    // the bank's dark green)
    if (dSide) mossBySide(arc, frame, D_MOSS_TINT, noise, dSide);
    supportParts.push(arc);
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
      const limbCurve = new CatmullRomCurve3([from, mid, into], false, 'catmullrom', 0.5);
      const limbR = (s: number) => r0 * k * (1 - 0.45 * s) * (1 + 0.1 * Math.sin(s * 13 + t * 20));
      const limbCords = boughCords(2 + t, limbCurve.getLength(), r0 * k);
      const limb = sweepTube(limbCurve, {
        radius: limbR,
        tubularSegments: 16,
        radialSegments: limbCords.segs,
        uvMetres: 1.4,
        displace: (s, ang) => limbCords.displace(s, ang, limbR(s)),
        color: (s, ang, up) => mossAlong(limbCords.tint(shadedColor(s, ang, 0.8), s, ang), up, s, ang, limbCurve.getLength(), 2 + t, 0.7),
        capEnd: true,
      });
      supportParts.push(limb);
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
      const upR = (s: number) => (0.17 - 0.1 * s) * k * (1 + 0.1 * Math.sin(s * 11 + 2));
      const upCords = boughCords(4, upCurve.getLength(), 0.17 * k);
      const upLimb = sweepTube(upCurve, {
        radius: upR,
        tubularSegments: 14,
        radialSegments: upCords.segs,
        uvMetres: 1.4,
        displace: (s, ang) => upCords.displace(s, ang, upR(s)),
        color: (s, ang, up) => mossAlong(upCords.tint(shadedColor(s, ang, 0.8), s, ang), up, s, ang, upCurve.getLength(), 4, 0.5),
        capEnd: true,
      });
      supportParts.push(upLimb);
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
    const stubCords = boughCords(5, stubCurve.getLength(), 0.34 * k);
    const stub = sweepTube(stubCurve, {
      radius: stubR,
      tubularSegments: 18,
      radialSegments: stubCords.segs,
      uvMetres: 1.2,
      // bark cords along the limb (round 46); the broken end flares a little and is jagged
      displace: (t, ang) => stubCords.displace(t, ang, stubR(t)) + smoothstep(0.85, 1, t) * (0.05 + 0.08 * Math.abs(Math.sin(ang * 5 + 1))) * k,
      color: (t, ang, up) => (t > 0.985 ? [0.2, 0.16, 0.12] : mossAlong(stubCords.tint(supportColor(t, ang), t, ang), up, t, ang, stubCurve.getLength(), 5, 0.6)),
      capEnd: true,
    });
    supportParts.push(stub);
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
  {
    const rightR = (t: number) => (0.42 - 0.2 * t) * k * (1 + 0.08 * Math.sin(t * 8 + 1) + 0.05 * Math.sin(t * 21));
    const rightCords = boughCords(6, rightCurve.getLength(), 0.42 * k);
    branchParts.push(
      sweepTube(rightCurve, {
        radius: rightR,
        tubularSegments: 28,
        radialSegments: rightCords.segs,
        uvMetres: 1.2,
        displace: (t, ang) => rightCords.displace(t, ang, rightR(t)),
        color: (t, ang, up) => mossAlong(rightCords.tint(limbColor(t, ang), t, ang), up, t, ang, rightCurve.getLength(), 6, 0.4),
        capEnd: true,
      }),
    );
  }
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
    const chimCurve = new CatmullRomCurve3(pts);
    const chimR = (t: number) => (0.26 - 0.06 * t) * k;
    const chimCords = boughCords(7, chimCurve.getLength(), 0.26 * k);
    const chimney = sweepTube(chimCurve, {
      radius: chimR,
      tubularSegments: 10,
      radialSegments: chimCords.segs,
      uvMetres: 1.0,
      displace: (t, ang) => chimCords.displace(t, ang, chimR(t)),
      color: (t, ang) => (t > 0.985 ? [0.12, 0.1, 0.08] : chimCords.tint(limbColor(t, ang), t, ang)),
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
  const hangers: BufferGeometry[] = [];
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
      hook = line.clone();
      // round 48: a second-rank pod hangs from the soffit in the porch recess, `back` m behind the line
      if (spec.back) hook.addScaledVector(F, -spec.back * k);
      const r = Math.hypot(hook.x - frame.C.x, hook.z - frame.C.z);
      // (a second-rank pod is behind the arch body: its cord is tied to the soffit alone)
      hook.y = Math.max(line.y, (spec.back ? yFloor + soffitY(spec.a, r) : Math.min(yFloor + soffitY(spec.a, r), archUnderY(lateralOf(hook)))) - 0.03);
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
    // round 55: a cord tied to the soffit / arch now hangs from a pinned toggle (the pegs carry their own)
    if (spec.hook === 'bough' || spec.hook === 'eave') {
      const d = frame.dir(spec.a);
      hangers.push(lanternHanger(hook, new Vector3(-d.z, 0, d.x), k));
    }
    const rig = buildLantern(hook, cord, mats, lanternRng, spec.scale ?? 1.0, spec.tint ?? 'orange');
    if (spec.tint === 'lime') limeCount++;
    group.add(rig.pivot);
    lanterns.push(rig);
    podPositions.push(rig.pod);
  }
  if (hangers.length) {
    const hangerMesh = new Mesh(merge(hangers), mats.woodDark);
    hangerMesh.name = 'lantern-hanger';
    hangerMesh.castShadow = true;
    group.add(hangerMesh);
  }
  if (podPositions.length) {
    const c = new Vector3();
    for (const p of podPositions.slice(0, 2)) c.add(p);
    c.divideScalar(Math.min(2, podPositions.length));
    c.addScaledVector(F, 0.35);
    // sit the shared glow below the pods' bellies (they light downward: the reference spills
    // warm light on the threshold and sign, and the branch they hang from stays dark)
    // Round 22: 0.9 m below the pods (was 0.28) at 4 cd (was 6.5). Measured in B: half a metre
    // from the pods the light put a hot spot on the arch's underside and the porch wall over the
    // door (x 0.70–0.80 × y 0.35–0.40: p50 0.392, p25 0.337 against the reference's 0.266 /
    // 0.256 — there the pods hang against dark bark with only a faint halo); with the light off
    // that band read 0.315 but the threshold's spill (x 0.74–0.86 × y 0.52–0.58) fell 0.299 →
    // 0.285 under the reference's 0.301. Lower and dimmer: the underside is 2.5× further from the
    // light (a fifth of the hot spot), the threshold as close as before.
    c.y -= 0.9 * k;
    // the shared glow takes on the mix of pod colours
    const glow = new Color(ctx.config.palette.lanternGlow).lerp(new Color(LIME_POD_GLOW), limeCount / podPositions.length);
    const lanternLight = new PointLight(glow, 4.0, 6, 2);
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

  // ---- round 21: ENTRANCE VINES, WALL VINES and a SHAGGY EAVE, on a second foliage builder
  // (own rng forks, own noise seed) built after the first, so every existing leaf, tuft, vine,
  // flower and pod keeps its draws; its meshes fold into the same leaf / vine / tuft buckets in
  // `consolidateStaticMeshes` (no new draw). Reference B at 2×: a vine of big heart leaves
  // (0.15–0.25 m) runs along the arch crown's top-front edge from the left shoulder past the
  // centre and drops strands down the body's face to the pods' height (frame x 0.70–0.81,
  // y 0.22–0.33); more big leaves hang over both shoulders and down the wall sides; the eave is
  // a broken fringe of hanging moss and grass every 0.2–0.4 m with leaf clumps standing on the
  // rim. Ours had 20 short rim strands of 7.5 cm leaves, 26 fringe clumps and a clean rim. ----
  const foliage21 = new FoliageBuilder(rng.fork('foliage21'), `${ctx.config.seed}/house21/${def.id}`);
  /** the arch body's top-front edge at t (where a vine lies over the crown) */
  const archTopFront = (t: number, out = new Vector3()) => {
    archCurve.getPointAt(t, out);
    const r = archRadius(t);
    out.y += r * 0.72;
    out.addScaledVector(F, r * 0.62);
    return out;
  };
  /** the curve parameter nearest a world point */
  const archTOf = (p: Vector3) => {
    let best = Infinity;
    let bt = 0.5;
    for (let i = 0; i <= 200; i++) {
      const d = archCurve.getPointAt(i / 200, _ap).distanceToSquared(p);
      if (d < best) {
        best = d;
        bt = i / 200;
      }
    }
    return bt;
  };
  const tShoulderL = archTOf(archShoulder(-1));
  const tShoulderR = archTOf(archShoulder(1));
  const vine21 = rng.fork('vines21');
  {
    // (a) the arch-crown vine, along the top-front edge from the left shoulder over the left
    // third of the crown, with big leaves every 11 cm
    // (round 36: was to 0.56 of the span with 9 strands of 0.4–0.9 m — frame B's crown front
    // (0.70–0.86 × 0.235–0.31) has a green share of 0.030 and ours 0.209, its foliage 15 % of the
    // box by part mask; the frame's entrance leaves sit at the crown's left end and by the pods'
    // hooks, so the vine stops at 0.36 and four strands of 0.3–0.6 m hang off it)
    const pts: Vector3[] = [];
    const nrms: Vector3[] = [];
    const t0 = tShoulderL + 0.01;
    const t1 = lerp(tShoulderL, tShoulderR, 0.36);
    for (let i = 0; i <= 8; i++) {
      const p = archTopFront(lerp(t0, t1, i / 8));
      p.x += (vine21() - 0.5) * 0.06;
      p.z += (vine21() - 0.5) * 0.06;
      pts.push(p);
      nrms.push(F.clone().setY(0.8).normalize());
    }
    // (leaf sizes 0.2–0.25 m: the reference's entrance leaves span 20–25 px of the 1280 frame at
    // 14 m — ≈ 0.22 m; a first pass at 0.14–0.15 m rendered as specks along the vine)
    foliage21.addSurfaceVine(pts, nrms, { leafSize: 0.24 * sk, leafEvery: 0.1, amount: 0.05, thickness: 0.022 });
    // strands off it hanging down the body's face in front of it, 0.4–0.9 m (their ends stay
    // above the pods, whose caps hang from the body's underside), big leaves every 9 cm
    for (let i = 0; i < 4; i++) {
      const hook = archTopFront(lerp(t0, t1, (i + 0.3 + vine21() * 0.4) / 4));
      hook.addScaledVector(F, 0.05);
      const len = (0.3 + vine21() * 0.3) * k;
      foliage21.addHangingVine(hook, len, { drift: F.clone().multiplyScalar(0.25 + vine21() * 0.2), leafSize: 0.22 * sk, leafEvery: 0.09, amount: 0.1, thickness: 0.016 });
    }
    // (b) the LEFT shoulder: a big drooping clump over the shoulder knot's top-front spilling
    // leaves down the leg's outer face, and two strands off it
    // (round 36: the right shoulder's clump and strands are gone — frame B's shoulder box
    // (0.86–0.94 × 0.28–0.34) is bare dark bark, green share 0.000, where ours was 0.43 with
    // this clump 19 % of the box and its strands the green on the right pillar below)
    for (const side of [-1] as const) {
      const c = archShoulder(side).addScaledVector(F, 0.35 * k).addScaledVector(Rt, side * 0.15 * k);
      c.y += 0.3 * k;
      foliage21.addLeafCluster(c, 0.6 * k, 56, { size: 0.22 * sk, amount: 0.06, droop: 0.85, tint: leafTint, tintSpread: 0.3, flatten: 0.6 });
      for (let i = 0; i < 2; i++) {
        const hook = c.clone().addScaledVector(Rt, side * (0.15 + i * 0.25) * k);
        hook.y -= 0.2 * k;
        foliage21.addHangingVine(hook, (0.6 + vine21() * 0.5) * k, { leafSize: 0.2 * sk, leafEvery: 0.09, amount: 0.1 });
      }
    }
    // (c) down the wall sides: strands off the wall's eave band either side of the arch with a
    // clump at each hook — kept off the window (a −1.25 … −0.9) and the door span
    // (round 36: Saria's right-wall strands (a 0.55–0.9) are gone — they hung exactly in frame B's
    // shoulder box (a 0.55–0.9 projects to B x 0.86–0.90 at y 0.34), 5.4 % of it after the clump
    // went, where the frame has bare bark)
    const wallVines: number[] = def.id === 'saria' ? [-0.82, -0.68, -0.56] : [-0.7, 0.7];
    for (const a0 of wallVines) {
      const a = a0 + (vine21() - 0.5) * 0.06;
      const y = wallTop - 0.05 * k;
      const hook = frame.at(a, rSmooth(a, y) + 0.08 * k, y);
      foliage21.addLeafCluster(hook.clone().addScaledVector(frame.dir(a), 0.08 * k), 0.34 * k, 26, { size: 0.2 * sk, amount: 0.06, droop: 0.8, tint: leafTint, tintSpread: 0.3, flatten: 0.5 });
      foliage21.addHangingVine(hook, (0.8 + vine21() * 0.7) * k, { drift: frame.dir(a).multiplyScalar(0.15), leafSize: 0.2 * sk, leafEvery: 0.09, amount: 0.1 });
    }
  }
  // the SHAGGY EAVE: hanging moss / grass beards off the rim's outer-lower face (v 0.86–0.92)
  // every ≈ 0.3 m of arc over the front 300°, a leaf clump drooping off every fourth, and leaf
  // clumps standing on the rim's shoulder breaking the eave's upper line; over the door
  // (|a| < 0.55), where the arch crown is the eave, the beards hang from the body's top-front
  // edge. Tints: the beards hang in the rim's shade as dark damp olive (the reference eave's
  // fringe is near the haze floor, not lit grass — a first pass at a quarter of the moss-lit
  // grass tint rendered bright green brushes), the standing clumps a third of the moss-lit leaf.
  const beard21 = rng.fork('beards21');
  const beardShade: [number, number, number] = [0.8, 0.95, 0.5];
  const beardLeaf: [number, number, number] = [1.2, 0.8, 0.9];
  const standTint: [number, number, number] = [1.3, 0.8, 0.9];
  {
    let a = -2.6;
    let i = 0;
    while (a < 2.6) {
      a += (0.3 * (0.8 + beard21() * 0.5)) / (capR(a) + lipR);
      if (Math.abs(a) < 0.55) continue;
      const v = 0.86 + beard21() * 0.06;
      const p = surfacePoint(a, v, 0);
      const dir = frame.dir(a).multiplyScalar(0.45);
      dir.y -= 1;
      dir.normalize();
      foliage21.addTuft(p, dir, (0.3 + beard21() * 0.25) * sk, 0, 0.06, beardShade);
      if (i % 4 === 0) foliage21.addLeafCluster(p.clone().addScaledVector(dir, 0.12 * k), 0.2 * k, 10, { size: 0.16 * sk, amount: 0.06, droop: 0.95, tint: beardLeaf, tintSpread: 0.3, flatten: 0.6 });
      i++;
    }
    for (let j = 0; j < 9; j++) {
      const p = archTopFront(lerp(tShoulderL + 0.02, tShoulderR - 0.02, (j + beard21()) / 9));
      p.addScaledVector(F, 0.04);
      const dir = F.clone().multiplyScalar(0.35);
      dir.y -= 1;
      dir.normalize();
      foliage21.addTuft(p, dir, (0.3 + beard21() * 0.15) * sk, 0, 0.06, beardShade);
    }
    const standing = def.id === 'saria' ? 12 : 6;
    for (let j = 0; j < standing; j++) {
      const a = -1.9 + (j / (standing - 1)) * 3.8 + (beard21() - 0.5) * 0.25;
      const v = 0.62 + beard21() * 0.08;
      const p = surfacePoint(a, v, 0.02);
      const n = domeNormal(a, v);
      n.y += 0.5;
      n.normalize();
      foliage21.addLeafCluster(p.addScaledVector(n, 0.12 * k), (0.24 + beard21() * 0.1) * k, 16, { size: 0.18 * sk, amount: 0.06, droop: 0.35, tint: standTint, tintSpread: 0.25, flatten: 0.5 });
    }
  }
  for (const m of foliage21.build(mats, `house21-${def.id}`)) group.add(m);

  // ---- round 40 (structures-25): SMALL PLANTS GROWING OUT OF THE MOSS — the owner's frame-03
  // bough and board 05 ("Lichen / Small Plants", "Moss on Branch") show moss cushions with little
  // plants rooted in them: trefoil sorrel / clover leaves, small fern fronds and a few grass tufts.
  // On the crown and shoulders (v 0.05–0.62; the rim and the doorway stay clear), standing on the
  // sheet's true displaced surface. Tints are set against the moss they grow in: the leaves a
  // fresher, less yellow green than the moss-lit tone (a plant, not a moss patch, but not the
  // round-15 "dark disconnected blobs" — the coverage stays a few per cent), the ferns a mid
  // green, the grass a little under the moss-lit grass. Third foliage builder, own rng forks, so
  // every earlier plant keeps its draws; the meshes fold into the leaf / tuft buckets. ----
  const foliage40 = new FoliageBuilder(rng.fork('foliage40'), `${ctx.config.seed}/house40/${def.id}`);
  const plant40 = rng.fork('plants40');
  const plants40 = { sorrel: 0, ferns: 0, grass: 0 };
  {
    const SORREL_TINT: [number, number, number] = [1.7, 1.6, 1.5];
    const FERN40_TINT: [number, number, number] = [2.3, 2.1, 2.2];
    const GRASS40_TINT: [number, number, number] = [MOSS_LIT_GRASS[0] * 0.72, MOSS_LIT_GRASS[1] * 0.78, MOSS_LIT_GRASS[2] * 0.72];
    /** the sheet's true surface point and normal at (a, v) — displaced in full, unlike `surfacePoint` */
    const onSheet = (a: number, v: number) => {
      const p = domeBase(a, v);
      const n = domeNormal(a, v);
      p.addScaledVector(n, domeDisp(p, v));
      return { p, n };
    };
    /** keep the doorway's sight-line and the front lip clear: thin the front face's lower shoulder */
    const keep = (a: number, v: number) => plant40() > 0.5 * smoothstep(1.1, 0.4, Math.abs(angleDiff(a, 0))) * smoothstep(0.4, 0.55, v);
    // sorrel / clover: trefoils of 5–9 cm heart leaves on a 2–4 cm stem, in loose colonies
    const colonies = def.id === 'saria' ? 16 : 8;
    for (let c = 0; c < colonies; c++) {
      const a0 = plant40() * TAU;
      const v0 = 0.06 + Math.pow(plant40(), 0.7) * 0.55;
      const members = 2 + Math.floor(plant40() * 3);
      for (let m = 0; m < members; m++) {
        const a = a0 + ((plant40() - 0.5) * 0.5) / Math.max(0.6, capR(a0) * (v0 / V_CAP));
        const v = clamp(v0 + (plant40() - 0.5) * 0.05, 0.05, 0.62);
        if (!keep(a, v)) continue;
        const { p, n } = onSheet(a, v);
        const stem = (0.02 + plant40() * 0.02) * sk;
        const size = (0.05 + plant40() * 0.04) * sk;
        const yaw0 = plant40() * TAU;
        const leaflets = plant40() < 0.25 ? 4 : 3;
        const tintK = 0.85 + plant40() * 0.35;
        const tint: [number, number, number] = [SORREL_TINT[0] * tintK, SORREL_TINT[1] * tintK, SORREL_TINT[2] * tintK];
        const base = p.clone().addScaledVector(n, stem);
        // tangent frame on the sheet
        const T = new Vector3(-n.z, 0, n.x);
        if (T.lengthSq() < 1e-6) T.set(1, 0, 0);
        T.normalize();
        const B = new Vector3().crossVectors(n, T);
        for (let j = 0; j < leaflets; j++) {
          const yaw = yaw0 + (j / leaflets) * TAU + (plant40() - 0.5) * 0.4;
          const dir = new Vector3().addScaledVector(T, Math.cos(yaw)).addScaledVector(B, Math.sin(yaw)).multiplyScalar(0.8).addScaledVector(n, 0.45 + plant40() * 0.3).normalize();
          foliage40.addLeaf(base, dir, size * (0.85 + plant40() * 0.3), plant40() * TAU, 0.05, tint);
        }
        plants40.sorrel++;
      }
    }
    // small ferns rooted in the cushions, leaning outward like the moss-bank ferns
    const ferns = def.id === 'saria' ? 12 : 6;
    for (let i = 0; i < ferns; i++) {
      const a = plant40() * TAU;
      const v = 0.1 + plant40() * 0.5;
      if (!keep(a, v)) continue;
      const { p, n } = onSheet(a, v);
      n.y += 0.5;
      n.normalize();
      foliage40.addTuft(p.addScaledVector(n, -0.03 * sk), n, (0.28 + plant40() * 0.14) * sk, 1, 0.06, FERN40_TINT);
      plants40.ferns++;
    }
    // a few grass tufts, small and rooted (not the round-13 rim brushes)
    const grass = def.id === 'saria' ? 16 : 8;
    for (let i = 0; i < grass; i++) {
      const a = plant40() * TAU;
      const v = 0.08 + plant40() * 0.52;
      if (!keep(a, v)) continue;
      const { p, n } = onSheet(a, v);
      n.y += 0.35;
      n.normalize();
      foliage40.addTuft(p.addScaledVector(n, -0.02 * sk), n, (0.16 + plant40() * 0.1) * sk, 0, 0.05, GRASS40_TINT);
      plants40.grass++;
    }
  }
  for (const m of foliage40.build(mats, `house40-${def.id}`)) group.add(m);

  // ---- round 41 (structures-26): PLAYER-HEIGHT TRUNK DETAIL (owner: real close-scale detail on
  // the trunk seen from the terrace at 2–4 m, not a smooth shell with a green tint). On top of the
  // shell's fine cords and cracks (relief, above):
  //  - MOSS CUSHION TUFTS (mossTufts.ts, cap-moss material) standing in the furrows and on the
  //    sheets wherever the shell's own vertex tint is moss — the shaded right wall's skin, the
  //    round-21 furrow grime, the round-34 sheets, the D-side flank sheet — sampled from
  //    `shellVertex` itself so they sit exactly on the displaced surface, gathered in colonies;
  //  - LICHEN PLATES: thin lobed discs 4–12 cm across lying on the cord crests where the shell's
  //    lichen field is high, pale grey-green, edges lifted (the plain moss material, +0 draws);
  //  - moss caps on the buttress roots' crowns and the root flare (tufts on the roots' own upper
  //    vertices where `mossOnTop` tinted them) and on the entrance arch's mossy upper faces, with
  //    lichen on the arch's lit crests; trefoils at the roots' feet.
  // Own forks; the tuft mesh folds into the cap-moss tuft bucket, the lichen into the moss bucket. ----
  const trunk41 = rng.fork('trunk41');
  const tuft41: MossTuftSpec[] = [];
  const lichenParts: BufferGeometry[] = [];
  const detail41 = { trunkTufts: 0, rootTufts: 0, archTufts: 0, boughTufts: 0, lichen: 0, trefoils: 0 };
  {
    const _sv = { position: new Vector3() } as SurfaceSample;
    const _su = { position: new Vector3() } as SurfaceSample;
    const _sw = { position: new Vector3() } as SurfaceSample;
    const _du = new Vector3();
    const _dv = new Vector3();
    const _nn = new Vector3();
    const _pp = new Vector3();
    const vOf = (y: number) => (y - yBase) / (wallTop - yBase);
    /** the shell's outward normal at (u, v) by central differences of `shellVertex` */
    const shellNormal = (u: number, v: number, out: Vector3) => {
      const eu = 0.2 / cols;
      const ev = 0.2 / rows;
      shellVertex(((u + eu) % 1 + 1) % 1, v, _su);
      shellVertex(((u - eu) % 1 + 1) % 1, v, _sw);
      _du.subVectors(_su.position, _sw.position);
      shellVertex(u, Math.min(1, v + ev), _su);
      shellVertex(u, Math.max(0, v - ev), _sw);
      _dv.subVectors(_su.position, _sw.position);
      out.crossVectors(_du, _dv).normalize();
      // outward: away from the trunk's axis
      _pp.set(_sv.position.x - frame.C.x, 0, _sv.position.z - frame.C.z);
      if (out.dot(_pp) < 0) out.negate();
      return out;
    };
    const colony41 = (p: Vector3) => smoothstep(0.42, 0.53, 0.5 + 0.5 * n3.noise(p.x * 2.0 + 3.3, p.y * 2.0, p.z * 2.0 - 1.7));
    // darker than the cap's tufts: the trunk's bark takes a shade floor in its shader that the
    // cap-moss material does not, so a cap-bright tuft on the shaded flank read as a lit pebble
    const MOSS41: [number, number, number] = [0.095, 0.15, 0.03];
    const LICHEN41: [number, number, number] = [0.5, 0.56, 0.5];
    /** how mossy a bark vertex tint is: the green share over the red (bark ≈ 1.03, the sheets 2.5–4) */
    const mossiness = (c: [number, number, number]) => smoothstep(1.3, 2.2, c[1] / Math.max(1e-4, c[0]));
    const shadeOf = (c: [number, number, number]) => clamp((0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 0.22, 0.25, 1);
    // player-height band only: the tufts run to 3.4 m and thin out above 2.4 m (the cap's
    // shade and the sheets carry the trunk above eye level; a 4 cm tuft at 5 m is a texel)
    const yTop = Math.min(wallTop - 0.15, 3.4);
    const attempts = def.id === 'saria' ? 4600 : 1400;
    for (let i = 0; i < attempts; i++) {
      const a = trunk41() * TAU;
      const y = lerp(0.03, yTop, Math.pow(trunk41(), 0.8));
      const r = (0.022 + 0.045 * Math.pow(trunk41(), 1.3)) * sk;
      const aspect = 0.75 + trunk41() * 0.5;
      const yaw = trunk41() * TAU;
      const hK = 0.55 + trunk41() * 0.4;
      const seed = 1 + Math.floor(trunk41() * 1e6);
      const keep = trunk41();
      const u = a / TAU;
      const v = vOf(y);
      if (shellHole(u, v)) continue;
      const rs = rSmooth(a, y);
      if (porchSD(wOf(a, rs), y) < 0.3 * k) continue;
      shellVertex(u, v, _sv);
      const c = _sv.color ?? [1, 1, 1];
      let w = mossiness(c);
      // the D-side sheet is laid over the grid afterwards (mossBySide): the same weight here
      if (dSide) {
        const wa = dSide(angleDiff(a, 0), y);
        if (wa > 0) w = Math.max(w, wa * smoothstep(-0.75, -0.25, noise.fbm(_sv.position.x * 0.9 + 4, _sv.position.z * 0.9 + y * 0.5 + 2, 2)));
      }
      // the damp base band takes a thin scatter on bare bark too
      w = Math.max(w, 0.3 * smoothstep(0.5, 0.05, y));
      w *= smoothstep(3.4, 2.4, y);
      // into the furrows between the cords (moss holds where water runs), thin on the crests
      w *= lerp(1, 0.3, smoothstep(-0.1, 0.4, cords(a, y) * 2.2));
      if (keep > w * lerp(0.1, 1, colony41(_sv.position))) continue;
      shellNormal(u, v, _nn);
      const sh = shadeOf(c);
      tuft41.push({
        position: _sv.position.clone(),
        normal: _nn.clone(),
        rx: r * aspect,
        rz: r / aspect,
        h: r * hK,
        yaw,
        color: [MOSS41[0] * sh, MOSS41[1] * sh, MOSS41[2] * sh],
        uv: [(a * R) / 1.6, y / 1.6],
        sink: r * 0.4,
        seed,
      });
      detail41.trunkTufts++;
    }
    // lichen plates on the cord crests where the shell's lichen field is high (its own terms)
    const lichenAttempts = def.id === 'saria' ? 3000 : 900;
    for (let i = 0; i < lichenAttempts; i++) {
      const a = trunk41() * TAU;
      const y = lerp(0.5, wallTop - 0.2, trunk41());
      const pr = (0.02 + 0.04 * trunk41()) * sk;
      const seed = trunk41() * 100;
      const keep = trunk41();
      const u = a / TAU;
      const v = vOf(y);
      if (shellHole(u, v)) continue;
      const rs = rSmooth(a, y);
      if (porchSD(wOf(a, rs), y) < 0.4 * k) continue;
      const field = smoothstep(0.45, 0.7, noise.noise(a * R * 1.3 + 41, y * 1.3 - 3)) * smoothstep(0.05, 0.5, cords(a, y) * 2.2);
      if (keep > field * 0.9) continue;
      shellVertex(u, v, _sv);
      if (mossiness(_sv.color ?? [1, 1, 1]) > 0.3) continue;
      shellNormal(u, v, _nn);
      const sh = shadeOf(_sv.color ?? [1, 1, 1]);
      lichenParts.push(lichenPlate(_sv.position, _nn, pr, seed, n3, [LICHEN41[0] * sh, LICHEN41[1] * sh, LICHEN41[2] * sh]));
      detail41.lichen++;
    }
    // moss caps on the roots' crowns and the arch's mossy upper faces, lichen on the arch's lit crests
    const onParts = (parts: BufferGeometry[], share: number, upMin: number, count: 'rootTufts' | 'archTufts' | 'boughTufts', lichenShare: number, draws: Rng = trunk41, sizeK = 1) => {
      for (const g of parts) {
        const pos = g.attributes.position;
        const nrm = g.attributes.normal;
        const col = g.attributes.color;
        const uv = g.attributes.uv;
        if (!col) continue;
        for (let vi = 0; vi < pos.count; vi++) {
          const ny = nrm.getY(vi);
          if (ny < upMin) continue;
          const c: [number, number, number] = [col.getX(vi), col.getY(vi), col.getZ(vi)];
          const m = mossiness(c);
          const draw = draws();
          _pp.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
          if (draw < m * share * lerp(0.2, 1, colony41(_pp))) {
            const r = (0.02 + draws() * 0.035) * sk * sizeK;
            const sh = shadeOf(c);
            tuft41.push({
              position: _pp.clone(),
              normal: new Vector3(nrm.getX(vi), ny, nrm.getZ(vi)),
              rx: r * (0.8 + draws() * 0.4),
              rz: r * (0.8 + draws() * 0.4),
              h: r * (0.5 + draws() * 0.4),
              yaw: draws() * TAU,
              color: [MOSS41[0] * sh, MOSS41[1] * sh, MOSS41[2] * sh],
              uv: [uv.getX(vi), uv.getY(vi)],
              sink: r * 0.5,
              seed: 1 + Math.floor(draws() * 1e6),
            });
            detail41[count]++;
          } else if (lichenShare > 0 && m < 0.2 && draw > 1 - lichenShare * clamp((c[0] + c[1] + c[2]) / 1.5, 0, 1)) {
            const sh = shadeOf(c);
            lichenParts.push(lichenPlate(_pp, new Vector3(nrm.getX(vi), ny, nrm.getZ(vi)), (0.02 + 0.035 * draws()) * sk, draws() * 100, n3, [LICHEN41[0] * sh, LICHEN41[1] * sh, LICHEN41[2] * sh]));
            detail41.lichen++;
          }
        }
      }
    };
    // Round 46 (structures-29): the roots' crowns carry a denser, larger moss cover (share 0.35
    // → 0.6, cushions × 1.3) — with the roots' new cord relief and seated run this is what the
    // survey's "painted grain stripe" becomes at 3–6 m. Own fork: the roots' vertex count
    // changed with the seated sweep, and on `trunk41` that would have re-drawn the arch's tufts.
    onParts(rootParts, 0.6, 0.45, 'rootTufts', 0, rng.fork('root-tufts46'), 1.3);
    onParts(archParts, 0.22, 0.3, 'archTufts', 0.012);
    // Round 46 (structures-29, survey-2 #08): moss CUSHIONS on the boughs' and limbs' tops — the
    // arc bough resting on the cap, its sub-limbs, the stub, the draped pale limbs and the right
    // limb — standing on the `mossOnTop` tint (which, alone, was the survey's "painted" moss
    // stripe). Own fork; larger than the trunk's (a 4 m camera on the plateau sees these).
    onParts([...supportParts, ...branchParts], 0.32, 0.35, 'boughTufts', 0, rng.fork('bough-tufts46'), 1.5);
  }
  // ---- round 43 (structures-27): the MOSS DOORMAT — trodden moss on the threshold slab and the
  // packed earth in front of the sill: dense, squat cushions along the slab's edges and against
  // the sill, thinned and flattened to a browner, worn film along the walked line through the
  // door's middle. Stands exactly on the slab's top or the porch floor's ramp; same tuft bucket
  // as the trunk moss (no new draw). Own fork. ----
  let doormatTufts = 0;
  let doormatFilm: BufferGeometry | null = null;
  if (thresholdSlab) {
    const matRng = rng.fork('doormat43');
    const slab = thresholdSlab;
    const wc = (doorW0 + doorW1) / 2;
    const upN = new Vector3(0, 1, 0);
    const MAT_MOSS: [number, number, number] = [0.105, 0.165, 0.032];
    const MAT_WORN: [number, number, number] = [0.11, 0.115, 0.04];
    /** 0 on the walked line through the door's middle, 1 at the mat's sides */
    const walkOf = (w: number) => 1 - smoothstep(0.6 * k, 0.15 * k, Math.abs(w - wc - 0.05 * k));
    /** the moss grows in clumps (a noise field over the mat), the stone bare between them */
    const patchOf = (w: number, d: number) => smoothstep(-0.3, 0.35, noise.noise(w * 7.5 + 3, d * 7.5 + 11));
    // the FILM: a thin moss carpet lying on the slab's top under the tufts, thicker at a clump's
    // heart, so the mat reads as moss grown over the stone and not as pebbles scattered on it.
    // Its outline is the iso-line where the sheet rises through the slab's top: where the cover
    // is thin (the walked line, the gaps between clumps, the slab's ragged rim) the sheet dips a
    // centimetre INTO the stone and is hidden, so the moss edge is a smooth curve through the
    // cells, not a staircase of open cells. Same bucket as the tufts.
    // Round 44 (structures-28): the moss keeps to the slab's RIM and the SILL. Round 43's film
    // ran over most of the top (patch × walk), and on the worn stone that now sits under it the
    // door read as a green mat on a dark slab (w31-house-d) — the reference threshold is bare
    // pale stone with moss at its edges. `rimOrSill` is 1 on the outer 30 % of the ellipse and
    // against the sill, 0.1 on the walked middle; film and tufts both follow it.
    const rimOrSill = (w: number, d: number) => Math.max(smoothstep(0.55, 0.88, Math.hypot((w - slab.cw) / slab.w, (d - slab.cd) / slab.d)), smoothstep(0.3 * k, 0.08 * k, d - dBack));
    {
      const cover = (w: number, d: number) =>
        patchOf(w, d) * lerp(0.15, 1, walkOf(w)) * lerp(0.1, 1, rimOrSill(w, d)) * smoothstep(0.96, 0.78, Math.hypot((w - slab.cw) / slab.w, (d - slab.cd) / slab.d));
      doormatFilm = gridSurface(
        (u, v, out) => {
          const w = slab.cw + (u * 2 - 1) * slab.w;
          const d = slab.cd + (v * 2 - 1) * slab.d;
          const c = cover(w, d);
          // the hidden sheet sits 6 cm INTO the stone — under the slab's dished walked line
          // (−1.2 cm ± 0.8 of wear) and under the porch earth round the stone (slabTop − 0.05)
          frame.door(w, slab.top + lerp(-0.06, 0.016, smoothstep(0.3, 0.7, c)), d, out.position);
          out.uv = [w / 1.6, d / 1.6];
          const trodden = 1 - walkOf(w);
          const sh = (0.55 + 0.5 * c) * (0.9 + 0.2 * noise.noise(w * 19, d * 19 + 4)) * lerp(1, 0.8, trodden);
          out.color = [lerp(MAT_MOSS[0], MAT_WORN[0], trodden) * sh, lerp(MAT_MOSS[1], MAT_WORN[1], trodden) * sh, lerp(MAT_MOSS[2], MAT_WORN[2], trodden) * sh];
        },
        { cols: 64, rows: 36 },
      );
    }
    for (let i = 0; i < 1100; i++) {
      const w = lerp(doorW0 - 0.3 * k, doorW1 + 0.3 * k, matRng());
      const d = lerp(dBack + 0.06 * k, dBack + 1.05 * k, matRng());
      // the walked line: few tufts, flat and worn; dense toward the slab's edges and the sill
      const walk = walkOf(w);
      const edge = smoothstep(0.35 * k, 0.05 * k, Math.abs(d - (dBack + 0.06 * k)));
      // clumped with the film, so the tufts stand on and round the carpet's patches
      const patch = patchOf(w, d);
      const keep = lerp(0.04, 1, Math.max(walk, 0.5 * edge)) * lerp(0.25, 1, patch) * lerp(0.05, 1, rimOrSill(w, d));
      if (matRng() > keep) continue;
      // on the slab (ellipse footprint) or the porch floor's ramp
      const rr = Math.hypot((w - slab.cw) / slab.w, (d - slab.cd) / slab.d);
      let y: number;
      if (rr < 0.92) y = slab.top;
      else if (rr > 1.1) {
        const ramp = lerp(sill - 0.02, 0.03, smoothstep(dBack + 0.1, dBack + 1.25 * k, d));
        frame.door(w, ramp, d, _bd);
        y = Math.max(ramp, terrain.height(_bd.x, _bd.z) - yFloor + 0.05);
      } else continue; // the slab's ragged rim: skip it
      const trodden = 1 - walk;
      const r = (0.014 + matRng() * 0.024) * sk * lerp(1, 0.7, trodden);
      const sh = (0.75 + 0.4 * matRng()) * lerp(1, 0.85, trodden);
      const c: [number, number, number] = [lerp(MAT_MOSS[0], MAT_WORN[0], trodden) * sh, lerp(MAT_MOSS[1], MAT_WORN[1], trodden) * sh, lerp(MAT_MOSS[2], MAT_WORN[2], trodden) * sh];
      frame.door(w, y, d, _bd);
      tuft41.push({
        position: _bd.clone(),
        normal: upN.clone(),
        rx: r * (0.8 + matRng() * 0.5),
        rz: r * (0.8 + matRng() * 0.5),
        h: r * lerp(0.6, 0.22, trodden) * (0.8 + matRng() * 0.4),
        yaw: matRng() * TAU,
        color: c,
        uv: [w / 1.6, d / 1.6],
        sink: r * 0.45,
        seed: 1 + Math.floor(matRng() * 1e6),
      });
      doormatTufts++;
    }
  }
  // rounder than the roof's (a 3 m camera sees these): 9 / 6 segments, 3 / 2 rings; the crown gain
  // is held down so the tufts do not glow against the floor-shaded bark
  const tuft41Options = { segments: [9, 6] as [number, number], rings: [3, 2] as [number, number], topGain: 1.3, rimGain: 0.45, topTint: [1.0, 1.04, 0.84] as [number, number, number] };
  const tufts41 = buildMossTufts(tuft41, n3, tuft41Options);
  const farFilm = site.farTufts && doormatFilm ? doormatFilm.clone() : null;
  const tuft41Mesh = new Mesh(doormatFilm ? merge([tufts41.geometry, doormatFilm]) : tufts41.geometry, mats.capMoss);
  tuft41Mesh.name = 'trunk-moss-tufts';
  tuft41Mesh.castShadow = false;
  tuft41Mesh.receiveShadow = true;
  // its own static bucket (renderOrder is part of the merge key): a tight culling sphere round
  // the trunks instead of riding in the roof-tuft bucket that spans the whole hero group, so a
  // view that looks away from the houses (C) does not draw them
  tuft41Mesh.renderOrder = 2;
  group.add(tuft41Mesh);
  if (site.farTufts) {
    const far41 = buildMossTufts(tuft41, n3, { ...tuft41Options, ...FAR_TUFTS }).geometry;
    const farMesh = new Mesh(farFilm ? merge([far41, farFilm]) : far41, mats.capMoss);
    farMesh.name = 'trunk-moss-tufts-far';
    farMesh.castShadow = false;
    farMesh.receiveShadow = true;
    farMesh.renderOrder = 2;
    group.add(farMesh);
  }
  if (lichenParts.length) {
    const lichenMesh = new Mesh(merge(lichenParts), mats.moss);
    lichenMesh.name = 'trunk-lichen';
    lichenMesh.castShadow = lichenMesh.receiveShadow = true;
    group.add(lichenMesh);
  }
  // trefoils at the roots' feet, on the terrain (the root's own contact points)
  const foliage41 = new FoliageBuilder(rng.fork('foliage41'), `${ctx.config.seed}/house41/${def.id}`);
  {
    const _fp = new Vector3();
    const _fn = new Vector3();
    for (const [bx, , bz] of bases) {
      for (let i = 0; i < 3; i++) {
        const x = bx + (trunk41() - 0.5) * 1.2;
        const z = bz + (trunk41() - 0.5) * 1.2;
        if (terrain.mask(x, z).path > 0.01 || terrain.mask(x, z).stairs > 0.01) continue;
        if (Math.hypot(x - frame.C.x, z - frame.C.z) < rSmooth(Math.atan2((x - frame.C.x) * Rt.x + (z - frame.C.z) * Rt.z, (x - frame.C.x) * F.x + (z - frame.C.z) * F.z), 0) + 0.1) continue;
        _fp.set(x, terrain.height(x, z), z);
        terrain.normal(x, z, _fn);
        const stem = 0.02 + trunk41() * 0.02;
        const size = (0.045 + trunk41() * 0.035) * sk;
        const yaw0 = trunk41() * TAU;
        const leaflets = trunk41() < 0.25 ? 4 : 3;
        const tk = 0.85 + trunk41() * 0.35;
        const tint: [number, number, number] = [1.6 * tk, 1.55 * tk, 1.4 * tk];
        const base = _fp.clone().addScaledVector(_fn, stem);
        const T = new Vector3(-_fn.z, 0, _fn.x);
        if (T.lengthSq() < 1e-6) T.set(1, 0, 0);
        T.normalize();
        const B = new Vector3().crossVectors(_fn, T);
        for (let j = 0; j < leaflets; j++) {
          const yaw = yaw0 + (j / leaflets) * TAU + (trunk41() - 0.5) * 0.4;
          const dir = new Vector3().addScaledVector(T, Math.cos(yaw)).addScaledVector(B, Math.sin(yaw)).multiplyScalar(0.8).addScaledVector(_fn, 0.45 + trunk41() * 0.3).normalize();
          foliage41.addLeaf(base, dir, size * (0.85 + trunk41() * 0.3), trunk41() * TAU, 0.05, tint);
        }
        detail41.trefoils++;
      }
    }
  }
  for (const m of foliage41.build(mats, `house41-${def.id}`)) group.add(m);

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
    leaves: foliage.leafCount + foliage21.leafCount + foliage40.leafCount + furnish47.plantLeaves,
    /** round 47 (structures-30): the furnished room and the doorway's rolled lip */
    furnishing: { ...furnish47, doorRoll: hero },
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
    mossDetail: { ...mossDetail, plants: plants40 },
    trunkDetail: { ...detail41, doormatTufts },
  };
}
