// Supplement to the frozen geometry report: every PRNG stream plus original far-fringe wind.
// CPU only; no shader compilation. node .../check-streams-and-floor.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const script = fileURLToPath(import.meta.url), dir = path.dirname(script), cwd = path.resolve(dir, '../../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => cp.execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16000000 });
const json = value => JSON.stringify(value);
async function worker(ref, flag) {
  const modules = new Map(), sourceBindings = {}, streams = new Map(), materials = [], groups = [];
  const bytes = Buffer.alloc(8);
  let worldWind;
  globalThis.__recordBankRng = (seed, value) => {
    if (!streams.has(seed)) streams.set(seed, { draws: 0, hash: crypto.createHash('sha256') });
    const s = streams.get(seed); s.draws++; bytes.writeDoubleLE(value); s.hash.update(bytes);
  };
  const worldBox = (box, origin) => ({ min: box.min.clone().add(origin).toArray(), max: box.max.clone().add(origin).toArray() });
  function inspect(def, asset) {
    const part24 = asset.nearCanopy.find(p => p.kind === 'lobe' && p.group === 24);
    const origin = new T.Vector3(def.position[0], 3.4 - part24.center.y, def.position[2]);
    for (const group of [24, 25, 26]) {
      const part = asset.nearCanopy.find(p => p.kind === 'lobe' && p.group === group);
      const allStatic = new T.Box3(), allWind = new T.Box3(), farWind = new T.Box3(), nearWind = new T.Box3();
      for (const [kind, geo] of [['far', asset.authoredLeaves], ['near', part.geometry]]) {
        const p = geo.attributes.position, r = geo.attributes.aRoot, w = geo.attributes.aWind;
        for (let i = 0; i < p.count; i++) {
          if (kind === 'far' && !(r.getW(i) >= 999 && Math.floor(r.getW(i) - 1000 + 0.01) === group)) continue;
          const q = new T.Vector3().fromBufferAttribute(p, i), h = Math.max(0, q.y - r.getY(i));
          // Source-seam assertions below bind these coefficients to the actual shader.
          const branch = ((1 - 0.97) + (1 - w.getX(i)) * 0.5 * 0.3) * worldWind.strength * 0.06 * h;
          const leaf = Math.max(0, w.getZ(i)) * worldWind.strength;
          const delta = new T.Vector3(Math.abs(worldWind.direction.x) * branch + 0.6 * leaf, 0.4 * leaf, Math.abs(worldWind.direction.y) * branch + 0.5 * leaf);
          const a = q.clone().sub(delta), b = q.clone().add(delta);
          allStatic.expandByPoint(q); allWind.expandByPoint(a); allWind.expandByPoint(b);
          (kind === 'far' ? farWind : nearWind).expandByPoint(a).expandByPoint(b);
        }
      }
      if (flag === '1' && group === 26) assert(allWind.min.y + origin.y >= 4.75, 'Selected far lamina/core and new near geometry above floor; original alpha cards are separately unchanged');
      groups.push({ group, allStaticWorld: worldBox(allStatic, origin), allAnalyticWorld: worldBox(allWind, origin), farAnalyticWorld: worldBox(farWind, origin), nearAnalyticWorld: worldBox(nearWind, origin) });
    }
  }
  function load(file) {
    file = path.posix.normalize(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const original = git('show', `${ref}:${file}`).replaceAll('\r\n', '\n'); sourceBindings[file] = sha(original);
    let source = original.replaceAll('import.meta.env', `({VITE_BANK_LAYERED_CORE:'${flag}'})`);
    if (file === 'src/world/util/prng.ts') {
      const seam = 'return ((n ^ (n >>> 14)) >>> 0) / 4294967296;';
      assert.equal(source.split(seam).length, 2);
      source = source.replace(seam, 'const value = ((n ^ (n >>> 14)) >>> 0) / 4294967296; globalThis.__recordBankRng(seed, value); return value;');
    }
    if (file === 'src/world/trees/materials.ts') {
      for (const seam of ['const giantWind = { treeStiffness: 0.97, flex: 0.3 };', 'windBranch(treeRoot.xyz, hAbove, uTreeStiff)', 'windBranch(flexP, hAbove * 0.5, aWind.x) * uFlex', 'windLeaf(treeP.xyz, aWind.y, max(aWind.z, 0.0))']) assert(source.includes(seam), seam);
    }
    if (file === 'src/world/wind/wind.ts') {
      for (const seam of ['return (a * 0.5 + b * 0.35 + c * 0.15);', 'vec3(f1 * 0.6, f2 * 0.4, f1 * f2 * 0.5)', '(1.0 - stiffness) * uWindStrength * 0.06 * heightAboveGround', 'Math.min(1, g * 0.8 + push * 0.6)']) assert(source.includes(seam), seam);
    }
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name === 'three') return T;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return buffers;
      if (name === 'three/examples/jsm/loaders/GLTFLoader.js') return { GLTFLoader: class {} };
      if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), name + '.ts'));
      throw Error(name);
    }, module, module.exports);
    if (file === 'src/world/trees/materials.ts') module.exports.createTreeMaterials = async () => {
      const names = ['whiteTree', 'whiteTreeDepth', 'giantTree', 'giantTreeDepth', 'giantTreeNear', 'columnTree', 'giantTreeNearBase', 'giantTreeNearCanopy', 'giantCanopy', 'giantCanopyDepth', 'distant'];
      const m = Object.fromEntries(names.map(n => { const mat = new T.MeshStandardMaterial({ side: T.DoubleSide }); materials.push(mat); return [n, mat]; }));
      m.nearBole = { value: Array.from({ length: module.exports.NEAR_BOLE_SLOTS }, () => new T.Vector4()) };
      m.nearCanopy = { value: Array.from({ length: module.exports.NEAR_CANOPY_SLOTS }, () => new T.Vector4()) }; m.windLayers = 3; m.barkTextureSets = []; return m;
    };
    if (file === 'src/world/trees/distant.ts') module.exports.createDistantCrownMaterial = () => new T.MeshStandardMaterial();
    if (file === 'src/world/trees/giant.ts') {
      const create = module.exports.createGiantTree;
      module.exports.createGiantTree = (...args) => { const asset = create(...args); if (args[0].id === 'stair-bank-giant') inspect(args[0], asset); return asset; };
    }
    return module.exports;
  }
  Object.defineProperty(globalThis, 'navigator', { value: { deviceMemory: 8 }, configurable: true });
  const { WORLD } = load('src/world/config.ts'), { LAYOUT } = load('src/world/layout.ts'), { createRng } = load('src/world/util/prng.ts');
  const camera = new T.PerspectiveCamera(46, 1280 / 720, 0.1, 500); camera.position.set(-1.96, 1.8, 4); camera.lookAt(10, 1, 1); camera.updateMatrixWorld();
  worldWind = load('src/world/wind/wind.ts').createWind(); assert.equal(worldWind.strength, 0.85);
  const ctx = { config: WORLD, layout: LAYOUT, terrain: load('src/world/terrain/heightfield.ts').getLegacyTerrain(), rng: createRng(WORLD.seed), camera, quality: { tier: 'high', density: 1, distance: 1, shadows: true }, renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, textures: { load: async () => new T.Texture() }, shared: {}, wind: worldWind, progress() {}, audit() {} };
  const trees = await load('src/world/trees/index.ts').create(ctx);
  const rngStreams = [...streams].map(([seed, s]) => ({ seed, draws: s.draws, sha256: s.hash.digest('hex') })).sort((a, b) => a.seed.localeCompare(b.seed));
  trees.dispose(); for (const mat of materials) mat.dispose();
  process.stdout.write(json({ ref: git('rev-parse', ref).trim(), flag, sourceBindings, rngStreams, groups }));
}
if (process.argv[2] === '--worker') await worker(process.argv[3], process.argv[4]);
else {
  const run = (ref, flag) => JSON.parse(cp.execFileSync(process.execPath, ['--max-old-space-size=4096', script, '--worker', ref, flag], { cwd, encoding: 'utf8', maxBuffer: 32000000 }));
  const before = run(process.argv[2] || '68b3eb96', '0'), after = run(process.argv[3] || '588d3681', '1');
  const bySeed = new Map(before.rngStreams.map(s => [s.seed, s]));
  const changed = after.rngStreams.filter(s => json(s) !== json(bySeed.get(s.seed)));
  const allowed = seed => /\/giant\/stair-bank-giant\/near-canopy\/lobe\/(24|25|26)(\/|$)/.test(seed);
  assert(changed.length > 0);
  for (const row of changed) assert(allowed(row.seed), `Unrelated RNG stream changed: ${row.seed}`);
  for (const row of before.rngStreams) assert(after.rngStreams.some(s => s.seed === row.seed), `Stream disappeared: ${row.seed}`);
  const unchanged = after.rngStreams.filter(s => !allowed(s.seed));
  assert.deepEqual(unchanged, before.rngStreams.filter(s => !allowed(s.seed)));
  const report = { verdict: 'PASS', baseline: before.ref, candidate: after.ref, sourceBindings: after.sourceBindings,
    rng: { exactStreams: unchanged.length, exactDraws: unchanged.reduce((n, s) => n + s.draws, 0), exactStreamAggregateSha256: sha(json(unchanged)), changedLocalStreams: changed },
    candidateBounds: after.groups, baselineBounds: before.groups,
    windMethod: 'Per actual vertex aRoot/aWind and actual createWind strength/direction. Source assertions bind .97 stiffness, .3 flex, .06 branch scale, .5 branch height, .6/.4/.5 leaf factors, positive field weights summing to1 and gust in[0,1]. Absolute sine/product bounds cover every phase. Original far lamina/core are included. Existing alpha cards are excluded from the floor assertion: their below-floor vertices predate this candidate and are byte-exact in the geometry proof.' };
  fs.writeFileSync(path.join(dir, 'streams-and-floor.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(json({ verdict: report.verdict, rng: report.rng, group26: after.groups.find(g => g.group === 26) }));
}
