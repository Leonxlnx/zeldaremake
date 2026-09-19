// Native-GPU daylight comparisons through the existing capture API and tuning hooks.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from './lib/browser.mjs';

const settings=process.argv[2]?JSON.parse(await fs.readFile(process.argv[2],'utf8')):{};
const out=path.join(ROOT,'art/environment',new Date().toISOString().replace(/[:.]/g,'-')+'-daylight');
await fs.mkdir(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),settings,images:{},errors:[]};
report.captureScriptSha256=crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const diff=execFileSync('git',['diff','HEAD','--','src'],{cwd:ROOT,encoding:'utf8'});
await fs.writeFile(path.join(out,'source.diff'),diff);
report.sourceDiffSha256=crypto.createHash('sha256').update(diff).digest('hex');
const server=await serveStatic(path.join(ROOT,'dist'));let browser;
try {
 browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:180000,args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],defaultViewport:{width:1280,height:720}});
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.evaluateOnNewDocument(s=>{window.__ATMO_SKY__=s.sky;window.__ATMO_FOG__=s.fog;window.__ATMO_LIGHT__=s.light;window.__ATMO_SETTINGS__=s.postfx;window.__ATMO_SHADOWFILTER__=s.shadowFilter;},settings);
 await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high&'+new URLSearchParams(settings.params??{}),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__ZR__,{timeout:180000});await page.evaluate(()=>__ZR__.ready());
 await page.waitForFunction(()=>{const el=document.getElementById('loading');return !el||getComputedStyle(el).opacity==='0';},{timeout:180000});
 const views=await page.evaluate(()=>__ZR__.viewpoints().filter(v=>!v.diagnostic).map(v=>v.id));
 for(const id of settings.views??[...views,'sky-opening']) {
  const pose=settings.poses?.[id];
  await page.evaluate(async({id,pose})=>{if(pose)__ZR__.setPose(pose.p,pose.t,pose.fov);else if(id==='sky-opening')__ZR__.setPose([0,1.8,.5],[0,18,-15],72);else if(id==='shadow-contact'){const h=__ZR__.probe(0,.5).height;__ZR__.setPose([1.8,h+1.1,3.4],[0,h+.15,.5],48);}else if(!__ZR__.setViewpoint(id))throw Error('Unknown viewpoint');__ZR__.setTime(12.6);await __ZR__.render(12,0);},{id,pose});
  for(const variant of settings.variants??[{name:'default'}]) {
   assert(/^[\w-]+$/.test(id)&&/^[\w-]+$/.test(variant.name));
   await page.evaluate(async({variant,base})=>{window.__ATMO_HIDE__=variant.hide??[];window.__ATMO_UNIFORMS__=variant.uniforms??{};window.__ATMO_SETTINGS__={...base,...variant.postfx};__ZR__.setTime(12.6);await __ZR__.render(2,0);},{variant,base:settings.postfx??{}});
   const name=variant.name==='default'?id:id+'-'+variant.name;
   const png=await page.screenshot({path:path.join(out,name+'.png')});
   report.images[name]={variant,sha256:crypto.createHash('sha256').update(png).digest('hex'),...await page.evaluate(()=>({stats:__ZR__.stats(),camera:__ZR__.cameraPose(),lighting:__ZR__.audit().systems.lighting}))};
   console.log('Captured',name);
  }
 }
 await page.evaluate(base=>{window.__ATMO_HIDE__=[];window.__ATMO_UNIFORMS__={};window.__ATMO_SETTINGS__=base;},settings.postfx??{});
 if(settings.walkFrames) {
  assert(Number.isInteger(settings.walkFrames)&&settings.walkFrames>=2&&settings.walkFrames<=180);
  assert(['plaza','stairs'].includes(settings.walkPath??'plaza'));
  const stair=settings.walkPath==='stairs'?await page.evaluate(()=>__ZR__.audit().layout.stairs.find(s=>s.id==='main')):null;
  if(settings.walkPath==='stairs')assert(stair,'Main stair layout missing');
  report.walk=[];
  for(let i=0;i<settings.walkFrames;i++) {
   const t=i/(settings.walkFrames-1),x=0.4+1.2*t;
   const camera=await page.evaluate(async({x,t,stair})=>{
    if(stair){const u=-.05+1.1*t,dx=stair.top[0]-stair.base[0],dz=stair.top[2]-stair.base[2];const p=[stair.base[0]+dx*u,stair.base[1]+(stair.top[1]-stair.base[1])*Math.max(0,Math.min(1,u))+1.8,stair.base[2]+dz*u];__ZR__.setPose(p,[p[0]+dx*.2,p[1]+1.2,p[2]+dz*.2],72);}
    else __ZR__.setPose([x,1.8,8.6],[x+6.3,.89,-5.8],46);
    __ZR__.setTime(12.6);await __ZR__.render(1,0);return __ZR__.cameraPose();
   },{x,t,stair});
   const file=`walk-${String(i).padStart(3,'0')}.png`;
   const png=await page.screenshot({path:path.join(out,file)});
   report.walk.push({file,camera,sha256:crypto.createHash('sha256').update(png).digest('hex')});
  }
  console.log('Captured camera translation',report.walk.length,'frames at fixed simulation time');
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
} finally {await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
console.log(out);
