#!/usr/bin/env node
/**
 * audible.mjs — would occluding the flame or the glint be HEARD? (rubric check 45, the rest of it)
 *
 *   node art/audio/2026-09-26-shadow2/audible.mjs --dist dist [--out /tmp/shadow2]
 *
 * `2026-09-25-occlusion` built the birds' shadow and closed with a plan for the other two sources
 * in the bed:
 *
 *     "Fairy glints are as shadowable but only audible within about 4.3 m, where you are rarely
 *      behind a bole from one."
 *     "The flame is still worth having behind the west house specifically: 6.80 m of wall and
 *      interior gives N = 12.7, a real shadow, and five pods sit where that applies."
 *     "Occlude the birds first, the flame second."
 *
 * Both of those are Fresnel numbers, and a Fresnel number only says a shadow would be DEEP. It says
 * nothing about whether the thing being shadowed is contributing anything to begin with — and these
 * two sources fall off fast. A pod lantern is at half level 1.3 m away (`LANTERN_REACH_M`), so a
 * pod seven metres off behind the west house is already down to 3 % before anything shadows it, and
 * a fairy is inaudible past 4.3 m, where there is not much room for a two-metre bole to fit.
 *
 * So the number that decides the build is not N. It is the SHADOWED SHARE: of the level actually
 * arriving at the listener from that source, how much of it comes from behind something.
 *
 *     share = sum over sources of (attenuation_i * shadow_i) / sum of attenuation_i
 *
 * A share of 0.5 is 6 dB of duck available and worth building. A share of 0.02 is 0.2 dB and is
 * not a feature, it is a way to spend CPU on every tick for ever.
 *
 * This asks it over the ground a player can actually stand on, using the world's own geometry:
 * `podSpots` and `fairySpots` from `__ZR_AUDIO__.stats()`, `occlusionAt` from the shipped module,
 * and `surfaceAt` to keep the sample points on real standing ground.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { serveStatic, launchBrowser, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  const src = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', src)(
    (n) => {
      if (!n.startsWith('.')) return nodeRequire(n);
      const t = path.resolve(path.dirname(file), n);
      for (const c of [t + '.ts', path.join(t, 'index.ts'), t]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${n} from ${file}`);
    },
    m,
    m.exports,
  );
  return m.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const out = path.resolve(args.out || '/tmp/shadow2');
fs.mkdirSync(out, { recursive: true });

const A = loadTs('src/audio/index.ts');
const AMB = loadTs('src/audio/ambience.ts');
const { occlusionAt, surfaceAt } = A;
const { LANTERN_REACH_M, LANTERN_CROWD_SHARE, FAIRY_REACH_M, FAIRY_AUDIBLE_M } = AMB;

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
let spots;
try {
  // play mode, not capture: the shell only mounts audio when it is not headless, and `stats()` —
  // which is the only published source of `podSpots` and `fairySpots` — returns null without it
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAY__, { timeout: READY_TIMEOUT_MS, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  for (let i = 0; i < 2; i++) {
    await page.keyboard.down('KeyM');
    await page.keyboard.up('KeyM');
  }
  await new Promise((r) => setTimeout(r, 1200));
  // the fairies are read off the scene each tick, so give the graph a few frames to fill them
  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      window.__ZR_PLAY__.step(1, 1 / 60, false);
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  spots = await page.evaluate(() => {
    const s = window.__ZR_AUDIO__.stats();
    return { pods: s.podSpots, fairies: s.fairySpots };
  });
} finally {
  await browser.close();
  await server.close();
}
console.error(`[shadow2] ${spots.pods.length} pods, ${spots.fairies.length} fairies`);

/** the ground a player can stand on: a 1 m grid over the village and the south, on real surfaces */
const stands = [];
for (let x = -46; x <= 30; x += 1) {
  for (let z = -108; z <= 56; z += 1) {
    const s = surfaceAt(x, z);
    // indoors is its own space and the bore is a tunnel; this is about standing behind things
    if (s.enclosure > 0.5) continue;
    stands.push([x, z, s]);
  }
}
console.error(`[shadow2] ${stands.length} standing points`);

