// CPU-only diagnostic for the deb5272 foundation; no WebGL or new packages required.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS },
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
const system = load('src/world/terrain/index.ts').create({
  terrain, config: load('src/world/config.ts').WORLD, audit() {},
});
system.group.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
for (const [label, x, z] of [['contact', 14.82, -3.88], ['LOD seam', 60, 9]]) {
  ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(system.group);
  console.log(label, { x, z, sampledHeight: terrain.height(x, z),
    renderedTriangleHits: hits.map((hit) => ({ y: hit.point.y, mesh: hit.object.name })) });
}
