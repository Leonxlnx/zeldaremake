#!/usr/bin/env node
/**
 * survey.mjs — what never stops, in every place in the world, one place at a time.
 *
 *   node art/audio/2026-09-24-standing/survey.mjs --dist dist [--out /tmp/standing] [--seconds 90]
 *
 * The owner's complaint, twice, has been noise that never stops. The metric this lane settled on
 * for it is the **always-on** level — what is present in nine frames out of ten, per band — and
 * every measurement of it so far has come from one scripted walk through the village. That answers
 * "what does the game sound like". It cannot answer "what does *this place* sound like", which is
 * the question that actually matters, because a floor is a property of a place and of a listener
 * who is not doing anything.
 *
 * `renderOffline({ stem: 'bed', at: { x, z } })` stands still somewhere and renders the world's own
 * sound there: no footsteps, no music, no browser recorder, deterministic, a second a take. This
 * walks the list below and reports each place's floor beside the others, so the loudest
 * never-stopping thing in the world can be named rather than guessed at.
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
const out = path.resolve(args.out || '/tmp/standing');
const seconds = Number(args.seconds ?? 90);
const rate = Number(args.rate ?? 44100);
const stem = String(args.stem ?? 'bed');
const log = (...m) => console.error('[standing]', ...m);
fs.mkdirSync(out, { recursive: true });

/**
 * Somewhere a player stands. Each is a place with a reason to sound different from the others —
 * a roof of leaves, a bore of wood, eight metres of open air, a lamp a metre away.
 */
const PLACES = [
  { id: 'plaza', at: [1.5, -6], note: 'the village plaza, under the lantern bough' },
  { id: 'pod-1m', at: [-0.2, -1.2], note: 'a metre from a pod lantern at the path fork' },
  { id: 'lawn', at: [-6.5, 2], note: 'the lawn west of the spine, away from everything' },
  { id: 'forest-floor', at: [12, -38], note: 'the north forest floor, crowns closed overhead' },
  { id: 'log-bore', at: [4.84, -55.4], note: "inside the log arch's bore" },
  { id: 'north-clearing', at: [-1.5, -69.8], note: "the stone circle's paving in the north clearing" },
  { id: 'lookout', at: [21.6, 2.2], note: 'the plateau lookout dais, open sky' },
  { id: 'bridge-midspan', at: [3.9, 37.08], note: 'mid-span on the rope bridge, over the ravine' },
  { id: 'far-log', at: [4.31, 48.9], note: "two metres into the far bank's hollow log" },
  // added 2026-09-25: the north grove landed after the first survey, and so did this lane's rooms.
  // A hut is the only place in the world a player stands with walls round him and a door open.
  { id: 'grove-trail', at: [-0.43, -90.11], note: "a set stone on the grove's trail, under the crowns" },
  { id: 'grove-deck', at: [14.2, -91.5], note: "the stilt house's veranda, 11.6 m up" },
  { id: 'grove-room', at: [12.0, -91.5], note: 'inside the stilt house, its door open' },
  { id: 'west-room', at: [-23.0, 9.0], note: 'inside the west house, under open sky' },
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const rows = [];
  for (const p of PLACES) {
    const r = await page.evaluate(
      async (place, secs, sr, st) => {
        const res = await window.__ZR_AUDIO__.renderOffline(secs, sr, { stem: st, at: { x: place.at[0], z: place.at[1] } });
        let s = '';
        for (let i = 0; i < res.wav.length; i += 0x8000) s += String.fromCharCode(...res.wav.subarray(i, i + 0x8000));
        return btoa(s);
      },
      p,
      seconds,
      rate,
      stem,
    );
    fs.writeFileSync(path.join(out, `${p.id}.wav`), Buffer.from(r, 'base64'));
    rows.push(p);
    log(`${p.id.padEnd(16)} ${p.note}`);
  }
  fs.writeFileSync(path.join(out, 'places.json'), JSON.stringify({ stem, seconds, places: rows }, null, 1));
  log(`${rows.length} places, ${seconds} s each, stem "${stem}" → ${out}`);
} finally {
  await browser.close();
  await server.close();
}
