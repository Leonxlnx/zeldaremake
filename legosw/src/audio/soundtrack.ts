import type { Vector3 } from 'three';
import type { Shot } from '../film/shots';
import { Biquad, CR, SR, SVF, Stereo, clamp, convolveStereo, db, eqStereo, hallIR, smoothstep, yieldTick } from './dsp';
import { findTake, loadDialogue, placeDialogue, type PlacedTake, type Take } from './dialogue';
import { encodeWav, loudness, master } from './master';
import { renderScore, type CueShot, type Hit } from './score';
import { renderSfx } from './sfx';
import { renderVoices, speechSpan, type VoiceLine, type VoiceSpan } from './voice';

/**
 * The whole soundtrack, rendered offline in plain JS — no WebAudio graph: an original orchestral score
 * cued to the shots (score.ts, instruments.ts), sound design keyed to the picture and the fx event
 * lists (sfx.ts), the spoken lines under the subtitles (stock-TTS recordings, dialogue.ts; the
 * synthetic voice.ts only stands in for a line with no recording), two generated reverbs, dialogue
 * ducking, and a master chain for phones and headphones (master.ts).
 */

export interface AudioInputs {
  shots: Shot[];
  duration: number;
  camAt: (T: number) => Vector3;
  lasers: { t0: number; from: Vector3; color: string; length: number }[];
  explosions: { t0: number; pos: Vector3; size: number; pieces: number }[];
}

/** stem levels, reverb returns and dialogue ducking */
const MIX = {
  music: 1.0,
  sfx: 2.0,
  voice: 2.2,
  hall: 0.8,
  space: 0.6,
  /** under each line the bed (music + effects) ducks until it sits snr LU below the voice, within [duckMin, duckMax] dB */
  snr: 10,
  duckMin: 5,
  duckMax: 16,
  /** effects duck this many dB less than the music */
  sfxLess: 1.5,
  /** extra cut of the music around 2 kHz while someone speaks (0..1) */
  dip: 0.45,
  target: -14,
  ceiling: -1.5,
};

export interface Stems {
  music: Stereo;
  sfx: Stereo;
  voice: Float32Array;
  spans: VoiceSpan[];
  /** dB of ducking under each span */
  ducks: number[];
}

/** mix a fraction of each side into the other so hard-panned sources still fill the reverb */
function crossfeed(s: Stereo, x: number): void {
  const a = 1 - x;
  for (let i = 0; i < s.n; i++) {
    const l = s.L[i], r = s.R[i];
    s.L[i] = a * l + x * r;
    s.R[i] = a * r + x * l;
  }
}

/**
 * How many dB the music must drop under each span for the voice to sit MIX.snr LU above the bed. The
 * effects drop sfxLess dB less, so they are measured that much hotter.
 */
function duckDepths(spans: VoiceSpan[], music: Stereo, sfx: Stereo, voice: Float32Array): number[] {
  const gs = MIX.sfx * db(MIX.sfxLess);
  return spans.map((s) => {
    const i0 = Math.max(0, Math.floor(s.t0 * SR)), i1 = Math.min(voice.length, Math.ceil(s.t1 * SR));
    const len = Math.max(0, i1 - i0);
    const bL = new Float32Array(len), bR = new Float32Array(len), v = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      bL[i] = music.L[i0 + i] * MIX.music + sfx.L[i0 + i] * gs;
      bR[i] = music.R[i0 + i] * MIX.music + sfx.R[i0 + i] * gs;
      v[i] = voice[i0 + i] * MIX.voice;
    }
    const lb = loudness(bL, bR), lv = loudness(v, v);
    if (!Number.isFinite(lv) || !Number.isFinite(lb)) return MIX.duckMin;
    return clamp(lb - (lv - MIX.snr), MIX.duckMin, MIX.duckMax);
  });
}

/** [shape 0..1, depth dB] of the ducking at T: ramps in over 0.15 s before each line, releases over 0.35 s after */
function duckAt(spans: VoiceSpan[], depth: number[], T: number): [number, number] {
  let shape = 0, dB = 0;
  spans.forEach((s, k) => {
    let v = 0;
    if (T >= s.t0 && T <= s.t1) v = 1;
    else if (T < s.t0 && T > s.t0 - 0.15) v = smoothstep(s.t0 - 0.15, s.t0, T);
    else if (T > s.t1 && T < s.t1 + 0.35) v = 1 - smoothstep(s.t1, s.t1 + 0.35, T);
    shape = Math.max(shape, v);
    dB = Math.max(dB, v * depth[k]);
  });
  return [shape, dB];
}

