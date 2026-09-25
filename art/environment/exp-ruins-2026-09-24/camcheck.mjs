// The waterfall ruins' follow camera against their stone and water, offline, from a playtest run:
//
//   node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play --only walk \
//        --walk-routes plaza-to-ruins-terrace,ruins-trail-to-shore,ruins-water-stair
//   node art/environment/exp-ruins-2026-09-24/camcheck.mjs /tmp/play/playtest.json
//
// Every camera position the three ruins routes recorded (one a frame) and every one of `ruinsCamera`'s
// swung views (15 spots × 8 headings × 3 pitches) is tested against the site as the unit test builds
// it (ruins.test.mjs: the world's seed forked as ruins/index.ts forks it):
//  - rock: inside the cliff, the ivy rock or the slab bridge (a ray east crosses the built surface an
//    odd number of times), or nearer that surface than the near plane (0.08 m);
//  - masonry: in a solid cell of cameraSolid.ts's grid as written (its core — the terrace's faces, the
//    wall, the parapets, the arch's ring, the lintel, the piers, the gate boulders); the cells are
//    0.25 m, so each such camera is also measured against the masonry as built (the stone, tile and
//    carving triangles): its distance to the nearest face and which side of that face it is on —
//    `insideMasonry` behind it, `nearMasonry` in front of it but nearer than the near plane;
//  - ground: under the character ground (the walked tops included) or the terrain;
//  - water: under the pool's surface where the ground is under it;
//  - sight: the line from the camera to Link's chest crosses the rock or a masonry cell (he is hidden),
//    not counting its first and last 0.3 m (the camera's own clearance is the tests above).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
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
const src = (p) => path.join(root, 'src', p);
const { getTerrain } = loadTs(src('world/terrain/heightfield.ts'));
const { LAYOUT, EXPANSION_RUINS: R, inExpansionRuins } = loadTs(src('world/layout.ts'));
const { WORLD } = loadTs(src('world/config.ts'));
const { createRng } = loadTs(src('world/util/prng.ts'));
const { createGround } = loadTs(src('world/character/ground.ts'));
const { buildMasonry } = loadTs(src('world/ruins/masonry.ts'));
const { buildRock } = loadTs(src('world/ruins/rock.ts'));
const { buildRuinsCameraSolid, ruinsColumnBlockers } = loadTs(src('world/ruins/cameraSolid.ts'));
const { buildLanterns } = loadTs(src('world/ruins/lanterns.ts'));
const { buildOfferings } = loadTs(src('world/ruins/offerings.ts'));

const input = process.argv[2];
if (!input) throw new Error('usage: camcheck.mjs <playtest.json>');
const play = JSON.parse(readFileSync(input, 'utf8'));

const terrain = getTerrain();
const ground = (x, z) => terrain.height(x, z);
const sun = new THREE.Vector3(-0.621, 0.616, -0.485).normalize();
const rng = createRng(WORLD.seed).fork('ruins');
const masonry = buildMasonry(rng.fork('masonry'), ground, sun);
const rock = buildRock(rng.fork('rock'), ground, sun);
const lanterns = await buildLanterns(rng.fork('lanterns'), ground, { load: async () => new THREE.Texture() }, WORLD.palette.lanternGlow, rock.boulder);
const offerings = buildOfferings(rng.fork('offerings'), rock.boulder);
const walker = createGround(terrain, LAYOUT, {
  walkSpans: [...masonry.spans],
  propBlockers: [...masonry.blockers, ...rock.blockers, ...ruinsColumnBlockers(), ...lanterns.blockers, ...offerings.blockers],
});
const cliff = rock.cliff.build();

// the masonry's grid alone: the builder's with a single sliver of "rock" under the site in place of
// the cliff (the rock is tested against its own surface, exactly)
const sliver = new THREE.BufferGeometry();
sliver.setAttribute('position', new THREE.Float32BufferAttribute([R.wall.x0, -2, R.terrace.z0, R.wall.x0 + 0.01, -2, R.terrace.z0, R.wall.x0, -2, R.terrace.z0 + 0.01], 3));
sliver.setIndex([0, 1, 2]);
const grid = buildRuinsCameraSolid(sliver, ground).grid;

// the rock's surface in 0.5 m cells: by (y, z) for the inside test and by (x, y, z) for the clearance
const C = 0.5;
const cell = (v) => Math.floor(v / C);
const rays = new Map();
const space = new Map();
const put = (map, key, t) => (map.get(key) ?? map.set(key, []).get(key)).push(t);
{
  const pos = cliff.getAttribute('position');
  const idx = cliff.getIndex();
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
}
const ray = new THREE.Ray();
const hit = new THREE.Vector3();
const east = new THREE.Vector3(1, 0, 0);
const insideRock = (p) => {
  ray.set(p, east);
  let n = 0;
  for (const t of rays.get(`${cell(p.y)},${cell(p.z)}`) ?? []) if (t.x1 >= p.x && ray.intersectTriangle(t[0], t[1], t[2], false, hit)) n++;
  return n % 2 === 1;
};
const tri = new THREE.Triangle();
const near = new THREE.Vector3();
const rockClearance = (p) => {
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
// the masonry as built, in 0.5 m cells, for the flagged cameras' true clearance
const built = new Map();
for (const g of [masonry.stone.build(), masonry.tiles.build(), masonry.carving.build()]) {
  const pos = g.getAttribute('position');
  const idx = g.getIndex();
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const t = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j));
    const lo = t[0].clone().min(t[1]).min(t[2]);
    const hi = t[0].clone().max(t[1]).max(t[2]);
    for (let x = cell(lo.x); x <= cell(hi.x); x++) for (let y = cell(lo.y); y <= cell(hi.y); y++) for (let z = cell(lo.z); z <= cell(hi.z); z++) put(built, `${x},${y},${z}`, t);
  }
}
const faceN = new THREE.Vector3();
/** the distance to the nearest built masonry face within a cell (C) and whether the point is in front of it */
const masonryClearance = (p) => {
  let best = C;
  let front = true;
  for (let x = cell(p.x) - 1; x <= cell(p.x) + 1; x++) {
    for (let y = cell(p.y) - 1; y <= cell(p.y) + 1; y++) {
      for (let z = cell(p.z) - 1; z <= cell(p.z) + 1; z++) {
        for (const t of built.get(`${x},${y},${z}`) ?? []) {
          tri.set(t[0], t[1], t[2]);
          const d = tri.closestPointToPoint(p, near).distanceTo(p);
          if (d < best) {
            best = d;
            front = tri.getNormal(faceN).dot(p.clone().sub(near)) >= 0;
          }
        }
      }
    }
  }
  return { d: best, front };
};
const NEAR = 0.08;
const AIM = 1.5;
const SIGHT_SKIP = 0.3;

