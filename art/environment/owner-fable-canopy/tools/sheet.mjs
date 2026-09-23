#!/usr/bin/env node
/**
 * sheet.mjs — BEFORE | AFTER evidence sheet from two renderer PNGs (owner-fable, native captures).
 *
 *   node gauntlet/tmp/sheet.mjs --a before.png --b after.png --out sheet.jpg --la "BEFORE 50aac29e w22-stairs-u" --lb "AFTER <sha> w22-stairs-u" [--crop x,y,w,h] [--scale 0.5]
 *
 * Both images are placed side by side at the same scale with a label bar; --crop takes the same
 * region from both (pixels of the source frame) so a defect is compared at the same place.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean));
if (!args.a || !args.b || !args.out) throw new Error('usage: --a before.png --b after.png --out sheet.jpg [--la label] [--lb label] [--crop x,y,w,h] [--scale s]');
const scale = Number(args.scale ?? 1);
const crop = typeof args.crop === 'string' ? args.crop.split(',').map(Number) : null;
const bar = 28;

async function prep(file) {
  let img = sharp(file);
  if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
  const meta = await img.metadata();
  const w = Math.round((crop ? crop[2] : meta.width) * scale);
  const h = Math.round((crop ? crop[3] : meta.height) * scale);
  if (scale !== 1) img = img.resize(w, h, { kernel: 'lanczos3' });
  return { buf: await img.png().toBuffer(), w, h };
}
const A = await prep(path.resolve(args.a));
const B = await prep(path.resolve(args.b));
// optional third panel (decision cards: reference | ours | ours-with-detail); a smaller image
// (the 640-px reference frames) is scaled up to the others' height
const C = typeof args.c === 'string' ? await prep(path.resolve(args.c)) : null;
const panels = [A, B, ...(C ? [C] : [])];
const H0 = Math.max(...panels.map((p) => p.h));
for (const p of panels) {
  if (p.h !== H0) {
    const w = Math.round((p.w * H0) / p.h);
    p.buf = await sharp(p.buf).resize(w, H0, { kernel: 'lanczos3' }).png().toBuffer();
    p.w = w;
    p.h = H0;
  }
}
const W = panels.reduce((s, p) => s + p.w, 0) + 4 * (panels.length - 1);
const H = H0 + bar;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const labels = [args.la ?? 'BEFORE', args.lb ?? 'AFTER', args.lc ?? 'C'];
let x = 0;
const composites = [];
let texts = '';
panels.forEach((p, i) => {
  composites.push({ input: p.buf, left: x, top: bar });
  texts += `<text x="${x + 8}" y="19" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#f4f4f4">${esc(labels[i])}</text>`;
  x += p.w + 4;
});
const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${W}" height="${bar}" fill="#222"/>${texts}</svg>`);
await sharp({ create: { width: W, height: H, channels: 3, background: '#111' } })
  .composite([...composites, { input: svg, left: 0, top: 0 }])
  .jpeg({ quality: 88 })
  .toFile(path.resolve(args.out));
fs.statSync(path.resolve(args.out));
console.log(`wrote ${args.out} (${W}×${H})`);
