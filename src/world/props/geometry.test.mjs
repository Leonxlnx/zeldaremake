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
const { create, placementAllowed, EMBED, footprintRadius } = loadTs(path.join(here, 'index.ts'));
const { chamferedBox, potGeometry, crateGeometry, barrelGeometry } = loadTs(path.join(here, 'geometry.ts'));
const { buildClayMaps, buildRopeMaps } = loadTs(path.join(here, 'materials.ts'));
const { PROP_LAYOUT } = loadTs(path.join(here, 'layout.ts'));
const { LAYOUT } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const { createTerrain, expansionCull } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { southBankPoint, EXPANSION } = loadTs(path.join(here, '../layout.ts'));
const { NPC_LOOP } = loadTs(path.join(here, '../character/placement.ts'));
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
// props build against the heightfield's LEGACY view in src/world/index.ts (round 49): the test does the same
// structures publish the west tree-house's platform / walkway for the character ground
// (ctx.shared.walkSurfaces, distantHouse.ts): the same formula here — disc r = R + 0.22 at floorY +
// 0.01, the deck's top line from the rim (platR − 0.15) to EXPANSION.westHouse.deckEnd, hw 0.475,
// the wall ring at R · 0.96 ± 0.2 — so the deck pot builds in the test
const westWalk = (() => {
  const W = EXPANSION.westHouse;
  const R = W.radius;
  const platR = R + 0.22;
  const c = { x: W.host[0], z: W.host[1] };
  const end = W.deckEnd;
  const L = Math.hypot(end[0] - c.x, end[2] - c.z);
  const dir = [(end[0] - c.x) / L, (end[2] - c.z) / L];
  const a = [c.x + dir[0] * (platR - 0.15), W.floorY, c.z + dir[1] * (platR - 0.15)];
  return { id: 'west-house', disc: { x: c.x, z: c.z, r: platR, y: W.floorY + 0.01 }, deck: { a, b: [end[0], end[1], end[2]], hw: 0.475 }, wall: { r: R * 0.96, half: 0.2, gap: [0, 0] } };
})();
const ctx = { terrain: createTerrain('legacy'), layout: LAYOUT, config: WORLD, quality: { shadows: true }, textures, shared: { walkSurfaces: [westWalk] }, audit: (_, fn) => audits.push(fn) };

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
  // two-tone firing + slip drips: the colour map is no longer one tone (fable-5) — a real spread
  // of luminance, and the darkest runs (drips) well below the body
  {
    const cd = a.color.image.data; const lum = [];
    for (let i = 0; i < cd.length; i += 4 * 7) lum.push((0.2126 * cd[i] + 0.7152 * cd[i + 1] + 0.0722 * cd[i + 2]) / 255);
    const mean = lum.reduce((x, y) => x + y, 0) / lum.length;
    const sd = Math.sqrt(lum.reduce((x, y) => x + (y - mean) ** 2, 0) / lum.length);
    lum.sort((x, y) => x - y);
    assert.ok(sd > 0.05, `clay colour map has tonal spread (sd ${sd.toFixed(3)})`);
    assert.ok(lum[Math.floor(lum.length * 0.01)] < mean - 0.12, `slip drips run dark (p1 ${lum[Math.floor(lum.length * 0.01)].toFixed(2)} vs mean ${mean.toFixed(2)})`);
    // the two tones lean different ways: paler patches warmer (r/b up), darker patches browner
    let warm = 0, n = 0;
    for (let i = 0; i < cd.length; i += 4 * 13) { const l = (0.2126 * cd[i] + 0.7152 * cd[i + 1] + 0.0722 * cd[i + 2]) / 255; if (l > mean + 0.04) { warm += cd[i] / Math.max(1, cd[i + 2]); n++; } }
    assert.ok(n > 50 && warm / n > 1.03, `the paler firing patches lean warm (r/b ${(warm / n).toFixed(3)})`);
  }
  [a, b, r].forEach((m) => { m.color.dispose(); m.normal.dispose(); });
}

