/**
 * Link's blink (round 8) — Astra's morph contract and the deterministic schedule that drives it.
 * Dependency-free apart from the world PRNG's stateless hash, so it runs under node
 * (blink.test.mjs); glbLink.ts applies the weights, index.ts reports them in the audit.
 *
 * Contract (her PR #2 review, 2026-09-15 19:40 / 20:15 UTC): every mesh that carries them
 * exposes two morph targets, `blink` (lids closed) and `blinkHalf` (the half-way shape). For the
 * closure phase p ∈ [0, 1] (0 open, 1 closed):
 *     blink = max(0, 2p − 1)        blinkHalf = 1 − |2p − 1|
 * so both are exactly 0 with the eyes open, blinkHalf peaks at p = ½ and blink alone is 1 at
 * p = 1. Her review timing: 70 ms closing, 30 ms closed, 120 ms opening — BLINK_S = 0.22 s; the
 * envelope ramps p linearly (the two-target chain is the shape interpolation).
 *
 * Schedule — a pure function of the SIMULATION time (no state, no wall clock): a zero-dt update
 * re-derives the same weights and a `setTime()` jump reproduces the frame. Blink k starts at
 *     BLINK_ORIGIN_S + k · BLINK_SLOT_S + BLINK_JITTER_S · (2 · h(k) − 1)
 * with h(k) ∈ [0, 1) the PRNG's `hash2` of the slot index under the schedule's seed (the world
 * seed, index.ts), so consecutive blinks are SLOT ± 2 · JITTER = 3.5 … 6.0 s apart. The grid
 * origin is chosen so the fixed captures never catch a lid: the harness samples
 * t = 12.5 + settle/60 (12.6 s at settle 6, 14.0 s at settle 90) and its motion pair 0.5 s later
 * (13.1 / 14.5 s). Slot 2 starts at most at 11.425 s (ends by 11.645) and slot 3 not before
 * 14.925 s, for ANY jitter — so [11.645, 14.925] is lid-free with ≥ 0.6 s to spare around every
 * capture time and its ±0.3 s band (blink.test.mjs proves it over a seed sweep).
 *
 * A run starts with a blink too (her review videos show one): the same envelope from the time
 * the actor's gait chain recorded the run-start EVENT (`GaitChain.runBlinkT`, gaitChain.ts —
 * −Infinity for a hard switch, so never in a capture). Round 8b: the event is one-shot and
 * anchored at its start — once begun the envelope runs to completion as a function of
 * (t − runBlinkT) whatever the gait does afterwards; the chain only starts a new one when the
 * previous has finished, so a release two frames in, a second run start inside the envelope or
 * toggles every few frames never truncate, restart or stutter the lids (Astra's PR #10
 * reproduction: a release at full closure snapped the lids open in one frame because the
 * closure was read only while the gait was run). Hard resets clear the event: a hard switch and
 * a simulation-time jump (`isTimeJump`: backwards, or more than BLINK_RESET_JUMP_S forward — a
 * `setTime` from the harness), so a rewound clock never replays a stale blink.
 * The two are combined by the larger closure — continuous in t, since each is.
 */
import { hash2, hashString } from '../util/prng';

/** the envelope: closing, closed, opening (s) */
export const BLINK_CLOSE_S = 0.07;
export const BLINK_HOLD_S = 0.03;
export const BLINK_OPEN_S = 0.12;
export const BLINK_S = BLINK_CLOSE_S + BLINK_HOLD_S + BLINK_OPEN_S;
/** one scheduled blink per slot, jittered about the slot centre; slot centres at ORIGIN + k · SLOT */
export const BLINK_SLOT_S = 4.75;
export const BLINK_JITTER_S = 0.625;
export const BLINK_ORIGIN_S = 1.3;
/** the resulting interval between consecutive blinks (s) */
export const BLINK_GAP_MIN_S = BLINK_SLOT_S - 2 * BLINK_JITTER_S;
export const BLINK_GAP_MAX_S = BLINK_SLOT_S + 2 * BLINK_JITTER_S;
/** the morph target names of the contract */
export const BLINK_MORPH = 'blink';
export const BLINK_HALF_MORPH = 'blinkHalf';
/** a simulation clock that moves back, or forward by more than this (s) in one update, is a hard reset for the run-start event */
export const BLINK_RESET_JUMP_S = 1;

