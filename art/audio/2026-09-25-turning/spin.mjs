#!/usr/bin/env node
/**
 * spin.mjs — where the birds are, against where he is looking when they sing.
 *
 *   node art/audio/2026-09-25-turning/spin.mjs --dist dist [--out /tmp/spin] [--seconds 300]
 *
 * A bird's pan is a BEARING seen from his facing (`panFor(forwardNow, perch)`), and it is worked
 * out in `scheduleBirds` — which runs on a four-second lookahead. The answering call is booked from
 * the same tick and sounds a further 1.1 to 2.5 s after that. So every call in the wood is panned
 * to the way he was facing up to four seconds ago, and an answer to up to six and a half.
 *
 * Turning is what makes that matter rather than walking. A perch is stored as a bearing and a
 * distance from the anchor, so walking about does not change where a bird is in the field at all
 * (that is deliberate, `PERCH_RESEED_M`) — but the pan is `sin(bearing − facing)`, so turning does,
 * and turning is the thing a player does most.
 *
 * `renderOffline({ at: { turn } })` stands him on the plaza and turns him at a steady rate.
 * `stats().birdSpots` now carries the context time each call is booked to sound, so the error is
 * exact and needs no audio analysis: the pan it got, against the pan its own bearing has when it
 * actually sings.
 *
 * Rates are what a player really does. `--rates` overrides them; the default set brackets the
 * camera turn rates `playtest.mjs` measures on its own walk routes (p50 3.8, p95 60, max 81 deg/s).
 * Takes are 120 s so that every call fits inside `BIRD_SPOT_MEMORY` and none is forgotten.
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
const out = path.resolve(args.out || '/tmp/spin');
const tag = String(args.tag || 'after');
const seconds = Number(args.seconds ?? 120);
const rates = String(args.rates ?? '0,10,30,60').split(',').map(Number);
const log = (...m) => console.error('[spin]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the plaza, where a player spends most of his time and where the perches are seeded round him */
const SPOT = { x: 0.5, z: 2.0 };

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const takes = [];
  for (const turn of rates) {
    const r = await page.evaluate(
      async (x, z, secs, deg) => {
        const out = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: { x, z, turn: deg } });
        let o = '';
        for (let i = 0; i < out.wav.length; i += 0x8000) o += String.fromCharCode(...out.wav.subarray(i, i + 0x8000));
        return { wav: btoa(o), spots: out.bed?.birdSpots ?? [], birds: out.bed?.birds ?? 0 };
      },
      SPOT.x,
      SPOT.z,
      seconds,
      turn,
    );
    fs.writeFileSync(path.join(out, `spin-${turn}-${tag}.wav`), Buffer.from(r.wav, 'base64'));
    takes.push({ turn, seconds, birds: r.birds, spots: r.spots });
    log(`turn ${turn} deg/s — ${seconds} s, ${r.birds} calls (${r.spots.length} remembered)`);
  }
  fs.writeFileSync(path.join(out, `takes-${tag}.json`), JSON.stringify({ tag, spot: SPOT, seconds, takes }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
