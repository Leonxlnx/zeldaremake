/** CPU-only replay: node art/environment/astra-safe-world-review/stair-geometry-check.mjs */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const out = path.dirname(fileURLToPath(import.meta.url));
const candidateRoot = path.resolve(out, '../../..');
const baselineRoot = path.resolve(candidateRoot, '../zeldaremake-astra-motion-sept21');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

// Same transpile/CommonJS loader as hardscape/*.test.mjs; read immutable Git objects so
// parallel work cannot change this comparison's inputs after the native captures.
function build(root, commit) {
  const modules = new Map();
  const sourceHashes = {};
  function load(file) {
    file = path.resolve(root, file);
    if (modules.has(file)) return modules.get(file).exports;
    const relative = path.relative(root, file).split(path.sep).join('/');
    const source = execFileSync('git', ['show', `${commit}:${relative}`], { cwd: root });
    sourceHashes[relative] = sha(source);
    const module = { exports: {} };
    modules.set(file, module);
    const js = ts.transpileModule(source.toString('utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', js)((name) => {
      if (name === 'three') return THREE;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const p of [target, `${target}.ts`, path.join(target, 'index.ts')]) {
          if (p.endsWith('.ts') && existsSync(p)) return load(p);
        }
      }
      throw new Error(`Unexpected dependency ${name} from ${relative}`);
    }, module, module.exports);
    return module.exports;
  }
  const { WORLD } = load('src/world/config.ts');
  const { LAYOUT } = load('src/world/layout.ts');
  const { createTerrain } = load('src/world/terrain/heightfield.ts');
  const { createRng } = load('src/world/util/prng.ts');
  const { buildStairway } = load('src/world/hardscape/stairs.ts');
  const { buildLogNosings, STAIR_LOGS, LOG_FLIGHTS } = load('src/world/hardscape/logNosings.ts');
  const def = LAYOUT.stairs.find((s) => s.id === 'main');
  const logNosed = STAIR_LOGS && LOG_FLIGHTS.has(def.id);
  const stairs = buildStairway(def, createTerrain('live'), createRng(WORLD.seed).fork('hardscape').fork('stairs-main'), WORLD.seed, { logNosed });
  const logs = buildLogNosings(def, WORLD.seed);
  return { commit, sourceHashes, seed: WORLD.seed, def, logNosed, stairs, logs };
}

function geometry(g) {
  return Object.fromEntries([...Object.entries(g.attributes), ['index', g.index]].map(([name, attr]) => [name,
    attr ? { count: attr.count, itemSize: attr.itemSize, type: attr.array.constructor.name, sha256: sha(bytes(attr.array)) } : null,
  ]));
}

const base = build(baselineRoot, '4ad2fb50');
const candidate = build(candidateRoot, '4b2fe8e6');
assert.deepEqual(base.def, candidate.def);
assert.equal(base.seed, candidate.seed);
const baselineGeometry = geometry(base.stairs.geometry);
const candidateGeometry = geometry(candidate.stairs.geometry);
const equal = Object.fromEntries(Object.keys({ ...baselineGeometry, ...candidateGeometry }).map((k) => [k, JSON.stringify(baselineGeometry[k]) === JSON.stringify(candidateGeometry[k])]));
for (const name of ['position', 'normal', 'index']) assert.equal(equal[name], true, `main stairs ${name} changed`);
assert.deepEqual(base.stairs.treadNose, candidate.stairs.treadNose);
assert.deepEqual(base.stairs.shapeHashes, candidate.stairs.shapeHashes);
const receipt = {
  method: 'Actual buildStairway CPU output, production seed / hardscape / stairs-main RNG fork, live terrain, production logNosed setting; immutable Git sources; no GPU.',
  baseline: { commit: base.commit, sourceHashes: base.sourceHashes, geometry: baselineGeometry },
  candidate: { commit: candidate.commit, sourceHashes: candidate.sourceHashes, geometry: candidateGeometry },
  seed: base.seed, mainFlight: base.def, equal, treadNoseExact: true, outlineHashesExact: true,
  triangles: { baseline: base.stairs.triangles, candidate: candidate.stairs.triangles },
  logs: {
    baseline: { geometry: geometry(base.logs.geometry), logs: base.logs.logs, stakes: base.logs.stakes, triangles: base.logs.triangles },
    candidate: { geometry: geometry(candidate.logs.geometry), logs: candidate.logs.logs, stakes: candidate.logs.stakes, triangles: candidate.logs.triangles },
  },
  conclusion: 'The combined main-flight stone mesh (treads, risers, cheeks and landing) has byte-identical position and normal arrays and identical triangle connectivity. The import cannot create a new hole by moving/removing these stone triangles. Log geometry and shading did change, so their coverage and the visibility/contrast of existing joins can change. This CPU receipt alone does not classify the visible dark pixels as empty space versus shaded faces.',
};
writeFileSync(path.join(out, 'stair-geometry-check.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ equal, triangles: receipt.triangles, logTriangles: [base.logs.triangles, candidate.logs.triangles], conclusion: receipt.conclusion }, null, 2));
