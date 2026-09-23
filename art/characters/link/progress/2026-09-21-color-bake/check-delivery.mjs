// Safety regression: explicit source hashes, no repeat grade, no source/output overwrite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deliver } from './deliver.mjs';
import { sha, unpack, pack } from './patch.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, '../2026-09-21-motion-integration/stairs-upright-candidate.glb');
const baked = path.join(here, 'stairs-upright-delivery.glb');
const inputHash = 'e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552';
const bakedHash = '305603e92277952f345842e526216ff066b2b5888908eef054990199b6597a69';
const invalidOutput = path.join(here, 'delivery-must-not-be-created.glb');
await assert.rejects(fs.access(invalidOutput), { code: 'ENOENT' });
await assert.rejects(() => deliver(source, invalidOutput, '0'.repeat(64)), /input SHA256/);
await assert.rejects(() => deliver(baked, invalidOutput, bakedHash), /original ungraded ea939 prefix/);
await assert.rejects(() => deliver(source, source, inputHash), /never overwrite input/);
await assert.rejects(() => deliver(source, baked, inputHash), { code: 'EEXIST' });
assert.equal(sha(await fs.readFile(source)), inputHash); assert.equal(sha(await fs.readFile(baked)), bakedHash);
await assert.rejects(fs.access(invalidOutput), { code: 'ENOENT' });
const archives = [
  ['ea939-color-baked.glb', '9ade5a3b7ab3ff63fccb228423929f7994c8dc861fc9d53ea0e49be105ee3b0b'],
  ['ea939-color-baked-lossless.glb', '3cb51f3653c0519f33fe32653d7351c5ff3d7c38944cb7f00001fcb673f704c7'],
];
for (const [file, expected] of archives) {
  const bytes = await fs.readFile(path.join(here, file)), { doc, bin } = unpack(bytes);
  assert.equal(sha(bytes), expected, 'append-only archive preserved');
  assert.equal(sha(pack(doc, bin)), expected, 'extracted shared serializer reproduces archived bytes');
}
const report = { rejectsWrongHash: true, rejectsAlreadyBakedInput: true, rejectsInputOverwrite: true,
  rejectsExistingOutputWithoutChangingIt: true, rejectedInvocationsCreatedNoOutput: true,
  sourceAndDeliveryHashesStillExact: true, appendOnlyArchivesPreserved: true, sharedSerializerByteExact: true };
await fs.writeFile(path.join(here, 'delivery-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
