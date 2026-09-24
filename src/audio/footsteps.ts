/**
 * Footsteps: synthesised steps that follow the ground under Link — stone (the flagstone paths),
 * stair (the same slab with the flight's log riser knocking under the boot), grass (the lawns and
 * verges), dirt (the trodden earth and path shoulders), leaf litter (the north forest floor), wood
 * (the deck planks) and the hollow wood inside the log tunnel.
 *
 * 2026-09-23 (owner, 06:50, straight after "the background sound is too buzzy": "the steps need to
 * be like…"). Every step used to be ONE event — a short pitched thump with one or two gated bands
 * of noise over it. Measured on the offline steps stem (`art/audio/2026-09-23-lane5/`) that is a
 * single attack and a smooth decay: a noise band, which is exactly what it sounded like. A real
 * boot is a small sequence:
 *
 *   heel   the sole's edge meets the ground — the low body of the step, and most of its level
 *   roll   the foot rolls forward over 20–60 ms — a shaped scuff whose colour MOVES
 *   grains the surface's own little sounds — grit, blade tips, leaf edges: separate micro
 *          transients, never a smooth band (this is what makes grass and litter read as material)
 *   toe    the weight arrives on the ball of the foot 50–140 ms later, quieter than the heel
 *
 * `designStep` builds that sequence as plain data (no WebAudio), so the timing, the level balance
 * and the count of parts are unit-tested in `footsteps.test.mjs`; `createFootsteps` renders it.
 *
 * The step is also TRIGGERED differently: when the character system publishes the gait's stance
 * flags (`PlayerHandle.feetContact`), a step sounds when a boot actually plants, so what is heard
 * is what is seen. Only when that is unavailable (the offline render, an older character build)
 * does the old distance-integrated stride run — and its cadence is now a walker's, not the 4.4
 * steps per second the run used to fire.
 */
import { adEnvelope, cleanupAt, filter, gain, noiseBuffer, noiseSource, type Rng } from './graph';

export type Surface = 'stone' | 'stair' | 'grass' | 'dirt' | 'wood' | 'hollow' | 'leaf';

/** a pitched part of a step: the body of the impact */
export interface BodyPart {
  kind: 'body';
  /** seconds after the heel strike */
  at: number;
  f0: number;
  f1: number;
  glide: number;
  peak: number;
  attack: number;
  decay: number;
  wave: OscillatorType;
}

/** a filtered burst of noise: the scuff, the surface band, or one grain */
export interface NoisePart {
  kind: 'noise';
  at: number;
  type: BiquadFilterType;
  freq: number;
  /** the filter sweeps to this over the burst (equal to `freq` for a still one) */
  freqTo: number;
  q: number;
  /** a low-pass after the band, where the band alone would leave too much top (grains need none) */
  lp?: number;
  peak: number;
  attack: number;
  decay: number;
}

export type StepPart = BodyPart | NoisePart;

export interface StepDesign {
  parts: StepPart[];
  /** how much of the step goes to the hall */
  reverb: number;
  /** seconds after the heel strike at which the last part has decayed */
  end: number;
}

export interface StepDrive {
  /** ground speed (m/s) */
  speed: number;
  surface: Surface;
  onStairs: boolean;
  /** the gait's stance flag per boot when the character system publishes it (`feetContact`) */
  stance?: readonly boolean[];
}

export interface Footsteps {
  /** one step at context time t */
  step(surface: Surface, t: number, strength: number, pan: number): void;
  /** integrate the player's motion; `t` is the context time the step would sound at */
  drive(t: number, dt: number, d: StepDrive): void;
  /** both boots arriving at once after a fall of `fallM` metres */
  land(t: number, surface: Surface, fallM: number): void;
  /** what has been heard so far, for the play-mode evidence (`__ZR_AUDIO__.stats()`) */
  stats(): FootstepStats;
  dispose(): void;
}

export interface FootstepStats {
  /** steps sounded since the context started */
  steps: number;
  /** of those, how many landed on a boot plant the gait reported rather than on the stride timer */
  gaitSteps: number;
  /** how many surfaces have been heard, and the last one */
  surfaces: Partial<Record<Surface, number>>;
  lastSurface: Surface | null;
  /** landings after a jump or a drop */
  landings: number;
}

