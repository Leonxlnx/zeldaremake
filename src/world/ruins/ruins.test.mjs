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
 *   2. the water stair: the paving → over the wall through the parapet's break → the landing → the
 *      flight down the wall's pool face → the quay → the platform at the fall's foot, and back,
 *      every 0.1 m free and no rise a stride can't take; each tread, the quay and the platform at
 *      their heights; off its open edges, past the landing's east face and on the wall either side
 *      of the crossing held; the ground a fifth of a metre under its tops all over its footprint;
 *   3. the holds: the wall, the parapet, the cliff, the ivy rock (its foot over the notch too), the
 *      gate boulders, the columns, the piers, the plunge, the lantern posts, the offering, a step
 *      off each of the terrace's open edges, and the pool past a paddle of at most a metre (the
 *      water stair's stone over the water is not a paddle);
 *   4. the follow camera: with Link at the last walkable point by the cliff or the ivy rock, the
 *      camera as near him as it comes is outside their stone and clear of it by its near plane;
 *   5. the arch's ivy: no vertex inside the ring, the keystone, an abacus or the pendant, none more
 *      than 0.1 m under the springing, most of it on the approach's (east) face;
 *   6. the offering: finite, on the paving and clear of the arch's plinth and the flight, its
 *      blocker round every stone of it over the paving;
 *   7. the loose stone: every rubble block, drum and the lintel reaches down to what it lies on (the
 *      ground, the outcrop's skin, the slabs or a lost slab's bed) and stands out of it; every
 *      boulder's underside meets the ground all round it;
 *   8. the water: the pool's surface covers every open point of the basin under its waterline; the
 *      fall's run-in lies on the brow's rock as built (over it, never in it), its arc keeps clear
 *      of the face and of the water stair, every column lands in the pool's water, and the front
 *      layer stays in front of the back one;
 *   9. determinism: the same seed builds the same stone, bit for bit;
 *  10. locality: the site's casters and their shadow footprints (what `ruinsVisible` tests) meet no
 *      fixed camera's frustum, and the zone's own views do meet them.
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
const { buildRock, outcropSkin } = loadTs(path.join(here, 'rock.ts'));
const { ruinsColumnBlockers } = loadTs(path.join(here, 'cameraSolid.ts'));
const { buildLanterns } = loadTs(path.join(here, 'lanterns.ts'));
const { buildOfferings } = loadTs(path.join(here, 'offerings.ts'));
const { hangArchIvy } = loadTs(path.join(here, 'ivy.ts'));
const { buildWater } = loadTs(path.join(here, 'water.ts'));
const { waterStairFootprint, waterStairTop, WATER_STAIR_LANDING_X, cliffFaceX, cliffFaceAt, poolSigned } = loadTs(path.join(here, '../terrain/ruins.ts'));

const terrain = getTerrain();
const ground = (x, z) => terrain.height(x, z);
const sun = new THREE.Vector3(-0.621, 0.616, -0.485).normalize();
const seed = () => createRng(WORLD.seed).fork('ruins');
const T = R.terrace;
const A = R.arch;
const fmt = ([x, z]) => `(${x.toFixed(2)}, ${z.toFixed(2)})`;

async function buildSite() {
  const rng = seed();
  const masonry = buildMasonry(rng.fork('masonry'), ground, sun);
  const rock = buildRock(rng.fork('rock'), ground, sun);
  const lanterns = await buildLanterns(rng.fork('lanterns'), ground, { load: async () => new THREE.Texture() }, WORLD.palette.lanternGlow, rock.boulder);
  const offerings = buildOfferings(rng.fork('offerings'), rock.boulder);
  const shared = {
    walkSpans: [...masonry.spans],
    propBlockers: [...masonry.blockers, ...rock.blockers, ...ruinsColumnBlockers(), ...lanterns.blockers, ...offerings.blockers],
  };
  return { walker: createGround(terrain, LAYOUT, shared), lanterns };
}
const site = buildSite();
const built = site.then((s) => s.walker);

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

