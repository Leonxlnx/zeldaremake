/**
 * Music slot (owner item 19). The owner asked for the actual Zelda music; that is Nintendo's
 * copyright and AGENTS.md allows original or CC0 only, so nothing of it ships. Instead:
 *
 *   1. if `public/audio/music.ogg` (or `.mp3`) exists it is decoded and looped — the owner drops
 *      any track in locally for a demo (see public/audio/README.md);
 *   2. otherwise an ORIGINAL placeholder plays: "Under the Boughs", a gentle 16-bar loop in
 *      G major pentatonic (G A B D E) at 76 bpm — a breathy woodwind lead over harp-like plucked
 *      arpeggios and a soft bass pad, through the shared convolution hall. The melody below was
 *      written for this file; it is not the Kokiri Forest theme, Saria's Song or any other
 *      Nintendo melody.
 *
 * Either way the bus sits 12 dB under the ambience (graph.ts).
 */
import { adsr, filter, gain, midiHz, noiseBuffer, noiseSource, type Rng } from './graph';

export type MusicSource = 'file' | 'procedural' | 'none';

export interface Music {
  /** resolves with what plays */
  ready: Promise<MusicSource>;
  /** schedule the procedural score up to context time t (no-op for a file) */
  scheduleUntil(t: number): void;
  dispose(): void;
}

export const MUSIC_FILES = ['audio/music.ogg', 'audio/music.mp3'];

/** the MUSIC_FILES present in public/ when Vite started (vite.config.ts); absent outside Vite */
declare const __ZR_MUSIC_FILES__: string[] | undefined;
const PRESENT_MUSIC_FILES: string[] = typeof __ZR_MUSIC_FILES__ !== 'undefined' ? __ZR_MUSIC_FILES__ : MUSIC_FILES;

// ---- the file slot's level ----------------------------------------------------------------------
/**
 * The gated RMS the music bus should be fed (dBFS), measured as the level the placeholder plays at.
 *
 * The placeholder is synthesised, so its level is whatever this file asks for, and every balance
 * the sound lane has measured was measured against it. A dropped-in track is not: it arrives
 * already mastered, and masters run −14 to −8 LUFS — thirty-odd decibels over a forest that sits
 * at −40. Nothing between the fetch and the bus looked at it, so whatever the track's mastering
 * engineer chose became this game's mix.
 *
 * Measured: an original track normalised to −10 LUFS dropped into this slot rendered at −22.7
 * LUFS against the bed's −40.4 — **17.7 dB over the wood**, where the placeholder sits 5.6 over —
 * and took the whole mix from −33.0 to −22.6 LUFS with the true peak up from −16.8 to −11.0 dBFS.
 * The forest was inaudible under it, and none of that was a decision anybody made.
 *
 * −24.9 is the placeholder's own bus level: its rendered stem measures −36.9 dBFS gated over the
 * blocks where it is sounding, and the bus is 12 dB down (graph.ts).
 */
export const MUSIC_BUS_TARGET_DB = -24.9;
/** how far the match may move a file either way (dB) — a rail against a silent or a clipped track */
export const MUSIC_MATCH_RANGE_DB: [number, number] = [-30, 12];

/** the decoded audio `gatedRmsDb` needs; an AudioBuffer satisfies it, and so does a test stub */
export interface PcmBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * How loud a decoded track is *while it is sounding*: mean power over 400 ms blocks, dropping every
 * block more than `down` dB under the 95th percentile so a quiet intro, a fade or the gap between
 * two movements does not pull the answer down. That gate is the part of BS.1770 that matters here;
 * leaving out the K-weighting costs a decibel or two on music, which is well inside what a gain
 * match needs and keeps this a single pass over the samples at load time.
 */
