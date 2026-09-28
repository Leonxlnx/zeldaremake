// The edit. Single source of truth for timing: shots, cuts, freeze frames, FX beats.
// Everything (camera, animation, 2D FX, look params, audio cues, rubric) keys off this file.
//
// Master rate is 24 fps. "On 2s" means the pose update interval is 2 frames of that
// master, per the Imageworks convention (research §6.1) - it is never a playback rate.

export const FPS = 24;
export const DURATION_FRAMES = 240;
export const ASPECT = 2.39;
export const OUT_WIDTH = 1920;
export const OUT_HEIGHT = 803; // 1920 / 2.39 = 803.3 -> matches the measured reference picture height

/**
 * Shots. `start` is inclusive, `end` is exclusive, both in master frames.
 * `world` selects the palette / line-style preset (see look/params.js).
 */
export const SHOTS = [
  {
    id: 'A',
    name: 'THE SIGHTING',
    start: 0,
    end: 36,
    world: 'tabletop',
    lens: 21, // mm-equivalent; very wide, per research §10.2
    dutch: -3.5,
    note: 'Extreme low wide. Ant crests the sugar packet ridge, spots the crumb across the table.',
  },
  {
    id: 'B',
    name: 'THE SPRINT',
    start: 36,
    end: 80,
    world: 'tabletop',
    lens: 28,
    dutch: 6.0,
    note: 'Side-on truck. Ant sprints left to right, legs on 2s with smears, camera on 1s.',
  },
  {
    id: 'C',
    name: 'INTO LENS',
    start: 80,
    end: 114,
    world: 'tabletop',
    lens: 16,
    dutch: -8.0,
    note: 'Ant charges the lens. A shadow sweeps over; it looks up.',
  },
  {
    id: 'D',
    name: 'THE CUP',
    start: 114,
    end: 138,
    world: 'eclipse',
    lens: 18,
    dutch: 11.0,
    note: 'Up-angle hero. The diner mug descends and eclipses the pendant lamp. Crackle rim.',
  },
  {
    id: 'E',
    name: 'SLAM',
    start: 138,
    end: 158,
    world: 'impact',
    lens: 24,
    dutch: -14.0,
    note: 'Impact. Graphical flash frames, KRAKOOM, coffee splash, shockwave, 3-panel split, channel tear.',
  },
  {
    id: 'F',
    name: 'THE SWERVE',
    start: 158,
    end: 202,
    world: 'tabletop',
    lens: 20,
    dutch: 9.0,
    note: 'Skid, plant, wall-run up and around the mug, launch off the rim in a graphic arc. Punk style break mid-run.',
  },
  {
    id: 'G',
    name: 'THE GRAB',
    start: 202,
    end: 240,
    world: 'payoff',
    lens: 26,
    dutch: -2.0,
    note: 'Land, slide, snatch the crumb, hero pose, freeze into a comic panel with title lockup.',
  },
];

