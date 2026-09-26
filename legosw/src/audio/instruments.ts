import { Rng } from '../core/rng';
import { CR, NOISE, NOISE_MASK, SR, SVF, Stereo, blep, clamp, mtof, panGains, sat, sin1, smoothstep } from './dsp';

/**
 * Synthesised orchestra. Every voice renders one note into a mono scratch buffer and is then panned
 * into a section bus. No samples: detuned band-limited saws / pulses with filter envelopes for brass,
 * strings and winds, Karplus-Strong for plucks, modal synthesis for timpani, bells and bars, shaped
 * noise for drums and cymbals, and a formant bank for the choir.
 */

const MAXN = SR * 12;
const S1 = new Float32Array(MAXN);
const S2 = new Float32Array(MAXN);

function emit(bus: Stereo, src: Float32Array, n: number, t: number, pan: number, gain: number): void {
  const i0 = Math.round(t * SR);
  const [gl, gr] = panGains(pan);
  const L = bus.L, R = bus.R;
  const lim = Math.min(n, bus.n - i0);
  for (let i = Math.max(0, -i0); i < lim; i++) {
    const v = src[i] * gain;
    L[i0 + i] += v * gl;
    R[i0 + i] += v * gr;
  }
}

/* ------------------------------------------------------------------ brass */

export type BrassKind = 'tpt' | 'hn' | 'tbn' | 'tuba';
export interface BrassNote {
  t: number;
  d: number;
  m: number;
  v: number;
  kind: BrassKind;
  pan: number;
  /** rip up from this many semitones below */
  rip?: number;
  /** fall off by this many semitones at the end */
  fall?: number;
  /** sforzando-piano: bite then drop */
  sfz?: boolean;
  /** crescendo through the note, starting at this fraction of full level */
  swell?: number;
  /** stopped / cuivré horn: nasal and buzzy */
  stopped?: boolean;
  /** plunger "wah" mute (comedy) */
  wah?: boolean;
  players?: number;
  att?: number;
}

const BRASS = {
  tpt: { att: 0.02, base: 2.4, bright: 16, vib: 0.0042, scoop: 0.016, rel: 0.14, drive: 1.5, q: 0.9, players: 3, noise: 0.1, gain: 0.5, det: 7 },
  hn: { att: 0.042, base: 1.8, bright: 9, vib: 0.0022, scoop: 0.011, rel: 0.24, drive: 1.2, q: 0.72, players: 4, noise: 0.06, gain: 0.62, det: 6 },
  tbn: { att: 0.028, base: 2.0, bright: 13, vib: 0.0012, scoop: 0.02, rel: 0.17, drive: 1.7, q: 0.85, players: 3, noise: 0.08, gain: 0.55, det: 6 },
  tuba: { att: 0.05, base: 1.6, bright: 7, vib: 0.001, scoop: 0.014, rel: 0.22, drive: 1.3, q: 0.7, players: 2, noise: 0.05, gain: 0.6, det: 5 },
} as const;

