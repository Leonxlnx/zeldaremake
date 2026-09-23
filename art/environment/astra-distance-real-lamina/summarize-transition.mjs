/** Verify saved evidence and make the compact review artifact; no browser or source mutation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFile(path.join(root, name), 'utf8').then(JSON.parse);
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const [capture, trace, build] = await Promise.all([read('native-transition/manifest.json'), read('native-transition/transition.json'), read('build.json')]);
assert(capture.complete);
assert.deepEqual(capture.errors, []);
assert.equal(capture.sha, build.source);
assert.equal(capture.bundleSha256, build.sha256);
assert.equal(capture.sourceDiffSha256, hash(''));
assert.equal(capture.captureScriptSha256, hash(await fs.readFile(path.join(root, 'native-transition/capture-script.mjs'))));
const distribution = get => {
  const values = trace.frames.map(get).sort((a, b) => a - b);
  return { min: values[0], median: values[Math.floor(values.length / 2)], p95: values[Math.floor(values.length * .95)], max: values.at(-1) };
};
const summary = {
  source: capture.sha, bundleSha256: capture.bundleSha256, renderer: capture.renderer,
  transitionScriptSha256: hash(await fs.readFile(path.join(root, 'transition.mjs'))),
  frames: trace.frames.length, coverage: trace.coverage,
  treeUpdateMs: distribution(r => r.updateMs),
  completedRenderAwaitMs: distribution(r => r.completedMs),
  firstVisit: { poseMs: trace.firstJump.poseMs, completedMs: trace.firstJump.completedMs, programsAdded: trace.firstJump.after.stats.programs - trace.firstJump.before.stats.programs },
  stalls: trace.frames.filter(r => r.completedMs > 1000).map(r => ({ k: r.k, phase: r.phase, completedMs: r.completedMs, treeUpdateMs: r.updateMs, programsAdded: r.stats.programs - (trace.frames[r.k - 1]?.stats.programs ?? r.stats.programs) })),
  canopyPool: { before: trace.boot.pool.nearCanopyPool, after: trace.frames.at(-1).pool.nearCanopyPool },
  basePool: { before: trace.boot.pool.nearBasePool, after: trace.frames.at(-1).pool.nearBasePool },
  distantNearBucketRange: [Math.min(...trace.frames.map(r => r.lod[0])), Math.max(...trace.frames.map(r => r.lod[0]))],
  returns: {},
  limitations: ['Unpaired camera route; does not attribute timing to candidate or test player collision.', 'All initial pooled geometry remained resident; cold rebuild/prefetch/eviction are untested natively.', 'Render-await timings include requestAnimationFrame, GPU readback, shader first use and host scheduling; they are not FPS.', 'Geometry is visibly sparser; unselected far planes remain. Adoption still needs current-root combined validation.'],
};
for (const id of ['A_stairs', 'F_canopy']) {
  const pngs = await Promise.all([`native-before/${id}.png`, `native-transition/${id}-return.png`].map(name => fs.readFile(path.join(root, name))));
  assert.equal(hash(pngs[1]), trace.returns[id].sha256);
  const [a, b] = await Promise.all(pngs.map(png => sharp(png).removeAlpha().raw().toBuffer()));
  let changedPixels = 0, channelError = 0, maxChannelError = 0;
  for (let i = 0; i < a.length; i += 3) {
    let changed = false;
    for (let c = 0; c < 3; c++) { const d = Math.abs(a[i + c] - b[i + c]); changed ||= d > 0; channelError += d; maxChannelError = Math.max(maxChannelError, d); }
    changedPixels += Number(changed);
  }
  summary.returns[id] = { changedPixels, meanAbsoluteChannelError255: channelError / a.length, maxChannelError255: maxChannelError, stats: trace.returns[id].stats, closeSlots: trace.returns[id].distantClose.active };
}
const tiles = [];
for (const [i, k] of [0, 60, 180, 240, 360, 480].entries()) {
  const shot = trace.shots.find(s => s.k === k), bytes = await fs.readFile(path.join(root, 'native-transition', shot.file));
  assert.equal(hash(bytes), shot.sha256);
  tiles.push({ input: await sharp(bytes).resize(640, 360).toBuffer(), left: i % 2 * 640, top: Math.floor(i / 2) * 384 });
  const text = `<svg width="640" height="24"><rect width="640" height="24" fill="#151a18"/><text x="12" y="17" fill="white" font-family="sans-serif" font-size="14">Frame ${k}: ${trace.frames[k].phase}, ${trace.frames[k].distantClose.active} close slots</text></svg>`;
  tiles.push({ input: Buffer.from(text), left: i % 2 * 640, top: Math.floor(i / 2) * 384 + 360 });
}
await sharp({ create: { width: 1280, height: 1152, channels: 3, background: '#151a18' } }).composite(tiles).jpeg({ quality: 90 }).toFile(path.join(root, 'native-transition', 'overview.jpg'));
summary.videoSha256 = hash(await fs.readFile(path.join(root, 'native-transition', 'transition.mp4')));
await fs.writeFile(path.join(root, 'native-transition', 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ frames: summary.frames, coverage: summary.coverage, firstVisit: summary.firstVisit, stalls: summary.stalls, returns: summary.returns }, null, 2));
