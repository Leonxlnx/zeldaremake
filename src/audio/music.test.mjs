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
const { LOOP_SECONDS, REST_SECONDS, QUIET_PASS_SHARE, restAfter, passIsQuiet, PHRASE_BEATS, PHRASE_LEVEL, PHRASE_PAD_BEATS, phraseGain, gatedRmsDb, fileGain, MUSIC_BUS_TARGET_DB, MUSIC_MATCH_RANGE_DB } = loadTs(path.join(here, 'music.ts'));
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

/** the pad's on / off timeline through one pass, in beats, release included */
function padSpans() {
  const RELEASE_BEATS = 1.1 / (60 / 76);
  return PHRASE_PAD_BEATS.map((beats, phrase) => (beats ? [phrase * PHRASE_BEATS, phrase * PHRASE_BEATS + beats + RELEASE_BEATS] : null)).filter(Boolean);
}

test('the pad stops — the low end is not a held tone under the whole pass', () => {
  const spans = padSpans();
  assert.ok(spans.length > 0, 'the piece should still have a pad');
  // the fault this replaced: a pad every two bars, eight beats long with a 1.1 s release, so each
  // one overlapped the next and the 60–125 Hz band never left a 5.6 dB window in fifty seconds
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] > spans[i - 1][1], `pad ${i} starts at beat ${spans[i][0]}, before pad ${i - 1} has released at ${spans[i - 1][1].toFixed(1)}`);
  const beats = PHRASE_BEATS * PHRASE_LEVEL.length;
  const on = spans.reduce((a, [s, e]) => a + Math.min(e, beats) - s, 0);
  assert.ok(on / beats < 0.65, `the pad sounds for ${((100 * on) / beats).toFixed(0)} % of a pass — a low sine that is on more than it is off is a drone`);
  const gaps = spans.slice(1).map(([s], i) => s - spans[i][1]).concat(beats - spans[spans.length - 1][1]);
  const longest = (Math.max(...gaps) * 60) / 76;
  assert.ok(longest > 6, `the longest hole in the low end is ${longest.toFixed(1)} s; the forest's own gusts run 3–4 s, so it needs longer than that to be heard through`);
});

test('the score is written with dynamics, not played at one level', () => {
  const source = readFileSync(path.join(here, 'music.ts'), 'utf8');
  const melody = source.match(/const MELODY[\s\S]*?\n\];/);
  const beats = [...melody[0].matchAll(/\[\s*([\d.]+)\s*,\s*\d+\s*,/g)].map((m) => Number(m[1]));
  const gains = beats.map(phraseGain);
  const span = 20 * Math.log10(Math.max(...gains) / Math.min(...gains));
  assert.ok(span > 8, `the melody is written across ${span.toFixed(1)} dB; the flat loop it replaced measured 6.4 dB end to end`);
  // the shape has to be the writing's, not a wobble: each phrase peaks once and ends under its start
  for (let p = 0; p < PHRASE_LEVEL.length; p++) {
    const within = [];
    for (let b = 0; b < PHRASE_BEATS; b += 0.5) within.push(phraseGain(p * PHRASE_BEATS + b));
    const peak = within.indexOf(Math.max(...within));
    assert.ok(peak > 0 && peak < within.length - 1, `phrase ${p} peaks at its edge`);
    assert.ok(within[within.length - 1] < within[0], `phrase ${p} ends louder than it begins`);
  }
  assert.equal(Math.max(...PHRASE_LEVEL), PHRASE_LEVEL[2], 'B is the lift — it should be the loudest phrase');
  assert.equal(Math.min(...PHRASE_LEVEL), PHRASE_LEVEL[1], "A' answers A — it should be the softest");
});

/** a decoded track: `seconds` of noise at `rms` full-scale, optionally with a silent lead-in */
function fakeTrack(rms, seconds = 8, sampleRate = 8000, quietLeadS = 0) {
  const n = Math.round(seconds * sampleRate);
  const a = new Float32Array(n);
  // a fixed low-discrepancy sequence rather than Math.random: the test has to be reproducible
  let s = 0.37;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 0.49297) % 1;
    a[i] = (s * 2 - 1) * Math.sqrt(3) * rms * (i < quietLeadS * sampleRate ? 0.0002 : 1);
  }
  return { numberOfChannels: 1, length: n, sampleRate, getChannelData: () => a };
}

test('a dropped-in track is measured while it is sounding, not averaged over its gaps', () => {
  for (const db of [-30, -20, -14, -8]) {
    const got = gatedRmsDb(fakeTrack(Math.pow(10, db / 20)));
    assert.ok(Math.abs(got - db) < 0.5, `a ${db} dBFS track measured ${got.toFixed(1)}`);
  }
  // the reason for the gate: a quiet intro over half the take must not halve the answer
  const flat = gatedRmsDb(fakeTrack(Math.pow(10, -12 / 20), 8));
  const withLead = gatedRmsDb(fakeTrack(Math.pow(10, -12 / 20), 8, 8000, 4));
  assert.ok(Math.abs(flat - withLead) < 0.5, `the gate let a silent half move the level ${flat.toFixed(1)} → ${withLead.toFixed(1)}`);
  assert.ok(gatedRmsDb({ numberOfChannels: 1, length: 0, sampleRate: 44100, getChannelData: () => new Float32Array(0) }) < -100, 'an empty buffer must not divide by zero');
});

test("a mastered track meets the placeholder's level instead of setting the mix", () => {
  // commercial masters run -14 to -8 LUFS; a forest bed sits at -40. Whatever the owner drops in,
  // the bus should receive the level every balance on this lane was measured against.
  for (const db of [-8, -10, -14, -20, -24.9, -30]) {
    const bus = db + 20 * Math.log10(fileGain(gatedRmsDb(fakeTrack(Math.pow(10, db / 20)))));
    assert.ok(Math.abs(bus - MUSIC_BUS_TARGET_DB) < 0.6, `a ${db} dBFS track reaches the bus at ${bus.toFixed(1)}, wanted ${MUSIC_BUS_TARGET_DB}`);
  }
  // the rails: a silent or a clipped file must not ask for an absurd gain
  const [lo, hi] = MUSIC_MATCH_RANGE_DB;
  assert.equal(fileGain(-120), Math.pow(10, hi / 20), 'a near-silent file is lifted only as far as the rail');
  assert.equal(fileGain(0), Math.pow(10, Math.max(lo, MUSIC_BUS_TARGET_DB) / 20), 'a full-scale file is cut, not boosted');
  assert.ok(fileGain(-8) < 1, 'a mastered track is turned DOWN');
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
