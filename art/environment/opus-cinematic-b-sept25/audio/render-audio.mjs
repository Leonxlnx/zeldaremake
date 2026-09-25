#!/usr/bin/env node
/**
 * Render the five stems of the opus-cinematic-b-sept25 soundtrack (cues.json durationSeconds,
 * 48 kHz stereo 24-bit):
 *   stems/bed.wav  stems/birds.wav  stems/detail.wav  stems/steps.wav  stems/music.wav
 *
 *   node render-audio.mjs [--cues cues.json] [--steps-dir <take dir>[,<dir>…]] [--steps a.json[,b.json…]]
 *                         [--stems bed,birds,detail,steps,music] [--steps-only] [--no-map-check]
 *                         [--log-fps 60] [--log-start <edit s>]
 *
 * Final render against a recorded take (one documented command):
 *   node render-audio.mjs --cues cues.json --steps-dir <take dir> && node finish-audio.mjs --cues cues.json
 *
 * The game's audio modules are transpiled UNCHANGED from this checkout's src/ (their sha256s are
 * recorded) into generated/, next to the cinematic's own synthesis (synth/cine.js), and rendered
 * in a blank headless Chrome page with OfflineAudioContext (GPU/WebGL disabled, audio muted).
 *
 * Steps: without step logs a placeholder track is generated from cues.json (placeholderSteps: the
 * seconds per footfall for each section that has one). With --steps-dir, every steps-*.json the
 * video recorder wrote for the take (one per player shot) is read; a step is the rising edge of a
 * foot's `stance` inside the recorded rows (rec !== false). Preroll / skip rows (rec: false) never
 * sound, and the first recorded row of each shot only arms the detector (a boot already planted on
 * the first frame is not a step) unless cues steps.armFromPreroll is true. --steps-only resolves
 * and prints the steps (analysis/steps-parse-check.json) and renders nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const list = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);
const sourceRoot = path.resolve(opt('source-root', path.join(here, '../../../..')));
const require = createRequire(path.join(sourceRoot, 'package.json'));
const ts = require('typescript');
const chrome = opt('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const rel = (p) => path.relative(sourceRoot, p).split(path.sep).join('/');
const r5 = (x) => +Number(x).toFixed(5);

const cuesPath = path.resolve(opt('cues', path.join(here, 'cues.json')));
const cuesText = fs.readFileSync(cuesPath, 'utf8');
const cues = JSON.parse(cuesText);
const stemNames = list(opt('stems', 'bed,birds,detail,steps,music'));
const stepsOnly = flag('steps-only');
const SR = cues.sampleRate ?? 48000;
const duration = cues.durationSeconds ?? 30;

// ---- 0. the cut --------------------------------------------------------------------------------
const REQUIRED = ['hero', 'lantern', 'macro', 'canopy', 'walk', 'run', 'stairs', 'reveal'];
const OPTIONAL = ['hamlet'];
const ordered = cues.sections.slice().sort((a, b) => a.start - b.start);
const S = Object.fromEntries(ordered.map((s) => [s.id, { start: s.start, end: s.end }]));
if (Object.keys(S).length !== cues.sections.length) throw new Error('cues.json: duplicate section ids');
for (const id of REQUIRED) if (!S[id]) throw new Error(`cues.json: section "${id}" missing`);
for (const s of ordered) if (!(s.end > s.start)) throw new Error(`cues.json: section "${s.id}" ends before it starts`);
const warnings = [];
for (let i = 1; i < ordered.length; i++) {
  const gap = ordered[i].start - ordered[i - 1].end;
  if (Math.abs(gap) > 1e-6) warnings.push(`sections "${ordered[i - 1].id}" → "${ordered[i].id}": ${gap > 0 ? 'gap' : 'overlap'} of ${Math.abs(gap).toFixed(3)} s`);
}
if (Math.abs(ordered.at(-1).end - duration) > 1e-6) warnings.push(`last section ends at ${ordered.at(-1).end} s, durationSeconds is ${duration}`);
for (const id of Object.keys(S)) if (!REQUIRED.includes(id) && !OPTIONAL.includes(id)) warnings.push(`section "${id}" has no sound tables of its own; every curve glides across it between its neighbours`);
for (const w of warnings) console.warn(`warning: ${w}`);
/** the section an edit second falls in (before the first: the first; past the last: the last) */
const sectionAt = (t) => {
  let id = ordered[0].id;
  for (const s of ordered) if (t >= s.start) id = s.id;
  return id;
};

