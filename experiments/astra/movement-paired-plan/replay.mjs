import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as THREE from 'three';
import ts from 'typescript';

const here=path.dirname(fileURLToPath(import.meta.url));
const hashBytes=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=value=>hashBytes(JSON.stringify(value));
const read=file=>JSON.parse(fs.readFileSync(path.join(here,file),'utf8'));
const keep=process.argv.includes('--keep-output'),mesh=process.argv.includes('--mesh-floor');
assert.equal(THREE.REVISION,'186');assert.equal(ts.version,'5.9.3');
const manifest=read('manifest.json');
for(const file of manifest.files){const bytes=fs.readFileSync(path.join(here,file.path));assert.equal(bytes.length,file.bytes,file.path);assert.equal(hashBytes(bytes),file.sha256,file.path);}
const output=fs.mkdtempSync(path.join(here,'generated-'));
const started=performance.now();
function run(script){const result=spawnSync(process.execPath,[path.join(here,script)],{cwd:here,env:{...process.env,P3_OUTPUT_DIR:output},encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(result.status,0,result.stderr||result.stdout||result.error?.message);}
try {
  run('p3.mjs');
  const result=JSON.parse(fs.readFileSync(path.join(output,'p3-result.json'),'utf8'));
  const expected=read('evidence/original-p3-summary.json'),matched={};
  const bridges=result.bridges.map(b=>({...b,projection:Object.fromEntries(Object.entries(b.projection).filter(([key])=>key!=='work'))}));
  for(const [key,digest] of Object.entries(expected.semanticHashes)){
    const actual=hash(key==='bridges'?bridges:result[key]);assert.equal(actual,digest,key);matched[key]=actual;
  }
  const verification={status:'exact-p3-reproduction',originalResultSha256:expected.originalResultSha256,
    checkedManifestFiles:manifest.files.length,matchedSemanticHashes:matched,
    pieces:result.pieces.length,samples:result.samples.length,work:result.work,
    projectionWork:result.bridges.map(b=>b.projection.work),
    scope:'One portable numerical replay; original parameters, events, coefficients and all stored samples match. Timing, corrected counter labels, and fixture provenance metadata are excluded from semantic comparison.'};
  if(mesh){
    run('mesh-floor.mjs');
    const floor=JSON.parse(fs.readFileSync(path.join(output,'mesh-floor-result.json'),'utf8')),reference=read('evidence/mesh-floor.json');
    for(const key of ['status','samples','expectedSamples','vertexSamples','minimum','minimumByPart','firstNegative','failure','parts','sourceHashes'])assert.deepEqual(floor[key],reference[key],key);
    verification.meshFloor={status:floor.status,samples:floor.samples,vertexSamples:floor.vertexSamples,scope:floor.scope};
  }
  verification.wallElapsedMs=performance.now()-started;
  if(keep)verification.outputDirectory=output;
  console.log(JSON.stringify(verification,null,2));
} finally {if(!keep)fs.rmSync(output,{recursive:true,force:true});}
