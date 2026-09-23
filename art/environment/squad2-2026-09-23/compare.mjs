#!/usr/bin/env node
/**
 * compare.mjs — lane 2's evidence sheets: two (or more) frames of the same pose side by side with a
 * label bar, optionally cropped to a box, written as one JPEG.
 *
 *   node art/environment/squad2-2026-09-23/compare.mjs --out sheet.jpg \
 *        --pair "before=/tmp/before/f0000.png" --pair "after=/tmp/after/f0000.png" \
 *        [--crop 0,0,1,0.6] [--width 960] [--quality 88] [--stats]
 *
 * `--crop x0,y0,x1,y1` are frame fractions (y down). `--stats` also prints each panel's mean
 * luminance level (0–255) in the crop and in its top third, so a tone claim can be checked.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const args = { pair: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  if (key === 'pair') args.pair.push(value);
  else args[key] = value;
}
const pairs = args.pair.map((p) => {
  const k = p.indexOf('=');
  return { label: p.slice(0, k), file: path.resolve(p.slice(k + 1)) };
});
if (!pairs.length) throw new Error('need at least one --pair label=file');
const crop = typeof args.crop === 'string' ? args.crop.split(',').map(Number) : [0, 0, 1, 1];
const panelWidth = Number(args.width || 960);
const quality = Number(args.quality || 88);
const bar = 26;

const panels = [];
for (const { label, file } of pairs) {
  const meta = await sharp(file).metadata();
  const left = Math.round(crop[0] * meta.width);
  const top = Math.round(crop[1] * meta.height);
  const width = Math.max(8, Math.round((crop[2] - crop[0]) * meta.width));
  const height = Math.max(8, Math.round((crop[3] - crop[1]) * meta.height));
  const cropped = sharp(file).extract({ left, top, width, height });
  const scaled = await cropped.resize({ width: panelWidth }).png().toBuffer();
  const h = Math.round((height / width) * panelWidth);
  if (args.stats) {
    const { data, info } = await sharp(file).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const mean = (y0, y1) => {
      let sum = 0;
      let n = 0;
      for (let y = Math.round(y0 * height); y < Math.round(y1 * height); y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * info.channels;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      return n ? sum / n : 0;
    };
    console.log(`${label}: mean ${mean(0, 1).toFixed(1)} · top third ${mean(0, 1 / 3).toFixed(1)} · middle third ${mean(1 / 3, 2 / 3).toFixed(1)}`);
  }
  panels.push({ label, buffer: scaled, width: panelWidth, height: h });
}

const sheetWidth = panels.reduce((w, p) => w + p.width, 0) + (panels.length - 1) * 4;
const sheetHeight = Math.max(...panels.map((p) => p.height)) + bar;
const svg = (() => {
  let x = 0;
  const parts = panels.map((p) => {
    const t = `<rect x="${x}" y="0" width="${p.width}" height="${bar}" fill="#101014"/><text x="${x + 10}" y="${bar - 8}" font-family="DejaVu Sans, sans-serif" font-size="15" fill="#f2f2f2">${p.label.replace(/[<>&]/g, '')}</text>`;
    x += p.width + 4;
    return t;
  });
  return Buffer.from(`<svg width="${sheetWidth}" height="${sheetHeight}">${parts.join('')}</svg>`);
})();

const composite = [{ input: svg, left: 0, top: 0 }];
let x = 0;
for (const p of panels) {
  composite.push({ input: p.buffer, left: x, top: bar });
  x += p.width + 4;
}
const out = path.resolve(args.out || 'compare.jpg');
fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp({ create: { width: sheetWidth, height: sheetHeight, channels: 3, background: '#101014' } })
  .composite(composite)
  .jpeg({ quality })
  .toFile(out);
console.log(`→ ${out} (${sheetWidth}×${sheetHeight})`);
