/**
 * 2026-09-24 (expansion-north): the grove above the ledge terrace — the flight up the bank, the
 * trail's stepping discs, the levelled shelf and the hamlet's built feet. Run:
 * node src/world/terrain/expansionNorth.test.mjs (Node 20+, no browser).
 *
 * Checks, off the authored heightfield, terrain/north.ts, the character ground and the footsteps'
 * surface lookup (the decks' walk surfaces are built by structures and walked by
 * `playtest.mjs --walk-routes north-grove`):
 *   1. the live view leaves the legacy one only inside `EXPANSION_NORTH_BOX` (a ring round the box
 *      agrees to the bit, heights and masks; no seam just inside its edge), and the legacy mask
 *      has none of it;
 *   2. the flight: each tread one `rise` above the last, on the stairs, walkable, landing at the
 *      trail's first design height;
 *   3. the trail: every disc paved (live only), the ground on the design profile, a walkable grade,
 *      walkable across its width;
 *   4. the shelf: level round the yard and on the gangway's pad, walkable to the house's door;
 *   5. the built feet (the house's bole, the stump, the stilts, the trestle, the column): in the
 *      live structure mask and blocked;
 *   6. `groveWalkDistance`: 0 where a walker can be, the distance off the shelf beside it, Infinity
 *      far from the grove;
 *   7. the legacy streams' filters: `expansionCull` on the discs, the treads and the built feet, not
 *      at Link's spawn or any fixed camera; `northGroveClear` on every walk, not in the woods;
 *   8. the footsteps: wood on the veranda, the gangway, the rope walk and the hut's platform,
 *      stone on the discs and the flight;
 *   9. the lawn: `groveGroundDistance` / `groveDeckDistance`, `groveLawn` full round the walkable
 *      ground and gone in the woods and on the terrace, the terrain's forest floor bare under it and
 *      kept off it, its mask covering the grove on the round-46 texel lattice.
 */
import assert from 'node:assert/strict';
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

const hf = loadTs(path.join(here, 'heightfield.ts'));
const north = loadTs(path.join(here, 'north.ts'));
const layout = loadTs(path.join(here, '../layout.ts'));
const { LAYOUT, EXPANSION_NORTH: N, EXPANSION_NORTH_BOX: B, NORTH_STAIRS, inExpansionNorth, northGangway, northRopeWalkEnds } = layout;
const { createGround } = loadTs(path.join(here, '../character/ground.ts'));
const { surfaceAt } = loadTs(path.join(here, '../../audio/index.ts'));
const live = hf.createTerrain('live');
const legacy = hf.createTerrain('legacy');
const ground = createGround(live, LAYOUT, {});
const fmt = (x, z) => `(${x.toFixed(2)}, ${z.toFixed(2)})`;
const measured = {};

// 1. the live view leaves the legacy one only inside the grove's box
{
  const OUT = 1.1;
  const pts = [];
  for (let x = B.x0 - OUT; x <= B.x1 + OUT; x += 0.25) pts.push([x, B.z0 - OUT], [x, B.z1 + OUT]);
  for (let z = B.z0 - OUT; z <= B.z1 + OUT; z += 0.25) pts.push([B.x0 - OUT, z], [B.x1 + OUT, z]);
  for (const [x, z] of pts) {
    assert.equal(live.height(x, z), legacy.height(x, z), `live == legacy just outside the grove's box at ${fmt(x, z)}`);
    assert.deepEqual(hf.surfaceMask(x, z, 'live'), hf.surfaceMask(x, z, 'legacy'), `live mask == legacy mask just outside the grove's box at ${fmt(x, z)}`);
  }
  assert.ok(pts.length > 500, `ringed the grove's box (${pts.length} points)`);
  // the landform has blended back to the natural slope by the box's edge: no seam just inside it
  let seam = 0;
  for (let x = B.x0 + 0.05; x <= B.x1 - 0.05; x += 0.25) seam = Math.max(seam, Math.abs(live.height(x, B.z0 + 0.05) - legacy.height(x, B.z0 + 0.05)));
  for (let z = B.z0 + 0.05; z <= B.z1 - 0.05; z += 0.25) {
    seam = Math.max(seam, Math.abs(live.height(B.x0 + 0.05, z) - legacy.height(B.x0 + 0.05, z)));
    seam = Math.max(seam, Math.abs(live.height(B.x1 - 0.05, z) - legacy.height(B.x1 - 0.05, z)));
  }
  assert.ok(seam < 1e-3, `no seam just inside the grove's box (${seam.toFixed(4)} m)`);
  // inside, the change is real (the flight's trench, the trail's cut, the shelf) and live-only
  let moved = 0;
  let inside = 0;
  for (let z = B.z0; z <= B.z1; z += 0.5) {
    for (let x = B.x0; x <= B.x1; x += 0.5) {
      inside++;
      if (Math.abs(live.height(x, z) - legacy.height(x, z)) > 0.05) moved++;
      const mg = hf.surfaceMask(x, z, 'legacy');
      if (z < -78) assert.ok(mg.path < 0.05 && mg.stairs === 0, `the legacy mask has no grove paving at ${fmt(x, z)}`);
      if (z < -78 && north.northStructure(x, z) > 0.5) assert.equal(mg.structure, 0, `the legacy mask has no grove structure at ${fmt(x, z)}`);
    }
  }
  assert.ok(moved > 0.15 * inside, `the grove moves the live ground in its box (${moved} of ${inside} cells)`);
  measured.ring = `${pts.length}-point ring, ${moved}/${inside} cells moved`;
}

