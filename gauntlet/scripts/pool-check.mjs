#!/usr/bin/env node
/**
 * pool-check.mjs — the near-LOD pools as the player meets them: load play mode (no harness re-pose),
 * let the loop run `--seconds` of wall time at the spawn, and print the trees system's pool reports
 * (wanted / resident / pending parts, builds, synchronous builds).
 *
 *   node gauntlet/scripts/pool-check.mjs --dist dist [--seconds 5] [--out pools.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, serveStatic, READY_TIMEOUT_MS } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const seconds = Number(args.seconds ?? 5);
const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
let result = null;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
  // play mode runs its own loop only when the page does not look automated (as playtest.mjs does)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  await new Promise((r) => setTimeout(r, seconds * 1000));
  result = await page.evaluate(() => {
    const p = window.__ZR__.perf();
    const t = p.systemPerf?.trees ?? {};
    return { tier: t.tier, nearCanopyPool: t.nearCanopyPool, nearBasePool: t.nearBasePool };
  });
  console.log(JSON.stringify(result, null, 1));
} finally {
  await browser.close();
  server.close();
}
if (args.out && result) fs.writeFileSync(path.resolve(args.out), JSON.stringify(result, null, 1));