export function brass(bus: Stereo, n: BrassNote, rng: Rng): void {
  const P = BRASS[n.kind];
  const f0 = mtof(n.m);
  const v = clamp(n.v, 0.05, 1.2);
  const att = n.att ?? P.att * (v > 0.85 ? 0.75 : 1);
  const rel = P.rel;
  const d = Math.max(0.05, n.d);
  const len = Math.min(MAXN, Math.ceil((d + rel * 1.6 + 0.02) * SR));
  const np = n.players ?? P.players;
  const ph = new Float64Array(np), det = new Float64Array(np), vr = new Float64Array(np), vp = new Float64Array(np), dt = new Float64Array(np);
  const dr = new Float64Array(np), drp = new Float64Array(np);
  for (let p = 0; p < np; p++) {
    ph[p] = rng.next();
    det[p] = Math.pow(2, (np === 1 ? 0 : ((p / (np - 1)) * 2 - 1) * P.det + rng.range(-1.5, 1.5)) / 1200);
    vr[p] = rng.range(4.9, 5.9);
    vp[p] = rng.next();
    dr[p] = rng.range(0.25, 0.7);
    drp[p] = rng.next();
  }
  const bright = P.bright * Math.pow(v, 1.4) * (n.stopped ? 1.6 : 1);
  const base = n.stopped ? 2.6 : P.base;
  const sus = n.sfz ? 0.28 : 0.8;
  const drive = n.stopped ? 2.6 : P.drive * (0.7 + 0.5 * v);
  const satN = 1 / sat(drive);
  const lp1 = new SVF(1000, P.q), lp2 = new SVF(1000, 0.6);
  const nas = new SVF(2300, 3), wah = new SVF(800, 4);
  const nbp = new SVF(Math.min(4000, f0 * 2.5), 1.4);
  let nz = rng.int(0, NOISE_MASK);
  const amp = (t: number): number => {
    let a: number;
    if (t < att) {
      const x = t / att;
      a = x * x * (3 - 2 * x);
    } else a = sus + (1 - sus) * Math.exp(-(t - att) / (n.sfz ? 0.1 : 0.16));
    if (n.swell !== undefined) a *= n.swell + (1 - n.swell) * Math.pow(clamp(t / d, 0, 1), 1.6);
    if (n.rip) a *= 0.35 + 0.65 * smoothstep(0, 0.12, t);
    if (t > d) a *= Math.exp(-(t - d) / (rel / 3));
    return a;
  };
  const pitch = (t: number): number => {
    let semi = -P.scoop * 17.3 * Math.exp(-t / 0.028);
    if (n.rip) semi -= n.rip * Math.exp(-t / 0.045);
    if (n.fall) semi -= n.fall * smoothstep(d - 0.28, d + 0.12, t) * smoothstep(d - 0.28, d + 0.12, t);
    return Math.pow(2, semi / 12);
  };
  let aPrev = amp(0);
  for (let b = 0; b < len; b += CR) {
    const tb = b / SR;
    const aNext = amp((b + CR) / SR);
    const bite = v > 0.6 ? Math.exp(-tb / 0.07) * 0.5 : 0;
    const fc = f0 * (base + bright * (0.75 * Math.pow(aPrev, 1.2) + bite));
    lp1.set(Math.min(16000, fc), P.q);
    lp2.set(Math.min(18000, fc * 1.6), 0.6);
    if (n.wah) wah.set(450 + 1300 * smoothstep(0.02, Math.min(0.5, d * 0.7), tb) * (tb > d ? Math.exp(-(tb - d) * 8) : 1), 3.5);
    const pm = pitch(tb);
    const vd = P.vib * smoothstep(0.2, 0.65, tb) * (d > 0.4 ? 1 : 0);
    for (let p = 0; p < np; p++) {
      const drift = 1 + 0.0012 * sin1(drp[p] + dr[p] * tb);
      dt[p] = (f0 * pm * det[p] * drift * (1 + vd * sin1(vp[p] + vr[p] * tb))) / SR;
    }
    const nEnv = P.noise * v * (Math.exp(-tb / 0.03) + 0.04);
    const e = Math.min(CR, len - b);
    for (let i = 0; i < e; i++) {
      const a = aPrev + (aNext - aPrev) * (i / CR);
      let s = 0;
      for (let p = 0; p < np; p++) {
        let q = ph[p] + dt[p];
        if (q >= 1) q -= 1;
        ph[p] = q;
        s += 2 * q - 1 - blep(q, dt[p]);
      }
      s = s / np + nbp.bp(NOISE[nz++ & NOISE_MASK]) * nEnv * 3;
      let y = lp2.lp(lp1.lp(s));
      if (n.stopped) y += nas.bp(y) * 1.8;
      y = sat(y * drive) * satN;
      if (n.wah) y = wah.bp(y) * 1.6 + y * 0.15;
      S1[b + i] = y * a;
    }
    aPrev = aNext;
  }
  emit(bus, S1, len, n.t, n.pan, P.gain * Math.pow(v, 1.5));
}

/* ------------------------------------------------------------------ strings */

export type StrSection = 'vln' | 'vla' | 'vc' | 'cb';
export type StrArt = 'leg' | 'trem' | 'spic' | 'marc' | 'pizz' | 'colleg';
export interface StrNote {
  t: number;
  d: number;
  m: number;
  v: number;
  sec: StrSection;
  art: StrArt;
  pan: number;
  att?: number;
  rel?: number;
  /** level at start → end of the note (crescendo / diminuendo) */
  swell?: [number, number];
  /** legato: slide in from this pitch */
  from?: number;
}

const SEC = {
  vln: { players: 6, det: 11, lp: 2400, lpv: 5600, gain: 0.3, width: 0.22 },
  vla: { players: 5, det: 9, lp: 1900, lpv: 3800, gain: 0.3, width: 0.18 },
  vc: { players: 5, det: 8, lp: 1500, lpv: 3000, gain: 0.34, width: 0.16 },
  cb: { players: 4, det: 7, lp: 850, lpv: 1700, gain: 0.36, width: 0.12 },
} as const;

