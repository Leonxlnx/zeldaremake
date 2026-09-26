// one play frame of the veranda boy: Link 2.4 m in front of him on the deck, 0.7 m off his axis, facing back
import path from 'node:path';
import { launchBrowser, serveStatic } from '../../../../gauntlet/scripts/lib/browser.mjs';
const [dist, out] = process.argv.slice(2);
const server = await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width: 1280, height: 720 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 600000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = 'error: ' + e)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 600000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 600000, polling: 500 });
  // the boy at (9.68, -91.7) looks at (2.6, -101.5)
  await page.evaluate(() => { const yaw = Math.atan2(2.6 - 9.68, -101.5 + 91.7); const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); const d = 2.4, side = 0.7; window.__ZR_PLAY__.place(9.68 + fx * d + rx * side, -91.7 + fz * d + rz * side, Math.atan2(-fx, -fz)); });
  await page.evaluate(() => window.__ZR_PLAY__.step(45, 1 / 60, false));
  const st = await page.evaluate(() => { window.__ZR_PLAY__.step(1, 1 / 60, true); return window.__ZR_PLAY__.state(); });
  await page.screenshot({ path: out });
  console.log('link', st.link.map((v) => v.toFixed(2)).join(','), 'cam', st.camera.position.map((v) => v.toFixed(2)).join(','), 'draws', st.render.calls);
} finally { await browser.close(); await server.close(); }
