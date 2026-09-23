#!/usr/bin/env node
/**
 * playtest.mjs — drive the walkable build like a player and record what happened.
 *
 *   node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play [--size 960x540] [--quality high]
 *        [--only look,pad,stairs,climb,walk,perf] [--shots] [--video] [--spots plaza,stairs2-base]
 *
 * Opens the build with `?test=1` (play mode; the page runs no frame loop of its own) and steps
 * frames at a fixed dt through `window.__ZR_PLAY__`, feeding REAL input: held keys
 * (keyboard.down/up), mouse drags on the canvas (pointer events) and an emulated gamepad
 * (navigator.getGamepads override). Simulation frames are stepped without drawing; a frame is drawn
 * only where something is measured on it (the depth-buffer clearance, a screenshot, a timing).
 *
 * Writes playtest.json: per look spot the camera's elevation at rest / after dragging up / after
 * dragging down (and the view's upper edge above the horizon), the near-geometry clearance read
 * from the frame's own depth buffer, whether Link stays visible; the stair collision against the
 * rendered stones; the climb traces (stalls, final height); the walk routes (stuck points); the
 * frame cost. --shots saves JPEGs at the checkpoints; --video saves every drawn frame of the
 * movement clips (climb, look sweep) for ffmpeg.
 *
 * `navigator.webdriver` is masked before the page loads: the game treats a webdriver page as a
 * headless capture (capture/api.ts isHeadlessCapture), which never enters play mode.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/playtest');
const [width, height] = String(args.size || '960x540').split('x').map(Number);
const quality = typeof args.quality === 'string' ? args.quality : 'high';
const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
const spotFilter = typeof args.spots === 'string' ? new Set(args.spots.split(',')) : null;
const shots = !!args.shots;
const video = !!args.video;
const DT = 1 / 30;
fs.mkdirSync(out, { recursive: true });
const log = (...m) => console.error(`[playtest ${new Date().toISOString().slice(11, 19)}]`, ...m);
const want = (s) => !only || only.has(s);

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

/** layout flights (src/world/layout.ts): base (x, y, z), dir (xz), steps, rise, tread, width */
const FLIGHTS = {
  main: { base: [7.3, 0, -0.1], dir: [1, -0.78], steps: 20, rise: 0.27, tread: 0.54, width: 3.0 },
  'south-bank': { base: [-15.22, 0.39, 15.44], dir: [-0.7071, 0.7071], steps: 6, rise: 0.26, tread: 0.38, width: 1.6 },
};
const flightFrame = (f) => {
  const l = Math.hypot(f.dir[0], f.dir[1]);
  const dx = f.dir[0] / l;
  const dz = f.dir[1] / l;
  const at = (u, v = 0) => [f.base[0] + dx * u - dz * v, f.base[2] + dz * u + dx * v];
  return { dx, dz, run: f.steps * f.tread, yawUp: Math.atan2(dx, dz), at };
};

/** where Link stands for the look tests (x, z, facing yaw in degrees; forward = (sin, cos)) */
function lookSpots() {
  const m = flightFrame(FLIGHTS.main);
  const s = flightFrame(FLIGHTS['south-bank']);
  const spots = [
    { id: 'plaza', at: [0.5, 1.0], yaw: 180, note: 'open plaza facing the village' },
    { id: 'stairs2-base', at: m.at(-1.6), yaw: deg(m.yawUp), note: 'second staircase (main flight), foot, facing up' },
    { id: 'stairs2-mid', at: m.at(m.run * 0.5), yaw: deg(m.yawUp), note: 'second staircase, halfway' },
    { id: 'stairs2-top', at: m.at(m.run + 0.8), yaw: deg(m.yawUp) + 180, note: 'second staircase, top, facing down' },
    { id: 'stairs1-base', at: s.at(-1.4), yaw: deg(s.yawUp), note: 'first staircase (south bank), foot, facing up' },
    { id: 'stairs1-top', at: s.at(s.run + 0.7), yaw: deg(s.yawUp) + 180, note: 'first staircase, top, facing down' },
    { id: 'saria-side', at: [8.2, -6.8], yaw: deg(Math.atan2(4.3, -4.7)), note: "beside Saria's house" },
    // on the plateau east of the upper house, clear of its pad and of Saria's (whose cap reaches the plateau)
    { id: 'upper-house', at: [17.0, -15.0], yaw: deg(Math.atan2(-3.5, -2.5)), note: 'the upper house, from the plateau' },
    { id: 'west-house', at: [-16.3, 6.5], yaw: deg(Math.atan2(-6.7, 2.5)), note: 'the west house deck' },
    { id: 'open-north', at: [1.5, -40], yaw: 180, note: 'open ground north of the log arch' },
  ];
  return spotFilter ? spots.filter((p) => spotFilter.has(p.id)) : spots;
}

