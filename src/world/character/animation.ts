/**
 * Procedural animation for the character rig — every pose is a closed-form function of the
 * simulation time `t` (no integrated state, no Math.random/Date.now), so a capture at a given `t`
 * is pixel-reproducible (W41) and `setTime()` jumps are harmless.
 *
 * Gaits: idle (weight shift, breathing, sway, head tracking), walk, run (bob, arm swing, lean)
 * and a stair-climb variant (high knee lift, forward lean). `plantFeet` then drops the whole rig
 * so the lower foot's sole touches the ground sampler exactly (foot planting on the heightfield).
 */
import { MathUtils, Vector3 } from 'three';
import { resetRig, type Rig } from './rig';

export type Gait = 'idle' | 'walk' | 'run' | 'stairs';
export const GAITS: readonly Gait[] = ['idle', 'walk', 'run', 'stairs'];

export interface PoseInput {
  gait: Gait;
  t: number;
  /** per-character phase offset (rad) so NPCs never move in lockstep */
  phase: number;
  /** world-space point the head tracks (Navi), or null */
  look?: Vector3 | null;
  /** 0..1 how strongly the head follows `look` */
  lookWeight?: number;
  /** amplitude (rad) of the slow idle body turn (Kokiri kids look around) */
  idleTurn?: number;
}

interface GaitParams {
  cycleHz: number;
  thigh: number;
  thighBias: number;
  knee: number;
  arm: number;
  elbow: number;
  lean: number;
  hipSway: number;
}

const GAIT: Record<Exclude<Gait, 'idle'>, GaitParams> = {
  walk: { cycleHz: 0.9, thigh: 0.42, thighBias: 0, knee: 1.1, arm: 0.3, elbow: 0.35, lean: 0.06, hipSway: 0.1 },
  run: { cycleHz: 1.35, thigh: 0.7, thighBias: 0.05, knee: 1.55, arm: 0.6, elbow: 1.2, lean: 0.22, hipSway: 0.14 },
  stairs: { cycleHz: 0.8, thigh: 0.55, thighBias: 0.3, knee: 1.5, arm: 0.25, elbow: 0.6, lean: 0.15, hipSway: 0.08 },
};

/** Ground speed (m/s) at which the feet of each gait roughly plant without sliding. */
export const GAIT_SPEED: Record<Gait, number> = { idle: 0, walk: 1.6, run: 3.9, stairs: 1.1 };

const _target = new Vector3();
const _soleL = new Vector3();
const _soleR = new Vector3();

function blink(t: number): number {
  const p = (((t * 0.23 + 0.5) % 1) + 1) % 1;
  const w = 0.035;
  return p < w ? 1 - Math.abs((p / w) * 2 - 1) : 0;
}

