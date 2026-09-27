#!/usr/bin/env node
/**
 * q.mjs — what `Q` means to the filters this lane builds.
 *
 *   node art/audio/2026-09-27-q/q.mjs --dist dist --out /tmp/q
 *
 * `graph.ts`'s `filter(ctx, type, frequency, Q)` passes `Q` straight to a `BiquadFilterNode`, and
 * the lane picks values the way anyone would pick a quality factor: 0.5 to 0.9 on the lowpasses
 * and highpasses, with 0.7 standing in for Butterworth. Twelve filters in the bed are set that
 * way.
 *
 * The Web Audio spec says something else for those two types. For `lowpass` and `highpass`, Q is
 * *"not a traditional Q, but is a resonance value in decibels"* — so 0.7 would be 0.7 dB of lift
 * at the cutoff rather than the maximally-flat response that number means everywhere else. Under
 * the other reading a `lowpass` at Q 0.9 has a peak; under the usual one it does not.
 *
 * `2026-09-27-bottom` was just caught by one filter convention (the body and the husk are two
 * reads of one tap, so their phases interact), and the right response to that is to check the
 * other rather than to assume.
 *
 * Measured, not read: an impulse through one filter in an `OfflineAudioContext` is that filter's
 * response exactly. No world is loaded — this is arithmetic the browser does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/q');
const log = (...m) => console.error('[q]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the magnitude spectrum of an impulse response, in dB, as {hz, db} points */
function magnitudes(ir, sr) {
  let n = 1;
  while (n < ir.length) n *= 2;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(ir);
  fft(re, im);
  const pts = [];
  for (let k = 1; k < n / 2; k++) pts.push({ hz: (k * sr) / n, db: 20 * Math.log10(Math.max(Math.hypot(re[k], im[k]), 1e-12)) });
  return pts;
}

/**
 * How much power flat noise loses going from one filter to the other, which is the number that
 * predicts a floor. Parseval: the energy in an impulse response IS the integral of |H|² over
 * frequency, so this is a sum over the two responses and no noise has to be rendered.
 */
function power(a, b) {
  const e = (ir) => ir.reduce((s, v) => s + v * v, 0);
  return 10 * Math.log10(e(a) / e(b));
}

/** the response at one frequency, read between the two bins that straddle it */
function interp(spec, hz) {
  for (let i = 1; i < spec.length; i++) {
    if (spec[i].hz >= hz) {
      const t = (hz - spec[i - 1].hz) / (spec[i].hz - spec[i - 1].hz);
      return spec[i - 1].db + t * (spec[i].db - spec[i - 1].db);
    }
  }
  return spec[spec.length - 1].db;
}

/** a traditional-Q lowpass peaks at 20 log10(Q / sqrt(1 - 1/(4 Q^2))); invert that to compare in one unit */
function traditionalQFor(peakDb) {
  if (peakDb <= 0.01) return '≤0.71';
  const g = 10 ** (peakDb / 20);
  // g^2 = Q^2 / (1 - 1/(4Q^2))  →  Q^2 = (g^2 + sqrt(g^4 - g^2)) / 2 ... solved numerically to stay honest
  let lo = 0.7072,
    hi = 100;
  for (let i = 0; i < 200; i++) {
    const q = (lo + hi) / 2;
    const p = 20 * Math.log10(q / Math.sqrt(1 - 1 / (4 * q * q)));
    if (p < peakDb) lo = q;
    else hi = q;
  }
  return ((lo + hi) / 2).toFixed(2);
}

