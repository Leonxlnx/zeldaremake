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
 * How far the footsteps are held under the designs — the answer to the owner's *"the music kind of
 * still shakes whenever I run"* (2026-09-24, 23:00), and the whole of it.
 *
 * The footsteps are the loudest transients in the game and at a run they arrive 3.67 times a
 * second, so in the mix's envelope the strongest rhythm stops being the music's 1.2 Hz beat and
 * becomes the step rate — a pulse at a few Hz laid over sustained notes, which is what shaking
 * sounds like. Measured on the plaza spine, untouched, the step rate stands **7.6 dB over the
 * music's beat** at a run.
 *
 * For two days this was a `DynamicsCompressorNode` on the bus. Four measurements retired it:
 *
 *   every step is in full four-to-one compression, standing, walking or running, on every surface
 *     (`-perstep`) — so it was never a limiter catching overshoot;
 *   its release does nothing — modelled from 60 ms to 1000 ms the step line moves 0.4 dB
 *     (`-release`), so it was a fixed pad with a wobble, and the wobble was inaudible;
 *   it charged 2.4 dB of the difference between a walk and a run for that (`-limiter`), squeezing
 *     out the one thing the player's own feet tell him about his own speed;
 *   and set the same task, a plain gain does it at the same step level with 2 dB of that
 *     difference handed back (`-pad`).
 *
 * So: a plain gain. How far the step rate stands over the music's beat, against the pad — priced
 * exactly rather than guessed, since the path is linear and the dry steps are rendered once, so
 * every candidate is arithmetic on takes already made (`art/audio/2026-09-26-pad/pad.py`):
 *
 *      pad      run       walk
 *     −0 dB   +7.6 dB   +1.8 dB
 *     −4 dB   +1.9 dB   −2.0 dB
 *     −6 dB   −1.2 dB   −2.1 dB
 *     −7 dB   −2.9 dB   −2.1 dB      <- here
 *     −8 dB   −4.5 dB   −2.1 dB
 *
 * A walk saturates at −2.1 dB: past a 6 dB pad its step rate is no longer the tallest thing near
 * 2.73 Hz and stops falling. 7 dB is the smallest whole decibel where a run reaches the margin a
 * walk already has, rather than a number chosen for how far it goes.
 *
 * What it costs is measured, not argued. A gain scales both gaits alike, so the gait difference is
 * whatever the designs make it — +3.83 dB, against +1.77 through the compressor. The one thing the
 * compressor did that a gain cannot is hold a pile-up, so the worst case was built on purpose and
 * recorded both ways: running and jumping under the lantern bough with the score playing peaks
 * **0.4 dB** higher without it, leaving 8.9 dB free where `level.test.mjs` asks for 6.
 */
export const SFX_PAD_DB = 7;

/** the sfx bus's output pad — one gain, no dynamics, nothing to undo */
export const SFX_TRIM = dB(-SFX_PAD_DB);

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
  /** the rock cut the south bridge crosses (see `GORGE_*` above and in footsteps.ts) */
  gorge: ConvolverNode;
  gorgeReturn: GainNode;
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
 * The ravine, as a space rather than as the wood turned up.
 *
 * `gorgeAt` has returned 1.00 across the whole bridge since the south expansion was cut, and the
 * BED uses it — `GORGE_HALL` and `GORGE_WIND` in ambience.ts, +2.7 dB across the bed. His boots
 * did not: `footsteps.drive` was handed `speed`, `surface`, `onStairs` and `enclosure` and nothing
 * else, so a player walking out over eight metres of open air with rock either side made the sound
 * he makes on a veranda. Measured, the steps stem at gorge 0 and gorge 1 differed by −105.7 dB,
 * which is the renderer's own last bit. Exactly the hole `2026-09-24-room` found for the huts, in
 * the one place in this world where a contact would obviously answer.
 *
 * Its numbers are the cut's own geometry rather than a preset. At mid-span the ravine is 5 m to
 * each wall and 8.8 m deep (`EXPANSION_SOUTH.ravine.line`), so at 343 m/s a wall answers
 * **29 ms** after the boot and the floor **51 ms**, and — the part that makes it a place and not a
 * reverb — *nothing comes back before 29 ms*. That is the pre-delay, and the early spread carries
 * the reflections out past the floor.
 *
 * It is brighter and shorter than the wood. Trunks scatter and leaves absorb the top, which is why
 * the hall is 1.5 s and rolled off at 3 kHz; rock absorbs almost nothing and returns the top, but a
 * cut that is open to the sky loses most of its energy upward, so the tail dies sooner than the
 * wood's even while it stays brighter. Short, bright and late is what tells a ravine from a room.
 *
 * (An earlier attempt at the gorge's colour opened the BED's own filter on the same reasoning and
 * measured +0.3 dB in 4–8 kHz — see `GORGE_HALL`. It failed because the bed has almost nothing up
 * there to return. A footstep does.)
 */
