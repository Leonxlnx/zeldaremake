#!/usr/bin/env node
/**
 * Render stills of the film or of single assets through the page's window.__LSW__ API.
 *
 *   node legosw/scripts/still.mjs --lab eta2-anakin [--bg space|studio] [--views "35,15;150,10"] [--zoom 1] [--t 0]
 *   node legosw/scripts/still.mjs --film --times 20,25.5,31
 *   common: [--size 1600x900] [--out /tmp/lsw-stills] [--url http://127.0.0.1:5174] [--dist <dir>] [--msaa 4] [--sheet]
 *
 * Without --url it serves --dist (default legosw/dist; run `npm run lsw:build` first). Views are
 * "yaw,pitch[,distMul]" in degrees, yaw 0 = looking at the model's nose (+Z). Lab stills are canvas-only;
 * film stills are the whole page (letterbox bars and subtitles included).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../../gauntlet/scripts/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const [width, height] = String(args.size || '1600x900').split('x').map(Number);
const out = path.resolve(args.out || '/tmp/lsw-stills');
fs.mkdirSync(out, { recursive: true });

async function main() {
  let server = null;
  let base = args.url;
  if (!base) {
    server = await serveStatic(path.resolve(args.dist || path.resolve(here, '../dist')));
    base = server.url;
  }
  const browser = await launchBrowser({ width, height });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.error(`[page:${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
    const q = new URLSearchParams({ capture: '1', msaa: String(args.msaa ?? 4) });
    if (args.lab) {
      q.set('lab', args.lab);
      q.set('bg', args.bg || 'studio');
    }
    const t0 = Date.now();
    await page.goto(`${base}/?${q}`, { waitUntil: 'load', timeout: 600000 });
    await page.waitForFunction(() => !!window.__LSW__, { timeout: 600000 });
    await page.evaluate(() => window.__LSW__.ready);
    console.error(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const files = [];
    if (args.lab) {
      const views = String(args.views || '35,15;145,12;-100,8;20,70').split(';').map((v) => v.split(',').map(Number));
      const clip = await page.evaluate(() => {
        const r = document.querySelector('canvas').getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      });
      for (const [i, [yaw, pitch, dist]] of views.entries()) {
        const t = Number(args.t ?? 0);
        const ms = await page.evaluate(
          ([yaw, pitch, dist, t]) => {
            const a = performance.now();
            window.__LSW__.labPose(yaw, pitch, dist, t);
            window.__LSW__.labRender(t);
            return performance.now() - a;
          },
          [yaw, pitch, dist || Number(args.zoom || 1), t],
        );
        const f = path.join(out, `${args.lab}-${i}.png`);
        await page.screenshot({ path: f, clip, captureBeyondViewport: false });
        const info = await page.evaluate(() => window.__LSW__.info());
        console.error(`${path.basename(f)}  yaw ${yaw} pitch ${pitch}  ${ms.toFixed(0)} ms  ${info.calls} calls  ${(info.triangles / 1000).toFixed(0)}k tris`);
        files.push(f);
      }
    } else {
      const times = String(args.times || '1').split(',').map(Number);
      for (const t of times) {
        const r = await page.evaluate(([t, sf]) => window.__LSW__.renderAt(t, sf), [t, Number(args.subframes || 1)]);
        const f = path.join(out, `film-${t.toFixed(2).padStart(6, '0')}.png`);
        await page.screenshot({ path: f, captureBeyondViewport: false });
        const info = await page.evaluate(() => window.__LSW__.info());
        console.error(`${path.basename(f)}  ${r.ms.toFixed(0)} ms  ${info.calls} calls  ${(info.triangles / 1000).toFixed(0)}k tris`);
        files.push(f);
      }
    }
    if (args.sheet && files.length > 1) {
      const sharp = (await import('sharp')).default;
      const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
      const w = metas[0].width, h = metas[0].height;
      const cols = Math.min(2, files.length);
      const rows = Math.ceil(files.length / cols);
      const sheet = sharp({ create: { width: w * cols, height: h * rows, channels: 3, background: '#000' } });
      const f = path.join(out, `${args.lab || 'film'}-sheet.png`);
      await sheet.composite(files.map((file, i) => ({ input: file, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(f);
      console.error(`sheet → ${f}`);
    }
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
