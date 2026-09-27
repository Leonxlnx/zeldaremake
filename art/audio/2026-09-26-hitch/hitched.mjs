#!/usr/bin/env node
/**
 * hitched.mjs — record the real graph walking the same ground through frames that run long.
 *
 *   node art/audio/2026-09-26-hitch/hitched.mjs --dist dist --out /tmp/hitch/before [--metres 16]
 *
 * `pace.mjs` says what speed the footstep system is handed and `steps.mjs` says none of the steps
 * go missing, so what is left is the thing you can only settle by listening: some of them are
 * sounded at a speed he is not travelling at, which picks a harder design with a run's brightness.
 *
 * Two takes, one paced smoothly and one with a 300 ms blocking frame every 45th. Getting them
 * comparable took two goes and both failures are worth writing down, because both would have
 * produced a confident number that meant nothing:
 *
 *   - **Walk for a fixed TIME and they cover different ground.** A hitched walk loses simulation
 *     time, so it ends 3.4 m short, and the last stretch of the plaza does not sound like the
 *     first. Fixed by walking to a fixed DISTANCE and letting the wall clock fall where it may.
 *   - **Take both in one page and the music has moved on.** The score runs off `ctx.currentTime`,
 *     which does not rewind between takes, so a sustained low note sat under one take's steps and
 *     not the other's — a 20 dB difference in the 40-250 Hz band that had nothing to do with the
 *     boots. Fixed by giving each take its own page, so both hear the same bar of the same score.
 *
 * Which step is which is not guessed either. `FootstepStats.scheduledAt` is the context time the
 * last contact was scheduled FOR, and it is polled per frame, so each take comes with the exact
 * time of every boot plant and the distance he had walked when it sounded. Onset detection alone
 * cannot do this: it finds 60-odd events in a take that contains 37 steps, because the forest is
 * full of birds. `hitched.py` uses the schedule to say where to look and measures there.
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
const out = path.resolve(args.out || '/tmp/hitch/before');
const metres = Number(args.metres ?? 32);
/** long enough for the hitched take, which needs about a quarter more wall time for the same ground */
const seconds = Number(args.seconds ?? 42);
const log = (...m) => console.error('[hitched]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
/**
 * `smooth` twice is the CONTROL, and the result cannot be read without it. Two takes of the same
 * pacing on the same build still differ — the bed is not the same bed twice, and the boots are
 * mixed with whatever the forest happened to be doing. Whatever that comes to is the measurement
 * looking at itself, and only a hitched take that exceeds it has anything in it.
 */
const takes = ['smooth', 'smooth2', 'blocking', 'burst'];

try {
  for (const name of takes) {
    const mode = name.replace(/\d+$/, '');
    // a page of its own per take: the score runs off the context clock and does not rewind
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    page.on('pageerror', (e) => log('[pageerror]', e.message));
    await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
    await page.evaluate(() => window.__ZR__.ready());
    for (let i = 0; i < 2; i++) {
      await page.keyboard.down('KeyM');
      await page.keyboard.up('KeyM');
    }
    await new Promise((r) => setTimeout(r, 1200));
    await page.waitForFunction(() => !!window.__ZR_AUDIO__?.stats?.(), { timeout: READY_TIMEOUT_MS, polling: 250 });
    // the plaza spine, facing south down it: open flagstone, no stairs, no doorway
    await page.evaluate(() => window.__ZR_PLAY__.place(0, 8, 0));
    await new Promise((r) => setTimeout(r, 800));

    const started = page.evaluate(
      (s) =>
        window.__ZR_AUDIO__.record(s).then((b) => {
          let bin = '';
          for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
          return btoa(bin);
        }),
      seconds,
    );
    await page.keyboard.down('KeyW');
    const row = await page.evaluate(
      async ([mode, wantM, capMs]) => {
        const P = window.__ZR_PLAY__;
        const before = window.__ZR_AUDIO__.stats();
        let moved = 0;
        let prev = P.state().link;
        let lastNow = performance.now();
        const t0 = lastNow;
        let frame = 0;
        let sim = 0;
        // Every contact's scheduled context time, which `FootstepStats.scheduledAt` publishes for
        // exactly this: onset detection cannot tell a boot from a bird, and there are more birds
        // than boots. Polled per frame — the shortest gap the system allows between contacts is
        // `MIN_STEP_GAP`, ten times a frame, so none can slip between two polls.
        const contacts = [];
        let lastAt = before.scheduledAt;
        const block = (until) => {
          while (performance.now() < until) {
            /* hold the main thread, as a long task does */
          }
        };
        while (moved < wantM && performance.now() - t0 < capMs) {
          const now = performance.now();
          const rawDt = (now - lastNow) / 1000;
          lastNow = now;
          // `burst` is not a hitch, it is every harness in this repo: `playtest.mjs` advances the
          // world several frames inside one call, so more world happens between two audio ticks
          // than wall time passed. Two frames of 1/60 every 16 ms is the world at twice the
          // audio's clock — mild as harnesses go, and the cleanest case to measure because it is
          // steady instead of sampled.
          const dt = mode === 'burst' ? 1 / 60 : Math.min(rawDt, 0.1);
          const n = mode === 'burst' ? 2 : 1;
          P.step(n, dt, false);
          sim += dt * n;
          frame++;
          const at = P.state().link;
          if (at && prev) moved += Math.hypot(at[0] - prev[0], at[2] - prev[2]);
          prev = at;
          const st = window.__ZR_AUDIO__.stats();
          if (st.scheduledAt !== lastAt) {
            lastAt = st.scheduledAt;
            contacts.push([st.scheduledAt, moved]);
          }
          if (mode === 'blocking' && frame % 45 === 0) block(performance.now() + 300);
          await new Promise((r) => setTimeout(r, 16));
        }
        const after = window.__ZR_AUDIO__.stats();
        return {
          mode,
          frames: frame,
          sim,
          wall: (performance.now() - t0) / 1000,
          moved,
          to: P.state().link,
          steps: after.steps - before.steps,
          gaitSteps: after.gaitSteps - before.gaitSteps,
          contacts,
        };
      },
      [mode, metres, (seconds - 1) * 1000],
    );
    await page.keyboard.up('KeyW');
    const b64 = await started;
    fs.writeFileSync(path.join(out, `${name}.webm`), Buffer.from(b64, 'base64'));
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ ...row, name }, null, 2));
    log(`${name}: ${row.steps} steps over ${row.moved.toFixed(2)} m in ${row.wall.toFixed(1)} s wall / ${row.sim.toFixed(1)} s sim → ${name}.webm`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
