/** Run: node --test src/world/rocks/ravine.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

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
const { buildRavineRocks, BRIDGE_CLEAR_M, OUTCROP_BAND, MIN_DEPTH_M, nearRavine } = loadTs(path.join(here, 'ravine.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { expansionVisible, sunVector } = loadTs(path.join(here, '../util/expansionLocality.ts'));
const { getTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { ravineProfile, bridgeLocal } = loadTs(path.join(here, '../terrain/south.ts'));
const { LAYOUT } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));

// the real world: the ravine's own profile and the live heightfield
const build = buildRavineRocks(createRng('test/rocks').fork('ravine'), 'seed', [-0.5, -0.86]);
const sun = sunVector(WORLD.sun.azimuthDeg, WORLD.sun.elevationDeg);

test('the ravine builds one geometry with the rock material attributes, a caster per piece, stone on both walls and the floor', () => {
  assert.ok(build);
  for (const name of ['position', 'normal', 'color', 'aMoss', 'aWet', 'aLichen']) assert.ok(build.geometry.attributes[name], `attribute ${name}`);
  assert.equal(build.casters.length, build.stats.outcrops + build.stats.floorBoulders, 'one caster per piece');
  assert.ok(build.stats.outcrops >= 10 && build.stats.floorBoulders >= 3, JSON.stringify(build.stats));
  const sides = new Set(build.seats.filter((s) => s.g < 0.9).map((s) => s.side));
  assert.equal(sides.size, 2, 'outcrops on both walls');
  // a new area's whole rock under 150 K triangles, and it is one draw
  assert.ok(build.stats.triangles < 150000, `${build.stats.triangles} triangles`);
});

test('every piece is inside the gorge, on its wall band or its floor, off the bridge frame at the lips, on the live ground', () => {
  const T = getTerrain();
  for (let i = 0; i < build.contacts.length; i++) {
    const [x, y, z] = build.contacts[i];
    const seat = build.seats[i];
    const prof = ravineProfile(x, z);
    assert.ok(prof && prof.cut > 0.05, `seat (${x.toFixed(1)}, ${z.toFixed(1)}) is outside the gorge`);
    // (prof.hit is the profile's shared scratch: read before the terrain calls below)
    const D = prof.hit.D;
    assert.ok(D >= MIN_DEPTH_M, `seat (${x.toFixed(1)}, ${z.toFixed(1)}) on a shallow end (D ${D.toFixed(1)})`);
    assert.ok(Math.abs(y - T.height(x, z)) < 1e-6, `seat height ${y.toFixed(2)} vs the live ground ${T.height(x, z).toFixed(2)}`);
    const across = Math.abs(bridgeLocal(x, z).c);
    if (seat.g < 0.9) {
      assert.ok(seat.g >= OUTCROP_BAND[0] && seat.g <= OUTCROP_BAND[1], `outcrop at g ${seat.g.toFixed(2)}`);
      if (seat.g < 0.45) assert.ok(across >= BRIDGE_CLEAR_M, `an upper-wall outcrop ${across.toFixed(1)} m from the bridge axis`);
    } else {
      assert.ok(across >= BRIDGE_CLEAR_M, `a floor boulder ${across.toFixed(1)} m from the bridge axis`);
    }
    const m = T.mask(x, z);
    assert.ok(m.path < 0.05 && m.structure < 0.3, `seat (${x.toFixed(1)}, ${z.toFixed(1)}) on paving or a structure`);
  }
});

test('the casters are conservative: every vertex lies inside the union of the body spheres', () => {
  const bodies = build.bodies;
  const P = build.geometry.attributes.position;
  const v = new THREE.Vector3();
  let escaped = 0;
  let worst = 0;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    let best = Infinity;
    for (const s of bodies) best = Math.min(best, v.distanceTo(s.center) - s.radius);
    if (best > 1e-6) {
      escaped++;
      worst = Math.max(worst, best);
    }
  }
  assert.equal(escaped, 0, `${escaped} vertices escape the body spheres, worst by ${(worst * 100).toFixed(1)} cm`);
});

test('no fixed camera but C (which already sees the south) meets a ravine sphere; a walker on the deck does', () => {
  const spheres = build.spheres(sun);
  // camera C looks back south over the plaza and already sees the south expansion (its README:
  // "Heroes: only C changes"); the ravine's rock lies in its far field and is measured there, not hidden
  for (const vp of LAYOUT.viewpoints) {
    const cam = new THREE.PerspectiveCamera(vp.fov, 1280 / 720, 0.1, 500);
    cam.position.set(...vp.position);
    cam.lookAt(new THREE.Vector3(...vp.target));
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const sees = expansionVisible(cam, spheres);
    // the runtime draws only within RAVINE_DRAW_M of the gorge AND with a sphere in view: C's frustum
    // reaches the spheres but C stands 38 m off; A stands 22 m off and looks north
    const drawn = nearRavine(vp.position[0], vp.position[2]) && sees;
    assert.equal(drawn, false, `${vp.id} would draw the ravine rock`);
    if (vp.id === 'C_lookback') assert.equal(nearRavine(vp.position[0], vp.position[2]), false, 'C is inside the draw distance');
    else assert.equal(sees, false, `${vp.id} meets a ravine sphere`);
  }
  assert.equal(nearRavine(4.3, 37), true, 'the deck is inside the draw distance');
  assert.equal(nearRavine(-1.5, 29.5), true, 'the north rim is inside the draw distance');
  const walker = new THREE.PerspectiveCamera(50, 1280 / 720, 0.1, 500);
  walker.position.set(4.3, 1.0, 37);
  walker.lookAt(new THREE.Vector3(-8, -4, 38.5));
  walker.updateMatrixWorld();
  walker.updateProjectionMatrix();
  assert.equal(expansionVisible(walker, spheres), true, 'the walker on the deck does not see the ravine rock');
});

test('deterministic: the same seed builds the same seats', () => {
  const again = buildRavineRocks(createRng('test/rocks').fork('ravine'), 'seed', [-0.5, -0.86]);
  assert.deepEqual(again.contacts, build.contacts);
  assert.equal(again.stats.triangles, build.stats.triangles);
});
