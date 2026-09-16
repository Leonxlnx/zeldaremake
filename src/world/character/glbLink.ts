/**
 * Skinned GLB Link — Astra's textured, rigged runtime candidate (public/models/link/link-runtime.glb,
 * provenance in SOURCE.md next to it) behind the procedural fallback. The character ART is hers;
 * this file is the runtime: load, validate (bones / clips), pose deterministically, plant, look.
 *
 * Determinism (W41): the pose is a pure function of the simulation time `t`. Every clip action is
 * kept active and its `time` is SET each frame (clip time = (t · rate + heroOffset + clipShift)
 * mod duration), then `mixer.update(0)` evaluates the blend — no wall-clock dt accumulation, so
 * `setTime()` jumps and the determinism re-capture reproduce the frame byte for byte. Gait
 * crossfades (play mode) are weights computed from `t − gaitSwitchT`, hard when that is −Infinity
 * (captures). `clipShift` (round 5) is chosen at a play-mode switch by `alignClip` so the incoming
 * clip starts at the gait phase the outgoing one had — the same foot in the same part of its
 * swing / stance — and the crossfade blends like with like (a walk mid-swing blended with a run
 * at the opposite foot's swing lifted BOTH soles and bumped the root 3 cm in a frame); it is 0 for
 * the captures, whose hero offsets are untouched. The blend is a chain of up to three clips
 * (round 6, `blendChain`): a switch during a running crossfade keeps the fading clip fading
 * instead of cutting its remaining weight in one frame.
 *
 * Round 6 — the two residuals of round 5's review:
 *   - the start transient at the foot of the flight: the idle → walk fade began 15 cm before the
 *     first riser and the walk → stairs switch landed 4 frames into it; the idle clip's feet slid
 *     with the body (an idle stance has no table spot to freeze) over the first nosing and the
 *     cut fade snapped the pose — root steps of +103 / −83 mm. Now a clip without swings (idle)
 *     that is fading out stands where it stood when it stopped driving: its stance spots are the
 *     soles of the last pose it drove (`anchor`, recorded by the character system at the switch
 *     like `clipShift` — the pose stays a function of `t` and the switch record), planted there
 *     and PINNED there through the along-facing shift, weighted by its blend weight (`pinM`), so
 *     the trailing foot of a first step stays on the ground it stood on while the body walks off
 *     — and its support, hence the root, no longer pops when the visual sole crosses a riser.
 *     The pin never holds a foot past the straight leg (it is shortened to the reach sphere in
 *     closed form; the foot slides that little instead), so it never costs an extra root drop;
 *   - the toe-off residual: a swing arc flattened toward its support by FOLD_MAX (a toe-off from
 *     a tread the root has already descended from, a foot held over a lip) put the sole MARKER on
 *     the support while the clip's own foot orientation (toe-down at toe-off) had the sole's front
 *     5–10 mm lower, inside the stone (−6.4 mm at frame 335 of the descent). The flattening floor
 *     is now `support + hold`, `hold` being how far the lowest footprint point lies below the
 *     marker plane in the clip's own orientation (the planned nosing pitch, whose toe hangs in the
 *     air past the edge by design, is excluded) — on flat ground FOLD_MAX never binds, so the pose
 *     there is round 5's exactly (`holdM`). A STANCE foot's PLANT rule (`footConfig`) now also
 *     reads the boot's four corners wherever the rendered stone under one stands proud of the
 *     analytic ground (the top landing's slabs, 2.8 cm above the 5.4 m the flight's frame gives
 *     — under STEP_MIN, so no edge; the centre line read the landing while the outer heel sat
 *     in the slab, −27 mm at the very end of the ascent); on the terrain and the paving the
 *     rendered surface IS the analytic ground, so nothing is added there.
 *   Measured with the character-5 harness against 35a9791 (660-frame ascent / descent, 300 flat):
 *   max root step in the first 10 frames 105.8 → 16.9 mm (ascent), 2.6 → 12.8 mm (descent: the
 *   stairs clip's stance spot drifting onto the landing slab's 2.3 cm proud edge during the
 *   idle → stairs fade, the PLANT ramp being 3 mm long for it); min sole gap on the descent
 *   −5.9 / −2.7 → +2.1 / −0.2 mm (L / R), on the ascent −42.0 → −0.9 mm (f659, the corner rule;
 *   mid-flight −42.0 → +5.9 mm at f154, the three-line scan); steady-state root steps unchanged
 *   (19.2 / 19.6 mm) except the landing off the bottom riser, 13.9 → 21.9 mm (the landing foot
 *   shifted 12 mm further from the wavy lip, so the pre-existing heel-strike extra drop grows);
 *   no reach clamp; the flat scenario identical frame for frame to round 5 but the idle → walk
 *   start, 4.4 → 2.6 mm (walk → run 3.4 mm, run → idle unchanged).
 *   Round 6b — the landing off the bottom riser (Astra's review of the above): the landing foot,
 *   shifted 2.6 cm forward off the wavy lip, lay past the straight leg the frame it planted and
 *   the stance rule dropped the root by the whole shortfall in that frame (21.9 mm, was 13.9
 *   with round 5's 1.4 cm shift). The shortfall is now taken up over the last ATTACK of the
 *   swing (`attackDropM`) — the mirror of the take-off RELEASE, evaluated on the landing
 *   configuration (shifted spot, support, the clip's heel-strike hip and ankle orientation, the
 *   slope tilt and nosing pitch the stance rule will apply) so it hands over at phase 1 without
 *   a step. That landing: −6.8 … −1.6 mm over eight frames, then the stance's own +13.0 as the
 *   hip comes over the foot (was −21.9 / +12.3); the whole-descent maximum is back to the riser
 *   ease's 19.65 mm/frame (f472 — the same stride is 19.62 in round 5, its tread reading 0.45 mm
 *   prouder under a boot corner now); every other number of round 6 unchanged, the ascent and the
 *   flat scenario identical frame for frame.
 *
 * Playback rate per gait = GAIT_SPEED / (stride / cycle) from her pipeline.json — 1.0 for every
 * clip as delivered; the formula stays so a future clip with a different stride does not slide.
 *
 * The head look-at rotates two pivots inserted above the `neck` and `head` bones rather than the
 * bones themselves: the mixer only rewrites a bound property when its blended value changed, so a
 * rotation added to a bone would survive into a frame rendered at the same `t` and double up.
 * The leg IK below uses the same device: six pivots (thigh / knee / ankle, both legs).
 *
 * Foot planting (round 4, footprint-aware since round 5) — the clips were animated on a flat
 * plane; here every sole meets the ground under IT, so on the stair flight (0.27 m risers) and on
 * slopes the two feet stand on different heights instead of one floating or sinking by the step:
 *   1. the skeleton is posed for `t` with the root at the placement height; both soles (the
 *      ankle-local markers from Astra's manifest, under the ankle) are read. The lower sole is the
 *      planted foot; the other is in stance too (double support) or in a swing — per the clip's
 *      swing table, sampled from the clip itself at load;
 *   2. each stance foot is PLANNED against the rendered surface (ground.ts `surface`: the tread
 *      tops as built, including the 2–5.7 cm nosing overhang in front of the analytic riser) with
 *      the boot's REAL footprint — the sole's heel / toe and width measured on the boot mesh at
 *      load, projected along the facing at the foot's own yaw. A nosing within the footprint puts
 *      the foot in one of the stance configurations that keep every sole corner on or above the
 *      stone under it (see `footConfig`): flat on one tread with the heel 2 cm clear of the lip
 *      behind and the toe 2 cm clear of the riser ahead, or on the upper tread with its toe hanging
 *      over the nosing (descending — the foot PITCHES toe-down about the edge) or its heel hanging
 *      behind it, the ball on the stone (ascending). Where the clip's landing spot allows none of
 *      these — a heel tucked under the lip of the tread above, a toe under the riser ahead — the
 *      foot is SHIFTED along the facing to the nearer of the two (≤ 8.5 cm, the upper-tread one
 *      preferred by UPPER_BIAS: it is the shorter reach for the leg), never left with a corner
 *      inside the stone (round 4 ramped the sole into the riser over 4.5 cm of travel instead;
 *      Astra's descent review found a heel 24 cm inside the upper tread for a whole stance);
 *   3. a swing foot eases from its take-off configuration to its landing one (both predicted
 *      from the table spots carried along the facing — the same values the stance rule reads at
 *      either end, so toe-off and heel-strike are seamless): support, shift and pitch, the
 *      descent in step with the root's (DESC_END). Over that the geometry decides: the CLEAR arc
 *      lifts the toe over the riser it is about to climb, and the LIP lift holds the heel on the
 *      tread it steps off until it has cleared the lip and lets it down over HEEL_RUNOUT. Both see
 *      only the edges within this swing's own travel (the riser beyond the landing spot and the
 *      lip behind the take-off spot are not theirs), so they are exactly zero at every valid
 *      toe-off and heel-strike;
 *   4. the root is grounded on the LOWER of the two root supports: a stance foot's own, a swing
 *      foot's easing from min(take-off support, the other foot's level) to min(landing support,
 *      the other foot's level) — one riser per swing at most, whatever the stride covers — so a
 *      leg is only ever bent, never stretched; on flat ground exactly the round-3 whole-root drop,
 *      so the hero views A / C / D do not move. A foot planted past its leg's reach (a shifted
 *      stance) lowers the root by the shortfall, and that drop is released over the first RELEASE
 *      of the foot's swing (re-evaluated against the toe-off pose from the table), not the frame
 *      the foot lifts;
 *   5. each foot is raised by its support's excess over the root support (clamped to
 *      MAX_CORRECTION) and moved by its shift with an analytic two-bone IK: the knee bends about
 *      its own bend plane, then the thigh swings the ankle onto the target; the ankle pivot
 *      restores the clip's foot orientation and, for a foot in contact, tilts the sole onto the
 *      local slope and adds the nosing pitch.
 * Everything is a closed-form function of `t`, the placement and the ground: no smoothing over
 * time, no state. Every support is continuous in the sole's position and the facing (see
 * `envelope` and the tie band in `footConfig`); a stance foot of these clips is stationary in the
 * world, so its configuration holds for the whole stance and changes only through a swing.
 *
 * Round 8 — the blink (blink.ts, Astra's morph contract): every mesh of the asset whose
 * `morphTargetDictionary` has `blink` / `blinkHalf` gets the contract's two weights set after the
 * mixer has evaluated the pose, from a closure phase that is a closed-form function of `t` (the
 * seeded slot schedule) and of the run-start event the chain recorded (`runBlinkT`, one-shot:
 * its envelope outlives the run — round 8b, Astra's PR #10). The clips carry no morph
 * tracks, so the mixer never contends for the influences; an asset without the morphs (the
 * 9189538d build adopted before 0c28cb62) has no such mesh and the drive is inert. The fixed
 * captures sit in a scheduled slot's open phase, so the adopted morphs leave them unchanged
 * too. Movement and the IK above are untouched by it.
 */
