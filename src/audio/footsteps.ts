/**
 * Footsteps: synthesised steps that follow the ground under Link — stone (flagstones, treads),
 * grass (the lawns and verges), dirt (the trodden earth beside the paving and the path shoulders),
 * wood (the deck planks, the stair timbers) and the hollow wood inside the log tunnel — driven by
 * the player's ground speed. The character system publishes only `scene.userData.player`
 * (position + heading), so the stride is integrated from the distance travelled: a step every
 * `strideM` (walk 0.68 m, run 0.95 m, stairs 0.5 m), alternating a little left / right.
 *
 * 2026-09-22 (owner: "his footsteps should correlate where he's walking — gentle stone, grass,
 * etc."): every step is quiet and dull-edged. The old stone step was a bright 1.5–2 kHz click
 * with a 4 kHz tick (a clack on every pace); it is now a soft low tock under a short grit scuff,
 * grass a low swish, dirt a soft crunch, wood a hollow knock. Levels sit 6–9 dB under the old
 * ones and walking steps are softer than running ones.
 */
import { adEnvelope, filter, gain, noiseBuffer, noiseSource, type Rng } from './graph';

export type Surface = 'stone' | 'grass' | 'dirt' | 'wood' | 'hollow';

export interface Footsteps {
  /** one step at context time t */
  step(surface: Surface, t: number, strength: number, pan: number): void;
  /** integrate the player's motion; `t` is the context time the step would sound at */
  drive(t: number, dt: number, speed: number, surface: Surface, onStairs: boolean): void;
  dispose(): void;
}

