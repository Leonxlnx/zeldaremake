import { Rng } from '../core/rng';
import { Biquad, Stereo, clamp, eqStereo, yieldTick } from './dsp';
import * as I from './instruments';
import { JUMP_OUT } from '../film/choreo';

/**
 * The original orchestral score, composed procedurally against the shot list. Every cue is keyed to
 * a shot by name and placed relative to that shot's start; tempo grids are fitted to each shot's
 * length so cuts land on downbeats, and big explosions get orchestral hits.
 *
 * Material (all original): a heroic main theme in D ("1-2-5, 4-3-6" head, mixolydian ♭VII turn),
 * its minor transformation for the battle, a chromatic tritone motif for the Separatist flagship, a
 * scurrying chromatic figure for the buzz droids and a sneaky bassoon march for the battle droids.
 * Key plan: D major (titles) → D minor (battle) → G minor → C minor (menace) → E♭ major (rescue) →
 * rising build → F major (comedy) → D (the flip-out, turning to G for the droids) → D major (end).
 */

export interface CueShot {
  name: string;
  start: number;
  dur: number;
  /** subtitle times t0/t1 and where the voice actually sounds, s0/s1 (seconds into the shot) */
  lines: { t0: number; t1: number; s0: number; s1: number; who: string }[];
}
/** an explosion as heard from the camera: absolute time, loudness 0..1 */
export interface Hit {
  t: number;
  loud: number;
  size: number;
}

/* ------------------------------------------------------------------ harmony */

const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUAL: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  add9: [0, 4, 7, 2],
  madd9: [0, 3, 7, 2],
  mb9: [0, 3, 7, 1],
  '5': [0, 7],
};

interface Chord {
  root: number;
  /** chord tones as intervals above the root (root, third, fifth, ...) */
  iv: number[];
  bass: number;
}

function ch(name: string): Chord {
  const [main, bassName] = name.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m) return { root: 2, iv: QUAL[''], bass: 2 };
  const root = PC[m[1]];
  return { root, iv: QUAL[m[2]] ?? QUAL[''], bass: bassName ? PC[bassName] : root };
}

/** lowest pitch ≥ lo with pitch class pc */
const above = (pc: number, lo: number): number => lo + ((((pc - lo) % 12) + 12) % 12);

/** n chord tones ascending from lo; spread > 0 skips tones for an open voicing */
function voicing(c: Chord, lo: number, n: number, spread = 0): number[] {
  const pcs = c.iv.map((i) => (c.root + i) % 12);
  const out: number[] = [];
  let skip = 0;
  for (let p = lo; out.length < n && p < lo + 48; p++) {
    if (!pcs.includes(((p % 12) + 12) % 12)) continue;
    if (skip-- > 0) continue;
    out.push(p);
    skip = spread;
  }
  return out;
}
const bassNote = (c: Chord, lo: number): number => above(c.bass, lo);
/** chord tone k (0 root, 1 third, 2 fifth) nearest above lo, octave shifted */
const tone = (c: Chord, k: number, lo: number, oct = 0): number => above((c.root + c.iv[k % c.iv.length]) % 12, lo) + 12 * oct;

/* ------------------------------------------------------------------ themes (reference key D) */

type Phrase = [number, number, number][];
/** main theme, 8 bars of 4/4: [midi, beat, beats] */
const THEME: Phrase = [
  [62, 0, 0.75], [64, 0.75, 0.25], [69, 1, 2], [67, 3, 0.5], [66, 3.5, 0.5],
  [71, 4, 2], [69, 6, 0.75], [67, 6.75, 0.25], [69, 7, 1],
  [74, 8, 1.5], [73, 9.5, 0.5], [71, 10, 0.5], [69, 10.5, 0.5], [66, 11, 0.5], [67, 11.5, 0.5],
  [69, 12, 3.5],
  [62, 16, 0.75], [64, 16.75, 0.25], [69, 17, 2], [67, 19, 0.5], [66, 19.5, 0.5],
  [72, 20, 2], [71, 22, 0.75], [69, 22.75, 0.25], [71, 23, 1],
  [76, 24, 1.5], [74, 25.5, 0.5], [73, 26, 0.5], [71, 26.5, 0.5], [73, 27, 0.5], [76, 27.5, 0.5],
  [74, 28, 4],
];
/** harmony of the theme, one chord per half bar (D major) */
const THEME_HARM = ['D', 'D', 'G', 'D/F#', 'Bm', 'G', 'Asus4', 'A', 'D', 'D', 'C', 'G/B', 'Em7', 'A7', 'D', 'D'];
const slice = (p: Phrase, b0: number, b1: number): Phrase => p.filter(([, b]) => b >= b0 && b < b1).map(([m, b, d]) => [m, b - b0, Math.min(d, b1 - b)]);
const HEAD = slice(THEME, 0, 8);
const CADENCE = slice(THEME, 24, 32);
/** D major → D natural minor (F#→F, B→B♭, C#→C) */
const minor = (p: Phrase): Phrase => p.map(([m, b, d]) => {
  const k = (((m - 2) % 12) + 12) % 12;
  return [k === 4 || k === 9 || k === 11 ? m - 1 : m, b, d];
});
const tr = (p: Phrase, s: number): Phrase => p.map(([m, b, d]) => [m + s, b, d]);

/** Separatist menace: tritone leap then a chromatic sink (reference C) */
const VILLAIN: Phrase = [[48, 0, 2], [54, 2, 1], [53, 3, 0.5], [51, 3.5, 0.5], [49, 4, 2], [48, 6, 2]];
/** buzz droids: chromatic scurry, 16ths (reference C) */
const BUZZ = [72, 73, 72, 71, 72, 75, 74, 73, 72, 73, 72, 71, 70, 71, 72, 67];
/** battle droid march: staccato bassoon (reference G) */
const DROID: Phrase = [[43, 0, 0.4], [46, 1, 0.4], [45, 2, 0.3], [43, 2.5, 0.3], [42, 3, 0.4], [45, 4, 0.4], [43, 5, 0.8]];

/* ------------------------------------------------------------------ grids */

class Grid {
  t0: number;
  beat: number;
  beats: number;
  constructor(t0: number, beat: number, beats: number) {
    this.t0 = t0;
    this.beat = beat;
    this.beats = beats;
  }
  t(b: number): number {
    return this.t0 + b * this.beat;
  }
  get end(): number {
    return this.t0 + this.beats * this.beat;
  }
}
/** fit a beat grid of `unit`-beat resolution to [t0, t0 + dur) near the target tempo */
function fit(t0: number, dur: number, bpm: number, unit = 0.5): Grid {
  const units = Math.max(1, Math.round(dur / ((60 / bpm) * unit)));
  const beats = units * unit;
  return new Grid(t0, dur / beats, beats);
}

/* ------------------------------------------------------------------ the orchestra */

type Group = 'str' | 'brass' | 'wind' | 'keys' | 'choir' | 'perc';
const GROUPS: Record<Group, { gain: number; send: number; eq: () => Biquad[] }> = {
  str: { gain: 1.0, send: 0.34, eq: () => [Biquad.highpass(45), Biquad.lowshelf(160, -4, 0.8), Biquad.peak(260, 1.0, -2.5), Biquad.peak(3200, 0.9, 2.5)] },
  brass: { gain: 0.9, send: 0.3, eq: () => [Biquad.highpass(45), Biquad.lowshelf(150, -3.5, 0.8), Biquad.peak(300, 1.0, -1.5), Biquad.peak(1700, 0.8, 3)] },
  wind: { gain: 1.0, send: 0.34, eq: () => [Biquad.highpass(90)] },
  keys: { gain: 1.0, send: 0.45, eq: () => [Biquad.highpass(100)] },
  choir: { gain: 0.9, send: 0.55, eq: () => [Biquad.highpass(120), Biquad.peak(2600, 1, 2)] },
  perc: { gain: 1.0, send: 0.26, eq: () => [Biquad.highpass(35), Biquad.lowshelf(120, -4, 0.8), Biquad.peak(2500, 1, 2)] },
};

const SEC_PAN: Record<I.StrSection, number> = { vln: -0.42, vla: 0.12, vc: 0.34, cb: 0.5 };

