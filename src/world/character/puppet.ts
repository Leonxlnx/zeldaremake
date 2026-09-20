/**
 * One posing contract for both character runtimes — the procedural rigid-part rig (link.ts /
 * kokiri.ts, posed by animation.ts) and the skinned GLB Link (glbLink.ts, posed by an
 * AnimationMixer). The character system only sees this: place the puppet at a ground point facing
 * `yaw`, pose it for the simulation time `t` in a gait, plant the feet on the ground sampler and
 * report the planted sole contact (audit `samplePositions.feet`), both soles' gaps to the ground
 * they stand on (`linkFeetContact`), how the planting was done (`linkIk`) and the top of the head.
 *
 * Every implementation must be a pure function of `t` and the pose input (no wall-clock, no
 * accumulated state) so captures at a fixed `t` are byte-reproducible (W41).
 */
import { Object3D, Vector3 } from 'three';
import { applyPose, plantFeet, type Gait, type GroundSampler } from './animation';
import type { FootAnchor, GaitChain } from './gaitChain';
import type { Character } from './link';

export { BLEND_S, type FootAnchor, type GaitChain } from './gaitChain';

/**
 * The pose input: the actor's gait chain (gaitChain.ts — the gait, the one it fades from and
 * the one before that, their switch times, clip shifts, idle sole anchors and the run-start blink
 * event's start `runBlinkT`; a hard switch has gaitSwitchT −Infinity) plus the simulation time
 * and the look.
 */
export interface PuppetPose extends GaitChain {
  t: number;
  /** per-character phase offset (rad) — procedural rigs only; the GLB clips carry their own hero phase */
  phase: number;
  /** world-space point the head tracks (Navi), or null */
  look: Vector3 | null;
  /** 0..1 how strongly the head follows `look` */
  lookWeight: number;
  /** amplitude (rad) of the slow idle body turn (kids look around) */
  idleTurn: number;
  /**
   * Play-mode locomotion state (round 47; null outside play mode, so a fixed capture never sees
   * it and its pose stays the closed-form function of `t` it was). Owned by the character system,
   * integrated from the simulation steps like the player's position, read and updated by the
   * puppet: the stance pins, the jump overlay and the step the pose is for.
   */
  loco: Locomotion | null;
}

/** the jump's phases: the take-off crouch (feet planted, root sinking), the airborne arc, the landing compression */
export type JumpPhase = 'crouch' | 'air' | 'land';

/**
 * One jump (round 47, the owner's "run faster and even jump"): the character system runs the
 * physics in `stepPlayer` (crouch timer → ballistic arc against the ground → landing timer); the
 * puppet reads the phase and the times for its procedural pose overlay.
 */
export interface JumpState {
  phase: JumpPhase;
  /** simulation time the current phase began */
  t0: number;
  /** root height at take-off (world) and the airborne root height the arc has reached (world) */
  y0: number;
  y: number;
  /** take-off vertical speed (m/s) and the horizontal velocity carried through the air (m/s) */
  v0: number;
  vx: number;
  vz: number;
  /** vertical speed at touchdown (m/s, positive = falling) — scales the landing compression */
  vLand: number;
  /** the flight time (s) the arc was expected to take back to the take-off ground level */
  flightS: number;
  /** 0..1 how far through that flight the arc is (saturates when the landing ground is lower); the overlay's clock */
  air: number;
}

export interface Locomotion {
  /** ground speed of the last step (m/s) */
  speed: number;
  /** length of the step this pose is for (s); 0 for a zero-dt re-render of the same moment, which must not advance any filter */
  dt: number;
  /**
   * The stance pins (glbLink.ts): the world (x, z) each foot is held at while the blended clips
   * have it in stance — set where it touched down, released at toe-off. NaN = free. Index 0 = L.
   */
  pinX: [number, number];
  pinZ: [number, number];
  /** the world offset a pin was holding its foot at when it released (the clip's foot minus the pin), faded out over the early swing from `pinFadeT` (sim s); NaN = none */
  pinFadeX: [number, number];
  pinFadeZ: [number, number];
  pinFadeT: [number, number];
  /** the world (x, z) a foot in its pin LEAD-IN (glbLink.ts tableLead) was carried to this step — the spot its pin engages at next step; NaN = no lead-in */
  leadX: [number, number];
  leadZ: [number, number];
  /** Last planted world position, retained through swing for the take-off support. */
  offX: [number, number];
  offZ: [number, number];
  /** the jump in progress, or null on the ground */
  jump: JumpState | null;
}

export function createLocomotion(): Locomotion {
  return { speed: 0, dt: 0, pinX: [NaN, NaN], pinZ: [NaN, NaN], pinFadeX: [NaN, NaN], pinFadeZ: [NaN, NaN], pinFadeT: [NaN, NaN], leadX: [NaN, NaN], leadZ: [NaN, NaN], offX: [NaN, NaN], offZ: [NaN, NaN], jump: null };
}

