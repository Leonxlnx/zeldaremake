#!/usr/bin/env node
/**
 * Contact QA without rendering: for every 24 fps frame in the ranges, the gap between each visible
 * hero / ship / droid / wreck part's lowest point and the hangar deck (negative = sunk into the deck).
 *
 *   node legosw/scripts/probe-contact.mjs --dist <dir> --ranges "79.2:92.8" [--tol 0.05] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../../gauntlet/scripts/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const tol = Number(args.tol ?? 0.05);
const ranges = String(args.ranges).split(',').map((r) => r.split(':').map(Number));

const server = await serveStatic(path.resolve(args.dist || path.resolve(here, '../dist')));
const browser = await launchBrowser({ width: 640, height: 360 });
const rows = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?capture=1&msaa=1`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => !!window.__LSW__, { timeout: 600000 });
  await page.evaluate(() => window.__LSW__.ready);
  for (const [a, b] of ranges) {
    for (let f = Math.round(a * 24); f < Math.round(b * 24); f++) {
      const r = await page.evaluate((T) => window.__LSW__.probeContact(T), f / 24);
      if (r.deck === null) continue;
      for (const [k, v] of Object.entries(r.low)) if (Number.isFinite(v)) rows.push({ f, T: f / 24, shot: r.shot, item: k, gap: v - r.deck });
    }
  }
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.shot}/${r.item}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  console.log(`gap = lowest point − deck (units; 1 stud = 1, a plate ≈ 0.4); flag sinking below −${tol}`);
  for (const [k, rs] of groups) {
    const mn = rs.reduce((m, r) => (r.gap < m.gap ? r : m));
    const mx = rs.reduce((m, r) => (r.gap > m.gap ? r : m));
    const sunk = rs.filter((r) => r.gap < -tol);
    const span = sunk.length ? ` (${sunk[0].T.toFixed(2)}–${sunk[sunk.length - 1].T.toFixed(2)} s)` : '';
    console.log(`${k.padEnd(24)} n ${String(rs.length).padStart(3)}  min ${mn.gap.toFixed(3)} @${mn.T.toFixed(2)}  max ${mx.gap.toFixed(3)} @${mx.T.toFixed(2)}  end ${rs[rs.length - 1].gap.toFixed(3)}  sunk>${tol}: ${sunk.length}${span}`);
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(rows));
} finally {
  await browser.close();
  server.close();
}
