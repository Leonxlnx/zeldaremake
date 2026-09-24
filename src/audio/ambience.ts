/**
 * Forest ambience bed (owner item 19).
 *
 * 2026-09-23 (owner, 06:50: "the background sound is too buzzy"). The bed this replaces was three
 * continuous layers of WHITE noise — a low-pass at 260 Hz, a broad 420 Hz band and a 1.4–3.8 kHz
 * hush — plus a 96 / 192 Hz two-sine lantern hum whose per-pod attenuations were SUMMED, so in a
 * village with a pod on every house, post and bough the sum saturated and the hum sat at the top of
 * the mix all the time. Measured on the offline bed (`art/audio/2026-09-23-lane5/`), 60–125 Hz was
 * the loudest band in the whole forest and the bed's quietest tenth was only 10 dB under its
 * average: a constant tone under a constant hiss. That is a drone, and it is what "buzzy" means.
 *
 * What is here now:
 *   - PINK noise (graph.ts), not white: wind in leaves falls about −3 dB/octave, so a white bed put
 *     through one filter is always too bright above the corner and too flat below it.
 *   - two wind layers, not one: a far canopy roll (60–620 Hz, mostly into the hall) and a near leaf
 *     hush (0.9–4.2 kHz) whose level lives in the gust — calm air is nearly silent, the hush comes
 *     with the gust and leaves with it.
 *   - no sine LFO anywhere in the bed. Every continuous level rides a seeded irregular envelope
 *     (`controlNoiseBuffer`), so nothing beats at a rate the ear can lock onto.
 *   - discrete LEAF FLUTTERS scheduled like the birds — short shaped grains, in clusters during a
 *     gust — so the top of the bed reads as individual leaves rather than a band of noise.
 *   - birds mostly FAR (the owner asked for birds at a distance): each call is filtered and sent to
 *     the hall by its distance, the gaps between calls are long, and two quiet distant voices join
 *     the four near ones (a dove's coo, a woodpecker's drum).
 *   - the pod lanterns are a FLAME, not a hum: low-passed pink noise fluttering irregularly with
 *     one soft husk resonance under it, at the NEAREST pod's distance (the rest only add a fifth
 *     each), so walking through the village no longer walks through a tone.
 *   - the ruins' WATERFALL: the one continuous noise the forest is allowed, and only near it — a
 *     roar placed at the nearest plunge that is silent from `FALL_AUDIBLE_M` on.
 */
import { adEnvelope, cleanupAt, controlNoiseBuffer, controlSource, filter, gain, pinkNoiseBuffer, type Rng } from './graph';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AmbienceState {
  /** 0..1 world gust (wind.uniforms.uGust) */
  gust: number;
  /** listener (Link's sole or the camera) */
  listener: Vec3;
  /** listener's horizontal forward (unit xz) for panning */
  forward: { x: number; z: number };
  /** pod lantern positions (world) */
  pods: readonly Vec3[];
  /** fairy positions (world) — they move, so this is read fresh every frame */
  fairies?: readonly Vec3[];
  /** 0 out in the open, 1 with wood closed over the listener (inside the log tunnel's bore) */
  enclosure?: number;
  /** 0 under open sky, 1 under a closed canopy (index.ts `surfaceAt`) */
  canopy?: number;
  /** the direction the wind travels (unit xz, `wind.direction`) — the canopy roll comes from upwind */
  windDir?: { x: number; z: number };
  /** 0 well back from the ravine, 1 out over it (index.ts `gorgeAt`) */
  gorge?: number;
  /** waterfall plunge points (world; index.ts gathers the `waterfall-plunge` markers) */
  falls?: readonly Vec3[];
}

export interface Ambience {
  /** schedule every bird call and leaf flutter up to time t (context seconds) */
  scheduleUntil(t: number): void;
  /** set the continuous parameters as of context time t */
  update(t: number, state: AmbienceState): void;
  /** what the forest has done so far, for the play-mode evidence (`__ZR_AUDIO__.stats()`) */
  stats(): AmbienceStats;
  dispose(): void;
}

export interface AmbienceStats {
  /** bird calls, leaf flutters and fairy glints sounded since the context started */
  birds: number;
  flutters: number;
  glints: number;
  /** fairies the listener can currently hear */
  fairiesNear: number;
  /** where the canopy roll is sitting: −1 hard left, +1 hard right (the wind's lean) */
  windLean: number;
  /** the nearest waterfall's attenuation at the listener: 1 at its plunge, 0 out of earshot */
  fall: number;
}