/** Frame -> shot. */
export function shotAt(frame) {
  for (const s of SHOTS) if (frame >= s.start && frame < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

/** Local frame within the shot, and normalised 0..1 progress. */
export function shotLocal(frame) {
  const s = shotAt(frame);
  const f = frame - s.start;
  return { shot: s, f, t: f / (s.end - s.start), seconds: f / FPS };
}

/**
 * Per-partition frame-rate stepping (research §6.2-6.4).
 * `step` = pose update interval in master frames; `phase` offsets partitions so they
 * do not all pop on the same frame.
 */
export const STEP_SETS = {
  camera: { step: 1, phase: 0 }, // camera always on 1s
  ant: { step: 2, phase: 0 }, // hero on 2s...
  antFast: { step: 1, phase: 0 }, // ...dropping to 1s for the fastest action
  antennae: { step: 3, phase: 1 }, // per-part rates, Hobie Brown rule
  mug: { step: 2, phase: 1 },
  debris: { step: 2, phase: 1 },
  fx2d: { step: 2, phase: 0 }, // hand-drawn FX always on 2s
  ink: { step: 2, phase: 0 }, // ink-line redraw interval floor
  dust: { step: 3, phase: 2 },
};

/** Frames on which the hero drops to 1s: the fastest action (research §6.3). */
export const ANT_ONES_RANGES = [
  [138, 158], // the slam reaction
  [166, 196], // the swerve and vault
];

export function antStep(frame) {
  for (const [a, b] of ANT_ONES_RANGES) if (frame >= a && frame < b) return STEP_SETS.antFast;
  return STEP_SETS.ant;
}

/** Quantise a time to a partition's hold, per research §6.4. */
export function heldFrame(frame, step, phase = 0) {
  return Math.floor((frame - phase) / step) * step + phase;
}

/**
 * Freeze frames. The beauty buffer holds but the screens, grain and 2D FX keep running,
 * so a frozen panel never reads as a pasted still (research §10.3).
 */
export const FREEZES = [
  { start: 24, end: 30, source: 24, label: 'sighting' },
  { start: 228, end: 240, source: 228, label: 'payoff' },
];

/**
 * Graphical flash frames (reference: ITSV "graphical flash frames"). The render is replaced by a
 * flat colour field with dark silhouettes and line screens for these frames only.
 */
export const FLASH_FRAMES = [
  { start: 138, end: 140, field: '#FF6B5A', silhouette: '#12061C', accent: '#FFE033' },
  { start: 141, end: 142, field: '#FFE033', silhouette: '#12061C', accent: '#FF2E88' },
];

export function flashAt(frame) {
  for (const f of FLASH_FRAMES) if (frame >= f.start && frame < f.end) return f;
  return null;
}

export function freezeAt(frame) {
  for (const f of FREEZES) if (frame >= f.start && frame < f.end) return f;
  return null;
}

/** The frame whose geometry should actually be evaluated (accounts for freezes). */
export function sourceFrame(frame) {
  const f = freezeAt(frame);
  return f ? f.source : frame;
}

/**
 * Comic-panel layouts. `t` ramps the panel in; while a split is active the scene is
 * rendered once per panel from its own camera offset.
 */
export const PANELS = [
  {
    start: 24,
    end: 36,
    kind: 'caption',
    rects: [[0.0, 0.0, 1.0, 1.0]],
    caption: 'ONE CRUMB.',
    captionIn: 26,
  },
  {
    start: 142,
    end: 158,
    kind: 'split3',
    rects: [
      [0.0, 0.0, 0.36, 1.0],
      [0.37, 0.0, 0.29, 1.0],
      [0.67, 0.0, 0.33, 1.0],
    ],
    camOffsets: [
      { pos: [-0.9, 0.35, 0.4], look: [0, 0.1, 0], lens: 20 },
      { pos: [0.5, 1.1, -0.7], look: [0, 0.2, 0], lens: 35 },
      { pos: [0.8, 0.12, 0.9], look: [0, 0.05, 0], lens: 18 },
    ],
  },
  {
    start: 228,
    end: 240,
    kind: 'hero',
    rects: [[0.06, 0.08, 0.88, 0.84]],
    caption: 'CRUMB.',
    captionIn: 231,
  },
];

export function panelsAt(frame) {
  return PANELS.filter((p) => frame >= p.start && frame < p.end);
}

/**
 * Hand-lettered onomatopoeia. Held on the beat, animated on 2s, with a pop-in
 * overshoot and a hold. `anchor` is in normalised screen space.
 */
export const LETTERING = [
  { text: 'SKITT', start: 40, end: 52, anchor: [0.30, 0.66], rot: -9, scale: 0.16, style: 'light', color: 'cyan' },
  { text: 'SKITT', start: 58, end: 70, anchor: [0.62, 0.30], rot: 7, scale: 0.14, style: 'light', color: 'cyan' },
  { text: 'KRAKOOM', start: 139, end: 162, anchor: [0.5, 0.52], rot: -6, scale: 0.42, style: 'heavy', color: 'magenta' },
  { text: 'SKRRT', start: 163, end: 180, anchor: [0.33, 0.34], rot: 12, scale: 0.24, style: 'medium', color: 'yellow' },
  { text: 'VWOOP', start: 186, end: 202, anchor: [0.68, 0.64], rot: -14, scale: 0.26, style: 'medium', color: 'cyan' },
  { text: 'SNATCH', start: 220, end: 234, anchor: [0.56, 0.42], rot: 5, scale: 0.28, style: 'heavy', color: 'white' },
];

/**
 * 2D FX beats. `kind` maps to a generator in scene/fx2d.js.
 * All of these are drawn on 2s with bold graphic shape language (research §8).
 */
export const FX_BEATS = [
  { kind: 'radialBurst', start: 24, end: 34, anchor: [0.66, 0.46], scale: 0.5, color: 'yellow' },
  { kind: 'speedLines', start: 36, end: 80, dir: 'horizontal', density: 0.55, color: 'cyan' },
  { kind: 'zipRibbon', start: 40, end: 80, follow: 'ant', color: 'magenta' },
  { kind: 'speedLines', start: 84, end: 114, dir: 'radial', density: 0.7, color: 'white' },
  { kind: 'crackle', start: 118, end: 140, anchor: [0.5, 0.62], scale: 0.9, color: 'cyan' },
  { kind: 'glitchTear', start: 130, end: 136, amount: 0.8 },
  { kind: 'impactFlash', start: 138, end: 144, anchor: [0.5, 0.35] },
  { kind: 'coffeeSplash', start: 140, end: 160, anchor: [0.5, 0.8], scale: 1.0, color: 'coffee' },
  { kind: 'radialBurst', start: 138, end: 152, anchor: [0.5, 0.35], scale: 1.5, color: 'white' },
  { kind: 'shockRing', start: 139, end: 158, anchor: [0.5, 0.33] },
  { kind: 'glitchTear', start: 141, end: 147, amount: 1.0 },
  { kind: 'debrisSpray', start: 140, end: 168, anchor: [0.5, 0.33] },
  { kind: 'speedLines', start: 160, end: 176, dir: 'radial', density: 0.5, color: 'yellow' },
  { kind: 'arcRibbon', start: 176, end: 202, color: 'cyan' },
  { kind: 'styleBreak', start: 176, end: 184, style: 'punk' },
  { kind: 'sparkle', start: 220, end: 240, anchor: [0.56, 0.44], scale: 0.7 },
  { kind: 'radialBurst', start: 228, end: 240, anchor: [0.56, 0.44], scale: 1.1, color: 'yellow' },
];

export function fxAt(frame) {
  return FX_BEATS.filter((f) => frame >= f.start && frame < f.end);
}

export function letteringAt(frame) {
  return LETTERING.filter((l) => frame >= l.start && frame < l.end);
}

/** Audio cue sheet. Consumed by tools/audio/score.py; times derive from the same beats. */
export const AUDIO_CUES = [
  { at: 0, cue: 'roomTone', dur: 240 },
  { at: 0, cue: 'scoreIn' },
  { at: 10, cue: 'antTwitch' },
  { at: 24, cue: 'stingerSpot' },
  { at: 24, cue: 'whoosh', intensity: 0.4 },
  { at: 36, cue: 'cutWhip' },
  { at: 36, cue: 'sprintLoop', dur: 44 },
  { at: 80, cue: 'cutWhip' },
  { at: 80, cue: 'sprintLoop', dur: 30 },
  { at: 104, cue: 'shadowRiser' },
  { at: 114, cue: 'cutWhip' },
  { at: 114, cue: 'mugDescend' },
  { at: 130, cue: 'glitch' },
  { at: 138, cue: 'slam' },
  { at: 138, cue: 'subDrop' },
  { at: 139, cue: 'ceramicRing' },
  { at: 140, cue: 'coffeeSplash' },
  { at: 141, cue: 'glitch' },
  { at: 142, cue: 'debrisPatter' },
  { at: 158, cue: 'cutWhip' },
  { at: 160, cue: 'skid' },
  { at: 176, cue: 'vaultWhoosh' },
  { at: 176, cue: 'styleBreakStutter' },
  { at: 196, cue: 'landThump' },
  { at: 202, cue: 'cutWhip' },
  { at: 220, cue: 'snatch' },
  { at: 228, cue: 'freezeHit' },
  { at: 228, cue: 'sparkleTail' },
  { at: 230, cue: 'scoreOut' },
];
