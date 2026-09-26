#!/usr/bin/env node
// Play-mode probe for the east lane: wall pushes (held keys steering at a target for N frames),
// footsteps by surface along walks (live audio, `__ZR_AUDIO__.stats()` per step) and the camera on the
// two turn-around routes (per-frame jump and pop, trunk clearance, rendered frames at the turn).
//   node art/environment/exp-east-2026-09-23/tools/play-probe.mjs --dist <dist> --out <dir> [--only pushes,steps,camwalks]
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const out = path.resolve(args.out ?? '/tmp/east-play');
const only = args.only ? new Set(String(args.only).split(',')) : null;
const want = (s) => !only || only.has(s);
fs.mkdirSync(out, { recursive: true });
const log = (...m) => console.error('[east-play]', ...m);
const DT = 1 / 30;

const FENCE = [[45.3, 8.85], [46.6, 8.75], [47.9, 8.7], [49.2, 8.75], [50.3, 8.55]];
const WEST_RUN = [[44.15, 8.95], [42.9, 9.0], [41.6, 9.0], [40.3, 8.85], [38.95, 8.45]];
const EAST_RUN = [[50.97, 7.8], [50.93, 6.72], [50.84, 5.86]];
const STUMPS = [{ x: 44.72, z: 8.98, r: 0.5 }, { x: 50.88, z: 8.36, r: 0.5 }, { x: 50.78, z: 5.3, r: 0.45 }];
const segDist = (x, z, a, b) => {
  const ex = b[0] - a[0];
  const ez = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez)));
  return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
};
const runDist = (x, z, run) => Math.min(...run.slice(1).map((b, i) => segDist(x, z, run[i], b)));
const fenceDist = (x, z) => Math.min(runDist(x, z, FENCE), runDist(x, z, WEST_RUN), runDist(x, z, EAST_RUN), ...STUMPS.map((s) => Math.hypot(x - s.x, z - s.z) - s.r));
// pushes: [name, start, target, frames]
const PUSHES = [
  ['fence head-on (mid)', [46.9, 7.9], [46.9, 12.0], 180],
  ['fence head-on (east run)', [49.6, 7.7], [49.8, 12.0], 180],
  ['fence slant 10° to east end', [46.2, 8.35], [56.0, 10.1], 240],
  ['fence slant 20° to east end', [46.2, 8.2], [56.0, 11.8], 240],
  ['fence slant 35° to east end', [47.0, 7.9], [54.0, 12.8], 240],
  ['fence slant 10° to west end', [49.6, 8.3], [40.0, 10.0], 240],
  ['fence slant 20° to west end', [49.6, 8.2], [40.0, 11.7], 240],
  ['fence slant 35° to west end', [48.8, 7.9], [42.0, 12.8], 240],
  ['along the rope east', [46.0, 8.4], [56.0, 8.0], 240],
  ['along the rope west', [49.8, 8.3], [40.0, 9.3], 240],
  ['east stump from the lookout', [50.4, 7.0], [51.2, 12.0], 180],
  ['east run from outside', [52.2, 6.8], [48.0, 7.2], 180],
  ['east run slant from outside to the lip', [52.2, 6.2], [49.8, 11.0], 240],
  ['east stump from the north-west', [50.0, 7.3], [53.0, 11.5], 180],
  ['west stump from the north', [44.7, 7.4], [44.7, 12.0], 180],
  ['west stump from the north-east', [45.6, 7.6], [42.8, 11.5], 180],
  ['bench from the lane end', [47.2, 7.25], [49.5, 8.6], 150],
  ['deck railing from the strip', [48.6, 2.15], [48.4, 5.0], 150],
  ['deck far end along the strip', [48.0, 2.2], [52.0, 2.0], 150],
  ['green lantern post', [40.2, 1.5], [42.2, -0.7], 120],
  ['west run head-on (mid)', [41.6, 8.0], [41.6, 12.0], 180],
  ['west run slant 20° to the house', [43.5, 8.3], [36.0, 11.0], 240],
  ['along the west run to the house', [43.8, 8.45], [35.5, 8.8], 240],
  ['along the rope from the bench to the house', [47.0, 8.2], [35.5, 9.2], 420],
  ['small house back corner from the green', [39.8, 7.0], [38.3, 11.0], 180],
  ['east run head-on from the lookout', [49.8, 6.9], [54.0, 6.9], 180],
  ['east run slant into the corner', [49.6, 6.2], [54.0, 9.6], 240],
  ['along the east run inland', [50.3, 7.6], [51.2, 2.5], 240],
];
// footstep walks: [name, points]
const WALKS = [
  ['lane: stair head to the green', [[17.6, -7.35], [19.8, -6.55], [22.3, -5.7], [24.35, -4.3], [26.6, -3.95], [28.9, -4.3], [31.3, -4.5], [33.7, -4.45], [35.48, -3.45], [38.27, -1.52], [41.03, -1.8], [42.6, -0.3]]],
  ['deck: lane, steps, strip, far end and back', [[42.6, -0.3], [43.0, 2.3], [44.6, 2.45], [45.59, 2.45], [47.33, 2.4], [49.9, 2.2], [47.4, 2.36], [45.59, 2.45], [43.2, 2.3]]],
  ['green lawn off the discs', [[40.0, 2.5], [41.5, 4.5], [40.0, 5.5]]],
];
const DECK = { steps: [[45.59, 2.45], [47.33, 2.4]], strip: [[47.25, 2.19], [49.92, 2.10]] };

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
const results = { dist, started: new Date().toISOString() };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.waitForFunction(() => {
    const l = document.getElementById('loading');
    return !l || getComputedStyle(l).opacity === '0';
  }, { timeout: READY_TIMEOUT_MS });
  log('world ready');
  const keysDown = new Set();
  const setKeys = async (w) => {
    for (const k of [...keysDown]) if (!w.has(k)) (await page.keyboard.up(k), keysDown.delete(k));
    for (const k of w) if (!keysDown.has(k)) (await page.keyboard.down(k), keysDown.add(k));
  };
  const keysToward = (st, tx, tz) => {
    const [x, , z] = st.link;
    const dist = Math.hypot(tx - x, tz - z) || 1;
    const d = st.camera.direction;
    const c = Math.atan2(d[0], d[2]);
    const wx = (tx - x) / dist;
    const wz = (tz - z) / dist;
    const a = wx * Math.sin(c) + wz * Math.cos(c);
    const b = wx * -Math.cos(c) + wz * Math.sin(c);
    const w = new Set();
    if (a > 0.38) w.add('KeyW');
    if (a < -0.38) w.add('KeyS');
    if (b > 0.38) w.add('KeyD');
    if (b < -0.38) w.add('KeyA');
    return w;
  };
  const step3 = () =>
    page.evaluate((dt) => {
      const P = window.__ZR_PLAY__;
      const rows = [];
      for (let i = 0; i < 3; i++) {
        P.step(1, dt, false);
        const s = P.state();
        rows.push({ link: s.link, cam: s.camera.position, follow: s.follow });
      }
      return rows;
    }, DT);

  if (want('pushes')) {
    results.pushes = [];
    for (const [name, start, target, frames] of PUSHES) {
      await page.evaluate(([x, z, yaw]) => {
        window.__ZR_PLAY__.setPlayMode?.(true);
        window.__ZR_PLAY__.place(x, z, yaw);
      }, [start[0], start[1], Math.atan2(target[0] - start[0], target[1] - start[1])]);
      await page.evaluate((dt) => window.__ZR_PLAY__.step(10, dt, false), DT);
      const st0 = await page.evaluate(() => window.__ZR_PLAY__.state());
      const y0 = st0.link[1];
      let minFence = Infinity;
      let minY = y0;
      const trace = [];
      for (let f = 0; f < frames; f += 3) {
        const st = await page.evaluate(() => window.__ZR_PLAY__.state());
        await setKeys(keysToward(st, target[0], target[1]));
        const rows = await step3();
        for (const r of rows) {
          minFence = Math.min(minFence, fenceDist(r.link[0], r.link[2]));
          minY = Math.min(minY, r.link[1]);
        }
        trace.push(rows[2].link.map((v) => +v.toFixed(2)));
      }
      await setKeys(new Set());
      const end = trace[trace.length - 1];
      const row = { name, start, target, startY: +y0.toFixed(2), end, dropM: +(y0 - minY).toFixed(2), minFenceM: +minFence.toFixed(3), fenceSideEnd: +fenceDist(end[0], end[2]).toFixed(2), trace: trace.filter((_, i) => i % 5 === 0) };
      results.pushes.push(row);
      log(`push ${name}: end ${end.join(', ')}, drop ${row.dropM} m, closest to fence/stumps ${row.minFenceM} m`);
      fs.writeFileSync(path.join(out, 'east-play.json'), JSON.stringify(results, null, 1));
    }
  }

  if (want('steps')) {
    // the live audio starts on a gesture (M twice leaves it unmuted)
    for (let i = 0; i < 2; i++) {
      await page.keyboard.down('KeyM');
      await page.keyboard.up('KeyM');
    }
    await new Promise((r) => setTimeout(r, 1200));
    results.audioState = await page.evaluate(() => window.__ZR_AUDIO__?.stats()?.state ?? null);
    results.steps = [];
    for (const [name, pts] of WALKS) {
      await page.evaluate(([x, z, yaw]) => {
        window.__ZR_PLAY__.setPlayMode?.(true);
        window.__ZR_PLAY__.place(x, z, yaw);
      }, [pts[0][0], pts[0][1], Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])]);
      await page.evaluate((dt) => window.__ZR_PLAY__.step(10, dt, false), DT);
      let wp = 1;
      let frames = 0;
      const heard = [];
      let lastSteps = await page.evaluate(() => window.__ZR_AUDIO__.stats().steps);
      while (wp < pts.length && frames < 1800) {
        const st = await page.evaluate(() => window.__ZR_PLAY__.state());
        const [x, , z] = st.link;
        if (Math.hypot(pts[wp][0] - x, pts[wp][1] - z) < 0.5) {
          wp++;
          continue;
        }
        await setKeys(keysToward(st, pts[wp][0], pts[wp][1]));
        // real time between frames so the audio clock runs with the steps
        const r = await page.evaluate(async (dt) => {
          const P = window.__ZR_PLAY__;
          const A = window.__ZR_AUDIO__;
          const got = [];
          for (let i = 0; i < 2; i++) {
            P.step(1, dt, false);
            await new Promise((res) => requestAnimationFrame(res));
            const s = A.stats();
            got.push({ steps: s.steps, last: s.lastSurface, link: P.state().link });
          }
          return got;
        }, DT);
        for (const g of r) {
          if (g.steps > lastSteps) heard.push({ at: g.link.map((v) => +v.toFixed(2)), surface: g.last });
          lastSteps = g.steps;
        }
        frames += 2;
      }
      await setKeys(new Set());
      const tally = {};
      for (const h of heard) tally[h.surface] = (tally[h.surface] ?? 0) + 1;
      results.steps.push({ name, reached: wp >= pts.length, steps: heard.length, tally, heard });
      log(`steps ${name}: ${JSON.stringify(tally)}`);
      fs.writeFileSync(path.join(out, 'east-play.json'), JSON.stringify(results, null, 1));
    }
  }
  if (want('camwalks')) {
    // the playtest's two turn-around routes, every frame's camera: its jump, its pop (the frame's second
    // difference — what a snap adds over smooth motion), the follow camera's keep / hit, its clearance
    // from the three east trunks (horizontal distance to the axis minus the radius) and over the walked
    // ground under it (P.ground: terrain, discs, the deck's planks) — plus rendered frames at the turn
    // (arrival, +12, +24 frames) as pictures of where the camera stands.
    const TRUNKS = [['east-shop', 40.0, -7.0, 3.0], ['east-tall', 48.6, -1.6, 3.0], ['east-small', 37.2, 6.0, 2.1]];
    const CAM_WALKS = [
      ['east-tall-deck', [[42.6, -0.3], [43.0, 2.3], [44.6, 2.45], [45.59, 2.45], [47.33, 2.4], [49.9, 2.2], [47.4, 2.36], [45.59, 2.45], [43.2, 2.3]], 6],
      ['east-small-door', [[38.27, -1.52], [37.65, -0.05], [37.0, 1.4], [35.96, 2.14], [37.0, 1.4], [38.27, -1.52]], 4],
    ];
    const canvas = await page.$('canvas');
    results.camWalks = [];
    for (const [name, pts, turnWp] of CAM_WALKS) {
      await page.evaluate(([x, z, yaw]) => {
        window.__ZR_PLAY__.setPlayMode?.(true);
        window.__ZR_PLAY__.place(x, z, yaw);
      }, [pts[0][0], pts[0][1], Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])]);
      await page.evaluate((dt) => window.__ZR_PLAY__.step(15, dt, false), DT);
      let wp = 1;
      let frames = 0;
      let turnAt = -1;
      const rows = [];
      const shots = [];
      while (wp < pts.length && frames < 900) {
        const st = await page.evaluate(() => window.__ZR_PLAY__.state());
        const [x, , z] = st.link;
        if (Math.hypot(pts[wp][0] - x, pts[wp][1] - z) < 0.5) {
          wp++;
          if (wp === turnWp) turnAt = frames;
          continue;
        }
        await setKeys(keysToward(st, pts[wp][0], pts[wp][1]));
        const shotNow = turnAt >= 0 && [0, 12, 24].some((k) => frames - turnAt >= k && !shots.some((s) => s.k === k));
        const got = await page.evaluate(([dt, render]) => {
          const P = window.__ZR_PLAY__;
          const o = [];
          for (let i = 0; i < 3; i++) {
            P.step(1, dt, render && i === 2);
            const s = P.state();
            const c = s.camera.position;
            o.push({ link: s.link, cam: c, walkUnderCam: P.ground(c[0], c[2]).walk, follow: s.follow });
          }
          return o;
        }, [DT, shotNow]);
        rows.push(...got);
        frames += 3;
        if (shotNow) {
          const k = [0, 12, 24].find((kk) => frames - 3 - turnAt >= kk && !shots.some((s) => s.k === kk));
          const file = `cam-${name}-turn+${k}.png`;
          fs.writeFileSync(path.join(out, file), await canvas.screenshot({ type: 'png' }));
          const r = got[2];
          shots.push({ k, file, link: r.link.map((v) => +v.toFixed(2)), cam: r.cam.map((v) => +v.toFixed(2)), keep: r.follow?.keep ?? null, hit: r.follow?.hit ?? null });
        }
      }
      await setKeys(new Set());
      let maxJump = 0;
      let maxPop = 0;
      let popAt = null;
      let minTrunk = Infinity;
      let trunkAt = null;
      let minClear = Infinity;
      let minKeep = Infinity;
      const hits = {};
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (i > 0) maxJump = Math.max(maxJump, Math.hypot(...r.cam.map((v, j) => v - rows[i - 1].cam[j])));
        if (i > 0 && i < rows.length - 1) {
          const pop = Math.hypot(...r.cam.map((v, j) => rows[i + 1].cam[j] - 2 * v + rows[i - 1].cam[j]));
          if (pop > maxPop) (maxPop = pop), (popAt = { link: r.link.map((v) => +v.toFixed(2)), cam: r.cam.map((v) => +v.toFixed(2)), keep: r.follow?.keep ?? null, hit: r.follow?.hit ?? null });
        }
        for (const [id, tx, tz, tr] of TRUNKS) {
          const d = Math.hypot(r.cam[0] - tx, r.cam[2] - tz) - tr;
          if (d < minTrunk) (minTrunk = d), (trunkAt = { trunk: id, cam: r.cam.map((v) => +v.toFixed(2)) });
        }
        minClear = Math.min(minClear, r.cam[1] - r.walkUnderCam);
        if (typeof r.follow?.keep === 'number') minKeep = Math.min(minKeep, r.follow.keep);
        const h = r.follow?.hit ?? 'none';
        hits[h] = (hits[h] ?? 0) + 1;
      }
      const row = { name, reached: wp >= pts.length, frames: rows.length, maxJumpM: +maxJump.toFixed(3), maxPopM: +maxPop.toFixed(3), popAt, minTrunkClearM: +minTrunk.toFixed(2), trunkAt, minAboveWalkM: +minClear.toFixed(2), minKeep: Number.isFinite(minKeep) ? +minKeep.toFixed(3) : null, hits, shots };
      results.camWalks.push(row);
      log(`camera ${name}: reached ${row.reached}, max jump ${row.maxJumpM} m, max pop ${row.maxPopM} m, trunk clearance ${row.minTrunkClearM} m (${trunkAt?.trunk}), over the walk ${row.minAboveWalkM} m, min keep ${row.minKeep}, hits ${JSON.stringify(hits)}, shots ${shots.length}`);
      fs.writeFileSync(path.join(out, 'east-play.json'), JSON.stringify(results, null, 1));
    }
  }
  results.pageErrors = errors;
} finally {
  await browser.close();
  server.close();
}
results.finished = new Date().toISOString();
fs.writeFileSync(path.join(out, 'east-play.json'), JSON.stringify(results, null, 1));
log(`done → ${path.join(out, 'east-play.json')}`);
