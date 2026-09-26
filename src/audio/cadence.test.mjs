// node --test src/audio/cadence.test.mjs — he takes the same number of steps per metre however
// often the audio is asked.
//
// Rubric check 28 is "nothing fires twice for one event, and nothing is missed at any frame rate".
// It scored 3 with the note "not tested across frame rates", and the note was covering this:
//
//     travelled += speed * dt;
//     if (travelled >= stride) { travelled -= stride; fire(); }   // and fire() set travelled = 0
//
// `fire` zeroing the integrator is right for a boot plant, a shove or a landing — the stride
// restarts from there — and wrong for the distance path, because it throws away however far he had
// gone PAST the trigger. That is half a tick's worth every step, so the loss scales with the tick:
// at the shipping 33 ms it was 6–7 % of his steps never sounding, and at a tenth of a second 16 %.
//
// A stride is a distance. Steps per metre is therefore the thing that must not move, and it is the
// only honest way to state the contract — steps per second legitimately changes with speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
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
const F = loadTs(path.join(here, 'footsteps.ts'));
const { createRng } = loadTs(path.join(here, '../world/util/prng.ts'));

const param = (v) => ({ value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
const node = (kind, extra = {}) => ({ kind, outputs: [], connect(d) { this.outputs.push(d); return d; }, disconnect() {}, ...extra });
const fakeCtx = () => ({
  sampleRate: 44100,
  currentTime: 0,
  // offline, so the voices' cleanup timers never start
  startRendering: () => {},
  destination: node('dest'),
  createGain: () => node('gain', { gain: param(1) }),
  createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: param(1), Q: param(1), gain: param(0) }),
  createOscillator: () => node('osc', { type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} }),
  createStereoPanner: () => node('pan', { pan: param(0) }),
  createBufferSource: () => node('src', { buffer: null, loop: false, playbackRate: param(1), start() {}, stop() {} }),
  createBuffer(c, l, r) {
    const d = Array.from({ length: c }, () => new Float32Array(l));
    return { length: l, sampleRate: r, duration: l / r, numberOfChannels: c, getChannelData: (i) => d[i], copyToChannel: (s, i) => d[i].set(s.subarray(0, d[i].length)) };
  },
});

/** walk `metres` at `speed`, asked every `dt` seconds; returns steps per metre */
function perMetre(speed, dt, metres = 400, surface = 'stone') {
  const ctx = fakeCtx();
  const steps = F.createFootsteps(ctx, ctx.createGain(), ctx.createGain(), null, null, createRng('cadence/test'), 0);
  for (let t = 0; t < metres / speed; t += dt) steps.drive(t, dt, { speed, surface, onStairs: false });
  return steps.stats().steps / metres;
}

test('a stride is a distance, so the tick rate cannot change how many steps a walk takes', () => {
  const want = 1 / F.strideFor(F.WALK_SPEED, false);
  // 8 ms to 250 ms covers a fast machine, the shipping 33 ms tick, the offline render's 50, and a
  // box loaded badly enough that the timer stretches by a factor of eight
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20, 1 / 15, 1 / 10, 1 / 6, 1 / 4]) {
    const got = perMetre(F.WALK_SPEED, dt);
    assert.ok(Math.abs(got / want - 1) < 0.03, `at a ${(dt * 1000).toFixed(0)} ms tick he takes ${got.toFixed(3)} steps a metre, and a stride says ${want.toFixed(3)}`);
  }
});

test('and a run, up to the one-step-per-tick ceiling that is arithmetic rather than a fault', () => {
  const want = 1 / F.strideFor(F.RUN_GROUND_SPEED, false);
  // a run needs about five steps a second, so a tick longer than ~200 ms cannot deliver them: only
  // one step fires per tick by construction. Below that ceiling the count must hold.
  for (const dt of [1 / 120, 1 / 60, 1 / 30]) {
    const got = perMetre(F.RUN_GROUND_SPEED, dt);
    assert.ok(Math.abs(got / want - 1) < 0.03, `at a ${(dt * 1000).toFixed(0)} ms tick he takes ${got.toFixed(3)} steps a metre running, and a stride says ${want.toFixed(3)}`);
  }
  // past the ceiling it must degrade to exactly one step per tick and no worse — a guard against
  // the loss compounding rather than simply being capped
  for (const dt of [1 / 3, 1 / 2, 1]) {
    const got = perMetre(F.RUN_GROUND_SPEED, dt) * F.RUN_GROUND_SPEED;
    assert.ok(got <= (1 / dt) * 1.01, `${got.toFixed(2)} steps a second at a ${(dt * 1000).toFixed(0)} ms tick is more than one a tick (the loop fires on its first tick too, hence the 1 %)`);
    assert.ok(got > 0.75 / dt, `only ${got.toFixed(2)} steps a second at a ${(dt * 1000).toFixed(0)} ms tick — the ceiling is ${(1 / dt).toFixed(2)} and it should be near it`);
  }
});

