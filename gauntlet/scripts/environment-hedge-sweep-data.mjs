/** Source-derived free-camera LOD sweep. CPU preparation only; never hides world objects. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as T from 'three';
import { digest } from './environment-capture-data.mjs';

export const SWEEP_SCHEMA = 'zeldaremake.environment-hedge-sweep.v1';
export const SWEEP_CONTROLS = { light: null, post: null };
export const SWEEP_TIME = 12.5;

export function loadHedgeSweep(root) {
  const modules = new Map(), sources = new Map();
  function load(file) {
    file = path.posix.normalize(file); assert(file.startsWith('src/world/'));
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const text = fs.readFileSync(path.join(root, file), 'utf8'); sources.set(file, digest(text));
    const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', compiled)(name => name === 'three' ? T : load(path.posix.join(path.posix.dirname(file), name + '.ts')), module, module.exports);
    return module.exports;
  }
  const read = name => load(`src/world/${name}.ts`), { WORLD } = read('config'), { LAYOUT } = read('layout');
  const terrain = read('terrain/heightfield').createTerrain();
  const ctx = { config: WORLD, layout: LAYOUT, terrain, rng: read('util/prng').createRng(WORLD.seed),
    wind: read('wind/wind').createWind(), quality: { tier: 'high', density: 1, distance: 1, shadows: true, pixelRatio: 1 } };
  const field = new (read('vegetation/field').VegField)(ctx, WORLD.detailRadius + 6, .5);
  const plants = read('vegetation/plants').buildPlants(ctx, field, new T.Group());
  try {
    const hedge = plants.hedge;
    const anchors = hedge.items.map((item, index) => ({ item: index, variant: item.variant, root: [item.x, item.y, item.z] }))
      .filter(({ root: [x, , z] }) => x >= 6 && x <= 8.6 && z >= 3.9 && z <= 5.6).sort((a, b) => a.root[0] - b.root[0]);
    assert.equal(anchors.length, 2, 'This bounded sweep requires the two authored bank hedges; review a changed layout');
    const [near, far] = anchors, centre = near.root.map((v, i) => (v + far.root[i]) / 2);
    const threshold = hedge.opts.lodDistances[0]; assert.equal(threshold, 26);
    // A straight west/east track at fixed z and eye height, with 10 cm samples across each
    // actual threshold. Circle/line intersections use the original instance roots, not rounding.
    const crossingX = a => a.root[0] - Math.sqrt(threshold * threshold - (centre[2] - a.root[2]) ** 2);
    const crossings = anchors.map(crossingX).sort((a, b) => a - b);
    assert(crossings[1] - crossings[0] > .2, 'Thresholds need distinct bracketing samples');
    const forwardX = [crossings[0] - .4, crossings[0] - .05, crossings[0] + .05,
      crossings[1] - .05, crossings[1] + .05, crossings[1] + .4];
    const xs = [...forwardX, ...forwardX.slice(0, -1).reverse()];
    const eyeY = Math.max(...xs.map(x => terrain.height(x, centre[2]))) + 1.8;
    const target = [centre[0], centre[1] + 1, centre[2]];
    const frames = xs.map((x, index) => {
      const position = [x, eyeY, centre[2]], direction = index < forwardX.length ? 'in' : 'out';
      return { id: `H${String(index + 1).padStart(2, '0')}-${direction}`, position, target, fov: 46,
        expectedLods: anchors.map(a => { const distance = Math.hypot(x - a.root[0], centre[2] - a.root[2]);
          return { item: a.item, distance, lod: distance < threshold ? 0 : 1 }; }) };
    });
    for (const a of anchors) assert.deepEqual([...new Set(frames.map(f => f.expectedLods.find(e => e.item === a.item).lod))].sort(), [0, 1]);
    const terrainClearance = frames.map(frame => {
      let minimum = Infinity;
      // A narrow source-only camera-to-target terrain check, not full-scene occlusion proof.
      for (let s = 0; s <= 100; s++) { const u = s / 100, p = frame.position.map((v, i) => v + (frame.target[i] - v) * u);
        minimum = Math.min(minimum, p[1] - terrain.height(p[0], p[2])); }
      assert(minimum > .05, 'Camera/target line must clear source terrain');
      return { frame: frame.id, minimumM: minimum };
    });
    return { schema: SWEEP_SCHEMA, anchors, threshold, frames, terrainClearance,
      sourceFiles: Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b))),
      hedgeItemsSha256: digest(JSON.stringify(hedge.items)),
      lodScope: 'Expected target LODs are inferred from the actual source-generated roots and existing horizontal-distance selector. The public API reports aggregate audits, not per-instance observed LODs. setPose forces onCameraMove, bypassing the interactive 0.6 m update gate.' };
  } finally {
    const geometries = new Set();
    for (const set of plants.all) { for (const row of set.opts.variants) for (const g of row) geometries.add(g); set.dispose(); }
    for (const g of geometries) g.dispose();
    for (const m of new Set(plants.materials)) m.dispose();
  }
}
