#!/usr/bin/env node
/**
 * turn.mjs — does the forest stay where it is when he turns round?
 *
 *   node art/audio/2026-09-25-facing/turn.mjs --dist dist [--out /tmp/turn] [--seconds 75]
 *
 * Everything in the bed that has a direction — the birds on their perches, the canopy roll coming
 * from upwind, a pod lantern beside the path — is panned against `forward`, the way the listener is
 * facing. That is the only thing making the world a place rather than a pair of speakers: turn
 * ninety degrees and a bird that was on your left has to move to the front.
 *
 * Nothing has ever checked that it does. The pan is computed in `ambience.ts` from `forward` and a
 * world vector, and a sign error or a stale heading would be invisible in every measurement this
 * lane has made, because all of them are mono sums or single-position renders.
 *
 * So: one spot, four facings, the same seed and the same 75 s. `renderOffline({ at: { facing } })`
 * holds everything else still. If the panning works, a source fixed in the world sweeps across the
 * stereo field as the listener turns under it, and the four takes differ in their left/right
 * balance in a way that follows the turn. If it does not, the four takes are the same file.
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
const out = path.resolve(args.out || '/tmp/turn');
const seconds = Number(args.seconds ?? 75);
const log = (...m) => console.error('[turn]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the north forest floor: crowns closed, no lantern in earshot, so the birds are what is panned */
const AT = [12, -38];
const FACINGS = [0, 90, 180, 270];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const rows = [];
  for (const deg of FACINGS) {
    const r = await page.evaluate(
      async (at, facing, secs) => {
        const res = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: { x: at[0], z: at[1], facing: (facing * Math.PI) / 180 } });
        let s = '';
        for (let i = 0; i < res.wav.length; i += 0x8000) s += String.fromCharCode(...res.wav.subarray(i, i + 0x8000));
        return { wav: btoa(s), stats: window.__ZR_AUDIO__.stats?.() ?? null };
      },
      AT,
      deg,
      seconds,
    );
    fs.writeFileSync(path.join(out, `facing-${deg}.wav`), Buffer.from(r.wav, 'base64'));
    rows.push({ deg, stats: r.stats });
    log(`facing ${deg}\u00b0`);
  }
  fs.writeFileSync(path.join(out, 'turn.json'), JSON.stringify({ at: AT, seconds, facings: rows }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
