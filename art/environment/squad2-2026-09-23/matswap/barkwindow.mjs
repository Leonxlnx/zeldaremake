#!/usr/bin/env node
/**
 * barkwindow.mjs — what a one-material swap on the distant / mid trees is worth at each pose, before
 * building it.
 *
 *   node art/environment/squad2-2026-09-23/matswap/barkwindow.mjs [--dist dist] [--views A_stairs,...]
 *       [--settle 8] [--out /tmp/barkwindow.json]
 *
 * Reads `audit().systems.trees.barkWindow` (index.ts `distantBarkWindow()`): per distant / mid mesh, how
 * far its nearest bark FRAGMENT stands from the camera, and how many of those meshes have every fragment
 * beyond `DISTANT_BARK_M[1]` — the distance past which `mats.distant`'s near bark treatment is exactly
 * zero and the crown material can therefore draw the wood on its own.
 *
 * `woodgain/` measured the whole swap at 15–17 draws and could not ship it: inside the window a mid bole
 * loses the treatment and reads as a flat grey cylinder. `beyond` is the ceiling on the safe share of
 * those draws, and it is a per-pose number, so it is measured and not predicted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = flag('dist', 'dist');
const views = String(flag('views', 'A_stairs,B_house,C_lookback,D_log,E_ground,F_canopy')).split(',');
const settle = Number(flag('settle', 8));
const out = flag('out', '/tmp/barkwindow.json');

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
const rows = {};
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, quality: 'high', log: () => {} });
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  for (const id of views) {
    await page.evaluate((v) => window.__ZR__.setViewpoint(v), id);
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), settle);
    const row = await page.evaluate(async () => {
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      const t = window.__ZR__.audit().systems.trees;
      return { draws: s.drawCalls, triangles: s.triangles, treeDraws: t.submission?.drawCalls ?? null, bark: t.barkWindow ?? null };
    });
    rows[id] = row;
    const b = row.bark;
    console.error(
      `${id.padEnd(11)} frame ${row.draws}/${row.triangles}  trees ${row.treeDraws}  ` +
        (b ? `beyond ${b.beyond} within ${b.within} nearest ${b.nearestM} m` : 'NO barkWindow FIELD'),
    );
    if (b) for (const [name, m] of Object.entries(b.perMesh).sort((x, y) => x[1] - y[1])) console.error(`    ${name.padEnd(16)} ${m} m${m < b.windowM[1] ? '   <- inside the window' : ''}`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(path.resolve(out), JSON.stringify(rows, null, 1));
const total = Object.values(rows).reduce((n, r) => n + (r.bark?.beyond ?? 0), 0);
console.log(`\nsafe one-material draws available: ${Object.entries(rows).map(([k, r]) => `${k} ${r.bark?.beyond ?? '?'}`).join(', ')}  (sum ${total})`);
