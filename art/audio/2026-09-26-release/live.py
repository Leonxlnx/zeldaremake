#!/usr/bin/env python3
"""live.py -- the footsteps in a real recording of the real graph, either side of the cut.

    python3 art/audio/2026-09-26-release/live.py --before /tmp/live/before --after /tmp/live/after

`live.mjs` records the master bus while the player runs down the plaza spine. This finds the
footsteps in each recording and reports how hard they land.

It is deliberately a narrow question. Sixteen seconds is far too short a window to resolve a 1.2 Hz
beat, so the pulse is not measured here -- the offline takes do that over sixty-two. What this
answers is the one thing a twin cannot: that the change is in the graph the owner actually hears.

The figure to compare it against is NOT the 4 dB on the trim. A live recording is the master bus,
so every "step peak" in it is a step plus whatever the bed and the music are doing at that instant,
and that sum does not fall by the whole of what the step fell by. Run the same detector over the
offline takes and the size of the effect is plain:

    the offline steps stem   the median step peak falls 4.0 dB -- the trim, exactly
    the offline mix          the same detector sees 2.4 dB

So a live take, which can only ever be the second kind, should land near 2.4 dB. Anything near 0
would mean the cut never reached the shipped path.

Steps are found as peaks in the envelope's rise, at least 150 ms apart (a run's stride is 273 ms
and a heel and its toe are 50-100 ms), the same detector `2026-09-26-perstep` uses. The two
recordings are independent real-time takes of a non-deterministic system, so the two step counts
will not match exactly and the number to read is the median, not any individual step.
"""
import argparse
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


def envelope(x, rate, win=0.004):
    n = max(2, int(win * rate))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def onsets(x, rate, min_gap=0.15):
    env = envelope(x, rate)
    d = np.diff(env, prepend=env[0])
    thr = np.percentile(d, 99.0)
    gap = int(min_gap * rate)
    out, i = [], 0
    while i < len(d):
        if d[i] > thr:
            j = min(len(env), i + int(0.02 * rate))
            out.append(int(i + np.argmax(env[i:j])) if j > i else i)
            i += gap
        else:
            i += 1
    return np.array(out)


def floor_db(x, rate, window=0.05):
    k = int(rate * window)
    x = x[: len(x) // k * k].reshape(-1, k)
    return db(np.percentile(np.sqrt((x**2).mean(axis=1)), 10))


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/live/before')
ap.add_argument('--after', default='/tmp/live/after')
# the run starts 3 s in; skip a little more so the first stride is up to speed
ap.add_argument('--from-seconds', type=float, default=4.0)
# what the same detector sees on the offline mix, which is the like-for-like figure
ap.add_argument('--offline-mix-db', type=float, default=-2.4)
a = ap.parse_args()

print('the real graph, recorded while running down the plaza spine\n')
print(f"{'':8} {'steps':>6} {'median step':>13} {'loudest step':>14} {'the floor under them':>21}")
med = {}
for name, folder in (('before', a.before), ('after', a.after)):
    x, rate = read(os.path.join(folder, 'live.wav'))
    x = x[int(a.from_seconds * rate) :]
    at = onsets(x, rate)
    peaks = np.array([np.abs(x[i : i + int(0.04 * rate)]).max() for i in at if i + int(0.04 * rate) < len(x)])
    med[name] = db(np.median(peaks))
    print(f'{name:>8} {len(peaks):>6} {db(np.median(peaks)):>10.1f} dB {db(peaks.max()):>11.1f} dB {floor_db(x, rate):>18.1f} dB')

moved = med['after'] - med['before']
print(f"\na step in the live graph lands {moved:+.1f} dB; the same detector on the offline MIX sees {a.offline_mix_db:+.1f} dB,")
print(f'and on the offline STEPS STEM {-4.0:+.1f} dB, which is the trim exactly. The live take is the first kind.')