test("the water stair walks from the paving over the wall and down its pool face to the fall's foot", async () => {
  const walker = await built;
  const WS = R.waterStair;
  const Qy = R.quay;
  const zc = WS.base[2];
  const xc = (Qy.head[0] + Qy.head[1]) / 2;
  // off the outcrop stair's top tread (level with the paving) onto the paving's strip south of its
  // cut (the arch's south column closes the strip's west end), east along it to the break
  const route = [[-64.0, -4.2], [-64.0, -2.65], [xc, -2.65], [xc, -1.9], [xc, zc], [WS.base[0] - 1.3, zc], [-72.3, -0.8], [-73.4, -0.55]];
  // there and back: every 0.1 m free, no rise a stride can't take either way
  for (const legs of [route, [...route].reverse()]) {
    for (let i = 1; i < legs.length; i++) {
      const [ax, az] = legs[i - 1];
      const [bx, bz] = legs[i];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
      let prev = walker.height(ax, az);
      for (let k = 1; k <= n; k++) {
        const p = [ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n];
        assert.equal(walker.blocked(...p), false, `${fmt(legs[i - 1])} → ${fmt(legs[i])} held at ${fmt(p)}`);
        const h = walker.height(...p);
        assert.ok(h - prev < 0.55, `${fmt(legs[i - 1])} → ${fmt(legs[i])} rises ${(h - prev).toFixed(2)} m in 0.1 m at ${fmt(p)}`);
        prev = h;
      }
    }
  }
  const at = (where, p, y, tol) => {
    assert.equal(walker.blocked(...p), false, `${where} ${fmt(p)} held`);
    assert.ok(Math.abs(walker.height(...p) - y) < tol, `${where} ${fmt(p)} walks at ${walker.height(...p).toFixed(3)}, not ${y.toFixed(3)}`);
  };
  at('crossing (over the wall)', [xc, R.wall.z], T.y, 0.02);
  at('landing', [WATER_STAIR_LANDING_X + 0.9, zc], T.y, 0.02);
  for (let i = 0; i < WS.steps - 1; i++) at(`tread ${i}`, [WS.base[0] + (i + 0.5) * WS.tread, zc], WS.base[1] + (i + 1) * WS.rise, 0.005);
  at('quay', [WS.base[0] - 1.3, zc], Qy.y, 0.005);
  at('platform', [-73.0, -0.6], Qy.y, 0.005);
  assert.ok(Math.abs(waterStairTop(WATER_STAIR_LANDING_X + 0.1) - T.y) < 0.002, 'the landing is not level with the paving');
  // its edges: the open south edges of the quay, the flight and the platform, the platform's east end
  // past the quay, the landing's east face and the wall either side of the crossing hold him
  const held = (where, p) => assert.equal(walker.blocked(...p), true, `${where} ${fmt(p)} walks`);
  for (const x of [-70.5, -66.2, -63.0]) for (const dz of [0.1, 0.3, 0.8]) held('off the strip', [x, Qy.z1 + dz]);
  for (const x of [-74.0, -72.5]) for (const dz of [0.1, 0.3, 0.8]) held('off the platform', [x, Qy.fallZ + dz]);
  held("off the platform's east end", [Qy.fallX + 0.15, -0.1]);
  for (const dx of [0.1, 0.3, 0.8]) held('off the landing', [Qy.east + dx, zc]);
  for (const x of [Qy.head[0] - 0.6, Qy.head[1] + 0.55]) held('the wall beside the crossing', [x, R.wall.z]);
  // and the strip itself stays walkable to its margins (the platform to the cliff's reach, 0.8 m off its rock)
  for (const p of [[-66.2, Qy.z0 + 0.15], [-66.2, Qy.z1 - 0.3], [Qy.east - 0.35, zc], [-73.3, Qy.fallZ - 0.3]]) assert.equal(walker.blocked(...p), false, `the strip's margin ${fmt(p)} held`);
  // the ground as rendered stays a fifth of a metre under its walked tops everywhere on its footprint
  // (nothing pokes through a tread or a slab)
  let worst = -Infinity;
  for (let x = R.cliff.x - 0.9; x <= Qy.east; x += 0.05) {
    for (let z = Qy.z0; z <= Qy.fallZ; z += 0.05) {
      if (!waterStairFootprint(x, z)) continue;
      worst = Math.max(worst, terrain.height(x, z) - waterStairTop(x));
    }
  }
  assert.ok(worst < -0.2, `the ground comes ${(worst + 0.2).toFixed(3)} m too near a walked top`);
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
    ['ivy rock west face', [-64.35, -9.5], [1, 0]],
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
      // the water stair's quay and platform are stone over the water, not a paddle
      if (terrain.height(...p) >= Q.water || waterStairFootprint(...p)) continue;
      wet ??= s;
      if (walker.blocked(...p)) hold = s;
    }
    if (wet === null) continue;
    assert.notEqual(hold, null, `the pool at ${deg}° never holds him`);
    assert.ok(hold - wet <= 1.0, `the pool at ${deg}° lets him paddle ${(hold - wet).toFixed(2)} m`);
  }
});

