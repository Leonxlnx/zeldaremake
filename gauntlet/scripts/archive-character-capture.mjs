/** Preserve completed renderer captures as named, dated GitHub galleries. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const [captureDir, repositoryDir] = process.argv.slice(2).map(p => path.resolve(p));
assert.ok(captureDir && repositoryDir, 'Usage: archive-character-capture.mjs CAPTURE_DIR REPOSITORY_DIR');
const motion = JSON.parse(fs.readFileSync(path.join(captureDir, 'motion.json'), 'utf8'));
assert.match(motion.source, /^[a-f0-9]{40}$/);
assert.ok(Number.isFinite(Date.parse(motion.capturedAt)), 'Capture needs a real timestamp');
assert.deepEqual(motion.errors, [], 'Only completed error-free renders can be archived');
assert.ok(motion.captures.length > 0, 'Capture must contain screenshots');
const stamp = new Date(motion.capturedAt).toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '');
const folder = `${stamp}-${motion.source.slice(0, 7)}`;
const destination = path.join(repositoryDir, 'progress', folder);
const files = new Map();
const read = name => {
  const bytes = fs.readFileSync(path.join(captureDir, name));
  assert.ok(bytes.length, `${name}: empty capture`);
  files.set(name, bytes);
};
const images = [];
for (const capture of motion.captures) {
  assert.match(capture.name, /^[a-z0-9-]+$/);
  const name = `${capture.name}.jpg`;
  assert.ok(!files.has(name), `Duplicate screenshot: ${name}`);
  read(name);
  images.push({ file: name, sha256: crypto.createHash('sha256').update(files.get(name)).digest('hex') });
}
read('motion.json');
for (const [metadata, clip] of [['sequence.json', 'motion.mp4'], ['stairs-sequence.json', 'stairs.mp4'], ['stairs.json', null]]) {
  const file = path.join(captureDir, metadata);
  if (!fs.existsSync(file)) continue;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  // The latest-image branch may retain an older clip. Never label it as this source.
  if (record.source !== motion.source) continue;
  read(metadata);
  if (clip) read(clip);
}
const manifest = { source: motion.source, capturedAt: motion.capturedAt, images };
files.set('capture-sources.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const title = `Link and world details — ${motion.capturedAt.slice(0, 10)} ${motion.capturedAt.slice(11, 19)} UTC`;
let readme = `# ${title}\n\nActual game renders from source [${motion.source.slice(0, 7)}](https://github.com/Leonxlnx/zeldaremake/commit/${motion.source}). This is progress evidence, not a claim that the reference or quality gates are complete.\n\n`;
if (files.has('motion.mp4')) readme += '[Walking, running and jumping clip](motion.mp4)\n\n';
if (files.has('stairs.mp4')) readme += '[Stair traversal clip](stairs.mp4)\n\n';
for (const { file } of images) {
  const label = file.replace(/^\d+-/, '').replace(/\.jpg$/, '').replaceAll('-', ' ');
  readme += `## ${label[0].toUpperCase() + label.slice(1)}\n\n![${label}](${file})\n\n`;
}
files.set('README.md', Buffer.from(readme));
// Retries may repeat the exact same checkpoint, but must not alter an old gallery.
for (const [name, bytes] of files) {
  const target = path.join(destination, name);
  if (fs.existsSync(target)) assert.ok(fs.readFileSync(target).equals(bytes), `Existing checkpoint differs: ${name}`);
}
fs.mkdirSync(destination, { recursive: true });
for (const [name, bytes] of files) fs.writeFileSync(path.join(destination, name), bytes);
const folders = fs.readdirSync(path.join(repositoryDir, 'progress'), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort().reverse();
fs.writeFileSync(path.join(repositoryDir, 'README.md'), '# Astra progress captures\n\nNamed, dated screenshots of the actual Zelda remake game. Each gallery records its source commit.\n\n'
  + folders.map(name => `- [${name}](progress/${name}/)`).join('\n')
  + '\n\nThis is a generated evidence branch; do not merge it into source.\n');
console.log(JSON.stringify({ folder: `progress/${folder}`, source: motion.source, images: images.length, files: files.size }));
