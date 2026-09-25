#!/usr/bin/env node
/**
 * cadence.mjs — how many steps he takes per metre, against how often the audio is asked.
 *
 *   node art/audio/2026-09-25-tickrate/cadence.mjs
 *
 * Check 28 of `art/audio/RUBRIC_50_SOUND.md` is "nothing fires twice for one event, and nothing is
 * missed at any frame rate". I scored it 3 with the note **"not tested across frame rates"**. The
 * two other notes of that kind this week each turned out to be covering a real fault.
 *
 * There is a reason to expect one here. Steps are fired by a distance integrator:
 *
 *     travelled += speed * dt;
 *     if (travelled >= stride) { travelled -= stride; fire(); }
 *
 * It subtracts ONE stride and fires ONCE, however far he went. So a tick long enough to cover two
 * strides throws the second away. The audio runs on a `setInterval` at 33 ms nominal, which is fine
 * — but a loaded box stretches a timer, and a background tab clamps it to a second.
 *
 * No rendering: `createFootsteps` against a fake context counts what it fires. Steps per metre is
 * the number that must not move, because a stride is a distance and not a time.
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
  const m = { exports: {} };
  modules.set(file, m);
  const src = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', src)(
    (n) => {
      if (!n.startsWith('.')) return nodeRequire(n);
      const t = path.resolve(path.dirname(file), n);
      for (const c of [t + '.ts', path.join(t, 'index.ts'), t]) if (existsSync(c)) return loadTs(c);
      throw Error(n);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const F = loadTs(path.join(here, '../../../src/audio/footsteps.ts'));
const { createRng } = loadTs(path.join(here, '../../../src/world/util/prng.ts'));

const param = (v) => ({ value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
const node = (kind, extra = {}) => ({ kind, outputs: [], connect(d) { this.outputs.push(d); return d; }, disconnect() {}, ...extra });
const fakeCtx = () => ({
  sampleRate: 44100,
  currentTime: 0,
  startRendering: () => {},
  destination: node('dest'),
  createGain: () => node('gain', { gain: param(1) }),
  createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(1), Q: param(1), gain: param(0) }),
  createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }),
  createStereoPanner: () => node('pan', { pan: param(0) }),
  createBufferSource: () => node('src', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} }),
  createConvolver: () => node('conv', { buffer: null, normalize: true }),
  createDelay: () => node('delay', { delayTime: param(0) }),
  createDynamicsCompressor: () => node('comp', { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }),
  createBuffer(c, l, r) { const d = Array.from({ length: c }, () => new Float32Array(l)); return { length: l, sampleRate: r, duration: l / r, numberOfChannels: c, getChannelData: (i) => d[i], copyToChannel: (s, i) => d[i].set(s.subarray(0, d[i].length)) }; },
});

/** walk `metres` at `speed`, asked every `dt` seconds; returns steps heard */
function march(speed, dt, metres, surface = 'stone') {
  const ctx = fakeCtx();
  const steps = F.createFootsteps(ctx, ctx.createGain(), ctx.createGain(), null, createRng('tick'), 0);
  const total = metres / speed;
  for (let t = 0; t < total; t += dt) steps.drive(t, dt, { speed, surface, onStairs: false });
  return steps.stats().steps;
}

const METRES = 400;
const TICKS = [1 / 120, 1 / 60, 1 / 30, 1 / 20, 1 / 15, 1 / 10, 1 / 6, 1 / 4, 1 / 2, 1];
const out = {};
for (const [label, gait, speed] of [['a walk', 'walk', F.WALK_SPEED], ['a run', 'run', F.RUN_GROUND_SPEED]]) {
  const want = 1 / F.strideFor(speed, false);
  out[gait] = { speed, want, rows: [] };
  console.log(`\n${label} at ${speed} m/s — a stride is ${F.strideFor(speed, false).toFixed(2)} m, so ${want.toFixed(3)} steps a metre whatever the tick`);
  console.log(`${'tick'.padStart(9)} ${'steps/m'.padStart(9)} ${'of what it should be'.padStart(21)}`);
  for (const dt of TICKS) {
    const got = march(speed, dt, METRES) / METRES;
    out[gait].rows.push({ dt, perMetre: got });
    const share = got / want;
    const flag = share < 0.98 ? '   <-- dropping steps' : share > 1.02 ? '   <-- firing extra' : '';
    console.log(`${(dt * 1000).toFixed(1).padStart(7)}ms ${got.toFixed(3).padStart(9)} ${(share * 100).toFixed(0).padStart(19)}%${flag}`);
  }
}

if (process.argv.includes('--json')) {
  const to = process.argv[process.argv.indexOf('--json') + 1];
  (await import('node:fs')).writeFileSync(to, JSON.stringify(out, null, 1));
  console.error('[cadence] wrote', to);
}
