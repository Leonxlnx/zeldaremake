#!/usr/bin/env node
/**
 * exp-south2 evidence: what the south exit costs and how it walks, one Chrome per run.
 *
 *   node art/environment/exp-south2-2026-09-24/evidence.mjs --dist dist --out /tmp/e --poses art/environment/exp-south2-2026-09-24/poses.json [--play] [--walks] [--capture] [--heroes] [--ab]
 *   node art/environment/exp-south2-2026-09-24/evidence.mjs --compare /tmp/e-canonical/png --with /tmp/e-branch/png [--names A_stairs,...]
 *   node art/environment/exp-south2-2026-09-24/evidence.mjs --sheet /tmp/e/png --names a,b,c --cols 3 --sheet-out sheet.jpg [--labels "x|y|z"]
 *
 * --play     play mode (`?test=1`). Poses with a `player` placement ([x, z] facing `toward`): Link
 *            placed at rest, 45 frames simulated, 3 drawn, then the renderer's counts (Link drawn,
 *            shadow pass included) with the far-bank LOD on, and with `--ab` off and on again
 *            (`globalThis.__KF_FARBANK_OFF__`, util/farBankLocality.ts); the follow camera's pose is
 *            written back as the pose's `from` (`out/poses.resolved.json`). Poses with `eye` / `look`
 *            ([x, z, metres over the walk height at x, z — or at [rx, rz] when given]) resolve here.
 * --walks    play mode: the south routes steered with the movement keys as playtest.mjs steers them,
 *            a frame drawn every `--draw-every` simulated frames (the walking views' counts), the
 *            camera checked every frame against the log's bark shell, the keeper's hut, the space
 *            under his gallery and the waystation's walls and floor, Link's height (falls), and the
 *            footstep surface (audio `surfaceAt`) along his trace against what he stands on.
 * --capture  capture mode (character hidden): the six fixed viewpoints (`--heroes`) and every pose
 *            with a `from`, each from simulation time 12.5 s + `--settle` frames; with `--ab` read
 *            LOD on, off, on again from the same time, the off and again frames compared with the
 *            first on frame. The on frames go to `out/png/`. Poses marked `exit` (their target is the
 *            log's far end) get the luminance of the far end's disc on screen.
 * --ab play | --ab capture   the A/B reads in that phase only (a pose's `ab: false` skips both).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import ts from 'typescript';
import { launchBrowser, openWorld, serveStatic } from '../../../gauntlet/scripts/lib/browser.mjs';
import { ssim, toGray } from '../../../gauntlet/scripts/lib/image.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../../..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const [W, H] = String(args.size ?? '960x540').split('x').map(Number);
const SETTLE = Number(args.settle ?? 6);
const DRAW_EVERY = Number(args['draw-every'] ?? 24);
const AB = { play: args.ab === true || args.ab === 'play', capture: args.ab === true || args.ab === 'capture' };
const DT = 1 / 30;
const log = (...m) => console.error(`[south2 ${new Date().toISOString().slice(11, 19)}]`, ...m);

// ---------------------------------------------------------------- the layout, read from the source
const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (fs.existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const { EXPANSION_SOUTH: S, EXPANSION_SOUTH_DWELLINGS: D } = loadTs(path.join(root, 'src/world/layout.ts'));
const { inFarBankZone } = loadTs(path.join(root, 'src/world/util/farBankLocality.ts'));
const { surfaceAt } = loadTs(path.join(root, 'src/audio/index.ts'));

const rad = (d) => (d * Math.PI) / 180;
const bridgeLen = Math.hypot(S.bridge.south[0] - S.bridge.north[0], S.bridge.south[1] - S.bridge.north[1]);
const bx = (S.bridge.south[0] - S.bridge.north[0]) / bridgeLen;
const bz = (S.bridge.south[1] - S.bridge.north[1]) / bridgeLen;
const tl = Math.hypot(S.tunnel.dir[0], S.tunnel.dir[1]);
const tx = S.tunnel.dir[0] / tl;
const tz = S.tunnel.dir[1] / tl;
const bridgeAt = (a, c = 0) => [S.bridge.north[0] + bx * a - bz * c, S.bridge.north[1] + bz * a + bx * c];
const logAt = (a, c = 0) => [S.tunnel.mouth[0] + tx * a - tz * c, S.tunnel.mouth[1] + tz * a + tx * c];
const K = D.keeper;
const WS = D.waystation;
const keeperAt = (deg, r) => [K.centre[0] + Math.cos(rad(deg)) * r, K.centre[1] + Math.sin(rad(deg)) * r];
const wF = [Math.sin(rad(WS.facingDeg)), Math.cos(rad(WS.facingDeg))];
const waystationAt = (a, s) => [WS.centre[0] + wF[0] * a + wF[1] * s, WS.centre[1] + wF[1] * a - wF[0] * s];

/** the routes playtest.mjs walks through the south exit (the same waypoints) */
const ROUTES = {
  'south-bridge-to-log': [[[0.5, 3], [0.8, 10], [1, 16], [-0.5, 17.2], [-1.2, 19.4], [-1.32, 21.6], [-0.8, 23.55], [0.4, 25.15], [2.0, 26.55], [3.3, 27.9], [3.68, 28.95], bridgeAt(-0.6), bridgeAt(1.4), bridgeAt(4.1), bridgeAt(6.9), bridgeAt(9.8), bridgeAt(12.2), bridgeAt(bridgeLen + 0.5), [4.14, 45.2], logAt(0), logAt(2), logAt(4.8)], 2400],
  'south-dwellings': [[[3.3, 27.9], [3.9, 26.6], waystationAt(0.79, 0), [...waystationAt(0.3, 0), { within: 0.2, y: WS.floorY }], [...waystationAt(0.3, 0.5), { within: 0.25, y: WS.floorY }], waystationAt(1.09, 0.3), [3.9, 27.4], [4.3, 29.0], [5.1, 30.1], keeperAt(221, 2.0), keeperAt(200, 1.7), keeperAt(170, 1.7), keeperAt(135, 1.7), keeperAt(100, 1.7), keeperAt(60, 1.7), keeperAt(20, 1.7), keeperAt(-8, 1.7), keeperAt(-20.5, 1.86), [9.35, 31.0], [9.0, 30.0], [8.0, 29.35], [6.6, 29.2], [5.6, 28.55], [3.68, 28.95]], 2400],
  'south-log-to-village': [[logAt(4.8), logAt(2), logAt(0), [4.14, 45.2], bridgeAt(bridgeLen + 0.5), bridgeAt(12.2), bridgeAt(9.8), bridgeAt(6.9), bridgeAt(4.1), bridgeAt(1.4), bridgeAt(-0.6), [3.68, 28.95], [3.3, 27.9], [2.0, 26.55], [0.4, 25.15], [-0.8, 23.55], [-1.32, 21.6], [-1.2, 19.4], [-0.5, 17.2], [1, 16], [0.8, 10], [0.5, 3]], 2400],
};