export function strings(bus: Stereo, n: StrNote, rng: Rng): void {
  if (n.art === 'pizz') return pizz(bus, n, rng);
  if (n.art === 'colleg') return colLegno(bus, n, rng);
  const P = SEC[n.sec];
  const short = n.art === 'spic' || n.art === 'marc';
  const f0 = mtof(n.m);
  const v = clamp(n.v, 0.05, 1.2);
  const d = Math.max(0.04, n.d);
  const att = n.att ?? (n.art === 'spic' ? 0.004 : n.art === 'marc' ? 0.012 : n.art === 'trem' ? 0.06 : 0.12);
  const rel = n.rel ?? (n.art === 'spic' ? 0.07 : n.art === 'marc' ? 0.12 : 0.32);
  const len = Math.min(MAXN, Math.ceil((d + rel * 1.6 + 0.02) * SR));
  const np = short ? 3 : P.players;
  const ph = new Float64Array(np), det = new Float64Array(np), vr = new Float64Array(np), vp = new Float64Array(np), dt = new Float64Array(np);
  const dr = new Float64Array(np), drp = new Float64Array(np), tr = new Float64Array(np), trp = new Float64Array(np), von = new Float64Array(np);
  for (let p = 0; p < np; p++) {
    ph[p] = rng.next();
    det[p] = Math.pow(2, (((p + 0.5) / np) * 2 - 1 + rng.range(-0.25, 0.25)) * (P.det / 1200));
    vr[p] = rng.range(4.8, 6.1);
    vp[p] = rng.next();
    dr[p] = rng.range(0.2, 0.6);
    drp[p] = rng.next();
    tr[p] = rng.range(6.2, 8.4);
    trp[p] = rng.next();
    von[p] = rng.range(0.12, 0.3);
  }
  const lpA = new SVF(1000, 0.7), lpB = new SVF(1000, 0.7), hp = new SVF(Math.max(30, f0 * 0.6), 0.6), hpB = new SVF(Math.max(30, f0 * 0.6), 0.6);
  const bow = new SVF(n.sec === 'vln' ? 3200 : 2200, 1.2);
  let nz = rng.int(0, NOISE_MASK);
  const sw = n.swell ?? [1, 1];
  const amp = (t: number): number => {
    let a: number;
    if (t < att) {
      const x = t / att;
      a = short ? x : x * x * (3 - 2 * x);
    } else if (n.art === 'spic') a = Math.exp(-(t - att) / 0.055);
    else if (n.art === 'marc') a = 0.55 + 0.45 * Math.exp(-(t - att) / 0.08);
    else a = 1;
    if (!short) a *= sw[0] + (sw[1] - sw[0]) * clamp(t / d, 0, 1);
    if (t > d) a *= Math.exp(-(t - d) / (rel / 3));
    return a;
  };
  const glide = n.from !== undefined ? n.from - n.m : 0;
  let aPrev = amp(0);
  for (let b = 0; b < len; b += CR) {
    const tb = b / SR;
    const aNext = amp((b + CR) / SR);
    const bright = short ? Math.exp(-tb / 0.04) * 0.8 + 0.35 : 0.55 + 0.45 * aPrev;
    const fc = P.lp + P.lpv * v * bright + f0 * 1.5;
    lpA.set(Math.min(15000, fc), 0.75);
    lpB.set(Math.min(15000, fc), 0.75);
    const pm = Math.pow(2, (glide * Math.exp(-tb / 0.035)) / 12);
    for (let p = 0; p < np; p++) {
      const vd = short ? 0 : 0.0052 * smoothstep(von[p], von[p] + 0.35, tb);
      const drift = 1 + 0.0017 * sin1(drp[p] + dr[p] * tb);
      dt[p] = (f0 * pm * det[p] * drift * (1 + vd * sin1(vp[p] + vr[p] * tb))) / SR;
    }
    const bowAmt = (short ? 0.35 * Math.exp(-tb / 0.012) : 0.05 + 0.25 * Math.exp(-tb / 0.05)) * v;
    const e = Math.min(CR, len - b);
    for (let i = 0; i < e; i++) {
      const a = aPrev + (aNext - aPrev) * (i / CR);
      const t = (b + i) / SR;
      let sA = 0, sB = 0;
      for (let p = 0; p < np; p++) {
        let q = ph[p] + dt[p];
        if (q >= 1) q -= 1;
        ph[p] = q;
        let s = 2 * q - 1 - blep(q, dt[p]);
        if (n.art === 'trem') {
          const k = sin1(trp[p] + tr[p] * t);
          s *= 0.3 + 0.7 * k * k;
        }
        if (p & 1) sB += s;
        else sA += s;
      }
      const nb = bow.bp(NOISE[nz++ & NOISE_MASK]) * bowAmt;
      S1[b + i] = hp.hp(lpA.lp(sA / np + nb)) * a;
      S2[b + i] = hpB.hp(lpB.lp(sB / np + nb)) * a;
    }
    aPrev = aNext;
  }
  const g = P.gain * Math.pow(v, 1.3) * (short ? 1.5 : 1);
  emit(bus, S1, len, n.t, n.pan - P.width, g);
  emit(bus, S2, len, n.t, n.pan + P.width, g);
}

