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
//    wall, the parapets, the arch's ring, the lintel, the piers, the gate boulders): the 0.25 m grid
//    the camera itself collides with;
//  - insideMasonry: inside the stone as masonry.ts lays it, whatever the grid says: a block's chamfered
//    box (geom.ts's `block`, recorded call by call, its top's sag included), a lathe's shell or an arch
//    ring's voussoirs (an odd number of crossings along two of three rays), with the distance to the
//    nearest built face (how deep it is); abutting stones do not fool it the way a nearest-face side
//    test is fooled (a camera inside a coping is in front of the ashlar face just under it);
//  - nearMasonry: outside the stone but nearer a built face (stone, tile, carving) than the near plane;
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
// the stone's solids as they are laid: geom.ts's block and lathe record each call (the modules share
// geom.ts's exports, read at call time) and the polygons laid outside them (the voussoirs, the mortar)
const geom = loadTs(src('world/ruins/geom.ts'));
const prims = [];
let laying = 0;
{
  const { block, lathe } = geom;
  const poly = geom.MeshBuilder.prototype.poly;
  geom.block = (mb, cx, cy, cz, ha, hy, hb, yaw, o) => {
    laying++;
    try {
      block(mb, cx, cy, cz, ha, hy, hb, yaw, o);
    } finally {
      laying--;
    }
    prims.push({ kind: 'block', mb, cx, cy, cz, ha, hy, hb, cs: Math.cos(yaw), sn: Math.sin(yaw), bev: Math.min(o.bevel ?? 0.04, ha * 0.45, hy * 0.45, hb * 0.45), sag: o.sag ?? [0, 0, 0, 0] });
  };
  geom.lathe = (mb, ...rest) => {
    const t0 = mb.idx.length;
    laying++;
    try {
      lathe(mb, ...rest);
    } finally {
      laying--;
    }
    prims.push({ kind: 'lathe', mb, t0, t1: mb.idx.length });
  };
  geom.MeshBuilder.prototype.poly = function (pts, normal, c, ...rest) {
    const t0 = this.idx.length;
    poly.call(this, pts, normal, c, ...rest);
    if (!laying) prims.push({ kind: 'poly', mb: this, t0, t1: this.idx.length, c });
  };
}
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
// the masonry as built, in 0.5 m cells: the distance from a camera to the nearest face (up to C)
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
const masonryClearance = (p) => {
  let best = C;
  for (let x = cell(p.x) - 1; x <= cell(p.x) + 1; x++) {
    for (let y = cell(p.y) - 1; y <= cell(p.y) + 1; y++) {
      for (let z = cell(p.z) - 1; z <= cell(p.z) + 1; z++) {
        for (const t of built.get(`${x},${y},${z}`) ?? []) best = Math.min(best, tri.set(t[0], t[1], t[2]).closestPointToPoint(p, near).distanceTo(p));
      }
    }
  }
  return best;
};

