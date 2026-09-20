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
const ctx = { terrain: createTerrain(), layout: LAYOUT, config: WORLD, quality: { shadows: true }, textures, shared: {}, audit: (_, fn) => audits.push(fn) };

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
const want = { pots: 0, crates: 0, barrels: 0, buckets: 0, platforms: 0, ladders: 0, markers: 0 };
for (const d of PROP_LAYOUT) {
  if (d.kind === 'pot') want.pots++;
  else if (d.kind === 'crate') want.crates++;
  else if (d.kind === 'barrel') want.barrels++;
  else if (d.kind === 'bucket') want.buckets++;
  else if (d.kind === 'ladder') want.ladders++;
  else if (d.kind === 'marker') want.markers++;
  else if (d.kind === 'platform') { want.platforms++; if (d.platform?.ladder) want.ladders++; }
}
for (const k of Object.keys(want)) assert.equal(audit[k], want[k], `${k} placed = authored`);
assert.ok(audit.pots >= 8, 'three sizes of pot in four clusters');
assert.ok(audit.meshes <= 24, `bounded draw calls (${audit.meshes} meshes)`);
assert.equal(audit.meshes, one.group.children.reduce((n, g) => n + g.children.length, 0));
assert.equal(audit.clusters, new Set(PROP_LAYOUT.map((d) => d.cluster)).size, 'every authored cluster placed');
assert.equal(audit.localities, 2, 'two merge localities: the village and the clearing');
assert.equal(one.group.children.length, 2, 'one group per locality');
assert.ok(audit.meshes <= 8, `≤ 8 meshes for the whole system (${audit.meshes})`);
// small props never tip more than 9° off level; the marker post stands vertical
for (const p of audit.placed) if (['pot', 'crate', 'barrel', 'bucket'].includes(p.kind)) assert.ok(p.tiltDeg <= 9.01, `${p.id} tilt ${p.tiltDeg}°`);
for (const p of audit.placed) if (p.kind === 'marker') assert.equal(p.tiltDeg, 0, `${p.id} vertical`);

// the north clearing's dressing: at the entrance corners, off the paving, and outside every fixed frame
{
  const north = audit.placed.filter((p) => p.cluster === 'north-clearing');
  assert.ok(north.length >= 5 && north.some((p) => p.kind === 'marker'), 'marker + pots at the clearing entrance');
  for (const p of north) {
    assert.ok(p.z < -60 && p.y > 3.9 && p.y < 4.6, `${p.id} on the clearing's rim (${p.x}, ${p.y}, ${p.z})`);
    const m = ctx.terrain.mask(p.x, p.z);
    assert.ok(m.path <= 0.18 && m.stairs === 0, `${p.id} off the north paving (path ${m.path.toFixed(2)})`);
    // outside the disc and its stone ring, and a walker's width off the path's centreline
    assert.ok(Math.hypot(p.x - LAYOUT.northClearing.x, p.z - LAYOUT.northClearing.z) > LAYOUT.northClearing.radius + 0.4, `${p.id} outside the paved disc`);
    // pinhole: C and F do not hold the direction at all; A/B/D/E do, and there the log's west
    // root mass and the north rise are the occluders (D: inside x 0.39–0.47 for the tall post) —
    // the six-view capture is the proof of that, not this test
    for (const id of ['C_lookback', 'F_canopy']) {
      const v = LAYOUT.viewpoints.find((q) => q.id === id);
      const cam = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 1000);
      cam.position.fromArray(v.position);
      cam.lookAt(new Vector3().fromArray(v.target));
      cam.updateMatrixWorld(true);
      const c = new Vector3(p.x, p.y + 1, p.z).project(cam);
      assert.ok(!(Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z > -1 && c.z < 1), `${p.id} outside ${id}`);
    }
    if (p.kind === 'marker') {
      const v = LAYOUT.viewpoints.find((q) => q.id === 'D_log');
      const cam = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 1000);
      cam.position.fromArray(v.position);
      cam.lookAt(new Vector3().fromArray(v.target));
      cam.updateMatrixWorld(true);
      const c = new Vector3(p.x, p.y + 1.9, p.z).project(cam);
      const sx = (c.x + 1) / 2;
      assert.ok(sx > 0.39 && sx < 0.465, `the marker's top projects into D's west root mass band (x ${sx.toFixed(3)})`);
    }
  }
  const marker = north.find((p) => p.kind === 'marker');
  const dir = Math.atan2(LAYOUT.northClearing.x - marker.x, LAYOUT.northClearing.z - marker.z);
  const def = PROP_LAYOUT.find((d) => d.id === marker.id);
  assert.ok(Math.abs(((def.yaw - dir + Math.PI) % (2 * Math.PI)) - Math.PI) < 0.15, `the marker's long board points into the circle (yaw ${def.yaw} vs ${dir.toFixed(2)})`);
  const g = one.group.children.find((c) => c.name === 'clearing');
  assert.ok(g && g.children.length <= 4, 'the clearing locality is ≤ 4 meshes');
  for (const m of g.children) { m.geometry.computeBoundingSphere(); assert.ok(m.geometry.boundingSphere.radius < 4, `${m.name} compact (${m.geometry.boundingSphere.radius.toFixed(2)})`); }
}

