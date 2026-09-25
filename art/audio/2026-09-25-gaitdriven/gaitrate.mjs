#!/usr/bin/env node
/**
 * gaitrate.mjs — steps per metre in PLAY, against the frame rate.
 *
 *   node art/audio/2026-09-25-gaitdriven/gaitrate.mjs --dist dist [--out /tmp/gaitrate]
 *
 * PR #103 fixed the distance integrator dropping steps as the tick stretched, and measured it with
 * `createFootsteps` driven directly. That measurement was right and its headline was not: in play
 * the steps do not come from the integrator at all.
 *
 *     walking   28 steps, 26 of them from the gait
 *     running   53 steps, 53 of them from the gait
 *
 * `drive` fires on the character system's stance edges when it has them and only falls back to the
 * integrator when it does not (`gaitUntil`). So #103's "one step in fifteen never sounded" is true
 * of this lane's offline renders — which have no stance flags — and overstates what a player heard.
 *
 * It also raises the question #103 should have asked: is the path players ARE on frame-rate safe?
 * A stance edge is `stance[i] && !wasStance[i]`, sampled once a tick. A boot that goes down and up
 * between two ticks is a step nobody hears, and a slow frame rate makes that likelier. So: the real
 * character system, real key input, the simulation stepped at a chosen dt, counting steps against
 * ground covered.
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
const out = path.resolve(args.out || '/tmp/gaitrate');
const log = (...m) => console.error('[gaitrate]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1500));
  log('audio started');

  const rows = await page.evaluate(async () => {
    const P = window.__ZR_PLAY__;
    const A = window.__ZR_AUDIO__;
    const key = (c, t) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }));
    const at = () => {
      const l = P.state().link;
      return l ? [l[0], l[2]] : [0, 0];
    };
    const out = [];
    // the plaza's flagstones, back and forth so he never leaves them
    for (const [gait, shift] of [
      ['walk', false],
      ['run', true],
    ]) {
      for (const dt of [1 / 60, 1 / 30, 1 / 20, 1 / 15, 1 / 10]) {
        P.place(1.5, -4, Math.PI);
        // a moment at the new rate before counting, so the gait is in its stride
        key('KeyW', 'keydown');
        if (shift) key('ShiftLeft', 'keydown');
        // paced to real time: the audio's own tick is a wall-clock setInterval, so running the
        // simulation faster than the clock means it samples him a handful of times and counts
        // almost no steps. A dt of 1/15 with a 1/15 s wait between frames is a 15 fps machine.
        const frame = (n) => new Promise((r) => setTimeout(r, n * 1000));
        for (let i = 0; i < Math.round(1.5 / dt); i++) {
          P.step(1, dt, false);
          await frame(dt);
        }
        const a0 = A.stats();
        const p0 = at();
        let far = 0;
        let prev = p0;
        const frames = Math.round(10 / dt);
        for (let i = 0; i < frames; i++) {
          P.step(1, dt, false);
          await frame(dt);
          const p = at();
          far += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
          prev = p;
        }
        const a1 = A.stats();
        key('KeyW', 'keyup');
        if (shift) key('ShiftLeft', 'keyup');
        for (let i = 0; i < 20; i++) { P.step(1, dt, false); await frame(dt); }
        out.push({ gait, dt, steps: a1.steps - a0.steps, gaitSteps: a1.gaitSteps - a0.gaitSteps, metres: +far.toFixed(2), perMetre: far > 0.5 ? +((a1.steps - a0.steps) / far).toFixed(3) : null });
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    return out;
  });

  console.log(`${'gait'.padEnd(6)} ${'tick'.padStart(8)} ${'steps'.padStart(6)} ${'from gait'.padStart(10)} ${'metres'.padStart(7)} ${'steps/m'.padStart(8)}`);
  for (const r of rows) console.log(`${r.gait.padEnd(6)} ${(r.dt * 1000).toFixed(1).padStart(6)}ms ${String(r.steps).padStart(6)} ${String(r.gaitSteps).padStart(10)} ${String(r.metres).padStart(7)} ${String(r.perMetre ?? '-').padStart(8)}`);
  fs.writeFileSync(path.join(out, 'gaitrate.json'), JSON.stringify({ rows }, null, 1));
  log(`-> ${path.join(out, 'gaitrate.json')}`);
} finally {
  await browser.close();
  await server.close();
}