// ---------------------------------------------------------------- the camera against the solids
/**
 * Where a camera at `c` stands inside one of the south exit's solids, or null. `logFloor` is the
 * log's walked floor (the axis is `axisY` over it). The log: in its bark between the hollow and the
 * outside, along its length. The keeper's hut: within its wall, under the top of its cap. The
 * gallery: under its boards, anywhere on its arc. The waystation: in the back or north palisade
 * (the pole line ± 7.5 cm, over its height) or under its floor.
 */
function insideSolid(c, logFloor) {
  const T = S.tunnel;
  {
    const dx = c[0] - T.mouth[0];
    const dz = c[2] - T.mouth[1];
    const u = dx * tx + dz * tz;
    const v = -dx * tz + dz * tx;
    const h = c[1] - (logFloor + T.axisY);
    const r = Math.hypot(v, h);
    if (u > 0 && u < T.length && r > T.innerRadius - 0.02 && r < T.outerRadius) return 'log-shell';
  }
  {
    const r = Math.hypot(c[0] - K.centre[0], c[2] - K.centre[1]);
    if (r < K.radius + 0.02 && c[1] < K.floorY + K.wall + K.capHeight) return 'keeper-hut';
    const th = (Math.atan2(c[2] - K.centre[1], c[0] - K.centre[0]) * 180) / Math.PI;
    const onArc = ((((th - K.gallery.from) % 360) + 360) % 360) <= K.gallery.to - K.gallery.from;
    if (onArc && r >= K.radius && r < K.gallery.outer && c[1] < K.floorY + 0.03 && c[1] > K.floorY - 2.5) return 'under-gallery';
  }
  {
    const dx = c[0] - WS.centre[0];
    const dz = c[2] - WS.centre[1];
    const a = dx * wF[0] + dz * wF[1];
    const s = dx * wF[1] - dz * wF[0];
    const HD = WS.depth / 2;
    const HW = WS.width / 2;
    const backA = -(HD - 0.055) - 0.005;
    const northS = -(HW - 0.08) - 0.005;
    if (Math.abs(a - backA) < 0.075 && Math.abs(s) < HW - 0.08 && c[1] > WS.floorY - 0.12 && c[1] < WS.floorY + WS.backHeight) return 'waystation-back-wall';
    if (Math.abs(s - northS) < 0.075 && Math.abs(a) < HD - 0.055 && c[1] > WS.floorY - 0.5 && c[1] < WS.floorY + WS.northHeight + 0.03) return 'waystation-north-wall';
    if (Math.abs(a) < HD && Math.abs(s) < HW && c[1] < WS.floorY && c[1] > WS.floorY - 0.6) return 'under-waystation-floor';
  }
  return null;
}

