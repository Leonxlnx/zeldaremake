// Play-mode greeting test: after a skip, Link is placed 3.6 m in front of the wanderer facing her, walks
// up (W) until ~1.4 m, stands 3 s, backs off (S) 1.7 s, stands 2.5 s. Frames every 6th sim frame.
// node /tmp/kg/greet.mjs <dist> <outDir>   env: GREET_SKIP (s, default 18)
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist, out] = process.argv.slice(2);
const W = 1280, H = 720, DT = 1 / 30;
fs.mkdirSync(out, { recursive: true });
const log = (...m) => console.error(`[greet ${new Date().toISOString().slice(11, 19)}]`, ...m);

async function grabHooks(page) {
  const client = await page.createCDPSession();
  try {
    const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
    const objectId = ev.result?.objectId;
    if (!objectId) return false;
    const { internalProperties } = await client.send('Runtime.getProperties', { objectId, ownProperties: true });
    const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]');
    if (!scopes?.value?.objectId) return false;
    const { result: scopeList } = await client.send('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true });
    for (const s of scopeList) {
      if (!s.value?.objectId) continue;
      const { result: vars } = await client.send('Runtime.getProperties', { objectId: s.value.objectId, ownProperties: true });
      for (const v of vars) {
        if (v.value?.type !== 'object' || !v.value.objectId) continue;
        const r = await client.send('Runtime.callFunctionOn', { objectId: v.value.objectId, functionDeclaration: 'function(){ if (this && this.scene && this.scene.isScene && typeof this.step === "function") { window.__H = this; return true; } return false; }', returnByValue: true });
        if (r.result?.value === true) return true;
      }
    }
    return false;
  } finally {
    await client.detach().catch(() => {});
  }
}

const server = await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width: W, height: H });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  const t0 = Date.now();
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: READY_TIMEOUT_MS, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!(await grabHooks(page))) throw new Error('world hooks not found');

  // play mode on, Link parked far from her loop while the clock runs to the skip
  await page.evaluate(() => window.__ZR_PLAY__.place(-6, 8, 0));
  const skip = Math.round(Number(process.env.GREET_SKIP || 18) * 30);
  await page.evaluate((n, dt) => window.__ZR_PLAY__.step(n, dt, false), skip, DT);
  const KID = Number(process.env.GREET_KID || 0);
  const kid = () => page.evaluate((k) => { const g = window.__H.scene.getObjectByName('background-characters').children[2 * k]; const w = g.getWorldPosition(g.position.clone()); return { x: w.x, z: w.z, yaw: g.rotation.y }; }, KID);
  const k0 = await kid();
  const fx = Math.sin(k0.yaw), fz = Math.cos(k0.yaw);
  const side = Number(process.env.GREET_SIDE || 1.0);
  const rx = Math.cos(k0.yaw), rz = -Math.sin(k0.yaw);
  const behind = process.env.GREET_FROM === 'behind';
  // in front of her (default) heading her way reversed, or behind her heading her way: he walks past her at `side` metres, she stays in frame beside him
  const lx = k0.x + (behind ? -fx : fx) * 3.6 + rx * side, lz = k0.z + (behind ? -fz : fz) * 3.6 + rz * side;
  await page.evaluate(([x, z, y]) => window.__ZR_PLAY__.place(x, z, y), [lx, lz, behind ? Math.atan2(fx, fz) : Math.atan2(-fx, -fz)]);
  await page.evaluate((dt) => window.__ZR_PLAY__.step(20, dt, false), DT);
  log(`kid at ${k0.x.toFixed(2)}, ${k0.z.toFixed(2)} yaw ${k0.yaw.toFixed(2)}; Link placed at ${lx.toFixed(2)}, ${lz.toFixed(2)}`);

  // W until within 1.45 m (max 2.5 s), stand 3 s, S 1.7 s, stand 2.5 s
  const phases = process.env.GREET_RELEASE === 'walkpast' ? [['W', 90, 1.5], [null, 90, null], ['W', 66, null], ['look', 105, null]] : process.env.GREET_RELEASE === 'strafe' ? [['W', 90, 1.5], [null, 90, null], ['D', 75, null], [null, 105, null]] : process.env.GREET_RELEASE === 'teleport' ? [['W', 90, 1.5], [null, 90, null], ['away', 120, null]] : [['W', 90, 1.5], [null, 90, null], ['S', 66, null], [null, 90, null]];
  const frames = [];
  let k = 0, i = 0;
  for (const [key, maxFrames, stopAt] of phases) {
    if (key === 'away') {
      // he leaves: Link is put 4.5 m behind her on the open side, facing her, the camera behind him
      const kk = await kid();
      const ax = kk.x - fx * 4.5 + rx * 0.8, az = kk.z - fz * 4.5 + rz * 0.8;
      await page.evaluate(([x, z, y]) => window.__ZR_PLAY__.place(x, z, y), [ax, az, Math.atan2(kk.x - ax, kk.z - az)]);
      log(`away: Link placed at ${ax.toFixed(2)}, ${az.toFixed(2)}`);
    } else if (key === 'look') {
      // the camera turns back to her, 20° off the Link–girl line so he does not hide her
      const kk = await kid(); const st = await page.evaluate(() => window.__ZR_PLAY__.state());
      const y = Math.atan2(kk.x - st.link[0], kk.z - st.link[2]) + 0.35;
      await page.evaluate((y) => window.__ZR_PLAY__.setView(y, -0.12), y);
      log(`look back: view yaw ${y.toFixed(2)}, dist ${Math.hypot(kk.x - st.link[0], kk.z - st.link[2]).toFixed(2)}`);
    } else if (key) await page.keyboard.down(`Key${key}`);
    for (let j = 0; j < maxFrames; j++, i++) {
      if (i % 6 === 0) {
        const st = await page.evaluate((dt) => { window.__ZR_PLAY__.step(1, dt, true); const gl = document.querySelector('canvas').getContext('webgl2'); if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return window.__ZR_PLAY__.state(); }, DT);
        const kk = await kid();
        const d = Math.hypot(st.link[0] - kk.x, st.link[2] - kk.z);
        const file = `g${String(k++).padStart(4, '0')}.jpg`;
        await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 90 });
        frames.push({ i, t: i / 30, key, file, link: st.link.map((v) => +v.toFixed(2)), kid: [+kk.x.toFixed(2), +kk.z.toFixed(2)], kidYaw: +kk.yaw.toFixed(2), dist: +d.toFixed(2), calls: st.render.calls });
        log(`${file} t ${(i / 30).toFixed(1)} ${key ?? '-'} dist ${d.toFixed(2)} kidYaw ${kk.yaw.toFixed(2)} kid ${kk.x.toFixed(2)},${kk.z.toFixed(2)}`);
        if (stopAt && d < stopAt) { i++; break; }
      } else {
        await page.evaluate((dt) => window.__ZR_PLAY__.step(1, dt, false), DT);
        if (stopAt) { const kk = await kid(); const st = await page.evaluate(() => window.__ZR_PLAY__.state()); if (Math.hypot(st.link[0] - kk.x, st.link[2] - kk.z) < stopAt) { i++; break; } }
      }
    }
    if (key && key !== 'look' && key !== 'away') await page.keyboard.up(`Key${key}`);
  }
  fs.writeFileSync(path.join(out, 'greet.json'), JSON.stringify(frames, null, 1));
  log(`done: ${k} frames`);
} finally {
  await browser.close().catch(() => {});
  await server.close?.().catch?.(() => {});
}
