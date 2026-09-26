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

test('fixed-camera proximity cannot permanently reject a canopy part', () => {
  const { swapRadiiFor, NEAR_CANOPY_IN_M, NEAR_CANOPY_OUT_M } = loadTs(path.join(here, 'nearCanopy.ts'));
  const tally = { kept: 0, limited: 0 };
  assert.deepEqual(swapRadiiFor(() => 4, new THREE.Vector3(0, 40, 0), 3, tally), [NEAR_CANOPY_IN_M, NEAR_CANOPY_OUT_M]);
  assert.deepEqual(tally, { kept: 0, limited: 0 });
});

test('a deferred upper lobe builds only on demand and stays within its buffer/bounds estimates', () => {
  const rng = createRng('lodPool-test/upper-deferred');
  const rec = lobeRecord(rng.fork('record'));
  for (const p of new Set([rec.center, ...rec.stem, ...rec.secondaries.flatMap(s => s.path), ...rec.twigs.flatMap(t => t.path)])) p.y += 31;
  const part = kit().lobePart(rng, rec, 0, true);
  assert.equal(part.geometry.getAttribute('position').count, 0);
  assert.equal(part.triangles, 0);
  assert.equal(part.deferred, true);
  const originalBounds = part.geometry.boundingBox.clone();
  const steps = part.build();
  assert.equal(steps.next().done, false);
  assert.equal(part.deferred, true);
  const built = runSteps(steps);
  const buffers = buffersOf(built);
  const bytes = Object.values(buffers).reduce((n, b) => n + b.byteLength, 0);
  assert.ok(bytes <= part.estimatedBytes, `${bytes} > ${part.estimatedBytes}`);
  assert.ok(originalBounds.containsBox(built.boundingBox), 'the queued bounds contain the actual built geometry');
  assert.equal(part.deferred, false);
  assert.ok(part.leaves > 0 && part.triangles > 500);
  assert.equal(part.geometry.getAttribute('position').count, 0, 'the descriptor does not retain another copy of pooled geometry');
  const again = buffersOf(runSteps(part.build()));
  for (const name of Object.keys(buffers)) assert.ok(buffers[name].equals(again[name]), name);
});

test('giants register detail above 25 m without changing far geometry or the tree random stream', () => {
  const { createGiantTree } = loadTs(path.join(here, 'giant.ts'));
  const def = { id: 'upper-giant', position: [0, 0, 0], trunkRadius: 1.4, height: 42 };
  const options = { groundAt: ground, palette, leafDensity: 0.4, cardDensity: 0.4, sunDir: new THREE.Vector3(0.3, 0.8, 0.5).normalize(), pathAt: () => 0, heroDistance: Infinity,
    boughs: [{ fromHeight: 31, to: new THREE.Vector3(8, 36, 3), radius: 0.5 }] };
  const r1 = createRng('lodPool-test/upper-giant'), r2 = createRng('lodPool-test/upper-giant');
  const far = createGiantTree(def, r1, options);
  const near = createGiantTree(def, r2, { ...options, nearCanopy: { heroDistance: () => 4, defer: true } });
  const upper = near.nearCanopy.filter(p => p.kind === 'lobe' && p.center.y > 25);
  assert.ok(upper.length > 0, 'high ordinary lobes remain in the catalogue');
  assert.ok(upper.every(p => p.deferred && p.geometry.getAttribute('position').count === 0));
  assert.ok(near.nearCanopy.some(p => p.kind === 'limb' && p.center.y > 25), 'upper limbs remain eligible too');
  const untagged = w => w >= 1000 ? 1.5 + (w % 1) : w >= 2.75 ? 1 : w;
  for (const key of ['geometry', 'cards', 'authoredLeaves', 'authoredCards']) {
    const a = buffersOf(far[key]), b = buffersOf(near[key]);
    for (const name of Object.keys(a)) {
      if (name !== 'aRoot') assert.ok(a[name].equals(b[name]), `${key}/${name} changed`);
      else {
        const aa = far[key].getAttribute('aRoot').array, bb = near[key].getAttribute('aRoot').array;
        assert.equal(aa.length, bb.length);
        for (let i = 0; i < aa.length; i++) {
          if (i % 4 === 3) assert.ok(Math.abs(untagged(aa[i]) - untagged(bb[i])) < 0.0001, `${key} leaf class/shade changed`);
          else assert.equal(aa[i], bb[i], `${key} root position changed`);
        }
      }
    }
  }
  assert.deepEqual(Array.from({ length: 32 }, () => r1()), Array.from({ length: 32 }, () => r2()));
});

