// Portable positive check: node .../check-rebuild.mjs [asset.glb]
// Optional historical negative control: add --historical (reads pinned Git blobs).
// No renderer, Blender, duplicate baseline GLB, or production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Quaternion } from 'three';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../../../..');
const historical = process.argv.includes('--historical');
const assetArg = process.argv.slice(2).find(a => a !== '--historical');
const file = assetArg ? path.resolve(assetArg) : path.join(root, 'public/models/link/link-runtime.glb');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const jsonHash = v => hash(Buffer.from(JSON.stringify(v)));
function unpack(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'glTF'); assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12);
  return {doc:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length)};
}
const bytes = await fs.readFile(file);
const expected = '89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b';
assert.equal(hash(bytes),expected,'Wrong candidate asset');
const model = unpack(bytes);
const bones = ['shoulderL','elbowL','shoulderR','elbowR'];
const period = 28/60;
// Twice the measured clean 2459 maximum, a clip regression bound, not physiology.
const maxStepBoundDeg = 2*1.4517216651102867;
const deg = (a,b) => new Quaternion(...a).normalize().angleTo(new Quaternion(...b).normalize())*180/Math.PI;
function values(m,index) {
  const a=m.doc.accessors[index],v=m.doc.bufferViews[a.bufferView],width={SCALAR:1,VEC4:4}[a.type];
  assert.equal(a.componentType,5126); assert.ok(width&&!a.sparse);
  return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>
    m.bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??4*width)+4*k)));
}
function track(m,name) {
  const clip=m.doc.animations.find(a=>a.name==='run');
  const c=clip.channels.find(c=>m.doc.nodes[c.target.node].name===name&&c.target.path==='rotation');
  assert.ok(c,name); const s=clip.samplers[c.sampler];
  assert.equal(s.interpolation??'LINEAR','LINEAR');
  const times=values(m,s.input).map(r=>r[0]),rows=values(m,s.output);
  assert.equal(times.length,rows.length);
  assert.ok(times.every((t,i)=>Number.isFinite(t)&&(!i||t>times[i-1])));
  assert.ok(Math.abs(times[0])<1e-8&&Math.abs(times.at(-1)-period)<1e-7);
  assert.ok(rows.every(q=>q.every(Number.isFinite)&&Math.abs(q.reduce((s,v)=>s+v*v,0)-1)<1e-5));
  const grid=Array.from({length:113},(_,i)=>{
    const t=period*i/112,r=times.findIndex(k=>k>=t);
    if(r===0)return rows[0]; if(r<0)return rows.at(-1);
    return new Quaternion(...rows[r-1]).slerp(new Quaternion(...rows[r]),(t-times[r-1])/(times[r]-times[r-1])).normalize().toArray();
  });
  const jumps=grid.slice(1).map((q,i)=>deg(grid[i],q));
  return {keys:times.length,times,rows,maxStepDeg:Math.max(...jumps),stepsOver5Deg:jumps.filter(v=>v>5).length,
    loopMaxComponentDifference:Math.max(...rows[0].map((v,i)=>Math.abs(v-rows.at(-1)[i]))),
    loopOrientationDifferenceDeg:deg(rows[0],rows.at(-1))};
}
const report={file,sha256:expected,bytes:bytes.length,periodS:period,maxStepBoundDeg,bones:{}};
for(const name of [...bones,'handL','handR']) {
  const b=track(model,name); assert.equal(b.keys,bones.includes(name)?113:57);
  assert.ok(b.maxStepDeg<maxStepBoundDeg,name+' discontinuous');
  assert.ok(b.loopOrientationDifferenceDeg<.0001,name+' loop discontinuous');
  if(bones.includes(name)) assert.ok(b.times.every((t,i)=>Math.abs(t-period*i/112)<1e-7));
  const {times,rows,...summary}=b; report.bones[name]=summary;
}
// This 2 KB contract captures the independently compared 3056 prefix and metadata.
// It checks the geometry, material/image mapping, rig, previous accessor bytes and
// unselected animations without distributing a second full-size character.
const p=JSON.parse(await fs.readFile(path.join(out,'rebuilt-source-preservation.json')));
assert.equal(hash(model.bin.subarray(0,p.originalBinBytes)),p.originalBinSha256);
for(const [key,want] of Object.entries(p.fixedMetadata)) assert.equal(jsonHash(model.doc[key]),want,key);
assert.equal(jsonHash(model.doc.accessors.slice(0,p.accessors.count)),p.accessors.sha256);
assert.equal(jsonHash(model.doc.bufferViews.slice(0,p.bufferViews.count)),p.bufferViews.sha256);
assert.equal(model.doc.animations.length,p.animations.length);
for(const [i,a] of p.animations.entries()) {
  const b=model.doc.animations[i]; assert.equal(b.name,a.name);
  if(a.name!=='run') {assert.equal(jsonHash(b),a.sha256);continue;}
  assert.equal(b.channels.length,a.channelCount);
  assert.equal(jsonHash(b.channels.map(c=>c.target)),a.channelTargetsSha256);
  assert.equal(jsonHash(b.channels.filter(c=>!(bones.includes(model.doc.nodes[c.target.node].name)&&c.target.path==='rotation'))),a.unselectedChannelsSha256);
  assert.equal(jsonHash(b.samplers.slice(0,a.originalSamplers.count)),a.originalSamplers.sha256);
  assert.equal(b.samplers.length,a.originalSamplers.count+4);
  for(const n of bones) assert.ok(b.channels.find(c=>model.doc.nodes[c.target.node].name===n&&c.target.path==='rotation').sampler>=a.originalSamplers.count);
}
report.preservation={originalBinSha256:p.originalBinSha256,originalBinAndAccessorSpansExact:true,
  restRigMeshesMaterialsImagesExact:true,otherClipsAndUnselectedRunChannelsExact:true};
if(historical) {
  const recover=(ref,want)=>{
    const b=execFileSync('git',['show',ref+':public/models/link/link-runtime.glb'],{cwd:root,maxBuffer:100_000_000});
    assert.equal(hash(b),want,ref); return unpack(b);
  };
  const clean=recover('0dfd3601^','2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4');
  const broken=recover('d679e7ee','382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb');
  report.historical={cleanGit:'0dfd3601^',brokenGit:'d679e7ee',shoulders:{}};
  for(const n of ['shoulderL','shoulderR']) {
    const a=track(clean,n),b=track(broken,n);
    assert.ok(a.maxStepDeg<maxStepBoundDeg);
    assert.ok(b.maxStepDeg>20&&b.stepsOver5Deg===64);
    assert.throws(()=>assert.ok(b.maxStepDeg<maxStepBoundDeg));
    report.historical.shoulders[n]={cleanMaxStepDeg:a.maxStepDeg,brokenMaxStepDeg:b.maxStepDeg,brokenStepsOver5Deg:b.stepsOver5Deg,negativeControlRejected:true};
  }
}
report.pass=true;
await fs.writeFile(path.join(out,historical?'portable-historical-checks.json':'portable-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
