// The cast at the follow camera's distance in PLAY mode — usage: node it87-people-play.mjs <dist> <outdir> [distM=5.5]
// Opens ?test=1 (the play-test hook), reads each kid's feet from the character audit, stands Link `distM` from the kid
// on the plaza side facing her, settles the follow camera, and screenshots one drawn frame per kid.
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out, distArg] = process.argv.slice(2);
const DIST = Number(distArg) || 5.5;
const DT = 1 / 30;
fs.mkdirSync(out, { recursive: true });
const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 1280, height: 720 });
const t0 = Date.now();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  console.error(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
  const info = await page.evaluate(() => { const c = window.__ZR__.audit().systems.character; return { kids: c.world?.kids, npcsVisible: c.npcsVisible, npc: c.npc ?? null, npcCount: c.npcCount, npcSitting: c.npcSitting }; });
  console.error('kids (feet):', JSON.stringify(info.kids), 'visible', info.npcsVisible, 'sitting', JSON.stringify(info.npcSitting));
  const names = ['kokiri-a-walker', 'kokiri-b-sitter', 'kokiri-c-door', 'kokiri-ledge', 'kokiri-south-bank'];
  const meta = { dist, distM: DIST, kids: [] };
  for (let i = 0; i < (info.kids?.length ?? 0); i++) {
    const shot = async (label) => {
      const k = (await page.evaluate(() => window.__ZR__.audit().systems.character.world.kids))[i];
      // stand Link DIST metres from the kid, on the side toward the plaza centre (or +z if she is at the centre)
      let dx = 0 - k[0], dz = 0 - k[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (l < 1) { dx = 0; dz = 1; }
      const lx = k[0] + dx * DIST, lz = k[2] + dz * DIST;
      const yaw = Math.atan2(k[0] - lx, k[2] - lz);
      await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [lx, lz, yaw]);
      await page.evaluate((dt) => window.__ZR_PLAY__.step(45, dt, false), DT);
      const k2 = (await page.evaluate(() => window.__ZR__.audit().systems.character.world.kids))[i];
      if (Math.hypot(k2[0] - k[0], k2[2] - k[2]) > 0.8) {
        // she walked on: re-place toward her new spot and let the camera settle a little
        const yaw2 = Math.atan2(k2[0] - lx, k2[2] - lz);
        await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [lx, lz, yaw2]);
        await page.evaluate((dt) => window.__ZR_PLAY__.step(20, dt, false), DT);
      }
      await page.evaluate((dt) => window.__ZR_PLAY__.step(1, dt, true), DT);
      const st = await page.evaluate(() => window.__ZR_PLAY__.state());
      const canvas = await page.$('canvas');
      const file = path.join(out, `${label}.png`);
      await canvas.screenshot({ path: file, type: 'png' });
      const k3 = (await page.evaluate(() => window.__ZR__.audit().systems.character.world.kids))[i];
      meta.kids.push({ label, kid: k3, link: st.link, camera: st.camera.position, distM: Math.hypot(k3[0] - st.link[0], k3[2] - st.link[2]) });
      console.error(`${label}: kid ${k3.map((v) => v.toFixed(2))} link ${st.link.map((v) => v.toFixed(2))} cam ${st.camera.position.map((v) => v.toFixed(2))} — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    };
    await shot(names[i] ?? `kid-${i}`);
  }
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
