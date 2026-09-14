/**
 * Skinned GLB Link — Astra's textured, rigged runtime candidate (public/models/link/link-runtime.glb,
 * provenance in SOURCE.md next to it) behind the procedural fallback. The character ART is hers;
 * this file is the runtime: load, validate (bones / clips), pose deterministically, plant, look.
 *
 * Determinism (W41): the pose is a pure function of the simulation time `t`. Every clip action is
 * kept active and its `time` is SET each frame (clip time = (t · rate + heroOffset) mod duration),
 * then `mixer.update(0)` evaluates the blend — no wall-clock dt accumulation, so `setTime()` jumps
 * and the determinism re-capture reproduce the frame byte for byte. Gait crossfades (play mode)
 * are weights computed from `t − gaitSwitchT`, hard when that is −Infinity (captures).
 *
 * Playback rate per gait = GAIT_SPEED / (stride / cycle) from her pipeline.json — 1.0 for every
 * clip as delivered; the formula stays so a future clip with a different stride does not slide.
 *
 * The head look-at rotates two pivots inserted above the `neck` and `head` bones rather than the
 * bones themselves: the mixer only rewrites a bound property when its blended value changed, so a
 * rotation added to a bone would survive into a frame rendered at the same `t` and double up.
 * The leg IK below uses the same device: six pivots (thigh / knee / ankle, both legs).
 *
 * Foot planting (round 4) — the clips were animated on a flat plane; here every sole meets the
 * ground under IT, so on the stair flight (0.27 m risers) and on slopes the two feet stand on
 * different heights instead of one floating or sinking by the local step:
 *   1. the skeleton is posed for `t` with the root at the placement height; both soles (the
 *      ankle-local markers from Astra's manifest) are read. The lower sole is the planted foot;
 *      the other is in stance too (double support) or in a swing — per the clip's swing table,
 *      sampled from the clip itself at load;
 *   2. each foot gets a SUPPORT: a stance foot the PLANT support — the highest ground under its
 *      heel, ball and toe, made continuous by ramping over the 4.5 cm after the toe crosses a
 *      nosing / before the heel leaves one (see the ENVELOPE comment; a toe past a nosing stands
 *      on the upper tread, heel in the air); a swing foot the PLANT support of its take-off spot
 *      easing to that of its landing spot (the same values the stance rule reads at either end,
 *      so toe-off and heel-strike are seamless), held up by the CLEAR support under its ball and
 *      toe so it climbs before a nosing and comes down after leaving a tread, blended out before
 *      heel-strike so it lands ON its landing support;
 *   3. the root is grounded on the LOWER of the two root supports (a contact foot's own support;
 *      a swing foot's eases from the double-support level at toe-off to the one at heel-strike),
 *      so a leg is only ever bent, never stretched — on flat ground exactly the round-3 whole-root
 *      drop, so the hero views A / C / D do not move;
 *   4. each foot is raised by its support's excess over the root support (clamped to
 *      MAX_CORRECTION) with an analytic two-bone IK: the knee bends about its own bend plane, then
 *      the thigh swings the ankle onto the target; the ankle pivot restores the clip's foot
 *      orientation and, for a foot in contact, tilts the sole onto the local slope (central
 *      differences over two baselines, so a step edge reads as an edge and not as a slope).
 * Everything is a closed-form function of `t`, the placement and the ground: no smoothing over
 * time, no state. Every support is continuous in the sole's position and the facing (a nosing
 * is a ramp over a few cm of foot travel, never a pop) — see `envelope`.
 */
import { AnimationAction, AnimationMixer, Bone, Box3, Group, LoopRepeat, Material, MathUtils, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAIT_SPEED, GAITS, type Gait, type GroundSampler } from './animation';
import type { FootContact, PlantInfo, Puppet, PuppetPose } from './puppet';

/** served by Vite from public/ */
export const LINK_GLB_FILE = 'models/link/link-runtime.glb';
/** the delivered file's hash, recorded in public/models/link/SOURCE.md — reported, never recomputed at runtime */
export const LINK_GLB_SHA256 = '281895fef8f8fda7e7fe73f7fa84ef16fff2df8cb2ead48be15327dece3f2faa';

/**
 * Clip contract from Astra's pipeline.json (rig.clips): stride and cycle per gait, plus the clip
 * time of the hero pose. The harness samples t = 12.5 + settle/60 s (settle 6 → 12.6 s); like
 * HERO_PHASE for the procedural rig, the offset puts the walk / run / stairs clips at a right-foot-
 * forward mid-stride there (sampled from her ankle contact paths: walk frame 16/33 — L toe-off, R
 * heel-strike, soles 0.43 m apart; run frame 15/34 — R about to land, L trailing 0.09 m up; stairs
 * frame 22/44 — R heel-strike).
 */
interface ClipSpec {
  strideM: number;
  cycleS: number;
  heroClipTime: number;
}
export const CLIP_SPEC: Record<Gait, ClipSpec> = {
  idle: { strideM: 0, cycleS: 3.0, heroClipTime: 0 },
  walk: { strideM: 0.88, cycleS: 0.55, heroClipTime: 16 / 60 },
  run: { strideM: 2.21, cycleS: 0.5666667, heroClipTime: 15 / 60 },
  stairs: { strideM: 0.8066667, cycleS: 0.7333333, heroClipTime: 22 / 60 },
};
/** simulation time of the hero captures (capture.mjs DEFAULT_SIM_TIME 12.5 + 6 settle frames) */
export const HERO_T = 12.6;
/** play-mode gait crossfade length (s) */
const BLEND_S = 0.18;

