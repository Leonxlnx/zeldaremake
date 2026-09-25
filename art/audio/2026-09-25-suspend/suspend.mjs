#!/usr/bin/env node
/**
 * suspend.mjs — what happens when the browser stops the audio clock.
 *
 *   node art/audio/2026-09-25-suspend/suspend.mjs --dist dist [--out /tmp/suspend] [--tag before]
 *
 * Check 48 of `art/audio/RUBRIC_50_SOUND.md` asks about a hidden tab, a suspended context and a
 * device change. The hidden tab was answered on 2026-09-25 (`2026-09-25-hidden`); the other two
 * were named as untested and stayed that way. They are the same event as far as the page is
 * concerned: the `AudioContext` goes to `suspended` and its clock stops.
 *
 * Chrome does that when the output device changes under it, when a background tab is frozen, and
 * when a page comes back from the back/forward cache. Nothing in `index.ts` listens for it — the
 * only `resume()` is the one at start-up, behind the first gesture — so the question is whether the
 * game ever makes a sound again.
 *
 * The context is not exposed anywhere, so the harness wraps the constructor before any page script
 * runs and keeps the instance. That is a harness trick and not a change to the game: nothing in
 * `src/` learns about it.
 *
 * The run: boot play mode, start the audio, run five seconds, suspend, watch for twelve, resume by
 * hand, watch ten more — recording the master throughout and logging the context's state, its
 * clock, the live voice count and the automation the tick is laying down.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const out = path.resolve(args.out || '/tmp/suspend');
const tag = String(args.tag || 'after');
const log = (...m) => console.error('[suspend]', ...m);
fs.mkdirSync(out, { recursive: true });

/** seconds: run, suspend at, resume by hand at, stop */
const AT_SUSPEND = 5;
const AT_RESUME = 17;
const SECONDS = 27;

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
    // keep the live context so the harness can stop its clock; nothing in src/ sees this
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig {
      constructor(...a) {
        super(...a);
        window.__ctx = this;
      }
    };
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1500));

  const data = await page.evaluate(
    async (secs, tSuspend, tResume) => {
      const P = window.__ZR_PLAY__;
      const A = window.__ZR_AUDIO__;
      const ctx = window.__ctx;
      if (!ctx) throw new Error('the context was not captured');
      P.setPlayMode?.(true);
      P.place(0.5, 2.0, 0);
      const rec = A.record(secs);
      const samples = [];
      const marks = [];
      const t0 = performance.now();
      let last = t0;
      let did = { suspend: false, resume: false };
      while (performance.now() - t0 < secs * 1000) {
        await new Promise((r) => setTimeout(r, 12));
        const now = performance.now();
        const wall = (now - t0) / 1000;
        P.step(1, Math.min(0.05, (now - last) / 1000), false);
        last = now;
        if (!did.suspend && wall >= tSuspend) {
          did.suspend = true;
          marks.push(['suspend asked', wall]);
          await ctx.suspend();
          marks.push(['suspended', (performance.now() - t0) / 1000, ctx.state]);
        }
        if (!did.resume && wall >= tResume) {
          did.resume = true;
          marks.push(['resume asked by hand', wall, ctx.state]);
          await ctx.resume();
          marks.push(['resumed', (performance.now() - t0) / 1000, ctx.state]);
        }
        const s = A.stats();
        samples.push([Number(wall.toFixed(2)), ctx.state, Number((s?.contextTime ?? 0).toFixed(3)), s?.voices ?? 0, s?.birds ?? 0, s?.steps ?? 0]);
      }
      const bytes = await rec;
      let b = '';
      for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { webm: btoa(b), samples, marks, end: { state: ctx.state, stats: A.stats() } };
    },
    SECONDS,
    AT_SUSPEND,
    AT_RESUME,
  );

  fs.writeFileSync(path.join(out, `master-${tag}.webm`), Buffer.from(data.webm, 'base64'));
  fs.writeFileSync(path.join(out, `run-${tag}.json`), JSON.stringify({ tag, atSuspend: AT_SUSPEND, atResume: AT_RESUME, seconds: SECONDS, pageErrors: errs, ...data, webm: undefined }, null, 1));
  for (const m of data.marks) log(m.join('  '));
  // how long the context spent stopped, and whether anything but the harness started it again
  const back = data.samples.find((s) => s[0] > AT_SUSPEND + 0.2 && s[1] === 'running');
  log(`states seen: ${[...new Set(data.samples.map((s) => s[1]))].join(', ')}`);
  log(back ? `first 'running' after the suspend at ${back[0]} s` : `never came back on its own before the harness resumed it at ${AT_RESUME} s`);
  log(`page errors: ${errs.length}`);
} finally {
  await browser.close();
  await server.close();
}
