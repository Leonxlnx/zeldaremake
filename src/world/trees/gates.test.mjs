/**
 * Run: node --test src/world/trees/gates.test.mjs (Node 20+, no browser needed).
 *
 * The four numbers that decide where this lane's geometry lives, pinned with the measurement that chose
 * each one. They look like taste and they are not: every one of them was moved, measured at the owner's
 * poses and at the budget, and put back or left where it is. A future tuner who nudges one without
 * re-running that measurement will spend the hours again, so the reasons live here beside the values.
 *
 * The measurements are in `art/environment/squad2-2026-09-23/`:
 *
 *   • `lodcheck/`   — the rungs against every tree forced high (`?treelod=10`); the residual pop is the
 *                     high→medium rung, and 32 m is what the budget paid for when hero A had 30 K of
 *                     headroom. `dither/PART6-*` later measured a single tree's swap at 0.22 % of a frame
 *                     against the 45.96 % one 0.1 m walking step already moves — so the pop that remains
 *                     is below what a walking frame shows, and the rung does not want moving again.
 *   • `midspend/`   — `MID_FAR_LOD_M` 40 → 52 m moves 0.003–0.054 % of the owner's three poses for
 *                     +4 K triangles: inert in both directions, because the 40–52 m ring stands behind
 *                     the nearer canopy at every plaza camera.
 *   • `farring/`    — the ring's population: 680 → 960 places 276 more trees and moves 0.06–0.22 % of the
 *                     owner's frames, because the fog reaches its far value at 190 m.
 *   • `farring/RADIUS.md` — the ring's outer radius: 215 → 150 m removes **14 trees**, so the radius does
 *                     not bind at all; the placer's own distribution keeps everything inside 150 m.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'index.ts'), 'utf8');

const num = (name) => {
  const m = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(m, `${name} is gone from trees/index.ts`);
  return Number(m[1]);
};

test('the sun depth pass culls per giant group and tests the pooled near bases', () => {
  const src = source;
  // the colour-pass group trick has a depth-pass twin: three r163+ calls these per group
  assert.match(src, /mesh\.onBeforeShadow = /, 'the group cull must run in the depth pass');
  assert.match(src, /mesh\.onAfterShadow = /, 'a zeroed group must have its count restored');
  assert.match(src, /groupCasts/, 'the per-group depth decision must be named in userData');
  // and it must be the conservative test, not a distance guess
  const submit = src.slice(src.indexOf('const submitGiants = ()'), src.indexOf('/** trim every bucket for'));
  assert.match(submit, /casts\[i\] = shadowReachesGround\(spheres\[i\]\)/, 'per group: the swept-capsule test, ended at the ground');
  assert.match(submit, /if \(!any\) mesh\.castShadow = false/, 'a sector with no casting group should not draw at all');
  // the pooled near bases: narrowed per frame, never widened past what the build armed
  assert.match(submit, /for \(const nb of nearBoles\)/, 'the near bases need a per-frame shadow test');
  assert.match(submit, /staticCasts !== true/, "quality.shadows and a column's casts flag still bind");
  assert.match(submit, /mesh\.castShadow = shadowReachesGround\(sphere\)/, 'the near base test is the same capsule test');
  // the test itself lives in util/shadowReach.ts since 2026-09-28; this lane wires it and uses it
  assert.match(src, /const shadowReachesGround = \(s: Sphere\) => shade\.reaches\(s\)/, 'the lane must call the util');
  assert.match(src, /createShadowReach\(\{ groundAt: \(x, z\) => liveTerrain\.height\(x, z\), floorY: SHADOW_FLOOR_Y, padM: CULL_PAD_M \}\)/, 'wired to the live ground, the world floor and the wind pad');
  assert.match(src, /shade\.prepare\(camera, /, 'the frustum and sun must be prepared every cull');
  const util = readFileSync(new URL('../util/shadowReach.ts', import.meta.url), 'utf8');
  assert.match(util, /marchAt\.y \+ s\.radius <= groundAt\(marchAt\.x, marchAt\.z\)/, 'stop only when the swept sphere is wholly at or below the ground');
  assert.match(util, /const full = Math\.max\(0, \(s\.center\.y \+ s\.radius - floorY\)/, 'the floor stays the outer bound');
  assert.match(util, /if \(frustum\.intersectsSphere\(s\)\) return true;/, 'a caster on screen answers itself');
  assert.match(util, /marchSphere\.radius = s\.radius \+ d \/ 2;/, 'the capsule is walked with covering spheres');
  // both pools arm `staticCasts` at build, or the per-frame test can never turn them on again
  assert.equal((src.match(/userData\.staticCasts = mesh\.castShadow/g) ?? []).length, 2, 'both near-base pools must record what the build armed');
});

test('the giants phase is split into named steps that bracket their parts', () => {
  const src = source;
  // every `step`/`mark` name appears once, so no two regions accumulate into the same audit key
  const names = [...src.matchAll(/(?:^|[^a-zA-Z])(?:step|mark)\('([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 8, `expected the giants load map to be split, saw ${names.length}`);
  assert.deepEqual([...new Set(names)].sort(), [...names].sort(), `duplicate step name: ${names.join(', ')}`);
  // the two totals bracket the loop and its tail; the parts below are what the split accounts for
  for (const total of ['giants-loop-total', 'giants-tail-total']) assert.ok(names.includes(total), `missing ${total}`);
  for (const part of ['to-world', 'near-pool-register', 'tail-sectors', 'tail-mid-place', 'crown-materials']) {
    assert.ok(names.includes(part), `missing step ${part}`);
  }
  // `giantStepMs` is what publishes them, and the audit must carry it
  assert.match(src, /giantStepMs: \{ \.\.\.giantStepMs \}/);
});

test('the tree LOD rungs are where the pop measurement left them', () => {
  const near = num('TREE_LOD_NEAR_M');
  const mid = num('TREE_LOD_MID_M');
  assert.equal(near, 32, 'TREE_LOD_NEAR_M 32 m is the high→medium rung lodcheck/ settled; moving it changes the pop AND the budget, so it needs both measured again');
  assert.equal(mid, 44, 'TREE_LOD_MID_M 44 m is the medium→low rung; lodcheck/ measured 44 → 59 m as no improvement in pop');
  assert.ok(near < mid, 'the rungs must stay ordered');
});

test('the distant layer takes over at the gate lodcheck pulled it to', () => {
  assert.equal(num('DISTANT_NEAR_M'), 45, "DISTANT_NEAR_M 45 m is what let round 54 retire the stand's own 50 m rule (fable-4's #81): a later gate costs draws for a layer measured at 24 triangles a tree");
});

test("the mid layer's far rung is at the point where it stops reading", () => {
  const m = source.match(/MID_FAR_LOD_M/);
  assert.ok(m, 'the mid layer lost its far rung');
  const distant = readFileSync(path.join(here, 'distant.ts'), 'utf8');
  const v = distant.match(/export const MID_FAR_LOD_M = ([0-9.]+);/);
  assert.ok(v, 'MID_FAR_LOD_M is gone from distant.ts');
  assert.equal(Number(v[1]), 40, 'MID_FAR_LOD_M 40 m: midspend/ measured 40 → 52 m at 0.003–0.054 % of the owner s poses for +4 K triangles, i.e. inert, because those trees stand behind the nearer canopy');
});

test('the far ring keeps the population and the radius the measurements chose', () => {
  const target = source.match(/const distantTarget = Math\.round\(([0-9]+) \*/);
  assert.ok(target, 'the distant target is gone');
  assert.equal(Number(target[1]), 680, 'farring/: 680 → 960 places 276 more trees and moves 0.06–0.22 % of the owner s frames — the fog reaches its far value at 190 m, so density there does not read');
  const place = source.match(/placeDistantTrees\(rng, terrain, distantVariants, distantTarget, ([0-9]+), ([0-9]+),/);
  assert.ok(place, 'the ring placement call changed shape');
  assert.equal(Number(place[1]), 60, 'the ring still starts at 60 m, where the mid layer hands over');
  assert.equal(Number(place[2]), 215, 'farring/RADIUS.md: 215 → 150 m removes 14 trees, so the outer radius does not bind — changing it only reshuffles the placer');
});

