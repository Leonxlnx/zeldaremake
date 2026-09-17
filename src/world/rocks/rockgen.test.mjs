/** Run: node --test src/world/rocks/rockgen.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// Compile only this test's TS dependency graph in memory (the props tests' loader).
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
const { buildRock } = loadTs(path.join(here, 'rockgen.ts'));
const { dressRock, mergeRockParts } = loadTs(path.join(here, 'dressing.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));

/** the D boulder's far options (index.ts), radius 0.6 */
const farOpts = () => ({
  radius: 0.6,
  detail: 26,
  ridge: 0.12,
  lump: 0.3,
  crown: 0.2,
  cuts: 2,
  cutUp: [-0.35, 0.3],
  cutDepth: [0.68, 0.84],
  cutToward: [0.3, 0.95],
  cutDark: 0.4,
  facetBare: 0.9,
  squashY: 0.64,
  creaseDeg: 24,
  cracks: 0.55,
  crackDepth: 0.025,
  moss: 0.85,
  strata: 0.06,
  mossThickness: 0.13,
  mossLumpy: 1,
  mossSide: 0.45,
  mossShade: [0.6, -0.8],
  dirt: 0.8,
  collar: new THREE.Color(0.13, 0.135, 0.09),
  collarBand: [0.12, 0.6],
  tint: new THREE.Color(0.82, 0.77, 0.68),
  freq: 0.9,
});
/** the near LOD's overrides (index.ts) */
const nearOpts = () => ({ ...farOpts(), detail: 40, creaseDeg: 18, crackDepth: 0.045, fineCracks: 0.6, fineCrackDepth: 0.015, micro: 0.03, chip: 0.035, strata: 0.1 });

const arr = (g, name) => Array.from(g.attributes[name].array);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('a rock is deterministic from its stream and seed', () => {
  const a = buildRock(createRng('t/d'), 'seed/d', farOpts());
  const b = buildRock(createRng('t/d'), 'seed/d', farOpts());
  for (const k of ['position', 'normal', 'color', 'aMoss', 'aWet']) assert.ok(same(arr(a, k), arr(b, k)), `${k} differs between two builds`);
  assert.equal(a.attributes.position.count, 20 * 27 * 27 * 3);
});

test('the near options default off: explicit zeros build the far rock byte-identically', () => {
  const plain = buildRock(createRng('t/d'), 'seed/d', farOpts());
  const zeros = buildRock(createRng('t/d'), 'seed/d', { ...farOpts(), micro: 0, fineCracks: 0, chip: 0 });
  for (const k of ['position', 'normal', 'color', 'aMoss']) assert.ok(same(arr(plain, k), arr(zeros, k)), `${k} moved with the near options at 0`);
});

test('aWet: a 0..1 band above the ground, wetter low down, dry on the crown', () => {
  const g = buildRock(createRng('t/d'), 'seed/d', farOpts());
  const wet = g.attributes.aWet;
  const pos = g.attributes.position;
  let low = 0;
  let nLow = 0;
  let high = 0;
  let nHigh = 0;
  for (let i = 0; i < pos.count; i++) {
    const w = wet.getX(i);
    assert.ok(w >= 0 && w <= 1);
    const y = pos.getY(i);
    if (y < -0.25) (low += w), nLow++;
    if (y > 0.25) (high += w), nHigh++;
  }
  assert.ok(low / nLow > 0.6, `base band mean ${low / nLow}`);
  assert.ok(high / nHigh < 0.05, `crown mean ${high / nHigh}`);
});

test('the near build keeps the far silhouette and adds relief: same stream, denser, deeper cracks', () => {
  const far = buildRock(createRng('t/d'), 'seed/d', farOpts());
  const near = buildRock(createRng('t/d'), 'seed/d', nearOpts());
  assert.equal(near.attributes.position.count, 20 * 41 * 41 * 3);
  // the near rock's stats: at least as many crack-line vertices (the fine network adds lines)
  assert.ok(near.userData.rockStats.crackShare >= far.userData.rockStats.crackShare * 0.95, 'the fine cracks lost lines');
  // bounding spheres agree within the relief amplitude (no pop at the swap)
  assert.ok(Math.abs(near.boundingSphere.radius - far.boundingSphere.radius) < 0.06, `radius ${near.boundingSphere.radius} vs ${far.boundingSphere.radius}`);
  // every far vertex has a near vertex within 6 cm (the furrows / ledges are the only drift)
  const np = near.attributes.position;
  const cell = 0.03;
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < np.count; i++) {
    const k = key(np.getX(i), np.getY(i), np.getZ(i));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const fp = far.attributes.position;
  let maxGap = 0;
  for (let i = 0; i < fp.count; i += 11) {
    const x = fp.getX(i);
    const y = fp.getY(i);
    const z = fp.getZ(i);
    let best = Infinity;
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++)
        for (let dz = -2; dz <= 2; dz++) {
          const l = grid.get(`${Math.floor(x / cell) + dx},${Math.floor(y / cell) + dy},${Math.floor(z / cell) + dz}`);
          if (!l) continue;
          for (const j of l) best = Math.min(best, Math.hypot(np.getX(j) - x, np.getY(j) - y, np.getZ(j) - z));
        }
    maxGap = Math.max(maxGap, best);
  }
  assert.ok(maxGap < 0.06, `max near/far gap ${maxGap} m`);
});