/** Karplus-Strong pluck into S1 (returns sample count). */
function pluck(f0: number, t60: number, bright: number, len: number, rng: Rng, pos = 0.18): number {
  const period = SR / f0;
  const b = clamp(bright, 0.15, 1);
  const D = Math.max(2, period - (1 - b) / b);
  const L = Math.ceil(D) + 4;
  const dl = new Float32Array(L);
  const g = Math.pow(10, -3 / (t60 * f0));
  // excitation: soft noise burst with a pluck-position comb
  const exc = new Float32Array(L);
  let z = 0;
  for (let i = 0; i < L; i++) {
    z += b * ((rng.next() * 2 - 1) - z);
    exc[i] = z;
  }
  const off = Math.max(1, Math.floor(period * pos));
  let w = 0, lp = 0;
  const n = Math.min(len, MAXN);
  for (let i = 0; i < n; i++) {
    const rp = w - D;
    const ri = Math.floor(rp);
    const fr = rp - ri;
    const a = dl[((ri % L) + L) % L], c = dl[(((ri - 1) % L) + L) % L];
    const y = a + (c - a) * fr;
    lp += b * (y - lp);
    let x = 0;
    if (i < period) x = exc[i % L] - (i >= off ? exc[(i - off) % L] : 0);
    const out = x + g * lp;
    dl[w % L] = out;
    w++;
    S1[i] = out;
  }
  return n;
}

function pizz(bus: Stereo, n: StrNote, rng: Rng): void {
  const P = SEC[n.sec];
  const f0 = mtof(n.m);
  const t60 = clamp(0.9 * Math.pow(220 / f0, 0.5), 0.25, 1.6);
  const len = Math.ceil(Math.min(t60 * 0.9, 1.4) * SR);
  const v = clamp(n.v, 0.05, 1.2);
  for (let k = 0; k < 2; k++) {
    const cnt = pluck(f0 * (k ? 1.003 : 0.998), t60, 0.45 + 0.3 * v, len, rng, 0.2);
    // fade the tail so the render stops cleanly
    for (let i = 0; i < cnt; i++) S1[i] *= 1 - smoothstep(cnt * 0.7, cnt, i);
    emit(bus, S1, cnt, n.t + k * 0.006, n.pan + (k ? P.width : -P.width), P.gain * 2.4 * Math.pow(v, 1.3));
  }
}

function colLegno(bus: Stereo, n: StrNote, rng: Rng): void {
  const P = SEC[n.sec];
  const f0 = mtof(n.m);
  const len = Math.ceil(0.09 * SR);
  const bp = new SVF(1800, 2.5);
  const v = clamp(n.v, 0.05, 1.2);
  let nz = rng.int(0, NOISE_MASK);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += f0 / SR;
    S1[i] = bp.bp(NOISE[nz++ & NOISE_MASK]) * Math.exp(-t / 0.006) * 1.4 + sin1(ph) * Math.exp(-t / 0.03) * 0.35 + (2 * (ph % 1) - 1) * Math.exp(-t / 0.015) * 0.15;
  }
  emit(bus, S1, len, n.t, n.pan, P.gain * 1.3 * v);
}

/* ------------------------------------------------------------------ percussion */

const TIMP_MODES: [number, number, number][] = [
  [1.0, 1.0, 1.0],
  [1.504, 0.55, 0.72],
  [1.742, 0.3, 0.55],
  [2.0, 0.3, 0.5],
  [2.245, 0.16, 0.4],
  [2.494, 0.11, 0.33],
  [2.8, 0.07, 0.27],
  [3.1, 0.05, 0.2],
];

export function timpani(bus: Stereo, t: number, m: number, v: number, pan: number, rng: Rng, damp = 1): void {
  const f0 = mtof(m);
  const T = 1.9 * Math.pow(110 / f0, 0.35) * damp;
  const len = Math.min(MAXN, Math.ceil((T * 1.8 + 0.05) * SR));
  const nm = TIMP_MODES.length;
  const ph = new Float64Array(nm), amp = new Float64Array(nm), dec = new Float64Array(nm), env = new Float64Array(nm);
  for (let k = 0; k < nm; k++) {
    ph[k] = rng.next();
    amp[k] = TIMP_MODES[k][1] * (k === 0 ? 1 : Math.pow(clamp(v, 0.1, 1), 0.7)) * rng.range(0.85, 1.15);
    dec[k] = Math.exp(-1 / (T * TIMP_MODES[k][2] * SR));
    env[k] = 1;
  }
  const mal = new SVF(900 + 2200 * v, 0.8);
  const thump = new SVF(f0 * 0.6, 2);
  let nz = rng.int(0, NOISE_MASK);
  const glideAmt = 0.03 * v;
  for (let b = 0; b < len; b += CR) {
    const tb = b / SR;
    const fm = f0 * (1 + glideAmt * Math.exp(-tb / 0.06));
    const e = Math.min(CR, len - b);
    for (let i = 0; i < e; i++) {
      const t = (b + i) / SR;
      let s = 0;
      for (let k = 0; k < nm; k++) {
        ph[k] += (fm * TIMP_MODES[k][0]) / SR;
        env[k] *= dec[k];
        s += sin1(ph[k]) * amp[k] * env[k];
      }
      const a = t < 0.0015 ? t / 0.0015 : 1;
      const nzv = NOISE[nz++ & NOISE_MASK];
      s = s * a + mal.lp(nzv) * Math.exp(-t / 0.007) * 1.4 * v + thump.bp(nzv) * Math.exp(-t / 0.05) * 1.2 * v;
      S1[b + i] = s;
    }
  }
  const fade = Math.floor(len * 0.8);
  for (let i = fade; i < len; i++) S1[i] *= 1 - (i - fade) / (len - fade);
  emit(bus, S1, len, t, pan, 0.42 * Math.pow(v, 1.4));
}