/**
 * A jump's arc, sampled at whatever rate the caller asks. `airHeight` is 0 on the ground and the
 * clearance above it in flight, so a jump of `peak` metres lasting `flight` seconds is a parabola
 * and the ticks land wherever they land.
 */
function jumpAir(peak, flight, dt, pad = 0.5) {
  const out = [];
  for (let t = -pad; t < flight + pad; t += dt) {
    const u = t / flight;
    out.push(t < 0 || t > flight ? 0 : Math.max(0, 4 * peak * u * (1 - u)));
  }
  return out;
}

/** run an air trace through the shipped machine and count what it fired */
function contacts(trace) {
  let peakAir = 0;
  const fired = [];
  for (const air of trace) {
    const c = F.contactFor(air, peakAir);
    if (c.event) fired.push({ event: c.event, fall: c.fall });
    peakAir = c.peakAir;
  }
  return fired;
}

test('one jump is one shove and one landing, at every frame rate', () => {
  // The other half of rubric check 28. The distance integrator was driven at eight frame rates and
  // a real fault came out of it; this machine had never been driven at all, because it lived
  // inside `mountAudio`'s tick where a test could not reach it.
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20, 1 / 15, 1 / 10, 1 / 6]) {
    const fired = contacts(jumpAir(0.8, 0.62, dt));
    const shoves = fired.filter((f) => f.event === 'shove').length;
    const lands = fired.filter((f) => f.event === 'land');
    assert.equal(shoves, 1, `at a ${(dt * 1000).toFixed(0)} ms tick one jump fired ${shoves} shoves`);
    assert.equal(lands.length, 1, `at a ${(dt * 1000).toFixed(0)} ms tick one jump fired ${lands.length} landings`);
    assert.equal(fired[0].event, 'shove', 'the landing came before the shove');
    // and the fall it reports is the arc's real height, because `landingStrength` scales with it.
    // A slow tick samples the parabola coarsely and can only ever UNDER-read the peak.
    const fall = lands[0].fall;
    assert.ok(fall <= 0.8 + 1e-9, `the fall read ${fall.toFixed(3)} m off a 0.8 m arc — a sampled peak cannot exceed the real one`);
    assert.ok(fall > 0.8 * 0.9, `at a ${(dt * 1000).toFixed(0)} ms tick the fall read ${fall.toFixed(3)} m off a 0.8 m arc, more than a tenth low`);
  }
});

test('every contact has both ends, at every size of arc', () => {
  // The hole this found, and the reason the machine was extracted. The shove used to open at
  // 0.02 and the landing to need 0.05, so an arc peaking between them shoved and never landed —
  // a contact with no answer, which is the fault `2026-09-24-jump` was written to remove, sitting
  // inside the machine that removed it.
  for (const peak of [0.01, 0.021, 0.03, 0.049, 0.051, 0.1, 0.8]) {
    const fired = contacts(jumpAir(peak, 0.3, 1 / 60));
    const shoves = fired.filter((f) => f.event === 'shove').length;
    const lands = fired.filter((f) => f.event === 'land').length;
    assert.equal(shoves, lands, `a ${(peak * 100).toFixed(1)} cm arc fired ${shoves} shoves and ${lands} landings — every contact must have both ends or neither`);
  }
});

test('and the one threshold costs the shove under a fifth of a tick', () => {
  // Using the landing's threshold for both edges delays the shove to where the arc passes 5 cm
  // rather than 2. That is a real cost and it is small; this is the number, rather than the claim.
  const peak = 0.8;
  const flight = 0.62;
  const at = (h) => (flight / 2) * (1 - Math.sqrt(Math.max(0, 1 - h / peak)));
  const late = at(F.AIR_MIN) - at(0.02);
  assert.ok(late < 0.033 / 5, `the shove now fires ${(late * 1000).toFixed(1)} ms into the arc rather than ${(at(0.02) * 1000).toFixed(1)}, which is not under a fifth of the 33 ms tick`);
});

