// CPU-only diagnostic for the current terrain system; no WebGL or new packages required.
// Run from repository root: node .agents/reviews/codex-terrain-review.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => name === 'three' ? THREE : name.startsWith('.')
      ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name),
    module, module.exports,
  );
  return module.exports;
}

const { createTerrain } = load('src/world/terrain/heightfield.ts');
const a = createTerrain();
const b = createTerrain();
const first = [16.04, -8.35];
const second = [16.055, -8.335];
a.height(...first);
const afterFirst = a.height(...second);
const fresh = b.height(...second);
console.log('cache query-order difference', { first, second, afterFirst, fresh, metres: Math.abs(afterFirst - fresh) });

const terrain = createTerrain();
const quality = process.argv.includes('--low')
  ? { tier: 'low', density: .35, distance: .6, shadows: true, pixelRatio: 1 }
  : { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1.5 };
// Texture bytes and GPU uploads do not affect the vertex positions being tested.
// Stub only texture I/O and renderer capability, retaining the real async system builder.
const textures = [];
let audit;
const system = await load('src/world/terrain/index.ts').create({
  terrain, config: load('src/world/config.ts').WORLD,
  layout: load('src/world/layout.ts').LAYOUT,
  quality,
  textures: { async load() { const t = new THREE.Texture(); textures.push(t); return t; }, missing() { return []; } },
  renderer: { capabilities: { getMaxAnisotropy() { return 1; } } },
  progress() {}, audit(_name, fn) { audit = fn; },
});
system.group.updateMatrixWorld(true);
console.log('geometry context', { quality: quality.tier, chunks: system.group.children.length,
  vertices: audit?.().vertices, triangles: audit?.().triangles, textureIO: 'stubbed; CPU geometry only' });
const ray = new THREE.Raycaster();
const meshes = system.group.children.filter(m => m.isMesh);
for (const m of meshes) m.geometry.computeBoundingBox();
function probe(x, z) {
  ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
  const candidates = meshes.filter(m => {
    const b = m.geometry.boundingBox;
    return x >= b.min.x - 1e-5 && x <= b.max.x + 1e-5 && z >= b.min.z - 1e-5 && z <= b.max.z + 1e-5;
  });
  const hits = ray.intersectObjects(candidates, false);
  const byMesh = [...new Map(hits.map(h => [h.object.name, h])).values()];
  const sampledHeight = terrain.height(x, z);
  return { x, z, sampledHeight,
    gap: hits.length ? sampledHeight - hits[0].point.y : null,
    renderedTriangleHits: byMesh.map(h => ({ y: h.point.y, mesh: h.object.name })),
    seamSpread: byMesh.length > 1 ? Math.max(...byMesh.map(h => h.point.y)) - Math.min(...byMesh.map(h => h.point.y)) : null };
}
for (const [label, x, z] of [['contact', 14.82, -3.88], ['old LOD seam (no longer boundary)', 60, 9],
  ['inner/mid seam', 48, 9.2], ['mid/outer seam', 144, 9.2]]) console.log(label, probe(x,z));
let maxContact = null;
let contacts = 0;
for (let z = -12.13; z < 6; z += .61) for (let x = 4.17; x < 20; x += .61) {
  const p = probe(x,z);
  if (p.gap === null) continue;
  contacts++;
  if (!maxContact || Math.abs(p.gap) > Math.abs(maxContact.gap)) maxContact = p;
}
console.log('stair/plaza contact grid', { samples: contacts, worst: maxContact });
let maxSeam = null;
let seamSamples = 0;
for (const boundary of [-144,-48,48,144]) for (let t = -40.6; t <= 40.6; t += 2.2) {
  for (const [x,z] of [[boundary,t],[t,boundary]]) {
    const p = probe(x,z);
    if (p.seamSpread === null) continue;
    seamSamples++;
    if (!maxSeam || p.seamSpread > maxSeam.seamSpread) maxSeam = p;
  }
}
console.log('current ring seam probes', { samplesWithTwoMeshes: seamSamples, worst: maxSeam });
for (const m of meshes) m.geometry.dispose();
for (const m of new Set(meshes.map(m => m.material))) m.dispose();
for (const t of textures) t.dispose();
