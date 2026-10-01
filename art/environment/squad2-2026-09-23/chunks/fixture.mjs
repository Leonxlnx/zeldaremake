/**
 * The lane's no-browser fixture: the real tree builders, loaded from any checkout, and the same set of
 * pooled parts every tool in this directory measures.
 *
 * `chunkcost.mjs` (chunk timings), `bitcheck.mjs` (buffer md5s) and `allocprof.mjs` (what allocates)
 * all need the same thing — the production generators running outside a browser — and had three copies
 * of it. This is the one copy. `makeLoader(root)` is the unit tests' in-memory TypeScript loader;
 * `buildWorld(root)` returns two giants and two seated columns built from fixed seeds, and
 * `pooledParts(world)` lists their near bases and near-canopy parts as the LOD pool sees them.
 *
 * The fixture's limit, stated wherever its numbers are used: these are synthetic trees from seeds, not
 * the authored plaza giants, so their largest chunks are smaller than the ones a walk meets.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { THREE };

/** compile a TS dependency graph in memory, rooted at `root` (the structures tests' loader) */
export function makeLoader() {
  const modules = new Map();
  return function loadTs(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', source)(
      (name) => {
        if (name === 'three') return THREE;
        if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
        if (name.startsWith('.')) {
          const target = path.resolve(path.dirname(file), name);
          for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
            if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
          }
        }
        throw new Error(`Unexpected dependency: ${name}`);
      },
      module,
      module.exports,
    );
    return module.exports;
  };
}

export const PALETTE = { barkWhite: 0xe8e2d4, barkGrey: 0x9a938a, barkDark: 0x4a4038, leafCanopy: 0x4f7a2e, leafSun: 0x9ab84a };
export const groundAt = (x, z) => 0.05 * Math.sin(x * 0.7) + 0.04 * Math.cos(z * 0.9);

/** the giants and seated columns every tool here measures, from fixed seeds */
export function buildWorld(root) {
  const loadTs = makeLoader();
  const treesDir = path.join(root, 'src', 'world', 'trees');
  const { createRng } = loadTs(path.join(root, 'src', 'world', 'util', 'prng.ts'));
  const { createGiantTree } = loadTs(path.join(treesDir, 'giant.ts'));
  const { columnParams, createColumnTree } = loadTs(path.join(treesDir, 'column.ts'));
  const { runSteps } = loadTs(path.join(treesDir, 'nearCanopy.ts'));
  const writer = loadTs(path.join(treesDir, 'writer.ts'));
  const sunDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();

  const giants = [
    { id: 'chunkcost-giant-a', position: [0, 0, 0], trunkRadius: 1.4, height: 30 },
    { id: 'chunkcost-giant-b', position: [22, 0, -8], trunkRadius: 1.8, height: 42 },
  ].map((def, i) =>
    createGiantTree(def, createRng(`chunkcost/giant-${i}`), {
      groundAt,
      palette: PALETTE,
      leafDensity: 0.8,
      cardDensity: 0.8,
      sunDir,
      pathAt: () => 0,
      heroDistance: Infinity,
      nearCanopy: {},
    }),
  );
  const columns = [0, 1].map((i) => {
    const p = columnParams(createRng(`chunkcost/column-${i}`), i + 2, 5);
    return createColumnTree(p, PALETTE, 'high', { groundAt, nearBase: true, sunDir, pathAt: () => 0, nearCanopy: {} });
  });
  return { giants, columns, runSteps, writer, loadTs, treesDir };
}

/** every part the LOD pool builds at runtime: the near bases and the near-canopy lobes and limbs */
export function pooledParts({ giants, columns }) {
  const parts = [];
  for (const [i, asset] of giants.entries()) {
    if (asset.nearBaseBuild) parts.push({ kind: 'giant near base', id: `giant-${i}-base`, build: asset.nearBaseBuild });
    for (const p of asset.nearCanopy) parts.push({ kind: `near canopy ${p.kind}`, id: p.geometry.name || `giant-${i}-${p.kind}`, build: p.build });
  }
  for (const [i, asset] of columns.entries()) {
    if (asset.nearBaseBuild) parts.push({ kind: 'column near base', id: `column-${i}-base`, build: asset.nearBaseBuild });
    for (const p of asset.nearCanopy) parts.push({ kind: `near canopy ${p.kind}`, id: p.geometry.name || `column-${i}-${p.kind}`, build: p.build });
  }
  return parts;
}

export const pct = (xs, q) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
};
export const r2 = (v) => Math.round(v * 100) / 100;
export const sum = (xs) => xs.reduce((a, b) => a + b, 0);
