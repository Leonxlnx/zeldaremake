// Drive the actual player handle and inspect deformed shoe vertices against rendered stairs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from '../../../gauntlet/scripts/lib/browser.mjs';

const world=process.env.LINK_WORLD_ROOT||'E:/zeldaremake-integrated-review';
const out=path.join(ROOT,'art/characters/link/progress',new Date().toISOString().replace(/[:.]/g,'-')+'-play-motion');
await fs.mkdir(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={kind:'Actual player/IK review, not a gauntlet take or animation acceptance',
  world_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:world,encoding:'utf8'}).trim(),
  world_status:execFileSync('git',['status','--short'],{cwd:world,encoding:'utf8'}).trim(),
  glb_sha256:hash(await fs.readFile(path.join(world,'public/models/link/link-runtime.glb'))),
  capture_script_sha256:hash(await fs.readFile(new URL(import.meta.url))),
  samples:[],images:[],errors:[]};
const core=await fs.readFile(path.join(world,'node_modules/three/build/three.core.js'),'utf8');
report.measurement_core_sha256=hash(core);
const server=await serveStatic(path.join(world,'dist'));let browser;
try{
  browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:180000,
    args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],defaultViewport:{width:1280,height:720}});
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>r.url()===server.url+'/__review-three-core.js'
    ?r.respond({status:200,contentType:'application/javascript',body:core}):r.continue());
  // Three's native inspection hook: no production code or capture API changes.
  await page.evaluateOnNewDocument(()=>{
    window.__reviewScenes=[];window.__THREE_DEVTOOLS__=new EventTarget();
    __THREE_DEVTOOLS__.addEventListener('observe',e=>{if(e.detail.isScene)__reviewScenes.push(e.detail);});
  });
  await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high',{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__ZR__,{timeout:180000});await page.evaluate(()=>__ZR__.ready());
  report.setup=await page.evaluate(async()=>{
    const {Vector3,Raycaster}=await import('/__review-three-core.js');
    const scene=__reviewScenes.find(s=>s.userData.player);if(!scene)throw Error('Player scene missing');
    const player=scene.userData.player;player.setPlayMode(true);
    const hero=scene.getObjectByName('link');if(!hero)throw Error('GLB hero missing');
    const bodies=[];hero.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count>10000)bodies.push(o);});
    if(bodies.length!==1)throw Error('Expected one skinned body, got '+bodies.length);
    const body=bodies[0],a=body.geometry.attributes,markers={};
    for(const side of ['L','R']){
      const bone=body.skeleton.bones.findIndex(b=>b.name==='ankle'+side),vertices=[];
      if(bone<0)throw Error('Ankle bone missing');
      for(let i=0;i<a.position.count;i++){
        let weight=0;for(let k=0;k<4;k++)if(a.skinIndex.getComponent(i,k)===bone)weight+=a.skinWeight.getComponent(i,k);
        if(weight>.95)vertices.push({i,p:new Vector3().fromBufferAttribute(a.position,i)});
      }
      const bottom=Math.min(...vertices.map(v=>v.p.y));const sole=vertices.filter(v=>v.p.y<bottom+.005);
      if(sole.length<4)throw Error('Insufficient original sole vertices');
      const chosen=new Set();
      for(const axis of ['x','z'])for(const sign of [-1,1])chosen.add(sole.reduce((best,v)=>sign*v.p[axis]>sign*best.p[axis]?v:best).i);
      markers[side]=[...chosen];
    }
    const stairs=[];scene.traverse(o=>{if(o.isMesh&&/^stairs-/.test(o.name))stairs.push(o);});
    if(stairs.length<1)throw Error('Rendered stair meshes missing');
    const ray=new Raycaster(),point=new Vector3(),down=new Vector3(0,-1,0);
    window.__playReview={scene,player,hero,body,markers,stairs,point,ray,down};
    return {markers,stairMeshes:stairs.map(o=>o.name),character:__ZR__.audit().systems.character};
  });
  assert.equal(report.setup.character.linkSource,'glb');assert.equal(report.setup.character.mode,'play');
  assert.equal(report.setup.character.linkAsset.sha256,report.glb_sha256);
  const smoke=process.argv.includes('--smoke');
  const descentDetail=process.argv.includes('--descent-detail');
  for(const scenario of descentDetail?['stairs-down']:['flat-transitions','stairs-up','stairs-down']){
    const frames=smoke?12:descentDetail?90:(scenario==='flat-transitions'?300:660);
    await page.evaluate(scenario=>{
      const {player}=__playReview;player.setPlayMode(true);player.setInput({moveX:0,moveZ:0,run:false});
      const stairs=__ZR__.audit().layout.stairs.find(s=>s.id==='main');
      const dx=stairs.top[0]-stairs.base[0],dz=stairs.top[2]-stairs.base[2],run=Math.hypot(dx,dz);
      const direction=[dx/run,dz/run];__playReview.direction=direction;
      if(scenario==='flat-transitions')player.position.set(0,0,.5);
      else{const u=scenario==='stairs-up'?-.35:run+.15;player.position.set(stairs.base[0]+direction[0]*u,0,stairs.base[2]+direction[1]*u);}
      __ZR__.setTime(20);__playReview.previousRoot=null;
    },scenario);
    const chunk=descentDetail?10:30;
    for(let start=0;start<frames;start+=chunk){
      const count=Math.min(chunk,frames-start);
      const rows=await page.evaluate(async({scenario,start,count})=>{
        const {player,hero,body,markers,stairs,point,ray,down,direction}=__playReview;const rows=[];
        for(let j=0;j<count;j++){
          const i=start+j;const moving=scenario!=='flat-transitions'||i<240;
          const d=scenario==='flat-transitions'?[0,-1]:direction.map(v=>v*(scenario==='stairs-up'?1:-1));
          player.setInput({moveX:moving?d[0]:0,moveZ:moving?d[1]:0,run:scenario==='flat-transitions'&&i>=120});
          const p=player.position;const ground=__ZR__.audit().systems.character.world.linkRoot[1];
          const offset=scenario==='flat-transitions'?[2.1,-1.2]
            :[-direction[0]*2.5-direction[1]*.5,-direction[1]*2.5+direction[0]*.5];
          __ZR__.setPose([p.x+offset[0],ground+1.4,p.z+offset[1]],[p.x,ground+.65,p.z],39);
          await __ZR__.render(1,1/60);
          const c=__ZR__.audit().systems.character;
          const root=hero.getWorldPosition(point).toArray();
          if(Math.abs(root[1]-c.world.linkRoot[1]-c.linkIk.rootShiftM)>.00006)throw Error('Actual root does not match placement plus IK shift');
          const row={scenario,frame:i,gait:c.linkGait,root,placement:c.world.linkRoot,feet:c.linkFeetContact,ik:c.linkIk,
            rootStepY:__playReview.previousRoot===null?null:root[1]-__playReview.previousRoot[1]};
          __playReview.previousRoot=root;
          if(i%10===0){
            row.shoeSurface=[];body.updateWorldMatrix(true,false);body.skeleton.update();
            for(const [side,ids] of Object.entries(markers))for(const index of ids){
              point.fromBufferAttribute(body.geometry.attributes.position,index);body.applyBoneTransform(index,point);body.localToWorld(point);
              ray.set(point.clone().setY(point.y+1),down);ray.far=2;
              const hits=ray.intersectObjects(stairs,false);
              if(hits.length)row.shoeSurface.push({foot:side,vertex:index,point:point.toArray(),stair:hits[0].object.name,gapM:point.y-hits[0].point.y});
            }
          }
          rows.push(row);
        }return rows;
      },{scenario,start,count});
      report.samples.push(...rows);
      if(descentDetail||start===0||start+count===frames||start===Math.floor(frames/60)*30){
        const file=`${scenario}-${start+count}.png`;await page.screenshot({path:path.join(out,file)});report.images.push(file);
      }
      if(start%120===0)console.log(scenario,start+count,'/',frames);
    }
  }
  report.summary=Object.fromEntries([...new Set(report.samples.map(r=>r.scenario))].map(scenario=>{
    const rows=report.samples.filter(r=>r.scenario===scenario),surface=rows.flatMap(r=>r.shoeSurface??[]);
    return [scenario,{frames:rows.length,gaits:[...new Set(rows.map(r=>r.gait))],
      distanceXZ:Math.hypot(rows.at(-1).root[0]-rows[0].root[0],rows.at(-1).root[2]-rows[0].root[2]),
      maxRootStepM:Math.max(...rows.map(r=>Math.abs(r.rootStepY??0))),
      reachClampedFrames:rows.filter(r=>r.ik.reachClamped).length,measuredShoePoints:surface.length,
      minRenderedStairGapM:surface.length?Math.min(...surface.map(p=>p.gapM)):null,
      shoeSamplesBelowMinus2cm:surface.filter(p=>p.gapM<-.02).length}];
  }));
  assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify({output:out,summary:report.summary}));
