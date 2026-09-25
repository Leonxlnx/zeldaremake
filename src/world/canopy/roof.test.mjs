// Canopy roof placement contract (owner-fable): deterministic, above head height, out of the six
// hero frames, off every god-ray column. Run: node src/world/canopy/roof.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map();
/** transpile a TS module (and its relative imports) to CommonJS in memory; `three` is the real one */
function load(file) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs).exports;
  const module = { exports: {} };
  cache.set(abs, module);
  const src = readFileSync(abs, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = (id) => {
    if (id === 'three') return THREE;
    if (!id.startsWith('.')) throw new Error(`unexpected import ${id} from ${abs}`);
    const base = path.resolve(path.dirname(abs), id);
    return load(base.endsWith('.ts') ? base : `${base}.ts`);
  };
  new Function('require', 'module', 'exports', out)(req, module, module.exports);
  return module.exports;
}

const { buildRoof, HERO_DROP_M, HERO_DROP_STAND_M, HERO_TOP_KEEP, ROOF_MIN_ABOVE_GROUND_M } = load(path.join(here, 'roof.ts'));
const { createRng } = load(path.join(here, '../util/prng.ts'));
const { LAYOUT } = load(path.join(here, '../layout.ts'));
const { SHAFT_COLUMNS } = load(path.join(here, '../trees/corridors.ts'));
const { WORLD } = load(path.join(here, '../config.ts'));

// a flat world at y = 0 except the east plateau (the roof's minimum height is measured above it)
const terrain = { height: (x, z) => (x > 14 && z < 2 && z > -30 ? 5.4 : 0), normal: () => new THREE.Vector3(0, 1, 0), mask: () => ({}) };
const ctx = { layout: LAYOUT, terrain, config: WORLD, quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1 } };
const sunDir = new THREE.Vector3(-0.62, 0.62, 0.48).normalize();
const opts = { sunDir, density: 1, sectors: 6 };

const a = buildRoof(ctx, createRng('test/canopy-roof'), opts);
const b = buildRoof(ctx, createRng('test/canopy-roof'), opts);
assert.ok(a.clumps.length > 150, `enough clumps to read as a roof (${a.clumps.length})`);
assert.deepEqual(
  a.clumps.map((c) => [c.x, c.y, c.z, c.cards]),
  b.clumps.map((c) => [c.x, c.y, c.z, c.cards]),
  'same seed → same clumps',
);
assert.equal(a.cards, b.cards);
for (const s of a.sectors) assert.ok(s.geometry.getAttribute('position').count === s.cards * 4, 'four vertices a card');

// the north-stand pass: with it off the build is the plaza roof exactly as before the pass existed —
// the same clumps in the same order, and the six plaza sectors' buffers byte-identical
const noStand = buildRoof(ctx, createRng('test/canopy-roof'), { ...opts, stand: false });
const plaza = a.clumps.filter((c) => !c.stand);
assert.equal(noStand.stand.clumps, 0);
assert.deepEqual(
  plaza.map((c) => [c.x, c.y, c.z, c.cards]),
  noStand.clumps.map((c) => [c.x, c.y, c.z, c.cards]),
  'the stand pass leaves the plaza clumps untouched',
);
const plazaSectors = a.sectors.filter((s) => !s.stand);
assert.equal(plazaSectors.length, noStand.sectors.length, 'same plaza sector count');
for (let i = 0; i < plazaSectors.length; i++) {
  for (const attr of ['position', 'normal', 'uv', 'color', 'aRoot']) {
    assert.deepEqual([...plazaSectors[i].geometry.getAttribute(attr).array], [...noStand.sectors[i].geometry.getAttribute(attr).array], `plaza sector ${i} ${attr} byte-identical with the stand pass on`);
  }
}
assert.ok(a.stand.clumps > 40, `the stand pass builds a roof over the north stand (${a.stand.clumps} clumps)`);
assert.equal(a.sectors.filter((s) => s.stand).length, 1, 'the stand draws in exactly one sector of its own');

// height: never inside a walker's reach, on the plateau included
for (const c of a.clumps) assert.ok(c.y - terrain.height(c.x, c.z) >= ROOF_MIN_ABOVE_GROUND_M - 1e-6, `clump at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) is ${(c.y - terrain.height(c.x, c.z)).toFixed(1)} m up`);

// hero frames: an independent pinhole projection finds no clump centre inside any frame within
// HERO_DROP_M, below the top band the canopy is allowed to close over (HERO_TOP_KEEP)
const cams = LAYOUT.viewpoints.map((v) => {
  const pos = new THREE.Vector3(...v.position);
  const cam = new THREE.PerspectiveCamera(v.fov, 16 / 9, 0.1, 500);
  cam.position.copy(pos);
  cam.lookAt(new THREE.Vector3(...v.target));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return { cam, pos, id: v.id };
});
const ndc = new THREE.Vector3();
let inside = 0;
for (const c of a.clumps) {
  for (const { cam, pos, id } of cams) {
    const d = pos.distanceTo(new THREE.Vector3(c.x, c.y, c.z));
    // a stand clump (north-stand pass) has its own, shorter drop distance
    if (d > (c.stand ? HERO_DROP_STAND_M : HERO_DROP_M)) continue;
    ndc.set(c.x, c.y, c.z).project(cam);
    const behind = ndc.z > 1 || new THREE.Vector3(c.x, c.y, c.z).sub(pos).dot(cam.getWorldDirection(new THREE.Vector3())) <= 0;
    // HERO_TOP_KEEP: the canopy is allowed to close over a frame's top edge — that band is the only
    // part of a hero frame a 20-37 m roof can reach, our frames already carry foliage along it and so
    // does the reference, and excluding it left the airspace over the northern approach unroofed.
    // Below the band the exclusion is as it was: nothing of the roof may stand in the frame's body.
    const fromTop = (1 - ndc.y) / 2;
    if (!behind && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && fromTop > HERO_TOP_KEEP) {
      inside++;
      console.error(`clump (${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}) projects into ${id} at ${d.toFixed(0)} m, ${(100 * fromTop).toFixed(0)} % down the frame`);
    }
  }
}
assert.equal(inside, 0, 'no clump centre below the kept top band inside a hero frame within the drop distance');

// god-ray columns: no clump centre within a column's carve radius of its sun line
const tmp = new THREE.Vector3();
for (const c of a.clumps) {
  for (const col of SHAFT_COLUMNS) {
    tmp.set(c.x - col.point[0], c.y - col.point[1], c.z - col.point[2]);
    tmp.addScaledVector(sunDir, -tmp.dot(sunDir));
    assert.ok(tmp.length() >= (col.carve ?? col.radius), `clump (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) sits in the shaft column at ${col.point}`);
  }
}

console.log(`canopy roof: ${a.clumps.length} clumps, ${a.cards} cards, ${a.triangles} tris, ${a.sectors.length} sectors; dropped ${JSON.stringify(a.dropped)}; min above ground ${a.minAboveGround.toFixed(1)} m — ok`);
