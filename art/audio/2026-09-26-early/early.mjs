#!/usr/bin/env node
/**
 * early.mjs — do the leaves answer the wind, or the wind it is about to be?
 *
 *   node art/audio/2026-09-26-early/early.mjs [--out /tmp/early] [--seconds 900]
 *
 * Rubric check 7 is *the wood answers weather: gusts bring leaves, lulls bring calls*. It does —
 * `scheduleFlutters` reads `gustNow` for both the leaf's LEVEL (`0.35 + g · 0.9`, an 11.1 dB
 * range end to end) and the gap to the next one. The question nobody has asked is **when** it
 * reads it.
 *
 * The bed is filled `AMBIENCE_AHEAD` — four seconds — ahead of the clock, and every flutter in
 * that window is booked with the gust of the tick that booked it. So a leaf that sounds four
 * seconds from now is carrying the wind of four seconds ago.
 *
 * The lane has been here once already and only did half of it. `2026-09-25-stale` measured
 * exactly this for BIRD CALLS — level out by a median 0.9 dB at a walk, 1.7 at a run, one call
 * booked 0.73 of a shadow it no longer had — and built the `turning` registry to re-aim them
 * every tick. Flutters got no registry and were never measured, and there are forty times as
 * many of them: 422 to 1021 leaves in 150 s against eleven bird calls a minute.
 *
 * Birds go stale because the LISTENER moves. Leaves go stale because the WEATHER does, which is
 * why standing perfectly still does not save you: `uGust` is a product of two sines whose fastest
 * term turns at 0.37 rad/s, so four seconds is 1.48 radians of it.
 *
 * No render. The schedule is a pure function of the seeded stream and the weather, so it is
 * driven directly, and the gust is `src/world/wind/wind.ts`'s own analytic one rather than a
 * stand-in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  const src = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', src)(
    (n) => {
      if (!n.startsWith('.')) return nodeRequire(n);
      const t = path.resolve(path.dirname(file), n);
      for (const c of [t + '.ts', path.join(t, 'index.ts'), t]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${n} from ${file}`);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const out = path.resolve(args.out || '/tmp/early');
const seconds = Number(args.seconds ?? 900);
fs.mkdirSync(out, { recursive: true });

const A = loadTs('src/audio/ambience.ts');
const { createRng } = loadTs('src/world/util/prng.ts');

/** src/world/wind/wind.ts — the game's own gust, not a stand-in for it */
const gustAt = (t) => {
  const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
  const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
  return Math.min(1, g * 0.8 + push * 0.6);
};

/** what a flutter's level is multiplied by for a gust of `g` (scheduleFlutters) */
const weatherGain = (g) => 0.35 + g * 0.9;
const TICK = 1 / 30;

/**
 * A fake context that remembers WHEN each envelope was written and WHEN it was scheduled to peak.
 *
 * `adEnvelope` ramps a gain to its peak at `t + attack`, so the flutter's sounding time and the
 * level it was booked with both fall out of the automation calls. The booking time is the tick
 * that was running when they were made.
 */
function ctxOf(log) {
  const param = (owner) => ({
    value: 1,
    setValueAtTime(v, t) {
      log.push({ owner, kind: 'set', v, t });
      return this;
    },
    linearRampToValueAtTime(v, t) {
      log.push({ owner, kind: 'ramp', v, t });
      return this;
    },
    exponentialRampToValueAtTime(v, t) {
      log.push({ owner, kind: 'exp', v, t });
      return this;
    },
    setTargetAtTime() {
      return this;
    },
  });
  const node = (k, e = {}) => ({ kind: k, outputs: [], connect(d) { this.outputs.push(d); return d; }, disconnect() {}, ...e });
  return {
    sampleRate: 8000,
    currentTime: 0,
    destination: node('dest'),
    startRendering() {},
    createGain: () => {
      const n = node('gain');
      n.gain = param(n);
      return n;
    },
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(null), Q: param(null), gain: param(null) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(null), detune: param(null), start() {}, stop() {} }),
    createStereoPanner: () => node('pan', { pan: param(null) }),
    createBufferSource: () => node('src', { buffer: null, loop: false, playbackRate: param(null), start() {}, stop() {} }),
    createBuffer(c, l, r) {
      const d = Array.from({ length: c }, () => new Float32Array(l));
      return { length: l, sampleRate: r, duration: l / r, numberOfChannels: c, getChannelData: (i) => d[i], copyToChannel: (s, i) => d[i].set(s.subarray(0, d[i].length)) };
    },
  };
}

const LISTENER = { x: 0, y: 1.2, z: 0 };
const NORTH = { x: 0, z: -1 };

/**
 * Every flutter over `seconds`, with the tick that booked it and the moment it sounds.
 *
 * Only the flutters: the count in `stats()` says how many were made on this tick, and the
 * automation written during the same call says when each of them peaks.
 */
