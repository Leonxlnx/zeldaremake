#!/usr/bin/env node
/**
 * barkshare.mjs — lane 2's measurement of the owner's "the trees show the brown … a lot of the trees just
 * look fake" (2026-09-23 23:00, job 3's second half). How much of a frame's upper band is WOOD rather than
 * leaf, and how light that wood is, ours against his recording: a forest whose trunks stand clear of their
 * crowns shows a lot of brown, and one whose crowns screen them shows little.
 *
 * Pixels are classified by hue at moderate saturation — 10-45 deg as bark, 55-130 as foliage — inside
 * y 0.05-0.45 of the frame, which keeps the paving and the earth of a level view out of the count (with the
 * band at 0.25-0.75 the reference's sunlit path lands in the bark class and the comparison is meaningless;
 * that mistake is why the band is where it is).
 *
 *   node art/environment/squad2-2026-09-23/barkshare.mjs frames…
 */
import path from 'node:path';
import sharp from 'sharp';
const files = process.argv.slice(2);
const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (l > 0.5 ? 2 - mx - mn : mx + mn);
  let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
console.log('file                                  bark share  hue°   sat    light   leaf hue°  sat   light');
for (const f of files) {
  const { data, info } = await sharp(path.resolve(f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const y0 = Math.round(0.05 * height), y1 = Math.round(0.45 * height);
  let bn = 0, bh = 0, bs = 0, bl = 0, gn = 0, gh = 0, gs = 0, gl = 0, tot = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
    tot++;
    if (l < 0.06 || l > 0.85) continue;
    if (h >= 10 && h <= 45 && s > 0.12) { bn++; bh += h; bs += s; bl += l; }         // bark: orange-brown
    else if (h > 55 && h <= 130 && s > 0.10) { gn++; gh += h; gs += s; gl += l; }    // foliage: green
  }
  const p = (v, d = 3) => v.toFixed(d).padStart(6);
  console.log(`${path.basename(f).padEnd(36).slice(0, 36)}${p((100 * bn) / tot, 1)} %  ${p(bh / Math.max(1, bn), 1)} ${p(bs / Math.max(1, bn))} ${p(bl / Math.max(1, bn))}   ${p(gh / Math.max(1, gn), 1)} ${p(gs / Math.max(1, gn))} ${p(gl / Math.max(1, gn))}`);
}