export const GORGE_SECONDS = 0.9;
/** the walls, 5 m off: 2 × 5 / 343 */
export const GORGE_EARLY_AT = 0.029;
/** out past the floor's 51 ms, so the first reflections span the wall and the floor */
export const GORGE_EARLY_SPREAD = 0.03;
/** rock returns the top the leaves take; air over a 10–20 m path takes a little of it back */
export const GORGE_TOP_HZ = 7000;
/** far less damped than the wood's 0.96 or the hut's 0.9 — this is stone, not foliage */
export const GORGE_DAMP = 0.45;
/**
 * The ravine's return, calibrated and not chosen — `ConvolverNode.normalize` rescales an impulse by
 * a rule that has nothing to do with the space, so the only way to know what a send of 1.0 produces
 * is to render and subtract (the same trap `ROOM_RETURN` documents).
 *
 * The target is physics. A boot's direct sound reaches the ear about 1.7 m away; a wall 5 m off
 * returns it over 10 m, which is 15.4 dB of spreading loss and almost nothing absorbed, and the
 * floor 8.8 m down returns it over 17.6 m. Summed, the first-order field is about **12.6 dB under
 * the direct**, and higher orders add little because the fourth wall is the sky.
 *
 * At 1.5 the ravine answers an isolated boot **12.8 dB under it**, which is that figure and not a
 * taste. For scale the hut's plank box sits at 10.9 dB under, and it should be the louder of the
 * two: six surfaces two metres off against two walls at five and a roof made of sky.
 */
export const GORGE_RETURN = 1.5;

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

/** master ← music (−12 dB under the ambience) / ambience / sfx (padded); a shared hall on a send. */
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
  // The footsteps' own level, and the whole of what keeps them from being the mix's rhythm — see
  // SFX_PAD_DB for the measurements, and for the DynamicsCompressorNode that used to be here and
  // could not show it was worth its cost. It is on the sfx bus, NOT the master: the music is never
  // touched, ducked or side-chained; only the thing that was punching through it comes down.
  const sfxTrim = ctx.createGain();
  sfxTrim.gain.value = SFX_TRIM;
  // `limiter: false` takes the pad out for an offline take, so what it is worth can be measured
  // rather than asserted: the bypassed stem is the steps as the designs make them, at the level
  // the designs ask for. (The flag is named for the compressor it used to bypass — three committed
  // evidence scripts pass it, and renaming it would cost their reports their reproducibility.)
  if (limiter) sfx.connect(sfxTrim).connect(master);
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
  const gorge = ctx.createConvolver();
  // the pre-delay is the wall's own 29 ms: in a cut this size nothing reaches the ear before it,
  // and a space that starts answering at sample 0 thickens the boot instead of reflecting it
  gorge.buffer = impulseResponse(ctx, rng.fork('gorgeir'), GORGE_SECONDS, GORGE_DAMP, GORGE_EARLY_AT, GORGE_EARLY_SPREAD, GORGE_EARLY_AT);
  const gorgeReturn = ctx.createGain();
  gorgeReturn.gain.value = GORGE_RETURN;
  // joins the master for the same reason the other two returns do: the ravine answering a step is
  // not itself the player's footstep, so the sfx bus's pad does not scale it twice
  const gorgeTop = filter(ctx, 'lowpass', GORGE_TOP_HZ, 0.6);
  gorge.connect(gorgeTop).connect(gorgeReturn);
  gorgeReturn.connect(master);
  return { master, music, ambience, sfx, reverb, reverbReturn, room, roomReturn, gorge, gorgeReturn };
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
