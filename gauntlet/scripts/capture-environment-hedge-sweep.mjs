#!/usr/bin/env node
/** Supplemental full-scene PNG samples; named hedge/middepth modes, CI only, no score. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';
import { hashDir } from './capture.mjs';
import { digest, sourceIdentity, assertRenderedControls, assertStableCaptureState } from './environment-capture-data.mjs';
import { assertDetailCamera } from './environment-detail-data.mjs';
import { SWEEP_SCHEMA, SWEEP_CONTROLS, SWEEP_TIME, loadHedgeSweep } from './environment-hedge-sweep-data.mjs';
import { MIDDEPTH_SCHEMA, MIDDEPTH_SCOPE, loadMiddepthSweep, assertMiddepthShade } from './environment-middepth-sweep-data.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This sweep runs only on the opted-in GitHub CI job');
const args = process.argv.slice(2); assert(args.length === 0 || args.length === 1 && args[0] === '--middepth', 'Only the named --middepth alternative is supported');
const middepth = args[0] === '--middepth';
const out = path.join(ROOT, `gauntlet/out/astra-environment-${middepth ? 'middepth' : 'hedge'}-sweep`), dist = path.join(ROOT, 'dist');
const sourceBefore = sourceIdentity(ROOT); assert.equal(sourceBefore.source, process.env.GITHUB_SHA);
assert(fs.existsSync(path.join(dist, 'index.html'))); fs.mkdirSync(out, { recursive: true });
assert.equal(fs.readdirSync(out).length, 0, 'Preserve prior attempts; use an empty output directory');
const plan = middepth ? loadMiddepthSweep(ROOT) : loadHedgeSweep(ROOT);
const report = { schema: middepth ? MIDDEPTH_SCHEMA : SWEEP_SCHEMA, ...sourceBefore, sourceBefore, sourceAfter: null,
  distHash: hashDir(dist), distHashAfter: null, status: 'running', startedAt: new Date().toISOString(),
  time: SWEEP_TIME, width: 1280, height: 720, quality: 'high', hud: false, settleFrames: 2, settleDt: 0,
  controls: SWEEP_CONTROLS, plan, frames: [], repeatedPoses: [], errors: [], warnings: [], restored: false,
  scope: middepth ? MIDDEPTH_SCOPE : 'Actual full-scene camera samples, original PNG bytes. Fixed simulation/light controls; ordinary setPose forces LOD rebucketing. Not an interactive hysteresis timing test, benchmark or gauntlet score.' };
const save = () => fs.writeFileSync(path.join(out, 'sweep.json'), JSON.stringify(report, null, 2)); save();
let server, browser, page, previous, failure, lightControls;
const state = () => page.evaluate(() => ({ camera: window.__ZR__.cameraPose(), stats: window.__ZR__.stats(),
  audit: window.__ZR__.audit(), controls: { light: window.__ATMO_LIGHT__ ?? null, post: window.__ATMO_SETTINGS__ ?? null } }));
try {
  server = await serveStatic(dist); browser = await launchBrowser({ width: report.width, height: report.height });
  page = await browser.newPage();
  page.on('pageerror', e => report.errors.push({ kind: 'pageerror', message: e.message }));
  page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', message: m.text() });
    if (m.type() === 'warning') report.warnings.push(m.text()); });
  await page.goto(`${server.url}/?capture=1&dev=0&quality=high&hud=0`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS });
  previous = await page.evaluate(() => Object.fromEntries(['__ATMO_LIGHT__', '__ATMO_SETTINGS__'].map(k => [k, { exists: Object.hasOwn(window, k), value: window[k] ?? null }])));
  await page.evaluate(() => { window.__astraHedgeSweepReady = 'pending'; window.__ZR__.ready().then(
    () => { window.__astraHedgeSweepReady = 'ready'; }, e => { window.__astraHedgeSweepReady = String(e); }); });
  await page.waitForFunction(() => window.__astraHedgeSweepReady !== 'pending', { polling: 1000, timeout: READY_TIMEOUT_MS });
  assert.equal(await page.evaluate(() => window.__astraHedgeSweepReady), 'ready');
  report.renderer = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  for (const requestedPose of plan.frames) {
    await page.evaluate(async ({ pose, time }) => {
      delete window.__ATMO_LIGHT__; delete window.__ATMO_SETTINGS__;
      window.__ZR__.setPose(pose.position, pose.target, pose.fov);
      window.__ZR__.setTime(time); await window.__ZR__.render(2, 0);
    }, { pose: requestedPose, time: report.time });
    const canvas = await page.$('canvas'); assert(canvas);
    let accepted;
    for (let attempt = 0; attempt <= 3; attempt++) {
      const before = await state(), png = Buffer.from(await canvas.screenshot({ type: 'png' })), after = await state();
      const file = `${requestedPose.id}-attempt${attempt}.png`; fs.writeFileSync(path.join(out, file), png);
      const frame = { id: requestedPose.id, attempt, source: report.source, requestedPose, file,
        sha256: digest(png), bytes: png.length, before, state: after, accepted: false };
      report.frames.push(frame); save(); // retain the exact frame before any later assertion fails
      frame.memoryObservation = assertStableCaptureState(before, after, `${file}: screenshot changed state`);
      const dimensions = await sharp(png).metadata(); assert.equal(dimensions.width, report.width); assert.equal(dimensions.height, report.height);
      frame.maxRgbStdDev = Math.max(...(await sharp(png).stats()).channels.slice(0, 3).map(c => c.stdev));
      if (frame.maxRgbStdDev > 2) { accepted = frame; break; }
      assert(attempt < 3, `${file}: uniform buffer after three same-state retries`);
      await page.evaluate(() => window.__ZR__.render(2, 0));
      assertStableCaptureState(before, await state(), `${file}: same-state retry changed state`);
    }
    const s = accepted.state; assert.equal(s.stats.simTime, report.time);
    assert.deepEqual(s.audit.systemFailures, []); assert.deepEqual(s.audit.scene.forbidden, []);
    assert.deepEqual(s.controls, SWEEP_CONTROLS); assertRenderedControls(s.audit, SWEEP_CONTROLS);
    assertDetailCamera(s.camera, requestedPose); assert.equal(s.audit.systems.vegetation.hedge, 12);
    if (middepth) assertMiddepthShade(s.audit, plan);
    const lighting = { light: s.audit.systems.lighting, post: s.audit.systems.atmosphere.postfx.effectiveSettings };
    if (lightControls) assert.deepEqual(lighting, lightControls, 'Light values and rendered composer controls stay fixed');
    else lightControls = lighting;
    const targetPoints = middepth ? plan.anchors.map(a => a.point) : plan.anchors.flatMap(a => [.8, 1.2, 1.6].map(up => [a.root[0], a.root[1] + up, a.root[2]]));
    accepted.targetProjection = await page.evaluate(points => window.__ZR__.project(points), targetPoints);
    accepted.targetPoints = targetPoints;
    const depth = await page.evaluate(() => { const d = window.__ZR__.depthImage(null, 80, 45);
      return { width: d.width, height: d.height, data: Array.from(d.data, v => Number.isFinite(v) ? v : null) }; });
    assert.equal(depth.data.length, 3600); assert(depth.data.every(v => v === null || Number.isFinite(v) && v >= 0));
    accepted.depth = { ...depth, sha256: digest(JSON.stringify(depth)) };
    const afterDepth = await state(); accepted.depthReadStats = afterDepth.stats;
    const worldState = x => ({ camera: x.camera, audit: x.audit, controls: x.controls, simTime: x.stats.simTime });
    assert.deepEqual(worldState(afterDepth), worldState(s), 'Depth read changed world state');
    accepted.accepted = true; save(); console.log(middepth ? `Captured ${accepted.file}; source shade start ${plan.farShade.startM} m` : `Captured ${accepted.file}; expected target LODs ${requestedPose.expectedLods.map(x => x.lod).join('/')}`);
  }
  const accepted = report.frames.filter(f => f.accepted); assert.equal(accepted.length, 11);
  for (let i = 0; i < (middepth ? 0 : 5); i++) { const a = accepted[i], b = accepted[10 - i];
    assert.deepEqual(a.state.camera, b.state.camera);
    report.repeatedPoses.push({ forward: a.id, return: b.id, pngEqual: a.sha256 === b.sha256,
      depthEqual: a.depth.sha256 === b.depth.sha256, auditEqual: digest(JSON.stringify(a.state.audit)) === digest(JSON.stringify(b.state.audit)) }); }
  assert.deepEqual(report.errors, []);
} catch (e) { failure = e; report.errors.push({ kind: 'capture', message: e.stack ?? String(e) }); }
finally {
  if (page && previous) try {
    report.restored = await page.evaluate(previous => { for (const [key, saved] of Object.entries(previous)) {
      if (saved.exists) window[key] = saved.value; else delete window[key]; }
      delete window.__astraHedgeSweepReady;
      return Object.entries(previous).every(([key, saved]) => Object.hasOwn(window, key) === saved.exists && (!saved.exists || JSON.stringify(window[key]) === JSON.stringify(saved.value)));
    }, previous);
  } catch (e) { failure ??= e; report.errors.push({ kind: 'restore', message: String(e) }); }
  for (const r of await Promise.allSettled([browser?.close(), server?.close()])) if (r.status === 'rejected') {
    failure ??= r.reason; report.errors.push({ kind: 'cleanup', message: String(r.reason) }); }
  try { report.sourceAfter = sourceIdentity(ROOT); report.distHashAfter = hashDir(dist);
    assert.deepEqual(report.sourceAfter, sourceBefore); assert.equal(report.distHashAfter, report.distHash); assert(report.restored);
    for (const f of report.frames) assert.equal(digest(fs.readFileSync(path.join(out, f.file))), f.sha256, 'Original frame bytes retained');
  } catch (e) { failure ??= e; report.errors.push({ kind: 'identity', message: String(e) }); }
  report.capturedAt = new Date().toISOString(); report.status = failure ? 'failed' : 'complete'; save();
  fs.writeFileSync(path.join(out, 'README.md'), middepth ? ['# Middle forest distance samples', '',
    `Source: ${report.source}; status: ${report.status}; simulation time: 12.5 s; source shade start: ${plan.farShade.startM} m.`, '',
    MIDDEPTH_SCOPE, '', plan.visibilityLimit, '',
    'Unmodified full-scene PNGs and sweep.json are the evidence. Eleven forward poses span 16 m and take three fixed path/trunk probes across 32–44 m. There are no return-pose pairs. Compare matching 22 m and 32 m source runs before attributing the difference; natural parallax, shadows and distance-selected geometry remain. This can inform provisional art retention, with continuous playback unmeasured. No gauntlet score is changed.', '',
    '| Frame | Original |', '| --- | --- |', ...report.frames.filter(f => f.accepted).map(f => `| ${f.id} | [PNG](${f.file}) |`), ''].join('\n') : ['# Bank hedge LOD sweep', '', `Source: ${report.source}; status: ${report.status}; simulation time: 12.5 s.`, '',
    report.scope, '', plan.lodScope, '', 'Unmodified full-frame PNG originals and sweep.json are the evidence. No derived animation replaces them. Inspect both threshold crossings and their return frames. Source terrain clearance does not prove visibility through the rest of the world; inspect target projections and recorded scene depth. A blocked target makes this view inconclusive.', '',
    '| Frame | Expected bank LODs | Original |', '| --- | --- | --- |',
    ...report.frames.filter(f => f.accepted).map(f => `| ${f.id} | ${f.requestedPose.expectedLods.map(e => e.lod).join(' / ')} | [PNG](${f.file}) |`), '',
    'Expected LOD 0 is high, 1 is mid. Return-pose byte/depth/audit comparisons are recorded without concealing differences. This supplemental artifact does not change phase-exit evidence or publish a gallery.', ''].join('\n'));
}
if (failure) throw failure;
console.log(`Completed eleven original sweep frames for ${report.source}`);
