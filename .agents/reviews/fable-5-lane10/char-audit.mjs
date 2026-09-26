import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist] = process.argv.slice(2); const DT = 1 / 30;
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 1280, height: 720 });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
  for (const [label, x, z, yaw] of [['farbank-lookback', 4.06, 42.8, 182], ['plaza', 0.5, 3, 10]]) {
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [x, z, (yaw * Math.PI) / 180]);
    await page.evaluate((dt) => window.__ZR_PLAY__.step(60, dt, false), DT);
    const r = await page.evaluate(() => { const a = window.__ZR__.audit().systems.character; const iso = window.__ZR__.isolate('character'); const keep = {}; for (const k of ['npcs', 'npcsVisible', 'rigMeshesBeforeMerge', 'rigMeshes', 'rigMergedMeshes', 'kidShadowCasting', 'kidTerrainSeen', 'kidSightTests', 'fairyTrail', 'triangles', 'linkTriangles']) keep[k] = a[k]; return { iso, keep, keys: Object.keys(a) }; });
    console.log(label, JSON.stringify(r).slice(0, 900));
  }
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
