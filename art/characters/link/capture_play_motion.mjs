// Drive the actual player handle and inspect deformed shoe vertices against rendered stairs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {ROOT,serveStatic,launchBrowser,READY_TIMEOUT_MS} from '../../../gauntlet/scripts/lib/browser.mjs';

const candidate=process.env.LINK_REVIEW_ASSET||'link-runtime.glb';assert.match(candidate,/^[\w-]+\.glb$/);
const world=process.env.LINK_WORLD_ROOT||ROOT;
const balancedRender=process.argv.includes('--balanced-render');
const out=path.join(ROOT,'art/characters/link/progress',new Date().toISOString().replace(/[:.]/g,'-')+'-play-motion');
await fs.mkdir(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={kind:'Actual player/IK review, not a gauntlet take or animation acceptance',
  render_profile:balancedRender?'high geometry; shadow=2048,8; scale=0.75':'high defaults',
  world_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:world,encoding:'utf8'}).trim(),
  world_status:execFileSync('git',['status','--short'],{cwd:world,encoding:'utf8'}).trim(),
  glb_sha256:hash(await fs.readFile(path.join(world,'public/models/link',candidate))),
  capture_script_sha256:hash(await fs.readFile(new URL(import.meta.url))),
  character_source_sha256:hash(await fs.readFile(path.join(world,'src/world/character/glbLink.ts'))),
  samples:[],images:[],errors:[]};
report.bundles=Object.fromEntries(await Promise.all((await fs.readdir(path.join(world,'dist/assets')))
  .filter(f=>f.endsWith('.js')).sort().map(async f=>[f,hash(await fs.readFile(path.join(world,'dist/assets',f)))])));
