// Derive the shipped Link GLB from Astra's delivery: every embedded image larger than --max (2048)
// is resized to it (lanczos3) — the colour maps as JPEG q92, normal maps as PNG — and every other
// byte (geometry, skin, morphs, animation, materials) is copied unchanged. The buffer views are
// laid out again in index order on 8-byte boundaries.
//   node art/characters/link/downscale-textures.mjs public/models/link/link-runtime.glb public/models/link/link-runtime-2k.glb
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const [src, dst] = process.argv.slice(2);
const maxArg = process.argv.indexOf('--max');
const MAX = maxArg > 0 ? Number(process.argv[maxArg + 1]) : 2048;
if (!src || !dst) throw new Error('usage: downscale-textures.mjs <in.glb> <out.glb> [--max 2048]');

const b = fs.readFileSync(src);
if (b.toString('latin1', 0, 4) !== 'glTF') throw new Error(`${src} is not a GLB`);
const jsonLen = b.readUInt32LE(12);
if (b.toString('latin1', 16, 20) !== 'JSON') throw new Error('first chunk is not JSON');
const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
const binAt = 20 + jsonLen;
const binLen = b.readUInt32LE(binAt);
if (b.toString('latin1', binAt + 4, binAt + 8) !== 'BIN\0') throw new Error('second chunk is not BIN');
const bin = b.subarray(binAt + 8, binAt + 8 + binLen);

const imageOfView = new Map((json.images ?? []).map((img, i) => [img.bufferView, i]));
const parts = [];
let offset = 0;
const report = [];
for (let v = 0; v < json.bufferViews.length; v++) {
  const view = json.bufferViews[v];
  if ((view.buffer ?? 0) !== 0) throw new Error(`bufferView ${v} is not in the GLB buffer`);
  let data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const i = imageOfView.get(v);
  if (i !== undefined) {
    const img = json.images[i];
    const meta = await sharp(data).metadata();
    if (meta.width > MAX || meta.height > MAX) {
      const normal = /normal/i.test(img.name ?? '');
      const resized = sharp(data).resize(Math.min(MAX, meta.width), Math.min(MAX, meta.height), { kernel: 'lanczos3' });
      const out = normal ? await resized.png({ compressionLevel: 9 }).toBuffer() : await resized.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      report.push(`${img.name}: ${meta.width}×${meta.height} ${(data.length / 1e6).toFixed(2)} MB → ${Math.min(MAX, meta.width)}×${Math.min(MAX, meta.height)} ${normal ? 'png' : 'jpeg'} ${(out.length / 1e6).toFixed(2)} MB`);
      data = out;
      img.mimeType = normal ? 'image/png' : 'image/jpeg';
    }
  }
  const pad = (8 - (offset % 8)) % 8;
  if (pad) parts.push(Buffer.alloc(pad));
  offset += pad;
  view.byteOffset = offset;
  view.byteLength = data.length;
  parts.push(data);
  offset += data.length;
}
const binPad = (4 - (offset % 4)) % 4;
if (binPad) parts.push(Buffer.alloc(binPad));
const newBin = Buffer.concat(parts);
json.buffers[0].byteLength = offset;
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'latin1');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const chunk = (len, type) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(len, 0);
  h.write(type, 4, 'latin1');
  return h;
};
const out = Buffer.concat([header, chunk(jsonBuf.length, 'JSON'), jsonBuf, chunk(newBin.length, 'BIN\0'), newBin]);
fs.writeFileSync(dst, out);
const sha = (x) => createHash('sha256').update(x).digest('hex');
console.log(report.join('\n'));
console.log(`${src} ${(b.length / 1e6).toFixed(2)} MB sha256 ${sha(b)}`);
console.log(`${dst} ${(out.length / 1e6).toFixed(2)} MB sha256 ${sha(out)}`);