async function openPlay(browser, baseUrl) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const consoleLines = [];
  page.on('console', (m) => {
    const line = `[page:${m.type()}] ${m.text()}`;
    consoleLines.push(line);
    if (m.type() === 'error') log(line);
  });
  page.on('pageerror', (e) => {
    consoleLines.push(`[pageerror] ${e.message}`);
    log(`[pageerror] ${e.message}`);
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
    const pad = { connected: false, axes: [0, 0, 0, 0], buttons: [] };
    window.__PAD__ = pad;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () =>
        pad.connected
          ? [{ id: 'playtest pad (standard)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: pad.axes.slice(), buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!pad.buttons[i], touched: !!pad.buttons[i], value: pad.buttons[i] ? 1 : 0 })) }, null, null, null]
          : [null, null, null, null],
    });
  });
  const url = `${baseUrl}/?test=1&dev=0&hud=${args.hud ? 1 : 0}&warmup=0&quality=${encodeURIComponent(quality)}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await waitReady(page);
  log(`world ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (${url})`);
  return { page, consoleLines };
}

async function waitReady(page) {
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS, polling: 250 });
  await page.evaluate(() => {
    window.__zrReadyState = 'pending';
    Promise.resolve(window.__ZR__.ready()).then(
      () => (window.__zrReadyState = 'ready'),
      (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`),
    );
  });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: READY_TIMEOUT_MS, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    return !loading || getComputedStyle(loading).opacity === '0';
  }, { timeout: READY_TIMEOUT_MS });
}

/** one rAF on the page so queued (rAF-aligned) pointer events reach the listeners */
const flushInput = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
const sim = (page, n) => page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, false), [n, DT]);
/**
 * Draw one frame; returns its wall time (ms). WebGL returns before the frame is drawn, so the time
 * is taken after a one-pixel readback of the canvas (the synchronous round trip) — what this
 * machine's renderer actually spent.
 */
const draw = async (page) =>
  page.evaluate((dt) => {
    const t0 = performance.now();
    window.__ZR_PLAY__.step(1, dt, true);
    const gl = document.querySelector('canvas').getContext('webgl2');
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return performance.now() - t0;
  }, DT);
const state = (page) => page.evaluate(() => window.__ZR_PLAY__.state());
const elevationOf = (st) => deg(Math.asin(Math.max(-1, Math.min(1, st.camera.direction[1]))));
const summarise = (st) => {
  const el = elevationOf(st);
  const c = st.camera.position;
  return {
    elevationDeg: +el.toFixed(2),
    topEdgeDeg: +(el + st.camera.fov / 2).toFixed(2),
    bottomEdgeDeg: +(el - st.camera.fov / 2).toFixed(2),
    camera: c.map((v) => +v.toFixed(3)),
    cameraAboveGround: +(c[1] - st.groundUnderCamera).toFixed(3),
    link: st.link?.map((v) => +v.toFixed(3)) ?? null,
    cameraToLink: st.link ? +Math.hypot(c[0] - st.link[0], c[1] - (st.link[1] + 1.2), c[2] - st.link[2]).toFixed(3) : null,
    follow: st.follow,
  };
};