export async function renderMix(inp: AudioInputs, o: { onStems?: (s: Stems) => void } = {}): Promise<{ out: Stereo; n: number; report: string[] }> {
  const report: string[] = [];
  let clock = performance.now();
  const lap = (what: string): void => {
    const now = performance.now();
    report.push(`${what}: ${((now - clock) / 1000).toFixed(1)} s`);
    clock = now;
  };
  const n = Math.ceil((inp.duration + 1) * SR);

  // dialogue is planned first so the score can place its stingers around the speech
  const takes = await loadDialogue().catch((e: unknown): Take[] => {
    console.error(`[audio] dialogue recordings unavailable (${e instanceof Error ? e.message : String(e)}): every line falls back to the synthetic voice`);
    return [];
  });
  const spoken: PlacedTake[] = [];
  const lines: VoiceLine[] = [];
  const shots: CueShot[] = inp.shots.map((s) => {
    const s0 = s.start ?? 0;
    const verb = /droids|landing|jump/.test(s.name) ? 0.16 : s.name.includes('cockpit') ? 0.03 : 0.07;
    const cueLines = (s.lines ?? []).map((l) => {
      const take = findTake(takes, s.name, l.text);
      let sp: VoiceSpan;
      if (take) {
        // a recording made for another shot keeps its lead on the subtitle
        const at = take.clip.shot === s.name ? s0 + take.clip.offset : s0 + l.t0 + 0.05 - take.clip.speech[0];
        spoken.push({ take, at, verb });
        sp = { t0: at + take.clip.speech[0], t1: at + take.clip.speech[1] };
      } else {
        if (takes.length) console.error(`[audio] no recording of ${s.name} "${l.text}": it falls back to the synthetic voice`);
        const vl: VoiceLine = { t0: s0 + l.t0, t1: s0 + l.t1, who: l.who, text: l.text, verb };
        lines.push(vl);
        sp = speechSpan(vl) ?? { t0: vl.t0, t1: vl.t1 };
      }
      return { t0: l.t0, t1: l.t1, s0: sp.t0 - s0, s1: sp.t1 - s0, who: l.who };
    });
    return { name: s.name, start: s0, dur: s.dur, lines: cueLines };
  });
  const hits: Hit[] = [];
  for (const e of inp.explosions) {
    if (e.t0 > inp.duration) continue;
    const d = inp.camAt(e.t0).distanceTo(e.pos);
    const loud = Math.min(1, (e.size * 7) / Math.max(1, d));
    if (loud >= 0.02) hits.push({ t: e.t0 + Math.min(0.25, d / 20000), loud, size: e.size });
  }

  // score, through a generated concert hall
  const music = new Stereo(n), send = new Stereo(n);
  report.push(...(await renderScore(shots, hits, music, send)));
  lap('score');
  crossfeed(send, 0.3);
  const [hl, hr] = hallIR({ seconds: 2.8, rtLow: 2.4, rtMid: 2.0, rtHigh: 1.1, predelay: 0.02, er: 16, erSpan: 0.08, hp: 140, lp: 9000, seed: 3 });
  convolveStereo(send, hl, hr, music, MIX.hall);
  lap('hall reverb');
  await yieldTick();

  // effects and dialogue share a shorter, darker space
  send.clear();
  const sfx = new Stereo(n);
  report.push(...renderSfx(inp, sfx, send).log);
  eqStereo(sfx, () => [Biquad.highpass(45, 0.5412), Biquad.highpass(45, 1.3066), Biquad.lowshelf(120, -3, 0.8)]);
  lap('sfx');
  const voice = new Float32Array(n);
  const rec = placeDialogue(spoken, voice, send);
  const spans = [...rec.spans, ...renderVoices(lines, voice, send)].sort((a, b) => a.t0 - b.t0);
  report.push(`dialogue: ${spoken.length} recorded, ${lines.length} synthetic`, ...rec.log);
  lap('dialogue');
  crossfeed(send, 0.3);
  const [sl, sr] = hallIR({ seconds: 1.6, rtLow: 1.4, rtMid: 1.2, rtHigh: 0.6, predelay: 0.012, er: 10, erSpan: 0.05, hp: 220, lp: 7000, seed: 5 });
  convolveStereo(send, sl, sr, sfx, MIX.space);
  lap('space reverb');
  await yieldTick();
  const ducks = duckDepths(spans, music, sfx, voice);
  o.onStems?.({ music, sfx, voice, spans, ducks });

  // duck music and effects under every line, and carve a little room around 2 kHz in the music
  const dipL = new SVF(2000, 0.9), dipR = new SVF(2000, 0.9);
  let [s0, d0] = duckAt(spans, ducks, 0);
  for (let b = 0; b < n; b += CR) {
    const [s1, d1] = duckAt(spans, ducks, (b + CR) / SR);
    const e = Math.min(n, b + CR);
    for (let i = b; i < e; i++) {
      const u = (i - b) / CR;
      const d = d0 + (d1 - d0) * u, sh = s0 + (s1 - s0) * u;
      const gm = MIX.music * db(-d), gs = MIX.sfx * db(-Math.max(0, d - MIX.sfxLess * sh)), dip = MIX.dip * sh;
      const ml = music.L[i], mr = music.R[i];
      const v = voice[i] * MIX.voice;
      music.L[i] = (ml - dip * dipL.bp(ml)) * gm + sfx.L[i] * gs + v;
      music.R[i] = (mr - dip * dipR.bp(mr)) * gm + sfx.R[i] * gs + v;
    }
    s0 = s1;
    d0 = d1;
  }
  lap('ducking');
  await yieldTick();
  report.push(`dialogue: ${spans.length} lines, bed ducked ${ducks.map((d) => d.toFixed(1)).join(' / ')} dB`);
  report.push(`pre-master mix: ${loudness(music.L, music.R).toFixed(1)} LUFS`);
  report.push(...(await master(music, sfx, { target: MIX.target, ceiling: MIX.ceiling, fadeFrom: Math.max(0, inp.duration - 0.45), fadeTo: inp.duration })));
  lap('master');
  return { out: music, n, report };
}

export async function renderSoundtrack(inp: AudioInputs): Promise<string> {
  const { out, n, report } = await renderMix(inp);
  for (const r of report) console.info(`[audio] ${r}`);
  return encodeWav(out, n);
}
