/**
 * Round 49 (expansion-2): the west tree-house, the fence-topped south bank and the stepping-stone
 * paths to them. Run: node src/world/terrain/expansion2.test.mjs (Node 20+, no browser).
 *
 * Checks, all off the authored heightfield and the character ground:
 *   1. the LIVE and LEGACY terrain views agree everywhere camera C's frustum reaches (east of its
 *      west edge + the clip margin) and everywhere outside the expansion box — the six fixed
 *      frames' ground is untouched and the legacy streams (trees, vegetation, rocks, props) read
 *      the same numbers as before (round 56's south exit, `EXPANSION_SOUTH_BOXES`, is exempt: C
 *      looks down its path by design; expansionSouth.test.mjs holds it);
 *   2. the south bank: a flat top at its height, a face that falls to the plain, the fences' posts
 *      and the `kokiri-south-bank` spot on the top (walkable), the `south-bank` flight climbing the
 *      face from the plain to the lip;
 *   3. the west house: the `west-house` flight's head under the walkway deck's end, the host giant
 *      in `layout.giantTrees`, the bole blocked (live) and not blocked (legacy);
 *   4. the paths: every stepping disc is paved in the live mask and absent from the legacy mask,
 *      walkable, on natural ground (not flattened), and the run between discs never exceeds a
 *      walkable grade.
 *   7. the east lane on the plateau (layout `EXPANSION_EAST`, round 56): its only height change is
 *      under its own discs, its masks change only inside `EAST_BOX`, its discs are paved, walkable
 *      and on natural ground, its trunks are blocked, the cull keeps it inside its box, cameras
 *      A–E never meet its casters (sun shadows included), F sees the houses' feet over the
 *      plateau's lip and the lip's lee on the plain south of the plaza does not.
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
const layout = loadTs(path.join(here, '../layout.ts'));
const { LAYOUT, EXPANSION, EXPANSION_STAIRS, EXPANSION_ROPE_FENCES, EXPANSION_NPC_SPOTS, EXPANSION_BOX, EXPANSION_EAST, EAST_BOX, southBankPoint, expansionSteppingStones, eastSteppingStones } = layout;
const inEastBox = (x, z) => x >= EAST_BOX.x0 && x <= EAST_BOX.x1 && z >= EAST_BOX.z0 && z <= EAST_BOX.z1;
const EAST_DISCS = eastSteppingStones();
/** within `pad` m of an east disc's paved circle (eastDiscMask reaches 1.12 r) */
const nearEastDisc = (x, z, pad) => EAST_DISCS.some((s) => Math.hypot(x - s.x, z - s.z) < s.r * 1.12 + pad);
const { createGround } = loadTs(path.join(here, '../character/ground.ts'));
const { NPC_SOUTH_BANK } = loadTs(path.join(here, '../character/placement.ts'));
const live = hf.createTerrain('live');
const legacy = hf.createTerrain('legacy');
const ground = createGround(live, LAYOUT);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const fmt = (x, z) => `(${x.toFixed(2)}, ${z.toFixed(2)})`;
// round 56: within `pad` m of one of the south exit's boxes (its live ground is its own test's)
const southNear = (x, z, pad = 0) => z > 10 - pad && layout.EXPANSION_SOUTH_BOXES.some((b) => x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad);
// round 57: within `pad` m of the ruins trail's reach (terrain/ruins.ts `trailInfluence`: ≤ 2.9 m
// off its centreline) or of the ruins site's box (their live ground is expansionRuins.test.mjs's)
const RUINS_LINE = layout.ruinsTrailLine();
const ruinsNear = (x, z, pad = 0) => {
  const S = layout.EXPANSION_RUINS_BOXES[1];
  if (x >= S.x0 - pad && x <= S.x1 + pad && z >= S.z0 - pad && z <= S.z1 + pad) return true;
  for (let i = 0; i + 1 < RUINS_LINE.length; i++) {
    const [ax, , az] = RUINS_LINE[i];
    const dx = RUINS_LINE[i + 1][0] - ax;
    const dz = RUINS_LINE[i + 1][2] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < 3.0 + pad) return true;
  }
  return false;
};

// 1. live == legacy where the fixed frames look. Camera C's west edge on the ground is the ray
// x = x0 + dxdz · (z − z0); every live-only feature is zero within `margin` of it (east side
// included), so every 0.2 m LATTICE point within the margin, and every point of the detail zone
// outside the expansion box, must agree to the bit — heights AND masks. (A rendered / sampled
// height interpolates the lattice points up to 0.2 m away, so the sampled raster is held to
// `margin` − 0.35 m; the lattice itself to `margin`.)
{
  const c = EXPANSION.cClip;
  const rayX = (z) => c.x0 + c.dxdz * (z - c.z0);
  let latticeSame = 0;
  let latticeEast = 0;
  for (let gj = -240; gj <= 240; gj++) {
    for (let gi = -240; gi <= 240; gi++) {
      const x = gi * 0.2;
      const z = gj * 0.2;
      if (rayX(z) - x > c.margin || southNear(x, z)) continue;
      // the east lane's discs (section 7) are the one live-only change east of C's edge
      if (hf.eastDiscMask(x, z) > 0) {
        latticeEast++;
        continue;
      }
      const a = live.latticeHeight(0, gi, gj);
      const b = legacy.latticeHeight(0, gi, gj);
      assert.equal(a, b, `lattice point ${fmt(x, z)} (${(rayX(z) - x).toFixed(2)} m west of C's edge) unchanged`);
      latticeSame++;
    }
  }
  assert.ok(latticeSame > 80000, `checked the lattice east of C's edge (${latticeSame})`);
  assert.ok(latticeEast < 0.05 * latticeSame, `the east lane's discs cover a sliver of it (${latticeEast} lattice points)`);
  let same = 0;
  let inside = 0;
  let differs = 0;
  let eastHeld = 0;
  for (let z = -48; z <= 48; z += 0.4) {
    for (let x = -48; x <= 48; x += 0.4) {
      if (southNear(x, z, 0.35) || ruinsNear(x, z, 0.35)) continue;
      const westOfRay = rayX(z) - x;
      const inBox = x >= EXPANSION_BOX.x0 && x <= EXPANSION_BOX.x1 && z >= EXPANSION_BOX.z0 && z <= EXPANSION_BOX.z1;
      const farHut = Math.hypot(x - EXPANSION.farHut.host[0], z - EXPANSION.farHut.host[1]) < EXPANSION.farHutRise.radius + 0.6;
      const east = inEastBox(x, z);
      const pinned = (westOfRay <= c.margin - 0.35 || (!inBox && !farHut)) && !east;
      const hl = live.height(x, z);
      const hg = legacy.height(x, z);
      const ml = hf.surfaceMask(x, z, 'live');
      const mg = hf.surfaceMask(x, z, 'legacy');
      const equal = hl === hg && ml.path === mg.path && ml.stairs === mg.stairs && ml.structure === mg.structure;
      // inside the east box the masks gain the lane (pads, discs, posts); the height changes only
      // on and within a sample's interpolation reach (0.3 m) of a disc
      if (east && !nearEastDisc(x, z, 0.3)) {
        assert.equal(hl, hg, `the east box's ground off the discs is the legacy ground at ${fmt(x, z)}`);
        eastHeld++;
      }
      if (pinned) {
        assert.ok(equal, `live == legacy at ${fmt(x, z)} (west of C's edge by ${westOfRay.toFixed(2)} m, in box ${inBox}): ${hl} vs ${hg}, ${JSON.stringify(ml)} vs ${JSON.stringify(mg)}`);
        same++;
      } else {
        inside++;
        if (!equal) differs++;
      }
    }
  }
  assert.ok(same > 20000, `rastered the pinned ground (${same})`);
  assert.ok(differs > 200, `the expansion changes the ground somewhere inside its box (${differs} of ${inside})`);
  assert.ok(eastHeld > 3000, `held the east box's ground off its discs (${eastHeld})`);
  // and every fixed camera stands on unchanged ground
  for (const v of LAYOUT.viewpoints) assert.equal(live.height(v.position[0], v.position[2]), legacy.height(v.position[0], v.position[2]), `viewpoint ${v.id} ground`);
  // the legacy mask has none of the expansion (the paved plaza, the spine and the houses are unchanged)
  for (const s of expansionSteppingStones()) assert.equal(hf.surfaceMask(s.x, s.z, 'legacy').path, 0, `legacy mask has no disc at ${fmt(s.x, s.z)}`);

  // The detail ring CASTS shadows (terrain/index.ts), and a cast shadow is not clipped by `cClip`:
  // march the sun ray from every ground point of C's frame near its west edge (0.5 m outside …
  // 1.5 m inside, z 6 … 36 — the bank and both flights) off the live and the legacy sampler; the
  // live terrain must shade exactly the points the legacy terrain shades (take-0121's C had 27
  // pixels at ≤ 3 LSB from the bank's SE corner throwing 0.4 m into the frame before the bank
  // was shortened; see layout.ts `southBank`).
  const { sunDirection } = loadTs(path.join(here, '../lighting/sun.ts'));
  const { WORLD } = loadTs(path.join(here, '../config.ts'));
  const sun = sunDirection(WORLD.sun.azimuthDeg, WORLD.sun.elevationDeg);
  const cosEdge = Math.cos(Math.atan(-c.dxdz));
  const shaded = (T, x, z) => {
    const g = T.height(x, z);
    for (let t = 0.1; t < 12; t += 0.05) if (T.height(x + sun.x * t, z + sun.z * t) > g + sun.y * t + 0.01) return true;
    return false;
  };
  let marched = 0;
  const rayMeetsSouth = (x, z) => {
    for (let t = 0; t < 12; t += 0.05) if (southNear(x + sun.x * t, z + sun.z * t, 0.35)) return true;
    return false;
  };
  for (let z = 6; z <= 36; z += 0.25) {
    for (let inside = -0.5; inside <= 1.5; inside += 0.1) {
      const x = rayX(z) + inside / cosEdge;
      if (rayMeetsSouth(x, z)) continue;
      assert.equal(shaded(live, x, z), shaded(legacy, x, z), `the live terrain's self-shadow at ${fmt(x, z)} (${inside.toFixed(1)} m inside C's edge) is the legacy one`);
      marched++;
    }
  }
  assert.ok(marched > 1500, `marched the sun ray along C's edge (${marched})`);
}

