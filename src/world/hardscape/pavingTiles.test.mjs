/**
 * The plaza paving's tiles (pavingTiles.ts) — the pieces index.ts puts into the `flagstones-batch`
 * BatchedMesh so each tile culls and LOD-switches on its own:
 *   1. every stone lands in exactly one tile, and the tiles' vertices sum to the paving's;
 *   2. a tile's bytes are the merged mesh's bytes — the stones' ranges copied, attribute for attribute;
 *   3. a stone's `range` / `farRange` really is its vertices (they lie within its radius of its centre);
 *   4. the far tiles cover the near tiles' ground (same box in xz, within a shoulder's width);
 *   5. the carrier geometry is the positions alone, near + dais, in order.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, `${target}.ts`, path.join(target, 'index.ts')]) if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
      }
      throw new Error(`Unexpected dependency: ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { createTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { placeFlagstones } = loadTs(path.join(here, 'flagstones.ts'));
const { stairFrame } = loadTs(path.join(here, 'stairs.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { LAYOUT, houseSteppingStones } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const { tilePaving, sliceRanges, positionsOnly, planarDistanceToBox, tileKey } = loadTs(path.join(here, 'pavingTiles.ts'));

const T = createTerrain('live');
const frames = LAYOUT.stairs.map((s) => stairFrame(s));

/** the legacy paving pass with its far LOD, as index.ts lays it */
function layPaving() {
  const rng = createRng(WORLD.seed).fork('hardscape');
  const pts = [...LAYOUT.pathSpine, ...LAYOUT.pathToStairs, ...LAYOUT.pathToHouse];
  const bbox = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of pts) {
    bbox.x0 = Math.min(bbox.x0, p[0] - 3.2);
    bbox.x1 = Math.max(bbox.x1, p[0] + 3.2);
    bbox.z0 = Math.min(bbox.z0, p[2] - 3.2);
    bbox.z1 = Math.max(bbox.z1, p[2] + 3.2);
  }
  bbox.x0 = Math.min(bbox.x0, -7.5);
  bbox.x1 = Math.max(bbox.x1, 7.5);
  bbox.z0 = Math.min(bbox.z0, -7.5);
  bbox.z1 = Math.max(bbox.z1, 7.5);
  const pc = { terrain: T, frames, rng: rng.fork('paving'), seed: WORLD.seed, bbox, density: 1, steppingStones: houseSteppingStones(), region: 'legacy' };
  return placeFlagstones(pc, new THREE.MeshStandardMaterial(), { far: true });
}

const TILE_M = 8;
const paving = layPaving();
const near = paving.mesh.geometry;
const far = paving.farMesh.geometry;
const tiles = tilePaving(paving.stones, near, far, TILE_M);

test('every stone in exactly one tile; the tiles hold every vertex of the paving and of its far LOD', () => {
  const seen = new Set();
  let nearV = 0;
  let farV = 0;
  for (const t of tiles) {
    assert.ok(t.stones.length > 0, `tile ${t.key} has stones`);
    for (const i of t.stones) {
      assert.ok(!seen.has(i), `stone ${i} in two tiles`);
      seen.add(i);
      assert.equal(tileKey(paving.stones[i].x, paving.stones[i].z, TILE_M), t.key);
    }
    nearV += t.nearVertices;
    farV += t.farVertices;
    assert.equal(t.near.getAttribute('position').count, t.nearVertices);
    assert.equal(t.far.getAttribute('position').count, t.farVertices);
  }
  assert.equal(seen.size, paving.stones.length);
  assert.equal(nearV, near.getAttribute('position').count);
  assert.equal(farV, far.getAttribute('position').count);
  assert.ok(tiles.length >= 10 && tiles.length <= 40, `${tiles.length} tiles of ${TILE_M} m`);
});

