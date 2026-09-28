/**
 * WHAT allocates in the tree builders, by function, with bytes — no browser, no guessing.
 *
 *   node art/environment/squad2-2026-09-23/chunks/allocprof.mjs [--repeat 3] [--top 20] [--interval 8192]
 *
 * `chunks/README.md` §6 measured that 11 % of the builder's wall clock is GC pause and that the chunks
 * a collection lands in read 20× the median of the ones that escape it — so the frame budget is lost to
 * garbage, not to work. It also estimated where the garbage comes from (the writer's growing `number[]`s)
 * from the shape of the data. This measures it instead: V8's sampling heap profiler, through the
 * inspector session Node already has, attributes every sampled allocation to the function that made it.
 *
 * Sizes are sampled (one sample per `--interval` bytes allocated), so treat them as shares rather than
 * exact totals; the shares are stable across runs to a percent or two at the default interval.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Session } from 'node:inspector';
import { writeFileSync } from 'node:fs';
import { buildWorld, pooledParts, r2, sum } from './fixture.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const REPEAT = Number(flag('repeat', 3));
const TOP = Number(flag('top', 20));
const INTERVAL = Number(flag('interval', 8192));
const JSON_OUT = flag('json', null);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');

const world = buildWorld(ROOT);
const parts = pooledParts(world);
const { runSteps } = world;

const session = new Session();
session.connect();
const post = (method, params) =>
  new Promise((resolve, reject) => session.post(method, params, (err, res) => (err ? reject(err) : resolve(res))));

await post('HeapProfiler.enable');
// Without the two include flags the profile reports only what SURVIVED, which for a builder is almost
// nothing — the first run of this tool sampled 0.23 MB against the 4.3 GB `--trace-gc` sees. The
// garbage is the point, so collected objects have to be asked for explicitly.
await post('HeapProfiler.startSampling', {
  samplingInterval: INTERVAL,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true,
});
for (let i = 0; i < REPEAT; i++) for (const part of parts) runSteps(part.build());
const { profile } = await post('HeapProfiler.getSamplingProfile');
await post('HeapProfiler.stopSampling');
session.disconnect();

/** sum selfSize per call frame, and per file, over the profile's tree */
const byFrame = new Map();
const byFile = new Map();
let total = 0;
const walk = (node) => {
  const f = node.callFrame;
  const where = f.url ? `${path.basename(f.url)}:${f.lineNumber + 1}` : '(native)';
  const name = f.functionName || '(anonymous)';
  const key = `${name}  ${where}`;
  const self = node.selfSize ?? 0;
  total += self;
  byFrame.set(key, (byFrame.get(key) ?? 0) + self);
  const file = f.url ? path.basename(f.url) : '(native)';
  byFile.set(file, (byFile.get(file) ?? 0) + self);
  for (const child of node.children ?? []) walk(child);
};
walk(profile.head);

const mb = (bytes) => r2(bytes / 1048576);
const share = (bytes) => `${r2((100 * bytes) / total)} %`;

console.log(`# what allocates in the tree builders (${parts.length} parts × ${REPEAT} builds, sampled every ${INTERVAL} B)`);
console.log();
console.log(`**${mb(total)} MB sampled in total.**`);
console.log();
console.log('| MB | share | file |');
console.log('| --- | --- | --- |');
for (const [file, bytes] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`| ${mb(bytes)} | ${share(bytes)} | ${file} |`);
}
console.log();
console.log(`| MB | share | function | `);
console.log('| --- | --- | --- |');
for (const [key, bytes] of [...byFrame].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
  const [name, where] = key.split('  ');
  console.log(`| ${mb(bytes)} | ${share(bytes)} | \`${name}\` ${where ?? ''} |`);
}

if (JSON_OUT) {
  writeFileSync(
    path.resolve(JSON_OUT),
    JSON.stringify(
      {
        parts: parts.length,
        repeat: REPEAT,
        interval: INTERVAL,
        totalBytes: total,
        byFile: [...byFile].sort((a, b) => b[1] - a[1]).map(([file, bytes]) => ({ file, bytes, mb: mb(bytes) })),
        byFrame: [...byFrame].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([key, bytes]) => ({ where: key, bytes, mb: mb(bytes) })),
      },
      null,
      1,
    ) + '\n',
  );
  console.log();
  console.log(`json: ${JSON_OUT}`);
}
void sum;