/**
 * Near-geometry clearance of the last drawn frame (its own depth buffer, Euclidean metres): the
 * nearest surface, the share of the view closer than 0.35 m (the camera in or against geometry),
 * the sky share, and whether Link's chest is hidden behind something nearer than him.
 */
const clearance = (page) =>
  page.evaluate(() => {
    const W = 160;
    const H = 90;
    const img = window.__ZR__.depthImage(null, W, H);
    const d = img.data;
    let min = Infinity;
    let near = 0;
    let sky = 0;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      // the sky dome writes a finite depth: sky / open air = nothing nearer than 150 m
      if (v < 0 || v > 150) {
        sky++;
        continue;
      }
      if (v < min) min = v;
      if (v < 0.35) near++;
    }
    const st = window.__ZR_PLAY__.state();
    let linkHidden = null;
    if (st.link) {
      const chest = [st.link[0], st.link[1] + 1.0, st.link[2]];
      const [p] = window.__ZR__.project([chest]);
      if (p && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1) {
        const x = Math.min(W - 1, Math.floor(p[0] * W));
        const y = Math.min(H - 1, Math.floor((1 - p[1]) * H));
        const c = st.camera.position;
        const dist = Math.hypot(chest[0] - c[0], chest[1] - c[1], chest[2] - c[2]);
        // the depth image rows run bottom-up (GL readback)
        const v = d[(H - 1 - y) * W + x];
        linkHidden = v >= 0 && v < dist - 0.45;
      } else linkHidden = 'off-screen';
    }
    return { nearestM: min === Infinity ? null : +min.toFixed(3), nearShare: +(near / d.length).toFixed(4), skyShare: +(sky / d.length).toFixed(4), linkHidden };
  });

