import { Rng, hash1 } from '../core/rng';
import { CR, NOISE, NOISE_MASK, SR, SVF, Stereo, blep, clamp, panGains, sat, sin1, smoothstep } from './dsp';
import type { AudioInputs } from './soundtrack';
import { JUMP_OUT } from '../film/choreo';

/**
 * Sound effects, synthesised sample by sample into a dry bus and a reverb send. Designed for small
 * speakers: every effect carries energy between 300 Hz and 5 kHz (crunch and crackle on explosions,
 * plastic clatter, band-limited whooshes, buzzy engines and saber hum), with the sub-bass kept short.
 */

const MAXN = SR * 20;
const S = new Float32Array(MAXN);

const saw = (ph: number, dt: number): number => 2 * ph - 1 - blep(ph, dt);
const expSweep = (a: number, b: number, x: number): number => a * Math.pow(b / a, clamp(x, 0, 1));

export class Sfx {
  private dry: Stereo;
  private send: Stereo;
  private rng: Rng;
  constructor(dry: Stereo, send: Stereo, seed = 4242) {
    this.dry = dry;
    this.send = send;
    this.rng = new Rng(seed);
  }

  /** mix the first n scratch samples in at time t; the pan may travel from pan to pan1 */
  private emit(n: number, t: number, gain: number, pan: number, verb: number, pan1 = pan): void {
    const i0 = Math.round(t * SR);
    const { L, R } = this.dry;
    const sL = this.send.L, sR = this.send.R;
    const lim = Math.min(n, this.dry.n - i0);
    for (let b = Math.max(0, -i0); b < lim; b += CR) {
      const [gl, gr] = panGains(pan + (pan1 - pan) * (b / n));
      const e = Math.min(lim, b + CR);
      for (let i = b; i < e; i++) {
        const v = S[i] * gain;
        const l = v * gl, r = v * gr;
        L[i0 + i] += l;
        R[i0 + i] += r;
        sL[i0 + i] += l * verb;
        sR[i0 + i] += r * verb;
      }
    }
  }

  private fadeTail(len: number, from = 0.85): void {
    const f = Math.floor(len * from);
    for (let i = f; i < len; i++) S[i] *= 1 - (i - f) / (len - f);
  }

