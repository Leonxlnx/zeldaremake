#!/usr/bin/env python3
"""
Spoken dialogue for the film: every subtitle line of src/film/shots.ts read by a stock Kokoro-82M voice
(v1.0 weights, Apache-2.0, through kokoro-onnx), fitted to its shot, trimmed to the speech, resampled
to 44.1 kHz mono 16-bit, and listed with its placement in lines.json. src/audio/dialogue.ts places the
clips at render time; the soundtrack mixes, ducks and masters them with everything else.

Only the stock voicepacks are used, as they ship; no voice is cloned from or styled after an actor.
The battle droid is a stock voice run through a pitch/formant shift, a nasal band-pass and a light
ring-modulated buzz.

    python3 -m pip install --user kokoro-onnx soundfile numpy
    # kokoro-v1.0.onnx + voices-v1.0.bin: github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
    python3 legosw/scripts/tts/make_dialogue.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin [--only id,id]

ONNX inference is not bit-exact across machines, so the WAVs in public/audio/dialogue are the source of
truth for renders; rerun this only to change a read, and check it with an ASR pass afterwards.
"""
import argparse
import json
import os

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, '../../public/audio/dialogue'))
SR_TTS = 24000
SR_OUT = 44100
MAX_SPEED = 1.6
FIT_TOL = 0.005

CAST = {
    # youthful, confident: the highest and most animated of the best-rated American male voices
    'Anakin Skywalker': dict(voice='am_fenrir', lang='en-us'),
    # composed, dry: the best-rated British male voice (bm_lewis is lower, but loses the plural of "Buzz droids")
    'Obi-Wan Kenobi': dict(voice='bm_george', lang='en-gb'),
    'Battle Droid': dict(voice='am_puck', lang='en-us', fx='droid'),
}

# `say` is what the voice reads (the subtitle's words; punctuation steers the phrasing), split into
# phrases joined by `gap` seconds of silence; a phrase given as (text, k) is read at k times the line's
# speed. Speech starts at `at` (shot-relative seconds) and must be over by `end`; a read that runs long
# is sped up (to max_speed) until it fits.
LINES = [
    dict(id='anakin-fun', shot='anakin-cockpit', who='Anakin Skywalker', text='This is where the fun begins.',
         say=['This is where the fun begins.'], speed=1.0, at=1.05, end=3.3),
    dict(id='anakin-command-ship', shot='hand-reveal', who='Anakin Skywalker',
         text="The General's command ship is dead ahead — the one crawling with vulture droids.",
         say=["The General's command ship is dead ahead,", 'the one crawling with vulture droids.'], gap=0.14, speed=1.12, at=0.45, end=4.25),
    dict(id='obiwan-bad-feeling', shot='obiwan-cockpit', who='Obi-Wan Kenobi', text='Oh, I have a bad feeling about this.',
         say=['Oh, I have a bad feeling about this.'], speed=0.95, at=0.55, end=3.1),
    dict(id='obiwan-buzz-droids', shot='missiles', who='Obi-Wan Kenobi', text='Buzz droids!',
         say=['Buzz droids!'], speed=1.0, at=2.35, end=3.8),
    dict(id='obiwan-get-out', shot='obiwan-cockpit-2', who='Obi-Wan Kenobi', text="Get out of here, Anakin! There's nothing more you can do.",
         # the natural urgent read (~3.4 s) is longer than the 2.6 s shot: it starts 0.95 s before the cut, over buzz-close
         say=["Get out of here, Anakin! There's nothing more you can do."], speed=1.06, max_speed=1.12, at=-0.95, end=2.45),
    dict(id='anakin-not-leaving', shot='anakin-cockpit-2', who='Anakin Skywalker', text="I'm not leaving without you, Master.",
         say=["I'm not leaving without you, Master."], speed=1.0, at=0.24, end=2.42),
    dict(id='obiwan-flying', shot='droids', who='Obi-Wan Kenobi', text='Flying is for droids.',
         say=['Flying is for droids.'], speed=0.95, at=0.36, end=2.15),
    dict(id='droid-uh-oh', shot='droids', who='Battle Droid', text='Uh oh.',
         say=['Uh, oh.'], speed=0.8, at=3.75, end=4.95),
]

# the droid read is played back this much faster: pitch and formants up ~4.5 semitones
DROID_SHIFT = 1.3


