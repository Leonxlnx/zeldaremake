#!/usr/bin/env node
/** Append verified motion originals without replacing comparison/detail/history folders. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readJson, sourceIdentity } from './environment-capture-data.mjs';
import { ROOT } from './lib/browser.mjs';
import { hashDir } from './capture.mjs';
import { loadHedgeSweep } from './environment-hedge-sweep-data.mjs';
import { readCompletedHedgeSweep } from './environment-hedge-sweep-publication-data.mjs';

const BRANCH = 'captures/astra-environment';
function git(cwd, args, mayFail = false) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (!mayFail && r.status !== 0) throw new Error(`git ${args[0]}: ${r.stderr || r.stdout}`);
  return r;
}
function remoteHead(cwd) {
  const r = git(cwd, ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${BRANCH}`], true);
  if (r.status === 2) return null;
  assert.equal(r.status, 0, r.stderr); const sha = r.stdout.trim().split(/\s+/)[0];
  assert.match(sha, /^[a-f0-9]{40}$/); return sha;
}
function copyImmutable(source, destination) {
  const names = fs.readdirSync(source).sort();
  if (fs.existsSync(destination)) {
    assert.deepEqual(fs.readdirSync(destination).sort(), names, 'Historical checkpoint file set differs');
    for (const name of names) assert(fs.lstatSync(path.join(destination, name)).isFile() && fs.readFileSync(path.join(destination, name)).equals(fs.readFileSync(path.join(source, name))), `Historical bytes differ: ${name}`);
  } else { fs.mkdirSync(destination, { recursive: true }); for (const name of names) fs.copyFileSync(path.join(source, name), path.join(destination, name)); }
}
function indexReadme(directory) {
  const folders = fs.readdirSync(path.join(directory, 'motion'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort().reverse();
  const lines = ['# Bank hedge camera sweeps', '',
    'Eleven unmodified full-scene PNGs per checkpoint, crossing both bank-hedge LOD thresholds and returning at fixed time 12.5 s. Explicit free-camera poses force rebucketing; this does not measure the interactive 0.6 m movement gate. These are supplemental observations, not quality approvals.', '',
    '[Environment comparisons](../) · [World details](../details/)', '',
    '| Captured UTC | Source | Original frames and metadata |', '| --- | --- | --- |'];
  for (const folder of folders) {
    assert.match(folder, /^\d{4}-\d{2}-\d{2}_\d{9}-[a-f0-9]{7}$/);
    const r = readJson(path.join(directory, 'motion', folder, 'sweep.json')); assert.match(r.source, /^[a-f0-9]{40}$/);
    lines.push(`| ${r.capturedAt} | [${r.source.slice(0, 7)}](https://github.com/Leonxlnx/zeldaremake/commit/${r.source}) | [11 original frames](${folder}/) |`);
  }
  fs.writeFileSync(path.join(directory, 'motion', 'README.md'), lines.join('\n') + '\n');
  const rootReadme = path.join(directory, 'README.md');
  let main = fs.existsSync(rootReadme) ? fs.readFileSync(rootReadme, 'utf8') : '# Astra environment progress\n';
  if (!main.includes('(motion/)')) {
    main += '\n[Original bank-hedge camera sweeps](motion/)\n'; fs.writeFileSync(rootReadme, main);
  }
}

export async function publishEnvironmentHedgeSweep({ captureDir, remote, expected, temporaryRoot = os.tmpdir(), maxAttempts = 6 }) {
  const source = expected.identity.source;
  assert(typeof remote === 'string' && remote); assert.match(source, /^[a-f0-9]{40}$/);
  assert(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 10);
  captureDir = path.resolve(captureDir);
  const report = await readCompletedHedgeSweep(captureDir, expected);
  const stamp = new Date(report.capturedAt).toISOString().replace('T', '_').replace(/[:.]/g, '').replace('Z', '');
  const folder = `motion/${stamp}-${source.slice(0, 7)}`;
  const workspace = fs.mkdtempSync(path.join(temporaryRoot, 'astra-environment-motion-publication-'));
  try {
    const frozen = path.join(workspace, 'frozen'); copyImmutable(captureDir, frozen);
    await readCompletedHedgeSweep(frozen, expected);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const checkout = fs.mkdtempSync(path.join(workspace, 'attempt-'));
      try {
        git(checkout, ['init', '--initial-branch', BRANCH]);
        git(checkout, ['config', 'user.name', 'github-actions[bot]']);
        git(checkout, ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
        git(checkout, ['remote', 'add', 'origin', remote]);
        let base = remoteHead(checkout);
        if (base) {
          git(checkout, ['fetch', '--no-tags', '--depth=1', 'origin', `refs/heads/${BRANCH}`]);
          git(checkout, ['reset', '--hard', 'FETCH_HEAD']); base = git(checkout, ['rev-parse', 'HEAD']).stdout.trim();
        }
        copyImmutable(frozen, path.join(checkout, folder)); indexReadme(checkout);
        git(checkout, ['add', '--', 'README.md', 'motion/README.md', folder]);
        const diff = git(checkout, ['diff', '--cached', '--quiet'], true);
        if (diff.status === 0) return { branch: BRANCH, head: base, folder, source, attempt, changed: false };
        assert.equal(diff.status, 1, diff.stderr);
        git(checkout, ['commit', '-m', `Bank hedge camera sweep for ${source} [skip ci]`]);
        const head = git(checkout, ['rev-parse', 'HEAD']).stdout.trim();
        const push = git(checkout, ['push', 'origin', `HEAD:refs/heads/${BRANCH}`], true);
        if (push.status === 0 || remoteHead(checkout) === head) return { branch: BRANCH, head, folder, source, attempt, changed: true };
        const current = remoteHead(checkout);
        if (current === base) throw new Error(`Publication rejected without remote advancement: ${push.stderr}`);
        assert(attempt < maxAttempts, `Publication retry limit: ${push.stderr}`);
        console.warn(`Environment archive advanced concurrently; retrying from current history (${attempt}/${maxAttempts})`);
        await delay(Math.min(attempt * 150, 750));
      } finally { fs.rmSync(checkout, { recursive: true, force: true }); }
    }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [captureDir, remote] = process.argv.slice(2);
  assert(captureDir && remote && process.env.GITHUB_SHA, 'Usage: GITHUB_SHA=SOURCE node publish-environment-hedge-sweep.mjs CAPTURE_DIR REMOTE');
  const identity = sourceIdentity(ROOT); assert.equal(identity.source, process.env.GITHUB_SHA);
  const expected = { identity, plan: loadHedgeSweep(ROOT), distHash: hashDir(path.join(ROOT, 'dist')) };
  console.log(JSON.stringify(await publishEnvironmentHedgeSweep({ captureDir, remote, expected })));
}
