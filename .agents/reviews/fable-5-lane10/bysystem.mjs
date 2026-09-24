// per-system scene audit at the six views: node it110-bysystem.mjs <dist> <out.json>
import fs from 'node:fs';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out] = process.argv.slice(2);
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { width: 640, height: 360, quality: 'high', log: () => {} });
  const res = {};
  for (const id of ['A_stairs', 'C_lookback', 'E_ground']) {
    res[id] = await page.evaluate(async (id) => { window.__ZR__.setViewpoint(id); await window.__ZR__.render(2, 1 / 30); const a = window.__ZR__.audit(); return { bySystem: a.scene.bySystem, total: a.scene.triangles, veg: a.systems.vegetation, stats: window.__ZR__.stats() }; }, id);
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
