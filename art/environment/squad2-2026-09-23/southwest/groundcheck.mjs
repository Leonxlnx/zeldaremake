#!/usr/bin/env node
/**
 * groundcheck.mjs — is a pose's camera standing on the ground, or buried in it?
 *
 *   node art/environment/squad2-2026-09-23/southwest/groundcheck.mjs <dist> [--eye 1.75]
 *
 * `southwest/README.md` reports a bad-looking frame at `(-8, 1.75, 7)` and says the first thing to settle
 * is whether a player can stand there at all, because that pose was authored to frame the detached boughs
 * rather than by walking to it. A camera placed at an absolute `y` is only a player's eye if the ground
 * beneath it is at `y − eyeHeight`; put it lower and the camera is inside the terrain or inside whatever
 * grows at ground level, which would explain foliage that reads as arm's length.
 *
 * `__ZR__.probe(x, z)` returns the heightfield's own height, slope and mask at a world xz, so this needs no
 * rendering at all — one page load and a handful of reads. Every pose this lane uses is checked, not just
 * the suspect ones, because a number is only meaningful next to the poses known to be good.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = positional[0] ?? 'dist';
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
/** a standing player's eye above the ground: camera/follow.ts FOLLOW.eyeHeight */
const EYE = Number(flag('eye', 1.75));

/** every camera position this lane has rendered from, with the y it was authored at */
const POSES = [
  ['sw-plaza-edge', -2, 4, 1.75],
  ['sw-approach', -8, 7, 1.75],
  ['sw-under', -14, 9, 1.75],
  ['A_stairs', 0.4, 8.6, 1.8],
  ['B_house', 0, 2.0, 1.5],
  ['C_lookback', 2.33, -7.67, 1.45],
  ['D_log', 0.2, -3.0, 1.45],
  ['F_canopy', -1.96, 4.0, 1.8],
  ['owner-0650-north', 1.4, -10.2, 1.75],
  ['owner-0650-west', 1.2, -9.0, 1.75],
];

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 480, height: 270 });
try {
  const { page } = await openWorld(browser, server.url, { width: 480, height: 270, log: () => {} });
  const rows = await page.evaluate(
    ([poses, eye]) =>
      poses.map(([name, x, z, y]) => {
        const p = window.__ZR__.probe(x, z);
        const mask = Object.entries(p.mask)
          .filter(([, v]) => v > 0.01)
          .map(([k, v]) => `${k} ${v.toFixed(2)}`)
          .join(' ');
        return { name, x, z, cameraY: y, ground: Number(p.height.toFixed(3)), slope: Number(p.slope.toFixed(3)), above: Number((y - p.height).toFixed(3)), standing: Number((p.height + eye).toFixed(3)), mask };
      }),
    [POSES, EYE],
  );
  console.log(`eye height ${EYE} m — "above" is the camera's height over the ground, and should be about that\n`);
  console.log('pose                  x       z   camera y   ground   above    a standing eye would be   slope   mask');
  for (const r of rows) {
    const verdict = r.above < 0 ? 'UNDERGROUND' : r.above < EYE * 0.5 ? 'too low' : Math.abs(r.above - EYE) < 0.6 ? 'ok' : 'high';
    console.log(
      `${r.name.padEnd(18)} ${String(r.x).padStart(6)} ${String(r.z).padStart(7)} ${String(r.cameraY).padStart(9)} ${String(r.ground).padStart(8)} ${String(r.above).padStart(7)} ${String(r.standing).padStart(24)} ${String(r.slope).padStart(7)}   ${verdict}${r.mask ? `  [${r.mask}]` : ''}`,
    );
  }
  fs.writeFileSync(flag('json', '/tmp/groundcheck.json'), JSON.stringify({ dist, eye: EYE, rows }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
