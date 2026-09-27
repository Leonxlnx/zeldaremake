import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
  // patch the two places a 2D canvas is forced to become pixels: a CPU readback, and a GPU upload
  await page.evaluateOnNewDocument(() => {
    const t = { getImageData: 0, getImageDataN: 0, texImage2D: 0, texImage2DN: 0, texSubImage2D: 0, texSubImage2DN: 0, toDataURL: 0, toDataURLN: 0, createImageBitmap: 0, createImageBitmapN: 0 };
    window.__RASTER__ = t;
    const wrap = (obj, name, key, pred) => {
      const orig = obj[name];
      if (!orig) return;
      obj[name] = function (...a) {
        if (pred && !pred(a)) return orig.apply(this, a);
        const s = performance.now();
        try { return orig.apply(this, a); } finally { t[key] += performance.now() - s; t[key + 'N']++; }
      };
    };
    wrap(CanvasRenderingContext2D.prototype, 'getImageData', 'getImageData');
    wrap(HTMLCanvasElement.prototype, 'toDataURL', 'toDataURL');
    const fromCanvas = (a) => a.some((x) => x instanceof HTMLCanvasElement || x instanceof ImageData || x instanceof ImageBitmap || x instanceof HTMLImageElement);
    for (const G of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!G) continue;
      wrap(G.prototype, 'texImage2D', 'texImage2D', fromCanvas);
      wrap(G.prototype, 'texSubImage2D', 'texSubImage2D', fromCanvas);
      wrap(G.prototype, 'texImage3D', 'texImage2D', fromCanvas);
      wrap(G.prototype, 'compressedTexImage2D', 'texImage2D', () => true);
    }
  });
  await page.goto(`${server.url}/?capture=1&dev=0&quality=high`, { waitUntil: 'load', timeout: 900000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900000, polling: 250 });
  await page.evaluate(() => { const w = window; w.__s = 'pending'; Promise.resolve(w.__ZR__.ready()).then(() => (w.__s = 'ready'), (e) => (w.__s = 'err ' + e)); });
  await page.waitForFunction(() => window.__s !== 'pending', { timeout: 900000, polling: 1000 });
  const out = await page.evaluate(() => ({ state: window.__s, raster: window.__RASTER__, build: window.__ZR__.perf().buildMs }));
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); await server.close(); }
