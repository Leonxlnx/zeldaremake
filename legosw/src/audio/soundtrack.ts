import type { Vector3 } from 'three';
import { Rng } from '../core/rng';
import type { Shot } from '../film/shots';

/**
 * The whole soundtrack, synthesised offline with WebAudio (OfflineAudioContext) — no samples.
 * Sound design follows the picture: engine passes, cannon pews, turbolasers, explosions with the
 * clatter of LEGO pieces, buzz-droid saws, astromech chatter, lightsaber snap-hiss, mumbled
 * LEGO-game dialogue under the subtitles, and an original ambient score.
 */

export interface AudioInputs {
  shots: Shot[];
  duration: number;
  camAt: (T: number) => Vector3;
  lasers: { t0: number; from: Vector3; color: string; length: number }[];
  explosions: { t0: number; pos: Vector3; size: number; pieces: number }[];
}

type Ctx = OfflineAudioContext;

class Mixer {
  ctx: Ctx;
  bus: GainNode;
  verb: ConvolverNode;
  verbSend: GainNode;
  noise: AudioBuffer;
  rng = new Rng(4242);
  constructor(ctx: Ctx) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    comp.connect(master).connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.connect(comp);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.8, 2.2);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.35;
    this.verbSend.connect(this.verb).connect(comp);
    const n = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    const r = new Rng(9);
    for (let i = 0; i < n; i++) d[i] = r.next() * 2 - 1;
  }
  impulse(sec: number, decay: number): AudioBuffer {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    const r = new Rng(77);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (r.next() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }
  /** output chain: gain → pan → bus (+ reverb send) */
  out(gain: number, pan = 0, verb = 0.2): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.bus);
    if (verb > 0) {
      const s = this.ctx.createGain();
      s.gain.value = verb;
      p.connect(s).connect(this.verbSend);
    }
    return g;
  }
  noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = this.rng.range(0, 2);
    s.start(Math.max(0, t), this.rng.range(0, 2));
    s.stop(t + dur + 0.05);
    return s;
  }
  env(g: AudioParam, t: number, a: number, peak: number, d: number, curve = 3): void {
    g.setValueAtTime(0.0001, Math.max(0, t));
    g.linearRampToValueAtTime(peak, t + a);
    g.setTargetAtTime(0.0001, t + a, d / curve);
  }

  /* ---------------------------------------------------------------- sound designs */

  pew(t: number, gain: number, pan = 0, pitch = 1): void {
    const c = this.ctx;
    const o = this.out(gain, pan, 0.15);
    const env = c.createGain();
    this.env(env.gain, t, 0.004, 1, 0.16);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    env.connect(lp).connect(o);
    for (const [type, mul] of [['sawtooth', 1], ['square', 1.5]] as const) {
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(1900 * pitch * mul, t);
      osc.frequency.exponentialRampToValueAtTime(210 * pitch * mul, t + 0.2);
      const g = c.createGain();
      g.gain.value = type === 'square' ? 0.25 : 0.5;
      osc.connect(g).connect(env);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  turbo(t: number, gain: number, pan = 0): void {
    const c = this.ctx;
    const o = this.out(gain, pan, 0.4);
    const env = c.createGain();
    this.env(env.gain, t, 0.01, 1, 0.5);
    env.connect(o);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    osc.connect(lp).connect(env);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  boom(t: number, size: number, gain: number, pan = 0, clatter = 0): void {
    const c = this.ctx;
    const dur = 0.5 + Math.min(2.8, Math.sqrt(size) * 0.18);
    const o = this.out(gain, pan, 0.45);
    // body: filtered noise
    const n = this.noiseSrc(t, dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(size > 50 ? 1800 : 4200, t);
    lp.frequency.exponentialRampToValueAtTime(size > 50 ? 90 : 180, t + dur);
    const e = c.createGain();
    this.env(e.gain, t, 0.006, 1, dur);
    n.connect(lp).connect(e).connect(o);
    // sub thump
    const s = c.createOscillator();
    s.type = 'sine';
    s.frequency.setValueAtTime(size > 50 ? 60 : 110, t);
    s.frequency.exponentialRampToValueAtTime(size > 50 ? 26 : 40, t + dur * 0.6);
    const se = c.createGain();
    this.env(se.gain, t, 0.004, size > 50 ? 1.4 : 0.9, dur * 0.6);
    s.connect(se).connect(o);
    s.start(t);
    s.stop(t + dur + 0.1);
    // crackle
    for (let i = 0; i < 12; i++) {
      const tc = t + this.rng.range(0.05, dur * 0.7);
      this.click(tc, gain * this.rng.range(0.05, 0.18), pan, this.rng.range(900, 3000));
    }
    if (clatter > 0) this.clatter(t + 0.06, clatter, gain * 0.6, pan);
  }

  click(t: number, gain: number, pan: number, freq: number, dur = 0.018): void {
    const c = this.ctx;
    const o = this.out(gain, pan, 0.1);
    const n = this.noiseSrc(t, dur + 0.02);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 6;
    const e = c.createGain();
    this.env(e.gain, t, 0.001, 1, dur);
    n.connect(bp).connect(e).connect(o);
  }

  /** LEGO pieces bouncing: bright plastic ticks with little resonances */
  clatter(t: number, count: number, gain: number, pan = 0, spread = 1.1): void {
    const c = this.ctx;
    for (let i = 0; i < count; i++) {
      const tc = t + Math.pow(this.rng.next(), 1.6) * spread;
      const f = this.rng.range(1800, 5200);
      const o = this.out(gain * this.rng.range(0.25, 1) * (1 - (tc - t) / (spread * 1.2)), pan + this.rng.range(-0.3, 0.3), 0.25);
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const e = c.createGain();
      this.env(e.gain, tc, 0.0008, 0.6, 0.03);
      osc.connect(e).connect(o);
      osc.start(tc);
      osc.stop(tc + 0.08);
      this.click(tc, gain * 0.5, pan, f * 0.7, 0.01);
    }
  }

  /** engine roar sustained over [t0, t1] with a gain curve, doppler-ish pitch */
  engine(t0: number, t1: number, gains: [number, number][], o: { pitch?: number; pan?: [number, number][]; bright?: number } = {}): void {
    const c = this.ctx;
    const out = this.out(1, 0, 0.2);
    const g = out.gain;
    g.setValueAtTime(0.0001, t0);
    for (const [t, v] of gains) g.linearRampToValueAtTime(Math.max(0.0001, v), t);
    g.linearRampToValueAtTime(0.0001, t1);
    const n = this.noiseSrc(t0, t1 - t0);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 * (o.pitch ?? 1) * (o.bright ?? 1);
    bp.Q.value = 0.7;
    n.connect(bp).connect(out);
    const lo = c.createOscillator();
    lo.type = 'sawtooth';
    lo.frequency.value = 62 * (o.pitch ?? 1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const lg = c.createGain();
    lg.gain.value = 0.35;
    lo.connect(lp).connect(lg).connect(out);
    lo.start(t0);
    lo.stop(t1 + 0.1);
    const hi = c.createOscillator();
    hi.type = 'sine';
    hi.frequency.value = 1250 * (o.pitch ?? 1);
    const hg = c.createGain();
    hg.gain.value = 0.04;
    hi.connect(hg).connect(out);
    hi.start(t0);
    hi.stop(t1 + 0.1);
  }

  whoosh(t: number, dur: number, gain: number, panFrom = -0.8, panTo = 0.8, f0 = 2400, f1 = 260): void {
    const c = this.ctx;
    const o = this.ctx.createGain();
    const p = c.createStereoPanner();
    p.pan.setValueAtTime(panFrom, t);
    p.pan.linearRampToValueAtTime(panTo, t + dur);
    o.connect(p).connect(this.bus);
    const s = c.createGain();
    s.gain.value = 0.3;
    p.connect(s).connect(this.verbSend);
    o.gain.setValueAtTime(0.0001, t);
    o.gain.exponentialRampToValueAtTime(gain, t + dur * 0.45);
    o.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const n = this.noiseSrc(t, dur);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0 * 0.6, t);
    bp.frequency.exponentialRampToValueAtTime(f0, t + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    n.connect(bp).connect(o);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 0.18, t);
    osc.frequency.exponentialRampToValueAtTime(f1 * 0.3, t + dur);
    const og = c.createGain();
    og.gain.value = 0.12;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    osc.connect(lp).connect(og).connect(o);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** astromech chatter: fast sine chirps with glides */
  beeps(t: number, n: number, gain: number, pan = 0, seed = 1, sad = false): void {
    const c = this.ctx;
    const r = new Rng(seed);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = r.range(0.045, 0.12);
      const o = this.out(gain, pan, 0.2);
      const osc = c.createOscillator();
      osc.type = 'sine';
      const f0 = r.range(1400, 3800), f1 = sad ? f0 * 0.5 : r.range(1200, 4200);
      osc.frequency.setValueAtTime(f0, tt);
      osc.frequency.exponentialRampToValueAtTime(f1, tt + d);
      const e = c.createGain();
      this.env(e.gain, tt, 0.004, 1, d * 1.2, 5);
      osc.connect(e).connect(o);
      osc.start(tt);
      osc.stop(tt + d + 0.05);
      tt += d + r.range(0.01, 0.05);
    }
  }

  scream(t: number, gain: number, pan = 0): void {
    const c = this.ctx;
    const o = this.out(gain, pan, 0.35);
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2900, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.9);
    const vib = c.createOscillator();
    vib.frequency.value = 18;
    const vg = c.createGain();
    vg.gain.value = 160;
    vib.connect(vg).connect(osc.frequency);
    const e = c.createGain();
    this.env(e.gain, t, 0.02, 1, 0.9, 2);
    osc.connect(e).connect(o);
    osc.start(t);
    osc.stop(t + 1.1);
    vib.start(t);
    vib.stop(t + 1.1);
  }

  saw(t0: number, t1: number, gain: number, pan = 0): void {
    const c = this.ctx;
    const o = this.out(gain, pan, 0.15);
    const car = c.createOscillator();
    car.type = 'sawtooth';
    car.frequency.value = 1900;
    const mod = c.createOscillator();
    mod.frequency.value = 37;
    const mg = c.createGain();
    mg.gain.value = 260;
    mod.connect(mg).connect(car.frequency);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 2;
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.linearRampToValueAtTime(1, t0 + 0.08);
    e.gain.setValueAtTime(1, t1 - 0.1);
    e.gain.linearRampToValueAtTime(0.0001, t1);
    car.connect(bp).connect(e).connect(o);
    car.start(t0);
    car.stop(t1 + 0.05);
    mod.start(t0);
    mod.stop(t1 + 0.05);
    // metal scrape
    const n = this.noiseSrc(t0, t1 - t0);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    const ng = c.createGain();
    ng.gain.value = 0.25;
    n.connect(hp).connect(ng).connect(e);
  }

  zap(t0: number, dur: number, gain: number, pan = 0): void {
    const c = this.ctx;
    const o = this.out(gain, pan, 0.2);
    const n = this.noiseSrc(t0, dur);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 3;
    const am = c.createGain();
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 55;
    const lg = c.createGain();
    lg.gain.value = 0.5;
    am.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    n.connect(bp).connect(am).connect(o);
    lfo.start(t0);
    lfo.stop(t0 + dur);
    const buzz = c.createOscillator();
    buzz.type = 'square';
    buzz.frequency.value = 120;
    const bg = c.createGain();
    this.env(bg.gain, t0, 0.01, 0.15, dur);
    buzz.connect(bg).connect(o);
    buzz.start(t0);
    buzz.stop(t0 + dur + 0.1);
  }

  saber(t: number, t1: number, gain: number, pan = 0): void {
    const c = this.ctx;
    // snap-hiss
    const o = this.out(gain, pan, 0.3);
    const n = this.noiseSrc(t, 0.5);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.25);
    const ne = c.createGain();
    this.env(ne.gain, t, 0.01, 0.8, 0.35);
    n.connect(bp).connect(ne).connect(o);
    // hum
    const h = this.out(gain * 0.55, pan, 0.25);
    const eh = c.createGain();
    eh.gain.setValueAtTime(0.0001, t);
    eh.gain.linearRampToValueAtTime(1, t + 0.18);
    eh.gain.setValueAtTime(1, t1 - 0.2);
    eh.gain.linearRampToValueAtTime(0.0001, t1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    for (const f of [88, 90.5, 176]) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.6, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.2);
      osc.connect(lp);
      osc.start(t);
      osc.stop(t1 + 0.05);
    }
    lp.connect(eh).connect(h);
  }

  /** LEGO-game mumble: formant-filtered buzz jumping between vowels, syllable by syllable */
  mumble(t0: number, t1: number, voice: 'anakin' | 'obiwan' | 'droid', gain: number, pan = 0, seed = 1): void {
    const c = this.ctx;
    const r = new Rng(seed);
    const base = voice === 'obiwan' ? 118 : voice === 'anakin' ? 138 : 230;
    const vowels: [number, number][] = [[800, 1200], [400, 2000], [500, 900], [350, 2300], [650, 1700], [300, 800]];
    const o = this.out(gain, pan, 0.18);
    const src = c.createOscillator();
    src.type = voice === 'droid' ? 'square' : 'sawtooth';
    src.frequency.setValueAtTime(base, t0);
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 5;
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 7;
    const g1 = c.createGain();
    const g2 = c.createGain();
    g2.gain.value = 0.55;
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    src.connect(f1).connect(g1).connect(amp);
    src.connect(f2).connect(g2).connect(amp);
    amp.connect(o);
    let t = t0;
    while (t < t1 - 0.08) {
      const d = r.range(0.09, 0.2);
      const [a, b] = vowels[r.int(0, vowels.length - 1)];
      f1.frequency.setTargetAtTime(a, t, 0.015);
      f2.frequency.setTargetAtTime(b, t, 0.015);
      src.frequency.setTargetAtTime(base * r.range(0.85, 1.3) * (1 - (t - t0) / (t1 - t0) * 0.15), t, 0.03);
      amp.gain.setTargetAtTime(r.range(0.6, 1), t, 0.012);
      amp.gain.setTargetAtTime(0.05, t + d * 0.75, 0.02);
      t += d;
      if (r.chance(0.18)) t += r.range(0.05, 0.14);
    }
    amp.gain.setTargetAtTime(0.0001, t1 - 0.05, 0.02);
    src.start(t0);
    src.stop(t1 + 0.1);
    if (voice === 'droid') {
      const rm = c.createOscillator();
      rm.frequency.value = 42;
      const rg = c.createGain();
      rg.gain.value = 0.4;
      rm.connect(rg).connect(amp.gain);
      rm.start(t0);
      rm.stop(t1);
    }
  }

  /** original ambient score: slow detuned string-pad chords with a low pulse */
  pad(t0: number, t1: number, chords: number[][], gain: number): void {
    const c = this.ctx;
    const seg = (t1 - t0) / chords.length;
    chords.forEach((ch, i) => {
      const ts = t0 + i * seg;
      const te = ts + seg + 1.5;
      const o = this.out(gain, 0, 0.9);
      const e = c.createGain();
      e.gain.setValueAtTime(0.0001, ts);
      e.gain.linearRampToValueAtTime(1, ts + Math.min(2.5, seg * 0.6));
      e.gain.setValueAtTime(1, te - 1.8);
      e.gain.linearRampToValueAtTime(0.0001, te);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      lp.connect(e).connect(o);
      for (const midi of ch) {
        for (const det of [-7, 6]) {
          const osc = c.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
          osc.detune.value = det;
          const g = c.createGain();
          g.gain.value = 0.08;
          osc.connect(g).connect(lp);
          osc.start(ts);
          osc.stop(te + 0.1);
        }
      }
    });
  }

  timpani(t: number, gain: number, roll = 0): void {
    const c = this.ctx;
    const hits = roll > 0 ? Math.floor(roll * 14) : 1;
    for (let i = 0; i < hits; i++) {
      const th = t + (roll > 0 ? (i / hits) * roll : 0);
      const g = roll > 0 ? gain * (0.3 + 0.7 * (i / hits)) : gain;
      const o = this.out(g, 0, 0.6);
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(92, th);
      osc.frequency.exponentialRampToValueAtTime(72, th + 0.5);
      const e = c.createGain();
      this.env(e.gain, th, 0.003, 1, 0.9);
      osc.connect(e).connect(o);
      osc.start(th);
      osc.stop(th + 1.2);
      const n = this.noiseSrc(th, 0.1);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      const ne = c.createGain();
      this.env(ne.gain, th, 0.001, 0.4, 0.06);
      n.connect(lp).connect(ne).connect(o);
    }
  }
}

function wavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const bytes = new ArrayBuffer(44 + n * ch * 2);
  const v = new DataView(bytes);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * ch * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  let bin = '';
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function renderSoundtrack(inp: AudioInputs): Promise<string> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil((inp.duration + 1) * sr), sr);
  const m = new Mixer(ctx);
  const S = (name: string) => inp.shots.find((s) => s.name === name)!.start!;

  // score: original chords (D minor-ish modal), crawl → long take; a final chord on the end card
  m.pad(S('crawl') + 0.2, S('longtake') + 10, [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61], [50, 57, 62, 69]], 0.5);
  m.timpani(S('longtake') - 1.2, 0.5, 1.2);
  m.timpani(S('longtake') + 0.05, 0.9);
  m.pad(S('endcard') + 0.1, S('endcard') + 4.4, [[50, 57, 62, 66, 69]], 0.5);
  m.timpani(S('endcard') + 0.1, 0.8);

  // mumbled dialogue under every subtitle
  let seed = 1;
  for (const s of inp.shots) {
    for (const l of s.lines ?? []) {
      const voice = l.who.startsWith('Anakin') ? 'anakin' : l.who.startsWith('Obi') ? 'obiwan' : 'droid';
      m.mumble(s.start! + l.t0 + 0.05, s.start! + l.t1 - 0.25, voice, voice === 'droid' ? 0.28 : 0.34, 0, seed++);
    }
  }

  // long take: fighters roar overhead, engines, the dive
  const LT = S('longtake');
  m.whoosh(LT + 2.9, 1.8, 0.9, -0.2, 0.3, 2000, 200);
  m.engine(LT + 3, LT + 16, [[LT + 3.6, 0.5], [LT + 6, 0.32], [LT + 10, 0.4], [LT + 12, 0.55], [LT + 15.8, 0.4]]);
  m.whoosh(LT + 10.2, 2.4, 0.7, 0.2, -0.6, 1600, 180);
  // tracking + dogfight shots: engines
  for (const n of ['track', 'vultures', 'hand-reveal', 'missiles', 'rescue', 'hangar-approach']) {
    const s = inp.shots.find((x) => x.name === n)!;
    m.engine(s.start!, s.start! + s.dur, [[s.start! + 0.15, 0.42], [s.start! + s.dur - 0.1, 0.42]]);
  }
  // cockpits: interior rumble
  for (const s of inp.shots.filter((x) => x.name.includes('cockpit'))) {
    m.engine(s.start!, s.start! + s.dur, [[s.start! + 0.1, 0.3], [s.start! + s.dur - 0.1, 0.3]], { pitch: 0.6, bright: 0.6 });
    m.beeps(s.start! + 0.5, 4, 0.05, 0.4, seed++);
  }
  // vultures shot: droid whooshes past camera
  const V = S('vultures');
  for (const tv of [0.9, 1.6, 2.2, 3.1]) m.whoosh(V + tv, 0.9, 0.5, -0.5, 0.6, 2600, 400);
  m.whoosh(V + 2.8, 1.2, 0.5, 0.6, -0.6, 1400, 300);
  // hand reveal: the big ship's hum
  m.engine(S('hand-reveal'), S('hand-reveal') + 4.5, [[S('hand-reveal') + 1, 0.25]], { pitch: 0.35, bright: 0.4 });
  // missiles: incoming, pop, buzz whirr
  const MI = S('missiles');
  m.whoosh(MI + 0.1, 1.9, 0.7, 0.7, -0.2, 3200, 900);
  m.click(MI + 1.9, 0.5, 0, 1200, 0.05);
  m.saw(MI + 2.3, MI + 4, 0.12, 0.2);
  // buzz close-up: saws, scraping, R4 beeps then scream, the dome goes boing
  const BZ = S('buzz-close');
  m.saw(BZ, BZ + 4.5, 0.2, 0.1);
  m.saw(BZ + 0.3, BZ + 4.4, 0.12, -0.3);
  m.beeps(BZ + 0.6, 7, 0.14, 0.1, 77);
  m.beeps(BZ + 1.6, 5, 0.15, 0.1, 78);
  m.scream(BZ + 2.55, 0.28, 0.1);
  m.boom(BZ + 2.55, 3, 0.35, 0.1, 10);
  // rescue: R2 zap + triumphant beeps
  const RS = S('rescue');
  m.zap(RS + 2.0, 0.7, 0.3, -0.1);
  m.beeps(RS + 2.8, 8, 0.16, -0.1, 91);
  // hangar approach: shield hum dying, entry
  const HA = S('hangar-approach');
  const hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.setValueAtTime(110, HA);
  hum.frequency.setValueAtTime(110, HA + 1.9);
  hum.frequency.exponentialRampToValueAtTime(30, HA + 2.4);
  const hg = m.out(0.12, 0, 0.3);
  const hlp = ctx.createBiquadFilter();
  hlp.type = 'lowpass';
  hlp.frequency.value = 600;
  hum.connect(hlp).connect(hg);
  hg.gain.setValueAtTime(0.0001, HA);
  hg.gain.linearRampToValueAtTime(0.12, HA + 0.4);
  hg.gain.linearRampToValueAtTime(0.0001, HA + 2.4);
  hum.start(HA);
  hum.stop(HA + 2.5);
  m.whoosh(HA + 2.6, 1.4, 0.8, 0.3, -0.3, 1800, 200);
  // landing: crash, skid, pieces everywhere; Anakin's engine whines down
  const LD = S('landing');
  m.boom(LD + 1.02, 30, 0.9, 0, 60);
  m.boom(LD + 1.7, 14, 0.6, 0.2, 40);
  const sk = m.noiseSrc(LD + 1.05, 1.6);
  const skbp = ctx.createBiquadFilter();
  skbp.type = 'bandpass';
  skbp.frequency.setValueAtTime(2400, LD + 1.05);
  skbp.frequency.exponentialRampToValueAtTime(500, LD + 2.6);
  skbp.Q.value = 3;
  const skg = m.out(0.5, 0, 0.3);
  skg.gain.setValueAtTime(0.5, LD + 1.05);
  skg.gain.linearRampToValueAtTime(0.0001, LD + 2.65);
  sk.connect(skbp).connect(skg);
  m.clatter(LD + 1.3, 40, 0.3, 0.1, 2.2);
  m.engine(LD + 2.1, LD + 5, [[LD + 2.6, 0.35], [LD + 4.2, 0.15]], { pitch: 1.3 });
  // droids: marching clicks, sabers
  const DR = S('droids');
  for (let i = 0; i < 10; i++) m.click(DR + 1.2 + i * 0.09, 0.12, 0.3, 1500 + (i % 3) * 300, 0.02);
  m.saber(DR + 2.9, DR + 5.2, 0.5, -0.2);
  m.saber(DR + 3.0, DR + 5.2, 0.45, 0.2);

  // auto: explosions and nearby laser fire, attenuated by distance to the camera
  for (const e of inp.explosions) {
    if (e.t0 > inp.duration) continue;
    const cam = inp.camAt(e.t0);
    const d = cam.distanceTo(e.pos);
    const loud = Math.min(1, (e.size * 7) / Math.max(1, d));
    if (loud < 0.02) continue;
    const delay = Math.min(0.25, d / 20000);
    m.boom(e.t0 + delay, e.size, Math.min(0.9, loud * 0.9), 0, e.pieces > 20 && loud > 0.15 ? Math.min(30, e.pieces) : 0);
  }
  let pews = 0;
  for (const l of inp.lasers) {
    if (l.t0 > inp.duration || pews > 900) continue;
    const cam = inp.camAt(l.t0);
    const d = cam.distanceTo(l.from);
    const big = l.length > 60;
    const loud = big ? Math.min(0.5, 900 / Math.max(1, d)) : Math.min(0.5, 60 / Math.max(1, d));
    if (loud < 0.04) continue;
    pews++;
    if (big) m.turbo(l.t0, loud * 0.5);
    else m.pew(l.t0, loud * 0.45, 0, l.color === 'red' ? 1 : 1.25);
  }

  const buf = await ctx.startRendering();
  return wavBase64(buf);
}
