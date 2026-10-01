#!/usr/bin/env node
/**
 * walkstrip.mjs — `dither/PROPOSAL.md` check 2 with the camera actually moving, which is the half
 * `gatesweep/` §2 could not answer.
 *
 *   node art/environment/squad2-2026-09-23/bandwalk/walkstrip.mjs <dist> <out> \
 *        --pose art/.../owner-0650-poses.json --poseName owner-0650-north \
 *        [--steps 8] [--stride 0.5] [--size 960x540] [--settle 8] [--quality high] [--grid 8]
 *
 * `gatesweep.mjs` moved the gate past a standing camera, which isolates the rung swap from parallax but
 * cannot see a crawl: the mask is a `gl_FragCoord` hash, fixed in screen space, so what makes it crawl is
 * the TREE sliding across a stationary noise field. That needs the camera to move.
 *
 * The strip is a PURE TRANSLATION — position and target advance by the same vector — so the view
 * direction never rotates and the only thing happening is approach. The clock is frozen for every read
 * (frozen.mjs's protocol: with time running, wind moves 13–31 % of the frame between steps and swamps
 * everything else).
 *
 * The measurement is comparative, and it has to be, because a walking camera changes the frame by far
 * more than any dither: run the identical strip on a build with the band and one without, and read the
 * FRAME-TO-FRAME churn each one produces. Parallax is common to both; the difference between them is the
 * mask. A crawling stipple raises the churn inside the crown it covers on every step of the crossing, so
 * the number to watch is the worst grid cell per step, not the whole frame.
 *
 * Output: one PNG per step and `strip.json` with, per step, the draws/triangles/md5, the whole-frame
 * changed share and mean delta against the previous step, and the `grid`×`grid` cell with the largest
 * changed share (its index, share and mean delta). Also the Laplacian variance of that worst cell, since
 * a visible checker is high-frequency energy and a crawling one carries it in every frame.
 *
 * WHAT THIS SCRIPT'S OWN NUMBERS ARE NOT FOR, because its first run proved it (README §2): the worst cell
 * of a walked strip is always FOREGROUND. Half a metre of walking changes 91–95 % of the pixels in the
 * bottom row of cells — ground and grass one to three metres away — which no rung band can touch, so both
 * builds agree there to two decimals and the reading says nothing about the effect. Use `maskchurn.mjs`,
 * which finds the cells the two builds differ in first and measures churn only there. This script's job
 * is to render the strip and to price it.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';
import { toGray, toRgb, ssim, laplacianVariance } from '../../../../gauntlet/scripts/lib/image.mjs';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = positional[0] ?? 'dist';
const out = positional[1] ?? '/tmp/walkstrip';
if (dist.startsWith('--') || out.startsWith('--')) throw new Error(`dist and out are POSITIONAL: got dist=${dist} out=${out}`);
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
const [width, height] = String(flag('size', '960x540')).split('x').map(Number);
const settle = Number(flag('settle', 8));
const quality = flag('quality', 'high');
const steps = Number(flag('steps', 8));
const stride = Number(flag('stride', 0.5));
/** metres (or, with --yaw, steps) to advance before the first frame, so a fine strip can start at the swap */
const from = Number(flag('from', 0));
/** degrees of heading per step; non-zero switches the strip from translating to ROTATING (see poseAt) */
const yawStep = Number(flag('yaw', 0));
const grid = Number(flag('grid', 8));
const poseFile = flag('pose');
const poseName = flag('poseName', null);
if (!poseFile) throw new Error('pass --pose <file> [--poseName <name>]');
const list = JSON.parse(fs.readFileSync(path.resolve(poseFile), 'utf8'));
const entry = poseName ? list.find((p) => p.name === poseName) : list[0];
if (!entry) throw new Error(`pose ${poseName} not in ${poseFile}`);
const base = entry.from ?? entry;
fs.mkdirSync(out, { recursive: true });

/** the view direction and its length, so the walk approaches whatever the pose was aimed at */
const aim = [base.t[0] - base.p[0], base.t[1] - base.p[1], base.t[2] - base.p[2]];
const aimLen = Math.hypot(...aim);
const dir = aim.map((v) => v / aimLen);
/**
 * ROTATION mode (`--yaw <degrees per step>`): the camera stands still and only its heading changes, which
 * is the harshest case for a screen-space mask and the one a translating strip cannot reach. A pure
 * rotation changes no tree's DISTANCE, so nothing enters or leaves a band: every banded tree keeps the
 * same drop value while its screen position sweeps across a hash that is fixed to the screen. If the
 * stipple swims, that is where it swims.
 *
 * 0.5° a step is a slow, deliberate look — about 15°/s at 30 fps — and slow is the worst case, because a
 * fast turn blurs the pattern away. At 46° fov across 960 px it slides a tree ≈ 10 px a frame, which
 * re-randomises which of its fragments the mask keeps.
 */
