// Play mode, the held sign (T): Link on the plaza, the sign raised with a real key press, then
// stills from behind / the side / the front, or a running take for the demo video (--take).
// node art/environment/sign-2026-09-27/sign-shots.mjs --dist dist --out <dir> [--take]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, serveStatic } from '../../../gauntlet/scripts/lib/browser.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const dist = arg('--dist', 'dist');
const out = arg('--out', '/tmp/sign-shots');
const take = process.argv.includes('--take');
const W = 1280;
const H = 720;
const DT = 1 / 60;
const START = [Number(arg('--x', -4)), Number(arg('--z', 3)), Number(arg('--yaw', 0))];
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width: W, height: H });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || process.argv.includes('--verbose')) log(`[console.${m.type()}]`, m.text().slice(0, 240));
  });
  const poll = setInterval(async () => {
    try {
      log('status', JSON.stringify(await page.evaluate(() => ({ zr: !!window.__ZR__, state: window.__zrReadyState ?? null, play: !!window.__ZR_PLAY__, loading: document.getElementById('loading')?.className ?? null }))));
    } catch (e) {
      log('status error', String(e).slice(0, 120));
    }
  }, 30000);
  poll.unref();
  // play mode is not a headless capture: the page reads navigator.webdriver for that
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 600000, polling: 250 });
  await page.evaluate(() => {
    window.__zrReadyState = 'pending';
    Promise.resolve(window.__ZR__.ready()).then(
      () => (window.__zrReadyState = 'ready'),
      (e) => (window.__zrReadyState = 'error: ' + e),
    );
  });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 600000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 600000, polling: 500 });
  clearInterval(poll);
  log('ready');
  const sign = () => page.evaluate(() => window.__ZR__.audit().systems?.character?.linkSign ?? window.__ZR__.audit().character?.linkSign ?? null);
  const step = (n, render = false, view = null) =>
    page.evaluate(
      ([n, dt, render, view]) => {
        for (let i = 0; i < n; i++) {
          if (view) window.__ZR_PLAY__.setView(view[0], view[1]);
          window.__ZR_PLAY__.step(1, dt, render && i === n - 1);
        }
        return window.__ZR_PLAY__.state();
      },
      [n, DT, render, view],
    );
  await page.evaluate(([x, z, y]) => window.__ZR_PLAY__.place(x, z, y), START);
  await step(30);
  log('sign before T', JSON.stringify(await sign()));
  // a real key press: down for a step, up again
  await page.keyboard.down('KeyT');
  await step(1);
  await page.keyboard.up('KeyT');
  if (!take) {
    await step(40);
    log('sign after T + 40 steps', JSON.stringify(await sign()));
    const shots = [
      ['behind', null],
      ['side', [START[2] + Math.PI / 2, -0.05]],
      ['front', [START[2] + Math.PI, -0.02]],
    ];
    for (const [name, view] of shots) {
      await step(45, true, view);
      await page.screenshot({ path: path.join(out, `${name}.png`) });
      log('shot', name);
    }
  } else {
    // the take: raise while standing, run forward with it up, then lower it on the move
    let f = 0;
    const shoot = async (n, every = 5, view = null) => {
      for (let i = 0; i < n; i++) {
        await step(every, true, view);
        await page.screenshot({ path: path.join(out, `f${String(f++).padStart(4, '0')}.png`) });
      }
    };
    await shoot(12); // 1 s: the raise
    log('raised', JSON.stringify(await sign()));
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await shoot(48); // 4 s running with it up, the camera behind
    await shoot(24, 5, [START[2] + Math.PI * 0.6, -0.04]); // 2 s, the view swung round to his side
    await page.keyboard.down('KeyT');
    await step(1);
    await page.keyboard.up('KeyT');
    await shoot(12); // 1 s: lowered on the run
    log('lowered', JSON.stringify(await sign()));
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    log('frames', f);
  }
} finally {
  await browser.close();
  await server.close();
  process.exit(process.exitCode ?? 0);
}
