/** Synthetic publication/state test only. No browser, game image or gauntlet evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digest } from './environment-capture-data.mjs';
import { DETAIL_SCHEMA, DETAIL_VIEWS, DETAIL_CONTROLS, loadDetailAnchors, detailPose,
  readCompletedDetails, detailsReadme } from './environment-detail-data.mjs';
import { publishEnvironmentDetails } from './publish-environment-details.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-detail-contract-test-'));
const source = 'a'.repeat(40), tree = 'b'.repeat(40), sourceHash = 'c'.repeat(64);
const identity = { source, tree, sourceHash, sourceHashFileCount: 1 };
const captureDir = path.join(tmp, 'synthetic-fixture'), remote = path.join(tmp, 'archive.git');
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  fs.mkdirSync(captureDir);
  const report = { schema: DETAIL_SCHEMA, ...identity, sourceBefore: identity, sourceAfter: identity,
    distHash: 'd'.repeat(64), distHashAfter: 'd'.repeat(64), status: 'complete',
    capturedAt: '2026-09-12T00:00:00.000Z', errors: [], restored: true,
    width: 1280, height: 720, time: 12.5, quality: 'high', hud: false, settleFrames: 2, settleDt: 0,
    controls: DETAIL_CONTROLS, anchors: loadDetailAnchors(root), views: DETAIL_VIEWS, captures: [] };
  for (const view of DETAIL_VIEWS) {
    const anchor = report.anchors.find(a => a.id === view.anchor), groundProbe = { height: 0.42 };
    const requestedPose = detailPose(view, anchor, groundProbe.height);
    const direction = requestedPose.target.map((v, i) => v - requestedPose.position[i]);
    const length = Math.hypot(...direction);
    // Deliberately labelled byte fixtures, never represented as game JPEG evidence.
    const bytes = Buffer.from(`SYNTHETIC NON-IMAGE FIXTURE: ${view.id}`), file = `${view.id}.jpg`;
    fs.writeFileSync(path.join(captureDir, file), bytes);
    const depth = { width: 80, height: 45, data: Array(3600).fill(2.5) };
    report.captures.push({ source, viewpoint: view.id, file, sha256: digest(bytes), requestedPose, groundProbe,
      state: { camera: { position: requestedPose.position, direction: direction.map(v => v / length), fov: requestedPose.fov },
        stats: { simTime: 12.5, width: 1280, height: 720 }, controls: DETAIL_CONTROLS,
        audit: { systemFailures: [], scene: { forbidden: [] }, systems: { atmosphere: {
          postfx: { effectiveSettingsRendered: true, effectiveSettings: {} } } } } },
      retries: 0, depth: { ...depth, sha256: digest(JSON.stringify(depth)) } });
  }
  const save = value => fs.writeFileSync(path.join(captureDir, 'details.json'), JSON.stringify(value));
  save(report); fs.writeFileSync(path.join(captureDir, 'README.md'), detailsReadme(report));
  readCompletedDetails(captureDir, source);
  for (const mutate of [r => { r.sourceAfter.source = 'e'.repeat(40); },
    r => { r.captures[0].state.camera.position[0] += 0.1; },
    r => { r.captures[0].state.controls.light = { sunIntensity: 9 }; },
    r => { r.captures[0].depth.data[0] = 8; },
    r => { r.captures[0].state.stats.simTime += 0.1; },
    r => { r.captures[1].viewpoint = r.captures[0].viewpoint; }]) {
    const altered = JSON.parse(JSON.stringify(report)); mutate(altered); save(altered);
    assert.throws(() => readCompletedDetails(captureDir, source));
  }
  save(report);
  const firstImage = path.join(captureDir, report.captures[0].file), original = fs.readFileSync(firstImage);
  fs.appendFileSync(firstImage, 'tampered');
  assert.throws(() => readCompletedDetails(captureDir, source)); fs.writeFileSync(firstImage, original);
  assert.throws(() => readCompletedDetails(captureDir, 'e'.repeat(40)));

  // A local bare repository exercises real non-force publication and historical preservation.
  git(tmp, ['init', '--bare', remote]);
  const seed = path.join(tmp, 'seed'); fs.mkdirSync(seed);
  git(seed, ['init', '--initial-branch', 'captures/astra-environment']);
  git(seed, ['config', 'user.name', 'Synthetic test']); git(seed, ['config', 'user.email', 'test@example.invalid']);
  fs.mkdirSync(path.join(seed, 'progress', 'historical'), { recursive: true });
  fs.writeFileSync(path.join(seed, 'progress', 'historical', 'sentinel'), 'Previous comparison bytes must survive.');
  fs.writeFileSync(path.join(seed, 'README.md'), '# Existing comparison archive\n');
  git(seed, ['add', '.']); git(seed, ['commit', '-m', 'Synthetic historical archive']);
  git(seed, ['push', remote, 'HEAD:refs/heads/captures/astra-environment']);
  const old = git(seed, ['rev-parse', 'HEAD']);
  const one = await publishEnvironmentDetails({ captureDir, remote, source, temporaryRoot: tmp });
  assert.equal(one.changed, true); assert(one.folder.startsWith('details/'));
  assert.equal(git(remote, ['rev-parse', `${one.head}^`]), old);
  assert.equal(git(remote, ['show', `${one.head}:progress/historical/sentinel`]), 'Previous comparison bytes must survive.');
  const treeBefore = git(remote, ['ls-tree', '-r', one.head, one.folder]);
  const two = await publishEnvironmentDetails({ captureDir, remote, source, temporaryRoot: tmp });
  assert.equal(two.changed, false); assert.equal(two.head, one.head);
  assert.equal(git(remote, ['ls-tree', '-r', two.head, one.folder]), treeBefore);
  // A different otherwise-valid report may not replace the same dated checkpoint.
  const collision = JSON.parse(JSON.stringify(report)); collision.fixtureNote = 'different bytes, identical folder';
  save(collision);
  await assert.rejects(publishEnvironmentDetails({ captureDir, remote, source, temporaryRoot: tmp }), /Historical bytes differ/);
  assert.equal(git(remote, ['rev-parse', 'refs/heads/captures/astra-environment']), one.head);
  console.log('Detail contract: wrong source/camera/time/controls/depth/image bytes rejected; archive append and idempotence preserve existing comparison history. Synthetic test only.');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
