// Real GLB + production puppet, without rendering the forest. Run with Node; optional asset filename.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {ROOT,launchBrowser} from '../../../gauntlet/scripts/lib/browser.mjs';

const asset=process.argv[2]||'link-runtime.glb';assert.match(asset,/^[\w-]+\.glb$/);
const server=await createServer({root:ROOT,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'empty-character-check',configureServer(s){s.middlewares.use('/__character-check',(_req,res)=>{
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Character check</title>');
  });}
}]});
let browser;
try{
  await server.listen();browser=await launchBrowser();const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]+'__character-check');
  const result=await page.evaluate(async ({asset,shiftTakeoff})=>{
    const [{loadGlbLink},{createLocomotion},{hardChain},{Vector3},{PLAYER_SPEED}]=await Promise.all([
      import('/src/world/character/glbLink.ts'),import('/src/world/character/puppet.ts'),
      import('/src/world/character/gaitChain.ts'),import('/node_modules/three/build/three.module.js'),
      import('/src/world/character/animation.ts')]);
    const puppet=await loadGlbLink('/models/link/'+asset),contact=new Vector3(),flat=()=>0;
    const clip=puppet.asset.clips.find(c=>c.name==='run');
    const loco=createLocomotion(),chain=hardChain('run');loco.speed=PLAYER_SPEED.run;
    const dt=clip.strideM/loco.speed/120;loco.dt=dt;
    const rows=[];let anchorShifted=false;
    for(let i=0;i<240;i++){
      const t=i*dt;puppet.advance(chain,t,loco.speed*dt,dt);
      // Moving a support-sampling anchor on a perfectly flat surface must not invent a reach deficit.
      if(shiftTakeoff&&!anchorShifted&&i>120&&rows.at(-2)?.feet[0].stance===true&&rows.at(-1)?.feet[0].stance===false&&Number.isFinite(loco.offZ[0])){
        loco.offZ[0]-=.04;anchorShifted=true;
      }
      puppet.pose(0,loco.speed*t,0,{...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco},flat,contact);
      rows.push({rootY:puppet.group.position.y,feet:puppet.feetContact(),ik:puppet.plantInfo()});
    }
    const steady=rows.slice(120),ys=steady.map(r=>r.rootY);
    return {asset,frames:rows.length,speedMps:loco.speed,anchorShifted,rootRangeM:Math.max(...ys)-Math.min(...ys),
      flightFrames:steady.filter(r=>r.feet.every(f=>f.minShoeGapM>.001)).length,
      maxFlightClearanceM:Math.max(...steady.map(r=>Math.min(...r.feet.map(f=>f.minShoeGapM)))),
      minShoeGapM:Math.min(...steady.flatMap(r=>r.feet.map(f=>f.minShoeGapM))),
      finite:rows.every(r=>Number.isFinite(r.rootY)&&r.feet.every(f=>Number.isFinite(f.soleY))),
      reachClamped:steady.filter(r=>r.ik.reachClamped).length};
  },{asset,shiftTakeoff:process.argv.includes('--shift-takeoff')});
  console.log(JSON.stringify(result,null,2));assert.deepEqual(errors,[]);
  assert.equal(result.finite,true);assert.equal(result.reachClamped,0);
  if(process.argv.includes('--shift-takeoff'))assert.equal(result.anchorShifted,true);
  assert.ok(result.rootRangeM<.003,'Flat run must not pull the body down to cancel flight');
  assert.ok(result.flightFrames>0,'Run needs frames with both shoes above ground');
  assert.ok(result.minShoeGapM>-.002,'Run must not bury a shoe');
}finally{await browser?.close();await server.close();}
