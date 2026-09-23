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
const { designStep, cadence, strideFor, strengthFor, RUN_SPEED, MIN_STEP_GAP } = loadTs(path.join(here, 'footsteps.ts'));
const { createRng } = loadTs(path.join(here, '../world/util/prng.ts'));

const SURFACES = ['stone', 'stair', 'grass', 'dirt', 'wood', 'hollow', 'leaf'];
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

test('a cadence a person could walk, and a run that is not a drum roll', () => {
  // a walk at 1.5 m/s is about two steps a second; the old stride fired 4.4 a second at a run
  assert.ok(Math.abs(cadence(1.5) - 2.0) < 0.15, `walk cadence ${cadence(1.5).toFixed(2)} steps/s`);
  assert.ok(cadence(4.2) > 2.6 && cadence(4.2) < 3.2, `run cadence ${cadence(4.2).toFixed(2)} steps/s`);
  // cadence rises with speed and the stride with it, and the walk / run change is not a cliff
  for (let v = 0.5; v < 6; v += 0.25) assert.ok(cadence(v) >= cadence(v - 0.25), 'cadence must not fall as the speed rises');
  // the walk / run change is a real gait change (a runner takes slightly quicker, shorter steps at
  // the transition speed and lengthens from there), but it must be a step, not a cliff
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

test('every step is quiet: nothing in a design can reach full scale on its own', () => {
  for (const surface of SURFACES) {
    for (const d of designs(surface, true, 1)) {
      const sum = d.parts.filter((p) => p.at < 0.01).reduce((s, p) => s + p.peak, 0);
      assert.ok(sum < 0.45, `${surface}: the heel's parts sum to ${sum.toFixed(2)} — a step should sit well under the bed's headroom`);
    }
  }
});
