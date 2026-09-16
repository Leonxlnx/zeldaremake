// node --test src/perfFlags.test.mjs — the performance flags parse and the auto-quality governor
// (round 38, perf-2). CPU contracts only: defaults are the shipped behaviour, every flag lands in
// the runtime state, the governor steps down on sustained slow frames, up after a fast run, never
// twice inside its interval, and lengthens the fast run it demands after a punished step up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(
    (id) => {
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
      throw new Error(`unexpected import ${id}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const { parsePerfFlags, isDefaultPerf, defaultPerfSettings, applyPerfSettings, QualityGovernor, AUTO_LADDER } = load(path.join(here, 'perfFlags.ts'));

// --- parse ------------------------------------------------------------------------------------------
{
  const d = parsePerfFlags('');
  assert.deepEqual(d.fx, { ao: true, rays: true, bloom: true, soft: true });
  assert.equal(d.shadowMapSize, 4096);
  assert.equal(d.shadowTaps, 12);
  assert.equal(d.vegLodScale, 1);
  assert.equal(d.grassDensity, 1);
  assert.equal(d.renderScale, 1);
  assert.equal(d.auto, false);
  assert.equal(d.governor, false);
  assert.ok(isDefaultPerf(d), 'no parameters = the shipped behaviour');
  assert.ok(isDefaultPerf(parsePerfFlags('?capture=1&dev=0&quality=high')), 'the capture URL carries no performance flag');
  assert.deepEqual(defaultPerfSettings(), { fx: d.fx, shadowMapSize: 4096, shadowTaps: 12, vegLodScale: 1, grassDensity: 1, renderScale: 1 });
}
{
  const f = parsePerfFlags('?fx=noao,norays&shadow=1024,4&veg=0.5,0.5&scale=0.5');
  assert.deepEqual(f.fx, { ao: false, rays: false, bloom: true, soft: true });
  assert.equal(f.shadowMapSize, 1024);
  assert.equal(f.shadowTaps, 4);
  assert.equal(f.vegLodScale, 0.5);
  assert.equal(f.grassDensity, 0.5);
  assert.equal(f.renderScale, 0.5);
  assert.deepEqual(f.active, { fx: 'noao,norays', shadow: '1024,4', veg: '0.5,0.5', scale: '0.5' });
  assert.ok(!isDefaultPerf(f));
  assert.deepEqual(parsePerfFlags('fx=off').fx, { ao: false, rays: false, bloom: false, soft: false });
  assert.deepEqual(parsePerfFlags('fx=nobloom,nosoft').fx, { ao: true, rays: true, bloom: false, soft: false });
  assert.equal(parsePerfFlags('shadow=0').shadowMapSize, 0, 'shadow=0 switches the map off');
  assert.equal(parsePerfFlags('shadow=2048').shadowTaps, 12, 'taps keep their default when only the size is given');
  assert.equal(parsePerfFlags('veg=0.75').grassDensity, 1, 'grass density keeps its default when only the LOD scale is given');
  assert.equal(parsePerfFlags('scale=2').renderScale, 1, 'render scale is clamped to 1');
  assert.equal(parsePerfFlags('scale=0.1').renderScale, 0.25, 'render scale floor');
  assert.equal(parsePerfFlags('shadow=abc').shadowMapSize, 4096, 'garbage falls back to the default');
}
{
  assert.equal(parsePerfFlags('quality=auto').governor, true, 'auto in a browser runs the governor');
  assert.equal(parsePerfFlags('quality=auto', { headless: true }).governor, false, 'auto under a headless capture is fixed high');
  assert.equal(parsePerfFlags('quality=auto&governor=1', { headless: true }).governor, true, 'the trace harness opts in explicitly');
  assert.equal(parsePerfFlags('quality=high&governor=1', { headless: true }).governor, false, 'governor=1 alone does nothing');
}

// --- runtime state ------------------------------------------------------------------------------------
{
  const r = { ...defaultPerfSettings(), version: 0, tier: 'high' };
  assert.equal(applyPerfSettings(r, defaultPerfSettings(), 'high'), false, 'same settings: no change, no version bump');
  assert.equal(r.version, 0);
  assert.equal(applyPerfSettings(r, AUTO_LADDER[1], 'auto:1'), true);
  assert.equal(r.version, 1);
  assert.equal(r.shadowMapSize, 2048);
  assert.equal(r.tier, 'auto:1');
  assert.equal(applyPerfSettings(r, AUTO_LADDER[1], 'auto:1'), false);
  assert.equal(r.version, 1);
}

// --- governor -------------------------------------------------------------------------------------------
assert.equal(AUTO_LADDER[0].renderScale, 1);
assert.deepEqual(AUTO_LADDER[0].fx, { ao: true, rays: true, bloom: true, soft: true });
assert.equal(AUTO_LADDER[0].shadowMapSize, 4096);
for (let i = 1; i < AUTO_LADDER.length; i++) {
  const a = AUTO_LADDER[i - 1];
  const b = AUTO_LADDER[i];
  assert.ok(b.renderScale <= a.renderScale && b.shadowMapSize <= a.shadowMapSize && b.shadowTaps <= a.shadowTaps && b.vegLodScale <= a.vegLodScale && b.grassDensity <= a.grassDensity, `rung ${i} is not cheaper than rung ${i - 1}`);
  assert.ok(b.shadowMapSize > 0, 'shadows stay on at every rung (no recompile hitch)');
}
{
  const r = { ...defaultPerfSettings(), version: 0, tier: 'auto:0' };
  const g = new QualityGovernor(r, { window: 60 });
  let now = 0;
  const run = (n, ms) => {
    const changes = [];
    for (let i = 0; i < n; i++) {
      now += ms;
      const c = g.observe(ms, now);
      if (c) changes.push(c);
    }
    return changes;
  };
  // 59 slow frames: the window is not full, nothing happens
  assert.deepEqual(run(59, 30), []);
  assert.equal(g.rung, 0);
  // the 60th completes the window: one step down, then the refilled window (60 frames) and the
  // 2 s interval (60 × 30 ms = 1.8 s < 2 s) gate the next
  const first = run(1, 30);
  assert.equal(first.length, 1);
  assert.equal(first[0].to, 1);
  assert.equal(first[0].reason, 'slow');
  assert.equal(r.version, 1);
  assert.equal(r.shadowMapSize, 2048);
  assert.deepEqual(run(60, 30), [], 'the window refills before another step (59 frames) and the interval holds');
  const second = run(10, 30);
  assert.equal(second.length, 1, 'the next step comes once both gates are open');
  assert.equal(second[0].to, 2);
  assert.equal(r.renderScale, 0.85);
  assert.equal(r.fx.ao, false);
  // fast frames: 3 s below 11 ms (and a full window, and the interval) → one step up
  const fast = run(400, 8);
  assert.equal(fast.length, 1, 'one step up over 3.2 s of fast frames');
  assert.equal(fast[0].to, 1);
  assert.equal(fast[0].reason, 'fast');
  // a punished step up (slow again within 2 intervals) doubles the fast run the next one must earn
  const punished = run(60, 40);
  assert.equal(punished.length, 1);
  assert.equal(punished[0].to, 2);
  assert.equal(g.report().fastPenalty, 2);
  const notYet = run(400, 8);
  assert.deepEqual(notYet, [], '3.2 s of fast frames is no longer enough');
  const later = run(400, 8);
  assert.equal(later.length, 1, '6.4 s is');
  assert.equal(later[0].to, 1);
  // the floor: slow frames walk down to the last rung and stop there
  const down = run(2000, 60);
  assert.equal(g.rung, AUTO_LADDER.length - 1);
  assert.ok(down.every((c) => c.reason === 'slow'));
  for (let i = 1; i < down.length; i++) assert.ok(down[i].at - down[i - 1].at >= 2000, 'changes are at least 2 s apart');
  assert.deepEqual(run(600, 60), [], 'nothing below the floor');
  // report carries the ladder and the changes with frame indices
  const rep = g.report();
  assert.equal(rep.ladder.length, AUTO_LADDER.length);
  assert.ok(rep.changes.every((c) => typeof c.frame === 'number' && c.frame > 0));
  // invalid samples are ignored
  assert.equal(g.observe(NaN, now), null);
  assert.equal(g.observe(0, now), null);
}

console.log(JSON.stringify({ passed: true, note: 'perfFlags parse + runtime + governor contracts (CPU only)' }));
