#!/usr/bin/env node
/**
 * pace.mjs — what speed is the audio told Link is moving at, when a frame runs long?
 *
 *   node art/audio/2026-09-26-hitch/pace.mjs --dist dist --out /tmp/hitch [--seconds 12]
 *
 * The footstep system is never told Link's speed. It DIFFERENCES his position between two of its
 * own ticks and divides by a time, and that quotient picks the step's level, its timbre and the
 * stride to the next one (`strengthFor`, `speed > RUN_SPEED`, `strideFor`). So the whole question
 * is which time it divides by, and the three candidates disagree the moment a frame runs long:
 *
 *   - **wall, clamped** — what ships: `Math.min(0.1, now - lastT)`.
 *   - **wall, true** — the obvious repair, and wrong for the same reason.
 *   - **sim** — the clock Link actually moves on: `world.update(dt, simTime)` advances him, and
 *     `main.ts` clamps THAT dt at 0.1 s as well. Over a long frame he covers 0.1 s of ground no
 *     matter how long the frame really was.
 *
 * This measures all three against the speed he is really travelling at, in the real build, with
 * the real loop, under two kinds of long frame — because they are not the same kind:
 *
 *   - **blocking** (a shader compile, a GC, a texture upload): the main thread is busy, so the
 *     audio's own 30 Hz `setInterval` is held up by exactly the same amount.
 *   - **starved** (a throttled or vsync-stalled rAF): the thread is free, so the audio keeps
 *     ticking at 30 Hz while the sim does not advance at all between most of them.
 *
 * The page-side driver is `main.ts`'s loop verbatim — read `rawDt`, clamp at 0.1, `step`,
 * accumulate — with a hitch injected, so nothing here is a model of the game; it is the game.
 * Nothing in `src/` is instrumented: the probe reads `__ZR_PLAY__.state().link` and counts the
 * simulation time it is itself asking for.
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
const seconds = Number(args.seconds ?? 12);
const log = (...m) => console.error('[pace]', ...m);
fs.mkdirSync(out, { recursive: true });

/** src/audio/index.ts TICK_MS — the audio's own clock */
const TICK_MS = 1000 / 30;

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

  // the plaza spine, facing south down it: open flagstone, no stairs, no doorway
  await page.evaluate(() => window.__ZR_PLAY__.place(0, 8, 0));

  const runs = [];
  for (const mode of ['smooth', 'raf', 'blocking', 'starved', 'burst']) {
    await page.evaluate(() => window.__ZR_PLAY__.place(0, 8, 0));
    await new Promise((r) => setTimeout(r, 200));
    await page.keyboard.down('KeyW');
    const rows = await page.evaluate(
      async ([mode, ms, tickMs]) => {
        const P = window.__ZR_PLAY__;
        // The audio's clock: a 30 Hz setInterval, exactly as `mountAudio` starts one. A blocking
        // frame holds this up too, which is the whole difference between the two hitch kinds.
        let simClock = 0;
        const ticks = [];
        const probe = setInterval(() => {
          const l = P.state().link;
          ticks.push([performance.now(), l ? l[0] : NaN, l ? l[2] : NaN, simClock]);
        }, tickMs);

        // main.ts's loop, verbatim, with a hitch injected
        let lastNow = performance.now();
        const t0 = lastNow;
        let frame = 0;
        const block = (until) => {
          while (performance.now() < until) {
            /* hold the main thread, as a long task does */
          }
        };
        while (performance.now() - t0 < ms) {
          const now = performance.now();
          const rawDt = (now - lastNow) / 1000;
          lastNow = now;
          // `burst` is not a hitch at all, it is every harness in this repo: `playtest.mjs`
          // advances the world several frames inside one call, so more world happens between two
          // audio ticks than wall time passed. Two frames of 1/60 every 16 ms is the world at
          // twice the audio's clock.
          const dt = mode === 'burst' ? 1 / 60 : Math.min(rawDt, 0.1);
          const n = mode === 'burst' ? 2 : 1;
          P.step(n, dt, false);
          simClock += dt * n;
          frame++;
          // one long frame a second, at the shipped 60-ish Hz between them
          const hitch = frame % 45 === 0;
          if (hitch && mode === 'blocking') block(performance.now() + 300);
          if (hitch && mode === 'starved') await new Promise((r) => setTimeout(r, 300));
          // `raf` is the pacing every harness in this repo uses. It is in here as a case of its
          // own because a headless page grants animation frames at about 15 Hz, which starves the
          // simulation against the audio's 30 without anyone asking for a hitch.
          if (mode === 'raf') await new Promise((r) => requestAnimationFrame(r));
          else await new Promise((r) => setTimeout(r, 16));
        }
        clearInterval(probe);
        return ticks;
      },
      [mode, seconds * 1000, TICK_MS],
    );
    await page.keyboard.up('KeyW');
    await new Promise((r) => setTimeout(r, 300));
    runs.push({ mode, ticks: rows });
    log(`${mode}: ${rows.length} audio ticks`);
  }
  fs.writeFileSync(path.join(out, 'pace.json'), JSON.stringify({ tickMs: TICK_MS, seconds, runs }, null, 2));
  log(`wrote ${out}/pace.json`);
} finally {
  await browser.close();
  await server.close();
}
