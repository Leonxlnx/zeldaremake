#!/usr/bin/env node
/**
 * playtest.mjs — drive the walkable build like a player and record what happened.
 *
 *   node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play [--size 960x540] [--quality high]
 *        [--only look,pad,stairs,climb,walk,perf] [--shots] [--video] [--spots plaza,stairs2-base]
 *        (opt-in, by name only: --only pacing [--routes upper-house,north-clearing] | interact | resilience)
 *        [--warmup] (boot with the normal launch path's warm-up; default off: the first draws compile)
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
 * frame cost; with `pacing`, the per-frame JS step along a walk, synced drawn frames, shader
 * compiles and heap. --shots saves JPEGs at the checkpoints; --video saves every drawn frame of the
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
/** flights the walk routes use but the stair / climb scenarios leave out */
const ROUTE_FLIGHTS = {
  'house-west': { base: [3.8, 0.27, -8.0], dir: [0.9397, 0.342], steps: 5, rise: 0.27, tread: 0.4, width: 2.4 },
  ledge: { base: [1.2, 4.0, -73.2], dir: [0, -1], steps: 6, rise: 0.27, tread: 0.42, width: 1.8 },
};
/** layout.ts EXPANSION_SOUTH: the rope bridge sill to sill and its walk's half width; the log's mouth, axis and dead end */
const SOUTH = { north: [3.72, 30.45], south: [4.08, 43.7], walkHalfWidth: 0.5, mouth: [4.25, 46.9], dir: [0.03, 1], deadEnd: 5.6 };
const southFrames = () => {
  const len = Math.hypot(SOUTH.south[0] - SOUTH.north[0], SOUTH.south[1] - SOUTH.north[1]);
  const bx = (SOUTH.south[0] - SOUTH.north[0]) / len;
  const bz = (SOUTH.south[1] - SOUTH.north[1]) / len;
  const tl = Math.hypot(SOUTH.dir[0], SOUTH.dir[1]);
  const tx = SOUTH.dir[0] / tl;
  const tz = SOUTH.dir[1] / tl;
  return {
    len,
    /** along the deck from the north sill (a), across it (c) */
    bridge: (a, c = 0) => [SOUTH.north[0] + bx * a - bz * c, SOUTH.north[1] + bz * a + bx * c],
    /** into the log from its mouth (a), across it (c) */
    log: (a, c = 0) => [SOUTH.mouth[0] + tx * a - tz * c, SOUTH.mouth[1] + tz * a + tx * c],
  };
};
/**
 * layout.ts EXPANSION_SOUTH_DWELLINGS as expansionSouthDwellings.ts walks it: the keeper's gallery
 * (deck top floorY + 0.01) between the closed hut (`hut`) and the railing's band (`railR` ± `railHalf`
 * over `from` … `railTo`), boarded `from` … `to` (wall angles, deg: 0 east, 90 south); the waystation's
 * floor (`facingDeg` compass, `a` toward the path, `s` toward the south end), `width` along `s` by
 * `depth` along `a`, its back wall and north half wall `backHeight` / `northHeight` over the floor
 */
const DWELLINGS = {
  keeper: { centre: [7.1, 31.9], deckY: -0.07, hut: 1.4, railR: 2.17, railHalf: 0.18, from: -14, to: 228, railTo: 193.4 },
  waystation: { centre: [5.12, 25.95], facingDeg: -74, floorY: 0.22, width: 2.0, depth: 1.35, backHeight: 1.65, northHeight: 0.95 },
};
/** the waystation's split-log steps (structures/expansionSouthDwellings.ts): their axes' distance out of the front (a), their ends (s) and half-width */
const WAYSTATION_STEPS = { upper: { a: 0.79, s: [-0.7, 0.58] }, lower: { a: 1.09, s: [-0.5, 0.78] }, halfWidth: 0.15 };
const keeperAt = (thetaDeg, r) => [DWELLINGS.keeper.centre[0] + Math.cos(rad(thetaDeg)) * r, DWELLINGS.keeper.centre[1] + Math.sin(rad(thetaDeg)) * r];
const waystationLocal = ([x, , z]) => {
  const W = DWELLINGS.waystation;
  const fx = Math.sin(rad(W.facingDeg));
  const fz = Math.cos(rad(W.facingDeg));
  const dx = x - W.centre[0];
  const dz = z - W.centre[1];
  return { a: dx * fx + dz * fz, s: dx * fz - dz * fx };
};
const waystationAt = (a, s) => {
  const W = DWELLINGS.waystation;
  const fx = Math.sin(rad(W.facingDeg));
  const fz = Math.cos(rad(W.facingDeg));
  return [W.centre[0] + fx * a + fz * s, W.centre[1] + fz * a - fx * s];
};
/** where (x, z) stands against the keeper's hut: 'hut' | 'railing' | 'gallery' | null (off it) */
const keeperZone = ([x, z]) => {
  const K = DWELLINGS.keeper;
  const r = Math.hypot(x - K.centre[0], z - K.centre[1]);
  const th = deg(Math.atan2(z - K.centre[1], x - K.centre[0]));
  const within = (a, b) => ((((th - a) % 360) + 360) % 360) <= b - a;
  if (r <= K.hut) return 'hut';
  if (Math.abs(r - K.railR) <= K.railHalf && within(K.from, K.railTo)) return 'railing';
  if (r < K.railR - K.railHalf && within(K.from, K.to)) return 'gallery';
  return null;
};
/**
 * layout.ts EXPANSION_NORTH (the grove): its flight, the trail's centreline, the trunk house's door
 * front, the gangway's foot and head (the shelf's y and the deck's), the stilt house's veranda
 * (centre, floor, walkable ring, railing radius, the door's and the walkway's angles — rad from +x
 * toward +z, in degrees), the rope walk's ends and deck heights, the tree hut (centre, floor,
 * platform and railing radii)
 */
