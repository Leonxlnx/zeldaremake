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
  trace = {species, stems: [], bells: []};
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
  for (const bell of result.bells) {
    assert.ok(referenced.has(bell.vertex), 'Bell attachment belongs to rendered triangle');
    close(position(geometry, bell.vertex), bell.base.clone().add(offset), 'Actual bell attachment');
  }
  return result;
}

const totals = {};
for (const species of ['flowerGeometry', 'flowerSpikeGeometry']) {
  totals[species] = {high: 0, mid: 0, low: 0};
  for (let variant = 0; variant < 24; variant++) {
    const seed = `flower-lod/${variant}`;
    const high = build(species, seed, 'high');
    const mid = build(species, seed, 'mid');
    const low = build(species, seed, 'low');
    assert.equal(high.stems.length, mid.stems.length, 'Retain every high/mid stem and terminal bloom');
    assert.equal(high.bells.length, mid.bells.length, 'Retain every high/mid spike bell petal');
    if (species === 'flowerSpikeGeometry') assert.ok(high.bells.length >= high.stems.length * 7 * 4);
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
    for (const [detail, result] of Object.entries({high, mid, low})) {
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
