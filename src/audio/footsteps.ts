/**
 * Footsteps: synthesised steps that follow the ground under Link — stone (the flagstone paths),
 * stair (the same slab with the flight's log riser knocking under the boot), grass (the lawns and
 * verges), dirt (the trodden earth and path shoulders), leaf litter (the north forest floor), wood
 * (the deck planks), the hollow wood inside the log tunnel and the ruins pool's shallows.
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

export type Surface = 'stone' | 'stair' | 'grass' | 'dirt' | 'wood' | 'hollow' | 'leaf' | 'bridge' | 'water';

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
  /** how enclosed the space is (`surfaceAt`): 0 outdoors, 0.7 in a hut, 1 in the log bore */
  enclosure?: number;
}

export interface Footsteps {
  /** one step at context time t */
  step(surface: Surface, t: number, strength: number, pan: number): void;
  /** integrate the player's motion; `t` is the context time the step would sound at */
  drive(t: number, dt: number, d: StepDrive): void;
  /** both boots shoving off as he leaves the ground at `speed` m/s */
  pushOff(t: number, surface: Surface, speed: number, enclosure?: number): void;
  /** both boots arriving at once after a fall of `fallM` metres */
  land(t: number, surface: Surface, fallM: number, enclosure?: number): void;
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
  /** shoves off the ground at the start of a jump or a step off a ledge */
  pushOffs: number;
  /**
   * the context time the last contact was SCHEDULED for, not the time it was decided.
   *
   * The gait-driven path exists so that "what is heard is what is seen" — a step sounds when a boot
   * actually plants. Whether it does is a question about two clocks, and without this a harness can
   * only see that the counter went up, not when the sound it counted is due.
   */
  scheduledAt: number;
}

/** the shortest gap between two steps — a guard against a noisy stance flag double-triggering */
export const MIN_STEP_GAP = 0.16;

/**
 * How far the boot travels between two steps, and at what ground speed — **the animation's own
 * numbers, not this lane's**.
 *
 * `glbLink.ts` publishes the clip contract from Astra's pipeline as `CLIP_SPEC`: the walk clip
 * covers a 0.88 m stride in 0.55 s, the run clip 1.2 m in 28/60 s (PR #59's grounded run). A stride
 * is two steps, so the boot lands every **0.44 m** at a walk and every **0.60 m** at a run, and
 * `animation.ts` gives the ground speeds the player controller drives at — `PLAYER_SPEED` 1.2 and
 * 2.2 m/s. The clips follow the speed actually covered, so there is no foot slide and the step rate
 * falls straight out: 1.2 / 0.44 = 2.73 a second at a walk, 2.2 / 0.60 = 3.67 at a run.
 *
 * A play-mode strip of the run counted 3.6 steps a second at 0.60 m off the character system's
 * stance flags (`art/environment/people-fable-3/pr59-apply/`), which is the check that the
 * derivation is the right one rather than a coincidence; on the previous clips the same derivation
 * gave 3.64 walking against a probe's 3.56 and 3.71 (`art/audio/2026-09-24-cadence/`).
 *
 * It matters because the model is consulted wherever the character system is **not** reporting boot
 * plants: never in play, always in an offline render. Before this it was an adult's guess (2.02 a
 * second, a 0.79 m step) and every evidence WAV this lane published stepped at 55 % of the rate the
 * owner hears. Fixed once by measuring, which left a copy of the animation's number sitting here to
 * go stale the moment anyone re-authors a clip. Deriving it instead means there is nothing to go
 * stale, and `footsteps.test.mjs` reads `CLIP_SPEC` out of `glbLink.ts` and fails with the new
 * numbers if it ever moves. (Read as source, not imported: `glbLink.ts` is 2,700 lines and pulls in
 * the GLTF loader, which has no business in the audio.)
 */
export const WALK_SPEED = 1.2;
export const RUN_GROUND_SPEED = 2.2;
export const WALK_STEP_M = 0.88 / 2;
export const RUN_STEP_M = 1.2 / 2;
/**
 * above this ground speed the gait is a run: shorter contact, harder heel, the toe close behind. It
 * has to sit between the controller's walk and run speeds or one of the two designs is never heard,
 * so it is their midpoint rather than a number of its own.
 */
export const RUN_SPEED = (WALK_SPEED + RUN_GROUND_SPEED) / 2;
/** on a flight, one step is one tread whatever the speed */
export const STAIR_STEP_M = 0.54;