// ---- 1. transpile the game modules (unchanged sources) -------------------------------------------
const genDir = path.join(here, 'generated');
fs.rmSync(genDir, { recursive: true, force: true });
const files = ['src/world/util/prng.ts', 'src/audio/graph.ts', 'src/audio/ambience.ts', 'src/audio/footsteps.ts', 'src/audio/music.ts'];
const sources = {};
const sourceText = {};
for (const file of files) {
  const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
  sources[file] = sha256(source);
  sourceText[file] = source;
  const js = ts
    .transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.js$3');
  const target = path.join(genDir, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, js);
}
// the transpiled modules are ES modules wherever generated/ sits (Node reads the score's timing from them)
fs.writeFileSync(path.join(genDir, 'package.json'), '{"type":"module"}\n');
const ownScripts = ['render-audio.mjs', 'finish-audio.mjs', 'synth/cine.js'];
const scripts = Object.fromEntries(ownScripts.filter((f) => fs.existsSync(path.join(here, f))).map((f) => [f, sha256(fs.readFileSync(path.join(here, f)))]));
fs.copyFileSync(path.join(here, 'synth/cine.js'), path.join(genDir, 'cine.js'));
fs.writeFileSync(path.join(genDir, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Offline audio only</title><script type="module" src="./cine.js"></script>');

// ---- 2. the step track ---------------------------------------------------------------------------
/** tiny seeded stream for the per-step jitter (same PRNG family as src/world/util/prng.ts) */
function rngFrom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let state = h >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
const stepCfg = cues.steps ?? {};

/** footsteps.ts `Surface`: anything else lands in designStep's default branch, the hollow log tunnel */
const SURFACES = ['stone', 'stair', 'grass', 'dirt', 'wood', 'hollow', 'leaf', 'bridge'];
const SURFACE_ALIAS = {
  stairs: 'stair', stairway: 'stair', steps: 'stair', flagstone: 'stone', flagstones: 'stone', paving: 'stone', rock: 'stone',
  earth: 'dirt', soil: 'dirt', mud: 'dirt', litter: 'leaf', leaves: 'leaf', deck: 'wood', plank: 'wood', planks: 'wood', boards: 'wood', log: 'hollow', rope: 'bridge',
};
function surfaceName(s, where) {
  if (s === undefined || s === null || s === '') return undefined;
  const k = String(s).trim().toLowerCase();
  const v = SURFACE_ALIAS[k] ?? k;
  if (!SURFACES.includes(v)) throw new Error(`${where}: unknown footstep surface "${s}" — footsteps.ts knows ${SURFACES.join('|')} (aliases: ${Object.keys(SURFACE_ALIAS).join(', ')}); an unknown name would silently play the hollow-log voice`);
  return v;
}
/** the game's own stairs mapping (footsteps.ts drive(): onStairs && not wood/hollow → 'stair') */
const onStairs = (surface, stairs) => (stairs && surface !== 'wood' && surface !== 'hollow' ? 'stair' : surface);
// validate the cue tables before anything is rendered
for (const key of ['surface', 'surfaceOverride']) for (const [sec, v] of Object.entries(stepCfg[key] ?? {})) surfaceName(v, `cues.json steps.${key}.${sec}`);

const GAITS = ['idle', 'walk', 'run', 'stairs'];
const GAIT_ALIAS = { climb: 'stairs', stair: 'stairs', stairway: 'stairs', jog: 'run', sprint: 'run', stroll: 'walk' };
/** the row's gait (src/world/character/animation.ts: idle|walk|run|stairs) wins; the section is the fallback */
function gaitOf(g, sec) {
  let v = g === undefined || g === null ? '' : String(g).trim().toLowerCase();
  v = GAIT_ALIAS[v] ?? v;
  if (GAITS.includes(v)) return v;
  const fb = stepCfg.sectionGait?.[sec] ?? (GAITS.includes(sec) ? sec : 'walk');
  return GAITS.includes(fb) ? fb : 'walk';
}

const footName = (x, i) => {
  const s = String(x ?? '').trim().toUpperCase();
  return s.startsWith('L') ? 'L' : s.startsWith('R') ? 'R' : i === 0 ? 'L' : 'R';
};
/**
 * One recorder log: {shot, fps, simHz, shotStartEdit, events:[…], rows:[{edit, rec, k, gait,
 * stance:[bool,bool], feet:['L','R'], pos:[x,z], speed, …}]} (record.mjs), or an older capture
 * log (array of rows with feet:[{foot, stance}] / linkFeetContact / stance).
 */
function contactsFromLog(file, armFromPreroll) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(j) ? j : [j.rows, j.samples, j.ticks, j.frames].find(Array.isArray) ?? [];
  const hz = Number(opt('log-fps', j.simHz ?? j.fps ?? 60));
  const logStart = Number(opt('log-start', j.shotStartEdit ?? j.editStart ?? 0));
  const frame0 = rows.length ? rows[0].tick ?? rows[0].k ?? rows[0].frame ?? 0 : 0;
  const shotName = j.shot ?? path.basename(file).replace(/^steps-/, '').replace(/\.json$/i, '');
  const timeOf = (row, i) => {
    for (const k of ['editTime', 'edit_time', 'edit', 'tEdit', 'editSeconds', 't', 'time']) if (typeof row[k] === 'number') return row[k];
    const f = row.tick ?? row.k ?? row.frame;
    return logStart + (typeof f === 'number' ? f - frame0 : i) / hz;
  };
  const feetOf = (row) => {
    // record.mjs: stance [bool, bool] with feet ['L', 'R'] as the NAMES of those two entries
    if (Array.isArray(row.stance) && row.stance.every((s) => typeof s === 'boolean')) {
      return row.stance.map((s, i) => ({ foot: footName(row.feet?.[i], i), stance: s, surface: Array.isArray(row.surfaces) ? row.surfaces[i] : undefined }));
    }
    const f = row.feet ?? row.linkFeetContact ?? row.feetContact ?? row.contacts ?? row.character?.linkFeetContact;
    if (Array.isArray(f)) {
      return f
        .map((x, i) => (typeof x === 'boolean' ? { foot: i === 0 ? 'L' : 'R', stance: x } : x && typeof x === 'object' ? { foot: footName(x.foot, i), stance: !!x.stance, surface: x.surface } : null))
        .filter(Boolean);
    }
    return [];
  };
  const events = [];
  let prev = null;
  let shot;
  let recRows = 0;
  let skipRows = 0;
  let firstRec = null;
  let lastRec = null;
  rows.forEach((row, i) => {
    const thisShot = row.shot ?? row.shotId ?? row.scenario ?? shotName;
    if (thisShot !== shot) {
      prev = null; // every shot re-arms
      shot = thisShot;
    }
    const feet = feetOf(row);
    const stance = Object.fromEntries(feet.map((f) => [f.foot, f.stance]));
    if (row.rec === false) {
      // preroll / skip tick: never a sound. It only primes the detector when asked to.
      skipRows++;
      prev = armFromPreroll ? stance : null;
      return;
    }
    const t = timeOf(row, i);
    recRows++;
    if (firstRec === null) firstRec = t;
    lastRec = t;
    if (prev) {
      for (const f of feet) {
        if (f.stance && prev[f.foot] === false) {
          events.push({ t, foot: f.foot, gait: row.gait ?? row.linkGait ?? row.character?.linkGait, surface: row.surface ?? f.surface, speed: row.speed, pos: Array.isArray(row.pos) ? row.pos : undefined, k: row.k, shot, source: 'log' });
        }
      }
    }
    prev = stance; // the first recorded row of a shot lands here with prev === null: it only arms
  });
  // no rows at all: fall back on the recorder's own edge list (recorded ones only)
  let fromEvents = false;
  if (!rows.length && Array.isArray(j.events)) {
    fromEvents = true;
    for (const e of j.events) if (e.rec !== false && typeof e.edit === 'number') events.push({ t: e.edit, foot: footName(e.foot, 0), gait: e.gait, k: e.k, shot: shotName, source: 'log-events' });
  }
  // cross-check against record.mjs's own list: it counts the edge INTO the first recorded tick,
  // which this detector (by design) only arms on
  let recorder = null;
  if (Array.isArray(j.events) && rows.length) {
    const recEv = j.events.filter((e) => e.rec !== false);
    const k0 = rows.find((r) => r.rec !== false)?.k;
    const onArm = recEv.filter((e) => e.k === k0).length;
    recorder = { recorded: recEv.length, onFirstTick: onArm, agrees: recEv.length - (armFromPreroll ? 0 : onArm) === events.length };
  }
  return { file, shot: shotName, rows: rows.length, recRows, skipRows, edit: firstRec === null ? null : [r5(firstRec), r5(lastRec)], events, recorder, fromEvents };
}

function placeholderSteps() {
  const events = [];
  const pace = cues.placeholderSteps ?? { walk: 0.367, run: 0.273, stairs: 0.367 };
  let foot = 'L';
  for (const s of ordered) {
    const p = pace[s.id];
    if (!(p > 0)) continue;
    const gait = gaitOf(stepCfg.sectionGait?.[s.id], s.id);
    for (let t = s.start + (cues.placeholderStepLead ?? 0); t < s.end - 1e-6; t += p) {
      events.push({ t: r5(t), foot, gait, source: 'placeholder' });
      foot = foot === 'L' ? 'R' : 'L';
    }
  }
  return events;
}

// the step logs: --steps-dir (every steps-*.json in the take dir) and/or --steps a.json,b.json
const stepFiles = [];
for (const d of list(opt('steps-dir'))) {
  const dir = path.resolve(d);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`--steps-dir ${d}: not a directory`);
  const found = fs.readdirSync(dir).filter((f) => /^steps-.+\.json$/i.test(f)).sort().map((f) => path.join(dir, f));
  if (!found.length) throw new Error(`--steps-dir ${d}: no steps-*.json in it`);
  stepFiles.push(...found);
}
for (const f of list(opt('steps'))) stepFiles.push(path.resolve(f));
for (const f of stepFiles) if (!fs.existsSync(f)) throw new Error(`step log not found: ${f}`);
const armFromPreroll = !!stepCfg.armFromPreroll;
const logs = stepFiles.map((f) => contactsFromLog(f, armFromPreroll));
for (const l of logs) {
  const rec = l.recorder ? `; recorder listed ${l.recorder.recorded} recorded edges (${l.recorder.onFirstTick} on the arming tick) — ${l.recorder.agrees ? 'agrees' : 'DISAGREES'}` : '';
  console.log(`log ${path.basename(l.file)} [${l.shot}]: ${l.rows} rows (${l.recRows} recorded, ${l.skipRows} preroll/skip), edit ${l.edit ? l.edit.join('–') : '-'} s → ${l.events.length} steps${l.fromEvents ? ' (from the events list)' : ''}${rec}`);
  if (l.recorder && !l.recorder.agrees) warnings.push(`${path.basename(l.file)}: step count differs from the recorder's own edge list`);
}
const rawSteps = stepFiles.length ? logs.flatMap((l) => l.events) : placeholderSteps();
rawSteps.sort((a, b) => a.t - b.t);

