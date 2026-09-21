/** Run: node --test src/world/rocks/backside.test.mjs (Node 20+, no browser needed). */
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
const { buildBacksideRocks } = loadTs(path.join(here, 'backside.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { expansionVisible, sunVector } = loadTs(path.join(here, '../util/expansionLocality.ts'));
const { getTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { LAYOUT, EXPANSION } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));

// the real world: the backside is placed against the layout's EXPANSION and the live heightfield
const build = buildBacksideRocks(createRng('test/rocks').fork('backside'), 'seed', [-0.5, -0.86]);
const sun = sunVector(WORLD.sun.azimuthDeg, WORLD.sun.elevationDeg);

test('the backside builds one geometry with the rock material attributes and a caster per piece', () => {
  assert.ok(build);
  for (const name of ['position', 'normal', 'color', 'aMoss', 'aWet', 'aLichen']) assert.ok(build.geometry.attributes[name], `attribute ${name}`);
  const pieces = build.stats.boulders + build.stats.stepStones + build.stats.scree + build.stats.kerbStones + build.stats.discPebbles;
  assert.equal(build.casters.length, pieces, 'one caster per piece');
  assert.ok(build.stats.boulders >= 2 && build.stats.scree >= 10 && build.stats.stepStones >= 2, JSON.stringify(build.stats));
});

test('the casters are conservative: every vertex lies inside the union of the body spheres', () => {
  // (Astra's audit of the first cut: 1 876 vertices escaped spheres whose radius had been scaled by
  // squashY — a latent false cull. The bodies are each piece's exact bounding sphere under its matrix;
  // the runtime tests these plus the casters' stacks and shadow sweeps — `spheres()`.)
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

test('every seat is on the live ground, off the treads and the paving, and west of camera C\'s edge', () => {
  const T = getTerrain();
  const C = EXPANSION.cClip;
  for (const [x, y, z] of build.contacts) {
    assert.ok(Math.abs(y - T.height(x, z)) < 0.2, `seat ${y} vs ground ${T.height(x, z)}`);
    const m = T.mask(x, z);
    assert.ok(m.stairs < 0.2 && m.path < 0.05, `seat (${x.toFixed(2)}, ${z.toFixed(2)}) on treads / paving`);
    const edgeX = C.x0 + C.dxdz * (z - C.z0);
    assert.ok(edgeX - x > 1.0, `seat (${x.toFixed(2)}, ${z.toFixed(2)}) within 1 m of camera C's edge`);
  }
});

test('none of the six fixed cameras meets a backside sphere (body + shadow sweep)', () => {
  const spheres = build.spheres(sun);
  for (const vp of LAYOUT.viewpoints) {
    const cam = new THREE.PerspectiveCamera(vp.fov, 1280 / 720, 0.1, 500);
    cam.position.set(...vp.position);
    cam.lookAt(new THREE.Vector3(...vp.target));
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    assert.equal(expansionVisible(cam, spheres), false, `${vp.id} meets a backside sphere`);
  }
  // and a walker at the bank's toe does see it (the toggle is not simply off)
  const walker = new THREE.PerspectiveCamera(46, 1280 / 720, 0.1, 500);
  walker.position.set(-10.5, 1.5, 11.5);
  walker.lookAt(new THREE.Vector3(-16.2, 1.0, 15.2));
  walker.updateMatrixWorld();
  walker.updateProjectionMatrix();
  assert.equal(expansionVisible(walker, spheres), true, 'the walker at the toe does not see the backside');
});
