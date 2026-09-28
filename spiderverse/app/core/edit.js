// THE EDIT. Single source of truth for timing of "Into the Ant-Verse".
// Owner: EDIT (story/edit). Everyone else reads it; nobody else writes it.
//
// 24 fps master. "On 2s" = a pose held for 2 master frames (research SS6.1); it is a pose
// update interval, never a playback rate. Shot frame ranges are [start, end) in master frames.
// Shot modules work in LOCAL frames 0..(end-start-1) and must read their duration from here,
// so a retime never requires editing a shot's code.

export const TITLE = 'INTO THE ANT-VERSE';
export const FPS = 24;
export const WIDTH = 1920;
export const HEIGHT = 804; // even height (H.264 yuv420p); 1920/804 = 2.388:1
export const ASPECT = WIDTH / HEIGHT;

/**
 * lens: suggested full-frame-equivalent focal length in mm (36 mm horizontal gate).
 * height: suggested camera height above the local ground in mm (ant scale: 2-15 mm is "eye level").
 * transitionIn: how this shot is entered - 'cut' | 'whip' | 'match' | 'panelWipe' | 'inkWipe' | 'smashCut' | 'fadeIn'
 */
export const SHOTS = [
  { id: 'S01', name: 'ESTABLISH', act: 1, start: 0, end: 120, lens: 18, height: 12, transitionIn: 'fadeIn', world: 'kitchenNight' },
  { id: 'S02', name: 'THE PROMISE', act: 1, start: 120, end: 264, lens: 35, height: 5, transitionIn: 'match', world: 'nest' },
  { id: 'S03', name: 'LOOKOUT', act: 1, start: 264, end: 432, lens: 24, height: 4, transitionIn: 'cut', world: 'kitchenNight' },
  { id: 'S04', name: 'THE RUN', act: 2, start: 432, end: 552, lens: 28, height: 3, transitionIn: 'whip', world: 'counter' },
  { id: 'S05', name: 'THE CLIMB', act: 2, start: 552, end: 696, lens: 20, height: 6, transitionIn: 'cut', world: 'board' },
  { id: 'S06', name: 'EXTRACTION', act: 2, start: 696, end: 900, lens: 40, height: 22, transitionIn: 'cut', world: 'board' },
  { id: 'S07', name: 'SHADOW', act: 2, start: 900, end: 1008, lens: 16, height: 2, transitionIn: 'cut', world: 'eclipse' },
  { id: 'S08', name: 'SLAM', act: 3, start: 1008, end: 1128, lens: 24, height: 8, transitionIn: 'smashCut', world: 'impact' },
  { id: 'S09', name: 'CHASE', act: 3, start: 1128, end: 1296, lens: 21, height: 3, transitionIn: 'cut', world: 'counter' },
  { id: 'S10', name: 'SPONGE', act: 3, start: 1296, end: 1440, lens: 18, height: 4, transitionIn: 'whip', world: 'counter' },
  { id: 'S11', name: 'WALL-RUN', act: 3, start: 1440, end: 1728, lens: 20, height: 10, transitionIn: 'cut', world: 'mug' },
  { id: 'S12', name: 'TORRENT', act: 4, start: 1728, end: 1872, lens: 24, height: 6, transitionIn: 'cut', world: 'water' },
  { id: 'S13', name: 'LOST', act: 4, start: 1872, end: 2016, lens: 50, height: 3, transitionIn: 'cut', world: 'lost' },
  { id: 'S14', name: 'THE IDEA', act: 4, start: 2016, end: 2160, lens: 28, height: 3, transitionIn: 'match', world: 'water' },
  { id: 'S15', name: 'THE BOAT', act: 4, start: 2160, end: 2304, lens: 18, height: 4, transitionIn: 'whip', world: 'water' },
  { id: 'S16', name: 'THE DROP', act: 5, start: 2304, end: 2424, lens: 21, height: 14, transitionIn: 'cut', world: 'rescue' },
  { id: 'S17', name: 'THE CHAIN', act: 5, start: 2424, end: 2640, lens: 24, height: 10, transitionIn: 'cut', world: 'rescue' },
  { id: 'S18', name: 'HAUL', act: 5, start: 2640, end: 2736, lens: 32, height: 8, transitionIn: 'cut', world: 'rescue' },
  { id: 'S19', name: 'HOME', act: 6, start: 2736, end: 2880, lens: 40, height: 5, transitionIn: 'inkWipe', world: 'nestWarm' },
];

