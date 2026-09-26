#!/usr/bin/env node
/**
 * flame.mjs — the pod lanterns alone, standing where the wall is between him and them.
 *
 *   node art/audio/2026-09-26-shadow2/flame.mjs --dist dist --out /tmp/shadow2 --tag before
 *
 * `audible.mjs` says where to stand: of the flame level arriving at (−25, 11), **97 % of it comes
 * from behind something** — the west house and the giant it is built around, exactly the case
 * `2026-09-25-occlusion` predicted from a Fresnel number and did not build. Two more spots nearby
 * are over 0.94, and the open lawn is the control, where nothing is in the way and the two takes
 * must be the same file.
 *
 * `mute: ['flutters', 'birds', 'wind']` leaves the pod flames and the fairy glints and nothing
 * else, so the flame's own band is not shared with the canopy roll (60–620 Hz overlaps it almost
 * exactly). Every random draw still happens and every node is still built — a muted layer is
 * simply not connected — so the take is the same forest with three things silent rather than a
 * different forest.
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
const out = path.resolve(args.out || '/tmp/shadow2');
const tag = args.tag || 'take';
const seconds = Number(args.seconds ?? 40);
fs.mkdirSync(out, { recursive: true });

/** from `audible.json`: the three most shadowed standing points, and one with nothing in the way */
const SPOTS = [
  { id: 'behind-west-house', at: [-25, 11], note: '97 % of the flame arriving here is behind the west house and its giant' },
  { id: 'behind-west-house-2', at: [-26, 9], note: '97 %, two metres along' },
  { id: 'west-approach', at: [-25, 7], note: '93 %, coming round the south side' },
  { id: 'open', at: [-6.5, 2.0], note: 'the lawn — nothing solid in the way, the control' },
];

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  for (const s of SPOTS) {
    const r = await page.evaluate(
      async (secs, x, z) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', mute: ['flutters', 'birds', 'wind'], at: { x, z, facing: 0 } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return btoa(b);
      },
      seconds,
      s.at[0],
      s.at[1],
    );
    fs.writeFileSync(path.join(out, `${tag}-${s.id}.wav`), Buffer.from(r, 'base64'));
    console.error(`[flame] ${tag} ${s.id} (${s.at}) — ${s.note}`);
  }
  fs.writeFileSync(path.join(out, 'spots.json'), JSON.stringify({ seconds, spots: SPOTS }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