export function createFootsteps(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Footsteps {
  const noise = noiseBuffer(ctx, rng.fork('steps'), 2);
  const src = noiseSource(ctx, noise, startAt);
  // one always-running noise source; each step opens a short gate on its own filter chain
  const stepRng = rng.fork('stepjitter');
  const jitter = (spread: number) => 1 + (stepRng() * 2 - 1) * spread;

  /** a panned output for one step, torn down once it is silent so the graph does not grow */
  const voice = (pan: number, end: number, reverb: number) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    const send = gain(ctx, reverb);
    panner.connect(send).connect(reverbSend);
    const nodes: AudioNode[] = [panner, send];
    const taps: AudioNode[] = [];
    const cleanup = () => {
      for (const tap of taps) {
        try {
          src.disconnect(tap);
        } catch {
          /* already gone */
        }
      }
      for (const n of nodes) n.disconnect();
    };
    setTimeoutCtx(ctx, end, cleanup);
    return {
      panner,
      /** a gated noise path: src → filters → gain → panner */
      noise(filters: BiquadFilterNode[], t: number, peak: number, attack: number, decay: number) {
        const g = gain(ctx, 0);
        let head: AudioNode = filters[0];
        for (let i = 1; i < filters.length; i++) head = head.connect(filters[i]);
        src.connect(filters[0]);
        head.connect(g).connect(panner);
        adEnvelope(g.gain, t, peak, attack, decay);
        taps.push(filters[0]);
        nodes.push(g, ...filters);
      },
      /** a pitched thump: a sine gliding f0 → f1 */
      tone(t: number, f0: number, f1: number, glide: number, peak: number, attack: number, decay: number, type: OscillatorType = 'sine') {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + glide);
        const g = gain(ctx, 0);
        osc.connect(g).connect(panner);
        adEnvelope(g.gain, t, peak, attack, decay);
        osc.start(t);
        osc.stop(t + attack + decay + 0.05);
        nodes.push(g);
      },
    };
  };

  // stone: a soft low tock (the sole meeting a flat slab) under a short, quiet grit scuff
  const stone = (t: number, k: number, pan: number) => {
    const v = voice(pan, t + 0.3, 0.55);
    v.tone(t, 150 * jitter(0.06), 72, 0.05, 0.11 * k, 0.003, 0.07);
    v.noise([filter(ctx, 'bandpass', 720 * jitter(0.12), 1.0), filter(ctx, 'lowpass', 2400, 0.7)], t, 0.05 * k, 0.004, 0.045 + stepRng() * 0.015);
    // the faintest grit as the sole settles
    v.noise([filter(ctx, 'highpass', 2600, 0.6), filter(ctx, 'lowpass', 5200, 0.7)], t + 0.03 + stepRng() * 0.015, 0.014 * k, 0.004, 0.035);
  };

  // grass: a low swish of blades under the boot, a faint thud beneath it
  const grass = (t: number, k: number, pan: number) => {
    const v = voice(pan, t + 0.35, 0.4);
    v.tone(t, 95 * jitter(0.08), 60, 0.05, 0.05 * k, 0.006, 0.06);
    v.noise([filter(ctx, 'bandpass', 620 * jitter(0.15), 0.6), filter(ctx, 'lowpass', 1900, 0.7)], t, 0.09 * k, 0.014, 0.11 + stepRng() * 0.03);
    // the blades springing back, softer and later
    v.noise([filter(ctx, 'bandpass', 1400 * jitter(0.1), 0.8), filter(ctx, 'lowpass', 2600, 0.7)], t + 0.06, 0.025 * k, 0.02, 0.09);
  };

  // dirt: a soft crunch of trodden earth — a low body with a short granular top
  const dirt = (t: number, k: number, pan: number) => {
    const v = voice(pan, t + 0.32, 0.45);
    v.tone(t, 115 * jitter(0.07), 62, 0.05, 0.07 * k, 0.004, 0.065);
    v.noise([filter(ctx, 'lowpass', 1150 * jitter(0.1), 0.8)], t, 0.075 * k, 0.008, 0.075 + stepRng() * 0.02);
    v.noise([filter(ctx, 'bandpass', 2100 * jitter(0.12), 1.2), filter(ctx, 'lowpass', 3600, 0.7)], t + 0.012, 0.02 * k, 0.005, 0.04);
  };

  // wood: a hollow knock — a plank's fundamental with a quieter partial, a dry tap on top
  const wood = (t: number, k: number, pan: number, hollow: boolean) => {
    const v = voice(pan, t + (hollow ? 0.5 : 0.32), hollow ? 0.7 : 0.5);
    const f = (hollow ? 92 : 205) * jitter(0.05);
    v.tone(t, f * 1.35, f, 0.03, (hollow ? 0.12 : 0.1) * k, 0.003, hollow ? 0.19 : 0.085);
    v.tone(t, f * 2.4, f * 2.05, 0.03, 0.035 * k, 0.003, hollow ? 0.12 : 0.06, 'triangle');
    v.noise([filter(ctx, 'bandpass', 900 * jitter(0.1), 1.4), filter(ctx, 'lowpass', 2800, 0.7)], t, 0.04 * k, 0.003, 0.03);
    if (hollow) v.noise([filter(ctx, 'lowpass', 420, 0.9)], t + 0.01, 0.05 * k, 0.01, 0.16);
  };

  const step = (surface: Surface, t: number, strength: number, pan: number) => {
    switch (surface) {
      case 'stone':
        stone(t, strength, pan);
        break;
      case 'dirt':
        dirt(t, strength, pan);
        break;
      case 'wood':
        wood(t, strength, pan, false);
        break;
      case 'hollow':
        wood(t, strength, pan, true);
        break;
      default:
        grass(t, strength, pan);
    }
  };

  let travelled = 0;
  let side = 1;
  let moving = false;
  // walking steps are softer than running ones: 0.45 at a stroll, 1.0 at a full run
  const strength = (speed: number) => Math.min(1, 0.35 + speed * 0.15);
  const drive = (t: number, dt: number, speed: number, surface: Surface, onStairs: boolean) => {
    if (speed < 0.25) {
      // stopped: the next step starts fresh
      if (moving) travelled = 0;
      moving = false;
      return;
    }
    const s = onStairs && surface !== 'wood' && surface !== 'hollow' ? 'stone' : surface;
    if (!moving) {
      // first step lands right away
      moving = true;
      travelled = 0;
      step(s, t, strength(speed), side * 0.12);
      side = -side;
    }
    travelled += speed * dt;
    const stride = onStairs ? 0.5 : speed > 2.6 ? 0.95 : 0.68;
    if (travelled >= stride) {
      travelled -= stride;
      step(s, t, strength(speed), side * 0.12);
      side = -side;
    }
  };

  return {
    step,
    drive,
    dispose() {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/** run `fn` once the context clock has passed `when` (a plain timer live; a no-op offline — the graph is discarded after rendering). */
function setTimeoutCtx(ctx: BaseAudioContext, when: number, fn: () => void) {
  if (typeof (ctx as OfflineAudioContext).startRendering === 'function') return;
  const ms = Math.max(0, (when - ctx.currentTime) * 1000 + 50);
  setTimeout(fn, ms);
}