// optional check against the world: index.ts surfaceAt(x, z) at each logged step (read-only, in Node)
let mapCheck = null;
const surfaceFrom = stepCfg.surfaceFrom ?? 'cues'; // 'cues' | 'map'
if (stepFiles.length && !flag('no-map-check') && rawSteps.some((e) => e.pos)) {
  try {
    const { existsSync } = fs;
    const modules = new Map();
    const loadTs = (file) => {
      file = path.resolve(file);
      if (modules.has(file)) return modules.get(file).exports;
      const module = { exports: {} };
      modules.set(file, module);
      const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      new Function('require', 'module', 'exports', out)(
        (name) => {
          if (!name.startsWith('.')) return require(name);
          const target = path.resolve(path.dirname(file), name);
          for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (existsSync(c)) return loadTs(c);
          throw Error(`cannot resolve ${name} from ${file}`);
        },
        module,
        module.exports,
      );
      return module.exports;
    };
    const warn = process.emitWarning;
    process.emitWarning = () => {}; // three's CJS deprecation notice
    let surfaceAt;
    try {
      ({ surfaceAt } = loadTs(path.join(sourceRoot, 'src/audio/index.ts')));
    } finally {
      process.emitWarning = warn;
    }
    for (const ev of rawSteps) {
      if (!ev.pos) continue;
      const m = surfaceAt(ev.pos[0], ev.pos[1]);
      ev.map = { surface: m.stairs && m.surface !== 'wood' && m.surface !== 'hollow' ? 'stair' : m.surface, stairs: m.stairs, canopy: +m.canopy.toFixed(3) };
    }
    mapCheck = { source: 'src/audio/index.ts surfaceAt', sha256: sha256(fs.readFileSync(path.join(sourceRoot, 'src/audio/index.ts'), 'utf8')) };
  } catch (e) {
    console.warn(`warning: map check skipped (${e.message.split('\n')[0]})`);
  }
}