class Orch {
  rng = new Rng(20260926);
  ev: Record<Group, (() => void)[]> = { str: [], brass: [], wind: [], keys: [], choir: [], perc: [] };
  bus: Stereo;
  /** start of the cue being written: humanising never pulls a note from after the cut to before it */
  floor = -Infinity;
  constructor(n: number) {
    this.bus = new Stereo(n);
  }
  private j(t: number, a = 0.006): number {
    const x = t + this.rng.range(-a, a);
    return t >= this.floor && x < this.floor ? this.floor : x;
  }
  private vj(v: number): number {
    return v * this.rng.range(0.93, 1.05);
  }
  brass(kind: I.BrassKind, t: number, d: number, m: number, v: number, o: Partial<I.BrassNote> = {}): void {
    const pan = { tpt: 0.26, hn: -0.28, tbn: 0.4, tuba: 0.48 }[kind] + this.rng.range(-0.05, 0.05);
    const n: I.BrassNote = { t: this.j(t), d, m, v: this.vj(v), kind, pan, ...o };
    this.ev.brass.push(() => I.brass(this.bus, n, this.rng));
  }
  str(sec: I.StrSection, art: I.StrArt, t: number, d: number, m: number, v: number, o: Partial<I.StrNote> = {}): void {
    const n: I.StrNote = { t: this.j(t, art === 'spic' ? 0.004 : 0.008), d, m, v: this.vj(v), sec, art, pan: SEC_PAN[sec], ...o };
    this.ev.str.push(() => I.strings(this.bus, n, this.rng));
  }
  timp(t: number, m: number, v: number, damp = 1): void {
    this.ev.perc.push(() => I.timpani(this.bus, t, m, v, -0.12, this.rng, damp));
  }
  timpRoll(t0: number, t1: number, m: number, v0: number, v1: number): void {
    for (let t = t0; t < t1; t += 1 / 15) this.timp(this.j(t, 0.008), m, this.vj(v0 + (v1 - v0) * ((t - t0) / (t1 - t0))), 0.6);
  }
  snare(t: number, v: number): void {
    this.ev.perc.push(() => I.snare(this.bus, t, v, 0.08, this.rng));
  }
  snareRoll(t0: number, t1: number, v0: number, v1: number): void {
    for (let t = t0; t < t1; t += 1 / 22) this.snare(this.j(t, 0.004), this.vj(v0 + (v1 - v0) * ((t - t0) / (t1 - t0))) * 0.8);
  }
  bd(t: number, v: number): void {
    this.ev.perc.push(() => I.bassDrum(this.bus, t, v, 0, this.rng));
  }
  taiko(t: number, v: number, pitch = 1): void {
    this.ev.perc.push(() => I.taiko(this.bus, t, v, 0.05, this.rng, pitch));
  }
  crash(t: number, v: number, dur = 3.2): void {
    const pan = this.rng.range(-0.35, 0.35);
    this.ev.perc.push(() => I.crash(this.bus, t, v, pan, this.rng, dur));
  }
  swell(t0: number, t1: number, v: number): void {
    this.ev.perc.push(() => I.cymSwell(this.bus, t0, t1, v, 0.2, this.rng));
  }
  tam(t: number, v: number, dur = 5): void {
    this.ev.perc.push(() => I.tamtam(this.bus, t, v, -0.2, this.rng, dur));
  }
  wb(t: number, v: number, f = 1150): void {
    this.ev.perc.push(() => I.woodblock(this.bus, t, v, 0.3, this.rng, f));
  }
  choir(t: number, d: number, m: number, v: number, vowel: I.Vowel, o: { att?: number; rel?: number; swell?: [number, number] } = {}): void {
    const pan = this.rng.range(-0.5, 0.5);
    this.ev.choir.push(() => I.choir(this.bus, { t, d, m, v, vowel, pan, ...o }, this.rng));
  }
  harp(t: number, m: number, v: number): void {
    this.ev.keys.push(() => I.harp(this.bus, t, m, v, -0.55, this.rng));
  }
  bell(kind: 'cel' | 'glock' | 'xylo', t: number, m: number, v: number): void {
    const pan = kind === 'cel' ? -0.45 : 0.45;
    this.ev.keys.push(() => I.bell(this.bus, kind, this.j(t, 0.003), m, v, pan, this.rng));
  }
  wind(kind: I.WindKind, t: number, d: number, m: number, v: number, stacc = false): void {
    const pan = { fl: -0.12, cl: 0.05, bsn: 0.15, ob: -0.05 }[kind];
    this.ev.wind.push(() => I.wind(this.bus, { t: this.j(t), d, m, v: this.vj(v), kind, pan, stacc }, this.rng));
  }

  /* --- composite gestures */

  /** tutti hit: sforzando brass + marcato strings + timpani, bass drum and crash */
  hit(t: number, c: Chord, v: number, o: { crash?: boolean; tam?: boolean; sus?: number } = {}): void {
    const d = o.sus ?? 0.5;
    for (const m of voicing(c, 70, 3)) this.brass('tpt', t, d, m, v, { sfz: d > 0.6 });
    for (const m of voicing(c, 55, 4)) this.brass('hn', t, d + 0.2, m, v * 0.95, { sfz: true });
    for (const m of voicing(c, 45, 3, 1)) this.brass('tbn', t, d, m, v);
    this.brass('tuba', t, d, bassNote(c, 33), v * 0.9);
    for (const m of voicing(c, 67, 3)) this.str('vln', 'marc', t, 0.3, m, v);
    this.str('vla', 'marc', t, 0.3, tone(c, 0, 57), v);
    this.str('vc', 'marc', t, 0.35, bassNote(c, 43), v);
    this.str('cb', 'marc', t, 0.35, bassNote(c, 31), v);
    this.timp(t, bassNote(c, 43), v);
    this.bd(t, v);
    if (o.crash !== false) this.crash(t, v);
    if (o.tam) this.tam(t + 0.01, v * 0.8);
  }

  /** a melodic phrase on a grid, in any instrument */
  phrase(g: Grid, b0: number, p: Phrase, play: (t: number, d: number, m: number) => void, o: { from?: number; to?: number; legato?: number } = {}): void {
    for (const [m, b, d] of p) {
      if (b < (o.from ?? -1e9) || b >= (o.to ?? 1e9)) continue;
      const bb = b0 + b;
      if (bb >= g.beats + 1e-6) continue;
      const dd = Math.min(d, g.beats - bb);
      play(g.t(bb), dd * g.beat * (o.legato ?? 1), m);
    }
  }

  /** harp glissando through the chord's scale from lo to hi (or back) */
  gliss(t0: number, t1: number, c: Chord, lo: number, hi: number, v: number, down = false): void {
    const scale = [0, 2, 4, 5, 7, 9, 11].map((i) => (c.root + i + (c.iv[1] === 3 ? (i === 4 || i === 9 || i === 11 ? -1 : 0) : 0)) % 12);
    const notes: number[] = [];
    for (let m = lo; m <= hi; m++) if (scale.includes(((m % 12) + 12) % 12)) notes.push(m);
    if (down) notes.reverse();
    notes.forEach((m, k) => this.harp(t0 + ((t1 - t0) * k) / notes.length, m, v * (0.6 + 0.4 * (k / notes.length))));
  }

