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

/**
 * The step compressor's own makeup gain, measured rather than documented: with the settings in
 * `createBuses` the node put the offline footsteps stem 8.1 dB LOUDER than before it was added.
 */
export const SFX_MAKEUP_DB = 8.1;

/**
 * How far under the designs the footsteps are then held — and the answer to the owner's *"the music
 * kind of still shakes whenever I run"* (2026-09-24, 23:00).
 *
 * The compressor above was the first answer to that sentence and it is only half of one. Measured
 * on the plaza spine at 2.2 m/s, the step rate stands **4.4 dB over the music's beat** in the
 * mix's envelope spectrum with the compressor in, down from 7.6 with it out: the strongest rhythm
 * in the mix is still the player's feet. `2026-09-26-release` then ruled out the compressor's
 * release as the cause — modelled from 60 ms to 1000 ms the step line moves 21.3 → 21.7 dB, so the
 * pump is not the gain moving between steps, it is the residual transient itself — which leaves
 * level, and this is it.
 *
 * Priced exactly rather than guessed. The trim is a plain gain on one linear part of the mix, so
 * with the dry steps rendered once (`art/audio/2026-09-26-release/dry.mjs`) every candidate is
 * arithmetic on takes already made. How far the step rate then stands over the music's beat:
 *
 *      cut      run       walk
 *     +0 dB   +4.4 dB   +1.1 dB      <- the compressor alone
 *     +2 dB   +1.4 dB   −1.7 dB
 *     +3 dB   −0.2 dB   −2.0 dB
 *     +4 dB   −1.8 dB   −2.0 dB      <- here
 *     +6 dB   −5.3 dB   −2.1 dB
 *
 * A walk saturates at −2 dB: past a 3 dB cut its step rate is no longer the tallest thing near
 * 2.73 Hz and stops falling. 4 dB is where a run joins it — the smallest cut that buys a run the
 * margin a walk already has, rather than a number chosen for how far it goes.
 *
 * It costs nothing it was asked to protect. A trim on the bus scales both gaits alike, so the run's
 * audible lead over a walk is untouched; the steps are the loudest transient in the game, so the
 * worst case the master is staged against (`level.test.mjs`) can only fall; and a step still peaks
 * **26 dB over the always-on level of the bed and the music together**, which is not a footstep in
 * danger of being lost under the background the owner has twice asked to be quieter.
 *
 * It has to be HERE, downstream of the compressor, and that is not a detail. Every step the game
 * makes is in full four-to-one compression (`art/audio/2026-09-26-perstep/`), so the same decibels
 * taken off the step designs instead would come back out of the ratio and change almost nothing.
 */
export const STEP_CUT_DB = 6;

/** the sfx bus's output trim: the compressor's makeup taken back off, and the step cut on top */
export const SFX_TRIM = dB(-(SFX_MAKEUP_DB + STEP_CUT_DB));

export interface Buses {
  master: GainNode;
  music: GainNode;
  ambience: GainNode;
  sfx: GainNode;
  /** shared reverb send (ambience + sfx) */
  reverb: ConvolverNode;
  reverbReturn: GainNode;
  /** the small plank room a hut's interior is (see `ROOM_*` in footsteps.ts) */
  room: ConvolverNode;
  roomReturn: GainNode;
}

/**
 * The hut interior: 0.32 s, dense, dark, with its early reflections in the first 6–28 ms.
 *
 * Not the hall with more send on it. The hall is a 1.5 s wood — trunks scattering four to twelve
 * metres off — and pushing a footstep further into that makes a hut sound like a *larger* forest,
 * which is the opposite of walking indoors. A plank box two or three metres across answers sooner,
 * denser and shorter, and dies before the next step.
 *
 * Nor is it three discrete echoes, which was the first attempt here and measured like its before:
 * a wooden step already rings for 100 ms, so first-order reflections arriving 11 dB under it (the
 * spreading loss over a 5.7 m path off a plank wall) disappeared into the step's own tail — the
 * reflected-to-direct ratio in the 5–35 ms window went *down* 2.5 dB, because the only thing three
 * quiet taps changed was how hard the step compressor pulled. A real small room is not a handful of
 * first-order reflections; it is those reflecting again off six surfaces until they are a field.
 */
