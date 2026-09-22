// Summarize the existing authored-worker records; no renderer or new geometry build.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import cp from 'node:child_process';
const root=process.cwd(),folder='gauntlet/tmp/astra-upper-canopy';
const before=JSON.parse(fs.readFileSync(`${folder}/before-final.json`));
const after=JSON.parse(fs.readFileSync(`${folder}/after-final.json`));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const file of ['src/world/trees/giant.ts','src/world/trees/index.ts','src/world/trees/nearCanopy.ts']){
 const source=cp.execFileSync('git',['show',`bcf3880d:${file}`],{encoding:'utf8'});
 assert.equal(sha(source.replaceAll('\r\n','\n')),after.sourceHashes[file],file+' captured source');
}
const farRows=result=>result.assets.flatMap(a=>a.geometry.filter(g=>!g.path.startsWith('asset.nearCanopy')).map(g=>({builder:a.builder,ordinal:a.ordinal,path:g.path,hash:g.sha256})));
assert.deepEqual(farRows(after),farRows(before),'Every built geometry buffer outside near-canopy remains exact');
const parts=after.measurements,byBytes=(a,b)=>b-a,sum=a=>a.reduce((x,y)=>x+y,0);
const columnRaw=after.assets.filter(a=>a.builder.includes('createColumnTree')).flatMap(a=>a.geometry.filter(g=>g.path.startsWith('asset.nearCanopy')).map(g=>g.bytes));
const max64Lobes=sum([...parts.filter(p=>p.kind==='lobe'&&!p.persistent).map(p=>p.packedBytes),...columnRaw].sort(byBytes).slice(0,64));
const max12Limbs=sum(parts.filter(p=>p.kind==='limb').map(p=>p.packedBytes).sort(byBytes).slice(0,12));
const persistent=sum(parts.filter(p=>p.persistent).map(p=>p.packedBytes));
const worst=max64Lobes+max12Limbs+persistent;
assert(worst<64*2**20);
const rows=new Map(after.placementBinding.nearCanopies.map(p=>[p.id,p]));
const views=after.views.map(v=>{
 const b=before.views.find(p=>p.pose.id===v.pose.id);assert(b);
 assert(v.coldWarmEqual&&b.coldWarmEqual);
 return {pose:v.pose,before:{calls:b.submittedCalls,triangles:b.submittedTriangles,coldResetMs:b.coldResetMs},after:{calls:v.submittedCalls,triangles:v.submittedTriangles,coldResetMs:v.coldResetMs,pinnedBytes:v.pool.pinnedBytes,poolBytes:v.pool.poolBytes},delta:{calls:v.submittedCalls-b.submittedCalls,triangles:v.submittedTriangles-b.submittedTriangles},coldWarmEqual:true,foldedFarTriangles:v.shown.filter(p=>!p.persistent).reduce((n,p)=>{const q=rows.get(p.id);return n+q.farLeaves*5+q.farCards*2},0),shown:v.shown};
});
const report={cpuSource:{base:before.ref,candidate:'bcf3880d',sourceHashes:after.sourceHashes},nativeIntegration:{base:'6231cffb',candidate:'16544efc',differenceFromCpuBase:'Only unrelated white-bark mid shadows and distant120m switch in trees/index.ts; giant options and builders are identical.'},workerProvenance:after.workerProvenance,guards:{unchangedNonNearGeometryRecords:farRows(after).length,allNonNearBuffersExact:true,deferredParts:parts.filter(p=>p.deferred).length,allDeferredBoundsContain:true,maxRawToEstimatedRatio:Math.max(...parts.filter(p=>p.deferred).map(p=>p.rawBytes/p.estimatedBytes)),max64LobeBytes:max64Lobes,max12LimbBytes:max12Limbs,persistentBytes:persistent,maxSelectedBytes:worst,smallPoolBytes:64*2**20,maxLocalCenterY:Math.max(...parts.map(p=>p.center[1])),maxWorldCenterY:Math.max(...after.placementBinding.nearCanopies.map(p=>p.center[1]))},views,measurements:parts,limits:['Inert CPU renderer; submitted near-canopy colour-pass deltas only, not full native W38 totals.','Explicit re-poses synchronously complete selected geometry; ordinary movement remains chunked.','CPU ms are not native frame times.','Logical folded triangle counts do not mean far geometry stopped being submitted.','Current authored giant centres are below25m local; present visible change comes from physical envelope distance and removal of hero-camera cuts.']};
fs.writeFileSync('art/environment/astra-upper-canopy/cpu-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({guards:report.guards,views:views.map(v=>({id:v.pose.id,delta:v.delta}))},null,2));
