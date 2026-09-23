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

test('crackWarp (fable-2): explicit 0 builds the far rock byte-identically; on, the crack lines move to other vertices at the same density', () => {
  const far = buildRock(createRng('t/d'), 'seed/d', farOpts());
  const farExplicit = buildRock(createRng('t/d'), 'seed/d', { ...farOpts(), crackWarp: 0 });
  for (const k of ['position', 'normal', 'color', 'aMoss']) assert.ok(same(arr(far, k), arr(farExplicit, k)), `${k} moved with crackWarp 0`);
  // the near build, same topology: with the warp on the network is re-drawn — the crack share
  // (vertices on a line, the audit's `crackShare`) stays within a fifth of itself, while the set
  // of vertices on a line changes substantially (the lattice cells no longer sit on the nodes)
  // (bare stone: no moss, no partings, no facet or dirt darkening, so a dark vertex is a crack line)
  const bare = { ...nearOpts(), moss: 0, mossThickness: 0, strata: 0, cutDark: 0, dirt: 0 };
  const plain = buildRock(createRng('t/d'), 'seed/d', bare);
  const warped = buildRock(createRng('t/d'), 'seed/d', { ...bare, crackWarp: 1 });
  const sp = plain.userData.rockStats.crackShare, sw = warped.userData.rockStats.crackShare;
  assert.ok(sp > 0.05, `crack share ${sp}`);
  assert.ok(Math.abs(sw - sp) < 0.2 * sp, `crack share moved ${sp} → ${sw}`);
  // line vertices: the bare lit skin sits at ≈ 0.76 in the vertex colour, a full line at ≈ 0.46–0.52 (cracks 0.55 blends the line half-way to the dark) — count where one build is on a line and the other is not
  const P = plain.attributes.color, W = warped.attributes.color;
  const lum = (a, i) => 0.2126 * a.getX(i) + 0.7152 * a.getY(i) + 0.0722 * a.getZ(i);
  let onP = 0, onW = 0, both = 0;
  const Y = plain.attributes.position;
  for (let i = 0; i < P.count; i++) {
    if (Y.getY(i) < 0.05) continue; // above the contact collar, which is dark on both
    const p = lum(P, i) < 0.62, w = lum(W, i) < 0.62;
    if (p) onP++;
    if (w) onW++;
    if (p && w) both++;
  }
  assert.ok(onP > 200 && onW > 200, `dark line vertices ${onP} / ${onW}`);
  assert.ok(both < 0.6 * Math.min(onP, onW), `the lines did not move: ${both} of ${onP} / ${onW} shared`);
  // the silhouette is untouched where no line runs: positions differ only by the furrow depths
  const a = plain.attributes.position, b = warped.attributes.position;
  let maxMove = 0;
  for (let i = 0; i < a.count; i++) maxMove = Math.max(maxMove, Math.hypot(a.getX(i) - b.getX(i), a.getY(i) - b.getY(i), a.getZ(i) - b.getZ(i)));
  assert.ok(maxMove < 0.6 * (0.045 + 0.015) + 1e-6, `a vertex moved ${maxMove} m, more than the furrows' depth`);
});

test('strataCrown (fable-2): the near build has no parting pit on the crown; the far build is byte-identical at the default', () => {
  const far = buildRock(createRng('t/d'), 'seed/d', farOpts());
  const farExplicit = buildRock(createRng('t/d'), 'seed/d', { ...farOpts(), strataCrown: 1 });
  for (const k of ['position', 'normal', 'color', 'aMoss']) assert.ok(same(arr(far, k), arr(farExplicit, k)), `${k} moved with strataCrown 1`);
  // same topology, so the two near builds compare per vertex: over the crown (local y above
  // 0.35 r·squash, i.e. the moss cap) the damped build must only ever LIFT vertices (the parting
  // groove fills in — by ≈ 3.5 cm where it crossed the cap), and below the shoulders (y < 0) it
  // must not move them at all (the bedding lines on the sides are kept)
  const undamped = buildRock(createRng('t/d'), 'seed/d', { ...nearOpts(), moss: 0, mossThickness: 0 });
  const damped = buildRock(createRng('t/d'), 'seed/d', { ...nearOpts(), moss: 0, mossThickness: 0, strataCrown: 0.1 });
  const U = undamped.attributes.position;
  const D = damped.attributes.position;
  assert.equal(U.count, D.count);
  let lifted = 0;
  let maxLift = 0;
  let sunk = 0;
  let sideMoved = 0;
  for (let i = 0; i < U.count; i++) {
    const ru = Math.hypot(U.getX(i), U.getY(i) / 0.64, U.getZ(i));
    const rd = Math.hypot(D.getX(i), D.getY(i) / 0.64, D.getZ(i));
    const dy = U.getY(i);
    if (dy > 0.35 * 0.6 * 0.64) {
      if (rd > ru + 0.005) lifted++;
      if (rd < ru - 0.002) sunk++;
      maxLift = Math.max(maxLift, rd - ru);
    } else if (dy < -0.1 * 0.6) {
      // (the damping ramps in from −0.1 r; below it nothing may move)
      if (Math.abs(rd - ru) > 1e-6) sideMoved++;
    }
  }
  assert.ok(lifted > 50, `only ${lifted} crown vertices lifted — the parting groove no longer crosses the cap`);
  assert.ok(maxLift > 0.02 && maxLift < 0.06, `max crown lift ${maxLift} m (expected ≈ 3–4 cm)`);
  // (a handful may sink: a lifted vertex can newly cross a cleave plane and be projected onto it)
  assert.ok(sunk < 20, `${sunk} crown vertices sank with the groove damped`);
  assert.equal(sideMoved, 0, `${sideMoved} vertices below the shoulders moved`);
});

