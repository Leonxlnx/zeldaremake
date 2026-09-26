#!/usr/bin/env node
/**
 * split.mjs — the music stem with the hall on and with it off.
 *
 *   node art/audio/2026-09-26-mono/split.mjs --dist dist --out /tmp/mono-split [--seconds 120]
 *
 * The score leans left and the harp — the only panned voice in it — turned out not to be the
 * reason. The two places a lean can come from are the dry path and the shared hall, and
 * `OfflineOptions.reverb: false` is the one switch that separates them, so this renders the same
 * take both ways. Whichever one keeps the lean is where it lives.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/mono-split');
const seconds = Number(args.seconds ?? 120);
fs.mkdirSync(out, { recursive: true });
const log = (...m) => console.error('[split]', ...m);

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await page.waitForFunction(() => !!window.__ZR_AUDIO__, { timeout: 180000, polling: 500 });
  for (const [name, reverb] of [['wet', true], ['dry', false]]) {
    const b64 = await page.evaluate(
      async ([secs, rev]) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, 44100, { stem: 'music', reverb: rev });
        let bin = '';
        for (let i = 0; i < r.wav.length; i += 0x8000) bin += String.fromCharCode(...r.wav.subarray(i, i + 0x8000));
        return btoa(bin);
      },
      [seconds, reverb],
    );
    fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.from(b64, 'base64'));
    log(`music, hall ${reverb ? 'on' : 'off'} → ${path.join(out, `${name}.wav`)}`);
  }
} finally {
  await browser.close();
  await server.close();
}
