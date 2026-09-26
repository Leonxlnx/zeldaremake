#!/usr/bin/env node
/**
 * candidates.mjs — four ways to build a two-channel impulse, measured against what a hall is for.
 *
 *   node art/audio/2026-09-26-hall/candidates.mjs
 *
 * `art/audio/2026-09-26-mono/` found the score sitting 1.6 dB left of centre and traced it to the
 * shared hall: `impulseResponse` builds its two channels from two independent noise streams, so
 * they match to a tenth of a decibel summed over the spectrum and are out by **up to 9.8 dB at a
 * single pitch**. A bed of noise averages that away. A tune only has the pitches it has.
 *
 * A hall wants two things at once and they pull against each other:
 *
 *   * **decorrelated**, or it is not a space — two channels that are the same signal collapse to
 *     a point between the speakers and the tail sounds like a delay rather than a room.
 *   * **matched in magnitude**, or every tone put through it lands off-centre.
 *
 * Independent noise gets the first and fails the second. This measures four constructions on
 * both, plus the things that must not move: when the tail arrives (the gorge's wall is a
 * published 29 ms) and how long it lasts.
 *
 * No render and no change to `graph.ts` yet — the variants are built here so the winner can be
 * chosen on numbers rather than on which one sounds most clever.
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

const { createRng } = loadTs('src/world/util/prng.ts');
const SR = 44100;

/* ---- the four constructions ------------------------------------------------------------- */

/** the shipped shape of one channel, given the noise it is to be built from */
function shape(noise, n, pre, damp, rEarly, earlyAt, earlySpread) {
  const d = new Float64Array(n);
  let lp = 0;
  for (let i = pre; i < n; i++) {
    const j = i - pre;
    const t = j / (n - pre);
    const env = Math.exp(-t * 6.5) * (j < 400 ? j / 400 : 1);
    const k = 0.15 + damp * 0.8 * t;
    lp += (noise[i] - lp) * (1 - k);
    d[i] = lp * env;
  }
  for (let e = 0; e < 8; e++) {
    const at = Math.floor(SR * (earlyAt + rEarly() * earlySpread));
    const g = 0.35 * (1 - e / 8);
    if (at < n) d[at] += (rEarly() * 2 - 1) * g;
  }
  return d;
}

function noiseOf(r, n) {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = r() * 2 - 1;
  return a;
}

