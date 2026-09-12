/** Strict validation for immutable full-scene motion bundles, not a visual quality verdict. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { digest, readJson, assertRenderedControls, assertStableCaptureState } from './environment-capture-data.mjs';
import { assertDetailCamera } from './environment-detail-data.mjs';
import { SWEEP_SCHEMA, SWEEP_CONTROLS, SWEEP_TIME } from './environment-hedge-sweep-data.mjs';

export async function readCompletedHedgeSweep(directory, expected) {
  const files = fs.readdirSync(directory, { withFileTypes: true });
  assert(files.every(f => f.isFile()), 'Only regular files in a sweep bundle');
  const report = readJson(path.join(directory, 'sweep.json'));
  assert.equal(report.schema, SWEEP_SCHEMA); assert.equal(report.status, 'complete');
  assert.match(expected.identity.source, /^[a-f0-9]{40}$/); assert.match(expected.identity.tree, /^[a-f0-9]{40}$/);
  assert.match(expected.identity.sourceHash, /^[a-f0-9]{64}$/);
  assert(Number.isInteger(expected.identity.sourceHashFileCount) && expected.identity.sourceHashFileCount > 0);
  for (const key of ['source', 'tree', 'sourceHash', 'sourceHashFileCount']) assert.equal(report[key], expected.identity[key], `Current committed ${key}`);
  assert.deepEqual(report.sourceBefore, expected.identity); assert.deepEqual(report.sourceAfter, expected.identity);
  assert.match(expected.distHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(report.distHash, expected.distHash); assert.equal(report.distHashAfter, expected.distHash);
  assert(Number.isFinite(Date.parse(report.startedAt))); assert(Number.isFinite(Date.parse(report.capturedAt)));
  assert(Date.parse(report.capturedAt) >= Date.parse(report.startedAt));
  assert.deepEqual(report.errors, []); assert(Array.isArray(report.warnings)); assert.equal(report.restored, true);
  assert.equal(report.width, 1280); assert.equal(report.height, 720); assert.equal(report.time, SWEEP_TIME);
  assert.equal(report.quality, 'high'); assert.equal(report.hud, false); assert.equal(report.settleFrames, 2); assert.equal(report.settleDt, 0);
  assert.deepEqual(report.controls, SWEEP_CONTROLS); assert.deepEqual(report.plan, expected.plan, 'Plan matches current source-derived roots and thresholds');
  assert.equal(report.plan.frames.length, 11); assert.equal(new Set(report.plan.frames.map(f => f.id)).size, 11);
  assert(report.frames.length >= 11 && report.frames.length <= 44);
  const names = [], ordered = [], accepted = []; let lighting;
  for (const [index, pose] of report.plan.frames.entries()) {
    assert.equal(pose.id, `H${String(index + 1).padStart(2, '0')}-${index < 6 ? 'in' : 'out'}`);
    const attempts = report.frames.filter(f => f.id === pose.id); assert(attempts.length >= 1 && attempts.length <= 4);
    for (const [attempt, frame] of attempts.entries()) {
      assert.equal(frame.attempt, attempt); assert.equal(frame.file, `${pose.id}-attempt${attempt}.png`);
      assert.equal(frame.source, report.source); assert.deepEqual(frame.requestedPose, pose);
      assert.equal(frame.accepted, attempt === attempts.length - 1, 'Only the final attempt is accepted');
      names.push(frame.file); ordered.push(frame); const bytes = fs.readFileSync(path.join(directory, frame.file));
      assert.equal(frame.bytes, bytes.length); assert.equal(frame.sha256, digest(bytes), `${frame.file}: original hash`);
      const metadata = await sharp(bytes).metadata(); assert.equal(metadata.format, 'png');
      assert.equal(metadata.width, 1280); assert.equal(metadata.height, 720); assert.equal(metadata.pages ?? 1, 1);
      const deviation = Math.max(...(await sharp(bytes).stats()).channels.slice(0, 3).map(c => c.stdev));
      assert.equal(frame.maxRgbStdDev, deviation); assert.equal(deviation > 2, frame.accepted);
      const memory = assertStableCaptureState(frame.before, frame.state, `${frame.file}: screenshot state`);
      assert.deepEqual(frame.memoryObservation, memory);
      for (const s of [frame.before, frame.state]) {
        assertDetailCamera(s.camera, pose); assert.equal(s.stats.simTime, SWEEP_TIME);
        assert.equal(s.stats.width, 1280); assert.equal(s.stats.height, 720);
        assert.deepEqual(s.audit.systemFailures, []); assert.deepEqual(s.audit.scene.forbidden, []);
        assert.equal(s.audit.systems.vegetation.hedge, 12); assert.deepEqual(s.controls, SWEEP_CONTROLS);
        assertRenderedControls(s.audit, SWEEP_CONTROLS);
        const light = { light: s.audit.systems.lighting, post: s.audit.systems.atmosphere.postfx.effectiveSettings };
        assert(light.light && typeof light.light === 'object');
        if (lighting) assert.deepEqual(light, lighting, 'Frozen actual lighting/composer settings'); else lighting = light;
      }
      if (attempt) assertStableCaptureState(attempts[attempt - 1].state, frame.before, `${frame.file}: retry changed state`);
      if (!frame.accepted) continue;
      accepted.push(frame); const depth = frame.depth;
      assert.equal(depth.width, 80); assert.equal(depth.height, 45); assert.equal(depth.data.length, 3600);
      assert(depth.data.every(v => v === null || Number.isFinite(v) && v >= 0));
      assert.equal(depth.sha256, digest(JSON.stringify({ width: depth.width, height: depth.height, data: depth.data })));
      assert.equal(frame.depthReadStats.simTime, SWEEP_TIME);
      const targets = report.plan.anchors.flatMap(a => [.8, 1.2, 1.6].map(up => [a.root[0], a.root[1] + up, a.root[2]]));
      assert.deepEqual(frame.targetPoints, targets); assert.equal(frame.targetProjection.length, targets.length);
      assert(frame.targetProjection.every(p => p === null || Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)));
    }
  }
  assert.deepEqual(ordered, report.frames, 'Capture order and complete attempt sequence');
  assert.equal(accepted.length, 11); assert.equal(new Set(names).size, names.length);
  assert.deepEqual(files.map(f => f.name).sort(), [...names, 'sweep.json', 'README.md'].sort());
  const repeated = Array.from({ length: 5 }, (_, i) => { const a = accepted[i], b = accepted[10 - i];
    assert.deepEqual(a.state.camera, b.state.camera);
    return { forward: a.id, return: b.id, pngEqual: a.sha256 === b.sha256, depthEqual: a.depth.sha256 === b.depth.sha256,
      auditEqual: digest(JSON.stringify(a.state.audit)) === digest(JSON.stringify(b.state.audit)) }; });
  assert.deepEqual(report.repeatedPoses, repeated, 'Return-pose findings are retained honestly');
  return report;
}