/** in-place radix-2 FFT */
function fft(re, im) {
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
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * Every `filter(ctx, type, hz, q)` in `src/audio/` whose cutoff and Q are both literals, read from
 * the source so this table cannot drift from the code it describes. The ones built from a variable
 * (`birdTop(...)`, `centre * 2.6`, `p.lp`) are listed in the README by hand — the convention bites
 * them the same way, it just cannot be quoted at one frequency.
 */
function callSites(root) {
  const sites = [];
  for (const file of ['ambience.ts', 'footsteps.ts', 'graph.ts', 'music.ts']) {
    const src = fs.readFileSync(path.join(root, 'src/audio', file), 'utf8').split('\n');
    src.forEach((line, i) => {
      const m = /filter\(ctx, '(lowpass|highpass)', ([\d.]+), ([-\d.]+)\)/.exec(line);
      if (m) sites.push({ where: `${file}:${i + 1}`, type: m[1], hz: Number(m[2]), q: Number(m[3]) });
    });
  }
  return sites;
}

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 320, height: 240 });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  // a blank page is enough: nothing here needs the game, only the browser's audio
  await page.goto(`${server.url}/?capture=1&dev=0&hud=0&warmup=0`, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS });

  const sites = callSites(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..'));
  const rows = await page.evaluate(async (realSites) => {
    const SR = 48000;
    const N = 16384;
    /** the response of one filter, read two ways: from `getFrequencyResponse`, and from an impulse */
    const measure = async (type, hz, q) => {
      const ctx = new OfflineAudioContext(1, N, SR);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      // getFrequencyResponse is the browser telling us what it thinks it is doing
      const probe = new Float32Array([hz]);
      const mag = new Float32Array(1);
      const phase = new Float32Array(1);
      f.getFrequencyResponse(probe, mag, phase);
      // and an impulse through it is what it actually does
      const buf = ctx.createBuffer(1, N, SR);
      buf.getChannelData(0)[0] = 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(f).connect(ctx.destination);
      src.start(0);
      const rendered = await ctx.startRendering();
      return { atCutoff: 20 * Math.log10(Math.max(mag[0], 1e-12)), ir: Array.from(rendered.getChannelData(0).slice(0, 4096)) };
    };
    const out = [];
    for (const type of ['lowpass', 'highpass']) {
      for (const q of [0.3, 0.5, 0.6, 0.7, 0.707, 0.8, 0.9, 1, 2, 5]) {
        out.push({ type, q, ...(await measure(type, 1000, q)) });
      }
    }
    for (const q of [1.1, 1.4, 5]) out.push({ type: 'bandpass', q, ...(await measure('bandpass', 1000, q)) });
    // and the claim under test: a quality factor Q_t asks for exactly 20 log10(Q_t) dB at the
    // cutoff, which is the number this parameter wants. If that is the conversion then a lowpass
    // fed 20 log10(0.707) must be Butterworth — flat, no peak, −3.01 dB at the corner.
    for (const qt of [0.5, 0.6, 0.7, 0.707, 0.8, 0.9]) {
      const db = 20 * Math.log10(qt);
      out.push({ type: 'lowpass', q: db, wanted: qt, ...(await measure('lowpass', 1000, db)) });
      out.push({ type: 'highpass', q: db, wanted: qt, ...(await measure('highpass', 1000, db)) });
    }
    // and each real filter in the bed, at its own cutoff, as it is set today and as it would be
    // if its number were the quality factor the call site reads as
    for (const s of realSites) {
      out.push({ ...s, site: true, ...(await measure(s.type, s.hz, s.q)) });
      out.push({ ...s, site: true, fixed: true, q: 20 * Math.log10(s.q), ...(await measure(s.type, s.hz, 20 * Math.log10(s.q))) });
    }
    return out;
  }, sites);
  fs.writeFileSync(path.join(out, 'q.json'), JSON.stringify({ sampleRate: 48000, cutoff: 1000, rows }, null, 1));
  log(`${rows.length} filters measured → ${path.join(out, 'q.json')}`);

  const sheet = [
    'Q as set, and what the filter then does. Cutoff 1000 Hz, 48 kHz, one impulse through one biquad.',
    '"at cutoff" is the response exactly at 1000 Hz; "peak" is the largest response anywhere.',
    '',
    'type       Q set   getFreqResponse   from impulse        peak       at Hz   Q if it were a quality factor',
  ];
  let converted = false;
  const peaks = new Map();
  for (const r of rows) {
    const spec = magnitudes(r.ir, 48000);
    const atCut = interp(spec, r.hz ?? 1000);
    let peak = { db: -Infinity, hz: 0 };
    for (const p of spec) if (p.db > peak.db) peak = p;
    if (r.site) {
      peaks.set(`${r.where}:${r.fixed ? 'fixed' : 'set'}`, { peak, atCut, ...r });
      continue;
    }
    if (r.wanted !== undefined && !converted) {
      converted = true;
      sheet.push('', 'and the conversion under test — Q set to 20 log10(Q wanted), so the dB it asks for is the dB it gets:', '', 'type       Q set   getFreqResponse   from impulse        peak       at Hz   Q it behaves as');
    }
    // a traditional-Q lowpass peaks at 20*log10(Q / sqrt(1 - 1/(4 Q^2))); invert the measured peak to see
    // which Q would have produced it, so the two readings can be compared in the same units
    sheet.push(
      `${r.type.padEnd(9)} ${r.q.toFixed(3).padStart(6)}   ${r.atCutoff.toFixed(2).padStart(9)} dB   ${atCut.toFixed(2).padStart(7)} dB   ${peak.db.toFixed(2).padStart(6)} dB   ${peak.hz.toFixed(0).padStart(6)}   ${(r.wanted === undefined ? traditionalQFor(peak.db) : `${traditionalQFor(peak.db)} (wanted ${r.wanted})`).padStart(6)}`,
    );
  }
  sheet.push(
    '',
    `and the ${sites.length} filters in src/audio/ whose cutoff and Q are both written down, each at its own corner.`,
    '"passed raw" is the number going straight into the node, which is what the lane did until today;',
    '"as a quality factor" is the same number through 20 log10(Q), which is what the call site reads as.',
    'The peak is the smaller half of the story: the corner itself moves by more, because a quality',
    'factor of 0.5 is −6.02 dB at the cutoff where 0.5 dB of resonance is +0.5 dB. The last column is',
    'the one that predicts a floor: how much power a flat noise loses through the filter either way.',
    '',
    'where                 type         Hz   Q written    peak raw    at Hz   peak as a Q    at the corner   flat noise through it',
  );
  for (const s of sites) {
    const set = peaks.get(`${s.where}:set`);
    const fix = peaks.get(`${s.where}:fixed`);
    sheet.push(
      `${s.where.padEnd(20)} ${s.type.padEnd(9)} ${s.hz.toFixed(0).padStart(6)} ${s.q.toFixed(2).padStart(10)}   ${set.peak.db.toFixed(2).padStart(8)} dB ${set.peak.hz.toFixed(0).padStart(7)}   ${fix.peak.db.toFixed(2).padStart(9)} dB   ${(set.atCut - fix.atCut).toFixed(2).padStart(11)} dB   ${power(set.ir, fix.ir).toFixed(2).padStart(18)} dB`,
    );
  }
  const text = sheet.join('\n') + '\n';
  fs.writeFileSync(path.join(out, 'q.txt'), text);
  console.log(text);
} finally {
  await browser.close();
  await server.close();
}
