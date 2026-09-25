#!/usr/bin/env node
/**
 * passby.mjs — the same three journeys, in sound.
 *
 *   node art/audio/2026-09-25-lag/passby.mjs --dist dist --tag before [--out /tmp/lag]
 *
 * `lag.mjs` computes what the bed's parameters do; this renders what they sound like. The new
 * `renderOffline({ pass })` walks the listener in a straight line at a stated speed with every
 * space term read from `surfaceAt` where he is, ticking at the game's own `TICK_MS`.
 *
 * `--tag before` and `--tag after` name the two builds, because the change under test is a set of
 * smoothing constants and there is no switch for them: the pair is the commit that adds this script
 * and the commit after it. The path, the seed, the speed and the length are identical across both,
 * so the two WAVs differ in exactly the constants.
 *
 * `bed` stems, because footsteps at a run would sit on top of the very thing being measured — and
 * one `mix` of the lantern pass, which is what a player would actually hear going by it.
 *
 * The gust is held at `GUST` for every take, the same value `lag.mjs` holds it at. The render's own
 * weather swings the bed 18 dB in the four seconds a run takes to cross any of these, which buries
 * what the take is for; with it held, everything that moves moved because the listener did.
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
const out = path.resolve(args.out || '/tmp/lag');
const tag = String(args.tag || 'after');
const log = (...m) => console.error('[passby]', ...m);
fs.mkdirSync(out, { recursive: true });

/**
 * The journeys, from `takes.json` — shared with `lag.mjs`, which computes where the world's own
 * term passes its halfway point on each of them, so the model and the renders cannot drift apart.
 * Each is long enough either side of the thing being crossed that the bed has settled before it
 * and after it.
 */
const TAKES = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'takes.json'), 'utf8'));
/** the one gust every take is held at, and the settling stand before each, shared with `lag.mjs` */
const GUST = TAKES.gust;
const LEAD = TAKES.lead;

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const manifest = [];
  for (const t of TAKES.takes) {
    const len = Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]);
    const seconds = LEAD + Math.ceil((len / t.speed) * 10) / 10;
    for (const stem of t.stems) {
      const b64 = await page.evaluate(
        async (from, to, speed, secs, st, g, ld) => {
          const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: st, gust: g, pass: { from, to, speed, lead: ld } });
          let o = '';
          for (let i = 0; i < r.wav.length; i += 0x8000) o += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
          return btoa(o);
        },
        t.from,
        t.to,
        t.speed,
        seconds,
        stem,
        GUST,
        LEAD,
      );
      fs.writeFileSync(path.join(out, `${t.id}-${stem}-${tag}.wav`), Buffer.from(b64, 'base64'));
    }
    manifest.push({ ...t, len, seconds });
    log(`${t.id} — ${t.note} (${len.toFixed(1)} m at ${t.speed} m/s, ${seconds} s)`);
  }
  fs.writeFileSync(path.join(out, `takes-${tag}.json`), JSON.stringify({ tag, gust: GUST, lead: LEAD, takes: manifest }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