/** the lantern flame's distance scale (m: half level this far from one pod) and its peak level */
export const LANTERN_REACH_M = 1.3;
export const LANTERN_LEVEL = 0.055;
/** share of a non-nearest pod's attenuation that is added — a village of pods must not sum to a drone */
export const LANTERN_CROWD_SHARE = 0.2;

/**
 * The wind bed's levels.
 *
 * 2026-09-23, owner 20:08: "LOWER THE WHITE NOISE" — after the bed had already been cut 11 dB that
 * morning. Cutting it again was the wrong lever: measured on the head's offline stems, the quietest
 * tenth of every frame of the WHOLE MIX was the bed and nothing else (1–2 kHz: bed −73.3 dBFS,
 * music −93.6; 2–6 kHz: bed −81.1, music −96.3). The music is louder but it has gaps; the bed never
 * stopped, and a sound that never stops is the one a listener ends up calling white noise however
 * quiet it is.
 *
 * So the bed is now a SWELL, not a floor. Below `GUST_KNEE` the wind layers are silent — not faint,
 * silent — and what is left of the forest between gusts is its events: leaves, birds, boots. Above
 * the knee the swell is louder than the old constant bed was, so a gust is actually wind.
 */
export const GUST_KNEE = 0.22;
export const CANOPY_FLOOR = 0.0003;
export const CANOPY_GUST = 0.055;
export const HUSH_FLOOR = 0.00008;
export const HUSH_GUST = 0.02;
/** 0 below the knee, 1 at a full gust — every continuous layer's level and modulation rides this */
export function swell(gust: number): number {
  return Math.max(0, (Math.min(1, gust) - GUST_KNEE) / (1 - GUST_KNEE));
}
/** the leaf flutters' level range (before the gust scale) and their share into the hall */
const FLUTTER_LEVEL: [number, number] = [0.004, 0.013];
const FLUTTER_SEND = 0.25;
/** the longest the wood is ever left with nothing at all in it (s) */
export const QUIET_GAP_MAX = 2.2;
/**
 * A fairy's glint: how close you have to be for half level, its peak, and the gap between glints.
 * Events only, and small ones — the owner's standing complaint is that there is too much sound, so
 * a fairy is a few grains of light every couple of seconds, never a shimmer laid over the forest.
 */
export const FAIRY_REACH_M = 2.5;
export const FAIRY_LEVEL = 0.014;
export const FAIRY_GAP: [number, number] = [1.4, 4];
/** past this she is not heard at all (the inverse-square reach alone runs on to eleven metres) */
export const FAIRY_AUDIBLE_M = FAIRY_REACH_M * Math.sqrt(1 / 0.25 - 1);
/**
 * A waterfall (the ruins' fall, 2026-09-24). A fall is noise by nature and the owner's standing
 * complaint is noise that never stops, so it is kept to where it is: half level `FALL_REACH_M` from
 * the plunge, faded to exactly nothing by `FALL_AUDIBLE_M` — the trail hears it come up over the
 * outcrop, the village never does. The air takes the spray's hiss first (the far roar is low) and
 * the further off it is the more of it arrives through the hall.
 */
export const FALL_REACH_M = 7;
export const FALL_LEVEL = 0.06;
export const FALL_AUDIBLE_M = 42;
const FALL_NEAR_HZ = 9000;
const FALL_FAR_HZ = 650;
/** the fall's attenuation `d` m from its plunge: 1 at it, inverse-square, 0 from FALL_AUDIBLE_M on */
export function fallAttenuation(d: number): number {
  const t = Math.max(0, Math.min(1, (d - FALL_AUDIBLE_M * 0.7) / (FALL_AUDIBLE_M * 0.3)));
  return (1 - t * t * (3 - 2 * t)) / (1 + (d / FALL_REACH_M) ** 2);
}
/** the bed's top in the open, and with the log tunnel's wood closed over the listener */
const ENCLOSURE_OPEN_HZ = 18000;
const ENCLOSURE_CLOSED_HZ = 900;
/** how much of the forest is left when he is right inside the bore */
const ENCLOSURE_DUCK = 0.45;
/**
 * How far a closed canopy shuts the same filter (a share of the tunnel's travel, so a roof of
 * leaves is a hint of the tunnel's wood, not the same thing): at 1 the bed's top sits near 4 kHz.
 * Under the crowns the air is also more reverberant and the leaves overhead move more often — in
 * the open plaza you hear the sky, in the north corridor you hear the wood close above you.
 */
