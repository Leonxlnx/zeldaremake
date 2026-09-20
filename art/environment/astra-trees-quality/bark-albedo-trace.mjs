/** Read-only CPU albedo trace. Run from the repo root; no renderer or output files are created. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import sharp from 'sharp';

// Reuse the existing CPU probe's loader, profile extraction, deterministic geometry setup
// and shader-noise transcription. Stop before its sampling loop and filesystem writes.
const setupSource = readFileSync('art/environment/astra-trees-quality/moss-mask-probe.mjs', 'utf8');
assert.equal(setupSource.split('const results=[];').length, 2, 'probe setup boundary');
const setup = setupSource.split('const results=[];')[0].replace(/^import .*;\r?$/gm, '');
const { createGiantTree, terrain, rng, profiles, LAYOUT, WORLD, field, noise, sunDir, poses, ss, mix, clamp, loadTs } =
  new Function('readFileSync', 'existsSync', 'path', 'ts', 'THREE', 'BufferGeometryUtils', setup +
    '\nreturn {createGiantTree,terrain,rng,profiles,LAYOUT,WORLD,field,noise,sunDir,poses,ss,mix,clamp,loadTs};')
    (readFileSync, existsSync, path, ts, THREE, BufferGeometryUtils);
const { BARK_DETAIL_M, BARK_TOUCH_M, BARK_DETAIL_TILES, BARK_TOUCH_TILES, NEAR_BASE_FLOOR } = loadTs('src/world/trees/materials.ts');
const source = readFileSync('src/world/trees/materials.ts', 'utf8');
const mean = Number(source.match(/const BARK_DETAIL_MEAN = ([\d.]+);/)?.[1]);
assert.ok(Number.isFinite(mean));
const { data, info } = await sharp('public/textures/tree_bark_03/2k/color.jpg').toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(info.channels, 3);
const linear = Array.from({ length: 256 }, (_, i) => new THREE.Color().setRGB(i / 255, 0, 0, THREE.SRGBColorSpace).r);
const wrap = (i, n) => (i % n + n) % n;
const sample = ([u, v]) => {
  // RepeatWrapping, identity UV transform and Texture.flipY=true. Decode before filtering.
  const x = (u - Math.floor(u)) * info.width - 0.5, y = (1 - (v - Math.floor(v))) * info.height - 0.5;
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const texel = (px, py, c) => linear[data[(wrap(py, info.height) * info.width + wrap(px, info.width)) * 3 + c]];
  return [0, 1, 2].map(c => mix(mix(texel(ix, iy, c), texel(ix + 1, iy, c), fx), mix(texel(ix, iy + 1, c), texel(ix + 1, iy + 1, c), fx), fy));
};
const lum = rgb => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
const mul = (a, b) => a.map((x, i) => x * b[i]), scale = (a, b) => a.map(x => x * b);
const vmix = (a, b, t) => a.map((x, i) => mix(x, b[i], t));
const tint = new THREE.Color(0x9b7e62).toArray();
assert.ok(source.includes('color: new Color(0x9b7e62)'), 'giant material tint unchanged');
const sky = new THREE.Color(WORLD.sky.hemiSky).toArray(), ground = new THREE.Color(WORLD.sky.hemiGround).toArray();
const ambient = sky.map((x, i) => (x + ground[i]) * 0.5 * WORLD.sky.hemiIntensity);
const leaf = new THREE.Color(WORLD.palette.leafSun).toArray();
const canopy = leaf.map(x => mix(1, x / lum(leaf), NEAR_BASE_FLOOR.canopy));
const floorAlbedo = (rgb, texture) => rgb.map(x => mix(NEAR_BASE_FLOOR.albedo, x, texture));
const floorLight = (rgb, texture) => scale(mul(mul(floorAlbedo(rgb, texture), ambient), canopy), NEAR_BASE_FLOOR.lift / Math.PI);
const reports = [];

for (const [id, poseId] of [['lantern-tree', 'sn-bole-lantern-tree'], ['north-west-near', 'sn-bole-nw-near'], ['stair-bank-giant', 'sn-bole-stair-bank']]) {
  const def = LAYOUT.giantTrees.find(d => d.id === id), [x, , z] = def.position, y = terrain.height(x, z);
  const origin = new THREE.Vector3(x, y, z);
  const heroDistance = Math.min(...LAYOUT.viewpoints.map(v => {
    const fx = v.target[0] - v.position[0], fz = v.target[2] - v.position[2];
    const dx = x - v.position[0], dz = z - v.position[2], d = Math.hypot(dx, dz);
    return fx * dx + fz * dz >= 0.5 * Math.hypot(fx, fz) * d ? d : Infinity;
  }));
  // Match the production bole/root inputs, including the plaza-facing trunk lean. Crown
  // boughs/corridors and plant colours are irrelevant to these wood triangles.
  const asset = createGiantTree(def, rng, {
    groundAt: (u, v) => terrain.height(x + u, z + v) - y, palette: WORLD.palette,
    profile: profiles[id], towardPlaza: new THREE.Vector3(-x, 0, -z).normalize(), heroDistance,
    sunDir, pathAt: (u, v) => terrain.mask(x + u, z + v).path,
  });
  const geo = asset.nearBase, attrs = geo.attributes, pose = poses[poseId];
  const camera = new THREE.PerspectiveCamera(pose.fov, 16 / 9, 0.1, 400);
  camera.position.fromArray(pose.p); camera.lookAt(new THREE.Vector3(...pose.t)); camera.updateMatrixWorld();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.position.copy(origin); mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(), samples = [], vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let hits = 0, cushionHits = 0;
  for (let py = 220; py <= 620; py += 50) for (let px = 340; px <= 940; px += 50) {
    ray.setFromCamera(new THREE.Vector2(px / 1280 * 2 - 1, 1 - py / 720 * 2), camera);
    const hit = ray.intersectObject(mesh, false)[0]; if (!hit) continue; hits++;
    const ids = [hit.face.a, hit.face.b, hit.face.c], roots = ids.map(k => attrs.aRoot.getW(k));
    if (roots.some(w => w >= 0.5)) continue;
    if (roots.some(w => w < -0.47 && w > -0.5)) { cushionHits++; continue; }
    ids.forEach((k, i) => vertices[i].fromBufferAttribute(attrs.position, k));
    const bary = THREE.Triangle.getBarycoord(hit.point.clone().sub(origin), ...vertices, new THREE.Vector3()).toArray();
    const interpolate = (attr, n) => Array.from({ length: n }, (_, c) => ids.reduce((s, k, j) => s + attr.array[k * attr.itemSize + c] * bary[j], 0));
    const color = interpolate(attrs.color, 3), uv = interpolate(attrs.uv, 2);
    const mask = ids.reduce((s, k, j) => {
      const w = attrs.aRoot.getW(k);
      return s + bary[j] * (w < 0 && w > -0.5 ? Math.min(1, -w / 0.45) : w <= -1 && w > -1.5 ? (-w - 1) / 0.45 : 0);
    }, 0);
    const ao = ids.reduce((s, k, j) => {
      const occ = -Math.min(attrs.aWind.getZ(k), 0);
      return s + bary[j] * (occ > 0 ? (1 - (occ - 0.25) / 0.75) * 1.45 : 1);
    }, 0);
    const map = sample(uv), tintedMap = mul(map, tint), bare = mul(tintedMap, color);
    const near = 1 - ss(...BARK_DETAIL_M, hit.distance), touch = 1 - ss(...BARK_TOUCH_M, hit.distance);
    const fineFactor = mix(1, mix(1, clamp(lum(sample(uv.map((v, i) => v * BARK_DETAIL_TILES + [0.37, 0.61][i]))) / mean, 0.55, 1.7), 0.7), near);
    const touchFactor = mix(1, clamp(lum(sample(uv.map((v, i) => v * BARK_TOUCH_TILES + [0.13, 0.29][i]))) / mean, 0.6, 1.5), 0.5 * touch);
    // End-member albedos, not the complete shader: compare exposed mapped wood with the
    // existing absolute moss colour. GPU float noise, overlay cover and lighting remain native.
    const fine = field(hit.point.toArray()), cover = ss(0.34, 0.82, mask * (0.5 + 0.95 * fine));
    const rim = cover * (1 - cover) * 4;
    const sprig = noise(hit.point.toArray().map(v => v * 170)) * 0.5 + noise(hit.point.toArray().map(v => v * 330 + 5)) * 0.5;
    const moss = scale(vmix([0.09, 0.16, 0.04], [0.24, 0.36, 0.10], fine), (1 - 0.35 * rim) * (0.8 + 0.45 * fine + 0.25 * (sprig - 0.5) * near));
    const detailedBare = scale(bare, fineFactor * touchFactor);
    samples.push({ pixel: [px, py], distance: hit.distance, world: hit.point.toArray(), ids, bary, color, uv, map,
      mask, ao, vertexLum: lum(color), mapLum: lum(map), tintedMapLum: lum(tintedMap), bareLum: lum(bare),
      withoutMaterialLum: lum(mul(map, color)), fineFactor, touchFactor, bareDetailedLum: lum(detailedBare), mossLum: lum(moss),
      currentBareFloorAlbedo: lum(floorAlbedo(detailedBare, NEAR_BASE_FLOOR.texture)), proposedBareFloorAlbedo: lum(floorAlbedo(detailedBare, 0.65)),
      currentMossFloorAlbedo: lum(floorAlbedo(moss, NEAR_BASE_FLOOR.texture)), proposedMossFloorAlbedo: lum(floorAlbedo(moss, 0.65)),
      currentBareFloorLight: lum(floorLight(detailedBare, NEAR_BASE_FLOOR.texture)), proposedBareFloorLight: lum(floorLight(detailedBare, 0.65)),
      currentMossFloorLight: lum(floorLight(moss, NEAR_BASE_FLOOR.texture)), proposedMossFloorLight: lum(floorLight(moss, 0.65)),
    });
  }
  const rows = samples.filter(s => s.mask > 0.35 && s.mask < 0.96 && s.distance < 3);
  assert.ok(rows.length > 0, id + ': partial-moss wood samples');
  const summary = { id, poseId, origin: origin.toArray(), rays: 117, hits, cushionHits, woodSamples: samples.length, affected: rows.length, profileTint: profiles[id]?.barkTint ?? [1, 1, 1] };
  for (const key of Object.keys(rows[0]).filter(key => typeof rows[0][key] === 'number')) summary[key] = rows.reduce((s, r) => s + r[key], 0) / rows.length;
  summary.meanVertexRGB = [0, 1, 2].map(c => rows.reduce((s, r) => s + r.color[c], 0) / rows.length);
  summary.aoRange = [Math.min(...rows.map(s => s.ao)), Math.max(...rows.map(s => s.ao))];
  const sorted = rows.slice().sort((a, b) => a.bareLum - b.bareLum);
  summary.examples = [sorted[Math.floor(sorted.length * 0.2)], sorted[Math.floor(sorted.length * 0.8)]];
  reports.push(summary);
  for (const key of ['geometry', 'cards', 'authoredLeaves', 'authoredCards', 'nearBase']) asset[key]?.dispose();
  mesh.material.dispose();
}
// This checks the proposed one-parameter arithmetic, not a promised visual result.
for (const d of [0, 0.016, 0.026535, 0.08, 0.175325, 0.193923, 1]) {
  const current = mix(0.08, d, 0.75), proposed = mix(0.08, d, 0.65);
  assert.ok(Math.abs((proposed - current) - 0.1 * (0.08 - d)) < 1e-12);
}
console.log(JSON.stringify({
  method: '117 target-tree rays per native 1280x720 camera; partial-moss wood mask (0.35,0.96), under 3m. Barycentric real vertex RGB/AO and 2K LOD0 linear bilinear map samples.',
  limitations: 'No wind, other-object occlusion, normal-map lighting, mip/anisotropic filtering or postfx. CPU procedural noise differs from GPU float hash. End-member albedos and floor targets are not predicted native pixels; stair-bank has only two qualifying rays.',
  texture: { width: info.width, height: info.height }, tint, materialLum: lum(tint), ambient, canopyFilter: canopy, mean,
  acceptedFloor: NEAR_BASE_FLOOR, proposedFloor: { ...NEAR_BASE_FLOOR, texture: 0.65 }, reports,
}, null, 2));
