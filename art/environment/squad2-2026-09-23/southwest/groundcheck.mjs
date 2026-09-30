#!/usr/bin/env node
/**
 * groundcheck.mjs — is a pose's camera standing on the ground, or buried in it?
 *
 *   node art/environment/squad2-2026-09-23/southwest/groundcheck.mjs <dist> \
 *        [--poses a.json,b.json | --all] [--eye 1.75] [--json out.json]
 *
 * `southwest/README.md` is why this exists. A frame that looked like a real defect — large hard-edged
 * foliage at arm's length — turned out to be a camera **23 mm above the ground**, because the pose was
 * authored by aiming at a subject and giving `y` an absolute 1.75. That is a standing eye on the flat plaza,
 * where nearly every pose in this lane sits, and ground level anywhere the terrain rises.
 *
 * A camera placed at an absolute `y` is only a player's eye if the ground beneath it is at `y − eyeHeight`.
 * `__ZR__.probe(x, z)` returns the heightfield's own height, slope and mask at a world xz, so checking that
 * needs **no rendering at all** — one page load and a read per pose. Two minutes against the forty a strip
 * costs, which is the whole argument for running it before believing any frame.
 *
 * `--all` audits every pose file this lane has ever measured from, because a conclusion is only as good as
 * the pose it came from and this lane has twenty of them.
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
const has = (name) => argv.includes(`--${name}`);
const dist = positional[0] ?? 'dist';
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`no index.html in ${dist} — build first`);
/** a standing player's eye above the ground: camera/follow.ts FOLLOW.eyeHeight */
const EYE = Number(flag('eye', 1.75));
const LANE = path.resolve('art/environment/squad2-2026-09-23');

/** the fixed viewpoints, as a calibration set: these are known good and their ground is known flat */
const FIXED = [
  ['A_stairs (fixed)', 0.4, 8.6, 1.8],
  ['B_house (fixed)', 0, 2.0, 1.5],
  ['C_lookback (fixed)', 2.33, -7.67, 1.45],
  ['D_log (fixed)', 0.2, -3.0, 1.45],
  ['F_canopy (fixed)', -1.96, 4.0, 1.8],
];

/** every `{ name, from: { p } }` in a broll-format file, plus the owner's pose file shape */
const readPoses = (file) => {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    const p = e?.from?.p ?? e?.p;
    if (!Array.isArray(p) || p.length !== 3 || p.some((v) => typeof v !== 'number')) continue;
    out.push([`${path.basename(path.dirname(file))}/${path.basename(file, '.json')}:${e.name ?? '?'}`, p[0], p[2], p[1]]);
  }
  return out;
};

let poses = [...FIXED];
if (has('all')) {
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.json') && /pose|shot|smoke/i.test(name)) files.push(full);
    }
  };
  walk(LANE);
  files.push(path.resolve('art/environment/owner-2026-09-23/pass3/owner-0650-poses.json'));
  for (const f of files.sort()) poses.push(...readPoses(f));
} else if (flag('poses')) {
  for (const f of String(flag('poses')).split(',')) poses.push(...readPoses(path.resolve(f)));
}
if (poses.length === FIXED.length && !has('all') && !flag('poses')) throw new Error('pass --all or --poses <files>');

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 480, height: 270 });
try {
  const { page } = await openWorld(browser, server.url, { width: 480, height: 270, log: () => {} });
  const rows = await page.evaluate(
    ([list, eye]) =>
      list.map(([name, x, z, y]) => {
        const p = window.__ZR__.probe(x, z);
        const mask = Object.entries(p.mask)
          .filter(([, v]) => v > 0.01)
          .map(([k, v]) => `${k} ${v.toFixed(2)}`)
          .join(' ');
        return { name, x, z, cameraY: y, ground: Number(p.height.toFixed(3)), slope: Number(p.slope.toFixed(3)), above: Number((y - p.height).toFixed(3)), standing: Number((p.height + eye).toFixed(3)), mask };
      }),
    [poses, EYE],
  );
  const verdict = (r) => (r.above < 0 ? 'UNDERGROUND' : r.above < EYE * 0.5 ? 'TOO LOW' : r.above > EYE * 3 ? 'well above head height' : Math.abs(r.above - EYE) < 0.6 ? 'ok' : 'high');
  console.log(`eye height ${EYE} m — "above" is the camera's height over the ground; a standing eye is about that\n`);
  console.log('pose                                      camera y   ground    above   standing eye   slope   verdict');
  for (const r of rows) {
    console.log(
      `${r.name.slice(0, 40).padEnd(41)} ${String(r.cameraY).padStart(8)} ${String(r.ground).padStart(8)} ${String(r.above).padStart(8)} ${String(r.standing).padStart(14)} ${String(r.slope).padStart(7)}   ${verdict(r)}${r.mask ? `  [${r.mask}]` : ''}`,
    );
  }
  const bad = rows.filter((r) => ['UNDERGROUND', 'TOO LOW'].includes(verdict(r)));
  console.log(`\n${rows.length} poses read. ${bad.length ? `${bad.length} at or below the ground:` : 'none at or below the ground.'}`);
  for (const r of bad) console.log(`  ${r.name}  ${r.above} m above ground (a standing eye would be ${r.standing})`);
  fs.writeFileSync(flag('json', '/tmp/groundcheck.json'), JSON.stringify({ dist, eye: EYE, rows: rows.map((r) => ({ ...r, verdict: verdict(r) })) }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
