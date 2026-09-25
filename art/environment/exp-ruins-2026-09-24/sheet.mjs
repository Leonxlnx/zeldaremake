// A labelled contact sheet from a JSON spec, JPEG, shrunk in quality until it is under the size cap:
//
//   node art/environment/exp-ruins-2026-09-24/sheet.mjs <spec.json> <out.jpg>
//
// spec: { "cols": 2, "tile": [640, 358], "maxKB": 390, "title": "…",
//         "tiles": [{ "file": "a.jpg", "label": "…" }, …] }
import fs from 'node:fs';
import sharp from 'sharp';
import { svgEscape } from '../../../gauntlet/scripts/lib/image.mjs';

const [specPath, out] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const cols = spec.cols ?? 2;
const [tw, th] = spec.tile ?? [640, 358];
const maxKB = spec.maxKB ?? 390;
const titleH = spec.title ? 30 : 0;
const labelH = 22;
const rows = Math.ceil(spec.tiles.length / cols);
const W = cols * tw;
const H = titleH + rows * (th + labelH);

const layers = [];
if (spec.title) {
  layers.push({ input: Buffer.from(`<svg width="${W}" height="${titleH}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="21" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#eee">${svgEscape(spec.title)}</text></svg>`), left: 0, top: 0 });
}
for (const [i, t] of spec.tiles.entries()) {
  const x = (i % cols) * tw;
  const y = titleH + Math.floor(i / cols) * (th + labelH);
  if (t.file) layers.push({ input: await sharp(t.file).resize(tw, th, { fit: 'cover' }).toBuffer(), left: x, top: y });
  layers.push({ input: Buffer.from(`<svg width="${tw}" height="${labelH}"><rect width="100%" height="100%" fill="#1b1b1b"/><text x="6" y="16" font-family="DejaVu Sans, sans-serif" font-size="13" fill="#ddd">${svgEscape(t.label ?? '')}</text></svg>`), left: x, top: y + th });
}
const base = sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(layers);
const raw = await base.png().toBuffer();
let q = 86;
let buf;
for (;;) {
  buf = await sharp(raw).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  if (buf.length <= maxKB * 1024 || q <= 40) break;
  q -= 4;
}
fs.writeFileSync(out, buf);
console.log(`${out}: ${W}×${H}, q${q}, ${(buf.length / 1024).toFixed(0)} KB`);