test('the follow camera stays out of the cliff and the ivy rock wherever Link can stand', async () => {
  const walker = await built;
  // the rock's surface as built, in 0.5 m cells: by (y, z) for the inside test (a ray east crosses
  // it an odd number of times) and by (x, y, z) for the clearance
  const g = buildRock(seed().fork('rock'), ground, sun).cliff.build();
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const C = 0.5;
  const cell = (v) => Math.floor(v / C);
  const rays = new Map();
  const space = new Map();
  const put = (map, key, t) => (map.get(key) ?? map.set(key, []).get(key)).push(t);
  for (let i = 0; i < idx.count; i += 3) {
    const t = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + j)));
    const lo = t[0].clone().min(t[1]).min(t[2]);
    const hi = t[0].clone().max(t[1]).max(t[2]);
    t.x1 = hi.x;
    for (let y = cell(lo.y); y <= cell(hi.y); y++) {
      for (let z = cell(lo.z); z <= cell(hi.z); z++) {
        put(rays, `${y},${z}`, t);
        for (let x = cell(lo.x); x <= cell(hi.x); x++) put(space, `${x},${y},${z}`, t);
      }
    }
  }
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const east = new THREE.Vector3(1, 0, 0);
  const inside = (p) => {
    ray.set(p, east);
    let n = 0;
    for (const t of rays.get(`${cell(p.y)},${cell(p.z)}`) ?? []) if (t.x1 >= p.x && ray.intersectTriangle(t[0], t[1], t[2], false, hit)) n++;
    return n % 2 === 1;
  };
  const tri = new THREE.Triangle();
  const near = new THREE.Vector3();
  const clearance = (p) => {
    let best = C;
    for (let x = cell(p.x) - 1; x <= cell(p.x) + 1; x++) {
      for (let y = cell(p.y) - 1; y <= cell(p.y) + 1; y++) {
        for (let z = cell(p.z) - 1; z <= cell(p.z) + 1; z++) {
          for (const t of space.get(`${x},${y},${z}`) ?? []) best = Math.min(best, tri.set(t[0], t[1], t[2]).closestPointToPoint(p, near).distanceTo(p));
        }
      }
    }
    return best;
  };
  // the camera as near its aim as it ever comes (camera/collision.ts: 0.6 m off the pivot 1.5 m over
  // the feet), every 15° round him, from 0.1 rad under the pivot (it stops orbiting lower) to 0.62 rad
  // over it (the look-down limit); inside the stone counts negative, the near plane is 0.08 m
  let worst = { d: Infinity };
  let spots = 0;
  const look = (where, x, z) => {
    const pivot = new THREE.Vector3(x, walker.height(x, z) + 1.5, z);
    for (let deg = 0; deg < 360; deg += 15) {
      for (const up of [-0.1, 0.25, 0.62]) {
        const a = (deg * Math.PI) / 180;
        const cam = new THREE.Vector3(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up)).multiplyScalar(0.6).add(pivot);
        const d = inside(cam) ? -clearance(cam) : clearance(cam);
        if (d < worst.d) worst = { d, where, at: [x, z] };
      }
    }
    spots++;
  };
  // Link at the last walkable point west along every 0.25 m of the cliff, and out along every 5° of
  // bearing from the ivy rock
  for (let z = R.cliff.z0; z <= R.cliff.z1; z += 0.25) {
    if (walker.blocked(-71, z)) continue;
    let x = -71;
    while (x > -77 && !walker.blocked(x - 0.02, z)) x -= 0.02;
    look('cliff', x, z);
  }
  const P = R.pillar;
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg * Math.PI) / 180;
    let r = 1.5;
    while (r < 5 && walker.blocked(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r)) r += 0.02;
    if (r < 5) look('ivy rock', P.x + Math.cos(a) * r, P.z + Math.sin(a) * r);
  }
  assert.ok(spots >= 100, `${spots} spots`);
  assert.ok(worst.d >= 0.08, `the camera ${Math.abs(worst.d).toFixed(3)} m ${worst.d < 0 ? 'inside' : 'off'} the ${worst.where} with Link at ${fmt(worst.at)}`);
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