// Exercise the production closure itself, with real LodPool and small deterministic items.
// Loading all of index.ts would construct browser materials unrelated to this state transition.
const canopyUpdateFor = (parts, pool, slots = 64, keep = 0.25) => {
  const file = path.join(here, 'index.ts'), ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'nearCanopyUpdate') initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(initializer);
  const expression = ts.transpileModule(`(${initializer.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const mats = { nearCanopy: { value: Array.from({ length: slots }, () => new THREE.Vector4()) } };
  // `shownLastFrame` and NEAR_CANOPY_KEEP are the slot rank's hysteresis (index.ts byRank): the closure
  // reads both, so the sandbox supplies them the way it supplies the caps. `farFoliage` is the giants'
  // far-laminae batches the closure hands the slotted set to (round 54, FarFoliageBatch): none here.
  const shownLastFrame = new Set();
  const update = new Function(
    'nearCanopies',
    'nearCanopyPool',
    'mats',
    'NEAR_CANOPY_PREFETCH_M',
    'NEAR_CANOPY_SLOTS',
    'NEAR_CANOPY_LIMBS_MAX',
    'NEAR_CANOPY_KEEP',
    'shownLastFrame',
    'farFoliage',
    `return ${expression}`,
  )(parts, pool, mats, 42, slots, 12, keep, shownLastFrame, []);
  return { mats, update, shownLastFrame };
};
const canopyFixture = (item, group = 0) => ({ item, group, center: new THREE.Vector3(0, 40, 0), radius: 4, root: new THREE.Vector3(), kind: 'lobe', inM: 26, outM: 30, active: false, dist: Infinity, mesh: { visible: false } });

test('walking canopy poses retain far foliage until resident and use crown-envelope hysteresis', () => {
  const now = clock(), pool = new LodPool(1000, now), item = fakeItem('upper', 200, [], 3, now, 0.4);
  pool.add(item);
  const part = canopyFixture(item), { update, mats } = canopyUpdateFor([part], pool);
  const cam = new THREE.Vector3(0, 68.5, 0); // 28.5 m to centre; 24.5 m to crown envelope.
  update(cam, false);
  assert.equal(part.active, true);
  assert.equal(part.mesh.visible, false);
  assert.equal(mats.nearCanopy.value[0].w, 0, 'far foliage stays unfolded');
  assert.equal(pool.report().syncBuilds, 0);
  pool.work(0.5);
  update(cam, false);
  assert.equal(part.mesh.visible, false);
  assert.equal(pool.report().syncBuilds, 0, 'ordinary updates leave missing detail to the frame budget');
  for (let i = 0; i < 10 && !pool.isResident(item); i++) { update(cam, false); pool.work(0.5); }
  assert.equal(pool.isResident(item), true);
  update(cam, false);
  assert.equal(part.mesh.visible, true);
  assert.equal(mats.nearCanopy.value[0].w, 3);
  update(new THREE.Vector3(0, 72, 0), false); // envelope 28: retains the active part.
  assert.equal(part.mesh.visible, true);
  update(new THREE.Vector3(0, 75, 0), false); // envelope 31: returns to far foliage.
  assert.equal(part.mesh.visible, false);
  assert.equal(mats.nearCanopy.value[0].w, 0);
  assert.ok(pool.poolBytes <= pool.capBytes);
});

test('explicit canopy re-poses finish the same selected geometry from cold and warm pools', () => {
  const now = clock(), pool = new LodPool(1000, now), parts = [];
  for (let i = 0; i < 3; i++) {
    const item = fakeItem(`upper-${i}`, 200, [], 3, now, 0.4);
    item.bytes = 280; // conservative first-build estimate becomes 200 after completion.
    pool.add(item);
    parts.push(canopyFixture(item, i));
  }
  const { update, mats } = canopyUpdateFor(parts, pool);
  const cam = new THREE.Vector3(0, 68.5, 0);
  const snapshot = () => ({ shown: parts.map(p => p.mesh.visible), slots: mats.nearCanopy.value.map(v => v.toArray()) });
  update(cam, true);
  const cold = snapshot();
  assert.equal(pool.report().syncBuilds, 3);
  assert.ok(parts.every(p => p.mesh.visible));
  for (let i = 0; i < 6; i++) { update(cam, false); pool.work(0.5); }
  update(new THREE.Vector3(0, 100, 0), true);
  update(cam, true);
  assert.deepEqual(snapshot(), cold, 'same explicit target after another pose and warm frames');
  assert.equal(pool.report().syncBuilds, 3);
  pool.dispose();
  update(cam, true);
  assert.deepEqual(snapshot(), cold, 'same explicit target after complete pool eviction');
  assert.equal(pool.report().syncBuilds, 6);
  assert.ok(pool.poolBytes <= pool.capBytes);
});

test('canopy selection retains the 64-slot limit and never pins beyond the byte cap', () => {
  for (const cap of [10000, 300]) {
    const pool = new LodPool(cap), parts = [];
    for (let i = 0; i < 80; i++) {
      const item = fakeItem(`part-${i}`, 100, []);
      pool.add(item, { bytes: 100, dispose() {} });
      parts.push(canopyFixture(item, i));
    }
    const { update, mats } = canopyUpdateFor(parts, pool);
    update(new THREE.Vector3(0, 40, 0), true);
    assert.equal(parts.filter(p => p.mesh.visible).length, Math.min(64, cap / 100));
    assert.equal(mats.nearCanopy.value.filter(v => v.w > 0).length, Math.min(64, cap / 100));
    assert.ok(pool.report().pinnedBytes <= cap);
    assert.equal(pool.report().syncBuilds, 0);
    pool.work(0);
    assert.ok(pool.poolBytes <= cap);
  }
});

// 2026-09-24 (lane 2): the slot cap is what decides which crowns draw their near laminae — measured
// on a walk, 135–218 lobes are active against the 64 slots at every step — and it had no hysteresis,
// so a metre of walking traded parts by rank. An incumbent now ranks as if NEAR_CANOPY_KEEP nearer.
test('a shown canopy part keeps its slot until a challenger is NEAR_CANOPY_KEEP nearer', () => {
  // one slot, two parts: `near` starts nearer, then `far` closes in
  const pool = new LodPool(10000);
  const mk = (id, y) => {
    const item = fakeItem(id, 100, []);
    pool.add(item, { bytes: 100, dispose() {} });
    return { ...canopyFixture(item, id === 'a' ? 0 : 1), center: new THREE.Vector3(0, y, 0), radius: 0, inM: 100, outM: 120 };
  };
  const a = mk('a', 30);
  const b = mk('b', 50);
  const { update } = canopyUpdateFor([a, b], pool, 1, 0.25);
  pool.work(0);
  // camera at y 0: a is 30 m, b is 50 m — a takes the only slot
  update(new THREE.Vector3(0, 0, 0), false);
  assert.equal(a.mesh.visible, true, 'the nearer part takes the slot first');
  assert.equal(b.mesh.visible, false);
  // camera at y 41: b is 9 m, a is 11 m. b is nearer but only by 18 %, under the 25 % the incumbent holds
  update(new THREE.Vector3(0, 41, 0), false);
  assert.equal(a.mesh.visible, true, 'a challenger 18 % nearer does not take the slot');
  assert.equal(b.mesh.visible, false);
  // camera at y 46: b is 4 m, a is 16 m — four times nearer, so the slot changes hands
  update(new THREE.Vector3(0, 46, 0), false);
  assert.equal(b.mesh.visible, true, 'a clearly nearer challenger does take it');
  assert.equal(a.mesh.visible, false);
});

test('an explicit re-pose ranks canopy slots unbiased, so a capture of a pose is the same either way', () => {
  const pool = new LodPool(10000);
  const mk = (id, y) => {
    const item = fakeItem(id, 100, []);
    pool.add(item, { bytes: 100, dispose() {} });
    return { ...canopyFixture(item, id === 'a' ? 0 : 1), center: new THREE.Vector3(0, y, 0), radius: 0, inM: 100, outM: 120 };
  };
  const a = mk('a', 30);
  const b = mk('b', 50);
  const { update } = canopyUpdateFor([a, b], pool, 1, 0.25);
  pool.work(0);
  update(new THREE.Vector3(0, 0, 0), false); // a incumbent at 30 m vs b at 50 m
  assert.equal(a.mesh.visible, true);
  // the pose where b is nearer by 18 %: a walk would keep `a` (previous test), a RE-POSE takes `b`
  update(new THREE.Vector3(0, 41, 0), true);
  assert.equal(b.mesh.visible, true, 'reset ignores the incumbent bias');
  assert.equal(a.mesh.visible, false);
});

// Round 54 (FarFoliageBatch): the partition of a giant's geometry into its kept triangles and one
// sub-geometry per tagged lobe group, exercised on the production closures themselves.
const foliageSplitters = () => {
  const file = path.join(here, 'index.ts'), ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const wanted = ['subsetGeometry', 'foldGroupOf', 'extractTaggedFoliage'];
  const found = {};
  const visit = node => {
    if (ts.isVariableDeclaration(node) && wanted.includes(node.name.getText(ast))) found[node.name.getText(ast)] = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const name of wanted) assert.ok(found[name], `${name} declared in index.ts`);
  const source = wanted.map(name => `const ${name} = ${found[name]};`).join('\n') + '\nreturn { subsetGeometry, foldGroupOf, extractTaggedFoliage };';
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('BufferGeometry', 'BufferAttribute', js)(THREE.BufferGeometry, THREE.BufferAttribute);
};
/** an indexed quad strip: `quads` laminae of two triangles each, aRoot.w per quad, colours = the vertex index */
const taggedQuads = (ws) => {
  const g = new THREE.BufferGeometry();
  const n = ws.length * 4;
  const pos = new Float32Array(n * 3), root = new Float32Array(n * 4), col = new Float32Array(n * 3), idx = [];
  ws.forEach((w, q) => {
    for (let c = 0; c < 4; c++) {
      const v = q * 4 + c;
      pos.set([q * 2 + (c & 1), 10 + (c >> 1), 0.5 * q], v * 3);
      root.set([1, 2, 3, w], v * 4);
      col.set([v / n, 0.5, 1 - v / n], v * 3);
    }
    idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3);
  });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRoot', new THREE.BufferAttribute(root, 4));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
};
const triangleKeys = (g) => {
  const out = [];
  const p = g.getAttribute('position');
  for (let t = 0; t < g.index.count; t += 3) out.push([0, 1, 2].map(k => { const v = g.index.getX(t + k); return `${p.getX(v)},${p.getY(v)},${p.getZ(v)}`; }).join('|'));
  return out.sort();
};

test('the fold group decodes as the shader does: 3 + group, a flat lobe 1000 + group + share, nothing else', () => {
  const { foldGroupOf } = foliageSplitters();
  assert.equal(foldGroupOf(0), -1);          // wood
  assert.equal(foldGroupOf(1), -1);          // an ordinary leaf
  assert.equal(foldGroupOf(1.5), -1);        // a flat leaf
  assert.equal(foldGroupOf(2.5), -1);        // the last untagged leaf code
  assert.equal(foldGroupOf(3), 0);
  assert.equal(foldGroupOf(3 + 17), 17);
  assert.equal(foldGroupOf(1000 + 4 + 0.5), 4);
  assert.equal(foldGroupOf(1000 + 4 + 0.25), 4);
  assert.equal(foldGroupOf(1000 + 12), 12);
});

test('a giant\'s tagged far laminae leave for one sub-geometry per lobe group; wood, ordinary leaves and mixed triangles stay', () => {
  const { extractTaggedFoliage } = foliageSplitters();
  // quads: wood, ordinary leaf, group 2 (×2), group 0 (flat), group 2 again, ordinary leaf
  const g = taggedQuads([0, 1, 5, 5, 1000.5, 5, 0.75]);
  // one triangle of the last group-2 quad gets a wood vertex: a mixed triangle, which must stay
  g.getAttribute('aRoot').setW(5 * 4 + 3, 0);
  const all = triangleKeys(g);
  const asset = { geometry: g };
  const { kept, groups } = extractTaggedFoliage(asset, 'test-giant');
  assert.deepEqual(groups.map(p => p.group), [0, 2]);
  const keptKeys = triangleKeys(kept), groupKeys = groups.flatMap(p => triangleKeys(p.geometry));
  assert.deepEqual([...keptKeys, ...groupKeys].sort(), all, 'the kept and the extracted triangles partition the original');
  assert.equal(groups[0].geometry.index.count, 6, 'the flat lobe: one quad');
  assert.equal(groups[1].geometry.index.count, 3 * 5, 'group 2: two whole quads and the unmixed triangle of the third');
  assert.equal(kept.index.count, 3 * (2 + 2 + 2 + 1), 'wood, two ordinary leaves, the mixed triangle');
  // attributes travel with their vertices
  for (const sub of [kept, ...groups.map(p => p.geometry)]) {
    const p = sub.getAttribute('position'), c = sub.getAttribute('color'), r = sub.getAttribute('aRoot');
    assert.equal(c.itemSize, 3);
    assert.equal(r.itemSize, 4);
    for (let v = 0; v < p.count; v++) {
      assert.equal(r.getX(v), 1); assert.equal(r.getY(v), 2); assert.equal(r.getZ(v), 3);
      assert.ok(Math.abs(c.getY(v) - 0.5) < 1e-6);
    }
    assert.ok(sub.boundingSphere && sub.boundingSphere.radius > 0);
  }
  assert.equal(groups[0].geometry.name, 'giant-far-foliage-test-giant-0');
});

test('a giant without tagged laminae keeps its geometry object', () => {
  const { extractTaggedFoliage } = foliageSplitters();
  const g = taggedQuads([0, 1, 1.5, 0]);
  const out = extractTaggedFoliage({ geometry: g }, 'plain');
  assert.equal(out.kept, g);
  assert.deepEqual(out.groups, []);
});

// releaseAfterUpload (round 51): the static attributes' arrays go on upload; a per-instance attribute's stays
test('releaseAfterUpload drops static arrays on upload and leaves per-instance attributes alone', () => {
  const file = path.join(here, 'index.ts'), ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = {};
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ['dropArray', 'releaseAfterUpload'].includes(node.name.getText(ast))) found[node.name.getText(ast)] = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(found.dropArray && found.releaseAfterUpload);
  const js = ts.transpileModule(`const dropArray = ${found.dropArray};\nconst releaseAfterUpload = ${found.releaseAfterUpload};\nreturn releaseAfterUpload;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const releaseAfterUpload = new Function(js)();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('aLodDrop', new THREE.InstancedBufferAttribute(new Float32Array(4), 1));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  releaseAfterUpload(g);
  // what three does after each buffer's first upload
  for (const a of [...Object.values(g.attributes), g.index]) a.onUploadCallback.call(a);
  assert.equal(g.getAttribute('position').array, null, 'a static attribute frees its array');
  assert.equal(g.index.array, null, 'the index frees its array');
  assert.ok(g.getAttribute('aLodDrop').array instanceof Float32Array, 'a per-instance attribute keeps its array');
  assert.equal(g.getAttribute('aLodDrop').array.length, 4);
});