// ---- the system
const one = await create(ctx);
const two = await create({ ...ctx, terrain: createTerrain('legacy') });
const audit = audits[0]();
assert.deepEqual(audit.skipped, [], `every authored prop finds a legal spot (skipped: ${audit.skipped})`);
assert.ok(textureLoads.includes('weathered_planks/color') && textureLoads.includes('weathered_planks/normal'), 'wood loads the plank maps');
const want = { pots: 0, crates: 0, barrels: 0, buckets: 0, platforms: 0, ladders: 0, markers: 0, lightStrings: 0 };
for (const d of PROP_LAYOUT) {
  if (d.kind === 'pot') want.pots++;
  else if (d.kind === 'crate') want.crates++;
  else if (d.kind === 'barrel') want.barrels++;
  else if (d.kind === 'bucket') want.buckets++;
  else if (d.kind === 'ladder') want.ladders++;
  else if (d.kind === 'marker') want.markers++;
  else if (d.kind === 'lightString') want.lightStrings++;
  else if (d.kind === 'platform') { want.platforms++; if (d.platform?.ladder) want.ladders++; }
}
for (const k of Object.keys(want)) assert.equal(audit[k], want[k], `${k} placed = authored`);
assert.ok(audit.pots >= 8, 'three sizes of pot in four clusters');
assert.ok(audit.meshes <= 24, `bounded draw calls (${audit.meshes} meshes)`);
assert.equal(audit.meshes, one.group.children.reduce((n, g) => n + g.children.length, 0));
assert.equal(audit.clusters, new Set(PROP_LAYOUT.map((d) => d.cluster)).size, 'every authored cluster placed');
assert.equal(audit.localities, 3, 'three merge localities: the village, the clearing and the backside');
assert.equal(one.group.children.length, 3, 'one group per locality');
assert.ok(audit.meshes <= 14, `≤ 14 meshes for the whole system (${audit.meshes})`);
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

// culling: from every fixed camera the clearing (45 m rule) and the backside (expansionLocality:
// frustum + shadow footprints) are hidden and the village drawn; from the deck landing the
// backside draws; far north of the clearing everything is culled
{
  const groups = () => Object.fromEntries(one.group.children.map((c) => [c.name, c.visible]));
  const camAt = (p, t, fov = 46) => { const cam = new THREE.PerspectiveCamera(fov, 1280 / 720, 0.1, 1000); cam.position.fromArray(p); cam.lookAt(new Vector3().fromArray(t)); cam.updateMatrixWorld(true); return cam; };
  for (const v of LAYOUT.viewpoints) {
    one.onCameraMove(camAt(v.position, v.target, v.fov), ctx);
    const vis = groups();
    assert.equal(vis['clearing'], false, `${v.id}: the clearing is culled`);
    assert.equal(vis['backside'], false, `${v.id}: the backside is culled (neither the props nor their shadows meet the frustum)`);
    assert.equal(vis['village'], true, `${v.id}: the village drawn`);
  }
  one.update(0.016, 1, { ...ctx, camera: camAt([2.4, 5.8, -62.6], [0.4, 5.0, -64.6], 50) });
  assert.equal(groups()['clearing'], true, 'at the clearing the clearing draws');
  one.update(0.016, 1, { ...ctx, camera: camAt([-13.2, 3.8, 7.9], [-16.6, 2.9, 5.4], 50) });
  assert.equal(groups()['backside'], true, 'at the deck landing the backside draws');
  one.update(0.016, 1, { ...ctx, camera: camAt([5, 6, -120], [5, 5, -119], 46) });
  assert.deepEqual(groups(), { village: false, clearing: false, backside: false }, 'far north of the clearing every locality is culled');
  one.onCameraMove(camAt(LAYOUT.viewpoints[0].position, LAYOUT.viewpoints[0].target, LAYOUT.viewpoints[0].fov), ctx);
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

// the light strings: pegs on the ground, pods glowing above it, the left one where frame A shows it
{
  const strings = audit.placed.filter((p) => p.kind === 'lightString');
  assert.equal(strings.length, 1, 'one light string (the second of frame A has no bank to stand on here)');
  assert.ok(audit.lightPods >= 7 && audit.lightPods <= 12, `a pod every 0.3 m (${audit.lightPods})`);
  const sf = audit.clusterBounds['stair-foot'];
  assert.ok(sf.glow && sf.wood && sf.rope, 'the stair-foot cluster has glow, wood and rope');
  // every pod hangs 0.15–0.45 m over the ground under it
  const village = one.group.children.find((g) => g.name === 'village');
  const glow = village.children.find((m) => m.name === 'village-glow');
  const pos = glow.geometry.attributes.position;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i += 7) { const y = pos.getY(i) - ctx.terrain.height(pos.getX(i), pos.getZ(i)); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  assert.ok(lo > 0.1 && hi < 0.6, `pods 0.1–0.6 m over the ground (${lo.toFixed(2)}–${hi.toFixed(2)})`);
  const v = LAYOUT.viewpoints.find((q) => q.id === 'A_stairs');
  const cam = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 1000);
  cam.position.fromArray(v.position); cam.lookAt(new Vector3().fromArray(v.target)); cam.updateMatrixWorld(true);
  const left = PROP_LAYOUT.find((d) => d.id === 'terrace-bank-lights').string.points;
  const p0 = new Vector3(left[0][0], ctx.terrain.height(left[0][0], left[0][1]) + 0.3, left[0][1]).project(cam);
  const p1 = new Vector3(left.at(-1)[0], ctx.terrain.height(left.at(-1)[0], left.at(-1)[1]) + 0.3, left.at(-1)[1]).project(cam);
  const u0 = (p0.x + 1) / 2, v0 = (1 - p0.y) / 2, u1 = (p1.x + 1) / 2, v1 = (1 - p1.y) / 2;
  assert.ok(Math.abs(u0 - 0.48) < 0.03 && Math.abs(v0 - 0.465) < 0.03 && Math.abs(u1 - 0.555) < 0.03 && Math.abs(v1 - 0.465) < 0.03, `the string spans A (0.49–0.54, 0.47) like the reference (got (${u0.toFixed(2)}, ${v0.toFixed(2)}) → (${u1.toFixed(2)}, ${v1.toFixed(2)}))`);
  // and stays out of C, whose reference shows that bank bare
  const vc = LAYOUT.viewpoints.find((q) => q.id === 'C_lookback');
  const camC = new THREE.PerspectiveCamera(vc.fov, 1280 / 720, 0.1, 1000);
  camC.position.fromArray(vc.position); camC.lookAt(new Vector3().fromArray(vc.target)); camC.updateMatrixWorld(true);
  for (const [px, pz] of left) { const c = new Vector3(px, ctx.terrain.height(px, pz) + 0.3, pz).project(camC); assert.ok(!(Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z > -1 && c.z < 1), `string peg (${px}, ${pz}) outside C`); }
  assert.equal(audit.skipped.length, 0);
}