function flutters(canopy = 0, walk = null, ahead = A.aheadFor(TICK)) {
  const log = [];
  const ctx = ctxOf(log);
  const amb = A.createAmbience(ctx, ctx.createGain(), ctx.createGain(), ctx.createGain(), createRng('early/bed'), 0);
  const rows = [];
  let seen = 0;
  for (let t = 0; t < seconds; t += TICK) {
    const g = gustAt(t);
    const c = walk ? walk(t) : canopy;
    log.length = 0;
    amb.update(t, { gust: g, listener: LISTENER, forward: NORTH, pods: [], canopy: c, fairies: [] });
    amb.scheduleUntil(t + ahead);
    const n = amb.stats().flutters;
    if (n === seen) continue;
    // the peaks written on this tick, in the order they were written: one per new flutter
    const peaks = log.filter((e) => e.kind === 'ramp' && e.v > 0);
    for (let i = 0; i < n - seen && i < peaks.length; i++) {
      rows.push({ booked: t, at: peaks[i].t, level: peaks[i].v, gBooked: g, canopyBooked: c });
    }
    seen = n;
  }
  for (const r of rows) {
    r.lead = r.at - r.booked;
    r.gHeard = gustAt(r.at);
    r.dB = 20 * Math.log10(weatherGain(r.gHeard) / weatherGain(r.gBooked));
  }
  return rows;
}

const q = (v, p) => (v.length ? v.slice().sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(p * v.length))] : NaN);
const fmt = (v, n = 2, w = 8) => v.toFixed(n).padStart(w);

const rows = flutters(0);
const lead = rows.map((r) => r.lead);
const err = rows.map((r) => r.dB);
const abs = err.map(Math.abs);

console.log(`\n${rows.length} leaf flutters over ${seconds} s, open sky, the game's own gust`);
console.log(`the live tick runs at ${(TICK * 1000).toFixed(1)} ms, so the bed is filled ${A.aheadFor(TICK).toFixed(2)} s ahead\n`);
console.log(`  how far ahead of itself the bed is booked`);
console.log(`    lead       median ${fmt(q(lead, 0.5))} s   p90 ${fmt(q(lead, 0.9))} s   longest ${fmt(Math.max(...lead))} s`);
console.log(`\n  the wind it was booked with against the wind when it sounds`);
console.log(`    |error|    median ${fmt(q(abs, 0.5))} dB  p90 ${fmt(q(abs, 0.9))} dB  worst ${fmt(Math.max(...abs))} dB`);
console.log(`    over 1 dB  ${((100 * abs.filter((v) => v > 1).length) / abs.length).toFixed(0)} %    over 2 dB  ${((100 * abs.filter((v) => v > 2).length) / abs.length).toFixed(0)} %    over 3 dB  ${((100 * abs.filter((v) => v > 3).length) / abs.length).toFixed(0)} %`);

/**
 * Does the leaf stream FOLLOW the wind, and by how long?
 *
 * The per-leaf error above averages out over a take. What an ear could notice is systematic: the
 * whole stream shifted, so the wood answers a gust that has already gone past.
 *
 * Binned against the gust and cross-correlated. **The sign of a cross-correlation is the easiest
 * thing in this file to get backwards and the hardest to notice**, so it is checked against a
 * series whose delay is known before it is used on one whose delay is not.
 */
const BIN = 0.5;
const nb = Math.floor(seconds / BIN);
const gtr = Float64Array.from({ length: nb }, (_, i) => gustAt((i + 0.5) * BIN));
const norm = (a) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  const d = Float64Array.from(a, (v) => v - m);
  const s = Math.sqrt(d.reduce((s2, v) => s2 + v * v, 0)) || 1;
  return Float64Array.from(d, (v) => v / s);
};
/** the delay of `a` BEHIND `b`, in seconds: positive means `a` is late */
function delayOf(a, b) {
  const A1 = norm(a);
  const B1 = norm(b);
  let best = { r: -2, lagS: 0 };
  const lags = [];
  for (let L = -Math.round(10 / BIN); L <= Math.round(10 / BIN); L++) {
    let s = 0;
    let n = 0;
    for (let i = 0; i < nb; i++) {
      const j = i - L;
      if (j >= 0 && j < nb) {
        s += A1[i] * B1[j];
        n++;
      }
    }
    const r = (s * nb) / (n || 1);
    lags.push({ lagS: L * BIN, r });
    if (r > best.r) best = { r, lagS: L * BIN };
  }
  return { ...best, lags };
}

// the check: a copy of the gust delayed by a known three seconds must read as +3.0
const K = Math.round(3 / BIN);
const known = Float64Array.from({ length: nb }, (_, i) => gtr[Math.max(0, i - K)]);
const checked = delayOf(known, gtr);
if (Math.abs(checked.lagS - 3) > BIN / 2) throw new Error(`the correlation's sign is wrong: a series delayed by 3 s read as ${checked.lagS}`);

