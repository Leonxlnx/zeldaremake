import { Rng, hash1 } from '../core/rng';
import { Biquad, CR, NOISE, NOISE_MASK, SR, SVF, type Stereo, blep, clamp, sin1 } from './dsp';

/**
 * LEGO-game dialogue: wordless mumble that still sounds like speech. Each subtitle is broken into
 * syllables with vowels and consonant classes guessed from its spelling; a glottal source with
 * speaker-specific pitch runs through a four-formant filter bank (the voice's energy sits at 1–3 kHz),
 * with noise for fricatives and stop bursts, and an intonation contour from the punctuation.
 */

export interface VoiceLine {
  t0: number;
  t1: number;
  who: string;
  text: string;
  /** reverb send for this line (0 = bone dry) */
  verb?: number;
}
export interface VoiceSpan {
  t0: number;
  t1: number;
}

type Vw = 'ee' | 'ih' | 'eh' | 'ae' | 'ah' | 'aw' | 'uh' | 'oo' | 'uu' | 'er' | 'oh';
/** adult male formant targets F1–F4 in Hz */
const VF: Record<Vw, number[]> = {
  ee: [270, 2290, 3010, 3600],
  ih: [390, 1990, 2550, 3500],
  eh: [530, 1840, 2480, 3500],
  ae: [660, 1720, 2410, 3500],
  ah: [730, 1090, 2440, 3400],
  aw: [570, 840, 2410, 3300],
  uh: [640, 1190, 2390, 3400],
  oo: [300, 870, 2240, 3300],
  uu: [440, 1020, 2240, 3300],
  er: [490, 1350, 1690, 3300],
  oh: [500, 900, 2350, 3300],
};

/** p voiceless stop, b voiced stop, s/z sibilants, sh, f weak fricative, h aspirate, m nasal, l r w y approximants */
type Cons = 'p' | 'b' | 's' | 'z' | 'sh' | 'f' | 'h' | 'm' | 'l' | 'r' | 'w' | 'y';
const LETTER: Record<string, Cons> = {
  p: 'p', t: 'p', k: 'p', c: 'p', q: 'p', x: 's', b: 'b', d: 'b', g: 'b', s: 's', z: 'z', j: 'sh', f: 'f', v: 'f',
  h: 'h', m: 'm', n: 'm', l: 'l', r: 'r', w: 'w', y: 'y',
};
const APPROX: Record<string, number[]> = {
  m: [260, 1000, 2200, 3300],
  l: [360, 1050, 2700, 3400],
  r: [420, 1100, 1550, 3200],
  w: [300, 700, 2200, 3300],
  y: [280, 2200, 2900, 3500],
};
const CONS_DUR: Record<Cons, number> = { p: 0.055, b: 0.045, s: 0.075, z: 0.065, sh: 0.075, f: 0.06, h: 0.045, m: 0.05, l: 0.04, r: 0.04, w: 0.04, y: 0.035 };

interface Syl {
  on: Cons[];
  v: Vw;
  v2?: Vw;
  co: Cons[];
  stress: boolean;
  /** pause after this syllable (end of word / punctuation), seconds */
  gap: number;
  /** phrase-final contour: '.', '!', '?', ',' or '' */
  end: string;
}

const FUNCTION_WORDS = new Set(['the', 'a', 'an', 'is', 'of', 'for', 'to', 'in', 'with', 'and', 'you', 'it', 'can', 'do', 'be', 'am', 'are', 'was', 'on', 'at', 'there', 'here', 'have', 'this', 'that', 'im', 'i']);
const UNSTRESSED_PREFIX = /^(a|be|com|con|with|re|de|un)/;

function consClasses(cl: string): Cons[] {
  const out: Cons[] = [];
  for (let i = 0; i < cl.length; i++) {
    const c = cl[i], n = cl[i + 1];
    let k: Cons | undefined;
    if ((c === 's' || c === 'c') && n === 'h') k = 'sh';
    else if ((c === 't' || c === 'p') && n === 'h') k = 'f';
    else if (c === 'w' && n === 'h') k = 'w';
    else if (c === 'n' && n === 'g') k = 'm';
    else if (c === 'c' && n === 'k') k = 'p';
    if (k) i++;
    else k = LETTER[c];
    if (k && out[out.length - 1] !== k) out.push(k);
  }
  return out;
}

