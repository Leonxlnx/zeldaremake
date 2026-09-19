/** Run: node --test src/world/rocks/ledge.test.mjs (Node 20+, no browser needed). */
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
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
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
const { buildRockLedge } = loadTs(path.join(here, 'ledge.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));

/** a synthetic bank: ground 1 m west of x = 7.5, rising over 1.5 m to 5 m east of it, with a soft undulation */
function terrainStep() {
  const height = (x, z) => {
    const t = Math.min(1, Math.max(0, (x - 7.5) / 1.5));
    return 1 + 4 * t * t * (3 - 2 * t) + 0.08 * Math.sin(z * 0.9) * Math.cos(x * 0.7);
  };
  return {
    height,
    normal(x, z, out = new THREE.Vector3()) {
      const e = 0.05;
      return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
    },
    slope(x, z) {
      return 1 - this.normal(x, z).y;
    },
    mask() {
      return { path: 0, stairs: 0, cliff: 0, structure: 0 };
    },
  };
}

const def = { id: 't', foot: [[6.3, -14], [6.4, -18], [6.5, -22], [6.3, -26]], inset: 2.4, lean: 0.4 };
const arr = (g, name) => Array.from(g.attributes[name].array);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('a ledge is deterministic from its stream and seed, and carries the rock material attributes', () => {
  const T = terrainStep();
  const a = buildRockLedge(def, T, createRng('t/l'), 'seed');
  const b = buildRockLedge(def, T, createRng('t/l'), 'seed');
  for (const k of ['position', 'normal', 'color', 'aMoss', 'aWet']) {
    assert.ok(a.geometry.attributes[k], `missing ${k}`);
    assert.ok(same(arr(a.geometry, k), arr(b.geometry, k)), `${k} differs between two builds`);
  }
  assert.ok(a.stats.triangles > 2000, `triangles ${a.stats.triangles}`);
  assert.ok(a.stats.height > 3.2 && a.stats.height < 4.6, `height ${a.stats.height} (the step is 4 m, tapered ends)`);
});

test('the foot enters the terrain exactly and the face turns toward the path side', () => {
  const T = terrainStep();
  const b = buildRockLedge(def, T, createRng('t/l'), 'seed');
  assert.ok(b.contacts.length >= 10, `contacts ${b.contacts.length}`);
  for (const [x, y, z] of b.contacts) assert.ok(Math.abs(y - T.height(x, z)) < 0.03, `foot contact ${y} vs ground ${T.height(x, z)}`);
  // mean normal of the face rows (aWet < 1 and aMoss < 0.5: the bare stone) points west (−x), toward the path
  const nrm = b.geometry.attributes.normal;
  const moss = b.geometry.attributes.aMoss;
  const wet = b.geometry.attributes.aWet;
  let sx = 0;
  let n = 0;
  for (let i = 0; i < nrm.count; i++) {
    if (moss.getX(i) > 0.5 || wet.getX(i) >= 1) continue;
    sx += nrm.getX(i);
    n++;
  }
  assert.ok(n > 100);
  assert.ok(sx / n < -0.5, `mean face normal x ${sx / n} — should face the path (−x)`);
  // winding agrees with the stored normals (front faces toward the path, not into the bank)
  const P = b.geometry.attributes.position;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const vn = new THREE.Vector3();
  let flipped = 0;
  let checked = 0;
  for (let i = 0; i < P.count; i += 3) {
    va.fromBufferAttribute(P, i);
    vb.fromBufferAttribute(P, i + 1).sub(va);
    vc.fromBufferAttribute(P, i + 2).sub(va);
    vb.cross(vc);
    if (vb.lengthSq() < 1e-12) continue;
    vn.fromBufferAttribute(nrm, i).add(new THREE.Vector3().fromBufferAttribute(nrm, i + 1)).add(new THREE.Vector3().fromBufferAttribute(nrm, i + 2));
    checked++;
    if (vb.dot(vn) < 0) flipped++;
  }
  assert.ok(checked > 0);
  assert.ok(flipped / checked < 0.02, `${flipped} of ${checked} triangles wound against their normals`);
});

test('moss sheets sit on the lip and the upper face; the wet band is the foot', () => {
  const T = terrainStep();
  const b = buildRockLedge(def, T, createRng('t/l'), 'seed');
  const P = b.geometry.attributes.position;
  const moss = b.geometry.attributes.aMoss;
  const wet = b.geometry.attributes.aWet;
  let lowWet = 0;
  let lowN = 0;
  let highWet = 0;
  let highN = 0;
  let lipMoss = 0;
  let lipN = 0;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    const above = y - T.height(x, z);
    if (x > 8.2) {
      lipMoss += moss.getX(i);
      lipN++;
      continue;
    }
    if (above > 0.05 && above < 0.5) (lowWet += wet.getX(i)), lowN++;
    if (above > 2.0 && above < 3.2) (highWet += wet.getX(i)), highN++;
  }
  assert.ok(lowN > 50 && highN > 50, `bands ${lowN} / ${highN}`);
  assert.ok(lowWet / lowN > 0.6, `foot band wet ${lowWet / lowN}`);
  assert.ok(highWet / highN < 0.3, `mid face wet ${highWet / highN}`);
  assert.ok(lipN > 50 && lipMoss / lipN > 0.7, `lip moss ${lipMoss / lipN} over ${lipN}`);
  assert.ok(b.stats.mossShare > 0.12 && b.stats.mossShare < 0.7, `moss share ${b.stats.mossShare}`);
});

test('a free-standing shelf (explicit height) has its top at foot + height', () => {
  const T = terrainStep();
  const flat = { ...T, height: () => 1 };
  const b = buildRockLedge({ ...def, height: 3 }, flat, createRng('t/l'), 'seed');
  assert.ok(Math.abs(b.stats.height - 3) < 0.05, `height ${b.stats.height}`);
  const P = b.geometry.attributes.position;
  let maxY = -Infinity;
  for (let i = 0; i < P.count; i++) maxY = Math.max(maxY, P.getY(i));
  assert.ok(maxY > 3.9 && maxY < 4.4, `top ${maxY}`);
});
