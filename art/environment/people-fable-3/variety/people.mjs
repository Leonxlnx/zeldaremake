// Lane-7 self-review: every kid at the owner's play distances, the real follow camera.
// For each kid: Link placed beside the kid (0.8 m off her axis, on the side she faces, at 1.2 m and 3.0 m)
// heading her way, so the follow camera looks past his shoulder at her; the camera settles for 45 sim
// frames, one frame is drawn and saved, with the kid's screen projection for cropping.
// node art/environment/people-fable-3/variety/people.mjs <dist> <outDir>   (from the repo root; needs a built dist)
//   PEOPLE_ONLY=b-seat,bank  PEOPLE_DISTS=1.2,3.0,6.0   — a subset of kids / other Link distances (6 m is past the notice range)
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist, out] = process.argv.slice(2);
const W = 1280, H = 720, DT = 1 / 30;
fs.mkdirSync(out, { recursive: true });
const log = (...m) => console.error(`[people ${new Date().toISOString().slice(11, 19)}]`, ...m);
const NAMES = ['a-wander', 'b-seat', 'c-door', 'ledge', 'bank', 'grove'];
const DISTS = process.env.PEOPLE_DISTS ? process.env.PEOPLE_DISTS.split(",").map(Number) : [1.2, 3.0];
const ONLY = process.env.PEOPLE_ONLY ? new Set(process.env.PEOPLE_ONLY.split(",")) : null;
const SIDE = 0.8; // Link stands off the kid's axis so the camera looks past his shoulder

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
        const r = await client.send('Runtime.callFunctionOn', {
          objectId: v.value.objectId,
          functionDeclaration: 'function(){ if (this && this.scene && this.scene.isScene && typeof this.step === "function") { window.__H = this; return true; } return false; }',
          returnByValue: true,
        });
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
const report = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  const t0 = Date.now();
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS, polling: 250 });
  await page.evaluate(() => {
    window.__zrReadyState = 'pending';
    Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`));
  });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: READY_TIMEOUT_MS, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!(await grabHooks(page))) throw new Error('world hooks not found');

  // play mode on, a few seconds of simulation so the cast is in its play-mode places
  await page.evaluate(() => window.__ZR_PLAY__.place(0.8, 6.2, 1.2));
  await page.evaluate((dt) => window.__ZR_PLAY__.step(90, dt, false), DT);

  const kidState = (i) => page.evaluate((i) => {
    const cast = window.__H.scene.getObjectByName('background-characters');
    const g = cast.children[2 * i];
    const w = g.getWorldPosition(g.position.clone());
    return { x: w.x, y: w.y, z: w.z, yaw: g.rotation.y, visible: g.visible };
  }, i);

  for (let i = 0; i < NAMES.length; i++) {
    if (ONLY && !ONLY.has(NAMES[i])) continue;
    if (i === 0) await page.evaluate((dt) => window.__ZR_PLAY__.step(240, dt, false), DT); // the wanderer walks on into the open plaza
    for (const d of DISTS) {
      const k = await kidState(i);
      const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
      const rx = Math.cos(k.yaw), rz = -Math.sin(k.yaw);
      const lx = k.x + fx * d + rx * SIDE, lz = k.z + fz * d + rz * SIDE;
      const lyaw = Math.atan2(-fx, -fz); // parallel to the kid's facing, reversed: the camera looks past Link's shoulder at her
      await page.evaluate(([x, z, y]) => window.__ZR_PLAY__.place(x, z, y), [lx, lz, lyaw]);
      await page.evaluate((dt) => window.__ZR_PLAY__.step(45, dt, false), DT);
      const st = await page.evaluate((dt) => {
        window.__ZR_PLAY__.step(1, dt, true);
        const gl = document.querySelector('canvas').getContext('webgl2');
        if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        return window.__ZR_PLAY__.state();
      }, DT);
      const k2 = await kidState(i);
      const scr = await page.evaluate((i) => { const a = window.__ZR__.audit().systems.character; return a?.screen?.kids?.[i] ?? null; }, i);
      const cam = st.camera.position;
      const camToKid = Math.hypot(cam[0] - k2.x, cam[2] - k2.z);
      const file = `${NAMES[i]}-${d.toFixed(1)}m.png`;
      await page.screenshot({ path: path.join(out, file), type: 'png' });
      const row = { kid: NAMES[i], linkDist: d, kid: NAMES[i], kidAt: [k2.x, k2.y, k2.z].map((v) => +v.toFixed(2)), kidYaw: +k2.yaw.toFixed(2), visible: k2.visible, camToKid: +camToKid.toFixed(2), calls: st.render.calls, tris: st.render.triangles, screen: scr, file };
      report.push(row);
      log(JSON.stringify(row));
    }
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  await server.close?.().catch?.(() => {});
}
