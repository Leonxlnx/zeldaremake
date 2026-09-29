/**
 * "Gentle life in the air, not spectacle" (the owner's backlog item 5), measured.
 *
 *   node art/environment/squad2-2026-09-23/airlife/airlife.mjs <dist> <outdir>
 *
 * The item is built — `atmosphere/leaves.ts` (96 falling leaves), `atmosphere/motes.ts` (180 motes) and
 * `vegetation/butterflies.ts` (34 butterflies, whose header cites this very item) — and nobody has checked
 * the result against the owner's wording. Gentle and spectacle differ in things a frame can be asked
 * about: how much of it these elements occupy, how hard they stand out from what is behind them, and how
 * far they sweep in half a second.
 *
 * Per family, per pose: pose, settle with time, **freeze the clock**, take the frame, hide the family,
 * take it again — the footprint is the share of pixels that moved, its strength is the delta on those
 * pixels. Then advance the clock half a second and repeat, which gives the same numbers half a second
 * later: a gentle element drifts (similar footprint, similar strength), a spectacle sweeps.
 *
 * Needs the temporary `__ZR_TREES__` handle (`depthfoot/depthprobe.mjs` documents it); the scene root is
 * reached by walking up from it, so every system is in reach.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', outDir = '/tmp/airlife'] = process.argv.slice(2);
// dist and outDir are positional: a flag in their place would be served as the build
// directory and the world would never signal ready, costing a 15-minute timeout.
if (dist.startsWith('--') || outDir.startsWith('--')) {
  throw new Error(`usage: airlife.mjs [dist] [outDir] [--only shot,shot] — got dist="${dist}" outDir="${outDir}"`);
}
const W = 960;
const H = 540;
const SETTLE = 8;
const log = (...m) => console.error(`[airlife ${new Date().toISOString().slice(11, 19)}]`, ...m);
fs.mkdirSync(outDir, { recursive: true });

/** the three air families, by mesh name */
const FAMILIES = ['falling-leaves', 'motes', 'butterflies'];
const ALL_SHOTS = [
  { name: 'A_stairs', viewpoint: 'A_stairs' },
  { name: 'owner-0650-north', pose: { p: [1.4, 1.75, -10.2], t: [2.0, 1.45, -20.0], fov: 46 } },
  // F_canopy looks up the stairs into the god rays, where dust motes should show if they show anywhere
  { name: 'F_canopy', viewpoint: 'F_canopy' },
];
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1].split(',') : null;
})();
const SHOTS = only ? ALL_SHOTS.filter((s) => only.includes(s.name)) : ALL_SHOTS;
/** world times to read at: the capture's own, and half a second later */
const TIMES = [12.5, 13.0];

const raw = async (png) => await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
/** share of pixels the family paints, and how hard it stands out on them */
const footprint = async (withIt, without) => {
  const a = await raw(withIt);
  const b = await raw(without);
  let moved = 0;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < a.data.length; i += 3) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    if (d > max) max = d;
    if (d > 2) {
      moved++;
      sum += d;
    }
  }
  const px = a.info.width * a.info.height;
  return {
    sharePct: Math.round(((100 * moved) / px) * 1000) / 1000,
    pixels: moved,
    meanDelta: moved ? Math.round((sum / moved) * 10) / 10 : 0,
    maxDelta: max,
  };
};

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H });
  const census = await page.evaluate((names) => {
    let root = window.__ZR_TREES__;
    if (!root) {
      throw new Error(
        'no window.__ZR_TREES__: the capture API does not expose the scene, so this probe needs a temporary ' +
          'hook in src/world/trees/index.ts (never committed). variantfoot.mjs measures the same thing with ' +
          'no hook at all — two builds and frozen.mjs — and is the better route for a family whose update() ' +
          'writes object.visible.',
      );
    }
    while (root.parent) root = root.parent;
    window.__ZR_ROOT__ = root;
    const out = [];
    const walk = (o) => {
      if (names.includes(o.name)) out.push({ name: o.name, type: o.type, instances: o.isInstancedMesh ? o.count : o.isPoints ? o.geometry.getAttribute('position').count : 1, visible: o.visible });
      for (const c of o.children) walk(c);
    };
    walk(root);
    return out;
  }, FAMILIES);
  log(`found: ${census.map((c) => `${c.name} (${c.type}, ${c.instances})`).join(', ')}`);

  for (const shot of SHOTS) {
    for (const t of TIMES) {
      await page.evaluate(([sh, time]) => {
        window.__ZR__.setTime(time);
        if (sh.viewpoint) window.__ZR__.setViewpoint(sh.viewpoint);
        else window.__ZR__.setPose(sh.pose.p, sh.pose.t, sh.pose.fov);
      }, [shot, t]);
      // settle with time so the pools swap in, then set the clock back and read it frozen
      await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), SETTLE);
      await page.evaluate((time) => window.__ZR__.setTime(time), t);
      const read = async () => {
        await page.evaluate(async () => await window.__ZR__.render(2, 0));
        return await page.screenshot({ type: 'png' });
      };
      const base = await read();
      for (const family of FAMILIES) {
        // Hide at the material too: a system's own update() may rewrite object.visible
        // every frame (motes does), which would silently undo an object-level hide and
        // report a zero footprint for a family that is in fact drawing.
        const hidden = await page.evaluate((name) => {
          const touched = [];
          const walk = (o) => {
            if (o.name === name && o.visible) {
              for (const m of [].concat(o.material ?? [])) m.visible = false;
              o.visible = false;
              touched.push(o);
            }
            for (const c of o.children) walk(c);
          };
          walk(window.__ZR_ROOT__);
          window.__ZR_AIR__ = touched;
          return touched.length;
        }, family);
        const off = await read();
        const held = await page.evaluate(() => {
          const air = window.__ZR_AIR__ ?? [];
          const material = air.every((o) => [].concat(o.material ?? []).every((m) => !m.visible));
          const rewritten = air.filter((o) => o.visible).map((o) => o.name);
          for (const o of air) {
            for (const m of [].concat(o.material ?? [])) m.visible = true;
            o.visible = true;
          }
          return { material, rewritten };
        });
        if (hidden > 0 && !held.material) throw new Error(`${family}: the material hide did not survive the frame`);
        if (held.rewritten.length > 0) log(`  note: ${family} update() reset object.visible during the frame (material hide held)`);
        const f = await footprint(base, off);
        rows.push({ shot: shot.name, time: t, family, meshes: hidden, ...f });
        log(`${shot.name} t=${t}s ${family}: ${f.sharePct} % of pixels, mean Δ ${f.meanDelta}/255, max ${f.maxDelta}/255 (${f.pixels} px)`);
      }
      fs.writeFileSync(path.join(outDir, `${shot.name}-t${String(t).replace('.', '_')}.png`), base);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, 'airlife.json'), JSON.stringify(rows, null, 1) + '\n');
console.log('| pose | t | family | meshes | share of frame | mean Δ | max Δ | pixels |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.shot} | ${r.time} s | ${r.family} | ${r.meshes} | ${r.sharePct} % | ${r.meanDelta}/255 | ${r.maxDelta}/255 | ${r.pixels} |`);
