// node --test src/audio/footsteps.test.mjs — the shape of a footstep (lane 5, owner 2026-09-23
// "the steps need to be like…"). `designStep` is the step as plain data, so what the ear is meant
// to hear can be asserted without WebAudio: a heel with a low body, a roll, a toe that lands after
// the heel and quieter, the surface's own grains, no Math.random anywhere, and levels that balance
// across the five surfaces instead of the 22 dB spread the old one had between a walk and a run.
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
const { designStep, designLanding, landingStrength, designPushOff, pushOffStrength, cadence, strideFor, strengthFor, RUN_SPEED, MIN_STEP_GAP, WALK_SPEED, RUN_GROUND_SPEED, WALK_STEP_M, RUN_STEP_M } = loadTs(path.join(here, 'footsteps.ts'));
const { createRng } = loadTs(path.join(here, '../world/util/prng.ts'));

const SURFACES = ['stone', 'stair', 'grass', 'dirt', 'wood', 'hollow', 'leaf', 'bridge'];
const rng = (seed) => createRng(seed);
/** every design of a surface over many seeds, so a rare branch (the plank's creak) is covered too */
const designs = (surface, running = false, strength = 0.6, n = 40) => Array.from({ length: n }, (_, i) => designStep(surface, strength, running, rng(`step/${surface}/${i}`)));

test('a step is a sequence, not one burst: heel, roll, toe and the surface grains', () => {
  for (const surface of SURFACES) {
    for (const d of designs(surface)) {
      assert.ok(d.parts.length >= 5, `${surface}: ${d.parts.length} parts — a step of one or two events reads as a noise band`);
      const heel = d.parts.filter((p) => p.at <= 0.004);
      assert.ok(heel.length >= 2, `${surface}: the heel strike needs a body and something over it`);
      const lowBody = heel.filter((p) => p.kind === 'body' && p.f0 < 400);
      assert.ok(lowBody.length >= 1, `${surface}: no low body at the heel — the owner asked for "low body"`);
      // the toe: a body between 30 and 200 ms after the heel, quieter than the heel's
      const heelBody = lowBody.reduce((a, b) => (a.peak > b.peak ? a : b));
      const toe = d.parts.filter((p) => p.kind === 'body' && p.at > 0.03 && p.at < 0.2);
      assert.equal(toe.length, 1, `${surface}: exactly one toe body expected, got ${toe.length}`);
      assert.ok(toe[0].peak < heelBody.peak, `${surface}: the toe must be softer than the heel`);
      assert.ok(toe[0].peak > heelBody.peak * 0.2, `${surface}: the toe must still be there`);
      // every part is inside the design's own end, so the voice is torn down after it is silent
      for (const p of d.parts) assert.ok(p.at + p.attack + p.decay <= d.end + 1e-9, `${surface}: a part outlives the design's end`);
    }
  }
});

test('the loose surfaces crinkle and the hard ones do not', () => {
  const grains = (surface) => {
    const counts = designs(surface).map((d) => d.parts.filter((p) => p.kind === 'noise' && p.decay <= 0.007).length);
    return counts.reduce((a, b) => a + b, 0) / counts.length;
  };
  const leaf = grains('leaf');
  const dirt = grains('dirt');
  const grass = grains('grass');
  const stone = grains('stone');
  const wood = grains('wood');
  assert.ok(leaf > dirt, `leaf litter should crinkle more than earth (${leaf} vs ${dirt})`);
  assert.ok(dirt > grass, `earth should crunch more than turf (${dirt} vs ${grass})`);
  assert.ok(grass > wood, `turf should have more grains than a plank (${grass} vs ${wood})`);
  assert.ok(stone <= 4, `a flagstone is grit, not gravel (${stone})`);
  assert.ok(wood === 0, `a plank has no loose material on it (${wood})`);
});

test('a stair tread knocks on its log riser and a flagstone does not', () => {
  const timber = (surface) => designs(surface).every((d) => d.parts.some((p) => p.kind === 'body' && p.f0 > 230 && p.f0 < 280 && p.wave === 'sine'));
  assert.equal(timber('stair'), true, 'a stair step should carry the riser timber');
  assert.equal(timber('stone'), false, 'a flagstone path has no timber in it');
});

