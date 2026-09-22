import { LayeredAudit } from './inspect-layered.mjs';
// Author CPU-only regression proof. Production sources are read from exact Git refs.
// Run: node art/environment/astra-bank-layered/check-geometry.mjs 445fa453 [candidate-ref]
// Each full-tree build runs in its own sequential process; all materials are inert.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const script = fileURLToPath(import.meta.url), here = path.dirname(script), root = path.resolve(here, '../../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, (_key, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
const arrayBytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16000000 }).trim();

function geometryRecord(g) {
  const attrs = Object.fromEntries(Object.keys(g.attributes).sort().map(name => {
    const a = g.attributes[name];
    assert.ok(!a.isInterleavedBufferAttribute, `Unsupported interleaved attribute: ${name}`);
    return [name, { type: a.array.constructor.name, itemSize: a.itemSize, normalized: a.normalized, count: a.count, bytes: a.array.byteLength, sha256: sha(arrayBytes(a.array)) }];
  }));
  const index = g.index ? { type: g.index.array.constructor.name, count: g.index.count, bytes: g.index.array.byteLength, sha256: sha(arrayBytes(g.index.array)) } : null;
  const payload = { attrs, index, groups: g.groups, drawRange: g.drawRange, morphTargetsRelative: g.morphTargetsRelative, morphAttributes: Object.keys(g.morphAttributes) };
  assert.equal(payload.morphAttributes.length, 0, 'Unexpected morph geometry requires explicit coverage');
  return { name: g.name, sha256: sha(json(payload)), vertices: g.attributes.position?.count ?? 0, triangles: (g.index?.count ?? g.attributes.position?.count ?? 0) / 3, bytes: Object.values(attrs).reduce((n, a) => n + a.bytes, index?.bytes ?? 0), bounds: g.boundingBox ? [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()] : null, sphere: g.boundingSphere ? [g.boundingSphere.center.toArray(), g.boundingSphere.radius] : null, ...payload };
}