test('dressing: cushions flagged aMoss > 1, lichen plates aMoss < 0, counts within the asks, deterministic', () => {
  const near = buildRock(createRng('t/d'), 'seed/d', nearOpts());
  const palette = { mossDeep: new THREE.Color(0x3d5a2a), mossBright: new THREE.Color(0x8fae4a) };
  const opts = { radius: 0.6, minY: -0.35 * 0.6 * 0.64, cushions: 14, lichen: 18, shade: [0.6, -0.8] };
  const a = dressRock(near, createRng('t/dress'), opts, palette);
  const b = dressRock(near, createRng('t/dress'), opts, palette);
  assert.ok(same(arr(a.geometry, 'position'), arr(b.geometry, 'position')), 'dressing not deterministic');
  assert.ok(a.stats.cushions > 0 && a.stats.cushions <= 14, `cushions ${a.stats.cushions}`);
  assert.ok(a.stats.lichen > 0 && a.stats.lichen <= 18, `lichen ${a.stats.lichen}`);
  const base = near.attributes.position.count;
  assert.equal(a.geometry.attributes.position.count, base + a.stats.vertices);
  // the rock's own vertices are untouched; the appended ones carry the flags
  assert.ok(same(arr(a.geometry, 'position').slice(0, base * 3), arr(near, 'position')));
  const moss = a.geometry.attributes.aMoss;
  let pads = 0;
  let plates = 0;
  for (let i = base; i < moss.count; i++) {
    const m = moss.getX(i);
    if (m > 1) pads++;
    else if (m < 0) plates++;
    else assert.fail(`dressing vertex ${i} carries an unflagged aMoss ${m}`);
  }
  // a cushion is 10 crown + 2 × 20 ring triangles, a plate 10 × (1 fan + 2 rim) triangles
  // (round 44: 10 lobed segments, was 8)
  assert.equal(pads, a.stats.cushions * 50 * 3);
  assert.equal(plates, a.stats.lichen * 30 * 3);
  for (const k of ['position', 'normal', 'color', 'aMoss', 'aWet']) assert.ok(a.geometry.attributes[k], `merged geometry lacks ${k}`);
  // front-facing: every dressing triangle's winding normal agrees with its stored vertex normals
  const P = a.geometry.attributes.position;
  const N = a.geometry.attributes.normal;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const vn = new THREE.Vector3();
  let flipped = 0;
  let checked = 0;
  for (let i = base; i < P.count; i += 3) {
    va.fromBufferAttribute(P, i);
    vb.fromBufferAttribute(P, i + 1);
    vc.fromBufferAttribute(P, i + 2);
    vb.sub(va);
    vc.sub(va);
    vb.cross(vc);
    if (vb.lengthSq() < 1e-14) continue;
    vn.fromBufferAttribute(N, i).add(new THREE.Vector3().fromBufferAttribute(N, i + 1)).add(new THREE.Vector3().fromBufferAttribute(N, i + 2));
    checked++;
    if (vb.dot(vn) < 0) flipped++;
  }
  assert.ok(checked > 0);
  assert.equal(flipped, 0, `${flipped} of ${checked} dressing triangles wound back-to-front`);
});

test('mergeRockParts folds fragments under their matrices with transformed normals', () => {
  const base = buildRock(createRng('t/b'), 'seed/b', { radius: 0.3, detail: 2 });
  const frag = buildRock(createRng('t/f'), 'seed/f', { radius: 0.05, detail: 1, cuts: 5 });
  const m = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.2), new THREE.Vector3(1, 1, 1));
  const g = mergeRockParts(base, [{ geometry: frag, matrix: m }, { geometry: frag, matrix: m }]);
  assert.equal(g.attributes.position.count, base.attributes.position.count + 2 * frag.attributes.position.count);
  const i0 = base.attributes.position.count;
  const p = new THREE.Vector3().fromBufferAttribute(frag.attributes.position, 0).applyMatrix4(m);
  const q = new THREE.Vector3().fromBufferAttribute(g.attributes.position, i0);
  assert.ok(p.distanceTo(q) < 1e-6);
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, i0);
  assert.ok(Math.abs(n.length() - 1) < 1e-5);
});
