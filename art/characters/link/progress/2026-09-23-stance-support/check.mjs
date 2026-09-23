// Actual tilted stance plane and timber point; runs raw production code, no WebGL.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';
import {createServer} from 'vite';
import {launchBrowser} from '../../../../../gauntlet/scripts/lib/browser.mjs';
const root = path.resolve('.'), dir = 'art/characters/link/progress/2026-09-23-stance-support';
const raw = (await fs.readFile('src/world/character/glbLink.ts', 'utf8')).replaceAll('\r\n', '\n');
const before = raw.replace('((leg.stance && leg.tiltAngle > 1e-5) || (leg.swingW > 0.5 && Math.abs(leg.swingRise) > STEP_MIN))', 'leg.swingW > 0.5 && Math.abs(leg.swingRise) > STEP_MIN');
const fixture = JSON.parse(await fs.readFile(dir + '/fixture.json', 'utf8'));
function exported(source) {
  const tree = ts.createSourceFile('glbLink.ts', source, ts.ScriptTarget.Latest, true), found = [];
  const visit = node => { if (ts.isIfStatement(node) && node.expression.getText(tree).includes('leg.swingRise') && node.thenStatement.getText(tree).includes('footprintSupport')) found.push(node); ts.forEachChild(node, visit); };
  visit(tree); assert.equal(found.length, 1);
  return source + `\nexport function stanceTarget(leg:any, surface:any, target:number) { const loco=true, jump=null, base=()=>0, fx=0, fz=1; ${found[0].getText(tree)} return target; }`;
}
process.env.ZR_NATIVE_GPU = '0';
const errors = [], server = await createServer({root, server:{host:'127.0.0.1',port:0}, plugins:[{
  name:'stance-regression', enforce:'pre',
  configureServer(s){s.middlewares.use('/__stance-check',(_,res)=>res.end('<!doctype html><link rel="icon" href="data:,"><title>CPU stance check</title>'));},
  transform(_,id){if(id.replaceAll('\\','/').split('?')[0].endsWith('/src/world/character/glbLink.ts'))return exported(id.includes('before') ? before : raw);},
}]});
let browser;
try {
  await server.listen(); browser=await launchBrowser(); const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message)); await page.goto(server.resolvedUrls.local[0]+'__stance-check');
  const result=await page.evaluate(async f=>{
    const [current,previous,{createGround},{createTerrain},{LAYOUT},{WORLD},{createRng},{buildStairway},{buildLogNosings},{Group,Mesh,Vector3,Quaternion,Raycaster},{createLocomotion},{hardChain}]=await Promise.all([
      import('/src/world/character/glbLink.ts?after'),import('/src/world/character/glbLink.ts?before'),import('/src/world/character/ground.ts'),import('/src/world/terrain/heightfield.ts'),import('/src/world/layout.ts'),import('/src/world/config.ts'),import('/src/world/util/prng.ts'),import('/src/world/hardscape/stairs.ts'),import('/src/world/hardscape/logNosings.ts'),import('/node_modules/three/build/three.module.js'),import('/src/world/character/puppet.ts'),import('/src/world/character/gaitChain.ts')]);
    const terrain=createTerrain(),ground=createGround(terrain,LAYOUT),def=LAYOUT.stairs.find(s=>s.id==='main'),hardscape=new Group();hardscape.name='hardscape';
    for(const [name,geometry] of [['stairs-main',buildStairway(def,terrain,createRng(WORLD.seed).fork('hardscape').fork('stairs-main'),WORLD.seed).geometry],['stairs-main-logs',buildLogNosings(def,WORLD.seed).geometry]]){const m=new Mesh(geometry);m.name=name;hardscape.add(m);}
    hardscape.updateMatrixWorld(true);ground.attachSurface(hardscape);
    const leg={stance:true,tiltAngle:2*Math.acos(f.qTilt[3]),swingW:0,swingRise:0,fp:f.fp,fpLocal:f.fpLocal.map(v=>new Vector3(...v)),qAnkle:new Quaternion(...f.qAnkle),qTilt:new Quaternion(...f.qTilt),soleP:new Vector3(f.marker[0],f.target,f.marker[2]),shift:0,pinX:0,pinZ:0};
    let queries=0;const counted=(x,z)=>{queries++;return ground.surface(x,z);};
    const old=previous.stanceTarget(leg,counted,f.target),oldQueries=queries;queries=0;
    const fixed=current.stanceTarget(leg,counted,f.target),newQueries=queries;
    const ray=new Raycaster(new Vector3(f.point[0],10,f.point[2]),new Vector3(0,-1,0));
    const hit=ray.intersectObjects(hardscape.children,false)[0];if(!hit)throw Error('Fixture misses timber');
    const contact={old,fixed,oldQueries,newQueries,oldPointGap:f.point[1]-hit.point.y,translatedPointGap:f.point[1]+fixed-old-hit.point.y,mesh:hit.object.name};
    let maxFlatDifference=0,frames=0;const zeroDtDifferences=[0,0],calls={before:0,after:0},byGait={};
    for(const gait of ['idle','walk','run','stairs']){
      const speed={idle:0,walk:1.65,run:4.6,stairs:1.1}[gait],contact=new Vector3();
      const matrices=p=>{p.group.updateMatrixWorld(true);const a=[];p.group.traverse(o=>{if(o.isBone)a.push(...o.matrixWorld.elements);});return a;};
      const samples=[];
      for(let j=0;j<2;j++){
        const puppet=await [previous,current][j].loadGlbLink('/models/link/link-runtime.glb'),chain=hardChain(gait),loco=createLocomotion(),flat=()=>0;
        const surface=()=>{calls[j?'after':'before']++;return 0;},rows=[];
        for(let i=0;i<300;i++){
          const t=i/60;loco.speed=speed;loco.dt=1/60;puppet.advance(chain,t,speed/60,1/60);
          const pose={...chain,t,phase:0,look:null,lookWeight:0,idleTurn:0,loco};puppet.pose(0,speed*t,0,pose,flat,contact,surface);const values=matrices(puppet);rows.push(values);
          if(i===299){loco.dt=0;puppet.pose(0,speed*t,0,pose,flat,contact,surface);const zero=matrices(puppet);zeroDtDifferences[j]=Math.max(zeroDtDifferences[j],...zero.map((v,k)=>Math.abs(v-values[k])));}
        }samples.push(rows);
      }
      let gaitDifference=0;
      for(let i=0;i<300;i++)gaitDifference=Math.max(gaitDifference,...samples[0][i].map((v,k)=>Math.abs(v-samples[1][i][k])));
      maxFlatDifference=Math.max(maxFlatDifference,gaitDifference);frames+=300;byGait[gait]=gaitDifference;
    }
    return {contact,flat:{frames,maxFlatDifference,zeroDtDifferences,surfaceCalls:calls,byGait}};
  },fixture);
  assert.deepEqual(errors,[]);assert.equal(result.contact.mesh,'stairs-main-logs');
  assert(result.contact.oldPointGap<-.0008,'Historical stance gate must retain the observed penetration');
  assert(result.contact.translatedPointGap>.003,'Final orientation must lift the point clear');
  assert(Math.abs(result.contact.fixed-fixture.actualPlaneSupport)<1e-10,'Use actual production footprint support');
  assert(result.flat.maxFlatDifference<1e-9,'Flat idle/walk/run/stairs must remain equivalent');
  assert.equal(result.flat.surfaceCalls.before,result.flat.surfaceCalls.after,'Flat poses must not add surface queries');
  assert(result.flat.zeroDtDifferences.every(v=>v<1e-9),'Zero-dt pose must remain stable');
  console.log(JSON.stringify({pass:true,...result}));
}finally{await browser?.close();await server.close();}
