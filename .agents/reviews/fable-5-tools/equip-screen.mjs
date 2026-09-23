// Non-author render of the equipment screen (`?screen=equipment`) for U02/U03 verdicts.
// usage: node .agents/reviews/fable-5-tools/equip-screen.mjs <dist> <out.png> [--settle 8] [--time 12.5]  (run from the repo root of the build under review)
// Full-page screenshot (the bag is a DOM overlay over the canvas), 1280×720, quality high, capture mode.
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const [dist, out] = process.argv.slice(2);
const args = Object.fromEntries(process.argv.slice(4).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter(Boolean));
const settle = Number(args.settle ?? 8), simTime = Number(args.time ?? 12.5);
const width = 1280, height = 720;

const server = await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width, height });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[page:error] ${m.text()}`); });
  const url = `${server.url}/?capture=1&dev=0&quality=high&screen=equipment`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS, polling: 250 });
  await page.evaluate(() => { const w = window; w.__zrReadyState = 'pending'; Promise.resolve(w.__ZR__.ready()).then(() => (w.__zrReadyState = 'ready'), (e) => (w.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: READY_TIMEOUT_MS, polling: 1000 });
  const state = await page.evaluate(() => window.__zrReadyState);
  if (state !== 'ready') throw new Error(`ready rejected: ${state}`);
  await page.waitForFunction(() => { const l = document.getElementById('loading'); return !l || getComputedStyle(l).opacity === '0'; }, { timeout: READY_TIMEOUT_MS });
  console.error(`world: ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate((t) => { window.__ZR__.setTime(t); }, simTime);
  for (let left = settle; left > 0; left -= 4) await page.evaluate(async ([n, dt]) => { await window.__ZR__.render(n, dt); }, [Math.min(4, left), 1 / 12]);
  const info = await page.evaluate(() => ({ screen: document.querySelector('.zr-hud')?.getAttribute('data-screen') ?? null, equip: !!document.querySelector('.zr-equip'), equipDisplay: document.querySelector('.zr-equip') ? getComputedStyle(document.querySelector('.zr-equip')).display : null }));
  console.error(`hud: ${JSON.stringify(info)}`);
  const buf = await page.screenshot({ type: 'png' });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, buf);
  console.error(`wrote ${out} (${buf.length} bytes) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} finally {
  await browser.close();
  server.close?.();
}