const minGap = stepCfg.minGap ?? 0.16;
const jr = rngFrom(`${cues.seed}/steps`);
const steps = [];
const dropped = { outOfCut: 0, minGap: 0 };
let lastT = -1e9;
for (const ev of rawSteps) {
  if (ev.t < 0 || ev.t >= duration) { dropped.outOfCut++; continue; }
  if (ev.t - lastT < minGap) { dropped.minGap++; continue; } // a noisy stance flag double-triggering (walk→run blends), or two shots' edges across a cut
  lastT = ev.t;
  const sec = sectionAt(ev.t);
  const gait = gaitOf(ev.gait, sec);
  const where = `step at ${ev.t.toFixed(3)} s (${sec})`;
  // cues steps.surfaceOverride[section] > the log's own surface > the world map (surfaceFrom 'map')
  // > cues steps.surface[section] > stone; then the game's stairs mapping (stone + stairs → stair).
  // "On the stairs" is what the game uses too — the map's stairs mask at the boot (the first tread
  // is often still gait 'walk') — and the gait when the step has no position (placeholder).
  let surface = surfaceName(stepCfg.surfaceOverride?.[sec], where);
  if (!surface) {
    const base = surfaceName(ev.surface, where) ?? (surfaceFrom === 'map' ? surfaceName(ev.map?.surface, where) : undefined) ?? surfaceName(stepCfg.surface?.[sec], where) ?? 'stone';
    const stairs = ev.map && stepCfg.stairsFrom !== 'gait' ? ev.map.stairs : gait === 'stairs';
    surface = onStairs(base, stairs);
  }
  const base = stepCfg.strength?.[gait] ?? { walk: 0.45, run: 0.66, stairs: 0.43, idle: 0.3 }[gait];
  // the two boots never land identically (the live fire(): ×1.06 / ×0.94) and ±10 % per step
  const asym = ev.foot === 'R' ? 1.06 : 0.94;
  const strength = Math.min(1, base * asym * (1 + (jr() * 2 - 1) * 0.1));
  const pan = stepCfg.pan?.[ev.foot] ?? (ev.foot === 'L' ? -0.15 : 0.15);
  const st = { t: r5(ev.t), foot: ev.foot, gait, section: sec, surface, strength: +strength.toFixed(4), running: gait === 'run', pan, source: ev.source };
  if (ev.shot) st.shot = ev.shot;
  if (ev.map) st.map = ev.map;
  steps.push(st);
}
const count = (key) => steps.reduce((m, s) => ((m[s[key]] = (m[s[key]] ?? 0) + 1), m), {});
const summary = { bySection: count('section'), byGait: count('gait'), bySurface: count('surface'), dropped };
if (mapCheck) {
  const disagree = steps.filter((s) => s.map && s.map.surface !== s.surface);
  mapCheck.disagree = disagree.length;
  mapCheck.examples = disagree.slice(0, 5).map((s) => `${s.t}s ${s.surface} vs map ${s.map.surface}`);
  mapCheck.meanCanopyBySection = Object.fromEntries(Object.keys(summary.bySection).map((id) => {
    const xs = steps.filter((s) => s.section === id && s.map).map((s) => s.map.canopy);
    return [id, xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null];
  }));
}
const stepSource = stepFiles.length ? stepFiles.map(rel) : 'placeholder (cues.json placeholderSteps)';
console.log(`steps: ${steps.length} resolved (${stepFiles.length ? `${stepFiles.length} log file(s)` : 'placeholder'}) — by section ${JSON.stringify(summary.bySection)}, gait ${JSON.stringify(summary.byGait)}, surface ${JSON.stringify(summary.bySurface)}; dropped ${JSON.stringify(dropped)}`);
if (mapCheck) console.log(`map check (surfaceAt): ${mapCheck.disagree} of ${steps.filter((s) => s.map).length} steps disagree with the resolved surface${mapCheck.examples.length ? ` (${mapCheck.examples.join('; ')})` : ''}; mean canopy per section ${JSON.stringify(mapCheck.meanCanopyBySection)}`);
const stepSections = new Set(Object.keys({ ...(cues.placeholderSteps ?? {}), ...(stepCfg.sectionGait ?? {}) }));
const stray = Object.entries(summary.bySection).filter(([id]) => !stepSections.has(id));
if (stepFiles.length && stray.length) console.warn(`warning: steps fall in sections with no player shot: ${stray.map(([id, n]) => `${id} ${n}`).join(', ')} (a take recorded for another edit?)`);
const resolved = { source: stepSource, armFromPreroll, surfaceFrom, count: steps.length, summary, logs: logs.map(({ events, ...l }) => ({ ...l, file: rel(l.file) })), mapCheck, steps };
if (stepsOnly) {
  fs.mkdirSync(path.join(here, 'analysis'), { recursive: true });
  const out = path.join(here, 'analysis', 'steps-parse-check.json');
  fs.writeFileSync(out, JSON.stringify(resolved, null, 1) + '\n');
  console.log(`--steps-only: wrote ${path.relative(here, out)}; nothing rendered`);
  process.exit(0);
}
fs.writeFileSync(path.join(here, 'steps-resolved.json'), JSON.stringify(resolved, null, 1) + '\n');