/** above this ground speed the gait is a run: shorter contact, harder heel, the toe close behind */
export const RUN_SPEED = 2.4;
/** the shortest gap between two steps — a guard against a noisy stance flag double-triggering */
export const MIN_STEP_GAP = 0.16;

/** steps per second at a ground speed: a walker's cadence, then a runner's */
export function cadence(speed: number): number {
  return speed > RUN_SPEED ? 2.4 + 0.12 * speed : 1.35 + 0.42 * speed;
}

/** how far the boot travels between two steps (m) */
export function strideFor(speed: number, onStairs: boolean): number {
  if (onStairs) return 0.54;
  return Math.max(0.35, speed / cadence(speed));
}

/**
 * How hard the step lands: a stroll is soft, a full run is not — but the curve is flatter than it
 * was (0.14 per m/s → 0.10). Running already multiplies the steps by cadence as well as by weight,
 * and at 0.14 a run's steps were the loudest thing in the game by a clear margin, pulsing over the
 * music at the step rate (owner, 23:00: "the music … shakes whenever I run"). A run is still
 * plainly heavier than a walk; it just no longer out-punches everything else.
 */
export function strengthFor(speed: number): number {
  return Math.max(0.3, Math.min(1, 0.3 + speed * 0.1));
}

const body = (at: number, f0: number, f1: number, glide: number, peak: number, attack: number, decay: number, wave: OscillatorType = 'sine'): BodyPart => ({
  kind: 'body',
  at,
  f0,
  f1,
  glide,
  peak,
  attack,
  decay,
  wave,
});

const band = (at: number, freq: number, freqTo: number, q: number, lp: number, peak: number, attack: number, decay: number): NoisePart => ({
  kind: 'noise',
  type: 'bandpass',
  at,
  freq,
  freqTo,
  q,
  lp,
  peak,
  attack,
  decay,
});

/** one micro-transient of the surface itself: a grit, a blade tip, a leaf edge */
const grain = (at: number, freq: number, peak: number, decay = 0.006): NoisePart => ({
  kind: 'noise',
  type: 'bandpass',
  at,
  freq,
  freqTo: freq,
  q: 1.6,
  peak,
  attack: 0.0012,
  decay,
});

/**
 * The sequence one footstep is made of. `strength` 0.3–1 is how hard it lands, `running` shortens
 * the heel-to-toe gap and hardens the heel, `rnd` is the seeded stream (never Math.random — a
 * before / after render has to be reproducible).
 */