  /**
   * The action bed: 16th-note string ostinato in 3+3+2 groups, driving low strings on the accents,
   * optional horn stabs, snare and timpani. harm(b) gives the chord at grid beat b.
   */
  bed(g: Grid, b0: number, b1: number, harm: (b: number) => Chord, x: { v: number; thin?: boolean; brass?: boolean; perc?: boolean; lo?: number; snare?: boolean }): void {
    const cell: [number, number][] = [[0, 1], [2, 0], [1, 0], [0, 1], [2, 0], [1, 0], [0, 1], [2, 0]];
    const lo = x.lo ?? 62;
    const d16 = g.beat / 4;
    for (let k = 0; b0 + k * 0.25 < b1 - 1e-6; k++) {
      const b = b0 + k * 0.25;
      if (b >= g.beats - 1e-6) break;
      const step = k % 8;
      const c = harm(b);
      const acc = step === 0 || step === 3 || step === 6;
      const t = g.t(b);
      const [ti, oct] = cell[step];
      if (!x.thin) {
        this.str('vln', 'spic', t, d16 * 0.9, tone(c, ti, lo, oct), x.v * (acc ? 0.95 : 0.62));
        this.str('vla', 'spic', t, d16 * 0.9, tone(c, (ti + 1) % 3, lo - 12, 0), x.v * (acc ? 0.85 : 0.5));
      } else if (step % 2 === 0) {
        this.str('vla', 'spic', t, d16 * 1.4, tone(c, 0, 50), x.v * (acc ? 0.7 : 0.45));
      }
      if (acc) {
        const dd = (step === 6 ? 2 : 3) * d16;
        this.str('vc', 'marc', t, dd * 0.85, bassNote(c, 38), x.v * 0.95);
        this.str('cb', 'marc', t, dd * 0.85, bassNote(c, 26), x.v * 0.9);
        if (x.brass && !x.thin) for (const m of voicing(c, 53, 3)) this.brass('hn', t, dd * 0.7, m, x.v * 0.75);
        if (x.brass && !x.thin && step === 0 && k % 16 === 0) this.brass('tbn', t, dd * 0.8, bassNote(c, 40), x.v * 0.8);
      }
      if (x.perc !== false && !x.thin) {
        if (x.snare !== false) this.snare(t, (acc ? 0.62 : 0.22) * x.v);
        if (step === 0) this.timp(t, bassNote(c, 40), 0.75 * x.v);
        if (step === 6) this.timp(t, bassNote(c, 40) + 7 > 55 ? bassNote(c, 40) - 5 : bassNote(c, 40) + 7, 0.6 * x.v);
      }
    }
  }

  async render(dry: Stereo, send: Stereo): Promise<void> {
    for (const g of Object.keys(this.ev) as Group[]) {
      if (!this.ev[g].length) continue;
      this.bus.clear();
      for (const f of this.ev[g]) f();
      eqStereo(this.bus, GROUPS[g].eq);
      const { gain, send: sa } = GROUPS[g];
      const L = this.bus.L, R = this.bus.R;
      for (let i = 0; i < dry.n; i++) {
        const l = L[i] * gain, r = R[i] * gain;
        dry.L[i] += l;
        dry.R[i] += r;
        send.L[i] += l * sa;
        send.R[i] += r * sa;
      }
      await yieldTick();
    }
  }
}

/* ------------------------------------------------------------------ cues */

interface Ctx {
  o: Orch;
  shots: CueShot[];
  hits: Hit[];
  /** hits inside a shot, loudest first */
  hitsIn(s: CueShot, minLoud?: number): Hit[];
  next(s: CueShot): CueShot | undefined;
  prev(s: CueShot): CueShot | undefined;
}

type Cue = (s: CueShot, c: Ctx) => void;

const harmBars = (names: string[], perBar = 4) => (b: number): Chord => ch(names[Math.min(names.length - 1, Math.floor(b / perBar))]);

/** hits (loudest first) thinned so no two are closer than gap seconds; returned in time order */
function spaced(hits: Hit[], gap: number, max = Infinity): Hit[] {
  const out: Hit[] = [];
  for (const h of hits) {
    if (out.length >= max) break;
    if (out.every((o) => Math.abs(o.t - h.t) >= gap)) out.push(h);
  }
  return out.sort((a, b) => a.t - b.t);
}

/** "A long time ago…" and the end of the film: silence */
const silence: Cue = () => undefined;

/** main title: explosive fanfare, then the march theme under the crawl, fading into the stars */
const crawlCue: Cue = (s, { o }) => {
  const bars = Math.max(4, Math.round(s.dur / ((60 / 112) * 4)));
  const g = new Grid(s.start, s.dur / (bars * 4), bars * 4);
  const D = ch('D'), Bb = ch('Bb'), C = ch('C');
  // bar 1: the blast
  o.hit(g.t(0), D, 1.05, { sus: 1.0 });
  for (const m of [57, 62, 66, 69]) o.brass('hn', g.t(0), g.beat * 3.8, m, 0.8, { sfz: true, swell: 0.5 });
  o.str('vln', 'trem', g.t(0.3), g.beat * 3.5, 74, 0.6);
  o.str('vln', 'trem', g.t(0.3), g.beat * 3.5, 81, 0.5);
  o.str('vc', 'trem', g.t(0.3), g.beat * 3.5, 50, 0.6);
  // second trumpets a diatonic third below
  const under = (p: Phrase, lo: number[]): Phrase => p.map(([, b, d], k) => [lo[k], b, d]);
  const fan: Phrase = [[69, 1, 1 / 3], [71, 1 + 1 / 3, 1 / 3], [73, 1 + 2 / 3, 1 / 3], [74, 2, 0.5], [76, 2.5, 0.5], [78, 3, 1]];
  o.phrase(g, 0, fan, (t, d, m) => o.brass('tpt', t, d * 0.92, m, 0.95));
  o.phrase(g, 0, under(fan, [66, 67, 69, 71, 73, 74]), (t, d, m) => o.brass('tpt', t, d * 0.92, m, 0.75, { players: 2 }));
  o.snareRoll(g.t(2), g.t(4), 0.3, 0.75);
  o.timp(g.t(3.5), 45, 0.8);
  // bar 2: ♭VI – ♭VII
  const fan2: Phrase = [[77, 4, 1], [74, 5, 0.5], [77, 5.5, 0.5], [79, 6, 1], [76, 7, 0.5], [79, 7.5, 0.5]];
  o.phrase(g, 0, fan2, (t, d, m) => o.brass('tpt', t, d * 0.9, m, 1.0));
  o.phrase(g, 0, under(fan2, [74, 70, 74, 76, 72, 76]), (t, d, m) => o.brass('tpt', t, d * 0.9, m, 0.78, { players: 2 }));
  for (const [c, b] of [[Bb, 4], [C, 6]] as const) {
    for (const m of voicing(c, 58, 4)) o.brass('hn', g.t(b), g.beat * 1.9, m, 0.85);
    for (const m of voicing(c, 46, 3, 1)) o.brass('tbn', g.t(b), g.beat * 1.8, m, 0.9);
    o.brass('tuba', g.t(b), g.beat * 1.8, bassNote(c, 34), 0.85);
    for (const m of voicing(c, 65, 3)) o.str('vln', 'trem', g.t(b), g.beat * 2, m, 0.65);
    o.str('vla', 'trem', g.t(b), g.beat * 2, tone(c, 1, 55), 0.6);
    o.str('vc', 'marc', g.t(b), g.beat * 1.5, bassNote(c, 43), 0.85);
    o.str('cb', 'marc', g.t(b), g.beat * 1.5, bassNote(c, 31), 0.85);
    o.timp(g.t(b), bassNote(c, 43), 0.85);
  }
  o.snareRoll(g.t(6), g.t(8), 0.35, 0.9);
  o.timp(g.t(7.5), 48, 0.7);
  o.timp(g.t(7.75), 48, 0.8);
  [62, 64, 66, 67, 69, 71].forEach((m, k) => o.str('vln', 'spic', g.t(7 + k / 6), g.beat / 6, m, 0.75));
  o.swell(g.t(5.5), g.t(8), 0.7);
  // the march theme
  const themeBars = clamp(bars - 3, 1, 8);
  const tb0 = 8;
  o.crash(g.t(tb0), 0.85);
  o.bd(g.t(tb0), 0.8);
  const melody = slice(THEME, 0, themeBars * 4);
  o.phrase(g, tb0, melody, (t, d, m) => o.brass('hn', t, d * 0.97, m, 0.95));
  o.phrase(g, tb0, melody, (t, d, m) => o.brass('tpt', t, d * 0.95, m, 0.55, { players: 2 }));
  o.phrase(g, tb0, melody, (t, d, m) => o.str('vln', 'leg', t, d * 1.02, m + 12, 0.75, { att: 0.05 }));
  o.phrase(g, tb0, melody, (t, d, m) => o.wind('fl', t, d, m + 12, 0.5));
  for (let hb = 0; hb < themeBars * 2; hb++) {
    const c = ch(THEME_HARM[hb]);
    const b = tb0 + hb * 2;
    // march bass
    o.str('vc', 'marc', g.t(b), g.beat * 0.8, bassNote(c, 38), 0.8);
    o.str('cb', 'marc', g.t(b), g.beat * 0.8, bassNote(c, 26), 0.75);
    o.str('vc', 'marc', g.t(b + 1), g.beat * 0.7, bassNote(c, 38) + 7 > 52 ? bassNote(c, 38) - 5 : bassNote(c, 38) + 7, 0.65);
    o.brass('tuba', g.t(b), g.beat * 0.8, bassNote(c, 34), 0.62);
    o.timp(g.t(b), bassNote(c, 40), 0.6);
    o.bd(g.t(b), 0.42);
    // off-beat chords
    for (const off of [0.5, 1.5]) for (const m of voicing(c, 57, 3)) o.str(m < 62 ? 'vla' : 'vln', 'spic', g.t(b + off), g.beat * 0.3, m, 0.55);
    for (const m of voicing(c, 48, 3, 1)) o.brass('tbn', g.t(b), g.beat * 1.8, m, 0.42);
    // snare march cell
    [0, 0.5, 0.75, 1, 1.5].forEach((x, k) => o.snare(g.t(b + x), k === 0 ? 0.55 : 0.3));
  }
  // trumpet interjection under the held note of theme bar 4
  if (themeBars >= 4) {
    const b = tb0 + 13;
    [[76, 0, 0.5], [73, 0.5, 0.5], [69, 1, 1], [76, 2, 0.5], [81, 2.5, 0.5]].forEach(([m, x, d]) => o.brass('tpt', g.t(b + x), g.beat * d * 0.9, m, 0.8));
    o.gliss(g.t(b), g.t(b + 1.5), ch('A'), 57, 88, 0.7);
  }
  // tail: the crawl recedes, the stars take over
  const tail = tb0 + themeBars * 4;
  if (tail < g.beats) {
    const Bbm = ch('Bbmaj7');
    const td = g.end - g.t(tail);
    for (const m of [74, 81, 86]) o.str('vln', 'trem', g.t(tail), td, m, 0.45, { swell: [1, 0.35] });
    for (const m of [58, 62, 65]) o.str('vla', 'leg', g.t(tail), td, m, 0.45, { swell: [1, 0.4] });
    o.str('cb', 'trem', g.t(tail) + td * 0.4, td * 0.6, 38, 0.4, { swell: [0.3, 0.9] });
    o.phrase(g, tail, slice(HEAD, 0, 4), (t, d, m) => o.brass('hn', t, d, m, 0.45));
    o.gliss(g.t(tail), g.t(tail) + td * 0.6, Bbm, 58, 86, 0.55);
    [86, 89, 93, 98].forEach((m, k) => o.bell('cel', g.t(tail + 1 + k * 0.5), m, 0.45));
  }
};

