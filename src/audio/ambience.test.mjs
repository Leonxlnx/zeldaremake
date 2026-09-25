// node --test src/audio/ambience.test.mjs — the forest bed's wiring (lane 5).
//
// The owner complained about the background sound twice in one day: "too buzzy" (06:50) and then
// "LOWER THE WHITE NOISE" (20:08). Both were fixed by changing what the bed IS — a gust-gated swell
// of pink noise and discrete events instead of continuous filtered noise with a two-sine lantern
// hum summed over every pod in the village. Those fixes live in a handful of constants and a few
// lines of `update`, and until now the only way to check them was a four-minute browser render.
//
// This runs `createAmbience` against a recording stand-in for WebAudio and asserts the things that
// must not come back: silence below the gust knee, no oscillator holding a tone under the bed, a
// village of lanterns that does not sum to a drone, and the two spaces (the log tunnel, the canopy)
// closing the filter the right amount.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) throw Error(`unexpected import ${name}`);
      const target = path.resolve(path.dirname(file), name);
      for (const candidate of [target + '.ts', path.join(target, 'index.ts'), target]) if (existsSync(candidate)) return loadTs(candidate);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const A = loadTs(path.join(here, 'ambience.ts'));
const { createRng } = loadTs(path.join(here, '../world/util/prng.ts'));

// ---- a recording stand-in for WebAudio ---------------------------------------------------------
// Only what the bed touches. Every AudioParam keeps the last value each method aimed it at, so a
// call to `update` can be read back as "what would this gain / cutoff settle to".
function param(value) {
  return {
    value,
    target: value,
    events: [],
    setValueAtTime(v, t) {
      this.value = v;
      this.target = v;
      this.events.push(['set', v, t]);
    },
    linearRampToValueAtTime(v, t) {
      this.target = v;
      this.events.push(['lin', v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.target = v;
      this.events.push(['exp', v, t]);
    },
    setTargetAtTime(v, t, tau) {
      this.target = v;
      this.events.push(['tgt', v, t, tau]);
    },
    cancelScheduledValues() {},
  };
}

function fakeContext({ sampleRate = 8000, offline = true } = {}) {
  const made = { gain: [], filter: [], osc: [], source: [], panner: [] };
  const node = (kind, extra = {}) => {
    const n = {
      kind,
      outputs: [],
      connect(dst) {
        this.outputs.push(dst);
        return dst;
      },
      disconnect() {},
      ...extra,
    };
    return n;
  };
  const ctx = {
    sampleRate,
    currentTime: 0,
    destination: node('destination'),
    made,
    createGain() {
      const n = node('gain', { gain: param(1) });
      made.gain.push(n);
      return n;
    },
    createBiquadFilter() {
      const n = node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
      made.filter.push(n);
      return n;
    },
    createOscillator() {
      const n = node('osc', { type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} });
      made.osc.push(n);
      return n;
    },
    createStereoPanner() {
      const n = node('panner', { pan: param(0) });
      made.panner.push(n);
      return n;
    },
    createBufferSource() {
      const n = node('source', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} });
      made.source.push(n);
      return n;
    },
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        length,
        sampleRate: rate,
        duration: length / rate,
        numberOfChannels: channels,
        getChannelData: (c) => data[c],
        copyToChannel: (src, c) => data[c].set(src.subarray(0, data[c].length)),
      };
    },
  };
  // the voices tear themselves down with a timer live and not at all offline; offline keeps the test
  // free of stray timers
  if (offline) ctx.startRendering = () => {};
  return ctx;
}

const LISTENER = { x: 0, y: 1.2, z: 0 };
const NORTH = { x: 0, z: -1 };

function bed(opts = {}) {
  const ctx = fakeContext();
  const out = ctx.createGain();
  const reverb = ctx.createGain();
  const madeBefore = { ...ctx.made, osc: [...ctx.made.osc] };
  const amb = A.createAmbience(ctx, out, reverb, createRng(opts.seed ?? 'bed/test'), 0);
  return { ctx, amb, out, reverb, oscAtBuild: ctx.made.osc.length - madeBefore.osc.length };
}

/** every gain the bed owns, by the value `update` last aimed it at */
const gains = (ctx) => ctx.made.gain.map((g) => g.gain.target);

/**
 * The bed's nodes have no names, so they are identified by what they RESPOND to: run `update`
 * twice with one term of the state changed and take the gains that moved. That survives anyone
 * adding a node, which a shape match (`the gain feeding a panner`) does not.
 */