async function shot(page, name) {
  if (!shots) return null;
  const file = path.join(out, `${name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  return path.basename(file);
}

/** drag on the canvas: `dy` pixels in `steps` moves (positive = downward), `framesPer` sim frames after each move */
async function drag(page, dx, dy, steps = 12, framesPer = 2, onStep = null) {
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) {
    await page.mouse.move(cx + Math.round((dx * k) / steps), cy + Math.round((dy * k) / steps));
    await flushInput(page);
    if (onStep) await onStep(k);
    else await sim(page, framesPer);
  }
  await page.mouse.up();
  await flushInput(page);
}

async function lookScenario(page, results) {
  const spots = lookSpots();
  results.look = [];
  for (const spot of spots) {
    log(`look: ${spot.id}`);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [spot.at[0], spot.at[1], rad(spot.yaw)]);
    await sim(page, 45);
    const rest = summarise(await state(page));
    await draw(page);
    const restClear = await clearance(page);
    const restShot = await shot(page, `look-${spot.id}-rest`);
    // drag up (the mouse moves toward the top of the screen) far enough to hit any limit
    await drag(page, 0, -Math.round(height * 0.9), 15, 2);
    await sim(page, 30);
    const up = summarise(await state(page));
    await draw(page);
    const upClear = await clearance(page);
    const upShot = await shot(page, `look-${spot.id}-drag-up`);
    // drag down twice as far (through rest to the other limit)
    await drag(page, 0, Math.round(height * 1.8), 30, 2);
    await sim(page, 30);
    const down = summarise(await state(page));
    await draw(page);
    const downClear = await clearance(page);
    const downShot = await shot(page, `look-${spot.id}-drag-down`);
    const els = [rest.elevationDeg, up.elevationDeg, down.elevationDeg];
    results.look.push({
      ...spot,
      at: spot.at.map((v) => +v.toFixed(3)),
      rest: { ...rest, clearance: restClear, shot: restShot },
      dragUp: { ...up, clearance: upClear, shot: upShot },
      dragDown: { ...down, clearance: downClear, shot: downShot },
      maxUpDeg: Math.max(...els),
      maxDownDeg: Math.min(...els),
      maxVisibleAboveHorizonDeg: +Math.max(rest.topEdgeDeg, up.topEdgeDeg, down.topEdgeDeg).toFixed(2),
    });
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
}

/** the right stick pushed up then down (emulated standard-mapping pad), elevation sampled every 5 frames */
async function padScenario(page, results) {
  log('pad: right stick');
  const spot = lookSpots().find((s) => s.id === 'plaza') ?? { at: [0.5, 1.0], yaw: 180 };
  await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [spot.at[0], spot.at[1], rad(spot.yaw)]);
  await sim(page, 30);
  const trace = [];
  const setPad = (axes) => page.evaluate((axes) => Object.assign(window.__PAD__, { connected: true, axes }), axes);
  const run = async (label, axes, frames) => {
    await setPad(axes);
    for (let f = 0; f < frames; f += 5) {
      await sim(page, 5);
      const s = summarise(await state(page));
      trace.push({ label, frame: f + 5, elevationDeg: s.elevationDeg, cameraAboveGround: s.cameraAboveGround });
    }
  };
  await run('stick-up', [0, 0, 0, -1], 60);
  await run('release', [0, 0, 0, 0], 20);
  await run('stick-down', [0, 0, 0, 1], 90);
  await run('release', [0, 0, 0, 0], 20);
  await page.evaluate(() => Object.assign(window.__PAD__, { connected: false, axes: [0, 0, 0, 0] }));
  const els = trace.map((t) => t.elevationDeg);
  results.pad = { trace, maxUpDeg: Math.max(...els), maxDownDeg: Math.min(...els) };
  fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
}

/** collision (the walk height Link stands at) against the rendered stones/logs, along and across each flight */
async function stairsScenario(page, results) {
  log('stairs: collision vs rendered surface');
  results.stairs = {};
  for (const [id, f] of Object.entries(FLIGHTS)) {
    const fr = flightFrame(f);
    const r = await page.evaluate(
      ([f, fr, id]) => {
        const P = window.__ZR_PLAY__;
        const hw = f.width / 2;
        // the tread's walking span (0.1 m behind the riser line to 0.12 m short of the next one) and
        // the nose zone round each riser line, measured apart: in the nose zone the next step's slab
        // nose and timber overhang the analytic riser line the root climbs at by up to ≈ 0.1 m (the
        // feet plant on the rendered surface there — character/ground.ts `surface`)
        const zone = () => ({ n: 0, over3: 0, under5: 0, maxAbove: 0, maxBelow: 0, worst: [] });
        const span = zone();
        const nose = zone();
        const rows = [];
        for (const vf of [-0.8, -0.4, 0, 0.4, 0.8]) {
          const v = vf * hw;
          for (let u = 0.01; u < fr.run - 0.01; u += 0.01) {
            const k = u / f.tread;
            const into = (k - Math.floor(k)) * f.tread;
            const z0 = into < 0.1 || into > f.tread - 0.12 ? nose : span;
            const x = f.base[0] + fr.dx * u - fr.dz * v;
            const z = f.base[2] + fr.dz * u + fr.dx * v;
            const g = P.ground(x, z);
            const d = g.surface - g.walk;
            z0.n++;
            if (d > 0.03) z0.over3++;
            if (d < -0.05) z0.under5++;
            z0.maxAbove = Math.max(z0.maxAbove, d);
            z0.maxBelow = Math.min(z0.maxBelow, d);
            if (Math.abs(d) > 0.03) {
              z0.worst.push({ u: +u.toFixed(2), v: +v.toFixed(2), d: +d.toFixed(3) });
              z0.worst.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
              z0.worst.length = Math.min(z0.worst.length, 6);
            }
            if (vf === 0 && Math.abs(into - f.tread * 0.6) < 0.006) rows.push({ u: +u.toFixed(2), walk: +g.walk.toFixed(3), surface: +g.surface.toFixed(3) });
          }
        }
        const out = (z0) => ({ samples: z0.n, shareStoneOver3cmAbove: +(z0.over3 / Math.max(1, z0.n)).toFixed(4), shareStoneOver5cmBelow: +(z0.under5 / Math.max(1, z0.n)).toFixed(4), maxStoneAboveWalkM: +z0.maxAbove.toFixed(3), maxStoneBelowWalkM: +z0.maxBelow.toFixed(3), worst: z0.worst });
        return { id, treadSpan: out(span), noseZone: out(nose), centreline: rows };
      },
      [f, { dx: fr.dx, dz: fr.dz, run: fr.run }, id],
    );
    results.stairs[id] = r;
  }
  fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
}

/** hold keys for `frames` sim frames, tracing Link each frame; `every` > 0 also draws (and saves) every n-th frame */
async function hold(page, keys, frames, { every = 0, prefix = null } = {}) {
  for (const k of keys) await page.keyboard.down(k);
  const trace = [];
  let saved = 0;
  try {
    for (let f = 0; f < frames; f += 5) {
      const n = Math.min(5, frames - f);
      const chunk = await page.evaluate(
        ([n, dt]) => {
          const P = window.__ZR_PLAY__;
          const rows = [];
          for (let i = 0; i < n; i++) {
            P.step(1, dt, false);
            const s = P.state();
            rows.push({ link: s.link, heading: s.heading, cam: s.camera.position, dir: s.camera.direction, camGround: s.groundUnderCamera });
          }
          return rows;
        },
        [n, DT],
      );
      trace.push(...chunk);
      if (every > 0 && prefix && (f / 5) % Math.max(1, Math.round(every / 5)) === 0) {
        await draw(page);
        await page.screenshot({ path: path.join(out, `${prefix}-${String(saved++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
      }
    }
  } finally {
    for (const k of keys) await page.keyboard.up(k);
  }
  return trace;
}

