/** Run: node --test src/world/rocks/clearing.test.mjs (Node 20+, no browser needed). */
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
const { buildClearingRocks } = loadTs(path.join(here, 'clearing.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));

/**
 * a synthetic clearing: a paved disc (radius 4) at 4 m, banks rising to 5.6 m by 3 m outside it,
 * a stair footprint north of the disc (x 0.3 … 2.1, z −3.4 … −7.7) and a terrace pad beyond
 */
function clearingTerrain() {
  const height = (x, z) => {
    const d = Math.hypot(x, z);
    const t = Math.min(1, Math.max(0, (d - 4) / 3));
    return 4 + 1.6 * t * t * (3 - 2 * t) + 0.05 * Math.sin(x * 1.3) * Math.cos(z * 0.9);
  };
  return {
    height,
    normal(x, z, out = new THREE.Vector3()) {
      const e = 0.05;
      return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
    },
    slope(x, z) {
      return 1 - this.normal(x, z).y;
    },
    mask(x, z) {
      const path = Math.hypot(x, z) < 4 ? 1 : 0;
      const stairs = x > 0.3 && x < 2.1 && z < -3.4 && z > -7.7 ? 1 : 0;
      return { path, stairs, cliff: 0, structure: 0, plateau: 0 };
    },
  };
}

const layout = {
  northClearing: { x: 0, z: 0, y: 4, radius: 4 },
  stairs: [{ id: 'ledge', base: [1.2, 4, -3.4], dir: [0, -1], steps: 6, rise: 0.27, tread: 0.42, width: 1.8 }],
  ledgeTerrace: { x: -0.7, z: -8.5, y: 5.6, halfLength: 2.4, halfDepth: 1.5 },
};

test('the clearing dressing is deterministic, one geometry with the rock material attributes', () => {
  const T = clearingTerrain();
  const a = buildClearingRocks(layout, T, createRng('t/c'), 'seed', [-0.5, -0.86]);
  const b = buildClearingRocks(layout, T, createRng('t/c'), 'seed', [-0.5, -0.86]);
  assert.ok(a && b);
  assert.deepEqual(a.stats, b.stats);
  assert.deepEqual(Array.from(a.geometry.attributes.position.array.slice(0, 300)), Array.from(b.geometry.attributes.position.array.slice(0, 300)));
  for (const name of ['position', 'normal', 'color', 'aMoss', 'aWet', 'aLichen']) assert.ok(a.geometry.attributes[name], `attribute ${name}`);
  assert.equal(a.stats.boulders, 2, 'the pair');
  assert.ok(a.stats.scree >= 12 && a.stats.scree <= 24, `scree ${a.stats.scree}`);
  assert.ok(a.stats.slabs >= 3, `slabs ${a.stats.slabs}`);
  assert.ok(a.stats.triangles < 90000, `triangles ${a.stats.triangles}`);
});

test('every piece stands off the paving and the treads, seated in its ground', () => {
  const T = clearingTerrain();
  const a = buildClearingRocks(layout, T, createRng('t/c'), 'seed', [-0.5, -0.86]);
  for (const [x, y, z] of a.contacts) {
    const m = T.mask(x, z);
    assert.ok(m.path < 0.05 && m.stairs < 0.2, `seat (${x.toFixed(2)}, ${z.toFixed(2)}) on the paving / treads`);
    // (the boulders' seat is the mean ground under their footprint, the small stones' the point)
    assert.ok(Math.abs(y - T.height(x, z)) < 0.2, `seat y ${y} vs ground ${T.height(x, z)}`);
  }
  // the pair is on the WEST bank, just outside the paved disc
  const pair = a.contacts.slice(0, 2);
  for (const [x, , z] of pair) {
    assert.ok(x < -4.3 && x > -6.5, `pair x ${x}`);
    assert.ok(Math.abs(z) < 2.5, `pair z ${z}`);
  }
  // nothing floats: the lowest vertex of the whole dressing is below the highest ground under it
  const P = a.geometry.attributes.position;
  let below = 0;
  for (let i = 0; i < P.count; i += 7) if (P.getY(i) < T.height(P.getX(i), P.getZ(i))) below++;
  assert.ok(below > P.count / 7 / 8, `only ${below} sampled vertices under the ground — the pieces are not buried`);
});

test('no clearing in the layout → nothing built', () => {
  const T = clearingTerrain();
  assert.equal(buildClearingRocks({ stairs: layout.stairs }, T, createRng('t/c'), 'seed', [-0.5, -0.86]), null);
});
