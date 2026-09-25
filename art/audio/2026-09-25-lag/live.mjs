#!/usr/bin/env node
/**
 * live.mjs — the same journey in the real game, with the real graph.
 *
 *   node art/audio/2026-09-25-lag/live.mjs --dist dist [--out /tmp/lag] [--seconds 15]
 *
 * Everything else here is `renderOffline`, which builds the same graph against a perfect clock.
 * This drives play mode instead: real key events, the character system's own gait, the world's own
 * gust, and the live `setInterval` tick — then records the master with `__ZR_AUDIO__.record`.
 *
 * It answers two questions and not a third. It says whether the live path still works after the
 * constants moved (voices, errors, steps, and whether the enclosure term the offline pass reads
 * from `surfaceAt` is the one the game actually feeds the bed). It does **not** resolve the change:
 * the master carries the score and boots at a run over the bed, and both are louder in the bands
 * the bed's top lives in than the bed is. That is why this lane measures stems.
 *
 * Two harness traps, both paid for on this branch. `__ZR_PLAY__.step` with `render: true` draws a
 * frame through SwiftShader, which takes seconds, while the audio ticks on the wall clock — the
 * first run of this logged 3 simulation frames against 12 seconds of recording. And a run is
 * 4.2 m/s, so he leaves the wood in five seconds; he is put back at the start on a timer.
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
const out = path.resolve(args.out || '/tmp/lag');
const seconds = Number(args.seconds ?? 15);
const log = (...m) => console.error('[live]', ...m);
fs.mkdirSync(out, { recursive: true });

// the `bore-run` take's own start, from takes.json
const TAKE = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'takes.json'), 'utf8')).takes.find((t) => t.id === 'bore-run');

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  // M twice: the first gesture creates the context (autoplay rules), the second unmutes
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1500));

  const data = await page.evaluate(
    async (take, secs) => {
      const P = window.__ZR_PLAY__;
      const A = window.__ZR_AUDIO__;
      const key = (c, t) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }));
      const yaw = Math.atan2(take.to[0] - take.from[0], take.to[1] - take.from[1]);
      const start = () => P.place(take.from[0], take.from[1], yaw);
      P.setPlayMode?.(true);
      start();
      await new Promise((r) => setTimeout(r, 400));
      const rec = A.record(secs);
      key('ShiftLeft', 'keydown');
      key('KeyW', 'keydown');
      const samples = [];
      const t0 = performance.now();
      let last = t0;
      let placed = t0;
      while (performance.now() - t0 < secs * 1000) {
        await new Promise((r) => setTimeout(r, 8));
        const now = performance.now();
        P.step(1, Math.min(0.05, (now - last) / 1000), false);
        last = now;
        const s = A.stats();
        const l = P.state().link;
        if (s) samples.push([Number(((now - t0) / 1000).toFixed(2)), s.voices, Number((s.enclosure ?? 0).toFixed(2)), Number((s.canopy ?? 0).toFixed(2)), l ? Number(l[2].toFixed(1)) : null]);
        if (now - placed > 5000) {
          start();
          placed = now;
        }
      }
      key('KeyW', 'keyup');
      key('ShiftLeft', 'keyup');
      const bytes = await rec;
      let b = '';
      for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const s = A.stats();
      return { webm: btoa(b), samples, stats: { voices: s.voices, pods: s.pods, steps: s.steps, birds: s.birds, state: s.state, music: s.music, gaitDriven: s.gaitDriven } };
    },
    TAKE,
    seconds,
  );

  fs.writeFileSync(path.join(out, 'live-bore.webm'), Buffer.from(data.webm, 'base64'));
  const v = data.samples.map((s) => s[1]);
  const enc = data.samples.map((s) => s[2]);
  const summary = {
    seconds,
    simFrames: data.samples.length,
    stats: data.stats,
    pageErrors: errs,
    voices: { min: Math.min(...v), max: Math.max(...v) },
    enclosure: { max: Math.max(...enc), framesInBore: enc.filter((e) => e > 0.9).length },
  };
  fs.writeFileSync(path.join(out, 'live-bore.json'), JSON.stringify({ ...summary, samples: data.samples }, null, 1));
  log(JSON.stringify(summary));
} finally {
  await browser.close();
  await server.close();
}
