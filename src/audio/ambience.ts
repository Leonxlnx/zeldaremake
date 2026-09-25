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
  /** fairy positions (world) — they move, so this is read fresh every frame */
  fairies?: readonly Vec3[];
  /** 0 out in the open, 1 with wood closed over the listener (inside the log tunnel's bore) */
  enclosure?: number;
  /**
   * How much solid wood stands between the listener and a world point, 0 … 1 (`occlusionAt` in
   * index.ts). A callback rather than a number because it is asked per source, not per listener —
   * the bird on his left may be behind a bole while the one ahead is not.
   */
  occlude?: (x: number, z: number) => number;
  /** 0 under open sky, 1 under a closed canopy (index.ts `surfaceAt`) */
  canopy?: number;
  /** the direction the wind travels (unit xz, `wind.direction`) — the canopy roll comes from upwind */
  windDir?: { x: number; z: number };
  /** 0 well back from the ravine, 1 out over it (index.ts `gorgeAt`) */
  gorge?: number;
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
  /**
   * Where the last few bird calls came from — `[kind, bearing, distance]`, newest last, bearing
   * −1 hard left to +1 hard right and distance 0 overhead to 1 deep in the wood.
   *
   * Published for the same reason `fairySpots` is: it is the only way a harness can see what the
   * scheduler decided, and "how many birds does this wood have in it" is not a question a
   * recording can answer.
   */
  birdSpots: [BirdKind, number, number][];
  /** how much wood stood between him and the last bird that called, 0 … 1 */
  birdShadow: number;
}
/** how many calls back `birdSpots` remembers */
export const BIRD_SPOT_MEMORY = 24;
/** the wood holds one bird of each kind within earshot; the weights decide who calls */
/**
 * How far the listener walks before the wood he is in is a different wood (m).
 *
 * Birds do not follow you, and they are not the same birds a hundred metres on. Holding the perches
 * in world coordinates for ever would leave them all behind by the time he reached the ruins;
 * re-seeding every step would be the random stream this replaces. Re-seeding once he has walked out
 * of earshot of the last lot is both — consistent individuals while he is among them, new ones when
 * he is somewhere else. `FALL_AUDIBLE_M` is 42 m for a waterfall; a bird carries less far than that.
 */
export const PERCH_RESEED_M = 25;

/**
 * How far away a perch at `distance` 1 is, in metres.
 *
 * A bird's `distance` is a 0–1 shorthand for "overhead" to "deep in the wood" and shapes its
 * brightness and its share of the hall. Occlusion needs it as a place, because a bole only shadows
 * what is behind it. Set just past `PERCH_RESEED_M`: the birds a listener has are the ones within
 * the radius that walking re-seeds, so the furthest of them sits at about the edge of it.
 */
export const PERCH_FAR_M = 28;

/**
 * How long the one pink buffer the whole bed is tapped off runs before it comes round again, and
 * how much slower the second tap plays it.
 *
 * It was nine seconds, and both wind layers played it — one from the start and one from a third of
 * the way in, on the reasoning that an offset made them "not the same noise". An offset is the same
 * noise delayed. Measured on five minutes of standing still (`art/audio/2026-09-25-loop/`), the
 * bed's waveform correlated **+0.30 with itself at nine seconds, +0.32 at eighteen and +0.51 at
 * twenty-seven** — half the forest, at twenty-seven second intervals, was a literal repeat.
 *
 * Nineteen seconds costs about 3.5 MB more of buffer and moves the repeat out past where an ear
 * holds on to it. The rate is the other half: pink noise is self-similar under time-scaling, so a
 * tap played at `LEAF_RATE` is still pink and is no longer the first tap at any lag. 0.84 is chosen
 * to be well clear of any simple ratio — at 5/6 or 4/5 the two would re-align every few loops.
 */
export const PINK_SECONDS = 19;
export const LEAF_RATE = 0.84;
export const FLAME_RATE = 0.71;
/** how far the taps' rate wanders, and how slowly — enough to smear the loop, far too little to hear */
export const PINK_DRIFT = 0.02;
export const PINK_DRIFT_HZ = 0.03;

/**
 * What a full shadow does to a call: how much of its level it keeps, and how far its top comes down.
 *
 * Not symmetrical, because a shadow is not a fader. An obstacle wide enough to matter removes the
 * high end far harder than the low — through the median 3.1 m of wood in this world the Fresnel
 * number is 32 for a distant bird and 126 for a near one, but only 2.4 at the pod flame's husk,
 * which bends round it (`art/audio/2026-09-25-occlusion/`). So the top falls by more than a factor
 * of five and the level by six decibels, and the two together are what "behind a tree" sounds like.
 */
