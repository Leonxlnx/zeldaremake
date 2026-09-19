/**
 * WebAudio building blocks shared by the ambience, footsteps and music: the bus tree, seeded
 * noise buffers, a generated convolution impulse response and small envelope helpers. Every
 * function takes a `BaseAudioContext` so the same graph renders live (AudioContext) and offline
 * (OfflineAudioContext — the gauntlet's `shell1-ambience.wav` evidence).
 */
import { createRng, type Rng } from '../world/util/prng';

export type { Rng };
export { createRng };

export const dB = (v: number) => Math.pow(10, v / 20);

export interface Buses {
  master: GainNode;
  music: GainNode;
  ambience: GainNode;
  sfx: GainNode;
  /** shared reverb send (ambience + sfx) */
  reverb: ConvolverNode;
  reverbReturn: GainNode;
}

/** master ← music (−12 dB under the ambience) / ambience / sfx; a shared hall on a send. */
export function createBuses(ctx: BaseAudioContext, rng: Rng): Buses {
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const music = ctx.createGain();
  music.gain.value = dB(-12);
  const ambience = ctx.createGain();
  ambience.gain.value = 1;
  const sfx = ctx.createGain();
  sfx.gain.value = 1;
  music.connect(master);
  ambience.connect(master);
  sfx.connect(master);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx, rng.fork('ir'), 2.6, 0.9);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.28;
  reverb.connect(reverbReturn);
  reverbReturn.connect(master);
  return { master, music, ambience, sfx, reverb, reverbReturn };
}

/** Looping seeded white noise (seconds long). */
export function noiseBuffer(ctx: BaseAudioContext, rng: Rng, seconds = 4): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng.fork(`noise${c}`);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  }
  return buf;
}

export function noiseSource(ctx: BaseAudioContext, buffer: AudioBuffer, when = 0): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start(when);
  return src;
}

/**
 * Generated hall: stereo-decorrelated exponentially decaying noise with the highs rolling off
 * over time (a soft, leafy space rather than a stone room).
 */
export function impulseResponse(ctx: BaseAudioContext, rng: Rng, seconds: number, damp: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng.fork(`ir${c}`);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = Math.exp(-t * 6.5) * (i < 400 ? i / 400 : 1);
      // one-pole low-pass whose cutoff falls as the tail decays
      const k = 0.15 + damp * 0.8 * t;
      lp += (r() * 2 - 1 - lp) * (1 - k);
      d[i] = lp * env;
    }
    // early reflections
    for (let e = 0; e < 8; e++) {
      const at = Math.floor(ctx.sampleRate * (0.012 + r() * 0.06));
      const g = 0.35 * (1 - e / 8);
      if (at < n) d[at] += (r() * 2 - 1) * g;
    }
  }
  return buf;
}

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, Q = 1, gain = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  f.gain.value = gain;
  return f;
}

export function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** attack–decay envelope on a gain param starting at `t` (linear attack, exponential decay). */
export function adEnvelope(param: AudioParam, t: number, peak: number, attack: number, decay: number, floor = 0.0005): void {
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(floor, t + attack + decay);
}

/** ADSR on a gain param: returns the release end time. */
export function adsr(param: AudioParam, t: number, dur: number, peak: number, a: number, d: number, s: number, r: number): number {
  const floor = 0.0005;
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(Math.max(floor, peak * s), t + a + d);
  const relStart = Math.max(t + a + d, t + dur);
  param.setValueAtTime(Math.max(floor, peak * s), relStart);
  param.exponentialRampToValueAtTime(floor, relStart + r);
  return relStart + r;
}

export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Connect an LFO (oscillator → depth gain) into an AudioParam; returns the oscillator to stop later. */
export function lfo(ctx: BaseAudioContext, target: AudioParam, frequency: number, depth: number, type: OscillatorType = 'sine', when = 0): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const g = ctx.createGain();
  g.gain.value = depth;
  osc.connect(g);
  g.connect(target);
  osc.start(when);
  return osc;
}
