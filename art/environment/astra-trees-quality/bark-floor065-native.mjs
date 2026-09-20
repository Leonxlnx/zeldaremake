/** Read-only comparison of the parent's matched .75/.65 native uniform study. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const dir = process.argv[2] ?? 'E:/zeldaremake-astra-environment/art/environment/2026-09-20T16-13-23-884Z-daylight';
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
assert.equal(manifest.complete, true); assert.deepEqual(manifest.errors, []);
const rois = {
  'sn-bole-lantern-tree': { left: 280, top: 160, width: 720, height: 510 },
  'sn-bole-nw-near': { left: 330, top: 245, width: 600, height: 420 },
  'sn-bole-stair-bank': { left: 280, top: 160, width: 720, height: 510 },
  'bole-reset-lantern-ese-in-11p85m': { left: 470, top: 130, width: 420, height: 510 },
  'bole-reset-nw-east-in-9p85m': { left: 550, top: 110, width: 300, height: 415 },
  'bole-reset-stairbank-west-in-11p85m': { left: 525, top: 125, width: 245, height: 435 },
};
const output = [];
for (const view of Object.keys(manifest.images).filter(v => !v.endsWith('-texture065'))) {
  const before = manifest.images[view], after = manifest.images[view + '-texture065'];
  assert.deepEqual(after.camera, before.camera, view + ': matched camera');
  assert.deepEqual(after.stats, before.stats, view + ': matched sim/render counts');
  assert.deepEqual(after.variant.uniforms, { uNearBaseFloorTexture: 0.65, uNearBaseFloorNearTexture: 0.65 });
  const files = ['', '-texture065'].map(s => path.join(dir, view + s + '.png'));
  const region = rois[view] ?? { left: 0, top: 0, width: 1280, height: 720 };
  const [a, b] = await Promise.all(files.map(p => sharp(p).extract(region).removeAlpha().raw().toBuffer()));
  assert.equal(a.length, b.length); const n = a.length / 3;
  let mad = 0, changed = 0; const mean = [0, 0], sum2 = [0, 0], dark = [0, 0], rgb = [[0, 0, 0], [0, 0, 0]];
  const dry = { count: 0, before: 0, after: 0 }, green = { count: 0, before: 0, after: 0 };
  for (let i = 0; i < a.length; i += 3) {
    let any = false; const lums = [];
    for (let t = 0; t < 2; t++) {
      const v = t ? b : a, lum = v[i] * 0.2126 + v[i + 1] * 0.7152 + v[i + 2] * 0.0722;
      lums.push(lum); mean[t] += lum; sum2[t] += lum * lum; dark[t] += lum < 20;
      for (let c = 0; c < 3; c++) rgb[t][c] += v[i + c];
    }
    for (let c = 0; c < 3; c++) { const d = Math.abs(a[i + c] - b[i + c]); mad += d; any ||= d > 0; }
    changed += any;
    // Freeze selection on baseline RGB. These are colour buckets, not material-ID masks.
    const bucket = a[i] >= a[i + 1] && a[i + 1] >= a[i + 2] && lums[0] < 65 ? dry
      : a[i + 1] > a[i] * 1.1 && a[i + 1] > a[i + 2] * 1.2 && lums[0] < 65 ? green : null;
    if (bucket) { bucket.count++; bucket.before += lums[0]; bucket.after += lums[1]; }
  }
  for (const q of [dry, green]) if (q.count) { q.before /= q.count; q.after /= q.count; }
  output.push({ view, region, byteIdentical: readFileSync(files[0]).equals(readFileSync(files[1])),
    RGB_MAD: mad / a.length, changedPixelShare: changed / n, mean: mean.map(x => x / n),
    sd: mean.map((x, t) => Math.sqrt(sum2[t] / n - (x / n) ** 2)), below20: dark.map(x => x / n),
    RGB: rgb.map(row => row.map(x => x / n)), baselineBrownBucket: dry, baselineGreenBucket: green,
    sameCamera: true, sameStats: true, variant: after.variant });
}
console.log(JSON.stringify({ source: manifest.sha, complete: manifest.complete, errors: manifest.errors,
  note: 'Encoded PNG ROI statistics. Brown/green buckets classify baseline RGB only; they are not material-ID masks. Counts and camera equality come from the native manifest.', output }, null, 2));
