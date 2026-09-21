// Matched renderer receipts; this verifies provenance/cost, not aesthetic acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(here,p)));
const before=read('native-pair/before/manifest.json'),after=read('native-pair/after/manifest.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(before.build.sha,'0963c09da4139a0542a338d3345796dce6b20b8a');
assert.equal(after.build.sha,'0858f39f75ee14130be7ff84692cdd33422c83ab');
for(const item of [before,after]){assert.equal(item.complete,true);assert.deepEqual(item.errors,[]);assert.ok(!/swiftshader|software|llvmpipe/i.test(item.runtime.renderer));}
assert.deepEqual(after.settings,before.settings);assert.equal(after.browser,before.browser);assert.equal(after.runtime.renderer,before.runtime.renderer);
assert.equal(after.build.publicHash,before.build.publicHash);
const timerKeys=['workMsMax','workMsTotal','workMsP95'];
function structuralTreeAudit(tree){
  const result=structuredClone(tree);
  for(const key of timerKeys){assert.equal(typeof result.nearCanopy.pool[key],'number');delete result.nearCanopy.pool[key];}
  return result;
}
const rows=Object.keys(before.images).map(id=>{
  const b=before.images[id],a=after.images[id];
  for(const key of ['camera','lighting','hardscape','stats','failures'])assert.deepEqual(a[key],b[key],`${id} ${key} unchanged`);
  assert.deepEqual(structuralTreeAudit(a.trees),structuralTreeAudit(b.trees),`${id} tree audit excluding wall-clock work timings`);
  for(const[label,meta]of[['before',b],['after',a]])assert.equal(hash(fs.readFileSync(path.join(here,'native-pair',label,id+'.png'))),meta.sha256);
  return{id,beforeSha256:b.sha256,afterSha256:a.sha256,stats:a.stats,delta:{triangles:0,drawCalls:0,geometries:0,textures:0,programs:0},measuredCpuWorkMs:Object.fromEntries(timerKeys.map(key=>[key,{before:b.trees.nearCanopy.pool[key],after:a.trees.nearCanopy.pool[key]}]))};
});
const report={sources:[before.build.sha,after.build.sha],renderer:before.runtime.renderer,browser:before.browser,settings:before.settings,publicHash:before.build.publicHash,checks:['native hardware both builds','exact canonical/recovery source SHAs','same public inputs','same camera/light/viewport/time','identical trees audit except three wall-clock work timings','complete identical hardscape audit and renderer stats','image hashes verified','no page/shader/system errors'],limits:'Wall-clock work timings are recorded but are neither deterministic nor an FPS claim.',rows};
fs.writeFileSync(path.join(here,'native-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