export function snare(bus: Stereo, t: number, v: number, pan: number, rng: Rng, len_ = 0.35): void {
  const len = Math.ceil(len_ * SR);
  const hp = new SVF(1700, 0.7), pk = new SVF(4800, 1.2), lp = new SVF(9000, 0.7);
  let nz = rng.int(0, NOISE_MASK);
  let p1 = rng.next(), p2 = rng.next();
  const dec = 0.07 + 0.09 * v;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const n = NOISE[nz++ & NOISE_MASK];
    const wires = lp.lp(hp.hp(n)) * Math.exp(-tt / dec);
    p1 += (195 * (1 + 0.08 * Math.exp(-tt / 0.01))) / SR;
    p2 += 335 / SR;
    const shell = sin1(p1) * Math.exp(-tt / 0.045) * 0.8 + sin1(p2) * Math.exp(-tt / 0.03) * 0.45;
    const stick = n * Math.exp(-tt / 0.0015) * 0.8;
    S1[i] = (wires * 0.9 + pk.bp(wires) * 0.6 + shell * (0.4 + 0.6 * v) + stick) * (tt < 0.001 ? tt / 0.001 : 1);
  }
  emit(bus, S1, len, t, pan, 0.3 * Math.pow(v, 1.3));
}

export function bassDrum(bus: Stereo, t: number, v: number, pan: number, rng: Rng): void {
  const len = Math.ceil(1.6 * SR);
  const lp = new SVF(260, 0.7), beat = new SVF(1300, 1.1);
  let nz = rng.int(0, NOISE_MASK);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const n = NOISE[nz++ & NOISE_MASK];
    p1 += (56 * (1 + 0.35 * Math.exp(-tt / 0.03))) / SR;
    p2 += 97 / SR;
    p3 += 168 / SR;
    S1[i] =
      sin1(p1) * Math.exp(-tt / 0.55) +
      sin1(p2) * Math.exp(-tt / 0.22) * 0.5 +
      sin1(p3) * Math.exp(-tt / 0.1) * 0.35 +
      lp.lp(n) * Math.exp(-tt / 0.12) * 1.2 +
      beat.bp(n) * Math.exp(-tt / 0.006) * 1.2 * v;
    if (tt < 0.002) S1[i] *= tt / 0.002;
  }
  const fade = Math.floor(len * 0.75);
  for (let i = fade; i < len; i++) S1[i] *= 1 - (i - fade) / (len - fade);
  emit(bus, S1, len, t, pan, 0.5 * Math.pow(v, 1.4));
}

export function taiko(bus: Stereo, t: number, v: number, pan: number, rng: Rng, pitch = 1): void {
  const len = Math.ceil(0.9 * SR);
  const th = new SVF(900, 1), th2 = new SVF(2600, 1.4);
  let nz = rng.int(0, NOISE_MASK);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const n = NOISE[nz++ & NOISE_MASK];
    p1 += (82 * pitch * (1 + 0.5 * Math.exp(-tt / 0.02))) / SR;
    p2 += (148 * pitch * (1 + 0.2 * Math.exp(-tt / 0.02))) / SR;
    p3 += (330 * pitch * (1 + 0.1 * Math.exp(-tt / 0.01))) / SR;
    S1[i] =
      sin1(p1) * Math.exp(-tt / 0.33) +
      sin1(p2) * Math.exp(-tt / 0.16) * 0.55 +
      sin1(p3) * Math.exp(-tt / 0.05) * 0.35 +
      th.bp(n) * Math.exp(-tt / 0.018) * 3.2 +
      th2.bp(n) * Math.exp(-tt / 0.008) * 1.6;
    if (tt < 0.0015) S1[i] *= tt / 0.0015;
  }
  const fade = Math.floor(len * 0.7);
  for (let i = fade; i < len; i++) S1[i] *= 1 - (i - fade) / (len - fade);
  emit(bus, S1, len, t, pan, 0.48 * Math.pow(v, 1.3));
}

/** metallic partial bank shared by cymbals and tam-tam */
function partials(count: number, fLo: number, fHi: number, rng: Rng): { f: Float64Array; a: Float64Array; d: Float64Array; ph: Float64Array } {
  const f = new Float64Array(count), a = new Float64Array(count), d = new Float64Array(count), ph = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    f[k] = fLo * Math.pow(fHi / fLo, (k + rng.range(-0.4, 0.4)) / count);
    a[k] = rng.range(0.4, 1) / Math.sqrt(k + 1);
    d[k] = rng.range(0.5, 1.4);
    ph[k] = rng.next();
  }
  return { f, a, d, ph };
}

