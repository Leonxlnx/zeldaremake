#!/usr/bin/env python3
"""levels.py — how loud the mix actually is, and what a master gain would and would not change.

    python3 art/audio/2026-09-24-headroom/levels.py /tmp/lvl/mix.wav /tmp/lvl/bed.wav ...
    python3 art/audio/2026-09-24-headroom/levels.py --gain-db 11 /tmp/lvl/mix.wav

Three numbers per file:

  * **integrated loudness** — ITU-R BS.1770-4: K-weighted mean power over 400 ms blocks, gated at
    an absolute −70 LUFS and then at 10 LU below the ungated mean. This is the number every other
    application on the player's machine is normalised to, so it is the one that says whether this
    game is quieter than the rest of his desktop.
  * **true peak** — sample peak plus a 4× oversampled peak, which is what a converter will actually
    reconstruct between samples. Headroom is measured against this, not against the sample peak.
  * **the short-term distribution** — 400 ms block loudness at p10 / p50 / p95 / p99. p10 is the
    lane's "never stops" metric in the loudness domain: the level present nine blocks out of ten.

The point of putting them together is the last column, `p99 − p10`: the span between what the mix
does when something is happening and what it does when nothing is. A master gain moves every one of
these numbers by exactly the same amount and leaves that span untouched — which is the argument for
why raising the level cannot bring back a percept that lives in a ratio.
"""
import argparse
import json
import wave

import numpy as np


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    a = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return a.reshape(-1, ch), sr


def _biquad(x, b, a):
    """direct form I, sample loop in numpy's lfilter if scipy is absent"""
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2 = b
    a1, a2 = a[1], a[2]
    for i in range(len(x)):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        y[i] = yi
        x2, x1 = x1, xi
        y2, y1 = y1, yi
    return y


def k_weight(x, sr):
    """BS.1770 pre-filter: a +4 dB high shelf then a 38 Hz high-pass, coefficients at the rate."""
    # stage 1, high shelf (spec coefficients are given at 48 kHz; re-derive at sr)
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / sr)
    Vh = 10 ** (G / 20.0)
    Vb = Vh ** 0.4996667741545416
    a0 = 1.0 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2.0 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0]
    y = _biquad(x, b, a)
    # stage 2, RLB high-pass
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / sr)
    a0 = 1.0 + K / Q + K * K
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0]
    return _biquad(y, b2, a2)


CH_WEIGHT = [1.0, 1.0, 1.0, 1.41, 1.41]  # L, R, C, Ls, Rs


def block_loudness(a, sr, block=0.400, overlap=0.75):
    """per-block K-weighted loudness in LKFS, the quantity BS.1770 gates on"""
    ch = a.shape[1]
    g = [k_weight(a[:, c], sr) ** 2 for c in range(ch)]
    n = int(round(block * sr))
    hop = int(round(n * (1.0 - overlap)))
    if len(a) < n:
        return np.array([])
    starts = range(0, len(a) - n + 1, hop)
    out = np.empty(len(list(starts)))
    for i, s in enumerate(range(0, len(a) - n + 1, hop)):
        z = sum(CH_WEIGHT[c] * g[c][s:s + n].mean() for c in range(ch))
        out[i] = -0.691 + 10.0 * np.log10(max(z, 1e-12))
    return out


def integrated(blocks):
    """the two-stage gate: absolute −70 LKFS, then relative at −10 LU of the survivors' mean"""
    if len(blocks) == 0:
        return float('nan')
    keep = blocks[blocks > -70.0]
    if len(keep) == 0:
        return float('nan')
    # the relative gate is computed on mean power, not mean dB
    mean_pow = np.mean(10 ** ((keep + 0.691) / 10.0))
    gate = -0.691 + 10.0 * np.log10(mean_pow) - 10.0
    keep2 = keep[keep > gate]
    if len(keep2) == 0:
        return float('nan')
    return float(-0.691 + 10.0 * np.log10(np.mean(10 ** ((keep2 + 0.691) / 10.0))))


def true_peak_db(a, os=4):
    """sample peak and a 4× zero-stuffed / windowed-sinc peak — what the converter reconstructs"""
    sample = float(np.max(np.abs(a)))
    n = 33
    t = (np.arange(n * os) - (n * os - 1) / 2.0) / os
    h = np.sinc(t) * np.hanning(n * os)
    h /= h.sum() / os
    peak = sample
    for c in range(a.shape[1]):
        up = np.zeros(len(a) * os)
        up[::os] = a[:, c]
        peak = max(peak, float(np.max(np.abs(np.convolve(up, h, mode='same')))))
    return 20 * np.log10(max(sample, 1e-9)), 20 * np.log10(max(peak, 1e-9))


