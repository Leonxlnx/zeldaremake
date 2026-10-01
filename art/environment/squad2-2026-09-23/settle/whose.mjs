// whose row arrives late at the flight's foot: the scene roll-up per system, frame by frame
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, log: () => {} });
  const out = await page.evaluate(async () => {
    const z = window.__ZR__;
    z.setTime(12.5);
    z.setPose([2.648, 1.85, 3.529], [6.038, 1.6, 0.884], 46);
    const seq = [];
    for (let f = 1; f <= 20; f++) {
      await z.render(1, 1 / 30);
      const s = z.stats();
      const by = z.audit().scene.bySystem;
      const row = {};
      for (const [k, v] of Object.entries(by)) row[k] = [v.meshes ?? null, v.triangles ?? null];
      seq.push({ frames: f, draws: s.drawCalls, triangles: s.triangles, by: row });
    }
    return seq;
  });
  console.log(JSON.stringify(out));
} finally { await browser.close(); await server.close(); }
