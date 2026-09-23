import fs from 'node:fs';
import assert from 'node:assert/strict';
import {compareImages} from '../../../gauntlet/scripts/compare.mjs';
import {toGray} from '../../../gauntlet/scripts/lib/image.mjs';
const before='art/environment/2026-09-19T17-55-28-259Z-daylight';
const after='art/environment/2026-09-19T18-36-17-597Z-daylight';
const a=JSON.parse(fs.readFileSync(before+'/manifest.json'));
const b=JSON.parse(fs.readFileSync(after+'/manifest.json'));
assert(a.complete&&b.complete);assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
const results=[];
for(const id of ['A_stairs','B_house','C_lookback','D_log','E_ground','F_canopy']){
 const ai=a.images[id+'-after'],bi=b.images[id];
 assert.deepEqual(ai.camera,bi.camera);assert.equal(ai.stats.drawCalls,bi.stats.drawCalls);assert.equal(ai.stats.triangles,bi.stats.triangles);
 const ref='reference/frames/'+id+'.jpg';
 const old=await compareImages(before+'/'+id+'-after.png',ref),next=await compareImages(after+'/'+id+'.png',ref);
 const x=await toGray(before+'/'+id+'-after.png',640,360),y=await toGray(after+'/'+id+'.png',640,360);
 results.push({id,beforeSSIM:old.ssim,afterSSIM:next.ssim,delta:Number((next.ssim-old.ssim).toFixed(5)),meanLuminanceChange:y.reduce((sum,v,i)=>sum+v-x[i],0)/x.length,drawCalls:bi.stats.drawCalls,triangles:bi.stats.triangles});
}
const report={before,after,results};
const upward='art/environment/2026-09-19T18-42-30-998Z-daylight';
const u=JSON.parse(fs.readFileSync(upward+'/manifest.json'));
assert(u.complete);assert.deepEqual(u.errors,[]);assert.equal(u.walk.length,45);assert.equal(b.walk.length,45);
assert.deepEqual(u.walk.map(v=>v.camera),b.walk.map(v=>v.camera));
report.upwardBaseline=upward;
report.upwardSamples=[];
for(const file of ['sky-opening.png','walk-000.png','walk-022.png','walk-044.png']){
 const x=await toGray(upward+'/'+file,640,360),y=await toGray(after+'/'+file,640,360);
 report.upwardSamples.push({file,meanLuminanceChange:y.reduce((sum,v,i)=>sum+v-x[i],0)/x.length});
}
fs.writeFileSync('art/environment/2026-09-19-shaft-review/comparison.json',JSON.stringify(report,null,2));console.log(results);
