// fable-5 memory read: the capture's own launch path (browser.mjs), one page, A → F in the capture's order,
// the capture's per-view loop (setViewpoint, setTime 12.5, render in chunks of 5), then per view:
// performance.memory, __ZR__.stats() (geometries / textures / programs), and the Chrome processes' RSS
// (browser / renderer / gpu-process) from ps. usage: node memread.mjs <dist> [settleFrames]
import { execFileSync } from 'node:child_process';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const dist = process.argv[2];
const settle = Number(process.argv[3] ?? 45);
const HERO = ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy'];
const log = (s) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

function chromeRss(rootPid) {
  // every process under the browser pid, with its --type
  const out = execFileSync('ps', ['-eo', 'pid,ppid,rss,args']).toString().trim().split('\n').slice(1);
  const rows = out.map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/); return m && { pid: +m[1], ppid: +m[2], rssMB: +m[3] / 1024, args: m[4] }; }).filter(Boolean);
  const kids = new Set([rootPid]);
  let grew = true;
  while (grew) { grew = false; for (const r of rows) if (kids.has(r.ppid) && !kids.has(r.pid)) { kids.add(r.pid); grew = true; } }
  const mine = rows.filter((r) => kids.has(r.pid));
  const by = {};
  for (const r of mine) {
    const t = (r.args.match(/--type=([a-z-]+)/) || [, 'browser'])[1];
    by[t] = (by[t] ?? 0) + r.rssMB;
  }
  const total = mine.reduce((n, r) => n + r.rssMB, 0);
  return { total, by };
}

async function read(page, browserPid, label) {
  const mem = await page.evaluate(() => {
    const m = performance.memory;
    return m ? { usedJS: m.usedJSHeapSize / 2 ** 20, totalJS: m.totalJSHeapSize / 2 ** 20 } : null;
  });
  const stats = await page.evaluate(() => window.__ZR__.stats());
  const rss = chromeRss(browserPid);
  const free = execFileSync('free', ['-m']).toString().split('\n')[1].trim().split(/\s+/);
  const row = {
    label,
    jsUsedMB: mem ? +mem.usedJS.toFixed(0) : null,
    jsTotalMB: mem ? +mem.totalJS.toFixed(0) : null,
    geometries: stats.geometries, textures: stats.textures, programs: stats.programs,
    draws: stats.drawCalls, tris: +(stats.triangles / 1e6).toFixed(2),
    rendererMB: +(rss.by.renderer ?? 0).toFixed(0), gpuMB: +(rss.by['gpu-process'] ?? 0).toFixed(0), browserMB: +(rss.by.browser ?? 0).toFixed(0),
    chromeTotalMB: +rss.total.toFixed(0), systemUsedMB: +free[2],
  };
  console.log(JSON.stringify(row));
  log(`${label}: JS ${row.jsUsedMB}/${row.jsTotalMB} MB, renderer ${row.rendererMB} MB, gpu ${row.gpuMB} MB, chrome total ${row.chromeTotalMB} MB, geometries ${row.geometries}, textures ${row.textures}, programs ${row.programs}`);
  return row;
}

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 1280, height: 720 });
const browserPid = browser.process().pid;
try {
  const { page } = await openWorld(browser, server.url, { width: 1280, height: 720, quality: 'high', log });
  await read(page, browserPid, 'ready');
  for (const id of HERO) {
    const ok = await page.evaluate((v) => window.__ZR__.setViewpoint(v), id);
    if (!ok) throw new Error(`viewpoint ${id} not found`);
    await page.evaluate((t) => window.__ZR__.setTime(t), 12.5);
    const t0 = Date.now();
    for (let left = settle; left > 0; left -= 5) {
      await page.evaluate((k) => window.__ZR__.render(k, 1 / 60), Math.min(5, left));
    }
    log(`${id}: ${settle} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await read(page, browserPid, id);
  }
  // a second pass over A: does memory keep growing when views repeat (a leak) or plateau (residency)?
  await page.evaluate((v) => window.__ZR__.setViewpoint(v), 'A_stairs');
  for (let left = settle; left > 0; left -= 5) await page.evaluate((k) => window.__ZR__.render(k, 1 / 60), Math.min(5, left));
  await read(page, browserPid, 'A_stairs (second pass)');
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