export function crash(bus: Stereo, t: number, v: number, pan: number, rng: Rng, dur = 3.2): void {
  const len = Math.min(MAXN, Math.ceil(dur * SR));
  const hp = new SVF(420, 0.7), lp = new SVF(15000, 0.6), pk = new SVF(6200, 1.1);
  const P = partials(14, 380, 9000, rng);
  let nz = rng.int(0, NOISE_MASK);
  for (let b = 0; b < len; b += CR) {
    const tb = b / SR;
    lp.set(5200 + 11000 * Math.exp(-tb / 0.7), 0.6);
    const e = Math.min(CR, len - b);
    for (let i = 0; i < e; i++) {
      const tt = (b + i) / SR;
      const env = 0.5 * Math.exp(-tt / 0.22) + 0.5 * Math.exp(-tt / (dur * 0.42));
      let m = 0;
      for (let k = 0; k < 14; k++) {
        P.ph[k] += P.f[k] / SR;
        m += sin1(P.ph[k]) * P.a[k] * Math.exp(-tt / (P.d[k] * dur * 0.35));
      }
      const n = hp.hp(NOISE[nz++ & NOISE_MASK]);
      const y = lp.lp(n * 0.9 + pk.bp(n) * 0.5) * env + m * 0.05 * env;
      S1[b + i] = y * (tt < 0.0012 ? tt / 0.0012 : 1);
    }
  }
  const fade = Math.floor(len * 0.8);
  for (let i = fade; i < len; i++) S1[i] *= 1 - (i - fade) / (len - fade);
  emit(bus, S1, len, t, pan, 0.26 * Math.pow(v, 1.2));
}

/** suspended-cymbal roll swelling from t0 to t1 (soft mallets) */
export function cymSwell(bus: Stereo, t0: number, t1: number, v: number, pan: number, rng: Rng): void {
  const dur = Math.max(0.2, t1 - t0);
  const len = Math.min(MAXN, Math.ceil((dur + 0.25) * SR));
  const hp = new SVF(900, 0.7), pk = new SVF(3600, 1.3), pk2 = new SVF(7400, 1.3);
  const P = partials(10, 600, 8000, rng);
  let nz = rng.int(0, NOISE_MASK);
  const rr = rng.range(13, 19);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const x = clamp(tt / dur, 0, 1);
    let env = 0.015 + Math.pow(x, 2.6);
    if (tt > dur) env *= Math.exp(-(tt - dur) / 0.06);
    env *= 1 - 0.12 * Math.abs(sin1(rr * tt));
    let m = 0;
    for (let k = 0; k < 10; k++) {
      P.ph[k] += P.f[k] / SR;
      m += sin1(P.ph[k]) * P.a[k];
    }
    const n = hp.hp(NOISE[nz++ & NOISE_MASK]);
    S1[i] = (n * 0.6 + pk.bp(n) * 0.7 + pk2.bp(n) * 0.5 + m * 0.04) * env;
  }
  emit(bus, S1, len, t0, pan, 0.3 * v);
}

export function tamtam(bus: Stereo, t: number, v: number, pan: number, rng: Rng, dur = 5): void {
  const len = Math.min(MAXN, Math.ceil(dur * SR));
  const P = partials(22, 90, 4200, rng);
  const lp = new SVF(2600, 0.7), hp = new SVF(220, 0.7);
  let nz = rng.int(0, NOISE_MASK);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let m = 0;
    for (let k = 0; k < 22; k++) {
      P.ph[k] += P.f[k] / SR;
      const bloom = 1 - Math.exp(-tt / (0.05 + 0.4 * (k / 22)));
      m += sin1(P.ph[k]) * P.a[k] * bloom * Math.exp(-tt / (P.d[k] * dur * 0.4));
    }
    const n = NOISE[nz++ & NOISE_MASK];
    S1[i] = m * 0.35 + hp.hp(lp.lp(n)) * (Math.exp(-tt / 0.08) * 0.8 + 0.12 * Math.exp(-tt / 1.5));
    if (tt < 0.003) S1[i] *= tt / 0.003;
  }
  const fade = Math.floor(len * 0.8);
  for (let i = fade; i < len; i++) S1[i] *= 1 - (i - fade) / (len - fade);
  emit(bus, S1, len, t, pan, 0.4 * v);
}

export function woodblock(bus: Stereo, t: number, v: number, pan: number, rng: Rng, f = 1150): void {
  const len = Math.ceil(0.12 * SR);
  let p1 = 0, p2 = 0;
  let nz = rng.int(0, NOISE_MASK);
  const bp = new SVF(f * 2.2, 3);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    p1 += f / SR;
    p2 += (f * 2.73) / SR;
    S1[i] = sin1(p1) * Math.exp(-tt / 0.028) + sin1(p2) * Math.exp(-tt / 0.009) * 0.4 + bp.bp(NOISE[nz++ & NOISE_MASK]) * Math.exp(-tt / 0.002);
  }
  emit(bus, S1, len, t, pan, 0.3 * v);
}

/* ------------------------------------------------------------------ choir */

