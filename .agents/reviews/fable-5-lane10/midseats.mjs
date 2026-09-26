// dump the mid-canopy seats (x, z, variant) and the trees nearest to the owner's poses
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const dist = process.argv[2];
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { width: 640, height: 360, quality: 'low', log: () => {} });
  const a = await page.evaluate(() => { const t = window.__ZR__.audit().systems.trees; return { mid: t.midCanopy, distantLod: t.distantLod }; });
  const seats = a.mid.seats; console.log(JSON.stringify({ trees: a.mid.trees, culled: a.mid.culled, band: a.mid.band, heights: a.mid.heights, crown: a.mid.crown, farLodM: a.mid.farLodM }));
  const poses = { 'u-open-up': [1.5, -40], 'h-west-front cam': [-1.0, -21.5], 'h-west-front mid-ray': [-3.3, -26.4], 'owner-0650 cam': [1.5, -10.5], 'owner-0650 mid': [1.5, -18] };
  for (const [name, [x, z]] of Object.entries(poses)) {
    const near = seats.map(([sx, sz, v]) => ({ x: sx, z: sz, v, h: a.mid.heights[v], crownR: a.mid.crown[v][1] * a.mid.heights[v], crownY: a.mid.crown[v][2] * a.mid.heights[v], d: Math.hypot(sx - x, sz - z) })).sort((p, q) => p.d - q.d).slice(0, 4);
    console.log(name, JSON.stringify(near.map((p) => ({ at: [p.x, p.z], d: +p.d.toFixed(1), height: p.h, crownR: +p.crownR.toFixed(1), crownBaseY: +(p.crownY - p.crownR).toFixed(1), crownCentreY: +p.crownY.toFixed(1) }))));
  }
} catch (e) { console.error('ERR', e && e.stack || e); } finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
