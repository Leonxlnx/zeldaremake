// CPU-only diagnostic: instrument production footConfig in Vite memory; never edit runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { Group, Mesh } from 'three';
import { launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve('.');
const workingSource=process.argv.includes('--working-source');
const baselineRef='0e41b57c';
const baselineSource=workingSource?await fs.readFile('src/world/character/glbLink.ts','utf8'):execFileSync('git',['show',baselineRef+':src/world/character/glbLink.ts'],{encoding:'utf8'});
const candidate = process.argv.includes('--placed-anchors');
const allCorners = process.argv.includes('--all-corners');
const onlyPins = process.argv.includes('--only-pins');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const runtimeSha256=digest(baselineSource);
const assetSha256=digest(await fs.readFile('public/models/link/link-runtime.glb'));
assert.equal(assetSha256,'ea93932d8afe02ec4bbcf3487fb20ce3f55272fb60f20998dc728cb637ae575f','Diagnostic phase fit requires the measured final candidate');
const server = await createServer({root, server:{host:'127.0.0.1',port:0}, plugins:[{
  name:'empty-diagnostic-page',configureServer(s){s.middlewares.use('/__cpu-stair',(_req,res)=>res.end('<!doctype html><title>CPU stair diagnostic</title>'));}
},{
  name:'read-only-foot-config-trace', enforce:'pre', transform(code,id) {
    if(!id.replaceAll('\\','/').endsWith('/src/world/character/glbLink.ts')) return;
    code = baselineSource.replaceAll('\r\n','\n');
    if(candidate) {
      code = code.replace('out: FootConfig): FootConfig {','out: FootConfig, placed = false): FootConfig {');
      code = code.replace('if (rise < 0) {\n      const eShifted', 'if (placed) shift = 0;\n    if (rise < 0) {\n      const eShifted');
      if(!onlyPins)code = code.replace('s.offYaw, leg.fp, cfgOff);','s.offYaw, leg.fp, cfgOff, !!heldOff);');
      code = code.replace('st ? st.swing.landYaw : leg.yawRel, leg.fp, cfgOff);','st ? st.swing.landYaw : leg.yawRel, leg.fp, cfgOff, true);');
    }
    code = code.replace('const sx = x + fx * shift;', 'const corners = []; const sx = x + fx * shift;');
    code = code.replace('let support = sinkFootprint(ground, sx, sz, fx, fz, back, ahead, PLANT_LAMBDAS);', 'let support = sinkFootprint(ground, sx, sz, fx, fz, back, ahead, PLANT_LAMBDAS); const centerSupport = support;');
    code = code.replace('if (ground(px, pz) <= base(px, pz) + 1e-6) continue;', 'const rendered = ground(px,pz), analytic = base(px,pz); corners.push({px,pz,rendered,analytic,enabled:rendered>analytic+1e-6,envelope:envelope(ground, px, pz, fx, fz, -1, PLANT_STEP, PLANT_LAMBDAS, false, NO_REACH)}); if (rendered <= analytic + 1e-6) continue;');
    if(allCorners)code=code.replace('if (rendered <= analytic + 1e-6) continue;','');
    code = code.replace('out.shift = shift;', 'globalThis.__footConfigTrace = {x,z,fx,fz,yawRel,fp,e,rise,shift,pitch,sx,sz,centerSupport,corners,support}; globalThis.__footConfigTraces?.push(globalThis.__footConfigTrace); out.shift = shift;');
    code = code.replace('const gMin = Math.min(legs[0].gRoot, legs[1].gRoot);','const gMin = Math.min(legs[0].gRoot, legs[1].gRoot); globalThis.__rootLegs = legs.map(l=>({side:l.side,rootOff:l.rootOff,rootLand:l.rootLand,phase:l.phase,swingW:l.swingW,gRoot:l.gRoot,g:l.g,soleP:l.soleP.toArray(),pinX:l.pinX,pinZ:l.pinZ,shift:l.shift,pitch:l.pitch}));');
    return code+'\nexport { footConfig as diagnosticFootConfig };';
  }
}]});
let browser;
try {
  const [{diagnosticFootConfig},{createGround},{createTerrain},{LAYOUT},{WORLD},{createRng},{buildStairway}] = await Promise.all([
    server.ssrLoadModule('/src/world/character/glbLink.ts'), server.ssrLoadModule('/src/world/character/ground.ts'),
    server.ssrLoadModule('/src/world/terrain/heightfield.ts'),server.ssrLoadModule('/src/world/layout.ts'),
    server.ssrLoadModule('/src/world/config.ts'),server.ssrLoadModule('/src/world/util/prng.ts'),server.ssrLoadModule('/src/world/hardscape/stairs.ts'),
  ]);
  const terrain=createTerrain(),ground=createGround(terrain,LAYOUT),def=LAYOUT.stairs.find(s=>s.id==='main');
  const built=buildStairway(def,terrain,createRng(WORLD.seed).fork('hardscape').fork('stairs-main'),WORLD.seed);
  const scene=new Group(),hardscape=new Group(),mesh=new Mesh(built.geometry);hardscape.name='hardscape';mesh.name='stairs-main';hardscape.add(mesh);scene.add(hardscape);ground.attachSurface(scene);
  const len=Math.hypot(...def.dir),fx=-def.dir[0]/len,fz=-def.dir[1]/len;
  const fp={heel:.0695,toe:.1184,latMin:-.0803,latMax:.0589};
  const rows=[];
  // Rounded recorded frame476/477 right pin. Sweep the input anchor along the facing.
  for(let mm=-45;mm<=45;mm++) {
    diagnosticFootConfig(ground.surface,ground.height,8.9139+fx*mm/1000,-1.4565+fz*mm/1000,fx,fz,0,fp,{});
    rows.push({inputOffsetMm:mm,...globalThis.__footConfigTrace});
  }
  const report={kind:'CPU production stair geometry / footConfig branch trace; rounded pin and yaw0 preliminary probe',ground:ground.surfaceInfo(),rows};
  await fs.writeFile('art/characters/link/progress/2026-09-20-natural-run-audit/stair-support-probe.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(rows.filter((r,i)=>i===0||i===45||i>0&&Math.abs(r.support-rows[i-1].support)>.02),null,2));
  if(process.argv.includes('--exact')) {
    await server.listen(); browser=await launchBrowser(); const page=await browser.newPage();
    await page.goto(server.resolvedUrls.local[0]+'__cpu-stair');
    const manifest=JSON.parse(await fs.readFile('art/characters/link/progress/2026-09-20T18-35-23-846Z-play-motion/manifest.json','utf8'));
    const exact=await page.evaluate(async samples=>{
      const [{loadGlbLink},{createGround},{createTerrain},{LAYOUT},{WORLD},{createRng},{buildStairway},{Group,Mesh,Vector3,Raycaster},{createLocomotion},{hardChain}]=await Promise.all([
        import('/src/world/character/glbLink.ts'),import('/src/world/character/ground.ts'),import('/src/world/terrain/heightfield.ts'),import('/src/world/layout.ts'),import('/src/world/config.ts'),import('/src/world/util/prng.ts'),import('/src/world/hardscape/stairs.ts'),import('/node_modules/three/build/three.module.js'),import('/src/world/character/puppet.ts'),import('/src/world/character/gaitChain.ts'),
      ]);
      const terrain=createTerrain(),ground=createGround(terrain,LAYOUT),def=LAYOUT.stairs.find(s=>s.id==='main');
      const built=buildStairway(def,terrain,createRng(WORLD.seed).fork('hardscape').fork('stairs-main'),WORLD.seed);
      const scene=new Group(),hardscape=new Group(),mesh=new Mesh(built.geometry);hardscape.name='hardscape';mesh.name='stairs-main';hardscape.add(mesh);scene.add(hardscape);ground.attachSurface(scene);
      const out={kind:'CPU-only production puppet and actual generated stairs; pelvis phase matched within rounded audit clipShift window',scenarios:{}};
      for(const scenario of ['stairs-up','stairs-down']){
        const puppet=await loadGlbLink('/models/link/link-runtime.glb'),loco=createLocomotion(),chain=hardChain('stairs'),point=new Vector3();
        let body;puppet.group.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count>10000&&o.morphTargetDictionary?.blink!==undefined)body=o;});
        const a=body.geometry.attributes,markers=[];
        for(const side of ['L','R']){
          const bone=body.skeleton.bones.findIndex(b=>b.name==='ankle'+side),verts=[];
          for(let i=0;i<a.position.count;i++){let weight=0;for(let k=0;k<4;k++)if(a.skinIndex.getComponent(i,k)===bone)weight+=a.skinWeight.getComponent(i,k);if(weight>.95)verts.push({i,p:new Vector3().fromBufferAttribute(a.position,i)});}
          const bottom=Math.min(...verts.map(v=>v.p.y)),sole=verts.filter(v=>v.p.y<bottom+.005),ids=new Set();
          for(const axis of ['x','z'])for(const sign of [-1,1])ids.add(sole.reduce((best,v)=>sign*v.p[axis]>sign*best.p[axis]?v:best).i);
          markers.push(...[...ids].map(i=>({side,i})));
        }
        const ray=new Raycaster(),down=new Vector3(0,-1,0),p=new Vector3();
        const rows=samples.filter(s=>s.scenario===scenario),ref=rows[scenario==='stairs-down'?477:155],tRef=20+(ref.frame+1)/60;
        const pelvis=puppet.group.getObjectByName('hips'),target=ref.bodyPoints.hips[1]-ref.root[1];
        const measure=shift=>{chain.clipShift=shift;puppet.pose(0,0,0,{...chain,t:tRef,phase:0,look:null,lookWeight:0,idleTurn:0,loco:null},()=>0,point);return pelvis.getWorldPosition(point).y-puppet.group.position.y;};
        const middle=ref.locomotion.clipShift[0];let lo=middle-.00005,hi=middle+.00005,low=measure(lo),high=measure(hi);
        if(target<Math.min(low,high)||target>Math.max(low,high))throw Error('Pelvis phase target outside rounded clip shift: '+JSON.stringify({scenario,target,lo,hi,low,high}));
        for(let j=0;j<40;j++){const mid=(lo+hi)/2,v=measure(mid);if((v<target)===(low<high))lo=mid;else hi=mid;}
        chain.clipShift=(lo+hi)/2;
        const diagnostics=[],metrics=[];let previous=null;
        for(const row of rows.filter(s=>s.frame>=80&&s.frame<590)){
          // The pelvis gives exact phase; steady speed preserves this clip shift.
          const a=row.bodyPoints.thighL,b=row.bodyPoints.thighR,dx=a[0]-b[0],dz=a[2]-b[2],yaw=Math.atan2(-dz,dx);
          loco.speed=row.locomotion.speed;loco.dt=1/60;
          globalThis.__footConfigTraces=[];
          puppet.pose(row.root[0],row.root[2],yaw,{...chain,t:20+(row.frame+1)/60,phase:0,look:null,lookWeight:0,idleTurn:0,loco},ground.height,point,ground.surface);
          const feet=puppet.feetContact(),posed=puppet.group.position.toArray();
          if(row.frame>=120){
            body.updateWorldMatrix(true,false);body.skeleton.update();const gaps=[];
            for(const {side,i} of markers){body.getVertexPosition(i,p);body.localToWorld(p);ray.set(p.clone().setY(p.y+1),down);ray.far=2;const hit=ray.intersectObject(mesh,false)[0];if(hit)gaps.push({side,vertex:i,gap:p.y-hit.point.y});}
            const angle=(a,b)=>a.angleTo(b)*180/Math.PI,positions=n=>puppet.group.getObjectByName(n).getWorldPosition(new Vector3());
            const legAngles=Object.fromEntries(['L','R'].map(s=>{const hip=positions('thigh'+s),knee=positions('knee'+s),ankle=positions('ankle'+s);return [s,angle(knee.sub(hip),ankle.sub(positions('knee'+s)))];}));
            const drift=previous?feet.map((f,i)=>loco.pinX[i]===previous.pins[i]?Math.hypot(f.soleX-previous.feet[i].soleX,f.soleZ-previous.feet[i].soleZ):0):[0,0];
            metrics.push({frame:row.frame,rootY:posed[1],rootStep:previous?posed[1]-previous.rootY:0,knee:legAngles,maxPlantedDrift:Math.max(...drift),minSoleGap:gaps.length?Math.min(...gaps.map(g=>g.gap)):null,gaps,feet,ik:puppet.plantInfo()});
          }
          previous={rootY:posed[1],feet,pins:[...loco.pinX]};
          if((scenario==='stairs-down'&&row.frame>=467&&row.frame<=481)||(scenario==='stairs-down'&&row.frame>=370&&row.frame<=379)||(scenario==='stairs-up'&&row.frame>=150&&row.frame<=162)){
            diagnostics.push({frame:row.frame,referenceRoot:row.root,replayRoot:puppet.group.position.toArray(),rootErrorM:puppet.group.position.y-row.root[1],referenceFeet:row.feet,feet:puppet.feetContact(),plant:puppet.plantInfo(),loco:structuredClone(loco),legs:globalThis.__rootLegs,calls:globalThis.__footConfigTraces});
          }
        }
        out.scenarios[scenario]={clipShift:chain.clipShift,pelvisFitErrorM:measure(chain.clipShift)-target,diagnostics,metrics,summary:{maxRootStep:Math.max(...metrics.map(r=>Math.abs(r.rootStep))),maxKnee:Math.max(...metrics.flatMap(r=>Object.values(r.knee))),maxPlantedDrift:Math.max(...metrics.map(r=>r.maxPlantedDrift)),minSoleGap:Math.min(...metrics.filter(r=>r.minSoleGap!==null).map(r=>r.minSoleGap))}};
      }
      out.flat={};
      for(const gait of ['idle','walk','run']){
        const puppet=await loadGlbLink('/models/link/link-runtime.glb'),chain=hardChain(gait),loco=createLocomotion(),contact=new Vector3(),speed={idle:0,walk:1.6,run:4.6}[gait],rows=[];
        for(let i=0;i<180;i++){const t=i/60;loco.speed=speed;loco.dt=1/60;puppet.advance(chain,t,speed/60,1/60);puppet.pose(0,speed*t,0,{...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco},()=>0,contact);rows.push([...puppet.group.position.toArray(),...['hips','thighL','kneeL','ankleL','thighR','kneeR','ankleR'].flatMap(n=>puppet.group.getObjectByName(n).getWorldPosition(new Vector3()).toArray())]);}
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)));out.flat[gait]=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
      }
      return out;
    },manifest.samples);
    exact.candidate=candidate;
    exact.allCorners=allCorners;
    exact.onlyPins=onlyPins;
    exact.inputs={baselineRef:workingSource?'working-source':baselineRef,runtimeSha256,assetSha256,sourceManifest:'art/characters/link/progress/2026-09-20T18-35-23-846Z-play-motion/manifest.json'};
    await fs.writeFile('art/characters/link/progress/2026-09-20-natural-run-audit/'+(workingSource?'stair-working-replay.json':onlyPins?'stair-pins-footprint-replay.json':allCorners&&!candidate?'stair-corners-only-replay.json':allCorners?'stair-full-footprint-replay.json':candidate?'stair-placed-anchors-replay.json':'stair-exact-replay.json'),JSON.stringify(exact,null,2)+'\n');
    console.log(JSON.stringify(Object.fromEntries(Object.entries(exact.scenarios).map(([k,v])=>[k,{clipShift:v.clipShift,maxError:Math.max(...v.diagnostics.map(x=>Math.abs(x.rootErrorM)))}])),null,2));
    if(process.argv.includes('--assert-support')){
      const down=exact.scenarios['stairs-down'],frame=f=>down.metrics.find(r=>r.frame===f);
      assert.ok(Math.abs(frame(477).rootStep)<.02,'Known stance pin transition must not produce a 60mm root jump');
      assert.ok(frame(476).minSoleGap>=-.002&&frame(477).minSoleGap>=-.002,'Fix must keep measured boot corners above the actual stair mesh at touchdown and pin reuse');
      const pinFrame=down.diagnostics.find(r=>r.frame===477),pinConfig=pinFrame.calls.at(-1),pinFoot=pinFrame.feet[1];
      assert.ok(Math.hypot(pinFoot.soleX-pinConfig.sx,pinFoot.soleZ-pinConfig.sz)<.00001,'Pinned sole must occupy the world point used to calculate its vertical support');
      const baseline=JSON.parse(await fs.readFile('art/characters/link/progress/2026-09-20-natural-run-audit/stair-exact-replay.json','utf8'));
      assert.deepEqual(exact.flat,baseline.flat,'Flat idle/walk/run skeleton traces changed');
      for(const name of ['stairs-up','stairs-down']){
        const original=baseline.scenarios[name],updated=exact.scenarios[name];
        assert.ok(updated.summary.maxPlantedDrift<.00001,'Planted sole drift exceeds10um');
        assert.ok(updated.summary.maxKnee<=original.summary.maxKnee+.01,'Peak knee fold regressed');
        for(let i=0;i<updated.metrics.length;i++)assert.ok(updated.metrics[i].minSoleGap>=-.02||original.metrics[i].minSoleGap<-.02,'New shoe penetration beyond existing20mm threshold at '+name+'/'+updated.metrics[i].frame);
      }
      console.log('PASS: known landing/pin support regression, actual mesh contact, flat traces, stair knee/drift nonregression');
    }
  }
} finally {await browser?.close();await server.close();}
