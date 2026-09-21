// Freeze the exact review bundle and public-input provenance; no renderer is started.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const label=process.argv[2];
assert.ok(['before','after'].includes(label));
assert.equal(cp.execFileSync('git',['diff','HEAD','--','src','public'],{cwd:root,encoding:'utf8'}),'','Build must use committed source/assets');
const build=path.join(here,'builds',label);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function entries(dir,base=dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?entries(path.join(dir,e.name),base):[{path:path.relative(base,path.join(dir,e.name)).replaceAll('\\','/'),sha256:hash(fs.readFileSync(path.join(dir,e.name)))}]);}
const report={label,sha:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),root:build,files:entries(build),publicHash:hash(JSON.stringify(entries(path.join(root,'public'))))};
const dest=path.join(here,'native-pair',label+'-build.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
assert.ok(!fs.existsSync(dest),'Do not overwrite frozen manifest');
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({label,sha:report.sha,root:build,bundles:report.files.filter(f=>f.path.endsWith('.js')),publicHash:report.publicHash}));
