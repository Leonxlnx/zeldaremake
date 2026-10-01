/**
 * How long the world takes to build, per system and per phase inside the trees — the owner's "make all
 * the trees load in ASAP", measured.
 *
 *   node art/environment/squad2-2026-09-23/chunks/buildphases.mjs [--dist dist] [--runs 2] [--json out]
 *
 * Reads `__ZR__.perf().buildMs` (per system) and the trees audit's `buildPhases` / `giantStepMs` (the
 * split inside them, added by this branch's first commit). Wall clock, `await yieldFrame()` included,
 * because that is what a player waits. `buildtime/TREE-PHASES.md` recorded the baseline: trees 8.3 s of
 * a 42.7 s build, giants 4.79 s of that.
 *
 * Two runs by default: the numbers move a few per cent between runs on this box, so a difference smaller
 * than that is not a difference.
 */
import fs from 'node:fs';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const DIST = flag('dist', 'dist');
const RUNS = Number(flag('runs', 2));
const JSON_OUT = flag('json', null);

const server = await serveStatic(DIST);
const rows = [];
try {
  for (let run = 0; run < RUNS; run++) {
    const browser = await launchBrowser({ width: 480, height: 270 });
    try {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('pageerror', e.message));
      await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high&capture=1`, { waitUntil: 'load', timeout: 300000 });
      await page.waitForFunction(() => !!window.__ZR__, { timeout: 300000, polling: 250 });
      await page.evaluate(() => window.__ZR__.ready());
      const out = await page.evaluate(() => {
        const perf = window.__ZR__.perf();
        const trees = window.__ZR__.audit().systems.trees;
        return {
          buildMs: perf.buildMs,
          totalMs: Object.values(perf.buildMs ?? {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
          phases: trees.buildPhases,
          giantStepMs: trees.giantStepMs,
        };
      });
      rows.push(out);
      const t = out.buildMs?.trees ?? 0;
      console.error(`run ${run + 1}: trees ${Math.round(t)} ms of ${Math.round(out.totalMs)} ms — ${JSON.stringify(out.phases)}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const summary = {
  dist: DIST,
  runs: rows.length,
  treesMs: Math.round(median(rows.map((r) => r.buildMs?.trees ?? 0))),
  totalMs: Math.round(median(rows.map((r) => r.totalMs))),
  phases: Object.fromEntries(
    Object.keys(rows[0]?.phases ?? {}).map((k) => [k, Math.round(median(rows.map((r) => r.phases?.[k] ?? 0)))]),
  ),
  giantStepMs: Object.fromEntries(
    Object.keys(rows[0]?.giantStepMs ?? {}).map((k) => [k, Math.round(median(rows.map((r) => r.giantStepMs?.[k] ?? 0)))]),
  ),
  bySystem: Object.fromEntries(
    Object.keys(rows[0]?.buildMs ?? {}).map((k) => [k, Math.round(median(rows.map((r) => r.buildMs?.[k] ?? 0)))]),
  ),
};
console.log(JSON.stringify({ summary, rows }, null, 1));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, rows }, null, 1) + '\n');