test('every loose stone meets what it lies on and stands out of it', () => {
  const rng = seed();
  const masonry = buildMasonry(rng.fork('masonry'), ground, sun);
  const rock = buildRock(rng.fork('rock'), ground, sun);
  const TOL = 0.015;
  // the paving under (x, z): a lost slab's bed (its lowest, between the cushions), else the lowest
  // slab top (a stone across a joint lies on the slabs either side of it)
  const pave = (x, z) => (masonry.lost.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1) ? T.y - 0.071 : T.y - 0.012);
  const land = (x, z) => {
    const g = ground(x, z);
    return Math.max(g, outcropSkin(x, z, g));
  };
  const kinds = {};
  const bad = [];
  const P = masonry.stone.pos;
  for (const p of masonry.loose) {
    kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
    const under = p.onTop ? pave : land;
    let y0 = Infinity;
    let cx = 0;
    let cz = 0;
    for (let k = p.v0; k < p.v1; k++) {
      y0 = Math.min(y0, P[k * 3 + 1]);
      cx += P[k * 3] / (p.v1 - p.v0);
      cz += P[k * 3 + 2] / (p.v1 - p.v0);
    }
    let hover = -Infinity;
    let stands = -Infinity;
    for (let k = p.v0; k < p.v1; k++) {
      const d = P[k * 3 + 1] - under(P[k * 3], P[k * 3 + 2]);
      if (P[k * 3 + 1] < y0 + 0.002) hover = Math.max(hover, d);
      stands = Math.max(stands, d);
    }
    if (hover > TOL || stands < 0.03) bad.push(`${p.kind} at ${fmt([cx, cz])}: its foot ${hover.toFixed(3)} m over what it lies on, ${stands.toFixed(2)} m of it out of it`);
  }
  assert.ok(kinds.rubble >= 25 && kinds.drum >= 3 && kinds.lintel === 1, JSON.stringify(kinds));
  // the boulders' undersides: in each sixteenth round the boulder's middle, some vertex of its
  // lower half between 35 % and 75 % of the way out is in the ground (so no side of it hovers)
  for (const b of rock.boulders) {
    const Q = b.mb.pos;
    let y0 = Infinity;
    let y1 = -Infinity;
    let out = -Infinity;
    for (let k = b.v0; k < b.v1; k++) {
      y0 = Math.min(y0, Q[k * 3 + 1]);
      y1 = Math.max(y1, Q[k * 3 + 1]);
      out = Math.max(out, Q[k * 3 + 1] - ground(Q[k * 3], Q[k * 3 + 2]));
    }
    const reach = new Array(16).fill(0);
    const sector = (k) => Math.floor(((Math.atan2(Q[k * 3 + 2] - b.z, Q[k * 3] - b.x) / (Math.PI * 2) + 1) % 1) * 16) % 16;
    for (let k = b.v0; k < b.v1; k++) reach[sector(k)] = Math.max(reach[sector(k)], Math.hypot(Q[k * 3] - b.x, Q[k * 3 + 2] - b.z));
    const contact = new Array(16).fill(Infinity);
    for (let k = b.v0; k < b.v1; k++) {
      const s = sector(k);
      const rho = Math.hypot(Q[k * 3] - b.x, Q[k * 3 + 2] - b.z);
      if (Q[k * 3 + 1] > (y0 + y1) / 2 || rho < 0.35 * reach[s] || rho > 0.75 * reach[s]) continue;
      contact[s] = Math.min(contact[s], Q[k * 3 + 1] - ground(Q[k * 3], Q[k * 3 + 2]));
    }
    const worst = Math.max(...contact);
    if (worst > TOL) bad.push(`boulder at ${fmt([b.x, b.z])}: a side of its underside ${worst.toFixed(3)} m over the ground`);
    if (out < 0.1) bad.push(`boulder at ${fmt([b.x, b.z])}: ${out.toFixed(2)} m of it out of the ground`);
  }
  assert.ok(rock.boulders.length >= 20, `${rock.boulders.length} boulders`);
  assert.deepEqual(bad, []);
});

