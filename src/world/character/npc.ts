/**
 * Kokiri NPC behaviour (round 47, owner review 2026-09-19 items 7–8): "the girl should be walking
 * around … she has a green fly in front of her, and she's sitting on the steps."
 *
 *  - kokiri-a WANDERS a closed loop of authored waypoints on the plaza / lawn (placement.ts
 *    `NPC_LOOP`): walks at 1.0–1.15 m/s, ramps in and out of each leg, turns in place at a
 *    waypoint (a foot shuffle), dwells with a look-around, walks on. The whole schedule is built
 *    once (seeded dwell times and speeds, util/prng) and the state at any simulation time is a
 *    closed-form lookup into it — no integration, so a `setTime` jump or a zero-dt re-render lands
 *    on the same pose and the loop wraps seamlessly (the leg lengths are quantised to whole steps).
 *  - kokiri-b SITS on a stair tread (placement.ts `NPC_SEAT`): the pelvis sunk to HIP_LIFT over
 *    the tread just behind the nosing, the back rounded, a two-bone solve puts both soles flat on
 *    the tread below (the 0.27 m riser is longer than her 0.20 m shin, so the thighs slope down
 *    over the nosing and the knees fold to ≈ 100°) and the hands on the knees, with breathing, a
 *    slow head turn and a small torso sway. Every height is read from the character ground
 *    (the rendered stair stones). The skirt's front flaps ride on the thighs (kokiri.ts), so the
 *    skirt lies on the lap by construction.
 *  - kokiri-ledge (round 48, ref-04) STANDS on the raised ledge over the north clearing facing
 *    south, with a weight-shift idle and a seeded look-around; under capture she is posed but
 *    hidden — she sits inside camera D's frustum behind the log's west root mass, and hiding
 *    her keeps the six fixed frames byte-identical and their draw counts unchanged.
 *  - each girl has a FAIRY (navi.ts `createFairy`, green-white) hovering 0.4 m in front of her
 *    face; it follows the walker with a short delayed-average lag (a spring-like trail that is
 *    still a pure function of t).
 *
 * The walk cycle is driven by the distance walked (phase = steps × 2π × dist / legLength), so the
 * stance foot's speed over the ground matches her actual speed: the thigh follows a smoothed
 * triangle wave (near-constant angular rate through stance) and one cycle covers
 * 4 · leg · sin(amplitude) metres. The rig is rigid, so the planting is the character system's
 * root drop (animation.ts `plantFeet`): the lower sole is exactly on the ground every frame.
 *
 * Under capture the character system keeps the per-view placement (placement.ts `VIEW_TABLE`)
 * and only the fairies are added — the six harness views never see the loop.
 */
import { Color, Group, MathUtils, Mesh, Vector3 } from 'three';
import type { Layout } from '../layout';
import { createRng } from '../util/prng';
import { plantFeet } from './animation';
import type { Ground } from './ground';
import type { Character } from './link';
import { createFairy, type Fairy } from './navi';
import { NPC_LOOP, NPC_SEAT, type NpcSeat, type NpcWaypoint } from './placement';
import { resetRig, type Rig } from './rig';

/** what npc.ts needs of the character system's actor */
export interface NpcActor {
  pos: Vector3;
  yaw: number;
  /** planted sole contact point (world), written here */
  contact: Vector3;
  shadow: Mesh;
  shadowRadius: number;
}

export interface NpcOptions {
  /** the kids' characters by slot (0 = kokiri-a, 1 = kokiri-b, 2 = kokiri-c the boy, 3 = kokiri-ledge) */
  chars: Character[];
  ground: Ground;
  layout: Layout;
  seed: string;
}

/** the kid slot that stands on the raised ledge (round 48) */
export const LEDGE_SLOT = 3;

export interface Npcs {
  /** the fairies (added to the character group) */
  group: Group;
  /**
   * Place and pose kid `slot` for simulation time t if it has a behaviour (wander / sit /
   * ledge idle); writes the actor's pos, yaw, contact and shadow. False = no behaviour, the
   * caller poses it as before. Under capture (`view` true) the wander and the seat stand aside
   * for the per-view placement (false), and the ledge girl is posed on her spot but hidden.
   */
  drive(slot: number, actor: NpcActor, t: number, view?: boolean): boolean;
  /** after every kid is posed: move the fairies to their faces (the walker's with a lag) */
  updateFairies(t: number): void;
  /** audit fields (`npcCount`, `npcWaypoints`, `npcSitting`, `npc` details) */
  audit(): Record<string, unknown>;
}

// ---- walk cycle ----

/** thigh swing amplitude (rad) at cruise; one cycle covers 4 · leg · sin(AMP) metres */
const AMP = 0.48;
/** speed ramp at the ends of a leg (s) */
const RAMP = 0.35;
/** turn-in-place rate (rad/s) */
const TURN_RATE = 2.4;

