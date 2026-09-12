/** Reconstruct only the reviewed changes from published Git objects and unique contexts. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const provenance=JSON.parse(fs.readFileSync(new URL('./provenance.json',import.meta.url)));
export const pin=provenance.source;
const edits=JSON.parse(fs.readFileSync(new URL('./edits.json',import.meta.url)));
const sourceCache=new Map(),candidateCache=new Map();
export const sha=x=>createHash('sha256').update(x).digest('hex');
export function source(file){
  if(!sourceCache.has(file))sourceCache.set(file,execFileSync('git',['show',pin+':'+file],{encoding:'utf8'}));
  return sourceCache.get(file);
}
export function candidateSource(file){
  if(candidateCache.has(file))return candidateCache.get(file);
  const meta=provenance.files.find(f=>f.file===file);
  if(!meta)return source(file);
  let text=source(file);
  assert.equal(sha(text),meta.baseline,'Exact published baseline: '+file);
  for(const edit of edits.find(e=>e.file===file).edits){
    assert.equal(text.split(edit.before).length-1,1,'Unique reviewed edit context: '+file);
    text=text.replace(edit.before,edit.after);
  }
  assert.equal(sha(text),meta.candidate,'Exact frozen candidate: '+file);
  candidateCache.set(file,text);return text;
}
/** Preserve receipt values without writing the checkout or replacing the frozen evidence. */
export function verifyReceipt(name,value){
  const raw=fs.readFileSync(new URL('./'+name,import.meta.url));
  assert.equal(sha(raw),provenance.receipts[name].portableSha256,'Frozen receipt: '+name);
  assert.deepEqual(value,JSON.parse(raw),'Reproduced original receipt: '+name);
}