function vowelOf(g: string, long: boolean, next: string, only: boolean): [Vw, Vw?] {
  const two: Record<string, [Vw, Vw?]> = {
    ee: ['ee'], ea: ['ee'], ie: ['ee'], ey: ['eh', 'ee'], oo: ['oo'], ou: ['ah', 'uu'], ow: ['ah', 'uu'], oi: ['aw', 'ee'], oy: ['aw', 'ee'],
    ai: ['eh', 'ee'], ay: ['eh', 'ee'], ei: ['eh', 'ee'], au: ['aw'], aw: ['aw'], oa: ['oh', 'uu'], oe: ['oh', 'uu'], ui: ['oo'], ue: ['oo'], ew: ['oo'],
  };
  if (two[g.slice(0, 2)]) return two[g.slice(0, 2)];
  const c = g[0];
  if (next === 'r' && !long) return c === 'a' ? ['ah'] : c === 'o' ? ['aw'] : ['er'];
  switch (c) {
    case 'a':
      return long ? ['eh', 'ee'] : ['ae'];
    case 'e':
      return long ? ['ee'] : ['eh'];
    case 'i':
      return long ? ['ah', 'ee'] : ['ih'];
    case 'o':
      return long ? ['oh', 'uu'] : ['aw'];
    case 'u':
      return long ? ['oo'] : ['uh'];
    default:
      return only ? ['ah', 'ee'] : ['ee'];
  }
}

const SPECIAL: Record<string, [Vw, Vw?]> = { i: ['ah', 'ee'], im: ['ah', 'ee'], the: ['uh'], a: ['uh'], to: ['oo'], do: ['oo'], you: ['oo'], oh: ['oh', 'uu'], uh: ['uh'] };

/** spelling → syllables (a rough English guess; it only has to feel like speech) */
function wordSyllables(raw: string): Omit<Syl, 'gap' | 'end'>[] {
  let w = raw.toLowerCase().replace(/[’]/g, "'");
  let tailS = false;
  if (w.endsWith("'s")) {
    w = w.slice(0, -2);
    tailS = true;
  }
  w = w.replace(/[^a-z]/g, '');
  if (!w) return [];
  const isV = (i: number): boolean => 'aeiou'.includes(w[i]) || (w[i] === 'y' && i > 0 && !'aeiou'.includes(w[i - 1]));
  const groups: { a: number; b: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    if (!isV(i)) continue;
    const last = groups[groups.length - 1];
    const yBreak = w[i - 1] === 'y' && last && last.b === i && last.a === i - 1;
    if (last && last.b === i && !yBreak) last.b = i + 1;
    else groups.push({ a: i, b: i + 1 });
  }
  if (!groups.length) groups.push({ a: Math.floor(w.length / 2), b: Math.floor(w.length / 2) + 1 });
  let magic = false;
  const lg = groups[groups.length - 1];
  if (groups.length > 1 && lg.a === w.length - 1 && w[lg.a] === 'e' && !w.endsWith('le')) {
    groups.pop();
    magic = true;
  }
  const n = groups.length;
  const out: Omit<Syl, 'gap' | 'end'>[] = [];
  for (let k = 0; k < n; k++) {
    const g = groups[k];
    const before = w.slice(k === 0 ? 0 : groups[k - 1].b, g.a);
    const after = k === n - 1 ? w.slice(g.b) : '';
    let on = consClasses(before);
    if (k > 0 && on.length >= 2) {
      out[k - 1].co.push(on[0]);
      on = on.slice(1);
    }
    const long = magic && k === n - 1;
    const special = n === 1 ? SPECIAL[w] : undefined;
    const [v, v2] = special ?? vowelOf(w.slice(g.a, g.b), long, w[g.b] ?? '', n === 1);
    const co = consClasses(after);
    if (tailS && k === n - 1) co.push('s');
    out.push({ on: on.slice(-2), v, v2, co: co.slice(0, 2), stress: false });
  }
  if (n === 1) out[0].stress = !FUNCTION_WORDS.has(w);
  else out[UNSTRESSED_PREFIX.test(w) && n > 1 ? 1 : 0].stress = true;
  return out;
}

