#!/usr/bin/env node
/**
 * live.mjs — record the real graph running, so the cut is proved where the owner hears it.
 *
 *   node art/audio/2026-09-26-release/live.mjs --dist dist --out /tmp/live/after [--seconds 16]
 *
 * Every number in this folder comes from `renderOffline`: the same graph rebuilt in an
 * `OfflineAudioContext` and driven by a scripted pass against a perfect clock. That is exact, and
 * it is a TWIN. `SFX_TRIM` is set inside `createBuses`, which both paths share, so there is no
 * plausible way for one to have it and the other not — but "no plausible way" is an argument, and
 * this lane's rule is that an argument is not a measurement.
 *
 * So: the real build, in play mode, running north to south over the plaza flagstones with the
 * master bus recorded through a `MediaStreamDestination`. Run either side of the change and
 * compare the footstep peaks (`live.py`). The pulse itself is not measured here — sixteen seconds
 * is far too short a window to resolve a 1.2 Hz beat — only the level, which is what was changed.
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
const out = path.resolve(args.out || '/tmp/live/after');
const seconds = Number(args.seconds ?? 16);
const DT = 1 / 60;
const log = (...m) => console.error('[live]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  log('world ready');
  // two taps on M: the shell starts muted in a headless page, and the second one unmutes
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));

  // the north end of the same plaza spine the offline takes use, facing south down it
  await page.evaluate(() => window.__ZR_PLAY__.place(0, 8, 0));
  await new Promise((r) => setTimeout(r, 400));
  const started = page.evaluate(
    (s) =>
      window.__ZR_AUDIO__.record(s).then((b) => {
        let bin = '';
        for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
        return btoa(bin);
      }),
    seconds,
  );
  // Frames are stepped for the whole capture: a headless page asks for no animation frame unless
  // the harness does, and the audio system's parameter update and music scheduler both ride one.
  // Bounded by the WALL clock, because the recorder runs in real time and this page does not
  // animate at 60 Hz, so a fixed frame count does not take a known number of seconds.
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
  await stepFor(2500);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await stepFor((seconds - 3) * 1000);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  const b64 = await started;
  const stats = await page.evaluate(() => window.__ZR_AUDIO__.stats());
  fs.writeFileSync(path.join(out, 'live.webm'), Buffer.from(b64, 'base64'));
  fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(stats, null, 2));
  log(`wrote ${out}/live.webm — ${stats.steps} steps while recording`);
} finally {
  await browser.close();
  await server.close();
}
