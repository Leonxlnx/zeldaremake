#!/usr/bin/env node
// Contact sheets from rendered frames, one per shot (or one for a frame list). Owner: director.
//
//   node spiderverse/tools/sheet.mjs --frames spiderverse/out/frames [--shots S01,S02] [--every 8] [--cols 6]
//   node spiderverse/tools/sheet.mjs --frames dir --list 0,120,264 --out sheet.png
//
// Each tile is labelled with global frame, shot and local frame so review notes can cite them.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SV_ROOT } from './lib/headless.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const edit = await import(path.join(SV_ROOT, 'app/core/edit.js'));
const framesDir = path.resolve(opt('frames', path.join(SV_ROOT, 'out/frames')));
const every = Number(opt('every', '8'));
const cols = Number(opt('cols', '6'));
const tileW = Number(opt('tile', '320'));
const tileH = Math.round(tileW / edit.ASPECT);
const outDir = path.resolve(opt('outdir', path.join(SV_ROOT, 'out/sheets')));
fs.mkdirSync(outDir, { recursive: true });

const fileFor = (f) => path.join(framesDir, `frame_${String(f).padStart(5, '0')}.png`);

function label(text, w) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return Buffer.from(
    `<svg width="${w}" height="18" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#000" fill-opacity="0.72"/>` +
      `<text x="4" y="13" font-family="DejaVu Sans Mono, monospace" font-size="11" fill="#fff">${esc}</text></svg>`,
  );
}

async function sheet(frames, title, outFile) {
  const present = frames.filter((f) => fs.existsSync(fileFor(f)));
  if (!present.length) return null;
  const rows = Math.ceil(present.length / cols);
  const pad = 4;
  const headH = 26;
  const W = cols * (tileW + pad) + pad;
  const H = headH + rows * (tileH + pad) + pad;
  const comps = [];
  for (let i = 0; i < present.length; i++) {
    const f = present[i];
    const loc = edit.locate(f);
    const x = pad + (i % cols) * (tileW + pad);
    const y = headH + pad + Math.floor(i / cols) * (tileH + pad);
    const img = await sharp(fileFor(f)).resize(tileW, tileH, { fit: 'fill' }).png().toBuffer();
    comps.push({ input: img, left: x, top: y });
    comps.push({ input: label(`${f}  ${loc.shot.id} f${loc.f}`, tileW), left: x, top: y + tileH - 18 });
  }
  comps.push({
    input: Buffer.from(
      `<svg width="${W}" height="${headH}" xmlns="http://www.w3.org/2000/svg"><text x="8" y="18" font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="bold" fill="#fff">${title.replace(/&/g, '&amp;')}</text></svg>`,
    ),
    left: 0,
    top: 0,
  });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#111' } }).composite(comps).png().toFile(outFile);
  return outFile;
}

if (opt('list')) {
  const list = opt('list').split(',').map(Number);
  const out = path.resolve(opt('out', path.join(outDir, 'list.png')));
  console.log(await sheet(list, opt('title', 'frames'), out));
} else {
  const ids = opt('shots') ? opt('shots').split(',') : edit.SHOTS.map((s) => s.id);
  for (const id of ids) {
    const s = edit.shotById(id);
    const frames = [];
    for (let f = s.start; f < s.end; f += every) frames.push(f);
    if (frames[frames.length - 1] !== s.end - 1) frames.push(s.end - 1);
    const out = await sheet(frames, `${s.id} ${s.name}  (${s.start}-${s.end - 1}, ${((s.end - s.start) / edit.FPS).toFixed(1)} s, ${s.lens} mm)`, path.join(outDir, `${s.id}.png`));
    if (out) console.log(out);
  }
}
