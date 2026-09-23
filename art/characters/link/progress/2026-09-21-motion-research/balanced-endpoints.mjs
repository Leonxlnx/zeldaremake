// Read the authored quaternion endpoints directly; LoopRepeat may wrap a mixer sample at duration.
// node art/characters/link/progress/2026-09-21-motion-research/balanced-endpoints.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = new URL('./', import.meta.url);
const source = new URL('../2026-09-21-motion-integration/', import.meta.url);
const names = ['stairs-upright-candidate.glb', 'torso-balanced-candidate.glb'];
const expected = ['e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552', '053a1536b456a08f2e40adf813724d24c21ee60b80c900eda1d16734416172e6'];
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI;
const report = { kind: 'Direct float32 GLB run quaternion keys; no renderer or mixer wrapping', models: [] };
for (const [modelIndex, name] of names.entries()) {
  const bytes = await fs.readFile(new URL(name, source));
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, expected[modelIndex]);
  const length = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + length));
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  assert.equal(bytes.readUInt32LE(24 + length), 0x004e4942);
  const bin = bytes.subarray(28 + length);
  const read = (index, width) => {
    const a = doc.accessors[index], view = doc.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126); assert.equal(a.sparse, undefined);
    assert.equal(a.type, width === 1 ? 'SCALAR' : 'VEC4');
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? width * 4;
    assert.ok(offset + stride * (a.count - 1) + width * 4 <= bin.length);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, j) => bin.readFloatLE(offset + stride * i + j * 4)));
  };
  const run = doc.animations.find(a => a.name === 'run'), channels = [];
  for (const bone of ['chest', 'head']) {
    const channel = run.channels.find(c => doc.nodes[c.target.node].name === bone && c.target.path === 'rotation');
    const sampler = run.samplers[channel.sampler];
    assert.equal(sampler.interpolation ?? 'LINEAR', 'LINEAR');
    const times = read(sampler.input, 1).flat(), rotations = read(sampler.output, 4);
    assert.equal(times.length, rotations.length); assert.ok(times.length >= 2);
    const expectedTimes = Array.from({ length: 113 }, (_, i) => Math.fround((28 / 60) * i / 112));
    channels.push({ bone, keys: times.length, firstTime: times[0], lastTime: times.at(-1),
      firstQuaternion: rotations[0], lastQuaternion: rotations.at(-1), endpointAngleDeg: angle(rotations[0], rotations.at(-1)),
      minNorm: Math.min(...rotations.map(q => Math.hypot(...q))), maxNorm: Math.max(...rotations.map(q => Math.hypot(...q))),
      firstStepDeg: angle(rotations[0], rotations[1]), lastStepDeg: angle(rotations.at(-2), rotations.at(-1)),
      maxDistanceFrom113PhaseGridS: Math.max(...times.map(t => Math.min(...expectedTimes.map(e => Math.abs(e - t))))),
      absent113GridPhases: expectedTimes.map((t, i) => [i, t]).filter(([, t]) => !times.some(s => Math.abs(s - t) < 1e-7)), times });
  }
  report.models.push({ name, sha256: hash, channels });
}
report.endpointsWithin00001Degrees = report.models.every(m => m.channels.every(c => c.endpointAngleDeg < 0.0001));
await fs.writeFile(new URL('balanced-endpoints.json', out), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.models.map(m => ({ ...m, channels: m.channels.map(({ times, absent113GridPhases, ...c }) => ({ ...c, absent113GridPhases: absent113GridPhases.length })) })), null, 2));
assert.ok(report.endpointsWithin00001Degrees, 'Authored selected-channel endpoint orientation discontinuity');
console.log('PASS: authored chest/head endpoints close; this does not assert seam velocity continuity. ' + fileURLToPath(out));
