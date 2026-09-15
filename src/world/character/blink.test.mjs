/** Run: node src/world/character/blink.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Transpile blink.ts in memory; its only runtime import is the world PRNG (../util/prng.ts),
// transpiled the same way — anything else is a dependency it must not grow.
const here = path.dirname(fileURLToPath(import.meta.url));
const load = (file) => {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (spec) => {
      if (spec === '../util/prng') return load(path.join(here, '../util/prng.ts'));
      throw new Error(`blink.ts must stay dependency-free (imported ${spec})`);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
};
const { BLINK_S, BLINK_CLOSE_S, BLINK_HOLD_S, BLINK_OPEN_S, BLINK_SLOT_S, BLINK_JITTER_S, BLINK_ORIGIN_S, BLINK_GAP_MIN_S, BLINK_GAP_MAX_S, createBlinkSchedule, blinkStart, blinkEnvelope, scheduledBlinkPhase, nextBlinkStart, blinkPhase, blinkWeights } = load(path.join(here, 'blink.ts'));

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const F = 1 / 60;
/** the world seed index.ts derives the schedule from (config.ts WORLD.seed + '/link-blink') */
const WORLD_SEED = 'kokiri-forest-phase1/link-blink';
const S = createBlinkSchedule(WORLD_SEED);

// 1. the envelope: 70 / 30 / 120 ms, linear ramps, exactly 0 outside
{
  near(BLINK_S, 0.22, 1e-12, 'total');
  assert.equal(blinkEnvelope(-1e-9), 0);
  assert.equal(blinkEnvelope(0), 0);
  near(blinkEnvelope(BLINK_CLOSE_S / 2), 0.5, 1e-12, 'half closed half-way through the closing');
  near(blinkEnvelope(BLINK_CLOSE_S), 1, 1e-12, 'closed at the end of the closing');
  assert.equal(blinkEnvelope(BLINK_CLOSE_S + BLINK_HOLD_S / 2), 1, 'held closed');
  near(blinkEnvelope(BLINK_CLOSE_S + BLINK_HOLD_S + BLINK_OPEN_S / 2), 0.5, 1e-12, 'half open half-way through the opening');
  near(blinkEnvelope(BLINK_S - 1e-9), 0, 1e-6, 'open at the end');
  assert.equal(blinkEnvelope(BLINK_S), 0);
  assert.equal(blinkEnvelope(BLINK_S + 1), 0);
  // continuity at 60 fps: no frame-to-frame jump larger than the steepest ramp
  let prev = 0;
  for (let tau = -F; tau <= BLINK_S + F; tau += F / 4) {
    const p = blinkEnvelope(tau);
    assert.ok(Math.abs(p - prev) <= (F / 4) / BLINK_CLOSE_S + 1e-9, `no jump at ${tau}`);
    prev = p;
  }
}

// 2. the contract's weights: both 0 open, blinkHalf 1 at p = ½, blink 1 (half 0) at p = 1
{
  const w = {};
  assert.deepEqual(blinkWeights(0, w), { blink: 0, blinkHalf: 0 });
  assert.deepEqual(blinkWeights(0.5, w), { blink: 0, blinkHalf: 1 });
  assert.deepEqual(blinkWeights(1, w), { blink: 1, blinkHalf: 0 });
  near(blinkWeights(0.25, w).blinkHalf, 0.5, 1e-12, 'quarter closed: half at 0.5');
  assert.equal(w.blink, 0);
  near(blinkWeights(0.75, w).blink, 0.5, 1e-12, 'three-quarters: blink 0.5');
  near(w.blinkHalf, 0.5, 1e-12, 'three-quarters: half 0.5');
  assert.deepEqual(blinkWeights(-0.2, w), { blink: 0, blinkHalf: 0 }, 'clamped below');
  assert.deepEqual(blinkWeights(1.3, w), { blink: 1, blinkHalf: 0 }, 'clamped above');
}

