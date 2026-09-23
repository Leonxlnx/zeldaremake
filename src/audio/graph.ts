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
  // 2026-09-23: 2.6 s was a stone hall — every footstep grew an indoor tail (the offline steps stem
  // stayed within 25 dB of its peak for the whole 250 ms window on four of five surfaces). A wood
  // is short and dark: trunks scatter, leaves absorb the top, nothing comes back for long.
  reverb.buffer = impulseResponse(ctx, rng.fork('ir'), 1.5, 0.96);
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

/** equal-power crossfade of a buffer's last `fade` samples over its first, so a loop has no seam */
function seamless(data: Float32Array, fade: number): Float32Array<ArrayBuffer> {
  const n = data.length - fade;
  for (let i = 0; i < fade; i++) {
    const a = Math.cos((1 - i / fade) * Math.PI * 0.5);
    data[i] = data[i] * a + data[n + i] * Math.cos((i / fade) * Math.PI * 0.5);
  }
  return data.slice(0, n);
}

/**
 * Looping seeded PINK noise (−3 dB/octave, Paul Kellet's filter bank). White noise put through one
 * low-pass is flat below the corner and falls off a cliff above it: a roar with a hard edge. Wind
 * in leaves, a flame and a boot's scuff all have a 1/f tilt, so the bed is built from this instead.
 * The loop seam is crossfaded — a pink loop has enough low-frequency energy to click otherwise.
 */
export function pinkNoiseBuffer(ctx: BaseAudioContext, rng: Rng, seconds = 8): AudioBuffer {
  const fade = Math.floor(ctx.sampleRate * 0.12);
  const n = Math.floor(ctx.sampleRate * seconds) + fade;
  const chans: Float32Array<ArrayBuffer>[] = [];
  for (let c = 0; c < 2; c++) {
    const d = new Float32Array(n);
    const r = rng.fork(`pink${c}`);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.075076;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    chans.push(seamless(d, fade));
  }
  const buf = ctx.createBuffer(2, chans[0].length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) buf.copyToChannel(chans[c], c);
  return buf;
}

/** how a control envelope is shaped: `rateHz` is its own sample rate, `hz` the wander's speed */
export interface ControlNoiseOptions {
  seconds?: number;
  /** the envelope buffer's own sample rate (played back at this rate through `controlSource`) */
  rateHz?: number;
  /** the corner of the two one-pole smoothers: how fast the value wanders */
  hz?: number;
  /** > 1 makes the peaks sparser and the valleys longer (gusts rather than a wobble) */
  shape?: number;
}

/**
 * A seeded, irregular control envelope in 0..1 — a random walk smoothed twice and normalised.
 * Sine LFOs give a bed a periodic wobble the ear locks onto after a few seconds; wind, a flame and
 * leaf flutter are all irregular, so every continuous level in the bed is modulated by one of
 * these instead. Stored at `rateHz` and resampled by the buffer source (see `controlSource`), so a
 * 45 s envelope costs a few kilobytes.
 */
export function controlNoiseBuffer(ctx: BaseAudioContext, rng: Rng, o: ControlNoiseOptions = {}): AudioBuffer {
  const rateHz = o.rateHz ?? 120;
  const seconds = o.seconds ?? 45;
  const hz = o.hz ?? 0.2;
  const shape = o.shape ?? 1;
  const fade = Math.max(2, Math.floor(rateHz * 0.5));
  const n = Math.floor(rateHz * seconds) + fade;
  const a = Math.exp((-2 * Math.PI * hz) / rateHz);
  const d = new Float32Array(n);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    lp1 += (rng() * 2 - 1 - lp1) * (1 - a);
    lp2 += (lp1 - lp2) * (1 - a);
    d[i] = lp2;
  }
  const out = seamless(d, fade);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of out) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.pow((out[i] - lo) / span, shape);
  const buf = ctx.createBuffer(1, out.length, ctx.sampleRate);
  buf.copyToChannel(out, 0);
  return buf;
}

/**
 * Play a `controlNoiseBuffer` at its own rate and scale it by `depth`. The caller connects `out` to
 * an AudioParam (whose automation stays the floor the envelope rides on) or to a gain node that
 * gates the modulation with something else — the wind gust, say.
 */
export function controlSource(ctx: BaseAudioContext, buffer: AudioBuffer, depth: number, rateHz = 120, when = 0): { src: AudioBufferSourceNode; out: GainNode } {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.playbackRate.value = rateHz / ctx.sampleRate;
  const out = gain(ctx, depth);
  src.connect(out);
  src.start(when);
  return { src, out };
}

/**
 * Run `fn` once the context clock has passed `when` — a plain timer live, a no-op offline (the
 * whole graph is discarded when the render finishes). Voices that are built per event (a step, a
 * leaf flutter, a bird) tear themselves down with this so the live graph does not grow.
 */
export function cleanupAt(ctx: BaseAudioContext, when: number, fn: () => void): void {
  if (typeof (ctx as OfflineAudioContext).startRendering === 'function') return;
  setTimeout(fn, Math.max(0, (when - ctx.currentTime) * 1000 + 50));
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

/**
 * Attack–decay envelope on a gain param starting at `t` (linear attack, exponential decay).
 *
 * The close to zero matters: an exponential ramp cannot reach 0, so a gate left at the ramp's floor
 * stays OPEN for ever. Every burst here is a tap on one shared looping noise source, so without
 * this each scheduled grain leaves a −66 dB tap of that noise running — inaudible once, a rising
 * hiss floor after a few hundred (a 35 s offline render of the steps had lifted its own floor by
 * ~15 dB by the end, and the live graph carries the same taps until its cleanup timer fires).
 */
export function adEnvelope(param: AudioParam, t: number, peak: number, attack: number, decay: number, floor = 0.0005): void {
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(floor, t + attack + decay);
  param.setValueAtTime(0, t + attack + decay);
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
