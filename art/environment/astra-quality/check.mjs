// Run from any directory: node art/environment/astra-quality/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compareImages, determinismDiff } from '../../../gauntlet/scripts/compare.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const [beforeDir = 'before', afterDir = 'after', outFile = 'comparison.json'] = process.argv.slice(2);
const before = read(beforeDir + '/manifest.json'), after = read(afterDir + '/manifest.json');
for (const m of [before, after]) { assert.equal(m.complete, true); assert.deepEqual(m.errors, []); }
const results = {};
for (const [id, b] of Object.entries(before.images)) {
  const a = after.images[id];
  assert.ok(a, `Missing after image ${id}`);
  assert.deepEqual(a.camera, b.camera, `${id}: camera mismatch`);
  for (const k of ['simTime', 'width', 'height', 'pixelRatio']) assert.equal(a.stats[k], b.stats[k], `${id}: ${k}`);
  assert.deepEqual(a.variant, b.variant, `${id}: override mismatch`);
  const files = [beforeDir, afterDir].map((side, i) => {
    const file = path.join(dir, side, id + '.png');
    assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), [b, a][i].sha256, `${side}/${id}: image hash`);
    return file;
  });
  const row = results[id] = { before: b.stats, after: a.stats,
    pngIdentical: b.sha256 === a.sha256,
    trianglesDelta: a.stats.triangles - b.stats.triangles,
    callsDelta: a.stats.drawCalls - b.stats.drawCalls,
    changedPixelFraction: await determinismDiff(...files) };
  const ref = path.join(root, 'reference/frames', id + '.jpg');
  if (fs.existsSync(ref)) {
    const old = await compareImages(files[0], ref), current = await compareImages(files[1], ref);
    row.referenceSSIM = { before: old.ssim, after: current.ssim, delta: +(current.ssim - old.ssim).toFixed(4) };
  }
}
assert.equal(Object.keys(results).length, Object.keys(before.images).length);
fs.writeFileSync(path.join(dir, outFile), JSON.stringify({
  beforeSha: before.sha, afterSha: after.sha, matchedViews: Object.keys(results).length,
  note: 'Combined changes. Fixed time12.6 daylight survey, not an official take.',
  unmatchedAfterViews: Object.keys(after.images).filter(id => !before.images[id]),
  views: results,
}, null, 2) + '\n');
console.table(Object.entries(results).map(([view, r]) => ({view, triangles: r.after.triangles,
  delta: r.trianglesDelta, calls: r.after.drawCalls, changed: r.changedPixelFraction, ssimDelta: r.referenceSSIM?.delta})));
