#!/usr/bin/env node
/**
 * uplookmetrics.mjs — the three numbers `../uplooks/` judged "content overhead" by, made reproducible.
 *
 *   node art/environment/squad2-2026-09-23/poseaudit/uplookmetrics.mjs <image.png> [...] [--crop x,y,w,h]
 *
 * `../uplooks/README.md` reports a whole-frame mean, a "neighbour-to-neighbour luminance difference (local
 * detail — a flat slab reads under 2, leaves read 5–6)" and a "pale > 150" share for three up-looks, and
 * concludes from them that nothing overhead needs changing. Those numbers were computed ad hoc and no script
 * was committed, so **nobody could re-derive them** — which matters now that `poseaudit/` has withdrawn one
 * of the three rows for being a camera three metres underground, and the replacement has to be measured the
 * same way or it cannot be compared.
 *
 * So: the definitions, in code, checked against the published values of the two rows that stand.
 *
 *   mean          — mean luminance over the region, 0–255.
 *   local detail  — the mean absolute luminance difference between horizontally and vertically adjacent
 *                   pixels, 0–255. A flat slab has nothing to differ, leaves have edges everywhere.
 *   pale > 150    — the share of pixels brighter than 150, which for an up-look is sky through the canopy.
 *
 * `--crop x,y,w,h` in frame fractions, for excluding the HUD if a comparison needs it. The published rows
 * were whole-frame, HUD included, so the default is whole-frame too — a metric is only comparable to the
 * numbers it is being compared with.
 */
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const files = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
if (!files.length) throw new Error('pass one or more image paths');
const cropArg = flag('crop');

const measure = async (file) => {
  let img = sharp(file);
  if (cropArg) {
    const meta = await sharp(file).metadata();
    const [fx, fy, fw, fh] = cropArg.split(',').map(Number);
    img = img.extract({ left: Math.round(fx * meta.width), top: Math.round(fy * meta.height), width: Math.round(fw * meta.width), height: Math.round(fh * meta.height) });
  }
  const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  let pale = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (data[i] > 150) pale++;
  }
  let diff = 0;
  let pairs = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) {
        diff += Math.abs(data[i] - data[i + 1]);
        pairs++;
      }
      if (y + 1 < h) {
        diff += Math.abs(data[i] - data[i + w]);
        pairs++;
      }
    }
  }
  return { mean: sum / data.length, detail: diff / pairs, pale: (pale / data.length) * 100 };
};

console.log('image                                    mean   local detail   pale > 150');
for (const f of files) {
  const m = await measure(f);
  console.log(`${path.basename(f).padEnd(38)} ${m.mean.toFixed(1).padStart(6)} ${m.detail.toFixed(2).padStart(14)} ${(m.pale.toFixed(1) + ' %').padStart(12)}`);
}
