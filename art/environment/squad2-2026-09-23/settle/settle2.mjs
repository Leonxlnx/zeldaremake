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
    let total = 0;
    for (const step of [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4]) {
      await z.render(step, 1 / 30);
      total += step;
      const s = z.stats();
      const t = z.audit().systems.trees;
      const sub = t.submission;
      seq.push({
        frames: total,
        draws: s.drawCalls,
        triangles: s.triangles,
        treeDraws: sub.drawCalls,
        treeTriangles: sub.triangles,
        pinnedPending: t.nearCanopy?.pool?.pinnedPending ?? null,
        pending: t.nearCanopy?.pool?.pending ?? null,
        basePinnedPending: t.nearBase?.pool?.pinnedPending ?? null,
      });
    }
    return seq;
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); await server.close(); }