export const OCCLUSION_DUCK = 0.5;
export const OCCLUSION_TOP = 0.18;

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
/**
 * How much of the leaf roll is the crowns **directly overhead**, as against the ring of trees round
 * any open place.
 *
 * Until now the roll did not know: `canopy` closed a filter and lifted the hall, and the level was
 * the same standing under a closed roof of leaves as standing in the middle of a paved clearing.
 * Measured, that filter moves the bed 0.8 dB across the whole range of the term, so the crowns'
 * only audible contribution was nothing at all — and walking the north corridor out into the
 * clearing, the one arrival in that half of the world, sounded identical at both ends.
 *
 * A roof of leaves is most of what you hear when the wind moves and you are under it. In the open
 * you still hear the ring around you, which is why this is a share and not a gate: 0.55 of the roll
 * survives with no crowns overhead. It only ever removes — an open sky cannot make the forest
 * louder — and the forest floor, where canopy is ~1, is unchanged to the digit.
 */
export const CANOPY_SHARE = 0.45;
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
/**
 * How far the crowns close the bed's filter, as a fraction of the log tunnel's full enclosure.
 *
 * Left at 0.5 deliberately. Standing still at one spot with the same seed and the canopy forced to
 * 0, 0.5 and 1 (`art/audio/2026-09-24-standing/term.mjs`), this filter moves the bed **0.8 dB rms
 * end to end** and no band between 125 Hz and 8 kHz moves monotonically. The reason is arithmetic:
 * 0.5 puts the cutoff at 18000 × (900/18000)^0.5 ≈ 4.0 kHz, and the bed's mean level at 4–8 kHz is
 * −74 dB against −47 at its 1–2 kHz peak — there is nothing up there to take away. Raising it to
 * 0.7 (cutoff 2.2 kHz) was tried and measured: 11 dB more removed at 4–8 kHz, where the bed sits at
 * −75, and the rms end to end still 0.8 dB. Moving a tuned constant for an inaudible gain is churn,
 * so it went back.
 *
 * What the crowns actually do to this bed is `CANOPY_SHARE`, below. A filter cannot take away what
 * is not there.
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
 * How far out a bird on its perch is allowed to sit, short of the speakers themselves.
 *
 * A call hard against one channel does not read as "over there", it reads as a fault in the mix —
 * nothing in a wood is at ninety degrees and zero distance. The wind's lean is a tenth of this
 * again, and deliberately: a bird is a point and the air is not.
 */
export const PERCH_PAN = 0.85;

/**
 * Where something lying in world direction `to` sits for a listener facing `forward` (both xz):
 * −1 hard left … +1 hard right.
 *
 * The one place this convention is written down. It was duplicated — once for the wind's lean, once
 * for the birds' perches — and a sign error in either would be invisible to every measurement this
 * lane makes, because all of them are mono sums. It is also the whole of what makes the bed a place
 * rather than a pair of speakers: turn ninety degrees and a bird that was on your left has to move
 * to the front. `art/audio/2026-09-25-facing/` renders the same spot at four facings and shows the
 * stereo image rotating under the listener.
 *
 * Right-handed xz with forward = (sin θ, cos θ), so the listener's right is (−forward.z, forward.x).
 * Front and back both project to 0, which is what a stereo pan can say and no more.
 */
export function panFor(forward: { x: number; z: number }, to: { x: number; z: number }): number {
  const len = Math.hypot(to.x, to.z) || 1;
  return Math.max(-1, Math.min(1, (to.x * -forward.z + to.z * forward.x) / len));
}

/**
 * Where the canopy roll sits for a listener facing `forward` while the wind travels along `dir`
 * (both unit xz). The air arrives from where the wind comes FROM, so the source is upwind — behind
 * its direction of travel.
 */