test('a height that flickers on the threshold does not machine-gun', () => {
  // `airHeight` comes from the character system and is a float. If it ever chatters across
  // `AIR_MIN` the machine sees a rising edge each time, and a shove is the loudest thing a boot
  // makes. `MIN_STEP_GAP` is the backstop and this is the check that it is reached.
  const trace = [];
  for (let i = 0; i < 120; i++) trace.push(i % 2 ? F.AIR_MIN + 0.005 : 0);
  const fired = contacts(trace);
  const shoves = fired.filter((f) => f.event === 'shove').length;
  assert.ok(shoves > 1, 'the flicker did not reach the machine; this test is not testing anything');
  // the machine itself cannot suppress them — it has no clock — so the guard has to be downstream
  const ctx = fakeCtx();
  const steps = F.createFootsteps(ctx, ctx.createGain(), ctx.createGain(), null, null, createRng('chatter'), 0);
  let t = 0;
  for (const air of trace) {
    if (F.contactFor(air, 0).event === 'shove') steps.pushOff(t, 'stone', 1.2);
    t += 1 / 60;
  }
  const heard = steps.stats().pushOffs;
  const cap = Math.ceil(t / F.MIN_STEP_GAP) + 1;
  assert.ok(heard <= cap, `${shoves} flickers became ${heard} shoves in ${t.toFixed(1)} s; MIN_STEP_GAP caps it at ${cap}`);
});

/**
 * A real gait's stance flags: two boots, each down for half the cycle, offset by half. One gait
 * cycle is two steps, so a rising edge comes every `stride / speed` seconds — which is the same
 * cadence the distance integrator is asked for, and the point of the comparison.
 */
function stanceAt(t, speed, onStairs) {
  const cycle = (2 * F.strideFor(speed, onStairs)) / speed;
  const u = ((t % cycle) + cycle) % cycle;
  return [u < cycle / 2, u >= cycle / 2];
}

/** walk `metres` driven by the gait's flags rather than by distance; returns steps per metre */
function gaitPerMetre(speed, dt, metres = 400, surface = 'stone') {
  const ctx = fakeCtx();
  const steps = F.createFootsteps(ctx, ctx.createGain(), ctx.createGain(), null, null, createRng('cadence/gait'), 0);
  for (let t = 0; t < metres / speed; t += dt) steps.drive(t, dt, { speed, surface, onStairs: false, stance: stanceAt(t, speed, false) });
  return steps.stats().steps / metres;
}

test("the gait's own boot plants survive the tick rate too", () => {
  // The other path through `drive`, and the one that actually runs in play whenever the character
  // system publishes `feetContact`. Its twin was driven at eight frame rates in
  // `2026-09-25-tickrate` and a real fault came out; this one had never been driven at all.
  for (const [speed, label] of [
    [F.WALK_SPEED, 'a walk'],
    [F.RUN_GROUND_SPEED, 'a run'],
  ]) {
    const want = 1 / F.strideFor(speed, false);
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20, 1 / 15]) {
      const got = gaitPerMetre(speed, dt);
      assert.ok(Math.abs(got / want - 1) < 0.05, `${label} at a ${(dt * 1000).toFixed(0)} ms tick gives ${got.toFixed(3)} steps a metre off the gait's flags, and a stride says ${want.toFixed(3)}`);
    }
  }
});

test('and the two paths agree with each other, not just with the stride', () => {
  // A player can be driven either way in the same session — `gaitDriven` flips with whether
  // `feetContact` is published — so the two must not disagree about how often a boot lands.
  for (const speed of [F.WALK_SPEED, F.RUN_GROUND_SPEED]) {
    const a = perMetre(speed, 1 / 30);
    const b = gaitPerMetre(speed, 1 / 30);
    assert.ok(Math.abs(a / b - 1) < 0.05, `at ${speed} m/s the distance path gives ${a.toFixed(3)} steps a metre and the gait's flags ${b.toFixed(3)}`);
  }
});