/** the long take: the stars tilt away, the fighters roar in, and the battle theme takes off */
const longtakeCue: Cue = (s, cx) => {
  const { o } = cx;
  const T = (x: number) => s.start + x;
  const te = Math.min(2.9, s.dur * 0.25);
  // build under the tilt
  o.str('cb', 'trem', T(0), te, 38, 0.8, { swell: [0.25, 1] });
  o.str('vc', 'trem', T(0), te, 50, 0.7, { swell: [0.25, 1] });
  o.str('vln', 'trem', T(0), te, 81, 0.55, { swell: [0.2, 1] });
  o.str('vln', 'trem', T(0), te, 86, 0.45, { swell: [0.2, 1] });
  for (const m of [62, 65, 69]) o.brass('hn', T(0.3), te - 0.3, m, 0.85, { swell: 0.12 });
  for (const m of [62, 65, 69, 74]) o.choir(T(0.5), te - 0.5, m, 0.7, 'ah', { swell: [0.1, 1], att: 0.4 });
  o.timpRoll(T(Math.max(0, te - 1.8)), T(te), 50, 0.2, 0.95);
  o.swell(T(Math.max(0, te - 1.6)), T(te), 0.85);
  o.gliss(T(te - 1.3), T(te - 0.45), ch('Dm'), 50, 86, 0.6);
  // the roar: B♭ over D, and the ostinato kicks in
  o.hit(T(te), ch('Bb/D'), 1.1, { sus: 0.7 });
  const bars = Math.max(2, Math.round((s.dur - te) / ((60 / 146) * 4)));
  const g = new Grid(T(te), (s.dur - te) / (bars * 4), bars * 4);
  const harm = (b: number): Chord => {
    const bar = Math.floor(b / 4);
    const second = b % 4 >= 2;
    const map = [['Dm', 'Dm'], ['Bb', 'Bb'], ['F', 'F'], ['Bb', 'C'], ['Bb', 'Gm'], ['Asus4', 'A'], ['D', 'D'], ['G', 'D']];
    const idx = bars <= 8 ? bar + (8 - bars) : Math.min(7, bar);
    const pair = map[Math.max(0, Math.min(7, idx))];
    return ch(second ? pair[1] : pair[0]);
  };
  const off = bars - 8;
  const B = (bar: number) => (bar + off) * 4;
  o.bed(g, 0, g.beats, harm, { v: 0.9, brass: true });
  // bars 1–2: trumpet call (theme head in D minor)
  if (B(0) >= 0) o.phrase(g, B(0), minor(tr(HEAD, 12)), (t, d, m) => o.brass('tpt', t, d * 0.95, m, 1.0));
  // bars 3–4: horns answer in F
  if (B(2) >= 0) o.phrase(g, B(2), tr(HEAD, 3), (t, d, m) => o.brass('hn', t, d * 0.97, m, 0.95));
  if (B(2) >= 0) o.phrase(g, B(2), tr(HEAD, 15), (t, d, m) => o.str('vln', 'leg', t, d, m, 0.7, { att: 0.04 }));
  // bars 5–6: the theme's climb, in minor, trumpets and horns together
  const climb = minor(slice(THEME, 8, 16));
  if (B(4) >= 0) {
    o.phrase(g, B(4), tr(climb, 0), (t, d, m) => o.brass('hn', t, d * 0.97, m, 1.0));
    o.phrase(g, B(4), tr(climb, 12), (t, d, m) => o.brass('tpt', t, d * 0.95, m, 0.9));
    o.phrase(g, B(4), tr(climb, 12), (t, d, m) => o.str('vln', 'leg', t, d, m, 0.75, { att: 0.03 }));
    o.swell(g.t(B(5) + 1), g.t(B(6)), 0.9);
    o.snareRoll(g.t(B(5) + 2), g.t(B(6)), 0.3, 0.9);
  }
  // bars 7–8: over the edge — the main theme in full, D major, with choir
  const b7 = Math.max(0, B(6));
  o.crash(g.t(b7), 1.0);
  o.bd(g.t(b7), 0.9);
  o.phrase(g, b7, tr(HEAD, 12), (t, d, m) => o.brass('tpt', t, d * 0.95, m, 1.1));
  o.phrase(g, b7, HEAD, (t, d, m) => o.brass('hn', t, d * 0.97, m, 1.05));
  o.phrase(g, b7, tr(HEAD, -12), (t, d, m) => o.brass('tbn', t, d * 0.95, m, 0.8));
  o.phrase(g, b7, tr(HEAD, 12), (t, d, m) => o.str('vln', 'leg', t, d, m, 0.85, { att: 0.03 }));
  o.phrase(g, b7, tr(HEAD, 24), (t, d, m) => o.wind('fl', t, d, m, 0.55));
  for (const [c, b] of [['D', 0], ['G', 4], ['D', 6]] as const) {
    const bb = b7 + b;
    if (bb >= g.beats) continue;
    const dd = (b === 0 ? 4 : 2) * g.beat;
    for (const m of voicing(ch(c), 62, 4)) o.choir(g.t(bb), dd, m, 0.85, 'ah', { att: 0.15 });
  }
  o.gliss(g.t(b7), g.t(b7 + 1.5), ch('D'), 50, 91, 0.75);
  // flak: taiko on the biggest bursts of the dive
  for (const h of spaced(cx.hitsIn(s, 0.12).filter((h) => h.t >= g.t(b7) - 0.2), 0.35)) o.taiko(h.t, Math.min(1, 0.5 + h.loud), 1);
  // the cut: land on V of G minor
  o.timpRoll(g.t(g.beats - 1.5), g.end, 50, 0.4, 0.9);
};

