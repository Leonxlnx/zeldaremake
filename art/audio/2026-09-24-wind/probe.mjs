#!/usr/bin/env node
/**
 * probe.mjs — how often does the wind actually drop?
 *
 *   node art/audio/2026-09-24-wind/probe.mjs --dist dist [--minutes 5]
 *
 * The lane's answer to "LOWER THE WHITE NOISE" was to stop the wind bed being a bed: below
 * `GUST_KNEE` the canopy roll and the leaf hush are *silent*, not faint, and above it the swell is
 * bigger than the constant bed it replaced. The forest is only heard when something moves in it.
 *
 * That design has one load-bearing assumption nobody has ever checked: **that the world's wind
 * spends a real share of its time under the knee.** If it does not, the gate never fires, the bed
 * is on whenever the player is listening, and the fix was a reshaping rather than a removal.
 *
 * The offline render's gust is a formula this lane wrote, so it cannot answer the question. This
 * samples the world's own `uGust` — what `ambience.update` is actually handed, through
 * `__ZR_AUDIO__.stats().gust` — for minutes at a time in play mode, and reports its distribution
 * against the knee.
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
const out = path.resolve(args.out || '/tmp/wind');
const minutes = Number(args.minutes ?? 5);
const log = (...m) => console.error('[wind]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('console', (m) => {
    if (m.text().startsWith('[audio]')) log(m.text());
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));
  log('sampling the world wind; Link stands still on the plaza');

  const samples = await page.evaluate(async (mins) => {
    const P = window.__ZR_PLAY__;
    const A = window.__ZR_AUDIO__;
    P.setPlayMode(true);
    P.place(1.5, -6, Math.PI);
    const out = [];
    const t0 = performance.now();
    let next = 0;
    // the world's wind advances with the frames it is stepped, so step at a fixed 60 Hz and record
    // against the SIMULATED clock — a headless page does not run at wall-clock speed
    let sim = 0;
    while (performance.now() - t0 < mins * 60 * 1000) {
      P.step(1, 1 / 60, false);
      sim += 1 / 60;
      if (sim >= next) {
        out.push([Number(sim.toFixed(2)), Number((A.stats()?.gust ?? -1).toFixed(4))]);
        next += 0.1;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return out;
  }, minutes);

  fs.writeFileSync(path.join(out, 'gust.json'), JSON.stringify(samples));
  const g = samples.map((s) => s[1]).filter((v) => v >= 0);
  const sorted = [...g].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  const under = (k) => (100 * g.filter((v) => v <= k).length) / g.length;
  log(`${g.length} samples over ${samples[samples.length - 1][0].toFixed(0)} s of simulated time`);
  log(`min ${q(0).toFixed(3)}  p10 ${q(0.1).toFixed(3)}  p50 ${q(0.5).toFixed(3)}  p90 ${q(0.9).toFixed(3)}  max ${q(1).toFixed(3)}`);
  for (const k of [0.1, 0.22, 0.3, 0.4, 0.5]) log(`  below ${k.toFixed(2)}: ${under(k).toFixed(1)} % of the time`);
} finally {
  await browser.close();
  await server.close();
}