// 2. the flight up the bank
{
  const f = NORTH_STAIRS[0];
  const l = Math.hypot(f.dir[0], f.dir[1]);
  const dx = f.dir[0] / l;
  const dz = f.dir[1] / l;
  for (let i = 0; i < f.steps; i++) {
    for (const v of [-f.width / 2 + 0.2, 0, f.width / 2 - 0.2]) {
      const u = (i + 0.5) * f.tread;
      const x = f.base[0] + dx * u - dz * v;
      const z = f.base[2] + dz * u + dx * v;
      assert.ok(Math.abs(ground.height(x, z) - (f.base[1] + (i + 1) * f.rise)) < 1e-6, `tread ${i} one rise above the last at ${fmt(x, z)}`);
      assert.ok(ground.onStairs(x, z), `on the flight at tread ${i}`);
      assert.equal(ground.blocked(x, z), false, `tread ${i} walkable at ${fmt(x, z)}`);
      assert.ok(hf.surfaceMask(x, z, 'live').stairs > 0.5, `the live mask has the flight at tread ${i}`);
    }
  }
  const top = f.steps * f.tread + 0.4;
  assert.ok(Math.abs(ground.height(f.base[0] + dx * top, f.base[2] + dz * top) - N.trail[0][1]) < 0.01, 'the flight lands at the trail\'s first design height');
}

// 3. the trail: paved discs, the design profile, a walkable grade, walkable across
{
  for (const s of north.NORTH_STONES) {
    assert.ok(hf.surfaceMask(s.x, s.z, 'live').path > 0.95, `disc paved at ${fmt(s.x, s.z)}`);
    assert.ok(hf.surfaceMask(s.x, s.z, 'legacy').path < 0.05, `no disc in the legacy view at ${fmt(s.x, s.z)}`);
  }
  const due = Math.floor((north.NORTH_TRAIL_LENGTH - N.discs.from) / (N.discs.spacing * 1.12));
  assert.ok(north.NORTH_STONES.length >= due, `the trail carries ${north.NORTH_STONES.length} discs over ${north.NORTH_TRAIL_LENGTH.toFixed(1)} m (≥ ${due})`);
  let maxDev = 0;
  let maxGrade = 0;
  let steepAt = '';
  const T = N.trail;
  for (let i = 0; i + 1 < T.length; i++) {
    const [ax, ay, az] = T[i];
    const [bx, by, bz] = T[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let s = 0; s <= len; s += 0.25) {
      const t = s / len;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      maxDev = Math.max(maxDev, Math.abs(live.height(x, z) - (ay + (by - ay) * t)));
      for (const c of [-N.trailHalfWidth + 0.3, 0, N.trailHalfWidth - 0.3]) assert.equal(ground.blocked(x + nx * c, z + nz * c), false, `trail walkable at ${fmt(x + nx * c, z + nz * c)}`);
      // the grade over a metre of the centreline
      if (s + 1 <= len) {
        const g = Math.abs(live.height(x + ((bx - ax) / len) * 1, z + ((bz - az) / len) * 1) - live.height(x, z));
        if (g > maxGrade) {
          maxGrade = g;
          steepAt = fmt(x, z);
        }
      }
    }
  }
  assert.ok(maxDev < 0.08, `the trail's ground within ${maxDev.toFixed(3)} m of its design profile`);
  assert.ok(maxGrade <= 0.3, `the trail's steepest grade ${maxGrade.toFixed(3)} (at ${steepAt})`);
  measured.trail = `${north.NORTH_TRAIL_LENGTH.toFixed(1)} m, ${north.NORTH_STONES.length} discs, ≤ ${maxDev.toFixed(3)} m off the profile, grade ≤ ${maxGrade.toFixed(2)}`;
}

