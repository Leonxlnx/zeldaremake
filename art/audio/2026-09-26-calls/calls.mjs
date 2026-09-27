#!/usr/bin/env node
/**
 * calls.mjs — the birds heard from the middle of the ravine, and from ground that is not near it.
 *
 *   node art/audio/2026-09-26-calls/calls.mjs --dist dist --out /tmp/calls --tag before
 *
 * `2026-09-26-ravine` gave the cut its own space and put only the CONTACTS in it — the hut's
 * pattern, where `buses.room` serves the footsteps and the bed handles indoors by filtering. It
 * closed by naming what that leaves out: *"a bird call is not dark, and a call heard from the far
 * bank while you stand mid-span is the obvious next thing this space should be under."*
 *
 * Unlike the footsteps case the before is not silence: the bed already answers the gorge term
 * through `GORGE_HALL` and `GORGE_WIND`, worth +2.7 dB. So the pair here is the same spot rendered
 * on a build without the calls' send and one with it, and the difference between them is the
 * ravine answering a bird and nothing else.
 *
 * `mute: ['flutters', 'wind']` leaves the calls, the pod flames and the glints. Out over the cut
 * there are no leaves and no fairies, and the nearest lantern is far enough to be a whisper, so
 * what is left in the take is birds. The lawn is the control: `gorgeAt` is 0 there, so the two
 * builds must produce the same file.
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
const out = path.resolve(args.out || '/tmp/calls');
const tag = args.tag || 'take';
const seconds = Number(args.seconds ?? 120);
fs.mkdirSync(out, { recursive: true });

const SPOTS = [
  { id: 'midspan', at: [3.9, 37.08], note: 'the middle of the bridge — gorgeAt is 1.00 here' },
  { id: 'lawn', at: [-6.5, 2.0], note: 'the lawn — gorgeAt is 0, the control' },
];

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const s of SPOTS) {
    const r = await page.evaluate(
      async (secs, x, z) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', mute: ['flutters', 'wind'], at: { x, z, facing: 0 } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return { wav: btoa(b), bed: o.bed };
      },
      seconds,
      s.at[0],
      s.at[1],
    );
    fs.writeFileSync(path.join(out, `${tag}-${s.id}.wav`), Buffer.from(r.wav, 'base64'));
    done.push({ ...s, birds: r.bed?.birds ?? null });
    console.error(`[calls] ${tag} ${s.id} (${s.at}) — ${r.bed?.birds ?? '?'} calls in ${seconds} s`);
  }
  fs.writeFileSync(path.join(out, 'spots.json'), JSON.stringify({ seconds, spots: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