export const DURATION_FRAMES = SHOTS[SHOTS.length - 1].end; // 2880
export const DURATION_SECONDS = DURATION_FRAMES / FPS; // 120

export function shotById(id) {
  return SHOTS.find((s) => s.id === id) || null;
}

/** Global frame -> { shot, f (local frame), n (shot length), t (0..1) }. */
export function locate(frame) {
  let s = SHOTS[SHOTS.length - 1];
  for (const x of SHOTS) {
    if (frame >= x.start && frame < x.end) {
      s = x;
      break;
    }
  }
  const n = s.end - s.start;
  const f = frame - s.start;
  return { shot: s, f, n, t: n > 1 ? f / (n - 1) : 0 };
}

/** Local seconds -> local frame, for authoring beats in seconds inside a shot. */
export const sec = (s) => Math.round(s * FPS);

/**
 * Cadence (research SS6.2-6.4). `step` = pose update interval; `phase` offsets partitions so
 * they do not all pop together. Shot modules may override per beat (e.g. drop the Courier to 1s
 * for the fastest action) but must keep the camera on 1s.
 */
export const CADENCE = {
  camera: { step: 1, phase: 0 },
  courier: { step: 2, phase: 0 },
  courierFast: { step: 1, phase: 0 },
  antennae: { step: 3, phase: 1 },
  little: { step: 2, phase: 1 },
  colony: { step: 2, phase: 1 }, // crowd members alternate phase 0/1 by index
  props: { step: 2, phase: 0 },
  mug: { step: 2, phase: 1 },
  water: { step: 2, phase: 0 },
  fx2d: { step: 2, phase: 0 },
  ink: { step: 2, phase: 0 },
  punk: { step: 4, phase: 0 }, // the punk style break runs on 4s
};

/** Quantise a local frame to a partition's hold. */
export function held(f, step = 2, phase = 0) {
  if (step <= 1) return f;
  return Math.floor((f - phase) / step) * step + phase;
}

/** True if frame f repeats the pose of f-1 under this cadence (motion vectors must be zero). */
export function isHeld(f, step = 2, phase = 0) {
  return step > 1 && held(f, step, phase) === held(f - 1, step, phase);
}

/**
 * Music/sound sync points (global frames). The score and SFX key off these; shot modules
 * should land their accents on them. EDIT keeps them in sync with the shots.
 */
export const SYNC = {
  titleCard: 0,
  promiseTouch: 216, // S02 antenna touch
  crumbSpotted: 372, // S03 freeze
  runStart: 432,
  crumbPop: 804, // S06 POP
  shadowFalls: 930, // S07
  slam: 1008, // S08 contact
  crumbCaught: 1272, // S09 dive catch
  spongeIn: 1320,
  wallRunLaunch: 1608, // S11 leaves the handle
  punkBreak: [1620, 1644], // S11 style break
  landHome: 1680,
  torrent: 1776, // S12 water hits the counter
  crumbLost: 1920, // S13 crumb falls in; music drops out
  idea: 2064, // S14 idea beat
  crumbRecovered: 2268, // S15
  colonySees: 2376, // S16
  chainCatch: 2604, // S17 Little One catches her
  hauledIn: 2700, // S18
  promiseKept: 2808, // S19 antenna touch
  titleFreeze: 2832, // S19 freeze + title
  end: 2880,
};
