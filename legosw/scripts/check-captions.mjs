#!/usr/bin/env node
/**
 * Caption QA without rendering: every subtitle cue at several page sizes, in the export layout and the
 * realtime-viewer layout (bottom 64 px kept for the transport bar). Fails if a cue leaves the 4% side
 * margins, runs under the transport bar or off the page.
 *
 *   node legosw/scripts/check-captions.mjs --dist <dir>
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser } from '../../gauntlet/scripts/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const layouts = [
  { name: 'export 1280x720', w: 1280, h: 720, reserve: 0 },
  { name: 'viewer 1186x893 (director)', w: 1186, h: 893, reserve: 64 },
  { name: 'viewer 1920x1080', w: 1920, h: 1080, reserve: 64 },
  { name: 'viewer 1366x768', w: 1366, h: 768, reserve: 64 },
  { name: 'viewer 1920x800 (wide)', w: 1920, h: 800, reserve: 64 },
  { name: 'viewer 844x390 (phone landscape)', w: 844, h: 390, reserve: 64 },
];
const server = await serveStatic(path.resolve(args.dist || path.resolve(here, '../dist')));
const browser = await launchBrowser({ width: 1920, height: 1080 });
let fails = 0;
try {
  for (const L of layouts) {
    const page = await browser.newPage();
    await page.setViewport({ width: L.w, height: L.h, deviceScaleFactor: 1 });
    await page.goto(`${server.url}/?capture=1&msaa=1&reserve=${L.reserve}`, { waitUntil: 'load', timeout: 600000 });
    await page.waitForFunction(() => !!window.__LSW__, { timeout: 600000 });
    await page.evaluate(() => window.__LSW__.ready);
    console.log(`\n${L.name}`);
    const cues = await page.evaluate(() => {
      const out = [];
      for (const s of window.__LSW__.shots()) {
        for (const l of s.lines) {
          // sample the middle of each cue: probe a few times until the caption is up
          for (let T = s.start + 0.2; T < s.end; T += 0.1) {
            const c = window.__LSW__.captionAt(T);
            if (c.text.includes(l.text.slice(0, 12))) {
              out.push({ shot: s.name, T, ...c });
              break;
            }
          }
        }
      }
      return out;
    });
    for (const c of cues) {
      const [x0, y0, x1, y1] = c.box;
      const [W, H] = c.page;
      const lineH = c.font * 1.25;
      const nLines = Math.round((y1 - y0) / lineH);
      const inMargins = x0 >= W * 0.04 - 0.5 && x1 <= W * 0.96 + 0.5;
      const aboveBar = y1 <= H - L.reserve + 0.5;
      const inLowerBar = y0 >= c.pic[3] - 0.5;
      const ok = inMargins && aboveBar && y0 >= 0;
      if (!ok) fails++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.shot.padEnd(17)} ${String(nLines).padStart(1)} line(s) ${c.font}px  x ${x0.toFixed(0)}–${x1.toFixed(0)} of ${W}  y ${y0.toFixed(0)}–${y1.toFixed(0)} of ${H}${L.reserve ? ` (bar from ${H - L.reserve})` : ''}  ${inLowerBar ? 'in lower bar' : 'over picture foot'}  "${c.text.slice(0, 48)}${c.text.length > 48 ? '…' : ''}"`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