/**
 * Smoothed triangle wave, amplitude 1, period 2π, in phase with sin: 85 % triangle (a stance foot
 * at a near-constant ground speed — mean residual slide 9 % of the walking speed, checked
 * offline against a rigid leg) and 15 % sine (rounds the swing reversal).
 */
function tri(phi: number): number {
  const s = Math.sin(phi);
  return 0.15 * s + 0.85 * ((2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, s))));
}

const smooth = (u: number) => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
};

function blink(t: number): number {
  const p = (((t * 0.23 + 0.5) % 1) + 1) % 1;
  const w = 0.035;
  return p < w ? 1 - Math.abs((p / w) * 2 - 1) : 0;
}

/** shortest signed angle from a to b */
const angleTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

interface Segment {
  kind: 'walk' | 'turn' | 'dwell';
  t0: number;
  dur: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  yaw0: number;
  yaw1: number;
  /** walk: cruise speed (m/s), leg length (m), whole steps in the leg */
  speed: number;
  len: number;
  steps: number;
  /** dwell: head-turn keys (u in 0..1 of the dwell, yaw rad, pitch rad) */
  look: [number, number, number][];
}

interface WanderState {
  x: number;
  z: number;
  yaw: number;
  /** m/s over the ground now */
  speed: number;
  /** 0..1 walk pose weight */
  walk: number;
  /** gait phase (rad): sin > 0 = left leg forward */
  phi: number;
  /** turn-in-place shuffle weight 0..1 and its phase */
  shuffle: number;
  shufflePhi: number;
  /** head look (rad) while dwelling */
  headYaw: number;
  headPitch: number;
  segment: Segment['kind'];
  segmentIndex: number;
}

/** the closed loop as a timed list of segments (walk / turn / dwell) — total period `period` */
function buildSchedule(loop: NpcWaypoint[], rng: ReturnType<typeof createRng>, legLength: number): { segments: Segment[]; period: number; length: number } {
  const stride = 4 * legLength * Math.sin(AMP);
  const segments: Segment[] = [];
  let t = 0;
  let length = 0;
  const n = loop.length;
  const heading = (i: number) => {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    return Math.atan2(b.x - a.x, b.z - a.z);
  };
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const arrive = heading((i + n - 1) % n);
    // dwell facing the arrival heading, looking around (or at the authored spot)
    const dwellDur = a.dwell * rng.range(0.65, 1.35);
    const look: Segment['look'] = [[0, 0, 0]];
    if (a.lookAt) {
      const ly = MathUtils.clamp(angleTo(arrive, Math.atan2(a.lookAt[0] - a.x, a.lookAt[1] - a.z)), -1.1, 1.1);
      look.push([0.18, ly, rng.range(-0.08, 0.06)], [0.62, ly * 0.85, rng.range(-0.06, 0.08)]);
    } else {
      const s1 = rng.range(0.45, 0.9) * (rng.chance(0.5) ? 1 : -1);
      look.push([0.2, s1, rng.range(-0.1, 0.05)], [0.55, -s1 * rng.range(0.4, 0.9), rng.range(-0.05, 0.1)]);
    }
    look.push([0.9, 0, 0], [1, 0, 0]);
    segments.push({ kind: 'dwell', t0: t, dur: dwellDur, x0: a.x, z0: a.z, x1: a.x, z1: a.z, yaw0: arrive, yaw1: arrive, speed: 0, len: 0, steps: 0, look });
    t += dwellDur;
    // turn in place to the next heading
    const depart = heading(i);
    const turn = angleTo(arrive, depart);
    const turnDur = Math.max(0.3, Math.abs(turn) / TURN_RATE);
    segments.push({ kind: 'turn', t0: t, dur: turnDur, x0: a.x, z0: a.z, x1: a.x, z1: a.z, yaw0: arrive, yaw1: arrive + turn, speed: 0, len: 0, steps: 0, look: [] });
    t += turnDur;
    // walk the leg: whole steps so both legs come together at each end
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const speed = rng.range(1.0, 1.15);
    const steps = Math.max(2, Math.round((2 * len) / stride));
    const dur = len / speed + RAMP;
    segments.push({ kind: 'walk', t0: t, dur, x0: a.x, z0: a.z, x1: b.x, z1: b.z, yaw0: depart, yaw1: depart, speed, len, steps, look: [] });
    t += dur;
    length += len;
  }
  return { segments, period: t, length };
}

/** the walk's travelled distance and speed at τ into a leg with ramps at both ends */
function walkProgress(seg: Segment, tau: number): { dist: number; speed: number } {
  const v = seg.speed;
  const T = seg.dur;
  const r = Math.min(RAMP, T / 2);
  if (tau < r) return { dist: (v * tau * tau) / (2 * r), speed: (v * tau) / r };
  if (tau < T - r) return { dist: (v * r) / 2 + v * (tau - r), speed: v };
  const left = Math.max(0, T - tau);
  return { dist: seg.len - (v * left * left) / (2 * r), speed: (v * left) / r };
}