// 4. the shelf: level round the yard and on the pad, walkable to the door
{
  const S = N.shelf;
  const H = N.house;
  let maxDev = 0;
  let cells = 0;
  for (let z = S.cz - S.hz; z <= S.cz + S.hz; z += 0.25) {
    for (let x = S.cx - S.hx; x <= S.cx + S.hx; x += 0.25) {
      if (north.shelfDistance(x, z) > -0.6) continue;
      if (Math.hypot(x - H.position[0], z - H.position[2]) < H.trunkRadius + 1.2) continue;
      cells++;
      maxDev = Math.max(maxDev, Math.abs(live.height(x, z) - S.y));
      assert.equal(ground.blocked(x, z), false, `the yard walkable at ${fmt(x, z)}`);
    }
  }
  assert.ok(cells > 1000 && maxDev < 0.1, `the shelf level within ${maxDev.toFixed(3)} m over ${cells} cells`);
  const p = S.pads[0];
  let padDev = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.3) for (const r of [0, 0.5, 1.0]) padDev = Math.max(padDev, Math.abs(live.height(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) - S.y));
  assert.ok(padDev < 0.04, `the gangway's pad level within ${padDev.toFixed(3)} m`);
  const [dx, dz] = north.GROVE_DOOR;
  assert.equal(ground.blocked(dx, dz), false, 'the house\'s door threshold is walkable');
  assert.ok(north.groveSurface(dx, dz) > 0.2, 'a worn path reaches the house\'s door');
  measured.shelf = `level ±${maxDev.toFixed(3)} m, pad ±${padDev.toFixed(3)} m`;
}

// 5. the built feet
{
  const H = N.house;
  const feet = [
    ['house bole', H.position[0] + H.trunkRadius * 0.7, H.position[2]],
    ['stump', N.stilt.host[0], N.stilt.host[1]],
    ...north.stiltFeet().map(([x, z], i) => [`stilt ${i}`, x, z]),
    ...north.gangwayTrestleFeet().map(([x, z], i) => [`trestle ${i}`, x, z]),
    ['column', N.hut.host[0], N.hut.host[1]],
  ];
  for (const [id, x, z] of feet) {
    assert.ok(hf.surfaceMask(x, z, 'live').structure > 0.5, `${id} in the live structure mask`);
    assert.equal(ground.blocked(x, z), true, `${id} blocked at ${fmt(x, z)}`);
  }
}

// 6. how far from where a walker can be
{
  const g = northGangway();
  const rw = northRopeWalkEnds();
  const on = [
    ['trail', N.trail[2][0], N.trail[2][2]],
    ['shelf', N.shelf.cx, N.shelf.cz],
    ['pad', N.shelf.pads[0].x, N.shelf.pads[0].z],
    ['gangway', (g.foot[0] + g.head[0]) / 2, (g.foot[2] + g.head[2]) / 2],
    ['veranda', N.stilt.host[0] + 2.1, N.stilt.host[1]],
    ['rope walk', (rw.stilt[0] + rw.hut[0]) / 2, (rw.stilt[2] + rw.hut[2]) / 2],
    ['hut', N.hut.host[0], N.hut.host[1]],
  ];
  for (const [id, x, z] of on) assert.equal(north.groveWalkDistance(x, z), 0, `groveWalkDistance 0 on the ${id}`);
  const west = north.groveWalkDistance(N.shelf.cx - N.shelf.hx - 5, N.shelf.cz);
  assert.ok(Math.abs(west - 5) < 0.05, `5 m west of the shelf is ${west.toFixed(3)} m from the walks`);
  assert.equal(north.groveWalkDistance(0, 0), Infinity, 'the plaza is out of the grove\'s reach');
}

