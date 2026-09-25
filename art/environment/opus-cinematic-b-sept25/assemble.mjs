// Assemble the cinematic from the recorder's real frames and the mastered sound mix.
//   node art/environment/opus-cinematic-b-sept25/assemble.mjs --frames <dir with f0000.png…> --audio <mix.wav>
//        --shots <shots.json> [--out art/environment/opus-cinematic-b-sept25] [--grade on|off] [--skip-encode]
// Writes: Kokiri-Forest-Cinematic.mp4 (native size, H.264 High, yuv420p, +faststart, AAC 48 kHz stereo),
// poster.png (the ENCODED first frame), contact-sheet.jpg (first / last frame of every shot, from the
// encoded file), verification/*.json, delivery.json.
// No frame interpolation, no retiming, no scaling: frame n of the film is recorder frame n.
// Adapted from opus-cinematic-sept24/assemble.mjs (which targeted a fixed 30 s 4K master + 1080p copy).
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]) : 0, a), []));
const FPS = 30;
const framesDir = path.resolve(args.frames ?? '');
const audio = path.resolve(args.audio ?? '');
const out = path.resolve(args.out ?? HERE);
const shotsFile = path.resolve(args.shots ?? path.join(HERE, 'shots.json'));
const sha = async f => crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex');
const run = (cmd, a, opts = {}) => { const r = spawnSync(cmd, a, {encoding: 'utf8', maxBuffer: 1 << 28, ...opts}); if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}\n${r.stderr?.slice(-4000)}`); return r; };

// the edit plan: each shot's first frame and length, in the order of the cut
const shotsRaw = JSON.parse(await fs.readFile(shotsFile, 'utf8'));
const shotList = Array.isArray(shotsRaw) ? shotsRaw : shotsRaw.shots;
const cuts = [];
{
  let f = 0;
  for (const s of shotList) { const n = Math.round(s.s * FPS); cuts.push({name: s.name, start: f, frames: n}); f += n; }
}
const FRAMES = cuts.reduce((a, c) => a + c.frames, 0);
const SECONDS = FRAMES / FPS;

// A restrained trailer grade: a touch of contrast, slightly richer greens, warmth in the highlights and
// a soft vignette. Applied identically to every frame (and so to the poster). No text, no overlays.
// The world renders a deliberately hazy, low-contrast morning (blacks near 15 % grey, highlights near
// 82 %); the review asked for trailer punch, so: a gentle S-curve that sets the black point near 3 %
// and opens the top, +15 % saturation, warm highlights / cool shadows, a soft vignette.
// Per-shot fixes come from shots.json "grade" (an ffmpeg filter enabled only on that shot's frames),
// e.g. the lantern doorway's shadow lift.
const shotGrades = cuts.map((c, i) => ({...c, grade: shotList[i].grade})).filter(c => typeof c.grade === 'string' && c.grade.trim());
const GRADE = args.grade === 'off' ? 'null' : [
  ...shotGrades.map(c => `${c.grade}:enable='between(n\\,${c.start}\\,${c.start + c.frames - 1})'`),
  "curves=all='0/0 0.09/0.03 0.25/0.2 0.5/0.5 0.75/0.8 0.93/0.965 1/1'",
  'eq=saturation=1.15:gamma=0.99',
  'colorbalance=rs=-0.012:bs=0.016:rh=0.02:bh=-0.025',
  'vignette=angle=PI/6.5:mode=forward',
].join(',');

// 1. inputs
const names = (await fs.readdir(framesDir)).filter(f => /^f\d{4}\.png$/.test(f)).sort();
if (names.length !== FRAMES || names[0] !== 'f0000.png' || names.at(-1) !== `f${String(FRAMES - 1).padStart(4, '0')}.png`) throw new Error(`need f0000..f${String(FRAMES - 1).padStart(4, '0')}.png in ${framesDir}, found ${names.length}`);
const probe0 = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', path.join(framesDir, names[0])]).stdout).streams[0];
const W = probe0.width, H = probe0.height;
if (!((W === 1920 && H === 1080) || (W === 3840 && H === 2160))) throw new Error(`frames are ${W}x${H}; expected 1920x1080 or 3840x2160`);
const aprobe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,duration_ts', '-of', 'json', audio]).stdout).streams[0];
if (Number(aprobe.sample_rate) !== 48000 || aprobe.channels !== 2) throw new Error('audio must be 48 kHz stereo');
if (Math.abs(Number(aprobe.duration_ts) - SECONDS * 48000) > 1) throw new Error(`audio is ${aprobe.duration_ts} samples, the cut is ${SECONDS * 48000}`);
const frameHashes = [];
for (const n of names) {
  const p = path.join(framesDir, n);
  frameHashes.push(`${n} ${await sha(p)}`);
  const m = await sharp(p).metadata();
  if (m.width !== W || m.height !== H) throw new Error(`${n} is ${m.width}x${m.height}, not ${W}x${H} (one size for all shots)`);
}
const sequenceSha256 = crypto.createHash('sha256').update(frameHashes.join('\n') + '\n').digest('hex');
await fs.mkdir(path.join(out, 'verification'), {recursive: true});

// 2. one encode, single pass from the PNGs; the audio is already mastered — no gain at mux
const film = path.join(out, `Kokiri-Forest-Cinematic${W === 3840 ? '-4K' : ''}.mp4`);
const level = W === 3840 ? '5.1' : '4.2';
const encArgs = ['-hide_banner', '-y', '-framerate', String(FPS), '-start_number', '0', '-i', path.join(framesDir, 'f%04d.png'), '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
  '-vf', `${GRADE},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', W === 3840 ? '15' : '16', '-maxrate', W === 3840 ? '60M' : '16M', '-bufsize', W === 3840 ? '120M' : '32M',
  '-profile:v', 'high', '-level:v', level, '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', String(FPS), '-g', '30', '-bf', '2', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', SECONDS.toFixed(6), '-movflags', '+faststart', film];
