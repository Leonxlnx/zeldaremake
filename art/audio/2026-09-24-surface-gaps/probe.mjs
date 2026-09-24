#!/usr/bin/env node
/**
 * probe.mjs — cross-check the footsteps against every surface the WORLD says it built.
 *
 *   node art/audio/2026-09-24-surface-gaps/probe.mjs --dist dist [--out /tmp/surface-gaps]
 *
 * `src/audio/surfaces.test.mjs` guards the standing places named in `layout.ts`. That list is
 * written by hand, so it only knows what somebody thought to add. This asks the running world
 * instead: `__ZR__.audit()` publishes hardscape's paved tops (every flagstone's top-centre, the
 * north paving, the stair nosings, the lookout's slab) and structures' walk surfaces (the west
 * house's disc and deck). Those are the same tops `character/ground.ts` stands the player on.
 *
 * Every one of them is a place the player's boots land on built stone or timber. The check is that
 * `surfaceAt()` agrees — and it runs in Node, against the transpiled source, so nothing in the
 * page has to expose the audio's internals for a harness to read them.
 *
 * It is a detector, not a fix. When a builder publishes a new top, this is what says the boots have
 * not been told; the fix is a case in `surfaceAt()` and a line in the test.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (fs.existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : []))
    .filter(Boolean),
);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/surface-gaps');
const log = (...m) => console.error('[gaps]', ...m);
fs.mkdirSync(out, { recursive: true });

const { surfaceAt } = loadTs(path.join(root, 'src/audio/index.ts'));
/** what the boots must say when the player is standing on built stone or timber */
const BUILT = new Set(['stone', 'stair', 'wood', 'bridge', 'hollow']);

const server = await serveStatic(dist);
const browser = await launchBrowser({ width: 640, height: 360 });
let published;
try {
  const { page } = await openWorld(browser, server.url, { quality: 'high' });
  published = await page.evaluate(() => {
    // each system's `ctx.audit(name, fn)` lands under `systems`
    const a = window.__ZR__.audit()?.systems ?? {};
    const sp = a?.hardscape?.samplePositions ?? {};
    const spots = [];
    // hardscape publishes the top-centre of each paved thing the character ground stands on
    for (const [group, pts] of Object.entries(sp)) for (const p of pts ?? []) spots.push({ group: `hardscape.${group}`, x: p[0], z: p[2] });
    // structures publish the west house's platform disc and its walkway deck
    for (const w of a?.structures?.expansion?.walkSurfaces ?? []) {
      if (w.disc) spots.push({ group: `walkSurface.${w.id}.disc`, x: w.disc.x, z: w.disc.z });
      if (w.deck) for (const t of [0.2, 0.5, 0.8]) spots.push({ group: `walkSurface.${w.id}.deck`, x: w.deck.a[0] + (w.deck.b[0] - w.deck.a[0]) * t, z: w.deck.a[2] + (w.deck.b[2] - w.deck.a[2]) * t });
    }
    return { spots, groups: Object.keys(sp), systems: Object.keys(a) };
  });
} finally {
  await browser.close();
  await server.close();
}

const rows = published.spots.map((s) => ({ ...s, surface: surfaceAt(s.x, s.z).surface }));
const byGroup = new Map();
for (const r of rows) {
  const g = byGroup.get(r.group) ?? { n: 0, bad: [], heard: new Set() };
  g.n++;
  g.heard.add(r.surface);
  if (!BUILT.has(r.surface)) g.bad.push(r);
  byGroup.set(r.group, g);
}
fs.writeFileSync(path.join(out, 'gaps.json'), JSON.stringify({ groups: published.groups, rows }, null, 1));

log(`${rows.length} published tops across ${byGroup.size} groups`);
let bad = 0;
for (const [group, g] of [...byGroup].sort()) {
  bad += g.bad.length;
  log(`${g.bad.length ? '!' : ' '} ${group.padEnd(30)} ${String(g.n).padStart(4)} tops   ${[...g.heard].sort().join(', ')}${g.bad.length ? `   — ${g.bad.length} sound like the ground` : ''}`);
  for (const r of g.bad.slice(0, 6)) log(`      (${r.x}, ${r.z}) → ${r.surface}`);
}
log(bad ? `${bad} of ${rows.length} published tops sound like the ground` : 'every published top the character stands on has a built footstep sound');
process.exitCode = bad ? 1 : 0;