// 7. the legacy streams' filters
{
  for (const s of north.NORTH_STONES) assert.equal(hf.expansionCull(s.x, s.z), true, `cull on the disc at ${fmt(s.x, s.z)}`);
  const f = NORTH_STAIRS[0];
  const l = Math.hypot(f.dir[0], f.dir[1]);
  for (let i = 0; i < f.steps; i++) {
    const u = (i + 0.5) * f.tread;
    assert.equal(hf.expansionCull(f.base[0] + (f.dir[0] / l) * u, f.base[2] + (f.dir[1] / l) * u), true, `cull on tread ${i}`);
  }
  for (const [x, z] of [[N.stilt.host[0], N.stilt.host[1]], [N.hut.host[0], N.hut.host[1]], ...north.stiltFeet()]) assert.equal(hf.expansionCull(x, z), true, `cull on the built foot at ${fmt(x, z)}`);
  assert.equal(hf.expansionCull(0, 0.5), false, 'Link\'s spawn is kept');
  for (const v of LAYOUT.viewpoints) assert.equal(hf.expansionCull(v.position[0], v.position[2]), false, `viewpoint ${v.id} is kept`);
  // every walk is cleared of trunks; the woods a few metres off them are not
  let clear = 0;
  let woods = 0;
  for (let z = B.z0 - 6; z <= B.z1; z += 0.5) {
    for (let x = B.x0 - 6; x <= B.x1 + 6; x += 0.5) {
      const d = north.groveWalkDistance(x, z);
      if (d === 0) {
        clear++;
        assert.equal(north.northGroveClear(x, z, 0.3), true, `no trunk on the walk at ${fmt(x, z)}`);
      } else if (d > 4.5 && z < -80) {
        const post = N.lanternPosts.some((p) => Math.hypot(x - p.position[0], z - p.position[1]) < 3);
        if (post) continue;
        woods++;
        assert.equal(north.northGroveClear(x, z, 0.8), false, `the woods keep their trunks at ${fmt(x, z)}`);
      }
    }
  }
  assert.ok(clear > 600 && woods > 1500, `walk cells cleared ${clear}, wood cells kept ${woods}`);
  assert.equal(inExpansionNorth(0, 0), false, 'the plaza is outside the grove\'s box');
}

// 8. the footsteps
{
  const g = northGangway();
  const rw = northRopeWalkEnds();
  const wood = [
    ['veranda', N.stilt.host[0] + 2.1, N.stilt.host[1]],
    ['veranda (south)', N.stilt.host[0], N.stilt.host[1] - 2.4],
    ['gangway foot', g.foot[0], g.foot[2]],
    ['gangway', (g.foot[0] + g.head[0]) / 2, (g.foot[2] + g.head[2]) / 2],
    ['rope walk', (rw.stilt[0] + rw.hut[0]) / 2, (rw.stilt[2] + rw.hut[2]) / 2],
    ['hut platform', N.hut.host[0] + N.hut.radius + 0.1, N.hut.host[1]],
  ];
  for (const [id, x, z] of wood) assert.equal(surfaceAt(x, z).surface, 'wood', `wood underfoot on the ${id}`);
  for (const s of north.NORTH_STONES) assert.equal(surfaceAt(s.x, s.z).surface, 'stone', `stone underfoot on the disc at ${fmt(s.x, s.z)}`);
  const f = NORTH_STAIRS[0];
  const l = Math.hypot(f.dir[0], f.dir[1]);
  const st = surfaceAt(f.base[0] + (f.dir[0] / l) * 1.9, f.base[2] + (f.dir[1] / l) * 1.9);
  assert.ok(st.surface === 'stone' && st.stairs, 'stone stairs underfoot on the flight');
  assert.notEqual(surfaceAt(N.stilt.host[0] + N.stilt.radius + N.stilt.veranda + 0.3, N.stilt.host[1]).surface, 'wood', 'off the veranda\'s rim is not wood');
  assert.notEqual(surfaceAt(N.shelf.cx - 5, N.shelf.cz + 2).surface, 'wood', 'the yard is not wood');
}