export function windLeanFor(forward: { x: number; z: number }, dir: { x: number; z: number }): number {
  return panFor(forward, { x: -dir.x, z: -dir.z }) * WIND_LEAN;
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
/**
 * How much of its usual gap a bird waits when the air is still, against `2 − 2×` that in a full
 * gust — so the average rate over a windy minute and a still one is the same and only the *timing*
 * moves. Birds shelter and stop calling in a blow, and sing the moment it drops.
 */
export const BIRD_LULL_GAP = 0.55;
/**
 * The correction that keeps the *total* rate where it was.
 *
 * Two things push it up once the gap varies with the wind. A rate is one over a gap, so a gap that
 * swings either side of its old value gives more calls per minute than the old fixed one did, not
 * the same (Jensen); and `BIRD_ANSWERS_LULL` pulls the next call forward, which brings every call
 * after it forward too. Measured over 1800 s of the gust curve
 * (`art/audio/2026-09-24-wind/schedule.mjs`), those two together took the birds from 10.5 a minute
 * to 13.3 — one every four and a half seconds, which is an aviary, not a wood. This puts the total
 * back so the change is what it claims to be: the same number of birds, in different places.
 */
export const BIRD_GAP_TRIM = 1.42;
/**
 * When the wind falls under the knee, how soon after a bird answers into the quiet (s).
 *
 * The bed is gated below `GUST_KNEE` on purpose — that silence is this lane's answer to "LOWER THE
 * WHITE NOISE". Measured on the world's own wind, it happens about twice a minute and lasts three
 * seconds (`art/audio/2026-09-24-wind/`), and at the old flat gap roughly half of those lulls had
 * nothing in them: the one moment the forest is deliberately quiet was also the one moment it had
 * nothing to say. A call into the gap is the opposite of a floor — it is the thing you notice
 * *because* the wind stopped.
 */
export const BIRD_ANSWERS_LULL: [number, number] = [0.5, 1.8];

export function createAmbience(ctx: BaseAudioContext, outBus: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Ambience {
  // Everything the forest makes goes through here before the bus: inside the log tunnel the wood
  // closes over the listener, so the wind, the leaves and the birds arrive muffled and quieter.
  // Walking through the arch used to change nothing at all except what was under the boots.
  const enclosureLp = filter(ctx, 'lowpass', ENCLOSURE_OPEN_HZ, 0.7);
  const out = gain(ctx, 1);
  out.connect(enclosureLp).connect(outBus);
  const pink = pinkNoiseBuffer(ctx, rng.fork('pink'), PINK_SECONDS);
  const nodes: AudioScheduledSourceNode[] = [];
  /** one always-running pink source every layer taps (a per-layer source would cost a buffer each) */
  const bedSrc = ctx.createBufferSource();
  bedSrc.buffer = pink;
  bedSrc.loop = true;
  bedSrc.start(startAt);
  nodes.push(bedSrc);
  // The second wind layer plays the same buffer SLOWER rather than three seconds into it. An offset
  // is the same noise delayed — which is what the old comment here claimed was "not the same noise"
  // — and two taps of one loop put a hard repeat into everything downstream of them. Pink noise is
  // self-similar under time-scaling (1/f stays 1/f, give or take a decibel of level), so this is
  // still pink; what it is not is the other tap, at any lag.
  const leafSrc = ctx.createBufferSource();
  leafSrc.buffer = pink;
  leafSrc.loop = true;
  leafSrc.playbackRate.value = LEAF_RATE;
  leafSrc.start(startAt, pink.duration / 3);
  nodes.push(leafSrc);
  // Even one tap of one loop repeats itself, and lengthening the buffer only buys seconds per
  // megabyte. Letting the rate wander a couple of per cent on a slow random walk means the loop
  // never comes round to the same place twice: the phase drifts, and a repeat that never lines up
  // is not a repeat. Inaudible in itself — noise has no pitch to shift — and it costs one envelope.
  const drift = (src: AudioBufferSourceNode, seed: string) => {
    const cs = controlSource(ctx, controlNoiseBuffer(ctx, rng.fork(seed), { hz: PINK_DRIFT_HZ, shape: 1, seconds: 53 }), PINK_DRIFT, 120, startAt);
    cs.out.connect(src.playbackRate);
    nodes.push(cs.src);
  };
  drift(bedSrc, 'beddrift');
  drift(leafSrc, 'leafdrift');

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
  // the third tap of the same buffer, and the one that matters most for a repeat: standing a metre
  // from a pod the flame is the loudest never-stopping thing in the world. Its own rate and its own
  // wander, for the reason the other two have theirs.
  const flameSrc = ctx.createBufferSource();
  flameSrc.buffer = pink;
  flameSrc.loop = true;
  flameSrc.playbackRate.value = FLAME_RATE;
  flameSrc.start(startAt, pink.duration * 0.66);
  nodes.push(flameSrc);
  drift(flameSrc, 'flamedrift');
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
  const counts: AmbienceStats = { birds: 0, flutters: 0, glints: 0, fairiesNear: 0, windLean: 0, birdSpots: [], birdShadow: 0 };
  /** the gust as `update` last saw it: the schedulers run ahead of the clock, so they use it as a level */
  let gustNow = 0.4;
  /** how closed the canopy was over the listener, likewise (leaves overhead move more often) */
  let canopyNow = 0;
  /** which way he was facing, likewise: the perches keep a world bearing, not a stereo position */
  let forwardNow = { x: 0, z: 1 };
  /** the world's occluders as of the last update; null until one arrives, so the bed still runs headless */
  let occludeNow: ((x: number, z: number) => number) | null = null;

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
  const birdVoice = (t: number, pan: number, distance: number, end: number, occlusion = 0) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const hp = filter(ctx, 'highpass', 320, 0.5);
    // a bole between them takes the top off far harder than it takes the level (see OCCLUSION_TOP)
    const lp = filter(ctx, 'lowpass', (7000 - 5200 * distance) * Math.pow(OCCLUSION_TOP, occlusion), 0.6);
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

  const birdCall = (kind: BirdKind, t: number, pan: number, level: number, distance: number, occlusion = 0) => {
    counts.birds++;
    counts.birdSpots.push([kind, Number(pan.toFixed(3)), Number(distance.toFixed(3))]);
    if (counts.birdSpots.length > BIRD_SPOT_MEMORY) counts.birdSpots.shift();
    counts.birdShadow = Number(occlusion.toFixed(3));
    // distance takes the level down; a far call is also slower to start (the air rounds its attack)
    const lv = level * (1 - 0.66 * distance) * (1 - OCCLUSION_DUCK * occlusion);
    const soft = 1 + distance * 1.6;
    let end = t + 1.6;
    const { voice: g, air } = birdVoice(t, pan, distance, t + 2.6, occlusion);
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

  const pickBird = (rnd: () => number) => {
    let r = rnd() * BIRD_WEIGHT;
    for (const b of BIRDS) {
      r -= b.weight;
      if (r <= 0) return b;
    }
    return BIRDS[0];
  };

  /**
   * The birds themselves. Until now there were none: the scheduler picked a kind and then drew a
   * fresh bearing and a fresh distance for it, so 216 calls over twenty minutes came from 216
   * places and a kind's calls scattered 0.47 across a ±0.85 field — indistinguishable from
   * uniform. A wood does not do that. It holds a handful of individuals, each in its own tree,
   * each calling from the same direction over and over, and that is most of what makes one sound
   * inhabited rather than sprinkled.
   *
   * A perch keeps a world direction rather than a stereo position, so the bearing is worked out
   * against the listener's facing when the call is scheduled — turn your head and the birds stay
   * where they were, which a random pan can never do. They sit in slots round the compass so the
   * wood is not all on one side, jittered inside the slot so it is not a ring.
   */
  const perchRng = rng.fork('perches');
  let perches: { kind: BirdKind; weight: number; dirX: number; dirZ: number; distance: number }[] = [];
  let perchWeight = 0;
  let perchAnchor: { x: number; z: number } | null = null;
  let lastPerch = -1;
  const seedPerches = (at: Vec3) => {
    perchAnchor = { x: at.x, z: at.z };
    // One bird of each kind, not six drawn from the weighted list: drawing doubled kinds up and
    // left a wood with three species in it. The weights belong on how often a bird calls, which is
    // what they always meant — a wood has one of everything and you hear the common ones more.
    const order = BIRDS.map((b, i) => ({ b, k: perchRng() + i * 1e-6 })).sort((p, q) => p.k - q.k);
    perches = order.map(({ b }, i) => {
      // a slot each round the compass, jittered inside it: spread, but not a ring
      const a = ((i + 0.2 + perchRng() * 0.6) / order.length) * Math.PI * 2;
      return { kind: b.kind, weight: b.weight, dirX: Math.sin(a), dirZ: Math.cos(a), distance: b.near + perchRng() * (b.far - b.near) };
    });
    perchWeight = perches.reduce((s, p) => s + p.weight, 0);
    lastPerch = -1;
  };
  /** which bird calls next: the commoner kinds more often, and never the one that just called */
  const pickPerch = (avoid: number) => {
    let r = eventRng() * perchWeight;
    for (let i = 0; i < perches.length; i++) {
      r -= perches[i].weight;
      if (r <= 0) return i === avoid ? (i + 1) % perches.length : i;
    }
    return perches.length - 1 === avoid ? 0 : perches.length - 1;
  };
  /** the bearing of a perch as the listener is facing now: −1 hard left, +1 hard right */
  const perchPan = (p: { dirX: number; dirZ: number }) => panFor(forwardNow, { x: p.dirX, z: p.dirZ }) * PERCH_PAN;
  /**
   * How much wood stands between him and a perch, right now.
   *
   * The perch is a bearing and a distance from where the birds were last seeded, which makes it a
   * place — so this is asked at the moment the call is scheduled rather than when the bird was put
   * there. Walking behind a bole has to change what the bird on the other side of it sounds like,
   * and the anchor does not move while he does (`PERCH_RESEED_M`).
   */
  const perchShadow = (p: { dirX: number; dirZ: number; distance: number }) => {
    if (!occludeNow || !perchAnchor) return 0;
    const m = p.distance * PERCH_FAR_M;
    return occludeNow(perchAnchor.x + p.dirX * m, perchAnchor.z + p.dirZ * m);
  };

  // its own stream: the lull trigger is drawn from `update`, whose call rate differs between the
  // live tick and an offline render, and it must not shift what the schedulers draw
  const lullRng = rng.fork('lull');
  let nextBird = startAt + 2 + eventRng() * 3;
  const scheduleBirds = (until: number) => {
    while (nextBird < until) {
      if (!perches.length) seedPerches({ x: 0, y: 0, z: 0 });
      const i = pickPerch(lastPerch);
      const p = perches[i];
      lastPerch = i;
      const level = 0.03 + eventRng() * 0.045;
      birdCall(p.kind, nextBird, perchPan(p), level, p.distance, perchShadow(p));
      // and sometimes another answers — a different bird in its own tree, not this one mirrored
      if (eventRng() < 0.3 && perches.length > 1) {
        const j = pickPerch(i);
        const q = perches[j];
        lastPerch = j;
        birdCall(q.kind, nextBird + 1.1 + eventRng() * 1.4, perchPan(q), level * 0.6, q.distance, perchShadow(q));
      }
      // Birds shelter and stop calling in a blow, and sing when it drops. Measured, the world's
      // wind falls under the gust knee about twice a minute for three seconds at a time
      // (`art/audio/2026-09-24-wind/`), and at a flat 3.5–11.5 s gap roughly half of those lulls
      // had no bird in them at all — so the one moment the bed is deliberately silent was also the
      // moment the wood had nothing to say. This is a rate, not a floor: the gaps get longer in a
      // gust by as much as they get shorter in the quiet.
      nextBird += (3.5 + eventRng() * 8) * BIRD_GAP_TRIM * (BIRD_LULL_GAP + gustNow * (2 - 2 * BIRD_LULL_GAP));
    }
  };

  const scheduleUntil = (t: number) => {
    scheduleFlutters(t);
    scheduleBirds(t);
  };

  const update = (t: number, s: AmbienceState) => {
    const gust = Math.max(0, Math.min(1, s.gust));
    // the wind dropping away is an event of its own: a bird answers into the quiet rather than
    // waiting out the scheduler's gap (BIRD_ANSWERS_LULL). Only on the edge — inside a long lull
    // the rate above already carries it.
    if (gustNow > GUST_KNEE && gust <= GUST_KNEE) {
      nextBird = Math.min(nextBird, t + BIRD_ANSWERS_LULL[0] + lullRng() * (BIRD_ANSWERS_LULL[1] - BIRD_ANSWERS_LULL[0]));
    }
    gustNow = gust;
    // read before anything uses it: the roll's own level is the first thing that does, and it used
    // to sit above this line and take the previous tick's roof
    canopyNow = Math.max(0, Math.min(1, s.canopy ?? 0));
    const fl = Math.hypot(s.forward.x, s.forward.z) || 1;
    forwardNow = { x: s.forward.x / fl, z: s.forward.z / fl };
    occludeNow = s.occlude ?? null;
    // a different part of the wood holds different birds (PERCH_RESEED_M)
    if (!perchAnchor || Math.hypot(s.listener.x - perchAnchor.x, s.listener.z - perchAnchor.z) > PERCH_RESEED_M) seedPerches(s.listener);
    const sw = swell(gust);
    const gorge = Math.max(0, Math.min(1, s.gorge ?? 0));
    // the wind funnels along the gorge: the roll gains with it, the hush does not (there are no
    // leaves out over the cut)
    canopyGain.gain.setTargetAtTime((CANOPY_FLOOR + sw * CANOPY_GUST) * (1 - CANOPY_SHARE + CANOPY_SHARE * canopyNow) * (1 + gorge * GORGE_WIND), t, 0.9);
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
    stats: () => ({ ...counts, birdSpots: counts.birdSpots.map((s) => [...s] as [BirdKind, number, number]) }),
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
