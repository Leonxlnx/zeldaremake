#!/usr/bin/env node
/**
 * hidden.mjs — what the sound does while the player is looking at something else (rubric check 48).
 *
 *   node art/audio/2026-09-25-hidden/hidden.mjs --dist dist [--hidden 300] [--out /tmp/hidden]
 *
 * Check 48 has scored 1 since the rubric was written, and this lane has called it untested in three
 * reports without testing it. The reason to care is specific rather than general:
 *
 * Every event in the bed builds its own little chain of nodes and tears it down again through
 * `cleanupAt`, which is a `setTimeout`. A background tab clamps `setTimeout` to about once a second
 * and, after five minutes, to about once a minute. But the events themselves are not scheduled by a
 * timer — `scheduleUntil` fills four seconds of AUDIO time ahead on each tick, and the AudioContext
 * keeps running at full speed whether anyone is looking at the page or not. Ten voices a second
 * being created against one cleanup a second is a leak that only exists while nobody is watching,
 * which is the worst kind, and this lane has already shipped one leak of exactly that family.
 *
 * So: start the audio, watch it in the foreground, put a second tab in front of it for `--hidden`
 * seconds, bring it back, and watch it again. Backgrounding is done by actually raising another
 * page rather than by dispatching a `visibilitychange` event, because the throttling this is about
 * is the browser's, not the page's, and a synthetic event does not trigger it.
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
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/hidden');
const hiddenFor = Number(args.hidden ?? 300);
const watchFor = Number(args.watch ?? 60);
const log = (...m) => console.error('[hidden]', ...m);
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
const rows = [];
const pageErrors = [];
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  if (args.silent) {
    // the control: the same page, backgrounded the same way, with no AudioContext ever started.
    // Chrome exempts a page that is making sound from background timer throttling, so if the timers
    // are throttled here and not there, the reason the audio survives is that it is audible.
    log('CONTROL: no gesture, so no audio — measuring what the browser does to a silent tab');
  } else {
    // a real key press is the gesture the browser needs before an AudioContext may run
    for (let i = 0; i < 2; i++) {
      await page.keyboard.down('KeyM');
      await page.keyboard.up('KeyM');
    }
    await new Promise((r) => setTimeout(r, 1500));
    log('audio', JSON.stringify(await page.evaluate(() => window.__ZR_AUDIO__.stats())));
  }

  if (args.clamp) {
    // This headless Chrome does not throttle background timers at all — the silent control proves
    // it, so the real browser's clamp cannot be exercised here by hiding the tab. Impose it
    // instead: while the page is hidden, no timer may fire sooner than a second after it is set.
    // That is stricter than Chrome, which wakes the page once a second and then runs everything
    // due, so a run that survives this survives the real thing.
    await page.evaluate(() => {
      const real = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...rest) => real(fn, document.hidden ? Math.max(1000, ms || 0) : ms, ...rest);
      const realInterval = window.setInterval.bind(window);
      window.setInterval = (fn, ms, ...rest) => realInterval(fn, document.hidden ? Math.max(1000, ms || 0) : ms, ...rest);
    });
    log('CLAMP: while hidden, no timer in the page may fire sooner than 1 s');
  }

  // A test of throttling has to show that throttling happened, or a clean result means nothing.
  // These count how often the browser actually runs a timer and a frame, so the report can say
  // whether the tab was really backgrounded rather than assuming `bringToFront` did it.
  await page.evaluate(() => {
    const w = window;
    w.__TICKS__ = { timeout: 0, raf: 0, hiddenSeen: 0, visibleSeen: 0 };
    const beat = () => {
      w.__TICKS__.timeout++;
      if (document.hidden) w.__TICKS__.hiddenSeen++;
      else w.__TICKS__.visibleSeen++;
      setTimeout(beat, 50);
    };
    beat();
    const frame = () => {
      w.__TICKS__.raf++;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  const sample = async (phase) => {
    const s = await page.evaluate(() => {
      const st = window.__ZR_AUDIO__.stats() ?? { voices: 0, contextTime: 0, birds: 0, flutters: 0, state: 'idle', heap: null };
      const t = window.__TICKS__;
      return { voices: st.voices, contextTime: st.contextTime, birds: st.birds, flutters: st.flutters, state: st.state, hidden: document.hidden, heap: st.heap ?? null, timeout: t.timeout, raf: t.raf, hiddenSeen: t.hiddenSeen };
    });
    rows.push({ phase, wall: Date.now(), ...s });
    return s;
  };

  log(`watching for ${watchFor} s in the foreground`);
  const t0 = Date.now();
  while (Date.now() - t0 < watchFor * 1000) {
    await sample('before');
    await new Promise((r) => setTimeout(r, 5000));
  }
  const last = rows[rows.length - 1];

  // raise another page over it: this is what actually backgrounds a tab
  const cover = await browser.newPage();
  await cover.goto('about:blank');
  await cover.bringToFront();
  log(`hidden for ${hiddenFor} s (a second tab is in front)`);
  // sampled from the outside while it is still behind: evaluating on a background target does not
  // raise it, so `document.hidden` here is the browser's own answer rather than an inference
  const midway = [];
  for (let i = 0; i < Math.max(1, Math.round(hiddenFor / 30)); i++) {
    await new Promise((r) => setTimeout(r, 30_000));
    const s = await page.evaluate(() => ({ hidden: document.hidden, timeout: window.__TICKS__.timeout, raf: window.__TICKS__.raf, voices: window.__ZR_AUDIO__.stats()?.voices ?? 0, contextTime: window.__ZR_AUDIO__.stats()?.contextTime ?? 0 }));
    midway.push({ at: (i + 1) * 30, ...s });
    rows.push({ phase: 'hidden', wall: Date.now(), ...s });
  }
  log(`while behind: document.hidden ${midway.every((m) => m.hidden) ? 'true throughout' : 'NOT ALWAYS TRUE — ' + JSON.stringify(midway.map((m) => m.hidden))}`);
  await page.bringToFront();
  await cover.close();

  const back = await sample('back');
  const audioRan = back.contextTime - last.contextTime;
  log(`back. the context clock advanced ${audioRan.toFixed(1)} s of the ${hiddenFor} s it was hidden`);
  log(`voices ${last.voices} -> ${back.voices}`);

  log(`watching for ${watchFor} s again`);
  const t1 = Date.now();
  while (Date.now() - t1 < watchFor * 1000) {
    await sample('after');
    await new Promise((r) => setTimeout(r, 5000));
  }
  fs.writeFileSync(path.join(out, 'hidden.json'), JSON.stringify({ hiddenFor, watchFor, pageErrors, rows }, null, 1));
  log(`${rows.length} samples, ${pageErrors.length} page errors -> ${path.join(out, 'hidden.json')}`);
} finally {
  await browser.close();
  await server.close();
}
