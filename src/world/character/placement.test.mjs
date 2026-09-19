/** Run: node src/world/character/placement.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Transpile placement.ts (dependency-free) in memory so the test runs without a bundler.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = ts.transpileModule(readFileSync(path.join(here, 'placement.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => {
  throw new Error('placement.ts must stay dependency-free');
}, mod, mod.exports);
const { projectPoint, screenRay, marchToGround, pointAtDepth, matchViewpoint, headingOf, VIEW_TABLE } = mod.exports;

const camOf = (position, target, fov, aspect = 16 / 9) => {
  const f = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
  const l = Math.hypot(...f);
  return { position, forward: f.map((v) => v / l), fov, aspect };
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

// 1. pinhole matches the gauntlet's proj.mjs numbers (camera A, layout kokiri-a spot → (0.96, 0.61))
const A = camOf([0.4, 1.8, 8.6], [6.7, 1.8, -5.8], 46);
const pa = projectPoint(A, [10.8, 0.9, 2.2]);
near(pa[0], 0.96, 0.006, 'A kid x');
near(pa[1], 0.61, 0.006, 'A kid y');
near(pa[2], 10.0, 0.1, 'A kid depth');

// 2. screen ray inverts projection
for (const [sx, sy] of [[0.5, 0.9], [0.035, 0.885], [0.9, 0.2]]) {
  const d = screenRay(A, sx, sy);
  const p = [A.position[0] + d[0] * 7, A.position[1] + d[1] * 7, A.position[2] + d[2] * 7];
  const back = projectPoint(A, p);
  near(back[0], sx, 1e-9, 'ray x round-trip');
  near(back[1], sy, 1e-9, 'ray y round-trip');
}

// 3. marching to a flat ground puts the feet exactly at the reference screen point
const B = camOf([0, 1.6, 2.0], [5, 1.8, -12], 46);
const flat = () => 0;
const feet = marchToGround(B, 0.5, 0.91, flat);
assert.ok(feet, 'B feet found');
near(feet[1], 0, 1e-9, 'feet on the ground');
const fp = projectPoint(B, feet);
near(fp[0], 0.5, 1e-6, 'B feet x');
near(fp[1], 0.91, 1e-6, 'B feet y');
// ≈ 4.7 m ahead for the layout's B camera (the reference camera is 4.3 m in front of Link)
near(fp[2], 4.75, 0.15, 'B feet depth');
// head top (1.27 m) lands near the reference 0.57
const hp = projectPoint(B, [feet[0], 1.27, feet[2]]);
near(hp[1], 0.6, 0.03, 'B head y');

// 4. marching respects a raised ground (hit earlier on higher terrain)
const raised = marchToGround(B, 0.5, 0.91, (x, z) => 0.4);
assert.ok(raised && raised[2] > feet[2], 'raised ground is hit closer to the camera');
near(raised[1], 0.4, 1e-9, 'raised height');

// 5. no ground above the horizon
assert.equal(marchToGround(B, 0.5, 0.3, flat, { maxDist: 60 }), null, 'sky ray misses');

// 6. Navi at Link's depth on her reference ray
const n = pointAtDepth(B, 0.565, 0.585, fp[2]);
const np = projectPoint(B, n);
near(np[0], 0.565, 1e-6, 'navi x');
near(np[1], 0.585, 1e-6, 'navi y');
near(np[2], fp[2], 1e-6, 'navi depth');

// 7. viewpoint matching: exact pose → id, B and E share a pose (first wins), 1 cm tolerance
const vps = [
  { id: 'A_stairs', position: [0.4, 1.8, 8.6], target: [6.7, 1.8, -5.8] },
  { id: 'B_house', position: [0, 1.6, 2.0], target: [5, 1.8, -12] },
  { id: 'E_ground', position: [0, 1.6, 2.0], target: [5, 1.8, -12] },
];
assert.equal(matchViewpoint(A.position, A.forward, vps), 'A_stairs');
assert.equal(matchViewpoint(B.position, B.forward, vps), 'B_house');
assert.equal(matchViewpoint([0.005, 1.6, 2.0], B.forward, vps), 'B_house', 'within 1 cm');
assert.equal(matchViewpoint([0.05, 1.6, 2.0], B.forward, vps), null, 'outside 1 cm');
assert.equal(matchViewpoint(B.position, A.forward, vps), null, 'wrong direction');

// 8. heading convention: forward = (sin yaw, 0, cos yaw)
near(headingOf([0, 0, 1]), 0, 1e-12, 'south');
near(headingOf([1, 0, 0]), Math.PI / 2, 1e-12, 'east');

// 9. the view table covers every non-diagnostic hero frame with sane screen boxes
for (const id of ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy']) {
  const v = VIEW_TABLE[id];
  assert.ok(v, `${id} in VIEW_TABLE`);
  assert.ok(v.feet[1] > 0.8 && v.feet[1] < 1, `${id} feet near the bottom`);
  assert.ok(Math.abs(v.feet[0] - 0.5) < 0.1, `${id} centred`);
  assert.ok(['idle', 'walk', 'run', 'stairs'].includes(v.gait), `${id} gait`);
}

console.log('placement.test.mjs: all assertions passed');
