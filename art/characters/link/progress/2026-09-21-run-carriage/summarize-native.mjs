// Reduce the local full Blender diagnosis to a portable provenance report.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=await fs.readFile(path.join(out,'native-action-diagnosis.json'));
const full=JSON.parse(raw), summary={kind:full.kind,fullLocalReportSha256:hash(raw),files:[]};
for(const file of full.files) {
  const f={label:file.label,file:file.file,sha256:hash(await fs.readFile(file.file)),actions:[]};
  for(const a of file.actions) {
    const record={};
    for(const [stage,action] of Object.entries(a)) record[stage]={name:action.name,frame_range:action.frame_range,
      bones:Object.fromEntries(Object.entries(action.bones).map(([name,b])=>[name,{
        keys:b.key_counts,off_integer_keys:b.off_integer_key_count,interpolation:b.interpolation,
        adjacent_240hz_max_degrees:b.adjacent_240hz_max_degrees,
        samplesSha256:hash(Buffer.from(JSON.stringify(b.samples_wxyz))),
      }]))};
    if(a.retime_before_update) record.retimeUpdateSamplesExact=Object.keys(a.original.bones).every(n=>
      JSON.stringify(a.retime_before_update.bones[n].samples_wxyz)===JSON.stringify(a.retime_after_update.bones[n].samples_wxyz));
    f.actions.push(record);
  }
  summary.files.push(f);
}
await fs.writeFile(path.join(out,'native-action-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({output:'native-action-summary.json',fullLocalReportSha256:summary.fullLocalReportSha256,files:summary.files.map(f=>({label:f.label,sha256:f.sha256}))}));
