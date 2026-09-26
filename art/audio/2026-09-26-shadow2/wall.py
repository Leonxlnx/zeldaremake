#!/usr/bin/env python3
"""wall.py -- what the west house takes off the lanterns behind it.

    python3 art/audio/2026-09-26-shadow2/wall.py --takes /tmp/shadow2

Four standing points, the bed rendered at each with the leaves, birds and wind muted so the pod
flames are alone in the take. Three of them are the places `audible.mjs` found where almost all of
the flame level arriving comes from behind the west house and the giant it is built around; the
fourth is the open lawn, where nothing is in the way and the two takes must be the same file.

The flame is two bands -- a 132 Hz husk and a 320 Hz body -- so the level is read in 80-400 Hz as
well as broadband, and the always-on figure (the 10th percentile over time) is quoted beside the
mean, because a flame never stops and the floor is what a listener actually lives with.
"""
import argparse
import json
import math
import os
import wave

import numpy as np


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def band(x, rate, lo, hi):
    """the signal inside a band, by fft mask -- the flame is narrow and the take is short"""
    n = 1 << int(np.floor(np.log2(len(x))))
    f = np.fft.rfftfreq(n, 1 / rate)
    s = np.fft.rfft(x[:n])
    s[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(s, n)


def floor_db(x, rate, window=0.05):
    k = int(rate * window)
    x = x[: len(x) // k * k].reshape(-1, k)
    return db(np.percentile(np.sqrt((x**2).mean(axis=1)), 10))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/shadow2')
a = ap.parse_args()

spots = json.load(open(os.path.join(a.takes, 'spots.json')))['spots']
lead = 2.0

print('the pod flames alone (leaves, birds and wind muted), either side of the wall knowing it is there\n')
print(f"{'where':22} {'':7} {'80-400 Hz mean':>15} {'always-on':>11} {'broadband':>11}")
for s in spots:
    row = {}
    for tag in ('before', 'after'):
        x, rate = read(os.path.join(a.takes, f'{tag}-{s["id"]}.wav'))
        x = x[int(lead * rate) :]
        b = band(x, rate, 80, 400)
        row[tag] = (db(np.sqrt((b**2).mean())), floor_db(b, rate), db(np.sqrt((x**2).mean())))
        print(f'   {s["id"]:22} {tag:>7} {row[tag][0]:>12.1f} dB {row[tag][1]:>8.1f} dB {row[tag][2]:>8.1f} dB')
    d = [row['after'][i] - row['before'][i] for i in range(3)]
    verdict = 'unchanged — nothing is in the way' if abs(d[0]) < 0.1 else 'the wall'
    print(f'   {"":22} {"moved":>7} {d[0]:>+12.1f} dB {d[1]:>+8.1f} dB {d[2]:>+8.1f} dB   {verdict}')
    print(f'   {"":22} {s["note"]}\n')