/** tracking through the flak; the frigate dies */
const trackCue: Cue = (s, cx) => {
  const { o } = cx;
  const g = fit(s.start, s.dur, 150, 0.5);
  const harm = harmBars(['Gm', 'Eb', 'Cm', 'D']);
  o.hit(g.t(0), ch('Gm'), 0.95, { sus: 0.3 });
  const big = cx.hitsIn(s, 0.05)[0];
  const bigT = big && big.t > s.start + 0.8 ? big.t : s.start + s.dur * 0.78;
  const bigB = (bigT - g.t0) / g.beat;
  o.bed(g, 0, Math.max(0, bigB - 0.05), harm, { v: 0.85, brass: true });
  o.phrase(g, 0.5, minor(tr(HEAD, 5)), (t, d, m) => o.brass('tpt', t, d * 0.95, m, 0.95), { to: bigB - 0.6 });
  o.phrase(g, 0.5, minor(tr(HEAD, -7)), (t, d, m) => o.brass('hn', t, d * 0.97, m, 0.85), { to: bigB - 0.6 });
  // the kill
  o.hit(bigT, ch('Eb'), 1.1, { tam: true, sus: 0.8 });
  o.swell(bigT - 0.9, bigT, 0.8);
  // aftermath: stunned tremolo, then a pickup into the cockpit
  const rest = g.end - bigT;
  if (rest > 0.3) {
    for (const m of [67, 70, 74]) o.str('vln', 'trem', bigT + 0.1, rest - 0.1, m, 0.45, { swell: [0.9, 0.4] });
    o.str('cb', 'trem', bigT + 0.1, rest - 0.1, 31, 0.5);
  }
  // other hits along the way: timpani accents
  const others = cx.hitsIn(s, 0.2).filter((h) => Math.abs(h.t - bigT) >= 0.3 && h.t >= s.start + 0.3);
  for (const h of spaced(others, 0.4)) o.timp(h.t, 43, Math.min(1, 0.4 + h.loud));
};

/** dialogue underscore: sustained, low, out of the voice band; optional horn motif before the line */
function underscore(s: CueShot, o: Orch, c: Chord, x: { motif?: Phrase; motifV?: number; pulse?: boolean; trem?: boolean; build?: boolean; bpm?: number; v?: number }): void {
  const g = fit(s.start, s.dur, x.bpm ?? 150, 0.5);
  const first = s.lines[0]?.s0 ?? s.dur;
  const d = s.dur;
  const v = x.v ?? 0.42;
  for (const m of voicing(c, 50, 3)) o.str(m < 55 ? 'vc' : 'vla', x.trem ? 'trem' : 'leg', s.start, d, m, v, { att: 0.25, swell: [0.8, x.build ? 1.1 : 0.8] });
  o.str('cb', 'leg', s.start, d, bassNote(c, 28), v * 1.07, { att: 0.2 });
  if (x.pulse) for (let b = 0; b < g.beats; b += 1) o.str('vc', 'spic', g.t(b), g.beat * 0.4, bassNote(c, 38), b % 2 ? 0.35 : 0.5);
  if (x.motif) o.phrase(g, 0, x.motif, (t, dd, m) => o.brass('hn', t, dd, m, x.motifV ?? 0.6), { to: Math.max(1, (first - 0.1) / g.beat) + 0.01 });
  if (x.build) {
    o.snareRoll(s.start + d - 0.7, s.start + d, 0.1, 0.55);
    o.swell(s.start + d - 0.9, s.start + d, 0.55);
  }
}

const anakinCockpitCue: Cue = (s, { o }) => underscore(s, o, ch('Bb'), { motif: tr(HEAD, -4).slice(0, 4), motifV: 0.75, pulse: true, build: true });
/** "a bad feeling": C minor tremolo, stopped horns breathing in and out, a timpani roll that never quite arrives */
const obiwanCockpitCue: Cue = (s, { o }) => {
  underscore(s, o, ch('Cm'), { trem: true, v: 0.55 });
  const g = fit(s.start, s.dur, 150, 0.5);
  for (let b = 0; b < g.beats; b += 0.5) o.str('vc', 'colleg', g.t(b), 0.05, 48, b % 1 ? 0.4 : 0.6);
  for (const m of [60, 63, 67]) o.brass('hn', s.start + 0.1, s.dur * 0.55, m, 0.55, { stopped: true, swell: 0.3 });
  for (const m of [59, 62, 68]) o.brass('hn', s.start + s.dur * 0.55, s.dur * 0.45, m, 0.5, { stopped: true, swell: 0.3 });
  o.brass('tbn', s.start + 0.2, s.dur - 0.2, 36, 0.45, { swell: 0.35 });
  o.timpRoll(s.start + 0.8, s.start + s.dur, 36, 0.12, 0.38);
  o.str('vln', 'trem', s.start + 0.3, s.dur - 0.3, 79, 0.3, { swell: [0.4, 0.9] });
};
const obiwanCockpit2Cue: Cue = (s, { o }) => underscore(s, o, ch('Ebm'), { trem: true, pulse: true, build: false });
const anakinCockpit2Cue: Cue = (s, { o }) => {
  underscore(s, o, ch('Eb'), { build: true, v: 0.55 });
  const g = fit(s.start, s.dur, 150, 0.5);
  o.phrase(g, 0.25, tr(HEAD, 1), (t, d, m) => o.brass('hn', t, d, m, 0.7));
};

/** the vulture swarm: D minor action, stabs on the kills, a barrel roll */
const vulturesCue: Cue = (s, cx) => {
  const { o } = cx;
  const g = fit(s.start, s.dur, 150, 0.5);
  const harm = harmBars(['Dm', 'Bb', 'Gm', 'A']);
  o.hit(g.t(0), ch('Dm'), 0.95, { sus: 0.3 });
  const rollAt = s.start + Math.min(2.8, s.dur * 0.56);
  const rollEnd = s.start + Math.min(4.2, s.dur * 0.84);
  const rb = (rollAt - g.t0) / g.beat;
  o.bed(g, 0, rb, harm, { v: 0.85, brass: true });
  o.phrase(g, 1, minor(tr(slice(THEME, 8, 16), 0)), (t, d, m) => o.brass('hn', t, d, m, 0.9), { to: rb - 0.5 });
  // stabs on the kills
  for (const h of spaced(cx.hitsIn(s, 0.1).filter((h) => h.t <= rollAt && h.t > g.t(0.75)), 0.45, 3)) {
    for (const m of [74, 77, 81]) o.brass('tpt', h.t, 0.18, m, 1.0);
    for (const m of [62, 65, 69]) o.brass('hn', h.t, 0.25, m, 0.9, { sfz: true });
    o.timp(h.t, 50, 0.95);
  }
  // barrel roll: rising run, horn rip, swell into a crash
  const run = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82, 84, 86];
  run.forEach((m, k) => o.str('vln', 'spic', rollAt + ((rollEnd - rollAt) * k) / run.length, 0.09, m, 0.55 + 0.4 * (k / run.length)));
  o.brass('hn', rollAt, rollEnd - rollAt, 69, 0.9, { rip: 7, swell: 0.4 });
  o.brass('hn', rollAt, rollEnd - rollAt, 74, 0.85, { rip: 7, swell: 0.4 });
  o.swell(rollAt, rollEnd, 0.8);
  o.snareRoll(rollAt, rollEnd, 0.2, 0.8);
  o.hit(rollEnd, ch('A'), 1.0, { sus: 0.3 });
  // slide into the menace: a low C swells
  const rem = s.start + s.dur - rollEnd;
  if (rem > 0.2) {
    o.str('cb', 'trem', rollEnd + 0.15, rem, 36, 0.55, { swell: [0.3, 1] });
    o.str('vc', 'trem', rollEnd + 0.15, rem, 48, 0.5, { swell: [0.3, 1] });
  }
};

