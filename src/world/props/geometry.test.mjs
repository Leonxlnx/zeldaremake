/** Run: node src/world/props/geometry.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Compile only this test's TS dependency graph in memory. No global loader hooks or
// Node24 APIs, so Fable's Node22 runner executes the same geometry assertions.
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
    if (name === 'three/addons/utils/BufferGeometryUtils.js') return geometryUtils;
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
        if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
      }
    }
    throw new Error(`Unexpected test dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { create, placementAllowed, EMBED } = loadTs(path.join(here, 'index.ts'));
const { chamferedBox, potGeometry, crateGeometry, barrelGeometry } = loadTs(path.join(here, 'geometry.ts'));
const { buildClayMaps, buildRopeMaps } = loadTs(path.join(here, 'materials.ts'));
const { PROP_LAYOUT } = loadTs(path.join(here, 'layout.ts'));
const { LAYOUT } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const { createTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { Vector3 } = THREE;

// ---- texture library stub: no DOM under Node, so disk maps are plain Textures
const textureLoads = [];
const textures = {
  tier: 'high',
  load: async (set, kind) => {
    textureLoads.push(`${set}/${kind}`);
    return new THREE.Texture();
  },
  fallback: () => new THREE.Texture(),
  loaded: () => ['weathered_planks'],
  missing: () => [],
  report: () => ({}),
};
const audits = [];
const ctx = { terrain: createTerrain(), layout: LAYOUT, config: WORLD, quality: { shadows: true }, textures, audit: (_, fn) => audits.push(fn) };

// ---- builders
{
  const box = chamferedBox(0.3, 0.1, 0.05, 0.008);
  const p = box.attributes.position;
  assert.equal(p.count, 44 * 3, 'chamfered box: 6 faces, 12 bevels, 8 corners');
  const n = box.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    const c = new Vector3().fromBufferAttribute(p, i).add(new Vector3().fromBufferAttribute(p, i + 1)).add(new Vector3().fromBufferAttribute(p, i + 2));
    assert.ok(new Vector3().fromBufferAttribute(n, i).dot(c) > 0, 'chamfered box faces wind outward');
  }
  const pot = potGeometry(createRng('t/pot'), 0.6, 0, undefined);
  assert.equal(pot.length, 1);
  const pg = pot[0].geometry;
  assert.ok(pg.attributes.uv && pg.attributes.color && pg.attributes.normal, 'pot carries uv/colour/normal');
  const box3 = new THREE.Box3().setFromBufferAttribute(pg.attributes.position);
  assert.ok(Math.abs(box3.min.y) < 1e-6 && box3.max.y > 0.59 && box3.max.y < 0.63, `pot stands on y = 0 at its size (${box3.min.y} … ${box3.max.y})`);
  assert.ok(box3.max.x > 0.25 && box3.max.x < 0.3, 'classic pot belly radius ≈ 0.455 × size');
  // the rim band is dark, the belly terracotta
  const col = pg.attributes.color;
  let belly = 0, bellyN = 0, rim = 0, rimN = 0;
  for (let i = 0; i < col.count; i++) {
    const y = pg.attributes.position.getY(i) / 0.6;
    const r = Math.hypot(pg.attributes.position.getX(i), pg.attributes.position.getZ(i));
    if (y > 0.35 && y < 0.5 && r > 0.25) { belly += col.getX(i); bellyN++; }
    if (y > 0.9 && r > 0.19) { rim += col.getX(i); rimN++; }
  }
  assert.ok(bellyN > 50 && rimN > 20);
  assert.ok(belly / bellyN > 2 * (rim / rimN), `rim band darker than the belly (${(belly / bellyN).toFixed(2)} vs ${(rim / rimN).toFixed(2)})`);
  const crate = crateGeometry(createRng('t/crate'), 0.7);
  assert.ok(crate.filter((p) => p.material === 'wood').length >= 20, 'crate: battens, boards, lid, floor');
  assert.ok(crate.some((p) => p.material === 'iron'), 'crate nails');
  const uvs = crate.filter((p) => p.material === 'wood').map((p) => p.geometry.attributes.uv.getX(0));
  assert.ok(new Set(uvs.map((u) => Math.floor(((u % 1) + 1) % 1 * 12))).size >= 4, 'boards sit on different plank columns');
  const barrel = barrelGeometry(createRng('t/barrel'), 0.8);
  assert.equal(barrel.filter((p) => p.material === 'iron').length, 4, 'barrel hoops');
  assert.equal(barrel.filter((p) => p.material === 'wood').length, 19, '18 staves + lid');
}

// ---- procedural maps are deterministic and wrap
{
  const a = buildClayMaps('seed-x');
  const b = buildClayMaps('seed-x');
  assert.deepEqual(a.color.image.data, b.color.image.data, 'clay colour map reproduces');
  assert.deepEqual(a.normal.image.data, b.normal.image.data, 'clay normal map reproduces');
  const r = buildRopeMaps('seed-x');
  assert.equal(r.color.image.width, 128);
  // the normal map is mostly "up" (blue) with real slopes in it
  const nd = a.normal.image.data;
  let slopes = 0;
  for (let i = 0; i < nd.length; i += 4) if (Math.abs(nd[i] - 128) > 12 || Math.abs(nd[i + 1] - 128) > 12) slopes++;
  assert.ok(slopes > nd.length / 4 / 20, 'clay normal map has relief');
  [a, b, r].forEach((m) => { m.color.dispose(); m.normal.dispose(); });
}

// ---- the system
const one = await create(ctx);
const two = await create({ ...ctx, terrain: createTerrain() });
const audit = audits[0]();
assert.deepEqual(audit.skipped, [], `every authored prop finds a legal spot (skipped: ${audit.skipped})`);
assert.ok(textureLoads.includes('weathered_planks/color') && textureLoads.includes('weathered_planks/normal'), 'wood loads the plank maps');
const want = { pots: 0, crates: 0, barrels: 0, buckets: 0, platforms: 0, ladders: 0 };
for (const d of PROP_LAYOUT) {
  if (d.kind === 'pot') want.pots++;
  else if (d.kind === 'crate') want.crates++;
  else if (d.kind === 'barrel') want.barrels++;
  else if (d.kind === 'bucket') want.buckets++;
  else if (d.kind === 'ladder') want.ladders++;
  else if (d.kind === 'platform') { want.platforms++; if (d.platform?.ladder) want.ladders++; }
}
for (const k of Object.keys(want)) assert.equal(audit[k], want[k], `${k} placed = authored`);
assert.ok(audit.pots >= 8, 'three sizes of pot in four clusters');
assert.ok(audit.meshes <= 24, `bounded draw calls (${audit.meshes} meshes)`);
assert.equal(audit.meshes, one.group.children.reduce((n, g) => n + g.children.length, 0));
assert.equal(audit.clusters, new Set(PROP_LAYOUT.map((d) => d.cluster)).size, 'one group per cluster');
// small props never tip more than 9° off level
for (const p of audit.placed) if (['pot', 'crate', 'barrel', 'bucket'].includes(p.kind)) assert.ok(p.tiltDeg <= 9.01, `${p.id} tilt ${p.tiltDeg}°`);

// projection: the door / signpost dressing shows in B_house (composition, not occlusion)
const vp = LAYOUT.viewpoints.find((v) => v.id === 'B_house');
const camera = new THREE.PerspectiveCamera(vp.fov, 1280 / 720, 0.1, 1000);
camera.position.fromArray(vp.position);
camera.lookAt(new Vector3().fromArray(vp.target));
camera.updateMatrixWorld(true);
const heroProjection = {};
for (const id of ['door-pot-large', 'sign-pot', 'saria-crate', 'saria-water-bucket']) {
  const p = audit.placed.find((q) => q.id === id);
  assert.ok(p, `${id} placed`);
  const c = new Vector3(p.x, p.y + 0.3, p.z).project(camera);
  assert.ok(Math.abs(c.x) < 0.95 && Math.abs(c.y) < 0.95 && c.z > -1 && c.z < 1, `${id} projects inside B_house; actual ${c.toArray()}`);
  heroProjection[id] = [+((c.x + 1) / 2).toFixed(3), +((1 - c.y) / 2).toFixed(3)];
}
// the platform stays out of A–E (only F sees the plateau lip)
{
  const p = audit.placed.find((q) => q.id === 'lip-platform');
  for (const id of ['A_stairs', 'B_house', 'C_lookback', 'D_log']) {
    const v = LAYOUT.viewpoints.find((q) => q.id === id);
    const cam = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 1000);
    cam.position.fromArray(v.position);
    cam.lookAt(new Vector3().fromArray(v.target));
    cam.updateMatrixWorld(true);
    const c = new Vector3(p.x, p.y + 0.6, p.z).project(cam);
    assert.ok(!(Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z > -1 && c.z < 1), `lip platform outside ${id} (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`);
  }
}

// geometry: determinism, finiteness, attributes, budget
const geometry = (system) => system.group.children.flatMap((g) => g.children.map((m) => m.geometry));
const first = geometry(one);
const second = geometry(two);
assert.equal(first.length, second.length);
let triangles = 0;
for (let i = 0; i < first.length; i++) {
  for (const name of ['position', 'normal', 'uv', 'color']) {
    assert.ok(first[i].attributes[name], `${name} attribute present`);
    assert.deepEqual(first[i].attributes[name].array, second[i].attributes[name].array, `same seed reproduces ${name}`);
    assert.ok([...first[i].attributes[name].array].every(Number.isFinite), `finite ${name}`);
  }
  triangles += first[i].attributes.position.count / 3;
}
assert.ok(triangles < 200000, `props stay a small part of the scene (${triangles} tris)`);
assert.equal(audit.triangles, triangles);

// contact: the recorded underside / foot vertices sit EMBED below the sampled ground
let contacts = 0;
for (const g of one.group.children) {
  for (const mesh of g.children) {
    const p = mesh.geometry.attributes.position;
    for (const i of mesh.geometry.userData.contactIndices ?? []) {
      const v = new Vector3().fromBufferAttribute(p, i);
      const gap = v.y - ctx.terrain.height(v.x, v.z);
      assert.ok(Math.abs(gap + EMBED) < 0.006, `underside contact gap ${gap.toFixed(4)} on ${mesh.name}`);
      contacts++;
    }
  }
}
assert.ok(contacts > 300, `real underside geometry is seated (${contacts} contact vertices)`);
for (const [x, y, z] of audit.samplePositions.bases) assert.ok(Math.abs(ctx.terrain.height(x, z) - y) < 1e-8, 'audited bases touch the terrain');
// each cluster mesh is compact (frustum culling works per locality)
for (const g of one.group.children) for (const m of g.children) assert.ok(m.geometry.boundingSphere.radius < 4.5, `${m.name} bounding radius ${m.geometry.boundingSphere.radius.toFixed(2)}`);

// placement rules
assert.equal(placementAllowed(ctx, 0, 0, 0.3), false, 'plaza paving stays clear');
assert.equal(placementAllowed(ctx, 12.5, -11.5, 0.3, { pad: true }), false, 'house interior stays clear even on the pad');
assert.equal(placementAllowed(ctx, -11.5, -7.2, 0.3), false, 'giant trunk stays clear');
assert.equal(placementAllowed(ctx, 9.1, 2.5, 0.25), false, 'hero boulder stays clear');
assert.equal(placementAllowed(ctx, 9.0, 3.6, 0.25), false, 'npc spot keeps 0.8 m');
assert.equal(placementAllowed(ctx, 7.0, -9.3, 0.2), false, 'signpost keeps its foot');
const flat = { path: 0, stairs: 0, structure: 0, cliff: 0, plateau: 0 };
const withMask = (m) => ({ ...ctx, terrain: { ...ctx.terrain, mask: () => ({ ...flat, ...m }) } });
assert.equal(placementAllowed(withMask({ path: 1 }), 30, 30, 0.3), false, 'paving rejected by default');
assert.equal(placementAllowed(withMask({ path: 1 }), 30, 30, 0.3, { paving: true }), true, 'paving admitted with the flag');
assert.equal(placementAllowed(withMask({ structure: 1 }), 30, 30, 0.3), false, 'pad rejected by default');
assert.equal(placementAllowed(withMask({ structure: 1 }), 30, 30, 0.3, { pad: true }), true, 'pad admitted with the flag');
assert.equal(placementAllowed(withMask({ stairs: 1 }), 30, 30, 0.3, { paving: true, pad: true }), false, 'stairs never');
const blocked = withMask({ path: 1, stairs: 1, structure: 1, cliff: 1 });
const empty = await create(blocked);
assert.equal(empty.group.children.filter((g) => g.children.length).length <= 1, true, 'no fallback placements on forbidden ground (only the ladder, which leans on a house, may build)');

// dispose releases everything
let disposedGeometry = 0;
let disposedMaterial = 0;
first.forEach((g) => g.addEventListener('dispose', () => disposedGeometry++));
const mats = new Set(one.group.children.flatMap((g) => g.children.map((m) => m.material)));
mats.forEach((m) => m.addEventListener('dispose', () => disposedMaterial++));
console.log(JSON.stringify({ passed: true, triangles, contacts, heroProjection, meshes: audit.meshes, clusters: audit.clusters, counts: { pots: audit.pots, crates: audit.crates, barrels: audit.barrels, buckets: audit.buckets, platforms: audit.platforms, ladders: audit.ladders }, placed: audit.placed }, null, 2));
one.dispose();
two.dispose();
empty.dispose();
assert.equal(disposedGeometry, first.length, 'every owned geometry is disposed');
assert.equal(disposedMaterial, mats.size, 'every used material is disposed');
assert.equal(one.group.children.length, 0, 'dispose detaches meshes');
