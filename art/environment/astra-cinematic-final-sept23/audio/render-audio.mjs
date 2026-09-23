import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sourceRoot = 'E:/zeldaremake-cinematic-e599075f';
const outputRoot = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire('E:/zeldaremake/package.json');
const ts = require('typescript');
const puppeteer = require('puppeteer-core');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const files = ['src/world/util/prng.ts', 'src/audio/graph.ts', 'src/audio/ambience.ts', 'src/audio/music.ts'];
const sources = {};
for (const file of files) {
  const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
  sources[file] = sha256(source);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.js$3');
  const target = path.join(outputRoot, 'generated', file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, js);
}

const indexSource = fs.readFileSync(path.join(sourceRoot, 'src/audio/index.ts'), 'utf8');
sources['src/audio/index.ts'] = sha256(indexSource);
const encoder = indexSource.slice(indexSource.indexOf('export function encodeWav('));
fs.writeFileSync(path.join(outputRoot, 'generated/encode.js'), ts.transpileModule(encoder, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
const gustFunction = indexSource.slice(indexSource.indexOf('  const gust = (t: number) => {'), indexSource.indexOf('  const step = 1 / 20;'));

const entry = `
import { createBuses, createRng, gain } from './src/audio/graph.js';
import { createAmbience } from './src/audio/ambience.js';
import { createMusic } from './src/audio/music.js';
import { encodeWav } from './encode.js';
window.renderAudio = async (kind) => {
  const seconds = 30;
  const ctx = new OfflineAudioContext(2, seconds * 48000, 48000);
  const rng = createRng('kokiri-audio-r47');
  const buses = createBuses(ctx, rng.fork('buses'));
  const ambienceRng = rng.fork('ambience');
  rng.fork('footsteps');
  const musicRng = rng.fork('music');
  const ambience = kind === 'music' ? null : createAmbience(ctx, buses.ambience, buses.reverb, ambienceRng, 0);
  const musicOut = gain(ctx, 0.45);
  const musicReverb = gain(ctx, 0.45);
  musicOut.connect(buses.music);
  musicReverb.connect(buses.reverb);
  const music = kind === 'bed' ? null : createMusic(ctx, musicOut, musicReverb, musicRng, 0.5, false);
  const musicSource = music ? await music.ready : 'none';
  ${gustFunction}
  for (let t = 0; t < seconds; t += 1 / 20) {
    ambience?.update(t, { gust: gust(t), listener: { x: 0, y: 1.2, z: 2 }, forward: { x: 0, z: -1 }, pods: [] });
    ambience?.scheduleUntil(Math.min(seconds, t + 1 / 20));
  }
  music?.scheduleUntil(seconds);
  const buffer = await ctx.startRendering();
  const bytes = encodeWav(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return { base64: btoa(binary), musicSource, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels };
};`;
fs.writeFileSync(path.join(outputRoot, 'generated/entry.js'), ts.transpileModule(entry, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText);
fs.writeFileSync(path.join(outputRoot, 'generated/index.html'), '<!doctype html><meta charset="utf-8"><title>Offline audio only</title><script type="module" src="./entry.js"></script>');
const provenance = {
  checkpoint: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(),
  sourceRoot, sources, seed: 'kokiri-audio-r47', durationSeconds: 30, sampleRate: 48000, channels: 2,
  music: 'Existing original procedural score: Under the Boughs. Both dry and wet music paths multiplied by 0.45.',
  omissions: 'No footsteps: no matching final 16–21s contact trace. No positional lantern voice: no cinematic pod/listener trace. No downloaded recordings, samples, narration or external services.',
  engine: 'Existing game graph, ambience and music modules; exact existing encodeWav function and gust envelope. OfflineAudioContext in a blank headless Chrome page, --disable-gpu --disable-webgl. No world initialization or rendering.',
  licensing: 'Repository package.json declares MIT. music.ts documents the score as original and not a Nintendo melody; ambience and reverb are seeded procedural synthesis. No stand-alone LICENSE file was present in this frozen checkout.',
  renders: {}, console: [],
};
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 120000, args: ['--disable-gpu', '--disable-webgl', '--mute-audio', '--allow-file-access-from-files', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('console', (message) => provenance.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => provenance.console.push(`pageerror: ${error.message}`));
  await page.goto(pathToFileURL(path.join(outputRoot, 'generated/index.html')).href);
  await page.waitForFunction(() => typeof window.renderAudio === 'function');
  for (const kind of ['bed', 'music', 'mix']) {
    const { base64, ...stats } = await page.evaluate((stem) => window.renderAudio(stem), kind);
    const bytes = Buffer.from(base64, 'base64');
    const name = `${kind}-raw.wav`;
    fs.writeFileSync(path.join(outputRoot, name), bytes);
    provenance.renders[kind] = { ...stats, file: name, bytes: bytes.length, sha256: sha256(bytes) };
    console.log(`${name}: ${stats.duration}s ${stats.sampleRate}Hz ${stats.channels}ch ${bytes.length} bytes`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outputRoot, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
}
