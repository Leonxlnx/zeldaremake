// squad2: one frame per top-level system, so a suspect region can be attributed by eye as well as
// by count. `__ZR__.isolate(system)` renders the frame with that system alone (plus lighting) and
// returns its counts; the canvas still holds that render, so a screenshot right after is that
// system's own frame.
//
//   node art/environment/squad2-2026-09-23/isolateshots.mjs <dist> <shots.json> <outDir> [systems]
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';

const [dist = 'dist', shotsPath, outDir = '/tmp/isolateshots', systemsArg] = process.argv.slice(2);
const W = 960, H = 540, SETTLE = 8;
const log = (...m) => console.error(`[isolate ${new Date().toISOString().slice(11, 19)}]`, ...m);
const shots = JSON.parse(fs.readFileSync(path.resolve(shotsPath), 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: W, height: H });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width: W, height: H, log });
  for (const shot of shots) {
    log(`pose ${shot.name}`);
    await page.evaluate((sh) => {
      window.__ZR__.setTime(12.5);
      if (sh.viewpoint) window.__ZR__.setViewpoint(sh.viewpoint);
      else window.__ZR__.setPose(sh.from.p, sh.from.t, sh.from.fov);
    }, shot);
    await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), SETTLE);
    const canvas = await page.$('canvas');
    await canvas.screenshot({ path: path.join(outDir, `${shot.name}-all.png`) });
    const names = systemsArg
      ? systemsArg.split(',')
      : Object.entries(await page.evaluate(() => window.__ZR__.audit().scene.bySystem))
          .sort((a, b) => b[1].triangles - a[1].triangles)
          .slice(0, 6)
          .map(([n]) => n);
    for (const n of names) {
      const part = await page.evaluate((s) => window.__ZR__.isolate(s), n);
      await canvas.screenshot({ path: path.join(outDir, `${shot.name}-${n}.png`) });
      log(`  ${n}: ${(part.triangles / 1e6).toFixed(3)} M / ${part.drawCalls} draws${part.found ? '' : ' (NOT FOUND)'}`);
      rows.push({ pose: shot.name, ...part });
    }
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(outDir, 'isolate.json'), JSON.stringify(rows, null, 1));
console.log(`→ ${outDir}`);