test('the rung scale knob is a dev multiplier and ships neutral', () => {
  const at = source.indexOf('const TREE_LOD_SCALE');
  assert.notEqual(at, -1, 'TREE_LOD_SCALE is gone: `?treelod=` is how every rung measurement in lodcheck/ was taken');
  const body = source.slice(at, source.indexOf('})();', at));
  assert.match(body, /if \(!raw\) return \[1, 1, 1, 1\];/, 'without the query parameter every rung must stay where the measurements put it');
  assert.match(body, /typeof location === 'undefined'\) return \[1, 1, 1, 1\]/, 'and a headless build with no location must be neutral too');
  assert.match(body, /get\('treelod'\)/, 'the knob reads ?treelod=, which the lodcheck evidence cites');
});

/**
 * The build-phase split (`buildPhases` in the trees audit) exists because `buildMs.trees` says this system
 * is 19.6 % of a 42.7 s load without saying where inside it. Measured on head `1232f1d3`, three runs with
 * the first dropped: **giants 4,798 ms (63 %)**, columns 1,254, white-barks 954, the distant and mid layers
 * with the pools and publish 528, understory 72. A load pass that wants the trees wants the giants.
 *
 * Pinned because it is a few lines a refactor would not miss: the boundaries are the `ctx.progress`
 * checkpoints, so if one moves the split silently becomes meaningless.
 */
test('the build-phase split is reported and keyed to the progress checkpoints', () => {
  assert.match(source, /const buildPhases: Record<string, number> = \{\};/, 'the phase map is gone');
  assert.match(source, /buildPhases: \{ \.\.\.buildPhases \},/, 'the audit no longer reports it');
  for (const name of ['white-barks', 'understory', 'columns', 'giants', 'distant-mid-and-publish']) {
    assert.match(source, new RegExp(`phase\\('${name}'\\)`), `the ${name} boundary is gone`);
  }
  assert.ok(source.indexOf("phase('white-barks')") > source.indexOf("ctx.progress('trees', 0.5)"), 'each phase must close at the progress checkpoint it belongs to');
});
