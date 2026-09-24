#!/usr/bin/env node
/**
 * play-shot.mjs — what the player sees: play mode (the follow camera, Link, every play-only system),
 * Link placed at rest at `--at x,z` facing `--yaw` (degrees; forward = (sin, cos)), `--frames` of
 * simulation, then one drawn frame saved as a JPEG. `--pitch` (degrees, + up) sets the orbit's pitch
 * after the placement, as a mouse drag would.
 *
 *   node gauntlet/scripts/play-shot.mjs --dist dist --out shot.jpg --at 1.2,1.6 --yaw -125 [--pitch 12] [--size 1280x740]
 */
import path from 'node:path';
import { launchBrowser, serveStatic, READY_TIMEOUT_MS } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const [width, height] = String(args.size ?? '1280x740').split('x').map(Number);
const [x, z] = String(args.at ?? '0,0.5').split(',').map(Number);
const yaw = (Number(args.yaw ?? 180) * Math.PI) / 180;
const frames = Number(args.frames ?? 45);
const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // play mode runs its own systems only when the page does not look automated (as playtest.mjs does)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=1&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  await page.evaluate(([px, pz, py]) => window.__ZR_PLAY__.place(px, pz, py), [x, z, yaw]);
  if (args.pitch !== undefined) await page.evaluate(([y, p]) => window.__ZR_PLAY__.setView?.(y, p), [yaw, (Number(args.pitch) * Math.PI) / 180]);
  await page.evaluate((n) => window.__ZR_PLAY__.step(n, 1 / 30, false), frames);
  await page.evaluate(() => window.__ZR_PLAY__.step(1, 1 / 30, true));
  await page.screenshot({ path: path.resolve(args.out ?? 'play-shot.jpg'), type: 'jpeg', quality: 90 });
  console.log(`[play-shot] ${args.out}`);
} finally {
  await browser.close();
  server.close();
}
