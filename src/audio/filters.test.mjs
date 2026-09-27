// node --test src/audio/filters.test.mjs — what `Q` means to a biquad, and to the lane.
//
// `BiquadFilterNode.Q` is not one quantity. For `bandpass`, `notch`, `allpass` and `peaking` it is
// a traditional quality factor; the shelves ignore it; and for `lowpass` and `highpass` the spec
// says it "is not a traditional Q, but is a resonance value in decibels". Measured in a browser
// (art/audio/2026-09-27-q/) it is exactly the gain at the cutoff, to two decimals.
//
// This lane wrote 0.5 to 0.9 at seventeen lowpass and highpass call sites, 0.7 standing in for
// Butterworth. Under the parameter's real meaning every one of them was a resonant peak of +1.59
// to +1.89 dB at about 0.76 of its corner — not a large error anywhere, but an error in
// the same direction at every filter in the bed, which is how a floor rises without anyone
// choosing it. `filter()` converts, so the numbers keep reading as the quality factors they are.
//
// The conversion is asserted three ways: the arithmetic, the single choke point (nothing may build
// a biquad without going through the helper, or the convention has a hole in it), and the response
// itself, evaluated from the transfer function rather than taken on trust.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) throw Error(`unexpected import ${name}`);
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
const G = loadTs(path.join(here, 'graph.ts'));

const param = (value) => ({ value });
const fakeContext = () => ({
  sampleRate: 48000,
  createBiquadFilter: () => ({ type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
});

/**
 * The magnitude response of a biquad at `hz`, in dB, from the Audio EQ Cookbook coefficients the
 * spec prescribes — the same arithmetic the browser does, so the assertions below do not need one.
 */
function responseDb(type, fc, q, hz, sampleRate = 48000) {
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosw0 = Math.cos(w0);
  // for lowpass and highpass the spec's alpha comes from Q in dB, exactly as the node reads it
  const alpha = Math.sin(w0) / (2 * Math.pow(10, q / 20));
  let b0, b1, b2;
  if (type === 'lowpass') {
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
  } else {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  const w = (2 * Math.PI * hz) / sampleRate;
  const num = { re: b0 + b1 * Math.cos(-w) + b2 * Math.cos(-2 * w), im: b1 * Math.sin(-w) + b2 * Math.sin(-2 * w) };
  const den = { re: a0 + a1 * Math.cos(-w) + a2 * Math.cos(-2 * w), im: a1 * Math.sin(-w) + a2 * Math.sin(-2 * w) };
  return 20 * Math.log10(Math.hypot(num.re, num.im) / Math.hypot(den.re, den.im));
}

test('a lowpass and a highpass are given the quality factor they are asked for, in the units the node wants', () => {
  for (const type of ['lowpass', 'highpass']) {
    for (const q of [0.5, 0.6, 0.7, 0.707, 0.8, 0.9]) {
      const f = G.filter(fakeContext(), type, 1000, q);
      assert.ok(
        Math.abs(f.Q.value - 20 * Math.log10(q)) < 1e-9,
        `${type} Q ${q} reached the node as ${f.Q.value}, not the ${(20 * Math.log10(q)).toFixed(3)} dB of cutoff gain that quality factor asks for`,
      );
    }
  }
});

test('the types whose Q really is a Q keep the number they were given', () => {
  for (const [type, q] of [
    ['bandpass', 5],
    ['bandpass', 1.1],
    ['notch', 2],
    ['allpass', 1],
    ['peaking', 1.4],
    // the shelves ignore Q entirely; passing it through is what "untouched" means
    ['lowshelf', 0.7],
    ['highshelf', 0.7],
  ]) {
    assert.equal(G.filter(fakeContext(), type, 1000, q).Q.value, q, `${type} Q ${q} was converted, and its Q is already a quality factor`);
  }
});

test('0.707 is Butterworth and 0.9 peaks where a 0.9 should, evaluated from the transfer function', () => {
  const peakOf = (type, fc, qDb) => {
    let best = -Infinity;
    for (let hz = 20; hz < 20000; hz *= 1.001) best = Math.max(best, responseDb(type, fc, qDb, hz));
    return best;
  };
  for (const type of ['lowpass', 'highpass']) {
    const butter = G.filter(fakeContext(), type, 1000, Math.SQRT1_2);
    assert.ok(Math.abs(responseDb(type, 1000, butter.Q.value, 1000) + 3.01) < 0.02, `a ${type} at Q 0.707 must be −3.01 dB at its corner, not ${responseDb(type, 1000, butter.Q.value, 1000).toFixed(2)}`);
    assert.ok(peakOf(type, 1000, butter.Q.value) < 0.01, `a ${type} at Q 0.707 must not peak anywhere; it reaches ${peakOf(type, 1000, butter.Q.value).toFixed(2)} dB`);
    // and the peak a real quality factor gives: 20 log10(Q / sqrt(1 - 1/(4 Q^2)))
    const gentle = G.filter(fakeContext(), type, 1000, 0.9);
    const want = 20 * Math.log10(0.9 / Math.sqrt(1 - 1 / (4 * 0.81)));
    assert.ok(Math.abs(peakOf(type, 1000, gentle.Q.value) - want) < 0.03, `a ${type} at Q 0.9 must peak at ${want.toFixed(2)} dB, not ${peakOf(type, 1000, gentle.Q.value).toFixed(2)}`);
    // the old reading, for the record: 0.7 written straight into the node is a peak, not flat
    assert.ok(peakOf(type, 1000, 0.7) > 1.5, 'the unconverted reading is supposed to be the resonant one; if it is not, the convention has changed under this test');
  }
});

test('nothing builds a biquad except the helper, so the convention has no way round it', () => {
  const offenders = [];
  for (const file of readdirSync(here)) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(path.join(here, file), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/createBiquadFilter\(/.test(line) && file !== 'graph.ts') offenders.push(`${file}:${i + 1}`);
      // and no one may reach past the helper to set Q afterwards, which would be the old units again
      if (/\.Q\.value\s*=/.test(line) && !/f\.Q\.value = type ===/.test(line)) offenders.push(`${file}:${i + 1} sets .Q.value directly`);
    });
  }
  assert.deepEqual(offenders, [], `these build or retune a biquad outside filter(), where the dB-versus-Q conversion lives: ${offenders.join(', ')}`);
});
