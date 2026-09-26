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
const { FAR_BANK_ZONE, FAR_BANK_BEND, FAR_BANK_SOUTH, FAR_BANK_SMALL_SHADOWS, FAR_BANK_SHADOW_REACH, FAR_BANK_SMALL_DRAWS, inFarBankZone, inFarBankSouth, farBankDistance, farBankShadowRules, farBankDrawRule, farBankLodAt } = loadTs(path.join(here, 'farBankLocality.ts'));
const { LAYOUT, EXPANSION_SOUTH, EXPANSION_SOUTH_DWELLINGS } = loadTs(path.join(here, '../layout.ts'));
const { FOLLOW } = loadTs(path.join(here, '../../camera/follow.ts'));

// the box was measured with the bridge's sills at z 30.45 and 43.7 and the log's mouth at (4.25, 46.9):
// if any moves, the zone-probe grabs and A/B captures that sized it no longer describe the place
test('the zone starts at the bridge’s north sill, its south part 1.2 m short of the far sill; both centred on the far path', () => {
  const north = EXPANSION_SOUTH.bridge.north;
  assert.ok(Math.abs(north[1] - FAR_BANK_ZONE.z0) < 1e-9, `north sill z ${north[1]} = zone z0 ${FAR_BANK_ZONE.z0}`);
  const sill = EXPANSION_SOUTH.bridge.south;
  assert.ok(Math.abs(sill[1] - 1.2 - FAR_BANK_SOUTH.z0) < 1e-9, `far sill z ${sill[1]} − 1.2 = south part z0 ${FAR_BANK_SOUTH.z0}`);
  assert.deepEqual([FAR_BANK_SOUTH.x0, FAR_BANK_SOUTH.z1], [FAR_BANK_ZONE.x0, FAR_BANK_ZONE.z1], 'the south part shares the zone’s west and south bounds');
  assert.equal(FAR_BANK_SOUTH.x1, 11, 'the south part keeps the far bank’s x band the shadow reach was measured with');
  const mouth = EXPANSION_SOUTH.tunnel.mouth;
  assert.deepEqual([...mouth], [4.25, 46.9], 'the log’s mouth where the zone was measured');
  for (const p of EXPANSION_SOUTH.farPath) {
    assert.ok(p[0] - FAR_BANK_ZONE.x0 > 5.5 && FAR_BANK_SOUTH.x1 - p[0] > 6, `far path x ${p[0]} well inside the south part’s x band`);
  }
});

// camera positions from the play-test's `south-dwellings` trace (gauntlet/scripts/playtest.mjs) where
// the village was in the frame and the camera outside the zone as it was (x1 11, no corner): 9.13–9.47 M
test('turning off the path onto the waystation’s steps, the camera’s swing west of the path’s last straight is inside the zone', () => {
  for (const [x, y, z] of [[2.27, 1.32, 30.13], [2.36, 1.3, 29.86], [2.17, 1.32, 29.7], [1.68, 1.39, 29.55], [1.53, 1.65, 29.17], [1.46, 1.7, 29.03], [1.25, 1.74, 28.7]]) {
    assert.equal(inFarBankZone(x, y, z), true, `camera (${x}, ${y}, ${z})`);
    assert.equal(inFarBankSouth(x, y, z), false, `not the far bank (${x}, ${z})`);
  }
  assert.equal(inFarBankZone(0.72, 1.82, 27.6), false, 'facing east onto the steps (heading 108°, the village out of the frame) it has left');
  assert.equal(inFarBankZone(2, FAR_BANK_ZONE.yMax + 0.1, 29.5), false, 'above the cap');
  assert.equal(FAR_BANK_BEND.z1, FAR_BANK_ZONE.z0, 'the corner meets the zone at the north sill');
  const path = EXPANSION_SOUTH.path;
  const last = path.slice(-3);
  for (const [x, , z] of last) assert.ok(x - FAR_BANK_BEND.x1 > 0.08, `the path’s last straight (${x}, ${z}) east of the corner`);
  const W = EXPANSION_SOUTH_DWELLINGS.waystation;
  assert.ok(W.centre[1] < FAR_BANK_BEND.z0 - 2 && W.centre[0] > FAR_BANK_BEND.x1 + 1.5, 'the waystation south-east of the corner');
});

test('off the keeper’s gallery’s east end and back west, the trailing camera is inside the zone', () => {
  for (const [x, y, z] of [[11.6, 1.6, 34.7], [12.05, 1.42, 34.05], [11.95, 1.36, 33.64], [12.13, 1.22, 30.64]]) {
    assert.equal(inFarBankZone(x, y, z), true, `camera (${x}, ${y}, ${z})`);
  }
  const K = EXPANSION_SOUTH_DWELLINGS.keeper;
  const plan = FOLLOW.distance * Math.cos((20 * Math.PI) / 180);
  const end = (-14 * Math.PI) / 180;
  const stepEnd = [K.centre[0] + Math.cos(end) * 2.9, K.centre[1] + Math.sin(end) * 2.9];
  assert.equal(inFarBankZone(stepEnd[0] + plan, 1.6, stepEnd[1]), true, `Link at the east step’s end (${stepEnd.map((v) => v.toFixed(2))}) facing west: camera ${(stepEnd[0] + plan).toFixed(2)} m east`);
  assert.ok(FAR_BANK_ZONE.x1 - (stepEnd[0] + plan) > 0.5, 'with room to spare');
});

