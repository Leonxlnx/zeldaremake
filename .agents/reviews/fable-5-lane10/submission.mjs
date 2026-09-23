// per-family draw / triangle split at the six fixed views — usage: node it86-submission.mjs <dist> <out.json>
import fs from 'node:fs';
import { serveStatic, launchBrowser, openWorld } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out] = process.argv.slice(2);
const server = await serveStatic(dist); const browser = await launchBrowser({ width: 640, height: 360 });
try {
  const { page } = await openWorld(browser, server.url, { width: 640, height: 360, quality: 'high', log: () => {} });
  const result = {};
  for (const id of ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy']) {
    const r = await page.evaluate(async (id) => {
      if (!window.__ZR__.setViewpoint(id)) throw new Error('no viewpoint ' + id);
      await window.__ZR__.render(3, 1 / 30);
      const st = window.__ZR__.stats();
      const a = window.__ZR__.audit();
      const t = a.systems.trees;
      const flat = (o, prefix = '') => Object.entries(o || {}).flatMap(([k, v]) => (v && typeof v === 'object' && !('calls' in v) ? flat(v, prefix + k + '/') : [[prefix + k, v]]));
      return { draws: st.draws ?? st.calls ?? st.render?.calls ?? null, triangles: st.triangles ?? st.render?.triangles ?? null, statsKeys: Object.keys(st), submission: t.submission, sceneTriangles: a.scene?.triangles, sceneInstances: a.scene?.instances };
    }, id);
    result[id] = r;
    const sub = r.submission || {};
    const fam = Object.entries(sub.byFamily || sub).filter(([, v]) => v && typeof v === 'object' && 'triangles' in v).sort((x, y) => y[1].triangles - x[1].triangles);
    console.error(`${id}: draws ${r.draws} tris ${r.triangles} | ` + fam.slice(0, 10).map(([k, v]) => `${k} ${(v.triangles / 1e6).toFixed(2)}M/${v.calls}`).join(', '));
    if (id === 'A_stairs') console.error('  stats keys:', r.statsKeys.join(','), '| submission keys:', Object.keys(sub).join(','));
  }
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
} catch (e) { console.error('ERR', e && e.stack || e); }
finally { await browser.close().catch(() => {}); await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {}); process.exit(0); }