// 2. the south bank
{
  const B = EXPANSION.southBank;
  assert.ok(B.height >= 1.6 && B.height <= 2.0, `bank rise 1.6–2 m over the plain (${B.height})`);
  // the flat top: within the ± 14 cm medium breakup over the top region behind the lip
  const uTop = [-0.85, -0.45, 0, 0.45, 0.85].map((f) => +(f * B.halfLength).toFixed(2));
  for (const u of uTop) {
    for (const v of [-0.3, -1.2, -2.2, -3.0]) {
      const [x, z] = southBankPoint(u, v);
      near(live.height(x, z), B.height, 0.16, `bank top flat at u ${u}, v ${v} ${fmt(x, z)}`);
      assert.equal(ground.blocked(x, z), false, `bank top walkable at u ${u}, v ${v}`);
    }
  }
  // the face falls toward the plaza: mid-face is between, the toe is the plain
  for (const u of [-2, 0, 2]) {
    const [mx, mz] = southBankPoint(u, B.face * 0.5);
    const [tx, tz] = southBankPoint(u, B.face + 0.6);
    const mid = live.height(mx, mz);
    const toe = live.height(tx, tz);
    assert.ok(mid < B.height - 0.5 && mid > toe + 0.5, `face mid-slope at u ${u} between top and toe (${toe} < ${mid} < ${B.height})`);
    assert.ok(toe < 0.6, `the toe at u ${u} is the plain (${toe})`);
    assert.ok(B.height - toe >= 1.5, `the bank rises ≥ 1.5 m over the plain at u ${u} (${B.height - toe})`);
  }
  // the toe is untouched ground (the legacy plain) — off the flight's foot bank (u −0.5 … 1.1)
  for (const u of [-0.85 * B.halfLength, 0.85 * B.halfLength]) {
    const [tx, tz] = southBankPoint(u, B.face + 1.0);
    near(live.height(tx, tz), legacy.height(tx, tz), 0.03, `the plain beyond the toe at u ${u} is the legacy ground`);
  }
  // the fences' posts stand on the top, 0.15 m behind the lip
  for (const f of EXPANSION_ROPE_FENCES) {
    assert.equal(f.style, 'rope', `${f.id} is a rope fence`);
    assert.ok(f.points.length >= 2, `${f.id} has ≥ 2 posts`);
    for (const p of f.points) {
      near(live.height(p[0], p[2]), B.height, 0.16, `${f.id} post at ${fmt(p[0], p[2])} on the top`);
      const { v } = hf.southTerraceLocal(p[0], p[2]);
      near(v, -0.15, 0.01, `${f.id} post 0.15 m behind the lip`);
    }
  }
  // the Kokiri spot: on the top, walkable, exported for the npc lane
  const spot = EXPANSION_NPC_SPOTS.find((s) => s.id === 'kokiri-south-bank');
  assert.ok(spot, 'kokiri-south-bank spot');
  near(live.height(spot.position[0], spot.position[2]), B.height, 0.16, 'kokiri-south-bank on the bank top');
  near(spot.position[1], B.height, 1e-9, 'the spot is authored at the bank height');
  assert.equal(ground.blocked(spot.position[0], spot.position[2]), false, 'kokiri-south-bank walkable');
  assert.equal(NPC_SOUTH_BANK.id, 'kokiri-south-bank');
  near(NPC_SOUTH_BANK.x, spot.position[0], 1e-9, 'placement.ts reads the layout spot (x)');
  near(NPC_SOUTH_BANK.z, spot.position[2], 1e-9, 'placement.ts reads the layout spot (z)');
  // the spot is clear of the flight's landing rows and the fence posts
  const flight = EXPANSION_STAIRS.find((s) => s.id === 'south-bank');
  for (const f of EXPANSION_ROPE_FENCES) for (const p of f.points) assert.ok(Math.hypot(p[0] - spot.position[0], p[2] - spot.position[2]) > 0.6, 'spot clear of a post');
  // the bank's centre is 14–26 m from the plaza centre, south (z > 0) of it, and its face looks at the plaza
  const dist = Math.hypot(B.x, B.z);
  assert.ok(dist >= 14 && dist <= 26, `bank ${dist.toFixed(1)} m from the plaza centre`);
  assert.ok(B.z > 10, 'the bank is south of the plaza');
  {
    const { face } = layout.southBankFrameVectors();
    const toPlaza = [-B.x, -B.z];
    const l = Math.hypot(toPlaza[0], toPlaza[1]);
    const dot = (face[0] * toPlaza[0] + face[1] * toPlaza[1]) / l;
    assert.ok(dot > 0.9, `the face looks at the plaza centre (cos ${dot.toFixed(3)})`);
  }

  // 2b. the south-bank flight: from the plain to the lip
  assert.ok(flight, 'south-bank flight');
  const l = Math.hypot(flight.dir[0], flight.dir[1]);
  const dx = flight.dir[0] / l;
  const dz = flight.dir[1] / l;
  for (let i = 0; i < flight.steps; i++) {
    const u = (i + 0.5) * flight.tread;
    const x = flight.base[0] + dx * u;
    const z = flight.base[2] + dz * u;
    assert.equal(ground.onStairs(x, z), true, `south-bank tread ${i} on stairs`);
    near(ground.height(x, z), flight.base[1] + (i + 1) * flight.rise, 1e-6, `south-bank tread ${i} height`);
    assert.ok(live.height(x, z) <= flight.base[1] + (i + 1) * flight.rise + 1e-6, `terrain under south-bank tread ${i} (${live.height(x, z)})`);
    assert.ok(hf.surfaceMask(x, z, 'live').stairs > 0.5, `live mask paints south-bank tread ${i}`);
  }
  const top = flight.base[1] + flight.steps * flight.rise;
  near(top, B.height, 0.02, 'the flight tops out at the bank height');
  const topU = flight.steps * flight.tread + 0.5;
  near(ground.height(flight.base[0] + dx * topU, flight.base[2] + dz * topU), top, 1e-6, 'the landing at the bank height');
  near(live.height(flight.base[0] + dx * topU, flight.base[2] + dz * topU), B.height, 0.16, 'the terrain at the landing is the top');
  // the foot stands on the plain, off the stairs
  const fx = flight.base[0] - dx * 0.4;
  const fz = flight.base[2] - dz * 0.4;
  assert.equal(ground.onStairs(fx, fz), false, 'foot off the stairs');
  near(live.height(fx, fz), flight.base[1], 0.1, 'foot on the plain');
  // the path's last node lands at the foot
  const ps = EXPANSION.pathSouth;
  const last = ps[ps.length - 1];
  assert.ok(Math.hypot(last[0] - flight.base[0], last[2] - flight.base[2]) < 1.2, 'pathSouth ends at the flight\'s foot');
}

