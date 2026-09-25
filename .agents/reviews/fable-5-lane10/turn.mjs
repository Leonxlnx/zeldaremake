// curving walks with per-frame camera: node turn.mjs <dist> <out.json> "label:x,z,yawDeg,frames,keys" ... (keys e.g. WA / WD held together; the camera yaw = atan2 of Link − camera)
import fs from 'node:fs';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out, ...segs] = process.argv.slice(2); const DT = 1 / 30;
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 1280, height: 720 }); const t0 = Date.now();
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  console.error(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
  const result = [];
  for (const spec of segs) {
    const [label, rest] = spec.split(':'); const [x, z, yawDeg, frames] = rest.split(',').map(Number);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [x, z, (yawDeg * Math.PI) / 180]);
    await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
    const keys = (spec.split(':')[1].split(',')[4] || 'W').split('').map((k) => 'Key' + k); for (const k of keys) await page.keyboard.down(k);
    const rows = await page.evaluate(([n, dt]) => {
      const P = window.__ZR_PLAY__; const o = [];
      for (let i = 0; i < n; i++) {
        P.step(1, dt, false); const s = P.state();
        o.push({ i, link: s.link.map((v) => +v.toFixed(3)), cam: s.camera.position.map((v) => +v.toFixed(3)), camGround: s.groundUnderCamera, feet: (s.feet ?? []).map((f) => ({ stance: f.stance, gapM: f.gapM, minShoeGapM: f.minShoeGapM })) });
      }
      return o;
    }, [frames, DT]);
    for (const k of keys) await page.keyboard.up(k);
    let worst = null;
    for (const r of rows) for (const f of r.feet) if (f.stance && (worst === null || f.minShoeGapM > worst.v)) worst = { v: f.minShoeGapM, at: r.link, i: r.i };
    const camJumps = rows.slice(1).map((r, i) => ({ d: Math.hypot(...r.cam.map((v, k) => v - rows[i].cam[k])), at: r.link, i: r.i })).sort((a, b) => b.d - a.d)[0];
    console.error(`${label}: ${rows.length} frames, link ${rows[0].link} → ${rows.at(-1).link}; worst floating boot ${worst ? `${(worst.v * 100).toFixed(1)} cm at ${worst.at} (frame ${worst.i})` : 'n/a'}; max cam step ${camJumps.d.toFixed(2)} m at ${camJumps.at}`);
    result.push({ label, rows });
  }
  fs.writeFileSync(out, JSON.stringify(result));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
