#!/usr/bin/env node
/**
 * squad3: per-frame delta between two render directories — mean absolute difference over 8-bit
 * levels, the share of pixels that moved more than 2 / 8 levels, and each frame's mean RGB.
 * A cheap stand-in for the take's SSIM when the question is only "did this move the frame a lot".
 *
 *   node gauntlet/tmp/squad3-delta.mjs --a /tmp/hero-base --b /tmp/hero-after --names A,B,C,D,F
 */
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const names = String(args.names).split(',');
const read = async (dir, i) => sharp(path.join(path.resolve(dir), `f${String(i).padStart(4, '0')}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < names.length; i++) {
  const A = await read(args.a, i);
  const B = await read(args.b, i);
  const n = A.data.length;
  let sum = 0;
  let over2 = 0;
  let over8 = 0;
  let sa = [0, 0, 0];
  let sb = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const d = Math.abs(A.data[k] - B.data[k]);
    sum += d;
    if (d > 2) over2++;
    if (d > 8) over8++;
    sa[k % 3] += A.data[k];
    sb[k % 3] += B.data[k];
  }
  const px = n / 3;
  const r = (v) => Math.round(v * 100) / 100;
  console.log(
    `${names[i]}: mean |Δ| ${r(sum / n)} levels · >2 ${r((100 * over2) / n)} % · >8 ${r((100 * over8) / n)} % · rgb ${sa.map((v) => r(v / px)).join('/')} → ${sb.map((v) => r(v / px)).join('/')}`,
  );
}
