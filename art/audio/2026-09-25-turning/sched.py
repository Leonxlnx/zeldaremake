#!/usr/bin/env python3
"""sched.py -- what the twin was getting wrong by booking the whole take from its last frame.

    python3 art/audio/2026-09-25-turning/sched.py --old /tmp/spin-oldsched --new /tmp/spin

`renderOffline` used to call `scheduleUntil(seconds)` once after its loop had finished, so every
bird, leaf and note in it was booked with `gustNow`, `canopyNow`, `forwardNow` and `occludeNow` as
the last frame left them. It now tops the schedulers up from inside the loop on the live
lookaheads. The two files here are the same spot, the same seed and the same 120 seconds, and
differ in exactly that.

Reported per band: the always-on level -- the 10th percentile over time, which is the metric this
lane scores places on -- and the mean, so a change in the events shows up separately from a change
in the floor.
"""
import argparse
import os
import wave

import numpy as np

BANDS = [(20, 60), (60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    x = x.reshape(-1, ch).mean(axis=1) if ch > 1 else x
    return x, rate


def bands(x, rate, win=0.05):
    n = int(round(win * rate))
    n += n % 2
    w = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / rate)
    frames = 1 + max(0, len(x) - n) // n
    idx = np.arange(n)[None, :] + n * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2
    out = {}
    for lo, hi in BANDS:
        p = spec[:, (f >= lo) & (f < hi)].sum(axis=1)
        out[(lo, hi)] = (10 * np.log10(max(np.percentile(p, 10), 1e-20)), 10 * np.log10(max(p.mean(), 1e-20)))
    return out


ap = argparse.ArgumentParser()
ap.add_argument('--old', default='/tmp/spin-oldsched')
ap.add_argument('--new', default='/tmp/spin')
ap.add_argument('--take', default='spin-0-before.wav')
a = ap.parse_args()

xo, rate = read(os.path.join(a.old, a.take))
xn, _ = read(os.path.join(a.new, a.take))
bo = bands(xo, rate)
bn = bands(xn, rate)
print(f"{'band':>13} {'always-on old':>14} {'new':>8} {'shift':>7}   {'mean old':>9} {'new':>8} {'shift':>7}")
for k in BANDS:
    print(f"{k[0]:5}-{k[1]:<7} {bo[k][0]:>13.1f} {bn[k][0]:>8.1f} {bn[k][0] - bo[k][0]:>+7.1f}   {bo[k][1]:>9.1f} {bn[k][1]:>8.1f} {bn[k][1] - bo[k][1]:>+7.1f}")