if (!args['skip-encode']) { console.log(`encoding ${W}x${H} ${FRAMES} frames (${SECONDS.toFixed(3)} s)…`); run('ffmpeg', encArgs, {stdio: ['ignore', 'ignore', 'pipe']}); }

// 3. the poster is the ENCODED frame 0; the contact sheet is every cut's first and last frame, decoded
run('ffmpeg', ['-hide_banner', '-y', '-i', film, '-vf', 'select=eq(n\\,0)', '-frames:v', '1', '-update', '1', path.join(out, 'poster.png')]);
const sheetDir = path.join(ROOT, 'gauntlet/out/opus-cinematic-b-sept25/sheet');
await fs.rm(sheetDir, {recursive: true, force: true});
await fs.mkdir(sheetDir, {recursive: true});
const marks = [...new Set(cuts.flatMap(c => [c.start, c.start + c.frames - 1]))].sort((a, b) => a - b);
// select passes the marked frames in order; they are written m0, m1, … = marks[0], marks[1], …
run('ffmpeg', ['-hide_banner', '-y', '-i', film, '-vf', `select='${marks.map(n => `eq(n\\,${n})`).join('+')}'`, '-fps_mode', 'passthrough', '-start_number', '0', path.join(sheetDir, 'm%d.png')]);
{
  const tw = 480, th = 270, cols = 4, gap = 4, lab = 24;
  const rows = Math.ceil(marks.length / cols);
  const comps = [];
  const dec = (await fs.readdir(sheetDir)).filter(f => /^m\d+\.png$/.test(f));
  if (dec.length !== marks.length) throw new Error(`contact sheet decoded ${dec.length} frames, wanted ${marks.length}`);
  for (let k = 0; k < marks.length; k++) {
    const n = marks[k];
    const c = cuts.find(c => n >= c.start && n < c.start + c.frames);
    const img = await sharp(path.join(sheetDir, `m${k}.png`)).resize(tw, th).toBuffer();
    const x = (k % cols) * (tw + gap), y = Math.floor(k / cols) * (th + lab + gap);
    const label = `${c.name} ${n === c.start ? 'in' : 'out'} · f${n} · ${(n / FPS).toFixed(2)} s`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    comps.push({input: img, left: x, top: y + lab});
    comps.push({input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="${tw}" height="${lab}" fill="#111"/><text x="6" y="17" font-family="Arial" font-size="14" fill="#e8e0c8">${label}</text></svg>`), left: x, top: y});
  }
  await sharp({create: {width: cols * (tw + gap) - gap, height: rows * (th + lab + gap) - gap, channels: 3, background: '#000'}}).composite(comps).jpeg({quality: 88}).toFile(path.join(out, 'contact-sheet.jpg'));
}

// 4. verification: ffprobe with a frame count, a full CPU decode, loudness of the delivered audio
const p = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_type,codec_name,profile,level,width,height,pix_fmt,color_space,r_frame_rate,avg_frame_rate,duration,nb_frames,nb_read_frames,sample_rate,channels,channel_layout', '-of', 'json', film]).stdout);
const decode = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostats', '-xerror', '-err_detect', 'explode', '-hwaccel', 'none', '-i', film, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 26});
const loud = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', film, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 26}).stderr;
const summary = loud.slice(loud.lastIndexOf('Summary:'));
const num = re => Number((summary.match(re) || [])[1]);
const v = p.streams.find(s => s.codec_type === 'video'), a = p.streams.find(s => s.codec_type === 'audio');
const head = (await fs.readFile(film)).subarray(0, 1 << 16);
const moovFirst = head.indexOf('moov') >= 0 && (head.indexOf('mdat') < 0 || head.indexOf('moov') < head.indexOf('mdat'));
// the encoded first frame must not be black / flat (no lead-in): mean luma and spread of the poster
const posterStats = await sharp(path.join(out, 'poster.png')).greyscale().stats();
const verification = {
  file: path.basename(film), sha256: await sha(film), bytes: (await fs.stat(film)).size, ffprobe: p, decodeOk: decode.status === 0 && !decode.stderr.trim(), decodeStderr: decode.stderr.trim().slice(0, 2000),
  loudness: {integratedLufs: num(/I:\s+(-?[\d.]+) LUFS/), lraLu: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: num(/Peak:\s+(-?[\d.]+) dBFS/)},
  poster: {meanLuma: +posterStats.channels[0].mean.toFixed(2), stdevLuma: +posterStats.channels[0].stdev.toFixed(2)},
  checks: {
    frames: Number(v.nb_read_frames) === FRAMES, fps: v.r_frame_rate === '30/1', pixFmt: v.pix_fmt === 'yuv420p', codec: v.codec_name === 'h264', profile: v.profile === 'High',
    size: v.width === W && v.height === H, audio: a?.codec_name === 'aac' && Number(a.sample_rate) === 48000 && a.channels === 2,
    duration: Math.abs(Number(p.format.duration) - SECONDS) < 0.05, faststart: moovFirst,
    loudness: Math.abs(num(/I:\s+(-?[\d.]+) LUFS/) + 14) <= 1, truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) <= -1.0,
    posterNotBlack: posterStats.channels[0].mean > 20 && posterStats.channels[0].stdev > 12,
    // GitHub refuses files over 100 MB (no LFS in this repo); X's own limit is 512 MB
    under100MB: (await fs.stat(film)).size < 100 * 1024 * 1024,
  },
};
await fs.writeFile(path.join(out, 'verification', 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
const git = c => execFileSync('git', c, {cwd: ROOT, encoding: 'utf8'}).trim();
const delivery = {
  createdAt: new Date().toISOString(), sourceCommit: git(['rev-parse', 'HEAD']), framesDir: path.relative(ROOT, framesDir).replaceAll('\\', '/'), frameSequenceSha256: sequenceSha256,
  frames: FRAMES, fps: FPS, seconds: SECONDS, nativeSize: `${W}x${H}`, audio: {file: path.relative(ROOT, audio).replaceAll('\\', '/'), sha256: await sha(audio)},
  shots: {file: path.relative(ROOT, shotsFile).replaceAll('\\', '/'), sha256: await sha(shotsFile), cuts},
  grade: GRADE, film: {file: path.basename(film), sha256: verification.sha256, bytes: verification.bytes, checks: verification.checks, loudness: verification.loudness},
  poster: {file: 'poster.png', sha256: await sha(path.join(out, 'poster.png')), from: `frame 0 of ${path.basename(film)} (decoded)`},
  contactSheet: {file: 'contact-sheet.jpg', frames: marks},
  ffmpeg: encArgs.map(x => x.replace(ROOT, '<repo>').replaceAll('\\', '/')),
};
await fs.writeFile(path.join(out, 'delivery.json'), JSON.stringify(delivery, null, 2) + '\n');
await fs.writeFile(path.join(out, 'verification', 'frame-hashes.txt'), frameHashes.join('\n') + '\n');
console.log(JSON.stringify({sequenceSha256, film: delivery.film}, null, 2));
if (!verification.decodeOk || !Object.values(verification.checks).every(Boolean)) { console.error('VERIFICATION FAILED:', JSON.stringify(verification.checks), verification.decodeStderr); process.exitCode = 1; }

