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
}

export interface Ambience {
  /** schedule every bird call and leaf flutter up to time t (context seconds) */
  scheduleUntil(t: number): void;
  /** set the continuous parameters as of context time t */
  update(t: number, state: AmbienceState): void;
  dispose(): void;
}

/** the lantern flame's distance scale (m: half level this far from one pod) and its peak level */
export const LANTERN_REACH_M = 1.3;
export const LANTERN_LEVEL = 0.055;
/** share of a non-nearest pod's attenuation that is added — a village of pods must not sum to a drone */
export const LANTERN_CROWD_SHARE = 0.2;

/**
 * The wind bed's levels: the floor in still air and how much the gust adds. The gust share is about
 * eight times the floor, so the wood is nearly quiet between gusts — an always-on bed is what a
 * listener stops hearing as air and starts hearing as noise. The owner still heard the 0.012 / 0.115
 * canopy and the 0.075 hush as "white noise in the background": the noise layers sit under the birds
 * and the steps, never level with them.
 */
export const CANOPY_FLOOR = 0.0035;
export const CANOPY_GUST = 0.032;
export const HUSH_FLOOR = 0.0004;
export const HUSH_GUST = 0.012;
/** the leaf flutters' level range (before the gust scale) and their share into the hall */
const FLUTTER_LEVEL: [number, number] = [0.0028, 0.009];
const FLUTTER_SEND = 0.25;

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

export function createAmbience(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Ambience {
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
  bedSrc.connect(canopyHp).connect(canopyLp).connect(canopyTilt).connect(canopyGain).connect(out);
  const canopySend = gain(ctx, 0.3);
  canopyGain.connect(canopySend).connect(reverbSend);
  rides(canopyGain.gain, 0.055, 1.4, 0.03, 'canopy-slow');
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
  ridesGated(hushMod, 0.42, 1.6, 0.005, 'hush');

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

  // ---- scheduled events: leaf flutters and birds ------------------------------------------------
  const eventRng = rng.fork('events');
  /** the gust as `update` last saw it: the schedulers run ahead of the clock, so they use it as a level */
  let gustNow = 0.4;

  /**
   * One leaf flutter: a short shaped grain of the bed's own pink noise. Several of these in a
   * cluster read as a branch shaking; a continuous band of the same noise reads as hiss.
   */
  const flutter = (t: number, centre: number, level: number, pan: number, decay: number) => {
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
      // gusts crowd the flutters together; still air leaves long gaps
      nextFlutter += (0.5 + eventRng() * 3.2) / (0.3 + g * 1.1);
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
    canopyGain.gain.setTargetAtTime(CANOPY_FLOOR + gust * CANOPY_GUST, t, 0.9);
    hushGain.gain.setTargetAtTime(HUSH_FLOOR + Math.pow(gust, 1.6) * HUSH_GUST, t, 0.55);
    hushMod.gain.setTargetAtTime(Math.pow(gust, 1.4), t, 0.55);
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
  };

  return {
    scheduleUntil,
    update,
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
