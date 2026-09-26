#!/usr/bin/env node
/**
 * gaps.mjs — are the wood's events irregular, or is one of them a clock? (rubric check 5)
 *
 *   node art/audio/2026-09-26-gaps/gaps.mjs
 *
 * Check 5 is *its events (birds, leaves) are sparse and irregular, with gaps long enough to
 * notice*, and it scores 3 on "flutter gap capped at 2.2 s, bird gaps measured". The cap is the
 * part nobody has looked at:
 *
 *     nextFlutter += Math.min(QUIET_GAP_MAX, (0.5 + rng() * 3.2) / ((0.3 + g * 1.1) * (1 + canopy * CANOPY_FLUTTER)));
 *
 * A `Math.min` against a draw whose range is much wider than the cap does not shorten the long
 * gaps — it **replaces them all with the same number**. How often that happens depends on the
 * gust and the canopy, which is what this measures: the gap distribution as the scheduler
 * actually produces it, at the four corners of the weather.
 *
 * No render. The schedule is the thing in question and it is a pure function of the seeded stream,
 * so it is driven directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  const src = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', src)(
    (n) => {
      if (!n.startsWith('.')) return nodeRequire(n);
      const t = path.resolve(path.dirname(file), n);
      for (const c of [t + '.ts', path.join(t, 'index.ts'), t]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${n} from ${file}`);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const out = path.resolve(args.out || '/tmp/gaps');
fs.mkdirSync(out, { recursive: true });

const A = loadTs('src/audio/ambience.ts');
const { createRng } = loadTs('src/world/util/prng.ts');

const param = (v) => ({ value: v, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; } });
const node = (k, e = {}) => ({ kind: k, outputs: [], connect(d) { this.outputs.push(d); return d; }, disconnect() {}, ...e });
const ctxOf = () => ({
  sampleRate: 8000,
  currentTime: 0,
  destination: node('dest'),
  startRendering() {},
  createGain: () => node('gain', { gain: param(1) }),
  createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
  createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }),
  createStereoPanner: () => node('pan', { pan: param(0) }),
  createBufferSource: () => node('src', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} }),
  createBuffer(c, l, r) {
    const d = Array.from({ length: c }, () => new Float32Array(l));
    return { length: l, sampleRate: r, duration: l / r, numberOfChannels: c, getChannelData: (i) => d[i], copyToChannel: (s, i) => d[i].set(s.subarray(0, d[i].length)) };
  },
});

const LISTENER = { x: 0, y: 1.2, z: 0 };
const NORTH = { x: 0, z: -1 };

/** every moment an event of `kind` is scheduled, over `seconds`, at a fixed gust and canopy */
function eventTimes(kind, gust, canopy, seconds = 900) {
  const ctx = ctxOf();
  const amb = A.createAmbience(ctx, ctx.createGain(), ctx.createGain(), ctx.createGain(), createRng('gaps/bed'), 0);
  // a fairy at arm's length, so the glint scheduler has something to answer
  const fairies = [{ x: 0.9, y: 1.4, z: -0.6 }];
  const at = [];
  let seen = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    amb.update(t, { gust, listener: LISTENER, forward: NORTH, pods: [], canopy, fairies });
    amb.scheduleUntil(t + 4);
    const n = amb.stats()[kind];
    while (seen < n) {
      at.push(t);
      seen++;
    }
  }
  return at;
}

const CAP = A.QUIET_GAP_MAX;
const CORNERS = [
  ['still air, open sky', A.GUST_KNEE * 0.5, 0],
  ['still air, closed crowns', A.GUST_KNEE * 0.5, 1],
  ['a half gust, open sky', 0.5, 0],
  ['a full gust, closed crowns', 1, 1],
];

/**
 * How much a stream of events varies, as a number an ear would agree with.
 *
 * The coefficient of variation — the standard deviation of the gaps over their mean — is the
 * usual one, and it has a reference point that matters here: a **Poisson process**, which is what
 * "independent sparse events" means, has a CV of exactly **1**. A metronome has 0. Anything much
 * under a half is something an ear can start counting.
 */
function spreadOf(at, burst = 0.05) {
  const gaps = [];
  for (let i = 1; i < at.length; i++) {
    const g = at[i] - at[i - 1];
    // a scheduler may fire a burst for one event (two or three leaves for one turn-over, a
    // second bird answering the first); the gap that matters is between BURSTS
    if (g > burst) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const n = gaps.length || 1;
  const mean = gaps.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(gaps.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { gaps, n: gaps.length, mean, sd, cv: sd / (mean || 1), min: gaps[0] ?? 0, max: gaps[gaps.length - 1] ?? 0, p10: gaps[Math.floor(n * 0.1)] ?? 0, p90: gaps[Math.floor(n * 0.9)] ?? 0 };
}

const rows = [];
for (const [kind, burst, note] of [
  ['flutters', 0.05, `the cap is ${CAP} s`],
  ['birds', 2.5, 'a second bird answers the first 1.1\u20132.5 s later; that pair is one event'],
  ['glints', 0.05, 'only sounded while a fairy is inside 4.33 m'],
]) {
  console.log(`\nthe gaps between ${kind}, as the scheduler makes them (${note})\n`);
  console.log(`${'weather'.padEnd(26)} ${'gaps'.padStart(6)} ${'mean'.padStart(8)} ${'shortest'.padStart(9)} ${'longest'.padStart(8)} ${'spread'.padStart(8)} ${'variation'.padStart(10)} ${'at the cap'.padStart(11)}`);
  for (const [label, gust, canopy] of CORNERS) {
    const s = spreadOf(eventTimes(kind, gust, canopy), burst);
    if (!s.n) {
      console.log(`   ${label.padEnd(23)} ${'none'.padStart(6)}`);
      continue;
    }
    const atCap = kind === 'flutters' ? s.gaps.filter((g) => g >= CAP - 1 / 30 - 1e-9).length : 0;
    rows.push({ kind, label, gust, canopy, n: s.n, mean: s.mean, cv: s.cv, min: s.min, max: s.max, p10: s.p10, p90: s.p90, atCap });
    const cap = kind === 'flutters' ? `${((100 * atCap) / s.n).toFixed(0)} %` : '\u2014';
    console.log(`   ${label.padEnd(23)} ${String(s.n).padStart(6)} ${s.mean.toFixed(2).padStart(6)} s ${s.min.toFixed(2).padStart(7)} s ${s.max.toFixed(2).padStart(6)} s ${(s.p90 - s.p10).toFixed(2).padStart(6)} s ${s.cv.toFixed(2).padStart(10)} ${cap.padStart(11)}`);
  }
}
console.log('\n   "spread" is the tenth to the ninetieth percentile — how much the gap actually varies.');
console.log('   "variation" is the standard deviation over the mean: a Poisson process — independent');
console.log('   sparse events, which is what a wood is — has exactly 1, and a metronome has 0.');
fs.writeFileSync(path.join(out, 'gaps.json'), JSON.stringify({ cap: CAP, rows }, null, 1));
console.log(`\nwrote ${path.join(out, 'gaps.json')}`);