// ---- 3. the score's timing, read from music.ts itself ---------------------------------------------
const M = await import(pathToFileURL(path.join(genDir, 'src/audio/music.js')).href);
const leadIn = Number(sourceText['src/audio/music.ts'].match(/let\s+loopStart\s*=\s*startAt\s*\+\s*([\d.]+)/)?.[1]);
if (!Number.isFinite(leadIn)) throw new Error('music.ts: cannot find the first note\'s lead-in (`let loopStart = startAt + …`)');
const BEAT = M.LOOP_SECONDS / (M.PHRASE_BEATS * M.PHRASE_LEVEL.length);
const hitBeat = cues.musicHitBeat ?? 2 * M.PHRASE_BEATS; // phrase B's first note: the high G5
const PHRASE_B = hitBeat * BEAT;
const musicHit = cues.musicHit ?? S.reveal.start;
// the music stem's context starts `musicOffset` before edit 0 and the score at `musicStartAt` in it,
// so beat `hitBeat` sounds at context musicStartAt + leadIn + PHRASE_B = musicHit + musicOffset.
// An early hit starts the score at 0.5 (its natural start) with a longer pre-roll; a late one keeps
// the pre-roll short and starts the score later (the old formula threw past 26.063 s).
const musicOffset = Math.max(cues.musicMinPreSeconds ?? 0.5, 0.5 + leadIn + PHRASE_B - musicHit);
const musicStartAt = musicHit + musicOffset - leadIn - PHRASE_B;
const scoreStartEdit = musicStartAt + leadIn - musicOffset;
console.log(`score: beat ${BEAT.toFixed(5)} s, phrase B (beat ${hitBeat}) at edit ${musicHit} s; startAt ${musicStartAt.toFixed(4)} in a context ${musicOffset.toFixed(4)} s ahead of edit 0 (the score's first note at edit ${scoreStartEdit.toFixed(3)} s); phraseGain ${M.phraseGain(hitBeat - 0.5).toFixed(3)} → ${M.phraseGain(hitBeat).toFixed(3)} across the hit`);

