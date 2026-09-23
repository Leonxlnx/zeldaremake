// Production GLB/mixer/IK on synthetic stairs, without forest rendering. Actual-world proof is separate.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
import {ROOT,launchBrowser} from '../../../gauntlet/scripts/lib/browser.mjs';

const server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'stair-check',configureServer(s){s.middlewares.use('/__stair-check',(_req,res)=>{
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Stair check</title>');
  });}
}]});
let browser;
try{
  await server.listen();browser=await launchBrowser();const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]+'__stair-check');
  const result=await page.evaluate(async(asset)=>{
    const [{loadGlbLink},{createLocomotion},{hardChain},{Vector3}]=await Promise.all([
      import('/src/world/character/glbLink.ts'),import('/src/world/character/puppet.ts'),
      import('/src/world/character/gaitChain.ts'),import('/node_modules/three/build/three.module.js')]);
    const result={};
    for(const scenario of ['flat','up','down']){
      const puppet=await loadGlbLink('/models/link/'+asset),loco=createLocomotion(),chain=hardChain('stairs');
      loco.speed=1.1;const dt=1/60,contact=new Vector3(),rows=[];
      const ground=(_x,z)=>scenario==='flat'?0:.27*Math.max(0,Math.min(20,Math.floor(z/.54)));
      const read=()=>{
        const points=Object.fromEntries(['hips','chest','thighL','kneeL','ankleL','thighR','kneeR','ankleR'].map(n=>[n,puppet.group.getObjectByName(n).getWorldPosition(new Vector3())]));
        const down=points.hips.clone().sub(points.chest);
        return {rootY:puppet.group.position.y,feet:puppet.feetContact().map(f=>({...f})),ik:{...puppet.plantInfo()},
          angles:['L','R'].map(s=>{
            const thigh=points['knee'+s].clone().sub(points['thigh'+s]),shin=points['ankle'+s].clone().sub(points['knee'+s]);
            return {hip:thigh.angleTo(down)*180/Math.PI,knee:thigh.angleTo(shin)*180/Math.PI};
          })};
      };
      for(let i=0;i<600;i++){
        loco.dt=dt;const t=i*dt,z=scenario==='down'?10.7-1.1*t:-.3+1.1*t,yaw=scenario==='down'?Math.PI:0;
        puppet.advance(chain,t,loco.speed*dt,dt);
        const pose={...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco};
        puppet.pose(0,z,yaw,pose,ground,contact);const row=read();rows.push(row);
        if(i%30===0){
          loco.dt=0;puppet.pose(0,z,yaw,pose,ground,contact);
          const again=read();if(Math.abs(again.rootY-row.rootY)>1e-6)throw Error('Zero-dt body height changed');
        }
      }
      result[scenario]={rows,maxHip:Math.max(...rows.flatMap(r=>r.angles.map(a=>a.hip))),
        maxKnee:Math.max(...rows.flatMap(r=>r.angles.map(a=>a.knee))),
        maxRootStep:Math.max(...rows.slice(1).map((r,i)=>Math.abs(r.rootY-rows[i].rootY))),
        minShoe:Math.min(...rows.flatMap(r=>r.feet.map(f=>f.minShoeGapM))),
        reachClamped:rows.filter(r=>r.ik.reachClamped).length};
      const jumpY=ground(0,2)+1;
      loco.jump={phase:'air',t0:10,y0:jumpY-1,y:jumpY,v0:6,vx:0,vz:1.1,vLand:6,flightS:1,air:.5};
      loco.dt=dt;
      puppet.pose(0,2,0,{...chain,t:10.5,phase:0,look:null,lookWeight:0,idleTurn:0,loco},ground,contact);
      if(loco.offX?.some(Number.isFinite)||loco.offZ?.some(Number.isFinite))throw Error('Jump retained an obsolete ground take-off');
      if(Math.abs(puppet.group.position.y-jumpY)>1e-9)throw Error('Ground correction changed airborne root height');
    }
    return result;
  },process.argv[3]||'link-runtime.glb');
  assert.deepEqual(errors,[]);
  for(const r of Object.values(result)){
    assert.equal(r.reachClamped,0);assert.ok(Number.isFinite(r.maxHip));
  }
  assert.ok(result.up.maxRootStep<.04,'Swing must leave the actual planted tread without a full-riser body pop');
  assert.ok(result.down.maxRootStep<.04,'Descending body motion must stay continuous');
  if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(result));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,{rows,...v}])=>[k,v])),null,2));
}finally{await browser?.close();await server.close();}
