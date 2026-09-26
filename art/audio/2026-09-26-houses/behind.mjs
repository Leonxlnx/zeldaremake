#!/usr/bin/env node
/**
 * behind.mjs — the wood heard from behind Saria's house.
 *
 *   node art/audio/2026-09-26-houses/behind.mjs --dist dist --out /tmp/houses --tag before
 *
 * `missing.mjs` says the two Kokiri tree-houses are not in `OCCLUDERS`, and what that costs: 23 %
 * of the bearings in this world that should be shadowed are not, and one line through them stands
 * 11.63 m of wood where the sound currently sees none.
 *
 * The takes stand a couple of metres clear of Saria's trunk, so a good part of the wood behind it
 * is in its shadow, and on the lawn, which is nineteen metres from the nearest house and is the
 * control. Long, because the evidence is BIRDS: they call every few seconds from seeded perches
 * and only some of those are behind the house, so three minutes is needed for the ones that are.
 *
 * `mute: ['wind']` takes the two continuous wind layers out — they are diffuse and have no
 * position to shadow, so all they do here is sit on top of the thing being measured.
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
const out = path.resolve(args.out || '/tmp/houses');
const tag = args.tag || 'take';
const seconds = Number(args.seconds ?? 180);
fs.mkdirSync(out, { recursive: true });

/** Saria's trunk is at (12.5, −11.5) with a 3.2 m radius; the upper house 6.5 m north of it */
const SPOTS = [
  { id: 'west-of-saria', at: [7.0, -11.5], note: "2.3 m clear of Saria's trunk, the wood behind it to the east" },
  { id: 'below-the-houses', at: [13.0, -6.0], note: 'south of both houses, with the pair of them between here and the plateau' },
  { id: 'lawn', at: [-6.5, 2.0], note: 'nineteen metres from the nearest house — the control' },
];

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const s of SPOTS) {
    const r = await page.evaluate(
      async (secs, x, z) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', mute: ['wind'], at: { x, z, facing: 0 } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return { wav: btoa(b), bed: o.bed };
      },
      seconds,
      s.at[0],
      s.at[1],
    );
    fs.writeFileSync(path.join(out, `${tag}-${s.id}.wav`), Buffer.from(r.wav, 'base64'));
    done.push({ ...s, birds: r.bed?.birds ?? null, shadow: r.bed?.birdShadow ?? null });
    console.error(`[houses] ${tag} ${s.id} (${s.at}) — ${r.bed?.birds ?? '?'} calls in ${seconds} s`);
  }
  fs.writeFileSync(path.join(out, 'spots.json'), JSON.stringify({ seconds, spots: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
