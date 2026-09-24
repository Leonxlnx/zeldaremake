#!/usr/bin/env node
/**
 * Mix and master the stems rendered by render-audio.mjs into mix-30s-48k.wav (48 kHz stereo
 * PCM 24-bit, exactly durationSeconds × 48000 frames), mastered for X: integrated -14 LUFS,
 * true peak <= -1.5 dBTP.
 *
 *   node finish-audio.mjs [--cues cues.json]            mix, master, verify, write provenance + README
 *   node finish-audio.mjs --analyze-stems               per-section loudness of each raw stem only
 *
 * Chain: per-stem gain (cues.mixDb) -> amix (normalize=0) -> makeup gain -> alimiter (ceiling,
 * lookahead latency compensated) = premix (float) -> loudnorm pass 1 (measure) -> loudnorm pass 2
 * (linear, measured_*) -> 48 kHz -> de-click fade in + fade out -> pad/trim to the exact frame count.
 * The makeup gain is iterated so the premix already sits at the target and loudnorm's linear pass
 * only trims a fraction of a dB (so it never falls back to its dynamic mode).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const cuesPath = path.resolve(opt('cues', path.join(here, 'cues.json')));
const cues = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
const SR = cues.sampleRate ?? 48000;
const duration = cues.durationSeconds ?? 30;
const FRAMES = Math.round(duration * SR);
const STEMS = ['bed', 'birds', 'detail', 'steps', 'music'];
const master = { targetLufs: -14, truePeakDb: -1.5, limiterCeilingDb: -2.3, loudnormLra: 11, ...(cues.master ?? {}) };
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const stemPath = (s) => path.join(here, 'stems', `${s}.wav`);

const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}\n${r.error ?? r.stderr.slice(-3000)}`);
  return r;
};
const ffmpeg = (a) => run('ffmpeg', ['-hide_banner', '-nostdin', '-nostats', ...a]);
const loudnormJson = (stderr) => JSON.parse(stderr.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const ln = `I=${master.targetLufs}:TP=${master.truePeakDb}:LRA=${master.loudnormLra}`;

/** ebur128 per-100 ms frames (t, M, S) and the summary (I, LRA, true peak) */
function ebur128(file, extraFilter = '') {
  const r = ffmpeg(['-i', file, '-af', `${extraFilter}ebur128=peak=true:framelog=info`, '-f', 'null', '-']);
  const frames = [];
  for (const m of r.stderr.matchAll(/t:\s*([\d.]+)\s+TARGET:[^M]*M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/g)) frames.push({ t: +m[1], M: +m[2], S: +m[3] });
  const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re) => {
    const m = sum.match(re);
    return m ? +m[1] : null;
  };
  return { frames, I: num(/I:\s*(-?[\d.]+) LUFS/), LRA: num(/LRA:\s*(-?[\d.]+) LU/), TP: num(/Peak:\s*(-?[\d.]+|-inf) dBFS/) };
}
const powMean = (xs) => (xs.length ? 10 * Math.log10(xs.reduce((s, x) => s + Math.pow(10, x / 10), 0) / xs.length) : null);
function sectionStats(frames) {
  return cues.sections.map((s) => {
    const inM = frames.filter((f) => f.t > s.start + 0.4 && f.t <= s.end + 1e-6 && f.M > -70).map((f) => f.M);
    const inS = frames.filter((f) => f.t > s.start + 0.1 && f.t <= s.end + 1e-6 && f.S > -70).map((f) => f.S);
    const atEnd = frames.filter((f) => f.t <= s.end + 1e-6).pop();
    const r1 = (x) => (x === null || !Number.isFinite(x) ? null : +x.toFixed(1));
    return { id: s.id, start: s.start, end: s.end, M_mean: r1(powMean(inM)), M_max: r1(inM.length ? Math.max(...inM) : null), S_max: r1(inS.length ? Math.max(...inS) : null), S_end: r1(atEnd?.S) };
  });
}
const table = (rows) => rows.map((r) => `${r.id.padEnd(8)} ${String(r.start).padStart(5)}-${String(r.end).padEnd(5)} M_mean ${String(r.M_mean).padStart(6)}  M_max ${String(r.M_max).padStart(6)}  S_max ${String(r.S_max).padStart(6)}  S_end ${String(r.S_end).padStart(6)}`).join('\n');

if (args.includes('--analyze-stems')) {
  for (const s of STEMS) {
    const e = ebur128(stemPath(s));
    console.log(`\n== ${s}: I ${e.I} LUFS, LRA ${e.LRA}, TP ${e.TP}`);
    console.log(table(sectionStats(e.frames)));
  }
  process.exit(0);
}