const GROVE = {
  flight: { base: [0.5, 5.62, -79.85], dir: [-0.12, -1], steps: 9, rise: 0.27, tread: 0.42, width: 1.4 },
  trail: [[-0.15, -85.25], [-0.95, -87.45], [-0.45, -89.85], [1.05, -91.95], [2.3, -93.9], [2.5, -96]],
  house: { c: [-3.9, -101.4], trunkR: 2.2, door: [-1.75, -99.1] },
  gangway: { foot: [6.161, -94.683], head: [9.717, -92.745], y: [10.1, 11.616], halfWidth: 0.42 },
  stilt: { c: [12, -91.5], floorY: 11.616, walkR: 2.05, railR: 2.58, doorDeg: -151.4, walkDeg: 52.7 },
  rope: { a: [14.03, -88.835], b: [15.364, -87.085], y: [11.6, 11.3], sag: 0.12, halfWidth: 0.42 },
  hut: { c: [16.8, -85.2], floorY: 11.3, platR: 1.67, railR: 1.6 },
};
const groveFrames = () => {
  const G = GROVE;
  const lerp2 = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  const across = (a, b, s, c) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const p = lerp2(a, b, s);
    return [p[0] - ((b[1] - a[1]) / l) * c, p[1] + ((b[0] - a[0]) / l) * c];
  };
  const polar = (c, r, deg) => [c[0] + r * Math.cos(rad(deg)), c[1] + r * Math.sin(rad(deg))];
  return {
    /** up the gangway (s 0 foot … 1 head), across it (c) */
    gangway: (s, c = 0) => across(G.gangway.foot, G.gangway.head, s, c),
    gangwayY: (s) => G.gangway.y[0] + (G.gangway.y[1] - G.gangway.y[0]) * s,
    /** along the rope walk (s 0 stilt stub … 1 hut stub), across it (c) */
    rope: (s, c = 0) => across(G.rope.a, G.rope.b, s, c),
    ropeY: (s) => G.rope.y[0] + (G.rope.y[1] - G.rope.y[0]) * s - G.rope.sag * 4 * s * (1 - s),
    stilt: (r, deg) => polar(G.stilt.c, r, deg),
    hut: (r, deg) => polar(G.hut.c, r, deg),
    hutWalkDeg: (Math.atan2(G.rope.b[1] - G.hut.c[1], G.rope.b[0] - G.hut.c[0]) * 180) / Math.PI,
  };
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
  const url = `${baseUrl}/?test=1&dev=0&hud=${args.hud ? 1 : 0}&warmup=${args.warmup ? 1 : 0}&quality=${encodeURIComponent(quality)}`;
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

/**
 * Exposure of the last drawn frame as the player sees it (the canvas after tone mapping and post):
 * 8-bit display values on a 160 × 90 grid, split into sky (depth > 150 m or none) and scene.
 * `clipped` = any channel ≥ 250 (blown), `crushed` = luma ≤ 6 (black), luma percentiles 0–255.
 */
