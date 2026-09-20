/**
 * Run: node --test src/world/trees/lodPool.test.mjs (Node 20+, no browser needed).
 *
 * The near LOD geometry pool (lodPool.ts) and the determinism it relies on: a near-canopy part
 * rebuilt through `NearCanopyPart.build` is byte-identical to its first build (every attribute
 * and the index), the pool evicts least recently used first and never past a pinned item, the
 * byte cap holds, a pinned item that is not resident is built synchronously, and a chunked build
 * spread over several `work` calls ends with the same buffers as a synchronous one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Compile only this test's TS dependency graph in memory (the structures tests' loader).
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
const { LodPool, runBuild } = loadTs(path.join(here, 'lodPool.ts'));
const { createNearCanopyKit, runSteps } = loadTs(path.join(here, 'nearCanopy.ts'));
const { createRng } = loadTs(path.join(here, '..', 'util', 'prng.ts'));
const { growthPath, taper } = loadTs(path.join(here, 'writer.ts'));

/** a fake clock the budgets read */
const clock = () => {
  let t = 0;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
};

/** a pool item of `bytes` whose build yields `chunks` times; `log` records installs / uninstalls */
const fakeItem = (id, bytes, log, chunks = 1, now = null, chunkMs = 0) => ({
  id,
  bytes,
  build: function* () {
    for (let i = 0; i < chunks; i++) {
      if (now) now.advance(chunkMs);
      yield;
    }
    return { bytes, dispose: () => log.push(`dispose ${id}`) };
  },
  install: () => log.push(`install ${id}`),
  uninstall: () => log.push(`uninstall ${id}`),
});

/** a synthetic lobe record in the shape giant.ts records: a stem, two secondaries, six twigs */
const lobeRecord = (rng) => {
  const center = new THREE.Vector3(3, 9, 1);
  const stem = growthPath(new THREE.Vector3(0, 6, 0), new THREE.Vector3(2.4, 8.6, 0.8), new THREE.Vector3(0.5, 0.8, 0.2).normalize(), rng, 8, 0.8);
  const secondaries = [];
  const twigs = [];
  for (let j = 0; j < 2; j++) {
    const target = center.clone().add(new THREE.Vector3(Math.cos(j * 2.4) * 1.5, (rng() - 0.5) * 1.2, Math.sin(j * 2.4) * 1.5));
    const sec = growthPath(stem[stem.length - 1 - j], target, new THREE.Vector3(1, 0.3, 0).normalize(), rng, 6, 0.85);
    secondaries.push({ path: sec, radius: 0.06 });
    for (let k = 0; k < 3; k++) {
      const t2 = center.clone().add(new THREE.Vector3(Math.cos(k * 2.1 + j) * 2, (rng() - 0.5) * 1.5, Math.sin(k * 2.1 + j) * 2));
      twigs.push({ path: growthPath(sec[2 + k], t2, new THREE.Vector3(0.6, 0.1, 0.8).normalize(), rng, 4, 0.64), radius: 0.02 });
    }
  }
  return { group: 0, center, hR: 2.2, vR: 1.3, stem, stemRadii: taper(stem, 0.14, 0.02), secondaries, twigs, farLeaves: 400, farCards: 20, inM: 22, outM: 26 };
};

const kit = () =>
  createNearCanopyKit({
    id: 'test-giant',
    barkColor: new THREE.Color(0.3, 0.22, 0.15),
    leafColor: (g, base, center, hR) => new THREE.Color(0.2, 0.5 + 0.2 * g(), 0.1).multiplyScalar(1 - 0.2 * (base.distanceTo(center) / hR)),
    canopy: new THREE.Color(0.25, 0.5, 0.15),
  });

const buffersOf = (g) => {
  const out = { index: Buffer.from(g.index.array.buffer, g.index.array.byteOffset, g.index.array.byteLength) };
  for (const [name, attr] of Object.entries(g.attributes)) out[name] = Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength);
  return out;
};

