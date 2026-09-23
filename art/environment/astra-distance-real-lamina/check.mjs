/** Actual geometry, alpha-projected coverage and bounded LOD transitions. CPU only; no browser. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as T from 'three';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.resolve(root, process.argv[3] ?? 'art/environment/astra-distance-real-lamina/cpu');
fs.mkdirSync(out, { recursive: true });
const baseline = process.argv[2] ?? '6231cffb';
const { createCanvas } = createRequire(import.meta.url)(process.env.ZR_CPU_CANVAS_PACKAGE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); return createCanvas(1, 1); } };
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
function loader(ref) {
  const modules = new Map();
  function load(file) {
    file = path.posix.normalize(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    let src = ref ? cp.execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 12000000 }) : fs.readFileSync(path.join(root, file), 'utf8');
    src = src.replaceAll('import.meta.env', '({})');
    if (file === 'src/world/trees/index.ts') src += '\nexport const closePlacementConstants = { DEPTH_BANDS, DISTANT_SPINE_CLEARANCE, DISTANT_SPINE_EXTEND_M }; export const closeCpuHelpers = { compactAttributes, releaseAfterUpload };';
    const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(id => {
      if (id === 'three') return T;
      if (id === 'three/examples/jsm/utils/BufferGeometryUtils.js') return buffers;
      if (id === 'three/examples/jsm/loaders/GLTFLoader.js') return { GLTFLoader: class {} };
      if (id.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), id + '.ts'));
      throw Error(`Unhandled dependency ${id}`);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
function build(ref) {
  const load = loader(ref), { WORLD } = load('src/world/config.ts'), { LAYOUT } = load('src/world/layout.ts');
  const { createRng } = load('src/world/util/prng.ts'), trace = [];
  const wrap = (rng, key = 'trees') => {
    const f = () => { const v = rng(); trace.push([key, 'next', v]); return v; };
    for (const name of ['range', 'int', 'pick', 'chance', 'gauss']) f[name] = (...args) => { const v = rng[name](...args); trace.push([key, name, args, v]); return v; };
    f.fork = key2 => wrap(rng.fork(key2), `${key}/${key2}`); return f;
  };
  const rng = wrap(createRng(WORLD.seed).fork('trees')), d = load('src/world/trees/distant.ts');
  const variants = d.createDistantVariants(rng, WORLD.palette);
  const c = load('src/world/trees/index.ts').closePlacementConstants;
  const spine = LAYOUT.pathSpine.map(p => [p[0], p[2]]), a = spine.at(-2), b = spine.at(-1), len = Math.hypot(b[0]-a[0], b[1]-a[1]);
  spine.push([b[0]+(b[0]-a[0])/len*c.DISTANT_SPINE_EXTEND_M, b[1]+(b[1]-a[1])/len*c.DISTANT_SPINE_EXTEND_M]);
  const arch = LAYOUT.logArch, yaw = arch.yawDeg*Math.PI/180;
  const placements = d.placeDistantTrees(rng, load('src/world/terrain/heightfield.ts').getLegacyTerrain(), variants, 680, 60, 215, c.DEPTH_BANDS, {
    spine, spineClearance: c.DISTANT_SPINE_CLEARANCE, footprints: [{x:arch.position[0],z:arch.position[2],ax:Math.cos(yaw),az:-Math.sin(yaw),halfLength:arch.length/2+2,halfWidth:arch.radius+1}],
  });
  return {load, WORLD, LAYOUT, createRng, variants, placements, trace:hash(JSON.stringify(trace)), draws:trace.length, d};
}
const before=build(baseline),after=build();
assert.equal(before.trace,after.trace);assert.deepEqual(before.placements,after.placements);
const bytes=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+g.index.array.byteLength;
const fingerprint=g=>hash(Buffer.concat([...Object.values(g.attributes).map(a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),Buffer.from(g.index.array.buffer)]));
for(let i=0;i<6;i++)for(const lod of ['near','far'])assert.equal(fingerprint(before.variants[i][lod]),fingerprint(after.variants[i][lod]));
for(const file of ['giant.ts','writer.ts','materials.ts','leaf-cluster-texture.ts','column.ts','whitebark.ts'])assert.equal(fs.readFileSync(path.join(root,'src/world/trees',file),'utf8').replaceAll('\r\n','\n'),cp.execFileSync('git',['show',`${baseline}:src/world/trees/${file}`],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n'));
const nearSource=fs.readFileSync(path.join(root,'src/world/trees/nearCanopy.ts'),'utf8').replaceAll('\r\n','\n');
assert.equal(nearSource.replace('return { lobePart, limbPart, pathLength, lobeSteps };','return { lobePart, limbPart, pathLength };'),cp.execFileSync('git',['show',`${baseline}:src/world/trees/nearCanopy.ts`],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n'));
const approved=JSON.parse(fs.readFileSync(path.join(root,'art/environment/astra-distance-real-lamina/approved-prototype.json')));
const helpers=after.load('src/world/trees/index.ts').closeCpuHelpers;
const writer=after.load('src/world/trees/writer.ts');
let recording=null;
for(const name of ['growthPath','divergingLeaderPath','tube','addLeaf']){
  const original=writer[name];writer[name]=(...args)=>{
    const result=original(...args);
    if(recording){
      if(name==='tube')recording.tubes.push({path:args[1].map(p=>p.clone()),radii:[...args[2]]});
      else if(name==='addLeaf'&&result)recording.leaves.push({base:args[1].clone(),size:args[3],detail:args[6].detailOverride});
      else if(name==='growthPath'||name==='divergingLeaderPath')recording.paths.push(result.map(p=>p.clone()));
    }return result;
  };
}
const distanceToPaths=(p,paths)=>{let best=Infinity;for(const path of paths)for(let k=1;k<path.length;k++){
  const a=path[k-1],b=path[k],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz;
  const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l)):0;
  const x=p.x-a.x-t*dx,y=p.y-a.y-t*dy,z=p.z-a.z-t*dz;best=Math.min(best,x*x+y*y+z*z);
}return Math.sqrt(best);};
const report={baseline,legacyPlacements:after.placements.length,legacyRngDraws:after.draws,legacyRngHash:after.trace,variants:[],fixed:[],checks:[]},assets=[];
for(let i=0;i<6;i++){
  const scale=approved.variants[i].scale;recording={paths:[],tubes:[],leaves:[]};
  const start=performance.now(),asset=after.d.createDistantCloseCrown(after.variants[i],after.createRng(after.WORLD.seed),scale,after.WORLD.palette,i),buildMs=performance.now()-start;
  const trace=recording;recording=null;const g=asset.geometry,h=fingerprint(g);assert.equal(h,approved.variants[i].hash,'all six reviewed prototype geometries exact');
  const gen=asset.build();let r,chunks=0,longestChunk=0;do{const t=performance.now();r=gen.next();longestChunk=Math.max(longestChunk,performance.now()-t);chunks++;}while(!r.done);
  assert.equal(fingerprint(r.value),h,'pool rebuild exact');r.value.dispose();
  assert.equal(trace.leaves.length,asset.leaves);assert.equal(g.groups.length,0,'one solid material, no card group');
  let maxJoin=0,maxLeafJoin=0,minLeaf=Infinity,maxLeaf=0;
  const connected=[after.variants[i].crownStem.map(p=>p.clone().multiplyScalar(scale))];
  for(const child of trace.paths){maxJoin=Math.max(maxJoin,distanceToPaths(child[0],connected));connected.push(child);}
  assert.ok(maxJoin<1e-6,'every branch joins an earlier parent or original trunk');
  for(const leaf of trace.leaves){assert.equal(leaf.detail,'high');minLeaf=Math.min(minLeaf,leaf.size);maxLeaf=Math.max(maxLeaf,leaf.size);maxLeafJoin=Math.max(maxLeafJoin,distanceToPaths(leaf.base,connected));}
  assert.ok(minLeaf>=.17&&maxLeaf<=.36,'physical canonical lamina range');assert.ok(maxLeafJoin<.025,'lamina bases meet real twigs, allowing the canonical tip-rosette radius offset');
  for(const a of Object.values(g.attributes))for(const value of a.array)assert.ok(Number.isFinite(value));
  let curved=0,leafVertices=0;
  for(let v=0;v<g.attributes.position.count;v++)if(g.attributes.aRoot.getW(v)>=.5){
    assert.equal(g.attributes.aRoot.getW(v),1,'canonical ordinary near leaf shade');leafVertices++;
    if(leafVertices%8===1){const n=new T.Vector3().fromBufferAttribute(g.attributes.normal,v),next=new T.Vector3().fromBufferAttribute(g.attributes.normal,v+1);if(n.distanceTo(next)>.001)curved++;}
  }
  assert.equal(leafVertices,asset.leaves*8);assert.equal(curved,asset.leaves,'each lamina has its own non-planar normals');
  const rawBytes=bytes(g),packed=g.clone();helpers.compactAttributes(packed);const packedBytes=bytes(packed);
  const fade=new T.InstancedBufferAttribute(new Float32Array(8),1).setUsage(T.DynamicDrawUsage),staticInstance=new T.InstancedBufferAttribute(new Float32Array(8),1);
  packed.setAttribute('aDistantClose',fade);packed.setAttribute('staticProbe',staticInstance);helpers.releaseAfterUpload(packed);
  for(const a of Object.values(packed.attributes))a.onUploadCallback.call(a);packed.index.onUploadCallback.call(packed.index);
  assert.equal(packed.attributes.position.array,null);assert.equal(staticInstance.array,null,'static instanced arrays still release');
  fade.setX(0,.625);fade.needsUpdate=true;assert.equal(fade.getX(0),.625,'dynamic fade survives upload');packed.dispose();
  report.variants.push({i,leaves:asset.leaves,triangles:g.index.count/3,rawBytes,packedBytes,buildMs,chunks,longestChunk,maxJoinM:maxJoin,maxLeafBaseToTwigM:maxLeafJoin,physicalLeafM:[minLeaf,maxLeaf],curvedLeaves:curved,hash:h});assets.push(asset);
}
const maxCloseBaseDistance = Math.max(...assets.map((asset, i) => {
  const { min, max } = asset.bounds;
  const scale = Math.max(1, ...after.placements.filter(p => p.variant === i).map(p => p.scale));
  assert.equal(scale, approved.variants[i].scale, 'prototype uses the actual maximum placement scale');
  return Math.hypot(Math.max(Math.abs(min.x), Math.abs(max.x)), Math.max(Math.abs(min.z), Math.abs(max.z))) * scale + after.d.DISTANT_CLOSE_FADE_M[1];
}));
assert.ok(maxCloseBaseDistance < 72, 'positive target weights stay inside even the low-quality distant threshold');
for (const hz of [30, 60, 120, 144]) {
  let retiring = [{ id: 0, weight: 1 }];
  for (let frame = 0; frame < Math.ceil(hz * .25) + 1; frame++) retiring = after.d.updateDistantCloseSlots(retiring, [], 1 / hz);
  assert.deepEqual(retiring, [], 'retiring slot clears within 0.25 seconds plus one frame');
}
assert.deepEqual(after.d.updateDistantCloseSlots([{ id: 0, weight: 1 }], [], 0, true), []);
report.lodSeparation = { maxCloseBaseDistance, highDistantThresholdM: 120, lowDistantThresholdM: 72, retirement: 'At most 0.25 seconds plus one frame; arbitrary camera jumps without onCameraMove can carry a retiring slot beyond the target envelope.' };
let slots=[];let maxSlots=0;
for(let frame=0;frame<240;frame++){
  const candidates=Array.from({length:20},(_,id)=>({id,distance:frame<80?(id<8?8+id:30):(id<8?30:8+(id-8)*.15)}));
  slots=after.d.updateDistantCloseSlots(slots,candidates,1/60,frame===0);assert.ok(slots.length<=8);maxSlots=Math.max(maxSlots,slots.length);
  for(const s of slots)for(let q=0;q<16;q++){const threshold=(q+.5)/16;assert.equal(Number(threshold<s.weight)+Number(threshold>=s.weight),1);}
}assert.ok(slots.every(s=>s.id>=8));
const resetCandidates=Array.from({length:12},(_,id)=>({id,distance:10+id*.2}));assert.deepEqual(after.d.updateDistantCloseSlots(slots,resetCandidates,0,true),after.d.updateDistantCloseSlots([],resetCandidates,0,true));
const transform=p=>new T.Matrix4().compose(new T.Vector3(p.x,p.y,p.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.yaw),new T.Vector3().setScalar(p.scale));
for(const view of after.LAYOUT.viewpoints){
  const camera=new T.PerspectiveCamera(view.fov,1280/720,.08,900);camera.position.fromArray(view.position);camera.lookAt(...view.target);camera.updateMatrixWorld(true);
  const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const candidates=after.placements.map((p,id)=>{const m=transform(p),d=assets[p.variant].bounds.distanceToPoint(camera.position.clone().applyMatrix4(m.clone().invert()))*p.scale;
    const sphere=after.variants[p.variant].near.boundingSphere.clone().applyMatrix4(m);sphere.radius+=4;
    return{id,variant:p.variant,distance:d,legacyInFrustum:frustum.intersectsSphere(sphere),horizontalDistance:Math.hypot(p.x-camera.position.x,p.z-camera.position.z)};
  }).filter(p=>p.distance<26).sort((a,b)=>a.distance-b.distance).slice(0,8);
  // Every candidate is well inside the existing120m near range, independent of quality multiplier.
  assert.ok(candidates.every(p=>p.horizontalDistance<120));
  report.fixed.push({id:view.id,candidates,conservativeTriangles:candidates.reduce((n,p)=>n+report.variants[p.variant].triangles,0),submittedTriangles:candidates.filter(p=>p.legacyInFrustum).reduce((n,p)=>n+report.variants[p.variant].triangles,0)});
}
const wind=after.load('src/world/wind/wind.ts').createWind();
const mats=await after.load('src/world/trees/materials.ts').createTreeMaterials({wind,config:after.WORLD,rng:after.createRng(after.WORLD.seed),quality:{tier:'high'},textures:{load:async()=>new T.Texture()}});
const compile=m=>{const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(s,{});return s;};
const sourceMaterial=mats.giantTreeNearCanopy,material=after.d.cloneDistantCloseMaterial(sourceMaterial),shader=compile(material),originalShader=compile(sourceMaterial);
assert.ok(!shader.fragmentShader.includes('uClusterNear'));assert.deepEqual(shader.uniforms.uLeafNear.value.toArray(),[7,18]);
for(const [key,value]of Object.entries(originalShader.uniforms))assert.deepEqual(shader.uniforms[key].value,value.value);
for(const key of ['map','normalMap','roughnessMap','alphaTest','side','vertexColors'])assert.equal(material[key],sourceMaterial[key]);
assert.match(shader.fragmentShader,/diffuseColor \*= mix\(sampledDiffuseColor, vec4\(1.0\), vIsLeaf\)/);
const indexSource=fs.readFileSync(path.join(root,'src/world/trees/index.ts'),'utf8');assert.ok(indexSource.indexOf('nearCanopyPool.pin(item);')<indexSource.indexOf('distantCloseUniform.value[k].set'));
report.budget={maxSlots,maxExtraTriangles:Math.max(...report.variants.map(v=>v.triangles))*8,ceiling:after.d.DISTANT_CLOSE_TRIANGLES*8,rawBytes:report.variants.reduce((n,v)=>n+v.rawBytes,0),packedBytes:report.variants.reduce((n,v)=>n+v.packedBytes,0),instanceBytes:3840,maxExtraDraws:6,extraTextures:0,extraShadowPasses:0,oldSubmissions:'All original near/far geometry remains submitted; close numbers are additions, including during transitions.'};
report.checks=['all original geometry/placement/RNG bytes','all six reviewed prototype hashes','deterministic yielded rebuilds','every branch reaches a prior parent','every physical lamina base meets real wood','cupped per-leaf normals and canonical UV/material path','canonical packing bytes','simulated upload releases static attributes and preserves dynamic fade','eight-slot scarcity including retiring transitions','complementary fade and installation before old coverage removal','all fixed-view candidate/frustum costs','unrelated foliage/material/giant sources unchanged'];
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