// 3. the schedule: seeded, deterministic, one blink per slot, intervals in [3.5, 6.0]
{
  assert.equal(BLINK_GAP_MIN_S, BLINK_SLOT_S - 2 * BLINK_JITTER_S);
  assert.equal(BLINK_GAP_MAX_S, BLINK_SLOT_S + 2 * BLINK_JITTER_S);
  near(BLINK_GAP_MIN_S, 3.5, 1e-12, 'shortest interval');
  near(BLINK_GAP_MAX_S, 6.0, 1e-12, 'longest interval');
  assert.equal(createBlinkSchedule(WORLD_SEED).hash, S.hash, 'same seed, same schedule');
  assert.notEqual(createBlinkSchedule('other').hash, S.hash, 'a different seed is a different schedule');
  let jitterSpread = 0;
  for (let k = -2; k < 400; k++) {
    const a = blinkStart(S, k);
    const b = blinkStart(S, k + 1);
    assert.equal(a, blinkStart(S, k), 'closed form: the same slot gives the same start');
    const centre = BLINK_ORIGIN_S + k * BLINK_SLOT_S;
    assert.ok(Math.abs(a - centre) <= BLINK_JITTER_S, `slot ${k} within its jitter band`);
    assert.ok(b - a >= BLINK_GAP_MIN_S - 1e-9 && b - a <= BLINK_GAP_MAX_S + 1e-9, `interval ${k}: ${b - a}`);
    jitterSpread = Math.max(jitterSpread, Math.abs(a - centre));
  }
  assert.ok(jitterSpread > 0.4, `the jitter is used (max |offset| ${jitterSpread})`);
  // the other seed lands elsewhere
  const other = createBlinkSchedule('other');
  let differ = 0;
  for (let k = 0; k < 20; k++) if (Math.abs(blinkStart(S, k) - blinkStart(other, k)) > 1e-3) differ++;
  assert.ok(differ >= 15, `seeds differ in most slots (${differ}/20)`);
}

// 4. the phase is exactly 0 outside blinks and traces the envelope inside; nextBlinkStart is the following slot
{
  for (let k = 0; k < 40; k++) {
    const st = blinkStart(S, k);
    assert.equal(scheduledBlinkPhase(S, st - 1e-6), 0, `open just before blink ${k}`);
    assert.equal(scheduledBlinkPhase(S, st + BLINK_S + 1e-6), 0, `open just after blink ${k}`);
    near(scheduledBlinkPhase(S, st + BLINK_CLOSE_S + 0.01), 1, 1e-12, `closed in the hold of blink ${k}`);
    near(scheduledBlinkPhase(S, st + 0.035), 0.5, 1e-12, `half way down in blink ${k}`);
    // the next scheduled blink after any moment of this one, or just before it, is k + 1 / k
    near(nextBlinkStart(S, st + 0.01), blinkStart(S, k + 1), 1e-12, `next after blink ${k}`);
    near(nextBlinkStart(S, st + BLINK_S + 0.5), blinkStart(S, k + 1), 1e-12, `next between blinks ${k} and ${k + 1}`);
    near(nextBlinkStart(S, st - 0.01), st, 1e-12, `next just before blink ${k}`);
  }
  // exactly zero over whole stretches between blinks, sampled at 60 fps for 400 s
  let inBlink = 0;
  let open = 0;
  for (let t = 0; t < 400; t += F) {
    const p = scheduledBlinkPhase(S, t);
    const k = Math.floor((t - BLINK_ORIGIN_S) / BLINK_SLOT_S);
    let inside = false;
    for (let i = k - 1; i <= k + 1; i++) {
      const st = blinkStart(S, i);
      if (t > st && t < st + BLINK_S) inside = true;
    }
    if (inside) {
      assert.ok(p > 0, `closing at ${t}`);
      inBlink++;
    } else {
      assert.equal(p, 0, `exactly open at ${t}`);
      open++;
    }
  }
  assert.ok(inBlink > 0 && open > inBlink * 10, `mostly open (${open} open / ${inBlink} in a blink)`);
}

