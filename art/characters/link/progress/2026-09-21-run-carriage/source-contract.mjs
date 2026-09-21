// Check the clean source before any native reconstruction. CPU only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha, unpack } from '../2026-09-21-color-bake/patch.mjs';
const out = path.dirname(fileURLToPath(import.meta.url));
const files = [path.join(out, 'source-pre382.glb'), path.join(out, '../2026-09-21-color-bake/stairs-upright-delivery.glb')];
const bytes = await Promise.all(files.map(f => fs.readFile(f))), models = bytes.map(unpack);
assert.equal(sha(bytes[0]), '2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4');
assert.equal(sha(bytes[1]), '305603e92277952f345842e526216ff066b2b5888908eef054990199b6597a69');
function span(model, ai) {
  const a = model.doc.accessors[ai], v = model.doc.bufferViews[a.bufferView], width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type] * 4;
  assert.equal(a.componentType, 5126); assert.ok(!a.sparse); assert.ok(width);
  return Buffer.concat(Array.from({ length: a.count }, (_, i) => {
    const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? width);
    return model.bin.subarray(start, start + width);
  }));
}
const nodeReport = [];
for (const old of models[0].doc.nodes.filter(n => /^(hips|chest|neck|head|shoulder|elbow|hand|thigh|knee|ankle|toe)/.test(n.name ?? ''))) {
  const now = models[1].doc.nodes.find(n => n.name === old.name);
  assert.ok(now, old.name);
  const rest = n => Object.fromEntries(['matrix', 'translation', 'rotation', 'scale'].filter(k => k in n).map(k => [k, n[k]]));
  assert.deepEqual(rest(now), rest(old), old.name + ' rest changed');
  const parent = (model, node) => model.doc.nodes.find(n => n.children?.includes(model.doc.nodes.indexOf(node)))?.name;
  assert.equal(parent(models[0], old), parent(models[1], now), old.name + ' parent changed');
  nodeReport.push(old.name);
}
const clips = models.map(m => m.doc.animations.find(a => a.name === 'run'));
const channels = {};
for (const old of clips[0].channels) {
  const name = models[0].doc.nodes[old.target.node].name, property = old.target.path;
  const now = clips[1].channels.find(c => models[1].doc.nodes[c.target.node].name === name && c.target.path === property);
  assert.ok(now);
  const a = clips[0].samplers[old.sampler], b = clips[1].samplers[now.sampler];
  channels[name + ':' + property] = a.interpolation === b.interpolation && span(models[0], a.input).equals(span(models[1], b.input)) && span(models[0], a.output).equals(span(models[1], b.output));
}
for (const name of ['hips', 'chest', 'head', 'handL', 'handR']) for (const prop of ['translation', 'rotation', 'scale']) {
  if (name === 'hips' && prop === 'translation') continue;
  if (name + ':' + prop in channels) assert.equal(channels[name + ':' + prop], true, name + ':' + prop);
}
const report = { sourceSha256: sha(bytes[0]), currentSha256: sha(bytes[1]), restAndParentsExact: nodeReport,
  rawRunChannelsEqual: channels, handsAllChannelsExact: ['L', 'R'].every(s => ['translation', 'rotation', 'scale'].every(p => channels['hand' + s + ':' + p] !== false)) };
await fs.writeFile(path.join(out, 'source-contract.json'), JSON.stringify(report, null, 2) + '\n');
// Small portable preservation contract: no duplicate 47 MB baseline is required
// to verify the final asset's original binary prefix and protected metadata.
const base = models[1], selected = new Set(['shoulderL','elbowL','shoulderR','elbowR']);
const jsonHash = value => sha(Buffer.from(JSON.stringify(value)));
const preservation = {
  sourceSha256: sha(bytes[1]), sourceFileBytes: bytes[1].length,
  originalBinBytes: base.doc.buffers[0].byteLength,
  originalBinSha256: sha(base.bin.subarray(0,base.doc.buffers[0].byteLength)),
  fixedMetadata: Object.fromEntries(Object.keys(base.doc).filter(k=>!['accessors','bufferViews','buffers','animations'].includes(k)).map(k=>[k,jsonHash(base.doc[k])])),
  accessors: { count: base.doc.accessors.length, sha256: jsonHash(base.doc.accessors) },
  bufferViews: { count: base.doc.bufferViews.length, sha256: jsonHash(base.doc.bufferViews) },
  animations: base.doc.animations.map(a=> a.name!=='run' ? {name:a.name,sha256:jsonHash(a)} : {
    name:a.name, channelCount:a.channels.length,
    channelTargetsSha256:jsonHash(a.channels.map(c=>c.target)),
    unselectedChannelsSha256:jsonHash(a.channels.filter(c=>!(selected.has(base.doc.nodes[c.target.node].name)&&c.target.path==='rotation'))),
    originalSamplers:{count:a.samplers.length,sha256:jsonHash(a.samplers)},
  }),
};
await fs.writeFile(path.join(out,'rebuilt-source-preservation.json'),JSON.stringify(preservation,null,2)+'\n');
console.log(JSON.stringify(report, null, 2));
