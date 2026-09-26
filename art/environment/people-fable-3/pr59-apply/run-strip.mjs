// Play-mode run strip: Link runs on the flat plaza, side follow camera, N frames at 1/10 s, plus the
// controller's positions / feet per frame so the ground speed and any foot slide are numbers too.
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, serveStatic } from '../../../../gauntlet/scripts/lib/browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dist = arg('--dist'); const out = arg('--out'); const gait = arg('--gait', 'run'); const KEY = arg('--key', 'KeyW');
const W = 1280, H = 720, DT = 1 / 60, FRAMES = Number(arg('--frames', 12)), EVERY = 6;
const START = [Number(arg('--x', -4)), Number(arg('--z', 3)), Number(arg('--yaw', 0))];
const VIEW = [Number(arg('--vyaw', Math.PI / 2)), Number(arg('--vpitch', -0.06))];
fs.mkdirSync(out, { recursive: true });
const server = await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width: W, height: H });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 600000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = 'error: ' + e)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 600000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 600000, polling: 500 });
  await page.evaluate(([x, z, y]) => window.__ZR_PLAY__.place(x, z, y), START);
  await page.evaluate((dt) => window.__ZR_PLAY__.step(30, dt, false), DT);
  await page.keyboard.down(KEY);
  if (gait === 'run') await page.keyboard.down('ShiftLeft');
  for (let k = 0; k < Number(arg('--runup', 72)); k++) await page.evaluate(([dt, y, p]) => { window.__ZR_PLAY__.setView(y, p); window.__ZR_PLAY__.step(1, dt, false); }, [DT, VIEW[0], VIEW[1]]); // 1.2 s: up to speed, the view easing to the side
  const rows = [];
  for (let i = 0; i < FRAMES; i++) {
    for (let k = 0; k < EVERY - 1; k++) {
      const st = await page.evaluate(([dt, y, p]) => { window.__ZR_PLAY__.setView(y, p); window.__ZR_PLAY__.step(1, dt, false); return window.__ZR_PLAY__.state(); }, [DT, VIEW[0], VIEW[1]]);
      rows.push({ t: (i * EVERY + k) * DT, link: st.link, feet: st.feet, air: st.air });
    }
    const st = await page.evaluate(([dt, y, p]) => { window.__ZR_PLAY__.setView(y, p); window.__ZR_PLAY__.step(1, dt, true); return window.__ZR_PLAY__.state(); }, [DT, VIEW[0], VIEW[1]]);
    rows.push({ t: (i * EVERY + EVERY - 1) * DT, link: st.link, feet: st.feet, air: st.air, frame: i });
    await page.screenshot({ path: path.join(out, `f${String(i).padStart(2, '0')}.png`) });
    if (i === 0) console.log('render', JSON.stringify(st.render), 'cam', st.camera.position.map((v) => v.toFixed(2)).join(','));
  }
  await page.keyboard.up(KEY);
  if (gait === 'run') await page.keyboard.up('ShiftLeft');
  const first = rows[0].link, last = rows.at(-1).link;
  const speed = Math.hypot(last[0] - first[0], last[2] - first[2]) / (rows.at(-1).t - rows[0].t);
  const stances = rows.map((r) => (r.feet ?? []).map((f) => (f.stance ? 'S' : '.')).join('')).join(' ');
  fs.writeFileSync(path.join(out, 'rows.json'), JSON.stringify({ gait, START, VIEW, speedMps: speed, rows }, null, 1));
  console.log(`gait ${gait}: ground speed over the strip ${speed.toFixed(3)} m/s; stances ${stances}`);
} finally {
  await browser.close();
  await server.close();
}
