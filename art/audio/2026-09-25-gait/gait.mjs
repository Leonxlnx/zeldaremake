#!/usr/bin/env node
/**
 * gait.mjs — a walk and a run on the same stone, from the same render.
 *
 *   node art/audio/2026-09-25-gait/gait.mjs --dist dist [--out /tmp/gait] [--seconds 52]
 *
 * Check 21 of `art/audio/RUBRIC_50_SOUND.md` is "walking and running differ in more than rate", and
 * I scored it 3 with the note that it was measured for level and not for spectral character. The
 * code says the same thing more plainly: `designStep`'s docstring claims `running` "shortens the
 * heel-to-toe gap and hardens the heel", and `running` appears in exactly one expression —
 *
 *     const toe = (running ? 0.05 : 0.1) * j(0.22);
 *
 * — which is the gap and not the heel. So a run may be nothing but a louder walk with its toe
 * closer behind, and that is a question for a measurement.
 *
 * `OFFLINE_WALK` already has the pair: flagstones at a walk from 13 to 18 s, and the same flagstones
 * at a run from 36 to 41. Same surface, same seed, same render — the only difference is the gait.
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
const out = path.resolve(args.out || '/tmp/gait');
const seconds = Number(args.seconds ?? 52);
const log = (...m) => console.error('[gait]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  // dry: the hall's tail across a run's cadence smears one step into the next, and this is about
  // the step, not the space it is in
  for (const [tag, reverb] of [
    ['steps', true],
    ['dry', false],
  ]) {
    const b64 = await page.evaluate(
      async (secs, rev) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'steps', reverb: rev });
        let s = '';
        for (let i = 0; i < r.wav.length; i += 0x8000) s += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
        return btoa(s);
      },
      seconds,
      reverb,
    );
    fs.writeFileSync(path.join(out, `${tag}.wav`), Buffer.from(b64, 'base64'));
    log(`${tag}.wav`);
  }
  fs.writeFileSync(path.join(out, 'gait.json'), JSON.stringify({ seconds, legs: { walk: [13, 18], run: [36, 41] } }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
