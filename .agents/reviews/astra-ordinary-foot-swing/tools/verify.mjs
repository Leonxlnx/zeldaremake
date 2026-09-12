/** Run the repository's unchanged assertions with read-only curve diagnostics. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.argv[2] ?? '.');
const output = path.resolve(process.argv[3] ?? 'tmp/ordinary-foot-swing-review');
const require = createRequire(path.join(sourceRoot, 'package.json'));
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'source-manifest.json')));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
for (const [name, expected] of Object.entries(manifest.sourceHashes)) {
  assert.equal(sha(fs.readFileSync(path.join(sourceRoot, name))), expected, name);
}
const testFile = path.join(sourceRoot, 'src/world/character/locomotion.test.mjs');
let source = fs.readFileSync(testFile, 'utf8');
assert.equal(sha(source), manifest.unchangedTestSha256, 'assertion file remains unchanged');
fs.mkdirSync(output, { recursive: true });
function replace(before, after) {
  assert.equal(source.split(before).length, 2, `one instrumentation site: ${before.slice(0, 60)}`);
  source = source.replace(before, after);
}
replace("from 'typescript'", `from ${JSON.stringify(pathToFileURL(require.resolve('typescript')).href)}`);
replace("from 'three'", `from ${JSON.stringify(pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href)}`);
replace('const here = path.dirname(fileURLToPath(import.meta.url));',
  `const here = ${JSON.stringify(path.dirname(testFile))};\nconst storedCurves = [], corrections = [];\nglobalThis.__correction = x => corrections.push(x);`);
replace("  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {", `  let loadedSource = fs.readFileSync(file, 'utf8');
  if (file.endsWith('/play-pose.ts')) loadedSource = loadedSource.replace(
    '        if (dt > 0 && (!sampledCurve',
    '        if (sampledCurve && f.target.distanceToSquared(landing) > 1e-18) globalThis.__correction({time:s.time,side:f.side,planned:landing.toArray(),accepted:f.target.toArray(),difference:f.target.distanceTo(landing)});\\n        if (dt > 0 && (!sampledCurve');
  const js = ts.transpileModule(loadedSource, {`);
replace('  return mod.exports;', `  if (file.endsWith('/foot-swing.ts')) {
    const make = mod.exports.createFootSwing;
    mod.exports.createFootSwing = (...args) => { const curve = make(...args); storedCurves.push(curve); return curve; };
  }
  return mod.exports;`);
source += `\nfs.writeFileSync(${JSON.stringify(path.join(output, 'curves.json'))}, JSON.stringify(storedCurves));
fs.writeFileSync(${JSON.stringify(path.join(output, 'corrections.json'))}, JSON.stringify({count:corrections.length,corrections}, null, 2));
assert.equal(corrections.length, 0, 'the accepted stored-curve samples match their evaluator');\n`;
// The temporary module changes only source loading and read-only observations.
// Every original assertion and its threshold is retained verbatim above.
const runner = path.join(output, 'unchanged-assertions.instrumented.mjs');
fs.writeFileSync(runner, source);
await import(pathToFileURL(runner));
console.log(JSON.stringify({ manifestVerified: true, unchangedAssertionsPassed: true, output }));
