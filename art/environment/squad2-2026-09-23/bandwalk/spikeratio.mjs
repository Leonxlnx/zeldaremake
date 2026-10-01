#!/usr/bin/env node
/**
 * spikeratio.mjs — settles PR #206's argument on its own terms, with the denominator changed.
 *
 *   node art/environment/squad2-2026-09-23/bandwalk/spikeratio.mjs \
 *        --band /tmp/frame-band --noband /tmp/frame-noband [--steps 30] [--size 960x540]
 *        [--grid 8] [--cells 3]
 *
 * #206 (`dither/PART6`) recommends dropping the rung fade because one tree's swap is **0.22 % of the
 * frame** while a single 0.1 m walking step already changes **46 %** of it. The numerator is right and the
 * denominator is the whole screen — which `bandwalk/` §2 measured to be foreground-dominated: walking half
 * a metre changes 91–95 % of the pixels in the bottom row of cells, ground one to three metres away. A
 * crown-local shape change is not masked by smooth parallax of the ground you are walking over, so
 * "0.22 % of 46 %" compares two quantities that are not in the same currency.
 *
 * The denominator that decides whether a discontinuity reads is **the same location's own ongoing rate of
 * change**. A pop is visible when the change at that spot jumps far above what it was already doing; it is
 * invisible when it does not. So: take the cells the band is working in (found the way `maskchurn.mjs`
 * finds them — the two builds stand at identical camera positions, so their difference IS the mask), build
 * the per-step churn series inside each cell for each build, and report
 *
 *     spike ratio = the largest single step / the median of that cell's other steps
 *
 * A hard cut should show a clear spike. A working fade should flatten it. Both builds walk the same poses
 * at **0.1 m a step — one frame of walking at 30 fps** — so the series is a per-frame rate, not an
 * artefact of a coarse stride (which is what made `dither/PART5`'s first two attempts inconclusive, and
 * what made this lane's own 0.5 m strip unable to see the crown).
 */
import fs from 'node:fs';
import path from 'node:path';
import { toRgb } from '../../../../gauntlet/scripts/lib/image.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const bandDir = flag('band');
const nobandDir = flag('noband');
if (!bandDir || !nobandDir) throw new Error('pass --band <dir> --noband <dir>');
const [W, H] = String(flag('size', '960x540')).split('x').map(Number);
const grid = Number(flag('grid', 8));
const want = Number(flag('cells', 3));
const steps = Number(flag('steps', 30));
const cellW = Math.floor(W / grid);
const cellH = Math.floor(H / grid);

const file = (dir, k) => path.join(dir, `step-${String(k).padStart(2, '0')}.png`);
const frames = { band: [], noband: [] };
let n = 0;
for (let k = 0; k < steps; k++) {
  if (!fs.existsSync(file(bandDir, k)) || !fs.existsSync(file(nobandDir, k))) break;
  frames.band.push(await toRgb(file(bandDir, k), W, H));
  frames.noband.push(await toRgb(file(nobandDir, k), W, H));
  n++;
}
if (n < 4) throw new Error(`need at least 4 steps on both sides, found ${n}`);

const cellChangedPct = (a, b, cx, cy) => {
  let changed = 0;
  let total = 0;
  for (let y = cy * cellH; y < (cy + 1) * cellH; y++) {
    for (let x = cx * cellW; x < (cx + 1) * cellW; x++) {
      const i = (y * W + x) * 3;
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 8) changed++;
      total++;
    }
  }
  return (changed / total) * 100;
};
const median = (xs) => {
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** the cells the mask touches most over the whole strip: summed same-pose difference between builds */
const ranked = [];
for (let cy = 0; cy < grid; cy++) {
  for (let cx = 0; cx < grid; cx++) {
    let sum = 0;
    for (let k = 0; k < n; k++) sum += cellChangedPct(frames.band[k], frames.noband[k], cx, cy);
    if (sum > 0) ranked.push({ cx, cy, maskSum: Number(sum.toFixed(2)) });
  }
}
ranked.sort((p, q) => q.maskSum - p.maskSum);
const picked = ranked.slice(0, want);

const out = [];
for (const c of picked) {
  const row = { cell: `${c.cx},${c.cy}`, maskSum: c.maskSum };
  for (const side of ['noband', 'band']) {
    const series = [];
    for (let k = 1; k < n; k++) series.push(Number(cellChangedPct(frames[side][k - 1], frames[side][k], c.cx, c.cy).toFixed(2)));
    const max = Math.max(...series);
    const at = series.indexOf(max);
    const others = series.filter((_, i) => i !== at);
    const med = median(others);
    row[side] = { series, max, atStep: at + 1, medianOfOthers: Number(med.toFixed(2)), spikeRatio: med > 0 ? Number((max / med).toFixed(2)) : null };
  }
  out.push(row);
}

console.log(`per-frame churn inside the cells the band works in (0.1 m a step = one frame at 30 fps, ${n} frames)\n`);
for (const r of out) {
  console.log(`cell ${r.cell}  (mask footprint summed over the strip: ${r.maskSum})`);
  for (const side of ['noband', 'band']) {
    const s = r[side];
    console.log(`  ${side.padEnd(7)} max ${String(s.max).padStart(6)} % at step ${String(s.atStep).padStart(2)}   median of the others ${String(s.medianOfOthers).padStart(6)} %   SPIKE RATIO ${s.spikeRatio}`);
  }
  console.log(`  noband series: ${r.noband.series.join(' ')}`);
  console.log(`  band   series: ${r.band.series.join(' ')}\n`);
}
fs.writeFileSync(path.join(bandDir, 'spikeratio.json'), JSON.stringify(out, null, 1));
console.log(`→ ${path.join(bandDir, 'spikeratio.json')}`);
