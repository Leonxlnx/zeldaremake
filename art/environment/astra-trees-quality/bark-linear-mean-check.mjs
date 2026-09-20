/** CPU check of the bark texture mean in the shader's linear colour space; no GPU required. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { Color, ColorManagement, LinearSRGBColorSpace, SRGBColorSpace } from 'three';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = readFileSync(path.join(root, 'src/world/trees/materials.ts'), 'utf8');
const mean = Number(source.match(/const BARK_DETAIL_MEAN = ([\d.]+);/)?.[1]);
assert.ok(Number.isFinite(mean), 'read the production bark mean');
const nearMapGain = Number(source.match(/export const DISTANT_NEAR_MAP_GAIN = ([\d.]+);/)?.[1]);
assert.ok(Number.isFinite(nearMapGain), 'read the current distant bark contrast gain');
assert.equal(ColorManagement.workingColorSpace, LinearSRGBColorSpace);
const color = new Color();
// The texture library marks colour maps as SRGBColorSpace. Three uses SRGB8_ALPHA8, so
// each encoded channel is decoded before sampling/filtering, then the shader takes the dot.
const linear = Array.from({ length: 256 }, (_, n) => color.setRGB(n / 255, n / 255, n / 255, SRGBColorSpace).r);
const luma = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const oldMean = 133.29 / 255;
const oldEmbedded = Number(oldMean.toFixed(4)), embedded = Number(mean.toFixed(4));
const reports = [];

for (const resolution of ['1k', '2k']) {
  const relative = `public/textures/tree_bark_03/${resolution === '2k' ? '2k/' : ''}color.jpg`;
  const file = path.join(root, relative);
  // Read every native texel. Resizing encoded pixels before linearisation changes the mean.
  const { data, info } = await sharp(file).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3);
  const pixels = info.width * info.height;
  let total = 0, fineBefore = 0, fineAfter = 0, touchBefore = 0, touchAfter = 0;
  const distant = [2, nearMapGain].map(gain => ({ gain, blackBefore: 0, blackAfter: 0 }));
  for (let i = 0; i < data.length; i += 3) {
    const rgb = [linear[data[i]], linear[data[i + 1]], linear[data[i + 2]]];
    const lum = luma(...rgb);
    total += lum;
    fineBefore += 0.3 + 0.7 * clamp(lum / oldMean, 0.55, 1.7);
    fineAfter += 0.3 + 0.7 * clamp(lum / mean, 0.55, 1.7);
    touchBefore += 0.5 + 0.5 * clamp(lum / oldMean, 0.6, 1.5);
    touchAfter += 0.5 + 0.5 * clamp(lum / mean, 0.6, 1.5);
    // Distant bark embeds the SAME constant to four decimal places. Its contrast
    // expansion must be centred on linear samples too, before its luminance/hue divisors.
    const maxChannel = Math.max(...rgb);
    for (const row of distant) {
      row.blackBefore += Number((maxChannel - oldEmbedded) * row.gain + oldEmbedded <= 0);
      row.blackAfter += Number((maxChannel - embedded) * row.gain + embedded <= 0);
    }
  }
  const measured = total / pixels;
  assert.ok(Math.abs(measured / mean - 1) < 0.01, `${resolution}: shader mean within 1% of decoded texels`);
  if (resolution === '2k') assert.ok(Math.abs(measured - mean) < 1e-7, '2K mean matches recorded precision');
  assert.ok(Math.abs(measured / Number(mean.toFixed(4)) - 1) < 0.01, `${resolution}: embedded distant mean within 1%`);
  reports.push({
    file: relative, width: info.width, height: info.height,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    linearMean: measured, relativeError: measured / mean - 1,
    fullFineMeanFactor: { before: fineBefore / pixels, after: fineAfter / pixels },
    fullTouchMeanFactor: { before: touchBefore / pixels, after: touchAfter / pixels },
    distantFullyClippedTexelShare: distant.map(row => ({ gain: row.gain, before: row.blackBefore / pixels, after: row.blackAfter / pixels })),
  });
}
console.log(JSON.stringify({
  shaderMean: mean, distantEmbeddedMean: Number(mean.toFixed(4)), reports,
  note: 'Base-level texel statistics, not rendered pixels. GPU mip filtering, lighting and visual review remain with the native capture.',
}, null, 2));
