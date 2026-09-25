#!/usr/bin/env node
/**
 * live.mjs — turning on the spot in the real game.
 *
 *   node art/audio/2026-09-25-turning/live.mjs --dist dist [--out /tmp/spin] [--seconds 30]
 *
 * The measurement is offline, because a bird has to be pulled out of the bed to be seen at all and
 * the live master has the score and the boots over it. This is the health check for the path the
 * player is actually on: the register of live voices lives in the live `update`, and a register
 * that never lets go leaks.
 *
 * Link's heading is what the bed faces by (`index.ts`: `player.heading()` in play mode), and
 * `__ZR_PLAY__.place` sets it, so turning him is a placement a frame at a steady rate. `windLean`
 * is the bed's own report of which way he is facing, so it doubles as proof that the facing is
 * reaching the bed at all.
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
const out = path.resolve(args.out || '/tmp/spin');
const seconds = Number(args.seconds ?? 30);
const rate = Number(args.rate ?? 60);
const log = (...m) => console.error('[live]', ...m);
fs.mkdirSync(out, { recursive: true });

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
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1500));

  const data = await page.evaluate(
    async (secs, degPerS) => {
      const P = window.__ZR_PLAY__;
      const A = window.__ZR_AUDIO__;
      P.setPlayMode?.(true);
      const rec = A.record(secs);
      const samples = [];
      const t0 = performance.now();
      let last = t0;
      while (performance.now() - t0 < secs * 1000) {
        await new Promise((r) => setTimeout(r, 8));
        const now = performance.now();
        // render: false — SwiftShader draws a frame in seconds and the audio ticks on the wall clock
        P.step(1, Math.min(0.05, (now - last) / 1000), false);
        last = now;
        P.place(0.5, 2.0, (((now - t0) / 1000) * degPerS * Math.PI) / 180);
        const s = A.stats();
        if (s) samples.push([Number(((now - t0) / 1000).toFixed(2)), s.voices, Number(s.windLean.toFixed(3)), s.birds]);
      }
      const bytes = await rec;
      let b = '';
      for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const s = A.stats();
      return { webm: btoa(b), samples, stats: { voices: s.voices, birds: s.birds, flutters: s.flutters, state: s.state, music: s.music } };
    },
    seconds,
    rate,
  );

  fs.writeFileSync(path.join(out, 'live-turn.webm'), Buffer.from(data.webm, 'base64'));
  const v = data.samples.map((s) => s[1]);
  const lean = data.samples.map((s) => s[2]);
  const summary = {
    seconds,
    degPerS: rate,
    simFrames: data.samples.length,
    stats: data.stats,
    pageErrors: errs,
    voices: { min: Math.min(...v), max: Math.max(...v), last: v[v.length - 1] },
    windLean: { min: Math.min(...lean), max: Math.max(...lean), crossings: lean.filter((x, i) => i && x * lean[i - 1] < 0).length },
  };
  fs.writeFileSync(path.join(out, 'live-turn.json'), JSON.stringify({ ...summary, samples: data.samples }, null, 1));
  log(JSON.stringify(summary));
} finally {
  await browser.close();
  await server.close();
}
