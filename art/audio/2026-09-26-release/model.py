#!/usr/bin/env python3
"""model.py -- does the compressor pump at the step rate, and what release would stop it?

    python3 art/audio/2026-09-26-release/model.py --takes /tmp/limiter

`2026-09-26-limiter` left one thing open: with the compressor in, at a run, the step rate still
stands 4.4 dB over the music's beat -- the owner's "the music kind of still shakes whenever I run",
reduced from 7.6 and not removed. The first candidate named was the release.

120 ms is a time constant, so the gain takes about 3x that -- 360 ms -- to recover. At a run the
steps are 272 ms apart. The gain is therefore never settled between steps: it is pulled down by
each one and still climbing when the next arrives, which is a gain that MOVES at the step rate, and
a gain that moves at the step rate puts energy at the step rate. The compressor would then be adding
to the very line it is there to remove.

This models the node rather than rendering it, so a dozen release values cost a second instead of a
browser each. The model is the WebAudio spec's own: a soft knee of `knee` dB centred on `threshold`,
ratio `ratio`, and a gain that follows the detected level with one-pole attack and release. Its own
fidelity is checked against the rendered pair -- the take with the compressor on is the answer the
model has to reproduce at 120 ms before any other value is worth reading.
"""
import argparse
import json
import math
import os
import wave

import numpy as np

THRESHOLD, KNEE, RATIO, ATTACK = -30.0, 12.0, 4.0, 0.003
BEAT_HZ = 1.2
STEP_HZ = 2.2 / 0.60


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def curve(db):
    """the compressor's static curve, soft knee, in dB out for dB in"""
    out = np.array(db, dtype=float)
    lo, hi = THRESHOLD - KNEE / 2, THRESHOLD + KNEE / 2
    inside = (out > lo) & (out <= hi)
    over = out > hi
    d = out[inside] - lo
    out[inside] = out[inside] + (1 / RATIO - 1) * d * d / (2 * KNEE)
    out[over] = THRESHOLD + (out[over] - THRESHOLD) / RATIO
    return out


def compress(x, rate, release):
    """the node's gain over time, and the signal it would produce"""
    env = np.abs(x)
    db = 20 * np.log10(np.maximum(env, 1e-9))
    want = curve(db) - db
    ka = 1 - math.exp(-1 / (ATTACK * rate))
    kr = 1 - math.exp(-1 / (release * rate))
    g = np.zeros_like(want)
    cur = 0.0
    for i, w in enumerate(want):
        cur += (w - cur) * (ka if w < cur else kr)
        g[i] = cur
    return x * (10 ** (g / 20)), g


def env_spectrum(x, rate, lead):
    x = x[int(lead * rate) :]
    e = np.abs(x)
    k = int(rate / 200)
    e = e[: len(e) // k * k].reshape(-1, k).mean(axis=1)
    e = e - e.mean()
    n = 1 << int(np.floor(np.log2(len(e))))
    return np.abs(np.fft.rfft(e[:n] * np.hanning(n))) ** 2, np.fft.rfftfreq(n, k / rate)


def line(spec, f, hz, half=0.25, lo=0.4, hi=8.0):
    near = (f >= hz - half) & (f <= hz + half)
    around = (f >= lo) & (f <= hi)
    return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[around])), 1e-30))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/limiter')
ap.add_argument('--releases', default='0.06,0.12,0.25,0.4,0.6,1.0')
a = ap.parse_args()

lead = json.load(open(os.path.join(a.takes, 'takes.json')))['lead']
steps, rate = read(os.path.join(a.takes, 'run-steps-off.wav'))
mix_off, _ = read(os.path.join(a.takes, 'run-mix-off.wav'))
mix_on, _ = read(os.path.join(a.takes, 'run-mix-on.wav'))
k = min(len(steps), len(mix_off))
rest = mix_off[:k] - steps[:k]

# The node applies a makeup gain that is not documented as a number, and SFX_TRIM takes it back;
# neither is in the curve above. Rather than guess them, every modelled take is scaled to the rms of
# the RENDERED compressed stem, so the model answers only the question it can answer — what the
# SHAPE of the gain movement does — with the level held at what the graph actually produces.
steps_on, _ = read(os.path.join(a.takes, 'run-steps-on.wav'))
target = math.sqrt(float((steps_on[int(lead * rate) : k] ** 2).mean()))


def at(release):
    made, g = compress(steps[:k], rate, release)
    seg = made[int(lead * rate) :]
    rms = math.sqrt(float((seg**2).mean())) or 1.0
    return made * (target / rms), g


# the model has to reproduce the rendered take at the shipped release before anything else is read
made, g120 = at(0.12)
s, f = env_spectrum(made + rest, rate, lead)
sr, fr = env_spectrum(mix_on[:k], rate, lead)
print('the model against the render, at the shipped 120 ms release:')
print(f'   modelled step line {line(s, f, STEP_HZ):.1f} dB over background, rendered {line(sr, fr, STEP_HZ):.1f} dB')
print(f'   modelled beat line {line(s, f, BEAT_HZ):.1f} dB, rendered {line(sr, fr, BEAT_HZ):.1f} dB\n')

print(f"{'release':>8} {'recovers in':>12} {'gain moves':>11}   {'step line':>10} {'beat line':>10} {'step over beat':>15}")
for r in [float(v) for v in a.releases.split(',')]:
    made, g = at(r)
    s, f = env_spectrum(made + rest, rate, lead)
    st, bt = line(s, f, STEP_HZ), line(s, f, BEAT_HZ)
    gg = g[int(lead * rate) :]
    print(f'{r * 1000:>6.0f} ms {r * 3000:>9.0f} ms {gg.max() - gg.min():>9.1f} dB   {st:>7.1f} dB {bt:>9.1f} dB {st - bt:>+12.1f} dB')
print(f'\nsteps are {1000 / STEP_HZ:.0f} ms apart at a run; a release recovers in about three time constants')

# ---- and the lever that is left: how much quieter would the steps have to be? ------------------
#
# Approximate, and kept here to show by how much. The model compresses the whole steps stem, tails
# included, but in the graph the hall and the room are taken off the panner and bypass the
# compressor AND the trim -- so a cut moves less of the signal than this thinks it does. Compare
# `price.py`, which splits the dry from the tail and is therefore exact: it puts a 3 dB cut at
# -0.2 dB rather than the -1.5 below. That 1.3 dB is the whole reason the number that shipped was
# priced from a rendered dry stem instead of from here.
print('\nthe release is not a lever. Making the steps quieter is, and this is roughly its exchange rate:')
print(f"{'steps':>8}   {'step line':>10} {'beat line':>10} {'step over beat':>15}")
for cut in (0, 1, 2, 3, 4, 6, 9):
    made, _ = at(0.12)
    s2, f2 = env_spectrum(made * (10 ** (-cut / 20)) + rest, rate, lead)
    st, bt = line(s2, f2, STEP_HZ), line(s2, f2, BEAT_HZ)
    print(f'{-cut:>6} dB   {st:>7.1f} dB {bt:>9.1f} dB {st - bt:>+12.1f} dB')
print('\n(the bed is in `rest` as well as the music, so the beat line moves a little as the steps do;')
print(" what matters is the last column, which is the owner's sentence as a number -- and for that")
print(' column, read price.py rather than this one.)')
