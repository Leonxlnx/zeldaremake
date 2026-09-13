/**
 * One posing contract for both character runtimes — the procedural rigid-part rig (link.ts /
 * kokiri.ts, posed by animation.ts) and the skinned GLB Link (glbLink.ts, posed by an
 * AnimationMixer). The character system only sees this: place the puppet at a ground point facing
 * `yaw`, pose it for the simulation time `t` in a gait, plant the feet on the ground sampler and
 * report the planted sole contact (audit `samplePositions.feet`) and the top of the head.
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
  /** stand at (x, z) on `ground` facing `yaw`, pose for `p`, plant the feet; writes the planted sole's world contact point */
  pose(x: number, z: number, yaw: number, p: PuppetPose, ground: GroundSampler, contact: Vector3): void;
  /** world position of the top of the skull (no cap) — audit screen projection */
  headTop(out: Vector3): Vector3;
}

const _head = new Vector3();

/** Wrap a procedural character (link.ts / kokiri.ts) in the puppet contract. */
export function proceduralPuppet(char: Character, animations: readonly string[]): Puppet {
  const rig = char.rig;
  return {
    kind: 'procedural',
    group: char.group,
    triangles: char.triangles,
    height: char.height,
    animations,
    pose(x, z, yaw, p, ground, contact) {
      rig.root.position.set(x, ground(x, z), z);
      rig.root.rotation.y = yaw;
      applyPose(rig, { gait: p.gait, t: p.t, phase: p.phase, look: p.look, lookWeight: p.lookWeight, idleTurn: p.idleTurn });
      plantFeet(rig, ground, contact);
    },
    headTop(out) {
      rig.head.getWorldPosition(_head);
      return out.set(_head.x, _head.y + rig.props.headRadius * 1.05, _head.z);
    },
  };
}