test('a rebuilt near-canopy lobe part is byte-identical to its first build', () => {
  const rng = createRng('lodPool-test/tree-7');
  const rec = lobeRecord(rng.fork('record'));
  const part = kit().lobePart(rng, rec, 3);
  assert.ok(part.triangles > 500, `a real part (${part.triangles} triangles)`);
  const first = buffersOf(part.geometry);
  // the rebuild through the chunked generator, after unrelated draws on the tree stream (fork is state-independent)
  for (let i = 0; i < 1000; i++) rng();
  const again = runSteps(part.build());
  const second = buffersOf(again);
  assert.deepEqual(Object.keys(second).sort(), Object.keys(first).sort());
  for (const name of Object.keys(first)) {
    assert.equal(second[name].byteLength, first[name].byteLength, `${name} byte length`);
    assert.ok(first[name].equals(second[name]), `${name} bytes differ between the first build and the rebuild`);
  }
  // and once more, from a fresh kit and a fresh record built from the same seed (a page reload)
  const rng2 = createRng('lodPool-test/tree-7');
  const rec2 = lobeRecord(rng2.fork('record'));
  const part2 = kit().lobePart(rng2, rec2, 3);
  const third = buffersOf(part2.geometry);
  for (const name of Object.keys(first)) assert.ok(first[name].equals(third[name]), `${name} bytes differ across kits`);
  assert.equal(part2.leaves, part.leaves);
  assert.equal(part2.triangles, part.triangles);
});

test('a limb dressing part rebuilds byte-identically too', () => {
  const rng = createRng('lodPool-test/limb');
  const path = growthPath(new THREE.Vector3(0.8, 7, 0), new THREE.Vector3(9, 8.5, 2), new THREE.Vector3(1, 0.2, 0.2).normalize(), rng, 12, 0.5);
  const limb = { path, radii: taper(path, 0.45, 0.08), inM: 22, outM: 26 };
  const part = kit().limbPart(rng, limb, 1);
  const first = buffersOf(part.geometry);
  const second = buffersOf(runSteps(part.build()));
  for (const name of Object.keys(first)) assert.ok(first[name].equals(second[name]), `${name} bytes differ`);
});

const palette = { barkWhite: 0xe8e2d4, barkGrey: 0x9a938a, barkDark: 0x4a4038, leafCanopy: 0x4f7a2e, leafSun: 0x9ab84a };
const ground = (x, z) => 0.05 * Math.sin(x * 0.7) + 0.04 * Math.cos(z * 0.9);

test("a seated column's near base and near-canopy parts rebuild byte-identically", () => {
  const { columnParams, createColumnTree } = loadTs(path.join(here, 'column.ts'));
  const p = columnParams(createRng('lodPool-test/columns'), 2, 5);
  const asset = createColumnTree(p, palette, 'high', { groundAt: ground, nearBase: true, sunDir: new THREE.Vector3(0.3, 0.8, 0.5).normalize(), pathAt: () => 0, nearCanopy: {} });
  assert.ok(asset.nearBase && asset.nearBaseBuild, 'a near base was built');
  const first = buffersOf(asset.nearBase);
  const again = buffersOf(runSteps(asset.nearBaseBuild()));
  for (const name of Object.keys(first)) assert.ok(first[name].equals(again[name]), `near base ${name} bytes differ on rebuild`);
  assert.ok(asset.nearCanopy.length > 0, `near-canopy parts (${asset.nearCanopy.length})`);
  for (const part of asset.nearCanopy) {
    const a = buffersOf(part.geometry);
    const b = buffersOf(runSteps(part.build()));
    for (const name of Object.keys(a)) assert.ok(a[name].equals(b[name]), `${part.geometry.name} ${name} bytes differ on rebuild`);
  }
});