// the backside (expansion-2): the west landing's stores and the fork marker stand behind every
// fixed camera and west of camera C's clipped edge, on ground the live and legacy views share
{
  const west = audit.placed.filter((p) => p.cluster === 'west-house');
  assert.equal(west.length, 6, 'crate, bucket, two pots, the fork marker and the deck pot');
  // the deck pot: on the walkway's top line beside the door, inside the deck's width, outside the wall
  const dp = west.find((p) => p.id === 'west-door-pot');
  const a = westWalk.deck.a, b = westWalk.deck.b;
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const dir = [(b[0] - a[0]) / L, (b[2] - a[2]) / L];
  const rel = [dp.x - a[0], dp.z - a[2]];
  const along = rel[0] * dir[0] + rel[1] * dir[1];
  const across = -rel[0] * dir[1] + rel[1] * dir[0];
  assert.ok(Math.abs(along - 0.55) < 0.02, `deck pot 0.55 m along the deck (${along.toFixed(3)})`);
  const dpDef = PROP_LAYOUT.find((d) => d.id === 'west-door-pot');
  const dpR = footprintRadius(dpDef);
  // its rim a hand (1 cm) inside the deck's edge, whatever its size (round 52: 0.36 m → r 0.187)
  assert.ok(Math.abs(across - (0.475 - (dpR + 0.01))) < 0.02, `deck pot's rim 1 cm inside the deck's edge on the door side (across ${across.toFixed(3)}, r ${dpR.toFixed(3)})`);
  assert.ok(Math.abs(dp.y - (a[1] + (b[1] - a[1]) * (along / L))) < 0.01, 'deck pot stands on the deck top');
  const rc = Math.hypot(dp.x - westWalk.disc.x, dp.z - westWalk.disc.z);
  assert.ok(rc > westWalk.wall.r + westWalk.wall.half + dpR, `deck pot (r ${dpR.toFixed(2)}) clear of the wall ring (centre at ${rc.toFixed(2)} m)`);
  assert.ok(Math.hypot(dp.x - -19.69, dp.z - 8.235) < 1.0, 'deck pot within a metre of the door point (−19.69, 8.235)');
  const cams = LAYOUT.viewpoints.map((v) => { const cam = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 1000); cam.position.fromArray(v.position); cam.lookAt(new Vector3().fromArray(v.target)); cam.updateMatrixWorld(true); return { id: v.id, cam }; });
  for (const p of west) {
    for (const h of [0, 1.8]) for (const { id, cam } of cams) {
      const c = new Vector3(p.x, p.y + h, p.z).project(cam);
      assert.ok(!(Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z > -1 && c.z < 1), `${p.id} outside ${id}`);
    }
    // EXPANSION.cClip: x = 2.33 − 0.5663 (z + 7.67), margin 1.3 m west of it
    assert.ok(p.x < 2.33 - 0.5663 * (p.z + 7.67) - 1.3, `${p.id} west of camera C's clipped edge`);
    // authored spot kept (no nudge): the shoulder is natural ground in both views
    const def = PROP_LAYOUT.find((d) => d.id === p.id);
    if (def.onDeck) continue;
    assert.ok(Math.abs(def.x - p.x) < 1e-9 && Math.abs(def.z - p.z) < 1e-9, `${p.id} placed where authored`);
    const live = createTerrain('live');
    assert.ok(Math.abs(live.height(p.x, p.z) - ctx.terrain.height(p.x, p.z)) < 0.02, `${p.id}: live and legacy ground agree (${live.height(p.x, p.z).toFixed(3)} vs ${ctx.terrain.height(p.x, p.z).toFixed(3)})`);
  }
}