test('flags that freeze while he keeps walking hand back to the distance integrator', () => {
  // `gaitUntil = t + 1.2` locks the integrator out after every gait-driven step, so that the two
  // paths never both fire. If the publisher stalls — the flags still arriving but no longer
  // toggling — nothing can fire until that lock expires. The question is how long he walks in
  // silence, and whether the integrator ever takes over at all.
  const ctx = fakeCtx();
  const steps = F.createFootsteps(ctx, ctx.createGain(), ctx.createGain(), null, null, createRng('cadence/freeze'), 0);
  const dt = 1 / 30;
  const speed = F.WALK_SPEED;
  let last = 0;
  let gap = 0;
  const frozen = stanceAt(2.0, speed, false);
  for (let t = 0; t < 12; t += dt) {
    const before = steps.stats().steps;
    steps.drive(t, dt, { speed, surface: 'stone', onStairs: false, stance: t < 2 ? stanceAt(t, speed, false) : frozen });
    if (steps.stats().steps > before) {
      if (t > 2) gap = Math.max(gap, t - last);
      last = t;
    }
  }
  assert.ok(steps.stats().steps > 20, `only ${steps.stats().steps} steps in twelve seconds — the integrator never took over from the frozen flags`);
  // The silence must be the LOCK and nothing more. It used to be 1.60 s — 1.2 s of lock and then
  // a whole stride from zero, because the integrator was not merely held off, it was frozen and
  // lost the distance he covered. Now it shadows the gait, so the stride is already banked when
  // the lock lifts: 1.2 s plus the tick it is noticed on.
  assert.ok(gap < 1.2 + 2 * dt, `he walked ${gap.toFixed(2)} s in silence after the gait's flags froze; the lock is 1.2 s and the integrator should have a stride banked by the time it lifts`);
});

test('a frame that runs long does not turn a walk into a run', () => {
  // The tick read Link's speed off the WALL clock, and he does not move on it: `main.ts` clamps
  // the simulation's dt at 0.1 s, so a 300 ms frame advances him a tenth of a second's worth of
  // ground. Dividing that by the wall's 300 ms (or by the clamped 100 — the audio tick is 33 ms
  // and rarely reaches the clamp, so both estimators behaved the same) gave a speed he never
  // travelled at, and speed is not only the stride: it picks the level and swaps the design.
  //
  // Measured in the real build, one 300 ms blocking frame a second on a 1.2 m/s walk: 4 % of
  // ticks read as a RUN and 16 % of his boots landed over 3 dB above their own twin, worst
  // +6.1 dB (`art/audio/2026-09-26-hitch/`).
  const walk = F.strengthFor(F.WALK_SPEED);
  // the simulation advances by the CLAMPED dt however long the frame was; the wall does not
  for (const frameMs of [16.7, 33.3, 100, 150, 200, 300, 500, 1000]) {
    const sim = Math.min(0.1, frameMs / 1000);
    const { speed, dt } = F.paceFrom(F.WALK_SPEED * sim, sim, 0);
    assert.ok(Math.abs(speed - F.WALK_SPEED) < 1e-9, `a ${frameMs.toFixed(0)} ms frame reported ${speed.toFixed(2)} m/s for a 1.2 m/s walk`);
    assert.ok(speed < F.RUN_SPEED, `a ${frameMs.toFixed(0)} ms frame made a walk read as a run`);
    assert.ok(Math.abs(F.strengthFor(speed) - walk) < 1e-9, `a ${frameMs.toFixed(0)} ms frame changed the step's strength`);
    // and the integrator is still handed exactly the ground he covered, which is the one property
    // the old arithmetic did keep and the thing that must not be lost in fixing it
    assert.ok(Math.abs(speed * dt - F.WALK_SPEED * sim) < 1e-9, `a ${frameMs.toFixed(0)} ms frame gave the integrator ${(speed * dt).toFixed(4)} m where he moved ${(F.WALK_SPEED * sim).toFixed(4)}`);
  }
});

test('a tick the simulation did not move under is not a standstill', () => {
  // The audio runs on a timer and the world on animation frames, so ticks where nothing was
  // stepped are normal, not exceptional — on a starved frame pattern a QUARTER of them. Calling
  // those a standstill is wrong twice over: `drive` returns under 0.25 m/s before it looks at the
  // gait's stance flags, and it resets the stride he had banked.
  const { speed, dt } = F.paceFrom(0, 0, F.WALK_SPEED);
  assert.equal(speed, F.WALK_SPEED, 'a tick with no simulation under it threw away the speed he was walking at');
  assert.equal(dt, 0, 'and handed the stride integrator distance he had not travelled');

  // held across a stall of any length, and the integrator still gets nothing
  let held = F.WALK_SPEED;
  let banked = 0;
  for (let i = 0; i < 30; i++) {
    const r = F.paceFrom(0, 0, held);
    held = r.speed;
    banked += r.speed * r.dt;
  }
  assert.equal(held, F.WALK_SPEED, 'a long stall decayed the speed');
  assert.equal(banked, 0, `a stall banked ${banked} m of stride he did not walk`);

  // and when he really has stopped, the simulation says so and the speed follows it down
  const stopped = F.paceFrom(0, 1 / 30, held);
  assert.ok(stopped.speed < 0.25, `standing still with the simulation running reported ${stopped.speed} m/s`);
});