test('the water meets its banks, the rock and itself', () => {
  const water = buildWater(seed().fork('water'), ground);
  const [pool, fall] = water.meshes;
  const Q = R.pool;
  const Y = Q.water;
  // the pool's surface covers every open point of the basin whose ground is under the waterline (no dry
  // gap between the water and the bank, the wall's face or the cliff's foot): its triangles in 0.35 m cells
  const pp = pool.geometry.getAttribute('position');
  const pi = pool.geometry.getIndex();
  const cells = new Map();
  const tri = [];
  for (let t = 0; t < pi.count; t += 3) {
    const v = [0, 1, 2].map((j) => [pp.getX(pi.getX(t + j)), pp.getZ(pi.getX(t + j))]);
    tri.push(v);
    const key = `${Math.floor(Math.min(...v.map((p) => p[0])) / 0.35)}:${Math.floor(Math.min(...v.map((p) => p[1])) / 0.35)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)).push(v);
  }
  const inside = ([ax, az], [bx, bz], [cx, cz], x, z) => {
    const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
    const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
    const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
    return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9));
  };
  const covered = (x, z) => {
    for (let i = -1; i <= 0; i++) for (let j = -1; j <= 0; j++) for (const v of cells.get(`${Math.floor(x / 0.35) + i}:${Math.floor(z / 0.35) + j}`) ?? []) if (inside(...v, x, z)) return true;
    return false;
  };
  const W = R.wall;
  let wet = 0;
  const dry = [];
  for (let x = Q.x - Q.hx - 1; x <= Q.x + Q.hx + 1; x += 0.1) {
    for (let z = Q.z - Q.hz - 1; z <= Q.z + Q.hz + 1; z += 0.1) {
      if (terrain.height(x, z) > Y - 0.005) continue;
      // under the wall, the water stair or the cliff's rock the water is not seen
      if (z < W.z + W.half || waterStairFootprint(x, z) || x < cliffFaceX(z, 0.5)) continue;
      wet++;
      if (!covered(x, z)) dry.push(fmt([x, z]));
    }
  }
  assert.ok(wet > 10000, `${wet} wet points`);
  assert.equal(dry.length, 0, `the water leaves ${dry.length} wet points of the basin bare: ${dry.slice(0, 5).join(', ')}`);
  // the fall: its run-in lies on the brow's rock (≤ 0.15 m off the rock as built, never in it), its arc keeps
  // clear of the face and of the water stair, every column ends in the pool's water (not on a bank, in
  // its bed or on the platform), and the front layer keeps in front of the back one
  const cliffGeo = buildRock(seed().fork('rock'), ground, sun).cliff.build();
  const cliff = new THREE.Mesh(cliffGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const fp = fall.geometry.getAttribute('position');
  const fu = fall.geometry.getAttribute('uv');
  const fl = fall.geometry.getAttribute('aLayer');
  // the brow's triangles round the run-in, for the nearest rock to each of its vertices (straight down
  // is no measure at the lip's corner, where a ray just past the corner meets the face far below)
  const runPts = [];
  for (let k = 0; k < fp.count; k++) if (fu.getY(k) < 0) runPts.push(new THREE.Vector3(fp.getX(k), fp.getY(k), fp.getZ(k)));
  const box = new THREE.Box3().setFromPoints(runPts).expandByScalar(1.5);
  const cp = cliffGeo.getAttribute('position');
  const ci = cliffGeo.getIndex();
  const brow = [];
  for (let t = 0; t < ci.count; t += 3) {
    const v = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(cp, ci.getX(t + j)));
    if (v.some((p) => box.containsPoint(p))) brow.push(new THREE.Triangle(...v));
  }
  const near = new THREE.Vector3();
  const rockGap = (p) => {
    let d = Infinity;
    for (const tr of brow) d = Math.min(d, tr.closestPointToPoint(p, near).distanceTo(p));
    return d;
  };
  const cols = new Map();
  let runIn = 0;
  let gapMax = 0;
  let gapMin = Infinity;
  let faceMin = Infinity;
  for (let k = 0; k < fp.count; k++) {
    const [x, y, z, s, layer] = [fp.getX(k), fp.getY(k), fp.getZ(k), fu.getY(k), fl.getX(k)];
    const key = `${layer}:${fu.getX(k).toFixed(3)}`;
    (cols.get(key) ?? cols.set(key, []).get(key)).push([x, y, z, s]);
    if (s < 0) {
      // the first rock under it is below it (it is not in the rock), and the nearest rock is a skin away
      ray.set(new THREE.Vector3(x, y + 0.5, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(cliff, false)[0];
      assert.ok(hit && hit.point.y < y, `the run-in at ${fmt([x, z])} is in the rock or off it`);
      const gap = rockGap(new THREE.Vector3(x, y, z));
      gapMax = Math.max(gapMax, gap);
      gapMin = Math.min(gapMin, gap);
      runIn++;
    } else if (s > 0.05) faceMin = Math.min(faceMin, x - cliffFaceAt(z, y, ground));
    assert.ok(!waterStairFootprint(x, z, 0.3), `the fall's sheet at ${fmt([x, z])} meets the water stair`);
  }
  assert.ok(runIn >= 100 && gapMin > 0.02 && gapMax <= 0.15, `the run-in lies ${gapMin.toFixed(3)}…${gapMax.toFixed(3)} m off the rock (${runIn} vertices)`);
  assert.ok(faceMin >= 0.1, `the arc comes within ${faceMin.toFixed(3)} m of the face`);
  let thin = Infinity;
  for (const [key, col] of cols) {
    const [x, y, z] = col[col.length - 1];
    // it ends under the waterline, a tenth of a metre or more over the bed, inside the pool
    assert.ok(y < Y && terrain.height(x, z) < y - 0.1 && poolSigned(x, z) < 0, `the column ${key} lands at ${fmt([x, z])} (y ${y.toFixed(2)}, the ground ${terrain.height(x, z).toFixed(2)})`);
    if (!key.startsWith('1:')) continue;
    // the back layer's x at the front vertex's height, same column
    const back = cols.get(`0:${key.slice(2)}`).filter((q) => q[3] >= 0);
    for (const [fx, fy] of col) {
      for (let j = 0; j + 1 < back.length; j++) {
        const [x0, y0] = back[j];
        const [x1, y1] = back[j + 1];
        if ((fy - y0) * (fy - y1) > 0) continue;
        thin = Math.min(thin, fx - (x0 + ((x1 - x0) * (fy - y0)) / (y1 - y0 || 1)));
        break;
      }
    }
  }
  assert.ok(cols.size === 42 && thin >= 0.05, `${cols.size} columns; the front layer comes within ${thin.toFixed(3)} m of the back`);
});

