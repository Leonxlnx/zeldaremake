import { Rng } from '../core/rng';

/**
 * Tiny offline DSP kit for the soundtrack: band-limited oscillators, state-variable and biquad
 * filters, noise / sine tables, stereo buses, FFT convolution and generated hall impulse responses.
 * Everything is plain JS on Float32Arrays, so the whole mix renders deterministically and fast.
 */

export const SR = 44100;
export const TAU = Math.PI * 2;
/** control-rate block: envelopes, filter coefficients and vibrato update every CR samples */
export const CR = 32;

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d: number): number => Math.pow(10, d / 20);
export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class Stereo {
  L: Float32Array;
  R: Float32Array;
  n: number;
  constructor(n: number) {
    this.n = n;
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  clear(): void {
    this.L.fill(0);
    this.R.fill(0);
  }
}

/** equal-power pan gains (centre = -3 dB) */
export function panGains(pan: number): [number, number] {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/* ------------------------------------------------------------------ tables */

const NOISE_BITS = 18;
export const NOISE_MASK = (1 << NOISE_BITS) - 1;
/** 6 s of deterministic white noise, read from random offsets by every noisy voice */
export const NOISE = (() => {
  const t = new Float32Array(1 << NOISE_BITS);
  const r = new Rng(9);
  for (let i = 0; i < t.length; i++) t[i] = r.next() * 2 - 1;
  return t;
})();

const SIN_BITS = 13;
const SIN_N = 1 << SIN_BITS;
const SIN = (() => {
  const t = new Float32Array(SIN_N + 1);
  for (let i = 0; i <= SIN_N; i++) t[i] = Math.sin((TAU * i) / SIN_N);
  return t;
})();

/** sine of a phase in cycles (any real number) */
export function sin1(ph: number): number {
  const x = (ph - Math.floor(ph)) * SIN_N;
  const i = x | 0;
  const f = x - i;
  return SIN[i] + (SIN[i + 1] - SIN[i]) * f;
}

/** polyBLEP residual for a unit-step discontinuity at phase 0 */
export function blep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** fast tanh-like soft saturation (Padé), exact enough for |x| < 3, clamped beyond */
export function sat(x: number): number {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/* ------------------------------------------------------------------ filters */

/** Topology-preserving state-variable filter (Simper). Call set() at control rate, then lp/bp/hp per sample. */
export class SVF {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  k = 1;
  constructor(fc = 1000, q = 0.707) {
    this.set(fc, q);
  }
  set(fc: number, q: number): void {
    const g = Math.tan((Math.PI * clamp(fc, 10, SR * 0.47)) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  reset(): void {
    this.ic1 = this.ic2 = 0;
  }
  lp(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return v2;
  }
  /** band-pass normalised to unity gain at the centre frequency */
  bp(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return this.k * v1;
  }
  hp(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return x - this.k * v1 - v2;
  }
}

/** RBJ-cookbook biquad (transposed direct form II) for static EQ. */
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private z1 = 0;
  private z2 = 0;
  private static make(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad {
    const q = new Biquad();
    q.b0 = b0 / a0;
    q.b1 = b1 / a0;
    q.b2 = b2 / a0;
    q.a1 = a1 / a0;
    q.a2 = a2 / a0;
    return q;
  }
  static lowpass(f: number, Q = Math.SQRT1_2): Biquad {
    const w = (TAU * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * Q);
    return Biquad.make((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al);
  }
  static highpass(f: number, Q = Math.SQRT1_2): Biquad {
    const w = (TAU * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * Q);
    return Biquad.make((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
  }
  static peak(f: number, Q: number, gainDb: number): Biquad {
    const A = Math.pow(10, gainDb / 40), w = (TAU * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * Q);
    return Biquad.make(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A);
  }
  static lowshelf(f: number, gainDb: number, S = 1): Biquad {
    const A = Math.pow(10, gainDb / 40), w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w);
    const al = (s / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2), sa = 2 * Math.sqrt(A) * al;
    return Biquad.make(A * (A + 1 - (A - 1) * c + sa), 2 * A * (A - 1 - (A + 1) * c), A * (A + 1 - (A - 1) * c - sa), A + 1 + (A - 1) * c + sa, -2 * (A - 1 + (A + 1) * c), A + 1 + (A - 1) * c - sa);
  }
  static highshelf(f: number, gainDb: number, S = 1): Biquad {
    const A = Math.pow(10, gainDb / 40), w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w);
    const al = (s / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2), sa = 2 * Math.sqrt(A) * al;
    return Biquad.make(A * (A + 1 + (A - 1) * c + sa), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - sa), A + 1 - (A - 1) * c + sa, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - sa);
  }
  /** raw coefficients (already normalised by a0) */
  static raw(b0: number, b1: number, b2: number, a1: number, a2: number): Biquad {
    return Biquad.make(b0, b1, b2, 1, a1, a2);
  }
  tick(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  run(buf: Float32Array, from = 0, to = buf.length): void {
    let z1 = this.z1, z2 = this.z2;
    const { b0, b1, b2, a1, a2 } = this;
    for (let i = from; i < to; i++) {
      const x = buf[i];
      const y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      buf[i] = y;
    }
    this.z1 = z1;
    this.z2 = z2;
  }
}

/** apply a chain of biquads (fresh state per channel) to a stereo buffer in place */
export function eqStereo(s: Stereo, make: () => Biquad[]): void {
  for (const ch of [s.L, s.R]) for (const f of make()) f.run(ch);
}

/* ------------------------------------------------------------------ FFT convolution */

export class FFT {
  n: number;
  private cos: Float64Array;
  private sin: Float64Array;
  private rev: Uint32Array;
  constructor(n: number) {
    this.n = n;
    const bits = Math.round(Math.log2(n));
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((TAU * i) / n);
      this.sin[i] = Math.sin((TAU * i) / n);
    }
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
  }
  /** in-place complex FFT; inverse is unscaled */
  run(re: Float64Array, im: Float64Array, inverse: boolean): void {
    const n = this.n, rev = this.rev, cs = this.cos, sn = this.sin;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    const sgn = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half;
          const wr = cs[k], wi = sgn * sn[k];
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }
}

/**
 * Stereo convolution (L with irL, R with irR), overlap-add, added into out × gain. Both channels
 * share one complex FFT per block (L in the real part, R in the imaginary part).
 */
export function convolveStereo(inp: Stereo, irL: Float32Array, irR: Float32Array, out: Stereo, gain: number): void {
  const M = Math.max(irL.length, irR.length);
  let N = 1;
  while (N < 2 * M) N <<= 1;
  const B = N - M + 1;
  const fft = new FFT(N);
  const hr = new Float64Array(N), hi = new Float64Array(N);
  for (let i = 0; i < irL.length; i++) hr[i] = irL[i];
  for (let i = 0; i < irR.length; i++) hi[i] = irR[i];
  fft.run(hr, hi, false);
  // unpack the two real IR spectra
  const HLr = new Float64Array(N), HLi = new Float64Array(N), HRr = new Float64Array(N), HRi = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const nk = (N - k) & (N - 1);
    const zr = hr[k], zi = hi[k], cr = hr[nk], ci = -hi[nk];
    HLr[k] = (zr + cr) / 2;
    HLi[k] = (zi + ci) / 2;
    HRr[k] = (zi - ci) / 2;
    HRi[k] = -(zr - cr) / 2;
  }
  const re = new Float64Array(N), im = new Float64Array(N), wr = new Float64Array(N), wi = new Float64Array(N);
  const len = inp.n, g = gain / N;
  for (let s = 0; s < len; s += B) {
    const e = Math.min(len, s + B);
    let any = false;
    for (let i = s; i < e; i++) if (inp.L[i] !== 0 || inp.R[i] !== 0) {
      any = true;
      break;
    }
    if (!any) continue;
    re.fill(0);
    im.fill(0);
    for (let i = s; i < e; i++) {
      re[i - s] = inp.L[i];
      im[i - s] = inp.R[i];
    }
    fft.run(re, im, false);
    for (let k = 0; k < N; k++) {
      const nk = (N - k) & (N - 1);
      const zr = re[k], zi = im[k], cr = re[nk], ci = -im[nk];
      const xlr = (zr + cr) / 2, xli = (zi + ci) / 2;
      const xrr = (zi - ci) / 2, xri = -(zr - cr) / 2;
      const ylr = xlr * HLr[k] - xli * HLi[k], yli = xlr * HLi[k] + xli * HLr[k];
      const yrr = xrr * HRr[k] - xri * HRi[k], yri = xrr * HRi[k] + xri * HRr[k];
      wr[k] = ylr - yri;
      wi[k] = yli + yrr;
    }
    fft.run(wr, wi, true);
    const lim = Math.min(N, len - s);
    for (let i = 0; i < lim; i++) {
      out.L[s + i] += wr[i] * g;
      out.R[s + i] += wi[i] * g;
    }
  }
}

/**
 * Generated concert-hall impulse response: sparse early reflections, then a diffuse tail built from
 * three noise bands with their own decay times (bass lingers, treble dies first), decorrelated L/R,
 * high-passed so the reverb never muddies the low end. Normalised to unit energy per channel.
 */
export function hallIR(o: { seconds: number; rtLow: number; rtMid: number; rtHigh: number; predelay: number; er: number; erSpan: number; hp: number; lp: number; seed: number }): [Float32Array, Float32Array] {
  const n = Math.floor(o.seconds * SR);
  const chans: Float32Array[] = [];
  for (let c = 0; c < 2; c++) {
    const r = new Rng(o.seed * 7 + c * 131);
    const ir = new Float32Array(n);
    const lo = new SVF(450, 0.6), hi = new SVF(3800, 0.6);
    const pd = Math.floor(o.predelay * SR);
    for (let i = pd; i < n; i++) {
      const t = (i - pd) / SR;
      const x = r.next() * 2 - 1;
      const l = lo.lp(x), h = hi.hp(x), m = x - l - h;
      const eL = Math.exp((-6.9078 * t) / o.rtLow), eM = Math.exp((-6.9078 * t) / o.rtMid), eH = Math.exp((-6.9078 * t) / o.rtHigh);
      const fadeIn = 1 - Math.exp(-t / 0.018);
      ir[i] = (l * eL + m * eM + h * eH) * fadeIn;
    }
    // early reflections: short smeared taps between 4 ms and erSpan
    for (let k = 0; k < o.er; k++) {
      const te = 0.004 + Math.pow(r.next(), 0.8) * o.erSpan;
      const a = (0.9 - 0.5 * (te / o.erSpan)) * (r.chance(0.5) ? 1 : -1) * r.range(0.5, 1) * 3.2;
      const i0 = Math.floor(te * SR);
      for (let j = 0; j < 40 && i0 + j < n; j++) ir[i0 + j] += a * Math.exp(-j / 9) * (j === 0 ? 1 : r.range(-0.6, 0.6));
    }
    const hp1 = Biquad.highpass(o.hp, 0.6), hp2 = Biquad.highpass(o.hp, 0.9), lpf = Biquad.lowpass(o.lp, 0.6);
    hp1.run(ir);
    hp2.run(ir);
    lpf.run(ir);
    // gentle fade-out over the last 10 %
    const f0 = Math.floor(n * 0.9);
    for (let i = f0; i < n; i++) ir[i] *= 0.5 + 0.5 * Math.cos((Math.PI * (i - f0)) / (n - f0));
    let e = 0;
    for (let i = 0; i < n; i++) e += ir[i] * ir[i];
    const g = 1 / Math.sqrt(e);
    for (let i = 0; i < n; i++) ir[i] *= g;
    chans.push(ir);
  }
  return [chans[0], chans[1]];
}

/** wait a tick so a long offline render never freezes the page for its whole duration */
export const yieldTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
