#!/usr/bin/env python3
"""plot.py -- the ravine answering one boot, drawn against the geometry that predicts it.

    python3 art/audio/2026-09-26-ravine/plot.py --takes /tmp/ravine \\
        --out art/audio/2026-09-26-ravine/ravine.jpg

Left: the first boot of the walk, with nothing sounding behind it, and underneath it the ravine
alone -- the same take with the space term forced on, minus the one with it forced off. The two
vertical marks are where the cut's own geometry says the rock is: a wall 5 m off answers at 29 ms
and the floor 8.8 m down at 51 ms, and nothing can come back before the first of them.

Right: the short-term level across the bridge leg with and without it. This is the room lesson in
a picture -- the tops of the spikes are the boots and must not move, and the troughs between them
are where a space lives.
"""
import argparse
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BRIDGE = (45.5, 50.0)
WALL_MS = 2 * 5.0 / 343 * 1000
FLOOR_MS = 2 * 8.8 / 343 * 1000


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


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def levels(x, rate, window=0.02):
    k = max(1, int(rate * window))
    x = x[: len(x) // k * k].reshape(-1, k)
    return np.sqrt((x**2).mean(axis=1))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/ravine')
ap.add_argument('--out', default='art/audio/2026-09-26-ravine/ravine.jpg')
a = ap.parse_args()

off, rate = read(os.path.join(a.takes, 'after-gorge0.wav'))
on, _ = read(os.path.join(a.takes, 'after-gorge1.wav'))
ship, _ = read(os.path.join(a.takes, 'after-shipped.wav'))
n = min(len(off), len(on), len(ship))
off, on, ship = off[:n], on[:n], ship[:n]

W, H = 1060, 520
BG, INK, DIM, GRID = (17, 19, 22), (238, 240, 243), (120, 128, 138), (44, 48, 54)
BOOT, ROCK, WAS = (150, 158, 170), (130, 200, 160), (244, 176, 110)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'The ravine answers the boot, from where the rock is', font=f22, fill=INK)
d.text((28, 48), "left: one boot and the ravine alone, against the cut's own geometry.  right: the walk across the bridge, with and without it.", font=f13, fill=DIM)

# ---- left: the impulse, timed ---------------------------------------------------------------
x0, x1, y0, y1 = 70, 470, 110, 430
d.rectangle([x0, y0, x1, y1], outline=GRID)
d.text((x0, y0 - 24), 'one boot, nothing sounding behind it', font=f16, fill=INK)
i0 = int(2.9 * rate)
win = np.abs(off[i0 : i0 + int(2.0 * rate)])
first = i0 + int(np.argmax(win > 0.02 * win.max()))
span = 0.09
k = int(rate * span)
boot = off[first : first + k]
rock = (on - off)[first : first + k]
scale = max(np.abs(boot).max(), 1e-9)
mid = (y0 + y1) / 2
for j in range(0, int(span * 1000) + 1, 10):
    xx = x0 + (x1 - x0) * (j / 1000) / span
    d.line([(xx, y0), (xx, y1)], fill=GRID)
    d.text((xx - 10, y1 + 6), f'{j} ms', font=f13, fill=DIM)
for hz, label, dy in ((WALL_MS, 'the walls, 5 m off', 0), (FLOOR_MS, 'the floor, 8.8 m down', 16)):
    xx = x0 + (x1 - x0) * (hz / 1000) / span
    for yy in range(y0, y1, 8):
        d.line([(xx, yy), (xx, yy + 4)], fill=(110, 116, 124))
    d.text((xx + 5, y0 + 6 + dy), label, font=f13, fill=INK)
step = max(1, k // (x1 - x0))
# the boot against its own peak; the ravine against ITS own, or a trace 12.8 dB down is a flat line
# and the thing worth seeing — silence, then an answer — is invisible
rockpeak = max(float(np.abs(rock).max()), 1e-12)
for name, sig, col, base, half, ref in (
    ('the boot', boot, BOOT, mid - 56, 52, scale),
    (f'the ravine alone, drawn {db(scale) - db(rockpeak):.1f} dB larger than it is', rock, ROCK, mid + 92, 52, rockpeak),
):
    pts = []
    for px in range(int(x1 - x0)):
        s = sig[px * step : (px + 1) * step]
        pts.append((x0 + px, base - (float(np.abs(s).max()) / ref if len(s) else 0.0) * half))
    d.line([(x0, base), (x1, base)], fill=GRID)
    d.line(pts, fill=col, width=2)
    d.text((x0 + 8, base - half - 18), name, font=f13, fill=col)
d.text((x0 + 8, mid + 92 + 22), f'it peaks {db(rockpeak) - db(scale):.1f} dB under the boot; the cut\u2019s geometry says 12.6', font=f13, fill=DIM)

# ---- right: the walk across the bridge -------------------------------------------------------
x0, x1 = 600, 1010
d.rectangle([x0, y0, x1, y1], outline=GRID)
d.text((x0, y0 - 24), 'the walk across the bridge, short-term level', font=f16, fill=INK)
lo = levels(off[int(BRIDGE[0] * rate) : int(BRIDGE[1] * rate)], rate)
ln = levels(ship[int(BRIDGE[0] * rate) : int(BRIDGE[1] * rate)], rate)
top, bot = -18.0, -70.0
for gl in range(-20, -71, -10):
    yy = y1 - (y1 - y0) * (gl - bot) / (top - bot)
    d.line([(x0, yy), (x1, yy)], fill=GRID)
    d.text((x0 - 44, yy - 8), f'{gl} dB', font=f13, fill=DIM)
for name, v, col in (('without the ravine', lo, WAS), ('with it', ln, ROCK)):
    pts = [(x0 + (x1 - x0) * i / max(1, len(v) - 1), y1 - (y1 - y0) * (min(max(db(s), bot), top) - bot) / (top - bot)) for i, s in enumerate(v)]
    d.line(pts, fill=col, width=1)
for k2, (name, v, col) in enumerate((('without the ravine', lo, WAS), ('with it', ln, ROCK))):
    d.text((x0 + 10, y1 + 26 + k2 * 20), f'{name:20} p95 {db(np.percentile(v, 95)):6.1f} dB    p50 {db(np.percentile(v, 50)):6.1f} dB', font=f13, fill=col)
d.text((x0 + 10, y1 + 68), 'the boots do not move; the quiet between them comes up 8 dB', font=f13, fill=DIM)

im.save(a.out, quality=92)
print(f'wrote {a.out}')
