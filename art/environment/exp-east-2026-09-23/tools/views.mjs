#!/usr/bin/env node
// One world load per dist: hero viewpoints A-F and the east lane's walking views — draw calls / triangles
// (renderer.info: colour + shadow + post passes, the pose-counts method: setTime 12.5, settle 6) plus a
// canvas screenshot of each pose (hero diffs, contact sheets), for the exp-east lane.
//   node art/environment/exp-east-2026-09-23/tools/views.mjs --dist <dist> --out <dir> [--only name,...]
//        [--poses poses-updown.json] [--isolate N] [--no-shots]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openWorld, serveStatic } from '../../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const out = path.resolve(args.out ?? '/tmp/east-views');
fs.mkdirSync(out, { recursive: true });
const [width, height] = String(args.size ?? '960x540').split('x').map(Number);
const settle = Number(args.settle ?? 6);
const only = args.only ? new Set(String(args.only).split(',')) : null;
const isolateN = Number(args.isolate ?? 0);
const shots = !args['no-shots'];
const extra = args.poses ? JSON.parse(fs.readFileSync(path.resolve(args.poses), 'utf8')) : [];

const DECK_Y = 6.86;
const onDeck = (x, z) => x > 47.0 && x < 50.1 && z > 1.7 && z < 2.6;
const NAMED = [
  ['stairhead_lane', [17.6, -7.35], [22.3, -5.7]],
  ['lane_mid', [24.35, -4.3], [28.9, -4.3]],
  ['lane_bend', [28.9, -4.3], [33.7, -4.45]],
  ['shop_door', [35.48, -3.45], [37.6, -5.2]],
  ['green_wide', [42.6, -0.3], [30.0, -4.0]],
  ['green_back_sw', [43.2, 4.6], [30.0, 0.0]],
  ['lookout_back', [47.2, 7.25], [38.0, -1.5]],
  ['lookout_west', [46.0, 7.9], [30.0, 6.0]],
  ['tall_deck', [49.4, 2.15], [45.6, 2.45]],
  ['deck_back_west', [48.0, 2.2], [30.0, -2.0]],
  ['small_door', [37.0, 1.4], [35.96, 2.14]],
  ['small_door_back', [35.96, 2.14], [30.0, -4.0]],
  ['lookout_east_run', [48.6, 6.7], [51.6, 6.9]],
  ['lookout_west_run', [41.6, 8.1], [38.6, 8.2]],
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const rows = [];
const t0 = Date.now();
try {
  const { page } = await openWorld(browser, server.url, { width, height, log: console.error });
  const canvas = await page.$('canvas');
  const measure = async (name, set) => {
    await page.evaluate(set);
    await page.evaluate(() => window.__ZR__.setTime(12.5));
    for (let left = settle; left > 0; left -= 3) await page.evaluate(async (n) => window.__ZR__.render(n, 1 / 30), Math.min(3, left));
    const s = await page.evaluate(() => {
      const st = window.__ZR__.stats();
      const e = window.__ZR__.audit().systems.structures?.east;
      const tiers = e ? ['core', 'base', 'mid', 'rooms', 'roomsNear'].filter((t) => e[`${t}Visible`]).concat(e.houses?.some((h) => h.nearVisible) ? ['near'] : []) : null;
      return { drawCalls: st.drawCalls ?? st.calls, triangles: st.triangles, tiers, cam: window.__ZR__.cameraPose() };
    });
    const row = { pose: name, drawCalls: s.drawCalls, triangles: s.triangles, tiers: s.tiers, cam: s.cam };
    if (shots) fs.writeFileSync(path.join(out, `${name}.png`), await canvas.screenshot({ type: 'png' }));
    rows.push(row);
    console.error(`[views] ${name}: ${row.drawCalls} draws, ${(row.triangles / 1e6).toFixed(3)} M ${row.tiers ? JSON.stringify(row.tiers) : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(rows, null, 1));
    return row;
  };
  const heroes = await page.evaluate(() => window.__ZR__.viewpoints().filter((v) => !v.diagnostic).map((v) => v.id));
  for (const id of heroes) if (!only || only.has(id)) await measure(id, `window.__ZR__.setViewpoint(${JSON.stringify(id)})`);
  const poseOf = async (P, look) => {
    const h = onDeck(P[0], P[1]) ? DECK_Y : await page.evaluate(([x, z]) => window.__ZR__.probe(x, z).height, P);
    const dx = look[0] - P[0];
    const dz = look[1] - P[1];
    const l = Math.hypot(dx, dz) || 1;
    return { p: [P[0] - (dx / l) * 4.3, h + 1.75, P[1] - (dz / l) * 4.3], t: [P[0], h + 1.5, P[1]] };
  };
  // `pitch` > 0: a low camera beside the walker (camH over the ground) looking that many degrees up toward
  // `look`; < 0: the follow camera's orbit, 4.3 m from the walker's aim point and that many degrees above it
  const pitchPose = async (e) => {
    const h = await page.evaluate(([x, z]) => window.__ZR__.probe(x, z).height, e.at);
    const dx = e.look[0] - e.at[0];
    const dz = e.look[1] - e.at[1];
    const l = Math.hypot(dx, dz) || 1;
    const [ux, uz] = [dx / l, dz / l];
    const a = (Math.abs(e.pitch) * Math.PI) / 180;
    if (e.pitch > 0) {
      const p = [e.at[0], h + (e.camH ?? 0.5), e.at[1]];
      return { p, t: [p[0] + ux * Math.cos(a) * 6, p[1] + Math.sin(a) * 6, p[2] + uz * Math.cos(a) * 6] };
    }
    const piv = [e.at[0], h + 1.5, e.at[1]];
    return { p: [piv[0] - ux * 4.3 * Math.cos(a), piv[1] + 4.3 * Math.sin(a), piv[2] - uz * 4.3 * Math.cos(a)], t: piv };
  };
  const poses = [];
  for (const [name, P, look] of NAMED) poses.push({ name, ...(await poseOf(P, look)) });
  for (const e of extra) poses.push(e.p ? e : e.pitch !== undefined ? { name: e.name, ...(await pitchPose(e)) } : { name: e.name, ...(await poseOf(e.at, e.look)) });
  for (const pose of poses) {
    if (only && !only.has(pose.name)) continue;
    const r = await measure(pose.name, `window.__ZR__.setPose(${JSON.stringify(pose.p)}, ${JSON.stringify(pose.t)}, 46)`);
    r.pose3 = { p: pose.p, t: pose.t };
  }
  if (isolateN > 0) {
    const worst = [...rows].sort((a, b) => b.triangles - a.triangles || b.drawCalls - a.drawCalls).slice(0, isolateN);
    const byDraws = [...rows].sort((a, b) => b.drawCalls - a.drawCalls).slice(0, isolateN);
    for (const w of new Set([...worst, ...byDraws])) {
      const set = w.pose3 ? `window.__ZR__.setPose(${JSON.stringify(w.pose3.p)}, ${JSON.stringify(w.pose3.t)}, 46)` : `window.__ZR__.setViewpoint(${JSON.stringify(w.pose)})`;
      await page.evaluate(set);
      await page.evaluate(() => window.__ZR__.setTime(12.5));
      for (let left = settle; left > 0; left -= 3) await page.evaluate(async (n) => window.__ZR__.render(n, 1 / 30), Math.min(3, left));
      const systems = await page.evaluate(() => Object.keys(window.__ZR__.audit().systems));
      w.bySystem = {};
      for (const sys of systems) {
        const r = await page.evaluate((s) => window.__ZR__.isolate(s), sys);
        if (r.found) w.bySystem[sys] = [r.drawCalls, r.triangles];
      }
      console.error(`[views] isolate ${w.pose}: ${JSON.stringify(w.bySystem)}`);
      fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(rows, null, 1));
    }
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(rows, null, 1));
console.error(`[views] done in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
