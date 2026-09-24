#!/usr/bin/env node
/**
 * probe.mjs — how many footsteps does the player hear per metre, and where does that rate come from?
 *
 *   node art/audio/2026-09-24-cadence/probe.mjs --dist dist [--out /tmp/cadence]
 *
 * `footsteps.ts` carries a cadence model — `cadence(speed)`, `strideFor(speed)` — with a test
 * asserting it is "a cadence a person could walk". That model drives the **distance integrator**,
 * which is the fallback. In play the character system reports the gait's own boot plants and the
 * integrator stays out of the way, so the rate the player hears is the gait's and the model is
 * never consulted. The test guards a path nobody hears.
 *
 * Measured once in passing (`art/audio/2026-09-24-jump/`), a walk at 1.60 m/s sounded **3.70 steps
 * a second — a 0.43 m step** — where the model says 2.02 and 0.79 m. This settles where that comes
 * from, by counting three things over the same walk and comparing them:
 *
 *   - the ground actually covered, and the time;
 *   - the audio's own counters, `steps` and `gaitSteps`;
 *   - the gait's stance edges, counted here from `feetContact()` without the audio involved.
 *
 * If the audio's steps equal the gait's edges, the rate is the animation's and this lane can only
 * report it. If it exceeds them, the lane is inventing steps and it is ours.
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
const out = path.resolve(args.out || '/tmp/cadence');
const log = (...m) => console.error('[cadence]', ...m);
fs.mkdirSync(out, { recursive: true });

/** straight legs on open ground, held for `seconds`; `run` holds shift */
const LEGS = [
  { id: 'walk, the plaza flagstones', at: [1.5, -4, 180], run: false, seconds: 7 },
  { id: 'run, the plaza flagstones', at: [1.5, -4, 180], run: true, seconds: 7 },
  { id: 'walk, the lawn west of the spine', at: [-6.5, 6, 180], run: false, seconds: 7 },
  { id: 'run, the lawn west of the spine', at: [-6.5, 6, 180], run: true, seconds: 7 },
];

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
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));

  const rows = [];
  for (const leg of LEGS) {
    const r = await page.evaluate(
      async (l) => {
        const P = window.__ZR_PLAY__;
        const A = window.__ZR_AUDIO__;
        P.setPlayMode(true);
        P.place(l.at[0], l.at[1], (l.at[2] * Math.PI) / 180);
        const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
        // a second of walking first so the gait is in its cycle before anything is counted
        key('KeyW', 'keydown');
        if (l.run) key('ShiftLeft', 'keydown');
        const warm = performance.now();
        while (performance.now() - warm < 1000) {
          P.step(1, 1 / 60, false);
          await new Promise((r2) => requestAnimationFrame(r2));
        }
        const a0 = A.stats();
        const p0 = P.state().link.slice();
        // the gait's stance edges, counted here with no audio involved
        let edges = 0;
        let was = (P.state().feet ?? []).map((f) => !!f.stance);
        let simulated = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < l.seconds * 1000) {
          P.step(1, 1 / 60, false);
          simulated += 1 / 60;
          const now = (P.state().feet ?? []).map((f) => !!f.stance);
          for (let i = 0; i < now.length; i++) if (now[i] && !was[i]) edges++;
          was = now;
          await new Promise((r2) => requestAnimationFrame(r2));
        }
        const a1 = A.stats();
        const p1 = P.state().link.slice();
        key('KeyW', 'keyup');
        if (l.run) key('ShiftLeft', 'keyup');
        const metres = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
        return { metres, simulated, steps: a1.steps - a0.steps, gaitSteps: a1.gaitSteps - a0.gaitSteps, edges, surface: a1.lastSurface };
      },
      leg,
    );
    const speed = r.metres / r.simulated;
    const rate = r.steps / r.simulated;
    rows.push({ ...leg, ...r, speed, rate, stride: r.metres / Math.max(1, r.steps) });
    log(
      `${leg.id.padEnd(34)} ${r.metres.toFixed(1).padStart(5)} m in ${r.simulated.toFixed(1)} s = ${speed.toFixed(2)} m/s   ` +
        `steps ${String(r.steps).padStart(3)} (${rate.toFixed(2)}/s, ${(r.metres / Math.max(1, r.steps)).toFixed(2)} m each)   gait-driven ${r.gaitSteps}   the gait's own edges ${r.edges}   on ${r.surface}`,
    );
  }
  fs.writeFileSync(path.join(out, 'legs.json'), JSON.stringify(rows, null, 1));
} finally {
  await browser.close();
  await server.close();
}
