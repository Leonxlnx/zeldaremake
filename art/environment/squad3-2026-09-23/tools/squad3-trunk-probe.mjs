#!/usr/bin/env node
/**
 * squad3 probe: name the trunks in the owner's 06:50 north-path pose.
 *
 * Reads the per-pixel depth of the rendered pose at the screen columns of the pale cylinders in
 * his markup, and projects every white-bark placement, every authored column seat and the
 * layout's giants so a depth can be matched to a family. Read-only.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../../../../dist');
const POSE = { p: [1.4, 1.75, -10.2], t: [2.0, 1.45, -20.0], fov: 46 };
const COLUMN_SEATS = [
  [-3.5, -24.7], [-5.7, -31.9], [-1.0, -35.5], [8.8, -26.9], [21.2, 6.8], [24.2, 11.0], [15.7, 5.2], [-3.1, -7.9], [-41, 35.7],
];
/** screen pixels (960 × 540) on the pale cylinders left of the path in the owner's markup */
const PIXELS = [
  [92, 120], [92, 200], [100, 300], [128, 150], [130, 250], [168, 180], [200, 200], [250, 170], [300, 150], [380, 200], [420, 170],
];

const server = await serveStatic(dist);
const browser = await launchBrowser();
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540 });
  await page.evaluate((pose) => window.__ZR__.setPose(pose.p, pose.t, pose.fov), POSE);
  await page.evaluate(() => window.__ZR__.render(3));
  const out = await page.evaluate(
    ({ pose, seats, pixels }) => {
      const trees = window.__ZR__.audit().systems?.trees ?? {};
      const di = window.__ZR__.depthImage(null, 960, 540);
      const depths = pixels.map(([x, y]) => {
        const v = di.data[Math.round((y / 540) * di.height) * di.width + Math.round((x / 960) * di.width)];
        return { x, y, depth: Number.isFinite(v) ? Math.round(v * 10) / 10 : 'sky' };
      });
      const rows = [];
      for (const [x, z] of trees.whiteBarkSampled ?? []) rows.push({ family: 'whitebark', x, z });
      for (const [x, z] of seats) rows.push({ family: 'column-seat', x, z });
      for (const b of trees.distantBases ?? []) rows.push({ family: 'distant', x: b[0], z: b[2] });
      const proj = window.__ZR__.project(rows.map((r) => [r.x, 3.0, r.z]));
      const inFrame = [];
      rows.forEach((r, i) => {
        const s = proj[i];
        if (!s) return;
        const d = Math.hypot(r.x - pose.p[0], r.z - pose.p[2]);
        if (s[0] < 0 || s[0] > 0.5 || d > 140) return;
        inFrame.push({ family: r.family, x: r.x, z: r.z, sx: Math.round(s[0] * 960), d: Math.round(d * 10) / 10 });
      });
      inFrame.sort((a, b) => a.sx - b.sx);
      return { depths, inFrame, distantKeys: Object.keys(trees).filter((k) => k.toLowerCase().includes('distant')) };
    },
    { pose: POSE, seats: COLUMN_SEATS, pixels: PIXELS },
  );
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close();
  await server.close();
}
