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
 *  - kokiri-south-bank (round 50, footage 9–13 s: a kid on the fence-topped bank looking down at
 *    Link) STANDS on the south bank's terrace (placement.ts `NPC_SOUTH_BANK`, the LIVE ground
 *    there ≈ 1.93 m) facing the plaza centre, the same weight-shift idle with her own seeded
 *    look-around keyed a little downward (the plaza is 2.9 m below her eyes, 24 m out). She is
 *    behind every fixed camera but C, and 7.7 m outside C's right edge at 21.7 m, so she is
 *    shown in every mode.
 *  - each girl has a FAIRY (navi.ts `createFairy`) hovering above and to the LEFT of her head
 *    (round 50, demo d_011 / d_024: ≈ 0.4 m up, 0.3 m out, never in front of the face); it
 *    follows the walker with a short delayed-average lag (a spring-like trail that is still a
 *    pure function of t). The fairies' point lights stay in the scene in every mode (lane 7:
 *    a constant light count — no program recompiles when a fairy hides or capture begins) and
 *    dim to zero by intensity where the fairy is hidden (the ledge girl's under capture) or was
 *    kept out of the six frames (the bank girl's).
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
import { NPC_GROVE_YARD, NPC_LOOP, NPC_SEAT, NPC_SOUTH_BANK, type NpcSeat, type NpcWaypoint } from './placement';
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
  /** the kids' characters by slot (0 = kokiri-a, 1 = kokiri-b, 2 = kokiri-c the boy, 3 = kokiri-ledge, 4 = kokiri-south-bank) */
  chars: Character[];
  ground: Ground;
  layout: Layout;
  seed: string;
}

/** the kid slot that stands on the raised ledge (round 48) */
export const LEDGE_SLOT = 3;
/** the kid slot that stands on the south bank's terrace (round 50, `NPC_SOUTH_BANK`) */
export const BANK_SLOT = 4;
/** the kid slot that stands in the north grove's yard (lane 7, `NPC_GROVE_YARD`) — no fairy: a sixth light would recompile every lit program */
export const GROVE_SLOT = 5;

export interface Npcs {
  /** the fairies (added to the character group) */
  group: Group;
  /**
   * Place and pose kid `slot` for simulation time t if it has a behaviour (wander / sit /
   * ledge idle / bank idle); writes the actor's pos, yaw, contact and shadow. False = no
   * behaviour, the caller poses it as before. Under capture (`view` true) the wander and the
   * seat stand aside for the per-view placement (false), the ledge girl is posed on her spot but
   * hidden, and the bank girl stays (she is outside every fixed frustum). With `player` (Link's
   * root, ground-relative x / z) the posed kid notices him (`noticePlayer`); capture passes none.
   */
  drive(slot: number, actor: NpcActor, t: number, view?: boolean, player?: Vector3 | null): boolean;
  /** the notice for a kid the caller posed itself (the boy at the door): after its pose, before the fairies */
  notice(rig: Rig, actor: NpcActor, player: Vector3, walk?: number): void;
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
  // idle: weight shift, breathing, a small sway. Owner 23:00 ("look a bit better" at 2–6 m — a
  // held pose reads as a mannequin): the shift is 2.5 cm with a 0.05 rad lean and a slow yaw sway
  // through the torso (round 47's 1 cm / 0.025 rad moved a pixel at 4 m), the breath 8 mm.
  const s1 = Math.sin(t * 0.45 + phase);
  const s2 = Math.sin(t * 0.31 + phase * 1.7);
  const s3 = Math.sin(t * 0.19 + phase * 0.6);
  const breath = Math.sin(t * Math.PI * 2 * 0.3 + phase);
  // the weight shift moves the hips over planted feet: the thighs tilt back by the shift over the leg
  // (below), so the soles stay where they are and the body leans, instead of the whole kid sliding
  const shift = 0.025 * s1 * idle;
  const legLen = r.props.hipY - r.props.ankleY;
  r.hips.position.x += shift + 0.012 * sn * w;
  r.hips.rotation.z = -0.05 * s1 * idle + 0.035 * sn * w;
  r.hips.rotation.y = (0.04 * s2 + 0.05 * s3) * idle + 0.09 * tl * w;
  r.chest.position.y += 0.008 * breath * idle + 0.005 * Math.cos(2 * s.phi) * w;
  r.chest.rotation.x = 0.02 + 0.02 * breath * idle + 0.045 * w;
  r.chest.rotation.y = (-0.02 * s2 - 0.03 * s3) * idle - 0.06 * tl * w;
  r.chest.rotation.z = 0.02 * s1 * idle;
  // legs: the stance leg sweeps back at a near-constant rate (tri); the swing leg lifts its knee early
  const thetaL = AMP * w * tl;
  const thetaR = -thetaL;
  const kneeL = 0.05 + 1.15 * w * Math.max(0, cs) * (0.55 - 0.45 * sn);
  const kneeR = 0.05 + 1.15 * w * Math.max(0, -cs) * (0.55 + 0.45 * sn);
  // the legs stay vertical under the pelvis' lean (+0.05 s1 cancels the hips' −0.05 s1) and tilt back by the shift
  r.thighL.rotation.set(-thetaL + 0.02 * idle, 0, 0.05 + 0.06 * s1 * idle - shift / legLen);
  r.thighR.rotation.set(-thetaR + 0.02 * idle, 0, -0.05 + 0.06 * s1 * idle - shift / legLen);
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
  // arms: standing, the upper arm hangs a touch back and the elbow bends so the hand rests forward by
  // the hip (owner 23:00 — a straight arm at the side read as a doll's); a slow, small contralateral
  // swing walking, the bend easing toward the swing's
  const arm = 0.3 * w;
  r.shoulderL.rotation.set(0.04 * idle + 0.03 * Math.sin(t * 0.7 + phase) * idle + arm * tl, 0, 0.13);
  r.shoulderR.rotation.set(0.04 * idle - 0.03 * Math.sin(t * 0.7 + phase + 0.5) * idle - arm * tl, 0, -0.13);
  r.elbowL.rotation.x = -0.2 - 0.26 * idle - 0.02 * Math.sin(t * 0.61 + phase) * idle - 0.25 * w - 0.2 * w * Math.max(0, -tl);
  r.elbowR.rotation.x = -0.22 - 0.24 * idle - 0.02 * Math.sin(t * 0.61 + phase + 0.9) * idle - 0.25 * w - 0.2 * w * Math.max(0, tl);
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
const _off = new Vector3();
const _head = new Vector3();
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
 * the sitter's chin up (rad, relative to her curled chest): the back rounds 0.30 rad forward over the
 * tipped pelvis, and the head used to take only 0.08 of it back, so her resting gaze sat 0.22 rad
 * below level — from the follow camera's 1.5 m eye at 5–6 m her fringe covered her eyes and she read
 * hunched, face hidden (lane 7's play-distance review, 2026-09-25). 0.25 leaves the head a hair
 * below level: the back stays rounded, the face reads.
 */
const SEAT_CHIN_UP = 0.25;

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
  r.neck.rotation.x = -headPitch - SEAT_CHIN_UP + 0.02 * breath;
  if (r.cap) r.cap.rotation.x = 0.02 * Math.sin(t * 0.7 + phase);
  const b = blink(t + phase * 0.3);
  for (const e of r.eyes) e.scale.y = 1 - 0.92 * b;
}

/**
 * The ledge girl's idle (round 48): standing on her spot facing `yaw`, weight shifting, breathing,
 * the dwell-style look-around from the seeded head keys — the wander pose with the walk weight 0.
 */
function poseLedgeIdle(rig: Rig, x: number, z: number, y: number, yaw: number, t: number, phase: number, headYaw: number, headPitch: number, st: WanderState, shuffle = 0, shufflePhi = 0): void {
  st.x = x;
  st.z = z;
  st.yaw = yaw;
  st.speed = 0;
  st.walk = 0;
  st.phi = 0;
  st.shuffle = shuffle;
  st.shufflePhi = shufflePhi;
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

// ---- noticing Link (lane 7, 2026-09-23) ----

/** Link within this of a kid: her head starts turning to him; fully on him by NOTICE_NEAR_M */
const NOTICE_FAR_M = 5.0;
const NOTICE_NEAR_M = 2.8;
/** the wanderer stops and turns to Link inside this (m) … */
const GREET_NEAR_M = 1.7;
/** … and walks on once he has stayed beyond this (m) for GREET_RELEASE_S — hysteresis, so a player idling at the edge does not make her stutter */
const GREET_FAR_M = 2.6;
const GREET_RELEASE_S = 0.6;
/** the stop-and-turn and the turn-back each blend over this (s) */
const GREET_BLEND_S = 0.5;
/** a standing kid's body turn toward Link runs at most this fast (rad/s): a 180° turn takes 1.26 s, not the blend's 0.5 */
const GREET_TURN_RATE = 2.5;

/**
 * A standing kid's greeting (lane 7, after the wanderer's): within GREET_NEAR_M she turns her body to
 * face Link and holds it — the head's notice then has him straight ahead; once he has stayed beyond
 * GREET_FAR_M for GREET_RELEASE_S she turns back to her stand's yaw. Each turn blends over the longer
 * of GREET_BLEND_S and the turn at GREET_TURN_RATE, with the schedule's turn-shuffle under the feet.
 * State per kid; capture passes no player, so the six frames never see a turn.
 */
interface Greet {
  active: boolean;
  since: number;
  until: number;
  dur: number;
  farSince: number;
  yaw: number;
  g: number;
  lastT: number;
}
const newGreet = (): Greet => ({ active: false, since: 0, until: -1e9, dur: GREET_BLEND_S, farSince: -1, yaw: 0, g: 0, lastT: -1 });
function standGreet(gr: Greet, t: number, x: number, z: number, standYaw: number, player: Vector3 | null | undefined): { yaw: number; shuffle: number; shufflePhi: number } {
  const dt = gr.lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - gr.lastT));
  gr.lastT = t;
  if (player) {
    const d = Math.hypot(player.x - x, player.z - z);
    if (!gr.active) {
      if (d < GREET_NEAR_M && t - gr.until > gr.dur) {
        gr.active = true;
        gr.since = t;
        gr.farSince = -1;
        gr.yaw = Math.atan2(player.x - x, player.z - z);
        gr.dur = Math.max(GREET_BLEND_S, Math.abs(angleTo(standYaw, gr.yaw)) / GREET_TURN_RATE);
      }
    } else if (d > GREET_FAR_M) {
      if (gr.farSince < 0) gr.farSince = t;
      if (t - gr.farSince > GREET_RELEASE_S) {
        gr.active = false;
        gr.until = t;
        gr.dur = Math.max(GREET_BLEND_S, Math.abs(angleTo(standYaw, gr.yaw)) / GREET_TURN_RATE);
      }
    } else gr.farSince = -1;
    // while he stays, the body follows him round at the turn rate (the yaw target eases, the blend is at 1)
    if (gr.active && t - gr.since > gr.dur) gr.yaw += MathUtils.clamp(angleTo(gr.yaw, Math.atan2(player.x - x, player.z - z)), -GREET_TURN_RATE * dt, GREET_TURN_RATE * dt);
  } else if (gr.active) {
    gr.active = false;
    gr.until = t;
  }
  const g = gr.active ? smooth((t - gr.since) / gr.dur) : 1 - smooth((t - gr.until) / gr.dur);
  gr.g = g;
  if (g <= 0) return { yaw: standYaw, shuffle: 0, shufflePhi: 0 };
  const turn = angleTo(standYaw, gr.yaw);
  const bell = 4 * g * (1 - g);
  return {
    yaw: standYaw + turn * g,
    shuffle: Math.min(1, Math.abs(turn) / 1.2) * bell,
    shufflePhi: Math.PI * 2 * 2.4 * (t - (gr.active ? gr.since : gr.until)) * Math.sign(turn || 1),
  };
}
/** how far the neck turns (rad); past it the turn fades out over 0.7 rad rather than pinning to the shoulder */
const NOTICE_YAW_MAX = 1.05;
/** Link's eyes over his root (the GLB's 1.25 m to the cap) */
const PLAYER_EYE_M = 1.1;

/**
 * The kids notice Link: within NOTICE_FAR_M the posed head turns toward him — fully by
 * NOTICE_NEAR_M, within the neck's range (a fade past NOTICE_YAW_MAX, so someone walking round
 * behind her is let go, never snapped to), the pitch to his eyes (the bank girl looks down at
 * him from her terrace) — blended over the pose's own look. A pure function of his position
 * and hers, so a zero-dt re-render repeats the pose and the play state carries nothing; a
 * walking kid gives him half the turn. Capture never calls it: the six frames keep their heads.
 */
function noticePlayer(rig: Rig, kidX: number, kidZ: number, kidYaw: number, headY: number, playerX: number, playerY: number, playerZ: number, walk = 0): void {
  const dx = playerX - kidX;
  const dz = playerZ - kidZ;
  const dist = Math.hypot(dx, dz);
  if (dist >= NOTICE_FAR_M) return;
  const rel = angleTo(kidYaw, Math.atan2(dx, dz));
  const reach = 1 - smooth((Math.abs(rel) - NOTICE_YAW_MAX) / 0.7);
  const w = smooth((NOTICE_FAR_M - dist) / (NOTICE_FAR_M - NOTICE_NEAR_M)) * reach * (1 - 0.5 * walk);
  if (w <= 0) return;
  const pitch = Math.atan2(playerY + PLAYER_EYE_M - headY, dist);
  // the neck turns relative to the chest: take the pose's own hips / chest yaw (the idle turn, the walk's counter-rotation) out of the target
  const body = rig.hips.rotation.y + rig.chest.rotation.y;
  // and its pitch — the sitter's torso curls 0.3 rad forward, a standing kid's leans a few hundredths — so the
  // world pitch to his eyes is what the clamp sees, and the neck's own angle carries the torso back out
  const torso = rig.hips.rotation.x + rig.chest.rotation.x;
  const n = rig.neck.rotation;
  n.y += (MathUtils.clamp(rel - body, -NOTICE_YAW_MAX, NOTICE_YAW_MAX) - n.y) * w;
  n.x += (MathUtils.clamp(-pitch, -0.35, 0.5) - torso - n.x) * w;
}

// ---- the system ----

/**
 * Where a girl's fairy hovers relative to her head centre (round 50; demo d_011 / d_024 and
 * ref-01 read ≈ 0.4–0.5 m above the crown and ≈ 0.4 m to the side, never over the face): up
 * FAIRY_UP, out to her LEFT by FAIRY_LEFT (her left is (cos yaw, 0, −sin yaw) for +Z forward) and
 * a hair ahead of the ear line — the fixed frames' kids face Link, so the fairy sits above and
 * beside the head from the camera too.
 */
const FAIRY_UP = 0.42;
const FAIRY_LEFT = 0.3;
const FAIRY_AHEAD = 0.02;
/** the girls' fairies (round 50): a warm-white bloom and wings around a soft green core, like the demo's; Navi stays blue-white */
const KID_FAIRY_TINT = new Color(1.0, 0.95, 0.78);
const KID_FAIRY_CORE = new Color(0.78, 1.0, 0.68);
const KID_FAIRY_LIGHT = 0xe6ffd6;
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
  // The wanderer greets Link (lane 7, 2026-09-25): within GREET_NEAR_M she stops where she is, turns
  // to face him and stands — the head's notice does the rest; once he has been beyond GREET_FAR_M for
  // GREET_RELEASE_S she turns back and walks on from exactly where she stopped. The loop's clock is
  // held for the pause (`paused`), so her schedule stays a function of (t − paused): no pop on either
  // side. Capture never drives her (`view` returns above the wander branch), so the six frames cannot
  // see any of this; the play routes only meet her if they pass within arm's reach.
  const greet = { active: false, since: 0, until: -1e9, paused: 0, frozen: 0, farSince: -1, yaw: 0, g: 0 };
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
    // the tread below: `surface` is a max-height grid of the rendered stones, so under the heel — a
    // hand's width in front of the riser — it reads the nosing lip of the seat tread (0.40 m for
    // the left foot, not 0.27). Read it clear of the lip too, under the ball of the foot, and take
    // the lower: both soles flat on the lower tread.
    const heelY = ground.surface(target.x, target.z);
    const ballY = ground.surface(target.x + seatFwd.x * 0.09, target.z + seatFwd.z * 0.09);
    target.y = Math.min(heelY, ballY) + soleUp;
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
  const ledgeGreet = newGreet();
  let ledgeShown = true;
  const showLedge = (on: boolean) => {
    if (!ledgeChar || ledgeShown === on) return;
    ledgeShown = on;
    ledgeChar.rig.root.visible = on;
    for (const f of fairies) if (f.slot === LEDGE_SLOT) f.fairy.group.visible = on;
    setGlow(LEDGE_SLOT, on);
  };

  // -- kokiri-south-bank: the stand on the south bank's terrace (round 50), facing the plaza centre --
  // Its rng is a fork of its own (`bank`), drawn after every stream above: the loop, the seat and
  // the ledge keys keep their numbers (the fixed frames' kids are pinned to them).
  const bankChar = chars[BANK_SLOT] ?? null;
  const bank = { x: NPC_SOUTH_BANK.x, z: NPC_SOUTH_BANK.z, yaw: Math.atan2(NPC_SOUTH_BANK.lookAt[0] - NPC_SOUTH_BANK.x, NPC_SOUTH_BANK.lookAt[1] - NPC_SOUTH_BANK.z), y: ground.height(NPC_SOUTH_BANK.x, NPC_SOUTH_BANK.z) };
  const bankRng = rng.fork('bank');
  // the plaza is ≈ 2.9 m below her eye line and 24 m out: the resting look is ≈ 0.12 rad down
  // (poseWander reads +pitch as up), the look-around scans the plaza left / right and lifts once
  const BANK_DOWN = -0.12;
  const bankKeys: [number, number, number][] = [
    [0, 0, BANK_DOWN],
    [0.12, 0, BANK_DOWN],
    [0.22, bankRng.range(0.35, 0.7), BANK_DOWN + bankRng.range(-0.04, 0.03)],
    [0.4, bankRng.range(0.25, 0.5), BANK_DOWN + bankRng.range(-0.05, 0.02)],
    [0.52, -bankRng.range(0.3, 0.65), BANK_DOWN + bankRng.range(-0.03, 0.04)],
    [0.7, -bankRng.range(0.15, 0.45), BANK_DOWN + bankRng.range(-0.02, 0.05)],
    [0.82, 0, bankRng.range(0.02, 0.1)],
    [0.92, 0, BANK_DOWN * 0.5],
    [1, 0, BANK_DOWN],
  ];
  const bankLookPeriod = 15;
  const bankPhase = bankRng.range(0, bankLookPeriod);
  const bankSt: WanderState = { ...wander };
  const bankGreet = newGreet();

  // -- kokiri-grove-yard: the stand by the north grove's washing line (lane 7, after exp-north landed).
  // Its rng is a fork of its own (`grove`), drawn after the bank's: nothing above moves. She faces the
  // line at arm's length: the resting look is level with a little down (the pegs), the look-around
  // glances along the line both ways and once back over her shoulder toward the trail.
  const groveChar = chars[GROVE_SLOT] ?? null;
  const grove = { x: NPC_GROVE_YARD.x, z: NPC_GROVE_YARD.z, yaw: Math.atan2(NPC_GROVE_YARD.lookAt[0] - NPC_GROVE_YARD.x, NPC_GROVE_YARD.lookAt[1] - NPC_GROVE_YARD.z), y: ground.height(NPC_GROVE_YARD.x, NPC_GROVE_YARD.z) };
  const groveRng = rng.fork('grove');
  const GROVE_DOWN = -0.06;
  const groveKeys: [number, number, number][] = [
    [0, 0, GROVE_DOWN],
    [0.15, 0, GROVE_DOWN],
    [0.28, groveRng.range(0.3, 0.55), GROVE_DOWN + groveRng.range(-0.03, 0.03)],
    [0.42, groveRng.range(0.15, 0.35), GROVE_DOWN],
    [0.55, -groveRng.range(0.3, 0.5), GROVE_DOWN + groveRng.range(-0.02, 0.04)],
    [0.7, -groveRng.range(0.9, 1.2), groveRng.range(0.02, 0.08)],
    [0.82, -groveRng.range(0.2, 0.4), GROVE_DOWN],
    [0.92, 0, GROVE_DOWN * 0.5],
    [1, 0, GROVE_DOWN],
  ];
  const groveLookPeriod = 17;
  const grovePhase = groveRng.range(0, groveLookPeriod);
  const groveSt: WanderState = { ...wander };
  const groveGreet = newGreet();

  // -- fairies: one per girl. Their point lights ride on `group` itself, not in the fairy's body
  // (lane 7): a light that leaves or joins the scene changes the light count every lit program
  // is keyed on and recompiles them all (the free camera parking on a viewpoint hid the ledge
  // girl's fairy; capture toggled the bank fairy's light — structures/index.ts keeps the north
  // posts' lights in the scene for the same reason). A hidden or captured-off fairy dims its light
  // to zero by `glow` instead; the light follows the body from `anchor` + `offset(t)` every frame. --
  const fairies: { fairy: Fairy; slot: number; glow: number }[] = [];
  for (const slot of [0, 1, LEDGE_SLOT, BANK_SLOT]) {
    if (!chars[slot]) continue;
    const fairy = createFairy({ name: `kokiri-fairy-${slot}`, tint: KID_FAIRY_TINT, coreTint: KID_FAIRY_CORE, lightColor: KID_FAIRY_LIGHT, seed: `${opts.seed}/fairy/${slot}`, scale: 0.75 });
    fairies.push({ fairy, slot, glow: 1 });
    group.add(fairy.group);
    group.add(fairy.light);
  }
  const setGlow = (slot: number, on: boolean) => {
    for (const f of fairies) if (f.slot === slot) f.glow = on ? 1 : 0;
  };

  const driven = new Set<number>();
  const face = new Vector3();
  const acc = new Vector3();
  const _st: WanderState = { ...wander };
  /** the fairy's hover point for a head centre at (hx, hy, hz) facing `yaw`: above and to the left of the head */
  const hoverAt = (hx: number, hy: number, hz: number, yaw: number, out: Vector3) => {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    return out.set(hx + fx * FAIRY_AHEAD + fz * FAIRY_LEFT, hy + FAIRY_UP, hz + fz * FAIRY_AHEAD - fx * FAIRY_LEFT);
  };
  /** the walker's hover point at time τ from the closed-form state (no rig needed) */
  /**
   * the schedule's clock at wall time `tau` under the greeting's hold: frozen from the stop on while she
   * greets; after the release, frozen for taps that fall inside the pause and running again past it
   * (the taps reach 0.26 s back, so a tap from before a pause began is off by at most that)
   */
  const schedTime = (tau: number) => (greet.active ? Math.min(tau - greet.paused, greet.frozen) : Math.max(tau - greet.paused, greet.frozen));
  const walkerFaceAt = (tau: number, out: Vector3) => {
    wanderStateAt(sched, phase0, schedTime(tau), _st);
    if (greet.g > 0) _st.yaw += angleTo(_st.yaw, greet.yaw) * greet.g;
    const h = ground.height(_st.x, _st.z);
    return hoverAt(_st.x, h + walker.rig.props.headCentreY, _st.z, _st.yaw, out);
  };
  /** a posed kid's hover point from its rig */
  const rigFace = (c: Character, out: Vector3) => {
    c.rig.root.updateMatrixWorld(true);
    c.rig.head.getWorldPosition(_tmp);
    return hoverAt(_tmp.x, _tmp.y, _tmp.z, c.rig.root.rotation.y, out);
  };

  /** the notice for a posed kid: head height read off the rig, Link's root on the walkable ground */
  const noticeFor = (rig: Rig, actor: NpcActor, player: Vector3 | null | undefined, walk = 0) => {
    if (!player) return;
    rig.root.updateMatrixWorld(true);
    rig.head.getWorldPosition(_head);
    noticePlayer(rig, actor.pos.x, actor.pos.z, actor.yaw, _head.y, player.x, ground.height(player.x, player.z), player.z, walk);
  };

  let lastT = 0;
  return {
    group,
    drive(slot, actor, t, view = false, player = null) {
      lastT = t;
      if (slot === LEDGE_SLOT && ledgeChar) {
        // posed on her spot in every mode (the audit's contact stays true); shown only off the fixed views
        actor.pos.set(ledge.x, 0, ledge.z);
        const lg = standGreet(ledgeGreet, t, ledge.x, ledge.z, ledge.yaw, view ? null : player);
        actor.yaw = lg.yaw;
        const [hy, hp] = seatedLook(t, ledgePhase, ledgeKeys, ledgeLookPeriod);
        poseLedgeIdle(ledgeChar.rig, ledge.x, ledge.z, ledge.y, lg.yaw, t, 5.1, hy * (1 - ledgeGreet.g), hp, ledgeSt, lg.shuffle, lg.shufflePhi);
        plantFeet(ledgeChar.rig, ground.height, actor.contact);
        noticeFor(ledgeChar.rig, actor, player);
        actor.shadow.position.set(ledge.x, ground.decalHeight(ledge.x, ledge.z, actor.shadowRadius), ledge.z);
        showLedge(!view);
        actor.shadow.visible = !view;
        driven.add(LEDGE_SLOT);
        return true;
      }
      if (slot === BANK_SLOT && bankChar) {
        // on her terrace spot in every mode, shown in every mode (outside the six fixed frustums)
        actor.pos.set(bank.x, 0, bank.z);
        const bg = standGreet(bankGreet, t, bank.x, bank.z, bank.yaw, view ? null : player);
        actor.yaw = bg.yaw;
        const [hy, hp] = seatedLook(t, bankPhase, bankKeys, bankLookPeriod);
        poseLedgeIdle(bankChar.rig, bank.x, bank.z, bank.y, bg.yaw, t, 7.9, hy * (1 - bankGreet.g), hp, bankSt, bg.shuffle, bg.shufflePhi);
        plantFeet(bankChar.rig, ground.height, actor.contact);
        noticeFor(bankChar.rig, actor, player);
        actor.shadow.position.set(bank.x, ground.decalHeight(bank.x, bank.z, actor.shadowRadius), bank.z);
        // her fairy's light is dimmed to nothing under capture (round 50 kept it out of the six
        // frames' light loop; the light itself stays in the scene — see the fairies above); the
        // fairy is shown (it is outside the frustums like her)
        setGlow(BANK_SLOT, !view);
        driven.add(BANK_SLOT);
        return true;
      }
      if (slot === GROVE_SLOT && groveChar) {
        // in the grove's yard in every mode (80–112 m north of the plaza, outside the six fixed
        // frustums); no fairy, so nothing to dim
        actor.pos.set(grove.x, 0, grove.z);
        const gg = standGreet(groveGreet, t, grove.x, grove.z, grove.yaw, view ? null : player);
        actor.yaw = gg.yaw;
        const [hy, hp] = seatedLook(t, grovePhase, groveKeys, groveLookPeriod);
        poseLedgeIdle(groveChar.rig, grove.x, grove.z, grove.y, gg.yaw, t, 8.3, hy * (1 - groveGreet.g), hp, groveSt, gg.shuffle, gg.shufflePhi);
        plantFeet(groveChar.rig, ground.height, actor.contact);
        noticeFor(groveChar.rig, actor, player);
        actor.shadow.position.set(grove.x, ground.decalHeight(grove.x, grove.z, actor.shadowRadius), grove.z);
        driven.add(GROVE_SLOT);
        return true;
      }
      if (view) return false;
      if (slot === 0) {
        // her schedule runs on the held clock; while she greets, on the instant she stopped
        wanderStateAt(sched, phase0, schedTime(t), wander);
        if (player) {
          const d = Math.hypot(player.x - wander.x, player.z - wander.z);
          if (!greet.active) {
            if (d < GREET_NEAR_M && t - greet.until > GREET_BLEND_S) {
              greet.active = true;
              greet.since = t;
              greet.frozen = t - greet.paused;
              greet.farSince = -1;
            }
          } else if (d > GREET_FAR_M) {
            if (greet.farSince < 0) greet.farSince = t;
            if (t - greet.farSince > GREET_RELEASE_S) {
              greet.active = false;
              greet.until = t;
              greet.paused += t - greet.since;
            }
          } else greet.farSince = -1;
          if (greet.active) greet.yaw = Math.atan2(player.x - wander.x, player.z - wander.z);
        } else if (greet.active) {
          greet.active = false;
          greet.until = t;
          greet.paused += t - greet.since;
        }
        // the greeting's weight: up over the blend as she stops, down over it as she walks on
        const g = greet.active ? smooth((t - greet.since) / GREET_BLEND_S) : 1 - smooth((t - greet.until) / GREET_BLEND_S);
        greet.g = g;
        if (g > 0) {
          const turn = angleTo(wander.yaw, greet.yaw);
          wander.yaw += turn * g;
          wander.walk *= 1 - g;
          wander.speed *= 1 - g;
          wander.headYaw *= 1 - g;
          wander.headPitch *= 1 - g;
          // the feet shuffle round under the turn, a bell over the blend like the schedule's own turns
          const bell = 4 * g * (1 - g);
          wander.shuffle = Math.max(wander.shuffle, Math.min(1, Math.abs(turn) / 1.2) * bell);
          if (bell > 0) wander.shufflePhi = Math.PI * 2 * 2.4 * (t - (greet.active ? greet.since : greet.until)) * Math.sign(turn || 1);
        }
        actor.pos.set(wander.x, 0, wander.z);
        actor.yaw = wander.yaw;
        const rig = walker.rig;
        rig.root.position.set(wander.x, ground.height(wander.x, wander.z), wander.z);
        rig.root.rotation.y = wander.yaw;
        poseWander(rig, wander, t, 1.3);
        plantFeet(rig, ground.height, actor.contact);
        noticeFor(rig, actor, player, wander.walk);
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
        noticeFor(sitter.rig, actor, player);
        actor.shadow.position.set(feetMid.x, ground.decalHeight(feetMid.x, feetMid.z, actor.shadowRadius), feetMid.z);
        driven.add(1);
        return true;
      }
      return false;
    },
    notice(rig, actor, player, walk = 0) {
      noticeFor(rig, actor, player, walk);
    },
    updateFairies(t) {
      lastT = t;
      for (const { fairy, slot, glow } of fairies) {
        const c = chars[slot];
        if (slot === 0 && driven.has(0)) {
          acc.set(0, 0, 0);
          for (const [lag, w] of LAG_TAPS) acc.addScaledVector(walkerFaceAt(t - lag, face), w);
          fairy.anchor.copy(acc);
        } else fairy.anchor.copy(rigFace(c, face));
        fairy.update(t, c.rig.root.rotation.y + Math.PI);
        // the light rides on `group` (world = local here): put it where the body is, breathing × glow
        fairy.light.position.copy(fairy.anchor).add(fairy.offset(t, _off));
        fairy.light.intensity *= glow;
      }
      driven.clear();
    },
    audit() {
      wanderStateAt(sched, phase0, lastT, _st);
      // the seated knee angles (interior, deg, L / R) and hip height over the tread, read off the posed rig
      const kneeDeg = [sitter.rig.kneeL, sitter.rig.kneeR].map((k) => Number(((Math.PI - k.rotation.x) * (180 / Math.PI)).toFixed(1)));
      return {
        npcCount: chars.length,
        npcGirls: chars.filter((c) => c.rig.root.name !== 'kokiri-2').length,
        npcWaypoints: NPC_LOOP.length,
        npcSitting: 1,
        npcStanding: (ledgeChar ? 1 : 0) + (bankChar ? 1 : 0) + (groveChar ? 1 : 0),
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
          /** the south-bank girl (round 50): her spot on the LIVE ground, facing the plaza centre, always shown */
          bank: bankChar ? { x: bank.x, z: bank.z, y: Number(bank.y.toFixed(3)), yaw: Number(bank.yaw.toFixed(3)), shown: bankChar.rig.root.visible } : null,
          fairies: fairies.map(({ fairy, slot, glow }) => ({ slot, anchor: [Number(fairy.anchor.x.toFixed(3)), Number(fairy.anchor.y.toFixed(3)), Number(fairy.anchor.z.toFixed(3))], draws: fairy.draws, shown: fairy.group.visible, glow, lightInScene: fairy.light.parent === group })),
        },
      };
    },
  };
}