function analyseTrace(trace, topY) {
  let stalls = 0;
  let maxRise = 0;
  let maxDrop = 0;
  let maxCamDrop = Infinity;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1].link;
    const b = trace[i].link;
    const moved = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (i > 10 && moved < 0.002) stalls++;
    maxRise = Math.max(maxRise, b[1] - a[1]);
    maxDrop = Math.min(maxDrop, b[1] - a[1]);
    maxCamDrop = Math.min(maxCamDrop, trace[i].cam[1] - trace[i].camGround);
  }
  const last = trace[trace.length - 1].link;
  return {
    frames: trace.length,
    stalledFrames: stalls,
    maxRisePerFrameM: +maxRise.toFixed(3),
    maxDropPerFrameM: +maxDrop.toFixed(3),
    minCameraAboveGroundM: +maxCamDrop.toFixed(3),
    end: last.map((v) => +v.toFixed(3)),
    reachedTop: topY === undefined ? null : Math.abs(last[1] - topY) < 0.1,
  };
}

async function climbScenario(page, results) {
  results.climb = {};
  for (const [id, f] of Object.entries(FLIGHTS)) {
    const fr = flightFrame(f);
    const topY = f.base[1] + f.steps * f.rise;
    log(`climb: ${id} up`);
    const start = fr.at(-1.6);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [start[0], start[1], fr.yawUp]);
    await sim(page, 20);
    const upFrames = Math.ceil(((fr.run + 1.6 + 1.2) / 1.6) * 30);
    const up = await hold(page, ['KeyW'], upFrames, video ? { every: 2, prefix: `climb-${id}-up` } : {});
    const upA = analyseTrace(up, topY);
    const midShot = shots ? await (async () => { await draw(page); return shot(page, `climb-${id}-top`); })() : null;
    log(`climb: ${id} down`);
    const top = fr.at(fr.run + 1.0);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [top[0], top[1], fr.yawUp + Math.PI]);
    await sim(page, 20);
    const down = await hold(page, ['KeyW'], upFrames, video ? { every: 2, prefix: `climb-${id}-down` } : {});
    const downA = analyseTrace(down);
    const endY = down[down.length - 1].link[1];
    results.climb[id] = { topY, up: upA, down: { ...downA, reachedBottom: endY <= f.base[1] + f.rise * 0.5 }, shot: midShot, trace: up.filter((_, i) => i % 3 === 0).map((r) => ({ link: r.link.map((v) => +v.toFixed(3)) })) };
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
}

