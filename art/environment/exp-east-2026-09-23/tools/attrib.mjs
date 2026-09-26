#!/usr/bin/env node
// One world load: per pose, every draw of one frame attributed to its system (colour / shadow / post),
// renderer.info cross-check, a screenshot; with --ab, the same pose again with each listed switch set
// (window.__KF_EAST_*_OFF__, only at poses inside the east zone) and the pixel difference to the first.
// Run from the repo root on a built dist:
//   node art/environment/exp-east-2026-09-23/tools/attrib.mjs --dist <dist> --out <dir> [--poses a,b] [--ab [FLAG,...|all]] [--top 25] [--size 960x540]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openWorld, serveStatic } from '../../../../gauntlet/scripts/lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const dist = path.resolve(args.dist ?? 'dist');
const out = path.resolve(args.out ?? '/tmp/east-attrib');
fs.mkdirSync(out, { recursive: true });
const [width, height] = String(args.size ?? '960x540').split('x').map(Number);
const only = args.poses ? new Set(String(args.poses).split(',')) : null;
const ALL_FLAGS = ["__KF_EAST_ZONE_OFF__", "__KF_EAST_FAR_LOD_OFF__", "__KF_EAST_FAR_TUFTS_OFF__"];
const abSets = !args.ab ? [] : args.ab === true ? [["__KF_EAST_ZONE_OFF__"]] : String(args.ab).split(",").map((k) => (k === "all" ? ALL_FLAGS : [k]));
const ab = abSets.length > 0;
const topN = Number(args.top ?? 25);

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

const diffPng = async (a, b) => {
  const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = A.info.width;
  const n = A.data.length / 3;
  let over6 = 0;
  let over16 = 0;
  let max = 0;
  let x0 = w;
  let y0 = 1e9;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < n; i++) {
    const d = Math.max(Math.abs(A.data[i * 3] - B.data[i * 3]), Math.abs(A.data[i * 3 + 1] - B.data[i * 3 + 1]), Math.abs(A.data[i * 3 + 2] - B.data[i * 3 + 2]));
    if (d > max) max = d;
    if (d > 6) {
      over6++;
      const x = i % w;
      const y = Math.floor(i / w);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    if (d > 16) over16++;
  }
  return { pixels: n, over6, over16, max, box: over6 ? [x0, y0, x1, y1] : null };
};

