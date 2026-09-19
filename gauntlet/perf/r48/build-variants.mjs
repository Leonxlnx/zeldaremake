#!/usr/bin/env node
/**
 * build-variants.mjs — scratch builds of the sealed world with the trees' near-LOD constants
 * patched (fable-6, round 48: the `lod-1` brief in docs/PERF_2026-09-19.md).
 *
 *   node gauntlet/perf/r48/build-variants.mjs --worktree .wt/w0116 [--only lod18,lod25] [--dry]
 *
 * For every variant: the worktree's `src/world/trees/{giant,nearCanopy,index}.ts` are patched by
 * exact string (or single-match regex) replacement — a replacement that does not match, or matches
 * twice, FAILS the variant; no silent no-ops — `vite build --outDir dist-<variant>` runs, and the
 * files are restored with `git checkout -- src` (only when this script patched them: a worktree
 * that is dirty before a variant is left alone and the variant fails). Nothing is committed
 * anywhere; `variants.json` beside this script records the exact diff per variant (merged by name
 * across runs) so every trace / capture made from a `dist-<variant>` has its provenance. The lane
 * does not edit src/world/** on any branch — these are measurements of what lod-1 would pay.
 *
 * The lod variants also neutralise `NEAR_BASE_RADIUS_OVERRIDE` (giant.ts): its per-bole bands
 * (12–22 m) were chosen as the WIDEST a fixed camera allows and would otherwise stay narrower than
 * the variant's default, so "every base swaps at 18 m" would not be what was measured. The one
 * protective entry (`seat-7`, the emergent column 5.4 / 5.9 m from C / D) is kept — any lod-1
 * ship would keep it. `NEAR_CANOPY_MAX_Y` follows the canopy in-radius the way the shipped 21 m
 * follows 22 m (in − 1.5 m eye − 0.5 m), so the lobes the new radius reaches are built as parts.
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
  [GIANT]: ['export const NEAR_BASE_IN_M = 10;', 'export const NEAR_BASE_OUT_M = 13;', 'export const NEAR_BASE_RADIUS_OVERRIDE: Record<string, [number, number]> = {'],
  [CANOPY]: ['export const NEAR_CANOPY_IN_M = 22;', 'export const NEAR_CANOPY_OUT_M = 26;', 'export const NEAR_CANOPY_MAX_Y = 21;'],
  [INDEX]: ['const NEAR_CANOPY_PREFETCH_M = 34;', 'const NEAR_BASE_PREFETCH_M = 22;', 'const NEAR_CANOPY_POOL_BYTES = 64 << 20;', 'const NEAR_BASE_POOL_BYTES = 12 << 20;', 'const NEAR_LOD_BUILD_BUDGET_MS = 3;'],
};

/** the whole override literal (giant.ts) → only the protective entry; a regex so the comments inside it need not be spelled out */
const OVERRIDE_RE = /export const NEAR_BASE_RADIUS_OVERRIDE: Record<string, \[number, number\]> = \{[\s\S]*?\n\};/;
const OVERRIDE_TO = "export const NEAR_BASE_RADIUS_OVERRIDE: Record<string, [number, number]> = {\n  // build-variants.mjs: every other bole takes the variant's default band; seat-7 keeps its hero protection\n  'seat-7': [5, 7],\n};";

const swaps = (baseIn, baseOut, canopyIn, canopyOut, canopyMaxY, prefetchCanopy, prefetchBase) => [
  [GIANT, 'export const NEAR_BASE_IN_M = 10;', `export const NEAR_BASE_IN_M = ${baseIn};`],
  [GIANT, 'export const NEAR_BASE_OUT_M = 13;', `export const NEAR_BASE_OUT_M = ${baseOut};`],
  [GIANT, OVERRIDE_RE, OVERRIDE_TO],
  [CANOPY, 'export const NEAR_CANOPY_IN_M = 22;', `export const NEAR_CANOPY_IN_M = ${canopyIn};`],
  [CANOPY, 'export const NEAR_CANOPY_OUT_M = 26;', `export const NEAR_CANOPY_OUT_M = ${canopyOut};`],
  [CANOPY, 'export const NEAR_CANOPY_MAX_Y = 21;', `export const NEAR_CANOPY_MAX_Y = ${canopyMaxY};`],
  [INDEX, 'const NEAR_CANOPY_PREFETCH_M = 34;', `const NEAR_CANOPY_PREFETCH_M = ${prefetchCanopy};`],
  [INDEX, 'const NEAR_BASE_PREFETCH_M = 22;', `const NEAR_BASE_PREFETCH_M = ${prefetchBase};`],
];
const pools = (canopyMB, baseMB, budgetMs) => [
  [INDEX, 'const NEAR_CANOPY_POOL_BYTES = 64 << 20;', `const NEAR_CANOPY_POOL_BYTES = ${canopyMB} << 20;`],
  [INDEX, 'const NEAR_BASE_POOL_BYTES = 12 << 20;', `const NEAR_BASE_POOL_BYTES = ${baseMB} << 20;`],
  [INDEX, 'const NEAR_LOD_BUILD_BUDGET_MS = 3;', `const NEAR_LOD_BUILD_BUDGET_MS = ${budgetMs};`],
];