const poseAt = (k) => {
  if (yawStep) {
    const a = (yawStep * (from + k) * Math.PI) / 180;
    const [dx, , dz] = dir;
    const rx = dx * Math.cos(a) - dz * Math.sin(a);
    const rz = dx * Math.sin(a) + dz * Math.cos(a);
    return { p: [...base.p], t: [base.p[0] + rx * aimLen, base.p[1] + dir[1] * aimLen, base.p[2] + rz * aimLen], fov: base.fov ?? 46 };
  }
  return {
    p: base.p.map((v, i) => v + dir[i] * (from + stride * k)),
    t: base.t.map((v, i) => v + dir[i] * (from + stride * k)),
    fov: base.fov ?? 46,
  };
};

const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width, height, quality, log: () => {} });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  await page.evaluate((f) => window.__ZR__.setPose(f.p, f.t, f.fov), poseAt(0));
  // settle WITH time once so the near-canopy pool is resident; the strip itself never advances it
  await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), settle);
  const gates = await page.evaluate(() => window.__ZR__.audit().systems.trees.lodSwapM?.tree ?? null);
  const band = await page.evaluate(() => window.__ZR__.audit().systems.trees.lodBand ?? null);
  console.error(`gates ${JSON.stringify(gates)} band ${JSON.stringify(band)}`);
  for (let k = 0; k < steps; k++) {
    const pose = poseAt(k);
    const stats = await page.evaluate(async (f) => {
      window.__ZR__.setPose(f.p, f.t, f.fov);
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      const t = window.__ZR__.audit().systems.trees;
      return { draws: s.drawCalls, triangles: s.triangles, treeDraws: t.submission?.drawCalls ?? null };
    }, pose);
    const png = await page.screenshot({ type: 'png' });
    const file = path.join(out, `step-${String(k).padStart(2, '0')}.png`);
    fs.writeFileSync(file, png);
    const advanced = yawStep ? Number((yawStep * (from + k)).toFixed(3)) : Number((from + stride * k).toFixed(2));
    rows.push({ step: k, advanced, unit: yawStep ? 'deg' : 'm', ...stats, file, md5: crypto.createHash('md5').update(png).digest('hex') });
    console.error(`step ${k} (+${advanced}${yawStep ? '°' : ' m'}) ${stats.draws}/${stats.triangles}`);
  }
} finally {
  await browser.close();
  await server.close();
}

const cellW = Math.floor(width / grid);
const cellH = Math.floor(height / grid);
/** changed share and mean delta of every grid cell, so the worst one is found rather than guessed */
const cells = (a, b) => {
  const list = [];
  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      let changed = 0;
      let sum = 0;
      let n = 0;
      for (let y = cy * cellH; y < (cy + 1) * cellH; y++) {
        for (let x = cx * cellW; x < (cx + 1) * cellW; x++) {
          const i = (y * width + x) * 3;
          const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
          if (d > 8) {
            changed++;
            sum += d;
          }
          n++;
        }
      }
      list.push({ cx, cy, changedPct: (changed / n) * 100, meanDelta: changed ? sum / changed : 0 });
    }
  }
  return list;
};

for (let i = 1; i < rows.length; i++) {
  const [a, b] = [rows[i - 1], rows[i]];
  const [ra, rb] = [await toRgb(a.file, width, height), await toRgb(b.file, width, height)];
  const [ga, gb] = [await toGray(a.file, width, height), await toGray(b.file, width, height)];
  const all = cells(ra, rb);
  const worst = all.reduce((m, c) => (c.changedPct > m.changedPct ? c : m), all[0]);
  const box = { left: worst.cx * cellW, top: worst.cy * cellH, width: cellW, height: cellH };
  const { data, info } = await sharp(b.file).extract(box).greyscale().raw().toBuffer({ resolveWithObject: true });
  const cellGray = new Float32Array(data.length);
  for (let j = 0; j < data.length; j++) cellGray[j] = data[j] / 255;
  let changed = 0;
  for (let j = 0; j < ra.length; j += 3) {
    if (Math.max(Math.abs(ra[j] - rb[j]), Math.abs(ra[j + 1] - rb[j + 1]), Math.abs(ra[j + 2] - rb[j + 2])) > 8) changed++;
  }
  rows[i].frameChangedPct = Number(((changed / (width * height)) * 100).toFixed(3));
  rows[i].frameSsim = Number(ssim(ga, gb, width, height).toFixed(5));
  rows[i].worstCell = `${worst.cx},${worst.cy}`;
  rows[i].worstCellChangedPct = Number(worst.changedPct.toFixed(2));
  rows[i].worstCellMeanDelta = Number(worst.meanDelta.toFixed(1));
  rows[i].worstCellEnergy = Number(laplacianVariance(cellGray, info.width, info.height).toFixed(5));
}
fs.writeFileSync(path.join(out, 'strip.json'), JSON.stringify(rows, null, 1));
console.log(
  rows
    .map(
      (r) =>
        `+${String(r.advanced).padStart(4)} m  ${r.draws}/${r.triangles}  frame ${String(r.frameChangedPct ?? '—').padStart(6)} %  ssim ${r.frameSsim ?? '—'}  worst cell ${r.worstCell ?? '—'} ${String(r.worstCellChangedPct ?? '—').padStart(6)} % at Δ ${r.worstCellMeanDelta ?? '—'}  energy ${r.worstCellEnergy ?? '—'}`,
    )
    .join('\n'),
);
