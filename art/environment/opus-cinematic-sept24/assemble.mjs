// Assemble the 30-second cinematic from the recorder's real frames and the sound mix.
// node art/environment/opus-cinematic-sept24/assemble.mjs --frames <dir with f0000.png..f0899.png> --audio <mix-30s-48k.wav>
//   [--out art/environment/opus-cinematic-sept24] [--cuts cuts.json] [--grade on|off]
// Writes: Kokiri-Forest-Opus-4K.mp4 (native 3840x2160 master), Kokiri-Forest-Opus-X-1080p.mp4 (X upload),
// poster.png / poster-1080p.png (the ENCODED first frame of each), contact-sheet.jpg, verification/*.json, delivery.json.
// No frame interpolation, no retiming: frame n of the film is recorder frame n.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]) : 0, a), []));
const FPS = 30, FRAMES = 900, W = 3840, H = 2160;
const framesDir = path.resolve(args.frames ?? '');
const audio = path.resolve(args.audio ?? '');
const out = path.resolve(args.out ?? HERE);
const sha = async f => crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex');
const run = (cmd, a, opts = {}) => { const r = spawnSync(cmd, a, {encoding: 'utf8', maxBuffer: 1 << 28, ...opts}); if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}\n${r.stderr?.slice(-4000)}`); return r; };

// A restrained trailer grade on the rendered frames: a touch of contrast and warmth in the highlights,
// slightly richer greens, and a soft vignette. Applied identically to every frame (and so to the poster).
const GRADE = args.grade === 'off' ? 'null' : [
  "eq=contrast=1.045:saturation=1.07:gamma=0.985",
  "colorbalance=rs=-0.015:bs=0.02:rh=0.025:bh=-0.03",
  "vignette=angle=PI/5.5:mode=forward",
].join(',');

// 1. inputs
const names = (await fs.readdir(framesDir)).filter(f => /^f\d{4}\.png$/.test(f)).sort();
if (names.length !== FRAMES || names[0] !== 'f0000.png' || names.at(-1) !== `f${String(FRAMES - 1).padStart(4, '0')}.png`) throw new Error(`need f0000..f0899.png in ${framesDir}, found ${names.length}`);
const probe0 = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', path.join(framesDir, names[0])]).stdout).streams[0];
if (probe0.width !== W || probe0.height !== H) throw new Error(`frames are ${probe0.width}x${probe0.height}, expected ${W}x${H}`);
const aprobe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,duration_ts', '-of', 'json', audio]).stdout).streams[0];
if (Number(aprobe.sample_rate) !== 48000 || aprobe.channels !== 2) throw new Error('audio must be 48 kHz stereo');
const frameHashes = [];
for (const n of names) frameHashes.push(`${n} ${await sha(path.join(framesDir, n))}`);
const sequenceSha256 = crypto.createHash('sha256').update(frameHashes.join('\n') + '\n').digest('hex');
await fs.mkdir(path.join(out, 'verification'), {recursive: true});

// 2. encodes (single pass from the PNGs each; the audio is already mastered — no gain at mux)
const master = path.join(out, 'Kokiri-Forest-Opus-4K.mp4');
const xfile = path.join(out, 'Kokiri-Forest-Opus-X-1080p.mp4');
const common = ['-hide_banner', '-y', '-framerate', String(FPS), '-start_number', '0', '-i', path.join(framesDir, 'f%04d.png'), '-i', audio, '-map', '0:v:0', '-map', '1:a:0'];
const masterArgs = [...common, '-vf', `${GRADE},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level:v', '5.2', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '60',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-t', '30', '-movflags', '+faststart', master];
const xArgs = [...common, '-vf', `${GRADE},scale=1920:1080:flags=lanczos+accurate_rnd,unsharp=5:5:0.35:5:5:0,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-maxrate', '25M', '-bufsize', '50M',
  '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '60', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', '30', '-movflags', '+faststart', xfile];
if (!args['skip-encode']) {
  console.log('encoding 4K master…'); run('ffmpeg', masterArgs, {stdio: ['ignore', 'ignore', 'pipe']});
  console.log('encoding X 1080p…'); run('ffmpeg', xArgs, {stdio: ['ignore', 'ignore', 'pipe']});
}

// 3. posters from the ENCODED first frames; a contact sheet at every cut
run('ffmpeg', ['-hide_banner', '-y', '-i', master, '-vf', 'select=eq(n\\,0)', '-frames:v', '1', path.join(out, 'poster.png')]);
run('ffmpeg', ['-hide_banner', '-y', '-i', xfile, '-vf', 'select=eq(n\\,0)', '-frames:v', '1', path.join(out, 'poster-1080p.png')]);
let cuts = [];
if (args.cuts) cuts = JSON.parse(await fs.readFile(path.resolve(args.cuts), 'utf8'));
const marks = [...new Set([0, ...cuts.flatMap(c => [c.start, c.start + c.frames - 1]), FRAMES - 1])].filter(n => n >= 0 && n < FRAMES).sort((a, b) => a - b);
const cols = 6, rows = Math.ceil(marks.length / cols);
run('ffmpeg', ['-hide_banner', '-y', '-i', master, '-vf', `select='${marks.map(n => `eq(n\\,${n})`).join('+')}',scale=640:-1,tile=${cols}x${rows}`, '-fps_mode', 'vfr', '-frames:v', '1', '-q:v', '3', path.join(out, 'contact-sheet.jpg')]);

// 4. verification: ffprobe with a frame count, a full CPU decode, loudness of the delivered audio
const verification = {};
for (const f of [master, xfile]) {
  const p = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,duration,nb_frames,nb_read_frames,sample_rate,channels,channel_layout', '-of', 'json', f]).stdout);
  const decode = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostats', '-xerror', '-err_detect', 'explode', '-hwaccel', 'none', '-i', f, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 26});
  const loud = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 26}).stderr;
  const summary = loud.slice(loud.lastIndexOf('Summary:'));
  const num = re => Number((summary.match(re) || [])[1]);
  const v = p.streams.find(s => s.codec_type === 'video'), a = p.streams.find(s => s.codec_type === 'audio');
  const head = (await fs.readFile(f)).subarray(0, 1 << 16);
  const moovFirst = head.indexOf('moov') >= 0 && (head.indexOf('mdat') < 0 || head.indexOf('moov') < head.indexOf('mdat'));
  verification[path.basename(f)] = {
    sha256: await sha(f), bytes: (await fs.stat(f)).size, ffprobe: p, decodeOk: decode.status === 0 && !decode.stderr.trim(), decodeStderr: decode.stderr.trim().slice(0, 2000),
    loudness: {integratedLufs: num(/I:\s+(-?[\d.]+) LUFS/), lraLu: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: num(/Peak:\s+(-?[\d.]+) dBFS/)},
    checks: {frames: Number(v.nb_read_frames) === FRAMES, fps: v.r_frame_rate === '30/1', pixFmt: v.pix_fmt === 'yuv420p', codec: v.codec_name === 'h264', audio: a?.codec_name === 'aac' && Number(a.sample_rate) === 48000 && a.channels === 2,
      duration: Math.abs(Number(p.format.duration) - 30) < 0.05, faststart: moovFirst},
  };
}
await fs.writeFile(path.join(out, 'verification', 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
const git = c => execFileSync('git', c, {cwd: ROOT, encoding: 'utf8'}).trim();
const delivery = {
  createdAt: new Date().toISOString(), sourceCommit: git(['rev-parse', 'HEAD']), framesDir: path.relative(ROOT, framesDir).replaceAll('\\', '/'), frameSequenceSha256: sequenceSha256,
  frames: FRAMES, fps: FPS, seconds: FRAMES / FPS, nativeSize: `${W}x${H}`, audio: {file: path.relative(ROOT, audio).replaceAll('\\', '/'), sha256: await sha(audio)},
  grade: GRADE, files: Object.fromEntries(Object.entries(verification).map(([k, v]) => [k, {sha256: v.sha256, bytes: v.bytes, checks: v.checks, loudness: v.loudness}])),
  poster: {file: 'poster.png', sha256: await sha(path.join(out, 'poster.png')), from: 'frame 0 of Kokiri-Forest-Opus-4K.mp4 (decoded)'},
  ffmpeg: {master: masterArgs, x: xArgs}, contactSheetFrames: marks,
};
await fs.writeFile(path.join(out, 'delivery.json'), JSON.stringify(delivery, null, 2) + '\n');
await fs.writeFile(path.join(out, 'verification', 'frame-hashes.txt'), frameHashes.join('\n') + '\n');
console.log(JSON.stringify({sequenceSha256, files: delivery.files}, null, 2));
const bad = Object.entries(verification).filter(([, v]) => !v.decodeOk || !Object.values(v.checks).every(Boolean));
if (bad.length) { console.error('VERIFICATION FAILED:', bad.map(([k, v]) => k + ' ' + JSON.stringify(v.checks) + ' ' + v.decodeStderr)); process.exitCode = 1; }