const rate = new Float64Array(nb);
const energyNow = new Float64Array(nb);
const energyFixed = new Float64Array(nb);
for (const r of rows) {
  const i = Math.floor(r.at / BIN);
  if (i < 0 || i >= nb) continue;
  rate[i]++;
  // the level as it is booked, and the level it would have if the weather were read when the
  // leaf sounds instead of when it is written down — the same event either way
  energyNow[i] += r.level ** 2;
  energyFixed[i] += (r.level * (weatherGain(r.gHeard) / weatherGain(r.gBooked))) ** 2;
}
const dRate = delayOf(rate, gtr);
const dNow = delayOf(energyNow, gtr);
const dFixed = delayOf(energyFixed, gtr);
console.log(`\n  the leaf stream against the gust (a delayed copy of the gust reads ${checked.lagS >= 0 ? '+' : ''}${checked.lagS.toFixed(1)} s, so the sign is right)`);
console.log(`    ${'how many leaves'.padEnd(34)} behind by ${fmt(dRate.lagS, 1, 5)} s   r = ${dRate.r.toFixed(3)}`);
console.log(`    ${'how loud they are, as it ships'.padEnd(34)} behind by ${fmt(dNow.lagS, 1, 5)} s   r = ${dNow.r.toFixed(3)}`);
console.log(`    ${'…with the weather read when heard'.padEnd(34)} behind by ${fmt(dFixed.lagS, 1, 5)} s   r = ${dFixed.r.toFixed(3)}`);

/**
 * How short would the lookahead have to be?
 *
 * The lookahead is not there for the leaves. It is there so a BACKGROUND TAB, whose timers Chrome
 * clamps to 1 Hz, still has events queued when the tick finally runs — see the tick's own comment
 * in `index.ts`. Four seconds is four times what that needs. This is the whole trade in one table:
 * what each horizon costs in staleness, against the 1 s it has to survive.
 */
console.log(`\n  what the lookahead is buying, and what it costs`);
console.log(`    ${'horizon'.padStart(9)}${'leaves'.padStart(9)}${'|level err| median'.padStart(20)}${'p90'.padStart(8)}${'worst'.padStart(9)}${'loudness behind'.padStart(17)}`);
const sweep = [];
for (const H of [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]) {
  const rs = flutters(0, null, H);
  const a = rs.map((r) => Math.abs(r.dB));
  const e = new Float64Array(nb);
  for (const r of rs) {
    const i = Math.floor(r.at / BIN);
    if (i >= 0 && i < nb) e[i] += r.level ** 2;
  }
  const d = delayOf(e, gtr);
  sweep.push({ H, n: rs.length, median: q(a, 0.5), p90: q(a, 0.9), worst: Math.max(...a), lagS: d.lagS, r: d.r });
  console.log(`    ${H.toFixed(1).padStart(7)} s${String(rs.length).padStart(9)}${fmt(q(a, 0.5), 2, 17)} dB${fmt(q(a, 0.9), 2, 8)}${fmt(Math.max(...a), 2, 9)}${fmt(d.lagS, 1, 14)} s`);
}

/**
 * And the canopy, which goes stale for the other reason — he walks out from under it. The width
 * of the leaf field is `flutterPan(canopy)`, 0.72 in the open and 0.34 under closed crowns.
 */
const EDGE_S = 4.0; // a canopy edge crossed in four seconds, which is 4.8 m at a walk
const walked = flutters(0, (t) => Math.max(0, Math.min(1, (t % 40) / EDGE_S - 4)));
const wErr = walked.map((r) => Math.abs(A.flutterPan(gustAt(0) * 0 + Math.max(0, Math.min(1, ((r.at % 40) / EDGE_S - 4)))) - A.flutterPan(r.canopyBooked)));
console.log(`\n  and the width of the field, walking under a canopy edge every 40 s`);
console.log(`    |error|    median ${fmt(q(wErr, 0.5), 3)}     p90 ${fmt(q(wErr, 0.9), 3)}     worst ${fmt(Math.max(...wErr), 3)}  pan units`);
console.log(`    the field is ${A.FLUTTER_PAN_OPEN} wide in the open and ${A.FLUTTER_PAN_CLOSED} under closed crowns\n`);

fs.writeFileSync(
  path.join(out, 'early.json'),
  JSON.stringify(
    {
      seconds,
      ahead: A.aheadFor(TICK),
      ceiling: A.AHEAD_CEILING,
      n: rows.length,
      lead: { median: q(lead, 0.5), p90: q(lead, 0.9), max: Math.max(...lead) },
      level: { median: q(abs, 0.5), p90: q(abs, 0.9), worst: Math.max(...abs), over1: abs.filter((v) => v > 1).length / abs.length, over2: abs.filter((v) => v > 2).length / abs.length, over3: abs.filter((v) => v > 3).length / abs.length },
      correlation: { sanity: checked.lagS, rate: { lagS: dRate.lagS, r: dRate.r }, now: { lagS: dNow.lagS, r: dNow.r }, fixed: { lagS: dFixed.lagS, r: dFixed.r }, lags: dNow.lags },
      sweep,
      width: { median: q(wErr, 0.5), p90: q(wErr, 0.9), worst: Math.max(...wErr) },
    },
    null,
    1,
  ),
);
console.log(`wrote ${path.join(out, 'early.json')}`);