/** each variant: what changes, as [file, from, to] triples (`from` a string or a single-match RegExp) */
export const VARIANTS = {
  // the owner's ask as trees-30 phrased it: near base 10 → 18 m, near canopy further; the pre-fetch keeps its 7.5 s lead (walk 1.6 m/s ⇒ +12 m)
  lod18: {
    title: 'near-base swap 18 / 21 m on every bole (seat-7 kept at 5 / 7), near-canopy 26 / 30 m (lobes to 25 m up), pre-fetch 30 / 42 m, pools unchanged',
    patches: swaps(18, 21, 26, 30, 25, 42, 30),
  },
  lod25: {
    title: 'near-base swap 25 / 28 m on every bole (seat-7 kept), near-canopy 30 / 34 m (lobes to 29 m up), pre-fetch 37 / 46 m, pools unchanged',
    patches: swaps(25, 28, 30, 34, 29, 46, 37),
  },
  // "prewarm around the player": the pools sized to hold everything inside the pre-fetch radius
  // (the baseline's 34 m demand is 125 MB against a 64 MB cap — the pool thrashes), the build
  // budget doubled; swap distances as shipped, so the six frames cannot change
  prewarm: {
    title: 'pools 192 / 32 MB (the pre-fetch radius fits), build budget 6 ms, swap distances as shipped',
    patches: pools(192, 32, 6),
  },
  // what lod-1 would most likely ship: 18 m swaps with pools that hold their pre-fetch radius
  lod18prewarm: {
    title: 'lod18 swap distances + pools 192 / 32 MB + build budget 6 ms',
    patches: [...swaps(18, 21, 26, 30, 25, 42, 30), ...pools(192, 32, 6)],
  },
};

const git = (a) => execFileSync('git', a, { cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

function assertClean() {
  const dirty = git(['status', '--porcelain', '--', 'src']).trim();
  if (dirty) throw new Error(`worktree src/ is not clean (left untouched):\n${dirty}`);
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
    if (from instanceof RegExp) {
      const m = text.match(new RegExp(from.source, `${from.flags.replace('g', '')}g`));
      if (!m || m.length !== 1) throw new Error(`${file}: regex patch matched ${m ? m.length : 0} times: ${from}`);
      byFile.set(file, text.replace(from, to));
    } else {
      if (!text.includes(from)) throw new Error(`${file}: patch source not found: ${from}`);
      if (text.split(from).length !== 2) throw new Error(`${file}: patch source is not unique: ${from}`);
      byFile.set(file, text.replace(from, to));
    }
  }
  for (const [file, text] of byFile) fs.writeFileSync(path.join(worktree, file), text);
}

const sha = git(['rev-parse', 'HEAD']);
const names = Object.keys(VARIANTS).filter((n) => !only || only.includes(n));
if (only) {
  const unknown = only.filter((n) => !VARIANTS[n]);
  if (unknown.length) throw new Error(`unknown variant(s): ${unknown.join(', ')} (have ${Object.keys(VARIANTS).join(', ')})`);
}
const results = [];
console.error(`build-variants: ${names.join(', ')} from ${worktree} @ ${sha.slice(0, 7)}${dry ? ' (dry run)' : ''}`);
for (const name of names) {
  const v = VARIANTS[name];
  const outDir = `dist-${name}`;
  const t0 = Date.now();
  let patched = false;
  try {
    assertClean();
    applyPatches(v.patches);
    patched = true;
    const diff = git(['diff', '--', 'src']);
    if (dry) {
      console.error(`--- ${name}\n${diff}`);
      results.push({ name, title: v.title, sha, dry: true, ok: false, diff });
    } else {
      execFileSync('npx', ['vite', 'build', '--outDir', outDir], { cwd: worktree, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
      results.push({ name, title: v.title, dist: path.join(path.relative(ROOT, worktree), outDir), sha, patches: v.patches.map(([f, from, to]) => [f, from instanceof RegExp ? `/${from.source}/` : from, to]), diff, builtAt: new Date().toISOString(), buildMs: Date.now() - t0, ok: true });
      console.error(`build-variants: ${name} → ${outDir} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  } catch (e) {
    results.push({ name, title: v.title, sha, ok: false, error: String(e.message ?? e) });
    console.error(`build-variants: ${name} FAILED — ${e.message}`);
  } finally {
    if (patched) git(['checkout', '--', 'src']);
  }
}
// merge by name into the existing record: a partial run (`--only`) never drops the others' provenance; dry runs record nothing
const file = path.join(HERE, 'variants.json');
const prev = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')).variants ?? []) : [];
const built = results.filter((r) => !r.dry);
if (built.length) {
  const merged = [...prev.filter((p) => !built.some((r) => r.name === p.name)), ...built].sort((a, b) => Object.keys(VARIANTS).indexOf(a.name) - Object.keys(VARIANTS).indexOf(b.name));
  fs.writeFileSync(file, JSON.stringify({ worktree: path.relative(ROOT, worktree), sha, generatedAt: new Date().toISOString(), variants: merged }, null, 2) + '\n');
  console.error(`build-variants: wrote ${path.relative(ROOT, file)} (${merged.length} variants on record)`);
}
if (results.some((r) => !r.ok && !r.dry)) process.exit(1);
