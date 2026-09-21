// Source provenance check: undo the recovered hooks, then compare to canonical byte for byte.
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const base='0963c09da4139a0542a338d3345796dce6b20b8a',candidate='0858f39f75ee14130be7ff84692cdd33422c83ab',original='0645b7d3c94eaff60eec626e40038e43c0d1d4ed';
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'});
const read=(sha,p)=>git('show',`${sha}:src/world/trees/${p}`);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const changed=git('diff','--name-only',base,candidate).trim().split('\n');
assert.deepEqual(changed,['distant.ts','leaf-color.test.mjs','leaf-color.ts','materials.ts'].map(p=>'src/world/trees/'+p));
const exactFiles=['leaf-color.ts','leaf-color.test.mjs'].map(file=>{
  assert.equal(read(candidate,file),read(original,file),`${file}: exact reviewed source`);
  return{file,sha256:hash(read(candidate,file))};
});
let materials=read(candidate,'materials.ts');
materials=materials.replace("import { injectTreeLeafWarmth } from './leaf-color';\n",'')
  .replace("  // Near-base leaves are ground ferns and litter, outside the crown colour adjustment.\n  if (nearDetail !== 'base') injectTreeLeafWarmth(shader, 'vIsLeaf > 0.5');\n",'')
  .replace('      injectTreeLeafWarmth(s);\n','');
for(const key of ['white','giant','giant-near','column','giant-near-canopy','giant-canopy'])materials=materials.replace(`'${key}-leaf-warmth'`,`'${key}'`);
assert.equal(materials,read(base,'materials.ts'),'all existing material source preserved');
const distant=read(candidate,'distant.ts').replace("import { injectTreeLeafWarmth } from './leaf-color';\n",'')
  .replace('    injectTreeLeafWarmth(s);\n','').replace("'trees-distant-crown-v2-leaf-warmth'","'trees-distant-crown-v2'");
assert.equal(distant,read(base,'distant.ts'),'all existing distant geometry/material source preserved');
const report={base,candidate,original,changed,exactFiles,checks:[
  'Exactly four source/test files changed; all other geometry/assets identical',
  'New helper and existing three-contract test identical to reviewed 0645b7d3',
  'Removing only recovered hooks and key suffixes restores canonical materials.ts exactly',
  'Removing only recovered hook and key suffix restores canonical distant.ts exactly',
]};
fs.writeFileSync(path.join(here,'source-proof.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
