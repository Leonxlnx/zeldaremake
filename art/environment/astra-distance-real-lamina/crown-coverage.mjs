/** Counterfactual old-crown screen coverage at w19; CPU only, no runtime changes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Reuse the established CPU loader and exact production placement construction.
const checkUrl = new URL('./check.mjs', import.meta.url);
const check = fs.readFileSync(checkUrl, 'utf8');
const end = check.indexOf('const before=build(baseline)');
assert(end > 0, 'Existing CPU loader changed');
const setup = check.slice(0, end).replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', JSON.stringify(checkUrl.href));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const source = await new AsyncFunction('assert', 'crypto', 'fs', 'path', 'cp', 'createRequire', 'fileURLToPath', 'ts', 'T', 'buffers', `${setup}\nreturn build();`)(
  assert, crypto, { ...fs, mkdirSync() {} }, path, cp, createRequire, fileURLToPath, ts, T, buffers,
);
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'native-after/manifest.json')));
const trace = JSON.parse(fs.readFileSync(path.join(folder, 'native-matched-after/trace.json')));
const still = manifest.images['w19-spine-u'];
const warm = trace.passes.find(p => p.name === 'warm').rows[89];
const sha = manifest.sha;
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(cp.execFileSync('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: root, encoding: 'utf8' }).trim(), sha, 'Captured source commit is unavailable');
assert.equal(cp.execFileSync('git', ['diff', sha, '--', 'src'], { cwd: root, encoding: 'utf8' }), '', 'Runtime source differs from the captured source');
assert.equal(manifest.complete, true);
const camera = new T.PerspectiveCamera(still.camera.fov, 1280 / 720, .08, 900);
camera.position.fromArray(still.camera.position);
camera.lookAt(camera.position.clone().add(new T.Vector3().fromArray(still.camera.direction)));
camera.updateMatrixWorld(true);
assert(warm.camera.position.every((v, i) => Math.abs(v - still.camera.position[i]) < 1e-9));
assert(warm.camera.direction.every((v, i) => Math.abs(v - still.camera.direction[i]) < 1e-9));
const viewProjection = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
const assets = source.variants.map((variant, i) => source.d.createDistantCloseCrown(variant, source.createRng(source.WORLD.seed),
  Math.max(1, ...source.placements.filter(p => p.variant === i).map(p => p.scale)), source.WORLD.palette, i));
const atlas = source.load('src/world/trees/leaf-cluster-texture.ts').createFarCrownAtlas(source.createRng(source.WORLD.seed).fork('trees'), source.WORLD.palette).image;
const alpha = uv => {
  const x = uv.x * atlas.width - .5, y = uv.y * atlas.height - .5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const at = (u, v) => atlas.data[(Math.max(0, Math.min(atlas.height - 1, v)) * atlas.width + Math.max(0, Math.min(atlas.width - 1, u))) * 4 + 3] / 255;
  return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
};
function clippedTriangle(points) {
  for (const plane of [p => p.w + p.x, p => p.w - p.x, p => p.w + p.y, p => p.w - p.y, p => p.w + p.z, p => p.w - p.z]) {
    const next = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], da = plane(a), db = plane(b);
      if (da >= 0) next.push(a);
      if ((da >= 0) !== (db >= 0)) next.push(a.clone().lerp(b, da / (da - db)));
    }
    points = next;
  }
  return points.map(p => [(p.x / p.w + 1) / 2, (1 - p.y / p.w) / 2]);
}
assert.equal(clippedTriangle([new T.Vector4(2, 0, 0, 1), new T.Vector4(3, 0, 0, 1), new T.Vector4(2, 1, 0, 1)]).length, 0);
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const meshes = [], rows = [];
for (const [id, placement] of source.placements.entries()) {
  const lod = Math.hypot(placement.x - camera.position.x, placement.z - camera.position.z) < 120 ? 'near' : 'far';
  const old = source.variants[placement.variant][lod], group = old.groups[1];
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', old.attributes.position); geometry.setAttribute('uv', old.attributes.uv);
  geometry.setIndex(new T.BufferAttribute(old.index.array.slice(group.start, group.start + group.count), 1));
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(placement.x, placement.y, placement.z); mesh.rotation.y = placement.yaw; mesh.scale.setScalar(placement.scale); mesh.updateMatrixWorld(true);
  const matrix = new T.Matrix4().multiplyMatrices(viewProjection, mesh.matrixWorld);
  const box = [Infinity, Infinity, -Infinity, -Infinity]; let triangleArea = 0;
  for (let i = 0; i < geometry.index.count; i += 3) {
    const points = clippedTriangle([0, 1, 2].map(k => { const p = new T.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(i + k)); return new T.Vector4(p.x, p.y, p.z, 1).applyMatrix4(matrix); }));
    let twiceArea = 0;
    for (let j = 0; j < points.length; j++) {
      const [x, y] = points[j], [nx, ny] = points[(j + 1) % points.length];
      twiceArea += x * ny - nx * y;
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
    }
    triangleArea += Math.abs(twiceArea) / 2;
  }
  const row = { id, variant: placement.variant, lod, envelopeDistanceM: assets[placement.variant].bounds.distanceToPoint(camera.position.clone().applyMatrix4(mesh.matrixWorld.clone().invert())) * placement.scale,
    clippedScreenBox: Number.isFinite(box[0]) ? box : null, clippedBoxFraction: Number.isFinite(box[0]) ? (box[2] - box[0]) * (box[3] - box[1]) : 0,
    summedClippedTriangleFraction: triangleArea, solidCardSamples: 0, independentAlphaSamples: 0, nearestAlphaSamples: 0, retainedStaticNearestSamples: 0, retainedWarmNearestSamples: 0 };
  rows.push(row); mesh.userData.row = row;
  if (row.clippedBoxFraction > 0) meshes.push(mesh);
}
const states = { static: new Map(still.distantClose.weights), warm: new Map(warm.close.weights) };
const width = 48, height = 27, count = width * height, ray = new T.Raycaster();
let coveredSamples = 0;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  ray.setFromCamera(new T.Vector2((x + .5) / width * 2 - 1, 1 - (y + .5) / height * 2), camera);
  const hits = ray.intersectObjects(meshes, false);
  const solids = new Set(), alphas = new Set();
  let first = false, staticFirst = false, warmFirst = false;
  for (const hit of hits) {
    const row = hit.object.userData.row; solids.add(row);
    if (alpha(hit.uv) < source.d.CROWN_ALPHA_TEST) continue;
    alphas.add(row);
    if (!first) { row.nearestAlphaSamples++; coveredSamples++; first = true; }
    if (!staticFirst && (states.static.get(row.id) ?? 0) < 1) { row.retainedStaticNearestSamples++; staticFirst = true; }
    if (!warmFirst && (states.warm.get(row.id) ?? 0) < 1) { row.retainedWarmNearestSamples++; warmFirst = true; }
  }
  for (const row of solids) row.solidCardSamples++;
  for (const row of alphas) row.independentAlphaSamples++;
}
for (const row of rows) {
  row.solidCardUnionFractionEstimate = row.solidCardSamples / count;
  row.independentAlphaFractionEstimate = row.independentAlphaSamples / count;
  row.nearestAlphaFractionEstimate = row.nearestAlphaSamples / count;
  row.behindOtherAlphaFraction = row.independentAlphaSamples ? 1 - row.nearestAlphaSamples / row.independentAlphaSamples : null;
  row.staticWeight = states.static.get(row.id) ?? 0; row.warmWeight = states.warm.get(row.id) ?? 0;
}
const priority = [...rows].sort((a, b) => b.independentAlphaSamples - a.independentAlphaSamples || a.id - b.id);
const statesSummary = Object.fromEntries(Object.entries(states).map(([name, weights]) => {
  const selected = rows.filter(row => weights.has(row.id));
  return [name, { selectedIds: [...weights.keys()], selectedNearestAlphaSamples: selected.reduce((n, row) => n + row.nearestAlphaSamples, 0),
    selectedNearestShareOfCoveredGrid: selected.reduce((n, row) => n + row.nearestAlphaSamples, 0) / coveredSamples,
    selectedWithZeroProjectedOldCardArea: selected.filter(row => row.summedClippedTriangleFraction === 0).map(row => row.id),
    selectedWithZeroAlphaGridHits: selected.filter(row => row.independentAlphaSamples === 0).map(row => row.id) }];
}));
const requested = new Set([...states.static.keys(), ...states.warm.keys(), 48, 49]);
const result = { source: sha, scriptSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))), loaderSha256: hash(check), bundleSha256: manifest.bundleSha256,
  imageSha256: still.sha256, camera: still.camera, staticTime: still.stats.simTime, warmTime: warm.stats.simTime,
  grid: { width, height, samples: count, coveredSamples, projectedCrowns: meshes.length }, states: statesSummary,
  requested: rows.filter(row => requested.has(row.id)).map(row => ({ ...row, independentAlphaRank: priority.indexOf(row) + 1 })),
  coverageRanking: priority.filter(row => row.independentAlphaSamples > 0),
  limitations: [
    'Counterfactual old fallback cards for every tree, using its actual distance-selected near/far LOD. This does not measure replacement-lamina visibility or actual slot utilization.',
    'Clipped screen boxes are upper bounds; summed triangle areas overlap. Solid-card union and alpha coverage are coarse grid estimates, not exact areas.',
    'The 48x27 grid samples every26.7pixels. A zero grid count may miss thin coverage; only zero clipped triangle area establishes old-geometry offscreen status.',
    'Nearest alpha>=0.3 is a depth-order proxy. Transparent crown fragments can blend, so farther crowns may still contribute.',
    'No wind, mip selection, new close-lamina occlusion, wood or other-world occlusion. Retained-old samples omit full-weight old crowns but do not add their replacements.',
    'Static12.6s and warmed15.6s states are read from existing evidence; the CPU geometry is undeformed for both.',
  ] };
fs.writeFileSync(path.join(folder, 'crown-coverage.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ grid: result.grid, states: result.states, requested: result.requested.map(r => ({ id: r.id, distance: r.envelopeDistanceM, box: r.clippedBoxFraction, solid: r.solidCardSamples, alpha: r.independentAlphaSamples, nearest: r.nearestAlphaSamples, alphaRank: r.independentAlphaRank, static: r.staticWeight, warm: r.warmWeight })) }, null, 2));