/** steer Link through waypoints with the movement keys (camera-relative, as a player would) */
async function walkRoute(page, name, points, maxFrames = 900) {
  const keysDown = new Set();
  const setKeys = async (want) => {
    for (const k of [...keysDown]) if (!want.has(k)) (await page.keyboard.up(k), keysDown.delete(k));
    for (const k of want) if (!keysDown.has(k)) (await page.keyboard.down(k), keysDown.add(k));
  };
  const first = points[0];
  const second = points[1];
  await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [first[0], first[1], Math.atan2(second[0] - first[0], second[1] - first[1])]);
  await sim(page, 15);
  let wp = 1;
  let frames = 0;
  let stuck = [];
  let lastProgressAt = 0;
  let best = Infinity;
  const trace = [];
  while (wp < points.length && frames < maxFrames) {
    const st = await state(page);
    const [x, , z] = st.link;
    const [tx, tz] = points[wp];
    const dist = Math.hypot(tx - x, tz - z);
    if (dist < 0.5) {
      wp++;
      best = Infinity;
      lastProgressAt = frames;
      continue;
    }
    if (dist < best - 0.05) {
      best = dist;
      lastProgressAt = frames;
    } else if (frames - lastProgressAt > 90) {
      stuck.push({ at: [+x.toFixed(2), +st.link[1].toFixed(2), +z.toFixed(2)], toward: points[wp], frame: frames });
      wp++;
      best = Infinity;
      lastProgressAt = frames;
      continue;
    }
    const d = st.camera.direction;
    const c = Math.atan2(d[0], d[2]);
    const wx = (tx - x) / dist;
    const wz = (tz - z) / dist;
    const a = wx * Math.sin(c) + wz * Math.cos(c);
    const b = wx * -Math.cos(c) + wz * Math.sin(c);
    const want = new Set();
    if (a > 0.38) want.add('KeyW');
    if (a < -0.38) want.add('KeyS');
    if (b > 0.38) want.add('KeyD');
    if (b < -0.38) want.add('KeyA');
    await setKeys(want);
    await sim(page, 3);
    frames += 3;
    trace.push([+x.toFixed(2), +st.link[1].toFixed(2), +z.toFixed(2)]);
  }
  await setKeys(new Set());
  return { name, reached: wp >= points.length, waypointsReached: wp - 1, of: points.length - 1, frames, stuck, trace: trace.filter((_, i) => i % 4 === 0) };
}