function respondsTo(ctx, amb, a, b) {
  const base = { gust: 0.5, listener: LISTENER, forward: NORTH, pods: [] };
  amb.update(1, { ...base, ...a });
  const before = gains(ctx);
  amb.update(2, { ...base, ...b });
  const after = gains(ctx);
  return ctx.made.gain.map((g, i) => ({ node: g, before: before[i], after: after[i] })).filter((r) => Math.abs(r.before - r.after) > 1e-12);
}

test('below the gust knee the wind layers are silent, not faint', () => {
  const { ctx, amb } = bed();
  const wind = respondsTo(ctx, amb, { gust: 0 }, { gust: 1 }).map((r) => r.node);
  assert.ok(wind.length >= 2, `only ${wind.length} gains follow the wind`);
  for (const gust of [0, 0.1, A.GUST_KNEE]) {
    amb.update(1, { gust, listener: LISTENER, forward: NORTH, pods: [] });
    for (const g of wind) {
      assert.ok(g.gain.target <= A.CANOPY_FLOOR + 1e-9, `at gust ${gust} a wind gain still targets ${g.gain.target} — an always-on bed is what reads as white noise`);
    }
  }
  assert.ok(20 * Math.log10(A.CANOPY_FLOOR) < -66 && 20 * Math.log10(A.HUSH_FLOOR) < -66, 'the floors must be inaudible');
});

test('a full gust is louder than the constant bed it replaced', () => {
  const { ctx, amb } = bed();
  // under the crowns: the whole gust term. The roll is the leaves OVERHEAD, so its level is the
  // canopy's share of them (CANOPY_SHARE) — see the open-sky half of this in the next test.
  amb.update(1, { gust: 1, listener: LISTENER, forward: NORTH, pods: [], canopy: 1 });
  const full = gains(ctx);
  assert.ok(full.some((v) => Math.abs(v - (A.CANOPY_FLOOR + A.CANOPY_GUST)) < 1e-9), 'the canopy roll should reach its floor plus the whole gust term');
  assert.ok(full.some((v) => Math.abs(v - (A.HUSH_FLOOR + A.HUSH_GUST)) < 1e-9), 'so should the leaf hush');
  // and the swell is monotone with the wind
  let last = -1;
  for (let g = 0; g <= 1.0001; g += 0.1) {
    const v = A.swell(g);
    assert.ok(v >= last, 'the swell must not fall as the wind rises');
    last = v;
  }
});

test('the leaf roll knows whether there is a roof over it', () => {
  // The crowns used to change only a filter and a reverb send. Measured standing still at one spot
  // with the same seed and the canopy forced to 0, 0.5 and 1, that moved the bed 0.8 dB rms across
  // the whole range of the term — so the roll was the same level in the middle of a paved clearing
  // as under a closed roof of leaves, and walking out of the north corridor into the clearing
  // sounded identical at both ends. A filter cannot take away what is not there.
  const roll = (canopy) => {
    const { ctx, amb } = bed();
    amb.update(1, { gust: 1, listener: LISTENER, forward: NORTH, pods: [], canopy });
    return Math.max(...gains(ctx).filter((v) => v <= A.CANOPY_FLOOR + A.CANOPY_GUST + 1e-9));
  };
  const under = roll(1);
  const open = roll(0);
  assert.ok(open < under, 'fewer leaves overhead must be less leaf sound');
  const dB = 20 * Math.log10(under / open);
  assert.ok(dB > 3.5, `stepping into the open drops the roll ${dB.toFixed(1)} dB — under four is not an arrival`);
  assert.ok(dB < 9, `${dB.toFixed(1)} dB is a gate, not a share: an open place is still ringed by trees you can hear`);
  assert.ok(Math.abs(roll(1) - (A.CANOPY_FLOOR + A.CANOPY_GUST)) < 1e-9, 'under a full roof the roll is unchanged from before this term existed');
  // and it only ever removes
  for (const c of [0, 0.25, 0.5, 0.75, 1]) assert.ok(roll(c) <= A.CANOPY_FLOOR + A.CANOPY_GUST + 1e-9, `an open sky must not make the forest louder (canopy ${c})`);
});

test('no oscillator holds a tone under the bed', () => {
  // the 96 / 192 Hz lantern hum was the loudest band in the whole forest and the thing the owner
  // heard as a drone; the husk resonance that replaced it is a filter on the same noise
  const { oscAtBuild } = bed();
  assert.equal(oscAtBuild, 0, `${oscAtBuild} oscillator(s) created when the bed is built — the bed must be noise and events only`);
});

