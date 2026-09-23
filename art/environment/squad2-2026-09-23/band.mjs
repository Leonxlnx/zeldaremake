#!/usr/bin/env node
/**
 * band.mjs — lane 2's measurement of "the middle distance shows trees, not haze": for each frame,
 * the mean level and the STRUCTURE of a horizontal band — the standard deviation of 8-px column
 * means (how much the band varies across the frame: trunks and crowns against mist) and the mean
 * per-column standard deviation (how much it varies within a column: crown edges, gaps, layers).
 * A flat grey veil scores near zero on both; the reference's layered crowns score high.
 *
 *   node art/environment/squad2-2026-09-23/band.mjs --band 0.10,0.45 [--x 0.1,0.9] file.png …
 */
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const files = [];
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  else files.push(argv[i]);
}
const [y0, y1] = String(args.band || '0.10,0.45').split(',').map(Number);
const [x0, x1] = String(args.x || '0,1').split(',').map(Number);
const col = Number(args.col || 8);

for (const file of files) {
  const { data, info } = await sharp(path.resolve(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx0 = Math.round(x0 * width);
  const cx1 = Math.round(x1 * width);
  const ry0 = Math.round(y0 * height);
  const ry1 = Math.round(y1 * height);
  const lum = (x, y) => {
    const i = (y * width + x) * channels;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  const colMeans = [];
  const colSds = [];
  for (let x = cx0; x + col <= cx1; x += col) {
    let sum = 0;
    let sum2 = 0;
    let n = 0;
    for (let y = ry0; y < ry1; y++) {
      for (let k = 0; k < col; k++) {
        const v = lum(x + k, y);
        sum += v;
        sum2 += v * v;
        n++;
      }
    }
    const m = sum / n;
    colMeans.push(m);
    colSds.push(Math.sqrt(Math.max(0, sum2 / n - m * m)));
  }
  const mean = colMeans.reduce((a, b) => a + b, 0) / colMeans.length;
  const across = Math.sqrt(colMeans.reduce((a, b) => a + (b - mean) ** 2, 0) / colMeans.length);
  const within = colSds.reduce((a, b) => a + b, 0) / colSds.length;
  console.log(`${path.basename(path.dirname(file))}/${path.basename(file)}  band y ${y0}–${y1}  mean ${mean.toFixed(1)}  across-columns sd ${across.toFixed(2)}  within-column sd ${within.toFixed(2)}`);
}
