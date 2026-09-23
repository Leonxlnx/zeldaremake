/**
 * The play-mode gait blend as a chain of up to three clips (round 6) — the state the character
 * system keeps per actor and the puppets read through PuppetPose, and the two pure functions on
 * it: `switchGait` (a hard switch for placement, or a crossfade starting at `t`) and `chainWeights`
 * (the clips' blend weights at `t`). Dependency-free so it runs under node (gaitChain.test.mjs).
 *
 * A crossfade fades the incoming clip in over BLEND_S with a smoothstep of the time since its
 * switch. A switch that lands while the previous crossfade is still running does not cut the
 * clip that was fading out: the gait being left moves down the chain (gaitFrom → gaitFrom2) and
 * keeps fading with its own weight — the walk → stairs switch at the foot of the flight, four
 * frames into the idle → walk fade, used to snap 81 % of an idle pose to a walk in one frame.
 * Weights: `gait` w, `gaitFrom` (1 − w)·w₂, `gaitFrom2` (1 − w)·(1 − w₂).
 *
 * The incoming clip's `clipShift` is chosen by the caller's `align` so it starts at the gait
 * phase of the nearest clip in the chain that has one (idle has none); a clip that is already
 * in the chain keeps its shift, so the same clip never needs two clip times. A gait without
 * ground speed (idle) has no stance spots of its own to freeze, so where its soles are at the
 * switch is recorded (`anchorFrom`; the caller's `anchor`) and the puppet keeps them planted
 * there while it fades.
 *
 * Round 8b — the run-start blink is a one-shot EVENT the chain records (`runBlinkT`): a
 * crossfade into `run` starts one at the switch time unless the previous one is still running
 * (`hooks.blinkS`, the envelope length), and nothing else the gait does afterwards touches it —
 * a release to idle two frames later, a second run start inside the envelope, toggles every few
 * frames all leave the one envelope running to completion as a function of (t − runBlinkT).
 * Astra's reproduction (PR #10): the closure was read only while the gait WAS run, so a release
 * at full closure snapped the lids open in one frame. A hard switch (t null: placement, the
 * captures) clears it; the character system also clears it on a simulation-time jump.
 */
import type { Gait } from './animation';

/** play-mode gait crossfade length (s) */
export const BLEND_S = 0.18;

/** a clip's soles at a moment: world x, z and the foot yaw relative to the facing, L then R */
export type FootAnchor = [number, number, number, number, number, number] | null;

export interface GaitChain {
  gait: Gait;
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
  /** the gait before `gaitFrom`, the time `gaitFrom` took over from it and its clip shift */
  gaitFrom2: Gait;
  gaitSwitchT2: number;
  clipShiftFrom2: number;
  /**
   * Where `gaitFrom` / `gaitFrom2` had their soles when they stopped driving, when that clip has
   * no gait phases (idle) — its feet stay planted there while it fades; null for a clip with a
   * swing table (its stance spots freeze themselves).
   */
  anchorFrom: FootAnchor;
  anchorFrom2: FootAnchor;
  /**
   * Simulation time the current run-start blink event began (blink.ts: its envelope runs from
   * here to completion whatever the gait does next); −Infinity = none. Set by a crossfade into
   * run when no event is running, cleared by a hard switch or a time jump.
   */
  runBlinkT: number;
}

