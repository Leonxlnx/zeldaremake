#!/usr/bin/env python3
"""gust.py -- the bed's twenty-six second correlation is not a random walk. It is arithmetic.

    python3 art/audio/2026-09-26-gust/gust.py --take /tmp/gust/after.wav

`2026-09-25-loop` found the bed repeating every nine seconds and fixed it, and closed on one thing
it could not account for:

    "The envelope autocorrelation is 0.261 before and 0.257 after, peaking near 26 s. That is not
     a loop: the control buffers are 47 s and there is no peak at 47. It is the natural correlation
     time of a slow random walk -- a gust takes tens of seconds to forget itself, which is what
     wind does."

Check 4 of the rubric -- *nothing in it is periodic: no LFO an ear can lock onto after a minute* --
is held at 3 for exactly that sentence, on the grounds that it is an assertion and not a
calculation.

It is a calculation, and the sentence is wrong. `uGust` has no randomness in it at all
(`src/world/wind/wind.ts`):

    g    = 0.5 + 0.5 * sin(0.37 t) * sin(0.11 t + 1.3)
    push = max(0, sin(0.23 t + 0.4)) ** 3
    uGust = min(1, 0.8 g + 0.6 push)

A product of two sines is a sum of two: sin(a)sin(b) = (cos(a-b) - cos(a+b)) / 2. So the first term
is not a slow wander, it is a **beat at 0.26 rad/s and another at 0.48** -- periods of 24.2 s and
13.1 s -- and the push is a cubed half-wave at 0.23 rad/s, 27.3 s, with harmonics of its own. The
whole thing is a deterministic function of `t`, identical in every session.

This prints those components, autocorrelates the gust itself, and autocorrelates the bed's own
envelope out of a long render, so the three can be put beside each other.
"""
import argparse
import math
import os
import wave

import numpy as np

# src/world/wind/wind.ts, update()
def gust(t):
    g = 0.5 + 0.5 * np.sin(t * 0.37) * np.sin(t * 0.11 + 1.3)
    push = np.maximum(0, np.sin(t * 0.23 + 0.4)) ** 3
    return np.minimum(1, g * 0.8 + push * 0.6)


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def autocorr(x, rate, max_lag_s):
    x = x - x.mean()
    n = len(x)
    k = int(max_lag_s * rate)
    f = np.fft.rfft(x, 2 * n)
    c = np.fft.irfft(f * np.conj(f), 2 * n)[: k + 1]
    return c / (c[0] or 1.0), np.arange(k + 1) / rate


def peaks(c, lags, lo_s=5.0):
    i0 = int(np.searchsorted(lags, lo_s))
    out = []
    for i in range(i0 + 1, len(c) - 1):
        if c[i] > c[i - 1] and c[i] >= c[i + 1] and c[i] > 0.05:
            out.append((float(lags[i]), float(c[i])))
    out.sort(key=lambda v: -v[1])
    return out[:5]


ap = argparse.ArgumentParser()
ap.add_argument('--take', default='/tmp/gust/after.wav')
ap.add_argument('--seconds', type=float, default=600.0)
a = ap.parse_args()

print('1. what the gust is made of\n')
print('   sin(0.37 t) * sin(0.11 t + 1.3)  =  half the difference of two cosines:')
for w in (0.37 - 0.11, 0.37 + 0.11):
    print(f'      {w:.2f} rad/s  ->  a period of {2 * math.pi / w:5.1f} s')
print(f'   max(0, sin(0.23 t + 0.4)) ** 3   ->  {2 * math.pi / 0.23:5.1f} s, and its harmonics')
print('\n   None of it is random. `uGust` is a function of the clock and nothing else, so two')
print('   sessions of this game have the same weather at the same second.')

# the gust sampled at its own rate, over the length of the render
rate = 50.0
t = np.arange(0, a.seconds, 1 / rate)
g = gust(t)
c, lags = autocorr(g, rate, 120)
print('\n2. the gust, autocorrelated against itself\n')
print(f"   {'lag':>8} {'r':>7}")
for lag, v in peaks(c, lags):
    print(f'   {lag:>6.1f} s {v:>7.3f}')

if not os.path.exists(a.take):
    raise SystemExit(f'\n(no bed take at {a.take}; run 2026-09-25-loop/repeat.mjs to make one)')

x, sr = read(a.take)
# the bed's loudness over time, decimated to the same 50 Hz the gust is sampled at
k = int(sr / rate)
env = np.abs(x)
env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
ce, le = autocorr(env, rate, 120)
print(f'\n3. the bed\u2019s own envelope, out of {len(env) / rate:.0f} s of standing render\n')
print(f"   {'lag':>8} {'r':>7}")
bed_peaks = peaks(ce, le)
for lag, v in bed_peaks:
    print(f'   {lag:>6.1f} s {v:>7.3f}')

print('\n4. beside each other\n')
gp = peaks(c, lags)
if gp and bed_peaks:
    print(f'   the gust\u2019s strongest slow peak   {gp[0][0]:5.1f} s   r = {gp[0][1]:.3f}')
    print(f'   the bed\u2019s strongest slow peak    {bed_peaks[0][0]:5.1f} s   r = {bed_peaks[0][1]:.3f}')
    print(f'   they are {abs(gp[0][0] - bed_peaks[0][0]):.1f} s apart')
print('\n   The bed follows the weather (rubric check 7, and it should). The weather repeats.')