/**
 * One sole after planting (audit `linkFeetContact`): its world height, the exact ground under its
 * contact point (the sole marker under the ankle — or, for the GLB, its toe / heel when the marker
 * is off its ground and that point is on a tread edge), the signed gap, the support it was planted
 * on (the ground, or near a tread nosing the riser envelope's ramp, glbLink.ts, so
 * `soleY − supportY` is the IK's own residual while `gapM` is the visible one), and the smallest
 * gap over the boot's real footprint — the sole's four corners plus its heel and toe centres,
 * measured on the boot mesh at load — to the RENDERED surface under each (a corner under a
 * nosing lip reads the upper tread and goes negative by a riser; the marker alone cannot see it).
 * `shiftM` is the along-facing shift the foot was given so its footprint clears a nosing (+ =
 * forward), `pitchRad` its toe-down pitch over an edge, `correctionM` the vertical IK correction
 * of its sole (+ up); all 0 for the procedural rig. Round 6: `pinM` is the along-facing offset
 * that holds a fading idle clip's foot where it stood when the walk began (weighted by that
 * clip's blend weight; 0 outside an idle → gait crossfade), `holdM` how far the sole marker was
 * raised so the lowest point of the boot's sole, in the clip's own foot orientation, stays on the
 * support when the swing arc is flattened toward it (a toe-off from a tread the root has already
 * left; 0 on flat ground).
 */
export interface FootContact {
  foot: 'L' | 'R';
  soleY: number;
  groundY: number;
  gapM: number;
  supportY: number;
  minShoeGapM: number;
  shiftM: number;
  pitchRad: number;
  correctionM: number;
  pinM: number;
  holdM: number;
  /** world x / z of the sole marker after planting (round 47: the stance-foot drift is measured on these) */
  soleX: number;
  soleZ: number;
  /** true while the blended clips have this foot in stance (its swing weight below ½); the procedural rig reports the lower sole */
  stance: boolean;
  /** the play-mode stance pin's offset applied to the foot (m): along the facing (folded into `pinM` with the idle pin) and sideways */
  pinLatM: number;
}

/** how the last pose was planted (audit `linkIk`) */
export interface PlantInfo {
  /** 'two-bone' = per-foot leg IK on the skeleton (glbLink.ts); 'root-drop' = the whole rig lowered to the lower sole (animation.ts plantFeet) */
  mode: 'two-bone' | 'root-drop';
  /** largest vertical foot correction applied (m) */
  maxCorrectionM: number;
  /** how far the root moved from the placement height (m, + up) */
  rootShiftM: number;
  /** the foot the contact point is reported for: the sole nearest its ground after planting */
  planted: 'L' | 'R';
  /** true when a leg's target lay more than 1 mm beyond its reach (clamped at full extension / full fold); the root's extra drop leaves a leg exactly at full reach by design */
  reachClamped: boolean;
  /** which leg clamped and how far (m) its target lay beyond the reach it was clamped to (any amount, no tolerance) */
  reachClampedLeg: 'L' | 'R' | null;
  reachExcessM: number;
  /** largest along-facing shift (m) a foot was given so its footprint clears a nosing lip */
  maxShiftM: number;
  /** how far (m) the root was lowered beyond its support because a foot target lay past the straight leg */
  extraDropM: number;
  /** the part of that asked for by a leg about to land (its landing configuration's shortfall, weighted in over the end of the swing — glbLink ATTACK); 0 for the procedural rig */
  attackDropM: number;
  /** largest idle-foot pin (m) and sole hold (m) of this pose (see FootContact.pinM / holdM); clips with weight in the gait blend */
  maxPinM: number;
  maxHoldM: number;
  blendClips: number;
  /** the hip flexion clamped away on the most-clamped leg (rad; play mode only, glbLink.ts HIP_FLEX_MAX) */
  hipClampRad: number;
  /** the knee-out swivel on the most-turned leg (rad; play mode only, glbLink.ts KNEE_OUT_*) */
  kneeOutRad: number;
}

/**
 * The blink of the last pose (audit `blink*`, round 8 — blink.ts): how many meshes carry the
 * contract's morph targets (0 = the drive is inert, the asset has none), the closure phase p and
 * the weights derived from it, the weights READ BACK from the first morph mesh after the pose
 * (null without one), the start of the next scheduled blink, the run-start event the pose read
 * (PuppetPose.runBlinkT; −Infinity = none) and the schedule's seed / hash.
 */
export interface BlinkInfo {
  morphMeshes: number;
  phase: number;
  weights: { blink: number; blinkHalf: number };
  applied: { blink: number; blinkHalf: number } | null;
  nextT: number;
  runT: number;
  schedule: { seed: string; hash: number; slotS: number; jitterS: number; originS: number };
}