export type Vowel = 'ah' | 'oh' | 'oo' | 'ee';
const VOWELS: Record<Vowel, [number, number, number][]> = {
  ah: [[760, 1.0, 90], [1180, 0.6, 100], [2750, 0.24, 140], [3500, 0.12, 170]],
  oh: [[520, 1.0, 80], [870, 0.5, 90], [2550, 0.13, 130], [3350, 0.07, 160]],
  oo: [[340, 1.0, 70], [760, 0.32, 80], [2400, 0.08, 120], [3200, 0.04, 150]],
  ee: [[300, 1.0, 70], [2150, 0.42, 110], [2900, 0.26, 140], [3600, 0.1, 170]],
};

export function choir(bus: Stereo, n: { t: number; d: number; m: number; v: number; vowel: Vowel; pan: number; att?: number; rel?: number; swell?: [number, number] }, rng: Rng): void {
  const f0 = mtof(n.m);
  const d = Math.max(0.1, n.d);
  const att = n.att ?? 0.28, rel = n.rel ?? 0.5;
  const len = Math.min(MAXN, Math.ceil((d + rel * 1.6) * SR));
  const np = 4;
  const ph = new Float64Array(np), det = new Float64Array(np), vr = new Float64Array(np), vp = new Float64Array(np), dt = new Float64Array(np);
  for (let p = 0; p < np; p++) {
    ph[p] = rng.next();
    det[p] = Math.pow(2, rng.range(-12, 12) / 1200);
    vr[p] = rng.range(4.8, 5.8);
    vp[p] = rng.next();
  }
  const shift = n.m > 64 ? 1.12 : n.m < 52 ? 0.92 : 1;
  const F = VOWELS[n.vowel].map(([f, g, bw]) => ({ f: new SVF(f * shift, (f * shift) / bw), g }));
  const tilt = new SVF(2200, 0.6);
  let nz = rng.int(0, NOISE_MASK);
  const sw = n.swell ?? [1, 1];
  const amp = (t: number): number => {
    let a = t < att ? Math.pow(t / att, 1.5) : 1;
    a *= sw[0] + (sw[1] - sw[0]) * clamp(t / d, 0, 1);
    if (t > d) a *= Math.exp(-(t - d) / (rel / 3));
    return a;
  };
  let aPrev = amp(0);
  for (let b = 0; b < len; b += CR) {
    const tb = b / SR;
    const aNext = amp((b + CR) / SR);
    for (let p = 0; p < np; p++) dt[p] = (f0 * det[p] * (1 + 0.004 * smoothstep(0.2, 0.6, tb) * sin1(vp[p] + vr[p] * tb))) / SR;
    const e = Math.min(CR, len - b);
    for (let i = 0; i < e; i++) {
      const a = aPrev + (aNext - aPrev) * (i / CR);
      let s = 0;
      for (let p = 0; p < np; p++) {
        let q = ph[p] + dt[p];
        if (q >= 1) q -= 1;
        ph[p] = q;
        s += 2 * q - 1 - blep(q, dt[p]);
      }
      const src = tilt.lp(s / np) + NOISE[nz++ & NOISE_MASK] * 0.06;
      let y = 0;
      for (let k = 0; k < F.length; k++) y += F[k].f.bp(src) * F[k].g;
      S1[b + i] = y * a;
    }
    aPrev = aNext;
  }
  emit(bus, S1, len, n.t, n.pan, 1.1 * Math.pow(clamp(n.v, 0.05, 1.2), 1.3));
}

/* ------------------------------------------------------------------ plucked / struck pitched */

export function harp(bus: Stereo, t: number, m: number, v: number, pan: number, rng: Rng): void {
  const f0 = mtof(m);
  const t60 = clamp(2.6 * Math.pow(220 / f0, 0.45), 0.5, 4);
  const len = Math.ceil(Math.min(t60, 3) * SR);
  const cnt = pluck(f0, t60, 0.62 + 0.25 * v, len, rng, 0.14);
  // a finger on gut, not a pick: round off the noise excitation's top end and its first millisecond
  const tone = new SVF(Math.min(6500, 1200 + f0 * 6), 0.6);
  const att = 0.0015 * SR;
  for (let i = 0; i < cnt; i++) S1[i] = tone.lp(S1[i]) * Math.min(1, i / att) * (1 - smoothstep(cnt * 0.75, cnt, i));
  emit(bus, S1, cnt, t, pan, 0.55 * Math.pow(v, 1.2));
}

type Modes = [number, number, number][];
const BELLS: Record<'cel' | 'glock' | 'xylo', { modes: Modes; click: number; gain: number }> = {
  cel: { modes: [[1, 1, 1.1], [2.0, 0.1, 0.5], [2.76, 0.12, 0.22], [5.4, 0.04, 0.07]], click: 0.15, gain: 0.3 },
  glock: { modes: [[1, 1, 2.0], [2.71, 0.42, 0.55], [5.2, 0.22, 0.18], [8.9, 0.1, 0.07]], click: 0.3, gain: 0.22 },
  xylo: { modes: [[1, 1, 0.3], [3.93, 0.3, 0.09], [9.2, 0.12, 0.03]], click: 0.6, gain: 0.3 },
};