const exposure = (page) =>
  page.evaluate(() => {
    const W = 160;
    const H = 90;
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;
    const cw = gl.drawingBufferWidth;
    const ch = gl.drawingBufferHeight;
    const px = new Uint8Array(cw * ch * 4);
    gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const depth = window.__ZR__.depthImage(null, W, H).data;
    const groups = { all: [], sky: [], scene: [] };
    const tally = { all: { clipped: 0, crushed: 0 }, sky: { clipped: 0, crushed: 0 }, scene: { clipped: 0, crushed: 0 } };
    // both readbacks run bottom-up (GL): row 0 is the bottom of the frame
    for (let y = 0; y < H; y++) {
      const py = Math.min(ch - 1, Math.floor(((y + 0.5) / H) * ch));
      for (let x = 0; x < W; x++) {
        const pxx = Math.min(cw - 1, Math.floor(((x + 0.5) / W) * cw));
        const i = (py * cw + pxx) * 4;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const d = depth[y * W + x];
        const where = d < 0 || d > 150 ? 'sky' : 'scene';
        for (const k of ['all', where]) {
          groups[k].push(luma);
          if (Math.max(r, g, b) >= 250) tally[k].clipped++;
          if (luma <= 6) tally[k].crushed++;
        }
      }
    }
    const stats = (k) => {
      const v = groups[k].sort((a, b) => a - b);
      const n = v.length;
      if (!n) return { share: 0 };
      const q = (p) => +v[Math.min(n - 1, Math.floor(p * (n - 1)))].toFixed(1);
      return { share: +(n / (W * H)).toFixed(4), clipped: +(tally[k].clipped / n).toFixed(4), crushed: +(tally[k].crushed / n).toFixed(4), p05: q(0.05), p50: q(0.5), p95: q(0.95), mean: +(v.reduce((s, x) => s + x, 0) / n).toFixed(1) };
    };
    return { all: stats('all'), sky: stats('sky'), scene: stats('scene') };
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
    const restExposure = await exposure(page);
    const restShot = await shot(page, `look-${spot.id}-rest`);
    // drag up (the mouse moves toward the top of the screen) far enough to hit any limit
    await drag(page, 0, -Math.round(height * 0.9), 15, 2);
    await sim(page, 30);
    const up = summarise(await state(page));
    await draw(page);
    const upClear = await clearance(page);
    const upExposure = await exposure(page);
    const upShot = await shot(page, `look-${spot.id}-drag-up`);
    // drag down twice as far (through rest to the other limit)
    await drag(page, 0, Math.round(height * 1.8), 30, 2);
    await sim(page, 30);
    const down = summarise(await state(page));
    await draw(page);
    const downClear = await clearance(page);
    const downExposure = await exposure(page);
    const downShot = await shot(page, `look-${spot.id}-drag-down`);
    const els = [rest.elevationDeg, up.elevationDeg, down.elevationDeg];
    results.look.push({
      ...spot,
      at: spot.at.map((v) => +v.toFixed(3)),
      rest: { ...rest, clearance: restClear, exposure: restExposure, shot: restShot },
      dragUp: { ...up, clearance: upClear, exposure: upExposure, shot: upShot },
      dragDown: { ...down, clearance: downClear, exposure: downExposure, shot: downShot },
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
            rows.push({ link: s.link, heading: s.heading, cam: s.camera.position, dir: s.camera.direction, camGround: s.groundUnderCamera, feet: s.feet });
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

const quantile = (arr, p) => {
  const s = [...arr].sort((u, v) => u - v);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null;
};
const fixed = (v, n = 3) => (v === null || v === undefined ? null : +v.toFixed(n));

/**
 * The boots against the rendered stone / timber over a trace: every stance foot's sole gap (the
 * sole over the surface under it) and its footprint's smallest gap (negative = a boot corner
 * inside the surface).
 */
function feetStats(trace) {
  const gaps = [];
  const shoes = [];
  for (const r of trace) {
    for (const f of r.feet ?? []) {
      if (!f.stance) continue;
      gaps.push(Math.abs(f.gapM));
      shoes.push(f.minShoeGapM);
    }
  }
  if (!gaps.length) return null;
  return {
    stanceSamples: gaps.length,
    soleGapAbsM: { p50: fixed(quantile(gaps, 0.5), 4), p95: fixed(quantile(gaps, 0.95), 4), max: fixed(quantile(gaps, 1), 4) },
    // the boot's lowest point over the surface: ≈ 0 when the foot stands on it (the sole marker
    // above lifts with the heel at push-off); > 1 cm for a whole boot floating
    footprintLowestM: { p50: fixed(quantile(shoes, 0.5), 4), p95: fixed(quantile(shoes, 0.95), 4), max: fixed(quantile(shoes, 1), 4) },
    shareOver1cm: fixed(gaps.filter((g) => g > 0.01).length / gaps.length, 4),
    shareOver2cm: fixed(gaps.filter((g) => g > 0.02).length / gaps.length, 4),
    footprintMinGapM: fixed(quantile(shoes, 0), 4),
    shareFootprintInside5mm: fixed(shoes.filter((g) => g < -0.005).length / shoes.length, 4),
  };
}

/**
 * The follow camera's motion over a trace (one row per 1/30 s frame): speed and acceleration of
 * its position, turn rate of its view and that rate's change. A camera that pops (a collision
 * snap, a ground step) shows as an acceleration spike far above the walk's own.
 */
function cameraMotion(trace) {
  const v = [];
  const w = [];
  for (let i = 1; i < trace.length; i++) {
    const p0 = trace[i - 1].cam;
    const p1 = trace[i].cam;
    v.push([(p1[0] - p0[0]) / DT, (p1[1] - p0[1]) / DT, (p1[2] - p0[2]) / DT]);
    const d0 = trace[i - 1].dir;
    const d1 = trace[i].dir;
    const dot = Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2]));
    w.push(deg(Math.acos(dot)) / DT);
  }
  const speed = v.map((x) => Math.hypot(x[0], x[1], x[2]));
  const acc = [];
  const accY = [];
  for (let i = 1; i < v.length; i++) {
    acc.push(Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1], v[i][2] - v[i - 1][2]) / DT);
    accY.push(Math.abs(v[i][1] - v[i - 1][1]) / DT);
  }
  const turnAcc = [];
  for (let i = 1; i < w.length; i++) turnAcc.push(Math.abs(w[i] - w[i - 1]) / DT);
  const q = (arr) => ({ p50: fixed(quantile(arr, 0.5), 2), p95: fixed(quantile(arr, 0.95), 2), max: fixed(quantile(arr, 1), 2) });
  // the worst jumps, with where they happened and what the camera's collision was doing either side
  // (acc[k] is the change between frames k and k + 2's velocities, centred on row k + 1)
  const spikes = acc
    .map((a, k) => ({ a, row: k + 1 }))
    .filter((s) => s.a > 100)
    .sort((u, v) => v.a - u.a)
    .slice(0, 6)
    .map(({ a, row }) => {
      const pick = (r) => (r ? { link: r.link?.map((v) => fixed(v, 2)), cam: r.cam?.map((v) => fixed(v, 2)), hit: r.follow?.hit ?? null, keep: fixed(r.follow?.keep, 3), lift: fixed(r.follow?.lift, 3), lowered: fixed(r.follow?.lowered, 3), slimPush: fixed(r.follow?.slimPush, 3) } : null);
      return { row, accelMps2: fixed(a, 1), jumpM: fixed(Math.hypot(...trace[row + 1].cam.map((v, j) => v - trace[row].cam[j])), 3), before: pick(trace[row]), after: pick(trace[row + 1]) };
    });
  return { speedMps: q(speed), accelMps2: q(acc), verticalAccelMps2: q(accY), turnDegPerS: q(w), turnAccelDegPerS2: q(turnAcc), spikes };
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
    feet: feetStats(trace),
    camera: cameraMotion(trace),
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
  /** every simulated frame: Link, the camera and the boots (for the camera's motion and the contact) */
  const rows = [];
  while (wp < points.length && frames < maxFrames) {
    const st = await state(page);
    const [x, , z] = st.link;
    const [tx, tz, need] = points[wp];
    const dist = Math.hypot(tx - x, tz - z);
    // a waypoint may ask for more than passing within 0.5 m: nearer (`within`) and at a height (`y`,
    // standing on a floor rather than in the pit in front of it)
    if (dist < (need?.within ?? 0.5) && (need?.y === undefined || Math.abs(st.link[1] - need.y) < 0.06)) {
      wp++;
      best = Infinity;
      lastProgressAt = frames;
      continue;
    }
    if (dist < best - 0.05) {
      best = dist;
      lastProgressAt = frames;
    } else if (frames - lastProgressAt > 90) {
      // what stops him: the ground ahead toward the waypoint, every 10 cm for 1.5 m (walk height, blocked)
      const ahead = await page.evaluate(
        ([x, z, tx, tz]) => {
          const P = window.__ZR_PLAY__;
          const d = Math.hypot(tx - x, tz - z) || 1;
          const out = [];
          for (let s = 0; s <= 1.5001; s += 0.1) {
            const g = P.ground(x + ((tx - x) / d) * s, z + ((tz - z) / d) * s);
            out.push([+s.toFixed(1), +g.walk.toFixed(2), g.blocked]);
          }
          return out;
        },
        [x, z, tx, tz],
      );
      stuck.push({ at: [+x.toFixed(2), +st.link[1].toFixed(2), +z.toFixed(2)], toward: points[wp], frame: frames, ahead });
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
    rows.push(
      ...(await page.evaluate(
        ([n, dt]) => {
          const P = window.__ZR_PLAY__;
          const out = [];
          for (let i = 0; i < n; i++) {
            P.step(1, dt, false);
            const s = P.state();
            out.push({ link: s.link, cam: s.camera.position, dir: s.camera.direction, camGround: s.groundUnderCamera, feet: s.feet, follow: s.follow });
          }
          return out;
        },
        [3, DT],
      )),
    );
    frames += 3;
    trace.push([+x.toFixed(2), +st.link[1].toFixed(2), +z.toFixed(2)]);
  }
  await setKeys(new Set());
  const minCam = rows.length ? Math.min(...rows.map((r) => r.cam[1] - r.camGround)) : null;
  return {
    name,
    reached: wp >= points.length && stuck.length === 0,
    waypointsReached: wp - 1,
    of: points.length - 1,
    frames,
    stuck,
    lengthM: +trace.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - trace[i - 1][0], p[2] - trace[i - 1][2]) : 0), 0).toFixed(1),
    camera: rows.length > 3 ? cameraMotion(rows) : null,
    minCameraAboveGroundM: fixed(minCam),
    feet: feetStats(rows),
    trace: trace.filter((_, i) => i % 4 === 0),
  };
}

