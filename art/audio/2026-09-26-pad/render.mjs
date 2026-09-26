#!/usr/bin/env node
/**
 * render.mjs — the takes needed to ask whether the sfx compressor is still earning its keep.
 *
 *   node art/audio/2026-09-26-pad/render.mjs --dist dist [--out /tmp/pad]
 *
 * `2026-09-26-release` closed the owner's *"the music kind of still shakes whenever I run"* with a
 * 4 dB cut on the sfx bus, and ended by naming the compressor above that cut as the next thing to
 * look at. Three measurements now point the same way:
 *
 *   every step is in full four-to-one compression (`-perstep`), so the node is not a limiter
 *   catching overshoot, it is a fixed pad with a wobble;
 *   the wobble is worth nothing — from 60 ms to 1000 ms of release the step-rate line moves 0.4 dB
 *   (`-release`);
 *   and it costs 2.4 dB of the difference between a walk and a run (a run peaks +3.97 dB over a
 *   walk with the compressor out and +1.55 dB with it in, `-limiter`).
 *
 * A fixed pad with a wobble, whose wobble does nothing and which flattens the one distinction the
 * player's own feet make, is a plain gain written the expensive way. This renders the takes that
 * price the alternative exactly, at both gaits:
 *
 *   mix-on, steps-on       the shipped path, compressor and trim
 *   mix-off, steps-off     the bypassed path, which is what a plain gain would feed
 *   dry-off                the bypassed steps with the hall and room off, so any pad on that path
 *                          is arithmetic rather than another render (see `-release/price.py`)
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
const out = path.resolve(args.out || '/tmp/pad');
const seconds = Number(args.seconds ?? 64);
const log = (...m) => console.error('[pad]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the plaza spine: stone end to end, no enclosure — the same line every take on this lane uses */
const LINE = { from: [0, 8], to: [0, -12] };
/** name → [stem, limiter, reverb] */
const TAKES = {
  'mix-on': ['mix', true, true],
  'steps-on': ['steps', true, true],
  'mix-off': ['mix', false, true],
  'steps-off': ['steps', false, true],
  'dry-off': ['steps', false, false],
};

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const [gait, speed] of [
    ['walk', 1.2],
    ['run', 2.2],
  ]) {
    for (const [name, [stem, limiter, reverb]] of Object.entries(TAKES)) {
      const r = await page.evaluate(
        async (from, to, sp, secs, st, lim, rev) => {
          const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: st, limiter: lim, reverb: rev, pass: { from, to, speed: sp, lead: 2, loop: true } });
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
        reverb,
      );
      fs.writeFileSync(path.join(out, `${gait}-${name}.wav`), Buffer.from(r, 'base64'));
    }
    done.push({ gait, speed });
    log(`${gait} at ${speed} m/s — ${Object.keys(TAKES).length} takes`);
  }
  fs.writeFileSync(path.join(out, 'takes.json'), JSON.stringify({ seconds, lead: 2, line: LINE, takes: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
