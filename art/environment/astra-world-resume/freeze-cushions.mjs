// Freeze the two committed runtimes. Only the two owned source files are restored temporarily.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir = path.resolve(process.argv[2] || 'art/environment/astra-world-resume/native-pair');
fs.mkdirSync(dir, { recursive: true });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const files = ['src/world/materials/sprouts.ts', 'src/world/hardscape/index.ts'];
const saved = files.map(file => fs.readFileSync(file));
const after = cp.execFileSync('git', ['rev-parse', process.argv[3] || 'ba1d4bb1'], { encoding: 'utf8' }).trim();
assert.equal(cp.execFileSync('git', ['diff', after, '--', 'src', 'public'], { encoding: 'utf8' }), '');
for (const [label, sha] of [['after', after], ['before', '6c13f70c']]) {
  const dest = path.join(dir, label + '-build');
  assert(!fs.existsSync(dest), 'Never overwrite frozen evidence');
  if (label === 'after') fs.cpSync('dist', dest, { recursive: true });
  else try {
    files.forEach(file => fs.writeFileSync(file, cp.execFileSync('git', ['show', `${sha}:${file}`])));
    cp.execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', dest], { stdio: 'inherit' });
  } finally { files.forEach((file, i) => fs.writeFileSync(file, saved[i])); }
  const assets = fs.readdirSync(dest, { recursive: true, withFileTypes: true }).filter(f => f.isFile()).map(f => {
    const abs = path.join(f.parentPath, f.name);
    return { path: path.relative(dest, abs).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(abs)) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(path.join(dir, label + '-build.json'), JSON.stringify({ label, sha, root: dest, files: assets, publicHash: hash(JSON.stringify(assets.filter(f => f.path !== 'index.html' && !f.path.startsWith('assets/')))) }, null, 2) + '\n');
  console.log('Frozen', label, sha, assets.length, 'files');
}
files.forEach((file, i) => assert.deepEqual(fs.readFileSync(file), saved[i]));
