#!/usr/bin/env node
/**
 * render-mix.mjs — lane 5's evidence path: the shipped audio graph rendered to WAV files.
 *
 *   node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/audio-before \
 *        --seconds 35 --stems mix,bed,steps
 *
 * One world load (the pod lanterns' positions come from the real scene), then
 * `window.__ZR_AUDIO__.renderOffline(seconds, rate, { stem })` in an OfflineAudioContext — no
 * gesture, no output device, no WebGL in the render itself, so a headless box produces exactly the
 * mix the player hears. `--stems` picks which parts: `mix` (everything), `bed` (the ambience
 * alone) and `steps` (the footsteps alone), so each can be measured without the other masking it.
 *
 * Pair with `spectra.py` for the before / after sheets and the numbers.
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
const out = path.resolve(args.out || '/tmp/audio-mix');
const seconds = Number(args.seconds ?? 35);
const sampleRate = Number(args.rate ?? 44100);
/**
 * `mix`, `bed`, `steps`, `music`; suffix a stem with `-dry` to mute the shared hall's return, or
 * with `-open` / `-crowns` to force the canopy over the whole render (so the effect of the crowns
 * can be measured on its own rather than on whichever events happened to fall in one leg).
 */
const stems = String(args.stems ?? 'mix,bed,steps')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { width: 640, height: 360, quality: 'low' });
  for (const stem of stems) {
    const t0 = Date.now();
    const dry = stem.endsWith('-dry');
    const canopy = stem.endsWith('-crowns') ? 1 : stem.endsWith('-open') ? 0 : null;
    const base = dry ? stem.slice(0, -4) : canopy === 1 ? stem.slice(0, -7) : canopy === 0 ? stem.slice(0, -5) : stem;
    const { b64, music, peak, rms } = await page.evaluate(
      async (secs, rate, s, noReverb, forceCanopy) => {
        const r = await window.__ZR_AUDIO__.renderOffline(secs, rate, { stem: s, ...(noReverb ? { reverb: false } : {}), ...(forceCanopy === null ? {} : { canopy: forceCanopy }) });
        const bytes = r.wav;
        // 16-bit PCM levels straight off the WAV payload, so the numbers come from the shipped bytes
        let peak = 0;
        let sum = 0;
        let n = 0;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let off = 44; off + 1 < bytes.byteLength; off += 2) {
          const v = view.getInt16(off, true) / 32768;
          peak = Math.max(peak, Math.abs(v));
          sum += v * v;
          n++;
        }
        let bin = '';
        const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
        return { b64: btoa(bin), music: r.music, peak, rms: Math.sqrt(sum / Math.max(1, n)) };
      },
      seconds,
      sampleRate,
      base,
      dry,
      canopy,
    );
    const file = path.join(out, `${stem}.wav`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
    console.log(`${stem}: ${file} (${seconds} s, music=${music}, peak ${db(peak)} dBFS, rms ${db(rms)} dBFS, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
} finally {
  await browser.close();
  await server.close();
}