export function designStep(surface: Surface, strength: number, running: boolean, rnd: () => number): StepDesign {
  const k = strength;
  const j = (spread: number) => 1 + (rnd() * 2 - 1) * spread;
  // the ball of the foot arrives this long after the heel; a run lands almost flat-footed
  const toe = (running ? 0.05 : 0.1) * j(0.22);
  const parts: StepPart[] = [];
  let reverb = 0.3;
  let end = 0.35;

  switch (surface) {
    case 'stone':
    case 'stair': {
      // a flagstone under a leather sole: a low tock, the slab's short ring, a dry roll, a little grit
      const timber = surface === 'stair';
      parts.push(body(0, 172 * j(0.06), 84, 0.045, (timber ? 0.115 : 0.15) * k, 0.0018, 0.075));
      parts.push(body(0.001, 340 * j(0.05), 306, 0.03, 0.03 * k, 0.0015, 0.032, 'triangle'));
      parts.push(band(0, 950 * j(0.1), 780, 1.2, 3200, 0.05 * k, 0.0018, 0.03));
      parts.push(band(0.02 * j(0.3), 1600 * j(0.12), 820, 0.9, 4200, 0.032 * k, 0.012, 0.05));
      for (let i = 0; i < 3; i++) parts.push(grain(0.016 + rnd() * 0.075, 3200 + rnd() * 3400, 0.008 * k * j(0.4)));
      if (timber) {
        // a tread of this flight is a round log riser with earth between (hardscape/logNosings.ts):
        // the boot meets the timber's crown first, so a short dry knock sits over the slab's tock
        parts.push(body(0, 252 * j(0.05), 236, 0.03, 0.062 * k, 0.0018, 0.07));
        parts.push(band(0.002, 1400 * j(0.1), 1150, 1.4, 4200, 0.022 * k, 0.0015, 0.016));
      }
      parts.push(body(toe, 148 * j(0.06), 80, 0.04, 0.068 * k, 0.0018, 0.05));
      parts.push(band(toe, 1150 * j(0.12), 900, 1.1, 3600, 0.022 * k, 0.003, 0.028));
      reverb = timber ? 0.3 : 0.34;
      end = 0.3;
      break;
    }
    case 'grass': {
      // blades under the sole: a low soft thud and a swish that opens as the foot presses through
      parts.push(body(0, 96 * j(0.07), 58, 0.05, 0.085 * k, 0.005, 0.07));
      parts.push(band(0, 600 * j(0.12), 980, 0.7, 2600, 0.07 * k, 0.018, 0.1));
      const blades = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < blades; i++) parts.push(grain(0.008 + rnd() * 0.13, 2100 + rnd() * 3800, 0.0055 * k * j(0.5)));
      parts.push(body(toe, 88 * j(0.07), 54, 0.05, 0.034 * k, 0.006, 0.06));
      parts.push(band(toe, 880 * j(0.12), 640, 0.8, 2400, 0.033 * k, 0.02, 0.085));
      for (let i = 0; i < 2; i++) parts.push(grain(toe + rnd() * 0.09, 1900 + rnd() * 3200, 0.004 * k * j(0.5)));
      reverb = 0.2;
      end = 0.35;
      break;
    }
    case 'dirt': {
      // trodden earth: a rounder body and a real crunch — a cluster of grains, not a band
      parts.push(body(0, 118 * j(0.07), 62, 0.05, 0.105 * k, 0.003, 0.07));
      parts.push(band(0, 520 * j(0.12), 430, 0.6, 1300, 0.075 * k, 0.005, 0.06));
      const grit = 6 + Math.floor(rnd() * 3);
      for (let i = 0; i < grit; i++) parts.push(grain(0.004 + rnd() * 0.07, 750 + rnd() * 2900, 0.013 * k * j(0.5), 0.005));
      parts.push(body(toe, 104 * j(0.07), 58, 0.045, 0.045 * k, 0.004, 0.055));
      for (let i = 0; i < 3; i++) parts.push(grain(toe + rnd() * 0.05, 700 + rnd() * 2400, 0.008 * k * j(0.5), 0.005));
      reverb = 0.24;
      end = 0.3;
      break;
    }
    case 'leaf': {
      // the forest floor: almost no body at all, and a long irregular crinkle that settles after
      parts.push(body(0, 82 * j(0.08), 50, 0.05, 0.09 * k, 0.006, 0.055));
      parts.push(band(0, 1700 * j(0.15), 2300, 0.6, 6000, 0.062 * k, 0.01, 0.085));
      const crinkle = 10 + Math.floor(rnd() * 5);
      for (let i = 0; i < crinkle; i++) parts.push(grain(0.002 + rnd() * 0.16, 1500 + rnd() * 5200, 0.018 * k * j(0.6), 0.005));
      parts.push(body(toe, 76 * j(0.08), 48, 0.05, 0.04 * k, 0.007, 0.05));
      for (let i = 0; i < 5; i++) parts.push(grain(toe + rnd() * 0.1, 1700 + rnd() * 5000, 0.013 * k * j(0.6), 0.005));
      // a few leaves settling back after the boot has gone
      for (let i = 0; i < 3; i++) parts.push(grain(0.18 + rnd() * 0.16, 2200 + rnd() * 4200, 0.005 * k * j(0.6), 0.005));
      reverb = 0.22;
      end = 0.45;
      break;
    }
    case 'wood': {
      // a deck plank: two modes that ring a little, a dry tick, and now and then a creak
      const f = 198 * j(0.05);
      parts.push(body(0, f * 1.12, f, 0.025, 0.135 * k, 0.0018, 0.1));
      parts.push(body(0.001, f * 2.38, f * 2.3, 0.03, 0.036 * k, 0.0018, 0.055, 'triangle'));
      parts.push(band(0, 2100 * j(0.12), 1700, 1.6, 6000, 0.045 * k, 0.0015, 0.018));
      parts.push(band(0, 3500 * j(0.12), 3100, 1.8, 8000, 0.018 * k, 0.0012, 0.008));
      parts.push(band(0.014 * j(0.4), 980 * j(0.12), 760, 1.0, 3000, 0.028 * k, 0.008, 0.035));
      parts.push(body(toe, f * 0.97, f * 0.93, 0.03, 0.058 * k, 0.002, 0.07));
      if (rnd() < 0.28) parts.push(band(0.03 + rnd() * 0.04, 560 * j(0.15), 470, 6, 2000, 0.013 * k, 0.05, 0.19));
      reverb = 0.38;
      end = 0.4;
      break;
    }
    default: {
      // the log tunnel: the whole bore answers the step, so the body is deeper and rings on
      const f = 90 * j(0.04);
      parts.push(body(0, f * 1.2, f, 0.03, 0.12 * k, 0.0025, 0.24));
      parts.push(body(0.002, f * 1.62, f * 1.55, 0.04, 0.042 * k, 0.003, 0.17));
      parts.push(body(0.002, f * 2.7, f * 2.6, 0.04, 0.02 * k, 0.003, 0.09, 'triangle'));
      parts.push(band(0, 1500 * j(0.12), 1150, 1.5, 4500, 0.042 * k, 0.0018, 0.018));
      parts.push(band(0.006, 330 * j(0.1), 270, 0.7, 900, 0.038 * k, 0.01, 0.2));
      parts.push(body(toe, f * 0.98, f * 0.94, 0.04, 0.055 * k, 0.003, 0.19));
      reverb = 0.58;
      end = 0.55;
      break;
    }
  }
  return { parts, reverb, end };
}

