/** Run: node src/world/character/signPose.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = ts.transpileModule(readFileSync(path.join(here, 'signPose.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => {
  throw new Error('signPose.ts must stay dependency-free');
}, mod, mod.exports);
const S = mod.exports;

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

// the GLB's arm chain (public/models/link/link-runtime.glb): shoulders off the chest, the elbow 0.1647 m down the upper arm, the wrist 0.1122 m down the forearm
const UPPER = 0.1647;
const FORE = 0.1122;
const SHOULDER = { L: [0.15, 0.188, 0], R: [-0.15, 0.188, 0] };
// Link stands 1.1998 m with his cap (the character audit's linkHeight)
const LINK_HEIGHT = 1.1998;

test('a reachable grip puts the wrist on it with both bones at their lengths, the elbow bent toward its pole', () => {
  const s = [0, 0, 0];
  const t = [0.1, 0.12, 0.08];
  const pole = [1, -1, 0];
  const { elbow, wrist } = S.reachTwoBone(s, t, UPPER, FORE, pole);
  near(dist(s, elbow), UPPER, 1e-9, 'upper arm length');
  near(dist(elbow, wrist), FORE, 1e-9, 'forearm length');
  near(dist(wrist, t), 0, 1e-9, 'wrist on the grip');
  // the elbow sits off the shoulder → wrist line on the pole's side
  const n = [t[0] / Math.hypot(...t), t[1] / Math.hypot(...t), t[2] / Math.hypot(...t)];
  const along = elbow[0] * n[0] + elbow[1] * n[1] + elbow[2] * n[2];
  const off = [elbow[0] - n[0] * along, elbow[1] - n[1] * along, elbow[2] - n[2] * along];
  assert.ok(off[0] * pole[0] + off[1] * pole[1] + off[2] * pole[2] > 0, 'the elbow must bend toward the pole');
});

test('out of reach the arm goes straight at the grip; too close it folds, and never breaks', () => {
  const s = [0, 0, 0];
  const far = S.reachTwoBone(s, [0, 0.6, 0], UPPER, FORE, [1, 0, 0]);
  near(dist(s, far.wrist), UPPER + FORE, 2e-4, 'full reach');
  near(dist(s, far.elbow) + dist(far.elbow, far.wrist), dist(s, far.wrist), 1e-3, 'straight arm');
  const close = S.reachTwoBone(s, [0, 0.01, 0], UPPER, FORE, [1, 0, 0]);
  near(dist(s, close.wrist), UPPER - FORE, 2e-4, 'full fold');
  near(dist(s, close.elbow), UPPER, 1e-9, 'upper arm keeps its length when folded');
  // a pole along the reach itself still bends somewhere, with finite numbers
  const along = S.reachTwoBone(s, [0, 0.2, 0], UPPER, FORE, [0, 1, 0]);
  assert.ok(along.elbow.every(Number.isFinite), 'a degenerate pole must not produce NaN');
  near(dist(s, along.elbow), UPPER, 1e-9, 'degenerate pole: upper arm length');
});

test('both grips are on the pole, comfortably inside each arm\u2019s reach from the rest shoulders', () => {
  for (const side of ['L', 'R']) {
    const g = S.SIGN_GRIP[side];
    assert.ok(g[1] > S.SIGN_POLE.y0 && g[1] < S.SIGN_POLE.y1, `${side} grip at ${g[1]} must be on the pole (${S.SIGN_POLE.y0}…${S.SIGN_POLE.y1})`);
    near(Math.hypot(g[0] - S.SIGN_POLE.x, g[2] - S.SIGN_POLE.z), 0.045, 1e-9, `${side} wrist sits a fist's reach off the pole's axis`);
    const d = dist(SHOULDER[side], g);
    assert.ok(d < 0.8 * (UPPER + FORE), `${side} grip is ${d.toFixed(3)} m from the shoulder — ${((d / (UPPER + FORE)) * 100).toFixed(0)} % of the arm's reach`);
    // each wrist on its own side of the pole, so the fists do not cross
    assert.ok(Math.sign(g[0] - S.SIGN_POLE.x) === Math.sign(SHOULDER[side][0]), `${side} wrist must be on the ${side} side of the pole`);
  }
});

test('the board clears the cap, faces the camera unobstructed and keeps the screenshot\u2019s aspect', () => {
  const bottom = S.CHEST_REST_Y + S.SIGN_BOARD.bottom;
  assert.ok(bottom >= LINK_HEIGHT + 0.08, `the board's bottom edge stands ${bottom.toFixed(3)} m, Link ${LINK_HEIGHT} m with his cap`);
  // the board sits behind the pole (nearer the follow camera, which trails him)
  assert.ok(S.SIGN_BOARD.z + S.SIGN_BOARD.depth / 2 < S.SIGN_POLE.z - S.SIGN_POLE.radius, 'the pole must stand in front of the board');
  // the stave reaches up into the board's lower edge, where it is fixed
  assert.ok(S.SIGN_POLE.y1 > S.SIGN_BOARD.bottom && S.SIGN_POLE.y1 < S.SIGN_BOARD.bottom + S.SIGN_BOARD.height / 3, 'the pole must end inside the board\u2019s lower third');
  near(S.SIGN_BOARD.width / S.SIGN_BOARD.height, 1169 / 544, 1e-9, 'board aspect vs the screenshot');
});

test('the raise eases in and out over SIGN_RAISE_S and holds at its ends', () => {
  assert.equal(S.signWeight(0), 0);
  assert.equal(S.signWeight(1), 1);
  assert.equal(S.signWeight(-1), 0);
  assert.equal(S.signWeight(2), 1);
  for (let x = 0; x < 1; x += 0.05) assert.ok(S.signWeight(x + 0.05) >= S.signWeight(x), 'the weight must never fall while raising');
  let r = 0;
  for (let t = 0; t < S.SIGN_RAISE_S - 1e-9; t += 1 / 60) r = S.stepRaise(r, true, 1 / 60);
  near(r, 1, 1 / 60 / S.SIGN_RAISE_S + 1e-9, 'up after SIGN_RAISE_S');
  assert.equal(S.stepRaise(1, true, 1 / 60), 1, 'holds up');
  assert.equal(S.stepRaise(0.5, true, 0), 0.5, 'a zero-dt re-render must not advance the raise');
  assert.equal(S.stepRaise(0, false, 1 / 60), 0, 'holds down');
});

test('the sign\u2019s face ships in public/ and is credited (anti-cheat C4)', () => {
  const file = path.join(root, 'public', S.SIGN_TEXTURE_FILE);
  assert.ok(existsSync(file), `${S.SIGN_TEXTURE_FILE} must be in public/`);
  const credits = readFileSync(path.join(root, 'public/textures/CREDITS.md'), 'utf8');
  assert.match(credits, /\| `sign` \| readers-note\.jpg \|/, 'public/textures/CREDITS.md must list the sign set');
  assert.doesNotMatch(S.SIGN_TEXTURE_FILE, /\b(nintendo|zelda|oot)\b/i, 'anti-cheat C5 reads asset names');
});
