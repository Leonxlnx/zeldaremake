/** Run: node --test src/world/structures/cameraSolids.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

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
const { buildCameraSolids } = loadTs(path.join(here, 'cameraSolids.ts'));

/** a hut at the origin: a 1.2 m bark wall 0–1.5 m high, and an eave ring 1.4–1.7 m out at 1.8 m, both under one shell */
function hut(shell) {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.5, 48, 3, true).translate(0, 0.75, 0));
  wall.name = 'distant-house-bark:test';
  const eave = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.7, 48).rotateX(-Math.PI / 2).translate(0, 1.8, 0));
  eave.name = 'distant-house-cap:test';
  for (const m of [wall, eave]) {
    m.userData.cameraShell = shell;
    group.add(m);
  }
  return group;
}
const SHELL = { x: 0, z: 0, r: 1.29 };
/** Link's aim on a gallery 1.7 m out, on the diagonal (the keeper's gallery walks 1.30–1.99 m out) */
const AIM = [1.7 * Math.SQRT1_2, 1.43, 1.7 * Math.SQRT1_2];

test('a shell: the wall is solid cells (grown by one, they cover the gallery on the diagonal), the eave outside it slim', () => {
  const cs = buildCameraSolids([hut(SHELL)]);
  assert.equal(cs.report.solidParts['distant-house-bark'], 1);
  assert.equal(cs.report.slimParts['distant-house-cap'], 1);
  assert.deepEqual(cs.report.exactParts, {});
  assert.ok(cs.solid.hasPoint(1.2, 0.9, 0), 'the wall is solid');
  assert.ok(cs.solid.hasPoint(...AIM), 'the grown wall reaches Link\'s aim 1.7 m out on the diagonal');
  assert.ok(cs.slim.hasPoint(1.55, 1.8, 0), 'the eave is slim');
});

test('an exact shell: the wall leaves the cells to its published cylinder; the eave outside it stays slim', () => {
  const cs = buildCameraSolids([hut({ ...SHELL, exact: true })]);
  assert.equal(cs.report.exactParts['distant-house-bark'], 1);
  assert.equal(cs.report.solidParts['distant-house-bark'], undefined);
  assert.equal(cs.solid, null, 'no solid cells');
  assert.equal(cs.report.slimParts['distant-house-cap'], 1);
  assert.ok(cs.slim.hasPoint(1.55, 1.8, 0), 'the eave is slim');
  assert.ok(!cs.slim.hasPoint(...AIM), 'nothing at the aim');
});