test("a giant's near base and near-canopy parts rebuild byte-identically", () => {
  const { createGiantTree } = loadTs(path.join(here, 'giant.ts'));
  const def = { id: 'test-giant', position: [0, 0, 0], trunkRadius: 1.4, height: 30 };
  const build = () =>
    createGiantTree(def, createRng('lodPool-test/giants'), {
      groundAt: ground,
      palette,
      leafDensity: 0.8,
      cardDensity: 0.8,
      sunDir: new THREE.Vector3(0.3, 0.8, 0.5).normalize(),
      pathAt: () => 0,
      heroDistance: Infinity,
      nearCanopy: {},
    });
  const asset = build();
  assert.ok(asset.nearBase && asset.nearBaseBuild, 'a near base was built');
  const first = buffersOf(asset.nearBase);
  const again = buffersOf(runSteps(asset.nearBaseBuild()));
  for (const name of Object.keys(first)) assert.ok(first[name].equals(again[name]), `near base ${name} bytes differ on rebuild`);
  assert.ok(asset.nearCanopy.length > 0, `near-canopy parts (${asset.nearCanopy.length})`);
  for (const part of asset.nearCanopy) {
    const a = buffersOf(part.geometry);
    const b = buffersOf(runSteps(part.build()));
    for (const name of Object.keys(a)) assert.ok(a[name].equals(b[name]), `${part.geometry.name} ${name} bytes differ on rebuild`);
  }
  // the far tree is untouched by how the near parts are built (the near base's rule): a second tree from the same seed matches
  const asset2 = build();
  const g1 = buffersOf(asset.geometry);
  const g2 = buffersOf(asset2.geometry);
  for (const name of Object.keys(g1)) assert.ok(g1[name].equals(g2[name]), `far tree ${name} differs between builds`);
});

test('the pool evicts least recently used first, never a pinned item, and holds the byte cap', () => {
  const log = [];
  const now = clock();
  const pool = new LodPool(100, now);
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => fakeItem(id, 40, log));
  // a, b resident from their first builds (the measurement pass); the rest not built yet
  pool.add(items[0], { bytes: 40, dispose: () => log.push('dispose a') });
  pool.add(items[1], { bytes: 40, dispose: () => log.push('dispose b') });
  for (const it of items.slice(2)) pool.add(it);
  assert.equal(pool.poolBytes, 80);

  // frame 1: a is pinned, b only wanted (farther); c wanted nearer than b → c is built (fits: 80 + 40 > 100, but b is evictable? no — b is wanted with a better... b's priority 20 > c's 10, so b can go)
  pool.begin();
  pool.pin(items[0]);
  pool.want(items[1], 20);
  pool.want(items[2], 10);
  pool.work(10);
  assert.deepEqual(pool.resident().sort(), ['a', 'c'], 'c displaced the farther b, a stayed pinned');
  assert.ok(pool.poolBytes <= 100, `cap held (${pool.poolBytes})`);
  assert.equal(log.filter((l) => l.startsWith('uninstall')).join(','), 'uninstall b');

  // frame 2: nothing pinned; b wanted again and a not wanted: a (least recently used) leaves for b
  pool.begin();
  pool.want(items[1], 5);
  pool.want(items[2], 6);
  pool.work(10);
  assert.deepEqual(pool.resident().sort(), ['b', 'c']);
  assert.ok(pool.poolBytes <= 100);
  assert.equal(log.filter((l) => l.startsWith('uninstall')).pop(), 'uninstall a');

  // frame 3: two pinned items over the cap are both kept (the cap is soft under pins); d pinned → synchronous build
  pool.begin();
  pool.pin(items[1]);
  pool.pin(items[2]);
  pool.pin(items[3]);
  pool.work(10);
  assert.deepEqual(pool.resident().sort(), ['b', 'c', 'd']);
  assert.equal(pool.poolBytes, 120, 'pinned items overflow the cap rather than being dropped');
  const r = pool.report();
  assert.equal(r.syncBuilds, 1);
  assert.equal(r.hits, 3, 'a and the two resident pins were hits');
  assert.equal(r.evicted, 2);
  assert.equal(r.built, 3, 'c (frame 1), b (frame 2), d (frame 3)');

  // frame 4: no pins, nothing wanted: LRU eviction brings the pool back under the cap (b, c, d share a lastUse — insertion order breaks the tie)
  pool.begin();
  pool.work(10);
  assert.ok(pool.poolBytes <= 100, `back under the cap (${pool.poolBytes})`);
  assert.equal(pool.resident().length, 2);
  // disposes follow every uninstall
  assert.equal(log.filter((l) => l.startsWith('dispose')).length, log.filter((l) => l.startsWith('uninstall')).length);
});

