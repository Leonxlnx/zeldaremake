#!/usr/bin/env node
/**
 * Render the five 30.000 s stems of the opus-cinematic-sept24 soundtrack (48 kHz stereo 24-bit):
 *   stems/bed.wav  stems/birds.wav  stems/detail.wav  stems/steps.wav  stems/music.wav
 *
 *   node render-audio.mjs [--cues cues.json] [--steps <capture-log.json>] [--log-fps 60]
 *                         [--log-start <edit s>] [--stems bed,birds,detail,steps,music]
 *
 * The game's audio modules are transpiled UNCHANGED from this checkout's src/ (their sha256s are
 * recorded) into generated/, next to the cinematic's own synthesis (synth/cine.js), and rendered
 * in a blank headless Chrome page with OfflineAudioContext (GPU/WebGL disabled, audio muted).
 * Without --steps a placeholder step track is generated from cues.json (walk / run / stairs
 * cadences); with it, each rising edge of a foot's `stance` in the 60 Hz capture log is a step.
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
const sourceRoot = path.resolve(opt('source-root', path.join(here, '../../../..')));
const require = createRequire(path.join(sourceRoot, 'package.json'));
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const chrome = opt('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const rel = (p) => path.relative(sourceRoot, p).split(path.sep).join('/');

const cuesPath = path.resolve(opt('cues', path.join(here, 'cues.json')));
const cuesText = fs.readFileSync(cuesPath, 'utf8');
const cues = JSON.parse(cuesText);
const stepLogPath = opt('steps', null) ? path.resolve(opt('steps')) : null;
const stemNames = opt('stems', 'bed,birds,detail,steps,music').split(',').map((s) => s.trim()).filter(Boolean);
const SR = cues.sampleRate ?? 48000;
const duration = cues.durationSeconds ?? 30;
const S = Object.fromEntries(cues.sections.map((s) => [s.id, { start: s.start, end: s.end }]));
for (const id of ['hero', 'lantern', 'macro', 'canopy', 'walk', 'run', 'stairs', 'reveal']) if (!S[id]) throw new Error(`cues.json: section "${id}" missing`);

// ---- 1. transpile the game modules (unchanged sources) -------------------------------------------
const genDir = path.join(here, 'generated');
fs.rmSync(genDir, { recursive: true, force: true });
const files = ['src/world/util/prng.ts', 'src/audio/graph.ts', 'src/audio/ambience.ts', 'src/audio/footsteps.ts', 'src/audio/music.ts'];
const sources = {};
for (const file of files) {
  const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
  sources[file] = sha256(source);
  const js = ts
    .transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.js$3');
  const target = path.join(genDir, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, js);
}
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
const sectionAt = (t) => cues.sections.find((s) => t >= s.start && t < s.end)?.id ?? 'reveal';
const stepCfg = cues.steps ?? {};

function contactsFromLog(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(j) ? j : j.rows ?? j.samples ?? j.ticks ?? j.frames ?? [];
  const fps = Number(opt('log-fps', j.fps ?? 60));
  const logStart = Number(opt('log-start', j.editStart ?? 0));
  const frame0 = rows.length ? rows[0].tick ?? rows[0].frame ?? 0 : 0;
  const timeOf = (row, i) => {
    for (const k of ['editTime', 'edit_time', 'edit', 'tEdit', 'editSeconds', 't', 'time']) if (typeof row[k] === 'number') return row[k];
    const f = row.tick ?? row.frame;
    return logStart + (typeof f === 'number' ? f - frame0 : i) / fps;
  };
  const feetOf = (row) => {
    const f = row.feet ?? row.linkFeetContact ?? row.feetContact ?? row.contacts ?? row.character?.linkFeetContact;
    if (Array.isArray(f)) return f.map((x, i) => (typeof x === 'boolean' ? { foot: i === 0 ? 'L' : 'R', stance: x } : { foot: x.foot ?? (i === 0 ? 'L' : 'R'), stance: !!x.stance, surface: x.surface }));
    if (Array.isArray(row.stance)) return row.stance.map((x, i) => ({ foot: i === 0 ? 'L' : 'R', stance: !!x }));
    return [];
  };
  const events = [];
  const prev = {};
  let shot;
  rows.forEach((row, i) => {
    const t = timeOf(row, i);
    const feet = feetOf(row);
    const thisShot = row.shot ?? row.shotId ?? row.scenario;
    // the first tick of a log (and of every new shot) only arms the edge detector: a boot already
    // planted when the shot starts is not a step
    const arm = i === 0 || thisShot !== shot;
    shot = thisShot;
    for (const f of feet) {
      if (!arm && f.stance && prev[f.foot] === false) {
        const gait = row.gait ?? row.linkGait ?? row.character?.linkGait;
        events.push({ t, foot: f.foot, gait, surface: row.surface ?? f.surface, source: 'log' });
      }
      prev[f.foot] = f.stance;
    }
  });
  return events;
}

function placeholderSteps() {
  const events = [];
  const pace = cues.placeholderSteps ?? { walk: 0.366, run: 0.273, stairs: 0.4 };
  let foot = 'L';
  for (const id of ['walk', 'run', 'stairs']) {
    for (let t = S[id].start; t < S[id].end - 1e-6; t += pace[id]) {
      events.push({ t: +t.toFixed(4), foot, gait: id === 'stairs' ? 'stairs' : id, source: 'placeholder' });
      foot = foot === 'L' ? 'R' : 'L';
    }
  }
  return events;
}

const rawSteps = stepLogPath ? contactsFromLog(stepLogPath) : placeholderSteps();
rawSteps.sort((a, b) => a.t - b.t);
const minGap = stepCfg.minGap ?? 0.16;
const jr = rngFrom(`${cues.seed}/steps`);
const steps = [];
let lastT = -1e9;
for (const ev of rawSteps) {
  if (ev.t < 0 || ev.t >= duration) continue;
  if (ev.t - lastT < minGap) continue; // a noisy stance flag double-triggering (walk→run blends)
  lastT = ev.t;
  const sec = sectionAt(ev.t);
  let gait = String(ev.gait ?? sec).toLowerCase();
  if (gait === 'climb' || gait === 'stair') gait = 'stairs';
  if (sec === 'stairs' && gait !== 'idle') gait = 'stairs';
  if (!['walk', 'run', 'stairs', 'idle'].includes(gait)) gait = sec === 'run' ? 'run' : 'walk';
  const surface = ev.surface ?? stepCfg.surface?.[sec] ?? (gait === 'stairs' ? 'stair' : 'stone');
  const base = stepCfg.strength?.[gait] ?? { walk: 0.47, run: 0.85, stairs: 0.45, idle: 0.3 }[gait];
  // the two boots never land identically (the live fire(): ×1.06 / ×0.94) and ±10 % per step
  const asym = ev.foot === 'R' ? 1.06 : 0.94;
  const strength = Math.min(1, base * asym * (1 + (jr() * 2 - 1) * 0.1));
  const pan = stepCfg.pan?.[ev.foot] ?? (ev.foot === 'L' ? -0.15 : 0.15);
  steps.push({ t: +ev.t.toFixed(5), foot: ev.foot, gait, section: sec, surface, strength: +strength.toFixed(4), running: gait === 'run', pan, source: ev.source });
}
fs.writeFileSync(path.join(here, 'steps-resolved.json'), JSON.stringify({ source: stepLogPath ? rel(stepLogPath) : 'placeholder (cues.json placeholderSteps)', count: steps.length, steps }, null, 1) + '\n');
console.log(`steps: ${steps.length} (${stepLogPath ? 'from log' : 'placeholder'})`);

// ---- 3. render --------------------------------------------------------------------------------------
const BEAT = 60 / 76;
const musicHit = cues.musicHit ?? S.reveal.start;
const musicOffset = 0.8 + 32 * BEAT - musicHit; // createMusic(startAt 0.5): first note +0.3, phrase B = beat 32
if (musicOffset < 0) throw new Error(`musicHit ${musicHit} is later than the score allows (${(0.8 + 32 * BEAT).toFixed(3)} s)`);
const lv = cues.levels ?? {};
const cfg = {
  seed: cues.seed,
  duration,
  pre: cues.preRollSeconds ?? 4,
  S,
  musicHit,
  musicOffset,
  steps,
  stepGainDb: stepCfg.gainDb ?? {},
  gameBed: lv.gameBed ?? 1,
  roomTone: lv.roomTone ?? 0.03,
  lantern: lv.lantern ?? 1,
  ticks: lv.ticks ?? 1,
  birdWet: lv.birdWet ?? 0.8,
  ornaments: lv.ornaments ?? 1,
  swell: lv.swell ?? 1,
  bloom: lv.bloom ?? 1,
};

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
  project: 'Kokiri Forest cinematic — opus-cinematic-sept24 soundtrack',
  renderedAt: new Date().toISOString(),
  sourceRoot: sourceRoot.split(path.sep).join('/'),
  sources,
  scripts,
  cues: { file: rel(cuesPath), sha256: sha256(cuesText) },
  stepLog: stepLogPath ? { file: rel(stepLogPath), sha256: sha256(fs.readFileSync(stepLogPath)) } : { file: null, note: 'placeholder cadence from cues.json placeholderSteps' },
  stepsResolved: { file: 'steps-resolved.json', sha256: sha256(fs.readFileSync(path.join(here, 'steps-resolved.json'))), count: steps.length },
  seed: cues.seed,
  seedForks: 'createRng(seed).fork(<stem>) per stem; bed: buses/ambience/wind0/wind1/room/rustle; birds: placed-<i>-<species>, chorus; detail: lantern, ticks; steps: buses/footsteps/foley<i>; music: buses/score/ornaments; forest IR: createRng(seed).fork("forest-ir"); step jitter: <seed>/steps',
  engine: 'OfflineAudioContext (48 kHz, 2 ch) in a blank headless Chrome page loaded from file:// (--disable-gpu --disable-webgl --mute-audio). No world page, no GPU capture slot.',
  licensing: 'All sound is original synthesis in code (repo: MIT; AGENTS.md original/CC0 only). No recordings, samples or downloads. "Under the Boughs" is the repo\'s original placeholder score (src/audio/music.ts), not a Nintendo melody. Bird songs are original synthesis modelled on the general song structure of European woodland species.',
  timing: { sampleRate: SR, durationSeconds: duration, preRollSeconds: cfg.pre, musicHitEdit: musicHit, musicRenderOffsetSeconds: musicOffset, musicPhraseBRenderSeconds: 0.8 + 32 * BEAT },
  renders: { ...(previous.renders ?? {}) },
  console: [],
};

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
    const { calls, ...summary } = info;
    provenance.renders[name] = { file: `stems/${name}.wav`, ...w, ...summary, peakDb: +(20 * Math.log10(info.peak || 1e-9)).toFixed(2), seconds: +((Date.now() - t0) / 1000).toFixed(1) };
    if (calls) fs.writeFileSync(path.join(here, 'birds-calls.json'), JSON.stringify(calls, null, 1) + '\n');
    console.log(`${name}: peak ${provenance.renders[name].peakDb} dBFS, rms ${info.rms.map((x) => (20 * Math.log10(x || 1e-9)).toFixed(1)).join('/')} dB, ${w.clipped} clipped, ${provenance.renders[name].seconds}s`);
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
