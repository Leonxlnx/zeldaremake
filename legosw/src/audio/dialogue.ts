import { Biquad, CR, SR, db, type Stereo } from './dsp';
import type { VoiceSpan } from './voice';

/**
 * Spoken dialogue: one stock-TTS recording per subtitle line (public/audio/dialogue, made by
 * scripts/tts/make_dialogue.py), placed in its shot from lines.json and run through a light dialogue
 * chain — rumble cut, a little presence, gentle compression — to a common speech level.
 */

export interface DialogueClip {
  id: string;
  file: string;
  shot: string;
  who: string;
  text: string;
  /** shot-relative time of the clip's first sample, seconds */
  offset: number;
  /** speech onset and offset inside the clip, seconds */
  speech: [number, number];
}

export interface Take {
  clip: DialogueClip;
  pcm: Float32Array;
}

export interface PlacedTake {
  take: Take;
  /** film time of the clip's first sample */
  at: number;
  /** reverb send (0 = bone dry) */
  verb: number;
}

const DIR = 'audio/dialogue/';

/** the words of a line, so a punctuation edit to a subtitle still finds its recording */
export const words = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** 16-bit PCM WAV (any channel count, any rate) → mono float at SR */
export function decodeWav(buf: ArrayBuffer): Float32Array {
  const v = new DataView(buf);
  const tag = (o: number): string => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (v.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let ch = 0, rate = 0, bits = 0, format = 0;
  for (let o = 12; o + 8 <= v.byteLength; ) {
    const id = tag(o), size = v.getUint32(o + 4, true), body = o + 8;
    if (id === 'fmt ') {
      format = v.getUint16(body, true);
      ch = v.getUint16(body + 2, true);
      rate = v.getUint32(body + 4, true);
      bits = v.getUint16(body + 14, true);
    } else if (id === 'data') {
      if ((format !== 1 && format !== 0xfffe) || bits !== 16 || ch < 1) throw new Error(`unsupported WAV (format ${format}, ${bits} bit, ${ch} ch)`);
      const frames = Math.floor(Math.min(size, v.byteLength - body) / (2 * ch));
      const mono = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < ch; c++) s += v.getInt16(body + 2 * (i * ch + c), true);
        mono[i] = s / (32768 * ch);
      }
      if (rate === SR) return mono;
      const out = new Float32Array(Math.floor((frames * SR) / rate));
      for (let i = 0; i < out.length; i++) {
        const x = (i * rate) / SR, k = Math.floor(x), u = x - k;
        out[i] = mono[k] * (1 - u) + (mono[Math.min(frames - 1, k + 1)] ?? 0) * u;
      }
      return out;
    }
    o = body + size + (size & 1);
  }
  throw new Error('WAV has no data chunk');
}

/** fetch lines.json and every clip it lists, relative to the page, so the film plays from any sub-path */
export async function loadDialogue(base = document.baseURI): Promise<Take[]> {
  const url = (f: string): string => new URL(DIR + f, base).href;
  const res = await fetch(url('lines.json'));
  if (!res.ok) throw new Error(`lines.json: HTTP ${res.status}`);
  const index = (await res.json()) as { lines: DialogueClip[] };
  return Promise.all(
    index.lines.map(async (clip) => {
      const r = await fetch(url(clip.file));
      if (!r.ok) throw new Error(`${clip.file}: HTTP ${r.status}`);
      return { clip, pcm: decodeWav(await r.arrayBuffer()) };
    }),
  );
}

/** the recording of a subtitle line: the same words, preferably recorded for the same shot */
export function findTake(takes: Take[], shot: string, text: string): Take | undefined {
  const w = words(text);
  return takes.find((t) => t.clip.shot === shot && words(t.clip.text) === w) ?? takes.find((t) => words(t.clip.text) === w);
}

/** mean power of the 20 ms windows within 25 dB of the loudest, as RMS */
function activeRms(x: Float32Array): number {
  const win = Math.round(0.02 * SR);
  const pw: number[] = [];
  for (let a = 0; a + win <= x.length; a += win) {
    let e2 = 0;
    for (let i = a; i < a + win; i++) e2 += x[i] * x[i];
    pw.push(e2 / win);
  }
  const top = Math.max(0, ...pw);
  const act = pw.filter((p) => p > top * 0.00316);
  return Math.sqrt(act.reduce((s, p) => s + p, 0) / Math.max(1, act.length));
}

/** feed-forward RMS compressor (10 ms detector), soft knee, threshold in dBFS */
function compress(x: Float32Array, o: { thr: number; ratio: number; att: number; rel: number; knee: number }): number {
  const aA = Math.exp(-CR / (o.att * SR)), aR = Math.exp(-CR / (o.rel * SR)), aP = Math.exp(-CR / (0.01 * SR));
  const slope = 1 - 1 / o.ratio, k = o.knee;
  let pow = 0, gr = 0, gPrev = 1, maxGr = 0;
  for (let b = 0; b < x.length; b += CR) {
    const e = Math.min(x.length, b + CR);
    let acc = 0;
    for (let i = b; i < e; i++) acc += x[i] * x[i];
    pow = aP * pow + (1 - aP) * (acc / (e - b));
    const over = 10 * Math.log10(pow + 1e-12) - o.thr;
    const want = over <= -k / 2 ? 0 : over >= k / 2 ? over * slope : (slope * (over + k / 2) ** 2) / (2 * k);
    gr = want > gr ? aA * gr + (1 - aA) * want : aR * gr + (1 - aR) * want;
    maxGr = Math.max(maxGr, gr);
    const g = db(-gr);
    for (let i = b; i < e; i++) x[i] *= gPrev + (g - gPrev) * ((i - b + 1) / (e - b));
    gPrev = g;
  }
  return maxGr;
}

/** the dialogue chain for one recording; returns a copy at 0.12 active RMS, like the synthetic voice */
export function voiceChain(pcm: Float32Array): { data: Float32Array; gr: number } {
  const x = Float32Array.from(pcm);
  for (const f of [Biquad.highpass(100), Biquad.peak(260, 1.0, -1.5), Biquad.peak(3200, 0.9, 2.5), Biquad.highshelf(7500, 1, 0.8)]) f.run(x);
  const rms = activeRms(x);
  if (rms < 1e-7) return { data: x, gr: 0 };
  const gr = compress(x, { thr: 20 * Math.log10(rms) + 3, ratio: 2.5, att: 0.005, rel: 0.08, knee: 6 });
  const g = 0.12 / activeRms(x);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return { data: x, gr };
}

/** mix every placed recording into a mono buffer (plus the reverb send); returns where speech sounds */
export function placeDialogue(placed: PlacedTake[], out: Float32Array, send?: Stereo): { spans: VoiceSpan[]; log: string[] } {
  const spans: VoiceSpan[] = [];
  const log: string[] = [];
  for (const p of placed) {
    const { data, gr } = voiceChain(p.take.pcm);
    const i0 = Math.round(p.at * SR);
    for (let k = 0; k < data.length; k++) {
      const i = i0 + k;
      if (i < 0 || i >= out.length) continue;
      out[i] += data[k];
      if (send && p.verb > 0) {
        send.L[i] += data[k] * p.verb;
        send.R[i] += data[k] * p.verb;
      }
    }
    const [a, b] = p.take.clip.speech;
    spans.push({ t0: p.at + a, t1: p.at + b });
    log.push(`${p.take.clip.id} @ ${(p.at + a).toFixed(2)}-${(p.at + b).toFixed(2)} s (compressor ${gr.toFixed(1)} dB)`);
  }
  return { spans, log };
}
