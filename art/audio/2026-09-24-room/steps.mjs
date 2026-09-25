#!/usr/bin/env node
/**
 * steps.mjs — the footsteps stem walked with the room switched off and switched on.
 *
 *   node art/audio/2026-09-24-room/steps.mjs --dist dist --out /tmp/room --tag after
 *
 * `renderOffline({ stem: 'steps' })` walks the scripted route in `OFFLINE_WALK` — grass, earth,
 * flagstones, the stair flight, deck planks, the log bore, leaves, a run, a bridge — with no bed and
 * no music in the way. `--enclosure` forces the space term the whole way, so the only difference
 * between the two takes is whether the boots are in a room. Same seed, same walk, same everything
 * else; subtract one from the other and what is left is the room.
 *
 * Before this change `enclosure` was not an input to a footstep at all, so the two takes came back
 * bit for bit identical. That is the "before" — and it is also the regression check afterwards,
 * because a take at 0 must still match the pre-change render exactly.
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
const out = path.resolve(args.out || '/tmp/room');
const tag = args.tag || 'take';
const seconds = Number(args.seconds ?? 52);
const log = (...m) => console.error('[room]', ...m);
fs.mkdirSync(out, { recursive: true });

/** outdoors, and inside a hut (`INDOORS_CLOSE`), and inside the log bore */
const SPACES = [
  ['open', 0],
  ['room', 0.7],
  ['bore', 1],
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  for (const [name, enclosure] of SPACES) {
    const b64 = await page.evaluate(
      async (secs, enc) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'steps', enclosure: enc });
        let s = '';
        for (let i = 0; i < r.wav.length; i += 0x8000) s += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
        return btoa(s);
      },
      seconds,
      enclosure,
    );
    fs.writeFileSync(path.join(out, `${tag}-${name}.wav`), Buffer.from(b64, 'base64'));
    log(`${tag}-${name} (enclosure ${enclosure})`);
  }
} finally {
  await browser.close();
  await server.close();
}
