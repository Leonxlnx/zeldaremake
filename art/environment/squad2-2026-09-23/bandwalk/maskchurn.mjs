#!/usr/bin/env node
/**
 * maskchurn.mjs — the crawl test, aimed at the pixels the mask actually touches.
 *
 *   node art/environment/squad2-2026-09-23/bandwalk/maskchurn.mjs \
 *        --band /tmp/walk-band --noband /tmp/walk-noband [--steps 9] [--size 960x540] [--grid 8] [--top 4]
 *
 * `walkstrip.mjs`'s own "worst grid cell" is the wrong target and its first run proved it: walking 0.5 m
 * changes 91–95 % of the pixels in the bottom row of cells, because that row is ground and grass one to
 * three metres away. The rung band cannot touch any of it, so the metric locked onto foreground parallax
 * and reported the two builds as identical to two decimals — true, and about nothing.
 *
 * This asks the question the other way round. At each step the two builds stand at the SAME camera
 * position, so the difference between them is the mask and nothing else: that difference locates the cells
 * the band is working in. Then, in those cells only, compare how much each build changes from the previous
 * step. Parallax is common to both, so if the screen-space stipple crawls — the tree sliding across a
 * stationary hash — the banded build must churn measurably more there than the unbanded one.
 *
 * Prints, per step: the cells the mask touches with its footprint, and the frame-to-frame changed share
 * inside them for each build. A crawl is a banded column consistently and substantially above the other.
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
const top = Number(flag('top', 4));
const steps = Number(flag('steps', 9));
const cellW = Math.floor(W / grid);
const cellH = Math.floor(H / grid);

const file = (dir, k) => path.join(dir, `step-${String(k).padStart(2, '0')}.png`);
const load = async (dir, k) => (fs.existsSync(file(dir, k)) ? toRgb(file(dir, k), W, H) : null);

/** changed share of one grid cell between two rgb buffers, at the 8-level tolerance used throughout */
const cellChanged = (a, b, cx, cy) => {
  let changed = 0;
  let n = 0;
  let sum = 0;
  for (let y = cy * cellH; y < (cy + 1) * cellH; y++) {
    for (let x = cx * cellW; x < (cx + 1) * cellW; x++) {
      const i = (y * W + x) * 3;
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (d > 8) {
        changed++;
        sum += d;
      }
      n++;
    }
  }
  return { pct: (changed / n) * 100, meanDelta: changed ? sum / changed : 0 };
};

const rows = [];
for (let k = 0; k < steps; k++) {
  const [b, nb] = [await load(bandDir, k), await load(nobandDir, k)];
  if (!b || !nb) break;
  // where the mask acts at this step: the two builds differ only by the band
  const acts = [];
  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      const c = cellChanged(b, nb, cx, cy);
      if (c.pct > 0) acts.push({ cx, cy, ...c });
    }
  }
  acts.sort((p, q) => q.pct - p.pct);
  const picked = acts.slice(0, top);
  const row = { step: k, maskCells: picked.map((c) => `${c.cx},${c.cy}`), maskPct: picked.map((c) => Number(c.pct.toFixed(2))) };
  if (k > 0) {
    const [bPrev, nbPrev] = [await load(bandDir, k - 1), await load(nobandDir, k - 1)];
    // churn inside the SAME cells, per build: parallax is common, the mask is not
    const churn = (cur, prev) => picked.map((c) => Number(cellChanged(prev, cur, c.cx, c.cy).pct.toFixed(2)));
    row.churnBand = churn(b, bPrev);
    row.churnNoBand = churn(nb, nbPrev);
    row.churnBandMean = Number((row.churnBand.reduce((a, v) => a + v, 0) / row.churnBand.length).toFixed(2));
    row.churnNoBandMean = Number((row.churnNoBand.reduce((a, v) => a + v, 0) / row.churnNoBand.length).toFixed(2));
  }
  rows.push(row);
}

console.log(`the cells the band works in, and the frame-to-frame churn inside them (${grid}x${grid} grid, top ${top})\n`);
console.log('step  mask cells (footprint %)                      churn band      churn no band   band − no band');
for (const r of rows) {
  const cells = r.maskCells.map((c, i) => `${c} (${r.maskPct[i]})`).join('  ');
  if (r.step === 0) {
    console.log(`${String(r.step).padStart(4)}  ${cells}`);
    continue;
  }
  const d = (r.churnBandMean - r.churnNoBandMean).toFixed(2);
  console.log(`${String(r.step).padStart(4)}  ${cells.padEnd(46)}  ${String(r.churnBandMean).padStart(6)} %  ${String(r.churnNoBandMean).padStart(13)} %  ${String(d).padStart(8)}`);
}
fs.writeFileSync(path.join(bandDir, 'maskchurn.json'), JSON.stringify(rows, null, 1));
console.log(`\n→ ${path.join(bandDir, 'maskchurn.json')}`);