async function walkScenario(page, results) {
  const m = flightFrame(FLIGHTS.main);
  const s = flightFrame(FLIGHTS['south-bank']);
  const routes = [
    // round Saria's trunk pad (its cap reaches the plateau) to the upper house's east side
    ['plaza-to-upper-house', [[1, 3], m.at(-1.6), m.at(m.run * 0.5), m.at(m.run + 1.2), [17.6, -9.5], [17.2, -13.0], [16.6, -15.2]]],
    ['plaza-to-south-bank-top', [[-6, 8], [-11.8, 12.0], s.at(-1.4), s.at(s.run * 0.5), s.at(s.run + 1.0)]],
    // along the lawn to the door, clear of the signpost (7.0, −9.3)
    ['saria-front-arc', [[5.7, -4.5], [8.2, -6.8], [8.6, -8.2], [9.3, -9.0]]],
    ['west-deck', [[-12.5, 8.5], [-15.39 + 0.9, 7.64 - 0.4], [-16.28, 6.46], [-18.4, 7.1]]],
  ];
  results.walk = [];
  for (const [name, pts] of routes) {
    log(`walk: ${name}`);
    results.walk.push(await walkRoute(page, name, pts));
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
}

/**
 * The build's existing interactions still answer (run with --hud): Space jumps (Link's air height
 * rises and he lands), the right mouse button opens the equipment bag (the world pauses: Link does
 * not move while W is held) and Enter closes it, P hands over to the free camera and back.
 */
async function interactScenario(page, results) {
  const out_ = {};
  const spot = lookSpots().find((p) => p.id === 'plaza') ?? { at: [0.5, 1.0], yaw: 180 };
  await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [spot.at[0], spot.at[1], rad(spot.yaw)]);
  await sim(page, 20);
  log('interact: jump');
  await page.keyboard.down('Space');
  let maxAir = 0;
  for (let i = 0; i < 45; i++) {
    await sim(page, 1);
    if (i === 3) await page.keyboard.up('Space');
    maxAir = Math.max(maxAir, (await state(page)).air);
  }
  const landed = (await state(page)).air === 0;
  out_.jump = { maxAirM: +maxAir.toFixed(3), landed, ok: maxAir > 0.15 && landed };
  log('interact: bag');
  await page.mouse.click(Math.round(width / 2), Math.round(height / 2), { button: 'right' });
  await flushInput(page);
  const opened = (await state(page)).paused;
  const before = (await state(page)).link;
  await page.keyboard.down('KeyW');
  await sim(page, 20);
  await page.keyboard.up('KeyW');
  const during = (await state(page)).link;
  const frozen = Math.hypot(during[0] - before[0], during[2] - before[2]) < 1e-6;
  const bagShot = shots ? await (async () => { await page.screenshot({ path: path.join(out, 'interact-bag.jpg'), type: 'jpeg', quality: 88 }); return 'interact-bag.jpg'; })() : null;
  await page.keyboard.press('Enter');
  await flushInput(page);
  const closed = !(await state(page)).paused;
  await page.keyboard.down('KeyW');
  await sim(page, 20);
  await page.keyboard.up('KeyW');
  const after = (await state(page)).link;
  const movesAgain = Math.hypot(after[0] - during[0], after[2] - during[2]) > 0.2;
  out_.bag = { opened, worldFrozenWhileOpen: frozen, closed, walksAfterClose: movesAgain, ok: opened && frozen && closed && movesAgain, shot: bagShot };
  log('interact: free camera toggle');
  await page.keyboard.press('KeyP');
  await sim(page, 2);
  const free = !(await state(page)).playMode;
  await page.keyboard.press('KeyP');
  await sim(page, 2);
  const back = (await state(page)).playMode;
  out_.freeCamera = { toFree: free, backToPlay: back, ok: free && back };
  results.interact = out_;
  fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
}