export function gatedRmsDb(buffer: PcmBuffer, block = 0.4, down = 20): number {
  const n = Math.max(1, Math.round(block * buffer.sampleRate));
  const frames = Math.floor(buffer.length / n);
  if (frames < 1) return -120;
  const data: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) data.push(buffer.getChannelData(c));
  const power = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * n; i < (f + 1) * n; i++) {
      let m = 0;
      for (const d of data) m += d[i];
      m /= data.length || 1;
      sum += m * m;
    }
    power[f] = sum / n;
  }
  const sorted = Float64Array.from(power).sort();
  const gate = sorted[Math.min(frames - 1, Math.floor(frames * 0.95))] * Math.pow(10, -down / 10);
  let kept = 0;
  let total = 0;
  for (const p of power) {
    if (p <= gate) continue;
    total += p;
    kept++;
  }
  if (!kept) return -120;
  return 10 * Math.log10(Math.max(total / kept, 1e-12));
}

/** the gain a decoded file plays at so it meets the level the placeholder was balanced at */
export function fileGain(rmsDb: number): number {
  const [lo, hi] = MUSIC_MATCH_RANGE_DB;
  return Math.pow(10, Math.max(lo, Math.min(hi, MUSIC_BUS_TARGET_DB - rmsDb)) / 20);
}

// ---- the score --------------------------------------------------------------------------------
const BPM = 76;
const BEAT = 60 / BPM;
const BARS = 16;
export const LOOP_SECONDS = BARS * 4 * BEAT;
/**
 * How long the placeholder rests between passes (seconds, seeded inside this range).
 *
 * 2026-09-23: the loop ran back to back for ever at one level, and after the wind bed became a
 * gust-gated swell the forest measured 15 dB under it — so between gusts the wood the owner is
 * walking around in could not be heard at all under a 50 s tune on repeat. A score that stops is
 * also how the demo's own forest sounds: the theme comes and goes over the wind and the birds.
 */
export const REST_SECONDS: [number, number] = [16, 30];
/** share of passes after the first that are voiced down to the lead and a thinner harp */
export const QUIET_PASS_SHARE = 0.45;

/** how long the wood is left to itself after a pass (s) */
export function restAfter(rnd: () => number): number {
  return REST_SECONDS[0] + rnd() * (REST_SECONDS[1] - REST_SECONDS[0]);
}

/** whether pass `index` drops the pad and half the harp; the first pass is always the full one */
export function passIsQuiet(index: number, rnd: () => number): boolean {
  return index > 0 && rnd() < QUIET_PASS_SHARE;
}

/** beats in one phrase — the score is four of them, A A' B A'' */
export const PHRASE_BEATS = 16;
/**
 * What each phrase is for, as a gain: the statement, the answer under it, the lift, the descent
 * home.
 *
 * 2026-09-24: measured, the placeholder breathed **6.4 dB** from one end of a fifty-second pass to
 * the other, and the whole mix breathed 6.3 — the tune's own span *was* the mix's, because the
 * forest under it (which breathes 26) never got through. Every note was at one velocity: the only
 * variation written into the piece was a ±1.4 dB sine wobble. A score with no shape is the thing
 * a wood cannot be heard under, whatever its level, and lowering it would only have made a flat
 * quiet tune out of a flat loud one.
 */
export const PHRASE_LEVEL = [0.82, 0.55, 1, 0.7];

/** the lead's and the harp's gain at `beat`: the phrase's level, swelling in and easing at the cadence */
export function phraseGain(beat: number): number {
  const p = Math.max(0, Math.min(PHRASE_LEVEL.length - 1, Math.floor(beat / PHRASE_BEATS)));
  const u = (beat - p * PHRASE_BEATS) / PHRASE_BEATS;
  // up over the first two fifths, then down past the peak so a phrase ends softer than it began
  const arch = u < 0.42 ? 0.7 + (0.3 * u) / 0.42 : 1 - (0.42 * (u - 0.42)) / 0.58;
  return PHRASE_LEVEL[p] * arch;
}

