// How much of each system's depth cost would the shadow-reach test remove? The real util is asked
// about every caster in the scene, so this needs no change in any lane's file.
import fs from 'node:fs';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const POSES = { foot: [[2.648, 1.85, 3.529], [6.038, 1.6, 0.884]], A_stairs: null };
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, log: () => {} });
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  const out = {};
  for (const [name, pose] of Object.entries(POSES)) {
    if (pose) await page.evaluate((p) => window.__ZR__.setPose(p[0], p[1], 46), pose);
    else await page.evaluate(() => window.__ZR__.setViewpoint('A_stairs'));
    await page.evaluate(async () => await window.__ZR__.render(8, 1 / 30));
    out[name] = await page.evaluate(async () => {
      await window.__ZR__.render(2, 0);
      const stats = window.__ZR__.stats();
      const probe = window.__ZR_REACH__;
      const root = probe.scene();
      const rows = {};
      const CULL_PAD_M = 4;
      for (const child of root.children) {
        if (!child.visible) continue;
        const key = child.name || '(unnamed)';
        const row = (rows[key] ??= { casters: 0, tris: 0, idle: 0, idleTris: 0, noSphere: 0 });
        child.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.castShadow) return;
          const g = o.geometry;
          if (!g) return;
          // the build frees CPU arrays after upload, so a missing sphere cannot be computed here
          const bs = g.boundingSphere;
          if (!bs) {
            row.noSphere++;
            return;
          }
          const t = g.index ? g.index.count / 3 : g.attributes?.position ? g.attributes.position.count / 3 : 0;
          const tris = Math.round(t * (o.isInstancedMesh ? o.count : 1));
          o.updateMatrixWorld();
          // world sphere of this caster, padded the way every cull here pads
          const c = bs.center.clone().applyMatrix4(o.matrixWorld);
          const scale = o.matrixWorld.getMaxScaleOnAxis();
          const r = bs.radius * scale + CULL_PAD_M;
          row.casters++;
          row.tris += tris;
          if (!probe.reaches(c.x, c.y, c.z, r)) {
            row.idle++;
            row.idleTris += tris;
          }
        });
      }
      return { draws: stats.drawCalls, triangles: stats.triangles, rows };
    });
    const r = out[name];
    console.error(`${name} ${r.draws}/${r.triangles}`);
    for (const [k, v] of Object.entries(r.rows).sort((a, b) => b[1].idleTris - a[1].idleTris)) {
      if (!v.casters) continue;
      console.error(`   ${k.padEnd(12)} casters ${String(v.casters).padStart(4)}  depth ${String(v.tris).padStart(8)}  would cull ${String(v.idle).padStart(3)} / ${String(v.idleTris).padStart(8)}`);
    }
  }
  fs.writeFileSync('/tmp/recover.json', JSON.stringify(out, null, 1));
} finally { await browser.close(); await server.close(); }