test('the same seed builds the same stone', () => {
  const a = buildMasonry(seed().fork('masonry'), ground, sun).stone;
  const b = buildMasonry(seed().fork('masonry'), ground, sun).stone;
  assert.equal(a.vertexCount, b.vertexCount);
  let diff = 0;
  for (let i = 0; i < a.pos.length; i++) if (a.pos[i] !== b.pos[i] || a.col[i] !== b.col[i]) diff++;
  assert.equal(diff, 0, `${diff} components differ`);
});

test('no fixed frame sees the ruins or their shadows, and the zone views do', async () => {
  const { ruinsCasters } = loadTs(path.join(here, 'index.ts'));
  const { sunDirOf } = loadTs(path.join(here, 'materials.ts'));
  const L = loadTs(path.join(here, '../util/expansionLocality.ts'));
  const { lanterns } = await site;
  const spheres = [...ruinsCasters(), ...lanterns.casters].flatMap((c) => L.casterSpheres(c, sunDirOf(WORLD)));
  const cam = (fov, p, t, aspect) => {
    const c = new THREE.PerspectiveCamera(fov, aspect, 0.1, 400);
    c.position.set(...p);
    c.lookAt(...t);
    c.updateMatrixWorld(true);
    return c;
  };
  // at 2:1, wider than the captures' 1280 × 716, so a frame a little wider still misses them
  for (const v of LAYOUT.viewpoints) assert.equal(L.ruinsVisible(cam(v.fov, v.position, v.target, 2), spheres), false, `${v.id} draws the ruins`);
  for (const [name, p, t] of [
    ['ruins-approach', [-47.5, 4.4, -2.8], [-60, 4.4, -5]],
    ['ruins-pool', [-52.5, 3.6, 9.5], [-65, 3.8, -1.5]],
    ['ruins-aerial', [-46, 21, 9], [-64, 3, -3]],
    ['ruins-trail', [-38, 4.2, -0.8], [-52, 3.8, -4]],
  ]) assert.equal(L.ruinsVisible(cam(55, p, t, 16 / 9), spheres), true, `${name} hides the ruins`);
});