async function walkScenario(page, results) {
  const m = flightFrame(FLIGHTS.main);
  const s = flightFrame(FLIGHTS['south-bank']);
  const hw = flightFrame(ROUTE_FLIGHTS['house-west']);
  const ledge = flightFrame(ROUTE_FLIGHTS.ledge);
  const sf = southFrames();
  const gf = flightFrame(GROVE.flight);
  const gv = groveFrames();
  const routes = [
    // round Saria's trunk pad (its cap reaches the plateau) to the upper house's east side
    ['plaza-to-upper-house', [[1, 3], m.at(-1.6), m.at(m.run * 0.5), m.at(m.run + 1.2), [17.6, -9.5], [17.2, -13.0], [16.6, -15.2]]],
    ['plaza-to-south-bank-top', [[-6, 8], [-11.8, 12.0], s.at(-1.4), s.at(s.run * 0.5), s.at(s.run + 1.0)]],
    // along the lawn to the door, clear of the signpost (7.0, −9.3)
    ['saria-front-arc', [[5.7, -4.5], [8.2, -6.8], [8.6, -8.2], [9.3, -9.0]]],
    ['west-deck', [[-12.5, 8.5], [-15.39 + 0.9, 7.64 - 0.4], [-16.28, 6.46], [-18.4, 7.1]]],
    // round the plaza on its paving: toward the second staircase, up the spine, back past the west fork
    ['plaza-loop', [[0.5, 3], [4.5, -0.4], [1.2, -9], [-1.2, -3.2], [0.5, 3]]],
    // the south approach from the spawn end of the spine into the plaza
    ['south-approach', [[1, 15], [0, 8], [0.5, 1]]],
    // Saria's door the way the layout builds it: up the spine, the house-west flight, the lawn
    ['house-west-to-saria-door', [[1.5, -9.5], hw.at(-1.2), hw.at(hw.run * 0.5), hw.at(hw.run + 0.8), [8.6, -8.2], [9.3, -9.0]]],
    // off the west house's deck, down its steps, back across the lawn to the plaza (the fork's
    // waymarker stands south of this line since fable-3's f172e9bf, props/layout.ts)
    ['west-house-to-plaza', [[-18.4, 7.1], [-16.28, 6.46], [-15.39 + 0.9, 7.64 - 0.4], [-12.5, 8.5], [-6, 8], [0, 4]]],
    // the north path under the log arch into the second clearing, then up the ledge flight
    ['north-clearing-ledge', [[0.5, 2], [1.5, -12], [2.0, -18], [1.8, -24], [2.5, -30], [3.5, -36], [4.5, -42], [5.2, -50], [5.8, -58], [5.4, -61.5], [3.6, -65.2], [1.0, -68.0], [-0.6, -70.2], ledge.at(-0.9), ledge.at(ledge.run * 0.5), ledge.at(ledge.run + 0.6)], 2400],
    // round 56 (expansion-south): out of the plaza down the south approach, between the giants'
    // roots to the ravine, over the rope bridge on its axis and into the hollow log to near its glow
    ['south-bridge-to-log', [[0.5, 3], [0.8, 10], [1, 16], [-0.5, 17.2], [-1.2, 19.4], [-1.32, 21.6], [-0.8, 23.55], [0.4, 25.15], [2.0, 26.55], [3.3, 27.9], [3.68, 28.95], sf.bridge(-0.6), sf.bridge(1.4), sf.bridge(4.1), sf.bridge(6.9), sf.bridge(9.8), sf.bridge(12.2), sf.bridge(sf.len + 0.5), [4.14, 45.2], sf.log(0), sf.log(2), sf.log(4.8)], 2400],
    // exp-south2: off the path up the waystation's steps onto its floor (standing on it, at its
    // height) and out again, along the verge north of the toll pile to the bridge head, onto the
    // keeper's gallery at its entrance, round the hut over the gorge, down the east step and back
    // round the hut's north side to the path
    ['south-dwellings', [[3.3, 27.9], [3.9, 26.6], waystationAt(WAYSTATION_STEPS.upper.a, 0), [...waystationAt(0.3, 0), { within: 0.2, y: DWELLINGS.waystation.floorY }], [...waystationAt(0.3, 0.5), { within: 0.25, y: DWELLINGS.waystation.floorY }], waystationAt(WAYSTATION_STEPS.lower.a, 0.3), [3.9, 27.4], [4.3, 29.0], [5.1, 30.1], keeperAt(221, 2.0), keeperAt(200, 1.7), keeperAt(170, 1.7), keeperAt(135, 1.7), keeperAt(100, 1.7), keeperAt(60, 1.7), keeperAt(20, 1.7), keeperAt(-8, 1.7), keeperAt(-20.5, 1.86), [9.35, 31.0], [9.0, 30.0], [8.0, 29.35], [6.6, 29.2], [5.6, 28.55], [3.68, 28.95]], 2400],
    // exp-south2: the way back — from the log's dead end (the exit's glade beyond the roots) out of
    // the mouth, over the bridge, round plaza-south's foot and up the south approach to the plaza
    ['south-log-to-village', [sf.log(4.8), sf.log(2), sf.log(0), [4.14, 45.2], sf.bridge(sf.len + 0.5), sf.bridge(12.2), sf.bridge(9.8), sf.bridge(6.9), sf.bridge(4.1), sf.bridge(1.4), sf.bridge(-0.6), [3.68, 28.95], [3.3, 27.9], [2.0, 26.55], [0.4, 25.15], [-0.8, 23.55], [-1.32, 21.6], [-1.2, 19.4], [-0.5, 17.2], [1, 16], [0.8, 10], [0.5, 3]], 2400],
    // 2026-09-24 (expansion-north): from the second clearing up the ledge flight, past the grove's
    // sign and up its flight, along the trail to the shelf and the trunk house's door, back across
    // the yard, up the gangway onto the stilt house's veranda, round it the south way (past the
    // decorative ladder's gap) to the walkway, over the rope walk onto the tree hut's walkway deck
    ['north-grove', [[3.6, -65.2], [1.0, -68.0], [-0.6, -70.2], ledge.at(-0.9), ledge.at(ledge.run * 0.5), ledge.at(ledge.run + 0.6), gf.at(-0.9), gf.at(gf.run * 0.5), gf.at(gf.run + 0.6), ...GROVE.trail.slice(1), GROVE.house.door, [2.0, -97.2], [4.9, -95.4], gv.gangway(-0.1), gv.gangway(0.5), gv.gangway(1), gv.stilt(GROVE.stilt.walkR + 0.05, -165), gv.stilt(GROVE.stilt.walkR + 0.05, 160), gv.stilt(GROVE.stilt.walkR + 0.05, 120), gv.stilt(GROVE.stilt.walkR + 0.05, 80), gv.stilt(2.65, GROVE.stilt.walkDeg), gv.rope(0), gv.rope(0.5), gv.rope(1), gv.hut(1.8, gv.hutWalkDeg)], 3600],
  ];
  results.walk = [];
  const pickRoutes = typeof args['walk-routes'] === 'string' ? new Set(args['walk-routes'].split(',')) : null;
  for (const [name, pts, maxFrames] of routes) {
    if (pickRoutes && !pickRoutes.has(name)) continue;
    log(`walk: ${name}`);
    results.walk.push(await walkRoute(page, name, pts, maxFrames));
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
  if (!pickRoutes || pickRoutes.has('south-bridge-to-log')) {
    results.southProbes = await southProbes(page);
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
  if (!pickRoutes || pickRoutes.has('south-dwellings')) {
    results.southDwellingProbes = await southDwellingProbes(page);
    results.southDwellingCamera = await southDwellingCamera(page);
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
  if (!pickRoutes || pickRoutes.has('north-grove')) {
    results.northProbes = await northProbes(page);
    fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
  }
}

/**
 * The grove's built walks hold Link and its walls stop him: the play hook's ground on the veranda
 * ring, the gangway's treads, the rope walk's planks and the tree hut's walkway deck (not blocked,
 * at the deck's height); on the railings, the deck sides, the huts' shut walls, the tree hut's
 * railed platform and the trunk house's bole (blocked); the trail, the flight and the door front
 * (walk).
 */
async function northProbes(page) {
  const G = GROVE;
  const gv = groveFrames();
  const gf = flightFrame(G.flight);
  const probes = [];
  for (const a of [-170, 160, 120, 90, 20, -60, -100]) probes.push({ where: 'veranda', a, c: G.stilt.walkR, at: gv.stilt(G.stilt.walkR, a), expect: 'deck', y: G.stilt.floorY });
  for (const a of [-170, 160, 120, 108, 90, 20, -60, -100]) probes.push({ where: 'veranda-rail', a, c: G.stilt.railR, at: gv.stilt(G.stilt.railR, a), expect: 'blocked' });
  for (const a of [G.stilt.doorDeg, 90, -30]) probes.push({ where: 'stilt-wall', a, c: 1.4, at: gv.stilt(1.4, a), expect: 'blocked' });
  for (const s of [0.25, 0.5, 0.75]) {
    for (const c of [0, 0.28, -0.28]) probes.push({ where: 'gangway', a: s, c, at: gv.gangway(s, c), expect: 'deck', y: gv.gangwayY(s) });
    for (const c of [0.47, -0.47]) probes.push({ where: 'gangway-side', a: s, c, at: gv.gangway(s, c), expect: 'blocked' });
  }
  for (const s of [0.25, 0.5, 0.75]) {
    for (const c of [0, 0.25, -0.25]) probes.push({ where: 'rope-walk', a: s, c, at: gv.rope(s, c), expect: 'deck', y: gv.ropeY(s) });
    for (const c of [0.46, -0.46]) probes.push({ where: 'rope-walk-side', a: s, c, at: gv.rope(s, c), expect: 'blocked' });
  }
  probes.push({ where: 'hut-walkway', a: gv.hutWalkDeg, c: 1.9, at: gv.hut(1.9, gv.hutWalkDeg), expect: 'deck', y: G.hut.floorY });
  for (const d of [70, 140, 180, 250]) probes.push({ where: 'hut-platform', a: gv.hutWalkDeg + d, c: 1.5, at: gv.hut(1.5, gv.hutWalkDeg + d), expect: 'blocked' });
  for (const d of [90, 180, 270]) probes.push({ where: 'hut-rail', a: gv.hutWalkDeg + d, c: G.hut.railR, at: gv.hut(G.hut.railR, gv.hutWalkDeg + d), expect: 'blocked' });
  probes.push({ where: 'hut-door', a: gv.hutWalkDeg, c: 1.35, at: gv.hut(1.35, gv.hutWalkDeg), expect: 'blocked' });
  const toDoor = Math.atan2(G.house.door[1] - G.house.c[1], G.house.door[0] - G.house.c[0]);
  probes.push({ where: 'house-bole', a: 0, c: G.house.trunkR - 0.3, at: [G.house.c[0] + Math.cos(toDoor + 0.9) * (G.house.trunkR - 0.3), G.house.c[1] + Math.sin(toDoor + 0.9) * (G.house.trunkR - 0.3)], expect: 'blocked' });
  probes.push({ where: 'house-door-front', a: 0, c: 0, at: G.house.door, expect: 'walk' });
  for (const p of G.trail.slice(1, 5)) probes.push({ where: 'trail', a: 0, c: 0, at: p, expect: 'walk' });
  probes.push({ where: 'flight', a: gf.run * 0.5, c: 0, at: gf.at(gf.run * 0.5), expect: 'deck', y: G.flight.base[1] + G.flight.rise * G.flight.steps * 0.5, tol: 0.3 });
  const got = await page.evaluate((pts) => pts.map(([x, z]) => window.__ZR_PLAY__.ground(x, z)), probes.map((p) => p.at));
  const rows = probes.map((p, i) => {
    const g = got[i];
    const ok = p.expect === 'blocked' ? g.blocked === true : p.expect === 'deck' ? g.blocked === false && Math.abs(g.walk - p.y) < (p.tol ?? 0.1) : g.blocked === false;
    return { where: p.where, a: +p.a.toFixed(2), c: p.c, x: +p.at[0].toFixed(2), z: +p.at[1].toFixed(2), walk: +g.walk.toFixed(3), terrain: +g.terrain.toFixed(3), blocked: g.blocked, expect: p.expect, want: p.y !== undefined ? +p.y.toFixed(3) : undefined, ok };
  });
  return { ok: rows.every((r) => r.ok), failed: rows.filter((r) => !r.ok).length, rows };
}

/**
 * The rope bridge holds Link on its deck: the play hook's ground across the deck at its quarter
 * spans (on the walk: not blocked, at deck height far over the ravine floor; beside it: blocked),
 * off its heads into the ravine, and in the log (its floor walks, its walls and the glow past the
 * dead end block).
 */
async function southProbes(page) {
  const sf = southFrames();
  const probes = [];
  for (const u of [0.25, 0.5, 0.75]) {
    const a = sf.len * u;
    for (const c of [0, 0.45, -0.45]) probes.push({ where: 'deck', a, c, at: sf.bridge(a, c), expect: 'walk' });
    for (const c of [0.7, -0.7, 1.0, -1.0, 2.5, -2.5]) probes.push({ where: 'deck-side', a, c, at: sf.bridge(a, c), expect: 'blocked' });
  }
  // 1.5 m past a sill the gorge's slant can leave a probe 3 m off the axis on the rounded lip: walkable
  // there only while the ground is within 0.5 m of grade ('rim'); 3 m past a sill it is the wall
  // (exp-south2: where a probe beside the north head now stands on the keeper's gallery it expects
  // the gallery's boards — 'built': not blocked, far over the gorge floor)
  for (const p of probes) if (p.where === 'deck-side' && keeperZone(p.at) === 'gallery') p.expect = 'built';
  for (const c of [3.0, -3.0]) probes.push({ where: 'rim-by-north-head', a: 1.5, c, at: sf.bridge(1.5, c), expect: 'rim' });
  for (const c of [3.0, -3.0]) probes.push({ where: 'ravine-by-north-head', a: 3.0, c, at: sf.bridge(3.0, c), expect: keeperZone(sf.bridge(3.0, c)) === 'gallery' ? 'built' : 'blocked' });
  for (const c of [3.0, -3.0]) probes.push({ where: 'ravine-by-south-head', a: sf.len - 1.5, c, at: sf.bridge(sf.len - 1.5, c), expect: 'blocked' });
  for (const c of [3.0, -3.0]) probes.push({ where: 'ravine-by-south-head', a: sf.len - 3.0, c, at: sf.bridge(sf.len - 3.0, c), expect: 'blocked' });
  for (const a of [1, 3, SOUTH.deadEnd - 0.4]) probes.push({ where: 'log-floor', a, c: 0, at: sf.log(a), expect: 'walk' });
  for (const c of [1.2, -1.2]) probes.push({ where: 'log-wall', a: 3, c, at: sf.log(3, c), expect: 'blocked' });
  probes.push({ where: 'log-past-dead-end', a: SOUTH.deadEnd + 0.3, c: 0, at: sf.log(SOUTH.deadEnd + 0.3), expect: 'blocked' });
  const got = await page.evaluate((pts) => pts.map(([x, z]) => window.__ZR_PLAY__.ground(x, z)), probes.map((p) => p.at));
  const rows = probes.map((p, i) => {
    const g = got[i];
    const ok =
      p.expect === 'blocked'
        ? g.blocked === true
        : p.expect === 'rim'
          ? g.blocked === true || g.terrain > -0.5
          : p.expect === 'built'
            ? g.blocked === false && g.walk - g.terrain > 1
            : g.blocked === false && (p.where !== 'deck' || g.walk - g.terrain > 2);
    return { where: p.where, a: +p.a.toFixed(2), c: p.c, x: +p.at[0].toFixed(2), z: +p.at[1].toFixed(2), walk: +g.walk.toFixed(3), terrain: +g.terrain.toFixed(3), blocked: g.blocked, expect: p.expect, ok };
  });
  return { ok: rows.every((r) => r.ok), failed: rows.filter((r) => !r.ok).length, rows };
}

/**
 * exp-south2: the dwellings hold Link where they are built — the keeper's gallery walks at its
 * boards' height all round the gorge side, its railing, the hut and the gorge past the railing
 * block, both steps walk; the waystation's floor walks at its boards' height, its back wall, the
 * bench in front of it, its north wall and the firewood outside block, both its steps walk, and
 * straight out of the floor over both steps the walk never drops to the ground or rises more than a
 * stair's riser.
 */
async function southDwellingProbes(page) {
  const K = DWELLINGS.keeper;
  const W = DWELLINGS.waystation;
  const probes = [];
  for (const th of [-5, 30, 60, 90, 120, 150, 180, 210]) probes.push({ where: 'keeper-gallery', th, r: 1.7, at: keeperAt(th, 1.7), expect: 'deck', y: K.deckY });
  probes.push({ where: 'keeper-entrance', th: 222, r: 2.0, at: keeperAt(222, 2.0), expect: 'deck', y: K.deckY });
  for (const th of [10, 50, 90, 130, 170]) probes.push({ where: 'keeper-railing', th, r: 2.15, at: keeperAt(th, 2.15), expect: 'blocked' });
  for (const th of [60, 90, 120]) probes.push({ where: 'keeper-past-railing', th, r: 2.6, at: keeperAt(th, 2.6), expect: 'blocked' });
  for (const [th, r] of [[0, 0.3], [200, 1.0], [300, 1.2]]) probes.push({ where: 'keeper-hut', th, r, at: keeperAt(th, r), expect: 'blocked' });
  probes.push({ where: 'keeper-step-east', th: -20.5, r: 1.86, at: keeperAt(-20.5, 1.86), expect: 'step' });
  // just off the gallery's open end (1° past it), where the walk off the end comes down: the east step, not the ground
  for (const r of [1.6, 1.85, 2.05]) probes.push({ where: 'keeper-step-east-edge', th: -15, r, at: keeperAt(-15, r), expect: 'step' });
  // round the whole gallery every 0.5°, inside the railing and out to the boards' edge at the
  // entrance, across every joint of its chords (the davit's foot, 0.16 m round (1.93 m, 102°), left out)
  {
    const sweep = [];
    for (const [r, from, to] of [[1.45, K.from, K.to], [1.74, K.from, K.to], [1.95, K.from, K.to], [2.05, K.railTo + 0.5, K.to]]) {
      for (let th = from + 0.5; th <= to - 0.5 + 1e-9; th += 0.5) {
        const at = keeperAt(th, r);
        if (Math.hypot(at[0] - keeperAt(101.9, 1.93)[0], at[1] - keeperAt(101.9, 1.93)[1]) < 0.2) continue;
        sweep.push({ r, th: +th.toFixed(1), at });
      }
    }
    const g = await page.evaluate((pts) => pts.map(([x, z]) => window.__ZR_PLAY__.ground(x, z)), sweep.map((p) => p.at));
    const miss = sweep.filter((_, i) => g[i].blocked !== false || Math.abs(g[i].walk - K.deckY) >= 0.03).map((p, i) => [p.r, p.th]);
    probes.push({ where: 'keeper-gallery-sweep', samples: sweep.length, missed: miss.length, first: miss.slice(0, 10), at: keeperAt(100, 1.74), expect: 'sweep' });
  }
  for (const [a, s] of [[0.3, 0], [0.3, 0.6], [0.3, -0.5], [0.5, 0.2]]) probes.push({ where: 'waystation-floor', a, s, at: waystationAt(a, s), expect: 'deck', y: W.floorY });
  for (const [a, s] of [[-0.62, 0], [-0.62, 0.5], [-0.38, -0.2]]) probes.push({ where: 'waystation-back-wall', a, s, at: waystationAt(a, s), expect: 'blocked' });
  // in front of the bench Link stops 0.64 m from the back wall's inner face (the camera's least distance, 0.6 m, stays inside)
  for (const [a, s] of [[0, 0], [0.05, 0.42], [0.04, -0.5]]) probes.push({ where: 'waystation-bench', a, s, at: waystationAt(a, s), expect: 'blocked' });
  probes.push({ where: 'waystation-floor', a: 0.2, s: 0, at: waystationAt(0.2, 0), expect: 'deck', y: W.floorY });
  for (const [a, s] of [[0, -0.95], [0.4, -0.95]]) probes.push({ where: 'waystation-north-wall', a, s, at: waystationAt(a, s), expect: 'blocked' });
  probes.push({ where: 'waystation-firewood', a: 0, s: -1.28, at: waystationAt(0, -1.28), expect: 'blocked' });
  const WS = WAYSTATION_STEPS;
  for (const s of [-0.5, 0, 0.4]) probes.push({ where: 'waystation-step', a: WS.upper.a, s, at: waystationAt(WS.upper.a, s), expect: 'step' });
  for (const s of [-0.3, 0.3, 0.7]) probes.push({ where: 'waystation-step-low', a: WS.lower.a, s, at: waystationAt(WS.lower.a, s), expect: 'step' });
  const got = await page.evaluate((pts) => pts.map(([x, z]) => window.__ZR_PLAY__.ground(x, z)), probes.map((p) => p.at));
  const rows = probes.map((p, i) => {
    const g = got[i];
    const ok = p.expect === 'sweep' ? p.missed === 0 : p.expect === 'blocked' ? g.blocked === true : p.expect === 'deck' ? g.blocked === false && Math.abs(g.walk - p.y) < 0.03 : g.blocked === false && g.walk - g.terrain > 0.08;
    const { at, ...rest } = p;
    return { ...rest, x: +at[0].toFixed(2), z: +at[1].toFixed(2), walk: +g.walk.toFixed(3), terrain: +g.terrain.toFixed(3), blocked: g.blocked, ok };
  });
  // straight out of the waystation's floor over both steps to the ground, every 1 cm: built all the
  // way to the lower log's front edge (never the ground in a gap: it lies deeper under the floor
  // than the step guard, a pit), and no rise going in taller than a stair's 0.28 m
  const lineEnd = WS.lower.a + WS.halfWidth - 0.01;
  for (const s of [-0.4, 0, 0.3, 0.55]) {
    const as = [];
    for (let a = 0.3; a <= lineEnd + 1e-9; a += 0.01) as.push(+a.toFixed(2));
    const g = await page.evaluate((pts) => pts.map(([x, z]) => window.__ZR_PLAY__.ground(x, z)), as.map((a) => waystationAt(a, s)));
    const pit = as.filter((_, i) => g[i].blocked || g[i].walk - g[i].terrain < 0.08);
    let maxRise = 0;
    for (let i = 1; i < g.length; i++) maxRise = Math.max(maxRise, g[i - 1].walk - g[i].walk);
    const at = waystationAt(0.3, s);
    rows.push({ where: 'waystation-floor-to-steps', a: [0.3, +lineEnd.toFixed(2)], s, x: +at[0].toFixed(2), z: +at[1].toFixed(2), heights: [...new Set(g.map((q) => +q.walk.toFixed(2)))], maxRiseM: +maxRise.toFixed(3), offBuiltAt: pit.slice(0, 8), ok: pit.length === 0 && maxRise <= 0.28 });
  }
  return { ok: rows.every((r) => r.ok), failed: rows.filter((r) => !r.ok).length, rows };
}

/**
 * exp-south2: the follow camera at the dwellings — Link set down on the keeper's gallery facing
 * along it either way and on the waystation's floor facing in, out and along; once the camera has
 * settled, the drawn frame's clearance (the share of the view nearer than 0.35 m, Link's chest
 * hidden behind something nearer or off-screen), whether the camera stands inside the hut (within
 * its wall, under its eave) and whether it stands in one of the waystation's walls (the back wall
 * or the north half wall, below its top). Facing out of the waystation its back wall (0.92 m behind
 * him) stops the camera at its minimum distance (camera/follow.ts) under the roof, where Link's
 * chest drops below the frame; facing south so does plaza-south's bole 1.6 m past the half wall,
 * with the root post and the roof's north eave (slim parts the camera may not stand in) before it.
 * There (`squeeze`) the camera must stand in front of that wall's inner face or, at the half wall,
 * over its top; everywhere else Link must be in view.
 */
async function southDwellingCamera(page) {
  const K = DWELLINGS.keeper;
  const W = DWELLINGS.waystation;
  const f = rad(W.facingDeg);
  const spots = [];
  for (const th of [221, 180, 135, 90, 45, 0]) {
    spots.push({ where: 'keeper-gallery', th, facing: 'on', at: keeperAt(th, 1.7), yaw: Math.atan2(Math.sin(rad(th)), -Math.cos(rad(th))) });
    spots.push({ where: 'keeper-gallery', th, facing: 'back', at: keeperAt(th, 1.7), yaw: Math.atan2(-Math.sin(rad(th)), Math.cos(rad(th))) });
  }
  spots.push({ where: 'waystation-floor', facing: 'in', at: waystationAt(0.3, 0), yaw: f + Math.PI });
  spots.push({ where: 'waystation-floor', facing: 'out', at: waystationAt(0.3, 0), yaw: f, squeeze: 'back' });
  spots.push({ where: 'waystation-floor', facing: 'south', at: waystationAt(0.3, -0.4), yaw: Math.atan2(Math.cos(f), -Math.sin(f)), squeeze: 'north' });
  spots.push({ where: 'waystation-floor', facing: 'north', at: waystationAt(0.3, 0.5), yaw: Math.atan2(-Math.cos(f), Math.sin(f)) });
  // the walls in the waystation's frame (a out of its open front, s toward its south end)
  const backA = -(W.depth / 2 - 0.055) - 0.005;
  const northS = -(W.width / 2 - 0.08) - 0.005;
  const backInner = backA + 0.07;
  const rows = [];
  for (const s of spots) {
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [s.at[0], s.at[1], s.yaw]);
    await sim(page, 45);
    const st = summarise(await state(page));
    await draw(page);
    const clear = await clearance(page);
    const c = st.camera;
    const rHut = Math.hypot(c[0] - K.centre[0], c[2] - K.centre[1]);
    const inHut = rHut < 1.25 && c[1] < K.deckY + 3.0;
    const wl = waystationLocal(c);
    const inWall =
      (wl.a > backA - 0.09 && wl.a < backInner && Math.abs(wl.s) < W.width / 2 && c[1] < W.floorY + W.backHeight + 0.05) ||
      (wl.s > northS - 0.09 && wl.s < northS + 0.07 && Math.abs(wl.a) < W.depth / 2 && c[1] < W.floorY + W.northHeight + 0.05);
    const squeezeOk = s.squeeze === 'back' ? wl.a > backInner : wl.s > northS + 0.07 || c[1] > W.floorY + W.northHeight + 0.05;
    const ok = !inHut && !inWall && clear.nearShare < 0.01 && (s.squeeze ? squeezeOk : clear.linkHidden === false);
    const { at, yaw, ...rest } = s;
    rows.push({ ...rest, x: +at[0].toFixed(2), z: +at[1].toFixed(2), camera: c, cameraToLink: st.cameraToLink, cameraFromHutAxisM: +rHut.toFixed(3), inHut, waystation: { a: +wl.a.toFixed(3), s: +wl.s.toFixed(3) }, inWall, ...clear, ok });
  }
  return { ok: rows.every((r) => r.ok), failed: rows.filter((r) => !r.ok).length, rows };
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
    for (let i = 0; i < 3; i++) await save(`look-${id}`, k++);
    const t0 = Date.now();
    await drag(page, 0, -Math.round(height * 0.8), 14, 1, async () => {
      await sim(page, 1);
      await save(`look-${id}`, k++);
    });
    for (let i = 0; i < 5; i++) {
      await sim(page, 1);
      await save(`look-${id}`, k++);
    }
    await drag(page, 0, Math.round(height * 1.0), 14, 1, async () => {
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
    // a drawn frame every second simulated one (15 fps of a 30 fps walk, 5 s)
    for (let i = 0; i < 75; i++) {
      await sim(page, 2);
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

/**
 * Frame pacing along a walk (default: the plaza up the second staircase to the upper house),
 * steered with the movement keys like walkRoute: every simulated frame's JS step (camera + world
 * update — LOD pools, grass streaming, the character) timed by the page's own step timers, every
 * `every`-th frame drawn with a synced wall time and its render-issue ms, and the renderer's
 * program count and the JS heap sampled throughout. A program count that grows during the walk
 * is a shader compile mid-play — a hitch on any GPU; the JS step is this machine's CPU side of a
 * frame whatever the rasteriser. `--routes a,b` picks routes from PACE_ROUTES; run with
 * `--warmup` to measure the page as the normal launch path boots it (its warm-up compiles first).
 */
const PACE_DRAW = 12;
const PACE_ROUTES = {
  'upper-house': {
    label: 'plaza → second staircase → upper house',
    points: () => {
      const m = flightFrame(FLIGHTS.main);
      return [[1, 3], m.at(-1.6), m.at(m.run * 0.5), m.at(m.run + 1.2), [17.6, -9.5], [17.2, -13.0], [16.6, -15.2]];
    },
    every: PACE_DRAW,
    maxFrames: 720,
  },
  // up the north path under the log arch into the second clearing: crosses the 45 m line inside
  // which the clearing's posts, sign, rail and paving are drawn (structures/north.ts, hardscape)
  'north-clearing': {
    label: 'plaza → north path → under the log arch → north clearing',
    points: () => [[0.5, 2], [0.6, -6], [1.5, -12], [2.0, -18], [1.8, -24], [2.5, -30], [3.5, -36], [4.5, -42], [5.2, -50], [5.8, -58], [5.4, -61.5], [3.6, -65.2], [1.0, -68.0], [-1.0, -69.4]],
    every: 20,
    maxFrames: 1500,
  },
};
async function pacingScenario(page, results, routeId = 'upper-house') {
  const route = PACE_ROUTES[routeId];
  if (!route) throw new Error(`unknown pacing route ${routeId} (have ${Object.keys(PACE_ROUTES).join(', ')})`);
  const points = route.points();
  const every = route.every;
  const keysDown = new Set();
  const setKeys = async (want) => {
    for (const k of [...keysDown]) if (!want.has(k)) (await page.keyboard.up(k), keysDown.delete(k));
    for (const k of want) if (!keysDown.has(k)) (await page.keyboard.down(k), keysDown.add(k));
  };
  log(`pacing: ${route.label}`);
  await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [points[0][0], points[0][1], Math.atan2(points[1][0] - points[0][0], points[1][1] - points[0][1])]);
  await sim(page, 30);
  // the spot's first drawn frame (its programs and uploads) is load, not pacing
  await draw(page);
  await draw(page);
  const frames = [];
  const stuck = [];
  let wp = 1;
  let n = 0;
  let best = Infinity;
  let lastProgressAt = 0;
  while (wp < points.length && n < route.maxFrames) {
    const st = await state(page);
    const [x, , z] = st.link;
    const [tx, tz] = points[wp];
    const dist = Math.hypot(tx - x, tz - z);
    if (dist < 0.5) {
      wp++;
      best = Infinity;
      lastProgressAt = n;
      continue;
    }
    if (dist < best - 0.05) {
      best = dist;
      lastProgressAt = n;
    } else if (n - lastProgressAt > 90) {
      stuck.push({ at: st.link.map((v) => +v.toFixed(2)), toward: points[wp], frame: n });
      wp++;
      best = Infinity;
      lastProgressAt = n;
      continue;
    }
    const d = st.camera.direction;
    const c = Math.atan2(d[0], d[2]);
    const a = ((tx - x) / dist) * Math.sin(c) + ((tz - z) / dist) * Math.cos(c);
    const b = ((tx - x) / dist) * -Math.cos(c) + ((tz - z) / dist) * Math.sin(c);
    const want = new Set();
    if (a > 0.38) want.add('KeyW');
    if (a < -0.38) want.add('KeyS');
    if (b > 0.38) want.add('KeyD');
    if (b < -0.38) want.add('KeyA');
    await setKeys(want);
    for (let k = 0; k < 3; k++, n++) {
      const drawNow = n % every === 0;
      const f = await page.evaluate(
        ([dt, drawNow]) => {
          const t0 = performance.now();
          window.__ZR_PLAY__.step(1, dt, drawNow);
          let wall = null;
          if (drawNow) {
            const gl = document.querySelector('canvas').getContext('webgl2');
            if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
            wall = performance.now() - t0;
          }
          const s = window.__ZR_PLAY__.state();
          return { js: s.perf.camera + s.perf.update, update: s.perf.update, render: drawNow ? s.perf.render : null, wall, programs: s.render.programs, heap: s.heap, link: s.link };
        },
        [DT, drawNow],
      );
      frames.push({ n, ...f });
    }
  }
  await setKeys(new Set());
  const q = (arr, p) => {
    const s = [...arr].sort((u, v) => u - v);
    return s.length ? +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))].toFixed(2) : null;
  };
  const js = frames.map((f) => f.js);
  const p50 = q(js, 0.5);
  const hitches = frames.filter((f) => f.js > Math.max(8, 2 * p50)).map((f) => ({ n: f.n, js: +f.js.toFixed(2), at: f.link.map((v) => +v.toFixed(1)) }));
  const drawn = frames.filter((f) => f.wall !== null);
  const programs = frames.map((f) => f.programs).filter((v) => v !== null);
  const compiles = [];
  for (let i = 1; i < frames.length; i++) if (frames[i].programs !== null && frames[i - 1].programs !== null && frames[i].programs > frames[i - 1].programs) compiles.push({ n: frames[i].n, programs: frames[i].programs, at: frames[i].link.map((v) => +v.toFixed(1)) });
  const heaps = frames.map((f) => f.heap).filter((v) => v !== null);
  const report = {
    route: route.label,
    id: routeId,
    warmup: !!args.warmup,
    reached: wp >= points.length && stuck.length === 0,
    stuck,
    frames: frames.length,
    simulatedSeconds: +(frames.length * DT).toFixed(1),
    jsStepMs: { p50, p95: q(js, 0.95), p99: q(js, 0.99), max: q(js, 1), mean: +(js.reduce((s, v) => s + v, 0) / Math.max(1, js.length)).toFixed(2) },
    hitches: { rule: 'JS step > max(8 ms, 2 × p50)', count: hitches.length, frames: hitches.slice(0, 20) },
    drawn: {
      every,
      count: drawn.length,
      wallMs: { p50: q(drawn.map((f) => f.wall), 0.5), max: q(drawn.map((f) => f.wall), 1) },
      renderIssueMs: { p50: q(drawn.map((f) => f.render), 0.5), max: q(drawn.map((f) => f.render), 1) },
      // the drawn frames' render issue in walk order, with the program count after each: a compile
      // shows as a jump in both
      series: drawn.map((f) => [f.n, +f.render.toFixed(1), +f.wall.toFixed(0), f.programs]),
    },
    programs: { start: programs[0] ?? null, end: programs[programs.length - 1] ?? null, compilesDuringWalk: compiles },
    heapMB: heaps.length ? { start: +(heaps[0] / 1048576).toFixed(1), end: +(heaps[heaps.length - 1] / 1048576).toFixed(1), max: +(Math.max(...heaps) / 1048576).toFixed(1) } : null,
    series: frames.map((f) => [f.n, +f.js.toFixed(2), f.wall === null ? null : +f.wall.toFixed(0)]),
  };
  if (routeId === 'upper-house') results.pacing = report;
  results.pacingRoutes = { ...(results.pacingRoutes ?? {}), [routeId]: report };
  fs.writeFileSync(path.join(out, 'playtest.json'), JSON.stringify(results, null, 1));
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
    if (only?.has('pacing')) {
      const routes = typeof args.routes === 'string' ? args.routes.split(',') : ['upper-house'];
      for (const r of routes) await pacingScenario(page, results, r);
    }
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