/**
 * A landing: both boots arrive together, so the toe folds into the heel, the body goes deeper and
 * rings longer, and the gear settles a moment afterwards. Coming down off the ledge or the stair
 * flight used to make no sound at all — the world did not answer the drop.
 */
export function designLanding(surface: Surface, strength: number, rnd: () => number): StepDesign {
  const base = designStep(surface, strength, true, rnd);
  const parts: StepPart[] = base.parts.map((p) => (p.kind === 'body' && p.at > 0.03 ? { ...p, at: p.at * 0.3, peak: p.peak * 1.3 } : p));
  const heel = parts.find((p): p is BodyPart => p.kind === 'body' && p.at <= 0.004 && p.f0 < 400);
  // the weight under the impact: an octave below the step's own body, and it rings on
  if (heel) parts.push({ ...heel, at: 0.002, f0: heel.f0 * 0.6, f1: Math.max(26, heel.f1 * 0.6), peak: heel.peak * 0.8, decay: heel.decay * 2.4 });
  // belt, strap and tunic settling after the boots
  parts.push(band(0.045 + rnd() * 0.03, 760 * (1 + (rnd() - 0.5) * 0.2), 520, 0.7, 2600, 0.03 * strength, 0.012, 0.09));
  for (let i = 0; i < 3; i++) parts.push(grain(0.05 + rnd() * 0.09, 2100 + rnd() * 3000, 0.005 * strength, 0.005));
  return { parts, reverb: Math.min(0.8, base.reverb * 1.2), end: base.end + 0.3 };
}

/** how hard a landing is, from how far Link fell (m) */
export function landingStrength(fallM: number): number {
  return Math.max(0.45, Math.min(1, 0.45 + fallM * 0.32));
}

