#!/usr/bin/env node
/**
 * Download the reference clip and extract the frames the rubric points at.
 *
 *   npm run ref:extract            # downloads to reference/video/ (git-ignored), writes reference/frames/*.jpg + phash.json
 *   npm run ref:extract -- --skip-download   # reuse an existing reference/video/reference.mp4
 *
 * Frames are downscaled to 640 px wide JPEGs — enough for composition/palette comparison, useless
 * as textures. They are the ONLY copies of the reference allowed in the repo (GAUNTLET.md §4.C).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { phash } from './lib/image.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = path.join(ROOT, 'reference');
const VIDEO_DIR = path.join(REF, 'video');
const FRAMES = path.join(REF, 'frames');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REF, 'manifest.json'), 'utf8'));

async function resolveVideoUrl() {
  const api = `https://api.fxtwitter.com/${MANIFEST.tweet.user}/status/${MANIFEST.tweet.id}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error(`fxtwitter ${res.status}`);
  const json = await res.json();
  const vids = json?.tweet?.media?.videos ?? [];
  const best = vids[0]?.formats?.filter((f) => f.container === 'mp4').sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  if (!best) throw new Error('no mp4 variant found');
  return best.url;
}

async function main() {
  const skip = process.argv.includes('--skip-download');
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const video = path.join(VIDEO_DIR, 'reference.mp4');
  if (!skip || !fs.existsSync(video)) {
    const url = MANIFEST.tweet.directVideoUrl || (await resolveVideoUrl());
    console.error(`downloading ${url}`);
    const r = spawnSync('curl', ['-sL', '-o', video, url], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('download failed');
  }
  const ff = (args) => execSync(`ffmpeg -v error -y ${args}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  const hashes = {};
  // viewpoint frames
  for (const shot of MANIFEST.shots) {
    const out = path.join(FRAMES, `${shot.id}.jpg`);
    ff(`-ss ${shot.seconds} -i "${video}" -frames:v 1 -vf "scale=640:-2" -q:v 3 "${out}"`);
    hashes[path.relative(ROOT, out)] = await phash(out);
    console.error(`frame ${shot.id} @ ${shot.seconds}s`);
  }
  // timeline strip every 2 s (composition study + site "reference reel")
  const strip = path.join(FRAMES, 'timeline');
  fs.mkdirSync(strip, { recursive: true });
  ff(`-i "${video}" -vf "fps=1/2,scale=480:-2" -q:v 5 "${strip}/t_%03d.jpg"`);
  for (const f of fs.readdirSync(strip)) hashes[path.relative(ROOT, path.join(strip, f))] = await phash(path.join(strip, f));
  // contact sheet
  ff(`-i "${video}" -vf "fps=1/3,scale=320:-2,tile=5x5" -frames:v 1 -q:v 4 "${path.join(FRAMES, 'contact_sheet.jpg')}"`);
  hashes['reference/frames/contact_sheet.jpg'] = await phash(path.join(FRAMES, 'contact_sheet.jpg'));
  fs.writeFileSync(path.join(REF, 'phash.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: MANIFEST.tweet.url, hashes }, null, 2));
  console.error(`wrote ${Object.keys(hashes).length} reference hashes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
