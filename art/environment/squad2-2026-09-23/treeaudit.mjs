// squad2: the trees system's own audit at a pose, after the pools have settled — which family is
// resident and shown when a frame costs what it costs. `isolate()` stops at the top-level system, so
// this is the only way to split `trees` into giants / columns / white-barks / distant / near pool.
//
//   node art/environment/squad2-2026-09-23/treeaudit.mjs <dist> <shots.json> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', shotsPath, outPath = '/tmp/treeaudit.json'] = process.argv.slice(2);
const W = 960, H = 540, SETTLE = 8;
const log = (...m) => console.error(`[treeaudit ${new Date().toISOString().slice(11, 19)}]`, ...m);
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
    await page.evaluate(async (n) => await window.__ZR__.render(n, 0), SETTLE);
    const row = await page.evaluate(() => {
      const s = window.__ZR__.stats();
      const a = window.__ZR__.audit();
      return { draws: s.drawCalls, triangles: s.triangles, trees: a.systems?.trees ?? null, canopy: a.systems?.canopy ?? null };
    });
    rows.push({ name: shot.name, ...row });
    log(`  ${row.draws} draws / ${(row.triangles / 1e6).toFixed(2)} M`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rows, null, 1));
for (const r of rows) {
  console.log(`\n${r.name}: ${r.draws} draws / ${(r.triangles / 1e6).toFixed(2)} M`);
  const flat = (o, prefix = '') =>
    Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
  for (const [k, v] of flat(r.trees)) if (/count|shown|resident|draw|instances|parts|lod/i.test(k)) console.log(`  trees.${k} = ${JSON.stringify(v)}`);
}
