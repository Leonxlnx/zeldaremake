#!/usr/bin/env node
/** Isolate a local pod-light hotspot with the existing temporary visibility hook. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';
import { gitInfo, hashDir, sha256 } from './capture.mjs';

const out = path.join(ROOT, 'gauntlet/out/astra-lantern-study');
fs.mkdirSync(out, { recursive: true });
const report = {
  source: gitInfo().sha, distHash: hashDir(path.join(ROOT, 'dist')),
  startedAt: new Date().toISOString(), status: 'running', captures: [], errors: [], restored: null,
  note: 'Auxiliary matched full-scene renders. Only branch-lantern-light visibility changes through the existing __ATMO_HIDE__ hook. Emission, geometry, sun, exposure and postfx defaults remain identical. This is diagnosis, not a production fix or canonical take.',
};
let server, browser, page, previous, failure, ready = false;
async function captureCanvas(label) {
  const canvas = await page.$('canvas');
  assert.ok(canvas);
  for (let retries = 0; retries <= 3; retries++) {
    const png = Buffer.from(await canvas.screenshot({ type: 'png' }));
    const stats = await sharp(png).stats();
    if (Math.max(...stats.channels.slice(0, 3).map(c => c.stdev)) > 2) return { png, stats, retries };
    assert.ok(retries < 3, `${label}: uniform renderer buffer`);
    await page.evaluate(() => window.__ZR__.render(2, 0));
  }
}
try {
  assert.ok(report.source);
  server = await serveStatic(path.join(ROOT, 'dist'));
  browser = await launchBrowser({ width: 1280, height: 720 });
  page = await browser.newPage();
  page.on('pageerror', e => report.errors.push({ kind: 'pageerror', message: e.message }));
  page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', message: m.text() }); });
  await page.goto(`${server.url}/?capture=1&motion=1&quality=high&hud=0&dev=0`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAYER__, { timeout: READY_TIMEOUT_MS });
  previous = await page.evaluate(() => ({ exists: Object.hasOwn(window, '__ATMO_HIDE__'), value: window.__ATMO_HIDE__ }));
  await page.evaluate(() => {
    window.__astraLanternReady = 'pending';
    window.__ZR__.ready().then(() => { window.__astraLanternReady = 'ready'; }, e => {
      window.__astraLanternReady = `error: ${e?.message ?? e}`;
    });
  });
  await page.waitForFunction(() => window.__astraLanternReady !== 'pending', { timeout: READY_TIMEOUT_MS, polling: 1000 });
  assert.equal(await page.evaluate(() => window.__astraLanternReady), 'ready');
  ready = true;
  report.setup = await page.evaluate(async () => {
    const api = window.__ZR__, player = window.__ZR_PLAYER__;
    delete window.__ATMO_HIDE__;
    player.reset(); api.setTime(12.5);
    player.input({ moveX: 0, moveZ: 0, run: false, jump: false }); player.advance(0.5);
    const [x, y, z] = api.audit().layout.lanternBranch.mid;
    const podY = y - 0.29 * 0.9 - 1.2 - 0.2;
    api.setPose([x + 1, podY + 0.18, z + 1.2], [x, podY + 0.05, z], 35);
    await api.render(2, 0);
    const gl = document.querySelector('canvas')?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return { camera: api.cameraPose(), simTime: api.stats().simTime,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown' };
  });
  const cases = [
    { id: '01-baseline', hidden: [] },
    { id: '02-branch-light-hidden', hidden: ['branch-lantern-light'] },
    { id: '03-restored', hidden: [] },
  ];
  for (const c of cases) {
    console.log(`Rendering ${c.id}`);
    await page.evaluate(async hidden => {
      if (hidden.length) window.__ATMO_HIDE__ = hidden;
      else delete window.__ATMO_HIDE__;
      await window.__ZR__.render(2, 0);
    }, c.hidden);
    const { png, stats, retries } = await captureCanvas(c.id);
    const state = await page.evaluate(() => ({ camera: window.__ZR__.cameraPose(), stats: window.__ZR__.stats(),
      audit: window.__ZR__.audit(), hidden: window.__ATMO_HIDE__ ?? [] }));
    assert.deepEqual(state.hidden, c.hidden);
    assert.deepEqual(state.camera, report.setup.camera);
    assert.equal(state.stats.simTime, report.setup.simTime);
    assert.deepEqual(state.audit.systemFailures, []);
    const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
    const file = `${c.id}.jpg`; fs.writeFileSync(path.join(out, file), jpg);
    report.captures.push({ ...c, ...state, file, source: report.source, capturedAt: new Date().toISOString(), retries,
      rendererPngSha256: sha256(png), sha256: sha256(jpg), channels: stats.channels.slice(0, 3) });
  }
  report.baselineRestoredIdentical = report.captures[0].rendererPngSha256 === report.captures[2].rendererPngSha256;
  assert.deepEqual(report.errors.filter(e => e.kind === 'pageerror' || /WebGL|shader|GL_INVALID|program info log/i.test(e.message)), []);
  report.status = 'complete';
} catch (e) {
  failure = e; report.status = 'failed'; report.errors.push({ kind: 'capture', message: e.stack ?? String(e) });
} finally {
  if (page && previous) {
    try {
      report.restored = await page.evaluate(async ({ previous, ready }) => {
        if (previous.exists) window.__ATMO_HIDE__ = previous.value;
        else delete window.__ATMO_HIDE__;
        delete window.__astraLanternReady;
        if (ready) await window.__ZR__.render(1, 0);
        return { exists: Object.hasOwn(window, '__ATMO_HIDE__'), value: window.__ATMO_HIDE__ ?? null };
      }, { previous, ready });
    } catch (e) { report.errors.push({ kind: 'restore', message: String(e) }); failure ??= e; report.status = 'failed'; }
  }
  for (const r of await Promise.allSettled([browser?.close(), server?.close()])) {
    if (r.status === 'rejected') { failure ??= r.reason; report.errors.push({ kind: 'cleanup', message: String(r.reason) }); report.status = 'failed'; }
  }
  report.capturedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'lantern-study.json'), JSON.stringify(report, null, 2));
}
if (failure) throw failure;