/** resize the window mid-play (small, large) and reload the page; the world keeps drawing, no errors */
async function resilienceScenario(page, results, reopen) {
  const out_ = { steps: [] };
  for (const [w, h] of [
    [640, 360],
    [1280, 720],
    [width, height],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await flushInput(page);
    await sim(page, 3);
    const ms = await draw(page);
    const st = await state(page);
    out_.steps.push({ viewport: [w, h], canvas: st.canvas, aspect: +st.camera.aspect.toFixed(4), drawMs: Math.round(ms), ok: st.canvas[0] === w && st.canvas[1] === h && Math.abs(st.camera.aspect - w / h) < 1e-3 });
  }
  log('resilience: reload');
  const t0 = Date.now();
  const again = await reopen();
  await again.page.evaluate(() => window.__ZR_PLAY__.place(0.5, 1.0, Math.PI));
  await again.page.keyboard.down('KeyW');
  await sim(again.page, 30);
  await again.page.keyboard.up('KeyW');
  const st = await again.page.evaluate(() => window.__ZR_PLAY__.state());
  out_.reload = { seconds: Math.round((Date.now() - t0) / 1000), playMode: st.playMode, walked: st.link[2] < 0.5, errors: again.consoleLines.filter((l) => l.startsWith('[pageerror]')).length };
  out_.ok = out_.steps.every((s) => s.ok) && out_.reload.playMode && out_.reload.walked && out_.reload.errors === 0;
  results.resilience = out_;
  fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  return again;
}

/**
 * Movement clips (--video): every drawn frame saved as clip-<name>-NNNN.jpg for ffmpeg. A look sweep
 * (rest → drag up to the limit → hold → drag down past rest → recentre) beside Saria's lanterns and
 * at the plaza, and a climb up the second staircase with the follow camera.
 */
async function videoScenario(page, results) {
  results.video = [];
  const save = async (name, k) => {
    await draw(page);
    await page.screenshot({ path: path.join(out, `clip-${name}-${String(k).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
  };
  for (const id of ['saria-side', 'plaza']) {
    const spot = lookSpots().find((p) => p.id === id);
    if (!spot) continue;
    log(`video: look sweep at ${id}`);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [spot.at[0], spot.at[1], rad(spot.yaw)]);
    await sim(page, 40);
    let k = 0;
    for (let i = 0; i < 6; i++) await save(`look-${id}`, k++);
    const t0 = Date.now();
    await drag(page, 0, -Math.round(height * 0.8), 24, 1, async () => {
      await sim(page, 1);
      await save(`look-${id}`, k++);
    });
    for (let i = 0; i < 10; i++) {
      await sim(page, 1);
      await save(`look-${id}`, k++);
    }
    await drag(page, 0, Math.round(height * 1.0), 24, 1, async () => {
      await sim(page, 1);
      await save(`look-${id}`, k++);
    });
    results.video.push({ name: `look-${id}`, frames: k, seconds: Math.round((Date.now() - t0) / 1000) });
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
  const f = FLIGHTS.main;
  const fr = flightFrame(f);
  log('video: climb the second staircase');
  const start = fr.at(-2.2);
  await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [start[0], start[1], fr.yawUp]);
  await sim(page, 20);
  await page.keyboard.down('KeyW');
  let k = 0;
  try {
    for (let i = 0; i < 150; i++) {
      await sim(page, 1);
      await save('climb-main', k++);
    }
  } finally {
    await page.keyboard.up('KeyW');
  }
  results.video.push({ name: 'climb-main', frames: k });
  fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
}

/** frame cost at a few spots: JS phases from the page's own timers, draw calls/triangles, the drawn frame's wall time */
async function perfScenario(page, results) {
  results.perf = [];
  for (const id of ['plaza', 'stairs2-base', 'saria-side', 'west-house']) {
    const spot = lookSpots().find((p) => p.id === id);
    if (!spot) continue;
    log(`perf: ${id}`);
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [spot.at[0], spot.at[1], rad(spot.yaw)]);
    await sim(page, 30);
    const walls = [];
    let last = null;
    for (let i = 0; i < 4; i++) {
      walls.push(await draw(page));
      last = await state(page);
    }
    results.perf.push({ id, drawnFrameWallMs: walls, jsMs: last.perf, draws: last.render.calls, triangles: last.render.triangles });
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
}

async function main() {
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  const results = { dist, size: [width, height], quality, started: new Date().toISOString(), baselineSha: fs.existsSync(path.join(dist, 'BASELINE_SHA')) ? fs.readFileSync(path.join(dist, 'BASELINE_SHA'), 'utf8').trim() : null };
  try {
    const { page, consoleLines } = await openPlay(browser, server.url);
    const hasGround = await page.evaluate(() => typeof window.__ZR_PLAY__.ground === 'function');
    if (want('stairs') && hasGround) await stairsScenario(page, results);
    if (want('look')) await lookScenario(page, results);
    if (want('pad')) await padScenario(page, results);
    if (want('climb')) await climbScenario(page, results);
    if (want('walk')) await walkScenario(page, results);
    if (want('perf')) await perfScenario(page, results);
    if (video && want('video')) await videoScenario(page, results);
    if (only?.has('interact')) await interactScenario(page, results);
    if (only?.has('resilience')) {
      await resilienceScenario(page, results, async () => {
        const before = consoleLines.length;
        await page.reload({ waitUntil: 'load', timeout: READY_TIMEOUT_MS });
        await waitReady(page);
        return { page, consoleLines: consoleLines.slice(before) };
      });
    }
    results.pageErrors = consoleLines.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[page:error]'));
    results.finished = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
    log(`done → ${path.join(out, 'playtest.json')}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
