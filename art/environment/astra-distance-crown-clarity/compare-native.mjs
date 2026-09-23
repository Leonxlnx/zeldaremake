// Compare the matched native captures. These metrics supplement direct image review.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const before = JSON.parse(readFileSync(path.join(root, 'before/manifest.json')));
const after = JSON.parse(readFileSync(path.join(root, 'after/manifest.json')));
assert.ok(before.complete && after.complete, 'both native captures completed');
assert.deepEqual(before.errors, []);
assert.deepEqual(after.errors, []);
assert.deepEqual(before.settings.views, after.settings.views);
assert.deepEqual(before.settings.poses, after.settings.poses);
assert.equal(before.captureScriptSha256, after.captureScriptSha256);
const result = { sourceBase: before.sha, beforeBundle: before.bundleSha256, afterBundle: after.bundleSha256, views: {} };
for (const name of before.settings.views) {
  const a = before.images[name], b = after.images[name];
  assert.deepEqual(a.camera, b.camera, `${name}: camera/time unchanged`);
  assert.deepEqual(a.lighting, b.lighting, `${name}: lighting unchanged`);
  for (const field of ['simTime', 'width', 'height', 'pixelRatio', 'drawCalls', 'triangles', 'geometries', 'textures', 'programs']) {
    assert.equal(a.stats[field], b.stats[field], `${name}: ${field} unchanged`);
  }
  const pa = path.join(root, 'before', name + '.png'), pb = path.join(root, 'after', name + '.png');
  for (const [file, expected] of [[pa, a.sha256], [pb, b.sha256]]) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected, `${name}: raw image hash`);
  const { data: da, info } = await sharp(pa).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const db = await sharp(pb).removeAlpha().raw().toBuffer();
  let changed = 0, difference = 0;
  for (let i = 0; i < da.length; i += 3) {
    const d = Math.max(...[0, 1, 2].map(c => Math.abs(da[i + c] - db[i + c])));
    if (d > 2) changed++;
    difference += (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
  }
  // Fixed upper-left ROI contains the close radial crown in the reproduced view, not the stem.
  const roi = name === 'reconstructed-distant-up' ? [80, 40, 510, 330] : [0, 0, info.width, Math.floor(info.height * .55)];
  const measure = data => {
    const lum = (x, y) => { const k = (y * info.width + x) * 3; return (.2126 * data[k] + .7152 * data[k + 1] + .0722 * data[k + 2]) / 255; };
    let total = 0, energy = 0, count = 0;
    const [x0, y0, w, h] = roi;
    for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) {
      const l = lum(x, y), lap = 4 * l - lum(x - 1, y) - lum(x + 1, y) - lum(x, y - 1) - lum(x, y + 1);
      total += l; energy += lap * lap; count++;
    }
    return { meanDisplayLuma: total / count, laplacianRms: Math.sqrt(energy / count) };
  };
  result.views[name] = { stats: b.stats, changedPixelFractionOver2: changed / (info.width * info.height), meanAbsDisplayDifference: difference / (info.width * info.height * 255), roi, before: measure(da), after: measure(db) };
  const header = Buffer.from(`<svg width="2560" height="38"><rect width="100%" height="100%" fill="#16222a"/><g font-family="Arial" font-size="20" fill="white"><text x="16" y="26">Before / ${name}</text><text x="1296" y="26">Leaf-shaped atlas / same camera, time and geometry</text></g></svg>`);
  await sharp({ create: { width: 2560, height: 758, channels: 3, background: '#16222a' } }).composite([{ input: pa, left: 0, top: 38 }, { input: pb, left: 1280, top: 38 }, { input: header, left: 0, top: 0 }]).png().toFile(path.join(root, name + '-pair.png'));
}
writeFileSync(path.join(root, 'native-comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
