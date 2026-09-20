/** Compare immutable, matched native warm50 captures; no browser or GPU work. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { compareImages } from '../../../gauntlet/scripts/compare.mjs';
import { decodeNative } from '../../../gauntlet/scripts/lib/image.mjs';

const afterDir = resolve(process.argv[2]);
const beforeDir = resolve(process.argv[3] || 'E:/zeldaremake-astra-environment/art/environment/astra-quality/leaf-warmth-final');
const out = resolve(process.argv[4] || 'art/environment/astra-distance/atlas-encoding-native');
mkdirSync(out, { recursive: true });
const before = JSON.parse(readFileSync(resolve(beforeDir, 'manifest.json')));
const after = JSON.parse(readFileSync(resolve(afterDir, 'manifest.json')));
assert.equal(after.complete, true);
assert.deepEqual(after.errors, []);
assert.equal(after.captureScriptSha256, before.captureScriptSha256, 'Identical capture helper');
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const luma = (p, i) => (p[i] * .2126 + p[i + 1] * .7152 + p[i + 2] * .0722) / 255;
const report = { beforeSource: before.sha, afterSource: after.sha, beforeDir, afterDir, matched: true, views: [] };
for (const [name, meta] of Object.entries(after.images)) {
  const old = before.images[name];
  assert(old, `${name}: baseline exists`);
  assert.deepEqual(meta.camera, old.camera, `${name}: exact camera`);
  assert.deepEqual(meta.lighting, old.lighting, `${name}: exact lighting`);
  assert.deepEqual(meta.variant, old.variant, `${name}: exact override`);
  for (const key of ['simTime', 'drawCalls', 'triangles', 'width', 'height', 'pixelRatio']) assert.equal(meta.stats[key], old.stats[key], `${name}: matched ${key}`);
  const a = resolve(beforeDir, `${name}.png`), b = resolve(afterDir, `${name}.png`);
  assert.equal(hash(readFileSync(a)), old.sha256);
  assert.equal(hash(readFileSync(b)), meta.sha256);
  const [A, B, delta] = await Promise.all([decodeNative(a), decodeNative(b), compareImages(b, a)]);
  assert.equal(A.width, B.width); assert.equal(A.height, B.height);
  let changed = 0, meanA = 0, meanB = 0, changedA = 0, changedB = 0, topA = 0, topB = 0, absolute = 0;
  const pixels = A.width * A.height;
  for (let j = 0; j < pixels; j++) {
    const i = j * 3, la = luma(A.rgb, i), lb = luma(B.rgb, i);
    meanA += la; meanB += lb;
    if (j < pixels / 2) { topA += la; topB += lb; }
    let max = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(A.rgb[i + c] - B.rgb[i + c]); max = Math.max(max, d); absolute += d; }
    if (max > 3) { changed++; changedA += la; changedB += lb; }
  }
  const id = name.replace(/-warm50$/, '');
  const reference = resolve('reference/frames', `${id}.jpg`);
  const againstReference = existsSync(reference) ? { before: await compareImages(a, reference), after: await compareImages(b, reference) } : null;
  const row = { name, stats: meta.stats, exactCameraLightingTime: true, sameDrawsAndTriangles: true,
    pixelFractionChangedOver3: changed / pixels, meanAbsoluteByteDelta: absolute / (pixels * 3),
    displayLuma: { before: meanA / pixels, after: meanB / pixels },
    topHalfDisplayLuma: { before: topA / (pixels / 2), after: topB / (pixels / 2) },
    changedPixelDisplayLuma: { before: changedA / changed, after: changedB / changed },
    delta, againstReference };
  report.views.push(row);
  const [pa, pb] = await Promise.all([sharp(a).resize(960, 540).png().toBuffer(), sharp(b).resize(960, 540).png().toBuffer()]);
  const labels = Buffer.from(`<svg width="1920" height="48"><rect width="1920" height="48" fill="#17202b"/><g fill="white" font-family="Arial" font-size="21"><text x="14" y="31">${id}: baseline warm50</text><text x="974" y="31">Corrected atlas encoding; warm50</text></g></svg>`);
  await sharp({ create: { width: 1920, height: 588, channels: 3, background: '#17202b' } }).composite([
    { input: labels, left: 0, top: 0 }, { input: pa, left: 0, top: 48 }, { input: pb, left: 960, top: 48 },
  ]).png().toFile(resolve(out, `${id}-pair.png`));
}
writeFileSync(resolve(out, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.views.map((r) => ({ name: r.name, triangles: r.stats.triangles, draws: r.stats.drawCalls,
  luma: r.displayLuma, topHalfLuma: r.topHalfDisplayLuma, changedPixels: r.pixelFractionChangedOver3,
  pairSsim: r.delta.ssim, referenceSsim: r.againstReference && [r.againstReference.before.ssim, r.againstReference.after.ssim] })), null, 2));
