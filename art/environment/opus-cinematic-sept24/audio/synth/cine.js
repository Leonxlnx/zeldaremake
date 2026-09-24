/**
 * Kokiri Forest cinematic (opus-cinematic-sept24): ORIGINAL offline sound design.
 *
 * Runs in a blank headless Chrome page (no world, no GPU) inside an OfflineAudioContext. The game's
 * own modules (src/audio/{graph,ambience,footsteps,music}.ts, transpiled unchanged by
 * render-audio.mjs) supply the wind bed, the footstep voices, the shared wood reverb and the score
 * "Under the Boughs". Everything else here is new synthesis written for this cut, sample by sample
 * in plain JS from seeded streams (no recordings, no downloads, no Math.random):
 *
 *   birds    species-shaped songs: blackbird warble + squeaky coda, robin, chiffchaff two-note,
 *            wren segment/trill, great tit "tea-cher", chaffinch run + flourish, song thrush
 *            repeats, goldcrest cycles, contact chips, wood-pigeon five-note coo, great spotted
 *            woodpecker drum (modal knocks). Each call is placed with distance (level, air
 *            absorption low-pass, direct/reverberant ratio), pan and interaural delay, into an
 *            original stereo "forest" impulse response. A seeded far chorus fills the depth.
 *   bed      the game ambience (continuous canopy + hush only, driven by a designed gust curve)
 *            plus non-looping high-canopy air, canopy body, near-leaf shimmer, a deep forest
 *            room tone and a far air wash, all riding irregular envelopes (no LFOs, no tones),
 *            and gust-coupled leaf-rustle grain clusters.
 *   detail   pod-lantern flame (breath + husk + crackle/pops) and macro leaf ticks.
 *   steps    the game's footstep voices at the supplied contact times + cloth/gear foley.
 *   music    the game score, trimmed so phrase B's high G lands on the cue, with gain/low-pass
 *            automation for the rise, plus an original harp glissando, swell and low bloom.
 */
import { createRng, createBuses, gain } from './src/audio/graph.js';
import { createAmbience } from './src/audio/ambience.js';
import { createFootsteps } from './src/audio/footsteps.js';
import { createMusic } from './src/audio/music.js';

const SR = 48000;
const TAU = Math.PI * 2;
const BEAT = 60 / 76;
/** control-rate tables (Hz) */
const CR = 200;

// ---------------------------------------------------------------------------------------------
// small DSP kit
// ---------------------------------------------------------------------------------------------
class Biquad {
  constructor(type, f, q = 0.707, db = 0) {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(type, f, q, db);
  }
  set(type, f, q = 0.707, db = 0) {
    const w = (TAU * Math.min(Math.max(f, 5), SR * 0.475)) / SR;
    const cs = Math.cos(w);
    const sn = Math.sin(w);
    const al = sn / (2 * q);
    const A = Math.pow(10, db / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
      case 'peak': b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
      case 'hs': {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s);
        a0 = A + 1 - (A - 1) * cs + s; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
        break;
      }
      default: throw new Error(`biquad ${type}`);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const R = (r, a, b) => a + (b - a) * r();
const RI = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const smooth = (x) => x * x * (3 - 2 * x);

/** Paul Kellet's pink filter on a seeded white stream (same recipe as graph.ts, never looped here) */
function pinkGen(r) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const y = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    return y;
  };
}
/** leaky-integrated white: a -6 dB/oct rumble for the forest's low room tone */
function brownGen(r) {
  let y = 0;
  return () => {
    y = (y + (r() * 2 - 1) * 0.02) * 0.9985;
    return y * 3;
  };
}

/**
 * Irregular 0..1 envelope over n context samples: a random walk smoothed twice at `hz`, normalised
 * and shaped. Nothing in the bed rides a sine LFO: a periodic wobble is what the ear locks onto.
 */
function wander(r, n, hz, shape = 1) {
  const m = Math.ceil((n / SR) * CR) + 3;
  const a = Math.exp((-TAU * hz) / CR);
  const v = new Float32Array(m);
  let l1 = 0;
  let l2 = 0;
  const warm = Math.ceil((4 * CR) / Math.max(hz, 0.02));
  for (let i = -warm; i < m; i++) {
    l1 += (r() * 2 - 1 - l1) * (1 - a);
    l2 += (l1 - l2) * (1 - a);
    if (i >= 0) v[i] = l2;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const span = hi - lo || 1;
  for (let i = 0; i < m; i++) v[i] = Math.pow((v[i] - lo) / span, shape);
  return sampler(v);
}
function sampler(v) {
  return (i) => {
    const x = (i / SR) * CR;
    const k = Math.min(v.length - 2, Math.floor(x));
    const f = x - k;
    return v[k] * (1 - f) + v[k + 1] * f;
  };
}
/** tabulate an edit-time function at the control rate over a context whose edit 0 sits at `pre` s */
function tabulate(fn, n, pre) {
  const m = Math.ceil((n / SR) * CR) + 3;
  const v = new Float32Array(m);
  for (let k = 0; k < m; k++) v[k] = fn(k / CR - pre);
  return sampler(v);
}
/** breakpoint curve in edit seconds; `mode` cos (S-shaped), lin, or log (for frequencies) */
function curve(points, mode = 'cos') {
  const p = points.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (t <= p[0][0]) return p[0][1];
    for (let k = 1; k < p.length; k++) {
      if (t <= p[k][0]) {
        const [t0, v0] = p[k - 1];
        const [t1, v1] = p[k];
        const u = (t - t0) / (t1 - t0 || 1);
        if (mode === 'log') return v0 * Math.pow(v1 / v0, 0.5 - 0.5 * Math.cos(Math.PI * u));
        const s = mode === 'lin' ? u : 0.5 - 0.5 * Math.cos(Math.PI * u);
        return v0 + (v1 - v0) * s;
      }
    }
    return p[p.length - 1][1];
  };
}
/** a curve as an AudioParam value curve over the whole context */
function paramCurve(param, fn, ctxSeconds, pre, rate = 100) {
  const m = Math.ceil(ctxSeconds * rate) + 1;
  const v = new Float32Array(m);
  for (let k = 0; k < m; k++) v[k] = fn(k / rate - pre);
  param.setValueCurveAtTime(v, 0, ctxSeconds);
}
const panGains = (pan) => {
  const th = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(th), Math.sin(th)];
};
const stereoBus = (n) => ({ L: new Float32Array(n), R: new Float32Array(n), sL: new Float32Array(n), sR: new Float32Array(n) });
const rms = (a) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s / a.length);
};