test('mossSwellSmooth (fable-2): default off is byte-identical; on, the moss blanket has no crack-line steps', () => {
  /** the stair-foot rock's options (index.ts): a 0.9 shaded-side blanket, 12 cm thick */
  const stairFoot = () => ({ ...farOpts(), radius: 1, cutDepth: [0.82, 0.94], cutToward: undefined, cutDark: 0.3, facetBare: 0.5, squashY: 0.74, moss: 1.0, strata: 0, mossThickness: 0.12, mossSide: 0.9, tint: new THREE.Color(0.72, 0.72, 0.71) });
  const plain = buildRock(createRng('t/s'), 'seed/s', stairFoot());
  const explicit = buildRock(createRng('t/s'), 'seed/s', { ...stairFoot(), mossSwellSmooth: false });
  for (const k of ['position', 'normal', 'color', 'aMoss']) assert.ok(same(arr(plain, k), arr(explicit, k)), `${k} moved with mossSwellSmooth false`);
  // step metric: over the blanket (both ends aMoss > 0.4) a triangle edge that is a radial CLIFF
  // — its two vertices differ by ≥ 3 cm in radius and that difference is ≥ 70 % of the edge's
  // length — is a slab edge. The stepped near skin has hundreds; the smooth swell must cut them
  // by more than half.
  const cliffs = (g) => {
    const P = g.attributes.position;
    const M = g.attributes.aMoss;
    let n = 0;
    for (let i = 0; i < P.count; i += 3) {
      for (let e = 0; e < 3; e++) {
        const a = i + e;
        const b = i + ((e + 1) % 3);
        if (M.getX(a) < 0.4 || M.getX(b) < 0.4) continue;
        const dr = Math.abs(Math.hypot(P.getX(a), P.getY(a) / 0.74, P.getZ(a)) - Math.hypot(P.getX(b), P.getY(b) / 0.74, P.getZ(b)));
        if (dr < 0.03) continue;
        const len = Math.hypot(P.getX(a) - P.getX(b), P.getY(a) - P.getY(b), P.getZ(a) - P.getZ(b));
        if (dr > 0.7 * len) n++;
      }
    }
    return n;
  };
  const stepped = buildRock(createRng('t/s'), 'seed/s', { ...stairFoot(), detail: 40, crackDepth: 0.03, fineCracks: 0.6, fineCrackDepth: 0.012, micro: 0.025, plates: 0.0075, rimRound: 0.09 });
  const smooth = buildRock(createRng('t/s'), 'seed/s', { ...stairFoot(), detail: 40, crackDepth: 0.03, fineCracks: 0.6, fineCrackDepth: 0.012, micro: 0.025, plates: 0.0075, rimRound: 0.09, mossSwellSmooth: true });
  const before = cliffs(stepped);
  const after = cliffs(smooth);
  assert.ok(before > 200, `stepped blanket has ${before} slab-edge vertices — the regression no longer reproduces`);
  assert.ok(after < before * 0.5, `smooth blanket still has ${after} slab-edge vertices (stepped ${before})`);
});

test('aLichen (fable-2): off by default; with `lichen` + `plates` a 0..1 crust field on the bare upper skin only', () => {
  const plain = buildRock(createRng('t/d'), 'seed/d', nearOpts());
  assert.equal(plain.attributes.aLichen, undefined, 'lichen 0 must not add the attribute');
  const g = buildRock(createRng('t/d'), 'seed/d', { ...nearOpts(), plates: 0.025, rimRound: 0.08, lichen: 0.6 });
  // the crust is colour/attribute only: the shape is the same rock
  for (const k of ['position', 'normal']) assert.ok(same(arr(g, k), arr(buildRock(createRng('t/d'), 'seed/d', { ...nearOpts(), plates: 0.025, rimRound: 0.08 }), k)), `${k} moved with lichen on`);
  const li = g.attributes.aLichen;
  const moss = g.attributes.aMoss;
  const pos = g.attributes.position;
  assert.ok(li, 'aLichen missing');
  let crust = 0;
  let onMoss = 0;
  let inCollar = 0;
  for (let i = 0; i < li.count; i++) {
    const v = li.getX(i);
    assert.ok(v >= 0 && v <= 1, `aLichen ${v} out of range`);
    if (v > 0.5) {
      crust++;
      if (moss.getX(i) > 0.5) onMoss++;
      if (pos.getY(i) < -0.6 * 0.64 * 0.7) inCollar++;
    }
  }
  const share = crust / li.count;
  assert.ok(share > 0.04 && share < 0.5, `crust share ${share}`);
  assert.equal(onMoss, 0, `${onMoss} crust vertices under the moss cap`);
  assert.equal(inCollar, 0, `${inCollar} crust vertices in the collar`);
  assert.ok(Math.abs(g.userData.rockStats.lichenShare - share) < 1e-9);
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
  // fable-2 (the "black holes"): cushion vertex colours must be pale — three multiplies vColor
  // into the moss-coloured diffuse, and the palette greens (linear ≈ 0.05) made every pad black
  const col = a.geometry.attributes.color;
  for (let i = base; i < moss.count; i++) {
    if (moss.getX(i) <= 1) continue;
    const lum = 0.299 * col.getX(i) + 0.587 * col.getY(i) + 0.114 * col.getZ(i);
    assert.ok(lum > 0.75, `cushion vertex ${i} colour luminance ${lum} — pads render black under the moss path`);
  }
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
