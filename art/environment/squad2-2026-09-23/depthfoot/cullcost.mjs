// CPU cost of the trees' per-frame update while the camera moves (so `cull()` runs every frame).
// Small viewport on purpose: the cull's work is resolution-independent, the rasteriser's is not.
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out] = process.argv.slice(2);
const W = 320, H = 180, FRAMES = 70;
const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H, log: () => {} });
  const res = await page.evaluate(async (frames) => {
    const z = window.__ZR__;
    z.setTime(12.5);
    const p = [2.648, 1.85, 3.529];
    const samples = [];
    const still = [];
    // warm: the pools swap in at this spot before any timing is taken
    z.setPose(p, [6.038, 1.6, 0.884], 46);
    await z.render(10, 1 / 30);
    // a) camera still: cull() early-returns on an unchanged view-projection
    for (let i = 0; i < frames / 2; i++) {
      await z.render(1, 1 / 60);
      still.push(z.perf().systems.trees);
    }
    // b) camera turning 0.4 deg a frame: cull() runs every frame
    for (let i = 0; i < frames; i++) {
      const a = 0.007 * i;
      z.setPose(p, [p[0] + Math.cos(a) * 4 - 0.5, 1.6, p[2] + Math.sin(a) * 4 - 3], 46);
      await z.render(1, 1 / 60);
      samples.push(z.perf().systems.trees);
    }
    const stat = (xs) => {
      const s = [...xs].filter((v) => typeof v === 'number').sort((a, b) => a - b);
      return s.length ? { n: s.length, p50: s[Math.floor(s.length * 0.5)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], mean: s.reduce((a, b) => a + b, 0) / s.length } : null;
    };
    return { still: stat(still), moving: stat(samples), keys: Object.keys(z.perf().systems ?? {}) };
  }, FRAMES);
  console.log(JSON.stringify(res, null, 1));
} finally { await browser.close(); await server.close(); }
