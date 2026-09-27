#!/usr/bin/env node
/**
 * phase.mjs — do the birds land on the gust's cycle?
 *
 *   node art/audio/2026-09-26-gaps/phase.mjs
 *
 * Two findings from earlier today meet here.
 *
 * `2026-09-26-gust` measured that `uGust` has no randomness in it — it is a product of two sines
 * and it **repeats every 26.4 s at r = 0.868**. And `ambience.ts` answers the wind dropping away
 * with a call:
 *
 *     if (gustNow > GUST_KNEE && gust <= GUST_KNEE)
 *       nextBird = Math.min(nextBird, t + BIRD_ANSWERS_LULL[0] + lullRng() * (…));
 *
 * That is deliberate and measured (`2026-09-24-wind`): the one moment the forest is meant to be
 * quiet used to be the one moment it had nothing to say. But the lulls it answers arrive on a
 * 26.4 s clock, and the answer lands 0.5–1.8 s after each one — so the question is whether the
 * calls pile up at a fixed phase of that cycle, which would put the wind's period into the
 * EVENTS rather than only into the level, where it is worth r = 0.126 and nobody hears it.
 *
 * Driven on the world's own gust rather than a held one, and folded modulo the cycle.
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

/** src/world/wind/wind.ts, update() — the shipped gust, and there is nothing random in it */
const gustAt = (t) => Math.min(1, (0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3)) * 0.8 + Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3 * 0.6);

const CYCLE = 26.4;
const SECONDS = Number(args.seconds ?? 3600);
const ctx = ctxOf();
const amb = A.createAmbience(ctx, ctx.createGain(), ctx.createGain(), ctx.createGain(), createRng('gaps/phase'), 0);
const birds = [];
const lulls = [];
let seen = 0;
let was = 0;
for (let t = 0; t < SECONDS; t += 1 / 30) {
  const g = gustAt(t);
  if (was > A.GUST_KNEE && g <= A.GUST_KNEE) lulls.push(t);
  was = g;
  amb.update(t, { gust: g, listener: { x: 0, y: 1.2, z: 0 }, forward: { x: 0, z: -1 }, pods: [], canopy: 0 });
  amb.scheduleUntil(t + 4);
  const n = amb.stats().birds;
  while (seen < n) {
    birds.push(t);
    seen++;
  }
}

console.log(`\n${birds.length} calls and ${lulls.length} lulls in ${SECONDS} s of the world's own wind\n`);
const lullGaps = [];
for (let i = 1; i < lulls.length; i++) lullGaps.push(lulls[i] - lulls[i - 1]);
const lullMean = lullGaps.reduce((s, v) => s + v, 0) / (lullGaps.length || 1);
console.log(`   the lulls themselves come every ${lullMean.toFixed(1)} s on average, and the gust repeats at ${CYCLE}`);

/** how strongly a set of times piles up at one phase of `period`, 0 (spread) to 1 (all together) */
function concentration(times, period) {
  let sx = 0;
  let sy = 0;
  for (const t of times) {
    const th = (2 * Math.PI * (t % period)) / period;
    sx += Math.cos(th);
    sy += Math.sin(th);
  }
  return Math.hypot(sx, sy) / (times.length || 1);
}

console.log('\nhow much the calls pile up at one phase of a cycle (0 spread evenly, 1 all at once)\n');
console.log(`   ${'cycle'.padStart(9)} ${'calls'.padStart(7)} ${'concentration'.padStart(14)}`);
for (const p of [CYCLE, CYCLE / 2, 2 * CYCLE, 17.0, 60.0]) {
  const r = concentration(birds, p);
  const note = Math.abs(p - CYCLE) < 0.01 ? "   <- the gust's own" : '';
  console.log(`   ${p.toFixed(1).padStart(7)} s ${String(birds.length).padStart(7)} ${r.toFixed(3).padStart(14)}${note}`);
}
// what a set of the same size, spread evenly at random, would show — the null this is read against
const rng = createRng('gaps/phase/null');
const nulls = [];
for (let k = 0; k < 200; k++) {
  const fake = Array.from({ length: birds.length }, () => rng() * SECONDS);
  nulls.push(concentration(fake, CYCLE));
}
nulls.sort((a, b) => a - b);
console.log(`\n   for ${birds.length} calls scattered at random the concentration is ${nulls[100].toFixed(3)} typically and`);
console.log(`   ${nulls[198].toFixed(3)} at the 99th percentile — that is the line a real pile-up has to clear.`);

fs.writeFileSync(path.join(out, 'phase.json'), JSON.stringify({ seconds: SECONDS, cycle: CYCLE, birds: birds.length, lulls: lulls.length, lullMean, concentration: concentration(birds, CYCLE), null99: nulls[198] }, null, 1));
console.log(`\nwrote ${path.join(out, 'phase.json')}`);