export function applyPose(rig: Rig, input: PoseInput): void {
  resetRig(rig);
  const { t, phase } = input;
  const r = rig;
  if (input.gait === 'idle') {
    const s1 = Math.sin(t * 0.45 + phase);
    const s2 = Math.sin(t * 0.31 + phase * 1.7);
    const breath = Math.sin(t * Math.PI * 2 * 0.28 + phase);
    r.hips.position.x += 0.012 * s1;
    r.hips.rotation.z = -0.03 * s1;
    r.hips.rotation.y = 0.05 * s2 + (input.idleTurn ?? 0) * Math.sin(t * 0.2 + phase);
    r.chest.position.y += 0.005 * breath;
    r.chest.rotation.x = 0.02 + 0.015 * breath;
    r.chest.rotation.y = -0.03 * s2;
    // relaxed arms, slightly out and forward, tiny swing
    r.shoulderL.rotation.set(-0.05 + 0.03 * Math.sin(t * 0.7 + phase), 0, 0.12);
    r.shoulderR.rotation.set(-0.05 - 0.03 * Math.sin(t * 0.7 + phase + 0.5), 0, -0.12);
    r.elbowL.rotation.x = -0.18;
    r.elbowR.rotation.x = -0.2;
    // stance: feet a little apart, knees soft, feet flat
    r.thighL.rotation.set(0.02, 0, 0.06 + 0.01 * s1);
    r.thighR.rotation.set(0.02, 0, -0.06 + 0.01 * s1);
    r.kneeL.rotation.x = 0.05;
    r.kneeR.rotation.x = 0.05;
    r.ankleL.rotation.set(-0.07, 0, -r.thighL.rotation.z);
    r.ankleR.rotation.set(-0.07, 0, -r.thighR.rotation.z);
    r.neck.rotation.y = 0.05 * Math.sin(t * 0.37 + phase);
    r.neck.rotation.x = 0.03 * Math.sin(t * 0.53 + phase);
    if (r.cap) r.cap.rotation.x = 0.03 * Math.sin(t * 0.9 + phase);
  } else {
    const g = GAIT[input.gait];
    const phi = t * Math.PI * 2 * g.cycleHz + phase;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    // legs: left forward when sin φ > 0; knee bends during the forward swing (cos φ > 0)
    const kneeL = g.knee * Math.max(0, c) * (0.5 - 0.5 * s) + (input.gait === 'stairs' ? 0.25 : 0.03);
    const kneeR = g.knee * Math.max(0, -c) * (0.5 + 0.5 * s) + (input.gait === 'stairs' ? 0.25 : 0.03);
    r.thighL.rotation.x = -(g.thighBias + g.thigh * s);
    r.thighR.rotation.x = -(g.thighBias - g.thigh * s);
    r.kneeL.rotation.x = kneeL;
    r.kneeR.rotation.x = kneeR;
    // feet stay roughly level with a toe-off at the end of stance
    r.ankleL.rotation.x = -(r.thighL.rotation.x + kneeL) * 0.7 + 0.25 * Math.max(0, -Math.sin(phi + 0.6)) * (input.gait === 'run' ? 1 : 0.5);
    r.ankleR.rotation.x = -(r.thighR.rotation.x + kneeR) * 0.7 + 0.25 * Math.max(0, Math.sin(phi + 0.6)) * (input.gait === 'run' ? 1 : 0.5);
    // arms swing opposite the legs
    r.shoulderL.rotation.set(g.arm * s, 0, 0.1);
    r.shoulderR.rotation.set(-g.arm * s, 0, -0.1);
    r.elbowL.rotation.x = -g.elbow - 0.15 * Math.max(0, -s);
    r.elbowR.rotation.x = -g.elbow - 0.15 * Math.max(0, s);
    // pelvis twist / sway, torso counter-twist and lean; a small double-frequency bob of the chest
    r.hips.rotation.y = g.hipSway * s;
    r.hips.rotation.z = 0.04 * s;
    r.hips.position.x += 0.012 * s;
    r.chest.rotation.y = -0.7 * g.hipSway * s;
    r.chest.rotation.x = g.lean;
    r.chest.position.y += 0.006 * Math.cos(2 * phi);
    r.neck.rotation.x = -g.lean * 0.6 + 0.03 * Math.cos(2 * phi);
    if (r.cap) r.cap.rotation.x = 0.06 + 0.1 * Math.cos(2 * phi + 0.8);
  }
  // blink
  const b = blink(t + phase * 0.3);
  for (const e of r.eyes) e.scale.y = 1 - 0.92 * b;
  if (input.look && (input.lookWeight ?? 1) > 0) lookAt(rig, input.look, input.lookWeight ?? 1);
}

/** Turn the neck toward a world point (clamped), blended by `weight`. */
export function lookAt(rig: Rig, target: Vector3, weight: number): void {
  rig.root.updateMatrixWorld(true);
  _target.copy(target);
  rig.chest.worldToLocal(_target);
  _target.sub(rig.neck.position);
  const yaw = MathUtils.clamp(Math.atan2(_target.x, _target.z), -0.95, 0.95);
  const pitch = MathUtils.clamp(Math.atan2(_target.y, Math.hypot(_target.x, _target.z)), -0.45, 0.55);
  rig.neck.rotation.y += yaw * weight;
  rig.neck.rotation.x += -pitch * weight;
}

export type GroundSampler = (x: number, z: number) => number;

/**
 * Drop the rig so its lower foot rests exactly on `ground`. Returns the planted sole's world
 * contact point (feet audit).
 */
export function plantFeet(rig: Rig, ground: GroundSampler, out: Vector3): Vector3 {
  rig.root.updateMatrixWorld(true);
  _soleL.copy(rig.sole);
  rig.ankleL.localToWorld(_soleL);
  _soleR.copy(rig.sole);
  rig.ankleR.localToWorld(_soleR);
  const gL = ground(_soleL.x, _soleL.z);
  const gR = ground(_soleR.x, _soleR.z);
  const gapL = _soleL.y - gL;
  const gapR = _soleR.y - gR;
  if (gapL <= gapR) {
    rig.root.position.y -= gapL;
    out.set(_soleL.x, gL, _soleL.z);
  } else {
    rig.root.position.y -= gapR;
    out.set(_soleR.x, gR, _soleR.z);
  }
  return out;
}
