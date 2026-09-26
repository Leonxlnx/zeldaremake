#!/usr/bin/env python3
"""after.py -- the shipped graph either side of swapping the compressor for a gain.

    python3 art/audio/2026-09-26-pad/after.py --before /tmp/pad --after /tmp/pad-after

`pad.py` priced the swap from one set of takes, by arithmetic on the bypassed path. This renders
the graph as it now is and checks that it landed where the pricing said, on the three numbers the
swap was made for and the one it was allowed to cost.

  the rhythm     how far the step rate stands over the music's beat -- the owner's sentence
  the gait gap   how far a run peaks over a walk, which is what the compressor was charging for
  the crest      peak over rms inside a step: a boot landing, or a boot being turned down as it
                 lands
  the level      how loud a step is, which a pad spends and a compressor also spent
"""
import argparse
import json
import math
import os
import wave

import numpy as np

BEAT_HZ = 1.2
STRIDE = {'walk': 0.44, 'run': 0.60}
SPEED = {'walk': 1.2, 'run': 2.2}


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def env_spectrum(x, rate, lead):
    x = x[int(lead * rate) :]
    env = np.abs(x)
    k = int(rate / 200)
    env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
    env = env - env.mean()
    n = 1 << int(np.floor(np.log2(len(env))))
    return np.abs(np.fft.rfft(env[:n] * np.hanning(n))) ** 2, np.fft.rfftfreq(n, k / rate)


def line(spec, f, hz, half=0.25, lo=0.4, hi=8.0):
    near = (f >= hz - half) & (f <= hz + half)
    around = (f >= lo) & (f <= hi)
    return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[around])), 1e-30))


def envelope(x, rate, win=0.004):
    n = max(2, int(win * rate))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def onsets(x, rate, min_gap=0.15):
    e = envelope(x, rate)
    d = np.diff(e, prepend=e[0])
    thr = np.percentile(d, 99.0)
    gap = int(min_gap * rate)
    out, i = [], 0
    while i < len(d):
        if d[i] > thr:
            j = min(len(e), i + int(0.02 * rate))
            out.append(int(i + np.argmax(e[i:j])) if j > i else i)
            i += gap
        else:
            i += 1
    return np.array(out)


def step_shape(steps, rate, lead):
    x = steps[int(lead * rate) :]
    n = int(0.04 * rate)
    peaks, crests = [], []
    for i in onsets(x, rate):
        seg = x[i : i + n]
        if len(seg) < n:
            continue
        pk = float(np.abs(seg).max())
        peaks.append(pk)
        crests.append(db(pk) - db(float(np.sqrt((seg**2).mean())) or 1e-12))
    return db(np.median(peaks)), float(np.median(crests))


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/pad')
ap.add_argument('--after', default='/tmp/pad-after')
a = ap.parse_args()

lead = json.load(open(os.path.join(a.before, 'takes.json')))['lead']
sides = (('compressor', a.before), ('a plain pad', a.after))

print('the shipped graph, rendered both ways\n')
print(f"{'gait':6} {'':13}   {'step over beat':>15} {'step peak':>10} {'crest':>8}")
peak = {}
for gait in ('run', 'walk'):
    for name, d in sides:
        mix, rate = read(os.path.join(d, f'{gait}-mix-on.wav'))
        steps, _ = read(os.path.join(d, f'{gait}-steps-on.wav'))
        spec, f = env_spectrum(mix, rate, lead)
        over = line(spec, f, SPEED[gait] / STRIDE[gait]) - line(spec, f, BEAT_HZ)
        pk, crest = step_shape(steps, rate, lead)
        peak[(gait, name)] = pk
        verdict = 'OVER the music' if over > 0 else 'under the music'
        print(f'{gait:6} {name:>13}   {over:>+12.1f} dB {pk:>7.1f} dB {crest:>5.1f} dB   {verdict}')
    print()

print('the gait gap -- what the compressor was charging for\n')
for name, _ in sides:
    print(f"   {name:>13}   a run peaks {peak[('run', name)] - peak[('walk', name)]:+.2f} dB over a walk")

print('\nthe control -- the bypassed takes never see the output stage, so these must not move\n')
for gait in ('run', 'walk'):
    for stem in ('mix', 'steps'):
        x0, r0 = read(os.path.join(a.before, f'{gait}-{stem}-off.wav'))
        x1, _ = read(os.path.join(a.after, f'{gait}-{stem}-off.wav'))
        n = min(len(x0), len(x1))
        d = db(np.sqrt(((x0[:n] - x1[:n]) ** 2).mean())) - db(np.sqrt((x0[:n] ** 2).mean()))
        # two renders of identical code differ by about -108 dB; a real change shows at -15
        print(f"   {gait}-{stem}-off {d:>9.1f} dB   {'the render floor: unmoved' if d < -80 else 'MOVED'}")
