// node --test src/audio/occlusion.test.mjs — what stands between him and a sound.
//
// Rubric check 45 scored 0: nothing in the world blocked anything, every source in the bed was
// distance-only. The study that chose the target is `art/audio/2026-09-25-occlusion/` and its
// finding is the reason this applies to birds and not to the pod flames: an obstacle only shadows
// what spans several wavelengths of it, and through the median 3.1 m of wood a player can get
// between himself and a source the Fresnel number is 2.4 at the flame's husk — it bends round — but
// 32 for a distant bird and 126 for a near one.
//
// `occlusionAt` is a pure function of the layout, so the geometry is asserted directly. The two
// ways it can go quietly wrong are a bole counting when it is behind the listener (everything
// shadowed, everywhere) and the segment clamp being wrong at the ends (a source standing inside a
// trunk blocking itself), so both have a test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (!name.startsWith('.')) return nodeRequire(name);
      const target = path.resolve(path.dirname(file), name);
      for (const c of [target + '.ts', path.join(target, 'index.ts'), target]) if (existsSync(c)) return loadTs(c);
      throw Error(`cannot resolve ${name} from ${file}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const here = path.dirname(new URL(import.meta.url).pathname);
const { occlusionAt, OCCLUSION_FULL_M } = loadTs(path.join(here, 'index.ts'));
const { LAYOUT, EXPANSION } = loadTs(path.join(here, '../world/layout.ts'));
const A = loadTs(path.join(here, 'ambience.ts'));

/**
 * The most isolated bole in the world (`north-west`, 21.4 m from anything else), so a line drawn
 * through it carries its wood and nobody else's. The widest bole would be the obvious choice and is
 * the wrong one: `plaza-south` has another trunk 7.7 m off, close enough to clip a grazing line.
 */
const widest = LAYOUT.giantTrees.reduce((a, b) => {
  const clearance = (t) => Math.min(...LAYOUT.giantTrees.filter((o) => o !== t).map((o) => Math.hypot(o.position[0] - t.position[0], o.position[2] - t.position[2])));
  return clearance(b) > clearance(a) ? b : a;
});
const bole = { x: widest.position[0], z: widest.position[2], r: widest.trunkRadius };

test('a line through a bole is blocked in proportion to the wood on it', () => {
  // straight through the middle: the chord is the full diameter
  const through = occlusionAt(bole.x - 8, bole.z, bole.x + 8, bole.z);
  assert.ok(Math.abs(through - (2 * bole.r) / OCCLUSION_FULL_M) < 1e-9, `dead through the ${widest.id} reads ${through.toFixed(3)}, expected its diameter over ${OCCLUSION_FULL_M} m`);
  // grazing the edge: less, and still some
  const graze = occlusionAt(bole.x - 8, bole.z + bole.r * 0.9, bole.x + 8, bole.z + bole.r * 0.9);
  assert.ok(graze > 0 && graze < through, `grazing reads ${graze.toFixed(3)}, which must sit between nothing and ${through.toFixed(3)}`);
  // and a hand's breadth outside it: nothing at all, no soft edge that shadows the whole wood
  assert.equal(occlusionAt(bole.x - 8, bole.z + bole.r + 0.01, bole.x + 8, bole.z + bole.r + 0.01), 0);
});

test('only what is between them counts', () => {
  // he is standing just clear of the bole; the source is the other way from it
  assert.equal(occlusionAt(bole.x + bole.r + 0.5, bole.z, bole.x + 20, bole.z), 0, 'a bole behind him must not shadow what is in front of him');
  // and 8 m past the source
  assert.equal(occlusionAt(bole.x - 20, bole.z, bole.x - bole.r - 0.5, bole.z), 0, 'a bole past the source must not shadow it either');
  // it is the same line either way round
  const a = occlusionAt(bole.x - 9, bole.z + 0.4, bole.x + 7, bole.z - 0.3);
  const b = occlusionAt(bole.x + 7, bole.z - 0.3, bole.x - 9, bole.z + 0.4);
  assert.ok(Math.abs(a - b) < 1e-12, 'listener and source swapped must give the same wood');
  // a source in the same place as the listener has nothing between them
  assert.equal(occlusionAt(3, 4, 3, 4), 0);
});

test('a hut built round a trunk is one obstacle, not two', () => {
  // the west house stands on `southwest-giant` — same point to the centimetre. Counted naively the
  // line through them gets both diameters, 10.6 m of wood where the world has 6.8, and the one spot
  // this lane measured the largest shadow at was the double-counted one.
  const wh = EXPANSION.westHouse;
  const through = occlusionAt(wh.host[0] - 14, wh.host[1], wh.host[0] + 14, wh.host[1]);
  assert.ok(Math.abs(through - Math.min(1, (2 * wh.radius) / OCCLUSION_FULL_M)) < 1e-9, `through the west house reads ${through.toFixed(3)} — its own diameter is ${(2 * wh.radius).toFixed(1)} m and the trunk inside it must not be added again`);
});

test('the open world is open', () => {
  // a spot chosen to be clear: the middle of the plaza, looking a short way east
  assert.equal(occlusionAt(1.5, -6, 4.5, -6), 0, 'the plaza must not shadow itself');
  // and nothing ever reads over 1, however many boles line up
  for (const t of LAYOUT.giantTrees) {
    const v = occlusionAt(t.position[0] - 40, t.position[2], t.position[0] + 40, t.position[2]);
    assert.ok(v >= 0 && v <= 1, `${t.id}: ${v}`);
  }
});

test('a shadow takes the top off harder than it takes the level', () => {
  // the whole point of check 45: an obstacle wide enough to matter removes the high end far harder
  // than the low, so this must never become a plain fader
  assert.ok(A.OCCLUSION_TOP < 1 - A.OCCLUSION_DUCK, `the top must fall further than the level: ${A.OCCLUSION_TOP} against ${1 - A.OCCLUSION_DUCK}`);
  assert.ok(A.OCCLUSION_DUCK > 0 && A.OCCLUSION_DUCK < 1, 'a bole is not a wall: a shadowed bird is quieter, not gone');
  assert.ok(A.PERCH_DROP_M > A.PERCH_FAR_M, 'a bird is retired only once it is out past the distance clamp, where swapping it cannot be heard');
});

test('a wall takes less off a flame than off a bird, because a flame is low', () => {
  // Barrier attenuation through the median 3.10 m of wood: 20.6 dB at the flame's 320 Hz body
  // against 28.1 at a distant bird's 1800 Hz. The birds duck 0.5, so the flame's share of that is
  // 0.40 — a number out of the physics, not a taste, and it must stay under the birds'.
  assert.ok(A.FLAME_DUCK > 0, 'a lantern behind a wall has to be quieter than one in the open');
  assert.ok(A.FLAME_DUCK < A.OCCLUSION_DUCK, `a 320 Hz flame cannot be shadowed as hard as a 1800 Hz bird: ${A.FLAME_DUCK} against ${A.OCCLUSION_DUCK}`);
  const barrier = (n) => 20 * Math.log10(Math.sqrt(2 * Math.PI * n) / Math.tanh(Math.sqrt(2 * Math.PI * n))) + 5;
  // N = 2 * 3.10 m / lambda, from `2026-09-25-occlusion`'s survey of the wood a player can get between
  const wanted = A.OCCLUSION_DUCK * (barrier((2 * 3.1 * 320) / 343) / barrier((2 * 3.1 * 1800) / 343));
  assert.ok(Math.abs(A.FLAME_DUCK - wanted) < 0.05, `the flame's duck should be ${wanted.toFixed(2)} by the barrier physics, not ${A.FLAME_DUCK}`);
});

test('the flame is ducked per pod, not once for the village', () => {
  // A village of lanterns is summed into one voice, and the listener can be behind the west house
  // from five of them while three more are in the open beside him. A single shadow for the whole
  // sum would take the near ones down with the far, so the test is on the source: the occlusion
  // lookup has to be inside the loop over pods.
  const src = readFileSync(path.join(here, 'ambience.ts'), 'utf8');
  const loop = src.slice(src.indexOf('for (const p of s.pods)'), src.indexOf('const level = Math.min(1, nearest'));
  assert.ok(loop.length > 0 && loop.length < 900, 'the pod loop moved; this guard is reading the wrong text');
  assert.match(loop, /occludeNow\(p\.x, p\.z\)/, 'each pod must be shadowed by what stands in front of IT');
  assert.match(loop, /FLAME_DUCK/, 'the pod loop must apply the flame duck');
});
