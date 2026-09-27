// node --test src/audio/level.test.mjs — the master's trim, and the headroom it must leave.
//
// The mix shipped at −32.6 LUFS because it was built from the bed upward and nothing ever
// gain-staged the result. `MASTER_TRIM_DB` fixes that, and the one way it can do harm is by
// pushing the loudest moment the game can make into the ceiling. That moment is measured, not
// guessed (`art/audio/2026-09-24-level/`), and these hold the arithmetic between the two so nobody
// raises the trim without re-measuring the peak it has to clear.
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
const { MASTER_TRIM_DB, MASTER_LEVEL, SFX_PAD_DB, SFX_TRIM } = loadTs(path.join(here, 'graph.ts'));

/**
 * The loudest true peak the game has been measured to make, in dBFS before the trim.
 *
 * **On the rope bridge.** This figure used to be the lantern bough's, because that is where the
 * loudest moment was when it was first taken: the hardest surface, the fastest step rate and the
 * densest cluster of pod flames in the world. It is not there any more. `buses.gorge` gave the
 * ravine its own convolver, so a boot over the cut returns through TWO spaces instead of one, and
 * the same deliberate worst case — running and jumping continuously with the score playing —
 * measures **1.1 dB louder mid-span than under the bough** (`art/audio/2026-09-26-ceiling/`):
 *
 *     the bridge over the ravine   −16.6 dBFS    ← this number
 *     the lantern bough            −17.7
 *     inside the log arch's bore   −17.7
 *     inside the west house        −18.7
 *
 * Nothing clips at any of them and the guard below passes at all four, but the number was 0.1 dB
 * optimistic until this was measured — right by accident, because the bough's compressor-era
 * −16.7 happened to sit just under the bridge's real figure.
 *
 * **Re-measure this whenever a space is added**, which is what the last test in this file is for.
 * It used to say the figure was stable *because* the sfx bus was compressed, "so stacking events
 * cannot get past it" — and the compressor is gone (it was worth 0.4 dB of that stability and
 * cost 2.4 dB of the difference between a walk and a run, `art/audio/2026-09-26-pad/`). Nothing
 * limits this graph. What keeps the figure honest is that it is measured, guarded, and pinned to
 * the shape of the graph it was measured on.
 */
const WORST_CASE_PEAK_DBFS = -16.6;
/** what must still be free above the worst case after the trim, for sources nobody has measured */
const REQUIRED_HEADROOM_DB = 6;
/** how many spaces return into the master — see the last test for why the count is a guard */
const RETURNS_MEASURED_AGAINST = 3;

test('the trim cannot push the loudest moment the game makes into the ceiling', () => {
  const peak = WORST_CASE_PEAK_DBFS + MASTER_TRIM_DB;
  assert.ok(peak <= -REQUIRED_HEADROOM_DB, `the worst case lands at ${peak.toFixed(1)} dBFS — under ${REQUIRED_HEADROOM_DB} dB of headroom left`);
  assert.ok(peak < 0, 'and it must not clip at all');
});

test('the trim is worth making: it lifts the mix into a normal band', () => {
  // measured integrated loudness before the trim, over the same worst-case take
  const before = -32.6;
  const after = before + MASTER_TRIM_DB;
  assert.ok(after < -17, `${after.toFixed(1)} LUFS is louder than a game needs to be`);
  assert.ok(after > -26, `${after.toFixed(1)} LUFS is still quieter than the rest of the owner's desktop`);
});

