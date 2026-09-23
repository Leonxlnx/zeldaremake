// Native-GPU daylight comparisons through the existing capture API and tuning hooks.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome,READY_TIMEOUT_MS} from '../../../gauntlet/scripts/lib/browser.mjs';

const settings=process.argv[2]?JSON.parse(await fs.readFile(process.argv[2],'utf8')):{};
for(const probe of [settings,...(settings.variants??[])])for(const [key,value] of Object.entries(probe.postfx??{})){
 assert(typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)),`Postfx override ${key} must be numeric or boolean; the renderer ignores other types`);
}
const out=path.resolve(ROOT,settings.out);
const dist=path.resolve(ROOT,settings.dist);
assert((await fs.readdir(path.join(dist,'assets'))).includes(settings.bundle),'Pinned build bundle missing');
await fs.mkdir(out,{recursive:true});
const report={sha:settings.sourceSha,settings,images:{},errors:[],evidenceKind:'Native matched views; owner view reconstructed, not the original screenshot camera'};
console.log('Capture output:',out);
report.bundleSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(dist,'assets',settings.bundle))).digest('hex');
report.captureScriptSha256=crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const diff=settings.baseline?'':execFileSync('git',['diff',settings.sourceSha,'--','src'],{cwd:ROOT,encoding:'utf8'});
await fs.writeFile(path.join(out,'source.diff'),diff);
report.sourceDiffSha256=crypto.createHash('sha256').update(diff).digest('hex');
await fs.mkdir(path.join(dist,'__diag'),{recursive:true});
for(const file of ['three.module.js','three.core.js'])await fs.copyFile(path.join(ROOT,'node_modules/three/build',file),path.join(dist,'__diag',file));
const server=await serveStatic(dist);let browser;
try {
 browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:READY_TIMEOUT_MS,args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],defaultViewport:{width:1280,height:720}});
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader|GL_INVALID/i.test(m.text()))report.errors.push(m.text());});
 await page.evaluateOnNewDocument(s=>{window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',({detail})=>{if(!detail.isWebGLRenderer)return;window.__probeRenderer=detail;const draw=detail.render.bind(detail);detail.render=(scene,camera)=>{if(scene.children.some(o=>o.name==='trees')){window.__probeScene=scene;window.__probeCamera=camera;}return draw(scene,camera);};});window.__ATMO_SKY__=s.sky;window.__ATMO_FOG__=s.fog;window.__ATMO_LIGHT__=s.light;window.__ATMO_SETTINGS__=s.postfx;window.__ATMO_SHADOWFILTER__=s.shadowFilter;},settings);
 await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high&'+new URLSearchParams(settings.params??{}),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__ZR__,{timeout:READY_TIMEOUT_MS});await page.evaluate(()=>__ZR__.ready());
 await page.waitForFunction(()=>{const el=document.getElementById('loading');return !el||getComputedStyle(el).opacity==='0';},{timeout:READY_TIMEOUT_MS});
 report.renderer=await page.evaluate(()=>{const gl=window.__probeRenderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 assert(!/swiftshader|llvmpipe|software/i.test(report.renderer),'Native GPU required');
 const views=await page.evaluate(()=>__ZR__.viewpoints().filter(v=>!v.diagnostic).map(v=>v.id));
 for(const id of settings.views??[...views,'sky-opening']) {
  const pose=settings.poses?.[id];
  await page.evaluate(async({id,pose})=>{if(pose)__ZR__.setPose(pose.p,pose.t,pose.fov);else if(id==='sky-opening')__ZR__.setPose([0,1.8,.5],[0,18,-15],72);else if(id==='shadow-contact'){const h=__ZR__.probe(0,.5).height;__ZR__.setPose([1.8,h+1.1,3.4],[0,h+.15,.5],48);}else if(!__ZR__.setViewpoint(id))throw Error('Unknown viewpoint');__ZR__.setTime(12.6);await __ZR__.render(12,0);},{id,pose});
  for(const variant of settings.variants??[{name:'default'}]) {
   assert(/^[\w-]+$/.test(id)&&/^[\w-]+$/.test(variant.name));
   await page.evaluate(async({variant,base})=>{window.__ATMO_HIDE__=variant.hide??[];window.__ATMO_UNIFORMS__=variant.uniforms??{};window.__ATMO_SETTINGS__={...base,...variant.postfx};__ZR__.setTime(12.6);await __ZR__.render(2,0);},{variant,base:settings.postfx??{}});
   const name=variant.name==='default'?id:id+'-'+variant.name;
   const png=await page.screenshot({path:path.join(out,name+'.png')});
   report.images[name]={variant,sha256:crypto.createHash('sha256').update(png).digest('hex'),...await page.evaluate(()=>({stats:__ZR__.stats(),camera:__ZR__.cameraPose(),lighting:__ZR__.audit().systems.lighting,distantClose:__ZR__.audit().systems.trees?.distantClose}))};
   console.log('Captured',name);
   if(settings.probeViews?.includes(id))report.images[name].crownProbe=await probeCrowns(page);
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
 if(settings.transition)report.transition=await (await import('./transition.mjs')).captureTransition(page,out);
 assert.deepEqual(report.errors,[]);report.complete=true;
} finally {await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
console.log(out);

async function probeCrowns(page) {
 return page.evaluate(async()=>{
  const T=await import('/__diag/three.module.js');
  const scene=window.__probeScene,camera=window.__probeCamera,renderer=window.__probeRenderer;
  if(!scene||!camera)throw Error('Scene inspection hook missing');
  const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const trees=scene.getObjectByName('trees');const candidates=[];
  trees.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;candidates.push(o);});
  const viewport=renderer.getSize(new T.Vector2());
  const rays=[];
  for(const [x,y]of [[.25,.25],[.45,.3],[.6,.35]]){
   const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);
   const hits=ray.intersectObjects(candidates,false).slice(0,18).map(h=>{
    const g=h.object.geometry,m=Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;
    const map=m.map,point=h.point.toArray(),out={name:h.object.name,geometry:g.name,material:m.name,distance:h.distance,point,uv:h.uv?.toArray(),instanceId:h.instanceId,map:map?.name};
    if(map&&h.uv){const im=map.image;out.texture={width:im.width,height:im.height,minFilter:map.minFilter,magFilter:map.magFilter,anisotropy:map.anisotropy,mipmaps:map.generateMipmaps};
     if(im.data){const xx=Math.max(0,Math.min(im.width-1,Math.floor(h.uv.x*im.width))),yy=Math.max(0,Math.min(im.height-1,Math.floor(h.uv.y*im.height)));out.baseAlpha=im.data[(yy*im.width+xx)*4+3]/255;}
     if(h.face&&g.attributes.uv&&g.attributes.position.array){
      const ids=[h.face.a,h.face.b,h.face.c],world=h.object.matrixWorld.clone();if(h.instanceId!==undefined){const instance=new T.Matrix4();h.object.getMatrixAt(h.instanceId,instance);world.multiply(instance);}
      const pos=ids.map(i=>new T.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(world).project(camera));const uv=ids.map(i=>new T.Vector2().fromBufferAttribute(g.attributes.uv,i));
      const xy=pos.map(v=>[(v.x+1)*viewport.x/2,(1-v.y)*viewport.y/2]);const dx1=xy[1][0]-xy[0][0],dy1=xy[1][1]-xy[0][1],dx2=xy[2][0]-xy[0][0],dy2=xy[2][1]-xy[0][1],den=dx1*dy2-dx2*dy1;
      if(Math.abs(den)>1e-8){const du1=uv[1].x-uv[0].x,du2=uv[2].x-uv[0].x,dv1=uv[1].y-uv[0].y,dv2=uv[2].y-uv[0].y;const rx=Math.hypot((du1*dy2-du2*dy1)/den*im.width,(dv1*dy2-dv2*dy1)/den*im.height),ry=Math.hypot((du2*dx1-du1*dx2)/den*im.width,(dv2*dx1-dv1*dx2)/den*im.height);out.affineTexelsPerPixel=Math.max(rx,ry);out.affineMipBeforeBias=Math.log2(Math.max(rx,ry));out.projectedTriangle=xy;}
     }
    }
    return out;
   });rays.push({screen:[x,y],hits});
  }
  return {note:'CPU ray intersections ignore alpha discard and wind; alpha and affine mip estimate are provided for interpretation, not asserted GPU-selected LOD.',renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),rays};
 });
}