export function bell(bus: Stereo, kind: 'cel' | 'glock' | 'xylo', t: number, m: number, v: number, pan: number, rng: Rng): void {
  const B = BELLS[kind];
  const f0 = mtof(m);
  const T = B.modes[0][2] * Math.pow(880 / f0, 0.3);
  const len = Math.ceil(Math.min(3.5, T * 3.2) * SR);
  const nm = B.modes.length;
  const ph = new Float64Array(nm);
  for (let k = 0; k < nm; k++) ph[k] = rng.next();
  const cl = new SVF(Math.min(9000, f0 * 3), 1.2);
  let nz = rng.int(0, NOISE_MASK);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let s = 0;
    for (let k = 0; k < nm; k++) {
      const f = f0 * B.modes[k][0];
      if (f > SR * 0.45) continue;
      ph[k] += f / SR;
      s += sin1(ph[k]) * B.modes[k][1] * Math.exp(-tt / (B.modes[k][2] * Math.pow(880 / f0, 0.3)));
    }
    s += cl.bp(NOISE[nz++ & NOISE_MASK]) * Math.exp(-tt / 0.003) * B.click;
    S1[i] = s * (tt < 0.001 ? tt / 0.001 : 1);
  }
  const fade = Math.floor(len * 0.8);
  for (let i = fade; i < len; i++) S1[i] *= 1 - (i - fade) / (len - fade);
  emit(bus, S1, len, t, pan, B.gain * Math.pow(v, 1.2));
}

/* ------------------------------------------------------------------ woodwinds */

export type WindKind = 'fl' | 'cl' | 'bsn' | 'ob';
export function wind(bus: Stereo, n: { t: number; d: number; m: number; v: number; kind: WindKind; pan: number; stacc?: boolean }, rng: Rng): void {
  const f0 = mtof(n.m);
  const d = Math.max(0.04, n.d);
  const att = n.kind === 'fl' ? 0.035 : 0.02;
  const rel = n.stacc ? 0.05 : 0.12;
  const len = Math.min(MAXN, Math.ceil((d + rel * 2) * SR));
  const lp = new SVF(1000, 0.7), fm = new SVF(n.kind === 'bsn' ? 520 : 1150, 2.2), fm2 = new SVF(n.kind === 'bsn' ? 1250 : 2900, 2.5);
  const br = new SVF(Math.min(8000, f0 * 2), 2);
  let nz = rng.int(0, NOISE_MASK);
  let ph = rng.next(), ph2 = ph;
  const vr = rng.range(4.8, 5.6), vp = rng.next();
  const width = n.kind === 'bsn' ? 0.22 : n.kind === 'ob' ? 0.14 : 0.5;
  const v = clamp(n.v, 0.05, 1.2);
  for (let b = 0; b < len; b += CR) {
    const tb = b / SR;
    const vd = n.kind === 'fl' || n.kind === 'ob' ? 0.005 * smoothstep(0.2, 0.5, tb) : 0;
    const f = f0 * (1 + vd * sin1(vp + vr * tb));
    const dtt = f / SR;
    lp.set(Math.min(12000, f0 * (n.kind === 'cl' ? 5 : n.kind === 'bsn' ? 7 : 9) * (0.6 + 0.6 * v)), 0.7);
    const e = Math.min(CR, len - b);
    for (let i = 0; i < e; i++) {
      const t = (b + i) / SR;
      let a = t < att ? t / att : 1;
      if (n.stacc) a *= Math.exp(-Math.max(0, t - att) / (d * 0.6));
      if (t > d) a *= Math.exp(-(t - d) / (rel / 3));
      ph += dtt;
      if (ph >= 1) ph -= 1;
      let s: number;
      if (n.kind === 'fl') {
        s = sin1(ph) + 0.22 * sin1(2 * ph) + 0.07 * sin1(3 * ph);
        s += br.bp(NOISE[nz++ & NOISE_MASK]) * (0.08 + 0.4 * Math.exp(-t / 0.03));
      } else {
        ph2 = ph + width;
        if (ph2 >= 1) ph2 -= 1;
        s = 2 * ph - 1 - blep(ph, dtt) - (2 * ph2 - 1 - blep(ph2, dtt));
        s = lp.lp(s);
        if (n.kind !== 'cl') s += fm.bp(s) * 1.2 + fm2.bp(s) * 0.6;
        s += NOISE[nz++ & NOISE_MASK] * 0.02 * Math.exp(-t / 0.02);
      }
      S1[b + i] = s * a;
    }
  }
  const gain = { fl: 0.22, cl: 0.26, bsn: 0.3, ob: 0.2 }[n.kind];
  emit(bus, S1, len, n.t, n.pan, gain * Math.pow(v, 1.3));
}
