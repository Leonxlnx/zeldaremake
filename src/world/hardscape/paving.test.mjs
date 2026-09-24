/**
 * Round 50 (hardscape-32, fable-5 V16 / V17): the paving at the demo's scale and the hero flight's
 * tread tone. Run: node --test src/world/hardscape/paving.test.mjs (Node 20+, no browser).
 *
 * Lays the legacy paving pass exactly as index.ts does (same terrain view, same forks, density 1)
 * and checks, off the placed stones and the terrain:
 *   1. W03: ≥ 300 stones, ≥ 24 distinct outlines; the six house stepping discs are laid;
 *   2. the demo scale (`d_097`, d_111–117): the plaza / spine lattice stones' median span is
 *      0.8–1.1 m, the p90 under 1.6 m, and the visible joint between neighbouring outlines runs
 *      6–10 cm at the median — the numbers the `flagstoneMedianSpanM` / `jointMedianWidthM` audit
 *      fields report; the stair foot keeps a few larger landing slabs;
 *   3. every stone is seated: its top 1.5–9 cm over the ground under its centre, its bottom in the
 *      ground (character/ground.ts stands on these meshes);
 *   4. determinism: two runs lay byte-identical outlines;
 *   5. V17 (tone half): the main flight's treads lighten foot → top (× ≥ 1.2 over the run) while
 *      the other flights keep hardscape-31's level tone, and the main flight's tread NOSE points —
 *      the geometry the character walks — are take-0123's to the millimetre.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, `${target}.ts`, path.join(target, 'index.ts')]) if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
      }
      throw new Error(`Unexpected dependency: ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { createTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { placeFlagstones } = loadTs(path.join(here, 'flagstones.ts'));
const { buildStairway, stairFrame } = loadTs(path.join(here, 'stairs.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { LAYOUT, houseSteppingStones } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const { lawnZone, stairFoot } = loadTs(path.join(here, 'zones.ts'));

const T = createTerrain('live');
const frames = LAYOUT.stairs.map((s) => stairFrame(s));

/** the legacy paving pass, as index.ts lays it (the forks are label-keyed, so only the labels matter) */
function layPaving() {
  const rng = createRng(WORLD.seed).fork('hardscape');
  const pts = [...LAYOUT.pathSpine, ...LAYOUT.pathToStairs, ...LAYOUT.pathToHouse];
  const bbox = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of pts) {
    bbox.x0 = Math.min(bbox.x0, p[0] - 3.2);
    bbox.x1 = Math.max(bbox.x1, p[0] + 3.2);
    bbox.z0 = Math.min(bbox.z0, p[2] - 3.2);
    bbox.z1 = Math.max(bbox.z1, p[2] + 3.2);
  }
  bbox.x0 = Math.min(bbox.x0, -7.5);
  bbox.x1 = Math.max(bbox.x1, 7.5);
  bbox.z0 = Math.min(bbox.z0, -7.5);
  bbox.z1 = Math.max(bbox.z1, 7.5);
  const pc = { terrain: T, frames, rng: rng.fork('paving'), seed: WORLD.seed, bbox, density: 1, steppingStones: houseSteppingStones(), region: 'legacy' };
  return placeFlagstones(pc, new THREE.MeshStandardMaterial());
}

const quantiles = (v) => {
  const a = [...v].sort((p, q) => p - q);
  const q = (f) => (a.length ? a[Math.floor(f * (a.length - 1))] : 0);
  return { n: a.length, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
};
/** mean of the outline's extents along its principal axes — what a ruler on the top-down reads */
const spanOf = (poly) => {
  let cx = 0;
  let cz = 0;
  for (const p of poly) {
    cx += p.x / poly.length;
    cz += p.z / poly.length;
  }
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const p of poly) {
    sxx += (p.x - cx) ** 2;
    szz += (p.z - cz) ** 2;
    sxz += (p.x - cx) * (p.z - cz);
  }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ax = Math.cos(th);
  const az = Math.sin(th);
  let lo = Infinity;
  let hi = -Infinity;
  let lo2 = Infinity;
  let hi2 = -Infinity;
  for (const p of poly) {
    const u = (p.x - cx) * ax + (p.z - cz) * az;
    const v = -(p.x - cx) * az + (p.z - cz) * ax;
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
    lo2 = Math.min(lo2, v);
    hi2 = Math.max(hi2, v);
  }
  return (hi - lo + hi2 - lo2) / 2;
};
/** visible joint: from the midpoint of every other straight edge (≥ 11 cm) march along the normal to the next stone */
const measureJoints = (paving, stones) => {
  const widths = [];
  for (const s of stones) {
    const poly = s.polygon;
    const n = poly.length;
    let cx = 0;
    let cz = 0;
    for (const p of poly) {
      cx += p.x / n;
      cz += p.z / n;
    }
    for (let i = 0; i < n; i += 2) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.11) continue;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      let nx = -(b.z - a.z) / len;
      let nz = (b.x - a.x) / len;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) {
        nx = -nx;
        nz = -nz;
      }
      for (let d = 0.005; d <= 0.3; d += 0.005) {
        if (paving.onStone(mx + nx * d, mz + nz * d)) {
          widths.push(d);
          break;
        }
      }
    }
  }
  return quantiles(widths);
};
const outlineHash = (stones) => stones.map((s) => s.polygon.map((p) => `${Math.round(p.x * 1000)}:${Math.round(p.z * 1000)}`).join('|')).join('\n');