/**
 * How many of each phrase's sixteen beats carry a pad (0 = none).
 *
 * The pad used to start every two bars and run eight beats with a 1.1 s release, so every one
 * overlapped the next: a 73–110 Hz sine that **never once stopped** in a pass. Its always-on level
 * measured −42 dB in the 60–125 Hz band against the forest's −77 in the same band — 35 dB over the
 * wood, permanently. That is the same fault as the pod lanterns' 96 Hz hum this lane removed in the
 * morning, and it survived because it was inside the music rather than the bed.
 *
 * One pad per phrase now, stopping before the cadence, and none at all under the answer: the low
 * end goes quiet three times a pass and again through every rest.
 */
export const PHRASE_PAD_BEATS = [11, 0, 11, 7];

/** melody: [start beat, midi, beats] — 16 bars, phrases A A' B A'' */
const MELODY: [number, number, number][] = [
  // A
  [0, 74, 2], [2, 76, 1], [3, 74, 1],
  [4, 71, 1.5], [5.5, 69, 0.5], [6, 67, 2],
  [8, 69, 1], [9, 71, 1], [10, 74, 2],
  [12, 76, 3],
  // A'
  [16, 74, 2], [18, 71, 1], [19, 69, 1],
  [20, 67, 1.5], [21.5, 69, 0.5], [22, 71, 2],
  [24, 69, 1], [25, 67, 1], [26, 64, 2],
  [28, 62, 3],
  // B
  [32, 79, 1.5], [33.5, 76, 0.5], [34, 74, 2],
  [36, 76, 1], [37, 74, 1], [38, 71, 2],
  [40, 69, 0.5], [40.5, 71, 0.5], [41, 74, 1], [42, 76, 2],
  [44, 74, 4],
  // A''
  [48, 71, 1], [49, 74, 1], [50, 76, 1], [51, 79, 1],
  [52, 76, 2], [54, 74, 1], [55, 71, 1],
  [56, 69, 1.5], [57.5, 67, 0.5], [58, 69, 2],
  [60, 67, 3],
];

/** chord per bar (all tones inside the pentatonic): G = G B D, Em = E G B, Asus = A D E, Dsus = D E A */
const G = [55, 59, 62];
const Em = [52, 55, 59];
const Asus = [57, 62, 64];
const Dsus = [50, 52, 57];
const CHORDS = [G, G, Em, Em, Asus, Asus, Dsus, Dsus, G, G, Em, Em, Asus, Dsus, G, G];
/** harp pattern per bar: chord tone index (0..2) and octave lift, on 8th notes */
const HARP: [number, number][] = [
  [0, 0], [2, 0], [1, 1], [2, 1],
  [0, 1], [2, 1], [1, 1], [2, 0],
];