def resample(x, sr_in, sr_out, half=32, beta=8.6):
    """band-limited resampling by Kaiser-windowed sinc interpolation, any ratio"""
    ratio = sr_out / sr_in
    n_out = int(round(len(x) * ratio))
    fc = min(1.0, ratio) * 0.95
    t = np.arange(n_out) / ratio
    i0 = np.floor(t).astype(np.int64)
    frac = t - i0
    xp = np.concatenate([np.zeros(half), np.asarray(x, np.float64), np.zeros(half + 1)])
    y = np.zeros(n_out)
    for k in range(-half + 1, half + 1):
        u = k - frac
        w = np.i0(beta * np.sqrt(np.clip(1 - (u / half) ** 2, 0, 1))) / np.i0(beta)
        y += xp[i0 + k + half] * fc * np.sinc(fc * u) * w
    return y


def frame_rms(x, sr, frame=0.005):
    f = max(1, int(round(frame * sr)))
    n = len(x) // f
    return np.sqrt((x[: n * f].reshape(n, f) ** 2).mean(1)) + 1e-12, f


def bounds(x, sr, floor_db):
    """first and last sample of the frames within floor_db of the loudest 5 ms frame"""
    e, f = frame_rms(x, sr)
    idx = np.nonzero(e > e.max() * 10 ** (floor_db / 20))[0]
    return int(idx[0] * f), int(min(len(x), (idx[-1] + 1) * f))


def trim(x, sr, pre=0.012, post=0.05, floor_db=-50.0):
    a, b = bounds(x, sr, floor_db)
    y = np.array(x[max(0, a - int(pre * sr)): min(len(x), b + int(post * sr))], np.float64)
    fi, fo = int(0.003 * sr), int(0.03 * sr)
    y[:fi] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi)
    y[-fo:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(fo) / fo)
    return y


def segments(x, sr, floor_db=-35.0, min_gap=0.15):
    """spoken runs (seconds) separated by pauses of at least min_gap"""
    e, f = frame_rms(x, sr)
    on = e > e.max() * 10 ** (floor_db / 20)
    runs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append([start, i])
            start = None
    if start is not None:
        runs.append([start, len(on)])
    merged = []
    for r in runs:
        if merged and (r[0] - merged[-1][1]) * f / sr < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [[round(a * f / sr, 3), round(b * f / sr, 3)] for a, b in merged]


def fft_eq(x, sr, gain_of_freq):
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + sr // 5)))
    f = np.fft.rfftfreq(N, 1 / sr)
    return np.fft.irfft(np.fft.rfft(x, N) * gain_of_freq(f), N)[:n]


def droid(x, sr):
    x = resample(x, sr * DROID_SHIFT, sr)
    t = np.arange(len(x)) / sr
    # buzz: a light 62 Hz ring modulation and odd-harmonic saturation
    x = x * (0.72 + 0.28 * np.sin(2 * np.pi * 62 * t))
    pk = np.max(np.abs(x))
    x = np.tanh(2.2 * x / pk) / np.tanh(2.2) * pk
    # tinny: a 2.7 ms comb
    d = int(0.0027 * sr)
    y = x.copy()
    y[d:] += 0.3 * x[:-d]

    # nasal and band-limited: 4th-order 320 Hz-3.4 kHz band-pass, a resonance at 1.3 kHz, a dip at 650 Hz
    def g(f):
        hp = 1 / np.sqrt(1 + (320 / np.maximum(f, 1)) ** 8)
        lp = 1 / np.sqrt(1 + (f / 3400) ** 8)
        return hp * lp * (1 + 1.0 * np.exp(-0.5 * ((f - 1300) / 250) ** 2) - 0.45 * np.exp(-0.5 * ((f - 650) / 120) ** 2))

    return fft_eq(y, sr, g)


def level(y, sr, active_db=-18.0, peak_db=-1.0):
    """scale to an active speech level (mean power of the 20 ms frames within 25 dB of the loudest), peak-capped"""
    e, _ = frame_rms(y, sr, 0.02)
    act = e[e > e.max() * 10 ** (-25 / 20)]
    rms = np.sqrt(np.mean(act ** 2))
    g = min(10 ** (active_db / 20) / rms, 10 ** (peak_db / 20) / np.max(np.abs(y)))
    return y * g


