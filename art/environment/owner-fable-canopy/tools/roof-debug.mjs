import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
const cache = new Map();
function load(file) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs).exports;
  const module = { exports: {} };
  cache.set(abs, module);
  const out = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = (id) => (id === 'three' ? THREE : load(path.resolve(path.dirname(abs), id.endsWith('.ts') ? id : `${id}.ts`)));
  new Function('require', 'module', 'exports', out)(req, module, module.exports);
  return module.exports;
}
const { buildRoof } = load('src/world/canopy/roof.ts');
const { createRng } = load('src/world/util/prng.ts');
const { LAYOUT } = load('src/world/layout.ts');
const { WORLD } = load('src/world/config.ts');
const { Noise2D, smoothstep } = load('src/world/util/noise.ts');
// the real terrain sampler
const { getTerrain } = load('src/world/terrain/heightfield.ts');
const terrain = getTerrain();
const ctx = { layout: LAYOUT, terrain, config: WORLD, quality: { tier: 'high', density: 1 } };
const sunDir = new THREE.Vector3(-0.62, 0.62, 0.48).normalize();
const r = buildRoof(ctx, createRng(`${WORLD.seed}/canopy-roof`), { sunDir, density: 1, sectors: 6 });
const near = (x, z, rad) => r.clumps.filter((c) => Math.hypot(c.x - x, c.z - z) < rad);
for (const [name, x, z] of [['hollow w19', 3, -36], ['stairs w22', 11, 0], ['plateau w27', 18, -10], ['plaza', 0, 0], ['north plain', 5, -50]]) {
  const cs = near(x, z, 12);
  console.log(name, `${cs.length} clumps within 12 m`, cs.slice(0, 4).map((c) => `(${c.x.toFixed(0)},${c.y.toFixed(1)},${c.z.toFixed(0)})`).join(' '), 'ground', terrain.height(x, z).toFixed(2));
}
// support and field at the hollow
const field = new Noise2D('canopy-roof-field');
for (const [x, z] of [[3, -36], [0, -30], [6, -40]]) {
  const n = 0.5 + 0.5 * field.fbm(x * 0.09, z * 0.09, 3);
  let support = 0;
  for (const g of LAYOUT.giantTrees) {
    const R = g.height * 0.47, d = Math.hypot(x - g.position[0], z - g.position[2]);
    support = Math.max(support, 1 - smoothstep(R * 0.85, R * 2 + 9, d));
  }
  console.log(`(${x},${z}) n ${n.toFixed(2)} support ${support.toFixed(2)} keep ${(n * (0.35 + 0.65 * support)).toFixed(2)}`);
}
console.log('dropped', JSON.stringify(r.dropped), 'clumps', r.clumps.length);
