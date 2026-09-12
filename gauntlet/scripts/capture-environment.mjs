#!/usr/bin/env node
/** Same-source, same-time light/post comparisons through the existing deterministic API. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';
import { hashDir } from './capture.mjs';
import { SCHEMA, VIEWS, CASES, digest, imageName, readJson, validateVariants, sourceIdentity,
  comparisonReadme, readCompletedComparison, assertRenderedControls, assertStableCaptureState } from './environment-capture-data.mjs';

const out = path.join(ROOT, 'gauntlet/out/astra-environment');
const dist = path.join(ROOT, 'dist');
const variants = validateVariants(readJson(path.join(ROOT, 'gauntlet/scripts/environment-variants.json')), ROOT);
const sourceBefore = sourceIdentity(ROOT);
if (process.env.GITHUB_SHA) assert.equal(sourceBefore.source, process.env.GITHUB_SHA);
assert(fs.existsSync(path.join(dist, 'index.html')), 'Build this committed source before capture');
fs.mkdirSync(out, { recursive: true });
assert.equal(fs.readdirSync(out).length, 0, 'Use an empty output directory; preserve prior attempts');
const report = { schema: SCHEMA, ...sourceBefore, sourceBefore, sourceAfter: null,
  distHash: hashDir(dist), distHashAfter: null, status: 'running', startedAt: new Date().toISOString(),
  capturedAt: null, width: 1280, height: 720, quality: 'high', hud: false, time: variants.time,
  // ready() waits for world construction; setViewpoint refreshes LODs, and each
  // step(0) poses the world at setTime. Composer passes have no temporal history.
  settleFrames: 2, settleDt: 0, variants, captures: [], errors: [], warnings: [], restored: false,
  rendererMemoryObservations: [],
  auditCaveats: 'Requested hooks are checked against light objects and the composer settings snapshot used by the last render. These are actual source controls, not independent GPU pixel measurements of irradiance or color.',
  comparisonScope: 'Same actual source/camera/time/geometry/fog; baselineSource identifies historical controls only. No gauntlet score, reference-image comparison or production approval is implied.' };
let server, browser, page, previous, failure;

async function state() {
  return page.evaluate(() => ({ camera: window.__ZR__.cameraPose(), stats: window.__ZR__.stats(),
    audit: window.__ZR__.audit(), controls: { light: window.__ATMO_LIGHT__ ?? null, post: window.__ATMO_SETTINGS__ ?? null } }));
}
function geometryState(s) {
  const { postfx, ...atmosphere } = s.audit.systems.atmosphere;
  return { scene: s.audit.scene, layout: s.audit.layout, character: s.audit.systems.character, atmosphere };
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
  assert.equal(depth.data.length, 80 * 45);
  assert(depth.data.every(v => v === null || (Number.isFinite(v) && v >= 0)));
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, report.width); assert.equal(info.height, report.height);
  const luma = [], sum = [0, 0, 0]; let clipped = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const rgb = [data[i], data[i + 1], data[i + 2]];
    rgb.forEach((v, c) => { sum[c] += v / 255; });
    luma.push((rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722) / 255);
    if (Math.max(...rgb) >= 254) clipped++;
  }
  luma.sort((a, b) => a - b);
  const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * fraction))] : null;
  const reduced = await sharp(png).resize(80, 45).removeAlpha().raw().toBuffer();
  const depthBins = [[0, 12], [12, 25], [25, 45], [45, null]].map(([near, far]) => {
    const values = [], rgb = [0, 0, 0];
    for (let i = 0; i < depth.data.length; i++) {
      const d = depth.data[i]; if (d === null || d < near || (far !== null && d >= far)) continue;
      const c = [reduced[i * 3], reduced[i * 3 + 1], reduced[i * 3 + 2]];
      c.forEach((v, k) => { rgb[k] += v / 255; }); values.push((c[0] * .2126 + c[1] * .7152 + c[2] * .0722) / 255);
    }
    values.sort((a, b) => a - b);
    return { near, far, pixels: values.length, meanRGB: values.length ? rgb.map(v => v / values.length) : null,
      p10: percentile(values, .1), p90: percentile(values, .9) };
  });
  return { depth: { ...depth, sha256: digest(JSON.stringify(depth)), basis: 'Existing depthImage API, top-left row-major view distance in metres; null is sky' },
    imageStats: { basis: 'Display-space RGB/luma from lossless canvas; depth bins use downsampled RGB, not linear radiometry',
      meanRGB: sum.map(v => v / luma.length), p10: percentile(luma, .1), p50: percentile(luma, .5), p90: percentile(luma, .9),
      clippedChannelFraction: clipped / luma.length, depthBins } };
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
    window.__astraEnvironmentReady = 'pending';
    window.__ZR__.ready().then(() => { window.__astraEnvironmentReady = 'ready'; }, e => { window.__astraEnvironmentReady = String(e); });
  });
  await page.waitForFunction(() => window.__astraEnvironmentReady !== 'pending', { polling: 1000, timeout: READY_TIMEOUT_MS });
  assert.equal(await page.evaluate(() => window.__astraEnvironmentReady), 'ready');
  report.viewpoints = await page.evaluate(() => window.__ZR__.viewpoints());
  for (const view of VIEWS) assert(report.viewpoints.some(v => v.id === view));
  report.renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  for (const viewpoint of VIEWS) {
    let baseline;
    for (const variant of CASES) {
      const controls = variants[variant]; const file = imageName(viewpoint, variant); const started = Date.now();
      console.log(`Rendering ${file} at t=${report.time}`);
      await page.evaluate(async ({ viewpoint, controls, time, frames }) => {
        delete window.__ATMO_LIGHT__; delete window.__ATMO_SETTINGS__;
        if (controls.light !== null) window.__ATMO_LIGHT__ = { ...controls.light };
        if (controls.post !== null) window.__ATMO_SETTINGS__ = { ...controls.post };
        if (!window.__ZR__.setViewpoint(viewpoint)) throw new Error(`Missing viewpoint ${viewpoint}`);
        window.__ZR__.setTime(time); await window.__ZR__.render(frames, 0);
      }, { viewpoint, controls, time: report.time, frames: report.settleFrames });
      const captured = await capture(file); const s = captured.state;
      // Keep the actual frame even if a later audit/depth comparison fails. Failed
      // bundles remain CI artifacts and are never accepted by the publisher.
      const jpg = await sharp(captured.png).jpeg({ quality: 92 }).toBuffer(); fs.writeFileSync(path.join(out, file), jpg);
      assert.equal(s.stats.simTime, report.time); assert.deepEqual(s.audit.systemFailures, []);
      assert.deepEqual(s.controls, { light: controls.light, post: controls.post });
      assertRenderedControls(s.audit, controls);
      const metrics = await measurements(captured.png);
      const geometry = geometryState(s);
      if (baseline) {
        assert.deepEqual(s.camera, baseline.state.camera, 'Matched camera');
        assert.deepEqual(geometry, baseline.geometryState, 'Matched geometry, actor and fog state');
        assert.equal(metrics.depth.sha256, baseline.depth.sha256, 'Matched rendered depth');
      }
      const record = { source: report.source, viewpoint, variant, file, sha256: digest(jpg),
        state: s, geometryState: geometry, retries: captured.retries, captureMs: Date.now() - started, ...metrics };
      report.captures.push(record); if (variant === 'baseline') baseline = record;
      fs.writeFileSync(path.join(out, 'environment.json'), JSON.stringify(report, null, 2));
    }
  }
  assert.deepEqual(report.errors, [], 'No page or console errors');
} catch (e) { failure = e; report.errors.push({ kind: 'capture', message: e.stack ?? String(e) }); }
finally {
  if (page && previous) try {
    report.restored = await page.evaluate(previous => {
      for (const [key, saved] of Object.entries(previous)) {
        if (saved.exists) window[key] = saved.value; else delete window[key];
      }
      delete window.__astraEnvironmentReady;
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
  fs.writeFileSync(path.join(out, 'environment.json'), JSON.stringify(report, null, 2));
  if (!failure) fs.writeFileSync(path.join(out, 'README.md'), comparisonReadme(report));
}
if (failure) throw failure;
readCompletedComparison(out, report.source);
console.log(`Completed twelve original environment comparisons for ${report.source}`);
