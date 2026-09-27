#!/usr/bin/env python3
"""plot.py -- how far behind the wind the leaves are, before and after.

    python3 art/audio/2026-09-26-early/plot.py /tmp/early/before /tmp/early/after \\
        art/audio/2026-09-26-early/early.jpg

The measurement is a cross-correlation, so the picture is the cross-correlation: how well the
leaf energy in the rendered leaf-only take matches `wind.ts`'s gust, as the leaves are slid
against it. Where the curve peaks is how far behind the wind the leaves are.

Plotting the two time series instead was tried and thrown away: the gust spends most of its life
against its own ceiling (it is a `min(1, …)`), so the trace that is supposed to be the reference
is a flat line at the top of the panel, and a four-second shift in a noisy envelope is not
something an eye can read off two overlaid traces anyway.
"""
import math
import os
import pathlib
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, PAD_L, PAD_R, PAD_T, PAD_B = 1100, 470, 96, 34, 62, 66
BIN = 0.25
SMOOTH_S = 6.0
MAX_LAG_S = 10.0


def font(size, mono=False):
    p = f"/usr/share/fonts/truetype/dejavu/{'DejaVuSansMono.ttf' if mono else 'DejaVuSans.ttf'}"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def gust(t):
    g = 0.5 + 0.5 * np.sin(t * 0.37) * np.sin(t * 0.11 + 1.3)
    push = np.maximum(0, np.sin(t * 0.23 + 0.4)) ** 3
    return np.minimum(1, g * 0.8 + push * 0.6)


def leaf_energy(path):
    with wave.open(str(path), "rb") as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    x = x.reshape(-1, ch).mean(axis=1) if ch > 1 else x
    n = int(rate * BIN)
    m = len(x) // n * n
    e = (x[:m].reshape(-1, n) ** 2).mean(axis=1)
    k = max(1, int(SMOOTH_S / BIN))
    return np.convolve(e, np.ones(k) / k, mode="same")


def norm(a):
    d = a - a.mean()
    return d / (math.sqrt(float((d * d).sum())) or 1.0)


def curve(e):
    t = (np.arange(len(e)) + 0.5) * BIN
    g = gust(t)
    n = len(e)
    A, B = norm(e), norm(g)
    out = []
    for L in range(-int(MAX_LAG_S / BIN), int(MAX_LAG_S / BIN) + 1):
        s = float((A[L:] * B[: n - L]).sum()) * n / max(1, n - L) if L >= 0 else float((A[: n + L] * B[-L:]).sum()) * n / max(1, n + L)
        out.append((L * BIN, s))
    return out


def main(before, after, out):
    series = []
    for label, root, colour in (("before", before, (196, 74, 46)), ("after", after, (64, 110, 72))):
        p = pathlib.Path(root) / "leaves.wav"
        if p.exists():
            series.append((label, curve(leaf_energy(p)), colour))
    if len(series) != 2:
        raise SystemExit("need both takes")

    img = Image.new("RGB", (W, H), (250, 249, 246))
    d = ImageDraw.Draw(img)
    f_t, f_s, f_l, f_n = font(22), font(15), font(15), font(14, True)
    d.text((PAD_L, 14), "how far behind the wind the leaves are", (24, 24, 28), font=f_t)
    d.text((PAD_L, 40), "leaf energy in the rendered leaf-only take, slid against wind.ts's gust", (110, 108, 104), font=f_s)

    x0, x1 = PAD_L, W - PAD_R
    y0, y1 = PAD_T + 18, H - PAD_B
    lo = min(r for _, c, _ in series for _, r in c)
    hi = max(r for _, c, _ in series for _, r in c)
    pad = (hi - lo) * 0.12
    lo, hi = lo - pad, hi + pad
    sx = lambda s: x0 + (x1 - x0) * (s + MAX_LAG_S) / (2 * MAX_LAG_S)
    sy = lambda r: y1 - (y1 - y0) * (r - lo) / (hi - lo)
    d.rectangle([x0, y0, x1, y1], fill=(255, 255, 255), outline=(222, 220, 214))
    for r in np.arange(math.ceil(lo * 10) / 10, hi, 0.1):
        if not (lo < r < hi):
            continue
        d.line([x0, sy(r), x1, sy(r)], fill=(238, 236, 230))
        d.text((x0 - 44, sy(r) - 8), f"{r:+.1f}", (150, 148, 142), font=f_n)
    # the wind's own moment: a leaf that answered it on time would peak here
    d.line([sx(0), y0, sx(0), y1], fill=(170, 168, 162), width=2)
    d.text((sx(0) - 52, y0 + 6), "on time", (150, 148, 142), font=f_n)

    for label, c, colour in series:
        d.line([(sx(s), sy(r)) for s, r in c], fill=colour, width=3)
        s, r = max(c, key=lambda p: p[1])
        d.ellipse([sx(s) - 6, sy(r) - 6, sx(s) + 6, sy(r) + 6], fill=colour)
        d.text((sx(s) + 12, sy(r) - 22), f"{label}: {s:+.2f} s", colour, font=f_l)

    for s in range(-10, 11, 2):
        d.text((sx(s) - 10, y1 + 8), f"{s:+d}", (120, 118, 112), font=f_n)
    d.text((PAD_L, y1 + 32), "seconds the leaves lag the wind by", (120, 118, 112), font=f_n)
    d.text((x1 - 300, y1 + 32), "vertical: how well the two match", (120, 118, 112), font=f_n)
    d.text((PAD_L - 78, (y0 + y1) / 2 - 8), "match", (120, 118, 112), font=f_n)
    img.save(out, quality=92)
    print(f"  wrote {out}")


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "/tmp/early/before"
    b = sys.argv[2] if len(sys.argv) > 2 else "/tmp/early/after"
    c = sys.argv[3] if len(sys.argv) > 3 else "art/audio/2026-09-26-early/early.jpg"
    main(a, b, c)