/** the Invisible Hand: tam-tam, low brass tritone motif, stopped horns, low choir */
const handRevealCue: Cue = (s, { o }) => {
  const T = (x: number) => s.start + x;
  o.tam(T(0), 0.9, 5);
  o.timp(T(0), 36, 0.95);
  o.bd(T(0), 0.8);
  const g = new Grid(s.start, s.dur / 8, 8);
  o.phrase(g, 0, VILLAIN, (t, d, m) => o.brass('tbn', t, d * 0.98, m, 0.72));
  o.phrase(g, 0, VILLAIN, (t, d, m) => o.brass('tuba', t, d * 0.98, m - 12, 0.65));
  o.phrase(g, 0, VILLAIN, (t, d, m) => o.brass('hn', t, d * 0.98, m + 12, 0.6, { stopped: true }));
  o.choir(T(0.2), s.dur - 0.2, 48, 0.45, 'oh', { att: 0.6 });
  o.choir(T(0.2), s.dur - 0.2, 55, 0.4, 'oh', { att: 0.6 });
  o.str('cb', 'trem', T(0), s.dur, 36, 0.55);
  o.str('vc', 'trem', T(0), s.dur, 43, 0.45);
  o.timp(g.t(4), 37, 0.55);
};

/** missiles: coiled tension, a dissonant stab when they burst, then the buzz droids scurry */
const missilesCue: Cue = (s, cx) => {
  const { o } = cx;
  const g = fit(s.start, s.dur, 150, 0.5);
  const pop = cx.hitsIn(s, 0.02).map((h) => h.t).filter((t) => t > s.start + 0.5).sort((a, b) => a - b)[0] ?? s.start + s.dur * 0.47;
  const pb = (pop - g.t0) / g.beat;
  for (let b = 0; b < pb; b += b < pb * 0.5 ? 0.5 : 0.25) o.str('vc', 'colleg', g.t(b), 0.05, 48, 0.4 + 0.4 * (b / pb));
  for (const m of [72, 73]) o.str('vln', 'trem', s.start, pop - s.start, m, 0.5, { swell: [0.2, 1] });
  o.str('cb', 'trem', s.start, pop - s.start, 36, 0.5, { swell: [0.4, 1] });
  o.timpRoll(s.start + 0.2, pop, 36, 0.15, 0.7);
  o.swell(pop - 0.9, pop, 0.7);
  // the burst
  for (const m of [60, 63, 67, 73]) o.brass('hn', pop, 0.5, m, 1.0, { sfz: true, stopped: true });
  for (const m of [72, 73, 79]) o.brass('tpt', pop, 0.25, m, 1.0);
  for (const m of [48, 49]) o.brass('tbn', pop, 0.4, m, 0.95);
  o.timp(pop, 36, 1.0);
  o.crash(pop, 0.8, 2);
  // buzz droids: chromatic scurry in xylophone and pizzicato
  for (let k = 0; pb + 0.5 + k * 0.25 < g.beats; k++) {
    const t = g.t(pb + 0.5 + k * 0.25);
    const m = BUZZ[k % BUZZ.length];
    o.bell('xylo', t, m + 12, 0.55);
    if (k % 2 === 0) o.str('vln', 'pizz', t, 0.1, m, 0.5);
    if (k % 4 === 0) o.str('vc', 'colleg', t, 0.05, 48, 0.5);
  }
};

/** buzz droids at work: comic menace, then R4 loses her head */
const buzzCloseCue: Cue = (s, cx) => {
  const { o } = cx;
  const g = fit(s.start, s.dur, 150, 0.5);
  const popT = cx.hitsIn(s, 0.01).map((h) => h.t).sort((a, b) => a - b)[0] ?? s.start + Math.min(2.55, s.dur * 0.57);
  const pb = (popT - g.t0) / g.beat;
  for (let k = 0; k * 0.25 < pb - 0.1; k++) {
    const t = g.t(k * 0.25);
    const m = BUZZ[(k + 3) % BUZZ.length];
    if (k % 2 === 0) o.bell('xylo', t, m + 12, 0.45);
    if (k % 2 === 1) o.str('vln', 'pizz', t, 0.1, m, 0.42);
    if (k % 4 === 0) o.wind('bsn', t, g.beat * 0.4, m - 24, 0.6, true);
    if (k % 4 === 2) o.str('vc', 'colleg', t, 0.05, 48, 0.45);
  }
  for (const m of [60, 61, 66]) o.brass('hn', s.start + 0.2, popT - s.start - 0.2, m, 0.6, { stopped: true, swell: 0.2 });
  // the pop: comic stab, xylophone tumble, a plunger fall
  for (const m of [60, 66, 72]) o.brass('tpt', popT, 0.15, m, 0.9);
  o.crash(popT, 0.6, 1.2);
  o.wb(popT + 0.12, 0.8, 900);
  [84, 81, 78, 75, 72, 69].forEach((m, k) => o.bell('xylo', popT + 0.1 + k * 0.05, m, 0.6));
  o.brass('tbn', popT + 0.25, 0.55, 55, 0.75, { wah: true, fall: 5, players: 1 });
  // agitation builds toward Obi-Wan's line
  const rest = s.start + s.dur - (popT + 0.5);
  if (rest > 0.3) {
    for (const m of [63, 66, 70]) o.str('vln', 'trem', popT + 0.5, rest, m, 0.5, { swell: [0.3, 0.9] });
    o.str('cb', 'trem', popT + 0.5, rest, 39, 0.5, { swell: [0.3, 1] });
    o.timpRoll(popT + 0.6, s.start + s.dur, 39, 0.2, 0.6);
  }
};

/** the rescue: E♭ major surge, a stab for the blasted droid, R2's sparkle, a proud cadence */
const rescueCue: Cue = (s, cx) => {
  const { o } = cx;
  const g = fit(s.start, s.dur, 150, 0.5);
  const harm = harmBars(['Eb', 'Ab', 'Cm', 'Bb']);
  o.hit(g.t(0), ch('Eb'), 1.05, { sus: 0.4 });
  const zapAt = s.start + Math.min(2.0, s.dur * 0.5);
  const zb = (zapAt - g.t0) / g.beat;
  o.bed(g, 0, zb, harm, { v: 0.85, brass: false, lo: 63 });
  o.phrase(g, 0, tr(HEAD, 1), (t, d, m) => o.brass('hn', t, d * 0.97, m, 1.0), { to: zb });
  o.phrase(g, 0, tr(HEAD, 13), (t, d, m) => o.brass('tpt', t, d * 0.95, m, 0.95), { to: zb });
  o.phrase(g, 0, tr(HEAD, 13), (t, d, m) => o.str('vln', 'leg', t, d, m, 0.75, { att: 0.03 }), { to: zb });
  for (const h of cx.hitsIn(s, 0.05).slice(0, 1)) {
    if (h.t > zapAt) continue;
    for (const m of [70, 75, 79]) o.brass('tpt', h.t, 0.2, m, 1.0);
    o.timp(h.t, 51, 1.0);
    o.crash(h.t, 0.6, 1.5);
  }
  // R2's moment: celesta and glockenspiel sparkle, pizzicato
  [75, 79, 82, 87, 91, 94].forEach((m, k) => o.bell(k % 2 ? 'glock' : 'cel', zapAt + k * 0.07, m, 0.65));
  [63, 67, 70, 75].forEach((m, k) => o.str('vln', 'pizz', zapAt + 0.3 + k * 0.1, 0.1, m, 0.6));
  // proud cadence B♭ → E♭
  const cad = s.start + Math.min(2.8, s.dur * 0.7);
  for (const m of voicing(ch('Bb'), 58, 4)) o.brass('hn', cad - 0.35, 0.3, m, 0.8);
  o.hit(cad, ch('Eb'), 0.95, { crash: true, sus: 0.6 });
  // pickup into the approach
  o.timpRoll(s.start + s.dur - 0.6, s.start + s.dur, 36, 0.2, 0.6);
  o.snareRoll(s.start + s.dur - 0.6, s.start + s.dur, 0.1, 0.5);
};

