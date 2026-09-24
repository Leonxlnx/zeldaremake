/** Run: node --test src/world/structures/shadowProxy.test.mjs (Node 20+, no browser needed). */
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
const { clusterIndex, attachShadowProxy, rangedTriangles } = loadTs(path.join(here, 'shadowProxy.ts'));

const ball = () => new THREE.SphereGeometry(1, 160, 80);
const caster = (g) => {
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  m.castShadow = true;
  return m;
};

test('clustering keeps real vertices, drops collapsed and repeated triangles, and keeps the winding', () => {
  const g = ball();
  const pos = g.attributes.position;
  const fine = g.index.count / 3;
  const coarse = clusterIndex(pos, g.index.array, 0.1);
  assert.equal(coarse.length % 3, 0);
  assert.ok(coarse.length / 3 < fine * 0.25, `0.1 m cells on a 1 m ball: ${coarse.length / 3} of ${fine} triangles`);
  const seen = new Set();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  let outward = 0;
  for (let t = 0; t < coarse.length; t += 3) {
    const [i, j, k] = coarse.slice(t, t + 3);
    for (const v of [i, j, k]) assert.ok(Number.isInteger(v) && v >= 0 && v < pos.count);
    assert.ok(i !== j && j !== k && i !== k, 'no collapsed triangle');
    const r = [i, j, k];
    const s = r.indexOf(Math.min(...r));
    const key = [r[s], r[(s + 1) % 3], r[(s + 2) % 3]].join(',');
    assert.ok(!seen.has(key), 'no repeated triangle');
    seen.add(key);
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j);
    c.fromBufferAttribute(pos, k);
    n.subVectors(c, b).cross(a.clone().sub(b));
    if (n.dot(a.clone().add(b).add(c)) > 0) outward++;
  }
  assert.ok(outward / (coarse.length / 3) > 0.97, `the ball's winding survives: ${outward} of ${coarse.length / 3} outward`);
});

test('the coarse surface runs through the fine one: keepers on the ball, chords just inside it', () => {
  const g = ball();
  const pos = g.attributes.position;
  const coarse = clusterIndex(pos, g.index.array, 0.08);
  const p = new THREE.Vector3();
  let deepest = 0;
  let outside = 0;
  for (let t = 0; t < coarse.length; t += 3) {
    p.set(0, 0, 0);
    for (let j = 0; j < 3; j++) {
      const v = coarse[t + j];
      assert.ok(Math.abs(Math.hypot(pos.getX(v), pos.getY(v), pos.getZ(v)) - 1) < 1e-5, 'a keeper is a vertex of the ball');
      p.x += pos.getX(v) / 3;
      p.y += pos.getY(v) / 3;
      p.z += pos.getZ(v) / 3;
    }
    const r = p.length();
    deepest = Math.max(deepest, 1 - r);
    if (r > 1 + 1e-6) outside++;
  }
  assert.equal(outside, 0, 'no coarse triangle bulges out of a convex surface');
  assert.ok(deepest < 0.02, `the chords sag at most ${deepest.toFixed(4)} m inside`);
});

test('clustering is deterministic', () => {
  const g = ball();
  assert.deepEqual(clusterIndex(g.attributes.position, g.index.array, 0.12), clusterIndex(g.attributes.position, g.index.array, 0.12));
});

test('attach: the colour pass draws the fine list, the shadow pass the coarse one, and any range set meanwhile comes back', () => {
  const m = caster(ball());
  const g = m.geometry;
  const fine = g.index.count;
  const p = attachShadowProxy(m, 0.1);
  assert.ok(p && p.fine === fine / 3 && p.coarse > 0 && p.coarse < p.fine * 0.7 && p.cell === 0.1);
  assert.equal(g.index.count, fine + p.coarse * 3, 'the coarse list is appended to the index');
  assert.equal(g.index.array.constructor, Uint16Array, 'same index type (the vertices are the same)');
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, fine]);
  assert.equal(rangedTriangles(g), fine / 3, 'what the colour pass submits');
  assert.deepEqual(m.userData.shadowProxy, p);
  m.onBeforeShadow();
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [fine, p.coarse * 3]);
  m.onAfterShadow();
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, fine]);
  // main.ts's warm-up narrows every range to one triangle and renders once, shadows included
  g.setDrawRange(0, 3);
  m.onBeforeShadow();
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [fine, p.coarse * 3]);
  m.onAfterShadow();
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, 3], 'the warm-up range survives the shadow pass');
});

test('attach refuses what it cannot or need not proxy', () => {
  const coarseBall = caster(new THREE.SphereGeometry(1, 12, 8));
  assert.equal(attachShadowProxy(coarseBall, 0.05), null, 'nothing to save');
  assert.equal(coarseBall.geometry.index.count, 12 * 8 * 6 - 12 * 6, 'index untouched');
  const noCast = caster(ball());
  noCast.castShadow = false;
  assert.equal(attachShadowProxy(noCast, 0.1), null, 'not a caster');
  const flat = caster(ball().toNonIndexed());
  assert.equal(attachShadowProxy(flat, 0.1), null, 'unindexed');
  const ranged = caster(ball());
  ranged.geometry.setDrawRange(0, 300);
  assert.equal(attachShadowProxy(ranged, 0.1), null, 'already ranged');
});

test('rangedTriangles follows the draw range', () => {
  const g = ball();
  const n = g.index.count / 3;
  assert.equal(rangedTriangles(g), n);
  g.setDrawRange(30, 60);
  assert.equal(rangedTriangles(g), 20);
  g.setDrawRange(g.index.count - 9, Infinity);
  assert.equal(rangedTriangles(g), 3);
});
