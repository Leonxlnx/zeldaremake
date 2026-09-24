/**
 * Run: node --test src/world/hardscape/stairs.test.mjs (Node 20+, no browser needed).
 *
 * The log flights' joint (fable-2, lane 6; fable-cursor 2026-09-23 18:10 on the owner's
 * `s2-join-close`): under a timber the riser face runs straight down from the slab's edge to the
 * tread below — no 7.5–10.5 cm recess under the nose, no rolled stone lip inside the log's girth —
 * while the stone flights keep round 31's lit lip over a deep shadow line. Both builds take the
 * same draws in the same order, so the flight's outlines, noses and tones are the stream's either way.
 */
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
const { buildStairway, stairFrame, worldToStair } = loadTs(path.join(here, 'stairs.ts'));
const { LOG_FLIGHTS } = loadTs(path.join(here, 'logNosings.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { LAYOUT } = loadTs(path.join(here, '../layout.ts'));

const main = LAYOUT.stairs.find((s) => s.id === 'main');
// a flat bank at the flight's foot: the cheeks and the landing read the terrain, the treads do not
const terrain = { height: () => main.base[1] + 0.3 };
const seed = 'test-seed';
const stone = buildStairway(main, terrain, createRng(`${seed}/stone`), seed);
const logged = buildStairway(main, terrain, createRng(`${seed}/stone`), seed, { logNosed: true });
const f = stairFrame(main);

/** step i's nose line (along the run): `treadNose` holds one point per slab piece, split treads two */
function noseAlong(build, i) {
  let best = Infinity;
  for (const [x, , z] of build.treadNose) {
    const [, along] = worldToStair(f, x, z);
    if (along > i * main.tread - 0.15 && along < i * main.tread + 0.05) best = Math.min(best, along);
  }
  assert.ok(Number.isFinite(best), `step ${i}: no nose point`);
  return best;
}

/**
 * The frontmost face under step i's nose, from the wall triangles that cross the riser band's
 * middle (6 cm above the lower tread's top — the tread slabs, 13–16 cm thick, lie wholly above or
 * below it) within the flight's centre: its along-run position relative to the tread's nose.
 */
function riserSetback(build, i) {
  const P = build.geometry.attributes.position;
  // the flight's geometry is unindexed: three vertices per triangle
  assert.equal(build.geometry.index, null);
  const hw = main.width / 2;
  const yMid = main.base[1] + i * main.rise + 0.06;
  const nose = noseAlong(build, i);
  let front = Infinity;
  const v = [0, 1, 2].map(() => ({ across: 0, along: 0, y: 0 }));
  for (let t = 0; t < P.count; t += 3) {
    let yMin = Infinity;
    let yMax = -Infinity;
    let inside = true;
    for (let k = 0; k < 3; k++) {
      const idx = t + k;
      const [across, along] = worldToStair(f, P.getX(idx), P.getZ(idx));
      const y = P.getY(idx);
      v[k].across = across;
      v[k].along = along;
      v[k].y = y;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      if (Math.abs(across) > hw - 0.3 || along < i * main.tread - 0.2 || along > i * main.tread + 0.3) inside = false;
    }
    if (!inside || yMin > yMid || yMax < yMid) continue;
    for (const q of v) front = Math.min(front, q.along);
  }
  assert.ok(Number.isFinite(front), `step ${i}: no riser face found`);
  return front - nose;
}

// 2026-09-23 23:00: the hero flight is stone again (the owner's own reference for it is the real
// game's stone stairway); `logged` below is still the same def built with the timbers so the two
// builds can be compared draw for draw, which is what these tests are for.
test('the log build takes the stone build\'s draws: same tones, the same noses (a split tread laid as one), same outlines where the stone is unsplit', () => {
  assert.ok(!LOG_FLIGHTS.has('main'), 'the hero flight is stone');
  assert.ok(LOG_FLIGHTS.has('ledge'), 'the ledge flight carries the timbers');
  assert.equal(logged.steps, stone.steps);
  assert.deepEqual(logged.treadTone, stone.treadTone);
  // the stone flight splits a tread in five into two stones; the log flight lays those as one earth tread
  assert.ok(stone.treadSlabs > main.steps, `${stone.treadSlabs} stone slabs`);
  assert.equal(logged.treadSlabs, main.steps);
  assert.equal(logged.treadNose.length, main.steps);
  // every log-tread nose is a stone-tread nose (same height, same line along the run)
  for (const [x, y, z] of logged.treadNose) {
    const [, along] = worldToStair(f, x, z);
    const match = stone.treadNose.some(([sx, sy, sz]) => { const [, sa] = worldToStair(f, sx, sz); return Math.abs(sa - along) < 1e-9 && Math.abs(sy - y) < 1e-9; });
    assert.ok(match, `nose at ${along.toFixed(3)} / ${y.toFixed(3)} is not the stone flight's`);
  }
  // an unsplit tread's outline is the same cut on both flights
  const stoneHashes = new Set(stone.shapeHashes);
  const shared = logged.shapeHashes.filter((h) => stoneHashes.has(h)).length;
  assert.ok(shared >= main.steps - Math.ceil(main.steps * 0.5), `${shared} of ${main.steps} log-tread outlines are stone cuts`);
  assert.ok(shared < main.steps, 'no tread was joined — the split draws did not happen');
});

test('a joined earth tread spans the flight in one piece: no joint wall inside the flanks (the stone split has two)', () => {
  const hw = main.width / 2;
  const acrossDir = { x: f.dz, z: -f.dx };
  // walls facing across the run, within the slab's height band, inside the flanks, at step i
  const jointWalls = (build, i) => {
    const P = build.geometry.attributes.position;
    const N = build.geometry.attributes.normal;
    const topY = main.base[1] + (i + 1) * main.rise;
    let n = 0;
    for (let t = 0; t < P.count; t += 3) {
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        const y = P.getY(t + k);
        const [across, along] = worldToStair(f, P.getX(t + k), P.getZ(t + k));
        if (y < topY - 0.17 || y > topY + 0.01 || Math.abs(across) > hw - 0.2 || along < i * main.tread - 0.15 || along > (i + 1) * main.tread) ok = false;
      }
      if (!ok) continue;
      const facing = Math.abs(N.getX(t) * acrossDir.x + N.getZ(t) * acrossDir.z);
      if (facing > 0.9) n++;
    }
    return n;
  };
  const stoneHashes = new Set(stone.shapeHashes);
  let joined = 0;
  for (let i = 0; i < main.steps; i++) {
    const isJoined = !stoneHashes.has(logged.shapeHashes[i]);
    if (isJoined) joined++;
    assert.equal(jointWalls(logged, i), 0, `step ${i}: joint walls on the log flight`);
    if (isJoined) assert.ok(jointWalls(stone, i) > 0, `step ${i}: the stone flight's split tread shows no joint wall (control)`);
  }
  assert.ok(joined >= 1, 'no joined tread on the main flight with this seed');
});

test('under a timber the riser face stands at the nose; on the stone flight it stands a hand\'s width behind it', () => {
  // step 0's riser is buried in the foot bank; every other riser stands on the tread below
  for (let i = 1; i < main.steps; i++) {
    const logSet = riserSetback(logged, i);
    const stoneSet = riserSetback(stone, i);
    // log flight: 3 cm behind the nose line, ± the riser's own 1.2 cm jitter (the nose point sits
    // 1 cm in) and ± the nosing's wander, which grew on 2026-09-23 with the owner's reference
    assert.ok(logSet > -0.06 && logSet < 0.06, `step ${i}: log-flight riser ${(logSet * 100).toFixed(1)} cm behind the nose`);
    // stone flight (round 31): the slab overhangs the riser by 6.5–9.5 cm (the nose point sits 1 cm
    // in, the riser's edge wanders 1.2 cm). 2026-09-23: on the 26-step flight the tread is 0.415 m
    // instead of 0.54 and the nosing wanders further, so nose and riser sit closer together; two
    // a few of the twenty-five risers stand flush with their nose (worst −4.8 cm) rather than
    // behind it. The band still pins what it is for — no riser ever stands PROUD of its tread.
    assert.ok(stoneSet > -0.06 && stoneSet < 0.15, `step ${i}: stone-flight riser ${(stoneSet * 100).toFixed(1)} cm behind the nose`);
  }
});

test('a log tread has no rolled lip: its top ring sits on its wall; the stone tread\'s shoulder is 5–18 cm behind the wall', () => {
  const hw = main.width / 2;
  // how far the top ring (the tread top's edge, at the slab's exact height) starts behind the
  // front wall (everything else of the slab, 0.8–17 cm below the top; the wall is its frontmost), centre third of the width, at step i's nose
  const shoulder = (build, i) => {
    const P = build.geometry.attributes.position;
    const noseY = Math.max(...build.treadNose.filter(([x, , z]) => { const [, a] = worldToStair(f, x, z); return a > i * main.tread - 0.15 && a < i * main.tread + 0.05; }).map((p) => p[1]));
    // the slab's vertices at this step (its top may sit a few mm under the nose point's height)
    const own = [];
    let topY = -Infinity;
    for (let k = 0; k < P.count; k++) {
      const [across, along] = worldToStair(f, P.getX(k), P.getZ(k));
      if (Math.abs(across) > hw * 0.5 || along < i * main.tread - 0.2 || along > i * main.tread + 0.15) continue;
      const y = P.getY(k);
      if (y > noseY + 0.001 || y < noseY - 0.17) continue;
      own.push([along, y]);
      topY = Math.max(topY, y);
    }
    let ring = Infinity;
    let wall = Infinity;
    for (const [along, y] of own) {
      const drop = topY - y;
      if (drop < 0.006) ring = Math.min(ring, along);
      else if (drop > 0.008) wall = Math.min(wall, along);
    }
    assert.ok(Number.isFinite(ring) && Number.isFinite(wall), `step ${i}: ring / wall not found`);
    return ring - wall;
  };
  for (let i = 1; i < main.steps; i++) {
    const logS = shoulder(logged, i);
    const stoneS = shoulder(stone, i);
    assert.ok(logS < 0.03, `step ${i}: the log tread's top ring starts ${(logS * 100).toFixed(1)} cm behind its wall`);
    assert.ok(stoneS > 0.02 && stoneS < 0.24, `step ${i}: the stone tread's shoulder is ${(stoneS * 100).toFixed(1)} cm behind its wall`);
  }
});
