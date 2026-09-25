#!/usr/bin/env node
/**
 * shadowed.mjs — the same wood, with and without the boles between him and the birds.
 *
 *   node art/audio/2026-09-25-occlusion/shadowed.mjs --dist dist [--out /tmp/shadow] [--seconds 180]
 *
 * `renderOffline({ stem: 'bed', at, occlusion: false })` runs the identical take with the world's
 * occluders switched off, so a pair differs in exactly one input. The takes are long because the
 * evidence is *birds*, which call every few seconds and only some of which are behind anything —
 * three minutes is enough for every perch to have called several times.
 *
 * The spots are beside the widest boles the layout has, because that is where a perch can be behind
 * one. Standing in the open is the control: with nothing in the way the two takes must be the same
 * file, which is also the regression check that the change costs nothing where it should not apply.
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
const out = path.resolve(args.out || '/tmp/shadow');
const seconds = Number(args.seconds ?? 180);
const log = (...m) => console.error('[shadow]', ...m);
fs.mkdirSync(out, { recursive: true });

/** beside the three widest boles in the world, and one spot with nothing near it */
const SPOTS = [
  { id: 'plaza-south', at: [4.4, 24.2], note: 'three metres north of the 2.2 m bole at the spine\u2019s south end' },
  { id: 'southwest', at: [-23.0, 13.2], note: 'beside the 1.9 m south-west giant' },
  { id: 'lantern-tree', at: [-11.5, -3.2], note: 'beside the 1.7 m lantern tree' },
  { id: 'open', at: [-6.5, 2.0], note: 'the lawn, nothing solid within fifteen metres \u2014 the control' },
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  for (const s of SPOTS) {
    for (const [tag, occlusion] of [
      ['before', false],
      ['after', true],
    ]) {
      const b64 = await page.evaluate(
        async (x, z, secs, occ) => {
          const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: { x, z }, occlusion: occ });
          let o = '';
          for (let i = 0; i < r.wav.length; i += 0x8000) o += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
          return btoa(o);
        },
        s.at[0],
        s.at[1],
        seconds,
        occlusion,
      );
      fs.writeFileSync(path.join(out, `${s.id}-${tag}.wav`), Buffer.from(b64, 'base64'));
    }
    log(`${s.id} — ${s.note}`);
  }
  fs.writeFileSync(path.join(out, 'spots.json'), JSON.stringify({ seconds, spots: SPOTS }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
