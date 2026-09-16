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
 *        [--width 1280 --height 720] [--settle 8] [--time 12.5] [--timed 5] [--ab 5] [--isolate] [--json out.json]
 *
 * --timed K : after the settle frames, step K more frames each followed by a GPU sync and report the
 *             per-frame wall ms (median / min / max) — the frame's GPU (or SwiftShader) cost for this
 *             exact view, the matched-ablation number when a walk is too slow to trace
 * --ab K    : after that, K interleaved on/off pairs per live switch (the shadow-caster cull, each
 *             composer stage, all four, the vegetation LOD scale at 0.5) on the SAME page — both arms see the same
 *             box load, so the delta survives the contention noise of one-config-per-page timing
 * --isolate : also render each top-level system alone (`__ZR__.isolate`) for its share of the draws
 *             and triangles (no post chain: the colour pass with the lighting group only)
 *
 * `measureView` is exported for ablate.mjs (one browser, many flag sets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../scripts/lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SYSTEMS = ['terrain', 'hardscape', 'rocks', 'trees', 'structures', 'vegetation', 'props', 'character', 'atmosphere'];

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

/**
 * Load the world in a new page with `params`, render `viewpoint` at `simTime` (+ `settle` frames) and
 * measure it. Returns the report (and writes the PNG when `out` is given). The page is closed.
 */
/** the live switches `--ab` toggles: the shadow-caster cull, the four composer stages, all four, the vegetation LOD scale at 0.5 */
const AB_STAGES = ['cull', 'ao', 'rays', 'bloom', 'soft', 'all', 'veg0.5'];

export async function measureView(browser, baseUrl, { params = '', viewpoint = 'A_stairs', width = 1280, height = 720, settle = 8, simTime = 12.5, timed = 0, abPairs = 0, isolate = false, out = null, init = null, log = console.error } = {}) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // `init`: a script evaluated in the page before any of its own runs (the composer's tuning
    // globals, e.g. `globalThis.__ATMO_SETTINGS__ = { shadowCasterCull: false }`)
    if (init) await page.evaluateOnNewDocument(init);
    page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') log(`[page:${m.type()}] ${m.text()}`);
    });
    // the same URL capture.mjs opens (lib/browser.mjs openWorld), plus the flags
    const url = `${baseUrl}/?capture=1&dev=0&quality=high${params ? `&${params}` : ''}`;
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
        postfx: postfx
          ? {
              resolution: postfx.resolution,
              stagesEnabled: postfx.stagesEnabled,
              aoResolution: postfx.aoResolution,
              godRayResolution: postfx.godRayResolution,
              softeningGrid: postfx.softeningGrid,
              shadowCasterCull: postfx.shadowCasterCull,
              shadowCastersTested: postfx.shadowCastersTested,
              shadowCastersCulled: postfx.shadowCastersCulled,
            }
          : null,
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

    // --timed: K finished frames of this exact view (the GPU-side proxy on SwiftShader, GPU time
    // natively). Chromium's WebGL `finish()` is only a flush, so the completion sync is a one-pixel
    // readPixels of the canvas: it cannot return before the GPU process has drawn the frame.
    let timing = null;
    let hooksReady = false;
    if (timed > 0) {
      if (!(await grabHooks(page))) throw new Error('could not find the capture hooks');
      hooksReady = true;
      const ms = [];
      for (let k = 0; k < timed; k++) {
        const t = await page.evaluate(() => {
          const H = window.__H;
          const gl = H.renderer.getContext();
          const px = new Uint8Array(4);
          // drain whatever is still in flight from the previous frame first
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const t0 = performance.now();
          H.step(1 / 60);
          const t1 = performance.now();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
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

    // --ab K: interleaved on/off pairs of the live switches on this same page — the composer reads
    // `__KF_PERF__.fx` and the vegetation `__KF_PERF__.vegLodScale` every frame, so an arm's frame
    // is timed under the same box load as its partner's and the delta survives the contention that
    // swamps a one-config-per-page comparison. Restores the switches afterwards.
    let ab = null;
    if (abPairs > 0) {
      if (!hooksReady) {
        if (!(await grabHooks(page))) throw new Error('could not find the capture hooks');
        hooksReady = true;
      }
      ab = {};
      for (const stage of AB_STAGES) {
        const r = await page.evaluate(
          ({ stage, pairs }) => {
            const H = window.__H;
            const gl = H.renderer.getContext();
            const px = new Uint8Array(4);
            const P = globalThis.__KF_PERF__;
            const saved = { fx: { ...P.fx }, veg: P.vegLodScale, atmo: globalThis.__ATMO_SETTINGS__ ?? null };
            const set = (off) => {
              if (stage === 'cull') globalThis.__ATMO_SETTINGS__ = off ? { ...(saved.atmo ?? {}), shadowCasterCull: false } : saved.atmo;
              else if (stage === 'veg0.5') P.vegLodScale = off ? 0.5 : saved.veg;
              else if (stage === 'all') P.fx.ao = P.fx.rays = P.fx.bloom = P.fx.soft = !off;
              else P.fx[stage] = !off;
            };
            const frame = () => {
              gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
              const t0 = performance.now();
              H.step(1 / 60);
              gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
              return performance.now() - t0;
            };
            const on = [];
            const off = [];
            let offCalls = 0;
            let offTris = 0;
            for (let k = 0; k < pairs; k++) {
              // alternate the order so a drifting load does not favour one arm
              const offFirst = k % 2 === 1;
              set(offFirst);
              // the first frame after a switch pays any one-off (a re-bucket, a first-use compile): step it untimed
              if (stage === 'veg0.5') H.step(1 / 60);
              const a = frame();
              set(!offFirst);
              if (stage === 'veg0.5') H.step(1 / 60);
              const b = frame();
              (offFirst ? off : on).push(a);
              (offFirst ? on : off).push(b);
              if (!offFirst) {
                offCalls = H.renderer.info.render.calls;
                offTris = H.renderer.info.render.triangles;
              }
            }
            P.fx.ao = saved.fx.ao;
            P.fx.rays = saved.fx.rays;
            P.fx.bloom = saved.fx.bloom;
            P.fx.soft = saved.fx.soft;
            P.vegLodScale = saved.veg;
            globalThis.__ATMO_SETTINGS__ = saved.atmo;
            if (stage === 'veg0.5') H.step(1 / 60);
            const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
            const pairDeltas = on.map((v, i) => off[i] - v);
            return { pairs, onMedianMs: +med(on).toFixed(1), offMedianMs: +med(off).toFixed(1), pairDeltaMedianMs: +med(pairDeltas).toFixed(1), on: on.map((v) => +v.toFixed(0)), off: off.map((v) => +v.toFixed(0)), offDrawCalls: offCalls, offTriangles: offTris };
          },
          { stage, pairs: abPairs },
        );
        r.deltaPct = r.onMedianMs > 0 ? +(((r.offMedianMs - r.onMedianMs) / r.onMedianMs) * 100).toFixed(1) : null;
        ab[stage] = r;
        log(`  A/B ${stage.padEnd(6)}: on ${r.onMedianMs.toFixed(0)} ms, off ${r.offMedianMs.toFixed(0)} ms → ${r.deltaPct}% (pair-wise median ${r.pairDeltaMedianMs.toFixed(0)} ms; off = ${r.offDrawCalls} draws, ${r.offTriangles} tris)`);
      }
    }
    return { viewpoint, params, width, height, settle, simTime, readyMs, renderMs, timing, ab, png, ...report };
  } finally {
    await page.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
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
  const opts = {
    viewpoint: args.viewpoint ?? 'A_stairs',
    params: typeof args.params === 'string' ? args.params.replace(/^[?&]+/, '') : '',
    width: Number(args.width ?? 1280),
    height: Number(args.height ?? 720),
    settle: Number(args.settle ?? 8),
    simTime: Number(args.time ?? 12.5),
    timed: Number(args.timed ?? 0),
    abPairs: Number(args.ab ?? 0),
    isolate: !!args.isolate,
    out: args.out ? path.resolve(args.out) : null,
  };
  const jsonOut = args.json ? path.resolve(args.json) : null;
  (async () => {
    const server = await serveStatic(dist);
    const browser = await launchBrowser({ width: opts.width, height: opts.height });
    try {
      const result = { dist, ...(await measureView(browser, server.url, opts)) };
      if (jsonOut) {
        fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
        fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
      }
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await browser.close();
      await server.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
