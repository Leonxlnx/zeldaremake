#!/usr/bin/env node
/**
 * review-sheets.mjs — visual review aids for a recorded take (frames on disk, before the encode).
 *
 *   node art/environment/opus-cinematic-b-sept25/review-sheets.mjs --take <take dir> [--shots shots.json] [--every 6]
 *
 * Writes into <take>/review/:
 *   strip-<shot>.jpg   every Nth frame of the shot (plus its last), labelled, 4 per row at 480 px
 *   cuts.jpg           every cut as a pair: last frame of shot k | first frame of shot k+1
 *   pops-<shot>.jpg    for the pop candidates in review.json: frame i-1 | frame i | ×4 difference, cropped round the cell
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const take = path.resolve(opt('take'));
const shotsFile = path.resolve(opt('shots', path.join(HERE, 'shots.json')));
const every = Number(opt('every', 6));
const out = path.join(take, 'review');
fs.mkdirSync(out, { recursive: true });
const FPS = 30;
const raw = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
let f0 = 0;
const plan = (Array.isArray(raw) ? raw : raw.shots).map((s) => { const n = Math.round(s.s * FPS); const r = { name: s.name, start: f0, frames: n }; f0 += n; return r; });
const framePath = (n) => path.join(take, 'frames', `f${String(n).padStart(4, '0')}.png`);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (w, text) => Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#111"/><text x="5" y="16" font-family="Arial" font-size="14" fill="#ffe680">${esc(text)}</text></svg>`);

async function grid(tiles, cols, tw, file) {
  const th = Math.round((tw * 9) / 16), lab = 22;
  const rows = Math.ceil(tiles.length / cols);
  const comps = [];
  for (let k = 0; k < tiles.length; k++) {
    const x = (k % cols) * tw, y = Math.floor(k / cols) * (th + lab);
    comps.push({ input: await sharp(tiles[k].img).resize(tw, th).toBuffer(), left: x, top: y + lab });
    comps.push({ input: label(tw, tiles[k].text), left: x, top: y });
  }
  await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 86 }).toFile(file);
}

// 1. filmstrips
for (const s of plan) {
  const idx = [];
  for (let i = 0; i < s.frames; i += every) idx.push(i);
  if (idx.at(-1) !== s.frames - 1) idx.push(s.frames - 1);
  const tiles = idx.filter((i) => fs.existsSync(framePath(s.start + i))).map((i) => ({ img: framePath(s.start + i), text: `${s.name} #${i} (f${s.start + i}, ${((s.start + i) / FPS).toFixed(2)} s)` }));
  if (tiles.length) await grid(tiles, 4, 480, path.join(out, `strip-${s.name}.jpg`));
}
// 2. cuts
const cutTiles = [];
for (let k = 0; k + 1 < plan.length; k++) {
  const a = plan[k].start + plan[k].frames - 1, b = plan[k + 1].start;
  if (!fs.existsSync(framePath(a)) || !fs.existsSync(framePath(b))) continue;
  cutTiles.push({ img: framePath(a), text: `${plan[k].name} OUT f${a}` }, { img: framePath(b), text: `→ ${plan[k + 1].name} IN f${b}` });
}
if (cutTiles.length) await grid(cutTiles, 4, 480, path.join(out, 'cuts.jpg'));
// 3. pop candidates (from review.json)
const reviewFile = path.join(out, 'review.json');
if (fs.existsSync(reviewFile)) {
  const rv = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
  for (const s of rv.shots) {
    const pops = (s.pixels?.pops ?? []).slice(0, 8);
    if (!pops.length) continue;
    const tiles = [];
    for (const p of pops) {
      const W = 1920, H = 1080, cw = W / 16, ch = H / 9;
      const left = Math.max(0, Math.round((p.cell[0] - 1.5) * cw)), top = Math.max(0, Math.round((p.cell[1] - 1.5) * ch));
      const box = { left, top, width: Math.min(W - left, Math.round(cw * 4)), height: Math.min(H - top, Math.round(ch * 4)) };
      const a = await sharp(framePath(p.frame - 1)).extract(box).toBuffer();
      const b = await sharp(framePath(p.frame)).extract(box).toBuffer();
      const ra = await sharp(a).raw().toBuffer({ resolveWithObject: true });
      const rb = await sharp(b).raw().toBuffer();
      const d = Buffer.alloc(ra.data.length);
      for (let i = 0; i < d.length; i++) d[i] = Math.min(255, Math.abs(ra.data[i] - rb[i]) * 4);
      const diff = await sharp(d, { raw: ra.info }).png().toBuffer();
      tiles.push({ img: a, text: `f${p.frame - 1}` }, { img: b, text: `f${p.frame} cell ${p.cell} Δ${p.diff}` }, { img: diff, text: '×4 diff' });
    }
    await grid(tiles, 3, 480, path.join(out, `pops-${s.name}.jpg`));
  }
}
console.log(`review sheets → ${path.relative(ROOT, out)}`);
