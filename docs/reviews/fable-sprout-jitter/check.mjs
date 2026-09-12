import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as T from 'three';
import {build,hash} from './fixture.mjs';
const dir='gauntlet/tmp/fable-sprout-jitter-reproduction';fs.mkdirSync(dir,{recursive:true});const pin=r=>execFileSync('git',['rev-parse',r],{encoding:'utf8'}).trim(),source=(r,f)=>execFileSync('git',['show',r+':'+f],{encoding:'utf8'}),refs={legacy:pin('77dd665'),preLawn:pin('0f9426c'),lawn:pin('6128726'),jitter:pin('c4b9578'),flowers:pin('cee9888')};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),key=s=>[s.x,s.y,s.z,s.kind??'tuft'].join('/'),variant=s=>s.kind==='cushion'?4:s.kind==='fern'?5:s.kind==='grit'?6:s.size>.7?1:s.size>.42?0:s.size>.2?2:3,draws=v=>v===4?8:v===6?9:6;
const strip=s=>{const {source,...rest}=s;return rest;};
const arrHash=g=>Object.fromEntries([...Object.entries(g.attributes),...(g.index?[['index',g.index]]:[])].map(([n,a])=>[n,hash(a.array)]));
const instrument=source(refs.legacy,'src/world/util/prng.ts').replace('  const next = () => {','  const next = () => {\n    (globalThis as any).__rngReviewDraws[String(seed)] = ((globalThis as any).__rngReviewDraws[String(seed)] ?? 0) + 1;');
globalThis.__rngReviewDraws={};
const old=await build(refs.legacy,{'src/world/util/prng.ts':instrument}),legacySharedDraws=globalThis.__rngReviewDraws[String(old.ctx.config.seed)+'/hardscape/sprouts'];
const pre=await build(refs.lawn),neo=await build(refs.flowers),again=await build(refs.flowers),nm=new Map(neo.capture.instances.map(a=>[key(a.spot),a]));
const legacy={instances:old.capture.instances.length,missing:0,identicalMatrixAndColor:0,changed:0,bySource:{}};
for(const a of old.capture.instances){const b=nm.get(key(a.spot));if(!b){legacy.missing++;continue;}const t=legacy.bySource[b.spot.source]??={count:0,sizeChanged:0,matrixSame:0,colorSame:0};t.count++;t.sizeChanged+=+(a.spot.size!==b.spot.size);t.matrixSame+=+same(a.matrix,b.matrix);t.colorSame+=+same(a.color,b.color);if(same(a.matrix,b.matrix)&&same(a.color,b.color))legacy.identicalMatrixAndColor++;else{legacy.changed++;assert.equal(b.spot.source,'pocket-scatter-capped');}}
assert.equal(legacy.missing,0);assert.equal(legacy.identicalMatrixAndColor,4225);assert.equal(legacy.changed,50);
assert.deepEqual(pre.capture.spots,neo.capture.spots.map(strip));
assert.deepEqual(neo.capture.spots,again.capture.spots);
assert.deepEqual(neo.capture.instances.map(a=>[a.matrix,a.color]),again.capture.instances.map(a=>[a.matrix,a.color]));
const oldBlocks=[];let last;
for(const a of old.capture.instances){let src=nm.get(key(a.spot)).spot.source;if(src==='pocket-scatter-capped')src='pocket-scatter';const v=variant(a.spot),k=src+'/'+v;if(last?.key!==k){last={key:k,source:src,variant:v,count:0};oldBlocks.push(last);}last.count++;}
const instanceDraws=oldBlocks.reduce((n,r)=>n+r.count*draws(r.variant),0),sowingDraws=legacySharedDraws-instanceDraws;
assert.equal(sowingDraws,86903);assert.equal(oldBlocks.length,25);
const tableSource=source(refs.jitter,'src/world/hardscape/sprout-jitter.ts');
const constants={TUFT_A:0,TUFT_B:1,TUFT_C:2,CLOVER:3,CUSHION:4,GRIT:6};
const declared=[...tableSource.matchAll(/\['([^']+)', (TUFT_A|TUFT_B|TUFT_C|CLOVER|CUSHION|GRIT), (\d+)\]/g)].map(m=>({key:m[1]+'/'+constants[m[2]],source:m[1],variant:constants[m[2]],count:+m[3]}));
assert.deepEqual(oldBlocks,declared);
let offset=sowingDraws;for(const row of oldBlocks){row.offset=offset;offset+=row.count*draws(row.variant);}
const geometry={};for(const b of pre.system.group.children.filter(o=>o.isMesh)){const a=neo.system.group.getObjectByName(b.name);assert.ok(a,b.name);const hb=arrHash(b.geometry),ha=arrHash(a.geometry);const changed=Object.keys(hb).filter(k=>hb[k]!==ha[k]);if(b===pre.capture.flowers.mesh)assert.deepEqual(changed,['normal']);else assert.deepEqual(changed,[]);geometry[b.name]={attributes:Object.keys(hb).length,changed};}
assert.equal(pre.capture.paving.steppingStones.length,8);
assert.deepEqual(pre.capture.paving.steppingStones,neo.capture.paving.steppingStones);
assert.deepEqual(pre.capture.paving.stones,neo.capture.paving.stones);
const auditWithoutScheme=({...a})=>{delete a.sproutJitter;return a;};assert.deepEqual(auditWithoutScheme(pre.audit),auditWithoutScheme(neo.audit));
const sprouts=neo.read('materials/sprouts'),streamFactory=neo.read('hardscape/sprout-jitter').createSproutJitterStreams;
function run(spots, packs=sprouts.HARDSCAPE_PACKS,jitter=true){const records=[];globalThis.__reviewSpot=(mesh,i,s)=>records.push({mesh,i,spot:{...s}});const mat=new T.MeshStandardMaterial(),root=neo.ctx.rng.fork('hardscape'),rng=root.fork('sprouts');const out=sprouts.buildSproutMeshes(spots,rng,mat,neo.ctx.config,packs,jitter?{jitter:streamFactory(root)}:{});const result=records.map(a=>({spot:a.spot,matrix:Array.from(a.mesh.instanceMatrix.array.slice(a.i*16,a.i*16+16)),color:Array.from(a.mesh.instanceColor.array.slice(a.i*3,a.i*3+3))}));for(const m of out.meshes)m.geometry.dispose();mat.dispose();return result;}
const input=neo.capture.spots,original=run(input),byKey=new Map(original.map(a=>[key(a.spot),a]));
function exactRetained(records){for(const a of records){const b=byKey.get(key(a.spot));if(!b)continue;assert.deepEqual(a.matrix,b.matrix);assert.deepEqual(a.color,b.color);}}
const removals=[];for(const src of [...new Set(input.map(s=>s.source))]){const r=run(input.filter(s=>s.source!==src));exactRetained(r);removals.push({source:src,retained:r.length});}
const pairs=new Map(input.map(s=>[s.source+'/'+variant(s),s])),appends=[];
let serial=0;for(const [pair,s] of pairs){const add={...s,x:s.x+1000+(++serial)};const r=run([...input,add]);exactRetained(r);assert.equal(r.length,input.length+1);appends.push(pair);}
exactRetained(run(input, [...sprouts.HARDSCAPE_PACKS].reverse().map(p=>[...p].reverse())));
const newSource={...input[0],source:'review-new-source',x:2000};exactRetained(run([newSource,...input]));
// Removing an interior member can shift later members of that SAME source/variant, as documented.
const victim=input.find(s=>s.source==='joints'&&variant(s)===0),removed=run(input.filter(s=>s!==victim));let samePairShifted=0,otherPairShifted=0;
for(const a of removed){const b=byKey.get(key(a.spot)),changed=!same(a.matrix,b.matrix)||!same(a.color,b.color);if(changed){if(a.spot.source===victim.source&&variant(a.spot)===variant(victim))samePairShifted++;else otherPairShifted++;}}
assert.equal(otherPairShifted,0);assert.ok(samePairShifted>0);
// The default shared material caller (rocks) opts out and retains exact old buffers and jitter.
async function rocks(h){h.capture.instances=[];globalThis.__reviewSpot=(mesh,i,s)=>h.capture.instances.push({mesh,i,spot:{...s}});const sys=await h.read('rocks/index').create(h.ctx);return{instances:h.capture.instances.map(a=>({spot:a.spot,matrix:Array.from(a.mesh.instanceMatrix.array.slice(a.i*16,a.i*16+16)),color:Array.from(a.mesh.instanceColor.array.slice(a.i*3,a.i*3+3))})),packed:arrHash(h.capture.sprouts.meshes[0].geometry),system:sys};}
const oldRocks=await rocks(pre),newRocks=await rocks(neo);assert.deepEqual(oldRocks.instances,newRocks.instances);assert.deepEqual(oldRocks.packed,newRocks.packed);
const owned={geometry:0,material:0,borrowedTextures:0},fl=neo.capture.flowers.mesh;fl.geometry.addEventListener('dispose',()=>owned.geometry++);fl.material.addEventListener('dispose',()=>owned.material++);for(const t of neo.borrowedTextures)t.addEventListener('dispose',()=>owned.borrowedTextures++);
const systemDisposer=typeof neo.system.dispose;neo.system.dispose?.();const afterSystem={...owned};neo.capture.flowers.dispose();neo.capture.flowers.dispose();const afterDirect={...owned};assert.deepEqual(afterSystem,{geometry:0,material:0,borrowedTextures:0});assert.deepEqual(afterDirect,{geometry:1,material:1,borrowedTextures:0});
const activeLegacyBlocks=oldBlocks.filter(r=>pairs.has(r.key));
const evidence={refs,scope:'Pinned-source CPU review at quality density 1; no GPU appearance verdict; no production writes',sourceHashes:Object.fromEntries(['src/world/hardscape/index.ts','src/world/hardscape/sprout-jitter.ts','src/world/materials/sprouts.ts','src/world/hardscape/flowers.ts'].map(f=>[f,hash(source(refs.flowers,f))])),legacy,offsets:{sharedDraws:legacySharedDraws,instanceDraws,sowingDraws,all25BlocksExact:true,activeLegacyBlocks:activeLegacyBlocks.length,oneTimeReplayDraws:activeLegacyBlocks.reduce((n,r)=>n+r.offset,0),blocks:oldBlocks},lawnToCandidate:{all5742SpotsExactExceptSource:true,allGeometryBuffersExactExceptFlowerNormal:true,geometry,allAuditFieldsExactExceptScheme:true,steppingExact:true,deterministicRebuild:true},isolation:{sourceRemoval:removals,appendedPairCount:appends.length,appendedPairs:appends,appendingNewSourceBeforeOld:true,packAndVariantReordering:true,interiorRemoval:{samePairShifted,otherPairShifted}},noOptionRocks:{instances:newRocks.instances.length,exactPositionsMatricesColorsPackedBuffers:true},lifecycle:{hasSystemDispose:systemDisposer,afterSystem,afterDirectOwnedDisposeTwice:afterDirect},limitations:['The frozen starts restore the exact recorded quality-density-1 seed/layout build; other seeds/densities remain deterministic but do not promise old traversal equality.','Source/variant isolation is not per-instance identity: removing/reordering inside one pair changes its following members.','The 50 capped old TUFT_B now TUFT_A and 1467 new lawn instances intentionally use new streams; 8 more size-clamped old TUFT_A retain exact matrices/colors because size selects variant rather than scaling geometry.','Legacy pairs are separate RNG objects replaying offsets into the same original sequence; enlarged blocks may consume overlapping numeric ranges, so they are isolated in state rather than statistically independent.','Fable cee9888 still has no hardscape system dispose hook; retain Astra index flowers.dispose hook on integration. Existing older hardscape resource lifecycle is unchanged by these commits.']};
fs.writeFileSync(dir+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({legacy,offsets:{sowingDraws,blocks:oldBlocks.length},isolation:{removedSources:removals.length,appendedPairs:appends.length,samePairShifted,otherPairShifted},noOptionRocks:evidence.noOptionRocks,lifecycle:evidence.lifecycle},null,2));
