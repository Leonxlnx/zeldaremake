#!/usr/bin/env node
/**
 * term.mjs — how much does one of the bed's space terms actually do?
 *
 *   node art/audio/2026-09-24-standing/term.mjs --dist dist --at 1.5,-6 --term canopy --values 0,0.5,1
 *
 * `surfaceAt` hands the bed three terms about the space rather than the boot — `canopy`, `gorge`,
 * `enclosure` — and each was added with a claim attached: the crowns close over the listener, the
 * ravine opens the sound, the log's wood shuts it in. Those claims were measured on a *walk*, where
 * the term changes at the same moment the place, the surface and the pods do, and anything could
 * be carrying the difference.
 *
 * Standing still at one spot and forcing the term to a value isolates it: the same seed, the same
 * place, the same wind, everything else fixed. That is the only way to answer "is this term doing
 * what its constants say" — and the answer decides whether tuning it is worth anything.
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
const out = path.resolve(args.out || '/tmp/term');
const seconds = Number(args.seconds ?? 90);
const term = String(args.term ?? 'canopy');
const values = String(args.values ?? '0,1').split(',').map(Number);
const [ax, az] = String(args.at ?? '1.5,-6').split(',').map(Number);
const log = (...m) => console.error('[term]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  for (const v of values) {
    const b64 = await page.evaluate(
      async (opts, secs) => {
        const res = await window.__ZR_AUDIO__.renderOffline(secs, 44100, opts);
        let s = '';
        for (let i = 0; i < res.wav.length; i += 0x8000) s += String.fromCharCode(...res.wav.subarray(i, i + 0x8000));
        return btoa(s);
      },
      { stem: 'bed', at: { x: ax, z: az }, [term]: v },
      seconds,
    );
    const f = path.join(out, `${term}-${v}.wav`);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    log(`${term} = ${v} → ${f}`);
  }
  fs.writeFileSync(path.join(out, 'term.json'), JSON.stringify({ term, values, at: [ax, az], seconds }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
