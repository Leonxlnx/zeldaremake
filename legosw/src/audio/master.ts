import { Rng } from '../core/rng';
import { Biquad, CR, SR, Stereo, db, eqStereo, yieldTick } from './dsp';

/**
 * Mastering for phones and headphones: EQ (sub-rumble out, a little presence and air), two-band bus
 * compression, a look-ahead true-peak limiter iterated to the loudness target (ITU-R BS.1770-4 with
 * EBU R128 gating), a safety soft clip, fade-out, and TPDF dither to 16-bit WAV.
 */

/* ------------------------------------------------------------------ loudness */

/** K-weighting: the BS.1770 shelf and RLB high-pass, derived from their analog prototypes for SR */
function kWeighting(): [Biquad, Biquad] {
  let f0 = 1681.974450955533, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / SR);
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = Biquad.raw((Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / SR);
  a0 = 1 + K / Q + K * K;
  const hp = Biquad.raw(1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  return [shelf, hp];
}

/** integrated loudness in LUFS of [from, to) (400 ms blocks, 75 % overlap, absolute and relative gates) */
export function loudness(L: Float32Array, R: Float32Array, from = 0, to = L.length): number {
  const [aL, bL] = kWeighting(), [aR, bR] = kWeighting();
  const seg = Math.round(0.1 * SR);
  const ns = Math.floor((to - from) / seg);
  if (ns < 4) return -Infinity;
  const e = new Float64Array(ns);
  let i = from;
  for (let s = 0; s < ns; s++) {
    let acc = 0;
    for (const end = i + seg; i < end; i++) {
      const l = bL.tick(aL.tick(L[i])), r = bR.tick(aR.tick(R[i]));
      acc += l * l + r * r;
    }
    e[s] = acc / seg;
  }
  const lk = (x: number): number => -0.691 + 10 * Math.log10(x);
  const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;
  const z: number[] = [];
  for (let j = 0; j + 4 <= ns; j++) z.push((e[j] + e[j + 1] + e[j + 2] + e[j + 3]) / 4);
  const gated = z.filter((x) => x > 0 && lk(x) > -70);
  if (!gated.length) return -Infinity;
  const rel = lk(mean(gated)) - 10;
  const g = gated.filter((x) => lk(x) > rel);
  return lk(mean(g.length ? g : gated));
}

/* ------------------------------------------------------------------ true peak */

const TP_HALF = 8;
/** 4× oversampling interpolators for the three in-between phases (Blackman-windowed sinc, 16 taps) */
const TP_PHASES = [1, 2, 3].map((p) => {
  const fr = p / 4;
  const h = new Float64Array(2 * TP_HALF);
  let s = 0;
  for (let k = 0; k < 2 * TP_HALF; k++) {
    const x = fr - (k - (TP_HALF - 1));
    const w = 0.42 + 0.5 * Math.cos((Math.PI * x) / TP_HALF) + 0.08 * Math.cos((2 * Math.PI * x) / TP_HALF);
    h[k] = (Math.sin(Math.PI * x) / (Math.PI * x)) * w;
    s += h[k];
  }
  for (let k = 0; k < h.length; k++) h[k] /= s;
  return h;
});

/** oversampled |peak| at sample i of one channel */
function interPeak(x: Float32Array, i: number): number {
  let m = Math.abs(x[i]);
  if (i < TP_HALF - 1 || i + TP_HALF >= x.length) return m;
  const o = i - (TP_HALF - 1);
  for (const h of TP_PHASES) {
    let y = 0;
    for (let k = 0; k < 2 * TP_HALF; k++) y += x[o + k] * h[k];
    const a = Math.abs(y);
    if (a > m) m = a;
  }
  return m;
}

/**
 * Per-sample true-peak trace (max over both channels, 4× oversampled). Inter-sample overs stay within
 * a few dB of the sample peak, so only samples above floor are oversampled.
 */
function peakTrace(s: Stereo, out: Float32Array, floor: number): void {
  const { L, R } = s;
  for (let i = 0; i < s.n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    out[i] = a < floor ? a : Math.max(interPeak(L, i), interPeak(R, i));
  }
}

export function truePeak(s: Stereo): number {
  let sp = 0;
  for (let i = 0; i < s.n; i++) sp = Math.max(sp, Math.abs(s.L[i]), Math.abs(s.R[i]));
  let tp = sp;
  const floor = sp * 0.5;
  for (let i = 0; i < s.n; i++) {
    if (Math.abs(s.L[i]) >= floor) tp = Math.max(tp, interPeak(s.L, i));
    if (Math.abs(s.R[i]) >= floor) tp = Math.max(tp, interPeak(s.R, i));
  }
  return tp;
}

/* ------------------------------------------------------------------ dynamics */

/** Linkwitz-Riley crossover: lo = 4th-order low-pass copy of s, s becomes the complementary high band */
function split(s: Stereo, lo: Stereo, fc: number): void {
  for (const [src, dst] of [[s.L, lo.L], [s.R, lo.R]] as const) {
    dst.set(src);
    for (const f of [Biquad.lowpass(fc), Biquad.lowpass(fc)]) f.run(dst);
    for (const f of [Biquad.highpass(fc), Biquad.highpass(fc)]) f.run(src);
  }
}

/** stereo-linked feed-forward compressor, peak detection per control block, soft knee */
function compress(s: Stereo, o: { thr: number; ratio: number; att: number; rel: number; knee: number }): number {
  const aA = Math.exp(-CR / (o.att * SR)), aR = Math.exp(-CR / (o.rel * SR));
  const slope = 1 - 1 / o.ratio, k = o.knee;
  const { L, R } = s;
  let gr = 0, gPrev = 1, maxGr = 0;
  for (let b = 0; b < s.n; b += CR) {
    const e = Math.min(s.n, b + CR);
    let pk = 1e-9;
    for (let i = b; i < e; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    const over = 20 * Math.log10(pk) - o.thr;
    const want = over <= -k / 2 ? 0 : over >= k / 2 ? over * slope : (slope * (over + k / 2) ** 2) / (2 * k);
    gr = want > gr ? aA * gr + (1 - aA) * want : aR * gr + (1 - aR) * want;
    if (gr > maxGr) maxGr = gr;
    const g = db(-gr);
    for (let i = b; i < e; i++) {
      const gg = gPrev + (g - gPrev) * ((i - b + 1) / (e - b));
      L[i] *= gg;
      R[i] *= gg;
    }
    gPrev = g;
  }
  return maxGr;
}

/**
 * Look-ahead limiter gain for y = x · pre · g: the target gain is ceil / truePeak, held as the minimum
 * over the next W samples, released exponentially, then averaged over W samples, so the gain is
 * already down when each peak arrives and never moves faster than a 5 ms ramp.
 */
function limiterGain(peak: Float32Array, pre: number, ceil: number, g: Float32Array, tmp: Float32Array, dq: Int32Array): void {
  const n = peak.length;
  const W = Math.round(0.005 * SR);
  const rel = 1 - Math.exp(-1 / (0.12 * SR));
  for (let i = 0; i < n; i++) {
    const p = peak[i] * pre;
    tmp[i] = p > ceil ? ceil / p : 1;
  }
  let h = 0, t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && tmp[dq[t - 1]] >= tmp[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + W - 1) h++;
    g[i] = tmp[dq[h]];
  }
  let r = 1;
  for (let i = 0; i < n; i++) {
    const m = g[i];
    r = m < r ? m : r + (m - r) * rel;
    g[i] = r;
  }
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += g[i];
    if (i >= W) acc -= g[i - W];
    tmp[i] = acc / Math.min(W, i + 1);
  }
  g.set(tmp);
}

