#!/usr/bin/env python3
"""wet.py -- the reflected share of the flame, against how far away it is.

    python3 art/audio/2026-09-25-wet/wet.py --takes /tmp/wet

The same take rendered twice, once with the hall's return muted, so the difference between the two
files is the reverb and nothing else. Reported as the wet share in decibels -- reflected energy
against direct -- in the flame's own band, which is below 400 Hz (a 320 Hz lowpass on pink noise
with a 132 Hz husk resonance under it).

A bird already does this: `birdWet` is 0.2 up close and 0.75 deep in the wood, so a far call is
wetter as well as quieter. What this asks is whether a lantern is.
"""
import argparse
import json
import math
import os
import wave

import numpy as np

BAND = (60, 400)


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def band_energy(x, rate, lo=BAND[0], hi=BAND[1]):
    n = 8192
    w = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / rate)
    sel = (f >= lo) & (f < hi)
    tot = 0.0
    for i in range(0, len(x) - n, n // 2):
        tot += float((np.abs(np.fft.rfft(x[i : i + n] * w)[sel]) ** 2).sum())
    return tot


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/wet')
a = ap.parse_args()

print('the reflected share of the pod flame, by distance. A bird goes from 0.2 to 0.75 over its own range.')
print(f"\n{'take':10} {'distance':>9}   {'wet share':>10}   {'direct':>9} {'reflected':>10}")
for tag in ('before', 'after'):
    p = os.path.join(a.takes, f'takes-{tag}.json')
    if not os.path.exists(p):
        continue
    meta = json.load(open(p))
    shares = []
    for t in meta['takes']:
        wet, rate = read(os.path.join(a.takes, f"pod-{t['m']}-wet-{tag}.wav"))
        dry, _ = read(os.path.join(a.takes, f"pod-{t['m']}-dry-{tag}.wav"))
        k = min(len(wet), len(dry))
        # the reverb is what the wet take has that the dry one does not
        tail = wet[:k] - dry[:k]
        e_dry = band_energy(dry[:k], rate)
        e_tail = band_energy(tail, rate)
        share = 10 * math.log10(max(e_tail, 1e-30) / max(e_dry, 1e-30))
        shares.append(share)
        print(f"{tag:10} {t['m']:>7.1f} m   {share:>8.1f} dB   {10 * math.log10(max(e_dry, 1e-30)):>7.1f} {10 * math.log10(max(e_tail, 1e-30)):>9.1f}")
    if len(shares) > 1:
        print(f"{'':10} {'spread':>9}   {max(shares) - min(shares):>8.1f} dB   over {meta['range'][0]} to {meta['range'][-1]} m\n")
