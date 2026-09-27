// the same 20 frames, clock frozen (dt 0) and then advancing (dt 1/30), at the same pose
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const server = await serveStatic('dist');
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, log: () => {} });
  const out = await page.evaluate(async () => {
    const z = window.__ZR__;
    const read = () => { const s = z.stats(); return `${s.drawCalls}/${s.triangles}`; };
    const runs = {};
    for (const dt of [0, 1 / 30]) {
      z.setTime(12.5);
      z.setPose([2.648, 1.85, 3.529], [6.038, 1.6, 0.884], 46);
      const seq = [];
      for (let f = 1; f <= 20; f++) {
        await z.render(1, dt);
        seq.push(read());
      }
      runs[dt === 0 ? 'frozen' : 'advancing'] = seq;
    }
    return { runs, time: z.getTime?.() ?? null };
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); await server.close(); }
