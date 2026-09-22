// fable-5: is the 1.5 GB JS heap at ready live or uncollected garbage? ready → read → forced GC (CDP
// HeapProfiler.collectGarbage) → read again; then the typed-array share of the heap via a sampling of
// Runtime.getHeapUsage (totals only) — the split live/garbage is what we want. usage: node memread-gc.mjs <dist>
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';
const dist = process.argv[2];
const log = (s) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 1280, height: 720 });
try {
  const { page } = await openWorld(browser, server.url, { width: 1280, height: 720, quality: 'high', log });
  const cdp = await page.createCDPSession();
  const read = async (label) => {
    const m = await page.evaluate(() => ({ used: performance.memory.usedJSHeapSize / 2 ** 20, total: performance.memory.totalJSHeapSize / 2 ** 20 }));
    const u = await cdp.send('Runtime.getHeapUsage');
    log(`${label}: performance.memory used ${m.used.toFixed(0)} / total ${m.total.toFixed(0)} MB; Runtime.getHeapUsage used ${(u.usedSize / 2 ** 20).toFixed(0)} / total ${(u.totalSize / 2 ** 20).toFixed(0)} MB${u.embedderHeapUsedSize != null ? `; embedder (Blink) ${(u.embedderHeapUsedSize / 2 ** 20).toFixed(0)} MB` : ''}${u.backingStorageSize != null ? `; backing stores (ArrayBuffers) ${(u.backingStorageSize / 2 ** 20).toFixed(0)} MB` : ''}`);
  };
  await read('ready');
  await cdp.send('HeapProfiler.collectGarbage');
  await new Promise((r) => setTimeout(r, 2000));
  await read('after forced GC');
  // one frame, then GC again — anything the first render allocates and drops
  await page.evaluate(() => window.__ZR__.render(1, 1 / 60));
  await cdp.send('HeapProfiler.collectGarbage');
  await new Promise((r) => setTimeout(r, 2000));
  await read('after 1 frame + GC');
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