const REQUIRED_BONES = ['hips', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'] as const;

/** ankle-local sole contact markers (three.js axes) from her runtime capture manifest — the ball of the foot */
const SOLE_L = new Vector3(-0.000000016, 0.05900068, 0.08564404);
const SOLE_R = new Vector3(0.000000016, 0.05900068, 0.08564404);
/**
 * The sole's footprint along the facing, from the marker: the toe joint 9 cm ahead (measured on
 * the rig), the heel 10 cm behind. A stance foot rests on the HIGHEST support under the three
 * points — a foot whose toe is past a nosing stands on the upper tread on its toe, heel in the
 * air, instead of its toe inside the riser — and a swing foot clears with its toe as well as its
 * ball. On the paving all three read the same ground.
 */
const TOE_AHEAD = 0.09;
const HEEL_BACK = 0.1;
const FOOT_POINTS = [-HEEL_BACK, 0, TOE_AHEAD];
/** the reported contact moves from the ball to the toe / heel only when the ball is off its ground by more than this (m) */
const CONTACT_OFF = 0.03;
/** the contact point is reported for the other foot only when its sole is nearer its ground by more than this (m) — no flip-flop on float noise */
const REPORT_TIE = 0.0005;

/**
 * Leg IK tuning. Contact weight (the slope tilt of the sole): 1 within CONTACT_LIFT0 of the
 * planted sole's height in the posed clip, 0 beyond CONTACT_LIFT1 (the walk swing peaks at
 * 0.067 m, stairs / run at 0.15 m). Stance vs swing itself comes from the clip tables.
 */
const CONTACT_LIFT0 = 0.004;
const CONTACT_LIFT1 = 0.06;
/**
 * Swing-foot support: the take-off support eases to the landing support early in the swing when
 * the foot climbs (by RISE_END — the foot reaches the next nosing after ~¼ of the swing, so the
 * rise has to be mostly done by then) and late when it descends (DESC0..DESC1 — it travels level
 * and drops onto the lower tread); the root's eases over the whole swing.
 */
const RISE_END = 0.4;
const DESC0 = 0.45;
const DESC1 = 0.9;
/**
 * The CLEAR support blends in from its closed state over the first CLEAR_OPEN of a swing and back
 * out over CLEAR_CLOSE0..1 before heel-strike. The closed state is the sink footprint at slope
 * SWING_LAMBDA — never above the stance support (a gentler sink is lower), never below the ground
 * under the ball (its 7.7 cm ramp is shorter than the toe / heel offsets) — so with the predicted
 * support the swing foot reads exactly the stance rule at toe-off and heel-strike.
 */
const CLEAR_OPEN = 0.3;
const CLEAR_CLOSE0 = 0.55;
const CLEAR_CLOSE1 = 0.85;
const SWING_LAMBDA = 3.5;
/**
 * Clip tables: samples per cycle, the sole lift above the cycle's floor that ends a stance, and
 * the shortest lift that counts as a swing (the run clip's stance sole bobs by 1–3 mm).
 */
const TABLE_N = 96;
const STANCE_LIFT = 0.001;
const MIN_SWING_S = 0.1;
/** largest vertical foot correction (m): a step edge under one foot can never pull a leg apart */
const MAX_CORRECTION = 0.3;
/** leg extension limits as fractions of the straight leg / the fully folded leg */
const MAX_REACH = 0.995;
const MIN_REACH = 1.02;
/**
 * Foot tilt: the ground gradient is read over two baselines (±NORMAL_NEAR, ±NORMAL_FAR); a slope
 * reads the same both times, a step edge (tread nosing, slab rim, the 10 cm paving grid) does not
 * and gets no tilt. The tilt fades in from TILT_GRAD0 (flat paving stays flat) and is clamped.
 */
const NORMAL_NEAR = 0.04;
const NORMAL_FAR = 0.08;
const TILT_GRAD0 = 0.035;
const TILT_GRAD1 = 0.08;
const STEP_RATIO0 = 0.25;
const STEP_RATIO1 = 0.6;
const MAX_TILT = 0.35;

/**
 * Riser envelopes — a support under a point p that is a CONTINUOUS function of p although the
 * ground itself pops by a riser at a nosing. Along rays from p, a step is a level change
 * ≥ STEP_MIN between two consecutive samples (a slope never is; slab rims of the paving, ≤ 5 cm,
 * never are — so off the stairs every envelope is the exact ground); its distance d from p is
 * bisected to a fraction of a mm. Two kinds:
 *   LIFT toward a HIGHER level nearby: support = ground(p) + max over rays / steps of (rise − λ·d)⁺
 *        — the support climbs at slope λ toward the edge and meets the upper level exactly AT
 *        the edge, where ground(p) takes over, so it never dips below the ground under p;
 *   SINK toward a LOWER level nearby: support = ground(p) − max over rays / steps of (drop − λ·d)⁺
 *        — mirror image: past a rising edge the support climbs from the lower level at slope λ.
 * Both are continuous through the crossing for ANY λ (λ may vary from frame to frame without a
 * pop) and rays live in the facing frame, so they are continuous in position and in yaw.
 *   PLANT (a foot in stance) = the highest SINK under the sole's heel, ball and toe, isotropic,
 *         λ PLANT_LAMBDA: the foot rests on the highest ground under its footprint, and where that
 *         would jump — the toe crossing a nosing going up, the heel leaving one going down — the
 *         sole ramps over 4.5 cm AFTER the toe crosses / BEFORE the heel leaves, so the leading
 *         or trailing 4.5 cm of the boot dip into the riser instead of the whole foot hovering
 *         over the lower tread. The ball itself is never below its ground (the toe and heel are
 *         farther out than the ramp). A stance slide can never pop it.
 *   CLEAR (a swing foot) = the highest LIFT under its ball and toe: λ 1.2 ahead (the foot starts
 *         rising 22 cm before a nosing), 2 behind (it comes down over 13 cm after stepping off a
 *         tread), 2.5 sideways. Rearward edges farther than the foot's TRAVEL since toe-off keep
 *         PLANT's slope (TRAVEL_BAND blends): the foot comes down off the tread it just left, not
 *         off an edge it stood next to. It blends in from and back out to the PLANT support over
 *         CLEAR_OPEN / CLEAR_CLOSE so toe-off and heel-strike read exactly the stance rule.
 */
const STEP_MIN = 0.06;
/** tallest level difference an envelope cares about (two risers); bounds each ray's reach */
const ENVELOPE_RISE_MAX = 0.6;
const BISECT_ITER = 7;
const PLANT_LAMBDA = 6;
const ENVELOPE_RAYS = 8;
const TRAVEL_BAND = 0.03;
/** ray directions in the facing frame: [forward, sideways] components */
const RAY_DIRS: [number, number][] = [];
/** the CLEAR slopes per ray: for edges nearer than the foot's travel, and beyond it (rearward rays fall back to PLANT's) */
const CLEAR_NEAR = new Float64Array(ENVELOPE_RAYS);
const CLEAR_FAR = new Float64Array(ENVELOPE_RAYS);
for (let k = 0; k < ENVELOPE_RAYS; k++) {
  const a = (k / ENVELOPE_RAYS) * Math.PI * 2;
  const f = Math.cos(a);
  RAY_DIRS.push([f, Math.sin(a)]);
  CLEAR_NEAR[k] = f >= 0 ? MathUtils.lerp(2.5, 1.2, f) : MathUtils.lerp(2.5, 2, -f);
  CLEAR_FAR[k] = f < -1e-6 ? PLANT_LAMBDA : CLEAR_NEAR[k];
}
const PLANT_STEP = 0.025;
const CLEAR_STEP = 0.06;

interface Leg {
  side: 'L' | 'R';
  thigh: Object3D;
  knee: Object3D;
  ankle: Object3D;
  thighPivot: Object3D;
  kneePivot: Object3D;
  anklePivot: Object3D;
  sole: Vector3;
  // per-frame scratch (world space)
  hip: Vector3;
  kneeP: Vector3;
  ankleP: Vector3;
  soleP: Vector3;
  qThigh: Quaternion;
  qKnee: Quaternion;
  qAnkle: Quaternion;
  qTilt: Quaternion;
  target: Vector3;
  tiltAngle: number;
  active: boolean;
  /** 1 = in contact, 0 = swinging */
  contact: number;
  /** exact ground under the ball, the stance support of the footprint, the support the foot is corrected onto, its root support */
  gExact: number;
  gPlant: number;
  g: number;
  gRoot: number;
  delta: number;
  /** the footprint point (offset along the facing) the report treats as the contact, and the exact ground there */
  contactOff: number;
  contactGround: number;
}

/** one swing of one foot in a clip: clip times and root-relative sole spots at toe-off and heel-strike */
interface Swing {
  tOff: number;
  tLand: number;
  offX: number;
  offZ: number;
  landX: number;
  landZ: number;
}

/** root-space sole path of one foot over one clip cycle (TABLE_N samples) */
interface FootPath {
  soleX: Float64Array;
  soleY: Float64Array;
  soleZ: Float64Array;
}

/** per clip, per foot: the swings (cyclic clip times; tLand may exceed the duration) */
type SwingTable = Record<Gait, [Swing[], Swing[]]>;

export interface LinkClipInfo {
  name: string;
  durationS: number;
  strideM: number;
  rate: number;
}

export interface LinkAssetInfo {
  file: string;
  sha256: string;
  triangles: number;
  materials: number;
  bones: number;
  clips: LinkClipInfo[];
  loadMs: number;
}

export interface GlbLink extends Puppet {
  kind: 'glb';
  asset: LinkAssetInfo;
}

/** playback rate that makes the clip's stride cover GAIT_SPEED on the ground */
export function clipRate(gait: Gait, durationS: number): number {
  const spec = CLIP_SPEC[gait];
  if (spec.strideM <= 0 || GAIT_SPEED[gait] <= 0) return 1;
  const cycle = durationS > 0 ? durationS : spec.cycleS;
  return Math.round((GAIT_SPEED[gait] / (spec.strideM / cycle)) * 1e6) / 1e6;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

const _target = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _axisY = new Vector3(0, 1, 0);
const _axisX = new Vector3(1, 0, 0);
const _u = new Vector3();
const _v = new Vector3();
const _n = new Vector3();
const _w = new Vector3();
const _aim = new Vector3();
const _normal = new Vector3();
const _qIk = new Quaternion();
const _qParent = new Quaternion();
const _qInv = new Quaternion();

/**
 * A riser envelope at world (x, z) for the unit facing (fx, fz) — see the ENVELOPE comment.
 * `sign` +1 lifts toward higher levels (LIFT), −1 sinks toward lower ones (SINK). Rays are
 * sampled every `step`; per ray the slope is `lamNear[k]` for edges nearer than `travel` and
 * `lamFar[k]` beyond travel + TRAVEL_BAND (blended in between).
 */
function envelope(ground: GroundSampler, x: number, z: number, fx: number, fz: number, sign: 1 | -1, step: number, lamNear: Float64Array, lamFar: Float64Array, travel: number): number {
  const g0 = ground(x, z);
  let best = 0;
  for (let k = 0; k < ENVELOPE_RAYS; k++) {
    const dx = fx * RAY_DIRS[k][0] + fz * RAY_DIRS[k][1];
    const dz = fz * RAY_DIRS[k][0] - fx * RAY_DIRS[k][1];
    const lamMin = Math.min(lamNear[k], lamFar[k]);
    const n = Math.ceil(ENVELOPE_RISE_MAX / lamMin / step - 1e-9);
    let prev = g0;
    for (let j = 1; j <= n; j++) {
      let d = j * step;
      const g = ground(x + dx * d, z + dz * d);
      const change = sign * (g - g0);
      if (change - lamMin * (d - step) <= best) {
        // even at the near end of this interval the step could not beat the best term so far
        prev = g;
        continue;
      }
      if (sign * (g - prev) >= STEP_MIN) {
        // a step edge between the two samples: bisect for the crossing of the mid level
        const mid = (prev + g) / 2;
        let lo = d - step;
        let hi = d;
        for (let it = 0; it < BISECT_ITER; it++) {
          const m = (lo + hi) / 2;
          if (sign * (ground(x + dx * m, z + dz * m) - mid) >= 0) hi = m;
          else lo = m;
        }
        d = (lo + hi) / 2;
      }
      const lam = lamNear[k] === lamFar[k] ? lamNear[k] : MathUtils.lerp(lamNear[k], lamFar[k], MathUtils.smoothstep(d - travel, 0, TRAVEL_BAND));
      const term = change - lam * d;
      if (term > best) best = term;
      prev = g;
    }
  }
  return g0 + sign * best;
}

const PLANT_LAMBDAS = new Float64Array(ENVELOPE_RAYS).fill(PLANT_LAMBDA);
const SWING_LAMBDAS = new Float64Array(ENVELOPE_RAYS).fill(SWING_LAMBDA);
/** the highest SINK envelope at slope `lam` under the heel, ball and toe of a sole whose ball is at (x, z) */
function sinkFootprint(ground: GroundSampler, x: number, z: number, fx: number, fz: number, lam: Float64Array): number {
  let g = -Infinity;
  for (const o of FOOT_POINTS) {
    const v = envelope(ground, x + fx * o, z + fz * o, fx, fz, -1, PLANT_STEP, lam, lam, 0);
    if (v > g) g = v;
  }
  return g;
}
/** the stance support of a sole whose ball is at (x, z) */
function plantSupport(ground: GroundSampler, x: number, z: number, fx: number, fz: number): number {
  return sinkFootprint(ground, x, z, fx, fz, PLANT_LAMBDAS);
}
/** the fully open CLEAR support of a swing sole whose ball is at (x, z): the highest LIFT envelope under its ball and toe; `travel` is the ball's distance from its take-off spot */
function clearSupport(ground: GroundSampler, x: number, z: number, fx: number, fz: number, travel: number): number {
  const a = envelope(ground, x, z, fx, fz, 1, CLEAR_STEP, CLEAR_NEAR, CLEAR_FAR, travel);
  const b = envelope(ground, x + fx * TOE_AHEAD, z + fz * TOE_AHEAD, fx, fz, 1, CLEAR_STEP, CLEAR_NEAR, CLEAR_FAR, travel);
  return Math.max(a, b);
}

/**
 * Cut one foot's sampled clip path into swings: the foot is in stance while its sole is within
 * STANCE_LIFT of the cycle's lowest sole height; a swing runs from the last stance sample
 * (toe-off) to the first stance sample after it (heel-strike), across the loop seam if need be.
 */
function tableSwings(path: FootPath, duration: number): Swing[] {
  const n = path.soleY.length;
  let floor = Infinity;
  for (let i = 0; i < n; i++) if (path.soleY[i] < floor) floor = path.soleY[i];
  const up = (i: number) => path.soleY[mod(i, n)] - floor > STANCE_LIFT;
  const swings: Swing[] = [];
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (!up(i)) {
      start = i;
      break;
    }
  }
  if (start < 0) return swings;
  for (let k = 0; k < n; ) {
    const i = start + k;
    if (!up(i)) {
      k++;
      continue;
    }
    let len = 0;
    while (len < n && up(i + len)) len++;
    const off = mod(i - 1, n);
    const land = mod(i + len, n);
    const tOff = mod(((i - 1) / n) * duration, duration);
    const tLand = tOff + ((len + 1) / n) * duration;
    // a lift shorter than MIN_SWING_S is the stance sole bobbing, not a swing
    if (tLand - tOff >= MIN_SWING_S) swings.push({ tOff, tLand, offX: path.soleX[off], offZ: path.soleZ[off], landX: path.soleX[land], landZ: path.soleZ[land] });
    k += len;
  }
  return swings;
}

/** the swing of `foot` containing clip time τ, and the phase 0..1 through it (null in stance) */
function swingAt(swings: Swing[], tau: number, duration: number): { swing: Swing; phase: number } | null {
  for (const s of swings) {
    const dt = mod(tau - s.tOff, duration);
    const len = s.tLand - s.tOff;
    if (dt < len) return { swing: s, phase: dt / len };
  }
  return null;
}

/**
 * Rotation from world up to the ground normal at (x, z), for a sole in contact: central
 * differences over the two baselines (see the constants), faded in from TILT_GRAD0, cut where the
 * two disagree (a step edge, not a slope) and clamped to MAX_TILT. Writes `out`; returns the angle.
 */
function groundTilt(ground: GroundSampler, x: number, z: number, weight: number, out: Quaternion): number {
  if (weight <= 1e-4) {
    out.identity();
    return 0;
  }
  const gx = (ground(x + NORMAL_FAR, z) - ground(x - NORMAL_FAR, z)) / (2 * NORMAL_FAR);
  const gz = (ground(x, z + NORMAL_FAR) - ground(x, z - NORMAL_FAR)) / (2 * NORMAL_FAR);
  const nx = (ground(x + NORMAL_NEAR, z) - ground(x - NORMAL_NEAR, z)) / (2 * NORMAL_NEAR);
  const nz = (ground(x, z + NORMAL_NEAR) - ground(x, z - NORMAL_NEAR)) / (2 * NORMAL_NEAR);
  const grad = Math.hypot(gx, gz);
  const ratio = Math.hypot(gx - nx, gz - nz) / Math.max(grad, Math.hypot(nx, nz), 1e-6);
  const w = weight * MathUtils.smoothstep(grad, TILT_GRAD0, TILT_GRAD1) * (1 - MathUtils.smoothstep(ratio, STEP_RATIO0, STEP_RATIO1));
  if (w <= 1e-4 || grad <= 1e-9) {
    out.identity();
    return 0;
  }
  _normal.set(-gx, 1, -gz).normalize();
  // shortest arc from up to the normal, scaled to the weighted, clamped angle
  _n.crossVectors(_axisY, _normal);
  const sinA = _n.length();
  if (sinA <= 1e-9) {
    out.identity();
    return 0;
  }
  _n.divideScalar(sinA);
  const angle = Math.min(MAX_TILT, Math.atan2(sinA, _axisY.dot(_normal))) * w;
  out.setFromAxisAngle(_n, angle);
  return angle;
}

/**
 * Two-bone IK on one leg: bend the knee about its bend plane, then swing the thigh so the ankle
 * lands on `target` (world). Writes the thigh / knee pivots; `qIk` receives the net world
 * rotation the shin received. Returns true when the target had to be clamped to the leg's reach.
 */
function solveLeg(leg: Leg, target: Vector3, qIk: Quaternion): boolean {
  const H = leg.hip;
  const K = leg.kneeP;
  const A = leg.ankleP;
  _u.subVectors(K, H);
  _v.subVectors(A, K);
  const l1 = _u.length();
  const l2 = _v.length();
  // bend axis: the knee's own plane when the leg is visibly bent the right way, else the thigh's
  // sideways axis (the anatomical hinge; both legs bend about +X of the thigh frame)
  _w.set(1, 0, 0).applyQuaternion(leg.qThigh);
  _n.crossVectors(_u, _v);
  const planeLen = _n.length();
  if (planeLen > 0.087 * l1 * l2 && _n.dot(_w) > 0) _n.divideScalar(planeLen);
  else _n.copy(_w).normalize();
  const bend = Math.atan2(_w.crossVectors(_u, _v).dot(_n), _u.dot(_v));
  let d = _aim.subVectors(target, H).length();
  const dMax = (l1 + l2) * MAX_REACH;
  const dMin = Math.abs(l1 - l2) * MIN_REACH;
  let clamped = false;
  if (d > dMax) {
    d = dMax;
    clamped = true;
  } else if (d < dMin) {
    d = dMin;
    clamped = true;
  }
  const cosBend = MathUtils.clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const bendTarget = Math.acos(cosBend);
  _q.setFromAxisAngle(_n, bendTarget - bend);
  // ankle after the knee bend, then the thigh swing that aims it at the target
  _v.applyQuaternion(_q).add(_u); // hip → new ankle
  _aim.normalize();
  _v.normalize();
  _q2.setFromUnitVectors(_v, _aim);
  qIk.multiplyQuaternions(_q2, _q);
  // pivot locals: a world rotation R about a joint expressed in the joint's parent frame P is P⁻¹ R P
  leg.thighPivot.parent!.getWorldQuaternion(_qParent);
  _qInv.copy(_qParent).invert();
  leg.thighPivot.quaternion.copy(_qInv).multiply(_q2).multiply(_qParent);
  _qInv.copy(leg.qThigh).invert();
  leg.kneePivot.quaternion.copy(_qInv).multiply(_q).multiply(leg.qThigh);
  return clamped;
}

/**
 * Insert a rotation pivot between `bone` and its parent that turns about the bone's rest origin:
 * parent → pivot (at the rest translation, carries the look rotation) → inner (−rest translation)
 * → bone (its own clip-driven translation / rotation, untouched, so the mixer keeps binding it).
 */
function insertPivot(bone: Object3D, name: string): Object3D {
  const parent = bone.parent;
  if (!parent) throw new Error(`bone ${bone.name} has no parent`);
  const pivot = new Object3D();
  pivot.name = name;
  pivot.position.copy(bone.position);
  const inner = new Object3D();
  inner.name = `${name}-inner`;
  inner.position.copy(bone.position).negate();
  parent.remove(bone);
  parent.add(pivot);
  pivot.add(inner);
  inner.add(bone);
  return pivot;
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const ev = e as { message?: string; type?: string; target?: { status?: number; responseURL?: string } };
    if (ev.message) return ev.message;
    if (ev.type) return `${ev.type}${ev.target?.status ? ` ${ev.target.status}` : ''}`;
  }
  return String(e);
}

