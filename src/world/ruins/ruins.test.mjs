/**
 * Round 57 (waterfall ruins): the site holds Link where it should and its dressing keeps out of
 * its stone. Run: node --test src/world/ruins/ruins.test.mjs (Node 20+, no browser).
 *
 * Checks, off the live heightfield, the ruins' builders (forked from the world's seed as
 * ruins/index.ts forks them) and the character ground over the walk spans and blockers the system
 * hands `ctx.shared`:
 *   1. the walk: plaza → trail → outcrop → flight → the arch's passage → the paving's west end,
 *      every 0.1 m free and no rise a stride can't take; the flight, the passage and the paving
 *      at their heights;
 *   2. the holds: the wall, the parapet, the cliff, the ivy rock (its foot over the notch too), the
 *      gate boulders, the columns, the piers, the plunge, the lantern posts, the offering, a step
 *      off each of the terrace's open edges, and the pool past a paddle of at most a metre;
 *   3. the arch's ivy: no vertex inside the ring, the keystone, an abacus or the pendant, none more
 *      than 0.1 m under the springing, most of it on the approach's (east) face;
 *   4. the offering: finite, on the paving and clear of the arch's plinth and the flight, its
 *      blocker round every stone of it over the paving;
 *   5. determinism: the same seed builds the same stone, bit for bit.
 * (The gauntlet's playtest walks the same route and probes in the browser, over every system's
 * blockers; this is the ruins' share of it, without one.)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
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

const { getTerrain } = loadTs(path.join(here, '../terrain/heightfield.ts'));
const { LAYOUT, EXPANSION_RUINS: R } = loadTs(path.join(here, '../layout.ts'));
const { WORLD } = loadTs(path.join(here, '../config.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { createGround } = loadTs(path.join(here, '../character/ground.ts'));
const { MeshBuilder } = loadTs(path.join(here, 'geom.ts'));
const { buildMasonry, ARCH_RING: G } = loadTs(path.join(here, 'masonry.ts'));
const { buildRock } = loadTs(path.join(here, 'rock.ts'));
const { ruinsColumnBlockers } = loadTs(path.join(here, 'cameraSolid.ts'));
const { buildLanterns } = loadTs(path.join(here, 'lanterns.ts'));
const { buildOfferings } = loadTs(path.join(here, 'offerings.ts'));
const { hangArchIvy } = loadTs(path.join(here, 'ivy.ts'));

const terrain = getTerrain();
const ground = (x, z) => terrain.height(x, z);
const sun = new THREE.Vector3(-0.621, 0.616, -0.485).normalize();
const seed = () => createRng(WORLD.seed).fork('ruins');
const T = R.terrace;
const A = R.arch;
const fmt = ([x, z]) => `(${x.toFixed(2)}, ${z.toFixed(2)})`;

async function walkerOverSite() {
  const rng = seed();
  const masonry = buildMasonry(rng.fork('masonry'), ground, sun);
  const rock = buildRock(rng.fork('rock'), ground, sun);
  const lanterns = await buildLanterns(rng.fork('lanterns'), ground, { load: async () => new THREE.Texture() }, WORLD.palette.lanternGlow, rock.boulder);
  const offerings = buildOfferings(rng.fork('offerings'), rock.boulder);
  const shared = {
    walkSpans: [...masonry.spans],
    propBlockers: [...masonry.blockers, ...rock.blockers, ...ruinsColumnBlockers(), ...lanterns.blockers, ...offerings.blockers],
  };
  return createGround(terrain, LAYOUT, shared);
}
const built = walkerOverSite();

test('the walk from the plaza reaches the paving through the arch', async () => {
  const walker = await built;
  const route = [[0, 4], [-6, 8], [-12.5, 8.5], ...R.trail.map((p) => [p[0], p[2]]), [-59.6, -4.2], [-60.7, -4.2], [-62.6, -4.2], [-64.3, -4.2], [A.x, A.z], [-67.5, -4.6], [-70.5, -5.6]];
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1];
    const [bx, bz] = route[i];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
    let prev = walker.height(ax, az);
    for (let k = 1; k <= n; k++) {
      const at = [ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n];
      assert.equal(walker.blocked(...at), false, `leg ${i} held at ${fmt(at)}`);
      const h = walker.height(...at);
      assert.ok(h - prev < 0.55, `leg ${i} rises ${(h - prev).toFixed(2)} m in 0.1 m at ${fmt(at)}`);
      prev = h;
    }
  }
  const at = (where, p, y, tol = 0.15) => {
    assert.equal(walker.blocked(...p), false, `${where} ${fmt(p)} held`);
    assert.ok(Math.abs(walker.height(...p) - y) < tol, `${where} ${fmt(p)} walks at ${walker.height(...p).toFixed(2)}, not ${y.toFixed(2)}`);
  };
  const S = R.stairs;
  at('flight (mid)', [S.base[0] - (S.steps / 2) * S.tread, S.base[2]], S.base[1] + (S.steps / 2) * S.rise, 0.25);
  at('arch passage', [A.x, A.z], T.y);
  for (const p of [[-67.5, -4.6], [-72.0, -3.2], [-68.0, -8.4], [-62.2, -5.7], [-62.0, -2.65]]) at('paving', p, T.y);
});

test('the ruins hold Link off their stone, their edges and the deep water', async () => {
  const walker = await built;
  const held = (where, p) => assert.equal(walker.blocked(...p), true, `${where} ${fmt(p)} walks`);
  for (const p of [[-66.0, -1.85], [-70.0, -1.85]]) held('wall', p);
  held('parapet', [-58.0, -1.72]);
  for (const p of [[-75.2, -5.0], [-76.0, 0.0], [-75.6, 6.0]]) held('cliff', p);
  for (const p of [[-60.6, -9.0], [-59.0, -8.0], [-62.0, -6.75], [-63.25, -8.5], [-63.25, -9.5]]) held('ivy rock', p);
  for (const [x, z] of R.gate) held('gate boulder', [x, z]);
  for (const p of [[A.x, A.z - 1.7], [A.x, A.z + 1.7]]) held('arch column', p);
  for (const [x] of R.colonnade.columns) held('colonnade', [x, R.colonnade.z]);
  for (const z of R.brokenArch.z) held('broken arch pier', [R.brokenArch.x, z]);
  held('plunge', [R.fall.x + 0.55, R.fall.z]);
  for (const [x, z] of R.lanterns) held('lantern post', [x, z]);
  held('offering', [R.offering.x, R.offering.z]);
  // the open edges: 0.25 m inside walks at the paving's height, 0.15 m and 0.35 m past it is held
  for (const [id, [x, z], [dx, dz]] of [
    ['east front (north)', [T.x1 - 0.25, -5.65], [1, 0]],
    ['east front (south)', [T.x1 - 0.25, -2.65], [1, 0]],
    ['ivy rock west face', [-64.15, -9.5], [1, 0]],
    ['north face', [-68.0, T.z0 + 0.25], [0, -1]],
    ['north face', [-72.8, T.z0 + 0.25], [0, -1]],
  ]) {
    assert.equal(walker.blocked(x, z), false, `inside the ${id} ${fmt([x, z])} held`);
    assert.ok(Math.abs(walker.height(x, z) - T.y) < 0.15, `inside the ${id} walks at ${walker.height(x, z).toFixed(2)}`);
    for (const o of [0.4, 0.6]) held(`off the ${id}`, [x + dx * o, z + dz * o]);
  }
  // the pool: from 3 m off its box toward its middle, held within a metre of the waterline
  const Q = R.pool;
  for (const p of [[Q.x, Q.z], [-70.0, 3.0], [-60.0, 4.0], [Q.x, 7.0]]) held('pool (deep)', p);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const deg = ((a * 180) / Math.PI).toFixed(0);
    let wet = null;
    let hold = null;
    for (let i = 0; i < 160 && hold === null; i++) {
      const s = i * 0.05;
      const p = [Q.x + Math.cos(a) * (Q.hx + 3 - s), Q.z + Math.sin(a) * (Q.hz + 3 - s)];
      if (terrain.height(...p) >= Q.water) continue;
      wet ??= s;
      if (walker.blocked(...p)) hold = s;
    }
    if (wet === null) continue;
    assert.notEqual(hold, null, `the pool at ${deg}° never holds him`);
    assert.ok(hold - wet <= 1.0, `the pool at ${deg}° lets him paddle ${(hold - wet).toFixed(2)} m`);
  }
});

test('the arch ivy keeps out of the ring, the keystone, the abaci and the pendant', () => {
  const mb = new MeshBuilder();
  const res = hangArchIvy(seed().fork('arch-ivy'), mb);
  assert.ok(res.strands >= 20 && res.leaves >= 120, `${res.strands} strands, ${res.leaves} leaves`);
  const capZ = G.r0 + A.columnR;
  const yk = G.spring + G.r0 - 0.05;
  const inside = { ring: 0, keystone: 0, abacus: 0, pendant: 0 };
  let low = Infinity;
  let east = 0;
  let west = 0;
  for (let k = 0; k < mb.vertexCount; k++) {
    const x = mb.pos[k * 3] - A.x;
    const y = mb.pos[k * 3 + 1];
    const z = mb.pos[k * 3 + 2] - A.z;
    const dy = y - G.spring;
    const rho = Math.hypot(z, dy);
    const off = Math.abs(Math.atan2(dy, z) - Math.PI / 2);
    low = Math.min(low, y);
    if (x > 0.2) east++;
    else if (x < -0.2) west++;
    // each stone at its thinnest: voussoir faces ≥ 0.265 m off the ring's plane, keystone 0.31, abacus 0.36
    if (Math.abs(x) < 0.263 && rho > G.r0 + 0.012 && rho < G.r1 - 0.034 && dy > 0.02 && off > Math.PI / 26) inside.ring++;
    if (Math.abs(x) < 0.308 && off < Math.PI / 26 - 0.006 && rho > G.r0 - 0.05 && rho < G.r1 + 0.17) inside.keystone++;
    if (Math.abs(x) < 0.34 && Math.abs(Math.abs(z) - capZ) < 0.34 && dy < -0.005 && dy > -0.14) inside.abacus++;
    if (Math.hypot(x, z) < 0.14 && y > yk - 0.45 && y < yk) inside.pendant++;
  }
  assert.deepEqual(inside, { ring: 0, keystone: 0, abacus: 0, pendant: 0 });
  assert.ok(low > G.spring - 0.1, `the ivy hangs to ${(low - T.y).toFixed(2)} m over the paving (springing ${(G.spring - T.y).toFixed(2)})`);
  assert.ok(east > west, `east face ${east} vertices, west ${west}`);
});

test('the offering stands on the paving, clear of the plinth and the flight, inside its blocker', () => {
  // its own builder for the cairn (at run time it shares the boulders'): the same fork builds the same offering
  const stones = new MeshBuilder();
  const offerings = buildOfferings(seed().fork('offerings'), stones);
  const clay = offerings.builder;
  assert.ok(offerings.count > 0 && clay.vertexCount > 0 && stones.vertexCount > 0);
  const [b] = offerings.blockers;
  const box = { x0: Infinity, y0: Infinity, z1: -Infinity };
  let far = 0;
  for (const mb of [clay, stones]) {
    for (let k = 0; k < mb.vertexCount; k++) {
      const [x, y, z] = [mb.pos[k * 3], mb.pos[k * 3 + 1], mb.pos[k * 3 + 2]];
      assert.ok([x, y, z, mb.nrm[k * 3], mb.nrm[k * 3 + 1], mb.nrm[k * 3 + 2]].every(Number.isFinite), 'a non-finite vertex');
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.z1 = Math.max(box.z1, z);
      if (y > T.y + 0.005) far = Math.max(far, Math.hypot(x - b.x, z - b.z));
    }
  }
  assert.ok(box.y0 > T.y - 0.03, `sunk ${(T.y - box.y0).toFixed(3)} m into the paving`);
  assert.ok(box.x0 > A.x + 0.34 + 0.1, `${(box.x0 - A.x - 0.34).toFixed(2)} m off the arch plinth's east face`);
  assert.ok(box.z1 < R.stairs.base[2] - R.stairs.width / 2 - 0.2, `${(R.stairs.base[2] - R.stairs.width / 2 - box.z1).toFixed(2)} m off the flight's north edge`);
  assert.ok(far <= b.r, `a stone ${far.toFixed(2)} m from the blocker's centre (r ${b.r})`);
});

test('the same seed builds the same stone', () => {
  const a = buildMasonry(seed().fork('masonry'), ground, sun).stone;
  const b = buildMasonry(seed().fork('masonry'), ground, sun).stone;
  assert.equal(a.vertexCount, b.vertexCount);
  let diff = 0;
  for (let i = 0; i < a.pos.length; i++) if (a.pos[i] !== b.pos[i] || a.col[i] !== b.col[i]) diff++;
  assert.equal(diff, 0, `${diff} components differ`);
});