// 9. the lawn round the walkable ground, and the terrain's forest floor giving way to it
{
  const { forestFloorAt, FOREST_FLOOR } = loadTs(path.join(here, 'material.ts'));
  const g = northGangway();
  const rw = northRopeWalkEnds();
  for (const [id, x, z] of [['trail', N.trail[2][0], N.trail[2][2]], ['shelf', N.shelf.cx, N.shelf.cz], ['pad', N.shelf.pads[0].x, N.shelf.pads[0].z]]) {
    assert.equal(north.groveGroundDistance(x, z), 0, `groveGroundDistance 0 on the ${id}`);
    // (the pad is where the gangway leaves the ground, beside its raised run)
    if (id !== 'pad') assert.ok(north.groveDeckDistance(x, z) > 5, `the ${id} is clear of the decks (${north.groveDeckDistance(x, z).toFixed(2)} m)`);
  }
  const decks = [
    ['veranda', N.stilt.host[0] + 2.1, N.stilt.host[1]],
    ['gangway head', g.head[0], g.head[2]],
    ['rope walk', (rw.stilt[0] + rw.hut[0]) / 2, (rw.stilt[2] + rw.hut[2]) / 2],
    ['hut', N.hut.host[0], N.hut.host[1]],
  ];
  for (const [id, x, z] of decks) {
    assert.ok(north.groveDeckDistance(x, z) < 0, `under the ${id}'s deck (${north.groveDeckDistance(x, z).toFixed(2)} m)`);
    assert.ok(north.groveGroundDistance(x, z) > 0, `the ${id} is no walkable ground`);
  }
  assert.equal(north.groveGroundDistance(0, 0), Infinity, 'the plaza is out of the grove\'s ground reach');
  // full within GROVE_LAWN_M[0] less its jitter of the walkable ground, gone past GROVE_LAWN_M[1]
  // plus it and on the ledge terrace (the village's own lawn); the forest floor bare under a full
  // lawn and kept where there is none
  const [full, none] = north.GROVE_LAWN_M;
  const JITTER = 2.5;
  let lawnCells = 0;
  let woodCells = 0;
  let woodLitter = 0;
  for (let z = B.z0 - 4; z <= B.z1 + 2; z += 0.5) {
    for (let x = B.x0 - 8; x <= B.x1 + 8; x += 0.5) {
      const lawn = north.groveLawn(x, z);
      if (z >= -79.4) {
        assert.equal(lawn, 0, `no grove lawn on the terrace at ${fmt(x, z)}`);
        continue;
      }
      const gd = north.groveGroundDistance(x, z);
      if (z < -81.6 && gd <= full - JITTER) assert.equal(lawn, 1, `full lawn by the walks at ${fmt(x, z)}`);
      if (gd >= none + JITTER) assert.equal(lawn, 0, `no lawn in the woods at ${fmt(x, z)}`);
      const [litter, humus] = forestFloorAt(x, z);
      if (lawn >= 1) {
        lawnCells++;
        assert.ok(litter === 0 && humus === 0, `no forest floor under the full lawn at ${fmt(x, z)}`);
      } else if (lawn <= 0 && inExpansionNorth(x, z)) {
        woodCells++;
        woodLitter += litter;
      }
    }
  }
  assert.ok(lawnCells > 1500 && woodCells > 600, `lawn cells ${lawnCells}, wood cells ${woodCells}`);
  assert.ok(woodLitter / woodCells > 0.5, `the woods keep their forest floor (mean litter ${(woodLitter / woodCells).toFixed(3)})`);
  // the mask covers the grove's box, on the round-46 lattice (its rows south of z −90 sample the points they did)
  const [, fz0, , fdz] = FOREST_FLOOR.box;
  const texel = fdz / FOREST_FLOOR.res[1];
  const rows = (-90 - fz0) / texel;
  assert.ok(fz0 <= B.z0, `the forest-floor mask reaches z ${fz0.toFixed(2)} (the grove's box ends at ${B.z0})`);
  assert.ok(Math.abs(rows - Math.round(rows)) < 1e-9 && Math.abs(texel - 100 / 192) < 1e-12, `whole texels north of z −90 (${rows.toFixed(6)} rows of ${texel.toFixed(6)} m)`);
  measured.lawn = `${lawnCells} lawn cells bare of litter, woods ${(woodLitter / woodCells).toFixed(2)}`;
}

console.log(`expansionNorth.test.mjs: ok (${measured.ring}; trail ${measured.trail}; shelf ${measured.shelf}; lawn ${measured.lawn})`);
