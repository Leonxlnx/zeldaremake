#!/usr/bin/env node
// One-command production run. Owner: director.
//
//   node spiderverse/tools/produce.mjs --scale 1 --tag cp05-first-cut [--shots S01,S02] [--skip-audio] [--force]
//
// Steps (each recoverable and skippable):
//   1. export per-frame cues + continuity facts (tools/export-cues.mjs), continuity report
//   2. build audio: music, sfx, mix (python builders owned by MUSIC/SFX) unless --skip-audio
//   3. render frames shot by shot (tools/render.mjs skips frames already on disk)
//   4. per-shot contact sheets (tools/sheet.mjs)
//   5. assemble MP4 + verification (tools/assemble.mjs); --fill for partial cuts
//   6. score (tools/score.mjs, owned by REVIEW) if present
// A log of every step with timings is appended to out/produce.log.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SV_ROOT } from './lib/headless.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n) => args.includes(`--${n}`);
const scale = opt('scale', '1');
const tag = opt('tag', 'cut');
const framesDir = path.join(SV_ROOT, 'out', scale === '1' ? 'frames' : `frames_${scale}`);
const edit = await import(path.join(SV_ROOT, 'app/core/edit.js'));
const shots = opt('shots') ? opt('shots').split(',') : edit.SHOTS.map((s) => s.id);
const log = fs.createWriteStream(path.join(SV_ROOT, 'out/produce.log'), { flags: 'a' });

function step(name, cmd, cmdArgs, { optional = false } = {}) {
  const t0 = Date.now();
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: '/workspace' });
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  log.write(`${new Date().toISOString()} ${tag} ${name} exit=${r.status} ${s}s\n`);
  if (r.status !== 0 && !optional) {
    console.error(`[produce] ${name} failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
  return r.status;
}

step('cues', 'node', ['spiderverse/tools/export-cues.mjs']);
step('continuity', 'node', ['spiderverse/tools/continuity.mjs'], { optional: true });
if (!flag('skip-audio')) {
  if (fs.existsSync(path.join(SV_ROOT, 'tools/audio/music/build.py'))) step('music', 'python3', ['spiderverse/tools/audio/music/build.py'], { optional: true });
  if (fs.existsSync(path.join(SV_ROOT, 'tools/audio/sfx/build.py'))) step('sfx', 'python3', ['spiderverse/tools/audio/sfx/build.py'], { optional: true });
  if (fs.existsSync(path.join(SV_ROOT, 'tools/audio/mix/build.py'))) step('mix', 'python3', ['spiderverse/tools/audio/mix/build.py'], { optional: true });
}
for (const id of shots) {
  step(`render ${id}`, 'node', ['spiderverse/tools/render.mjs', '--shots', id, '--scale', scale, '--out', framesDir, ...(flag('force') ? ['--force'] : [])]);
}
step('sheets', 'node', ['spiderverse/tools/sheet.mjs', '--frames', framesDir, '--outdir', path.join(SV_ROOT, 'out/sheets', tag)], { optional: true });
const film = path.join(SV_ROOT, 'out/film', `into-the-ant-verse_${tag}.mp4`);
step('assemble', 'node', [
  'spiderverse/tools/assemble.mjs', '--frames', framesDir, '--out', film, '--fill',
  '--poster', String(edit.SYNC.titleFreeze + 6),
  ...(scale !== '1' ? ['--crf', '22'] : []),
]);
if (fs.existsSync(path.join(SV_ROOT, 'tools/score.mjs'))) step('score', 'node', ['spiderverse/tools/score.mjs', '--frames', framesDir, '--video', film], { optional: true });
console.log(`\n[produce] ${tag} done -> ${film}`);
