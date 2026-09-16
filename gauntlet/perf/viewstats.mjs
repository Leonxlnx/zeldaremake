#!/usr/bin/env node
/**
 * viewstats.mjs — one fixed viewpoint under a set of performance flags (round 38, perf-2).
 *
 * Opens the production build the way capture.mjs does (`?capture=1&dev=0&quality=high`, plus the
 * flags given), moves the camera to a viewpoint, sets the capture's simulation time and renders the
 * settle frames, then reports what the renderer was handed for that frame — draw calls, triangles,
 * drawing-buffer size, the page's parsed flags / live state, the lighting and composer audits' cost
 * fields — and writes the canvas as a PNG so two flag sets can be diffed (`cmp`) or scored.
 *
 *   node gauntlet/perf/viewstats.mjs --dist dist --viewpoint A_stairs --params "fx=noao" --out /tmp/a.png
 *        [--width 1280 --height 720] [--settle 8] [--time 12.5] [--timed 5] [--isolate] [--json out.json]
 *
 * --timed K : after the settle frames, step K more frames each followed by gl.finish() and report the
 *             per-frame wall ms (median / min / max) — the frame's GPU (or SwiftShader) cost for this
 *             exact view, the matched-ablation number when a walk is too slow to trace
 * --isolate : also render each top-level system alone (`__ZR__.isolate`) for its share of the draws
 *             and triangles (no post chain: the colour pass with the lighting group only)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../scripts/lib/browser.mjs';

/** find the capture hooks (step, renderer) through the closure scopes of __ZR__.render (as perftrace.mjs does) */
async function grabHooks(page) {
  const client = await page.createCDPSession();
  const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
  const objectId = ev.result?.objectId;
  if (!objectId) throw new Error('no __ZR__.render object');
  const { internalProperties } = await client.send('Runtime.getProperties', { objectId, ownProperties: true });
  const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]');
  if (!scopes) throw new Error('no [[Scopes]] on __ZR__.render');
  const { result: scopeList } = await client.send('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true });
  for (const s of scopeList) {
    if (!s.value?.objectId) continue;
    const { result: vars } = await client.send('Runtime.getProperties', { objectId: s.value.objectId, ownProperties: true });
    for (const v of vars) {
      if (v.value?.type !== 'object' || !v.value.objectId) continue;
      const r = await client.send('Runtime.callFunctionOn', {
        objectId: v.value.objectId,
        functionDeclaration: 'function(){ if (this && this.scene && this.scene.isScene && typeof this.step === "function") { window.__H = this; return true; } return false; }',
        returnByValue: true,
      });
      if (r.result?.value === true) {
        await client.detach();
        return true;
      }
    }
  }
  await client.detach();
  return false;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else {
    args[a.slice(2)] = n;
    i++;
  }
}
const dist = path.resolve(ROOT, args.dist ?? 'dist');
const viewpoint = args.viewpoint ?? 'A_stairs';
const params = typeof args.params === 'string' ? args.params.replace(/^[?&]+/, '') : '';
const width = Number(args.width ?? 1280);
const height = Number(args.height ?? 720);
const settle = Number(args.settle ?? 8);
const simTime = Number(args.time ?? 12.5);
const out = args.out ? path.resolve(args.out) : null;
const jsonOut = args.json ? path.resolve(args.json) : null;
const isolate = !!args.isolate;
const timed = Number(args.timed ?? 0);
const log = (...a) => console.error(...a);

const SYSTEMS = ['terrain', 'hardscape', 'rocks', 'trees', 'structures', 'vegetation', 'props', 'character', 'atmosphere'];