const lv = cues.levels ?? {};
const cfg = {
  seed: cues.seed,
  duration,
  pre: cues.preRollSeconds ?? 4,
  S,
  musicHit,
  musicOffset,
  musicStartAt,
  scoreLeadIn: leadIn,
  beat: BEAT,
  hitBeat,
  steps,
  stepGainDb: stepCfg.gainDb ?? {},
  curves: cues.curves ?? {},
  ambience: cues.ambience ?? {},
  music: cues.music ?? {},
  gameBed: lv.gameBed ?? 2,
  roomTone: lv.roomTone ?? 0.03,
  lantern: lv.lantern ?? 1,
  ticks: lv.ticks ?? 1,
  creak: lv.creak ?? 1,
  birdWet: lv.birdWet ?? 0.8,
  foley: lv.foley ?? 0.8,
  ornaments: lv.ornaments ?? 1,
  swell: lv.swell ?? 1,
  bloom: lv.bloom ?? 1,
};

// ---- 4. render --------------------------------------------------------------------------------------
function writeWav24(file, chans) {
  const n = chans[0].length;
  const ch = chans.length;
  const b = Buffer.alloc(44 + n * ch * 3);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * ch * 3, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * ch * 3, 28);
  b.writeUInt16LE(ch * 3, 32);
  b.writeUInt16LE(24, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * ch * 3, 40);
  let off = 44;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let x = chans[c][i];
      if (x > 1 || x < -1) clipped++;
      x = Math.max(-1, Math.min(8388607 / 8388608, x));
      b.writeIntLE(Math.round(x * 8388608), off, 3);
      off += 3;
    }
  }
  fs.writeFileSync(file, b);
  return { bytes: b.length, sha256: sha256(b), clipped };
}
const f32 = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};