const core=await fs.readFile(path.join(world,'node_modules/three/build/three.core.js'),'utf8');
report.measurement_core_sha256=hash(core);
const server=await serveStatic(path.join(world,'dist'));let browser,page;
try{
  browser=await launchBrowser();
  report.browserVersion=await browser.version();
  report.browserStderr='';
  browser.process()?.stderr?.on('data',b=>report.browserStderr=(report.browserStderr+b).slice(-12000));
  browser.process()?.on('exit',(code,signal)=>{report.browserExit={code,signal};});
  page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('error',e=>report.errors.push('Renderer: '+e.message));
  browser.on('disconnected',()=>{report.disconnectedAt=new Date().toISOString();});
  report.console=[];report.failedRequests=[];
  page.on('console',m=>{report.console.push({type:m.type(),text:m.text()});if(m.text().startsWith('[world]'))console.log(m.text());});
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  const pending=new Set();page.on('request',r=>pending.add(r.url()));
  page.on('requestfinished',r=>pending.delete(r.url()));page.on('requestfailed',r=>pending.delete(r.url()));
  page.on('response',r=>{if(r.url().endsWith('.glb'))report.glbResponse={status:r.status(),headers:r.headers()};});
  await page.setRequestInterception(true);
  page.on('request',r=>r.url()===server.url+'/__review-three-core.js'
    ?r.respond({status:200,contentType:'application/javascript',body:core}):r.continue());
  // Three's native inspection hook: no production code or capture API changes.
  await page.evaluateOnNewDocument(()=>{
    window.__reviewScenes=[];window.__THREE_DEVTOOLS__=new EventTarget();
    __THREE_DEVTOOLS__.addEventListener('observe',e=>{if(e.detail.isScene)__reviewScenes.push(e.detail);});
  });
  await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high'+(balancedRender?'&shadow=2048,8&scale=0.75':'')+(candidate==='link-runtime.glb'?'':'&link='+encodeURIComponent(candidate)),{waitUntil:'domcontentloaded',timeout:180000});
  try{await page.waitForFunction(()=>window.__ZR__,{timeout:READY_TIMEOUT_MS,polling:250});await page.evaluate(()=>__ZR__.ready());}
  finally{report.pendingRequests=[...pending];}
  report.setup=await page.evaluate(async()=>{
    const {Vector3,Raycaster}=await import('/__review-three-core.js');
    const scene=__reviewScenes.find(s=>s.userData.player);if(!scene)throw Error('Player scene missing');
    const player=scene.userData.player;player.setPlayMode(true);
    const hero=scene.getObjectByName('link');if(!hero)throw Error('GLB hero missing');
    const bodies=[];hero.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count>10000&&o.morphTargetDictionary?.blink!==undefined)bodies.push(o);});
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
  if(candidate==='link-runtime.glb')assert.equal(report.setup.character.linkAsset.sha256,report.glb_sha256);
  else assert.equal(report.setup.character.linkAsset.file,'models/link/'+candidate);
  const smoke=process.argv.includes('--smoke');
  const descentDetail=process.argv.includes('--descent-detail');
  const flatVideo=process.argv.includes('--flat-video');
  const flatStills=process.argv.includes('--flat-stills');
  const jumpOnly=process.argv.includes('--jump-only');
  const framesDir=path.join(out,'video-frames');let videoFrames=0;
  if(flatVideo)await fs.mkdir(framesDir);
  for(const scenario of jumpOnly?['run-jump']:(flatVideo||flatStills||process.argv.includes('--flat-only'))?['flat-transitions']:descentDetail?['stairs-down']:['flat-transitions','stairs-up','stairs-down']){
    const frames=smoke?12:jumpOnly?180:descentDetail?90:(scenario==='flat-transitions'?300:660);
    await page.evaluate(scenario=>{
      const {player}=__playReview;player.setPlayMode(true);player.setInput({moveX:0,moveZ:0,run:false});
      const stairs=__ZR__.audit().layout.stairs.find(s=>s.id==='main');
      const dx=stairs.top[0]-stairs.base[0],dz=stairs.top[2]-stairs.base[2],run=Math.hypot(dx,dz);
      const direction=[dx/run,dz/run];__playReview.direction=direction;
      if(scenario==='flat-transitions'||scenario==='run-jump')player.position.set(0,0,.5);
      else{const u=scenario==='stairs-up'?-.35:run+.15;player.position.set(stairs.base[0]+direction[0]*u,0,stairs.base[2]+direction[1]*u);}
      __ZR__.setTime(20);__playReview.previousRoot=null;
    },scenario);
    const chunk=flatVideo||flatStills||jumpOnly?2:descentDetail?10:30;
    for(let start=0;start<frames;start+=chunk){
      const count=Math.min(chunk,frames-start);
      const rows=await page.evaluate(async({scenario,start,count})=>{
        const {player,hero,body,markers,stairs,point,ray,down,direction}=__playReview;const rows=[];
        for(let j=0;j<count;j++){
          const i=start+j;const jumping=scenario==='run-jump';
          const moving=jumping?i<140:scenario!=='flat-transitions'||i<240;
          const d=scenario==='flat-transitions'||jumping?[0,-1]:direction.map(v=>v*(scenario==='stairs-up'?1:-1));
          player.setInput({moveX:moving?d[0]:0,moveZ:moving?d[1]:0,run:jumping||scenario==='flat-transitions'&&i>=120,jump:jumping&&i===45});
          const p=player.position;const ground=__ZR__.audit().systems.character.world.linkRoot[1];
          const offset=scenario==='flat-transitions'||jumping?[2.1,-1.2]
            :[-direction[0]*2.5-direction[1]*.5,-direction[1]*2.5+direction[0]*.5];
          __ZR__.setPose([p.x+offset[0],ground+1.4,p.z+offset[1]],[p.x,ground+.65,p.z],39);
          await __ZR__.render(1,1/60);
          const c=__ZR__.audit().systems.character;
          const root=hero.getWorldPosition(point).toArray();
          const separatePlacement=Number.isFinite(c.world.linkPlacementY);
          const placement=separatePlacement?[c.world.linkRoot[0],c.world.linkPlacementY,c.world.linkRoot[2]]:c.world.linkRoot;
          if(separatePlacement&&Math.abs(root[1]-c.world.linkRoot[1])>.00006)throw Error('Actual root does not match posed-root audit');
          // Placement and IK shift are each rounded to four decimals in the new audit.
          if(Math.abs(root[1]-placement[1]-c.linkIk.rootShiftM)>(separatePlacement?.00011:.00006))throw Error('Actual root does not match placement plus IK shift');
          const row={scenario,frame:i,gait:c.linkGait,root,placement,feet:c.linkFeetContact,ik:c.linkIk,locomotion:c.linkLocomotion,
            rootStepY:__playReview.previousRoot===null?null:root[1]-__playReview.previousRoot[1]};
          row.bodyPoints=Object.fromEntries(['hips','chest','head','handL','handR'].map(name=>{
            const bone=body.skeleton.bones.find(b=>b.name===name);if(!bone)throw Error('Missing body motion marker '+name);
            return [name,bone.getWorldPosition(point).toArray()];
          }));
          if(c.blinkWeights){
            row.blink={phase:c.blinkPhase,weights:c.blinkWeights,applied:[]};
            hero.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary?.blink!==undefined){
              const d=o.morphTargetDictionary,w=o.morphTargetInfluences;
              const applied={blink:w[d.blink],blinkHalf:w[d.blinkHalf]};
              for(const name of ['blink','blinkHalf'])if(Math.abs(applied[name]-c.blinkWeights[name])>.00006)throw Error('Blink influence disagrees with audit');
              row.blink.applied.push(applied);
            }});
            if(row.blink.applied.length!==3)throw Error('Expected blink on all three body primitives');
          }
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
      if(flatVideo)await page.screenshot({path:path.join(framesDir,`frame-${String(videoFrames++).padStart(4,'0')}.png`)});
      if(descentDetail||start===0||start+count===frames||start===Math.floor(frames/60)*30){
        const file=`${scenario}-${start+count}.png`;await page.screenshot({path:path.join(out,file)});report.images.push(file);
      }
      if(start%120===0)console.log(scenario,start+count,'/',frames);
    }
  }
  if(jumpOnly){
    assert.deepEqual([...new Set(report.samples.map(r=>r.locomotion.jump))],['ground','crouch','air','land']);
    assert.equal(report.samples.at(-1).locomotion.jump,'ground');
    for(const r of report.samples.filter(r=>r.locomotion.jump==='air'))
      assert.ok(Math.abs(r.root[1]-r.locomotion.jumpY)<.00006,'Airborne root must follow the actual ballistic arc');
  }
  if(process.argv.includes('--rapid-run')){
    report.rapidRun=await page.evaluate(async()=>{
      const {player,hero}=__playReview;player.setPlayMode(true);player.position.set(0,0,.5);
      player.setInput({moveX:0,moveZ:0,run:false});__ZR__.setTime(30);await __ZR__.render(1,0);
      const rows=[];
      for(let i=0;i<24;i++){
        player.setInput({moveX:0,moveZ:i<6?-1:0,run:i<6});await __ZR__.render(1,1/60);
        const c=__ZR__.audit().systems.character,applied=[];
        hero.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary?.blink!==undefined){const d=o.morphTargetDictionary,w=o.morphTargetInfluences;applied.push([w[d.blink],w[d.blinkHalf]]);}});
        rows.push({frame:i,time:__ZR__.stats().simTime,gait:c.linkGait,phase:c.blinkPhase,applied});
      }
      return rows;
    });
    assert.equal(report.rapidRun.length,24);
  }
  if(process.argv.includes('--blink-closeup')){
    const start=await page.evaluate(async()=>{
      const {player,body,point}=__playReview;
      player.setInput({moveX:0,moveZ:0,run:false});await __ZR__.render(30,1/60);
      body.skeleton.bones.find(b=>b.name==='head').getWorldPosition(point);
      point.y+=.04;
      const yaw=player.heading();
      __ZR__.setPose([point.x+Math.sin(yaw)*.9,point.y+.06,point.z+Math.cos(yaw)*.9],point.toArray(),32);
      return __ZR__.audit().systems.character.blinkNextT;
    });
    report.blinkCloseup=[];
    // The audit rounds nextT to 0.1 ms; sample before that boundary for an exactly open lid.
    for(const offset of [-.001,.035,.085,.16,.24]){
      const result=await page.evaluate(async t=>{
        __ZR__.setTime(t);await __ZR__.render(1,0);
        const read=()=>{const result=[];__playReview.hero.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary?.blink!==undefined){const d=o.morphTargetDictionary,w=o.morphTargetInfluences;result.push([w[d.blink],w[d.blinkHalf]]);}});return result;};
        const before=read();await __ZR__.render(1,0);const after=read();
        if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Blink changes on zero-dt render');
        return {time:t,phase:__ZR__.audit().systems.character.blinkPhase,applied:after};
      },start+offset);
      assert.equal(result.applied.length,3);
      const file=`blink-game-${offset}.png`;await page.screenshot({path:path.join(out,file)});
      report.blinkCloseup.push({...result,file});
      if(offset===.085&&process.argv.includes('--blink-diagnostic')){
        await page.evaluate(async()=>{
          const saved=new Map();__playReview.hero.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m.normalScale&&!saved.has(m)){saved.set(m,m.normalScale.clone());m.normalScale.set(0,0);}});
          __playReview.savedNormalScales=saved;await __ZR__.render(1,0);
        });
        const diagnostic='blink-no-normal-map.png';await page.screenshot({path:path.join(out,diagnostic)});
        await page.evaluate(async()=>{for(const [m,v] of __playReview.savedNormalScales)m.normalScale.copy(v);delete __playReview.savedNormalScales;await __ZR__.render(1,0);});
        report.blinkNormalDiagnostic={file:diagnostic,scope:'Character normal maps disabled only for diagnostic frame; restored immediately.'};
        await page.evaluate(async()=>{
          __playReview.savedShadows=[];
          __playReview.hero.traverse(o=>{if(o.isMesh){__playReview.savedShadows.push([o,o.receiveShadow]);o.receiveShadow=false;}});
          await __ZR__.render(1,0);
        });
        await page.screenshot({path:path.join(out,'blink-no-received-shadows.png')});
        await page.evaluate(async()=>{
          const saved=new Map();__playReview.hero.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m.normalScale&&!saved.has(m)){saved.set(m,m.normalScale.clone());m.normalScale.set(0,0);}});
          __playReview.savedNormalScales=saved;await __ZR__.render(1,0);
        });
        await page.screenshot({path:path.join(out,'blink-no-shadows-or-normal-map.png')});
        await page.evaluate(async()=>{
          for(const [m,v] of __playReview.savedNormalScales)m.normalScale.copy(v);
          for(const [o,receive] of __playReview.savedShadows)o.receiveShadow=receive;
          delete __playReview.savedNormalScales;delete __playReview.savedShadows;await __ZR__.render(1,0);
        });
        report.blinkShadowDiagnostic={files:['blink-no-received-shadows.png','blink-no-shadows-or-normal-map.png'],scope:'Diagnostic only; original shadow and normal-map settings restored.'};
        await page.evaluate(async()=>{__playReview.oldAtmoSettings=window.__ATMO_SETTINGS__;window.__ATMO_SETTINGS__={...window.__ATMO_SETTINGS__,aoStrength:0};await __ZR__.render(1,0);});
        await page.screenshot({path:path.join(out,'blink-no-screen-ao.png')});
        await page.evaluate(async()=>{if(__playReview.oldAtmoSettings===undefined)delete window.__ATMO_SETTINGS__;else window.__ATMO_SETTINGS__=__playReview.oldAtmoSettings;delete __playReview.oldAtmoSettings;await __ZR__.render(1,0);});
        report.blinkAoDiagnostic={file:'blink-no-screen-ao.png',scope:'Existing composer aoStrength override set to0 for one diagnostic frame, then restored.'};


      }

    }
    assert.equal(report.blinkCloseup[0].phase,0);assert.equal(report.blinkCloseup[2].phase,1);assert.equal(report.blinkCloseup.at(-1).phase,0);
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
  if(flatVideo){
    const file=path.join(out,'walk-run-idle.mp4');
    execFileSync('ffmpeg',['-v','error','-framerate','30','-i',path.join(framesDir,'frame-%04d.png'),
      '-c:v','libx264','-threads','2','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',file],{windowsHide:true});
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0',
      '-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',file],{encoding:'utf8',windowsHide:true}));
    assert.equal(Number(probe.streams[0].nb_read_frames),videoFrames);assert.equal(probe.streams[0].r_frame_rate,'30/1');
    report.video={file:path.basename(file),sha256:hash(await fs.readFile(file)),frames:videoFrames,...probe.streams[0]};
    // Keep the verified clip and representative stills; these are temporary encoder inputs.
    assert.equal(path.dirname(framesDir),out);
    for(let i=0;i<videoFrames;i++)await fs.unlink(path.join(framesDir,`frame-${String(i).padStart(4,'0')}.png`));
    await fs.rmdir(framesDir);
  }
  assert.deepEqual(report.errors,[]);report.complete=true;
}catch(e){
  report.failure=e.stack;
  report.processAtFailure={pid:browser?.process()?.pid,exitCode:browser?.process()?.exitCode,signal:browser?.process()?.signalCode,connected:browser?.connected};
  if(page){
    report.bootState=await page.evaluate(()=>({loading:document.querySelector('#loading')?.textContent,ready:!!window.__ZR__,resources:performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration,bytes:r.transferSize}))})).catch(e=>({diagnosticError:e.message}));
    await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  }
  throw e;
}finally{await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify({output:out,summary:report.summary}));
