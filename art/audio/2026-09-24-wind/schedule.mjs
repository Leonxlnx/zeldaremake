#!/usr/bin/env node
/**
 * schedule.mjs — when do the birds actually sing, against what the wind is doing?
 *
 *   node art/audio/2026-09-24-wind/schedule.mjs [--seconds 900]
 *
 * The thing that changed is a *schedule*, so measure the schedule. Detecting bird calls in a
 * rendered WAV costs a ten-minute render and adds a detector's own errors, and the answer is exact
 * anyway: the bed is deterministic, so driving the real `createAmbience` against a fake audio
 * context with the offline render's own gust curve gives every call's time to the sample.
 *
 * It models the live loop faithfully, including the part that matters most here: the scheduler runs
 * **four seconds ahead of the clock**, so a call decided during a lull can sound after it. Each
 * call is attributed to the wind at the moment it SOUNDS, not the moment it was decided.
 */
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
const root = path.resolve(here, '../../..');
const A = loadTs(path.join(root, 'src/audio/ambience.ts'));
const { createRng } = loadTs(path.join(root, 'src/world/util/prng.ts'));

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] ?? true] : [])).filter(Boolean));
const SECONDS = Number(args.seconds ?? 900);
const LOOKAHEAD = 4;
const STEP = 0.05;

/** the same gust the offline render uses; measured against the world's own wind in README.md */
const gustAt = (t) => {
  const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
  const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
  return Math.min(1, g * 0.8 + push * 0.6);
};

/** the least audio context `createAmbience` will build against */
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  return {
    currentTime: 0,
    sampleRate: 44100,
    // cleanupAt() parks a setTimeout per voice against the wall clock and returns early for an
    // offline context; without this the run ends with thousands of live timers and never exits
    startRendering() {},
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(), Q: param(), gain: param() }),
    createOscillator: () => node({ type: 'sine', frequency: param(), detune: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: param(), detune: param(), start() {}, stop() {} }),
    createStereoPanner: () => node({ pan: param() }),
    createBuffer: (ch, len, rate) => ({ numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => new Float32Array(len), copyToChannel() {} }),
    createConvolver: () => node({ buffer: null, normalize: true }),
    createDynamicsCompressor: () => node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
  };
}

const ctx = fakeContext();
const amb = A.createAmbience(ctx, ctx.createGain(), ctx.createGain(), createRng('bed/measure'), 0);
/** birds that SOUND in each 50 ms slot, and the wind at that moment */
const slots = [];
let seen = 0;
for (let t = 0; t < SECONDS; t += STEP) {
  amb.update(t, { gust: gustAt(t), listener: { x: 0, y: 1.2, z: 0 }, forward: { x: 0, z: 1 }, pods: [], canopy: 1 });
  amb.scheduleUntil(t + LOOKAHEAD);
  const n = amb.stats().birds;
  if (n > seen) slots.push({ at: t + LOOKAHEAD, gust: gustAt(t + LOOKAHEAD), n: n - seen });
  seen = n;
}

const KNEE = A.GUST_KNEE;
let lullS = 0;
let blowS = 0;
for (let t = 0; t < SECONDS; t += STEP) (gustAt(t) <= KNEE ? (lullS += STEP) : (blowS += STEP));
const inLull = slots.filter((s) => s.gust <= KNEE).reduce((a, s) => a + s.n, 0);
const inBlow = slots.filter((s) => s.gust > KNEE).reduce((a, s) => a + s.n, 0);

/** every lull longer than a second, and whether a call landed in it */
const lulls = [];
let run = null;
for (let t = 0; t < SECONDS; t += STEP) {
  const q = gustAt(t) <= KNEE;
  if (q && run === null) run = t;
  else if (!q && run !== null) {
    if (t - run > 1) lulls.push([run, t]);
    run = null;
  }
}
const withCall = lulls.filter(([a, b]) => slots.some((s) => s.at >= a - 0.3 && s.at <= b + 0.5)).length;

const f = (v) => v.toFixed(1).padStart(6);
console.log(`${SECONDS} s of the offline gust, the bed's real scheduler, a ${LOOKAHEAD} s lookahead`);
console.log(`  the wind is under the knee ${((100 * lullS) / SECONDS).toFixed(1)} % of the time, in ${lulls.length} lulls of a second or more`);
console.log(`  birds while it blows ${String(inBlow).padStart(4)} in ${f(blowS)} s = ${f(inBlow / (blowS / 60))} /min`);
console.log(`  birds in the lulls   ${String(inLull).padStart(4)} in ${f(lullS)} s = ${f(inLull / (lullS / 60))} /min`);
console.log(`  lulls with a call in them: ${withCall} / ${lulls.length} (${((100 * withCall) / lulls.length).toFixed(0)} %)`);
console.log(`  all birds ${seen} in ${SECONDS} s = ${(seen / (SECONDS / 60)).toFixed(1)} /min`);