export const ROOM_SECONDS = 0.32;
export const ROOM_EARLY_AT = 0.006;
export const ROOM_EARLY_SPREAD = 0.022;
/** the top a plank wall gives back, the same 3 kHz the wood's own return is held to */
export const ROOM_TOP_HZ = 3000;
/**
 * The room's return, which is a calibration and not a taste.
 *
 * `ConvolverNode.normalize` rescales an impulse by an internal rule that has nothing to do with the
 * room being modelled, so the level a send of 1.0 produces is arbitrary and the only way to know it
 * is to render and subtract. At 1.0 the room answered a footstep **18.6 dB under it** — present in
 * the file, not present in the room. This puts it at about −11 dB, which is a live plank box a
 * player can hear he is inside of without every step growing a cellar.
 *
 * For reference the physics of the real thing is louder still: a 2 m hut with α ≈ 0.15 has a room
 * constant near 9 m², which puts the reverberant field about 9 dB *over* the direct sound of a boot
 * 1.7 m below the ear. A footstep in a small wooden room really is mostly reflection. Modelling
 * that honestly would be exhausting to walk around in, so this sits well below it and says so.
 */
export const ROOM_RETURN = 2.4;

/**
 * The master's output trim (dB), and the gain it becomes.
 *
 * Everything in this file was built from the bed upward and nothing ever gain-staged the result, so
 * the mix shipped at **−32.6 LUFS** — ten to fifteen decibels under what every other application on
 * the owner's machine is normalised to. He has to run his system that much hotter for this game
 * than for anything else, which raises his own hardware's noise floor under all of it.
 *
 * Held back twice, on the grounds that level is the axis he has asked to lower ("the background
 * sound is too buzzy", "LOWER THE WHITE NOISE"). That reasoning does not survive being written
 * down: **a master gain changes no ratio in the mix.** He sets his volume by ear, so every relative
 * level he hears — the bed against the tune, a footstep against a gust, the floor against the
 * events — is identical either way. The percept he complained about lives in a ratio, and this
 * cannot touch it. What it buys is only that he stops cranking the system.
 *
 * Sized against the worst case rather than an average, because an average is all this lane had ever
 * measured. Two takes agree on the ceiling to a tenth of a decibel: thirteen minutes of ordinary
 * play peaked at −16.7 dBFS true, and a deliberately constructed worst case — running *and* jumping
 * on the flagstones under the lantern bough, 168 steps, 51 landings and 30 shoves in seventy
 * seconds with the score playing — also peaked at **−16.7**. It is stable because the sfx bus has a
 * compressor on it, so no amount of stacking gets past it.
 *
 * +9 dB leaves the true peak at −7.7 dBFS and puts the mix at −23.6 LUFS: inside the normal band,
 * at the conservative end of it, with nearly eight decibels still unused for sources nobody has
 * measured yet (the ruins' waterfall close to, whatever the expansions add). It is one number —
 * move it if the owner wants the game louder or quieter, and nothing else in the mix moves with it.
 */
export const MASTER_TRIM_DB = 9;
export const MASTER_LEVEL = dB(MASTER_TRIM_DB);

