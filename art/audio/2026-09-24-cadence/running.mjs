#!/usr/bin/env node
/**
 * running.mjs — does the mix still move to the step rate when he runs? Asked of the LIVE graph.
 *
 *   node art/audio/2026-09-24-cadence/running.mjs --dist dist [--out /tmp/running]
 *
 * The owner, 2026-09-23: "the music kind of still shakes whenever I run". The lane's answer (job 8)
 * was that the music was steady and the footsteps were pulsing over it at the step rate, and the
 * fix was a compressor on the sfx bus. It was verified on an **offline** render — and the offline
 * render drives its footsteps from `cadence()`, which has just been found to be an adult's model
 * running at 55 % of the rate the gait actually plants. So job 8 was checked at roughly half the
 * step density the owner hears, and the check has to be redone where he hears it.
 *
 * This records the real master through `__ZR_AUDIO__.record` while Link runs and while he walks,
 * and takes the envelope-modulation spectrum of each: what rhythm the level moves to. The music's
 * own beat is 76 bpm — 1.27 Hz — so if the strongest modulation is up at the step rate, the steps
 * are still the thing carrying the mix.
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
const out = path.resolve(args.out || '/tmp/running');
const seconds = Number(args.seconds ?? 18);
const log = (...m) => console.error('[running]', ...m);
fs.mkdirSync(out, { recursive: true });

/** he needs room: the north path runs straight for forty metres from the plaza's top */
const TAKES = [
  { id: 'walking', at: [3.5, -20, 180], run: false },
  { id: 'running', at: [3.5, -20, 180], run: true },
  { id: 'standing', at: [3.5, -20, 180], run: false, still: true },
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
  for (const take of TAKES) {
    const r = await page.evaluate(
      async (t, secs) => {
        const P = window.__ZR_PLAY__;
        const A = window.__ZR_AUDIO__;
        P.setPlayMode(true);
        P.place(t.at[0], t.at[1], (t.at[2] * Math.PI) / 180);
        const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
        if (!t.still) key('KeyW', 'keydown');
        if (t.run) key('ShiftLeft', 'keydown');
        // a second of it before the recorder opens, so the gait is in its cycle
        const warm = performance.now();
        while (performance.now() - warm < 1000) {
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
        let sim = 0;
        while (performance.now() - t0 < secs * 1000) {
          P.step(1, 1 / 60, false);
          sim += 1 / 60;
          await new Promise((r2) => requestAnimationFrame(r2));
        }
        const a1 = A.stats();
        key('KeyW', 'keyup');
        if (t.run) key('ShiftLeft', 'keyup');
        return { b64: await rec, steps: a1.steps - a0.steps, sim };
      },
      take,
      seconds,
    );
    fs.writeFileSync(path.join(out, `${take.id}.webm`), Buffer.from(r.b64, 'base64'));
    rows.push({ id: take.id, steps: r.steps, seconds: r.sim, rate: r.steps / r.sim });
    log(`${take.id.padEnd(10)} ${String(r.steps).padStart(3)} steps in ${r.sim.toFixed(1)} s = ${(r.steps / r.sim).toFixed(2)} /s`);
  }
  fs.writeFileSync(path.join(out, 'takes.json'), JSON.stringify(rows, null, 1));
} finally {
  await browser.close();
  await server.close();
}
