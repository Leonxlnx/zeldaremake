#!/usr/bin/env node
/**
 * dry.mjs — the footsteps with the hall and the room switched off, so the trim can be priced exactly.
 *
 *   node art/audio/2026-09-26-release/dry.mjs --dist dist [--out /tmp/release/before]
 *
 * `SFX_TRIM` sits on the sfx bus, after the compressor. The steps' reverb sends do NOT: they are
 * taken off the panner and go straight to the hall and the room, whose returns join the master
 * (`createFootsteps` in footsteps.ts, `createBuses` in graph.ts). So a change to the trim scales
 * the direct sound of a step and leaves its tail exactly where it was.
 *
 * That makes the trim priceable without rendering once per candidate value. The mix is a sum of
 * three linear parts —
 *
 *     mix = rest + dry + tail        rest = the bed and the music
 *
 * — and only `dry` moves. Render `dry` once (this file) and every cut is arithmetic: see `price.py`.
 * `reverb: false` zeroes both returns and touches nothing upstream, so the sfx bus carries exactly
 * the same signal into the same compressor and the seeded streams are drawn in the same order.
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
const out = path.resolve(args.out || '/tmp/release/before');
const seconds = Number(args.seconds ?? 64);
fs.mkdirSync(out, { recursive: true });

/** the same plaza spine, the same lead, the same speeds as `2026-09-26-limiter/render.mjs` */
const LINE = { from: [0, 8], to: [0, -12] };

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  for (const [gait, speed] of [
    ['walk', 1.2],
    ['run', 2.2],
  ]) {
    const r = await page.evaluate(
      async (from, to, sp, secs) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'steps', limiter: true, reverb: false, pass: { from, to, speed: sp, lead: 2, loop: true } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return btoa(b);
      },
      LINE.from,
      LINE.to,
      speed,
      seconds,
    );
    fs.writeFileSync(path.join(out, `${gait}-steps-dry.wav`), Buffer.from(r, 'base64'));
    console.error(`[dry] ${gait} at ${speed} m/s — steps, compressor on, no hall and no room`);
  }
} finally {
  await browser.close();
  await server.close();
}
