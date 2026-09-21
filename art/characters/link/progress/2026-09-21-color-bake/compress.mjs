// Lossless RGB PNG delivery copies; retains the exact Canvas PNG capture files.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { sha } from './patch.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const captureBytes = await fs.readFile(path.join(here, 'capture.json')), capture = JSON.parse(captureBytes);
const report = { captureSha256: sha(captureBytes), encoder: 'sharp / libvips', versions: sharp.versions,
  method: 'RGBA8 decode, require every alpha=255, remove redundant alpha, lossless RGB PNG; no palette or quantization',
  options: { compressionLevel: 9, adaptiveFiltering: true, palette: false }, images: [] };
for (const image of capture.images) {
  const canvasPng = await fs.readFile(path.join(here, image.file));
  assert.equal(sha(canvasPng), image.pngSha256);
  const rgba = await sharp(canvasPng).ensureAlpha().raw().toBuffer();
  assert.equal(sha(rgba), image.rgbaSha256);
  for (let i = 3; i < rgba.length; i += 4) assert.equal(rgba[i], 255, 'fully opaque map');
  const png = await sharp(rgba, { raw: { width: image.width, height: image.height, channels: 4 } })
    .removeAlpha().png(report.options).toBuffer();
  const decoded = await sharp(png).ensureAlpha().raw().toBuffer();
  assert.equal(sha(decoded), image.rgbaSha256, 'lossless compressed PNG RGBA');
  assert.ok(png.length < canvasPng.length, 'compression improves size');
  const file = image.file.replace('.png', '-lossless.png');
  await fs.writeFile(path.join(here, file), png);
  report.images.push({ imageIndex: image.imageIndex, file, pngSha256: sha(png), rgbaSha256: sha(decoded),
    pngBytes: png.length, canvasPngBytes: canvasPng.length, originalImageViewBytes: (await fs.stat(path.join(here, 'source-' + image.image + '.png'))).size,
    savedVsCanvasBytes: canvasPng.length - png.length, fullyOpaque: true, exactRgba: true });
}
report.totalSavedVsCanvasBytes = report.images.reduce((s, i) => s + i.savedVsCanvasBytes, 0);
report.totalAppendBytes = report.images.reduce((s, i) => s + i.pngBytes + (4 - i.pngBytes % 4) % 4, 0);
await fs.writeFile(path.join(here, 'png-compression.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
