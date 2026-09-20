/**
 * Round 50 (vegetation-27) — the edges contract: fable-5's W05 / W06 fails
 * (.agents/reviews/fable-5-take0121.md). CPU only, no field build: the constants both sides of
 * the two features read must agree, and the seeded seats must be deterministic.
 *
 *  W06: the soil band at the grass → slab edge is 4–8 cm of exposed soil in the brief; ours is a
 *  soil-mat card band over RIM_CLEAR (the turf's noisy clearance) whose visible dark strip is that
 *  range, moss / tufts / leaves per metre bounded so the rim stays a band and not a hedge.
 *  W05: terrain/material.ts darkens the risers of the SAME faces vegetation/edges.ts puts its
 *  tuft rows / foot moss / toe ferns on — the two C_TERRACES copies (box, treads, step, downhill,
 *  facing, minSlope) and TERRACE_RISER must be identical, or the rows stand off their soil bands.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const modules = new Map(), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(file) {
  file = path.resolve(file); if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} }; modules.set(file, m);
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)((id) => {
    if (id === 'three') return THREE; if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts')); throw Error(id);
  }, m, m.exports); return m.exports;
}
const read = (name) => load(path.join(root, name + '.ts'));
const edges = read('vegetation/edges');
const material = read('terrain/material');

// W05 — the faces agree between the plants and the albedo mask
assert.equal(edges.TERRACE_RISER, material.TERRACE_RISER, 'the riser band height is one number');
assert.equal(edges.C_TERRACES.length, material.C_TERRACES.length, 'the same count of terraced faces');
for (let i = 0; i < edges.C_TERRACES.length; i++) {
  const a = edges.C_TERRACES[i], b = material.C_TERRACES[i];
  assert.equal(a.id, b.id, `face ${i}: id`);
  assert.deepEqual([...a.box], [...b.box], `face ${a.id}: plan box`);
  assert.deepEqual([...a.treads], [...b.treads], `face ${a.id}: tread heights`);
  assert.equal(a.step, b.step, `face ${a.id}: step`);
  assert.deepEqual([...a.downhill], [...b.downhill], `face ${a.id}: downhill`);
  assert.equal(a.facing, b.facing, `face ${a.id}: facing`);
  assert.equal(a.minSlope, b.minSlope, `face ${a.id}: minSlope`);
  // the face's own sanity: a unit downhill, ≥ 2 treads, the riser under the step
  assert.ok(Math.abs(Math.hypot(a.downhill[0], a.downhill[1]) - 1) < 0.02, `face ${a.id}: downhill is a unit vector`);
  assert.ok(a.treads[1] - a.treads[0] >= a.step, `face ${a.id}: at least two treads`);
  assert.ok(edges.TERRACE_RISER < a.step * 0.7, `face ${a.id}: the riser leaves a tread (${edges.TERRACE_RISER} < 0.7 × ${a.step})`);
  assert.ok(a.box[2] > a.box[0] && a.box[3] > a.box[1], `face ${a.id}: a box`);
}
// A's right foreground (the face's west part) stays out of the mound face
assert.ok(edges.C_TERRACES[0].box[0] >= 6.3, 'the mound face starts east of A\'s foreground');
assert.ok(material.TERRACE_SOIL_SHARE > 0.4 && material.TERRACE_SOIL_SHARE <= 0.85, 'the risers go mostly, not wholly, to soil');
assert.ok(material.TERRACE_WOBBLE > 0 && material.TERRACE_WOBBLE < edges.TERRACE_RISER * 0.3, 'the tread wobble stays inside the riser');

// W06 — the band's numbers
assert.ok(edges.RIM_CLEAR[0] >= 0.04 && edges.RIM_CLEAR[0] + edges.RIM_CLEAR[1] <= edges.RIM_BAND, 'the turf clearance is inside the band');
const soilStrip = [edges.RIM_CLEAR[0] - 0.06, edges.RIM_CLEAR[0] + edges.RIM_CLEAR[1] * 0.5];
assert.ok(soilStrip[0] >= 0.04 && soilStrip[1] <= 0.3, `the visible soil strip ${soilStrip.map((v) => (v * 100).toFixed(0)).join('–')} cm reads as the brief's 4–8 cm+ of earth, not a verge`);
assert.ok(edges.SOIL_MAT_LIGHT[1] < 0.5, 'soil mats are darker than the palette soil (lightness < ½)');
assert.ok(edges.RIM_MOSS_PER_M <= 3 && edges.RIM_TUFTS_PER_M <= 3 && edges.RIM_LEAVES_PER_M <= 2, 'the rim stays a band: ≤ 3 cushions / tufts and ≤ 2 leaves per metre');
assert.ok(edges.RIM_SPINE_Z[0] < -15 && edges.RIM_SPINE_Z[1] > 0, 'the spine stretch spans the plaza to the log');
// the clearance noise is a function of position only (no stream): the same in, the same out
assert.equal(edges.rimClear(1.234, -5.678), edges.rimClear(1.234, -5.678));
let lo = 1, hi = 0;
for (let i = 0; i < 400; i++) { const v = edges.rimClear(-3 + i * 0.023, -18 + i * 0.041); lo = Math.min(lo, v); hi = Math.max(hi, v); }
assert.ok(lo >= edges.RIM_CLEAR[0] - 1e-9 && hi <= edges.RIM_CLEAR[0] + edges.RIM_CLEAR[1] + 1e-9, 'rimClear stays in RIM_CLEAR');
assert.ok(hi - lo > edges.RIM_CLEAR[1] * 0.4, 'and wanders (a ragged line, not a straight one)');
for (const b of edges.RIM_BOXES) assert.ok(edges.inRimRegion((b[0] + b[2]) / 2, (b[1] + b[3]) / 2), 'every rim box is in the region');
assert.ok(!edges.inRimRegion(-30, 30) && !edges.inRimRegion(12, 8), 'the knoll and the C plateau are not rim');
console.log(`edges: ${edges.C_TERRACES.length} terraced faces agree with terrain/material (riser ${edges.TERRACE_RISER} m); rim band ${edges.RIM_BAND} m, clearance ${edges.RIM_CLEAR[0]}–${(edges.RIM_CLEAR[0] + edges.RIM_CLEAR[1]).toFixed(2)} m`);
