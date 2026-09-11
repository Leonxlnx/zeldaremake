/** Run: node src/world/character/boot-articulation.test.mjs (CPU geometry only). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

function load(name) {
  const source = ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(id => {
    if (id === 'three') return THREE;
    assert.ok(id.startsWith('./'), 'local geometry helpers only');
    return load(`${id}.ts`);
  }, mod, mod.exports);
  return mod.exports;
}
const { buildRig, LINK_PROPORTIONS, KOKIRI_PROPORTIONS } = load('./rig.ts');
const { createLinkBoot } = load('./boot-geometry.ts');
const { createBootArticulation } = load('./boot-articulation.ts');
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const material = new THREE.MeshBasicMaterial();
const rig = buildRig(LINK_PROPORTIONS, 'boot-test');
function attach(ankle, name, geometry) {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; ankle.add(mesh); return mesh;
}
const ankles = [rig.ankleL, rig.ankleR], soles = [];
for (const ankle of ankles) {
  const boot = createLinkBoot(rig.sole.y, .135);
  attach(ankle, 'boot', boot.upper); attach(ankle, 'boot-cuff', boot.cuff);
  const mesh = attach(ankle, 'boot-sole', boot.sole);
  soles.push({ mesh, geometry: mesh.geometry, position: boot.sole.attributes.position.array.slice(),
    normal: boot.sole.attributes.normal.array.slice(), index: boot.sole.index.array.slice() });
  // Small asymmetric accessory fixtures check that every shaft attachment follows it.
  for (const name of ['boot-tongue', 'boot-laces', 'boot-buckle']) {
    attach(ankle, name, new THREE.BoxGeometry(.008, .02, .006).translate(.035, .075, .043));
  }
}
const sync = createBootArticulation(rig);
assert.equal(sync, createBootArticulation(rig), 'setup is idempotent');
const meshes = ankles.flatMap(ankle => ankle.children.filter(mesh => mesh.name !== 'boot-sole'));
function edgeLengths(geometry) {
  const p = geometry.attributes.position, index = geometry.index, lengths = [];
  for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
    a.fromBufferAttribute(p, index.getX(i + j)); b.fromBufferAttribute(p, index.getX(i + (j + 1) % 3));
    lengths.push(a.distanceTo(b));
  }
  return lengths;
}
const sources = meshes.map(mesh => ({ mesh, geometry: mesh.geometry,
  position: mesh.geometry.attributes.position.array.slice(), lengths: edgeLengths(mesh.geometry),
  uv: mesh.geometry.attributes.uv.array.slice(), index: mesh.geometry.index.array.slice() }));
for (const { mesh, geometry } of sources) if (mesh.name === 'boot' || mesh.name === 'boot-cuff') {
  const p = geometry.attributes.position, uv = geometry.attributes.uv, index = geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const u = ids.map(j => uv.getX(j)), v = ids.map(j => uv.getY(j));
    const area = Math.abs((u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0])) / 2;
    assert(Number.isFinite(area) && area > 1e-8, 'leather faces have nonsingular texture coordinates');
    // Horizontal closure faces use a planar map; only the wrapped shell needs unwrapping.
    const y = ids.map(j => p.getY(j));
    if (mesh.name === 'boot-cuff' || Math.max(...y) - Math.min(...y) > 1e-8) {
      assert(Math.max(...u) - Math.min(...u) <= .5, 'no interpolation across the U wrap');
      assert(Math.max(...v) - Math.min(...v) <= .5, 'no interpolation across the V wrap');
    }
  }
}
const attachmentDistances = ankles.map(ankle => {
  const cuff = ankle.getObjectByName('boot-cuff').geometry.attributes.position;
  return ['boot-tongue', 'boot-laces', 'boot-buckle'].map(name => {
    const p = ankle.getObjectByName(name).geometry.attributes.position;
    return a.fromBufferAttribute(cuff, 0).distanceTo(b.fromBufferAttribute(p, 0));
  });
});

// Weld only for the topology check: hard-normal cap edges and sphere UV seams may duplicate
// vertices. Check after bending, when the two deliberately overlapping cut caps separate.
function closedOutward(geometry) {
  const position = geometry.attributes.position, welded = [], points = [], map = new Map();
  const edges = new Map(), parents = [];
  for (let i = 0; i < position.count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    const key = p.map(v => Math.round(v * 1e7)).join(',');
    if (!map.has(key)) { map.set(key, points.length); parents.push(points.length); points.push(p); }
    welded.push(map.get(key));
  }
  const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
  const triangles = [];
  for (let i = 0; i < geometry.index.count; i += 3) {
    const tri = [0, 1, 2].map(j => welded[geometry.index.getX(i + j)]); triangles.push(tri);
    const [x, y, z] = tri; parents[find(y)] = find(x); parents[find(z)] = find(x);
    a.fromArray(points[x]); b.fromArray(points[y]).sub(a); c.fromArray(points[z]).sub(a);
    assert(b.cross(c).length() > 1e-10, 'no collapsed triangles');
    for (let j = 0; j < 3; j++) {
      const x = tri[j], y = tri[(j + 1) % 3], key = [Math.min(x, y), Math.max(x, y)].join(',');
      const edge = edges.get(key) ?? { count: 0, direction: 0 };
      edge.count++; edge.direction += x < y ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) {
    assert.equal(edge.count, 2, 'closed component edge'); assert.equal(edge.direction, 0, 'opposed adjacent winding');
  }
  const volumes = new Map();
  for (const [x, y, z] of triangles) {
    const value = a.fromArray(points[x]).dot(b.fromArray(points[y]).cross(c.fromArray(points[z]))) / 6;
    volumes.set(find(x), (volumes.get(find(x)) ?? 0) + value);
  }
  assert.equal(volumes.size, 3, 'closed shoe, shaft and ankle joint');
  for (const volume of volumes.values()) assert(volume > 0, 'each closed component faces outward');
}

for (const angle of [.23, -.7, 1.4, 2.5, .23]) {
  rig.root.position.set(.7, 1.2, -.3); rig.root.rotation.y = .41;
  for (const [i, ankle] of ankles.entries()) ankle.rotation.set(angle * (i ? -1 : 1), .19, -.11);
  const pose = ankles.map(ankle => [...ankle.position, ...ankle.quaternion, ...ankle.scale]);
  sync();
  assert.deepEqual(ankles.map(ankle => [...ankle.position, ...ankle.quaternion, ...ankle.scale]), pose, 'geometry never changes pose');
  for (const [side, ankle] of ankles.entries()) {
    const boot = sources.find(source => source.mesh === ankle.getObjectByName('boot'));
    const p = boot.geometry.attributes.position, centre = new THREE.Vector3(), uniqueMouth = new Set(); let count = 0;
    for (let i = 0; i < p.count; i++) if (Math.abs(boot.position[i * 3 + 1] - .135) < 1e-7) {
      // UV seam duplicates represent the same physical point and must not weight the centre.
      const key = Array.from(boot.position.slice(i * 3, i * 3 + 3)).map(v => Math.round(v * 1e7)).join(',');
      if (uniqueMouth.has(key)) continue;
      uniqueMouth.add(key);
      centre.add(a.fromBufferAttribute(p, i)); count++;
    }
    (side ? rig.kneeR : rig.kneeL).getWorldPosition(a); ankle.worldToLocal(a);
    assert(centre.multiplyScalar(1 / count).normalize().dot(a.normalize()) > 1 - 1e-10, 'shaft mouth follows actual calf axis without accumulated rotation');
    const cuff = ankle.getObjectByName('boot-cuff').geometry.attributes.position;
    for (const [j, name] of ['boot-tongue', 'boot-laces', 'boot-buckle'].entries()) {
      const detail = ankle.getObjectByName(name).geometry.attributes.position;
      const distance = a.fromBufferAttribute(cuff, 0).distanceTo(b.fromBufferAttribute(detail, 0));
      assert(Math.abs(distance - attachmentDistances[side][j]) < 3e-8, 'each detail stays attached to the moving cuff');
    }
  }
  for (const { mesh, geometry, position, lengths, uv, index } of sources) {
    assert.equal(mesh.geometry, geometry, 'updates allocate no replacement geometry');
    assert.deepEqual(geometry.attributes.uv.array, uv); assert.deepEqual(geometry.index.array, index);
    edgeLengths(geometry).forEach((length, i) => assert(Math.abs(length - lengths[i]) < 3e-8, 'every triangle edge stays rigid'));
    const p = geometry.attributes.position, n = geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      a.fromBufferAttribute(p, i); assert(Number.isFinite(a.x + a.y + a.z));
      assert(geometry.boundingBox.containsPoint(a), 'updated bounds contain geometry');
      assert(Math.abs(b.fromBufferAttribute(n, i).length() - 1) < 1e-6, 'finite unit normals');
      if (mesh.name === 'boot' && position[i * 3 + 1] < .01 - 1e-7) {
        assert.deepEqual(a.toArray(), Array.from(position.slice(i * 3, i * 3 + 3)), 'lower shoe remains fixed');
      }
    }
  }
  for (const source of soles) {
    assert.equal(source.mesh.geometry, source.geometry);
    assert.deepEqual(source.geometry.attributes.position.array, source.position);
    assert.deepEqual(source.geometry.attributes.normal.array, source.normal);
    assert.deepEqual(source.geometry.index.array, source.index);
  }
  if (angle === .23) for (const ankle of ankles) closedOutward(ankle.getObjectByName('boot').geometry);
}

const npc = buildRig(KOKIRI_PROPORTIONS, 'npc-test');
const npcBoot = attach(npc.ankleL, 'boot', new THREE.CylinderGeometry(.062, .057, .19, 12));
const original = npcBoot.geometry, npcPositions = original.attributes.position.array.slice();
const syncNpc = createBootArticulation(npc); npc.ankleL.rotation.x = .9; syncNpc();
assert.equal(npcBoot.geometry, original, 'non-Link boot opts out');
assert.deepEqual(original.attributes.position.array, npcPositions);
for (const mesh of [...meshes, ...soles.map(s => s.mesh), npcBoot]) mesh.geometry.dispose();
material.dispose();
console.log('boot-articulation.test.mjs: closed outward shells, rigid parts, fixed soles, bounds and NPC opt-out passed');
