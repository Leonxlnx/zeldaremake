import fs from 'node:fs';import assert from 'node:assert/strict';import * as T from 'three';import {loader,charts,chartGeometry,meshes,key,dir}from'./loader.mjs';import{triangles,tree,nearest}from'./triangle-distance.mjs';
const actor=loader(true).load('src/world/character/link.ts').createLink(),hair=actor.rig.head.getObjectByName('hair'),g=hair.geometry,c=charts(g),fringeCharts=[6,7,8,9,10,11,12,13,22,23,24,25];actor.group.updateMatrixWorld(true);const inverse=actor.rig.head.matrixWorld.clone().invert();
const changedGeo=g.clone();changedGeo.setIndex(fringeCharts.flatMap(ci=>c[ci].faces.flatMap(f=>[0,1,2].map(j=>g.index.getX(f*3+j)))));const hairTree=tree(triangles(changedGeo));
const report={failure:null,static:[],blink:[],roots:[],overlaps:[],limitations:['Nine discrete blink states only; no swept/all-pose proof.','Floating point triangle separation with all nonzero-area faces retained.','Intentional connected hair-layer intersections are separate from protected skin/eye clearance.']};
function localTree(mesh){return tree(triangles(mesh.geometry,inverse.clone().multiply(mesh.matrixWorld)));}
try{
 const skull=actor.rig.head.getObjectByName('skull');let n=nearest(hairTree,localTree(skull));report.static.push({target:'skull',...n});assert(n.distance>0,`fringe/skull contact ${JSON.stringify(n)}`);
 for(const scale of [1,.85,.7,.5838095,.5,.35,.2,.12,.08]){for(const eye of actor.rig.eyes)eye.scale.y=scale;actor.syncGeometry();actor.group.updateMatrixWorld(true);const r={scale,targets:[]};for(const mesh of meshes(actor).filter(o=>['eyelid','eye-white','brow','lashes'].includes(o.name))){const n=nearest(hairTree,localTree(mesh));r.targets.push({target:key(mesh),...n});assert(n.distance>0,`fringe/${key(mesh)} contact at ${scale}: ${JSON.stringify(n)}`);}report.blink.push(r);}
}catch(e){report.failure=e.message;}
fs.writeFileSync(dir+'/contact-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));assert.equal(report.failure,null);
