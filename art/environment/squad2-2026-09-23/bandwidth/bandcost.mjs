#!/usr/bin/env node
/**
 * bandcost.mjs — what the rung band's WIDTH costs and buys, on both of the ledger's axes.
 *
 *   node art/environment/squad2-2026-09-23/bandwidth/bandcost.mjs \
 *        --base /tmp/w-b0 --width 2.5=/tmp/w-b25 --width 5=/tmp/w-b5 --width 8=/tmp/w-b8 \
 *        [--views A_stairs,D_log] [--size 960x540] [--json out.json]
 *
 * `TREE_LOD_DITHER_BAND_M = 2.5` was chosen as "the narrowest band that is still a couple of walking
 * paces … so [the triangle cost] stays small", against a hero-A triangle headroom of 30 K. That headroom
 * is **275 K** now (the scope correction: W38 binds four viewpoints, and hero A sits at 8.72 of 9.0 M), so
 * the constraint that fixed the width is nine times looser than when it was set.
 *
 * And PR #198 measured something the lane never acted on: at a 12 m band the mask costs `D_log` **5.65 %**
 * of its pixels but only **−0.0015** SSIM against its reference frame, where the shipped 2.5 m band costs
 * **2.33 %** and **−0.0034**. A wider band touches more pixels more gently — and if that holds, the width
 * is a quality knob rather than a damage knob, and the right value is the widest the budget allows.
 *
 * So this reads two different things per width and does not conflate them:
 *
 *   • SSIM and changed share against the SAME POSE WITH THE BAND OFF — how far the band moves the picture.
 *     This is the number `gatesweep/` §3 reports, and it necessarily grows with width.
 *   • SSIM against `reference/frames/<view>.jpg` — how far the frame is from the thing the rubric compares
 *     it to. This is #198's metric and the one that decides whether a wider band is better or worse.
 *
 * Plus draws and triangles per width, because W38 is the ceiling that ends the argument.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ssim, pixelDiffFraction, toRgb } from '../../../../gauntlet/scripts/lib/image.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const base = flag('base');
if (!base) throw new Error('pass --base <dir of the band-off run>');
const widths = argv.reduce((acc, a, i) => {
  if (a !== '--width' || !argv[i + 1]) return acc;
  const k = argv[i + 1].indexOf('=');
  return [...acc, { m: Number(argv[i + 1].slice(0, k)), dir: argv[i + 1].slice(k + 1) }];
}, []);
if (!widths.length) throw new Error('pass at least one --width <metres>=<dir>');
const views = String(flag('views', 'A_stairs,D_log')).split(',');
const [W, H] = String(flag('size', '960x540')).split('x').map(Number);
const jsonOut = flag('json', null);

/** greyscale float buffer at the comparison size, from a render or from a reference JPEG */
const gray = async (file) => {
  const { data } = await sharp(file).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] / 255;
  return out;
};
const counts = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'counts.json'), 'utf8'));

const rows = [];
for (const view of views) {
  const refFile = path.resolve('reference/frames', `${view}.jpg`);
  const ref = fs.existsSync(refFile) ? await gray(refFile) : null;
  const baseFile = path.join(base, `${view}.png`);
  const baseGray = await gray(baseFile);
  const baseRgb = await toRgb(baseFile, W, H);
  const baseCounts = counts(base)[view];
  const baseToRef = ref ? ssim(baseGray, ref, W, H) : null;
  rows.push({
    view,
    bandM: 0,
    draws: baseCounts.draws,
    triangles: baseCounts.triangles,
    changedPct2: 0,
    changedPct8: 0,
    ssimToBandOff: 1,
    ssimToReference: baseToRef === null ? null : Number(baseToRef.toFixed(4)),
    deltaToReference: 0,
  });
  for (const w of widths) {
    const file = path.join(w.dir, `${view}.png`);
    if (!fs.existsSync(file)) {
      rows.push({ view, bandM: w.m, missing: true });
      continue;
    }
    const g = await gray(file);
    const rgb = await toRgb(file, W, H);
    const c = counts(w.dir)[view];
    const toRef = ref ? ssim(g, ref, W, H) : null;
    rows.push({
      view,
      bandM: w.m,
      draws: c.draws,
      triangles: c.triangles,
      changedPct2: Number((pixelDiffFraction(baseRgb, rgb, 2) * 100).toFixed(2)),
      changedPct8: Number((pixelDiffFraction(baseRgb, rgb, 8) * 100).toFixed(3)),
      ssimToBandOff: Number(ssim(baseGray, g, W, H).toFixed(5)),
      ssimToReference: toRef === null ? null : Number(toRef.toFixed(4)),
      deltaToReference: toRef === null || baseToRef === null ? null : Number((toRef - baseToRef).toFixed(4)),
    });
  }
}

const pad = (v, n) => String(v).padStart(n);
console.log(`band width against the two axes of the ledger (${W}x${H})\n`);
console.log('view        band    draws   triangles   changed>2  changed>8   ssim vs band-off   ssim vs reference   Δ vs reference');
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.view.padEnd(11)} ${pad(r.bandM, 4)} m   (not rendered)`);
    continue;
  }
  const d = r.deltaToReference === null ? '—' : (r.deltaToReference > 0 ? '+' : '') + r.deltaToReference.toFixed(4);
  console.log(
    `${r.view.padEnd(11)} ${pad(r.bandM, 4)} m ${pad(r.draws, 6)} ${pad(r.triangles, 11)} ${pad(r.changedPct2 + ' %', 10)} ${pad(r.changedPct8 + ' %', 10)} ${pad(r.ssimToBandOff, 18)} ${pad(r.ssimToReference ?? '—', 19)} ${pad(d, 15)}`,
  );
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