test('a village of lanterns does not sum to a drone', () => {
  const { ctx, amb } = bed();
  const one = [{ x: 0, y: 2.3, z: 1 }];
  // 39 pods is what the real scene has, on every house, post and bough
  const village = Array.from({ length: 39 }, (_, i) => ({ x: Math.cos(i) * (8 + i * 0.4), y: 3, z: Math.sin(i) * (8 + i * 0.4) }));
  const moved = respondsTo(ctx, amb, { pods: [] }, { pods: one });
  assert.equal(moved.length, 1, `${moved.length} gains follow the lanterns, expected the flame alone`);
  const flame = moved[0].node;
  const level = (pods) => {
    amb.update(9, { gust: 0.5, listener: LISTENER, forward: NORTH, pods });
    return flame.gain.target;
  };
  const near = level(one);
  const far = level(village);
  assert.ok(near > 0, 'standing under a lantern you should hear it');
  assert.ok(far < near * 0.35, `a village of 39 pods reaches ${(far / near).toFixed(2)} of one pod overhead — it used to saturate`);
  // and the level is bounded whatever the crowd
  assert.ok(level(Array.from({ length: 400 }, () => ({ x: 0.1, y: 1.3, z: 0.1 }))) <= A.LANTERN_LEVEL + 1e-9, 'the flame must never exceed its own level');
});

test('the log tunnel closes the bed and the canopy closes it part of the way', () => {
  const { ctx, amb } = bed();
  // the enclosure filter is the one the bed's own output runs through
  const lp = ctx.made.filter.find((f) => f.type === 'lowpass' && f.frequency.value > 10000);
  assert.ok(lp, 'the bed should pass through one wide lowpass');
  const read = (state) => {
    amb.update(1, { gust: 0.5, listener: LISTENER, forward: NORTH, pods: [], ...state });
    return lp.frequency.target;
  };
  const open = read({ enclosure: 0, canopy: 0 });
  const crowns = read({ enclosure: 0, canopy: 1 });
  const bore = read({ enclosure: 1, canopy: 0 });
  assert.ok(open > 15000, `open sky should leave the top alone (${open.toFixed(0)} Hz)`);
  assert.ok(bore < 1200, `the bore should shut it (${bore.toFixed(0)} Hz)`);
  assert.ok(crowns > bore * 2 && crowns < open / 3, `the crowns should close it part of the way, got ${crowns.toFixed(0)} Hz`);
  // the tunnel wins when both apply, and only the tunnel ducks the level
  assert.ok(read({ enclosure: 1, canopy: 1 }) <= bore + 1e-6, 'wood over you beats leaves over you');
});

test('the ravine opens the space where the tunnel and the crowns close it', () => {
  const { ctx, amb } = bed();
  const lp = ctx.made.filter.find((f) => f.type === 'lowpass' && f.frequency.value > 10000);
  const read = (state) => {
    amb.update(1, { gust: 0.5, listener: LISTENER, forward: NORTH, pods: [], ...state });
    return { top: lp.frequency.target, sends: ctx.made.gain.map((g) => g.gain.target) };
  };
  const flat = read({ gorge: 0 });
  const over = read({ gorge: 1 });
  // more of the forest comes back as reflection, and the wind funnels along it
  const risen = over.sends.filter((v, i) => v > flat.sends[i] * 1.5).length;
  assert.ok(risen >= 2, `only ${risen} gains rise over the gorge — the hall sends and the wind should`);
  assert.ok(over.top === flat.top, 'the gorge is open air, not a lid: it must not touch the bed\'s top');
  // and the crowns still win where both apply: wood and leaves over you beat open air beside you
  const both = read({ gorge: 1, canopy: 1 });
  assert.ok(both.top < flat.top, 'a canopy over the gorge still closes the top');
  assert.ok(read({ gorge: 1, enclosure: 1 }).top < 1200, 'and the tunnel shuts it whatever is outside');
});

test('the bed is deterministic and draws only from the seeded stream', () => {
  const a = bed({ seed: 'same' });
  const b = bed({ seed: 'same' });
  a.amb.update(1, { gust: 0.7, listener: LISTENER, forward: NORTH, pods: [] });
  b.amb.update(1, { gust: 0.7, listener: LISTENER, forward: NORTH, pods: [] });
  assert.deepEqual(gains(a.ctx), gains(b.ctx));
  a.amb.scheduleUntil(30);
  b.amb.scheduleUntil(30);
  assert.deepEqual(a.amb.stats(), b.amb.stats(), 'two beds from one seed must schedule the same forest');
  const other = bed({ seed: 'different' });
  other.amb.scheduleUntil(30);
  assert.notDeepEqual(other.amb.stats(), a.amb.stats());
});