test('a plank over a ravine answers lower and longer than a deck on the ground', () => {
  const low = (surface) => Math.min(...designs(surface).flatMap((d) => d.parts.filter((p) => p.kind === 'body').map((p) => p.f0)));
  const ring = (surface) => Math.max(...designs(surface).flatMap((d) => d.parts.filter((p) => p.kind === 'body').map((p) => p.decay)));
  assert.ok(low('bridge') < low('wood') * 0.8, `the bridge's lowest body is ${low('bridge').toFixed(0)} Hz against the deck's ${low('wood').toFixed(0)} — nothing holds it up`);
  assert.ok(ring('bridge') > ring('wood'), 'and it rings longer');
  // the rope lashings answer on most steps but not all
  const rope = designs('bridge').filter((d) => d.parts.some((p) => p.kind === 'noise' && p.q >= 6)).length;
  assert.ok(rope > 12 && rope < 38, `the rope creaks on ${rope} of 40 steps — it should be most, not all`);
  assert.equal(designs('wood').filter((d) => d.parts.some((p) => p.kind === 'noise' && p.q >= 6 && p.freq < 500)).length > 0, true, 'a deck plank keeps its own creak');
});

test('the hollow log rings longer than anything else and sends more to the hall', () => {
  const tail = (surface) => Math.max(...designs(surface).flatMap((d) => d.parts.filter((p) => p.kind === 'body').map((p) => p.decay)));
  assert.ok(tail('hollow') > tail('wood'), 'the log tunnel must ring longer than a deck plank');
  assert.ok(tail('wood') > tail('stone'), 'a plank must ring longer than a flagstone');
  const reverb = (surface) => designs(surface)[0].reverb;
  assert.ok(reverb('hollow') > reverb('wood') && reverb('wood') > reverb('grass'), 'the hall share should follow the space, not the surface alphabetically');
});

test('running lands flatter: the toe arrives sooner than at a walk', () => {
  for (const surface of SURFACES) {
    const walk = designs(surface, false).map((d) => d.parts.find((p) => p.kind === 'body' && p.at > 0.03).at);
    const run = designs(surface, true).map((d) => d.parts.find((p) => p.kind === 'body' && p.at > 0.03).at);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(mean(run) < mean(walk) * 0.75, `${surface}: a run's heel-to-toe gap must close (${mean(run).toFixed(3)} vs ${mean(walk).toFixed(3)} s)`);
  }
});

/** A-weighting at a frequency (IEC 61672), so a boom in a log and a crinkle in leaf litter compare as the ear hears them */
function aWeight(f) {
  const f2 = f * f;
  const r = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 10 ** ((20 * Math.log10(r) + 2.0) / 10);
}

test('the surfaces balance: no step is more than 6 dB louder than another at the same strength', () => {
  // energy ≈ peak² × decay, weighted by where in the spectrum it sits
  const loudness = (surface) => {
    const per = designs(surface).map((d) => d.parts.reduce((s, p) => s + p.peak * p.peak * p.decay * aWeight(p.kind === 'body' ? p.f0 : p.freq), 0));
    return 10 * Math.log10(per.reduce((a, b) => a + b, 0) / per.length);
  };
  const levels = SURFACES.map((s) => ({ s, db: loudness(s) }));
  const lo = levels.reduce((a, b) => (a.db < b.db ? a : b));
  const hi = levels.reduce((a, b) => (a.db > b.db ? a : b));
  assert.ok(hi.db - lo.db <= 6, `${hi.s} is ${(hi.db - lo.db).toFixed(1)} dB(A) over ${lo.s} — surfaces should differ in colour, not in level: ${levels.map((l) => `${l.s} ${l.db.toFixed(1)}`).join(', ')}`);
});

