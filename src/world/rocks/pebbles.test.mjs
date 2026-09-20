/** Run: node --test src/world/rocks/pebbles.test.mjs (Node 20+, no browser needed). */
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
const { scatterPathPebbles, stairFootPebbles, PEBBLE_DEFAULTS } = loadTs(path.join(here, 'pebbles.ts'));

/**
 * a synthetic paved strip 3 m wide along z (x −1.5 … 1.5) with a soft fringe falling off over
 * 0.3 m, plus optional extra paved discs (the "edit")
 */
function stripTerrain(discs = []) {
  const pathMask = (x, z) => {
    let d = Math.abs(x) - 1.5; // distance outside the strip
    for (const c of discs) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
    if (d <= 0) return 1;
    return Math.max(0, 1 - d / 0.3);
  };
  return {
    height: (x, z) => 1 + 0.02 * Math.sin(x) * Math.cos(z),
    normal(x, z, out = new THREE.Vector3()) {
      return out.set(0, 1, 0);
    },
    slope() {
      return 0;
    },
    mask(x, z) {
      return { path: pathMask(x, z), stairs: 0, cliff: 0, structure: 0, plateau: 0 };
    },
  };
}

const opts = { ...PEBBLE_DEFAULTS, radius: 30, northZ: -55, density: 1 };
const key = (p) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)},${p.scale.toFixed(5)},${p.yaw.toFixed(5)},${p.variant}`;

test('the scatter is deterministic and lands on the paving fringe and just off it', () => {
  const T = stripTerrain();
  const a = scatterPathPebbles(T, 'seed', opts);
  const b = scatterPathPebbles(T, 'seed', opts);
  assert.deepEqual(a.main.map(key), b.main.map(key));
  assert.ok(a.main.length > 400, `only ${a.main.length} pebbles on a 60 m strip`);
  for (const p of a.main) {
    const m = T.mask(p.x, p.z).path;
    assert.ok(m <= 0.55, `pebble on the slabs (mask ${m})`);
    assert.ok(Math.abs(p.x) < 1.5 + 4.5, `pebble ${p.x} far from the paving`);
    assert.ok(Math.abs(p.y - (T.height(p.x, p.z) - p.scale * 0.35)) < 1e-9, 'seated');
  }
  assert.equal(a.north.length, 0);
});

test('a paving edit moves only the pebbles around it (per-cell draws)', () => {
  const before = scatterPathPebbles(stripTerrain(), 'seed', opts);
  const edit = { x: 3.5, z: 8, r: 1.2 };
  const after = scatterPathPebbles(stripTerrain([edit]), 'seed', opts);
  // an edit reaches 4 m (the scatter's dilation) + 1 m (the paving grid) + a coarse cell beyond
  // its own footprint; nothing further may move
  const near = (p) => Math.hypot(p.x - edit.x, p.z - edit.z) < edit.r + 6.5;
  const farBefore = new Set(before.main.filter((p) => !near(p)).map(key));
  const farAfter = new Set(after.main.filter((p) => !near(p)).map(key));
  assert.equal(farBefore.size, farAfter.size, 'a pebble far from the edit appeared or vanished');
  for (const k of farBefore) assert.ok(farAfter.has(k), `pebble far from the edit moved: ${k}`);
  // and the edit itself did change the stones around it (a new fringe around the disc)
  const nearBefore = new Set(before.main.filter(near).map(key));
  const nearAfter = new Set(after.main.filter(near).map(key));
  let changed = 0;
  for (const k of nearAfter) if (!nearBefore.has(k)) changed++;
  assert.ok(changed > 10, `the edit changed only ${changed} pebbles near it`);
});

test('pebbles beyond northZ are returned separately', () => {
  const T = stripTerrain();
  const r = scatterPathPebbles(T, 'seed', { ...opts, northZ: 0 });
  assert.ok(r.north.length > 100 && r.main.length > 100);
  for (const p of r.north) assert.ok(p.z < 0);
  for (const p of r.main) assert.ok(p.z >= 0);
});

test('stair-foot pebbles: per-flight streams — adding a flight moves none of another flight\'s', () => {
  const T = stripTerrain();
  const a = { id: 'a', base: [4, 1, 2], dir: [1, 0], width: 2.4 };
  const b = { id: 'b', base: [-6, 1, -9], dir: [0, -1], width: 1.8 };
  const onlyA = stairFootPebbles(T, 'seed', a, 1);
  const withB = stairFootPebbles(T, 'seed', b, 1);
  const againA = stairFootPebbles(T, 'seed', a, 1);
  assert.deepEqual(onlyA.map(key), againA.map(key));
  assert.ok(onlyA.length > 50 && withB.length > 50);
  for (const p of onlyA) {
    // below the first riser, within the width + 1 m each side
    assert.ok(p.x < a.base[0] && p.x > a.base[0] - 1.7, `stair pebble x ${p.x}`);
    assert.ok(Math.abs(p.z - a.base[2]) <= a.width / 2 + 1.0 + 1e-9, `stair pebble z ${p.z}`);
  }
});
