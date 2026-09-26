// Read-only, CPU-only comparison of the floor-moss candidate against its exact baseline.
// Run from any directory: node <this-file> [baseline-ref] [candidate-ref]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import * as bufferUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const refs = [process.argv[2] ?? '6c13f70c', process.argv[3] ?? 'ba1d4bb1'];
const git = (...args) => cp.execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 12000000 });
function graph(ref) {
  const modules = new Map();
  function load(file) {
    file = path.posix.normalize(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const source = git('show', `${ref}:${file}`).replaceAll('import.meta.env', '({})');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', js)(name => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return bufferUtils;
      if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), `${name}.ts`));
      throw Error(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}

const builds = [];
for (const ref of refs) {
  const load = graph(ref);
  const { WORLD } = load('src/world/config.ts');
  const { LAYOUT } = load('src/world/layout.ts');
  const { createRng } = load('src/world/util/prng.ts');
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 500);
  camera.position.set(0, 1.6, 2);
  camera.lookAt(0, 1.6, -10);
  camera.updateMatrixWorld();
  const ctx = {
    config: WORLD, layout: LAYOUT, terrain: load('src/world/terrain/heightfield.ts').getTerrain(),
    rng: createRng(WORLD.seed), camera, quality: { tier: 'high', density: 1, distance: 1, shadows: true },
    renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
    textures: { load: async () => new THREE.Texture() }, shared: {},
    wind: load('src/world/wind/wind.ts').createWind(), progress() {}, audit() {},
  };
  const world = await load('src/world/hardscape/index.ts').create(ctx);
  world.group.updateMatrixWorld(true);
  const meshes = [];
  world.group.traverse(object => { if (object.isMesh) meshes.push(object); });
  const { buildSproutMeshes, createSproutMaterial } = load('src/world/materials/sprouts.ts');
  // All four variants in the unchanged production rock pack; no floorMoss option.
  const rockSpots = [
    { x: 2, y: 0.3, z: 2, size: 0.9 }, { x: 0, y: 0.4, z: 1, size: 0.6 },
    { x: -1, y: 0.5, z: 0, size: 0.7, kind: 'fern' }, { x: 1, y: 0.3, z: -1, size: 0.6, kind: 'cushion' },
  ];
  const rocks = buildSproutMeshes(rockSpots, createRng(WORLD.seed).fork('rocks').fork('boulder-plants'), createSproutMaterial(ctx.wind, WORLD), WORLD, [[0, 1, 5, 4]]);
  builds.push({ ref, world, meshes, rocks });
}

const [before, after] = builds;
assert.equal(before.meshes.length, after.meshes.length);
const sameGeometry = (a, b) => {
  assert.deepEqual(Object.keys(a.attributes), Object.keys(b.attributes));
  for (const key of Object.keys(a.attributes)) assert.deepEqual(a.attributes[key].array, b.attributes[key].array, key);
  assert.deepEqual(a.index?.array, b.index?.array);
};
const sameInstances = (a, b) => {
  assert.equal(a.count, b.count);
  assert.deepEqual(a.instanceMatrix.array, b.instanceMatrix.array);
  assert.deepEqual(a.instanceColor?.array, b.instanceColor?.array);
};
let equalMeshes = 0;
let cushions = 0;
for (let i = 0; i < before.meshes.length; i++) {
  const a = before.meshes[i], b = after.meshes[i];
  assert.equal(a.name, b.name);
  assert.deepEqual(a.matrix.elements, b.matrix.elements);
  if (a.isInstancedMesh) sameInstances(a, b);
  if (a.name.endsWith('-v4')) {
    assert.equal(a.geometry.attributes.position.count, 150);
    assert.ok(b.geometry.attributes.position.count > 150);
    cushions += a.count;
    for (const key of ['aSproutVariant', 'aJointTint']) assert.deepEqual(a.geometry.attributes[key].array, b.geometry.attributes[key].array);
    const p = a.geometry.attributes.position, q = b.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) if (Math.abs(p.getY(j)) < 1e-6) {
      assert.equal(p.getX(j), q.getX(j));
      assert.equal(p.getZ(j), q.getZ(j));
      assert.ok(Math.abs(q.getY(j)) < 1e-6);
    }
  } else {
    sameGeometry(a.geometry, b.geometry);
    equalMeshes++;
  }
}
assert.equal(before.rocks.meshes.length, after.rocks.meshes.length);
for (let i = 0; i < before.rocks.meshes.length; i++) {
  sameInstances(before.rocks.meshes[i], after.rocks.meshes[i]);
  sameGeometry(before.rocks.meshes[i].geometry, after.rocks.meshes[i].geometry);
}