const rows = { flame: [], glint: [] };
for (const [x, z] of stands) {
  // ---- the flame: every pod, its own attenuation, its own shadow ----------------------------
  let sum = 0;
  let shaded = 0;
  let nearest = 0;
  for (const [px, py, pz] of spots.pods) {
    const d = Math.hypot(px - x, py - 1.6, pz - z);
    const a = 1 / (1 + (d / LANTERN_REACH_M) ** 2);
    if (a < 1e-4) continue;
    // the level model in `ambience.ts`: the nearest pod at full weight, the rest at a fifth
    const w = a;
    sum += w;
    nearest = Math.max(nearest, a);
    shaded += w * occlusionAt(x, z, px, pz);
  }
  if (sum > 1e-4) {
    const heard = nearest + (sum - nearest) * LANTERN_CROWD_SHARE;
    rows.flame.push({ x, z, share: shaded / sum, heard });
  }
  // ---- the glint: only the nearest fairy is ever sounded ------------------------------------
  let best = 0;
  let bestShadow = 0;
  for (const [fx, fy, fz] of spots.fairies) {
    const d = Math.hypot(fx - x, fy - 1.6, fz - z);
    const a = 1 / (1 + (d / FAIRY_REACH_M) ** 2);
    if (a > best) {
      best = a;
      bestShadow = occlusionAt(x, z, fx, fz);
    }
  }
  // the gate in `ambience.ts`: below this a glint is not sounded at all
  if (best > 0.25) rows.glint.push({ x, z, share: bestShadow, heard: best });
}

const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const summary = {};
for (const [name, r] of Object.entries(rows)) {
  r.sort((a, b) => b.share - a.share);
  const shares = r.map((v) => v.share);
  const pick = (p) => (shares.length ? shares[Math.min(shares.length - 1, Math.floor((shares.length - 1) * p))] : 0);
  summary[name] = {
    spots: r.length,
    // sorted descending, so p is measured from the top
    best: pick(0),
    p01: pick(0.01),
    p10: pick(0.1),
    median: pick(0.5),
    over25: shares.filter((v) => v > 0.25).length,
    worstCaseDuckDb: -db(1 - 0.5 * pick(0)),
    top: r.slice(0, 5).map((v) => ({ at: [v.x, v.z], share: Number(v.share.toFixed(3)), heard: Number(v.heard.toFixed(4)) })),
  };
}
fs.writeFileSync(path.join(out, 'audible.json'), JSON.stringify({ pods: spots.pods.length, fairies: spots.fairies.length, stands: stands.length, summary, flame: rows.flame.slice(0, 400), glint: rows.glint.slice(0, 400) }, null, 1));

const L = (v, w) => String(v).padEnd(w);
const R = (v, w) => String(v).padStart(w);
console.log('\nof the level actually arriving from each source, how much comes from behind something\n');
console.log(`${L('source', 8)} ${R('places it sounds', 17)} ${R('the most shadowed', 18)} ${R('top 1%', 8)} ${R('top 10%', 9)} ${R('median', 8)} ${R('over a quarter', 15)}`);
for (const [name, s] of Object.entries(summary)) {
  console.log(`${L(name, 8)} ${R(s.spots, 17)} ${R(s.best.toFixed(3), 18)} ${R(s.p01.toFixed(3), 8)} ${R(s.p10.toFixed(3), 9)} ${R(s.median.toFixed(3), 8)} ${R(s.over25 + ' places', 15)}`);
}
console.log('\nand the most any duck could ever buy, at the birds\u2019 own 0.5:\n');
for (const [name, s] of Object.entries(summary)) {
  console.log(`   ${L(name, 8)} ${s.worstCaseDuckDb.toFixed(2)} dB, at ${JSON.stringify(s.top[0]?.at)}`);
}
console.log(`\nwrote ${path.join(out, 'audible.json')}`);
