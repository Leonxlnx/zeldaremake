/** Tiny CPU repro using lodPool.test.mjs's transpile/fake-clock/fake-item pattern. No source edits. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const file = path.join(root, 'src/world/trees/lodPool.ts');
const source = fs.readFileSync(file, 'utf8');
function compile(text) {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(module, module.exports);
  return module.exports.LodPool;
}
const clock = () => {
  let t = 0;
  const now = () => t;
  now.advance = ms => { t += ms; };
  return now;
};
const fakeItem = (id, bytes, log, now) => ({
  id, bytes,
  build: function* () { log.push(`start ${id}`); now.advance(1); yield; return { bytes, dispose: () => log.push(`dispose ${id}`) }; },
  install: () => log.push(`install ${id}`), uninstall: () => log.push(`uninstall ${id}`),
});
function pausedBuild(Pool, pinResident, pending = false) {
  const now = clock(), log = [], pool = new Pool(100, now);
  const a = fakeItem('near-resident', 60, log, now), b = fakeItem('paused-build', 60, log, now), c = fakeItem('fitting-pending', 40, log, now);
  pool.add(a, { bytes: 60, dispose() {} }); pool.add(b); if (pending) pool.add(c);
  pool.begin(); pool.want(a, 20); pool.want(b, 10); pool.work(1);
  assert.equal(pool.report().building, 1); assert.equal(pool.poolBytes, 60);
  pool.begin(); if (pinResident) pool.pin(a); else pool.want(a, 5); pool.want(b, 10); if (pending) pool.want(c, 2);
  pool.work(1);
  return { pool, now, log, a, b, c };
}
const Original = compile(source);
const observed = [];
for (const pinResident of [false, true]) {
  const { pool, log } = pausedBuild(Original, pinResident);
  assert.equal(pool.poolBytes, 120, 'Frozen implementation must reproduce over-admission');
  assert(pool.report().pinnedBytes < pool.capBytes);
  observed.push({ change: pinResident ? 'resident becomes pinned' : 'resident gets nearer priority', report: pool.report(), log });
}

// Concept only: resume only currently fitting builds, and let fitting pending work bypass a blocked generator.
const gate = 'if (s.built || !s.wanted) continue;';
assert.equal(source.split(gate).length, 2);
const SchedulerConcept = compile(source.replace(gate, 'if (s.built || !s.wanted || !this.canFit(s)) continue;'));
for (const pinResident of [false, true]) {
  const { pool } = pausedBuild(SchedulerConcept, pinResident);
  assert.equal(pool.poolBytes, 60); assert.equal(pool.report().building, 1, 'Blocked generator remains paused');
}
const fitting = pausedBuild(SchedulerConcept, false, true);
fitting.pool.begin(); fitting.pool.want(fitting.a, 5); fitting.pool.want(fitting.b, 10); fitting.pool.want(fitting.c, 2); fitting.pool.work(1);
assert.deepEqual(fitting.pool.resident(), ['near-resident', 'fitting-pending'], 'Blocked builder must not starve fitting pending work');
assert.equal(fitting.pool.poolBytes, 100);
fitting.pool.begin(); fitting.pool.want(fitting.a, 20); fitting.pool.want(fitting.b, 10); fitting.pool.want(fitting.c, 2); fitting.pool.work(1);
assert.deepEqual(fitting.pool.resident(), ['paused-build', 'fitting-pending']);
assert.equal(fitting.log.filter(s => s === 'start paused-build').length, 1, 'The paused generator resumes without restarting');

// Independent ordering hazard: a cold pin can evict a resident selected later in the same loop.
function pinOrder(protectResidentFirst) {
  const now = clock(), log = [], pool = new Original(100, now);
  const a = fakeItem('selected-resident', 60, log, now), b = fakeItem('cold-selected', 40, log, now), other = fakeItem('cache', 40, log, now);
  pool.add(a, { bytes: 60, dispose() {} }); pool.add(other, { bytes: 40, dispose() {} }); pool.add(b);
  pool.begin(); pool.want(a, 30); pool.want(other, 5); pool.want(b, 10);
  if (protectResidentFirst) pool.pin(a);
  pool.pin(b); pool.pin(a);
  assert.equal(pool.poolBytes, 100);
  return { syncBuilds: pool.report().syncBuilds, log };
}
const greedyPins = pinOrder(false), protectedPins = pinOrder(true);
assert.equal(greedyPins.syncBuilds, 2); assert.equal(protectedPins.syncBuilds, 1);

const trace = JSON.parse(fs.readFileSync(path.join(root, 'art/environment/astra-distance-combined/native-after/trace.json')));
const events = trace.passes.map(pass => {
  let prior = pass.start.pool.nearCanopyPool;
  const rows = pass.rows.flatMap(row => {
    const pool = row.pool.nearCanopyPool;
    const event = { k: row.k, phase: row.phase, bytes: pool.poolBytes, pinnedBytes: pool.pinnedBytes,
      overflow: pool.poolBytes - pool.capBytes, builds: pool.built - prior.built, syncBuilds: pool.syncBuilds - prior.syncBuilds,
      evictions: pool.evicted - prior.evicted, building: pool.building, variants: row.meshes.map(mesh => mesh.name) };
    prior = pool;
    return event.overflow > 0 || event.syncBuilds ? [event] : [];
  });
  for (const row of rows.filter(r => r.overflow > 0)) {
    assert(row.pinnedBytes < 67108864); assert.equal(row.builds, 1); assert.equal(row.syncBuilds, 0); assert.equal(row.building, 0);
  }
  return { pass: pass.name, rows };
});
console.log(JSON.stringify({ sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), observed,
  schedulerConcept: 'In-memory only; cap holds, blocked generator pauses, fitting pending work progresses, paused work resumes once priorities allow.',
  pinOrdering: { greedyPins, protectedPins }, traceEvents: events,
  limits: 'Trace has aggregate pool counters, not item-level build/eviction identities. Matching failure shape establishes the generic defect, not which exact asset overflowed. Scheduler check uses known byte counts; underestimated results still require a final admission guard.' }, null, 2));
