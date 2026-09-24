#!/usr/bin/env node
/**
 * pairs.mjs — what the forest sounds like from inside a hut, and from its veranda.
 *
 *   node art/audio/2026-09-24-indoors/pairs.mjs --dist dist [--out /tmp/indoors] [--seconds 90]
 *
 * `renderOffline({ stem: 'bed', at })` stands still somewhere and renders the world's own sound
 * there, deterministically and with no music or footsteps in the way. The question here is a pair
 * of places a stride apart — the middle of a room and the deck outside its door — so the two takes
 * can be rendered from one world load and differ in nothing but where he is standing.
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
const out = path.resolve(args.out || '/tmp/indoors');
const seconds = Number(args.seconds ?? 90);
const log = (...m) => console.error('[indoors]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the middle of each room, and a spot the same walk outside its wall — shared with where.mjs */
const here = path.dirname(new URL(import.meta.url).pathname);
const PAIRS = JSON.parse(fs.readFileSync(path.join(here, 'spots.json'), 'utf8')).pairs;

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  for (const p of PAIRS) {
    const b64 = await page.evaluate(
      async (place, secs) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: { x: place.at[0], z: place.at[1] } });
        let s = '';
        for (let i = 0; i < r.wav.length; i += 0x8000) s += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
        return btoa(s);
      },
      p,
      seconds,
    );
    fs.writeFileSync(path.join(out, `${p.id}.wav`), Buffer.from(b64, 'base64'));
    log(`${p.id} at ${p.at}`);
  }
  fs.writeFileSync(path.join(out, 'pairs.json'), JSON.stringify({ seconds, pairs: PAIRS }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
