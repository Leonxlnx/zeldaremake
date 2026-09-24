#!/usr/bin/env node
/**
 * load-probe.mjs — is the audio thread missing its deadline while he runs?
 *
 *   node art/audio/2026-09-24-music-stable/load-probe.mjs --dist dist [--out /tmp/load.json]
 *
 * The owner (23:00): "the music kind of still shakes whenever I run". An offline render cannot show
 * this — `OfflineAudioContext` renders as fast as it can against a perfect clock, so scheduling is
 * exact there by construction and both takes come out identical. The complaint is about REAL TIME:
 * the audio thread has 2.9 ms to fill each 128-sample quantum at 44.1 kHz, and when it misses, the
 * output has a gap. That is what shaking sounds like.
 *
 * So this drives the real build in play mode and reads Chrome's render-capacity monitor through
 * `__ZR_AUDIO__.stats().load` — average and peak share of each quantum, and the share of quanta
 * that underran — while standing, while walking and while running, with the live voice count
 * beside it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const outFile = path.resolve(args.out || '/tmp/load.json');
const DT = 1 / 60;
const log = (...m) => console.error('[load]', ...m);

const LEGS = [
  { name: 'standing still', seconds: 10, key: null },
  { name: 'walking the plaza', seconds: 10, key: 'KeyW' },
  { name: 'running the plaza', seconds: 10, key: 'KeyW', shift: true },
  { name: 'standing still again', seconds: 10, key: null },
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
const results = { legs: [], pageErrors: [] };
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Count the audio graph's main-thread work from outside the source: every node the system
    // builds, and the wall time spent building them. Node churn is what running adds, and the main
    // thread is shared with the frame — this is browser-independent, unlike renderCapacity.
    const tally = { nodes: 0, ms: 0, byKind: {} };
    window.__ZR_NODE_TALLY__ = tally;
    for (const Ctor of [window.AudioContext, window.OfflineAudioContext]) {
      if (!Ctor) continue;
      for (const m of ['createGain', 'createBiquadFilter', 'createOscillator', 'createStereoPanner', 'createBufferSource', 'createConvolver', 'createDelay']) {
        const orig = Ctor.prototype[m];
        if (!orig) continue;
        Ctor.prototype[m] = function patched(...a) {
          const t0 = performance.now();
          const n = orig.apply(this, a);
          tally.ms += performance.now() - t0;
          tally.nodes++;
          tally.byKind[m] = (tally.byKind[m] ?? 0) + 1;
          return n;
        };
      }
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') results.pageErrors.push(m.text());
    if (m.text().startsWith('[audio]')) log(m.text());
  });
  page.on('pageerror', (e) => results.pageErrors.push(String(e.message)));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  log('world ready');
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1500));
  const start = await page.evaluate(() => window.__ZR_AUDIO__.stats());
  results.nodesAtStart = await page.evaluate(() => ({ ...window.__ZR_NODE_TALLY__ }));
  log(`graph built with ${results.nodesAtStart.nodes} nodes: ${JSON.stringify(results.nodesAtStart.byKind)}`);
  log(`audio ${start.state}, render-capacity ${start.load ? 'reported' : 'NOT REPORTED by this browser'}`);
  results.renderCapacity = !!start.load;

  for (const leg of LEGS) {
    await page.evaluate(() => window.__ZR_PLAY__.place(0, 6, Math.PI));
    await new Promise((r) => setTimeout(r, 500));
    if (leg.shift) await page.keyboard.down('ShiftLeft');
    if (leg.key) await page.keyboard.down(leg.key);
    const samples = await page.evaluate(
      async (n, dt) => {
        const rows = [];
        for (let i = 0; i < n; i++) {
          window.__ZR_PLAY__.step(1, dt, false);
          const s = window.__ZR_AUDIO__.stats();
          const t = window.__ZR_NODE_TALLY__;
          rows.push([s.load ? s.load.average : -1, s.load ? s.load.peak : -1, s.load ? s.load.underrun : -1, s.voices, s.steps, t.nodes, t.ms]);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return rows;
      },
      Math.round(leg.seconds / DT),
      DT,
    );
    if (leg.key) await page.keyboard.up(leg.key);
    if (leg.shift) await page.keyboard.up('ShiftLeft');
    const col = (i) => samples.map((r) => r[i]).filter((v) => v >= 0);
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    const row = {
      leg: leg.name,
      seconds: leg.seconds,
      avgLoad: Number(mean(col(0)).toFixed(4)),
      peakLoad: Number(Math.max(...col(1)).toFixed(4)),
      underrunMean: Number(mean(col(2)).toFixed(5)),
      underrunMax: Number(Math.max(...col(2)).toFixed(5)),
      voicesMean: Number(mean(col(3)).toFixed(1)),
      voicesMax: Math.max(...col(3)),
      steps: samples[samples.length - 1][4] - samples[0][4],
      nodesPerSecond: Number(((samples[samples.length - 1][5] - samples[0][5]) / leg.seconds).toFixed(1)),
      nodeBuildMsPerSecond: Number(((samples[samples.length - 1][6] - samples[0][6]) / leg.seconds).toFixed(2)),
    };
    results.legs.push(row);
    log(`${leg.name}: ${row.nodesPerSecond} nodes/s built (${row.nodeBuildMsPerSecond} ms/s of main thread), voices ${row.voicesMean} (max ${row.voicesMax}), ${row.steps} steps` + (results.renderCapacity ? `, load avg ${(row.avgLoad * 100).toFixed(1)} % peak ${(row.peakLoad * 100).toFixed(1)} %, underrun ${(row.underrunMean * 100).toFixed(2)} %` : ''));
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
log(`wrote ${outFile}`);
if (results.pageErrors.length) log('page errors:', results.pageErrors.slice(0, 5));
