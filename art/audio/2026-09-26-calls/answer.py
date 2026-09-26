#!/usr/bin/env python3
"""answer.py -- does the ravine answer a bird, and does it answer from where the rock is?

    python3 art/audio/2026-09-26-calls/answer.py --takes /tmp/calls

Two spots, each rendered on a build without the calls' ravine send and one with it. The difference
between the two takes IS the ravine answering the birds -- nothing else in the render can differ.

  midspan   `gorgeAt` is 1.00 out over the middle of the bridge
  lawn      `gorgeAt` is 0, so the two builds must produce the same file

The always-on figure is NOT the instrument here, and that is worth being explicit about, because
it is the instrument this lane reaches for by default. Always-on is the 10th percentile over time
-- the level a listener lives with between events -- and a bird call is an event. Sixteen to
twenty-two calls in two minutes cannot move a tenth percentile whatever is done to them, so a
measurement that used it would report a null for a change that is plainly audible. What is used
instead is the calls themselves: their level, and the level of the ravine's answer against them.
"""
import argparse
import json
import math
import os
import wave

import numpy as np

# 2 * 5 m / 343 m/s to the wall at mid-span, 2 * 8.8 / 343 to the floor
WALL_MS = 2 * 5.0 / 343 * 1000
FLOOR_MS = 2 * 8.8 / 343 * 1000
LEAD = 8.0


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def envelope(x, rate, win=0.02):
    n = max(2, int(win * rate))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def call_onsets(x, rate, min_gap=1.5):
    """the starts of the calls -- a rise in the envelope, at least a second and a half apart"""
    e = envelope(x, rate)
    d = np.diff(e, prepend=e[0])
    thr = np.percentile(d, 99.7)
    gap = int(min_gap * rate)
    out, i = [], 0
    while i < len(d):
        if d[i] > thr:
            out.append(i)
            i += gap
        else:
            i += 1
    return np.array(out)


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/calls')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'spots.json')))

print('the birds either side of the cut knowing it is there\n')
print(f"{'where':10} {'calls':>6} {'the calls':>11} {'the ravine':>12} {'under the call':>16}")
detail = {}
for s in meta['spots']:
    before, rate = read(os.path.join(a.takes, f"before-{s['id']}.wav"))
    after, _ = read(os.path.join(a.takes, f"after-{s['id']}.wav"))
    n = min(len(before), len(after))
    before, after, head = before[:n], after[:n], int(LEAD * rate)
    answer = after - before
    at = call_onsets(before[head:], rate)
    # the loudest 40 ms of each call, and the loudest of the ravine inside the same two seconds
    peaks, rings = [], []
    span = int(2.0 * rate)
    for i in at:
        if i + span >= len(before) - head:
            continue
        peaks.append(float(np.abs(before[head + i : head + i + span]).max()))
        rings.append(float(np.abs(answer[head + i : head + i + span]).max()))
    if not peaks:
        continue
    call_db, ring_db = db(np.median(peaks)), db(np.median(rings))
    detail[s['id']] = (before, after, answer, rate, at, head)
    verdict = 'the render floor: no ravine here' if ring_db - call_db < -80 else 'the ravine'
    print(f"   {s['id']:10} {len(peaks):>4} {call_db:>8.1f} dB {ring_db:>9.1f} dB {ring_db - call_db:>13.1f} dB   {verdict}")
    print(f"   {'':10} {s['note']}")

print('\nand where it comes from -- how far the answer lags the call that caused it\n')
if 'midspan' in detail:
    before, after, answer, rate, at, head = detail['midspan']
    # NOT timed from a detected onset, which is how the footsteps were timed and is wrong here: a
    # boot is an impulse and its onset is a sample, while a call's attack is rounded by the air
    # (`soft = 1 + distance * 1.6` in `birdCall`) so the detector fires several milliseconds late
    # and reads the lag that much long. Cross-correlating the answer against the call itself does
    # not care where the call is judged to have started.
    lags = []
    span = int(1.5 * rate)
    smax = int(0.09 * rate)
    for i in at:
        if head + i + span >= len(answer):
            continue
        d = before[head + i : head + i + span]
        r = answer[head + i : head + i + span]
        if np.abs(r).max() < 1e-6:
            continue
        # envelopes, because the reflection is a different waveform and only its timing is at issue
        de = envelope(d, rate, 0.002)
        re = envelope(r, rate, 0.002)
        de = de - de.mean()
        re = re - re.mean()
        c = np.correlate(re[: span - smax], de[: span - smax], 'full')
        mid = len(c) // 2
        window = c[mid : mid + smax]
        lags.append(float(np.argmax(window)) / rate * 1000)
    if lags:
        lags = np.array(lags)
        print(f'   {len(lags)} calls, each correlated against the ravine it caused\n')
        print(f'   median lag   {np.median(lags):6.1f} ms')
        print(f'   quartiles    {np.percentile(lags, 25):6.1f} to {np.percentile(lags, 75):.1f} ms')
        print(f'\n   The walls at mid-span are {WALL_MS:.0f} ms away and the floor {FLOOR_MS:.0f}, and the impulse spreads')
        print('   its early reflections from the wall out past the floor -- 29 to 59 ms. A correlation')
        print("   finds where the answer's ENERGY is, not when it starts, and a reverberant tail keeps")
        print('   building past its first reflection, so the median belongs in the back half of that')
        print('   window rather than at its front. When the answer STARTS is not in question and is not')
        print('   measurable this way: it is the same convolver the footsteps use, whose first 28 ms')
        print('   were measured to be digital silence on an isolated boot in `2026-09-26-ravine`.')