async function worker(ref, enabled) {
  const started = performance.now();
  const sources = {}, modules = new Map(), assets = [], materials = [], calls = new Map();
  const layeredAudit = new LayeredAudit();
  let placementBinding;
  const recordAsset = (file, name, args, value) => {
    const key = `${file}:${name}`, ordinal = calls.get(key) ?? 0; calls.set(key, ordinal + 1);
    const geometry = [];
    const walk = (v, location, seen = new Set()) => {
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      if (v.isBufferGeometry) { geometry.push({ path: location, ...geometryRecord(v) }); return; }
      if (v.isObject3D) {
        v.traverse(o => { if (o.geometry) geometry.push({ path: `${location}/${o.name || o.type}`, ...geometryRecord(o.geometry) }); });
        return;
      }
      if (v.isMaterial || ArrayBuffer.isView(v)) return;
      for (const [k, child] of Object.entries(v)) walk(child, `${location}.${k}`, seen);
    };
    walk(value, 'asset');
    const input = name === 'createGiantTree' ? { def: args[0] } : name === 'createWhiteBarkRoots' ? { params: args[0], placements: args[1] } : { params: args[0], detail: args[2] };
        const bankProof = name === 'createGiantTree' && args[0].id === 'stair-bank-giant' ? layeredAudit.inspect(value, enabled, geometryRecord) : undefined;
    assets.push({ builder: key, ordinal, input, geometry, bankProof });
  };
  globalThis.__nonDistantReviewSnapshot = value => { assert.equal(placementBinding, undefined); placementBinding = value; };
  function load(file) {
    file = path.posix.normalize(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const original = ref === 'WORKTREE' ? fs.readFileSync(path.join(root, file), 'utf8') : cp.execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 16000000 });
    sources[file] = sha(original.replaceAll('\r\n', '\n'));
    let source = original.replaceAll('import.meta.env', `({VITE_BANK_LAYERED_CORE:'${enabled ? '1' : '0'}'})`);
    if (file === 'src/world/trees/index.ts') {
      const seam = "  ctx.progress('trees', 1);";
      assert.equal(source.split(seam).length, 2, 'Exactly one final build snapshot seam');
      source = source.replace(seam, `
  globalThis.__nonDistantReviewSnapshot({
    whites: whites.map(w => ({ params: w.params, placements: w.placements, matrices: w.matrices.map(m => m.toArray()) })),
    columns: seatedColumns.map(c => ({ params: c.params, placements: c.placements, matrices: c.matrices.map(m => m.toArray()) })),
    giants: giants.map(g => ({ def: g.def, origin: g.origin.toArray(), angle: g.angle })),
    nearBoles: nearBoles.map(p => ({ id: p.id, origin: p.origin.toArray(), cutY: p.cutY, band: p.band, rootsOnly: p.rootsOnly, kit: p.kit })),
    nearCanopies: nearCanopies.map(p => ({ id: p.id, tree: p.tree, kind: p.kind, root: p.root.toArray(), group: p.group, center: p.center.toArray(), inM: p.inM, outM: p.outM, fixedSwap: p.fixedSwap, persistent: p.persistent ?? false, hero: p.hero, triangles: p.triangles, leaves: p.leaves, farLeaves: p.farLeaves, farCards: p.farCards })),
    distantPlacements
  });
${seam}`);
    }
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return buffers;
      if (name === 'three/examples/jsm/loaders/GLTFLoader.js') return { GLTFLoader: class {} };
      if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), name + '.ts'));
      throw Error(`Unhandled CPU dependency: ${name}`);
    }, module, module.exports);
    if (file === 'src/world/trees/materials.ts') module.exports.createTreeMaterials = async () => {
      const names = ['whiteTree', 'whiteTreeDepth', 'giantTree', 'giantTreeDepth', 'giantTreeNear', 'columnTree', 'giantTreeNearBase', 'giantTreeNearCanopy', 'giantCanopy', 'giantCanopyDepth', 'distant'];
      const mats = Object.fromEntries(names.map(name => { const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }); mat.name = name; materials.push(mat); return [name, mat]; }));
      mats.nearBole = { value: Array.from({ length: module.exports.NEAR_BOLE_SLOTS }, () => new THREE.Vector4()) };
      mats.nearCanopy = { value: Array.from({ length: module.exports.NEAR_CANOPY_SLOTS }, () => new THREE.Vector4()) };
      mats.windLayers = 3; mats.barkTextureSets = [];
      return mats;
    };
    if (file === 'src/world/trees/distant.ts') module.exports.createDistantCrownMaterial = () => { const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }); mat.name = 'distant-crown'; materials.push(mat); return mat; };
    if (file === 'src/world/trees/writer.ts') layeredAudit.wrapWriter(module.exports);
    if (file === 'src/world/trees/nearCanopy.ts') layeredAudit.wrapKit(module.exports);
    const exportsToWrap = {
      'src/world/trees/whitebark.ts': ['createWhiteBarkTree', 'createWhiteBarkRoots'],
      'src/world/trees/column.ts': ['createColumnTree'],
      'src/world/trees/giant.ts': ['createGiantTree'],
    }[file] ?? [];
    for (const name of exportsToWrap) {
      const originalBuilder = module.exports[name];
      assert.equal(typeof originalBuilder, 'function');
      module.exports[name] = (...args) => { const asset = originalBuilder(...args); recordAsset(file, name, args, asset); return asset; };
    }
    return module.exports;
  }
  Object.defineProperty(globalThis, 'navigator', { value: { deviceMemory: 8 }, configurable: true });
  const { WORLD } = load('src/world/config.ts'), { LAYOUT } = load('src/world/layout.ts'), { createRng } = load('src/world/util/prng.ts');
  const camera = new THREE.PerspectiveCamera(46, 1280 / 720, 0.1, 500);
  camera.position.set(-1.96, 1.8, 4); camera.lookAt(10, 1, 1); camera.updateMatrixWorld();
  const quality = { tier: 'high', density: 1, distance: 1, shadows: true };
  let progress = -1;
  const ctx = {
    config: WORLD, layout: LAYOUT, terrain: load('src/world/terrain/heightfield.ts').getLegacyTerrain(), rng: createRng(WORLD.seed), camera, quality,
    renderer: { capabilities: { getMaxAnisotropy: () => 4 } }, textures: { load: async () => new THREE.Texture() }, shared: {},
    wind: load('src/world/wind/wind.ts').createWind(), audit() {},
    progress(_system, value) { const bucket = Math.floor(value * 10); if (bucket > progress) { progress = bucket; process.stderr.write(`${ref} CPU build ${Math.round(value * 100)}%\n`); } },
  };
  const trees = await load('src/world/trees/index.ts').create(ctx);
  assert.ok(placementBinding, 'Final placement binding observed');
  trees.group.updateMatrixWorld(true);
  const rendered = [];
  trees.group.traverse(object => {
    if (!object.isMesh) return;
    for (let ancestor = object; ancestor; ancestor = ancestor.parent) if (ancestor.name === 'distant-trees') return;
    if (object.name.startsWith('distant-')) return;
    const material = Array.isArray(object.material) ? object.material.map(m => m.name) : object.material.name;
    rendered.push({
      name: object.name, kind: object.userData.kind, geometry: geometryRecord(object.geometry), matrixWorld: object.matrixWorld.toArray(),
      visible: object.visible, castShadow: object.castShadow, receiveShadow: object.receiveShadow, material,
      instances: object.isInstancedMesh ? { count: object.count, capacity: object.instanceMatrix.count, matrixSha256: sha(arrayBytes(object.instanceMatrix.array)) } : null,
    });
  });
  const rows = assets.flatMap(asset => asset.geometry.map(g => ({ builder: asset.builder, ordinal: asset.ordinal, path: g.path, sha256: g.sha256 })));
  const nearRows = rows.filter(row => row.path.startsWith('asset.nearCanopy.'));
  const whiteRows = rows.filter(row => row.builder.includes('/whitebark.ts:'));
  const summary = {
    assetBuilds: assets.length, builtGeometryRecords: rows.length, nearCanopyParts: nearRows.length, whiteBarkGeometryRecords: whiteRows.length,
    sceneMeshRecords: rendered.length,
    allBuiltGeometrySha256: sha(json(rows)), nearCanopyGeometrySha256: sha(json(nearRows)), whiteBarkGeometrySha256: sha(json(whiteRows)),
    sourceAssetAndGeometrySha256: sha(json(assets)), sceneGeometryAndPlacementSha256: sha(json(rendered)), placementBindingSha256: sha(json(placementBinding)),
  };
  const result = {
    ref: ref === 'WORKTREE' ? 'WORKTREE@' + git('rev-parse', 'HEAD') : git('rev-parse', ref), flag: enabled ? '1' : '0', sourceHashes: sources,
    context: { worldSeed: WORLD.seed, worldSha256: sha(json(WORLD)), layoutSha256: sha(json(LAYOUT)), terrain: 'getLegacyTerrain(); source also uses getTerrain() internally for live expansion seats', quality, deviceMemoryGB: 8, camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, aspect: camera.aspect } },
    summary, assets, rendered, placementBinding,
  };
  trees.dispose();
  const disposed = new Set(); trees.group.traverse(o => { if (o.geometry && !disposed.has(o.geometry)) { disposed.add(o.geometry); o.geometry.dispose(); } });
  for (const material of materials) material.dispose();
  modules.clear(); delete globalThis.__nonDistantReviewSnapshot;
  if (globalThis.gc) globalThis.gc();
  result.elapsedSeconds = (performance.now() - started) / 1000;
  process.stdout.write(json(result));
}