test('wanted parts past the cap leave farthest first: the pool holds the pinned parts and the nearest of the wanted', () => {
  const log = [];
  const pool = new LodPool(100, clock());
  const items = ['near', 'mid', 'far', 'farthest'].map((id) => fakeItem(id, 40, log));
  for (const it of items) pool.add(it, { bytes: 40, dispose: () => log.push(`dispose ${it.id}`) });
  assert.equal(pool.poolBytes, 160, 'the measurement builds start over the cap');
  // everything within the pre-fetch radius is wanted, nothing pinned: the two farthest go
  pool.begin();
  pool.want(items[0], 10);
  pool.want(items[1], 20);
  pool.want(items[2], 30);
  pool.want(items[3], 40);
  pool.work(10);
  assert.deepEqual(pool.resident().sort(), ['mid', 'near']);
  assert.equal(pool.poolBytes, 80);
  assert.equal(log.filter((l) => l.startsWith('uninstall')).join(','), 'uninstall farthest,uninstall far', 'farthest first');
  // the evicted ones stay pending (wanted, not resident) and are not rebuilt behind the nearer resident ones
  pool.begin();
  for (const [i, it] of items.entries()) pool.want(it, 10 * (i + 1));
  pool.work(10);
  assert.equal(pool.report().built, 0, 'no thrash');
  assert.equal(pool.report().pending, 2);
  // the camera jumps to the far ones (an explicit re-pose): pinned, they are built now — each
  // synchronous build makes its room from the wanted parts farthest first — and the 20 left
  // under the cap beside the two pins is not a part's worth, so the wanted ones wait
  pool.begin();
  pool.want(items[0], 10);
  pool.want(items[1], 20);
  pool.pin(items[2]);
  pool.pin(items[3]);
  pool.work(10);
  assert.deepEqual(pool.resident().sort(), ['far', 'farthest']);
  assert.equal(log.filter((l) => l.startsWith('uninstall')).slice(-2).join(','), 'uninstall mid,uninstall near', 'the farther wanted part made room first');
  const r = pool.report();
  assert.equal(r.poolBytes, 80);
  assert.equal(r.pinnedBytes, 80);
  assert.equal(r.wantedBytes, 160, 'wanted counts the pinned and the pending too');
  assert.equal(r.pending, 2);
  assert.equal(r.syncBuilds, 2);
});

test('a pending build that cannot fit behind nearer resident items is not started (no thrash)', () => {
  const log = [];
  const pool = new LodPool(80, clock());
  const near = fakeItem('near', 40, log);
  const mid = fakeItem('mid', 40, log);
  const far = fakeItem('far', 40, log);
  pool.add(near, { bytes: 40, dispose() {} });
  pool.add(mid, { bytes: 40, dispose() {} });
  pool.add(far);
  pool.begin();
  pool.want(near, 1);
  pool.want(mid, 2);
  pool.want(far, 3);
  pool.work(10);
  assert.deepEqual(pool.resident().sort(), ['mid', 'near'], 'the farthest wanted part waits instead of displacing a nearer one');
  assert.equal(pool.report().built, 0);
  assert.equal(pool.report().pending, 1);
});

