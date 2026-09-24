#!/usr/bin/env node
/**
 * measure.mjs — how many birds does the wood have in it?
 *
 *   node art/audio/2026-09-24-perches/measure.mjs [--minutes 20]
 *
 * The bed schedules a bird every few seconds, picks its kind from a weighted list, and then draws
 * **a fresh bearing and a fresh distance for it**. So there are no birds: there is a stream of
 * calls arriving from wherever. A real wood has a handful of individuals sitting in their own
 * places, each calling from the same direction over and over, occasionally answering one another —
 * and that is most of what makes a wood sound inhabited rather than sprinkled.
 *
 * This drives the real `createAmbience` against a fake audio context and reads back the bearing of
 * every call from the panner it builds, so the question is answered from the shipping scheduler
 * rather than from reading the source. Two numbers say it: how much a call's bearing tells you
 * about the next call of the same kind, and how many distinct directions the wood actually has.
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
const SECONDS = Number(args.minutes ?? 20) * 60;

const gustAt = (t) => {
  const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
  const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
  return Math.min(1, g * 0.8 + push * 0.6);
};

/** the least audio context the bed will build against */
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  return {
    currentTime: 0,
    sampleRate: 44100,
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
// the bed reports where each call came from (AmbienceStats.birdSpots), newest last, so the
// scheduler's own decisions are read rather than inferred from the nodes it happened to build
const calls = [];
let seen = 0;
for (let t = 0; t < SECONDS; t += 0.05) {
  amb.update(t, { gust: gustAt(t), listener: { x: 0, y: 1.2, z: 0 }, forward: { x: 0, z: 1 }, pods: [], canopy: 1 });
  amb.scheduleUntil(t + 4);
  const st = amb.stats();
  if (st.birds > seen) {
    const fresh = st.birdSpots.slice(Math.max(0, st.birdSpots.length - (st.birds - seen)));
    for (const [kind, pan, distance] of fresh) calls.push({ at: Number((t + 4).toFixed(2)), kind, pan, distance });
    seen = st.birds;
  }
}

const pans = calls.map((c) => c.pan).filter((v) => Number.isFinite(v));
console.log(`${(SECONDS / 60).toFixed(0)} minutes: ${calls.length} calls`);
console.log(`  bearings run ${Math.min(...pans).toFixed(2)} … ${Math.max(...pans).toFixed(2)}`);

/**
 * The question is not how many directions exist, it is whether a KIND keeps its place. A wood with
 * individuals in it answers yes: every whistle comes from the whistle's tree. A stream of calls
 * answers no.
 */
const byKind = new Map();
for (const c of calls) (byKind.get(c.kind) ?? byKind.set(c.kind, []).get(c.kind)).push(c);
const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };
console.log();
console.log('  kind        calls   bearing spread   distance spread');
let spreadPan = [];
let spreadD = [];
for (const [kind, cs] of [...byKind].sort()) {
  const sp = sd(cs.map((c) => c.pan));
  const sdst = sd(cs.map((c) => c.distance));
  spreadPan.push(sp);
  spreadD.push(sdst);
  console.log(`  ${kind.padEnd(10)} ${String(cs.length).padStart(6)} ${sp.toFixed(3).padStart(16)} ${sdst.toFixed(3).padStart(17)}`);
}
console.log();
console.log(`  a kind's calls scatter ${mean(spreadPan).toFixed(3)} across the stereo field and ${mean(spreadD).toFixed(3)} in distance on average.`);
console.log('  A bird that sits somewhere scatters ~0. A stream of calls from nowhere scatters ~0.5 in a ±0.85 field.');
console.log();
console.log(`  distinct perches the wood has: ${new Set(calls.map((c) => `${c.kind}|${c.pan}|${c.distance}`)).size} of ${calls.length} calls`);
