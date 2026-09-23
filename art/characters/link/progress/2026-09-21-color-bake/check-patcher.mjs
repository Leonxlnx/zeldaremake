// Runnable composition and double-bake checks; rejected cases must not create an output.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../../../../../gauntlet/scripts/lib/browser.mjs';
import { sha, unpack, contract, imageBytes, patch } from './patch.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(here, 'capture.json')));
const models = [
  ['stairs-upright-candidate.glb', 'e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552'],
  ['run-torso-candidate.glb', 'ad0518e6bdbffbc93620c57595b09143a4458bf311e22ec13c55a78ec29e53c9'],
];
const compatible = [];
for (const [name, expectedHash] of models) {
  const bytes = await fs.readFile(path.join(here, '../2026-09-21-motion-integration', name)), model = unpack(bytes);
  assert.equal(sha(bytes), expectedHash);
  assert.equal(sha(model.bin.subarray(0, manifest.source.binLength)), manifest.source.binSha256);
  assert.deepEqual(contract(model.doc), manifest.source.contract);
  for (const image of manifest.images) assert.equal(sha(imageBytes(model, image.imageIndex)), image.sourcePngSha256);
  compatible.push({ file: name, sha256: expectedHash, sameSourcePixelsAndRigUvMaskInputs: true });
}
const invalidOutput = path.join(here, 'must-not-be-created.glb');
await assert.rejects(fs.access(invalidOutput), { code: 'ENOENT' });
await assert.rejects(() => patch(path.join(ROOT, 'public/models/link/link-runtime.glb'), invalidOutput, '0'.repeat(64)), /input SHA256/);
await assert.rejects(() => patch(path.join(here, 'ea939-color-baked.glb'), invalidOutput,
  '9ade5a3b7ab3ff63fccb228423929f7994c8dc861fc9d53ea0e49be105ee3b0b'), /same ungraded image\/material\/rig\/mesh contract/);
await assert.rejects(() => patch(invalidOutput, invalidOutput, '0'.repeat(64)), /never overwrite input/);
await assert.rejects(fs.access(invalidOutput), { code: 'ENOENT' });
const report = { compatible, rejectsWrongHash: true, rejectsAlreadyBakedInput: true, rejectsInputOverwrite: true,
  rejectedInvocationsCreatedNoOutput: true };
await fs.writeFile(path.join(here, 'patcher-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
