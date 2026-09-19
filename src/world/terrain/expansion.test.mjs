/**
 * Round 47 (expansion-1): the world beyond the log arch. Run: node src/world/terrain/expansion.test.mjs
 * (Node 20+, no browser). Samples the character ground's `blocked()` along the arch tunnel's
 * axis (open) and through the log's walls (blocked), the `ledge` flight through `onStairs` /
 * `height`, the north path's grade and the north clearing's floor, and the terrace pad — all off
 * the authored heightfield, so a layout or terrain edit that closes the tunnel, moves the flight
 * off its pad or tilts the clearing fails here before a capture is spent.
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
const { LAYOUT } = loadTs(path.join(here, '../layout.ts'));
const { createGround } = loadTs(path.join(here, '../character/ground.ts'));
const terrain = hf.createTerrain();
const ground = createGround(terrain, LAYOUT);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

// 1. the tunnel: the spine's last two segments and the north path's first run under the log.
// Every 0.25 m along the axis, and 0.6 m either side of it, is walkable; the log's grounded
// walls (its axis runs east–west through logArch.position; the structure band is ± 0.9 R
// across it) are blocked on both sides of the passage.
const spine = LAYOUT.pathSpine;
const axis = [spine[spine.length - 3], spine[spine.length - 2], spine[spine.length - 1], LAYOUT.northPath[1]];
let axisSamples = 0;
for (let i = 0; i + 1 < axis.length; i++) {
  const [a, b] = [axis[i], axis[i + 1]];
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const nx = -(b[2] - a[2]) / len;
  const nz = (b[0] - a[0]) / len;
  for (let t = 0; t <= len; t += 0.25) {
    const x = a[0] + ((b[0] - a[0]) * t) / len;
    const z = a[2] + ((b[2] - a[2]) * t) / len;
    for (const side of [-0.6, 0, 0.6]) {
      assert.equal(ground.blocked(x + nx * side, z + nz * side), false, `tunnel open at (${(x + nx * side).toFixed(2)}, ${(z + nz * side).toFixed(2)})`);
      axisSamples++;
    }
  }
}
assert.ok(axisSamples > 60, `sampled the tunnel (${axisSamples})`);
// the structure band IS painted under the log where the tunnel runs (the paving / vegetation rules keep it)
const la = LAYOUT.logArch.position;
assert.ok(hf.surfaceMask(la[0], la[2]).structure > 0.5, 'the arch footprint is still structure');
// the walls: the spine crosses under the log's west half (layout.ts: centre line at lu −3.4 …
// −4.8), so points on the log's axis east of lu 1 and west of lu −8 (the bent west third:
// heightfield `logBend`, 1.8 k² south for lu < −0.15 L) are the grounded body and stay blocked
const yaw = (LAYOUT.logArch.yawDeg * Math.PI) / 180;
const ax = Math.cos(yaw);
const az = -Math.sin(yaw);
const L = LAYOUT.logArch.length;
let wallBlocked = 0;
let wallSamples = 0;
for (const lu of [1, 3, 5, 7, -8, -9, -10]) {
  const k = Math.min(1, Math.max(0, (-L * 0.15 - lu) / (L * 0.35)));
  const bend = 1.8 * k * k;
  const x = la[0] + ax * lu - az * bend;
  const z = la[2] + az * lu + ax * bend;
  assert.ok(hf.surfaceMask(x, z).structure > 0.5, `log axis at lu ${lu} is inside the structure band`);
  assert.ok(hf.archTunnel(x, z) < 0.5, `log axis at lu ${lu} is outside the tunnel`);
  wallSamples++;
  if (ground.blocked(x, z)) wallBlocked++;
}
assert.equal(wallBlocked, wallSamples, 'every log-wall sample is blocked');
// and the houses' trunk pads are still blocked
for (const hs of LAYOUT.houses) assert.equal(ground.blocked(hs.position[0], hs.position[2]), true, `house trunk ${hs.id} blocked`);

// 2. the north path climbs the north rise's crest just past the arch's north lip (the rise that
// hides the ground beyond from camera D — baseline ground, 4.45 m at z −60) and then falls
// gently into the clearing; the clearing is flat at its floor
const np = LAYOUT.northPath;
const lip = terrain.height(np[0][0], np[0][2]);
const crest = terrain.height(np[1][0], np[1][2]);
assert.ok(crest > lip && crest - lip < 0.35, `the crest past the lip is a low rise (${lip} → ${crest})`);
let prev = crest;
for (let i = 2; i < np.length; i++) {
  const h = terrain.height(np[i][0], np[i][2]);
  near(h, np[i][1], 0.12, `north path node ${i} on its grade`);
  assert.ok(h <= prev + 0.02, `north path falls toward the clearing (node ${i}: ${h} after ${prev})`);
  prev = h;
}
const NC = LAYOUT.northClearing;
for (let k = 0; k < 12; k++) {
  const a = (k / 12) * Math.PI * 2;
  // (the rim's east sector carries the path's last 3–7 cm of fall into the disc; the north rim
  // under the `ledge` flight's foot is the flight's own foot bank — heightfield stair ramps)
  for (const r of [0, 0.5, 0.85]) {
    const x = NC.x + Math.cos(a) * NC.radius * r;
    const z = NC.z + Math.sin(a) * NC.radius * r;
    if (z < -72 && Math.abs(x - 1.2) < 1.6) continue;
    near(terrain.height(x, z), NC.y, r > 0.8 ? 0.1 : 0.06, `clearing floor at r ${r} ang ${k}`);
  }
}
// enclosed: the ground 8 m west, north-west, north (the terrace) and east of the clearing's
// centre is higher than its floor; the only low side is the south-east, where the path arrives
for (const [dx, dz] of [[-8, 0], [-6, -6], [0, -8], [8, 0]]) assert.ok(terrain.height(NC.x + dx, NC.z + dz) > NC.y + 0.3, `bank rises at (${dx}, ${dz})`);
// the paving reaches the clearing and the path
assert.ok(hf.surfaceMask(NC.x, NC.z).path > 0.5, 'clearing is paved');
assert.ok(hf.surfaceMask(np[2][0], np[2][2]).path > 0.5, 'north path is paved');

// 3. the ledge flight: on the stairs, tread heights step by `rise`, the landing at the terrace height
const ledge = LAYOUT.stairs.find((s) => s.id === 'ledge');
assert.ok(ledge, 'ledge flight defined');
const l = Math.hypot(ledge.dir[0], ledge.dir[1]);
const dx = ledge.dir[0] / l;
const dz = ledge.dir[1] / l;
for (let i = 0; i < ledge.steps; i++) {
  const u = (i + 0.5) * ledge.tread;
  const x = ledge.base[0] + dx * u;
  const z = ledge.base[2] + dz * u;
  assert.equal(ground.onStairs(x, z), true, `tread ${i} on stairs`);
  near(ground.height(x, z), ledge.base[1] + (i + 1) * ledge.rise, 1e-6, `tread ${i} height`);
  // the terrain under the tread stays under the step (nothing pokes through)
  assert.ok(terrain.height(x, z) <= ledge.base[1] + (i + 1) * ledge.rise + 1e-6, `terrain under tread ${i}`);
}
const topU = ledge.steps * ledge.tread + 0.8;
near(ground.height(ledge.base[0] + dx * topU, ledge.base[2] + dz * topU), LAYOUT.ledgeTerrace.y, 1e-6, 'landing at the terrace height');
// the flight's foot stands on the clearing's paving, off the stairs
const footZ = ledge.base[2] - dz * 0.4;
assert.equal(ground.onStairs(ledge.base[0], footZ), false, 'foot is off the stairs');
near(terrain.height(ledge.base[0], footZ), ledge.base[1], 0.08, 'foot on the clearing floor');

// 4. the terrace pad: at its height over its half extents (within the ± 14 cm medium breakup the
// heightfield leaves on every authored pad — the house pads carry the same); its south face
// falls 1.6 m to the clearing; the ground behind it climbs on (a bay with a bank behind)
const T = LAYOUT.ledgeTerrace;
for (const [u, v] of [[0, 0], [-1.8, 0], [1.8, 0], [0, -1.0], [0, 1.0], [-1.5, 0.8], [1.5, -0.8]]) near(terrain.height(T.x + u, T.z + v), T.y, 0.15, `terrace flat at (${u}, ${v})`);
assert.ok(terrain.height(T.x, T.z + T.halfDepth + 1.5) < T.y - 0.6, 'the south face drops toward the clearing');
assert.ok(terrain.height(T.x, T.z + T.halfDepth + 3.0) < T.y - 1.3, 'the clearing lies 1.6 m below the terrace');
assert.ok(terrain.height(T.x, T.z - T.halfDepth - 1.5) > T.y + 0.5, 'the bank behind the terrace rises');
// the Kokiri spot stands on the terrace
const spot = LAYOUT.npcSpots.find((s) => s.id === 'kokiri-ledge');
assert.ok(spot, 'kokiri-ledge spot');
near(terrain.height(spot.position[0], spot.position[2]), T.y, 0.15, 'kokiri-ledge on the terrace');
assert.equal(ground.blocked(spot.position[0], spot.position[2]), false, 'kokiri-ledge walkable');

// 4b. the stone circle: seven standing stones on the ring, each blocked for the character (the
// `structure` mask under it), the paving between them open
assert.equal(hf.STONE_CIRCLE_STONES.length, LAYOUT.stoneCircle.stones, 'standing stone count');
for (const s of hf.STONE_CIRCLE_STONES) {
  near(Math.hypot(s.x - NC.x, s.z - NC.z), LAYOUT.stoneCircle.ringRadius, 0.13, 'standing stone on the ring');
  assert.equal(ground.blocked(s.x, s.z), true, `standing stone blocks at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
  assert.equal(ground.blocked(s.x + 0.5 * Math.cos(s.ang), s.z + 0.5 * Math.sin(s.ang)), false, 'the paving outside the stone is open');
}
assert.equal(ground.blocked(NC.x, NC.z), false, 'the centre slab is open');
// the ring's gap faces the path's arrival: no stone within 1.4 m of the path's last node
const arrive = LAYOUT.northPath[LAYOUT.northPath.length - 2];
for (const s of hf.STONE_CIRCLE_STONES) assert.ok(Math.hypot(s.x - arrive[0], s.z - arrive[2]) > 1.4, 'the arrival sector is open');

// 5. the lookout dais stands on the east plateau's turf (no mask change there), clear of the
// `plateau-west` fence's last post and of the east giant's trunk and buttress roots (≤ 3.2 m)
const LK = LAYOUT.lookout;
near(terrain.height(LK.x, LK.z), LAYOUT.terraces.eastPlateau.height, 0.5, 'lookout on the plateau');
assert.equal(hf.surfaceMask(LK.x, LK.z).path, 0, 'lookout leaves the plateau mask alone');
{
  const a = (LK.yawDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [LK.x + u * LK.halfLength * c + v * LK.halfDepth * s, LK.z - u * LK.halfLength * s + v * LK.halfDepth * c]);
  // the white-bark trunks the take-0116 audit lists on the lip (trees read no mask here) stay off the slab
  for (const [tx, tz] of [[22.19, 3.84], [24.09, 0.08], [22.6, 8.56]]) {
    const lu = (tx - LK.x) * c - (tz - LK.z) * s;
    const lv = (tx - LK.x) * s + (tz - LK.z) * c;
    assert.ok(Math.abs(lu) > LK.halfLength + 0.3 || Math.abs(lv) > LK.halfDepth + 0.3, `white-bark at (${tx}, ${tz}) is off the dais`);
  }
  const giant = LAYOUT.giantTrees.find((g) => g.id === 'east-giant');
  for (const [x, z] of corners) assert.ok(Math.hypot(x - giant.position[0], z - giant.position[2]) >= 3.4, `dais corner (${x.toFixed(2)}, ${z.toFixed(2)}) clears the east giant's roots`);
  const fence = LAYOUT.fences.find((f) => f.id === 'plateau-west');
  const post = fence.points[fence.points.length - 1];
  const lu = (post[0] - LK.x) * c - (post[2] - LK.z) * s;
  const lv = (post[0] - LK.x) * s + (post[2] - LK.z) * c;
  assert.ok(Math.abs(lu) > LK.halfLength + 0.15 || Math.abs(lv) > LK.halfDepth + 0.15, 'the last fence post is outside the dais');
}

// 6. south of the extension nothing changed for the masks the fixed frames depend on: the mask's
// legacy view equals the live mask there
for (const [x, z] of [[0, 0], [3, -20], [5, -40], [6, -53.9], [-8, -30]]) {
  const m = hf.surfaceMask(x, z);
  assert.equal(hf.legacyPathMask(x, z, m.path), m.path, `legacy mask is the live mask at (${x}, ${z})`);
}
// and north of it the legacy view is the spine's own end only: 0 in the clearing
assert.equal(hf.legacyPathMask(NC.x, NC.z, 1), 0, 'legacy mask does not know the clearing');

console.log(`expansion.test: ok (${axisSamples} tunnel samples, ${wallSamples} wall samples, ${ledge.steps} treads)`);