  /** blaster bolt: falling saw + square, a noise crack and a dispersive chirp */
  pew(t: number, gain: number, pan = 0, pitch = 1): void {
    const r = this.rng;
    const len = Math.ceil(0.28 * SR);
    const lp = new SVF(6000, 0.9), crack = new SVF(3800 * pitch, 1.4);
    let p1 = r.next(), p2 = r.next(), p3 = 0;
    let nz = r.int(0, NOISE_MASK);
    const f0 = 1900 * pitch * r.range(0.93, 1.07);
    for (let b = 0; b < len; b += CR) {
      const tb = b / SR;
      const k = Math.min(1, tb / 0.2);
      const f = f0 * Math.pow(0.11, k);
      lp.set(6000 * Math.pow(0.15, k), 0.9);
      const d1 = f / SR, d2 = (f * 1.5) / SR, d3 = expSweep(4000 * pitch, 300 * pitch, tb / 0.13) / SR;
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const tt = (b + i) / SR;
        p1 += d1;
        if (p1 >= 1) p1 -= 1;
        p2 += d2;
        if (p2 >= 1) p2 -= 1;
        p3 += d3;
        let q = p2 + 0.5;
        if (q >= 1) q -= 1;
        const sq = saw(p2, d2) - saw(q, d2);
        const env = tt < 0.004 ? tt / 0.004 : Math.exp(-(tt - 0.004) / 0.055);
        S[b + i] = lp.lp(saw(p1, d1) * 0.5 + sq * 0.25) * env + sin1(p3) * Math.exp(-tt / 0.05) * 0.45 + crack.bp(NOISE[nz++ & NOISE_MASK]) * Math.exp(-tt / 0.004) * 0.7;
      }
    }
    this.emit(len, t, gain, pan, 0.12);
  }

  /** capital-ship turbolaser: saturated falling saw, a band-passed zap and a chirp */
  turbo(t: number, gain: number, pan = 0): void {
    const r = this.rng;
    const len = Math.ceil(0.8 * SR);
    const lp = new SVF(1400, 0.8), zap = new SVF(2400, 2.5);
    let p1 = r.next(), p2 = 0;
    let nz = r.int(0, NOISE_MASK);
    for (let b = 0; b < len; b += CR) {
      const tb = b / SR;
      const d1 = expSweep(820, 70, tb / 0.5) / SR;
      const d2 = expSweep(3000, 350, tb / 0.15) / SR;
      zap.set(expSweep(2400, 950, tb / 0.15), 2.5);
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const tt = (b + i) / SR;
        p1 += d1;
        if (p1 >= 1) p1 -= 1;
        p2 += d2;
        const env = tt < 0.01 ? tt / 0.01 : Math.exp(-(tt - 0.01) / 0.17);
        S[b + i] = sat(lp.lp(saw(p1, d1)) * 1.6) * env * 0.8 + zap.bp(NOISE[nz++ & NOISE_MASK]) * Math.exp(-tt / 0.07) * 0.7 + sin1(p2) * Math.exp(-tt / 0.06) * 0.3;
      }
    }
    this.fadeTail(len);
    this.emit(len, t, gain, pan, 0.4);
  }

  /**
   * Explosion: a noise body whose low-pass falls with time, a saturated mid-range crunch, a short
   * punch (not a long sub), dense 1–5 kHz crackle and optionally LEGO pieces clattering down.
   * far (0 near … 1 distant) darkens it and pushes it into the reverb.
   */
  boom(t: number, size: number, gain: number, pan = 0, clatter = 0, far = 0): void {
    const r = this.rng;
    const dur = 0.5 + Math.min(2.8, Math.sqrt(size) * 0.18);
    const len = Math.min(MAXN, Math.ceil((dur + 0.2) * SR));
    const big = size > 50;
    const f0 = (big ? 1800 : 4200) * (1 - 0.55 * far), f1 = big ? 90 : 180;
    const lp = new SVF(f0, 0.7), crunch = new SVF(900, 1.2), crunch2 = new SVF(1900, 1.5);
    let ph = r.next();
    const fs0 = big ? 72 : 118, fs1 = big ? 34 : 48;
    const crDec = 0.08 + 0.05 * Math.min(4, Math.sqrt(size) / 2);
    const bright = 1 - 0.75 * far;
    let nz = r.int(0, NOISE_MASK);
    for (let b = 0; b < len; b += CR) {
      const tb = b / SR;
      lp.set(expSweep(f0, f1, tb / dur), 0.7);
      const dt = expSweep(fs0, fs1, tb / (dur * 0.6)) / SR;
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const tt = (b + i) / SR;
        const n = NOISE[nz++ & NOISE_MASK];
        const env = tt < 0.006 ? tt / 0.006 : Math.exp(-(tt - 0.006) / (dur / 3));
        ph += dt;
        const body = lp.lp(n) * env;
        const cr = sat((crunch.bp(n) + crunch2.bp(n) * 0.6) * 2.5) * Math.exp(-tt / crDec) * 0.45 * bright;
        const sub = sin1(ph) * Math.exp(-tt / (dur * 0.2)) * (big ? 0.45 : 0.32) * (tt < 0.004 ? tt / 0.004 : 1);
        S[b + i] = body + cr + sub;
      }
    }
    this.fadeTail(len);
    this.emit(len, t, gain, pan, 0.28 + 0.35 * far);
    const nc = Math.round((10 + Math.min(36, size * 0.9)) * bright);
    for (let k = 0; k < nc; k++) {
      const tc = t + 0.015 + Math.pow(r.next(), 1.7) * dur * 0.7;
      this.click(tc, gain * r.range(0.05, 0.2) * bright, pan + r.range(-0.25, 0.25), r.range(1000, 5200), r.range(0.004, 0.016));
    }
    if (clatter > 0) this.clatter(t + 0.06, clatter, gain * 0.6 * bright, pan, 1.1);
  }

  click(t: number, gain: number, pan: number, freq: number, dur = 0.018): void {
    const len = Math.ceil((dur * 3 + 0.004) * SR);
    const bp = new SVF(freq, 6);
    let nz = this.rng.int(0, NOISE_MASK);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      S[i] = bp.bp(NOISE[nz++ & NOISE_MASK]) * (tt < 0.001 ? tt / 0.001 : Math.exp(-(tt - 0.001) / (dur / 3)));
    }
    this.emit(len, t, gain, pan, 0.1);
  }

  /** one hard plastic impact: three short modes plus a click */
  tick(t: number, gain: number, pan: number, modes: number[], verb = 0.22): void {
    const r = this.rng;
    const len = Math.ceil(0.06 * SR);
    const ph = modes.map(() => r.next());
    const dec = [0.018, 0.011, 0.006].map((d) => d * r.range(0.7, 1.3));
    const amp = [1, 0.6 * r.range(0.5, 1.2), 0.35 * r.range(0.5, 1.2)];
    const bp = new SVF(modes[1] ?? 3000, 2);
    let nz = r.int(0, NOISE_MASK);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      let s = 0;
      for (let k = 0; k < modes.length && k < 3; k++) s += sin1(ph[k] + modes[k] * tt) * amp[k] * Math.exp(-tt / dec[k]);
      s += bp.bp(NOISE[nz++ & NOISE_MASK]) * Math.exp(-tt / 0.0015) * 0.8;
      S[i] = s * (tt < 0.0003 ? tt / 0.0003 : 1);
    }
    this.emit(len, t, gain, pan, verb);
  }

  /** LEGO pieces raining down: each piece lands and bounces two or three times, ever shorter and softer */
  clatter(t: number, count: number, gain: number, pan = 0, spread = 1.1): void {
    const r = this.rng;
    for (let k = 0; k < count; k++) {
      const t1 = t + Math.pow(r.next(), 1.6) * spread;
      let g = gain * r.range(0.25, 1) * Math.max(0, 1 - (t1 - t) / (spread * 1.2));
      const fm = r.range(0.8, 1.25);
      const modes = [2200, 3400, 5600].map((f) => f * fm * r.range(0.95, 1.05));
      const p = pan + r.range(-0.3, 0.3);
      let dt = r.range(0.06, 0.16), tt = t1;
      const bounces = r.int(1, 3);
      for (let j = 0; j <= bounces; j++) {
        this.tick(tt, g, p, modes);
        tt += dt;
        dt *= r.range(0.5, 0.7);
        g *= r.range(0.45, 0.65);
      }
    }
  }

  /**
   * Engine pass over [t0, t1]: a mid-range roar, a buzzy 124 Hz pulse through a 1.2 kHz low-pass, a
   * little low rumble and a turbine whine. pts are [time, level] breakpoints (linear in between).
   */
  engine(t0: number, t1: number, pts: [number, number][], o: { pitch?: number; bright?: number; pan?: number; pan1?: number } = {}): void {
    const r = this.rng;
    const pitch = o.pitch ?? 1, bright = o.bright ?? 1;
    const len = Math.min(MAXN, Math.ceil((t1 - t0) * SR));
    if (len <= 0) return;
    const roar = new SVF(900 * pitch * bright, 0.8);
    const lpR = new SVF(300, 0.7), lpP = new SVF(1200 * bright, 0.8);
    let pr = r.next(), pp = r.next(), pw = r.next();
    const curve: [number, number][] = [[t0, 0], ...pts.filter(([t]) => t > t0 && t < t1), [t1, 0]];
    const level = (T: number): number => {
      for (let k = 1; k < curve.length; k++) {
        if (T <= curve[k][0]) {
          const [ta, va] = curve[k - 1], [tb, vb] = curve[k];
          return va + (vb - va) * ((T - ta) / Math.max(1e-6, tb - ta));
        }
      }
      return 0;
    };
    const fl = r.range(18, 26), wp = r.next();
    let nz = r.int(0, NOISE_MASK);
    for (let b = 0; b < len; b += CR) {
      const tb = b / SR;
      const g0 = level(t0 + tb), g1 = level(t0 + (b + CR) / SR);
      const dR = (62 * pitch) / SR;
      const dP = (124 * pitch * (1 + 0.006 * sin1(wp + 0.37 * tb))) / SR;
      const dW = (1250 * pitch * (1 + 0.004 * sin1(5.1 * tb))) / SR;
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const tt = (b + i) / SR;
        const g = g0 + (g1 - g0) * (i / CR);
        pr += dR;
        if (pr >= 1) pr -= 1;
        pp += dP;
        if (pp >= 1) pp -= 1;
        pw += dW;
        let q = pp + 0.3;
        if (q >= 1) q -= 1;
        const pulse = saw(pp, dP) - saw(q, dP);
        const flut = 0.8 + 0.2 * sin1(fl * tt);
        S[b + i] = g * (roar.bp(NOISE[nz++ & NOISE_MASK]) * 0.9 * flut + lpR.lp(saw(pr, dR)) * 0.12 + lpP.lp(pulse) * 0.2 + sin1(pw) * 0.05 + sin1(2 * pw) * 0.02);
      }
    }
    this.emit(len, t0, 1, o.pan ?? 0, 0.18, o.pan1 ?? o.pan ?? 0);
  }

  /** fly-by: a band-passed noise sweep (kept inside 380 Hz – 3.2 kHz) with a Doppler-dropping tone */
  whoosh(t: number, dur: number, gain: number, panFrom = -0.8, panTo = 0.8, f0 = 2400, f1 = 260): void {
    const r = this.rng;
    const len = Math.ceil(dur * SR);
    const bp = new SVF(f0, 1.2), bp2 = new SVF(f0, 2.5), lp = new SVF(1500, 0.8);
    const band = (f: number): number => clamp(f, 380, 3200);
    const fA = f0 * 0.6;
    let ph = r.next();
    let nz = r.int(0, NOISE_MASK);
    for (let b = 0; b < len; b += CR) {
      const x0 = b / len, x1 = Math.min(1, (b + CR) / len);
      const fc = x0 < 0.45 ? expSweep(fA, f0, x0 / 0.45) : expSweep(f0, f1, (x0 - 0.45) / 0.55);
      bp.set(band(fc), 1.2);
      bp2.set(band(fc * 1.5), 2.5);
      const env = (x: number): number => (x < 0.45 ? Math.pow(x / 0.45, 2.2) : Math.pow(Math.max(0, 1 - x) / 0.55, 1.8));
      const e0 = env(x0), e1 = env(x1);
      const d = (f0 * 0.2 * (1.25 - 0.5 * smoothstep(0.3, 0.6, x0))) / SR;
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const a = e0 + (e1 - e0) * (i / CR);
        ph += d;
        if (ph >= 1) ph -= 1;
        const n = NOISE[nz++ & NOISE_MASK];
        S[b + i] = ((bp.bp(n) + 0.5 * bp2.bp(n)) * 0.9 + lp.lp(saw(ph, d)) * 0.15) * a;
      }
    }
    this.emit(len, t, gain, panFrom, 0.3, panTo);
  }

  /** astromech chatter: fast sine chirps */
  beeps(t: number, n: number, gain: number, pan = 0, seed = 1, sad = false): void {
    const r = new Rng(seed);
    let tt = t;
    for (let k = 0; k < n; k++) {
      const d = r.range(0.045, 0.12);
      const f0 = r.range(1400, 3800), f1 = sad ? f0 * 0.5 : r.range(1200, 4200);
      const len = Math.ceil((d + 0.06) * SR);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const x = i / SR;
        ph += expSweep(f0, f1, x / d) / SR;
        S[i] = sin1(ph) * (x < 0.004 ? x / 0.004 : Math.exp(-(x - 0.004) / ((d * 1.2) / 5)));
      }
      this.emit(len, tt, gain, pan, 0.2);
      tt += d + r.range(0.01, 0.05);
    }
  }

  /** R4's electronic scream: a warbling fall */
  scream(t: number, gain: number, pan = 0): void {
    const len = Math.ceil(1.1 * SR);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const x = i / SR;
      ph += (expSweep(2900, 520, x / 0.9) + 160 * sin1(18 * x)) / SR;
      const env = x < 0.02 ? x / 0.02 : Math.exp(-(x - 0.02) / 0.45);
      S[i] = sin1(ph) * env * (x > 1.0 ? (1.1 - x) / 0.1 : 1);
    }
    this.emit(len, t, gain, pan, 0.35);
  }

  /** buzz-droid cutter: FM'd saw through a resonant band-pass plus a metal scrape */
  buzzSaw(t0: number, t1: number, gain: number, pan = 0): void {
    const r = this.rng;
    const len = Math.min(MAXN, Math.ceil((t1 - t0) * SR));
    const bp = new SVF(2600, 2), hp = new SVF(3500, 0.7);
    let ph = r.next();
    let nz = r.int(0, NOISE_MASK);
    const dur = t1 - t0;
    for (let b = 0; b < len; b += CR) {
      const tb = b / SR;
      const d = (1900 + 260 * sin1(37 * tb)) / SR;
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const x = (b + i) / SR;
        ph += d;
        if (ph >= 1) ph -= 1;
        const env = Math.min(1, x / 0.08, Math.max(0, (dur - x) / 0.1));
        S[b + i] = (bp.bp(saw(ph, d)) + hp.hp(NOISE[nz++ & NOISE_MASK]) * 0.25) * env;
      }
    }
    this.emit(len, t0, gain, pan, 0.15);
  }

  /** R2's zapper: gated band-passed noise and a square buzz */
  zap(t0: number, dur: number, gain: number, pan = 0): void {
    const r = this.rng;
    const len = Math.ceil((dur + 0.1) * SR);
    const bp = new SVF(3200, 3);
    let ph = 0;
    let nz = r.int(0, NOISE_MASK);
    for (let i = 0; i < len; i++) {
      const x = i / SR;
      ph += 120 / SR;
      if (ph >= 1) ph -= 1;
      const gate = sin1(55 * x) > 0 ? 1 : 0;
      const on = Math.min(1, x / 0.005, Math.max(0, (dur - x) / 0.005));
      const buzz = (ph < 0.5 ? 1 : -1) * (x < 0.01 ? x / 0.01 : Math.exp(-(x - 0.01) / (dur / 3))) * 0.15;
      S[i] = bp.bp(NOISE[nz++ & NOISE_MASK]) * gate * on + buzz;
    }
    this.emit(len, t0, gain, pan, 0.2);
  }

  /** lightsaber: snap-hiss ignition, then a detuned hum with a slow swing, harmonics up to ~1 kHz */
  saber(t: number, t1: number, gain: number, pan = 0): void {
    const r = this.rng;
    const dur = t1 - t;
    const len = Math.min(MAXN, Math.ceil(dur * SR));
    const bp = new SVF(600, 1), lp = new SVF(1000, 0.9);
    const ph = [r.next(), r.next(), r.next()];
    const fr = [88, 90.5, 176];
    const sw = r.range(0.7, 1.1), swp = r.next();
    let nz = r.int(0, NOISE_MASK);
    for (let b = 0; b < len; b += CR) {
      const tb = b / SR;
      bp.set(expSweep(600, 4200, tb / 0.25), 1);
      const glide = expSweep(0.6, 1, tb / 0.2) * (1 + 0.01 * sin1(swp + sw * tb + 0.25));
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const x = (b + i) / SR;
        let h = 0;
        for (let k = 0; k < 3; k++) {
          const d = (fr[k] * glide) / SR;
          ph[k] += d;
          if (ph[k] >= 1) ph[k] -= 1;
          h += saw(ph[k], d);
        }
        const hum = sat(lp.lp(h) * 0.9) * Math.min(1, x / 0.18, Math.max(0, (dur - x) / 0.2)) * (1 + 0.12 * sin1(swp + sw * x)) * 0.55;
        const hiss = bp.bp(NOISE[nz++ & NOISE_MASK]) * (x < 0.01 ? (x / 0.01) * 0.8 : 0.8 * Math.exp(-(x - 0.01) / (0.35 / 3)));
        S[b + i] = hum + hiss;
      }
    }
    this.emit(len, t, gain, pan, 0.3);
  }

  /**
   * The hangar's ray shield: a steady electric hum that flickers (the picture's own 90 rad/s square
   * gate) between tFlick and tOff while its pitch collapses, with a crackle, then cuts out.
   */
  shield(t0: number, tFlick: number, tOff: number, gain: number): void {
    const r = this.rng;
    const len = Math.ceil((tOff - t0 + 0.03) * SR);
    const lp = new SVF(900, 0.8), cr = new SVF(3000, 2);
    let p1 = r.next(), p2 = r.next();
    let nz = r.int(0, NOISE_MASK);
    let gate = 1;
    const gk = 1 - Math.exp(-1 / (0.002 * SR));
    for (let b = 0; b < len; b += CR) {
      const tl = b / SR;
      const f = tl < tFlick - t0 ? 110 : expSweep(110, 30, (tl - (tFlick - t0)) / (tOff - tFlick));
      const d1 = f / SR, d2 = (f * 1.006) / SR;
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const x = (b + i) / SR;
        const T = t0 + x;
        const flick = T >= tFlick;
        const target = T >= tOff ? 0 : flick ? (Math.sin((T - t0) * 90) > 0 ? 1 : 0.17) : 1;
        gate += (target - gate) * gk;
        p1 += d1;
        if (p1 >= 1) p1 -= 1;
        p2 += d2;
        if (p2 >= 1) p2 -= 1;
        const hum = lp.lp(saw(p1, d1) + saw(p2, d2)) * 0.5;
        const crackle = flick ? cr.bp(NOISE[nz++ & NOISE_MASK]) * 0.35 : 0;
        S[b + i] = (hum + crackle) * gate * Math.min(1, x / 0.4);
      }
    }
    this.emit(len, t0, gain, 0, 0.3);
  }

  /** a fighter skidding on its belly: falling band-passed scrape, ringing metal and sparks */
  skid(t0: number, t1: number, gain: number, pan = 0): void {
    const r = this.rng;
    const dur = t1 - t0;
    const len = Math.ceil(dur * SR);
    const bp = new SVF(2400, 3);
    const modes = [1150, 2300, 3700].map((f) => new SVF(f * r.range(0.95, 1.05), 14));
    let nz = r.int(0, NOISE_MASK);
    let jit = 1;
    for (let b = 0; b < len; b += CR) {
      const x0 = b / len;
      bp.set(expSweep(2400, 500, x0), 3);
      if ((b / CR) % 12 === 0) jit = r.range(0.4, 1.3);
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const x = (b + i) / len;
        const n = NOISE[nz++ & NOISE_MASK];
        let ring = 0;
        for (const m of modes) ring += m.bp(n);
        S[b + i] = (bp.bp(n) + ring * 0.5 * jit) * (1 - x) * Math.min(1, ((b + i) / SR) / 0.01);
      }
    }
    this.emit(len, t0, gain, pan, 0.3);
    for (let tc = t0; tc < t1; tc += r.range(0.008, 0.035) * (1 + 2 * ((tc - t0) / dur))) this.click(tc, gain * r.range(0.1, 0.35) * (1 - (tc - t0) / dur), pan + r.range(-0.3, 0.3), r.range(3000, 7000), r.range(0.003, 0.01));
  }

  /** a minifig landing on the deck: a hollow plastic tok and a small puff */
  thud(t: number, gain: number, pan = 0): void {
    const r = this.rng;
    const len = Math.ceil(0.3 * SR);
    const bp = new SVF(2000, 1.5), dust = new SVF(1200, 0.7);
    const ph = [r.next(), r.next(), r.next(), r.next()];
    let nz = r.int(0, NOISE_MASK);
    for (let i = 0; i < len; i++) {
      const x = i / SR;
      const n = NOISE[nz++ & NOISE_MASK];
      const tok = sin1(ph[0] + 380 * x) * Math.exp(-x / 0.03) + sin1(ph[1] + 1150 * x) * Math.exp(-x / 0.012) * 0.6 + sin1(ph[2] + 2400 * x) * Math.exp(-x / 0.006) * 0.3 + sin1(ph[3] + 140 * x) * Math.exp(-x / 0.05) * 0.5;
      S[i] = (tok + bp.bp(n) * Math.exp(-x / 0.002) + dust.lp(n) * Math.exp(-x / 0.12) * 0.25) * (x < 0.0005 ? x / 0.0005 : 1);
    }
    this.fadeTail(len);
    this.emit(len, t, gain, pan, 0.25);
  }

  /** a body flipping through the air: one fast band-passed swish */
  swish(t: number, dur: number, gain: number, pan0: number, pan1: number): void {
    const r = this.rng;
    const len = Math.ceil(dur * SR);
    const bp = new SVF(700, 1.5);
    let nz = r.int(0, NOISE_MASK);
    for (let b = 0; b < len; b += CR) {
      const x = b / len;
      bp.set(x < 0.5 ? expSweep(700, 2600, x / 0.5) : expSweep(2600, 900, (x - 0.5) / 0.5), 1.5);
      const e = Math.min(CR, len - b);
      for (let i = 0; i < e; i++) {
        const xx = (b + i) / len;
        S[b + i] = bp.bp(NOISE[nz++ & NOISE_MASK]) * Math.pow(Math.sin(Math.PI * xx), 1.5) * (0.85 + 0.15 * sin1(18 * xx * dur));
      }
    }
    this.emit(len, t, gain, pan0, 0.2, pan1);
  }

  /** canopy release: a latch clunk and a pneumatic hiss */
  canopy(t: number, gain: number, pan = 0): void {
    const r = this.rng;
    const len = Math.ceil(0.5 * SR);
    const hp = new SVF(2500, 0.7);
    let nz = r.int(0, NOISE_MASK);
    const p = r.next();
    for (let i = 0; i < len; i++) {
      const x = i / SR;
      const clunk = (sin1(p + 240 * x) * Math.exp(-x / 0.04) + sin1(820 * x) * Math.exp(-x / 0.015) * 0.5) * (x < 0.0005 ? x / 0.0005 : 1);
      const hiss = hp.hp(NOISE[nz++ & NOISE_MASK]) * smoothstep(0.02, 0.06, x) * (x < 0.3 ? 1 : Math.exp(-(x - 0.3) / 0.05)) * 0.35;
      S[i] = clunk + hiss;
    }
    this.fadeTail(len);
    this.emit(len, t, gain, pan, 0.2);
  }
}

