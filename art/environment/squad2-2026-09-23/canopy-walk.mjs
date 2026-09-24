#!/usr/bin/env node
/**
 * canopy-walk.mjs — is the giants' near-canopy SLOT CAP what a walker sees change?
 *
 *   node art/environment/squad2-2026-09-23/canopy-walk.mjs --dist dist [--out walk.json]
 *        [--from 1.4,6 --to 1.5,-38 --steps 45] [--settle 2]
 *
 * One world load in PLAY mode (`?test=1`), because that is the path a walk takes: the world's
 * `update` re-buckets with `reset = false`, where the near-canopy selection's hysteresis lives. (The
 * capture harness's `setPose` goes through `onCameraMove` → `reset = true`, which is deliberately
 * unbiased so every capture of a pose draws the same parts.) Link is placed at successive points along
 * a walk line and the simulation stepped with `render = false` — the audit numbers are wanted, not the
 * pixels, so a 44 m walk costs no rasterisation at all.
 *
 * Per step it reports how many lobes are ACTIVE (eligible), how many the `NEAR_CANOPY_SLOTS` cap turns
 * away, where the farthest shown part actually is, and which parts entered and left the shown set. A
 * selection decided by distance changes slowly and only at the in / out radii, which carry hysteresis;
 * a selection decided by RANK because the cap is full can trade parts every metre with nothing damping
 * it, and each trade flips a crown between its near laminae and its folded far foliage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const steps = Number(args.steps ?? 45);
const settle = Number(args.settle ?? 2);
const from = String(args.from ?? '1.4,6').split(',').map(Number);
const to = String(args.to ?? '1.5,-38').split(',').map(Number);

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 320, height: 180 });
const rows = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 180, deviceScaleFactor: 1 });
  // play mode runs only when the page does not look automated (as playtest.mjs / pool-check.mjs do)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  // the prebuild frame first, so the pool's residency is not what is being measured
  await page.evaluate(() => window.__ZR_PLAY__.step(4, 1 / 30, false));
  const yaw = Math.atan2(to[0] - from[0], to[1] - from[1]);
  let previous = null;
  for (let s = 0; s < steps; s++) {
    const t = steps === 1 ? 0 : s / (steps - 1);
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[1] + (to[1] - from[1]) * t;
    await page.evaluate((px, pz, py, frames) => {
      window.__ZR_PLAY__.place(px, pz, py);
      window.__ZR_PLAY__.step(frames, 1 / 30, false);
    }, x, z, yaw, settle);
    const nc = await page.evaluate(() => {
      const n = window.__ZR__.audit().systems.trees.nearCanopy;
      return { activeLobes: n.activeLobes, slotOverflow: n.slotOverflow, slots: n.slots, farthestShownM: n.farthestShownM, shownTriangles: n.shownTriangles, ids: n.shown.map((r) => r[0]) };
    });
    const ids = new Set(nc.ids);
    const entered = previous ? nc.ids.filter((id) => !previous.has(id)) : [];
    const left = previous ? [...previous].filter((id) => !ids.has(id)) : [];
    rows.push({ step: s, at: [Math.round(x * 10) / 10, Math.round(z * 10) / 10], activeLobes: nc.activeLobes, slotOverflow: nc.slotOverflow, slots: nc.slots, farthestShownM: nc.farthestShownM, shown: nc.ids.length, entered: entered.length, left: left.length });
    const r = rows[rows.length - 1];
    console.log(
      `step ${String(s).padStart(2)} at ${r.at.join(', ')}  active ${String(r.activeLobes).padStart(3)} / ${r.slots}` +
        `  turned away ${String(r.slotOverflow).padStart(3)}  shown ${String(r.shown).padStart(3)}  farthest ${String(r.farthestShownM).padStart(5)} m  entered ${String(r.entered).padStart(2)}  left ${String(r.left).padStart(2)}`,
    );
    previous = ids;
  }
} finally {
  await browser.close();
  server.close();
}
const churn = rows.slice(1);
const total = churn.reduce((n, r) => n + r.entered + r.left, 0);
const overflowSteps = rows.filter((r) => r.slotOverflow > 0).length;
const metres = Math.hypot(to[0] - from[0], to[1] - from[1]);
console.log(
  `\n${overflowSteps} of ${rows.length} steps overflow the slot cap; ` +
    `${total} admissions + evictions over ${churn.length} steps of ${(metres / Math.max(1, steps - 1)).toFixed(1)} m ` +
    `(${(total / Math.max(1, churn.length)).toFixed(2)} a step, ${(total / metres).toFixed(2)} a metre)`,
);
if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify({ from, to, steps, settle, rows, summary: { overflowSteps, churn: total, perStep: total / Math.max(1, churn.length), perMetre: total / metres } }, null, 1));
