#!/usr/bin/env node
/**
 * render.mjs — a crossing of the village, rendered before and after.
 *
 *   node art/audio/2026-09-25-reseed/render.mjs --dist dist --tag before [--out /tmp/parallax]
 *
 * A perch is seeded as a BEARING and a DISTANCE from the spot the listener was standing at when the
 * wood was drawn, and it keeps both until he has walked `PERCH_RESEED_M` — twenty-five metres —
 * from that spot. Inside that radius a bird does not move relative to him at all: he can walk the
 * length of the village past a tree and the bird in it stays exactly where it was, at exactly the
 * same loudness, and then the whole wood rearranges at once when he crosses the line.
 *
 * `perchSpots` publishes where the six birds are in world metres, and `birdSpots` publishes the
 * bearing and distance each call was actually given. A `pass` walks a straight line at a stated
 * speed with the facing known, so for every call the TRUE bearing and distance from where he is
 * standing can be worked out — and the error is exact.
 *
 * Two takes: a short walk that stays inside the re-seed radius (which is where the fault lives) and
 * a long one that crosses it (where the wood jumps instead).
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
const out = path.resolve(args.out || '/tmp/parallax');
const tag = String(args.tag || 'after');
const log = (...m) => console.error('[reseed]', ...m);
fs.mkdirSync(out, { recursive: true });

const TAKES = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'takes.json'), 'utf8'));

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const done = [];
  for (const t of TAKES.takes) {
    const len = Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]);
    const seconds = t.seconds ?? TAKES.lead + Math.ceil((len / t.speed) * 10) / 10;
    const r = await page.evaluate(
      async (from, to, speed, secs, g, ld, lp) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', gust: g, pass: { from, to, speed, lead: ld, loop: lp } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return { wav: btoa(b), spots: o.bed?.birdSpots ?? [], perches: o.bed?.perchSpots ?? [], birds: o.bed?.birds ?? 0, rehomed: o.bed?.rehomed ?? null };
      },
      t.from,
      t.to,
      t.speed,
      seconds,
      TAKES.gust,
      TAKES.lead,
      !!t.loop,
    );
    fs.writeFileSync(path.join(out, `${t.id}-${tag}.wav`), Buffer.from(r.wav, 'base64'));
    done.push({ ...t, len, seconds, birds: r.birds, rehomed: r.rehomed, spots: r.spots, perches: r.perches });
    log(`${t.id} — ${len.toFixed(1)} m at ${t.speed} m/s, ${r.birds} calls, ${r.rehomed === null ? 'no rehome counter (old build)' : `${r.rehomed} birds retired`}`);
  }
  fs.writeFileSync(path.join(out, `takes-${tag}.json`), JSON.stringify({ tag, gust: TAKES.gust, lead: TAKES.lead, takes: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
