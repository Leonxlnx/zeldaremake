#!/usr/bin/env node
/**
 * steps.mjs — the footsteps stem walked with the ravine switched off and switched on.
 *
 *   node art/audio/2026-09-26-ravine/steps.mjs --dist dist --out /tmp/ravine --tag before
 *
 * `surfaceAt` has known about the ravine since the south expansion cut it: `gorgeAt` returns 1.00
 * the whole way across the bridge and falls off over about eleven metres either side. The BED uses
 * it — `GORGE_HALL` and `GORGE_WIND` in ambience.ts. His boots do not: `footsteps.drive` is handed
 * `speed`, `surface`, `onStairs` and `enclosure`, and nothing else. A player walking out over eight
 * metres of open air with rock either side makes exactly the sound he makes on a veranda.
 *
 * That is the same hole `2026-09-24-room` found for the huts, in the one place in this world where
 * a contact would obviously answer, so it is measured the same way: render the footsteps stem with
 * the space term forced to 0 and to 1 and subtract. If the boots do not know, the two files differ
 * only at the renderer's own last bit — about −112 dB, which is this instrument's floor and not a
 * change (`2026-09-24-room` established that, and `2026-09-26-release` re-measured it at −108).
 *
 * `OFFLINE_WALK`'s last leg, 45–50 s, is the bridge. Every earlier leg is unaffected by the term
 * and is therefore the control: whatever a ravine does, it must not reach the stair flight.
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
const out = path.resolve(args.out || '/tmp/ravine');
const tag = args.tag || 'take';
const seconds = Number(args.seconds ?? 52);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  // `gorge0` and `gorge1` force the term the whole way, which is what isolates the space — every
  // leg is then the same walk with and without a ravine round it. `shipped` forces nothing, so the
  // term comes from the walk itself (1 on the bridge leg, 0 everywhere else) and is the take that
  // says the ravine stays where the ravine is.
  for (const [name, gorge] of [
    ['gorge0', 0],
    ['gorge1', 1],
    ['shipped', null],
  ]) {
    const r = await page.evaluate(
      async (secs, g) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, g === null ? { stem: 'steps' } : { stem: 'steps', gorge: g });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return btoa(b);
      },
      seconds,
      gorge,
    );
    fs.writeFileSync(path.join(out, `${tag}-${name}.wav`), Buffer.from(r, 'base64'));
    console.error(`[ravine] ${tag}, ${gorge === null ? 'the term as the walk sets it' : `gorge forced to ${gorge}`}`);
  }
} finally {
  await browser.close();
  await server.close();
}
