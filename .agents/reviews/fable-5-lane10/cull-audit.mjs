// composer shadow-cull counts + kid casting at play poses, read after DRAWN frames (step(1, dt, true)): node cull-audit.mjs <dist>
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
  for (const [label, x, z, yaw] of [['bridge-north', 3.72, 29.6, 2], ['farbank-lookback', 4.06, 42.8, 182], ['log-deadend-lookback', 4.35, 51.8, 182]]) {
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [x, z, (yaw * Math.PI) / 180]);
    await page.evaluate((dt) => window.__ZR_PLAY__.step(60, dt, false), DT);
    for (let k = 0; k < 2; k++) await page.evaluate((dt) => window.__ZR_PLAY__.step(1, dt, true), DT);
    const r = await page.evaluate(() => { const a = window.__ZR__.audit(); const sys = a.systems; const pf = (sys.atmosphere && sys.atmosphere.postfx) ?? {}; const ch = sys.character ?? {}; const st = sys.structures ?? {}; const keys = Object.keys(sys); return { stats: window.__ZR__.stats(), cull: { tested: pf.shadowCastersTested, culled: pf.shadowCastersCulled, small: pf.shadowCastersCulledSmall }, kids: { casting: ch.kidShadowCasting, shadowMeshes: ch.kidShadowMeshes, rigMeshes: ch.rigMeshes }, farBank: st.farBank ?? st.farBankZone ?? Object.fromEntries(Object.entries(st).filter(([k]) => /farBank|zone|caster|tuft|pod/i.test(k)).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v).slice(0, 160) : v])), keys }; });
    console.log(label, JSON.stringify(r).slice(0, 1400));
  }
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
