// node --test src/audio/music.test.mjs — the music slot's shape (lane 5).
// The placeholder loop used to run back to back for ever at one level. After the wind bed became a
// gust-gated swell the forest measured 15 dB under it, so between gusts the wood the owner walks
// around in could not be heard at all. These lock in that the tune rests, that the rests are long
// enough to hear the forest through, that the first pass is always the full arrangement, and that
// the score itself is original and pentatonic (it is not, and must never be, Nintendo's).
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
const { LOOP_SECONDS, REST_SECONDS, QUIET_PASS_SHARE, restAfter, passIsQuiet } = loadTs(path.join(here, 'music.ts'));
const { createRng } = loadTs(path.join(here, '../world/util/prng.ts'));

/** the pass schedule the live scheduler walks: pass, rest, pass, rest … from one seeded stream */
function schedule(seed, passes) {
  const rng = createRng(seed);
  const out = [];
  let t = 0.3;
  for (let i = 0; i < passes; i++) {
    const quiet = passIsQuiet(i, rng);
    out.push({ start: t, quiet, end: t + LOOP_SECONDS });
    t += LOOP_SECONDS + restAfter(rng);
  }
  return out;
}

test('the tune rests between passes, long enough to hear the forest through', () => {
  const s = schedule('music/rests', 40);
  const gaps = s.slice(1).map((p, i) => p.start - s[i].end);
  assert.ok(Math.min(...gaps) >= REST_SECONDS[0] - 1e-9, `the shortest rest is ${Math.min(...gaps).toFixed(1)} s`);
  assert.ok(Math.max(...gaps) <= REST_SECONDS[1] + 1e-9, `the longest rest is ${Math.max(...gaps).toFixed(1)} s`);
  // a rest has to outlast the pad's release and a bird's gap, or it reads as a stutter, not a rest
  assert.ok(REST_SECONDS[0] > 12, 'a rest shorter than the ambience bed breathes is not a rest');
  const duty = (100 * LOOP_SECONDS) / (LOOP_SECONDS + gaps.reduce((a, b) => a + b, 0) / gaps.length);
  assert.ok(duty > 55 && duty < 78, `the tune plays ${duty.toFixed(0)} % of the time — it should lead the forest, not cover it or abandon it`);
});

test('the first pass is the full arrangement and later ones vary', () => {
  for (const seed of ['a', 'b', 'c', 'd']) assert.equal(schedule(`music/${seed}`, 8)[0].quiet, false, 'the player should hear the whole piece the first time');
  const later = schedule('music/variation', 400).slice(1);
  const share = later.filter((p) => p.quiet).length / later.length;
  assert.ok(Math.abs(share - QUIET_PASS_SHARE) < 0.08, `${(share * 100).toFixed(0)} % of later passes are voiced down, expected about ${QUIET_PASS_SHARE * 100} %`);
  assert.ok(
    later.some((p) => p.quiet) && later.some((p) => !p.quiet),
    'both voicings must occur',
  );
});

test('the schedule is a pure function of its seed', () => {
  assert.deepEqual(schedule('same', 12), schedule('same', 12));
  assert.notDeepEqual(schedule('same', 12), schedule('other', 12));
  const source = readFileSync(path.join(here, 'music.ts'), 'utf8');
  assert.equal(/Math\.random\s*\(/.test(source), false, 'world audio must draw from src/world/util/prng.ts only');
});

test('the placeholder is original: pentatonic, and no Nintendo melody ships', () => {
  const source = readFileSync(path.join(here, 'music.ts'), 'utf8');
  const melody = source.match(/const MELODY[\s\S]*?\n\];/);
  assert.ok(melody, 'the melody table should be readable from the source');
  const notes = [...melody[0].matchAll(/\[\s*[\d.]+\s*,\s*(\d+)\s*,/g)].map((m) => Number(m[1]));
  assert.ok(notes.length > 30, `only ${notes.length} notes parsed`);
  // G major pentatonic: G A B D E — pitch classes 7, 9, 11, 2, 4
  const allowed = new Set([7, 9, 11, 2, 4]);
  for (const n of notes) assert.ok(allowed.has(n % 12), `midi ${n} (pitch class ${n % 12}) is outside G major pentatonic`);
  assert.match(source, /not the Kokiri Forest theme/, 'the provenance note must stay in the file');
});
