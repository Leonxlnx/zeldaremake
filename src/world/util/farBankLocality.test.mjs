/** Run: node --test src/world/util/farBankLocality.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

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
const { FAR_BANK_ZONE, FAR_BANK_SMALL_SHADOWS, inFarBankZone, farBankDistance, farBankShadowRule } = loadTs(path.join(here, 'farBankLocality.ts'));
const { LAYOUT, EXPANSION_SOUTH, EXPANSION_SOUTH_DWELLINGS } = loadTs(path.join(here, '../layout.ts'));

// the box was measured with the bridge's far sill at z 43.7 and the log's mouth at (4.25, 46.9):
// if either moves, the zone-probe grabs that sized it no longer describe the place
test('the zone starts 1.2 m short of the bridge’s far sill and is centred on the far path', () => {
  const sill = EXPANSION_SOUTH.bridge.south;
  assert.ok(Math.abs(sill[1] - 1.2 - FAR_BANK_ZONE.z0) < 1e-9, `far sill z ${sill[1]} − 1.2 = zone z0 ${FAR_BANK_ZONE.z0}`);
  const mouth = EXPANSION_SOUTH.tunnel.mouth;
  assert.deepEqual([...mouth], [4.25, 46.9], 'the log’s mouth where the zone was measured');
  for (const p of EXPANSION_SOUTH.farPath) {
    assert.ok(p[0] - FAR_BANK_ZONE.x0 > 5.5 && FAR_BANK_ZONE.x1 - p[0] > 6, `far path x ${p[0]} well inside the zone’s x band`);
  }
});

test('a camera over the far path, in the log and in the cleft is inside; above the cap it is not', () => {
  for (const [x, z] of [[4.1, 43.9], [4.14, 45.2], [4.2, 46.3], [4.3, 50.7], [4.33, 59.5]]) {
    for (const y of [1.0, 1.9, 2.8, 3.9]) assert.equal(inFarBankZone(x, y, z), true, `(${x}, ${y}, ${z})`);
    assert.equal(inFarBankZone(x, FAR_BANK_ZONE.yMax + 0.1, z), false, `above the cap at (${x}, ${z})`);
  }
});

test('the bridge north of its last 1.2 m, the dwellings and every fixed viewpoint stay outside', () => {
  const [nx, nz] = EXPANSION_SOUTH.bridge.north;
  const [sx, sz] = EXPANSION_SOUTH.bridge.south;
  for (let u = 0; u <= 1; u += 0.05) {
    const z = nz + (sz - nz) * u;
    if (z >= FAR_BANK_ZONE.z0) continue;
    assert.equal(inFarBankZone(nx + (sx - nx) * u, 1.9, z), false, `bridge at z ${z.toFixed(2)}`);
  }
  const K = EXPANSION_SOUTH_DWELLINGS.keeper;
  const W = EXPANSION_SOUTH_DWELLINGS.waystation;
  assert.equal(inFarBankZone(K.centre[0], 2, K.centre[1]), false, 'the keeper’s hut');
  assert.equal(inFarBankZone(W.centre[0], 2, W.centre[1]), false, 'the waystation');
  assert.ok(LAYOUT.viewpoints.length >= 6);
  for (const v of LAYOUT.viewpoints) assert.equal(inFarBankZone(v.position[0], v.position[1], v.position[2]), false, v.id);
});

test('the small-caster shadow distance applies inside the zone only, never at a fixed viewpoint', () => {
  assert.equal(farBankShadowRule({ x: 4.8, y: 2.6, z: 43.6 }), FAR_BANK_SMALL_SHADOWS, 'the far-bank look-back');
  assert.equal(farBankShadowRule({ x: 4.33, y: 1.3, z: 59.5 }), FAR_BANK_SMALL_SHADOWS, 'the cleft');
  assert.equal(farBankShadowRule({ x: 4.0, y: 1.9, z: 37.0 }), undefined, 'on the bridge');
  assert.equal(farBankShadowRule({ x: 4.8, y: FAR_BANK_ZONE.yMax + 0.1, z: 43.6 }), undefined, 'above the cap');
  for (const v of LAYOUT.viewpoints) assert.equal(farBankShadowRule({ x: v.position[0], y: v.position[1], z: v.position[2] }), undefined, v.id);
  assert.ok(FAR_BANK_SMALL_SHADOWS.minDistanceM >= 20 && FAR_BANK_SMALL_SHADOWS.maxRadiusM <= 2, 'a distance past the far bank, a radius for figures and small props');
});

test('farBankDistance: 0 for a box over the zone, the horizontal gap otherwise', () => {
  const box = (x0, z0, x1, z1) => new THREE.Box3(new THREE.Vector3(x0, -5, z0), new THREE.Vector3(x1, 9, z1));
  assert.equal(farBankDistance(box(3, 50, 5, 52)), 0, 'inside');
  assert.equal(farBankDistance(box(-30, 40, 30, 70)), 0, 'spanning');
  assert.ok(Math.abs(farBankDistance(box(0, -20, 4, 1.5)) - (FAR_BANK_ZONE.z0 - 1.5)) < 1e-9, 'north of it: the z gap');
  assert.ok(Math.abs(farBankDistance(box(14, 20, 16, 30)) - Math.hypot(14 - FAR_BANK_ZONE.x1, FAR_BANK_ZONE.z0 - 30)) < 1e-9, 'north-east of it: the corner gap');
});
