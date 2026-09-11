/** Local bare-Git publication races; synthetic bytes are test fixtures, not game renders. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { publishCharacterCapture } from './publish-character-capture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.resolve('gauntlet/tmp/character-publication-regression');
fs.mkdirSync(evidence, { recursive: true });
const fixture = fs.mkdtempSync(path.join(evidence, 'fixture-'));
const remote = path.join(fixture, 'remote.git');
const archiveScript = path.resolve('gauntlet/scripts/archive-character-capture.mjs');
const publisher = path.join(here, 'publish-character-capture.mjs');
const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
git(['init', '--bare', remote]);
git(['--git-dir', remote, 'config', 'receive.denyNonFastForwards', 'true']);
const refs = () => Object.fromEntries(git(['--git-dir', remote, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads']).split('\n').filter(Boolean).map(line => line.split(' ')));
const contents = (branch, name) => execFileSync('git', ['--git-dir', remote, 'show', `${branch}:${name}`]);
const files = branch => git(['--git-dir', remote, 'ls-tree', '-r', '--name-only', branch]).split('\n');
function capture(id, time, sequence, image = '01-current') {
  const directory = path.join(fixture, `capture-${id}`); fs.mkdirSync(directory);
  const source = id.repeat(40), bytes = Buffer.from(`synthetic JPEG fixture ${id}\n`);
  fs.writeFileSync(path.join(directory, `${image}.jpg`), bytes);
  fs.writeFileSync(path.join(directory, 'motion.json'), JSON.stringify({ source, capturedAt: time, captures: [{ name: image }], errors: [] }, null, 2));
  if (sequence) {
    fs.writeFileSync(path.join(directory, 'motion.mp4'), Buffer.from(`synthetic MP4 fixture ${id}\n`));
    fs.writeFileSync(path.join(directory, 'sequence.json'), JSON.stringify({ source, fps: 12, states: [{ x: 0 }] }));
  }
  return { captureDir: directory, source, remote, sequence, archiveScript };
}
const seed = capture('1', '2026-09-11T01:00:00.000Z', true, '01-obsolete');
const seedResult = await publishCharacterCapture(seed);
const initialHeads = refs();
const seedFiles = files('captures/astra-progress').filter(file => file.startsWith(seedResult.folder + '/'));
const seedHashes = Object.fromEntries(seedFiles.map(file => [file, createHash('sha256').update(contents('captures/astra-progress', file)).digest('hex')]));

// The two real git push clients rendezvous in pre-push, after seeing the same
// advertised old head. B waits for A to finish each branch before completing its
// own push. Both branches therefore experience an actual rejected ref update.
const hookDirectory = path.join(fixture, 'hooks'); fs.mkdirSync(hookDirectory);
const markers = path.join(fixture, 'markers'); fs.mkdirSync(markers);
const hook = `#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';
const rows=fs.readFileSync(0,'utf8').trim().split('\\n').filter(Boolean);
const writer=process.env.ASTRA_TEST_WRITER,dir=process.env.ASTRA_TEST_MARKERS;
if(!writer||!dir)process.exit(0);
const pause=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
for(const row of rows){
 const fields=row.split(' '),branch=fields[2].replaceAll('/','_'),self=path.join(dir,writer+'-'+branch);
 if(fs.existsSync(self))continue;
 fs.writeFileSync(self,fields[1]);
 const other=path.join(dir,(writer==='A'?'B':'A')+'-'+branch),start=Date.now();
 while(!fs.existsSync(other)){if(Date.now()-start>10000)throw Error('rendezvous timeout');pause(20);}
 if(writer==='B'){
  const winningHead=fs.readFileSync(other,'utf8');
  while(true){
   const head=cp.execFileSync('git',['ls-remote',process.argv[3],fields[2]],{encoding:'utf8'}).trim().split(/\\s+/)[0];
   if(head===winningHead)break;
   if(Date.now()-start>10000)throw Error('winner timeout');pause(20);
  }
 }
}
`;
fs.writeFileSync(path.join(hookDirectory, 'pre-push'), hook, { mode: 0o755 });
const globalConfig = path.join(fixture, 'gitconfig');
fs.writeFileSync(globalConfig, `[core]\n  hooksPath = ${hookDirectory}\n`);
const A = capture('2', '2026-09-11T02:00:00.000Z', true);
const B = capture('3', '2026-09-11T02:00:01.000Z', false);
function concurrent(options, writer) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [publisher, options.captureDir, remote, archiveScript], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1',
        ASTRA_TEST_WRITER: writer, ASTRA_TEST_MARKERS: markers, CAPTURE_SEQUENCE: options.sequence ? '1' : '0', GITHUB_SHA: options.source },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve({ publication: JSON.parse(stdout.trim()), stderr }) : reject(Error(`writer ${writer}: ${stdout}\n${stderr}`)));
  });
}
const [writerA, writerB] = await Promise.all([concurrent(A, 'A'), concurrent(B, 'B')]);
assert.equal(writerA.publication.progress.attempts, 1); assert.equal(writerA.publication.latest.attempts, 1);
assert(writerB.publication.progress.attempts >= 2, 'progress branch retried a real rejected update');
assert(writerB.publication.latest.attempts >= 2, 'latest branch retried a real rejected update');
assert.equal((writerB.stderr.match(/retry-publication/g) ?? []).length, 2);
const progressFiles = files('captures/astra-progress');
for (const publication of [seedResult, writerA.publication, writerB.publication]) {
  const json = JSON.parse(contents('captures/astra-progress', publication.folder + '/capture-sources.json'));
  assert.equal(json.source, publication.source);
  for (const image of json.images) assert.equal(createHash('sha256').update(contents('captures/astra-progress', publication.folder + '/' + image.file)).digest('hex'), image.sha256);
  assert(contents('captures/astra-progress', 'README.md').toString().includes(publication.folder));
}
for (const [file, digest] of Object.entries(seedHashes)) assert.equal(createHash('sha256').update(contents('captures/astra-progress', file)).digest('hex'), digest, 'old gallery byte identity');
assert.equal(JSON.parse(contents('captures/astra-character', 'motion.json')).source, B.source);
for (const obsolete of ['motion.mp4', 'sequence.json', '01-obsolete.jpg']) assert(!files('captures/astra-character').includes(obsolete), `${obsolete} removed from still-only snapshot`);
assert(files('captures/astra-character').includes('capture-sources.json'));
assert(contents('captures/astra-character', 'README.md').toString().includes(B.source));
for (const branch of ['captures/astra-character', 'captures/astra-progress']) {
  git(['--git-dir', remote, 'merge-base', '--is-ancestor', initialHeads['refs/heads/' + branch], branch]);
}

const beforeRetry = refs(), repeated = await publishCharacterCapture(B);
assert.equal(repeated.progress.changed, false); assert.equal(repeated.latest.changed, false);
assert.deepEqual(refs(), beforeRetry, 'identical replay is idempotent');

const beforeConflict = refs();
const imagePath = path.join(B.captureDir, '01-current.jpg'), original = fs.readFileSync(imagePath);
fs.writeFileSync(imagePath, 'conflicting synthetic image bytes');
await assert.rejects(publishCharacterCapture(B), /Existing checkpoint differs/);
assert.deepEqual(refs(), beforeConflict, 'immutable checkpoint conflict changes neither branch');
fs.writeFileSync(imagePath, original);

const beforeIntent = refs();
await assert.rejects(publishCharacterCapture({ ...A, sequence: false }), /sequence capture intent/);
fs.renameSync(path.join(A.captureDir, 'motion.mp4'), path.join(A.captureDir, 'saved.mp4'));
await assert.rejects(publishCharacterCapture(A), /sequence capture intent/);
fs.renameSync(path.join(A.captureDir, 'saved.mp4'), path.join(A.captureDir, 'motion.mp4'));
assert.deepEqual(refs(), beforeIntent, 'stale same-source or incomplete clip input never publishes');

// Failure on the latest branch must preserve the already successful dated archive
// and report that partial outcome. A later retry completes the second branch only.
const C = capture('4', '2026-09-11T03:00:00.000Z', false);
const beforePartial = refs();
fs.writeFileSync(path.join(remote, 'hooks', 'update'), '#!/bin/sh\nif [ "$1" = "refs/heads/captures/astra-character" ]; then echo "fixture rejects latest" >&2; exit 1; fi\n', { mode: 0o755 });
let partial;
try { await publishCharacterCapture(C); assert.fail('latest update must be rejected'); }
catch (error) { partial = error.publication; assert(partial?.progress?.head); assert(!partial.latest); }
assert.equal(refs()['refs/heads/captures/astra-character'], beforePartial['refs/heads/captures/astra-character']);
assert.notEqual(refs()['refs/heads/captures/astra-progress'], beforePartial['refs/heads/captures/astra-progress']);
fs.unlinkSync(path.join(remote, 'hooks', 'update'));
const recovered = await publishCharacterCapture(C);
assert.equal(recovered.progress.changed, false); assert.equal(recovered.latest.changed, true);
assert.equal(recovered.progress.head, partial.progress.head);

const report = { fixture, actualArchiveScript: archiveScript,
  archiveScriptSha256: createHash('sha256').update(fs.readFileSync(archiveScript)).digest('hex'),
  seed: seedResult, writerA, writerB, repeated, partial, recovered,
  checks: ['simultaneous writers', 'actual rejected updates retried on BOTH branches', 'old gallery bytes and source/image hashes preserved',
    'progress index rebuilt with all galleries', 'exact latest snapshot removes stale clip pair and obsolete JPG',
    'normal pushes retain branch ancestry', 'idempotent identical retry', 'immutable collision rejected before publication',
    'explicit no-clip and incomplete clip intent rejected', 'partial archive success retained and retry completed latest'],
  pass: true };
fs.writeFileSync(path.join(evidence, 'test-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, fixture, attempts: { A: [writerA.publication.progress.attempts, writerA.publication.latest.attempts], B: [writerB.publication.progress.attempts, writerB.publication.latest.attempts] }, checks: report.checks }, null, 2));
