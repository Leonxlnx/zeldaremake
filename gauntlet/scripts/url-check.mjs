#!/usr/bin/env node
/**
 * url-check.mjs — does a published build boot from its public URL? Opens the URL in headless Chrome
 * (normal launch path, no test flags), logs every failed or slow request and every console error,
 * and reports when `__ZR__.ready()` resolves (or what it was still waiting on at the deadline).
 *
 *   node gauntlet/scripts/url-check.mjs --url https://raw.githack.com/Leonxlnx/zeldaremake/play-head/index.html \
 *        --out /tmp/url-check [--minutes 20] [--size 960x540]
 *
 * Writes <out>/url-check.json and <out>/ready.jpg (the first frame after ready).
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const url = String(args.url);
const out = path.resolve(args.out || '/tmp/url-check');
const minutes = Number(args.minutes || 20);
const [width, height] = String(args.size || '960x540').split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (...m) => console.error(`[url-check +${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...m);

const report = { url, startedAt: new Date().toISOString(), requests: 0, bytes: 0, failed: [], slow: [], redirects: 0, consoleErrors: [], readyS: null, error: null };
const browser = await launchBrowser({ width, height });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // the game treats a webdriver page as a headless capture; the owner's browser is not one
  await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
  const started = new Map();
  page.on('request', (r) => started.set(r, Date.now()));
  page.on('requestfinished', async (r) => {
    report.requests++;
    const res = r.response();
    const ms = Date.now() - (started.get(r) ?? Date.now());
    if (res && res.status() >= 300 && res.status() < 400) report.redirects++;
    const len = Number(res?.headers()['content-length'] ?? 0);
    report.bytes += len;
    if (ms > 5000) report.slow.push({ url: r.url(), ms, status: res?.status() ?? null, bytes: len });
    if (res && res.status() >= 400) report.failed.push({ url: r.url(), status: res.status() });
  });
  page.on('requestfailed', (r) => report.failed.push({ url: r.url(), error: r.failure()?.errorText ?? 'failed' }));
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text());
    if (/\[warmup\]|ready|error/i.test(m.text())) log(`[page:${m.type()}] ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => report.consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'load', timeout: minutes * 60_000 });
  // raw.githack.com shows a browser a one-time "External Content Notice" before a proxied HTML page
  // (a cookie remembers the click); the owner clicks "Open the page" once, so does the check
  if (/External Content Notice/i.test(await page.title())) {
    log('githack notice — clicking "Open the page"');
    report.githackNotice = true;
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: minutes * 60_000 }), page.click('button.url-action-button')]);
  }
  log(`page loaded (${await page.title()}); waiting for the world`);
  await page.waitForFunction(() => !!window.__ZR__, { timeout: minutes * 60_000, polling: 1000 });
  await page.evaluate(() => {
    window.__urlReady = 'pending';
    Promise.resolve(window.__ZR__.ready()).then(
      () => (window.__urlReady = 'ready'),
      (e) => (window.__urlReady = `error: ${e?.message ?? e}`),
    );
  });
  const deadline = t0 + minutes * 60_000;
  let last = 0;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__urlReady);
    if (state !== 'pending') {
      if (state === 'ready') report.readyS = +((Date.now() - t0) / 1000).toFixed(1);
      else report.error = state;
      break;
    }
    if (Date.now() - last > 30_000) {
      last = Date.now();
      log(`still loading: ${report.requests} requests, ${(report.bytes / 1048576).toFixed(1)} MB, ${report.failed.length} failed`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (report.readyS !== null) {
    log(`ready in ${report.readyS} s`);
    await new Promise((r) => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(out, 'ready.jpg'), type: 'jpeg', quality: 85 });
  } else if (!report.error) report.error = `not ready after ${minutes} min`;
} catch (e) {
  report.error = String(e?.message ?? e);
} finally {
  report.finishedAt = new Date().toISOString();
  report.slow.sort((a, b) => b.ms - a.ms);
  report.slow = report.slow.slice(0, 20);
  fs.writeFileSync(path.join(out, 'url-check.json'), JSON.stringify(report, null, 1));
  log(`report → ${path.join(out, 'url-check.json')} (${report.readyS !== null ? `ready ${report.readyS} s` : report.error})`);
  await browser.close();
}
