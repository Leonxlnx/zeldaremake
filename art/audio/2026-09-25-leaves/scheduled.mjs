#!/usr/bin/env node
/**
 * scheduled.mjs — where the bed PUTS its leaves, read off the graph rather than out of a file.
 *
 *   node art/audio/2026-09-25-leaves/scheduled.mjs [--out /tmp/leaves]
 *
 * `width.py` reads the stereo file and cannot resolve the flutters: the loud moments in their band
 * are bird calls, twenty decibels over the bed, and the leaves lift the band's median by two or
 * three. So the file is the wrong instrument for this one, and the graph is the right one — the pan
 * every voice is actually given, with no audio at all.
 *
 * A minimal stand-in for WebAudio, the same trick `ambience.test.mjs` uses: every node records what
 * it was told, and a panner's `pan.value` is what the bed decided. Only what the bed touches is
 * implemented.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (fs.existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(args.out || '/tmp/leaves');
const A = loadTs(path.join(here, '../../../src/audio/ambience.ts'));
const { createRng } = loadTs(path.join(here, '../../../src/world/util/prng.ts'));

const param = (value) => ({ value, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
function fakeContext() {
  const made = { gain: [], filter: [], osc: [], source: [], panner: [] };
  const node = (kind, extra = {}) => ({ kind, connect(d) { return d; }, disconnect() {}, ...extra });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    destination: node('destination'),
    made,
    createGain: () => { const n = node('gain', { gain: param(1) }); made.gain.push(n); return n; },
    createBiquadFilter: () => { const n = node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }); made.filter.push(n); return n; },
    createOscillator: () => { const n = node('osc', { type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }); made.osc.push(n); return n; },
    createStereoPanner: () => { const n = node('panner', { pan: param(0) }); made.panner.push(n); return n; },
    createBufferSource: () => { const n = node('source', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} }); made.source.push(n); return n; },
    createBuffer: (channels, length, rate) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate: rate, duration: length / rate, numberOfChannels: channels, getChannelData: (c) => data[c], copyToChannel: (s, c) => data[c].set(s.subarray(0, data[c].length)) };
    },
    startRendering: () => {},
  };
  return ctx;
}

/** every pan the bed hands out over a minute of standing in one place, at a stated canopy */
function pansAt(canopy) {
  const ctx = fakeContext();
  const amb = A.createAmbience(ctx, ctx.createGain(), ctx.createGain(), createRng('leaves/scheduled'), 0);
  for (let t = 0; t < 60; t += 1 / 30) {
    amb.update(t, { gust: 0.9, listener: { x: 0, y: 1.2, z: 0 }, forward: { x: 0, z: -1 }, pods: [], canopy });
    amb.scheduleUntil(t + 4);
  }
  return ctx.made.panner.map((p) => p.pan.value).filter((v) => Math.abs(v) > 1e-9);
}

const report = { perchPan: A.PERCH_PAN, open: pansAt(0), crowns: pansAt(1) };
const p90 = (v) => v.map(Math.abs).sort((a, b) => a - b)[Math.floor(v.length * 0.9)];
console.log(`${'canopy'.padEnd(8)} ${'voices'.padStart(6)} ${'width (p90)'.padStart(12)} ${'hardest'.padStart(8)}   PERCH_PAN ${A.PERCH_PAN}`);
for (const k of ['open', 'crowns']) {
  const v = report[k];
  console.log(`${k.padEnd(8)} ${String(v.length).padStart(6)} ${p90(v).toFixed(3).padStart(12)} ${Math.max(...v.map(Math.abs)).toFixed(3).padStart(8)}`);
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'scheduled.json'), JSON.stringify(report));
console.log(`wrote ${path.join(out, 'scheduled.json')}`);
