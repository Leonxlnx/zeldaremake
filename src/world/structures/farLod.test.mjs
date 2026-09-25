/** Run: node --test src/world/structures/farLod.test.mjs (Node 20+, no browser needed). */
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
const { farColourIndex, attachFarLod } = loadTs(path.join(here, 'farLod.ts'));
const { attachShadowProxy, rangedTriangles } = loadTs(path.join(here, 'shadowProxy.ts'));

const IDENTITY = new THREE.Matrix4();
/** a cell of 8 cm everywhere (level 4 from 2 cm) */
const cell8 = () => 0.08;

/** a 1 m square of 2 cm quads facing +z, one indexed piece */
const plate = () => new THREE.PlaneGeometry(1, 1, 50, 50);
/**
 * a flat strip 2 cm wide and 1 m long (a blade, a ribbon) on one texture patch: narrower than an 8 cm
 * cell, and centred in one (the grid starts at the merged parts' least x, the card's edge at −2.15)
 */
const strip = () => {
  const g = new THREE.PlaneGeometry(0.02, 1, 1, 50).translate(-2.15 + 52.5 * 0.08, 0, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.25);
  return g;
};
/** the same strip with its edges on two patches (u 0 and 1): they stay apart, so it keeps its width */
const stripAcross = () => new THREE.PlaneGeometry(0.02, 1, 1, 50).translate(3, 0, 0);
/** a round rope 2 cm thick: the six facings keep its cross-section apart */
const rope = () => new THREE.CylinderGeometry(0.01, 0.01, 1, 8, 50, true).translate(4, 0, 0);
/** a two-triangle card */
const card = () => new THREE.PlaneGeometry(0.3, 0.3, 1, 1).translate(-2, 0, 0);

const triangles = (geometry, list) => {
  const p = geometry.attributes.position;
  const out = [];
  for (let t = 0; t < list.length; t += 3) out.push([list[t], list[t + 1], list[t + 2]].map((i) => new THREE.Vector3().fromBufferAttribute(p, i)));
  return out;
};
const area = (tris) => tris.reduce((n, [a, b, c]) => n + new THREE.Triangle(a, b, c).getArea(), 0);

test('a dense surface clusters to a fraction of its triangles, same side up, most of its area kept', () => {
  const g = plate();
  const coarse = farColourIndex(g, IDENTITY, g.index.count, cell8);
  assert.ok(coarse, 'something clusters');
  const fine = g.index.count / 3;
  assert.ok(coarse.length / 3 < 0.2 * fine, `${coarse.length / 3} coarse triangles of ${fine}`);
  for (const i of coarse) assert.ok(Number.isInteger(i) && i >= 0 && i < g.attributes.position.count);
  const tris = triangles(g, coarse);
  const normal = new THREE.Vector3();
  for (const [a, b, c] of tris) {
    new THREE.Triangle(a, b, c).getNormal(normal);
    assert.ok(normal.z > 0.99, 'no coarse triangle is flipped');
  }
  const kept = area(tris);
  assert.ok(kept > 0.75 && kept <= 1.0001, `coarse area ${kept.toFixed(3)} m² of 1`);
});

test('a strip narrower than its cells and a small card keep their own triangles; a round rope thins to a coarser tube', () => {
  const parts = [plate(), strip(), card(), rope(), stripAcross()];
  const from = [0];
  for (const p of parts) from.push(from[from.length - 1] + p.attributes.position.count);
  const g = BufferGeometryUtils.mergeGeometries(parts);
  const coarse = farColourIndex(g, IDENTITY, g.index.count, cell8);
  const inPart = (list, k) => {
    const out = [];
    for (let t = 0; t < list.length; t += 3) if (list[t] >= from[k] && list[t] < from[k + 1]) out.push(`${list[t]},${list[t + 1]},${list[t + 2]}`);
    return out.sort();
  };
  const all = g.index.array;
  assert.ok(inPart(coarse, 0).length < 0.2 * inPart(all, 0).length, 'the plate clusters');
  assert.deepEqual(inPart(coarse, 1), inPart(all, 1), 'the strip is drawn as built');
  assert.deepEqual(inPart(coarse, 2), inPart(all, 2), 'the card is drawn as built');
  const ropeCoarse = triangles(g, coarse).filter(([a]) => a.x > 3.5);
  const ropeFine = triangles(g, Array.from(all)).filter(([a]) => a.x > 3.5);
  assert.ok(ropeCoarse.length < 0.5 * ropeFine.length, `the rope thins: ${ropeCoarse.length} of ${ropeFine.length}`);
  assert.ok(area(ropeCoarse) > 0.5 * area(ropeFine), 'and keeps most of its surface');
  const acrossCoarse = triangles(g, coarse).filter(([a]) => a.x > 2.5 && a.x < 3.5);
  const acrossFine = triangles(g, Array.from(all)).filter(([a]) => a.x > 2.5 && a.x < 3.5);
  assert.ok(acrossCoarse.length < acrossFine.length, 'the two-patch strip thins along its length');
  assert.ok(area(acrossCoarse) > 0.75 * area(acrossFine), 'and keeps its width');
});

