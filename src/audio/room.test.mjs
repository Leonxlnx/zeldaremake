// node --test src/audio/room.test.mjs — the space a step is standing in.
//
// `surfaceAt` has known he is indoors since the huts became rooms
// (art/audio/2026-09-24-indoors/), but his boots did not: rendering the steps stem with the space
// term forced to 0, to a hut's 0.7 and to the bore's 1 gave three files that differed only at the
// renderer's own last bit. A step in a small plank box was the same sound as a step in a clearing.
//
// The two things that can go quietly wrong here are both shape rather than level, so both are
// asserted directly on the impulse and on the graph rather than by listening to a render:
//
//   * a space that starts answering at t = 0 is not a space. It adds a copy of the source to the
//     source and thickens the attack, which measured as a hut being LESS reflective than open air.
//   * the room must not become the hall. If its tail grows to the wood's, walking into a hut will
//     sound like walking into a bigger forest.
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
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const G = loadTs(path.join(here, 'graph.ts'));
const { createFootsteps, ROOM_SEND, ROOM_MIN } = loadTs(path.join(here, 'footsteps.ts'));
const { createRng } = loadTs(path.join(here, '../world/util/prng.ts'));

const param = (value) => ({ value, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });

function fakeContext(sampleRate = 44100) {
  const made = [];
  const node = (kind, extra = {}) => {
    const n = { kind, outputs: [], connect(d) { this.outputs.push(d); return d; }, disconnect() {}, ...extra };
    made.push(n);
    return n;
  };
  return {
    sampleRate,
    currentTime: 0,
    made,
    destination: node('destination'),
    // offline, so the voices' cleanup timers never start (see graph.ts cleanupAt)
    startRendering: () => {},
    createGain: () => node('gain', { gain: param(1) }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
    createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }),
    createStereoPanner: () => node('panner', { pan: param(0) }),
    createBufferSource: () => node('source', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} }),
    createConvolver: () => node('convolver', { buffer: null, normalize: true }),
    createDelay: () => node('delay', { delayTime: param(0) }),
    createDynamicsCompressor: () => node('compressor', { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }),
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate: rate, duration: length / rate, numberOfChannels: channels, getChannelData: (c) => data[c], copyToChannel: (s, c) => data[c].set(s.subarray(0, data[c].length)) };
    },
  };
}

/** every node reachable from `from`, so "does a step feed the room" is asked of the graph itself */
function reaches(from, target, seen = new Set()) {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return (from.outputs ?? []).some((o) => reaches(o, target, seen));
}

/** every gain feeding the room convolver — what a step actually sent into the space */
const sendsInto = (ctx, room) => ctx.made.filter((n) => n.kind === 'gain' && n.outputs.includes(room)).map((n) => n.gain.value);

test('the room starts answering after the direct sound, not with it', () => {
  const ctx = fakeContext();
  const ir = G.impulseResponse(ctx, createRng('ir/test'), G.ROOM_SECONDS, 0.9, G.ROOM_EARLY_AT, G.ROOM_EARLY_SPREAD, G.ROOM_EARLY_AT);
  const d = ir.getChannelData(0);
  const pre = Math.floor(ctx.sampleRate * G.ROOM_EARLY_AT);
  for (let i = 0; i < pre; i++) assert.equal(d[i], 0, `the room is already sounding ${((i / ctx.sampleRate) * 1000).toFixed(1)} ms in, before the boot has reached the wall`);
  assert.ok(
    d.slice(pre, pre + 200).some((v) => v !== 0),
    'nothing comes back at all — the pre-delay has swallowed the impulse',
  );
  // and the default is still 0, so the wood's own hall is exactly the impulse it always was
  const hall = G.impulseResponse(ctx, createRng('ir/test'), 1.5, 0.96);
  assert.notEqual(hall.getChannelData(0)[1], 0, 'the hall must be unchanged by the room: its impulse starts at once');
});

test('a hut is not a bigger wood: the room is short, dark and its own convolver', () => {
  const ctx = fakeContext();
  const buses = G.createBuses(ctx, createRng('buses/test'));
  assert.ok(buses.room && buses.roomReturn, 'the buses carry a room');
  assert.notEqual(buses.room, buses.reverb, 'the room must not be the hall with more send on it');
  assert.ok(buses.room.buffer.duration < buses.reverb.buffer.duration / 3, `the room (${buses.room.buffer.duration.toFixed(2)} s) has to die well before the wood (${buses.reverb.buffer.duration.toFixed(2)} s)`);
  assert.equal(buses.roomReturn.gain.value, G.ROOM_RETURN);
  // the impulse the buses actually built, not just the one the function can build
  const built = buses.room.buffer.getChannelData(0);
  const pre = Math.floor(ctx.sampleRate * G.ROOM_EARLY_AT);
  assert.ok(
    built.slice(0, pre).every((v) => v === 0),
    'the room the buses built answers from t = 0 — it will thicken every step instead of reflecting it',
  );
  assert.ok(
    built.slice(pre, pre + 400).some((v) => v !== 0),
    'the room the buses built never answers at all',
  );
  // the return joins the master, never the sfx bus, so the room is not scaled by the steps' own pad
  assert.ok(reaches(buses.roomReturn, buses.master), 'the room has to reach the master');
  assert.ok(!reaches(buses.sfx, buses.roomReturn), 'the room returns through the sfx bus');
});

test('a step outdoors builds no room at all, and indoors sends it in proportion', () => {
  for (const [enclosure, want] of [
    [0, null],
    [ROOM_MIN, null],
    [0.7, ROOM_SEND * 0.7],
    [1, ROOM_SEND],
  ]) {
    const ctx = fakeContext();
    const buses = G.createBuses(ctx, createRng('buses/test'));
    const steps = createFootsteps(ctx, buses.sfx, buses.reverb, buses.room, createRng('steps/test'), 0);
    steps.drive(1, 0.05, { speed: 1.6, surface: 'wood', onStairs: false, enclosure });
    const sent = sendsInto(ctx, buses.room);
    if (want === null) {
      assert.deepEqual(sent, [], `enclosure ${enclosure} built a room around a step that is outdoors`);
    } else {
      assert.equal(sent.length, 1, `enclosure ${enclosure}: ${sent.length} sends into the room, expected one`);
      assert.ok(Math.abs(sent[0] - want) < 1e-9, `enclosure ${enclosure}: sent ${sent[0]}, expected ${want}`);
    }
  }
});

test('the landing and the shove are in the room too, not only the walk', () => {
  for (const fire of [(s) => s.land(1, 'wood', 1.4, 0.7), (s) => s.pushOff(1, 'wood', 2.2, 0.7)]) {
    const ctx = fakeContext();
    const buses = G.createBuses(ctx, createRng('buses/test'));
    const steps = createFootsteps(ctx, buses.sfx, buses.reverb, buses.room, createRng('steps/test'), 0);
    fire(steps);
    assert.deepEqual(sendsInto(ctx, buses.room), [ROOM_SEND * 0.7], 'a boot that is not a walking step still happens in the room');
  }
});
