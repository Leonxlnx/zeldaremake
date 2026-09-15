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
import type { Character } from './link';

export interface PuppetPose {
  gait: Gait;
  t: number;
  /** per-character phase offset (rad) — procedural rigs only; the GLB clips carry their own hero phase */
  phase: number;
  /** world-space point the head tracks (Navi), or null */
  look: Vector3 | null;
  /** 0..1 how strongly the head follows `look` */
  lookWeight: number;
  /** amplitude (rad) of the slow idle body turn (kids look around) */
  idleTurn: number;
  /** gait before the last change and the simulation time of that change (deterministic crossfade); −Infinity = hard switch */
  gaitFrom: Gait;
  gaitSwitchT: number;
  /**
   * Clip-time shift (s) of `gait` / `gaitFrom`, chosen at the switch by `Puppet.alignClip` so the
   * incoming clip starts at the gait phase the outgoing one had (the planted foot matches across
   * the crossfade). 0 = the clip's own hero alignment (the captures; hard switches).
   */
  clipShift: number;
  clipShiftFrom: number;
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
 * of its sole (+ up); all 0 for the procedural rig.
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
}

const _head = new Vector3();
const _soleL = new Vector3();
const _soleR = new Vector3();

/** Wrap a procedural character (link.ts / kokiri.ts) in the puppet contract. */
export function proceduralPuppet(char: Character, animations: readonly string[]): Puppet {
  const rig = char.rig;
  const feet: FootContact[] = [
    { foot: 'L', soleY: 0, groundY: 0, gapM: 0, supportY: 0, minShoeGapM: 0, shiftM: 0, pitchRad: 0, correctionM: 0 },
    { foot: 'R', soleY: 0, groundY: 0, gapM: 0, supportY: 0, minShoeGapM: 0, shiftM: 0, pitchRad: 0, correctionM: 0 },
  ];
  const info: PlantInfo = { mode: 'root-drop', maxCorrectionM: 0, rootShiftM: 0, planted: 'L', reachClamped: false, reachClampedLeg: null, reachExcessM: 0, maxShiftM: 0, extraDropM: 0 };
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
        f.groundY = ground(s.x, s.z);
        f.gapM = s.y - f.groundY;
        f.supportY = f.groundY;
        f.minShoeGapM = f.gapM;
      }
      info.rootShiftM = rig.root.position.y - placed;
      info.planted = Math.abs(feet[0].gapM) <= Math.abs(feet[1].gapM) ? 'L' : 'R';
    },
    headTop(out) {
      rig.head.getWorldPosition(_head);
      return out.set(_head.x, _head.y + rig.props.headRadius * 1.05, _head.z);
    },
    feetContact: () => feet.map((f) => ({ ...f })),
    plantInfo: () => ({ ...info }),
  };
}
