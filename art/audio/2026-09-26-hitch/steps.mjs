#!/usr/bin/env node
/**
 * steps.mjs — how many footsteps survive a frame that runs long?
 *
 *   node art/audio/2026-09-26-hitch/steps.mjs --dist dist --out /tmp/hitch [--seconds 14]
 *
 * `pace.mjs` measures the speed the footstep system is handed. This measures the consequence that
 * cannot be argued with: the number of steps that sound.
 *
 * Under 0.25 m/s `drive` returns before it looks at the gait's stance flags, so a boot planting on
 * such a tick is not sounded at all — it is not quieter, it is absent. A stride is a distance, so
 * the honest unit is steps per metre: the clips say the boot lands every 0.44 m at a walk
 * (`WALK_STEP_M`), which is 2.27 a metre however the frames fall. Anything under that is steps
 * that went missing, and the distance is read from Link himself rather than assumed.
 *
 * The four pacings are `pace.mjs`'s. Nothing in `src/` is instrumented; the counts come from
 * `__ZR_AUDIO__.stats()`, which the lane already publishes for play-mode evidence.
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
const out = path.resolve(args.out || '/tmp/hitch');
const seconds = Number(args.seconds ?? 14);
const label = typeof args.label === 'string' ? args.label : 'steps';
const log = (...m) => console.error('[steps]', ...m);
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
  // two taps on M: the shell starts muted in a headless page, and the second one unmutes
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));
  await page.waitForFunction(() => !!window.__ZR_AUDIO__?.stats?.(), { timeout: READY_TIMEOUT_MS, polling: 250 });
  log('audio up');

  const runs = [];
  for (const mode of ['smooth', 'raf', 'blocking', 'starved']) {
    // the plaza spine, facing south down it: open flagstone, no stairs, no doorway
    await page.evaluate(() => window.__ZR_PLAY__.place(0, 8, 0));
    // let the teleport leave the position history before the boots are counted
    await new Promise((r) => setTimeout(r, 600));
    await page.keyboard.down('KeyW');
    const row = await page.evaluate(
      async ([mode, ms]) => {
        const P = window.__ZR_PLAY__;
        const before = window.__ZR_AUDIO__.stats();
        const from = P.state().link;
        let simClock = 0;
        let lastNow = performance.now();
        const t0 = lastNow;
        let frame = 0;
        let moved = 0;
        let prev = P.state().link;
        const block = (until) => {
          while (performance.now() < until) {
            /* hold the main thread, as a long task does */
          }
        };
        while (performance.now() - t0 < ms) {
          const now = performance.now();
          const rawDt = (now - lastNow) / 1000;
          lastNow = now;
          const dt = Math.min(rawDt, 0.1);
          P.step(1, dt, false);
          simClock += dt;
          frame++;
          // the ground actually covered, summed frame by frame so a curve is not cut across
          const at = P.state().link;
          if (at && prev) moved += Math.hypot(at[0] - prev[0], at[2] - prev[2]);
          prev = at;
          const hitch = frame % 45 === 0;
          if (hitch && mode === 'blocking') block(performance.now() + 300);
          if (hitch && mode === 'starved') await new Promise((r) => setTimeout(r, 300));
          if (mode === 'raf') await new Promise((r) => requestAnimationFrame(r));
          else await new Promise((r) => setTimeout(r, 16));
        }
        const after = window.__ZR_AUDIO__.stats();
        return {
          mode,
          frames: frame,
          simClock,
          wall: (performance.now() - t0) / 1000,
          moved,
          from,
          to: P.state().link,
          steps: after.steps - before.steps,
          gaitSteps: after.gaitSteps - before.gaitSteps,
        };
      },
      [mode, seconds * 1000],
    );
    await page.keyboard.up('KeyW');
    await new Promise((r) => setTimeout(r, 400));
    runs.push(row);
    log(`${mode}: ${row.steps} steps over ${row.moved.toFixed(2)} m (${(row.steps / row.moved).toFixed(3)} a metre), ${row.frames} frames`);
  }
  fs.writeFileSync(path.join(out, `${label}.json`), JSON.stringify({ seconds, runs }, null, 2));
  log(`wrote ${out}/${label}.json`);
} finally {
  await browser.close();
  await server.close();
}