const provPath = path.join(here, 'provenance.json');
const previous = fs.existsSync(provPath) ? JSON.parse(fs.readFileSync(provPath, 'utf8')) : {};
const provenance = {
  project: 'Kokiri Forest cinematic — opus-cinematic-b-sept25 soundtrack',
  renderedAt: new Date().toISOString(),
  sourceRoot: sourceRoot.split(path.sep).join('/'),
  sources,
  scripts,
  cues: { file: rel(cuesPath), sha256: sha256(cuesText) },
  stepLog: stepFiles.length
    ? { files: logs.map((l) => ({ file: rel(l.file), sha256: sha256(fs.readFileSync(l.file)), shot: l.shot, steps: l.events.length, recorder: l.recorder })), armFromPreroll, mapCheck }
    : { files: [], note: 'placeholder cadence from cues.json placeholderSteps' },
  stepsResolved: { file: 'steps-resolved.json', sha256: sha256(fs.readFileSync(path.join(here, 'steps-resolved.json'))), count: steps.length, summary },
  seed: cues.seed,
  seedForks: 'createRng(seed).fork(<stem>) per stem; bed: buses/ambience/wind0/wind1/room/rustle; birds: placed-<i>-<species>, chorus; detail: creak, lantern, ticks; steps: buses/footsteps/foley<i>; music: buses/score/ornaments; forest IR: createRng(seed).fork("forest-ir"); step jitter: <seed>/steps',
  engine: 'OfflineAudioContext (48 kHz, 2 ch) in a blank headless Chrome page loaded from file:// (--disable-gpu --disable-webgl --mute-audio). No world page, no GPU capture slot.',
  licensing: 'All sound is original synthesis in code (repo: MIT; AGENTS.md original/CC0 only). No recordings, samples or downloads. "Under the Boughs" is the repo\'s original placeholder score (src/audio/music.ts, tryFiles=false), not a Nintendo melody. Bird songs are original synthesis modelled on the general song structure of European woodland species.',
  timing: {
    sampleRate: SR,
    durationSeconds: duration,
    preRollSeconds: cfg.pre,
    sections: ordered,
    musicHitEdit: musicHit,
    musicHitBeat: hitBeat,
    beatSeconds: r5(BEAT),
    scoreLeadInSeconds: leadIn,
    musicRenderOffsetSeconds: r5(musicOffset),
    musicStartAt: r5(musicStartAt),
    musicPhraseBRenderSeconds: r5(musicStartAt + leadIn + PHRASE_B),
    scoreFirstNoteEdit: r5(scoreStartEdit),
    phraseGainBeforeHit: +M.phraseGain(hitBeat - 0.5).toFixed(4),
    phraseGainAtHit: +M.phraseGain(hitBeat).toFixed(4),
  },
  warnings,
  renders: { ...(previous.renders ?? {}) },
  console: [],
};

