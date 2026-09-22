// Reuse the published PR29 tree worker and native records; this check does not render.
// node verify.mjs <candidate-ref> <bank-evidence-directory> [geometry-worker-output.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const [ref, evidenceDir, suppliedGeometryFile] = process.argv.slice(2);
assert(ref && evidenceDir, 'Pass candidate ref and existing PR29 evidence directory');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const candidate = git('rev-parse', ref), base = git('rev-parse', `${ref}^`);
const geometryFile = suppliedGeometryFile ?? path.join(here, 'geometry-local.json');
if (!suppliedGeometryFile) {
  const output = cp.execFileSync(process.execPath, ['--expose-gc', '--max-old-space-size=4096', path.join(evidenceDir, 'check-geometry.mjs'), '--worker', candidate, '1'], { cwd: root, maxBuffer: 32000000, stdio: ['ignore', 'pipe', 'inherit'] });
  fs.writeFileSync(geometryFile, output);
}
const sourcePath = 'src/world/trees/index.ts';
const beforeSource = git('show', `${base}:${sourcePath}`);
const afterSource = git('show', `${candidate}:${sourcePath}`);
const expression = source => {
  const matches = [...source.matchAll(/^\s*foldedTriangles: (.+),$/gm)];
  assert.equal(matches.length, 1);
  return matches[0][1];
};
const beforeExpression = expression(beforeSource), afterExpression = expression(afterSource);
assert.equal(git('diff', '--name-only', base, candidate, '--', 'src'), sourcePath);
assert.equal(afterSource.replace(afterExpression, beforeExpression), beforeSource, 'Only the audit expression changed');

const actual = read(geometryFile), expected = read(path.join(evidenceDir, 'reviewed-geometry.json'));
assert.equal(actual.ref, candidate);
assert.deepEqual(actual.context, expected.context);
assert.deepEqual(actual.summary, expected.summary, 'Full tree geometry, materials, shadows and placements unchanged');
const groups = actual.assets.find(a => a.input.def?.id === 'stair-bank-giant').bankProof.groups.map(({ coreIds, ...g }) => g);
assert.deepEqual(groups, expected.groups, 'Selected floor/wind/envelope/attachment proof unchanged');

const persistent = actual.placementBinding.nearCanopies.filter(p => p.persistent);
assert.deepEqual(persistent.map(p => p.id), [24, 25, 26].map(i => `stair-bank-giant/lobe-${i}`));
const pair = Object.fromEntries(['before', 'after'].map(label => [label, read(path.join(evidenceDir, 'native-pair', label, 'manifest.json'))]));
const evaluate = (expr, rows) => new Function('nearCanopies', `return ${expr}`)(rows);
const cases = {};
for (const id of ['F_canopy', 'C_lookback']) {
  const captured = pair.after.images[id].trees.nearCanopy;
  const shown = new Set(captured.shown.map(row => row[0]));
  const rows = actual.placementBinding.nearCanopies.map(p => ({ ...p, mesh: { visible: shown.has(p.id) } }));
  const previous = evaluate(beforeExpression, rows), corrected = evaluate(afterExpression, rows);
  assert.equal(previous, captured.foldedTriangles, 'Reproduce the original native audit');
  assert.equal(corrected, pair.before.images[id].trees.nearCanopy.foldedTriangles, 'Retained far geometry contributes no folding');
  assert.equal(previous - corrected, 7186);
  assert.equal(evaluate(afterExpression, rows.filter(p => p.persistent)), 0);
  assert.equal(evaluate(afterExpression, rows.map(p => ({ ...p, mesh: { visible: false } }))), 0);
  cases[id] = { capturedBeforeAuditFix: previous, correctedOnRecordedVisibility: corrected, removedOvercount: previous - corrected, shownTrianglesUnchanged: captured.shownTriangles };
}
const report = {
  verdict: 'PASS', candidate, base, sourcePath, productionDiff: 'one audit predicate; no visual code',
  fullTreeSummary: actual.summary, cases,
  persistent: persistent.map(({ id, farLeaves, farCards }) => ({ id, farLeaves, farCards })),
  inputs: { geometryWorkerOutputSha256: sha(fs.readFileSync(geometryFile)), reviewedFixtureSha256: sha(fs.readFileSync(path.join(evidenceDir, 'reviewed-geometry.json'))), nativeManifestHashes: Object.fromEntries(['before', 'after'].map(label => [label, sha(fs.readFileSync(path.join(evidenceDir, 'native-pair', label, 'manifest.json')))])) },
  limits: ['CPU source/geometry parity and audit reevaluation on existing matched native visibility only; no new GPU capture.', 'Existing bank gap/coverage feedback remains separate and unresolved by this accounting change.'],
};
fs.writeFileSync(path.join(here, 'proof.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ verdict: report.verdict, candidate, cases, fullTreeSummary: actual.summary }, null, 2));
