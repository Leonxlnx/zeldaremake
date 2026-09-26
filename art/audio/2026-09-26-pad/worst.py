#!/usr/bin/env python3
"""worst.py -- what removing the compressor costs the loudest moment the game can make.

    python3 art/audio/2026-09-26-pad/worst.py --compressor /tmp/worst/compressor --pad /tmp/worst/pad

`pad.py` says a plain gain buys the same rhythm as the compressor, at the same step level, with
2 dB more of the difference between a walk and a run. The compressor's own docstring names the one
thing it does that a gain cannot: *"it is stable because the sfx bus has a compressor on it, so no
amount of stacking gets past it"*. `MASTER_TRIM_DB = 9` is sized against that stability --
`level.test.mjs` requires the measured worst case to leave 6 dB of headroom after the trim.

So run the worst case both ways. `2026-09-24-level/worstcase.mjs` builds it on purpose: running on
the plaza's flagstones under the lantern bough (the densest cluster of pod flames in the world),
jumping continuously so every landing stacks on the steps, with the score playing.

True peak is measured 4x oversampled, because the sample peak of a transient understates what a
converter will actually produce between samples -- which is the number a ceiling has to clear.

`__ZR_AUDIO__.record` taps `buses.master`, whose gain is already `MASTER_LEVEL`, so what comes out
of here is the finished output. It is compared against 0 dBFS directly; `WORST_CASE_PEAK_DBFS` in
`level.test.mjs` is the same figure stated BEFORE the trim, so the two differ by exactly the trim.
"""
import argparse
import json
import math
import os
import wave

import numpy as np

MASTER_TRIM_DB = 9
REQUIRED_HEADROOM_DB = 6


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch) if ch > 1 else x.reshape(-1, 1)), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def true_peak_db(x, rate, oversample=4):
    """4x oversampled peak: what a converter makes between the samples, not just at them"""
    peak = 0.0
    for c in range(x.shape[1]):
        ch = x[:, c]
        n = len(ch)
        up = np.fft.irfft(np.fft.rfft(ch), n * oversample) * oversample
        peak = max(peak, float(np.abs(up).max()))
    return db(peak)


def loudest_second(x, rate):
    m = np.abs(x).max(axis=1)
    k = int(rate)
    m = m[: len(m) // k * k].reshape(-1, k)
    return db(np.sqrt((m**2).mean(axis=1)).max())


ap = argparse.ArgumentParser()
ap.add_argument('--compressor', default='/tmp/worst/compressor')
ap.add_argument('--pad', default='/tmp/worst/pad')
a = ap.parse_args()

print('the loudest moment the game can make, built on purpose, with the sfx bus wired both ways\n')
print(f"{'':14} {'events':>26} {'sample peak':>12} {'true peak':>11} {'loudest second':>15}")
peaks = {}
for name, folder in (('compressor', a.compressor), ('a plain pad', a.pad)):
    x, rate = read(os.path.join(folder, 'worst.wav'))
    meta = json.load(open(os.path.join(folder, 'worst.json')))
    tp = true_peak_db(x, rate)
    peaks[name] = tp
    ev = f"{meta['steps']} steps, {meta['landings']} landings"
    print(f'{name:14} {ev:>26} {db(np.abs(x).max()):>9.1f} dB {tp:>8.1f} dB {loudest_second(x, rate):>12.1f} dB')

print(f"\nthe pad's worst case is {peaks['a plain pad'] - peaks['compressor']:+.1f} dB against the compressor's\n")
print(f'these are finished output, the trim already in them. {REQUIRED_HEADROOM_DB} dB must stay free:\n')
print(f"{'':14} {'true peak':>11} {'free':>7}   {'':8} {'stated before the trim':>23}")
for name, tp in peaks.items():
    free = -tp
    verdict = 'passes' if free >= REQUIRED_HEADROOM_DB else f'FAILS with only {free:.1f} dB free'
    print(f'   {name:14} {tp:>8.1f} dB {free:>6.1f} dB   {verdict:24} {tp - MASTER_TRIM_DB:>8.1f} dBFS')
print(f"\n(`level.test.mjs` carries {-16.7:.1f} dBFS before the trim, measured before the steps came down 4 dB.)")
