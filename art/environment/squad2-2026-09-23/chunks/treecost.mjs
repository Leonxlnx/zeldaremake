/**
 * What building the TREES costs — the phase `growthPath` actually lives in.
 *
 *   node --trace-gc art/environment/squad2-2026-09-23/chunks/treecost.mjs [--root <repo>] [--runs 3]
 *
 * `chunkcost.mjs` measures the near-LOD pool's parts (what a walking player rebuilds) and
 * `buildphases.mjs` measures the whole world in a browser (too noisy to resolve a percent). This one
 * measures the middle: creating the trees themselves — two giants and two seated columns with every
 * lobe, limb, bole and root they register — which is where the branch paths are drawn.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorld, pooledParts, r2 } from './fixture.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(flag('root', path.resolve(here, '..', '..', '..', '..')));
const RUNS = Number(flag('runs', 3));

const times = [];
let parts = 0;
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  const world = buildWorld(ROOT);
  const ms = performance.now() - t0;
  parts = pooledParts(world).length;
  times.push(ms);
}
const sorted = [...times].sort((a, b) => a - b);
console.log(`${ROOT}: creating 4 trees (${parts} pooled parts registered) — median ${r2(sorted[(sorted.length - 1) >> 1])} ms of ${times.map(r2).join(', ')}`);
