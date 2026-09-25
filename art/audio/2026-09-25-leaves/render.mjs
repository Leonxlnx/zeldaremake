#!/usr/bin/env node
/**
 * render.mjs — two places, standing still, before and after.
 *
 *   node art/audio/2026-09-25-leaves/render.mjs --dist dist --tag before [--out /tmp/leaves]
 *
 * The bed stem only, and the listener does not move: the question is how WIDE the wood is in each
 * place, and a moving listener would bring the pan work of the last five iterations into it.
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
const out = path.resolve(args.out || '/tmp/leaves');
const tag = String(args.tag || 'after');
const log = (...m) => console.error('[leaves]', ...m);
fs.mkdirSync(out, { recursive: true });
const TAKES = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'takes.json'), 'utf8'));

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const s of TAKES.spots) {
    const r = await page.evaluate(
      async (x, z, secs, g) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', gust: g, at: { x, z } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return { wav: btoa(b), flutters: o.bed?.flutters ?? 0, birds: o.bed?.birds ?? 0 };
      },
      s.at[0],
      s.at[1],
      s.seconds,
      TAKES.gust,
    );
    fs.writeFileSync(path.join(out, `${s.id}-${tag}.wav`), Buffer.from(r.wav, 'base64'));
    done.push({ ...s, flutters: r.flutters, birds: r.birds });
    log(`${s.id} — ${s.note}: ${r.flutters} flutters, ${r.birds} calls`);
  }
  fs.writeFileSync(path.join(out, `takes-${tag}.json`), JSON.stringify({ tag, gust: TAKES.gust, spots: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
