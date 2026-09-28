/**
 * What each tree family costs in the COLOUR pass at a pose, and how many pixels it is worth.
 *
 *   node art/environment/squad2-2026-09-23/outlook/familycost.mjs <dist> <poses.json> <outdir>
 *
 * `isolate()` stops at the top-level system, so the trees' 3.3 M at a look-back has never been split by
 * family in the drawn frame — only in the audit's own counters, which count what is SUBMITTED rather
 * than what survives culling. This does it the way `depthfoot/depthprobe.mjs` did the depth pass: pose,
 * settle with time, **freeze the clock**, then hide one family, re-render the same frame, and read both
 * the triangle delta and the share of pixels that moved. A family with a large delta and no pixels is
 * something the frame is paying for and not using; a family with pixels is the picture.
 *
 * The clock must be frozen or the wind alone moves 13–31 % of the frame (see `settle/`). A control
 * frame with nothing touched is taken first and must come out identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', posesPath, outDir = '/tmp/familycost'] = process.argv.slice(2);
/**
 * `--shadow` drops each family's `castShadow` instead of hiding it, so the two questions separate:
 * what does this family cost to DRAW, and what does it cost to cast? `--only a,b` restricts the
 * families tested (their names as the table prints them, matched loosely).
 */
const SHADOW = process.argv.includes('--shadow');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1].split(',').map((s) => s.trim().toLowerCase()) : null;
})();
const W = 960;
const H = 540;
const SETTLE = 8;
const log = (...m) => console.error(`[familycost ${new Date().toISOString().slice(11, 19)}]`, ...m);
fs.mkdirSync(outDir, { recursive: true });
const poses = JSON.parse(fs.readFileSync(path.resolve(posesPath), 'utf8'));

