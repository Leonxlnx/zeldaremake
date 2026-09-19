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

// ---- the score --------------------------------------------------------------------------------
const BPM = 76;
const BEAT = 60 / BPM;
const BARS = 16;
export const LOOP_SECONDS = BARS * 4 * BEAT;

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
      bg.gain.linearRampToValueAtTime(0.05 * vel, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.008 * vel, t + 0.35);
      bg.gain.setValueAtTime(0.008 * vel, t + dur);
      bg.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.2);
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
    return (t: number) => {
      while (loopStart < t) {
        for (const [beat, midi, beats] of MELODY) woodwind(loopStart + beat * BEAT, midi, beats * BEAT * 0.94, 0.85 + 0.15 * Math.sin(beat * 0.7 + scheduledLoops));
        for (let bar = 0; bar < BARS; bar++) {
          const chord = CHORDS[bar];
          const t0 = loopStart + bar * 4 * BEAT;
          for (let i = 0; i < HARP.length; i++) {
            const [idx, lift] = HARP[i];
            // rest the harp on a few 8ths so it breathes
            if ((bar % 4 === 3 && i >= 6) || (i === 5 && bar % 2 === 1)) continue;
            const vel = 0.55 + 0.35 * (i % 2 === 0 ? 1 : 0.5) + (harpRng() - 0.5) * 0.15;
            pluck(t0 + i * BEAT * 0.5, chord[idx] + 12 * (lift + 1), vel, (i / (HARP.length - 1) - 0.5) * 0.7);
          }
          if (bar % 2 === 0) pad(t0, chord[0] - 12, 8 * BEAT);
        }
        loopStart += LOOP_SECONDS;
        scheduledLoops++;
      }
    };
  };

  // ---- the file slot -------------------------------------------------------------------------
  const loadFile = async (): Promise<AudioBuffer | null> => {
    if (!tryFiles || typeof fetch !== 'function') return null;
    for (const rel of MUSIC_FILES) {
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
      const g = gain(ctx, 1);
      src.connect(g).connect(out);
      src.start(Math.max(startAt, ctx.currentTime + 0.05));
      nodes.push(src);
      source = 'file';
      console.info(`[audio] music: file (${buffer.duration.toFixed(1)} s loop)`);
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
