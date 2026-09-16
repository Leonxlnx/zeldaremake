/** Run: node src/world/character/blink.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Transpile blink.ts in memory; its only runtime import is the world PRNG (../util/prng.ts),
// transpiled the same way — anything else is a dependency it must not grow. gaitChain.ts (the
// chain that records the run-start event) is loaded the same way and has no runtime imports.
const here = path.dirname(fileURLToPath(import.meta.url));
const load = (file) => {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (spec) => {
      if (spec === '../util/prng') return load(path.join(here, '../util/prng.ts'));
      throw new Error(`${path.basename(file)} must stay dependency-free (imported ${spec})`);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
};
const { BLINK_S, BLINK_CLOSE_S, BLINK_HOLD_S, BLINK_OPEN_S, BLINK_SLOT_S, BLINK_JITTER_S, BLINK_ORIGIN_S, BLINK_GAP_MIN_S, BLINK_GAP_MAX_S, BLINK_RESET_JUMP_S, createBlinkSchedule, blinkStart, blinkEnvelope, scheduledBlinkPhase, nextBlinkStart, blinkPhase, blinkWeights, isTimeJump } = load(path.join(here, 'blink.ts'));
// the gait chain that records the run-start event (dependency-free; the character system's own state)
const { hardChain, switchGait } = load(path.join(here, 'gaitChain.ts'));

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

// ---- round 8b: the run-start blink is a one-shot event the gait chain records ----
// A model of the character system's play loop: each 1/60 step the input decides the gait, the
// chain is switched (a crossfade at the step's t; gaitChain.ts records the run-start event) and
// the puppet reads blinkPhase(schedule, t, chain.runBlinkT). The largest legal frame-to-frame
// change of p is the closing ramp's slope over one frame.
const chainHooks = { hasPhase: (g) => g !== 'idle', blinkS: BLINK_S };
const MAX_STEP = F / BLINK_CLOSE_S + 1e-9;
const play = (t0, gaitAt, frames, hooks = chainHooks) => {
  const c = hardChain('idle');
  const rows = [];
  for (let i = 0; i < frames; i++) {
    const t = t0 + (i + 1) * F;
    switchGait(c, gaitAt(i), t, hooks);
    const p = blinkPhase(S, t, c.runBlinkT);
    const w = blinkWeights(p, {});
    rows.push({ frame: i, t, gait: c.gait, p, blink: w.blink, blinkHalf: w.blinkHalf, runBlinkT: c.runBlinkT });
  }
  return { c, rows };
};
const noJumps = (rows, msg) => {
  for (let i = 1; i < rows.length; i++) assert.ok(Math.abs(rows[i].p - rows[i - 1].p) <= MAX_STEP, `${msg}: frame ${i} jumps ${rows[i - 1].p} → ${rows[i].p}`);
};
const clearOfSchedule = (t0, t1) => {
  for (let t = t0; t <= t1; t += F / 2) assert.equal(scheduledBlinkPhase(S, t), 0, `no scheduled blink at ${t}`);
};

// 8a. Astra's reproduction (PR #10): t = 30, run for 6 frames, release. Before: the closure was
// read only while the gait was run — frame 5 fully closed, frame 6 (idle) snapped to 0. After:
// the event's envelope runs to completion across the release, frame for frame.
{
  clearOfSchedule(30, 30.5);
  const { rows } = play(30, (i) => (i < 6 ? 'run' : 'idle'), 24);
  const start = 30 + F; // the run began on the first step
  // the old reading, for the record: run-gated
  const before = rows.map((r) => blinkPhase(S, r.t, r.gait === 'run' ? start : -Infinity));
  near(before[5], 1, 1e-12, 'before: frame 5 fully closed');
  assert.equal(before[6], 0, 'before: frame 6 snapped open (the bug)');
  // after
  assert.equal(rows[0].gait, 'run');
  assert.equal(rows[6].gait, 'idle');
  for (const r of rows) {
    near(r.p, blinkEnvelope(r.t - start), 1e-12, `after: frame ${r.frame} follows the envelope from the run start`);
    assert.equal(r.runBlinkT, start, `after: frame ${r.frame} keeps the event`);
  }
  near(rows[5].p, 1, 1e-12, 'after: frame 5 closed');
  near(rows[6].p, 1, 1e-12, 'after: frame 6 (idle) still closed — the hold');
  near(rows[7].p, 1 - (7 * F - BLINK_CLOSE_S - BLINK_HOLD_S) / BLINK_OPEN_S, 1e-9, 'after: frame 7 opening');
  assert.equal(rows[13].p > 0, true, 'after: still opening at frame 13');
  assert.equal(rows[14].p, 0, 'after: open again at frame 14 (0.233 s > 0.22)');
  noJumps(rows, 'after');
  assert.ok(Math.max(...rows.map((r) => r.blink)) === 1 && rows.some((r) => r.gait === 'idle' && r.blink > 0.5), 'the lids are still mostly shut in idle frames');
  console.log('  8a: run 6 frames then idle — p per frame:', rows.map((r) => r.p.toFixed(3)).join(' '));
}

// 8b. run → idle → run within 100 ms: one envelope, no restart, no truncation
{
  clearOfSchedule(40, 40.5);
  const gaitAt = (i) => (i < 2 ? 'run' : i < 4 ? 'idle' : 'run');
  const { c, rows } = play(40, gaitAt, 30);
  const start = 40 + F;
  assert.equal(rows[4].gait, 'run', 'second run start at frame 4 (67 ms)');
  assert.equal(c.runBlinkT, start, 'the second run start inside the envelope kept the first event');
  for (const r of rows) near(r.p, blinkEnvelope(r.t - start), 1e-12, `frame ${r.frame} on the single envelope`);
  noJumps(rows, 'run→idle→run');
}

// 8c. five toggles at 3-frame spacing: the envelope is monotone (up, hold, down) and never
// restarts; a run start after the envelope has ended begins a new event
{
  clearOfSchedule(50, 50.6);
  const gaitAt = (i) => (Math.floor(i / 3) % 2 === 0 ? 'run' : 'idle'); // run 0-2, idle 3-5, run 6-8, idle 9-11, run 12-14, idle 15-17, run 18-20 …
  const { rows } = play(50, gaitAt, 36);
  const start = 50 + F;
  const switches = rows.filter((r, i) => i === 0 || rows[i - 1].gait !== r.gait).map((r) => r.frame);
  assert.deepEqual(switches.slice(0, 5), [0, 3, 6, 9, 12], 'five toggles');
  // through the first envelope (frames 0..13): exactly the one envelope from the first run start
  let peaked = false;
  for (let i = 0; i < 14; i++) {
    const r = rows[i];
    near(r.p, blinkEnvelope(r.t - start), 1e-12, `frame ${i} on the first envelope`);
    assert.equal(r.runBlinkT, start, `frame ${i} keeps the first event`);
    if (i > 0) {
      const tau = r.t - start;
      if (tau <= BLINK_CLOSE_S + BLINK_HOLD_S + 1e-9) assert.ok(r.p >= rows[i - 1].p - 1e-12, `monotone up/hold at frame ${i}`);
      else {
        peaked = true;
        assert.ok(r.p <= rows[i - 1].p + 1e-12, `monotone down at frame ${i}`);
      }
    }
  }
  assert.ok(peaked);
  noJumps(rows, 'toggles');
  // frame 18's run start comes 0.3 s after the first — the envelope ended at 0.22 — so a new event
  const second = rows[18];
  assert.equal(second.gait, 'run');
  assert.equal(second.runBlinkT, second.t, 'a run start after the envelope begins a new event');
  assert.equal(rows[17].p, 0, 'open just before it');
  for (let i = 18; i < 36; i++) near(rows[i].p, blinkEnvelope(rows[i].t - second.t), 1e-12, `frame ${i} on the second envelope`);
}

// 8d. hard resets clear the event: a hard switch, a fresh chain, a clock jump (backwards or > 1 s
// forward — never a step or a zero-dt re-render)
{
  const c = hardChain('idle');
  switchGait(c, 'run', 60 + F, chainHooks);
  assert.equal(c.runBlinkT, 60 + F);
  switchGait(c, 'idle', null, chainHooks);
  assert.equal(c.runBlinkT, -Infinity, 'a hard switch clears the event');
  assert.equal(hardChain('run').runBlinkT, -Infinity, 'a hard chain into run has no event');
  // no run-start blinks at all without the hook (the procedural rigs' chains)
  const d = hardChain('idle');
  switchGait(d, 'run', 61, { hasPhase: (g) => g !== 'idle' });
  assert.equal(d.runBlinkT, -Infinity);
  assert.equal(BLINK_RESET_JUMP_S, 1);
  assert.equal(isTimeJump(NaN, 30), false, 'the first update is not a jump');
  assert.equal(isTimeJump(30, 30), false, 'a zero-dt re-render is not a jump');
  assert.equal(isTimeJump(30, 30 + F), false, 'a step is not a jump');
  assert.equal(isTimeJump(30, 30.1), false, 'a 0.1 s step is not a jump');
  assert.equal(isTimeJump(30, 30.9), false, 'a forward setTime under a second is not a jump');
  assert.equal(isTimeJump(30, 31.001), true, 'more than a second forward is');
  assert.equal(isTimeJump(30, 29.999), true, 'backwards is');
  assert.equal(isTimeJump(30, 12.6), true, 'a capture-time rewind is');
}

// 8e. zero-dt identity: the same (t, chain) gives the same weights however often it is read, and a
// switch into the chain's own gait at the same t changes nothing
{
  const c = hardChain('idle');
  switchGait(c, 'run', 70 + F, chainHooks);
  const t = 70 + 5 * F;
  const snap = JSON.stringify(c);
  const w1 = blinkWeights(blinkPhase(S, t, c.runBlinkT), {});
  switchGait(c, 'run', t, chainHooks);
  const w2 = blinkWeights(blinkPhase(S, t, c.runBlinkT), {});
  const w3 = blinkWeights(blinkPhase(S, t, c.runBlinkT), {});
  assert.equal(JSON.stringify(c), snap, 'the chain is unchanged');
  assert.deepEqual(w1, w2);
  assert.deepEqual(w2, w3);
  assert.ok(w1.blink > 0.9, 'mid-event (closed)');
}

console.log('blink.test.mjs: ok');
