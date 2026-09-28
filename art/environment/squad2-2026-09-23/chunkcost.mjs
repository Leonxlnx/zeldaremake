/**
 * Where the near-LOD builder's frame time goes, chunk by chunk — no browser.
 *
 *   node art/environment/squad2-2026-09-23/chunkcost.mjs [--top 12] [--json out.json]
 *
 * `lodPool.work(budgetMs)` always runs the first chunk of a call (the progress guarantee: a build
 * whose chunks all exceed the budget must still advance, or it starves into a synchronous build at
 * its pin). So a `work` call costs at least one chunk, and the pool's `workMsP95` can only come
 * down to the chunk cost. Measured in the browser on `?pool=small`: budget 3 ms, workMsP95 6.2–6.7
 * ms — the chunks themselves are the overrun.
 *
 * This runs the REAL part generators (giant near base, near-canopy lobes and limbs, a seated
 * column's near base) through the same in-memory TS loader the unit tests use, timing every chunk
 * between yields, and prints which chunk of which part is the expensive one. Relative cost is what
 * transfers to the browser; absolute ms here are this box's.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const TOP = Number(flag('--top', 12));
const JSON_OUT = flag('--json', null);
/**
 * Builds per part, median kept per chunk. One build a part measures the JIT warming up as if it
 * were a chunk: the largest single reading moved from one part's chunk 3 to another's between two
 * runs. Three builds and the median make the structural cost (what every build pays) visible.
 */
const REPEAT = Number(flag('--repeat', 3));

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const treesDir = path.join(root, 'src', 'world', 'trees');

const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
          if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
        }
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { createRng } = loadTs(path.join(root, 'src', 'world', 'util', 'prng.ts'));
const { createGiantTree } = loadTs(path.join(treesDir, 'giant.ts'));
const { columnParams, createColumnTree } = loadTs(path.join(treesDir, 'column.ts'));

const palette = { barkWhite: 0xe8e2d4, barkGrey: 0x9a938a, barkDark: 0x4a4038, leafCanopy: 0x4f7a2e, leafSun: 0x9ab84a };
const ground = (x, z) => 0.05 * Math.sin(x * 0.7) + 0.04 * Math.cos(z * 0.9);
const sunDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();

/** run a build generator chunk by chunk, timing each chunk */
const timeChunks = (gen) => {
  const chunks = [];
  for (;;) {
    const t0 = performance.now();
    const r = gen.next();
    chunks.push(performance.now() - t0);
    if (r.done) return { chunks, value: r.value };
  }
};

const { VERTEX_NORMAL_FACES_PER_STEP, VERTEX_NORMAL_VERTICES_PER_STEP } = loadTs(path.join(treesDir, 'writer.ts'));

/**
 * What each chunk of a part IS, counted back from the end: `finishSteps` closes every build with
 * the two attribute packs, the vertex normals (chunked: `ceil(faces / FACES_PER_STEP)` accumulation
 * chunks then `ceil(vertices / VERTICES_PER_STEP)` normalisation chunks) and the bounds pass.
 * Everything before that is the part's own geometry.
 */
const labelChunks = (n, geometry) => {
  const faces = geometry.index ? geometry.index.count / 3 : 0;
  const vertices = geometry.getAttribute('position').count;
  const f = Math.max(1, Math.ceil(faces / VERTEX_NORMAL_FACES_PER_STEP));
  const v = Math.ceil(vertices / VERTEX_NORMAL_VERTICES_PER_STEP);
  const labels = new Array(n).fill('the part\'s geometry');
  const at = (fromEnd, label) => {
    if (n - fromEnd >= 0) labels[n - fromEnd] = label;
  };
  at(1, 'finish: seams and bounds');
  for (let i = 0; i < v; i++) at(2 + i, 'finish: normals normalised');
  for (let i = 0; i < f; i++) at(2 + v + i, 'finish: face normals');
  at(2 + v + f, 'finish: aWind/aRoot/index packed');
  at(3 + v + f, 'finish: position/color/uv packed');
  return labels;
};

const pct = (xs, q) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
};
const r2 = (v) => Math.round(v * 100) / 100;

const giants = [];
for (const [i, def] of [
  { id: 'chunkcost-giant-a', position: [0, 0, 0], trunkRadius: 1.4, height: 30 },
  { id: 'chunkcost-giant-b', position: [22, 0, -8], trunkRadius: 1.8, height: 42 },
].entries()) {
  giants.push(
    createGiantTree(def, createRng(`chunkcost/giant-${i}`), {
      groundAt: ground,
      palette,
      leafDensity: 0.8,
      cardDensity: 0.8,
      sunDir,
      pathAt: () => 0,
      heroDistance: Infinity,
      nearCanopy: {},
    }),
  );
}
const columns = [0, 1].map((i) => {
  const p = columnParams(createRng(`chunkcost/column-${i}`), i + 2, 5);
  return createColumnTree(p, palette, 'high', { groundAt: ground, nearBase: true, sunDir, pathAt: () => 0, nearCanopy: {} });
});