// the stone's solids: the blocks by 1 m columns (x, z), the lathes' and the voussoirs' shells
const stone = masonry.stone;
const boxes = prims.filter((q) => q.kind === 'block' && q.mb === stone);
if (!boxes.length) throw new Error('no blocks recorded: geom.ts is no longer called through its exports');
const columns = new Map();
for (const b of boxes) {
  const ex = Math.abs(b.cs) * b.ha + Math.abs(b.sn) * b.hb;
  const ez = Math.abs(b.sn) * b.ha + Math.abs(b.cs) * b.hb;
  for (let x = Math.floor(b.cx - ex); x <= Math.floor(b.cx + ex); x++) for (let z = Math.floor(b.cz - ez); z <= Math.floor(b.cz + ez); z++) put(columns, `${x},${z}`, b);
}
/** inside a block's chamfered box: its top sags by corner (geom.ts scales the upper half by the quadrant's sag), read here bilinearly across the top */
const inBlock = (b, p) => {
  const dx = p.x - b.cx;
  const dz = p.z - b.cz;
  const la = dx * b.cs + dz * b.sn;
  const lb = -dx * b.sn + dz * b.cs;
  let ly = p.y - b.cy;
  const A = Math.abs(la);
  const B = Math.abs(lb);
  if (A > b.ha || B > b.hb) return false;
  if (ly > 0) {
    const u = Math.min(1, Math.max(0, (la / Math.max(1e-6, b.ha - b.bev) + 1) / 2));
    const v = Math.min(1, Math.max(0, (lb / Math.max(1e-6, b.hb - b.bev) + 1) / 2));
    const [s0, s1, s2, s3] = b.sag;
    const s = (1 - u) * (1 - v) * s0 + (1 - u) * v * s1 + u * (1 - v) * s2 + u * v * s3;
    ly /= 1 + s / b.hy;
  }
  const Y = Math.abs(ly);
  if (Y > b.hy) return false;
  const { ha, hy, hb, bev } = b;
  return A + Y <= ha + hy - bev && A + B <= ha + hb - bev && Y + B <= hy + hb - bev && A + Y + B <= ha + hy + hb - 2 * bev;
};
const shellOf = (mb, ranges) => {
  const tris = [];
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const [t0, t1] of ranges) {
    for (let i = t0; i < t1; i += 3) {
      const t = [0, 1, 2].map((j) => new THREE.Vector3().fromArray(mb.pos, mb.idx[i + j] * 3));
      for (const v of t) {
        lo.min(v);
        hi.max(v);
      }
      tris.push(t);
    }
  }
  return { tris, lo, hi };
};
const lathes = prims.filter((q) => q.kind === 'lathe' && q.mb === stone).map((q) => shellOf(stone, [[q.t0, q.t1]]));
// the mortar planes behind the joints and the lost slabs' beds are open sheets, not solids
const sheet = (c) => ['0.36,0.34,0.3', '0.24,0.19,0.135'].includes(c.join(','));
const voussoirs = shellOf(
  stone,
  prims.filter((q) => q.kind === 'poly' && q.mb === stone && !sheet(q.c)).map((q) => [q.t0, q.t1]),
);
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const inShell = (s, p) => {
  if (p.x < s.lo.x || p.y < s.lo.y || p.z < s.lo.z || p.x > s.hi.x || p.y > s.hi.y || p.z > s.hi.z) return false;
  let odd = 0;
  for (const d of AXES) {
    ray.set(p, d);
    let n = 0;
    for (const t of s.tris) if (ray.intersectTriangle(t[0], t[1], t[2], false, hit)) n++;
    odd += n % 2;
  }
  return odd >= 2;
};
/** the solid the point is inside ('block at …', 'lathe', 'voussoir') or null */
const insideStone = (p) => {
  for (const b of columns.get(`${Math.floor(p.x)},${Math.floor(p.z)}`) ?? []) {
    if (inBlock(b, p)) return `block at (${[b.cx, b.cy, b.cz].map((v) => v.toFixed(2)).join(', ')}) half ${[b.ha, b.hy, b.hb].map((v) => v.toFixed(2)).join(' × ')}`;
  }
  for (const s of lathes) if (inShell(s, p)) return 'lathe';
  if (inShell(voussoirs, p)) return 'voussoir';
  return null;
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
    if (grid.hasCorePoint(p.x, p.y, p.z)) bad.masonry.push(where);
    const inStone = insideStone(p);
    const dm = masonryClearance(p);
    if (inStone) bad.insideMasonry.push(`${where} ${dm.toFixed(3)} m deep in the ${inStone}`);
    else {
      if (dm < NEAR) bad.nearMasonry.push(`${where} ${dm.toFixed(3)} m`);
      minMasonry = Math.min(minMasonry, dm);
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
  const row = { source: s.name, samples: s.samples.length, minRockClearanceM: +minRock.toFixed(3), minOverGroundM: +minGround.toFixed(3), minMasonryClearanceM: +minMasonry.toFixed(3) };
  for (const [k, v] of Object.entries(bad)) row[k] = { n: v.length, first: v.slice(0, k === 'insideMasonry' || k === 'nearMasonry' ? 12 : 4) };
  report.push(row);
}
for (const r of play.walk ?? []) {
  const c = r.camera;
  report.push({ route: r.name, reached: r.reached, waypoints: `${r.waypointsReached}/${r.of}`, stuck: r.stuck.length, lengthM: r.lengthM, minCameraAboveGroundM: r.minCameraAboveGroundM, accelP95: c?.accelMps2.p95, accelMax: c?.accelMps2.max, worstJumpM: Math.max(0, ...(c?.spikes ?? []).map((s) => s.jumpM)), spikesOver100: c?.spikes?.length ?? 0 });
}
if (play.ruinsProbes) report.push({ probes: `${play.ruinsProbes.rows.length - play.ruinsProbes.failed}/${play.ruinsProbes.rows.length}`, failed: play.ruinsProbes.rows.filter((r) => !r.ok), wade: play.ruinsProbes.wade });
console.log(JSON.stringify(report, null, 1));
