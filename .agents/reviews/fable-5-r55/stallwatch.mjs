// fable-5: tick 226's hypothesis (a late shader compile / program variant when the pools pin a new part
// type, 10–15 min into a view). One view, N frames in chunks of 5 exactly like the capture; after every
// chunk: chunk seconds, __ZR__.stats() programs / geometries / draws / triangles, JS heap, and the Chrome
// processes' RSS. usage: node stallwatch.mjs <dist> <viewpoint> [frames=90]
import { execFileSync } from 'node:child_process';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const [dist, view, framesArg] = process.argv.slice(2);
const frames = Number(framesArg ?? 90);
const log = (s) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

function rss(rootPid) {
  const rows = execFileSync('ps', ['-eo', 'pid,ppid,rss,args']).toString().trim().split('\n').slice(1)
    .map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/); return m && { pid: +m[1], ppid: +m[2], rssMB: +m[3] / 1024, args: m[4] }; }).filter(Boolean);
  const kids = new Set([rootPid]); let grew = true;
  while (grew) { grew = false; for (const r of rows) if (kids.has(r.ppid) && !kids.has(r.pid)) { kids.add(r.pid); grew = true; } }
  const by = {};
  for (const r of rows.filter((r) => kids.has(r.pid))) { const t = (r.args.match(/--type=([a-z-]+)/) || [, 'browser'])[1]; by[t] = (by[t] ?? 0) + r.rssMB; }
  return by;
}

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 1280, height: 720 });
const pid = browser.process().pid;
try {
  const { page } = await openWorld(browser, server.url, { width: 1280, height: 720, quality: 'high', log });
  const ok = await page.evaluate((v) => window.__ZR__.setViewpoint(v), view);
  if (!ok) throw new Error(`viewpoint ${view} not found`);
  await page.evaluate((t) => window.__ZR__.setTime(t), 12.5);
  let done = 0; const t0 = Date.now();
  while (done < frames) {
    const n = Math.min(5, frames - done);
    const tc = Date.now();
    await page.evaluate((k) => window.__ZR__.render(k, 1 / 60), n);
    const chunkS = (Date.now() - tc) / 1000;
    done += n;
    const st = await page.evaluate(() => { const s = window.__ZR__.stats(); const m = performance.memory; return { programs: s.programs, geometries: s.geometries, draws: s.drawCalls, tris: s.triangles, js: m ? m.usedJSHeapSize / 2 ** 20 : null }; });
    const by = rss(pid);
    const row = { view, frames: `${done - n + 1}-${done}`, chunkS: +chunkS.toFixed(1), perFrameS: +(chunkS / n).toFixed(1), elapsedS: Math.round((Date.now() - t0) / 1000), ...st, js: st.js && Math.round(st.js), rendererMB: Math.round(by.renderer ?? 0), gpuMB: Math.round(by['gpu-process'] ?? 0) };
    console.log(JSON.stringify(row));
    log(`${view} frames ${row.frames}: ${row.chunkS} s (${row.perFrameS} s/frame) programs ${row.programs} geometries ${row.geometries} draws ${row.draws} tris ${(row.tris / 1e6).toFixed(2)} M  JS ${row.js} MB  renderer ${row.rendererMB} MB  gpu ${row.gpuMB} MB`);
  }
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
