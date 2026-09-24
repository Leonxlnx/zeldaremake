/** Run: node --test src/world/hardscape/logNosings.test.mjs (Node 20+, no browser needed). */
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
const { buildLogNosings, LOG_FLIGHTS, LOG_RADIUS, LOG_PROUD_R, STAIR_LOGS } = loadTs(path.join(here, 'logNosings.ts'));
const { stairFrame, worldToStair } = loadTs(path.join(here, 'stairs.ts'));
const { LAYOUT } = loadTs(path.join(here, '../layout.ts'));

// 2026-09-23 23:00: the hero flight went back to stone (the owner's own reference for it is the
// real game's stone stairway); the ledge flight is the one the timbers belong to — ref-03's right
// bank and the demo's `d_094` / `d_104`.
const main = LAYOUT.stairs.find((s) => s.id === 'ledge');
const build = buildLogNosings(main, 'test-seed');
const f = stairFrame(main);

test('the log flight takes the logs: one timber per riser, stakes where needed (not a fence rhythm), one mesh', () => {
  assert.equal(STAIR_LOGS, true);
  assert.ok(LOG_FLIGHTS.has('ledge'));
  assert.ok(!LOG_FLIGHTS.has('main'), 'the hero flight is stone');
  assert.equal(build.logs, main.steps);
  // 2026-09-23 (owner: the flight's "odd repeated pattern"): stakes no longer stand in a pair at every
  // second riser — most even steps and an odd one now and then, an end that sat firm gets none
  assert.ok(build.stakes >= main.steps * 0.6 && build.stakes <= main.steps * 1.2 && build.stakes !== Math.ceil(main.steps / 2) * 2, `${build.stakes} stakes`);
  for (const name of ['position', 'normal', 'uv', 'color']) assert.ok(build.geometry.attributes[name], `attribute ${name}`);
  assert.ok(build.geometry.index, 'indexed');
  // per riser, so the bound means the same on whichever flight carries the timbers
  assert.ok(build.triangles > 500 * main.steps && build.triangles < 2000 * main.steps, `${build.triangles} triangles over ${main.steps} steps`);
});

test('every timber rides its step: crown above the tread top, the log across the whole width and past both flanks', () => {
  const P = build.geometry.attributes.position;
  const hw = main.width / 2;
  // bucket the vertices by step from their along-run coordinate (the log of step i lies just before i·tread)
  const perStep = Array.from({ length: main.steps }, () => ({ maxY: -Infinity, minY: Infinity, minAcross: Infinity, maxAcross: -Infinity }));
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const [across, along] = worldToStair(f, x, z);
    const i = Math.round((along + 0.05) / main.tread);
    if (i < 0 || i >= main.steps) continue;
    const s = perStep[i];
    // stakes stand past the flanks and reach below the tread; the log body is what the crown test wants
    if (Math.abs(across) <= hw) {
      s.maxY = Math.max(s.maxY, y);
      s.minY = Math.min(s.minY, y);
    }
    s.minAcross = Math.min(s.minAcross, across);
    s.maxAcross = Math.max(s.maxAcross, across);
  }
  for (let i = 0; i < main.steps; i++) {
    const treadTop = main.base[1] + (i + 1) * main.rise;
    const s = perStep[i];
    const crown = s.maxY - treadTop;
    assert.ok(crown > LOG_PROUD_R * LOG_RADIUS[0] * 0.8 && crown < LOG_PROUD_R * LOG_RADIUS[1] * 1.6, `step ${i}: crown ${(crown * 100).toFixed(1)} cm above the tread`);
    assert.ok(treadTop - s.minY < 2 * LOG_RADIUS[1] + 0.02, `step ${i}: the log's underside ${((treadTop - s.minY) * 100).toFixed(1)} cm below the tread top`);
    assert.ok(s.minAcross < -hw - 0.05 && s.maxAcross > hw + 0.05, `step ${i}: the timber spans ${s.minAcross.toFixed(2)} … ${s.maxAcross.toFixed(2)} across a ${main.width} m flight`);
  }
});

test('the crowns carry moss and the undersides are darker; the build is deterministic and hash-driven (no stream)', () => {
  const C = build.geometry.attributes.color;
  const N = build.geometry.attributes.normal;
  let upG = 0, upN = 0, downL = 0, downN = 0;
  for (let v = 0; v < C.count; v++) {
    const ny = N.getY(v);
    const l = 0.2126 * C.getX(v) + 0.7152 * C.getY(v) + 0.0722 * C.getZ(v);
    if (ny > 0.7) (upG += C.getY(v) - (C.getX(v) + C.getZ(v)) / 2), upN++;
    else if (ny < -0.7) (downL += l), downN++;
  }
  assert.ok(upN > 60 * main.steps && downN > 60 * main.steps, `up ${upN} / down ${downN} vertices over ${main.steps} steps`);
  assert.ok(upG / upN > 0.02, `the crowns lean green: mean G − (R+B)/2 = ${(upG / upN).toFixed(3)}`);
  assert.ok(downL / downN < 1.0, `the undersides are not lifted: mean l ${(downL / downN).toFixed(3)}`);
  const again = buildLogNosings(main, 'test-seed');
  assert.deepEqual(Array.from(again.geometry.attributes.position.array), Array.from(build.geometry.attributes.position.array), 'positions reproduce');
  const other = buildLogNosings(main, 'another-seed');
  assert.notDeepEqual(Array.from(other.geometry.attributes.position.array), Array.from(build.geometry.attributes.position.array), 'the seed matters');
});


test('tube sides and caps face outward; FrontSide rays hit the outer crown', () => {
  const g = build.geometry, P = g.attributes.position, N = g.attributes.normal, I = g.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const geometric = new THREE.Vector3(), authored = new THREE.Vector3(), tmp = new THREE.Vector3();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  let crowns = 0;
  for (let i = 0; i < I.count; i += 3) {
    a.fromBufferAttribute(P, I.getX(i)); b.fromBufferAttribute(P, I.getX(i+1)); c.fromBufferAttribute(P, I.getX(i+2));
    geometric.crossVectors(tmp.copy(b).sub(a), c.clone().sub(a)).normalize();
    authored.set(0, 0, 0);
    for (let k=0; k<3; k++) authored.add(tmp.fromBufferAttribute(N, I.getX(i+k)));
    assert.ok(geometric.dot(authored.normalize()) > 0.5, `triangle ${i/3} must face outward`);
    if (geometric.y < 0.8 || (i / 3) % 37 !== 0) continue;
    const origin = a.clone().add(b).add(c).divideScalar(3); origin.y += 1;
    ray.set(origin, down); mesh.material.side = THREE.FrontSide;
    const front = ray.intersectObject(mesh, false)[0];
    mesh.material.side = THREE.DoubleSide;
    const both = ray.intersectObject(mesh, false)[0];
    assert.ok(front && both && Math.abs(front.point.y-both.point.y) < 1e-8, 'one-sided crown must match the outer surface');
    crowns++;
  }
  assert.ok(crowns > 20, 'check crowns throughout the flight');
});
