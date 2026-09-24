// CPU-only comparison of exported animation and the real 60 Hz puppet. No renderer or production writes.
// node art/characters/link/progress/2026-09-24-natural-walk/compare.mjs [candidate.glb]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';

const out = path.join(ROOT, 'art/characters/link/progress/2026-09-24-natural-walk');
process.env.ZR_NATIVE_GPU = '0';
const names = ['baseline-7f.glb', 'walk-under-test.glb'];
const bytes = [execFileSync('git', ['show', 'e599075f:public/models/link/link-runtime.glb'], {cwd: ROOT, maxBuffer: 100000000}), await fs.readFile(process.argv[2] ?? path.join(ROOT, 'public/models/link/link-runtime.glb'))];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const unpack = b => { const len=b.readUInt32LE(12); return { doc:JSON.parse(b.subarray(20,20+len)), bin:b.subarray(28+len) }; };
const models=bytes.map(unpack), [base,candidate]=models;
const changed=[];
for (const key of Object.keys(base.doc)) if (!['animations','accessors','bufferViews','buffers'].includes(key))
  assert.deepEqual(candidate.doc[key],base.doc[key],key);
assert.deepEqual(candidate.bin.subarray(0,base.doc.buffers[0].byteLength),base.bin.subarray(0,base.doc.buffers[0].byteLength));
for (const [i,a] of base.doc.animations.entries()) {
  const b=candidate.doc.animations[i]; assert.equal(a.name,b.name);
  if(a.name!=='walk') { assert.deepEqual(a,b); continue; }
  assert.equal(a.channels.length,b.channels.length);
  for(const [j,c] of a.channels.entries()) {
    const d=b.channels[j]; assert.deepEqual(c.target,d.target);
    if(JSON.stringify(c)!==JSON.stringify(d)||JSON.stringify(a.samplers[c.sampler])!==JSON.stringify(b.samplers[d.sampler]))
      changed.push([base.doc.nodes[c.target.node].name,c.target.path]);
  }
}
assert.deepEqual(changed,[['shoulderL','rotation'],['elbowL','rotation'],['shoulderR','rotation'],['elbowR','rotation']]);
assert.equal(hash(bytes[0]), '7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda');
assert.equal(hash(bytes[1]), JSON.parse(await fs.readFile(path.join(out, 'walk-natural-export.json'))).sha256);
const runtimeFile=path.join(ROOT,'src/world/character/glbLink.ts');
const report={kind:'CPU-only exported-native and production-puppet comparison; +Z forward, +Y up',
  baseSha256:hash(bytes[0]),candidateSha256:hash(bytes[1]),runtimeSha256:hash(await fs.readFile(runtimeFile)),
  channels:{changed,originalBinaryPrefixExact:true,otherClipsAndRestDataExact:true},errors:[]};