// round 49's expansionCull runs after placement: the bank's top would be culled, nothing placed is
{
  assert.deepEqual(audit.culledByExpansion, [], 'no authored prop stands in the live-only expansion ground');
  const [bx, bz] = southBankPoint(0, -1.0);
  assert.equal(expansionCull(bx, bz), true, 'a spot on the south bank top is culled');
  assert.equal(expansionCull(EXPANSION.farHut.host[0], EXPANSION.farHut.host[1]), true, 'the far hut knoll is culled');
  for (const p of audit.placed) if (!PROP_LAYOUT.find((d) => d.id === p.id).onDeck) assert.equal(expansionCull(p.x, p.z), false, `${p.id} stands on ground the expansion did not change`);
}

// the footprints hook: every placed prop publishes its ground disc for the vegetation scatter
{
  const fp = ctx.shared.propFootprints;
  assert.ok(Array.isArray(fp) && fp.length >= audit.placed.length, `at least one footprint per placed prop (${fp?.length} vs ${audit.placed.length})`);
  assert.deepEqual(fp, audit.footprints, 'the audit lists the same footprints');
  for (const f of fp) assert.ok(Number.isFinite(f.x) && Number.isFinite(f.z) && f.r > 0.1 && f.r < 2, `footprint ${JSON.stringify(f)}`);
  const lookout = fp.find((f) => Math.abs(f.x - LAYOUT.plateauLookout.x) < 1e-9 && Math.abs(f.z - LAYOUT.plateauLookout.z) < 1e-9);
  assert.ok(lookout && lookout.r > 1.3, 'the lookout railing reserves the dais');
  const pot = audit.placed.find((q) => q.id === 'door-pot-large');
  const potFp = fp.find((f) => Math.abs(f.x - pot.x) < 1e-9 && Math.abs(f.z - pot.z) < 1e-9);
  assert.ok(potFp && Math.abs(potFp.r - 0.8 * 0.47) < 1e-3, `pot footprint = 0.47 × size (${potFp?.r})`);
}

