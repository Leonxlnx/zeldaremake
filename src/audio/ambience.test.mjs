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
    setTargetAtTime(v, t) {
      this.target = v;
      this.events.push(['tgt', v, t]);
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
  amb.update(1, { gust: 1, listener: LISTENER, forward: NORTH, pods: [] });
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

test('the waterfall roars by its pool, fades down the trail and is silent in the village', () => {
  // the ruins' plunge (ruins/index.ts marks it a metre over the waterline) and where Link stands
  const plunge = [{ x: -72.9, y: 1.55, z: 2.7 }];
  const terrace = { x: -70, y: 5.7, z: -3 };
  const { ctx, amb } = bed();
  const moved = respondsTo(ctx, amb, { listener: terrace, falls: [] }, { listener: terrace, falls: plunge });
  const opened = moved.filter((r) => r.before === 0 && r.after > 0);
  assert.equal(opened.length, 1, `${opened.length} gains open when a fall is in reach, expected the fall's own level`);
  const level = opened[0].node;
  const read = (listener, state = {}) => {
    amb.update(5, { gust: 0.5, listener, forward: NORTH, pods: [], falls: plunge, ...state });
    return level.gain.target;
  };
  const byPool = read(terrace);
  const outcrop = read({ x: -57, y: 4.1, z: -4.3 });
  const trail = read({ x: -41, y: 3.2, z: -1.6 });
  assert.ok(byPool > outcrop * 2 && outcrop > trail && trail > 0, `the fall should fall away with distance (pool ${byPool}, outcrop ${outcrop}, trail ${trail})`);
  assert.equal(read(LISTENER), 0, 'the village must not hear the fall at all');
  assert.equal(A.fallAttenuation(A.FALL_AUDIBLE_M), 0);
  assert.ok(read(plunge[0]) <= A.FALL_LEVEL + 1e-9, 'the fall must never exceed its own level');
  // water, not weather: the gust and the lanterns leave it alone
  assert.equal(read(terrace, { gust: 0 }), read(terrace, { gust: 1 }));
  assert.equal(read(terrace, { pods: [{ x: -70, y: 6, z: -3 }] }), byPool);
  assert.ok(amb.stats().fall > 0.3, `standing over the pool the stats should say the fall is near (${amb.stats().fall})`);
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
});
