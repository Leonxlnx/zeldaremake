#!/usr/bin/env node
/**
 * bucketprobe.mjs — which LOD bucket holds what, at a pose and a quality tier.
 *
 *   node art/environment/squad2-2026-09-23/bandwidth/bucketprobe.mjs <dist> <out.json> \
 *        [--view F_canopy] [--quality low] [--settle 8]
 *
 * Written for one question that `frozen.mjs` cannot answer. At `quality=low`, `F_canopy` renders with the
 * rung band on and off at **identical** draws and triangles — the trees' own submission included, 61 draws
 * and 2 292 225 triangles either way — while 0.40 % of the frame moves by a mean of 44 levels and a
 * distant trunk visibly thins. A banded tree is supposed to be added to BOTH rungs, which would change the
 * counts. So either no tree is banded and the difference is something else, or a tree is banded and its
 * second mesh is drawing nothing.
 *
 * `submission.byFamily` splits the trees system per family AND per LOD (`whitebark-lod0/1/2`, `column-lod*`
 * …), which is exactly the granularity that separates those two stories: if `lod0` and `lod1` both hold the
 * banded tree, the band is bucketing correctly and the second mesh is being culled; if neither shows a
 * change, nothing is banded.
 *
 * Also dumps `lodBand` (the resolved width and the gate gap) and `lodSwapM`, because at low quality the
 * gates are 19.2 and 26.4 m and that 7.2 m gap is what limits the band at all.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = positional[0] ?? 'dist';
const out = positional[1] ?? '/tmp/bucketprobe.json';
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
const view = flag('view', 'F_canopy');
const quality = flag('quality', 'low');
const settle = Number(flag('settle', 8));

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, quality, log: () => {} });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  await page.evaluate((v) => window.__ZR__.setViewpoint(v), view);
  await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), settle);
  const data = await page.evaluate(async () => {
    await window.__ZR__.render(2, 0);
    const s = window.__ZR__.stats();
    const t = window.__ZR__.audit().systems.trees;
    return {
      draws: s.drawCalls,
      triangles: s.triangles,
      lodBand: t.lodBand ?? null,
      lodSwapM: t.lodSwapM ?? null,
      treeSubmission: { drawCalls: t.submission?.drawCalls ?? null, triangles: t.submission?.triangles ?? null },
      byFamily: t.submission?.byFamily ?? null,
      unaccounted: t.submission?.unaccounted ?? null,
    };
  });
  fs.writeFileSync(out, JSON.stringify({ dist, view, quality, ...data }, null, 1));
  const rungs = Object.entries(data.byFamily ?? {})
    .filter(([k]) => /-lod\d$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  console.log(`${dist}  ${view}  quality=${quality}   ${data.draws}/${data.triangles}   trees ${data.treeSubmission.drawCalls}/${data.treeSubmission.triangles}`);
  console.log(`  lodBand ${JSON.stringify(data.lodBand)}`);
  console.log(`  gates   ${JSON.stringify(data.lodSwapM?.tree)}`);
  // the tally's field is `calls`, not `drawCalls` — the first version of this line printed "? draws"
  for (const [k, v] of rungs) console.log(`  ${k.padEnd(22)} ${String(v.calls ?? '?').padStart(4)} draws  ${String(v.triangles ?? '?').padStart(9)} triangles  ${String(v.instances ?? '?').padStart(4)} instances`);
  const u = data.unaccounted ?? {};
  console.log(`  unaccounted            ${u.meshes ?? '?'} meshes / ${u.calls ?? '?'} calls / ${u.triangles ?? '?'} triangles`);
  console.log(`  unclaimed names        ${JSON.stringify(u.names ?? null)}`);
} finally {
  await browser.close();
  await server.close();
}
