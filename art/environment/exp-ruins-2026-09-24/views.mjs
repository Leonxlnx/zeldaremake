#!/usr/bin/env node
// The ruins' views: pose-counts.mjs (draws and triangles after a composed frame, the sun's depth pass
// included) plus a canvas frame per pose, one world load per dist; the fixed viewpoints' frames also as PNG.
//   node art/environment/exp-ruins-2026-09-24/views.mjs --dist <dist> --out <dir> [--shots poses.json]
//        [--heroes 1] [--size 960x540] [--settle 8] [--only a,b] [--no-shots] [--audit 1] [--hud 1]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openWorld, serveStatic } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const out = path.resolve(args.out ?? '/tmp/views');
fs.mkdirSync(out, { recursive: true });
const [width, height] = String(args.size ?? '960x540').split('x').map(Number);
const settle = Number(args.settle ?? 8);
const shots = args.shots ? JSON.parse(fs.readFileSync(path.resolve(args.shots), 'utf8')) : [];
const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width, height, log: console.error });
  const heroes = args.heroes ? await page.evaluate(() => window.__ZR__.viewpoints().filter((v) => !v.diagnostic).map((v) => v.id)) : [];
  const poses = [...heroes.map((id) => ({ name: id, viewpoint: id })), ...shots.map((s) => ({ name: s.name, pose: s.from }))].filter((p) => !only || only.has(p.name));
  if (!args.hud) await page.evaluate(() => { for (const sel of ['.zr-hud', '.zr-equip']) { const el = document.querySelector(sel); if (el) el.style.display = 'none'; } });
  const canvas = await page.$('canvas');
  for (const p of poses) {
    await page.evaluate(({ viewpoint, pose }) => {
      window.__ZR__.setTime(12.5);
      if (viewpoint) window.__ZR__.setViewpoint(viewpoint);
      else window.__ZR__.setPose(pose.p, pose.t, pose.fov);
    }, p);
    for (let left = settle; left > 0; left -= 4) await page.evaluate(async (n) => { await window.__ZR__.render(n, 1 / 30); }, Math.min(4, left));
    const s = await page.evaluate(() => window.__ZR__.stats());
    const row = { pose: p.name, drawCalls: s.drawCalls ?? s.calls, triangles: s.triangles };
    if (!args['no-shots']) await canvas.screenshot({ path: path.join(out, `${p.name}.jpg`), type: 'jpeg', quality: 90 });
    if (p.viewpoint) await canvas.screenshot({ path: path.join(out, `${p.name}.png`), type: 'png' });
    rows.push(row);
    console.error(`[views] ${row.pose}: ${row.drawCalls} draws, ${(row.triangles / 1e6).toFixed(3)} M triangles`);
    fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(rows, null, 1));
  }
  if (args.audit) fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(await page.evaluate(() => window.__ZR__.audit()), null, 1));
} finally {
  await browser.close();
  server.close();
}