/** how far the boot travels between two steps (m) */
export function strideFor(speed: number, onStairs: boolean): number {
  if (onStairs) return STAIR_STEP_M;
  const t = Math.max(0, Math.min(1, (speed - WALK_SPEED) / (RUN_GROUND_SPEED - WALK_SPEED)));
  return WALK_STEP_M + (RUN_STEP_M - WALK_STEP_M) * t;
}

/** steps per second at a ground speed, as the gait plants them */
export function cadence(speed: number): number {
  return Math.max(0.8, Math.min(6, speed / strideFor(speed, false)));
}

/**
 * How hard the step lands at a standstill, at the controller's walk, and at its run.
 *
 * These are anchored to `WALK_SPEED` and `RUN_GROUND_SPEED` rather than being a slope, because a
 * slope is a number about a controller and controllers change. It was `0.3 + speed × 0.1` — flat
 * enough that a run stopped out-punching the music (owner, 23:00: *"the music … shakes whenever I
 * run"*), and tuned when the game ran at 4.6 m/s. PR #59 brought the run down to 2.2 on 2026-09-25
 * and the slope quietly took the level difference between the gaits **from 4.35 dB to 1.86**: at
 * 4.6 m/s it gave 0.76 against a walk's 0.46, and at 2.2 it gives 0.52 against 0.42.
 *
 * The walk is left exactly where it was, so nothing about walking moves. The run is put back to a
 * 4.3 dB gap — the difference the design was tuned against — and 0.69 is still **under the 0.76 the
 * game made at the old run speed**, so it asks nothing new of the headroom.
 *
 * A run has three cues: its cadence, its level, and its shape. The cadence survived PR #59 (the run
 * stride came down with the speed, so the step rate only fell from 5.05 to 3.67 a second against a
 * walk's 2.73) and the shape is a boolean and cannot drift. The level was the one that went.
 */
export const STEP_FORCE_STILL = 0.3;
export const STEP_FORCE_WALK = 0.42;
export const STEP_FORCE_RUN = 0.69;

