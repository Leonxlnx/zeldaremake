#!/usr/bin/env node
// Encode frames + mix into the delivery MP4 and verify it. Owner: director.
//
//   node spiderverse/tools/assemble.mjs --frames spiderverse/out/frames --audio spiderverse/out/audio/mix.wav \
//        --out spiderverse/out/film/into-the-ant-verse.mp4 [--crf 16] [--fill] [--poster 2832]
//
// --fill: missing frames are filled by holding the nearest earlier frame (for partial checkpoints);
//         the verification report lists how many frames were filled.
// Verification (written to <out>.verify.json): ffprobe dimensions / fps / duration / codecs,
// faststart (moov before mdat), full-file decode with zero errors, audio stream present and
// not silent, and the frame count.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { SV_ROOT } from './lib/headless.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n) => args.includes(`--${n}`);

const edit = await import(path.join(SV_ROOT, 'app/core/edit.js'));
const framesDir = path.resolve(opt('frames', path.join(SV_ROOT, 'out/frames')));
const audio = opt('audio', path.join(SV_ROOT, 'out/audio/mix.wav'));
const out = path.resolve(opt('out', path.join(SV_ROOT, 'out/film/into-the-ant-verse.mp4')));
const crf = opt('crf', '16');
const fill = flag('fill');
const total = Number(opt('count', String(edit.DURATION_FRAMES)));
const posterFrame = opt('poster', null);
fs.mkdirSync(path.dirname(out), { recursive: true });

// Build a contiguous, gap-free sequence of symlinks.
const seqDir = path.join(path.dirname(out), '.seq_' + path.basename(out, '.mp4'));
fs.rmSync(seqDir, { recursive: true, force: true });
fs.mkdirSync(seqDir, { recursive: true });
let last = null;
let filled = 0;
let missingLeading = 0;
for (let f = 0; f < total; f++) {
  const src = path.join(framesDir, `frame_${String(f).padStart(5, '0')}.png`);
  let use = null;
  if (fs.existsSync(src)) {
    use = src;
    last = src;
  } else if (fill && last) {
    use = last;
    filled++;
  } else if (fill) {
    missingLeading++;
    continue;
  } else {
    console.error(`[assemble] missing frame ${f} (use --fill for partial checkpoints)`);
    process.exit(2);
  }
  fs.symlinkSync(use, path.join(seqDir, `f_${String(f).padStart(5, '0')}.png`));
}
if (missingLeading) {
  // Leading gaps: hold the first available frame.
  const first = fs.readdirSync(seqDir).sort()[0];
  for (let f = 0; f < missingLeading; f++) {
    fs.symlinkSync(fs.readlinkSync(path.join(seqDir, first)), path.join(seqDir, `f_${String(f).padStart(5, '0')}.png`));
  }
  filled += missingLeading;
}

const hasAudio = audio && fs.existsSync(audio);
const ff = ['-y', '-v', 'error', '-framerate', String(edit.FPS), '-start_number', '0', '-i', path.join(seqDir, 'f_%05d.png')];
if (hasAudio) ff.push('-i', audio);
ff.push(
  '-map', '0:v:0',
  ...(hasAudio ? ['-map', '1:a:0'] : []),
  '-c:v', 'libx264', '-preset', opt('preset', 'slow'), '-crf', crf, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-g', '48', '-bf', '2', '-r', String(edit.FPS),
  ...(hasAudio ? ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2'] : []),
  '-t', String(total / edit.FPS),
  '-movflags', '+faststart',
  out,
);
console.log('[assemble] encoding', total, 'frames', hasAudio ? '+ audio' : '(no audio)', '->', out);
const t0 = Date.now();
execFileSync('ffmpeg', ff, { stdio: 'inherit' });
console.log(`[assemble] encoded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
fs.rmSync(seqDir, { recursive: true, force: true });

// ---------------------------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------------------------
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', out]).toString());
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');

function atoms(file) {
  const fd = fs.openSync(file, 'r');
  const size = fs.statSync(file).size;
  const list = [];
  let pos = 0;
  const hdr = Buffer.alloc(16);
  while (pos < size && list.length < 64) {
    fs.readSync(fd, hdr, 0, 16, pos);
    let len = hdr.readUInt32BE(0);
    const type = hdr.toString('latin1', 4, 8);
    if (len === 1) len = Number(hdr.readBigUInt64BE(8));
    if (len === 0) len = size - pos;
    list.push(type);
    if (len < 8) break;
    pos += len;
  }
  fs.closeSync(fd);
  return list;
}
const top = atoms(out);
const faststart = top.indexOf('moov') >= 0 && top.indexOf('moov') < top.indexOf('mdat');

const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', out, '-f', 'null', '-'], { encoding: 'utf8' });
const decodeErrors = (dec.stderr || '').trim();

let meanVolume = null;
let maxVolume = null;
if (a) {
  const vd = spawnSync('ffmpeg', ['-i', out, '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m1 = /mean_volume:\s*(-?[\d.]+) dB/.exec(vd.stderr || '');
  const m2 = /max_volume:\s*(-?[\d.]+) dB/.exec(vd.stderr || '');
  meanVolume = m1 ? Number(m1[1]) : null;
  maxVolume = m2 ? Number(m2[1]) : null;
}

const fpsParts = (v.r_frame_rate || '0/1').split('/').map(Number);
const report = {
  file: out,
  bytes: fs.statSync(out).size,
  video: {
    codec: v.codec_name,
    profile: v.profile,
    width: v.width,
    height: v.height,
    pix_fmt: v.pix_fmt,
    fps: fpsParts[0] / fpsParts[1],
    frames: Number(v.nb_read_frames || v.nb_frames),
    duration: Number(v.duration),
  },
  audio: a
    ? { codec: a.codec_name, sample_rate: Number(a.sample_rate), channels: a.channels, duration: Number(a.duration), meanVolumeDb: meanVolume, maxVolumeDb: maxVolume }
    : null,
  container: { duration: Number(probe.format.duration), topLevelAtoms: top, faststart },
  decode: { ok: decodeErrors.length === 0, errors: decodeErrors.slice(0, 2000) },
  frames: { expected: total, filled },
  checks: {},
};
report.checks = {
  dimensions: v.width >= 1920 && v.height >= 804,
  fps24: Math.abs(report.video.fps - 24) < 1e-6,
  duration: Math.abs(report.container.duration - total / edit.FPS) <= 0.5,
  frameCount: report.video.frames === total,
  h264: v.codec_name === 'h264',
  aac: !!a && a.codec_name === 'aac',
  audioNotSilent: meanVolume !== null && meanVolume > -60,
  noClipping: maxVolume === null || maxVolume < 0,
  faststart,
  fullDecode: report.decode.ok,
  noFilledFrames: filled === 0,
};
fs.writeFileSync(out + '.verify.json', JSON.stringify(report, null, 2));
console.log('[assemble] verification:', JSON.stringify(report.checks));

if (posterFrame !== null) {
  const src = path.join(framesDir, `frame_${String(posterFrame).padStart(5, '0')}.png`);
  const dst = out.replace(/\.mp4$/, '.poster.png');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log('[assemble] poster ->', dst);
  }
}