/* ------------------------------------------------------------------ placement */

export interface SfxResult {
  log: string[];
}

/**
 * Lay the sound design on the picture. Scripted effects are keyed to shots by name (skipped when a
 * shot is missing); explosions and laser fire come from the fx event lists, attenuated by distance
 * to the camera.
 */
export function renderSfx(inp: AudioInputs, dry: Stereo, send: Stereo): SfxResult {
  const x = new Sfx(dry, send);
  const log: string[] = [];
  const scripted = new Set<string>();
  const shot = (name: string) => inp.shots.find((s) => s.name === name);
  const on = (name: string, f: (T: (t: number) => number, dur: number) => void): void => {
    const s = shot(name);
    if (!s) return;
    const s0 = s.start ?? 0;
    f((t) => s0 + Math.min(t, s.dur), s.dur);
    scripted.add(name);
  };

  on('longtake', (T) => {
    x.whoosh(T(2.9), 1.8, 0.9, -0.2, 0.3, 2000, 200);
    x.engine(T(3), T(16), [[T(3.6), 0.5], [T(6), 0.32], [T(10), 0.4], [T(12), 0.55], [T(15.8), 0.4]]);
    x.whoosh(T(10.2), 2.4, 0.7, 0.2, -0.6, 1600, 180);
  });
  for (const n of ['track', 'vultures', 'hand-reveal', 'missiles', 'rescue', 'hangar-approach']) {
    on(n, (T, d) => x.engine(T(0), T(d), [[T(0.15), 0.42], [T(d - 0.1), 0.42]]));
  }
  let seed = 1;
  for (const s of inp.shots.filter((s) => s.name.includes('cockpit'))) {
    const s0 = s.start ?? 0;
    x.engine(s0, s0 + s.dur, [[s0 + 0.1, 0.3], [s0 + s.dur - 0.1, 0.3]], { pitch: 0.6, bright: 0.6 });
    x.beeps(s0 + 0.5, 4, 0.05, 0.4, seed++);
    scripted.add(s.name);
  }
  on('vultures', (T) => {
    for (const tv of [0.9, 1.6, 2.2, 3.1]) x.whoosh(T(tv), 0.9, 0.5, -0.5, 0.6, 2600, 400);
    x.whoosh(T(2.8), 1.2, 0.5, 0.6, -0.6, 1400, 300);
  });
  on('hand-reveal', (T, d) => x.engine(T(0), T(d), [[T(1), 0.25]], { pitch: 0.35, bright: 0.4 }));
  on('missiles', (T) => {
    x.whoosh(T(0.1), 1.9, 0.7, 0.7, -0.2, 3200, 900);
    x.click(T(1.9), 0.5, 0, 1200, 0.05);
    x.buzzSaw(T(2.3), T(4), 0.12, 0.2);
  });
  on('buzz-close', (T, d) => {
    x.buzzSaw(T(0), T(d), 0.2, 0.1);
    x.buzzSaw(T(0.3), T(d - 0.1), 0.12, -0.3);
    x.beeps(T(0.6), 7, 0.14, 0.1, 77);
    x.beeps(T(1.6), 5, 0.15, 0.1, 78);
    x.scream(T(2.55), 0.28, 0.1);
    x.boom(T(2.55), 3, 0.35, 0.1, 10);
  });
  on('rescue', (T) => {
    x.zap(T(2.0), 0.7, 0.3, -0.1);
    x.beeps(T(2.8), 8, 0.16, -0.1, 91);
  });
  on('hangar-approach', (T) => {
    x.shield(T(0), T(2.0), T(2.45), 0.16);
    x.whoosh(T(2.6), 1.4, 0.8, 0.3, -0.3, 1800, 200);
  });
  on('landing', (T) => {
    x.engine(T(0), T(1.1), [[T(0.3), 0.4], [T(1.0), 0.55]], { pitch: 1.1 });
    x.whoosh(T(0.1), 1.0, 0.6, -0.4, 0.2, 2200, 600);
    x.boom(T(1.02), 30, 0.9, 0, 60);
    x.boom(T(1.7), 14, 0.6, 0.2, 40);
    x.skid(T(1.05), T(2.65), 0.5);
    x.clatter(T(1.3), 40, 0.3, 0.1, 2.2);
    x.engine(T(2.1), T(5), [[T(2.6), 0.35], [T(4.2), 0.15]], { pitch: 1.3, pan: 0.4, pan1: 0.1 });
  });
  on('jump-out', (T) => {
    x.canopy(T(0.02), 0.35, -0.3);
    x.canopy(T(0.09), 0.3, 0.3);
    for (const [up, pan] of [[JUMP_OUT.obi, -0.25], [JUMP_OUT.ana, 0.25]] as const) {
      x.swish(T(up + 0.08), 0.8, 0.45, pan * 1.6, pan * 0.4);
      x.thud(T(up + JUMP_OUT.flip), 0.7, pan * 0.5);
      x.clatter(T(up + JUMP_OUT.flip + 0.02), 3, 0.12, pan * 0.5, 0.25);
    }
  });
  on('droids', (T, d) => {
    for (let i = 0; i < 10; i++) x.tick(T(1.2 + i * 0.09), 0.14, 0.3 + (i % 3) * 0.1, [1400 + (i % 3) * 300, 2600, 4100], 0.15);
    x.saber(T(2.9), T(d), 0.5, -0.2);
    x.saber(T(3.0), T(d), 0.45, 0.2);
  });
  log.push(`sfx scripted: ${inp.shots.filter((s) => scripted.has(s.name)).map((s) => s.name).join(', ')}`);

  // explosions, attenuated and delayed by distance, panned deterministically
  let booms = 0;
  inp.explosions.forEach((e, i) => {
    if (e.t0 > inp.duration) return;
    const d = inp.camAt(e.t0).distanceTo(e.pos);
    const loud = Math.min(1, (e.size * 7) / Math.max(1, d));
    if (loud < 0.02) return;
    const delay = Math.min(0.25, d / 20000);
    const pan = (hash1(i * 7 + 3) - 0.5) * 1.1;
    x.boom(e.t0 + delay, e.size, Math.min(0.9, loud * 0.9), pan, e.pieces > 20 && loud > 0.15 ? Math.min(30, e.pieces) : 0, 1 - loud);
    booms++;
  });
  // laser fire: nearest first, at most 3 pews and 1 turbolaser per quarter second
  const cand = inp.lasers
    .map((l, i) => {
      if (l.t0 > inp.duration) return null;
      const d = inp.camAt(l.t0).distanceTo(l.from);
      const big = l.length > 60;
      const loud = big ? Math.min(0.5, 900 / Math.max(1, d)) : Math.min(0.5, 60 / Math.max(1, d));
      return loud < 0.04 ? null : { l, i, big, loud };
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => b.loud - a.loud);
  const slots = new Map<string, number>();
  let pews = 0, turbos = 0;
  for (const c of cand) {
    const key = `${c.big ? 't' : 'p'}${Math.floor(c.l.t0 * 4)}`;
    const used = slots.get(key) ?? 0;
    if (used >= (c.big ? 1 : 3)) continue;
    slots.set(key, used + 1);
    const pan = (hash1(c.i * 13 + 5) - 0.5) * 1.4;
    if (c.big) {
      x.turbo(c.l.t0, c.loud * 0.5, pan);
      turbos++;
    } else {
      x.pew(c.l.t0, c.loud * 0.45, pan, c.l.color === 'red' ? 1 : 1.25);
      pews++;
    }
  }
  log.push(`sfx auto: ${booms} explosions, ${pews} pews, ${turbos} turbolasers (of ${inp.lasers.length} bolts)`);
  return { log };
}
