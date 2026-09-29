#!/usr/bin/env node
/**
 * gatesweep.mjs — `dither/PROPOSAL.md` check 4, run without walking the camera.
 *
 *   node art/environment/squad2-2026-09-23/gatesweep/gatesweep.mjs <dist> <out> \
 *        [--pose art/.../hero-poses.json] [--view A_stairs] [--gates 29,30,31,32,33,34,35] \
 *        [--size 960x540] [--settle 8] [--quality high]
 *
 * The proposal asks whether the high→medium rung swap reads as ONE large step (a pop) or as several
 * small ones (a fade). Walking the camera across the gate answers it, but every frame of such a strip
 * also changes parallax, exposure-relevant sky area and the set of trees in shot, so the step under
 * test is buried in a much larger difference.
 *
 * So the camera stands still and the GATE moves instead. `bucketFamily` assigns rungs from
 * `d < lodDist[0]`, and `lodDist` is the same array the trees audit publishes as
 * `lodSwapM.tree` — so writing `lodSwapM.tree[0] = 33` and re-applying the pose (`setPose` always
 * calls `notifyCameraMove`, which forces `rebucket(camera, true)`) re-buckets the whole world at a
 * different gate with nothing else changed. A tree at 32.4 m crossing a gate that walks 30 → 35 m sees
 * exactly what it would see if the camera walked 30 → 35 m toward it, minus the parallax.
 *
 * The clock is frozen for every read (frozen.mjs's protocol and for its reasons: with time running,
 * wind moves 13–31 % of the frame between steps and swamps the measurement).
 *
 * Output: one PNG per gate, `sweep.json` with each gate's draws / triangles / md5 and the
 * step-to-step SSIM and changed-pixel share against the previous gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serveStatic, launchBrowser, openWorld } from '../../../../gauntlet/scripts/lib/browser.mjs';
import { toGray, toRgb, ssim, pixelDiffFraction } from '../../../../gauntlet/scripts/lib/image.mjs';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dist = positional[0] ?? 'dist';
const out = positional[1] ?? '/tmp/gatesweep';
if (dist.startsWith('--') || out.startsWith('--')) throw new Error(`dist and out are POSITIONAL: got dist=${dist} out=${out}`);
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
const [width, height] = String(flag('size', '960x540')).split('x').map(Number);
const settle = Number(flag('settle', 8));
const quality = flag('quality', 'high');
const gates = String(flag('gates', '29,30,31,32,33,34,35')).split(',').map(Number);
const view = flag('view', null);
const poseFile = flag('pose', null);
const poseName = flag('poseName', null);

let pose = null;
if (poseFile) {
  const list = JSON.parse(fs.readFileSync(path.resolve(poseFile), 'utf8'));
  const entry = poseName ? list.find((p) => p.name === poseName) : list[0];
  if (!entry) throw new Error(`pose ${poseName} not in ${poseFile}`);
  pose = entry.from ?? entry;
}
if (!pose && !view) throw new Error('pass --view <id> or --pose <file> [--poseName <name>]');
fs.mkdirSync(out, { recursive: true });

const server = await serveStatic(dist);
const browser = await launchBrowser({ width, height });
const rows = [];
try {
  const { page } = await openWorld(browser, server.url, { width, height, quality, log: () => {} });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.evaluate(() => window.__ZR__.setTime(12.5));
  if (view) await page.evaluate((v) => window.__ZR__.setViewpoint(v), view);
  else await page.evaluate((f) => window.__ZR__.setPose(f.p, f.t, f.fov ?? 46), pose);
  // settle WITH time once, so the near-canopy pool is resident; the sweep itself never advances it
  await page.evaluate(async (n) => await window.__ZR__.render(n, 1 / 30), settle);
  const live = await page.evaluate(() => {
    const t = window.__ZR__.audit().systems.trees;
    return { gates: t.lodSwapM?.tree ?? null, dither: t.lodDither ?? null };
  });
  console.error(`the build's own gates: ${JSON.stringify(live.gates)}`);
  for (const g of gates) {
    const stats = await page.evaluate(
      async ([gate, v, p]) => {
        const t = window.__ZR__.audit().systems.trees;
        t.lodSwapM.tree[0] = gate; // the live array bucketFamily reads
        // force a rebucket at the new gate: setPose -> notifyCameraMove -> onCameraMove(force)
        if (v) window.__ZR__.setViewpoint(v);
        else window.__ZR__.setPose(p.p, p.t, p.fov ?? 46);
        await window.__ZR__.render(2, 0);
        const s = window.__ZR__.stats();
        const a = window.__ZR__.audit().systems.trees;
        return {
          gateApplied: a.lodSwapM.tree[0],
          draws: s.drawCalls,
          triangles: s.triangles,
          treeDraws: a.submission?.drawCalls ?? null,
          treeTriangles: a.submission?.triangles ?? null,
        };
      },
      [g, view, pose],
    );
    if (Math.abs(stats.gateApplied - g) > 1e-6) throw new Error(`gate write did not stick: asked ${g}, read ${stats.gateApplied}`);
    const png = await page.screenshot({ type: 'png' });
    const file = path.join(out, `gate-${String(g).replace('.', 'p')}.png`);
    fs.writeFileSync(file, png);
    rows.push({ gate: g, ...stats, file, md5: crypto.createHash('md5').update(png).digest('hex') });
    console.error(`gate ${g} m -> ${stats.draws}/${stats.triangles} trees ${stats.treeDraws}/${stats.treeTriangles}`);
  }
} finally {
  await browser.close();
  await server.close();
}

// step-to-step difference: a hard cut is one large spike, a working fade is several small ones
for (let i = 1; i < rows.length; i++) {
  const [a, b] = [rows[i - 1], rows[i]];
  const [ga, gb] = [await toGray(a.file, width, height), await toGray(b.file, width, height)];
  const [ra, rb] = [await toRgb(a.file, width, height), await toRgb(b.file, width, height)];
  rows[i].stepSsim = Number(ssim(ga, gb, width, height).toFixed(5));
  rows[i].stepChangedPct = Number((pixelDiffFraction(ra, rb, 8) * 100).toFixed(3));
  rows[i].stepIdentical = a.md5 === b.md5;
}
fs.writeFileSync(path.join(out, 'sweep.json'), JSON.stringify(rows, null, 1));
console.log(
  rows
    .map((r) => `gate ${String(r.gate).padStart(4)} m  ${r.draws}/${r.triangles}  step ssim ${r.stepSsim ?? '—'}  changed ${r.stepChangedPct ?? '—'}%`)
    .join('\n'),
);