// 3. the west house
{
  const W = EXPANSION.westHouse;
  const giant = LAYOUT.giantTrees.find((g) => Math.hypot(g.position[0] - W.host[0], g.position[2] - W.host[1]) < 0.5);
  assert.ok(giant, 'the host giant is in layout.giantTrees');
  const dist = Math.hypot(W.host[0], W.host[1]);
  assert.ok(dist >= 18 && dist <= 26, `west house ${dist.toFixed(1)} m from the plaza centre`);
  assert.ok(W.host[0] < -15, 'the west house is west of the plaza');
  // the bole is blocked in the live ground and free of the legacy mask (no legacy stream sees it)
  assert.equal(ground.blocked(W.host[0], W.host[1]), true, 'the bole is blocked');
  assert.equal(hf.surfaceMask(W.host[0], W.host[1], 'live').structure > 0.5, true, 'live structure under the bole');
  // (the legacy mask has the giant only if the layout always had it — either way it must equal take-0121's)
  // the flight: the west path ends at its foot; its head is where the deck ends
  const flight = EXPANSION_STAIRS.find((s) => s.id === 'west-house');
  assert.ok(flight, 'west-house flight');
  const l = Math.hypot(flight.dir[0], flight.dir[1]);
  const dx = flight.dir[0] / l;
  const dz = flight.dir[1] / l;
  const pw = EXPANSION.pathWest;
  const last = pw[pw.length - 1];
  assert.ok(Math.hypot(last[0] - flight.base[0], last[2] - flight.base[2]) < 1.2, 'pathWest ends at the flight\'s foot');
  for (let i = 0; i < flight.steps; i++) {
    const u = (i + 0.5) * flight.tread;
    const x = flight.base[0] + dx * u;
    const z = flight.base[2] + dz * u;
    assert.equal(ground.onStairs(x, z), true, `west-house tread ${i} on stairs`);
    near(ground.height(x, z), flight.base[1] + (i + 1) * flight.rise, 1e-6, `west-house tread ${i} height`);
    assert.ok(live.height(x, z) <= flight.base[1] + (i + 1) * flight.rise + 1e-6, `terrain under west-house tread ${i}`);
  }
  const headU = flight.steps * flight.tread;
  const head = [flight.base[0] + dx * headU, flight.base[1] + flight.steps * flight.rise, flight.base[2] + dz * headU];
  near(Math.hypot(head[0] - W.deckEnd[0], head[2] - W.deckEnd[2]), 0, 0.6, 'the deck ends over the flight\'s head');
  near(head[1], W.deckEnd[1], 0.15, 'the deck end is at the landing height');
  assert.ok(W.floorY > W.deckEnd[1], 'the floor is above the deck end (the deck climbs to the door)');
  near(live.height(flight.base[0] - dx * 0.4, flight.base[2] - dz * 0.4), flight.base[1], 0.12, 'west-house foot on the ground');
}

// 4. the paths: stepping discs on natural ground
{
  const discs = expansionSteppingStones();
  assert.ok(discs.length >= 12, `≥ 12 stepping discs (${discs.length})`);
  // the discs climbing the ledge's face off the plaza rim lie in camera C's clip band (1.3–2.2 m
  // west of its edge): the paving lays them (hardscape emits every disc), but their splat mask
  // is faded — no more than twelve (six on the climb, six on the south branch), and every disc's
  // centre ≥ 1.0 m west of the edge (its rim ≥ 0.55 m: 2° outside C's frame at 13 m)
  const c = EXPANSION.cClip;
  let clipped = 0;
  for (const s of discs) {
    const westOfRay = c.x0 + c.dxdz * (s.z - c.z0) - s.x;
    assert.ok(westOfRay >= 1.0, `disc at ${fmt(s.x, s.z)} is ≥ 1.0 m west of C's edge (${westOfRay.toFixed(2)})`);
    if (westOfRay < c.margin + c.fade) {
      clipped++;
      continue;
    }
    assert.ok(hf.surfaceMask(s.x, s.z, 'live').path > 0.5, `live mask paves the disc at ${fmt(s.x, s.z)}`);
    assert.ok(hf.expansionDiscMask(s.x, s.z) > 0.5, `disc mask at ${fmt(s.x, s.z)}`);
    assert.equal(ground.blocked(s.x, s.z), false, `disc walkable at ${fmt(s.x, s.z)}`);
    // set stones: the ground under the disc is the natural (legacy) grade, not a flattened pad —
    // the only change is the detail passes fading under the paved surface (≤ 14 cm breakup)
    near(live.height(s.x, s.z), legacy.height(s.x, s.z), 0.15, `natural ground under the disc at ${fmt(s.x, s.z)}`);
    // the character ground lifts the foot onto the slab (PATH_LIFT) — never below the terrain
    assert.ok(ground.height(s.x, s.z) >= live.height(s.x, s.z), 'the foot stands on or over the terrain');
  }
  assert.ok(clipped <= 12, `at most twelve discs in C's clip band (${clipped})`);
  // the lines' grade: never steeper than 0.5 (≈ 27°, a stepping-stone climb like the reference's
  // stones up to Saria's yard) between consecutive nodes on the ledge-face climb and the south
  // branch's two drops off the shoulder; ≤ 0.25 along the shoulder and the plain. (The climb's
  // natural ground is 0.47 at its steepest pair now that `cClip` fades the discs' detail
  // suppression 0.4 m further out.)
  for (const line of [EXPANSION.pathWest, EXPANSION.pathSouth]) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const run = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const rise = Math.abs(live.height(b[0], b[2]) - live.height(a[0], a[2]));
      const limit = (line === EXPANSION.pathWest && i < 4) || (line === EXPANSION.pathSouth && i < 2) ? 0.5 : 0.25;
      assert.ok(rise / run <= limit, `path grade ${(rise / run).toFixed(2)} between ${fmt(a[0], a[2])} and ${fmt(b[0], b[2])} (limit ${limit})`);
      assert.equal(ground.blocked(a[0], a[2]), false, `path node ${fmt(a[0], a[2])} walkable`);
    }
  }
  // the west line begins off the plaza's paved rim: the legacy paving's 0.5 iso lies within 2.6 m
  // of its first node toward the centre (the first disc stands ≈ 2.4 m of turf outside the paving —
  // camera C's edge passes between them and the discs keep ≥ 1.0 m west of it)
  const p0 = EXPANSION.pathWest[0];
  let rimPaved = false;
  for (let r = 0; r <= 2.6; r += 0.2) if (hf.surfaceMask(p0[0] * (1 - r / Math.hypot(p0[0], p0[2])), p0[2] * (1 - r / Math.hypot(p0[0], p0[2])), 'legacy').path > 0.5) rimPaved = true;
  assert.ok(rimPaved, 'pathWest starts within 2.6 m of the plaza rim');
  // the south fork begins on the west line
  const fork = EXPANSION.pathSouth[0];
  assert.ok(EXPANSION.pathWest.some((p) => p[0] === fork[0] && p[2] === fork[2]), 'pathSouth forks off a pathWest node');
}

