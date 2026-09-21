// CPU geometry attribution only. Real source geometry/LOD, inert materials; no browser/GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const ref = process.argv[2] ?? '24dc4cac';
const modules = new Map();
let materials;
function load(file) {
  file = path.posix.normalize(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const source = cp.execFileSync('git', ['-C', root, 'show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 12000000 }).replaceAll('import.meta.env', '({})');
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => {
    if (name === 'three') return THREE;
    if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return buffers;
    if (name === 'three/examples/jsm/loaders/GLTFLoader.js') return { GLTFLoader: class {} };
    if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), name + '.ts'));
    throw Error(name);
  }, module, module.exports);
  if (file === 'src/world/trees/materials.ts') {
    module.exports.createTreeMaterials = async () => {
      const names = ['whiteTree', 'whiteTreeDepth', 'giantTree', 'giantTreeDepth', 'giantTreeNear', 'columnTree', 'giantTreeNearBase', 'giantTreeNearCanopy', 'giantCanopy', 'giantCanopyDepth', 'distant'];
      materials = Object.fromEntries(names.map(name => { const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }); mat.name = name; return [name, mat]; }));
      materials.nearBole = { value: Array.from({ length: module.exports.NEAR_BOLE_SLOTS }, () => new THREE.Vector4()) };
      materials.nearCanopy = { value: Array.from({ length: module.exports.NEAR_CANOPY_SLOTS }, () => new THREE.Vector4()) };
      materials.windLayers = 3;
      materials.barkTextureSets = [];
      return materials;
    };
  }
  if (file === 'src/world/trees/distant.ts') module.exports.createDistantCrownMaterial = () => { const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }); m.name = 'distant-crown'; return m; };
  return module.exports;
}
Object.defineProperty(globalThis, 'navigator', { value: { deviceMemory: 8 }, configurable: true });
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'attribution-input.json')));
const { WORLD } = load('src/world/config.ts'), { LAYOUT } = load('src/world/layout.ts');
const { createRng } = load('src/world/util/prng.ts');
const camera = new THREE.PerspectiveCamera(46, 1280 / 720, 0.1, 500);
function pose(view) {
  const p = manifest.images[view].camera;
  camera.position.fromArray(p.position);
  camera.fov = p.fov; camera.updateProjectionMatrix();
  camera.lookAt(camera.position.clone().add(new THREE.Vector3().fromArray(p.direction)));
  camera.updateMatrixWorld();
}
pose('F_canopy');
const audits = new Map();
const ctx = {
  config: WORLD, layout: LAYOUT, terrain: load('src/world/terrain/heightfield.ts').getLegacyTerrain(),
  rng: createRng(WORLD.seed), camera, quality: { tier: 'high', density: 1, distance: 1, shadows: true },
  renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, textures: { load: async () => new THREE.Texture() },
  shared: {}, wind: load('src/world/wind/wind.ts').createWind(), progress() {}, audit: (name, fn) => audits.set(name, fn),
};
console.log('Building exact tree geometry with inert CPU materials...');
const trees = await load('src/world/trees/index.ts').create(ctx);
const rays = {
  A_stairs: [[170, 50], [245, 72], [291, 32], [473, 190], [970, 59], [1095, 29]],
  C_lookback: [[160, 133], [556, 35], [837, 208], [1090, 51], [1260, 95]],
  F_canopy: [[667, 70], [840, 205], [990, 159], [252, 42], [536, 63], [966, 45]],
};
const ray = new THREE.Raycaster();
const report = { sourceRef: ref, imageBuild: manifest.build.sha, limitation: 'Tree-only undeformed CPU geometry. Alpha texture and GPU wind are not evaluated; card intersections are candidates, not certified visible fragments.', views: {} };
for (const [view, pixels] of Object.entries(rays)) {
  pose(view); trees.onCameraMove(camera); trees.group.updateMatrixWorld(true);
  const meshes = []; trees.group.traverseVisible(object => { if (object.isMesh) meshes.push(object); });
  const rows = [];
  for (const pixel of pixels) {
    ray.setFromCamera(new THREE.Vector2((pixel[0] + 0.5) / 1280 * 2 - 1, 1 - (pixel[1] + 0.5) / 720 * 2), camera);
    const hits = ray.intersectObjects(meshes, false).filter(hit => {
      const attr = hit.object.geometry.attributes.aRoot;
      if (!attr) return true;
      const w = attr.getW(hit.face.a), swap = w >= 999 ? 3 + Math.floor(w - 1000 + 0.01) : w;
      const origin = new THREE.Vector3().fromBufferAttribute(attr, hit.face.a);
      if (hit.object.isInstancedMesh) { const m = new THREE.Matrix4(); hit.object.getMatrixAt(hit.instanceId, m); origin.applyMatrix4(m); }
      origin.applyMatrix4(hit.object.matrixWorld);
      if (swap > 2.75 && materials.nearCanopy.value.some(s => s.w > 0.5 && Math.abs(s.w - swap) < 0.25 && origin.distanceTo(s) < 0.05)) return false;
      if (w < -0.5 && materials.nearBole.value.some(s => Math.abs(s.w) > 0.5 && (s.w > 0 || w < -1.5) && origin.distanceTo(s) < 0.05)) return false;
      return true;
    }).slice(0, 8);
    rows.push({ pixel, hits: hits.map(hit => {
      const object = hit.object, attr = object.geometry.attributes.aRoot;
      const w = attr?.getW(hit.face.a), leafW = w >= 999 ? 1.5 + (w % 1) : w;
      const mat = Array.isArray(object.material) ? object.material[hit.face.materialIndex] : object.material;
      const world = object.matrixWorld.clone();
      if (object.isInstancedMesh) { const instance = new THREE.Matrix4(); object.getMatrixAt(hit.instanceId, instance); world.multiply(instance); }
      const rootOrigin = attr ? new THREE.Vector3().fromBufferAttribute(attr, hit.face.a).applyMatrix4(world).toArray() : undefined;
      const normal = (hit.normal ?? hit.face.normal).clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(world));
      return { object: object.name, kind: object.userData.kind, giants: object.userData.giants, materialRole: mat.name, distance: hit.distance, point: hit.point.toArray(), rootOrigin, rootCode: w, cardFacing: Math.abs(normal.dot(ray.ray.direction)), flat: leafW >= 1.25 && leafW < 2.75, uv: hit.uv?.toArray(), instanceId: hit.instanceId, faceIndex: hit.faceIndex };
    }) });
  }
  report.views[view] = rows;
  console.log(view, JSON.stringify(rows.map(r => ({ pixel: r.pixel, first: r.hits[0] }))));
}
const audit = audits.get('trees')();
report.nearCanopy = audit.nearCanopy;
fs.writeFileSync(path.join(here, 'audit-tree-identity.json'), JSON.stringify(report, null, 2) + '\n');
trees.dispose();
