// squad2: what a change did to the owner's fixed frames — per frame, how many pixels moved, the mean
// and local-detail shift, and the luminance SSIM against the reference frame before and after (the
// same 256×144 luminance SSIM gauntlet/scripts/compare.mjs reports, so the numbers are comparable).
//
//   node art/environment/squad2-2026-09-23/sixcheck.mjs <beforeDir> <afterDir> <names,comma> [refDir]
//
// The dirs are broll output (f0000.png… in the shots' order); names are the viewpoint ids in that
// same order, which is also how the reference frames are named (reference/frames/<id>.jpg).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [beforeDir, afterDir, namesArg, refDir = 'reference/frames'] = process.argv.slice(2);
const names = namesArg.split(',');

const lum = async (file, w = 256, h = 144) => {
  const { data } = await sharp(file).resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = (0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]) / 255;
  return out;
};
/** global luminance SSIM (the constants of the standard formula, 8-bit dynamic range) */
const ssim = (a, b) => {
  const n = a.length;
  const mean = (v) => v.reduce((s, x) => s + x, 0) / n;
  const ma = mean(a), mb = mean(b);
  let va = 0, vb = 0, cov = 0;
  for (let i = 0; i < n; i++) {
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
    cov += (a[i] - ma) * (b[i] - mb);
  }
  va /= n - 1; vb /= n - 1; cov /= n - 1;
  const c1 = 0.01 ** 2, c2 = 0.03 ** 2;
  return ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2));
};
const frameStats = async (file) => {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, n = info.width * info.height;
  let sum = 0, nd = 0;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const L = 0.2126 * data[i * ch] + 0.7152 * data[i * ch + 1] + 0.0722 * data[i * ch + 2];
    sum += L;
    if (prev !== null) nd += Math.abs(L - prev);
    prev = L;
  }
  return { mean: sum / n, nd: nd / (n - 1), data, ch, n };
};

const rows = [];
for (const [i, name] of names.entries()) {
  const f = `f${String(i).padStart(4, '0')}.png`;
  const b = await frameStats(path.join(beforeDir, f));
  const a = await frameStats(path.join(afterDir, f));
  let moved = 0, maxd = 0, absSum = 0;
  for (let p = 0; p < b.n; p++) {
    const o = p * b.ch;
    const d = Math.max(Math.abs(b.data[o] - a.data[o]), Math.abs(b.data[o + 1] - a.data[o + 1]), Math.abs(b.data[o + 2] - a.data[o + 2]));
    if (d > 4) moved++;
    if (d > maxd) maxd = d;
    absSum += d;
  }
  const row = { name, beforeMean: +b.mean.toFixed(1), afterMean: +a.mean.toFixed(1), beforeNd: +b.nd.toFixed(2), afterNd: +a.nd.toFixed(2), movedPct: +((100 * moved) / b.n).toFixed(3), meanAbs: +(absSum / b.n).toFixed(3), maxDelta: maxd };
  const ref = path.join(refDir, `${name}.jpg`);
  if (fs.existsSync(ref)) {
    const r = await lum(ref);
    row.ssimBefore = +ssim(r, await lum(path.join(beforeDir, f))).toFixed(4);
    row.ssimAfter = +ssim(r, await lum(path.join(afterDir, f))).toFixed(4);
    row.towardReference = +(row.ssimAfter - row.ssimBefore).toFixed(4);
  }
  rows.push(row);
  console.log(
    `${name.padEnd(11)} moved ${String(row.movedPct).padStart(7)} %  mean ${row.beforeMean} → ${row.afterMean}  detail ${row.beforeNd} → ${row.afterNd}` +
      (row.ssimBefore !== undefined ? `  SSIM vs ref ${row.ssimBefore} → ${row.ssimAfter} (${row.towardReference >= 0 ? '+' : ''}${row.towardReference})` : ''),
  );
}
fs.writeFileSync(path.join(afterDir, 'sixcheck.json'), JSON.stringify(rows, null, 1));