export function createMusic(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0, tryFiles = true): Music {
  // long-lived sources only (per-note oscillators stop themselves)
  const nodes: AudioScheduledSourceNode[] = [];
  let source: MusicSource = 'none';
  let procedural: ((t: number) => void) | null = null;

  // ---- procedural voices -------------------------------------------------------------------
  const setupProcedural = () => {
    // 2026-09-24: the −3.2 dB trim that came in with the rests is REVERTED. Its purpose was to let
    // the forest be heard beside the tune, and the rests already do that far better — between
    // passes there is no tune at all. What the trim actually bought was the owner's job 8 getting
    // worse: with the music 3.2 dB down, the footsteps punched further over it, and running, the
    // mix's dominant rhythm stayed the step rate even with the step compressor in. Level belongs to
    // the music; space belongs to the rests.
    const bus = gain(ctx, 0.9);
    bus.connect(out);
    const send = gain(ctx, 0.55);
    bus.connect(send).connect(reverbSend);
    const breath = noiseBuffer(ctx, rng.fork('breath'), 2);
    const breathSrc = noiseSource(ctx, breath, startAt);
    nodes.push(breathSrc);
    const breathBp = filter(ctx, 'bandpass', 2600, 1.4);
    breathSrc.connect(breathBp);

    const woodwind = (t: number, midi: number, dur: number, vel: number) => {
      const f = midiHz(midi);
      const env = gain(ctx, 0);
      const lp = filter(ctx, 'lowpass', 1500 + f * 0.6, 0.9);
      env.connect(lp).connect(bus);
      // one vibrato whose depth (cents) grows in after the attack, shared by the partials
      const vibOsc = ctx.createOscillator();
      vibOsc.frequency.value = 5.1;
      const vibDepth = gain(ctx, 0);
      vibDepth.gain.setValueAtTime(0, t);
      vibDepth.gain.linearRampToValueAtTime(7, t + Math.min(0.6, dur * 0.5));
      vibOsc.connect(vibDepth);
      vibOsc.start(t);
      vibOsc.stop(t + dur + 0.6);
      for (const [type, mult, det, g] of [
        ['triangle', 1, 0, 0.55],
        ['sine', 1, 4, 0.5],
        ['sine', 2, -3, 0.12],
      ] as [OscillatorType, number, number, number][]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        o.detune.value = det;
        vibDepth.connect(o.detune);
        const og = gain(ctx, g);
        o.connect(og).connect(env);
        o.start(t);
        o.stop(t + dur + 0.6);
      }
      // the breath: a puff of filtered noise at the onset
      const bg = gain(ctx, 0);
      breathBp.connect(bg).connect(lp);
      bg.gain.setValueAtTime(0.0005, t);
      bg.gain.linearRampToValueAtTime(0.025 * vel, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.003 * vel, t + 0.35);
      bg.gain.setValueAtTime(0.003 * vel, t + dur);
      bg.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.2);
      // close it: the breath noise source is shared, so a gate left on the ramp's floor is a tap
      // of it left open for the rest of the session (see graph.ts adEnvelope)
      bg.gain.setValueAtTime(0, t + dur + 0.2);
      adsr(env.gain, t, dur, 0.22 * vel, 0.09, 0.25, 0.75, 0.35);
    };

    const pluck = (t: number, midi: number, vel: number, pan: number) => {
      const f = midiHz(midi);
      const env = gain(ctx, 0);
      const lp = filter(ctx, 'lowpass', 2400, 0.7);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      env.connect(lp).connect(panner).connect(bus);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2.01;
      const g2 = gain(ctx, 0.25);
      o.connect(env);
      o2.connect(g2).connect(env);
      const decay = 0.9 + 120 / f;
      env.gain.setValueAtTime(0.0005, t);
      env.gain.linearRampToValueAtTime(0.16 * vel, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      lp.frequency.setValueAtTime(3800, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + decay * 0.6);
      o.start(t);
      o2.start(t);
      o.stop(t + decay + 0.05);
      o2.stop(t + decay + 0.05);
    };

    const pad = (t: number, midi: number, dur: number) => {
      const env = gain(ctx, 0);
      const lp = filter(ctx, 'lowpass', 420, 0.6);
      env.connect(lp).connect(bus);
      for (const [mult, g] of [
        [1, 0.5],
        [2, 0.18],
      ]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = midiHz(midi) * mult;
        const og = gain(ctx, g);
        o.connect(og).connect(env);
        o.start(t);
        o.stop(t + dur + 1.2);
      }
      adsr(env.gain, t, dur, 0.2, 0.9, 0.5, 0.8, 1.1);
    };

    let loopStart = startAt + 0.3;
    let scheduledLoops = 0;
    const harpRng = rng.fork('harp');
    const leadRng = rng.fork('lead');
    const restRng = rng.fork('rest');
    return (t: number) => {
      while (loopStart < t) {
        // every other pass or so is voiced down to the lead and a thinner harp: a 50 s loop played
        // back to back at one volume is the most tiring thing in a world you walk around in
        const quiet = passIsQuiet(scheduledLoops, restRng);
        const lead = quiet ? 0.62 : 1;
        // the player is meant to hear a phrase arrive and a phrase end, so the level follows the
        // writing (phraseGain) and the note-to-note variation is a small seeded jitter — the old
        // sine over the beat was a rate the ear locks onto, which is what a wobble is
        for (const [beat, midi, beats] of MELODY) woodwind(loopStart + beat * BEAT, midi, beats * BEAT * 0.94, lead * phraseGain(beat) * (0.93 + 0.14 * leadRng()));
        for (let bar = 0; bar < BARS; bar++) {
          const chord = CHORDS[bar];
          const t0 = loopStart + bar * 4 * BEAT;
          const phrase = Math.floor((bar * 4) / PHRASE_BEATS);
          for (let i = 0; i < HARP.length; i++) {
            const [idx, lift] = HARP[i];
            const beat = bar * 4 + i * 0.5;
            // the last bar is the lead's alone, so the piece finishes rather than stopping; under
            // the answer the harp keeps time on two beats instead of running eighths; and it rests
            // on a few eighths elsewhere so it breathes. A quiet pass rests on every other one.
            if (bar === BARS - 1) continue;
            if (phrase === 1 && i !== 0 && i !== 4) continue;
            if ((bar % 4 === 3 && i >= 6) || (i === 5 && bar % 2 === 1) || (quiet && i % 2 === 1)) continue;
            const vel = (quiet ? 0.6 : 1) * phraseGain(beat) * (0.55 + 0.35 * (i % 2 === 0 ? 1 : 0.5) + (harpRng() - 0.5) * 0.15);
            pluck(t0 + i * BEAT * 0.5, chord[idx] + 12 * (lift + 1), vel, (i / (HARP.length - 1) - 0.5) * 0.7);
          }
        }
        if (!quiet) {
          for (let phrase = 0; phrase < PHRASE_PAD_BEATS.length; phrase++) {
            const beats = PHRASE_PAD_BEATS[phrase];
            if (!beats) continue;
            const bar = (phrase * PHRASE_BEATS) / 4;
            pad(loopStart + phrase * PHRASE_BEATS * BEAT, CHORDS[bar][0] - 12, beats * BEAT);
          }
        }
        // and then it stops and lets the wood be heard. The pad and the last note ring out into
        // the rest, so the piece ends rather than being cut off.
        loopStart += LOOP_SECONDS + restAfter(restRng);
        scheduledLoops++;
      }
    };
  };

  // ---- the file slot -------------------------------------------------------------------------
  const loadFile = async (): Promise<AudioBuffer | null> => {
    if (!tryFiles || typeof fetch !== 'function') return null;
    for (const rel of PRESENT_MUSIC_FILES) {
      try {
        const url = new URL(rel, document.baseURI).href;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const type = res.headers.get('content-type') ?? '';
        if (/text\/html/i.test(type)) continue;
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength < 1024) continue;
        return await ctx.decodeAudioData(bytes.slice(0));
      } catch {
        /* next candidate */
      }
    }
    return null;
  };

  const ready = loadFile().then((buffer) => {
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      // the owner's own track arrives mastered; meet the placeholder's level rather than its own
      const rms = gatedRmsDb(buffer);
      const g = gain(ctx, fileGain(rms));
      src.connect(g).connect(out);
      src.start(Math.max(startAt, ctx.currentTime + 0.05));
      nodes.push(src);
      source = 'file';
      console.info(`[audio] music: file (${buffer.duration.toFixed(1)} s loop, ${rms.toFixed(1)} dBFS gated, ${(20 * Math.log10(fileGain(rms))).toFixed(1)} dB to meet the placeholder)`);
    } else {
      procedural = setupProcedural();
      source = 'procedural';
      console.info(`[audio] music: original placeholder "Under the Boughs" (${LOOP_SECONDS.toFixed(1)} s loop)`);
    }
    return source;
  });

  return {
    ready,
    scheduleUntil(t) {
      procedural?.(t);
    },
    dispose() {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
    },
  };
}
