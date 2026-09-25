#!/usr/bin/env node
/**
 * layers.mjs — the same two minutes of forest, with one layer switched off at a time.
 *
 *   node art/audio/2026-09-25-layers/layers.mjs --dist dist [--out /tmp/layers] [--seconds 150]
 *
 * `2026-09-25-leaves` ended on a question it could not answer: if a leaf cannot be heard to MOVE,
 * can it be heard at all? `QUIET_GAP_MAX` exists because the flutters are what keeps the wood from
 * falling silent for five seconds at a time — *"a leaf turning over is the answer to that, not a
 * floor put back under everything"* — so they are meant to be doing a job, and nobody has rendered
 * the bed without them.
 *
 * `renderOffline({ mute })` switches a layer off without changing anything else: every draw still
 * happens and every node is still built, so the birds call at the same moments whether the leaves
 * are heard or not. The four takes are the same forest, four ways.
 *
 * Standing still, because what is being asked is what the wood sounds like when nothing else is,
 * and a moving listener brings the whole of the last six iterations into the answer.
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
const out = path.resolve(args.out || '/tmp/layers');
const seconds = Number(args.seconds ?? 150);
const log = (...m) => console.error('[layers]', ...m);
fs.mkdirSync(out, { recursive: true });

/** the plaza, open sky, and the north path under closed crowns — the flutters are denser under a roof */
const SPOTS = [
  { id: 'open', at: [0.5, 2.0], note: 'the plaza, open sky' },
  { id: 'crowns', at: [5.1, -49.6], note: 'the north path under closed crowns' },
];
const MUTES = [
  { id: 'all', mute: [], note: 'the wood as it ships' },
  { id: 'noleaves', mute: ['flutters'], note: 'no leaves turning over' },
  { id: 'nobirds', mute: ['birds'], note: 'no birds' },
  { id: 'nowind', mute: ['wind'], note: 'no wind layers at all — only the events' },
];
/**
 * A gust held below `GUST_KNEE` for half the takes: below the knee the wind layers are silent by
 * design, and that is the moment the flutters exist for. A take at a steady mid gust never visits
 * the case they were written for.
 */
const GUSTS = [
  { id: 'gusty', gust: 0.6 },
  { id: 'still-air', gust: 0.12 },
];

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const s of SPOTS) {
    for (const g of GUSTS) {
      for (const m of MUTES) {
        const r = await page.evaluate(
          async (x, z, secs, gust, mute) => {
            const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', gust, mute, at: { x, z } });
            let b = '';
            for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
            return { wav: btoa(b), flutters: o.bed?.flutters ?? 0, birds: o.bed?.birds ?? 0 };
          },
          s.at[0],
          s.at[1],
          seconds,
          g.gust,
          m.mute,
        );
        const id = `${s.id}-${g.id}-${m.id}`;
        fs.writeFileSync(path.join(out, `${id}.wav`), Buffer.from(r.wav, 'base64'));
        done.push({ id, spot: s.id, gust: g.id, gustValue: g.gust, mute: m.id, note: `${s.note}, ${m.note}`, flutters: r.flutters, birds: r.birds });
        log(`${id}: ${r.flutters} flutters, ${r.birds} calls`);
      }
    }
  }
  fs.writeFileSync(path.join(out, 'takes.json'), JSON.stringify({ seconds, spots: SPOTS, gusts: GUSTS, mutes: MUTES, takes: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
