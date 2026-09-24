#!/usr/bin/env python3
"""shape.py — the before / after sheet for "the tune has a shape now".

    python3 art/audio/2026-09-24-headroom/shape.py --before /tmp/lvl180 --after /tmp/lvl180a \
        --out art/audio/2026-09-24-headroom/shape-before-after.jpg --seconds 120

A spectrogram says what is in a sound; this change is about *when*, so the sheet is four level
traces on one time axis and one scale:

  * the whole mix's short-term loudness, so a reader can see a phrase arrive and a phrase end;
  * the 60–125 Hz band on its own, which is where the pad lives — a flat line there is a held tone
    whatever the rest of the mix does.

The forest bed is drawn under both as a grey fill. It is the same render in the before and the
after column (nothing in `ambience.ts` changed), so anywhere the grey shows through the tune is a
moment the wood can be heard, and the two columns can be compared square by square.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '2026-09-23-lane5'))
from spectra import load, mono  # noqa: E402

def _font(size, bold=False):
    for p in (f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf',):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


FONT = _font(13)
TITLE = _font(22, bold=True)
SUB = _font(15)
BG = (17, 19, 22)
GRID = (44, 48, 54)
BED = (72, 88, 72)
INK = (236, 238, 240)
TUNE = (236, 196, 120)
BAND = (150, 190, 240)


def band_level(x, sr, lo, hi, win=0.5, hop=0.1):
    """short-term level, 500 ms window every 100 ms — the shape of the piece, not its waveform"""
    if lo or hi:
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(len(x), 1.0 / sr)
        X[(f < lo) | (f >= hi)] = 0
        x = np.fft.irfft(X, len(x))
    n, h = int(win * sr), int(hop * sr)
    frames = 1 + max(0, (len(x) - n) // h)
    p = np.cumsum(np.concatenate([[0.0], x.astype(np.float64) ** 2]))
    e = np.sqrt((p[np.arange(frames) * h + n] - p[np.arange(frames) * h]) / n)
    return 20 * np.log10(np.maximum(e, 1e-9)), hop


def trace(draw, xs, series, box, top, bot, colour, fill=False):
    x0, y0, x1, y1 = box
    pts = []
    for i, v in enumerate(series):
        px = x0 + (x1 - x0) * xs[i]
        py = y1 - (y1 - y0) * (np.clip(v, bot, top) - bot) / (top - bot)
        pts.append((px, py))
    if fill:
        draw.polygon([(x0, y1)] + pts + [(x1, y1)], fill=colour)
    else:
        draw.line(pts, fill=colour, width=2)


def panel(draw, box, title, wav_main, wav_bed, sr, seconds, lo, hi, top, bot, colour):
    x0, y0, x1, y1 = box
    draw.rectangle(box, outline=GRID)
    for db in range(int(bot) + 10, int(top), 10):
        y = y1 - (y1 - y0) * (db - bot) / (top - bot)
        draw.line([(x0, y), (x1, y)], fill=GRID)
        draw.text((x0 + 4, y - 11), f'{db}', font=FONT, fill=(110, 116, 124))
    for s in range(0, seconds + 1, 10):
        x = x0 + (x1 - x0) * s / seconds
        draw.line([(x, y0), (x, y1)], fill=GRID)
    b, win = band_level(wav_bed, sr, lo, hi)
    m, _ = band_level(wav_main, sr, lo, hi)
    n = min(len(b), len(m), int(seconds / win))
    xs = np.arange(n) / max(1, n - 1)
    trace(draw, xs, b[:n], box, top, bot, BED, fill=True)
    trace(draw, xs, m[:n], box, top, bot, colour)
    draw.text((x0 + 2, y0 - 17), title, font=SUB, fill=INK)


def single(args):
    """one take on its own, wide — the background a playhead is swept across in the clip video"""
    W, H = args.width, 480
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    a, sr = load(os.path.join(args.single, 'mix.wav'))
    ab, _ = load(os.path.join(args.single, 'bed.wav'))
    x, xb = mono(a), mono(ab)
    y = 92
    for title, lo, hi, top, bot, colour in [
        ('the whole mix (forest bed in grey)', 0, 0, -24.0, -60.0, TUNE),
        ('60-125 Hz only - where the pad sits', 60, 125, -34.0, -74.0, BAND),
    ]:
        box = (16, y, W - 16, y + 160)
        panel(d, box, title, x, xb, sr, args.seconds, lo, hi, top, bot, colour)
        y += 194
    d.text((18, 16), args.label, font=TITLE, fill=INK)
    d.text((18, 46), 'short-term level, 500 ms window; the forest bed is the same render in both takes', font=SUB, fill=(140, 146, 154))
    im.save(args.out, quality=95)
    print('wrote', args.out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before')
    ap.add_argument('--after')
    ap.add_argument('--single', help='render one take wide instead of a before/after pair')
    ap.add_argument('--label', default='')
    ap.add_argument('--out', required=True)
    ap.add_argument('--seconds', type=int, default=120)
    ap.add_argument('--width', type=int, default=1240)
    args = ap.parse_args()
    if args.single:
        return single(args)

    W, H = args.width, 552
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((14, 10), 'The placeholder score before and after the phrase pass: the same walk, the same seed, the same forest bed (grey fill).', font=FONT, fill=INK)
    d.text((14, 24), 'Short-term level, 500 ms window. Top: the whole mix. Bottom: 60-125 Hz alone, where the pad sits. 0-%d s; a pass is 50.5 s.' % args.seconds, font=FONT, fill=(130, 136, 144))

    rows = [
        ('the whole mix', 'mix', 0, 0, -24.0, -60.0, TUNE),
        ('60-125 Hz only - the pad', 'mix', 60, 125, -34.0, -74.0, BAND),
    ]
    y = 60
    for title, stem, lo, hi, top, bot, colour in rows:
        for col, (tag, root) in enumerate([('before', args.before), ('after', args.after)]):
            a, sr = load(os.path.join(root, f'{stem}.wav'))
            ab, _ = load(os.path.join(root, 'bed.wav'))
            box = (14 + col * (W - 28) // 2 + col * 6, y, 14 + (col + 1) * (W - 28) // 2 + col * 6, y + 210)
            panel(d, box, f'{tag}: {title}', mono(a), mono(ab), sr, args.seconds, lo, hi, top, bot, colour)
        y += 238
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
