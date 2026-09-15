/** Run: node src/world/character/gaitChain.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Transpile gaitChain.ts (dependency-free at runtime: its only import is a type) in memory.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = ts.transpileModule(readFileSync(path.join(here, 'gaitChain.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => {
  throw new Error('gaitChain.ts must stay dependency-free');
}, mod, mod.exports);
const { BLEND_S, hardChain, fadeIn, chainWeights, switchGait } = mod.exports;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const has = () => true;
const F = 1 / 60;

// the GLB's clip contract: idle has no gait phase; the others do. `align` returns a recognisable
// shift per (from, to); `anchor` records what it was asked for.
const calls = [];
const hooks = {
  hasPhase: (g) => g !== 'idle',
  align: (from, fromShift, to, t) => {
    calls.push(['align', from, fromShift, to, t]);
    return `${from}>${to}`;
  },
  anchor: (gait, clipShift, t) => {
    calls.push(['anchor', gait, clipShift, t]);
    return [1, 2, 0.1, 3, 4, 0.2];
  },
};
const weightsOf = (c, t) => {
  const out = [0, 0, 0];
  const n = chainWeights(c, t, has, out);
  near(out[0] + out[1] + out[2], 1, 1e-12, 'weights sum to 1');
  return { n, out };
};

// 1. hard chain: one clip at full weight, no fade
{
  const c = hardChain('idle');
  assert.equal(c.gait, 'idle');
  assert.equal(c.gaitSwitchT, -Infinity);
  const { n, out } = weightsOf(c, 12.6);
  assert.equal(n, 1);
  assert.deepEqual(out, [1, 0, 0]);
}

// 2. fadeIn: 0 at the switch, ½ half-way, 1 at BLEND_S and for a hard switch
{
  assert.equal(fadeIn(20, 20), 0);
  near(fadeIn(20 + BLEND_S / 2, 20), 0.5, 1e-12, 'half-way');
  assert.equal(fadeIn(20 + BLEND_S, 20), 1);
  assert.equal(fadeIn(20, -Infinity), 1);
  assert.equal(fadeIn(19.9, 20), 1, 'a switch in the future reads as finished (no negative fade)');
}

// 3. idle → walk crossfade: the walk fades in, the idle anchored where it stood, the walk aligned from the idle
{
  calls.length = 0;
  const c = hardChain('idle');
  switchGait(c, 'walk', 20, hooks);
  assert.equal(c.gait, 'walk');
  assert.equal(c.gaitFrom, 'idle');
  assert.equal(c.gaitSwitchT, 20);
  assert.deepEqual(c.anchorFrom, [1, 2, 0.1, 3, 4, 0.2], 'an idle being left is anchored');
  assert.equal(c.clipShift, 'idle>walk');
  assert.deepEqual(calls, [
    ['anchor', 'idle', 0, 20],
    ['align', 'idle', 0, 'walk', 20],
  ]);
  const { n, out } = weightsOf(c, 20 + 4 * F);
  assert.equal(n, 2);
  near(out[0], fadeIn(20 + 4 * F, 20), 1e-12, 'walk weight is its fade-in');
  near(out[1], 1 - out[0], 1e-12, 'idle carries the rest');
  assert.equal(out[2], 0);
  // finished: one clip
  assert.deepEqual(weightsOf(c, 20 + BLEND_S).out, [1, 0, 0]);
}

// 4. the residual: a second switch 4 frames into the fade keeps the idle fading — its weight is
// continuous across the switch (round 5 cut it from 81 % to 0 in one frame)
{
  calls.length = 0;
  const c = hardChain('idle');
  switchGait(c, 'walk', 20, hooks);
  const t2 = 20 + 4 * F;
  const before = weightsOf(c, t2).out;
  switchGait(c, 'stairs', t2, hooks);
  assert.equal(c.gait, 'stairs');
  assert.equal(c.gaitFrom, 'walk');
  assert.equal(c.gaitFrom2, 'idle');
  assert.equal(c.gaitSwitchT, t2);
  assert.equal(c.gaitSwitchT2, 20);
  assert.equal(c.anchorFrom, null, 'a walk being left has its own stance spots');
  assert.deepEqual(c.anchorFrom2, [1, 2, 0.1, 3, 4, 0.2], 'the idle anchor moves down the chain');
  assert.equal(c.clipShift, 'walk>stairs', 'aligned from the nearest clip with a phase');
  assert.equal(c.clipShiftFrom, 'idle>walk');
  const { n, out } = weightsOf(c, t2);
  assert.equal(n, 2, 'at the switch instant the incoming clip has no weight yet');
  assert.equal(out[0], 0);
  near(out[2], before[1], 1e-9, 'the idle weight is continuous across the second switch');
  // a frame later all three carry weight and the idle is still fading on its own clock
  const w3 = weightsOf(c, t2 + F);
  assert.equal(w3.n, 3);
  const w = fadeIn(t2 + F, t2);
  const w2 = fadeIn(t2 + F, 20);
  near(w3.out[0], w, 1e-12, 'stairs = its fade-in');
  near(w3.out[1], (1 - w) * w2, 1e-12, 'walk = (1 − w)·w₂');
  near(w3.out[2], (1 - w) * (1 - w2), 1e-12, 'idle = (1 − w)·(1 − w₂), still on its own clock');
  assert.ok(w3.out[2] < before[1], 'the idle keeps fading');
  // after BLEND_S the idle is gone, after 2·BLEND_S everything is stairs
  assert.equal(weightsOf(c, 20 + BLEND_S).out[2], 0);
  assert.deepEqual(weightsOf(c, t2 + BLEND_S).out, [1, 0, 0]);
}

// 5. switching back to a clip still in the chain reuses its shift (one clip time per clip)
{
  calls.length = 0;
  const c = hardChain('walk');
  c.clipShift = 0.123;
  switchGait(c, 'idle', 30, hooks);
  assert.equal(c.anchorFrom, null, 'a walk being left is not anchored');
  assert.equal(c.clipShift, 'walk>idle');
  switchGait(c, 'walk', 30 + 2 * F, hooks);
  assert.equal(c.gait, 'walk');
  assert.equal(c.gaitFrom, 'idle');
  assert.equal(c.gaitFrom2, 'walk');
  assert.equal(c.clipShift, 0.123, 'the walk keeps the shift it already has in the chain');
  assert.equal(c.clipShiftFrom2, 0.123);
  assert.deepEqual(c.anchorFrom, [1, 2, 0.1, 3, 4, 0.2], 'the idle being left is anchored');
  assert.deepEqual(calls.filter((k) => k[0] === 'align').map((k) => k[3]), ['idle'], 'no second align for the reused clip');
}

// 6. a chained switch through an idle aligns from the clip beyond it (the nearest one with a phase)
{
  calls.length = 0;
  const c = hardChain('walk');
  c.clipShift = 0.5;
  switchGait(c, 'idle', 40, hooks);
  switchGait(c, 'run', 40 + 3 * F, hooks);
  assert.equal(c.clipShift, 'walk>run');
  const a = calls.filter((k) => k[0] === 'align').at(-1);
  assert.deepEqual(a, ['align', 'walk', 0.5, 'run', 40 + 3 * F]);
}

// 7. a switch after the fade has finished is a plain two-clip fade; the stale third entry has no weight
{
  const c = hardChain('idle');
  switchGait(c, 'walk', 50, hooks);
  switchGait(c, 'run', 50 + BLEND_S + 0.1, hooks);
  assert.equal(c.gaitFrom2, 'idle');
  const { n, out } = weightsOf(c, 50 + BLEND_S + 0.1 + F);
  assert.equal(n, 2);
  assert.equal(out[2], 0, 'a finished fade folds upward');
  assert.equal(c.clipShift, 'walk>run');
}

// 8. a crossfade into the current gait is a no-op; a hard switch resets the chain
{
  const c = hardChain('idle');
  switchGait(c, 'walk', 60, hooks);
  const snap = { ...c };
  switchGait(c, 'walk', 60.05, hooks);
  assert.deepEqual(c, snap, 'no-op');
  switchGait(c, 'stairs', null, hooks);
  assert.deepEqual(c, hardChain('stairs'));
}

// 9. a clip the puppet lacks folds its weight upward (the procedural rig has every gait; a GLB missing one must not blend into nothing)
{
  const c = hardChain('idle');
  switchGait(c, 'walk', 70, hooks);
  const out = [0, 0, 0];
  const n = chainWeights(c, 70 + F, (g) => g !== 'idle', out);
  assert.equal(n, 1);
  assert.deepEqual(out, [1, 0, 0]);
}

console.log('gaitChain.test.mjs: ok');