// 5. the far hut: 45–60 m out on the south-west plain, on its live-only knoll, its host clear of
//    every layout giant, and its lamp in sight of Link's spot over the live terrain
{
  const F = EXPANSION.farHut;
  const R = EXPANSION.farHutRise;
  const dist = Math.hypot(F.host[0], F.host[1] - 2);
  assert.ok(dist >= 45 && dist <= 60, `far hut ${dist.toFixed(1)} m from the plaza centre`);
  assert.ok(F.host[0] < 0 && F.host[1] > 0, 'south-west of the plaza');
  const h = live.height(F.host[0], F.host[1]);
  const hg = legacy.height(F.host[0], F.host[1]);
  near(h - hg, R.height, 0.05, `the knoll raises the column's foot by ${R.height} m (live ${h.toFixed(2)}, legacy ${hg.toFixed(2)})`);
  assert.ok(h > 1.0, `on a rise (${h.toFixed(2)} m)`);
  // the knoll is round and gone at its radius
  for (const a of [0, 1, 2, 3, 4, 5]) {
    const x = F.host[0] + Math.cos(a) * (R.radius + 0.3);
    const z = F.host[1] + Math.sin(a) * (R.radius + 0.3);
    assert.equal(live.height(x, z), legacy.height(x, z), `the plain beyond the knoll (${a}) is the legacy ground`);
  }
  for (const g of LAYOUT.giantTrees) assert.ok(Math.hypot(g.position[0] - F.host[0], g.position[2] - F.host[1]) > 8, `clear of ${g.id}`);
  assert.ok(hf.surfaceMask(F.host[0], F.host[1], 'live').structure > 0.5, 'live structure under the column');
  // the window lamp (structures/distantHouse.ts: on the wall at `facingDeg`, 1.3 m over the floor)
  // is in sight of Link's spot: the ray from (0, 1.5, 2) clears the live ground by ≥ 1.2 m the
  // whole way (the west ledge's shoulder and the bank's lip are the high points on the line)
  const facing = (F.facingDeg * Math.PI) / 180;
  const lamp = [F.host[0] + Math.sin(facing) * (F.radius + 0.3), h + F.floor + 1.3, F.host[1] + Math.cos(facing) * (F.radius + 0.3)];
  const toPlaza = Math.atan2(0 - F.host[0], 2 - F.host[1]);
  near(facing, toPlaza, 0.06, 'the window faces the plaza centre');
  let minClear = Infinity;
  let at = '';
  for (let s = 0.03; s < 0.97; s += 0.002) {
    const x = lamp[0] * s;
    const z = 2 + (lamp[2] - 2) * s;
    const y = 1.5 + (lamp[1] - 1.5) * s;
    const clear = y - live.height(x, z);
    if (clear < minClear) {
      minClear = clear;
      at = fmt(x, z);
    }
  }
  assert.ok(minClear >= 1.2, `the lamp's sight line from Link's spot clears the live ground by ${minClear.toFixed(2)} m (min at ${at})`);
  // and its column is outside camera C's frame (the same test the fixed frames make of the near content)
  const C = LAYOUT.viewpoints.find((v) => v.id === 'C_lookback');
  const bearingFromC = (Math.atan2(F.host[0] - C.position[0], F.host[1] - C.position[2]) * 180) / Math.PI;
  assert.ok(bearingFromC < -33, `the far hut is ${(-29.52 - bearingFromC).toFixed(1)}° outside camera C's west edge (bearing ${bearingFromC.toFixed(1)}°)`);
}

// 5b. `expansionCull` — the filter the legacy-built streams (vegetation, rocks, props, trees) apply
//     after placement: true on every disc, on the bank's top and face, on the knoll and the column,
//     false everywhere the ground is the legacy ground (the whole detail zone outside the box, every
//     fixed viewpoint, the plain past the bank's toe)
{
  for (const s of expansionSteppingStones()) assert.equal(hf.expansionCull(s.x, s.z), true, `cull on the disc at ${fmt(s.x, s.z)}`);
  const B = EXPANSION.southBank;
  for (const [u, v] of [[0, -1], [-1.5, -2], [1.5, -0.5], [0, 1.3], [-1, 1.8]]) {
    const [x, z] = southBankPoint(u, v);
    assert.equal(hf.expansionCull(x, z), true, `cull on the bank at u ${u}, v ${v}`);
  }
  const F = EXPANSION.farHut;
  assert.equal(hf.expansionCull(F.host[0], F.host[1]), true, 'cull on the column');
  assert.equal(hf.expansionCull(F.host[0] + 4, F.host[1] + 2), true, 'cull on the knoll');
  assert.equal(hf.expansionCull(F.host[0] + EXPANSION.farHutRise.radius + 1, F.host[1]), false, 'the plain past the knoll is kept');
  for (const v of LAYOUT.viewpoints) assert.equal(hf.expansionCull(v.position[0], v.position[2]), false, `viewpoint ${v.id} is kept`);
  let kept = 0;
  let culled = 0;
  for (let z = -48; z <= 48; z += 1.0) {
    for (let x = -48; x <= 48; x += 1.0) {
      if (southNear(x, z) || ruinsNear(x, z)) continue;
      // the west expansion's own cull (the east lane and the ruins off: what a rejection loop sees, section 7)
      const c = hf.expansionCull(x, z, 0.3, false);
      if (c) culled++;
      else kept++;
      const inBox = x >= EXPANSION_BOX.x0 && x <= EXPANSION_BOX.x1 && z >= EXPANSION_BOX.z0 && z <= EXPANSION_BOX.z1;
      const onKnoll = Math.hypot(x - F.host[0], z - F.host[1]) < EXPANSION.farHutRise.radius + 0.5;
      if (!inBox && !onKnoll) assert.equal(c, false, `nothing culled outside the box at ${fmt(x, z)}`);
      // with the east lane on, only its box adds culls
      if (!inEastBox(x, z)) assert.equal(hf.expansionCull(x, z), c, `the east lane culls nothing outside its box at ${fmt(x, z)}`);
    }
  }
  assert.ok(culled > 60 && culled < 900, `the cull clears the expansion's own ground only (${culled} of ${kept + culled} metre cells)`);
  assert.ok(B.height > 0, 'bank authored');
  // the box's north-east corner holds the plaza disc's south-west rim: its own paving (legacy path
  // mask 0.97 at take-0121's flagstone (−4.61, 2.45)) is not the expansion's and must not cull
  for (const [x, z] of [[-4.611, 2.452], [-4.0, 3.2], [-5.2, 2.0]]) {
    const l = hf.surfaceMask(x, z, 'legacy');
    if (l.path > 0.5) assert.equal(hf.expansionCull(x, z), false, `the plaza's own paving at ${fmt(x, z)} is kept`);
  }
  // the host giant's bole IS culled (structure mask, live) — the trees lane applies the filter to
  // its sampled white-barks, not to the layout giants
  assert.equal(hf.expansionCull(EXPANSION.westHouse.host[0], EXPANSION.westHouse.host[1]), true, 'the west house bole is culled');
}

// 6. the visibility casters (util/expansionLocality.ts — what structures and hardscape toggle
//    their expansion groups by): neither the near content's spheres nor the far hut's, sun-shadow
//    footprints included, meet any fixed camera's frustum (else the group rides into that frame's
//    shadow pass: draws and triangles change even though nothing of it is in frame), and all of
//    them do meet the plaza-centre W / SW pans (the acceptance poses)
{
  const L = loadTs(path.join(here, '../util/expansionLocality.ts'));
  const { WORLD } = loadTs(path.join(here, '../config.ts'));
  const sun = L.sunVector(WORLD.sun.azimuthDeg, WORLD.sun.elevationDeg);
  const nearSpheres = L.expansionCasters().flatMap((c) => L.casterSpheres(c, sun));
  const F = EXPANSION.farHut;
  const footY = live.height(F.host[0], F.host[1]);
  const farSpheres = L.farHutCasters(footY, footY + EXPANSION.farHutTrunk.height).flatMap((c) => L.casterSpheres(c, sun));
  const cam = (fov, p, t) => {
    const c = new THREE.PerspectiveCamera(fov, 1280 / 720, 0.1, 400);
    c.position.set(...p);
    c.lookAt(...t);
    c.updateMatrixWorld(true);
    c.updateProjectionMatrix();
    return c;
  };
  for (const v of LAYOUT.viewpoints) {
    const c = cam(v.fov, v.position, v.target);
    assert.equal(L.frustumMeets(c, nearSpheres), false, `${v.id}: the near content (and its shadow) is outside the frustum`);
    assert.equal(L.frustumMeets(c, farSpheres), false, `${v.id}: the far hut (and its shadow) is outside the frustum`);
  }
  for (const [name, t] of [['W', [-10, 1.5, 2]], ['SW', [-7.07, 1.5, 9.07]]]) {
    const c = cam(55, [0, 1.5, 2], t);
    assert.equal(L.expansionVisible(c, nearSpheres), true, `plaza pan ${name} shows the near content`);
    assert.equal(L.frustumMeets(c, farSpheres), true, `plaza pan ${name} shows the far hut`);
  }
}

