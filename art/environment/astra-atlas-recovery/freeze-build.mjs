// Reuse the moss study's immutable build manifests without restoring production files.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const label = process.argv[2];
assert(['before', 'after'].includes(label));
const sha = cp.execFileSync('git', ['rev-parse', process.argv[3] || 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(cp.execFileSync('git', ['diff', sha, '--', 'src', 'public'], { encoding: 'utf8' }), '');
const dir = path.resolve('art/environment/astra-atlas-recovery/native-pair');
const dest = path.join(dir, label + '-build');
assert(!fs.existsSync(dest), 'Never overwrite frozen evidence');
fs.mkdirSync(dir, { recursive: true });
fs.cpSync('dist', dest, { recursive: true });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const files = fs.readdirSync(dest, { recursive: true, withFileTypes: true }).filter(f => f.isFile()).map(f => {
  const abs = path.join(f.parentPath, f.name);
  return { path: path.relative(dest, abs).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(abs)) };
}).sort((a, b) => a.path.localeCompare(b.path));
const publicHash = hash(JSON.stringify(files.filter(f => f.path !== 'index.html' && !f.path.startsWith('assets/'))));
fs.writeFileSync(path.join(dir, label + '-build.json'), JSON.stringify({ label, sha, root: dest, files, publicHash }, null, 2) + '\n');
console.log('Frozen', label, sha, files.length, 'files');