test("the step is the animation's own, and still is", () => {
  // The model is only consulted where the character system is NOT reporting boot plants: never in
  // play, always in an offline render. So its job is to make the evidence WAVs step like the game
  // does, and the right source for that is not a measurement of this lane's own but the clip
  // contract the animation is authored against. glbLink.ts publishes it; this reads it out of the
  // source rather than importing it, because glbLink is 2,700 lines and pulls in the GLTF loader.
  //
  // If Astra re-authors a clip, this fails with her new numbers in the message. That is the whole
  // point: the last version of this test asserted a measurement, which would have gone stale in
  // silence the moment a stride changed.
  const glb = readFileSync(path.join(here, '../world/character/glbLink.ts'), 'utf8');
  const spec = glb.match(/export const CLIP_SPEC[\s\S]*?\n\};/);
  assert.ok(spec, 'CLIP_SPEC should be readable from glbLink.ts — has it moved or been renamed?');
  const strideOf = (gait) => {
    const m = spec[0].match(new RegExp(`${gait}:\\s*\\{[^}]*strideM:\\s*([\\d.]+)`));
    assert.ok(m, `no strideM for ${gait} in CLIP_SPEC`);
    return Number(m[1]);
  };
  // a stride is two steps
  assert.ok(Math.abs(WALK_STEP_M - strideOf('walk') / 2) < 1e-9, `the walk clip's stride is ${strideOf('walk')} m, so a step is ${(strideOf('walk') / 2).toFixed(3)} — this file says ${WALK_STEP_M}`);
  assert.ok(Math.abs(RUN_STEP_M - strideOf('run') / 2) < 1e-9, `the run clip's stride is ${strideOf('run')} m, so a step is ${(strideOf('run') / 2).toFixed(3)} — this file says ${RUN_STEP_M}`);
  // and the ground speeds the player controller drives at, from animation.ts
  const anim = readFileSync(path.join(here, '../world/character/animation.ts'), 'utf8');
  // anchored on the declaration: `PLAYER_SPEED` is also named inside GAIT_SPEED's comment, and an
  // unanchored match reads GAIT_SPEED's run of 3.9 instead of the controller's 4.6
  const decl = anim.match(/export const PLAYER_SPEED[\s\S]*?\};/);
  assert.ok(decl, 'PLAYER_SPEED should be readable from animation.ts');
  const speedOf = (gait) => Number(decl[0].match(new RegExp(`${gait}:\\s*([\\d.]+)`))[1]);
  assert.equal(WALK_SPEED, speedOf('walk'), 'the walk speed must be the controller\u2019s');
  assert.equal(RUN_GROUND_SPEED, speedOf('run'), 'the run speed must be the controller\u2019s');

  // the rate then falls out, and a play-mode probe counted it off the character system's own stance
  // edges to check the derivation is the right one: 3.56 and 3.71 walking, 4.85 and 4.99 running
  // (art/audio/2026-09-24-cadence/; the run legs start from a standstill, so they read a little low)
  assert.ok(Math.abs(cadence(1.6) - 3.64) < 0.02, `a walk should plant ${(1.6 / (strideOf('walk') / 2)).toFixed(2)}/s, the model says ${cadence(1.6).toFixed(2)}`);
  assert.ok(Math.abs(cadence(4.6) - 5.05) < 0.02, `a run should plant ${(4.6 / (strideOf('run') / 2)).toFixed(2)}/s, the model says ${cadence(4.6).toFixed(2)}`);
  assert.ok(Math.abs(strideFor(1.6, false) - 0.44) < 0.005 && Math.abs(strideFor(4.6, false) - 0.91) < 0.005, 'and the step lengths are the clips\u2019');

  // cadence rises with speed and never falls, and the ends are clamped rather than extrapolated
  for (let v = 0.5; v < 8; v += 0.25) assert.ok(cadence(v) >= cadence(v - 0.25), 'cadence must not fall as the speed rises');
  assert.ok(cadence(0) > 0 && cadence(0) < 2, `a standstill extrapolates to ${cadence(0).toFixed(2)} steps/s`);
  assert.ok(cadence(20) <= 6, `an impossible speed extrapolates to ${cadence(20).toFixed(2)} steps/s`);
  // the walk / run design change is a real gait change, but it must be a step and not a cliff
  assert.ok(Math.abs(strideFor(RUN_SPEED + 0.01, false) - strideFor(RUN_SPEED - 0.01, false)) < 0.15, 'the walk / run stride change must not jump');
  assert.equal(strideFor(1.5, true), 0.54, 'on stairs one step is one tread');
  // the refractory guard is shorter than the shortest real gap, so it never eats a real step
  assert.ok(MIN_STEP_GAP < 1 / cadence(6), 'the double-trigger guard must be shorter than the fastest stride');
  assert.ok(strengthFor(1.5) < strengthFor(4.2), 'a run lands harder than a stroll');
  assert.ok(strengthFor(0.3) >= 0.3 && strengthFor(9) <= 1, 'strength stays inside 0.3 … 1');
});

