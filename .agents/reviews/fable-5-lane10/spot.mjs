// play-mode screenshots at given spots: node spot.mjs <dist> <outdir> "label:x,z,yawDeg[,pitchDeg]" ... (pitch via the follow camera's setView; +60 up / −35 down are its limits)
import fs from 'node:fs'; import path from 'node:path';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out, ...spots] = process.argv.slice(2); const DT = 1 / 30; fs.mkdirSync(out, { recursive: true });
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 1280, height: 720 }); const t0 = Date.now();
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=${process.env.WARMUP ?? '0'}&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  console.error(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
  const meta = [];
  for (const spec of spots) {
    const [label, rest] = spec.split(':'); const [x, z, yawDeg, pitchDeg] = rest.split(',').map(Number);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [x, z, (yawDeg * Math.PI) / 180]);
    await page.evaluate((dt) => window.__ZR_PLAY__.step(60, dt, false), DT);
    if (Number.isFinite(pitchDeg)) { await page.evaluate(([yaw, pitch, dt]) => { window.__ZR_PLAY__.setView(yaw, pitch); window.__ZR_PLAY__.step(30, dt, false); }, [(yawDeg * Math.PI) / 180, (pitchDeg * Math.PI) / 180, DT]); }
    for (let k = 0; k < 2; k++) await page.evaluate((dt) => window.__ZR_PLAY__.step(1, dt, true), DT);
    const st = await page.evaluate(() => window.__ZR_PLAY__.state());
    const p = await page.evaluate(() => { const st = window.__ZR__.stats ? window.__ZR__.stats() : {}; const pf = window.__ZR__.perf ? window.__ZR__.perf() : {}; return { drawCalls: st.drawCalls, triangles: st.triangles, programs: st.programs, ...pf }; });
    const canvas = await page.$('canvas'); let buf = await canvas.screenshot({ type: 'png' });
    for (let retry = 0; retry < 3; retry++) {
      const sample = await page.evaluate(() => { const c = document.querySelector('canvas'); const g = c.getContext('webgl2'); const px = new Uint8Array(4); const o = []; for (let i = 0; i < 16; i++) { g.readPixels(Math.floor((i % 4 + 0.5) * c.width / 4), Math.floor((Math.floor(i / 4) + 0.5) * c.height / 4), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); o.push(px[0] + px[1] + px[2]); } return o; });
      if (Math.max(...sample) - Math.min(...sample) > 24) break;
      console.error(`${label}: uniform frame — re-drawing`); await page.evaluate((dt) => window.__ZR_PLAY__.step(1, dt, true), DT); buf = await canvas.screenshot({ type: 'png' });
    }
    fs.writeFileSync(path.join(out, `${label}.png`), buf);
    const row = { label, link: st.link, camera: st.camera.position, dir: st.camera.direction, ground: st.ground ?? null, draws: p.drawCalls ?? p.draws ?? null, triangles: p.triangles ?? null, programs: p.programs ?? null, perf: st.perf };
    meta.push(row); console.error(`${label}: link ${st.link.map((v) => v.toFixed(2))} cam ${st.camera.position.map((v) => v.toFixed(2))} draws ${row.draws} tris ${row.triangles} update ${st.perf?.update} render ${st.perf?.render}`);
  }
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