export interface BlinkSchedule {
  seed: string;
  /** hashString(seed) — the jitter hash's seed, reported by the audit */
  hash: number;
  slotS: number;
  jitterS: number;
  originS: number;
}

export interface BlinkWeights {
  blink: number;
  blinkHalf: number;
}

export function createBlinkSchedule(seed: string): BlinkSchedule {
  return { seed, hash: hashString(seed), slotS: BLINK_SLOT_S, jitterS: BLINK_JITTER_S, originS: BLINK_ORIGIN_S };
}

/** start time (s) of the scheduled blink in slot k */
export function blinkStart(s: BlinkSchedule, k: number): number {
  return s.originS + k * s.slotS + s.jitterS * (2 * hash2(k, 0, s.hash) - 1);
}

/** closure phase p at `tau` seconds after a blink's start: 0 → 1 over the closing, 1 through the hold, 1 → 0 over the opening, 0 outside */
export function blinkEnvelope(tau: number): number {
  if (!(tau > 0 && tau < BLINK_S)) return 0;
  if (tau < BLINK_CLOSE_S) return tau / BLINK_CLOSE_S;
  if (tau < BLINK_CLOSE_S + BLINK_HOLD_S) return 1;
  return 1 - (tau - BLINK_CLOSE_S - BLINK_HOLD_S) / BLINK_OPEN_S;
}

/** the slot whose centre band contains t */
const slotOf = (s: BlinkSchedule, t: number) => Math.floor((t - s.originS) / s.slotS);

/** the scheduled closure phase at simulation time t (the slot t lies in and its neighbours are the only ones that can reach it) */
export function scheduledBlinkPhase(s: BlinkSchedule, t: number): number {
  const k = slotOf(s, t);
  let p = 0;
  for (let i = k - 1; i <= k + 1; i++) {
    const v = blinkEnvelope(t - blinkStart(s, i));
    if (v > p) p = v;
  }
  return p;
}

/** start time of the first scheduled blink after t */
export function nextBlinkStart(s: BlinkSchedule, t: number): number {
  const k = slotOf(s, t);
  for (let i = k - 1; i <= k + 2; i++) {
    const st = blinkStart(s, i);
    if (st > t) return st;
  }
  return blinkStart(s, k + 3);
}

/**
 * The closure phase at t: the scheduled blink and the run-start event (`runBlinkT` — the time
 * the gait chain recorded it, −Infinity when there is none), whichever has the lids further
 * down. The event's envelope depends on t − runBlinkT alone, not on the current gait.
 */
export function blinkPhase(s: BlinkSchedule, t: number, runBlinkT = -Infinity): number {
  const p = scheduledBlinkPhase(s, t);
  const r = Number.isFinite(runBlinkT) ? blinkEnvelope(t - runBlinkT) : 0;
  return r > p ? r : p;
}

/**
 * True when the simulation clock jumped between two updates — backwards, or forward by more than
 * BLINK_RESET_JUMP_S — i.e. a `setTime` rather than a step; the run-start event is cleared then.
 * A zero-dt update (t === lastT) and any ordinary step are not jumps; nor is the first update.
 */
export function isTimeJump(lastT: number, t: number): boolean {
  if (!Number.isFinite(lastT)) return false;
  const advance = t - lastT;
  return advance < 0 || advance > BLINK_RESET_JUMP_S;
}

/** the contract's morph weights for the closure phase p (clamped to [0, 1]) */
export function blinkWeights(p: number, out: BlinkWeights): BlinkWeights {
  const q = 2 * Math.min(1, Math.max(0, p)) - 1;
  out.blink = Math.max(0, q);
  out.blinkHalf = 1 - Math.abs(q);
  return out;
}
