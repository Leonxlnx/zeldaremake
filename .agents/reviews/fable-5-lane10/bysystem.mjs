import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const dist = process.argv[2];
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { width: 640, height: 360, quality: 'high', log: () => {} });
  const r = await page.evaluate(async () => { window.__ZR__.setViewpoint('A_stairs'); await window.__ZR__.render(2, 1 / 30); const a = window.__ZR__.audit(); return { bySystem: a.scene.bySystem, total: a.scene.triangles, veg: a.systems.vegetation, stats: window.__ZR__.stats() }; });
  console.log(JSON.stringify(r));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
