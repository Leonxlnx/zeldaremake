#!/usr/bin/env node
/**
 * frozen.mjs — the harness behind every "byte-identical" claim this lane has made. Renders a list of
 * poses with the WORLD CLOCK FROZEN and writes, per pose, the draw calls, the triangles, an md5 of the
 * PNG and the PNG itself, so two builds can be compared without wind, sun or pool warm-up moving under
 * the comparison.
 *
 *   node art/environment/squad2-2026-09-23/frozen.mjs <dist> <out> [--poses a.json] [--views A_stairs,F_canopy]
 *       [--size 960x540] [--settle 8]
 *
 * `--poses` takes a broll-format list (each entry's `from` is used: `{ name, from: { p, t, fov } }`);
 * `--views` takes fixed viewpoint ids. Both may be given; views are visited first.
 *
 * Why the clock is frozen, measured (art/environment/squad2-2026-09-23/settle):
 *
 *  • With `render(n, 1/30)` the same pose at the flight's foot reads 545 draws / 9 129 877 triangles for
 *    fifteen frames and 544 / 9 129 709 from the sixteenth — 0.53 s of world time in which the sun
 *    creeps, its shadow target snaps a texel, and one marginal caster leaves the depth pass. With
 *    `render(n, 0)` all twenty frames are one value.
 *  • Wind is worse: an early run of the caster experiment advanced 1/30 s per step and every group
 *    appeared to change 13–31 % of the frame. It was the leaves moving, not the change under test.
 *
 * So the protocol is: settle WITH time (the near-LOD pools need it), then read with the clock stopped.
 * A comparison must also stay inside one run of this script — pool residency carries over between poses,
 * and the foot pose differs by one draw and 168 triangles depending on whether A–F were visited first.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = positional[0] ?? 'dist';
const out = positional[1] ?? '/tmp/frozen';
const [width, height] = String(flag('size', '960x540')).split('x').map(Number);
const settle = Number(flag('settle', 8));
const poses = flag('poses') ? JSON.parse(fs.readFileSync(path.resolve(flag('poses')), 'utf8')) : [];
const views = flag('views') ? String(flag('views')).split(',') : [];
// `--quality low` checks the weak-device tier with the same protocol as the default one (tiers/)
const quality = flag('quality', 'high');
if (!poses.length && !views.length) {
  console.error('nothing to render: pass --poses <file> and/or --views A_stairs,D_log');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const rows = {};
try {
  const { page } = await openWorld(browser, server.url, { width, height, quality, log: () => {} });
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  const shot = async (name) => {
    // settle WITH time so the pools swap in, then stop the clock and read
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), settle);
    const stats = await page.evaluate(async () => {
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      const t = window.__ZR__.audit().systems.trees;
      return {
        draws: s.drawCalls,
        triangles: s.triangles,
        treeDraws: t.submission?.drawCalls ?? null,
        treeTriangles: t.submission?.triangles ?? null,
        giantGroupsCasting: t.submission?.giantGroupsCasting ?? null,
        giantGroupsTotal: t.submission?.giantGroupsTotal ?? null,
        nearBolesCasting: t.submission?.nearBolesCasting ?? null,
        slotsInFrame: t.nearCanopy?.slotsInFrame ?? null,
      };
    });
    const png = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(out, `${name}.png`), png);
    rows[name] = { ...stats, md5: crypto.createHash('md5').update(png).digest('hex') };
    console.error(`${name} ${stats.draws}/${stats.triangles} trees ${stats.treeDraws}/${stats.treeTriangles} ${rows[name].md5}`);
  };
  for (const id of views) {
    await page.evaluate((v) => window.__ZR__.setViewpoint(v), id);
    await shot(id);
  }
  for (const p of poses) {
    const from = p.from ?? p;
    await page.evaluate((f) => window.__ZR__.setPose(f.p, f.t, f.fov ?? 46), from);
    await shot(p.name ?? `pose-${Object.keys(rows).length}`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(rows, null, 1));
console.log(JSON.stringify(rows, null, 1));
