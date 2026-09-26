#!/usr/bin/env node
/**
 * hall.mjs — the shared hall is balanced, unless you play it a note.
 *
 *   node art/audio/2026-09-26-mono/hall.mjs
 *
 * The score leans left, and the harp — the only panned voice in the music — is not the reason.
 * Rendering the same take with `reverb: false` puts it dead centre (+0.02 dB, every band inside
 * 0.22), so the lean is the shared hall's.
 *
 * `impulseResponse` builds its two channels from two independent noise streams (`rng.fork('ir0')`
 * and `ir1`). Summed over the whole spectrum that is fine — the two come out inside a tenth of a
 * decibel of each other, which is the number anyone would check. But **the balance a source
 * actually gets is the balance at the frequencies the source has**, and at any single frequency
 * two independent noise spectra differ by a lot: the ratio of two independent chi-squared-2
 * variables has no narrow peak at 1.
 *
 * A broadband source averages that away over thousands of bins. A TONE does not. This walks the
 * score's own pitches and reports what the hall does at each, which is the difference between a
 * hall that is balanced and a hall that is balanced for the thing being put through it.
 *
 * No render: the impulse is a pure function of the seed.
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
      throw Error(`cannot resolve ${n}`);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const G = loadTs('src/audio/graph.ts');
const { createRng } = loadTs('src/world/util/prng.ts');
const SR = 44100;

const ctx = {
  sampleRate: SR,
  createBuffer(c, l, r) {
    const d = Array.from({ length: c }, () => new Float32Array(l));
    return { length: l, sampleRate: r, numberOfChannels: c, getChannelData: (i) => d[i], copyToChannel: (s, i) => d[i].set(s.subarray(0, d[i].length)) };
  },
};

/** the seed the shipped graph uses, so these are the impulses the game runs */
const SEED = 'zelda-audio';
const SPACES = [
  ['hall', 'ir', 1.5, 0.96, []],
  ['room', 'roomir', G.ROOM_SECONDS, 0.9, [G.ROOM_EARLY_AT, G.ROOM_EARLY_SPREAD, G.ROOM_EARLY_AT]],
  ['gorge', 'gorgeir', G.GORGE_SECONDS, G.GORGE_DAMP, [G.GORGE_EARLY_AT, G.GORGE_EARLY_SPREAD, G.GORGE_EARLY_AT]],
];

/** a real FFT, iterative radix-2 — the impulses are a second or two, so this is instant */
function rfft(x) {
  const n = 1 << Math.ceil(Math.log2(x.length));
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(x);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(ang * k);
        const s = Math.sin(ang * k);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s;
        const vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
  const half = n / 2 + 1;
  const mag = new Float64Array(half);
  for (let i = 0; i < half; i++) mag[i] = re[i] * re[i] + im[i] * im[i];
  return { mag, n };
}

const db = (v) => 10 * Math.log10(Math.max(v, 1e-30));
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

/** the score's own pitches: the chord tones, the harp's two octave lifts, and the pad an octave down */
const CHORD_TONES = [50, 52, 55, 57, 59, 62, 64];
const PITCHES = [...new Set([...CHORD_TONES.map((n) => n - 12), ...CHORD_TONES, ...CHORD_TONES.map((n) => n + 12), ...CHORD_TONES.map((n) => n + 24)])].sort((a, b) => a - b);

console.log('\nthe shared spaces, broadband and at a note\n');
console.log(`  ${'space'.padEnd(8)}${'broadband'.padStart(11)}${'at the score\u2019s pitches: worst left'.padStart(35)}${'worst right'.padStart(13)}${'spread (sd)'.padStart(13)}`);
const rows = [];
for (const [name, seed, secs, damp, extra] of SPACES) {
  const buf = G.impulseResponse(ctx, createRng(SEED).fork(seed), secs, damp, ...extra);
  const L = rfft(buf.getChannelData(0));
  const R = rfft(buf.getChannelData(1));
  const df = SR / L.n;
  let el = 0;
  let er = 0;
  for (let i = 0; i < L.mag.length; i++) {
    el += L.mag[i];
    er += R.mag[i];
  }
  // a note is not one bin: it rings, so integrate a narrow band around each pitch (Q = 30)
  const per = [];
  for (const m of PITCHES) {
    const f = hz(m);
    const lo = Math.floor((f * (1 - 1 / 60)) / df);
    const hi = Math.ceil((f * (1 + 1 / 60)) / df);
    let a = 0;
    let b = 0;
    for (let i = lo; i <= hi && i < L.mag.length; i++) {
      a += L.mag[i];
      b += R.mag[i];
    }
    if (a > 0 && b > 0) per.push({ midi: m, hz: f, db: db(a) - db(b) });
  }
  const v = per.map((p) => p.db);
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
  rows.push({ name, broadband: db(el) - db(er), per, sd });
  console.log(`  ${name.padEnd(8)}${(db(el) - db(er)).toFixed(2).padStart(9)} dB${Math.max(...v).toFixed(2).padStart(31)} dB${Math.min(...v).toFixed(2).padStart(11)} dB${sd.toFixed(2).padStart(11)} dB`);
}
console.log('\n  positive is left. Broadband every space is inside a tenth of a decibel; at a single');
console.log('  pitch they are out by several, and which way round depends on the pitch. A bed of noise');
console.log("  averages that away. A tune cannot — it only has the pitches it has.\n");
const hall = rows[0];
console.log(`  the hall, pitch by pitch (the score's own notes)`);
for (const p of hall.per) console.log(`    midi ${String(p.midi).padStart(3)}  ${p.hz.toFixed(1).padStart(7)} Hz  ${(p.db >= 0 ? '+' : '') + p.db.toFixed(2)}`);