// ---------------------------------------------------------------------------------------------
// original stereo forest impulse response (trunk scatter, leafy HF damping, long soft low tail)
// ---------------------------------------------------------------------------------------------
function forestIR(ctx, r, seconds = 2.4) {
  const n = Math.floor(seconds * SR);
  const buf = ctx.createBuffer(2, n, SR);
  const T60 = [2.2, 1.45, 0.55];
  for (let c = 0; c < 2; c++) {
    const rc = r.fork(`fir${c}`);
    const d = buf.getChannelData(c);
    const lo = new Biquad('lp', 550, 0.7);
    const hi = new Biquad('hp', 3200, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const w = rc() * 2 - 1;
      const l = lo.run(w);
      const h = hi.run(w);
      const m = w - l - h;
      const build = t < 0.01 ? 0 : Math.min(1, (t - 0.01) / 0.06);
      d[i] = (l * Math.pow(10, (-3 * t) / T60[0]) * 1.1 + m * Math.pow(10, (-3 * t) / T60[1]) + h * Math.pow(10, (-3 * t) / T60[2]) * 0.7) * build;
    }
    for (let e = 0; e < 16; e++) {
      const at = Math.floor(SR * (0.005 + rc() * 0.095));
      const g = 0.5 * Math.pow(1 - at / (SR * 0.11), 1.5) * (rc() < 0.5 ? -1 : 1);
      const lp = new Biquad('lp', R(rc, 2500, 7000), 0.7);
      for (let k = 0; k < 96 && at + k < n; k++) d[at + k] += lp.run(k === 0 ? g * 6 : 0);
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------------------------
// birds
// ---------------------------------------------------------------------------------------------
function interpLog(f, u) {
  if (u <= f[0][0]) return f[0][1];
  for (let k = 1; k < f.length; k++) {
    if (u <= f[k][0]) {
      const [u0, a] = f[k - 1];
      const [u1, b] = f[k];
      return a * Math.pow(b / a, (u - u0) / (u1 - u0 || 1));
    }
  }
  return f[f.length - 1][1];
}

/**
 * One syrinx note: a phase-accumulated tone following a frequency contour (log-interpolated
 * breakpoints over the note), with smoothed micro-jitter, optional vibrato / fast FM (trilled
 * notes) / AM throb, a few harmonics and an attack-sustain-release shape.
 */
function tone(out, s0, n, r) {
  const N = Math.max(16, Math.round(n.dur * SR));
  const h = n.h ?? [1, 0.05];
  const amp = n.amp ?? 1;
  const jit = (n.jit ?? 10) / 1200;
  const attN = Math.max(8, (n.att ?? 0.12) * N);
  const relN = Math.max(8, (n.rel ?? 0.35) * N);
  let ph = r() * TAU;
  let jv = 0;
  let jt = 0;
  let vPh = r() * TAU;
  let fPh = r() * TAU;
  let nb = 0;
  for (let i = 0; i < N; i++) {
    const idx = s0 + i;
    if (idx >= out.length) break;
    const u = i / N;
    let hz = interpLog(n.f, u);
    if ((i & 31) === 0) jt = r() * 2 - 1;
    jv += (jt - jv) * 0.0015;
    hz *= Math.pow(2, jv * jit);
    if (n.vib) { hz *= Math.pow(2, (n.vib.cents / 1200) * Math.sin(vPh)); vPh += (TAU * n.vib.rate) / SR; }
    if (n.fm) { hz *= 1 + n.fm.depth * Math.sin(fPh); fPh += (TAU * n.fm.rate) / SR; }
    ph += (TAU * hz) / SR;
    let s = 0;
    for (let k = 0; k < h.length; k++) if (hz * (k + 1) < 19000) s += h[k] * Math.sin(ph * (k + 1));
    let e = 1;
    if (i < attN) e = smooth(i / attN);
    else if (i > N - relN) e = smooth((N - i) / relN);
    if (n.am) e *= 1 - n.am.depth * (0.5 + 0.5 * Math.sin((TAU * n.am.rate * i) / SR));
    if (n.breath) { nb += (r() * 2 - 1 - nb) * 0.12; s += nb * n.breath * 4; }
    if (idx >= 0) out[idx] += s * e * amp;
  }
}

function contour(r, shape, f0) {
  switch (shape) {
    case 'up': return [[0, f0], [1, f0 * R(r, 1.15, 1.55)]];
    case 'down': return [[0, f0 * R(r, 1.2, 1.5)], [1, f0 * R(r, 0.8, 0.95)]];
    case 'arch': return [[0, f0], [0.45, f0 * R(r, 1.15, 1.35)], [1, f0 * R(r, 0.9, 1.0)]];
    case 'dip': return [[0, f0 * R(r, 1.05, 1.2)], [0.5, f0 * R(r, 0.8, 0.9)], [1, f0 * R(r, 1.05, 1.25)]];
    case 'hook': return [[0, f0 * 0.9], [0.2, f0 * R(r, 1.15, 1.3)], [1, f0 * R(r, 0.8, 0.9)]];
    default: return [[0, f0], [1, f0 * R(r, 0.97, 1.04)]];
  }
}

/** song structures, loosely modelled on the real species (timings and bands from field-guide descriptions) */
const SPECIES = {
  blackbird(r) {
    const notes = [];
    let t = 0;
    const base = R(r, 1500, 2050);
    const n = RI(r, 4, 7);
    for (let i = 0; i < n; i++) {
      const dur = R(r, 0.08, 0.26);
      const shape = r.pick(['up', 'down', 'arch', 'flat', 'dip', 'hook']);
      const f0 = base * Math.pow(2, R(r, -0.35, 0.75));
      notes.push({ t, dur, f: contour(r, shape, f0), h: [1, 0.14, 0.035], att: R(r, 0.08, 0.25), rel: R(r, 0.3, 0.5), amp: R(r, 0.6, 1), vib: shape === 'flat' ? { rate: R(r, 14, 22), cents: R(r, 30, 70) } : null, jit: 10 });
      t += dur + R(r, 0.015, 0.07);
    }
    if (r() < 0.85) {
      t += R(r, 0.03, 0.09);
      const k = RI(r, 3, 6);
      for (let i = 0; i < k; i++) {
        const dur = R(r, 0.02, 0.055);
        notes.push({ t, dur, f: contour(r, r.pick(['up', 'down', 'hook']), R(r, 3600, 6800)), h: [1, 0.05], att: 0.2, rel: 0.5, amp: R(r, 0.18, 0.38), jit: 20 });
        t += dur + R(r, 0.004, 0.025);
      }
    }
    return notes;
  },
  robin(r) {
    const notes = [];
    let t = 0;
    const n = RI(r, 8, 14);
    for (let i = 0; i < n; i++) {
      const trill = r() < 0.25;
      const dur = trill ? R(r, 0.1, 0.2) : R(r, 0.03, 0.14);
      const f0 = r() < 0.2 ? R(r, 2200, 3200) : R(r, 3200, 7400);
      notes.push({ t, dur, f: contour(r, r.pick(['up', 'down', 'arch', 'flat', 'hook']), f0), h: [1, 0.04], att: R(r, 0.1, 0.3), rel: R(r, 0.3, 0.5), amp: R(r, 0.45, 1), fm: trill ? { rate: R(r, 40, 70), depth: R(r, 0.05, 0.12) } : null, jit: 15 });
      t += dur + (r() < 0.12 ? R(r, 0.08, 0.14) : R(r, 0.008, 0.05));
    }
    return notes;
  },
  chiffchaff(r) {
    const notes = [];
    let t = 0;
    const hi = R(r, 5300, 6100);
    const lo = R(r, 4100, 4700);
    const n = RI(r, 6, 10);
    let prev = 'lo';
    for (let i = 0; i < n; i++) {
      const which = r() < 0.72 ? (prev === 'lo' ? 'hi' : 'lo') : prev;
      prev = which;
      const f = (which === 'hi' ? hi : lo) * R(r, 0.98, 1.02);
      const dur = which === 'hi' ? R(r, 0.065, 0.085) : R(r, 0.075, 0.095);
      notes.push({ t, dur, f: [[0, f * 1.1], [0.25, f * 1.02], [1, f * 0.76]], h: [1, 0.03], att: 0.15, rel: 0.45, amp: R(r, 0.8, 1), jit: 8 });
      t += R(r, 0.3, 0.42);
    }
    return notes;
  },
  wren(r) {
    const notes = [];
    let t = 0;
    const segs = RI(r, 3, 5);
    for (let s = 0; s < segs; s++) {
      const trill = s === segs - 1 || r() < 0.3;
      const rate = trill ? R(r, 32, 46) : R(r, 12, 22);
      const count = trill ? RI(r, 10, 18) : RI(r, 4, 8);
      const c = contour(r, r.pick(['up', 'down', 'hook', 'arch']), R(r, 3600, 7600));
      const amp = R(r, 0.7, 1);
      for (let i = 0; i < count; i++) {
        notes.push({ t, dur: (1 / rate) * R(r, 0.55, 0.75), f: c, h: [1, 0.05], att: 0.2, rel: 0.4, amp: amp * R(r, 0.85, 1), jit: 12 });
        t += 1 / rate;
      }
      t += R(r, 0.02, 0.06);
    }
    return notes;
  },
  greattit(r) {
    const notes = [];
    let t = 0;
    const hi = R(r, 5400, 6400);
    const lo = R(r, 3300, 4100);
    const pairs = RI(r, 3, 5);
    const period = R(r, 0.3, 0.38);
    for (let i = 0; i < pairs; i++) {
      notes.push({ t, dur: R(r, 0.07, 0.1), f: [[0, hi * 1.03], [1, hi * 0.93]], h: [1, 0.06], att: 0.12, rel: 0.4, amp: 1, jit: 8 });
      notes.push({ t: t + R(r, 0.11, 0.14), dur: R(r, 0.09, 0.12), f: [[0, lo * 1.06], [0.5, lo], [1, lo * 0.9]], h: [1, 0.08], att: 0.15, rel: 0.4, amp: 0.85, jit: 8 });
      t += period;
    }
    return notes;
  },
  goldcrest(r) {
    const notes = [];
    let t = 0;
    const cycles = RI(r, 3, 5);
    const a = R(r, 6800, 7600);
    const b = a * R(r, 1.06, 1.12);
    for (let c = 0; c < cycles; c++) {
      for (const f of [a, b, a]) {
        notes.push({ t, dur: 0.045, f: [[0, f], [1, f * 0.94]], h: [1], att: 0.2, rel: 0.4, amp: R(r, 0.6, 0.85), jit: 10 });
        t += 0.06;
      }
      t += 0.035;
    }
    const k = RI(r, 4, 7);
    for (let i = 0; i < k; i++) {
      notes.push({ t, dur: 0.035, f: contour(r, r.pick(['up', 'down']), R(r, 6000, 8000)), h: [1], att: 0.2, rel: 0.4, amp: 0.9, jit: 12 });
      t += 0.045;
    }
    return notes;
  },
  chaffinch(r) {
    const notes = [];
    let t = 0;
    let f = R(r, 5600, 6500);
    const n1 = RI(r, 4, 6);
    for (let i = 0; i < n1; i++) {
      notes.push({ t, dur: 0.06, f: [[0, f * 1.12], [1, f * 0.82]], h: [1, 0.04], att: 0.12, rel: 0.4, amp: 0.7 + i * 0.05, jit: 10 });
      t += 0.125 - i * 0.006;
      f *= 0.97;
    }
    f = R(r, 3800, 4600);
    const n2 = RI(r, 4, 6);
    for (let i = 0; i < n2; i++) {
      notes.push({ t, dur: 0.05, f: [[0, f * 1.15], [1, f * 0.85]], h: [1, 0.05], att: 0.12, rel: 0.4, amp: 0.95, jit: 10 });
      t += 0.085;
      f *= 0.985;
    }
    t += 0.02;
    notes.push({ t, dur: R(r, 0.22, 0.3), f: [[0, R(r, 2600, 3000)], [0.3, R(r, 4000, 4600)], [1, R(r, 2100, 2500)]], h: [1, 0.12], att: 0.08, rel: 0.35, amp: 1, jit: 8 });
    return notes;
  },
  thrush(r) {
    const notes = [];
    let t = 0;
    const phrases = RI(r, 1, 2);
    for (let p = 0; p < phrases; p++) {
      const motif = [];
      const k = RI(r, 2, 4);
      let mt = 0;
      for (let i = 0; i < k; i++) {
        const dur = R(r, 0.05, 0.14);
        motif.push({ t: mt, dur, f: contour(r, r.pick(['up', 'down', 'arch', 'hook', 'dip']), R(r, 1800, 5200)), h: [1, 0.1, 0.02], att: 0.1, rel: 0.4, amp: R(r, 0.6, 1), jit: 10 });
        mt += dur + R(r, 0.015, 0.05);
      }
      const reps = RI(r, 2, 4);
      for (let q = 0; q < reps; q++) {
        for (const m of motif) notes.push({ ...m, t: t + m.t, amp: m.amp * R(r, 0.9, 1.05) });
        t += mt + R(r, 0.08, 0.16);
      }
      t += R(r, 0.2, 0.4);
    }
    return notes;
  },
  chip(r) {
    const notes = [];
    let t = 0;
    const n = RI(r, 1, 3);
    const f = R(r, 4500, 6800);
    for (let i = 0; i < n; i++) {
      notes.push({ t, dur: R(r, 0.02, 0.045), f: [[0, f * 1.1], [1, f * 0.8]], h: [1, 0.05], att: 0.15, rel: 0.5, amp: 1, jit: 10 });
      t += R(r, 0.12, 0.3);
    }
    return notes;
  },
  woodpigeon(r) {
    const f = R(r, 420, 500);
    const notes = [];
    let t = 0;
    // "coo-COOO-coo, coo-coo": [dur, amp, pitch, gap after]
    const pattern = [[0.3, 0.7, 1.0, 0.14], [0.55, 1.0, 1.03, 0.16], [0.28, 0.75, 1.0, 0.38], [0.24, 0.65, 0.98, 0.12], [0.24, 0.6, 0.97, 0]];
    for (const [dur, amp, fm, gap] of pattern) {
      const ff = f * fm;
      notes.push({ t, dur, f: [[0, ff * 0.95], [0.35, ff * 1.02], [1, ff * 0.93]], h: [1, 0.32, 0.12, 0.05], att: 0.28, rel: 0.4, amp, jit: 6, breath: 0.04, am: { rate: R(r, 9, 13), depth: 0.12 } });
      t += dur + gap;
    }
    return notes;
  },
};

/** a great spotted woodpecker's drum: 11–17 modal knocks of one trunk, slightly accelerating, tailing off */
function drum(r) {
  const n = RI(r, 11, 17);
  const modes = [R(r, 620, 820), R(r, 1450, 1800), R(r, 2600, 3200)];
  const taus = [0.02, 0.011, 0.006];
  const amps = [1, 0.55, 0.3];
  const out = new Float32Array(Math.ceil((n * 0.055 + 0.2) * SR));
  let t = 0;
  for (let i = 0; i < n; i++) {
    const a = (i < 2 ? 0.8 : 1) * (i > n * 0.6 ? 1 - (i - n * 0.6) / (n * 0.55) : 1) * R(r, 0.85, 1.05);
    const s0 = Math.round(t * SR);
    for (let m = 0; m < 3; m++) {
      const f = modes[m] * R(r, 0.99, 1.01);
      const ph = r() * TAU;
      const L = Math.ceil(taus[m] * 7 * SR);
      for (let k = 0; k < L && s0 + k < out.length; k++) out[s0 + k] += amps[m] * a * Math.exp(-k / (taus[m] * SR)) * Math.sin(ph + (TAU * f * k) / SR);
    }
    for (let k = 0; k < 64 && s0 + k < out.length; k++) out[s0 + k] += a * 0.45 * (r() * 2 - 1) * Math.exp(-k / 10);
    t += 0.052 - i * 0.0006;
  }
  return out;
}

function renderNotes(notes, r) {
  const len = notes.reduce((m, n) => Math.max(m, n.t + n.dur), 0) + 0.05;
  const out = new Float32Array(Math.ceil(len * SR));
  for (const n of notes) tone(out, Math.round(n.t * SR), n, r);
  return out;
}

/**
 * Put a mono call into the scene: distance d (0 overhead .. 1 deep in the wood) sets the level
 * (−22 dB across the range), the air's high-frequency loss and the direct/reverberant ratio; pan
 * sets constant-power gains and (for nearer birds) a small interaural delay on the far ear.
 */
function place(mono, s0, d, pan, level, bus) {
  const g = level * Math.pow(10, (-22 * d) / 20);
  const dry = 1 - 0.72 * d;
  const wet = 0.18 + 0.82 * d;
  const fc = 18000 * Math.exp(-1.9 * d);
  const lp1 = new Biquad('lp', fc, 0.707);
  const lp2 = new Biquad('lp', Math.min(20000, fc * 1.4), 0.6);
  const hp = new Biquad('hp', 280, 0.7);
  const [gl, gr] = panGains(pan);
  const itd = Math.round(Math.abs(pan) * (1 - d) * 0.00035 * SR);
  const dl = pan > 0 ? itd : 0;
  const dr = pan < 0 ? itd : 0;
  const sl = 0.5 - 0.3 * pan;
  const sr = 0.5 + 0.3 * pan;
  const n = bus.L.length;
  const tail = Math.round(0.02 * SR);
  for (let i = 0; i < mono.length + tail; i++) {
    const x = hp.run(lp2.run(lp1.run(i < mono.length ? mono[i] : 0))) * g;
    const iL = s0 + i + dl;
    const iR = s0 + i + dr;
    const iS = s0 + i;
    if (iL >= 0 && iL < n) bus.L[iL] += x * gl * dry;
    if (iR >= 0 && iR < n) bus.R[iR] += x * gr * dry;
    if (iS >= 0 && iS < n) { bus.sL[iS] += x * wet * sl; bus.sR[iS] += x * wet * sr; }
  }
}

function birdPlan(S) {
  const P = (id, off) => S[id].start + off;
  return [
    // hero opening: far birds across a wide field
    { sp: 'blackbird', at: P('hero', 0.25), d: 0.72, pan: -0.55, level: 0.55 },
    { sp: 'woodpigeon', at: P('hero', 0.8), d: 0.93, pan: 0.42, level: 0.8 },
    { sp: 'chiffchaff', at: P('hero', 1.75), d: 0.78, pan: 0.64, level: 0.42 },
    { sp: 'robin', at: P('hero', 2.6), d: 0.86, pan: -0.28, level: 0.4 },
    // lantern close-up: one close bird
    { sp: 'robin', at: P('lantern', 0.32), d: 0.16, pan: 0.36, level: 0.34 },
    // canopy reveal: higher and farther
    { sp: 'greattit', at: P('canopy', 0.35), d: 0.62, pan: -0.38, level: 0.45 },
    { sp: 'goldcrest', at: P('canopy', 1.25), d: 0.55, pan: 0.22, level: 0.38 },
    { sp: 'wren', at: P('canopy', 1.95), d: 0.68, pan: 0.56, level: 0.5 },
    // walk
    { sp: 'blackbird', at: P('walk', 0.7), d: 0.5, pan: 0.52, level: 0.5 },
    { sp: 'chiffchaff', at: P('walk', 2.6), d: 0.7, pan: -0.6, level: 0.4 },
    // run
    { sp: 'chaffinch', at: P('run', 0.8), d: 0.62, pan: 0.6, level: 0.45 },
    { sp: 'woodpecker', at: P('run', 2.5), d: 0.86, pan: -0.66, level: 0.55 },
    // stairs
    { sp: 'woodpigeon', at: P('stairs', 0.45), d: 0.95, pan: -0.5, level: 0.75 },
    { sp: 'woodpecker', at: P('stairs', 1.7), d: 0.9, pan: 0.55, level: 0.55 },
    { sp: 'thrush', at: P('stairs', 2.9), d: 0.7, pan: 0.35, level: 0.42 },
    { sp: 'woodpecker', at: P('stairs', 4.05), d: 0.9, pan: 0.52, level: 0.45 },
    // final reveal: the chorus opens up, then settles
    { sp: 'blackbird', at: P('reveal', 0.22), d: 0.45, pan: -0.45, level: 0.55 },
    { sp: 'wren', at: P('reveal', 1.05), d: 0.55, pan: 0.5, level: 0.5 },
    { sp: 'chiffchaff', at: P('reveal', 1.9), d: 0.72, pan: -0.2, level: 0.4 },
    { sp: 'greattit', at: P('reveal', 2.6), d: 0.6, pan: 0.3, level: 0.4 },
    { sp: 'woodpigeon', at: P('reveal', 3.15), d: 0.9, pan: 0.62, level: 0.65 },
    { sp: 'robin', at: P('reveal', 4.15), d: 0.58, pan: -0.5, level: 0.38 },
    { sp: 'chaffinch', at: P('reveal', 4.85), d: 0.72, pan: 0.15, level: 0.32 },
  ];
}
const FAR_SET = [['robin', 3], ['chaffinch', 3], ['wren', 2], ['chiffchaff', 2], ['greattit', 2], ['chip', 3], ['thrush', 2], ['blackbird', 2], ['goldcrest', 1]];
function weighted(r, set) {
  const total = set.reduce((s, x) => s + x[1], 0);
  let v = r() * total;
  for (const [k, w] of set) { v -= w; if (v <= 0) return k; }
  return set[0][0];
}
/** section value table → smooth curve (0.15 s blends either side of each boundary) */
function sectionCurve(S, bySection, blend = 0.15, extra = []) {
  const pts = [];
  for (const id of Object.keys(S)) {
    const v = bySection[id];
    if (v === undefined) continue;
    pts.push([S[id].start + blend, v], [S[id].end - blend, v]);
  }
  return curve(pts.concat(extra));
}

function birdsJS(cfg, n, root) {
  const S = cfg.S;
  const bus = stereoBus(n);
  const E = (e) => Math.round((e + cfg.pre) * SR);
  const log = [];
  const call = (sp, at, d, pan, level, r, tag) => {
    const mono = sp === 'woodpecker' ? drum(r) : renderNotes(SPECIES[sp](r), r);
    place(mono, E(at), d, pan, level, bus);
    log.push({ tag, sp, at: +at.toFixed(3), dur: +(mono.length / SR).toFixed(2), d: +d.toFixed(2), pan: +pan.toFixed(2), level: +level.toFixed(3) });
  };
  birdPlan(S).forEach((b, i) => call(b.sp, b.at, b.d, b.pan, b.level, root.fork(`placed-${i}-${b.sp}`), 'placed'));
  // far chorus: many small distant voices, density and level following the section
  const rate = sectionCurve(S, { hero: 1.0, lantern: 0.35, macro: 0.3, canopy: 0.85, walk: 0.75, run: 0.65, stairs: 0.75, reveal: 1.5 }, 0.15, [[S.reveal.end - 1.2, 0.8]]);
  const lvl = sectionCurve(S, { hero: 1, lantern: 0.55, macro: 0.5, canopy: 1, walk: 0.9, run: 0.85, stairs: 0.9, reveal: 1.1 });
  const cr = root.fork('chorus');
  let t = -cfg.pre + cr() * 0.4;
  let k = 0;
  while (t < cfg.duration) {
    const sp = weighted(cr, FAR_SET);
    call(sp, t, R(cr, 0.78, 1), R(cr, -0.95, 0.95), R(cr, 0.3, 0.6) * lvl(t), cr.fork(`c${k++}`), 'chorus');
    t += (0.35 + 0.65 * -Math.log(1 - cr() * 0.999)) / rate(t);
  }
  return { bus, log };
}

// ---------------------------------------------------------------------------------------------
// bed: designed gust, wind layers, room tone, far air, leaf rustles
// ---------------------------------------------------------------------------------------------
function gustCurve(S) {
  return curve([
    [-6, 0.55], [S.hero.start, 0.58], [S.hero.start + 2.2, 0.7], [S.hero.end - 0.35, 0.62],
    [S.lantern.start + 0.15, 0.22], [S.macro.end - 0.2, 0.18],
    [S.canopy.start + 0.2, 0.3], [S.canopy.start + 1.9, 0.96], [S.canopy.end - 0.6, 0.86],
    [S.walk.start + 0.7, 0.42], [S.walk.end - 1.0, 0.46], [S.run.start + 0.5, 0.52], [S.run.end - 0.5, 0.5],
    [S.stairs.start + 0.5, 0.45], [S.stairs.end - 0.7, 0.62],
    [S.reveal.start + 1.0, 0.9], [S.reveal.start + 2.2, 0.82], [S.reveal.start + 4.6, 0.5], [S.reveal.end + 10, 0.45],
  ]);
}
/** how open the wind bed is: close-ups pull it in (the camera is inside a lantern / on moss) */
function intimacyCurve(S) {
  return curve([
    [-6, 1], [S.lantern.start - 0.1, 1], [S.lantern.start + 0.1, 0.34], [S.macro.start - 0.08, 0.34], [S.macro.start + 0.12, 0.27],
    [S.macro.end - 0.08, 0.27], [S.canopy.start + 0.2, 0.7], [S.canopy.start + 1.5, 1.0],
    [S.walk.start - 0.1, 1.0], [S.walk.start + 0.15, 0.82], [S.run.start - 0.1, 0.82], [S.run.start + 0.2, 0.9],
    [S.stairs.start, 0.9], [S.reveal.start - 0.3, 0.95], [S.reveal.start + 0.6, 1.08], [S.reveal.end + 10, 1.0],
  ]);
}

function grain(bus, s0, len, fc, q, amp, pan, d, r) {
  const n = Math.ceil(len * SR * 3.2);
  const bp = new Biquad('bp', fc, q);
  const att = Math.max(8, Math.round(R(r, 0.001, 0.006) * SR));
  const tau = (len * SR) / 2.5;
  const [gl, gr] = panGains(pan);
  const dry = 1 - 0.6 * d;
  const wet = 0.15 + 0.7 * d;
  const N = bus.L.length;
  for (let i = 0; i < n; i++) {
    const e = i < att ? (i / att) * (i / att) : Math.exp(-(i - att) / tau);
    const y = bp.run((r() * 2 - 1) * e) * amp;
    const idx = s0 + i;
    if (idx < 0 || idx >= N) continue;
    bus.L[idx] += y * gl * dry; bus.R[idx] += y * gr * dry;
    bus.sL[idx] += y * wet * 0.5; bus.sR[idx] += y * wet * 0.5;
  }
}

function leafRustles(cfg, bus, root, gustFn, intimFn) {
  const S = cfg.S;
  const density = sectionCurve(S, { hero: 1, lantern: 0.25, macro: 0.2, canopy: 1.25, walk: 0.9, run: 0.9, stairs: 0.9, reveal: 1.2 });
  const r = root.fork('rustle');
  let t = -cfg.pre + r() * 0.3;
  let k = 0;
  let clusters = 0;
  while (t < cfg.duration) {
    const g = gustFn(t);
    const rate = (0.5 + 5 * Math.pow(g, 1.5)) * density(t);
    const cl = r.fork(`cl${k++}`);
    const grains = 1 + Math.floor(cl() * (2 + 6 * g));
    const pan = R(cl, -0.9, 0.9);
    const d = R(cl, 0.1, 0.95);
    const span = R(cl, 0.06, 0.45);
    const lvl = (0.35 + g) * intimFn(t) * (1 - 0.6 * d);
    for (let j = 0; j < grains; j++) {
      const gt = t + cl() * span;
      const crisp = cl() < 0.35;
      const len = crisp ? R(cl, 0.004, 0.014) : R(cl, 0.02, 0.09);
      const fcen = (crisp ? R(cl, 3500, 8000) : R(cl, 1400, 5000)) * (1 - 0.45 * d);
      const amp = lvl * (crisp ? R(cl, 0.02, 0.05) : R(cl, 0.012, 0.035));
      grain(bus, Math.round((gt + cfg.pre) * SR), len, fcen, R(cl, 0.7, 1.6), amp, pan + R(cl, -0.15, 0.15), d, cl);
    }
    clusters++;
    t += (0.3 + 0.7 * -Math.log(1 - r() * 0.999)) / rate;
  }
  return clusters;
}

function bedJS(cfg, n, root) {
  const S = cfg.S;
  const bus = stereoBus(n);
  const gustFn = gustCurve(S);
  const intimFn = intimacyCurve(S);
  const intim = tabulate(intimFn, n, cfg.pre);
  const stats = {};
  const layers = { air: 0, body: 0, leaves: 0, far: 0 };
  for (let c = 0; c < 2; c++) {
    const r = root.fork(`wind${c}`);
    // the gust reaches the right-hand trees a little later than the left: the swell travels
    const g = tabulate((e) => gustFn(e - (c === 0 ? 0 : 0.45)), n, cfg.pre);
    const pinkA = pinkGen(r.fork('a'));
    const pinkB = pinkGen(r.fork('b'));
    const whiteC = r.fork('c');
    const pinkD = pinkGen(r.fork('d'));
    const modA = wander(r.fork('ma'), n, 0.22, 1.3);
    const modB = wander(r.fork('mb'), n, 0.09, 1.0);
    const flick = wander(r.fork('mc'), n, 1.6, 1.8);
    const modD = wander(r.fork('md'), n, 0.06, 1);
    const aHp = new Biquad('hp', 380, 0.6);
    const aLp = new Biquad('lp', 3000, 0.5);
    const aLp2 = new Biquad('lp', 3000, 0.5);
    const bHp = new Biquad('hp', 110, 0.6);
    const bLp = new Biquad('lp', 700, 0.6);
    const cHp = new Biquad('hp', 2000, 0.6);
    const cLp = new Biquad('lp', 8000, 0.6);
    const dHp = new Biquad('hp', 180, 0.6);
    const dLp = new Biquad('lp', 2400, 0.5);
    const out = c === 0 ? bus.L : bus.R;
    let sa = 0, sb = 0, sc = 0, sd = 0;
    for (let i = 0; i < n; i++) {
      const gv = g(i);
      if ((i & 63) === 0) {
        const fc = 1500 + 4400 * gv * (0.7 + 0.5 * modA(i));
        aLp.set('lp', fc, 0.5);
        aLp2.set('lp', fc * 1.25, 0.5);
      }
      const im = intim(i);
      // high canopy air: the big airy layer, opens its top as the gust rises
      const a = aLp2.run(aLp.run(aHp.run(pinkA()))) * 0.2 * (0.04 + Math.pow(gv, 1.6)) * (0.55 + 0.75 * modA(i));
      // canopy body: the roll of the whole crown
      const b = bLp.run(bHp.run(pinkB())) * 0.16 * (0.12 + Math.pow(gv, 1.2)) * (0.6 + 0.6 * modB(i));
      // near leaves: a flickering shimmer that exists only in the gust
      const cc = cLp.run(cHp.run(whiteC() * 2 - 1)) * 0.05 * Math.pow(gv, 2.2) * (0.15 + 1.2 * flick(i));
      // far air wash: the rest of the forest, very low
      const d = dLp.run(dHp.run(pinkD())) * 0.018 * (0.7 + 0.5 * modD(i));
      out[i] = (a + b + cc + d) * im;
      sa += a * a; sb += b * b; sc += cc * cc; sd += d * d;
    }
    layers.air += Math.sqrt(sa / n) / 2; layers.body += Math.sqrt(sb / n) / 2; layers.leaves += Math.sqrt(sc / n) / 2; layers.far += Math.sqrt(sd / n) / 2;
  }
  // deep room tone: a mostly-common low rumble (not a tone: broadband below 150 Hz, wandering)
  const rr = root.fork('room');
  const brown = brownGen(rr.fork('common'));
  const bl = brownGen(rr.fork('l'));
  const br = brownGen(rr.fork('r'));
  const rHp = [new Biquad('hp', 24, 0.7), new Biquad('hp', 24, 0.7)];
  const rLp = [new Biquad('lp', 150, 0.6), new Biquad('lp', 150, 0.6)];
  const rMod = wander(rr.fork('m'), n, 0.05, 1);
  let sr = 0;
  for (let i = 0; i < n; i++) {
    const common = brown();
    const m = cfg.roomTone * (0.75 + 0.4 * rMod(i));
    const yl = rLp[0].run(rHp[0].run(common * 0.7 + bl() * 0.3)) * m;
    const yr = rLp[1].run(rHp[1].run(common * 0.7 + br() * 0.3)) * m;
    bus.L[i] += yl; bus.R[i] += yr;
    sr += yl * yl;
  }
  layers.room = Math.sqrt(sr / n);
  stats.clusters = leafRustles(cfg, bus, root, gustFn, intimFn);
  stats.layerRms = layers;
  return { bus, stats };
}

// ---------------------------------------------------------------------------------------------
// detail: pod-lantern flame + macro leaf ticks
// ---------------------------------------------------------------------------------------------
function click(bus, s0, r, amp, pan, wet) {
  const pop = r() < 0.18;
  const len = Math.max(4, Math.round((pop ? R(r, 0.003, 0.007) : R(r, 0.0004, 0.0022)) * SR));
  const bp = new Biquad('bp', pop ? R(r, 700, 1500) : R(r, 1800, 6500), pop ? 1.4 : 1.1);
  const a = amp * (pop ? R(r, 1.2, 2.0) : 1);
  const [gl, gr] = panGains(pan);
  const N = bus.L.length;
  for (let i = 0; i < len * 5; i++) {
    const e = i < len ? 1 - (i / len) * 0.3 : 0.7 * Math.exp(-(i - len) / (len * 0.6));
    const y = bp.run((r() * 2 - 1) * e) * a;
    const idx = s0 + i;
    if (idx < 0 || idx >= N) continue;
    bus.L[idx] += y * gl; bus.R[idx] += y * gr;
    bus.sL[idx] += y * wet; bus.sR[idx] += y * wet;
  }
}

function detailJS(cfg, n, root) {
  const S = cfg.S;
  const bus = stereoBus(n);
  const E = (e) => Math.round((e + cfg.pre) * SR);
  const stats = { crackles: 0, ticks: 0 };
  // ---- lantern: breath + husk + crackle, in with the cut, out with the next ----
  const winFn = curve([[S.lantern.start - 0.14, 0], [S.lantern.start + 0.08, 1], [S.lantern.end - 0.06, 1], [S.lantern.end + 0.22, 0]]);
  const w = tabulate(winFn, n, cfg.pre);
  const r = root.fork('lantern');
  const pink = pinkGen(r.fork('pink'));
  const flut = wander(r.fork('flut'), n, 4.5, 1.5);
  const slow = wander(r.fork('slow'), n, 0.5, 1);
  const huskW = wander(r.fork('husk'), n, 0.3, 1);
  const hp = new Biquad('hp', 70, 0.7);
  const lp = new Biquad('lp', 380, 0.7);
  const hb = new Biquad('bp', 165, 2.5);
  const i0 = Math.max(0, E(S.lantern.start - 0.3));
  const i1 = Math.min(n, E(S.lantern.end + 0.4));
  for (let i = i0; i < i1; i++) {
    if ((i & 127) === 0) hb.set('bp', 150 + 30 * huskW(i), 2.5);
    const x = pink();
    const body = lp.run(hp.run(x)) * 0.35 * (0.3 + flut(i)) * (0.8 + 0.3 * slow(i));
    const husk = hb.run(x) * 0.45 * (0.5 + 0.6 * flut(i));
    const y = (body + husk) * w(i) * cfg.lantern;
    bus.L[i] += y * 0.9; bus.R[i] += y;
    bus.sL[i] += y * 0.12; bus.sR[i] += y * 0.12;
  }
  const cr = r.fork('crackle');
  let t = S.lantern.start - 0.14;
  let burst = 0;
  while (t < S.lantern.end + 0.22) {
    const wv = winFn(t);
    if (burst <= 0 && cr() < 0.08) burst = RI(cr, 3, 8);
    if (wv > 0.01) {
      const amp = 0.05 * Math.exp(0.6 * cr.gauss()) * wv * cfg.lantern;
      click(bus, E(t), cr, amp, 0.12 + R(cr, -0.22, 0.22), 0.05);
      stats.crackles++;
    }
    const rate = burst > 0 ? 22 : 6;
    if (burst > 0) burst--;
    t += (0.25 + 0.75 * -Math.log(1 - cr() * 0.999)) / rate;
  }
  // ---- macro: tiny leaf ticks close to the lens, and one soft brush ----
  const tr = root.fork('ticks');
  const span = S.macro.end - S.macro.start;
  const nT = RI(tr, 9, 13);
  for (let k = 0; k < nT; k++) {
    let at = S.macro.start + 0.08 + tr() * (span - 0.22);
    const pair = tr() < 0.35 ? 2 : 1;
    for (let p = 0; p < pair; p++) {
      const len = R(tr, 0.0008, 0.003);
      grain(bus, E(at), len, R(tr, 3000, 8500), R(tr, 1.1, 1.8), R(tr, 0.05, 0.13) * cfg.ticks, R(tr, -0.5, 0.5), R(tr, 0.05, 0.3), tr);
      stats.ticks++;
      at += R(tr, 0.02, 0.06);
    }
  }
  const brushAt = S.macro.start + span * 0.4;
  for (let k = 0; k < 6; k++) grain(bus, E(brushAt + tr() * 0.2), R(tr, 0.02, 0.06), R(tr, 2000, 4500), 1, R(tr, 0.012, 0.024) * cfg.ticks, R(tr, -0.3, 0.1), 0.1, tr);
  return { bus, stats };
}

// ---------------------------------------------------------------------------------------------
// steps foley: cloth swish + small gear tick per step (run full, stairs light, walk none)
// ---------------------------------------------------------------------------------------------
function foleyJS(cfg, n, root) {
  const bus = stereoBus(n);
  const E = (e) => Math.round((e + cfg.pre) * SR);
  let count = 0;
  cfg.steps.forEach((ev, idx) => {
    const k = ev.gait === 'run' ? 1 : ev.gait === 'stairs' ? 0.4 : 0;
    if (!k) return;
    const r = root.fork(`foley${idx}`);
    const pan = ev.pan * 0.6;
    const [gl, gr] = panGains(pan);
    // cloth: a noise band sweeping through the tunic's rustle range
    const s0 = E(ev.t + R(r, 0.004, 0.03));
    const len = Math.round(R(r, 0.07, 0.12) * SR);
    const up = r() < 0.5;
    const f0 = up ? R(r, 800, 1100) : R(r, 2300, 2900);
    const f1 = up ? R(r, 2300, 2900) : R(r, 800, 1100);
    const bp = new Biquad('bp', f0, 0.8);
    const amp = 0.03 * k * R(r, 0.8, 1.2);
    for (let i = 0; i < len; i++) {
      if ((i & 31) === 0) bp.set('bp', f0 * Math.pow(f1 / f0, i / len), 0.8);
      const u = i / len;
      const e = u < 0.3 ? smooth(u / 0.3) : smooth((1 - u) / 0.7);
      const y = bp.run(r() * 2 - 1) * e * amp;
      const idx2 = s0 + i;
      if (idx2 >= 0 && idx2 < n) { bus.L[idx2] += y * gl; bus.R[idx2] += y * gr; bus.sL[idx2] += y * 0.1; bus.sR[idx2] += y * 0.1; }
    }
    // gear: a strap buckle / scabbard tick on alternate steps
    if (idx % 2 === 0 || r() < 0.3) {
      const g0 = E(ev.t + R(r, 0.015, 0.05));
      const modes = [[R(r, 1050, 1350), 0.005, 1], [R(r, 2300, 2900), 0.003, 0.5]];
      const ga = 0.012 * k * R(r, 0.7, 1.2);
      const L = Math.round(0.035 * SR);
      for (let i = 0; i < L; i++) {
        let y = 0;
        for (const [f, tau, a] of modes) y += a * Math.exp(-i / (tau * SR)) * Math.sin((TAU * f * i) / SR);
        if (i < 24) y += (r() * 2 - 1) * 0.4 * (1 - i / 24);
        y *= ga;
        const idx2 = g0 + i;
        if (idx2 >= 0 && idx2 < n) { bus.L[idx2] += y * gl; bus.R[idx2] += y * gr; bus.sL[idx2] += y * 0.1; bus.sR[idx2] += y * 0.1; }
      }
    }
    count++;
  });
  return { bus, count };
}

// ---------------------------------------------------------------------------------------------
// music ornaments (original): harp glissando into the hit, noise swell, low bloom
// ---------------------------------------------------------------------------------------------
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function pluck(bus, s0, midi, vel, pan, r) {
  const f = midiHz(midi);
  const dur = 1.3 + 200 / f;
  const n = Math.ceil(dur * SR);
  const [gl, gr] = panGains(pan);
  const parts = [];
  for (let k = 1; k <= 8; k++) {
    const fk = f * k * Math.sqrt(1 + 0.00015 * k * k);
    if (fk > 15000) break;
    parts.push({ fk, a: (vel * 0.12 * Math.abs(Math.sin(k * Math.PI * 0.27))) / Math.pow(k, 1.1), tau: (0.9 + 150 / f) / (1 + 0.8 * (k - 1)), ph: r() * TAU });
  }
  const att = Math.round(0.003 * SR);
  const N = bus.L.length;
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx >= N) break;
    let y = 0;
    const t = i / SR;
    for (const p of parts) y += p.a * Math.exp(-t / p.tau) * Math.sin(p.ph + TAU * p.fk * t);
    y *= i < att ? i / att : 1;
    if (idx < 0) continue;
    bus.L[idx] += y * gl; bus.R[idx] += y * gr;
    bus.sL[idx] += y * 0.35; bus.sR[idx] += y * 0.35;
  }
}
function ornamentsJS(cfg, n, root, offset) {
  const bus = stereoBus(n);
  const E = (e) => Math.round((e + offset) * SR);
  const hit = cfg.musicHit;
  const r = root.fork('ornaments');
  // harp glissando G4 → G6 on the pentatonic, the last string landing with the melody's high G
  const notes = [67, 69, 71, 74, 76, 79, 81, 83, 86, 88, 91];
  notes.forEach((m, i) => {
    const u = i / (notes.length - 1);
    pluck(bus, E(hit - BEAT + u * BEAT), m, 0.4 + 0.5 * u, -0.45 + 0.9 * u, r.fork(`g${i}`));
  });
  // swell: a soft air/noise crescendo that stops on the downbeat
  for (let c = 0; c < 2; c++) {
    const rc = r.fork(`swell${c}`);
    const pink = pinkGen(rc);
    const hp = new Biquad('hp', 500, 0.7);
    const lp = new Biquad('lp', 2500, 0.6);
    const a0 = E(hit - 2.6);
    const a1 = E(hit);
    const rel = Math.round(0.06 * SR);
    const out = c === 0 ? bus.L : bus.R;
    const send = c === 0 ? bus.sL : bus.sR;
    for (let i = Math.max(0, a0); i < Math.min(n, a1 + rel); i++) {
      const u = (i - a0) / (a1 - a0);
      if ((i & 63) === 0) lp.set('lp', 2500 + 6500 * Math.min(1, u) ** 2, 0.6);
      const e = i < a1 ? Math.pow(u, 3) : 1 - (i - a1) / rel;
      const y = lp.run(hp.run(pink())) * 0.07 * e * cfg.swell;
      out[i] += y; send[i] += y * 0.5;
    }
  }
  // low bloom under the hit: G2 / G3 / D4, slow attack, long decay
  const s0 = E(hit);
  const bloom = [[98.0, 0.12], [196.0, 0.06], [293.66, 0.025]];
  const L = Math.round(4.5 * SR);
  for (let i = 0; i < L && s0 + i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.18) * Math.exp(-t / 2.3);
    let y = 0;
    for (const [f, a] of bloom) y += a * (Math.sin(TAU * f * t) + Math.sin(TAU * f * 1.0009 * t)) * 0.5;
    y *= env * cfg.bloom;
    if (s0 + i >= 0) { bus.L[s0 + i] += y; bus.R[s0 + i] += y; bus.sL[s0 + i] += y * 0.3; bus.sR[s0 + i] += y * 0.3; }
  }
  return { bus };
}

