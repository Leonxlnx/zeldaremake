// How many frames do the near pools need after a re-pose before the frame stops changing?
// The take path renders with --settle 6; this asks whether 6 is enough at a fresh pose.
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const server = await serveStatic(process.argv[2] ?? 'dist');
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, log: () => {} });
  const out = await page.evaluate(async () => {
    const z = window.__ZR__;
    z.setTime(12.5);
    const poses = {
      foot: [[2.648, 1.85, 3.529], [6.038, 1.6, 0.884]],
      'owner-north': [[1.4, 1.75, -10.2], [2.0, 1.45, -20.0]],
    };
    const res = {};
    for (const [name, [p, t]] of Object.entries(poses)) {
      z.setPose(p, t, 46);
      const seq = [];
      let total = 0;
      for (const step of [1, 1, 2, 2, 2, 4, 4, 8, 8, 16]) {
        await z.render(step, 1 / 30);
        total += step;
        const s = z.stats();
        const a = z.audit().systems.trees;
        seq.push({
          frames: total,
          draws: s.drawCalls,
          triangles: s.triangles,
          nearBaseShown: a.nearBase?.shown?.length ?? null,
          nearCanopyShown: a.nearCanopy?.shown?.length ?? a.nearCanopy?.shownParts ?? null,
          pool: a.nearCanopy?.pool ?? null,
        });
      }
      res[name] = seq;
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); await server.close(); }