test('the forest is events: birds and leaves are scheduled, and gusts bring more leaves', () => {
  const calm = bed({ seed: 'rate' });
  calm.amb.update(0, { gust: 0.05, listener: LISTENER, forward: NORTH, pods: [] });
  calm.amb.scheduleUntil(120);
  const windy = bed({ seed: 'rate' });
  windy.amb.update(0, { gust: 1, listener: LISTENER, forward: NORTH, pods: [] });
  windy.amb.scheduleUntil(120);
  const c = calm.amb.stats();
  const w = windy.amb.stats();
  assert.ok(c.birds > 4, `only ${c.birds} birds in two minutes`);
  assert.ok(w.flutters > c.flutters * 1.5, `a gust should bring more leaves (${c.flutters} calm, ${w.flutters} windy)`);
  // and even in dead calm the wood is never left silent for long
  assert.ok(c.flutters >= 120 / A.QUIET_GAP_MAX - 1, `${c.flutters} flutters in 120 s of still air leaves gaps over ${A.QUIET_GAP_MAX} s`);
  // birds go the other way to the leaves: they shelter in a blow and sing when it drops
  assert.ok(c.birds > w.birds, `still air should bring MORE birds, not fewer (${c.birds} calm, ${w.birds} windy)`);
});

test('a bird answers when the wind drops', () => {
  // The bed is gated below GUST_KNEE on purpose — that silence is this lane's answer to "LOWER THE
  // WHITE NOISE". Measured on the world's own wind it happens about twice a minute for three
  // seconds (art/audio/2026-09-24-wind/), and at the old flat 3.5–11.5 s gap roughly half of those
  // lulls had nothing in them: the one moment the forest is deliberately quiet was the one moment
  // it had nothing to say.
  // Enough cycles that the answer is not two small numbers being compared: one drop gives three or
  // four calls either way, and which is larger is then a coin toss on the seeded stream.
  const CYCLES = 30;
  const at = (gustOf) => {
    const b = bed({ seed: 'lull' });
    let t = 0;
    for (let i = 0; i < CYCLES * 24; i++) {
      b.amb.update(t, { gust: gustOf(i), listener: LISTENER, forward: NORTH, pods: [] });
      t += 0.5;
    }
    b.amb.scheduleUntil(t + 2);
    return b.amb.stats().birds;
  };
  const blowing = at(() => 0.8);
  const drops = at((i) => (i % 24 < 12 ? 0.8 : 0.1));
  assert.ok(drops > blowing * 1.05, `over ${CYCLES} lulls the drops must bring calls forward (${blowing} while it blew, ${drops} with the drops)`);
  // the trigger is the EDGE, not the level: still air throughout already calls at the still rate,
  // and the edge must not stack a second helping on top of it
  const stillThroughout = at(() => 0.1);
  assert.ok(drops <= stillThroughout * 1.1, `the edge stacked on the still-air rate (${drops} with drops, ${stillThroughout} in still air throughout)`);
  assert.ok(A.BIRD_ANSWERS_LULL[0] > 0.2, 'answering inside a fifth of a second is a reflex, not a bird');
  assert.ok(A.BIRD_ANSWERS_LULL[1] < 3, 'a lull is about three seconds — an answer after it is not an answer');
  assert.ok(A.BIRD_LULL_GAP > 0.3 && A.BIRD_LULL_GAP < 1, 'the still-air gap is a share of the usual one, not a gate');
});

test('the wood has birds in it, not a stream of calls', () => {
  // Before this, the scheduler picked a kind and then drew a fresh bearing and a fresh distance for
  // it: 216 calls over twenty minutes came from 216 places, and a kind's calls scattered 0.47 across
  // a ±0.85 field — indistinguishable from uniform (art/audio/2026-09-24-perches/).
  const { amb } = bed({ seed: 'perch' });
  for (let t = 0; t < 900; t += 0.5) {
    amb.update(t, { gust: 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3), listener: LISTENER, forward: NORTH, pods: [], canopy: 1 });
    amb.scheduleUntil(t + 4);
  }
  const spots = amb.stats().birdSpots;
  assert.ok(spots.length > 8, `only ${spots.length} calls remembered`);
  // every call of a kind comes from that bird's own tree
  const byKind = new Map();
  for (const [kind, pan, distance] of spots) (byKind.get(kind) ?? byKind.set(kind, []).get(kind)).push([pan, distance]);
  for (const [kind, cs] of byKind) {
    const pans = new Set(cs.map((c) => c[0]));
    const dists = new Set(cs.map((c) => c[1]));
    assert.equal(pans.size, 1, `${kind} called from ${pans.size} directions — a bird sits somewhere`);
    assert.equal(dists.size, 1, `${kind} called from ${dists.size} distances`);
  }
  // and the wood is not all on one side of him
  const places = [...byKind.values()].map((cs) => cs[0][0]);
  assert.ok(Math.max(...places) > 0.25 && Math.min(...places) < -0.25, `every bird is between ${Math.min(...places).toFixed(2)} and ${Math.max(...places).toFixed(2)} — they must be round him, not in a clump`);
});

