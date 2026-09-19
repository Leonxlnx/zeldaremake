#!/usr/bin/env node
/**
 * build-variants.mjs — scratch builds of the sealed world with the trees' near-LOD constants
 * patched (fable-6, round 48: the `lod-1` brief in docs/PERF_2026-09-19.md).
 *
 *   node gauntlet/perf/r48/build-variants.mjs --worktree .wt/w0116 [--only lod18,lod25] [--dry]
 *
 * For every variant: the worktree's `src/world/trees/{giant,nearCanopy,index}.ts` are patched by
 * exact string replacement (a replacement that does not match FAILS the variant — no silent
 * no-ops), `vite build --outDir dist-<variant>` runs, and the files are restored with
 * `git checkout -- src` whatever happened. Nothing is committed anywhere; `variants.json` beside
 * this script records the exact replacements per variant so every trace / capture made from a
 * `dist-<variant>` has its provenance. The lane does not edit src/world/** on any branch — these
 * are measurements of what lod-1 would pay.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else {
    args[a.slice(2)] = n;
    i++;
  }
}
const worktree = path.resolve(ROOT, args.worktree ?? '.wt/w0116');
const only = typeof args.only === 'string' ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
const dry = !!args.dry;

const GIANT = 'src/world/trees/giant.ts';
const CANOPY = 'src/world/trees/nearCanopy.ts';
const INDEX = 'src/world/trees/index.ts';

/** the near-LOD knobs of 973a21e (giant.ts / nearCanopy.ts / index.ts), verified before patching */
const BASELINE = {
  [GIANT]: ['export const NEAR_BASE_IN_M = 10;', 'export const NEAR_BASE_OUT_M = 13;'],
  [CANOPY]: ['export const NEAR_CANOPY_IN_M = 22;', 'export const NEAR_CANOPY_OUT_M = 26;'],
  [INDEX]: ['const NEAR_CANOPY_PREFETCH_M = 34;', 'const NEAR_BASE_PREFETCH_M = 22;', 'const NEAR_CANOPY_POOL_BYTES = 64 << 20;', 'const NEAR_BASE_POOL_BYTES = 12 << 20;', 'const NEAR_LOD_BUILD_BUDGET_MS = 3;'],
};

/** each variant: what changes, as [file, from, to] triples */
export const VARIANTS = {
  // the owner's ask as trees-30 phrased it: near base 10 → 18 m, near canopy further; pre-fetch keeps its 7.5 s lead (walk 1.6 m/s ⇒ +12 m)
  lod18: {
    title: 'near-base swap 18 / 21 m, near-canopy 26 / 30 m (pre-fetch 30 / 42 m), pools unchanged',
    patches: [
      [GIANT, 'export const NEAR_BASE_IN_M = 10;', 'export const NEAR_BASE_IN_M = 18;'],
      [GIANT, 'export const NEAR_BASE_OUT_M = 13;', 'export const NEAR_BASE_OUT_M = 21;'],
      [CANOPY, 'export const NEAR_CANOPY_IN_M = 22;', 'export const NEAR_CANOPY_IN_M = 26;'],
      [CANOPY, 'export const NEAR_CANOPY_OUT_M = 26;', 'export const NEAR_CANOPY_OUT_M = 30;'],
      [INDEX, 'const NEAR_CANOPY_PREFETCH_M = 34;', 'const NEAR_CANOPY_PREFETCH_M = 42;'],
      [INDEX, 'const NEAR_BASE_PREFETCH_M = 22;', 'const NEAR_BASE_PREFETCH_M = 30;'],
    ],
  },
  lod25: {
    title: 'near-base swap 25 / 28 m, near-canopy 30 / 34 m (pre-fetch 37 / 46 m), pools unchanged',
    patches: [
      [GIANT, 'export const NEAR_BASE_IN_M = 10;', 'export const NEAR_BASE_IN_M = 25;'],
      [GIANT, 'export const NEAR_BASE_OUT_M = 13;', 'export const NEAR_BASE_OUT_M = 28;'],
      [CANOPY, 'export const NEAR_CANOPY_IN_M = 22;', 'export const NEAR_CANOPY_IN_M = 30;'],
      [CANOPY, 'export const NEAR_CANOPY_OUT_M = 26;', 'export const NEAR_CANOPY_OUT_M = 34;'],
      [INDEX, 'const NEAR_CANOPY_PREFETCH_M = 34;', 'const NEAR_CANOPY_PREFETCH_M = 46;'],
      [INDEX, 'const NEAR_BASE_PREFETCH_M = 22;', 'const NEAR_BASE_PREFETCH_M = 37;'],
    ],
  },
  // "prewarm around the player": the pools sized to hold everything inside the pre-fetch radius
  // (the baseline's 34 m demand is 134 MB against a 64 MB cap — the pool thrashes), the build
  // budget doubled; swap distances as shipped, so the six frames cannot change
  prewarm: {
    title: 'pools 192 / 32 MB (the pre-fetch radius fits), build budget 6 ms, swap distances as shipped',
    patches: [
      [INDEX, 'const NEAR_CANOPY_POOL_BYTES = 64 << 20;', 'const NEAR_CANOPY_POOL_BYTES = 192 << 20;'],
      [INDEX, 'const NEAR_BASE_POOL_BYTES = 12 << 20;', 'const NEAR_BASE_POOL_BYTES = 32 << 20;'],
      [INDEX, 'const NEAR_LOD_BUILD_BUDGET_MS = 3;', 'const NEAR_LOD_BUILD_BUDGET_MS = 6;'],
    ],
  },
  // what lod-1 would most likely ship: 18 m swaps with pools that hold their pre-fetch radius
  lod18prewarm: {
    title: 'lod18 swap distances + pools 192 / 32 MB + build budget 6 ms',
    patches: [
      [GIANT, 'export const NEAR_BASE_IN_M = 10;', 'export const NEAR_BASE_IN_M = 18;'],
      [GIANT, 'export const NEAR_BASE_OUT_M = 13;', 'export const NEAR_BASE_OUT_M = 21;'],
      [CANOPY, 'export const NEAR_CANOPY_IN_M = 22;', 'export const NEAR_CANOPY_IN_M = 26;'],
      [CANOPY, 'export const NEAR_CANOPY_OUT_M = 26;', 'export const NEAR_CANOPY_OUT_M = 30;'],
      [INDEX, 'const NEAR_CANOPY_PREFETCH_M = 34;', 'const NEAR_CANOPY_PREFETCH_M = 42;'],
      [INDEX, 'const NEAR_BASE_PREFETCH_M = 22;', 'const NEAR_BASE_PREFETCH_M = 30;'],
      [INDEX, 'const NEAR_CANOPY_POOL_BYTES = 64 << 20;', 'const NEAR_CANOPY_POOL_BYTES = 192 << 20;'],
      [INDEX, 'const NEAR_BASE_POOL_BYTES = 12 << 20;', 'const NEAR_BASE_POOL_BYTES = 32 << 20;'],
      [INDEX, 'const NEAR_LOD_BUILD_BUDGET_MS = 3;', 'const NEAR_LOD_BUILD_BUDGET_MS = 6;'],
    ],
  },
};