// distance cull: from every fixed camera the clearing cluster is hidden and every village cluster
// drawn; from the clearing the clearing draws; the walk (update) applies the same rule
{
  const groups = () => Object.fromEntries(one.group.children.map((c) => [c.name, c.visible]));
  for (const v of LAYOUT.viewpoints) {
    one.onCameraMove({ position: new Vector3().fromArray(v.position) }, ctx);
    const vis = groups();
    assert.equal(vis['clearing'], false, `${v.id}: the clearing is culled`);
    assert.equal(vis['village'], true, `${v.id}: the village drawn`);
  }
  one.update(0.016, 1, { ...ctx, camera: { position: new Vector3(2.4, 5.8, -62.6) } });
  assert.equal(groups()['clearing'], true, 'at the clearing the clearing draws');
  one.update(0.016, 1, { ...ctx, camera: { position: new Vector3(5, 6, -120) } });
  assert.deepEqual(groups(), { village: false, clearing: false }, 'far north of the clearing both localities are culled');
  one.onCameraMove({ position: new Vector3().fromArray(LAYOUT.viewpoints[0].position) }, ctx);
}

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
// the lookout railing is bound to LAYOUT.plateauLookout (no nudge) and stands ON the stone dais:
// its ropes hang above the slab top (the highest turf under the slab + its proud height)
{
  const p = audit.placed.find((q) => q.id === 'lookout-railing');
  const hook = LAYOUT.plateauLookout;
  assert.ok(p && Math.abs(p.x - hook.x) < 1e-9 && Math.abs(p.z - hook.z) < 1e-9, `lookout railing at the hook (${p?.x}, ${p?.z})`);
  const LK = LAYOUT.lookout;
  let turfMax = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = -1 + i / 12;
    for (const [lx, lz] of [[t * LK.halfLength, -LK.halfDepth], [t * LK.halfLength, LK.halfDepth], [-LK.halfLength, t * LK.halfDepth], [LK.halfLength, t * LK.halfDepth]]) {
      const wx = LK.x + lx * Math.cos(hook.yaw) + lz * Math.sin(hook.yaw);
      const wz = LK.z - lx * Math.sin(hook.yaw) + lz * Math.cos(hook.yaw);
      turfMax = Math.max(turfMax, ctx.terrain.height(wx, wz));
    }
  }
  const slabTop = turfMax + LK.height;
  // the meshes merge per locality, so the cluster's own extent comes from the audit
  const lip = audit.clusterBounds['plateau-lip'];
  assert.ok(lip && lip.rope && lip.wood, 'the lookout cluster reports rope and wood bounds');
  assert.ok(lip.rope.min[1] > slabTop + 0.3, `rope courses above the slab top (${lip.rope.min[1]} vs slab ${slabTop.toFixed(3)})`);
  assert.ok(lip.wood.max[1] > slabTop + 0.8 && lip.wood.max[1] < slabTop + 0.95, `posts ≈ 0.88 m over the slab (${(lip.wood.max[1] - slabTop).toFixed(3)})`);
  // the step block stands on the turf beside the slab, below its top
  assert.ok(lip.wood.min[1] < slabTop - 0.1, 'step block on the turf');
  // only F sees the plateau lip
  for (const id of ['A_stairs', 'B_house', 'C_lookback', 'D_log']) {
    const v = LAYOUT.viewpoints.find((q) => q.id === id);
    const cam = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 1000);
    cam.position.fromArray(v.position);
    cam.lookAt(new Vector3().fromArray(v.target));
    cam.updateMatrixWorld(true);
    const c = new Vector3(p.x, p.y + 0.6, p.z).project(cam);
    assert.ok(!(Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z > -1 && c.z < 1), `lookout railing outside ${id} (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`);
  }
}

// the footprints hook: every placed prop publishes its ground disc for the vegetation scatter
{
  const fp = ctx.shared.propFootprints;
  assert.ok(Array.isArray(fp) && fp.length === audit.placed.length, `one footprint per placed prop (${fp?.length} vs ${audit.placed.length})`);
  assert.deepEqual(fp, audit.footprints, 'the audit lists the same footprints');
  for (const f of fp) assert.ok(Number.isFinite(f.x) && Number.isFinite(f.z) && f.r > 0.1 && f.r < 2, `footprint ${JSON.stringify(f)}`);
  const lookout = fp.find((f) => Math.abs(f.x - LAYOUT.plateauLookout.x) < 1e-9 && Math.abs(f.z - LAYOUT.plateauLookout.z) < 1e-9);
  assert.ok(lookout && lookout.r > 1.3, 'the lookout railing reserves the dais');
  const pot = audit.placed.find((q) => q.id === 'door-pot-large');
  const potFp = fp.find((f) => Math.abs(f.x - pot.x) < 1e-9 && Math.abs(f.z - pot.z) < 1e-9);
  assert.ok(potFp && Math.abs(potFp.r - 0.8 * 0.47) < 1e-3, `pot footprint = 0.47 × size (${potFp?.r})`);
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
for (const g of one.group.children) for (const m of g.children) assert.ok(m.geometry.boundingSphere.radius < (g.name === 'clearing' ? 4.5 : 26), `${m.name} bounding radius ${m.geometry.boundingSphere.radius.toFixed(2)}`);

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
assert.equal(empty.group.children.filter((g) => g.children.length).length <= 2, true, 'no fallback placements on forbidden ground (only the ladder, which leans on a house, and the lookout railing, bound to its hook, may build)');
assert.deepEqual(empty.group.children.filter((g) => g.children.length).map((g) => g.name).sort(), ['village'], 'the probed props all skip (only the ladder and the hook-bound railing build, both village)');
assert.deepEqual(Object.keys(audits[audits.length - 1]().clusterBounds).sort(), ['plateau-lip', 'upper-house'], 'only the ladder and the railing clusters have geometry on forbidden ground');
// the blocked run overwrote the shared list; restore the real one for the checks below
ctx.shared.propFootprints = audit.footprints;

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
