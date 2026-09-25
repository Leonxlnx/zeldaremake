// Derive the soundtrack's section boundaries from the edit: node sync-cues.mjs [--shots shots.json] [--cues audio/cues.json]
// Every sound cue (gusts, bird placements, the lantern window, leaf ticks, the music rise and the hit) is placed
// relative to cues.json `sections`, so after any retime of shots.json this keeps picture and sound locked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const shotsFile = path.resolve(opt('shots', path.join(HERE, 'shots.json')));
const cuesFile = path.resolve(opt('cues', path.join(HERE, 'audio/cues.json')));
const FPS = 30;
// shot name prefix → section id (a section spans all of its shots)
const MAP = [
  [/^01-/, 'hero'], [/^02-/, 'lantern'], [/^0[34]-/, 'macro'], [/^05-/, 'canopy'], [/^0[67]-/, 'walk'],
  [/^0[89]-/, 'run'], [/^1[01]-/, 'stairs'], [/^12-/, 'hamlet'], [/^13-/, 'reveal'],
];
const raw = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
const shots = Array.isArray(raw) ? raw : raw.shots;
let f = 0;
const sections = [];
for (const s of shots) {
  const id = MAP.find(([re]) => re.test(s.name))?.[1];
  if (!id) throw new Error(`no section for shot ${s.name}`);
  const n = Math.round(s.s * FPS);
  const start = +(f / FPS).toFixed(4), end = +((f + n) / FPS).toFixed(4);
  const last = sections.at(-1);
  if (last && last.id === id) last.end = end;
  else sections.push({ id, start, end });
  f += n;
}
const total = +(f / FPS).toFixed(4);
const cues = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));
cues.durationSeconds = total;
cues.sections = sections;
cues.musicHit = sections.find((s) => s.id === 'reveal').start;
if (cues.fadeOut) cues.fadeOut = { ...cues.fadeOut, start: +(total - (cues.fadeOut.duration ?? 2.5)).toFixed(4) };
cues.syncedFrom = { shots: path.relative(path.dirname(cuesFile), shotsFile).replaceAll('\\', '/'), frames: f, fps: FPS };
fs.writeFileSync(cuesFile, JSON.stringify(cues, null, 2) + '\n');
console.log(`cues: ${total} s, musicHit ${cues.musicHit}, ${sections.map((s) => `${s.id} ${s.start}–${s.end}`).join(', ')}`);
