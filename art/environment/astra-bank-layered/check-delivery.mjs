// Final-source invariant check. No GPU and no reviewed private Git ref is required.
// Run after applying the source commit: node art/environment/astra-bank-layered/check-delivery.mjs HEAD [output.json]
// Requires check-geometry.mjs, inspect-layered.mjs and reviewed-geometry.json alongside this file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const dir = path.dirname(fileURLToPath(import.meta.url)), cwd = path.resolve(dir, '../../..');
const git = (...args) => cp.execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16000000 }).trimEnd();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'reviewed-geometry.json')));
const ref = process.argv[2] ?? 'HEAD', candidate = git('rev-parse', ref);
const paths = ['src/world/trees/giant.ts', 'src/world/trees/index.ts', 'src/world/trees/nearCanopy.ts'];
const sourceBindings = {};
for (const file of paths) {
  const source = git('show', `${candidate}:${file}`).replaceAll('\r\n', '\n') + '\n';
  assert(!source.includes('VITE_BANK_LAYERED_CORE'), `No trial flag in ${file}`);
  assert(!/\bprototype\b/i.test(source), `No prototype wording in ${file}`);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText;
  assert.equal(sha(code), expected.reviewedTrueBranchCodeSha256[file], `Exact reviewed true-branch code: ${file}`);
  sourceBindings[file] = sha(source);
}
const index = git('show', `${candidate}:src/world/trees/index.ts`);
assert.equal((index.match(/layeredCore: \{ leaves:/g) ?? []).length, 3, 'Exactly three authored selectors');
for (const record of ['center: [11.2, 3.4, 3.7]', 'center: [10.4, 3.4, 5.9]', 'center: [11.6, 5.5, 1.6]']) {
  const line = index.split('\n').find(line => line.includes(record) && line.includes('layeredCore:'));
  assert(line?.includes('corridors: false') && line.includes('castShadow: false') && line.includes('flat: true'));
}
assert(index.includes('floor: 4.75, layeredCore: { leaves: 2200, twigs: 32 }'));

// Rebuild the complete tree graph with inert materials. All geometry attributes, indices,
// placement matrices, material-route names and shadow flags feed the recorded SHA-256 digests.
const raw = cp.execFileSync(process.execPath, ['--expose-gc', '--max-old-space-size=4096', path.join(dir, 'check-geometry.mjs'), '--worker', candidate, '1'], { cwd, encoding: 'utf8', maxBuffer: 32000000, stdio: ['ignore', 'pipe', 'inherit'] });
const actual = JSON.parse(raw);
assert.deepEqual(actual.context, expected.context, 'Build context fixed');
assert.deepEqual(actual.summary, expected.summary, 'Every full-tree geometry / placement digest equals the reviewed flag1 run');
const bank = actual.assets.find(a => a.input.def?.id === 'stair-bank-giant');
assert(bank?.bankProof);
const groups = bank.bankProof.groups.map(({ coreIds, ...row }) => row);
assert.deepEqual(groups, expected.groups, 'Containment, all-phase near wind, floor, contacts, tone, budgets and rebuilds exact');
const report = { verdict: 'PASS', candidate, reviewedGeometry: expected.reviewedGeometry,
  sourceBindings, normalizedReviewedSourceExact: true, fullTreeSummary: actual.summary,
  selectedGroups: groups.map(g => ({ group: g.group, leaves: g.near.leaves, triangles: g.near.triangles, bytes: g.near.bytes, floorWorld: g.floorWorld, minAnalyticMargin: g.minAnalyticMargin })),
  checks: ['No production trial flag or prototype wording', 'Only three authored selected records', 'Final code equals reviewed true branch after removing comments', 'All564 geometry records and426 near parts match reviewed output', 'All scene placements, material routes and shadow flags match reviewed output', 'Selected containment/floor/wind/contacts/tone/chunked-rebuild checks rerun and exact'],
  evidence: { path: 'reviewed-geometry.json', sha256: sha(fs.readFileSync(path.join(dir, 'reviewed-geometry.json'))) },
  limits: ['CPU parity only; native image acceptance belongs to the frozen94afa311 flag1/common0858f39f comparison.', 'No new rendering or palette adjustment is exercised by this test.'] };
const output = process.argv[3] ? path.resolve(process.argv[3]) : path.join(dir, 'delivery-proof.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ verdict: report.verdict, candidate, reviewedGeometry: report.reviewedGeometry, summary: actual.summary, selectedGroups: report.selectedGroups }, null, 2));
