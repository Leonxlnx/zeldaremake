#!/usr/bin/env node
/**
 * skyline.mjs — lane 2's measurement of the owner's "a lot of the trees just look fake, it's a weird art
 * style direction" (2026-09-23 23:00, job 3's second half). The word is vague; the structure behind it is
 * not. A forest of repeated trees draws a REGULAR tree line: crown tops at similar heights, evenly
 * spaced, the profile between them smooth. A natural one is irregular at several scales.
 *
 * So: per column, find the topmost foliage pixel (the tree line), then report
 *
 *   rise      the profile's spread, p90 − p10 as a share of the frame height — how much the line rises
 *             and falls across the view
 *   sd        its standard deviation, same units
 *   tops      local maxima of the profile (crown tops) per 100 px of width, after smoothing
 *   spacing   mean gap between neighbouring tops, and its coefficient of variation: a repeated forest
 *             spaces its crowns evenly (low cv), a natural one does not
 *   jag       mean |slope| of the profile in pixels per pixel — the line's own roughness
 *
 * Foliage is anything darker than the sky, the split taken at `--sky` of the way from the region's
 * median to its brightest decile, so it does not depend on an absolute level.
 *
 *   node art/environment/squad2-2026-09-23/skyline.mjs [--band 0,0.55] [--x 0,1] [--sky 0.45] frames…
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
const [y0, y1] = String(args.band || '0,0.55').split(',').map(Number);
const [x0, x1] = String(args.x || '0,1').split(',').map(Number);
const skyShare = Number(args.sky ?? 0.45);

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

console.log('file                                  rise%   sd%   tops/100px  spacing  cv    jag');
for (const file of files) {
  const { data, info } = await sharp(path.resolve(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx0 = Math.round(x0 * width);
  const cx1 = Math.round(x1 * width);
  const ry0 = Math.round(y0 * height);
  const ry1 = Math.round(y1 * height);
  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return lum(data[i], data[i + 1], data[i + 2]);
  };
  const all = [];
  for (let y = ry0; y < ry1; y++) for (let x = cx0; x < cx1; x++) all.push(at(x, y));
  all.sort((a, b) => a - b);
  // the sky is the bright end; foliage is anything below the split
  const split = quantile(all, 0.5) + skyShare * (quantile(all, 0.9) - quantile(all, 0.5));
  /** the tree line: the first row, from the top of the band, whose pixel is not sky */
  const line = [];
  for (let x = cx0; x < cx1; x++) {
    let y = ry0;
    while (y < ry1 && at(x, y) > split) y++;
    line.push(y);
  }
  // smooth over 5 px so single leaves do not count as crowns, then find local maxima (tops = low y)
  const smooth = line.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -2; k <= 2; k++) if (line[i + k] !== undefined) (s += line[i + k]), n++;
    return s / n;
  });
  const tops = [];
  for (let i = 3; i < smooth.length - 3; i++) {
    if (smooth[i] <= smooth[i - 3] && smooth[i] <= smooth[i + 3] && smooth[i] < smooth[i - 3] + smooth[i + 3] - smooth[i]) {
      if (!tops.length || i - tops[tops.length - 1] >= 8) tops.push(i);
    }
  }
  const gaps = tops.slice(1).map((t, i) => t - tops[i]);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const gapMean = mean(gaps);
  const gapCv = Math.sqrt(mean(gaps.map((g) => (g - gapMean) ** 2))) / Math.max(1e-6, gapMean);
  const sorted = line.slice().sort((a, b) => a - b);
  const rise = (100 * (quantile(sorted, 0.9) - quantile(sorted, 0.1))) / height;
  const m = mean(line);
  const sd = (100 * Math.sqrt(mean(line.map((v) => (v - m) ** 2)))) / height;
  const jag = mean(line.slice(1).map((v, i) => Math.abs(v - line[i])));
  const f = (v, d = 2) => v.toFixed(d).padStart(6);
  console.log(`${path.basename(file).padEnd(36).slice(0, 36)}${f(rise, 1)} ${f(sd, 1)}   ${f((100 * tops.length) / (cx1 - cx0), 1)}     ${f(gapMean, 1)} ${f(gapCv)} ${f(jag)}`);
}
