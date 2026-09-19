import fs from 'node:fs';
import assert from 'node:assert/strict';
import {compareImages} from '../../../gauntlet/scripts/compare.mjs';
const dir='art/environment/2026-09-19T17-55-28-259Z-daylight';
const manifest=JSON.parse(fs.readFileSync(dir+'/manifest.json'));
assert.equal(manifest.complete,true);assert.deepEqual(manifest.errors,[]);
const results=[];
for(const id of ['A_stairs','B_house','C_lookback','D_log','E_ground','F_canopy']){
 const before=await compareImages(dir+'/'+id+'-before.png','reference/frames/'+id+'.jpg');
 const after=await compareImages(dir+'/'+id+'-after.png','reference/frames/'+id+'.jpg');
 assert.deepEqual(manifest.images[id+'-before'].camera,manifest.images[id+'-after'].camera);
 const a=manifest.images[id+'-before'].stats,b=manifest.images[id+'-after'].stats;
 assert.equal(a.drawCalls,b.drawCalls);assert.equal(a.triangles,b.triangles);
 const delta=Number((after.ssim-before.ssim).toFixed(4));assert(delta>=-.003,id+' reference regression');
 results.push({id,before:before.ssim,after:after.ssim,delta,drawCalls:b.drawCalls,triangles:b.triangles});
}
fs.writeFileSync('art/environment/2026-09-19-halo-review/verification.json',JSON.stringify({capture:dir,results},null,2));console.log(results);
