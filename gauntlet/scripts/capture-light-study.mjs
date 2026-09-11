#!/usr/bin/env node
/** Supplemental full-world lighting comparisons. Run after npm run build; never changes defaults. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { Color } from 'three';
import { ROOT, serveStatic, launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';
import { gitInfo, hashDir, sha256 } from './capture.mjs';

const SIM_TIME = 12.633333;
const SETTLE_FRAMES = 8;
const WIDTH = 1280, HEIGHT = 720;
const VIEWS = ['A_stairs', 'B_house'];
const CASES = [
  { id: 'baseline', label: 'Production lighting, override absent', overrides: null },
  { id: 'warm-key', label: 'Stronger existing golden sun with reduced ambient fill',
    overrides: { sunIntensity: 3.5, hemiIntensity: 0.80, environmentIntensity: 0.48 } },
  { id: 'neutral-shade', label: 'Restrained neutral sky fill with a small increase in sun',
    overrides: { sunIntensity: 3.15, hemiIntensity: 0.95, environmentIntensity: 0.55, hemiSky: 0xdedfd8 } },
];
const out = path.join(ROOT, 'gauntlet/out/astra-lighting');
const dist = path.join(ROOT, 'dist');
fs.mkdirSync(out, { recursive: true });
const git = gitInfo();
const report = {
  source: git.sha, git, distHash: hashDir(dist), startedAt: new Date().toISOString(), capturedAt: null,
  status: 'running', width: WIDTH, height: HEIGHT, quality: 'high', hud: false,
  simTime: SIM_TIME, settleFrames: SETTLE_FRAMES, settleDt: 0, cases: CASES, captures: [], errors: [],
  note: 'Supplemental concept study using the existing __ATMO_LIGHT__ hook. No production default, camera, layout, fog, exposure, shader, rubric or reference changes. The warm-key case changes intensity balance, not sun colour.',
  auditCaveats: {
    'systems.lighting.environmentIntensity': 'Reports the production default even during overrides. requestedEffectiveLighting derives the override value from the existing hook; it is not an independent scene measurement.',
    'systems.lighting.hemiSkyLinear': 'Reports the production default even during overrides. requestedEffectiveLighting derives the override colour in linear RGB; it is not an independent scene measurement.',
  },
  restored: null,
};
let server, browser, page, previousOverride, ready = false;
let failure;

async function imageStats(png) {
  const channelStats = await sharp(png).stats();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const histogram = new Uint32Array(256);
  let sum = 0, white = 0, clipped = 0, dark = 0, highLuma = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    histogram[Math.round(luma * 255)]++; sum += luma;
    if (Math.min(r, g, b) >= 245) white++;
    if (Math.max(r, g, b) >= 254) clipped++;
    if (luma <= 0.05) dark++;
    if (luma >= 0.9) highLuma++;
  }
  const percentile = fraction => {
    let count = 0;
    for (let i = 0; i < histogram.length; i++) {
      count += histogram[i];
      if (count >= pixels * fraction) return i / 255;
    }
    return 1;
  };
  return {
    basis: 'Lossless renderer canvas PNG, display-space RGB/luma; no linear-light luminance claim',
    width: info.width, height: info.height,
    channels: channelStats.channels.slice(0, 3).map(({ min, max, mean, stdev }) => ({ min, max, mean, stdev })),
    maxChannelStdDev: Math.max(...channelStats.channels.slice(0, 3).map(c => c.stdev)),
    meanDisplayLuma: sum / pixels, displayLumaP10: percentile(0.1), displayLumaP50: percentile(0.5),
    displayLumaP90: percentile(0.9), displayLumaP99: percentile(0.99),
    nearWhiteFraction: white / pixels, channelClippedFraction: clipped / pixels,
    highDisplayLumaFraction: highLuma / pixels, darkFraction: dark / pixels,
  };
}

async function captureCanvas(label) {
  const canvas = await page.$('canvas');
  assert.ok(canvas, 'Renderer canvas exists');
  for (let attempt = 0; attempt <= 3; attempt++) {
    const png = Buffer.from(await canvas.screenshot({ type: 'png' }));
    const stats = await imageStats(png);
    if (stats.maxChannelStdDev > 2) return { png, stats, retries: attempt };
    assert.ok(attempt < 3, `${label}: uniform renderer buffer after three retries`);
    console.log(`${label}: uniform buffer; rendering the same state again (${attempt + 1}/3)`);
    await page.evaluate(() => window.__ZR__.render(2, 0));
  }
}

try {
  assert.ok(git.sha, 'Source commit is known');
  assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Run npm run build before the lighting study');
  server = await serveStatic(dist);
  browser = await launchBrowser({ width: WIDTH, height: HEIGHT });
  page = await browser.newPage();
  page.on('pageerror', error => report.errors.push({ kind: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push({ kind: 'console', message: message.text() });
  });
  await page.goto(`${server.url}/?capture=1&dev=0&quality=high&hud=0`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS });
  previousOverride = await page.evaluate(() => ({ exists: Object.hasOwn(window, '__ATMO_LIGHT__'), value: window.__ATMO_LIGHT__ }));
  // Poll readiness so a slow first compile does not exceed one long CDP call's timeout.
  await page.evaluate(() => {
    window.__astraLightingReady = 'pending';
    window.__ZR__.ready().then(() => { window.__astraLightingReady = 'ready'; }, error => {
      window.__astraLightingReady = `error: ${error?.message ?? error}`;
    });
  });
  await page.waitForFunction(() => window.__astraLightingReady !== 'pending', { timeout: READY_TIMEOUT_MS, polling: 1000 });
  assert.equal(await page.evaluate(() => window.__astraLightingReady), 'ready');
  ready = true;
  report.renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas')?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });

  for (const viewpoint of VIEWS) {
    let baseline;
    for (const study of CASES) {
      const started = Date.now();
      const label = `${study.id}-${viewpoint}`;
      console.log(`Rendering ${label} at fixed t=${SIM_TIME}s`);
      await page.evaluate(async ({ viewpoint, overrides, time, frames }) => {
        const api = window.__ZR__;
        delete window.__ATMO_LIGHT__;
        if (overrides !== null) window.__ATMO_LIGHT__ = { ...overrides };
        if (!api.setViewpoint(viewpoint)) throw new Error(`Unknown viewpoint ${viewpoint}`);
        api.setTime(time);
        await api.render(frames, 0);
      }, { viewpoint, overrides: study.overrides, time: SIM_TIME, frames: SETTLE_FRAMES });
      const { png, stats, retries } = await captureCanvas(label);
      const state = await page.evaluate(() => ({
        audit: window.__ZR__.audit(), stats: window.__ZR__.stats(), camera: window.__ZR__.cameraPose(),
        override: window.__ATMO_LIGHT__ ?? null,
      }));
      assert.equal(state.stats.simTime, SIM_TIME, `${label}: simulation time stays fixed`);
      assert.deepEqual(state.audit.systemFailures, [], `${label}: complete world`);
      assert.deepEqual(state.override, study.overrides, `${label}: exact override state`);
      assert.equal(stats.width, WIDTH); assert.equal(stats.height, HEIGHT);
      const light = state.audit.systems.lighting;
      if (study.overrides) {
        assert.equal(light.sunIntensity, study.overrides.sunIntensity, 'Sun intensity hook applied');
        assert.equal(light.hemiIntensity, study.overrides.hemiIntensity, 'Hemisphere intensity hook applied');
        assert.deepEqual(state.camera, baseline.camera, 'Saved camera is identical across lighting cases');
      }
      const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
      const file = `${label}.jpg`;
      fs.writeFileSync(path.join(out, file), jpg);
      const capture = {
        source: git.sha, viewpoint, case: study.id, label: study.label, file, capturedAt: new Date().toISOString(),
        overrides: study.overrides, simTime: SIM_TIME, retries, captureMs: Date.now() - started,
        sha256: sha256(jpg), rendererPngSha256: sha256(png), imageStats: stats, ...state,
        requestedEffectiveLighting: {
          sunIntensity: light.sunIntensity, hemiIntensity: light.hemiIntensity,
          environmentIntensity: study.overrides?.environmentIntensity ?? light.environmentIntensity,
          hemiSkyLinear: study.overrides?.hemiSky !== undefined ? new Color(study.overrides.hemiSky).toArray() : light.hemiSkyLinear,
          hemiSkyOverrideHex: study.overrides?.hemiSky !== undefined ? `#${study.overrides.hemiSky.toString(16).padStart(6, '0')}` : null,
        },
        deltaFromBaseline: baseline ? {
          meanDisplayLuma: stats.meanDisplayLuma - baseline.imageStats.meanDisplayLuma,
          nearWhiteFraction: stats.nearWhiteFraction - baseline.imageStats.nearWhiteFraction,
          channelClippedFraction: stats.channelClippedFraction - baseline.imageStats.channelClippedFraction,
          highDisplayLumaFraction: stats.highDisplayLumaFraction - baseline.imageStats.highDisplayLumaFraction,
          darkFraction: stats.darkFraction - baseline.imageStats.darkFraction,
        } : null,
      };
      report.captures.push(capture);
      if (study.id === 'baseline') baseline = capture;
      console.log(`${file}: mean display luma ${stats.meanDisplayLuma.toFixed(4)}, near-white ${(100 * stats.nearWhiteFraction).toFixed(3)}%, ${state.stats.drawCalls} draws`);
    }
  }
  const rendererErrors = report.errors.filter(e => e.kind === 'pageerror' || /WebGL|shader|GL_INVALID|program info log/i.test(e.message));
  assert.deepEqual(rendererErrors, [], 'No renderer or page failures; all console errors remain recorded');
  report.status = 'complete';
} catch (error) {
  failure = error;
  report.status = 'failed';
  report.errors.push({ kind: 'capture', message: error.stack ?? String(error) });
} finally {
  if (page && previousOverride) {
    try {
      report.restored = await page.evaluate(async ({ previous, ready }) => {
        if (previous.exists) window.__ATMO_LIGHT__ = previous.value;
        else delete window.__ATMO_LIGHT__;
        delete window.__astraLightingReady;
        if (ready) await window.__ZR__.render(1, 0);
        return { overridePresent: Object.hasOwn(window, '__ATMO_LIGHT__'), lightingAudit: ready ? window.__ZR__.audit().systems.lighting : null };
      }, { previous: previousOverride, ready });
    } catch (error) {
      report.errors.push({ kind: 'restore', message: String(error) });
      report.status = 'failed'; failure ??= error;
    }
  }
  const cleanup = await Promise.allSettled([browser?.close(), server?.close()]);
  for (const result of cleanup) if (result.status === 'rejected') {
    report.errors.push({ kind: 'cleanup', message: String(result.reason) });
    report.status = 'failed'; failure ??= result.reason;
  }
  report.capturedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'lighting.json'), JSON.stringify(report, null, 2));
}
if (failure) throw failure;
