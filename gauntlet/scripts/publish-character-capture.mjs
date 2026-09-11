/** Publish completed Astra captures with normal fast-forward pushes and bounded retries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const PROGRESS = 'captures/astra-progress', LATEST = 'captures/astra-character';
function command(binary, args, cwd, mayFail = false) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!mayFail && result.status !== 0) throw new Error(`${binary} ${args[0]} failed: ${result.stderr || result.stdout}`);
  return result;
}
const git = (cwd, args, mayFail = false) => command('git', args, cwd, mayFail);
function remoteHead(cwd, branch) {
  const result = git(cwd, ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`], true);
  if (result.status === 2) return null;
  assert.equal(result.status, 0, `Cannot read ${branch}: ${result.stderr}`);
  const head = result.stdout.trim().split(/\s+/)[0]; assert.match(head, /^[a-f0-9]{40}$/);
  return head;
}
function regularFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).map(entry => {
    assert(entry.isFile(), `Unexpected gallery entry: ${entry.name}`); return entry.name;
  }).sort();
}
function sameGallery(expected, existing) {
  if (!fs.existsSync(existing)) return;
  assert.deepEqual(regularFiles(existing), regularFiles(expected), 'Existing checkpoint file set differs');
  for (const name of regularFiles(expected)) {
    assert(fs.readFileSync(path.join(expected, name)).equals(fs.readFileSync(path.join(existing, name))),
      `Existing checkpoint differs: ${name}`);
  }
}
function archive(archiveScript, captureDir, repositoryDir) {
  const result = command(process.execPath, [archiveScript, captureDir, repositoryDir]);
  return JSON.parse(result.stdout.trim());
}

export async function publishCharacterCapture({ captureDir, remote, sequence, source,
  archiveScript = fileURLToPath(new URL('./archive-character-capture.mjs', import.meta.url)),
  maxAttempts = 8, temporaryRoot = os.tmpdir() }) {
  assert.equal(typeof sequence, 'boolean', 'Explicit sequence capture intent is required');
  assert.equal(typeof remote, 'string'); assert(remote.length);
  assert(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 20);
  captureDir = path.resolve(captureDir); archiveScript = path.resolve(archiveScript);
  const motion = JSON.parse(fs.readFileSync(path.join(captureDir, 'motion.json'), 'utf8'));
  if (source !== undefined) assert.equal(motion.source, source, 'Capture source differs from requested source');
  for (const name of ['motion.mp4', 'sequence.json']) {
    assert.equal(fs.existsSync(path.join(captureDir, name)), sequence, `${name}: disagrees with sequence capture intent`);
  }
  if (sequence) {
    const metadata = JSON.parse(fs.readFileSync(path.join(captureDir, 'sequence.json'), 'utf8'));
    assert.equal(metadata.source, motion.source, 'Clip source differs from screenshot source');
  }

  const workspace = fs.mkdtempSync(path.join(temporaryRoot, 'astra-character-publication-'));
  const completed = {};
  try {
    // The actual archive script validates completion, names, provenance and bytes.
    // Work exclusively from its private frozen bundle after this point.
    const staged = path.join(workspace, 'staged'); fs.mkdirSync(staged);
    const checkpoint = archive(archiveScript, captureDir, staged);
    const snapshot = path.join(staged, checkpoint.folder);
    const snapshotFiles = regularFiles(snapshot);
    async function publish(branch, apply, label) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Each attempt is a private checkout of the current remote head, including
        // a race-safe empty-branch bootstrap. Failed local commits are never merged.
        const directory = fs.mkdtempSync(path.join(workspace, 'attempt-'));
        try {
          git(directory, ['init', '--initial-branch', branch]);
          git(directory, ['config', 'user.name', 'github-actions[bot]']);
          git(directory, ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
          git(directory, ['remote', 'add', 'origin', remote]);
          let base = remoteHead(directory, branch);
          if (base) {
            git(directory, ['fetch', '--no-tags', '--depth=1', 'origin', `refs/heads/${branch}`]);
            git(directory, ['reset', '--hard', 'FETCH_HEAD']);
            base = git(directory, ['rev-parse', 'HEAD']).stdout.trim();
          }
          apply(directory);
          git(directory, ['add', '--all']);
          const changes = git(directory, ['diff', '--cached', '--quiet'], true);
          if (changes.status === 0) return { branch, head: base, attempts: attempt, changed: false };
          assert.equal(changes.status, 1, changes.stderr);
          git(directory, ['commit', '-m', `${label} for ${motion.source} [skip ci]`]);
          const head = git(directory, ['rev-parse', 'HEAD']).stdout.trim();
          const pushed = git(directory, ['push', 'origin', `HEAD:refs/heads/${branch}`], true);
          if (pushed.status === 0) return { branch, head, attempts: attempt, changed: true };
          const current = remoteHead(directory, branch);
          // A server may have accepted a push whose final response was lost.
          if (current === head) return { branch, head, attempts: attempt, changed: true };
          if (current === base) throw new Error(`Publication failed for ${branch}: ${pushed.stderr}`);
          if (attempt === maxAttempts) throw new Error(`Concurrent publication retry limit reached for ${branch}: ${pushed.stderr}`);
          console.warn(JSON.stringify({ event: 'retry-publication', branch, attempt, base, current }));
          await delay(Math.min(attempt * 150, 750));
        } finally { fs.rmSync(directory, { recursive: true, force: true }); }
      }
      throw new Error(`Publication did not complete for ${branch}`);
    }

    // Preserve history first. Every retry re-runs the real archive against the
    // fresh branch, rebuilding README with all concurrently published folders.
    completed.progress = await publish(PROGRESS, directory => {
      sameGallery(snapshot, path.join(directory, checkpoint.folder));
      archive(archiveScript, snapshot, directory);
    }, 'Astra progress screenshots');

    // Last successful publication is the latest snapshot, explicitly labeled by
    // motion.json/README source and capture time. Do not infer source chronology.
    completed.latest = await publish(LATEST, directory => {
      for (const entry of fs.readdirSync(directory)) if (entry !== '.git') {
        fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
      }
      for (const name of snapshotFiles) fs.copyFileSync(path.join(snapshot, name), path.join(directory, name));
    }, 'Astra completed character capture');
    return { source: motion.source, capturedAt: motion.capturedAt, folder: checkpoint.folder, ...completed };
  } catch (error) {
    error.publication = { source: motion.source, ...completed };
    throw error;
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [captureDir, remote, archiveScript] = process.argv.slice(2);
  assert(captureDir && remote, 'Usage: publish-character-capture.mjs CAPTURE_DIR REMOTE [ARCHIVE_SCRIPT]');
  assert(['0', '1'].includes(process.env.CAPTURE_SEQUENCE), 'CAPTURE_SEQUENCE must be 0 or 1');
  try {
    console.log(JSON.stringify(await publishCharacterCapture({ captureDir, remote, archiveScript,
      sequence: process.env.CAPTURE_SEQUENCE === '1', source: process.env.GITHUB_SHA })));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message, publication: error.publication })); process.exitCode = 1;
  }
}
