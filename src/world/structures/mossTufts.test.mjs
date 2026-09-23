/** Run: node --test src/world/structures/mossTufts.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// Compile only this test's TS dependency graph in memory (the props tests' loader).
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
const { buildMossTufts, DEFAULT_TUFT_OPTIONS } = loadTs(path.join(here, 'mossTufts.ts'));
const { Vector3 } = THREE;

/** a deterministic stand-in for the cap's Noise3D (smooth, in [-1, 1]) */
const noise = { noise: (x, y, z) => Math.sin(x * 1.3 + y * 0.7) * Math.cos(z * 1.1 - x * 0.4) };

function specs(n, seed = 7) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const nrm = new Vector3(rnd() - 0.5, 0.6 + rnd(), rnd() - 0.5).normalize();
    const r = 0.02 + rnd() * 0.04;
    out.push({
      position: new Vector3(rnd() * 4, 3 + rnd() * 2, rnd() * 4),
      normal: nrm,
      rx: r * (0.8 + rnd() * 0.4),
      rz: r * (0.8 + rnd() * 0.4),
      h: r * 0.8,
      yaw: rnd() * Math.PI * 2,
      color: [0.6, 0.7, 0.1],
      uv: [rnd() * 8, rnd() * 8],
      sink: r * 0.3,
      seed: 1 + Math.floor(rnd() * 1e6),
    });
  }
  return out;
}

test('every tuft triangle winds outward and the geometry is well-formed', () => {
  const list = specs(300);
  const { geometry, count, triangles } = buildMossTufts(list, noise);
  assert.equal(count, 300);
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const idx = geometry.index;
  assert.equal(idx.count, triangles * 3);
  assert.ok(geometry.attributes.uv && geometry.attributes.color, 'uv + color present (the sheet layout)');
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const arr = geometry.attributes[name].array;
    for (let i = 0; i < arr.length; i++) assert.ok(Number.isFinite(arr[i]), `${name}[${i}] finite`);
  }
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  let inward = 0;
  let degenerate = 0;
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t);
    const i1 = idx.getX(t + 1);
    const i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1).sub(a);
    c.fromBufferAttribute(pos, i2).sub(a);
    b.cross(c);
    if (b.lengthSq() < 1e-16) degenerate++;
    n.fromBufferAttribute(nrm, i0).add(new Vector3().fromBufferAttribute(nrm, i1)).add(new Vector3().fromBufferAttribute(nrm, i2));
    if (b.dot(n) < 0) inward++;
  }
  assert.equal(degenerate, 0, 'no zero-area triangles');
  assert.equal(inward, 0, 'no inward-wound triangles');
});

test('sizes: 4–12 cm footprints, crown over the sheet, lit top over dark rim', () => {
  const list = specs(200);
  const { geometry } = buildMossTufts(list, noise);
  const pos = geometry.attributes.position;
  const col = geometry.attributes.color;
  let vi = 0;
  for (const s of list) {
    const fine = (s.rx + s.rz) * 0.5 < DEFAULT_TUFT_OPTIONS.fineRadius;
    const seg = DEFAULT_TUFT_OPTIONS.segments[fine ? 1 : 0];
    const rings = DEFAULT_TUFT_OPTIONS.rings[fine ? 1 : 0];
    const nVerts = seg * (rings + 1) + 1;
    const crown = vi + nVerts - 1;
    const p = new Vector3().fromBufferAttribute(pos, crown).sub(s.position);
    const up = p.dot(s.normal);
    assert.ok(up > s.h * 0.85 && up < s.h * 1.15, `crown ${up.toFixed(4)} ≈ h ${s.h.toFixed(4)}`);
    // the base ring sits under the sheet
    const base = new Vector3().fromBufferAttribute(pos, vi).sub(s.position);
    assert.ok(base.dot(s.normal) < 0, 'base ring sunk under the sheet');
    // footprint within 4–12 cm ± the outline noise
    const span = base.clone().projectOnPlane(s.normal).length();
    assert.ok(span > 0.012 && span < 0.09, `footprint radius ${span.toFixed(3)}`);
    // lit top brighter than the dark rim
    const rimG = col.getY(vi);
    const topG = col.getY(crown);
    assert.ok(topG > rimG * 1.6, `top ${topG.toFixed(3)} vs rim ${rimG.toFixed(3)}`);
    vi += nVerts;
  }
  assert.equal(vi, pos.count);
});

test('deterministic: the same specs build byte-identical geometry', () => {
  const g1 = buildMossTufts(specs(120, 3), noise).geometry;
  const g2 = buildMossTufts(specs(120, 3), noise).geometry;
  for (const name of ['position', 'normal', 'uv', 'color']) {
    assert.deepEqual(Array.from(g1.attributes[name].array), Array.from(g2.attributes[name].array), name);
  }
  assert.deepEqual(Array.from(g1.index.array), Array.from(g2.index.array));
});