/** [camera, link] pairs: the routes' frames in the ruins' boxes (west of the village's edge) and the swung views */
const sources = [];
for (const r of play.walk ?? []) {
  if (!r.cams) continue;
  sources.push({ name: r.name, samples: r.cams.filter((c) => c[0] < -12 && inExpansionRuins(c[0], c[2])).map((c) => ({ cam: c.slice(0, 3), link: c.slice(3, 6) })) });
}
if (play.ruinsCamera) sources.push({ name: 'ruinsCamera (swung views)', samples: play.ruinsCamera.rows.map((r) => ({ cam: r.cam, link: r.link, spot: `${r.spot} ${r.yawDeg}° ${r.pitch}` })) });

const report = [];
for (const s of sources) {
  const bad = { insideRock: [], nearRock: [], masonry: [], insideMasonry: [], nearMasonry: [], underGround: [], underWater: [], hidden: [] };
  let minRock = Infinity;
  let minGround = Infinity;
  let minMasonry = Infinity;
  for (const smp of s.samples) {
    const p = new THREE.Vector3(...smp.cam);
    const where = smp.spot ?? `cam (${smp.cam.map((v) => v.toFixed(2)).join(', ')})`;
    const inside = insideRock(p);
    const clear = rockClearance(p);
    if (inside) bad.insideRock.push(where);
    else if (clear < NEAR) bad.nearRock.push(`${where} ${clear.toFixed(3)} m`);
    if (!inside) minRock = Math.min(minRock, clear);
    if (grid.hasCorePoint(p.x, p.y, p.z)) {
      const m = masonryClearance(p);
      bad.masonry.push(`${where} ${m.front ? '' : 'behind '}${m.d.toFixed(3)} m`);
      if (!m.front) bad.insideMasonry.push(`${where} ${m.d.toFixed(3)} m`);
      else if (m.d < NEAR) bad.nearMasonry.push(`${where} ${m.d.toFixed(3)} m`);
      if (m.front) minMasonry = Math.min(minMasonry, m.d);
    }
    const g = Math.max(walker.height(p.x, p.z), terrain.height(p.x, p.z));
    minGround = Math.min(minGround, p.y - g);
    if (p.y < g + NEAR) bad.underGround.push(`${where} ${(p.y - g).toFixed(3)} m`);
    if (terrain.height(p.x, p.z) < R.pool.water && p.y < R.pool.water + 0.02) bad.underWater.push(where);
    // the sight line to his chest, every 5 cm, not counting the first and last 0.3 m
    const aim = new THREE.Vector3(smp.link[0], smp.link[1] + AIM, smp.link[2]);
    const len = p.distanceTo(aim);
    let blocked = false;
    for (let d = SIGHT_SKIP; d < len - SIGHT_SKIP && !blocked; d += 0.05) {
      const q = p.clone().lerp(aim, d / len);
      if (grid.hasCorePoint(q.x, q.y, q.z) || insideRock(q)) blocked = true;
    }
    if (blocked) bad.hidden.push(where);
  }
  const row = { source: s.name, samples: s.samples.length, minRockClearanceM: +minRock.toFixed(3), minOverGroundM: +minGround.toFixed(3), flaggedMinMasonryClearanceM: Number.isFinite(minMasonry) ? +minMasonry.toFixed(3) : null };
  for (const [k, v] of Object.entries(bad)) row[k] = { n: v.length, first: v.slice(0, 4) };
  report.push(row);
}
for (const r of play.walk ?? []) {
  const c = r.camera;
  report.push({ route: r.name, reached: r.reached, waypoints: `${r.waypointsReached}/${r.of}`, stuck: r.stuck.length, lengthM: r.lengthM, minCameraAboveGroundM: r.minCameraAboveGroundM, accelP95: c?.accelMps2.p95, accelMax: c?.accelMps2.max, worstJumpM: Math.max(0, ...(c?.spikes ?? []).map((s) => s.jumpM)), spikesOver100: c?.spikes?.length ?? 0 });
}
if (play.ruinsProbes) report.push({ probes: `${play.ruinsProbes.rows.length - play.ruinsProbes.failed}/${play.ruinsProbes.rows.length}`, failed: play.ruinsProbes.rows.filter((r) => !r.ok), wade: play.ruinsProbes.wade });
console.log(JSON.stringify(report, null, 1));