const CANOPY_CLOSE = 0.5;
const CANOPY_HALL = 0.8;
const CANOPY_FLUTTER = 0.7;
/**
 * The ravine. Every other space term CLOSES the bed — the tunnel's bore, the crowns overhead. A
 * gorge is the other direction: eight metres of open air with rock either side, so more of the
 * forest comes back as reflection (`GORGE_HALL`) and the wind funnels along it (`GORGE_WIND`) —
 * measured at +2.7 dB across the bed crossing the bridge, where 1.4 / 0.35 gave only +1.2 and the
 * crossing did not read as anywhere in particular.
 *
 * There was a third term here, opening the bed's filter past its usual sky on the grounds that rock
 * returns the high end leaves absorb. It is gone: measured, it moved 4–8 kHz by +0.3 dB and
 * 8–16 kHz by −0.1, because this bed has almost nothing up there to return.
 */
const GORGE_HALL = 2.0;
const GORGE_WIND = 0.7;
/**
 * How far the canopy roll leans toward upwind. Wind in a wood is not a point source, so this is a
 * lean and not a pan: turn to face into it and the weight of the air moves across you, but the bed
 * never collapses to one side. Only the far roll leans — the leaf hush is in the trees all around.
 */
export const WIND_LEAN = 0.35;

/**
 * Where the canopy roll sits for a listener facing `forward` while the wind travels along `dir`
 * (both unit xz): −1 hard left … +1 hard right. The air arrives from where the wind comes FROM, so
 * the source is upwind — behind its direction of travel — projected onto the listener's right.
 */
export function windLeanFor(forward: { x: number; z: number }, dir: { x: number; z: number }): number {
  const rx = -forward.z;
  const rz = forward.x;
  const len = Math.hypot(dir.x, dir.z) || 1;
  return Math.max(-1, Math.min(1, ((-dir.x * rx - dir.z * rz) / len) * WIND_LEAN));
}

type BirdKind = 'whistle' | 'trill' | 'chirps' | 'warble' | 'coo' | 'knock';
/** how often each call is chosen, and how far away it tends to be (0 = overhead, 1 = deep in the wood) */
const BIRDS: { kind: BirdKind; weight: number; near: number; far: number }[] = [
  { kind: 'whistle', weight: 3, near: 0.35, far: 0.95 },
  { kind: 'trill', weight: 2, near: 0.45, far: 1 },
  { kind: 'chirps', weight: 3, near: 0.25, far: 0.85 },
  { kind: 'warble', weight: 2, near: 0.4, far: 0.95 },
  { kind: 'coo', weight: 2, near: 0.6, far: 1 },
  { kind: 'knock', weight: 1, near: 0.7, far: 1 },
];
const BIRD_WEIGHT = BIRDS.reduce((s, b) => s + b.weight, 0);

