/**
 * Headless Chrome + static server helpers shared by the gauntlet scripts.
 * WebGL2 runs on SwiftShader (software) so captures work on any CI runner.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

/** Serve a directory on an ephemeral port. Returns { url, close }. */
export function serveStatic(dir, { spaFallback = true } = {}) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    let file = path.join(dir, urlPath);
    if (!file.startsWith(dir)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (spaFallback && !path.extname(urlPath)) file = path.join(dir, 'index.html');
      else {
        res.writeHead(404).end('not found');
        return;
      }
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, port, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.');
}

export async function launchBrowser({ width = 1280, height = 720, deviceScaleFactor = 1 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    protocolTimeout: 600_000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--enable-webgl2-compute-context',
      '--hide-scrollbars',
      '--mute-audio',
      `--window-size=${width},${height}`,
    ],
    defaultViewport: { width, height, deviceScaleFactor },
  });
  return browser;
}

/** Ready timeout: CAPTURE_READY_TIMEOUT_MS env (default 15 min — SwiftShader shader compiles on a loaded box are slow). */
export const READY_TIMEOUT_MS = Number(process.env.CAPTURE_READY_TIMEOUT_MS) > 0 ? Number(process.env.CAPTURE_READY_TIMEOUT_MS) : 900_000;

/**
 * Open the world under capture mode and wait for `window.__ZR__.ready()`. The ready wait is polled
 * (short CDP calls) so it is bounded by `timeoutMs`, not by puppeteer's per-call protocolTimeout.
 */
export async function openWorld(browser, baseUrl, { width = 1280, height = 720, quality = 'high', timeoutMs = READY_TIMEOUT_MS, log = console.error } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const consoleLines = [];
  page.on('console', (m) => {
    const line = `[page:${m.type()}] ${m.text()}`;
    consoleLines.push(line);
    if (m.type() === 'error' || m.type() === 'warning') log(line);
  });
  page.on('pageerror', (e) => {
    consoleLines.push(`[pageerror] ${e.message}`);
    log(`[pageerror] ${e.message}`);
  });
  const url = `${baseUrl}/?capture=1&dev=0&quality=${encodeURIComponent(quality)}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: timeoutMs, polling: 250 });
  log(`world: page loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s — waiting for __ZR__.ready() (timeout ${(timeoutMs / 60_000).toFixed(0)} min)`);
  await page.evaluate(() => {
    const w = window;
    w.__zrReadyState = 'pending';
    Promise.resolve(w.__ZR__.ready()).then(
      () => (w.__zrReadyState = 'ready'),
      (e) => (w.__zrReadyState = `error: ${e?.message ?? e}`),
    );
  });
  try {
    await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: timeoutMs, polling: 1000 });
  } catch (e) {
    throw new Error(`world did not become ready within ${(timeoutMs / 1000).toFixed(0)} s (${e.message}). Set CAPTURE_READY_TIMEOUT_MS to wait longer or reduce machine load.`);
  }
  const state = await page.evaluate(() => window.__zrReadyState);
  if (state !== 'ready') throw new Error(`__ZR__.ready() rejected: ${state}`);
  log(`world: ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { page, consoleLines, url };
}