function wanderStateAt(sched: { segments: Segment[]; period: number }, phase0: number, t: number, out: WanderState): WanderState {
  const tau0 = (((t + phase0) % sched.period) + sched.period) % sched.period;
  let seg = sched.segments[sched.segments.length - 1];
  let idx = sched.segments.length - 1;
  for (let i = 0; i < sched.segments.length; i++) {
    const s = sched.segments[i];
    if (tau0 >= s.t0 && tau0 < s.t0 + s.dur) {
      seg = s;
      idx = i;
      break;
    }
  }
  const tau = tau0 - seg.t0;
  out.segment = seg.kind;
  out.segmentIndex = idx;
  out.speed = 0;
  out.walk = 0;
  out.shuffle = 0;
  out.shufflePhi = 0;
  out.headYaw = 0;
  out.headPitch = 0;
  if (seg.kind === 'walk') {
    const { dist, speed } = walkProgress(seg, tau);
    const u = seg.len > 0 ? dist / seg.len : 0;
    out.x = seg.x0 + (seg.x1 - seg.x0) * u;
    out.z = seg.z0 + (seg.z1 - seg.z0) * u;
    out.yaw = seg.yaw0;
    out.speed = speed;
    out.walk = Math.min(1, speed / seg.speed);
    out.phi = Math.PI * seg.steps * u;
  } else if (seg.kind === 'turn') {
    out.x = seg.x0;
    out.z = seg.z0;
    const u = smooth(tau / seg.dur);
    out.yaw = seg.yaw0 + (seg.yaw1 - seg.yaw0) * u;
    out.phi = 0;
    // shuffle weight follows the turn rate (bell over the turn)
    out.shuffle = Math.min(1, (Math.abs(seg.yaw1 - seg.yaw0) / seg.dur / 1.6) * 4 * u * (1 - u) + 0.15);
    out.shufflePhi = Math.PI * 2 * 2.4 * tau * Math.sign(seg.yaw1 - seg.yaw0 || 1);
  } else {
    out.x = seg.x0;
    out.z = seg.z0;
    out.yaw = seg.yaw0;
    out.phi = 0;
    const u = tau / seg.dur;
    const keys = seg.look;
    for (let k = 0; k < keys.length - 1; k++) {
      if (u >= keys[k][0] && u <= keys[k + 1][0]) {
        const w = smooth((u - keys[k][0]) / Math.max(1e-6, keys[k + 1][0] - keys[k][0]));
        out.headYaw = keys[k][1] + (keys[k + 1][1] - keys[k][1]) * w;
        out.headPitch = keys[k][2] + (keys[k + 1][2] - keys[k][2]) * w;
        break;
      }
    }
  }
  return out;
}

// ---- poses ----

/**
 * The standing / walking pose from a wander state: idle breathing and weight shift weighted by
 * (1 − walk), the distance-driven gait weighted by `walk`, the turn shuffle, the dwell head turn.
 */