test('the trim is a gain and nothing else: it moves no ratio in the mix', () => {
  // The whole argument for doing this at all is that a master gain is ratio-free, so the percept
  // the owner complained about twice cannot come back through it. That is only true while the trim
  // lives on the master and nowhere else — a trim copied onto a bus would change a balance.
  const graph = readFileSync(path.join(here, 'graph.ts'), 'utf8');
  const uses = [...graph.matchAll(/MASTER_LEVEL/g)].length;
  assert.equal(uses, 2, `MASTER_LEVEL is used ${uses} times in graph.ts; it must be declared once and applied once, to the master`);
  assert.match(graph, /master\.gain\.value = MASTER_LEVEL;/, 'the trim belongs on the master gain');
  const index = readFileSync(path.join(here, 'index.ts'), 'utf8');
  // the mute has to restore the trim rather than 1, or unmuting quietly undoes it
  assert.equal(/master\.gain\.value = muted \? 0 : 1\b/.test(index), false, 'unmuting must restore the trim, not 1');
  assert.equal(/setTargetAtTime\(m \? 0 : 1,/.test(index), false, 'unmuting must restore the trim, not 1');
  assert.ok(Math.abs(MASTER_LEVEL - Math.pow(10, MASTER_TRIM_DB / 20)) < 1e-9, 'the gain is the decibel figure it claims to be');
});

/**
 * How far the step rate stands over the music's beat in the mix's envelope at a run, against the
 * pad on the sfx bus. Priced exactly from rendered takes rather than modelled: the pad is a plain
 * gain on one linear part of the mix, so with the dry steps on disk every row is arithmetic
 * (`art/audio/2026-09-26-pad/pad.py`). A walk is under the music from a 2 dB pad and saturates at
 * −2.1 dB; these rows are the gait that is still over it.
 */
const STEP_OVER_BEAT_AT_RUN = [
  [0, 7.6],
  [2, 4.8],
  [4, 1.9],
  [6, -1.2],
  [8, -4.5],
  [10, -8.1],
];
/** where a walk's own step rate stops falling, and so the best margin any pad can buy */
const WALK_FLOOR_DB = -2.1;
/** the table is printed to a tenth; a run counts as having reached the walk's floor within this */
const REACHED_DB = 0.5;

/** the run's margin at a pad, straight-lined between the two rows that bracket it */
function overBeatAt(pad) {
  const rows = STEP_OVER_BEAT_AT_RUN;
  if (pad <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    const [c0, v0] = rows[i - 1];
    const [c1, v1] = rows[i];
    if (pad <= c1) return v0 + ((v1 - v0) * (pad - c0)) / (c1 - c0);
  }
  return rows[rows.length - 1][1];
}

test('the pad is big enough that the music, not the player, is the strongest rhythm', () => {
  const at = overBeatAt(SFX_PAD_DB);
  assert.ok(at <= WALK_FLOOR_DB + REACHED_DB, `a ${SFX_PAD_DB} dB pad leaves a run's step rate ${at.toFixed(1)} dB over the music's beat, short of the ${WALK_FLOOR_DB} dB a walk gets`);
});

test('and no bigger: the pad is the smallest whole decibel that does it', () => {
  // The other way to get this wrong is to keep taking level off the player's own footsteps because
  // the number keeps improving. It is the smallest sufficient pad or it is a taste.
  const less = overBeatAt(SFX_PAD_DB - 1);
  assert.ok(less > WALK_FLOOR_DB + REACHED_DB, `${SFX_PAD_DB - 1} dB already reaches ${less.toFixed(1)} dB, so ${SFX_PAD_DB} takes a decibel off the player's steps for nothing`);
});

test('the sfx bus carries a gain and nothing else', () => {
  // A DynamicsCompressorNode lived here for two days. It put every step in full four-to-one, its
  // release was worth 0.4 dB across a factor of sixteen, and it charged 2.4 dB of the difference
  // between a walk and a run. A gain does the same job; anything with a time constant on this bus
  // has to earn its keep against that measurement first.
  const graph = readFileSync(path.join(here, 'graph.ts'), 'utf8');
  assert.match(graph, /sfx\.connect\(sfxTrim\)\.connect\(master\)/, 'the pad belongs between the sfx bus and the master');
  assert.equal(/createDynamicsCompressor/.test(graph), false, 'nothing on this bus may squeeze the steps without re-measuring what that costs the gait');
  assert.ok(Math.abs(SFX_TRIM - Math.pow(10, -SFX_PAD_DB / 20)) < 1e-12, 'the pad is the decibel figure it claims to be');
});

test('the pad cannot spend headroom, because it only ever takes level away', () => {
  // The worst case the master is staged against is a run-and-jump take, which is the sfx bus at
  // full tilt — so an attenuation on that bus can only lower it. Measured at this pad the worst
  // case is 17.9 dB under full scale before the trim, inside the constant above.
  assert.ok(SFX_TRIM < 1, 'SFX_TRIM must attenuate; a pad over unity would invalidate the worst case');
  assert.ok(SFX_PAD_DB > 0, 'and it must be a pad, not a boost');
});

test('the worst case is pinned to the graph it was measured on', () => {
  // A peak measurement is a measurement OF A PARTICULAR GRAPH, and this one has been overtaken
  // once already: the figure above was the lantern bough's until `buses.gorge` gave the ravine
  // its own convolver, and a boot over the cut started returning through two spaces instead of
  // one. The loudest moment in the game moved to the bridge and nobody noticed for a day, because
  // nothing in the code knew the measurement had a shape attached to it.
  //
  // Every space that returns into the master can add to a peak, so the count is the shape. Add a
  // fourth and this fails, which is the only way a re-measure gets asked for at the moment it is
  // needed rather than the next time somebody happens to wonder.
  const src = readFileSync(path.join(here, 'graph.ts'), 'utf8');
  const returns = [...src.matchAll(/^\s*(\w*Return)\.connect\(master\);/gm)].map((m) => m[1]);
  assert.equal(
    returns.length,
    RETURNS_MEASURED_AGAINST,
    `${returns.length} spaces return into the master (${returns.join(', ')}) and the worst case was measured against ${RETURNS_MEASURED_AGAINST}. Re-run art/audio/2026-09-24-level/worstcase.mjs in every enclosed place and take the loudest.`,
  );
  // and the pad is still the only thing between the sfx bus and the master, so a peak is a sum
  assert.doesNotMatch(src, /createDynamicsCompressor/, 'something limits the bus again — the worst case is no longer a sum and this constant means something else');
});
