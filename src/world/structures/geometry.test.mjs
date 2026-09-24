/** Run: node --test src/world/structures/geometry.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Compile only this test's TS dependency graph in memory (the mossTufts test's loader).
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
      throw new Error(`Unexpected test dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { gridSurface, repeatsRound, seamUV, TAU } = loadTs(path.join(here, 'geometry.ts'));

/** a closed ring of radius r whose uv u grows round it (`repeats` × u), as the grove's fascias and columns have it */
function ring(r, cols, rows, repeats) {
  return gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      out.position.set(Math.cos(a) * r, v * 0.3, Math.sin(a) * r);
      out.uv = [u * repeats, v];
    },
    { cols, rows, closedU: true },
  );
}

test('repeatsRound: a whole number of tiles round the ring, at least one', () => {
  assert.equal(repeatsRound(2.65), 10);
  assert.equal(repeatsRound(1.2), 5);
  assert.equal(repeatsRound(0.9, 1.2), 5);
  assert.equal(repeatsRound(0.05), 1);
  for (let r = 0.1; r < 6; r += 0.37) assert.ok(Number.isInteger(repeatsRound(r)) && repeatsRound(r) >= 1);
});

test('a closedU ring with a growing uv folds its map back through the last quad; seamUV closes it', () => {
  const cols = 24;
  const rows = 3;
  const n = 10;
  const g = ring(2.65, cols, rows, n);
  const uv = g.attributes.uv;
  const nu = cols + 1;
  // gridSurface samples the seam column at u = 0: its uv starts the ring again
  for (let j = 0; j < rows; j++) assert.equal(uv.getX(j * nu + cols), 0);
  seamUV(g, cols);
  for (let j = 0; j < rows; j++) {
    const row = j * nu;
    // every quad now spans the same step in u, the seam's included, and the ring ends on a whole repeat
    for (let i = 0; i < cols; i++) assert.ok(Math.abs(uv.getX(row + i + 1) - uv.getX(row + i) - n / cols) < 1e-5, `quad ${i} in row ${j}`);
    assert.ok(Math.abs(uv.getX(row + cols) - n) < 1e-5);
    // the seam column still sits exactly on the first: the ring stays closed
    const p0 = new THREE.Vector3().fromBufferAttribute(g.attributes.position, row);
    const p1 = new THREE.Vector3().fromBufferAttribute(g.attributes.position, row + cols);
    assert.ok(p0.distanceTo(p1) < 1e-9);
  }
  // uv v, counts and the index are untouched
  assert.equal(uv.count, nu * rows);
  for (let j = 0; j < rows; j++) assert.ok(Math.abs(uv.getY(j * nu + cols) - j / (rows - 1)) < 1e-9);
});