/** master ← music (−12 dB under the ambience) / ambience / sfx; a shared hall on a send. */
export function createBuses(ctx: BaseAudioContext, rng: Rng, limiter = true): Buses {
  const master = ctx.createGain();
  master.gain.value = MASTER_LEVEL;
  master.connect(ctx.destination);
  const music = ctx.createGain();
  music.gain.value = dB(-12);
  const ambience = ctx.createGain();
  ambience.gain.value = 1;
  const sfx = ctx.createGain();
  sfx.gain.value = 1;
  music.connect(master);
  ambience.connect(master);
  /**
   * 2026-09-24, owner 23:00: "the music kind of still shakes whenever I run".
   *
   * The music is steady — measured on the offline stems its own 1.2 Hz beat (76 bpm) stands 17×
   * over the background of its envelope spectrum whether he is standing, walking or running. What
   * changes when he runs is the FOOTSTEPS: they are the loudest transients in the game, and at a
   * running cadence they arrive 3.67 times a second (PR #59's controller; it was five a second when
   * he said this). In the mix's envelope the strongest rhythm then stops being the music's beat and
   * becomes the step rate — a pulse at a few Hz laid over sustained notes, which is what shaking
   * sounds like.
   *
   * So the steps get a compressor of their own. It is on the sfx bus, NOT the master: the music is
   * never touched, ducked or side-chained — only the thing that was punching through it comes down.
   *
   * It does not do what this used to claim. "Quiet steps pass untouched, a run's are held" reads
   * like a threshold set between the two gaits, and the threshold is under BOTH: measured step by
   * step, every footstep the game makes — standing, walking, running, on every surface — is in full
   * four-to-one compression (`art/audio/2026-09-26-perstep/`). What it actually is, is a fixed pad
   * with a wobble, and it is worth 3.2 dB of the complaint. The rest is `STEP_CUT_DB`.
   */
  const sfxLimit = ctx.createDynamicsCompressor();
  sfxLimit.threshold.value = -30;
  sfxLimit.knee.value = 12;
  sfxLimit.ratio.value = 4;
  sfxLimit.attack.value = 0.003;
  sfxLimit.release.value = 0.12;
  // DynamicsCompressorNode applies its own makeup gain, which is not optional and not documented
  // as a number: with these settings it put the footsteps stem 8.1 dB LOUDER than before it was
  // added (peak −14.3 → −10.1 dBFS). SFX_TRIM takes that back, measured on the offline steps stem
  // rather than guessed, and carries the step cut that finishes the job the compressor started.
  const sfxTrim = ctx.createGain();
  sfxTrim.gain.value = SFX_TRIM;
  // `limiter: false` takes the compressor out of the path for an offline take, so what it is worth
  // can be measured rather than asserted. Its makeup gain goes with it, so the trim comes out too:
  // the bypassed stem is the steps as the designs make them, at the level the designs ask for.
  if (limiter) sfx.connect(sfxLimit).connect(sfxTrim).connect(master);
  else sfx.connect(master);
  const reverb = ctx.createConvolver();
  // 2026-09-23: 2.6 s was a stone hall — every footstep grew an indoor tail (the offline steps stem
  // stayed within 25 dB of its peak for the whole 250 ms window on four of five surfaces). A wood
  // is short and dark: trunks scatter, leaves absorb the top, nothing comes back for long.
  reverb.buffer = impulseResponse(ctx, rng.fork('ir'), 1.5, 0.96);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.28;
  // 2026-09-23 (owner 20:08, "LOWER THE WHITE NOISE"): the hall's impulse is generated from noise,
  // so its early part hands a little broadband hiss back to everything that uses it — the music
  // most of all, which sends 0.55 of a continuous bus. Trunks scatter and leaves absorb: a wood
  // returns almost nothing above 3 kHz.
  const reverbTop = filter(ctx, 'lowpass', 3000, 0.6);
  reverb.connect(reverbTop).connect(reverbReturn);
  reverbReturn.connect(master);
  const room = ctx.createConvolver();
  room.buffer = impulseResponse(ctx, rng.fork('roomir'), ROOM_SECONDS, 0.9, ROOM_EARLY_AT, ROOM_EARLY_SPREAD, ROOM_EARLY_AT);
  const roomReturn = ctx.createGain();
  roomReturn.gain.value = ROOM_RETURN;
  // the return joins the master rather than the sfx bus, so the room answering a step is not itself
  // squeezed by the step compressor — the same place the hall's return goes, for the same reason
  const roomTop = filter(ctx, 'lowpass', ROOM_TOP_HZ, 0.6);
  room.connect(roomTop).connect(roomReturn);
  roomReturn.connect(master);
  return { master, music, ambience, sfx, reverb, reverbReturn, room, roomReturn };
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
  liveVoices++;
  const done = () => {
    liveVoices--;
    fn();
  };
  // A silent source stopped at `when`, so the teardown rides the AUDIO clock.
  //
  // This was a `setTimeout` with an early return offline, on the reasoning that "the whole graph is
  // discarded when the render finishes". True of memory and false of cost: nothing was ever
  // disconnected during a render, so every node any event had ever built stayed in the graph and
  // was processed for every remaining quantum. Measured, the cost grew as the SQUARE of the take —
  // thirty seconds of the mix rendered in 33 s of wall clock and a hundred and twenty in 425
  // (`art/audio/2026-09-25-cost/`).
  //
  // It is also the better clock live. A wall-clock timer drifts from the audio it is cleaning up
  // after, and a background tab throttles it; `onended` fires in step with the render offline and
  // with the context live, which is when the voice is actually finished.
  const make = (ctx as BaseAudioContext & { createConstantSource?: () => ConstantSourceNode }).createConstantSource;
  if (typeof make !== 'function') {
    // no ConstantSourceNode (a harness's stand-in context): fall back to the wall clock live, and
    // to nothing offline, which is what this did everywhere before
    if (typeof (ctx as OfflineAudioContext).startRendering === 'function') {
      liveVoices--;
      return;
    }
    setTimeout(done, Math.max(0, (when - ctx.currentTime) * 1000 + 50));
    return;
  }
  const tick = make.call(ctx);
  tick.offset.value = 0;
  tick.connect(ctx.destination);
  tick.start();
  tick.stop(Math.max(when, ctx.currentTime + 1 / ctx.sampleRate));
  tick.onended = () => {
    tick.disconnect();
    done();
  };
}

