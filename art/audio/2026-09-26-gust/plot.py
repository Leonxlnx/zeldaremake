#!/usr/bin/env python3
"""plot.py -- the gust and the bed, autocorrelated, on one axis.

    python3 art/audio/2026-09-26-gust/plot.py --take /tmp/gust/standing.wav \\
        --out art/audio/2026-09-26-gust/gust.jpg

A random walk's autocorrelation falls away and does not come back. A periodic thing's comes back
at every multiple of its period. The top trace is `uGust` and it comes back three times.
"""
import argparse
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def gust(t):
    g = 0.5 + 0.5 * np.sin(t * 0.37) * np.sin(t * 0.11 + 1.3)
    push = np.maximum(0, np.sin(t * 0.23 + 0.4)) ** 3
    return np.minimum(1, g * 0.8 + push * 0.6)


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def autocorr(x, rate, max_lag_s):
    x = x - x.mean()
    n = len(x)
    k = int(max_lag_s * rate)
    f = np.fft.rfft(x, 2 * n)
    c = np.fft.irfft(f * np.conj(f), 2 * n)[: k + 1]
    return c / (c[0] or 1.0), np.arange(k + 1) / rate


ap = argparse.ArgumentParser()
ap.add_argument('--take', default='/tmp/gust/standing.wav')
ap.add_argument('--seconds', type=float, default=600.0)
ap.add_argument('--out', default='art/audio/2026-09-26-gust/gust.jpg')
a = ap.parse_args()

RATE = 50.0
MAXLAG = 110.0
t = np.arange(0, a.seconds, 1 / RATE)
cg, lg = autocorr(gust(t), RATE, MAXLAG)
x, sr = read(a.take)
k = int(sr / RATE)
env = np.abs(x)
env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
cb, lb = autocorr(env, RATE, MAXLAG)

W, H = 1060, 520
BG, INK, DIM, GRID = (17, 19, 22), (238, 240, 243), (120, 128, 138), (44, 48, 54)
GUST, BED, MARK = (244, 176, 110), (130, 200, 160), (186, 148, 214)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'The bed\u2019s twenty-six second correlation is the wind\u2019s arithmetic, not a random walk', font=f22, fill=INK)
d.text((28, 48), 'a random walk\u2019s autocorrelation falls away and does not come back. uGust comes back three times.', font=f13, fill=DIM)

for panel, (c, lags, col, name, note) in enumerate(
    (
        (cg, lg, GUST, 'uGust itself', 'sin(0.37t)\u00b7sin(0.11t+1.3) and a cubed sin(0.23t) \u2014 a function of the clock, with no randomness in it'),
        (cb, lb, BED, 'the bed\u2019s envelope', f'{len(env) / RATE:.0f} s standing on the lawn, the shipped bed'),
    )
):
    x0, x1 = 90, 1010
    y0 = 110 + panel * 200
    y1 = y0 + 130
    d.rectangle([x0, y0, x1, y1], outline=GRID)
    d.text((x0, y0 - 40), name, font=f16, fill=col)
    d.text((x0, y0 - 20), note, font=f13, fill=DIM)
    top, bot = 1.0, -0.6
    for gl in (1.0, 0.5, 0.0, -0.5):
        yy = y1 - (y1 - y0) * (gl - bot) / (top - bot)
        d.line([(x0, yy), (x1, yy)], fill=GRID)
        d.text((x0 - 40, yy - 8), f'{gl:+.1f}', font=f13, fill=DIM)
    for s in range(0, int(MAXLAG) + 1, 20):
        xx = x0 + (x1 - x0) * s / MAXLAG
        d.line([(xx, y0), (xx, y1)], fill=GRID)
        d.text((xx - 10, y1 + 6), f'{s} s', font=f13, fill=DIM)
    # the gust's own period and its multiples
    for m in (1, 2, 3, 4):
        s = 26.4 * m
        if s > MAXLAG:
            break
        xx = x0 + (x1 - x0) * s / MAXLAG
        for yy in range(y0, y1, 8):
            d.line([(xx, yy), (xx, yy + 4)], fill=(90, 78, 104))
    pts = [(x0 + (x1 - x0) * l / MAXLAG, y1 - (y1 - y0) * (min(max(v, bot), top) - bot) / (top - bot)) for l, v in zip(lags, c)]
    d.line(pts, fill=col, width=2)
    i = int(26.4 * RATE)
    d.text((x0 + (x1 - x0) * 26.4 / MAXLAG + 6, y0 + 6), f'r = {c[i]:.3f} at 26.4 s', font=f13, fill=MARK)

d.text((90, 470), 'the dashed lines are 26.4 s and its multiples \u2014 the beat of sin(0.37t)\u00b7sin(0.11t), which is 2\u03c0 / (0.37 \u2212 0.11)', font=f13, fill=MARK)
im.save(a.out, quality=92)
print(f'wrote {a.out}')