/* ------------------------------------------------------------------ the chain */

export interface MasterOpts {
  /** integrated loudness target, LUFS */
  target: number;
  /** limiter ceiling, dBTP */
  ceiling: number;
  /** fade to silence over [fadeFrom, fadeTo] seconds; everything after is silent */
  fadeFrom: number;
  fadeTo: number;
}

/**
 * Master mix in place; spare is scratch of the same length (overwritten). Returns a report of the
 * loudness and peak figures before and after.
 */
export async function master(mix: Stereo, spare: Stereo, o: MasterOpts): Promise<string[]> {
  const rep: string[] = [];
  const n = mix.n;
  const lin = loudness(mix.L, mix.R);
  rep.push(`master in: ${lin.toFixed(1)} LUFS, true peak ${(20 * Math.log10(truePeak(mix))).toFixed(1)} dBTP`);
  eqStereo(mix, () => [Biquad.highpass(30, 0.5412), Biquad.highpass(30, 1.3066), Biquad.lowshelf(120, -4, 0.8), Biquad.peak(2500, 0.8, 2), Biquad.highshelf(9000, 1.5, 0.8)]);
  await yieldTick();
  // bring the mix to a known level so the compressor thresholds mean something
  const pre = db(-20 - loudness(mix.L, mix.R));
  for (let i = 0; i < n; i++) {
    mix.L[i] *= pre;
    mix.R[i] *= pre;
  }
  split(mix, spare, 180);
  const grLo = compress(spare, { thr: -18, ratio: 3, att: 0.02, rel: 0.25, knee: 6 });
  const grHi = compress(mix, { thr: -15, ratio: 2, att: 0.01, rel: 0.15, knee: 6 });
  for (let i = 0; i < n; i++) {
    mix.L[i] += spare.L[i];
    mix.R[i] += spare.R[i];
  }
  rep.push(`bus compression: max ${grLo.toFixed(1)} dB (low band), ${grHi.toFixed(1)} dB (high band)`);
  await yieldTick();
  // fade before limiting so the loudness target is measured on what ships
  const f0 = Math.floor(o.fadeFrom * SR), f1 = Math.min(n, Math.floor(o.fadeTo * SR));
  for (let i = f0; i < n; i++) {
    const g = i >= f1 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (i - f0)) / Math.max(1, f1 - f0));
    mix.L[i] *= g;
    mix.R[i] *= g;
  }
  // loudness normalisation through the limiter
  const peak = new Float32Array(n), g = new Float32Array(n), tmp = new Float32Array(n), dq = new Int32Array(n);
  let sp = 0;
  for (let i = 0; i < n; i++) sp = Math.max(sp, Math.abs(mix.L[i]), Math.abs(mix.R[i]));
  peakTrace(mix, peak, sp * 0.3);
  const ceil = db(o.ceiling);
  let gain = db(o.target - loudness(mix.L, mix.R));
  let lout = -Infinity;
  for (let it = 0; it < 8; it++) {
    limiterGain(peak, gain, ceil, g, tmp, dq);
    for (let i = 0; i < n; i++) {
      spare.L[i] = mix.L[i] * gain * g[i];
      spare.R[i] = mix.R[i] * gain * g[i];
    }
    lout = loudness(spare.L, spare.R);
    if (Math.abs(lout - o.target) < 0.05) break;
    gain *= db(o.target - lout);
    await yieldTick();
  }
  let minG = 1, sumGr = 0, cntGr = 0;
  for (let i = 0; i < n; i++) {
    if (g[i] < minG) minG = g[i];
    if (g[i] < 0.999) {
      sumGr += -20 * Math.log10(g[i]);
      cntGr++;
    }
  }
  rep.push(`limiter: max ${(-20 * Math.log10(minG)).toFixed(1)} dB, mean ${(sumGr / Math.max(1, cntGr)).toFixed(2)} dB over ${((100 * cntGr) / n).toFixed(1)} % of samples`);
  // safety soft clip above the ceiling, then a final true-peak trim if anything still pokes out
  const kn = db(o.ceiling), c = db(o.ceiling + 0.4);
  let clipped = 0;
  for (const ch of [spare.L, spare.R]) {
    for (let i = 0; i < n; i++) {
      const x = ch[i], a = Math.abs(x);
      if (a > kn) {
        ch[i] = Math.sign(x) * (kn + (c - kn) * Math.tanh((a - kn) / (c - kn)));
        clipped++;
      }
    }
  }
  let tp = truePeak(spare);
  if (tp > db(o.ceiling + 0.4)) {
    const t = db(o.ceiling + 0.3) / tp;
    for (let i = 0; i < n; i++) {
      spare.L[i] *= t;
      spare.R[i] *= t;
    }
    tp = truePeak(spare);
  }
  mix.L.set(spare.L);
  mix.R.set(spare.R);
  rep.push(`master out: ${loudness(mix.L, mix.R).toFixed(1)} LUFS, true peak ${(20 * Math.log10(tp)).toFixed(2)} dBTP, soft-clipped ${clipped} samples`);
  return rep;
}

/* ------------------------------------------------------------------ WAV */

/** 16-bit PCM WAV of the first n samples, TPDF-dithered, as base64 */
export function encodeWav(s: Stereo, n: number, seed = 777): string {
  const rng = new Rng(seed);
  const bytes = new ArrayBuffer(44 + n * 4);
  const v = new DataView(bytes);
  const w = (o: number, str: string): void => {
    for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 4, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (const ch of [s.L, s.R]) {
      const x = ch[i] * 32767 + (rng.next() - rng.next());
      v.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(x))), true);
      off += 2;
    }
  }
  const u8 = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