def read(k, line, speed):
    cast = CAST[line['who']]
    parts = []
    for i, p in enumerate(line['say']):
        phrase, kk = (p, 1.0) if isinstance(p, str) else p
        a, sr = k.create(phrase, voice=cast['voice'], speed=min(2.0, round(speed * kk, 3)), lang=cast['lang'])
        assert sr == SR_TTS
        parts.append(trim(a, sr, pre=0.01, post=0.04))
        if i < len(line['say']) - 1:
            parts.append(np.zeros(int(line.get('gap', 0.12) * sr)))
    x = np.concatenate(parts)
    if cast.get('fx') == 'droid':
        x = droid(x, SR_TTS)
    y = trim(resample(x, SR_TTS, SR_OUT), SR_OUT, pre=0.015, post=0.06)
    return level(y, SR_OUT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='/tmp/tts/kokoro-v1.0.onnx')
    ap.add_argument('--voices', default='/tmp/tts/voices-v1.0.bin')
    ap.add_argument('--out', default=OUT_DIR)
    ap.add_argument('--only', default='')
    ap.add_argument('--threads', type=int, default=2)
    args = ap.parse_args()

    import onnxruntime as rt
    from kokoro_onnx import Kokoro

    so = rt.SessionOptions()
    so.intra_op_num_threads = args.threads
    so.inter_op_num_threads = 1
    k = Kokoro.from_session(rt.InferenceSession(args.model, sess_options=so, providers=['CPUExecutionProvider']), args.voices)

    os.makedirs(args.out, exist_ok=True)
    index_path = os.path.join(args.out, 'lines.json')
    old = {}
    if os.path.exists(index_path):
        old = {c['id']: c for c in json.load(open(index_path))['lines']}
    only = set(filter(None, args.only.split(',')))

    out = []
    for line in LINES:
        if only and line['id'] not in only and line['id'] in old:
            out.append(old[line['id']])
            continue
        speed, room, top = line['speed'], line['end'] - line['at'], line.get('max_speed', MAX_SPEED)
        for _ in range(6):
            y = read(k, line, speed)
            on, off = bounds(y, SR_OUT, -40.0)
            dur = (off - on) / SR_OUT
            if dur <= room + FIT_TOL or speed >= top:
                break
            speed = min(top, round(speed * dur / room * 1.02, 3))
        sf.write(os.path.join(args.out, line['id'] + '.wav'), y.astype(np.float32), SR_OUT, subtype='PCM_16')
        cast = CAST[line['who']]
        speech = [round(on / SR_OUT, 3), round(off / SR_OUT, 3)]
        offset = round(line['at'] - speech[0], 3)
        entry = {
            'id': line['id'],
            'file': line['id'] + '.wav',
            'shot': line['shot'],
            'who': line['who'],
            'text': line['text'],
            'voice': cast['voice'],
            'lang': cast['lang'],
            'fx': cast.get('fx', ''),
            'say': line['say'],
            'gap': line.get('gap', 0.12) if len(line['say']) > 1 else 0,
            'speed': speed,
            'duration': round(len(y) / SR_OUT, 3),
            'offset': offset,
            'speech': speech,
            'segments': [[round(a + offset, 3), round(b + offset, 3)] for a, b in segments(y, SR_OUT)],
            'mouth': [round(offset + speech[0], 3), round(offset + speech[1], 3)],
        }
        fits = entry['mouth'][1] <= line['end'] + FIT_TOL
        print(f"{line['id']:<22} {cast['voice']:<10} speed {speed:<5} clip {entry['duration']:.2f}s  speech {entry['mouth'][0]:.2f}-{entry['mouth'][1]:.2f} of [{line['at']}, {line['end']}] {'ok' if fits else 'LONG'}", flush=True)
        out.append(entry)

    index = {
        'generator': 'legosw/scripts/tts/make_dialogue.py',
        'engine': 'Kokoro-82M v1.0 via kokoro-onnx (Apache-2.0), stock voicepacks',
        'sampleRate': SR_OUT,
        'notes': 'offset: shot-relative time of the first sample; speech: onset/offset inside the clip (-40 dB); segments/mouth: shot-relative speech',
        'lines': out,
    }
    with open(index_path, 'w') as fh:
        json.dump(index, fh, indent=1, ensure_ascii=False)
        fh.write('\n')


if __name__ == '__main__':
    main()