test('the same ground covered reports the same speed however the frames fell', () => {
  // the property in one line: two frame patterns, same ground, same simulation time, same speed
  const total = 6.0;
  const patterns = [
    Array(180).fill(1 / 30),
    Array(360).fill(1 / 60),
    // sixty smooth frames and one long one a second, which is the case that was broken
    Array(6).fill([...Array(45).fill(1 / 60), 0.1]).flat(),
    // and the harness's: `__ZR_PLAY__.step(n, dt)` advances the world n frames inside one call,
    // so half a second of world can land between two audio ticks. Nothing may cap the interval —
    // a tenth-of-a-second ceiling here would call that walk a 6 m/s sprint.
    Array(12).fill(0.5),
  ];
  for (const frames of patterns) {
    const sim = frames.reduce((a, b) => a + b, 0);
    let ground = 0;
    let held = 0;
    const speeds = [];
    for (const f of frames) {
      const r = F.paceFrom(F.WALK_SPEED * f, f, held);
      held = r.speed;
      ground += r.speed * r.dt;
      speeds.push(r.speed);
    }
    const worst = speeds.reduce((a, s) => Math.max(a, Math.abs(s - F.WALK_SPEED)), 0);
    assert.ok(worst < 1e-9, `a ${frames.length}-frame pattern over ${sim.toFixed(2)} s was off by ${worst.toFixed(3)} m/s at worst`);
    assert.ok(Math.abs(ground - F.WALK_SPEED * sim) < 1e-9, `it banked ${ground.toFixed(3)} m where he walked ${(F.WALK_SPEED * sim).toFixed(3)}`);
    assert.ok(sim <= total + 1e-9, 'pattern longer than the walk');
  }
});

test('and the tick hands it the simulation clock, not the wall', () => {
  // `paceFrom` is pure, so the three tests above cannot see WHICH clock the live tick feeds it —
  // put the wall clock back at the call site and they all still pass. That half of the fault is
  // wiring, and the only other thing that catches it is a recording (`art/audio/2026-09-26-hitch/`
  // measures it off the master at 16 % of plants over 3 dB), which is not something `node --test`
  // can run. This reads the call site instead, the way footsteps.test.mjs reads `CLIP_SPEC`.
  const src = readFileSync(path.join(here, 'index.ts'), 'utf8');
  const call = src.match(/paceFrom\(([^;]*?)\);/);
  assert.ok(call, 'the tick should still call paceFrom — has it moved or been renamed?');
  // split on the commas between arguments, not the ones inside `Math.hypot(...)`
  const args = [];
  let depth = 0;
  let at = 0;
  for (let i = 0; i < call[1].length; i++) {
    const c = call[1][i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      args.push(call[1].slice(at, i).trim());
      at = i + 1;
    }
  }
  args.push(call[1].slice(at).trim());
  assert.equal(args.length, 3, `paceFrom is called with ${args.length} arguments: ${call[1]}`);
  assert.equal(args[1], 'simElapsed', `the tick divides the ground he covered by \`${args[1]}\`; he covers it on the simulation clock`);
  // and that clock has to come from something the world actually steps
  assert.match(src, /const simNow = o\.wind\?\.uniforms\.uTime\.value/, 'simElapsed should be read from the wind, which world.update writes the simulation time into every frame');
  assert.doesNotMatch(
    src.slice(src.indexOf('const simNow'), src.indexOf('const simNow') + 400),
    /Math\.min\(0\.1/,
    'the interval between two audio ticks must not be capped: the play-test harness steps half a second of world inside one call',
  );
});

test('the seeded stream does not depend on how often the audio is asked', () => {
  // the stride's jitter used to be drawn every tick rather than every step, so the same walk
  // rendered at 20 Hz and heard at 30 drew a different number of times and got different steps
  const surfaces = (dt) => {
    const ctx = fakeCtx();
    const steps = F.createFootsteps(ctx, ctx.createGain(), ctx.createGain(), null, null, createRng('cadence/stream'), 0);
    for (let t = 0; t < 60; t += dt) steps.drive(t, dt, { speed: F.WALK_SPEED, surface: 'stone', onStairs: false });
    return steps.stats().steps;
  };
  const a = surfaces(1 / 30);
  const b = surfaces(1 / 20);
  assert.ok(Math.abs(a - b) <= 1, `sixty seconds of the same walk gave ${a} steps at 30 Hz and ${b} at 20`);
});