const paving = layPaving();
const discs = paving.steppingStones;
const lattice = paving.stones.filter((s) => !discs.some((d) => Math.hypot(s.x - d.x, s.z - d.z) < d.r * 0.6));
const plazaSpine = lattice.filter((s) => s.z > -14 && lawnZone(s.x, s.z) < 0.5);

test('W03: ≥ 300 stones, ≥ 24 shapes, the six house stepping discs', () => {
  assert.ok(paving.stones.length >= 300, `flagstones ${paving.stones.length} ≥ 300`);
  assert.ok(new Set(paving.stones.map((s) => s.shape)).size >= 24, 'distinct outlines ≥ 24');
  assert.equal(discs.length, houseSteppingStones().length, 'every house stepping stone has its disc');
  for (const d of discs) assert.ok(paving.onStone(d.x, d.z), `disc at (${d.x}, ${d.z}) is a stone`);
});

test('demo scale: plaza / spine stones 0.8–1.1 m at the median, joints 6–10 cm', () => {
  const span = quantiles(plazaSpine.map((s) => spanOf(s.polygon)));
  assert.ok(span.n >= 200, `enough plaza / spine stones to measure (${span.n})`);
  assert.ok(span.p50 >= 0.8 && span.p50 <= 1.1, `median span ${span.p50.toFixed(3)} m in 0.8–1.1`);
  assert.ok(span.p90 <= 1.6, `p90 span ${span.p90.toFixed(3)} m ≤ 1.6`);
  const joint = measureJoints(paving, plazaSpine);
  assert.ok(joint.n >= 500, `enough straight edges to measure (${joint.n})`);
  assert.ok(joint.p50 >= 0.06 && joint.p50 <= 0.1, `median visible joint ${(joint.p50 * 100).toFixed(1)} cm in 6–10`);
  assert.ok(joint.p10 >= 0.04, `p10 visible joint ${(joint.p10 * 100).toFixed(1)} cm ≥ 4`);
  // the stair foot (zones.ts `stairFoot`): the main flight's approach is camera C's trodden-earth
  // patch (zones.ts `earthPatch`, frame 46 s / d_097's bare right third), so the zone holds only
  // the plaza's edge cells beside it — they are demo-sized like the rest, not cracked smaller
  const foot = lattice.filter((s) => stairFoot(s.x, s.z) > 0.3).map((s) => spanOf(s.polygon));
  assert.ok(foot.length >= 3, `stones beside the stair foot (${foot.length})`);
  assert.ok(Math.max(...foot) >= 0.8, `the biggest stone at the stair foot spans ${Math.max(...foot).toFixed(2)} m ≥ 0.8`);
});

test('every stone is seated on the terrain', () => {
  for (const s of paving.stones) {
    const g = T.height(s.x, s.z);
    assert.ok(s.topY - g >= 0.01 && s.topY - g <= 0.1, `stone at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) top ${(s.topY - g).toFixed(3)} m over the ground`);
    assert.ok(s.bottomY < g + 0.005, `stone at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) bottom in the ground`);
  }
});

test('determinism: two runs lay the same stones', () => {
  const again = layPaving();
  assert.equal(again.stones.length, paving.stones.length);
  assert.equal(outlineHash(again.stones), outlineHash(paving.stones));
});

test('V17: the main flight lightens foot → top; the other flights and the nosings are as before', () => {
  const rng = createRng(WORLD.seed).fork('hardscape');
  const builds = LAYOUT.stairs.map((def) => ({ def, b: buildStairway(def, T, rng.fork(`stairs-${def.id}`), WORLD.seed) }));
  const main = builds.find((x) => x.def.id === 'main');
  assert.ok(main, 'the main flight exists');
  const tone = main.b.treadTone;
  assert.equal(tone.length, main.def.steps);
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const foot = mean(tone.slice(0, 4));
  const top = mean(tone.slice(-4));
  assert.ok(top / foot >= 1.2, `main flight top / foot tread tone ${(top / foot).toFixed(3)} ≥ 1.2`);
  assert.ok(foot >= 0.55 && top <= 1.05, `tones stay stone-toned (foot ${foot.toFixed(3)}, top ${top.toFixed(3)})`);
  for (const { def, b } of builds) {
    if (def.id === 'main') continue;
    const t = b.treadTone;
    assert.ok(mean(t) >= 0.6 && mean(t) <= 0.9, `${def.id} keeps its level tone (${mean(t).toFixed(3)})`);
  }
  // The main flight's first eight tread noses, re-pinned 2026-09-23 23:00 when the flight went to
  // 26 shallow treads for the owner's own reference (layout.ts `main`; the run, the total rise and
  // the bearing are unchanged, so the foot and the top tread are where they were — only the tread
  // count inside that envelope moved). Before that they were take-0123's audit values for the
  // 20-step flight, the first of which was [7.873, 0.27, 0.747].
  const expected = [
    [7.873, 0.207, 0.747],
    [6.952, 0.207, -0.435],
    [7.569, 0.418, -0.318],
    [8.495, 0.618, 0.163],
    [7.574, 0.618, -1.017],
    [8.227, 0.83, -0.836],
    [9.281, 1.034, -0.183],
    [8.345, 1.034, -1.383],
  ];
  for (let i = 0; i < expected.length; i++) {
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(main.b.treadNose[i][k] - expected[i][k]) <= 0.0015, `tread nose ${i} component ${k}: ${main.b.treadNose[i][k]} vs ${expected[i][k]}`);
  }
});
