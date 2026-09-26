// the sun's depth pass per system: __ZR__.isolate(system) with shadows on and with ?shadow=0, at fixed poses
// node it135-shadowsplit.mjs <dist> <out.json> <shadowParam: on|0> "A_stairs" "label:px,py,pz,tx,ty,tz" ...
import fs from 'node:fs';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out, shadow, ...poses] = process.argv.slice(2);
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 1280, height: 720 });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const q = shadow === '0' ? '&shadow=0' : '';
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&quality=high${q}`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  const res = {};
  for (const spec of poses) {
    const [label, rest] = spec.split(':');
    if (rest) { const [px, py, pz, tx, ty, tz] = rest.split(',').map(Number); await page.evaluate(([p, t]) => window.__ZR__.setPose(p, t, 50), [[px, py, pz], [tx, ty, tz]]); }
    else await page.evaluate((id) => window.__ZR__.setViewpoint(id), label);
    await page.evaluate(async () => { await window.__ZR__.render(8, 1 / 30); });
    res[label] = await page.evaluate(() => { const Z = window.__ZR__; const st = Z.stats(); const names = Object.keys(Z.audit().scene.bySystem); const rows = names.map((n) => Z.isolate(n)).sort((a, b) => b.drawCalls - a.drawCalls); return { stats: { drawCalls: st.drawCalls, triangles: st.triangles }, rows }; });
    const r = res[label]; console.error(`${label} (shadow ${shadow}): frame ${r.stats.drawCalls} draws / ${(r.stats.triangles / 1e6).toFixed(2)} M; ` + r.rows.filter((x) => x.drawCalls).map((x) => `${x.system} ${x.drawCalls}/${(x.triangles / 1e6).toFixed(2)}M`).join(', '));
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