export function hardChain(gait: Gait): GaitChain {
  return { gait, gaitFrom: gait, gaitSwitchT: -Infinity, clipShift: 0, clipShiftFrom: 0, gaitFrom2: gait, gaitSwitchT2: -Infinity, clipShiftFrom2: 0, anchorFrom: null, anchorFrom2: null, runBlinkT: -Infinity };
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** the fade-in weight of a clip switched to at `switchT`: a smoothstep over BLEND_S, 1 for a hard switch (−Infinity) or a finished fade */
export function fadeIn(t: number, switchT: number): number {
  const dt = t - switchT;
  if (!(dt >= 0 && dt < BLEND_S)) return 1;
  return smoothstep(dt / BLEND_S);
}

/**
 * The blend weights at `t` of `gait`, `gaitFrom` and `gaitFrom2` (into `out`, summing to 1); a
 * clip the puppet lacks (`has`) or one equal to the entry above folds its weight upward. Returns
 * how many entries have weight.
 */
export function chainWeights(c: GaitChain, t: number, has: (gait: Gait) => boolean, out: [number, number, number]): number {
  const w = c.gaitFrom === c.gait || !has(c.gaitFrom) ? 1 : fadeIn(t, c.gaitSwitchT);
  const w2 = w >= 1 || c.gaitFrom2 === c.gaitFrom || !has(c.gaitFrom2) ? 1 : fadeIn(t, c.gaitSwitchT2);
  out[0] = w;
  out[1] = (1 - w) * w2;
  out[2] = (1 - w) * (1 - w2);
  let n = 0;
  for (const v of out) if (v > 0) n++;
  return n;
}

export interface SwitchHooks {
  /** clip-time shift for `to` at `t` so it is at the gait phase `from` (shifted by `fromShift`) has */
  align?: (from: Gait, fromShift: number, to: Gait, t: number) => number;
  /** the soles of `gait` (shifted) at `t`, for a gait without phases being left */
  anchor?: (gait: Gait, clipShift: number, t: number) => FootAnchor;
  /** true for a gait with ground speed (a swing table and a gait phase) */
  hasPhase: (gait: Gait) => boolean;
  /** length (s) of the run-start blink envelope: a crossfade into run starts an event at t unless one began less than this ago; absent = no run-start blinks */
  blinkS?: number;
}

/**
 * Switch `c` to `gait`: hard (t null — the clips at their hero alignment, no fade) or as a
 * crossfade starting at `t`. No-op for a crossfade into the current gait.
 */
export function switchGait(c: GaitChain, gait: Gait, t: number | null, hooks: SwitchHooks): void {
  if (gait === c.gait && t !== null) return;
  if (t === null) {
    c.gaitFrom = gait;
    c.gaitSwitchT = -Infinity;
    c.clipShift = 0;
    c.clipShiftFrom = 0;
    c.gaitFrom2 = gait;
    c.gaitSwitchT2 = -Infinity;
    c.clipShiftFrom2 = 0;
    c.anchorFrom = null;
    c.anchorFrom2 = null;
    c.runBlinkT = -Infinity;
    c.gait = gait;
    return;
  }
  // a run starts with a blink — one event, never restarted while the previous one still runs
  if (gait === 'run' && hooks.blinkS !== undefined && !(t - c.runBlinkT < hooks.blinkS)) c.runBlinkT = t;
  // the crossfade into the gait being left is still running: its own source keeps fading
  const chained = t - c.gaitSwitchT < BLEND_S;
  c.gaitFrom2 = c.gaitFrom;
  c.gaitSwitchT2 = c.gaitSwitchT;
  c.clipShiftFrom2 = c.clipShiftFrom;
  c.anchorFrom2 = c.anchorFrom;
  c.gaitFrom = c.gait;
  c.gaitSwitchT = t;
  c.clipShiftFrom = c.clipShift;
  c.anchorFrom = hooks.hasPhase(c.gait) ? null : hooks.anchor?.(c.gait, c.clipShift, t) ?? null;
  if (chained && gait === c.gaitFrom2) c.clipShift = c.clipShiftFrom2;
  else {
    const [from, shift] = hooks.hasPhase(c.gaitFrom) || !hooks.hasPhase(c.gaitFrom2) ? [c.gaitFrom, c.clipShiftFrom] : [c.gaitFrom2, c.clipShiftFrom2];
    c.clipShift = hooks.align?.(from, shift, gait, t) ?? 0;
  }
  c.gait = gait;
}
