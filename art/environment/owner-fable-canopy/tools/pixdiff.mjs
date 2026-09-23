#!/usr/bin/env node
/**
 * pixdiff.mjs — how many pixels differ between two capture directories, per viewpoint.
 *   node gauntlet/tmp/pixdiff.mjs gauntlet/out/base-6view gauntlet/out/roof-6view [threshold=8]
 * Prints, per PNG present in both: share of pixels whose max channel delta exceeds the threshold,
 * the mean absolute delta, and the bounding box of the changed pixels (so a change can be
 * located in the frame).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [a, b, thr = '8'] = process.argv.slice(2);
if (!a || !b) throw new Error('usage: pixdiff.mjs <dirA> <dirB> [threshold]');
const T = Number(thr);
const files = fs.readdirSync(a).filter((f) => f.endsWith('.png') && fs.existsSync(path.join(b, f)));
for (const f of files) {
  const [ia, ib] = await Promise.all([sharp(path.join(a, f)).raw().toBuffer({ resolveWithObject: true }), sharp(path.join(b, f)).raw().toBuffer({ resolveWithObject: true })]);
  if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) {
    console.log(`${f}: size differs`);
    continue;
  }
  const { width, height, channels } = ia.info;
  let changed = 0;
  let sum = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      let m = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(ia.data[i + c] - ib.data[i + c]);
        if (d > m) m = d;
        sum += d;
      }
      if (m > T) {
        changed++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const share = changed / (width * height);
  const box = changed ? `x ${(x0 / width).toFixed(2)}–${(x1 / width).toFixed(2)} y ${(y0 / height).toFixed(2)}–${(y1 / height).toFixed(2)}` : '—';
  console.log(`${f}: changed ${(share * 100).toFixed(3)} % (> ${T}/255), mean |Δ| ${(sum / (width * height * 3)).toFixed(3)}/255, box ${box}`);
}
