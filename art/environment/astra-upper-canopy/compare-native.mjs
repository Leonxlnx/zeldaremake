// Existing gauntlet pixel comparators; original PNGs are never modified.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {compareImages,determinismDiff} from '../../../gauntlet/scripts/compare.mjs';
const dir=import.meta.dirname,root=path.resolve(dir,'../../..');
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const [before,after]=await Promise.all(['before','after'].map(p=>read(p+'/manifest.json')));
const digest=b=>createHash('sha256').update(b).digest('hex');
for(const m of [before,after]){assert.equal(m.complete,true);assert.deepEqual(m.errors,[]);}
assert.equal(before.sha,'6231cffbfec78d405cb3e83064bf3f68c7daca8d');
assert.equal(after.sha,'16544efcf6723f6e16de1c46c56975417084b334');
assert.equal(before.runtime.renderer,after.runtime.renderer);
assert.deepEqual(before.settings,after.settings);
const aFiles=after.snapshot.files,bFiles=before.snapshot.files;
const assetDifferences={onlyBefore:Object.keys(bFiles).filter(f=>!aFiles[f]),onlyAfter:Object.keys(aFiles).filter(f=>!bFiles[f]),changed:Object.keys(bFiles).filter(f=>aFiles[f]&&bFiles[f].sha256!==aFiles[f].sha256)};
for(const [file,hash]of Object.entries(bFiles))if(aFiles[file]&&file!=='index.html'&&file!=='models/link/SOURCE.md')assert.deepEqual(aFiles[file],hash,file+' shared served asset');
const report={before:before.sha,after:after.sha,renderer:after.runtime.renderer,assetDifferences,assetNote:'Changed entry/bundle expected. Baseline also serves unused Link trial GLBs and Three diagnostic modules; Link SOURCE.md is documentation. Every common render asset is byte-identical.',views:{},repeat:after.repeat,limits:['A/F baseline originals are reused from the exact parent6231 capture; provenance and original manifest retained.','Upper pose contains intervening foliage; it is not an isolated giant or an original owner viewpoint.','This trial exceeds W38 at A; no rubric change or quality/camera exception.','Static timing has no matched baseline samples, so no frame-time claim.','Finer detail is limited to admitted existing parts; foreground oversized leaves and broad flat crown masses remain.']};
const pieces=[];
for(const [row,id]of ['A_stairs','F_canopy','upper-envelope-southwest'].entries()){
 const b=before.images[id],a=after.images[id];
 assert.deepEqual(a.camera,b.camera,id+' camera');assert.deepEqual(a.lighting,b.lighting,id+' lighting');
 for(const k of ['simTime','width','height','pixelRatio'])assert.equal(a.stats[k],b.stats[k],id+' '+k);
 const files=['before','after'].map(p=>path.join(dir,p,id+'.png'));
 for(let i=0;i<2;i++)assert.equal(digest(await fs.readFile(files[i])),[b,a][i].sha256);
 const pool=a.trees.nearCanopy.pool;assert(pool.poolBytes<=pool.capBytes);assert(pool.pinnedBytes<=pool.capBytes);
 const v=report.views[id]={beforeStats:b.stats,afterStats:a.stats,delta:{triangles:a.stats.triangles-b.stats.triangles,calls:a.stats.drawCalls-b.stats.drawCalls},changedFractionTolerance8:await determinismDiff(...files),pool:{residentBytes:pool.poolBytes,pinnedBytes:pool.pinnedBytes,capBytes:pool.capBytes,newSyncBuilds:pool.syncBuilds-a.beforePose.systemPerf.trees.nearCanopyPool.syncBuilds,workMsMax:pool.workMsMax,stepMsMax:pool.stepMsMax},nearSubmission:a.trees.submission.byFamily,foldedTriangles:a.trees.nearCanopy.foldedTriangles};
 try{const ref=path.join(root,'reference/frames',id+'.jpg');await fs.access(ref);const s=await Promise.all(files.map(f=>compareImages(f,ref)));v.referenceSSIM={before:s[0].ssim,after:s[1].ssim,delta:s[1].ssim-s[0].ssim};}catch(e){if(e.code!=='ENOENT')throw e;}
 for(let side=0;side<2;side++){
  const label=Buffer.from(`<svg width="640" height="24"><rect width="100%" height="100%" fill="#171717"/><text x="10" y="17" fill="white" font-family="sans-serif" font-size="14">${side?'Candidate16544efc':'Baseline6231cffb'} — ${id}</text></svg>`);
  pieces.push({input:label,left:side*640,top:row*384},{input:await sharp(files[side]).resize(640,360).png().toBuffer(),left:side*640,top:row*384+24});
 }
}
assert(after.repeat.identical);
assert.equal(digest(await fs.readFile(path.join(dir,'after',after.repeat.file))),after.images['upper-envelope-southwest'].sha256);
assert.deepEqual(after.repeat.camera,after.images['upper-envelope-southwest'].camera);
assert.equal(after.repeat.stats.triangles,after.images['upper-envelope-southwest'].stats.triangles);
assert.equal(after.repeat.stats.drawCalls,after.images['upper-envelope-southwest'].stats.drawCalls);
await sharp({create:{width:1280,height:384*3,channels:3,background:'#171717'}}).composite(pieces).png().toFile(path.join(dir,'native-pairs.png'));
await fs.writeFile(path.join(dir,'native-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.table(Object.entries(report.views).map(([id,v])=>({id,triangles:v.afterStats.triangles,delta:v.delta.triangles,calls:v.afterStats.drawCalls,changed:v.changedFractionTolerance8,referenceSSIMdelta:v.referenceSSIM?.delta})));