test('the world turns under him: a bearing is a place, not a channel', () => {
  // `panFor` is the one place the convention lives. It was duplicated — once for the wind's lean,
  // once for the birds' perches — and a sign error in either is invisible to every other
  // measurement on this lane, because all of them are mono sums. What a player would hear instead
  // is a wood nailed to the speakers: turn round and the bird on your left stays on your left.
  const N = { x: 0, z: -1 };
  const S = { x: 0, z: 1 };
  const E = { x: 1, z: 0 };
  const W = { x: -1, z: 0 };
  const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-9, `${why}: ${a.toFixed(3)}, expected ${b}`);
  // something due north of him
  near(A.panFor(N, N), 0, 'facing it, a source dead ahead is centre');
  near(A.panFor(S, N), 0, 'with his back to it, it is centre too — a stereo pan cannot say front from back');
  near(A.panFor(W, N), 1, 'facing west, north is hard right');
  near(A.panFor(E, N), -1, 'facing east, north is hard left');
  // and the sweep is continuous and antisymmetric in between
  for (let deg = 0; deg < 360; deg += 15) {
    const th = (deg * Math.PI) / 180;
    const fwd = { x: Math.sin(th), z: Math.cos(th) };
    const back = { x: -fwd.x, z: -fwd.z };
    near(A.panFor(fwd, N), -A.panFor(back, N), `turning right round at ${deg}\u00b0 must mirror the field`);
  }
  // the length of the world vector is a distance, not a loudness: only its bearing may show up here
  near(A.panFor(W, { x: 0, z: -40 }), A.panFor(W, N), 'a bird further off must not pan wider');
  // the wind leans rather than pans, and it leans from where the air comes FROM
  assert.ok(A.WIND_LEAN < A.PERCH_PAN, 'the air is not a point source: it must lean less than a bird sits out');
  near(A.windLeanFor(W, S), A.WIND_LEAN, 'wind travelling south comes from the north, which is his right facing west');
  near(A.windLeanFor(W, N), -A.WIND_LEAN, 'and travelling north it comes from the south, on his left');
});

test('a bird keeps its tree while he turns on the spot', () => {
  // the same perch, heard from four facings: the bearing has to move across him and come back.
  const pansFacing = (fwd) => {
    const { amb } = bed({ seed: 'perch/turn' });
    const seen = new Map();
    for (let t = 0; t < 600; t += 0.5) {
      amb.update(t, { gust: 0.5, listener: LISTENER, forward: fwd, pods: [], canopy: 1 });
      amb.scheduleUntil(t + 4);
      for (const [kind, pan] of amb.stats().birdSpots) seen.set(kind, pan);
    }
    return seen;
  };
  const north = pansFacing({ x: 0, z: -1 });
  const south = pansFacing({ x: 0, z: 1 });
  assert.ok(north.size > 2, `only ${north.size} birds heard`);
  assert.deepEqual([...north.keys()].sort(), [...south.keys()].sort(), 'turning round must not change which birds are in the wood');
  for (const [kind, pan] of north) {
    // the perches are seeded from the listener's position, which has not moved, so turning round
    // must mirror every one of them and nothing else
    assert.ok(Math.abs(pan + south.get(kind)) < 1e-9, `the ${kind} is at ${pan.toFixed(2)} facing north and ${south.get(kind).toFixed(2)} facing south — it should be its mirror`);
  }
  assert.ok(Math.max(...[...north.values()].map(Math.abs)) <= A.PERCH_PAN + 1e-9, 'no bird may sit outside PERCH_PAN');
});

