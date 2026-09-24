#!/usr/bin/env node
/**
 * probe.mjs — what a jump sounds like, and what walking into a wall sounds like.
 *
 *   node art/audio/2026-09-24-jump/probe.mjs --dist dist [--out /tmp/jump]
 *
 * Two things this lane has never listened to. The footstep work has all been about walking: the
 * surface under the boot, the cadence, the gait's stance edges. A jump is the one move that takes
 * both boots off the ground, and it is driven from `airHeight()` rather than the gait — so it is
 * the one place a step can be missed or invented without any walking test noticing.
 *
 * Link is placed on the flagstones and driven through a fixed script (stand, walk, four jumps,
 * stand, then four seconds pressed into a wall) while the live master is recorded and the state is
 * sampled every 100 ms: the jump arc's height, and the audio's own step / landing counters. The
 * recording and the arc on one time axis say whether anything sounds when he leaves the ground,
 * and whether his boots keep walking when the world will not let him move.
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
const out = path.resolve(args.out || '/tmp/jump');
const log = (...m) => console.error('[jump]', ...m);
fs.mkdirSync(out, { recursive: true });

/**
 * the script, in seconds from the start of the recording. `walk` holds W, `jump` taps Space, and
 * the wall leg walks north-west into `plaza-south`'s foot, which the play-test harness already
 * knows blocks (the south probes refuse 0.7–2.5 m either side of the deck).
 */
const SCRIPT = [
  { until: 2, walk: false, note: 'standing' },
  { until: 6, walk: true, note: 'walking the flagstones' },
  { until: 14, walk: false, jumpEvery: 2, note: 'four jumps from a standstill' },
  { until: 16, walk: false, note: 'standing' },
  { until: 21, walk: true, wall: true, note: 'walking into a wall' },
];
const SECONDS = SCRIPT[SCRIPT.length - 1].until;

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
  log('world ready');
  // the gesture the browser needs before an AudioContext may run
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));

  const result = await page.evaluate(
    async (script, secs) => {
      const P = window.__ZR_PLAY__;
      const A = window.__ZR_AUDIO__;
      P.setPlayMode(true);
      P.place(1.5, -6, Math.PI);
      const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
      const samples = [];
      const rec = A.record(secs).then((b) => {
        let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
        return btoa(s);
      });
      const t0 = performance.now();
      let walking = false;
      let jumpAt = -1;
      let next = 0;
      const jumps = [];
      while (performance.now() - t0 < secs * 1000) {
        const t = (performance.now() - t0) / 1000;
        const leg = script.find((l) => t < l.until) ?? script[script.length - 1];
        if (leg.walk !== walking) {
          key('KeyW', leg.walk ? 'keydown' : 'keyup');
          walking = leg.walk;
        }
        if (leg.jumpEvery && t - jumpAt > leg.jumpEvery) {
          jumpAt = t;
          jumps.push(Number(t.toFixed(2)));
          key('Space', 'keydown');
          setTimeout(() => key('Space', 'keyup'), 60);
        }
        P.step(1, 1 / 60, false);
        if (performance.now() - t0 >= next) {
          const st = P.state();
          const a = A.stats() ?? {};
          samples.push([Number(t.toFixed(2)), Number((st.air ?? 0).toFixed(3)), a.steps ?? 0, a.pushOffs ?? 0, a.landings ?? 0, st.link ? Number(st.link[2].toFixed(2)) : 0]);
          next += 100;
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      key('KeyW', 'keyup');
      return { b64: await rec, samples, jumps };
    },
    SCRIPT,
    SECONDS,
  );

  fs.writeFileSync(path.join(out, 'jump.webm'), Buffer.from(result.b64, 'base64'));
  fs.writeFileSync(path.join(out, 'samples.json'), JSON.stringify({ script: SCRIPT, jumps: result.jumps, samples: result.samples }));
  log(`${result.samples.length} samples, jump presses at ${result.jumps.join(', ')} s`);
  log('t     air    steps shoves  lands     z');
  let prev = null;
  for (const r of result.samples) {
    const changed = !prev || r[2] !== prev[2] || r[3] !== prev[3] || r[4] !== prev[4] || (r[1] > 0.02) !== (prev[1] > 0.02);
    if (changed) log(r.map((v, i) => String(v).padStart(i ? 6 : 5)).join(' '));
    prev = r;
  }
} finally {
  await browser.close();
  await server.close();
}