test('the design is a pure function of its seeded stream (no Math.random in the audio)', () => {
  const a = JSON.stringify(designStep('leaf', 0.7, false, rng('same')));
  const b = JSON.stringify(designStep('leaf', 0.7, false, rng('same')));
  assert.equal(a, b, 'two steps from the same seed must be byte-identical');
  assert.notEqual(a, JSON.stringify(designStep('leaf', 0.7, false, rng('other'))), 'two seeds must differ');
  const source = readFileSync(path.join(here, 'footsteps.ts'), 'utf8') + readFileSync(path.join(here, 'ambience.ts'), 'utf8') + readFileSync(path.join(here, 'graph.ts'), 'utf8');
  assert.equal(/Math\.random\s*\(/.test(source), false, 'world audio must draw from src/world/util/prng.ts only');
});

test('a landing is both boots at once, deeper and longer than a step', () => {
  for (const surface of SURFACES) {
    const energy = (d) => d.parts.reduce((s, p) => s + p.peak * p.peak * p.decay, 0);
    const steps = designs(surface, true, 0.9);
    const lands = Array.from({ length: 40 }, (_, i) => designLanding(surface, 0.9, rng(`land/${surface}/${i}`)));
    for (const d of lands) {
      // no separate toe: every body arrives inside the first 45 ms
      const late = d.parts.filter((p) => p.kind === 'body' && p.at > 0.045);
      assert.equal(late.length, 0, `${surface}: a landing has no heel-to-toe gap, found a body at ${late[0]?.at}`);
      // Weight under the impact: a body well below the heel's own, ringing much longer. Looked up
      // by that relationship rather than by "the lowest body in the design" — a surface can already
      // own a deep one (the bridge's plank over the ravine does), and then the lowest body is not
      // the one the landing added.
      const bodies = d.parts.filter((p) => p.kind === 'body');
      const heel = bodies.filter((p) => p.at <= 0.004).reduce((a, b) => (a.peak > b.peak ? a : b));
      const sub = bodies.find((p) => Math.abs(p.f0 - heel.f0 * 0.6) < heel.f0 * 0.01 && p.decay > heel.decay * 1.8);
      assert.ok(sub, `${surface}: no body an octave or so under the heel (${heel.f0.toFixed(0)} Hz, ${heel.decay.toFixed(3)} s) ringing on past it`);
      assert.ok(d.end > steps[0].end, `${surface}: a landing rings on past a step`);
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(mean(lands.map(energy)) > mean(steps.map(energy)) * 1.4, `${surface}: a landing must carry more than a running step`);
  }
  // how hard it lands follows the drop, and saturates
  assert.ok(landingStrength(0) < landingStrength(1) && landingStrength(1) < landingStrength(2), 'a longer fall lands harder');
  assert.ok(landingStrength(0) >= 0.45 && landingStrength(99) <= 1, 'landing strength stays inside 0.45 … 1');
});

test('a push-off is a scrape, not a quiet knock', () => {
  // Measured before this existed: four jumps off the flagstones came off the ground at -34 dB
  // against a bed at -30 and landed at -26, so a jump was silence up and a thump down
  // (art/audio/2026-09-24-jump/). What makes a shove a shove is its shape, not its level — a boot
  // arriving is a transient, a boot leaving presses and peels.
  for (const surface of SURFACES) {
    const energy = (d) => d.parts.reduce((s, p) => s + p.peak * p.peak * p.decay, 0);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const shoves = Array.from({ length: 40 }, (_, i) => designPushOff(surface, 0.7, rng(`push/${surface}/${i}`)));
    const lands = Array.from({ length: 40 }, (_, i) => designLanding(surface, 0.7, rng(`land/${surface}/${i}`)));
    for (const d of shoves) {
      const noise = d.parts.filter((p) => p.kind === 'noise');
      assert.ok(noise.length, `${surface}: a shove with no surface noise in it is not a shove`);
      // the peel: the surface's own band lasts, and sweeps UP as the sole rolls off it
      const rising = noise.filter((p) => p.decay >= 0.12 && p.freqTo > p.freq * 1.2);
      assert.ok(rising.length, `${surface}: no band that lasts and rises — this is a knock, not a peel`);
      const peel = rising.reduce((a, b) => (a.decay > b.decay ? a : b));
      const base = designStep(surface, 0.7, false, rng(`step/${surface}/0`));
      const step = base.parts.filter((p) => p.kind === 'noise').reduce((a, b) => (a.decay > b.decay ? a : b));
      assert.ok(peel.decay > step.decay * 2, `${surface}: the peel (${peel.decay.toFixed(3)} s) must outlast the step's own noise (${step.decay.toFixed(3)} s)`);
      // What separates a shove from an arrival is its onset, not its level: he presses rather than
      // hits. Holding it BELOW a walking step instead put the take-off at -31 dB against a bed at
      // -32 in the live recording, where a walking step peaks at -25 — it fired and could not be
      // heard. A standing jump drives about twice body weight into the ground; a walk, 1.2.
      const heel = base.parts.filter((p) => p.kind === 'body' && p.at <= 0.004 && p.f0 < 400)[0];
      if (heel) {
        const weight = d.parts.filter((p) => p.kind === 'body').reduce((a, b) => (a.peak > b.peak ? a : b));
        assert.ok(weight.peak > heel.peak, `${surface}: the shove (${weight.peak.toFixed(4)}) must carry more weight than a walking step's heel (${heel.peak.toFixed(4)})`);
        assert.ok(weight.attack > heel.attack * 3, `${surface}: the shove arrives in ${weight.attack.toFixed(4)} s — that is a knock, not a press (the step's heel is ${heel.attack.toFixed(4)})`);
      }
    }
    // A drop drives the surface deeper than a push does, and it cracks where a push scrapes, so
    // the hall answers it more. Not total energy: a shove is deliberately the longer of the two,
    // so summing peak² × decay compares their durations rather than their impacts.
    const lowest = (d) => Math.min(...d.parts.filter((p) => p.kind === 'body').map((p) => p.f0));
    assert.ok(mean(lands.map(lowest)) < mean(shoves.map(lowest)), `${surface}: a landing must reach lower than a shove (${mean(lands.map(lowest)).toFixed(0)} Hz vs ${mean(shoves.map(lowest)).toFixed(0)})`);
    assert.ok(mean(shoves.map((d) => d.reverb)) < mean(lands.map((d) => d.reverb)), `${surface}: a shove must send less to the hall than a landing`);
    assert.ok(mean(shoves.map(energy)) > mean(designs(surface, false, 0.7).map(energy)), `${surface}: a shove must carry more than a walking step`);
  }
  assert.ok(pushOffStrength(0) < pushOffStrength(2) && pushOffStrength(2) < pushOffStrength(4), 'a running jump shoves harder than a standing one');
  assert.ok(pushOffStrength(0) >= 0.5 && pushOffStrength(99) <= 1, 'push-off strength stays inside 0.5 … 1');
  const a = JSON.stringify(designPushOff('leaf', 0.7, rng('same')));
  assert.equal(a, JSON.stringify(designPushOff('leaf', 0.7, rng('same'))), 'two shoves from the same seed must be byte-identical');
});

test('the wind bed is a swell, not a floor: still air is silent', () => {
  const { swell, GUST_KNEE, CANOPY_FLOOR, HUSH_FLOOR } = loadTs(path.join(here, 'ambience.ts'));
  assert.equal(swell(0), 0, 'no wind, no bed');
  assert.equal(swell(GUST_KNEE), 0, 'the knee is where the bed starts, not where it is already on');
  assert.equal(swell(1), 1, 'a full gust is the full swell');
  for (let g = 0; g <= 1.0001; g += 0.05) {
    const v = swell(g);
    assert.ok(v >= 0 && v <= 1, `swell(${g.toFixed(2)}) = ${v} is outside 0..1`);
    assert.ok(v >= swell(g - 0.05), 'the swell must not fall as the wind rises');
  }
  // the floors are what plays when nothing is happening: they must be inaudible, not merely quiet
  for (const [name, v] of [['canopy', CANOPY_FLOOR], ['hush', HUSH_FLOOR]]) {
    assert.ok(20 * Math.log10(v) < -66, `the ${name} floor is ${(20 * Math.log10(v)).toFixed(0)} dB — an always-on bed is what reads as white noise`);
  }
});

test('the canopy roll leans upwind, and only leans', () => {
  const { windLeanFor, WIND_LEAN } = loadTs(path.join(here, 'ambience.ts'));
  const north = { x: 0, z: -1 };
  // wind travelling east (+x): it comes from the west, so facing north it arrives on your left
  assert.ok(windLeanFor(north, { x: 1, z: 0 }) < -0.3, 'facing north, an easterly-travelling wind should lean left');
  assert.ok(windLeanFor(north, { x: -1, z: 0 }) > 0.3, 'and the other way round');
  // straight into it or straight away from it: no side at all
  for (const dir of [north, { x: 0, z: 1 }]) assert.ok(Math.abs(windLeanFor(north, dir)) < 1e-9, 'head-on or from behind the wind has no side');
  // turning through a full circle traces one cycle and never exceeds the lean
  const seen = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 32) {
    const v = windLeanFor({ x: Math.sin(a), z: Math.cos(a) }, { x: 1, z: 0 });
    assert.ok(Math.abs(v) <= WIND_LEAN + 1e-9, `|lean| ${Math.abs(v).toFixed(3)} exceeds ${WIND_LEAN} — it is a lean, not a pan`);
    seen.push(v);
  }
  assert.ok(Math.max(...seen) > WIND_LEAN * 0.99 && Math.min(...seen) < -WIND_LEAN * 0.99, 'a full turn should reach both extremes');
  // it is a lean: the bed never collapses to one side
  assert.ok(WIND_LEAN <= 0.5, 'wind in a wood is not a point source');
  // a zero-length direction must not produce NaN
  assert.equal(Number.isFinite(windLeanFor(north, { x: 0, z: 0 })), true);
});

test('a run is not a louder walk', () => {
  // `running` used to appear in exactly one expression — the heel-to-toe gap — so across eight
  // surfaces and sixty seeds the only number that differed between a walk and a run was the time of
  // the last part, and on leaf litter not even that (its last part is a settling grain, not the
  // toe). Measured on the render, a run's spectral centroid was ONE HERTZ from a walk's.
  for (const surface of SURFACES) {
    for (let i = 0; i < 20; i++) {
      const w = designStep(surface, 0.8, false, rng(`gait/${surface}/${i}`));
      const r = designStep(surface, 0.8, true, rng(`gait/${surface}/${i}`));
      const heel = (d) => d.parts.filter((p) => p.at <= 0.004);
      const toe = (d) => d.parts.filter((p) => p.at > 0.02);
      assert.ok(Math.min(...heel(r).map((p) => p.attack)) < Math.min(...heel(w).map((p) => p.attack)), `${surface}: a run's heel must arrive faster than a walk's`);
      assert.ok(r.end < w.end, `${surface}: a run's step must be briefer — at five a second a walk's tail is still sounding under the next one`);
      const bodies = (d) => heel(d).filter((p) => p.kind === 'body');
      if (bodies(w).length) assert.ok(Math.max(...bodies(r).map((p) => p.f0)) > Math.max(...bodies(w).map((p) => p.f0)), `${surface}: a harder strike rings the surface higher`);
      if (toe(w).length) assert.ok(Math.max(...toe(r).map((p) => p.peak)) < Math.max(...toe(w).map((p) => p.peak)), `${surface}: a run lands flatter, so the toe is less of its own event`);
      // and none of it may be level: that is strengthFor's, and doing it here would be level twice
      assert.ok(Math.abs(Math.max(...r.parts.map((p) => p.peak)) - Math.max(...w.parts.map((p) => p.peak))) < 1e-9, `${surface}: the run's shape must not change its peak — loudness is strengthFor's job`);
    }
  }
  assert.ok(strengthFor(RUN_GROUND_SPEED) > strengthFor(WALK_SPEED), 'and a run must still be louder, by the thing whose job that is');
});

test('every step is quiet: nothing in a design can reach full scale on its own', () => {
  for (const surface of SURFACES) {
    for (const d of designs(surface, true, 1)) {
      const sum = d.parts.filter((p) => p.at < 0.01).reduce((s, p) => s + p.peak, 0);
      assert.ok(sum < 0.45, `${surface}: the heel's parts sum to ${sum.toFixed(2)} — a step should sit well under the bed's headroom`);
    }
  }
});
