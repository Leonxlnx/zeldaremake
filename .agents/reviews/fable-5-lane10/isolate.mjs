// play-mode per-system frame attribution via __ZR__.isolate: node isolate.mjs <dist> <out.json> "label:x,z,yawDeg[,pitchDeg]" ... (each system rendered alone with the play camera; the sums match the frame to within the post-fx passes)
import fs from 'node:fs';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out, ...spots] = process.argv.slice(2); const DT = 1 / 30;
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 1280, height: 720 }); const t0 = Date.now();
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  console.error(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
  const res = {};
  for (const spec of spots) {
    const [label, rest] = spec.split(':'); const [x, z, yawDeg, pitchDeg] = rest.split(',').map(Number);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [x, z, (yawDeg * Math.PI) / 180]);
    await page.evaluate((dt) => window.__ZR_PLAY__.step(60, dt, false), DT);
    if (Number.isFinite(pitchDeg)) await page.evaluate(([yaw, pitch, dt]) => { window.__ZR_PLAY__.setView(yaw, pitch); window.__ZR_PLAY__.step(30, dt, false); }, [(yawDeg * Math.PI) / 180, (pitchDeg * Math.PI) / 180, DT]);
    res[label] = await page.evaluate(() => {
      const Z = window.__ZR__; const names = Object.keys(Z.audit().scene.bySystem);
      const whole = Z.isolate('__none__'); // nothing kept but lighting → the baseline cost of an empty frame
      const rows = names.map((n) => ({ ...Z.isolate(n) })).sort((a, b) => b.drawCalls - a.drawCalls);
      return { link: window.__ZR_PLAY__.state().link, stats: Z.stats(), empty: whole, rows };
    });
    const r = res[label]; const sum = r.rows.reduce((a, b) => a + b.drawCalls, 0), sumT = r.rows.reduce((a, b) => a + b.triangles, 0);
    console.error(`${label}: frame stats ${r.stats.drawCalls} draws / ${(r.stats.triangles / 1e6).toFixed(2)} M; isolate sum ${sum} draws / ${(sumT / 1e6).toFixed(2)} M (empty ${r.empty.drawCalls} / ${r.empty.triangles})`);
    for (const row of r.rows) if (row.drawCalls) console.error(`   ${row.system.padEnd(14)} ${String(row.drawCalls).padStart(4)} draws  ${(row.triangles / 1e6).toFixed(2).padStart(6)} M`);
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
