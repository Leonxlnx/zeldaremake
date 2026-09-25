#!/usr/bin/env node
/**
 * ground.mjs — how far off the ground a standing place actually is.
 *
 *   node art/audio/2026-09-24-standing/ground.mjs --dist dist
 *
 * `floorY` in the layout is an ABSOLUTE height, not a drop, and this lane has already quoted one as
 * though it were a drop (`art/audio/2026-09-24-ropewalk/` describes the grove's walkway as hanging
 * over "11.6 m and 11.3 m", which are the two huts' floor heights above the world origin). The
 * distinction matters to this lane because "he is up among the crowns" and "he is on a deck a step
 * above the path" are different places to stand and should not be the same sound.
 *
 * There is no exported terrain height query, so this asks the thing that knows. `__ZR_PLAY__.ground`
 * returns, for an (x, z), the height the character system would stand him at (`walk`) and the
 * height of the terrain under it (`terrain`). The difference is the air beneath his boots.
 */
import { serveStatic, launchBrowser } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);

/** [what it is, x, z] — a deck, then open ground a few metres off it */
const SPOTS = [
  ['the shelf pad, at the gangway\u2019s foot', 6.16, -94.68],
  ['the stilt house\u2019s veranda', 12.0, -91.5],
  ['open ground 4 m east of the stilt house', 16.0, -91.5],
  ['the rope walk, midway', 14.4, -88.35],
  ['open ground under the rope walk, 4 m north', 14.4, -84.4],
  ['the tree hut\u2019s platform', 16.8, -85.2],
  ['the grove trail, on a set stone', -0.43, -90.11],
  ['the west house', -23.0, 9.0],
  ['open ground 5 m east of the west house', -18.0, 9.0],
  ['the plaza', 1.5, -6.0],
  // the ravine's rope bridge, which the ropewalk report compared the grove's walkway against
  ['the ravine bridge, quarter span', 3.9, 30.5],
  ['the ravine bridge, midspan', 3.9, 37.08],
  ['the ravine bridge, three quarters', 3.9, 43.6],
];

const server = await serveStatic(args.dist || 'dist');
const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const page = await browser.newPage();
  // play mode runs its own systems only when the page does not look automated (as play-shot.mjs does)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 900000 });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: 900000, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  console.log(`${'place'.padEnd(44)} ${'x'.padStart(7)} ${'z'.padStart(8)} ${'he stands at'.padStart(13)} ${'terrain'.padStart(8)} ${'air under him'.padStart(14)}`);
  for (const [note, x, z] of SPOTS) {
    const g = await page.evaluate(([px, pz]) => window.__ZR_PLAY__.ground(px, pz), [x, z]);
    const drop = g.walk - g.terrain;
    console.log(`${note.padEnd(44)} ${x.toFixed(2).padStart(7)} ${z.toFixed(2).padStart(8)} ${g.walk.toFixed(2).padStart(13)} ${g.terrain.toFixed(2).padStart(8)} ${drop.toFixed(2).padStart(14)}`);
  }
} finally {
  await browser.close();
  await server.close();
}
