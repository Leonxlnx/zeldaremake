#!/usr/bin/env python3
"""
balance.py — the whole mix judged as a mix, not one change at a time.

  python3 art/audio/2026-09-23-lane5/balance.py --before /tmp/head --after /tmp/branch [--json out.json]

Every other tool here compares one stem across one change. This one asks the questions that only
make sense about the finished thing, and that a run of separate A/Bs can drift past:

  headroom      true peak against full scale, and whether any sample clips
  loudness      an ITU-R BS.1770 style gated integrated loudness (K-weighted, −70 LUFS absolute
                gate then a −10 LU relative gate) — the number a player's volume knob answers to
  balance       each stem's loudness against the mix's, so "is the forest audible beside the tune"
                is a number rather than an opinion
  always-on     the level present in nine frames out of ten, per band: what never stops
  dynamics      loudness range (the 10th to 95th percentile of the short-term loudness)

It reads `mix`, `bed`, `steps` and `music` WAVs from each folder (render-mix.mjs writes them).
"""
import argparse
import json
import os
import wave

import numpy as np

STEMS = ('mix', 'bed', 'steps', 'music')
BANDS = ((60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000))


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    a = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return a.reshape(-1, ch), sr


def biquad(x, b, a):
    """direct form I, applied along time for each channel"""
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = np.zeros(x.shape[1])
    for i in range(x.shape[0]):
        xi = x[i]
        yi = b[0] * xi + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        y[i] = yi
        x2, x1 = x1, xi
        y2, y1 = y1, yi
    return y


def k_weight(x, sr):
    """BS.1770 pre-filter (a high shelf) then the RLB high-pass, coefficients at 48 kHz rescaled"""
    # shelf
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / sr)
    Vh = np.power(10.0, G / 20.0)
    Vb = np.power(Vh, 0.4996667741545416)
    a0 = 1.0 + K / Q + K * K
    b = np.array([(Vh + Vb * K / Q + K * K) / a0, 2.0 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0])
    a = np.array([1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0])
    y = biquad(x, b, a)
    # RLB high-pass
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / sr)
    b = np.array([1.0, -2.0, 1.0])
    a0 = 1.0 + K / Q + K * K
    a = np.array([1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0])
    b = b / a0
    return biquad(y, b, a)


def loudness(x, sr):
    """gated integrated loudness (LUFS) and the short-term loudness series over 400 ms blocks"""
    y = k_weight(x, sr)
    win = int(0.4 * sr)
    hop = int(0.1 * sr)
    n = max(0, (len(y) - win) // hop + 1)
    if n < 1:
        return float('nan'), np.array([])
    # channel weights: 1.0 for L and R
    blocks = np.array([np.sum(np.mean(y[i * hop:i * hop + win] ** 2, axis=0)) for i in range(n)])
    lk = -0.691 + 10.0 * np.log10(np.maximum(blocks, 1e-12))
    keep = lk > -70.0
    if not keep.any():
        return float('nan'), lk
    rel = -0.691 + 10.0 * np.log10(np.mean(blocks[keep])) - 10.0
    keep = keep & (lk > rel)
    if not keep.any():
        return float('nan'), lk
    return float(-0.691 + 10.0 * np.log10(np.mean(blocks[keep]))), lk


def bands(x, sr):
    m = x.mean(axis=1)
    win, hop = 2048, 512
    w = np.hanning(win)
    frames = 1 + max(0, (len(m) - win) // hop)
    mag = np.empty((frames, win // 2 + 1))
    for i in range(frames):
        mag[i] = np.abs(np.fft.rfft(m[i * hop:i * hop + win] * w)) / (win / 4)
    freqs = np.fft.rfftfreq(win, 1.0 / sr)
    out = {}
    for lo, hi in BANDS:
        sel = (freqs >= lo) & (freqs < hi)
        p = mag[:, sel] ** 2
        mean = 20 * np.log10(max(np.sqrt(np.mean(p.sum(axis=1))), 1e-12))
        always = 20 * np.log10(max(np.sqrt(np.percentile(p, 10, axis=0).sum()), 1e-12))
        out[f'{lo}-{hi}'] = (float(mean), float(always))
    return out


def measure(folder):
    out = {}
    for stem in STEMS:
        path = os.path.join(folder, f'{stem}.wav')
        if not os.path.exists(path):
            continue
        x, sr = load(path)
        lufs, short = loudness(x, sr)
        peak = float(np.max(np.abs(x)))
        row = {
            'lufs': lufs,
            'peak_dbfs': float(20 * np.log10(max(peak, 1e-12))),
            'clipped_samples': int(np.sum(np.abs(x) >= 0.999)),
            'lra': float(np.percentile(short[short > -70], 95) - np.percentile(short[short > -70], 10)) if (short > -70).any() else float('nan'),
        }
        if stem == 'mix':
            row['bands'] = bands(x, sr)
        out[stem] = row
    if 'mix' in out:
        for stem in STEMS:
            if stem in out and stem != 'mix':
                out[stem]['under_mix_lu'] = out['mix']['lufs'] - out[stem]['lufs']
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--before', required=True)
    p.add_argument('--after', required=True)
    p.add_argument('--json')
    args = p.parse_args()
    b, a = measure(args.before), measure(args.after)
    print(f'{"stem":8s} {"LUFS before":>12s} {"after":>8s} {"peak before":>12s} {"after":>8s} {"under the mix (LU)":>20s} {"range before":>13s} {"after":>7s}')
    for stem in STEMS:
        if stem not in b or stem not in a:
            continue
        u = f'{b[stem].get("under_mix_lu", 0):.1f} → {a[stem].get("under_mix_lu", 0):.1f}' if stem != 'mix' else '—'
        print(f'{stem:8s} {b[stem]["lufs"]:12.1f} {a[stem]["lufs"]:8.1f} {b[stem]["peak_dbfs"]:12.1f} {a[stem]["peak_dbfs"]:8.1f} {u:>20s} {b[stem]["lra"]:13.1f} {a[stem]["lra"]:7.1f}')
    clipped = sum(v['clipped_samples'] for v in a.values())
    print(f'\nclipped samples after: {clipped}')
    print(f'\n{"band":>12s} {"mean before":>12s} {"after":>8s} {"always before":>14s} {"after":>8s}')
    for band in b['mix']['bands']:
        bm, ba = b['mix']['bands'][band]
        am, aa = a['mix']['bands'][band]
        print(f'{band:>12s} {bm:12.1f} {am:8.1f} {ba:14.1f} {aa:8.1f}')
    if args.json:
        with open(args.json, 'w') as f:
            json.dump({'before': b, 'after': a}, f, indent=2)
        print(f'\nwrote {args.json}')


if __name__ == '__main__':
    main()
