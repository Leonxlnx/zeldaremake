// CPU-only native-F projection, depth and independent ray diagnostics. No renderer or production edits.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as T from 'three';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { measureScreen } from './screen-project.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, '../../..');
const ref = process.argv[2] || '588d3681';
const nativePath='E:/zeldaremake-astra-bank-delivery/art/environment/astra-bank-backing/native-pair/after/manifest.json';
const nativeBytes=fs.readFileSync(nativePath),native=JSON.parse(nativeBytes);
const modules = new Map(), records = new Map(), sources = {};
const stop = new Error('bank inspected');
const jsonBox = box => ({ min: box.min.toArray(), max: box.max.toArray() });
let report;
function inspect(asset) {
 const origin=new T.Vector3(10.6,3.4-records.get(24).center.y,9.15);
 const selected=[asset.authoredLeaves,...asset.nearCanopy.filter(p=>p.kind==='lobe'&&[24,25,26].includes(p.group)).map(p=>p.geometry)];
 const compact=modules.get('src/world/trees/index.ts')?.exports.__compactAttributes;
 if(compact)for(const g of selected)compact(g);
 report={views:Object.fromEntries(['F_canopy','C_lookback'].map(view=>[view,measureScreen(asset,records,origin,native,view)]))};
 report.attributePacking={applied:!!compact,method:'The exact Git source compactAttributes helper from trees/index.ts is exposed only inside this CPU loader and applied to the inspected geometries before reading attributes. No renderer/upload occurs.',geometries:selected.map(g=>({name:g.name,windType:g.attributes.aWind.array.constructor.name,windNormalized:g.attributes.aWind.normalized}))};
 report.nativeManifest={path:nativePath,sha256:crypto.createHash('sha256').update(nativeBytes).digest('hex')};
}
function load(file) {
  file = path.posix.normalize(file); if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const original = cp.execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 16000000 }).replaceAll('\r\n', '\n');
  sources[file] = crypto.createHash('sha256').update(original).digest('hex');
  let source = original.replaceAll('import.meta.env', '({})');
  if(file==='src/world/trees/index.ts'&&source.includes('const compactAttributes ='))source+='\nexport { compactAttributes as __compactAttributes };\n';
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => {
    if (name === 'three') return T;
    if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return buffers;
    if (name === 'three/examples/jsm/loaders/GLTFLoader.js') return { GLTFLoader: class {} };
    if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), name + '.ts'));
    throw Error(name);
  }, module, module.exports);
  if (file === 'src/world/trees/materials.ts') module.exports.createTreeMaterials = async () => {
    const names = ['whiteTree','whiteTreeDepth','giantTree','giantTreeDepth','giantTreeNear','columnTree','giantTreeNearBase','giantTreeNearCanopy','giantCanopy','giantCanopyDepth','distant'];
    const m = Object.fromEntries(names.map(name => [name, new T.MeshStandardMaterial({ side: T.DoubleSide })]));
    m.nearBole = { value: Array.from({ length: module.exports.NEAR_BOLE_SLOTS }, () => new T.Vector4()) };
    m.nearCanopy = { value: Array.from({ length: module.exports.NEAR_CANOPY_SLOTS }, () => new T.Vector4()) }; m.windLayers = 3; m.barkTextureSets = []; return m;
  };
  if (file === 'src/world/trees/distant.ts') module.exports.createDistantCrownMaterial = () => new T.MeshStandardMaterial();
  if (file === 'src/world/trees/nearCanopy.ts') {
    const create = module.exports.createNearCanopyKit;
    module.exports.createNearCanopyKit = o => {
      const kit = create(o), part = kit.lobePart;
      kit.lobePart = (rng, rec, idx) => { if (o.id === 'giant-stair-bank-giant' && [24,25,26].includes(rec.group)) records.set(rec.group, rec); return part(rng, rec, idx); };
      return kit;
    };
  }
  if (file === 'src/world/trees/giant.ts') {
    const create = module.exports.createGiantTree;
    module.exports.createGiantTree = (def, rng, options) => { const asset = create(def, rng, options); if (def.id === 'stair-bank-giant') { inspect(asset); throw stop; } return asset; };
  }
  return module.exports;
}
Object.defineProperty(globalThis, 'navigator', { value: { deviceMemory: 8 }, configurable: true });
const { WORLD } = load('src/world/config.ts'), { LAYOUT } = load('src/world/layout.ts'), { createRng } = load('src/world/util/prng.ts');
const camera = new T.PerspectiveCamera(46, 1280/720, .1, 500); camera.position.set(-1.96, 1.8, 4); camera.lookAt(10,1,1); camera.updateMatrixWorld();
const ctx = { config: WORLD, layout: LAYOUT, terrain: load('src/world/terrain/heightfield.ts').getLegacyTerrain(), rng: createRng(WORLD.seed), camera, quality: { tier:'high',density:1,distance:1,shadows:true }, renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, textures: { load: async () => new T.Texture() }, shared: {}, wind: load('src/world/wind/wind.ts').createWind(), progress() {}, audit() {} };
try { await load('src/world/trees/index.ts').create(ctx); } catch (error) { if (error !== stop) throw error; }
assert(report); report.sources = sources;
report.sourceRef=cp.execFileSync('git',['rev-parse',ref],{cwd:root,encoding:'utf8'}).trim();
report.analysisScripts=Object.fromEntries(['measure-screen.mjs','screen-project.mjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')]));
fs.writeFileSync(path.join(dir, `screen-${ref}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({sourceRef:report.sourceRef,views:Object.fromEntries(Object.entries(report.views).map(([view,r])=>[view,{overall:r.overall,overlap:r.overlap,floor:r.floor,contiguous:r.contiguous.frontmostCore,outsideCoreMask:r.outsideCoreMask}]))},null,2));
