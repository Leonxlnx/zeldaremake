// Read the immutable native images; reuse the repository's reference metric.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { compareImages } from '../../../gauntlet/scripts/compare.mjs';
import { decodeNative } from '../../../gauntlet/scripts/lib/image.mjs';
const dir = path.resolve(process.argv[2] || 'art/environment/astra-world-resume/native-pair');
const read = p => JSON.parse(fs.readFileSync(p));
const before = read(path.join(dir, 'before/manifest.json'));
const after = read(path.join(dir, 'after/manifest.json'));
for (const m of [before, after]) { assert.equal(m.complete, true); assert.deepEqual(m.errors, []); }
assert.deepEqual(before.settings, after.settings);
assert.equal(before.build.publicHash, after.build.publicHash);
assert.equal(before.runtime.renderer, after.runtime.renderer);
assert.equal(before.browser, after.browser);
const report = { before: before.build.sha, after: after.build.sha, renderer: after.runtime.renderer, browser: after.browser, settings: after.settings, views: {} };
for (const id of Object.keys(before.images)) {
  const b = before.images[id], a = after.images[id];
  assert.deepEqual(b.camera, a.camera, `${id}: camera`);
  assert.deepEqual(b.lighting, a.lighting, `${id}: lighting`);
  assert.equal(b.stats.drawCalls, a.stats.drawCalls, `${id}: draw calls`);
  const bp = path.join(dir, 'before', id + '.png'), ap = path.join(dir, 'after', id + '.png');
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash(bp), b.sha256, `${id}: original before PNG`);
  assert.equal(hash(ap), a.sha256, `${id}: original after PNG`);
  const [B, A] = await Promise.all([decodeNative(bp), decodeNative(ap)]);
  assert.equal(B.width, A.width); assert.equal(B.height, A.height);
  let changed = 0, over8 = 0, maxChannelDelta = 0;
  for (let i = 0; i < A.rgb.length; i += 3) {
    const d = Math.max(...[0, 1, 2].map(c => Math.abs(A.rgb[i + c] - B.rgb[i + c])));
    if (d) changed++; if (d > 8) over8++; maxChannelDelta = Math.max(maxChannelDelta, d);
  }
  const ref = path.resolve('reference/frames', id + '.jpg');
  const metrics = fs.existsSync(ref) ? { before: await compareImages(bp, ref), after: await compareImages(ap, ref) } : undefined;
  report.views[id] = { drawCalls: a.stats.drawCalls, trianglesBefore: b.stats.triangles, trianglesAfter: a.stats.triangles, addedTriangles: a.stats.triangles - b.stats.triangles, changedPixels: changed, changedPixelsOver8: over8, fractionOver8: over8 / (A.width * A.height), maxChannelDelta, ...(metrics ? { reference: metrics, ssimDelta: Number((metrics.after.ssim - metrics.before.ssim).toFixed(4)) } : {}) };
}
fs.writeFileSync(path.join(dir, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.views).map(([id, m]) => [id, { draws: m.drawCalls, addedTriangles: m.addedTriangles, changedPixelsOver8: m.changedPixelsOver8, ssimDelta: m.ssimDelta }])), null, 2));
