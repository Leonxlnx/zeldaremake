#!/usr/bin/env node
/**
 * capture.mjs — record what the player actually hears, and check the offline twin against it.
 *
 *   node art/audio/2026-09-24-live-capture/capture.mjs --dist dist --out /tmp/live [--seconds 20]
 *
 * Every other measurement on this lane comes from `renderOffline`: the same graph rebuilt in an
 * `OfflineAudioContext`, driven by a scripted walk against a perfect clock. That is exact and fast
 * and it is a TWIN — it is not the thing the owner hears. The live graph differs in ways that could
 * matter: its parameters are driven from an animation frame at whatever rate the browser gives it,
 * its gust comes from the world rather than a formula, its footsteps fire on the gait's real boot
 * plants rather than an integrated stride, and its per-event voices are built and torn down against
 * a wall clock.
 *
 * This drives the real build in play mode, walks Link with held keys, and records the master bus
 * through a `MediaStreamDestination` while he walks. The result is WebM/Opus — decoded to WAV with
 * ffmpeg by the caller — and it is the only artefact on this lane that is not a reconstruction.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/live-capture');
const seconds = Number(args.seconds ?? 20);
const DT = 1 / 60;
const log = (...m) => console.error('[live]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('console', (m) => {
    if (m.type() === 'error') log('[page error]', m.text());
    if (m.text().startsWith('[audio]')) log(m.text());
  });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  log('world ready');
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));

  // stand on the plaza, then walk north over the flagstones while the master is recorded
  await page.evaluate(() => window.__ZR_PLAY__.place(1.5, -8, Math.PI));
  await new Promise((r) => setTimeout(r, 400));
  const started = page.evaluate((s) => window.__ZR_AUDIO__.record(s).then((b) => {
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < b.length; i += CH) bin += String.fromCharCode(...b.subarray(i, i + CH));
    return btoa(bin);
  }), seconds);
  // Frames are stepped for the WHOLE capture, standing included. In a headless page nothing asks
  // for an animation frame unless the harness does, and the audio system runs its parameter update
  // and its music scheduler on one — so without this the first seconds of the recording are digital
  // silence, which is the harness and not the game. (A visible browser animates continuously.)
  // bounded by the WALL CLOCK, not by a frame count: the recorder runs in real time and this page
  // does not animate at 60 Hz, so a fixed number of frames does not take a known number of seconds
  const stepFor = (ms) =>
    page.evaluate(
      async (until, dt) => {
        const t0 = performance.now();
        while (performance.now() - t0 < until) {
          window.__ZR_PLAY__.step(1, dt, false);
          await new Promise((r) => requestAnimationFrame(r));
        }
      },
      ms,
      DT,
    );
  await stepFor(3000);
  await page.keyboard.down('KeyW');
  await stepFor((seconds - 3.4) * 1000);
  await page.keyboard.up('KeyW');
  const b64 = await started;
  const stats = await page.evaluate(() => window.__ZR_AUDIO__.stats());
  // the offline twin from the SAME page load, so the two cannot differ by build or by scene
  const offline = await page.evaluate(async () => {
    const r = await window.__ZR_AUDIO__.renderOffline(45, 44100, { stem: 'mix' });
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < r.wav.length; i += CH) bin += String.fromCharCode(...r.wav.subarray(i, i + CH));
    return btoa(bin);
  });
  fs.writeFileSync(path.join(out, 'offline-mix.wav'), Buffer.from(offline, 'base64'));
  const file = path.join(out, 'live.webm');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(stats, null, 2));
  log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} kB) — ${stats.steps} steps, ${stats.birds} birds, ${stats.flutters} leaf flutters while recording`);
} finally {
  await browser.close();
  await server.close();
}
