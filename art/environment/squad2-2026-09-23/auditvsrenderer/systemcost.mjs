#!/usr/bin/env node
/**
 * systemcost.mjs — every system's frame cost from the renderer, beside what its own audit claims.
 *
 *   node art/environment/squad2-2026-09-23/auditvsrenderer/systemcost.mjs <dist> <out.json> \
 *        [--view A_stairs] [--quality high] [--settle 8]
 *
 * `auditvsrenderer/` found the trees' submission row 36 draws and 820 K triangles out at hero A, and
 * `roofdraws/` found the canopy had no per-frame row at all — six draws a frame went unnoticed because
 * nothing in the repo compared a system's own number against the renderer's. Both were this lane's own
 * systems. This asks the same question of all eleven at once, in ONE page load: `isolate(group)` per system
 * (`src/capture/api.ts` — hides every other scene child, resets `renderer.info`, renders directly, so no
 * composer and no post quads), beside every cost-shaped field its audit publishes.
 *
 * It changes nothing and reads only. What it cannot do is tell a wrong row from a right one when a system
 * publishes a BUILT total rather than a submitted one — `canopyRoof.triangles` was the roof as built and
 * happened to match because nothing was ever culled. So the output is a starting point for each owner, not
 * a verdict on their system.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = positional[0] ?? 'dist';
const out = positional[1] ?? '/tmp/systemcost.json';
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
const view = String(flag('view', 'A_stairs'));
const quality = flag('quality', 'high');
const settle = Number(flag('settle', 8));

/** src/world/index.ts's SYSTEMS order, with the one audit key that differs from its group name */
const SYSTEMS = [
  ['lighting', 'lighting'],
  ['atmosphere', 'atmosphere'],
  ['terrain', 'terrain'],
  ['hardscape', 'hardscape'],
  ['rocks', 'rocks'],
  ['trees', 'trees'],
  ['canopy', 'canopyRoof'],
  ['structures', 'structures'],
  ['props', 'props'],
  ['vegetation', 'vegetation'],
  ['character', 'character'],
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 960, height: 540 });
try {
  const { page } = await openWorld(browser, server.url, { width: 960, height: 540, quality, log: () => {} });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  const ok = await page.evaluate((v) => window.__ZR__.setViewpoint(v), view);
  if (ok === false) throw new Error(`no viewpoint "${view}" — setViewpoint returned false and the camera did not move`);
  await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), settle);
  const data = await page.evaluate(async (systems) => {
    await window.__ZR__.render(2, 0);
    const frame = window.__ZR__.stats();
    const audits = window.__ZR__.audit().systems;
    /** the fields a system might publish a per-frame cost in, in the order they would be trusted */
    const pick = (a) => {
      if (!a) return null;
      const sub = a.submission ?? null;
      const draws = sub?.drawCalls ?? sub?.draws ?? a.drawCalls ?? a.draws ?? null;
      const tris = sub?.triangles ?? a.triangles ?? null;
      return { draws, triangles: tris, fromSubmission: sub !== null && sub !== undefined };
    };
    const rows = [];
    for (const [group, key] of systems) {
      const claim = pick(audits[key]);
      // the isolate render goes last for each system so the audit above describes the settled frame
      const iso = window.__ZR__.isolate(group);
      rows.push({ group, key, found: iso.found, renderer: { draws: iso.drawCalls, triangles: iso.triangles }, claim });
    }
    return { frame: { draws: frame.drawCalls, triangles: frame.triangles }, rows, auditKeys: Object.keys(audits).sort() };
  }, SYSTEMS);

  const n = (v) => (v === null || v === undefined ? '—' : String(v));
  console.log(`${view}  frame ${data.frame.draws} draws / ${data.frame.triangles} triangles\n`);
  console.log(`${'system'.padEnd(12)} ${'renderer'.padStart(18)}   ${'the audit\u2019s own claim'.padStart(22)}   note`);
  let sumD = 0;
  let sumT = 0;
  for (const r of data.rows) {
    sumD += r.renderer.draws;
    sumT += r.renderer.triangles;
    const claim = r.claim && (r.claim.draws !== null || r.claim.triangles !== null) ? `${n(r.claim.draws)}/${n(r.claim.triangles)}` : 'none';
    const note = !r.found
      ? 'no scene child of that name'
      : claim === 'none'
        ? 'NO PER-FRAME FIGURE'
        : r.claim.draws === r.renderer.draws && r.claim.triangles === r.renderer.triangles
          ? 'agrees exactly'
          : r.claim.fromSubmission
            ? `submission row differs by ${r.renderer.draws - (r.claim.draws ?? 0)} draws / ${r.renderer.triangles - (r.claim.triangles ?? 0)} tris`
            : 'a BUILT total, not a submitted one';
    console.log(`${r.group.padEnd(12)} ${`${r.renderer.draws}/${r.renderer.triangles}`.padStart(18)}   ${claim.padStart(22)}   ${note}`);
  }
  console.log(`\nsum of the isolates: ${sumD} draws / ${sumT} triangles against the frame's ${data.frame.draws} / ${data.frame.triangles}`);
  console.log(`audit keys present: ${data.auditKeys.join(', ')}`);
  fs.writeFileSync(out, JSON.stringify({ dist, view, quality, settle, ...data }, null, 1));
  console.log(`→ ${out}`);
} finally {
  await browser.close();
  await server.close();
}
