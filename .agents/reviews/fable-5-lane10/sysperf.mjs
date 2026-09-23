// per-system update time at the play spots — usage: node it83-sysperf.mjs <dist> <out.json>
// Places Link at the harness's four perf spots (playtest.mjs lookSpots), settles 30 frames, then steps 60 frames
// (a draw every 6th) and averages window.__ZR__.perf().systems (ms per step, per system) and the play hook's
// perf.update / perf.render.
import fs from 'node:fs';
import { serveStatic, launchBrowser } from '/workspace/gauntlet/scripts/lib/browser.mjs';
const [dist, out] = process.argv.slice(2);
const DT = 1 / 30;
const deg = (r) => (r * 180) / Math.PI;
const m = { base: [7.3, 0, -0.1], dir: [1, -0.78] };
const l = Math.hypot(m.dir[0], m.dir[1]); const dx = m.dir[0] / l; const dz = m.dir[1] / l;
const spots = [
  { id: 'plaza', at: [0.5, 1.0], yaw: 180 },
  { id: 'stairs2-base', at: [m.base[0] + dx * -1.6, m.base[2] + dz * -1.6], yaw: deg(Math.atan2(dx, dz)) },
  { id: 'saria-side', at: [8.2, -6.8], yaw: deg(Math.atan2(4.3, -4.7)) },
  { id: 'west-house', at: [-16.3, 6.5], yaw: deg(Math.atan2(-6.7, 2.5)) },
];
const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
const t0 = Date.now();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[page:error] ${m.text()}`); });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  console.error('goto…');
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 900_000 });
  console.error(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  console.error(`__ZR__ in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = `error: ${e?.message ?? e}`)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 1000 });
  console.error(`ready state: ${await page.evaluate(() => window.__zrReadyState)} at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 900_000, polling: 500 });
  console.error(`ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const result = { dist, spots: {} };
  for (const s of spots) {
    await page.evaluate(([x, z, yaw]) => window.__ZR_PLAY__.place(x, z, (yaw * Math.PI) / 180), [s.at[0], s.at[1], s.yaw]);
    await page.evaluate(([n, dt]) => window.__ZR_PLAY__.step(n, dt, false), [30, DT]);
    for (let k = 0; k < 2; k++) await page.evaluate((dt) => window.__ZR_PLAY__.step(1, dt, true), DT);
    const r = await page.evaluate(([dt, N]) => {
      const sums = {}; let upd = 0; let ren = 0; let drawn = 0; let steps = 0;
      const heap0 = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
      for (let i = 0; i < N; i++) {
        const drawNow = i % 6 === 0;
        window.__ZR_PLAY__.step(1, dt, drawNow);
        const p = window.__ZR__.perf();
        for (const [k, v] of Object.entries(p.systems ?? {})) sums[k] = (sums[k] ?? 0) + v;
        const st = window.__ZR_PLAY__.state();
        upd += st.perf.update; steps++;
        if (drawNow) { ren += st.perf.render; drawn++; }
      }
      const heap1 = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
      const systems = Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, +(v / steps).toFixed(3)]));
      const p = window.__ZR__.perf();
      return { systems, updateMs: +(upd / steps).toFixed(2), renderMs: +(ren / Math.max(1, drawn)).toFixed(2), draws: p.draws ?? p.calls ?? null, triangles: p.triangles ?? null, heapMB: [heap0, heap1].map((v) => (v == null ? null : +v.toFixed(1))), systemPerfKeys: Object.keys(p.systemPerf ?? {}) };
    }, [DT, 60]);
    result.spots[s.id] = r;
    const top = Object.entries(r.systems).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
    console.error(`${s.id}: update ${r.updateMs} ms, render ${r.renderMs} ms, heap ${r.heapMB.join('→')} | ${top}`);
  }
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
} finally {
  await browser.close().catch(() => {});
  await Promise.race([Promise.resolve(server.close()), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  process.exit(0);
}
