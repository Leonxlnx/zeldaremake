#!/usr/bin/env node
/**
 * vsrenderer.mjs — the trees' hand-assembled audit against the renderer's own count for the same system.
 *
 *   node art/environment/squad2-2026-09-23/auditvsrenderer/vsrenderer.mjs <dist> <out.json> \
 *        [--views 'A_stairs;x,y,z:tx,ty,tz'] [--quality high] [--settle 8]
 *
 * `lookspots/` published both numbers for the same poses without ever setting them side by side, and they
 * disagree badly: at `stairs2-top` the audit read 95 draws / 3 579 312 triangles where `isolate('trees')`
 * read **129 / 3 004 341**, and at `stairs1-top` 114 / 3 969 181 against **151 / 3 625 772**. The audit is
 * ~35 draws LOW and ~0.4–0.6 M triangles HIGH, in both directions at once, and this branch has quoted it in
 * nearly every write-up.
 *
 * `isolate(name)` (src/capture/api.ts) hides every scene child but that system and `lighting`, resets
 * `renderer.info`, and calls `renderer.render` directly — no composer, so no post-processing quads. What it
 * returns is therefore exactly the renderer's own colour + shadow draw count for that system's share of the
 * frame, which is the number a hand-assembled tally has to match.
 *
 * This prints them together with the audit's own colour/depth split so a gap can be attributed rather than
 * guessed at, plus the counts that explain the two mechanisms three applies and `add()` did not:
 *   - `cullExempt`   meshes with `frustumCulled === false` (the BatchedMesh pattern) are drawn whatever the
 *                    frustum says, so a tally that frustum-tests them reports draws that are not optional.
 *   - `mainZero`     meshes whose main-pass count is 0 issue no colour draw (see `proxydraw/`).
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
const out = positional[1] ?? '/tmp/vsrenderer.json';
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
const viewArg = String(flag('views', flag('view', 'A_stairs')));
const views = viewArg.includes(';') ? viewArg.split(';').filter(Boolean) : [viewArg];
const quality = flag('quality', 'high');
const settle = Number(flag('settle', 8));

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, quality, log: () => {} });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  const rows = [];
  for (const view of views) {
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
      const sub = t.submission ?? {};
      // the isolate render happens AFTER the audit read, so the audit describes the same settled state
      const iso = window.__ZR__.isolate('trees');
      return {
        frame: { draws: s.drawCalls, triangles: s.triangles },
        audit: {
          calls: sub.drawCalls ?? null,
          triangles: sub.triangles ?? null,
          colourCalls: sub.colourCalls ?? null,
          depthCalls: sub.depthCalls ?? null,
          cullExempt: sub.cullExempt ?? null,
          mainZero: sub.mainZero ?? null,
          noCullCalls: sub.noCullCalls ?? null,
          batchCulledTris: sub.batchCulledTris ?? null,
          batchCulledTrisColour: sub.batchCulledTrisColour ?? null,
          batchCulledTrisDepth: sub.batchCulledTrisDepth ?? null,
          nonIndexedLobes: sub.nonIndexedLobes ?? null,
          meshes: sub.meshes ?? null,
        },
        isolate: { found: iso.found, calls: iso.drawCalls, triangles: iso.triangles },
      };
    });
    const gapC = data.isolate.calls - (data.audit.calls ?? 0);
    const gapT = data.isolate.triangles - (data.audit.triangles ?? 0);
    rows.push({ view, ...data, gap: { calls: gapC, triangles: gapT } });
    const a = data.audit;
    console.log(
      `${view.padEnd(34)} frame ${String(data.frame.draws).padStart(4)}  ` +
        `audit ${String(a.calls).padStart(4)}/${String(a.triangles).padStart(8)} (colour ${a.colourCalls ?? '?'} depth ${a.depthCalls ?? '?'}, exempt ${a.cullExempt ?? '?'}, mainZero ${a.mainZero ?? '?'}, batchCulled ${a.batchCulledTris ?? '?'} = ${a.batchCulledTrisColour ?? '?'}c + ${a.batchCulledTrisDepth ?? '?'}d, nonIndexed ${a.nonIndexedLobes ?? '?'})  ` +
        `renderer ${String(data.isolate.calls).padStart(4)}/${String(data.isolate.triangles).padStart(8)}  ` +
        `GAP ${gapC >= 0 ? '+' : ''}${gapC} calls / ${gapT >= 0 ? '+' : ''}${gapT} tris`,
    );
  }
  fs.writeFileSync(out, JSON.stringify({ dist, quality, settle, rows }, null, 1));
  const exact = rows.filter((r) => r.gap.calls === 0 && r.gap.triangles === 0).length;
  console.log(`\n${exact} of ${rows.length} views agree exactly with the renderer`);
  console.log(`→ ${out}`);
} finally {
  await browser.close();
  await server.close();
}
