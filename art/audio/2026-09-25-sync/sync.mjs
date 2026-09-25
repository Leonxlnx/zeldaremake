#!/usr/bin/env node
/**
 * sync.mjs — how long after the boot lands does the step sound?
 *
 *   node art/audio/2026-09-25-sync/sync.mjs --dist dist [--out /tmp/sync] [--seconds 40]
 *
 * `footsteps.ts` says why the gait-driven path exists: *"a step sounds when a boot actually plants,
 * so what is heard is what is seen"*. `2026-09-25-gaitdriven` showed that path really is the one a
 * player is on — 53 of 53 steps at a run. Nobody has measured whether it delivers on the claim.
 *
 * There is reason to doubt it. The audio tick is a `setInterval` at 33.3 ms, so a boot that plants
 * just after one tick is not noticed until the next; and when the tick does notice, it schedules
 * the sound at `ctx.currentTime + 0.03`, thirty milliseconds further on. That is 30 to 63 ms of lag
 * by construction, and audio arriving more than about 45 ms after the picture is the side of the
 * window people notice.
 *
 * So: log the character system's own stance flags every frame (`__ZR_PLAY__.state().feet`) and the
 * context time the audio scheduled its last contact for (`stats().scheduledAt`), both against the
 * AudioContext clock, and subtract. The frame loop samples at 60 Hz, so an observed plant is at
 * most 17 ms late — the measurement's own error, and small against what it is looking for.
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
const out = path.resolve(args.out || '/tmp/sync');
const seconds = Number(args.seconds ?? 40);
const log = (...m) => console.error('[sync]', ...m);
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

  const data = await page.evaluate(async (secs) => {
    const P = window.__ZR_PLAY__;
    const A = window.__ZR_AUDIO__;
    const key = (c, t) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }));
    // short legs through the plaza, so he never runs out of flagstones (2026-09-25-rhythm)
    const LEGS = [
      [1.5, -4, 180],
      [1.5, -12, 0],
      [-1.5, -6, 90],
      [3.5, -8, 270],
    ];
    const out = {};
    for (const [gait, shift] of [
      ['walk', false],
      ['run', true],
    ]) {
      P.place(LEGS[0][0], LEGS[0][1], Math.PI);
      key('KeyW', 'keydown');
      if (shift) key('ShiftLeft', 'keydown');
      const dt = 1 / 60;
      const frame = () => new Promise((r) => setTimeout(r, dt * 1000));
      for (let i = 0; i < 90; i++) {
        P.step(1, dt, false);
        await frame();
      }
      const plants = [];
      const sounds = [];
      let wasStance = [];
      let lastSched = A.stats().scheduledAt;
      const c0 = A.stats().contextTime;
      let leg = 0;
      while (A.stats().contextTime - c0 < secs) {
        P.step(1, dt, false);
        await frame();
        const st = A.stats();
        const now = st.contextTime - c0;
        const feet = (P.state().feet ?? []).map((f) => !!f.stance);
        for (let i = 0; i < feet.length; i++) if (feet[i] && !wasStance[i]) plants.push(+now.toFixed(4));
        wasStance = feet;
        if (st.scheduledAt !== lastSched) {
          sounds.push(+(st.scheduledAt - (st.contextTime - now)).toFixed(4));
          lastSched = st.scheduledAt;
        }
        const want = Math.floor(now / 5);
        if (want !== leg) {
          leg = want;
          const L = LEGS[leg % LEGS.length];
          P.place(L[0], L[1], (L[2] * Math.PI) / 180);
        }
      }
      key('KeyW', 'keyup');
      if (shift) key('ShiftLeft', 'keyup');
      out[gait] = { plants, sounds };
      for (let i = 0; i < 40; i++) {
        P.step(1, dt, false);
        await frame();
      }
    }
    return out;
  }, seconds);

  for (const gait of ['walk', 'run']) {
    const { plants, sounds } = data[gait];
    // pair each sound with the most recent plant before it
    const lags = [];
    let j = 0;
    for (const s of sounds) {
      while (j + 1 < plants.length && plants[j + 1] <= s) j++;
      if (plants.length && plants[j] <= s) lags.push((s - plants[j]) * 1000);
    }
    lags.sort((a, b) => a - b);
    const q = (p) => (lags.length ? lags[Math.floor((lags.length - 1) * p)] : NaN);
    log(`${gait}: ${plants.length} boot plants, ${sounds.length} contacts scheduled`);
    log(`  boot -> sound: median ${q(0.5).toFixed(0)} ms, p10 ${q(0.1).toFixed(0)}, p90 ${q(0.9).toFixed(0)} (n=${lags.length})`);
    data[gait].lags = lags.map((v) => +v.toFixed(1));
  }
  fs.writeFileSync(path.join(out, 'sync.json'), JSON.stringify({ seconds, ...data }, null, 1));
  log(`-> ${path.join(out, 'sync.json')}`);
} finally {
  await browser.close();
  await server.close();
}
