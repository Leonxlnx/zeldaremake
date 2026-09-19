// Actual Three.js GLB renders. Reuse the repository's headless browser and server.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from '../../../gauntlet/scripts/lib/browser.mjs';
const root=path.join(ROOT,'art/characters/link');
const studio=process.argv.includes('--studio');
const assetFlag=process.argv.indexOf('--asset');
const asset=assetFlag<0?'link-runtime.glb':process.argv[assetFlag+1];
assert.ok(asset && asset.endsWith('.glb'),'--asset needs a local GLB path relative to art/characters/link');
const assetFile=path.resolve(root,asset);
assert.ok(assetFile.startsWith(root+path.sep),'Review asset must stay under art/characters/link');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'progress',stamp+(studio?'-runtime-studio':'-runtime'));await fs.mkdir(output,{recursive:true});
const report={at:new Date().toISOString(),kind:'Actual Three.js runtime GLB review; not a world gauntlet capture',
  asset:path.relative(root,assetFile).replaceAll('\\','/'),
  glb_sha256:crypto.createHash('sha256').update(await fs.readFile(assetFile)).digest('hex'),views:{},errors:[]};
const server=await serveStatic(ROOT);let browser;
console.log('Review server',server.url);
try{
  // Native pipes avoid this PC's stalled localhost WebSocket handshake.
  browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:60000,
    args:['--no-sandbox','--disable-gpu-sandbox','--use-angle='+(process.platform==='win32'?'d3d11':'swiftshader'),'--enable-unsafe-swiftshader','--hide-scrollbars','--mute-audio','--no-proxy-server'],
    defaultViewport:{width:720,height:820}});
  const page=await browser.newPage();
  await page.setViewport({width:720,height:820});
  page.on('pageerror',e=>{report.errors.push(e.message);console.error(e.message);});
  page.on('requestfailed',r=>console.error('Request failed',r.url(),r.failure()?.errorText));
  await page.goto(server.url+'/art/characters/link/review.html?capture=1&asset='+encodeURIComponent(report.asset)+(studio?'&studio=1':''),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.REVIEW?.ready,{timeout:90000});
  const durations=await page.evaluate(()=>REVIEW.durations);
  report.sole_local=await page.evaluate(()=>REVIEW.soleLocal);
  report.gpu=await page.evaluate(()=>REVIEW.gpu);
  report.lighting=await page.evaluate(()=>REVIEW.lighting);
  assert.equal(report.lighting,studio?'studio':'directional');
  for(const [name,gait,t,view] of [
    ['01-body','idle',0,'body'],['02-front','idle',0,'front'],['03-side','idle',0,'side'],
    ['04-back','idle',0,'back'],['05-face','idle',0,'face'],['06-boots','idle',0,'boots'],
    ...['walk','run','stairs'].flatMap(gait=>[0,.25,.5,.75].map(phase=>[gait+'-'+phase,gait,durations[gait]*phase,'body']))
  ]){
    await page.evaluate(({gait,t,view})=>REVIEW.pose(gait,t,view),{gait,t,view});
    const png=await page.screenshot({path:path.join(output,name+'.png')});
    const sole_heights=await page.evaluate(()=>REVIEW.soleHeights());
    report.views[name]={gait,t,view,sole_heights,sha256:crypto.createHash('sha256').update(png).digest('hex')};
  }
  report.motion_clearance=await page.evaluate(()=>Object.fromEntries(['walk','run','stairs'].map(gait=>{
    const minimum={L:Infinity,R:Infinity},worstPhase={L:0,R:0};
    for(let i=0;i<=120;i++){
      REVIEW.pose(gait,REVIEW.durations[gait]*i/120);
      const heights=REVIEW.soleHeights();
      for(const side of ['L','R'])if(heights[side]<minimum[side]){minimum[side]=heights[side];worstPhase[side]=i/120;}
    }
    return [gait,{samples:121,minimum_sole_y:minimum,worst_phase:worstPhase}];
  })));
  if(process.argv.includes('--guards')){
    report.guard_views={};
    for(const side of ['L','R'])for(const gait of ['idle','walk','run','stairs']){
      const name=`guard-${side}-${gait}`;
      const info=await page.evaluate(({side,gait})=>{
        REVIEW.pose(gait,REVIEW.durations[gait]*.25);
        const a=REVIEW.camera.position.clone(),b=a.clone();
        REVIEW.model.getObjectByName('elbow'+side).getWorldPosition(a);
        REVIEW.model.getObjectByName('hand'+side).getWorldPosition(b);
        const axis=b.clone().sub(a).normalize(),radial=a.clone().set(side==='L'?1:-1,.15,.7);radial.addScaledVector(axis,-radial.dot(axis)).normalize();
        a.lerp(b,.55);REVIEW.camera.position.copy(a).addScaledVector(radial,.38);REVIEW.camera.lookAt(a);REVIEW.stats();
        const guards=[];REVIEW.model.traverse(o=>{if(o.isMesh&&/forearm.*guard/i.test(o.name+' '+o.parent?.name))guards.push({name:o.name,normalMap:!!o.material.normalMap});});
        return {guards,camera:REVIEW.camera.position.toArray(),target:a.toArray()};
      },{side,gait});
      assert.ok(info.guards.length>0,'Guard meshes missing');
      await page.screenshot({path:path.join(output,name+'.png')});report.guard_views[name]=info;
    }
  }
  if(process.argv.includes('--blink')||process.argv.includes('--blink-motion')){
    const motion=process.argv.includes('--blink-motion');
    const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const weights=motion?Array.from({length:30},(_,i)=>{const t=i/60;return t<.17?ease((t-.1)/.07):1-ease((t-.2)/.12);}):[0,.25,.5,.75,1];
    for(let frame=0;frame<weights.length;frame++){
    const weight=weights[frame];
    const meshes=await page.evaluate(weight=>{
      REVIEW.pose('idle',0,'face');let count=0;
      REVIEW.model.traverse(o=>{
        const index=o.morphTargetDictionary?.blink;
        if(Number.isInteger(index)){
          const half=o.morphTargetDictionary.blinkHalf;
          o.morphTargetInfluences[index]=Number.isInteger(half)?Math.max(0,2*weight-1):weight;
          if(Number.isInteger(half))o.morphTargetInfluences[half]=1-Math.abs(2*weight-1);
          count++;
        }
      });
      REVIEW.stats();return count;
    },weight);
    assert.ok(meshes>0,'Blink morph target missing from exported model');
    const name=motion?`blink-frame-${String(frame).padStart(4,'0')}`:`blink-${weight}`;
    const png=await page.screenshot({path:path.join(output,name+'.png')});
    (report.blink_views??={})[name]={weight,meshes,sha256:crypto.createHash('sha256').update(png).digest('hex')};
    if(process.argv.includes('--blink-diagnostic') && weight===1){
      await page.evaluate(()=>{
        window.__blinkMaterials=[];
        REVIEW.model.traverse(o=>{if(o.isMesh){window.__blinkMaterials.push([o,o.material,o.receiveShadow]);o.material=o.material.clone();}});
      });
      try {
        // Cumulative ablation: remove normal maps, then colour maps, then received shadows.
        for(const mode of ['no-normal','plain','no-shadow']){
          await page.evaluate(mode=>{
            for(const [o] of window.__blinkMaterials){
              const m=o.material;
              if(mode==='no-normal')m.normalMap=null;
              if(mode==='plain'){m.map=null;m.aoMap=null;m.roughnessMap=null;m.color.set('#bfa88d');m.roughness=.8;}
              if(mode==='no-shadow')o.receiveShadow=false;
              m.needsUpdate=true;
            }
            REVIEW.stats();
          },mode);
          const diagnostic=await page.screenshot({path:path.join(output,'blink-diagnostic-'+mode+'.png')});
          (report.blink_diagnostics??={})[mode]=crypto.createHash('sha256').update(diagnostic).digest('hex');
        }
      } finally {
        await page.evaluate(()=>{for(const [o,m,shadow] of window.__blinkMaterials){o.material.dispose();o.material=m;o.receiveShadow=shadow;}delete window.__blinkMaterials;REVIEW.stats();});
      }
      assert.equal(crypto.createHash('sha256').update(await page.screenshot()).digest('hex'),report.blink_views[name].sha256,'Diagnostic must restore the exact retained appearance');
    }
    }
    if(motion){
      const file=path.join(output,'blink-motion.mp4');
      execFileSync('ffmpeg',['-v','error','-framerate','60','-i',path.join(output,'blink-frame-%04d.png'),'-c:v','libx264','-threads','2','-crf','18','-pix_fmt','yuv420p',file],{windowsHide:true});
      const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,r_frame_rate','-of','json',file],{encoding:'utf8',windowsHide:true}));
      assert.equal(Number(probe.streams[0].nb_read_frames),30);assert.equal(probe.streams[0].r_frame_rate,'60/1');
      report.blink_motion={frames:30,fps:60,file:'blink-motion.mp4',closing_ms:70,hold_ms:30,opening_ms:120};
    }
    await page.evaluate(()=>REVIEW.model.traverse(o=>{
      for(const name of ['blink','blinkHalf']){
        const index=o.morphTargetDictionary?.[name];
        if(Number.isInteger(index))o.morphTargetInfluences[index]=0;
      }
    }));
  }
  if(process.argv.includes('--eyes'))for(const side of [1,-1]){
    await page.evaluate(side=>{
      REVIEW.pose('idle',0);
      REVIEW.camera.position.set(side*.055,.977,.295);
      REVIEW.camera.lookAt(side*.055,.970,.135);
      REVIEW.stats();
    },side);
    const name=side===1?'eye-L':'eye-R';
    const png=await page.screenshot({path:path.join(output,name+'.png')});
    (report.eye_views??={})[name]={sha256:crypto.createHash('sha256').update(png).digest('hex')};
  }
  if(process.argv.includes('--hands'))for(const side of [1,-1]){
    await page.evaluate(side=>{
      REVIEW.pose('idle',0);
      REVIEW.camera.position.set(side*.5,.54,.6);
      REVIEW.camera.lookAt(side*.285,.48,.02);
      REVIEW.stats();
    },side);
    const name=side===1?'hand-L':'hand-R';
    const png=await page.screenshot({path:path.join(output,name+'.png')});
    (report.hand_views??={})[name]={sha256:crypto.createHash('sha256').update(png).digest('hex')};
  }
  if(process.argv.includes('--cloth')){
    await page.evaluate(()=>{
      REVIEW.pose('idle',0);
      REVIEW.camera.position.set(.3,.86,.85);
      REVIEW.camera.lookAt(0,.73,0);
      REVIEW.stats();
    });
    const png=await page.screenshot({path:path.join(output,'cloth.png')});
    report.cloth_view={sha256:crypto.createHash('sha256').update(png).digest('hex')};
  }
  if(process.argv.includes('--cloth-motion')){
    const frames=path.join(output,'cloth-frames');await fs.mkdir(frames);
    for(let i=0;i<60;i++){
      await page.evaluate(i=>{
        REVIEW.pose('walk',REVIEW.durations.walk*i/59);
        const angle=-.25+.5*i/59,radius=.9+.5*i/59;
        REVIEW.camera.position.set(Math.sin(angle)*radius,.85,Math.cos(angle)*radius);
        REVIEW.camera.lookAt(0,.73,0);REVIEW.stats();
      },i);
      await page.screenshot({path:path.join(frames,`frame-${String(i).padStart(4,'0')}.png`)});
    }
    const file=path.join(output,'cloth-motion.mp4');
    execFileSync('ffmpeg',['-v','error','-framerate','30','-i',path.join(frames,'frame-%04d.png'),'-c:v','libx264','-threads','2','-crf','18','-pix_fmt','yuv420p',file],{windowsHide:true});
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,r_frame_rate','-of','json',file],{encoding:'utf8',windowsHide:true}));
    assert.equal(Number(probe.streams[0].nb_read_frames),60);assert.equal(probe.streams[0].r_frame_rate,'30/1');
    report.cloth_motion={frames:60,file:'cloth-motion.mp4',sha256:crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),camera:'One walk cycle with lateral orbit and pullback; identical sample times across candidates'};
  }
  if(process.argv.includes('--shading-diagnostic')){
    await page.evaluate(()=>{
      REVIEW.model.traverse(ob=>{if(ob.isMesh){if(!ob.receiveShadow)throw Error('Unexpected review shadow state');ob.receiveShadow=false;}});
      REVIEW.pose('idle',0,'face');
    });
    const png=await page.screenshot({path:path.join(output,'face-without-received-shadows-diagnostic.png')});
    report.shadow_diagnostic={kind:'Diagnostic only: character receives no shadows; casting and asset unchanged',sha256:crypto.createHash('sha256').update(png).digest('hex')};
    await page.evaluate(()=>{REVIEW.model.traverse(ob=>{if(ob.isMesh)ob.receiveShadow=true;});REVIEW.pose('idle',0,'face');});
    await page.evaluate(()=>{
      window.__savedTangents=[];
      REVIEW.model.traverse(ob=>{if(ob.isMesh){const tangent=ob.geometry.getAttribute('tangent');if(!tangent)throw Error('Expected exported tangent');window.__savedTangents.push([ob,tangent]);ob.geometry.deleteAttribute('tangent');ob.material.needsUpdate=true;}});
      REVIEW.pose('idle',0,'face');
    });
    const tangentPng=await page.screenshot({path:path.join(output,'face-derived-tangents-diagnostic.png')});
    report.tangent_diagnostic={kind:'Diagnostic only: renderer derives tangent frame; file and shadows unchanged',sha256:crypto.createHash('sha256').update(tangentPng).digest('hex')};
    await page.evaluate(()=>{for(const [ob,tangent] of window.__savedTangents){ob.geometry.setAttribute('tangent',tangent);ob.material.needsUpdate=true;}delete window.__savedTangents;REVIEW.pose('idle',0,'face');});
  }
  for(const [gait,check] of Object.entries(report.motion_clearance))
    for(const height of Object.values(check.minimum_sole_y))assert.ok(height>=-.002,gait+' sole penetrates the review ground');
  report.render=await page.evaluate(()=>REVIEW.stats());
  assert.deepEqual(report.errors,[]);
}catch(error){report.errors.push(error.message);throw error;}
finally{
  report.complete=Object.keys(report.views).length===18 && report.errors.length===0;
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(report,null,2));
  await browser?.close();await server.close();
}
console.log(JSON.stringify({output,views:Object.keys(report.views).length,render:report.render}));
