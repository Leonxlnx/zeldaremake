#!/usr/bin/env node
/**
 * probe.mjs — does the audio still sound the same after ten minutes of playing?
 *
 *   node art/audio/2026-09-24-soak/probe.mjs --dist dist [--minutes 10]
 *
 * Every event in this graph builds its own little chain of nodes and tears it down again through
 * `cleanupAt` — a footstep, a leaf flutter, a bird, a harp note, a fairy glint. At roughly ten a
 * second that is thousands of chains in a session, and this lane has already shipped one leak of
 * exactly that kind: `adEnvelope` left its gates at the exponential floor instead of zero, so every
 * noise burst kept a tap on the shared noise source open for ever and a 45 s render lifted its own
 * floor 15 dB. It was found by accident. Nobody has ever run a long session on purpose.
 *
 * So: walk Link for minutes on end and watch four things that a leak moves and nothing else does —
 * the live voice count, the master's level, the JS heap, and the audio clock against the wall. A
 * leak shows as a ramp in one of them; a healthy graph shows a flat line with events on it.
 *
 * The level is sampled as a **trend** rather than at two endpoints: twenty-second recordings every
 * two minutes through the one session. Two endpoints cannot answer this — the first attempt took
 * eight seconds at each end and read a 43 dB fall in the 60–125 Hz band, which was not the graph
 * ageing but the placeholder score happening to play through the first window and rest through the
 * second. A window has to be long enough, and there have to be enough of them, for the tune's own
 * schedule to average out.
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
const out = path.resolve(args.out || '/tmp/soak');
const minutes = Number(args.minutes ?? 10);
const log = (...m) => console.error('[soak]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
const pageErrors = [];
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('console', (m) => {
    if (m.text().startsWith('[audio]')) log(m.text());
    if (m.type() === 'error') pageErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));
  log(`walking for ${minutes} minutes of wall time — the audio clock is the wall clock, so this has to be real time`);

  const result = await page.evaluate(async (mins) => {
    const P = window.__ZR_PLAY__;
    const A = window.__ZR_AUDIO__;
    P.setPlayMode(true);
    const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    /** a there-and-back on the north path, re-placed each leg so he never runs out of ground */
    const LEGS = [
      [3.5, -20, 180],
      [3.5, -46, 0],
      [1.5, -6, 180],
      [-6.5, 6, 180],
    ];
    const grab = async (secs) => {
      const b = await A.record(secs);
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    };

    P.place(LEGS[0][0], LEGS[0][1], (LEGS[0][2] * Math.PI) / 180);
    key('KeyW', 'keydown');
    const t0 = performance.now();
    const samples = [];
    /** a 20 s take every two minutes, each one started on the same leg so the place is the same */
    const takes = [];
    let nextTake = 0;
    let leg = 0;
    let legAt = 0;
    let next = 0;
    let lastRun = false;
    const END = mins * 60 * 1000;
    while (performance.now() - t0 < END) {
      const ms = performance.now() - t0;
      if (ms >= nextTake && END - ms > 21000) {
        takes.push({ at: Math.round(ms / 1000), leg, b64: grab(20) });
        nextTake += 120000;
      }
      // a new leg every 20 s, and run on every other one so the heaviest voice load is exercised
      if (ms - legAt > 20000) {
        legAt = ms;
        leg = (leg + 1) % LEGS.length;
        P.place(LEGS[leg][0], LEGS[leg][1], (LEGS[leg][2] * Math.PI) / 180);
        const run = leg % 2 === 1;
        if (run !== lastRun) {
          key('ShiftLeft', run ? 'keydown' : 'keyup');
          lastRun = run;
        }
      }
      P.step(1, 1 / 60, false);
      if (ms >= next) {
        const st = P.state();
        const a = A.stats() ?? {};
        samples.push([
          Math.round(ms / 100) / 10,
          a.voices ?? -1,
          Number((a.contextTime ?? 0).toFixed(1)),
          a.steps ?? 0,
          a.birds ?? 0,
          a.flutters ?? 0,
          st.heap ? Math.round(st.heap / 1048576) : -1,
          Number((a.load ?? -1).toFixed?.(3) ?? -1),
        ]);
        next += 5000;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    key('KeyW', 'keyup');
    if (lastRun) key('ShiftLeft', 'keyup');
    const done = [];
    for (const t of takes) done.push({ at: t.at, leg: t.leg, b64: await t.b64 });
    return { takes: done, samples, wall: (performance.now() - t0) / 1000 };
  }, minutes);

  for (const t of result.takes) fs.writeFileSync(path.join(out, `t${String(t.at).padStart(4, '0')}.webm`), Buffer.from(t.b64, 'base64'));
  fs.writeFileSync(path.join(out, 'samples.json'), JSON.stringify({ wall: result.wall, pageErrors, samples: result.samples, takes: result.takes.map((t) => ({ at: t.at, leg: t.leg })) }));
  const s = result.samples;
  log(`${result.wall.toFixed(0)} s of wall time, ${s.length} samples, ${pageErrors.length} page errors`);
  log('  t(s)  voices  ctx(s)  steps  birds  flutters  heap(MB)');
  for (const r of s.filter((_, i) => i % 12 === 0 || i === s.length - 1)) log('  ' + r.slice(0, 7).map((v, i) => String(v).padStart(i ? 7 : 5)).join(''));
} finally {
  await browser.close();
  await server.close();
}
