// Labeled contact sheet: node sheet.mjs <frameDir> <out.jpg> [cols=4] [tileW=640] [indices(comma, optional)] [labels json optional]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../../../package.json', import.meta.url));
const sharp = require('sharp');
const [dir, out, colsA, tileWA, idxA, labelsA] = process.argv.slice(2);
const cols = Number(colsA || 4), tw = Number(tileWA || 640), th = Math.round(tw * 9 / 16);
let names = [];
try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'shots.json'), 'utf8')); for (const s of m.shots) for (let i = 0; i < s.frames; i++) names.push(s.name + (s.frames > 1 ? `#${i}` : '')); } catch {}
if (labelsA) names = JSON.parse(fs.readFileSync(labelsA, 'utf8'));
let files = fs.readdirSync(dir).filter((f) => /^f\d{4}\.png$/.test(f)).sort();
let idx = files.map((_, i) => i);
if (idxA && idxA !== '-') idx = idxA.split(',').map(Number);
const rows = Math.ceil(idx.length / cols);
const comps = [];
for (let k = 0; k < idx.length; k++) {
  const i = idx[k];
  const img = await sharp(path.join(dir, files[i])).resize(tw, th).toBuffer();
  const label = `${String(i).padStart(2, '0')} ${names[i] || files[i]}`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = Buffer.from(`<svg width="${tw}" height="26"><rect width="${tw}" height="26" fill="black" opacity="0.6"/><text x="6" y="19" font-family="Arial" font-size="17" fill="#ffe680">${label}</text></svg>`);
  comps.push({ input: img, left: (k % cols) * tw, top: Math.floor(k / cols) * th });
  comps.push({ input: svg, left: (k % cols) * tw, top: Math.floor(k / cols) * th });
}
await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
console.log('wrote', out, idx.length, 'tiles');