test('the forest does not play the same nine seconds over and over', () => {
  // The whole bed is tapped off one pink buffer. It was nine seconds long and both wind layers
  // played it — one from the start and one a third of the way in, on the reasoning that an offset
  // made them "not the same noise". An offset is the same noise delayed. Five minutes standing
  // still correlated +0.51 with itself at 27 s (`art/audio/2026-09-25-loop/`).
  assert.ok(A.PINK_SECONDS >= 15, `a ${A.PINK_SECONDS} s loop comes round inside the time an ear holds on to it`);
  assert.notEqual(A.LEAF_RATE, 1, 'the second tap must not play the same buffer at the same rate as the first');
  // and not at a rate that re-aligns with it every few loops, which is the same fault with a longer
  // period: 5/6 or 4/5 would put the two back in step after six or five times round
  for (let k = 1; k <= 8; k++) {
    const off = Math.abs(k * A.LEAF_RATE - Math.round(k * A.LEAF_RATE));
    assert.ok(off > 0.03, `${k} turns of the second tap land within ${off.toFixed(3)} of a whole turn of the first — they re-align every ${k}`);
  }
  assert.ok(A.PINK_DRIFT > 0 && A.PINK_DRIFT < 0.06, 'the rate wander has to exist and has to be small enough that noise stays noise');
  assert.ok(A.PINK_DRIFT_HZ < 0.2, 'a fast wander is an effect; this one has to be slower than the gusts');
});

test('both taps of the pink buffer are driven, and driven differently', () => {
  const { ctx } = bed({ seed: 'loop' });
  // by the pink buffer's own length: the flame taps a different looping stereo buffer
  const sources = ctx.made.source.filter((s) => s.buffer && s.loop && Math.abs(s.buffer.duration - A.PINK_SECONDS) < 0.5);
  assert.ok(sources.length >= 2, `${sources.length} looping stereo sources — the bed taps the pink buffer twice`);
  const rates = sources.map((s) => s.playbackRate.value);
  assert.ok(new Set(rates).size > 1, `both taps play at ${rates.join(', ')} — one loop at one rate is one loop`);
  // every tap has an envelope on its rate, so neither comes round to the same place twice
  for (const src of sources) {
    const driven = ctx.made.gain.some((g) => g.outputs.includes(src.playbackRate));
    assert.ok(driven, 'a tap with a fixed rate repeats exactly; each one needs its wander');
  }
});

test('walking far enough puts him among different birds', () => {
  const heard = (moveM) => {
    const { amb } = bed({ seed: 'perch/move' });
    const seen = new Set();
    for (let t = 0; t < 600; t += 0.5) {
      const at = { x: (t / 600) * moveM, y: 1.2, z: 0 };
      amb.update(t, { gust: 0.5, listener: at, forward: NORTH, pods: [], canopy: 1 });
      amb.scheduleUntil(t + 4);
      for (const [kind, pan] of amb.stats().birdSpots) seen.add(`${kind}|${pan}`);
    }
    return seen.size;
  };
  const still = heard(0);
  const walked = heard(A.PERCH_RESEED_M * 6);
  assert.ok(walked > still, `standing still heard ${still} birds and walking ${(A.PERCH_RESEED_M * 6).toFixed(0)} m heard ${walked} — the wood must change as he crosses it`);
  assert.ok(still <= 6, `standing in one place heard ${still} birds; there are six kinds and one of each`);
  assert.ok(A.PERCH_RESEED_M > 10, 'birds must not be re-seeded from under him as he walks');
});

test('moving the birds about does not add any', () => {
  // The claim is "the same number of birds, in different places", and the first attempt at it did
  // not hold: measured over 1800 s the total went 10.5 → 13.3 a minute. Two things push it up once
  // the gap follows the wind — a rate is one over a gap, so a gap that swings either side of its
  // old value yields MORE calls per minute rather than the same; and the lull trigger pulls the
  // next call forward, which brings every call after it forward too. BIRD_GAP_TRIM puts it back,
  // and this is the guard, because the failure mode is an aviary and it creeps.
  const run = (gustOf) => {
    const { amb } = bed({ seed: 'rate/trim' });
    const T = 1200;
    for (let t = 0; t < T; t += 0.25) {
      amb.update(t, { gust: gustOf(t), listener: LISTENER, forward: NORTH, pods: [], canopy: 1 });
      amb.scheduleUntil(t + 4);
    }
    return amb.stats().birds / (T / 60);
  };
  // Under a wind that swings right through the knee — the world's own behaviour — the total is the
  // number to hold, and against the same wind the flat gap gave 10.3 a minute
  // (art/audio/2026-09-24-wind/schedule.mjs, 7200 s, 240 lulls). A ratio against a steady wind is
  // the wrong test: the trim deliberately lengthens a steady mid-wind's gaps, so that comparison
  // reads 143 % and means nothing.
  const swinging = run((t) => 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3));
  assert.ok(swinging > 7 && swinging < 13, `${swinging.toFixed(1)} birds a minute — the flat gap this replaced gave 10.3, and one every four seconds is an aviary`);
  assert.ok(A.BIRD_GAP_TRIM > 1, 'the trim only ever lengthens the gap; without it the rate climbs');
});

