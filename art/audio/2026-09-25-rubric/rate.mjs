#!/usr/bin/env node
/**
 * rate.mjs — the same bed and the same boots at two sample rates (rubric check 40).
 *
 *   node art/audio/2026-09-25-rubric/rate.mjs --dist dist [--out /tmp/rate] [--seconds 52]
 *
 * Every number this lane has published comes from a 44.1 kHz offline render, and a real machine's
 * live `AudioContext` usually runs at 48 kHz — so the published numbers could have been describing
 * a rate nobody runs. Everything in `graph.ts` sizes its buffers from `ctx.sampleRate`, but two
 * things do not: the pink-noise filter's coefficients are Paul Kellet's 44.1 kHz values, and
 * `impulseResponse` ramps its onset over a fixed 400 samples (9.1 ms at 44.1, 8.3 at 48). Whether
 * either shows is a question for a measurement, not for reading the code.
 *
 * Also prints the rate the browser hands a live context, which is the other half of check 40 and
 * the half a headless box cannot answer for anyone else's machine.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/rate');
const seconds = Number(args.seconds ?? 52);
const RATES = [44100, 48000];
const STEMS = ['bed', 'steps'];
const log = (...m) => console.error('[rate]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const deviceRate = await page.evaluate(() => {
    const C = window.AudioContext ?? window.webkitAudioContext;
    const c = new C();
    const r = c.sampleRate;
    c.close();
    return r;
  });
  log(`this browser hands a live context at ${deviceRate} Hz`);
  for (const rate of RATES) {
    for (const stem of STEMS) {
      const b64 = await page.evaluate(
        async (secs, sr, st) => {
          const r = await window.__ZR_AUDIO__.renderOffline(secs, sr, { stem: st });
          let s = '';
          for (let i = 0; i < r.wav.length; i += 0x8000) s += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
          return btoa(s);
        },
        seconds,
        rate,
        stem,
      );
      fs.writeFileSync(path.join(out, `${stem}-${rate}.wav`), Buffer.from(b64, 'base64'));
      log(`${stem} at ${rate} Hz`);
    }
  }
  fs.writeFileSync(path.join(out, 'rate.json'), JSON.stringify({ deviceRate, rates: RATES, stems: STEMS, seconds }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