def band_holes(path, lo=60.0, hi=125.0, down_db=20.0, win=0.05):
    """Does one band ever stop?

    A percentile over time answers the wrong question once a sound has long rests: the 10th
    percentile just lands inside a rest and reports silence, whether or not the sound is a held
    tone while it plays. What a held tone actually is, is a band with no holes in it — so measure
    the holes. The band's short-term level, everything within `down_db` of its own 95th percentile
    counted as sounding, and the longest run either way reported in seconds.
    """
    a, sr = load(path)
    x = a.mean(axis=1)
    n = int(win * sr)
    frames = len(x) // n
    e = np.sqrt((x[:frames * n].reshape(frames, n) ** 2).mean(axis=1))
    # band-limit first: an FFT per frame is overkill, a pair of one-pole passes is enough here
    nyq = sr / 2.0
    X = np.fft.rfft(x[:frames * n])
    f = np.fft.rfftfreq(frames * n, 1.0 / sr)
    X[(f < lo) | (f >= hi)] = 0
    xb = np.fft.irfft(X, frames * n)
    e = np.sqrt((xb.reshape(frames, n) ** 2).mean(axis=1))
    d = 20 * np.log10(np.maximum(e, 1e-9))
    gate = np.percentile(d, 95) - down_db
    on = d > gate
    runs = {True: [], False: []}
    cur, ln = on[0], 0
    for v in on:
        if v == cur:
            ln += 1
        else:
            runs[cur].append(ln)
            cur, ln = v, 1
    runs[cur].append(ln)
    return {
        'band': f'{lo:.0f}-{hi:.0f}',
        'p95_db': round(float(np.percentile(d, 95)), 1),
        'p50_db': round(float(np.percentile(d, 50)), 1),
        'on_pct': round(100.0 * float(on.mean()), 0),
        'longest_on_s': round(max(runs[True], default=0) * win, 1),
        'longest_hole_s': round(max(runs[False], default=0) * win, 1),
        'nyq': nyq,
    }


def report(path, gain_db=0.0):
    a, sr = load(path)
    if gain_db:
        a = a * (10 ** (gain_db / 20.0))
    blocks = block_loudness(a, sr)
    heard = blocks[blocks > -70.0]
    sp, tp = true_peak_db(a)
    return {
        'file': path,
        'seconds': round(len(a) / sr, 1),
        'lufs': round(integrated(blocks), 1),
        'sample_peak_db': round(sp, 1),
        'true_peak_db': round(tp, 1),
        'p10': round(float(np.percentile(heard, 10)), 1) if len(heard) else None,
        'p50': round(float(np.percentile(heard, 50)), 1) if len(heard) else None,
        'p95': round(float(np.percentile(heard, 95)), 1) if len(heard) else None,
        'p99': round(float(np.percentile(heard, 99)), 1) if len(heard) else None,
        'span_p99_p10': round(float(np.percentile(heard, 99) - np.percentile(heard, 10)), 1) if len(heard) else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--gain-db', type=float, default=0.0, help='apply before measuring')
    ap.add_argument('--band', nargs=2, type=float, metavar=('LO', 'HI'), help='also report the holes in this band')
    ap.add_argument('--json', help='write the rows here too')
    args = ap.parse_args()
    rows = [report(f, args.gain_db) for f in args.files]
    if args.band:
        for r in rows:
            r.update({k: v for k, v in band_holes(r['file'], *args.band).items() if k != 'nyq'})
    head = ['file', 'lufs', 'true_peak_db', 'p10', 'p50', 'p95', 'p99', 'span_p99_p10']
    if args.band:
        head += ['band', 'on_pct', 'longest_on_s', 'longest_hole_s']
    w = [max(len(h), *(len(str(r[h])) for r in rows)) for h in head]
    print('  '.join(h.rjust(w[i]) for i, h in enumerate(head)))
    for r in rows:
        r2 = dict(r, file=r['file'].split('/')[-1])
        print('  '.join(str(r2[h]).rjust(w[i]) for i, h in enumerate(head)))
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(rows, f, indent=1)


if __name__ == '__main__':
    main()
