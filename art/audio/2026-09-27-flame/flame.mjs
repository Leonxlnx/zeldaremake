#!/usr/bin/env node
/**
 * flame.mjs — the loudest never-stopping thing in the world, on its own for the first time.
 *
 *   node art/audio/2026-09-27-flame/flame.mjs --dist dist --out /tmp/flame [--seconds 120]
 *
 * The world-floor survey named the loudest never-stopping place in the game — **a metre from a
 * pod lantern** — and the owner's standing complaint is noise that never stops. What nobody has
 * been able to ask is how much of that floor is the flame and how much is the forest behind it,
 * because until yesterday `mute` could not switch a flame off (`art/audio/2026-09-27-fairies/`).
 *
 * Two questions, and the second is the one the code already worries about in a comment:
 *
 *   1. **How much of the floor at a pod is the flame?** If it is most of it, the loudest
 *      never-stopping thing in the game is one voice and one constant.
 *   2. **Does a village of pods sum to a drone?** `LANTERN_CROWD_SHARE = 0.2` exists to stop
 *      that — *"a village of pods must not sum to a drone"* — and has never been measured. The
 *      lantern bough is the densest cluster in the world; a metre from a single pod at the path
 *      fork is the control.
 *
 * Three takes in each place: the whole bed, the flame alone, and everything except the flame.
 * `mute` leaves every draw and every node in place and omits only the connection to the bus, so
 * the three are the same forest with one thing switched.
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
const out = path.resolve(args.out || '/tmp/flame');
const seconds = Number(args.seconds ?? 120);
const log = (...m) => console.error('[flame]', ...m);
fs.mkdirSync(out, { recursive: true });

/** art/audio/2026-09-24-standing/places.json — the survey's own spots */
const PLACES = [
  ['pod', { x: -0.2, z: -1.2 }, 'a metre from a pod lantern at the path fork'],
  ['bough', { x: 1.5, z: -6 }, 'the village plaza, under the lantern bough'],
  ['lawn', { x: -6.5, z: 2 }, 'the lawn west of the spine, away from everything'],
];
/** the whole bed, the flame alone, and the forest the flame has to be heard over */
const TAKES = [
  ['bed', []],
  ['flame', ['wind', 'birds', 'flutters', 'glints']],
  ['without', ['flames']],
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.waitForFunction(() => !!window.__ZR_AUDIO__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  for (const [place, at, note] of PLACES) {
    for (const [name, mute] of TAKES) {
      const b64 = await page.evaluate(
        async ([secs, spot, m]) => {
          const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: spot, mute: m });
          let bin = '';
          for (let i = 0; i < r.wav.length; i += 0x8000) bin += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
          return btoa(bin);
        },
        [seconds, at, mute],
      );
      fs.writeFileSync(path.join(out, `${place}-${name}.wav`), Buffer.from(b64, 'base64'));
    }
    log(`${place}: ${note} → three takes`);
  }
  fs.writeFileSync(path.join(out, 'flame.json'), JSON.stringify({ seconds, places: PLACES, takes: TAKES.map((t) => t[0]) }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
