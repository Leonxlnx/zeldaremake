#!/usr/bin/env node
/**
 * rhythm.mjs — when the steps land, in play and in a render.
 *
 *   node art/audio/2026-09-25-rhythm/rhythm.mjs --dist dist [--out /tmp/rhythm]
 *
 * `2026-09-25-gaitdriven` established that a player's steps come from the character system's stance
 * edges — 53 of 53 at a run — while every offline render this lane makes has no character system
 * and falls back to the distance integrator. The rates were matched deliberately (#64 derived the
 * stride from the animation's clip contract), but a rate is not a rhythm.
 *
 * That matters because **every listenable clip this lane has ever produced came from a render**. If
 * the integrator lays steps down on an even distance grid while a real gait lands them where the
 * animation's boots land, then the evidence is more mechanical than the game, and the lane has been
 * judging the product by something that is not quite it.
 *
 * So: the interval between one step and the next, gathered both ways on the same flagstones at the
 * same speed. In play by reading the audio's own step counter every frame and noting when it
 * increments; in a render by finding the onsets. The question is not the mean — #64 settled the
 * mean — it is the spread.
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
const out = path.resolve(args.out || '/tmp/rhythm');
const seconds = Number(args.seconds ?? 30);
const log = (...m) => console.error('[rhythm]', ...m);
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

  // ---- in play: when the audio's step counter increments, on the audio's own clock -------------
  const play = await page.evaluate(async (secs) => {
    const P = window.__ZR_PLAY__;
    const A = window.__ZR_AUDIO__;
    const key = (c, t) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }));
    const out = {};
    // short legs through the plaza, re-placed before he can leave it. The first version held W for
    // thirty seconds, which at a run is a hundred and thirty metres — he left the village and jammed
    // against terrain, and the harness read that as a gait taking a step and a half a second.
    const LEGS = [
      [1.5, -4, 180],
      [1.5, -12, 0],
      [-1.5, -6, 90],
      [3.5, -8, 270],
    ];
    for (const [gait, shift] of [
      ['walk', false],
      ['run', true],
    ]) {
      let leg = 0;
      P.place(LEGS[0][0], LEGS[0][1], Math.PI);
      key('KeyW', 'keydown');
      if (shift) key('ShiftLeft', 'keydown');
      const dt = 1 / 60;
      const frame = () => new Promise((r) => setTimeout(r, dt * 1000));
      for (let i = 0; i < 90; i++) {
        P.step(1, dt, false);
        await frame();
      }
      // timed on the AudioContext's clock, not the wall clock. Pacing a loop with setTimeout is
      // only as good as the work inside it, and a run makes more audio per frame than a walk — the
      // first version of this read a run as SLOWER than a walk because its loop could not keep up.
      // contextTime advances in real time whatever the loop does, and it is the clock the steps are
      // actually scheduled on.
      let last = A.stats().steps;
      const at = [];
      const c0 = A.stats().contextTime;
      while (A.stats().contextTime - c0 < secs) {
        P.step(1, dt, false);
        await frame();
        const s = A.stats();
        if (s.steps > last) {
          for (let k = 0; k < s.steps - last; k++) at.push(+(s.contextTime - c0).toFixed(4));
          last = s.steps;
        }
        // back to the start of a leg every five seconds, so he never runs out of flagstones
        if (Math.floor((s.contextTime - c0) / 5) !== leg % 100) {
          leg = Math.floor((s.contextTime - c0) / 5);
          const L = LEGS[leg % LEGS.length];
          P.place(L[0], L[1], (L[2] * Math.PI) / 180);
        }
      }
      key('KeyW', 'keyup');
      if (shift) key('ShiftLeft', 'keyup');
      out[gait] = at;
      for (let i = 0; i < 40; i++) {
        P.step(1, dt, false);
        await frame();
      }
    }
    return out;
  }, seconds);
  log(`in play: ${play.walk.length} walking steps, ${play.run.length} running`);

  // ---- and a render of the same thing, which has no character system --------------------------
  const b64 = await page.evaluate(async () => {
    const r = await window.__ZR_AUDIO__.renderOffline(52, 44100, { stem: 'steps', reverb: false });
    let s = '';
    for (let i = 0; i < r.wav.length; i += 0x8000) s += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
    return btoa(s);
  });
  fs.writeFileSync(path.join(out, 'render.wav'), Buffer.from(b64, 'base64'));
  fs.writeFileSync(path.join(out, 'play.json'), JSON.stringify({ seconds, ...play }, null, 1));
  log(`-> ${out}`);
} finally {
  await browser.close();
  await server.close();
}