function poseWander(rig: Rig, s: WanderState, t: number, phase: number): void {
  resetRig(rig);
  const r = rig;
  const w = s.walk;
  const idle = 1 - w;
  const tl = tri(s.phi);
  const sn = Math.sin(s.phi);
  const cs = Math.cos(s.phi);
  // idle: weight shift, breathing, a small sway
  const s1 = Math.sin(t * 0.45 + phase);
  const s2 = Math.sin(t * 0.31 + phase * 1.7);
  const breath = Math.sin(t * Math.PI * 2 * 0.3 + phase);
  r.hips.position.x += 0.01 * s1 * idle + 0.012 * sn * w;
  r.hips.rotation.z = -0.025 * s1 * idle + 0.035 * sn * w;
  r.hips.rotation.y = 0.04 * s2 * idle + 0.09 * tl * w;
  r.chest.position.y += 0.004 * breath * idle + 0.005 * Math.cos(2 * s.phi) * w;
  r.chest.rotation.x = 0.02 + 0.012 * breath * idle + 0.045 * w;
  r.chest.rotation.y = -0.02 * s2 * idle - 0.06 * tl * w;
  // legs: the stance leg sweeps back at a near-constant rate (tri); the swing leg lifts its knee early
  const thetaL = AMP * w * tl;
  const thetaR = -thetaL;
  const kneeL = 0.05 + 1.15 * w * Math.max(0, cs) * (0.55 - 0.45 * sn);
  const kneeR = 0.05 + 1.15 * w * Math.max(0, -cs) * (0.55 + 0.45 * sn);
  r.thighL.rotation.set(-thetaL + 0.02 * idle, 0, 0.05 + 0.01 * s1 * idle);
  r.thighR.rotation.set(-thetaR + 0.02 * idle, 0, -0.05 + 0.01 * s1 * idle);
  r.kneeL.rotation.x = kneeL;
  r.kneeR.rotation.x = kneeR;
  // turn shuffle: alternate small steps in place
  if (s.shuffle > 0) {
    const sh = s.shuffle;
    const a = Math.sin(s.shufflePhi);
    r.thighL.rotation.x += -0.09 * sh * a;
    r.thighR.rotation.x += 0.09 * sh * a;
    r.kneeL.rotation.x += 0.3 * sh * Math.max(0, a);
    r.kneeR.rotation.x += 0.3 * sh * Math.max(0, -a);
    r.hips.rotation.y += 0.06 * sh * a;
  }
  // feet level with the ground (the sole marker plants), toe-off at the end of stance
  r.ankleL.rotation.set(-(r.thighL.rotation.x + r.kneeL.rotation.x) * 0.72 - 0.05 * idle + 0.14 * w * Math.max(0, -Math.sin(s.phi + 0.5)), 0, -r.thighL.rotation.z);
  r.ankleR.rotation.set(-(r.thighR.rotation.x + r.kneeR.rotation.x) * 0.72 - 0.05 * idle + 0.14 * w * Math.max(0, Math.sin(s.phi + 0.5)), 0, -r.thighR.rotation.z);
  // arms: relaxed at the sides when standing; a slow, small contralateral swing walking
  const arm = 0.3 * w;
  r.shoulderL.rotation.set(-0.05 * idle + 0.03 * Math.sin(t * 0.7 + phase) * idle + arm * tl, 0, 0.13);
  r.shoulderR.rotation.set(-0.05 * idle - 0.03 * Math.sin(t * 0.7 + phase + 0.5) * idle - arm * tl, 0, -0.13);
  r.elbowL.rotation.x = -0.2 - 0.25 * w - 0.2 * w * Math.max(0, -tl);
  r.elbowR.rotation.x = -0.22 - 0.25 * w - 0.2 * w * Math.max(0, tl);
  // head: the dwell look-around, a little walk nod, idle drift
  r.neck.rotation.y = s.headYaw + 0.04 * Math.sin(t * 0.37 + phase) * idle;
  r.neck.rotation.x = -s.headPitch + 0.025 * Math.sin(t * 0.53 + phase) * idle - 0.02 * w + 0.02 * Math.cos(2 * s.phi) * w;
  if (r.cap) r.cap.rotation.x = 0.03 * Math.sin(t * 0.9 + phase) * idle + 0.05 * Math.cos(2 * s.phi + 0.8) * w;
  const b = blink(t + phase * 0.3);
  for (const e of r.eyes) e.scale.y = 1 - 0.92 * b;
}

interface SeatPose {
  /** hips joint world position */
  hips: Vector3;
  yaw: number;
  /** ankle joint targets (world) */
  ankleL: Vector3;
  ankleR: Vector3;
}

/**
 * Planar two-bone solve: bones l1, l2 from the origin to (reach, drop) in a vertical plane; returns
 * the first bone's angle from straight down (toward +reach) and the joint flex. The middle joint
 * sits ahead of the origin→target line for a knee (the shin folds back) and behind it for an elbow
 * (`midBehind`: the upper arm hangs, the forearm folds forward onto the target).
 */
