// Labelled grid of any PNGs in a directory (scouting stills): node grid.mjs <dir> <out.jpg> [cols=3] [tileW=640] [filter-regex]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../../../package.json', import.meta.url));
const sharp = require('sharp');
const [dir, out, colsA, tileWA, re] = process.argv.slice(2);
const cols = Number(colsA || 3), tw = Number(tileWA || 640), th = Math.round((tw * 9) / 16), lab = 26;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && (!re || new RegExp(re).test(f))).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
if (!files.length) throw new Error(`no PNGs in ${dir}`);
const rows = Math.ceil(files.length / cols);
const comps = [];
for (let k = 0; k < files.length; k++) {
  const img = await sharp(path.join(dir, files[k])).resize(tw, th).toBuffer();
  const x = (k % cols) * tw, y = Math.floor(k / cols) * (th + lab);
  const label = files[k].replace(/\.png$/, '').replace(/(u0\.\d{2})\d+/, '$1').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  comps.push({ input: img, left: x, top: y + lab });
  comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="${tw}" height="${lab}" fill="#111"/><text x="6" y="19" font-family="Arial" font-size="16" fill="#ffe680">${label}</text></svg>`), left: x, top: y });
}
await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
console.log('wrote', out, files.length, 'tiles');
