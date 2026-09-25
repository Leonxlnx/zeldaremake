// squad2: who owns the triangles at a pose. `pose-counts.mjs` gives a pose's totals and
// `playtest.mjs --only perf` gives a play spot's totals, but neither says which system they are in.
//
//   node art/environment/squad2-2026-09-23/playcost.mjs <dist> <shots.json> <out.json>
//
// Per pose: settle `--settle` frames so the LOD pools swap in, read the totals and the scene-graph
// roll-up (`stats().bySystem` — shown but not frustum-culled), then `__ZR__.isolate(system)` for the
// heaviest top-level systems, which re-renders the frame with one system visible: the triangles that
// system actually draws at this camera. isolate() only sees scene children, so the granularity is
// `trees` / `canopy` / `terrain` / …, not a tree family.
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', shotsPath, outPath = '/tmp/playcost.json'] = process.argv.slice(2);
const W = 960, H = 540, SETTLE = 8, TOP = 8;
const log = (...m) => console.error(`[playcost ${new Date().toISOString().slice(11, 19)}]`, ...m);
const shots = JSON.parse(fs.readFileSync(path.resolve(shotsPath), 'utf8'));

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H, log });
  for (const shot of shots) {
    log(`pose ${shot.name}`);
    await page.evaluate((sh) => {
      window.__ZR__.setTime(12.5);
      if (sh.viewpoint) window.__ZR__.setViewpoint(sh.viewpoint);
      else window.__ZR__.setPose(sh.from.p, sh.from.t, sh.from.fov);
    }, shot);
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), SETTLE);
    // the drawn totals come from `stats()` (the renderer's info for the frame just rendered); the
    // system names come from the scene roll-up in `audit().scene`
    const stats = await page.evaluate(() => {
      const s = window.__ZR__.stats();
      const scene = window.__ZR__.audit().scene;
      return { draws: s.drawCalls, triangles: s.triangles, bySystem: scene.bySystem };
    });
    const names = Object.entries(stats.bySystem)
      .sort((a, b) => b[1].triangles - a[1].triangles)
      .slice(0, TOP)
      .map(([n]) => n);
    const parts = [];
    for (const n of names) {
      parts.push(await page.evaluate((s) => window.__ZR__.isolate(s), n));
      log(`  isolate ${n}: ${(parts.at(-1).triangles / 1e6).toFixed(3)} M / ${parts.at(-1).drawCalls} draws`);
    }
    rows.push({ name: shot.name, pose: shot.viewpoint ?? shot.from, drawn: { draws: stats.draws, triangles: stats.triangles }, parts: parts.filter((p) => p.found).sort((a, b) => b.triangles - a.triangles) });
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rows, null, 1));
for (const r of rows) {
  const drawnTotal = r.drawn.triangles;
  console.log(`\n${r.name}  ${r.drawn.draws} draws / ${(drawnTotal / 1e6).toFixed(2)} M triangles`);
  for (const p of r.parts) {
    console.log(`  ${p.system.padEnd(22)} ${(p.triangles / 1e6).toFixed(3)} M  ${String(p.drawCalls).padStart(4)} draws  ${((100 * p.triangles) / drawnTotal).toFixed(1)} %`);
  }
}