const git = (a) => execFileSync('git', a, { cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

function assertClean() {
  const dirty = git(['status', '--porcelain', '--', 'src']).trim();
  if (dirty) throw new Error(`worktree src/ is not clean:\n${dirty}`);
  for (const [file, needles] of Object.entries(BASELINE)) {
    const text = fs.readFileSync(path.join(worktree, file), 'utf8');
    for (const n of needles) if (!text.includes(n)) throw new Error(`${file}: baseline line not found: ${n}`);
  }
}

function applyPatches(patches) {
  const byFile = new Map();
  for (const [file, from, to] of patches) {
    const p = path.join(worktree, file);
    const text = byFile.get(file) ?? fs.readFileSync(p, 'utf8');
    if (!text.includes(from)) throw new Error(`${file}: patch source not found: ${from}`);
    if (text.split(from).length !== 2) throw new Error(`${file}: patch source is not unique: ${from}`);
    byFile.set(file, text.replace(from, to));
  }
  for (const [file, text] of byFile) fs.writeFileSync(path.join(worktree, file), text);
}

const sha = git(['rev-parse', 'HEAD']);
const results = [];
const names = Object.keys(VARIANTS).filter((n) => !only || only.includes(n));
console.error(`build-variants: ${names.join(', ')} from ${worktree} @ ${sha.slice(0, 7)}${dry ? ' (dry run)' : ''}`);
for (const name of names) {
  const v = VARIANTS[name];
  const outDir = `dist-${name}`;
  const t0 = Date.now();
  try {
    assertClean();
    applyPatches(v.patches);
    const diff = git(['diff', '--', 'src']);
    if (dry) console.error(`--- ${name}\n${diff}`);
    else {
      execFileSync('npx', ['vite', 'build', '--outDir', outDir], { cwd: worktree, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
    }
    results.push({ name, title: v.title, dist: path.join(path.relative(ROOT, worktree), outDir), sha, patches: v.patches, diff, builtAt: new Date().toISOString(), buildMs: Date.now() - t0, ok: true });
    console.error(`build-variants: ${name} → ${outDir} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (e) {
    results.push({ name, title: v.title, sha, patches: v.patches, ok: false, error: String(e.message ?? e) });
    console.error(`build-variants: ${name} FAILED — ${e.message}`);
  } finally {
    git(['checkout', '--', 'src']);
  }
}
fs.writeFileSync(path.join(HERE, 'variants.json'), JSON.stringify({ worktree: path.relative(ROOT, worktree), sha, generatedAt: new Date().toISOString(), variants: results }, null, 2) + '\n');
console.error(`build-variants: wrote ${path.relative(ROOT, path.join(HERE, 'variants.json'))}`);
if (results.some((r) => !r.ok)) process.exit(1);
