// Check capture provenance and report real renderer deltas without altering raw PNGs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const read = name => fs.readFile(path.join(root, name), 'utf8').then(JSON.parse);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const [before, after, snapshot, build] = await Promise.all([
  read('native-before/manifest.json'), read('native-after/manifest.json'),
  read('baseline-dist-manifest.json'), read('build.json'),
]);
const expected = [
  ['6231cffbfec78d405cb3e83064bf3f68c7daca8d', snapshot.files.find(x => x.file === 'assets/index-Hs0AcnGr.js').hash],
  [build.source, build.sha256],
];
for (const [index, report] of [before, after].entries()) {
  assert.equal(report.complete, true);
  assert.deepEqual(report.errors, []);
  assert.equal(report.sha, expected[index][0]);
  assert.equal(report.bundleSha256, expected[index][1]);
  assert.match(report.renderer, /D3D11/);
  assert.doesNotMatch(report.renderer, /SwiftShader|llvmpipe|software/i);
  assert.equal(report.sourceDiffSha256, hash(''));
  assert.equal(await fs.readFile(path.join(root, `native-${index ? 'after' : 'before'}/source.diff`), 'utf8'), '');
}
assert.equal(before.renderer, after.renderer);
assert.equal(before.captureScriptSha256, after.captureScriptSha256);
assert.deepEqual(before.settings.views, after.settings.views);
assert.deepEqual(before.settings.poses, after.settings.poses);
assert.deepEqual(Object.keys(before.images), Object.keys(after.images));
const results = {
  sources: expected.map(([sha, bundleSha256]) => ({sha, bundleSha256})),
  renderer: after.renderer,
  note: 'Static setPose captures reset hysteresis; these pairs do not prove motion or cold-start stability. Pixel metrics describe change, not visual acceptance.',
  images: {},
};
for (const id of Object.keys(before.images)) {
  const a = before.images[id], b = after.images[id];
  assert.deepEqual(a.camera, b.camera, `${id}: camera mismatch`);
  assert.deepEqual(a.lighting, b.lighting, `${id}: lighting mismatch`);
  assert.deepEqual(a.variant, b.variant, `${id}: variant mismatch`);
  for (const key of ['simTime', 'width', 'height', 'pixelRatio']) assert.equal(a.stats[key], b.stats[key], `${id}: ${key}`);
  assert.equal(a.stats.simTime, 12.6);
  assert.equal(a.stats.width, 1280);
  assert.equal(a.stats.height, 720);
  const pngs = await Promise.all(['before', 'after'].map(side => fs.readFile(path.join(root, `native-${side}/${id}.png`))));
  assert.equal(hash(pngs[0]), a.sha256);
  assert.equal(hash(pngs[1]), b.sha256);
  const pixels = await Promise.all(pngs.map(png => sharp(png).removeAlpha().raw().toBuffer()));
  assert.equal(pixels[0].length, pixels[1].length);
  let changed = 0, totalError = 0, maxError = 0;
  for (let i = 0; i < pixels[0].length; i += 3) {
    let pixelError = 0;
    for (let c = 0; c < 3; c++) pixelError += Math.abs(pixels[0][i+c] - pixels[1][i+c]);
    changed += Number(pixelError > 0);
    totalError += pixelError;
    maxError = Math.max(maxError, pixelError / 3);
  }
  const delta = Object.fromEntries(['drawCalls', 'triangles', 'geometries', 'textures', 'programs'].map(key => [key, b.stats[key] - a.stats[key]]));
  results.images[id] = {
    before: a.stats, after: b.stats, delta,
    pixelIdentical: changed === 0,
    changedPixels: changed,
    changedFraction: changed / (a.stats.width * a.stats.height),
    meanAbsoluteChannelError255: totalError / pixels[0].length,
    maxPixelMeanChannelError255: maxError,
    beforeSha256: a.sha256, afterSha256: b.sha256,
    distantClose: b.distantClose,
  };
  if (id === 'A_stairs' || id === 'F_canopy') {
    assert.equal(changed, 0, `${id}: fixed-view pixels changed`);
    assert.equal(delta.triangles, 0, `${id}: unexpected fixed-view triangle change`);
    assert.equal(delta.drawCalls, 0, `${id}: unexpected fixed-view draw change`);
    assert.equal(b.distantClose.active, 0, `${id}: unexpected fixed-view close slot`);
  }
}
await fs.writeFile(path.join(root, 'native-comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