async function main() {
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  try {
    // the same URL capture.mjs opens (lib/browser.mjs openWorld), plus the flags
    const base = server.url;
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') log(`[page:${m.type()}] ${m.text()}`);
    });
    const url = `${base}/?capture=1&dev=0&quality=high${params ? `&${params}` : ''}`;
    log(`url: ${url}`);
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 900_000 });
    await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
    await page.evaluate(() => {
      window.__zrReadyState = 'pending';
      Promise.resolve(window.__ZR__.ready()).then(
        () => (window.__zrReadyState = 'ready'),
        (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`),
      );
    });
    await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 500 });
    const state = await page.evaluate(() => window.__zrReadyState);
    if (state !== 'ready') throw new Error(`__ZR__.ready() rejected: ${state}`);
    const readyMs = Date.now() - t0;
    log(`world: ready in ${(readyMs / 1000).toFixed(1)} s`);

    const ok = await page.evaluate((id) => window.__ZR__.setViewpoint(id), viewpoint);
    if (!ok) throw new Error(`viewpoint ${viewpoint} not found`);
    await page.evaluate((t) => window.__ZR__.setTime(t), simTime);
    const tr = Date.now();
    for (let left = settle; left > 0; left -= 15) await page.evaluate((k) => window.__ZR__.render(k, 1 / 60), Math.min(15, left));
    const renderMs = Date.now() - tr;

    // the capture's frame (simTime + settle/60): stats and the PNG come from it, before anything else steps
    const report = await page.evaluate(() => {
      const stats = window.__ZR__.stats();
      const perf = window.__ZR__.perf();
      const audit = window.__ZR__.audit();
      const lighting = audit.systems.lighting ?? {};
      const postfx = audit.systems.atmosphere?.postfx ?? null;
      const veg = audit.systems.vegetation?.submission ?? null;
      return {
        stats,
        flags: perf.flags ?? {},
        tier: perf.tier ?? null,
        perfState: perf.perfState ?? null,
        stepMs: { step: perf.step, update: perf.update, render: perf.render },
        lighting: { shadows: lighting.shadows, shadowMapSize: lighting.shadowMapSize, filterTaps: lighting.shadowFilterTaps, searchTaps: lighting.shadowSearchTaps, dynamic: lighting.shadowFilterDynamic },
        postfx: postfx ? { resolution: postfx.resolution, stagesEnabled: postfx.stagesEnabled, aoResolution: postfx.aoResolution, godRayResolution: postfx.godRayResolution, softeningGrid: postfx.softeningGrid } : null,
        vegetation: veg ? { drawCalls: veg.drawCalls, triangles: veg.triangles } : null,
        sceneTriangles: audit.scene.triangles,
      };
    });
    let png = null;
    if (out) {
      const canvas = await page.$('canvas');
      const buf = Buffer.from(await canvas.screenshot({ type: 'png' }));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      png = { file: out, bytes: buf.length };
    }

    // --timed: K finished frames of this exact view (the GPU-side proxy on SwiftShader, GPU time natively)
    let timing = null;
    if (timed > 0) {
      if (!(await grabHooks(page))) throw new Error('could not find the capture hooks');
      const ms = [];
      for (let k = 0; k < timed; k++) {
        const t = await page.evaluate(() => {
          const H = window.__H;
          const gl = H.renderer.getContext();
          const t0 = performance.now();
          H.step(1 / 60);
          const t1 = performance.now();
          gl.finish();
          const t2 = performance.now();
          return { step: t1 - t0, finish: t2 - t1, total: t2 - t0 };
        });
        ms.push(t);
        log(`  timed frame ${k + 1}/${timed}: ${t.total.toFixed(0)} ms (issue ${t.step.toFixed(1)}, finish ${t.finish.toFixed(0)})`);
      }
      const sorted = ms.map((m) => m.total).sort((a, b) => a - b);
      timing = { frames: timed, medianMs: +sorted[sorted.length >> 1].toFixed(1), minMs: +sorted[0].toFixed(1), maxMs: +sorted[sorted.length - 1].toFixed(1), issueMedianMs: +ms.map((m) => m.step).sort((a, b) => a - b)[ms.length >> 1].toFixed(1), perFrame: ms.map((m) => +m.total.toFixed(1)) };
    }

    if (isolate) {
      // each top-level system alone (colour pass only, lighting kept): its share of draws / triangles
      report.isolate = {};
      for (const s of SYSTEMS) report.isolate[s] = await page.evaluate((name) => window.__ZR__.isolate(name), s);
    }
    const result = { dist, viewpoint, params, width, height, settle, simTime, readyMs, renderMs, timing, png, ...report };
    if (jsonOut) {
      fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
      fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
