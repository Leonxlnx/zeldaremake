import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error(`${command}: ${result.error ?? result.stderr}`);
  return result;
};
const measure = (name) => {
  const result = run('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', '-i', path.join(dir, name), '-af', 'loudnorm=I=-24:TP=-4:LRA=9:print_format=json', '-f', 'null', 'NUL']);
  fs.writeFileSync(path.join(dir, `${name}.measurement.log`), result.stderr);
  return JSON.parse(result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
};
const raw = measure('mix-raw.wav');
const filter = `loudnorm=I=-24:TP=-4:LRA=9:measured_I=${raw.input_i}:measured_TP=${raw.input_tp}:measured_LRA=${raw.input_lra}:measured_thresh=${raw.input_thresh}:offset=${raw.target_offset}:linear=true:print_format=json,afade=t=in:st=0:d=1.2,afade=t=out:st=27:d=3`;
const finalName = 'cinematic-30s-48k-stereo.wav';
const processed = run('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', '-y', '-i', path.join(dir, 'mix-raw.wav'), '-af', filter, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(dir, finalName)]);
fs.writeFileSync(path.join(dir, 'processing.log'), processed.stderr);
const finalLevels = measure(finalName);
const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,duration,duration_ts,time_base:format=duration,size', '-of', 'json', path.join(dir, finalName)]).stdout);
assert.equal(info.streams.length, 1);
assert.equal(info.streams[0].sample_rate, '48000');
assert.equal(info.streams[0].channels, 2);
assert.equal(info.streams[0].duration_ts, 1440000);
assert.equal(Number(info.format.duration), 30);
assert.ok(Number(finalLevels.input_tp) <= -4, 'final true peak must stay below -4 dBTP');
const bytes = fs.readFileSync(path.join(dir, finalName));
let dataOffset = null;
for (let offset = 12; offset + 8 <= bytes.length;) {
  const size = bytes.readUInt32LE(offset + 4);
  if (bytes.toString('ascii', offset, offset + 4) === 'data') { dataOffset = offset + 8; break; }
  offset += 8 + size + (size & 1);
}
assert.notEqual(dataOffset, null);
assert.equal(bytes.readInt16LE(dataOffset), 0, 'fade-in must begin at silence');
assert.equal(bytes.readInt16LE(dataOffset + 2), 0);
assert.equal(bytes.readInt16LE(bytes.length - 4), 0, 'fade-out must end at silence');
assert.equal(bytes.readInt16LE(bytes.length - 2), 0);
const provenance = JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json')));
assert.ok(!provenance.console.some((line) => /^(error|pageerror):/.test(line)), 'audio page must have no errors');
for (const [file, expected] of Object.entries(provenance.sources)) {
  const actual = createHash('sha256').update(fs.readFileSync(path.join(provenance.sourceRoot, file), 'utf8')).digest('hex');
  assert.equal(actual, expected, `frozen source changed: ${file}`);
}
provenance.final = {
  file: finalName, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  processingFilter: filter, rawMeasurement: raw, measurement: finalLevels, format: info,
  checks: '30.000s; 1,440,000 frames per channel; stereo 48kHz PCM16; first and last stereo samples exactly zero; true peak below -4dBTP; no browser errors; frozen source hashes unchanged.',
};
fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'README.md'), `# Cinematic audio — e599075f\n\nFinal: **${finalName}**, 30.000s, stereo 48kHz PCM16.\n\nMeasured after processing: **${finalLevels.input_i} LUFS integrated**, **${finalLevels.input_tp} dBTP**, **${finalLevels.input_lra} LU loudness range**. Fade-in 1.2s; fade-out from 27s to 30s. Both endpoints are digital silence.\n\nUses the frozen checkpoint's existing procedural forest ambience, seeded reverb and original “Under the Boughs” woodwind/harp score. The music's dry and reverb paths are each reduced to 0.45 before the final combined level pass. No footsteps or positional lantern sounds were guessed. No recordings, external assets, downloads, narration or music service.\n\nThe repository package metadata declares MIT; the music source explicitly documents the score as original. This checkout has no standalone LICENSE file. Source hashes and full processing measurements are in provenance.json.\n\nRendering used OfflineAudioContext in a blank headless Chrome page with GPU and WebGL disabled. No world was loaded or rendered, and no frozen source changed. Separate raw ambience/music/mix stems are retained.\n\nReproduce with Node: render-audio.mjs, then finish-audio.mjs. Existing TypeScript, Puppeteer and FFmpeg installations only.\n`);
console.log(JSON.stringify(provenance.final, null, 2));
