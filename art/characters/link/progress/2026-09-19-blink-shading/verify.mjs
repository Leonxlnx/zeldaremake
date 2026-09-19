import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const read=async f=>JSON.parse(await fs.readFile(new URL(f,import.meta.url),'utf8'));
const a=await read('baseline-manifest.json'),b=await read('candidate-manifest.json');
assert(a.complete&&b.complete);assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
assert.deepEqual(a.motion_clearance,b.motion_clearance);
assert.deepEqual(a.views,b.views,'All 18 non-blink views must remain pixel-exact');
assert.deepEqual(a.render,b.render);
assert.equal(a.blink_views['blink-0'].sha256,b.blink_views['blink-0'].sha256);
for(const [prefix,report] of [['baseline',a],['candidate',b]])for(const phase of [0,.5,1]){
  const bytes=await fs.readFile(new URL(`${prefix}-blink-${phase}.png`,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),report.blink_views[`blink-${phase}`].sha256);
}
console.log('Preserved 18 exact views, open eyes, 363 sole samples and render cost; paired image hashes verified. This does not imply visual acceptance.');