test('a chunked build spreads over frames within the budget and ends like a synchronous one', () => {
  const log = [];
  const now = clock();
  const pool = new LodPool(1000, now);
  // 6 chunks of 2 ms each (then the finishing step): a 3 ms budget takes ONE chunk per frame —
  // round 48: a second chunk is expected to cost what the first did and would end past the
  // budget, so it waits for the next frame (the shipped loop ran it and paid 4 ms on a 3 ms budget)
  const item = fakeItem('x', 10, log, 6, now, 2);
  pool.add(item);
  let frames = 0;
  for (; frames < 10 && !pool.isResident(item); frames++) {
    pool.begin();
    pool.want(item, 1);
    pool.work(3);
  }
  assert.equal(frames, 7, `six frames of one chunk and the finishing step (${frames})`);
  assert.deepEqual(log, ['install x']);
  const r = pool.report();
  assert.equal(r.built, 1);
  assert.equal(r.syncBuilds, 0);
  assert.equal(r.buildMsMax, 12, 'the build time is the sum of its chunks');
  assert.equal(r.stepMsMax, 2);
  assert.equal(r.steps, 7);
  assert.equal(r.stepMsP50, 2);
  assert.equal(r.longSteps, 0);
  assert.ok(r.workMsMax <= 3, `no work call ran past the budget (${r.workMsMax})`);
  assert.equal(r.workOverBudget, 0);

  // a build in progress that is pinned mid-way is finished, not restarted
  const y = fakeItem('y', 10, log, 6, now, 2);
  pool.add(y);
  pool.begin();
  pool.want(y, 1);
  pool.work(3);
  assert.ok(!pool.isResident(y));
  pool.begin();
  pool.pin(y);
  assert.ok(pool.isResident(y));
  assert.equal(pool.report().syncBuilds, 1);
  assert.equal(pool.report().buildMsMax, 12, 'the pinned finish continued the chunks already run');

  // an in-progress build that is no longer wanted is dropped
  const z = fakeItem('z', 10, log, 6, now, 2);
  pool.add(z);
  pool.begin();
  pool.want(z, 1);
  pool.work(3);
  assert.equal(pool.report().building, 1);
  pool.begin();
  pool.work(3);
  assert.equal(pool.report().building, 0);
  assert.ok(!pool.isResident(z));
});

test('the budget is checked before a chunk with its expected cost; the first chunk of a frame always runs', () => {
  const log = [];
  const now = clock();
  const pool = new LodPool(1000, now);
  // a 4 ms budget fits two 2 ms chunks exactly: three frames of two and the finishing step
  const w = fakeItem('w', 10, log, 6, now, 2);
  pool.add(w);
  let framesW = 0;
  for (; framesW < 10 && !pool.isResident(w); framesW++) {
    pool.begin();
    pool.want(w, 1);
    pool.work(4);
  }
  assert.equal(framesW, 4, `two chunks per frame when they fit (${framesW})`);
  assert.equal(pool.report().workMsMax, 4);
  assert.equal(pool.report().workOverBudget, 0);

  // chunks longer than the budget still advance one a frame (a build that never advanced would
  // end as a synchronous build at its pin); every such call counts as over budget
  const big = fakeItem('big', 10, log, 3, now, 5);
  pool.add(big);
  let framesBig = 0;
  for (; framesBig < 10 && !pool.isResident(big); framesBig++) {
    pool.begin();
    pool.want(big, 1);
    pool.work(3);
  }
  assert.equal(framesBig, 4, `one 5 ms chunk a frame on a 3 ms budget, then the finish (${framesBig})`);
  assert.equal(pool.report().workOverBudget, 3, 'the three over-long chunks are counted');
  assert.equal(pool.report().stepMsMax, 5);
  assert.equal(pool.report().longSteps, 0, 'five ms is under LONG_STEP_MS');

  // a build's first chunk is expected to cost the pool's median chunk: after the 2 ms and 5 ms
  // chunks above (median 2), a new build's first chunk runs and its second waits when it would
  // end past a 3 ms budget
  const v = fakeItem('v', 10, log, 2, now, 2);
  pool.add(v);
  pool.begin();
  pool.want(v, 1);
  pool.work(3);
  assert.ok(!pool.isResident(v));
  assert.equal(pool.report().building, 1);
});

test('runBuild finishes a generator and returns its value', () => {
  function* g() {
    yield;
    yield;
    return 42;
  }
  assert.equal(runBuild(g()), 42);
});
