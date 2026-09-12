/** Compose the reviewed Low delta over the frozen parent's High/Medium candidate. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pin, candidateSource as familySource} from '../source.mjs';
export {pin};
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const provenance=JSON.parse(fs.readFileSync(new URL('./provenance.json',import.meta.url)));
assert.equal(pin,provenance.source,'Same published source pin');
for(const [name,hash] of Object.entries(provenance.parentFiles))
  assert.equal(sha(fs.readFileSync(new URL('../'+name,import.meta.url))),hash,'Frozen parent package: '+name);
const editBytes=fs.readFileSync(new URL('./edits.json',import.meta.url));
assert.equal(sha(editBytes),provenance.editsSha256,'Frozen Low context edits');
const edits=JSON.parse(editBytes),cache=new Map();
for(const [file,hash] of Object.entries(provenance.unchangedPrerequisites))
  assert.equal(sha(familySource(file)),hash,'Unchanged family prerequisite: '+file);
/** The Low comparison baseline is the complete frozen High/Medium candidate, not raw 9ef. */
export const source=familySource;
export function candidateSource(file){
  if(cache.has(file))return cache.get(file);
  const meta=provenance.files.find(f=>f.file===file);
  let text=familySource(file);
  if(!meta)return text;
  assert.equal(sha(text),meta.baseline,'Exact frozen family baseline: '+file);
  for(const edit of edits.find(e=>e.file===file).edits){
    assert.equal(text.split(edit.before).length-1,1,'Unique Low edit context: '+file);
    text=text.replace(edit.before,edit.after);
  }
  assert.equal(sha(text),meta.candidate,'Exact reviewed composed candidate: '+file);
  cache.set(file,text);return text;
}
/** Reproduce frozen receipts in memory; never overwrite review evidence or the checkout. */
export function verifyReceipt(name,value){
  const bytes=fs.readFileSync(new URL('./'+name,import.meta.url));
  assert.equal(sha(bytes),provenance.receipts[name].sha256,'Frozen Low receipt: '+name);
  assert.deepEqual(value,JSON.parse(bytes),'Reproduced original Low receipt: '+name);
}