test('vertices whose cell falls under the smallest one stay put', () => {
  const g = plate();
  assert.equal(farColourIndex(g, IDENTITY, g.index.count, () => 0.01), null);
  // a cell that grows with distance: the near half keeps its vertices, the far half clusters
  const coarse = farColourIndex(g, IDENTITY, g.index.count, (x) => (x < 0 ? 0.01 : 0.08));
  const fineHalf = triangles(g, Array.from(g.index.array)).filter((t) => t.every((v) => v.x < -0.02)).length;
  const keptHalf = triangles(g, coarse).filter((t) => t.every((v) => v.x < -0.02)).length;
  assert.equal(keptHalf, fineHalf, 'the near half is drawn as built');
});

test('the world transform places the cells', () => {
  const g = plate();
  const far = new THREE.Matrix4().makeTranslation(100, 0, 0);
  const coarse = farColourIndex(g, far, g.index.count, (x) => (x > 50 ? 0.08 : 0.01));
  assert.ok(coarse && coarse.length / 3 < 0.2 * (g.index.count / 3), 'moved out to where the cells are 8 cm, it clusters');
});

test('attachFarLod appends the coarse list after a shadow proxy and switches the draw range', () => {
  const g = plate();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  mesh.castShadow = true;
  const fineCount = g.index.count;
  const original = Array.from(g.index.array);
  const proxy = attachShadowProxy(mesh, 0.05);
  assert.ok(proxy, 'the proxy attaches');
  const proxyEnd = g.index.count;
  const proxyList = Array.from(g.index.array.slice(fineCount, proxyEnd));
  const lod = attachFarLod(mesh, cell8);
  assert.ok(lod, 'the far LOD attaches');
  assert.equal(lod.fine, fineCount / 3);
  assert.equal(g.index.count, proxyEnd + lod.coarse * 3);
  assert.deepEqual(Array.from(g.index.array.slice(0, fineCount)), original, 'the fine list is untouched');
  assert.deepEqual(Array.from(g.index.array.slice(fineCount, proxyEnd)), proxyList, "the proxy's list is untouched");
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, fineCount]);
  assert.deepEqual(mesh.userData.farLod, { fine: lod.fine, coarse: lod.coarse });

  lod.set(true);
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [proxyEnd, lod.coarse * 3]);
  assert.equal(rangedTriangles(g), lod.coarse);
  // the shadow pass swaps in the proxy and puts the far list back
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 500);
  camera.updateMatrixWorld(true);
  mesh.onBeforeShadow(null, mesh, camera);
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [fineCount, proxyEnd - fineCount]);
  mesh.onAfterShadow();
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [proxyEnd, lod.coarse * 3]);

  lod.set(false);
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, fineCount]);
  lod.set(false);
  assert.deepEqual([g.drawRange.start, g.drawRange.count], [0, fineCount], 'setting the same state twice changes nothing');
});

test('attachFarLod leaves shared, grouped, unindexed and barely-saving geometry alone', () => {
  const material = new THREE.MeshStandardMaterial();
  const shared = plate();
  const a = new THREE.Mesh(shared, material);
  const users = new Map([[shared, 2]]);
  assert.equal(attachFarLod(a, cell8, { users }), null, 'shared');
  assert.equal(shared.index.count, 50 * 50 * 6, 'the shared index is untouched');

  const grouped = plate();
  grouped.addGroup(0, grouped.index.count, 0);
  assert.equal(attachFarLod(new THREE.Mesh(grouped, material), cell8), null, 'grouped');

  assert.equal(attachFarLod(new THREE.Mesh(plate().toNonIndexed(), material), cell8), null, 'unindexed');

  // 10 cm quads under 2.8 cm cells: nothing merges, so nothing is saved
  const coarseGrid = new THREE.PlaneGeometry(1, 1, 10, 10);
  assert.equal(attachFarLod(new THREE.Mesh(coarseGrid, material), () => 0.03), null, 'saves too little');
  assert.equal(coarseGrid.index.count, 10 * 10 * 6);
});
