/**
 * Round 56 (expansion-south): the village's way out — the path from the spine's end to the rope
 * bridge, the ravine it crosses, the far path into the glowing hollow log and the bank the log
 * burrows into. Run: node src/world/terrain/expansionSouth.test.mjs (Node 20+, no browser).
 *
 * Checks, off the authored heightfield, terrain/south.ts and the character ground:
 *   1. the live view leaves the legacy one only inside `EXPANSION_SOUTH_BOXES` (a ring round each
 *      box agrees to the bit, heights and masks), and the legacy mask has none of it;
 *   2. the path: paved (live) from the spine's end to the north sill, legacy lawn past the old
 *      end cap, walkable at a gentle grade, clear of the three south giants' boles;
 *   3. the ravine: 6–10 m deep and 10–16 m lip to lip under the bridge, its floor well under the
 *      deck, and the far bank's rise zero wherever the gorge cuts;
 *   4. the bridge: the deck line (the walk span structures builds) walkable sill to sill, a drop
 *      under it; blocked just off either side of the planks and on every wall;
 *   5. the far bank: its path and the log's floor walkable to the walk's end, the tube's end, the
 *      shell and the rest of the far bank blocked; the hollow carved under the floor deck;
 *   6. the legacy streams' filters: `expansionCull` on the paving, the posts and in the gorge, not
 *      at Link's spawn or any fixed camera; `southFooting` culls a bole on the paving, at the
 *      mouth or over the lip, seats one on the bank's live ground (never steeper than 0.55),
 *      keeps one where the two views agree; `westExpansionCull` is `expansionCull` outside the
 *      south boxes.
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
const south = loadTs(path.join(here, 'south.ts'));
const layout = loadTs(path.join(here, '../layout.ts'));
const { LAYOUT, EXPANSION, EXPANSION_BOX, EXPANSION_SOUTH: S, EXPANSION_SOUTH_BOXES, inExpansionSouth, southPathLine, southPathHalfWidth, southBridgeFrame } = layout;
const { createGround } = loadTs(path.join(here, '../character/ground.ts'));
const live = hf.createTerrain('live');
const legacy = hf.createTerrain('legacy');
const fmt = (x, z) => `(${x.toFixed(2)}, ${z.toFixed(2)})`;
const B = S.bridge;
const T = S.tunnel;
const BF = southBridgeFrame();
const bw = (a, c) => [B.north[0] + BF.ax * a + BF.cx * c, B.north[1] + BF.az * a + BF.cz * c];
const Y_N = hf.SOUTH_NORTH_SILL_Y + B.sill;
const Y_S = hf.SOUTH_FLOOR_Y + B.sill;
const deckY = (a) => south.bridgeDeckY(a, Y_N, Y_S);
const FLOOR_Y = hf.SOUTH_FLOOR_Y;

// the walk spans exactly as structures/expansionSouth.ts hands them to the ground (the deck line
// sill to sill, 6 mm under the plank tops; the log's floor from the apron to the walk's end)
const deckPts = [];
const addDeck = (a, y) => {
  const [x, z] = bw(a, 0);
  deckPts.push([x, y, z]);
};
{
  const [nx, nz] = bw(-0.5, 0);
  const [sx, sz] = bw(BF.len + 0.5, 0);
  addDeck(-0.5, live.height(nx, nz) + 0.04);
  addDeck(-0.28, live.height(nx, nz) + 0.06);
  addDeck(-0.02, Y_N - 0.006);
  for (let a = 0.5; a < BF.len - 0.25; a += 0.5) addDeck(a, deckY(a) - 0.006);
  addDeck(BF.len + 0.02, Y_S - 0.006);
  addDeck(BF.len + 0.28, live.height(sx, sz) + 0.06);
  addDeck(BF.len + 0.5, live.height(sx, sz) + 0.04);
}
const floorPts = [
  [-0.8, FLOOR_Y + 0.03],
  [-0.3, FLOOR_Y + 0.02],
  [0.1, FLOOR_Y + 0.022],
  [T.deadEnd - 0.2, FLOOR_Y + 0.022],
].map(([a, y]) => {
  const [x, z] = south.tunnelWorld(a, 0);
  return [x, y, z];
});
const measured = {};
const ground = createGround(live, LAYOUT, {
  walkSpans: [
    { id: 'south-bridge-deck', pts: deckPts, hw: B.walkHalfWidth },
    { id: 'south-log-floor', pts: floorPts, hw: 0.8 },
  ],
});

// 1. the live view leaves the legacy one only inside the south boxes
{
  const westExpansion = (x, z) =>
    (x >= EXPANSION_BOX.x0 - 1.2 && x <= EXPANSION_BOX.x1 + 1.2 && z >= EXPANSION_BOX.z0 - 1.2 && z <= EXPANSION_BOX.z1 + 1.2) ||
    Math.hypot(x - EXPANSION.farHut.host[0], z - EXPANSION.farHut.host[1]) < EXPANSION.farHutRise.radius + 1.8;
  // 1.1 m out: past z 48 a sampled height interpolates the 1 m lattice
  const OUT = 1.1;
  let ring = 0;
  for (const b of EXPANSION_SOUTH_BOXES) {
    const x0 = b.x0 - OUT;
    const x1 = b.x1 + OUT;
    const z0 = b.z0 - OUT;
    const z1 = b.z1 + OUT;
    const pts = [];
    for (let x = x0; x <= x1; x += 0.25) pts.push([x, z0], [x, z1]);
    for (let z = z0; z <= z1; z += 0.25) pts.push([x0, z], [x1, z]);
    for (const [x, z] of pts) {
      if (westExpansion(x, z) || EXPANSION_SOUTH_BOXES.some((o) => x >= o.x0 - OUT + 0.01 && x <= o.x1 + OUT - 0.01 && z >= o.z0 - OUT + 0.01 && z <= o.z1 + OUT - 0.01)) continue;
      const ml = hf.surfaceMask(x, z, 'live');
      const mg = hf.surfaceMask(x, z, 'legacy');
      assert.equal(live.height(x, z), legacy.height(x, z), `live == legacy just outside the south boxes at ${fmt(x, z)}`);
      assert.deepEqual(ml, mg, `live mask == legacy mask just outside the south boxes at ${fmt(x, z)}`);
      ring++;
    }
  }
  assert.ok(ring > 300, `ringed the south boxes (${ring} points)`);
  // inside, the change is real: the path, the gorge and the bank all move the ground
  let moved = 0;
  let inside = 0;
  for (let z = 10; z <= 64; z += 0.5) {
    for (let x = -32; x <= 34; x += 0.5) {
      if (!inExpansionSouth(x, z)) continue;
      inside++;
      if (Math.abs(live.height(x, z) - legacy.height(x, z)) > 0.05) moved++;
      const mg = hf.surfaceMask(x, z, 'legacy');
      if (z > 19) assert.ok(mg.structure === 0 || mg.structure === hf.surfaceMask(x, z, 'live').structure, `the legacy mask has no south structure at ${fmt(x, z)}`);
    }
  }
  assert.ok(moved > 0.25 * inside, `the south exit moves the live ground in its boxes (${moved} of ${inside} cells)`);
  // the legacy mask has no south paving past the old end cap
  for (const p of southPathLine()) if (p[2] > 18.5) assert.ok(hf.surfaceMask(p[0], p[2], 'legacy').path < 0.05, `legacy lawn at ${fmt(p[0], p[2])}`);
}

// 2. the path: paved, walkable, gentle, clear of the giants
{
  const line = southPathLine();
  let s = 0;
  let maxGrade = 0;
  let steepAt = '';
  for (let i = 0; i < line.length; i++) {
    const [x, , z] = line[i];
    if (i > 0) s += Math.hypot(x - line[i - 1][0], z - line[i - 1][2]);
    const hw = southPathHalfWidth(s);
    assert.ok(hf.surfaceMask(x, z, 'live').path > 0.95, `paved at ${fmt(x, z)} (s ${s.toFixed(1)} m)`);
    assert.ok(hf.southRouteSurface(x, z) > 0.95 || z < 17.5, `south paving at ${fmt(x, z)}`);
    // walkable across the paving (0.25 m in from each edge; the last metre narrows between the end posts)
    const [nx, nz] = i + 1 < line.length ? [line[i + 1][0] - x, line[i + 1][2] - z] : [x - line[i - 1][0], z - line[i - 1][2]];
    const nl = Math.hypot(nx, nz);
    for (const k of south.bridgeLocal(x, z).a < -0.9 ? [-1, 0, 1] : [0]) {
      const px = x + (-nz / nl) * k * (hw - 0.25);
      const pz = z + (nx / nl) * k * (hw - 0.25);
      assert.equal(ground.blocked(px, pz), false, `path walkable at ${fmt(px, pz)}`);
    }
    if (i > 0) {
      const run = Math.hypot(x - line[i - 1][0], z - line[i - 1][2]);
      const grade = Math.abs(ground.height(x, z) - ground.height(line[i - 1][0], line[i - 1][2])) / run;
      if (grade > maxGrade) {
        maxGrade = grade;
        steepAt = fmt(x, z);
      }
    }
  }
  assert.ok(maxGrade <= 0.3, `the path's steepest grade ${maxGrade.toFixed(3)} (at ${steepAt})`);
  // the giants' flared boles meet the ground far outside their layout `trunkRadius` (trees/giant.ts
  // girth × flare, measured by building each giant): the south paving (where the legacy paving pass
  // leaves off — the spine's end cap has sat under `plaza-south`'s flare since before round 56)
  // keeps ≥ 0.35 m off each foot past 0.1 m of bark relief
  const BOLE_FOOT_M = { 'plaza-south': 3.9, 'south-centre': 3.16, 'south-giant': 2.47 };
  let footGap = Infinity;
  for (let x = -8; x <= 10; x += 0.1) {
    for (let z = 14; z <= 31; z += 0.1) {
      if (hf.southRouteSurface(x, z) < 0.05 || hf.legacyPathMask(x, z, hf.surfaceMask(x, z, 'legacy').path) >= 0.36) continue;
      for (const [id, foot] of Object.entries(BOLE_FOOT_M)) {
        const g = LAYOUT.giantTrees.find((t) => t.id === id).position;
        const gap = Math.hypot(x - g[0], z - g[2]) - foot - 0.1;
        footGap = Math.min(footGap, gap);
        assert.ok(gap >= 0.35, `the south paving keeps ${gap.toFixed(2)} m off ${id}'s bole foot at ${fmt(x, z)}`);
      }
    }
  }
  measured.path = `${s.toFixed(1)} m, grade ≤ ${maxGrade.toFixed(2)}, ≥ ${footGap.toFixed(2)} m off the giants' feet`;
  assert.ok(s > 14, `the path runs ${s.toFixed(1)} m from the spine's end to the bridge`);
  // it leaves the spine's end at the spine's level
  const [x0, , z0] = line[0];
  assert.ok(Math.abs(live.height(x0, z0) - legacy.height(x0, z0)) < 0.02, `the path joins the spine's end cap level (${live.height(x0, z0).toFixed(3)} vs ${legacy.height(x0, z0).toFixed(3)})`);
}

// 3. the ravine under the bridge
{
  const cutAt = (a) => {
    const [x, z] = bw(a, 0);
    return south.ravineCut(x, z);
  };
  let northLip = null;
  let southLip = null;
  for (let a = -3; a <= BF.len + 3; a += 0.05) {
    if (cutAt(a) > 0.04) {
      if (northLip === null) northLip = a;
      southLip = a;
    }
  }
  assert.ok(northLip !== null && southLip !== null, 'the gorge runs under the bridge');
  const width = southLip - northLip;
  assert.ok(width >= 10 && width <= 16, `the gorge is ${width.toFixed(2)} m lip to lip under the bridge`);
  assert.ok(northLip >= -0.2 && southLip <= BF.len + 0.2, `both lips fall between the sills (${northLip.toFixed(2)} … ${southLip.toFixed(2)} of ${BF.len.toFixed(2)} m)`);
  let floor = Infinity;
  let floorA = 0;
  for (let a = northLip; a <= southLip; a += 0.1) {
    const [x, z] = bw(a, 0);
    const h = live.height(x, z);
    if (h < floor) {
      floor = h;
      floorA = a;
    }
  }
  const rim = 0.5 * (hf.SOUTH_NORTH_SILL_Y + FLOOR_Y);
  const depth = rim - floor;
  measured.gorge = `${width.toFixed(1)} m lip to lip, ${depth.toFixed(1)} m deep`;
  assert.ok(depth >= 6 && depth <= 10, `the gorge is ${depth.toFixed(2)} m deep under the bridge (floor ${floor.toFixed(2)} at a ${floorA.toFixed(1)})`);
  // the deck hangs over a real drop everywhere past the lips' first metre and a half
  for (let a = northLip + 1.5; a <= southLip - 1.5; a += 0.25) {
    const [x, z] = bw(a, 0);
    assert.ok(deckY(a) - live.height(x, z) > 1.5, `a drop under the deck at a ${a.toFixed(2)}: ${(deckY(a) - live.height(x, z)).toFixed(2)} m`);
  }
  // the far bank's rise never lands in the gorge (the cut is measured from the ground it lands on)
  const SB = EXPANSION_SOUTH_BOXES[2];
  let bankCells = 0;
  for (let z = SB.z0; z <= SB.z1; z += 0.5) {
    for (let x = SB.x0; x <= SB.x1; x += 0.5) {
      const bank = south.bankHeight(x, z);
      if (bank > 0) bankCells++;
      if (south.ravineCut(x, z) > 0) assert.equal(bank, 0, `no bank where the gorge cuts at ${fmt(x, z)}`);
    }
  }
  assert.ok(bankCells > 500, `the far bank rises round the log (${bankCells} half-metre cells)`);
  assert.ok(south.bankHeight(...south.tunnelWorld(7, 0)) > 3, 'the bank\'s face stands over the log\'s end');
  // behind the face the cleft opens the far end onto daylight: its bed at `lift`, its walls standing
  const bed = south.bankHeight(...south.tunnelWorld(9, 0));
  assert.ok(Math.abs(bed - T.cleft.lift) < 0.05, `the cleft's bed behind the log sits at its lift (${bed.toFixed(2)})`);
  for (const c of [4.5, -4.5]) assert.ok(south.bankHeight(...south.tunnelWorld(9, c)) > 3, `the cleft's wall stands ${c} m off the axis`);
}

// 4. the bridge
{
  let minDrop = Infinity;
  for (let a = 0.05; a <= BF.len - 0.05; a += 0.25) {
    const [x, z] = bw(a, 0);
    assert.equal(ground.blocked(x, z), false, `the deck walkable at a ${a.toFixed(2)}`);
    const walk = ground.height(x, z);
    assert.ok(Math.abs(walk - (deckY(a) - 0.006)) < 0.03, `the foot on the planks at a ${a.toFixed(2)}: ${walk.toFixed(3)} vs deck ${deckY(a).toFixed(3)}`);
    if (a > 3 && a < BF.len - 3) minDrop = Math.min(minDrop, walk - live.height(x, z));
    // either side, once past the sills' rims: blocked from just past the walk's edge out beyond the posts
    if (a < 0.35 || a > BF.len - 0.35) continue;
    for (const c of [B.walkHalfWidth + 0.12, B.deckHalfWidth + 0.1, B.postOut, 1.5, 1.95]) {
      for (const side of [-1, 1]) {
        const [px, pz] = bw(a, side * c);
        assert.equal(ground.blocked(px, pz), true, `off the deck blocked at a ${a.toFixed(2)}, c ${(side * c).toFixed(2)}`);
      }
    }
  }
  assert.ok(minDrop > 2, `mid-span the planks ride ${minDrop.toFixed(2)} m over the gorge floor at least`);
  measured.deck = `${BF.len.toFixed(1)} m, ≥ ${minDrop.toFixed(1)} m over the floor mid-span`;
  // the sills' approaches are walkable onto the planks
  for (const a of [-1.0, -0.4, BF.len + 0.4, BF.len + 1.0]) {
    const [x, z] = bw(a, 0);
    assert.equal(ground.blocked(x, z), false, `the approach walkable at a ${a.toFixed(2)}`);
  }
  // the walls: wherever the gorge cuts deeper than a kerb (off the deck), blocked
  let walls = 0;
  for (let z = 30; z <= 46; z += 0.5) {
    for (let x = -14; x <= 22; x += 0.5) {
      if (south.ravineCut(x, z) <= 0.3) continue;
      const { a, c } = south.bridgeLocal(x, z);
      if (a > -0.1 && a < BF.len + 0.1 && Math.abs(c) <= B.walkHalfWidth) continue;
      assert.equal(ground.blocked(x, z), true, `the gorge wall blocked at ${fmt(x, z)}`);
      walls++;
    }
  }
  assert.ok(walls > 800, `blocked the gorge (${walls} cells)`);
}

// 5. the far bank and the log
{
  const far = [...S.farPath.map((p) => [p[0], p[2]]), [T.mouth[0], T.mouth[1]]];
  for (let i = 0; i + 1 < far.length; i++) {
    for (let t = 0; t <= 1; t += 0.1) {
      const x = far[i][0] + (far[i + 1][0] - far[i][0]) * t;
      const z = far[i][1] + (far[i + 1][1] - far[i][1]) * t;
      assert.equal(ground.blocked(x, z), false, `the far path walkable at ${fmt(x, z)}`);
    }
  }
  // into the log: walkable along the floor to the walk's end, blocked past it (the glow closes the tube)
  for (let a = -0.8; a <= T.deadEnd - 0.25; a += 0.1) {
    const [x, z] = south.tunnelWorld(a, 0);
    assert.equal(ground.blocked(x, z), false, `the log's floor walkable at a ${a.toFixed(2)}`);
    if (a > 0.2) assert.ok(Math.abs(ground.height(x, z) - (FLOOR_Y + 0.022)) < 0.01, `on the floor deck at a ${a.toFixed(2)}`);
  }
  for (const a of [T.deadEnd, T.deadEnd + 0.4, T.length - 0.3]) {
    const [x, z] = south.tunnelWorld(a, 0);
    assert.equal(ground.blocked(x, z), true, `the tube's end blocked at a ${a.toFixed(2)}`);
  }
  // the shell's flanks
  for (const a of [1, 3, 5])
    for (const c of [-(T.innerRadius + 0.2), T.innerRadius + 0.2]) {
      const [x, z] = south.tunnelWorld(a, c);
      assert.equal(ground.blocked(x, z), true, `the log's shell blocked at a ${a}, c ${c.toFixed(2)}`);
    }
  // nowhere else on the far bank
  for (const [x, z] of [[-6, 48], [14, 48], [T.mouth[0] + 3.5, T.mouth[1] - 1.5], [T.mouth[0] - 3.5, T.mouth[1] - 1.5], [4, 58], [-20, 50], [26, 50]]) {
    assert.equal(ground.blocked(x, z), true, `the far bank off the path blocked at ${fmt(x, z)}`);
  }
  // the hollow: the terrain stays under the built floor from the rim to the walk's end
  for (let a = 0.2; a <= T.deadEnd; a += 0.1) {
    for (let c = -1.2; c <= 1.2; c += 0.2) {
      const [x, z] = south.tunnelWorld(a, c);
      assert.ok(live.height(x, z) <= FLOOR_Y + 0.03, `the hollow's ground under the floor deck at a ${a.toFixed(1)}, c ${c.toFixed(1)}: ${(live.height(x, z) - FLOOR_Y).toFixed(3)}`);
    }
  }
}

// 6. the legacy streams' filters
{
  for (const p of southPathLine().filter((p) => p[2] > 18)) assert.equal(hf.expansionCull(p[0], p[2]), true, `cull on the south paving at ${fmt(p[0], p[2])}`);
  for (const a of [BF.len * 0.3, BF.len * 0.5, BF.len * 0.7]) assert.equal(hf.expansionCull(...bw(a, 0)), true, `cull in the gorge under the deck at a ${a.toFixed(1)}`);
  for (const a of [-B.postBack, BF.len + B.postBack]) for (const side of [-1, 1]) assert.equal(hf.expansionCull(...bw(a, side * B.postOut)), true, `cull on the post at a ${a.toFixed(2)}`);
  assert.equal(hf.expansionCull(0, 0.5), false, 'Link\'s spawn is kept');
  for (const v of LAYOUT.viewpoints) assert.equal(hf.expansionCull(v.position[0], v.position[2]), false, `viewpoint ${v.id} is kept`);

  assert.equal(hf.southFooting(0, 0.5, 1.5), null, 'outside the south boxes: expansionCull decides');
  assert.equal(hf.southFooting(S.path[2][0], S.path[2][2], 1.5), 'cull', 'a bole on the south paving');
  assert.equal(hf.southFooting(...south.tunnelWorld(-0.6, 0.3), 1.5), 'cull', 'a bole at the log\'s mouth');
  assert.equal(hf.southFooting(...south.tunnelWorld(-1.2, -2.6), 1.5, 0.5), 'cull', 'a bole a trunk\'s reach from the far path');
  // at the gorge's edge: kept while its rim stands on the lip, dropped once the wall cuts away under it
  const lipPoint = (off) => {
    const [x, z] = [-4.4, 39.9 - (5.2 + S.ravine.lip) - off];
    return [x, z];
  };
  assert.equal(hf.southFooting(...lipPoint(-1.2), 1.5, 0.6), 'cull', 'a bole hanging over the north wall');
  let kept = null;
  for (let off = 0; off <= 3; off += 0.1) {
    const r = hf.southFooting(...lipPoint(off), 1.5, 0.6);
    if (r !== 'cull') {
      kept = off;
      break;
    }
  }
  assert.ok(kept !== null && kept < 2.2, `a bole stands at the north lip from ${kept?.toFixed(1)} m back`);
  // on the bank: seated on its live ground at its centre (W12), never steeper than a sampled stem's
  // 0.55, and a 0.6 m bole's rim (0.9 m ring) never below the white-barks' 0.5 m skirt
  const [bx, bz] = south.tunnelWorld(9, 7.5);
  assert.ok(south.bankHeight(bx, bz) > 0.5, 'the bank point is on the rise');
  assert.equal(hf.southFooting(bx, bz, 1.5, 0.9), 'live', 'a bole on the bank stands on the live ground');
  let liveFootings = 0;
  for (let z = 12; z <= 60; z += 0.5) {
    for (let x = -28; x <= 30; x += 0.5) {
      if (hf.southFooting(x, z, 1.5, 0.9) !== 'live') continue;
      liveFootings++;
      assert.ok(live.slope(x, z) <= 0.55, `a live footing's slope at ${fmt(x, z)}: ${live.slope(x, z).toFixed(3)}`);
      for (let i = 0; i < 12; i++) {
        const t = ((i + 0.5) / 12) * Math.PI * 2;
        const fall = live.height(x, z) - live.height(x + Math.cos(t) * 0.6, z + Math.sin(t) * 0.6);
        assert.ok(fall < 0.5, `a 0.6 m bole's rim ${fall.toFixed(3)} m under its seat at ${fmt(x, z)}`);
      }
    }
  }
  assert.ok(liveFootings > 50, `boles stand on the far bank's live ground (${liveFootings} half-metre cells)`);
  // outside the south boxes the round-49 rules alone decide, exactly as `expansionCull` does
  for (let z = -60; z <= 60; z += 1.5) {
    for (let x = -60; x <= 60; x += 1.5) {
      if (z > 10 && inExpansionSouth(x, z)) continue;
      assert.equal(hf.westExpansionCull(x, z), hf.expansionCull(x, z), `westExpansionCull = expansionCull at ${fmt(x, z)}`);
    }
  }
  // somewhere in the boxes both views agree and nothing is built: kept as sampled
  let keeps = 0;
  for (let z = 12; z <= 60; z += 1) {
    for (let x = -28; x <= 30; x += 1) {
      const r = hf.southFooting(x, z, 1.5, 0.8);
      if (r !== 'keep') continue;
      keeps++;
      assert.ok(Math.abs(live.height(x, z) - legacy.height(x, z)) <= 0.02, `a kept bole's ground unchanged at ${fmt(x, z)}`);
    }
  }
  assert.ok(keeps > 100, `trunks are kept where the ground did not move (${keeps} metre cells)`);
}

console.log(`expansionSouth.test.mjs: ok (path ${measured.path}; gorge ${measured.gorge}; deck ${measured.deck})`);