/** into the hangar: a rising chromatic build that peaks on the crash landing */
function buildUp(o: Orch, t0: number, t1: number): void {
  const g = fit(t0, t1 - t0, 150, 0.5);
  const seq = ['Cm', 'Db', 'Dm', 'Eb', 'Em', 'F', 'F#m', 'G'];
  const harm = (b: number): Chord => ch(seq[Math.min(seq.length - 1, Math.floor((b / g.beats) * seq.length))]);
  o.bed(g, 0, g.beats, harm, { v: 0.8, brass: false, snare: false });
  for (let k = 0; k < seq.length; k++) {
    const b = (k * g.beats) / seq.length;
    const c = ch(seq[k]);
    const dd = (g.beats / seq.length) * g.beat;
    const v = 0.55 + 0.45 * (k / seq.length);
    for (const m of voicing(c, 55, 4)) o.brass('hn', g.t(b), dd * 0.9, m, v);
    for (const m of voicing(c, 45, 3, 1)) o.brass('tbn', g.t(b), dd * 0.8, m, v * 0.9);
    for (const m of voicing(c, 67, 3)) o.str('vln', 'trem', g.t(b), dd, m, v * 0.8);
    if (k >= seq.length / 2) for (const m of voicing(c, 62, 3)) o.choir(g.t(b), dd, m, v * 0.8, 'ah', { att: 0.1, rel: 0.2 });
  }
  const dur = t1 - t0;
  o.snareRoll(t0, t1, 0.15, 1.0);
  o.timpRoll(t0 + dur * 0.5, t1, 43, 0.3, 1.0);
  o.swell(t0 + dur * 0.45, t1, 0.95);
  // trumpets shout the head over the last bars
  o.phrase(g, g.beats - 4, tr(slice(HEAD, 0, 3), 17), (t, d, m) => o.brass('tpt', t, d, m, 1.0));
}

const hangarApproachCue: Cue = () => undefined;

/** crash landing: the build lands on a tutti hit, then a smug little tune for Anakin's perfect landing */
const landingCue: Cue = (s, cx) => {
  const { o } = cx;
  const crashT = cx.hitsIn(s, 0.02).map((h) => h.t).sort((a, b) => a - b)[0] ?? s.start + Math.min(1.05, s.dur * 0.2);
  const ha = cx.prev(s);
  const buildFrom = ha && ha.name === 'hangar-approach' ? ha.start : s.start;
  buildUp(o, buildFrom, crashT);
  o.hit(crashT, ch('Dmb9'), 1.15, { tam: true, sus: 0.6 });
  o.taiko(crashT, 1.0, 0.8);
  // skid: a low tremolo holds its breath
  const comic = s.start + Math.min(2.2, s.dur * 0.44);
  o.str('cb', 'trem', crashT + 0.3, comic - crashT - 0.2, 38, 0.35, { swell: [0.9, 0.3] });
  // the smug tune (F major, pizzicato + bassoon + glockenspiel)
  const land = s.start + Math.min(4.4, s.dur * 0.88);
  const g = fit(comic, land - comic, 124, 0.5);
  const tune: Phrase = [[53, 0, 0.5], [57, 0.5, 0.5], [60, 1, 0.5], [57, 1.5, 0.5], [53, 2, 0.5], [48, 3, 0.5], [53, 3.5, 0.5]];
  o.phrase(g, 0, tune, (t, d, m) => o.wind('bsn', t, d * 0.6, m - 12, 0.7, true));
  o.phrase(g, 0, tune, (t, d, m) => o.str('vc', 'pizz', t, d, m - 12, 0.7));
  o.phrase(g, 0, tune, (t, d, m) => o.wind('cl', t, d * 0.5, m + 12, 0.45, true));
  for (let b = 0; b < g.beats; b += 1) o.str('vla', 'pizz', g.t(b + 0.5), 0.1, b % 2 ? 60 : 57, 0.45);
  // touchdown: ta-da
  for (const m of [65, 69, 72]) o.str('vln', 'pizz', land, 0.1, m, 0.75);
  o.bell('glock', land, 89, 0.75);
  o.bell('glock', land + 0.12, 96, 0.6);
  o.brass('hn', land, 0.5, 65, 0.55);
  o.brass('hn', land, 0.5, 69, 0.5);
};

/**
 * Both Jedi flip out of their fighters, on the picture's timings (seconds into the shot): a harp flick
 * for the canopies, a violin run through Obi-Wan's flip and a pizzicato landing, a horn rip through
 * Anakin's and a brass ta-da when he lands, then a sly clarinet walks down into the droids' G.
 */
const jumpOutCue: Cue = (s, { o }) => {
  const T = (x: number) => s.start + Math.min(x, s.dur);
  const FLIP = JUMP_OUT.flip, OBI = JUMP_OUT.obi, ANA = JUMP_OUT.ana;
  const obiLand = T(OBI + FLIP), anaLand = T(ANA + FLIP);
  [74, 78, 81, 86].forEach((m, k) => o.harp(T(0.02) + k * 0.03, m, 0.5));
  const run = [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81];
  const r0 = T(OBI + 0.05), r1 = obiLand - 0.06;
  run.forEach((m, k) => o.str('vln', 'spic', r0 + ((r1 - r0) * k) / run.length, 0.08, m, 0.5 + 0.3 * (k / run.length)));
  for (const m of [57, 62, 66]) o.str(m < 60 ? 'vla' : 'vln', 'pizz', obiLand, 0.1, m, 0.7);
  o.str('vc', 'pizz', obiLand, 0.1, 50, 0.7);
  o.bell('glock', obiLand, 86, 0.6);
  o.wb(obiLand, 0.5, 1300);
  const h0 = T(ANA + 0.1), hd = Math.max(0.2, anaLand - h0 - 0.2);
  o.brass('hn', h0, hd, 69, 0.72, { rip: 7, swell: 0.4 });
  o.brass('hn', h0, hd, 74, 0.68, { rip: 7, swell: 0.4 });
  o.swell(T(ANA + 0.2), anaLand, 0.55);
  o.snareRoll(anaLand - 0.5, anaLand - 0.03, 0.15, 0.6);
  for (const m of [69, 73, 76]) o.brass('tpt', anaLand - 0.14, 0.11, m, 0.85);
  for (const m of [74, 78, 81]) o.brass('tpt', anaLand, 0.6, m, 0.95);
  for (const m of [62, 66, 69, 74]) o.brass('hn', anaLand, 0.75, m, 0.8);
  o.brass('tbn', anaLand, 0.6, 50, 0.75);
  o.brass('tuba', anaLand, 0.6, 38, 0.7);
  o.timp(anaLand, 50, 0.85);
  o.crash(anaLand, 0.5, 2);
  o.bell('glock', anaLand, 86, 0.65);
  o.bell('glock', anaLand + 0.12, 93, 0.55);
  const tail = anaLand + 0.7, end = s.start + s.dur;
  if (end - tail > 0.4) {
    for (const m of [62, 66, 69]) o.str(m < 64 ? 'vla' : 'vln', 'leg', tail - 0.1, end - tail + 0.1, m, 0.35, { att: 0.2, swell: [1, 0.6] });
    o.str('vc', 'leg', tail - 0.1, end - tail + 0.1, 50, 0.35, { att: 0.2 });
    const step = (end - tail) / 4;
    [74, 72, 71, 69].forEach((m, k) => o.wind('cl', tail + k * step, step * 0.9, m, 0.45, k < 3));
  }
};

