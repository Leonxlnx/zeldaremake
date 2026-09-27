#!/usr/bin/env python3
"""shadow.py -- what the two tree-houses take off the wood behind them.

    python3 art/audio/2026-09-26-houses/shadow.py --takes /tmp/houses

Three standing spots, the bed rendered at each on a build whose occluder list has the houses and
one whose does not. The difference between the two takes IS the houses' shadow; nothing else in
the render can differ.

A bird's shadow is not a level, and measuring it as one reads a null. `OCCLUSION_TOP` is 0.18
against `OCCLUSION_DUCK`'s 0.5 -- a bole takes the TOP off a call three times harder than it takes
its level, because that is what an obstacle a few wavelengths across does. So the measurement is
per band, and the band that matters is the one a call lives in and the bed does not: above 2 kHz,
where the wind is muted out and a bird is the only thing left.

The always-on figure is not used here, for the reason `2026-09-26-calls` set out: a call is an
event and a tenth percentile over time is the level between events. What is measured is the calls.
"""
import argparse
import json
import math
import os
import wave

import numpy as np

BANDS = [(320, 1000), (1000, 2000), (2000, 4000), (4000, 8000)]
LEAD = 8.0


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def band_db(x, rate, lo, hi, pct=99.0):
    """the level of the loud moments in a band -- the calls, not the gaps between them"""
    n = 1 << int(np.floor(np.log2(len(x))))
    f = np.fft.rfftfreq(n, 1 / rate)
    s = np.fft.rfft(x[:n])
    s[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(s, n)
    k = int(rate * 0.05)
    y = y[: len(y) // k * k].reshape(-1, k)
    return db(np.percentile(np.sqrt((y**2).mean(axis=1)), pct))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/houses')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'spots.json')))

print('the wood behind the houses, with a build that knows they are there and one that does not\n')
head = ' '.join(f'{lo}-{hi} Hz'.rjust(12) for lo, hi in BANDS)
print(f"{'where':20} {'':8} {head}  {'whole take':>11}")
for s in meta['spots']:
    before, rate = read(os.path.join(a.takes, f"before-{s['id']}.wav"))
    after, _ = read(os.path.join(a.takes, f"after-{s['id']}.wav"))
    n = min(len(before), len(after))
    head_i = int(LEAD * rate)
    before, after = before[head_i:n], after[head_i:n]
    rows = {}
    for name, sig in (('before', before), ('after', after)):
        rows[name] = [band_db(sig, rate, lo, hi) for lo, hi in BANDS]
        cells = ' '.join(f'{v:9.1f} dB' for v in rows[name])
        print(f"   {s['id']:20} {name:>8} {cells} {db(np.sqrt((sig**2).mean())):>8.1f} dB")
    moved = [rows['after'][i] - rows['before'][i] for i in range(len(BANDS))]
    d = after - before
    rel = db(np.sqrt((d**2).mean())) - db(np.sqrt((before**2).mean()))
    cells = ' '.join(f'{v:+9.1f} dB' for v in moved)
    # -108 dB is where two renders of identical code sit; -50 is a real but inaudible difference
    # (a thirtieth of a decibel of level), and a shadow worth hearing shows above -20.
    verdict = 'the render floor: nothing moved' if rel < -80 else ('the houses, and audibly' if rel > -20 else f'the houses, but only {20 * math.log10(1 + 10 ** (rel / 20)):.2f} dB of level')
    print(f"   {'':20} {'moved':>8} {cells}")
    print(f"   {'':20} the two takes differ by {rel:.1f} dB against the take   {verdict}")
    print(f"   {'':20} {s['note']}\n")

print('a bole takes the top off a call three times harder than it takes its level')
print('(OCCLUSION_TOP 0.18 against OCCLUSION_DUCK 0.5), so the top bands are where a shadow shows.')
