// Freeze an exact committed build and hash every served asset for the paired review.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..'),[label,ref]=process.argv.slice(2);
const source=execFileSync('git',['rev-parse',ref],{cwd:root,encoding:'utf8'}).trim();
assert(/^(before|after)$/.test(label));
if(label==='after')execFileSync('git',['diff','--exit-code',source,'--','src','public'],{cwd:root});
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const frozen=path.join(import.meta.dirname,'frozen',label);
const dist=label==='before'?'E:/zeldaremake-astra-motion-sept21/dist':path.join(root,'dist');
if(label==='before')assert.equal(digest(await fs.readFile(path.join(dist,'assets/index-Hs0AcnGr.js'))),'e9abdc2c1c7c84b495d81a7bc834b9b87ce365c92baf9c73a94f40c03257acbb','Parent6231 native baseline bundle');
await fs.cp(dist,frozen,{recursive:true,errorOnExist:true,force:false});
const files={};
async function scan(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await scan(p);else{const bytes=await fs.readFile(p);files[path.relative(frozen,p).replaceAll('\\','/')]={bytes:bytes.length,sha256:digest(bytes)};}}}
await scan(frozen);
const file=new URL('./builds.json',import.meta.url),settings=await fs.readFile(new URL('./settings.json',import.meta.url));
let builds={settingsSha256:digest(settings),snapshots:[]};
try{builds=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
assert.equal(builds.settingsSha256,digest(settings));assert(!builds.snapshots.some(s=>s.label===label),'Snapshot already exists');
builds.snapshots.push({label,source,root:frozen,files});
await fs.writeFile(file,JSON.stringify(builds,null,2)+'\n');
console.log(label,source,Object.keys(files).length,'hashed files',Object.keys(files).find(f=>f.endsWith('.js')));
