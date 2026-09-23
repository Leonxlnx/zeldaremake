// Evidence-only, append-only texture bake. Explicit input hash is mandatory.
// node patch.mjs INPUT.glb OUTPUT.glb EXPECTED_INPUT_SHA256 [lossless|canvas]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function unpack(b) {
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(b.readUInt32LE(4), 2, 'GLB version');
  assert.equal(b.readUInt32LE(8), b.length, 'GLB file length');
  const n = b.readUInt32LE(12), offset = 20 + n;
  assert.equal(b.readUInt32LE(16), 0x4e4f534a, 'JSON chunk');
  assert.equal(b.readUInt32LE(offset + 4), 0x004e4942, 'BIN chunk');
  assert.equal(offset + 8 + b.readUInt32LE(offset), b.length, 'exactly two chunks');
  const doc = JSON.parse(b.subarray(20, offset)), bin = b.subarray(offset + 8);
  assert.equal(doc.buffers.length, 1, 'one embedded buffer');
  assert.equal(doc.buffers[0].uri, undefined);
  assert.ok(doc.buffers[0].byteLength <= bin.length && bin.length - doc.buffers[0].byteLength < 4);
  return { doc, bin };
}
export function imageBytes(model, i) {
  const image = model.doc.images[i], view = model.doc.bufferViews[image.bufferView];
  assert.equal(image.mimeType, 'image/png');
  assert.equal(view.buffer, 0);
  return model.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}
export function pack(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc)), jsonPad = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + jsonPad.length + bin.length, 8);
  header.writeUInt32LE(json.length + jsonPad.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, jsonPad, binHeader, bin]);
}
export const contract = doc => Object.fromEntries(
  ['nodes', 'meshes', 'skins', 'materials', 'textures', 'samplers', 'images'].map(k => [k, doc[k]])
);

const here = path.dirname(fileURLToPath(import.meta.url));
export async function patch(input, output, expectedHash, encoding = 'lossless') {
  assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/, 'supply the exact lowercase input SHA256');
  assert.notEqual(path.resolve(input).toLowerCase(), path.resolve(output).toLowerCase(), 'never overwrite input');
  assert.ok(['lossless', 'canvas'].includes(encoding), 'select lossless or original canvas encoding');
  const manifestBytes = await fs.readFile(path.join(here, 'capture.json')), manifest = JSON.parse(manifestBytes);
  const bytes = await fs.readFile(input), source = unpack(bytes);
  assert.equal(sha(bytes), expectedHash, 'input SHA256');
  // Supports motion carriers appended to ea939, but refuses changed geometry, masks, materials or prior bakes.
  assert.equal(sha(source.bin.subarray(0, manifest.source.binLength)), manifest.source.binSha256, 'original ea939 binary prefix');
  assert.deepEqual(contract(source.doc), manifest.source.contract, 'same ungraded image/material/rig/mesh contract');
  let deliveryImages = manifest.images;
  if (encoding === 'lossless') {
    const compressed = JSON.parse(await fs.readFile(path.join(here, 'png-compression.json')));
    assert.equal(compressed.captureSha256, sha(manifestBytes), 'compression belongs to this capture');
    assert.equal(compressed.images.length, manifest.images.length);
    deliveryImages = manifest.images.map(original => {
      const item = compressed.images.find(x => x.imageIndex === original.imageIndex);
      assert.equal(item?.rgbaSha256, original.rgbaSha256, 'same exact captured pixels');
      return { ...original, ...item };
    });
  }
  const doc = structuredClone(source.doc), parts = [source.bin];
  let length = source.bin.length;
  for (const image of deliveryImages) {
    assert.equal(sha(imageBytes(source, image.imageIndex)), image.sourcePngSha256, 'ungraded image hash');
    const png = await fs.readFile(path.join(here, image.file));
    assert.equal(sha(png), image.pngSha256, 'captured PNG hash');
    const view = doc.bufferViews.length;
    doc.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: png.length });
    doc.images[image.imageIndex].bufferView = view;
    const padding = Buffer.alloc((4 - png.length % 4) % 4);
    parts.push(png, padding); length += png.length + padding.length;
  }
  doc.materials[manifest.brow.materialIndex].pbrMetallicRoughness.baseColorFactor = manifest.brow.bakedLinearRGBA;
  doc.buffers[0].byteLength = length;
  const result = pack(doc, Buffer.concat(parts)), check = unpack(result);
  assert.deepEqual(check.bin.subarray(0, source.bin.length), source.bin, 'entire selected input binary preserved');
  // Roll back only the declared JSON edits; every other property must match, including all animation/accessor metadata.
  const restored = structuredClone(check.doc);
  restored.bufferViews.length = source.doc.bufferViews.length;
  restored.buffers = source.doc.buffers;
  for (const i of manifest.images) restored.images[i.imageIndex] = source.doc.images[i.imageIndex];
  restored.materials[manifest.brow.materialIndex] = source.doc.materials[manifest.brow.materialIndex];
  assert.deepEqual(restored, source.doc, 'all undeclared JSON values preserved');
  const unaffected = source.doc.images.map((_, i) => i).filter(i => !manifest.images.some(x => x.imageIndex === i));
  for (const i of unaffected) assert.deepEqual(imageBytes(check, i), imageBytes(source, i), 'untouched image ' + i);
  await fs.writeFile(output, result, { flag: 'wx' });
  const report = { input: path.resolve(input), inputSha256: expectedHash, output: path.resolve(output),
    outputSha256: sha(result), inputBytes: bytes.length, outputBytes: result.length,
    originalBinaryPrefixBytes: source.bin.length, originalBinaryPrefixSha256: sha(source.bin),
    encoding, changedImages: deliveryImages.map(i => ({ index: i.imageIndex, file: i.file, pngSha256: i.pngSha256, rgbaSha256: i.rgbaSha256 })),
    brow: manifest.brow, untouchedImages: unaffected, allOtherJsonExact: true,
    allOriginalBinaryBytesExact: true, animationsRigGeometryMorphsExact: true,
    unusedOriginalImagesRetained: true, runtimeGradeMustBeRemovedBeforeAdoption: true };
  await fs.writeFile(output + '.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok([5, 6].includes(process.argv.length), 'node patch.mjs INPUT.glb OUTPUT.glb EXPECTED_INPUT_SHA256 [lossless|canvas]');
  console.log(JSON.stringify(await patch(...process.argv.slice(2)), null, 2));
}
