/** CPU-only native hue-study evaluator. All variant masks come from that pose's k=0 PNG. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = process.argv[2];
assert.ok(dir, 'Usage: node tree-hue-evaluate.mjs CAPTURE_DIR [--warmth=0,.35,.65] [--baseline-only]');
const baselineOnly = process.argv.includes('--baseline-only');
const strengths = (process.argv.find(arg => arg.startsWith('--warmth='))?.slice(9) ?? '0,.35,.65').split(',').map(Number);
assert.ok(strengths[0] === 0 && strengths.every((v, i) => Number.isFinite(v) && v >= 0 && v <= 1 && (!i || v > strengths[i - 1])), 'Strengths must increase from zero');
const referenceDir = fileURLToPath(new URL('../../../reference/frames/', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
assert.equal(manifest.complete, true, 'Capture must be complete');
assert.deepEqual(manifest.errors, [], 'Capture must have no errors');
const boxes = {
  A_stairs: [.91, .025, .985, .085],
  C_lookback: [.035, .13, .22, .215],
  F_canopy: [.62, .20, .82, .33],
};
const distantViews = manifest.settings.views.filter(v => /^distance-crown-\d+m$/.test(v));
const optionalViews = ['sky-opening', ...distantViews];
const decode = Array.from({ length: 256 }, (_, x) => x / 255 <= .04045
  ? x / 255 / 12.92 : ((x / 255 + .055) / 1.055) ** 2.4);
const median = values => {
  values.sort((a, b) => a - b); const n = values.length;
  return n ? (values[(n - 1) >> 1] + values[n >> 1]) / 2 : null;
};
function colour(data, i) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]].map(x => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  let h = null;
  if (d) {
    h = (max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    if (h < 0) h += 360;
  }
  return { h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l, sv: max ? d / max : 0, v: max };
}
const foliage = c => c.h !== null && c.h >= 55 && c.h <= 170 && c.s > .12 && c.l >= .06 && c.l <= .85;
const blueSky = c => c.h !== null && c.h >= 180 && c.h <= 240 && c.s > .08 && c.l > .35;
async function readImage(file, resize = false) {
  let q = sharp(file);
  if (resize) q = q.resize(320, 180, { fit: 'fill', kernel: 'lanczos3' });
  const { data, info } = await q.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3, file + ': RGB expected');
  return { data, width: info.width, height: info.height };
}
function selection(image, box, predicate = () => true) {
  const [x0, y0, x1, y1] = box.map((v, i) => Math.floor(v * (i % 2 ? image.height : image.width)));
  const indices = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * image.width + x) * 3;
    if (predicate(colour(image.data, i))) indices.push(i);
  }
  return { bounds: [x0, y0, x1, y1], regionPixels: (x1 - x0) * (y1 - y0), indices };
}
function metrics(image, indices, baseline) {
  const hs = [], ss = [], ls = [], svs = [], vs = [];
  let encodedY = 0, linearY = 0, changed = 0, mad = 0, maxDelta = 0;
  for (const i of indices) {
    const c = colour(image.data, i);
    if (c.h !== null) hs.push(c.h);
    ss.push(c.s); ls.push(c.l); svs.push(c.sv); vs.push(c.v);
    encodedY += (.2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2]) / 255;
    linearY += .2126 * decode[image.data[i]] + .7152 * decode[image.data[i + 1]] + .0722 * decode[image.data[i + 2]];
    let pixelDelta = 0;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(image.data[i + k] - baseline.data[i + k]);
      mad += d; pixelDelta = Math.max(pixelDelta, d);
    }
    changed += pixelDelta > 0; maxDelta = Math.max(maxDelta, pixelDelta);
  }
  const n = indices.length;
  return { hueMedianDeg: median(hs), HSL_S_median: median(ss), HSL_L_median: median(ls),
    HSV_S_median: median(svs), HSV_V_median: median(vs),
    encodedYMean: n ? encodedY / n : null, decodedScreenshotYMean: n ? linearY / n : null,
    RGB_MAD_bytes: n ? mad / (3 * n) : null, maxChannelDeltaBytes: maxDelta,
    changedPixelShare: n ? changed / n : null, chromaticPixelCount: hs.length };
}
function compareRegion(name, variants, box, predicate) {
  const baseline = variants[0].image, fixed = selection(baseline, box, predicate);
  assert.ok(fixed.indices.length, name + ': empty baseline mask');
  const baseMetrics = metrics(baseline, fixed.indices, baseline);
  return { name, nativeSize: [baseline.width, baseline.height], bounds: fixed.bounds,
    regionPixels: fixed.regionPixels, fixedBaselinePixelCount: fixed.indices.length,
    fixedBaselineShare: fixed.indices.length / fixed.regionPixels,
    variants: variants.map(({ key, warmth, image }) => {
      assert.equal(image.width, baseline.width); assert.equal(image.height, baseline.height);
      const values = metrics(image, fixed.indices, baseline);
      return { key, warmth, ...values, deltaFromZero: {
        hueDeg: values.hueMedianDeg === null ? null : values.hueMedianDeg - baseMetrics.hueMedianDeg,
        HSL_S: values.HSL_S_median - baseMetrics.HSL_S_median,
        HSL_L: values.HSL_L_median - baseMetrics.HSL_L_median,
        HSV_S: values.HSV_S_median - baseMetrics.HSV_S_median,
        decodedScreenshotYPercent: baseMetrics.decodedScreenshotYMean
          ? 100 * (values.decodedScreenshotYMean / baseMetrics.decodedScreenshotYMean - 1) : null,
      } };
    }) };
}
const output = [];
for (const view of [...Object.keys(boxes), ...optionalViews]) {
  const entries = Object.entries(manifest.images).filter(([key]) => key === view || key.startsWith(view + '-'));
  if (!entries.length && optionalViews.includes(view)) continue;
  assert.ok(entries.length, view + ': missing required view');
  const variants = entries.map(([key, meta]) => {
    const uniforms = meta.variant?.uniforms ?? {};
    assert.ok(Object.keys(uniforms).every(k => k === 'uTreeLeafWarmth'), key + ': unrelated uniform override');
    assert.ok(baselineOnly || Object.hasOwn(uniforms, 'uTreeLeafWarmth'), key + ': explicit override required; do not infer zero from the production default');
    return { key, meta, warmth: uniforms.uTreeLeafWarmth ?? null };
  }).sort((a, b) => a.warmth - b.warmth);
  const selected = baselineOnly ? variants.filter(v => v.warmth === 0 || v.warmth === null) : variants;
  if (baselineOnly) assert.equal(selected.length, 1, view + ': one baseline required; null warmth means unspecified legacy default');
  else assert.deepEqual(selected.map(v => v.warmth), strengths, view + ': expected warmth variants');
  for (const v of selected) {
    assert.deepEqual(v.meta.camera, selected[0].meta.camera, view + ': camera mismatch');
    assert.deepEqual(v.meta.stats, selected[0].meta.stats, view + ': simulation/render count mismatch');
    assert.deepEqual(v.meta.lighting, selected[0].meta.lighting, view + ': lighting mismatch');
    v.image = await readImage(path.join(dir, v.key + '.png'));
  }
  const regions = [];
  if (boxes[view]) {
    const small = await Promise.all(selected.map(async v => ({ ...v, image: await readImage(path.join(dir, v.key + '.png'), true) })));
    regions.push(compareRegion('top35-fixed-foliage', small, [0, 0, 1, .35], foliage));
    regions.push(compareRegion('native-crown-interior-all-pixels', selected, boxes[view]));
    regions.push(compareRegion('native-crown-interior-fixed-foliage', selected, boxes[view], foliage));
    const ref = await readImage(path.join(referenceDir, view + '.jpg'), true);
    const mask = selection(ref, [0, 0, 1, .35], foliage);
    output.push({ view, referenceTop35: { count: mask.indices.length, regionPixels: mask.regionPixels,
      ...metrics(ref, mask.indices, ref) }, regions });
  } else {
    regions.push(view === 'sky-opening'
      ? compareRegion('native-fixed-blue-sky-control', selected, [.58, 0, .9, .32], blueSky)
      : compareRegion('native-distant-fixed-foliage', selected, [.08, .25, .92, .85], foliage));
    output.push({ view, regions });
  }
}
console.log(JSON.stringify({ capture: path.resolve(dir), source: manifest.sha,
  sourceDiffSha256: manifest.sourceDiffSha256, mode: baselineOnly ? 'BASELINE PREFLIGHT ONLY; no candidate comparison' : `matched ${strengths.join('/')} comparison`,
  missingOptionalViews: optionalViews.filter(v => !output.some(row => row.view === v)),
  distantControlsCaptured: distantViews,
  method: 'Fixed k=0 colour-mask membership for every candidate. RGB-derived HSL; H55–170, S>.12, L.06–.85. Published band: Lanczos3 320x180; y<floor(.35*180)=62. Native interior boxes also include all pixels.',
  limits: 'Colour masks are not material IDs. A interior overlaps reference HUD, so reference comparison uses top band only. C/F dark reference interiors are poorly selected by this green mask. Decoded screenshot Rec709 Y is post-tone-map, not shader radiance. Distant poses are each compared only with themselves; no reference or cross-distance composition score. Sky control tests blue pixels only. No automatic visual accept/HOLD.',
  output }, null, 2));
