// Does the near-canopy pool stall a WALKING camera on the small memory tier? The walking path is the
// non-reset one (chunked prefetch through work(budgetMs)), which only happens in play mode: setPose
// and place() are explicit re-poses and take the capture contract's synchronous path instead.
import fs from 'node:fs';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const DT = 1 / 30;
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
  // play mode installs its hook only when the page does not look automated (pool-check.mjs does the
  // same): the game treats a webdriver page as a headless capture, which is why my first probe idled
  await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
  const extra = process.env.ZR_URL_EXTRA ? `&${process.env.ZR_URL_EXTRA}` : '';
  const log = (...m) => console.error(`[walkpool ${new Date().toISOString().slice(11, 19)}]`, ...m);
  page.on('pageerror', (e) => log('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('page:error', m.text().slice(0, 200)); });
  log('goto');
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high${extra}`, { waitUntil: 'load', timeout: 300000 });
  log('loaded; waiting for __ZR__');
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 300000, polling: 250 });
  log('__ZR__ present; calling ready()');
  await page.evaluate(() => { window.__s = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__s = 'ready'), (e) => (window.__s = 'err ' + e)); });
  await page.waitForFunction(() => window.__s !== 'pending', { timeout: 600000, polling: 1000 });
  log('ready state:', await page.evaluate(() => window.__s));
  log('waiting for __ZR_PLAY__');
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 120000, polling: 500 });
  log('__ZR_PLAY__ present; keys:', (await page.evaluate(() => Object.keys(window.__ZR_PLAY__))).join(','));
  const pool = () =>
    page.evaluate(() => {
      const t = window.__ZR__.audit().systems.trees;
      const p = t.nearCanopy?.pool ?? {};
      const st = window.__ZR_PLAY__.state();
      return {
        at: [Math.round((st.position?.[0] ?? st.x ?? 0) * 10) / 10, Math.round((st.position?.[2] ?? st.z ?? 0) * 10) / 10],
        syncBuilds: p.syncBuilds, built: p.built, evicted: p.evicted, pending: p.pending, resident: p.resident,
        pinned: p.pinned, pinnedPending: p.pinnedPending, poolMiB: Math.round((p.poolBytes ?? 0) / 1048576),
        workMsP95: p.workMsP95, workOverBudget: p.workOverBudget, longSteps: p.longSteps,
        shown: t.nearCanopy?.slotsInFrame?.shown ?? null,
      };
    });
  // start in the plaza, facing the north path, then walk 600 sim frames (20 s) holding forward
  await page.evaluate(() => window.__ZR_PLAY__.place(0.5, 2.0, Math.PI));
  await page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, false), [30, DT]);
  const rows = [{ frames: 0, ...(await pool()) }];
  await page.keyboard.down('KeyW');
  for (let f = 0; f < 600; f += 60) {
    await page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, false), [60, DT]);
    rows.push({ frames: f + 60, ...(await pool()) });
    console.error(JSON.stringify(rows.at(-1)));
  }
  await page.keyboard.up('KeyW');
  fs.writeFileSync('/tmp/walkpool.json', JSON.stringify(rows, null, 1));
} finally { await browser.close(); await server.close(); }