// ---- 1. sum and iterate the makeup gain -----------------------------------------------------
const mixDb = { bed: 0, birds: 0, detail: 0, steps: 0, music: 0, ...(cues.mixDb ?? {}) };
const inputs = STEMS.flatMap((s) => ['-i', stemPath(s)]);
const sumGraph = STEMS.map((s, i) => `[${i}:a]volume=${mixDb[s]}dB[a${i}]`).join(';') + ';' + STEMS.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${STEMS.length}:normalize=0:duration=longest`;
const measureSum = loudnormJson(ffmpeg([...inputs, '-filter_complex', `${sumGraph},loudnorm=${ln}:print_format=json`, '-f', 'null', '-']).stderr);
const ceiling = Math.pow(10, master.limiterCeilingDb / 20);
let makeup = master.targetLufs - Number(measureSum.input_i);
const premix = path.join(here, 'premix.wav');
let pass1;
const iterations = [];
for (let k = 0; k < 6; k++) {
  const graph = `${sumGraph},volume=${makeup.toFixed(3)}dB,alimiter=limit=${ceiling.toFixed(5)}:attack=4:release=60:level=false:latency=true`;
  ffmpeg(['-y', ...inputs, '-filter_complex', graph, '-ar', String(SR), '-c:a', 'pcm_f32le', premix]);
  pass1 = loudnormJson(ffmpeg(['-i', premix, '-af', `loudnorm=${ln}:print_format=json`, '-f', 'null', '-']).stderr);
  iterations.push({ makeupDb: +makeup.toFixed(3), premixI: +pass1.input_i, premixTP: +pass1.input_tp });
  const err = master.targetLufs - Number(pass1.input_i);
  if (Math.abs(err) < 0.12) break;
  makeup += err * 1.05;
}
console.log('makeup iterations', JSON.stringify(iterations));

// ---- 2. loudnorm pass 2 (linear) + fades + exact length ------------------------------------------
const fadeIn = cues.fadeIn ?? 0.05;
const fo = cues.fadeOut ?? { start: 27.5, duration: 2.5 };
// the out-fade reaches zero half a millisecond before the end, so the last frames are digital silence
const foDur = Math.min(fo.duration, duration - fo.start - 0.0005);
const pass2Filter = `loudnorm=${ln}:measured_I=${pass1.input_i}:measured_TP=${pass1.input_tp}:measured_LRA=${pass1.input_lra}:measured_thresh=${pass1.input_thresh}:offset=${pass1.target_offset}:linear=true:print_format=json,aresample=${SR},afade=t=in:st=0:d=${fadeIn}:curve=qsin,afade=t=out:st=${fo.start}:d=${foDur.toFixed(4)}:curve=tri,apad=whole_len=${FRAMES},atrim=end_sample=${FRAMES}`;
const finalName = 'mix-30s-48k.wav';
const finalPath = path.join(here, finalName);
const p2 = ffmpeg(['-y', '-i', premix, '-af', pass2Filter, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s24le', finalPath]);
const pass2 = loudnormJson(p2.stderr);
fs.writeFileSync(path.join(here, 'processing.log'), `${JSON.stringify({ measureSum, iterations, pass1, pass2Filter }, null, 1)}\n${p2.stderr}`);

// ---- 3. verify -------------------------------------------------------------------------------------
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,bits_per_raw_sample,bits_per_sample,duration,duration_ts:format=duration,size', '-of', 'json', finalPath]).stdout);
const st = probe.streams[0];
const finalEbu = ebur128(finalPath);
const sections = sectionStats(finalEbu.frames);
console.log(`\nfinal: I ${finalEbu.I} LUFS, LRA ${finalEbu.LRA} LU, TP ${finalEbu.TP} dBTP; loudnorm ${pass2.normalization_type}`);
console.log(table(sections));

// sample-level checks: exact frame count, silent ends, and that the chain did not shift time
function readPcm24(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  let fmt = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(off + 10), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') return { b, fmt, data: off + 8, bytes: Math.min(size, b.length - off - 8) };
    off += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}
const pcm = readPcm24(finalPath);
const frames = pcm.bytes / (pcm.fmt.ch * 3);
const sampleAt = (w, i, c) => w.b.readIntLE(w.data + (i * w.fmt.ch + c) * 3, 3) / 8388608;
// premix is float32: read it through ffmpeg into a raw mono buffer for the lag check
const rawMono = (file, start, dur) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-ss', String(start), '-t', String(dur), '-i', file, '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength));
};
const lagOf = (a, b, maxLag) => {
  let best = 0;
  let bestV = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = maxLag; i < a.length - maxLag; i++) s += a[i] * b[i + lag];
    if (s > bestV) { bestV = s; best = lag; }
  }
  return best;
};
const lagStart = cues.sections.find((s) => s.id === 'run').start + 0.5;
const syncLagSamples = lagOf(rawMono(premix, lagStart, 1.0), rawMono(finalPath, lagStart, 1.0), 240);
const firstZero = sampleAt(pcm, 0, 0) === 0 && sampleAt(pcm, 0, 1) === 0;
const lastZero = sampleAt(pcm, frames - 1, 0) === 0 && sampleAt(pcm, frames - 1, 1) === 0;

const checks = {
  frames,
  expectedFrames: FRAMES,
  sampleRate: Number(st.sample_rate),
  channels: st.channels,
  bits: pcm.fmt.bits,
  durationSeconds: Number(probe.format.duration),
  firstSampleZero: firstZero,
  lastSampleZero: lastZero,
  syncLagSamples,
  loudnormMode: pass2.normalization_type,
};
console.log(JSON.stringify(checks));
assert.equal(frames, FRAMES, 'frame count');
assert.equal(st.sample_rate, String(SR));
assert.equal(st.channels, 2);
assert.equal(pcm.fmt.bits, 24);
assert.ok(Math.abs(finalEbu.I - master.targetLufs) <= 0.5, `integrated ${finalEbu.I} not within ±0.5 of ${master.targetLufs}`);
assert.ok(finalEbu.TP <= master.truePeakDb + 1e-9, `true peak ${finalEbu.TP} above ${master.truePeakDb}`);
assert.equal(syncLagSamples, 0, 'mastering chain shifted time');
assert.ok(firstZero && lastZero, 'ends must be digital silence');

// ---- 4. spectrum pictures (listening aids) -------------------------------------------------------
fs.mkdirSync(path.join(here, 'analysis'), { recursive: true });
const spec = (inFile, outName, extra = '') => ffmpeg(['-y', '-i', inFile, '-lavfi', `${extra}showspectrumpic=s=1400x560:legend=1:fscale=log:scale=log:color=intensity:gain=2`, path.join(here, 'analysis', outName)]);
spec(finalPath, 'mix-spectrum.png');
for (const s of ['bed', 'birds']) spec(stemPath(s), `${s}-spectrum.png`);
const stemLoudness = {};
for (const s of STEMS) {
  const e = ebur128(stemPath(s));
  stemLoudness[s] = { rawI: e.I, rawTP: e.TP, mixDb: mixDb[s], sections: sectionStats(e.frames).map(({ id, M_mean }) => ({ id, M_mean })) };
}

// ---- 5. provenance + README -----------------------------------------------------------------------
const provPath = path.join(here, 'provenance.json');
const provenance = JSON.parse(fs.readFileSync(provPath, 'utf8'));
for (const s of STEMS) assert.equal(sha256(fs.readFileSync(stemPath(s))), provenance.renders[s].sha256, `stem ${s} changed since render`);
for (const [file, expected] of Object.entries(provenance.sources)) assert.equal(sha256(fs.readFileSync(path.join(provenance.sourceRoot, file), 'utf8')), expected, `source changed since render: ${file}`);
const finalBytes = fs.readFileSync(finalPath);
provenance.scripts['finish-audio.mjs'] = sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
provenance.final = {
  file: finalName,
  sha256: sha256(finalBytes),
  bytes: finalBytes.length,
  mixDb,
  master,
  makeupIterations: iterations,
  sumMeasurement: measureSum,
  premixMeasurement: pass1,
  loudnormPass2: pass2,
  pass2Filter,
  measured: { integratedLufs: finalEbu.I, lraLu: finalEbu.LRA, truePeakDbtp: finalEbu.TP },
  sections,
  stemLoudness,
  checks,
  format: probe,
};
fs.writeFileSync(provPath, JSON.stringify(provenance, null, 2) + '\n');
fs.rmSync(premix, { force: true });

const secRows = sections.map((s) => `| ${s.id} | ${s.start.toFixed(2)}–${s.end.toFixed(2)} | ${s.M_mean} | ${s.M_max} | ${s.S_max} |`).join('\n');
const renders = provenance.renders;
fs.writeFileSync(
  path.join(here, 'README.md'),
  `# Kokiri Forest cinematic — soundtrack (opus-cinematic-sept24)