test('a tile is the merged mesh\'s bytes: every attribute of every stone range, copied in order', () => {
  const names = Object.keys(near.attributes);
  assert.ok(names.includes('position') && names.includes('color') && names.includes('aMottle'));
  for (const t of tiles.slice(0, 6)) {
    for (const name of names) {
      const src = near.getAttribute(name);
      const dst = t.near.getAttribute(name);
      assert.equal(dst.itemSize, src.itemSize, `${name} itemSize`);
      let o = 0;
      for (const i of t.stones) {
        const [s, c] = paving.stones[i].range;
        const a = src.array.subarray(s * src.itemSize, (s + c) * src.itemSize);
        const b = dst.array.subarray(o, o + c * src.itemSize);
        assert.ok(Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength)), `tile ${t.key} stone ${i} ${name} bytes`);
        o += c * src.itemSize;
      }
      assert.equal(o, dst.array.length);
    }
  }
});

test('a stone\'s range is its own vertices: all within its radius of its centre, in both geometries', () => {
  const check = (g, rangeOf, pad) => {
    const pos = g.getAttribute('position');
    for (const s of paving.stones) {
      const [from, count] = rangeOf(s);
      assert.ok(count > 0 && count % 3 === 0, `range count ${count}`);
      for (let v = from; v < from + count; v++) {
        const d = Math.hypot(pos.getX(v) - s.x, pos.getZ(v) - s.z);
        assert.ok(d <= s.radius * 1.15 + pad, `stone at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r ${s.radius.toFixed(2)}: vertex ${d.toFixed(3)} m out`);
      }
    }
  };
  check(near, (s) => s.range, 0.05);
  check(far, (s) => s.farRange, 0.05);
  // the far fan is one triangle per outline edge: a fraction of the full slab's triangles
  const fullTris = paving.stones.reduce((n, s) => n + s.range[1] / 3, 0);
  const farTris = paving.stones.reduce((n, s) => n + s.farRange[1] / 3, 0);
  assert.ok(farTris < fullTris * 0.15, `far ${farTris} of ${fullTris}`);
});

test('the far tiles cover the near tiles\' ground', () => {
  for (const t of tiles) {
    const nb = t.near.boundingBox;
    const fb = t.far.boundingBox;
    for (const k of ['x', 'z']) {
      assert.ok(Math.abs(fb.min[k] - nb.min[k]) < 0.05, `tile ${t.key} min ${k}`);
      assert.ok(Math.abs(fb.max[k] - nb.max[k]) < 0.05, `tile ${t.key} max ${k}`);
    }
    // the fan's rim sits at the top ring's height but on the wall's outline, so on a tilted stone's
    // uphill side it stands up to tan(tilt) × the shoulder's width (≈ 1.5 cm at 15°) above the
    // near top — 0.5 px at 30 m; the walk grid reads the near positions (the carrier), not these
    assert.ok(fb.min.y >= nb.min.y - 1e-6 && fb.max.y <= nb.max.y + 0.02, `tile ${t.key} far within the near's heights (+2 cm): ${fb.max.y.toFixed(4)} vs ${nb.max.y.toFixed(4)}`);
    assert.ok(t.box.equals(nb));
  }
});

test('sliceRanges refuses indexed geometry; positionsOnly is the positions, near then dais, nothing else', () => {
  const indexed = new THREE.BoxGeometry();
  assert.throws(() => sliceRanges(indexed, [[0, 3]]));
  const dais = new THREE.BufferGeometry();
  dais.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  const carrier = positionsOnly([near, dais]);
  assert.deepEqual(Object.keys(carrier.attributes), ['position']);
  assert.equal(carrier.getAttribute('position').count, near.getAttribute('position').count + 3);
  const p = carrier.getAttribute('position');
  assert.equal(p.getX(p.count - 1), 0);
  assert.equal(p.getZ(p.count - 1), 1);
  assert.equal(p.getX(0), near.getAttribute('position').getX(0));
});

test('planarDistanceToBox: 0 inside, the gap outside, height ignored', () => {
  const box = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 5, 1));
  assert.equal(planarDistanceToBox(box, 0, 0), 0);
  assert.equal(planarDistanceToBox(box, 4, 0), 3);
  assert.equal(planarDistanceToBox(box, 0, -6), 5);
  assert.ok(Math.abs(planarDistanceToBox(box, 4, 5) - 5) < 1e-9);
});
