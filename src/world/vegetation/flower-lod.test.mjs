/** CPU regression: flower LODs simplify surfaces without moving stems or removing blooms. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = {exports: {}};
  modules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'three') return THREE;
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), `${id}.ts`));
    throw Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}

// Record existing builder calls, then validate the resulting indexed vertex positions.
// No added production metadata, replacement geometry, renderer or visual claims.
const kit = load(path.join(here, 'geometry.ts'));
let trace;
const originalTube = kit.tube;
kit.tube = (mesh, points, rootRadius, tipRadius, color, sides = 4, caps = false) => {
  const start = mesh.p.length / 3;
  originalTube(mesh, points, rootRadius, tipRadius, color, sides, caps);
  trace.stems.push({start, end: start + (points.length - 1) * sides, sides,
    root: points[0].clone(), head: points.at(-1).clone()});
};
for (const name of ['curvedLeaf', 'foldedLeaf']) {
  const original = kit[name];
  kit[name] = (mesh, base, direction, length, width, color, options = {}) => {
    const start = mesh.p.length / 3;
    original(mesh, base, direction, length, width, color, options);
    // Spike bells use .3 in high and .2 in mid, distinct from stem leaves and terminal bud.
    if (trace.species === 'flowerSpikeGeometry' && (options.curl === .3 || options.curl === .2)) {
      trace.bells.push({vertex: start, base: base.clone()});
    }
    // round 46: the cluster head's petals (petalHead) are the only laminae pinned to a bloom axis
    if (trace.species === 'flowerGeometry' && options.planeNormal) trace.petals.push({vertex: start, base: base.clone()});
  };
}
{
  const original = kit.shapedLeaf;
  kit.shapedLeaf = (mesh, base, direction, length, width, color, options) => {
    const start = mesh.p.length / 3;
    original(mesh, base, direction, length, width, color, options);
    if (trace.species === 'flowerGeometry' && options.uOffset === kit.PETAL_U) trace.petals.push({vertex: start, base: base.clone()});
  };
}

const plants = load(path.join(here, 'plantgeo.ts'));
const {WORLD} = load(path.join(here, '../config.ts'));
const palette = plants.makePalette(WORLD.palette);
const position = (geometry, index) => new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), index);
function ringCenter(geometry, start, sides) {
  const center = new THREE.Vector3();
  for (let j = 0; j < sides; j++) center.add(position(geometry, start + j));
  return center.divideScalar(sides);
}
function close(actual, expected, label) {
  assert.ok(actual.distanceTo(expected) < 1e-7, `${label}: ${actual.toArray()} != ${expected.toArray()}`);
}
function build(species, seed, detail) {
  trace = {species, stems: [], bells: [], petals: []};
  const geometry = plants[species](seed, palette, detail);
  const result = {...trace, geometry};
  const index = geometry.getIndex();
  const referenced = new Set(index.array);
  const vertices = geometry.getAttribute('position');
  for (const attribute of Object.values(geometry.attributes)) {
    assert.ok([...attribute.array].every(Number.isFinite), `${species}/${detail}: finite attributes`);
  }
  assert.ok([...index.array].every(i => i >= 0 && i < vertices.count), 'Valid triangle indices');
  assert.ok(Math.abs(geometry.boundingBox.min.y) < 1e-7, 'Root remains grounded');
  const first = result.stems[0];
  const offset = ringCenter(geometry, first.start, first.sides).sub(first.root);
  assert.ok(Math.hypot(offset.x, offset.z) < 1e-7, 'Grounding only translates vertically');
  for (const stem of result.stems) {
    for (const [start, expected] of [[stem.start, stem.root], [stem.end, stem.head]]) {
      for (let j = 0; j < stem.sides; j++) assert.ok(referenced.has(start + j), 'Landmark belongs to rendered triangle');
      close(ringCenter(geometry, start, stem.sides), expected.clone().add(offset), 'Actual stem ring center');
    }
  }
  for (const bell of [...result.bells, ...result.petals]) {
    assert.ok(referenced.has(bell.vertex), 'Bell / petal attachment belongs to rendered triangle');
    close(position(geometry, bell.vertex), bell.base.clone().add(offset), 'Actual bell / petal attachment');
  }
  return result;
}

const totals = {};
for (const species of ['flowerGeometry', 'flowerSpikeGeometry']) {
  totals[species] = {ultra: 0, high: 0, mid: 0, low: 0};
  for (let variant = 0; variant < 24; variant++) {
    const seed = `flower-lod/${variant}`;
    const high = build(species, seed, 'high');
    const mid = build(species, seed, 'mid');
    const low = build(species, seed, 'low');
    assert.equal(high.stems.length, mid.stems.length, 'Retain every high/mid stem and terminal bloom');
    assert.equal(high.bells.length, mid.bells.length, 'Retain every high/mid spike bell petal');
    if (species === 'flowerSpikeGeometry') assert.ok(high.bells.length >= high.stems.length * 7 * 4);
    // round 46 (survey-2 #05): the cluster head is an open bloom of PETAL_HEAD_PETALS petals round an
    // eye at every LOD but the far blob — the same petals, on the same roots, at high and mid
    if (species === 'flowerGeometry') {
      assert.ok(high.petals.length >= high.stems.length * plants.PETAL_HEAD_PETALS[0], 'At least five petals a head at high');
      assert.equal(high.petals.length, mid.petals.length, 'Retain every high/mid petal');
      for (let i = 0; i < high.petals.length; i++) close(high.petals[i].base, mid.petals[i].base, 'High/mid petal root');
    }
    for (let i = 0; i < high.stems.length; i++) {
      for (const part of ['start', 'end']) {
        close(ringCenter(high.geometry, high.stems[i][part], high.stems[i].sides),
          ringCenter(mid.geometry, mid.stems[i][part], mid.stems[i].sides), 'High/mid skeletal landmark');
      }
    }
    for (let i = 0; i < high.bells.length; i++) {
      close(position(high.geometry, high.bells[i].vertex), position(mid.geometry, mid.bells[i].vertex), 'High/mid bell position');
    }
    const triangles = value => value.geometry.getIndex().count / 3;
    assert.ok(triangles(mid) < triangles(high) * .85, 'Mid saves at least 15% triangles');
    assert.ok(triangles(low) < triangles(mid), 'Low remains the cheapest geometry');
    // round 43 — the ultra tier: the same stems from the same stream (5-sided now, the raw roots and
    // heads recorded before grounding are bit-identical), bells as throat tubes (4-sided) at every
    // spike station, at least twice the high LOD's triangles
    const ultra = build(species, seed, 'ultra');
    const ultraStems = ultra.stems.filter(s => s.sides === 5);
    assert.equal(ultraStems.length, high.stems.length, 'Ultra keeps every stem');
    for (let i = 0; i < high.stems.length; i++) {
      close(ultraStems[i].root, high.stems[i].root, 'Ultra/high stem root');
      close(ultraStems[i].head, high.stems[i].head, 'Ultra/high stem head');
    }
    if (species === 'flowerSpikeGeometry') assert.ok(ultra.stems.filter(s => s.sides === 4).length >= high.stems.length * 7 * 2, 'Two bells a station');
    else {
      // round 46: the ultra head's petals are the high LOD's (same roots, from the head's own stream), as
      // 4 × 5 laminae in the petal band; the round-43 floret ball (≥ 8 bells a head) is gone
      assert.equal(ultra.petals.length, high.petals.length, 'Ultra keeps every petal');
      for (let i = 0; i < high.petals.length; i++) close(ultra.petals[i].base, high.petals[i].base, 'Ultra/high petal root (recorded before grounding, like the stems)');
    }
    assert.ok(triangles(ultra) >= triangles(high) * 2, 'Ultra carries at least twice the high triangles');
    for (const [detail, result] of Object.entries({ultra, high, mid, low})) {
      totals[species][detail] += triangles(result);
      const repeat = build(species, seed, detail);
      for (const name of Object.keys(result.geometry.attributes)) {
        assert.deepEqual(result.geometry.getAttribute(name).array, repeat.geometry.getAttribute(name).array, 'Deterministic attributes');
      }
      assert.deepEqual(result.geometry.index.array, repeat.geometry.index.array, 'Deterministic topology');
      result.geometry.dispose();
      repeat.geometry.dispose();
    }
  }
}
console.log('PASS: 24 seeds/species; actual high/mid stem and bell landmarks, indexed finite geometry, grounding, determinism and triangle reduction', totals);
