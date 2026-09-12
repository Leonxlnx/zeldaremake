#!/usr/bin/env node
/** Append verified detail bytes without replacing comparison folders or archive history. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readJson } from './environment-capture-data.mjs';
import { readCompletedDetails } from './environment-detail-data.mjs';

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
  const folders = fs.readdirSync(path.join(directory, 'details'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort().reverse();
  const lines = ['# World detail checkpoints', '',
    'Four actual production closeups per checkpoint: sign front, sign oblique, stair-foot lantern binding, and fork-west lantern. Fixed layout-relative cameras, time 12.5 s, no light/post overrides, complete scene. These are supplemental evidence, not gauntlet takes or quality approvals.', '',
    '[Environment comparisons](../)', '', '| Captured UTC | Source | Detail views |', '| --- | --- | --- |'];
  for (const folder of folders) {
    assert.match(folder, /^\d{4}-\d{2}-\d{2}_\d{9}-[a-f0-9]{7}$/);
    const r = readJson(path.join(directory, 'details', folder, 'details.json'));
    assert.match(r.source, /^[a-f0-9]{40}$/);
    lines.push(`| ${r.capturedAt} | [${r.source.slice(0, 7)}](https://github.com/Leonxlnx/zeldaremake/commit/${r.source}) | [4 images](${folder}/) |`);
  }
  fs.writeFileSync(path.join(directory, 'details', 'README.md'), lines.join('\n') + '\n');
  const rootReadme = path.join(directory, 'README.md');
  let main = fs.existsSync(rootReadme) ? fs.readFileSync(rootReadme, 'utf8') : '# Astra environment progress\n';
  if (!main.includes('(details/)')) {
    main += '\n[Four closeup world detail views per checkpoint](details/)\n';
    fs.writeFileSync(rootReadme, main);
  }
}

export async function publishEnvironmentDetails({ captureDir, remote, source, temporaryRoot = os.tmpdir(), maxAttempts = 6 }) {
  assert(typeof remote === 'string' && remote); assert.match(source, /^[a-f0-9]{40}$/);
  assert(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 10);
  captureDir = path.resolve(captureDir);
  const report = readCompletedDetails(captureDir, source);
  const stamp = new Date(report.capturedAt).toISOString().replace('T', '_').replace(/[:.]/g, '').replace('Z', '');
  const folder = `details/${stamp}-${source.slice(0, 7)}`;
  const workspace = fs.mkdtempSync(path.join(temporaryRoot, 'astra-environment-detail-publication-'));
  try {
    const frozen = path.join(workspace, 'frozen'); copyImmutable(captureDir, frozen);
    readCompletedDetails(frozen, source);
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
        git(checkout, ['add', '--', 'README.md', 'details/README.md', folder]);
        const diff = git(checkout, ['diff', '--cached', '--quiet'], true);
        if (diff.status === 0) return { branch: BRANCH, head: base, folder, source, attempt, changed: false };
        assert.equal(diff.status, 1, diff.stderr);
        git(checkout, ['commit', '-m', `World detail views for ${source} [skip ci]`]);
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
  assert(captureDir && remote && process.env.GITHUB_SHA, 'Usage: GITHUB_SHA=SOURCE node publish-environment-details.mjs CAPTURE_DIR REMOTE');
  console.log(JSON.stringify(await publishEnvironmentDetails({ captureDir, remote, source: process.env.GITHUB_SHA })));
}