export function createAmbience(ctx: BaseAudioContext, outBus: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Ambience {
  // Everything the forest makes goes through here before the bus: inside the log tunnel the wood
  // closes over the listener, so the wind, the leaves and the birds arrive muffled and quieter.
  // Walking through the arch used to change nothing at all except what was under the boots.
  const enclosureLp = filter(ctx, 'lowpass', ENCLOSURE_OPEN_HZ, 0.7);
  const out = gain(ctx, 1);
  out.connect(enclosureLp).connect(outBus);
  const pink = pinkNoiseBuffer(ctx, rng.fork('pink'), 9);
  const nodes: AudioScheduledSourceNode[] = [];
  /** one always-running pink source every layer taps (a per-layer source would cost a buffer each) */
  const bedSrc = ctx.createBufferSource();
  bedSrc.buffer = pink;
  bedSrc.loop = true;
  bedSrc.start(startAt);
  nodes.push(bedSrc);
  // a second tap started a third of the loop later, so the two wind layers are not the same noise
  const leafSrc = ctx.createBufferSource();
  leafSrc.buffer = pink;
  leafSrc.loop = true;
  leafSrc.start(startAt, pink.duration / 3);
  nodes.push(leafSrc);

  const wander = (hz: number, shape: number, seed: string) => controlNoiseBuffer(ctx, rng.fork(seed), { hz, shape, seconds: 47 });
  /** an irregular envelope added to a param's own value (its automation stays the floor) */
  const rides = (target: AudioParam, hz: number, shape: number, depth: number, seed: string, rate = 120) => {
    const cs = controlSource(ctx, wander(hz, shape, seed), depth, rate, startAt);
    cs.out.connect(target);
    nodes.push(cs.src);
  };
  /** the same envelope through a gate node, so something else (the gust) can scale the modulation */
  const ridesGated = (gate: AudioNode, hz: number, shape: number, depth: number, seed: string) => {
    const cs = controlSource(ctx, wander(hz, shape, seed), depth, 120, startAt);
    cs.out.connect(gate);
    nodes.push(cs.src);
  };

  // ---- far canopy: the wood breathing, mostly into the hall -----------------------------------
  const canopyHp = filter(ctx, 'highpass', 62, 0.6);
  const canopyLp = filter(ctx, 'lowpass', 620, 0.5);
  const canopyTilt = filter(ctx, 'lowshelf', 140, 0.7, -5);
  const canopyGain = gain(ctx, CANOPY_FLOOR);
  const canopyPan = ctx.createStereoPanner();
  bedSrc.connect(canopyHp).connect(canopyLp).connect(canopyTilt).connect(canopyGain).connect(canopyPan).connect(out);
  const canopySend = gain(ctx, 0.3);
  canopyGain.connect(canopySend).connect(reverbSend);
  // the irregular wander is GATED by the swell. Ungated it was its own always-on floor — up to
  // 0.03 of gain whatever the wind was doing, as much again as the gust term itself.
  const canopyMod = gain(ctx, 0);
  canopyMod.connect(canopyGain.gain);
  ridesGated(canopyMod, 0.055, 1.4, 0.03, 'canopy-slow');
  // the canopy's colour moves with a slower wander of its own: a gust opens the top of the roll
  rides(canopyLp.frequency, 0.08, 1, 280, 'canopy-colour');

  // ---- near leaf hush: lives in the gust, silent in still air ----------------------------------
  const hushHp = filter(ctx, 'highpass', 900, 0.5);
  const hushLp = filter(ctx, 'lowpass', 2600, 0.5);
  const hushGain = gain(ctx, HUSH_FLOOR);
  // the wander is gated by the gust, so the hush both swells and flickers only while the air moves
  const hushMod = gain(ctx, 0);
  hushMod.connect(hushGain.gain);
  leafSrc.connect(hushHp).connect(hushLp).connect(hushGain).connect(out);
  const hushSend = gain(ctx, 0.2);
  hushGain.connect(hushSend).connect(reverbSend);
  ridesGated(hushMod, 0.42, 1.6, 0.008, 'hush');

  // ---- pod lantern flame ----------------------------------------------------------------------
  const flameGain = gain(ctx, 0);
  const flamePan = ctx.createStereoPanner();
  flameGain.connect(flamePan).connect(out);
  const flameSend = gain(ctx, 0.45);
  flameGain.connect(flameSend).connect(reverbSend);
  const flameSrc = ctx.createBufferSource();
  flameSrc.buffer = pink;
  flameSrc.loop = true;
  flameSrc.start(startAt, pink.duration * 0.66);
  nodes.push(flameSrc);
  const flameLp = filter(ctx, 'lowpass', 320, 0.8);
  const flameBody = gain(ctx, 0.35);
  flameSrc.connect(flameLp).connect(flameBody).connect(flameGain);
  // the flutter: an irregular envelope at a few Hz, the breath of a flame inside the husk
  rides(flameBody.gain, 2.6, 1.3, 0.9, 'flame', 240);
  // the husk's own resonance gives a lit pod a pitch — a narrow band of the SAME noise, not an
  // oscillator: the hum this replaced was two sines, and a sine is the drone the owner heard
  const husk = filter(ctx, 'bandpass', 132, 5);
  const huskGain = gain(ctx, 0.55);
  flameSrc.connect(husk).connect(huskGain).connect(flameGain);
  rides(husk.frequency, 0.35, 1, 14, 'husk');

  // ---- waterfall: the plunge's roar and the sheet's wash, placed and coloured by distance -------
  const fallSrc = ctx.createBufferSource();
  fallSrc.buffer = pink;
  fallSrc.loop = true;
  fallSrc.start(startAt, pink.duration * 0.5);
  nodes.push(fallSrc);
  const fallGain = gain(ctx, 0);
  const fallAir = filter(ctx, 'lowpass', FALL_NEAR_HZ, 0.6);
  const fallPan = ctx.createStereoPanner();
  fallGain.connect(fallAir).connect(fallPan).connect(out);
  const fallSend = gain(ctx, 0.25);
  fallAir.connect(fallSend).connect(reverbSend);
  const roarHp = filter(ctx, 'highpass', 48, 0.6);
  const roarLp = filter(ctx, 'lowpass', 420, 0.5);
  const roar = gain(ctx, 1);
  fallSrc.connect(roarHp).connect(roarLp).connect(roar).connect(fallGain);
  const washHp = filter(ctx, 'highpass', 700, 0.5);
  const washLp = filter(ctx, 'lowpass', 3600, 0.5);
  const wash = gain(ctx, 0.45);
  fallSrc.connect(washHp).connect(washLp).connect(wash).connect(fallGain);
  // falling water never holds still: slow irregular surges in its weight, a faster churn in the wash
  rides(roar.gain, 0.22, 1.3, 0.22, 'fall-surge');
  rides(wash.gain, 0.9, 1.2, 0.12, 'fall-churn');
  rides(washLp.frequency, 0.6, 1, 700, 'fall-colour');

  // ---- scheduled events: leaf flutters and birds ------------------------------------------------
  const eventRng = rng.fork('events');
  const counts: AmbienceStats = { birds: 0, flutters: 0, glints: 0, fairiesNear: 0, windLean: 0, fall: 0 };
  /** the gust as `update` last saw it: the schedulers run ahead of the clock, so they use it as a level */
  let gustNow = 0.4;
  /** how closed the canopy was over the listener, likewise (leaves overhead move more often) */
  let canopyNow = 0;

  /**
   * One leaf flutter: a short shaped grain of the bed's own pink noise. Several of these in a
   * cluster read as a branch shaking; a continuous band of the same noise reads as hiss.
   */
  const flutter = (t: number, centre: number, level: number, pan: number, decay: number) => {
    counts.flutters++;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    const send = gain(ctx, FLUTTER_SEND);
    panner.connect(send).connect(reverbSend);
    const bp = filter(ctx, 'bandpass', centre, 1.1);
    const lp = filter(ctx, 'lowpass', centre * 2.6, 0.7);
    const g = gain(ctx, 0);
    leafSrc.connect(bp);
    bp.connect(lp).connect(g).connect(panner);
    adEnvelope(g.gain, t, level, 0.018 + eventRng() * 0.03, decay);
    cleanupAt(ctx, t + decay + 0.4, () => {
      try {
        leafSrc.disconnect(bp);
      } catch {
        /* already gone */
      }
      for (const n of [bp, lp, g, send, panner]) n.disconnect();
    });
  };

  let nextFlutter = startAt + 0.8 + eventRng() * 2;
  const scheduleFlutters = (until: number) => {
    while (nextFlutter < until) {
      const t = nextFlutter;
      const g = gustNow;
      const n = 1 + Math.floor(eventRng() * (1 + g * 2));
      const pan = (eventRng() * 2 - 1) * 0.9;
      for (let i = 0; i < n; i++) {
        const centre = 950 + eventRng() * 1900;
        const level = (FLUTTER_LEVEL[0] + eventRng() * (FLUTTER_LEVEL[1] - FLUTTER_LEVEL[0])) * (0.35 + g * 0.9);
        flutter(t + i * (0.04 + eventRng() * 0.16), centre, level, pan + (eventRng() - 0.5) * 0.3, 0.07 + eventRng() * 0.16);
      }
      // gusts crowd the flutters together; still air leaves long gaps — but never longer than
      // QUIET_GAP_MAX. With the bed gated below the gust knee and the tune resting between passes,
      // the wood could otherwise fall to nothing for five seconds at a time, which reads as the
      // sound having broken rather than as a quiet forest. A leaf turning over is the answer to
      // that, not a floor put back under everything.
      nextFlutter += Math.min(QUIET_GAP_MAX, (0.5 + eventRng() * 3.2) / ((0.3 + g * 1.1) * (1 + canopyNow * CANOPY_FLUTTER)));
    }
  };

  /**
   * A bird heard from `distance` (0 = overhead, 1 = deep in the wood): the air takes its top off,
   * the level falls and more of it arrives through the hall. Every call is built on this.
   */
  const birdVoice = (t: number, pan: number, distance: number, end: number) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const hp = filter(ctx, 'highpass', 320, 0.5);
    const lp = filter(ctx, 'lowpass', 7000 - 5200 * distance, 0.6);
    const g = gain(ctx, 0);
    g.connect(hp);
    hp.connect(lp).connect(panner).connect(out);
    const send = gain(ctx, 0.2 + 0.55 * distance);
    panner.connect(send).connect(reverbSend);
    cleanupAt(ctx, end + 0.5, () => {
      for (const n of [g, hp, lp, panner, send]) n.disconnect();
    });
    // `voice` is the enveloped input for the oscillator; `air` is the same distance and space
    // without it, for a call built out of noise (the woodpecker's taps)
    return { voice: g, air: hp as AudioNode };
  };

  const birdCall = (kind: BirdKind, t: number, pan: number, level: number, distance: number) => {
    counts.birds++;
    // distance takes the level down; a far call is also slower to start (the air rounds its attack)
    const lv = level * (1 - 0.66 * distance);
    const soft = 1 + distance * 1.6;
    let end = t + 1.6;
    const { voice: g, air } = birdVoice(t, pan, distance, t + 2.6);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.connect(g);
    switch (kind) {
      case 'whistle': {
        const notes = 2 + Math.floor(eventRng() * 2);
        for (let i = 0; i < notes; i++) {
          const s = t + i * (0.3 + eventRng() * 0.12);
          const f0 = (2750 + eventRng() * 500) * Math.pow(0.9, i);
          osc.frequency.setValueAtTime(f0, s);
          osc.frequency.exponentialRampToValueAtTime(f0 * 0.8, s + 0.22);
          adEnvelope(g.gain, s, lv, 0.018 * soft, 0.2);
          end = s + 0.26;
        }
        break;
      }
      case 'trill': {
        const n = 6 + Math.floor(eventRng() * 5);
        const f = 3000 + eventRng() * 500;
        osc.frequency.setValueAtTime(f, t);
        const mod = ctx.createOscillator();
        mod.frequency.value = 24 + eventRng() * 8;
        const md = gain(ctx, 170);
        mod.connect(md).connect(osc.frequency);
        mod.start(t);
        mod.stop(t + n * 0.058 + 0.15);
        // the notes share one gain, so a note's envelope has to finish inside the 58 ms spacing
        for (let i = 0; i < n; i++) adEnvelope(g.gain, t + i * 0.058, lv * (0.6 + 0.4 * Math.sin(i * 1.7)), 0.006 * soft, 0.036);
        end = t + n * 0.058 + 0.12;
        break;
      }
      case 'chirps': {
        const n = 2 + Math.floor(eventRng() * 3);
        for (let i = 0; i < n; i++) {
          const s = t + i * (0.15 + eventRng() * 0.09);
          osc.frequency.setValueAtTime(1800 + eventRng() * 300, s);
          osc.frequency.exponentialRampToValueAtTime(3100 + eventRng() * 500, s + 0.08);
          adEnvelope(g.gain, s, lv * 0.9, 0.01 * soft, 0.085);
          end = s + 0.12;
        }
        break;
      }
      case 'warble': {
        const f = 1400 + eventRng() * 260;
        osc.frequency.setValueAtTime(f, t);
        const vib = ctx.createOscillator();
        vib.frequency.value = 8 + eventRng() * 3;
        const vd = gain(ctx, 80);
        vib.connect(vd).connect(osc.frequency);
        vib.start(t);
        vib.stop(t + 1.7);
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(lv * 0.75, t + 0.14 * soft);
        g.gain.setValueAtTime(lv * 0.75, t + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.4);
        end = t + 1.5;
        break;
      }
      case 'coo': {
        // a dove deep in the wood: two or three soft low notes, no edge on them at all
        const f = 430 + eventRng() * 120;
        const n = 2 + Math.floor(eventRng() * 2);
        for (let i = 0; i < n; i++) {
          const s = t + i * 0.52;
          osc.frequency.setValueAtTime(f * (i === 0 ? 1.12 : 1), s);
          osc.frequency.linearRampToValueAtTime(f * 0.97, s + 0.3);
          g.gain.setValueAtTime(0.0005, s);
          g.gain.linearRampToValueAtTime(lv * 1.5, s + 0.09 * soft);
          g.gain.exponentialRampToValueAtTime(0.0005, s + 0.42);
          end = s + 0.45;
        }
        break;
      }
      case 'knock': {
        // a woodpecker's drum: a run of tiny taps of the bed's own noise, arriving through the trees
        const n = 7 + Math.floor(eventRng() * 7);
        const spacing = 0.045 + eventRng() * 0.02;
        osc.frequency.setValueAtTime(1500 + eventRng() * 400, t);
        const tap = filter(ctx, 'bandpass', 1300 + eventRng() * 500, 2.2);
        const tg = gain(ctx, 0);
        bedSrc.connect(tap);
        tap.connect(tg).connect(air);
        for (let i = 0; i < n; i++) {
          const decay = 1 - (i / n) * 0.45;
          adEnvelope(g.gain, t + i * spacing, lv * 0.5 * decay, 0.002, 0.016);
          adEnvelope(tg.gain, t + i * spacing, lv * 3.2 * decay, 0.001, 0.014);
        }
        end = t + n * spacing + 0.1;
        cleanupAt(ctx, end + 0.6, () => {
          try {
            bedSrc.disconnect(tap);
          } catch {
            /* already gone */
          }
          tap.disconnect();
          tg.disconnect();
        });
        break;
      }
    }
    osc.start(t);
    osc.stop(end + 0.1);
  };

  /**
   * A fairy at `pan`, `level` loud: two or three tiny bell partials climbing over about 120 ms.
   * Short and sparse on purpose — the ear should catch a glint of light beside it, not a chime.
   */
  const glint = (t: number, pan: number, level: number) => {
    counts.glints++;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const hp = filter(ctx, 'highpass', 1200, 0.6);
    hp.connect(panner).connect(out);
    const send = gain(ctx, 0.3);
    panner.connect(send).connect(reverbSend);
    const notes = 2 + Math.floor(eventRng() * 2);
    let end = t;
    const nodes: AudioNode[] = [hp, panner, send];
    for (let i = 0; i < notes; i++) {
      const at = t + i * (0.045 + eventRng() * 0.05);
      const f = 2600 * (1 + i * 0.26) * (0.92 + eventRng() * 0.18);
      const g = gain(ctx, 0);
      g.connect(hp);
      for (const [mult, share, wave] of [
        [1, 1, 'sine'],
        [2.74, 0.22, 'triangle'],
      ] as [number, number, OscillatorType][]) {
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.value = f * mult;
        const og = gain(ctx, share);
        osc.connect(og).connect(g);
        osc.start(at);
        osc.stop(at + 0.24);
        nodes.push(og);
      }
      adEnvelope(g.gain, at, level * (1 - i * 0.15), 0.004, 0.09 + eventRng() * 0.06);
      nodes.push(g);
      end = at + 0.16;
    }
    cleanupAt(ctx, end + 0.4, () => {
      for (const n of nodes) n.disconnect();
    });
  };

  let nextGlint = startAt + 1;

  const pickBird = () => {
    let r = eventRng() * BIRD_WEIGHT;
    for (const b of BIRDS) {
      r -= b.weight;
      if (r <= 0) return b;
    }
    return BIRDS[0];
  };

  let nextBird = startAt + 2 + eventRng() * 3;
  const scheduleBirds = (until: number) => {
    while (nextBird < until) {
      const b = pickBird();
      const distance = b.near + eventRng() * (b.far - b.near);
      const pan = (eventRng() * 2 - 1) * 0.85;
      const level = 0.03 + eventRng() * 0.045;
      birdCall(b.kind, nextBird, pan, level, distance);
      // sometimes one answers from the other side, always further off
      if (eventRng() < 0.3) {
        const a = pickBird();
        birdCall(a.kind, nextBird + 1.1 + eventRng() * 1.4, -pan * 0.8, level * 0.6, Math.min(1, distance + 0.2));
      }
      nextBird += 3.5 + eventRng() * 8;
    }
  };

  const scheduleUntil = (t: number) => {
    scheduleFlutters(t);
    scheduleBirds(t);
  };

  const update = (t: number, s: AmbienceState) => {
    const gust = Math.max(0, Math.min(1, s.gust));
    gustNow = gust;
    const sw = swell(gust);
    const gorge = Math.max(0, Math.min(1, s.gorge ?? 0));
    // the wind funnels along the gorge: the roll gains with it, the hush does not (there are no
    // leaves out over the cut)
    canopyGain.gain.setTargetAtTime((CANOPY_FLOOR + sw * CANOPY_GUST) * (1 + gorge * GORGE_WIND), t, 0.9);
    canopyMod.gain.setTargetAtTime(sw, t, 0.9);
    hushGain.gain.setTargetAtTime(HUSH_FLOOR + Math.pow(sw, 1.8) * HUSH_GUST, t, 0.55);
    hushMod.gain.setTargetAtTime(Math.pow(sw, 1.5), t, 0.55);
    // pods: the NEAREST lantern sets the level; the rest of the village adds a fifth each
    let sum = 0;
    let nearest = 0;
    let px = 0;
    let pz = 0;
    for (const p of s.pods) {
      const dx = p.x - s.listener.x;
      const dy = p.y - s.listener.y;
      const dz = p.z - s.listener.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const a = 1 / (1 + (d / LANTERN_REACH_M) ** 2);
      sum += a;
      if (a > nearest) nearest = a;
      px += dx * a;
      pz += dz * a;
    }
    const level = Math.min(1, nearest + (sum - nearest) * LANTERN_CROWD_SHARE) * LANTERN_LEVEL;
    flameGain.gain.setTargetAtTime(level, t, 0.3);
    let pan = 0;
    if (sum > 1e-4) {
      // right = forward × up
      const rx = -s.forward.z;
      const rz = s.forward.x;
      const len = Math.hypot(px, pz) || 1;
      pan = Math.max(-1, Math.min(1, ((px * rx + pz * rz) / len) * 0.8));
    }
    flamePan.pan.setTargetAtTime(pan, t, 0.3);
    // the waterfall: the nearest plunge sets the level and the bearing, its distance the air
    let fa = 0;
    let fd = 0;
    let fx = 0;
    let fz = 0;
    for (const f of s.falls ?? []) {
      const dx = f.x - s.listener.x;
      const dy = f.y - s.listener.y;
      const dz = f.z - s.listener.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const a = fallAttenuation(d);
      if (a > fa) {
        fa = a;
        fd = d;
        fx = dx;
        fz = dz;
      }
    }
    counts.fall = fa;
    fallGain.gain.setTargetAtTime(fa * FALL_LEVEL, t, 0.4);
    if (fa > 0) {
      const near = 1 - Math.max(0, Math.min(1, (fd - 4) / 30));
      fallAir.frequency.setTargetAtTime(FALL_FAR_HZ * Math.pow(FALL_NEAR_HZ / FALL_FAR_HZ, near), t, 0.5);
      fallSend.gain.setTargetAtTime(0.2 + 0.5 * (1 - near), t, 0.6);
      // close in, a sheet three metres wide fills more of the field than a point: the pan narrows
      const rx = -s.forward.z;
      const rz = s.forward.x;
      const len = Math.hypot(fx, fz) || 1;
      fallPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, ((fx * rx + fz * rz) / len) * (0.85 - 0.35 * near))), t, 0.3);
    }
    // the nearest fairy: a glint every second or three while one is within a couple of metres
    if (t >= nextGlint && s.fairies?.length) {
      let best = 0;
      let bx = 0;
      let bz = 0;
      for (const f of s.fairies) {
        const dx = f.x - s.listener.x;
        const dy = f.y - s.listener.y;
        const dz = f.z - s.listener.z;
        const a = 1 / (1 + (Math.sqrt(dx * dx + dy * dy + dz * dz) / FAIRY_REACH_M) ** 2);
        if (a > best) {
          best = a;
          bx = dx;
          bz = dz;
        }
      }
      counts.fairiesNear = s.fairies.filter((f) => Math.hypot(f.x - s.listener.x, f.y - s.listener.y, f.z - s.listener.z) < FAIRY_AUDIBLE_M).length;
      // only when she is close enough to be heard: the attenuation runs on for ten metres, and a
      // glint out there is −63 dBFS, which is not a sound, just a scheduled event
      if (best > 0.25) {
        const rx = -s.forward.z;
        const rz = s.forward.x;
        const len = Math.hypot(bx, bz) || 1;
        glint(t, Math.max(-1, Math.min(1, ((bx * rx + bz * rz) / len) * 0.85)), best * FAIRY_LEVEL);
        nextGlint = t + FAIRY_GAP[0] + eventRng() * (FAIRY_GAP[1] - FAIRY_GAP[0]);
      } else {
        nextGlint = t + 0.5;
      }
    }
    // the log tunnel closing over the forest (index.ts surfaceAt: 0 at the mouth, 1 a metre and a
    // half in), geometric in frequency so the change is even as he walks in
    const enc = Math.max(0, Math.min(1, s.enclosure ?? 0));
    canopyNow = Math.max(0, Math.min(1, s.canopy ?? 0));
    // the crowns close the same filter part of the way and hand more of the bed to the hall; only
    // the tunnel's wood ducks the level, because only the tunnel puts something between him and it
    const closed = Math.max(enc, canopyNow * CANOPY_CLOSE);
    enclosureLp.frequency.setTargetAtTime(ENCLOSURE_OPEN_HZ * Math.pow(ENCLOSURE_CLOSED_HZ / ENCLOSURE_OPEN_HZ, closed), t, 0.35);
    out.gain.setTargetAtTime(1 - (1 - ENCLOSURE_DUCK) * enc, t, 0.12);
    // and more of the forest comes back as reflection off the walls
    const hall = (1 + canopyNow * CANOPY_HALL) * (1 + gorge * GORGE_HALL);
    canopySend.gain.setTargetAtTime(0.3 * hall, t, 0.6);
    // the roll leans upwind: the air arrives from where the wind comes FROM, which is behind its
    // direction of travel. Slow (1.2 s) — turning your head should move the weather, not flick it.
    if (s.windDir) {
      counts.windLean = windLeanFor(s.forward, s.windDir);
      canopyPan.pan.setTargetAtTime(counts.windLean, t, 1.2);
    }
    hushSend.gain.setTargetAtTime(0.2 * hall, t, 0.6);
  };

  return {
    scheduleUntil,
    update,
    stats: () => ({ ...counts }),
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
