// Fixed native review, using the existing daylight capture API and frozen assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from '../../../gauntlet/scripts/lib/browser.mjs';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const settingsBytes=await fs.readFile(new URL('./settings.json',import.meta.url));
const settings=JSON.parse(settingsBytes),builds=JSON.parse(await fs.readFile(new URL('./builds.json',import.meta.url),'utf8'));
const snapshot=builds.snapshots.find(s=>s.label===process.argv[2]);assert(snapshot,'Choose before or after');
assert.equal(digest(settingsBytes),builds.settingsSha256);assert.equal(settings.views.length,3);
assert.equal(process.env.ZR_NATIVE_GPU,'1');assert.equal(process.env.CAPSLOT_STALE_MIN,'Infinity');
const timeout=Number(process.env.CAPTURE_READY_TIMEOUT_MS);assert.equal(timeout,900000);
for(const [file,expected]of Object.entries(snapshot.files)){const bytes=await fs.readFile(path.join(snapshot.root,file));assert.equal(bytes.length,expected.bytes);assert.equal(digest(bytes),expected.sha256,file);}
const out=path.join(import.meta.dirname,snapshot.label);await fs.mkdir(out); // refuse to overwrite evidence
const report={sha:snapshot.source,snapshot,settingsSha256:builds.settingsSha256,settings,captureScriptSha256:digest(await fs.readFile(new URL(import.meta.url))),images:{},errors:[],note:'Native high1280x720, time12.6, 12+2 zero-dt frames. Upper pose is an authored physical-envelope diagnostic, not an owner screenshot match. Before A/F reuse the exact6231 parent originals. Upper first visit and warm round-trip test repeatability; strict complete-pool-eviction equality is checked separately by the CPU production-closure replay.'};
const save=()=>fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log('Capture output',out);await save();
const server=await serveStatic(snapshot.root);let browser;
try{
 browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:timeout,args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],defaultViewport:{width:1280,height:720,deviceScaleFactor:1}});
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high',{waitUntil:'domcontentloaded',timeout});
 await page.waitForFunction(()=>window.__ZR__,{timeout});await page.evaluate(()=>__ZR__.ready());
 await page.waitForFunction(()=>{const e=document.getElementById('loading');return !e||getComputedStyle(e).opacity==='0';},{timeout});
 report.runtime=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),devicePixelRatio,scripts:[...document.scripts].map(s=>s.src),perf:__ZR__.perf()};});
 assert(!/swiftshader|software|llvmpipe/i.test(report.runtime.renderer));
 const bundle=Object.keys(snapshot.files).find(s=>s.startsWith('assets/')&&s.endsWith('.js'));
 assert(report.runtime.scripts.some(s=>s.endsWith('/'+bundle)),'Frozen bundle not loaded');
 console.log(report.runtime.renderer,bundle);
 for(const id of snapshot.label==='before'?settings.baselineViews:settings.views){
  const pose=settings.poses[id];
  const beforePose=await page.evaluate(()=>__ZR__.perf());
  await page.evaluate(async({id,pose})=>{if(pose)__ZR__.setPose(pose.p,pose.t,pose.fov);else if(!__ZR__.setViewpoint(id))throw Error('Unknown viewpoint');__ZR__.setTime(12.6);await __ZR__.render(12,0);window.__ATMO_HIDE__=[];window.__ATMO_UNIFORMS__={};window.__ATMO_SETTINGS__={};__ZR__.setTime(12.6);await __ZR__.render(2,0);},{id,pose});
  const bytes=await page.screenshot({path:path.join(out,id+'.png')});
  const info=await page.evaluate(()=>{const a=__ZR__.audit();return {stats:__ZR__.stats(),camera:__ZR__.cameraPose(),lighting:a.systems.lighting,atmosphere:a.systems.atmosphere,trees:a.systems.trees,perf:__ZR__.perf()};});
  assert.equal(info.stats.width,1280);assert.equal(info.stats.height,720);assert.equal(info.stats.pixelRatio,1);
  assert.equal(info.atmosphere.postfx.softening,false);assert.equal(info.atmosphere.antialiasing,'fxaa');
  report.images[id]={sha256:digest(bytes),beforePose,...info};
  const depth=await page.evaluate(()=>{const d=__ZR__.depthImage(null,320,180);return {width:d.width,height:d.height,data:Array.from(d.data)};});
  const depthBytes=Buffer.from(new Float32Array(depth.data.map(d=>d??Infinity)).buffer),depthFile=id+'-depth.f32';await fs.writeFile(path.join(out,depthFile),depthBytes);
  report.images[id].depth={file:depthFile,width:depth.width,height:depth.height,sha256:digest(depthBytes),format:'little-endian float32 Euclidean metres; Infinity sky; top-left row-major'};
  if(id==='A_stairs'){
   const ms=await page.evaluate(async()=>{const gl=document.querySelector('canvas').getContext('webgl2'),p=new Uint8Array(4),ms=[];for(let i=0;i<36;i++){__ZR__.setTime(12.6);const t=performance.now();await __ZR__.render(1,0);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);if(i>=4)ms.push(performance.now()-t);}return ms;});
   const sorted=[...ms].sort((a,b)=>a-b);report.images[id].staticFrameMs={samples:ms,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)]};
  }
  await save();console.log('Captured',id,info.stats.triangles,info.stats.drawCalls);
 }
 if(snapshot.label==='after'){
  const id='upper-envelope-southwest',pose=settings.poses[id];
  await page.evaluate(async pose=>{__ZR__.setPose(pose.p,pose.t,pose.fov);__ZR__.setTime(12.6);await __ZR__.render(12,0);window.__ATMO_HIDE__=[];window.__ATMO_UNIFORMS__={};window.__ATMO_SETTINGS__={};__ZR__.setTime(12.6);await __ZR__.render(2,0);},pose);
  const bytes=await page.screenshot({path:path.join(out,id+'-warm.png')});
  report.repeat={file:id+'-warm.png',sha256:digest(bytes),identical:digest(bytes)===report.images[id].sha256,...await page.evaluate(()=>({camera:__ZR__.cameraPose(),stats:__ZR__.stats(),trees:__ZR__.audit().systems.trees,perf:__ZR__.perf()}))};
  await save();console.log('Upper first-visit/warm PNG identical:',report.repeat.identical);
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await save();await browser?.close();await server.close();}
console.log(out);