// the blockers hook (round 52): the solid props a walker should not pass through, for the
// character's ground — one disc per pot / crate / barrel / bucket / marker / ladder at its
// placed spot with the body's radius and its top, the lookout railing as discs along its three
// courses, nothing for the light strings; no disc sits on a path
{
  const bl = ctx.shared.propBlockers;
  assert.ok(Array.isArray(bl) && bl.length > 0, 'propBlockers published');
  assert.deepEqual(bl, audit.blockers, 'the audit lists the same blockers');
  const solidKinds = new Set(['pot', 'crate', 'barrel', 'bucket', 'marker', 'ladder']);
  const solids = audit.placed.filter((p) => solidKinds.has(p.kind));
  for (const p of solids) {
    const b = bl.find((q) => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.z - p.z) < 1e-6);
    assert.ok(b, `${p.id} has a blocker`);
    assert.ok(b.r > 0.1 && b.r < 1.0, `${p.id} blocker radius ${b.r}`);
    assert.ok(b.top > p.y + 0.3 && b.top < p.y + 3.5, `${p.id} blocker top ${b.top} over ground ${p.y}`);
    const def = PROP_LAYOUT.find((d) => d.id === p.id);
    if (def.kind !== 'ladder') assert.ok(Math.abs(b.r - footprintRadius(def)) < 1e-3, `${p.id} blocker = the body's footprint radius`);
  }
  // the railing: 9 discs along the lip and 6 down each side, all r 0.12, above the deck
  const rail = bl.filter((q) => q.r === 0.12);
  assert.equal(rail.length, 9 + 6 + 6, `railing discs (${rail.length})`);
  for (const q of rail) assert.ok(Math.hypot(q.x - LAYOUT.plateauLookout.x, q.z - LAYOUT.plateauLookout.z) < 1.5, 'railing discs sit on the lookout');
  assert.equal(bl.length, solids.length + rail.length, 'no other blockers (light strings publish none)');
  for (const f of audit.footprints.filter((q) => q.r === 0.12 && !rail.some((r) => r.x === q.x && r.z === q.z))) {
    assert.ok(!bl.some((b) => Math.hypot(b.x - f.x, b.z - f.z) < 1e-6), 'a light-string peg is not a blocker');
  }
  // no blocker disc reaches onto a path or a flight (centre + 8 rim samples, the mask at 'legacy');
  // the props authored on the paved apron (`paving`) may stand on the paving but must clear the
  // hero flight's width, so the walk up the stairs stays open
  const main = LAYOUT.stairs.find((s) => s.id === 'main');
  const mL = Math.hypot(main.dir[0], main.dir[1]);
  const ux = main.dir[0] / mL;
  const uz = main.dir[1] / mL;
  for (const b of bl) {
    const owner = audit.placed.find((p) => Math.abs(p.x - b.x) < 1e-6 && Math.abs(p.z - b.z) < 1e-6);
    const def = owner && PROP_LAYOUT.find((d) => d.id === owner.id);
    const onPaving = !!def?.paving;
    for (let i = -1; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = i < 0 ? b.x : b.x + Math.cos(a) * b.r;
      const z = i < 0 ? b.z : b.z + Math.sin(a) * b.r;
      const m = ctx.terrain.mask(x, z);
      assert.ok(m.stairs === 0, `blocker at (${b.x}, ${b.z}) r ${b.r} reaches a flight`);
      if (!onPaving) assert.ok(m.path <= 0.5, `blocker at (${b.x}, ${b.z}) r ${b.r} reaches a path (${m.path.toFixed(2)})`);
    }
    if (onPaving) {
      const dx = b.x - main.base[0];
      const dz = b.z - main.base[2];
      const across = Math.abs(dx * -uz + dz * ux);
      assert.ok(across > main.width / 2 + b.r, `${owner.id} on the apron clears the flight's width (across ${across.toFixed(2)} m)`);
    }
  }

  // the walks stay open under the character's hook (ground.ts: blocked where d < r + 0.12): every
  // path centreline, the Kokiri girl's loop, Saria's door approach, the hero flight's approach, the
  // lookout's open side and the west deck's landing keep a body's width (0.25 m) beyond the margin
  const WALK = 0.12 + 0.25;
  const nearest = (x, z) => {
    let best = { d: Infinity, b: null };
    for (const b of bl) {
      const d = Math.hypot(x - b.x, z - b.z) - b.r;
      if (d < best.d) best = { d, b };
    }
    return best;
  };
  const clearances = [];
  const corridor = (name, pts, step = 0.25) => {
    let minD = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const z = z0 + ((z1 - z0) * k) / n;
        const { d, b } = nearest(x, z);
        minD = Math.min(minD, d);
        assert.ok(d >= WALK, `${name}: a blocker (${b?.x}, ${b?.z}) r ${b?.r} sits ${d.toFixed(2)} m off the walk at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
    }
    clearances.push(`${name} ${minD.toFixed(2)}`);
  };
  const xz = (poly) => poly.map((p) => [p[0], p[p.length - 1]]);
  for (const key of ['pathSpine', 'pathToStairs', 'pathToHouse', 'northPath']) corridor(key, xz(LAYOUT[key]));
  for (const key of ['pathWest', 'pathSouth']) corridor(`EXPANSION.${key}`, xz(EXPANSION[key]));
  corridor('the girl\'s loop', [...NPC_LOOP, NPC_LOOP[0]].map((w) => [w.x, w.z]));
  const saria = LAYOUT.houses.find((h) => h.id === 'saria');
  const fl = Math.hypot(saria.facing[0], saria.facing[1]);
  const door = [saria.position[0] + (saria.facing[0] / fl) * (saria.trunkRadius + 0.4), saria.position[2] + (saria.facing[1] / fl) * (saria.trunkRadius + 0.4)];
  const toHouse = xz(LAYOUT.pathToHouse);
  corridor("Saria's door approach", [toHouse[toHouse.length - 1], door]);
  corridor("the flight's approach", [[main.base[0] - ux * 3, main.base[2] - uz * 3], [main.base[0] + ux * 1.5, main.base[2] + uz * 1.5]]);
  const lk = LAYOUT.plateauLookout;
  const open = (t) => [lk.x + Math.sin(lk.yaw) * t, lk.z + Math.cos(lk.yaw) * t];
  corridor("the lookout's open side", [open(2.3), open(0)]);
  const deckDir = [westWalk.deck.b[0] - westWalk.deck.a[0], westWalk.deck.b[2] - westWalk.deck.a[2]];
  const dl = Math.hypot(deckDir[0], deckDir[1]);
  corridor("the west deck's landing", [[westWalk.deck.b[0], westWalk.deck.b[2]], [westWalk.deck.b[0] + (deckDir[0] / dl) * 2.5, westWalk.deck.b[2] + (deckDir[1] / dl) * 2.5]]);
  console.log(`walk clearance beyond each blocker's radius (m, hook margin 0.12 + body 0.25 = ${WALK}): ${clearances.join(' · ')}`);

  // the deck itself: a prop standing on the 0.95 m walkway pinches it; the lane left for Link's
  // centre on the far side of the blocked band (r + 0.12) must take his 0.2 m half-width plus a hand
  {
    const LANE = 0.42;
    const a = westWalk.deck.a;
    const b = westWalk.deck.b;
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const dir = [(b[0] - a[0]) / L, (b[2] - a[2]) / L];
    const side = [-dir[1], dir[0]];
    let narrowest = Infinity;
    for (const q of bl) {
      const rx = q.x - a[0];
      const rz = q.z - a[2];
      const along = rx * dir[0] + rz * dir[1];
      const lat = rx * side[0] + rz * side[1];
      if (along < -0.5 || along > L + 0.5 || Math.abs(lat) > westWalk.deck.hw + q.r) continue;
      const lane = lat >= 0 ? lat - (q.r + 0.12) + westWalk.deck.hw : westWalk.deck.hw - (lat + q.r + 0.12);
      narrowest = Math.min(narrowest, lane);
      assert.ok(lane >= LANE, `a blocker on the west deck at along ${along.toFixed(2)} leaves a ${lane.toFixed(2)} m lane (need ${LANE})`);
    }
    console.log(`west deck: narrowest lane for Link's centre ${narrowest === Infinity ? 'n/a (nothing on the deck)' : narrowest.toFixed(3) + ' m'}`);
  }
}

// geometry: determinism, finiteness, attributes, budget
const geometry = (system) => system.group.children.flatMap((g) => g.children.map((m) => m.geometry));

// round 52 (the OOM ask): every merged mesh drops its CPU arrays on GPU upload — each attribute and
// the index carry the upload hook, and the bounds three would otherwise compute from the arrays later
// are already there (in Node nothing uploads, so the arrays are still present for the checks below)
const dropsOnUpload = (a) => {
  const probe = { array: new Float32Array(3) };
  a.onUploadCallback.call(probe);
  return probe.array === null;
};
for (const g of geometry(one)) {
  for (const [name, a] of Object.entries(g.attributes)) assert.ok(dropsOnUpload(a), `${name} drops its array on upload`);
  if (g.index) assert.ok(dropsOnUpload(g.index), 'the index drops its array on upload');
  assert.ok(g.boundingSphere && g.boundingBox, 'bounds computed before the arrays can go');
  assert.ok(g.attributes.position.array, 'arrays still present in Node (no upload)');
}
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
for (const g of one.group.children) for (const m of g.children) assert.ok(m.geometry.boundingSphere.radius < (g.name === 'clearing' ? 4.5 : g.name === 'backside' ? 5 : 26), `${m.name} bounding radius ${m.geometry.boundingSphere.radius.toFixed(2)}`);

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
assert.deepEqual(empty.group.children.filter((g) => g.children.length).map((g) => g.name).sort(), ['backside', 'village'], 'the probed props all skip (only the ladder, the hook-bound railing, the authored light string and the deck pot build)');
assert.deepEqual(Object.keys(audits[audits.length - 1]().clusterBounds).sort(), ['plateau-lip', 'stair-foot', 'upper-house', 'west-house'], 'on forbidden ground only the ladder (house), the hook-bound railing, the authored light string (stair-foot) and the deck pot (west-house) build');
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
