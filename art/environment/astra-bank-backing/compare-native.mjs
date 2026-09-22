// Verify matched native provenance and report actual renderer submissions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(here,p)));
const before=read('native-pair/before/manifest.json'),after=read('native-pair/after/manifest.json');
for(const item of [before,after]){assert.equal(item.complete,true);assert.deepEqual(item.errors,[]);assert.ok(!/swiftshader|software|llvmpipe/i.test(item.runtime.renderer));}
assert.deepEqual(after.settings,before.settings);assert.equal(after.browser,before.browser);assert.equal(after.runtime.renderer,before.runtime.renderer);
const proof=read('cpu-proof.json');
assert.equal(proof.verdict,'PASS');
assert.equal(before.build.sha,proof.baseline);assert.equal(after.build.sha,proof.candidate);
assert.equal(after.build.publicHash,before.build.publicHash);
const sourceBefore=new Map(before.build.sourceHashes.map(row=>[row.path,row.sha256]));
assert.deepEqual(after.build.sourceHashes.filter(row=>sourceBefore.get(row.path)!==row.sha256).map(row=>row.path).sort(),['world/trees/giant.ts','world/trees/nearCanopy.ts']);
const rows=Object.keys(before.images).map(id=>{
  const b=before.images[id],a=after.images[id];
  for(const key of ['camera','lighting','hardscape'])assert.deepEqual(a[key],b[key],`${id} ${key} unchanged`);
  assert.deepEqual(a.trees.distantLod,b.trees.distantLod,`${id} distant LOD counts`);
  assert.deepEqual(a.trees.samplePositions,b.trees.samplePositions,`${id} positions`);
  for(const key of ['simTime','width','height','pixelRatio'])assert.equal(a.stats[key],b.stats[key]);
  assert.deepEqual(a.failures,[]);assert.deepEqual(b.failures,[]);
  return{id,beforeSha256:b.sha256,afterSha256:a.sha256,before:b.stats,after:a.stats,delta:{triangles:a.stats.triangles-b.stats.triangles,drawCalls:a.stats.drawCalls-b.stats.drawCalls,geometries:a.stats.geometries-b.stats.geometries,textures:a.stats.textures-b.stats.textures,programs:a.stats.programs-b.stats.programs},distantLod:a.trees.distantLod,submissionBefore:b.trees.submission,submissionAfter:a.trees.submission};
});
const report={baseline:before.build.sha,candidate:after.build.sha,renderer:before.runtime.renderer,browser:before.browser,settings:before.settings,publicHash:before.build.publicHash,checks:['native hardware both builds','same public inputs and only the proven two-file source change','same camera/light/viewport/time','same distant LOD counts/positions','same hardscape audit','no page/shader/system errors'],rows};
fs.writeFileSync(path.join(here,'native-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({renderer:report.renderer,browser:report.browser,rows:rows.map(({id,before,after,delta,distantLod})=>({id,before,after,delta,distantLod}))},null,2));