const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 600000, args: ['--disable-gpu', '--disable-webgl', '--mute-audio', '--allow-file-access-from-files', '--no-sandbox'] });
fs.mkdirSync(path.join(here, 'stems'), { recursive: true });
try {
  const page = await browser.newPage();
  page.on('console', (m) => provenance.console.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => provenance.console.push(`pageerror: ${e.message}`));
  await page.goto(pathToFileURL(path.join(genDir, 'index.html')).href);
  await page.waitForFunction(() => window.cineReady === true, { timeout: 30000 });
  for (const name of stemNames) {
    const t0 = Date.now();
    const { L, R, info } = await page.evaluate((n, c) => window.renderStem(n, c), name, cfg);
    const file = path.join(here, 'stems', `${name}.wav`);
    const w = writeWav24(file, [f32(L), f32(R)]);
    const { calls, ...rest } = info;
    provenance.renders[name] = { file: `stems/${name}.wav`, ...w, ...rest, peakDb: +(20 * Math.log10(info.peak || 1e-9)).toFixed(2), seconds: +((Date.now() - t0) / 1000).toFixed(1) };
    if (calls) fs.writeFileSync(path.join(here, 'birds-calls.json'), JSON.stringify(calls, null, 1) + '\n');
    console.log(`${name}: peak ${provenance.renders[name].peakDb} dBFS, rms ${info.rms.map((x) => (20 * Math.log10(x || 1e-9)).toFixed(1)).join('/')} dB, ${w.clipped} clipped, ${provenance.renders[name].seconds}s`);
    if (name === 'music') console.log(`  phrase B at edit ${info.phraseB.editSeconds} s; glissando ${info.ornaments.glissando.join('–')} s, swell ${info.ornaments.swell.join('–')} s`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(provPath, JSON.stringify(provenance, null, 2) + '\n');
}
const bad = provenance.console.filter((l) => /^(error|pageerror):/.test(l));
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
