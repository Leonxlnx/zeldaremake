// node --test src/audio/lag.test.mjs — the world has to arrive where he is, not where he was.
//
// `ambience.test.mjs` holds the contract that every term which moves because the LISTENER moved is
// smoothed on `PLACE_TAU`. That one cannot see whether PLACE_TAU is the right size, because the
// size is not a property of the bed: it is a property of the bed, the tick and the player's legs
// together. This file bounds it against all three.
//
// The measurement behind the numbers is `art/audio/2026-09-25-lag/`. `setTargetAtTime(v, t, tau)`
// is exactly a one-pole — `v0 + (target - v0)(1 - e^{-dt/tau})` — so the heard curve along a real
// path can be computed here from the same `surfaceAt` the game reads, with no audio at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const A = loadTs(path.join(here, 'index.ts'));
const AMB = loadTs(path.join(here, 'ambience.ts'));
const { RUN_GROUND_SPEED, WALK_SPEED } = loadTs(path.join(here, 'footsteps.ts'));
const TICK = A.TICK_MS / 1000;

test('a place term settles inside a stride, and never inside a tick', () => {
  // Below one tick the glide finishes before the next update and a moving parameter becomes a
  // staircase at the tick rate — on a gain that is amplitude modulation at 30 Hz, and this lane
  // exists because the owner heard a buzz. Above three ticks it is a metre of ground at a run.
  assert.ok(AMB.PLACE_TAU >= TICK, `PLACE_TAU ${AMB.PLACE_TAU} s is under one ${(TICK * 1000).toFixed(1)} ms tick — the parameter would sit still between updates`);
  assert.ok(AMB.PLACE_TAU <= TICK * 3, `PLACE_TAU ${AMB.PLACE_TAU} s is over three ticks`);
  assert.ok(AMB.PLACE_TAU * RUN_GROUND_SPEED < 0.25, `at a run PLACE_TAU is ${(AMB.PLACE_TAU * RUN_GROUND_SPEED).toFixed(2)} m of ground, which is most of a stride`);
});

/**
 * Walk from `from` to `to` at `speed`, ticking at the game's rate, and return the ground covered
 * before the heard curve lines up with the world's own — the shift, in metres, that best fits one
 * onto the other. `term` picks the space term out of `surfaceAt`; the smoothing runs on that term
 * rather than on what it is mapped to, which is the same thing for a monotone map and is what a
 * lag is asked of.
 */
function lagAlong(from, to, speed, tau, term) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const at = (d) => A.surfaceAt(from[0] + ((to[0] - from[0]) * d) / len, from[1] + ((to[1] - from[1]) * d) / len)[term];
  const CM = 0.01;
  const world = [];
  const heard = [];
  let held = at(0);
  let start = held;
  let tickAt = 0;
  for (let d = 0; d <= len; d += CM) {
    const t = d / speed;
    while (t >= tickAt + TICK) {
      tickAt += TICK;
      start += (held - start) * (1 - Math.exp(-TICK / tau));
      held = at(Math.min(tickAt * speed, len));
    }
    world.push(at(d));
    heard.push(held + (start - held) * Math.exp(-(t - tickAt) / tau));
  }
  let best = 0;
  let bestErr = Infinity;
  for (let s = 0; s <= Math.round(4 / CM); s++) {
    let err = 0;
    for (let i = s; i < world.length; i++) err += Math.abs(heard[i] - world[i - s]);
    const mean = err / (world.length - s);
    if (mean < bestErr) {
      bestErr = mean;
      best = s;
    }
  }
  return best * CM;
}

test('the wood closes over him where he is, not a metre back', () => {
  // The north path in through the log arch's mouth, and the same path coming out from the open
  // village in under the crowns. On the shipped 0.35 s these read 1.50 m and 1.63 m at a run.
  for (const [note, from, to, term] of [
    ['the log arch\u2019s mouth', [5.1, -48.0], [4.3, -56.0], 'enclosure'],
    ['the canopy edge', [5.98, -40.0], [5.0, -50.0], 'canopy'],
  ]) {
    for (const [gait, speed, cap] of [
      ['walk', WALK_SPEED, 0.2],
      ['run', RUN_GROUND_SPEED, 0.45],
    ]) {
      const m = lagAlong(from, to, speed, AMB.PLACE_TAU, term);
      assert.ok(m <= cap, `crossing ${note} at a ${gait}, the bed is still ${m.toFixed(2)} m behind him (cap ${cap} m)`);
    }
  }
});

test('a stopped clock is asked to start again, and not thirty times a second', () => {
  // Chrome suspends an AudioContext when the output device changes under the page, when a
  // background tab is frozen, and when a page comes back from the back/forward cache. Nothing in
  // `index.ts` listened for it: the only `resume()` was the one behind the first gesture, so the
  // game went quiet for the rest of the session and not even the mute key brought it back.
  // Measured (`art/audio/2026-09-25-suspend/`): twelve seconds of a twenty-seven second run, and
  // the recorded master held fifteen seconds of it.
  //
  // `tick` closes over a live context and a scene and cannot be reached from here, so the policy
  // is a function of its own and this is the whole of what was missing.
  assert.equal(A.shouldWake('suspended', 1000, 0), true, 'a stopped clock must be asked to start');
  assert.equal(A.shouldWake('closed', 1000, 0), true, 'a closed context is not running either');
  assert.equal(A.shouldWake('running', 1000, 0), false, 'a running clock must be left alone');
  assert.equal(A.shouldWake('suspended', 1000, 1400), false, 'and not asked again before the retry window');
  assert.equal(A.shouldWake('suspended', 1400, 1400), true, 'but asked the moment it opens');
  // a resume outside a user gesture can be refused, and the tick runs at TICK_MS: asking every
  // tick would be a hundred and eighty refusals before the user touched anything
  assert.ok(A.WAKE_RETRY_MS > A.TICK_MS * 2, `the retry is ${A.WAKE_RETRY_MS} ms against a ${A.TICK_MS.toFixed(1)} ms tick — that is asking on almost every one`);
  assert.ok(A.WAKE_RETRY_MS <= 1000, `${A.WAKE_RETRY_MS} ms of silence is long enough to be heard as a fault`);
});
