/** Supplemental production detail views; separate from saved gauntlet/comparison cameras. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { digest, readJson, assertRenderedControls } from './environment-capture-data.mjs';

export const DETAIL_SCHEMA = 'zeldaremake.environment-details.v1';
export const DETAIL_CONTROLS = { light: null, post: null };
// Offsets are metres along the object's facing, right side, and above its sampled foot.
// A fixed definition makes successive source checkpoints directly inspectable.
export const DETAIL_VIEWS = [
  { id: 'S01-sign-front', label: 'Sign front — boards, grain and carved marks', anchor: 'saria-sign', eye: [2.4, 0, 1.3], aim: [0.06, 0, 1.08], fov: 34 },
  { id: 'S02-sign-oblique', label: 'Sign oblique — board edges, pegs and binding', anchor: 'saria-sign', eye: [2.25, 1.65, 1.42], aim: [0, 0, 0.98], fov: 40 },
  { id: 'L01-stair-foot-bindings', label: 'Stair-foot lantern — rope binding and suspension', anchor: 'stair-foot', eye: [1.6, 1.55, 2.38], aim: [0.18, 0, 2.23], fov: 34 },
  { id: 'L02-fork-west-lantern', label: 'Fork-west lantern — whole post and ground contact', anchor: 'fork-west', eye: [3.2, -0.85, 1.72], aim: [0.18, 0, 1.35], fov: 46 },
];

/** Read the actual authored layout without a production API/asset/layout modification. */
export function loadDetailAnchors(root) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'src/world/layout.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.equal(name, 'three', 'Detail layout loader only permits the existing Three dependency');
    return THREE;
  }, module, module.exports);
  const { LAYOUT, LANTERN_POSTS } = module.exports;
  const sign = LAYOUT.signposts.find(v => v.id === 'saria-sign');
  assert(sign, 'Authored sign exists');
  return [{ id: sign.id, position: [sign.position[0], sign.position[2]], facing: sign.facing },
    ...['stair-foot', 'fork-west'].map(id => {
      const post = LANTERN_POSTS.find(v => v.id === id); assert(post, `Authored lantern exists: ${id}`);
      return { id: post.id, position: post.position, facing: post.facing, height: post.height };
    })];
}

export function detailPose(view, anchor, groundHeight) {
  assert.equal(view.anchor, anchor.id); assert(Number.isFinite(groundHeight));
  assert(anchor.position.length === 2 && anchor.position.every(Number.isFinite));
  assert(anchor.facing.length === 2 && anchor.facing.every(Number.isFinite));
  const length = Math.hypot(...anchor.facing); assert(length > 0);
  const [fx, fz] = anchor.facing.map(v => v / length);
  const world = ([forward, side, up]) => [anchor.position[0] + fx * forward + fz * side,
    groundHeight + up, anchor.position[1] + fz * forward - fx * side];
  return { position: world(view.eye), target: world(view.aim), fov: view.fov };
}

export function assertDetailCamera(actual, requested) {
  assert.deepEqual(actual.position, requested.position); assert.equal(actual.fov, requested.fov);
  const d = requested.target.map((v, i) => v - requested.position[i]);
  const length = Math.hypot(...d); assert(length > 0); assert.equal(actual.direction.length, 3);
  d.forEach((v, i) => assert(Math.abs(actual.direction[i] - v / length) < 1e-10, 'Rendered detail camera direction'));
}