const server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'motion-comparison',configureServer(s) {
    s.middlewares.use('/__motion-comparison',(_req,res)=>res.end('<!doctype html><title>CPU motion comparison</title>'));
    for(const [i,name] of names.entries()) s.middlewares.use('/models/link/'+name,(_req,res)=>{
      res.setHeader('Content-Type','model/gltf-binary');res.end(bytes[i]);
    });
  },
}]});
let browser;
try {
  await server.listen();browser=await launchBrowser();const page=await browser.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]+'__motion-comparison');
  report.results=await page.evaluate(async names=>{
    const [{loadGlbLink},{createLocomotion},{hardChain},{Vector3,Quaternion,AnimationMixer,LoopOnce},{GLTFLoader}]=await Promise.all([
      import('/src/world/character/glbLink.ts'),import('/src/world/character/puppet.ts'),
      import('/src/world/character/gaitChain.ts'),import('/node_modules/three/build/three.module.js'),
      import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
    ]);
    const points=['hips','chest','neck','head',...['thigh','knee','ankle','toe','shoulder','elbow','hand'].flatMap(n=>[n+'L',n+'R'])];
    const protectedBones=['hips','chest','neck','head','cap',...['thigh','knee','ankle','toe'].flatMap(n=>[n+'L',n+'R'])];
    const deg=180/Math.PI,flat=()=>0,contact=new Vector3();
    const summary=a=>({min:Math.min(...a),max:Math.max(...a),mean:a.reduce((x,y)=>x+y,0)/a.length});
    const corr=(a,b)=>{const am=summary(a).mean,bm=summary(b).mean;
      return a.reduce((s,v,i)=>s+(v-am)*(b[i]-bm),0)/Math.sqrt(a.reduce((s,v)=>s+(v-am)**2,0)*b.reduce((s,v)=>s+(v-bm)**2,0));};
    const angle=(a,b)=>new Quaternion(...a).angleTo(new Quaternion(...b))*deg;
    const snapshot=root=>{
      const p=Object.fromEntries(points.map(n=>[n,root.getObjectByName(n).getWorldPosition(new Vector3())]));
      const pitch=v=>Math.atan2(v.z,-v.y)*deg;
      const row={shoulderYawDeg:Math.atan2(-(p.shoulderL.z-p.shoulderR.z),p.shoulderL.x-p.shoulderR.x)*deg,
        torsoLeanDeg:Math.atan2(p.neck.z-p.hips.z,p.neck.y-p.hips.y)*deg,
        chestLeanDeg:Math.atan2(p.neck.z-p.chest.z,p.neck.y-p.chest.y)*deg};
      for(const s of ['L','R']) {
        row['upperArmPitch'+s]=pitch(p['elbow'+s].clone().sub(p['shoulder'+s]));
        row['elbowFlex'+s]=p['elbow'+s].clone().sub(p['shoulder'+s]).angleTo(p['hand'+s].clone().sub(p['elbow'+s]))*deg;
        row['handForwardM'+s]=p['hand'+s].z-p['shoulder'+s].z;
        row['handLateralM'+s]=(s==='L'?1:-1)*(p['hand'+s].x-p['shoulder'+s].x);
        row['thighPitch'+s]=pitch(p['knee'+s].clone().sub(p['thigh'+s]));
      }
      return {metrics:row,points:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.toArray()])),
        armQ:Object.fromEntries(['shoulderL','elbowL','shoulderR','elbowR'].map(n=>[n,root.getObjectByName(n).quaternion.clone().normalize().toArray()])),
        headQ:root.getObjectByName('head').getWorldQuaternion(new Quaternion()).normalize().toArray(),
        protected:protectedBones.flatMap(n=>root.getObjectByName(n).matrixWorld.elements)};
    };
    const digest=async rows=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)))))
      .map(b=>b.toString(16).padStart(2,'0')).join('');
    const summarize=(rows,dt)=>{
      const metrics=Object.fromEntries(Object.keys(rows[0].metrics).map(k=>[k,summary(rows.map(r=>r.metrics[k]))]));
      const armOppositeThigh=Object.fromEntries(['L','R'].map(s=>[s,corr(rows.map(r=>r.metrics['upperArmPitch'+s]),rows.map(r=>r.metrics['thighPitch'+(s==='L'?'R':'L')]))]));
      const angularSteps=Object.fromEntries(['shoulderL','elbowL','shoulderR','elbowR'].map(n=>{
        const steps=rows.slice(1).map((r,i)=>angle(rows[i].armQ[n],r.armQ[n]));
        return [n,{peakStepDeg:Math.max(...steps),peakSpeedDegPerS:Math.max(...steps)/dt,meanSpeedDegPerS:summary(steps).mean/dt}];
      }));
      const hands=Object.fromEntries(['L','R'].map(s=>{
        const positions=rows.map(r=>new Vector3(...r.points['hand'+s]).sub(new Vector3(...r.points['shoulder'+s])));
        const velocities=positions.slice(1).map((p,i)=>p.clone().sub(positions[i]).divideScalar(dt));
        const accelerations=velocities.slice(1).map((v,i)=>v.clone().sub(velocities[i]).divideScalar(dt).length());
        return [s,{peakRelativeSpeedMps:Math.max(...velocities.map(v=>v.length())),meanRelativeSpeedMps:summary(velocities.map(v=>v.length())).mean,
          peakRelativeAccelerationMps2:Math.max(...accelerations)}];
      }));
      const result={samples:rows.length,metrics,armOppositeThigh,temporal:{dtS:dt,angularSteps,hands}};
      if(rows[0].feet) {
        result.flightFraction=rows.filter(r=>r.feet.every(f=>f.minShoeGapM>.001)).length/rows.length;
        result.minShoeGapM=Math.min(...rows.flatMap(r=>r.feet.map(f=>f.minShoeGapM)));
        result.rootY=summary(rows.map(r=>r.rootY));
        result.reachClamps=rows.filter(r=>r.ik.reachClamped).length;
      }
      return result;
    };
    const results={};
    for(const mode of ['native','capture','play']) {
      const variants=[],specs=[],zeros=[];
      for(const name of names) {
        const url='/models/link/'+name,rows=[];
        if(mode==='native') {
          const gltf=await new GLTFLoader().loadAsync(url),mixer=new AnimationMixer(gltf.scene),clip=gltf.animations.find(a=>a.name==='walk');
          const action=mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
          for(let i=0;i<=112;i++) { action.enabled=true;action.paused=false;action.time=clip.duration*i/112;mixer.update(0);gltf.scene.updateMatrixWorld(true);rows.push(snapshot(gltf.scene)); }
          specs.push({durationS:clip.duration,samples:113});
        } else {
          const puppet=await loadGlbLink(url),chain=hardChain('walk'),loco=mode==='play'?createLocomotion():null;
          const dt=1/60,speed=mode==='play'?1.2:1.6;let pose;
          for(let i=0;i<720;i++) {
            const t=i*dt;if(loco){loco.speed=speed;loco.dt=dt;}
            puppet.advance(chain,t,speed*dt,dt);
            pose={...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco};
            puppet.pose(0,speed*t,0,pose,flat,contact);
            if(i>=120) rows.push({...snapshot(puppet.group),rootY:puppet.group.position.y,feet:puppet.feetContact(),ik:puppet.plantInfo()});
          }
          const clip=puppet.asset.clips.find(a=>a.name==='walk');
          specs.push({clip,speedMps:speed,cycleS:clip.strideM/speed,cadenceStepsPerMinute:120*speed/clip.strideM,dt});
          if(loco) {
            const before=snapshot(puppet.group);loco.dt=0;puppet.pose(0,speed*pose.t,0,pose,flat,contact);const after=snapshot(puppet.group);
            zeros.push({headOrientationDeg:angle(before.headQ,after.headQ),handTranslationM:Object.fromEntries(['L','R'].map(s=>[s,new Vector3(...before.points['hand'+s]).distanceTo(new Vector3(...after.points['hand'+s]))]))});
          }
        }
        variants.push(rows);
      }
      const [a,b]=variants,maxHead=Math.max(...a.map((r,i)=>angle(r.headQ,b[i].headQ)));
      const maxProtected=Math.max(...a.map((r,i)=>Math.max(...r.protected.map((v,j)=>Math.abs(v-b[i].protected[j])))));
      const displacements=Object.fromEntries(['head','handL','handR'].map(n=>[n,summary(a.map((r,i)=>new Vector3(...r.points[n]).distanceTo(new Vector3(...b[i].points[n]))))]));
      const sampleDt=mode==='native'?specs[0].durationS/112:1/60;
      const result={base:summarize(a,sampleDt),candidate:summarize(b,sampleDt),specs,zeroDt:zeros,maxHeadOrientationDifferenceDeg:maxHead,
        headOrientationWithinNativeSampleTolerance:maxHead<.0001,
        headAimDisplacementAt12cmM:2*.12*Math.sin(maxHead/deg/2),
        maxProtectedMatrixDifference:maxProtected,pointDisplacementsM:displacements,
        protectedTraceSha256:await Promise.all(variants.map(rows=>digest(rows.map(r=>r.protected))))};
      if(mode==='native') result.loop={baseHeadDeg:angle(a[0].headQ,a.at(-1).headQ),candidateHeadDeg:angle(b[0].headQ,b.at(-1).headQ),
        baseHandM:Object.fromEntries(['L','R'].map(s=>[s,new Vector3(...a[0].points['hand'+s]).distanceTo(new Vector3(...a.at(-1).points['hand'+s]))])),
        candidateHandM:Object.fromEntries(['L','R'].map(s=>[s,new Vector3(...b[0].points['hand'+s]).distanceTo(new Vector3(...b.at(-1).points['hand'+s]))]))};
      else {
        result.rootFootIkTraceSha256=await Promise.all(variants.map(rows=>digest(rows.map(r=>({rootY:r.rootY,feet:r.feet,ik:r.ik})))));
        result.maxRootDifferenceM=Math.max(...a.map((r,i)=>Math.abs(r.rootY-b[i].rootY)));
      }
      results[mode]=result;
    }
    return results;
  },names);
  await fs.writeFile(path.join(out,'runtime-comparison.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({baseSha256:report.baseSha256,candidateSha256:report.candidateSha256,channels:report.channels,results:report.results},null,2));
  assert.deepEqual(report.errors,[]);
  assert.equal(report.runtimeSha256,hash(await fs.readFile(runtimeFile)),'Runtime changed during measurement');
  for(const [mode,r] of Object.entries(report.results)) {
    assert.deepEqual(r.specs[0],r.specs[1]);
    assert.equal(r.maxProtectedMatrixDifference,0,mode+' lower-body matrices changed');
    assert.equal(r.protectedTraceSha256[0],r.protectedTraceSha256[1]);
    if(mode==='native') assert.ok(r.headOrientationWithinNativeSampleTolerance,'Baked head orientation changed');
    // Separate chest/head interpolation has a measured residual; it is reported, not silently called exact.
    assert.ok(Number.isFinite(r.maxHeadOrientationDifferenceDeg));
    assert.ok(Object.values(r.candidate.metrics).every(m=>Object.values(m).every(Number.isFinite)));
    if(mode!=='native') assert.equal(r.rootFootIkTraceSha256[0],r.rootFootIkTraceSha256[1],mode+' root/foot/IK trace changed');
    if(mode==='play') { assert.equal(r.candidate.reachClamps,0);assert.ok(r.candidate.minShoeGapM >= -0.005);
      for(const z of r.zeroDt) for(const v of Object.values(z.handTranslationM)) assert.ok(v<1e-8,'zero-dt hand motion'); }
  }
  report.structuralChecksPass=true;
  report.headOrientationWithinNativeToleranceBetweenBakedSamples=['capture','play']
    .every(mode=>report.results[mode].headOrientationWithinNativeSampleTolerance);
  await fs.writeFile(path.join(out,'runtime-comparison.json'),JSON.stringify(report,null,2)+'\n');
} finally {await browser?.close();await server.close();}