test('a term that moved because HE did arrives at his pace, not the weather\u2019s', () => {
  // The bed's spatial terms had five different smoothing times between them (0.12 and 0.9 s), all
  // of them chosen against weather, and a smoothing time is a distance once the listener has a
  // speed. `art/audio/2026-09-25-lag/` measured the ground that costs on five real journeys.
  //
  // This is the contract rather than the constant: run `update` twice with the WEATHER AND THE
  // FACING HELD and only the listener's place changed, take every parameter that moved, and
  // require it to have been aimed with PLACE_TAU. A new spatial term added later with a literal
  // time constant fails here without anyone having to remember this file exists.
  const { ctx, amb } = bed();
  const params = [];
  for (const kind of ['gain', 'filter', 'panner', 'source']) {
    for (const n of ctx.made[kind]) {
      for (const [name, p] of Object.entries(n)) if (p && typeof p === 'object' && Array.isArray(p.events)) params.push({ id: `${kind}.${name}`, p });
    }
  }
  const weather = { gust: 0.6, windDir: { x: 0.7, z: -0.7 }, forward: NORTH, pods: [{ x: 1, y: 2, z: 0 }] };
  // the open village, then well inside the log arch's bore under closed crowns with the ravine open
  amb.update(1, { ...weather, listener: { x: 0, y: 1.2, z: 0 }, canopy: 0, gorge: 0, enclosure: 0 });
  const before = params.map(({ p }) => ({ target: p.target, n: p.events.length }));
  amb.update(2, { ...weather, listener: { x: 7, y: 1.2, z: -3 }, canopy: 1, gorge: 1, enclosure: 1 });
  const moved = params.filter(({ p }, i) => Math.abs(p.target - before[i].target) > 1e-12);
  assert.ok(moved.length >= 5, `only ${moved.length} parameters noticed that he had moved seven metres into a log`);
  for (const { id, p } of moved) {
    const last = [...p.events].reverse().find((e) => e[0] === 'tgt');
    assert.ok(last, `${id} moved with him but was not aimed with setTargetAtTime`);
    assert.equal(last[3], A.PLACE_TAU, `${id} moved because the listener did and was smoothed over ${last[3]} s — at a run that is ${(last[3] * 4.2).toFixed(2)} m of ground behind him`);
  }
  // and the weather's own terms are left where they were: the gust is two sines whose fastest
  // component has a seventeen-second period, so their longer times smooth nothing that moves
  const held = params.filter(({ p }, i) => p.events.length > before[i].n && Math.abs(p.target - before[i].target) <= 1e-12);
  const weatherTaus = new Set(held.map(({ p }) => [...p.events].reverse().find((e) => e[0] === 'tgt')?.[3]).filter((v) => v !== A.PLACE_TAU && v !== undefined));
  assert.ok(weatherTaus.size > 0, 'nothing is left on a weather time — either the split is gone or the fake no longer records it');
});

test('a call booked four seconds ago comes from the tree, not from where he was looking', () => {
  // `scheduleBirds` runs on a four-second lookahead, so a call's bearing used to be decided up to
  // four seconds before it was heard — and an answering call up to six and a half. Walking does not
  // matter (a perch is a bearing from the anchor, deliberately), but turning does, and turning is
  // what a player does most. Measured, a call swept the same 0.1 pan units standing still as it did
  // at sixty degrees a second (`art/audio/2026-09-25-turning/`).
  //
  // `windDir` is left out on purpose: then the ONLY panner in the bed that answers a change of
  // facing is a bird's, so the live voices identify themselves and the test does not have to know
  // the graph's shape.
  const { ctx, amb } = bed({ seed: 'turn/guard' });
  const N = { x: 0, z: -1 };
  const S = { x: 0, z: 1 };
  const base = { gust: 0.5, listener: LISTENER, pods: [], canopy: 1 };
  let t = 0;
  let pending = [];
  // run until the wood has booked a call that has not sounded yet — that is the one this is about
  for (; t < 600; t += 1 / 30) {
    amb.update(t, { ...base, forward: N });
    amb.scheduleUntil(t + 4);
    pending = amb.stats().birdSpots.filter(([, , , at]) => at > t + 0.5);
    if (pending.length > 0 && amb.stats().birds > 6) break;
  }
  assert.ok(pending.length > 0, 'nothing is booked ahead of the clock, so there is nothing to keep up');
  // one more tick facing north, so a voice created by the tick that broke the loop has been aimed
  // once before the snapshot — otherwise its target is still whatever the node was built with
  t += 1 / 30;
  amb.update(t, { ...base, forward: N });
  const before = ctx.made.panner.map((p) => p.pan.target);
  amb.update(t, { ...base, forward: S });
  const moved = ctx.made.panner.map((p, i) => ({ i, before: before[i], after: p.pan.target })).filter((r) => Math.abs(r.after - r.before) > 1e-9);
  assert.ok(moved.length > 0, `he turned right round and not one of ${ctx.made.panner.length} panners noticed`);
  for (const r of moved) {
    assert.ok(Math.abs(r.after + r.before) < 1e-9, `a bird sat at ${r.before.toFixed(3)} facing north and ${r.after.toFixed(3)} facing south — turning round must mirror it`);
  }
  // …and only the calls that are still going: the register has to let a finished voice go, or every
  // bird the wood has ever sung stays on the books and follows him about for the rest of the session
  assert.ok(moved.length <= 4, `${moved.length} voices are still being re-aimed out of ${ctx.made.panner.length} panners — finished calls are not being dropped`);
  assert.ok(ctx.made.panner.length > moved.length * 3, 'the wood should have sung many more calls than are alive at once');
});