export function readCompletedDetails(directory, expectedSource) {
  const report = readJson(path.join(directory, 'details.json'));
  assert.equal(report.schema, DETAIL_SCHEMA); assert.equal(report.status, 'complete');
  assert.match(report.source, /^[a-f0-9]{40}$/);
  if (expectedSource) assert.equal(report.source, expectedSource, 'Published source must equal requested source');
  assert.match(report.tree, /^[a-f0-9]{40}$/); assert.match(report.sourceHash, /^[a-f0-9]{64}$/);
  for (const key of ['source', 'tree', 'sourceHash', 'sourceHashFileCount']) assert.equal(report[key], report.sourceBefore[key]);
  assert.deepEqual(report.sourceAfter, report.sourceBefore);
  assert.match(report.distHash, /^[a-f0-9]{64}$/); assert.equal(report.distHashAfter, report.distHash);
  assert(Number.isFinite(Date.parse(report.capturedAt)));
  assert.deepEqual(report.errors, []); assert.equal(report.restored, true);
  assert.equal(report.width, 1280); assert.equal(report.height, 720); assert.equal(report.time, 12.5);
  assert.equal(report.quality, 'high'); assert.equal(report.hud, false);
  assert.equal(report.settleFrames, 2); assert.equal(report.settleDt, 0);
  assert.deepEqual(report.controls, DETAIL_CONTROLS); assert.deepEqual(report.views, DETAIL_VIEWS);
  assert.equal(report.captures.length, DETAIL_VIEWS.length);
  for (const view of DETAIL_VIEWS) {
    const found = report.captures.filter(c => c.viewpoint === view.id); assert.equal(found.length, 1);
    const capture = found[0], anchors = report.anchors.filter(a => a.id === view.anchor); assert.equal(anchors.length, 1);
    assert.equal(capture.file, `${view.id}.jpg`); assert.equal(capture.source, report.source);
    assert.equal(capture.sha256, digest(fs.readFileSync(path.join(directory, capture.file))), `${capture.file} bytes`);
    assert.deepEqual(capture.requestedPose, detailPose(view, anchors[0], capture.groundProbe.height));
    assertDetailCamera(capture.state.camera, capture.requestedPose);
    assert.equal(capture.state.stats.simTime, report.time);
    assert.equal(capture.state.stats.width, report.width); assert.equal(capture.state.stats.height, report.height);
    assert.deepEqual(capture.state.audit.systemFailures, []);
    assert.deepEqual(capture.state.audit.scene.forbidden, []);
    assert.deepEqual(capture.state.controls, DETAIL_CONTROLS);
    assertRenderedControls(capture.state.audit, DETAIL_CONTROLS);
    assert(Number.isInteger(capture.retries) && capture.retries >= 0 && capture.retries <= 3);
    const depth = capture.depth;
    assert.equal(depth.width, 80); assert.equal(depth.height, 45); assert.equal(depth.data.length, 3600);
    assert(depth.data.every(v => v === null || (Number.isFinite(v) && v >= 0)));
    assert.equal(depth.sha256, digest(JSON.stringify({ width: depth.width, height: depth.height, data: depth.data })));
  }
  const files = fs.readdirSync(directory, { withFileTypes: true });
  assert(files.every(f => f.isFile()), 'Only regular files in completed detail bundle');
  assert.deepEqual(files.map(f => f.name).sort(), [...DETAIL_VIEWS.map(v => `${v.id}.jpg`), 'details.json', 'README.md'].sort());
  return report;
}

export function detailsReadme(report) {
  const lines = ['# World detail views', '', `Four actual game renders from [${report.source.slice(0, 7)}](https://github.com/Leonxlnx/zeldaremake/commit/${report.source}), captured ${report.capturedAt}.`, '',
    'The complete production scene is rendered at 1280×720, quality high, HUD hidden, scene time 12.5 s. No light/post overrides, hidden objects, alternate detail assets or generated scenery are used. Camera offsets are fixed against the authored layout and actual terrain probes; requested and rendered poses, full audits, depth and source hashes are recorded in details.json.', '',
    'These closeups supplement the twelve environment comparison images. They are not saved reference cameras, gauntlet takes, scores or approval of visual quality. Image framing and occlusion still require human review.', ''];
  for (const view of DETAIL_VIEWS) lines.push(`## ${view.label}`, '', `![${view.label}](${view.id}.jpg)`, '');
  return lines.join('\n');
}