export function createFootsteps(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Footsteps {
  // 5.3 s, not the old 2 s: a short loop hands consecutive steps the same noise (at two steps a
  // second every fourth step was identical), and an odd length keeps it off any cadence
  const noise = noiseBuffer(ctx, rng.fork('steps'), 5.3);
  const src = noiseSource(ctx, noise, startAt);
  const stepRng = rng.fork('stepjitter');

  /** render one designed step at context time `t`, panned toward the boot that landed */
  const play = (design: StepDesign, t: number, pan: number) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    const send = gain(ctx, design.reverb);
    panner.connect(send).connect(reverbSend);
    const nodes: AudioNode[] = [panner, send];
    const taps: BiquadFilterNode[] = [];
    for (const p of design.parts) {
      const at = t + p.at;
      const g = gain(ctx, 0);
      g.connect(panner);
      adEnvelope(g.gain, at, p.peak, p.attack, p.decay);
      if (p.kind === 'body') {
        const osc = ctx.createOscillator();
        osc.type = p.wave;
        osc.frequency.setValueAtTime(p.f0, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.f1), at + p.glide);
        osc.connect(g);
        osc.start(at);
        osc.stop(at + p.attack + p.decay + 0.05);
        nodes.push(g);
      } else {
        const f = filter(ctx, p.type, p.freq, p.q);
        if (p.freqTo !== p.freq) {
          f.frequency.setValueAtTime(p.freq, at);
          f.frequency.exponentialRampToValueAtTime(Math.max(20, p.freqTo), at + p.attack + p.decay);
        }
        src.connect(f);
        taps.push(f);
        nodes.push(g, f);
        if (p.lp === undefined) {
          f.connect(g);
        } else {
          const lp = filter(ctx, 'lowpass', p.lp, 0.7);
          f.connect(lp).connect(g);
          nodes.push(lp);
        }
      }
    }
    cleanupAt(ctx, t + design.end + 0.3, () => {
      for (const tap of taps) {
        try {
          src.disconnect(tap);
        } catch {
          /* already gone */
        }
      }
      for (const n of nodes) n.disconnect();
    });
  };

  const step = (surface: Surface, t: number, strength: number, pan: number, running = strength > 0.66) => {
    play(designStep(surface, strength, running, stepRng), t, pan);
  };

  let travelled = 0;
  let side = 1;
  let moving = false;
  let lastStepAt = -1e9;
  /** while the gait's stance flags are driving the steps the distance integrator stays out of the way */
  let gaitUntil = -1e9;
  let wasStance: boolean[] = [];
  const counts: FootstepStats = { steps: 0, gaitSteps: 0, surfaces: {}, lastSurface: null, landings: 0 };

  const land = (t: number, surface: Surface, fallM: number) => {
    counts.landings++;
    counts.lastSurface = surface;
    lastStepAt = t;
    travelled = 0;
    play(designLanding(surface, landingStrength(fallM), stepRng), t, 0);
  };

  const fire = (t: number, speed: number, surface: Surface, pan: number, fromGait = false) => {
    if (t - lastStepAt < MIN_STEP_GAP) return false;
    lastStepAt = t;
    travelled = 0;
    counts.steps++;
    if (fromGait) counts.gaitSteps++;
    counts.surfaces[surface] = (counts.surfaces[surface] ?? 0) + 1;
    counts.lastSurface = surface;
    // the two boots never land identically: one is a little heavier than the other
    const asymmetry = pan > 0 ? 1.06 : 0.94;
    step(surface, t, Math.min(1, strengthFor(speed) * asymmetry * (1 + (stepRng() * 2 - 1) * 0.1)), pan, speed > RUN_SPEED);
    return true;
  };

  const drive = (t: number, dt: number, d: StepDrive) => {
    const { speed, onStairs } = d;
    if (speed < 0.25) {
      travelled = 0;
      moving = false;
      wasStance = d.stance ? d.stance.slice() : [];
      return;
    }
    const surface = onStairs && d.surface !== 'wood' && d.surface !== 'hollow' ? 'stair' : d.surface;
    const first = !moving;
    moving = true;
    // 1. the gait's own plant, when the character system reports it: the sound lands with the boot
    if (d.stance) {
      for (let i = 0; i < d.stance.length; i++) {
        if (d.stance[i] && !wasStance[i] && fire(t, speed, surface, (i === 0 ? -1 : 1) * 0.12, true)) gaitUntil = t + 1.2;
      }
      wasStance = d.stance.slice();
      if (t < gaitUntil) return;
    }
    // 2. otherwise (or if the flags went quiet) the distance the boot has travelled
    if (first) {
      if (fire(t, speed, surface, side * 0.12)) side = -side;
      return;
    }
    travelled += speed * dt;
    const stride = strideFor(speed, onStairs) * (1 + (stepRng() * 2 - 1) * 0.04);
    if (travelled >= stride) {
      travelled -= stride;
      if (fire(t, speed, surface, side * 0.12)) side = -side;
    }
  };

  return {
    step,
    drive,
    land,
    stats: () => ({ ...counts, surfaces: { ...counts.surfaces } }),
    dispose() {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