const moss = after.meshes.find(mesh => mesh.name.endsWith('-v4'));
const otherSprouts = after.meshes.filter(mesh => mesh.name.startsWith('joint-sprouts-') && mesh !== moss);
for (const mesh of [...otherSprouts, ...after.rocks.meshes]) {
  const uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) assert.ok(uv.getX(i) >= 0, 'shared sprout/rock vertices never enter the floor-moss shade branch');
}
const mossU = moss.geometry.attributes.uv;
const negativeU = Array.from({ length: mossU.count }, (_, i) => mossU.getX(i)).filter(u => u < 0);
const injectShader = material => {
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, undefined);
  return shader;
};
const beforeShader = injectShader(before.rocks.meshes[0].material);
const afterShader = injectShader(after.rocks.meshes[0].material);
const compactShader = source => source.replace(/\/\/[^\r\n]*/g, '').replace(/\s+/g, '');
const shadeBranch = 'if(uv.x<0.0)vColor.rgb*=-uv.x;';
const oldVertex = compactShader(beforeShader.vertexShader);
const newVertex = compactShader(afterShader.vertexShader);
assert.equal(newVertex.replace(shadeBranch, ''), oldVertex, 'negative-U branch is the only vertex-shader logic change');
assert.equal(afterShader.fragmentShader, beforeShader.fragmentShader, 'fragment shader unchanged');
if (negativeU.length) {
  assert.equal(negativeU.length, mossU.count, 'every floor-moss vertex carries its shade factor');
  assert.ok(negativeU.every(u => u >= -1 && u <= -0.55));
  assert.ok(newVertex.includes(shadeBranch));
  assert.notEqual(before.rocks.meshes[0].material.customProgramCacheKey(), after.rocks.meshes[0].material.customProgramCacheKey());
}
const p = moss.geometry.attributes.position, n = moss.geometry.attributes.normal;
const newTrianglesPerCushion = p.count / 3;
const substrate = new THREE.BufferGeometry();
substrate.setAttribute('position', new THREE.Float32BufferAttribute(p.array.slice(0, 450), 3));
const substrateMesh = new THREE.Mesh(substrate, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
substrateMesh.updateMatrixWorld(true);
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
const gap = point => {
  ray.set(new THREE.Vector3(point.x, 1, point.z), down);
  const hit = ray.intersectObject(substrateMesh, false)[0];
  assert.ok(hit, 'leaf sample lies over substrate');
  return point.y - hit.point.y;
};
let rootCornersAbove = 0, leavesWithBothRootsAbove = 0;
let maxRootGap = -Infinity, minNormalDot = 1, minTipExposed = Infinity;
for (let i = 0; i < p.count; i++) {
  const point = new THREE.Vector3().fromBufferAttribute(p, i);
  assert.ok(point.distanceTo(moss.geometry.boundingSphere.center) <= moss.geometry.boundingSphere.radius + 1e-6);
  assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n, i).length() - 1) < 1e-6);
  assert.equal(moss.geometry.attributes.aWind.getX(i), 0);
}
for (let i = 150; i < p.count; i += 3) {
  const a = new THREE.Vector3().fromBufferAttribute(p, i);
  const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
  const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
  const face = b.clone().sub(a).cross(c.clone().sub(a));
  assert.ok(face.length() > 1e-5 && face.y > 0);
  face.normalize();
  minNormalDot = Math.min(minNormalDot, face.dot(new THREE.Vector3().fromBufferAttribute(n, i)));
  const ga = gap(a), gb = gap(b), gc = gap(c);
  rootCornersAbove += Number(ga > 0) + Number(gb > 0);
  leavesWithBothRootsAbove += Number(ga > 0 && gb > 0);
  maxRootGap = Math.max(maxRootGap, ga, gb);
  minTipExposed = Math.min(minTipExposed, gc);
  assert.ok(Math.min(ga, gb) <= 0 && gc > 0, 'each leaf enters the substrate and has an exposed tip');
}
assert.ok(minNormalDot > 0.999999);
const matrix = new THREE.Matrix4();
let maxYScale = 0;
for (let i = 0; i < moss.count; i++) {
  moss.getMatrixAt(i, matrix);
  maxYScale = Math.max(maxYScale, matrix.elements[5]);
}
const report = {
  baseline: git('rev-parse', refs[0]).trim(), candidate: git('rev-parse', refs[1]).trim(),
  scope: 'CPU/source checks only; no renderer, visual verdict or W38 attestation',
  equalHardscapeMeshes: equalMeshes, changedMesh: moss.name, cushions,
  allHardscapeInstanceMatricesColorsExact: true, mixedRockPackByteExact: true,
  oldTrianglesPerCushion: 50, newTrianglesPerCushion,
  authoredTriangleIncrease: cushions * (newTrianglesPerCushion - 50), extraDrawCalls: 0,
  leafCount: newTrianglesPerCushion - 50, detachedLeaves: leavesWithBothRootsAbove,
  rootCornersAbove, maxRootGapPrototypeUnits: maxRootGap,
  maxRootGapMmAtLargestLivePad: maxRootGap * maxYScale * 1000,
  minTipExposedPrototypeUnits: minTipExposed, minNormalDot,
  boundingSphereContainsAllVertices: true, seatedRimPreserved: true,
  negativeUExclusiveToFloorMoss: true, floorMossNegativeUVertices: negativeU.length,
  sharedShaderPathUnchanged: true, fragmentShaderUnchanged: true,
  shaderNote: 'Shared vertices have U>=0, so the sole new conditional is false. This proves the source path, not rendered pixel identity.',
};
fs.writeFileSync(path.join(here, `review-moss-${report.candidate.slice(0, 8)}-cpu.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
for (const build of builds) build.world.dispose();
