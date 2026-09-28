// Shared headless-Chrome plumbing. Every preview tool and the final renderer go through here,
// so the GL backend and flags are identical everywhere.
//
//   import { withPage, startServer } from './lib/headless.mjs';
//   const srv = await startServer();                 // serves /workspace on a free port
//   await withPage(srv.url('/spiderverse/app/preview-ant.html'), async (page) => { ... });
//   srv.close();

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');
export const SV_ROOT = path.resolve(HERE, '../..');
export const CHROME = '/usr/local/bin/google-chrome';

export const CHROME_ARGS = [
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--disable-dev-shm-usage',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--disable-gpu-watchdog',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--js-flags=--max-old-space-size=4096',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glsl': 'text/plain',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};

/** Static server rooted at the repo, so /node_modules/three/... and /spiderverse/... resolve. */
export function startServer({ port = 0, root = REPO_ROOT } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(root, urlPath);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404);
          res.end('not found: ' + urlPath);
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(file).pipe(res);
      });
    });
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({
        port: p,
        url: (u) => `http://127.0.0.1:${p}${u}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

export async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    args: CHROME_ARGS,
    protocolTimeout: 0,
  });
}

/**
 * Open `url` in a fresh page sized to the viewport, forward console/page errors, wait for
 * `window.__ready === true` (set by the page when its module graph has loaded), run `fn(page)`.
 */
export async function withPage(url, fn, { width = 1920, height = 803, browser = null, quiet = false } = {}) {
  const own = !browser;
  const b = browser || (await launchBrowser());
  const page = await b.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => {
    if (!quiet || m.type() === 'error') console.log(`[page:${m.type()}]`, m.text());
  });
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.log('[pageerror]', e.message);
  });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 0 });
    await page.waitForFunction('window.__ready === true || window.__error', { timeout: 0, polling: 100 });
    const err = await page.evaluate(() => window.__error || null);
    if (err) throw new Error('page failed: ' + err);
    return await fn(page, errors);
  } finally {
    await page.close();
    if (own) await b.close();
  }
}

/**
 * Pull an RGBA canvas out of the page as PNG bytes. The page exposes
 * `window.__grab()` returning `{ width, height, data: base64 RGBA (top row first) }`,
 * or we fall back to canvas.toDataURL on the first canvas.
 */
export async function grabPNG(page, outFile) {
  const sharp = (await import('sharp')).default;
  const got = await page.evaluate(async () => {
    if (window.__grab) return await window.__grab();
    const c = document.querySelector('canvas');
    return { dataURL: c.toDataURL('image/png') };
  });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (got.dataURL) {
    fs.writeFileSync(outFile, Buffer.from(got.dataURL.split(',')[1], 'base64'));
    return outFile;
  }
  const buf = Buffer.from(got.data, 'base64');
  await sharp(buf, { raw: { width: got.width, height: got.height, channels: 4 } })
    .png({ compressionLevel: 6 })
    .toFile(outFile);
  return outFile;
}
