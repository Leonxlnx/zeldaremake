// squad2: "make all the trees load in ASAP so it doesn't look bad" (the owner's standing priority),
// measured in pixels instead of pool counts. `pool-check.mjs` prints wanted / resident / pending
// parts; this prints what ARRIVES LATE on the screen.
//
//   node art/environment/squad2-2026-09-23/walkpop.mjs <dist> <outDir> [poses]
//
// Per pose: the camera cuts to it and `ARRIVE_FRAMES` are drawn (what someone who just got there
// sees), the frame is saved; then `SETTLE_FRAMES` more are drawn standing still and a second frame
// is saved. The difference is the geometry the pools brought in late. A cut is harsher than a walk —
// walking in gives the pools the whole approach — so this is an upper bound on what a walker meets.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', outDir = '/tmp/walkpop', only] = process.argv.slice(2);
const W = 960, H = 540, DT = 1 / 30;
const ARRIVE_FRAMES = 1; // what someone who just arrived sees
const SETTLE_FRAMES = 12; // standing still afterwards (every frame is a SwiftShader draw here)
const log = (...m) => console.error(`[walkpop ${new Date().toISOString().slice(11, 19)}]`, ...m);
fs.mkdirSync(outDir, { recursive: true });

/** the poses: a walker's eye at points along the owner's north walk, looking the way he walks */
const POSES = [
  { id: 'north-path', p: [2.0, 1.6, -12.0], t: [2.4, 2.0, -26.0] },
  { id: 'arch-approach', p: [2.2, 1.6, -30.0], t: [2.6, 2.4, -44.0] },
  { id: 'clearing', p: [4.4, 4.0, -52.0], t: [3.0, 4.6, -66.0] },
].filter((s) => !only || only.split(',').includes(s.id));

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H, log });
  const canvas = await page.$('canvas');
  // dt = 0: the world updates (the LOD pools follow the camera) while the wind, the god rays and the
  // grass do not advance, so a difference between two frames is geometry arriving, not animation
  const render = (n) => page.evaluate(async (k) => await window.__ZR__.render(k, 0), n);
  // there is no draw-free step on the capture API, so a settle costs full frames — keep it short
  const advance = (n) => render(n);
  const stats = () => page.evaluate(() => window.__ZR__.stats());

  for (const pose of POSES) {
    log(`pose ${pose.id}`);
    await page.evaluate((q) => {
      window.__ZR__.setTime(12.5);
      window.__ZR__.setPose(q.p, q.t, 50);
    }, pose);
    await render(ARRIVE_FRAMES);
    const arriving = path.join(outDir, `${pose.id}-arriving.png`);
    await canvas.screenshot({ path: arriving });
    const sA = await stats();
    await advance(SETTLE_FRAMES);
    await render(1);
    const settled = path.join(outDir, `${pose.id}-settled.png`);
    await canvas.screenshot({ path: settled });
    const sS = await stats();

    const a = await sharp(arriving).raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(settled).raw().toBuffer({ resolveWithObject: true });
    const ch = a.info.channels, n = a.info.width * a.info.height;
    let moved = 0, big = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const o = i * ch;
      const d = Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2]));
      if (d > 8) moved++;
      if (d > 40) big++;
      sum += d;
    }
    const row = {
      id: pose.id,
      lateSharePct: +((100 * moved) / n).toFixed(3),
      strongSharePct: +((100 * big) / n).toFixed(3),
      meanAbs: +(sum / n).toFixed(3),
      arrivingDraws: sA.drawCalls,
      settledDraws: sS.drawCalls,
      arrivingTriangles: sA.triangles,
      settledTriangles: sS.triangles,
    };
    rows.push(row);
    log(`  late ${row.lateSharePct} % of pixels (strong ${row.strongSharePct} %), draws ${row.arrivingDraws} → ${row.settledDraws}, triangles ${(row.arrivingTriangles / 1e6).toFixed(2)} → ${(row.settledTriangles / 1e6).toFixed(2)} M`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, 'walkpop.json'), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${r.id.padEnd(15)} late ${String(r.lateSharePct).padStart(7)} %  strong ${String(r.strongSharePct).padStart(6)} %  draws ${r.arrivingDraws} → ${r.settledDraws}  triangles ${(r.arrivingTriangles / 1e6).toFixed(2)} → ${(r.settledTriangles / 1e6).toFixed(2)} M`);
