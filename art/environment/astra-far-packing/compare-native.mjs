// Reuses the matched-capture pixel and metadata checks from the atlas review.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(root, name)));
const before = read('before/manifest.json'), after = read('after/receipt.json');
assert(before.complete && after.complete);
assert.deepEqual(before.errors, []);
assert.deepEqual(after.errors, []);
assert.deepEqual(before.settings.views, after.settings.views);
assert.deepEqual(before.settings.poses, after.settings.poses);
const result = { beforeSource: before.sha, afterSource: after.sha, views: {} };
for (const name of before.settings.views) {
  const a = before.images[name], b = after.images[name];
  assert.deepEqual(a.camera, b.camera, `${name}: camera`);
  assert.deepEqual(a.lighting, b.lighting, `${name}: lighting`);
  for (const key of ['simTime', 'width', 'height', 'pixelRatio', 'textures', 'programs']) assert.equal(a.stats[key], b.stats[key], `${name}: ${key}`);
  const images = [];
  for (const [folder, row] of [['before', a], ['after', b]]) {
    const file = path.join(root, folder, name + '.png');
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), row.sha256, `${name}: raw hash`);
    images.push(await sharp(file).removeAlpha().raw().toBuffer());
  }
  const [da, db] = images;
  assert.equal(da.length, db.length);
  let changed = 0, over2 = 0, max = 0, sum = 0;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < da.length; i += 3) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    if (d) {
      changed++;
      const x = i / 3 % a.stats.width, y = Math.floor(i / 3 / a.stats.width);
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
    }
    if (d > 2) over2++;
    max = Math.max(max, d);
    sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
  }
  result.views[name] = {
    before: a.stats, after: b.stats,
    savedTriangles: a.stats.triangles - b.stats.triangles,
    addedDraws: b.stats.drawCalls - a.stats.drawCalls,
    changedPixels: changed, changedPixelsOver2: over2, maxChannelDifference: max,
    meanAbsoluteChannelDifference: sum / da.length, changedBounds: changed ? box : null,
    renderer: b.renderer,
  };
}
writeFileSync(path.join(root, 'native-comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
