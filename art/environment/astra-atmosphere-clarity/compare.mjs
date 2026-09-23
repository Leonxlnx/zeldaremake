// Fixed native masks and original PNG checks; no image changes enter the evidence captures.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {compareImages,determinismDiff} from '../../../gauntlet/scripts/compare.mjs';
const dir=import.meta.dirname,root=path.resolve(dir,'../../..');
const load=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [b,a]=await Promise.all(['before','after'].map(s=>load(path.join(dir,s,'manifest.json'))));
const builds=await load(path.join(dir,'builds.json')),digest=x=>createHash('sha256').update(x).digest('hex');
for(const [m,label]of [[b,'before'],[a,'after']]){
 assert.equal(m.complete,true);assert.deepEqual(m.errors,[]);assert.deepEqual(m.snapshot,builds.snapshots.find(s=>s.label===label));
 assert.equal(m.sha,m.snapshot.source);assert.equal(m.settingsSha256,builds.settingsSha256);assert.equal(Object.keys(m.images).length,4);
}
assert.deepEqual(a.settings,b.settings);assert.equal(a.runtime.renderer,b.runtime.renderer);
assert.equal(a.captureScriptSha256,b.captureScriptSha256);assert.equal(a.runtime.devicePixelRatio,b.runtime.devicePixelRatio);
assert.deepEqual(a.runtime.perf.perfState,b.runtime.perf.perfState);
const Y=(v,i)=>(.2126*v[i]+.7152*v[i+1]+.0722*v[i+2])/255;
const sat=(v,i)=>{const max=Math.max(v[i],v[i+1],v[i+2]);return max?(max-Math.min(v[i],v[i+1],v[i+2]))/max:0;};
const report={beforeSha:b.sha,afterSha:a.sha,renderer:b.runtime.renderer,settingsSha256:b.settingsSha256,guards:'Exact cameras/time/draws/triangles/lighting/depth maps, unchanged served assets outside the compiled bundle and index, no errors',notes:'Depth masks are frozen to baseline. Stats use 320x180 nearest display pixels and the matching scene-depth samples, not material IDs. Display Y is encoded Rec709, not scene radiance. Reference SSIM is reported, not optimized: owner requested a clearer look. Static timing includes rAF and synchronous read, not gameplay FPS.',views:{}};
const oldFiles=b.snapshot.files,newFiles=a.snapshot.files;
assert.deepEqual(Object.keys(oldFiles).filter(f=>!f.endsWith('.js')&&f!=='index.html').sort(),Object.keys(newFiles).filter(f=>!f.endsWith('.js')&&f!=='index.html').sort());
for(const [file,hash]of Object.entries(oldFiles))if(!file.endsWith('.js')&&file!=='index.html')assert.deepEqual(newFiles[file],hash,file);
const pieces=[];
for(const [row,id]of b.settings.views.entries()){
 const before=b.images[id],after=a.images[id];assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.lighting,before.lighting);
 assert.deepEqual(after.perf.perfState,before.perf.perfState);assert.equal(after.depth.width,before.depth.width);assert.equal(after.depth.height,before.depth.height);
 const protectedAtmosphere=m=>Object.fromEntries(Object.entries(m).filter(([key])=>!['hazeDensityPerM','hazeAt30m','hazeCatchUpDensityPerM','hazeFarDensityPerM','farShadeMin'].includes(key)));
 assert.deepEqual(protectedAtmosphere(after.atmosphere),protectedAtmosphere(before.atmosphere),id+' protected atmosphere/sky/shafts/grade');
 for(const k of ['simTime','width','height','pixelRatio','triangles','drawCalls','textures','geometries','programs'])assert.equal(after.stats[k],before.stats[k],id+' '+k);
 const files=['before','after'].map(s=>path.join(dir,s,id+'.png'));
 for(let side=0;side<2;side++)assert.equal(digest(await fs.readFile(files[side])),[before,after][side].sha256);
 const ds=await Promise.all(['before','after'].map((s,i)=>fs.readFile(path.join(dir,s,[before,after][i].depth.file))));
 for(let side=0;side<2;side++)assert.equal(digest(ds[side]),[before,after][side].depth.sha256);
 assert(ds[0].equals(ds[1]),id+' native depth differs');
 const depth=new Float32Array(ds[0].buffer,ds[0].byteOffset,ds[0].byteLength/4),w=before.depth.width,h=before.depth.height;
 const rgb=await Promise.all(files.map(f=>sharp(f).resize(w,h,{kernel:'nearest'}).removeAlpha().raw().toBuffer()));
 const key=i=>{const d=depth[i];return (i<w*h/2?'upper/':'lower/')+(!Number.isFinite(d)?'sky':d<5?'0-5':d<20?'5-20':d<50?'20-50':d<100?'50-100':'100+');};
 const buckets={};
 for(let i=0;i<depth.length;i++){
  const k=key(i),q=buckets[k]??={n:0,Y:[0,0],Y2:[0,0],saturation:[0,0],adjacentEdges:[0,0],edgeCount:0,changedAtAnyByte:0};q.n++;
  q.changedAtAnyByte+=rgb[0][i*3]!==rgb[1][i*3]||rgb[0][i*3+1]!==rgb[1][i*3+1]||rgb[0][i*3+2]!==rgb[1][i*3+2];
  for(let side=0;side<2;side++){const y=Y(rgb[side],i*3);q.Y[side]+=y;q.Y2[side]+=y*y;q.saturation[side]+=sat(rgb[side],i*3);}
  for(const j of [(i%w<w-1)?i+1:-1,i+w])if(j>=0&&j<depth.length&&key(j)===k){q.edgeCount++;for(let side=0;side<2;side++)q.adjacentEdges[side]+=Math.abs(Y(rgb[side],i*3)-Y(rgb[side],j*3));}
 }
 for(const q of Object.values(buckets)){
  q.Y=q.Y.map(v=>v/q.n);q.Ystd=q.Y2.map((v,i)=>Math.sqrt(Math.max(0,v/q.n-q.Y[i]**2)));delete q.Y2;
  q.saturation=q.saturation.map(v=>v/q.n);q.adjacentEdges=q.adjacentEdges.map(v=>v/Math.max(1,q.edgeCount));q.changedAtAnyByte/=q.n;
 }
 const v=report.views[id]={stats:after.stats,changedFractionTolerance8:await determinismDiff(...files),depthExact:true,buckets,timing:before.staticFrameMs?{before:before.staticFrameMs,after:after.staticFrameMs}:undefined};
 try{const ref=path.join(root,'reference/frames',id+'.jpg');await fs.access(ref);const r=await Promise.all(files.map(f=>compareImages(f,ref)));v.referenceSSIM={before:r[0].ssim,after:r[1].ssim,delta:r[1].ssim-r[0].ssim};}catch(e){if(e.code!=='ENOENT')throw e;}
 for(let side=0;side<2;side++){
  const label=Buffer.from(`<svg width="640" height="24"><rect width="100%" height="100%" fill="#171717"/><text x="10" y="17" fill="white" font-family="sans-serif" font-size="14">${side?'Candidate 7464eb44':'Baseline 664f3418'} — ${id}</text></svg>`);
  pieces.push({input:label,left:side*640,top:row*384},{input:await sharp(files[side]).resize(640,360).png().toBuffer(),left:side*640,top:row*384+24});
 }
}
await sharp({create:{width:1280,height:384*4,channels:3,background:'#171717'}}).composite(pieces).png().toFile(path.join(dir,'native-pairs.png'));
await fs.writeFile(path.join(dir,'native-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.table(Object.entries(report.views).map(([view,v])=>({view,triangles:v.stats.triangles,draws:v.stats.drawCalls,changed:v.changedFractionTolerance8,SSIMdelta:v.referenceSSIM?.delta})));
