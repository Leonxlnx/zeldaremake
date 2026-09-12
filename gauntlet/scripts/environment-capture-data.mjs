/** Data contract for supplemental environment comparisons; never writes a gauntlet take. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Color } from 'three';

export const SCHEMA = 'zeldaremake.environment-comparison.v1';
export const VIEWS = ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy'];
export const CASES = ['baseline', 'candidate'];
export const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const imageName = (view, variant) => `${view}-${variant}.jpg`;
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function assertRenderedControls(audit, controls) {
  for (const key of ['sunIntensity', 'hemiIntensity', 'environmentIntensity']) if (controls.light?.[key] !== undefined) assert.equal(audit.systems.lighting[key], controls.light[key]);
  if (controls.light?.shadowRadius !== undefined) assert.equal(audit.systems.lighting.shadowRadiusTexels, controls.light.shadowRadius);
  for (const [key, field] of [['hemiSky', 'hemiSkyLinear'], ['hemiGround', 'hemiGroundLinear']]) if (controls.light?.[key] !== undefined) {
    assert.deepEqual(audit.systems.lighting[field], new Color(controls.light[key]).toArray().map(v => Math.round(v * 1000) / 1000));
  }
  const post = audit.systems.atmosphere.postfx;
  assert.equal(post.effectiveSettingsRendered, true, 'Composer has rendered its recorded settings');
  for (const [key, value] of Object.entries(controls.post ?? {})) assert.equal(post.effectiveSettings[key], value, `Rendered post setting: ${key}`);
}

export function validateVariants(value, root) {
  assert.equal(value.schema, 'zeldaremake.environment-variants.v1');
  assert.match(value.baselineSource, /^[a-f0-9]{40}$/);
  assert.equal(value.time, 12.5, 'Comparison scene time is fixed at 12.5 seconds');
  const iface = fs.readFileSync(path.join(root, 'src/world/postfx/composer.ts'), 'utf8')
    .match(/export interface ComposerSettings \{([\s\S]*?)\n\}/)?.[1];
  assert(iface, 'Current ComposerSettings interface found');
  const postTypes = Object.fromEntries([...iface.matchAll(/^\s*(\w+): (number|boolean);/gm)].map(m => [m[1], m[2]]));
  const lightKeys = ['sunIntensity', 'hemiIntensity', 'environmentIntensity', 'shadowRadius', 'hemiSky', 'hemiGround'];
  for (const id of CASES) {
    const variant = value[id];
    assert(variant && typeof variant.label === 'string' && variant.label.length > 0 && variant.label.length < 180);
    for (const kind of ['light', 'post']) {
      const controls = variant[kind];
      assert(controls === null || (typeof controls === 'object' && !Array.isArray(controls)));
      for (const [key, v] of Object.entries(controls ?? {})) {
        const type = kind === 'light' ? (lightKeys.includes(key) ? 'number' : null) : postTypes[key];
        assert(type, `Unknown or unsupported ${kind} hook: ${key}`);
        assert.equal(typeof v, type, `${kind}.${key}`);
        if (type === 'number') assert(Number.isFinite(v), `${kind}.${key} must be finite`);
        if (kind === 'light') {
          assert(v >= 0, `${key} must be nonnegative`);
          if (key.startsWith('hemi') && key !== 'hemiIntensity') assert(Number.isInteger(v) && v <= 0xffffff, `${key} is an sRGB hex integer`);
        }
      }
    }
  }
  return value;
}

export function sourceIdentity(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const source = git(['rev-parse', 'HEAD']);
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all']).replace(/^\?\? node_modules\/?$/gm, '').trim(), '', 'Capture requires a clean committed checkout');
  const files = git(['ls-files', 'src', 'public', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'gauntlet/scripts', '.github/workflows/astra-environment.yml']).split('\n').filter(Boolean).sort();
  const sourceHash = digest(files.map(name => `${name}\0${digest(fs.readFileSync(path.join(root, name)))}\n`).join(''));
  return { source, tree: git(['rev-parse', 'HEAD^{tree}']), sourceHash, sourceHashFileCount: files.length };
}

export function readCompletedComparison(directory, expectedSource) {
  const report = readJson(path.join(directory, 'environment.json'));
  assert.equal(report.schema, SCHEMA); assert.equal(report.status, 'complete');
  assert.match(report.source, /^[a-f0-9]{40}$/);
  if (expectedSource) assert.equal(report.source, expectedSource, 'Published source must equal requested source');
  assert.match(report.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(report.sourceBefore.source, report.source); assert.equal(report.sourceBefore.sourceHash, report.sourceHash);
  assert.deepEqual(report.sourceAfter, report.sourceBefore);
  assert.equal(report.distHashAfter, report.distHash);
  assert(Number.isFinite(Date.parse(report.capturedAt)));
  assert.deepEqual(report.errors, []); assert.equal(report.restored, true);
  assert.equal(report.width, 1280); assert.equal(report.height, 720); assert.equal(report.time, 12.5);
  assert.equal(report.captures.length, VIEWS.length * CASES.length);
  const names = [];
  for (const view of VIEWS) {
    let baseline;
    for (const variant of CASES) {
      const found = report.captures.filter(c => c.viewpoint === view && c.variant === variant);
      assert.equal(found.length, 1, `${view}/${variant} appears exactly once`);
      const capture = found[0]; const name = imageName(view, variant); names.push(name);
      assert.equal(capture.file, name); assert.equal(capture.source, report.source);
      assert.equal(capture.sha256, digest(fs.readFileSync(path.join(directory, name))), `${name} bytes`);
      assert.equal(capture.state.stats.simTime, report.time);
      assert.deepEqual(capture.state.audit.systemFailures, []);
      assert(Number.isInteger(capture.retries) && capture.retries >= 0 && capture.retries <= 3);
      assert.deepEqual(capture.state.controls, { light: report.variants[variant].light, post: report.variants[variant].post });
      assertRenderedControls(capture.state.audit, report.variants[variant]);
      assert.equal(capture.depth.width, 80); assert.equal(capture.depth.height, 45); assert.equal(capture.depth.data.length, 3600);
      assert(capture.depth.data.every(v => v === null || (Number.isFinite(v) && v >= 0)));
      assert.equal(capture.depth.sha256, digest(JSON.stringify({ width: capture.depth.width, height: capture.depth.height, data: capture.depth.data })));
      if (baseline) {
        assert.deepEqual(capture.state.camera, baseline.state.camera);
        assert.deepEqual(capture.geometryState, baseline.geometryState);
        assert.equal(capture.depth.sha256, baseline.depth.sha256);
      } else baseline = capture;
    }
  }
  const files = fs.readdirSync(directory, { withFileTypes: true });
  assert(files.every(f => f.isFile()), 'Only regular files in completed bundle');
  assert.deepEqual(files.map(f => f.name).sort(), [...names, 'environment.json', 'README.md'].sort());
  return report;
}

export function comparisonReadme(report) {
  const lines = ['# Environment lighting comparison', '', `Actual game renders from [${report.source.slice(0, 7)}](https://github.com/Leonxlnx/zeldaremake/commit/${report.source}), captured ${report.capturedAt}.`, '',
    'Both columns use this same built source, saved camera, scene time (12.5 s), geometry and fog. The baseline is a set of historical light/post controls, not a render of a separate historical build. Candidate controls are listed in environment.json. This supplemental study does not score or replace the locked gauntlet.', '',
    `Baseline controls attributed to source: ${report.variants.baselineSource}.`, '',
    `Baseline: ${report.variants.baseline.label}. Candidate: ${report.variants.candidate.label}.`, '',
    'Raw audits and requested controls are retained. Requested overrides are checked against the actual light objects and composer settings used by the last render; this is not an independent GPU measurement of irradiance or color.', ''];
  for (const view of VIEWS) lines.push(`## ${view}`, '', '| Baseline | Candidate |', '| --- | --- |', `| ![${view} baseline](${imageName(view, 'baseline')}) | ![${view} candidate](${imageName(view, 'candidate')}) |`, '');
  return lines.join('\n');
}