if (process.argv[2] === '--worker') {
  await worker(process.argv[3], process.argv[4] === '1');
} else {
  const baseline=process.argv[2]??'445fa453', candidate=process.argv[3]??'WORKTREE';
  const run=(ref,flag)=>JSON.parse(cp.execFileSync(process.execPath,['--expose-gc','--max-old-space-size=4096',script,'--worker',ref,flag],{cwd:root,encoding:'utf8',maxBuffer:32000000,stdio:['ignore','pipe','inherit']}));
  const base=run(baseline,'0'),off=run(candidate,'0'),on=run(candidate,'1');
  assert.deepEqual(off.assets,base.assets,'Default-off assets exact');
  assert.deepEqual(off.rendered,base.rendered,'Default-off scene exact');
  assert.deepEqual(off.placementBinding,base.placementBinding,'Default-off placements exact');
  assert.deepEqual(on.context,base.context);
  const index=base.assets.findIndex(a=>a.builder.endsWith(':createGiantTree')&&a.input.def.id==='stair-bank-giant');
  const old=base.assets[index],changed=on.assets[index],proof=changed.bankProof;
  const body=old.geometry.find(g=>g.path==='asset.authoredLeaves'),bodyOn=changed.geometry.find(g=>g.path===body.path);
  const oldPos=Buffer.from(old.bankProof.positionsBase64,'base64'),newPos=Buffer.from(proof.positionsBase64,'base64');
  assert.equal(oldPos.length,newPos.length);
  const allowed=new Map();
  for(const g of proof.groups) for(const id of g.coreIds)allowed.set(id,g.centerLocal);
  let changedCoreVertices=0,maxRecessionError=0;
  for(let v=0;v<oldPos.length/12;v++) {
    const center=allowed.get(v); let different=false;
    for(let c=0;c<3;c++) {
      const a=oldPos.readFloatLE(v*12+c*4),b=newPos.readFloatLE(v*12+c*4);
      if(!center)assert.equal(b,a,'Non-core original vertex exact');
      else maxRecessionError=Math.max(maxRecessionError,Math.abs(b-(center[c]+0.6*(a-center[c]))));
      different ||= a!==b;
    }
    if(different)changedCoreVertices++;
  }
  assert.equal(changedCoreVertices,1479);
  assert(maxRecessionError<1e-6);
  for(const [name,attr] of Object.entries(body.attrs))if(name!=='position')assert.deepEqual(bodyOn.attrs[name],attr,'Original '+name+' exact');
  assert.deepEqual(bodyOn.index,body.index);
  assert.deepEqual(bodyOn.bounds,body.bounds,'Conservative authored box exact');
  assert.deepEqual(bodyOn.sphere,body.sphere,'Conservative authored sphere exact');
  const changedPaths=new Set(['asset.authoredLeaves',...proof.groups.map(g=>'asset.nearCanopy.'+g.partIndex+'.geometry')]);
  const normalized=structuredClone(on.assets);
  normalized[index].bankProof=old.bankProof;
  normalized[index].geometry=normalized[index].geometry.map(g=>changedPaths.has(g.path)?old.geometry.find(x=>x.path===g.path):g);
  assert.deepEqual(normalized,base.assets,'All560 other built geometries exact');
  const selectedNames=new Set(proof.groups.map(g=>'giant-near-canopy-stair-bank-giant-lobe-'+g.partIndex));
  const normalizedScene=on.rendered.map(r=>{
    if(r.name==='giants-authored-leaves-stair-bank-giant'||selectedNames.has(r.name)) {
      const oldRow=base.rendered.find(b=>b.name===r.name);assert(oldRow);
      if(selectedNames.has(r.name)) {assert.equal(r.visible,true);assert.equal(r.castShadow,false);assert.equal(r.material,'giantTreeNearCanopy');}
      return {...r,geometry:oldRow.geometry,visible:oldRow.visible};
    }
    return r;
  });
  assert.deepEqual(normalizedScene,base.rendered,'Unrelated scene geometry/transforms/material/shadow flags exact');
  const bindings=structuredClone(on.placementBinding);
  for(const p of bindings.nearCanopies)if(p.tree==='stair-bank-giant'&&[24,25,26].includes(p.group)&&p.kind==='lobe') {
    const prior=base.placementBinding.nearCanopies.find(n=>n.id===p.id);
    assert.equal(p.persistent,true);
    assert.deepEqual(p.center,prior.center);assert.deepEqual(p.root,prior.root);
    assert.equal(p.farLeaves,prior.farLeaves);assert.equal(p.farCards,prior.farCards);
    for(const k of ['inM','outM','hero','triangles','leaves','persistent'])p[k]=prior[k];
  }
  assert.deepEqual(bindings,base.placementBinding,'All other placement/LOD bindings exact');
  const changedSources=Object.keys(on.sourceHashes).filter(f=>on.sourceHashes[f]!==base.sourceHashes[f]).sort();
  assert.deepEqual(changedSources,['src/world/trees/giant.ts','src/world/trees/index.ts','src/world/trees/nearCanopy.ts']);
  const cost={leaves:proof.groups.reduce((n,g)=>n+g.near.leaves,0),triangles:proof.groups.reduce((n,g)=>n+g.near.triangles,0),woodTriangles:proof.groups.reduce((n,g)=>n+g.near.woodTriangles,0),residentBytes:proof.groups.reduce((n,g)=>n+g.near.bytes,0),additionalVisibleMeshes:3};
  assert.equal(cost.leaves,7100);assert(cost.triangles<=69868);
  const report={verdict:'PASS',baseline:base.ref,candidate:on.ref,flag:'VITE_BANK_LAYERED_CORE=1',changedSources,cost,changedCoreVertices,maxRecessionError,exactUnrelatedGeometryRecords:base.summary.builtGeometryRecords-4,exactOtherNearParts:base.summary.nearCanopyParts-3,whiteBarkGeometryRecords:base.summary.whiteBarkGeometryRecords,groups:proof.groups,baselineSummary:base.summary,
    sourceBindings:{baseline:base.sourceHashes,candidate:on.sourceHashes},
    checks:['default-off all assets/scene exact','only1479 selected core vertices changed,scale0.60','original non-position attributes and indices exact','authored conservative box/sphere exact','560other built geometry records exact','423other near parts and all31white-bark records exact','unrelated placements/LOD/shadow/material bindings exact','7100accepted whole leaves under69868triangle ceiling','retained branches anchored to recorded/earlier wood','deterministic chunked rebuilds exact','authored0.6/0.6/0.85leaf tones local','all new vertices inside original envelope with8cm margin','analytic all-phase current-wind envelope/floor containment'],
    windAssumptions:{strength:.85,treeStiffness:.97,flex:.3,gust:[0,1],windFieldBound:1,leafVerticalFactor:.4,method:'Absolute sine/product bounds per actual aWind/aRoot vertex; not sampled times'},
    limitations:['CPU only; no shader/render quality claim.','Actual geometry extrema can shrink even though conservative culling bounds remain exact.','Persistent selected parts add up to3 rendered draws; zero new mesh objects.','Petiole-centreline distances bound source-kit attachment scale, not exact bark-surface intersections.'],
    runs:{base,offSummary:off.summary,on}};
  fs.writeFileSync(path.join(here,'cpu-report.json'),JSON.stringify(report,null,2)+'\n');
  const {runs,...compact}=report;fs.writeFileSync(path.join(here,'cpu-summary.json'),JSON.stringify({...compact,rawReportSha256:sha(fs.readFileSync(path.join(here,'cpu-report.json')))},null,2)+'\n');
  console.log(JSON.stringify({verdict:report.verdict,cost,changedCoreVertices,exactUnrelatedGeometryRecords:report.exactUnrelatedGeometryRecords,groups:report.groups.map(g=>({group:g.group,near:g.near,analyticWorldBounds:g.analyticWorldBounds,minAnalyticMargin:g.minAnalyticMargin,maxBranchAnchorGap:g.maxBranchAnchorGap,maxPetioleToPath:g.maxPetioleToPath}))},null,2));
}
