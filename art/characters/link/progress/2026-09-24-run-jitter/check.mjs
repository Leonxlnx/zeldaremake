// Real GLB + production IK, CPU only. The pre-fix module is loaded from the PR's reviewed head.
// node art/characters/link/progress/2026-09-24-run-jitter/check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {ROOT,launchBrowser} from '../../../../../gauntlet/scripts/lib/browser.mjs';
const out=path.join(ROOT,'art/characters/link/progress/2026-09-24-run-jitter');
const file=path.join(ROOT,'src/world/character/glbLink.ts');
const current=await fs.readFile(file,'utf8');
const baseline=execFileSync('git',['show','11a74993:src/world/character/glbLink.ts'],{cwd:ROOT,encoding:'utf8'});
const asset=await fs.readFile(path.join(ROOT,'public/models/link/link-runtime.glb'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
process.env.ZR_NATIVE_GPU='0';
const server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},plugins:[{
 name:'vertical-regression',enforce:'pre',
 resolveId(id){if(id.endsWith('/glbLink.vertical-baseline.ts'))return file.replace('glbLink.ts','glbLink.vertical-baseline.ts');},
 load(id){if(id.endsWith('/glbLink.vertical-baseline.ts'))return baseline;},
 transform(_code,id){if(id.replaceAll('\\','/').endsWith('/src/world/character/glbLink.ts'))return current;},
 configureServer(s){s.middlewares.use('/__vertical',(_req,res)=>res.end('<!doctype html><title>CPU vertical regression</title>'));s.middlewares.use('/models/link/vertical-test.glb',(_req,res)=>{res.setHeader('Content-Type','model/gltf-binary');res.end(asset);});},
}]});
let browser;
try {
 await server.listen();browser=await launchBrowser();const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]+'__vertical');
 const results=await page.evaluate(async()=>{
  const [{loadGlbLink:before},{loadGlbLink:after,JUMP_LAND_S},{createLocomotion},{hardChain,switchGait},{PLAYER_SPEED,PLAYER_ACCEL,PLAYER_DECEL},{Vector3}]=await Promise.all([import('/src/world/character/glbLink.vertical-baseline.ts'),import('/src/world/character/glbLink.ts'),import('/src/world/character/puppet.ts'),import('/src/world/character/gaitChain.ts'),import('/src/world/character/animation.ts'),import('/node_modules/three/build/three.module.js')]);
  const samplers={flat:()=>0,up:(_x,z)=>z*.2,down:(_x,z)=>-z*.2,uneven:(x,z)=>.025*Math.sin(z*2.3)+.01*Math.sin(x*3+z*1.4)};
  const dt=1/60,stats=v=>({min:Math.min(...v),max:Math.max(...v),rms:Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length)}),diff=v=>v.slice(1).map((x,i)=>x-v[i]);
  const summary=r=>{const y=r.map(x=>x.hipsY-x.groundY),d=diff(y);return {height:stats(y),delta:stats(d),secondDelta:stats(diff(d)),reversals:d.slice(1).filter((v,i)=>v*d[i]<0).length,minShoeGapM:Math.min(...r.flatMap(x=>x.feet.map(f=>f.minShoeGapM))),reachClamps:r.filter(x=>x.ik.reachClamped).length,maxReachExcessM:Math.max(...r.map(x=>x.ik.reachExcessM))};};
  const result={};
  for(const gait of ['idle','walk','run','stairs'])for(const [terrain,ground] of Object.entries(samplers)){
   const variants=[];
   for(const load of [before,after]){
    const puppet=await load('/models/link/vertical-test.glb'),chain=hardChain(gait),loco=createLocomotion(),contact=new Vector3(),speed=PLAYER_SPEED[gait],rows=[];let pose;
    for(let i=0;i<420;i++){const t=i*dt;loco.speed=speed;loco.dt=dt;puppet.advance(chain,t,speed*dt,dt);pose={...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco};puppet.pose(0,speed*t,0,pose,ground,contact);if(i>=120)rows.push({hipsY:puppet.group.getObjectByName('hips').getWorldPosition(new Vector3()).y,groundY:ground(0,speed*t),rootY:puppet.group.position.y,feet:puppet.feetContact(),ik:puppet.plantInfo()});}
    const old=puppet.group.getObjectByName('hips').getWorldPosition(new Vector3());loco.dt=0;puppet.pose(0,speed*pose.t,0,pose,ground,contact);const zeroDt=old.distanceTo(puppet.group.getObjectByName('hips').getWorldPosition(new Vector3()));
    variants.push({summary:summary(rows),zeroDt,rows});
   }
   const [a,b]=variants;
   result[gait+'-'+terrain]={speed:PLAYER_SPEED[gait],before:a.summary,after:b.summary,zeroDt:b.zeroDt,maxPelvisDropM:Math.max(...a.rows.map((r,i)=>r.hipsY-b.rows[i].hipsY)),
    maxFeetPositionDifferenceM:Math.max(...a.rows.flatMap((r,i)=>r.feet.map((f,j)=>Math.hypot(f.soleX-b.rows[i].feet[j].soleX,f.soleY-b.rows[i].feet[j].soleY,f.soleZ-b.rows[i].feet[j].soleZ)))),
    protectedTraceExact:JSON.stringify(a.rows)===JSON.stringify(b.rows)};
  }
  const transitions=[];
  for(const load of [before,after]){
   const puppet=await load('/models/link/vertical-test.glb'),chain=hardChain('idle'),loco=createLocomotion(),contact=new Vector3(),rows=[];let z=0,speed=0;
   const hooks={align:puppet.alignClip.bind(puppet),hasPhase:g=>g!=='idle',anchor:(g,shift,t)=>puppet.anchor(0,z,0,g,shift,t)};
   for(let i=0;i<360;i++){
    const t=i*dt,wanted=i<60||i>=300?'idle':i<180?'walk':'run',goal=PLAYER_SPEED[wanted];
    speed+=Math.sign(goal-speed)*Math.min(Math.abs(goal-speed),(goal>speed?PLAYER_ACCEL:PLAYER_DECEL)*dt);
    switchGait(chain,speed>.01?(wanted==='idle'?chain.gait:wanted):'idle',t,hooks);
    z+=speed*dt;loco.speed=speed;loco.dt=dt;puppet.advance(chain,t,speed*dt,dt);
    puppet.pose(0,z,0,{...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco},samplers.flat,contact);
    rows.push({hipsY:puppet.group.getObjectByName('hips').getWorldPosition(new Vector3()).y,groundY:0,feet:puppet.feetContact(),ik:puppet.plantInfo()});
   }
   transitions.push({summary:summary(rows),rows});
  }
  result.transitions={before:transitions[0].summary,after:transitions[1].summary,zeroDt:0,maxPelvisDropM:Math.max(...transitions[0].rows.map((r,i)=>r.hipsY-transitions[1].rows[i].hipsY))};
  result.jumpBoundaries={};
  for(const gait of ['walk','run']){
   const variants=[];
   for(const load of [before,after]){
    const puppet=await load('/models/link/vertical-test.glb'),rows=[];
    for(let i=0;i<32;i++)for(const boundary of ['crouch','land']){
     const t=3.2+i*.019,loco=createLocomotion(),chain=hardChain(gait),pose={...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco},contact=new Vector3();loco.speed=PLAYER_SPEED[gait];
     const jump={phase:boundary,t0:boundary==='land'?t-JUMP_LAND_S:t,y0:0,y:0,v0:4,vx:0,vz:0,vLand:4,flightS:.8,air:0};
     loco.jump=boundary==='land'?jump:null;puppet.pose(0,0,0,pose,samplers.flat,contact);const y=puppet.group.getObjectByName('hips').getWorldPosition(new Vector3()).y;
     loco.jump=boundary==='land'?null:jump;puppet.pose(0,0,0,pose,samplers.flat,contact);rows.push({boundary,delta:puppet.group.getObjectByName('hips').getWorldPosition(new Vector3()).y-y});
    }
    variants.push(rows);
   }
   result.jumpBoundaries[gait]=Math.max(...variants[0].map((r,i)=>Math.abs(r.delta-variants[1][i].delta)));
  }
  return result;
 });
 const report={baselineRef:'11a74993',baselineRuntimeSha256:hash(baseline),runtimeSha256:hash(current),assetSha256:hash(asset),results};
 await fs.writeFile(path.join(out,'regression.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
 for(const [name,r] of Object.entries(results)){
  if(name==='jumpBoundaries'){for(const [gait,delta] of Object.entries(r))assert.ok(delta<1e-6,gait+' new jump boundary snap');continue;}
  assert.equal(r.zeroDt,0,name+' zero-dt');
  assert.ok(r.after.minShoeGapM>=r.before.minShoeGapM-.0001,name+' sole contact regressed');
  assert.ok(r.after.reachClamps<=r.before.reachClamps,name+' reach clamping regressed');
  assert.ok(r.maxPelvisDropM<=.0250001,name+' correction limit');
  if(name.startsWith('stairs-')||name.startsWith('idle-'))assert.equal(r.protectedTraceExact,true,name+' changed');
 }
 for(const gait of ['walk','run']){
  const r=results[gait+'-flat'];assert.ok(r.after.secondDelta.rms<r.before.secondDelta.rms*.15,gait+' high-frequency motion retained');
  assert.ok(Math.max(-r.after.delta.min,r.after.delta.max)<.0012,gait+' flat pelvis step');
 }
 report.passed=true;await fs.writeFile(path.join(out,'regression.json'),JSON.stringify(report,null,2)+'\n');
} finally {await browser?.close();await server.close();}
