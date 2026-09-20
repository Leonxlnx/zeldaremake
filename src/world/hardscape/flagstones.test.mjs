/** CPU slab/contact gates: node --test src/world/hardscape/flagstones.test.mjs */
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
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === 'three') return THREE;
    const target = path.resolve(path.dirname(file), name);
    for (const candidate of [`${target}.ts`, path.join(target, 'index.ts')]) if (existsSync(candidate)) return loadTs(candidate);
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const geometry = loadTs(path.join(here, 'geometry.ts'));
const { placeFlagstones } = loadTs(path.join(here, 'flagstones.ts'));
const { createTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const { LAYOUT, houseSteppingStones } = loadTs(path.join(here, '../layout.ts'));
const { stairFrame } = loadTs(path.join(here, 'stairs.ts'));
const terrain = createTerrain();

function paving() {
  return placeFlagstones({
    terrain, frames: LAYOUT.stairs.map(stairFrame), seed: WORLD.seed,
    rng: createRng(WORLD.seed).fork('hardscape').fork('paving'), density: 1,
    bbox: { x0: -7.5, x1: 7.5, z0: -14.5, z1: 7.5 },
    steppingStones: houseSteppingStones(), region: 'legacy',
  }, new THREE.MeshStandardMaterial());
}

test('lawn fractures are bounded, closed edge chips with unchanged feet, cap centres and triangle budget', () => {
  const calls = [];
  const build = geometry.buildSlab;
  geometry.buildSlab = (mb, outline, options) => {
    calls.push({ outline, options });
    build(mb, outline, options);
  };
  let result;
  try { result = paving(); } finally { geometry.buildSlab = build; }
  assert.equal(calls.length, result.stones.length);
  let chipped = 0;
  for (let i = 0; i < calls.length; i++) {
    const { outline, options } = calls[i];
    const stone = result.stones[i];
    // Lawn slabs retain the 0.75 wall-normal blend. Discs share it but have no rim cut.
    if (options.sideNormalUp !== 0.75 || !options.rimDrop) continue;
    chipped++;
    const drops = outline.map((p) => options.rimDrop(p.x, p.z));
    assert.ok(Math.max(...drops) >= 0.012 && Math.max(...drops) <= 0.022, '12–22 mm fracture depth');
    let perimeter = 0, brokenEdge = 0;
    for (let j = 0; j < outline.length; j++) {
      const k = (j + 1) % outline.length;
      const length = Math.hypot(outline[j].x - outline[k].x, outline[j].z - outline[k].z);
      perimeter += length;
      if (drops[j] > 0 || drops[k] > 0) brokenEdge += length;
    }
    assert.ok(brokenEdge < perimeter / 2, `most of the edge remains intact: ${brokenEdge / perimeter} at ${stone.x},${stone.z}`);
    const before = new geometry.MeshBuilder(), after = new geometry.MeshBuilder();
    build(before, outline, { ...options, rimDrop: undefined });
    build(after, outline, options);
    assert.equal(after.vertexCount, before.vertexCount, 'chips reuse the existing triangles');
    for (const key of ['uv', 'col', 'moss', 'stain', 'wear', 'crack', 'mottle', 'rough']) assert.deepEqual(after[key], before[key], `${key} remains unchanged`);
    let lowered = 0;
    const edges = new Map();
    const key = (j) => after.pos.slice(j, j + 3).map((v) => Math.round(v * 1e7)).join(',');
    for (let j = 0; j < after.pos.length; j += 3) {
      assert.equal(after.pos[j], before.pos[j], 'local footprint x');
      assert.equal(after.pos[j + 2], before.pos[j + 2], 'local footprint z');
      const dy = after.pos[j + 1] - before.pos[j + 1];
      assert.ok(dy >= -0.022000001 && dy <= 1e-12, 'only bounded material removal');
      if (before.pos[j + 1] === 0) assert.equal(dy, 0, 'seated foot does not move');
      if (dy < -1e-6) lowered++;
      assert.ok(Math.abs(Math.hypot(...after.nrm.slice(j, j + 3)) - 1) < 1e-6, 'finite unit normal');
    }
    assert.ok(lowered > 0, 'a real geometry change');
    assert.equal(Math.max(...after.pos.filter((_, j) => j % 3 === 1)), Math.max(...before.pos.filter((_, j) => j % 3 === 1)), 'cap height remains unchanged');
    for (let j = 0; j < after.pos.length; j += 9) {
      const a = new THREE.Vector3().fromArray(after.pos, j), b = new THREE.Vector3().fromArray(after.pos, j + 3), c = new THREE.Vector3().fromArray(after.pos, j + 6);
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(normal.lengthSq() > 1e-20 && normal.y >= -1e-10, 'noncollapsed, upward cap / outward walls');
      for (const [a, b] of [[j, j + 3], [j + 3, j + 6], [j + 6, j]]) {
        const k = [key(a), key(b)].sort().join('|');
        const edge = edges.get(k) ?? { count: 0, floor: after.pos[a + 1] === 0 && after.pos[b + 1] === 0 };
        edge.count++;
        edges.set(k, edge);
      }
    }
    for (const edge of edges.values()) assert.equal(edge.count, edge.floor ? 1 : 2, 'closed shoulder/cap, only the buried bottom is open');
  }
  assert.ok(chipped >= 3, `only ${chipped} lawn slabs chipped`);
  const repeat = paving();
  assert.deepEqual(repeat.stones, result.stones, 'deterministic seats and footprints');
  assert.deepEqual(repeat.mesh.geometry.getAttribute('position').array, result.mesh.geometry.getAttribute('position').array, 'deterministic shape');
  for (const p of [result, repeat]) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
});
