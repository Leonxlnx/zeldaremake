/** Run: node --test src/world/structures/woodGrain.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Compile only this test's TS dependency graph in memory (the mossTufts test's loader).
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
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
const { woodGrain, woodFibre, endFrame, checkedCap, footMoss } = loadTs(path.join(here, 'woodGrain.ts'));
const { sweepTube } = loadTs(path.join(here, 'geometry.ts'));
const { Noise2D } = loadTs(path.join(here, '../util/noise.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { Vector3, CatmullRomCurve3 } = THREE;

const noise = new Noise2D('woodGrain-test');

test('woodGrain is periodic round the post, bounded, and runs along the wood', () => {
  for (let i = 0; i < 200; i++) {
    const along = i * 0.013;
    const a = (i * 0.37) % (Math.PI * 2);
    const g = woodGrain(noise, along, a, 14, 0.7, 3);
    assert.ok(g >= 0 && g <= 1, `grain in [0, 1]: ${g}`);
    // the same angle ± 2π is the same point on the post: no seam
    const g2 = woodGrain(noise, along, a + Math.PI * 2, 14, 0.7, 3);
    assert.ok(Math.abs(g - g2) < 1e-9, 'periodic in the angle');
    const f = woodFibre(noise, along, a, 14, 3);
    assert.ok(f >= 0 && f <= 1, 'fibre in [0, 1]');
  }
  // long grain: moving 2 cm along the wood changes the field far less than moving 2 cm round it
  let dAlong = 0;
  let dAround = 0;
  const r = 0.08;
  for (let i = 0; i < 400; i++) {
    const along = 0.3 + i * 0.0031;
    const a = (i * 0.61) % (Math.PI * 2);
    const g = woodGrain(noise, along, a, 14, 0.7, 3);
    dAlong += Math.abs(woodGrain(noise, along + 0.02, a, 14, 0.7, 3) - g);
    dAround += Math.abs(woodGrain(noise, along, a + 0.02 / r, 14, 0.7, 3) - g);
  }
  assert.ok(dAlong * 3 < dAround, `grain lines run along the wood (Δalong ${dAlong.toFixed(2)} vs Δaround ${dAround.toFixed(2)})`);
});

test('checkedCap seals to the tube ring, faces out of the end, and cuts checks inward', () => {
  const curve = new CatmullRomCurve3([new Vector3(0, -0.3, 0), new Vector3(0.02, 0.5, 0.01), new Vector3(0.05, 1.2, 0.02)]);
  const ts = 12;
  const rs = 16;
  const radius = (t) => 0.09 - 0.03 * t;
  const tube = sweepTube(curve, { radius, tubularSegments: ts, radialSegments: rs, displace: (t) => 0.01 * (1 - Math.min(1, t * 1.05)) });
  const frame = endFrame(curve, ts);
  const rng = createRng('cap-test');
  const cap = checkedCap(frame, rng, noise, { radius: radius(1), segments: rs, color: [0.6, 0.5, 0.4], checks: 3, depth: [0.008, 0.014], dome: 0.003 });
  const pos = cap.attributes.position;
  const nrm = cap.attributes.normal;
  assert.ok(cap.index && cap.index.count > 0 && cap.attributes.color && cap.attributes.uv, 'indexed, coloured, uv-mapped');
  // the outer row (last rs + 1 vertices) coincides with the tube's last ring
  const tubePos = tube.attributes.position;
  const ringStart = ts * (rs + 1);
  const rows = pos.count / (rs + 1);
  const rimStart = (rows - 1) * (rs + 1);
  for (let j = 0; j <= rs; j++) {
    const tp = new Vector3().fromBufferAttribute(tubePos, ringStart + j);
    const cp = new Vector3().fromBufferAttribute(pos, rimStart + j);
    assert.ok(tp.distanceTo(cp) < 1e-6, `rim vertex ${j} seals to the tube ring (gap ${tp.distanceTo(cp)})`);
  }
  // every normal faces out of the end (along the tangent, within 90°) and the surface is
  // never more than the dome above the end plane; the checks cut below it
  let minH = Infinity;
  let maxH = -Infinity;
  const T = frame.T;
  for (let i = 0; i < pos.count; i++) {
    const n = new Vector3().fromBufferAttribute(nrm, i);
    assert.ok(n.dot(T) > 0, `normal ${i} faces out of the end`);
    const p = new Vector3().fromBufferAttribute(pos, i).sub(frame.point);
    const h = p.dot(T);
    minH = Math.min(minH, h);
    maxH = Math.max(maxH, h);
  }
  assert.ok(maxH <= 0.003 + 0.002 && maxH > 0, `domed to ≈ 3 mm (max ${maxH})`);
  assert.ok(minH < -0.004, `checks cut inward (min ${minH})`);
  // deterministic
  const cap2 = checkedCap(frame, createRng('cap-test'), noise, { radius: radius(1), segments: rs, color: [0.6, 0.5, 0.4], checks: 3, depth: [0.008, 0.014], dome: 0.003 });
  assert.deepEqual(Array.from(cap2.attributes.position.array), Array.from(pos.array));
});

test('footMoss sits on the terrain round the post foot and favours the given side', () => {
  const terrain = {
    height: (x, z) => 0.5 + 0.1 * x - 0.05 * z,
    normal: (x, z, out = new Vector3()) => out.set(-0.1, 1, 0.05).normalize(),
  };
  const ctx = { terrain };
  const foot = new Vector3(2, terrain.height(2, -3), -3);
  const specs = footMoss(ctx, foot, createRng('foot'), { postRadius: 0.09, count: 200, color: [0.3, 0.4, 0.09], favour: [1, 0] });
  assert.ok(specs.length > 100 && specs.length < 200, `some rejected on the far side (${specs.length})`);
  let toward = 0;
  for (const s of specs) {
    const dx = s.position.x - foot.x;
    const dz = s.position.z - foot.z;
    const d = Math.hypot(dx, dz);
    assert.ok(d > 0.09 - 0.045 * 0.3 - 1e-6 && d < 0.09 + 0.09 + 1e-6, `within the foot ring (${d})`);
    assert.ok(Math.abs(s.position.y - terrain.height(s.position.x, s.position.z)) < 1e-9, 'exactly on the terrain');
    assert.ok(Math.abs(s.normal.length() - 1) < 1e-6, 'unit normal');
    if (dx > 0) toward++;
  }
  assert.ok(toward > specs.length * 0.6, `favours +x (${toward}/${specs.length})`);
});
