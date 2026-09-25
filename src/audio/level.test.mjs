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
const { MASTER_TRIM_DB, MASTER_LEVEL } = loadTs(path.join(here, 'graph.ts'));

/**
 * The loudest true peak the game has been measured to make, in dBFS before the trim. Two takes
 * agree on it to a tenth of a decibel — thirteen minutes of ordinary play, and a deliberate worst
 * case of running and jumping under the lantern bough. It is stable because the sfx bus is
 * compressed, so stacking events cannot get past it. **Re-measure this before raising the trim.**
 */
const WORST_CASE_PEAK_DBFS = -16.7;
/** what must still be free above the worst case after the trim, for sources nobody has measured */
const REQUIRED_HEADROOM_DB = 6;

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
