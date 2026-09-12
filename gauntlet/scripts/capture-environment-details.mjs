#!/usr/bin/env node
/** Four production world closeups through the existing deterministic capture API. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';
import { hashDir } from './capture.mjs';
import { digest, sourceIdentity, assertRenderedControls, assertStableCaptureState } from './environment-capture-data.mjs';
import { DETAIL_SCHEMA, DETAIL_VIEWS, DETAIL_CONTROLS, loadDetailAnchors, detailPose, assertDetailCamera,
  detailsReadme, readCompletedDetails } from './environment-detail-data.mjs';

const out = path.join(ROOT, 'gauntlet/out/astra-environment-details');
const dist = path.join(ROOT, 'dist');
const anchors = loadDetailAnchors(ROOT);
const sourceBefore = sourceIdentity(ROOT);
if (process.env.GITHUB_SHA) assert.equal(sourceBefore.source, process.env.GITHUB_SHA);
assert(fs.existsSync(path.join(dist, 'index.html')), 'Build this committed source before capture');
fs.mkdirSync(out, { recursive: true });
assert.equal(fs.readdirSync(out).length, 0, 'Use an empty output directory; preserve prior attempts');
const report = { schema: DETAIL_SCHEMA, ...sourceBefore, sourceBefore, sourceAfter: null,
  distHash: hashDir(dist), distHashAfter: null, status: 'running', startedAt: new Date().toISOString(),
  capturedAt: null, width: 1280, height: 720, quality: 'high', hud: false, time: 12.5,
  // ready() waits for world construction; setPose refreshes LODs, and each
  // step(0) poses the world at setTime. Composer passes have no temporal history.
  settleFrames: 2, settleDt: 0, controls: DETAIL_CONTROLS, anchors, views: DETAIL_VIEWS, captures: [], errors: [], warnings: [], restored: false,
  rendererMemoryObservations: [],
  auditCaveats: 'Requested hooks are checked against light objects and the composer settings snapshot used by the last render. These are actual source controls, not independent GPU pixel measurements of irradiance or color.',
  captureScope: 'Complete production scene, fixed layout-relative detail cameras and time. No gauntlet score, saved-camera comparison or production approval is implied.' };
let server, browser, page, previous, failure;

async function state() {
  return page.evaluate(() => ({ camera: window.__ZR__.cameraPose(), stats: window.__ZR__.stats(),
    audit: window.__ZR__.audit(), controls: { light: window.__ATMO_LIGHT__ ?? null, post: window.__ATMO_SETTINGS__ ?? null } }));
}
async function capture(label) {
  const canvas = await page.$('canvas'); assert(canvas);
  for (let retries = 0; retries <= 3; retries++) {
    const before = await state();
    const png = Buffer.from(await canvas.screenshot({ type: 'png' }));
    const stats = await sharp(png).stats();
    const after = await state();
    const memory = assertStableCaptureState(before, after, `${label}: screenshot must not advance state`);
    report.rendererMemoryObservations.push({ label, attempt: retries, operation: 'screenshot', ...memory });
    if (Math.max(...stats.channels.slice(0, 3).map(c => c.stdev)) > 2) return { png, retries, state: after };
    assert(retries < 3, `${label}: uniform renderer buffer after three same-state retries`);
    console.log(`${label}: retrying uniform buffer at unchanged state`);
    await page.evaluate(() => window.__ZR__.render(2, 0));
    const retryMemory = assertStableCaptureState(before, await state(), `${label}: retry changed state`);
    report.rendererMemoryObservations.push({ label, attempt: retries, operation: 'same-state-retry', ...retryMemory });
  }
}
async function measurements(png) {
  const depth = await page.evaluate(() => {
    const d = window.__ZR__.depthImage(null, 80, 45);
    return { width: d.width, height: d.height, data: Array.from(d.data, v => Number.isFinite(v) ? v : null) };
  });
  assert.equal(depth.data.length, 3600);
  assert(depth.data.every(v => v === null || (Number.isFinite(v) && v >= 0)));
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, report.width); assert.equal(metadata.height, report.height);
  return { ...depth, sha256: digest(JSON.stringify(depth)),
    basis: 'Existing depthImage API, top-left row-major view distance in metres; null is sky' };
}

try {
  server = await serveStatic(dist); browser = await launchBrowser({ width: report.width, height: report.height });
  page = await browser.newPage();
  page.on('pageerror', e => report.errors.push({ kind: 'pageerror', message: e.message }));
  page.on('console', m => {
    if (m.type() === 'error') report.errors.push({ kind: 'console', message: m.text() });
    if (m.type() === 'warning') report.warnings.push(m.text());
  });
  await page.goto(`${server.url}/?capture=1&dev=0&quality=high&hud=0`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS });
  previous = await page.evaluate(() => Object.fromEntries(['__ATMO_LIGHT__', '__ATMO_SETTINGS__'].map(k => [k, { exists: Object.hasOwn(window, k), value: window[k] ?? null }])));
  await page.evaluate(() => {
    window.__astraEnvironmentDetailsReady = 'pending';
    window.__ZR__.ready().then(() => { window.__astraEnvironmentDetailsReady = 'ready'; }, e => { window.__astraEnvironmentDetailsReady = String(e); });
  });
  await page.waitForFunction(() => window.__astraEnvironmentDetailsReady !== 'pending', { polling: 1000, timeout: READY_TIMEOUT_MS });
  assert.equal(await page.evaluate(() => window.__astraEnvironmentDetailsReady), 'ready');
  report.renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  for (const view of DETAIL_VIEWS) {
    const anchor = anchors.find(a => a.id === view.anchor);
    const groundProbe = await page.evaluate(([x, z]) => window.__ZR__.probe(x, z), anchor.position);
    const requestedPose = detailPose(view, anchor, groundProbe.height);
    const file = `${view.id}.jpg`, started = Date.now();
    console.log(`Rendering ${file} at t=${report.time}`);
    await page.evaluate(async ({ pose, time, frames }) => {
      delete window.__ATMO_LIGHT__; delete window.__ATMO_SETTINGS__;
      window.__ZR__.setPose(pose.position, pose.target, pose.fov);
      window.__ZR__.setTime(time); await window.__ZR__.render(frames, 0);
    }, { pose: requestedPose, time: report.time, frames: report.settleFrames });
    const captured = await capture(file), s = captured.state;
    // Preserve the real image even when a later audit fails; failed bundles never publish.
    const jpg = await sharp(captured.png).jpeg({ quality: 92 }).toBuffer();
    fs.writeFileSync(path.join(out, file), jpg);
    assert.equal(s.stats.simTime, report.time); assert.deepEqual(s.audit.systemFailures, []);
    assert.deepEqual(s.audit.scene.forbidden, []);
    assert.deepEqual(s.controls, DETAIL_CONTROLS); assertRenderedControls(s.audit, DETAIL_CONTROLS);
    assertDetailCamera(s.camera, requestedPose);
    const depth = await measurements(captured.png);
    const afterDepth = await state();
    // depthImage performs a diagnostic full-screen draw, so draw counters change;
    // camera, simulation, controls and world audits must remain unchanged.
    const worldState = ({ camera, audit, controls, stats }) => ({ camera, audit, controls, simTime: stats.simTime });
    assert.deepEqual(worldState(afterDepth), worldState(s), `${file}: depth read changed world state`);
    report.captures.push({ source: report.source, viewpoint: view.id, file, sha256: digest(jpg),
      groundProbe, requestedPose, state: s, depth, depthReadStats: afterDepth.stats,
      retries: captured.retries, captureMs: Date.now() - started });
    fs.writeFileSync(path.join(out, 'details.json'), JSON.stringify(report, null, 2));
  }
  assert.deepEqual(report.errors, [], 'No page or console errors');
} catch (e) { failure = e; report.errors.push({ kind: 'capture', message: e.stack ?? String(e) }); }
finally {
  if (page && previous) try {
    report.restored = await page.evaluate(previous => {
      for (const [key, saved] of Object.entries(previous)) {
        if (saved.exists) window[key] = saved.value; else delete window[key];
      }
      delete window.__astraEnvironmentDetailsReady;
      return Object.entries(previous).every(([key, saved]) => Object.hasOwn(window, key) === saved.exists && (!saved.exists || JSON.stringify(window[key]) === JSON.stringify(saved.value)));
    }, previous);
  } catch (e) { failure ??= e; report.errors.push({ kind: 'restore', message: String(e) }); }
  for (const r of await Promise.allSettled([browser?.close(), server?.close()])) if (r.status === 'rejected') {
    failure ??= r.reason; report.errors.push({ kind: 'cleanup', message: String(r.reason) });
  }
  try {
    report.sourceAfter = sourceIdentity(ROOT); report.distHashAfter = hashDir(dist);
    assert.deepEqual(report.sourceAfter, sourceBefore); assert.equal(report.distHashAfter, report.distHash); assert(report.restored);
  } catch (e) { failure ??= e; report.errors.push({ kind: 'identity', message: String(e) }); }
  report.capturedAt = new Date().toISOString(); report.status = failure ? 'failed' : 'complete';
  fs.writeFileSync(path.join(out, 'details.json'), JSON.stringify(report, null, 2));
  if (!failure) fs.writeFileSync(path.join(out, 'README.md'), detailsReadme(report));
}
if (failure) throw failure;
readCompletedDetails(out, report.source);
console.log(`Completed four original environment detail views for ${report.source}`);
