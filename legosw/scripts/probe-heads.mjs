#!/usr/bin/env node
/**
 * Framing QA without rendering: for every 24 fps frame in the given ranges, where do the heroes'
 * heads (hair included) land in the 2.39:1 picture? Reports headroom to the top edge in picture
 * pixels and flags frames where hair crosses the frame edge.
 *
 *   node legosw/scripts/probe-heads.mjs --dist <dir> --ranges "40.5:44.5,54:57.5" [--size 1280x720] [--min 8] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../../gauntlet/scripts/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const [width, height] = String(args.size || '1280x720').split('x').map(Number);
const minPx = Number(args.min ?? 8);
const ranges = String(args.ranges).split(',').map((r) => r.split(':').map(Number));

const server = await serveStatic(path.resolve(args.dist || path.resolve(here, '../dist')));
const browser = await launchBrowser({ width, height });
const rows = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  await page.goto(`${server.url}/?capture=1&msaa=1`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => !!window.__LSW__, { timeout: 600000 });
  await page.evaluate(() => window.__LSW__.ready);
  const picH = await page.evaluate(() => document.querySelector('canvas').getBoundingClientRect().height);
  for (const [a, b] of ranges) {
    const f0 = Math.round(a * 24), f1 = Math.round(b * 24);
    const res = await page.evaluate(
      ([f0, f1]) => {
        const out = [];
        for (let f = f0; f < f1; f++) out.push({ f, ...window.__LSW__.probeHeads(f / 24) });
        return out;
      },
      [f0, f1],
    );
    for (const r of res) {
      for (const h of r.heads) {
        const headroom = ((1 - h.top) / 2) * picH;
        const tall = ((h.top - h.bottom) / 2) * picH;
        rows.push({ f: r.f, T: r.f / 24, shot: r.shot, who: h.who, headroom, tall, cx: (h.left + h.right) / 2, left: h.left, right: h.right });
      }
    }
  }
  console.log(`picture height ${picH} px (letterboxed 2.39:1 band); flag when headroom < ${minPx} px`);
  const byShot = new Map();
  for (const r of rows) {
    const k = `${r.shot}/${r.who}`;
    if (!byShot.has(k)) byShot.set(k, []);
    byShot.get(k).push(r);
  }
  for (const [k, rs] of byShot) {
    const minH = rs.reduce((m, r) => (r.headroom < m.headroom ? r : m));
    const maxT = rs.reduce((m, r) => (r.tall > m.tall ? r : m));
    const bad = rs.filter((r) => r.headroom < minPx);
    const span = bad.length ? `${bad[0].T.toFixed(2)}–${bad[bad.length - 1].T.toFixed(2)} s` : '—';
    console.log(
      `${k.padEnd(26)} frames ${String(rs.length).padStart(3)}  head ${rs[0].tall.toFixed(0)}→${rs[rs.length - 1].tall.toFixed(0)} px (max ${maxT.tall.toFixed(0)} @${maxT.T.toFixed(2)})  ` +
        `headroom start ${rs[0].headroom.toFixed(0)} min ${minH.headroom.toFixed(0)} @${minH.T.toFixed(2)} end ${rs[rs.length - 1].headroom.toFixed(0)} px  ` +
        `centre x ${rs[0].cx.toFixed(2)}→${rs[rs.length - 1].cx.toFixed(2)}  below ${minPx}px: ${bad.length} (${span})`,
    );
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(rows, null, 1));
} finally {
  await browser.close();
  server.close();
}
