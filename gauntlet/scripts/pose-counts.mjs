#!/usr/bin/env node
/**
 * pose-counts.mjs — draw calls and triangles at fixed poses, one world load per dist.
 *
 *   node gauntlet/scripts/pose-counts.mjs --dist dist --out counts.json [--shots poses.json] [--only A_stairs,D_log] [--size 960x540]
 *
 * Poses: the six fixed viewpoints (A–F) plus any `--shots` file (broll format, the `from` pose).
 * Each pose settles `--settle` frames (default 6) before `__ZR__.stats()` is read, so the near-LOD
 * pools have swapped in what that pose draws.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openWorld, serveStatic } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const [width, height] = String(args.size ?? '960x540').split('x').map(Number);
const settle = Number(args.settle ?? 6);
const shots = args.shots ? JSON.parse(fs.readFileSync(path.resolve(args.shots), 'utf8')) : [];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width, height, log: console.error });
  const only = args.only ? String(args.only).split(",") : null;
  const viewpoints = (await page.evaluate(() => window.__ZR__.viewpoints().filter((v) => !v.diagnostic).map((v) => v.id))).filter((id) => !only || only.includes(id));
  const poses = [...viewpoints.map((id) => ({ name: id, viewpoint: id })), ...shots.map((s) => ({ name: s.name, pose: s.from }))];
  for (const p of poses) {
    await page.evaluate(({ viewpoint, pose }) => {
      window.__ZR__.setTime(12.5);
      if (viewpoint) window.__ZR__.setViewpoint(viewpoint);
      else window.__ZR__.setPose(pose.p, pose.t, pose.fov);
    }, p);
    await page.evaluate(async (n) => {
      await window.__ZR__.render(n, 1 / 30);
    }, settle);
    const s = await page.evaluate(() => window.__ZR__.stats());
    const row = { pose: p.name, drawCalls: s.drawCalls ?? s.calls, triangles: s.triangles };
    rows.push(row);
    console.error(`[pose-counts] ${row.pose}: ${row.drawCalls} draws, ${(row.triangles / 1e6).toFixed(2)} M triangles`);
  }
} finally {
  await browser.close();
  server.close();
}
if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify(rows, null, 1));
