/**
 * How much of the whole frame is three's two-pass transparency rule, material by material.
 *
 *   node art/environment/squad2-2026-09-23/outlook/twopass.mjs <dist> <outdir>
 *
 * `WebGLRenderer.renderObject` draws a material with `transparent` AND `side: DoubleSide` **twice** —
 * back faces, then front faces — unless `forceSinglePass` is set. `outlook/README.md` §5 found the
 * distant crowns paying it (three draws for two material groups) and set the flag there, which was worth
 * 15–17 draws a frame. `forceSinglePass` appears nowhere else in the repository, so this asks the whole
 * scene: which materials are in that state, and what does each cost?
 *
 * Per material: flip the flag on every mesh using it, re-render the same frame with the clock frozen,
 * read the draw and triangle delta and the share of pixels that moved. Then all of them together. A
 * control frame comes first. The point is one number per owning lane, so nobody has to take it on faith.
 *
 * Needs the temporary `__ZR_TREES__` handle (`depthfoot/depthprobe.mjs` documents it); the scene root is
 * reached by walking up from it.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
import { ssim } from '/workspace/gauntlet/scripts/lib/image.mjs';

const [dist = 'dist', outDir = '/tmp/twopass'] = process.argv.slice(2);
const W = 960;
const H = 540;
const SETTLE = 8;
const log = (...m) => console.error(`[twopass ${new Date().toISOString().slice(11, 19)}]`, ...m);
fs.mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { name: 'A_stairs', viewpoint: 'A_stairs' },
  { name: 'plateau-back', pose: { p: [17.0, 7.1, -15.0], t: [0.0, 2.0, 6.0], fov: 50 } },
];

const raw = async (png) => await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const grey = async (png) => await sharp(png).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
const compare = async (a, b) => {
  const pa = await raw(a);
  const pb = await raw(b);
  let moved = 0;
  let max = 0;
  for (let i = 0; i < pa.data.length; i += 3) {
    const d = Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2]));
    if (d > max) max = d;
    if (d > 2) moved++;
  }
  const ga = await grey(a);
  const gb = await grey(b);
  return {
    pixelsMoved: Math.round(((100 * moved) / (pa.info.width * pa.info.height)) * 1000) / 1000,
    maxDelta: max,
    ssim: Math.round(ssim(ga.data, gb.data, ga.info.width, ga.info.height) * 100000) / 100000,
  };
};

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const results = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H });
  // the scene root, walked up from the trees group, and every material in the two-pass state
  const census = await page.evaluate(() => {
    let root = window.__ZR_TREES__;
    while (root.parent) root = root.parent;
    window.__ZR_ROOT__ = root;
    const seen = new Map();
    const walk = (o, system) => {
      const sys = o.parent === root ? o.name || '(unnamed)' : system;
      if (o.isMesh || o.isSprite || o.isPoints) {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          // three's rule: transparent AND DoubleSide (side === 2) AND not already single-pass
          if (m.transparent === true && m.side === 2 && m.forceSinglePass === false) {
            const key = `${sys} / ${m.name || m.type}`;
            const e = seen.get(key) ?? { key, system: sys, material: m.name || m.type, meshes: 0, visibleMeshes: 0 };
            e.meshes++;
            if (o.visible) e.visibleMeshes++;
            seen.set(key, e);
          }
        }
      }
      for (const c of o.children) walk(c, sys);
    };
    walk(root, '(root)');
    return [...seen.values()];
  });
  log(`${census.length} material/system pairs in the two-pass state: ${census.map((c) => c.key).join(' | ')}`);

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
    const flip = async (keys, to) =>
      await page.evaluate(([ks, value]) => {
        let n = 0;
        const walk = (o, system) => {
          const sys = o.parent === window.__ZR_ROOT__ ? o.name || '(unnamed)' : system;
          if (o.isMesh || o.isSprite || o.isPoints) {
            for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
              if (m.transparent === true && m.side === 2 && ks.includes(`${sys} / ${m.name || m.type}`) && m.forceSinglePass !== value) {
                m.forceSinglePass = value;
                m.needsUpdate = true;
                n++;
              }
            }
          }
          for (const c of o.children) walk(c, sys);
        };
        walk(window.__ZR_ROOT__, '(root)');
        return n;
      }, [keys, to]);

    const base = await read();
    const basePng = await page.screenshot({ type: 'png' });
    await read();
    const control = await compare(basePng, await page.screenshot({ type: 'png' }));
    log(`${shot.name}: baseline ${base.draws} / ${base.triangles}, control ${control.pixelsMoved} %`);

    const rows = [];
    for (const c of [...census.map((c) => [c.key]), census.map((c) => c.key)]) {
      const label = c.length === 1 ? c[0] : `ALL ${c.length} together`;
      const flipped = await flip(c, true);
      const off = await read();
      const offPng = await page.screenshot({ type: 'png' });
      await flip(c, false);
      const cmp = await compare(basePng, offPng);
      rows.push({ label, flipped, drawsSaved: base.draws - off.draws, trianglesSaved: base.triangles - off.triangles, ...cmp });
      log(`  ${label}: −${base.draws - off.draws} draws, −${base.triangles - off.triangles} tri, ${cmp.pixelsMoved} % of pixels, SSIM ${cmp.ssim} (${flipped} materials)`);
      if (c.length > 1) fs.writeFileSync(path.join(outDir, `${shot.name}-all-single.png`), offPng);
    }
    fs.writeFileSync(path.join(outDir, `${shot.name}-base.png`), basePng);
    results.push({ shot: shot.name, base, control, rows });
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, 'twopass.json'), JSON.stringify({ census, results }, null, 1) + '\n');
for (const r of results) {
  console.log(`\n## ${r.shot} — ${r.base.draws} draws / ${r.base.triangles} triangles (control ${r.control.pixelsMoved} %)`);
  console.log('| material | materials flipped | draws saved | triangles saved | pixels moved | max Δ | SSIM |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of r.rows) console.log(`| ${row.label} | ${row.flipped} | ${row.drawsSaved} | ${row.trianglesSaved} | ${row.pixelsMoved} % | ${row.maxDelta}/255 | ${row.ssim} |`);
}
