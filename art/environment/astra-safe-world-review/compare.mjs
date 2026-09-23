// node art/environment/astra-safe-world-review/compare.mjs
// Validate the saved native baseline and compare unchanged cameras against the frozen candidate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const beforeDir = path.resolve(here, '../astra-canopy-packed-integration/native');
const afterDir = path.join(here, 'native');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const before = read(path.join(beforeDir, 'manifest.json'));
const after = read(path.join(afterDir, 'manifest.json'));
assert.ok(before.complete && after.complete);
assert.deepEqual(before.errors, []);
assert.deepEqual(after.errors, []);
assert.equal(before.captureScriptSha256, after.captureScriptSha256);
const baselineInputs = ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'gauntlet/scripts/lib/browser.mjs'];
assert.equal(execFileSync('git', ['diff', before.sha, '4ad2fb50', '--', ...baselineInputs], { cwd: root, encoding: 'utf8' }), '');
assert.equal(readFileSync(path.join(afterDir, 'source.diff'), 'utf8'), '');
assert.equal(execFileSync('git', ['diff', '4b2fe8e6', '--', 'src', 'vite.config.ts'], { cwd: root, encoding: 'utf8' }), '');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { baselineSource: before.sha, baselineRoot: '4ad2fb50', baselineIdenticalInputs: baselineInputs, candidateSource: after.sha, helperSha256: after.captureScriptSha256, errors: after.errors, views: {}, extra: {} };
for (const name of before.settings.views) {
  const a = before.images[name], b = after.images[name];
  assert.deepEqual(a.camera, b.camera, `${name}: camera`);
  assert.deepEqual(a.lighting, b.lighting, `${name}: global lighting`);
  for (const key of ['simTime', 'width', 'height', 'pixelRatio']) assert.equal(a.stats[key], b.stats[key], `${name}: ${key}`);
  const pa = path.join(beforeDir, name + '.png'), pb = path.join(afterDir, name + '.png');
  assert.equal(sha(readFileSync(pa)), a.sha256, `${name}: baseline image hash`);
  assert.equal(sha(readFileSync(pb)), b.sha256, `${name}: candidate image hash`);
  const { data: da, info } = await sharp(pa).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const db = await sharp(pb).removeAlpha().raw().toBuffer();
  assert.equal(da.length, db.length);
  let changed = 0, over8 = 0, maxDifference = 0, absoluteDifference = 0, beforeLuma = 0, afterLuma = 0;
  for (let i = 0; i < da.length; i += 3) {
    const dr = Math.abs(da[i] - db[i]), dg = Math.abs(da[i + 1] - db[i + 1]), dd = Math.abs(da[i + 2] - db[i + 2]);
    const d = Math.max(dr, dg, dd);
    changed += d > 0;
    over8 += d > 8;
    maxDifference = Math.max(maxDifference, d);
    absoluteDifference += dr + dg + dd;
    beforeLuma += 0.2126 * da[i] + 0.7152 * da[i + 1] + 0.0722 * da[i + 2];
    afterLuma += 0.2126 * db[i] + 0.7152 * db[i + 1] + 0.0722 * db[i + 2];
  }
  const pixels = info.width * info.height;
  report.views[name] = {
    before: a.stats, after: b.stats,
    triangleDelta: b.stats.triangles - a.stats.triangles,
    drawDelta: b.stats.drawCalls - a.stats.drawCalls,
    withinExistingCaps: b.stats.triangles <= 9_000_000 && b.stats.drawCalls <= 700,
    changedPixels: changed, fractionOver8: over8 / pixels, maxChannelDifference: maxDifference,
    meanAbsoluteChannelDifference: absoluteDifference / (pixels * 3),
    meanDisplayLuma: { before: beforeLuma / (pixels * 255), after: afterLuma / (pixels * 255) },
  };
}
for (const name of after.settings.views.filter(name => !before.settings.views.includes(name))) {
  const b = after.images[name];
  assert.equal(sha(readFileSync(path.join(afterDir, name + '.png'))), b.sha256);
  report.extra[name] = { stats: b.stats, camera: b.camera, note: 'Existing authored close pose, candidate only; no matched baseline was rendered.' };
}
const closeDir = path.join(here, 'baseline-close');
if (existsSync(path.join(closeDir, 'manifest.json'))) {
  const close = read(path.join(closeDir, 'manifest.json'));
  assert.ok(close.complete);
  assert.deepEqual(close.errors, []);
  assert.equal(close.bundleSha256, before.bundleSha256);
  assert.equal(close.captureScriptSha256, after.captureScriptSha256);
  assert.equal(readFileSync(path.join(closeDir, 'source.diff'), 'utf8'), '');
  const name = 's2-join-close', a = close.images[name], b = after.images[name];
  assert.deepEqual(a.camera, b.camera);
  assert.deepEqual(a.lighting, b.lighting);
  for (const key of ['simTime', 'width', 'height', 'pixelRatio']) assert.equal(a.stats[key], b.stats[key]);
  assert.equal(sha(readFileSync(path.join(closeDir, name + '.png'))), a.sha256);
  report.extra[name] = {
    before: a.stats, after: b.stats, camera: b.camera,
    baselineSource: close.sha, baselineSha256: a.sha256, candidateSha256: b.sha256,
    triangleDelta: b.stats.triangles - a.stats.triangles, drawDelta: b.stats.drawCalls - a.stats.drawCalls,
    note: 'Root requested one exact-pose baseline after no historical source-equivalent image was found. Same saved root build; no additional six-view baseline boot. Close pose is diagnostic, not a hero rubric view.',
  };
}
writeFileSync(path.join(here, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