/**
 * Load and validate the GLB. Rejects (with a plain-text reason) on 404, parse errors, missing
 * bones or missing clips — the caller falls back to the procedural Link.
 */
export async function loadGlbLink(url: string): Promise<GlbLink> {
  const t0 = performance.now();
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch (e) {
    throw new Error(`load failed: ${describe(e)}`);
  }
  const model = gltf.scene;

  const skinned: SkinnedMesh[] = [];
  const materials = new Set<Material>();
  const bones: Bone[] = [];
  model.traverse((o: Object3D) => {
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
    if ((o as Bone).isBone) bones.push(o as Bone);
  });
  if (!skinned.length) throw new Error('no skinned meshes in the GLB');
  let triangles = 0;
  const bounds = new Box3();
  for (const m of skinned) {
    m.castShadow = true;
    m.receiveShadow = true;
    const g = m.geometry;
    triangles += Math.floor((g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat) materials.add(mat);
    g.computeBoundingBox();
    if (g.boundingBox) bounds.union(g.boundingBox);
  }

  const bone = (name: string): Object3D => {
    const b = model.getObjectByName(name);
    if (!b) throw new Error(`bone "${name}" missing`);
    return b;
  };
  const missing = REQUIRED_BONES.filter((n) => !model.getObjectByName(n));
  if (missing.length) throw new Error(`bones missing: ${missing.join(', ')}`);
  const neck = bone('neck');
  const head = bone('head');

  const clips = GAITS.map((g) => ({ gait: g, clip: gltf.animations.find((c) => c.name === g) ?? null }));
  const noClip = clips.filter((c) => !c.clip).map((c) => c.gait);
  if (noClip.length) throw new Error(`clips missing: ${noClip.join(', ')} (have ${gltf.animations.map((a) => a.name).join(', ') || 'none'})`);

  // rest-pose measurements before anything animates: skull top above the head bone (skin mesh only,
  // no hair / cap) for the audit's head projection, and the total height with the cap
  model.updateMatrixWorld(true);
  const skin = skinned.find((m) => /skin/i.test(m.name)) ?? skinned[0];
  skin.geometry.computeBoundingBox();
  const headRest = head.getWorldPosition(new Vector3());
  const headTopOffset = (skin.geometry.boundingBox?.max.y ?? headRest.y + 0.28) - headRest.y;
  const height = bounds.max.y - Math.min(0, bounds.min.y);

  // look and leg pivots (see the header) — inserted before the actions bind so the search stays valid
  const neckPivot = insertPivot(neck, 'neck-look');
  const headPivot = insertPivot(head, 'head-look');
  const makeLeg = (side: 'L' | 'R'): Leg => {
    const thigh = bone(`thigh${side}`);
    const knee = bone(`knee${side}`);
    const ankle = bone(`ankle${side}`);
    return {
      side,
      thigh,
      knee,
      ankle,
      thighPivot: insertPivot(thigh, `thigh${side}-ik`),
      kneePivot: insertPivot(knee, `knee${side}-ik`),
      anklePivot: insertPivot(ankle, `ankle${side}-ik`),
      sole: side === 'L' ? SOLE_L : SOLE_R,
      hip: new Vector3(),
      kneeP: new Vector3(),
      ankleP: new Vector3(),
      soleP: new Vector3(),
      qThigh: new Quaternion(),
      qKnee: new Quaternion(),
      qAnkle: new Quaternion(),
      qTilt: new Quaternion(),
      target: new Vector3(),
      tiltAngle: 0,
      active: false,
      contact: 1,
      gExact: 0,
      gPlant: 0,
      g: 0,
      gRoot: 0,
      delta: 0,
      contactOff: 0,
      contactGround: 0,
    };
  };
  const legs: [Leg, Leg] = [makeLeg('L'), makeLeg('R')];
  const feet: FootContact[] = [
    { foot: 'L', soleY: 0, groundY: 0, gapM: 0, supportY: 0 },
    { foot: 'R', soleY: 0, groundY: 0, gapM: 0, supportY: 0 },
  ];
  const plant: PlantInfo = { mode: 'two-bone', maxCorrectionM: 0, rootShiftM: 0, planted: 'L', reachClamped: false };

  const root = new Group();
  root.name = 'link';
  root.userData.character = 'link';
  root.add(model);

  const mixer = new AnimationMixer(model);
  const actions = new Map<Gait, { action: AnimationAction; duration: number; rate: number; offset: number }>();
  for (const { gait, clip } of clips) {
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.weight = gait === 'idle' ? 1 : 0;
    action.play();
    const duration = clip.duration;
    const rate = clipRate(gait, duration);
    // clip time at the hero t lands on the hero pose: (HERO_T · rate + offset) mod duration = heroClipTime
    const offset = mod(CLIP_SPEC[gait].heroClipTime - mod(HERO_T * rate, duration), duration);
    actions.set(gait, { action, duration, rate, offset });
  }

  // swing tables: each clip's sole paths in root space, cut into swings (toe-off → heel-strike).
  // Sampled once here through the same mixer, so the runtime never guesses a stance.
  const tables = {} as SwingTable;
  {
    const _p = new Vector3();
    for (const [gait, a] of actions) {
      for (const b of actions.values()) b.action.weight = b === a ? 1 : 0;
      const paths: FootPath[] = legs.map(() => ({ soleX: new Float64Array(TABLE_N), soleY: new Float64Array(TABLE_N), soleZ: new Float64Array(TABLE_N) }));
      for (let i = 0; i < TABLE_N; i++) {
        a.action.time = (i / TABLE_N) * a.duration;
        mixer.update(0);
        model.updateMatrixWorld(true);
        for (let f = 0; f < 2; f++) {
          _p.copy(legs[f].sole).applyMatrix4(legs[f].ankle.matrixWorld);
          paths[f].soleX[i] = _p.x;
          paths[f].soleY[i] = _p.y;
          paths[f].soleZ[i] = _p.z;
        }
      }
      tables[gait] = [tableSwings(paths[0], a.duration), tableSwings(paths[1], a.duration)];
    }
    for (const [gait, a] of actions) {
      a.action.weight = gait === 'idle' ? 1 : 0;
      a.action.time = 0;
    }
    mixer.update(0);
  }

  const asset: LinkAssetInfo = {
    file: LINK_GLB_FILE,
    sha256: LINK_GLB_SHA256,
    triangles,
    materials: materials.size,
    bones: bones.length,
    clips: GAITS.map((g) => {
      const a = actions.get(g)!;
      return { name: g, durationS: Number(a.duration.toFixed(6)), strideM: CLIP_SPEC[g].strideM, rate: a.rate };
    }),
    loadMs: Math.round(performance.now() - t0),
  };

  const clipTimeOf = (gait: Gait, t: number) => {
    const a = actions.get(gait)!;
    return mod(t * a.rate + a.offset, a.duration);
  };

  /** 1 = fully in `p.gait`; a smoothstep from the previous gait over BLEND_S after a switch */
  const blendWeight = (p: PuppetPose) => {
    if (p.gaitFrom === p.gait || !actions.has(p.gaitFrom)) return 1;
    const dt = p.t - p.gaitSwitchT;
    if (!(dt >= 0 && dt < BLEND_S)) return 1;
    return MathUtils.smoothstep(dt / BLEND_S, 0, 1);
  };

  /**
   * Turn the neck (35 %) and head (65 %) pivots toward a world point, clamped, scaled by `weight`.
   * Angles are measured once in the neck pivot's frame (the chest frame at the neck's rest origin:
   * +Z forward, +Y up at rest) and split; for these small angles the two rotations add up.
   */
  const lookAt = (target: Vector3, weight: number) => {
    root.updateMatrixWorld(true);
    _target.copy(target);
    neckPivot.worldToLocal(_target);
    const yaw = MathUtils.clamp(Math.atan2(_target.x, _target.z), -0.8, 0.8) * weight;
    const pitch = MathUtils.clamp(Math.atan2(_target.y, Math.hypot(_target.x, _target.z)), -0.4, 0.45) * weight;
    const apply = (pivot: Object3D, k: number) => {
      pivot.quaternion.setFromAxisAngle(_axisY, yaw * k);
      _q.setFromAxisAngle(_axisX, -pitch * k);
      pivot.quaternion.multiply(_q);
    };
    apply(neckPivot, 0.35);
    apply(headPivot, 0.65);
  };

  const puppet: GlbLink = {
    kind: 'glb',
    group: root,
    triangles,
    height: Number(height.toFixed(4)),
    animations: GAITS.filter((g) => actions.has(g)),
    asset,
    pose(x, z, yaw, p, ground: GroundSampler, contact) {
      const placed = ground(x, z);
      root.position.set(x, placed, z);
      root.rotation.y = yaw;
      const w = blendWeight(p);
      for (const [gait, a] of actions) {
        let weight = 0;
        if (gait === p.gait) weight += w;
        if (gait === p.gaitFrom && w < 1) weight += 1 - w;
        a.action.weight = weight;
        a.action.time = clipTimeOf(gait, p.t);
      }
      mixer.update(0);
      neckPivot.quaternion.identity();
      headPivot.quaternion.identity();
      for (const leg of legs) {
        leg.thighPivot.quaternion.identity();
        leg.kneePivot.quaternion.identity();
        leg.anklePivot.quaternion.identity();
      }
      if (p.look && p.lookWeight > 0) lookAt(p.look, p.lookWeight);
      root.updateMatrixWorld(true);

      // 1. the posed legs: joints and soles (world) with the root at the placement height
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      for (const leg of legs) {
        leg.thigh.getWorldPosition(leg.hip);
        leg.knee.getWorldPosition(leg.kneeP);
        leg.ankle.getWorldPosition(leg.ankleP);
        leg.soleP.copy(leg.sole).applyMatrix4(leg.ankle.matrixWorld);
        leg.thigh.getWorldQuaternion(leg.qThigh);
        leg.knee.getWorldQuaternion(leg.qKnee);
        leg.ankle.getWorldQuaternion(leg.qAnkle);
        leg.gExact = ground(leg.soleP.x, leg.soleP.z);
        leg.gPlant = plantSupport(ground, leg.soleP.x, leg.soleP.z, fx, fz);
      }
      // the planted foot is the lower sole (on flat ground the round-3 rule: its clip lift is what
      // the root drop removes); the other foot is in contact or swinging by its lift
      const planted = legs[0].soleP.y <= legs[1].soleP.y ? legs[0] : legs[1];
      const swing = planted === legs[0] ? legs[1] : legs[0];
      const swingIndex = swing === legs[0] ? 0 : 1;
      planted.contact = 1;
      planted.g = planted.gPlant;
      planted.gRoot = planted.gPlant;
      swing.contact = 1 - MathUtils.smoothstep(swing.soleP.y - planted.soleP.y, CONTACT_LIFT0, CONTACT_LIFT1);
      {
        // 2. the other foot, per active clip: in the clip's stance (double support) it reads the
        // PLANT support under its sole like the planted foot; in a swing the take-off / landing
        // spots are the root-relative table spots carried along the facing at the gait's ground
        // speed (the in-place clips' stance paths cancel exactly that speed), and the foot's
        // support eases from the one's PLANT support to the other's — the same values the stance
        // rule reads at either end, so toe-off and heel-strike are seamless — while the root's
        // eases from the double-support level at toe-off to the one at heel-strike. The CLEAR
        // support under the sole then holds the foot up over a nosing (never below the ground
        // under its ball); it blends in from the stance support after toe-off and back out
        // before heel-strike (CLEAR_OPEN / CLEAR_CLOSE).
        let predFoot = 0;
        let predRoot = 0;
        let clearW = 0;
        let travel = 0;
        let wsum = 0;
        for (const [gait, a] of actions) {
          const weight = a.action.weight;
          if (weight <= 0) continue;
          const sw = swingAt(tables[gait][swingIndex], a.action.time, a.duration);
          let foot = swing.gPlant;
          let rootv = Math.min(swing.gPlant, planted.gPlant);
          let cw = 0;
          let tr = 0;
          if (sw) {
            const s = sw.swing;
            const len = (s.tLand - s.tOff) / a.rate;
            const back = GAIT_SPEED[gait] * sw.phase * len;
            const ahead = GAIT_SPEED[gait] * (1 - sw.phase) * len;
            const offX = x + s.offX * fz + s.offZ * fx - fx * back;
            const offZ = z - s.offX * fx + s.offZ * fz - fz * back;
            const gOff = plantSupport(ground, offX, offZ, fx, fz);
            const gLand = plantSupport(ground, x + s.landX * fz + s.landZ * fx + fx * ahead, z - s.landX * fx + s.landZ * fz + fz * ahead, fx, fz);
            foot = gOff + (gLand - gOff) * (gLand >= gOff ? MathUtils.smoothstep(sw.phase, 0, RISE_END) : MathUtils.smoothstep(sw.phase, DESC0, DESC1));
            const r0 = Math.min(gOff, planted.gPlant);
            rootv = r0 + (Math.min(gLand, planted.gPlant) - r0) * MathUtils.smoothstep(sw.phase, 0, 1);
            cw = MathUtils.smoothstep(sw.phase, 0, CLEAR_OPEN) * (1 - MathUtils.smoothstep(sw.phase, CLEAR_CLOSE0, CLEAR_CLOSE1));
            tr = Math.hypot(swing.soleP.x - offX, swing.soleP.z - offZ);
          }
          predFoot += weight * foot;
          predRoot += weight * rootv;
          clearW += weight * cw;
          travel += weight * tr;
          wsum += weight;
        }
        if (wsum > 0) {
          predFoot /= wsum;
          predRoot /= wsum;
          clearW /= wsum;
          travel /= wsum;
        } else {
          predFoot = swing.gPlant;
          predRoot = Math.min(swing.gPlant, planted.gPlant);
        }
        let clear = sinkFootprint(ground, swing.soleP.x, swing.soleP.z, fx, fz, SWING_LAMBDAS);
        if (clearW > 1e-4) clear += (clearSupport(ground, swing.soleP.x, swing.soleP.z, fx, fz, travel) - clear) * clearW;
        swing.g = Math.max(predFoot, clear);
        swing.gRoot = predRoot;
      }

      // 3. root: the planted sole onto the lower of the two root supports (a leg is only ever bent)
      const gMin = Math.min(planted.gRoot, swing.gRoot);
      const shift = gMin - planted.soleP.y;
      root.position.y += shift;
      for (const leg of legs) {
        leg.hip.y += shift;
        leg.kneeP.y += shift;
        leg.ankleP.y += shift;
        leg.soleP.y += shift;
      }

      // 4. per-foot targets: raise the sole by its support's excess over the root support (its xz
      // stays where the clip put it), keep the clip's foot orientation, tilt a contact sole onto
      // the local slope; the ankle target follows from the re-oriented foot
      let maxCorrection = 0;
      let extraDrop = 0;
      for (const leg of legs) {
        leg.delta = Math.min(MAX_CORRECTION, Math.max(0, leg.g - gMin));
        leg.tiltAngle = groundTilt(ground, leg.soleP.x, leg.soleP.z, leg.contact, leg.qTilt);
        leg.active = leg.delta > 1e-6 || leg.tiltAngle > 1e-5;
        if (!leg.active) {
          leg.target.copy(leg.ankleP);
          continue;
        }
        _q.multiplyQuaternions(leg.qTilt, leg.qAnkle);
        leg.target.copy(leg.sole).applyQuaternion(_q);
        leg.target.set(leg.soleP.x - leg.target.x, leg.soleP.y + leg.delta - leg.target.y, leg.soleP.z - leg.target.z);
        // a target beyond the straight leg (a tilted foot moves the ankle sideways): the root
        // comes down by the shortfall instead of the leg stretching
        _v.subVectors(leg.target, leg.hip);
        const reach = (leg.kneeP.distanceTo(leg.hip) + leg.ankleP.distanceTo(leg.kneeP)) * MAX_REACH;
        const flat2 = reach * reach - _v.x * _v.x - _v.z * _v.z;
        if (flat2 > 0) {
          const drop = -_v.y - Math.sqrt(flat2);
          if (drop > extraDrop) extraDrop = drop;
        }
      }
      if (extraDrop > 0) {
        extraDrop = Math.min(extraDrop, MAX_CORRECTION);
        root.position.y -= extraDrop;
        for (const leg of legs) {
          leg.hip.y -= extraDrop;
          leg.kneeP.y -= extraDrop;
          leg.ankleP.y -= extraDrop;
          leg.soleP.y -= extraDrop;
          leg.active = true;
        }
      }

      // 5. solve: knee bend + thigh swing onto the ankle target, then the ankle pivot undoes the
      // shin's IK rotation on the foot and adds the slope tilt (both in the knee frame)
      let reachClamped = false;
      for (const leg of legs) {
        if (!leg.active) continue;
        if (solveLeg(leg, leg.target, _qIk)) reachClamped = true;
        _qInv.copy(_qIk).invert();
        _q2.copy(leg.qKnee).invert().multiply(_qInv).multiply(leg.qTilt).multiply(leg.qKnee);
        leg.anklePivot.quaternion.copy(_q2);
        const raised = leg.delta + extraDrop;
        if (raised > maxCorrection) maxCorrection = raised;
      }
      root.updateMatrixWorld(true);

      // 6. report: both soles as posed against the exact ground under their contact point — the
      // ball, or when that is off its ground by more than CONTACT_OFF (a toe on a tread edge, a
      // heel over the one below) the footprint point nearest its ground — and their supports.
      // The contact point handed out is the sole nearest its ground (the procedural plantFeet's
      // rule, so samplePositions.feet reads the same foot; ties go to the foot the root stands on)
      for (let i = 0; i < 2; i++) {
        const leg = legs[i];
        leg.soleP.copy(leg.sole).applyMatrix4(leg.ankle.matrixWorld);
        leg.contactOff = 0;
        leg.contactGround = ground(leg.soleP.x, leg.soleP.z);
        if (Math.abs(leg.soleP.y - leg.contactGround) > CONTACT_OFF) {
          for (const o of FOOT_POINTS) {
            if (o === 0) continue;
            const gp = ground(leg.soleP.x + fx * o, leg.soleP.z + fz * o);
            if (Math.abs(leg.soleP.y - gp) < Math.abs(leg.soleP.y - leg.contactGround)) {
              leg.contactGround = gp;
              leg.contactOff = o;
            }
          }
        }
        feet[i].soleY = leg.soleP.y;
        feet[i].groundY = leg.contactGround;
        feet[i].gapM = leg.soleP.y - leg.contactGround;
        feet[i].supportY = leg.g;
      }
      const reported = Math.abs(feet[swingIndex].gapM) < Math.abs(feet[1 - swingIndex].gapM) - REPORT_TIE ? swing : planted;
      plant.maxCorrectionM = maxCorrection;
      plant.rootShiftM = root.position.y - placed;
      plant.planted = reported.side;
      plant.reachClamped = reachClamped;
      contact.set(reported.soleP.x + fx * reported.contactOff, reported.soleP.y, reported.soleP.z + fz * reported.contactOff);
    },
    headTop(out) {
      return head.localToWorld(out.set(0, headTopOffset, 0));
    },
    feetContact: () => feet.map((f) => ({ ...f })),
    plantInfo: () => ({ ...plant }),
  };
  return puppet;
}