/**
 * Voices alive in the live graph — every event (a step, a leaf, a bird, a note) builds its own
 * little chain and tears it down through `cleanupAt`. Running lights several a second, so this is
 * the number to look at when the audio thread starts missing its deadline.
 */
let liveVoices = 0;
export const voices = (): number => liveVoices;

/**
 * Generated hall: stereo-decorrelated exponentially decaying noise with the highs rolling off
 * over time (a soft, leafy space rather than a stone room).
 *
 * `earlyAt` / `earlySpread` are when the discrete early reflections land, which is the only thing
 * that distinguishes one size of space from another before the tail takes over: a surface `d`
 * metres away answers `2d / 343` seconds later, so the wood's defaults (12–72 ms) are trunks four
 * to twelve metres off, and a hut's walls are a quarter of that.
 *
 * `preDelay` is when the space starts answering at all. It defaults to 0, which is what the wood
 * has always used and is wrong in a way that only shows up in a small space: with the diffuse tail
 * starting at sample 0, a send adds a copy of the source to the source, thickening the attack
 * rather than reflecting it. Measured, that is not a subtlety — it pushed the room's own energy
 * into the 0–5 ms direct window and made a step in a hut read as *less* reflective than one in the
 * open. Nothing reaches a listener before the direct sound, and in a hut the first thing that does
 * is 6 ms behind it.
 */
export function impulseResponse(ctx: BaseAudioContext, rng: Rng, seconds: number, damp: number, earlyAt = 0.012, earlySpread = 0.06, preDelay = 0): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const pre = Math.floor(ctx.sampleRate * preDelay);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng.fork(`ir${c}`);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const j = i - pre;
      const t = j / (n - pre);
      const env = Math.exp(-t * 6.5) * (j < 400 ? j / 400 : 1);
      // one-pole low-pass whose cutoff falls as the tail decays
      const k = 0.15 + damp * 0.8 * t;
      lp += (r() * 2 - 1 - lp) * (1 - k);
      d[i] = lp * env;
    }
    // early reflections
    for (let e = 0; e < 8; e++) {
      const at = Math.floor(ctx.sampleRate * (earlyAt + r() * earlySpread));
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