/** a real FFT, iterative radix-2 */
function fft(re, im, inverse = false) {
  const n = re.length;
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
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
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
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

const BUILD = {
  /** as it ships: two independent noise streams */
  independent(rng, n, pre, damp, earlyAt, earlySpread) {
    return [0, 1].map((c) => {
      const r = rng.fork(`ir${c}`);
      return shape(noiseOf(r, n), n, pre, damp, rng.fork(`ir${c}`), earlyAt, earlySpread);
    });
  },
  /** one noise stream, the second channel hearing it backwards */
  reversed(rng, n, pre, damp, earlyAt, earlySpread) {
    const base = noiseOf(rng.fork('ir0'), n);
    const back = Float64Array.from(base).reverse();
    return [base, back].map((src, c) => shape(src, n, pre, damp, rng.fork(`ir${c}`), earlyAt, earlySpread));
  },
  /** one noise stream, the second channel's spectrum rotated a quarter turn at every frequency */
  quadrature(rng, n, pre, damp, earlyAt, earlySpread) {
    const base = noiseOf(rng.fork('ir0'), n);
    const m = 1 << Math.ceil(Math.log2(n));
    const re = new Float64Array(m);
    const im = new Float64Array(m);
    re.set(base);
    fft(re, im);
    // +90° on the positive frequencies, −90° on the negative: the Hilbert transform
    for (let k = 1; k < m / 2; k++) {
      [re[k], im[k]] = [im[k], -re[k]];
      [re[m - k], im[m - k]] = [-im[m - k], re[m - k]];
    }
    fft(re, im, true);
    const shifted = re.subarray(0, n);
    return [base, shifted].map((src, c) => shape(src, n, pre, damp, rng.fork(`ir${c}`), earlyAt, earlySpread));
  },
  /** one magnitude spectrum, two independent sets of phases */
  phased(rng, n, pre, damp, earlyAt, earlySpread) {
    const base = noiseOf(rng.fork('ir0'), n);
    const m = 1 << Math.ceil(Math.log2(n));
    const re = new Float64Array(m);
    const im = new Float64Array(m);
    re.set(base);
    fft(re, im);
    const mag = new Float64Array(m / 2 + 1);
    for (let k = 0; k <= m / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    const out = [];
    for (let c = 0; c < 2; c++) {
      const pr = rng.fork(`irphase${c}`);
      const a = new Float64Array(m);
      const b = new Float64Array(m);
      a[0] = mag[0];
      a[m / 2] = mag[m / 2];
      for (let k = 1; k < m / 2; k++) {
        const th = pr() * 2 * Math.PI;
        a[k] = mag[k] * Math.cos(th);
        b[k] = mag[k] * Math.sin(th);
        a[m - k] = a[k];
        b[m - k] = -b[k];
      }
      fft(a, b, true);
      out.push(shape(a.subarray(0, n), n, pre, damp, rng.fork(`ir${c}`), earlyAt, earlySpread));
    }
    return out;
  },
};

/* ---- what each has to answer for ---------------------------------------------------------- */

const hz = (mi) => 440 * 2 ** ((mi - 69) / 12);
const CHORD_TONES = [50, 52, 55, 57, 59, 62, 64];
const PITCHES = [...new Set([...CHORD_TONES.map((n) => n - 12), ...CHORD_TONES, ...CHORD_TONES.map((n) => n + 12), ...CHORD_TONES.map((n) => n + 24)])].sort((a, b) => a - b);
const db = (v) => 10 * Math.log10(Math.max(v, 1e-30));

function magOf(x) {
  const m = 1 << Math.ceil(Math.log2(x.length));
  const re = new Float64Array(m);
  const im = new Float64Array(m);
  re.set(x);
  fft(re, im);
  const out = new Float64Array(m / 2 + 1);
  for (let i = 0; i <= m / 2; i++) out[i] = re[i] * re[i] + im[i] * im[i];
  return { p: out, m };
}

function judge(L, R) {
  const a = magOf(L);
  const b = magOf(R);
  const df = SR / a.m;
  const per = [];
  for (const mi of PITCHES) {
    const f = hz(mi);
    const lo = Math.floor((f * (1 - 1 / 60)) / df);
    const hi = Math.ceil((f * (1 + 1 / 60)) / df);
    let x = 0;
    let y = 0;
    for (let i = lo; i <= hi && i < a.p.length; i++) {
      x += a.p[i];
      y += b.p[i];
    }
    if (x > 0 && y > 0) per.push(db(x) - db(y));
  }
  const mean = per.reduce((s, v) => s + v, 0) / per.length;
  const sd = Math.sqrt(per.reduce((s, v) => s + (v - mean) ** 2, 0) / per.length);
  // decorrelation, the other half of what a hall is for
  let ll = 0;
  let rr = 0;
  let lr = 0;
  for (let i = 0; i < L.length; i++) {
    ll += L[i] * L[i];
    rr += R[i] * R[i];
    lr += L[i] * R[i];
  }
  // when the tail arrives and how long it lasts, neither of which may move
  const onset = (d) => {
    const peak = Math.max(...Array.from(d, Math.abs));
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak * 0.05) return (i / SR) * 1000;
    return NaN;
  };
  const t60 = (d) => {
    let e = 0;
    const cum = new Float64Array(d.length);
    for (let i = d.length - 1; i >= 0; i--) {
      e += d[i] * d[i];
      cum[i] = e;
    }
    for (let i = 0; i < d.length; i++) if (10 * Math.log10(cum[i] / cum[0]) < -60) return (i / SR) * 1000;
    return (d.length / SR) * 1000;
  };
  return {
    worst: Math.max(...per.map(Math.abs)),
    sd,
    corr: lr / Math.sqrt(ll * rr),
    onsetL: onset(L),
    onsetR: onset(R),
    t60: (t60(L) + t60(R)) / 2,
    broadband: db(a.p.reduce((s, v) => s + v, 0)) - db(b.p.reduce((s, v) => s + v, 0)),
  };
}

const SPACES = [
  ['hall', 'ir', 1.5, 0.96, 0.012, 0.06, 0],
  ['room', 'roomir', 0.6, 0.9, 0.007, 0.03, 0.007],
  ['gorge', 'gorgeir', 0.9, 0.45, 0.029, 0.03, 0.029],
];

console.log('\nfour ways to build a two-channel impulse\n');
console.log(`  ${'space'.padEnd(7)}${'construction'.padEnd(14)}${'worst at a pitch'.padStart(18)}${'spread'.padStart(9)}${'L·R'.padStart(8)}${'broadband'.padStart(11)}${'tail starts L/R'.padStart(18)}${'T60'.padStart(9)}`);
for (const [space, seed, secs, damp, earlyAt, earlySpread, preDelay] of SPACES) {
  for (const [name, build] of Object.entries(BUILD)) {
    const n = Math.floor(SR * secs);
    const pre = Math.floor(SR * preDelay);
    const [L, R] = build(createRng('zelda-audio').fork(seed), n, pre, damp, earlyAt, earlySpread);
    const j = judge(L, R);
    console.log(
      `  ${space.padEnd(7)}${name.padEnd(14)}${j.worst.toFixed(2).padStart(15)} dB${j.sd.toFixed(2).padStart(7)} dB${j.corr.toFixed(3).padStart(8)}${j.broadband.toFixed(2).padStart(9)} dB${(j.onsetL.toFixed(1) + ' / ' + j.onsetR.toFixed(1)).padStart(16)} ms${j.t60.toFixed(0).padStart(6)} ms`,
    );
  }
  console.log('');
}
console.log('  a hall has to be BOTH: decorrelated (L·R near 0) and matched (worst at a pitch near 0).');
console.log('  the tail must still start when it did — the gorge\u2019s 29 ms is a published measurement.');
