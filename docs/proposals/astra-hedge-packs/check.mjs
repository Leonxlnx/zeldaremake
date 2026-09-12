/** Reproduce the proposed pack-only change from a pinned commit, entirely in memory. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const baseline = '18e19331fb0571daf336b17debc9f146f9fc8cfc';
const file = 'src/world/vegetation/plants.ts';
const line = '  hedge: [SINGLE(3), ALL(3), ALL(3)],';
const context = 'const PACKS: Record<string, PackLayout> = {';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const sources = new Map();
function readSource(f) {
  if (!sources.has(f)) sources.set(f, execFileSync('git', ['show', `${baseline}:${f}`], { cwd: root, encoding: 'utf8' }));
  return sources.get(f);
}
const patch = fs.readFileSync(path.join(here, 'plants.patch'), 'utf8');
assert.equal(patch, `--- a/src/world/vegetation/plants.ts\n+++ b/src/world/vegetation/plants.ts\n@@ -130,6 +130,7 @@\n const SINGLE = (n: number): number[][] => Array.from({ length: n }, (_, v) => [v]);\n const ALL = (n: number): number[][] => [Array.from({ length: n }, (_, v) => v)];\n const PACKS: Record<string, PackLayout> = {\n+  hedge: [SINGLE(3), ALL(3), ALL(3)],\n   // 965 clumps of the biggest geometry: near / mid LODs one draw per variant, far LOD in pairs\n   ferns: [SINGLE(4), SINGLE(4), [[0, 1], [2, 3]]],\n   // the two heads and the two spikes pair up near, everything shares the mid / far draws\n`);
const original = readSource(file);
assert.equal(original.split(context).length, 2, 'Exactly one target PACKS table');
const candidate = original.replace(context, `${context}\n${line}`);
assert.equal(sha(original), 'f0137146342984bb2c2ea1cd1cb03418d5e72e21dfe39a437d87ad2a6d7d88af');
assert.equal(sha(candidate), '01e9d64c4aa67c1a7318d35e478db15a876f33476293c0384bbf954e0f0ffc82');

function modules(proposed) {
  const cache = new Map();
  function load(f) {
    f = path.posix.normalize(f);
    if (cache.has(f)) return cache.get(f).exports;
    const m = { exports: {} };
    cache.set(f, m);
    const src = proposed && f === file ? candidate : readSource(f);
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', js)(id => {
      if (id === 'three') return T;
      return load(path.posix.join(path.posix.dirname(f), id + '.ts'));
    }, m, m.exports);
    return m.exports;
  }
  return load;
}
function build(proposed) {
  const load = modules(proposed), read = n => load(`src/world/${n}.ts`);
  const { WORLD } = read('config'), { LAYOUT } = read('layout'), { VegField } = read('vegetation/field');
  const ctx = {
    config: WORLD, layout: LAYOUT, terrain: read('terrain/heightfield').createTerrain(),
    rng: read('util/prng').createRng(WORLD.seed), wind: read('wind/wind').createWind(),
    quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1.5 },
  };
  const plants = read('vegetation/plants').buildPlants(ctx, new VegField(ctx, WORLD.detailRadius + 6, .5), new T.Group());
  return { plants, rootRngTail: Array.from({ length: 8 }, () => ctx.rng()) };
}
const oldBuild = build(false), newBuild = build(true);
const a = oldBuild.plants, b = newBuild.plants;
assert.deepEqual(oldBuild.rootRngTail, newBuild.rootRngTail, 'World RNG continuation unchanged');
assert.equal(a.all.length, 13);
assert.equal(a.hedge.items.length, 12);
for (let i = 0; i < a.all.length; i++) {
  const old = a.all[i], cur = b.all[i];
  assert.deepEqual(old.items, cur.items, 'Every seeded placement/variant/tint unchanged');
  assert.deepEqual(old.opts.lodDistances, cur.opts.lodDistances);
  assert.equal(old.opts.castShadowLods, cur.opts.castShadowLods);
  assert.equal(old.opts.material.customProgramCacheKey(), cur.opts.material.customProgramCacheKey());
  for (let v = 0; v < old.opts.variants.length; v++) for (let l = 0; l < old.lodCount; l++) {
    const g0 = old.opts.variants[v][l], g1 = cur.opts.variants[v][l];
    for (const name of Object.keys(g0.attributes)) assert.deepEqual(g0.attributes[name].array, g1.attributes[name].array);
    assert.deepEqual(g0.index.array, g1.index.array);
  }
  if (old !== a.hedge) assert.deepEqual(old.packLayout, cur.packLayout);
}
assert.deepEqual(b.hedge.packLayout, [[[0], [1], [2]], [[0, 1, 2]], [[0, 1, 2]]]);
for (const set of [a.hedge, b.hedge]) for (const mesh of set.group.children) {
  assert.equal(mesh.material, set.opts.material);
  if (mesh.castShadow) {
    assert.equal(mesh.customDepthMaterial, set.opts.shadowMaterials.depth);
    assert.equal(mesh.customDistanceMaterial, set.opts.shadowMaterials.distance);
  }
}
// Exact positions from 18e1933's 2026-09-12_132454477 A–F capture metadata.
// Only position is needed: LodInstancedSet chooses LOD by horizontal camera/root distance.
const savedCameras = [
  ['A_stairs', [0.4, 1.8, 8.6]],
  ['B_house', [0, 1.5, 2]],
  ['C_lookback', [2.33, 1.45, -7.67]],
  ['D_log', [0.2, 1.45, -3]],
  ['E_ground', [0, 1.5, 2]],
  ['F_canopy', [-1.96, 1.8, 4]],
];
function identity(set) {
  const rows = [];
  for (let l = 0; l < set.lodCount; l++) for (let p = 0; p < set.packLayout[l].length; p++) {
    const pack = set.packLayout[l][p];
    const mesh = set.group.children.find(m => m.name === `${set.opts.name}-lod${l}-p${p}-v${pack.join('')}`);
    for (let i = 0; i < mesh.count; i++) {
      const variant = pack[mesh.geometry.attributes.aPlantVariant.getX(i)];
      rows.push({ lod: l, variant,
        matrix: [...mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16)],
        color: [...mesh.instanceColor.array.slice(i * 3, i * 3 + 3)],
      });
    }
  }
  return rows.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
}
const cameras = [];
for (const [viewpoint, camera] of savedCameras) {
  const pos = new T.Vector3(...camera);
  a.hedge.update(pos, true); b.hedge.update(pos, true);
  assert.deepEqual(identity(a.hedge), identity(b.hedge));
  const old = a.hedge.stats(), cur = b.hedge.stats();
  assert.deepEqual(old, { drawCalls: 2, triangles: 299808 });
  assert.deepEqual(cur, { drawCalls: 6, triangles: 97160 });
  const lodPopulation = identity(b.hedge).reduce((r, p) => (r[p.lod]++, r), [0, 0, 0]);
  assert.deepEqual(lodPopulation, [12, 0, 0]);
  cameras.push({ viewpoint, camera, old, new: cur,
    triangleSavings: old.triangles - cur.triangles, drawDelta: cur.drawCalls - old.drawCalls, lodPopulation,
  });
}
for (const pos of [new T.Vector3(30, 1, 30), new T.Vector3(60, 1, 60), new T.Vector3(0, 1, 0)]) {
  a.hedge.update(pos, true); b.hedge.update(pos, true);
  assert.deepEqual(identity(a.hedge), identity(b.hedge));
}
const out = {
  status: 'proposed-not-integrated', baseline, proposedFile: file, oneLine: line.trim(),
  baselineSha256: sha(original), candidateSha256: sha(candidate), patchSha256: sha(patch),
  scope: 'CPU in-memory patch. stats() estimates before frustum culling with one sun-shadow pass; real GPU capture remains required.',
  allPlantSetsCompared: a.all.length, hedges: a.hedge.items.length,
  allSourceGeometryExact: true, allPlacementsExact: true, worldRngContinuationExact: true,
  activeLodVariantMatrixColorExact: true, materialShaderCacheKeysExact: true,
  shadowBindingsPreserved: true, midFarPacksExact: true,
  budgetEstimate: {
    observed18eBEFrameTriangles: 9016050, pendingRopeEstimate: 54000, predictedSavings: 202648,
    predictedTotalBeforeOtherPendingChanges: 8867402, headroomUnder9000000: 132598,
    observedMaxDraws: 646, hedgeDrawDelta: 4, pendingSignDrawDelta: 2,
    predictedDrawsBeforeOtherPendingChanges: 652,
    warning: 'Conditional arithmetic using observed baseline and an approximate rope delta; not a GPU pass or a prediction for future Fable geometry.',
  },
  cameras,
};
const target = path.join(root, 'gauntlet/tmp/hedge-pack-review/reproduced-evidence.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, candidateSha256: out.candidateSha256,
  cameras: cameras.length, triangleSavingsPerView: 202648, drawDeltaPerView: 4,
  evidence: path.relative(root, target) }, null, 2));