test('walk past a tree and the bird in it goes past you', () => {
  // A perch used to be a bearing and a distance from the spot the wood was drawn at, held until he
  // had walked PERCH_RESEED_M — twenty-five metres — so inside that radius a bird did not move
  // relative to him at all. Measured on a two-minute pace along a 21 m line
  // (`art/audio/2026-09-25-parallax/`), a call arrived a median 20 degrees from its own tree at a
  // walk and 49 at a run, the worst of them 139 — the wrong side of him.
  //
  // The contract is the geometry itself: standing anywhere, a call's bearing and distance must be
  // the ones its own tree has from THERE. `perchSpots` publishes where the trees are.
  const { amb } = bed({ seed: 'perch/parallax' });
  const N = { x: 0, z: -1 };
  const base = { gust: 0.5, forward: N, pods: [], canopy: 1 };
  const runAt = (x, z, from, until) => {
    for (let t = from; t < until; t += 1 / 30) {
      amb.update(t, { ...base, listener: { x, y: 1.2, z } });
      amb.scheduleUntil(t + 4);
    }
    return amb.stats();
  };
  // stand at the origin long enough to draw the wood and hear it, then twelve metres east — well
  // inside the re-seed radius, so it must be the SAME six birds seen from a different place
  const a = runAt(0, 0, 0, 90);
  const seenAt = (stats, since) => stats.birdSpots.filter(([, , , at]) => at >= since);
  const first = seenAt(a, 0);
  assert.ok(first.length >= 3, `only ${first.length} calls in ninety seconds`);
  const b = runAt(12, 0, 90, 200);
  const perches = new Map(b.perchSpots.map(([kind, x, z]) => [kind, { x, z }]));
  assert.equal(perches.size, 6, 'the wood must not have been re-seeded: twelve metres is inside PERCH_RESEED_M');
  assert.ok(A.PERCH_RESEED_M > 12, 'this test assumes twelve metres does not re-seed');

  // every call made while he stood at (12, 0) must point at its own tree from there
  for (const [kind, pan, distance, at] of seenAt(b, 91)) {
    const p = perches.get(kind);
    const want = A.panFor(N, { x: p.x - 12, z: p.z - 0 }) * A.PERCH_PAN;
    const wantD = Math.min(1, Math.hypot(p.x - 12, p.z) / A.PERCH_FAR_M);
    // birdSpots publishes to three decimals, so that is the tolerance
    assert.ok(Math.abs(pan - want) < 1e-3, `the ${kind} at ${at.toFixed(1)} s came from ${pan.toFixed(3)} and its tree is at ${want.toFixed(3)} from where he is standing`);
    assert.ok(Math.abs(distance - wantD) < 1e-3, `the ${kind} was given distance ${distance.toFixed(3)} and its tree is ${wantD.toFixed(3)} away`);
  }
  // …and the move has to have been worth something: the same bird must not be in the same place
  const panOf = (stats, since) => {
    const m = new Map();
    for (const [kind, pan, , at] of stats.birdSpots) if (at >= since) m.set(kind, pan);
    return m;
  };
  const before = panOf(a, 0);
  const after = panOf(b, 91);
  const shared = [...after.keys()].filter((k) => before.has(k));
  assert.ok(shared.length > 0, 'no bird called from both places, so nothing can be compared');
  assert.ok(
    shared.some((k) => Math.abs(before.get(k) - after.get(k)) > 0.02),
    `walking twelve metres moved no bird: ${shared.map((k) => `${k} ${before.get(k).toFixed(3)}→${after.get(k).toFixed(3)}`).join(', ')}`,
  );
});
