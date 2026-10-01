// squad2: which tree casters pay for the sun's depth pass at one pose, and whether their shade is
// in the frame at all. `playcost.mjs` says which system owns the triangles; this says which mesh
// owns the DEPTH triangles, and then answers the only question that matters for a cull: if this
// mesh stops casting, does any pixel move?
//
//   node art/environment/squad2-2026-09-23/depthfoot/depthprobe.mjs <dist> <pose.json> <out.json>
//
// Per caster group: drop `castShadow`, re-render the same frame, read the triangle delta (its depth
// cost) and diff the PNG against the baseline (its shade's effect on the frame). A group that costs
// triangles and moves no pixel is a free cull at this pose — the reason `shadowReaches` exists.
//
// It needs a handle on the trees group, which the shipped build does not expose. Add this line to
// trees/index.ts next to `phase('distant-mid-and-publish')` while measuring, and take it out again:
//
//   (window as unknown as { __ZR_TREES__?: unknown }).__ZR_TREES__ = group;
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', posePath, outPath = '/tmp/depthfoot.json'] = process.argv.slice(2);
const W = 960;
const H = 540;
const SETTLE = 8;
const log = (...m) => console.error(`[depthprobe ${new Date().toISOString().slice(11, 19)}]`, ...m);
const shots = JSON.parse(fs.readFileSync(path.resolve(posePath), 'utf8'));

/** name → group: the pooled near parts, the sectors, the batches, the families and their proxies */
const groupOf = (name) => {
  if (/^giant-near-base/.test(name)) return 'giant-near-base';
  if (/^giant-near-canopy/.test(name)) return 'giant-near-canopy';
  if (/^column-near-base|near-bole/.test(name)) return 'column-near-base';
  if (/^giants-sector-\d+-wood|^giants-sector-\d+-[a-z]+$/.test(name)) return 'giant-sector';
  if (/^giants-canopy-/.test(name)) return 'giant-sector-canopy';
  if (/far-foliage/.test(name)) return 'far-foliage-batch';
  if (/-high-shadow$/.test(name)) return 'family-shadow-proxy';
  if (/^(whitebark|column|understory)/.test(name)) return 'family-lod';
  if (/detached/.test(name)) return 'detached-bough';
  if (/^(distant|mid)-\d+/.test(name)) return 'distant-mid';
  return `other:${name.replace(/[0-9]+/g, '#')}`;
};

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H, log });
  await page.evaluateOnNewDocument(() => {});
  for (const shot of shots) {
    log(`pose ${shot.name}`);
    await page.evaluate((sh) => {
      window.__ZR__.setTime(12.5);
      window.__ZR__.setPose(sh.from.p, sh.from.t, sh.from.fov);
    }, shot);
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), SETTLE);
    // from here the clock is frozen (dt 0): wind, pools and time-of-day cannot move between frames,
    // so a pixel difference can only come from the caster this loop switched off
    const base = await page.evaluate(async () => {
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      return { draws: s.drawCalls, triangles: s.triangles };
    });
    const basePng = await page.screenshot({ type: 'png' });
    // control: the same frame again, nothing touched — must come out identical for the rest to mean anything
    await page.evaluate(async () => await window.__ZR__.render(2, 0));
    const controlPng = await page.screenshot({ type: 'png' });
    // every visible caster under the trees group, by group, with its triangles
    const casters = await page.evaluate(() => {
      const out = [];
      const root = window.__ZR_TREES__;
      const walk = (o) => {
        if (!o.visible) return;
        if (o.isMesh && o.castShadow) {
          const g = o.geometry;
          const tri = g?.index ? g.index.count / 3 : g?.attributes?.position ? g.attributes.position.count / 3 : 0;
          const n = o.isInstancedMesh ? o.count : o.isBatchedMesh ? 1 : 1;
          out.push({ name: o.name || '(unnamed)', triangles: Math.round(tri * Math.max(1, n)) });
        }
        for (const c of o.children) walk(c);
      };
      walk(root);
      return out;
    });
    log(`  ${casters.length} visible casters under the trees group`);
    const groups = new Map();
    for (const c of casters) {
      const g = groupOf(c.name);
      if (!groups.has(g)) groups.set(g, { group: g, meshes: [], triangles: 0 });
      groups.get(g).meshes.push(c.name);
      groups.get(g).triangles += c.triangles;
    }
    const results = [];
    for (const g of [...groups.values()].sort((a, b) => b.triangles - a.triangles)) {
      const off = await page.evaluate(
        async (names, settle) => {
          const root = window.__ZR_TREES__;
          const hit = [];
          root.traverse((o) => {
            if (o.isMesh && o.castShadow && names.includes(o.name)) {
              hit.push(o);
              o.castShadow = false;
            }
          });
          await window.__ZR__.render(settle, 0);
          const s = window.__ZR__.stats();
          return { draws: s.drawCalls, triangles: s.triangles, dropped: hit.length };
        },
        g.meshes,
        2,
      );
      const png = await page.screenshot({ type: 'png' });
      await page.evaluate(
        async (names, settle) => {
          const root = window.__ZR_TREES__;
          root.traverse((o) => {
            if (o.isMesh && names.includes(o.name)) o.castShadow = true;
          });
          await window.__ZR__.render(settle, 0);
        },
        g.meshes,
        2,
      );
      results.push({ ...g, meshCount: g.meshes.length, off, pngBytes: png.length, png: png.toString('base64') });
      log(`  ${g.group.padEnd(22)} ${g.meshes.length} meshes  depth delta ${(base.triangles - off.triangles) / 1000} K  draws ${base.draws - off.draws}`);
    }
    rows.push({ name: shot.name, base, groups: results.map(({ png, ...r }) => r) });
    const dir = path.join(path.dirname(path.resolve(outPath)), 'frames');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${shot.name}-base.png`), basePng);
    fs.writeFileSync(path.join(dir, `${shot.name}-control.png`), controlPng);
    for (const r of results) fs.writeFileSync(path.join(dir, `${shot.name}-no-${r.group.replace(/[^a-z-]/gi, '_')}.png`), Buffer.from(r.png, 'base64'));
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rows, null, 1));
for (const r of rows) {
  console.log(`\n${r.name}  ${r.base.draws} draws / ${(r.base.triangles / 1e6).toFixed(3)} M`);
  for (const g of r.groups) {
    console.log(`  ${g.group.padEnd(24)} ${String(g.meshCount).padStart(3)} meshes  depth ${((r.base.triangles - g.off.triangles) / 1000).toFixed(0).padStart(5)} K  draws -${r.base.draws - g.off.draws}`);
  }
}