export function strengthFor(speed: number): number {
  if (speed <= WALK_SPEED) return STEP_FORCE_STILL + (STEP_FORCE_WALK - STEP_FORCE_STILL) * Math.max(0, speed / WALK_SPEED);
  const over = (speed - WALK_SPEED) / Math.max(0.1, RUN_GROUND_SPEED - WALK_SPEED);
  return Math.min(1, STEP_FORCE_WALK + (STEP_FORCE_RUN - STEP_FORCE_WALK) * over);
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
 * What running does to a step, beyond arriving more often and harder.
 *
 * It used to do one thing. `running` appeared in exactly one expression — the heel-to-toe gap — so
 * a run was a walk with its toe fifty milliseconds closer, and on leaf litter it was not even that,
 * because the litter's last part is a settling grain rather than the toe. Comparing the two designs
 * across eight surfaces and sixty seeds (`art/audio/2026-09-25-gait/`), every other number came back
 * identical: part count, heel peak, heel attack, heel frequency, decay, reverb, top. The docstring
 * said it "hardens the heel" and it did not.
 *
 * A running footfall is not a louder walking one. Peak vertical force is about 2.5 times body
 * weight against a walk's 1.2, the foot lands flatter so the toe stops being a separate event, the
 * strike is faster and so excites the surface higher, and the whole contact is briefer — which
 * matters here for a practical reason as well as a physical one: at five steps a second a walking
 * step's tail has not finished when the next one starts.
 *
 * `strengthFor` already makes a run louder, and that is where its hardness belongs: peak force IS
 * level, so a "harder heel" here would be level twice. These four are what is left when loudness is
 * taken out — they change the step's SHAPE, which is what tells a listener the difference when both
 * are at a comfortable volume. A fifth, a 1.35x lift on the heel, was tried and removed: the
 * headroom guard in `footsteps.test.mjs` caught it at 0.47 against its 0.45 limit on a bridge at
 * full strength, and it was right to — that lift was loudness wearing shape's clothes.
 */
export const RUN_TOE = 0.7;
export const RUN_ATTACK = 0.55;
export const RUN_BRIGHT = 1.18;
export const RUN_SHORTEN = 0.8;

/**
 * The sequence one footstep is made of. `strength` 0.3–1 is how hard it lands, `running` lands it
 * flatter, brighter and briefer (see `RUN_TOE` and friends), `rnd` is the seeded stream (never
 * Math.random — a before / after render has to be reproducible).
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
    case 'bridge': {
      // a plank with eight metres of ravine under it: the board is thinner and answers lower and
      // longer than a deck on the ground, there is no floor beneath to stop it, and the rope
      // lashings creak as the span takes the weight
      const f = 142 * j(0.07);
      parts.push(body(0, f * 1.18, f, 0.03, 0.175 * k, 0.002, 0.17));
      parts.push(body(0.002, f * 2.14, f * 2.02, 0.04, 0.055 * k, 0.002, 0.09, 'triangle'));
      parts.push(body(0.004, f * 0.52, f * 0.5, 0.05, 0.07 * k, 0.004, 0.26));
      parts.push(band(0, 1900 * j(0.12), 1500, 1.5, 5200, 0.05 * k, 0.0015, 0.016));
      parts.push(band(0.012 * j(0.4), 820 * j(0.12), 640, 1.0, 2800, 0.034 * k, 0.008, 0.045));
      // the rope: a narrow band drifting down as the lashing takes up, on most steps
      if (rnd() < 0.6) parts.push(band(0.02 + rnd() * 0.05, 430 * j(0.2), 330, 7, 1600, 0.016 * k, 0.03, 0.22));
      parts.push(body(toe, f * 0.96, f * 0.92, 0.03, 0.075 * k, 0.002, 0.12));
      reverb = 0.3;
      end = 0.5;
      break;
    }
    case 'water': {
      // wading: the boot breaks the skin (a soft plunk under a bright splash falling in pitch), the
      // shin shoves the water aside, and the drops it threw patter back after the step
      parts.push(body(0, 128 * j(0.08), 70, 0.06, 0.1 * k, 0.004, 0.09));
      parts.push(band(0, 2600 * j(0.12), 1100, 0.8, 7000, 0.036 * k, 0.004, 0.1));
      parts.push(band(0.015 * j(0.3), 480 * j(0.12), 300, 0.7, 1800, 0.035 * k, 0.03, 0.22));
      const drops = 5 + Math.floor(rnd() * 4);
      for (let i = 0; i < drops; i++) parts.push(grain(0.07 + (0.28 * i) / drops + rnd() * 0.04, 1800 + rnd() * 4200, 0.01 * k * j(0.5), 0.012));
      parts.push(body(toe, 112 * j(0.08), 66, 0.06, 0.042 * k, 0.005, 0.08));
      parts.push(band(toe, 1700 * j(0.12), 900, 0.9, 5200, 0.022 * k, 0.006, 0.09));
      reverb = 0.26;
      end = 0.5;
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
  if (!running) return { parts, reverb, end };
  // the heel takes more of a run and the toe less — the foot lands flatter, so the toe stops being
  // its own event; the strike is faster and rings the surface higher; and the whole thing is
  // briefer, which it has to be at five steps a second or each one is still sounding under the next
  const run = parts.map((p) => {
    const heel = p.at <= 0.004;
    const late = p.at >= toe * 0.8;
    const scale = late ? RUN_TOE : 1;
    const shaped = { ...p, at: p.at, peak: p.peak * scale, decay: p.decay * RUN_SHORTEN };
    if (heel) {
      shaped.attack = p.attack * RUN_ATTACK;
      if (shaped.kind === 'body') {
        shaped.f0 = p.kind === 'body' ? p.f0 * RUN_BRIGHT : 0;
        shaped.f1 = p.kind === 'body' ? p.f1 * RUN_BRIGHT : 0;
      }
    }
    return shaped;
  });
  return { parts: run, reverb, end: end * RUN_SHORTEN };
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

/** how hard the shove is, from the ground speed he leaves at: a running jump scuffs more */
export function pushOffStrength(speed: number): number {
  return Math.max(0.5, Math.min(1, 0.5 + speed * 0.14));
}

/**
 * Leaving the ground: the shove, not the arrival.
 *
 * Measured on the live master (`art/audio/2026-09-24-jump/`), four jumps from a standstill on the
 * flagstones came off the ground at −34 dB against a bed sitting at −30 and landed at −26: **the
 * take-off made no sound at all**, so a jump was silence up and a thump down. That asymmetry is
 * what makes a jump feel weightless — every other contact in this game answers, and the one where
 * he pushes hardest did not.
 *
 * A shove is not a quiet knock, and the first attempt at it here got that backwards: holding its
 * bodies *under a walking step's* put the take-off at −31 dB against a bed at −32, where an
 * ordinary walking step in the same recording peaks at −25. It fired and it could not be heard.
 * A standing jump drives something like twice body weight into the ground; a walking step is
 * nearer 1.2. The shove is the **harder** of the two.
 *
 * What separates them is not level, it is shape. A boot arriving is a transient: the weight hits
 * and the surface rings. A boot leaving **presses**, then peels — so the body's onset is slow
 * enough to hear as an arrival of weight rather than a crack, the surface's own noise lasts and
 * rises while the sole rolls off it, and a few grains flick as it lets go: grass springing back,
 * grit off a flagstone, a plank unloading. It stays under a landing, which has the drop's energy
 * in it as well as his own.
 */
export function designPushOff(surface: Surface, strength: number, rnd: () => number): StepDesign {
  const base = designStep(surface, strength, false, rnd);
  const parts: StepPart[] = [];
  // his weight going into the surface as he extends: the step's own body, deeper and harder than a
  // walking step's, but arriving over 12 ms instead of 2 — a press, not a knock
  const heel = base.parts.find((p): p is BodyPart => p.kind === 'body' && p.at <= 0.004 && p.f0 < 400);
  // (the attack is relative: a grass step's heel already arrives over 5 ms where a flagstone's
  // takes 2.5, and the shove has to read as a press against whichever surface it is on)
  if (heel) parts.push({ ...heel, at: 0, f0: heel.f0 * 0.82, f1: Math.max(24, heel.f1 * 0.7), glide: Math.max(heel.glide, 0.05), peak: heel.peak * 1.2, attack: Math.max(0.012, heel.attack * 3.5), decay: heel.decay * 1.7 });
  // the peel: the surface's most sustained bands, stretched and swept upward as the sole rolls off
  const bands = base.parts.filter((p): p is NoisePart => p.kind === 'noise' && p.decay > 0.008).sort((a, b) => b.decay - a.decay);
  for (const p of bands.slice(0, 2)) {
    parts.push({ ...p, at: 0.008 + p.at, freq: p.freq * 0.7, freqTo: p.freqTo * 1.9, q: Math.max(0.6, p.q * 0.8), peak: p.peak * 1.6, attack: 0.022, decay: Math.max(0.13, p.decay * 3) });
  }
  // the release: what the surface does in the moment the sole stops touching it
  const grains = base.parts.filter((p): p is NoisePart => p.kind === 'noise' && p.decay <= 0.008);
  for (let i = 0; i < Math.min(4, grains.length); i++) parts.push({ ...grains[i], at: 0.1 + rnd() * 0.07, peak: grains[i].peak * 0.95 });
  // the hall answers a shove less than an impact — there is no crack to bounce off the trunks
  return { parts, reverb: base.reverb * 0.75, end: Math.max(base.end, 0.4) };
}

/**
 * How much of a step the room gets back, at full enclosure.
 *
 * `surfaceAt` knows he is indoors — the huts are walkable rooms, and inside one the bed is filtered
 * and ducked (`art/audio/2026-09-24-indoors/`). His boots were not told. Rendering the steps stem
 * with the space term forced to 0, to a hut's 0.7 and to the bore's 1 gave three files that differ
 * only at the renderer's own least-significant bit, about 115 dB under the signal: **a step indoors
 * was the same sound as a step in the open**, on the one surface — planks — a player is most likely
 * to be standing on inside a small wooden box.
 *
 * The space itself is `buses.room` (see `graph.ts` for why it is not the hall, and for what the
 * first attempt at it got wrong). This is only the send, and it scales with `enclosure`, so a hut's
 * 0.7 gets 0.7 of it and the doorway fades the room out as he walks through it rather than
 * switching it off at the wall line.
 */
export const ROOM_SEND = 0.85;
/** below this there is no room worth building a send for, and a step outdoors costs what it did */
export const ROOM_MIN = 0.02;

export function createFootsteps(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, roomSend: AudioNode | null, rng: Rng, startAt = 0): Footsteps {
  // 5.3 s, not the old 2 s: a short loop hands consecutive steps the same noise (at two steps a
  // second every fourth step was identical), and an odd length keeps it off any cadence
  const noise = noiseBuffer(ctx, rng.fork('steps'), 5.3);
  const src = noiseSource(ctx, noise, startAt);
  const stepRng = rng.fork('stepjitter');

  /** render one designed step at context time `t`, panned toward the boot that landed */
  const play = (design: StepDesign, t: number, pan: number, enclosure = 0) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    const send = gain(ctx, design.reverb);
    panner.connect(send).connect(reverbSend);
    const nodes: AudioNode[] = [panner, send];
    // the walls answering. Nothing is built in the open, so a step outdoors costs exactly what it did.
    if (roomSend && enclosure > ROOM_MIN) {
      const r = gain(ctx, ROOM_SEND * enclosure);
      panner.connect(r).connect(roomSend);
      nodes.push(r);
    }
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
  /** how far the next step is, jittered — drawn when the last one fired, not every tick */
  let strideNext = strideFor(WALK_SPEED, false);
  let side = 1;
  let moving = false;
  let lastStepAt = -1e9;
  /** while the gait's stance flags are driving the steps the distance integrator stays out of the way */
  let gaitUntil = -1e9;
  let wasStance: boolean[] = [];
  const counts: FootstepStats = { steps: 0, gaitSteps: 0, surfaces: {}, lastSurface: null, landings: 0, pushOffs: 0, scheduledAt: 0 };

  const pushOff = (t: number, surface: Surface, speed: number, enclosure = 0) => {
    // the shove takes the place of the step he would have taken, so the stride integrator restarts
    // from here and no boot plant lands on top of it
    if (t - lastStepAt < MIN_STEP_GAP) return;
    counts.pushOffs++;
    counts.lastSurface = surface;
    counts.scheduledAt = t;
    lastStepAt = t;
    travelled = 0;
    play(designPushOff(surface, pushOffStrength(speed), stepRng), t, 0, enclosure);
  };

  const land = (t: number, surface: Surface, fallM: number, enclosure = 0) => {
    counts.landings++;
    counts.lastSurface = surface;
    counts.scheduledAt = t;
    lastStepAt = t;
    travelled = 0;
    play(designLanding(surface, landingStrength(fallM), stepRng), t, 0, enclosure);
  };

  const fire = (t: number, speed: number, surface: Surface, pan: number, fromGait = false, enclosure = 0) => {
    if (t - lastStepAt < MIN_STEP_GAP) return false;
    lastStepAt = t;
    counts.scheduledAt = t;
    travelled = 0;
    counts.steps++;
    if (fromGait) counts.gaitSteps++;
    counts.surfaces[surface] = (counts.surfaces[surface] ?? 0) + 1;
    counts.lastSurface = surface;
    // the two boots never land identically: one is a little heavier than the other
    const asymmetry = pan > 0 ? 1.06 : 0.94;
    const strength = Math.min(1, strengthFor(speed) * asymmetry * (1 + (stepRng() * 2 - 1) * 0.1));
    play(designStep(surface, strength, speed > RUN_SPEED, stepRng), t, pan, enclosure);
    return true;
  };

  const drive = (t: number, dt: number, d: StepDrive) => {
    const { speed, onStairs, enclosure = 0 } = d;
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
        if (d.stance[i] && !wasStance[i] && fire(t, speed, surface, (i === 0 ? -1 : 1) * 0.12, true, enclosure)) gaitUntil = t + 1.2;
      }
      wasStance = d.stance.slice();
      if (t < gaitUntil) return;
    }
    // 2. otherwise (or if the flags went quiet) the distance the boot has travelled
    if (first) {
      strideNext = strideFor(speed, onStairs) * (1 + (stepRng() * 2 - 1) * 0.04);
      if (fire(t, speed, surface, side * 0.12, false, enclosure)) side = -side;
      return;
    }
    travelled += speed * dt;
    if (travelled >= strideNext) {
      // Carry the overshoot. `fire` zeroes the integrator, which is right for a boot plant, a shove
      // or a landing — the stride restarts from there — and wrong here: it throws away the distance
      // he had already gone past the trigger, which is half a tick's worth every single step. At
      // the shipping 33 ms tick that was 6-7 % of his steps never sounding, and at a tenth of a
      // second, 16 % (`art/audio/2026-09-25-tickrate/`). A stride is a distance, so what is left
      // over belongs to the next one.
      const carry = travelled - strideNext;
      if (fire(t, speed, surface, side * 0.12, false, enclosure)) side = -side;
      travelled = carry;
      // and the next stride's jitter is drawn HERE rather than every tick: drawn per tick it made
      // the seeded stream depend on the frame rate, so the same walk rendered at 20 Hz and heard at
      // 30 gave different steps
      strideNext = strideFor(speed, onStairs) * (1 + (stepRng() * 2 - 1) * 0.04);
    }
  };

  return {
    step,
    drive,
    pushOff,
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