// ---------------------------------------------------------------------------------------------
// stem renders
// ---------------------------------------------------------------------------------------------
function b64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

window.renderStem = async (name, cfg) => {
  const S = cfg.S;
  const pre = name === 'music' ? cfg.musicOffset : cfg.pre;
  const ctxSeconds = pre + cfg.duration;
  const n = Math.round(ctxSeconds * SR);
  const ctx = new OfflineAudioContext(2, n, SR);
  const root = createRng(cfg.seed).fork(name);
  const info = { stem: name, ctxSeconds, preSeconds: pre };
  const addBuffer = (L, Rr, dest, g = 1) => {
    const b = ctx.createBuffer(2, n, SR);
    b.copyToChannel(L, 0);
    b.copyToChannel(Rr, 1);
    const s = ctx.createBufferSource();
    s.buffer = b;
    const gg = gain(ctx, g);
    s.connect(gg).connect(dest);
    s.start(0);
  };
  const forestReturn = (level) => {
    const cv = ctx.createConvolver();
    cv.buffer = forestIR(ctx, createRng(cfg.seed).fork('forest-ir'));
    const ret = gain(ctx, level);
    cv.connect(ret).connect(ctx.destination);
    return cv;
  };
  const addBus = (bus, wetLevel) => {
    addBuffer(bus.L, bus.R, ctx.destination);
    addBuffer(bus.sL, bus.sR, forestReturn(wetLevel));
  };

  switch (name) {
    case 'bed': {
      // the game's wind bed (continuous layers only: its own random birds and flutters are not
      // scheduled — this cut places its own), driven by the designed gust, ~0.8 s ahead of the
      // curve because its levels glide with setTargetAtTime (tau 0.9 / 0.55 s)
      const buses = createBuses(ctx, root.fork('buses'));
      const trim = gain(ctx, 1);
      trim.connect(buses.ambience);
      buses.ambience.gain.value = cfg.gameBed;
      const amb = createAmbience(ctx, trim, buses.reverb, root.fork('ambience'), 0);
      const gustFn = gustCurve(S);
      paramCurve(trim.gain, intimacyCurve(S), ctxSeconds, pre);
      for (let t = 0; t < ctxSeconds; t += 1 / 20) amb.update(t, { gust: gustFn(t - pre + 0.8), listener: { x: 0, y: 1.2, z: 2 }, forward: { x: 0, z: -1 }, pods: [] });
      const { bus, stats } = bedJS(cfg, n, root);
      addBus(bus, 0.55);
      Object.assign(info, stats);
      break;
    }
    case 'birds': {
      const { bus, log } = birdsJS(cfg, n, root);
      addBus(bus, cfg.birdWet);
      info.calls = log;
      break;
    }
    case 'detail': {
      const { bus, stats } = detailJS(cfg, n, root);
      addBus(bus, 0.5);
      Object.assign(info, stats);
      break;
    }
    case 'steps': {
      const buses = createBuses(ctx, root.fork('buses'));
      const feet = createFootsteps(ctx, buses.sfx, buses.reverb, root.fork('footsteps'), 0);
      paramCurve(buses.sfx.gain, (e) => {
        const sec = Object.keys(S).find((id) => e >= S[id].start && e < S[id].end);
        return Math.pow(10, ((cfg.stepGainDb && cfg.stepGainDb[sec]) || 0) / 20);
      }, ctxSeconds, pre, 50);
      for (const ev of cfg.steps) feet.step(ev.surface, ev.t + pre, ev.strength, ev.pan, ev.running);
      const { bus, count } = foleyJS(cfg, n, root);
      addBus(bus, 0.35);
      info.steps = cfg.steps.length;
      info.foley = count;
      break;
    }
    case 'music': {
      const buses = createBuses(ctx, root.fork('buses'));
      buses.master.disconnect();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.5;
      const auto = gain(ctx, 0);
      buses.master.connect(lp).connect(auto).connect(ctx.destination);
      const hit = cfg.musicHit;
      paramCurve(auto.gain, curve([
        [-10, 0], [S.canopy.start - 0.35, 0], [S.canopy.end + 0.2, 0.25], [S.walk.end, 0.3], [S.run.end, 0.42],
        [hit - 0.35, 0.66], [hit + 0.05, 0.9], [hit + 3, 0.84], [hit + 30, 0.84],
      ]), ctxSeconds, pre);
      paramCurve(lp.frequency, curve([
        [-10, 1400], [S.canopy.start, 1400], [S.canopy.end, 3400], [S.walk.end, 4200], [S.run.end, 6500],
        [hit - 0.4, 10000], [hit + 0.1, 17000], [hit + 30, 17000],
      ], 'log'), ctxSeconds, pre);
      const musicOut = gain(ctx, 0.45);
      const musicReverb = gain(ctx, 0.45);
      musicOut.connect(buses.music);
      musicReverb.connect(buses.reverb);
      const music = createMusic(ctx, musicOut, musicReverb, root.fork('score'), 0.5, false);
      info.musicSource = await music.ready;
      music.scheduleUntil(ctxSeconds);
      const { bus } = ornamentsJS(cfg, n, root, pre);
      // the ornaments follow the same rise (they only sound around the hit)
      const orn = gain(ctx, cfg.ornaments);
      orn.connect(ctx.destination);
      const ob = ctx.createBuffer(2, n, SR);
      ob.copyToChannel(bus.L, 0);
      ob.copyToChannel(bus.R, 1);
      const os = ctx.createBufferSource();
      os.buffer = ob;
      os.connect(orn);
      os.start(0);
      const sb = ctx.createBuffer(2, n, SR);
      sb.copyToChannel(bus.sL, 0);
      sb.copyToChannel(bus.sR, 1);
      const ss = ctx.createBufferSource();
      ss.buffer = sb;
      const sg = gain(ctx, cfg.ornaments);
      ss.connect(sg).connect(buses.reverb);
      ss.start(0);
      info.phraseB = { beat32RenderSeconds: 0.8 + 32 * BEAT, offsetSeconds: pre, editSeconds: 0.8 + 32 * BEAT - pre };
      break;
    }
    default:
      throw new Error(`unknown stem ${name}`);
  }
  const buf = await ctx.startRendering();
  const off = Math.round(pre * SR);
  const len = Math.round(cfg.duration * SR);
  const out = [0, 1].map((c) => buf.getChannelData(c).slice(off, off + len));
  let peak = 0;
  for (const ch of out) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
  info.peak = peak;
  info.rms = [rms(out[0]), rms(out[1])];
  info.frames = len;
  info.offsetFrames = off;
  return { L: b64(out[0]), R: b64(out[1]), info };
};
window.cineReady = true;