/** the share of pixels that differ by more than 2/255 on any channel */
const raw = async (png) => (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
const diffShare = async (a, b) => {
  const pa = await raw(a);
  const pb = await raw(b);
  let moved = 0;
  for (let i = 0; i < pa.data.length; i += 3) {
    if (Math.abs(pa.data[i] - pb.data[i]) > 2 || Math.abs(pa.data[i + 1] - pb.data[i + 1]) > 2 || Math.abs(pa.data[i + 2] - pb.data[i + 2]) > 2) moved++;
  }
  return (100 * moved) / (pa.info.width * pa.info.height);
};
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const results = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H });
  // one definition of "family", installed on the page so the census and the hide use the same rule
  await page.evaluate(() => {
    window.__ZR_FAMILY__ = (name) => {
      if (!name) return 'unnamed';
      if (/^giant-far-foliage/.test(name)) return 'giants: far foliage batches';
      if (/near-base/.test(name)) return 'near bases';
      if (/^near-canopy/.test(name)) return 'near canopy (pooled parts)';
      if (/^giant/.test(name)) return 'giants: wood and leaves';
      if (/column/.test(name)) return 'columns';
      if (/white-?bark/i.test(name)) return 'white-barks';
      if (/distant/.test(name)) return 'distant ring';
      if (/(^|-)mid(-|$)/.test(name)) return 'mid layer';
      if (/card/.test(name)) return 'cards';
      if (/understory|sapling|shrub/.test(name)) return 'understory';
      return `other: ${name.replace(/[0-9]+/g, '#').slice(0, 40)}`;
    };
  });
  for (const pose of poses) {
    log(`pose ${pose.name}`);
    await page.evaluate((sh) => {
      window.__ZR__.setTime(12.5);
      window.__ZR__.setPose(sh.from.p, sh.from.t, sh.from.fov);
    }, pose);
    // settle WITH time so the near-LOD pools swap in, then read with the clock stopped
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), SETTLE);
    const read = async () => await page.evaluate(async () => {
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      return { draws: s.drawCalls, triangles: s.triangles };
    });
    const base = await read();
    const basePng = await page.screenshot({ type: 'png' });
    const controlPng = (await read(), await page.screenshot({ type: 'png' }));
    const control = await diffShare(basePng, controlPng);
    log(`  baseline ${base.draws} / ${base.triangles}, control ${control.toFixed(2)} %`);

    // the visible meshes under the trees group, grouped into families by name
    const families = await page.evaluate(() => {
      const root = window.__ZR_TREES__;
      const family = window.__ZR_FAMILY__;
      const out = {};
      const walk = (o) => {
        if (!o.visible) return;
        if (o.isMesh) {
          const g = o.geometry;
          const tri = g?.index ? g.index.count / 3 : g?.attributes?.position ? g.attributes.position.count / 3 : 0;
          const n = o.isInstancedMesh ? o.count : 1;
          const f = family(o.name);
          out[f] = out[f] ?? { submitted: 0, meshes: 0, names: [] };
          out[f].submitted += Math.round(tri * Math.max(1, n));
          out[f].meshes++;
          if (out[f].names.length < 3) out[f].names.push(o.name || '(unnamed)');
        }
        for (const c of o.children) walk(c);
      };
      walk(root);
      return out;
    });

    const rows = [];
    for (const [name, info] of Object.entries(families)) {
      if (ONLY && !ONLY.some((o) => name.toLowerCase().includes(o))) continue;
      const hidden = await page.evaluate(([f, shadow]) => {
        const root = window.__ZR_TREES__;
        const family = window.__ZR_FAMILY__;
        const touched = [];
        const walk = (o) => {
          if (o.isMesh && family(o.name) === f) {
            if (shadow ? o.castShadow : o.visible) {
              if (shadow) o.castShadow = false;
              else o.visible = false;
              touched.push(o);
            }
          }
          for (const c of o.children) walk(c);
        };
        walk(root);
        window.__ZR_TOUCHED__ = touched;
        return touched.length;
      }, [name, SHADOW]).catch(() => 0);
      const off = await read();
      const offPng = await page.screenshot({ type: 'png' });
      await page.evaluate((shadow) => {
        for (const o of window.__ZR_TOUCHED__ ?? []) {
          if (shadow) o.castShadow = true;
          else o.visible = true;
        }
      }, SHADOW);
      const moved = await diffShare(basePng, offPng);
      rows.push({
        family: name,
        meshes: info.meshes,
        submitted: info.submitted,
        drawnTriangles: base.triangles - off.triangles,
        drawnDraws: base.draws - off.draws,
        mode: SHADOW ? 'castShadow off' : 'hidden',
        pixelsMoved: Math.round(moved * 100) / 100,
        names: info.names,
      });
      log(`  ${name}: −${base.triangles - off.triangles} tri, −${base.draws - off.draws} draws, ${moved.toFixed(2)} % of pixels (${hidden} meshes)`);
      if (moved < 0.05 && base.draws - off.draws > 4) fs.writeFileSync(path.join(outDir, `${pose.name}-${SHADOW ? 'nocast' : 'without'}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`), offPng);
    }
    fs.writeFileSync(path.join(outDir, `${pose.name}.png`), basePng);
    results.push({ pose: pose.name, base, control: Math.round(control * 100) / 100, md5: md5(basePng), families: rows.sort((a, b) => b.drawnTriangles - a.drawnTriangles) });
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, SHADOW ? 'shadowcost.json' : 'familycost.json'), JSON.stringify(results, null, 1) + '\n');
for (const r of results) {
  console.log(`\n## ${r.pose} — ${r.base.draws} draws / ${r.base.triangles} triangles (control ${r.control} %)`);
  console.log('| family | meshes | submitted | drawn triangles | draws | pixels moved |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const f of r.families) console.log(`| ${f.family} | ${f.meshes} | ${f.submitted} | ${f.drawnTriangles} | ${f.drawnDraws} | ${f.pixelsMoved} % |`);
}
