// Receipt-only preload for the existing B-roll exporter; does not issue a render or change the page.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const out = path.resolve('art/environment/astra-cinematic-preflight-sept23/native');
const report = { startedAt: new Date().toISOString(), captures: [], errors: [] };
const save = () => fs.writeFileSync(path.join(out, 'runtime-receipt.json'), JSON.stringify(report, null, 2));
const launch = puppeteer.launch.bind(puppeteer);
puppeteer.launch = async (options) => {
  report.launch = options;
  const browser = await launch(options);
  report.browserVersion = await browser.version();
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    page.on('pageerror', (e) => { report.errors.push(e.message); save(); });
    page.on('console', (m) => { if (m.type() === 'error') { report.errors.push(m.text()); save(); } });
    const select = page.$.bind(page);
    page.$ = async (...args) => {
      const element = await select(...args);
      if (args[0] !== 'canvas' || !element) return element;
      const screenshot = element.screenshot.bind(element);
      element.screenshot = async (...args) => {
        const png = await screenshot(...args);
        const metadata = await page.evaluate(() => {
          const gl = document.querySelector('canvas').getContext('webgl2');
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          const audit = window.__ZR__.audit();
          return { stats: window.__ZR__.stats(), camera: window.__ZR__.cameraPose(),
            renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
            characterVisible: window.__H?.scene.getObjectByName('character')?.visible,
            npcsVisible: audit.systems.character.npcsVisible, lighting: audit.systems.lighting,
            ui: [...document.querySelectorAll('.zr-hud,.zr-equip,#dev,#loading')].map(el => ({ id: el.id, className: el.className, display: getComputedStyle(el).display, opacity: getComputedStyle(el).opacity })) };
        });
        report.captures.push({ sha256: crypto.createHash('sha256').update(png).digest('hex'), ...metadata });
        save();
        assert.equal(metadata.stats.width, 1920); assert.equal(metadata.stats.height, 1080);
        assert.equal(metadata.stats.pixelRatio, 1); assert.equal(metadata.characterVisible, false);
        assert.equal(metadata.npcsVisible, 0); assert.doesNotMatch(metadata.renderer, /SwiftShader/i);
        return png;
      };
      return element;
    };
    return page;
  };
  const close = browser.close.bind(browser);
  browser.close = async () => { try { return await close(); } finally { report.closedAt = new Date().toISOString(); save(); } };
  return browser;
};
