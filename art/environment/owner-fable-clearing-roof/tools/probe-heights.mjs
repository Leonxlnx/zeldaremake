// sample the LIVE and LEGACY heightfield in node (same loader as roof.test.mjs) at the clearing poses
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
  const req = (id) => {
    if (id === 'three') return THREE;
    if (!id.startsWith('.')) throw new Error(`unexpected import ${id} from ${abs}`);
    const base = path.resolve(path.dirname(abs), id);
    return load(base.endsWith('.ts') ? base : `${base}.ts`);
  };
  new Function('require', 'module', 'exports', out)(req, module, module.exports);
  return module.exports;
}
const hf = load('src/world/terrain/heightfield.ts');
const t = hf.getTerrain();
const pts = { 'x-arch-tunnel-n': [6.3, -54.5, 5.5, -62], 'x-northpath-n': [5.2, -61.5, 0.5, -68.5], 'x-clearing-n': [-1.5, -69.8, -0.7, -78], 'x-clearing-back': [-1.5, -69.8, 5.5, -58.5], 'x-clearing-stones': [-4.2, -71.5, -0.2, -69], 'x-ledge-top': [-0.7, -78.2, -1.5, -70.5], 'stand-w': [-20, -72, 0, 0], 'stand-n': [0, -86, 0, 0], 'stand-e': [20, -72, 0, 0], 'rows': [0, -58, 0, 0] };
for (const [k, [x, z, tx, tz]] of Object.entries(pts)) {
  const live = t.height(x, z, 'live'), leg = t.height(x, z, 'legacy'), tl = t.height(tx, tz, 'live');
  console.log(k, 'eye ground live', live.toFixed(2), 'legacy', (leg ?? NaN).toFixed?.(2), 'aim ground live', tl.toFixed(2));
}
