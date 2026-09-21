// Delivery bake in the two existing PNG allocations; no append, repack or view renumbering.
// node deliver.mjs UNGRADED_INPUT.glb NEW_OUTPUT.glb EXACT_INPUT_SHA256
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha, unpack, pack, contract, imageBytes } from './patch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
function references(doc) {
  const refs = [], extensions = new Set();
  function walk(value, parts = []) {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, [...parts, i]));
    if (!value || typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value)) {
      const p = [...parts, key];
      if (key === 'bufferView') {
        const location = p.join('.');
        assert.match(location, /^(images\.\d+|accessors\.\d+(\.sparse\.(indices|values))?)\.bufferView$/, 'known core bufferView reference');
        refs.push({ location, view: v });
      }
      if (key === 'extensions') for (const name of Object.keys(v)) extensions.add(name);
      walk(v, p);
    }
  }
  walk(doc);
  for (const name of [...(doc.extensionsUsed ?? []), ...extensions])
    assert.equal(name, 'KHR_materials_clearcoat', 'reject uninspected extensions that could reference binary data');
  return refs;
}
function accessorSpans(model) {
  // The inspected model uses no interleaving or padded small-component matrices.
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }, spans = [];
  function span(accessor, kind, viewIndex, offset, length) {
    const view = model.doc.bufferViews[viewIndex];
    assert.equal(view.buffer, 0); assert.equal(view.byteStride, undefined, 'no interleaved views');
    assert.ok(offset >= 0 && offset + length <= view.byteLength, 'accessor span within its view');
    const start = (view.byteOffset ?? 0) + offset;
    spans.push({ accessor, kind, viewIndex, start, bytes: length, sha256: sha(model.bin.subarray(start, start + length)) });
  }
  for (const [i, a] of model.doc.accessors.entries()) {
    const elementBytes = components[a.type] * sizes[a.componentType];
    assert.ok(Number.isInteger(elementBytes) && elementBytes > 0, 'inspected accessor format');
    if (a.bufferView !== undefined) span(i, 'base', a.bufferView, a.byteOffset ?? 0, a.count * elementBytes);
    if (a.sparse) {
      const s = a.sparse, size = sizes[s.indices.componentType];
      assert.ok(size > 0, 'sparse index type');
      span(i, 'sparse-indices', s.indices.bufferView, s.indices.byteOffset ?? 0, s.count * size);
      span(i, 'sparse-values', s.values.bufferView, s.values.byteOffset ?? 0, s.count * elementBytes);
    }
  }
  return spans;
}
export async function deliver(input, output, expectedHash) {
  assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/, 'exact lowercase input SHA256 is mandatory');
  assert.notEqual(path.resolve(input).toLowerCase(), path.resolve(output).toLowerCase(), 'never overwrite input');
  const captureBytes = await fs.readFile(path.join(here, 'capture.json')), capture = JSON.parse(captureBytes);
  const compressed = JSON.parse(await fs.readFile(path.join(here, 'png-compression.json')));
  assert.equal(compressed.captureSha256, sha(captureBytes));
  const bytes = await fs.readFile(input), source = unpack(bytes);
  assert.equal(sha(bytes), expectedHash, 'input SHA256');
  assert.equal(sha(source.bin.subarray(0, capture.source.binLength)), capture.source.binSha256, 'original ungraded ea939 prefix');
  assert.deepEqual(contract(source.doc), capture.source.contract, 'same ungraded image/material/rig/mesh contract');
  assert.equal(compressed.images.length, capture.images.length);
  const refs = references(source.doc), doc = structuredClone(source.doc), bin = Buffer.from(source.bin), edits = [];
  for (const image of capture.images) {
    const replacement = compressed.images.find(x => x.imageIndex === image.imageIndex);
    assert.equal(replacement?.rgbaSha256, image.rgbaSha256, 'exact captured pixels');
    const png = await fs.readFile(path.join(here, replacement.file));
    assert.equal(sha(png), replacement.pngSha256);
    assert.equal(sha(imageBytes(source, image.imageIndex)), image.sourcePngSha256, 'ungraded PNG');
    const viewIndex = source.doc.images[image.imageIndex].bufferView, view = source.doc.bufferViews[viewIndex];
    const start = view.byteOffset ?? 0, oldEnd = start + view.byteLength;
    assert.ok(png.length > 0 && png.length <= view.byteLength, 'replacement fits existing image allocation');
    assert.equal(view.byteStride, undefined); assert.equal(view.target, undefined);
    assert.deepEqual(refs.filter(r => r.view === viewIndex), [{ location: `images.${image.imageIndex}.bufferView`, view: viewIndex }], 'image view has exactly one image reference');
    for (const [j, other] of source.doc.bufferViews.entries()) if (j !== viewIndex) {
      const otherStart = other.byteOffset ?? 0;
      assert.ok(Math.max(start, otherStart) >= Math.min(oldEnd, otherStart + other.byteLength), 'image allocation does not overlap view ' + j);
    }
    png.copy(bin, start); doc.bufferViews[viewIndex].byteLength = png.length;
    edits.push({ imageIndex: image.imageIndex, viewIndex, start, replacementEnd: start + png.length,
      originalEnd: oldEnd, originalBytes: view.byteLength, replacementBytes: png.length,
      retainedTailBytes: view.byteLength - png.length, pngSha256: replacement.pngSha256, rgbaSha256: image.rgbaSha256 });
  }
  doc.materials[capture.brow.materialIndex].pbrMetallicRoughness.baseColorFactor = capture.brow.bakedLinearRGBA;
  const result = pack(doc, bin), check = unpack(result);
  assert.equal(check.bin.length, source.bin.length); assert.deepEqual(check.doc.buffers, source.doc.buffers);
  const restored = structuredClone(check.doc);
  for (const edit of edits) restored.bufferViews[edit.viewIndex].byteLength = source.doc.bufferViews[edit.viewIndex].byteLength;
  restored.materials[capture.brow.materialIndex] = source.doc.materials[capture.brow.materialIndex];
  assert.deepEqual(restored, source.doc, 'all other JSON values exact, including offsets and every index');
  let previousEnd = 0;
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    assert.deepEqual(check.bin.subarray(previousEnd, edit.start), source.bin.subarray(previousEnd, edit.start), 'bytes outside replacement spans');
    previousEnd = edit.replacementEnd;
    assert.deepEqual(check.bin.subarray(edit.replacementEnd, edit.originalEnd), source.bin.subarray(edit.replacementEnd, edit.originalEnd), 'old PNG tail retained');
    assert.equal(sha(imageBytes(check, edit.imageIndex)), edit.pngSha256);
  }
  assert.deepEqual(check.bin.subarray(previousEnd), source.bin.subarray(previousEnd), 'final unchanged binary suffix');
  const spans = accessorSpans(source);
  assert.deepEqual(accessorSpans(check), spans, 'every accessor base and sparse raw span exact');
  const unaffectedImages = source.doc.images.map((_, i) => i).filter(i => !edits.some(e => e.imageIndex === i));
  for (const i of unaffectedImages) assert.deepEqual(imageBytes(check, i), imageBytes(source, i), 'unaffected embedded image ' + i);
  assert.ok(result.length <= bytes.length, 'delivery does not grow the selected input');
  const report = { kind: 'Exact colour delivery using existing exclusive image allocations',
    input: path.resolve(input), inputSha256: expectedHash, output: path.resolve(output), outputSha256: sha(result),
    inputBytes: bytes.length, outputBytes: result.length, sizeChangeBytes: result.length - bytes.length,
    unchangedBinLength: source.bin.length, edits, brow: capture.brow, unaffectedImages,
    accessorCount: source.doc.accessors.length, accessorSpanCount: spans.length,
    accessorSpansSha256: sha(JSON.stringify(spans)), accessorSpans: spans,
    checks: { exclusiveImageViews: true, noViewOverlaps: true, noUnknownBinaryExtensions: true,
      indicesOffsetsBufferLengthExact: true, allOtherJsonExact: true, outsideReplacementBytesExact: true,
      oldImageTailsExact: true, allAccessorBaseAndSparseSpansExact: true, unaffectedImageBytesExact: true,
      geometryRigMorphsAnimationsExact: true, noSizeIncrease: true },
    runtimeGradeMustBeRemovedBeforeAdoption: true };
  await fs.writeFile(output, result, { flag: 'wx' });
  await fs.writeFile(output + '.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const { accessorSpans: _spans, ...summary } = report;
  return summary;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 5, 'node deliver.mjs UNGRADED_INPUT.glb NEW_OUTPUT.glb EXACT_INPUT_SHA256');
  console.log(JSON.stringify(await deliver(...process.argv.slice(2)), null, 2));
}
