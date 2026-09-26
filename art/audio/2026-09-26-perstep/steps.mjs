#!/usr/bin/env node
/**
 * steps.mjs — a walk and a run, rendered, at the speeds the player actually has.
 *
 *   node art/audio/2026-09-26-perstep/steps.mjs --dist dist [--out /tmp/perstep]
 *
 * Rubric check 21 is *walking and running differ in more than rate*, and it has sat at 3 with the
 * same reason beside it since it was scored: **the per-step instrument does not work at a running
 * cadence**. At the old controller a run was 4.6 m/s and five steps a second, a step's envelope had
 * not finished when the next began, the onset detector under-counted, and the run's own first half
 * differed from its second by 13.4 dB rms — a measurement whose noise floor is bigger than its
 * effect.
 *
 * PR #59 brought the run to 2.2 m/s and 3.67 steps a second. 272 ms between steps is not 143, and
 * the question becomes answerable for the first time — which is the only reason to ask it again.
 *
 * The plaza spine is stone end to end with no enclosure anywhere on it (checked), so the surface
 * and the space are held and the only difference between the two takes is the gait.
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
const out = path.resolve(args.out || '/tmp/perstep');
const tag = String(args.tag || 'after');
const seconds = Number(args.seconds ?? 64);
const log = (...m) => console.error('[perstep]', ...m);
fs.mkdirSync(out, { recursive: true });

/** all stone, no enclosure; paced so the take is long enough for a hundred steps at either gait */
const LINE = { from: [0, 8], to: [0, -12] };

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  const speeds = await page.evaluate(() => null);
  void speeds;
  const done = [];
  for (const [gait, speed] of [
    ['walk', Number(args.walk ?? 1.2)],
    ['run', Number(args.run ?? 2.2)],
  ]) {
    const r = await page.evaluate(
      async (from, to, sp, secs) => {
        const o = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'steps', pass: { from, to, speed: sp, lead: 2, loop: true } });
        let b = '';
        for (let i = 0; i < o.wav.length; i += 0x8000) b += String.fromCharCode(...o.wav.subarray(i, i + 0x8000));
        return btoa(b);
      },
      LINE.from,
      LINE.to,
      speed,
      seconds,
    );
    fs.writeFileSync(path.join(out, `${gait}-${tag}.wav`), Buffer.from(r, 'base64'));
    done.push({ gait, speed });
    log(`${gait} at ${speed} m/s — ${seconds} s rendered`);
  }
  fs.writeFileSync(path.join(out, `takes-${tag}.json`), JSON.stringify({ tag, seconds, line: LINE, lead: 2, takes: done }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
