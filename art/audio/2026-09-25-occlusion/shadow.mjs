#!/usr/bin/env node
/**
 * shadow.mjs — is there anything in this world you could stand behind? (rubric check 45)
 *
 *   node art/audio/2026-09-25-occlusion/shadow.mjs --dist dist
 *
 * Check 45 scores 0: nothing occludes anything, every source in the bed is distance-only. Before
 * building occlusion, this asks whether it would be heard — because an obstacle only casts an
 * acoustic shadow when it spans several wavelengths of what is behind it, and that test is cheap
 * arithmetic against the world's actual geometry.
 *
 * For a source at frequency f, an obstacle of width w on the line, the Fresnel number
 *
 *     N = 2 * w_eff / lambda,   lambda = 343 / f
 *
 * is what decides it. N below about 1 and the sound bends round as if the obstacle were not there;
 * N of 10 or more and there is a real shadow. So the question is not "is there a tree" but "is
 * there a tree wide enough for what is behind it".
 *
 * The sources this bed actually has, and the top of each (from `ambience.ts`):
 *
 *   pod flame     lowpassed at 320 Hz, with a 132 Hz husk under it
 *   bird call     highpassed at 320 Hz, lowpassed at 7000 - 5200 x distance
 *   fairy glint   bell partials, a few kHz, audible within ~4.3 m
 *   wind / leaves diffuse, no position at all — nothing to occlude
 *
 * and the occluders the layout knows about: thirteen giant boles (1.1–2.2 m radius) and the huts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { serveStatic, launchBrowser } from '../../../gauntlet/scripts/lib/browser.mjs';

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
      throw Error(n);
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
const here = path.dirname(new URL(import.meta.url).pathname);
const { LAYOUT, EXPANSION, EXPANSION_NORTH } = loadTs(path.join(here, '../../../src/world/layout.ts'));

/** the chord an infinite-height circle cuts out of the segment a→b (m), 0 if it misses */
function chord(a, b, c, r) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const t = (c[0] - a[0]) * ux + (c[1] - a[1]) * uz;
  if (t < -r || t > len + r) return 0;
  const perp = Math.hypot(a[0] + ux * Math.max(0, Math.min(len, t)) - c[0], a[1] + uz * Math.max(0, Math.min(len, t)) - c[1]);
  return perp >= r ? 0 : 2 * Math.sqrt(r * r - perp * perp);
}

/** the shadow an obstacle `w` metres wide casts on a source at `f` Hz, as a Fresnel number */
const fresnel = (w, f) => (2 * w) / (343 / f);
const verdict = (n) => (n < 1 ? 'none: it bends round' : n < 4 ? 'slight' : n < 12 ? 'partial' : 'a real shadow');

const OCCLUDERS = [
  ...LAYOUT.giantTrees.map((t) => ({ id: t.id, c: [t.position[0], t.position[2]], r: t.trunkRadius, top: t.height })),
  { id: 'west-house', c: [EXPANSION.westHouse.host[0], EXPANSION.westHouse.host[1]], r: EXPANSION.westHouse.radius, top: EXPANSION.westHouse.floorY + EXPANSION.westHouse.wall },
  { id: 'grove-stilt', c: [EXPANSION_NORTH.stilt.host[0], EXPANSION_NORTH.stilt.host[1]], r: EXPANSION_NORTH.stilt.radius, top: EXPANSION_NORTH.stilt.floorY + EXPANSION_NORTH.stilt.wall },
  { id: 'grove-hut', c: [EXPANSION_NORTH.hut.host[0], EXPANSION_NORTH.hut.host[1]], r: EXPANSION_NORTH.hut.radius, top: EXPANSION_NORTH.hut.floorY + EXPANSION_NORTH.hut.wall },
];

const server = await serveStatic(path.resolve(args.dist || 'dist'));
const browser = await launchBrowser({ width: 640, height: 360 });
let pods = [];
try {
  // `?capture=1` mounts no audio at all (`stats()` is null there), so this uses the play-mode path
  // the ground probe uses. `podSpots` reads the scene directly and needs no gesture to answer.
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
  });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 900000 });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_AUDIO__, { timeout: 900000, polling: 500 });
  await page.evaluate(() => window.__ZR__.ready());
  pods = await page.evaluate(() => window.__ZR_AUDIO__.stats()?.podSpots ?? []);
} finally {
  await browser.close();
  await server.close();
}

console.log(`${pods.length} pod lanterns, ${OCCLUDERS.length} solid things the layout knows about (13 boles + 3 huts)\n`);
console.log('For each flame: the widest obstacle a player could put between himself and it, standing');
console.log('2 m past that obstacle, and what that width does to the flame (which is lowpassed at 320 Hz).\n');
console.log(`${'pod'.padEnd(22)} ${'best occluder'.padEnd(18)} ${'width'.padStart(6)} ${'its top'.padStart(8)} ${'N @320Hz'.padStart(9)}   shadow`);

const rows = [];
for (const [i, p] of pods.entries()) {
  let best = null;
  for (const o of OCCLUDERS) {
    const d = Math.hypot(o.c[0] - p[0], o.c[1] - p[2]);
    if (d < o.r + 0.4 || d > 14) continue;
    const ux = (o.c[0] - p[0]) / d;
    const uz = (o.c[1] - p[2]) / d;
    const stand = [p[0] + ux * (d + o.r + 2), p[2] + uz * (d + o.r + 2)];
    const w = chord(stand, [p[0], p[2]], o.c, o.r);
    if (w > 0.05 && (!best || w > best.w)) best = { o, w, stand, d };
  }
  const label = `pod ${i} (${p[0].toFixed(1)}, ${p[2].toFixed(1)}, y ${p[1].toFixed(1)})`;
  if (!best) {
    console.log(`${label.padEnd(22)} ${'\u2014 nothing within 14 m'.padEnd(18)}`);
    rows.push({ pod: p, occluder: null });
    continue;
  }
  const n = fresnel(best.w, 320);
  console.log(`${label.padEnd(22)} ${best.o.id.padEnd(18)} ${best.w.toFixed(2).padStart(6)} ${best.o.top.toFixed(1).padStart(8)} ${n.toFixed(1).padStart(9)}   ${verdict(n)}`);
  rows.push({ pod: p, occluder: best.o.id, width: Number(best.w.toFixed(2)), stand: best.stand.map((v) => Number(v.toFixed(2))), fresnel320: Number(n.toFixed(1)) });
}

console.log('\nthe same widths against the other sources this bed has:');
for (const [what, f] of [
  ['the flame\u2019s husk', 132],
  ['the flame\u2019s top', 320],
  ['a distant bird', 1800],
  ['a near bird', 7000],
  ['a fairy glint', 4000],
]) {
  const widths = rows.filter((r) => r.width).map((r) => r.width);
  const med = widths.length ? widths.sort((a, b) => a - b)[Math.floor(widths.length / 2)] : 0;
  const n = fresnel(med, f);
  console.log(`  ${what.padEnd(18)} ${f.toString().padStart(5)} Hz   N = ${n.toFixed(1).padStart(5)} through the median ${med.toFixed(2)} m of wood   ${verdict(n)}`);
}
fs.writeFileSync(path.join(here, 'shadow.json'), JSON.stringify({ pods, rows }, null, 1));
console.log('\nwrote', path.join(here, 'shadow.json'));