export interface Puppet {
  kind: 'procedural' | 'glb';
  /** root object (added to the system group); its position is the feet point on the ground */
  group: Object3D;
  triangles: number;
  /** total height incl. hat (m) */
  height: number;
  /** clip / gait names available */
  animations: readonly string[];
  /**
   * Stand at (x, z) on `ground` facing `yaw`, pose for `p`, plant the feet; writes the world
   * contact point of the sole nearest its ground. `surface` (default `ground`) is the rendered
   * walking surface the footprint is planted against (ground.ts `surface`: tread tops with their
   * nosing overhangs); the root placement itself reads `ground`.
   */
  pose(x: number, z: number, yaw: number, p: PuppetPose, ground: GroundSampler, contact: Vector3, surface?: GroundSampler): void;
  /** world position of the top of the skull (no cap) — audit screen projection */
  headTop(out: Vector3): Vector3;
  /** both soles of the last pose against the ground they were planted on */
  feetContact(): FootContact[];
  /** how the last pose was planted */
  plantInfo(): PlantInfo;
  /**
   * Clip-time shift (s) for `to` so that at simulation time `t` it is at the gait phase `from`
   * (shifted by `fromShift`) has: the same foot in the same part of its swing / stance. Pure —
   * the caller stores the result as the actor's `clipShift` for the crossfade. 0 when a puppet
   * has no clip phases (the procedural rig) or `from` has none (idle: the new gait starts at a
   * left heel-strike, both feet down).
   */
  alignClip?(from: Gait, fromShift: number, to: Gait, t: number): number;
  /**
   * Where the clip `gait` (shifted by `clipShift`) has its soles at simulation time `t` with the
   * root at (x, z) facing `yaw` — its own sole path, not the planted pose, so it needs no earlier
   * frame (the caller records it when a gait without phases is switched away from; see FootAnchor).
   */
  anchor?(x: number, z: number, yaw: number, gait: Gait, clipShift: number, t: number): FootAnchor;
  /** the blink of the last pose (puppets with a morph-target face; see BlinkInfo) */
  blink?(): BlinkInfo;
  /**
   * Play mode (round 47): advance the chain's clips by the ground distance `ds` (m) the root
   * actually travelled over a step of `dt` (s) ending at `t`, instead of by the clock — the
   * clip shifts are moved so every clip with a stride plays at rate = speed / (stride / cycle)
   * of the BLENDED gait (the strides cross-fade with the weights), so the feet cover exactly the
   * ground the root does whatever the speed (a turn, an acceleration, a gait blend) and a
   * standing root (ds 0, a jump) freezes the gait. Clips without a stride (idle) keep the clock.
   */
  advance?(chain: GaitChain, t: number, ds: number, dt: number): void;
}

const _head = new Vector3();
const _soleL = new Vector3();
const _soleR = new Vector3();

/** Wrap a procedural character (link.ts / kokiri.ts) in the puppet contract. */
export function proceduralPuppet(char: Character, animations: readonly string[]): Puppet {
  const rig = char.rig;
  const feet: FootContact[] = [
    { foot: 'L', soleY: 0, groundY: 0, gapM: 0, supportY: 0, minShoeGapM: 0, shiftM: 0, pitchRad: 0, correctionM: 0, pinM: 0, holdM: 0, soleX: 0, soleZ: 0, stance: true, pinLatM: 0 },
    { foot: 'R', soleY: 0, groundY: 0, gapM: 0, supportY: 0, minShoeGapM: 0, shiftM: 0, pitchRad: 0, correctionM: 0, pinM: 0, holdM: 0, soleX: 0, soleZ: 0, stance: true, pinLatM: 0 },
  ];
  const info: PlantInfo = { mode: 'root-drop', maxCorrectionM: 0, rootShiftM: 0, planted: 'L', reachClamped: false, reachClampedLeg: null, reachExcessM: 0, maxShiftM: 0, extraDropM: 0, attackDropM: 0, maxPinM: 0, maxHoldM: 0, blendClips: 1, hipClampRad: 0, kneeOutRad: 0 };
  return {
    kind: 'procedural',
    group: char.group,
    triangles: char.triangles,
    height: char.height,
    animations,
    pose(x, z, yaw, p, ground, contact) {
      const placed = ground(x, z);
      rig.root.position.set(x, placed, z);
      rig.root.rotation.y = yaw;
      applyPose(rig, { gait: p.gait, t: p.t, phase: p.phase, look: p.look, lookWeight: p.lookWeight, idleTurn: p.idleTurn });
      plantFeet(rig, ground, contact);
      // audit: both soles after the drop (the planted one reads a zero gap)
      rig.ankleL.localToWorld(_soleL.copy(rig.sole));
      rig.ankleR.localToWorld(_soleR.copy(rig.sole));
      for (const [f, s] of [[feet[0], _soleL], [feet[1], _soleR]] as const) {
        f.soleY = s.y;
        f.soleX = s.x;
        f.soleZ = s.z;
        f.groundY = ground(s.x, s.z);
        f.gapM = s.y - f.groundY;
        f.supportY = f.groundY;
        f.minShoeGapM = f.gapM;
      }
      info.rootShiftM = rig.root.position.y - placed;
      info.planted = Math.abs(feet[0].gapM) <= Math.abs(feet[1].gapM) ? 'L' : 'R';
      feet[0].stance = info.planted === 'L';
      feet[1].stance = info.planted === 'R';
    },
    headTop(out) {
      rig.head.getWorldPosition(_head);
      return out.set(_head.x, _head.y + rig.props.headRadius * 1.05, _head.z);
    },
    feetContact: () => feet.map((f) => ({ ...f })),
    plantInfo: () => ({ ...info }),
  };
}
