#!/usr/bin/env node
/**
 * walk-audio.mjs — what the audio system actually does while somebody plays.
 *
 *   node art/audio/2026-09-23-lane5/walk-audio.mjs --dist dist [--out /tmp/walk-audio.json]
 *
 * Opens the build in play mode (`?test=1`, the same path `gauntlet/scripts/playtest.mjs` uses:
 * `navigator.webdriver` is masked so the page does not take itself for a headless capture), starts
 * the audio with a real key press, then walks Link along a few routes with held keys and reads
 * `window.__ZR_AUDIO__.stats()` at each end. It reports, per route, how many steps sounded, how many
 * of them landed on a boot plant the gait reported (rather than on the distance-integrated stride),
 * which surfaces were heard and how long a frame took — the offline WAVs cannot show any of that.
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
const outFile = path.resolve(args.out || '/tmp/walk-audio.json');
const DT = 1 / 60;
const log = (...m) => console.error('[walk-audio]', ...m);

/** place Link, hold a key for `seconds` of simulation, and say what was underfoot and what sounded */
const ROUTES = [
  { name: 'plaza north over the flagstones', at: [1.5, -8, 180], key: 'KeyW', seconds: 6 },
  { name: 'the north path', at: [3.5, -34, 180], key: 'KeyW', seconds: 7 },
  { name: 'off the path, the north forest floor', at: [12, -38, 180], key: 'KeyW', seconds: 6 },
  { name: 'the lawn west of the spine', at: [-6.5, 2, 200], key: 'KeyW', seconds: 6 },
  { name: 'up the main flight', at: [9.2, -1.4, 340], key: 'KeyW', seconds: 8 },
  { name: 'running the plaza', at: [0, 4, 180], key: 'KeyW', seconds: 6, shift: true },
  { name: 'jumping on the plaza', at: [0, 2, 180], key: 'KeyW', seconds: 7, jumpEvery: 1.6 },
  // the north path crosses the log arch's bore at log-frame u ≈ −4 … −6 (layout.logArch, yaw −16°):
  // walking north from z −51 passes right through it
  { name: 'through the log tunnel', at: [4.84, -51, 180], key: 'KeyW', seconds: 7 },
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
const results = { routes: [], pageErrors: [] };
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  page.on('console', (m) => {
    if (m.type() === 'error') results.pageErrors.push(m.text());
    if (m.text().startsWith('[audio]')) log(m.text());
  });
  page.on('pageerror', (e) => results.pageErrors.push(String(e.message)));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  log('world ready');
  // a real key press is the gesture the browser needs before an AudioContext may run
  await page.keyboard.down('KeyM');
  await page.keyboard.up('KeyM');
  await page.keyboard.down('KeyM');
  await page.keyboard.up('KeyM');
  await new Promise((r) => setTimeout(r, 1500));
  const started = await page.evaluate(() => window.__ZR_AUDIO__.stats());
  log('audio', JSON.stringify(started));
  results.start = started;

  for (const route of ROUTES) {
    await page.evaluate((r) => window.__ZR_PLAY__.place(r.at[0], r.at[1], (r.at[2] * Math.PI) / 180), route);
    await new Promise((r) => setTimeout(r, 400));
    const before = await page.evaluate(() => window.__ZR_AUDIO__.stats());
    if (route.shift) await page.keyboard.down('ShiftLeft');
    await page.keyboard.down(route.key);
    const t0 = Date.now();
    // one simulation frame per animation frame, undrawn: the audio system runs on its own rAF
    // against the wall clock, so the walk has to advance at wall-clock rate for the speeds it
    // reads (and therefore the cadence it plays) to be the ones a player would produce. The gait's
    // stance flags are sampled on every one of those frames — a cadence that reads too fast can
    // then be told apart from a stance flag that flickers.
    const frames = Math.round(route.seconds / DT);
    const jumpEvery = route.jumpEvery ? Math.round(route.jumpEvery / DT) : 0;
    const gait = await page.evaluate(
      async (n, dt, every) => {
        const rows = [];
        for (let i = 0; i < n; i++) {
          // Space is the jump (camera/follow.ts); the harness presses it like a player would
          if (every && i % every === 0) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
            setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })), 90);
          }
          window.__ZR_PLAY__.step(1, dt, false);
          const f = window.__ZR_PLAY__.state().feet;
          rows.push([(f ?? []).map((x) => (x.stance ? 1 : 0)), window.__ZR_AUDIO__.stats()?.enclosure ?? 0]);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return rows;
      },
      frames,
      DT,
      jumpEvery,
    );
    await page.keyboard.up(route.key);
    if (route.shift) await page.keyboard.up('ShiftLeft');
    const after = await page.evaluate(() => window.__ZR_AUDIO__.stats());
    const where = await page.evaluate(() => window.__ZR_PLAY__.state());
    const diff = (k) => after[k] - before[k];
    const surfaces = {};
    for (const [s, n] of Object.entries(after.surfaces)) {
      const d = n - (before.surfaces[s] ?? 0);
      if (d > 0) surfaces[s] = d;
    }
    const stance = gait.map((r) => r[0]);
    const enclosure = gait.map((r) => r[1]);
    const feet = stance[0]?.length ?? 0;
    const pattern = Array.from({ length: feet }, (_, i) => stance.map((r) => (r[i] ? '#' : '.')).join(''));
    const plants = pattern.map((p) => (p.match(/\.#/g) ?? []).length);
    const stanceShare = pattern.map((p) => Number(((p.split('#').length - 1) / p.length).toFixed(2)));
    const row = {
      route: route.name,
      seconds: route.seconds,
      steps: diff('steps'),
      gaitSteps: diff('gaitSteps'),
      landings: diff('landings'),
      surfaces,
      endedAt: where?.link?.map?.((v) => Number(v.toFixed(2))) ?? where?.link ?? null,
      wallMs: Date.now() - t0,
      /** the gait at 60 Hz while the key was held: '#' = the boot is a stance foot */
      gaitPattern: pattern,
      gaitPlantsPerFoot: plants,
      gaitStanceShare: stanceShare,
      /** the bed's enclosure over the route: how closed the space above the listener got */
      enclosureMax: Number(Math.max(...enclosure).toFixed(2)),
      enclosureTrace: enclosure.filter((_, i) => i % 6 === 0).map((v) => Number(v.toFixed(2))),
    };
    results.routes.push(row);
    log(`${route.name}: ${row.steps} steps (${row.gaitSteps} on a boot plant), ${row.landings} landings over ${route.seconds} s — ${JSON.stringify(surfaces)}; the gait planted ${plants.join(' + ')} times`);
    for (const p of pattern) log(`  gait ${p.slice(0, 120)}`);
    if (row.enclosureMax > 0) log(`  enclosure peaks at ${row.enclosureMax}: ${row.enclosureTrace.join(' ')}`);
  }
  results.end = await page.evaluate(() => window.__ZR_AUDIO__.stats());
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
log(`wrote ${outFile}`);
if (results.pageErrors.length) log('page errors:', results.pageErrors.slice(0, 5));