function syllabify(text: string): Syl[] {
  const out: Syl[] = [];
  for (const tok of text.split(/\s+/)) {
    const punct = tok.replace(/[A-Za-z'’]/g, '');
    const ss = wordSyllables(tok);
    const endCh = /[.]/.test(punct) ? '.' : /!/.test(punct) ? '!' : /\?/.test(punct) ? '?' : /[,;:—–-]/.test(punct) ? ',' : '';
    const gap = endCh === '.' || endCh === '!' || endCh === '?' ? 0.24 : /[—–-]/.test(punct) ? 0.2 : endCh === ',' ? 0.14 : 0.025;
    if (!ss.length) {
      if (out.length && endCh) {
        out[out.length - 1].gap = Math.max(out[out.length - 1].gap, gap);
        out[out.length - 1].end ||= endCh;
      }
      continue;
    }
    ss.forEach((s, i) => out.push({ ...s, gap: i === ss.length - 1 ? gap : 0, end: i === ss.length - 1 ? endCh : '' }));
  }
  return out;
}

interface Speaker {
  f0: number;
  formant: number;
  breath: number;
  excursion: number;
  droid: boolean;
  rate: number;
}
function speaker(who: string): Speaker {
  if (/^anakin/i.test(who)) return { f0: 138, formant: 1.0, breath: 0.05, excursion: 1.15, droid: false, rate: 1 };
  if (/^obi/i.test(who)) return { f0: 112, formant: 0.94, breath: 0.04, excursion: 1.22, droid: false, rate: 1 };
  if (/droid/i.test(who)) return { f0: 236, formant: 1.2, breath: 0, excursion: 1.12, droid: true, rate: 0.9 };
  const h = hash1(who.length * 31 + who.charCodeAt(0));
  return { f0: 110 + 50 * h, formant: 0.95 + 0.1 * h, breath: 0.04, excursion: 1.15, droid: false, rate: 1 };
}

/** one control-rate target segment of the utterance */
interface Seg {
  a: number;
  b: number;
  av: number;
  F: number[];
  nasal: boolean;
  /** aspiration through the formants */
  asp: number;
  /** fricative / burst noise: level, centre frequency, Q */
  fn: number;
  ff: number;
  fq: number;
  f0a: number;
  f0b: number;
}

function plan(line: VoiceLine, sp: Speaker, rng: Rng): Seg[] {
  const syl = syllabify(line.text);
  if (!syl.length) return [];
  const nominal = (s: Syl): number => (s.stress ? 0.2 : 0.13) * (s.end ? 1.35 : 1) + s.on.reduce((a, c) => a + CONS_DUR[c], 0) + s.co.reduce((a, c) => a + CONS_DUR[c], 0);
  const total = syl.reduce((a, s, i) => a + nominal(s) + (i < syl.length - 1 ? s.gap : 0), 0);
  const w0 = line.t0 + 0.05, w1 = Math.max(w0 + 0.4, line.t1 - 0.3);
  const k = clamp((w1 - w0) / total, 0.55, 1.6) * sp.rate;
  const excl = /!/.test(line.text);
  const base = sp.f0 * (excl ? 1.12 : 1);
  const segs: Seg[] = [];
  let t = w0;
  let phraseStart = 0;
  syl.forEach((s, i) => {
    const pos = (i - phraseStart) / Math.max(1, syl.length - phraseStart);
    const decl = 1.08 - 0.18 * pos;
    let fa = base * decl * (s.stress ? sp.excursion : 0.97) * rng.range(0.96, 1.04);
    let fb = fa * 0.95;
    if (s.end === '.') fb = fa * 0.8;
    else if (s.end === '!') {
      fa *= 1.1;
      fb = fa * 0.78;
    } else if (s.end === '?') fb = fa * 1.3;
    else if (s.end === ',') fb = fa * 1.04;
    const F = VF[s.v];
    const scale = (f: number[]): number[] => f.map((x) => x * sp.formant);
    const push = (d: number, o: Partial<Seg>): void => {
      segs.push({ a: t, b: t + d, av: 0, F: scale(F), nasal: false, asp: 0, fn: 0, ff: 3000, fq: 1, f0a: fa, f0b: fa, ...o });
      t += d;
    };
    const cons = (c: Cons, coda: boolean): void => {
      const d = CONS_DUR[c] * k;
      switch (c) {
        case 'p':
          push(d * 0.6, { av: 0 });
          push(d * 0.4, { fn: coda ? 0.18 : 0.45, ff: rng.range(1600, 4200), fq: 1.2, asp: coda ? 0 : 0.15 });
          break;
        case 'b':
          push(d * 0.6, { av: 0.12, F: scale([250, 900, 2300, 3300]) });
          push(d * 0.4, { av: 0.4, fn: 0.2, ff: rng.range(1200, 2800), fq: 1.2 });
          break;
        case 's':
        case 'z':
          push(d, { av: c === 'z' ? 0.3 : 0, fn: 0.32, ff: 5600, fq: 1.6 });
          break;
        case 'sh':
          push(d, { fn: 0.4, ff: 2700, fq: 1.8 });
          break;
        case 'f':
          push(d, { fn: 0.12, ff: 4500, fq: 0.6 });
          break;
        case 'h':
          push(d, { asp: 0.35 });
          break;
        default:
          push(d, { av: c === 'm' ? 0.55 : 0.7, F: scale(APPROX[c]), nasal: c === 'm' });
      }
    };
    for (const c of s.on) cons(c, false);
    const vd = (s.stress ? 0.2 : 0.13) * (s.end ? 1.35 : 1) * k;
    const amp = s.stress ? 1 : 0.78;
    if (s.v2) {
      push(vd * 0.5, { av: amp, f0a: fa, f0b: (fa + fb) / 2 });
      push(vd * 0.5, { av: amp * 0.95, F: scale(VF[s.v2]), f0a: (fa + fb) / 2, f0b: fb });
    } else push(vd, { av: amp, f0a: fa, f0b: fb });
    for (const c of s.co) cons(c, true);
    if (i < syl.length - 1) {
      const g = s.gap * k;
      if (g > 0.001) push(g, { av: 0 });
    }
    if (s.end && s.end !== ',') phraseStart = i + 1;
  });
  return segs;
}

/** render one line (mono); data starts at sample i0 and is already levelled */
function renderLine(line: VoiceLine, total: number, rng: Rng): { i0: number; data: Float32Array; span: VoiceSpan } | null {
  const sp = speaker(line.who);
  const segs = plan(line, sp, rng);
  if (!segs.length) return null;
  const tA = segs[0].a, tB = segs[segs.length - 1].b;
  const i0 = Math.max(0, Math.floor((tA - 0.02) * SR));
  const i1 = Math.min(total, Math.ceil((tB + 0.12) * SR));
  const n = i1 - i0;
  if (n <= 0) return null;
  const tmp = new Float32Array(n);
  const F = [0, 1, 2, 3].map(() => new SVF(1000, 5));
  const BW = [90, 110, 170, 250];
  const G = [1, 1.2, 0.85, 0.4];
  const fr = new SVF(3000, 1);
  const hp = new SVF(380, 0.7), lp = new SVF(3600, 0.7);
  const cur = { av: 0, asp: 0, fn: 0, F: [...segs[0].F], f0: segs[0].f0a, nas: 0 };
  const kF = 1 - Math.exp(-CR / (0.016 * SR)), kA = 1 - Math.exp(-CR / (0.006 * SR)), kP = 1 - Math.exp(-CR / (0.03 * SR));
  let ph = rng.next();
  let nz = rng.int(0, NOISE_MASK);
  let jit = 0;
  let si = 0;
  for (let b = 0; b < n; b += CR) {
    const T = (i0 + b) / SR;
    while (si < segs.length - 1 && T >= segs[si].b) si++;
    const s = segs[si];
    const inside = T >= s.a && T < s.b;
    const x = inside ? (T - s.a) / (s.b - s.a) : 1;
    const tav = inside ? s.av : 0;
    const f0t = s.f0a + (s.f0b - s.f0a) * x;
    const av0 = cur.av, asp0 = cur.asp, fn0 = cur.fn;
    cur.av += (tav - cur.av) * kA;
    cur.asp += ((inside ? s.asp : 0) - cur.asp) * kA;
    cur.fn += ((inside ? s.fn : 0) - cur.fn) * kA;
    cur.nas += ((s.nasal ? 1 : 0) - cur.nas) * kF;
    for (let q = 0; q < 4; q++) {
      cur.F[q] += (s.F[q] - cur.F[q]) * kF;
      F[q].set(cur.F[q], cur.F[q] / BW[q]);
    }
    jit += (rng.range(-1, 1) * 0.004 - jit) * 0.3;
    cur.f0 += (f0t - cur.f0) * kP;
    fr.set(s.ff, s.fq);
    const dt = (cur.f0 * (1 + jit)) / SR;
    const g2 = 1 - 0.65 * cur.nas;
    const e = Math.min(CR, n - b);
    for (let i = 0; i < e; i++) {
      const u = i / CR;
      const av = av0 + (cur.av - av0) * u, asp = asp0 + (cur.asp - asp0) * u, fn = fn0 + (cur.fn - fn0) * u;
      ph += dt;
      if (ph >= 1) ph -= 1;
      let src: number;
      if (sp.droid) {
        let q = ph + 0.5;
        if (q >= 1) q -= 1;
        src = (2 * ph - 1 - blep(ph, dt) - (2 * q - 1 - blep(q, dt))) * 0.6;
      } else src = 2 * ph - 1 - blep(ph, dt);
      const nzv = NOISE[nz++ & NOISE_MASK];
      const exc = src * av + nzv * (sp.breath * av + asp);
      // alternating signs keep the valleys between parallel formants shallow, as in a cascade
      let y = F[0].bp(exc) * G[0] + (F[2].bp(exc) * G[2] - F[1].bp(exc) * G[1] - F[3].bp(exc) * G[3]) * g2;
      y += fr.bp(nzv) * fn;
      if (sp.droid) y = lp.lp(hp.hp(y * (0.55 + 0.45 * sin1(40 * ((i0 + b + i) / SR)))));
      tmp[b + i] = y;
    }
  }
  // dialogue EQ for small speakers: no chest rumble, presence where intelligibility lives
  for (const f of [Biquad.highpass(110), Biquad.peak(2300, 0.9, 4), Biquad.highshelf(4500, 2, 0.8)]) f.run(tmp);
  // level every line to the same active speech level (mean power of the 20 ms windows within 25 dB of the loudest)
  const win = Math.round(0.02 * SR);
  const pw: number[] = [];
  for (let a = 0; a + win <= n; a += win) {
    let e2 = 0;
    for (let i = a; i < a + win; i++) e2 += tmp[i] * tmp[i];
    pw.push(e2 / win);
  }
  const top = Math.max(0, ...pw);
  const act = pw.filter((p) => p > top * 0.00316);
  const rms = Math.sqrt(act.reduce((a, p) => a + p, 0) / Math.max(1, act.length));
  const g = rms > 1e-7 ? 0.12 / rms : 0;
  for (let i = 0; i < n; i++) tmp[i] *= g * Math.min(1, i / 64, (n - i) / 256);
  return { i0, data: tmp, span: { t0: tA, t1: tB } };
}

/** where a line's speech will sound, from the syllable plan alone (timing never depends on the random stream) */
export function speechSpan(line: VoiceLine): VoiceSpan | null {
  const segs = plan(line, speaker(line.who), new Rng(1));
  return segs.length ? { t0: segs[0].a, t1: segs[segs.length - 1].b } : null;
}

/** render every line into a mono buffer (plus an optional stereo reverb send); returns where speech actually sounds */
export function renderVoices(lines: VoiceLine[], out: Float32Array, send?: Stereo): VoiceSpan[] {
  const spans: VoiceSpan[] = [];
  const rng = new Rng(3131);
  lines.forEach((l, i) => {
    const r = renderLine(l, out.length, rng.fork(i + 1));
    if (!r) return;
    const vs = l.verb ?? 0;
    for (let k = 0; k < r.data.length; k++) out[r.i0 + k] += r.data[k];
    if (send && vs > 0) {
      for (let k = 0; k < r.data.length; k++) {
        send.L[r.i0 + k] += r.data[k] * vs;
        send.R[r.i0 + k] += r.data[k] * vs;
      }
    }
    spans.push(r.span);
  });
  return spans;
}