test('a camera over the far path, in the log and in the cleft is inside the zone and its south part; above the cap it is not', () => {
  for (const [x, z] of [[4.1, 43.9], [4.14, 45.2], [4.2, 46.3], [4.3, 50.7], [4.33, 59.5]]) {
    for (const y of [1.0, 1.9, 2.8, 3.9]) {
      assert.equal(inFarBankZone(x, y, z), true, `(${x}, ${y}, ${z})`);
      assert.equal(inFarBankSouth(x, y, z), true, `south part (${x}, ${y}, ${z})`);
    }
    assert.equal(inFarBankZone(x, FAR_BANK_ZONE.yMax + 0.1, z), false, `above the cap at (${x}, ${z})`);
    assert.equal(inFarBankSouth(x, FAR_BANK_ZONE.yMax + 0.1, z), false, `south part above the cap at (${x}, ${z})`);
  }
});

test('walking back over the bridge and up the path’s last straight facing the village, the follow camera is inside the zone', () => {
  const [nx, nz] = EXPANSION_SOUTH.bridge.north;
  const [sx, sz] = EXPANSION_SOUTH.bridge.south;
  const plan = FOLLOW.distance * Math.cos((20 * Math.PI) / 180);
  assert.ok(plan > 4.04, `the camera stands ${plan.toFixed(3)} m behind Link in plan at 20° of pitch`);
  for (let u = 0; u <= 1; u += 0.05) {
    const x = nx + (sx - nx) * u;
    const z = nz + (sz - nz) * u;
    assert.equal(inFarBankZone(x, 2.4, z + plan), true, `Link at z ${z.toFixed(2)} facing north: camera at z ${(z + plan).toFixed(2)}`);
    assert.equal(inFarBankSouth(x, 2.4, z + plan), z + plan > FAR_BANK_SOUTH.z0, `south part at z ${(z + plan).toFixed(2)}`);
  }
  // off the sill, along the path's nodes to its bend: facing the next node, the camera behind him
  const path = EXPANSION_SOUTH.path;
  const bend = path.length - 3;
  for (let i = path.length - 1; i > bend; i--) {
    const [x, , z] = path[i];
    const [tx, , tz] = path[i - 1];
    const d = Math.hypot(tx - x, tz - z);
    const cx = x - ((tx - x) / d) * plan;
    const cz = z - ((tz - z) / d) * plan;
    assert.equal(inFarBankZone(cx, 1.6, cz), true, `Link at path node (${x}, ${z}) facing (${tx}, ${tz}): camera at (${cx.toFixed(2)}, ${cz.toFixed(2)})`);
  }
});

test('the path to the bridge head, the waystation and every fixed viewpoint stay outside; the keeper’s hut is inside', () => {
  for (const [x, , z] of EXPANSION_SOUTH.path) assert.equal(inFarBankZone(x, 1.9, z), false, `path node (${x}, ${z})`);
  const K = EXPANSION_SOUTH_DWELLINGS.keeper;
  const W = EXPANSION_SOUTH_DWELLINGS.waystation;
  assert.equal(inFarBankZone(K.centre[0], 2, K.centre[1]), true, 'the keeper’s hut (the LOD leaves the south group alone)');
  assert.equal(inFarBankZone(W.centre[0], 2, W.centre[1]), false, 'the waystation');
  assert.ok(LAYOUT.viewpoints.length >= 6);
  for (const v of LAYOUT.viewpoints) assert.equal(inFarBankZone(v.position[0], v.position[1], v.position[2]), false, v.id);
});

test('the shadow distances apply inside the zone only — the far bank’s reach in its south part — never at a fixed viewpoint', () => {
  assert.deepEqual(farBankShadowRules({ x: 4.8, y: 2.6, z: 43.6 }), [FAR_BANK_SMALL_SHADOWS, FAR_BANK_SHADOW_REACH], 'the far-bank look-back');
  assert.deepEqual(farBankShadowRules({ x: 4.33, y: 1.3, z: 59.5 }), [FAR_BANK_SMALL_SHADOWS, FAR_BANK_SHADOW_REACH], 'the cleft');
  assert.deepEqual(farBankShadowRules({ x: 4.0, y: 1.9, z: 38.0 }), [FAR_BANK_SMALL_SHADOWS], 'over the bridge’s south part');
  assert.deepEqual(farBankShadowRules({ x: 3.8, y: 1.9, z: 33.0 }), [FAR_BANK_SMALL_SHADOWS], 'over the bridge’s north end');
  assert.equal(farBankShadowRules({ x: 3.0, y: 1.9, z: 28.0 }), undefined, 'over the path by the waystation');
  assert.equal(farBankShadowRules({ x: 4.8, y: FAR_BANK_ZONE.yMax + 0.1, z: 43.6 }), undefined, 'above the cap');
  for (const v of LAYOUT.viewpoints) assert.equal(farBankShadowRules({ x: v.position[0], y: v.position[1], z: v.position[2] }), undefined, v.id);
  assert.ok(FAR_BANK_SMALL_SHADOWS.minDistanceM >= 20 && FAR_BANK_SMALL_SHADOWS.maxRadiusM <= 2, 'a distance past the far bank, a radius for figures and small props');
  assert.equal(FAR_BANK_SHADOW_REACH.box, FAR_BANK_SOUTH, 'the reach is measured from the far bank itself');
  assert.ok(FAR_BANK_SHADOW_REACH.minDistanceM >= 20, 'everything within 20 m of the far bank keeps its shadow');
  const K = EXPANSION_SOUTH_DWELLINGS.keeper;
  assert.ok(FAR_BANK_SOUTH.z0 - (K.centre[1] - K.radius) < FAR_BANK_SHADOW_REACH.minDistanceM, 'the keeper’s hut, across the gorge, is within the reach');
});

