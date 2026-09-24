// Receipt-only preload for broll.mjs (scout): logs per-capture stats/camera/renderer to $SCOUT_RECEIPT. No page changes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';
const outFile = path.resolve(process.env.SCOUT_RECEIPT || 'gauntlet/out/opus-cinematic-sept24/scout/receipt.json');
const report = { startedAt: new Date().toISOString(), captures: [], errors: [] };
const save = () => fs.writeFileSync(outFile, JSON.stringify(report, null, 1));
const launch = puppeteer.launch.bind(puppeteer);
puppeteer.launch = async (options) => {
  const browser = await launch(options);
  report.browserVersion = await browser.version();
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    page.on('pageerror', (e) => { report.errors.push(e.message); save(); });
    page.on('console', (m) => { if (m.type() === 'error') { report.errors.push(m.text()); save(); } });
    const select = page.$.bind(page);
    page.$ = async (...a) => {
      const el = await select(...a);
      if (a[0] !== 'canvas' || !el) return el;
      const shot = el.screenshot.bind(el);
      el.screenshot = async (...s) => {
        const t0 = Date.now();
        const png = await shot(...s);
        const md = await page.evaluate(() => {
          const gl = document.querySelector('canvas').getContext('webgl2');
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          const st = window.__ZR__.stats();
          return { stats: st, camera: window.__ZR__.cameraPose(), renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
            characterVisible: window.__H?.scene.getObjectByName('character')?.visible };
        });
        report.captures.push({ at: new Date().toISOString(), shotMs: Date.now() - t0, bytes: png.length, sha256: crypto.createHash('sha256').update(png).digest('hex').slice(0, 16), ...md });
        save();
        return png;
      };
      return el;
    };
    return page;
  };
  const close = browser.close.bind(browser);
  browser.close = async () => { try { return await close(); } finally { report.closedAt = new Date().toISOString(); save(); } };
  return browser;
};
