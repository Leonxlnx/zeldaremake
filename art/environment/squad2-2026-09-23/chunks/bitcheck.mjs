/**
 * Are two checkouts' tree parts the same bytes? A no-browser bit-identity check.
 *
 *   node art/environment/squad2-2026-09-23/chunks/bitcheck.mjs [--root <repo>] [--json out.json]
 *
 * Builds the same real pooled parts (two giants, two seated columns, and every near-canopy lobe and
 * limb they register) from `--root`'s sources and prints an md5 of every attribute buffer plus one
 * total. Run it in two worktrees and diff: the md5 of a build that differs by one float changes.
 *
 * The frames' md5s (frozen.mjs) remain the end-to-end proof — they cover the whole world, materials
 * and all — but this answers in seconds what a Chrome run answers in ten minutes, so an optimisation
 * that is supposed to change nothing can be checked while it is being written.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(flag('root', path.resolve(here, '..', '..', '..', '..')));
const JSON_OUT = flag('json', null);
const treesDir = path.join(ROOT, 'src', 'world', 'trees');

const modules = new Map();
function loadTs(file) {
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
}

const { createRng } = loadTs(path.join(ROOT, 'src', 'world', 'util', 'prng.ts'));
const { createGiantTree } = loadTs(path.join(treesDir, 'giant.ts'));
const { columnParams, createColumnTree } = loadTs(path.join(treesDir, 'column.ts'));
const { runSteps } = loadTs(path.join(treesDir, 'nearCanopy.ts'));

const palette = { barkWhite: 0xe8e2d4, barkGrey: 0x9a938a, barkDark: 0x4a4038, leafCanopy: 0x4f7a2e, leafSun: 0x9ab84a };
const ground = (x, z) => 0.05 * Math.sin(x * 0.7) + 0.04 * Math.cos(z * 0.9);
const sunDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();

const md5 = (buffers) => {
  const h = crypto.createHash('md5');
  for (const name of Object.keys(buffers).sort()) {
    h.update(name);
    h.update(buffers[name]);
  }
  return h.digest('hex').slice(0, 16);
};
const buffersOf = (g) => {
  const out = {};
  if (g.index) out.index = Buffer.from(g.index.array.buffer, g.index.array.byteOffset, g.index.array.byteLength);
  for (const [name, attr] of Object.entries(g.attributes)) out[name] = Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength);
  return out;
};

const giants = [
  { id: 'chunkcost-giant-a', position: [0, 0, 0], trunkRadius: 1.4, height: 30 },
  { id: 'chunkcost-giant-b', position: [22, 0, -8], trunkRadius: 1.8, height: 42 },
].map((def, i) =>
  createGiantTree(def, createRng(`chunkcost/giant-${i}`), {
    groundAt: ground,
    palette,
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
  return createColumnTree(p, palette, 'high', { groundAt: ground, nearBase: true, sunDir, pathAt: () => 0, nearCanopy: {} });
});

const rows = [];
const add = (id, geometry) => rows.push({ id, md5: md5(buffersOf(geometry)), vertices: geometry.getAttribute('position').count, triangles: geometry.index ? geometry.index.count / 3 : 0 });
for (const [i, asset] of giants.entries()) {
  // the far tree itself (merged wood + laminae + cards), then every pooled near part
  for (const key of ['geometry', 'cards', 'authoredLeaves', 'authoredCards']) if (asset[key]) add(`giant-${i}/${key}`, asset[key]);
  if (asset.nearBaseBuild) add(`giant-${i}/near-base`, runSteps(asset.nearBaseBuild()));
  for (const p of asset.nearCanopy) add(`giant-${i}/${p.geometry.name || p.kind}`, runSteps(p.build()));
}
for (const [i, asset] of columns.entries()) {
  for (const key of ['geometry', 'cards']) if (asset[key]) add(`column-${i}/${key}`, asset[key]);
  if (asset.nearBaseBuild) add(`column-${i}/near-base`, runSteps(asset.nearBaseBuild()));
  for (const p of asset.nearCanopy) add(`column-${i}/${p.geometry.name || p.kind}`, runSteps(p.build()));
}

const total = crypto.createHash('md5');
for (const r of rows) total.update(`${r.id}:${r.md5}:${r.vertices}:${r.triangles}`);
console.log(`root ${ROOT}`);
console.log(`${rows.length} geometries, ${rows.reduce((n, r) => n + r.triangles, 0)} triangles`);
console.log(`TOTAL ${total.digest('hex')}`);
for (const r of rows) console.log(`  ${r.md5}  ${String(r.triangles).padStart(7)} tri  ${r.id}`);
if (JSON_OUT) writeFileSync(path.resolve(JSON_OUT), JSON.stringify(rows, null, 1) + '\n');
