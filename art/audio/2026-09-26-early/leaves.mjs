#!/usr/bin/env node
/**
 * leaves.mjs — render the leaves alone, standing still, so the wind can be looked for in them.
 *
 *   node art/audio/2026-09-26-early/leaves.mjs --dist dist --out /tmp/early/after [--seconds 600]
 *
 * `early.mjs` measures the staleness on the SCHEDULE, which is exact and is not audio. This is
 * the same claim in the rendered thing: ten minutes standing on the plaza with the wind layers
 * and the birds muted, so what is left in the file is leaves and only leaves.
 *
 * Muting the wind matters more than it sounds. The continuous layers follow the gust through
 * `PLACE_TAU` and arrive on time, and they live in the same band the flutters do — so a take with
 * both in it is a mixture of one stream that is late and one that is not, and the lag measured
 * off it is neither. `mute: ['birds', 'wind']` is the same forest with the same seeded draws
 * (every event is still drawn, only the connection is left off — see `createAmbience`), so the
 * leaves in this take are exactly the leaves in the full one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/early/after');
const seconds = Number(args.seconds ?? 600);
/** the plaza, standing still: open sky, no pods within earshot, no fairies */
const AT = [0, 8];
const log = (...m) => console.error('[leaves]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  // the same door `repeat.mjs` uses: `renderOffline` needs no gesture and no output device, so
  // the headless capture page is the right one to ask
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.waitForFunction(() => !!window.__ZR_AUDIO__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  for (const [name, mute] of [
    ['leaves', ['birds', 'wind']],
    ['bed', []],
  ]) {
    const b64 = await page.evaluate(
      async ([secs, at, m]) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'bed', at: { x: at[0], z: at[1] }, mute: m });
        let bin = '';
        for (let i = 0; i < r.wav.length; i += 0x8000) bin += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
        return btoa(bin);
      },
      [seconds, AT, mute],
    );
    fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.from(b64, 'base64'));
    log(`${seconds} s of ${name} at ${AT} → ${path.join(out, `${name}.wav`)}`);
  }
  fs.writeFileSync(path.join(out, 'leaves.json'), JSON.stringify({ at: AT, seconds }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
