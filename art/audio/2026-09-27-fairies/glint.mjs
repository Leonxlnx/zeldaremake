#!/usr/bin/env node
/**
 * glint.mjs — is the fairy cue ever actually heard?
 *
 *   node art/audio/2026-09-27-fairies/glint.mjs --dist dist --out /tmp/fairies
 *
 * *"A soft cue for the Kokiri fairies near them"* has sat on this lane's standing list since the
 * first day, and it has been answered four times with "the glint exists". It does: `ambience.ts`
 * schedules a few grains of bell every second or three while a fairy is inside `FAIRY_AUDIBLE_M`.
 * Nobody has checked whether a player ever hears one.
 *
 * Two things have to be true and neither has been measured:
 *
 *   1. **He has to get close enough.** `FAIRY_AUDIBLE_M` is 4.33 m — `FAIRY_REACH_M` (2.5) out to
 *      where the inverse-square law has taken three quarters of the level. The fairies hover
 *      beside the Kokiri kids, and where the kids are is not where the walk routes go.
 *   2. **It has to clear the forest.** `FAIRY_LEVEL` is 0.014, which is the smallest level in the
 *      bed by a long way, and the bed it has to be heard over is never silent.
 *
 * This renders both: the whole bed standing beside a fairy, and the same take with the wind and
 * the birds and the leaves muted so the glints are alone. `mute` leaves every draw in place and
 * only omits the connection, so the glints in the two takes are the same glints.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/fairies');
const seconds = Number(args.seconds ?? 90);
/** src/world/layout.ts npcSpots — the grass verge kid, the one on the plaza side */
const KID_ID = 'kokiri-a';
const KID = [9.0, 0, 3.6];
const log = (...m) => console.error('[glint]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.waitForFunction(() => !!window.__ZR_AUDIO__, { timeout: READY_TIMEOUT_MS, polling: 500 });

  // Where the fairies are. `stats().fairySpots` is filled by the LIVE tick and is empty in a
  // capture page, so the spots come from `LAYOUT.npcSpots` instead — each Kokiri kid carries a
  // fairy (`npc.ts` names it `kokiri-fairy-<slot>`), so a kid's spot is a fairy's spot to within
  // the hover.
  const at = { x: KID[0] + 1, z: KID[2] };
  log(`standing at (${at.x}, ${at.z}), a metre from ${KID_ID}`);

  for (const [name, mute] of [
    ['bed', []],
    // the glints ALONE. 'flames' is in this list because it has to be: a pod lantern is the
    // loudest never-stopping thing in the world and the fairy is the quietest thing in the bed,
    // so a take with only the wind and the birds and the leaves muted measures the lantern.
    ['glints', ['wind', 'birds', 'flutters', 'flames']],
    // and the forest the glint has to be heard over, which is everything except the glint
    ['without', ['glints']],
  ]) {
    const b64 = await page.evaluate(
      async ([secs, spot, m]) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: spot, mute: m });
        let bin = '';
        for (let i = 0; i < r.wav.length; i += 0x8000) bin += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
        return btoa(bin);
      },
      [seconds, at, mute],
    );
    fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.from(b64, 'base64'));
    log(`${seconds} s of ${name} → ${path.join(out, `${name}.wav`)}`);
  }
  // `stats()` is the LIVE system's and is null in a capture page; the counts that matter here
  // come out of the takes themselves
  fs.writeFileSync(path.join(out, 'glint.json'), JSON.stringify({ at, kid: KID_ID, seconds }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
