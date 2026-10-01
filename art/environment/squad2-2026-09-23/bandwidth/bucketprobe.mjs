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
/**
 * One page load, several viewpoints: `unaccounted` has to hold in every state, not just the first one.
 *
 * Separate the list with `;`, not `,`, when any entry is a pose — a pose is `x,y,z:tx,ty,tz` and already
 * uses commas, so a comma-separated list of poses parses into nonsense. The first version of this flag did
 * exactly that and quietly measured the default camera six times.
 */
const viewArg = String(flag('views', flag('view', 'F_canopy')));
const views = viewArg.includes(';') ? viewArg.split(';').filter(Boolean) : viewArg.split(',').filter(Boolean);
if (views.some((v) => v.includes(':')) && !viewArg.includes(';')) throw new Error('a pose entry needs `;` between list items, not `,` — see the comment above');
const quality = flag('quality', 'low');
const settle = Number(flag('settle', 8));

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, quality, log: () => {} });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  const rows = [];
  for (const view of views) {
    // `x,y,z:tx,ty,tz` aims an arbitrary camera, for states no fixed viewpoint reaches — the detached
    // boughs' gate is a frustum test against the southwest giant, which none of A–F looks at
    if (view.includes(':')) {
      const [p0, t0] = view.split(':').map((part) => part.split(',').map(Number));
      await page.evaluate(([pp, tt]) => window.__ZR__.setPose(pp, tt, 46), [p0, t0]);
    } else {
      const ok = await page.evaluate((v) => window.__ZR__.setViewpoint(v), view);
      if (ok === false) throw new Error(`no viewpoint "${view}" — setViewpoint returned false and the camera did not move`);
    }
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
        // the branch `byFamily` guards with `if (detachedGroup.visible)`: this check is only meaningful
        // once it has been exercised in BOTH states, or it proves the walk agrees in one of them
        detachedBoughsVisible: t.submission?.detachedBoughsVisible ?? null,
        nearCanopySlots: JSON.stringify(t.nearCanopy?.slotsInFrame ?? null).slice(0, 40),
      };
    });
    rows.push({ view, ...data });
    const u = data.unaccounted ?? {};
    const ok = u.meshes === 0 && u.calls === 0 && u.triangles === 0;
    console.log(
      `${view.padEnd(11)} ${String(data.draws).padStart(4)}/${String(data.triangles).padStart(8)}  trees ${String(data.treeSubmission.drawCalls).padStart(4)}/${String(data.treeSubmission.triangles).padStart(8)}  ` +
        `detached ${data.detachedBoughsVisible === null ? '?' : data.detachedBoughsVisible ? 'SHOWN ' : 'hidden'}  nearCanopy ${String(data.nearCanopySlots ?? '?').padEnd(18)}  ` +
        `unaccounted ${ok ? 'ZERO' : `${u.meshes}m/${u.calls}c/${u.triangles}t ${JSON.stringify(u.names)}`}`,
    );
  }
  fs.writeFileSync(out, JSON.stringify({ dist, quality, rows }, null, 1));
  const bad = rows.filter((r) => !(r.unaccounted && r.unaccounted.meshes === 0 && r.unaccounted.calls === 0 && r.unaccounted.triangles === 0));
  console.log(bad.length ? `\nNOT ACCOUNTED FOR at ${bad.length} of ${rows.length} view(s)` : `\nunaccounted is zero at all ${rows.length} views`);
  console.log(`detached boughs shown at: ${rows.filter((r) => r.detachedBoughsVisible).map((r) => r.view).join(', ') || 'NONE of these views — that branch is still unexercised'}`);
} finally {
  await browser.close();
  await server.close();
}
