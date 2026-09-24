#!/usr/bin/env node
/**
 * probe.mjs — a waterfall is the one sound in this forest that never stops. Measure it as such.
 *
 *   node art/audio/2026-09-24-waterfall/probe.mjs --dist dist [--out /tmp/waterfall]
 *
 * The owner's standing complaint, twice, is noise that never stops — "the background sound is too
 * buzzy" and then "LOWER THE WHITE NOISE". The metric this lane settled on for it is not the mean
 * but the **always-on** level: what is present in nine frames out of ten, per band. A level cut
 * that leaves the floor where it was does not fix the percept.
 *
 * `exp-ruins` adds a waterfall, and a waterfall is continuous broadband noise by definition. Its
 * author gated it hard by distance (`FALL_REACH_M`, `FALL_AUDIBLE_M`) for exactly that reason. This
 * checks the gate with the lane's own instrument: Link stands still at a row of distances out from
 * the plunge, the live master is recorded at each, and the always-on level per band is reported
 * beside the forest's own — so the question "is the fall the loudest thing that never stops, and
 * where" is answered with numbers rather than an opinion.
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
const out = path.resolve(args.out || '/tmp/waterfall');
/**
 * Long takes on purpose. The always-on metric is a 10th percentile over time, and the placeholder
 * score's pad runs the whole of a 50 s pass in the same 60–125 Hz band the fall's roar lives in —
 * on a nine-second take it IS the floor and nothing else can be read. The tune rests 16–30 s
 * between passes, so a take of 75 s always contains a rest long enough for the 10th percentile to
 * land inside it, and what is left is the world.
 */
const seconds = Number(args.seconds ?? 75);
const log = (...m) => console.error('[fall]', ...m);
fs.mkdirSync(out, { recursive: true });

/**
 * Where he stands, chosen so each spot has one dominant source.
 *
 * The plunge sits about (−72.9, 1.55, 2.7) — three metres off the cliff foot, a metre over the
 * waterline. The trail's three pod lanterns are at (−45.6, −1.14), (−49.74, −5.32) and
 * (−55.1, −2.62), and a flame is half level 1.3 m from its pod, so a first pass straight down the
 * trail measured the lanterns as much as the fall: at (−44, 2) the nearest pod is 3.5 m away and
 * its flame is twice the fall's level there. The `fall-*` spots keep **north of z = +3**, which
 * puts every pod 8 m or more away and leaves the fall the only thing varying. `pod-1m` is the
 * reverse — a metre from a lantern and 29 m from the fall — so the flame's own floor can be
 * subtracted rather than guessed at. `plaza` is the control: the forest with neither in it.
 */
const SPOTS = [
  { id: 'fall-4m', at: [-70.0, 3.0] },
  { id: 'fall-7m', at: [-66.0, 3.5] },
  { id: 'fall-11m', at: [-62.0, 5.0] },
  { id: 'fall-17m', at: [-56.0, 6.0] },
  { id: 'fall-26m', at: [-48.0, 8.0] },
  { id: 'fall-35m', at: [-38.0, 6.0] },
  { id: 'pod-1m', at: [-44.5, -1.4] },
  { id: 'plaza', at: [1.5, -6.0] },
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
  log('audio', JSON.stringify(await page.evaluate(() => window.__ZR_AUDIO__.stats())));

  const rows = [];
  for (const spot of SPOTS) {
    const r = await page.evaluate(
      async (s, secs) => {
        const P = window.__ZR_PLAY__;
        const A = window.__ZR_AUDIO__;
        P.setPlayMode(true);
        P.place(s.at[0], s.at[1], Math.PI / 2);
        // let the bed's setTargetAtTime levels reach the new place before the take starts
        const settle = performance.now();
        while (performance.now() - settle < 2500) {
          P.step(1, 1 / 60, false);
          await new Promise((r2) => requestAnimationFrame(r2));
        }
        const rec = A.record(secs).then((b) => {
          let t = '';
          for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode(...b.subarray(i, i + 0x8000));
          return btoa(t);
        });
        const t0 = performance.now();
        const gust = [];
        while (performance.now() - t0 < secs * 1000) {
          P.step(1, 1 / 60, false);
          gust.push(A.stats()?.gust ?? 0);
          await new Promise((r2) => requestAnimationFrame(r2));
        }
        const st = A.stats();
        return { b64: await rec, fall: st?.fall ?? null, falls: st?.falls ?? null, gust: gust.reduce((a, b) => a + b, 0) / Math.max(1, gust.length), link: P.state().link };
      },
      spot,
      seconds,
    );
    fs.writeFileSync(path.join(out, `${spot.id}.webm`), Buffer.from(r.b64, 'base64'));
    rows.push({ id: spot.id, at: spot.at, fall: r.fall, falls: r.falls, gust: Number(r.gust.toFixed(3)), link: r.link });
    log(`${spot.id.padEnd(16)} fall ${String(r.fall).padEnd(22)} gust ${r.gust.toFixed(2)}  at ${JSON.stringify(r.link?.map((v) => Number(v.toFixed(1))))}`);
  }
  fs.writeFileSync(path.join(out, 'spots.json'), JSON.stringify(rows, null, 1));
} finally {
  await browser.close();
  await server.close();
}