// 7. the east lane (round 56): the plateau past the main stairway's head — set stones on natural
//    ground, walkable between the houses, the trunks / bench / posts / deck railings solid, the cull
//    off outside its box and off for rejection loops, and nothing of it in cameras A–E
{
  assert.ok(EAST_DISCS.length >= 20, `≥ 20 east discs (${EAST_DISCS.length})`);
  let lowest = Infinity;
  for (const s of EAST_DISCS) {
    assert.ok(inEastBox(s.x, s.z), `east disc ${fmt(s.x, s.z)} inside EAST_BOX`);
    assert.ok(hf.surfaceMask(s.x, s.z, 'live').path > 0.5, `live mask paves the east disc at ${fmt(s.x, s.z)}`);
    assert.ok(hf.eastDiscMask(s.x, s.z) > 0.5, `east disc mask at ${fmt(s.x, s.z)}`);
    assert.equal(ground.blocked(s.x, s.z), false, `east disc walkable at ${fmt(s.x, s.z)}`);
    near(live.height(s.x, s.z), legacy.height(s.x, s.z), 0.15, `natural ground under the east disc at ${fmt(s.x, s.z)}`);
    assert.ok(ground.height(s.x, s.z) >= live.height(s.x, s.z), 'the foot stands on or over the terrain');
    assert.equal(hf.expansionCull(s.x, s.z), true, `cull on the east disc at ${fmt(s.x, s.z)}`);
    assert.equal(hf.expansionCull(s.x, s.z, 0.3, false), false, `no cull on the east disc at ${fmt(s.x, s.z)} with the lane off`);
    lowest = Math.min(lowest, live.height(s.x, s.z));
  }
  assert.ok(lowest > 4.4, `every east disc is up on the plateau, the stairway's head included (lowest ${lowest.toFixed(2)} m)`);
  // the lane and its spurs: a walkable grade (≤ 0.25) between nodes and nothing solid on the way;
  // the upper spur's last two runs climb the half-metre bank onto the upper house's yard (≤ 0.5,
  // pathWest's ledge-climb limit)
  for (const line of [EXPANSION_EAST.lane, ...EXPANSION_EAST.spurs]) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const run = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const rise = Math.abs(live.height(b[0], b[2]) - live.height(a[0], a[2]));
      const limit = line === EXPANSION_EAST.spurs[0] && i >= line.length - 3 ? 0.5 : 0.25;
      assert.ok(rise / run <= limit, `east path grade ${(rise / run).toFixed(2)} between ${fmt(a[0], a[2])} and ${fmt(b[0], b[2])} (limit ${limit})`);
      const end = line[line.length - 1];
      for (let u = 0; u <= 1; u += 0.1) {
        const x = a[0] + (b[0] - a[0]) * u;
        const z = a[2] + (b[2] - a[2]) * u;
        assert.equal(ground.blocked(x, z), false, `east path walkable at ${fmt(x, z)}`);
        // half a metre clear either side (the character's root is a point with no slide, and the play
        // test's eight-way keys wander ± 0.3 m off the line), except the last metre of a spur, which
        // stops at a door's pad
        if (line !== EXPANSION_EAST.lane && Math.hypot(x - end[0], z - end[2]) < 1.0) continue;
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * Math.PI * 2;
          assert.equal(ground.blocked(x + Math.cos(t) * 0.5, z + Math.sin(t) * 0.5), false, `east path 0.5 m clear round ${fmt(x, z)}`);
        }
      }
    }
  }
  // the trunks are solid round their flare; the door's front step (the spur's end) is open
  for (const h of EXPANSION_EAST.houses) {
    assert.ok(inEastBox(h.x, h.z), `${h.id} inside EAST_BOX`);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const x = h.x + Math.cos(a) * h.radius * 1.1;
      const z = h.z + Math.sin(a) * h.radius * 1.1;
      assert.equal(ground.blocked(x, z), true, `${h.id}'s trunk is solid at ${fmt(x, z)}`);
    }
    const f = (h.facingDeg * Math.PI) / 180;
    // (a house with a doorstep stops the character at its edge instead: the small house's arch)
    const step = h.doorstep ? h.doorstep[0] + h.doorstep[1] + 0.1 : h.radius * 1.2 + 0.7;
    const dx = h.x + Math.sin(f) * step;
    const dz = h.z + Math.cos(f) * step;
    assert.equal(ground.blocked(dx, dz), false, `${h.id}'s door step is open at ${fmt(dx, dz)}`);
    assert.equal(hf.expansionCull(h.x, h.z), true, `${h.id}'s pad culls the legacy streams`);
  }
  // the entrance arches' root-buttress feet and the small house's doorstep are walls (live only),
  // clear of the lane, the spurs and the deck's plank steps: no root stands in or hangs over a path
  const blocks = layout.eastHouseBlocks();
  assert.equal(blocks.filter((b) => b.kind !== 'doorstep').length, 2 * EXPANSION_EAST.houses.length, 'two buttress feet per east house');
  const segDist = (x, z, a, b) => {
    const ex = b[0] - a[0];
    const ez = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / (ex * ex + ez * ez)));
    return Math.hypot(x - (a[0] + ex * t), z - (a[2] + ez * t));
  };
  const deckSteps = layout.eastDeckPlan().steps;
  for (const b of blocks) {
    assert.equal(ground.blocked(b.x, b.z), true, `${b.id} ${b.kind} is solid at ${fmt(b.x, b.z)}`);
    assert.equal(hf.surfaceMask(b.x, b.z, 'legacy').structure, 0, `legacy mask has no ${b.id} ${b.kind} at ${fmt(b.x, b.z)}`);
    if (b.kind === 'doorstep') continue;
    for (const line of [EXPANSION_EAST.lane, ...EXPANSION_EAST.spurs]) {
      for (let i = 0; i + 1 < line.length; i++) {
        const d = segDist(b.x, b.z, line[i], line[i + 1]);
        assert.ok(d >= b.r + 0.45, `${b.id} ${b.kind} ${d.toFixed(2)} m off the path ${fmt(line[i][0], line[i][2])} → ${fmt(line[i + 1][0], line[i + 1][2])} (≥ ${(b.r + 0.45).toFixed(2)})`);
      }
    }
    const sd = segDist(b.x, b.z, [deckSteps.bottom[0], 0, deckSteps.bottom[1]], [deckSteps.top[0], 0, deckSteps.top[1]]) - deckSteps.hw;
    assert.ok(sd >= b.r, `${b.id} ${b.kind} ${sd.toFixed(2)} m off the deck steps' edge (≥ ${b.r.toFixed(2)})`);
  }
  // the lookout's bench, the sign post and the pod posts are solid
  const B = EXPANSION_EAST.lookout.bench;
  assert.equal(ground.blocked(B.x, B.z), true, 'the lookout bench is solid');
  assert.equal(ground.blocked(EXPANSION_EAST.shopSign.x, EXPANSION_EAST.shopSign.z), true, "the shop's sign post is solid");
  for (const p of EXPANSION_EAST.lanternPosts) assert.equal(ground.blocked(p.x, p.z), true, `${p.id} is solid`);
  // the lookout's rope fence stops a step short of its rope (character ground only: no structure
  // pad, the grass under the rope stays); half a metre in, on the bench's side, is open ground
  // wherever the bench itself does not stand
  {
    const LF = EXPANSION_EAST.lookout.fence;
    const by = (B.yawDeg * Math.PI) / 180;
    const inBench = (x, z) => {
      const dx = x - B.x;
      const dz = z - B.z;
      return Math.abs(dx * Math.cos(by) - dz * Math.sin(by)) < B.length * 0.5 + 0.25 && Math.abs(dx * Math.sin(by) + dz * Math.cos(by)) < 0.55;
    };
    const anchors = EXPANSION_EAST.lookout.anchors;
    const inAnchor = (x, z) => anchors.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + 0.3);
    let open = 0;
    for (let i = 0; i + 1 < LF.length; i++) {
      const [ax, , az] = LF[i];
      const [bx, , bz] = LF[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      let nx = (bz - az) / l;
      let nz = -(bx - ax) / l;
      if ((B.x - ax) * nx + (B.z - az) * nz < 0) (nx = -nx), (nz = -nz);
      for (let u = 0; u <= 1.0001; u += 0.1) {
        const x = ax + (bx - ax) * u;
        const z = az + (bz - az) * u;
        assert.equal(ground.blocked(x, z), true, `the lookout fence is a wall at ${fmt(x, z)}`);
        assert.equal(ground.blocked(x + nx * 0.2, z + nz * 0.2), true, `the lookout fence stops a step 0.2 m short at ${fmt(x, z)}`);
        assert.equal(hf.surfaceMask(x, z, 'live').structure, 0, `the lookout fence is no structure pad at ${fmt(x, z)}`);
        const [ox, oz] = [x + nx * 0.5, z + nz * 0.5];
        if (inBench(ox, oz) || inAnchor(ox, oz)) continue;
        assert.equal(ground.blocked(ox, oz), false, `half a metre in from the lookout fence is open at ${fmt(ox, oz)}`);
        open++;
      }
    }
    assert.ok(open >= 30, `the lookout fence's inner side is open ground along most of it (${open} samples)`);
    // the ropes' ends wrap round three stumps: each is solid a step round its foot (and a wall in the
    // live mask, so no grass grows through it), and every run end but the west run's last (on the
    // small house's pad) stands inside a stump's ring, so ropes and stumps are one barrier with no
    // gap at any end
    const WR = EXPANSION_EAST.lookout.westRun;
    const ER = EXPANSION_EAST.lookout.eastRun;
    const small = EXPANSION_EAST.houses.find((h) => h.kind === 'small');
    assert.equal(anchors.length, 3, 'three stumps anchor the ropes');
    const stumpEnds = [LF[0], LF[LF.length - 1], WR[0], ER[0], ER[ER.length - 1]];
    for (const post of stumpEnds) assert.ok(anchors.some((a) => Math.hypot(post[0] - a.x, post[2] - a.z) < a.r + 0.25 - 0.1), `run end ${fmt(post[0], post[2])} stands inside a stump's ring`);
    for (const a of anchors) {
      for (let j = 0; j < 16; j++) {
        const t = (j / 16) * Math.PI * 2;
        assert.equal(ground.blocked(a.x + Math.cos(t) * (a.r + 0.2), a.z + Math.sin(t) * (a.r + 0.2)), true, `the stump at ${fmt(a.x, a.z)} is solid ${(a.r + 0.2).toFixed(2)} m round`);
        assert.equal(hf.surfaceMask(a.x + Math.cos(t) * (a.r - 0.05), a.z + Math.sin(t) * (a.r - 0.05), 'live').structure, 1, `the stump at ${fmt(a.x, a.z)} is a wall in the live mask`);
      }
      const mine = stumpEnds.filter((p) => Math.hypot(p[0] - a.x, p[2] - a.z) < a.r + 0.25 - 0.1);
      assert.ok(mine.length > 0, `the stump at ${fmt(a.x, a.z)} anchors a run end`);
      for (const post of mine) {
        for (let u = 0; u <= 1.0001; u += 0.05) {
          const x = post[0] + (a.x - post[0]) * u;
          const z = post[2] + (a.z - post[2]) * u;
          assert.equal(ground.blocked(x, z), true, `no gap between end post and stump at ${fmt(x, z)}`);
        }
      }
      assert.equal(hf.surfaceMask(a.x, a.z, 'legacy').structure, 0, `the legacy mask has no stump at ${fmt(a.x, a.z)}`);
    }
    // the east run turns the rope inland from the east stump to the third: a wall along its line
    // with the step short of it on the bench's side and open ground half a metre in
    {
      let openE = 0;
      for (let i = 0; i + 1 < ER.length; i++) {
        const [ax, , az] = ER[i];
        const [bx, , bz] = ER[i + 1];
        const l = Math.hypot(bx - ax, bz - az);
        let nx = (bz - az) / l;
        let nz = -(bx - ax) / l;
        if ((B.x - ax) * nx + (B.z - az) * nz < 0) (nx = -nx), (nz = -nz);
        for (let u = 0; u <= 1.0001; u += 0.1) {
          const x = ax + (bx - ax) * u;
          const z = az + (bz - az) * u;
          assert.equal(ground.blocked(x, z), true, `the east run is a wall at ${fmt(x, z)}`);
          assert.equal(ground.blocked(x + nx * 0.2, z + nz * 0.2), true, `the east run stops a step 0.2 m short at ${fmt(x, z)}`);
          if (!inAnchor(x, z)) assert.equal(hf.surfaceMask(x, z, 'live').structure, 0, `the east run is no structure pad at ${fmt(x, z)}`);
          const [ox, oz] = [x + nx * 0.5, z + nz * 0.5];
          if (inAnchor(ox, oz) || inBench(ox, oz)) continue;
          assert.equal(ground.blocked(ox, oz), false, `half a metre in from the east run is open at ${fmt(ox, oz)}`);
          openE++;
        }
      }
      assert.ok(openE >= 5, `the east run's inner side is open ground between its stumps (${openE} samples)`);
    }
    // the west run carries the rope on from the west stump to the small house's back roots: a wall
    // along its line with the same step short of it on the lane's side, open half a metre in (off
    // the house's pad), its first post inside the west stump's ring and its last on the house's pad,
    // and no gap at either end
    {
      const west = anchors[0].x < anchors[1].x ? anchors[0] : anchors[1];
      let openW = 0;
      for (let i = 0; i + 1 < WR.length; i++) {
        const [ax, , az] = WR[i];
        const [bx, , bz] = WR[i + 1];
        const l = Math.hypot(bx - ax, bz - az);
        let nx = (bz - az) / l;
        let nz = -(bx - ax) / l;
        if ((B.x - ax) * nx + (B.z - az) * nz < 0) (nx = -nx), (nz = -nz);
        for (let u = 0; u <= 1.0001; u += 0.1) {
          const x = ax + (bx - ax) * u;
          const z = az + (bz - az) * u;
          assert.equal(ground.blocked(x, z), true, `the west run is a wall at ${fmt(x, z)}`);
          assert.equal(ground.blocked(x + nx * 0.2, z + nz * 0.2), true, `the west run stops a step 0.2 m short at ${fmt(x, z)}`);
          if (Math.hypot(x - small.x, z - small.z) > small.radius * 1.2 + 1.0 && !inAnchor(x, z)) assert.equal(hf.surfaceMask(x, z, 'live').structure, 0, `the west run is no structure pad at ${fmt(x, z)}`);
          const [ox, oz] = [x + nx * 0.5, z + nz * 0.5];
          if (inAnchor(ox, oz) || hf.surfaceMask(ox, oz, 'live').structure > 0.5) continue;
          assert.equal(ground.blocked(ox, oz), false, `half a metre in from the west run is open at ${fmt(ox, oz)}`);
          openW++;
        }
      }
      assert.ok(openW >= 30, `the west run's inner side is open ground along most of it (${openW} samples)`);
      const first = WR[0];
      const d0 = Math.hypot(first[0] - west.x, first[2] - west.z);
      assert.ok(d0 < west.r + 0.25 - 0.1, `the west run's first post stands ${d0.toFixed(2)} m from the west stump, inside its ${(west.r + 0.25).toFixed(2)} m ring`);
      const last = WR[WR.length - 1];
      assert.ok(hf.surfaceMask(last[0], last[2], 'live').structure > 0.5, `the west run's last post ${fmt(last[0], last[2])} stands on the small house's pad`);
      for (let u = 0; u <= 1.0001; u += 0.05) {
        assert.equal(ground.blocked(first[0] + (west.x - first[0]) * u, first[2] + (west.z - first[2]) * u), true, `no gap between the west run's first post and the stump at ${fmt(first[0] + (west.x - first[0]) * u, first[2] + (west.z - first[2]) * u)}`);
        assert.equal(ground.blocked(last[0] + (small.x - last[0]) * u, last[2] + (small.z - last[2]) * u), true, `no gap between the west run's last post and the small house at ${fmt(last[0] + (small.x - last[0]) * u, last[2] + (small.z - last[2]) * u)}`);
      }
    }
    // from the small house's axis to the east stump's centre, what the lookout's ground reaches by
    // the character's steps (8-way, 0.1 m, walkable = no riser ≥ 0.55 m and not blocked) never gets
    // to the bank side of the rope
    {
      const eA = anchors[0].x < anchors[1].x ? anchors[1] : anchors[0];
      const line = [...WR, ...LF].map((p) => [p[0], p[2]]).sort((p, q) => p[0] - q[0]);
      const ropeZ = (x) => {
        for (let i = 0; i + 1 < line.length; i++) {
          const [ax, az] = line[i];
          const [bx, bz] = line[i + 1];
          if (x >= ax && x <= bx) return az + ((bz - az) * (x - ax)) / (bx - ax);
        }
        return x < line[0][0] ? line[0][1] : line[line.length - 1][1];
      };
      const step = 0.1;
      const x0 = small.x;
      const x1 = eA.x;
      const z0 = B.z - 2.5;
      const z1 = Math.max(...anchors.map((a) => a.z), ...WR.map((p) => p[2])) + 2.5;
      const nx = Math.round((x1 - x0) / step);
      const nzc = Math.round((z1 - z0) / step);
      const seen = new Uint8Array((nx + 1) * (nzc + 1));
      const at = (i, j) => [x0 + i * step, z0 + j * step];
      const start = [Math.round((B.x + 0.9 * Math.sin((B.yawDeg * Math.PI) / 180) - x0) / step), Math.round((B.z + 0.9 * Math.cos((B.yawDeg * Math.PI) / 180) - z0) / step)];
      assert.equal(ground.blocked(...at(...start)), false, `the flood starts on open ground in front of the bench at ${fmt(...at(...start))}`);
      const queue = [start];
      seen[start[1] * (nx + 1) + start[0]] = 1;
      let reached = 0;
      let leak = null;
      while (queue.length) {
        const [i, j] = queue.pop();
        const [x, z] = at(i, j);
        reached++;
        if (z > ropeZ(x) + 0.05 && !leak) leak = [x, z];
        const h0 = ground.height(x, z);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni > nx || nj > nzc || seen[nj * (nx + 1) + ni]) continue;
          const [px, pz] = at(ni, nj);
          if (ground.height(px, pz) - h0 >= 0.55 || ground.blocked(px, pz)) continue;
          seen[nj * (nx + 1) + ni] = 1;
          queue.push([ni, nj]);
        }
      }
      assert.ok(reached > 300, `the flood covers the lookout (${reached} cells)`);
      assert.equal(leak, null, `the lookout's ground reaches the bank side of the rope between the small house and the east stump${leak ? ` at ${fmt(...leak)}` : ''}`);
    }
  }
  // the tall house's deck railings stop a step (off the deck strip — the built deck itself is a walk surface)
  for (const [a, b] of layout.eastDeckPlan().rails) {
    const x = (a[0] + b[0]) / 2;
    const z = (a[1] + b[1]) / 2;
    assert.equal(hf.surfaceMask(x, z, 'live').structure, 1, `deck railing wall at ${fmt(x, z)}`);
  }
  // the deck's walk surfaces as structures/east.ts publishes them: the strip's skirt answers the
  // deck's top round the strip (toward the bark, past the railing and the far end) for the feet's
  // landing prediction, and blocked() closes it — a walk and a jump (character index.ts) both refuse
  // a blocked cell, so nobody stands on the air round the deck
  {
    const plan = layout.eastDeckPlan();
    const D = EXPANSION_EAST.tallDeck;
    const h = plan.house;
    const f = (h.facingDeg * Math.PI) / 180;
    const deckY = live.height(h.x + Math.sin(f) * h.radius * 1.15, h.z + Math.cos(f) * h.radius * 1.15) + D.rise;
    const bottomY = live.height(plan.steps.bottom[0], plan.steps.bottom[1]) + 0.03;
    const skirt = { side: 0.9, end: 0.9 };
    const surfaces = (withSkirt) => [
      { id: 'east-tall-deck', disc: { x: h.x, z: h.z, r: -1, y: deckY }, deck: { a: [plan.walk.a[0], deckY, plan.walk.a[1]], b: [plan.walk.b[0], deckY, plan.walk.b[1]], hw: plan.walk.hw, ...(withSkirt ? { skirt } : {}) }, wall: { r: 0, half: -1, gap: [0, 0] } },
      { id: 'east-tall-steps', disc: { x: h.x, z: h.z, r: -1, y: deckY }, deck: { a: [plan.steps.bottom[0], bottomY, plan.steps.bottom[1]], b: [plan.steps.top[0], deckY, plan.steps.top[1]], hw: plan.steps.hw }, wall: { r: 0, half: -1, gap: [0, 0] } },
    ];
    const skirted = createGround(live, LAYOUT, { walkSurfaces: surfaces(true) });
    const bare = createGround(live, LAYOUT, { walkSurfaces: surfaces(false) });
    const walkD = plan.walk.d;
    const [walkA, walkB] = plan.walk.along;
    for (const along of [walkA, 0, walkB]) {
      const [x, z] = plan.at(walkD, along);
      near(skirted.height(x, z), deckY, 1e-6, `deck top on the strip at ${fmt(x, z)}`);
      assert.equal(skirted.blocked(x, z), false, `deck strip walkable at ${fmt(x, z)}`);
      // a stride toward the railing, past it, or toward the bark still reads the planks' height
      for (const out of [walkD + D.walkHw + 0.3, walkD + D.walkHw + 0.8, walkD - D.walkHw - 0.7]) {
        const [px, pz] = plan.at(out, along);
        near(skirted.height(px, pz), deckY, 1e-6, `skirt reads the deck's top at ${fmt(px, pz)}`);
      }
    }
    for (const out of [walkD - 0.3, walkD, walkD + 0.3]) {
      const [x, z] = plan.at(out, D.half + 0.3);
      near(skirted.height(x, z), deckY, 1e-6, `skirt past the far end at ${fmt(x, z)}`);
    }
    // the strip keeps railStop inside the outer and far railings (past the steps' top, which comes
    // up beside the door-side end): no open cell at the planks' height comes nearer their lines
    const railDist = (x, z) => Math.min(...plan.rails.map(([ra, rb]) => segDist(x, z, [ra[0], 0, ra[1]], [rb[0], 0, rb[1]])));
    let nearestRail = Infinity;
    for (let out = walkD - D.walkHw - 0.3; out <= D.outer + 0.3; out += 0.02) {
      for (let along = -D.half + 0.3; along <= D.half + 0.3; along += 0.02) {
        const [x, z] = plan.at(out, along);
        if (!skirted.blocked(x, z) && Math.abs(skirted.height(x, z) - deckY) < 1e-6) nearestRail = Math.min(nearestRail, railDist(x, z));
      }
    }
    assert.ok(nearestRail >= 0.23, `the deck strip keeps a quarter metre off the railings (nearest open cell ${nearestRail.toFixed(3)} m)`);
    // the steps keep their own slope (the skirt stops at the strip's door-side end)
    const [mx, mz] = [(plan.steps.bottom[0] + plan.steps.top[0]) / 2, (plan.steps.bottom[1] + plan.steps.top[1]) / 2];
    near(skirted.height(mx, mz), bare.height(mx, mz), 1e-9, `the steps' slope is unchanged at ${fmt(mx, mz)}`);
    assert.ok(skirted.height(mx, mz) < deckY - 0.3, `mid-flight is below the deck (${skirted.height(mx, mz).toFixed(2)} < ${deckY.toFixed(2)})`);
    // the skirt only closes cells, and only cells it lifts off the ground; an open cell it lifts is
    // the steps' last few cm flattened into the planks
    let closed = 0;
    for (let out = walkD - D.walkHw - 1.2; out <= D.outer + 1.4; out += 0.1) {
      for (let along = -D.half - D.stepRun - 0.4; along <= D.half + 1.4; along += 0.1) {
        const [x, z] = plan.at(out, along);
        const lift = skirted.height(x, z) - bare.height(x, z);
        assert.ok(lift >= 0, `the skirt never lowers the ground (${lift.toFixed(3)} at ${fmt(x, z)})`);
        if (bare.blocked(x, z)) {
          assert.equal(skirted.blocked(x, z), true, `the skirt opens nothing at ${fmt(x, z)}`);
        } else if (skirted.blocked(x, z)) {
          assert.ok(lift >= 0.55, `the skirt closes only the air over the ground (lift ${lift.toFixed(2)} at ${fmt(x, z)})`);
          closed++;
        } else {
          assert.ok(lift < 0.1, `an open cell the skirt lifts ${lift.toFixed(2)} m at ${fmt(x, z)}`);
        }
      }
    }
    assert.ok(closed > 100, `the skirt closes the air round the strip (${closed} cells)`);
    // walked from the deck by moveRoot's rule (not blocked, rising < 0.55 m; the steps' sides drop
    // to the ground): down the flight onto the ground, never onto the skirt
    const C = 0.1;
    const o0 = walkD - D.walkHw - 1.4;
    const a0 = -D.half - D.stepRun - 1.0;
    const no = Math.round((D.outer + 1.8 - o0) / C);
    const na = Math.round((D.half + 1.8 - a0) / C);
    const cell = (i, j) => plan.at(o0 + i * C, a0 + j * C);
    const seen = new Uint8Array(no * na);
    const start = [Math.round((walkD - o0) / C), Math.round((0 - a0) / C)];
    const queue = [start];
    seen[start[0] * na + start[1]] = 1;
    let reached = 0;
    while (queue.length) {
      const [i, j] = queue.pop();
      const [x, z] = cell(i, j);
      const h0 = skirted.height(x, z);
      reached++;
      assert.ok(h0 - bare.height(x, z) < 0.1, `walked onto the skirt at ${fmt(x, z)}`);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [ni, nj] = [i + di, j + dj];
        if (ni < 0 || nj < 0 || ni >= no || nj >= na || seen[ni * na + nj]) continue;
        const [nx, nz] = cell(ni, nj);
        if (skirted.blocked(nx, nz) || skirted.height(nx, nz) - h0 >= 0.55) continue;
        seen[ni * na + nj] = 1;
        queue.push([ni, nj]);
      }
    }
    const foot = [Math.round(((D.stepInner + D.stepOuter) / 2 - o0) / C), Math.round((-D.half - D.stepRun - 0.5 - a0) / C)];
    assert.equal(seen[foot[0] * na + foot[1]], 1, `walked from the deck down the flight to the ground at its foot`);
    assert.ok(reached > 300, `walked the deck, its steps and the ground round them (${reached} cells)`);
  }
  // the boots on the deck and its flight sound like planks (audio/index.ts `surfaceAt`); the ground
  // a metre off the outer railing and past the flight's foot does not
  {
    const { surfaceAt } = loadTs(path.join(here, '../../audio/index.ts'));
    const plan = layout.eastDeckPlan();
    const D = EXPANSION_EAST.tallDeck;
    for (const along of [plan.walk.along[0], 0, plan.walk.along[1]]) {
      for (const out of [plan.walk.d - plan.walk.hw, plan.walk.d, plan.walk.d + plan.walk.hw]) {
        const [x, z] = plan.at(out, along);
        assert.equal(surfaceAt(x, z).surface, 'wood', `the deck's boards sound like wood at ${fmt(x, z)}`);
      }
    }
    for (let u = 0.02; u < 1; u += 0.12) {
      const [x, z] = plan.at((D.stepInner + D.stepOuter) / 2, -D.half - D.stepRun * u);
      assert.equal(surfaceAt(x, z).surface, 'wood', `the flight's planks sound like wood at ${fmt(x, z)}`);
    }
    for (const along of [-D.half, 0, D.half]) {
      const [x, z] = plan.at(D.outer + 1.0, along);
      assert.notEqual(surfaceAt(x, z).surface, 'wood', `the ground off the deck is not wood at ${fmt(x, z)}`);
    }
    const [fx, fz] = plan.at((D.stepInner + D.stepOuter) / 2, -D.half - D.stepRun - 0.6);
    assert.notEqual(surfaceAt(fx, fz).surface, 'wood', `the ground past the flight's foot is not wood at ${fmt(fx, fz)}`);
  }
  // nothing of the lane in the legacy mask (its trunks, bench and posts are live-only)
  const solids = [...EXPANSION_EAST.houses.map((h) => [h.x, h.z]), [B.x, B.z], [EXPANSION_EAST.shopSign.x, EXPANSION_EAST.shopSign.z], ...EXPANSION_EAST.lanternPosts.map((p) => [p.x, p.z])];
  for (const [x, z] of solids) assert.equal(hf.surfaceMask(x, z, 'legacy').structure, 0, `legacy mask has no east structure at ${fmt(x, z)}`);
  // the cull stays inside the box and clears a modest share of it
  let eastCulled = 0;
  let eastCells = 0;
  for (let z = Math.ceil(EAST_BOX.z0); z <= EAST_BOX.z1; z += 1.0) {
    for (let x = Math.ceil(EAST_BOX.x0); x <= EAST_BOX.x1; x += 1.0) {
      eastCells++;
      if (hf.expansionCull(x, z)) eastCulled++;
    }
  }
  assert.ok(eastCulled > 60 && eastCulled < 0.4 * eastCells, `the east cull clears the lane's own ground only (${eastCulled} of ${eastCells} metre cells)`);

  // the casters the structures toggle the lane by (houses, lookout, posts — sun shadows included)
  // meet none of cameras A–E; F (≈ 40 m off, looking up over the plateau's lip) is beyond every
  // house's detail distance, so no house's detail draws there
  const L = loadTs(path.join(here, '../util/expansionLocality.ts'));
  const E = loadTs(path.join(here, '../util/eastLane.ts'));
  const { WORLD } = loadTs(path.join(here, '../config.ts'));
  const sun = L.sunVector(WORLD.sun.azimuthDeg, WORLD.sun.elevationDeg);
  const groundAt = (x, z) => live.height(x, z);
  const casters = [...EXPANSION_EAST.houses.flatMap((h) => E.eastHouseCasters(h, groundAt(h.x, h.z))), ...E.eastLookoutCasters(groundAt), ...E.eastPostCasters(groundAt)];
  const spheres = E.eastSpheres(casters, sun);
  for (const v of LAYOUT.viewpoints) {
    if (v.id.startsWith('F_')) {
      for (const h of EXPANSION_EAST.houses) assert.ok(Math.hypot(v.position[0] - h.x, v.position[2] - h.z) > E.EAST_DETAIL_M, `${v.id} is beyond ${h.id}'s detail distance`);
      continue;
    }
    const c = new THREE.PerspectiveCamera(v.fov, 1280 / 720, 0.1, 400);
    c.position.set(...v.position);
    c.lookAt(...v.target);
    c.updateMatrixWorld(true);
    c.updateProjectionMatrix();
    assert.equal(L.frustumMeets(c, spheres), false, `${v.id}: the east lane (and its shadow) is outside the frustum`);
  }
  // Beyond EAST_MID_M of the green the houses' feet draw only while `eastFootSeen`. F, on the plaza
  // looking up the stair bank, sees over the plateau's lip to the doors' and windows' heads (the
  // ground hides the small house to ≈ 1.4 m over its floor, the shop to ≈ 2.4 m, the tall house to
  // ≈ 3.4 m), so the feet draw in F; the lip hides them all from the plain in its lee south of the
  // plaza. From the plateau (the stairway's head, the lookout) and from high over the plaza they
  // show. `eastFootSeen` only grows with the tops (the sightline to a higher point passes over the
  // one to a lower point), so 2 m bounds every door's and window's head from below, 4 m from above.
  const at = (p) => ({ x: p[0], y: p[1], z: p[2] });
  const footSeen = (p, top) => E.eastFootSeen(at(p), groundAt, EXPANSION_EAST.houses.map(() => top));
  for (const v of LAYOUT.viewpoints.filter((w) => w.id.startsWith('F_'))) {
    assert.ok(Math.hypot(v.position[0] - E.EAST_GREEN.x, v.position[2] - E.EAST_GREEN.z) > E.EAST_MID_M, `${v.id} is beyond EAST_MID_M of the green`);
    assert.equal(footSeen(v.position, 2.0), true, `${v.id}: the houses' feet show over the plateau's lip`);
  }
  for (const [x, z] of [[2, -28], [0, -30], [4, -26], [0, -26], [4, -30]]) {
    const p = [x, groundAt(x, z) + 1.6, z];
    assert.ok(Math.hypot(x - E.EAST_GREEN.x, z - E.EAST_GREEN.z) > E.EAST_MID_M, `${fmt(x, z)} is beyond EAST_MID_M of the green`);
    assert.equal(footSeen(p, 4.0), false, `the plateau's lip hides the houses' feet from ${fmt(x, z)} (eye height)`);
  }
  for (const p of [[17.4, 6.95, -7.5], [49.6, 7.25, 8.9], [-10, 30, 20]]) assert.equal(footSeen(p, 2.0), true, `the houses' feet show from ${fmt(p[0], p[2])} (${p[1]} m up)`);
  // Nothing of the lane draws beyond EAST_SEEN_M of every trunk with the eye under EAST_OVER_Y:
  // every fixed camera and the owner's poses (the plaza, the north path, the south bridge and far
  // bank, the north's rise 55 m off) are out of reach; the lane's own poses, the stairway's foot and
  // a camera high over the village are in it
  for (const v of LAYOUT.viewpoints) assert.equal(E.eastInReach(at(v.position)), false, `${v.id}: the east lane is out of reach`);
  for (const p of [[-0.2, 2.1, 3.1], [1.4, 1.75, -10.2], [4.8, 2.6, 43.6], [4.45, 1.0, 35.8], [5.2, 6.05, -50]]) assert.equal(E.eastInReach(at(p)), false, `the east lane is out of reach from ${fmt(p[0], p[2])} (${p[1]} m up)`);
  for (const p of [[17.4, 6.95, -7.5], [31.3, 7.3, -4.5], [46.4, 7.45, 5.2], [49.6, 7.25, 8.9], [7.3, 1.75, -0.1], [-10, 30, 20]]) assert.equal(E.eastInReach(at(p)), true, `the east lane is in reach from ${fmt(p[0], p[2])} (${p[1]} m up)`);
}

console.log('expansion2.test.mjs: ok');
