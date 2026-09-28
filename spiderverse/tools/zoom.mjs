// scratch: render a few glyphs large so letterform details can be judged by eye
import sharp from 'sharp';
import { getGlyph } from '../app/scene/letters.js';

const chars = (process.argv[2] || 'ABPRDQ89G0S,').split('');
const style = process.argv[3] || 'heavy';
const em = 300;
const cell = 340;
const cols = Math.min(6, chars.length);
const rows = Math.ceil(chars.length / cols);
const W = cols * cell;
const H = rows * cell;
let body = '';
chars.forEach((ch, i) => {
  const gl = getGlyph(ch, style);
  if (!gl) return;
  const ox = (i % cols) * cell + 30;
  const oy = Math.floor(i / cols) * cell + cell - 60;
  const d = gl.contours
    .map((c) => `M${c.map((p) => `${(ox + p[0] * em).toFixed(2)},${(oy - p[1] * em).toFixed(2)}`).join('L')}Z`)
    .join(' ');
  body += `<path d="${d}" fill="#fff" fill-rule="nonzero"/>`;
  body += `<text x="${ox}" y="${oy - em * 0.78}" font-family="monospace" font-size="14" fill="#55607a">${ch === '<' ? '&lt;' : ch}</text>`;
  body += `<line x1="${ox - 20}" y1="${oy}" x2="${ox + em}" y2="${oy}" stroke="#2a3348"/>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#101218"/>${body}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(process.argv[4] || '/tmp/zoom.png');
console.log('ok');