import { AnimationAction, AnimationMixer, Bone, Box3, Group, LoopRepeat, Material, MathUtils, Mesh, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAIT_SPEED, GAITS, type Gait, type GroundSampler } from './animation';
import { BLINK_HALF_MORPH, BLINK_MORPH, blinkPhase, blinkWeights, createBlinkSchedule, nextBlinkStart, type BlinkSchedule, type BlinkWeights } from './blink';
import { chainWeights, type FootAnchor } from './gaitChain';
import type { BlinkInfo, FootContact, PlantInfo, Puppet, PuppetPose } from './puppet';

/** served by Vite from public/ */
export const LINK_GLB_FILE = 'models/link/link-runtime.glb';
/** the delivered file's hash, recorded in public/models/link/SOURCE.md — reported, never recomputed at runtime */
export const LINK_GLB_SHA256 = '611c44253d6ae4fcd182adf5c15a98f94c3bfa20305bcd4202546173be9c1719';
/** skull top above the `head` bone (m) on Astra's rig, measured on the 409b603 asset's skin mesh (cap excluded) */
export const HEAD_TOP_ANATOMICAL_M = 0.276;

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
  run: { strideM: 1.82, cycleS: 28 / 60, heroClipTime: (15 / 60) * (28 / 34) },
  stairs: { strideM: 0.8066667, cycleS: 0.7333333, heroClipTime: 22 / 60 },
};
/** simulation time of the hero captures (capture.mjs DEFAULT_SIM_TIME 12.5 + 6 settle frames) */
export const HERO_T = 12.6;

