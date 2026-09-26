#!/usr/bin/env node
/**
 * render.mjs — the mix at a run, with the sfx compressor and without it.
 *
 *   node art/audio/2026-09-26-limiter/render.mjs --dist dist [--out /tmp/limiter]
 *
 * The compressor on the sfx bus exists because the owner said, at 23:00 on 2026-09-24, that the
 * music *"kind of still shakes whenever I run"*. Its comment explains the mechanism: the footsteps
 * are the loudest transients in the game and at a running cadence they arrive several times a
 * second, so the strongest rhythm in the mix's envelope stops being the music's beat and becomes
 * the step rate.
 *
 * Two things have changed since. `2026-09-26-perstep` measured that every step is in full
 * four-to-one compression — the comment's "quiet steps pass untouched" is not true of any step the
 * game makes — and PR #59 replaced the controller, so the run that prompted the complaint (4.6 m/s,
 * five steps a second, step force 0.76) is now 2.2 m/s, 3.67 a second, 0.69.
 *
 * So: the same run, mixed both ways, and the same walk, so the gait difference can be read off the
 * same takes. `limiter: false` takes the compressor and its makeup trim out together.
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
const out = path.resolve(args.out || '/tmp/limiter');
const seconds = Number(args.seconds ?? 64);
const log = (...m) => console.error('[limiter]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the plaza spine: stone end to end, no enclosure — the same line `2026-09-26-perstep` used */
const LINE = { from: [0, 8], to: [0, -12] };

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const [gait, speed] of [
    ['walk', 1.2],
    ['run', 2.2],
  ]) {
    for (const stem of ['mix', 'steps']) {
      for (const [tag, limiter] of [
        ['on', true],
        ['off', false],
      ]) {
        const r = await page.evaluate(
          async (from, to, sp, secs, st, lim) => {
            const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: st, limiter: lim, pass: { from, to, speed: sp, lead: 2, loop: true } });
            let b = '';
            for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
            return btoa(b);
          },
          LINE.from,
          LINE.to,
          speed,
          seconds,
          stem,
          limiter,
        );
        fs.writeFileSync(path.join(out, `${gait}-${stem}-${tag}.wav`), Buffer.from(r, 'base64'));
      }
    }
    done.push({ gait, speed });
    log(`${gait} at ${speed} m/s — mix and steps, compressor on and off`);
  }
  fs.writeFileSync(path.join(out, 'takes.json'), JSON.stringify({ seconds, lead: 2, line: LINE, takes: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
