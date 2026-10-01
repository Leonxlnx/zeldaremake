/**
 * What `forceSinglePass` on the distant crown material costs in pixels, measured against itself.
 *
 *   node art/environment/squad2-2026-09-23/outlook/singlepass.mjs <dist> <outdir>
 *
 * three renders a `transparent` + `DoubleSide` material TWICE — back faces, then front faces — unless
 * `forceSinglePass` is set. `outlook/familycost.mjs --per-mesh` measured every distant and mid tree mesh
 * costing **three** draw calls for its two material groups, which is that second pass. Turning it off
 * saves one draw per mesh, so 16–17 draws a frame across the two layers.
 *
 * It is a rendering-order change, so the frame's md5 moves and the question is by how much. Rather than
 * re-render a baseline from another build, this toggles the flag at runtime (`needsUpdate` recompiles)
 * and diffs the two frames **inside one page load, at the same pose, with the clock frozen** — the only
 * way the two pictures differ by nothing but the flag.
 *
 * Needs the temporary `__ZR_TREES__` handle that `depthfoot/depthprobe.mjs` documents.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', outDir = '/tmp/singlepass'] = process.argv.slice(2);
const W = 960;
const H = 540;
const SETTLE = 8;
const log = (...m) => console.error(`[singlepass ${new Date().toISOString().slice(11, 19)}]`, ...m);
fs.mkdirSync(outDir, { recursive: true });

const ALL_SHOTS = [
  { name: 'A_stairs', viewpoint: 'A_stairs' },
  { name: 'F_canopy', viewpoint: 'F_canopy' },
  { name: 'plateau-north', pose: { p: [17.2, 7.1, -12.0], t: [4.0, 3.0, -40.0], fov: 50 } },
  { name: 'plateau-back', pose: { p: [17.0, 7.1, -15.0], t: [0.0, 2.0, 6.0], fov: 50 } },
  // the owner's 06:50 north pose: the one the lane's crown-band charter is measured at (bandcheck/)
  { name: 'owner-0650-north', pose: { p: [1.4, 1.75, -10.2], t: [2.0, 1.45, -20.0], fov: 46 } },
];
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1].split(',') : null;
})();
const SHOTS = only ? ALL_SHOTS.filter((s) => only.includes(s.name)) : ALL_SHOTS;

const raw = async (png) => await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
/** share of pixels differing by more than `t`/255 on any channel, and the largest single difference */
const diff = async (a, b, t = 2) => {
  const pa = await raw(a);
  const pb = await raw(b);
  let moved = 0;
  let max = 0;
  for (let i = 0; i < pa.data.length; i += 3) {
    const d = Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2]));
    if (d > max) max = d;
    if (d > t) moved++;
  }
  return { share: (100 * moved) / (pa.info.width * pa.info.height), max };
};

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H });
  const found = await page.evaluate(() => {
    const names = [];
    const walk = (o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (/crown/.test(m.name ?? '') && m.transparent && m.side === 2) names.push(`${m.name}:${m.forceSinglePass}`);
      }
      for (const c of o.children) walk(c);
    };
    walk(window.__ZR_TREES__);
    return [...new Set(names)];
  });
  log(`double-sided transparent crown materials: ${found.join(', ')}`);
  for (const shot of SHOTS) {
    await page.evaluate((sh) => {
      window.__ZR__.setTime(12.5);
      if (sh.viewpoint) window.__ZR__.setViewpoint(sh.viewpoint);
      else window.__ZR__.setPose(sh.pose.p, sh.pose.t, sh.pose.fov);
    }, shot);
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), SETTLE);
    const read = async () => await page.evaluate(async () => {
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      return { draws: s.drawCalls, triangles: s.triangles };
    });
    // as built (single pass), then the same frame with three's second pass put back
    const single = await read();
    const singlePng = await page.screenshot({ type: 'png' });
    const flipped = await page.evaluate((to) => {
      let n = 0;
      const walk = (o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          if (/crown/.test(m.name ?? '') && m.transparent && m.side === 2 && m.forceSinglePass !== to) {
            m.forceSinglePass = to;
            m.needsUpdate = true;
            n++;
          }
        }
        for (const c of o.children) walk(c);
      };
      walk(window.__ZR_TREES__);
      return n;
    }, false);
    const two = await read();
    const twoPng = await page.screenshot({ type: 'png' });
    await page.evaluate((to) => {
      const walk = (o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          if (/crown/.test(m.name ?? '') && m.transparent && m.side === 2) {
            m.forceSinglePass = to;
            m.needsUpdate = true;
          }
        }
        for (const c of o.children) walk(c);
      };
      walk(window.__ZR_TREES__);
    }, true);
    const d = await diff(singlePng, twoPng);
    const d8 = await diff(singlePng, twoPng, 8);
    fs.writeFileSync(path.join(outDir, `${shot.name}-single.png`), singlePng);
    fs.writeFileSync(path.join(outDir, `${shot.name}-twopass.png`), twoPng);
    rows.push({
      shot: shot.name,
      single,
      twoPass: two,
      drawsSaved: two.draws - single.draws,
      trianglesSaved: two.triangles - single.triangles,
      pixelsMoved: Math.round(d.share * 1000) / 1000,
      pixelsMovedOver8: Math.round(d8.share * 1000) / 1000,
      maxChannelDelta: d.max,
      materialsFlipped: flipped,
    });
    log(
      `${shot.name}: single ${single.draws}/${single.triangles} vs two-pass ${two.draws}/${two.triangles} — ` +
        `−${two.draws - single.draws} draws, −${two.triangles - single.triangles} tri, ${d.share.toFixed(3)} % of pixels moved (max Δ ${d.max}/255)`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, 'singlepass.json'), JSON.stringify(rows, null, 1) + '\n');
console.log('| view | single pass | two passes | draws saved | triangles saved | pixels moved (>2/255) | (>8/255) | max Δ |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  console.log(
    `| ${r.shot} | ${r.single.draws} / ${r.single.triangles} | ${r.twoPass.draws} / ${r.twoPass.triangles} | ${r.drawsSaved} | ${r.trianglesSaved} | ${r.pixelsMoved} % | ${r.pixelsMovedOver8} % | ${r.maxChannelDelta}/255 |`,
  );
}
