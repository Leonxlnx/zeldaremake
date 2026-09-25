#!/usr/bin/env node
/**
 * worstcase.mjs — the loudest moment this game can actually make.
 *
 *   node art/audio/2026-09-24-level/worstcase.mjs --dist dist [--out /tmp/worst]
 *
 * Headroom has to be sized against the worst case, not the average, and the average is all this
 * lane has ever measured: a scripted walk, or a soak that wanders. So build the worst case on
 * purpose and record it.
 *
 * Everything loud at once, in the place where the most of it overlaps: running on the plaza's
 * flagstones (the hardest surface and the fastest step rate) **under the lantern bough** (the
 * densest cluster of pod flames in the world), jumping continuously so every landing — the loudest
 * single event the footstep designer makes — stacks on the steps, with the placeholder score
 * playing. The take is long enough to catch the music's own lift and a full gust.
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
const out = path.resolve(args.out || '/tmp/worst');
const seconds = Number(args.seconds ?? 70);
const log = (...m) => console.error('[worst]', ...m);
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
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));

  const r = await page.evaluate(async (secs) => {
    const P = window.__ZR_PLAY__;
    const A = window.__ZR_AUDIO__;
    P.setPlayMode(true);
    const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    /** short legs right through the plaza's lantern cluster, so he never leaves it */
    const LEGS = [
      [1.5, -4, 180],
      [1.5, -12, 0],
      [-1.5, -6, 90],
      [3.5, -8, 270],
    ];
    P.place(LEGS[0][0], LEGS[0][1], Math.PI);
    key('KeyW', 'keydown');
    key('ShiftLeft', 'keydown');
    const warm = performance.now();
    while (performance.now() - warm < 1500) {
      P.step(1, 1 / 60, false);
      await new Promise((r2) => requestAnimationFrame(r2));
    }
    const a0 = A.stats();
    const rec = A.record(secs).then((b) => {
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    });
    const t0 = performance.now();
    let legAt = 0;
    let leg = 0;
    let jumpAt = -1;
    while (performance.now() - t0 < secs * 1000) {
      const ms = performance.now() - t0;
      if (ms - legAt > 6000) {
        legAt = ms;
        leg = (leg + 1) % LEGS.length;
        P.place(LEGS[leg][0], LEGS[leg][1], (LEGS[leg][2] * Math.PI) / 180);
      }
      // jump as often as the arc allows, so a landing stacks on the run's steps
      if (ms / 1000 - jumpAt > 0.9) {
        jumpAt = ms / 1000;
        key('Space', 'keydown');
        setTimeout(() => key('Space', 'keyup'), 60);
      }
      P.step(1, 1 / 60, false);
      await new Promise((r2) => requestAnimationFrame(r2));
    }
    key('KeyW', 'keyup');
    key('ShiftLeft', 'keyup');
    const a1 = A.stats();
    return { b64: await rec, steps: a1.steps - a0.steps, landings: a1.landings - a0.landings, pushOffs: (a1.pushOffs ?? 0) - (a0.pushOffs ?? 0), pods: a1.pods, music: a1.music };
  }, seconds);

  fs.writeFileSync(path.join(out, 'worst.webm'), Buffer.from(r.b64, 'base64'));
  fs.writeFileSync(path.join(out, 'worst.json'), JSON.stringify({ seconds, ...r, b64: undefined }, null, 1));
  log(`${r.steps} steps, ${r.landings} landings, ${r.pushOffs} shoves in ${seconds} s, ${r.pods} pods in the scene, music ${r.music}`);
} finally {
  await browser.close();
  await server.close();
}
