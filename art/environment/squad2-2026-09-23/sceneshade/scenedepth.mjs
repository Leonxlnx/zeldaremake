// Every system's shade, priced: at one pose, switch each system's casters off in turn (frozen clock)
// and read the triangle delta and the pixel difference. squad2's depthprobe, scene-wide.
import fs from 'node:fs';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [outDir, poseName] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const POSES = {
  foot: [[2.648, 1.85, 3.529], [6.038, 1.6, 0.884]],
  A_stairs: null,
};
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, log: () => {} });
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  const pose = POSES[poseName];
  if (pose) await page.evaluate((p) => window.__ZR__.setPose(p[0], p[1], 46), pose);
  else await page.evaluate(() => window.__ZR__.setViewpoint('A_stairs'));
  await page.evaluate(async () => await window.__ZR__.render(8, 1 / 30));
  const base = await page.evaluate(async () => {
    await window.__ZR__.render(2, 0);
    const s = window.__ZR__.stats();
    return { draws: s.drawCalls, triangles: s.triangles };
  });
  fs.writeFileSync(`${outDir}/base.png`, await page.screenshot({ type: 'png' }));
  const systems = await page.evaluate(() => {
    const root = window.__ZR_SCENE__();
    const out = {};
    for (const child of root.children) {
      if (!child.visible) continue;
      let casters = 0;
      let tris = 0;
      child.traverse((o) => {
        if (o.isMesh && o.visible && o.castShadow) {
          casters++;
          const g = o.geometry;
          const t = g?.index ? g.index.count / 3 : g?.attributes?.position ? g.attributes.position.count / 3 : 0;
          tris += Math.round(t * (o.isInstancedMesh ? o.count : 1));
        }
      });
      if (casters) out[child.name || '(unnamed)'] = { casters, tris };
    }
    return out;
  });
  const rows = { base, systems: {}, control: null };
  await page.evaluate(async () => await window.__ZR__.render(2, 0));
  fs.writeFileSync(`${outDir}/control.png`, await page.screenshot({ type: 'png' }));
  for (const name of Object.keys(systems)) {
    const off = await page.evaluate(async (n) => {
      const root = window.__ZR_SCENE__();
      const hit = [];
      for (const child of root.children) {
        if ((child.name || '(unnamed)') !== n) continue;
        child.traverse((o) => { if (o.isMesh && o.visible && o.castShadow) { hit.push(o); o.userData.__wasCaster = true; o.castShadow = false; } });
      }
      await window.__ZR__.render(2, 0);
      const s = window.__ZR__.stats();
      return { draws: s.drawCalls, triangles: s.triangles, dropped: hit.length };
    }, name);
    fs.writeFileSync(`${outDir}/no-${name}.png`, await page.screenshot({ type: 'png' }));
    await page.evaluate(async (n) => {
      const root = window.__ZR_SCENE__();
      for (const child of root.children) {
        if ((child.name || '(unnamed)') !== n) continue;
        child.traverse((o) => { if (o.isMesh && o.userData.__wasCaster) { o.castShadow = true; o.userData.__wasCaster = false; } });
      }
      await window.__ZR__.render(2, 0);
    }, name);
    rows.systems[name] = { ...systems[name], off, depthDelta: base.triangles - off.triangles, drawDelta: base.draws - off.draws };
    console.error(`${name.padEnd(14)} casters ${systems[name].casters} depth ${(base.triangles - off.triangles) / 1000} K draws -${base.draws - off.draws}`);
    // restoring per-object castShadow needs the original value: re-render from a fresh page state is
    // avoided by only measuring one system per pass in the order above (each is restored by the world's
    // own per-frame submission for the systems that set it; the rest are restored below)
  }
  fs.writeFileSync(`${outDir}/depth.json`, JSON.stringify(rows, null, 1));
} finally { await browser.close(); await server.close(); }
