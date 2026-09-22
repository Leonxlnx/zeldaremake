// Verify matched native provenance and report actual renderer submissions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(here,p)));
const before=read('native-pair/before/manifest.json'),after=read('native-pair/after/manifest.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(here,p))).digest('hex');
for(const [label,item] of [['before',before],['after',after]]) {
  assert.deepEqual(item.build,read(`native-pair/${label}-build.json`));
  assert.equal(item.build.geometrySha,'94afa311bb7cd52e07bb55418444f615c105dc86');
  assert.equal(item.build.warmthSourceSha,'0858f39f75ee14130be7ff84692cdd33422c83ab');
  assert.equal(item.build.buildEnvironment.VITE_BANK_LAYERED_CORE,label==='before'?'0':'1');
  for(const [id,row] of Object.entries(item.images)) assert.equal(hash(`native-pair/${label}/${id}.png`),row.sha256,`${label}/${id} raw PNG bytes`);
}
assert.deepEqual(after.build.sourceBindings,before.build.sourceBindings);
assert.deepEqual(Object.keys(before.images),['F_canopy','C_lookback']);
assert.deepEqual(Object.keys(after.images),Object.keys(before.images));
for(const item of [before,after]){assert.equal(item.complete,true);assert.deepEqual(item.errors,[]);assert.ok(!/swiftshader|software|llvmpipe/i.test(item.runtime.renderer));}
assert.deepEqual(after.settings,before.settings);assert.equal(after.browser,before.browser);assert.equal(after.runtime.renderer,before.runtime.renderer);
assert.equal(after.build.sha,before.build.sha);assert.equal(after.build.publicHash,before.build.publicHash);
const rows=Object.keys(before.images).map(id=>{
  const b=before.images[id],a=after.images[id];
  for(const key of ['camera','lighting','hardscape'])assert.deepEqual(a[key],b[key],`${id} ${key} unchanged`);
  assert.deepEqual(a.trees.distantLod,b.trees.distantLod,`${id} distant LOD counts`);
  assert.deepEqual(a.trees.samplePositions,b.trees.samplePositions,`${id} positions`);
  for(const key of ['simTime','width','height','pixelRatio'])assert.equal(a.stats[key],b.stats[key]);
  assert.deepEqual(a.failures,[]);assert.deepEqual(b.failures,[]);
  const delta=Object.fromEntries(['triangles','drawCalls','geometries','textures','programs'].map(k=>[k,a.stats[k]-b.stats[k]]));
  assert.deepEqual(delta,{triangles:65440,drawCalls:3,geometries:3,textures:0,programs:1});
  return{id,beforeSha256:b.sha256,afterSha256:a.sha256,before:b.stats,after:a.stats,delta,distantLod:a.trees.distantLod};
});
const report={verdict:'PASS',nativeBuildHead:before.build.sha,geometrySource:before.build.geometrySha,commonWarmthSource:before.build.warmthSourceSha,deliverySource:'57eea8c0ec77880ef4b3ae6cba51503999600e65',deliveryParity:'delivery-proof.json: exact reviewed true-branch code and full-tree output',renderer:before.runtime.renderer,browser:before.browser,settings:before.settings,publicHash:before.build.publicHash,checks:['raw PNG SHA-256 bytes match receipts','native hardware both builds','same source bindings and public inputs; only frozen build flag differs','same camera/light/viewport/time','same distant LOD counts/positions','same hardscape audit','no page/shader/system errors','recorded resource deltas verified'],rows,limits:['CPU parity connects final source to the retained flag1 images; these are not a fresh final-merge capture.','No FPS, whole-world quality or Phase1-exit claim.']};
fs.writeFileSync(path.join(here,'native-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({renderer:report.renderer,browser:report.browser,rows:rows.map(({id,before,after,delta,distantLod})=>({id,before,after,delta,distantLod}))},null,2));
