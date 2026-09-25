#!/usr/bin/env node
/**
 * cost.mjs — what the audio costs, from the two angles this box can actually see.
 *
 *   node art/audio/2026-09-25-cost/cost.mjs --dist dist [--out /tmp/cost] [--seconds 70]
 *
 * Check 49 of `art/audio/RUBRIC_50_SOUND.md` is "it costs what it should: the audio thread is not
 * near its deadline under the worst case", and it scores **2** — the lowest score in the rubric
 * after the one hole that needs other lanes. The reason is honest and unhelpful: the direct read is
 * `AudioContext.renderCapacity`, the diagnostic is plumbed for it (`stats().load`), and this Chrome
 * does not implement it, so it has always come back null.
 *
 * Two things can be measured without it.
 *
 * **How fast the graph renders.** An `OfflineAudioContext` runs the same graph as fast as it can, so
 * seconds-of-audio per second-of-wall-clock is a real-time factor for the DSP. It is not the audio
 * thread — no callback deadline, no 128-sample quantum pressure, a different machine state — but a
 * graph that renders at 40x real time is not one that misses a 2.7 ms deadline, and the RATIO
 * between an ordinary scene and the worst case is meaningful whatever the absolute number is.
 *
 * **How many voices are alive.** Every event builds a chain of nodes and tears it down; `voices`
 * counts them. The soak measured it wandering (5-13) over thirteen minutes of ordinary play. Nobody
 * has counted it under the worst case the headroom was sized against — running and jumping
 * continuously on the flagstones under the densest cluster of lanterns in the world, with the score
 * playing — which is where it would peak if it peaks anywhere.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/cost');
const seconds = Number(args.seconds ?? 70);
const log = (...m) => console.error('[cost]', ...m);
fs.mkdirSync(out, { recursive: true });

const result = { render: [], worst: null };
const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  // ---- 1. how fast the graph renders, per stem ------------------------------------------------
  {
    const { page } = await openWorld(browser, server.url, { quality: 'high' });
    for (const stem of ['bed', 'steps', 'music', 'mix']) {
      for (const secs of [30, 120]) {
        const r = await page.evaluate(
          async (st, n) => {
            const t0 = performance.now();
            await window.__ZR_AUDIO__.renderOffline(n, 44100, { stem: st });
            return performance.now() - t0;
          },
          stem,
          secs,
        );
        result.render.push({ stem, seconds: secs, wallMs: Math.round(r), timesRealTime: +(secs / (r / 1000)).toFixed(1) });
        log(`${stem} ${secs} s rendered in ${(r / 1000).toFixed(2)} s — ${(secs / (r / 1000)).toFixed(1)}x real time`);
      }
    }
  }

  // ---- 2. voices under the worst case, sampled all the way through ----------------------------
  {
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
    log('audio started; driving the worst case');
    result.worst = await page.evaluate(async (secs) => {
      const P = window.__ZR_PLAY__;
      const A = window.__ZR_AUDIO__;
      const key = (code, type) => window.dispatchEvent(new KeyboardEvent(code === 'Space' ? type : type, { code, bubbles: true }));
      // the same legs the headroom worst case used: through the plaza's lantern cluster, never out of it
      const LEGS = [
        [1.5, -4, 180],
        [1.5, -12, 0],
        [-1.5, -6, 90],
        [3.5, -8, 270],
      ];
      P.place(LEGS[0][0], LEGS[0][1], Math.PI);
      key('KeyW', 'keydown');
      key('ShiftLeft', 'keydown');
      const a0 = A.stats();
      const samples = [];
      const t0 = performance.now();
      let legAt = 0;
      let leg = 0;
      let jumpAt = -1;
      let sampleAt = 0;
      while (performance.now() - t0 < secs * 1000) {
        const ms = performance.now() - t0;
        if (ms - legAt > 6000) {
          legAt = ms;
          leg = (leg + 1) % LEGS.length;
          P.place(LEGS[leg][0], LEGS[leg][1], (LEGS[leg][2] * Math.PI) / 180);
        }
        if (ms / 1000 - jumpAt > 0.9) {
          jumpAt = ms / 1000;
          key('Space', 'keydown');
          setTimeout(() => key('Space', 'keyup'), 60);
        }
        if (ms - sampleAt > 500) {
          sampleAt = ms;
          const s = A.stats();
          samples.push({ at: Math.round(ms), voices: s.voices, load: s.load, heap: s.heap ?? null });
        }
        P.step(1, 1 / 60, false);
        await new Promise((r2) => requestAnimationFrame(r2));
      }
      key('KeyW', 'keyup');
      key('ShiftLeft', 'keyup');
      const a1 = A.stats();
      return { samples, steps: a1.steps - a0.steps, landings: a1.landings - a0.landings, pushOffs: (a1.pushOffs ?? 0) - (a0.pushOffs ?? 0), pods: a1.pods, music: a1.music, seconds: secs };
    }, seconds);
    const v = result.worst.samples.map((s) => s.voices);
    log(`${result.worst.steps} steps, ${result.worst.landings} landings, ${result.worst.pushOffs} shoves in ${seconds} s`);
    log(`voices ${Math.min(...v)}–${Math.max(...v)} (median ${v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)]}), renderCapacity ${result.worst.samples[0].load === null ? 'unsupported here' : 'read'}`);
  }
  fs.writeFileSync(path.join(out, 'cost.json'), JSON.stringify(result, null, 1));
  log(`-> ${path.join(out, 'cost.json')}`);
} finally {
  await browser.close();
  await server.close();
}
