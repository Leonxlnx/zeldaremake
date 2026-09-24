#!/usr/bin/env node
/**
 * startup-probe.mjs — why is the live graph silent for the first seconds?
 *
 *   node art/audio/2026-09-24-live-capture/startup-probe.mjs --dist dist [--out /tmp/startup]
 *
 * `capture.mjs` found the live master sitting at −92 dBFS for about five seconds after the audio
 * starts, where the offline twin built from the same page is at full level from t = 0. That could
 * be a start-up ramp nobody hears about, or it could be the bed and the music not sounding at all
 * until a footstep wakes something — which would be a real bug, because a player who starts the
 * game and stands still would hear nothing.
 *
 * This stands Link completely still for the whole take, pumps frames the entire time, records the
 * master, and samples the state every 100 ms: the context clock, the world's gust as the bed sees
 * it, and the event counters. Correlating the recording's level against those says which it is.
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
const out = path.resolve(args.out || '/tmp/startup');
const seconds = Number(args.seconds ?? 20);
const log = (...m) => console.error('[startup]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('console', (m) => {
    if (m.text().startsWith('[audio]')) log(m.text());
    if (m.type() === 'error') log('[page error]', m.text());
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  await page.evaluate(() => window.__ZR_PLAY__.place(1.5, -8, Math.PI));
  log('world ready; starting audio and recording immediately, Link standing still throughout');

  // start the audio and the recording, then pump frames and sample — all inside one page task so
  // nothing waits on a round trip
  const result = await page.evaluate(async (secs) => {
    const samples = [];
    // the gesture the browser needs before an AudioContext may run
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', bubbles: true }));
    // wait for the context to exist, pumping frames
    const t0 = performance.now();
    while (!window.__ZR_AUDIO__.stats()?.state || window.__ZR_AUDIO__.stats().state === 'idle') {
      window.__ZR_PLAY__.step(1, 1 / 60, false);
      await new Promise((r) => requestAnimationFrame(r));
      if (performance.now() - t0 > 8000) break;
    }
    const started = performance.now();
    const rec = window.__ZR_AUDIO__.record(secs).then((b) => {
      let bin = '';
      const CH = 0x8000;
      for (let i = 0; i < b.length; i += CH) bin += String.fromCharCode(...b.subarray(i, i + CH));
      return btoa(bin);
    });
    let next = 0;
    while (performance.now() - started < secs * 1000) {
      window.__ZR_PLAY__.step(1, 1 / 60, false);
      const ms = performance.now() - started;
      if (ms >= next) {
        const s = window.__ZR_AUDIO__.stats();
        samples.push([Number((ms / 1000).toFixed(2)), Number((s.contextTime ?? 0).toFixed(2)), Number((s.gust ?? 0).toFixed(3)), s.steps, s.birds, s.flutters, s.voices]);
        next += 100;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { b64: await rec, samples, gestureToStart: Math.round(started - t0) };
  }, seconds);

  fs.writeFileSync(path.join(out, 'startup.webm'), Buffer.from(result.b64, 'base64'));
  fs.writeFileSync(path.join(out, 'samples.json'), JSON.stringify(result.samples));
  log(`audio took ${result.gestureToStart} ms from the gesture to running; ${result.samples.length} samples`);
  log('t  ctx  gust  steps birds flutters voices');
  for (const r of result.samples.filter((_, i) => i % 10 === 0)) log(r.join('  '));
} finally {
  await browser.close();
  await server.close();
}
