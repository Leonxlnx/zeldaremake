/** Run: node --test src/world/rocks/tiers.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { crossCheckAudit } from '../../../gauntlet/scripts/score.mjs';

const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  // Expose the real tile builder only in this CPU test, without extending its production API.
  const testExport = file === path.join(here, 'index.ts') ? '\nexport { buildTiled };\n' : '';
  const source = ts.transpileModule(readFileSync(file, 'utf8') + testExport, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
          if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
        }
      }
      throw new Error(`Unexpected test dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { getTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
// rocks/index.ts pulls three.js scene classes; the contour walk and the tier list are pure, so the
// module loads without a renderer
const { BANK_TIERS, contourLine, buildTiled } = loadTs(path.join(here, 'index.ts'));
const { installCaptureApi } = loadTs(path.join(here, '../../capture/api.ts'));
const T = getTerrain();

test('the C stair-bank tier walks the face at its mid height, off the paving and the treads', () => {
  const tier = BANK_TIERS.find((t) => t.id === 'c-stair-bank');
  assert.ok(tier);
  const pts = contourLine(T, tier.from, tier.to, tier.height, tier.spacing);
  const placed = pts.filter(([x, z]) => T.slope(x, z) >= 0.25 && !tier.keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr));
  const onFace = placed;
  // (three: the contour past fable-3's pots flattens into the stair-foot rock and fails the slope filter)
  assert.ok(onFace.length >= 3, `only ${onFace.length} slabs on the face`);
  // fable-3's stair-foot pots (props/layout.ts): no slab within reach of either
  for (const [kx, kz] of [[7.95, 1.8], [7.55, 2.1]]) for (const [x, z] of onFace) assert.ok(Math.hypot(x - kx, z - kz) >= 0.85, `slab (${x.toFixed(2)}, ${z.toFixed(2)}) within 0.85 m of the pot at (${kx}, ${kz})`);
  // the tier sits on the face west of the pots, toward the frame's terrace edge (C box 0.25–0.32)
  assert.ok(onFace.every(([x]) => x < 7.4), `a slab east of the pots: ${JSON.stringify(onFace.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]))}`);
  for (const [x, z] of pts) {
    assert.ok(Math.abs(T.height(x, z) - tier.height) < 0.12, `height ${T.height(x, z)} at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    const m = T.mask(x, z);
    assert.ok(m.path < 0.2 && m.stairs < 0.3, `(${x.toFixed(2)}, ${z.toFixed(2)}) on paving / treads`);
  }
  // consecutive slabs sit about a spacing apart along the run (the walk slides across, not along)
  for (let i = 1; i < onFace.length; i++) {
    const d = Math.hypot(onFace[i][0] - onFace[i - 1][0], onFace[i][1] - onFace[i - 1][1]);
    assert.ok(d > tier.spacing * 0.5 && d < tier.spacing * 3.6, `spacing ${d.toFixed(2)} between slabs ${i - 1} and ${i}`); // (the gap across the pots is two spacings)
  }
});

test('the contour walk is deterministic and returns nothing where the height is not found', () => {
  const a = contourLine(T, [5.9, 4.0], [9.1, 1.1], 0.5, 0.5);
  const b = contourLine(T, [5.9, 4.0], [9.1, 1.1], 0.5, 0.5);
  assert.deepEqual(a, b);
  // 40 m up: no terrain near that height on the plaza's bank
  assert.equal(contourLine(T, [5.9, 4.0], [9.1, 1.1], 40, 0.5).length, 0);
});

test('merged pebble tiles back B3 once across both LODs without multiplying triangles', () => {
  const material = new THREE.MeshBasicMaterial();
  const hiGeo = new THREE.IcosahedronGeometry(1, 1), loGeo = new THREE.IcosahedronGeometry(1, 0);
  const placed = [0, 1, 2, 3].map((x) => ({ x, y: 0, z: 0, scale: x === 3 ? 0 : .03, yaw: 0, variant: 0 }));
  const [{ hi, lo }] = buildTiled(placed, [hiGeo], material, 'pebbles', 10, [loGeo]);
  const scene = new THREE.Scene(), rocks = new THREE.Group();
  rocks.name = 'rocks'; rocks.add(hi, lo); scene.add(rocks);
  const previousWindow = globalThis.window;
  globalThis.window = {};
  try {
    const api = installCaptureApi({ scene, audits: new Map([['rocks', () => ({ pebbles: 3 })]]), failures: [] });
    const audit = api.audit();
    assert.equal(crossCheckAudit(audit)[0].ok, true, 'merged geometry must back the placed pebble claim');
    assert.equal(hi.userData.mergedInstances, 3, 'zero-scale source is excluded');
    assert.equal(lo.userData.mergedInstances, 0, 'far geometry must not declare the same pebbles twice');
    assert.deepEqual(audit.scene.bySystem.rocks, { meshes: 2, instances: 4, triangles: 300 });
    assert.equal(audit.scene.instances, 4);
    assert.equal(audit.scene.triangles, 300);
    hi.visible = false; lo.visible = true;
    assert.deepEqual(api.audit().scene, audit.scene, 'census counts placed geometry independently of LOD visibility');
    hi.userData.mergedInstances = hi.geometry.attributes.position.count;
    assert.equal(api.audit().scene.bySystem.rocks.instances, 2, 'geometry cannot support an impossible declaration');
    assert.equal(crossCheckAudit(api.audit())[0].ok, false, 'B3 must still reject an unsupported claim');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    for (const geometry of [hiGeo, loGeo, hi.geometry, lo.geometry]) geometry.dispose();
    material.dispose();
  }
});