Final mix: **${finalName}** — ${duration.toFixed(3)} s, ${frames.toLocaleString('en-US')} frames, 48 kHz stereo PCM 24-bit.
Measured (ffmpeg ebur128): **I ${finalEbu.I} LUFS**, **LRA ${finalEbu.LRA} LU**, **true peak ${finalEbu.TP} dBTP**. loudnorm pass 2 ran in \`${pass2.normalization_type}\` mode.
Both ends are digital silence (de-click fade-in ${fadeIn} s, fade-out ${fo.start}–${duration} s). Mastering chain is time-aligned (lag ${syncLagSamples} samples).
**Mux the WAV with no volume change** (e.g. \`-map <n>:a -c:a aac -b:a 256k -ar 48000\`); AAC may add ~0.5 dB of true peak, which the -1.5 dBTP target leaves room for.

## Stems (\`stems/\`, 48 kHz stereo 24-bit, raw render level, unfaded)
| stem | contents | peak |
|---|---|---|
| bed.wav | game wind bed (canopy roll + leaf hush, designed gust) + new high-canopy air, canopy body, near-leaf shimmer, deep room tone, far air, gust-coupled leaf-rustle grains | ${renders.bed?.peakDb} dBFS |
| birds.wav | ${'' + (renders.birds ? 'placed species calls + seeded far chorus in an original forest reverb' : '')} | ${renders.birds?.peakDb} dBFS |
| detail.wav | pod-lantern flame (breath, husk, crackle/pops) on the lantern shot; macro leaf ticks | ${renders.detail?.peakDb} dBFS |
| steps.wav | game footstep voices (stone walk/run, stair slab + log riser) at the step times + cloth/gear foley on run/stairs | ${renders.steps?.peakDb} dBFS |
| music.wav | "Under the Boughs" (repo original score) trimmed so phrase B's high G lands at ${cues.musicHit} s, gain/low-pass rise + original harp glissando, swell, low bloom | ${renders.music?.peakDb} dBFS |

Mix gains (dB, \`cues.json\` \`mixDb\`): ${STEMS.map((s) => `${s} ${mixDb[s]}`).join(', ')}; makeup ${iterations.at(-1).makeupDb} dB; limiter ceiling ${master.limiterCeilingDb} dBFS.

## Loudness per section (final mix, LUFS)
M = momentary (400 ms), S = short-term (3 s, so short sections include the previous shot).

| section | edit s | M mean | M max | S max |
|---|---|---|---|---|
${secRows}

## Re-render
From \`${path.relative(provenance.sourceRoot, here).split(path.sep).join('/')}\` (Node 22, this checkout's node_modules, Chrome at C:/Program Files/Google/Chrome, ffmpeg 8 on PATH):

\`\`\`
node render-audio.mjs                                   # placeholder steps, cues.json
node render-audio.mjs --steps <capture-log.json>        # real contacts (rising edge of stance per foot)
node render-audio.mjs --cues <locked-cues.json> --steps <capture-log.json>
node finish-audio.mjs [--cues <same cues file>]         # mix + master + verify + provenance + README
node finish-audio.mjs --analyze-stems                   # per-section loudness of the raw stems
\`\`\`

Step log: a JSON array (or \`{rows|samples|ticks|frames:[...]}\`) of 60 Hz rows. Time per row from \`editTime\`/\`edit\`/\`t\`/\`time\`, else \`tick\`/\`frame\` ÷ \`--log-fps\` (60) + \`--log-start\`. Feet from \`feet\` / \`linkFeetContact\` / \`feetContact\` (\`[{foot:'L'|'R', stance}]\`) or \`stance: [bool,bool]\`; gait from \`gait\`/\`linkGait\` (walk/run/idle; the stairs section forces stair steps); optional \`surface\` per row or foot. The first tick of the log and of each new \`shot\` only arms the detector; edges closer than ${cues.steps?.minGap ?? 0.16} s are dropped. The resolved list is written to \`steps-resolved.json\`.

Cue file: \`sections\` (hero, lantern, macro, canopy, walk, run, stairs, reveal) in edit seconds; every gust swell, bird placement, lantern window, tick cluster, music rise and the hit (\`musicHit\`, default the reveal start) follows them. \`levels\` and \`mixDb\` hold the balance; \`master\` the loudness targets.

## Provenance and policy
All sound is original synthesis in code: no recordings, samples, downloads or voices. The game modules \`src/audio/{graph,ambience,footsteps,music}.ts\` and \`src/world/util/prng.ts\` are transpiled unchanged (sha256 in provenance.json; finish-audio re-checks them). New synthesis lives in \`synth/cine.js\`. Seeds, cue/step-log hashes, stem hashes, per-stem and per-section loudness are in provenance.json; bird placements in birds-calls.json. Spectrograms: \`analysis/\`.
`,
);
console.log(`\nwrote ${finalName} (${finalBytes.length} bytes), provenance.json, README.md`);