const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const origNewPage = browser.newPage.bind(browser);
browser.newPage = async () => {
  const p = await origNewPage();
  await p.evaluateOnNewDocument(() => {
    const t = new EventTarget();
    window.__kfObserved = [];
    t.addEventListener('observe', (e) => window.__kfObserved.push(e.detail));
    window.__THREE_DEVTOOLS__ = t;
  });
  return p;
};
const rows = [];
const t0 = Date.now();
try {
  const { page } = await openWorld(browser, server.url, { width, height, log: console.error });
  const canvas = await page.$('canvas');
  const hooked = await page.evaluate(() => {
    const obs = window.__kfObserved;
    const renderer = obs.find((o) => o && o.isWebGLRenderer);
    const scenes = obs.filter((o) => o && o.isScene);
    let scene = null;
    let most = -1;
    for (const s of scenes) {
      let n = 0;
      s.traverse(() => n++);
      if (n > most) (most = n), (scene = s);
    }
    if (!renderer || !scene) return { ok: false, observed: obs.length };
    const A = (window.__kfAttr = { on: false, draws: new Map() });
    const pathOf = (o) => {
      const names = [];
      for (let p = o; p && p !== scene; p = p.parent) names.push(p.name || p.type);
      return names.reverse();
    };
    const trisOf = (geometry, material, object, group) => {
      if (!object.isMesh && !object.isSprite) return 0;
      if (material.wireframe) return 0;
      const index = geometry.index;
      const position = geometry.attributes.position;
      if (index === null) {
        if (position === undefined || position.count === 0) return 0;
      } else if (index.count === 0) return 0;
      const dr = geometry.drawRange;
      let s = dr.start;
      let e = dr.start + dr.count;
      if (group) {
        s = Math.max(s, group.start);
        e = Math.min(e, group.start + group.count);
      }
      s = Math.max(s, 0);
      e = Math.min(e, index !== null ? index.count : position.count);
      const c = e - s;
      if (c <= 0 || c === Infinity) return 0;
      let inst = 1;
      if (object.isInstancedMesh) inst = object.count;
      else if (geometry.isInstancedBufferGeometry) inst = Math.min(geometry.instanceCount, geometry._maxInstanceCount ?? Infinity);
      return (inst * c) / 3;
    };
    const orig = renderer.renderBufferDirect;
    renderer.renderBufferDirect = function (camera, sc, geometry, material, object, group) {
      if (A.on) {
        const t = trisOf(geometry, material, object, group);
        if (t > 0) {
          const pass = sc === null ? 'shadow' : sc === scene ? 'colour' : 'post';
          const key = `${pass}|${object.id}`;
          let r = A.draws.get(key);
          if (!r) A.draws.set(key, (r = { pass, id: object.id, name: object.name || object.type, path: pathOf(object), draws: 0, tris: 0 }));
          r.draws++;
          r.tris += t;
        }
      }
      return orig.call(this, camera, sc, geometry, material, object, group);
    };
    window.__kfRenderer = renderer;
    window.__kfScene = scene;
    return { ok: true, observed: obs.length, sceneObjects: most, top: scene.children.map((c) => c.name || c.type) };
  });
  console.error(`[attrib] hooked ${JSON.stringify(hooked)}`);
  if (!hooked.ok) throw new Error('renderer / scene not observed');

  const settle = async () => {
    await page.evaluate(() => window.__ZR__.setTime(12.5));
    for (let k = 0; k < 2; k++) await page.evaluate(async () => window.__ZR__.render(3, 1 / 30));
  };
  const frame = async () => {
    await page.evaluate(async () => {
      window.__kfAttr.draws.clear();
      window.__kfAttr.on = true;
      await window.__ZR__.render(1, 1 / 30);
      window.__kfAttr.on = false;
    });
    return page.evaluate(() => {
      const st = window.__ZR__.stats();
      return { stats: { drawCalls: st.drawCalls ?? st.calls, triangles: st.triangles }, draws: [...window.__kfAttr.draws.values()], cam: window.__ZR__.cameraPose(), zone: window.__ZR__.audit().systems.structures?.eastZone?.inside };
    });
  };
  const summarise = (draws) => {
    const sum = { colour: { d: 0, t: 0 }, shadow: { d: 0, t: 0 }, post: { d: 0, t: 0 } };
    const sys = {};
    for (const r of draws) {
      sum[r.pass].d += r.draws;
      sum[r.pass].t += r.tris;
      const k1 = r.path[0] ?? '?';
      const k2 = r.path.length > 2 ? `${k1}/${r.path[1]}` : k1;
      for (const k of new Set([k1, k2])) {
        const s = (sys[k] ??= { cd: 0, ct: 0, sd: 0, st: 0 });
        if (r.pass === 'colour') (s.cd += r.draws), (s.ct += r.tris);
        if (r.pass === 'shadow') (s.sd += r.draws), (s.st += r.tris);
      }
    }
    const top = draws
      .filter((r) => r.pass !== 'post')
      .sort((a, b) => b.tris - a.tris)
      .slice(0, topN)
      .map((r) => ({ pass: r.pass, sys: r.path.slice(0, 2).join('/'), name: r.name, tris: Math.round(r.tris), draws: r.draws }));
    return { sum, sys, top };
  };

  const heroes = await page.evaluate(() => window.__ZR__.viewpoints().filter((v) => !v.diagnostic).map((v) => v.id));
  const poses = heroes.map((id) => ({ name: id, set: `window.__ZR__.setViewpoint(${JSON.stringify(id)})` }));
  for (const [name, P, look] of NAMED) {
    const h = onDeck(P[0], P[1]) ? DECK_Y : await page.evaluate(([x, z]) => window.__ZR__.probe(x, z).height, P);
    const dx = look[0] - P[0];
    const dz = look[1] - P[1];
    const l = Math.hypot(dx, dz) || 1;
    const p = [P[0] - (dx / l) * 4.3, h + 1.75, P[1] - (dz / l) * 4.3];
    const t = [P[0], h + 1.5, P[1]];
    poses.push({ name, p, t, set: `window.__ZR__.setPose(${JSON.stringify(p)}, ${JSON.stringify(t)}, 46)` });
  }
  for (const pose of poses) {
    if (only && !only.has(pose.name)) continue;
    await page.evaluate(pose.set);
    await settle();
    const f = await frame();
    const png = await canvas.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(out, `${pose.name}.png`), png);
    const s = summarise(f.draws);
    const row = { pose: pose.name, stats: f.stats, zone: f.zone, cam: f.cam, sum: s.sum, sys: s.sys, top: s.top };
    const tot = s.sum.colour.d + s.sum.shadow.d + s.sum.post.d;
    const totT = s.sum.colour.t + s.sum.shadow.t + s.sum.post.t;
    console.error(`[attrib] ${pose.name}: info ${f.stats.drawCalls}/${(f.stats.triangles / 1e6).toFixed(3)} M, attributed ${tot}/${(totT / 1e6).toFixed(3)} M (colour ${s.sum.colour.d}/${(s.sum.colour.t / 1e6).toFixed(3)}, shadow ${s.sum.shadow.d}/${(s.sum.shadow.t / 1e6).toFixed(3)}), zone ${f.zone} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    if (ab && f.zone) {
      await settle();
      await frame();
      const png1 = await canvas.screenshot({ type: 'png' });
      row.control = await diffPng(png, png1);
      console.error(`[attrib]   control (zone on again): pixels over 6: ${row.control.over6}, over 16: ${row.control.over16}, max ${row.control.max}`);
      for (const flags of abSets) {
        await page.evaluate((fl) => { for (const k of fl) window[k] = true; }, flags);
        await settle();
        const g = await frame();
        const png2 = await canvas.screenshot({ type: "png" });
        const tag = flags.length > 1 ? "all-off" : flags[0].replace(/^__KF_EAST_|__$/g, "").toLowerCase().replace(/_/g, "-");
        fs.writeFileSync(path.join(out, `${pose.name}.${tag}.png`), png2);
        await page.evaluate((fl) => { for (const k of fl) delete window[k]; }, flags);
        const d = await diffPng(png, png2);
        (row.ab ??= {})[tag] = { flags, stats: g.stats, zone: g.zone, sum: summarise(g.draws).sum, diff: d };
        console.error(`[attrib]   ${tag}: ${g.stats.drawCalls}/${(g.stats.triangles / 1e6).toFixed(3)} M (zone ${g.zone}); pixels over 6: ${d.over6}, over 16: ${d.over16}, max ${d.max}, box ${JSON.stringify(d.box)}`);
      }
    }
    rows.push(row);
    fs.writeFileSync(path.join(out, 'attrib.json'), JSON.stringify(rows, null, 1));
  }
} finally {
  await browser.close();
  server.close?.();
}
console.error(`[attrib] done in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}/attrib.json`);