// ---------------------------------------------------------------- pages
async function openPlay(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && log(`[page:error] ${m.text()}`));
  await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
  const t0 = Date.now();
  await page.goto(`${url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => {
    window.__zrReadyState = 'pending';
    Promise.resolve(window.__ZR__.ready()).then(
      () => (window.__zrReadyState = 'ready'),
      (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`),
    );
  });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  log(`play page ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return page;
}

const ground = (page, x, z) => page.evaluate(([x, z]) => window.__ZR_PLAY__.ground(x, z), [x, z]);
const counts = (st) => ({ draws: st.render.calls, triangles: st.render.triangles });

async function playPoses(page, poses, result, out) {
  const resolved = [];
  for (const p of poses) {
    const r = { ...p };
    if (p.eye) {
      const e = await ground(page, p.eye[3] ?? p.eye[0], p.eye[4] ?? p.eye[1]);
      const l = await ground(page, p.look[3] ?? p.look[0], p.look[4] ?? p.look[1]);
      r.from = { p: [p.eye[0], +(e.walk + p.eye[2]).toFixed(3), p.eye[1]], t: [p.look[0], +(l.walk + p.look[2]).toFixed(3), p.look[1]], fov: p.fov ?? 46 };
    }
    if (p.player) {
      log(`play pose ${p.name}`);
      const yaw = Math.atan2(p.toward[0] - p.player[0], p.toward[1] - p.player[1]);
      await page.evaluate(([x, z, yaw]) => {
        globalThis.__KF_FARBANK_OFF__ = undefined;
        window.__ZR_PLAY__.place(x, z, yaw);
      }, [p.player[0], p.player[1], yaw]);
      await page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, false), [45, DT]);
      const read = async (off) => {
        await page.evaluate((off) => (globalThis.__KF_FARBANK_OFF__ = off ? true : undefined), off);
        await page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, true), [3, DT]);
        return page.evaluate(() => window.__ZR_PLAY__.state());
      };
      const on = await read(false);
      fs.writeFileSync(path.join(out, 'png', `play-${p.name}.png`), await page.screenshot({ type: 'png' }));
      const c = on.camera;
      const row = { name: p.name, link: on.link.map((v) => +v.toFixed(3)), air: on.air, camera: c.position.map((v) => +v.toFixed(3)), cameraInZone: inFarBankZone(...c.position), on: counts(on) };
      if (AB.play && p.ab !== false) {
        row.off = counts(await read(true));
        row.again = counts(await read(false));
      }
      r.from = { p: c.position.map((v) => +v.toFixed(3)), t: c.position.map((v, i) => +(v + c.direction[i] * 20).toFixed(3)), fov: c.fov };
      result.play.push(row);
      log(`  ${row.on.draws} draws / ${(row.on.triangles / 1e6).toFixed(2)} M${row.off ? `, off ${row.off.draws} / ${(row.off.triangles / 1e6).toFixed(2)} M, again ${row.again.draws} / ${(row.again.triangles / 1e6).toFixed(2)} M` : ''}${row.cameraInZone ? ' (camera in the far-bank zone)' : ''}`);
    }
    resolved.push(r);
  }
  await page.evaluate(() => (globalThis.__KF_FARBANK_OFF__ = undefined));
  return resolved;
}

/** steer Link through the waypoints with the movement keys (camera-relative), as playtest.mjs walkRoute does */
async function walk(page, name, points, maxFrames) {
  const keysDown = new Set();
  const setKeys = async (want) => {
    for (const k of [...keysDown]) if (!want.has(k)) (await page.keyboard.up(k), keysDown.delete(k));
    for (const k of want) if (!keysDown.has(k)) (await page.keyboard.down(k), keysDown.add(k));
  };
  const [first, second] = points;
  await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, yaw), [first[0], first[1], Math.atan2(second[0] - first[0], second[1] - first[1])]);
  await page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, false), [15, DT]);
  let wp = 1;
  let frames = 0;
  let lastProgressAt = 0;
  let best = Infinity;
  const stuck = [];
  const rows = [];
  while (wp < points.length && frames < maxFrames) {
    const st = await page.evaluate(() => window.__ZR_PLAY__.state());
    const [x, , z] = st.link;
    const [gx, gz, need] = points[wp];
    const dist = Math.hypot(gx - x, gz - z);
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
      stuck.push({ at: st.link.map((v) => +v.toFixed(2)), toward: points[wp].slice(0, 2).map((v) => +v.toFixed(2)), frame: frames });
      wp++;
      best = Infinity;
      lastProgressAt = frames;
      continue;
    }
    const d = st.camera.direction;
    const cy = Math.atan2(d[0], d[2]);
    const wx = (gx - x) / dist;
    const wz = (gz - z) / dist;
    const a = wx * Math.sin(cy) + wz * Math.cos(cy);
    const b = wx * -Math.cos(cy) + wz * Math.sin(cy);
    const want = new Set();
    if (a > 0.38) want.add('KeyW');
    if (a < -0.38) want.add('KeyS');
    if (b > 0.38) want.add('KeyD');
    if (b < -0.38) want.add('KeyA');
    await setKeys(want);
    rows.push(
      ...(await page.evaluate(
        ([n, dt, drawFirst]) => {
          const P = window.__ZR_PLAY__;
          const out = [];
          for (let i = 0; i < n; i++) {
            const drawn = drawFirst && i === 0;
            P.step(1, dt, drawn);
            const s = P.state();
            out.push({ link: s.link, air: s.air, cam: s.camera.position, dir: s.camera.direction, camGround: s.groundUnderCamera, feet: s.feet, slimPush: s.follow?.slimPush ?? 0, drawn, calls: drawn ? s.render.calls : null, triangles: drawn ? s.render.triangles : null });
          }
          return out;
        },
        [3, DT, frames % DRAW_EVERY === 0],
      )),
    );
    frames += 3;
  }
  await setKeys(new Set());
  return { reached: wp >= points.length && stuck.length === 0, waypointsReached: wp - 1, of: points.length - 1, frames, stuck, rows };
}

async function walks(page, result) {
  const logFloor = (await ground(page, ...logAt(2))).walk;
  const pick = typeof args.routes === 'string' ? new Set(args.routes.split(',')) : null;
  for (const [name, [points, maxFrames]] of Object.entries(ROUTES)) {
    if (pick && !pick.has(name)) continue;
    log(`walk ${name}`);
    const w = await walk(page, name, points, maxFrames);
    // the camera against the solids and the ground, every simulated frame
    const inside = {};
    let minAbove = Infinity;
    for (const r of w.rows) {
      const hit = insideSolid(r.cam, logFloor);
      if (hit) (inside[hit] ??= []).push({ cam: r.cam.map((v) => +v.toFixed(2)), link: r.link.map((v) => +v.toFixed(2)) });
      minAbove = Math.min(minAbove, r.cam[1] - r.camGround);
    }
    // the camera's pop (the change of its per-frame step, as walls.test.mjs measures it) and its largest
    // one-frame move, after the first 15 frames' snap; the boots' largest gap over the surface in stance
    const r2 = (v) => v.map((x) => +x.toFixed(2));
    let pop = { m: 0 };
    let jump = { m: 0 };
    for (let i = 15; i < w.rows.length; i++) {
      const [a, b, c] = [w.rows[i - 2].cam, w.rows[i - 1].cam, w.rows[i].cam];
      const p = Math.hypot(c[0] - 2 * b[0] + a[0], c[1] - 2 * b[1] + a[1], c[2] - 2 * b[2] + a[2]);
      const j = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
      if (p > pop.m) pop = { m: +p.toFixed(3), link: r2(w.rows[i].link), cam: r2(c), slimPush: +w.rows[i].slimPush.toFixed(3) };
      if (j > jump.m) jump = { m: +j.toFixed(3), link: r2(w.rows[i].link), cam: r2(c), slimPush: +w.rows[i].slimPush.toFixed(3) };
    }
    let foot = { gapM: 0 };
    const gaps = [];
    for (const r of w.rows) for (const f of r.feet ?? []) {
      if (!f.stance) continue;
      gaps.push(Math.abs(f.gapM));
      if (Math.abs(f.gapM) > foot.gapM) foot = { gapM: +Math.abs(f.gapM).toFixed(3), link: r2(r.link), air: +r.air.toFixed(3) };
    }
    gaps.sort((p, q) => p - q);
    const footOver = (t) => {
      const at = w.rows.filter((r) => (r.feet ?? []).some((f) => f.stance && Math.abs(f.gapM) > t)).map((r) => r2(r.link));
      return { frames: at.length, first: at.slice(0, 12) };
    };
    // Link's height and the footsteps: every third frame's position, the character's ground there
    const trace = w.rows.filter((_, i) => i % 3 === 0).map((r) => r.link);
    const grounds = await page.evaluate((pts) => pts.map(([x, , z]) => window.__ZR_PLAY__.ground(x, z)), trace);
    const runs = [];
    const wrong = [];
    let walked = 0;
    for (let i = 0; i < trace.length; i++) {
      const [x, y, z] = trace[i];
      const step = i ? Math.hypot(x - trace[i - 1][0], z - trace[i - 1][2]) : 0;
      walked += step;
      const surface = surfaceAt(x, z).surface;
      const g = grounds[i];
      const raised = g.walk - g.terrain;
      // standing on something built (≥ 6 cm over the terrain) must sound built; bare ground must not
      const builtSound = surface === 'wood' || surface === 'bridge' || surface === 'hollow';
      if ((raised >= 0.06 && !builtSound && surface !== 'stone') || (raised < 0.02 && builtSound)) wrong.push({ at: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], surface, raisedM: +raised.toFixed(3) });
      if (runs.length && runs.at(-1).surface === surface) runs.at(-1).metres += step;
      else runs.push({ surface, metres: 0, from: [+x.toFixed(1), +z.toFixed(1)] });
    }
    for (const r of runs) r.metres = +r.metres.toFixed(1);
    const drawn = w.rows.filter((r) => r.drawn);
    const worst = drawn.reduce((m, r) => (!m || r.calls > m.calls ? r : m), null);
    const heaviest = drawn.reduce((m, r) => (!m || r.triangles > m.triangles ? r : m), null);
    const lowest = w.rows.reduce((m, r) => Math.min(m, r.link[1]), Infinity);
    const row = {
      name,
      reached: w.reached,
      waypointsReached: w.waypointsReached,
      of: w.of,
      frames: w.frames,
      stuck: w.stuck,
      lengthM: +walked.toFixed(1),
      lowestGroundY: +lowest.toFixed(2),
      maxAirM: +Math.max(...w.rows.map((r) => r.air)).toFixed(3),
      minCameraAboveGroundM: +minAbove.toFixed(3),
      cameraPop: pop,
      cameraJump: jump,
      soleGap: gaps.length ? { p50: +gaps[Math.floor(gaps.length / 2)].toFixed(4), p95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(4), worst: foot, framesOver10cm: footOver(0.1) } : null,
      cameraInside: Object.fromEntries(Object.entries(inside).map(([k, v]) => [k, { frames: v.length, first: v.slice(0, 3) }])),
      drawnFrames: drawn.length,
      maxDraws: worst ? { draws: worst.calls, triangles: worst.triangles, link: worst.link.map((v) => +v.toFixed(2)), cam: worst.cam.map((v) => +v.toFixed(2)), inZone: inFarBankZone(...worst.cam) } : null,
      maxTriangles: heaviest ? { draws: heaviest.calls, triangles: heaviest.triangles, link: heaviest.link.map((v) => +v.toFixed(2)), cam: heaviest.cam.map((v) => +v.toFixed(2)), inZone: inFarBankZone(...heaviest.cam) } : null,
      overBudget: drawn.filter((r) => r.calls > 700 || r.triangles > 9e6).map((r) => ({ draws: r.calls, triangles: r.triangles, link: r.link.map((v) => +v.toFixed(2)), cam: r.cam.map((v) => +v.toFixed(2)) })),
      footsteps: runs,
      footstepMismatches: wrong,
      drawnSamples: drawn.map((r) => [r.calls, r.triangles, +r.link[0].toFixed(2), +r.link[2].toFixed(2)]),
    };
    result.walks.push(row);
    log(`  reached ${row.reached} (${row.waypointsReached}/${row.of}), stuck ${row.stuck.length}, lowest ground ${row.lowestGroundY}, camera inside ${JSON.stringify(Object.fromEntries(Object.entries(row.cameraInside).map(([k, v]) => [k, v.frames])))}, max ${row.maxDraws?.draws} draws / ${((row.maxTriangles?.triangles ?? 0) / 1e6).toFixed(2)} M over ${row.drawnFrames} drawn frames, ${row.footstepMismatches.length} footstep mismatches`);
  }
}

// ---------------------------------------------------------------- capture
async function pixelDiff(a, b) {
  const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let changed = 0;
  let max = 0;
  for (let i = 0; i < A.data.length; i += 3) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    if (d > 6) changed++;
    if (d > max) max = d;
  }
  const w = A.info.width;
  const h = A.info.height;
  const s = ssim(await toGray(a, w, h), await toGray(b, w, h), w, h);
  return { changedPx: changed, ofPx: w * h, maxLevels: max, ssim: +s.toFixed(4) };
}

/** Rec. 709 luminance of the log's far-end disc on screen (the pose's target is its centre) */
async function exitStats(png, from) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const dist = Math.hypot(...from.t.map((v, i) => v - from.p[i]));
  const f = info.height / 2 / Math.tan(rad(from.fov) / 2);
  const R = (f * S.tunnel.innerRadius) / dist;
  const cx = info.width / 2;
  const cy = info.height / 2;
  const lum = [];
  let maxChannel = 0;
  let clipped = 0;
  for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(info.height, Math.ceil(cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(info.width, Math.ceil(cx + R)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
      const i = (y * info.width + x) * 3;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      maxChannel = Math.max(maxChannel, r, g, b);
      if (r >= 250 || g >= 250 || b >= 250) clipped++;
    }
  }
  lum.sort((p, q) => p - q);
  const q = (t) => +lum[Math.min(lum.length - 1, Math.floor(t * lum.length))].toFixed(1);
  const mean = lum.reduce((s, v) => s + v, 0) / lum.length;
  const sd = Math.sqrt(lum.reduce((s, v) => s + (v - mean) ** 2, 0) / lum.length);
  return { discRadiusPx: +R.toFixed(1), px: lum.length, p10: q(0.1), p50: q(0.5), p99: q(0.99), peak: q(1), sd: +sd.toFixed(1), maxChannel, clippedShare: +(clipped / lum.length).toFixed(4) };
}

async function capture(browser, url, poses, result, out) {
  const { page } = await openWorld(browser, url, { width: W, height: H, log });
  const canvas = await page.$('canvas');
  result.audit = await page.evaluate(() => {
    const a = window.__ZR__.audit();
    const s = a.systems.structures ?? {};
    return { south: s.south, southDwellings: s.southDwellings, farBank: s.farBank, systemFailures: a.systemFailures };
  });
  const heroes = args.heroes ? await page.evaluate(() => window.__ZR__.viewpoints().filter((v) => !v.diagnostic).map((v) => v.id)) : [];
  const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
  const shots = [...heroes.map((id) => ({ name: id, viewpoint: id })), ...poses.filter((p) => p.from && (!only || only.has(p.name)))];
  for (const s of shots) {
    const read = async (off) => {
      await page.evaluate(({ s, off }) => {
        globalThis.__KF_FARBANK_OFF__ = off ? true : undefined;
        window.__ZR__.setTime(12.5);
        if (s.viewpoint) window.__ZR__.setViewpoint(s.viewpoint);
        else window.__ZR__.setPose(s.from.p, s.from.t, s.from.fov);
      }, { s, off });
      await page.evaluate(async (n) => window.__ZR__.render(n, 1 / 30), SETTLE);
      const st = await page.evaluate(() => window.__ZR__.stats());
      return { draws: st.drawCalls, triangles: st.triangles, png: Buffer.from(await canvas.screenshot({ type: 'png' })) };
    };
    const on = await read(false);
    fs.writeFileSync(path.join(out, 'png', `${s.name}.png`), on.png);
    const pose = s.viewpoint ?? s.from;
    const row = { name: s.name, pose, cameraInZone: s.viewpoint ? false : inFarBankZone(...s.from.p), on: { draws: on.draws, triangles: on.triangles } };
    if (AB.capture && !s.viewpoint && s.ab !== false) {
      const off = await read(true);
      const again = await read(false);
      row.off = { draws: off.draws, triangles: off.triangles };
      row.again = { draws: again.draws, triangles: again.triangles };
      row.offVsOn = await pixelDiff(on.png, off.png);
      row.againVsOn = await pixelDiff(on.png, again.png);
      fs.writeFileSync(path.join(out, 'png', `${s.name}.off.png`), off.png);
    }
    if (s.exit) row.exit = await exitStats(on.png, s.from);
    result.capture.push(row);
    fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 1));
    log(`capture ${s.name}: ${row.on.draws} draws / ${(row.on.triangles / 1e6).toFixed(2)} M${row.off ? ` | off ${row.off.draws} / ${(row.off.triangles / 1e6).toFixed(2)} M (${row.offVsOn.changedPx} px > 6 levels, max ${row.offVsOn.maxLevels}) | again ${row.again.draws} / ${(row.again.triangles / 1e6).toFixed(2)} M (${row.againVsOn.changedPx} px)` : ''}${row.exit ? ` | exit p99 ${row.exit.p99} peak ${row.exit.peak} sd ${row.exit.sd}` : ''}`);
  }
  await page.close();
}

// ---------------------------------------------------------------- offline: compare, sheet
async function compare() {
  const a = path.resolve(args.compare);
  const b = path.resolve(args.with);
  const names = typeof args.names === 'string' ? args.names.split(',') : fs.readdirSync(a).filter((f) => f.endsWith('.png') && !f.endsWith('.off.png')).map((f) => f.slice(0, -4));
  const rows = [];
  for (const n of names) {
    const fa = path.join(a, `${n}.png`);
    const fb = path.join(b, `${n}.png`);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
    rows.push({ name: n, ...(await pixelDiff(fa, fb)) });
    console.log(`${n.padEnd(34)} ${String(rows.at(-1).changedPx).padStart(7)} px > 6 levels (${((100 * rows.at(-1).changedPx) / rows.at(-1).ofPx).toFixed(2)} %), max ${rows.at(-1).maxLevels}, SSIM ${rows.at(-1).ssim}`);
  }
  if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify(rows, null, 1));
}

async function sheet() {
  const dir = path.resolve(args.sheet);
  const names = String(args.names).split(',');
  const labels = typeof args.labels === 'string' ? args.labels.split('|') : names;
  const cols = Number(args.cols ?? 3);
  const tw = Number(args['tile-width'] ?? 480);
  const th = Math.round((tw * H) / W);
  const rowsN = Math.ceil(names.length / cols);
  const tiles = [];
  for (let i = 0; i < names.length; i++) {
    const img = await sharp(path.join(dir, `${names[i]}.png`)).resize(tw, th).toBuffer();
    const esc = labels[i].replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = Buffer.from(`<svg width="${tw}" height="24"><rect width="${tw}" height="24" fill="black" fill-opacity="0.55"/><text x="8" y="17" font-family="sans-serif" font-size="14" fill="white">${esc}</text></svg>`);
    tiles.push({ input: img, left: (i % cols) * tw, top: Math.floor(i / cols) * th });
    tiles.push({ input: svg, left: (i % cols) * tw, top: Math.floor(i / cols) * th });
  }
  await sharp({ create: { width: cols * tw, height: rowsN * th, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite(tiles)
    .jpeg({ quality: Number(args.quality ?? 78), mozjpeg: true })
    .toFile(path.resolve(args['sheet-out']));
  console.log(`${args['sheet-out']}: ${fs.statSync(path.resolve(args['sheet-out'])).size} bytes`);
}

/** the solid checks fire where they should and nowhere near the walked lines (the log floor at y 0 here) */
function selftest() {
  const T = S.tunnel;
  const xyz = ([x, z], y) => [x, y, z];
  const bark = (T.innerRadius + T.outerRadius) / 2;
  const cases = [
    ['log hollow, on the axis', xyz(logAt(3), T.axisY), null],
    ['log bark, above the hollow', xyz(logAt(3), T.axisY + bark), 'log-shell'],
    ['log bark, beside the hollow', xyz(logAt(3, bark), T.axisY), 'log-shell'],
    ['before the mouth', xyz(logAt(-1), T.axisY + 1.8), null],
    ["keeper's hut, inside", xyz([K.centre[0] + 0.5, K.centre[1]], 1.2), 'keeper-hut'],
    ["keeper's hut, over the cap", xyz(K.centre, K.floorY + K.wall + K.capHeight + 0.3), null],
    ['under the gallery at 100°', xyz(keeperAt(100, 1.7), K.floorY - 0.4), 'under-gallery'],
    ['over the gallery at 100°', xyz(keeperAt(100, 1.7), K.floorY + 1.6), null],
    ['waystation back wall', xyz(waystationAt(-(WS.depth / 2 - 0.055) - 0.005, 0.2), WS.floorY + 0.6), 'waystation-back-wall'],
    ['waystation interior', xyz(waystationAt(0.2, 0.2), WS.floorY + 1.2), null],
    ['waystation north wall', xyz(waystationAt(0, -(WS.width / 2 - 0.08) - 0.005), WS.floorY + 0.8), 'waystation-north-wall'],
  ];
  let bad = 0;
  for (const [what, c, want] of cases) {
    const got = insideSolid(c, 0);
    if (got !== want) bad++;
    console.log(`${got === want ? 'ok ' : 'BAD'} ${what}: ${got}`);
  }
  for (const [x, z, want] of [[...bridgeAt(bridgeLen / 2), 'bridge'], [...logAt(2), 'hollow'], [...keeperAt(100, 1.7), 'bridge'], [...keeperAt(210, 1.7), 'wood'], [...waystationAt(0.2, 0), 'wood']]) {
    const got = surfaceAt(x, z).surface;
    if (got !== want) bad++;
    console.log(`${got === want ? 'ok ' : 'BAD'} footstep at (${x.toFixed(2)}, ${z.toFixed(2)}): ${got}`);
  }
  if (bad) process.exitCode = 1;
}

// ---------------------------------------------------------------- main
if (args.selftest) selftest();
else if (args.compare) await compare();
else if (args.sheet) await sheet();
else {
  const dist = path.resolve(args.dist ?? 'dist');
  const out = path.resolve(args.out ?? '/tmp/south2-evidence');
  fs.mkdirSync(path.join(out, 'png'), { recursive: true });
  let poses = args.poses ? JSON.parse(fs.readFileSync(path.resolve(args.poses), 'utf8')) : [];
  const result = { dist, started: new Date().toISOString(), play: [], walks: [], capture: [] };
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width: W, height: H });
  try {
    if (args.play || args.walks) {
      const page = await openPlay(browser, server.url);
      if (args.play) {
        poses = await playPoses(page, poses, result, out);
        fs.writeFileSync(path.join(out, 'poses.resolved.json'), JSON.stringify(poses, null, 1));
      }
      fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 1));
      if (args.walks) await walks(page, result);
      fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 1));
      await page.close();
    }
    if (args.capture) await capture(browser, server.url, poses, result, out);
  } finally {
    await browser.close();
    server.close();
  }
  result.finished = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 1));
}
