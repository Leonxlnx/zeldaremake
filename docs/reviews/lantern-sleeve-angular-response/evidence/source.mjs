/** Reconstruct the frozen 0.20 sleeve trial from published Git and the reviewed tiny patch. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const provenance=JSON.parse(fs.readFileSync(new URL('./provenance.json',import.meta.url)));
for(const [file,hash] of Object.entries(provenance.copiedFiles))
  assert.equal(sha(fs.readFileSync(new URL('./'+file,import.meta.url))),hash,'Frozen original file: '+file);
export const pin=JSON.parse(fs.readFileSync(new URL('./pin.json',import.meta.url)));
assert.equal(pin.sourceCommit,provenance.sourceCommit);
const editBytes=fs.readFileSync(new URL('./edits.json',import.meta.url));
assert.equal(sha(editBytes),provenance.editsSha256,'Frozen two context edits');
const edits=JSON.parse(editBytes),sourceCache=new Map(),candidateCache=new Map();
export function gitSource(file){
  if(!sourceCache.has(file))sourceCache.set(file,execFileSync('git',['show',pin.sourceCommit+':'+file],{encoding:'utf8'}));
  return sourceCache.get(file);
}
export function trackedFiles(){
  return execFileSync('git',['ls-tree','-r','--name-only',pin.sourceCommit],{encoding:'utf8'}).trimEnd().split('\n');
}
export function helperSource(){
  const patch=fs.readFileSync(new URL('./sleeve-angular.patch',import.meta.url),'utf8');
  assert.equal(sha(patch),pin.patchSHA256);
  const parts=patch.split('@@ -0,0 +1,34 @@\n');
  assert.equal(parts.length,2,'Unique frozen 34-line helper hunk');
  const lines=parts[1].split('\n');
  assert.equal(lines.pop(),'');assert.equal(lines.length,34);
  assert(lines.every(line=>line.startsWith('+')),'Helper consists only of added lines');
  const helper=lines.map(line=>line.slice(1)).join('\n')+'\n';
  assert.equal(sha(helper),pin.helperSHA256,'Exact original 0.20 helper');
  return helper;
}
export function candidateSource(file){
  if(candidateCache.has(file))return candidateCache.get(file);
  if(file==='src/world/structures/sleeveBark.ts')return helperSource();
  let text=gitSource(file);
  if(file!=='src/world/structures/materials.ts')return text;
  assert.equal(sha(text),pin.inputs[file].sha256,'Exact published material baseline');
  for(const edit of edits){
    assert.equal(text.split(edit.before).length-1,1,'Unique sleeve import/call context');
    text=text.replace(edit.before,edit.after);
  }
  assert.equal(sha(text),pin.candidateMaterialSHA256,'Exact frozen 0.20 candidate');
  candidateCache.set(file,text);return text;
}
export function verifyReceipt(name,value){
  const bytes=fs.readFileSync(new URL('./'+name,import.meta.url));
  assert.equal(sha(bytes),provenance.copiedFiles[name],'Original receipt bytes');
  assert.deepEqual(value,JSON.parse(bytes),'Reproduced original focused proof');
}