/** "Flying is for droids": dry wit, the droid march, saber ignitions, and the "Uh oh" stinger */
const droidsCue: Cue = (s, { o }) => {
  const T = (x: number) => s.start + x;
  const lines = s.lines;
  const cut = Math.min(2.4, s.dur * 0.46);
  // dry wit under Obi-Wan
  const g1 = fit(s.start, cut, 120, 0.5);
  for (let b = 0; b < g1.beats; b += 1) {
    o.str('vc', 'pizz', g1.t(b), 0.1, b % 2 ? 50 : 43, 0.45);
    o.str('vla', 'pizz', g1.t(b + 0.5), 0.1, b % 2 ? 62 : 59, 0.35);
  }
  o.phrase(g1, 0.5, [[67, 0, 0.5], [71, 0.5, 0.5], [74, 1, 0.5], [71, 1.5, 0.5], [67, 2, 1]], (t, d, m) => o.wind('cl', t, d * 0.5, m, 0.35, true));
  // the droid line: sneaky bassoon march
  const ign = T(Math.min(2.9, s.dur * 0.56));
  const uh = lines.length > 1 ? T(lines[1].s0) : T(s.dur * 0.71);
  const g2 = fit(T(cut), uh - T(cut), 132, 0.5);
  o.phrase(g2, 0, DROID, (t, d, m) => o.wind('bsn', t, d * 0.8, m, 0.75, true));
  o.phrase(g2, 0, DROID, (t, d, m) => o.str('cb', 'pizz', t, d, m, 0.6));
  for (let b = 0; b < g2.beats; b += 1) o.wb(g2.t(b), 0.35, b % 2 ? 1500 : 1150);
  // sabers: horns and trumpets swell, a light crash on the second ignition
  for (const m of [62, 66, 69]) o.brass('hn', ign - 0.25, uh - ign - 0.05, m, 0.8, { swell: 0.2 });
  for (const m of [74, 78]) o.brass('tpt', ign + 0.05, uh - ign - 0.15, m, 0.7, { swell: 0.3 });
  o.swell(ign - 0.5, ign + 0.1, 0.6);
  o.crash(ign + 0.1, 0.5, 1.6);
  o.timp(ign + 0.1, 50, 0.7);
  // "Uh oh": a stab just before it, a plunger-muted groan right after it, both inside the shot
  for (const m of [59, 62, 65, 68]) o.brass('hn', uh - 0.08, 0.2, m, 0.8, { sfz: true });
  o.timp(uh - 0.08, 43, 0.8);
  o.wb(uh - 0.08, 0.7, 800);
  const end = s.start + s.dur;
  const after = Math.min(lines.length > 1 ? T(lines[1].s1) + 0.05 : uh + 0.8, end - 0.6);
  o.brass('tbn', after, 0.22, 55, 0.7, { wah: true, players: 1 });
  o.brass('tbn', after + 0.25, Math.max(0.2, Math.min(0.45, end - 0.05 - (after + 0.25))), 52, 0.7, { wah: true, fall: 2, players: 1 });
  // a drummer's lead-in to the end card, clear of the groan
  o.snareRoll(Math.max(end - 0.25, after + 0.3), end, 0.12, 0.5);
};

/**
 * Closing fanfare: the theme's cadence (ii7 – V7) lands on D, the chord swells under a timpani roll,
 * and a short tutti button rings out into the final fade.
 */
const endcardCue: Cue = (s, { o }) => {
  const dur = Math.min(s.dur, 4.5);
  const btn = s.start + Math.max(dur * 0.6, dur - 1.1);
  const tf = s.start + Math.min(1.8, (btn - s.start) * 0.52);
  const g = new Grid(s.start, (tf - s.start) / 4, 4);
  o.crash(g.t(0), 0.8);
  o.bd(g.t(0), 0.7);
  const cad = slice(CADENCE, 0, 4);
  o.phrase(g, 0, cad, (t, d, m) => o.brass('tpt', t, d * 0.95, m, 0.85));
  o.phrase(g, 0, cad, (t, d, m) => o.brass('hn', t, d * 0.97, m - 12, 0.8));
  o.phrase(g, 0, cad, (t, d, m) => o.str('vln', 'leg', t, d, m + 12, 0.65, { att: 0.03 }));
  for (const [c, b] of [['Em7', 0], ['A7', 2]] as const) {
    const cc = ch(c);
    const dd = 2 * g.beat;
    for (const m of voicing(cc, 55, 4)) o.brass('hn', g.t(b), dd * 0.95, m, 0.6);
    for (const m of voicing(cc, 45, 3, 1)) o.brass('tbn', g.t(b), dd * 0.95, m, 0.62);
    o.brass('tuba', g.t(b), dd * 0.95, bassNote(cc, 33), 0.62);
    for (const m of voicing(cc, 57, 3)) o.str('vla', 'leg', g.t(b), dd, m, 0.5);
    o.str('vc', 'leg', g.t(b), dd, bassNote(cc, 38), 0.6);
    o.str('cb', 'leg', g.t(b), dd, bassNote(cc, 26), 0.6);
    o.timp(g.t(b), bassNote(cc, 40), 0.7);
  }
  // the final chord, held to the button
  const hold = btn - tf - 0.06;
  const D = ch('D');
  o.hit(tf, D, 0.88, { crash: true, sus: 0.6 });
  for (const m of [62, 66, 69, 74, 78]) o.choir(tf, hold, m, 0.55, 'ah', { att: 0.12, rel: 0.3, swell: [0.8, 1] });
  for (const m of [74, 78, 81, 86]) o.str('vln', 'leg', tf, hold, m, 0.62, { att: 0.05, rel: 0.25, swell: [0.8, 1] });
  for (const m of [62, 66, 69]) o.str('vla', 'leg', tf, hold, m, 0.55, { att: 0.05, rel: 0.25 });
  o.str('vc', 'leg', tf, hold, 50, 0.62, { rel: 0.25 });
  o.str('cb', 'leg', tf, hold, 38, 0.6, { rel: 0.25 });
  for (const m of [69, 74, 78]) o.brass('tpt', tf + 0.02, hold, m, 0.78, { swell: 0.5 });
  for (const m of [57, 62, 66, 69]) o.brass('hn', tf + 0.02, hold, m, 0.72, { swell: 0.5 });
  o.brass('tbn', tf, hold, 50, 0.68);
  o.brass('tbn', tf, hold, 57, 0.64);
  o.brass('tuba', tf, hold, 38, 0.62);
  o.gliss(tf, tf + 0.7, D, 50, 93, 0.6);
  [86, 90, 93, 98].forEach((m, k) => o.bell('cel', tf + 0.8 + k * 0.12, m, 0.45));
  o.timpRoll(tf + hold * 0.3, btn - 0.04, 50, 0.2, 0.85);
  o.swell(tf + hold * 0.4, btn, 0.6);
  // the button: everyone on D, short, and the hall does the rest
  o.hit(btn, D, 0.92, { crash: true, sus: 0.28 });
  for (const m of [74, 86]) o.str('vln', 'marc', btn, 0.3, m, 0.8);
  o.timp(btn, 38 + 12, 0.8);
};

/** unknown shots: a dialogue underscore or a moderate action bed in the running key */
function fallback(s: CueShot, o: Orch, key: string): void {
  if (s.lines.length) return underscore(s, o, ch(key), { trem: true });
  const g = fit(s.start, s.dur, 150, 0.5);
  const c = ch(key);
  o.bed(g, 0, g.beats, () => c, { v: 0.7, brass: true });
}

const CUES: Record<string, Cue> = {
  farfar: silence,
  crawl: crawlCue,
  longtake: longtakeCue,
  track: trackCue,
  'anakin-cockpit': anakinCockpitCue,
  vultures: vulturesCue,
  'hand-reveal': handRevealCue,
  'obiwan-cockpit': obiwanCockpitCue,
  missiles: missilesCue,
  'buzz-close': buzzCloseCue,
  'obiwan-cockpit-2': obiwanCockpit2Cue,
  'anakin-cockpit-2': anakinCockpit2Cue,
  rescue: rescueCue,
  'hangar-approach': hangarApproachCue,
  landing: landingCue,
  'jump-out': jumpOutCue,
  droids: droidsCue,
  endcard: endcardCue,
};
const KEY_OF: Record<string, string> = { crawl: 'D', longtake: 'Dm', track: 'Gm', vultures: 'Dm', 'hand-reveal': 'Cm', missiles: 'Cm', 'buzz-close': 'Cm', rescue: 'Eb', landing: 'F', 'jump-out': 'D', droids: 'G', endcard: 'D' };

export async function renderScore(shots: CueShot[], hits: Hit[], dry: Stereo, send: Stereo): Promise<string[]> {
  const o = new Orch(dry.n);
  const ctx: Ctx = {
    o,
    shots,
    hits,
    hitsIn: (s, minLoud = 0) => hits.filter((h) => h.t >= s.start && h.t < s.start + s.dur && h.loud >= minLoud).sort((a, b) => b.loud - a.loud),
    next: (s) => shots[shots.indexOf(s) + 1],
    prev: (s) => shots[shots.indexOf(s) - 1],
  };
  const log: string[] = [];
  let key = 'Dm';
  for (const s of shots) {
    const known = Object.prototype.hasOwnProperty.call(CUES, s.name);
    o.floor = s.start;
    if (known) CUES[s.name](s, ctx);
    else fallback(s, o, key);
    log.push(`cue ${s.name}@${s.start.toFixed(2)}: ${known ? 'scored' : 'fallback in ' + key}`);
    key = KEY_OF[s.name] ?? key;
  }
  await o.render(dry, send);
  return log;
}
