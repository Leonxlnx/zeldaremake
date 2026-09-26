#!/usr/bin/env node
/**
 * wet.mjs — how much of a flame and a glint arrives as reflection, at a range of distances.
 *
 *   node art/audio/2026-09-25-wet/wet.mjs --dist dist --tag before [--out /tmp/wet]
 *
 * Rubric checks 42 and 45 both stall on the same sentence: *"pods and fairies are level-only"*. A
 * bird already has the other half of distance — `birdWet` sends 0.2 of it to the hall up close and
 * 0.75 far off, so a far call is wetter as well as quieter, which is most of what tells a listener
 * how far away something is once the level has been normalised by his own expectations. The lantern
 * flame sends a flat 0.45 and a fairy's glint a flat 0.3, at any distance.
 *
 * `renderOffline({ reverb: false })` mutes the hall's return and the room's, so the same take can be
 * rendered wet and dry and the reflected share worked out exactly rather than estimated: the
 * difference between the two files IS the reverb.
 *
 * Standing at a range of distances from the isolated village lantern at (−2.45, −5.09) — the
 * nearest other pod is six metres further on, so the crowd term stays small — and beside a fairy.
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
const out = path.resolve(args.out || '/tmp/wet');
const tag = String(args.tag || 'after');
const seconds = Number(args.seconds ?? 40);
const log = (...m) => console.error('[wet]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the pod hangs at (−2.45, −5.09); these stand due east of it at a spread of distances */
const POD = [-2.45, -5.09];
const RANGE = [0.6, 1.3, 2.5, 5.0];

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const m of RANGE) {
    for (const [wetTag, reverb] of [
      ['wet', true],
      ['dry', false],
    ]) {
      const r = await page.evaluate(
        async (x, z, secs, rev) => {
          // the wind held right down: below GUST_KNEE the wind layers are silent, so what is left
          // in the take is the flame and the events, which is what this is about
          const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', gust: 0.1, reverb: rev, mute: ['birds'], at: { x, z } });
          let b = '';
          for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
          return btoa(b);
        },
        POD[0] + m,
        POD[1],
        seconds,
        reverb,
      );
      fs.writeFileSync(path.join(out, `pod-${m}-${wetTag}-${tag}.wav`), Buffer.from(r, 'base64'));
    }
    done.push({ m, at: [POD[0] + m, POD[1]] });
    log(`pod at ${m} m — wet and dry rendered`);
  }
  fs.writeFileSync(path.join(out, `takes-${tag}.json`), JSON.stringify({ tag, seconds, pod: POD, range: RANGE, takes: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