function twoBone(l1: number, l2: number, reach: number, drop: number, midBehind = false): { a: number; flex: number } {
  const d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, Math.hypot(reach, drop)));
  const alpha = Math.atan2(reach, drop);
  const beta = Math.acos(MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const kappa = Math.acos(MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  return { a: midBehind ? alpha - beta : alpha + beta, flex: Math.PI - kappa };
}

const _tmp = new Vector3();
const _tmp2 = new Vector3();
const _fwd = new Vector3();
const _up = new Vector3(0, 1, 0);
/** seated pelvis roll (rad): the pelvis tips back a little under a rounded lower back */
const PELVIS_ROLL = 0.16;
/** hips joint above the seat surface (m): the pelvis sunk into the tread, the thighs' underside on the nosing */
const HIP_LIFT = 0.065;
/** how far behind the nosing the hips joint sits (m): the thighs' front half hangs over the edge */
const SEAT_BACK = 0.06;
/** the ankle targets ahead of the hips joint (m, L / R): the heels just clear the riser face */
const SEAT_REACH: [number, number] = [0.15, 0.17];

/**
 * Seated (round 48): root under the hips so the hips joint sits `HIP_LIFT` above the seat; each
 * leg solved to its ankle target (feet flat on the tread below, knees ≈ 100° — the riser is
 * longer than her shin, so the thighs slope down over the nosing); the pelvis tipped back a
 * little, the back rounded forward over it, the hands on the knees (a planar solve in the chest
 * frame toward each kneecap, the elbow hanging behind the shoulder→hand line); breathing, a slow
 * torso sway and the head turn.
 */
function poseSeated(rig: Rig, seat: SeatPose, t: number, phase: number, headYaw: number, headPitch: number): void {
  resetRig(rig);
  const p = rig.props;
  const r = rig;
  r.root.position.set(seat.hips.x, seat.hips.y - p.hipY, seat.hips.z);
  r.root.rotation.y = seat.yaw;
  const breath = Math.sin(t * Math.PI * 2 * 0.26 + phase);
  const sway = Math.sin(t * 0.19 + phase * 0.7);
  // the pelvis tips back and the torso curls forward past it (a rounded back); the thighs are
  // solved in world terms below, so the pelvis roll is taken back out of their local angles
  const pelvis = -PELVIS_ROLL;
  r.hips.rotation.x = pelvis;
  r.hips.rotation.z = 0.02 * sway;
  r.chest.rotation.x = PELVIS_ROLL + 0.3 + 0.014 * breath;
  r.chest.position.y += 0.004 * breath;
  r.chest.rotation.y = 0.03 * Math.sin(t * 0.23 + phase);
  r.chest.rotation.z = -0.03 * sway;
  const l1 = p.hipY - p.kneeY;
  const l2 = p.kneeY - p.ankleY;
  _fwd.set(Math.sin(seat.yaw), 0, Math.cos(seat.yaw));
  for (const side of [1, -1] as const) {
    const thigh = side > 0 ? r.thighL : r.thighR;
    const knee = side > 0 ? r.kneeL : r.kneeR;
    const ankle = side > 0 ? r.ankleL : r.ankleR;
    const target = side > 0 ? seat.ankleL : seat.ankleR;
    // the hip joint's world position (hips joint ± half width; the roll is about that axis)
    _tmp.set(side * p.hipHalfWidth, 0, 0).applyAxisAngle(_up, seat.yaw).add(seat.hips);
    _tmp2.subVectors(target, _tmp);
    const reach = _tmp2.dot(_fwd);
    const drop = -_tmp2.y;
    const { a, flex } = twoBone(l1, l2, reach, drop);
    // knees a little apart, the right one more (an asymmetric, relaxed sit)
    thigh.rotation.set(-a - pelvis, 0, side * (side > 0 ? 0.07 : 0.11));
    knee.rotation.x = flex;
    // foot flat on its tread
    ankle.rotation.set(-(thigh.rotation.x + knee.rotation.x), 0, -thigh.rotation.z);
  }
  // arms: hands on the knees — a planar solve in the chest frame toward a point on top of each
  // thigh just above the kneecap (as far as a child's arm reaches from a rounded back); the elbow
  // hangs behind the shoulder→hand line so the forearm reaches forward onto the leg
  r.root.updateMatrixWorld(true);
  for (const side of [1, -1] as const) {
    const shoulder = side > 0 ? r.shoulderL : r.shoulderR;
    const elbow = side > 0 ? r.elbowL : r.elbowR;
    const thigh = side > 0 ? r.thighL : r.thighR;
    // 74 % down the thigh, the palm resting on its upper surface (thigh radius 0.06 + half a hand)
    _tmp.set(side * 0.012, -0.74 * l1, 0.082);
    thigh.localToWorld(_tmp);
    r.chest.worldToLocal(_tmp);
    _tmp.x -= side * p.shoulderHalfWidth;
    _tmp.y -= p.shoulderY - p.chestY;
    const { a, flex } = twoBone(p.upperArm, p.forearm + 0.02, _tmp.z, -_tmp.y, true);
    shoulder.rotation.set(-a, 0, side * 0.16);
    elbow.rotation.x = -flex;
  }
  r.neck.rotation.y = headYaw;
  r.neck.rotation.x = -headPitch - 0.08 + 0.02 * breath;
  if (r.cap) r.cap.rotation.x = 0.02 * Math.sin(t * 0.7 + phase);
  const b = blink(t + phase * 0.3);
  for (const e of r.eyes) e.scale.y = 1 - 0.92 * b;
}

/**
 * The ledge girl's idle (round 48): standing on her spot facing `yaw`, weight shifting, breathing,
 * the dwell-style look-around from the seeded head keys — the wander pose with the walk weight 0.
 */
function poseLedgeIdle(rig: Rig, x: number, z: number, y: number, yaw: number, t: number, phase: number, headYaw: number, headPitch: number, st: WanderState): void {
  st.x = x;
  st.z = z;
  st.yaw = yaw;
  st.speed = 0;
  st.walk = 0;
  st.phi = 0;
  st.shuffle = 0;
  st.shufflePhi = 0;
  st.headYaw = headYaw;
  st.headPitch = headPitch;
  st.segment = 'dwell';
  st.segmentIndex = 0;
  rig.root.position.set(x, y, z);
  rig.root.rotation.y = yaw;
  poseWander(rig, st, t, phase);
  // a slow shoulder-line turn: she looks over the clearing, then back along the ledge
  const turn = 0.12 * Math.sin(t * 0.11 + phase);
  rig.hips.rotation.y += turn;
  rig.chest.rotation.y -= turn * 0.5;
}

/** slow seated look-around: a seeded sequence of head keys over a 14 s cycle */
function seatedLook(t: number, phase: number, keys: [number, number, number][], period: number): [number, number] {
  const u = (((t + phase) % period) + period) % period / period;
  for (let k = 0; k < keys.length - 1; k++) {
    if (u >= keys[k][0] && u <= keys[k + 1][0]) {
      const w = smooth((u - keys[k][0]) / Math.max(1e-6, keys[k + 1][0] - keys[k][0]));
      return [keys[k][1] + (keys[k + 1][1] - keys[k][1]) * w, keys[k][2] + (keys[k + 1][2] - keys[k][2]) * w];
    }
  }
  return [0, 0];
}

// ---- the system ----

/** where the fairy hovers relative to the face: ahead of the eyes, a little to her left and above the eye line */
const FAIRY_AHEAD = 0.4;
const FAIRY_SIDE = 0.12;
const FAIRY_UP = 0.08;
/** the walker's fairy: delayed-average taps (s) and weights — a spring-like lag that is still a function of t */
const LAG_TAPS: [number, number][] = [
  [0.0, 0.34],
  [0.08, 0.28],
  [0.16, 0.22],
  [0.26, 0.16],
];

export function createNpcs(opts: NpcOptions): Npcs {
  const { chars, ground, layout } = opts;
  const rng = createRng(opts.seed);
  const group = new Group();
  group.name = 'npc-fairies';

  // -- kokiri-a: the wander --
  const walker = chars[0];
  const legLength = walker.rig.props.hipY - walker.rig.props.ankleY;
  const sched = buildSchedule(NPC_LOOP, rng.fork('loop'), legLength);
  // phase so the loop starts mid-dwell at her verge spot at t = 0
  const phase0 = -0.6 * sched.segments[0].dur;
  const wander: WanderState = { x: 0, z: 0, yaw: 0, speed: 0, walk: 0, phi: 0, shuffle: 0, shufflePhi: 0, headYaw: 0, headPitch: 0, segment: 'dwell', segmentIndex: 0 };
  // off-limits check of the authored loop (waypoints and 0.25 m samples along every leg)
  const offLimits: string[] = [];
  for (let i = 0; i < NPC_LOOP.length; i++) {
    const a = NPC_LOOP[i];
    const b = NPC_LOOP[(i + 1) % NPC_LOOP.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 0; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const z = a.z + ((b.z - a.z) * k) / n;
      if (ground.onStairs(x, z)) offLimits.push(`stairs@${x.toFixed(2)},${z.toFixed(2)}`);
      if (ground.blocked(x, z)) offLimits.push(`blocked@${x.toFixed(2)},${z.toFixed(2)}`);
    }
  }
  if (offLimits.length) console.warn(`[npc] loop crosses off-limits ground: ${offLimits.slice(0, 4).join(' ')}${offLimits.length > 4 ? ' …' : ''}`);

  // -- kokiri-b: the seat --
  const sitter = chars[1];
  const seatDef: NpcSeat = NPC_SEAT;
  const stair = layout.stairs.find((s) => s.id === seatDef.stair) ?? layout.stairs[0];
  const sl = Math.hypot(stair.dir[0], stair.dir[1]);
  const dx = stair.dir[0] / sl;
  const dz = stair.dir[1] / sl;
  // +v is the right-hand side climbing (ground.ts / heightfield convention)
  const vx = -dz;
  const vz = dx;
  const nosingU = seatDef.tread * stair.tread;
  const seatYaw = Math.atan2(-dx, -dz) + MathUtils.degToRad(seatDef.yawDeg);
  const at = (u: number, v: number, out: Vector3) => out.set(stair.base[0] + dx * u + vx * v, 0, stair.base[2] + dz * u + vz * v);
  const seat: SeatPose = { hips: new Vector3(), yaw: seatYaw, ankleL: new Vector3(), ankleR: new Vector3() };
  at(nosingU + SEAT_BACK, seatDef.v, seat.hips);
  seat.hips.y = ground.surface(seat.hips.x, seat.hips.z) + HIP_LIFT;
  const seatFwd = new Vector3(Math.sin(seatYaw), 0, Math.cos(seatYaw));
  const seatRight = new Vector3(-seatFwd.z, 0, seatFwd.x);
  const soleUp = -sitter.rig.props.sole[1];
  const hw = sitter.rig.props.hipHalfWidth;
  for (const [side, target, reach] of [
    [1, seat.ankleL, SEAT_REACH[0]],
    [-1, seat.ankleR, SEAT_REACH[1]],
  ] as const) {
    // the feet a little wider than the hips (the knees fall apart), the right one further out
    target.copy(seat.hips).addScaledVector(seatFwd, reach).addScaledVector(seatRight, -side * (hw + (side > 0 ? 0.035 : 0.05)));
    target.y = ground.surface(target.x, target.z) + soleUp;
  }
  const seatKeys: [number, number, number][] = [
    [0, 0, 0],
    [0.12, 0, 0],
    [0.22, rng.range(0.5, 0.9), rng.range(-0.05, 0.1)],
    [0.42, rng.range(0.4, 0.8), rng.range(-0.05, 0.1)],
    [0.55, -rng.range(0.3, 0.7), rng.range(0, 0.12)],
    [0.78, -rng.range(0.2, 0.6), rng.range(0, 0.1)],
    [0.9, 0, 0],
    [1, 0, 0],
  ];
  const seatLookPeriod = 14;
  const seatPhase = rng.range(0, seatLookPeriod);
  const feetMid = new Vector3().addVectors(seat.ankleL, seat.ankleR).multiplyScalar(0.5);

  // -- kokiri-ledge: the stand on the raised ledge (round 48; ref-04), facing south over the clearing --
  const ledgeChar = chars[LEDGE_SLOT] ?? null;
  const ledgeSpot = layout.npcSpots.find((n) => n.id === 'kokiri-ledge')?.position ?? [-0.6, 5.62, -78.4];
  const ledge = { x: ledgeSpot[0], z: ledgeSpot[2], yaw: 0, y: ground.height(ledgeSpot[0], ledgeSpot[2]) };
  const ledgeRng = rng.fork('ledge');
  const ledgeKeys: [number, number, number][] = [
    [0, 0, 0],
    [0.1, 0, 0],
    [0.2, -ledgeRng.range(0.5, 0.9), ledgeRng.range(0.08, 0.2)],
    [0.38, -ledgeRng.range(0.4, 0.7), ledgeRng.range(0.05, 0.15)],
    [0.5, ledgeRng.range(0.3, 0.6), ledgeRng.range(0.1, 0.22)],
    [0.7, ledgeRng.range(0.5, 0.9), ledgeRng.range(0, 0.1)],
    [0.85, 0, ledgeRng.range(0.05, 0.15)],
    [1, 0, 0],
  ];
  const ledgeLookPeriod = 17;
  const ledgePhase = ledgeRng.range(0, ledgeLookPeriod);
  const ledgeSt: WanderState = { ...wander };
  let ledgeShown = true;
  const showLedge = (on: boolean) => {
    if (!ledgeChar || ledgeShown === on) return;
    ledgeShown = on;
    ledgeChar.rig.root.visible = on;
    for (const f of fairies) if (f.slot === LEDGE_SLOT) f.fairy.group.visible = on;
  };

  // -- fairies: one per girl --
  const fairies: { fairy: Fairy; slot: number }[] = [];
  for (const slot of [0, 1, LEDGE_SLOT]) {
    if (!chars[slot]) continue;
    const fairy = createFairy({ name: `kokiri-fairy-${slot}`, tint: new Color(0.72, 1.0, 0.62), lightColor: 0xbfffc4, seed: `${opts.seed}/fairy/${slot}`, scale: 0.75 });
    fairies.push({ fairy, slot });
    group.add(fairy.group);
  }

  const driven = new Set<number>();
  const face = new Vector3();
  const acc = new Vector3();
  const _st: WanderState = { ...wander };
  /** the walker's face point at time τ from the closed-form state (no rig needed) */
  const walkerFaceAt = (tau: number, out: Vector3) => {
    wanderStateAt(sched, phase0, tau, _st);
    const fx = Math.sin(_st.yaw);
    const fz = Math.cos(_st.yaw);
    const h = ground.height(_st.x, _st.z);
    return out.set(_st.x + fx * FAIRY_AHEAD - fz * FAIRY_SIDE, h + walker.rig.props.headCentreY + FAIRY_UP, _st.z + fz * FAIRY_AHEAD + fx * FAIRY_SIDE);
  };
  /** a posed kid's face point from its rig */
  const rigFace = (c: Character, out: Vector3) => {
    c.rig.root.updateMatrixWorld(true);
    c.rig.head.getWorldPosition(out);
    const yaw = c.rig.root.rotation.y;
    return out.add(_tmp.set(Math.sin(yaw) * FAIRY_AHEAD - Math.cos(yaw) * FAIRY_SIDE, FAIRY_UP, Math.cos(yaw) * FAIRY_AHEAD + Math.sin(yaw) * FAIRY_SIDE));
  };

  let lastT = 0;
  return {
    group,
    drive(slot, actor, t, view = false) {
      lastT = t;
      if (slot === LEDGE_SLOT && ledgeChar) {
        // posed on her spot in every mode (the audit's contact stays true); shown only off the fixed views
        actor.pos.set(ledge.x, 0, ledge.z);
        actor.yaw = ledge.yaw;
        const [hy, hp] = seatedLook(t, ledgePhase, ledgeKeys, ledgeLookPeriod);
        poseLedgeIdle(ledgeChar.rig, ledge.x, ledge.z, ledge.y, ledge.yaw, t, 5.1, hy, hp, ledgeSt);
        plantFeet(ledgeChar.rig, ground.height, actor.contact);
        actor.shadow.position.set(ledge.x, ground.decalHeight(ledge.x, ledge.z, actor.shadowRadius), ledge.z);
        showLedge(!view);
        actor.shadow.visible = !view;
        driven.add(LEDGE_SLOT);
        return true;
      }
      if (view) return false;
      if (slot === 0) {
        wanderStateAt(sched, phase0, t, wander);
        actor.pos.set(wander.x, 0, wander.z);
        actor.yaw = wander.yaw;
        const rig = walker.rig;
        rig.root.position.set(wander.x, ground.height(wander.x, wander.z), wander.z);
        rig.root.rotation.y = wander.yaw;
        poseWander(rig, wander, t, 1.3);
        plantFeet(rig, ground.height, actor.contact);
        actor.shadow.position.set(wander.x, ground.decalHeight(wander.x, wander.z, actor.shadowRadius), wander.z);
        driven.add(0);
        return true;
      }
      if (slot === 1) {
        actor.pos.set(seat.hips.x, 0, seat.hips.z);
        actor.yaw = seat.yaw;
        const [hy, hp] = seatedLook(t, seatPhase, seatKeys, seatLookPeriod);
        poseSeated(sitter.rig, seat, t, 3.4, hy, hp);
        // contact: the lower sole (both rest on the tread below)
        sitter.rig.root.updateMatrixWorld(true);
        sitter.rig.ankleL.localToWorld(_tmp.copy(sitter.rig.sole));
        sitter.rig.ankleR.localToWorld(_tmp2.copy(sitter.rig.sole));
        actor.contact.copy(_tmp.y <= _tmp2.y ? _tmp : _tmp2);
        actor.shadow.position.set(feetMid.x, ground.decalHeight(feetMid.x, feetMid.z, actor.shadowRadius), feetMid.z);
        driven.add(1);
        return true;
      }
      return false;
    },
    updateFairies(t) {
      lastT = t;
      for (const { fairy, slot } of fairies) {
        const c = chars[slot];
        if (slot === 0 && driven.has(0)) {
          acc.set(0, 0, 0);
          for (const [lag, w] of LAG_TAPS) acc.addScaledVector(walkerFaceAt(t - lag, face), w);
          fairy.anchor.copy(acc);
        } else fairy.anchor.copy(rigFace(c, face));
        fairy.update(t, c.rig.root.rotation.y + Math.PI);
      }
      driven.clear();
    },
    audit() {
      wanderStateAt(sched, phase0, lastT, _st);
      // the seated knee angle (interior, deg) and hip height over the tread, read off the posed rig
      const kneeDeg = Number(((Math.PI - sitter.rig.kneeL.rotation.x) * (180 / Math.PI)).toFixed(1));
      return {
        npcCount: chars.length,
        npcGirls: chars.filter((c) => c.rig.root.name !== 'kokiri-2').length,
        npcWaypoints: NPC_LOOP.length,
        npcSitting: 1,
        npcStanding: ledgeChar ? 1 : 0,
        npc: {
          loop: { periodS: Number(sched.period.toFixed(3)), lengthM: Number(sched.length.toFixed(3)), segments: sched.segments.length, offLimits, strideM: Number((4 * legLength * Math.sin(AMP)).toFixed(4)), speedRange: [1.0, 1.15] },
          walker: { segment: _st.segment, segmentIndex: _st.segmentIndex, x: Number(_st.x.toFixed(3)), z: Number(_st.z.toFixed(3)), yaw: Number(_st.yaw.toFixed(3)), speed: Number(_st.speed.toFixed(3)), phi: Number(_st.phi.toFixed(3)) },
          seat: {
            stair: stair.id,
            tread: seatDef.tread,
            hips: [Number(seat.hips.x.toFixed(3)), Number(seat.hips.y.toFixed(3)), Number(seat.hips.z.toFixed(3))],
            hipOverTreadM: HIP_LIFT,
            behindNosingM: SEAT_BACK,
            kneeInteriorDeg: kneeDeg,
            feet: [seat.ankleL, seat.ankleR].map((a) => [Number(a.x.toFixed(3)), Number((a.y - soleUp).toFixed(3)), Number(a.z.toFixed(3))]),
            yaw: Number(seat.yaw.toFixed(3)),
          },
          /** the ledge girl (round 48): her spot, facing, whether she is shown (hidden under capture) */
          ledge: ledgeChar ? { x: ledge.x, z: ledge.z, y: Number(ledge.y.toFixed(3)), yaw: ledge.yaw, shown: ledgeShown } : null,
          fairies: fairies.map(({ fairy, slot }) => ({ slot, anchor: [Number(fairy.anchor.x.toFixed(3)), Number(fairy.anchor.y.toFixed(3)), Number(fairy.anchor.z.toFixed(3))], draws: fairy.draws, shown: fairy.group.visible })),
        },
      };
    },
  };
}
