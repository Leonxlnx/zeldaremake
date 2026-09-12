import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const definition=JSON.parse(fs.readFileSync(new URL('./edits.json',import.meta.url),'utf8'));
export const pin=definition.pin,file=definition.file;
export const sha=value=>createHash('sha256').update(value).digest('hex');
const cache=new Map();
export function source(name){
  if(!cache.has(name))cache.set(name,execFileSync('git',['show',pin+':'+name],{encoding:'utf8'}));
  return cache.get(name);
}
const before=source(file);
assert.equal(sha(before),definition.beforeSha256,'Exact published baseline');
let after=before;
for(const edit of definition.edits){
  assert.equal(after.split(edit.before).length,2,'Unique pinned edit context');
  after=after.replace(edit.before,edit.after);
}
assert.equal(sha(after),definition.candidateSha256,'Exact frozen candidate');
export const candidateSource=after;