test('the small-thing draw distance applies inside the zone only, never at a fixed viewpoint, and stays under 12.5 px', () => {
  assert.equal(farBankDrawRule({ x: 4.8, y: 2.6, z: 43.6 }), FAR_BANK_SMALL_DRAWS, 'the far-bank look-back');
  assert.equal(farBankDrawRule({ x: 4.33, y: 1.3, z: 59.5 }), FAR_BANK_SMALL_DRAWS, 'the cleft');
  assert.equal(farBankDrawRule({ x: 4.0, y: 1.9, z: 38.0 }), FAR_BANK_SMALL_DRAWS, 'over the bridge’s south part');
  assert.equal(farBankDrawRule({ x: 3.8, y: 1.9, z: 33.0 }), FAR_BANK_SMALL_DRAWS, 'over the bridge’s north end');
  assert.equal(farBankDrawRule({ x: 3.0, y: 1.9, z: 28.0 }), undefined, 'over the path by the waystation');
  assert.equal(farBankDrawRule({ x: 4.8, y: FAR_BANK_ZONE.yMax + 0.1, z: 43.6 }), undefined, 'above the cap');
  for (const v of LAYOUT.viewpoints) assert.equal(farBankDrawRule({ x: v.position[0], y: v.position[1], z: v.position[2] }), undefined, v.id);
  const { maxRadiusM, minDistanceM } = FAR_BANK_SMALL_DRAWS;
  const rowsAcross = ((2 * Math.atan(maxRadiusM / minDistanceM)) / ((46 * Math.PI) / 180)) * 540;
  assert.ok(rowsAcross <= 12.5, `a hidden sphere spans ${rowsAcross.toFixed(2)} of 540 rows at fov 46`);
  assert.ok(maxRadiusM >= 0.95, 'a kid hides whole: her largest skinned sphere is 0.95 m');
});

test('__KF_FARBANK_OFF__ switches the whole zone LOD off and back', () => {
  const lookBack = { x: 4.8, y: 2.6, z: 43.6 };
  assert.equal(farBankLodAt(lookBack), true);
  try {
    globalThis.__KF_FARBANK_OFF__ = true;
    assert.equal(farBankLodAt(lookBack), false);
    assert.equal(farBankShadowRules(lookBack), undefined);
    assert.equal(farBankDrawRule(lookBack), undefined);
    assert.equal(inFarBankZone(lookBack.x, lookBack.y, lookBack.z), true, 'the zone itself does not move');
  } finally {
    delete globalThis.__KF_FARBANK_OFF__;
  }
  assert.equal(farBankLodAt(lookBack), true);
});

test('farBankDistance: 0 for a box over the zone, the horizontal gap otherwise', () => {
  const box = (x0, z0, x1, z1) => new THREE.Box3(new THREE.Vector3(x0, -5, z0), new THREE.Vector3(x1, 9, z1));
  assert.equal(farBankDistance(box(3, 50, 5, 52)), 0, 'inside');
  assert.equal(farBankDistance(box(-30, 40, 30, 70)), 0, 'spanning');
  assert.ok(Math.abs(farBankDistance(box(0, -20, 4, 1.5)) - (FAR_BANK_BEND.z0 - 1.5)) < 1e-9, 'north of the corner: the z gap to the corner');
  assert.ok(Math.abs(farBankDistance(box(14, -20, 15, 1.5)) - (FAR_BANK_ZONE.z0 - 1.5)) < 1e-9, 'north of the zone, far enough east that the corner is further: the z gap to the zone');
  assert.ok(Math.abs(farBankDistance(box(17, 20, 19, 30)) - Math.hypot(17 - FAR_BANK_ZONE.x1, FAR_BANK_ZONE.z0 - 30)) < 1e-9, 'north-east of it: the corner gap');
  assert.ok(Math.abs(farBankDistance(box(-9, 26, -5, 28)) - Math.hypot(FAR_BANK_BEND.x0 - -5, FAR_BANK_BEND.z0 - 28)) < 1e-9, 'north-west of the corner: its corner gap');
});