const REQUIRED_BONES = ['hips', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'] as const;

/** ankle-local sole contact markers (three.js axes) from her runtime capture manifest — under the ankle, on the sole */
const SOLE_L = new Vector3(-0.000000016, 0.05900068, 0.08564404);
const SOLE_R = new Vector3(0.000000016, 0.05900068, 0.08564404);
/**
 * The boot's footprint is measured on the mesh at load (`measureFootprint`): the sole's vertices
 * — those the ankle bone drives, in the lowest SOLE_BAND of the boot — give the heel / toe reach
 * behind / ahead of the marker along the rest forward (+Z) and the width either side (Astra's
 * 9189538d boots: heel 0.079, toe 0.141 / 0.135, 0.154 m wide). These are the fallbacks for an
 * asset whose sole cannot be found.
 */
const SOLE_BAND = 0.012;
const FALLBACK_FOOTPRINT: Footprint = { heel: 0.08, toe: 0.14, latMin: -0.075, latMax: 0.075 };
/** the reported contact moves from the marker to the toe / heel only when the marker is off its ground by more than this (m) */
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
 * rise has to be mostly done by then) and over 0..DESC_END of the swing when it descends, in
 * step with the root's own descent (step 3), so the trailing foot of a two-tread stride is never
 * held a riser and a half above a root that has already come down (its knee would fold flat —
 * round 5's first cut eased the foot from 0.3 and clamped the fold on every such swing). Neither
 * ease knows where the stone is — the geometric hold and LIP lift below do (they keep the heel on
 * the tread it steps off until it has cleared the lip), and the foot's support is the higher.
 */
const RISE_END = 0.9;
const DESC_END = 0.9;
/**
 * The forward CLEAR lift blends in from its closed state over the first CLEAR_OPEN of a swing and
 * back out over CLEAR_CLOSE0..1 before heel-strike. The closed state is the sink footprint at
 * slope SWING_LAMBDA — never above the stance support (a gentler sink is lower), never below the
 * ground under the marker (its 7.7 cm ramp is shorter than the toe / heel offsets) — so with the
 * predicted support the swing foot reads exactly the stance rule at toe-off and heel-strike.
 * The LIP lift is exactly zero for every valid stance (its run-outs are the stance margins), so it
 * only fades over the first LIP_OPEN and the last 1 − LIP_CLOSE of a swing to absorb the tie band
 * and the table's spot resolution.
 */
const CLEAR_OPEN = 0.3;
const CLEAR_CLOSE0 = 0.55;
const CLEAR_CLOSE1 = 0.85;
const SWING_LAMBDA = 3.5;
const LIP_OPEN = 0.1;
const LIP_CLOSE = 0.95;
/**
 * Clip tables: samples per cycle, the sole lift above the cycle's floor that ends a stance, and
 * the shortest lift that counts as a swing (the run clip's stance sole bobs by 1–3 mm).
 */
const TABLE_N = 96;
const STANCE_LIFT = 0.001;
const MIN_SWING_S = 0.1;
/** largest vertical foot correction (m): a step edge under one foot can never pull a leg apart */
const MAX_CORRECTION = 0.3;
/**
 * Highest a sole may be above the root's floor (m): the clips' swing arcs peak at 0.15, and a
 * foot whose support is held a riser above the root (the trailing foot of a descent, before its
 * heel has cleared the lip) would stack that arc on the riser and put its ankle at the hip (the
 * shin folds flat: the fold limit MIN_REACH). The arc is flattened toward the support instead —
 * never below it — so the foot skims the tread it steps off. Never binds on flat ground.
 */
const FOLD_MAX = 0.24;
/** leg extension limits as fractions of the straight leg / the fully folded leg */
const MAX_REACH = 0.995;
const MIN_REACH = 1.02;
/** a target this far (m) past a limit is reported as reach-clamped; the root's extra drop puts a leg exactly at full reach by design */
const REACH_TOL = 0.001;
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
 * Stance configurations at a nosing (`footConfig`). Along the facing, e is the edge's distance
 * ahead of the sole marker (negative = behind). Descending, a foot may rest on the upper tread
 * with the edge ≥ EDGE_MARGIN ahead of the marker (the marker on the stone, the toe in the air,
 * pitched toe-down by up to PITCH_MAX as the overhang grows past PITCH_OVERHANG0), or stand on the
 * lower tread with its heel HEEL_MARGIN clear of the lip behind. Ascending, it may stand on the
 * upper tread with the marker at most EDGE_HANG behind the edge (the ball and toe on the stone,
 * the heel in the air — the boot's ball is 6–7 cm ahead of the marker) or on the lower one with
 * its toe TOE_MARGIN clear of the riser ahead. The margins are the physical clearances (the LIP
 * lift's ray reach fades over exactly these, so the lift is zero at every valid stance). Between
 * those the foot is shifted along the facing to the nearer valid configuration, the one on the
 * upper tread allowed UPPER_BIAS more (a leg reaches a foot on the upper tread more easily:
 * higher and, for the leading foot of a descent or the trailing foot of an ascent, closer); the
 * two tie at one e and are blended over TIE_BAND so the shift is a continuous function of the
 * landing spot.
 */
const EDGE_MARGIN = 0.03;
const EDGE_HANG = 0.03;
const HEEL_MARGIN = 0.02;
const TOE_MARGIN = 0.02;
const UPPER_BIAS = 0.04;
const TIE_BAND = 0.01;
const PITCH_MAX = 0.25;
const PITCH_OVERHANG0 = 0.02;
/** a swing foot's take-off pitch fades out over this much of the swing, its landing pitch in over the same at the end */
const PITCH_FADE = 0.5;
/**
 * The LIP lift's run-outs: a swing foot descends its riser over HEEL_RUNOUT of heel travel past
 * the lip it stepped off and climbs one over TOE_RUNOUT of toe travel toward the riser ahead
 * (4–6 frames at the clips' foot speeds).
 */
const HEEL_RUNOUT = 0.12;
const TOE_RUNOUT = 0.1;
/** a take-off leg's extra root drop (its planted foot beyond the leg's reach) is released over this fraction of the swing */
const RELEASE = 0.3;
/**
 * The mirror image at heel-strike (round 6b): the extra root drop the landing configuration will
 * need — its shifted spot on its support, against the hip of the clip's heel-strike pose — is
 * taken up over the last ATTACK of the swing instead of appearing in the frame the foot plants
 * (a landing foot pushed 2.6 cm forward off the bottom riser's wavy lip dropped the root 21 mm
 * in one frame). Exactly the stance rule's value at phase 1, so it hands over without a step,
 * and zero wherever the landing pose is within reach (every flat-ground landing).
 */
const ATTACK = 0.35;
/** footprint scan along the facing: sample spacing and the reach past the footprint's margins */
const SCAN_STEP = 0.02;
const SCAN_PAD = 0.02;

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
 *   PLANT (a foot in stance) = the highest SINK under the sole's heel, marker and toe, isotropic,
 *         λ PLANT_LAMBDA (a 3 cm ramp): the foot rests on the highest stone under its footprint.
 *         `footConfig` keeps the marker ≥ BALL_MARGIN from any edge, so the ramp is only ever
 *         entered through the tie band — it makes that crossing continuous instead of a pop.
 *   CLEAR (a swing foot) = the highest LIFT under its heel, marker and toe along forward / sideways
 *         rays (λ 1.2 ahead — the foot starts rising 22 cm before a nosing — 2.5 sideways), blended
 *         in over CLEAR_OPEN: the visible arc over a riser ahead.
 *   LIP   (a swing foot) = the highest LIFT under its heel, marker and toe with a RUN-OUT instead
 *         of a slope: (rise · (1 − d / runout))⁺, forward rays TOE_RUNOUT, rearward HEEL_RUNOUT,
 *         no sideways rays. This is the geometry: a point under a nosing reads the upper level
 *         (the rendered surface includes the overhang), a point that has just passed a lip is held
 *         at it and released over the run-out, a point approaching a riser is lifted onto it by
 *         the time it gets there.
 * Both LIFTs see only the edges within the swing's own travel: a ray's reach along the facing is
 * the foot's remaining travel to its landing spot (forward rays) or its travel since take-off
 * (rearward), each faded out over the stance margin beyond (TOE_MARGIN / HEEL_MARGIN). So the
 * riser a foot climbs and the lip it steps off count; the riser ahead of its landing spot and the
 * lip behind its take-off spot do not, and at toe-off and heel-strike of every valid stance
 * (whose margins keep those edges beyond the fade) both lifts are exactly zero — no phase blend
 * is needed for continuity, and the stance margins can be the physical clearances rather than the
 * run-outs.
 */
const STEP_MIN = 0.06;
/** tallest level difference an envelope cares about (two risers); bounds each ray's reach */
const ENVELOPE_RISE_MAX = 0.6;
const BISECT_ITER = 7;
const PLANT_LAMBDA = 9;
const ENVELOPE_RAYS = 8;
/** ray directions in the facing frame: [forward, sideways] components */
const RAY_DIRS: [number, number][] = [];
/** the forward CLEAR slopes per ray (rearward rays disabled) and the LIP run-outs per ray (sideways rays disabled) */
const CLEAR_FWD = new Float64Array(ENVELOPE_RAYS);
const LIP_RUNOUT = new Float64Array(ENVELOPE_RAYS);
for (let k = 0; k < ENVELOPE_RAYS; k++) {
  const a = (k / ENVELOPE_RAYS) * Math.PI * 2;
  const f = Math.cos(a);
  RAY_DIRS.push([f, Math.sin(a)]);
  CLEAR_FWD[k] = f >= -1e-6 ? MathUtils.lerp(2.5, 1.2, Math.max(0, f)) : Infinity;
  LIP_RUNOUT[k] = f > 1e-6 ? TOE_RUNOUT : f < -1e-6 ? HEEL_RUNOUT : Infinity;
}
/** ray reach along the facing for the LIFT envelopes: ahead / behind (m), Infinity = unlimited */
interface Reach {
  fwd: number;
  back: number;
}
const NO_REACH: Reach = { fwd: Infinity, back: Infinity };
const PLANT_STEP = 0.015;
const CLEAR_STEP = 0.06;
const LIP_STEP = 0.02;

/** the sole's reach from its marker: behind / ahead along the rest forward, and either side (m) */
interface Footprint {
  heel: number;
  toe: number;
  latMin: number;
  latMax: number;
}

/** one stance configuration of a foot (see `footConfig`) */
interface FootConfig {
  /** shift along the facing (m, + forward) */
  shift: number;
  /** support height of the (shifted) marker: the highest stone under the footprint plus the pitch lift */
  support: number;
  /** toe-down pitch (rad) about the nosing ahead, and how far ahead of the shifted marker that edge is */
  pitch: number;
  /** the footprint's reach behind / ahead of the marker along the facing at this foot yaw */
  back: number;
  ahead: number;
}

interface Leg {
  side: 'L' | 'R';
  thigh: Object3D;
  knee: Object3D;
  ankle: Object3D;
  thighPivot: Object3D;
  kneePivot: Object3D;
  anklePivot: Object3D;
  sole: Vector3;
  fp: Footprint;
  /** ankle-local direction of the rest forward (+Z) and the six footprint points (corners, heel / toe centres) on the sole */
  fwdLocal: Vector3;
  fpLocal: Vector3[];
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
  /** foot yaw relative to the facing (rad) in the posed clip */
  yawRel: number;
  /** the foot's own stance configuration at its clip sole */
  cfg: FootConfig;
  /** exact surface under the marker, the support the foot is corrected onto, its shift / pitch, its root support */
  gExact: number;
  g: number;
  shift: number;
  pitch: number;
  gRoot: number;
  delta: number;
  /** the idle-foot pin (along the facing, weighted) folded into the applied shift, and the sole hold raising the marker (both m, see the header) */
  pin: number;
  hold: number;
  /**
   * root-ease inputs (blended over the active clips): the supports at take-off / landing (both the
   * stance support for a foot in stance), the swing phase and its weight (0 in stance)
   */
  rootOff: number;
  rootLand: number;
  phase: number;
  swingW: number;
  /** the root support this leg's swing eased from (its take-off double-support level) */
  rootAtOff: number;
  /**
   * extra-drop release (see RELEASE): the ankle target of the foot frozen in its take-off
   * configuration (world), the hip at toe-off (world xz; y above the root floor of that moment)
   * and the release weight (0 outside the first RELEASE of a swing)
   */
  relA: Vector3;
  relH: Vector3;
  relW: number;
  /**
   * extra-drop attack (see ATTACK): the ankle target of the foot in its landing configuration
   * (world), the hip of the clip's heel-strike pose at the landing (world xz; y above the root
   * floor at landing), the attack weight (0 outside the last ATTACK of a swing) and that floor
   */
  attA: Vector3;
  attH: Vector3;
  attW: number;
  rootAtLand: number;
  /** the footprint point (offset along the facing) the report treats as the contact, and the exact ground there */
  contactOff: number;
  contactGround: number;
}

/**
 * One swing of one foot in a clip: clip times, root-relative sole spots and foot yaws at toe-off
 * and heel-strike, and the toe-off / heel-strike poses the extra-drop release and attack
 * re-evaluate (see RELEASE / ATTACK): the root-relative hip, the ankle orientation and the
 * sole's lift above the lower sole at each.
 */
interface Swing {
  tOff: number;
  tLand: number;
  offX: number;
  offZ: number;
  landX: number;
  landZ: number;
  offYaw: number;
  landYaw: number;
  offHip: Vector3;
  offQ: Quaternion;
  offLift: number;
  landHip: Vector3;
  landQ: Quaternion;
  landLift: number;
}

/** root-space sole path of one foot over one clip cycle (TABLE_N samples), with the hip and ankle orientation */
interface FootPath {
  soleX: Float64Array;
  soleY: Float64Array;
  soleZ: Float64Array;
  yaw: Float64Array;
  hip: Vector3[];
  q: Quaternion[];
}

/** per clip, per foot: the swings (cyclic clip times; tLand may exceed the duration) */
type SwingTable = Record<Gait, [Swing[], Swing[]]>;
/** per clip, per foot: the sampled sole path the swings were cut from */
type PathTable = Record<Gait, [FootPath, FootPath]>;

/**
 * One clip of the play-mode gait blend (see `blendChain`): its weight, clip shift and, for a
 * fading clip without gait phases (idle), where its soles were planted when it stopped driving
 * (PuppetPose.anchorFrom / anchorFrom2) — its stance spots while it fades.
 */
interface BlendEntry {
  gait: Gait;
  weight: number;
  shift: number;
  anchor: FootAnchor;
}

export interface LinkClipInfo {
  name: string;
  durationS: number;
  strideM: number;
  rate: number;
  /** each foot's swings as [toe-off, heel-strike] clip times (s) */
  swings: { L: [number, number][]; R: [number, number][] };
}

export interface LinkAssetInfo {
  file: string;
  sha256: string;
  triangles: number;
  materials: number;
  bones: number;
  clips: LinkClipInfo[];
  loadMs: number;
  /** skull top above the `head` bone (m) used for the audit's head projection, and where it came from */
  headTopOffsetM: number;
  headAnchor: 'skin-bbox' | 'anatomical-constant';
  /** the skin-named mesh's box top above the head bone (m), for the record (0.276 on 409b603, 0.112 on 9189538d) */
  skinTopM: number;
  /** the boot footprints measured on the mesh (m from the sole marker), and how many sole vertices each came from */
  footprint: { L: Footprint & { soleVertices: number }; R: Footprint & { soleVertices: number } };
  /** every morph target name the asset's meshes expose (sorted, deduplicated; empty on 9189538d) */
  morphTargets: string[];
}

export interface GlbLink extends Puppet {
  kind: 'glb';
  asset: LinkAssetInfo;
  blink(): BlinkInfo;
}

export interface GlbLinkOptions {
  /** the file the audit reports (default LINK_GLB_FILE); the delivered hash is reported only for that file */
  file?: string;
  /** seed of the blink schedule (blink.ts) — the world seed from index.ts; a constant when absent */
  blinkSeed?: string;
}

/** one mesh carrying the blink morphs: the influence indices of `blink` / `blinkHalf` (−1 = the mesh lacks that one) */
interface BlinkMesh {
  mesh: Mesh;
  iBlink: number;
  iHalf: number;
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
const _qPitch = new Quaternion();
const _qLandTilt = new Quaternion();
const _p = new Vector3();
const _qYaw = new Quaternion();
const _reach: Reach = { fwd: Infinity, back: Infinity };

/**
 * A riser envelope at world (x, z) for the unit facing (fx, fz) — see the ENVELOPE comment.
 * `sign` +1 lifts toward higher levels (LIFT), −1 sinks toward lower ones (SINK). Rays are
 * sampled every `step`; per ray `ramp[k]` is the slope λ (term = change − λ·d), or with `runout`
 * the run-out distance (term = change · (1 − d / ramp[k])); Infinity disables the ray. `reach`
 * limits how far along the facing an edge may lie ahead / behind to count, faded out over the
 * stance margin beyond (TOE_MARGIN ahead, HEEL_MARGIN behind — see the ENVELOPE comment); the
 * fade keeps the result continuous in the reach as well as in the position.
 */
function envelope(ground: GroundSampler, x: number, z: number, fx: number, fz: number, sign: 1 | -1, step: number, ramp: Float64Array, runout: boolean, reach: Reach): number {
  const g0 = ground(x, z);
  let best = 0;
  for (let k = 0; k < ENVELOPE_RAYS; k++) {
    const r = ramp[k];
    if (r === Infinity) continue;
    const f = RAY_DIRS[k][0];
    const limit = f > 1e-6 ? reach.fwd : f < -1e-6 ? reach.back : Infinity;
    const band = f > 0 ? TOE_MARGIN : HEEL_MARGIN;
    // the ray's reach: where even a two-riser change has ramped to nothing, or the reach fade ends
    let n = Math.ceil((runout ? r : ENVELOPE_RISE_MAX / r) / step - 1e-9);
    if (limit !== Infinity) n = Math.min(n, Math.ceil((limit + band) / (Math.abs(f) * step) + 1));
    const dx = fx * RAY_DIRS[k][0] + fz * RAY_DIRS[k][1];
    const dz = fz * RAY_DIRS[k][0] - fx * RAY_DIRS[k][1];
    let prev = g0;
    for (let j = 1; j <= n; j++) {
      let d = j * step;
      const g = ground(x + dx * d, z + dz * d);
      const change = sign * (g - g0);
      const lam = runout ? change / r : r;
      if (change - lam * (d - step) <= best) {
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
      let term = change - lam * d;
      if (limit !== Infinity) term *= 1 - MathUtils.smoothstep(Math.abs(f) * d - limit, 0, band);
      if (term > best) best = term;
      prev = g;
    }
  }
  return g0 + sign * best;
}

const PLANT_LAMBDAS = new Float64Array(ENVELOPE_RAYS).fill(PLANT_LAMBDA);
const SWING_LAMBDAS = new Float64Array(ENVELOPE_RAYS).fill(SWING_LAMBDA);
/** the highest SINK envelope at slope `lam` under the heel, marker and toe of a sole whose marker is at (x, z) and reaches `back` / `ahead` along the facing */
function sinkFootprint(ground: GroundSampler, x: number, z: number, fx: number, fz: number, back: number, ahead: number, lam: Float64Array): number {
  let g = -Infinity;
  for (const o of [-back, 0, ahead]) {
    const v = envelope(ground, x + fx * o, z + fz * o, fx, fz, -1, PLANT_STEP, lam, false, NO_REACH);
    if (v > g) g = v;
  }
  return g;
}
/**
 * The highest LIFT envelope under the heel, marker and toe with the given ray ramps (slopes, or
 * run-outs with `runout`), each point seeing the edges within `reach` of it along the facing —
 * the foot translates as a whole, so the reach (its travel) is the same for every point: an edge
 * beyond where the point lands (plus TOE_MARGIN) or behind where it took off (plus HEEL_MARGIN)
 * is not this swing's business.
 */
function liftFootprint(ground: GroundSampler, x: number, z: number, fx: number, fz: number, back: number, ahead: number, ramp: Float64Array, runout: boolean, step: number, reach: Reach): number {
  let g = -Infinity;
  for (const o of [-back, 0, ahead]) {
    const v = envelope(ground, x + fx * o, z + fz * o, fx, fz, 1, step, ramp, runout, reach);
    if (v > g) g = v;
  }
  return g;
}

/** the footprint's reach behind / ahead of the marker along the facing for a foot yawed `yawRel` from it */
function footReach(fp: Footprint, yawRel: number, out: { back: number; ahead: number }): void {
  const c = Math.cos(yawRel);
  const s = Math.sin(yawRel);
  let back = 0;
  let ahead = 0;
  for (const lat of [fp.latMin, fp.latMax]) {
    for (const along of [-fp.heel, fp.toe]) {
      const proj = along * c - lat * s;
      if (proj > ahead) ahead = proj;
      if (-proj > back) back = -proj;
    }
  }
  out.back = back;
  out.ahead = ahead;
}

/**
 * The stance configuration of a foot whose clip sole marker is at world (x, z), facing (fx, fz)
 * with the foot yawed `yawRel` from it — see the constants above. The footprint's reach along the
 * facing follows from the boot's corners at that yaw; the rendered surface is scanned along the
 * facing through the marker for the nearest step edge (≥ STEP_MIN), bisected to a fraction of a
 * millimetre. Returns the shift, the support of the shifted marker (the PLANT rule at the shifted
 * footprint, plus the pitch lift) and the pitch. `base` is the analytic walking ground under the
 * rendered `ground` (null where the two are one sampler): the PLANT rule extends to the boot's
 * four corners wherever a rendered stone stands proud of it.
 */
function footConfig(ground: GroundSampler, base: GroundSampler | null, x: number, z: number, fx: number, fz: number, yawRel: number, fp: Footprint, out: FootConfig): FootConfig {
  // footprint reach along the facing: corners (lat, along) rotated by the foot yaw
  footReach(fp, yawRel, out);
  const back = out.back;
  const ahead = out.ahead;
  // nearest step edge along the facing within the footprint and its margins, on three lines:
  // through the marker and along the footprint's two lateral extremes (round 6: the nosings are
  // wavy, ±2 cm with 3 cm chips — a lip 3 cm further forward under the boot's outer corner than
  // on the marker line put that corner inside the nose roll of the tread above as the foot lifted)
  const s0 = -(back + HEEL_MARGIN + SCAN_PAD);
  const s1 = ahead + TOE_MARGIN + SCAN_PAD;
  const cy = Math.cos(yawRel);
  const sy = Math.sin(yawRel);
  let lMin = 0;
  let lMax = 0;
  for (const lat of [fp.latMin, fp.latMax]) {
    for (const along of [-fp.heel, fp.toe]) {
      const l = along * sy + lat * cy;
      if (l < lMin) lMin = l;
      if (l > lMax) lMax = l;
    }
  }
  let e = NaN;
  let rise = 0;
  for (const l of [0, lMin, lMax]) {
    // root-space lateral +x is world (fz, −fx)
    const lx = x + fz * l;
    const lz = z - fx * l;
    let prevS = s0;
    let prevG = ground(lx + fx * s0, lz + fz * s0);
    for (let d = s0 + SCAN_STEP; d < s1 + SCAN_STEP; d += SCAN_STEP) {
      const sd = Math.min(d, s1);
      const g = ground(lx + fx * sd, lz + fz * sd);
      if (Math.abs(g - prevG) >= STEP_MIN) {
        const mid = (prevG + g) / 2;
        const up = g > prevG;
        let lo = prevS;
        let hi = sd;
        for (let it = 0; it < BISECT_ITER; it++) {
          const m = (lo + hi) / 2;
          if (ground(lx + fx * m, lz + fz * m) - mid >= 0 === up) hi = m;
          else lo = m;
        }
        const ed = (lo + hi) / 2;
        if (Number.isNaN(e) || Math.abs(ed) < Math.abs(e)) {
          e = ed;
          rise = g - prevG;
        }
      }
      prevS = sd;
      prevG = g;
      if (sd >= s1) break;
    }
  }
  let shift = 0;
  let pitch = 0;
  if (!Number.isNaN(e)) {
    // the two ways out of an invalid straddle (shift magnitudes toward the upper / lower tread)
    // and their blend at the tie, the upper allowed UPPER_BIAS more; `upperBack` tells which way
    // the upper tread lies
    const choose = (upper: number, lowerShift: number, upperBack: boolean) => {
      const wUpper = 1 - MathUtils.smoothstep(upper - UPPER_BIAS - lowerShift, -TIE_BAND / 2, TIE_BAND / 2);
      const sUpper = upperBack ? -upper : upper;
      const sLower = upperBack ? lowerShift : -lowerShift;
      return sUpper * wUpper + sLower * (1 - wUpper);
    };
    if (rise < 0) {
      // the level DROPS ahead (descending): back onto the upper tread with the toe over the edge,
      // or forward onto the lower tread with the heel clear of the lip
      if (e < EDGE_MARGIN && e > -(back + HEEL_MARGIN)) shift = choose(EDGE_MARGIN - e, e + back + HEEL_MARGIN, true);
    } else if (e > EDGE_HANG && e < ahead + TOE_MARGIN) {
      // the level RISES ahead (ascending): forward onto the upper tread with the heel hanging, or
      // back with the toe clear of the riser
      shift = choose(e - EDGE_HANG, ahead + TOE_MARGIN - e, false);
    }
    if (rise < 0) {
      const eShifted = e - shift;
      const overhang = ahead - eShifted;
      if (eShifted >= EDGE_MARGIN - 1e-6 && overhang > 0) pitch = PITCH_MAX * MathUtils.smoothstep(overhang, PITCH_OVERHANG0, ahead - EDGE_MARGIN);
    }
  }
  const sx = x + fx * shift;
  const sz = z + fz * shift;
  let support = sinkFootprint(ground, sx, sz, fx, fz, back, ahead, PLANT_LAMBDAS);
  if (base) {
    // round 6: the boot's four corners join the PLANT max wherever the rendered stone under one
    // stands proud of the analytic ground (the last tread's top 2.8 cm above the landing it
    // meets, a stone's jitter): the centre line read the landing while the boot's outer heel
    // sat in the stone. Where the rendered surface IS the analytic ground (the terrain, the
    // paving, a tread top dished under its nominal) nothing is added — round 5's pose exactly.
    for (const lat of [fp.latMin, fp.latMax]) {
      for (const along of [-fp.heel, fp.toe]) {
        const proj = along * cy - lat * sy;
        const l = along * sy + lat * cy;
        const px = sx + fx * proj + fz * l;
        const pz = sz + fz * proj - fx * l;
        if (ground(px, pz) <= base(px, pz) + 1e-6) continue;
        const v = envelope(ground, px, pz, fx, fz, -1, PLANT_STEP, PLANT_LAMBDAS, false, NO_REACH);
        if (v > support) support = v;
      }
    }
  }
  if (pitch > 0) support += (e - shift) * Math.sin(pitch);
  out.shift = shift;
  out.support = support;
  out.pitch = pitch;
  return out;
}

/**
 * Cut one foot's sampled clip path into swings: the foot is in stance while its sole is within
 * STANCE_LIFT of the cycle's lowest sole height; a swing runs from the last stance sample
 * (toe-off) to the first stance sample after it (heel-strike), across the loop seam if need be.
 * `other` is the other foot's path (for the sole's lift above the lower sole at toe-off).
 */
function tableSwings(path: FootPath, other: FootPath, duration: number): Swing[] {
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
    if (tLand - tOff >= MIN_SWING_S) {
      // the toe-off pose relative to the root's FLOOR (the lower sole): the hip's height above it
      // and this sole's lift above it — the root is grounded by that floor, so both carry over
      const offFloor = Math.min(path.soleY[off], other.soleY[off]);
      const landFloor = Math.min(path.soleY[land], other.soleY[land]);
      swings.push({
        tOff,
        tLand,
        offX: path.soleX[off],
        offZ: path.soleZ[off],
        landX: path.soleX[land],
        landZ: path.soleZ[land],
        offYaw: path.yaw[off],
        landYaw: path.yaw[land],
        offHip: new Vector3(path.hip[off].x, path.hip[off].y - offFloor, path.hip[off].z),
        offQ: path.q[off].clone(),
        offLift: path.soleY[off] - offFloor,
        landHip: new Vector3(path.hip[land].x, path.hip[land].y - landFloor, path.hip[land].z),
        landQ: path.q[land].clone(),
        landLift: path.soleY[land] - landFloor,
      });
    }
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
/** in stance at clip time τ: the swing that landed the foot most recently and the clip time since its heel-strike (null without swings) */
function stanceAt(swings: Swing[], tau: number, duration: number): { swing: Swing; since: number } | null {
  let best: { swing: Swing; since: number } | null = null;
  for (const s of swings) {
    const since = mod(tau - s.tLand, duration);
    if (!best || since < best.since) best = { swing: s, since };
  }
  return best;
}

/**
 * Gait phase of a clip at clip time τ from its left foot's first swing: 0..1 through the swing,
 * 1..2 through the stance. NaN for a clip without swings (idle).
 */
function gaitPhase(swings: Swing[], tau: number, duration: number): number {
  if (!swings.length) return NaN;
  const s = swings[0];
  const len = s.tLand - s.tOff;
  const dt = mod(tau - s.tOff, duration);
  return dt < len ? dt / len : 1 + (dt - len) / (duration - len);
}
/** inverse of `gaitPhase` */
function gaitPhaseTime(swings: Swing[], phase: number, duration: number): number {
  const s = swings[0];
  const len = s.tLand - s.tOff;
  const p = mod(phase, 2);
  return mod(s.tOff + (p < 1 ? p * len : len + (p - 1) * (duration - len)), duration);
}

/** the root-relative sole (x, z) and foot yaw of a sampled clip path at clip time τ (linear between samples, cyclic) */
function pathAt(path: FootPath, tau: number, duration: number, out: { x: number; z: number; yaw: number }): void {
  const n = path.soleX.length;
  const f = mod(tau / duration, 1) * n;
  const i0 = Math.min(n - 1, Math.floor(f));
  const i1 = (i0 + 1) % n;
  const a = f - i0;
  out.x = path.soleX[i0] + (path.soleX[i1] - path.soleX[i0]) * a;
  out.z = path.soleZ[i0] + (path.soleZ[i1] - path.soleZ[i0]) * a;
  const y0 = path.yaw[i0];
  const y1 = path.yaw[i1];
  out.yaw = Math.atan2(Math.sin(y0) * (1 - a) + Math.sin(y1) * a, Math.cos(y0) * (1 - a) + Math.cos(y1) * a);
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
 * rotation the shin received. Returns how far (m) the target lay beyond the leg's reach (0 when
 * it was reachable).
 */
function solveLeg(leg: Leg, target: Vector3, qIk: Quaternion): number {
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
  let excess = 0;
  if (d > dMax) {
    excess = d - dMax;
    d = dMax;
  } else if (d < dMin) {
    excess = dMin - d;
    d = dMin;
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
  return excess;
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

/**
 * Measure a boot's footprint on the rest-posed skinned meshes: the vertices the ankle bone
 * drives (its dominant skin weight) within SOLE_BAND of the lowest such vertex are the sole; its
 * reach behind / ahead of the sole marker along the rest forward (+Z) and either side (±X) is the
 * footprint. Call before anything animates (the meshes' world matrices are the bind pose).
 */
function measureFootprint(meshes: SkinnedMesh[], ankle: Object3D, marker: Vector3): { fp: Footprint; soleVertices: number } {
  const m0 = ankle.localToWorld(marker.clone());
  const pts: Vector3[] = [];
  let yMin = Infinity;
  for (const mesh of meshes) {
    const g = mesh.geometry;
    const pos = g.attributes.position;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    if (!pos || !si || !sw) continue;
    const boneIndex = mesh.skeleton.bones.indexOf(ankle as Bone);
    if (boneIndex < 0) continue;
    for (let i = 0; i < pos.count; i++) {
      let best = -1;
      let bw = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) {
          bw = w;
          best = si.getComponent(i, k);
        }
      }
      if (best !== boneIndex) continue;
      const p = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      pts.push(p);
      if (p.y < yMin) yMin = p.y;
    }
  }
  const sole = pts.filter((p) => p.y <= yMin + SOLE_BAND);
  if (sole.length < 8) return { fp: { ...FALLBACK_FOOTPRINT }, soleVertices: sole.length };
  let heel = Infinity;
  let toe = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;
  for (const p of sole) {
    const along = p.z - m0.z;
    const lat = p.x - m0.x;
    if (along < heel) heel = along;
    if (along > toe) toe = along;
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
  }
  return { fp: { heel: -heel, toe, latMin, latMax }, soleVertices: sole.length };
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
export async function loadGlbLink(url: string, opts: GlbLinkOptions = {}): Promise<GlbLink> {
  const t0 = performance.now();
  const file = opts.file ?? LINK_GLB_FILE;
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
  // the blink morphs (round 8): every mesh whose dictionary names either target, skinned or not
  const blinkMeshes: BlinkMesh[] = [];
  const morphNames = new Set<string>();
  model.traverse((o: Object3D) => {
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
    if ((o as Bone).isBone) bones.push(o as Bone);
    const m = o as Mesh;
    if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) {
      for (const name of Object.keys(m.morphTargetDictionary)) morphNames.add(name);
      const iBlink = m.morphTargetDictionary[BLINK_MORPH] ?? -1;
      const iHalf = m.morphTargetDictionary[BLINK_HALF_MORPH] ?? -1;
      if (iBlink >= 0 || iHalf >= 0) blinkMeshes.push({ mesh: m, iBlink, iHalf });
    }
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
  // no hair / cap) for the audit's head projection, the total height with the cap, the boot soles
  model.updateMatrixWorld(true);
  const skin = skinned.find((m) => /skin/i.test(m.name)) ?? skinned[0];
  skin.geometry.computeBoundingBox();
  const headRest = head.getWorldPosition(new Vector3());
  // The skull top used to come from the skin mesh's bounding box, which only worked while a mesh
  // named *skin* stopped at the scalp: in Astra's 9189538d… asset the body is one mesh including
  // the cap and the skin-named mesh the heuristic finds tops out 0.11 m above the head bone, so the
  // audit's head point wandered by the asset's mesh naming. Her request, and the fix: an explicit
  // anatomical anchor. The rig is the same across her assets (the `head` bone sits at the skull
  // base), so the skull top is HEAD_TOP_ANATOMICAL_M above it — 0.276 m, measured on the 409b603
  // asset's cap-free skin mesh. The skin box top is still reported for the audit.
  const skinTop = (skin.geometry.boundingBox?.max.y ?? headRest.y + HEAD_TOP_ANATOMICAL_M) - headRest.y;
  const headAnchor: LinkAssetInfo['headAnchor'] = 'anatomical-constant';
  const headTopOffset = HEAD_TOP_ANATOMICAL_M;
  const height = bounds.max.y - Math.min(0, bounds.min.y);
  const footprints = { L: measureFootprint(skinned, bone('ankleL'), SOLE_L), R: measureFootprint(skinned, bone('ankleR'), SOLE_R) };

  // look and leg pivots (see the header) — inserted before the actions bind so the search stays valid
  const neckPivot = insertPivot(neck, 'neck-look');
  const headPivot = insertPivot(head, 'head-look');
  const makeLeg = (side: 'L' | 'R'): Leg => {
    const thigh = bone(`thigh${side}`);
    const knee = bone(`knee${side}`);
    const ankle = bone(`ankle${side}`);
    const sole = side === 'L' ? SOLE_L : SOLE_R;
    const fp = footprints[side].fp;
    // rest forward and the footprint points in the ankle's frame (the rest world matrices are current)
    const qRest = ankle.getWorldQuaternion(new Quaternion()).invert();
    const fwdLocal = new Vector3(0, 0, 1).applyQuaternion(qRest);
    const m0 = ankle.localToWorld(sole.clone());
    const fpLocal = [
      [fp.latMin, -fp.heel],
      [fp.latMax, -fp.heel],
      [fp.latMin, fp.toe],
      [fp.latMax, fp.toe],
      [(fp.latMin + fp.latMax) / 2, -fp.heel],
      [(fp.latMin + fp.latMax) / 2, fp.toe],
    ].map(([lat, along]) => ankle.worldToLocal(new Vector3(m0.x + lat, m0.y, m0.z + along)));
    return {
      side,
      thigh,
      knee,
      ankle,
      thighPivot: insertPivot(thigh, `thigh${side}-ik`),
      kneePivot: insertPivot(knee, `knee${side}-ik`),
      anklePivot: insertPivot(ankle, `ankle${side}-ik`),
      sole,
      fp,
      fwdLocal,
      fpLocal,
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
      yawRel: 0,
      cfg: { shift: 0, support: 0, pitch: 0, back: fp.heel, ahead: fp.toe },
      gExact: 0,
      g: 0,
      shift: 0,
      pitch: 0,
      gRoot: 0,
      delta: 0,
      pin: 0,
      hold: 0,
      rootOff: 0,
      rootLand: 0,
      phase: 0,
      swingW: 0,
      rootAtOff: 0,
      relA: new Vector3(),
      relH: new Vector3(),
      relW: 0,
      attA: new Vector3(),
      attH: new Vector3(),
      attW: 0,
      rootAtLand: 0,
      contactOff: 0,
      contactGround: 0,
    };
  };
  const legs: [Leg, Leg] = [makeLeg('L'), makeLeg('R')];
  const feet: FootContact[] = [
    { foot: 'L', soleY: 0, groundY: 0, gapM: 0, supportY: 0, minShoeGapM: 0, shiftM: 0, pitchRad: 0, correctionM: 0, pinM: 0, holdM: 0 },
    { foot: 'R', soleY: 0, groundY: 0, gapM: 0, supportY: 0, minShoeGapM: 0, shiftM: 0, pitchRad: 0, correctionM: 0, pinM: 0, holdM: 0 },
  ];
  const plant: PlantInfo = { mode: 'two-bone', maxCorrectionM: 0, rootShiftM: 0, planted: 'L', reachClamped: false, reachClampedLeg: null, reachExcessM: 0, maxShiftM: 0, extraDropM: 0, attackDropM: 0, maxPinM: 0, maxHoldM: 0, blendClips: 1 };
  const cfgOff: FootConfig = { shift: 0, support: 0, pitch: 0, back: 0, ahead: 0 };
  const cfgLand: FootConfig = { shift: 0, support: 0, pitch: 0, back: 0, ahead: 0 };
  const spotNow = { x: 0, z: 0, yaw: 0 };
  /** the gait blend of the current pose (up to three clips, see BlendEntry) */
  const chain: BlendEntry[] = [
    { gait: 'idle', weight: 0, shift: 0, anchor: null },
    { gait: 'idle', weight: 0, shift: 0, anchor: null },
    { gait: 'idle', weight: 0, shift: 0, anchor: null },
  ];

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
  const pathTable = {} as PathTable;
  {
    const _pt = new Vector3();
    const _f = new Vector3();
    const _qa = new Quaternion();
    for (const [gait, a] of actions) {
      for (const b of actions.values()) b.action.weight = b === a ? 1 : 0;
      const paths: FootPath[] = legs.map(() => ({ soleX: new Float64Array(TABLE_N), soleY: new Float64Array(TABLE_N), soleZ: new Float64Array(TABLE_N), yaw: new Float64Array(TABLE_N), hip: [], q: [] }));
      for (let i = 0; i < TABLE_N; i++) {
        a.action.time = (i / TABLE_N) * a.duration;
        mixer.update(0);
        model.updateMatrixWorld(true);
        for (let f = 0; f < 2; f++) {
          _pt.copy(legs[f].sole).applyMatrix4(legs[f].ankle.matrixWorld);
          paths[f].soleX[i] = _pt.x;
          paths[f].soleY[i] = _pt.y;
          paths[f].soleZ[i] = _pt.z;
          legs[f].ankle.getWorldQuaternion(_qa);
          _f.copy(legs[f].fwdLocal).applyQuaternion(_qa);
          paths[f].yaw[i] = Math.atan2(_f.x, _f.z);
          paths[f].hip.push(legs[f].thigh.getWorldPosition(new Vector3()));
          paths[f].q.push(_qa.clone());
        }
      }
      tables[gait] = [tableSwings(paths[0], paths[1], a.duration), tableSwings(paths[1], paths[0], a.duration)];
      pathTable[gait] = [paths[0], paths[1]];
    }
    for (const [gait, a] of actions) {
      a.action.weight = gait === 'idle' ? 1 : 0;
      a.action.time = 0;
    }
    mixer.update(0);
  }

  const asset: LinkAssetInfo = {
    file,
    sha256: file === LINK_GLB_FILE ? LINK_GLB_SHA256 : 'unrecorded (override file)',
    triangles,
    materials: materials.size,
    bones: bones.length,
    clips: GAITS.map((g) => {
      const a = actions.get(g)!;
      const sw = (i: 0 | 1) => tables[g][i].map((s) => [Number(s.tOff.toFixed(4)), Number(s.tLand.toFixed(4))] as [number, number]);
      return { name: g, durationS: Number(a.duration.toFixed(6)), strideM: CLIP_SPEC[g].strideM, rate: a.rate, swings: { L: sw(0), R: sw(1) } };
    }),
    loadMs: Math.round(performance.now() - t0),
    headTopOffsetM: Number(headTopOffset.toFixed(4)),
    headAnchor,
    skinTopM: Number(skinTop.toFixed(4)),
    footprint: {
      L: { heel: Number(footprints.L.fp.heel.toFixed(4)), toe: Number(footprints.L.fp.toe.toFixed(4)), latMin: Number(footprints.L.fp.latMin.toFixed(4)), latMax: Number(footprints.L.fp.latMax.toFixed(4)), soleVertices: footprints.L.soleVertices },
      R: { heel: Number(footprints.R.fp.heel.toFixed(4)), toe: Number(footprints.R.fp.toe.toFixed(4)), latMin: Number(footprints.R.fp.latMin.toFixed(4)), latMax: Number(footprints.R.fp.latMax.toFixed(4)), soleVertices: footprints.R.soleVertices },
    },
    morphTargets: [...morphNames].sort(),
  };

  // the blink (round 8): the schedule and the last pose's closure / weights, for the audit
  const blinkSchedule: BlinkSchedule = createBlinkSchedule(opts.blinkSeed ?? 'link-blink');
  const blinkW: BlinkWeights = { blink: 0, blinkHalf: 0 };
  const blinkState = { phase: 0, t: 0, runT: -Infinity };
  /**
   * Set the contract's weights on every morph mesh for the pose at `t`. After `mixer.update` (the
   * clips carry no morph tracks, but the order keeps that true whatever a future clip does). The
   * run-start event is the chain's `runBlinkT` (round 8b) — its envelope outlives the run.
   */
  const applyBlink = (p: PuppetPose) => {
    const phase = blinkPhase(blinkSchedule, p.t, p.runBlinkT);
    blinkWeights(phase, blinkW);
    blinkState.phase = phase;
    blinkState.t = p.t;
    blinkState.runT = p.runBlinkT;
    for (const b of blinkMeshes) {
      const inf = b.mesh.morphTargetInfluences!;
      if (b.iBlink >= 0) inf[b.iBlink] = blinkW.blink;
      if (b.iHalf >= 0) inf[b.iHalf] = blinkW.blinkHalf;
    }
  };

  const clipTimeOf = (gait: Gait, t: number, shift = 0) => {
    const a = actions.get(gait)!;
    return mod(t * a.rate + a.offset + shift, a.duration);
  };

  const hasClip = (gait: Gait) => actions.has(gait);
  const weights: [number, number, number] = [1, 0, 0];
  /**
   * Fill `chain` for the pose: the current gait, the gait it fades from and the one that was
   * fading before that, weighted by gaitChain.ts `chainWeights` (a missing clip folds its weight
   * upward). Returns the number of entries with weight.
   */
  const blendChain = (p: PuppetPose): number => {
    const n = chainWeights(p, p.t, hasClip, weights);
    const c0 = chain[0];
    c0.gait = p.gait;
    c0.weight = weights[0];
    c0.shift = p.clipShift;
    c0.anchor = null;
    const c1 = chain[1];
    c1.gait = p.gaitFrom;
    c1.weight = weights[1];
    c1.shift = p.clipShiftFrom;
    c1.anchor = p.anchorFrom;
    const c2 = chain[2];
    c2.gait = p.gaitFrom2;
    c2.weight = weights[2];
    c2.shift = p.clipShiftFrom2;
    c2.anchor = p.anchorFrom2;
    return n;
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
    pose(x, z, yaw, p, ground: GroundSampler, contact, surface: GroundSampler = ground) {
      // the analytic ground under the rendered surface, for the PLANT corners (footConfig)
      const base = surface === ground ? null : ground;
      const placed = ground(x, z);
      root.position.set(x, placed, z);
      root.rotation.y = yaw;
      const blendClips = blendChain(p);
      for (const [gait, a] of actions) {
        // a clip in the chain more than once has one shift (index.ts reuses it), so one time
        let weight = 0;
        let shift = 0;
        for (const c of chain) {
          if (c.gait !== gait || c.weight <= 0) continue;
          weight += c.weight;
          shift = c.shift;
        }
        a.action.weight = weight;
        a.action.time = clipTimeOf(gait, p.t, shift);
      }
      mixer.update(0);
      applyBlink(p);
      neckPivot.quaternion.identity();
      headPivot.quaternion.identity();
      for (const leg of legs) {
        leg.thighPivot.quaternion.identity();
        leg.kneePivot.quaternion.identity();
        leg.anklePivot.quaternion.identity();
      }
      if (p.look && p.lookWeight > 0) lookAt(p.look, p.lookWeight);
      root.updateMatrixWorld(true);

      // 1. the posed legs: joints, soles and foot yaws (world) with the root at the placement
      // height. The lower clip sole is the one the root drop puts on the ground (on flat ground
      // the round-3 rule); a foot's contact weight (its slope tilt) fades with its lift above it.
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      _qYaw.setFromAxisAngle(_axisY, yaw);
      for (const leg of legs) {
        leg.thigh.getWorldPosition(leg.hip);
        leg.knee.getWorldPosition(leg.kneeP);
        leg.ankle.getWorldPosition(leg.ankleP);
        leg.soleP.copy(leg.sole).applyMatrix4(leg.ankle.matrixWorld);
        leg.thigh.getWorldQuaternion(leg.qThigh);
        leg.knee.getWorldQuaternion(leg.qKnee);
        leg.ankle.getWorldQuaternion(leg.qAnkle);
        _v.copy(leg.fwdLocal).applyQuaternion(leg.qAnkle);
        leg.yawRel = Math.atan2(_v.x * fz - _v.z * fx, _v.x * fx + _v.z * fz);
        leg.gExact = surface(leg.soleP.x, leg.soleP.z);
      }
      const lower = legs[0].soleP.y <= legs[1].soleP.y ? 0 : 1;
      const soleMin = legs[lower].soleP.y;
      for (let i = 0; i < 2; i++) {
        const leg = legs[i];
        leg.contact = 1 - MathUtils.smoothstep(leg.soleP.y - soleMin, CONTACT_LIFT0, CONTACT_LIFT1);

        // 2. each foot, per active clip, from the clip's swing table — never from which sole
        // happens to be lower (at double support that flips between frames, and the two feet may
        // straddle a riser very differently). In STANCE the foot reads the configuration of the
        // spot its last swing landed on: the root-relative table spot carried along the facing at
        // the gait's ground speed (the in-place clips' stance paths cancel exactly that speed), so
        // it is frozen for the whole stance and is the very value the swing predicted for its
        // landing. In a SWING the take-off and landing spots are carried the same way, each with
        // its configuration, and the foot eases from the one to the other — support, shift, pitch;
        // the take-off / landing supports and the phase feed the root ease in step 3.
        let predFoot = 0;
        let predShift = 0;
        let predPitch = 0;
        let clearW = 0;
        let lipW = 0;
        let wsum = 0;
        let rootOff = 0;
        let rootLand = 0;
        let phase = 0;
        let swingW = 0;
        let travelBack = 0;
        let travelFwd = 0;
        let relW = 0;
        let attW = 0;
        let predPin = 0;
        leg.relA.set(0, 0, 0);
        leg.relH.set(0, 0, 0);
        leg.attA.set(0, 0, 0);
        leg.attH.set(0, 0, 0);
        for (const c of chain) {
          const weight = c.weight;
          if (weight <= 0) continue;
          const gait = c.gait;
          const a = actions.get(gait)!;
          const swings = tables[gait][i];
          const speed = GAIT_SPEED[gait];
          const sw = swingAt(swings, a.action.time, a.duration);
          let foot: number;
          let sh: number;
          let pt: number;
          let cw = 0;
          let lw = 0;
          if (sw) {
            const s = sw.swing;
            const len = (s.tLand - s.tOff) / a.rate;
            const back = speed * sw.phase * len;
            const ahead = speed * (1 - sw.phase) * len;
            const ox = x + s.offX * fz + s.offZ * fx - fx * back;
            const oz = z - s.offX * fx + s.offZ * fz - fz * back;
            const lx = x + s.landX * fz + s.landZ * fx + fx * ahead;
            const lz = z - s.landX * fx + s.landZ * fz + fz * ahead;
            footConfig(surface, base, ox, oz, fx, fz, s.offYaw, leg.fp, cfgOff);
            footConfig(surface, base, lx, lz, fx, fz, s.landYaw, leg.fp, cfgLand);
            const gOff = cfgOff.support;
            const gLand = cfgLand.support;
            const ease = MathUtils.smoothstep(sw.phase, 0, gLand >= gOff ? RISE_END : DESC_END);
            foot = gOff + (gLand - gOff) * ease;
            const blend = MathUtils.smoothstep(sw.phase, 0, 1);
            sh = cfgOff.shift + (cfgLand.shift - cfgOff.shift) * blend;
            // the take-off pitch fades out over the first half of the swing and the landing pitch
            // in over the second: a toe-down landing pitch blended in from toe-off would dip the
            // toe into the front of the tread the foot is still leaving
            pt = cfgOff.pitch * (1 - MathUtils.smoothstep(sw.phase, 0, PITCH_FADE)) + cfgLand.pitch * MathUtils.smoothstep(sw.phase, 1 - PITCH_FADE, 1);
            cw = MathUtils.smoothstep(sw.phase, 0, CLEAR_OPEN) * (1 - MathUtils.smoothstep(sw.phase, CLEAR_CLOSE0, CLEAR_CLOSE1));
            lw = MathUtils.smoothstep(sw.phase, 0, LIP_OPEN) * (1 - MathUtils.smoothstep(sw.phase, LIP_CLOSE, 1));
            // the shifted marker's travel along the facing since take-off and to landing
            const cur = (leg.soleP.x + fx * sh) * fx + (leg.soleP.z + fz * sh) * fz;
            travelBack += weight * Math.max(0, cur - ((ox + fx * cfgOff.shift) * fx + (oz + fz * cfgOff.shift) * fz));
            travelFwd += weight * Math.max(0, (lx + fx * cfgLand.shift) * fx + (lz + fz * cfgLand.shift) * fz - cur);
            rootOff += weight * gOff;
            rootLand += weight * gLand;
            phase += weight * sw.phase;
            swingW += weight;
            const rw = weight * (1 - MathUtils.smoothstep(sw.phase, 0, RELEASE));
            if (rw > 0) {
              // the foot frozen in its take-off configuration (the shifted spot at its support,
              // the clip's sole lift and ankle orientation of that moment) and the hip of that
              // moment, carried to the present like the spots
              _q.copy(s.offQ).premultiply(_qYaw);
              _p.copy(leg.sole).applyQuaternion(_q);
              leg.relA.x += rw * (ox + fx * cfgOff.shift - _p.x);
              leg.relA.y += rw * (gOff + s.offLift - _p.y);
              leg.relA.z += rw * (oz + fz * cfgOff.shift - _p.z);
              leg.relH.x += rw * (x + s.offHip.x * fz + s.offHip.z * fx - fx * back);
              leg.relH.y += rw * s.offHip.y;
              leg.relH.z += rw * (z - s.offHip.x * fx + s.offHip.z * fz - fz * back);
              relW += rw;
            }
            const aw = weight * MathUtils.smoothstep(sw.phase, 1 - ATTACK, 1);
            if (aw > 0) {
              // the foot in its landing configuration (the shifted landing spot at its support,
              // the clip's heel-strike sole lift and ankle orientation tilted onto the slope
              // there and pitched over its nosing, as the stance rule will have it — a 7.8°
              // slope at the flight's foot moves the ankle 14 mm) and the hip of that pose at the
              // landing (the root `ahead` along the facing), like the spots
              _q2.copy(s.landQ).premultiply(_qYaw);
              groundTilt(ground, lx, lz, 1, _qLandTilt);
              if (Math.abs(cfgLand.pitch) > 1e-5) {
                _v.copy(leg.fwdLocal).applyQuaternion(_q2);
                _v.y = 0;
                if (_v.lengthSq() > 1e-8) {
                  _v.normalize();
                  _n.crossVectors(_axisY, _v);
                  _qPitch.setFromAxisAngle(_n, cfgLand.pitch);
                  _qLandTilt.premultiply(_qPitch);
                }
              }
              _q.multiplyQuaternions(_qLandTilt, _q2);
              _p.copy(leg.sole).applyQuaternion(_q);
              leg.attA.x += aw * (lx + fx * cfgLand.shift - _p.x);
              leg.attA.y += aw * (gLand + s.landLift - _p.y);
              leg.attA.z += aw * (lz + fz * cfgLand.shift - _p.z);
              leg.attH.x += aw * (x + s.landHip.x * fz + s.landHip.z * fx + fx * ahead);
              leg.attH.y += aw * s.landHip.y;
              leg.attH.z += aw * (z - s.landHip.x * fx + s.landHip.z * fz + fz * ahead);
              attW += aw;
            }
          } else {
            const st = stanceAt(swings, a.action.time, a.duration);
            let pin = 0;
            if (st) {
              const s = st.swing;
              const back = (speed * st.since) / a.rate;
              footConfig(surface, base, x + s.landX * fz + s.landZ * fx - fx * back, z - s.landX * fx + s.landZ * fz - fz * back, fx, fz, s.landYaw, leg.fp, cfgOff);
            } else if (c.anchor) {
              // a clip without swings (idle) fading out: its feet stand where its clip had them
              // when it stopped driving (the anchor; the nosing shift of that spot comes out of
              // footConfig as before) and are pinned there — the along-facing offset from where
              // its sole is now (its path at the current root); the blend weights the pin by the
              // clip's weight, so the blended foot is the weighted mean of the clips' own spots
              const ax = c.anchor[i * 3];
              const az = c.anchor[i * 3 + 1];
              footConfig(surface, base, ax, az, fx, fz, c.anchor[i * 3 + 2], leg.fp, cfgOff);
              pathAt(pathTable[gait][i], a.action.time, a.duration, spotNow);
              pin = (ax - (x + spotNow.x * fz + spotNow.z * fx)) * fx + (az - (z - spotNow.x * fx + spotNow.z * fz)) * fz;
            } else footConfig(surface, base, leg.soleP.x, leg.soleP.z, fx, fz, leg.yawRel, leg.fp, cfgOff);
            foot = cfgOff.support;
            sh = cfgOff.shift + pin;
            pt = cfgOff.pitch;
            predPin += weight * pin;
            rootOff += weight * foot;
            rootLand += weight * foot;
          }
          predFoot += weight * foot;
          predShift += weight * sh;
          predPitch += weight * pt;
          clearW += weight * cw;
          lipW += weight * lw;
          wsum += weight;
        }
        if (wsum > 0) {
          predFoot /= wsum;
          predShift /= wsum;
          predPin /= wsum;
          predPitch /= wsum;
          clearW /= wsum;
          lipW /= wsum;
          rootOff /= wsum;
          rootLand /= wsum;
          travelBack /= wsum;
          travelFwd /= wsum;
          if (swingW > 0) phase /= swingW;
          if (relW > 0) {
            leg.relA.divideScalar(relW);
            leg.relH.divideScalar(relW);
            relW /= wsum;
          }
          if (attW > 0) {
            leg.attA.divideScalar(attW);
            leg.attH.divideScalar(attW);
            attW /= wsum;
          }
        } else {
          footConfig(surface, base, leg.soleP.x, leg.soleP.z, fx, fz, leg.yawRel, leg.fp, cfgOff);
          predFoot = rootOff = rootLand = cfgOff.support;
          predShift = cfgOff.shift;
          predPitch = cfgOff.pitch;
        }
        leg.shift = predShift;
        leg.pin = predPin;
        leg.pitch = predPitch;
        leg.rootOff = rootOff;
        leg.rootLand = rootLand;
        leg.phase = phase;
        leg.swingW = swingW;
        leg.relW = relW;
        leg.attW = attW;
        // the geometric lifts on the shifted footprint at the foot's current yaw: the CLEAR arc
        // over a riser ahead (blended by phase) and the LIP lift (exact at both ends of a swing),
        // both seeing only the edges within this swing's travel
        footReach(leg.fp, leg.yawRel, leg.cfg);
        const sx = leg.soleP.x + fx * predShift;
        const sz = leg.soleP.z + fz * predShift;
        const back = leg.cfg.back;
        const ahead = leg.cfg.ahead;
        _reach.fwd = travelFwd;
        _reach.back = travelBack;
        let clear = sinkFootprint(surface, sx, sz, fx, fz, back, ahead, SWING_LAMBDAS);
        if (clearW > 1e-4) clear += (liftFootprint(surface, sx, sz, fx, fz, back, ahead, CLEAR_FWD, false, CLEAR_STEP, _reach) - clear) * clearW;
        if (lipW > 1e-4) {
          const lip = liftFootprint(surface, sx, sz, fx, fz, back, ahead, LIP_RUNOUT, true, LIP_STEP, _reach);
          if (lip > clear) clear += (lip - clear) * lipW;
        }
        leg.g = Math.max(predFoot, clear);
      }

      // 3. root: each leg's root support eases over its swing from the double-support level at
      // take-off to the one at heel-strike — min(take-off support, the OTHER foot's level) to
      // min(landing support, the other foot's level) — so the root moves by at most one level per
      // swing however far the foot goes (a two-tread stride moves the foot 0.54 m, the root 0.27),
      // and descends in step with the foot (by DESC_END) so the landing leg is never asked to
      // reach a tread the root has not come down to. A foot in stance holds its support. The root
      // stands on the lower of the two (a leg is only ever bent).
      for (let i = 0; i < 2; i++) {
        const leg = legs[i];
        const other = legs[1 - i];
        const level = other.rootOff + (other.rootLand - other.rootOff) * MathUtils.smoothstep(other.phase, 0, 1);
        const r0 = Math.min(leg.rootOff, level);
        const r1 = Math.min(leg.rootLand, level);
        const ease = MathUtils.smoothstep(leg.phase, 0, r1 < r0 ? DESC_END : 1);
        leg.gRoot = leg.swingW > 0 ? r0 + (r1 - r0) * ease : leg.rootOff;
        leg.rootAtOff = r0;
        leg.rootAtLand = r1;
      }
      const gMin = Math.min(legs[0].gRoot, legs[1].gRoot);
      const shift = gMin - soleMin;
      root.position.y += shift;
      for (const leg of legs) {
        leg.hip.y += shift;
        leg.kneeP.y += shift;
        leg.ankleP.y += shift;
        leg.soleP.y += shift;
      }

      // 4. per-foot targets: raise the sole by its support's excess over the root support, move
      // it by its shift along the facing, keep the clip's foot orientation, tilt a contact sole
      // onto the local slope and pitch it over a nosing; the ankle target follows from the
      // re-oriented foot
      let maxCorrection = 0;
      let maxShift = 0;
      let maxPin = 0;
      let maxHold = 0;
      let extraDrop = 0;
      let attackDrop = 0;
      for (const leg of legs) {
        // the sole onto its support plus the clip's lift above the root's floor, the lift
        // flattened where that would fold the leg (FOLD_MAX) — never below the support itself,
        // and never so far that the sole's lowest point (in the clip's own foot orientation — a
        // toe-off has the toe down and the heel up) would go under it: the flattening floor is
        // support + hold, the marker's height above that point. A stance foot (lift 0) is never
        // raised by it, and on flat ground FOLD_MAX never binds, so this only acts where a swing
        // arc is flattened onto a tread the root has left.
        const lift = leg.soleP.y - gMin;
        let hold = 0;
        for (const c of leg.fpLocal) {
          _p.copy(c).sub(leg.sole).applyQuaternion(leg.qAnkle);
          if (-_p.y > hold) hold = -_p.y;
        }
        const floor = Math.max(leg.g, gMin + FOLD_MAX);
        const target = Math.min(leg.g + lift, Math.max(leg.g + hold, gMin + FOLD_MAX));
        leg.hold = Math.max(0, target - Math.min(leg.g + lift, floor));
        if (leg.hold > maxHold) maxHold = leg.hold;
        leg.delta = MathUtils.clamp(target - leg.soleP.y, -MAX_CORRECTION, MAX_CORRECTION);
        leg.tiltAngle = groundTilt(ground, leg.soleP.x, leg.soleP.z, leg.contact, leg.qTilt);
        if (Math.abs(leg.pitch) > 1e-5) {
          // toe-down about the foot's lateral axis: a positive turn about up × forward takes the
          // toe (+forward) down and the heel up
          _v.copy(leg.fwdLocal).applyQuaternion(leg.qAnkle);
          _v.y = 0;
          if (_v.lengthSq() > 1e-8) {
            _v.normalize();
            _n.crossVectors(_axisY, _v);
            _qPitch.setFromAxisAngle(_n, leg.pitch);
            leg.qTilt.premultiply(_qPitch);
            leg.tiltAngle += Math.abs(leg.pitch);
          }
        }
        leg.active = Math.abs(leg.delta) > 1e-6 || leg.tiltAngle > 1e-5 || Math.abs(leg.shift) > 1e-6;
        if (Math.abs(leg.shift - leg.pin) > maxShift) maxShift = Math.abs(leg.shift - leg.pin);
        const reach = (leg.kneeP.distanceTo(leg.hip) + leg.ankleP.distanceTo(leg.kneeP)) * MAX_REACH;
        if (leg.relW > 1e-4) {
          // a leg that has just taken off: the drop its planted foot needed at toe-off (the
          // frozen stance configuration against the hip of that moment, the root on that
          // moment's floor) is released over RELEASE of the swing rather than vanishing the frame
          // the foot lifts. Exactly the stance rule's own value, so on flat ground (no clip's leg
          // reaches MAX_REACH in stance) it is zero like the stance's.
          _v.set(leg.relA.x - leg.relH.x, leg.relA.y - (leg.rootAtOff + leg.relH.y), leg.relA.z - leg.relH.z);
          const flat2 = reach * reach - _v.x * _v.x - _v.z * _v.z;
          if (flat2 > 0) {
            const drop = (-_v.y - Math.sqrt(flat2)) * leg.relW;
            if (drop > extraDrop) extraDrop = drop;
          }
        }
        if (leg.attW > 1e-4) {
          // a leg about to land: the drop its landing configuration will need (the shifted spot
          // on its support against the hip of the clip's heel-strike pose, the root on the floor
          // at landing) is taken up over the last ATTACK of the swing rather than appearing in
          // the frame the foot plants (see ATTACK). The stance rule's own value at phase 1.
          _v.set(leg.attA.x - leg.attH.x, leg.attA.y - (leg.rootAtLand + leg.attH.y), leg.attA.z - leg.attH.z);
          const flat2 = reach * reach - _v.x * _v.x - _v.z * _v.z;
          if (flat2 > 0) {
            const drop = (-_v.y - Math.sqrt(flat2)) * leg.attW;
            if (drop > attackDrop) attackDrop = drop;
            if (drop > extraDrop) extraDrop = drop;
          }
        }
        if (!leg.active) {
          leg.target.copy(leg.ankleP);
          continue;
        }
        _q.multiplyQuaternions(leg.qTilt, leg.qAnkle);
        leg.target.copy(leg.sole).applyQuaternion(_q);
        leg.target.set(leg.soleP.x + fx * leg.shift - leg.target.x, leg.soleP.y + leg.delta - leg.target.y, leg.soleP.z + fz * leg.shift - leg.target.z);
        _v.subVectors(leg.target, leg.hip);
        if (Math.abs(leg.pin) > 1e-6 && _v.lengthSq() > reach * reach) {
          // the idle pin may not hold a foot past the straight leg — the trailing foot of the
          // first step is at full reach in the walk's own toe-off pose, and pinning it further
          // back would drop the root by the shortfall and pop it back when the foot lifts (11 mm
          // on flat ground): the pin is shortened along the facing to where the target meets
          // the reach sphere (the foot slides that little instead). Closed form — |v − s·p|² =
          // reach² in the pin fraction s given up — and continuous in every input: with no
          // crossing, the nearest point of the segment; what is still short falls to the extra
          // drop below like any shifted stance.
          const px = fx * leg.pin;
          const pz = fz * leg.pin;
          const a = px * px + pz * pz;
          const b = -2 * (_v.x * px + _v.z * pz);
          const c = _v.lengthSq() - reach * reach;
          const disc = b * b - 4 * a * c;
          const s = MathUtils.clamp(disc >= 0 ? (-b - Math.sqrt(disc)) / (2 * a) : -b / (2 * a), 0, 1);
          leg.target.x -= s * px;
          leg.target.z -= s * pz;
          leg.shift -= s * leg.pin;
          leg.pin -= s * leg.pin;
          _v.subVectors(leg.target, leg.hip);
        }
        if (Math.abs(leg.pin) > maxPin) maxPin = Math.abs(leg.pin);
        // a target beyond the straight leg (a tilted foot moves the ankle sideways): the root
        // comes down by the shortfall instead of the leg stretching
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
      // shin's IK rotation on the foot and adds the slope tilt / nosing pitch (both in the knee frame)
      let reachExcess = 0;
      let reachLeg: 'L' | 'R' | null = null;
      for (const leg of legs) {
        if (!leg.active) continue;
        const excess = solveLeg(leg, leg.target, _qIk);
        if (excess > reachExcess) {
          reachExcess = excess;
          reachLeg = leg.side;
        }
        _qInv.copy(_qIk).invert();
        _q2.copy(leg.qKnee).invert().multiply(_qInv).multiply(leg.qTilt).multiply(leg.qKnee);
        leg.anklePivot.quaternion.copy(_q2);
        const raised = Math.abs(leg.delta) + extraDrop;
        if (raised > maxCorrection) maxCorrection = raised;
      }
      root.updateMatrixWorld(true);

      // 6. report: both soles as posed against the exact surface under their contact point — the
      // marker, or when that is off its ground by more than CONTACT_OFF (a toe on a tread edge, a
      // heel over the one below) the footprint point nearest its ground — their supports, and the
      // smallest gap over the boot's footprint (corners, heel / toe centres) to the rendered
      // surface under each. The contact point handed out is the sole nearest its ground (the
      // procedural plantFeet's rule, so samplePositions.feet reads the same foot; ties go to the
      // foot the root stands on)
      for (let i = 0; i < 2; i++) {
        const leg = legs[i];
        leg.soleP.copy(leg.sole).applyMatrix4(leg.ankle.matrixWorld);
        leg.contactOff = 0;
        leg.contactGround = surface(leg.soleP.x, leg.soleP.z);
        if (Math.abs(leg.soleP.y - leg.contactGround) > CONTACT_OFF) {
          for (const o of [-leg.fp.heel, leg.fp.toe]) {
            const gp = surface(leg.soleP.x + fx * o, leg.soleP.z + fz * o);
            if (Math.abs(leg.soleP.y - gp) < Math.abs(leg.soleP.y - leg.contactGround)) {
              leg.contactGround = gp;
              leg.contactOff = o;
            }
          }
        }
        let minShoe = leg.soleP.y - leg.contactGround;
        for (const c of leg.fpLocal) {
          _p.copy(c).applyMatrix4(leg.ankle.matrixWorld);
          const gap = _p.y - surface(_p.x, _p.z);
          if (gap < minShoe) minShoe = gap;
        }
        feet[i].soleY = leg.soleP.y;
        feet[i].groundY = leg.contactGround;
        feet[i].gapM = leg.soleP.y - leg.contactGround;
        feet[i].supportY = leg.g;
        feet[i].minShoeGapM = minShoe;
        feet[i].shiftM = leg.shift - leg.pin;
        feet[i].pitchRad = leg.pitch;
        feet[i].correctionM = leg.delta;
        feet[i].pinM = leg.pin;
        feet[i].holdM = leg.hold;
      }
      const reported = Math.abs(feet[1 - lower].gapM) < Math.abs(feet[lower].gapM) - REPORT_TIE ? legs[1 - lower] : legs[lower];
      plant.maxCorrectionM = maxCorrection;
      plant.rootShiftM = root.position.y - placed;
      plant.planted = reported.side;
      plant.reachClamped = reachExcess > REACH_TOL;
      plant.reachClampedLeg = reachLeg;
      plant.reachExcessM = reachExcess;
      plant.maxShiftM = maxShift;
      plant.extraDropM = extraDrop;
      plant.attackDropM = Math.min(attackDrop, MAX_CORRECTION);
      plant.maxPinM = maxPin;
      plant.maxHoldM = maxHold;
      plant.blendClips = blendClips;
      contact.set(reported.soleP.x + fx * reported.contactOff, reported.soleP.y, reported.soleP.z + fz * reported.contactOff);
    },
    headTop(out) {
      return head.localToWorld(out.set(0, headTopOffset, 0));
    },
    feetContact: () => feet.map((f) => ({ ...f })),
    plantInfo: () => ({ ...plant }),
    blink() {
      const first = blinkMeshes[0];
      const inf = first?.mesh.morphTargetInfluences;
      return {
        morphMeshes: blinkMeshes.length,
        phase: blinkState.phase,
        weights: { ...blinkW },
        applied: first && inf ? { blink: first.iBlink >= 0 ? inf[first.iBlink] : 0, blinkHalf: first.iHalf >= 0 ? inf[first.iHalf] : 0 } : null,
        nextT: nextBlinkStart(blinkSchedule, blinkState.t),
        runT: blinkState.runT,
        schedule: { ...blinkSchedule },
      };
    },
    anchor(x, z, yaw, gait, clipShift, t) {
      const a = actions.get(gait);
      if (!a) return null;
      const tau = clipTimeOf(gait, t, clipShift);
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const out: number[] = [];
      for (let i = 0; i < 2; i++) {
        pathAt(pathTable[gait][i], tau, a.duration, spotNow);
        out.push(x + spotNow.x * fz + spotNow.z * fx, z - spotNow.x * fx + spotNow.z * fz, spotNow.yaw);
      }
      return out as FootAnchor;
    },
    alignClip(from, fromShift, to, t) {
      const a = actions.get(to);
      if (!a || !tables[to][0].length) return 0;
      const phase = actions.has(from) ? gaitPhase(tables[from][0], clipTimeOf(from, t, fromShift), actions.get(from)!.duration) : NaN;
      // from a clip without phases (idle) start at the left heel-strike: both feet down
      const target = gaitPhaseTime(tables[to][0], Number.isNaN(phase) ? 1 : phase, a.duration);
      return mod(target - clipTimeOf(to, t), a.duration);
    },
  };
  return puppet;
}