/** every pool part in the world's shape: giants' and columns' near bases plus their near-canopy parts */
const parts = [];
for (const [i, asset] of giants.entries()) {
  if (asset.nearBaseBuild) parts.push({ kind: 'giant near base', id: `giant-${i}-base`, build: asset.nearBaseBuild });
  for (const p of asset.nearCanopy) parts.push({ kind: `near canopy ${p.kind}`, id: p.geometry.name || `giant-${i}-${p.kind}`, build: p.build });
}
for (const [i, asset] of columns.entries()) {
  if (asset.nearBaseBuild) parts.push({ kind: 'column near base', id: `column-${i}-base`, build: asset.nearBaseBuild });
  for (const p of asset.nearCanopy) parts.push({ kind: `near canopy ${p.kind}`, id: p.geometry.name || `column-${i}-${p.kind}`, build: p.build });
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const measured = [];
const allChunks = [];
for (const part of parts) {
  const runs = [];
  let geometry = null;
  for (let i = 0; i < REPEAT; i++) {
    const out = timeChunks(part.build());
    runs.push(out.chunks);
    geometry = out.value;
  }
  const chunks = runs[0].map((_, at) => median(runs.map((r) => r[at])));
  const total = chunks.reduce((a, b) => a + b, 0);
  const labels = labelChunks(chunks.length, geometry);
  measured.push({ ...part, chunks, total, n: chunks.length, max: Math.max(...chunks), maxAt: chunks.indexOf(Math.max(...chunks)) });
  for (const [at, ms] of chunks.entries()) allChunks.push({ ms, at, fromEnd: chunks.length - at, kind: part.kind, id: part.id, of: chunks.length, label: labels[at] });
}

const byKind = new Map();
for (const m of measured) {
  const k = byKind.get(m.kind) ?? { kind: m.kind, parts: 0, chunks: [], totals: [] };
  k.parts++;
  k.chunks.push(...m.chunks);
  k.totals.push(m.total);
  byKind.set(m.kind, k);
}

const lines = [];
const say = (s = '') => {
  lines.push(s);
  console.log(s);
};

say(`# the near-LOD builder's chunks (node, ${parts.length} real parts, ${REPEAT} builds each, median per chunk)`);
say();
say('| part kind | parts | chunks | chunk p50 | chunk p95 | chunk max | whole build p50 | p95 | max |');
say('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const k of byKind.values()) {
  say(
    `| ${k.kind} | ${k.parts} | ${k.chunks.length} | ${r2(pct(k.chunks, 0.5))} | ${r2(pct(k.chunks, 0.95))} | ${r2(Math.max(...k.chunks))} | ` +
      `${r2(pct(k.totals, 0.5))} | ${r2(pct(k.totals, 0.95))} | ${r2(Math.max(...k.totals))} |`,
  );
}
const every = allChunks.map((c) => c.ms);
say(
  `| **all** | ${parts.length} | ${every.length} | **${r2(pct(every, 0.5))}** | **${r2(pct(every, 0.95))}** | **${r2(Math.max(...every))}** | ` +
    `${r2(pct(measured.map((m) => m.total), 0.5))} | ${r2(pct(measured.map((m) => m.total), 0.95))} | ${r2(Math.max(...measured.map((m) => m.total)))} |`,
);

say();
say(`## the ${TOP} most expensive chunks, and what they are`);
say();
say('| ms | chunk | of | what it is | part |');
say('| --- | --- | --- | --- | --- |');
for (const c of [...allChunks].sort((a, b) => b.ms - a.ms).slice(0, TOP)) {
  say(`| ${r2(c.ms)} | ${c.at} | ${c.of} | ${c.label} | ${c.id} |`);
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const totalMs = sum(every);
say();
say('## every chunk by what it is');
say();
say('| what it is | count | p50 | p95 | max | sum ms | share of the builder |');
say('| --- | --- | --- | --- | --- | --- | --- |');
const labels = [...new Set(allChunks.map((c) => c.label))];
for (const label of labels) {
  const ms = allChunks.filter((c) => c.label === label).map((c) => c.ms);
  say(
    `| ${label} | ${ms.length} | ${r2(pct(ms, 0.5))} | ${r2(pct(ms, 0.95))} | ${r2(Math.max(...ms))} | ${r2(sum(ms))} | ${r2((100 * sum(ms)) / totalMs)} % |`,
  );
}

// What a 3 ms budget would cost per `work` call with these chunks: the first chunk always runs.
say();
say('## what a 3 ms budget pays, given these chunks');
say();
const budget = 3;
const over = every.filter((ms) => ms > budget);
say(`- chunks longer than the ${budget} ms budget: **${over.length} of ${every.length}** (${r2((100 * over.length) / every.length)} %), the longest ${r2(Math.max(...every))} ms`);
say(`- a \`work\` call that starts with one of those pays it whole: p95 of the over-budget chunks **${r2(pct(over, 0.95))} ms**`);
say(`- the parts whose LONGEST chunk is over budget: **${measured.filter((m) => m.max > budget).length} of ${measured.length}**`);

if (JSON_OUT) {
  writeFileSync(
    path.resolve(JSON_OUT),
    JSON.stringify(
      {
        parts: measured.map((m) => ({ kind: m.kind, id: m.id, n: m.n, total: r2(m.total), max: r2(m.max), maxAt: m.maxAt, chunks: m.chunks.map(r2) })),
        byKind: [...byKind.values()].map((k) => ({ kind: k.kind, parts: k.parts, chunks: k.chunks.length, p50: r2(pct(k.chunks, 0.5)), p95: r2(pct(k.chunks, 0.95)), max: r2(Math.max(...k.chunks)) })),
      },
      null,
      2,
    ) + '\n',
  );
  say();
  say(`json: ${JSON_OUT}`);
}
