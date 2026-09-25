#!/usr/bin/env python3
"""rate.py -- does the game sound the same on a machine that runs at 48 kHz? (rubric check 40)

    python3 art/audio/2026-09-25-rubric/rate.py --takes /tmp/rate

Band levels of the same stem rendered at two rates from the same seed. They cannot be subtracted
sample by sample -- different rates give different-length buffers and a different realisation of
the seeded noise -- so the comparison is what the two sound *like*: mean level per band, and the
distribution of the short-term level over the take.

A shift under about half a decibel is nothing. Anything larger means something in the graph is
counting samples where it should be counting seconds.
"""
import argparse
import os
import wave

import numpy as np

BANDS = [('20-60', 20, 60), ('60-250', 60, 250), ('250-1k', 250, 1000), ('1-2k', 1000, 2000), ('2-4k', 2000, 4000), ('4-8k', 4000, 8000), ('8-16k', 8000, 16000)]
TOLERANCE_DB = 0.8


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch).mean(axis=1) / 32768.0, sr


def band_db(x, sr, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    X[(f < lo) | (f >= hi)] = 0
    y = np.fft.irfft(X, len(x))
    return 20 * np.log10(max(float(np.sqrt(np.mean(y**2))), 1e-14))


def short_term(x, sr, win=0.25):
    n = int(win * sr)
    m = len(x) // n
    return 20 * np.log10(np.maximum(np.sqrt((x[: m * n].reshape(m, n) ** 2).mean(axis=1)), 1e-13))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/rate')
    ap.add_argument('--stems', default='bed,steps')
    ap.add_argument('--rates', default='44100,48000')
    args = ap.parse_args()
    lo_r, hi_r = (int(v) for v in args.rates.split(','))

    worst = 0.0
    for stem in args.stems.split(','):
        a, sa = load(os.path.join(args.takes, f'{stem}-{lo_r}.wav'))
        b, sb = load(os.path.join(args.takes, f'{stem}-{hi_r}.wav'))
        print(f'=== {stem} ===  {lo_r / 1000:.1f} kHz vs {hi_r / 1000:.0f} kHz, same seed')
        print(f'{"band":>10s} {f"{lo_r // 1000}k":>9s} {f"{hi_r // 1000}k":>9s} {"shift":>8s}')
        for name, lo, hi in BANDS:
            va, vb = band_db(a, sa, lo, hi), band_db(b, sb, lo, hi)
            worst = max(worst, abs(vb - va))
            print(f'{name:>10s} {va:9.1f} {vb:9.1f} {vb - va:+8.1f}' + ('   <-- moved' if abs(vb - va) > TOLERANCE_DB else ''))
        for label, pct in [('always-on', 10), ('p50', 50), ('p90', 90)]:
            va, vb = float(np.percentile(short_term(a, sa), pct)), float(np.percentile(short_term(b, sb), pct))
            if va > -200:
                worst = max(worst, abs(vb - va))
            print(f'{label:>10s} {va:9.1f} {vb:9.1f} {vb - va:+8.1f}')
        print()
    print(f'largest shift anywhere: {worst:.1f} dB ' + ('\u2014 the sound does not depend on the rate' if worst <= TOLERANCE_DB else '\u2014 SOMETHING IS COUNTING SAMPLES INSTEAD OF SECONDS'))


if __name__ == '__main__':
    main()
