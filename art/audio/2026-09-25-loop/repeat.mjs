#!/usr/bin/env node
/**
 * repeat.mjs — does the forest repeat itself? (rubric check 4)
 *
 *   node art/audio/2026-09-25-loop/repeat.mjs --dist dist [--out /tmp/loop] [--seconds 300]
 *
 * Check 4 of `art/audio/RUBRIC_50_SOUND.md` is "nothing in it is periodic: no LFO an ear can lock
 * onto after a minute", and I scored it 3 with the note that it was *believed* rather than measured
 * — every modulator is a seeded random walk and a test forbids a held tone, so it looked safe.
 *
 * Looking at the code again, there is a reason to doubt it. The whole bed is tapped off ONE shared
 * pink-noise buffer, and that buffer is **nine seconds long and looped**. The control envelopes
 * that ride it are 47 s buffers, also looped. So the bed's actual texture — the grain of the roar,
 * the particular way one gust sounds — cannot help repeating every nine seconds, however irregular
 * the level riding on top of it is. This lane already knows this failure for footsteps, where the
 * loop was taken from 2 s to 5.3 because "a short loop hands consecutive steps the same noise".
 *
 * A long take standing still is the only way to see it: the listener must not move, because moving
 * changes the filters and masks the repeat. Autocorrelation of the waveform finds the loop itself;
 * autocorrelation of the envelope finds whether the SHAPE repeats, which is what an ear locks onto.
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
const out = path.resolve(args.out || '/tmp/loop');
const seconds = Number(args.seconds ?? 300);
const log = (...m) => console.error('[loop]', ...m);
fs.mkdirSync(out, { recursive: true });

/** where to stand: the lawn by default (no lantern in earshot), `--at x,z` for anywhere else */
const AT = (args.at ? String(args.at).split(',').map(Number) : [-6.5, 2]);

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const b64 = await page.evaluate(
    async (at, secs) => {
      const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: { x: at[0], z: at[1] } });
      let s = '';
      for (let i = 0; i < r.wav.length; i += 0x8000) s += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
      return btoa(s);
    },
    AT,
    seconds,
  );
  fs.writeFileSync(path.join(out, 'standing.wav'), Buffer.from(b64, 'base64'));
  fs.writeFileSync(path.join(out, 'loop.json'), JSON.stringify({ at: AT, seconds }, null, 1));
  log(`${seconds} s standing at ${AT} -> ${path.join(out, 'standing.wav')}`);
} finally {
  await browser.close();
  await server.close();
}
