#!/usr/bin/env node
/**
 * player-strip.mjs — render the "what the player sees" strip for a take (site/js/player.js).
 *
 *   node site/tools/player-strip.mjs --dist dist --out gauntlet/out/last/player
 *        [--poses site/tools/player-poses.json] [--settle 12] [--size 1280x720] [--quality high]
 *        [--time 12.5] [--character] [--hud]
 *
 * Runs gauntlet/scripts/broll.mjs (`--test`: one frame per pose, the survey's own renderer path)
 * with the pose list as its shots, renames the frames to the pose names and writes index.json
 * ({ poses, sha, renderer, capturedAt, width, height }). The environment passes through, so
 * `ZR_NATIVE_GPU=1` gives a native render on the owner's machine (CI stays on SwiftShader).
 * `take.mjs --publish` picks the directory up as data/takes/<id>/player/ when it sits inside the
 * take's capture directory (gauntlet/scripts/lib/monitor.mjs syncPlayerStrip); the site shows the
 * strip on that take and borrows it for later takes until a newer one is published.
 *
 * The default poses (player-poses.json) are a curated subset of art/environment/survey2/manifest.json
 * — eye height 1.45 m, the walk up the spine, the lantern limb, the canopy from below, the arch,
 * the stairs, Saria's door, the shot-D boulder, a white-bark base.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitInfo } from '../../gauntlet/scripts/capture.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else {
    args[a.slice(2)] = n;
    i++;
  }
}
const dist = path.resolve(ROOT, args.dist ?? 'dist');
const out = path.resolve(ROOT, args.out ?? 'gauntlet/out/last/player');
const posesFile = path.resolve(ROOT, args.poses ?? path.join(HERE, 'player-poses.json'));
const settle = Math.max(1, Number(args.settle ?? 12));
const size = String(args.size ?? '1280x720');
const quality = typeof args.quality === 'string' ? args.quality : 'high';
const simTime = Number(args.time ?? 12.5);
const [width, height] = size.split('x').map(Number);
if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`bad --size ${size}`);
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no build at ${dist} (run \`npm run build\` first)`);

const spec = JSON.parse(fs.readFileSync(posesFile, 'utf8'));
// a pose name becomes a file name here and on the monitor branch: letters, digits, . _ - only
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const poses = (Array.isArray(spec) ? spec : spec.poses).filter((p) => p && typeof p.name === 'string' && SAFE_NAME.test(p.name) && Array.isArray(p.p) && Array.isArray(p.t));
if (!poses.length) throw new Error(`no (valid) poses in ${posesFile}`);

fs.mkdirSync(out, { recursive: true });
const framesDir = path.join(out, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
const shotsPath = path.join(out, 'shots.json');
fs.writeFileSync(shotsPath, JSON.stringify(poses.map((p) => ({ name: p.name, s: 1, from: { p: p.p, t: p.t, fov: p.fov ?? 46 }, to: { p: p.p, t: p.t, fov: p.fov ?? 46 } })), null, 2));

const broll = path.join(ROOT, 'gauntlet/scripts/broll.mjs');
const brollArgs = [broll, '--dist', dist, '--out', framesDir, '--size', size, '--fps', '12', '--shots', shotsPath, '--test', '--settle', String(settle), '--quality', quality, '--time', String(simTime)];
if (args.character) brollArgs.push('--character');
if (args.hud) brollArgs.push('--hud');
const t0 = Date.now();
console.error(`player-strip: ${poses.length} poses from ${path.relative(ROOT, posesFile)} → ${path.relative(ROOT, out)} (${process.platform === 'win32' && process.env.ZR_NATIVE_GPU === '1' ? 'native GPU' : 'SwiftShader'})`);
const r = spawnSync(process.execPath, brollArgs, { stdio: 'inherit', env: process.env });
if (r.status !== 0) {
  console.error(`player-strip: broll.mjs exited with ${r.status ?? r.signal}`);
  process.exit(1);
}

const shots = JSON.parse(fs.readFileSync(path.join(framesDir, 'shots.json'), 'utf8'));
let frame = 0;
const written = [];
for (const s of shots.shots) {
  const pose = poses.find((p) => p.name === s.name);
  const src = path.join(framesDir, `f${String(frame).padStart(4, '0')}.png`);
  frame += s.frames;
  if (!pose || !fs.existsSync(src)) {
    console.error(`player-strip: no frame for ${s.name}`);
    continue;
  }
  const dest = path.join(out, `${pose.name}.png`);
  fs.copyFileSync(src, dest);
  written.push({ name: pose.name, label: pose.label ?? pose.name, p: pose.p, t: pose.t, fov: pose.fov ?? 46, file: `${pose.name}.png`, bytes: fs.statSync(dest).size });
}
fs.rmSync(framesDir, { recursive: true, force: true });
fs.rmSync(shotsPath, { force: true });

const git = gitInfo(dist);
const index = {
  generatedAt: new Date().toISOString(),
  capturedAt: new Date().toISOString(),
  sha: git.sha || null,
  shortSha: git.shortSha || null,
  branch: git.branch || null,
  dirty: git.dirty,
  dist: path.relative(ROOT, dist),
  width,
  height,
  quality,
  settle,
  simTime,
  renderer: process.platform === 'win32' && process.env.ZR_NATIVE_GPU === '1' ? 'native GPU (D3D11)' : 'SwiftShader',
  eyeHeightM: spec.eyeHeightM ?? null,
  posesFile: path.relative(ROOT, posesFile),
  poses: written,
};
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.error(`player-strip: ${written.length}/${poses.length} poses in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(ROOT, out)}/index.json`);
console.log(JSON.stringify({ out, poses: written.map((p) => p.name), sha: index.shortSha, renderer: index.renderer }));