// 5. the capture windows: no blink in progress at 12.6 s or 14.0 s (settle 6 / 90) nor within
// ±0.3 s of them, nor at the motion pair 13.1 / 14.5 s — for the world seed AND any jitter
{
  const windows = [
    [12.6 - 0.3, 12.6 + 0.3],
    [14.0 - 0.3, 14.0 + 0.3],
    [13.1, 13.1],
    [14.5, 14.5],
  ];
  const lidFree = (s) => {
    for (const [a, b] of windows) {
      for (let t = a; t <= b + 1e-9; t += F / 2) assert.equal(scheduledBlinkPhase(s, t), 0, `seed ${s.seed}: open at ${t.toFixed(4)}`);
      assert.equal(scheduledBlinkPhase(s, b), 0, `seed ${s.seed}: open at ${b}`);
    }
  };
  lidFree(S);
  for (let i = 0; i < 500; i++) lidFree(createBlinkSchedule(`sweep-${i}`));
  // the analytic bound: the latest possible slot-2 blink ends before the first window, the
  // earliest possible slot-3 blink starts after the last one, whatever the jitter
  const slot2LatestEnd = BLINK_ORIGIN_S + 2 * BLINK_SLOT_S + BLINK_JITTER_S + BLINK_S;
  const slot3Earliest = BLINK_ORIGIN_S + 3 * BLINK_SLOT_S - BLINK_JITTER_S;
  assert.ok(slot2LatestEnd <= 12.3, `slot 2 ends by ${slot2LatestEnd} ≤ 12.3`);
  assert.ok(slot3Earliest >= 14.5, `slot 3 starts after ${slot3Earliest} ≥ 14.5`);
  // and the world seed's actual neighbours
  const before = blinkStart(S, 2);
  const after = blinkStart(S, 3);
  assert.ok(before + BLINK_S < 12.3 && after > 14.5, `world seed: blink ${before.toFixed(3)}–${(before + BLINK_S).toFixed(3)} then ${after.toFixed(3)}`);
  console.log(`  capture band: last blink ends ${(before + BLINK_S).toFixed(3)} s, next starts ${after.toFixed(3)} s (12.6 / 13.1 / 14.0 / 14.5 s lid-free)`);
}

// 6. the run-start blink: the envelope from the switch time, none for a hard switch, the larger closure wins
{
  const t0 = 30.0;
  near(blinkPhase(S, t0 + 0.035, t0), Math.max(0.5, scheduledBlinkPhase(S, t0 + 0.035)), 1e-12, 'half closed 35 ms into the run');
  near(blinkPhase(S, t0 + 0.08, t0), 1, 1e-12, 'closed in the hold');
  assert.equal(blinkPhase(S, t0 + 0.3, t0), scheduledBlinkPhase(S, t0 + 0.3), 'over after 0.22 s: the schedule alone');
  assert.equal(blinkPhase(S, t0 + 0.08, -Infinity), scheduledBlinkPhase(S, t0 + 0.08), 'a hard switch never blinks');
  assert.equal(blinkPhase(S, t0 - 0.01, t0), scheduledBlinkPhase(S, t0 - 0.01), 'nothing before the switch');
  // overlapping a scheduled blink: continuous (max of two continuous functions), never above 1
  const st = blinkStart(S, 10);
  let prev = blinkPhase(S, st - 0.1 - F, st - 0.1);
  for (let t = st - 0.1; t < st + 0.5; t += F) {
    const p = blinkPhase(S, t, st - 0.1);
    assert.ok(p >= 0 && p <= 1, 'in range');
    assert.ok(Math.abs(p - prev) <= F / BLINK_CLOSE_S + 1e-9, `continuous at ${t}`);
    prev = p;
  }
}

// 7. purity: the same t gives the same phase whatever was asked before (no state)
{
  const a = blinkPhase(S, 77.777);
  blinkPhase(S, 1);
  blinkPhase(S, 1000);
  nextBlinkStart(S, 5);
  assert.equal(blinkPhase(S, 77.777), a);
}

console.log('blink.test.mjs: ok');
